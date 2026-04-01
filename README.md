# AdmitGuard — Admission Data Validation & Compliance System

A Chrome Extension that enforces eligibility rules at the point of data entry, replacing unstructured Excel-based admission pipelines.

---

## Problem It Solves

- 40+ hrs/cohort wasted on ineligible candidates
- 15% rejection rate at doc verification — after everyone's time is spent
- Zero audit trail for exceptions and overrides
- Rules stored in Excel — painful to update between cohorts

---

## Features

- **11-field admission form** with real-time inline validation
- **Strict rules** — zero tolerance, block submission (phone format, Aadhaar, email uniqueness, interview rejection)
- **Soft rules** — exception toggle with structured rationale + keyword validation
- **Configurable rules** — all thresholds in `rules.json`, no code changes needed
- **Audit log** — every submission logged with timestamp, exceptions, flagged status
- **CSV export** — one click export for manager review
- **Flagging system** — auto-flags submissions with >2 exceptions

---

## Installation

1. Clone this repo
2. Open Chrome → `chrome://extensions`
3. Enable **Developer Mode** (top right)
4. Click **Load Unpacked** → select this folder
5. Click the AdmitGuard icon in your toolbar

---

## Configuration

Edit `rules.json` to update eligibility thresholds without touching code:

```json
{
  "age": { "min": 18, "max": 35 },
  "graduation_year": { "min": 2015, "max": 2025 },
  "percentage": { "min": 60 },
  "screening_score": { "min": 40 },
  "exception_limit": 2,
  "exception_keywords": ["approved by", "special case", "documentation pending", "waiver granted"]
}
```

---

## Project Structure

```
admitguard-extension/
├── manifest.json       # Extension config
├── popup.html          # Form UI
├── popup.js            # Validation + storage logic
├── audit.html          # Audit log viewer
├── audit.js            # Audit log rendering + export
├── rules.json          # Configurable eligibility rules
├── icons/
│   └── icon128.png
├── prompts/            # AI prompt documentation
├── docs/               # Wireframes, presentation
└── sprint-log.md       # Development log
```

---

## Tech Stack

- Vanilla JavaScript (no frameworks)
- Chrome Extension Manifest V3
- `chrome.storage.local` + `localStorage` for persistence
- Google Fonts (Space Mono + DM Sans)

---

## Evaluation Checklist

- [x] All 11 fields present
- [x] All strict rules enforced
- [x] All soft rules with exception toggle
- [x] Keyword validation in rationale
- [x] >2 exceptions → flagged
- [x] Audit log with timestamp, exceptions, flagged status
- [x] CSV export
- [x] rules.json config engine
- [x] Minimum 8 commits
