"use strict"

let hotkey = "Mod+Shift+K"
let pendingCorrection = null
let correctionPopup = null
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

function hideCorrectionPopup() {
    if (correctionPopup !== null) {
        correctionPopup.remove()
        correctionPopup = null
    }
}

function getTextPosition(element, index) {
    const rect = element.getBoundingClientRect()
    const style = window.getComputedStyle(element)

    const mirror = document.createElement("div")
    mirror.style.position = "fixed"
    mirror.style.visibility = "hidden"
    mirror.style.whiteSpace = element instanceof HTMLTextAreaElement ? "pre-wrap" : "pre"
    mirror.style.wordWrap = "break-word"
    mirror.style.overflow = "hidden"

    mirror.style.left = `${rect.left}px`
    mirror.style.top = `${rect.top}px`
    mirror.style.width = `${rect.width}px`
    mirror.style.height = `${rect.height}px`

    mirror.style.font = style.font
    mirror.style.letterSpacing = style.letterSpacing
    mirror.style.padding = style.padding
    mirror.style.border = style.border
    mirror.style.boxSizing = style.boxSizing
    mirror.style.lineHeight = style.lineHeight

    const before = document.createTextNode(element.value.slice(0, index))
    const marker = document.createElement("span")
    marker.textContent = element.value.slice(index, index + 1) || " "

    mirror.appendChild(before)
    mirror.appendChild(marker)
    document.body.appendChild(mirror)

    const markerRect = marker.getBoundingClientRect()
    document.body.removeChild(mirror)

    return {
        left: markerRect.left - element.scrollLeft,
        top: markerRect.bottom - element.scrollTop
    }
}


function showCorrectionPopup(item) {
        hideCorrectionPopup()

        const box = item.element.getBoundingClientRect()
        const popup = document.createElement("div")
        popup.style.position = "fixed"
        const position = getTextPosition(item.element, item.start)
        popup.style.left = `${position.left}px`
        popup.style.top = `${position.top + 8}px`
        popup.style.zIndex = "2147483647"
        popup.style.color = "white"
        popup.style.padding = "10px 12px"
        popup.style.borderRadius = "8px"
        popup.style.boxShadow = "0 2px 10px rgba(0,0,0,0.25)"
        popup.style.font = "13px, system-ui, sans-serif"

        popup.innerHTML = `
        <button type="button" data-action="accept" style="all: unset; cursor: pointer; font-weight: 600;">
            ${item.word} → ${item.correction}
        </button>
        <div style="margin-top: 4px; color: #d1d5db;">
            Enter to accept • Esc to cancel
        </div>
        <button type="button" data-action="cancel" style="all: unset; cursor: pointer; margin-top: 6px; color: #93c5fd;">
            Cancel
        </button>
    `
    popup.addEventListener("mousedown", (event) => {
        event.preventDefault()
    })

    popup.addEventListener("click", (event) => {
        const target = event.target
        if (!(target instanceof HTMLElement)) {
            return
        }
        if (target.dataset.action === "accept") {
            acceptCorrection()
        }
        if (target.dataset.action === "cancel") {
            cancelCorrection()
        }
    })
    document.documentElement.appendChild(popup)
    correctionPopup = popup
}

function acceptCorrection() {
    if (pendingCorrection === null) {
        return false

    }
    const item = pendingCorrection
    const prev = item.element.value.slice(0, item.start)
    const post = item.element.value.slice(item.end)

    item.element.value = prev + item.correction + post
    let newCursorPos = item.originalCursor
    if (item.originalCursor > item.end) {
        newCursorPos += item.correction.length - item.word.length
    }
    item.element.focus()
    item.element.setSelectionRange(newCursorPos, newCursorPos)

    console.log("Accepted correction: ", {word: item.word, correction: item.correction})
    pendingCorrection = null
    hideCorrectionPopup()
    return true
}

function cancelCorrection() {
    if (pendingCorrection === null) {
        return false
    }
    const item = pendingCorrection
    item.element.focus()
    item.element.setSelectionRange(item.originalCursor, item.originalCursor)
    console.log("Rejected correction: ", {word: item.word, correction: item.correction})
    pendingCorrection = null
    hideCorrectionPopup()
    return true
}

function handleCorrection(event) {
    if (pendingCorrection === null) {
        return false
    }

    if (event.key === "Enter") {
        event.preventDefault()
        return acceptCorrection()
    }

    if (event.key === "Escape") {
        event.preventDefault()
        return cancelCorrection()
    }

    pendingCorrection = null
    hideCorrectionPopup()
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
            showCorrectionPopup(pendingCorrection)
        }
        else {
            pendingCorrection = null
            hideCorrectionPopup()
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

