EAP Hero v1z108 + Live Sheet Bridge package

This package is configured for EAP Hero Section 122.
The live Apps Script /exec endpoint is already placed in eap-sheet-config.js and enabled.

IMPORTANT BASE ASSETS:
Keep existing eap-hero.css and eap-gold-item-bank.js in the GitHub folder. They are unchanged base assets and are intentionally not replaced by this package.

Use:
1) Upload package files into eap-hero-save-society-v1/.
2) Keep existing eap-hero.css and eap-gold-item-bank.js.
3) Ensure EAP_Code.gs has been pasted into the Apps Script project that owns the supplied Web App URL.
4) Run setupEapHero() once in Apps Script to create: profiles, attempts, events, summary, errors.
5) Deploy a new Apps Script version after saving EAP_Code.gs.
6) Play a completed session, then confirm a new row appears in attempts.

The bridge is loaded from index.html. It queues records locally and attempts to send them automatically.
