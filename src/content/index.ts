import { ExtensionMessage } from "../shared/messages";
import { transliterateWordAtCursor, transliterateWord } from "../shared/transliteration/engine";
import { ExtensionSettings, TransliterationMode } from "../shared/types";

type RuntimeContext = {
  enabled: boolean;
  mode: TransliterationMode;
  settings: ExtensionSettings;
};

const STATE: RuntimeContext = {
  enabled: false,
  mode: "smart",
  settings: {
    globalEnabled: true,
    defaultMode: "smart",
    suggestionsEnabled: true,
    contenteditableEnabled: true,
    wordByWordConversion: true,
    debug: false,
    siteRules: { allow: [], block: [] },
    customMappings: {},
    escapeBehavior: { brace: true, slash: true, ctrlBypass: true }
  }
};

let suppressInput = false;
let isComposing = false;
let activeEditable: HTMLElement | null = null;
let statusRoot: HTMLDivElement | null = null;
let statusTimer = 0;
let skipNextInput = false;

function isSupportedInput(element: Element): element is HTMLInputElement | HTMLTextAreaElement {
  if (element instanceof HTMLTextAreaElement) return true;
  if (!(element instanceof HTMLInputElement)) return false;
  const type = element.type || "text";
  return !["password", "number", "date", "email", "url", "search", "tel"].includes(type);
}

function isCodeLikeElement(element: HTMLElement): boolean {
  const role = element.getAttribute("role") || "";
  const classes = `${element.className || ""}`;
  return /code|monaco|cm-editor|ace_editor|CodeMirror/i.test(classes) || /code/i.test(role);
}

function isSupportedEditable(element: Element | null): element is HTMLElement {
  if (!element) return false;
  if (isSupportedInput(element)) return true;
  if (!(element instanceof HTMLElement)) return false;
  return element.isContentEditable && STATE.settings.contenteditableEnabled && !isCodeLikeElement(element);
}

function isTokenCharacter(char: string): boolean {
  return /^[A-Za-z*:\\/]$/.test(char);
}

function ensureStatusRoot(): HTMLDivElement {
  if (statusRoot) return statusRoot;
  statusRoot = document.createElement("div");
  statusRoot.setAttribute("role", "status");
  statusRoot.style.position = "fixed";
  statusRoot.style.top = "16px";
  statusRoot.style.right = "16px";
  statusRoot.style.zIndex = "2147483647";
  statusRoot.style.display = "none";
  statusRoot.style.alignItems = "center";
  statusRoot.style.gap = "8px";
  statusRoot.style.padding = "10px 12px";
  statusRoot.style.borderRadius = "999px";
  statusRoot.style.background = "rgba(15, 23, 42, 0.92)";
  statusRoot.style.color = "#f8fafc";
  statusRoot.style.font = "600 13px/1.2 -apple-system, BlinkMacSystemFont, sans-serif";
  statusRoot.style.boxShadow = "0 12px 32px rgba(15, 23, 42, 0.18)";
  statusRoot.style.pointerEvents = "none";
  document.documentElement.appendChild(statusRoot);
  return statusRoot;
}

function showStatus(message: string): void {
  const root = ensureStatusRoot();
  root.textContent = message;
  root.style.display = "inline-flex";
  window.clearTimeout(statusTimer);
  statusTimer = window.setTimeout(() => {
    if (statusRoot) statusRoot.style.display = "none";
  }, 1400);
}

function getPlainText(target: HTMLElement): string {
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    return target.value;
  }
  return target.textContent || "";
}

function setCaretInTextNode(root: HTMLElement, offset: number): void {
  const selection = window.getSelection();
  if (!selection) return;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let consumed = 0;
  let node = walker.nextNode();

  while (node) {
    const textNode = node as Text;
    const nextConsumed = consumed + textNode.data.length;
    if (offset <= nextConsumed) {
      const range = document.createRange();
      range.setStart(textNode, Math.max(0, offset - consumed));
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      return;
    }
    consumed = nextConsumed;
    node = walker.nextNode();
  }

  const range = document.createRange();
  range.selectNodeContents(root);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

function getCursorOffset(target: HTMLElement): number | null {
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    if (target.selectionStart === null || target.selectionEnd === null || target.selectionStart !== target.selectionEnd) {
      return null;
    }
    return target.selectionStart;
  }

  const selection = window.getSelection();
  if (!selection || !selection.rangeCount || !selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);
  if (!target.contains(range.startContainer)) return null;
  const probe = document.createRange();
  probe.selectNodeContents(target);
  probe.setEnd(range.startContainer, range.startOffset);
  return probe.toString().length;
}

function setPlainText(target: HTMLElement, value: string, caret: number): void {
  suppressInput = true;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    target.value = value;
    target.setSelectionRange(caret, caret);
  } else {
    target.textContent = value;
    setCaretInTextNode(target, caret);
  }
  target.dispatchEvent(new Event("input", { bubbles: true }));
  suppressInput = false;
}

