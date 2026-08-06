# English Week Passport — Firebase Production Checklist

Version: `2026-08-06-FIREBASE-AUTHORITY-V1`

## 1. One-time GitHub secret

Create repository secret:

`FIREBASE_SERVICE_ACCOUNT_ENGLISH_D4BFA`

Value: the complete JSON service-account key for Firebase project `english-d4bfa` with permission to deploy Cloud Functions and use Firestore.

## 2. Controlled deployment

Open GitHub Actions and run:

`Deploy English Week Firebase Authority`

The workflow deploys only:

`englishWeekAuthority`

Expected endpoint:

`https://asia-southeast1-english-d4bfa.cloudfunctions.net/englishWeekAuthority`

## 3. Health check

Open the endpoint with `?action=health&appId=ENGLISH-WEEK-PASSPORT-2026` or load the Passport page. The Passport status banner must show:

`เชื่อมต่อ Firebase Authority แล้ว`

## 4. QA accounts

For controlled testing, the authority auto-creates only IDs matching:

- `QA-*`
- `TEST-*`
- numeric IDs beginning with `99` and at least six digits, such as `990001`

Other IDs require an existing document in Firestore collection `ewp_profiles`.

## 5. Firestore collections

- `ewp_profiles`
- `ewp_progress`
- `ewp_assignments`
- `ewp_game_results`
- `ewp_game_summary`
- `ewp_assessments`
- `ewp_events`
- `ewp_certificates`

## 6. Final Passport E2E

Use one QA account and complete:

1. Login
2. Pre-Challenge
3. Game 1
4. Category Forest
5. Confirm `บันทึก Firebase สำเร็จ`
6. Return to Passport
7. Confirm Sentence City unlocks
8. Open a second device with the same player ID
9. Confirm Category Forest remains passed and Sentence City remains unlocked

## 7. Evidence required before production lock

In Firestore, verify the same player ID exists in:

- `ewp_profiles`
- `ewp_assignments`
- `ewp_progress`
- `ewp_game_results`
- `ewp_game_summary`

The Category Forest result must include `wordSetId`, ten unique `itemOrder` values, `passportRotation`, `randomSeed`, First-Try result, Rescue evidence, and pronunciation counters.

## 8. Production hardening

After Firebase E2E passes:

1. Set `allowDemoWhenFirebaseUnavailable` to `false` in `english-week-passport/config.js`.
2. Import the official participant roster into `ewp_profiles`.
3. Keep QA auto-registration limited to the controlled QA ID patterns.
4. Re-run `English Week Passport QA` before the final event build.
