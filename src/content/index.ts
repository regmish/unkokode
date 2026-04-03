import { ExtensionMessage } from "../shared/messages";
import { transliterateText, transliterateWordAtCursor, transliterateWord } from "../shared/transliteration/engine";
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
    floatingPanelEnabled: true,
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
let floatingPanelRoot: HTMLDivElement | null = null;
let floatingPanelSource: HTMLTextAreaElement | null = null;
let floatingPanelOutput: HTMLDivElement | null = null;
let floatingPanelStatus: HTMLDivElement | null = null;
let floatingDragSession: { pointerId: number; offsetX: number; offsetY: number } | null = null;
const graphemeSegmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : null;

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

function panelCopyIcon(): string {
  return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16 1H6a2 2 0 0 0-2 2v12h2V3h10z"></path><path d="M19 5H10a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2m0 16h-9V7h9z"></path></svg>';
}

function panelCloseIcon(): string {
  return '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6 18 18M18 6 6 18" stroke="currentColor" stroke-linecap="round" stroke-width="2"></path></svg>';
}

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const helper = document.createElement("textarea");
  helper.value = text;
  helper.setAttribute("readonly", "true");
  helper.style.position = "fixed";
  helper.style.opacity = "0";
  document.body.appendChild(helper);
  helper.select();
  document.execCommand("copy");
  helper.remove();
}

