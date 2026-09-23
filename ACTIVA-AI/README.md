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


## V0.2.1 เพิ่มเติม
- Role-based API access control สำหรับ ADMIN / ORGANIZER / STAFF / PARTICIPANT
- รองรับ x-activa-user-id เป็น database id หรือ employeeId เช่น ADM001
- Demo seed data
- Docker Compose สำหรับ PostgreSQL + app
- Dashboard summary API
- Attendance listing API
- แก้ catch-all route ให้เข้ากับ Express 5


## V0.2.2 — Frontend/API Integration
- หน้าเว็บใช้ PostgreSQL/API เป็น source of truth แล้ว
- เพิ่ม /api/me สำหรับตรวจ demo identity จากฐานข้อมูล
- Dashboard และ Attendance ใช้ข้อมูล server-side
- Dynamic QR มาจาก server-signed token
- เพิ่ม Evidence Matrix, Human Review, Ground Truth, Audit และ Research Export ที่เชื่อม API
- Participant ถูกจำกัดให้เห็นและจัดการ attendance ของตนเอง
- Ground Truth workspace ไม่แสดง AI prediction
- Docker bootstrap ใช้ prisma db push สำหรับ prototype


## V0.2.3 — Automated Research Workflow QA
- เพิ่ม GitHub Actions CI สำหรับ ACTIVA-AI โดยเฉพาะ
- เพิ่ม end-to-end smoke test ตั้งแต่ Dynamic QR ถึง Research Export
- ตรวจ participant privacy filtering
- ตรวจว่า Ground Truth queue ไม่รั่ว AI prediction
- ตรวจการ de-identification ของ research export
- เพิ่ม JSON 404 สำหรับ API path ที่ไม่มีจริง


## V0.3.0 — Ground Truth Lock + ML Baseline Research Pipeline
- เพิ่ม GroundTruthCase สำหรับ adjudication และ lock final labels
- Ground Truth queue ซ่อนทั้ง AI prediction และ rule consistency result เพื่อให้ reviewer ดู raw evidence
- เพิ่ม /api/ground-truth/:id/adjudicate และ /lock
- เพิ่ม /api/ml/readiness
- เพิ่ม /api/ml/dataset ที่ส่งออกเฉพาะ LOCKED ground truth และลดการระบุตัวบุคคล
- เพิ่ม Python baseline pipeline: Logistic Regression, Random Forest, Gradient Boosting
- เลือก model family บน validation PR-AUC เท่านั้น
- Final test set ถูกกันออกจาก model selection
- รายงาน Precision, Recall, Specificity, F1, ROC-AUC, PR-AUC, Brier, calibration และ cluster-bootstrap 95% CI
- เพิ่ม permutation importance สำหรับ predictive explainability
- CI ใช้ synthetic dataset เฉพาะ software test และติดป้ายชัดว่าไม่ใช่ผลวิจัย


## V0.3.1 — Ground Truth Adjudication + AI Readiness UI
- STAFF reviewer เห็นเฉพาะ independent label ของตนเอง
- Ground Truth Workspace แสดง raw evidence โดยไม่แสดง AI prediction หรือ rule consistency result
- Admin เห็น peer labels เพื่อ adjudication หลังการติดป้าย
- เพิ่ม Adjudicate → Lock workflow ในหน้าเว็บ
- Ground Truth ที่ LOCK แล้วแก้ label/adjudication ซ้ำไม่ได้
- เพิ่ม AI Readiness Dashboard
- เพิ่มการดาวน์โหลด locked/de-identified ML dataset
- Smoke test ครอบคลุม independent-label isolation, adjudication, lock, readiness และ ML export
