EAP Word Quest v195 — Core Truth + Stability Final Patch

แก้ปัญหาที่พบจาก v194:
1) ตัด legacy pass ออกจาก Core progress ทั้งหมด
   - progress 20/20 หรือ 19/20 เก่าจะไม่ปลดล็อก Core session ใหม่
   - นับเฉพาะการเล่นจาก Core Bank v191/v195 จริง
2) ตัด v183 Progress Sync ออก
   - แก้ Console spam และ progress ที่ขึ้นไม่ตรงกับ Core run
3) แก้ Base undefined ใน reward box
4) AI metrics แยกตาม Student ID
   - นักศึกษาคนใหม่เริ่ม AI ที่ A2+ / Collecting evidence
   - ไม่ใช้ performance ของคนอื่นหรือ bank เก่ามาปน
5) XP/Combo/Recovery ยังทำงานโดยไม่ wrap logger ซ้ำ

วางทับในโฟลเดอร์:
/herohealth/eap-word-quest/

ไฟล์ที่ต้องแทน:
- index.html
- eap-word-engine-v195-core-ai-student-scoped.js
- eap-word-engine-v195-core-truth-progress-controller.js
- eap-word-engine-v195-stable-score-core-progress.js

สำคัญ: index.html ชุดนี้ไม่โหลด v183, v190, v192, v193 หรือ v194 แล้ว

หลังอัปโหลด เปิด:
index.html?v=20260628-v195-core-truth

ทดสอบ:
1. Home ต้องแสดง 0/20 สำหรับ Core path ใหม่ (หรือเฉพาะ core v192 run ของ Student ID เดียวกันที่ migrate มา)
2. เล่น S1 <60% ต้อง Progress 0/20 และ Next S1
3. เล่น S1 >=60% ต้อง Progress 1/20 และ Next S2 หรือ S3 (Session ใน Arc 1 เลือกได้)
4. Summary ต้องไม่มี 'Progress Sync' เก่า แต่ต้องมี 'Core Progress'
5. Reward box ต้องขึ้น 'Base 360' ไม่ใช่ 'Base undefined'
6. Console ไม่ควรมี v183 progress sync ซ้ำ
