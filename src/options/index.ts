import { DEFAULT_SETTINGS } from "../shared/constants";
import { ExtensionMessage } from "../shared/messages";
import { ExtensionSettings, TransliterationMode } from "../shared/types";

const appRoot = document.querySelector<HTMLDivElement>("#app");
if (!appRoot) throw new Error("Options root not found");
const app = appRoot;

function pageStyles(): string {
  return `
    <style>
      body { margin: 0; font: 15px/1.5 "Noto Sans Devanagari", "Avenir Next", "Segoe UI", sans-serif; background: linear-gradient(180deg, #fffdf7 0%, #f3eadb 100%); color: #2a2117; }
      .page { max-width: 900px; margin: 0 auto; padding: 28px 18px 42px; display: grid; gap: 14px; }
      .card { background: rgba(255,251,245,0.94); border: 1px solid rgba(124,58,18,0.1); border-radius: 18px; padding: 16px; box-shadow: 0 14px 28px rgba(124,58,18,0.06); }
      h1,h2 { margin: 0; }
      p { margin: 4px 0 0; color: #7c5a37; }
      .grid { display: grid; gap: 12px; }
      .grid.two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      label { display: grid; gap: 6px; }
      textarea, input, select { width: 100%; box-sizing: border-box; border-radius: 12px; border: 1px solid #d8c2a7; padding: 10px 12px; font: inherit; background: #fff; }
      .switch-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 12px; border-radius: 14px; background: #fff8f0; }
      .switch { appearance: none; width: 44px; height: 24px; border-radius: 999px; background: #dbc5aa; position: relative; cursor: pointer; }
      .switch:checked { background: #c27803; }
      .switch::after { content: ""; position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; background: #fff; border-radius: 999px; transition: transform 150ms ease; }
      .switch:checked::after { transform: translateX(20px); }
      .actions { display: flex; gap: 10px; flex-wrap: wrap; }
      button { border: 0; border-radius: 12px; padding: 10px 14px; cursor: pointer; font: inherit; }
      button.primary { background: #7c3a12; color: #fff; }
      button.secondary { background: #efe2ce; color: #6b3f1d; }
      .hint { color: #7c5a37; font-size: 13px; }
      .footer { color: #7c5a37; font-size: 13px; }
      @media (max-width: 720px) { .grid.two { grid-template-columns: 1fr; } }
    </style>
  `;
}

async function loadSettings(): Promise<ExtensionSettings> {
  const response = await chrome.runtime.sendMessage({ type: "GET_SETTINGS" } as ExtensionMessage);
  if (!response?.ok) throw new Error(response?.error || "Failed loading settings");
  return response.settings;
}

