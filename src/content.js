"use strict"

let hotkey = "Mod+Shift+K"
let pendingCorrection = null
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

    const textTypes = ["text", "search", "url", "tel"]
    return textTypes.includes(element.type)
}

/*function getWordBeforeCursor(element) {
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

} */
async function checkSpelling(sentence, cursorPosition) {
    const response = await fetch("http://127.0.0.1:8000/spellcheck", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({sentence: sentence, cursor_position: cursorPosition }),

    })

    if (!response.ok) {
        throw new Error("Spellcheck req failed: " + response.status)

    }
    return await response.json()
}

function handleCorrection(event) {
    if (pendingCorrection === null) {
        return false
    }
    const item = pendingCorrection
    if (event.key === "Enter") {
        event.preventDefault()
        const prev = item.element.value.slice(0, item.start)
        const post = item.element.value.slice(item.end)

        item.element.value = prev + item.correction + post
        let newCursorPos = item.originalCursor
        const lengthDiff = item.correction.length - item.word.length
        if (item.originalCursor > item.end) {
            newCursorPos += item.correction.length - item.word.length
        }
        item.element.setSelectionRange(newCursorPos, newCursorPos)
        console.log("Accepted correction: ", {word: item.word, correction: item.correction})
        pendingCorrection = null
        return true
    }

    if (event.key === "Escape") {
        event.preventDefault()
        item.element.setSelectionRange(item.originalCursor, item.originalCursor)
        console.log("Rejected correction: ", {word: item.word, correction: item.correction})
        pendingCorrection = null
        return true
    }
    pendingCorrection = null
    return false
}

// Enable the content script by default.
let enabled = true
const keys = ["enabled", "hotkey"]
document.addEventListener("keydown", async (event) => {
    if (handleCorrection(event)) {
        return
    }

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
    
    const sentence = activeElement.value
    const cursorPosition = activeElement.selectionStart ?? 0

    try
    {
        const result = await checkSpelling(sentence, cursorPosition)
        console.log("Spellcheck result:", result)

        if (result.word !== null && result.correction !== null && Number.isInteger(result.start) && Number.isInteger(result.end)) 
        {
            pendingCorrection = {element: activeElement, word: result.word, correction: result.correction, start: result.start, end: result.end, originalCursor: cursorPosition,}
            activeElement.focus()
            activeElement.setSelectionRange(result.start, result.end)
        }
    
    }
    catch (error)
    {
        console.error("Spellcheck backend error: ", error)
    }
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

