# Live Nepali Unicode Input Extension

Chrome extension workspace for live romanized Nepali to Nepali Unicode transliteration.

## Commands

```bash
npm run typecheck --prefix extension
npm run test --prefix extension
npm run build --prefix extension
```

## Load in Chrome

1. Build the extension workspace.
2. Open `chrome://extensions`.
3. Enable Developer Mode.
4. Load unpacked from `extension/dist`.

## Notes

- V1 supports text inputs, textareas, and simple `contenteditable` fields.
- Rich editors like Google Docs and full ProseMirror/Quill surfaces are intentionally not guaranteed in v1.
- Transliteration runs locally in the content script; nothing is sent to external services.
