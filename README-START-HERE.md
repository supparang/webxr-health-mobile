# UX Quest W1 Final V8 — Single-state replay + direct W2 unlock

## What this fixes

1. **W1 pass is read from one canonical state (`csai2601-uxquest-act1-v8`).**
   The V8 bridge imports previous W1 progress from V4–V7 automatically.
2. **W2 opens immediately when W1 has 1★ or more.** It does not require any replay.
3. **After W1 is cleared, direct visits to W1 start Random Replay, not Tutorial.**
4. **Tutorial is now review-only** and only starts when the learner explicitly selects it.
5. **Replay scheduler remains strict:** 60 core cases, 12 scenario variants/core, 5 fresh cores per round, no core repeat until 12 replay rounds are complete.

## Upload exactly this full `sgnal-hunt` folder

Do not mix V4–V7 HTML/JS files with V8. Replace all files under `/sgnal-hunt/` from this package.

## Acceptance test

1. Open `/sgnal-hunt/w1-ux-detective.html?v=w1-v8-final`.
2. A prior W1 score of 1★+ must open **Random Replay** directly — no Tutorial lobby.
3. Open `/sgnal-hunt/w2-design-thinking-sprint.html?v=w1-v8-final`.
4. W2 must show its mode selection screen, not Access Locked.
5. Complete 3 Random Replays and confirm 15 different core case IDs in the replay progress data.
