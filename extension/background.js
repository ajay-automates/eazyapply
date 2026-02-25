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

  if (message.action === "GET_RESUME") {
    chrome.storage.local.get("eazyapply_resume", (result) => {
      sendResponse({ resume: result.eazyapply_resume || null });
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

  // Broadcast FILL_FORMS to all subframes (iframes) in the active tab
  // Used so the ⚡ button in the main frame can reach Greenhouse's demographic iframe.
  if (message.action === "FILL_ALL_FRAMES") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id;
      if (!tabId) { sendResponse({ done: true }); return; }
      chrome.webNavigation.getAllFrames({ tabId }, (frames) => {
        if (!frames) { sendResponse({ done: true }); return; }
        const subframes = frames.filter(f => f.frameId !== 0);
        if (subframes.length === 0) { sendResponse({ done: true }); return; }
        let remaining = subframes.length;
        for (const frame of subframes) {
          chrome.tabs.sendMessage(
            tabId,
            { action: "FILL_FORMS" },
            { frameId: frame.frameId },
            () => { chrome.runtime.lastError; if (--remaining === 0) sendResponse({ done: true }); }
          );
        }
      });
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
