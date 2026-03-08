# HeroHealth • GoodJunk Test Log
PATCH v20260307-GJ-TEST-LOG

เอกสารนี้ใช้บันทึกผลการทดสอบ GoodJunk Classroom Suite
เพื่อเก็บประวัติการทดสอบ แยกตามวัน / เวอร์ชัน / ผู้ทดสอบ / สถานการณ์ใช้งาน

---

## วิธีใช้เอกสารนี้

ให้เพิ่ม section ใหม่ทุกครั้งที่มีการทดสอบรอบสำคัญ เช่น
- หลัง patch ใหญ่
- ก่อนใช้งานจริง
- หลัง deploy production
- หลังแก้ bug battle / board / join / teacher
- หลังเปลี่ยน firebase / RTDB / path

---

# TEST ENTRY TEMPLATE

## Test ID
- Test ID: ______________________________
- วันที่: ________________________________
- เวลา: _________________________________
- ผู้ทดสอบ: _____________________________
- สถานที่ / เครื่อง: ______________________
- ประเภทการทดสอบ:
  - [ ] local test
  - [ ] staging test
  - [ ] production test
  - [ ] classroom dry run
  - [ ] real classroom session
  - [ ] bug reproduction
  - [ ] regression test

---

## Version / Patch
- branch / source: _______________________
- version / patch tag: ____________________
- commit / note: _________________________

---

## Environment
- URL base: _____________________________
- Room: _________________________________
- Browser: ______________________________
- Device:
  - [ ] desktop
  - [ ] laptop
  - [ ] mobile
  - [ ] tablet
  - [ ] projector PC
  - [ ] smart TV browser
- Network:
  - [ ] Wi-Fi
  - [ ] mobile internet
  - [ ] LAN
  - [ ] hotspot

---

## Files Under Test
- [ ] `goodjunk-index.html`
- [ ] `goodjunk-launcher.html`
- [ ] `goodjunk-teacher.html`
- [ ] `goodjunk-teacher-essential.html`
- [ ] `goodjunk-board.html`
- [ ] `goodjunk-board-essential.html`
- [ ] `goodjunk-kiosk.html`
- [ ] `student-join-goodjunk.html`
- [ ] `vr-goodjunk/goodjunk-vr.html`
- [ ] `vr-goodjunk/goodjunk.safe.js`
- [ ] `vr/battle-rtdb.js`
- [ ] `lib/qr-local-first.js`

---

## Test Scope
อธิบายว่ารอบนี้ตั้งใจทดสอบอะไร
________________________________________________
________________________________________________
________________________________________________

---

## A) Smoke Test

### A1. Page Load
- [ ] index เปิดได้
- [ ] launcher เปิดได้
- [ ] teacher เปิดได้
- [ ] teacher essential เปิดได้
- [ ] board เปิดได้
- [ ] board essential เปิดได้
- [ ] kiosk เปิดได้
- [ ] student join เปิดได้
- [ ] run page เปิดได้

หมายเหตุ:
________________________________________________
________________________________________________

### A2. Asset Load
- [ ] `firebase-config.js` โหลดได้
- [ ] `goodjunk.safe.js` โหลดได้
- [ ] `battle-rtdb.js` โหลดได้
- [ ] `qr-local-first.js` โหลดได้

หมายเหตุ:
________________________________________________
________________________________________________

---

## B) Student Join Test

### B1. Basic Join
- [ ] room รับจาก query ได้
- [ ] view รับจาก query ได้
- [ ] diff รับจาก query ได้
- [ ] time รับจาก query ได้
- [ ] hub รับจาก query ได้
- [ ] lock_room ทำงาน
- [ ] lock_view ทำงาน
- [ ] lock_diff ทำงาน
- [ ] lock_time ทำงาน

### B2. Validation
- [ ] duplicate PID เตือน
- [ ] room policy ตรวจสอบได้
- [ ] room locked กันเข้าได้
- [ ] spectator only redirect/use button ได้

### B3. Attendance
- [ ] attendance source=`student-join` ถูกบันทึก
- [ ] attendance source=`game-run` ถูกบันทึกหลังเข้าเกม

หมายเหตุ:
________________________________________________
________________________________________________
________________________________________________

---

## C) Battle Room Test

### C1. Join Room
- [ ] player 1 เข้าได้
- [ ] player 2 เข้าได้
- [ ] spectator เข้าได้
- [ ] room full policy ทำงาน
- [ ] late join behavior ถูกต้อง

### C2. State Flow
- [ ] lobby
- [ ] countdown
- [ ] running
- [ ] ended
- [ ] rematch -> lobby ใหม่

