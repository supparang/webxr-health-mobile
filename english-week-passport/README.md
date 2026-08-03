# English Week Passport: Vocabulary Adventure

Mobile-first vocabulary game using a HeroHealth-style Passport flow.

## Production flow

`Login → Pre-Challenge → Passport → 4 Zones → Final Boss → Post-Challenge → Certificate`

Google Sheet is the production source of truth. The browser stores only the latest identity cache and a clearly labelled demo database when no Apps Script endpoint has been configured.

## Stage policy

| Stage | Pass policy |
|---|---:|
| Pre-Challenge | completion only |
| Word Match Village | 70% |
| Category Forest | 70% |
| Sentence City | 70% |
| Word Detective Lab | 70% |
| English Champion Arena | 65% |
| Post-Challenge | completion only after Final Boss |
| Certificate | after Post-Challenge |

A client result never unlocks the next stage by itself. The next stage appears only after `submit_game_result` or `submit_assessment` returns a valid authority receipt.

## Frontend files

- `index.html` — application shell
- `styles.css` — responsive mobile UI
- `config.js` — endpoint and version configuration
- `word-bank.js` — vocabulary bank, Form A/Form B assessments, Final Boss pool
- `authority-client.js` — Google Apps Script transport, demo authority, resume contract
- `app.js` — Passport, question engine, unlock flow, certificate, leaderboard

## Google Apps Script setup

1. Create or select the Google Sheet for English Week.
2. Open **Extensions → Apps Script**.
3. Paste `apps-script/EnglishWeekReceiver.gs` into a single Apps Script file.
4. Run `EW_setupSheets()` once and grant permissions.
5. Add participant rows to `EW_Profiles`.
6. Deploy as a Web App:
   - Execute as: **Me**
   - Who has access: **Anyone**
7. Copy the `/exec` URL into `config.js` as `webAppUrl`.
8. Commit the config update and test on a real mobile device.

### `EW_Profiles` minimum columns

| playerId | fullName | nickname | groupName | institution | active |
|---|---|---|---|---|---|
| EW001 | Test Student | Mint | Group A | School Name | TRUE |

Do not add `/u/0/` or `/u/1/` to the deployed URL. Use the final public `/exec` URL only.

## Sheet authority tabs

- `EW_Profiles`
- `EW_Assessments`
- `EW_Assessment_Items`
- `EW_Game_Results`
- `EW_Game_Summary`
- `EW_Progress`
- `EW_Live_Status`
- `EW_Certificates`
- `EW_Events`
- `EW_Errors`

## Demo mode

When `webAppUrl` is blank, the frontend enters **demo mode** and labels it clearly. Demo mode is only for UI and flow testing. It must not be used for event data collection, official scores, certificates, or research analysis.

## Acceptance checklist

1. Unknown production player IDs are blocked.
2. Returning players resume from `EW_Progress` on another device.
3. A failed stage does not unlock the next stage.
4. Closing the page before a server receipt does not produce an unlock.
5. Pre/Post use different fixed parallel forms and shuffle item/option order.
6. Final Boss is inaccessible before all four zones pass.
7. Certificate is inaccessible before Post-Challenge completion.
8. Leaderboard reads server-authorized best scores only.
9. Every result row includes version and receipt identifiers.
10. Mobile UI has no overlapping controls at 360–430 px widths.
