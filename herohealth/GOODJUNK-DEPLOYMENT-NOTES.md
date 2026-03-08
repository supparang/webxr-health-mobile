# HeroHealth • GoodJunk Deployment Notes
PATCH v20260307-GJ-DEPLOYMENT-NOTES

เอกสารนี้ใช้สำหรับ:
- วิธี deploy ชุด GoodJunk
- วิธีอัปเดตไฟล์
- วิธีตรวจปัญหาเบื้องต้น
- วิธี handoff ให้ผู้ช่วยวิจัย / ผู้ร่วมทีม / ผู้ดูแลระบบคนถัดไป

---

## 1) Scope ของเอกสารนี้

เอกสารนี้ครอบคลุม GoodJunk Classroom Suite ได้แก่

- `goodjunk-index.html`
- `goodjunk-launcher.html`
- `goodjunk-teacher.html`
- `goodjunk-teacher-essential.html`
- `goodjunk-board.html`
- `goodjunk-board-essential.html`
- `goodjunk-kiosk.html`
- `student-join-goodjunk.html`
- `vr-goodjunk/goodjunk-vr.html`
- `vr-goodjunk/goodjunk.safe.js`
- `vr/battle-rtdb.js`
- `lib/qr-local-first.js`

รวมถึงเอกสาร:
- `GOODJUNK-CLASSROOM-README.md`
- `GOODJUNK-FLOW.md`
- `GOODJUNK-CHECKLIST.md`

---

## 2) โครงสร้างไฟล์ที่ต้องมี

### Root /herohealth
- `goodjunk-index.html`
- `goodjunk-launcher.html`
- `goodjunk-teacher.html`
- `goodjunk-teacher-essential.html`
- `goodjunk-board.html`
- `goodjunk-board-essential.html`
- `goodjunk-kiosk.html`
- `student-join-goodjunk.html`
- `firebase-config.js`
- `favicon.ico`

### Subfolders
- `/herohealth/vr-goodjunk/goodjunk-vr.html`
- `/herohealth/vr-goodjunk/goodjunk.safe.js`
- `/herohealth/vr/battle-rtdb.js`
- `/herohealth/lib/qr-local-first.js`

### Docs
- `/herohealth/GOODJUNK-CLASSROOM-README.md`
- `/herohealth/GOODJUNK-FLOW.md`
- `/herohealth/GOODJUNK-CHECKLIST.md`
- `/herohealth/GOODJUNK-DEPLOYMENT-NOTES.md`

---

## 3) Deployment Target

ระบบนี้ออกแบบให้ deploy แบบ static site ได้ เช่น

- GitHub Pages
- Netlify
- Vercel (static)
- static hosting ภายในมหาวิทยาลัย
- web server ธรรมดา (Apache/Nginx)

### เงื่อนไขสำคัญ
- ทุกไฟล์ path ต้องตรง
- browser ต้องโหลด JS modules ได้
- `firebase-config.js` ต้องถูกโหลดได้
- external imports ของ Firebase ต้องออกอินเทอร์เน็ตได้

---

## 4) วิธี deploy แบบ GitHub Pages

### ขั้นตอนทั่วไป
1. วางไฟล์ทั้งหมดใน repo
2. commit / push
3. ตรวจว่า branch ที่ใช้สำหรับ Pages ถูกต้อง
4. เปิด URL จริงเพื่อตรวจหน้า index

### ควรตรวจหลัง deploy
- เปิด `goodjunk-index.html`
- เปิด `goodjunk-teacher.html`
- เปิด `goodjunk-kiosk.html`
- เปิด `student-join-goodjunk.html`
- เปิด `vr-goodjunk/goodjunk-vr.html`

---

## 5) ไฟล์ config สำคัญ

### 5.1 firebase-config.js
ไฟล์นี้สำคัญมากที่สุดสำหรับ runtime classroom suite

ต้องมีอย่างน้อย:
- Firebase config object
- การ expose config ไปที่ global เช่น:
  - `window.HHA_FIREBASE_CONFIG`
  - หรือ `window.__HHA_FIREBASE_CONFIG__`
  - หรือ `window.firebaseConfig`

### ถ้าไฟล์นี้ผิด
ผลกระทบ:
- teacher admin tools ใช้ไม่ได้
- board realtime ไม่ขึ้น
- student join attendance ไม่ถูกบันทึก
- battle room ใช้ไม่ได้

---

## 6) RTDB Paths ที่ระบบใช้

root path หลัก:

`hha-battle/goodjunk/rooms/{ROOM}`

subpaths:
- `state`
- `players`
- `rematch`
- `rematchVotes`
- `attendance`
- `roster`
- `policy`
- `announcement`
- `reports`

### ถ้าจะ debug
ให้เช็กว่า path เหล่านี้ถูกสร้างและมีข้อมูลจริง