### C3. Sync
- [ ] score sync
- [ ] acc sync
- [ ] miss sync
- [ ] finishMs sync
- [ ] disconnected state sync

หมายเหตุ:
________________________________________________
________________________________________________
________________________________________________

---

## D) Winner Rule Test

### D1. Decision Chain
- [ ] ตัดสินด้วย score ถูกต้อง
- [ ] ถ้า score เท่ากัน ใช้ acc ถูกต้อง
- [ ] ถ้า acc เท่ากัน ใช้ miss ถูกต้อง
- [ ] ถ้า miss เท่ากัน ใช้ medianRT ถูกต้อง
- [ ] tie ทำงานถูกต้อง

### D2. UI
- [ ] end overlay แสดง rule ถูกต้อง
- [ ] compare table แสดงถูกต้อง
- [ ] board แสดง winner ถูกต้อง
- [ ] kiosk highlight winner ถูกต้อง

หมายเหตุ:
________________________________________________
________________________________________________
________________________________________________

---

## E) Rematch Test

### E1. Request / Accept / Decline
- [ ] request rematch ได้
- [ ] อีกฝ่าย accept ได้
- [ ] อีกฝ่าย decline ได้
- [ ] rematch status แสดงถูกต้อง

### E2. Reset
- [ ] roundId ใหม่
- [ ] score reset
- [ ] ready reset
- [ ] กลับ lobby ได้
- [ ] เริ่มรอบใหม่ได้

หมายเหตุ:
________________________________________________
________________________________________________
________________________________________________

---

## F) Teacher Control Test

### F1. Essential Page
- [ ] เปิด board ได้
- [ ] เปิด student join ได้
- [ ] แสดง QR ได้
- [ ] copy link ได้
- [ ] start class macro ได้
- [ ] end class macro ได้
- [ ] lock room ได้
- [ ] spectator only ได้
- [ ] unlock room ได้

### F2. Full Dashboard
- [ ] force countdown ได้
- [ ] force start ได้
- [ ] reset room ได้
- [ ] reset scores only ได้
- [ ] clear rematch ได้
- [ ] end round now ได้
- [ ] force winner p1 ได้
- [ ] force winner p2 ได้

หมายเหตุ:
________________________________________________
________________________________________________
________________________________________________

---

## G) Announcement / Policy Test

### G1. Announcement
- [ ] send message ได้
- [ ] clear message ได้
- [ ] tone info ใช้งานได้
- [ ] tone success ใช้งานได้
- [ ] tone warn ใช้งานได้
- [ ] tone danger ใช้งานได้
- [ ] ttl หมดแล้วหาย

### G2. Room Policy
- [ ] room lock ใช้งานได้
- [ ] spectator only ใช้งานได้
- [ ] unlock ใช้งานได้
- [ ] policy message แสดงใน student join ได้

หมายเหตุ:
________________________________________________
________________________________________________
________________________________________________

---

## H) Board / Kiosk Test

### H1. Board
- [ ] room แสดงถูกต้อง
- [ ] phase แสดงถูกต้อง
- [ ] round แสดงถูกต้อง
- [ ] scoreboard แสดงถูกต้อง
- [ ] winner spotlight ทำงาน
- [ ] room summary แสดงถูกต้อง
- [ ] auto cycle ทำงาน
- [ ] projector mode ทำงาน
- [ ] kiosk mode/show-ui ทำงาน

### H2. Board Essential
- [ ] scoreboard 2 คน แสดงถูกต้อง
- [ ] progress ทั้งห้องถูกต้อง
- [ ] winner แสดงถูกต้อง
- [ ] announcement แสดงถูกต้อง

### H3. Kiosk
- [ ] clean mode ทำงาน
- [ ] hide UI ทำงาน
- [ ] fullscreen ทำงาน
- [ ] controls reveal on interaction ทำงาน

หมายเหตุ:
________________________________________________
________________________________________________
________________________________________________

---

## I) Roster / Attendance / Coverage Test

### I1. Roster
- [ ] save local roster ได้
- [ ] push roster cloud ได้
- [ ] pull roster cloud ได้
- [ ] clear roster ได้
- [ ] clear cloud roster ได้
- [ ] export roster CSV ได้

### I2. Attendance
- [ ] refresh attendance ได้
- [ ] clear attendance ได้
- [ ] export attendance CSV ได้

### I3. Coverage
- [ ] attendance vs roster ถูกต้อง
- [ ] joined count ถูกต้อง
- [ ] entered count ถูกต้อง
- [ ] absent count ถูกต้อง
- [ ] coverage percent ถูกต้อง

