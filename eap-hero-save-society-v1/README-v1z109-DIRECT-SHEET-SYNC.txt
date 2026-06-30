EAP Hero v1z109 Direct Evidence Sheet Sync

This package replaces the prior DOM-scraping bridge.
eap-hero.js sends a single GET request immediately inside addPortfolio()
after the exact compact evidence record is created.

Deploy:
1. Upload eap-hero.js, index.html, eap-sheet-config.js and the supporting files.
2. Keep EAP_Code.gs v2 deployed as Web App with access Anyone.
3. Hard refresh with ?x=v1z109.
4. Set Player Profile before testing so studentId/name are not Guest.

Expected: one attempt row per newly-saved evidenceId, with the exact session, skill, and score.
