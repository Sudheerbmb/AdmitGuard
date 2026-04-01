## Prompt
Role: You are a senior Chrome extension developer.

Intent: Add strict validation to popup.js. Rules: Name ≥2 chars no numbers, Email valid format + unique, Phone 10 digits starting 6-9, Aadhaar exactly 12 digits, Interview Rejected = block submission entirely.

Constraints: Inline red error messages. Validate on blur. Block submit button when interview is Rejected. Show blocked banner with reason.

Example: Valid phone 9876543210. Invalid: 1234567890 (starts with 1), 98765 (too short).

## Result
Implemented all strict validators with inline errors, blocked banner, and submit guard.
