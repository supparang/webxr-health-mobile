# HeroHealth Classroom Game UI Standard

Version: `2026-07-30-HH-CLASSROOM-UI-STANDARD-V5`

## Scope

This standard applies to the official 60-minute, mobile-only classroom flow:

1. Handwash AR
2. Toothbrush Challenge
3. Groups AR
4. GoodJunk Hand AR
5. JumpDuck AR
6. Balance Hold AR

## Student-facing policy

- Portrait-first mobile UI for Android and iPhone.
- Thai wording must be short, concrete, and suitable for Grade 5 students.
- Do not show developer wording such as Production, Final, QA, Debug, Research Analytics, version numbers, receiver names, or sheet internals.
- Start screen must state what the student should do in one or two sentences.
- One clear primary start button.
- Remove Touch Mode, Demo Mode, QA controls, advanced settings, and teacher/export controls from student mode.
- Gameplay HUD must not cover important objects, camera landmarks, or required actions.
- Result screen must begin with `เล่นครบหนึ่งรอบแล้ว` or the game-specific equivalent.
- Mission completion and skill achievement are separate concepts.
- One completed classroom round may advance the Passport after Google Sheet authority confirms the result.
- Low score, low accuracy, or an unfinished optional challenge must not force replay.
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

## Verification checklist

Each game must be tested through:

`Passport → Game Shell → Game → Result → Google Sheet → Passport`

Confirm that:

- the game fits a phone screen;
- the camera permission path is clear;
- the required gesture or body action is detectable;
- no student controls are hidden behind browser bars or HUD panels;
- the result is saved once with a unique event ID;
- Passport progress changes only after Sheet authority confirms it;
- direct QA testing does not change Passport progress.
