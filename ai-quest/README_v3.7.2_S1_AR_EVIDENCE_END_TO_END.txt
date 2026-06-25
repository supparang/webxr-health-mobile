CSAI2102 AI Quest — v3.7.2 S1 AR Evidence End-to-End Fix

What the inspection found
- index.html already loads aiquest-s1-ar-result-bridge-v369.js correctly.
- The remaining loss occurs because the student slim payload did not explicitly keep
  s1ArPractice, and the Apps Script teacherConsole response removes sessionId,
  missionId, and all AR evidence from its attempts list.

This patch repairs both ends.

FILES IN THIS ZIP
1) aiquest_patch/index.html
   - Full replacement of the uploaded current index.html.
   - compactAttemptForSync() now explicitly puts:
     extraJson.s1ArPractice
     into the slim S1 payload before Google Sheets sync begins.
   - Console output adds:
     s1ArPractice: true

2) aiquest_patch/Code.gs_v3.7.2_PATCH.txt
   - Paste the helper functions before buildTeacherConsole_().
   - Replace just the attempts mapping block in buildTeacherConsole_().
   - This returns only safe S1 AR summary fields to Teacher Dashboard:
     score, correct/total, help, time, input, completion time.
   - It does not return the entire raw payload.

INSTALL ORDER
A) Replace /ai-quest/index.html with the patched file.
B) Apply the Code.gs patch and change APP_VERSION to v3.7.2.
C) Apps Script: Deploy > Manage deployments > Edit > New version > Deploy.
D) Hard reload student and teacher pages.

TEST
1) Open S1 AR, finish all 8 objects.
2) Return to S1.
3) Complete and save an S1 result.
4) In student Console find:
   [AIQuest] Google Sheets slim payload ... s1ArPractice: true
5) Refresh teacher.html.
6) S1 AR Practice should show the real row.

Important
- Old attempts cannot be retrofilled because they were already stored without AR evidence.
- AR is supplementary; it does not overwrite S1 score or main accuracy.
