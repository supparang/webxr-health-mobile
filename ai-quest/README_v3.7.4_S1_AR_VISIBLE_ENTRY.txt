CSAI2102 AI Quest — v3.7.4 S1 AR Visible Entry

Upload:
  /ai-quest/js/aiquest-s1-ar-entry-v374.js

Then add this one script line AFTER the existing S1 AR Result Bridge script
at the bottom of /ai-quest/index.html:

<script src="./js/aiquest-s1-ar-entry-v374.js?v=20260627-s1ar-entry374"></script>

Outcome:
- A clear “📷 AI Object Scanner” AR Practice card appears under the S1 title.
- It clearly says it is supplementary and does not affect S1 main score or pass.
- “เริ่ม AR Practice” opens the correct hand-enabled AR route.
- After completion, normal S1 shows the saved AR score and offers replay.
- No Apps Script / Teacher / scoring changes.

Test:
  /ai-quest/index.html?session=s1&v=20260627-s1entry374
