// EazyApply Dashboard Sync
// Runs on the dashboard page — automatically syncs profile from
// localStorage to chrome.storage.local whenever the user saves.

(function () {
  function syncToExtension(raw) {
    try {
      const profile = JSON.parse(raw);
      chrome.storage.local.set({ eazyapply_profile: profile }, () => {
        console.log("[EazyApply] Profile synced to extension ✓", Object.keys(profile).length, "fields");
      });
    } catch (e) {}
  }

  // Sync immediately on page load (if profile already exists)
  const existing = localStorage.getItem("eazyapply_profile");
  if (existing) syncToExtension(existing);

  // Intercept localStorage.setItem to catch every future save
  const _setItem = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function (key, value) {
    _setItem(key, value);
    if (key === "eazyapply_profile") {
      syncToExtension(value);
    }
  };

  console.log("[EazyApply] Dashboard sync active");
})();
