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

function getWordBeforeCursor(element) {
    const value = element.value
    const cursorPosition = element.selectionStart || 0
    const isWordChar = (char) => /[a-zA-Z0-9_]/.test(char)
    let endIndex = cursorPosition
    //If cursor is after spaces or punctuation, move cursor to the end of the last word
    while (endIndex > 0 && !isWordChar(value[endIndex - 1])) {
        endIndex--
    }

    //If there is no word before the cursor, return nothing
    if (endIndex === 0 && !isWordChar(value[0])) {
        return {word: "", cursorPosition, startIndex: cursorPosition, endIndex: cursorPosition}
    }

    let startIndex = endIndex
    //move to start of the word
    while (startIndex > 0 && isWordChar(value[startIndex - 1])) {
        startIndex--
    }
    //if cursor in middle of word, go to the end of the word
    while (endIndex < value.length && isWordChar(value[endIndex])) {
        endIndex++
    }

    return {word: value.slice(startIndex, endIndex), cursorPosition, startIndex, endIndex}

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
    const res = getWordBeforeCursor(activeElement)
    if (res.word !== "") {
        activeElement.setSelectionRange(res.startIndex, res.endIndex)
    }
    console.log("Highlighted word:", res.word)
    console.log("Cursor position:", res.cursorPosition)
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

