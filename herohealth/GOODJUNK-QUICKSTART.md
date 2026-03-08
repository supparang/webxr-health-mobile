# HeroHealth • GoodJunk Quick Start
PATCH v20260307-GJ-QUICKSTART

คู่มือเริ่มใช้งานแบบเร็วที่สุดสำหรับ GoodJunk Classroom Suite

---

## ใช้ 3 หน้าเท่านี้ก็พอ

### 1) เครื่องครู
เปิด:
- `goodjunk-teacher-essential.html`

### 2) จอหน้า class / โปรเจกเตอร์
เปิด:
- `goodjunk-kiosk.html`

### 3) นักเรียน
เข้า:
- `student-join-goodjunk.html`

---

## ขั้นตอนเริ่มคาบแบบเร็ว

### Step 1 — ครูเปิดหน้า Teacher Essential
ตรวจว่า:
- room ถูกต้อง
- view / diff / time ถูกต้อง

แนะนำค่าเริ่มต้น:
- room = `P5A`
- view = `mobile`
- diff = `easy`
- time = `80`

---

### Step 2 — เปิดจอหน้า class
บนโปรเจกเตอร์หรือทีวี เปิด:
- `goodjunk-kiosk.html?room=P5A`

ตรวจว่า:
- room ตรงกับเครื่องครู
- หน้า board ขึ้นปกติ
- fullscreen ได้

---

### Step 3 — ส่งลิงก์หรือ QR ให้นักเรียน
จากหน้า `goodjunk-teacher-essential.html`

กด:
- `เปิด Student Join`
หรือ
- `แสดง QR นักเรียน`

ให้นักเรียนเข้า:
- `student-join-goodjunk.html`

---

### Step 4 — นักเรียนเข้าเกม
นักเรียน:
- กรอกชื่อ / PID
- กดเข้าเล่น

ระบบจะ:
- เช็ก duplicate PID
- เช็ก room policy
- บันทึก attendance
- พาเข้าเกม

---

### Step 5 — เริ่มคาบ
ครูกด:
- `Start Class Macro`

ระบบจะทำให้:
1. clear announcement
2. unlock room
3. clear rematch
4. reset room
5. ส่งข้อความเริ่มคาบ
6. countdown 3 วินาที

---

### Step 6 — ระหว่างคาบ
ครูใช้ปุ่ม:
- `เริ่มใน 10 วิ`
- `หยุดก่อน`
- `สแกน QR ตอนนี้`
- `เข้าชมแทนได้`

ถ้าต้องคุมห้อง:
- `Lock Room`
- `Spectator Only`
- `Unlock Room`

---

### Step 7 — จบคาบ
ครูกด:
- `End Class Macro`

ระบบจะ:
1. เปิด spectator only
2. ส่งข้อความจบคาบ
3. ให้นักเรียนดูผลผ่าน board

---

## ถ้าอยากใช้แบบเต็ม
ใช้หน้าเหล่านี้เพิ่ม

### ครูแบบเต็ม
- `goodjunk-teacher.html`

### Board แบบเต็ม
- `goodjunk-board.html`

### เมนูกลาง
- `goodjunk-index.html`

### Launcher
- `goodjunk-launcher.html`

---

## ถ้ามีปัญหา ให้เช็ก 4 อย่างนี้ก่อน

### 1) room ต้องตรงกันทุกหน้า
เช่น:
- teacher = `P5A`
- kiosk = `P5A`
- student join = `P5A`

### 2) Firebase config ต้องใช้ได้
เช็กไฟล์:
- `firebase-config.js`

### 3) นักเรียนควรเข้าผ่าน Student Join
ไม่ควรส่ง run page ตรงในคลาสจริง

### 4) ถ้า board ไม่ขึ้น
ลอง:
- refresh
- เช็ก internet
- เช็ก room
- เปิด `goodjunk-board-essential.html`

---

## ลิงก์หลักที่ควร bookmark

- `goodjunk-index.html`
- `goodjunk-teacher-essential.html`
- `goodjunk-kiosk.html`
- `student-join-goodjunk.html`

---

## โหมดใช้งานที่แนะนำที่สุด

### แบบง่ายสุด
- ครู: `goodjunk-teacher-essential.html`
- จอหน้า class: `goodjunk-kiosk.html`
- นักเรียน: `student-join-goodjunk.html`

---

## จำสั้น ๆ

### ก่อนเริ่ม
- เปิดครู
- เปิดจอ
- ส่งลิงก์นักเรียน

### ตอนเริ่ม
- กด `Start Class Macro`

### ตอนจบ
- กด `End Class Macro`

จบ