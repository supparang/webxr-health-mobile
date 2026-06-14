CSAI2102 AI Quest — PATCH v3.2.9 Phase 1 Final Dedupe

ปัญหา:
หน้า Teacher มีข้อความ Phase 1 Ready ซ้ำหลายกล่อง
เพราะ cleanup + final polish แทรก note ซ้ำในหลายตำแหน่ง

แก้:
1) เพิ่ม aiquest-phase1-final-dedupe-v329.js
2) เหลือรายการหลัก:
   - 1 badge ด้านบน
   - 1 Teaching Decision note
   - 1 Phase 1 Classroom Ready Final card
   - 1 Phase 1 Classroom Ready Checklist
3) ลบ note “Next: เปิด S6...” ที่ซ้ำ
4) กำหนด id ให้ card/checklist เพื่อกันซ้ำเมื่อ DOM render ใหม่
5) ของเดิมยังอยู่ครบ:
   - Accuracy Payload + Server
   - B2 Roadmap Native
   - B2 Submit Return Fix
   - B2 Specific Bank

เปิด:
 /ai-quest/index.html?teacher=1&v=20260614-dedupe329

เช็ก:
 AIQUEST_PHASE1_FINAL_DEDUPE
 AIQUEST_PHASE1_FINAL_DEDUPE.clean()
