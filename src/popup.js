"use strict";

function setBadgeText(enabled) {
    const text = enabled ? "ON" : "OFF"
    void chrome.action.setBadgeText({text: text})
}

const checkbox = document.getElementById("enabled")
const statusText = document.getElementById("status-text")

function renderEnabledState(enabled) {
    checkbox.checked = enabled
    statusText.textContent = enabled ? "On" : "Off"
    statusText.classList.toggle("off", !enabled)
    void setBadgeText(enabled)
}

chrome.storage.sync.get("enabled", (data) => {
    renderEnabledState(data.enabled !== false)
})

checkbox.addEventListener("change", (event) => {
    if (event.target instanceof HTMLInputElement) {
        const enabled = event.target.checked
        void chrome.storage.sync.set({"enabled": enabled})
        renderEnabledState(enabled)
    }
})


const hotKeyInput = document.getElementById("hotkey")

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
    const key = event.key.length === 1
        ? event.key.toUpperCase() : event.key

    if (!["Control", "Shift", "Alt", "Meta"].includes(key)) {
        parts.push(key)
    }

    return parts.join("+")
}

chrome.storage.sync.get("hotkey", (data) => {
    hotKeyInput.value = data.hotkey || "Mod+Shift+K"
})

hotKeyInput.addEventListener("keydown", (event) => {
    event.preventDefault()
    const hotkey = eventToHotkey(event)
    if (hotkey) {
        hotKeyInput.value = hotkey
        void chrome.storage.sync.set({"hotkey": hotkey})
    }
})
