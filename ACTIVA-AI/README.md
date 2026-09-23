# ACTIVA-AI

**Policy-Aware Multi-Source Evidence Framework for Trustworthy Employee Activity Participation Verification**

ต้นแบบเชิงวิจัยสำหรับตรวจสอบความน่าเชื่อถือของหลักฐานการเข้าร่วมกิจกรรมของบุคลากร โดยแยก "การบันทึกการเข้าร่วม" ออกจาก "การรับรองการเข้าร่วมที่เชื่อถือได้"

## สถานะ
### V0.1 — Functional Research Prototype
- Login แบบบัญชีทดลอง
- Activity + Evidence Policy
- Dynamic QR
- Check-in / Check-out
- Staff Verification
- Evidence Matrix
- Rule-based Consistency Checks
- Human Review
- Audit Trail
- Research Export

### V0.2 — Server / Research Foundation
เพิ่มแล้ว:
- PostgreSQL + Prisma schema
- Server-side API
- HMAC-signed expiring event QR token
- Policy-aware evidence evaluation
- Human review persistence
- Ground-truth labeling workflow ที่ blind ต่อ AI prediction
- De-identified research export
- Audit log
- โครงตาราง AIPrediction สำหรับโมเดลในระยะถัดไป

## เริ่มใช้งาน V0.2
1. ติดตั้ง Node.js และ PostgreSQL
2. คัดลอก .env.example เป็น .env
3. แก้ DATABASE_URL, QR_SIGNING_SECRET และ RESEARCH_HASH_SALT
4. รัน npm install
5. รัน npm run prisma:generate
6. รัน npm run prisma:migrate
7. รัน npm run dev
8. เปิด http://localhost:3000

## ข้อจำกัด
- V0.1 UI ยังใช้ localStorage เพื่อการสาธิต
- V0.2 API พร้อมเป็นฐานสำหรับเชื่อม UI เข้าฐานข้อมูลจริงในขั้นถัดไป
- ยังไม่เปิดใช้ AI risk prediction อัตโนมัติ
- ห้ามใช้ demo authentication เป็นระบบจริง
- ก่อนเก็บข้อมูลบุคลากรจริงต้องดำเนินการด้านสิทธิ์ จริยธรรม ความเป็นส่วนตัว และ security hardening

## งานถัดไป
V0.2.1:
- เชื่อมหน้าเว็บ V0.1 เข้ากับ API จริง
- role-based access control
- seed data
- Docker compose สำหรับ PostgreSQL
- server-side dashboard summaries

V0.2.2:
- Ground Truth adjudication workspace
- locked test-set workflow
- AI baseline: Logistic Regression / Random Forest / Gradient Boosting
- calibration + explainability

V0.3:
- SEM module: SQ, ET, EX, PR, PU, TR, BI
