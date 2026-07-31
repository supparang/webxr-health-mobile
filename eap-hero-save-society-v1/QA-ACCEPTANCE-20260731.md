# EAP Session Acceptance Audit — 2026-07-31

## Goal
Revalidate the current EAP Session production candidate after the EAP Vocabulary completion work and other repository updates.

## Authoritative flow under test
1. Official Section 122 identity resolves from Google Sheet.
2. A learner with no official progress starts at S1 only.
3. S1 Core + Support results are written to Sheet.
4. Navigation remains locked until the Sheet receipt and `player_resume` confirmation succeed.
5. Passing S1 unlocks S2; failing S1 remains at S1.
6. Closing and reopening restores the Sheet-authoritative current route.
7. Boss Speaking pending review remains blocked; reviewed/approved evidence advances.
8. Local storage cannot unlock a route.

## Gate
This audit intentionally touches the EAP Session path so the repository's `EAP 15 Production Gate` runs both browser and live-Sheet contracts against the current codebase.

## Status
- Browser contract: pending
- Live Sheet probe: pending
- S1 write/resume round-trip: pending
- Boss review contract: pending
- Teacher dashboard evidence: pending
