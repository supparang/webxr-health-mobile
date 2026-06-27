FIX S1 AR card appearing on S2

Upload:
  /ai-quest/js/aiquest-s1-ar-entry-v382.js

In index.html:
1) REMOVE this old v375 line:
<script src="./js/aiquest-s1-ar-entry-v375.js?v=20260627-s1ar-entry375"></script>

2) REPLACE with:
<script src="./js/aiquest-s1-ar-entry-v382.js?v=20260627-s1ar-entry382"></script>

This version only shows S1 AR on ?session=s1 / ?mission=m1.
It actively removes old S1 AR cards when viewing S2 and later sessions.

Then refresh:
https://supparang.github.io/webxr-health-mobile/ai-quest/index.html?session=s2&v=20260627-s2entry382
