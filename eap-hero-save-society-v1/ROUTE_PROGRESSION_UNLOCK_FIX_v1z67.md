# v1z67 Route Progression Unlock Fix

## Bug fixed
The previous Continue action retained `state.currentSession` and reopened S1 even when S1 was passed. Session unlock flags were not synchronized from Core + Support pass truth.

## New route
- S1 passed → S2 unlocked → Continue to S2
- S2 passed → S3 unlocked
- S3 passed → B1 unlocked
- B1 cleared → S4 unlocked
- Repeats for B2/B3/B4 and ends with Final Boss after S15.

## Boss correction
Boss Gates are integrated four-skill checkpoints. They unlock after the three prerequisite Sessions have passed; they do not require pre-existing evidence in all four skills.
