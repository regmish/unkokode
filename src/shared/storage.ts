import { DEFAULT_SETTINGS, DEFAULT_TAB_STATE, STORAGE_KEYS } from "./constants";
import { ExtensionSettings, TabState } from "./types";

export async function getSettings(): Promise<ExtensionSettings> {
  const stored = await chrome.storage.sync.get(STORAGE_KEYS.settings);
  const settings = { ...DEFAULT_SETTINGS, ...(stored[STORAGE_KEYS.settings] || {}) };
  if ("liveConversion" in settings && !("wordByWordConversion" in settings)) {
    settings.wordByWordConversion = Boolean((settings as ExtensionSettings & { liveConversion?: boolean }).liveConversion);
  }
  return settings;
}

export async function updateSettings(patch: Partial<ExtensionSettings>): Promise<ExtensionSettings> {
  const next = { ...(await getSettings()), ...patch };
  await chrome.storage.sync.set({ [STORAGE_KEYS.settings]: next });
  return next;
}

export async function getTabStates(): Promise<Record<string, TabState>> {
  const stored = await chrome.storage.session.get(STORAGE_KEYS.tabStates);
  return stored[STORAGE_KEYS.tabStates] || {};
}

export async function getTabState(tabId?: number): Promise<TabState> {
  if (!tabId && tabId !== 0) return DEFAULT_TAB_STATE;
  const states = await getTabStates();
  return { ...DEFAULT_TAB_STATE, ...(states[String(tabId)] || {}) };
}

export async function setTabState(tabId: number, patch: Partial<TabState>): Promise<TabState> {
  const states = await getTabStates();
  const next = { ...DEFAULT_TAB_STATE, ...(states[String(tabId)] || {}), ...patch };
  states[String(tabId)] = next;
  await chrome.storage.session.set({ [STORAGE_KEYS.tabStates]: states });
  return next;
}
