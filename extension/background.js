// EazyApply Background Service Worker
// Receives profile sync from the dashboard website and stores it locally

// Listen for messages from the dashboard website (externally_connectable)
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (message.action === "SYNC_PROFILE") {
    chrome.storage.local.set({ eazyapply_profile: message.profile }, () => {
      console.log("[EazyApply] Profile synced from dashboard:", Object.keys(message.profile).length, "fields");
      sendResponse({ success: true });
    });
    return true; // keep channel open for async response
  }

  if (message.action === "GET_PROFILE") {
    chrome.storage.local.get("eazyapply_profile", (result) => {
      sendResponse({ profile: result.eazyapply_profile || null });
    });
    return true;
  }
});

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "GET_PROFILE") {
    chrome.storage.local.get("eazyapply_profile", (result) => {
      sendResponse({ profile: result.eazyapply_profile || null });
    });
    return true;
  }

  if (message.action === "FILL_PAGE") {
    // Triggered from popup — inject fill into active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "FILL_FORMS" }, (res) => {
          sendResponse(res);
        });
      }
    });
    return true;
  }
});