function render(settings: ExtensionSettings): void {
  app.innerHTML = `${pageStyles()}
    <div class="page">
      <div class="card">
        <h1>Live Nepali Unicode Input</h1>
        <p>Control where the extension runs and how completed words are transliterated on web pages.</p>
      </div>
      <div class="card grid">
        <h2>General</h2>
        <div class="switch-row"><div><strong>Enable globally</strong><div class="hint">Master switch for the extension</div></div><input id="globalEnabled" class="switch" type="checkbox" ${settings.globalEnabled ? "checked" : ""}></div>
        <div class="grid two">
          <label>Default mode<select id="defaultMode"><option value="smart" ${settings.defaultMode === "smart" ? "selected" : ""}>Smart</option><option value="basic" ${settings.defaultMode === "basic" ? "selected" : ""}>Basic</option></select></label>
          <label>Suggestion behavior<select id="suggestionsEnabled"><option value="true" ${settings.suggestionsEnabled ? "selected" : ""}>Enabled</option><option value="false" ${!settings.suggestionsEnabled ? "selected" : ""}>Disabled</option></select></label>
        </div>
      </div>
      <div class="card grid">
        <h2>Typing behavior</h2>
        <div class="switch-row"><div><strong>Enable in contenteditable</strong><div class="hint">Best for simple rich text fields, not full document editors</div></div><input id="contenteditableEnabled" class="switch" type="checkbox" ${settings.contenteditableEnabled ? "checked" : ""}></div>
        <div class="switch-row"><div><strong>Convert completed words while typing</strong><div class="hint">Transliterates when you press space, punctuation, tab, enter, or leave the field</div></div><input id="wordByWordConversion" class="switch" type="checkbox" ${settings.wordByWordConversion ? "checked" : ""}></div>
        <div class="switch-row"><div><strong>Enable floating page panel</strong><div class="hint">Lets you open a draggable translator panel on the page that stays open until you close it</div></div><input id="floatingPanelEnabled" class="switch" type="checkbox" ${settings.floatingPanelEnabled ? "checked" : ""}></div>
        <div class="switch-row"><div><strong>Brace escape {text}</strong><div class="hint">Keep explicit text in English</div></div><input id="escapeBrace" class="switch" type="checkbox" ${settings.escapeBehavior.brace ? "checked" : ""}></div>
        <div class="switch-row"><div><strong>Slash escape /token</strong><div class="hint">Keep a token literal</div></div><input id="escapeSlash" class="switch" type="checkbox" ${settings.escapeBehavior.slash ? "checked" : ""}></div>
        <div class="switch-row"><div><strong>Ctrl bypass</strong><div class="hint">Hold Ctrl while typing to bypass transliteration</div></div><input id="escapeCtrl" class="switch" type="checkbox" ${settings.escapeBehavior.ctrlBypass ? "checked" : ""}></div>
      </div>
      <div class="card grid two">
        <label>Blocked sites<textarea id="blockedSites" rows="8" placeholder="docs.google.com\nmail.google.com">${settings.siteRules.block.join("\n")}</textarea></label>
        <label>Allowed sites<textarea id="allowedSites" rows="8" placeholder="Leave empty for all sites">${settings.siteRules.allow.join("\n")}</textarea></label>
      </div>
      <div class="card grid">
        <h2>Custom mappings</h2>
        <label>JSON map<textarea id="customMappings" rows="8" placeholder='{"shankar": "शंकर"}'>${JSON.stringify(settings.customMappings, null, 2)}</textarea></label>
      </div>
      <div class="actions">
        <button id="saveButton" class="primary">Save settings</button>
        <button id="resetButton" class="secondary">Reset defaults</button>
      </div>
      <div id="status" class="footer"></div>
    </div>`;

  app.querySelector<HTMLButtonElement>("#saveButton")?.addEventListener("click", async () => {
    const next: Partial<ExtensionSettings> = {
      globalEnabled: app.querySelector<HTMLInputElement>("#globalEnabled")?.checked ?? true,
      defaultMode: (app.querySelector<HTMLSelectElement>("#defaultMode")?.value ?? "smart") as TransliterationMode,
      suggestionsEnabled: (app.querySelector<HTMLSelectElement>("#suggestionsEnabled")?.value ?? "true") === "true",
      contenteditableEnabled: app.querySelector<HTMLInputElement>("#contenteditableEnabled")?.checked ?? true,
      wordByWordConversion: app.querySelector<HTMLInputElement>("#wordByWordConversion")?.checked ?? true,
      floatingPanelEnabled: app.querySelector<HTMLInputElement>("#floatingPanelEnabled")?.checked ?? true,
      siteRules: {
        block: (app.querySelector<HTMLTextAreaElement>("#blockedSites")?.value ?? "").split(/\n+/).map((item) => item.trim()).filter(Boolean),
        allow: (app.querySelector<HTMLTextAreaElement>("#allowedSites")?.value ?? "").split(/\n+/).map((item) => item.trim()).filter(Boolean)
      },
      customMappings: JSON.parse(app.querySelector<HTMLTextAreaElement>("#customMappings")?.value || "{}"),
      escapeBehavior: {
        brace: app.querySelector<HTMLInputElement>("#escapeBrace")?.checked ?? true,
        slash: app.querySelector<HTMLInputElement>("#escapeSlash")?.checked ?? true,
        ctrlBypass: app.querySelector<HTMLInputElement>("#escapeCtrl")?.checked ?? true
      }
    };
    const response = await chrome.runtime.sendMessage({ type: "UPDATE_SETTINGS", patch: next } as ExtensionMessage);
    const status = app.querySelector<HTMLDivElement>("#status");
    if (status) status.textContent = response?.ok ? "Settings saved." : response?.error || "Failed saving settings.";
  });

  app.querySelector<HTMLButtonElement>("#resetButton")?.addEventListener("click", async () => {
    const response = await chrome.runtime.sendMessage({
      type: "UPDATE_SETTINGS",
      patch: DEFAULT_SETTINGS
    } as ExtensionMessage);
    if (response?.ok) render(response.settings);
  });
}

void loadSettings().then(render);
