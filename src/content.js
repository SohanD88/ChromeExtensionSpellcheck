"use strict"

const blurFilter = "blur(6px)"
let textToBlur = ""

let hotkey = "Ctrl+Shift+K"
function eventToHotkey(event) {
    const parts = []
    if (event.ctrlKey)
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
    if (event.metaKey)
    {
        parts.push("Meta")
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

document.addEventListener("keydown", (event) => {
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




// Search this DOM node for text to blur and blur the parent element if found.
function processNode(node) {
    if (node.childNodes.length > 0) {
        Array.from(node.childNodes).forEach(processNode)
    }
    if (node.nodeType === Node.TEXT_NODE &&
        node.textContent !== null && node.textContent.trim().length > 0) {
        const parent = node.parentElement
        if (parent !== null &&
            (parent.tagName === 'SCRIPT' || parent.style.filter === blurFilter)) {
            // Already blurred
            return
        }
        if (node.textContent.includes(textToBlur)) {
            blurElement(parent)
        }
    }
}

function blurElement(elem) {
    elem.style.filter = blurFilter
    console.debug("blurred id:" + elem.id + " class:" + elem.className +
        " tag:" + elem.tagName + " text:" + elem.textContent)
}

// Create a MutationObserver to watch for changes to the DOM.
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.addedNodes.length > 0) {
            mutation.addedNodes.forEach(processNode)
        } else {
            processNode(mutation.target)
        }
    })
})

// Enable the content script by default.
let enabled = true
const keys = ["enabled", "item", "hotkey"]

chrome.storage.sync.get(keys, (data) => {
    if (data.enabled === false) {
        enabled = false
    }
    if (data.item) {
        textToBlur = data.item
    }
    if (data.hotkey) {
        hotkey = data.hotkey
    }

    // Only start observing the DOM if the extension is enabled and there is text to blur.
    if (enabled && textToBlur.trim().length > 0) {
        observer.observe(document, {
            attributes: false,
            characterData: true,
            childList: true,
            subtree: true,
        })
        // Loop through all elements on the page for initial processing.
        processNode(document)
    }
})