function ensureFloatingPanel(): HTMLDivElement {
  if (floatingPanelRoot && floatingPanelSource && floatingPanelOutput && floatingPanelStatus) {
    return floatingPanelRoot;
  }

  const root = document.createElement("div");
  root.setAttribute("data-nepali-floating-panel", "true");
  root.style.position = "fixed";
  root.style.top = "24px";
  root.style.left = "24px";
  root.style.width = "min(540px, calc(100vw - 32px))";
  root.style.zIndex = "2147483647";
  root.style.background = "#fff";
  root.style.border = "1px solid #dadce0";
  root.style.borderRadius = "16px";
  root.style.boxShadow = "0 12px 36px rgba(60, 64, 67, 0.18)";
  root.style.color = "#202124";
  root.style.font = '14px/1.4 Roboto, "Noto Sans Devanagari", "Segoe UI", sans-serif';
  root.style.overflow = "hidden";

  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.alignItems = "center";
  header.style.justifyContent = "space-between";
  header.style.gap = "12px";
  header.style.padding = "12px 14px";
  header.style.borderBottom = "1px solid #e8eaed";
  header.style.cursor = "move";
  header.style.userSelect = "none";

  const titleWrap = document.createElement("div");
  const title = document.createElement("div");
  title.textContent = "UnkoKode Panel";
  title.style.fontSize = "15px";
  title.style.fontWeight = "600";
  const subtitle = document.createElement("div");
  subtitle.textContent = "Drag anywhere by the header";
  subtitle.style.fontSize = "12px";
  subtitle.style.color = "#5f6368";
  titleWrap.append(title, subtitle);

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Close floating panel");
  closeButton.innerHTML = panelCloseIcon();
  closeButton.style.width = "32px";
  closeButton.style.height = "32px";
  closeButton.style.border = "0";
  closeButton.style.borderRadius = "999px";
  closeButton.style.background = "transparent";
  closeButton.style.color = "#5f6368";
  closeButton.style.display = "inline-flex";
  closeButton.style.alignItems = "center";
  closeButton.style.justifyContent = "center";
  closeButton.style.cursor = "pointer";
  closeButton.style.flex = "0 0 auto";

  const body = document.createElement("div");
  body.style.display = "grid";
  body.style.gridTemplateColumns = "repeat(2, minmax(0, 1fr))";

  const sourcePane = document.createElement("div");
  sourcePane.style.padding = "14px";
  sourcePane.style.borderRight = "1px solid #e8eaed";

  const sourceLabel = document.createElement("div");
  sourceLabel.textContent = "English";
  sourceLabel.style.fontSize = "12px";
  sourceLabel.style.fontWeight = "600";
  sourceLabel.style.color = "#5f6368";
  sourceLabel.style.marginBottom = "10px";

  const source = document.createElement("textarea");
  source.setAttribute("data-nepali-ignore", "true");
  source.placeholder = "Type in English";
  source.style.width = "100%";
  source.style.minHeight = "168px";
  source.style.border = "0";
  source.style.outline = "none";
  source.style.resize = "vertical";
  source.style.font = '24px/1.35 Roboto, "Noto Sans Devanagari", "Segoe UI", sans-serif';
  source.style.color = "#202124";
  source.style.background = "transparent";
  source.style.boxSizing = "border-box";
  sourcePane.append(sourceLabel, source);

  const outputPane = document.createElement("div");
  outputPane.style.padding = "14px";
  outputPane.style.position = "relative";

  const outputLabel = document.createElement("div");
  outputLabel.textContent = "Nepali";
  outputLabel.style.fontSize = "12px";
  outputLabel.style.fontWeight = "600";
  outputLabel.style.color = "#5f6368";
  outputLabel.style.marginBottom = "10px";

  const output = document.createElement("div");
  output.textContent = "यहाँ नेपाली देखिन्छ";
  output.style.minHeight = "168px";
  output.style.paddingRight = "44px";
  output.style.font = '24px/1.35 Roboto, "Noto Sans Devanagari", "Segoe UI", sans-serif';
  output.style.wordBreak = "break-word";
  output.style.whiteSpace = "pre-wrap";

  const copyButton = document.createElement("button");
  copyButton.type = "button";
  copyButton.setAttribute("aria-label", "Copy transliterated text");
  copyButton.innerHTML = panelCopyIcon();
  copyButton.style.position = "absolute";
  copyButton.style.right = "12px";
  copyButton.style.bottom = "12px";
  copyButton.style.width = "32px";
  copyButton.style.height = "32px";
  copyButton.style.border = "0";
  copyButton.style.borderRadius = "999px";
  copyButton.style.background = "transparent";
  copyButton.style.color = "#5f6368";
  copyButton.style.display = "inline-flex";
  copyButton.style.alignItems = "center";
  copyButton.style.justifyContent = "center";
  copyButton.style.cursor = "pointer";

  outputPane.append(outputLabel, output, copyButton);
  body.append(sourcePane, outputPane);

  const status = document.createElement("div");
  status.textContent = "This panel stays open until you close it.";
  status.style.padding = "10px 14px 14px";
  status.style.borderTop = "1px solid #e8eaed";
  status.style.fontSize = "12px";
  status.style.color = "#5f6368";

  header.append(titleWrap, closeButton);
  root.append(header, body, status);
  document.documentElement.appendChild(root);

  const clampPanelPosition = (): void => {
    const maxLeft = Math.max(8, window.innerWidth - root.offsetWidth - 8);
    const maxTop = Math.max(8, window.innerHeight - root.offsetHeight - 8);
    const left = Math.min(maxLeft, Math.max(8, root.offsetLeft));
    const top = Math.min(maxTop, Math.max(8, root.offsetTop));
    root.style.left = `${left}px`;
    root.style.top = `${top}px`;
  };

  header.addEventListener("pointerdown", (event) => {
    if (!(event.target instanceof Element) || event.target.closest("button")) return;
    floatingDragSession = {
      pointerId: event.pointerId,
      offsetX: event.clientX - root.offsetLeft,
      offsetY: event.clientY - root.offsetTop
    };
    header.setPointerCapture(event.pointerId);
  });

  header.addEventListener("pointermove", (event) => {
    if (!floatingDragSession || floatingDragSession.pointerId !== event.pointerId) return;
    root.style.left = `${event.clientX - floatingDragSession.offsetX}px`;
    root.style.top = `${event.clientY - floatingDragSession.offsetY}px`;
    clampPanelPosition();
  });

  header.addEventListener("pointerup", (event) => {
    if (!floatingDragSession || floatingDragSession.pointerId !== event.pointerId) return;
    floatingDragSession = null;
    header.releasePointerCapture(event.pointerId);
  });

  header.addEventListener("pointercancel", () => {
    floatingDragSession = null;
  });

  closeButton.addEventListener("click", () => {
    root.remove();
    floatingPanelRoot = null;
    floatingPanelSource = null;
    floatingPanelOutput = null;
    floatingPanelStatus = null;
  });

  copyButton.addEventListener("click", async () => {
    const text = floatingPanelOutput?.textContent?.trim() || "";
    if (!text) return;
    await copyText(text);
    if (floatingPanelStatus) floatingPanelStatus.textContent = "Copied transliterated text.";
    window.setTimeout(() => {
      if (floatingPanelStatus) floatingPanelStatus.textContent = "This panel stays open until you close it.";
    }, 1200);
  });

  source.addEventListener("input", () => {
    updateFloatingPanelOutput();
  });

  window.addEventListener("resize", clampPanelPosition);

  floatingPanelRoot = root;
  floatingPanelSource = source;
  floatingPanelOutput = output;
  floatingPanelStatus = status;
  return root;
}

