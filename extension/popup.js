// EazyApply Popup Script

const DASHBOARD_URL = "https://eazyapply-gsg6wxgfb-ajay-reddys-projects-f60ff2e1.vercel.app/dashboard";

const SUPPORTED_PLATFORMS = {
  "greenhouse.io":       "Greenhouse",
  "linkedin.com/jobs":   "LinkedIn",
  "lever.co":            "Lever",
  "myworkdayjobs.com":   "Workday",
  "wd1.myworkdayjobs":   "Workday",
  "wd3.myworkdayjobs":   "Workday",
  "wd5.myworkdayjobs":   "Workday",
};

function detectPlatformFromUrl(url) {
  for (const [key, name] of Object.entries(SUPPORTED_PLATFORMS)) {
    if (url.includes(key)) return name;
  }
  return null;
}

function calcCompletion(profile) {
  const total = Object.keys(profile).length;
  const filled = Object.entries(profile).filter(([_, v]) =>
    v !== "" && v !== false && v !== "Decline to self-identify"
  ).length;
  return Math.round((filled / total) * 100);
}

function showStatus(msg, type = "info") {
  const el = document.getElementById("status-msg");
  el.textContent = msg;
  el.className = `status-msg ${type}`;
}

function hideStatus() {
  const el = document.getElementById("status-msg");
  el.className = "status-msg";
}

async function init() {
  // Get current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url || "";
  const platform = detectPlatformFromUrl(url);

  // Update platform badge
  const badge = document.getElementById("platform-badge");
  const platformRow = document.getElementById("platform-row");
  const platformLabel = document.getElementById("platform-label");
  const notJobPage = document.getElementById("not-job-page");
  const btnFill = document.getElementById("btn-fill");

  if (platform) {
    badge.textContent = platform;
    badge.style.background = "#4ade8015";
    badge.style.color = "#4ade80";
    platformRow.style.display = "flex";
    platformLabel.textContent = `Active on ${platform}`;
    notJobPage.style.display = "none";
  } else {
    badge.textContent = "Not a job page";
    badge.style.background = "#71717a15";
    badge.style.color = "#71717a";
    notJobPage.style.display = "block";
    btnFill.disabled = true;
  }

  // Load profile
  chrome.runtime.sendMessage({ action: "GET_PROFILE" }, (res) => {
    const profile = res?.profile;

    if (!profile) {
      document.getElementById("no-profile").style.display = "block";
      document.getElementById("profile-info").style.display = "none";
      btnFill.disabled = true;
      showStatus("No profile found. Open dashboard to set up.", "error");
      return;
    }

    document.getElementById("no-profile").style.display = "none";
    document.getElementById("profile-info").style.display = "block";

    const name = [profile.firstName, profile.lastName].filter(Boolean).join(" ") || "Your Profile";
    const pct = calcCompletion(profile);

    document.getElementById("profile-name").textContent = name;
    document.getElementById("profile-pct").textContent = `${pct}%`;
    document.getElementById("progress-fill").style.width = `${pct}%`;

    if (platform) {
      btnFill.disabled = false;
    }
  });

  // Fill button click
  btnFill.addEventListener("click", () => {
    btnFill.disabled = true;
    btnFill.innerHTML = "<span>⏳</span> <span>Filling...</span>";
    hideStatus();

    chrome.tabs.sendMessage(tab.id, { action: "FILL_FORMS" }, (res) => {
      const count = res?.count ?? 0;

      if (count > 0) {
        btnFill.innerHTML = `<span>✓</span> <span>${count} field${count !== 1 ? "s" : ""} filled!</span>`;
        showStatus(`Successfully filled ${count} field${count !== 1 ? "s" : ""}.`, "success");
      } else {
        btnFill.innerHTML = "<span>⚠️</span> <span>No fields found</span>";
        showStatus("No fields could be filled. Page may not have loaded yet.", "error");
      }

      setTimeout(() => {
        btnFill.disabled = false;
        btnFill.innerHTML = "<span>⚡</span> <span>Fill This Page</span>";
      }, 3000);
    });
  });

  // Dashboard link
  document.getElementById("btn-dashboard").addEventListener("click", (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: DASHBOARD_URL });
    window.close();
  });
}

document.addEventListener("DOMContentLoaded", init);
