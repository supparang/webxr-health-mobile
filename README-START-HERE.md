# UX Quest W2 • Design Thinking Studio V2

Upload one game file to:

`/sgnal-hunt/w2-design-thinking-sprint.html`

This replaces the old W2 quiz-style sprint with a Week 2 curriculum-aligned Design Thinking Studio.

## Student flow

1. W1 must be 2★ Readiness.
2. Choose Tutorial / Random / Transfer Sprint.
3. Complete one human-centered Design Challenge:
   - Empathize: select evidence
   - Define: choose Problem Statement + HMW
   - Ideate: choose the experiment direction
   - Prototype: choose the smallest testable flow
   - Test: read the dynamic test result and choose a next move
   - Project Gate: select a Week 2 Design Challenge Brief v1 strategy
4. Complete a short reflection for the workshop.

## What this build preserves

- Uses `csai2601-uxquest-casefile-readiness-v1`, the canonical W1 readiness record.
- W1 quiz history does not unlock W2.
- Uses lightweight local/session storage only; the game still works if browser storage is unavailable.
- 24 Design Challenges = 8 contexts × 3 user/context variants.
- Random Challenges do not repeat before a full 24-challenge cycle.
- Test outcomes change based on the learner's selected Problem / Idea / Prototype.
- Includes a one-time Sprint Retrospective without revealing answer keys.

## Test quickly

Open:

`/sgnal-hunt/w2-design-thinking-sprint.html?v=w2-design-studio-v2`

Expected:

- W1 < 2★: W2 locked.
- W1 ≥ 2★: Tutorial Sprint is available.
- Finish Tutorial: Random Challenge unlocks.
- Change a weak Idea or Prototype in Retrospective: Test result changes accordingly.
