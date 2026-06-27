# v1z66 — Gold Source Integrity + Focus UI

## Screenshot fixes
1. Gold passage cleanup
   - Removed appended generic Session explanations from all 120 Gold source passages.
   - Each source now displays only its own scenario.
   - S01_G05 Progress Evidence now contains only the early-vs-later-summary scenario.

2. Source-specific vocabulary
   - Gold Help uses keywords from the active source.
   - Example S01_G05: early summary, later summary, copied phrases.

3. Focused Reading UI
   - The generic “AI Help for this mission” stripe is hidden on Gold tasks.
   - AI Mentor is a compact closed drawer, so it cannot leave a large empty panel.
   - Reading short-answer fields are reduced to a practical A2/A2+ height.

4. Source integrity audit
   - `EAPHero.goldSourceIntegrityAudit()` checks 120 sources, generic-text leaks, and source keyword readiness.
