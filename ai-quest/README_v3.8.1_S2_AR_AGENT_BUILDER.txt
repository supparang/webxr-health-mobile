AI Quest v3.8.1 — S2 AR Agent Builder

Upload these files to /ai-quest/js/
- aiquest-s2-ar-entry-v381.js
- aiquest-s2-ar-practice-v381.js
- aiquest-s2-ar-result-bridge-v381.js
- aiquest-teacher-s2-ar-analytics-v381.js

Add to index.html after the S1 AR scripts:
<script src="./js/aiquest-s2-ar-practice-v381.js?v=20260627-s2ar381"></script>
<script src="./js/aiquest-s2-ar-result-bridge-v381.js?v=20260627-s2ar381"></script>
<script src="./js/aiquest-s2-ar-entry-v381.js?v=20260627-s2ar381"></script>

Add to teacher.html after the existing S1 AR analytics script:
<script src="./js/aiquest-teacher-s2-ar-analytics-v381.js?v=20260627-s2ar381"></script>

S2 AR covers PEAS, percept, actuator, environment and rational agent.
It saves `s2_ar_complete` as a supplementary session_events record.
It does not change S2 main score, attempts, mastery, or gates.
