# HeroHealth Passport — Final E2E & Day-of Checklist

**Checklist Version:** 2026-08-15 • Production Flow Lock Candidate

## A. ก่อนวันเก็บข้อมูล

- [ ] Production URL เปิดได้จากมือถือจริง
- [ ] Firebase Auth / Firestore Rules รองรับ real student collections
- [ ] รายชื่อนักเรียนจริงถูกต้องและไม่มี test ID ปน
- [ ] Test IDs 990001–990029 ยังแยก Sandbox จากข้อมูลจริง
- [ ] Pre-test และ Post-test เป็น 15 ข้อรุ่นที่ล็อกแล้ว
- [ ] Post-experience เป็น P5 Visual Thai UI และยังเก็บค่า 1–5 เดิม
- [ ] Reflection ใช้ HeroHealth green/teal theme
- [ ] Reward: 6 Mission Badges + 3 Zone Badges + HeroHealth Champion
- [ ] Certificate แสดงคะแนนเป็น x/15 และภารกิจ x/6
- [ ] ไม่มี release/debug/Firebase infrastructure text บนหน้าสำเร็จของเด็ก

## B. Clean E2E ด้วย test ID ใหม่

- [ ] Login
- [ ] Pre-test save + return
- [ ] Game 1 save + auto return + next unlock
- [ ] Game 2 save + auto return + next unlock
- [ ] Game 3 save + auto return + next unlock
- [ ] Game 4 save + auto return + next unlock
- [ ] Game 5 save + auto return + next unlock
- [ ] Game 6 save + auto return
- [ ] Champion Celebration แสดงก่อน Post-test
- [ ] Post-test save + return
- [ ] Post-experience save + return Passport
- [ ] Reflection unlock + save + return Passport
- [ ] Mission Summary แสดง 6/6
- [ ] Certificate เปิดได้และแสดงชื่อ/คะแนน/Certificate ID ถูกต้อง
- [ ] Logout → Login ใหม่ → progress restore ถูกต้อง
- [ ] ไม่ต้อง Refresh ด้วยตนเองใน flow ปกติ

## C. Mobile QA

- [ ] Android Chrome
- [ ] กล้องเปิดได้ใน JumpDuck / Balance / เกมที่ใช้ AR
- [ ] Balance Hold ได้ยินคำสั่งภาษาไทย หรือมี visual instruction ใช้งานได้ชัด
- [ ] ไม่มีปุ่ม/ข้อความตกขอบ
- [ ] Post-experience emoji 5 ระดับกดได้สะดวก
- [ ] Certificate อ่านได้และ Print/Save PDF ได้

## D. ก่อนเริ่มแต่ละรอบวันจริง

- [ ] Wi-Fi/Internet พร้อม
- [ ] เปิด Teacher Console / Live Classroom ในเครื่องผู้ควบคุม
- [ ] ตรวจเวลาของอุปกรณ์
- [ ] พื้นที่เกมเคลื่อนไหวปลอดภัย
- [ ] ผู้ช่วยทุกคนมี Facilitator Script
- [ ] มี Incident / Protocol Deviation log พร้อมใช้

## E. เกณฑ์ Production Lock

Production Lock ได้เมื่อ Clean E2E ผ่านครบ, real Firestore Rules ยืนยันแล้ว, mobile smoke test ผ่าน และไม่มี Critical bug ด้าน login, progress, save, unlock, return, assessment หรือ certificate

หลัง Production Lock: **ห้ามเปลี่ยน wording, item bank, scoring, schema, game completion policy หรือ intervention flow** ระหว่างเก็บข้อมูลจริง ยกเว้น critical safety/system bug และต้องบันทึก deviation ทุกครั้ง
