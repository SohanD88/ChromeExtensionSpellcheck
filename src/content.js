"use strict"

let hotkey = "Mod+Shift+K"
function isMac() {
    return navigator.platform.toUpperCase().includes("MAC")
}

function eventToHotkey(event) {
    const parts = []
    const usesMod = isMac() ? event.metaKey : event.ctrlKey
    if (usesMod)
    {
        parts.push("Mod")
    }
    if (isMac() && event.ctrlKey)
    {
        parts.push("Ctrl")
    }
    if (event.altKey)
    {
        parts.push("Alt")
    }
    if (event.shiftKey)
    {
        parts.push("Shift")
    }

    if (typeof event.key !== "string")
        {
            return ""
        }     

    const key = event.key.length === 1
        ? event.key.toUpperCase() : event.key

    if (!["Control", "Shift", "Alt", "Meta"].includes(key)) {
        parts.push(key)
    }

    return parts.join("+")
}

function isTextElement(element) {
    if (element instanceof HTMLTextAreaElement) {
        return true
    }
    if(! (element instanceof HTMLInputElement)) {
        return false
    }

    const textTypes = ["text", "search", "url", "tel", "password"]
    return textTypes.includes(element.type)
}

function getWordAtCursor(element) {
    const value = element.value
    const start = element.selectionStart || 0
    const end = element.selectionEnd || start

    if (start !== end) {
        return {word: value.slice(start, end), cursorPosition: start,}
    }

    const isWordChar = (char) => /[A-Za-z0-9_]/.test(char)

    let l = start
    let r = start
    while (l > 0 && isWordChar(value[l - 1])) {
        l--
    }
    while (r < value.length && isWordChar(value[r])) {
        r++
    }
    return {word: value.slice(l, r), cursorPosition: start,}
}

// Enable the content script by default.
let enabled = true
const keys = ["enabled", "hotkey"]
document.addEventListener("keydown", (event) => {
    if (!enabled) {
        return
    }
    if (eventToHotkey(event) !== hotkey) {
        return
    }
    const activeElement = document.activeElement
    if (!isTextElement(activeElement)) {
        return
    }
    event.preventDefault()
    const res = getWordAtCursor(activeElement)
    console.log("Clicked word: " + res.word)
    console.log("Cursor position: " + res.cursorPosition)
})




chrome.storage.sync.get(keys, (data) => {
    if (data.enabled === false) {
        enabled = false
    }
    
    if (data.hotkey) {
        hotkey = data.hotkey
    }


})

chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") {
        return
    }
    if (changes.enabled) {
        enabled = changes.enabled.newValue === true

    }
    if (changes.hotkey) {
        hotkey = changes.hotkey.newValue || "Mod+Shift+K"
    }
})

