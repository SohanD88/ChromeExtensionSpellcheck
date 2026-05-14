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

function getContentEditableElement(element) {
    if (!(element instanceof HTMLElement)) {
        return null
    }
    return element.closest("[contenteditable='true'], [role='textbox'][contenteditable='true']")

}

function getActiveEditor() {
    const activeElement = document.activeElement

    if (isTextElement(activeElement)) {
        return createInputEditor(activeElement)
    }

    const activeContentEditable = getContentEditableElement(activeElement)
    if (activeContentEditable !== null) {
        return createContentEditableEditor(activeContentEditable)
    }

    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
        const node = selection.anchorNode
        const element = node instanceof HTMLElement
            ? node
            : node?.parentElement

        const selectedContentEditable = getContentEditableElement(element)
        if (selectedContentEditable !== null) {
            return createContentEditableEditor(selectedContentEditable)
        }
    }

    return null
}


function createInputEditor(element) {
    return {
        root: element,
        getText() {
            return element.value
        },
        getCursorIndex() {
            return element.selectionStart ?? 0
        },

        focus() {
            element.focus()
        },
        selectRange(start, end) {
            element.focus()
            element.setSelectionRange(start, end)
        },

        replaceRange(start, end, replacement) {
            const prev = element.value.slice(0, start)
            const post = element.value.slice(end)
            element.value = prev + replacement + post
        },

        getTextPosition(index)
        {
            return getInputTextPosition(element, index)
        }
    }
}

function buildContentEditableTextModel(element) {
    const parts = []
    let text = ""
    const blockElements = new Set(["DIV", "P", "BR"])

    function appendTextNode(node) {
        const val = node.nodeValue || ""
        const start = text.length
        text += val
        const end = text.length
        parts.push({node, start, end})
    }

    function appendLine()
    {
        if (text.length > 0 && !text.endsWith("\n")) {
            text += "\n"
        }
    }

    function walk(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            appendTextNode(node)
            return
        }

        if (!(node instanceof HTMLElement)) {
            return
        }

        if (node.tagName === "BR") {
            text += "\n"
            return
        }

        for (const child of node.childNodes) {
            walk(child)
        }
        
        if (node !== element && blockElements.has(node.tagName)) {
            appendLine()
        }
    }
    walk(element)
    return {text, parts}
}

function getContentEditableTextPosition(root, index) 
    {
        const model = buildContentEditableTextModel(root)
        for (const part of model.parts) {
            if (index >= part.start && index <= part.end) {
                return {node: part.node, offset: index - part.start}
            }
        }

        const last = model.parts[model.parts.length - 1]
        if (last)
        {
            return {node: last.node, offset: (last.node.nodeValue || "").length}
        }
        
        return {node: root, offset: 0}
    }

function getContentEditableRange(root, start, end) 
{
    const startPos = getContentEditableTextPosition(root, start)
    const endPos = getContentEditableTextPosition(root, end)
    const range = document.createRange()
    range.setStart(startPos.node, startPos.offset)
    range.setEnd(endPos.node, endPos.offset)
    return range
}

function createContentEditableEditor(root) {
    if (!root.hasAttribute("tabindex")) 
    {
        root.setAttribute("tabindex", "-1")
    }
    return {
        root,

        getText() {
            return buildContentEditableTextModel(root).text
        },

        getCursorIndex() {
            const selection = window.getSelection()
            if (!selection || selection.rangeCount === 0) {
                return 0
            }

            const range = selection.getRangeAt(0)
            if (!root.contains(range.startContainer)) {
                return 0
            }

            const beforeCursorRange = document.createRange()
            beforeCursorRange.selectNodeContents(root)
            beforeCursorRange.setEnd(range.startContainer, range.startOffset)

            return beforeCursorRange.toString().length
        },


        focus() {
            root.focus()
        },

        selectRange(start, end) {
            root.focus()
            const range = getContentEditableRange(root, start, end)
            const selection = window.getSelection()
            selection.removeAllRanges()
            selection.addRange(range)
        },

        replaceRange(start, end, replacement) {
            const range = getContentEditableRange(root, start, end)
            range.deleteContents()
            range.insertNode(document.createTextNode(replacement))
            root.normalize()
        },


        getTextPosition(index) {
            const range = getContentEditableRange(root, index, index + 1)
            const rect = range.getBoundingClientRect()

            if (rect.width === 0 && rect.height === 0) {
                const rootRect = root.getBoundingClientRect()
                return {left: rootRect.left, top: rootRect.bottom}
            }

            return {left: rect.left, top: rect.bottom}
        }


    }
}


