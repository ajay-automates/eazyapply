// EazyApply Content Script — Maximum Coverage Form Filler
// Fixes: React-Select dropdowns, fallback for unmatched fields, autocomplete confirmation
(function () {
  "use strict";

  // ═══════════════════════════════════════════════════════════════════════════════
  // UTILITY: React-safe value setter
  // ═══════════════════════════════════════════════════════════════════════════════
  function setNativeValue(el, value) {
    if (!el || value === null || value === undefined) return;
    try {
      let proto;
      if (el.tagName === "TEXTAREA") proto = window.HTMLTextAreaElement.prototype;
      else if (el.tagName === "SELECT") proto = window.HTMLSelectElement.prototype;
      else proto = window.HTMLInputElement.prototype;

      const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
      if (setter) setter.call(el, String(value));
      else el.value = String(value);
    } catch (e) { el.value = String(value); }
    el.dispatchEvent(new Event("focus", { bubbles: true }));
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
    el.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // UTILITY: Native <select> option picker
  // ═══════════════════════════════════════════════════════════════════════════════
  function selectBestOption(el, desiredValue) {
    if (!el || !desiredValue) return false;
    // Normalize curly/smart apostrophes so "I don\u2019t wish" matches "i don't"
    const normText = t => t.replace(/[\u2018\u2019\u201a\u201b]/g, "'")
      .replace(/[\u201c\u201d]/g, '"')
      .toLowerCase().trim();
    const val = normText(String(desiredValue));
    const options = Array.from(el.options).filter(o => o.value !== "" && o.index !== 0);
    if (!options.length) return false;

    const isDecline = ["decline", "prefer not", "don't wish", "no answer"].some(p => val.includes(p));
    const isYes = val === "true" || val === "yes";
    const isNo = val === "false" || val === "no";

    // Exact value match
    for (const o of options) if (normText(o.value) === val) return applyNativeSelect(el, o);
    // Exact text match
    for (const o of options) if (normText(o.text) === val) return applyNativeSelect(el, o);
    // Text contains value
    for (const o of options) if (normText(o.text).includes(val)) return applyNativeSelect(el, o);
    // Value contains text (min 3 chars to avoid false positives)
    for (const o of options) if (val.includes(normText(o.text)) && o.text.length > 3) return applyNativeSelect(el, o);

    // Decline patterns (normalized)
    if (isDecline) {
      const patterns = ["don't wish", "do not wish", "prefer not", "decline", "no answer",
        "not to answer", "not wish", "rather not", "no response", "not applicable",
        "not disclose", "choose not", "i don't", "not to self", "no, i prefer",
        "wish to answer", "i prefer not"];
      for (const o of options) if (patterns.some(p => normText(o.text).includes(p))) return applyNativeSelect(el, o);
      // Last resort for decline: pick last option
      return applyNativeSelect(el, options[options.length - 1]);
    }
    if (isYes) {
      const o = options.find(o => /^yes/i.test(o.text.trim()) || o.value.toLowerCase() === "yes");
      if (o) return applyNativeSelect(el, o);
    }
    if (isNo) {
      const o = options.find(o => /^no\b/i.test(o.text.trim()) || o.value.toLowerCase() === "no");
      if (o) return applyNativeSelect(el, o);
    }
    return false;
  }

  function applyNativeSelect(el, option) {
    setNativeValue(el, option.value);
    return true;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // UTILITY: Get full context text for any element
  // ═══════════════════════════════════════════════════════════════════════════════
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
    // Try label[for=id] - works on Ashby (label for=UUID) and standard forms
    if (el.id) {
      const lbl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (lbl) labelText = (lbl.innerText || lbl.textContent || "").toLowerCase();
    }
    // Fallback: look for a label that WRAPS this element
    if (!labelText) {
      const wrappingLabel = el.closest("label");
      if (wrappingLabel) labelText = (wrappingLabel.innerText || wrappingLabel.textContent || "").toLowerCase();
    }
    // Fallback: nearest preceding sibling label or legend in parent
    if (!labelText) {
      const parent = el.parentElement;
      if (parent) {
        const sibling = parent.querySelector("label, legend, [class*='label'], [class*='Label']");
        if (sibling) labelText = (sibling.innerText || sibling.textContent || "").toLowerCase();
      }
    }

    let containerText = "";
    const container = el.closest(
      "label, .field, .form-group, .input-group, " +
      "[class*='field'], [class*='form-group'], [class*='question'], " +
      "[class*='input'], [data-field], li, .application-question"
    );
    if (container) containerText = (container.innerText || container.textContent || "").slice(0, 300).toLowerCase();

    return direct + " " + labelText + " " + containerText;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // FINDERS & MATCHERS
  // ═══════════════════════════════════════════════════════════════════════════════
  function matchKeywords(ctxText, keywords) {
    if (!ctxText) return false;
    const normCtx = ctxText.toLowerCase();
    return keywords.some(k => {
      const escaped = k.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // allow flexible boundaries (like dashes or parenthesis) by relying on \b
      return new RegExp('\\b' + escaped + '\\b', 'i').test(normCtx);
    });
  }

  function findAllInputs(keywords) {
    return Array.from(document.querySelectorAll(
      "input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=file]):not([type=radio]):not([type=checkbox]), textarea"
    )).filter(el => {
      // Skip React-Select's internal combobox search inputs
      if (el.getAttribute("role") === "combobox") return false;
      if (el.closest('[class*="select__"]')) return false;
      if (el.offsetParent === null) return false;
      return matchKeywords(getElementContext(el), keywords);
    });
  }

  function findAllSelects(keywords) {
    return Array.from(document.querySelectorAll("select")).filter(el =>
      matchKeywords(getElementContext(el), keywords)
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // FILL HELPERS
  // ═══════════════════════════════════════════════════════════════════════════════
  function fillAllInputs(keywords, value) {
    if (!value && value !== false && value !== 0) return 0;
    let count = 0;
    for (const el of findAllInputs(keywords)) {
      if (el.value && el.value.trim().length > 0) continue;
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
      if (!matchKeywords(getElementContext(r), containerKeywords)) continue;
      tried.add(r.name);
      const group = allRadios.filter(x => x.name === r.name);
      const answerKws = wantYes ? yesKeywords : noKeywords;
      for (const radio of group) {
        const lblEl = radio.id ? document.querySelector(`label[for="${CSS.escape(radio.id)}"]`) : null;
        const lblText = (lblEl?.innerText || lblEl?.textContent || radio.value || "").toLowerCase();
        if (matchKeywords(lblText, answerKws)) {
          if (!radio.checked) radio.click();
          return 1;
        }
      }
    }
    return 0;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // FIX #1: React-Select dropdown handler
  // Greenhouse demographics use React-Select, not native <select>
  // ═══════════════════════════════════════════════════════════════════════════════
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  async function fillReactSelects(profile) {
    let count = 0;

    const m = getMappings(profile);
    const reactSelectMap = [
      ...m.inputs,
      ...m.selects,
      ...m.radios.map(r => ({ kw: r.kw, val: r.val ? (r.yes?.[0] || "Yes") : (r.no?.[0] || "No") })),
      { kw: ["pronouns", "preferred pronouns"], val: profile.pronouns || "Decline to self-identify" },
      { kw: ["transgender", "identify as transgender"], val: profile.transgender || "No" },
      { kw: ["sexual orientation", "sexual identity"], val: profile.sexualOrientation || "Heterosexual" }
    ];

    // ── Iterate over combobox inputs directly ──────────────────────────────
    //
    // React-Select DOM structure (v4/v5):
    //
    //   Control div                          ← click this; has indicator SVG child
    //     ├── ValueContainer div
    //     │     ├── InputWrapper div
    //     │     │     ├── input[role="combobox"]   ← we start here
    //     │     │     └── div[aria-hidden="true"]W  ← size-mirror (no SVG)
    //     │     └── Placeholder / SingleValue
    //     └── IndicatorsContainer
    //           └── DropdownIndicator [aria-hidden="true"]
    //                 └── svg ← real indicator (HAS svg child)
    //
    // Walk: input → InputWrapper → ValueContainer → Control (3 levels up)
    // The indicator SVG is inside IndicatorsContainer which is a SIBLING of ValueContainer.
    // Previous bug: code walked only 2 levels (input → InputWrapper → "control"=ValueContainer),
    // so querySelector('[aria-hidden] svg') on ValueContainer found nothing → indicator:false,
    // and clicking ValueContainer missed the React onMouseDown on Control.

    const allInputs = Array.from(document.querySelectorAll('input[role="combobox"]'))
      .filter(inp => inp.offsetParent !== null);

    showStatus(`Filling ${allInputs.length} dropdown(s)...`);
    console.log("[EazyApply] fillReactSelects: found", allInputs.length, "combobox inputs");

    for (const input of allInputs) {
      // 3-level walk: input → InputWrapper → ValueContainer → Control
      const inputWrapper = input.parentElement;
      const valueContainer = inputWrapper?.parentElement;
      const control = valueContainer?.parentElement;
      if (!control || control === document.body) continue;

      // Skip if already has a real selected value (not a placeholder)
      const singleVal = valueContainer.querySelector('[class*="singleValue"], [class*="single-value"], [class*="multiValue"], [class*="multi-value"]');
      if (singleVal && !/^(select|choose|pick)\b/i.test(singleVal.textContent.trim())) continue;

      // Use our precise utility to get context for keyword matching, rather than
      // crawling up to potentially massive containers that bleed adjacent forms.
      const ctxText = getElementContext(input);

      let desiredValue = null;
      for (const m of reactSelectMap) {
        if (matchKeywords(ctxText, m.kw)) { desiredValue = m.val; break; }
      }
      if (!desiredValue) continue;

      // aria-controls is only set when input is NOT hidden (React-Select v5 only sets it
      // when the menu is open). Capture it here, but don't rely on it to open the menu.
      const listboxId = input.getAttribute('aria-controls') || input.getAttribute('aria-owns');

      // Indicator SVG is in IndicatorsContainer — a direct child of Control (sibling of
      // ValueContainer). With the 3-level walk, control IS the Control div, so
      // querySelector('[aria-hidden="true"] svg') now finds the real arrow indicator.
      const indicator = control.querySelector('[aria-hidden="true"] svg, svg[aria-hidden="true"]')
        ?.closest('[aria-hidden="true"]') || null;

      // Snapshot existing listboxes before opening (to detect the NEWLY appeared one)
      const preExisting = new Set(document.querySelectorAll('[role="listbox"]'));

      const findNewMenu = () => {
        if (listboxId) {
          const el = document.getElementById(listboxId);
          if (el) return el;
        }
        for (const el of document.querySelectorAll('[role="listbox"]')) {
          if (!preExisting.has(el)) return el;
        }
        for (const el of document.querySelectorAll('[role="listbox"]')) {
          if (el.getBoundingClientRect().height >= 30) return el;
        }
        return null;
      };

      console.log("[EazyApply] Trying:", desiredValue, "| listboxId:", listboxId, "| indicator:", !!indicator);

      // For autocompletes (like Location), inject text first to trigger options fetching from Google API
      const isLocation = matchKeywords(ctxText, ["location", "city"]);
      if (isLocation) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        if (setter) setter.call(input, desiredValue);
        else input.value = desiredValue;

        input.dispatchEvent(new Event('focus', { bubbles: true }));
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
        await sleep(800); // Give API time to respond
      }

      // ── Open the dropdown (4 methods) ──────────────────────────────────────
      let menu = null;

      // Method A: mousedown on the indicator SVG (React-Select uses onMouseDown, not onClick)
      if (indicator) {
        indicator.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        indicator.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        await sleep(500);
        menu = findNewMenu();
      }

      // Method B: mousedown on the control div (React-Select onControlMouseDown)
      if (!menu) {
        control.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        control.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        await sleep(600);
        menu = findNewMenu();
      }

      // Method C: Focus + ArrowDown keyboard
      if (!menu) {
        input.focus();
        input.dispatchEvent(new KeyboardEvent("keydown", {
          key: "ArrowDown", keyCode: 40, code: "ArrowDown", bubbles: true, cancelable: true
        }));
        await sleep(500);
        menu = findNewMenu();
      }

      // Method D: plain click as last resort
      if (!menu) {
        control.click();
        await sleep(500);
        menu = findNewMenu();
      }

      if (!menu) {
        console.log("[EazyApply] Could not open:", desiredValue);
        continue;
      }

      // ── Poll for options (up to 1s) ─────────────────────────────────────────
      let options = [];
      for (let w = 0; w < 10 && options.length === 0; w++) {
        await sleep(100);
        if (listboxId) menu = document.getElementById(listboxId) || menu;
        options = Array.from(menu.querySelectorAll('[role="option"]'));
        if (!options.length) {
          options = Array.from(menu.querySelectorAll('[class*="select__option"], [class*="Option"]'));
        }
      }

      console.log("[EazyApply] Options:", options.length, "| desired:", desiredValue, "| listboxId:", listboxId);

      if (!options.length) { document.body.click(); await sleep(200); continue; }

      // ── Pick the best option ─────────────────────────────────────────────────
      // Normalize curly/smart apostrophes and quotes to straight variants before
      // any string comparison. Greenhouse uses '\u2019' (right single quotation mark)
      // in option text like "I don\u2019t wish to answer", which would never match
      // our straight-apostrophe pattern "i don't" without normalization.
      const norm = t => {
        if (!t) return "";
        let s = Array.isArray(t) ? t[0] : String(t);
        return s.replace(/[\u2018\u2019\u201a\u201b]/g, "'")
          .replace(/[\u201c\u201d]/g, '"')
          .trim().toLowerCase();
      };

      let picked = false;
      const desired = norm(desiredValue);
      const isDecline = ["decline", "prefer not", "don't wish"].some(p => desired.includes(p));

      // 1. Exact normalized match
      for (const opt of options) {
        if (norm(opt.textContent) === desired) { opt.click(); picked = true; break; }
      }
      // 2. Partial normalized match
      if (!picked) {
        for (const opt of options) {
          const t = norm(opt.textContent);
          if (t.includes(desired) || desired.includes(t)) { opt.click(); picked = true; break; }
        }
      }
      // 3. Decline pattern matching (normalized, expanded)
      if (!picked && isDecline) {
        const dp = [
          "don't wish", "do not wish", "prefer not", "decline",
          "no answer", "rather not", "not to answer", "choose not",
          "not disclose", "not applicable", "i don't", "no response",
          "wish to answer", "not to self", "i prefer not",
        ];
        for (const opt of options) {
          const t = norm(opt.textContent);
          if (dp.some(p => t.includes(p))) { opt.click(); picked = true; break; }
        }
      }
      // 4. For decline desired values, prefer a "No / not" option over "Yes"
      //    (e.g. veteran status: "I am not a protected veteran" beats "Yes, I am a veteran")
      if (!picked && isDecline) {
        const notOpt = options.find(o => {
          const t = norm(o.textContent);
          return t.startsWith("no") || t.startsWith("i am not") || t.includes("not a veteran")
            || t.includes("not protected");
        });
        if (notOpt) { notOpt.click(); picked = true; }
      }
      // 5. For decline desired values, try last option (Greenhouse typically puts
      //    "Decline / I don't wish to answer" last in the list)
      if (!picked && isDecline) {
        options[options.length - 1].click();
        picked = true;
      }
      // 6. True final fallback — first option
      if (!picked) { options[0].click(); picked = true; }

      if (picked) { count++; await sleep(400); }
      else { document.body.click(); await sleep(100); }
    }

    console.log("[EazyApply] fillReactSelects: filled", count, "dropdowns");
    return count;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // FIX #2: Fallback fills — select first option for ALL remaining unfilled fields
  // ═══════════════════════════════════════════════════════════════════════════════
  function fallbackFillSelects() {
    let count = 0;
    // Native <select> elements that still have no value selected
    const selects = document.querySelectorAll("select");
    for (const sel of selects) {
      if (sel.offsetParent === null) continue; // hidden
      // Check if current value is empty/placeholder (index 0 is usually placeholder)
      if (sel.selectedIndex > 0) continue; // already selected something
      const options = Array.from(sel.options).filter(o => o.value !== "" && o.index !== 0);
      if (options.length > 0) {
        // For yes/no selects, prefer "yes"
        const yesOpt = options.find(o => /^yes/i.test(o.text.trim()));
        if (yesOpt) {
          applyNativeSelect(sel, yesOpt);
        } else {
          applyNativeSelect(sel, options[0]);
        }
        count++;
      }
    }
    return count;
  }

  function fallbackFillRadios() {
    let count = 0;
    const allRadios = Array.from(document.querySelectorAll('input[type="radio"]'));
    const groups = new Map();

    // Group radios by name
    for (const r of allRadios) {
      if (!r.name) continue;
      if (!groups.has(r.name)) groups.set(r.name, []);
      groups.get(r.name).push(r);
    }

    // For each group, if none is checked, click "yes" or first option
    for (const [name, radios] of groups) {
      const anyChecked = radios.some(r => r.checked);
      if (anyChecked) continue;

      // Try to find and click "Yes"
      let clicked = false;
      for (const r of radios) {
        const lblEl = r.id ? document.querySelector(`label[for="${CSS.escape(r.id)}"]`) : null;
        const lblText = (lblEl?.innerText || lblEl?.textContent || r.value || "").toLowerCase().trim();
        if (lblText === "yes" || lblText.startsWith("yes")) {
          r.click();
          clicked = true;
          count++;
          break;
        }
      }
      // If no "yes" found, click first option
      if (!clicked && radios.length > 0) {
        radios[0].click();
        count++;
      }
    }
    return count;
  }

  async function fallbackFillReactSelects() {
    let count = 0;
    const allInputs = Array.from(document.querySelectorAll('input[role="combobox"]'))
      .filter(inp => inp.offsetParent !== null);

    for (const input of allInputs) {
      const inputWrapper = input.parentElement;
      const valueContainer = inputWrapper?.parentElement;
      const control = valueContainer?.parentElement;
      if (!control || control === document.body) continue;

      const singleVal = valueContainer.querySelector('[class*="singleValue"], [class*="single-value"], [class*="multiValue"], [class*="multi-value"]');
      if (singleVal && !/^(select|choose|pick)\b/i.test(singleVal.textContent.trim())) continue;

      const listboxId = input.getAttribute('aria-controls') || input.getAttribute('aria-owns');
      const indicator = control.querySelector('[aria-hidden="true"] svg, svg[aria-hidden="true"]')
        ?.closest('[aria-hidden="true"]') || null;
      const preExisting = new Set(document.querySelectorAll('[role="listbox"]'));

      const findNewMenu = () => {
        if (listboxId) {
          const el = document.getElementById(listboxId);
          if (el) return el;
        }
        for (const el of document.querySelectorAll('[role="listbox"]')) {
          if (!preExisting.has(el)) return el;
        }
        for (const el of document.querySelectorAll('[role="listbox"]')) {
          if (el.getBoundingClientRect().height >= 30) return el;
        }
        return null;
      };

      let menu = null;
      if (indicator) {
        indicator.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        indicator.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        await sleep(400); menu = findNewMenu();
      }
      if (!menu) {
        control.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        control.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        await sleep(400); menu = findNewMenu();
      }

      if (!menu) continue;

      let options = [];
      for (let w = 0; w < 5 && !options.length; w++) {
        await sleep(100);
        if (listboxId) menu = document.getElementById(listboxId) || menu;
        if (menu) options = Array.from(menu.querySelectorAll('[role="option"], [class*="select__option"], [class*="Option"]'));
      }

      const validOpts = options.filter(o => !/select|choose/i.test(o.textContent.trim()));
      if (validOpts.length > 0) {
        const yes = validOpts.find(o => /^yes/i.test(o.textContent.trim()));
        (yes || validOpts[0]).click();
        count++;
        await sleep(400);
      } else {
        document.body.click();
        await sleep(100);
      }
    }
    return count;
  }

  function fallbackFillCheckboxes(profile) {
    let count = 0;
    const allCheckboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'))
      .filter(cb => cb.offsetParent !== null);

    // Demographic / sensitive keyword groups — handle intelligently, not blindly
    const demographicKws = ["ethnicity", "race", "gender", "veteran", "disability",
      "community", "communities", "belong", "identity", "orientation", "transgender", "pronouns"];

    // Helper: get label text for a checkbox, handling no-id cases (cb.name or wrapping label)
    function getCbLabel(cb) {
      if (cb.id) {
        const lbl = document.querySelector(`label[for="${CSS.escape(cb.id)}"]`);
        if (lbl) return (lbl.innerText || lbl.textContent || "").toLowerCase().trim();
      }
      // Wrapping label
      const wrapping = cb.closest("label");
      if (wrapping) return (wrapping.innerText || wrapping.textContent || "").toLowerCase().trim();
      // Sibling span/label
      const sibling = cb.parentElement?.querySelector("label, span");
      if (sibling) return (sibling.innerText || sibling.textContent || "").toLowerCase().trim();
      // Fallback to name attribute
      return (cb.name || cb.value || "").toLowerCase().trim();
    }

    // Group by fieldset first (Ashby), then by nearest meaningful container
    const groups = new Map();
    for (const cb of allCheckboxes) {
      // Walk up to find the correct question block — prefer fieldset, then _fieldEntry, then _yesno
      const container =
        cb.closest("fieldset") ||
        cb.closest("[class*='fieldEntry'], [class*='yesno'], [class*='question'], [class*='group']") ||
        cb.parentElement?.parentElement?.parentElement ||
        cb.parentElement;
      if (!groups.has(container)) groups.set(container, []);
      groups.get(container).push(cb);
    }

    for (const [container, cbs] of groups) {
      // Already has at least one checked — skip entirely
      if (cbs.some(cb => cb.checked)) continue;

      // Get question text from legend (fieldset) or container text
      const legend = container.querySelector("legend, [class*='legend'], [class*='label']");
      const groupText = (legend?.innerText || legend?.textContent || container?.innerText || container?.textContent || "").toLowerCase().slice(0, 200);
      const isDemographic = demographicKws.some(k => groupText.includes(k));

      if (isDemographic) {
        const p = profile || {};
        const ethnicity = (Array.isArray(p.ethnicity) ? p.ethnicity[0] : p.ethnicity || p.race || "").toLowerCase();

        let picked = false;

        // Try to match ethnicity
        if (ethnicity && groupText.includes("ethnic")) {
          for (const cb of cbs) {
            const lblText = getCbLabel(cb);
            if (lblText && ethnicity.split(/[\s,]+/).some(word => word.length > 2 && lblText.includes(word))) {
              cb.click(); picked = true; count++; break;
            }
          }
        }

        if (!picked) {
          // Prefer "I prefer not to answer" or "None of the above"
          const safe = cbs.find(cb => /prefer not|i prefer|none of the above|no answer|decline/i.test(getCbLabel(cb)));
          if (safe) { safe.click(); count++; }
          // else skip — don't blindly check all
        }

      } else if (cbs.length === 1) {
        // Single standalone checkbox (consent/acknowledge) — safe to check
        const isConsent = /acknowledge|confirm|agree|consent|certif|accept/i.test(getCbLabel(cbs[0]));
        if (isConsent) { cbs[0].click(); count++; }

      } else {
        const isWorkAuth = /authoriz|right to work|legally|work in/i.test(groupText);
        const isSponsorship = /sponsor/i.test(groupText);

        if (isWorkAuth) {
          const yes = cbs.find(cb => /^yes/i.test(getCbLabel(cb)));
          if (yes) { yes.click(); count++; }
        } else if (isSponsorship) {
          const no = cbs.find(cb => /^no/i.test(getCbLabel(cb)));
          if (no) { no.click(); count++; }
        } else {
          // Unknown multi-option — pick "None of the above" / "I prefer not to answer" to be safe
          const safe = cbs.find(cb => /prefer not|none of the above|no answer|decline/i.test(getCbLabel(cb)));
          if (safe) { safe.click(); count++; }
          // else skip
        }
      }
    }
    return count;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // FIX #3: Confirm autocomplete suggestions (city, location fields)
  // ═══════════════════════════════════════════════════════════════════════════════
  async function confirmAutocompleteSuggestions() {
    let count = 0;

    // Wait for any autocomplete dropdowns to appear
    await sleep(800);

    // Find all visible suggestion lists
    const listboxes = document.querySelectorAll(
      '[role="listbox"], [class*="pac-container"], [class*="autocomplete-dropdown"], ' +
      '[class*="suggestions"], [class*="typeahead"]'
    );

    for (const listbox of listboxes) {
      if (listbox.offsetParent === null) continue; // hidden
      // Skip React-Select menus (handled separately)
      if (listbox.closest('[class*="select__menu"]')) continue;

      const options = listbox.querySelectorAll(
        '[role="option"], .pac-item, [class*="suggestion"], [class*="option"], li'
      );

      if (options.length > 0) {
        // Click the first suggestion
        options[0].click();
        count++;
        await sleep(300);
      }
    }

    return count;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // PLATFORM DETECTION
  // ═══════════════════════════════════════════════════════════════════════════════
  function detectPlatform() {
    const url = window.location.hostname + window.location.pathname;
    if (url.includes("greenhouse.io")) return "greenhouse";
    if (url.includes("linkedin.com")) return "linkedin";
    if (url.includes("lever.co")) return "lever";
    if (url.includes("myworkdayjobs.com") || url.includes("workday.com")) return "workday";
    if (url.includes("indeed.com")) return "indeed";
    if (url.includes("ashbyhq.com")) return "ashby";
    return "generic";
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // FIELD MAPPINGS — keyword → profile value
  // ═══════════════════════════════════════════════════════════════════════════════
  function getMappings(p) {
    const fullName = [p.firstName, p.lastName].filter(Boolean).join(" ");
    return {
      inputs: [
        // Names
        {
          kw: ["first_name", "first-name", "firstname", "given-name", "first name", "given name",
            "preferred first", "legal first", "what is your preferred first",
            "what is your first name", "legal given"], val: p.firstName
        },
        {
          kw: ["last_name", "last-name", "lastname", "family-name", "last name", "surname",
            "preferred last", "legal last", "what is your preferred last",
            "what is your last name", "legal family", "legal surname"], val: p.lastName
        },
        { kw: ["full name", "your name", "legal name", "complete name", "candidate name"], val: fullName },
        // Contact
        { kw: ["email", "e-mail", "email address"], val: p.email },
        { kw: ["phone", "telephone", "mobile", "cell", "contact number"], val: p.phone },
        // Address
        { kw: ["street address", "address line 1", "address"], val: p.address },
        { kw: ["city", "town"], val: p.city },
        { kw: ["state", "province", "region"], val: p.state },
        { kw: ["zip", "postal", "postcode", "zip code"], val: p.zipCode },
        { kw: ["country"], val: p.country },
        { kw: ["location", "current location", "city, state"], val: p.city && p.state ? `${p.city}, ${p.state}` : (p.city || p.address) },
        // Links
        { kw: ["linkedin", "linkedin url", "linkedin profile", "linkedin.com"], val: p.linkedinUrl },
        { kw: ["github", "github url", "github.com"], val: p.githubUrl },
        { kw: ["portfolio", "portfolio url", "portfolio site", "personal site"], val: p.portfolioUrl || p.websiteUrl },
        { kw: ["website", "personal website", "personal url", "your website", "web site"], val: p.websiteUrl || p.portfolioUrl },
        { kw: ["twitter", "x.com", "twitter url"], val: p.twitterUrl },
        // Work
        { kw: ["current title", "job title", "title", "position", "role", "current position", "your title"], val: p.currentTitle },
        { kw: ["current company", "company", "employer", "organization", "current employer"], val: p.currentCompany },
        { kw: ["years of experience", "years experience", "total years", "how many years", "experience level"], val: p.yearsExperience },
        { kw: ["notice period"], val: p.noticePeriod },
        { kw: ["reason for leaving", "why leaving"], val: p.reasonForLeaving },
        // Education
        { kw: ["university", "school", "college", "institution", "alma mater"], val: p.university },
        { kw: ["degree", "qualification"], val: p.degree },
        { kw: ["major", "field of study", "area of study", "discipline"], val: p.major },
        { kw: ["gpa", "grade point"], val: p.gpa },
        { kw: ["graduation year", "grad year", "class of", "graduating", "expected graduation"], val: p.gradYear },
        // Skills
        { kw: ["technical skills", "core skills", "key skills", "skills"], val: p.technicalSkills },
        { kw: ["programming languages", "coding languages"], val: p.programmingLanguages },
        { kw: ["frameworks", "libraries"], val: p.frameworks },
        { kw: ["tools", "software", "platforms"], val: p.tools },
        { kw: ["certifications", "certificates", "licenses"], val: p.certifications },
        { kw: ["languages spoken", "spoken language", "language skills"], val: p.languages },
        // Compensation
        { kw: ["desired salary", "expected salary", "salary expectation", "compensation", "target salary"], val: p.desiredSalary },
        // Common questions
        { kw: ["cover letter"], val: p.coverLetterTemplate },
        {
          kw: ["tell us about yourself", "about yourself", "summary", "elevator pitch",
            "brief introduction", "introduce yourself", "professional summary"], val: p.elevatorPitch
        },
        {
          kw: ["why this role", "why apply", "why are you interested",
            "interest in this role", "why this position", "why do you want this"], val: p.whyThisRole
        },
        {
          kw: ["why this company", "why us", "why our company",
            "why do you want to work here", "interest in our company"], val: p.whyThisCompany
        },
        { kw: ["greatest strength", "key strength", "what are your strengths"], val: p.greatestStrength },
        { kw: ["weakness", "area of improvement", "area for growth", "what are your weaknesses"], val: p.greatestWeakness },
        { kw: ["personal statement", "objective", "career objective", "professional objective"], val: p.personalStatement },
        { kw: ["awards", "honors", "achievements", "recognition"], val: p.awards },
        { kw: ["volunteer", "community service"], val: p.volunteerExperience },
        { kw: ["publications", "papers", "research papers"], val: p.publications },
        { kw: ["patents"], val: p.patents },
        { kw: ["security clearance", "clearance level"], val: p.securityClearance },
        { kw: ["military", "military service"], val: p.militaryService },
        { kw: ["referral", "referred by", "employee name"], val: p.referralSource },
        { kw: ["how did you hear", "how did you find", "how did you learn about", "how did you come across"], val: p.howDidYouHear },
        { kw: ["start date", "available start", "when can you start"], val: p.availableStartDate },
        { kw: ["preferred location"], val: p.preferredLocations },
        { kw: ["management style"], val: p.managementStyle },
        { kw: ["team size", "team managed", "people managed"], val: p.teamSize },
        { kw: ["professional memberships", "memberships"], val: p.professionalMemberships },
        { kw: ["visa type", "current visa"], val: p.visaType },
        { kw: ["citizenship", "residency status"], val: p.citizenship },
      ],
      selects: [
        { kw: ["based in the usa", "based in us", "live in the us", "based in us"], val: "Yes" },
        { kw: ["national pay range", "pay range", "compensation package", "feel comfortable moving forward", "salary range", "compensation expectation"], val: "Yes" },
        { kw: ["country"], val: p.country || "United States" },
        { kw: ["state", "province"], val: p.state },
        { kw: ["currency", "salary currency"], val: p.salaryCurrency || "USD" },
        { kw: ["pay period", "salary period"], val: p.salaryPeriod || "annually" },
        { kw: ["work type", "work arrangement"], val: p.workType || "Remote" },
        { kw: ["how did you hear", "hear about", "how did you find"], val: p.howDidYouHear || "LinkedIn" },
        // Demographics (native selects — some ATS use these)
        { kw: ["gender", "identify my gender", "gender identity"], val: p.gender || "Decline to self-identify" },
        { kw: ["transgender", "identify as transgender"], val: p.transgender || "No" },
        { kw: ["sexual orientation", "sexual identity"], val: p.sexualOrientation || "Heterosexual" },
        { kw: ["ethnicity", "race", "racial", "ethnic background"], val: p.ethnicity || p.race || "Decline to self-identify" },
        { kw: ["veteran", "veteran status", "protected veteran"], val: p.veteranStatus || "Decline to self-identify" },
        { kw: ["disability", "physical disability"], val: p.disabilityStatus || "Decline to self-identify" },
        { kw: ["pronouns"], val: p.pronouns || "Decline to self-identify" },
        { kw: ["criminal", "criminal record", "felony"], val: p.criminalRecord || "No" },
        { kw: ["authorized to work", "right to work", "legally authorized", "eligible to work"], val: p.workAuthorized ? "Yes" : "No" },
        { kw: ["require sponsor", "sponsorship required", "need sponsorship", "visa sponsorship"], val: p.requiresSponsorship ? "Yes" : "No" },
        { kw: ["willing to relocate", "open to relocation"], val: p.willingToRelocate ? "Yes" : "No" },
        { kw: ["highest education", "level of education"], val: p.degree },
        { kw: ["citizenship", "citizen status"], val: p.citizenship },
        { kw: ["visa type"], val: p.visaType },
      ],
      radios: [
        {
          kw: ["authorized to work", "legally authorized", "eligible to work", "right to work", "work in the", "work authorization"],
          yes: ["yes", "i am authorized", "authorized", "i am legally"],
          no: ["no", "not authorized", "require sponsorship"],
          val: p.workAuthorized !== undefined ? p.workAuthorized : true,
        },
        {
          kw: ["sponsorship", "visa sponsor", "require sponsor", "need sponsor"],
          yes: ["yes", "will require", "need sponsorship", "require"],
          no: ["no", "will not", "do not require", "not require", "i don't"],
          val: p.requiresSponsorship !== undefined ? p.requiresSponsorship : false,
        },
        {
          kw: ["relocat", "willing to move", "open to moving"],
          yes: ["yes", "willing", "open to"],
          no: ["no", "not willing", "not open"],
          val: p.willingToRelocate !== undefined ? p.willingToRelocate : false,
        },
        {
          kw: ["drug test", "drug screening"],
          yes: ["yes", "willing", "agree"],
          no: ["no", "not willing"],
          val: p.drugTest !== undefined ? p.drugTest : true,
        },
      ],
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // PASS 1: Structured fill (keyword-matched)
  // ═══════════════════════════════════════════════════════════════════════════════
  function runStructuredFill(profile) {
    let count = 0;
    const m = getMappings(profile);
    const platform = detectPlatform();

    // Lever: full name in single field
    if (platform === "lever") {
      const nameEl = document.querySelector('input[name="name"]');
      if (nameEl && !nameEl.value) {
        setNativeValue(nameEl, [profile.firstName, profile.lastName].filter(Boolean).join(" "));
        count++;
      }
    }

    // Indeed: full name in single field
    if (platform === "indeed") {
      const nameEl = document.querySelector('input[data-testid="input-applicant.name"], input[name="applicant.name"], input[aria-label*="name" i]');
      if (nameEl && !nameEl.value) {
        setNativeValue(nameEl, [profile.firstName, profile.lastName].filter(Boolean).join(" "));
        count++;
      }
    }

    // Ashby: system fields use _systemfield_ prefix; custom fields use UUID names
    if (platform === "ashby") {
      // Fill Name (_systemfield_name) with full name
      const nameEl = document.querySelector('input[name="_systemfield_name"], input[id="_systemfield_name"]');
      if (nameEl && !nameEl.value) {
        setNativeValue(nameEl, [profile.firstName, profile.lastName].filter(Boolean).join(" "));
        count++;
      }
      // Fill Email (_systemfield_email)
      const emailEl = document.querySelector('input[name="_systemfield_email"], input[id="_systemfield_email"]');
      if (emailEl && !emailEl.value) {
        setNativeValue(emailEl, profile.email || "");
        count++;
      }
    }

    for (const { kw, val } of m.inputs) count += fillAllInputs(kw, val);
    for (const { kw, val } of m.selects) count += fillAllSelects(kw, val);
    for (const { kw, yes, no, val } of m.radios) count += fillRadioGroup(kw, yes, no, val);

    return count;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // PASS 2: React-Select dropdowns (Greenhouse demographics)
  // ═══════════════════════════════════════════════════════════════════════════════
  // (fillReactSelects defined above)

  // ═══════════════════════════════════════════════════════════════════════════════
  // PASS 3: AI-powered custom question answering
  // ═══════════════════════════════════════════════════════════════════════════════
  async function runAIPass(profile) {
    const knownKws = ["cover letter", "summary", "elevator pitch", "about yourself", "skills",
      "certifications", "volunteer", "publication", "why this", "strength", "weakness",
      "personal statement", "management", "awards", "military", "patent"];

    const unfilled = Array.from(document.querySelectorAll("textarea")).filter(ta => {
      if (ta.value && ta.value.trim().length > 0) return false;
      const ctx = getElementContext(ta).toLowerCase();
      if (matchKeywords(ctx, knownKws)) return false;
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

  // ═══════════════════════════════════════════════════════════════════════════════
  // PASS 4: Fallback — fill ALL remaining empty fields
  // ═══════════════════════════════════════════════════════════════════════════════
  // (fallbackFillSelects, fallbackFillRadios, fallbackFillReactSelects, fallbackFillCheckboxes)

  // ═══════════════════════════════════════════════════════════════════════════════
  // RESUME UPLOAD
  // ═══════════════════════════════════════════════════════════════════════════════
  async function fillResumeUpload() {
    return new Promise((resolve) => {
      chrome.storage.local.get("eazyapply_resume", (result) => {
        const resumeData = result.eazyapply_resume;
        const b64 = resumeData?.base64 || resumeData?.data;
        if (!resumeData || !b64 || !resumeData.name) { resolve(0); return; }

        try {
          const byteChars = atob(b64);
          const byteNums = new Array(byteChars.length);
          for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
          const byteArray = new Uint8Array(byteNums);
          const mimeType = resumeData.type || "application/pdf";
          const file = new File([byteArray], resumeData.name, { type: mimeType });

          const fileInputs = document.querySelectorAll('input[type="file"]');
          let count = 0;
          for (const input of fileInputs) {
            const ctx = getElementContext(input);
            const accept = (input.accept || "").toLowerCase();
            const isResume = ctx.includes("resume") || ctx.includes("cv") ||
              ctx.includes("attach") || ctx.includes("upload") ||
              accept.includes("pdf") || accept.includes("doc");
            if (!isResume) continue;
            if (input.files && input.files.length > 0) continue;
            try {
              const dt = new DataTransfer();
              dt.items.add(file);
              input.files = dt.files;
              input.dispatchEvent(new Event("change", { bubbles: true }));
              input.dispatchEvent(new Event("input", { bubbles: true }));
              count++;
            } catch (e) { }
          }
          resolve(count);
        } catch (e) { resolve(0); }
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // VALIDATION RETRY HELPERS
  // ═══════════════════════════════════════════════════════════════════════════════

  // Find the Next / Submit button on the current page/step.
  function findNextOrSubmitButton() {
    const nextRx = /^(next|next step|next page|continue|save and continue|proceed|advance)$/i;
    const submitRx = /^(submit|submit application|apply|apply now|send application|complete application|review and submit|review application|save & submit)$/i;

    const getText = el => (el.innerText || el.textContent || el.value || "").trim();

    // ── Enabled buttons first ────────────────────────────────────────────────
    const enabled = Array.from(document.querySelectorAll(
      'button:not([disabled]), input[type="submit"]:not([disabled])'
    )).filter(el => el.offsetParent !== null);

    for (const el of enabled) { if (nextRx.test(getText(el))) return el; }
    for (const el of enabled) { if (submitRx.test(getText(el))) return el; }

    // ── Disabled submit/next buttons — clicking them still fires validation ──
    // Many forms keep Submit disabled until fields pass client-side validation.
    // We still click it so the form marks missing fields with error styles.
    const disabled = Array.from(document.querySelectorAll(
      'button[disabled], input[type="submit"][disabled]'
    )).filter(el => el.offsetParent !== null);

    for (const el of disabled) {
      const t = getText(el);
      if (nextRx.test(t) || submitRx.test(t)) {
        // Temporarily enable so the click event fires properly
        el.removeAttribute("disabled");
        el.removeAttribute("aria-disabled");
        console.log("[EazyApply] Clicking previously-disabled button:", t);
        return el;
      }
    }

    // ── Last resort: last visible non-back button in the form ────────────────
    const form = document.querySelector("form");
    const btns = Array.from((form || document).querySelectorAll("button"))
      .filter(el => {
        if (el.offsetParent === null) return false;
        const t = getText(el).toLowerCase();
        return !t.startsWith("back") && !t.startsWith("prev") && !t.includes("cancel") && t.length > 0;
      });
    if (btns.length) {
      console.log("[EazyApply] Fallback button:", getText(btns[btns.length - 1]));
      return btns[btns.length - 1];
    }

    console.log("[EazyApply] No Next/Submit button found on this page");
    return null;
  }

  // Collect all currently-errored fields visible on the page.
  function collectErrors() {
    const found = new Map(); // element → reason string

    // 1. aria-invalid on form elements
    for (const el of document.querySelectorAll(
      'input[aria-invalid="true"], select[aria-invalid="true"], ' +
      'textarea[aria-invalid="true"], [role="combobox"][aria-invalid="true"]'
    )) {
      if (el.offsetParent !== null) found.set(el, "aria-invalid");
    }

    // 2. Error class on a wrapper — find the field inside it
    for (const container of document.querySelectorAll(
      '[class*="has-error"], [class*="field--error"], [class*="field-error"], ' +
      '[class*="is-invalid"], [class*="input-error"], [class*="error-field"]'
    )) {
      if (container.offsetParent === null) continue;
      const field = container.querySelector(
        'input:not([type=hidden]):not([type=submit]):not([type=button]), ' +
        'select, textarea, [role="combobox"], [aria-haspopup="listbox"]'
      );
      if (field && !found.has(field)) found.set(field, "wrapper-error-class");
    }

    // 3. Native HTML5 :invalid (required + empty)
    for (const el of document.querySelectorAll("input:invalid, select:invalid, textarea:invalid")) {
      if (el.offsetParent !== null && !found.has(el)) found.set(el, "native-invalid");
    }

    // 4. Visible error/alert text nodes — trace back to their field
    for (const msg of document.querySelectorAll(
      '[class*="error-message"], [class*="errorMessage"], [class*="validation-error"], ' +
      '[class*="field-message"], [role="alert"]'
    )) {
      if (msg.offsetParent === null || !(msg.innerText || "").trim()) continue;
      const container = msg.closest(
        '[class*="field"], [class*="form-group"], [class*="input-group"], li, fieldset'
      );
      if (!container) continue;
      const field = container.querySelector(
        'input:not([type=hidden]):not([type=submit]):not([type=button]), ' +
        'select, textarea, [role="combobox"], [aria-haspopup="listbox"]'
      );
      if (field && !found.has(field)) found.set(field, "error-msg-nearby");
    }

    return Array.from(found.keys());
  }

  // Fix a single errored field using profile data or sensible fallbacks.
  async function fixSingleError(el, profile) {
    const ctx = getElementContext(el).toLowerCase();

    // ── Native <select> ──────────────────────────────────────────────────────
    if (el.tagName === "SELECT") {
      const opts = Array.from(el.options).filter(o => o.value !== "" && o.index !== 0);
      if (!opts.length) return;
      const m = getMappings(profile);
      for (const { kw, val } of m.selects) {
        if (val && matchKeywords(ctx, kw)) {
          if (!selectBestOption(el, val)) applyNativeSelect(el, opts[0]);
          return;
        }
      }
      const yes = opts.find(o => /^yes/i.test(o.text.trim()));
      applyNativeSelect(el, yes || opts[0]);
      return;
    }

    // ── Radio button ─────────────────────────────────────────────────────────
    if (el.type === "radio") {
      const group = Array.from(
        document.querySelectorAll(`input[type="radio"][name="${CSS.escape(el.name)}"]`)
      );
      const yes = group.find(r => {
        const lbl = document.querySelector(`label[for="${CSS.escape(r.id)}"]`);
        return /^yes/i.test((lbl?.innerText || r.value || "").trim());
      });
      (yes || group[0])?.click();
      return;
    }

    // ── Text input / Textarea ────────────────────────────────────────────────
    if ((el.tagName === "INPUT" && el.getAttribute("role") !== "combobox") || el.tagName === "TEXTAREA") {
      if (el.value && el.value.trim().length > 0) return; // already has content
      const m = getMappings(profile);
      for (const { kw, val } of m.inputs) {
        if (val && matchKeywords(ctx, kw)) {
          setNativeValue(el, String(val));
          return;
        }
      }
      // Generic fallback
      const fallback = el.tagName === "TEXTAREA"
        ? (profile.elevatorPitch || profile.greatestStrength || "Experienced professional.")
        : (profile.firstName || "");
      if (fallback) setNativeValue(el, fallback);
      return;
    }

    // ── Custom dropdown (React-Select / combobox) ────────────────────────────
    let control = null;
    if (el.getAttribute("role") === "combobox") {
      control = el.closest('[class*="__control"]') || el.parentElement?.parentElement;
    } else if (el.getAttribute("aria-haspopup") === "listbox") {
      control = el;
    }
    if (control && control !== el && control.tagName !== "SELECT") {
      control.click();
      await sleep(500);
      const menu =
        control.parentElement?.querySelector('[role="listbox"]') ||
        document.querySelector('[role="listbox"]:not(.pac-container *)') ||
        document.querySelector('[class*="select__menu"]');
      if (menu) {
        const opts = Array.from(menu.querySelectorAll('[role="option"]'))
          .filter(o => o.offsetParent !== null);
        if (opts.length) { opts[0].click(); await sleep(200); return; }
      }
      document.body.click();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // MASTER ORCHESTRATOR — fill passes + validation retry loop
  // ═══════════════════════════════════════════════════════════════════════════════
  async function runAllFillPasses(profile) {
    let count = 0;
    showStatus("Filling text fields...");
    count += runStructuredFill(profile);
    showStatus("Filling dropdowns...");
    try { count += await fillReactSelects(profile); } catch (e) { console.warn("[EazyApply] React-Select error:", e); }
    try { count += await confirmAutocompleteSuggestions(); } catch (e) { }
    showStatus("AI answering custom questions...");
    try { count += await runAIPass(profile); } catch (e) { console.warn("[EazyApply] AI pass error:", e); }
    try { count += await fillResumeUpload(); } catch (e) { }
    count += fallbackFillSelects();
    count += fallbackFillRadios();
    try { await sleep(400); count += await confirmAutocompleteSuggestions(); } catch (e) { }
    try { count += await fallbackFillReactSelects(); } catch (e) { console.warn("[EazyApply] fallbackReactSelect error:", e); }
    count += fallbackFillCheckboxes(profile);
    return count;
  }

  async function fillForms(profile) {
    const platform = detectPlatform();
    let count = 0;

    // ── Initial fill ────────────────────────────────────────────────────────
    showStatus("Starting fill...");
    count += await runAllFillPasses(profile);

    // ── Validation retry loop ───────────────────────────────────────────────
    const MAX_STEPS = 5;
    const MAX_RETRIES = 3;

    for (let step = 0; step < MAX_STEPS; step++) {
      await sleep(600);
      const btn = findNextOrSubmitButton();
      if (!btn) {
        console.log("[EazyApply] No Next/Submit button found — stopping");
        break;
      }

      const btnLabel = (btn.innerText || btn.textContent || btn.value || "button").trim();
      showStatus(`Clicking "${btnLabel}"...`);
      console.log(`[EazyApply] Step ${step + 1}: clicking "${btnLabel}"`);

      let advanced = false;

      for (let retry = 0; retry < MAX_RETRIES; retry++) {
        btn.click();
        await sleep(1500); // let validation render

        const errors = collectErrors();
        console.log(`[EazyApply] Step ${step + 1}, retry ${retry + 1}: ${errors.length} error(s)`);

        if (errors.length === 0) {
          advanced = true;
          break;
        }

        showStatus(`Fixing ${errors.length} error(s) (attempt ${retry + 1})...`);

        for (const field of errors) {
          try { await fixSingleError(field, profile); } catch (_) { }
        }
        await sleep(400);
      }

      if (!advanced) {
        console.log("[EazyApply] Could not clear errors — stopping retry loop");
        break;
      }

      // Fill any new fields that appeared on the new step
      await sleep(800);
      showStatus("Filling new step fields...");
      count += await runAllFillPasses(profile);

      if (!findNextOrSubmitButton()) break;
    }

    clearStatus();
    showToast(count, platform);
    return count;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // LIVE STATUS INDICATOR (shown while fill is in progress)
  // ═══════════════════════════════════════════════════════════════════════════════
  function showStatus(msg) {
    let el = document.getElementById("eazyapply-status");
    if (!el) {
      el = document.createElement("div");
      el.id = "eazyapply-status";
      el.style.cssText = `
        position:fixed;bottom:80px;right:20px;z-index:2147483647;
        background:#18181b;border:1px solid #3f3f46;color:#a1a1aa;
        border-radius:8px;padding:7px 14px;
        font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
        font-size:12px;font-weight:500;box-shadow:0 2px 12px rgba(0,0,0,.3);
        pointer-events:none;white-space:nowrap;
      `;
      document.body.appendChild(el);
    }
    el.textContent = "⚡ " + msg;
  }

  function clearStatus() {
    document.getElementById("eazyapply-status")?.remove();
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // TOAST NOTIFICATION
  // ═══════════════════════════════════════════════════════════════════════════════
  function showToast(count, platform) {
    document.getElementById("eazyapply-toast")?.remove();
    const ok = count > 0;
    const toast = document.createElement("div");
    toast.id = "eazyapply-toast";
    toast.style.cssText = `
      position:fixed;bottom:80px;right:20px;z-index:2147483647;
      background:#18181b;border:1px solid ${ok ? "#4ade8033" : "#f8717133"};
      color:${ok ? "#4ade80" : "#f87171"};border-radius:10px;padding:10px 16px;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      font-size:13px;font-weight:600;box-shadow:0 4px 24px rgba(0,0,0,.4);
      display:flex;align-items:center;gap:8px;pointer-events:none;
    `;
    toast.innerHTML = ok
      ? `⚡ <span>${count} field${count !== 1 ? "s" : ""} filled on ${platform}</span>`
      : `⚠️ <span>No fields filled — save your profile first</span>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // FLOATING ⚡ BUTTON
  // ═══════════════════════════════════════════════════════════════════════════════
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
    btn.onmouseenter = () => { btn.style.transform = "scale(1.12)"; btn.style.boxShadow = "0 6px 28px rgba(74,222,128,.65)"; };
    btn.onmouseleave = () => { btn.style.transform = "scale(1)"; btn.style.boxShadow = "0 4px 20px rgba(74,222,128,.45)"; };
    btn.onclick = async () => {
      btn.textContent = "⏳"; btn.style.background = "#fbbf24";
      chrome.runtime.sendMessage({ action: "GET_PROFILE" }, async (res) => {
        if (!res?.profile) {
          showToast(0, detectPlatform());
          btn.textContent = "⚡"; btn.style.background = "#4ade80"; return;
        }
        // Fill the main frame
        const count = await fillForms(res.profile);
        // Also fill any iframes on the page (e.g. Greenhouse demographics iframe).
        // background.js uses webNavigation.getAllFrames to send FILL_FORMS to each subframe.
        chrome.runtime.sendMessage({ action: "FILL_ALL_FRAMES" }, () => {
          chrome.runtime.lastError; // suppress unchecked error
        });
        btn.textContent = count > 0 ? "✓" : "⚠️";
        btn.style.background = count > 0 ? "#4ade80" : "#f87171";
        setTimeout(() => { btn.textContent = "⚡"; btn.style.background = "#4ade80"; }, 3000);
      });
    };
    document.body.appendChild(btn);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // MESSAGE LISTENER (from popup)
  // ═══════════════════════════════════════════════════════════════════════════════
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

  // ═══════════════════════════════════════════════════════════════════════════════
  // INIT + SPA NAVIGATION RE-INJECT
  // ═══════════════════════════════════════════════════════════════════════════════
  function init() {
    // When running inside an iframe (e.g. Greenhouse demographics iframe),
    // do NOT inject the ⚡ button — the main frame already has one.
    // The FILL_FORMS message listener above still works in iframes, so
    // background.js can reach this frame via FILL_ALL_FRAMES → getAllFrames.
    if (window !== window.top) {
      console.log("[EazyApply] iframe detected — skipping button, awaiting FILL_FORMS message");
      return;
    }
    injectButton();
  }
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