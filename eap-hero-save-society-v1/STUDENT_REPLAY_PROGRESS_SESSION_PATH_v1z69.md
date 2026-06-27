# v1z69 — Student Replay + Progress Session Path

## Screenshot bug fixed
The completed Reading card showed a green tick but its Replay button was absent.

Cause:
Student UI Lock treated the word “Replay” as an advanced-menu label and hid the student mission button.

## Fixes
- Student mission launch buttons are exempt from the advanced-menu filter.
- Completed Core/Support cards always show Replay <Skill>.
- Completed cards show best evidence score and number of attempts.
- Session header shows true progress, for example: 1/2 skills complete.
- Self-Practice explanation is condensed to a single non-duplicated line.
- Core and Support remain the two full-width self-practice cards.
