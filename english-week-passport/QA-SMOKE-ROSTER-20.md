# LEXICON X Challenge • 20-Player Smoke Test Roster

Date: 2026-08-09
Purpose: Final E2E smoke test before Production Lock.
Authority: Cloud Firestore Direct (`englishweek-95869`).

These IDs use the `QA-` prefix supported by the current QA registration policy. On first login, the Firestore Direct Authority can create a QA profile automatically when the ID does not already exist. Use one code per tester/device.

## Balanced test roster

| # | Test code | Suggested nickname | Passport Rotation | Assessment Rotation | Pre Form | Post Form |
|---:|---|---|---|---|---|---|
| 1 | `QA-EW260809-01` | Smoke01 | P1 | R1 | A | B |
| 2 | `QA-EW260809-30` | Smoke02 | P1 | R1 | A | B |
| 3 | `QA-EW260809-31` | Smoke03 | P1 | R1 | A | B |
| 4 | `QA-EW260809-03` | Smoke04 | P1 | R2 | B | A |
| 5 | `QA-EW260809-05` | Smoke05 | P1 | R2 | B | A |
| 6 | `QA-EW260809-02` | Smoke06 | P2 | R1 | A | B |
| 7 | `QA-EW260809-07` | Smoke07 | P2 | R1 | A | B |
| 8 | `QA-EW260809-18` | Smoke08 | P2 | R2 | B | A |
| 9 | `QA-EW260809-27` | Smoke09 | P2 | R2 | B | A |
| 10 | `QA-EW260809-35` | Smoke10 | P2 | R2 | B | A |
| 11 | `QA-EW260809-08` | Smoke11 | P3 | R1 | A | B |
| 12 | `QA-EW260809-12` | Smoke12 | P3 | R1 | A | B |
| 13 | `QA-EW260809-15` | Smoke13 | P3 | R1 | A | B |
| 14 | `QA-EW260809-04` | Smoke14 | P3 | R2 | B | A |
| 15 | `QA-EW260809-14` | Smoke15 | P3 | R2 | B | A |
| 16 | `QA-EW260809-20` | Smoke16 | P4 | R1 | A | B |
| 17 | `QA-EW260809-28` | Smoke17 | P4 | R1 | A | B |
| 18 | `QA-EW260809-13` | Smoke18 | P4 | R2 | B | A |
| 19 | `QA-EW260809-19` | Smoke19 | P4 | R2 | B | A |
| 20 | `QA-EW260809-21` | Smoke20 | P4 | R2 | B | A |

## Coverage

- P1/R1: 3 testers
- P1/R2: 2 testers
- P2/R1: 2 testers
- P2/R2: 3 testers
- P3/R1: 3 testers
- P3/R2: 2 testers
- P4/R1: 2 testers
- P4/R2: 3 testers

Total: 20 testers, covering all 8 Passport/Assessment rotation combinations.

## Required smoke-test path

Each tester should complete:

`Login → Pre-Challenge → Game 1 → Game 2 → Game 3 → Game 4 → Game 5 → Post-Challenge → Final Reflection → Journey Summary → Certificate`

Bonus `Lexicon Lens Hunt` should be tested by at least 4 testers (one tester from each Passport Rotation P1–P4), but it is not required for Certificate eligibility.

## Evidence to verify

For each code verify:

1. Login/profile is accepted.
2. Correct rotation is stable after refresh/re-login.
3. Pre-Challenge saves to Firestore.
4. Each game creates a result receipt and only unlocks the next stage after pass.
5. Game attempts and duration are non-zero where applicable.
6. Post-Challenge saves to Firestore.
7. Final Reflection persists after returning to Passport.
8. Journey Summary shows real Pre/Post, learning gain, attempts and time.
9. Certificate opens only after Journey Summary confirmation.
10. Teacher Console shows the same participant state and analytics.

Do not reuse these codes for official participant data.