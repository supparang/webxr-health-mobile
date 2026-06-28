EAP Word Quest v193 — Score, Combo & Recovery Reward Patch

วัตถุประสงค์
- แก้กรณีตอบถูกแล้ว XP ใน Summary เป็น 0 เมื่อยังไม่ผ่านด่าน
- แสดง Max Combo อย่างน้อย 1 เมื่อมีคำตอบถูก
- เก็บ XP/Combo ที่คำนวณใหม่เข้า Learning Log และ CSV
- ให้ reward ระหว่างฝึก แม้คะแนนยังไม่ถึงเกณฑ์ผ่าน

ไฟล์ในชุดนี้
1) index.html
2) eap-word-engine-v193-score-combo-recovery.js

ติดตั้ง
1. วางไฟล์ทั้งสองทับใน:
   /herohealth/eap-word-quest/
2. index.html นี้ต้องใช้ร่วมกับไฟล์ v189/v190/v191/v192 เดิมที่มีอยู่แล้ว
3. เปิดหน้าเกมด้วย cache-busting URL:
   index.html?v=20260628-v193-test1

กติกา XP v193
- ตอบถูกทุกข้อ: 60 XP ต่อข้อ
- Combo: โบนัสเพิ่มตาม streak (สูงสุด +90)
- ตอบเร็ว: โบนัส +5 หรือ +10 ต่อข้อที่ตอบเร็ว
- ผ่าน Session: +140 XP
- ผ่าน Boss Gate: +220 XP
- ผ่าน Weak Words mode: +75 XP
- Perfect round: +100 XP Session / +160 XP Boss
- ทำคะแนนสูงกว่า best เดิม: Improvement Bonus สูงสุด +120 XP
- AI Help ไม่ตัด XP พื้นฐาน; เพียงไม่ให้ No-Hint Bonus

ตัวอย่าง
S1 ได้ 4/10 = อย่างน้อย 240 XP (ก่อนโบนัส combo/speed)
จึงไม่เกิด Summary: XP 0 อีก

Console test
inspectEapV193()
getEapV193RewardPreview()

ผลที่ต้องเห็นหลังเล่น S1 รอบใหม่
- Summary มี "XP earned this round"
- XP มากกว่า 0 เมื่อ correct มากกว่า 0
- Max Combo อย่างน้อย 1 เมื่อมีข้อถูก
- Teacher CSV/log มี xp, comboBonus, passBonus, improvementBonus
