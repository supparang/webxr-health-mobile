# LEXICON X Challenge — Firebase Production Checklist

Version: `2026-08-09-PRODUCTION-CANDIDATE-R5-ANALYTICS`

## 1. Production architecture

Student authority is **Cloud Firestore Direct** on Firebase project:

`englishweek-95869`

Production student pages must use:

- `authorityMode = firestore-direct`
- `allowDemoWhenFirebaseUnavailable = false`
- `allowQaDemoFallback = false`

Teacher analytics uses the Gen 2 HTTPS function:

`englishWeekTeacher`

Endpoint:

`https://asia-southeast1-englishweek-95869.cloudfunctions.net/englishWeekTeacher`

## 2. One-time GitHub / Firebase secrets

Create repository secret:

`FIREBASE_SERVICE_ACCOUNT_ENGLISHWEEK_95869`

Value: a service-account JSON key with permission to deploy Cloud Functions and Firestore rules to project `englishweek-95869`.

Create Firebase / Google Secret Manager secret in project `englishweek-95869`:

`EW_TEACHER_KEY`

Use a strong private Teacher Key. Do not store this key in GitHub source code.

## 3. Controlled deployment

Workflow:

`Deploy English Week Firebase Production`

The workflow deploys:

1. `englishWeekTeacher`
2. Firestore security rules from `english-week-firebase-spark/firestore.rules`

The workflow must target only:

`englishweek-95869`

## 4. QA accounts

Controlled QA auto-registration is limited to IDs matching:

- `QA-*`
- `TEST-*`
- numeric IDs beginning with `99` and at least six digits, e.g. `990001`

All real participant IDs must already exist as active documents in `ewp_profiles`.

## 5. Canonical Firestore collections

- `ewp_profiles`
- `ewp_player_sessions`
- `ewp_progress`
- `ewp_assignments`
- `ewp_assessments`
- `ewp_assessment_checkpoints`
- `ewp_game_results`
- `ewp_game_summary`
- `ewp_events`
- `ewp_certificates`

Final Reflection and Journey state are stored in `ewp_progress`:

- `reflectionDone`
- `finalReflection`
- `summaryViewed`
- `summaryViewedAt`

Do **not** use legacy `ewp_reflections` or `ewp_journey` as production authority.

## 6. Canonical student flow

Run one clean QA account through the complete journey:

1. Login
2. Pre-Challenge
3. Game 1 — LexiMatch Navigator
4. Game 2 — Category Forest
5. Game 3 — Sentence City
6. Game 4 — Conversation Quest
7. Optional Bonus — Lexicon Lens Hunt
8. Game 5 — LEXICON Champion Arena
9. Post-Challenge
10. Final Reflection
11. Journey Summary
12. Certificate
13. Return to Passport

Every required stage must resume correctly after logout/login and on a second device.

## 7. Learning Analytics validation

Journey Summary must read real Firestore data rather than inferred values.

Verify:

- Pre accuracy = latest `ewp_assessments` pre record
- Post accuracy = latest `ewp_assessments` post record
- Learning Gain = Post − Pre
- Game attempts = count of `ewp_game_results` by stage
- Best accuracy = maximum attempt accuracy by stage
- First-attempt accuracy is preserved
- Retry count = attempts − 1
- Total game time = sum of `durationMs`
- Reflection comes from `ewp_progress.finalReflection`
- Summary state comes from `ewp_progress.summaryViewed`

## 8. Teacher Console validation

Open `english-week-passport/teacher-console.html` and authenticate with `EW_TEACHER_KEY`.

Confirm:

- Firebase live status
- Completion Funnel
- Pre/Post means and paired Learning Gain
- Game 1–5 player counts
- Best accuracy and attempts
- Data Health issues
- Participant search/filter
- Participant Report
- Reflection state
- Journey Summary state
- Certificate readiness
- CSV Participants export
- CSV Games export

Teacher Analytics must read the same canonical schema as Student Firestore Direct authority.

## 9. Firestore Rules validation

Student queries may read only records belonging to the player ID claimed by the current anonymous-auth session.

Verify that:

- another player's progress cannot be read
- another player's assessments cannot be queried
- another player's game results cannot be queried
- own assessment and game-result queries succeed when filtered by own `playerId`
- collection-wide student list access remains blocked

Teacher Console reads through the protected Admin SDK function, not student Firestore list permissions.

## 10. Automated QA

Run GitHub Actions workflow:

`English Week Passport QA`

The production contract must confirm:

- project `englishweek-95869`
- `firestore-direct` authority
- no production demo fallback
- Journey V5 real analytics
- owned Firestore query rules
- Teacher Authority R2 schema alignment
- deployment workflow has no `english-d4bfa` dependency

## 11. Smoke test before Production Lock

Use at least 10 clean test participants.

Test on:

- mobile Chrome / Android
- mobile Safari / iPhone when available
- PC `?view=mobile` smoke mode

For at least one participant, deliberately:

- close and reopen after Game 2
- login on a second device
- retry a failed game
- complete Final Voice
- verify Post → Reflection → Summary → Certificate

## 12. Production Lock criteria

Production Lock is allowed only when all of the following are true:

- GitHub QA passes
- Firestore rules are deployed to `englishweek-95869`
- `englishWeekTeacher` is deployed and Teacher Console authenticates
- one full clean-account E2E passes
- one cross-device resume passes
- Journey Summary values match raw Firestore records
- Teacher Console values match the same participant records
- no required stage relies on localStorage as source of truth

After these checks, tag the build as the English Week production candidate/final event build.
