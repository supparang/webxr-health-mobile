# AI Quest AR Complete v4.0.5 — Deploy Bundle

## Replace these files in `/ai-quest/`

- `index.html`
- `js/aiquest-ar-runtime-v405.js`
- `js/aiquest-s1-ar-entry-v387.js`
- `js/aiquest-s2-ar-route-fix-v386.js`
- `js/aiquest-s2-ar-entry-v405.js`
- `js/aiquest-s2-ar-practice-v405.js`
- `js/aiquest-ar-final-route-v401.js`

## What this release fixes

1. S2 legacy routes (`ar=hand`, `ar=s2`, `ar=practice`) normalize to `ar=agent` before Runtime starts.
2. Runtime v4.0.5 recognizes `ar=agent`, then loads only S2 Agent Builder AR.
3. S1 and S2 AR practice cards persist after normal session re-renders.
4. Direct AR URLs no longer immediately terminate Runtime when underlying Session 1/2 opens.
5. S2 AR uses 3 easy hand lanes, 1.2-second dwell, pinch, mouse/touch fallback, and 18 FPS inference cap.
6. Main S1/S2 score is unchanged; supplementary AR evidence is included in `extraJson.s1ArPractice` or `extraJson.s2ArPractice` when the main session result is sent.
7. AR close removes only the AR query parameters and returns to the already-open normal session page.

## Existing files retained from the project

Runtime v4.0.5 still loads these existing S1 modules on a direct S1 AR route:

- `js/aiquest-s1-ar-practice-v364.js`
- `js/aiquest-s1-ar-hand-hotfix-v364.js`

Do not delete them. This ZIP replaces the current AR integration layer and the complete S2 AR engine, while retaining all unrelated course, bank, storage, cloud logger, and teacher dashboard files already in the repository.

## Test URLs

- S1 AR: `index.html?session=s1&ar=hand`
- S2 AR: `index.html?session=s2&ar=agent`
- Legacy S2 route (must normalize): `index.html?session=s2&ar=hand`

## Acceptance checks

- Open S1/S2 normal session and verify its AR card remains after questions render.
- Start AR, grant camera permission, use hand dwell/pinch and mouse/touch fallback.
- Close AR and verify camera indicator clears and URL no longer contains `ar=`.
- Finish S2 AR, complete S2 main result, and verify `extraJson.s2ArPractice` is present in the submitted payload / Sheets record.
