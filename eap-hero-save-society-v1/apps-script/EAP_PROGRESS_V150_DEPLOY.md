# EAP Progress Authority v150 — Production Reset

## Files to place in the SAME Apps Script project

1. `EAP_ProgressAuthority_v150.gs` — new file
2. `SharedWebAppRouter.gs` — replace with Router v150

Keep legacy evidence/analytics files. Do not delete historical sheets.

## Deploy

Save all files, then Deploy → Manage deployments → Edit current Web App → New version → Deploy.
Use the existing `/exec` deployment URL.

## Test order

### 1. Router health
`?action=router_health`

Expected:
- `service = shared-router-v150`
- `progressAuthorityInstalled = true`

### 2. Create/repair EAP_Progress
`?action=progress_setup`

Expected:
- `ok = true`
- `sheet = EAP_Progress`

### 3. Migrate test ID 50 current-ID records
`?action=progress_migrate_student&studentId=50&section=122&sourceStudentId=50`

### 4. Merge legacy test alias records
`?action=progress_migrate_student&studentId=50&section=122&sourceStudentId=6811000000`

Both migrations are idempotent: best/passed evidence is preserved.

### 5. Resume from the new authority
`?action=player_resume&studentId=50&section=122`

Expected:
- `service = eap-progress-authority`
- `version = 20260812-EAP-PROGRESS-AUTHORITY-V150`
- `authorityMode = EAP_Progress-single-source-of-truth`
- response should return quickly without scanning evidence logs

### 6. Validate S5
For the known test flow, confirm S5 Reading restores from migration. Then submit S5 Speaking once.
The submit response should include a `progress` object, and the next `player_resume` should reflect the new Speaking state immediately.

## Production rule

After v150 is active, NEVER reconstruct unlock state from `events`, `evidence`, `attempts`, `quality-audit`, or summary sheets during normal resume. Those remain research/analytics logs only. `EAP_Progress` is the sole progression authority.
