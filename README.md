# ChromeExtensionSpellcheck

I've always had the issue of typing essays and then having to pick up my mouse, search through the paragraph and fix the errors, or having to delete the word due to a type. To solve this, I created a local prototype Chrome extension that checks spelling in text boxes using a local Python FastAPI backend.

At the current stage, the extension works with real text inputs and textareas. It does not yet support rich text editors like Gmail, Google Docs, Notion, or other `contenteditable` editors.

## What It Does

When the extension is enabled:

1. Click inside a supported text box.
2. Press the configured hotkey.
3. The extension sends the full text and cursor position to the local backend.
4. The backend finds the most recent misspelled word at or before the cursor.
5. The extension highlights that word.
6. Press `Enter` to accept the correction.
7. Press `Escape` to reject the correction.

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
uvicorn spellcheckAPI:app --reload
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

2. Type a sentence with a spelling mistake:

```text
This is a missplelled sentnce
```

3. Click inside the text.
4. Put the cursor after or inside the misspelled word.
5. Press the configured hotkey.
6. The misspelled word should become highlighted.
7. Press `Enter` to replace it with the backend correction.
8. Press `Escape` to reject the correction.

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
- The extension does not show a visual popup suggestion yet.
- The extension does not preserve capitalization perfectly yet.
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
