# EazyApply

AI-powered Chrome extension that auto-fills job applications. Upload your resume, we extract everything. One click to fill any ATS form.

## Getting Started

```bash
npm install
npm run dev
```

Add your Anthropic API key to `.env.local`:
```
ANTHROPIC_API_KEY=sk-ant-...
```

## Deploy

Connect this repo to Vercel for automatic deployment.

---

## Chrome Extension

The `extension/` folder contains a **Manifest V3** Chrome extension that auto-fills job applications on Greenhouse, LinkedIn, Lever, and Workday.

### Extension File Structure

```
extension/
  manifest.json       — permissions, content_scripts, host_permissions
  background.js       — service worker: stores profile, broadcasts fill to all frames
  content.js          — runs on job pages: injects ⚡ button, fills all form fields
  dashboard-sync.js   — runs on dashboard: syncs profile/resume from localStorage to extension
  popup.html/js       — toolbar popup: status, fill button, dashboard link
  icons/              — icon16/48/128.png
```

### Data Flow

```
User fills profile on dashboard (Next.js app)
        ↓
dashboard-sync.js intercepts localStorage.setItem("eazyapply_profile")
        ↓
Syncs directly to chrome.storage.local
        ↓
User visits Greenhouse / LinkedIn / Lever / Workday job page
        ↓
content.js injects ⚡ button (main frame only)
        ↓
User clicks ⚡ → content.js reads profile from chrome.storage.local
        ↓
Runs all fill passes on main frame + broadcasts FILL_FORMS to all iframes
        ↓
Fields filled, toast shown "N fields filled"
```

### Testing Locally

1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** → select the `extension/` folder
4. Note the Extension ID shown
5. Go to the dashboard → fill profile → save
6. Go to any Greenhouse job page → click ⚡

---

## Extension Development Log

### What Works

- ✅ Profile sync from dashboard → extension storage (via `dashboard-sync.js`)
- ✅ Text inputs filled on Greenhouse, LinkedIn, Lever, Workday (name, email, phone, links, address, etc.)
- ✅ Native `<select>` dropdowns filled (keyword-matched + fallback to first option)
- ✅ Radio buttons filled (work authorization, sponsorship, relocation)
- ✅ Resume upload (base64 → File → DataTransfer injection)
- ✅ AI pass for custom open-ended questions (via `/api/answer-question` endpoint)
- ✅ **Greenhouse demographic React-Select dropdowns** — gender, transgender, sexual orientation, ethnicity, veteran status, disability (see challenges below)
- ✅ Validation retry loop: clicks Next/Submit, collects errored fields, refills them, retries up to 3×
- ✅ SPA navigation re-inject (MutationObserver watches URL changes)

### Challenges and How They Were Fixed

#### 1. React-Select dropdowns (Greenhouse demographics)

Greenhouse's demographic section uses **React-Select** (a JavaScript custom dropdown library), not native `<select>` elements. Native DOM manipulation (`el.value = ...`) does not work on React-Select.

**What makes React-Select hard to automate:**
- The visible "select box" is a `div`, not a `<select>` element
- The actual `<input role="combobox">` is hidden inside nested divs
- Opening the menu requires simulating real user interaction (mousedown events), not just `.click()`
- React 16+ uses synthetic events attached at the document root — native events must bubble correctly to trigger them
- The listbox (`[role="listbox"]`) only appears in the DOM when the menu is open
- `aria-controls` (which points to the listbox ID) is only set in React-Select v5 when the menu is **already open**, not when closed

**Attempt 1 — Strategy-based CSS class walking (removed)**
Walked up from inputs looking for `[class*="container"]`, `[class*="control"]` etc. Failed because Greenhouse uses hashed CSS class names like `css-abc123-control`, and the container selector matched a div wrapping ALL the demographic dropdowns at once.

**Attempt 2 — Text scan for "Select…" placeholders (removed)**
Queried all elements whose text matched "Select..." to find unfilled dropdowns. Found 74 false-positive controls (any div containing the text "Select").

**Attempt 3 — `input[role="combobox"]` iteration (2-level walk)**
Iterated all `input[role="combobox"]` elements directly. Walked up 2 levels to get the "control" div. **Bug:** the walk was one level too shallow:

```
input[role="combobox"]
  └── input.parentElement         → InputWrapper div  ← code called this "valueContainer"
  └── .parentElement              → ValueContainer    ← code called this "control" (WRONG)
  └── .parentElement              → Control div       ← actual React-Select Control
        └── IndicatorsContainer
              └── DropdownIndicator [aria-hidden="true"]
                    └── svg
```

Because `control` was actually `ValueContainer`, `control.querySelector('[aria-hidden="true"] svg')` found **nothing** (the indicator SVG is a sibling of ValueContainer, not inside it). Result: `indicator: false`, and `.click()` on ValueContainer wasn't reaching React-Select's `onMouseDown` handler on the real Control div.

**Attempt 4 — Correct 3-level walk + mousedown dispatch (current, working)**
Fixed the walk to 3 levels: `input → inputWrapper → valueContainer → control`. The Control div's `querySelector('[aria-hidden="true"] svg')` now correctly finds the indicator arrow. Changed event dispatch from `.click()` to `mousedown`+`mouseup` (React-Select uses `onMouseDown` to toggle the menu, not `onClick`). Four cascading open methods:
- Method A: `mousedown` on indicator SVG
- Method B: `mousedown` on the Control div
- Method C: `focus` + `ArrowDown` keydown on the input
- Method D: plain `.click()` as last resort