function findPreviousTokenRange(text: string, cursor: number): { start: number; end: number } | null {
  let end = cursor;
  while (end > 0 && !isTokenCharacter(text[end - 1])) {
    end -= 1;
  }
  let start = end;
  while (start > 0 && isTokenCharacter(text[start - 1])) {
    start -= 1;
  }
  if (start === end) return null;
  return { start, end };
}

function shouldSkipTarget(target: HTMLElement): boolean {
  return Boolean(target.getAttribute("data-nepali-ignore") === "true");
}

function commitPreviousWord(target: HTMLElement, cursor: number): void {
  const text = getPlainText(target);
  const range = findPreviousTokenRange(text, cursor);
  if (!range) return;
  const token = text.slice(range.start, range.end);
  const transliterated = transliterateWord(token, STATE.mode, STATE.settings.customMappings).text;
  if (transliterated === token) return;
  const nextText = `${text.slice(0, range.start)}${transliterated}${text.slice(range.end)}`;
  const nextCursor = cursor - (range.end - range.start) + transliterated.length;
  setPlainText(target, nextText, nextCursor);
}

function commitCurrentWord(target: HTMLElement): void {
  const cursor = getCursorOffset(target);
  if (cursor === null) return;
  const text = getPlainText(target);
  const result = transliterateWordAtCursor(text, cursor, STATE.mode, STATE.settings.customMappings);
  if (!result.range || result.text === text) return;
  setPlainText(target, result.text, result.range.end);
}

function handleWordBoundary(target: HTMLElement): void {
  if (!STATE.enabled || !STATE.settings.wordByWordConversion || shouldSkipTarget(target)) return;
  const cursor = getCursorOffset(target);
  if (cursor === null) return;
  commitPreviousWord(target, cursor);
}

function handleInput(event: Event): void {
  if (suppressInput || isComposing || !STATE.enabled) return;
  const target = event.target;
  if (!(target instanceof HTMLElement) || !isSupportedEditable(target) || shouldSkipTarget(target)) return;
  activeEditable = target;

  if (!STATE.settings.wordByWordConversion) return;

  const inputEvent = event as InputEvent;
  if (skipNextInput) {
    skipNextInput = false;
    return;
  }

  const inputType = inputEvent.inputType || "";
  const insertedText = inputEvent.data || "";
  const boundaryInserted =
    inputType === "insertParagraph" ||
    inputType === "insertLineBreak" ||
    (inputType === "insertText" && insertedText.length > 0 && /[^A-Za-z*:\\/]/.test(insertedText)) ||
    inputType === "insertFromPaste";

  if (boundaryInserted) {
    handleWordBoundary(target);
  }
}

function handleBlurCommit(target: HTMLElement): void {
  if (!STATE.enabled || !STATE.settings.wordByWordConversion || shouldSkipTarget(target)) return;
  commitCurrentWord(target);
}

async function refreshContext(): Promise<void> {
  const response = await chrome.runtime.sendMessage({
    type: "GET_CONTEXT",
    hostname: window.location.hostname
  } as ExtensionMessage);

  if (!response?.ok) return;
  const wasEnabled = STATE.enabled;
  STATE.enabled = response.context.enabled;
  STATE.mode = response.context.mode;
  STATE.settings = response.settings;
  if (wasEnabled !== STATE.enabled) {
    showStatus(STATE.enabled ? "Nepali typing on" : "Nepali typing off");
  }
}

document.addEventListener("keydown", (event) => {
  if (!STATE.enabled) return;
  const target = event.target;
  if (!(target instanceof HTMLElement) || !isSupportedEditable(target)) return;

  if (STATE.settings.escapeBehavior.ctrlBypass && (event.ctrlKey || event.metaKey)) {
    skipNextInput = true;
    return;
  }

  if (event.key === "Enter" || event.key === "Tab") {
    handleBlurCommit(target);
  }
}, true);

document.addEventListener("input", (event) => {
  handleInput(event);
}, true);

document.addEventListener("compositionstart", () => {
  isComposing = true;
});

document.addEventListener("compositionend", (event) => {
  isComposing = false;
  handleInput(event);
}, true);

document.addEventListener("focusin", (event) => {
  const target = event.target;
  if (target instanceof HTMLElement && isSupportedEditable(target)) {
    activeEditable = target;
  }
}, true);

document.addEventListener("focusout", () => {
  const target = activeEditable;
  if (target) {
    window.setTimeout(() => {
      handleBlurCommit(target);
    }, 0);
  }
  activeEditable = null;
}, true);

chrome.runtime.onMessage.addListener((message: { type?: string }) => {
  if (message.type === "STATE_UPDATED") {
    void refreshContext();
  }
});

void refreshContext();
