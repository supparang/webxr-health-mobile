# DUPLICATE_GUARD_v1q

## ผล audit จาก v1p
- Template IDs ไม่ซ้ำ
- Object IDs ไม่ซ้ำ
- Passage text ไม่ซ้ำ
- พบข้อความ Reading ซ้ำเล็กน้อย 2 ประโยค
- พบ topic label ซ้ำ 1 จุด

## แก้ใน v1q
1. แก้ Reading prompt ที่ใช้ข้อความซ้ำ
2. แก้ topic label `review strategy` ที่ซ้ำ
3. เพิ่ม combo anti-repeat:
   - เดิมกัน topic ล่าสุดและ template ล่าสุด
   - ใหม่กัน topic+template combination ล่าสุดด้วย
   - เก็บ combo history 120 รายการต่อ Session/Skill
4. เพิ่ม Skill Template Duplicate Audit ใน QA Lock

## ความซื่อสัตย์ทางเทคนิค
ระบบนี้กัน exact duplicate และ repeated combo ได้มากขึ้น
แต่ไม่สามารถรับประกัน semantic near-duplicate 100% เพราะบางโจทย์ใน EAP อาจมีทักษะใกล้กันโดยธรรมชาติ เช่น claim/evidence กับ argument-map
