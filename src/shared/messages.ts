import { ActiveSiteState, ExtensionSettings, TabState, TransliterationMode } from "./types";

export type ExtensionMessage =
  | { type: "GET_CONTEXT"; hostname: string; tabId?: number }
  | { type: "GET_SETTINGS" }
  | { type: "UPDATE_SETTINGS"; patch: Partial<ExtensionSettings> }
  | { type: "TOGGLE_SITE"; hostname: string; enabled: boolean }
  | { type: "SET_TAB_ENABLED"; tabId?: number; enabled: boolean }
  | { type: "SET_MODE"; mode: TransliterationMode; tabId?: number }
  | { type: "OPEN_FLOATING_PANEL" }
  | { type: "OPEN_OPTIONS" }
  | { type: "PING" };

export type ExtensionMessageResponse =
  | { ok: true; settings: ExtensionSettings }
  | { ok: true; context: ActiveSiteState; settings: ExtensionSettings; tabState: TabState }
  | { ok: true; tabState: TabState }
  | { ok: true }
  | { ok: false; error: string };
