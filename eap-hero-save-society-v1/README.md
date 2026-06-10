# EAP Hero: Save the Society v1g No Length Cue

Prototype เกมเรียนและโหมดสอบรายวิชา **ภาษาอังกฤษเพื่อวัตถุประสงค์ทางวิชาการ (EAP)** สำหรับนักศึกษาปริญญาตรี

## ไฟล์
- `index.html`
- `eap-hero.css`
- `eap-hero.js`
- `README.md`
- `QUESTION_DESIGN_NOTES.md`
- `REPLAY_QUESTION_POLICY.md`
- `EXAM_READY_NOTES.md`

## v1g No Length Cue
- เพิ่ม No-Length-Cue Item Bank 600 ข้อ
- ทุก Session มีชุดข้อใหม่ 40 ข้อที่ลด length cue โดยตรง
- ระบบเลือก `quality: v1g` ก่อน `v1e`
- ตัวเลือกถูกไม่ได้ยาวที่สุดเสมอไป
- ตัวเลือกผิดถูกเขียนให้ดู plausible และมีความยาวใกล้เคียงคำตอบถูก
- ยังคง Hotfix Contract v1f และ Fun Loop เดิมทั้งหมด

## Hotfix v1f
- แก้ `Uncaught ReferenceError: contract is not defined` ใน `startBoss()`
- Boss Contract ใช้งานได้ทั้ง Standard / Brave / Hero / No Hint / Speed Scholar
- คงระบบ Balanced Item Bank v1e และ unique fingerprint กันข้อซ้ำไว้เหมือนเดิม

## Features v1e Balanced Items
- เพิ่ม Balanced Item Bank 600 ข้อใหม่
- ทุก Session มีข้อ balanced อย่างน้อย 40 ข้อ
- ตัวเลือกผิด/ถูกออกแบบให้ความยาวใกล้เคียงกันขึ้น
- ตัวเลือกหลอก plausible ขึ้น ไม่ใช่ผิดแบบหลุดโลก
- ระบบสุ่มจะเลือก v1e balanced items ก่อน
- เพิ่ม unique fingerprint เพื่อกันคำถามซ้ำ/คล้ายกันในรอบเดียวกัน
- Exam Mode ใช้ balanced item pool ก่อนเพื่อลด length cue
- ยังสุ่มตำแหน่งตัวเลือกทุกข้อเหมือนเดิม

## Features v1d Fun Loop
- เพิ่ม Fun Loop Hub
- เพิ่ม Daily Streak
- เพิ่ม Daily Challenge
- เพิ่ม Boss Contract: Standard / Brave / Hero / No Hint / Speed Scholar
- เพิ่ม Treasure Chest หลังชนะบอส
- เพิ่ม Coins, Titles, Recent Chest History
- เพิ่ม Achievements พร้อม Claim Reward
- ปรับ Rematch ให้เลือก Contract เพื่อเล่นซ้ำแบบท้าทาย
- เพิ่ม XP multiplier ตาม Contract
- เพิ่ม No Hint Contract และ Speed Run style

## Features v1c
- ขยาย question bank เพิ่มอีก 675 ข้อ
- รวมทั้งเกมประมาณ 930+ ข้อ
- แต่ละ Session ประมาณ 60+ ข้อ
- สุ่มข้อคำถามและสุ่มตัวเลือกทุกครั้ง
- Practice ใช้ 4 ข้อ/รอบ
- Boss Battle ใช้ 7–10 ข้อ/รอบตาม difficulty
- Midterm Exam: Sessions 1–8, 60 ข้อ, 75 นาที
- Final Exam: Sessions 1–15, 80 ข้อ, 100 นาที
- Exam Mode ไม่เฉลยทันทีระหว่างสอบ
- มี timer, answered count, unanswered review
- บันทึก attempt, score, time used, warnings
- มี tab-switch warning สำหรับ fair-play เบื้องต้น
- Export Game CSV และ Export Exam CSV
- Teacher Dashboard แสดง Exam Logs

## วิธีใช้บน GitHub Pages
1. สร้างโฟลเดอร์ เช่น `/eap-hero/`
2. อัปโหลดไฟล์ทั้งหมดเข้าไป
3. เปิด URL เช่น `https://<username>.github.io/<repo>/eap-hero/index.html`
4. ให้นักศึกษากรอก Profile ก่อนสอบ
5. เข้า `Exam` แล้วเลือก Midterm หรือ Final
6. หลังสอบ ให้อาจารย์เข้า `Teacher Dashboard` แล้ว Export Exam CSV

## หมายเหตุสำคัญ
ระบบนี้เป็น client-side prototype ที่ใช้ localStorage จึงเหมาะกับการสอบในห้องแบบมีผู้คุมและใช้เครื่อง/เบราว์เซอร์ที่กำหนด  
ถ้าจะใช้สอบ high-stakes จริงมาก ควรต่อ Google Sheets/Firebase/server-side logging เพิ่มเพื่อป้องกันการ reset localStorage หรือแก้ไขไฟล์
