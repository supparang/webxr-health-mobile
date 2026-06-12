# BOSS_GATE_COMPLETION_DETECTION_FIX_v1z41

Fixes:
- Boss Gate 1 may remain locked even when S1-S3 appear completed.

Reason:
- v1z40 checked only a few completion fields.

Now recognized:
- state.sessions[sid].done/completed/bossDone
- state.bossCards[sid]
- portfolio / learningReports / reports / evidence / submissions / logs
- stars / xp-like fields
