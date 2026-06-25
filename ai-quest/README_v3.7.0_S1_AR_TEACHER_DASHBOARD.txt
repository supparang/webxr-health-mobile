CSAI2102 AI Quest — v3.7.0 S1 AR Teacher Dashboard

Goal
Show genuine S1 AR Practice evidence in Teacher Dashboard, separately from S1 course score.

FILES TO UPLOAD
1) /ai-quest/js/aiquest-s1-ar-result-bridge-v369.js
2) /ai-quest/js/aiquest-teacher-s1-ar-analytics-v370.js

ONE-LINE CHANGES
A) /ai-quest/index.html
Add:
<script src="./js/aiquest-s1-ar-result-bridge-v369.js?v=20260625-s1ar-result369"></script>

B) /ai-quest/teacher.html
Add:
<script src="./js/aiquest-teacher-s1-ar-analytics-v370.js?v=20260625-s1ar-teacher370"></script>

WHAT THE STUDENT PAGE DOES
- Captures S1 AR completion only after a finished AR round.
- Attaches the following evidence to the next S1/M1 Google Sheets attempt:
  extraJson.s1ArPractice
  arCompleted, arScore, arAccuracy, arCorrect, arTotal,
  arHelpUsed, arUsedSec, arInputMode
- Does NOT replace main S1 score or main S1 accuracy.

WHAT THE TEACHER PAGE DOES
- Adds a new "S1 AR Practice" card below the overview.
- Shows only real server-returned AR records.
- Shows: learner, score, correct/total, help, time, input mode, completed time.
- Adds a compact S1 AR detail card in the selected learner's detail modal.
- Does not fabricate data. Before the first synced AR result, it states:
  "ยังไม่มี AR data จาก Server Summary"

TEST ORDER
1) Open S1 AR and finish one AR round.
2) Exit AR, finish S1 normally, and submit S1.
3) Open teacher.html and press Refresh.
4) The new S1 AR Practice card should show a learner row.

EXPECTED CONSOLE
Student:
[AIQuest] v3.6.9-s1-ar-result-bridge loaded
[AIQuest S1 AR Bridge] wrapped AIQuestSync.submitAttempt
[AIQuest S1 AR Bridge] attached AR evidence

Teacher:
[AIQuest] v3.7.0-s1-ar-teacher-dashboard loaded
