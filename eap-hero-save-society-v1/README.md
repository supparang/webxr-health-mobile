# EAP Hero: Save the Society v1c Exam Ready

Prototype เกมเรียนและโหมดสอบรายวิชา **ภาษาอังกฤษเพื่อวัตถุประสงค์ทางวิชาการ (EAP)** สำหรับนักศึกษาปริญญาตรี

## ไฟล์
- `index.html`
- `eap-hero.css`
- `eap-hero.js`
- `README.md`
- `QUESTION_DESIGN_NOTES.md`
- `REPLAY_QUESTION_POLICY.md`
- `EXAM_READY_NOTES.md`

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
