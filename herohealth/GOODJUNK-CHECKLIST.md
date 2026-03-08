# HeroHealth • GoodJunk Classroom Checklist
PATCH v20260307-GJ-CHECKLIST

เอกสารนี้ใช้เป็น checklist ก่อนใช้งาน GoodJunk ในห้องเรียนจริง
เหมาะสำหรับครู ผู้ช่วยวิจัย และทีมติดตั้งระบบ

---

## 1) Checklist ก่อนวันใช้งาน

### 1.1 ระบบและไฟล์
- [ ] อัปโหลดไฟล์ล่าสุดขึ้น GitHub Pages / server แล้ว
- [ ] `firebase-config.js` ใช้งานได้จริง
- [ ] เปิด `goodjunk-index.html` ได้
- [ ] เปิด `goodjunk-teacher.html` ได้
- [ ] เปิด `goodjunk-teacher-essential.html` ได้
- [ ] เปิด `goodjunk-board.html` ได้
- [ ] เปิด `goodjunk-board-essential.html` ได้
- [ ] เปิด `goodjunk-kiosk.html` ได้
- [ ] เปิด `student-join-goodjunk.html` ได้
- [ ] เปิด `vr-goodjunk/goodjunk-vr.html` ได้
- [ ] โหลด `vr-goodjunk/goodjunk.safe.js` ได้
- [ ] โหลด `vr/battle-rtdb.js` ได้
- [ ] โหลด `lib/qr-local-first.js` ได้

### 1.2 Firebase / RTDB
- [ ] Firebase config ถูกต้อง
- [ ] RTDB rules อนุญาต path ที่ใช้
- [ ] path `hha-battle/goodjunk/rooms/...` อ่าน/เขียนได้
- [ ] board อ่านข้อมูลจาก RTDB ได้
- [ ] teacher เขียน policy / announcement ได้
- [ ] student join เขียน attendance ได้
- [ ] run page sync score ได้

### 1.3 อุปกรณ์
- [ ] เครื่องครูพร้อมใช้งาน
- [ ] จอโปรเจกเตอร์ / TV พร้อมใช้งาน
- [ ] อินเทอร์เน็ตเสถียร
- [ ] นักเรียนมีมือถือ/อุปกรณ์พอ
- [ ] เสียง/หน้าจอ/ความสว่างเหมาะสม

---

## 2) Checklist ตอนเริ่มติดตั้งหน้าห้อง

### 2.1 เครื่องครู
- [ ] เปิด `goodjunk-teacher-essential.html` หรือ `goodjunk-teacher.html`
- [ ] ตั้ง `room` ถูกต้อง
- [ ] ตั้ง `view` / `diff` / `time` ถูกต้อง
- [ ] ทดสอบปุ่มเปิด Board ได้
- [ ] ทดสอบปุ่มเปิด Student Join ได้

### 2.2 จอหน้าห้อง
- [ ] เปิด `goodjunk-kiosk.html` หรือ `goodjunk-board-essential.html`
- [ ] room ตรงกับเครื่องครู
- [ ] ขึ้น phase / room ได้ถูกต้อง
- [ ] fullscreen ได้
- [ ] clean mode / hide UI ใช้งานได้
- [ ] จอไม่ sleep ระหว่างคาบ

### 2.3 ลิงก์นักเรียน
- [ ] เปิดลิงก์ `student-join-goodjunk.html` ได้
- [ ] room ถูกล็อกจาก query แล้ว
- [ ] ค่า view / diff / time ถูกส่งมาถูกต้อง
- [ ] copy link ได้
- [ ] QR แสดงผลได้
- [ ] สแกน QR แล้วเข้าได้จริง

---

## 3) Checklist ก่อนเริ่มคาบ

### 3.1 ฝั่งครู
- [ ] เปิด room ที่ถูกต้อง
- [ ] เปิด board บนจอหน้า class แล้ว
- [ ] นำส่งลิงก์หรือ QR ให้นักเรียนแล้ว
- [ ] นักเรียนเริ่มเข้า Student Join ได้
- [ ] announcement ใช้งานได้
- [ ] policy status แสดงผลปกติ

### 3.2 ฝั่งนักเรียน
- [ ] นักเรียนกรอกชื่อ / PID ได้
- [ ] duplicate PID เตือนเมื่อซ้ำ
- [ ] room policy ตรวจสอบได้
- [ ] เข้าเกมได้จริง
- [ ] source `student-join` ถูกบันทึก
- [ ] source `game-run` ถูกบันทึกหลังเข้า run page

### 3.3 ฝั่งจอแสดงผล
- [ ] Board แสดง players ได้
- [ ] Board แสดง phase ได้
- [ ] Board แสดง joined / entered progress ได้
- [ ] announcement แสดงบน board ได้

---

## 4) Checklist ระหว่างคาบ

### 4.1 Battle / Gameplay
- [ ] ผู้เล่นเข้า room เดียวกัน
- [ ] countdown ทำงาน
- [ ] battle เริ่มได้
- [ ] score sync แบบ realtime
- [ ] ready status sync ได้
- [ ] finishMs sync ได้
- [ ] winner ตัดสินได้

### 4.2 Board / Kiosk
- [ ] scoreboard อัปเดตสด
- [ ] announcement banner ทำงาน
- [ ] winner spotlight แสดงหลังจบรอบ
- [ ] progress joined / entered อัปเดต
- [ ] board ไม่ค้าง
- [ ] kiosk ไม่หลุด fullscreen เอง

