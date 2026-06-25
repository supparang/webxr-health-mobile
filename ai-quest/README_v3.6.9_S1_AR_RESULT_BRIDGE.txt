CSAI2102 AI Quest — v3.6.9 S1 AR Result Bridge

Purpose
- S1 AR is supplementary practice.
- Its score must NOT overwrite S1 main score or main accuracy.
- Its evidence must travel with the next S1/M1 submission to Google Sheets.

Upload:
1) Upload this new file:
   /ai-quest/js/aiquest-s1-ar-result-bridge-v369.js

2) In /ai-quest/index.html, add this one script tag immediately AFTER:
   aiquest-s1-ar-practice-v364.js
   aiquest-s1-ar-hand-hotfix-v364.js

   <script src="./js/aiquest-s1-ar-result-bridge-v369.js?v=20260625-s1ar-result369"></script>

What will be attached to the S1 slim Google Sheets payload:
- arCompleted
- arActivity
- arSupplementary = true
- arScore / arAccuracy
- arCorrect / arTotal
- arHelpUsed / arUsedSec
- arInputMode
- extraJson.s1ArPractice

The browser console should show:
[AIQuest] v3.6.9-s1-ar-result-bridge loaded
[AIQuest S1 AR Bridge] wrapped AIQuestSync.submitAttempt
[AIQuest S1 AR Bridge] attached AR evidence ...

Test path:
1) Play S1 AR until the AR summary appears.
2) Exit AR.
3) Finish S1 normally and submit the S1 result.
4) Check the outgoing Google Sheets request / Apps Script row.
