# ChromeExtensionSpellcheck

I've always had the issue of typing essays and then having to pick up my mouse, search through the paragraph and fix the errors, or having to delete the word due to a type. To solve this, I created a local prototype Chrome extension that checks spelling in text boxes using a local Python FastAPI backend.

At the current stage, the extension works with real text inputs and textareas. It does not yet support rich text editors like Gmail, Google Docs, Notion, or other `contenteditable` editors.

## What It Does

When the extension is enabled:

1. Click inside a supported text box.
2. Press the configured hotkey.
3. The extension sends the full text and cursor position to the local backend.
4. The backend finds the most recent misspelled word at or before the cursor.
5. The extension highlights that word and shows an in-page popup near it.
6. The popup shows the typo and the suggested correction.
7. Press `Enter` or click the correction to accept it.
8. Press `Escape` or click `Cancel` to reject it.
9. Press the hotkey again while a typo is highlighted to skip it and move to the previous misspelled word.

The correction result is also printed in the browser console.

## Supported Fields

Currently supported:

- `<textarea>`
- `<input type="text">`
- `<input type="search">`
- `<input type="url">`
- `<input type="tel">`

Not currently supported:

- Gmail compose boxes
- Google Docs
- Notion
- `contenteditable` rich text editors
- password fields (for security)

## Backend Setup

From the project folder:

```bash
cd /Users/sohandadana/Python/ChromeSpellcheck/ChromeExtensionSpellcheck
source venv/bin/activate
pip install fastapi uvicorn pyspellchecker
python -m uvicorn spellcheckAPI:app --reload
```

The backend should run at:

```text
http://127.0.0.1:8000
```

Test that it is running:

```text
http://127.0.0.1:8000/health
```

Expected response:

```json
{"status":"ok"}
```

## Backend API

### `POST /spellcheck`

Request:

```json
{
  "sentence": "This is a missplelled sentnce",
  "cursor_position": 28
}
```

Response:

```json
{
  "word": "sentnce",
  "correction": "sentence",
  "start": 21,
  "end": 28,
  "cursor_position": 28
}
```

If no misspelled word is found:

```json
{
  "word": null,
  "correction": null,
  "start": null,
  "end": null,
  "cursor_position": 28
}
```

## Loading The Chrome Extension

1. Open Chrome.
2. Go to:

```text
chrome://extensions
```

3. Turn on Developer Mode.
4. Click Load unpacked.
5. Select:

```text
ChromeExtensionSpellcheck/src
```

6. Make sure the local backend is running before using the extension.

## Using The Extension

1. Open a test page with a real textarea, such as:

```text
https://textarea.page/
```

2. Type a sentence with multiple spelling mistakes:

```text
There is a speling error in this setnece.
```

3. Click inside the text.
4. Put the cursor near the end of the sentence.
5. Press the configured hotkey.
6. The first misspelled word found at or before the cursor should become highlighted. In the example above, this should be `setnece`.
7. Press the hotkey again to skip `setnece` and move to the previous misspelled word, `speling`.
8. Press `Enter` to replace the currently highlighted word with the backend correction.
9. Press `Escape` to reject the currently highlighted correction.
10. You can also click the correction or `Cancel` in the in-page popup.

## Correction Popup

When a typo is highlighted, the extension shows a small in-page popup near the word.

Example:

```text
setnece -> sentence
Enter to accept • Esc to cancel
```

You can accept with `Enter` or by clicking the correction. You can reject with `Escape` or by clicking `Cancel`.

## Skipping Corrections

If a typo is highlighted and you want to leave it unchanged, press the configured hotkey again. The extension keeps the current word unchanged and searches for the previous misspelled word before it.

## Capitalization

The extension preserves basic word casing when applying corrections.

Examples:

```text
teher -> there
Teher -> There
TEHER -> THERE
```

## Hotkey

The popup contains:

- an ON/OFF switch
- a hotkey input

The default hotkey is:

```text
Mod+Shift+K
```

On macOS, `Mod` means `Command`.
On Windows/Linux, `Mod` means `Ctrl`.

Some browser or operating system shortcuts may not reach the extension. If one shortcut does not work, try another one such as:

```text
Ctrl+Shift+K
Alt+Shift+K
Ctrl+Shift+Y
```

## Current Limitations

This is still a prototype.

Current limitations:

- The backend must be running locally.
- The extension only supports normal textboxes.
- Rich text editors are not supported yet.
- Corrections come from `pyspellchecker`.
- Only one highlighted correction is handled at a time.
- The popup currently shows one correction option from the backend.
- Casing preservation handles common lowercase, capitalized, and all-uppercase words, but not every mixed-case style.
- The extension logs debugging information to the browser console.

## Project Files

Important files:

```text
spellcheck.py          Python spellcheck logic
spellcheckAPI.py       FastAPI backend
src/content.js         Chrome extension page logic
src/popup.html         Extension popup UI
src/popup.js           Popup settings logic
src/manifest.json      Chrome extension manifest
```

## Development Notes

The extension calls the local API from `content.js`:

```text
http://127.0.0.1:8000/spellcheck
```

The Chrome manifest includes local backend permissions:

```json
"host_permissions": [
  "http://127.0.0.1:8000/*",
  "http://localhost:8000/*"
]
```

After changing `manifest.json`, reload the extension from `chrome://extensions`.
