# English Week Passport: Solo Multi-Control Adventure

Mobile-first solo English vocabulary game using a HeroHealth-style Passport flow. Every player completes the journey independently on one mobile device.

## Locked solo flow

`Login → Pre-Challenge → Passport → Word Match Memory → Category Forest AR → Sentence City Builder → Action Detective Lab → Mixed Final Boss → Post-Challenge → Certificate`

Google Sheet is the production source of truth. The browser stores only the latest identity cache and a clearly labelled demo database when no Apps Script endpoint has been configured.

## Control design

| Stage | Primary control | Fallback |
|---|---|---|
| Pre-Challenge | Touch quiz | — |
| Word Match Village | Tap memory cards | — |
| Category Forest | Rear-camera AR + portal tap | Non-camera scene |
| Sentence City | Tap ordering + drag/drop | Tap ordering |
| Action Detective Lab | Body Pose → AR Scan → Hand Tracking | Touch for every round |
| English Champion Arena | Mixed controls | Touch-safe mixed mode |
| Post-Challenge | Touch assessment | — |
| Certificate | Touch / print | — |

Body and hand tracking are never allowed to become progression blockers. Detection rounds must provide a visible framing guide, a short countdown, relaxed confidence thresholds, adaptive assistance, and a touch fallback using the same learning item and pass policy.

## Current implementation status

| Stage | Mode | Status |
|---|---|---|
| Pre-Challenge | Touch quiz | Implemented |
| Word Match Village | Memory Pair game | Implemented V1 |
| Category Forest | Camera AR + non-camera fallback | Implemented V1 |
| Sentence City | Build, order, and repair puzzle | Implemented V1 |
| Action Detective Lab | Body + AR Scan + Hand / touch fallback | Next production stage |
| English Champion Arena | Mixed Final Boss | Existing quiz engine; redesign queued |
| Post-Challenge | Touch assessment | Implemented |
| Certificate | Personal certificate | Implemented |

## Stage policy

| Stage | Pass policy |
|---|---:|
| Pre-Challenge | completion only |
| Word Match Village | 70% mastery |
| Category Forest AR | 70% accuracy |
| Sentence City | 70% first-try mastery |
| Action Detective Lab | 70% combined mission mastery |
| English Champion Arena | 65% mixed mastery |
| Post-Challenge | completion only after Final Boss |
| Certificate | after Post-Challenge |

A client result never unlocks the next stage by itself. The next stage appears only after `submit_game_result` or `submit_assessment` returns a valid authority receipt.

## Word Match Memory V1

- Six English–Thai pairs, displayed as twelve shuffled cards.
- Tap two cards to reveal and compare them.
- Combo, flips, mismatches, time, and pair-level attempts are recorded.
- Mastery uses two-mismatch bands: `10 - floor(mistakes / 2)`.
- Six mismatches remain at the 70% boundary; eight mismatches fall below it.
- Direct page: `/english-week-passport/word-match-memory.html`
- Passport route: `word-match-route.js`.

## Category Forest AR V1

Category Forest uses camera-overlay WebAR rather than requiring WebXR support. This gives broad compatibility while still providing an AR-style camera experience.

- Camera permission is requested only after the player taps **Open Camera AR**.
- The camera stream is used only as the live background and is not recorded or uploaded.
- If camera permission is denied or unavailable, the player can use a non-camera fallback.
- Camera and fallback modes use the same item bank, score, pass mark, Sheet submission, and unlock receipt.
- Direct page: `/english-week-passport/category-ar.html`.

## Sentence City Builder V1

- Ten tasks across Fill the Gap, Word Order, and Sentence Repair.
- Tap blocks to build the answer; drag/drop is also enabled where supported.
- Blocks can be removed and reordered without restarting the task.
- Players may continue correcting every sentence, but mastery credit is awarded only when the first check is correct.
- Hint use, task attempts, first-try mastery, duration, points, and input mode are recorded.
- Direct page: `/english-week-passport/sentence-builder.html`.
- Passport route: `sentence-route.js`.

## Action Detective Lab architecture

The existing `word_detective` authority stage will contain three sequential solo rounds so existing progress rows and Sheet schemas remain compatible:

1. **Listening Action** — front camera and Pose Detection for simple English commands such as raise hands, lean, duck, and arms wide.
2. **AR Clue Scan** — rear camera search-and-scan mission based on English clues.
3. **Magic Hand** — hand pointer and pinch selection, with large hit targets and immediate touch fallback.

The combined stage submits one `word_detective` receipt and records per-round `inputMode`, `fallbackUsed`, `detectionConfidence`, `retryCount`, `hintUsed`, and item-level correctness.

## Frontend files

- `index.html` — Passport shell and game route loaders
- `styles.css` — responsive Passport UI
- `visibility-hotfix.css` — global hidden-state fix
- `config.js` — endpoint and version configuration
- `word-bank.js` — vocabulary bank and parallel assessments
- `authority-client.js` — Apps Script transport, demo authority, and resume contract
- `app.js` — Passport, legacy quiz fallback, certificate, and leaderboard
- `word-match-memory.html/css/js` — Memory Pair game
- `word-match-route.js` — Word Match Passport routing and resume
- `category-ar.html/css/game.js` — Category Forest camera/fallback game
- `category-ar-route.js` — Category Forest Passport routing and resume
- `sentence-builder.html/css/js` — Sentence City puzzle game
- `sentence-route.js` — Sentence City Passport routing and resume

## Google Apps Script setup

1. Create or select the Google Sheet for English Week.
2. Open **Extensions → Apps Script**.
3. Paste `apps-script/EnglishWeekReceiver.gs` into a single Apps Script file.
4. Run `EW_setupSheets()` once and grant permissions.
5. Add participant rows to `EW_Profiles`.
6. Deploy as a Web App with **Execute as Me** and access set to **Anyone**.
7. Copy the final public `/exec` URL into `config.js` as `webAppUrl`.
8. Test resume, failed attempts, successful receipts, and cross-device restoration.

### `EW_Profiles` minimum columns

| playerId | fullName | nickname | groupName | institution | active |
|---|---|---|---|---|---|
| EW001 | Test Student | Mint | Group A | School Name | TRUE |

Do not add `/u/0/` or `/u/1/` to the deployed URL.

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

When `webAppUrl` is blank, the frontend enters demo mode and labels it clearly. Demo mode is only for UI and flow testing. It must not be used for official event scores, certificates, or research analysis.

## Acceptance checklist

1. Unknown production IDs are blocked.
2. Returning players resume from Sheet authority on another device.
3. A failed stage never unlocks the next stage.
4. Closing before a server receipt never creates an unlock.
5. Word Match opens the Memory game rather than the legacy MCQ engine.
6. Category Forest cannot open before Word Match passes.
7. Denied camera permission leads to a valid non-camera fallback.
8. Sentence City cannot open before Category Forest passes.
9. Sentence mastery is based on first-check correctness, not unlimited correction.
10. Every control mode records `inputMode`.
11. Pose and hand rounds always expose touch fallback.
12. Camera streams stop when leaving or completing a camera stage.
13. Final Boss is inaccessible before all four authority stages pass.
14. Certificate is inaccessible before Post-Challenge completion.
15. Leaderboard reads server-authorized best scores only.
16. Mobile UI has no overlapping controls at 360–430 px widths.
17. `qa/solo-multicontrol-contract.mjs` passes.
