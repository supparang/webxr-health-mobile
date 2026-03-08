# HeroHealth • GoodJunk Handoff Summary
PATCH v20260307-GJ-HANDOFF-SUMMARY

เอกสารนี้ใช้สำหรับส่งต่องาน GoodJunk Classroom Suite ให้ผู้รับช่วงต่อ
โดยสรุปเฉพาะสิ่งที่ต้องรู้จริง เพื่อให้เริ่มใช้งาน ดูแล และแก้ปัญหาเบื้องต้นได้เร็ว

---

## 1) ระบบนี้คืออะไร

GoodJunk Classroom Suite คือชุดหน้าเว็บสำหรับใช้เกม GoodJunk ในห้องเรียนจริง โดยรองรับ

- ครูควบคุมห้อง
- นักเรียนเข้าเล่นผ่านลิงก์หรือ QR
- จอหน้า class แสดงผลสด
- battle room แบบ realtime
- attendance / roster / coverage
- announcement / room policy
- start / end class macros

---

## 2) ถ้าจะใช้จริงแบบง่ายที่สุด ให้ใช้ 3 หน้าเท่านี้

### เครื่องครู
- `goodjunk-teacher-essential.html`

### จอหน้า class / โปรเจกเตอร์
- `goodjunk-kiosk.html`

### นักเรียน
- `student-join-goodjunk.html`

นี่คือชุดใช้งานหลักที่สุด

---

## 3) หน้าแต่ละตัวเอาไว้ทำอะไร

### เมนูกลาง
- `goodjunk-index.html`
  - รวมทุกทางเข้าในหน้าเดียว

### launcher
- `goodjunk-launcher.html`
  - เปิด Teacher / Board / Student Join / Run ได้เร็ว

### ครูแบบเต็ม
- `goodjunk-teacher.html`
  - เครื่องมือครบที่สุด
  - ใช้เวลาแก้ปัญหา / export / ดูข้อมูลละเอียด

### ครูแบบย่อ
- `goodjunk-teacher-essential.html`
  - เหมาะกับใช้จริงในห้องเรียน
  - ปุ่มไม่เยอะ

### board เต็ม
- `goodjunk-board.html`
  - จอแสดงผลเต็ม

### board ย่อ
- `goodjunk-board-essential.html`
  - เรียบ ใช้กับโปรเจกเตอร์ได้ง่าย

### kiosk
- `goodjunk-kiosk.html`
  - เหมาะกับจอหน้า class
  - มี clean mode / hide UI / fullscreen

### student join
- `student-join-goodjunk.html`
  - ทางเข้านักเรียน
  - ตรวจ duplicate PID / room policy / attendance

### run page
- `vr-goodjunk/goodjunk-vr.html`
  - หน้าเข้าเล่นเกมจริง

### game engine
- `vr-goodjunk/goodjunk.safe.js`
  - logic เกมหลัก

### battle infra
- `vr/battle-rtdb.js`
  - ระบบห้อง battle / sync / policy / announcement / rematch

---

## 4) ลำดับเปิดใช้งานจริง

### ก่อนเริ่มคาบ
1. ครูเปิด `goodjunk-teacher-essential.html`
2. จอหน้า class เปิด `goodjunk-kiosk.html`
3. ส่งลิงก์หรือ QR ของ `student-join-goodjunk.html` ให้นักเรียน
4. เช็กให้ทุกหน้าตั้ง room ตรงกัน

### ตอนเริ่มคาบ
5. ครูกด `Start Class Macro`

### ระหว่างคาบ
6. นักเรียนเข้าเล่น
7. board แสดงผลสด
8. ครูใช้ announcement / lock room / spectator only ตามต้องการ

### ตอนจบคาบ
9. ครูกด `End Class Macro`

---

## 5) สิ่งที่ “ห้ามลืม” ที่สุด

### 5.1 room ต้องตรงกันทุกหน้า
เช่น
- teacher = P5A
- kiosk = P5A
- student join = P5A
- run page = P5A

ถ้า room ไม่ตรง ระบบจะเหมือนพัง ทั้งที่จริง ๆ อยู่คนละห้อง

### 5.2 ต้องมี Firebase config ที่ใช้ได้
ไฟล์สำคัญ:
- `firebase-config.js`

ถ้าไฟล์นี้ใช้ไม่ได้ จะกระทบแทบทุกอย่าง:
- battle
- board realtime
- attendance
- announcement
- policy

