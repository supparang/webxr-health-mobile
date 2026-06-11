# AI_HELP_SESSION_SCOPE_FIX_v1z19

## Bug
Opening mission failed with `s is not defined`.

## Cause
`renderAIHelpBox(skill, sessionId)` used `s.id`, but `s` only exists inside mission render functions.

## Fix
`renderAIHelpBox` now uses only `sessionId` and `skill`.
