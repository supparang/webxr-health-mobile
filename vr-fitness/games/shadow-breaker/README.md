# VR Fitness — Shadow Breaker (Production)

Shadow Breaker คือมินิเกมตี/ยิงเป้า emoji แบบเร็ว-แม่น-คอมโบ พร้อมบอส 4 ตัว + FEVER
รองรับ PC / Mobile / VR Headset และรองรับ crosshair/tap-to-shoot ผ่าน `vr-ui.js` (event: `hha:shoot`)

---

## Files
- `shadow-breaker.html` (หน้าเกม)
- `shadow-breaker.js` (engine / logic)
- `shadow-breaker.css` (styles production)

> หมายเหตุ: ถ้าคุณมีโครงมาตรฐาน VR Fitness ที่รวม `vr-ui.js` อยู่แล้ว ให้แน่ใจว่า `shadow-breaker.html` โหลด `vr-ui.js` ก่อนเริ่มเล่น (เพื่อยิงด้วย crosshair ได้)

---

## How to Run
เปิดไฟล์ `shadow-breaker.html` ผ่านเว็บเซิร์ฟเวอร์ (แนะนำ)
- ตัวอย่าง: เปิดผ่าน GitHub Pages / localhost server

---

## Controls
### PC / Notebook
- คลิกที่เป้าเพื่อโจมตี
- กด `Space` เพื่อ “ยิงจากกลางจอ” (ช่วยซ้อมแบบ aim-center)

### Mobile / Tablet
- แตะเป้าโดยตรง
- ถ้าใช้โหมด crosshair + tap-to-shoot: แตะหน้าจอ (vr-ui.js จะยิง event `hha:shoot`)

### VR Headset
- ใช้ pointer/controller (หรือ crosshair กลางจอในโหมด cVR)
- ระบบ `vr-ui.js` จะช่วยเรื่อง ENTER VR / EXIT / RECENTER และยิงด้วย crosshair

---

## URL Parameters
พารามิเตอร์หลักที่รองรับ (อ่านจาก query string)

### 1) เล่นธรรมดา (Play)
- `mode=timed|endless`
- `time=20..300` (วินาที) ใช้เมื่อ `mode=timed`
- `diff=easy|normal|hard`

ตัวอย่าง:
- `?mode=timed&time=60&diff=normal`

### 2) ระยะการทดลอง / phase
- `phase=train|test` (ค่าเริ่มต้น `train`)
ตัวอย่าง:
- `?phase=test`

### 3) Seed (เตรียมไว้ใช้ต่อยอด deterministic)
- `seed=<number|string>`
> ใน v1.* ยัง “เก็บค่า” เพื่ออนาคต (ยังไม่ใช้สุ่มแบบ deterministic เต็มระบบ)

ตัวอย่าง:
- `?seed=1767274590784`

### 4) Hub passthrough (กลับเมนูหลัก)
- `hub=<urlencoded hub url>`
ปุ่ม “กลับเมนูหลัก” จะกลับไป URL นี้ ถ้าไม่ระบุจะ fallback เป็น `../hub.html`

ตัวอย่าง:
- `?hub=https%3A%2F%2Fexample.com%2Fhub.html`

### 5) Research / logging flags
ระบบจะถือว่าเป็น “โหมดวิจัย” ถ้ามีอย่างใดอย่างหนึ่ง:
- `research=1|true|on`
- `studyId=<id>`
- `log=<endpoint>` (ไว้ต่อยอดส่ง Apps Script/Server ภายหลัง)

ตัวอย่าง:
- `?research=1&studyId=SB01`

---

## Research Mode Behavior
เมื่อเข้าโหมดวิจัย (จาก flags ข้างบน)
- บังคับให้กรอกอย่างน้อย `Student ID` ก่อนเริ่ม
- เก็บสถิติแต่ละ session ลง localStorage:
  - key: `ShadowBreakerSessions_v1`
  - meta: `ShadowBreakerMeta_v1`
- ปุ่ม Download CSV จะพร้อมใช้งาน (ดึงข้อมูลจาก localStorage)

> หมายเหตุ: Apps Script / Google Sheet logging ถูก “พักไว้ก่อน” ตามแผน (ยังไม่ส่งออกอัตโนมัติ)

---

## Events (HeroHealth-like)
Shadow Breaker ปล่อย event สำหรับระบบรวม/วิจัย:
- `hha:start` { gameId, gameVersion, phase, mode, diff, timeSec, seed, research }
- `hha:time`  { remainSec|elapsedSec, elapsedMs }
- `hha:score` { score, gained, combo, hit, miss, boss }
- `hha:coach` { text, fever?, boss? }
- `hha:end`   { session record (score/hit/miss/acc/maxCombo/...) }
- `hha:flush` { reason }

### Crosshair / Tap-to-shoot
Shadow Breaker “รับ” event:
- `hha:shoot` detail: `{ x, y, lockPx, source }`
แล้วจะเลือกเป้าที่ใกล้ที่สุดภายในรัศมี `lockPx`

---

## Known Design Rules (Production)
- HUD ไม่บังเป้า: HUD ใช้ `pointer-events:none`
- Safe top zone: JS spawn target จะกันชนด้านบน (กันชน boss bar/HUD)
- Boss 4 ตัว: defeat แล้วจะเรียกบอสถัดไปทันทีเพื่อความเร้าใจ
- FEVER: เกิดเมื่อคอมโบถึง threshold แล้วเพิ่มโบนัสคะแนน/เอฟเฟกต์

---

## Next Planned (Optional)
(ยังไม่ทำใน production v1.*)
- deterministic RNG เต็มระบบจาก `seed`
- AI Director (personalized difficulty) + AI Coach (explainable tips) + Pattern Generator (seeded)
- ส่ง event/session ไป Google Sheet ผ่าน Apps Script (เมื่อ unpause)

---