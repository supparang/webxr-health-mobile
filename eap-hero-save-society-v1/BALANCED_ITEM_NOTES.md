# BALANCED_ITEM_NOTES v1e

แก้ตาม feedback:
1. ตัวเลือกที่ยาวมักเป็นข้อถูก
2. คำถามซ้ำ/คล้ายกันในรอบเดียวกัน

## วิธีแก้ใน v1e
- เพิ่ม Balanced Item Bank ใหม่ 600 ข้อ
- ทุก Session มีข้อ balanced อย่างน้อย 40 ข้อ
- ระบบเลือกคำถาม `quality: v1e` ก่อน
- ตัวเลือกทั้ง 4 ข้อถูกเขียนให้ยาวใกล้เคียงกันมากขึ้น
- ตัวเลือกผิดยังดูเป็นไปได้ แต่ผิดเพราะเหตุผลทางทักษะ
- เพิ่ม `stemGroup` และ `textFingerprint()` เพื่อกันคำถามซ้ำ/คล้ายกันในรอบเดียวกัน
- ยังสุ่ม choice order ทุกครั้ง ทำให้คำตอบไม่ได้อยู่ตำแหน่งเดิม

## ข้อแนะนำต่อ
สำหรับสอบจริงระดับสูงมาก ควรให้ผู้สอน review item bank และทำ item analysis หลังสอบ:
- difficulty index
- discrimination index
- distractor analysis
- item exposure rate
