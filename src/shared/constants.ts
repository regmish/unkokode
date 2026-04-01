import { ExtensionSettings, TabState } from "./types";

export const STORAGE_KEYS = {
  settings: "settings",
  tabStates: "tabStates"
} as const;

export const DEFAULT_SETTINGS: ExtensionSettings = {
  globalEnabled: true,
  defaultMode: "smart",
  suggestionsEnabled: true,
  contenteditableEnabled: true,
  wordByWordConversion: true,
  debug: false,
  siteRules: {
    allow: [],
    block: ["docs.google.com"]
  },
  customMappings: {},
  escapeBehavior: {
    brace: true,
    slash: true,
    ctrlBypass: true
  }
};

export const DEFAULT_TAB_STATE: TabState = {
  enabled: false,
  mode: "smart"
};

export const BADGE_ON = { text: "NE", color: "#0a84ff" };
export const BADGE_OFF = { text: "", color: "#6b7280" };