---

## 7) ลำดับเปิดระบบจริงที่แนะนำ

### สำหรับใช้งานในห้องเรียน
1. เปิด `goodjunk-teacher-essential.html`
2. เปิด `goodjunk-kiosk.html` บนจอหน้า class
3. เปิด/แจก `student-join-goodjunk.html`
4. เช็ก room ให้ตรงกันทุกหน้า
5. กด `Start Class Macro`

### สำหรับผู้ดูแลระบบ
- ใช้ `goodjunk-teacher.html` เมื่อต้องการเครื่องมือเต็ม
- ใช้ `goodjunk-index.html` เป็นหน้าเมนูกลาง

---

## 8) วิธีอัปเดตไฟล์โดยไม่พัง path

### หลักสำคัญ
- อย่าเปลี่ยนชื่อไฟล์ถ้าไม่จำเป็น
- อย่าเปลี่ยน folder structure ถ้าไม่จำเป็น
- ถ้าจำเป็นต้องเปลี่ยน path ต้องอัปเดตทุกจุดที่เรียกไฟล์นั้น

### ไฟล์ที่อ้างถึงกันเยอะ
- `goodjunk.safe.js`
- `battle-rtdb.js`
- `firebase-config.js`
- `student-join-goodjunk.html`
- `goodjunk-board.html`
- `goodjunk-kiosk.html`

### หลังแก้ไข path ต้องตรวจ
- index
- launcher
- teacher
- teacher essential
- board
- board essential
- kiosk
- student join
- run page

---

## 9) วิธีอัปเดตแบบปลอดภัย

### แนวทางที่แนะนำ
1. แก้ทีละไฟล์
2. ทดสอบ local / staging
3. ทดสอบ path สำคัญ
4. ค่อย push production
5. เปิด checklist เช็กก่อนใช้จริง

### ลำดับทดสอบหลัง patch
1. `goodjunk-index.html`
2. `goodjunk-launcher.html`
3. `goodjunk-teacher-essential.html`
4. `goodjunk-kiosk.html`
5. `student-join-goodjunk.html`
6. `goodjunk-vr.html`
7. battle room sync

---

## 10) Smoke Test หลัง deploy

### เปิดหน้าเหล่านี้แล้วต้องไม่ error
- [ ] `goodjunk-index.html`
- [ ] `goodjunk-launcher.html`
- [ ] `goodjunk-teacher.html`
- [ ] `goodjunk-teacher-essential.html`
- [ ] `goodjunk-board.html`
- [ ] `goodjunk-board-essential.html`
- [ ] `goodjunk-kiosk.html`
- [ ] `student-join-goodjunk.html`
- [ ] `vr-goodjunk/goodjunk-vr.html`

### ฟังก์ชันหลักที่ต้องลอง
- [ ] board realtime
- [ ] teacher macros
- [ ] announcement
- [ ] policy lock/spectator
- [ ] student join
- [ ] battle sync
- [ ] end overlay
- [ ] rematch

---

## 11) Debug Guide เบื้องต้น

### 11.1 ถ้าเปิดหน้าแล้วขาว / ไม่ขึ้น
เช็ก:
- path ไฟล์ถูกไหม
- JS import 404 หรือไม่
- `firebase-config.js` โหลดได้ไหม
- browser console มี syntax error หรือไม่

### 11.2 ถ้า board ไม่ realtime
เช็ก:
- room ตรงกันหรือไม่
- RTDB path มีข้อมูลหรือไม่
- firebase config ถูกต้องหรือไม่
- board ใช้ room เดียวกับ teacher/student หรือไม่

### 11.3 ถ้า student join เข้าไม่ได้
เช็ก:
- room policy ล็อกอยู่หรือไม่
- spectator only เปิดอยู่หรือไม่
- query params ถูกต้องหรือไม่
- path `student-join-goodjunk.html` ถูกต้องหรือไม่

### 11.4 ถ้า battle ไม่เริ่ม
เช็ก:
- players เข้า room เดียวกันหรือไม่
- ready ครบหรือไม่
- state phase ค้างอยู่ตรงไหน
- ใช้ Force Countdown / Force Start ได้หรือไม่
- RTDB write ทำงานหรือไม่

### 11.5 ถ้า announcement ไม่ขึ้น
เช็ก:
- teacher เขียน `announcement` path ได้หรือไม่
- board อ่าน `announcement` path ได้หรือไม่
- ttl หมดแล้วหรือยัง
- room ถูกต้องหรือไม่

### 11.6 ถ้า winner ตัดสินแปลก
เช็ก:
- `score`
- `acc`
- `miss`
- `medianRT`
- ดู rule ตามลำดับ:
  1. score
  2. acc
  3. miss
  4. medianRT

---

## 12) Console Logs ที่ควรดู

