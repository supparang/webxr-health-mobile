CSAI2102 AI Quest — v3.7.3 S1 AR Auto Event Sync

WHY THE PREVIOUS FLOW DID NOT SHOW DATA
The completed S1 AR score was saved only in browser localStorage. The older bridge
waited for a later normal S1 attempt, so AR alone did not create a Google Sheets row.
The Teacher screen correctly stayed empty because no server record existed.

THIS RELEASE
- Automatically sends one `s1_ar_complete` event immediately after AR completes.
- Sends to the existing `session_events` sheet through `sync_v23 / kind=event`.
- Teacher Dashboard reads that event from the existing Server Summary `recentEvents`.
- Does NOT add a session_attempt and does NOT change:
  - Attempts = 54
  - S1 latest/best score
  - S1 main accuracy
  - mastery / gates

UPLOAD ONLY THESE 2 FILES (replace existing)
1) /ai-quest/js/aiquest-s1-ar-result-bridge-v369.js
2) /ai-quest/js/aiquest-teacher-s1-ar-analytics-v371.js

NO index.html CHANGE
NO teacher.html CHANGE
NO Apps Script CHANGE
NO NEW DEPLOYMENT REQUIRED

TEST
1) Upload both files.
2) Re-open the S1 AR URL. The stored 6/6 result will be detected automatically
   and queued as an `s1_ar_complete` event. (If localStorage was cleared, replay once.)
3) Student Console should show:
   [AIQuest S1 AR Sync] queued s1_ar_complete event
4) Wait 3–5 seconds.
5) Open teacher.html and press Refresh.
6) S1 AR Practice card should list: 12 / KK, 100%, 6/6.

If it still does not appear, use the new console log line as evidence of whether
the event left the browser. No need to play normal S1 again.
