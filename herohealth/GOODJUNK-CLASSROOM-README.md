# HeroHealth • GoodJunk Classroom Suite
PATCH v20260307-GJ-CLASSROOM-README

เอกสารนี้สรุปโครงสร้างไฟล์ หน้าที่ของแต่ละหน้า และ flow การใช้งานของระบบ GoodJunk สำหรับ classroom / battle / projector / teacher control

---

## 1) เป้าหมายของชุดนี้

GoodJunk Classroom Suite ถูกออกแบบเพื่อให้ใช้เกม GoodJunk ในห้องเรียนได้จริง โดยมีองค์ประกอบครบดังนี้

- ครูควบคุมห้องได้
- นักเรียนเข้าเล่นผ่านลิงก์หรือ QR
- จอโปรเจกเตอร์แสดงผลสด
- มี battle room / rematch / spectator
- มี roster / attendance / coverage
- มี room policy และ announcement
- มี macro สำหรับเริ่มคาบ/จบคาบ

---

## 2) โครงสร้างไฟล์หลัก

### หน้าหลัก / เมนูรวม
- `/herohealth/goodjunk-index.html`
  - หน้าเมนูกลางรวมทุกทางเข้า
- `/herohealth/goodjunk-launcher.html`
  - หน้า launcher สำหรับเปิด teacher / board / student join / run page

### ฝั่งครู
- `/herohealth/goodjunk-teacher.html`
  - dashboard เต็ม
- `/herohealth/goodjunk-teacher-essential.html`
  - dashboard ย่อสำหรับใช้จริงหน้าห้อง

### ฝั่งจอแสดงผล
- `/herohealth/goodjunk-board.html`
  - live board เต็ม
- `/herohealth/goodjunk-board-essential.html`
  - board แบบเรียบ
- `/herohealth/goodjunk-kiosk.html`
  - โหมด kiosk สำหรับจอหน้าห้อง

### ฝั่งนักเรียน
- `/herohealth/student-join-goodjunk.html`
  - หน้าให้นักเรียนกรอกชื่อ / PID / เข้า room

### หน้าเกม
- `/herohealth/vr-goodjunk/goodjunk-vr.html`
  - run page
- `/herohealth/vr-goodjunk/goodjunk.safe.js`
  - game engine หลัก

### Battle / infra
- `/herohealth/vr/battle-rtdb.js`
  - ระบบห้อง battle บน Firebase RTDB
- `/herohealth/lib/qr-local-first.js`
  - helper สร้าง QR แบบ local-first

---

## 3) บทบาทของแต่ละหน้า

### 3.1 goodjunk-index.html
ใช้เป็น “หน้าเริ่มต้น” ของทั้งชุด  
เหมาะกับ:
- ครูเปิดจากลิงก์เดียว
- เลือกต่อไปยังทุกหน้าของระบบ
- copy links ได้เร็ว

### 3.2 goodjunk-launcher.html
เหมาะกับการทดสอบ / เดโม / เปิดหลายทางเข้าอย่างรวดเร็ว  
มีลิงก์ไป:
- Teacher
- Board
- Student Join
- Run
- Battle test
- Solo test

### 3.3 goodjunk-teacher.html
เป็น dashboard เต็ม  
รองรับ:
- force start / countdown / reset room
- rematch clear
- roster / attendance / coverage
- policy lock / spectator only
- broadcast announcement
- quick presets
- classroom macros
- QR / export / summary report

### 3.4 goodjunk-teacher-essential.html
เวอร์ชันย่อของครู  
เหมาะกับใช้จริงในคาบ เพราะปุ่มไม่เยอะ

### 3.5 goodjunk-board.html
จอแสดงผลเต็ม  
รองรับ:
- scoreboard
- room summary
- winner spotlight
- announcement banner
- attendance progress
- projector / auto-cycle / kiosk-like use

### 3.6 goodjunk-board-essential.html
เวอร์ชันโปรเจกเตอร์เรียบ ๆ  
แสดงเฉพาะ:
- room
- phase
- winner
- scoreboard 2 คน
- progress ทั้งห้อง
- announcement

