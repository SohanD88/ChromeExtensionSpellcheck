"use strict";

console.log("Hello, world from popup!")

function setBadgeText(enabled) {
    const text = enabled ? "ON" : "OFF"
    void chrome.action.setBadgeText({text: text})
}

// Handle the ON/OFF switch
const checkbox = document.getElementById("enabled")
chrome.storage.sync.get("enabled", (data) => {
    checkbox.checked = data.enabled != false
    void setBadgeText(checkbox.checked)
})
checkbox.addEventListener("change", (event) => {
    if (event.target instanceof HTMLInputElement) {
        void chrome.storage.sync.set({"enabled": event.target.checked})
        void setBadgeText(event.target.checked)
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

