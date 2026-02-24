// EazyApply Content Script
// Detects job application pages and fills forms with saved profile data

(function () {
  "use strict";

  // ─── Utility: Set value on React/Angular/Vue-controlled inputs ───────────────
  function setNativeValue(el, value) {
    try {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
      const nativeTextAreaSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;

      if (el.tagName === "TEXTAREA" && nativeTextAreaSetter) {
        nativeTextAreaSetter.call(el, value);
      } else if (nativeInputValueSetter) {
        nativeInputValueSetter.call(el, value);
      } else {
        el.value = value;
      }

      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      el.dispatchEvent(new Event("blur", { bubbles: true }));
    } catch (e) {
      el.value = value;
    }
  }

  function setSelectValue(el, value) {
    if (!value) return false;
    const lower = value.toLowerCase();
    for (const option of el.options) {
      if (option.text.toLowerCase().includes(lower) || option.value.toLowerCase().includes(lower)) {
        el.value = option.value;
        el.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      }
    }
    return false;
  }

  // ─── Detect which ATS platform we're on ──────────────────────────────────────
  function detectPlatform() {
    const host = window.location.hostname;
    const path = window.location.pathname;
    if (host.includes("greenhouse.io")) return "greenhouse";
    if (host.includes("linkedin.com") && path.includes("/jobs")) return "linkedin";
    if (host.includes("lever.co")) return "lever";
    if (host.includes("myworkdayjobs.com") || host.includes("workday.com")) return "workday";
    return "generic";
  }

  // ─── Generic field finder ─────────────────────────────────────────────────────
  // Finds an input by checking name, id, placeholder, aria-label, and nearby label text
  function findField(keywords, type = "input") {
    const selectors = type === "textarea" ? "textarea" : "input, textarea";
    const elements = document.querySelectorAll(selectors);

    for (const el of elements) {
      if (el.type === "hidden" || el.type === "file" || el.type === "submit" || el.type === "button") continue;
      if (el.offsetParent === null) continue; // hidden

      const attrs = [
        el.name || "",
        el.id || "",
        el.placeholder || "",
        el.getAttribute("aria-label") || "",
        el.getAttribute("data-field-path") || "",
        el.getAttribute("data-automation-id") || "",
        el.getAttribute("autocomplete") || "",
      ].join(" ").toLowerCase();

      // Check nearby label
      let labelText = "";
      if (el.id) {
        const label = document.querySelector(`label[for="${el.id}"]`);
        if (label) labelText = label.textContent.toLowerCase();
      }
      if (!labelText) {
        const parent = el.closest("label, .field, .form-group, .input-group, [class*='field'], [class*='form']");
        if (parent) labelText = parent.textContent.toLowerCase().slice(0, 100);
      }

      const allText = attrs + " " + labelText;

      for (const kw of keywords) {
        if (allText.includes(kw.toLowerCase())) return el;
      }
    }
    return null;
  }

  function findSelect(keywords) {
    const elements = document.querySelectorAll("select");
    for (const el of elements) {
      if (el.offsetParent === null) continue;
      const attrs = [el.name || "", el.id || "", el.getAttribute("aria-label") || ""].join(" ").toLowerCase();
      let labelText = "";
      if (el.id) {
        const label = document.querySelector(`label[for="${el.id}"]`);
        if (label) labelText = label.textContent.toLowerCase();
      }
      const allText = attrs + " " + labelText;
      for (const kw of keywords) {
        if (allText.includes(kw.toLowerCase())) return el;
      }
    }
    return null;
  }

  // ─── Fill logic ───────────────────────────────────────────────────────────────
  function fillField(keywords, value, type = "input") {
    if (!value && value !== false) return false;
    const el = findField(keywords, type);
    if (!el) return false;
    if (el.tagName === "SELECT") {
      return setSelectValue(el, String(value));
    }
    if (el.type === "checkbox") {
      if (el.checked !== Boolean(value)) {
        el.click();
      }
      return true;
    }
    setNativeValue(el, String(value));
    return true;
  }

  function fillSelect(keywords, value) {
    if (!value) return false;
    const el = findSelect(keywords);
    if (!el) return false;
    return setSelectValue(el, String(value));
  }

  // ─── Platform-specific fill strategies ───────────────────────────────────────

  function fillGreenhouse(p) {
    let count = 0;

    const fields = [
      { kw: ["first_name", "first-name", "firstname", "first name"], val: p.firstName },
      { kw: ["last_name", "last-name", "lastname", "last name"], val: p.lastName },
      { kw: ["email", "e-mail"], val: p.email },
      { kw: ["phone", "telephone", "mobile"], val: p.phone },
      { kw: ["linkedin", "linked_in"], val: p.linkedinUrl },
      { kw: ["github"], val: p.githubUrl },
      { kw: ["portfolio", "personal site", "website"], val: p.portfolioUrl || p.websiteUrl },
      { kw: ["twitter"], val: p.twitterUrl },
      { kw: ["city", "location"], val: p.city },
      { kw: ["address", "street"], val: p.address },
      { kw: ["university", "school", "college", "education"], val: p.university },
      { kw: ["degree"], val: p.degree },
      { kw: ["gpa", "grade"], val: p.gpa },
      { kw: ["graduation", "grad year", "class year"], val: p.gradYear },
      { kw: ["current title", "job title", "position", "role"], val: p.currentTitle },
      { kw: ["current company", "employer", "company"], val: p.currentCompany },
      { kw: ["salary", "compensation", "desired salary"], val: p.desiredSalary },
      { kw: ["years of experience", "years experience", "experience"], val: p.yearsExperience },
    ];

    for (const { kw, val } of fields) {
      if (fillField(kw, val)) count++;
    }

    // Work authorization radio/checkbox
    if (p.workAuthorized !== undefined) {
      const authEl = findField(["authorized to work", "work authorization", "legally authorized"]);
      if (authEl && authEl.type === "radio") {
        const radios = document.querySelectorAll(`input[name="${authEl.name}"]`);
        for (const r of radios) {
          const label = document.querySelector(`label[for="${r.id}"]`);
          if (label) {
            const isYes = label.textContent.toLowerCase().includes("yes");
            if ((p.workAuthorized && isYes) || (!p.workAuthorized && !isYes)) {
              r.click();
              count++;
              break;
            }
          }
        }
      }
    }

    return count;
  }

  function fillLinkedIn(p) {
    let count = 0;

    const fields = [
      { kw: ["first-name", "firstName", "first name", "given-name"], val: p.firstName },
      { kw: ["last-name", "lastName", "last name", "family-name"], val: p.lastName },
      { kw: ["email", "email-address"], val: p.email },
      { kw: ["phone", "phoneNumber", "mobile"], val: p.phone },
      { kw: ["city", "location", "address"], val: p.city },
      { kw: ["linkedin"], val: p.linkedinUrl },
      { kw: ["website", "portfolio"], val: p.portfolioUrl || p.websiteUrl },
      { kw: ["title", "headline", "current role"], val: p.currentTitle },
      { kw: ["company", "employer"], val: p.currentCompany },
      { kw: ["years of experience", "experience"], val: p.yearsExperience },
      { kw: ["salary", "compensation"], val: p.desiredSalary },
      { kw: ["school", "university", "college"], val: p.university },
      { kw: ["degree"], val: p.degree },
    ];

    for (const { kw, val } of fields) {
      if (fillField(kw, val)) count++;
    }

    // Handle LinkedIn's radio buttons for Yes/No questions
    const yesNoMap = [
      { kw: ["authorized", "legally authorized", "work in the"], answer: p.workAuthorized ? "Yes" : "No" },
      { kw: ["sponsorship", "visa sponsor", "require sponsor"], answer: p.requiresSponsorship ? "Yes" : "No" },
      { kw: ["relocat"], answer: p.willingToRelocate ? "Yes" : "No" },
    ];

    for (const { kw, answer } of yesNoMap) {
      const radios = document.querySelectorAll('input[type="radio"]');
      for (const r of radios) {
        const label = document.querySelector(`label[for="${r.id}"]`);
        const container = r.closest('[class*="question"], [class*="field"], fieldset');
        const questionText = container?.textContent?.toLowerCase() || "";
        if (kw.some((k) => questionText.includes(k))) {
          const labelText = label?.textContent?.trim().toLowerCase();
          if (labelText === answer.toLowerCase()) {
            r.click();
            count++;
          }
        }
      }
    }

    return count;
  }

  function fillLever(p) {
    let count = 0;

    // Lever uses name="name" for full name
    const nameEl = document.querySelector('input[name="name"]');
    if (nameEl && p.firstName) {
      const fullName = [p.firstName, p.lastName].filter(Boolean).join(" ");
      setNativeValue(nameEl, fullName);
      count++;
    }

    const fields = [
      { kw: ["email", "e-mail"], val: p.email },
      { kw: ["phone", "telephone"], val: p.phone },
      { kw: ["org", "company", "current employer", "organization"], val: p.currentCompany },
      { kw: ["title", "current role", "position"], val: p.currentTitle },
      { kw: ["urls[LinkedIn]", "linkedin"], val: p.linkedinUrl },
      { kw: ["urls[GitHub]", "github"], val: p.githubUrl },
      { kw: ["urls[Portfolio]", "portfolio", "website"], val: p.portfolioUrl || p.websiteUrl },
      { kw: ["urls[Twitter]", "twitter"], val: p.twitterUrl },
      { kw: ["summary", "cover", "about yourself", "about you"], val: p.elevatorPitch, type: "textarea" },
    ];

    for (const { kw, val, type } of fields) {
      if (fillField(kw, val, type || "input")) count++;
    }

    return count;
  }

  function fillWorkday(p) {
    let count = 0;

    // Workday uses data-automation-id attributes
    const automationMap = [
      { id: ["legalName--firstName", "firstName", "given-name"], val: p.firstName },
      { id: ["legalName--lastName", "lastName", "family-name"], val: p.lastName },
      { id: ["email", "emailAddress", "email-address"], val: p.email },
      { id: ["phone", "phoneNumber", "deviceText"], val: p.phone },
      { id: ["addressSection--city", "city"], val: p.city },
      { id: ["addressSection--state", "state"], val: p.state },
      { id: ["addressSection--postalCode", "zipCode", "postalCode"], val: p.zipCode },
      { id: ["linkedIn", "linkedin"], val: p.linkedinUrl },
      { id: ["howDidYouHear", "referral", "hear about"], val: p.howDidYouHear },
    ];

    for (const { id: ids, val } of automationMap) {
      for (const id of ids) {
        const el = document.querySelector(`[data-automation-id*="${id}"] input, [data-automation-id="${id}"]`);
        if (el && val) {
          setNativeValue(el, val);
          count++;
          break;
        }
      }
    }

    // Fallback to generic for Workday
    count += fillGeneric(p);

    return count;
  }

  function fillGeneric(p) {
    let count = 0;

    const mappings = [
      { kw: ["first name", "first-name", "firstname", "given name", "fname"], val: p.firstName },
      { kw: ["last name", "last-name", "lastname", "surname", "family name", "lname"], val: p.lastName },
      { kw: ["email", "e-mail", "email address"], val: p.email },
      { kw: ["phone", "telephone", "mobile", "cell"], val: p.phone },
      { kw: ["linkedin"], val: p.linkedinUrl },
      { kw: ["github"], val: p.githubUrl },
      { kw: ["portfolio", "personal site"], val: p.portfolioUrl || p.websiteUrl },
      { kw: ["city", "town"], val: p.city },
      { kw: ["state", "province", "region"], val: p.state },
      { kw: ["zip", "postal", "postcode"], val: p.zipCode },
      { kw: ["country"], val: p.country },
      { kw: ["address", "street"], val: p.address },
      { kw: ["university", "school", "college", "institution"], val: p.university },
      { kw: ["degree", "qualification"], val: p.degree },
      { kw: ["major", "field of study", "discipline"], val: p.major },
      { kw: ["gpa", "grade point"], val: p.gpa },
      { kw: ["graduation", "grad year", "class of"], val: p.gradYear },
      { kw: ["current title", "job title", "position", "role", "title"], val: p.currentTitle },
      { kw: ["company", "employer", "organization", "current employer"], val: p.currentCompany },
      { kw: ["years of experience", "years experience", "experience"], val: p.yearsExperience },
      { kw: ["salary", "compensation", "expected salary", "desired salary"], val: p.desiredSalary },
      { kw: ["cover letter"], val: p.coverLetterTemplate, type: "textarea" },
      { kw: ["summary", "about yourself", "tell us about", "elevator pitch"], val: p.elevatorPitch, type: "textarea" },
      { kw: ["skills", "technical skills"], val: p.technicalSkills, type: "textarea" },
    ];

    for (const { kw, val, type } of mappings) {
      if (fillField(kw, val, type || "input")) count++;
    }

    return count;
  }

  // ─── Main fill function ───────────────────────────────────────────────────────
  function fillForms(profile) {
    const platform = detectPlatform();
    let count = 0;

    switch (platform) {
      case "greenhouse": count = fillGreenhouse(profile); break;
      case "linkedin":   count = fillLinkedIn(profile);   break;
      case "lever":      count = fillLever(profile);      break;
      case "workday":    count = fillWorkday(profile);    break;
      default:           count = fillGeneric(profile);    break;
    }

    showToast(count);
    return count;
  }

  // ─── Toast notification ───────────────────────────────────────────────────────
  function showToast(count) {
    const existing = document.getElementById("eazyapply-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.id = "eazyapply-toast";
    toast.style.cssText = `
      position: fixed;
      bottom: 80px;
      right: 20px;
      z-index: 2147483647;
      background: #18181b;
      color: #4ade80;
      border: 1px solid #4ade8033;
      border-radius: 10px;
      padding: 10px 16px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 13px;
      font-weight: 600;
      box-shadow: 0 4px 24px rgba(0,0,0,0.4);
      display: flex;
      align-items: center;
      gap: 8px;
      animation: eazyapply-slide-in 0.3s ease;
    `;

    const style = document.createElement("style");
    style.textContent = `
      @keyframes eazyapply-slide-in {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);

    if (count > 0) {
      toast.innerHTML = `<span>⚡</span> <span>${count} field${count !== 1 ? "s" : ""} filled by EazyApply</span>`;
    } else {
      toast.style.color = "#f87171";
      toast.innerHTML = `<span>⚠️</span> <span>No fields found. Check your profile is saved.</span>`;
    }

    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }

  // ─── Floating ⚡ button ────────────────────────────────────────────────────────
  function injectButton(profile) {
    if (document.getElementById("eazyapply-fab")) return;

    const btn = document.createElement("button");
    btn.id = "eazyapply-fab";
    btn.title = "EazyApply — Auto-fill this form";
    btn.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 2147483647;
      width: 50px;
      height: 50px;
      border-radius: 50%;
      background: #4ade80;
      color: #000;
      border: none;
      cursor: pointer;
      font-size: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 20px rgba(74, 222, 128, 0.4);
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    `;
    btn.textContent = "⚡";

    btn.addEventListener("mouseenter", () => {
      btn.style.transform = "scale(1.1)";
      btn.style.boxShadow = "0 6px 28px rgba(74, 222, 128, 0.6)";
    });
    btn.addEventListener("mouseleave", () => {
      btn.style.transform = "scale(1)";
      btn.style.boxShadow = "0 4px 20px rgba(74, 222, 128, 0.4)";
    });

    btn.addEventListener("click", () => {
      btn.textContent = "⏳";
      btn.style.background = "#fbbf24";

      chrome.runtime.sendMessage({ action: "GET_PROFILE" }, (res) => {
        const p = res?.profile || profile;
        if (!p) {
          showToast(0);
          btn.textContent = "⚡";
          btn.style.background = "#4ade80";
          return;
        }
        const count = fillForms(p);
        btn.textContent = count > 0 ? "✓" : "⚠️";
        btn.style.background = count > 0 ? "#4ade80" : "#f87171";
        setTimeout(() => {
          btn.textContent = "⚡";
          btn.style.background = "#4ade80";
        }, 2500);
      });
    });

    document.body.appendChild(btn);
  }

  // ─── Listen for messages from popup/background ────────────────────────────────
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "FILL_FORMS") {
      chrome.runtime.sendMessage({ action: "GET_PROFILE" }, (res) => {
        if (res?.profile) {
          const count = fillForms(res.profile);
          sendResponse({ count });
        } else {
          showToast(0);
          sendResponse({ count: 0 });
        }
      });
      return true;
    }
  });

  // ─── Init ─────────────────────────────────────────────────────────────────────
  function init() {
    chrome.runtime.sendMessage({ action: "GET_PROFILE" }, (res) => {
      if (res?.profile) {
        injectButton(res.profile);
      } else {
        // Still inject button — user might not have saved profile yet
        injectButton(null);
      }
    });
  }

  // Wait for page to be fully interactive
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Re-inject button on SPA navigation (LinkedIn, Workday are SPAs)
  let lastUrl = location.href;
  new MutationObserver(() => {
    const currentUrl = location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      setTimeout(init, 1500); // Wait for new page content to load
    }
  }).observe(document, { subtree: true, childList: true });
})();
