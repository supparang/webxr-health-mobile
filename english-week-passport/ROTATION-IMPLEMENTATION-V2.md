# English Week Passport Rotation V2

Version: `2026-08-03-PASSPORT-ROTATION-V2-INDEPENDENT`

## Active in the web game

- Four Passport rotations: `P1`, `P2`, `P3`, `P4`
- Two independent assessment rotations:
  - `R1`: Pre A → Post B
  - `R2`: Pre B → Post A
- Stable seeded order per player and stage
- Assignment fields are attached to assessment and game payloads
- Passport header displays `P# • R# • A2–B1+`
- Final Boss selection is stable for the same player

### Word Match Village

- Source bank: 24 A2–B1+ word pairs
- Rotation-specific pool: 12 pairs
- Six pairs are selected with the player's stage seed
- Primary interaction: Tilt + Dwell
- Trusted touch on memory cards is blocked

### Category Forest

- Source bank: 32 words
- Four domains: Travel, Technology, Environment, Health
- Three words per domain, 12 missions per player
- Primary interaction: rear camera + device motion + dwell
- Portal touch and non-camera fallback are hidden/blocked

### Sentence City

- Source bank: 24 A2–B1+ sentence tasks
- Ten tasks selected through a fixed blueprint:
  - Fill the Gap: 3
  - Word Order: 3
  - Repair: 2
  - Context: 2
- Primary interaction: Hand Pointer + Pinch
- Trusted touch on tokens and answer controls is blocked

### Action Detective Lab

- Body task order differs across P1–P4
- AR tasks: three selected from a 12-item A2–B1+ bank
- Hand tasks: three selected from a 12-item A2–B1+ bank
- Body Mastery V4 remains active
- Detection-only policy remains active

## Client assignment limitation

The current `config.js` still has an empty `webAppUrl`. Therefore the live site currently derives and locks assignments in browser storage. The same player ID receives a stable assignment on the same browser, but cross-device authority is not active yet.

Do not claim cross-device assignment until the Apps Script router returns `authority.assignment` and `config.js.webAppUrl` points to the deployed Web App.

## Server module prepared

File:

`apps-script/EW_PassportRotation.gs`

The module:

- Creates/uses `EW_Assignments`
- Uses `LockService`
- Reuses an existing assignment for the same player ID
- Selects among the least-used `P1R1 ... P4R2` combinations
- Stores pre/post form, seed, version, timestamp, and lock state
- Does not declare `doGet` or `doPost`

Router integration example:

```javascript
const assignment = EW_getOrCreatePassportAssignment_(playerId, {
  arrivalBatch: params.arrivalBatch,
  source: 'passport-router'
});
authority.assignment = assignment;
```

Setup function:

```javascript
EW_setupPassportRotation_();
```

Health function:

```javascript
EW_passportRotationHealth_();
```

## QA

Browser contract:

`tests/passport-rotation-v2-contract.html`

Node contract:

`tests/passport-rotation-v2.node.cjs`

GitHub Actions workflow:

`.github/workflows/english-week-passport-qa.yml`

The contract checks stable assignment, all eight P/R combinations, form counterbalancing, distribution tolerance, independent stage seeds, and stable item sampling.
