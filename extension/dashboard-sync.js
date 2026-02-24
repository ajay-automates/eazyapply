// EazyApply Dashboard Sync
// Runs on the dashboard page — automatically syncs profile AND resume from
// localStorage to chrome.storage.local whenever the user saves.

(function () {
  function syncProfileToExtension(raw) {
    try {
      const profile = JSON.parse(raw);
      chrome.storage.local.set({ eazyapply_profile: profile }, () => {
        console.log("[EazyApply] Profile synced to extension ✓", Object.keys(profile).length, "fields");
      });
    } catch (e) {}
  }

  function syncResumeToExtension(raw) {
    try {
      const resumeData = JSON.parse(raw);
      chrome.storage.local.set({ eazyapply_resume: resumeData }, () => {
        console.log("[EazyApply] Resume synced to extension ✓", resumeData.name);
      });
    } catch (e) {}
  }

  // Sync immediately on page load (if data already exists)
  const existingProfile = localStorage.getItem("eazyapply_profile");
  if (existingProfile) syncProfileToExtension(existingProfile);

  const existingResume = localStorage.getItem("eazyapply_resume");
  if (existingResume) syncResumeToExtension(existingResume);

  // Intercept localStorage.setItem to catch every future save
  const _setItem = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function (key, value) {
    _setItem(key, value);
    if (key === "eazyapply_profile") syncProfileToExtension(value);
    if (key === "eazyapply_resume")  syncResumeToExtension(value);
  };

  console.log("[EazyApply] Dashboard sync active");
})();
