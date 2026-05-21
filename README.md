# Floh

Floh is a local, keyboard-first Chrome extension for fixing spelling mistakes in web editors. It is designed for mouse-free correction: press a hotkey, review the nearest typo, and use the keyboard to accept, skip, cancel, or ignore the suggestion.

Floh currently runs with:

- a Chrome extension in `src/`
- a local FastAPI backend on `http://127.0.0.1:8000`
- a local LanguageTool server on `http://127.0.0.1:8081`

## What Floh Does

When Floh is enabled:

1. Click inside a supported editor.
2. Press the configured hotkey.
3. Floh sends the editor text, cursor position, and ignored words to the local backend.
4. The backend asks LanguageTool for spelling suggestions.
5. Floh selects the nearest misspelled word at or before the cursor.
6. Floh shows an in-page correction popup near the word.
7. Use the keyboard to accept, cancel, skip backward, or ignore the word.

## Supported Editors

Floh currently supports:

- `<textarea>`
- `<input type="text">`
- `<input type="search">`
- `<input type="url">`
- `<input type="tel">`
- generic `contenteditable` editors
- Gmail compose and reply fields
- Outlook compose and reply fields when the editable surface is accessible
- editable iframes when Chrome can inject the content script
- open shadow-root inputs when the focused element is discoverable

Floh does not currently support:

- Google Docs
- PDFs
- canvas-based editors
- password fields
- payment or security-sensitive fields
- browser internal pages such as `chrome://` pages
- closed shadow DOM editors
- inaccessible or sandboxed frames
- editors that do not expose readable text, caret, selection, and replacement behavior

## Keyboard Controls

The default hotkey is:

```text
Mod+Shift+K
```

On macOS, `Mod` means `Command`. On Windows/Linux, `Mod` means `Ctrl`.

Correction controls:

- `Enter`: accept the current correction
- `Escape`: cancel the correction or dismiss an error/unsupported-editor message
- `D`: add the selected word to ignored words
- configured hotkey again: skip the current typo and search backward

Some browser or operating system shortcuts may not reach the extension. If one shortcut does not work, try another such as:

```text
Ctrl+Shift+K
Alt+Shift+K
Ctrl+Shift+Y
```

## Backend Setup

From the project folder:

```bash
cd /Users/sohandadana/Python/ChromeSpellcheck/Floh
source venv/bin/activate
pip install -r requirements.txt
python -m uvicorn spellcheckAPI:app --reload
```

The FastAPI backend runs at:

```text
http://127.0.0.1:8000
```

Check backend health:

```bash
curl http://127.0.0.1:8000/health
```

Expected response when FastAPI and LanguageTool are both running:

```json
{
  "status": "ok",
  "languagetool": "ok"
}
```

## LanguageTool Setup

Floh expects LanguageTool at:

```text
http://127.0.0.1:8081/v2/check
```

You can override the LanguageTool URL:

```bash
LANGUAGETOOL_URL=http://127.0.0.1:8081/v2/check python -m uvicorn spellcheckAPI:app --reload
```

You can change the language:

```bash
LANGUAGETOOL_LANGUAGE=en-US python -m uvicorn spellcheckAPI:app --reload
```

The backend uses `ALLOWED_ORIGINS` for CORS. The local default is:

```text
http://127.0.0.1:8000,http://localhost:8000
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
/Users/sohandadana/Python/ChromeSpellcheck/Floh/src
```

6. Make sure FastAPI and LanguageTool are running.

After changing files in `src/`, reload Floh from `chrome://extensions` and refresh the webpage being tested.

## Using Floh

1. Open a supported editor.
2. Type a sentence with spelling mistakes:

```text
There is a speling error in this setnece.
```

3. Place the cursor after the text.
4. Press the configured hotkey.
5. Floh selects the nearest previous typo, such as `setnece`.
6. Press `Enter` to accept the correction.
7. Press `Escape` to cancel.
8. Press the hotkey again to skip backward to the previous typo.
9. Press `D` to add the selected word to ignored words.

## Backend API

### `GET /health`

Returns backend and LanguageTool status.

Healthy response:

```json
{
  "status": "ok",
  "languagetool": "ok"
}
```

### `POST /spellcheck`

Request:

```json
{
  "sentence": "This is a missplelled sentnce",
  "cursor_position": 28,
  "ignored_words": []
}
```

Response:

```json
{
  "word": "sentnce",
  "correction": "sentence",
  "suggestions": ["sentence"],
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
  "suggestions": [],
  "start": null,
  "end": null,
  "cursor_position": 28
}
```

## Ignored Words

Ignored words are stored with `chrome.storage.sync`.

You can add ignored words from:

- the extension popup
- the correction popup by pressing `D`

Ignored words are normalized to lowercase before storage.

## Current Limitations

- FastAPI must be running locally.
- LanguageTool must be running locally.
- Floh currently sends the full editor text to the local backend.
- Google Docs is not supported.
- Outlook support depends on the editable surface being accessible to the extension.
- Only one highlighted correction is handled at a time.
- The popup shows one primary correction even though the backend returns multiple suggestions.
- Casing preservation handles common lowercase, capitalized, and all-uppercase words, but not every mixed-case style.

## Project Files

```text
spellcheck.py          LanguageTool spellcheck logic
spellcheckAPI.py       FastAPI backend
requirements.txt       Python dependencies
src/content.js         Chrome extension page logic
src/popup.html         Extension popup UI
src/popup.js           Popup settings logic
src/popup.css          Popup styles
src/background.js      Extension background service worker
src/manifest.json      Chrome extension manifest
```

## Development Checks

Run these before testing:

```bash
node --check src/content.js
python3 -m json.tool src/manifest.json
python3 -m py_compile spellcheck.py spellcheckAPI.py
```

Then reload the extension from `chrome://extensions` and refresh the page being tested.
