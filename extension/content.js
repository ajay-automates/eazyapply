// EazyApply Content Script — Comprehensive Form Filler
(function () {
  "use strict";

  // ─── React/Angular-safe value setter ─────────────────────────────────────────
  function setNativeValue(el, value) {
    try {
      const proto = el.tagName === "TEXTAREA"
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
      if (setter) setter.call(el, value);
      else el.value = value;
      ["input", "change", "blur"].forEach(ev =>
        el.dispatchEvent(new Event(ev, { bubbles: true }))
      );
    } catch (e) { el.value = value; }
  }

  // ─── Smart select matcher ─────────────────────────────────────────────────────
  // Handles: exact, contains, "decline" → "don't wish/prefer not/no answer"
  function selectBestOption(el, desiredValue) {
    if (!el || !desiredValue) return false;
    const val = String(desiredValue).toLowerCase().trim();
    const options = Array.from(el.options).filter(o => o.value !== "" && o.value !== "0");

    const isDecline = val.includes("decline") || val.includes("prefer not") || val === "no";
    const isYes = val === "yes" || val === "true";
    const isNo  = val === "no"  || val === "false";

    // Priority 1: exact value or text match
    for (const o of options) {
      if (o.value.toLowerCase() === val || o.text.toLowerCase() === val) {
        return applyOption(el, o);
      }
    }
    // Priority 2: contains match
    for (const o of options) {
      if (o.text.toLowerCase().includes(val) || val.includes(o.text.toLowerCase())) {
        return applyOption(el, o);
      }
    }
    // Priority 3: "decline" → find any "don't wish / prefer not / decline / no answer" option
    if (isDecline) {
      const declinePatterns = ["don't wish", "do not wish", "prefer not", "decline", "no answer",
        "not to answer", "not wish", "i don't", "rather not", "no response", "not applicable",
        "not disclose", "choose not"];
      for (const o of options) {
        const ot = o.text.toLowerCase();
        if (declinePatterns.some(p => ot.includes(p))) return applyOption(el, o);
      }
      // Last resort: pick last option (often "prefer not to say")
      const last = options[options.length - 1];
      if (last) return applyOption(el, last);
    }
    // Priority 4: yes/no
    if (isYes) {
      const o = options.find(o => o.text.toLowerCase().startsWith("yes") || o.value.toLowerCase() === "yes");
      if (o) return applyOption(el, o);
    }
    if (isNo) {
      const o = options.find(o => o.text.toLowerCase().startsWith("no") || o.value.toLowerCase() === "no");
      if (o) return applyOption(el, o);
    }
    return false;
  }

  function applyOption(el, option) {
    el.value = option.value;
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("input",  { bubbles: true }));
    return true;
  }

  // ─── Platform detection ───────────────────────────────────────────────────────
  function detectPlatform() {
    const host = window.location.hostname + window.location.pathname;
    if (host.includes("greenhouse.io"))    return "greenhouse";
    if (host.includes("linkedin.com"))     return "linkedin";
    if (host.includes("lever.co"))         return "lever";
    if (host.includes("myworkdayjobs.com") || host.includes("workday.com")) return "workday";
    return "generic";
  }

  // ─── Universal field finder ───────────────────────────────────────────────────
  function allText(el) {
    const attrs = [el.name, el.id, el.placeholder,
      el.getAttribute("aria-label"), el.getAttribute("data-automation-id"),
      el.getAttribute("data-field-path"), el.getAttribute("autocomplete"),
      el.getAttribute("data-qa"), el.getAttribute("name")
    ].filter(Boolean).join(" ").toLowerCase();

    let label = "";
    // Check for associated <label>
    if (el.id) {
      const lbl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (lbl) label = lbl.textContent.toLowerCase();
    }
    // Check ancestor label/container text (first 120 chars)
    if (!label) {
      const container = el.closest("label, .field, .form-group, .input-group, fieldset, " +
        "[class*='field'], [class*='form'], [class*='question'], [class*='row']");
      if (container) label = container.textContent.toLowerCase().slice(0, 120);
    }
    return attrs + " " + label;
  }

  function findInput(keywords) {
    const els = Array.from(document.querySelectorAll("input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=file]), textarea"));
    for (const el of els) {
      if (el.offsetParent === null && !el.closest('[style*="display:none"]') === false) continue;
      const t = allText(el);
      if (keywords.some(k => t.includes(k.toLowerCase()))) return el;
    }
    return null;
  }

  function findSelect(keywords) {
    const els = Array.from(document.querySelectorAll("select"));
    for (const el of els) {
      const t = allText(el);
      if (keywords.some(k => t.includes(k.toLowerCase()))) return el;
    }
    return null;
  }

  function findRadioGroup(keywords, preferredValue) {
    const radios = Array.from(document.querySelectorAll('input[type="radio"]'));
    for (const r of radios) {
      const container = r.closest("fieldset, [class*='question'], [class*='field'], [class*='group'], .radio-group, form") || document.body;
      const containerText = container.textContent.toLowerCase().slice(0, 200);
      if (keywords.some(k => containerText.includes(k.toLowerCase()))) {
        // Found the group — now pick the right option
        const name = r.name;
        const groupRadios = Array.from(document.querySelectorAll(`input[type="radio"][name="${CSS.escape(name)}"]`));
        return { radios: groupRadios, containerText };
      }
    }
    return null;
  }

  function clickRadio(radios, preferredAnswerKeywords) {
    // Try to find matching option
    for (const r of radios) {
      const lbl = r.id ? document.querySelector(`label[for="${CSS.escape(r.id)}"]`) : null;
      const labelText = (lbl?.textContent || r.value || "").toLowerCase();
      if (preferredAnswerKeywords.some(k => labelText.includes(k.toLowerCase()))) {
        if (!r.checked) r.click();
        return true;
      }
    }
    return false;
  }

  // ─── Fill one field ───────────────────────────────────────────────────────────
  function fillInput(keywords, value) {
    if (!value && value !== false && value !== 0) return false;
    const el = findInput(keywords);
    if (!el) return false;
    setNativeValue(el, String(value));
    return true;
  }

  function fillSelect(keywords, value) {
    if (!value) return false;
    const el = findSelect(keywords);
    if (!el) return false;
    return selectBestOption(el, value);
  }

  function fillRadio(keywords, yesKeywords, noKeywords, value) {
    const group = findRadioGroup(keywords);
    if (!group) return false;
    const wantYes = value === true || value === "true" || value === "yes" || value === "Yes";
    return clickRadio(group.radios, wantYes ? yesKeywords : noKeywords);
  }

  // ─── Greenhouse-specific fill ─────────────────────────────────────────────────
  function fillGreenhouse(p) {
    let count = 0;

    // Basic fields
    const basics = [
      { kw: ["first_name", "first-name", "first name", "firstname", "given name"], val: p.firstName },
      { kw: ["last_name", "last-name", "last name", "lastname", "surname"],        val: p.lastName },
      { kw: ["email", "e-mail"],                                                   val: p.email },
      { kw: ["phone", "telephone", "mobile", "cell"],                              val: p.phone },
      { kw: ["address", "street"],                                                 val: p.address },
      { kw: ["city"],                                                               val: p.city },
      { kw: ["state", "province"],                                                 val: p.state },
      { kw: ["zip", "postal"],                                                     val: p.zipCode },
      { kw: ["linkedin"],                                                           val: p.linkedinUrl },
      { kw: ["github"],                                                             val: p.githubUrl },
      { kw: ["portfolio", "personal site", "personal website"],                   val: p.portfolioUrl || p.websiteUrl },
      { kw: ["twitter"],                                                            val: p.twitterUrl },
      { kw: ["website", "url", "personal url"],                                   val: p.websiteUrl || p.portfolioUrl },
      { kw: ["university", "school", "college", "institution"],                   val: p.university },
      { kw: ["degree", "qualification"],                                           val: p.degree },
      { kw: ["major", "field of study"],                                           val: p.major },
      { kw: ["gpa"],                                                               val: p.gpa },
      { kw: ["graduation year", "grad year", "class of", "class year"],           val: p.gradYear },
      { kw: ["current title", "job title", "position", "role", "title"],          val: p.currentTitle },
      { kw: ["current company", "current employer", "company", "employer"],       val: p.currentCompany },
      { kw: ["years of experience", "years experience", "total experience"],      val: p.yearsExperience },
      { kw: ["salary", "compensation", "desired salary", "expected salary"],      val: p.desiredSalary },
      { kw: ["cover letter"],                                                       val: p.coverLetterTemplate },
      { kw: ["summary", "about yourself", "tell us", "elevator pitch", "brief introduction"], val: p.elevatorPitch },
      { kw: ["skills", "technical skills"],                                        val: p.technicalSkills },
      { kw: ["certifications", "certificates"],                                    val: p.certifications },
      { kw: ["languages spoken", "spoken languages"],                             val: p.languages },
      { kw: ["awards", "honors", "achievements"],                                  val: p.awards },
      { kw: ["volunteer"],                                                          val: p.volunteerExperience },
      { kw: ["publications", "papers", "articles"],                               val: p.publications },
      { kw: ["why", "interest", "motivation", "why apply", "why this role"],      val: p.whyThisRole },
    ];

    for (const { kw, val } of basics) {
      if (fillInput(kw, val)) count++;
    }

    // Native selects
    const selects = [
      { kw: ["country"],                    val: p.country },
      { kw: ["state", "province", "region"], val: p.state },
    ];
    for (const { kw, val } of selects) {
      if (fillSelect(kw, val)) count++;
    }

    // Work authorization radio buttons
    const authFilled = fillRadio(
      ["authorized to work", "work authorization", "legally authorized", "eligible to work", "right to work"],
      ["yes", "i am authorized", "i am legally"],
      ["no", "i am not", "require"],
      p.workAuthorized
    );
    if (authFilled) count++;

    const sponsorFilled = fillRadio(
      ["sponsorship", "visa sponsor", "require sponsor", "need sponsor", "work visa"],
      ["yes", "will require", "i will need", "need sponsorship"],
      ["no", "will not", "i do not", "not require"],
      p.requiresSponsorship
    );
    if (sponsorFilled) count++;

    const relocateFilled = fillRadio(
      ["relocat", "willing to move", "open to relocat"],
      ["yes", "willing", "open to"],
      ["no", "not willing", "not open"],
      p.willingToRelocate
    );
    if (relocateFilled) count++;

    // ─── Demographic selects (Greenhouse uses native <select> with custom styling) ──
    const demographics = [
      {
        kw: ["gender", "identify my gender", "gender identity", "i identify my gender"],
        val: p.gender || "Decline to self-identify"
      },
      {
        kw: ["transgender", "identify as transgender", "do you identify as transgender"],
        val: "Decline to self-identify"
      },
      {
        kw: ["sexual orientation", "identify my sexual orientation", "sexual identity"],
        val: "Decline to self-identify"
      },
      {
        kw: ["ethnicity", "race", "identify my ethnicity", "racial", "ethnic background"],
        val: p.race || "Decline to self-identify"
      },
      {
        kw: ["veteran", "veteran status", "protected veteran"],
        val: p.veteranStatus || "Decline to self-identify"
      },
      {
        kw: ["disability", "physical disability", "disabilities", "i have a physical disability"],
        val: p.disabilityStatus || "Decline to self-identify"
      },
      {
        kw: ["pronouns", "preferred pronouns"],
        val: "Decline to self-identify"
      },
    ];

    for (const { kw, val } of demographics) {
      if (fillSelect(kw, val)) count++;
    }

    // Also check for demographic radio buttons (some Greenhouse forms use radios)
    const demoRadios = [
      {
        kw: ["veteran", "protected veteran"],
        yes: ["i am not a protected", "not a veteran", "no"],
        no:  ["i identify as", "yes"],
        val: false // default: not a veteran
      },
      {
        kw: ["disability"],
        yes: ["no, i don", "no disability", "no"],
        no:  ["yes, i have", "yes"],
        val: false // default: no disability
      },
    ];
    for (const { kw, yes, no, val } of demoRadios) {
      if (fillRadio(kw, yes, no, val)) count++;
    }

    return count;
  }

  // ─── LinkedIn-specific fill ───────────────────────────────────────────────────
  function fillLinkedIn(p) {
    let count = 0;

    const fields = [
      { kw: ["first name", "given name", "first-name"],                           val: p.firstName },
      { kw: ["last name", "family name", "last-name", "surname"],                 val: p.lastName },
      { kw: ["email", "e-mail"],                                                   val: p.email },
      { kw: ["phone", "mobile", "telephone"],                                      val: p.phone },
      { kw: ["city", "location", "current city"],                                  val: p.city },
      { kw: ["linkedin", "linkedin url"],                                          val: p.linkedinUrl },
      { kw: ["website", "portfolio"],                                              val: p.portfolioUrl || p.websiteUrl },
      { kw: ["title", "current role", "headline"],                                 val: p.currentTitle },
      { kw: ["company", "employer", "current company"],                            val: p.currentCompany },
      { kw: ["years", "experience", "years of experience"],                       val: p.yearsExperience },
      { kw: ["salary", "compensation"],                                            val: p.desiredSalary },
      { kw: ["school", "university", "college"],                                   val: p.university },
      { kw: ["degree"],                                                             val: p.degree },
      { kw: ["summary", "about", "cover"],                                         val: p.elevatorPitch },
    ];

    for (const { kw, val } of fields) {
      if (fillInput(kw, val)) count++;
    }

    // Handle LinkedIn's Yes/No radio questions
    const radioQuestions = [
      {
        kw: ["authorized", "legally authorized", "eligible to work", "right to work"],
        yes: ["yes"], no: ["no"],
        val: p.workAuthorized
      },
      {
        kw: ["sponsorship", "visa", "sponsor"],
        yes: ["yes"], no: ["no"],
        val: p.requiresSponsorship
      },
      {
        kw: ["relocat"],
        yes: ["yes"], no: ["no"],
        val: p.willingToRelocate
      },
    ];

    for (const { kw, yes, no, val } of radioQuestions) {
      if (fillRadio(kw, yes, no, val)) count++;
    }

    return count;
  }

  // ─── Lever-specific fill ──────────────────────────────────────────────────────
  function fillLever(p) {
    let count = 0;

    // Lever uses name="name" for full name
    const nameEl = document.querySelector('input[name="name"]');
    if (nameEl && (p.firstName || p.lastName)) {
      setNativeValue(nameEl, [p.firstName, p.lastName].filter(Boolean).join(" "));
      count++;
    }

    const fields = [
      { kw: ["email", "e-mail"],                                val: p.email },
      { kw: ["phone", "telephone"],                             val: p.phone },
      { kw: ["org", "company", "organization", "employer"],    val: p.currentCompany },
      { kw: ["title", "current role", "current title"],        val: p.currentTitle },
      { kw: ["urls[linkedin]", "linkedin"],                     val: p.linkedinUrl },
      { kw: ["urls[github]", "github"],                         val: p.githubUrl },
      { kw: ["urls[portfolio]", "portfolio", "website"],       val: p.portfolioUrl || p.websiteUrl },
      { kw: ["urls[twitter]", "twitter"],                       val: p.twitterUrl },
      { kw: ["summary", "cover", "about"],                      val: p.elevatorPitch },
      { kw: ["salary", "compensation"],                         val: p.desiredSalary },
    ];

    for (const { kw, val } of fields) {
      if (fillInput(kw, val)) count++;
    }

    return count;
  }

  // ─── Workday-specific fill ────────────────────────────────────────────────────
  function fillWorkday(p) {
    let count = 0;

    // Workday uses data-automation-id
    const automationFields = [
      { ids: ["legalNameSection_firstName", "firstName", "given-name"],           val: p.firstName },
      { ids: ["legalNameSection_lastName",  "lastName",  "family-name"],          val: p.lastName },
      { ids: ["email", "emailAddress"],                                            val: p.email },
      { ids: ["phone", "phoneNumber", "deviceText"],                              val: p.phone },
      { ids: ["addressSection_city", "city"],                                     val: p.city },
      { ids: ["addressSection_stateProvince", "state"],                           val: p.state },
      { ids: ["addressSection_postalCode", "postalCode", "zipCode"],             val: p.zipCode },
      { ids: ["linkedIn", "linkedin"],                                             val: p.linkedinUrl },
    ];

    for (const { ids, val } of automationFields) {
      if (!val) continue;
      for (const id of ids) {
        const el = document.querySelector(`[data-automation-id*="${id}"] input, [data-automation-id="${id}"]`);
        if (el) { setNativeValue(el, val); count++; break; }
      }
    }

    // Fall through to generic for remaining fields
    count += fillGeneric(p, true);
    return count;
  }

  // ─── Generic fill (all platforms) ────────────────────────────────────────────
  function fillGeneric(p, skipIfEmpty = false) {
    let count = 0;

    const inputMappings = [
      { kw: ["first name", "firstname", "first-name", "given name", "fname"],     val: p.firstName },
      { kw: ["last name", "lastname", "last-name", "surname", "lname"],           val: p.lastName },
      { kw: ["full name", "your name", "legal name"],                             val: [p.firstName, p.lastName].filter(Boolean).join(" ") },
      { kw: ["email", "e-mail", "email address"],                                  val: p.email },
      { kw: ["phone", "telephone", "mobile", "cell phone", "contact number"],    val: p.phone },
      { kw: ["address", "street address", "street"],                              val: p.address },
      { kw: ["city", "town"],                                                      val: p.city },
      { kw: ["state", "province", "region"],                                      val: p.state },
      { kw: ["zip", "postal", "postcode", "zip code"],                            val: p.zipCode },
      { kw: ["country"],                                                           val: p.country },
      { kw: ["linkedin", "linkedin url", "linkedin profile"],                     val: p.linkedinUrl },
      { kw: ["github", "github url"],                                              val: p.githubUrl },
      { kw: ["portfolio", "portfolio url", "personal site"],                      val: p.portfolioUrl || p.websiteUrl },
      { kw: ["website", "personal website", "personal url"],                      val: p.websiteUrl || p.portfolioUrl },
      { kw: ["twitter", "x.com"],                                                  val: p.twitterUrl },
      { kw: ["university", "school", "college", "institution"],                   val: p.university },
      { kw: ["degree", "qualification"],                                           val: p.degree },
      { kw: ["major", "field of study", "area of study", "discipline"],          val: p.major },
      { kw: ["gpa", "grade point"],                                               val: p.gpa },
      { kw: ["graduation year", "grad year", "class of", "graduating"],          val: p.gradYear },
      { kw: ["current title", "job title", "position", "role"],                   val: p.currentTitle },
      { kw: ["current company", "employer", "company", "organization"],           val: p.currentCompany },
      { kw: ["years of experience", "years experience"],                          val: p.yearsExperience },
      { kw: ["notice period"],                                                     val: p.noticePeriod },
      { kw: ["desired salary", "expected salary", "salary expectation"],         val: p.desiredSalary },
      { kw: ["cover letter"],                                                       val: p.coverLetterTemplate },
      { kw: ["summary", "about yourself", "tell us about", "elevator pitch"],    val: p.elevatorPitch },
      { kw: ["why this role", "why apply", "why interested", "your interest"],   val: p.whyThisRole },
      { kw: ["why this company", "why us", "why our company"],                   val: p.whyThisCompany },
      { kw: ["greatest strength", "key strength", "your strength"],              val: p.greatestStrength },
      { kw: ["weakness", "area of improvement", "area for growth"],              val: p.greatestWeakness },
      { kw: ["skills", "technical skills", "key skills"],                         val: p.technicalSkills },
      { kw: ["programming languages", "coding languages"],                        val: p.programmingLanguages },
      { kw: ["frameworks", "libraries"],                                           val: p.frameworks },
      { kw: ["tools", "software", "platforms"],                                   val: p.tools },
      { kw: ["certifications", "certificates", "licenses"],                       val: p.certifications },
      { kw: ["languages spoken", "spoken language", "spoken languages"],         val: p.languages },
      { kw: ["awards", "honors", "achievements", "recognition"],                  val: p.awards },
      { kw: ["volunteer", "community service"],                                    val: p.volunteerExperience },
      { kw: ["publication", "papers", "research"],                                val: p.publications },
      { kw: ["security clearance", "clearance level"],                            val: p.securityClearance },
      { kw: ["military", "military service"],                                     val: p.militaryService },
      { kw: ["referral", "referred by", "employee name"],                         val: p.referralSource },
      { kw: ["personal statement", "objective", "career objective"],             val: p.personalStatement },
      { kw: ["how did you hear", "how did you find", "how did you learn"],       val: p.howDidYouHear },
      { kw: ["start date", "available start", "when can you start"],             val: p.availableStartDate },
      { kw: ["preferred location", "preferred work location"],                    val: p.preferredLocations },
      { kw: ["management style"],                                                  val: p.managementStyle },
      { kw: ["team size", "team managed", "people managed"],                     val: p.teamSize },
    ];

    for (const { kw, val } of inputMappings) {
      if (!val && skipIfEmpty) continue;
      if (fillInput(kw, val)) count++;
    }

    const selectMappings = [
      { kw: ["country"],                                                           val: p.country || "United States" },
      { kw: ["state", "province"],                                                 val: p.state },
      { kw: ["currency", "salary currency"],                                       val: p.salaryCurrency || "USD" },
      { kw: ["pay period", "salary period", "compensation period"],               val: p.salaryPeriod || "annually" },
      { kw: ["work type", "work arrangement", "remote", "job type"],             val: p.workType || "Remote" },
      { kw: ["how did you hear", "hear about us", "how did you find"],           val: p.howDidYouHear || "LinkedIn" },
      // Demographics
      { kw: ["gender", "identify my gender", "gender identity"],                  val: p.gender || "Decline to self-identify" },
      { kw: ["transgender", "identify as transgender"],                            val: "Decline to self-identify" },
      { kw: ["sexual orientation", "sexual identity"],                            val: "Decline to self-identify" },
      { kw: ["ethnicity", "race", "racial", "ethnic"],                            val: p.race || "Decline to self-identify" },
      { kw: ["veteran", "veteran status"],                                         val: p.veteranStatus || "Decline to self-identify" },
      { kw: ["disability", "physical disability"],                                 val: p.disabilityStatus || "Decline to self-identify" },
      { kw: ["criminal", "criminal record", "background"],                        val: p.criminalRecord || "No" },
      { kw: ["degree type", "level of education", "highest education"],          val: p.degree },
      { kw: ["citizenship", "citizen", "residency"],                              val: p.citizenship },
      { kw: ["visa", "visa type", "work visa"],                                   val: p.visaType },
      { kw: ["pronouns"],                                                           val: "Decline to self-identify" },
    ];

    for (const { kw, val } of selectMappings) {
      if (!val && skipIfEmpty) continue;
      if (fillSelect(kw, val)) count++;
    }

    // Radio buttons
    const radioMappings = [
      {
        kw: ["authorized to work", "legally authorized", "eligible to work", "right to work", "work in the"],
        yes: ["yes", "i am authorized", "i am legally", "authorized"],
        no:  ["no", "not authorized"],
        val: p.workAuthorized !== undefined ? p.workAuthorized : true
      },
      {
        kw: ["sponsorship", "visa sponsor", "require sponsor", "need sponsor"],
        yes: ["yes", "will require", "need sponsorship", "require sponsorship"],
        no:  ["no", "will not", "do not require", "not require"],
        val: p.requiresSponsorship !== undefined ? p.requiresSponsorship : false
      },
      {
        kw: ["relocat", "willing to move", "open to moving"],
        yes: ["yes", "willing", "open to"],
        no:  ["no", "not willing", "not open"],
        val: p.willingToRelocate !== undefined ? p.willingToRelocate : false
      },
      {
        kw: ["drug test", "drug screening"],
        yes: ["yes", "willing", "agree"],
        no:  ["no", "not willing"],
        val: p.drugTest !== undefined ? p.drugTest : true
      },
    ];

    for (const { kw, yes, no, val } of radioMappings) {
      if (fillRadio(kw, yes, no, val)) count++;
    }

    return count;
  }

  // ─── Master fill dispatcher ───────────────────────────────────────────────────
  function fillForms(profile) {
    const platform = detectPlatform();
    let count = 0;

    switch (platform) {
      case "greenhouse": count = fillGreenhouse(profile); break;
      case "linkedin":   count = fillLinkedIn(profile); break;
      case "lever":      count = fillLever(profile); break;
      case "workday":    count = fillWorkday(profile); break;
      default:           count = fillGeneric(profile); break;
    }

    // Always run generic as a second pass to catch anything missed
    if (platform !== "generic") {
      count += fillGeneric(profile, true);
    }

    showToast(count, platform);
    return count;
  }

  // ─── Toast ────────────────────────────────────────────────────────────────────
  function showToast(count, platform) {
    document.getElementById("eazyapply-toast")?.remove();
    const toast = document.createElement("div");
    toast.id = "eazyapply-toast";
    toast.style.cssText = `
      position:fixed;bottom:80px;right:20px;z-index:2147483647;
      background:#18181b;border:1px solid ${count > 0 ? "#4ade8033" : "#f8717133"};
      border-radius:10px;padding:10px 16px;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      font-size:13px;font-weight:600;box-shadow:0 4px 24px rgba(0,0,0,.4);
      display:flex;align-items:center;gap:8px;
      animation:_ea_in .3s ease;pointer-events:none;
    `;
    const style = document.createElement("style");
    style.textContent = `@keyframes _ea_in{from{transform:translateY(16px);opacity:0}to{transform:translateY(0);opacity:1}}`;
    document.head.appendChild(style);

    if (count > 0) {
      toast.style.color = "#4ade80";
      toast.innerHTML = `⚡ <span>${count} field${count !== 1 ? "s" : ""} filled on ${platform}</span>`;
    } else {
      toast.style.color = "#f87171";
      toast.innerHTML = `⚠️ <span>No fields filled — save your profile first</span>`;
    }
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4500);
  }

  // ─── Floating ⚡ button ────────────────────────────────────────────────────────
  function injectButton() {
    if (document.getElementById("eazyapply-fab")) return;

    const btn = document.createElement("button");
    btn.id = "eazyapply-fab";
    btn.title = "EazyApply — Auto-fill this form";
    btn.style.cssText = `
      position:fixed;bottom:20px;right:20px;z-index:2147483647;
      width:52px;height:52px;border-radius:50%;
      background:#4ade80;color:#000;border:none;cursor:pointer;
      font-size:22px;display:flex;align-items:center;justify-content:center;
      box-shadow:0 4px 20px rgba(74,222,128,.45);
      transition:transform .15s,box-shadow .15s;font-family:sans-serif;
    `;
    btn.textContent = "⚡";
    btn.onmouseenter = () => { btn.style.transform = "scale(1.12)"; btn.style.boxShadow = "0 6px 28px rgba(74,222,128,.65)"; };
    btn.onmouseleave = () => { btn.style.transform = "scale(1)";    btn.style.boxShadow = "0 4px 20px rgba(74,222,128,.45)"; };

    btn.onclick = () => {
      btn.textContent = "⏳";
      btn.style.background = "#fbbf24";
      chrome.runtime.sendMessage({ action: "GET_PROFILE" }, (res) => {
        if (!res?.profile) {
          showToast(0, detectPlatform());
          btn.textContent = "⚡"; btn.style.background = "#4ade80";
          return;
        }
        const count = fillForms(res.profile);
        btn.textContent = count > 0 ? "✓" : "⚠️";
        btn.style.background = count > 0 ? "#4ade80" : "#f87171";
        setTimeout(() => { btn.textContent = "⚡"; btn.style.background = "#4ade80"; }, 2800);
      });
    };

    document.body.appendChild(btn);
  }

  // ─── Message listener ─────────────────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg, _, sendResponse) => {
    if (msg.action === "FILL_FORMS") {
      chrome.runtime.sendMessage({ action: "GET_PROFILE" }, (res) => {
        const count = res?.profile ? fillForms(res.profile) : 0;
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
