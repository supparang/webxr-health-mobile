# English Week Passport: AR Vocabulary Adventure

Mobile-first vocabulary game using a HeroHealth-style Passport flow with selective WebAR stages.

## Production flow

`Login → Pre-Challenge → Passport → Word Match 2D → Category Forest AR → Sentence City 2D → Word Detective AR → Final Boss AR Light → Post-Challenge → Certificate`

Google Sheet is the production source of truth. The browser stores only the latest identity cache and a clearly labelled demo database when no Apps Script endpoint has been configured.

## Current implementation status

| Stage | Mode | Status |
|---|---|---|
| Pre-Challenge | 2D | Implemented |
| Word Match Village | 2D | Implemented |
| Category Forest | Camera AR + non-camera fallback | Implemented V1 |
| Sentence City | 2D | Implemented |
| Word Detective Lab | Planned AR | 2D engine currently available |
| English Champion Arena | Planned AR Light | 2D engine currently available |
| Post-Challenge | 2D | Implemented |
| Certificate | 2D | Implemented |

## Stage policy

| Stage | Pass policy |
|---|---:|
| Pre-Challenge | completion only |
| Word Match Village | 70% |
| Category Forest AR | 70% |
| Sentence City | 70% |
| Word Detective Lab | 70% |
| English Champion Arena | 65% |
| Post-Challenge | completion only after Final Boss |
| Certificate | after Post-Challenge |

A client result never unlocks the next stage by itself. The next stage appears only after `submit_game_result` or `submit_assessment` returns a valid authority receipt.

## Category Forest AR V1

Category Forest uses camera-overlay WebAR rather than requiring WebXR support. This gives broader compatibility on Android Chrome and iOS browsers while still providing an AR-style camera experience.

- Camera permission is requested only after the player taps **Open Camera AR**.
- The camera stream is used only as the live background and is not recorded or uploaded.
- If camera permission is denied or the camera is unavailable, the player can use **non-camera fallback**.
- Camera and fallback modes use the same 10-item bank, scoring policy, pass mark, Sheet submission, and unlock receipt.
- Returning from the AR page automatically restores the Passport identity and reloads authority state.

Direct page:

`/english-week-passport/category-ar.html`

The page checks that `category_forest` is unlocked before allowing play. It must normally be entered from the Passport.

## Frontend files

- `index.html` — application shell
- `styles.css` — responsive mobile UI
- `visibility-hotfix.css` — global hidden-state fix
- `config.js` — endpoint and version configuration
- `word-bank.js` — vocabulary bank, Form A/Form B assessments, Final Boss pool
- `authority-client.js` — Google Apps Script transport, demo authority, resume contract
- `app.js` — Passport, 2D question engine, unlock flow, certificate, leaderboard
- `category-ar-route.js` — routes the unlocked Category Forest Passport card to AR
- `category-ar.html` — Category Forest AR shell
- `category-ar.css` — camera AR and fallback presentation
- `category-ar-game.js` — camera permission, AR gameplay, fallback, submission, receipt, and return flow

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
6. Category Forest cannot open before Word Match passes.
7. Camera permission is requested only from a user gesture.
8. Denied/unavailable camera leads to fallback without blocking the player.
9. Camera and fallback modes use the same questions, scoring, pass mark, and receipt flow.
10. The camera stream stops when leaving or completing the AR stage.
11. Final Boss is inaccessible before all four zones pass.
12. Certificate is inaccessible before Post-Challenge completion.
13. Leaderboard reads server-authorized best scores only.
14. Every result row includes version and receipt identifiers.
15. Mobile UI has no overlapping controls at 360–430 px widths.
