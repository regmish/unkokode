import { ExtensionMessage } from "../shared/messages";
import { transliterateText } from "../shared/transliteration/engine";
import { ExtensionSettings, TransliterationMode } from "../shared/types";

const appRoot = document.querySelector<HTMLDivElement>("#app");
if (!appRoot) throw new Error("Popup root not found");
const app = appRoot;

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
        min-width: 360px;
        background: #f8f9fa;
      }
      .popup {
        width: 360px;
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
        grid-template-columns: 1fr;
      }
      .pane {
        position: relative;
        padding: 14px 16px 16px;
      }
      .pane + .pane {
        border-top: 1px solid #e8eaed;
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
        padding: 10px 16px 14px;
        font-size: 12px;
        color: #5f6368;
        border-top: 1px solid #e8eaed;
      }
      .shortcut {
        color: #1a73e8;
        font-weight: 500;
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
        <div id="status" class="status">On-page typing is ${settings.wordByWordConversion ? "on" : "off"}. Toggle with <span class="shortcut">Alt+Shift+N</span>.</div>
      </div>
    </div>`;

  const source = document.querySelector<HTMLTextAreaElement>("#source-text");
  const output = document.querySelector<HTMLSpanElement>("#output-text");
  const status = document.querySelector<HTMLDivElement>("#status");
  const copyButton = document.querySelector<HTMLButtonElement>("#copy-output");
  const openSettings = document.querySelector<HTMLButtonElement>("#open-settings");

  const updateOutput = (): void => {
    if (!source || !output) return;
    output.textContent = renderOutput(source.value, mode, settings) || "यहाँ नेपाली देखिन्छ";
  };

  source?.addEventListener("input", updateOutput);
  source?.focus();
  updateOutput();

  copyButton?.addEventListener("click", async () => {
    const text = output?.textContent?.trim() || "";
    if (!text) return;
    await copyText(text);
    if (status) {
      status.textContent = "Copied transliterated text.";
      window.setTimeout(() => {
        status.innerHTML = `On-page typing is ${settings.wordByWordConversion ? "on" : "off"}. Toggle with <span class="shortcut">Alt+Shift+N</span>.`;
      }, 1200);
    }
  });

  openSettings?.addEventListener("click", async () => {
    await chrome.runtime.sendMessage({ type: "OPEN_OPTIONS" } as ExtensionMessage);
    window.close();
  });
}

void render();
