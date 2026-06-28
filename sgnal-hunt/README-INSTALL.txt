UX Quest — Act I Storage-Safe Complete Update (2026-06-28)

PURPOSE
This is the full updated Act I source set for the existing deployment folder:
  /sgnal-hunt/

It fixes the browser error:
  QuotaExceededError: Setting the value of 'uxq.recent.w2.v1' exceeded the quota

WHAT CHANGED
- New shared assets use versioned v2 / v15 filenames, so browsers do not reuse the old cached engine.
- Case-history storage is limited to four case IDs only.
- All game data now uses a safe fallback chain:
  localStorage → sessionStorage → in-memory.
  A full localStorage quota can no longer prevent W1, W2, W3, or B1 from starting.
- When localStorage is full, progress remains available through the current browser tab via sessionStorage, allowing W1 → W2 → W3 → B1 to continue normally.
- Existing v1 progress is read once and migrated automatically on the next saved mission result.
- Mission attempt history is capped at three concise summaries.
- Mission Control now reads through the same safe progress layer and clears only UX Quest keys when reset.

FILES TO UPLOAD (KEEP THIS FOLDER STRUCTURE)
/sgnal-hunt/
  index.html
  w1-ux-crisis-casefile.html
  w2-design-thinking-sprint.html
  w3-cognitive-load-escape.html
  b1-cognitive-storm.html
  /js/
    uxq-progress-v2.js
    uxq-mission-engine-v2.js
    uxq-hub-casefile-v15.js

IMPORTANT
- Upload / overwrite every file in this package into the existing /sgnal-hunt/ folder.
- Keep the existing /sgnal-hunt/css/uxq-core.css and /sgnal-hunt/css/uxq-hub.css files. They are unchanged dependencies of Mission Control.
- Older v1 / v14 JavaScript files may remain on the server; the updated HTML pages no longer call them.
- Do not rename the deployed folder to “signal-hunt”; the current live project path is “sgnal-hunt”.

QUICK TEST
1. Open /sgnal-hunt/index.html and press “เริ่มภารกิจ”.
2. Complete W1 with 2★ or more.
3. Return to Mission Control and open W2.
4. Confirm there is no red QuotaExceededError in Console.
5. Test one replay of W2; its introductory case should vary and the option positions should shuffle.

OPTIONAL CLEANUP
No manual localStorage clearing is required because this update uses v2 keys. To reset only UX Quest progress, use “รีเซ็ตความคืบหน้า Act I” in Mission Control.
