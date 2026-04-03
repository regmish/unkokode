export type TransliterationMode = "smart" | "basic";

export type SiteRuleMode = "allow" | "block";

export type SiteRules = {
  allow: string[];
  block: string[];
};

export type EscapeBehavior = {
  brace: boolean;
  slash: boolean;
  ctrlBypass: boolean;
};

export type ExtensionSettings = {
  globalEnabled: boolean;
  defaultMode: TransliterationMode;
  suggestionsEnabled: boolean;
  contenteditableEnabled: boolean;
  wordByWordConversion: boolean;
  floatingPanelEnabled: boolean;
  debug: boolean;
  siteRules: SiteRules;
  customMappings: Record<string, string>;
  escapeBehavior: EscapeBehavior;
};

export type TabState = {
  enabled: boolean;
  mode: TransliterationMode;
};

export type TransliterationCandidate = {
  text: string;
  reason: string;
};

export type TransliterationResult = {
  text: string;
  candidates: TransliterationCandidate[];
  ambiguous: boolean;
  preserveEnglish: boolean;
};

export type EditableKind = "input" | "textarea" | "contenteditable";

export type ActiveSiteState = {
  hostname: string;
  enabled: boolean;
  mode: TransliterationMode;
  blockedBySiteRule: boolean;
};
