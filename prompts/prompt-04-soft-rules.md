## Prompt
Role: You are a senior Chrome extension developer.

Intent: Add soft rule validation for Age (18-35), Graduation Year (2015-2025), Percentage ≥60 or CGPA ≥6.0, Screening Score ≥40. When violated, show exception toggle. Toggle reveals textarea for rationale.

Constraints: Rationale must be ≥30 chars and contain at least one keyword: "approved by", "special case", "documentation pending", "waiver granted". Show keyword chips that highlight green when matched. Show rationale error inline.

## Result
Built exception system with per-field toggle, rationale validation, and keyword chip highlighting.