function updateFloatingPanelOutput(): void {
  if (!floatingPanelSource || !floatingPanelOutput) return;
  const translated = transliterateText(floatingPanelSource.value, STATE.mode, STATE.settings.customMappings);
  floatingPanelOutput.textContent = translated || "यहाँ नेपाली देखिन्छ";
}

function openFloatingPanel(): void {
  ensureFloatingPanel();
  updateFloatingPanelOutput();
  floatingPanelRoot?.style.removeProperty("display");
  floatingPanelSource?.focus();
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

function getSelectionRange(target: HTMLElement): { start: number; end: number } | null {
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    if (target.selectionStart === null || target.selectionEnd === null) return null;
    return { start: target.selectionStart, end: target.selectionEnd };
  }

  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) return null;
  const range = selection.getRangeAt(0);
  if (!target.contains(range.startContainer) || !target.contains(range.endContainer)) return null;

  const startProbe = document.createRange();
  startProbe.selectNodeContents(target);
  startProbe.setEnd(range.startContainer, range.startOffset);

  const endProbe = document.createRange();
  endProbe.selectNodeContents(target);
  endProbe.setEnd(range.endContainer, range.endOffset);

  return {
    start: startProbe.toString().length,
    end: endProbe.toString().length
  };
}

function setPlainText(target: HTMLElement, value: string, caret: number): void {
  suppressInput = true;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    const prototype = target instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
    descriptor?.set?.call(target, value);
    target.setSelectionRange(caret, caret);
  } else {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(target);
    selection?.removeAllRanges();
    selection?.addRange(range);

    const inserted = document.execCommand("insertText", false, value);
    if (!inserted) {
      target.textContent = value;
    }
    setCaretInTextNode(target, caret);
  }
  target.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertReplacementText", data: value }));
  suppressInput = false;
}

function previousGraphemeStart(text: string, cursor: number): number {
  if (cursor <= 0) return 0;

  if (graphemeSegmenter) {
    let previousIndex = 0;
    for (const { index, segment } of graphemeSegmenter.segment(text)) {
      const nextIndex = index + segment.length;
      if (nextIndex >= cursor) {
        return index;
      }
      previousIndex = index;
    }
    return previousIndex;
  }

  return Math.max(0, cursor - 1);
}

function deleteBackward(target: HTMLElement): boolean {
  const selection = getSelectionRange(target);
  if (!selection) return false;

  const text = getPlainText(target);
  if (selection.start !== selection.end) {
    const nextText = `${text.slice(0, selection.start)}${text.slice(selection.end)}`;
    setPlainText(target, nextText, selection.start);
    return true;
  }

  if (selection.start === 0) return false;

  const deleteStart = previousGraphemeStart(text, selection.start);
  const nextText = `${text.slice(0, deleteStart)}${text.slice(selection.start)}`;
  setPlainText(target, nextText, deleteStart);
  return true;
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
  updateFloatingPanelOutput();
}

document.addEventListener("keydown", (event) => {
  if (!STATE.enabled) return;
  const target = event.target;
  if (!(target instanceof HTMLElement) || !isSupportedEditable(target)) return;

  if (STATE.settings.escapeBehavior.ctrlBypass && (event.ctrlKey || event.metaKey)) {
    skipNextInput = true;
    return;
  }

  if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key === "Backspace") {
    if (deleteBackward(target)) {
      event.preventDefault();
    }
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

chrome.runtime.onMessage.addListener((message: ExtensionMessage | { type?: string }, _sender: unknown, sendResponse: (response: { ok: boolean; error?: string }) => void) => {
  if (message.type === "STATE_UPDATED") {
    void refreshContext();
    sendResponse({ ok: true });
    return;
  }
  if (message.type === "OPEN_FLOATING_PANEL") {
    if (!STATE.settings.floatingPanelEnabled) {
      sendResponse({ ok: false, error: "Enable the floating page panel in Settings first." });
      return;
    }
    openFloatingPanel();
    sendResponse({ ok: true });
    return;
  }
  sendResponse({ ok: true });
});

void refreshContext();
