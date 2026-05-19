"use strict"

let hotkey = "Mod+Shift+K"
let pendingCorrection = null
let correctionPopup = null
let ignoredWords = []
let spellCheckReqId = 0
let backendErrorPopup = null

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

const CONTENT_EDITABLE_SELECTOR = [
    "[contenteditable='true']",
    "[contenteditable='plaintext-only']",
    "[g_editable='true'][contenteditable='true']",
    "[aria-label='Message Body'][contenteditable='true']",
    "[role='textbox'][contenteditable='true']"
].join(", ")

function getElementFromNode(node) {
    if (node instanceof HTMLElement) {
        return node
    }

    if (node instanceof Node) {
        return node.parentElement
    }

    return null
}

function getContentEditableElement(node) {
    const element = getElementFromNode(node)

    if (element === null) {
        return null
    }

    const editor = element.closest(CONTENT_EDITABLE_SELECTOR)

    if (!(editor instanceof HTMLElement)) {
        return null
    }

    return editor
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
        const selectedContentEditable = getContentEditableElement(selection.anchorNode)
        if (selectedContentEditable !== null) {
            return createContentEditableEditor(selectedContentEditable)
        }
    }

    return null
}

function dispatchReplacementInput(element, replacement) {
    try {
        element.dispatchEvent(new InputEvent("input", {
            bubbles: true,
            inputType: "insertReplacementText",
            data: replacement
        }))
    } catch (error) {
        element.dispatchEvent(new Event("input", {bubbles: true}))
    }
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
            dispatchReplacementInput(element, replacement)
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

function getContentEditableTextPosition(root, model, index) {
    for (const part of model.parts) {
        if (index >= part.start && index <= part.end) {
            return {node: part.node, offset: index - part.start}
        }
    }

    const last = model.parts[model.parts.length - 1]
    if (last) {
        return {node: last.node, offset: (last.node.nodeValue || "").length}
    }

    return {node: root, offset: 0}
}


function getContentEditableRange(root, model, start, end) {
    const startPos = getContentEditableTextPosition(root, model, start)
    const endPos = getContentEditableTextPosition(root, model, end)

    const range = document.createRange()
    range.setStart(startPos.node, startPos.offset)
    range.setEnd(endPos.node, endPos.offset)

    return range
}

function getContentEditableCursorIndex(root, model) {
    const selection = window.getSelection()

    if (!selection || selection.rangeCount === 0) {
        return 0
    }

    const range = selection.getRangeAt(0)

    if (range.startContainer !== root && !root.contains(range.startContainer)) {
        return 0
    }

    if (range.startContainer.nodeType === Node.TEXT_NODE) {
        for (const part of model.parts) {
            if (part.node === range.startContainer) {
                const offset = Math.min(range.startOffset, part.end - part.start)
                return part.start + offset
            }
        }
    }

    const beforeCursorRange = document.createRange()
    beforeCursorRange.selectNodeContents(root)
    beforeCursorRange.setEnd(range.startContainer, range.startOffset)

    return Math.min(beforeCursorRange.toString().length, model.text.length)
}


function createContentEditableEditor(root) {
    if (!root.hasAttribute("tabindex")) 
    {
        root.setAttribute("tabindex", "-1")
    }
    let cachedModel = null

    function getModel() {
        if (cachedModel === null) {
            cachedModel = buildContentEditableTextModel(root)
        }

        return cachedModel
    }

    return {
        root,

        getText() {
            return getModel().text
        },

        getCursorIndex() {
            return getContentEditableCursorIndex(root, getModel())
        },

        focus() {
            root.focus()
        },

        selectRange(start, end) {
            root.focus()
            const range = getContentEditableRange(root, getModel(), start, end)
            const selection = window.getSelection()
            selection.removeAllRanges()
            selection.addRange(range)
        },

        replaceRange(start, end, replacement) {
            const range = getContentEditableRange(root, getModel(), start, end)
            range.deleteContents()
            range.insertNode(document.createTextNode(replacement))
            root.normalize()
            cachedModel = null
            dispatchReplacementInput(root, replacement)
        },




        getTextPosition(index) {
            const range = getContentEditableRange(root, getModel(), index, index + 1)
            const rect = range.getClientRects()[0] || range.getBoundingClientRect()
            if (rect.width === 0 && rect.height === 0) {
                const rootRect = root.getBoundingClientRect()
                return {left: rootRect.left, top: rootRect.bottom}
            }

            return {left: rect.left, top: rect.bottom}
        }


    }
}

function normalizeIgnoredWord(word) {
    return word.trim().toLowerCase()
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
        body: JSON.stringify({sentence: sentence, cursor_position: cursorPosition, ignored_words: ignoredWords }),

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

function hideBackendError() {
    if (backendErrorPopup !== null) {
        backendErrorPopup.remove()
        backendErrorPopup = null
    }
}

function showBackendError(editor, cursorPosition, message) {
    hideBackendError()

    const popup = document.createElement("div")
    const position = editor.getTextPosition(cursorPosition)

    popup.textContent = message
    popup.style.position = "fixed"
    popup.style.left = `${position.left}px`
    popup.style.top = `${position.top + 8}px`
    popup.style.zIndex = "2147483647"
    popup.style.maxWidth = "320px"
    popup.style.background = "#111827"
    popup.style.color = "#ffffff"
    popup.style.padding = "10px 12px"
    popup.style.borderRadius = "8px"
    popup.style.boxShadow = "0 14px 32px rgba(0, 0, 0, 0.28)"
    popup.style.font = "13px system-ui, sans-serif"
    popup.style.lineHeight = "1.35"

    document.documentElement.appendChild(popup)
    backendErrorPopup = popup
}

function clearPendingCorrection() {
    pendingCorrection = null
    hideCorrectionPopup()
}

function saveIgnoredWord(word) {
    const normalizedWord = normalizeIgnoredWord(word)

    if (!normalizedWord) {
        return false
    }

    if (ignoredWords.includes(normalizedWord)) {
        return false
    }

    ignoredWords = [...ignoredWords, normalizedWord].sort()
    void chrome.storage.sync.set({"ignoredWords": ignoredWords})
    return true
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
    const isTransparent = (color) => {
        return !color || color === "transparent" || color === "rgba(0, 0, 0, 0)"
    }
    const bodyTheme = window.getComputedStyle(document.body)
    const background = isTransparent(theme.backgroundColor)
        ? (isTransparent(bodyTheme.backgroundColor) ? "#111827" : bodyTheme.backgroundColor)
        : theme.backgroundColor
    const textColor = isTransparent(theme.color) ? "#ffffff" : theme.color
    const position = item.editor.getTextPosition(item.start)

    popup.style.position = "fixed"
    popup.style.left = `${position.left}px`
    popup.style.top = `${position.top + 8}px`
    popup.style.zIndex = "2147483647"
    popup.style.minWidth = "260px"
    popup.style.maxWidth = "380px"
    popup.style.background = background
    popup.style.color = textColor
    popup.style.padding = "12px"
    popup.style.borderRadius = "10px"
    popup.style.boxShadow = "0 14px 32px rgba(0, 0, 0, 0.28)"
    popup.style.font = "13px system-ui, sans-serif"
    popup.style.lineHeight = "1.35"
    popup.style.pointerEvents = "auto"
    popup.style.border = `1px solid ${textColor}`
    popup.style.opacity = "0"
    popup.style.transform = "translateY(4px) scale(0.98)"
    popup.style.transition = "opacity 120ms ease, transform 120ms ease"

    const label = document.createElement("div")
    label.textContent = "Floh suggestion"
    label.style.fontSize = "11px"
    label.style.fontWeight = "700"
    label.style.letterSpacing = "0"
    label.style.marginBottom = "8px"
    label.style.opacity = "0.68"

    const correctionButton = document.createElement("button")
    correctionButton.type = "button"
    correctionButton.dataset.action = "accept"
    correctionButton.style.all = "unset"
    correctionButton.style.boxSizing = "border-box"
    correctionButton.style.display = "flex"
    correctionButton.style.alignItems = "center"
    correctionButton.style.gap = "8px"
    correctionButton.style.width = "100%"
    correctionButton.style.cursor = "pointer"
    correctionButton.style.fontWeight = "750"
    correctionButton.style.fontSize = "15px"

    const wrongWord = document.createElement("span")
    wrongWord.textContent = item.word
    wrongWord.style.textDecoration = "line-through"
    wrongWord.style.opacity = "0.72"

    const arrow = document.createElement("span")
    arrow.textContent = "->"
    arrow.style.opacity = "0.7"

    const correctedWord = document.createElement("span")
    correctedWord.textContent = item.correction

    correctionButton.appendChild(wrongWord)
    correctionButton.appendChild(arrow)
    correctionButton.appendChild(correctedWord)

    const actions = document.createElement("div")
    actions.style.display = "flex"
    actions.style.flexWrap = "wrap"
    actions.style.gap = "6px"
    actions.style.marginTop = "10px"

    function createActionButton(action, key, labelText) {
        const button = document.createElement("button")
        button.type = "button"
        button.dataset.action = action
        button.style.all = "unset"
        button.style.boxSizing = "border-box"
        button.style.display = "inline-flex"
        button.style.alignItems = "center"
        button.style.gap = "5px"
        button.style.border = `1px solid ${textColor}`
        button.style.borderRadius = "999px"
        button.style.padding = "5px 8px"
        button.style.cursor = "pointer"
        button.style.fontSize = "12px"
        button.style.fontWeight = "650"
        button.style.opacity = "0.82"

        const keyElement = document.createElement("span")
        keyElement.textContent = key
        keyElement.style.font = "700 11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"

        const textElement = document.createElement("span")
        textElement.textContent = labelText

        button.appendChild(keyElement)
        button.appendChild(textElement)
        return button
    }

    actions.appendChild(createActionButton("accept", "Enter", "Accept"))
    actions.appendChild(createActionButton("cancel", "Esc", "Cancel"))
    actions.appendChild(createActionButton("dictionary", "D", "Add word"))

    popup.appendChild(label)
    popup.appendChild(correctionButton)
    popup.appendChild(actions)

    popup.addEventListener("mousedown", (event) => {
        event.preventDefault()
    })

    popup.addEventListener("click", (event) => {
        const target = event.target
        if (!(target instanceof HTMLElement)) {
            return
        }
        const actionElement = target.closest("[data-action]")
        if (!(actionElement instanceof HTMLElement) || !popup.contains(actionElement)) {
            return
        }
        if (actionElement.dataset.action === "accept") {
            acceptCorrection()
        }
        if (actionElement.dataset.action === "cancel") {
            cancelCorrection()
        }

        if (actionElement.dataset.action === "dictionary") {
            void addCurrentWordToDictionary()
        }

    })
    document.documentElement.appendChild(popup)

    const popupRect = popup.getBoundingClientRect()
    const margin = 8
    let left = position.left
    let top = position.top + 8

    if (left + popupRect.width + margin > window.innerWidth) {
        left = Math.max(margin, window.innerWidth - popupRect.width - margin)
    }
    if (left < margin) {
        left = margin
    }
    if (top + popupRect.height + margin > window.innerHeight) {
        top = Math.max(margin, position.top - popupRect.height - 8)
    }

    popup.style.left = `${left}px`
    popup.style.top = `${top}px`

    requestAnimationFrame(() => {
        popup.style.opacity = "1"
        popup.style.transform = "translateY(0) scale(1)"
    })

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

    if (backendErrorPopup !== null && event.key === "Escape") {
        event.preventDefault()
        hideBackendError()
        return true
    }

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

    if (event.key.toLowerCase() === "d") {
        event.preventDefault()
        void addCurrentWordToDictionary()
        return true
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

async function addCurrentWordToDictionary() {
    if (pendingCorrection === null) {
        return false
    }

    const item = pendingCorrection
    saveIgnoredWord(item.word)

    const editor = item.editor
    const cursorPosition = Math.max(0, item.start - 1)
    const originalCursor = item.originalCursor

    clearPendingCorrection()

    await runSpellcheck(editor, cursorPosition, originalCursor, true)
    return true
}



// Enable the content script by default.
let enabled = true
const keys = ["enabled", "hotkey", "ignoredWords"]

async function runSpellcheck(editor, cursorPosition, originalCursor, isSkippingCurrent) {
    const reqId = ++spellCheckReqId
    hideBackendError()
    try {
        const sentence = editor.getText()
        const result = await checkSpelling(sentence, cursorPosition)
        if (reqId !== spellCheckReqId) {
            return false
        }

        if (
            result.word !== null &&
            result.correction !== null &&
            Number.isInteger(result.start) &&
            Number.isInteger(result.end)
        ) {
            const casedC = matchCasing(result.word, result.correction)

            pendingCorrection = {
                editor,
                word: result.word,
                correction: casedC,
                start: result.start,
                end: result.end,
                originalCursor: originalCursor,
            }

            editor.focus()
            editor.selectRange(result.start, result.end)
            showCorrectionPopup(pendingCorrection)
            return true
        }

        if (isSkippingCurrent) {
            editor.selectRange(originalCursor, originalCursor)
        }

        clearPendingCorrection()
        return false
    }
    catch (error) {
        if (reqId !== spellCheckReqId) {
            return false
        }
        console.error("Spellcheck error: ", error)
        if (isSkippingCurrent) {
            editor.selectRange(originalCursor, originalCursor)
        }
        clearPendingCorrection()
        showBackendError(editor, cursorPosition, "Unable to connect to Floh backend. Please try again later.")
        return false
    }
}

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
    const editor = getActiveEditor()

    if (editor === null) {
        return
    }

    event.preventDefault()
    
    const visibleCursor = editor.getCursorIndex()

    const previousCorrection = pendingCorrection
    const isSkippingCurrent = previousCorrection !== null && previousCorrection.editor.root === editor.root
    const cursorPosition = isSkippingCurrent ? Math.max(0, previousCorrection.start - 1) : visibleCursor
    const originalCursor = isSkippingCurrent ? previousCorrection.originalCursor : visibleCursor
    await runSpellcheck(editor, cursorPosition, originalCursor, isSkippingCurrent)

}, true)

chrome.storage.sync.get(keys, (data) => {
    if (data.enabled === false) {
        enabled = false
    }
    
    if (data.hotkey) {
        hotkey = data.hotkey
    }

    if (Array.isArray(data.ignoredWords)) {
        ignoredWords = data.ignoredWords
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

    if (changes.ignoredWords) {
        ignoredWords = Array.isArray(changes.ignoredWords.newValue) ? changes.ignoredWords.newValue : []
    }
})
