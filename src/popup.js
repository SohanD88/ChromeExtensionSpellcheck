"use strict";

console.log("Hello, world from popup!")

function setBadgeText(enabled) {
    const text = enabled ? "ON" : "OFF"
    void chrome.action.setBadgeText({text: text})
}

// Handle the ON/OFF switch
const checkbox = document.getElementById("enabled")
chrome.storage.sync.get("enabled", (data) => {
    checkbox.checked = !!data.enabled
    void setBadgeText(data.enabled)
})
checkbox.addEventListener("change", (event) => {
    if (event.target instanceof HTMLInputElement) {
        void chrome.storage.sync.set({"enabled": event.target.checked})
        void setBadgeText(event.target.checked)
    }
})

// Handle the input field
const input = document.getElementById("item")
chrome.storage.sync.get("item", (data) => {
    input.value = data.item || ""
});
input.addEventListener("change", (event) => {
    if (event.target instanceof HTMLInputElement) {
        void chrome.storage.sync.set({"item": event.target.value})
    }
})

const hotKeyInput = document.getElementById("hotkey")
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

chrome.storage.sync.get("hotkey", (data) => {
    hotKeyInput.value = data.hotkey || "Ctrl+Shift+K"
})

hotKeyInput.addEventListener("keydown", (event) => {
    event.preventDefault()
    const hotkey = eventToHotkey(event)
    if (hotkey) {
        hotKeyInput.value = hotkey
        void chrome.storage.sync.set({"hotkey": hotkey})
    }
})

