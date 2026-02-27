<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=6,11,20&height=170&section=header&text=EazyApply&fontSize=52&fontAlignY=35&animation=twinkling&fontColor=ffffff&desc=AI-Powered%20Job%20Application%20Auto-Filler&descAlignY=55&descSize=18" width="100%" />

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)](.)
[![Next.js](https://img.shields.io/badge/Next.js-15-000000?style=for-the-badge&logo=next.js&logoColor=white)](.)
[![Anthropic Claude](https://img.shields.io/badge/Claude_API-Powered-8B5CF6?style=for-the-badge&logo=anthropic&logoColor=white)](.)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-FF6D00?style=for-the-badge&logo=googlechrome&logoColor=white)](.)
[![Vercel](https://img.shields.io/badge/Vercel-Deployed-000000?style=for-the-badge&logo=vercel&logoColor=white)](.)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)

**Upload your resume once. One click to auto-fill any ATS job application.**

[Live Dashboard](#deploy) · [Install Extension](#chrome-extension-setup) · [Architecture](#architecture) · [Supported Platforms](#supported-ats-platforms)

</div>

---

## The Problem

Applying to jobs takes 30+ minutes per application — filling the same name, email, phone, work history, and demographic info into Greenhouse, Lever, LinkedIn, and Workday forms. Manually. Every. Single. Time.

## The Solution

**EazyApply** is a Chrome extension + Next.js dashboard that extracts your resume data once, then auto-fills job applications with a single ⚡ click. Claude AI handles open-ended custom questions.

```
Resume Upload → AI Extraction → Profile Stored → Visit Any Job Page → ⚡ Click → All Fields Filled
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js Dashboard                      │
│  ┌──────────┐  ┌──────────┐  ┌────────────────────────┐ │
│  │  Resume   │  │ Profile  │  │  /api/answer-question  │ │
│  │  Upload   │→ │  Editor  │  │  (Claude AI for custom │ │
│  │  + Parse  │  │  + Save  │  │   open-ended fields)   │ │
│  └──────────┘  └────┬─────┘  └────────────┬───────────┘ │
└─────────────────────┼─────────────────────┼─────────────┘
                      │ localStorage sync    │ AI answers
              ┌───────▼──────────┐           │
              │ dashboard-sync.js│           │
              │ (content script) │           │
              └───────┬──────────┘           │
                      │ chrome.storage.local │
              ┌───────▼──────────────────────▼─────┐
              │         Chrome Extension            │
              │  ┌─────────────┐  ┌──────────────┐ │
              │  │ content.js  │  │ background.js│ │
              │  │ ⚡ button   │  │ frame relay  │ │
              │  │ fill logic  │  │ msg broker   │ │
              │  └──────┬──────┘  └──────────────┘ │
              └─────────┼──────────────────────────┘
                        │ fills forms on
         ┌──────────────┼──────────────────────┐
         ▼              ▼            ▼         ▼
   ┌──────────┐  ┌───────────┐ ┌────────┐ ┌────────┐
   │Greenhouse│  │ LinkedIn  │ │ Lever  │ │Workday │
   │  + EEOC  │  │ Easy Apply│ │        │ │        │
   │ iframes  │  │  modals   │ │        │ │        │
   └──────────┘  └───────────┘ └────────┘ └────────┘
```

---

## Key Features

| Feature | Details |
|---------|---------|
| **One-Click Fill** | Inject ⚡ button on any ATS page, fills all fields instantly |
| **AI Custom Answers** | Claude API handles open-ended questions ("Why do you want to work here?") |
| **Resume Upload** | Base64 file injection into ATS upload widgets |
| **React-Select Support** | Handles Greenhouse demographic dropdowns (gender, ethnicity, veteran, disability) |
| **Cross-Frame Filling** | Fills EEOC/demographic forms inside same-origin iframes |
| **Validation Retry** | Clicks Submit, catches validation errors, re-fills, retries up to 3× |
| **SPA Navigation** | MutationObserver re-injects ⚡ button on URL changes |
| **React-Safe Setters** | Bypasses React/Angular state management with native property descriptors |

---

## Supported ATS Platforms

| Platform | Text Fields | Dropdowns | File Upload | Demographics | Status |
|----------|:-----------:|:---------:|:-----------:|:------------:|:------:|
| **Greenhouse** | ✅ | ✅ | ✅ | ✅ (React-Select) | Production |
| **LinkedIn Easy Apply** | ✅ | ✅ | ✅ | — | Production |
| **Lever** | ✅ | ✅ | ✅ | — | Production |
| **Workday** | ✅ | ✅ | ⚠️ | — | Beta |

---

## Quick Start

### Dashboard (Next.js)

```bash
git clone https://github.com/ajay-automates/eazyapply.git
cd eazyapply
npm install
cp .env.example .env.local   # Add your ANTHROPIC_API_KEY
npm run dev                   # http://localhost:3000
```

### Chrome Extension Setup

1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** → select the `extension/` folder
4. Navigate to the dashboard → fill your profile → save
5. Visit any Greenhouse/LinkedIn/Lever job page → click ⚡

---

## Extension File Structure

```
extension/
├── manifest.json         # Manifest V3 — permissions, content scripts, host permissions
├── background.js         # Service worker: stores profile, broadcasts fill to all frames
├── content.js            # Runs on job pages: injects ⚡ button, fills all form fields
├── dashboard-sync.js     # Runs on dashboard: syncs profile from localStorage → extension
├── popup.html/js         # Toolbar popup: status, fill button, dashboard link
└── icons/                # Extension icons (16/48/128px)
```

---

## Technical Deep Dives

### React-Select Automation (Greenhouse Demographics)

Greenhouse uses React-Select for EEOC dropdowns — not native `<select>` elements. Standard DOM manipulation fails because React manages state internally.

**Solution:** 3-level DOM walk from `input[role="combobox"]` → inputWrapper → valueContainer → Control div, then dispatch `mousedown`/`mouseup` events (React-Select uses `onMouseDown`, not `onClick`). Four cascading open methods ensure reliability across React-Select versions.

### Cross-Frame EEOC Filling

Greenhouse loads demographic sections in same-origin iframes. The ⚡ button exists in the main frame only.

**Solution:** After filling the main frame, `background.js` enumerates all subframes via `chrome.webNavigation.getAllFrames()` and sends `FILL_FORMS` messages with `{ frameId }` targeting.

### React-Safe Value Injection

LinkedIn and Workday use React/Angular — setting `el.value` doesn't trigger framework change detection.

**Solution:** `setNativeValue()` uses `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set` and dispatches the full event chain: `focus → input → change → blur → keyup`.

### Unicode Normalization

Greenhouse renders curly apostrophes (`\u2019`) in options like "I don't wish to answer". Pattern matching against straight apostrophes fails silently.

**Solution:** `norm()` helper replaces all Unicode quote variants before string comparison, plus fallback logic that selects the last option (Greenhouse convention for decline/prefer-not-to-say).

---

## Data Flow

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
Fields filled → toast shown "N fields filled"
```

---

## Deploy

### Dashboard → Vercel

Connect this repo to Vercel. Set `ANTHROPIC_API_KEY` in environment variables. Automatic deployment on push.

### Extension → Chrome Web Store

Package the `extension/` folder as a `.zip` and submit to the Chrome Web Store developer dashboard.

---

## Known Limitations & Roadmap

| Issue | Status |
|-------|--------|
| Multi-select dropdowns (ethnicity "mark all that apply") | Planned |
| LinkedIn Easy Apply multi-step modal retry tuning | In Progress |
| Newer Workday `data-automation-id` selectors | Monitoring |
| Drag-and-drop-only upload widgets | Investigating |

---

## Tech Stack

`Next.js 15` `React 19` `TypeScript` `Anthropic Claude API` `Chrome Extension Manifest V3` `Vercel` `Tailwind CSS`

---

## Related Projects

| Project | Description |
|---------|-------------|
| [Job Application Automator MCP](https://github.com/ajay-automates/job-application-automator-mcp) | MCP server for fully autonomous job applications |
| [AI Voice Agent](https://github.com/ajay-automates/ai-voice-agent) | Voice-powered document Q&A with Whisper + GPT-4o |
| [Social Media Automator](https://github.com/ajay-automates/social-media-automator) | Multi-platform social media SaaS with 6 AI agents |

---

<div align="center">

**Built by [Ajay Kumar Reddy Nelavetla](https://github.com/ajay-automates)**

*Reducing job application time from 30+ minutes to under 60 seconds.*

<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=6,11,20&height=100&section=footer" width="100%" />

</div>
