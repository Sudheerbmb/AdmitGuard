## Prompt
Role: You are a senior Chrome extension developer.

Intent: Add flagging logic. If more than 2 exceptions are active at submission time, mark the submission as flagged=true. Show a warning indicator when exception count exceeds limit. Display exception counter in footer.

Constraints: Read exception_limit from rules.json. Update counter live as toggles are activated.

## Result
Implemented live exception counter, flag indicator, and flagged field in submission object.