### 4.3 Teacher Control
- [ ] Start Class Macro ใช้งานได้
- [ ] End Class Macro ใช้งานได้
- [ ] quick presets ใช้งานได้
- [ ] lock room ใช้งานได้
- [ ] spectator only ใช้งานได้
- [ ] unlock room ใช้งานได้

---

## 5) Checklist หลังจบรอบ

### 5.1 End Overlay
- [ ] ขึ้น end overlay
- [ ] แสดง score / acc / miss / time ถูกต้อง
- [ ] battle compare table ขึ้น
- [ ] rule การตัดสินขึ้นถูกต้อง
- [ ] rematch status ขึ้นถูกต้อง

### 5.2 Winner
- [ ] board แสดง winner ถูกต้อง
- [ ] teacher เห็น winner ถูกต้อง
- [ ] winner rule ตรงกับข้อมูล score/acc/miss/medianRT

### 5.3 Rematch
- [ ] กด rematch ได้
- [ ] อีกฝ่าย accept ได้
- [ ] decline ได้
- [ ] ถ้าทั้งสอง accept แล้วกลับ lobby รอบใหม่ได้

---

## 6) Checklist Attendance / Roster

### 6.1 Attendance
- [ ] attendance `student-join` ถูกบันทึก
- [ ] attendance `game-run` ถูกบันทึก
- [ ] teacher refresh attendance ได้
- [ ] export attendance CSV ได้

### 6.2 Roster
- [ ] save local roster ได้
- [ ] push roster cloud ได้
- [ ] pull roster cloud ได้
- [ ] clear roster ได้
- [ ] export roster CSV ได้

### 6.3 Coverage
- [ ] attendance vs roster แสดงได้
- [ ] joined count ถูกต้อง
- [ ] entered game count ถูกต้อง
- [ ] absent count ถูกต้อง
- [ ] coverage percentage ถูกต้อง

---

## 7) Checklist Announcement / Policy

### 7.1 Announcement
- [ ] ส่งข้อความได้
- [ ] clear ข้อความได้
- [ ] quick preset ใช้งานได้
- [ ] board รับข้อความ realtime
- [ ] tone info / success / warn / danger ใช้งานได้
- [ ] ttl หมดแล้วหายตามเวลา

### 7.2 Room Policy
- [ ] lock room แล้ว join ใหม่เข้าไม่ได้
- [ ] spectator only แล้ว join ใหม่ถูกพาไป spectator
- [ ] unlock room แล้วเข้าใหม่ได้
- [ ] message แสดงในหน้า student join

---

## 8) Checklist Export / Report

- [ ] export snapshot JSON ได้
- [ ] export snapshot CSV ได้
- [ ] export roster CSV ได้
- [ ] export attendance CSV ได้
- [ ] export roster status CSV ได้
- [ ] export baseline CSV ได้
- [ ] teacher summary report เปิดได้
- [ ] QR poster print ได้

---

## 9) Emergency Checklist ระหว่างคาบ

### ถ้า Board ไม่ขึ้น
- [ ] เช็ก room ตรงกันหรือไม่
- [ ] refresh board
- [ ] เช็ก firebase-config
- [ ] เช็ก internet
- [ ] ลองเปิด `goodjunk-board-essential.html`

### ถ้า Student Join เข้าไม่ได้
- [ ] เช็ก room policy ว่าล็อกอยู่หรือไม่
- [ ] เช็ก spectator only
- [ ] เช็กลิงก์ query ถูกต้องหรือไม่
- [ ] ลองเปิดลิงก์จาก index/launcher ใหม่

### ถ้า Battle ไม่เริ่ม
- [ ] เช็ก players พร้อมครบหรือไม่
- [ ] ใช้ Force Countdown
- [ ] ใช้ Force Start
- [ ] เช็ก RTDB sync

### ถ้า Winner แปลก
- [ ] ตรวจ score
- [ ] ตรวจ acc
- [ ] ตรวจ miss
- [ ] ตรวจ medianRT
- [ ] เช็ก rule ตามลำดับ score → acc → miss → medianRT

### ถ้า Kiosk มี UI เกะกะ
- [ ] กด Hide UI
- [ ] กด Clean Mode
- [ ] กด Fullscreen ใหม่

---

## 10) Recommended Minimal Setup

### แบบใช้งานจริงง่ายที่สุด
- [ ] ครูเปิด `goodjunk-teacher-essential.html`
- [ ] จอหน้า class เปิด `goodjunk-kiosk.html`
- [ ] นักเรียนเข้า `student-join-goodjunk.html`
- [ ] ครูกด `Start Class Macro`
- [ ] จบคาบกด `End Class Macro`

---

## 11) Final Ready Check

ก่อนเริ่มคาบจริง ให้ตอบคำถามนี้ครบ:

- [ ] room ถูกต้องหรือยัง
- [ ] จอหน้า class เปิดถูกหน้าหรือยัง
- [ ] นักเรียนมีลิงก์/QR แล้วหรือยัง
- [ ] teacher control ใช้งานได้หรือยัง
- [ ] battle sync ได้หรือยัง
- [ ] announcement ใช้งานได้หรือยัง
- [ ] attendance ถูกบันทึกหรือยัง
- [ ] พร้อมเริ่มคาบหรือยัง

ถ้าติ๊กครบทั้งหมด = พร้อมใช้งานจริง

จบเอกสาร