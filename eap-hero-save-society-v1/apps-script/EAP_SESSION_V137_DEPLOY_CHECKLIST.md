# EAP Session Authority v137 — Safe Deployment Checklist

## Purpose
Deploy the EAP Session authority fix without changing the current Web App URL, resetting student data, or creating duplicate `doGet()` / `doPost()` functions.

## Files in this release
1. `EAP_SessionAuthority_v137.gs`
   - New Apps Script file.
   - Owns `eapPlayerResumeV137_()` and `eapSubmitEvidenceV137_()`.
   - Normal S1–S15 progression uses Core + Support only.
   - Boss B1–B5 use all four skills.
   - Boss Speaking requires a reviewed/approved teacher status.
   - Evidence is written into `events` in a form readable by `player_resume`.

2. `herohealth/eap-word-quest/apps-script/SharedWebAppRouter.gs`
   - Replace the existing shared router with this revision.
   - Remains the **only** Apps Script file containing `doGet()` and `doPost()`.
   - Routes `player_resume` to `eapPlayerResumeV137_()`.
   - Routes `submit_evidence` to `eapSubmitEvidenceV137_()`.

## Deployment steps
1. Open the existing Apps Script project currently serving the Section 122 endpoint.
2. Add a new script file named exactly `EAP_SessionAuthority_v137.gs`.
3. Paste the complete repository file into that new script file.
4. Open the existing shared router file that contains `doGet()` and `doPost()`.
5. Replace its complete contents with the repository revision of `SharedWebAppRouter.gs`.
6. Search the whole Apps Script project for `function doGet` and `function doPost`.
   - Exactly one `doGet()` must remain.
   - Exactly one `doPost()` must remain.
7. Save all files.
8. Do **not** run setup, migration, clear, reset, or sheet recreation functions.
9. Choose **Deploy → Manage deployments → Edit**.
10. Create a new Web App version while preserving the existing deployment and URL.
11. Execute as the project owner and keep the existing access setting.
12. Confirm the deployment.

## Required acceptance evidence
After deployment, rerun the `EAP 15 Production Gate` on PR #73. It must show:

- `Session Authority v137 contract` — pass
- `Browser release contract` — pass
- `Progressive dashboard contract` — pass
- `Apps Script dashboard v7 UI contract` — pass
- New identity probe — pass
- S1 Reading + Speaking → `currentRoute: S2` — pass
- S1 Reading pass + Speaking fail → `currentRoute: S1` — pass
- Boss Speaking pending → returned by `player_resume` and blocked — pass
- Boss Speaking reviewed → returned by `player_resume` — pass
- Teacher Dashboard sees the reviewed Boss evidence — pass

## Expected live response markers
A successful `action=player_resume` response must contain:

```text
version: v20260731-EAP-SESSION-AUTHORITY-V137-CORE-SUPPORT-BOSS-EVIDENCE
progressPolicy: normal-core-support-boss-four-skills-speaking-reviewed
```

## Rollback
If the deployment fails before acceptance:

1. Reopen **Deploy → Manage deployments → Edit**.
2. Select the previous known-good Apps Script version.
3. Do not delete or clear any Sheet rows created during QA.
4. Keep PR #73 unmerged until the live gate is green.
