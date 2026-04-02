import { ExtensionMessage } from "../shared/messages";
import { transliterateText } from "../shared/transliteration/engine";
import { ExtensionSettings, TransliterationMode } from "../shared/types";

const appRoot = document.querySelector<HTMLDivElement>("#app");
if (!appRoot) throw new Error("Popup root not found");
const app = appRoot;

const NEPALI_SYMBOL_GROUPS = [
  { label: "Vowels", symbols: ["अ", "आ", "इ", "ई", "उ", "ऊ", "ए", "ऐ", "ओ", "औ", "ऋ"] },
  { label: "Marks", symbols: ["ं", "ँ", "ः", "्", "़", "ऽ", "ॐ"] },
  { label: "Digits", symbols: ["०", "१", "२", "३", "४", "५", "६", "७", "८", "९"] },
  { label: "Punctuation", symbols: ["।", "॥", "॰", "₹", "ञ", "ङ", "ञ्", "त्र", "ज्ञ", "क्ष"] }
] as const;

function styles(): string {
  return `
    <style>
      :root {
        color-scheme: light;
        font-family: Roboto, "Noto Sans Devanagari", "Segoe UI", sans-serif;
        background: #f8f9fa;
        color: #202124;
      }
      body {
        margin: 0;
        min-width: 560px;
        background: #f8f9fa;
      }
      .popup {
        width: 560px;
        padding: 12px;
        box-sizing: border-box;
      }
      .panel {
        background: #ffffff;
        border: 1px solid #dadce0;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 1px 2px rgba(60, 64, 67, 0.12), 0 1px 3px rgba(60, 64, 67, 0.08);
      }
      .topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 12px 16px;
        border-bottom: 1px solid #e8eaed;
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
      }
      .mark {
        width: 28px;
        height: 28px;
        border-radius: 8px;
        background: #e8f0fe;
        color: #1a73e8;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        font-weight: 700;
        flex: 0 0 auto;
      }
      .brand-copy {
        min-width: 0;
      }
      .eyebrow {
        margin: 0;
        font-size: 12px;
        color: #5f6368;
      }
      h1 {
        margin: 2px 0 0;
        font-size: 16px;
        line-height: 1.25;
        font-weight: 500;
      }
      .workspace {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .workspace .pane:first-child {
        border-right: 1px solid #e8eaed;
      }
      .pane {
        position: relative;
        padding: 14px 16px 16px;
      }
      .pane + .pane {
        border-top: 0;
      }
      .pane-label {
        display: block;
        font-size: 12px;
        font-weight: 500;
        color: #5f6368;
        letter-spacing: 0.02em;
        margin-bottom: 10px;
      }
      .icon-button {
        width: 36px;
        height: 36px;
        border: 0;
        border-radius: 999px;
        background: transparent;
        color: #5f6368;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      }
      .icon-button:hover {
        background: #f1f3f4;
      }
      .icon-button svg {
        width: 18px;
        height: 18px;
      }
      textarea {
        width: 100%;
        min-height: 106px;
        box-sizing: border-box;
        padding: 0;
        border: 0;
        border-radius: 0;
        resize: none;
        background: transparent;
        color: #202124;
        font: inherit;
        font-size: 24px;
        line-height: 1.35;
      }
      textarea:focus {
        outline: none;
      }
      .output {
        min-height: 106px;
        padding-right: 44px;
      }
      .output-text {
        display: block;
        word-break: break-word;
        color: #202124;
        font-size: 24px;
        line-height: 1.35;
        min-height: 32px;
      }
      .copy-button {
        position: absolute;
        right: 12px;
        bottom: 12px;
      }
      .status {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 10px 12px 12px 10px;
        font-size: 12px;
        color: #5f6368;
        border-top: 1px solid #e8eaed;
      }
      .status-copy {
        min-width: 0;
      }
      .utility-button {
        flex: 0 0 auto;
        width: 32px;
        height: 32px;
      }
      .shortcut {
        color: #1a73e8;
        font-weight: 500;
      }
      .symbol-drawer {
        border-top: 1px solid #e8eaed;
        background: #fff;
        padding: 12px 12px 10px;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px 16px;
      }
      .symbol-drawer[hidden] {
        display: none;
      }
      .symbol-group {
        display: grid;
        gap: 8px;
        align-content: start;
      }
      .symbol-group-label {
        font-size: 11px;
        font-weight: 500;
        color: #5f6368;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .symbol-grid {
        display: grid;
        gap: 6px;
      }
      .symbol-chip {
        width: 100%;
        height: 34px;
        padding: 0 8px;
        border: 1px solid #dadce0;
        border-radius: 8px;
        background: #fff;
        color: #202124;
        font: inherit;
        font-size: 18px;
        line-height: 1;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      }
      .symbol-chip:hover {
        background: #f8f9fa;
        border-color: #c6dafc;
      }
      .symbol-group:nth-child(1) .symbol-grid {
        grid-template-columns: repeat(6, minmax(0, 1fr));
      }
      .symbol-group:nth-child(2) .symbol-grid {
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }
      .symbol-group:nth-child(3) .symbol-grid {
        grid-template-columns: repeat(5, minmax(0, 1fr));
      }
      .symbol-group:nth-child(4) .symbol-grid {
        grid-template-columns: repeat(5, minmax(0, 1fr));
      }
    </style>
  `;
}

