# EAP Hero: Save the Society v1

Prototype เกมเรียนรายวิชา **ภาษาอังกฤษเพื่อวัตถุประสงค์ทางวิชาการ (EAP)** สำหรับนักศึกษาปริญญาตรี

## ไฟล์
- `index.html`
- `eap-hero.css`
- `eap-hero.js`

## วิธีใช้บน GitHub Pages
1. สร้างโฟลเดอร์ เช่น `/eap-hero/`
2. อัปโหลด 3 ไฟล์นี้เข้าไป
3. เปิด URL เช่น `https://<username>.github.io/<repo>/eap-hero/index.html`

## Features v1b
- ขยาย question bank เป็นอย่างน้อยประมาณ 17–20 ข้อต่อ Session
- Boss Battle สุ่มใช้ 7–10 ข้อต่อรอบตาม difficulty
- เพิ่มระบบหลีกเลี่ยงข้อที่เพิ่งออกในรอบก่อนหน้า (recent-question avoidance)
- Boss ไม่วนข้อเดิมในรอบเดียว ถ้าตอบครบแล้วยังไม่ชนะให้ rematch

## Features v1a
- ปรับตัวเลือกคำตอบให้ใกล้เคียงขึ้น ลดตัวเลือกที่ดูผิดแบบชัดเจน
- เน้น plausible distractors สำหรับนักศึกษาปริญญาตรี

## Features v1
- 15 Sessions
- Lab → Practice → Boss Battle
- Boss HP, Timer, Heart, Combo
- Stars, XP, Badges, Boss Cards
- Mistake Review
- Reflection
- Teacher Dashboard
- Export CSV
- localStorage progress

## หมายเหตุ
Prototype นี้ไม่มี external library และไม่ต้องต่อ server
ข้อมูลคะแนนถูกเก็บไว้ใน localStorage ของ browser
