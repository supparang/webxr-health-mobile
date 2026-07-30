# HeroHealth Authority V9 Deployment

Version: `2026-07-30-PRODUCTION-V9-ASSESSMENT-AUTHORITY`

## Files in Apps Script

Keep the current `HeroHealthClassroomReceiver.gs` for shared helpers, write routes, game analytics, Sheet headers, and utility functions.

Add the complete file:

- `HeroHealthAuthorityV9.gs`

In `HeroHealthClassroomReceiver.gs`, remove or comment out only these two old declarations:

```js
function doGet(e) { ... }
function doPost(e) { ... }
```

There must be exactly one `doGet(e)` and one `doPost(e)` in the whole Apps Script project. The V9 versions are in `HeroHealthAuthorityV9.gs`.

## Deploy

1. Save all Apps Script files.
2. Select **Deploy → Manage deployments**.
3. Edit the current Web App deployment.
4. Select **New version**.
5. Execute as: **Me**.
6. Who has access: **Anyone**.
7. Deploy.
8. Keep the same `/exec` URL.

## Verification for 990014

Open these URLs in order, using the deployed `/exec` base URL.

### 1. Confirm deployed version

```text
/exec?action=ping
```

Expected:

```json
{
  "ok": true,
  "version": "2026-07-30-PRODUCTION-V9-ASSESSMENT-AUTHORITY",
  "assessmentAuthority": "header-resilient-v9",
  "studentDebug": true
}
```

### 2. Diagnose Sheet evidence

```text
/exec?action=studentDebug&studentId=990014
```

Expected minimum:

```json
{
  "matchedAssessmentRows": 1,
  "decision": {
    "pretest": true,
    "nextStep": "hygiene:handwash"
  }
}
```

The `matched` array must show the row number, normalized assessment type `pretest`, score, total, event ID, and timestamp.

### 3. Rebuild HH_Live_Status

```text
/exec?action=reconcileStudent&studentId=990014
```

Expected:

```json
{
  "ok": true,
  "studentId": "990014",
  "completed": {
    "pretest": true
  },
  "progress": {
    "completedCount": 1,
    "progressPct": 11,
    "nextStep": "hygiene:handwash"
  }
}
```

### 4. Confirm official student response

```text
/exec?action=student&studentId=990014
```

Expected:

```json
{
  "completed": {
    "pretest": true
  },
  "progress": {
    "completedCount": 1,
    "progressPct": 11,
    "nextStep": "hygiene:handwash"
  },
  "evidence": {
    "pretestRows": 1
  }
}
```

### 5. Refresh Passport

```text
https://supparang.github.io/webxr-health-mobile/HeroHealth_Learning1/index.html?authorityRefresh=1&v=20260730-authority-v9
```

Log in with `990014`.

Expected UI:

- Pre-test: completed
- Progress: at least 11%
- Next mission: Handwash AR
- Passport must not display **เริ่ม Pre-test**

## Failure interpretation

- `ping` shows an older version: Apps Script was not deployed as a new version.
- `studentDebug` has `matchedAssessmentRows: 0`: the student ID or Sheet headers/row values do not match; inspect `assessmentHeaders` and the row in `HH_Assessments`.
- `studentDebug` finds the row but `assessmentNormalized` is not `pretest`: inspect the assessment value; V9 accepts `pre`, `pretest`, `ก่อนเรียน`, and `แบบทดสอบก่อนเรียน`.
- `student` is correct but Passport is wrong: reopen Passport with `authorityRefresh=1`; the frontend cache is then the remaining issue.
