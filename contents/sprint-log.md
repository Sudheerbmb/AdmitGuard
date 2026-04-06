# Sprint Log — AdmitGuard

## sprint-0: project setup and research notes
- Initialized repo structure
- Created manifest.json with MV3 config
- Defined rules.json with all eligibility thresholds
- Researched Chrome Extension APIs: chrome.storage.local, chrome.runtime.getURL
- Identified 11 required form fields and rule types

## sprint-1: base form with 11 fields
- Built popup.html with all 11 fields
- Sections: Personal Info, Academic Info, Assessment & Interview
- Offer Letter field conditionally shown based on Interview Status
- Applied dark theme with Space Mono + DM Sans typography

## sprint-1: strict validation for all rules
- Name: min 2 chars, no numbers
- Email: regex format + uniqueness check against stored submissions
- Phone: 10 digits, starts with 6/7/8/9
- Aadhaar: exactly 12 digits
- Interview "Rejected" → blocked banner, submit disabled
- Qualification: required dropdown

## sprint-2: soft rules with exception system
- Age, Graduation Year, Percentage/CGPA, Screening Score → soft rules
- Violation shows exception toggle per field
- Toggle reveals rationale textarea
- Rationale: ≥30 chars + must contain keyword from approved list
- Keyword chips highlight green when matched in rationale

## sprint-3: configurable rules engine
- All thresholds loaded from rules.json at runtime via fetch()
- Exception keywords loaded from config
- Rationale minimum length from config
- Exception limit from config
- Ops team can update rules.json without touching any JS

## sprint-3: audit log with persistence
- audit.html + audit.js built as standalone extension page
- Stats bar: total, flagged, with exceptions, today
- Search by name/email, filter by flagged/clean
- Detail modal with full submission data including rationale
- CSV export with timestamp
- Clear all with confirmation

## sprint-4: ui polish and final testing
- Flagged indicator shows when active exceptions exceed limit
- Exception counter in footer
- Success overlay with flagged warning if applicable
- New Entry button resets form completely
- Tested: clean submission, exception flow, blocked rejection, flagged submission
