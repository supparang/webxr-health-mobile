AI Quest v3.8.3 — S2 AR button click hotfix

Upload:
  /ai-quest/js/aiquest-s2-ar-click-hotfix-v383.js

Then add ONE line at the very end of index.html, after aiquest-s2-ar-entry-v381.js:
<script src="./js/aiquest-s2-ar-click-hotfix-v383.js?v=20260627-s2click383"></script>

Test:
  /ai-quest/index.html?session=s2&v=20260627-s2click383

Expected:
  Clicking "เริ่ม AR Practice" opens:
  /ai-quest/index.html?session=s2&ar=hand&from=s2&v=20260627-s2ar383
