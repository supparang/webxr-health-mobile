# UX Quest — W1 Core Mission V2 Update

อัปเดตสำหรับ `w1-ux-detective.html` จากภาพทดสอบล่าสุด

## สิ่งที่ปรับ

- ซ่อนกรอบ Hotspot ตั้งแต่เริ่มเกม: ผู้เล่นต้องวิเคราะห์ก่อน ไม่ใช่กดตามกรอบ
- มี **Hint 2 ครั้ง**: เฉพาะเมื่อผู้เล่นต้องการเปิดเบาะแส
- คลิกผิดเพิ่ม Friction Pulse ลด Stability และรีเซ็ต Combo
- Evidence Panel เริ่มด้วย `Evidence Slot 01–05` ไม่เฉลยชื่อปัญหาล่วงหน้า
- เมื่อพบจุดผิด มี **User Signal Toast** ปรากฏเพื่อเชื่อม UI problem กับผลที่เกิดกับผู้ใช้
- เพิ่ม HUD: Friction, Countdown, Hint, Combo, Score, Stability
- Replay ได้ 2 Case: Smart Campus Help Center และ Advisor Appointment
- เกณฑ์ 3 ดาวเพิ่ม Evidence Discipline: ต้องสแกนพลาดไม่เกิน 1 ครั้ง

## ตำแหน่งสำหรับอัปโหลด

แพ็กนี้จัดโครงสร้างสำหรับแทนที่ไฟล์ในโฟลเดอร์เดิมที่ใช้งานอยู่:

```text
/sgnal-hunt/
  w1-ux-detective.html
  css/uxq-core.css
  js/uxq-w1.js
```

คงชื่อโฟลเดอร์ `sgnal-hunt` เดิมไว้ก่อน เพื่อไม่ทำให้ลิงก์ที่ใช้อยู่เกิด 404. เมื่อพร้อมเปลี่ยนชื่อเป็น `signal-hunt` ค่อยทำ redirect และปรับทุกลิงก์พร้อมกันในรอบเดียว.
