## Prompt
Role: You are a senior Chrome extension developer.

Intent: Load all rule thresholds from rules.json at runtime using fetch(chrome.runtime.getURL('rules.json')). No hardcoded values in validation logic. Fallback defaults if fetch fails.

Constraints: Load on DOMContentLoaded. Use RULES object throughout. Ops team should be able to update thresholds by editing rules.json only.

## Result
Centralized all config in rules.json, loaded dynamically with fallback defaults.