### I4. Baseline
- [ ] mark absent baseline ได้
- [ ] mark present baseline ได้
- [ ] clear baseline ได้
- [ ] export baseline CSV ได้

หมายเหตุ:
________________________________________________
________________________________________________
________________________________________________

---

## J) Export / Reporting Test

- [ ] export snapshot JSON ได้
- [ ] export snapshot CSV ได้
- [ ] export roster CSV ได้
- [ ] export attendance CSV ได้
- [ ] export status CSV ได้
- [ ] teacher summary report เปิดได้
- [ ] QR poster print ได้

หมายเหตุ:
________________________________________________
________________________________________________
________________________________________________

---

## K) Console / Network Check

### Console
- [ ] ไม่มี syntax error
- [ ] ไม่มี import error
- [ ] ไม่มี Firebase missing config
- [ ] ไม่มี permission denied
- [ ] ไม่มี error สำคัญค้าง

### Network
- [ ] ไม่มี 404 สำคัญ
- [ ] ไม่มี 500 สำคัญ
- [ ] ไม่มี blocked JS module
- [ ] assets หลักโหลดครบ

รายละเอียด:
________________________________________________
________________________________________________
________________________________________________

---

## L) Result Summary

### สรุปผลรอบนี้
- [ ] PASS
- [ ] PASS WITH MINOR ISSUES
- [ ] PARTIAL PASS
- [ ] FAIL

### จุดที่ผ่านดี
1. ______________________________________
2. ______________________________________
3. ______________________________________

### ปัญหาที่พบ
1. ______________________________________
2. ______________________________________
3. ______________________________________

### ระดับความรุนแรง
- [ ] ต่ำ
- [ ] กลาง
- [ ] สูง
- [ ] วิกฤต

### พร้อมใช้จริงหรือไม่
- [ ] พร้อม
- [ ] พร้อมแบบมีข้อควรระวัง
- [ ] ยังไม่พร้อม

---

## M) Fix Plan

### สิ่งที่ต้องแก้ต่อ
1. ______________________________________
2. ______________________________________
3. ______________________________________

### ไฟล์ที่ต้องแก้
- [ ] `goodjunk-index.html`
- [ ] `goodjunk-launcher.html`
- [ ] `goodjunk-teacher.html`
- [ ] `goodjunk-teacher-essential.html`
- [ ] `goodjunk-board.html`
- [ ] `goodjunk-board-essential.html`
- [ ] `goodjunk-kiosk.html`
- [ ] `student-join-goodjunk.html`
- [ ] `vr-goodjunk/goodjunk-vr.html`
- [ ] `vr-goodjunk/goodjunk.safe.js`
- [ ] `vr/battle-rtdb.js`
- [ ] `lib/qr-local-first.js`

### ผู้รับผิดชอบ
________________________________________________

### กำหนดแก้เสร็จ
________________________________________________

---

# TEST LOG ENTRIES

## Entry 001
- Test ID: __________________________________
- วันที่: ____________________________________
- ผู้ทดสอบ: _________________________________
- version: __________________________________
- สรุปผล: ___________________________________
- หมายเหตุ:
________________________________________________
________________________________________________

---

## Entry 002
- Test ID: __________________________________
- วันที่: ____________________________________
- ผู้ทดสอบ: _________________________________
- version: __________________________________
- สรุปผล: ___________________________________
- หมายเหตุ:
________________________________________________
________________________________________________

---

## Entry 003
- Test ID: __________________________________
- วันที่: ____________________________________
- ผู้ทดสอบ: _________________________________
- version: __________________________________
- สรุปผล: ___________________________________
- หมายเหตุ:
________________________________________________
________________________________________________

---

## Entry 004
- Test ID: __________________________________
- วันที่: ____________________________________
- ผู้ทดสอบ: _________________________________
- version: __________________________________
- สรุปผล: ___________________________________
- หมายเหตุ:
________________________________________________
________________________________________________

---

## Entry 005
- Test ID: __________________________________
- วันที่: ____________________________________
- ผู้ทดสอบ: _________________________________
- version: __________________________________
- สรุปผล: ___________________________________
- หมายเหตุ:
________________________________________________
________________________________________________

---

## สรุปการใช้งานเอกสารนี้

ใช้ไฟล์นี้ทุกครั้งเมื่อ:
- patch ใหม่
- deploy ใหม่
- ก่อนใช้จริง
- หลังเกิด bug
- หลังแก้ bug
- หลัง classroom dry run

เอกสารนี้ควรใช้คู่กับ:
- `GOODJUNK-CHECKLIST.md`
- `GOODJUNK-DEPLOYMENT-NOTES.md`
- `GOODJUNK-CLASSROOM-README.md`

จบเอกสาร