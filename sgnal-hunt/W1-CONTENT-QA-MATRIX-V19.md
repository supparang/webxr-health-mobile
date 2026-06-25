# CSAI2601 Week 1 — Case-by-Case Curriculum QA V19

## QA standard used

Each case is checked against the Week 1 UX Detective chain: **UI Symptom → UX Impact → Evidence-backed Improvement**. The game does not reveal the correct option; it makes the assessed reasoning explicit.

| Lens | Case ID | Casefile | Week 1 diagnostic check | QA status |
|---|---|---|---|---|
| Clarity | `bus-arrival` | bus-arrival | คำ ปุ่ม เมนู และจุดเริ่มงานชัดหรือไม่ | Mapped + in-game audit card |
| Clarity | `clinic-wayfinding` | clinic-wayfinding | คำ ปุ่ม เมนู และจุดเริ่มงานชัดหรือไม่ | Mapped + in-game audit card |
| Clarity | `event-checkin` | event-checkin | คำ ปุ่ม เมนู และจุดเริ่มงานชัดหรือไม่ | Mapped + in-game audit card |
| Clarity | `internship-start` | internship-start | คำ ปุ่ม เมนู และจุดเริ่มงานชัดหรือไม่ | Mapped + in-game audit card |
| Clarity | `lost-property` | lost-property | คำ ปุ่ม เมนู และจุดเริ่มงานชัดหรือไม่ | Mapped + in-game audit card |
| Clarity | `plain-language-alert` | plain-language-alert | คำ ปุ่ม เมนู และจุดเริ่มงานชัดหรือไม่ | Mapped + in-game audit card |
| Clarity | `repair-report` | คดี 07: เหตุเร่งด่วนที่ซ่อนอยู่หลังข่าว | คำ ปุ่ม เมนู และจุดเริ่มงานชัดหรือไม่ | Mapped + in-game audit card |
| Clarity | `scholarship-docs` | คดี 01: หลักฐานทุนหายระหว่างทาง | คำ ปุ่ม เมนู และจุดเริ่มงานชัดหรือไม่ | Mapped + in-game audit card |
| Cognitive Load | `caption-controls` | caption-controls | ผู้ใช้ต้องคิด จำ หรือเปรียบเทียบมากเกินหรือไม่ | Mapped + in-game audit card |
| Cognitive Load | `degree-check` | degree-check | ผู้ใช้ต้องคิด จำ หรือเปรียบเทียบมากเกินหรือไม่ | Mapped + in-game audit card |
| Cognitive Load | `health-appointment` | คดี 05: นัดตรวจอยู่ใต้ข่าวสุขภาพ | ผู้ใช้ต้องคิด จำ หรือเปรียบเทียบมากเกินหรือไม่ | Mapped + in-game audit card |
| Cognitive Load | `housing-compare` | housing-compare | ผู้ใช้ต้องคิด จำ หรือเปรียบเทียบมากเกินหรือไม่ | Mapped + in-game audit card |
| Cognitive Load | `lab-safety` | lab-safety | ผู้ใช้ต้องคิด จำ หรือเปรียบเทียบมากเกินหรือไม่ | Mapped + in-game audit card |
| Cognitive Load | `plain-language-form` | plain-language-form | ผู้ใช้ต้องคิด จำ หรือเปรียบเทียบมากเกินหรือไม่ | Mapped + in-game audit card |
| Cognitive Load | `research-consent` | research-consent | ผู้ใช้ต้องคิด จำ หรือเปรียบเทียบมากเกินหรือไม่ | Mapped + in-game audit card |
| Cognitive Load | `screen-reader-menu` | screen-reader-menu | ผู้ใช้ต้องคิด จำ หรือเปรียบเทียบมากเกินหรือไม่ | Mapped + in-game audit card |
| Consistency | `advisor-booking` | คดี 02: เวลานัดที่ไม่มีใครมั่นใจ | คำศัพท์และสถานะคาดเดาได้หรือไม่ | Mapped + in-game audit card |
| Consistency | `aid-payment-authenticity` | aid-payment-authenticity | คำศัพท์และสถานะคาดเดาได้หรือไม่ | Mapped + in-game audit card |
| Consistency | `fee-refund` | fee-refund | คำศัพท์และสถานะคาดเดาได้หรือไม่ | Mapped + in-game audit card |
| Consistency | `keyboard-checkout` | keyboard-checkout | คำศัพท์และสถานะคาดเดาได้หรือไม่ | Mapped + in-game audit card |
| Consistency | `medical-upload` | medical-upload | คำศัพท์และสถานะคาดเดาได้หรือไม่ | Mapped + in-game audit card |
| Consistency | `research-data` | research-data | คำศัพท์และสถานะคาดเดาได้หรือไม่ | Mapped + in-game audit card |
| Consistency | `scholarship-consent` | scholarship-consent | คำศัพท์และสถานะคาดเดาได้หรือไม่ | Mapped + in-game audit card |
| Consistency | `telehealth-privacy` | telehealth-privacy | คำศัพท์และสถานะคาดเดาได้หรือไม่ | Mapped + in-game audit card |
| Feedback | `activity-registration` | คดี 08: สมัครแล้วหรือยัง ที่เต็มหรือเปล่า | หลังการกระทำ ระบบบอกสถานะ/ก้าวถัดไปหรือไม่ | Mapped + in-game audit card |
| Feedback | `club-payment` | club-payment | หลังการกระทำ ระบบบอกสถานะ/ก้าวถัดไปหรือไม่ | Mapped + in-game audit card |
| Feedback | `color-only-status` | color-only-status | หลังการกระทำ ระบบบอกสถานะ/ก้าวถัดไปหรือไม่ | Mapped + in-game audit card |
| Feedback | `exam-seat` | exam-seat | หลังการกระทำ ระบบบอกสถานะ/ก้าวถัดไปหรือไม่ | Mapped + in-game audit card |
| Feedback | `graduation-rsvp` | graduation-rsvp | หลังการกระทำ ระบบบอกสถานะ/ก้าวถัดไปหรือไม่ | Mapped + in-game audit card |
| Feedback | `id-replacement` | id-replacement | หลังการกระทำ ระบบบอกสถานะ/ก้าวถัดไปหรือไม่ | Mapped + in-game audit card |
| Feedback | `parcel-locker` | parcel-locker | หลังการกระทำ ระบบบอกสถานะ/ก้าวถัดไปหรือไม่ | Mapped + in-game audit card |
| Feedback | `parking-renewal` | parking-renewal | หลังการกระทำ ระบบบอกสถานะ/ก้าวถัดไปหรือไม่ | Mapped + in-game audit card |
| Hierarchy | `course-registration` | คดี 04: ปุ่มที่ไม่บอกว่าจะยืนยันอะไร | งานหลักและข้อมูลสำคัญเด่นก่อนหรือไม่ | Mapped + in-game audit card |
| Hierarchy | `degree-audit` | degree-audit | งานหลักและข้อมูลสำคัญเด่นก่อนหรือไม่ | Mapped + in-game audit card |
| Hierarchy | `group-scheduler` | group-scheduler | งานหลักและข้อมูลสำคัญเด่นก่อนหรือไม่ | Mapped + in-game audit card |
| Hierarchy | `housing-renewal` | housing-renewal | งานหลักและข้อมูลสำคัญเด่นก่อนหรือไม่ | Mapped + in-game audit card |
| Hierarchy | `lab-booking` | lab-booking | งานหลักและข้อมูลสำคัญเด่นก่อนหรือไม่ | Mapped + in-game audit card |
| Hierarchy | `library-search` | คดี 03: ฐานข้อมูลที่มากเกินจนเริ่มไม่ถูก | งานหลักและข้อมูลสำคัญเด่นก่อนหรือไม่ | Mapped + in-game audit card |
| Hierarchy | `meal-plan` | meal-plan | งานหลักและข้อมูลสำคัญเด่นก่อนหรือไม่ | Mapped + in-game audit card |
| Hierarchy | `waitlist-explainer` | waitlist-explainer | งานหลักและข้อมูลสำคัญเด่นก่อนหรือไม่ | Mapped + in-game audit card |
| Recovery | `dorm-access` | dorm-access | เมื่อพลาด ระบบช่วยแก้และกลับสู่งานได้หรือไม่ | Mapped + in-game audit card |
| Recovery | `equipment-return` | equipment-return | เมื่อพลาด ระบบช่วยแก้และกลับสู่งานได้หรือไม่ | Mapped + in-game audit card |
| Recovery | `exam-upload-fail` | exam-upload-fail | เมื่อพลาด ระบบช่วยแก้และกลับสู่งานได้หรือไม่ | Mapped + in-game audit card |
| Recovery | `exam-version-conflict` | exam-version-conflict | เมื่อพลาด ระบบช่วยแก้และกลับสู่งานได้หรือไม่ | Mapped + in-game audit card |
| Recovery | `password-lockout` | password-lockout | เมื่อพลาด ระบบช่วยแก้และกลับสู่งานได้หรือไม่ | Mapped + in-game audit card |
| Recovery | `password-recovery` | password-recovery | เมื่อพลาด ระบบช่วยแก้และกลับสู่งานได้หรือไม่ | Mapped + in-game audit card |
| Recovery | `project-upload` | คดี 06: ไฟล์สุดท้ายที่ไม่มีใครกล้ายืนยัน | เมื่อพลาด ระบบช่วยแก้และกลับสู่งานได้หรือไม่ | Mapped + in-game audit card |
| Recovery | `wrong-course-drop` | wrong-course-drop | เมื่อพลาด ระบบช่วยแก้และกลับสู่งานได้หรือไม่ | Mapped + in-game audit card |

## Editorial safeguards applied in V19

- The learner sees the diagnostic lens and expected reasoning type before deciding, not the answer.
- Every case surfaces a compact audit card: UI Symptom, UX Impact, and Improvement Lens.
- Every Case Outcome Report repeats the same three-part chain so learners connect game decisions to Week 1 terminology.
- Accessibility, privacy, and trust remain contextual evidence. They are not substituted for the official six Week 1 lenses.

## Faculty review checkpoint

Use this matrix during the first classroom run to flag any wording that learners interpret differently from the intended lens. Revise a case only when the issue is ambiguity, not merely because learners find the decision demanding.