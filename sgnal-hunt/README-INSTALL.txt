UX Quest — Act I Complete Pack (2026-06-28)

FILES
- w1-ux-crisis-casefile.html        W1 • UX Detective Casefile
- w2-design-thinking-sprint.html    W2 • Design Thinking Sprint
- w3-cognitive-load-escape.html     W3 • Cognitive Load Escape
- b1-cognitive-storm.html           B1 • Cognitive Storm Boss Gate
- js/uxq-progress-v1.js             Shared local progress and unlock store
- js/uxq-mission-engine-v1.js       Shared game engine
- js/uxq-hub-casefile-v14.js        Mission Control unlock/status controller

INSTALL
1. Copy the four HTML files into the same folder as index.html.
2. Copy the three JavaScript files into ./js/.
3. In index.html, replace only the final hub script line with:
   <script src="./js/uxq-hub-casefile-v14.js?v=20260628-act1-complete"></script>
4. Keep the existing Mission Control HTML markup unchanged.
5. Open index.html through a local server or GitHub Pages. Do not test by opening file:// directly if browser storage behaves inconsistently.

PLAY / UNLOCK RULES
- W1 is open immediately.
- 2★ Readiness (accuracy >= 62%) unlocks the next mission.
- W1 → W2 → W3 → B1.
- Each play selects random cases, randomizes option position, avoids recently used cases, uses combo scoring, and gives rationale-based feedback.
- Hint may be used once per question and costs 15 score only; it never blocks progression.
- Progress is currently stored locally in that browser under localStorage key uxq.act1.progress.v1.

IMPORTANT LIMITATION
This pack intentionally does not claim to have teacher-dashboard or Google Sheets logging yet. It is a stable local-first Act I game layer. Connect logging after gameplay and progress rules have been tested in a browser.
