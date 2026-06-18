CSAI2102 AI Quest — Current Used JS for index.html + teacher.html

Target upload path:
  /ai-quest/js/

This bundle includes:
1) Direct JS files referenced by /ai-quest/index.html
2) Direct JS files referenced by /ai-quest/teacher.html
3) Current v3.6.0 runtime bank/support JS that those files load/use dynamically
4) v3.6.4 S1 AR files:
   - aiquest-s1-ar-practice-v364.js
   - aiquest-s1-ar-hand-hotfix-v364.js

Included JS files: 37

Important:
- Upload/replace the contents of ai-quest/js/ into repo path /ai-quest/js/
- This avoids guessing among old v312-v360 files.
- The file that caused 404 is included:
  aiquest-s1-ar-hand-hotfix-v364.js

Test:
  /ai-quest/index.html?session=s1&v=20260617-current-used-js
  /ai-quest/teacher.html?teacher=1&v=20260617-current-used-js

Expected S1 AR console:
  [AIQuest] v3.6.4-s1-ar-inline-session-ui loaded
  [AIQuest] v3.6.4-s1-ar-hand-next-support-universal loaded