#### 2. Demographic form is in an iframe (Greenhouse)

The ⚡ button is injected in the **main frame** of the page. Greenhouse loads the demographic section (EEOC questions) inside a **same-origin iframe** embedded in the application page.

**Symptom:** Main frame's `fillReactSelects` found 16 combobox inputs (phone country code dropdowns, location search, etc.) but never found gender/race/veteran/disability — those labels were in the iframe's DOM, not the main frame's.

**Fix:**
1. Added `"webNavigation"` to permissions in `manifest.json`
2. In `content.js` `init()`: skip injecting the ⚡ button when `window !== window.top` (iframes don't need their own button; the `FILL_FORMS` message listener still works)
3. In ⚡ button `onclick`: after filling the main frame, also send `FILL_ALL_FRAMES` to background
4. In `background.js`: `FILL_ALL_FRAMES` handler uses `chrome.webNavigation.getAllFrames()` to enumerate every subframe of the active tab, then sends `{ action: "FILL_FORMS" }` to each one with `{ frameId }` targeting

#### 3. False-positive "stale listbox" detection

After opening a React-Select dropdown, the code used `document.querySelector('[role="listbox"]')` to find the newly-opened menu. On Greenhouse's application page, a Google Places autocomplete widget also renders a `[role="listbox"]` that is always present in the DOM (for the location/address field).

**Fix:** Snapshot all existing `[role="listbox"]` elements **before** opening each dropdown (`preExisting = new Set(...)`). `findNewMenu()` then checks for newly-appeared listboxes by comparing against the snapshot.

#### 4. React-safe value setter for Angular/React inputs

LinkedIn and Workday use React/Angular — simply setting `el.value = "..."` does not trigger framework change detection, so the field appears filled visually but submits as empty.

**Fix:** `setNativeValue(el, value)` uses the native property descriptor setter and dispatches `focus`, `input`, `change`, `blur`, and `keyup` events:

```js
function setNativeValue(el, value) {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype, 'value'
  ).set;
  setter.call(el, String(value));
  el.dispatchEvent(new Event("focus", { bubbles: true }));
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  el.dispatchEvent(new Event("blur", { bubbles: true }));
  el.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
}
```

#### 5. Resume upload — base64 field name mismatch

Dashboard stored resume as `{ name, type, data: "<base64>" }` but `content.js` was reading `resumeData.base64` (undefined).

**Fix:** `const b64 = resumeData?.base64 || resumeData?.data;`

#### 6. `aria-controls` is null on closed React-Select v5 inputs

React-Select v5 only sets `aria-controls` on the input when the menu is **open**. Before opening, `input.getAttribute('aria-controls')` returns null, so we can't pre-look-up the listbox ID.

**Fix:** `listboxId` is still read (in case it's set), but `findNewMenu()` uses the pre-existing snapshot as primary detection. The listboxId path is a fast-path bonus when available.

#### 7. Curly apostrophe in option text ("I don\u2019t wish to answer")

Greenhouse renders option text with Unicode curly apostrophes (`\u2019`, right single quotation mark) — e.g., "I don't wish to answer". Our decline patterns used straight apostrophes (`'`), so `"i don't"` never matched `"i don\u2019t wish to answer"`. This caused "decline" desired values to fall through all pattern checks and pick the **first option** (often "Yes, I am a veteran").

**Fix:** Added a `norm()` helper that replaces `\u2018/\u2019/\u201a/\u201b` → `'` and `\u201c/\u201d` → `"` before any string comparison. Applied to both `fillReactSelects` and `selectBestOption`.

Also added additional fallbacks for decline-intent values:
- Step 4: find options starting with "No" or "I am not"
- Step 5: pick the **last option** (Greenhouse puts decline/prefer-not-to-say last)

#### 8. "Stuck" React Selects & Missed Checkboxes (Update: Spring 2026)

Custom Greenhouse dropdowns ("National pay range", "Based in the USA", "Work Authorization", and "Visa Sponsorship") were constructed using a notoriously difficult combination of hidden native HTML `<select>` elements overlaid with React's strict state management. Our script was technically "answering" the questions in the background DOM, but React was aggressively rejecting the changes and overriding them back to "Select..." visually.

**Fix:** 
1. **React State Override (`setNativeValue`):** Rewrote the underlying DOM manipulation function to force React to acknowledge changes made to `<select>` tags by safely hijacking `window.HTMLSelectElement.prototype.set`.
2. **Aggressive AI Fallback Engine:** Implemented a new `fallbackFillReactSelects` and `fallbackFillCheckboxes` pipeline. Now, if the AI cannot find a perfect semantic match for a custom question, it triggers a fallback that forces the menu open, scans the options, and defaults to selecting the top positive answer (e.g., "Yes") instead of leaving it blank.

### Known Remaining Issues / TODO

- **Multi-select dropdowns** (ethnicity "mark all that apply"): our code picks one option and closes the menu; multiple selections not yet supported
- Some dropdowns on Greenhouse are multi-select (ethnicity can be "mark all that apply") — our code picks one option; multi-select support needed
- LinkedIn Easy Apply is a multi-step modal — validation retry loop needs tuning for modal-based multi-step flows
- Workday's `data-automation-id` selectors may need updating for newer Workday versions
- File upload for resume doesn't work on some ATS platforms that use their own upload widgets (drag-and-drop only, not `<input type="file">`)
