import { BADGE_OFF, BADGE_ON, DEFAULT_SETTINGS, DEFAULT_TAB_STATE } from "../shared/constants";
import { ExtensionMessage, ExtensionMessageResponse } from "../shared/messages";
import { getSettings, getTabState, setTabState, updateSettings } from "../shared/storage";
import { ActiveSiteState, ExtensionSettings, TabState, TransliterationMode } from "../shared/types";

function matchesSiteRule(hostname: string, rules: string[]): boolean {
  return rules.some((rule) => hostname === rule || hostname.endsWith(`.${rule}`));
}

function resolveContext(hostname: string, settings: ExtensionSettings, tabState: TabState): ActiveSiteState {
  const blockedBySiteRule = matchesSiteRule(hostname, settings.siteRules.block);
  const allowedBySiteRule = settings.siteRules.allow.length === 0 || matchesSiteRule(hostname, settings.siteRules.allow);
  const enabled = settings.globalEnabled && tabState.enabled && !blockedBySiteRule && allowedBySiteRule;
  return {
    hostname,
    enabled,
    mode: tabState.mode || settings.defaultMode,
    blockedBySiteRule
  };
}

async function applyBadge(tabId?: number, enabled = false): Promise<void> {
  if (tabId === undefined || tabId < 0) return;
  await chrome.action.setBadgeBackgroundColor({ tabId, color: enabled ? BADGE_ON.color : BADGE_OFF.color });
  await chrome.action.setBadgeText({ tabId, text: enabled ? BADGE_ON.text : BADGE_OFF.text });
}

async function refreshTab(tabId?: number): Promise<void> {
  if (tabId === undefined || tabId < 0) return;
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const url = tab?.id === tabId ? tab.url : (await chrome.tabs.get(tabId)).url;
  const hostname = url ? new URL(url).hostname : "";
  const settings = await getSettings();
  const tabState = await getTabState(tabId);
  const context = resolveContext(hostname, settings, tabState);
  await applyBadge(tabId, context.enabled);
  await chrome.tabs.sendMessage(tabId, { type: "STATE_UPDATED" }).catch(() => undefined);
}

async function handleMessage(message: ExtensionMessage, sender: any): Promise<ExtensionMessageResponse> {
  if (message.type === "GET_SETTINGS") {
    return { ok: true, settings: await getSettings() };
  }

  if (message.type === "GET_CONTEXT") {
    const settings = await getSettings();
    const tabState = await getTabState(message.tabId ?? sender?.tab?.id);
    const context = resolveContext(message.hostname, settings, tabState);
    await applyBadge(message.tabId ?? sender?.tab?.id, context.enabled);
    return { ok: true, context, settings, tabState };
  }

  if (message.type === "UPDATE_SETTINGS") {
    const settings = await updateSettings(message.patch);
    return { ok: true, settings };
  }

  if (message.type === "TOGGLE_SITE") {
    const settings = await getSettings();
    const block = new Set(settings.siteRules.block);
    if (message.enabled) {
      block.delete(message.hostname);
    } else {
      block.add(message.hostname);
    }
    const next = await updateSettings({
      siteRules: {
        ...settings.siteRules,
        block: [...block].sort()
      }
    });
    if (sender?.tab?.id !== undefined) await refreshTab(sender.tab.id);
    return { ok: true, settings: next };
  }

  if (message.type === "SET_TAB_ENABLED") {
    const tabId = message.tabId ?? sender?.tab?.id;
    if (tabId === undefined) return { ok: false, error: "Missing tab id" };
    const tabState = await setTabState(tabId, { enabled: message.enabled });
    await refreshTab(tabId);
    return { ok: true, tabState };
  }

  if (message.type === "SET_MODE") {
    const nextMode: TransliterationMode = message.mode;
    if (message.tabId !== undefined) {
      const tabState = await setTabState(message.tabId, { mode: nextMode });
      await refreshTab(message.tabId);
      return { ok: true, tabState };
    }
    const settings = await updateSettings({ defaultMode: nextMode });
    return { ok: true, settings };
  }

  if (message.type === "OPEN_OPTIONS") {
    await chrome.runtime.openOptionsPage();
    return { ok: true };
  }

  return { ok: true };
}

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.sync.get("settings");
  if (!existing?.settings) {
    await chrome.storage.sync.set({ settings: { ...DEFAULT_SETTINGS } });
  }
  await chrome.storage.session.set({ tabStates: {} });
});

chrome.commands.onCommand.addListener(async (command: string) => {
  if (command !== "toggle-nepali-mode") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  const current = await getTabState(tab.id);
  await setTabState(tab.id, { enabled: !current.enabled, mode: current.mode || DEFAULT_TAB_STATE.mode });
  await refreshTab(tab.id);
});

chrome.tabs.onActivated.addListener(async ({ tabId }: { tabId: number }) => {
  await refreshTab(tabId);
});

chrome.tabs.onUpdated.addListener(async (tabId: number, changeInfo: { status?: string }) => {
  if (changeInfo.status === "complete") await refreshTab(tabId);
});

chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender: any, sendResponse: (response: ExtensionMessageResponse) => void) => {
  handleMessage(message, sender)
    .then(sendResponse)
    .catch((error: unknown) => {
      const text = error instanceof Error ? error.message : "Unexpected extension error";
      sendResponse({ ok: false, error: text });
    });
  return true;
});
