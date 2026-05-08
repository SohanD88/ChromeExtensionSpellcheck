"use strict"

function setbadgeText(enabled) {
    const text = enabled ? "ON" : "OFF"
    void chrome.action.setBadgeText({text: text})
}

function startUp(){
    chrome.storage.sync.get("enabled", (data) => {
        setbadgeText(!!data.enabled)
    })
}

chrome.runtime.onStartup.addListener(startUp)
chrome.runtime.onInstalled.addListener(startUp)