### 5.3 นักเรียนควรเข้าผ่าน Student Join
ไม่ควรส่ง run page ตรงในคลาสจริง
เพราะ Student Join ทำหน้าที่:
- ตรวจ duplicate PID
- ตรวจ room policy
- เขียน attendance
- คุม query params

---

## 6) ปุ่มที่ครูใช้บ่อยที่สุด

### จาก Teacher Essential
- เปิด Board
- เปิด Student Join
- แสดง QR
- Start Class Macro
- End Class Macro
- Lock Room
- Spectator Only
- Unlock Room

ถ้าใช้จริงหน้างาน ส่วนมากใช้แค่นี้

---

## 7) Winner ตัดสินยังไง

ลำดับตัดสินผู้ชนะคือ

1. `score`
2. `acc`
3. `miss`
4. `medianRT`

ถ้ายังเท่ากัน = tie

---

## 8) ถ้ามีปัญหา ให้เช็กอะไรเป็นอันดับแรก

### board ไม่ขึ้น
เช็ก:
- room ตรงกันไหม
- Firebase config ถูกไหม
- internet ปกติไหม
- ลองเปิด `goodjunk-board-essential.html`

### student join เข้าไม่ได้
เช็ก:
- room policy ล็อกอยู่ไหม
- spectator only เปิดอยู่ไหม
- query params ถูกไหม

### battle ไม่เริ่ม
เช็ก:
- ผู้เล่นอยู่ room เดียวกันไหม
- ready ครบไหม
- ใช้ Force Countdown / Force Start ได้ไหม

### winner แปลก
เช็ก:
- score
- acc
- miss
- medianRT

---

## 9) ถ้าหน้าเต็มพัง ให้ fallback ไปอะไร

### teacher เต็มพัง
ใช้:
- `goodjunk-teacher-essential.html`

### board เต็มพัง
ใช้:
- `goodjunk-board-essential.html`
หรือ
- `goodjunk-kiosk.html`

### index / launcher พัง
เปิดหน้าหลักตรงเป็นรายหน้าได้เลย

---

## 10) เอกสารที่ควรเปิดคู่กัน

### ถ้าจะใช้งานจริง
- `GOODJUNK-QUICKSTART.md`
- `GOODJUNK-CHECKLIST.md`

### ถ้าจะดูภาพรวมระบบ
- `GOODJUNK-CLASSROOM-README.md`
- `GOODJUNK-FLOW.md`

### ถ้าจะ deploy / debug / handoff
- `GOODJUNK-DEPLOYMENT-NOTES.md`
- `GOODJUNK-TEST-LOG.md`

---

## 11) Minimal Operating Summary

ถ้าต้องอธิบายให้คนใหม่ใน 30 วินาที:

- ครูใช้ `goodjunk-teacher-essential.html`
- จอหน้า class ใช้ `goodjunk-kiosk.html`
- นักเรียนเข้า `student-join-goodjunk.html`
- ทุกหน้าต้องใช้ room เดียวกัน
- เริ่มด้วย `Start Class Macro`
- จบด้วย `End Class Macro`

---

## 12) สถานะงานโดยรวม

ตอนนี้ GoodJunk classroom suite มีครบแล้วในระดับใช้งานจริง ประกอบด้วย

- navigation pages
- teacher pages
- board pages
- kiosk page
- student join page
- run page
- safe game engine
- battle RTDB infra
- QR helper
- docs / checklist / quickstart / flow / deployment / test log

ถือว่าเป็นชุดที่พร้อมสำหรับ:
- classroom dry run
- pilot
- real classroom deployment
- research session support

---

## 13) งานที่ควรทำต่อ “ถ้าจะพัฒนาต่อ”

งานต่อยอดที่น่าทำ แต่ไม่จำเป็นต่อการใช้งานพื้นฐานทันที:

- teacher summary analytics ให้ลึกขึ้น
- printable classroom report
- better QR poster templates
- auto room creation helpers
- richer spectator mode
- deployment/version badge บนทุกหน้า
- session archive browser
- tighter research export integration

---

## 14) สรุปสุดท้าย

ระบบนี้ใช้งานได้ดีที่สุดเมื่อจำหลักแค่นี้:

- ใช้ Teacher Essential + Kiosk + Student Join
- room ต้องตรงกัน
- Firebase ต้องใช้ได้
- เริ่มด้วย Start Class Macro
- จบด้วย End Class Macro

จบเอกสาร