# EAP Word Quest in the Shared Apps Script Project

Use these files in the **same Apps Script project** as EAP Hero:

1. `SharedWebAppRouter.gs` — replace the existing shared router. It must be the **only** file with `doGet` and `doPost`.
2. `EAPWordQuest.gs` — add as a new script file.
3. `EAPWordQuestFinalRouterPatch.gs` — add as a new script file.

`Code.gs` in this GitHub folder is intentionally only a notice. Do not paste it into the shared project.

## One-time setup

1. Open the Google Sheet that owns the shared Apps Script project.
2. Add the two new EAP Word Quest files and replace the router with `SharedWebAppRouter.gs`.
3. Run `eapwqSetup_()` once from the Apps Script editor and grant permission.
4. Deploy a **new version** of the existing Web App.
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Keep using the existing `/exec` URL if the deployment is updated instead of replaced.

## EAP Word Quest endpoints

- Health: `?action=eap_word_health`
- Teacher data: `?action=eap_word_teacher&section=122`
- Summary data: `?action=eap_word_summary&section=122`
- Optional setup URL: `?action=eap_word_setup`

## Expected Sheets

The module creates or safely reuses these sheets without clearing historical rows:

- `eap_word_profiles`
- `eap_word_attempts`
- `eap_word_summary`

The Teacher Dashboard reads all rows in `eap_word_attempts`, not only the latest summary row. It groups attempts by **Group 122 + Student ID**, then displays both best and latest evidence for each session.