function matchCasing(original, correction) {
    if (!correction) {
        return correction
    }
    if (original === original.toUpperCase()) {
        return correction.toUpperCase()
    }
    const firstLetter = original.charAt(0)
    const rest = original.slice(1)
    const isCapital = firstLetter === firstLetter.toUpperCase() && rest === rest.toLowerCase()
    if (isCapital) {
        return correction.charAt(0).toUpperCase() + correction.slice(1).toLowerCase()
    }
    return correction
}

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

function clearPendingCorrection() {
    pendingCorrection = null
    hideCorrectionPopup()
}

function getInputTextPosition(element, index) {
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
        const popup = document.createElement("div")
        const theme = window.getComputedStyle(item.editor.root)
        popup.style.position = "fixed"
        const position = item.editor.getTextPosition(item.start)
        popup.style.left = `${position.left}px`
        popup.style.top = `${position.top + 8}px`
        popup.style.zIndex = "2147483647"
        popup.style.background = theme.backgroundColor
        popup.style.color = theme.color
        popup.style.padding = "10px 12px"
        popup.style.borderRadius = "8px"
        popup.style.boxShadow = "0 2px 10px rgba(0,0,0,0.25)"
        popup.style.font = "13px system-ui, sans-serif"
        popup.style.lineHeight = "1.35"
        popup.style.maxWidth = "360px"
        popup.style.pointerEvents = "auto"
        popup.style.border = `1px solid ${theme.color}`
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

    item.editor.replaceRange(item.start, item.end, item.correction)

    let newCursorPos = item.originalCursor
    if (item.originalCursor > item.end) {
        newCursorPos += item.correction.length - item.word.length
    }

    item.editor.focus()
    item.editor.selectRange(newCursorPos, newCursorPos)

    console.log("Accepted correction: ", {
        word: item.word,
        correction: item.correction
    })

    pendingCorrection = null
    hideCorrectionPopup()
    return true
}


function cancelCorrection() {
    if (pendingCorrection === null) {
        return false
    }
    const item = pendingCorrection
    item.editor.focus()
    item.editor.selectRange(item.originalCursor, item.originalCursor)

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

    const modifierKeys = ["Control", "Meta", "Alt", "Shift"]
    if (modifierKeys.includes(event.key)) {
        return false
    }

    if (eventToHotkey(event) === hotkey) {
        return false
    }

    clearPendingCorrection()
    return false

}


// Enable the content script by default.
let enabled = true
const keys = ["enabled", "hotkey"]
document.addEventListener("keydown", async (event) => {
    console.log("Floh keydown:", {
        key: event.key,
        hotkeyPressed: eventToHotkey(event),
        expectedHotkey: hotkey,
        enabled: enabled
    })

    if (handleCorrection(event)) {
        return
    }

    if (!enabled) {
        return
    }
    if (eventToHotkey(event) !== hotkey) {
        return
    }
    const editor = getActiveEditor()
    console.log("Floh editor:", editor)

    if (editor === null) {
        return
    }

    event.preventDefault()
    
    const sentence = editor.getText()
    const visibleCursor = editor.getCursorIndex()

    const previousCorrection = pendingCorrection
    const isSkippingCurrent = previousCorrection !== null && previousCorrection.editor.root === editor.root
    const cursorPosition = isSkippingCurrent ? Math.max(0, previousCorrection.start - 1) : visibleCursor
    const originalCursor = isSkippingCurrent ? previousCorrection.originalCursor : visibleCursor


    try
    {
        const result = await checkSpelling(sentence, cursorPosition)
        console.log("Spellcheck result:", result)

        if (result.word !== null && result.correction !== null && Number.isInteger(result.start) && Number.isInteger(result.end)) 
        {
            const casedC = matchCasing(result.word, result.correction)
            pendingCorrection = {editor, word: result.word, correction: casedC, start: result.start, end: result.end, originalCursor: originalCursor,}
            editor.focus()
            editor.selectRange(result.start, result.end)

            showCorrectionPopup(pendingCorrection)
        }
        else {
            if (isSkippingCurrent) {
                editor.selectRange(originalCursor, originalCursor)
            }
            clearPendingCorrection()
        }
    
    }
    catch (error)
    {
        console.error("Spellcheck backend error: ", error)
    }
}, true)




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