### 3.7 goodjunk-kiosk.html
สำหรับจอหน้าห้องโดยเฉพาะ  
จุดเด่น:
- clean mode
- hide UI
- fullscreen friendly
- เปิดค้างบนทีวี/โปรเจกเตอร์ได้ดี

### 3.8 student-join-goodjunk.html
หน้าสำหรับนักเรียน  
จุดเด่น:
- รับ room จากลิงก์ครู
- เช็ก duplicate PID
- เช็ก room policy
- redirect ไป spectator ได้ถ้าห้องถูกล็อกแบบ spectator only
- เขียน attendance

### 3.9 goodjunk-vr.html
run page ของเกม  
ทำหน้าที่:
- โหลด goodjunk.safe.js
- แสดง HUD / end overlay
- เชื่อมกับ battle และ UI หน้า run

### 3.10 goodjunk.safe.js
engine หลักของเกม  
รับผิดชอบ:
- spawn / hit / expire
- scoring / combo / missions / boss
- AI HUD / coach
- battle sync
- end summary
- compare table
- rematch flow

### 3.11 battle-rtdb.js
ระบบ battle room  
รับผิดชอบ:
- join room
- player / spectator role
- countdown / running / ended
- winner rule
- rematch
- room policy
- announcement
- admin tools

### 3.12 qr-local-first.js
helper QR  
ทำหน้าที่:
- ใช้ local QR library ถ้ามี
- fallback ไป external QR image ถ้าไม่มี

---

## 4) Flow การใช้งานจริงในห้องเรียน

### Flow มาตรฐาน
1. ครูเปิด `goodjunk-teacher-essential.html` หรือ `goodjunk-teacher.html`
2. จอหน้า class เปิด `goodjunk-kiosk.html` หรือ `goodjunk-board-essential.html`
3. นักเรียนเข้า `student-join-goodjunk.html` ผ่านลิงก์หรือ QR
4. ครูกด `Start Class Macro`
5. นักเรียนเล่น battle
6. จอแสดงคะแนนสด
7. ครูกด `End Class Macro` เมื่อจบคาบ

---

## 5) ลำดับการเปิดหน้าที่แนะนำ

### แบบง่ายที่สุด
- ครู: `goodjunk-teacher-essential.html`
- โปรเจกเตอร์: `goodjunk-kiosk.html`
- นักเรียน: `student-join-goodjunk.html`

### แบบเต็ม
- ครู: `goodjunk-teacher.html`
- โปรเจกเตอร์: `goodjunk-board.html`
- นักเรียน: `student-join-goodjunk.html`

### แบบเดโม / ทดสอบ
- เปิดจาก `goodjunk-index.html` หรือ `goodjunk-launcher.html`

---

## 6) Room Policy

Room policy อยู่ใน RTDB path:

`hha-battle/goodjunk/rooms/{ROOM}/policy`

รองรับ field หลัก:
- `roomLocked`
- `allowSpectatorOnly`
- `spectatorUrl`
- `message`

### พฤติกรรม
- ถ้า `roomLocked=true`
  - นักเรียนใหม่เข้าเล่นไม่ได้
- ถ้า `allowSpectatorOnly=true`
  - นักเรียนใหม่จะถูกพาไป spectator/board แทนได้
- `message`
  - ใช้เป็นข้อความแจ้งบนหน้า join

---

## 7) Announcement

Announcement อยู่ใน RTDB path:

`hha-battle/goodjunk/rooms/{ROOM}/announcement`

field หลัก:
- `message`
- `tone`
- `ttlSec`
- `createdAtMs`
- `updatedAtMs`

ใช้สำหรับ:
- banner บน board
- preset จากครู
- start/end class notifications

tone ที่ใช้:
- `info`
- `success`
- `warn`
- `danger`

---

## 8) Attendance / Roster

### Attendance
อยู่ที่:
`hha-battle/goodjunk/rooms/{ROOM}/attendance`

source ที่ใช้:
- `student-join`
- `game-run`