### Browser Console
ให้เปิด DevTools แล้วเช็ก:
- 404 file not found
- import failed
- firebase load failed
- missing Firebase config
- permission denied
- module syntax error

### Network Tab
เช็ก:
- `firebase-config.js`
- `goodjunk.safe.js`
- `battle-rtdb.js`
- `qr-local-first.js`

---

## 13) เรื่อง cache และ versioning

### ปัญหาที่พบบ่อย
- แก้ไฟล์แล้ว browser ยังใช้เวอร์ชันเก่า
- JS cache ค้าง
- board / teacher คนละ version

### แนวทาง
- hard refresh
- ล้าง browser cache
- ใช้ query string version เช่น `?v=20260307`
- ถ้าไฟล์สำคัญถูกแก้มาก ให้แจ้งผู้ใช้ refresh ทุกเครื่อง

### ไฟล์ที่ cache แล้วมีผลมาก
- `goodjunk.safe.js`
- `battle-rtdb.js`
- `goodjunk-vr.html`
- `goodjunk-teacher.html`
- `goodjunk-board.html`

---

## 14) Browser / Device Notes

### แนะนำ browser
- Chrome ล่าสุด
- Edge ล่าสุด
- Safari รุ่นใหม่พอใช้ได้ แต่ควรทดสอบก่อน

### อุปกรณ์ที่เหมาะ
- เครื่องครู: laptop / desktop
- จอหน้า class: laptop/mini PC ต่อ projector หรือ smart TV browser
- นักเรียน: smartphone

### หมายเหตุ
- fullscreen behavior บาง browser ต่างกัน
- mobile keyboard อาจดัน layout บางหน้า
- projector browser บางตัว cache หนักกว่าปกติ

---

## 15) Handoff ให้ผู้ดูแลคนใหม่

เมื่อส่งงานต่อให้คนอื่น ควรส่ง 4 อย่างนี้พร้อมกัน:

1. ไฟล์ระบบทั้งหมด
2. Firebase config ที่ใช้งานได้
3. README + FLOW + CHECKLIST + DEPLOYMENT NOTES
4. ลิงก์ตัวอย่างสำหรับเปิดใช้งานจริง

### คนรับงานควรรู้เรื่องต่อไปนี้
- room ต้องตรงกันทุกหน้า
- student ควรเข้าผ่าน Student Join
- teacher essential เหมาะกับใช้จริง
- kiosk เหมาะกับจอหน้า class
- teacher full เอาไว้แก้ปัญหา/ดูข้อมูลละเอียด

---

## 16) Minimal Handoff Summary

### ถ้าต้องอธิบายสั้นมาก
- เปิด `goodjunk-teacher-essential.html` บนเครื่องครู
- เปิด `goodjunk-kiosk.html` บนจอหน้า class
- ส่ง `student-join-goodjunk.html` ให้นักเรียน
- ใช้ Start / End Class Macro คุมคาบ

---

## 17) Recommended Maintenance Routine

### ทุกครั้งก่อนใช้จริง
- เปิด checklist
- ทดสอบ room เดียว
- ทดสอบ student join 1 เครื่อง
- ทดสอบ board 1 จอ
- ทดสอบ macro start/end
- ทดสอบ announcement

### ทุกครั้งหลังแก้ไฟล์
- smoke test หน้า index / teacher / kiosk / join / run
- เช็ก console
- เช็ก RTDB write/read
- เช็ก cache

---

## 18) Recovery Plan ถ้าใช้งานวันจริงแล้วมีปัญหา

### กรณีระบบเต็มมีปัญหา
fallback แบบง่าย:
- ครูใช้ `goodjunk-teacher-essential.html`
- จอใช้ `goodjunk-board-essential.html`
- นักเรียนใช้ `student-join-goodjunk.html`

### กรณี board เต็มพัง
fallback:
- ใช้ `goodjunk-board-essential.html`
- หรือ `goodjunk-kiosk.html`

### กรณี teacher เต็มพัง
fallback:
- ใช้ `goodjunk-teacher-essential.html`

### กรณี launcher/index พัง
fallback:
- เปิดแต่ละหน้าตรงจาก URL

---

## 19) ลิงก์ที่ควรเก็บเป็น Bookmark

- `goodjunk-index.html`
- `goodjunk-teacher.html`
- `goodjunk-teacher-essential.html`
- `goodjunk-kiosk.html`
- `student-join-goodjunk.html`

---

## 20) สรุปสุดท้าย

GoodJunk classroom suite พร้อม deploy แบบ static site ได้
แต่ความสำเร็จขึ้นกับ 4 เรื่องหลัก:
1. path ไฟล์ถูกต้อง
2. firebase config ใช้ได้
3. room ตรงกันทุกหน้า
4. smoke test ก่อนใช้งานจริง

จบเอกสาร