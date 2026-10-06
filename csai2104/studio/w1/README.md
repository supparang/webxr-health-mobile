# CSAI2401 W1 Engineering Studio

## Goal
Reproduce and repair a **false completion** defect: the client displays `COMPLETE` before the authoritative persistence acknowledgement.

## Run
Requires Node.js 18+.

```bash
cd csai2104/studio/w1
npm test
```

The starter project intentionally contains a failing regression test.

## Student task
1. Read `completion.js` and `completion.test.js`.
2. Run the tests and reproduce the defect.
3. Explain why client UI state is not the source of truth.
4. Modify `completeMission()` so UI remains `PENDING` until the save is acknowledged.
5. Keep the timeout path from producing a false `COMPLETE`.
6. Re-run `npm test` until the regression suite passes.
7. Record the evidence in the W1 **Incident Investigation Pack** in the course game.

## Expected engineering evidence
- failing test before the fix
- root-cause explanation
- code change
- passing regression test after the fix
- residual risk / next test