### Roster
อยู่ที่:
`hha-battle/goodjunk/rooms/{ROOM}/roster`

ใช้สำหรับ:
- coverage
- attendance vs roster
- absent baseline
- export CSV

---

## 9) Winner Rule ของ Battle

ลำดับการตัดสินผู้ชนะคือ:

1. `score`
2. `acc`
3. `miss`
4. `medianRT`

ถ้ายังเท่ากัน:
- ถือว่า tie

---

## 10) Rematch Logic

หลังจบรอบ:
- ผู้เล่นคนหนึ่งกด rematch ได้
- อีกฝ่าย accept หรือ decline
- ถ้าทั้งสองฝ่าย accept:
  - reset state
  - เข้า lobby รอบใหม่
  - ใช้ roundId ใหม่

---

## 11) Macro สำคัญ

### Start Class Macro
ลำดับ:
1. clear announcement
2. unlock room
3. clear rematch
4. reset room
5. send announcement “เริ่มคาบแล้ว...”
6. countdown 3s

### End Class Macro
ลำดับ:
1. spectator only
2. send end-class announcement
3. refresh policy
4. refresh announcement

---

## 12) หน้าไหนใช้เมื่อไร

### ถ้าจะ “สอนจริง”
ใช้:
- Teacher Essential
- Kiosk
- Student Join

### ถ้าจะ “ควบคุมละเอียด”
ใช้:
- Teacher Dashboard เต็ม
- Live Board เต็ม

### ถ้าจะ “ทดสอบระบบ”
ใช้:
- Launcher
- Run Battle
- Run Solo

### ถ้าจะ “เปิดทุกอย่างจากหน้าเดียว”
ใช้:
- GoodJunk Index

---

## 13) ตัวอย่างลิงก์สำคัญ

### Teacher
`/herohealth/goodjunk-teacher.html?room=P5A`

### Teacher Essential
`/herohealth/goodjunk-teacher-essential.html?room=P5A&view=mobile&diff=easy&time=80`

### Board
`/herohealth/goodjunk-board.html?room=P5A`

### Board Essential
`/herohealth/goodjunk-board-essential.html?room=P5A`

### Kiosk
`/herohealth/goodjunk-kiosk.html?room=P5A`

### Student Join
`/herohealth/student-join-goodjunk.html?room=P5A&view=mobile&diff=easy&time=80&mode=battle&lock_room=1&lock_view=1&lock_diff=1&lock_time=1`

### Run Battle
`/herohealth/vr-goodjunk/goodjunk-vr.html?room=P5A&mode=battle&view=mobile&diff=easy&time=80&pid=anon`

### Run Solo
`/herohealth/vr-goodjunk/goodjunk-vr.html?room=P5A&mode=solo&view=mobile&diff=easy&time=80&pid=anon`

---

## 14) ข้อควรระวัง

- ต้องมี Firebase config พร้อมใช้งาน
- battle room อาศัย RTDB sync
- student join / teacher / board ควรใช้ room เดียวกัน
- ถ้าใช้กับนักเรียนจริง ควรเข้าผ่าน Student Join ไม่ควรส่ง run page ตรง
- QR helper จะ fallback ได้ แต่ถ้ามี local QR lib จะเสถียรกว่า

---

## 15) ชุดไฟล์ที่แนะนำให้เปิดค้าง

### บนเครื่องครู
- `goodjunk-teacher-essential.html`

### บนจอหน้า class
- `goodjunk-kiosk.html`

### สำหรับนักเรียน
- `student-join-goodjunk.html`

### สำหรับดูแลระบบ/แก้ปัญหา
- `goodjunk-teacher.html`
- `goodjunk-index.html`

---

## 16) สรุปสั้นที่สุด

ถ้าจะใช้งานจริงแบบไม่ซับซ้อน:

- ครูเปิด **Teacher Essential**
- โปรเจกเตอร์เปิด **Kiosk**
- นักเรียนเข้า **Student Join**
- เริ่มด้วย **Start Class Macro**
- จบด้วย **End Class Macro**

จบชุด