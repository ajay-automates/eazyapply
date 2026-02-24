// EazyApply Content Script — Maximum Coverage Form Filler
(function () {
  "use strict";

  // ─── React/Angular-safe value setter ─────────────────────────────────────────
  function setNativeValue(el, value) {
    if (!el || value === null || value === undefined) return;
    try {
      const isTextArea = el.tagName === "TEXTAREA";
      const proto = isTextArea ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
      if (setter) setter.call(el, String(value));
      else el.value = String(value);
    } catch (e) { el.value = String(value); }
    el.dispatchEvent(new Event("focus",  { bubbles: true }));
    el.dispatchEvent(new Event("input",  { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur",   { bubbles: true }));
    el.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
  }

  // ─── Smart select filler ──────────────────────────────────────────────────────
  function selectBestOption(el, desiredValue) {
    if (!el || !desiredValue) return false;
    const val = String(desiredValue).toLowerCase().trim();
    const options = Array.from(el.options).filter(o => o.value !== "" && o.value !== "0" && o.index !== 0);
    if (!options.length) return false;

    const isDecline = ["decline", "prefer not", "don't wish", "no answer"].some(p => val.includes(p));
    const isYes = val === "true" || val === "yes";
    const isNo  = val === "false" || val === "no";

    for (const o of options) if (o.value.toLowerCase() === val) return applyOption(el, o);
    for (const o of options) if (o.text.toLowerCase().trim() === val) return applyOption(el, o);
    for (const o of options) if (o.text.toLowerCase().includes(val)) return applyOption(el, o);
    for (const o of options) if (val.includes(o.text.toLowerCase().trim()) && o.text.length > 3) return applyOption(el, o);

    if (isDecline) {
      const patterns = ["don't wish", "do not wish", "prefer not", "decline", "no answer",
        "not to answer", "not wish", "rather not", "no response", "not applicable",
        "not disclose", "choose not", "i don't", "not to self", "no, i prefer"];
      for (const o of options) if (patterns.some(p => o.text.toLowerCase().includes(p))) return applyOption(el, o);
      return applyOption(el, options[options.length - 1]);
    }
    if (isYes) { const o = options.find(o => /^yes/i.test(o.text) || o.value.toLowerCase() === "yes"); if (o) return applyOption(el, o); }
    if (isNo)  { const o = options.find(o => /^no\b/i.test(o.text) || o.value.toLowerCase() === "no");  if (o) return applyOption(el, o); }
    return false;
  }

  function applyOption(el, option) {
    el.value = option.value;
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("input",  { bubbles: true }));
    return true;
  }

  // ─── Get full context text for an element ─────────────────────────────────────
  function getElementContext(el) {
    const direct = [
      el.name, el.id, el.placeholder,
      el.getAttribute("aria-label"),
      el.getAttribute("data-automation-id"),
      el.getAttribute("data-field-path"),
      el.getAttribute("autocomplete"),
      el.getAttribute("data-qa"),
      el.title,
    ].filter(Boolean).join(" ").toLowerCase();

    let labelText = "";
    if (el.id) {
      const lbl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (lbl) labelText = (lbl.innerText || lbl.textContent || "").toLowerCase();
    }

    let containerText = "";
    const container = el.closest(
      "label, .field, .form-group, .input-group, fieldset, " +
      "[class*='field'], [class*='form'], [class*='question'], [class*='row'], " +
      "[class*='input'], [data-field], li, .application-question"
    );
    if (container) containerText = (container.innerText || container.textContent || "").slice(0, 300).toLowerCase();

    return direct + " " + labelText + " " + containerText;
  }

  // ─── Find ALL matching elements ───────────────────────────────────────────────
  function findAllInputs(keywords) {
    return Array.from(document.querySelectorAll("input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=file]):not([type=radio]):not([type=checkbox]), textarea"))
      .filter(el => keywords.some(k => getElementContext(el).includes(k.toLowerCase())));
  }

  function findAllSelects(keywords) {
    return Array.from(document.querySelectorAll("select"))
      .filter(el => keywords.some(k => getElementContext(el).includes(k.toLowerCase())));
  }

  // ─── Fill helpers ─────────────────────────────────────────────────────────────
  function fillAllInputs(keywords, value) {
    if (!value && value !== false && value !== 0) return 0;
    let count = 0;
    for (const el of findAllInputs(keywords)) {
      if (el.value && el.value.trim().length > 0) continue; // skip already filled
      setNativeValue(el, String(value));
      count++;
    }
    return count;
  }

  function fillAllSelects(keywords, value) {
    if (!value) return 0;
    let count = 0;
    for (const el of findAllSelects(keywords)) {
      if (selectBestOption(el, value)) count++;
    }
    return count;
  }

  function fillRadioGroup(containerKeywords, yesKeywords, noKeywords, wantYes) {
    const allRadios = Array.from(document.querySelectorAll('input[type="radio"]'));
    const tried = new Set();
    for (const r of allRadios) {
      if (tried.has(r.name)) continue;
      if (!containerKeywords.some(k => getElementContext(r).includes(k.toLowerCase()))) continue;
      tried.add(r.name);
      const group = allRadios.filter(x => x.name === r.name);
      const answerKws = wantYes ? yesKeywords : noKeywords;
      for (const radio of group) {
        const lblEl = radio.id ? document.querySelector(`label[for="${CSS.escape(radio.id)}"]`) : null;
        const lblText = (lblEl?.innerText || lblEl?.textContent || radio.value || "").toLowerCase();
        if (answerKws.some(k => lblText.includes(k.toLowerCase()))) {
          if (!radio.checked) radio.click();
          return 1;
        }
      }
    }
    return 0;
  }

  // ─── Platform detection ───────────────────────────────────────────────────────
  function detectPlatform() {
    const url = window.location.hostname + window.location.pathname;
    if (url.includes("greenhouse.io")) return "greenhouse";
    if (url.includes("linkedin.com"))  return "linkedin";
    if (url.includes("lever.co"))      return "lever";
    if (url.includes("myworkdayjobs.com") || url.includes("workday.com")) return "workday";
    return "generic";
  }

  // ─── Field mappings ───────────────────────────────────────────────────────────
  function getMappings(p) {
    const fullName = [p.firstName, p.lastName].filter(Boolean).join(" ");
    return {
      inputs: [
        // Names — covers "preferred first name", "legal first name", long question labels
        { kw: ["first_name", "first-name", "firstname", "given-name", "first name", "given name",
                "preferred first", "legal first", "what is your preferred first",
                "what is your first name", "legal given"],        val: p.firstName },
        { kw: ["last_name", "last-name", "lastname", "family-name", "last name", "surname",
                "preferred last", "legal last", "what is your preferred last",
                "what is your last name", "legal family", "legal surname"],
                                                                  val: p.lastName },
        { kw: ["full name", "your name", "legal name", "complete name", "candidate name"],
                                                                  val: fullName },
        // Contact
        { kw: ["email", "e-mail", "email address"],               val: p.email },
        { kw: ["phone", "telephone", "mobile", "cell", "contact number"],
                                                                  val: p.phone },
        // Address
        { kw: ["street address", "address line 1", "address"],    val: p.address },
        { kw: ["city", "town"],                                    val: p.city },
        { kw: ["state", "province", "region"],                     val: p.state },
        { kw: ["zip", "postal", "postcode", "zip code"],          val: p.zipCode },
        { kw: ["country"],                                         val: p.country },
        // Links — ALL instances (handles duplicate URL fields)
        { kw: ["linkedin", "linkedin url", "linkedin profile", "linkedin.com"],
                                                                  val: p.linkedinUrl },
        { kw: ["github", "github url", "github.com"],             val: p.githubUrl },
        { kw: ["portfolio", "portfolio url", "portfolio site", "personal site"],
                                                                  val: p.portfolioUrl || p.websiteUrl },
        { kw: ["website", "personal website", "personal url", "your website", "web site"],
                                                                  val: p.websiteUrl || p.portfolioUrl },
        { kw: ["twitter", "x.com", "twitter url"],                val: p.twitterUrl },
        // Work experience
        { kw: ["current title", "job title", "title", "position", "role", "current position",
                "your title"],                                     val: p.currentTitle },
        { kw: ["current company", "company", "employer", "organization", "current employer"],
                                                                  val: p.currentCompany },
        { kw: ["years of experience", "years experience", "total years",
                "how many years", "experience level"],            val: p.yearsExperience },
        { kw: ["notice period"],                                   val: p.noticePeriod },
        { kw: ["reason for leaving", "why leaving"],               val: p.reasonForLeaving },
        // Education
        { kw: ["university", "school", "college", "institution", "alma mater"],
                                                                  val: p.university },
        { kw: ["degree", "qualification"],                         val: p.degree },
        { kw: ["major", "field of study", "area of study", "discipline"],
                                                                  val: p.major },
        { kw: ["gpa", "grade point"],                              val: p.gpa },
        { kw: ["graduation year", "grad year", "class of", "graduating", "expected graduation"],
                                                                  val: p.gradYear },
        // Skills
        { kw: ["technical skills", "core skills", "key skills", "skills"],
                                                                  val: p.technicalSkills },
        { kw: ["programming languages", "coding languages"],       val: p.programmingLanguages },
        { kw: ["frameworks", "libraries"],                         val: p.frameworks },
        { kw: ["tools", "software", "platforms"],                  val: p.tools },
        { kw: ["certifications", "certificates", "licenses"],      val: p.certifications },
        { kw: ["languages spoken", "spoken language", "language skills"],
                                                                  val: p.languages },
        // Compensation
        { kw: ["desired salary", "expected salary", "salary expectation", "compensation",
                "target salary"],                                 val: p.desiredSalary },
        // Common application questions
        { kw: ["cover letter"],                                    val: p.coverLetterTemplate },
        { kw: ["tell us about yourself", "about yourself", "summary", "elevator pitch",
                "brief introduction", "introduce yourself", "professional summary"],
                                                                  val: p.elevatorPitch },
        { kw: ["why this role", "why apply", "why are you interested",
                "interest in this role", "why this position", "why do you want this"],
                                                                  val: p.whyThisRole },
        { kw: ["why this company", "why us", "why our company",
                "why do you want to work here", "interest in our company"],
                                                                  val: p.whyThisCompany },
        { kw: ["greatest strength", "key strength", "what are your strengths"],
                                                                  val: p.greatestStrength },
        { kw: ["weakness", "area of improvement", "area for growth", "what are your weaknesses"],
                                                                  val: p.greatestWeakness },
        { kw: ["personal statement", "objective", "career objective", "professional objective"],
                                                                  val: p.personalStatement },
        { kw: ["awards", "honors", "achievements", "recognition"],val: p.awards },
        { kw: ["volunteer", "community service"],                  val: p.volunteerExperience },
        { kw: ["publications", "papers", "research papers"],       val: p.publications },
        { kw: ["patents"],                                         val: p.patents },
        { kw: ["security clearance", "clearance level"],           val: p.securityClearance },
        { kw: ["military", "military service"],                    val: p.militaryService },
        { kw: ["referral", "referred by", "employee name"],        val: p.referralSource },
        { kw: ["how did you hear", "how did you find", "how did you learn about",
                "how did you come across"],                       val: p.howDidYouHear },
        { kw: ["start date", "available start", "when can you start"],
                                                                  val: p.availableStartDate },
        { kw: ["preferred location"],                              val: p.preferredLocations },
        { kw: ["management style"],                                val: p.managementStyle },
        { kw: ["team size", "team managed", "people managed"],     val: p.teamSize },
        { kw: ["professional memberships", "memberships"],         val: p.professionalMemberships },
        { kw: ["visa type", "current visa"],                       val: p.visaType },
        { kw: ["citizenship", "residency status"],                 val: p.citizenship },
      ],
      selects: [
        { kw: ["country"],                                         val: p.country || "United States" },
        { kw: ["state", "province"],                              val: p.state },
        { kw: ["currency", "salary currency"],                    val: p.salaryCurrency || "USD" },
        { kw: ["pay period", "salary period"],                    val: p.salaryPeriod || "annually" },
        { kw: ["work type", "work arrangement"],                   val: p.workType || "Remote" },
        { kw: ["how did you hear", "hear about", "how did you find"],
                                                                  val: p.howDidYouHear || "LinkedIn" },
        // Demographics
        { kw: ["gender", "identify my gender", "gender identity"],val: p.gender || "Decline to self-identify" },
        { kw: ["transgender", "identify as transgender"],          val: "Decline to self-identify" },
        { kw: ["sexual orientation", "sexual identity"],           val: "Decline to self-identify" },
        { kw: ["ethnicity", "race", "racial", "ethnic background"], val: p.race || "Decline to self-identify" },
        { kw: ["veteran", "veteran status", "protected veteran"],  val: p.veteranStatus || "Decline to self-identify" },
        { kw: ["disability", "physical disability"],               val: p.disabilityStatus || "Decline to self-identify" },
        { kw: ["pronouns"],                                        val: "Decline to self-identify" },
        { kw: ["criminal", "criminal record", "felony"],           val: p.criminalRecord || "No" },
        { kw: ["authorized to work", "right to work", "legal right to work",
                "legally authorized", "eligible to work", "work in canada",
                "work in the us", "work in the uk", "work in australia"],
                                                                  val: p.workAuthorized ? "Yes" : "No" },
        { kw: ["require sponsor", "sponsorship required", "need sponsorship", "visa sponsorship"],
                                                                  val: p.requiresSponsorship ? "Yes" : "No" },
        { kw: ["willing to relocate", "open to relocation"],       val: p.willingToRelocate ? "Yes" : "No" },
        { kw: ["highest education", "level of education"],         val: p.degree },
        { kw: ["citizenship", "citizen status"],                   val: p.citizenship },
        { kw: ["visa type"],                                       val: p.visaType },
      ],
      radios: [
        {
          kw: ["authorized to work", "legally authorized", "eligible to work",
               "right to work", "work in the", "work in canada", "work authorization"],
          yes: ["yes", "i am authorized", "authorized", "i am legally"],
          no:  ["no", "not authorized", "require sponsorship"],
          val: p.workAuthorized !== undefined ? p.workAuthorized : true,
        },
        {
          kw: ["sponsorship", "visa sponsor", "require sponsor", "need sponsor"],
          yes: ["yes", "will require", "need sponsorship", "require"],
          no:  ["no", "will not", "do not require", "not require", "i don't"],
          val: p.requiresSponsorship !== undefined ? p.requiresSponsorship : false,
        },
        {
          kw: ["relocat", "willing to move", "open to moving"],
          yes: ["yes", "willing", "open to"],
          no:  ["no", "not willing", "not open"],
          val: p.willingToRelocate !== undefined ? p.willingToRelocate : false,
        },
        {
          kw: ["drug test", "drug screening"],
          yes: ["yes", "willing", "agree"],
          no:  ["no", "not willing"],
          val: p.drugTest !== undefined ? p.drugTest : true,
        },
      ],
    };
  }

  // ─── Main structured fill pass ────────────────────────────────────────────────
  function runFillPass(profile) {
    let count = 0;
    const m = getMappings(profile);

    // Lever: full name in single field
    if (detectPlatform() === "lever") {
      const nameEl = document.querySelector('input[name="name"]');
      if (nameEl && !nameEl.value) {
        setNativeValue(nameEl, [profile.firstName, profile.lastName].filter(Boolean).join(" "));
        count++;
      }
    }

    for (const { kw, val } of m.inputs)  count += fillAllInputs(kw, val);
    for (const { kw, val } of m.selects) count += fillAllSelects(kw, val);
    for (const { kw, yes, no, val } of m.radios) count += fillRadioGroup(kw, yes, no, val);

    return count;
  }

  // ─── AI pass: answer remaining empty textareas ────────────────────────────────
  async function runAIPass(profile) {
    const knownKws = ["cover letter", "summary", "elevator pitch", "about yourself", "skills",
      "certifications", "volunteer", "publication", "why this", "strength", "weakness",
      "personal statement", "management", "awards", "military", "patent"];

    const unfilled = Array.from(document.querySelectorAll("textarea")).filter(ta => {
      if (ta.value && ta.value.trim().length > 0) return false;
      const ctx = getElementContext(ta);
      if (knownKws.some(k => ctx.includes(k))) return false;
      const question = (ta.id
        ? document.querySelector(`label[for="${CSS.escape(ta.id)}"]`)?.innerText
        : null) || ta.getAttribute("aria-label") || ta.placeholder || "";
      return question.trim().length >= 20;
    });

    if (unfilled.length === 0) return 0;

    const questions = unfilled.map(ta => {
      const lbl = ta.id ? document.querySelector(`label[for="${CSS.escape(ta.id)}"]`) : null;
      return (lbl?.innerText || lbl?.textContent || ta.getAttribute("aria-label") || ta.placeholder || "").trim();
    });

    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: "ANSWER_QUESTIONS", questions, profile }, (res) => {
        if (!res?.answers?.length) { resolve(0); return; }
        let count = 0;
        unfilled.forEach((ta, i) => {
          const answer = res.answers[i];
          if (answer?.trim().length > 0) { setNativeValue(ta, answer); count++; }
        });
        resolve(count);
      });
    });
  }

  // ─── Full fill orchestrator ───────────────────────────────────────────────────
  async function fillForms(profile) {
    const platform = detectPlatform();
    let count = runFillPass(profile);
    try { count += await runAIPass(profile); } catch (e) {}
    showToast(count, platform);
    return count;
  }

  // ─── Toast ────────────────────────────────────────────────────────────────────
  function showToast(count, platform) {
    document.getElementById("eazyapply-toast")?.remove();
    const ok = count > 0;
    const toast = document.createElement("div");
    toast.id = "eazyapply-toast";
    toast.style.cssText = `
      position:fixed;bottom:80px;right:20px;z-index:2147483647;
      background:#18181b;border:1px solid ${ok?"#4ade8033":"#f8717133"};
      color:${ok?"#4ade80":"#f87171"};border-radius:10px;padding:10px 16px;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      font-size:13px;font-weight:600;box-shadow:0 4px 24px rgba(0,0,0,.4);
      display:flex;align-items:center;gap:8px;pointer-events:none;
    `;
    toast.innerHTML = ok
      ? `⚡ <span>${count} field${count!==1?"s":""} filled on ${platform}</span>`
      : `⚠️ <span>No fields filled — save your profile first</span>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
  }

  // ─── Floating ⚡ button ────────────────────────────────────────────────────────
  function injectButton() {
    if (document.getElementById("eazyapply-fab")) return;
    const btn = document.createElement("button");
    btn.id = "eazyapply-fab";
    btn.title = "EazyApply — Auto-fill this form";
    btn.style.cssText = `
      position:fixed;bottom:20px;right:20px;z-index:2147483647;
      width:52px;height:52px;border-radius:50%;background:#4ade80;
      color:#000;border:none;cursor:pointer;font-size:22px;
      display:flex;align-items:center;justify-content:center;
      box-shadow:0 4px 20px rgba(74,222,128,.45);transition:transform .15s,box-shadow .15s;
    `;
    btn.textContent = "⚡";
    btn.onmouseenter = () => { btn.style.transform="scale(1.12)"; btn.style.boxShadow="0 6px 28px rgba(74,222,128,.65)"; };
    btn.onmouseleave = () => { btn.style.transform="scale(1)";    btn.style.boxShadow="0 4px 20px rgba(74,222,128,.45)"; };
    btn.onclick = async () => {
      btn.textContent = "⏳"; btn.style.background = "#fbbf24";
      chrome.runtime.sendMessage({ action: "GET_PROFILE" }, async (res) => {
        if (!res?.profile) {
          showToast(0, detectPlatform());
          btn.textContent = "⚡"; btn.style.background = "#4ade80"; return;
        }
        const count = await fillForms(res.profile);
        btn.textContent = count > 0 ? "✓" : "⚠️";
        btn.style.background = count > 0 ? "#4ade80" : "#f87171";
        setTimeout(() => { btn.textContent = "⚡"; btn.style.background = "#4ade80"; }, 3000);
      });
    };
    document.body.appendChild(btn);
  }

  // ─── Message listener ─────────────────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg, _, sendResponse) => {
    if (msg.action === "FILL_FORMS") {
      chrome.runtime.sendMessage({ action: "GET_PROFILE" }, async (res) => {
        const count = res?.profile ? await fillForms(res.profile) : 0;
        if (!res?.profile) showToast(0, detectPlatform());
        sendResponse({ count });
      });
      return true;
    }
  });

  // ─── Init + SPA re-inject ─────────────────────────────────────────────────────
  function init() { injectButton(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      document.getElementById("eazyapply-fab")?.remove();
      setTimeout(init, 1500);
    }
  }).observe(document, { subtree: true, childList: true });
})();
