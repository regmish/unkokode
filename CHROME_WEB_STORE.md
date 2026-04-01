# Chrome Web Store Submission Pack

## Package

- Upload ZIP: `release/live-nepali-unicode-input-v0.1.0.zip`
- Unpacked build: `dist/`
- Store visibility: `Public`
- Category: `Utilities`
- Listing languages: `English`, `Nepali`
- Support contact: `support@regmi.de`
- Listing screenshot: provided

## Suggested Listing

### Name

Live Nepali Unicode Input

### Summary

Type romanized Nepali and convert completed words into Nepali Unicode across the web.

### Description

Live Nepali Unicode Input lets you type Nepali using English letters and converts completed words into Nepali Unicode directly in web forms.

Key features:

- Toggle Nepali typing on the current tab with `Alt+Shift+N`
- Convert word by word instead of letter by letter for cleaner typing
- Works in standard text inputs, textareas, and simple contenteditable fields
- Includes a compact popup for quick English-to-Nepali transliteration
- Runs locally in the extension with no external transliteration service

Notes:

- Rich editors such as Google Docs and advanced custom editors are not guaranteed in this version
- You can control blocked sites and typing behavior from the options page

## Privacy Form Draft

### Does the extension collect user data?

No.

### Why

- Transliteration runs locally in the extension
- Settings are stored with Chrome extension storage only
- No analytics, ads, trackers, or remote API calls are implemented in the codebase

## Permissions Justification

### `storage`

Used to save user preferences such as default mode, blocked sites, and typing behavior.

### `commands`

Used for the keyboard shortcut `Alt+Shift+N` to toggle Nepali typing on the current tab.

### Host permission `<all_urls>`

Required so the content script can enable Nepali transliteration in editable fields on the pages where the user wants to type.

## Assets You Still Need

- Optional promo images if you want featured placement
- Privacy policy URL only if the dashboard determines one is required for your distribution setup

## Screenshot Ideas

- Popup open with English on top and Nepali output below
- Typing in a simple web textarea with Nepali mode enabled
- Options page showing the word-by-word typing setting