function gearIcon(): string {
  return `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19.14 12.94c.04-.31.06-.62.06-.94s-.02-.63-.07-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.08 7.08 0 0 0-1.63-.94l-.36-2.54A.5.5 0 0 0 13.9 1h-3.8a.5.5 0 0 0-.49.42l-.36 2.54c-.58.23-1.12.54-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.7 7.48a.5.5 0 0 0 .12.64l2.03 1.58c-.05.31-.07.63-.07.94s.02.63.07.94L2.82 13.2a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.5.4 1.05.72 1.63.94l.36 2.54a.5.5 0 0 0 .49.42h3.8a.5.5 0 0 0 .49-.42l.36-2.54c.58-.23 1.13-.54 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64zM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5"></path></svg>`;
}

function copyIcon(): string {
  return `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16 1H6a2 2 0 0 0-2 2v12h2V3h10z"></path><path d="M19 5H10a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2m0 16h-9V7h9z"></path></svg>`;
}

function keyboardIcon(): string {
  return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="2.75" y="5.75" width="18.5" height="12.5" rx="2.25" stroke="currentColor" stroke-width="1.5"></rect><rect x="5.25" y="8.25" width="1.75" height="1.75" rx=".35" fill="currentColor"></rect><rect x="8" y="8.25" width="1.75" height="1.75" rx=".35" fill="currentColor"></rect><rect x="10.75" y="8.25" width="1.75" height="1.75" rx=".35" fill="currentColor"></rect><rect x="13.5" y="8.25" width="1.75" height="1.75" rx=".35" fill="currentColor"></rect><rect x="16.25" y="8.25" width="1.75" height="1.75" rx=".35" fill="currentColor"></rect><rect x="5.25" y="11" width="1.75" height="1.75" rx=".35" fill="currentColor"></rect><rect x="8" y="11" width="1.75" height="1.75" rx=".35" fill="currentColor"></rect><rect x="10.75" y="11" width="1.75" height="1.75" rx=".35" fill="currentColor"></rect><rect x="13.5" y="11" width="1.75" height="1.75" rx=".35" fill="currentColor"></rect><rect x="16.25" y="11" width="1.75" height="1.75" rx=".35" fill="currentColor"></rect><rect x="7.25" y="14.25" width="9.5" height="1.75" rx=".45" fill="currentColor"></rect></svg>`;
}

function renderSymbolGroups(): string {
  return NEPALI_SYMBOL_GROUPS.map(
    (group) => `<div class="symbol-group">
      <div class="symbol-group-label">${group.label}</div>
      <div class="symbol-grid">
        ${group.symbols
          .map(
            (symbol) =>
              `<button class="symbol-chip" type="button" data-symbol="${symbol}" aria-label="Insert ${symbol}">${symbol}</button>`
          )
          .join("")}
      </div>
    </div>`
  ).join("");
}

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const helper = document.createElement("textarea");
  helper.value = text;
  helper.style.position = "fixed";
  helper.style.opacity = "0";
  document.body.appendChild(helper);
  helper.select();
  document.execCommand("copy");
  helper.remove();
}

async function loadSettings(): Promise<ExtensionSettings> {
  const response = await chrome.runtime.sendMessage({ type: "GET_SETTINGS" } as ExtensionMessage);
  if (!response?.ok) throw new Error(response?.error || "Failed to load settings");
  return response.settings;
}

function renderOutput(text: string, mode: TransliterationMode, settings: ExtensionSettings): string {
  return transliterateText(text, mode, settings.customMappings);
}

async function render(): Promise<void> {
  const settings = await loadSettings();
  const mode = settings.defaultMode;

  app.innerHTML = `${styles()}
    <div class="popup">
      <div class="panel">
        <div class="topbar">
          <div class="brand">
            <div class="mark">A</div>
            <div class="brand-copy">
              <p class="eyebrow">Nepali typing</p>
              <h1>English to नेपाली</h1>
            </div>
          </div>
          <button id="open-settings" class="icon-button" type="button" aria-label="Open settings">${gearIcon()}</button>
        </div>
        <div class="workspace">
          <div class="pane">
            <span class="pane-label">English</span>
            <textarea id="source-text" placeholder="Type in English"></textarea>
          </div>
          <div class="pane">
            <span class="pane-label">Nepali</span>
            <div class="output">
              <span id="output-text" class="output-text">यहाँ नेपाली देखिन्छ</span>
              <button id="copy-output" class="icon-button copy-button" type="button" aria-label="Copy output">${copyIcon()}</button>
            </div>
          </div>
        </div>
        <div id="status" class="status">
          <button id="toggle-symbols" class="icon-button utility-button" type="button" aria-label="Open Nepali symbols keyboard" aria-expanded="false">${keyboardIcon()}</button>
          <div class="status-copy">On-page typing is ${settings.wordByWordConversion ? "on" : "off"}. Toggle with <span class="shortcut">Alt+Shift+N</span>.</div>
        </div>
        <div id="symbol-drawer" class="symbol-drawer" hidden>
          ${renderSymbolGroups()}
        </div>
      </div>
    </div>`;

  const source = document.querySelector<HTMLTextAreaElement>("#source-text");
  const output = document.querySelector<HTMLSpanElement>("#output-text");
  const status = document.querySelector<HTMLDivElement>("#status");
  const statusCopy = document.querySelector<HTMLDivElement>(".status-copy");
  const copyButton = document.querySelector<HTMLButtonElement>("#copy-output");
  const openSettings = document.querySelector<HTMLButtonElement>("#open-settings");
  const toggleSymbols = document.querySelector<HTMLButtonElement>("#toggle-symbols");
  const symbolDrawer = document.querySelector<HTMLDivElement>("#symbol-drawer");

  const updateOutput = (): void => {
    if (!source || !output) return;
    output.textContent = renderOutput(source.value, mode, settings) || "यहाँ नेपाली देखिन्छ";
  };

  const setStatusMessage = (message: string): void => {
    if (!statusCopy) return;
    statusCopy.innerHTML = message;
  };

  const insertAtCursor = (value: string): void => {
    if (!source) return;
    const start = source.selectionStart ?? source.value.length;
    const end = source.selectionEnd ?? source.value.length;
    source.value = `${source.value.slice(0, start)}${value}${source.value.slice(end)}`;
    const nextCaret = start + value.length;
    source.setSelectionRange(nextCaret, nextCaret);
    source.focus();
    updateOutput();
  };

  source?.addEventListener("input", updateOutput);
  source?.focus();
  updateOutput();

  copyButton?.addEventListener("click", async () => {
    const text = output?.textContent?.trim() || "";
    if (!text) return;
    await copyText(text);
    if (statusCopy) {
      setStatusMessage("Copied transliterated text.");
      window.setTimeout(() => {
        setStatusMessage(`On-page typing is ${settings.wordByWordConversion ? "on" : "off"}. Toggle with <span class="shortcut">Alt+Shift+N</span>.`);
      }, 1200);
    }
  });

  toggleSymbols?.addEventListener("click", () => {
    const isHidden = symbolDrawer?.hasAttribute("hidden") ?? true;
    if (!symbolDrawer) return;
    if (isHidden) {
      symbolDrawer.removeAttribute("hidden");
      toggleSymbols.setAttribute("aria-expanded", "true");
    } else {
      symbolDrawer.setAttribute("hidden", "true");
      toggleSymbols.setAttribute("aria-expanded", "false");
    }
  });

  document.querySelectorAll<HTMLButtonElement>("[data-symbol]").forEach((button) => {
    button.addEventListener("click", () => {
      const symbol = button.dataset.symbol;
      if (!symbol) return;
      insertAtCursor(symbol);
    });
  });

  openSettings?.addEventListener("click", async () => {
    await chrome.runtime.sendMessage({ type: "OPEN_OPTIONS" } as ExtensionMessage);
    window.close();
  });
}

void render();
