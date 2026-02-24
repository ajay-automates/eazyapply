// EazyApply Background Service Worker

const API_BASE = "https://eazyapply-app.vercel.app";

// ── External messages from dashboard website ──────────────────────────────────
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (message.action === "SYNC_PROFILE") {
    chrome.storage.local.set({ eazyapply_profile: message.profile }, () => {
      console.log("[EazyApply] Profile synced from dashboard:", Object.keys(message.profile).length, "fields");
      sendResponse({ success: true });
    });
    return true;
  }
  if (message.action === "GET_PROFILE") {
    chrome.storage.local.get("eazyapply_profile", (result) => {
      sendResponse({ profile: result.eazyapply_profile || null });
    });
    return true;
  }
});

// ── Internal messages from popup / content scripts ────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "GET_PROFILE") {
    chrome.storage.local.get("eazyapply_profile", (result) => {
      sendResponse({ profile: result.eazyapply_profile || null });
    });
    return true;
  }

  if (message.action === "FILL_PAGE") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "FILL_FORMS" }, (res) => {
          sendResponse(res);
        });
      }
    });
    return true;
  }

  // AI-powered custom question answering
  if (message.action === "ANSWER_QUESTIONS") {
    const { questions, profile } = message;
    fetch(`${API_BASE}/api/answer-question`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questions, profile }),
    })
      .then((r) => r.json())
      .then((data) => sendResponse({ answers: data.answers || [] }))
      .catch((e) => {
        console.error("[EazyApply] AI answer error:", e);
        sendResponse({ answers: [] });
      });
    return true; // async
  }
});
