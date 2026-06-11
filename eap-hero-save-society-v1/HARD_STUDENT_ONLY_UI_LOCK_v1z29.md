# HARD_STUDENT_ONLY_UI_LOCK_v1z29

## Problem
Role Mode existed, but real buttons still appeared because the actual button markup did not match earlier patch patterns.

## Fix
- DOM cleanup after each layout
- Hide advanced menu by button text and onclick target
- CSS hard lock for student-only mode
- Force student mode default
