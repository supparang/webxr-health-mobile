EAP Hero v1z78 — Speaking Timer Sync Fix

Fixes the S1 speaking issue where the UI displayed 15 seconds but submit read 0 seconds.
- Timer now synchronizes lexical and window values.
- Time is frozen when I Finished Speaking is pressed.
- Submit uses the highest reliable timer source.
- A clear Ready to submit message appears when the minimum time is reached.
- Speaking longer than the recommended range remains valid.

Upload index.html and eap-hero.js, then open with ?x=v1z78
