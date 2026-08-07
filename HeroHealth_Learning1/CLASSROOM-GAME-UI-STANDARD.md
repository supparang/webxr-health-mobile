# HeroHealth Classroom Game UI Standard

Version: `2026-08-07-HH-CLASSROOM-UI-STANDARD-V6-RESPONSIVE-SMOKE`

## Scope

This standard applies to the official 60-minute HeroHealth Passport flow and all student-facing screens:

- Hero Passport / Login / Mission timeline
- Pre-test
- Handwash AR
- Toothbrush Challenge
- Groups AR
- GoodJunk Hand AR
- JumpDuck AR
- Balance Hold AR
- Post-test
- Reflection
- Mission Summary
- Certificate

The Teacher Console must also remain usable at phone, tablet, and desktop widths, but production student gameplay remains mobile-first.

## Device policy

### Production play

- **Mobile-first and mobile production.** Actual Grade 5 classroom gameplay is performed on a phone.
- Portrait is the primary layout for student flow. Landscape must not break the page and may be used where a camera/body game benefits from it.
- Camera, hand tracking, pose/body detection, motion sensors, safe-area behavior, and browser-bar behavior must be accepted only after real-device testing.
- A successful PC render is not evidence that camera/body detection is production-ready on mobile.

### PC smoke test

- PC is supported for **responsive smoke testing, navigation, Firebase route/receipt checks, start/result screens, and regression checks**.
- Add `smoke=1` to a normal Passport URL for an end-to-end PC smoke run.
- `smoke=1` **does not change progression semantics**. A normal Passport smoke run still follows the current Firebase authority and receipt rules.
- Use `game-test-mode.html` for isolated per-game QA. On desktop it automatically marks the shell as PC Smoke.
- Game Test Mode keeps `isTestAttempt=true` and `affectsProgression=false`; therefore it must not unlock Passport stages.
- Do not replace camera/body acceptance testing with desktop smoke testing.

## Responsive contract

All student pages and games must satisfy these rules:

1. Use `viewport-fit=cover` and respect safe-area insets.
2. No horizontal page overflow at common phone widths, including narrow phones around 320–370 CSS px.
3. Use the visible viewport (`dvh` / Visual Viewport) for full-screen games so expanding or collapsing browser chrome does not hide controls.
4. Primary student controls must remain reachable above the bottom safe area/browser bar.
5. Touch targets should normally be at least 44–48 CSS px high.
6. Form controls must remain readable on iPhone without unintended zoom; student-facing inputs use a mobile-safe font size.
7. Dialogs, result cards, and overlays must scroll internally when content is taller than the visible viewport.
8. Gameplay HUD must not cover the target object, camera landmarks, coach instructions, or required action area.
9. Nested same-origin game wrappers must apply the shared responsive runtime through to the deepest game frame.
10. Responsive changes must not alter scoring, completion policy, Firebase receipts, learning analytics, or progression eligibility.

Shared runtime: `./assets/hh-responsive-runtime-v1.js`

## Student-facing policy

- Thai wording must be short, concrete, and suitable for Grade 5 students.
- Do not show developer wording such as Production, Final, QA, Debug, Research Analytics, version numbers, receiver names, or backend internals during normal student play.
- Start screen must state what the student should do in one or two sentences.
- One clear primary start button.
- Remove Touch Mode, Demo Mode, QA controls, advanced settings, and teacher/export controls from student mode.
- Result screen must begin with `เล่นครบหนึ่งรอบแล้ว` or the game-specific equivalent.
- Mission completion and skill achievement are separate concepts.
- One completed classroom round may advance the Passport only after the active authority confirms the result.
- Low score, low accuracy, or an unfinished optional challenge must not force replay unless the research protocol explicitly requires it.
- Hide replay, retry, Boss retry, cooldown, back-to-zone, and back-to-sub-hub actions in Classroom Mode.
- The only exit path after completion is `กลับ Passport` through the Classroom Game Shell.
- Direct QA links must clearly state that they do not change Passport progress.

## Shared wording

| English or technical wording | Student wording |
|---|---|
| Accuracy | ความแม่นยำ |
| Total Score | คะแนนรวม |
| Best Combo | คอมโบสูงสุด |
| Reason | ตอบเหตุผล |
| Retry Transfer | ประยุกต์ใช้ |
| Reflection | ทบทวนสิ่งที่เรียนรู้ |
| Training | รอบฝึก |
| Challenge | รอบท้าทาย |
| Boss | ด่านเสริม |
| Level | ระดับ |
| Phase | รอบ |
| HP | พลัง |

## Required result message

`เล่นครบหนึ่งรอบแล้ว • ระบบจะบันทึกผลและกลับ Passport อัตโนมัติ • ไม่ต้องเล่นซ้ำ`

## Per-game start copy

- **Handwash AR:** ทำตามขั้นตอนล้างมือให้ครบและถูกลำดับ
- **Toothbrush Challenge:** แปรงฟันให้ทั่วทุกบริเวณตามคำแนะนำ
- **Groups AR:** ใช้นิ้วชี้จัดอาหารลงในหมู่ที่ถูกต้อง
- **GoodJunk Hand AR:** ใช้นิ้วชี้เลือกอาหารที่เหมาะสมตามโจทย์
- **JumpDuck AR:** ขยับร่างกายตามโจทย์ในพื้นที่ที่ปลอดภัย
- **Balance Hold AR:** ยืนทรงตัวตามท่าที่แสดงโดยไม่ต้องฝืน

## Verification matrix

### PC smoke

Test both:

1. `Passport → Assessment / Game → Result → Firebase → Passport` with `smoke=1`.
2. `Game Test Mode → each of 6 games → Result → Game Test Mode` and verify `affectsProgression=false`.

Confirm:

- Passport, assessment, result, summary, reflection, and certificate resize without horizontal clipping;
- all six games open through the responsive Game Shell;
- start/result controls remain visible;
- nested wrappers do not lose the responsive runtime;
- Firebase route/receipt status is preserved;
- Game Test attempts do not unlock progression.

### Mobile production acceptance

For every game, repeat on the actual target phone:

`Passport → Game Shell → Game → Result → Firebase → Passport`

Confirm:

- the game fits the phone screen in the intended orientation;
- camera permission path is clear;
- required hand/pose/body action is detectable;
- browser bars and safe areas do not hide student controls;
- the result is saved once with a unique event ID;
- Passport progress changes only after Firebase authority confirms it;
- direct QA testing does not change Passport progress.
