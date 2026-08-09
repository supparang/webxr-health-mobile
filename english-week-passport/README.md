# LEXICON X Challenge — English Week Passport

Mobile-first solo English learning journey for undergraduate A2–B1+ learners. Production authority is **Firebase Cloud Firestore** in project `englishweek-95869`.

## Canonical production flow

`Login → Pre-Challenge → Game 1 → Game 2 → Game 3 → Game 4 → [Bonus] → Game 5 → Post-Challenge → Final Reflection → Journey Summary → Certificate`

Required games:

1. **LexiMatch Navigator — ภารกิจจับคู่คำศัพท์** (`word_match`)
2. **Category Forest** (`category_forest`)
3. **Sentence City** (`sentence_city`)
4. **Conversation Quest** (`word_detective`)
5. **LEXICON Champion Arena** (`final_boss`)

Optional mission:

- **Lexicon Lens Hunt** (`bonus_lens`) — rear-camera QR/context mission; does not block Post-Challenge or Certificate.

## Authority model

Production configuration:

- `authorityMode = firestore-direct`
- Firebase project: `englishweek-95869`
- localStorage: identity/cache/recovery only
- no production demo fallback
- next-stage unlock is reconstructed from Firestore progress
- a game result must receive a Firebase write/receipt before the Passport treats it as saved

Core client authority:

- `firestore-direct-authority-v1.js`
- `passport-game-shell-firestore-v2.html`
- `journey-client-v1.js`

## Pass policy

| Stage | Policy |
|---|---:|
| Pre-Challenge | completion |
| LexiMatch Navigator | 70% |
| Category Forest | 70% |
| Sentence City | 70% |
| Conversation Quest | 70% |
| LEXICON Champion Arena | 65% |
| Post-Challenge | completion after Game 5 |
| Final Reflection | completion after Post |
| Journey Summary | confirmed after Reflection |
| Certificate | Summary viewed + certificate eligible |

## Canonical Firestore collections

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

Final journey state is stored in `ewp_progress`:

- `reflectionDone`
- `finalReflection`
- `summaryViewed`
- `summaryViewedAt`

Legacy `ewp_reflections` and `ewp_journey` are not production authority.

## Learning Analytics contract

Journey Summary and Teacher Console use the same raw Firestore evidence.

### Assessments

- latest Pre record from `ewp_assessments`
- latest Post record from `ewp_assessments`
- Learning Gain = Post accuracy − Pre accuracy

### Game 1–5

Analytics are aggregated from `ewp_game_results`:

- best accuracy
- first-attempt accuracy
- attempt count
- retry count
- total duration
- pass state

`passport-game-shell-firestore-v2.html` currently implements the **V3 Real Duration** contract so Conversation Quest and fallback paths do not submit `durationMs: 0` merely because a game lacks an internal timer.

## Passport routing

`passport-canonical-routes-v1.js` is the canonical Game 1–5 route layer.

Game 1–4 run through the Firestore Passport Game Shell. Game 5 uses its dedicated Champion Arena production path because it coordinates pose detection, speech recognition, final Firebase submission, reconciliation, and automatic Passport return.

The route loader cache is versioned to force the current production route set after fixes.

## Game 5 final-save contract

LEXICON Champion Arena must:

1. finish body/decision/voice evidence;
2. stop speech/camera runtime before the final transaction where appropriate;
3. submit `final_boss` to Firestore;
4. require a Firebase-confirmed pass;
5. reconcile by `resume()` if the final network response times out;
6. return to Passport only after confirmed completion.

## Final Reflection → Journey Summary → Certificate

After Post-Challenge:

1. Final Reflection writes `finalReflection` and `reflectionDone` to `ewp_progress`.
2. Journey Summary reads real Pre/Post assessments and every game attempt.
3. Confirming Journey Summary writes `summaryViewed` to `ewp_progress`.
4. Certificate opens only after the summary gate and Firestore certificate eligibility are satisfied.

## Teacher Console R2

Entry page:

`/english-week-passport/teacher-console.html`

Backend:

`englishWeekTeacher`

Production endpoint:

`https://asia-southeast1-englishweek-95869.cloudfunctions.net/englishWeekTeacher`

Teacher Console reads the same direct-Firestore schema as the student journey and provides:

- Completion Funnel
- Pre/Post means
- paired Learning Gain
- Game 1–5 analytics
- attempts and duration
- Data Health warnings
- participant search/filter
- Participant Report
- Reflection/Journey/Certificate state
- CSV participant export
- CSV game export

The function is protected by `EW_TEACHER_KEY`. The key is kept in the browser only for the current tab session and is never committed to source.

## Firestore security model

Student pages authenticate anonymously, then claim a permitted `playerId` in `ewp_player_sessions`.

Rules allow a student to access only records whose `playerId` matches that claimed session. Own-assessment and own-game-result queries are permitted only when the query can satisfy that ownership rule. Collection-wide student reads remain blocked.

Teacher-wide reads do not use student rules; they run through the protected Admin SDK Teacher function.

## QA IDs

Automatic QA profile creation is limited to:

- `QA-*`
- `TEST-*`
- numeric IDs beginning with `99` and at least six digits

Real participant IDs must be preloaded in `ewp_profiles` and active.

## Responsive / smoke-test policy

Production play is mobile-first. PC is supported for smoke testing with:

`?view=mobile`

This renders a centered mobile-width viewport while preserving the same game route and Firestore contracts used on mobile devices.

## Automated QA

GitHub Actions workflow:

`English Week Passport QA`

It performs syntax checks plus contracts for Passport rotation, Category Forest, Sentence City, AR hand detection, Champion Arena, assessment resume, and the Firestore-direct production architecture.

The production contract specifically guards:

- project `englishweek-95869`
- `firestore-direct` mode
- no production demo fallback
- Journey V5 real analytics
- Game Shell V3 real duration
- owned Firestore analytics queries
- Teacher Authority R2 schema
- no LEXICON X deployment workflow pointing to `english-d4bfa`

## Firebase deployment

Workflow:

`Deploy English Week Firebase Production`

It targets `englishweek-95869` and deploys:

- `englishWeekTeacher`
- Firestore rules

Required external configuration:

- GitHub secret `FIREBASE_SERVICE_ACCOUNT_ENGLISHWEEK_95869`
- Firebase Secret Manager secret `EW_TEACHER_KEY`

The separate Assessment Checkpoint workflow is a **manual fallback** and is also pinned to `englishweek-95869`.

## Production lock

Do not label the event build final until all of these pass:

1. GitHub `English Week Passport QA` passes.
2. Firestore rules are deployed to `englishweek-95869`.
3. `englishWeekTeacher` is deployed and Teacher Console authenticates.
4. One clean account completes the full flow through Certificate.
5. Cross-device resume succeeds.
6. A failed attempt does not unlock the next stage.
7. A retry produces the correct attempt count.
8. Journey Summary values match raw Firestore records.
9. Teacher Console values match the same participant records.
10. A 10-participant smoke test succeeds on the intended mobile devices.

See `FIREBASE-PRODUCTION-CHECKLIST.md` for the detailed lock checklist.
