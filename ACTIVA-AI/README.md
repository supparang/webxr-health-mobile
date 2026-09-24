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


## V0.3.2 — Model Evaluation Registry + AI/XAI Review
- แก้ CI bug ใน Ground Truth queue (req scope)
- เพิ่ม ModelRun registry และสถานะ CANDIDATE/EVALUATED/APPROVED/DEPLOYED/RETIRED
- แยก Evaluation → Approval → Deployment เป็น governance gates
- Synthetic model deploy ถูกปฏิเสธตามค่าเริ่มต้น; อนุญาตเฉพาะ ephemeral CI เมื่อ ALLOW_SYNTHETIC_CI=true
- เพิ่ม Prediction Import เฉพาะ DEPLOYED model
- Prediction ไม่เปลี่ยน final evidence status อัตโนมัติ
- เพิ่ม AI/XAI Review Workspace สำหรับ ADMIN/STAFF
- แสดง Risk Probability, Prediction, Explanation, Model Version และ Human Decision
- คำอธิบาย AI ถูกระบุว่าเป็น predictive explanation ไม่ใช่ causal conclusion


## V0.3.3 — Offline-to-System Prediction Pipeline
- Threshold ถูกเลือกและล็อกจาก validation data เท่านั้น
- train_baselines.py สร้าง model artifact, evaluation, model manifest และ model-registry payload
- เพิ่ม predict_records.py สำหรับสร้าง risk probability + local predictive explanation แบบ offline
- เพิ่ม /api/ml/inference-dataset สำหรับ raw live inference features โดยไม่รวม Ground Truth
- เพิ่ม /api/predictions/import-batch สำหรับนำ prediction bundle กลับเข้าระบบ
- เพิ่ม unique constraint ต่อ Attendance × ModelRun เพื่อป้องกัน prediction ซ้ำ
- เพิ่ม UI ดาวน์โหลด inference dataset และ import prediction bundle
- AI prediction ไม่เปลี่ยน final evidence status อัตโนมัติ
- Local explanation ใช้ single-feature reference perturbation และระบุชัดว่าไม่ใช่ causal explanation


## V0.3.4 — Database-Free Demo Mode
- เพิ่ม Demo Mode สำหรับทดลอง ACTIVA-AI โดยไม่ต้องเชื่อม PostgreSQL
- Demo data เก็บใน localStorage ของ browser และติดป้าย DEMO / SYNTHETIC ชัดเจน
- รองรับ workflow หลัก: Activity → Dynamic QR → Check-in/out → Staff Verification → Evidence → Human Review
- รองรับ Ground Truth / Readiness / Model registry / XAI screens ในระดับสาธิต
- เพิ่มปุ่มสลับ Demo Mode กับ Server Mode ที่หน้า Login
- เพิ่มปุ่มล้างข้อมูล Demo
- Server Mode เดิมยังคงใช้ API + Prisma + PostgreSQL
- ข้อมูล Demo ห้ามใช้เป็นผลวิจัยหรือรายงานเชิงประจักษ์


## V0.3.5 — Mobile Camera QR Scan
- เพิ่มปุ่ม "📷 สแกน QR" ในหน้า Check-in
- ใช้กล้องหลังของมือถือผ่าน html5-qrcode
- เมื่ออ่าน QR สำเร็จ ระบบนำ token ไป Check-in โดยอัตโนมัติ
- ยังมี "กรอก/วาง Token" เป็น fallback
- Demo QR สามารถสแกนข้ามอุปกรณ์ได้ภายในอายุ token 45 วินาที โดยตรวจ event id + issued timestamp จาก token
- กล้องต้องเปิดผ่าน HTTPS หรือ localhost และผู้ใช้ต้องอนุญาต Camera permission


## V0.3.6 — Duplicate Check-in Prevention
- 1 คนต่อ 1 กิจกรรมมี AttendanceRecord ได้เพียง 1 รายการ
- ถ้า Check-in อยู่แล้ว ระบบตอบ ALREADY_CHECKED_IN และไม่สร้างแถวใหม่
- ถ้า Check-in/Check-out ครบแล้ว ระบบตอบ ACTIVITY_ALREADY_COMPLETED และให้ไป Staff Verification/Evidence Review ต่อ
- ป้องกัน Check-out ซ้ำด้วย ALREADY_CHECKED_OUT
- เพิ่ม unique constraint activityId + userId สำหรับ PostgreSQL Server Mode
- ปุ่ม Check-out บน UI ถูกปิดเมื่อรายการ Check-out แล้ว


## V0.3.7 — Evidence Integrity, Manual Override and Duplicate Repair
- แยก System Evidence Status ออกจาก Final Human Decision อย่างเด็ดขาด
- Rule-based Evidence Engine ไม่สามารถเปลี่ยนเป็น VERIFIED จากผล Human Review
- VERIFY ปกติถูกบล็อกเมื่อมี required evidence ขาดหรือมี blocker เช่น SHORT_DURATION
- Admin Manual Override ใช้ OVERRIDE_VERIFY + เหตุผลบังคับ + Audit Trail และแสดง OVERRIDE_VERIFIED
- Evidence/Checkout/Staff changes สามารถ invalidate ผลรับรองเดิมที่ไม่ใช่ override
- เพิ่ม “ยกเลิกรายการผิด” สำหรับ ADMIN/STAFF แทนการลบข้อมูล พร้อมเหตุผลและ Audit Trail
- รายการ voided ถูกตัดออกจาก dashboard, Ground Truth, ML inference และ research export
- ป้องกัน Staff Verification/Checkout ซ้ำและแสดงสถานะปุ่มให้ชัด
- ปรับ Attendance/Evidence/Human Review เป็น mobile cards เพื่อลดปัญหาตารางล้นจอ
- แสดงเวลาเข้า→ออกใน dropdown เพื่อเลือกรายการซ้ำเก่าได้ถูกแถว
