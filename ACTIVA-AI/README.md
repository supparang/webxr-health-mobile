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


## V0.3.8 — Legacy Demo Integrity Migration
- ล้างสถานะ VERIFIED เก่าที่ขัดกับ Evidence Policy โดยอัตโนมัติเมื่อโหลด Demo state
- ถ้า required evidence ขาด, Staff required แต่ไม่มี, duration ต่ำกว่า policy หรือยังไม่ได้ evaluate ระบบจะเปลี่ยน Final Decision เดิมกลับเป็น PENDING
- ไม่แตะ OVERRIDE_VERIFIED เพราะเป็น explicit governance decision
- ตรวจ active duplicate records ใน Evidence Matrix
- ปิดปุ่ม “ประเมินหลักฐานทั้งหมด” จนกว่าจะจัดการรายการซ้ำก่อน
- ไม่ auto-delete/auto-void duplicate เพราะระบบไม่ควรเดาเองว่าแถวใดคือข้อมูลที่ถูกต้อง


## V0.3.9 — Mobile Audit Trail Visual QA
- ปรับ Audit Trail บนมือถือจากตารางกว้างเป็น cards
- แปล action code สำคัญเป็นภาษาไทย แต่ยังแสดง code เดิมใน “ข้อมูลทางเทคนิค”
- แสดงผู้ดำเนินการ บุคลากร กิจกรรม เหตุผล Blocker และ Decision ในหน้าจอเดียว
- เพิ่มตัวกรองค้นหา / ผู้ดำเนินการ / เหตุการณ์
- Server และ Demo mode enrich audit logs ด้วย participant/activity context โดยไม่แก้ audit record เดิม
- แปล reason code เช่น SHORT_DURATION เป็นข้อความไทยสำหรับผู้ใช้


## V0.4.0 — Thai-First Operational UI
- แปลสถานะที่ผู้ใช้เห็นเป็นภาษาไทย เช่น ต้องตรวจสอบ, รอการตัดสิน, รับรองแล้ว, รับรองเป็นกรณีพิเศษ
- เก็บ technical status code เดิมไว้ใน title/data-code เพื่อใช้ด้านวิจัยและ debugging
- ปรับ Human Review Center เป็น “ศูนย์ตรวจสอบโดยมนุษย์”
- ปรับ System Evidence / Final Decision / Blockers / Staff Verification เป็นคำไทย
- แปล reason codes เช่น SHORT_DURATION เป็น “ระยะเวลาเข้าร่วมไม่ถึงเกณฑ์”
- เพิ่ม “ดูรหัสทางเทคนิค” แบบพับได้ เพื่อไม่ให้เจ้าหน้าที่ทั่วไปต้องอ่าน code ภาษาอังกฤษ


## V0.4.1 — Personnel & User Administration
- เพิ่มเมนู “บุคลากร” สำหรับ ADMIN
- เพิ่มบุคลากรทีละคน: รหัสบุคลากร, ชื่อ, อีเมล, หน่วยงาน, บทบาท
- แก้ไขชื่อ/อีเมล/หน่วยงาน/บทบาท โดยไม่เปลี่ยนรหัสบุคลากร
- เปิด/ปิดการใช้งานบัญชีแทนการลบ เพื่อรักษา Audit Trail
- ป้องกัน Admin ปิดใช้งานบัญชีตัวเอง
- เพิ่มนำเข้า CSV UTF-8 สูงสุด 2,000 รายการ
- CSV bulk import ไม่สร้าง ADMIN และข้ามรหัสที่มีอยู่แล้ว
- เพิ่มไฟล์ตัวอย่าง CSV ให้ดาวน์โหลดจากหน้าเว็บ
- Demo Mode และ Server Mode ใช้ workflow เดียวกัน


## V0.4.2 — Grouped Admin Navigation
- จัดเมนูตามหมวด: งานประจำ / การตรวจสอบ / งานวิจัยและ AI / ระบบ
- เมนูแต่ละหมวดพับ–ขยายได้
- บนมือถือ/แท็บเล็ต เปิดเฉพาะหมวดงานประจำเป็นค่าเริ่มต้น และเปิดหมวดที่มีหน้าปัจจุบันให้อัตโนมัติ
- จำสถานะพับ–ขยายภายใน session
- คง Role-Based Access เดิม: ผู้ใช้เห็นเฉพาะเมนูตามสิทธิ์
- ย้าย “ออกจากระบบ” ไว้ในหมวดระบบ
- ปรับ sidebar ให้เลื่อนได้เมื่อเมนูยาว


## V0.5.0 — Activity Permission Governance
- แยก “สิทธิ์กำหนดกิจกรรม” ออกจาก role ถาวรของบุคลากร
- ADMIN เพิ่ม/ลดสิทธิ์กิจกรรมรายบุคคลได้จากเมนู บุคลากร → สิทธิ์กิจกรรม
- รองรับ 6 สิทธิ์: สร้างกิจกรรม, จัดการกิจกรรมของตน, เพิ่มผู้จัดร่วม, มอบหมายผู้ตรวจสอบ, ปิดกิจกรรม, จัดการกิจกรรมทั้งหมด
- กำหนดวันเริ่ม/วันสิ้นสุดสิทธิ์ได้
- การ grant/update/revoke ทุกครั้งต้องมีเหตุผลและลง Audit Trail
- ผู้ที่ไม่มี CAN_CREATE_ACTIVITY ไม่สามารถสร้างกิจกรรม แม้เดิมจะมี role ORGANIZER
- Demo ORG001 ถูก seed สิทธิ์กิจกรรมเพื่อ backward compatibility
- ADMIN สร้างกิจกรรมแทนได้ และเลือก Primary Organizer จากผู้ที่มีสิทธิ์สร้างกิจกรรม
- QR ออกได้เฉพาะ Admin, ผู้มีสิทธิ์จัดการทั้งหมด หรือเจ้าของกิจกรรมที่ยังมีสิทธิ์จัดการกิจกรรมของตน


## V0.5.1 — Role / Permission Terminology Pass
- ปรับหน้า Login ให้สื่อชัดว่า ORG001 คือ “บุคลากรที่ได้รับสิทธิ์จัดกิจกรรม” ไม่ใช่ประเภทบุคลากรถาวร
- STAFF แสดงเป็น “ผู้ตรวจสอบหลักฐาน”
- PARTICIPANT แสดงเป็น “บุคลากรผู้เข้าร่วมกิจกรรม”
- เปลี่ยนคำว่า “บทบาท” ในหน้าบุคลากรเป็น “บทบาทระบบพื้นฐาน/บทบาทระบบ”
- ย้ำใน UI ว่าสิทธิ์จัดกิจกรรมกำหนดแยกผ่าน Activity Permissions
- Demo migration ปรับชื่อบัญชีเดิมโดยไม่ต้องล้างข้อมูล Demo


## V0.5.2 — Per-Activity Responsibility & Participation
- เพิ่ม Co-organizer และ Verifier แบบผูกกับกิจกรรม ไม่เปลี่ยน role ถาวรของบุคลากร
- Primary Organizer / ADMIN สามารถมอบหมายผู้จัดร่วมและผู้ตรวจสอบตาม permission
- Co-organizer จัดการกิจกรรมที่ได้รับมอบหมายได้ แม้ไม่มีสิทธิ์สร้างกิจกรรมระดับระบบ
- เพิ่มรูปแบบผู้เข้าร่วม 3 แบบ: OPEN, ROSTER, GROUP
- ROSTER จำกัดการสแกน QR ให้เฉพาะรายชื่อที่กำหนด
- GROUP จำกัดตามหน่วยงาน
- เพิ่มหน้าจอมือถือ “จัดผู้รับผิดชอบ/ผู้เข้าร่วม” ในรายการกิจกรรม
- ทุกการเปลี่ยน Assignment และ Participation Policy ถูกบันทึกใน Audit Trail


## V0.5.3 — Demo Mode Load Hotfix
- แก้ syntax error ใน `demo-api.js` ที่ทำให้หน้าเว็บแจ้ง `DEMO_API_NOT_LOADED`
- เพิ่ม `node --check demo-api.js` ใน ACTIVA-AI CI เพื่อป้องกัน regression
- bump cache key เป็น `v=053` เพื่อให้มือถือโหลดไฟล์ Demo API รุ่นแก้ไขทันที


## V0.5.4 — Expanded Demo Personnel Roster
- เพิ่มบัญชีบุคลากรทดลอง T001–T010 ใน Demo Mode
- T010 สามารถเข้า Demo Mode ได้โดยไม่ต้องสร้างผ่าน ADMIN ก่อน
- migration จะเติม T001–T010 ให้ localStorage เดิมโดยไม่ล้างข้อมูลกิจกรรม/attendance เดิม
- ปรับข้อความ error เมื่อกรอกรหัส Demo ที่ไม่มี ให้แสดงบัญชีที่ใช้ได้แทน raw DEMO_USER_NOT_FOUND


## V0.5.5 — Co-organizer Change Governance
- ก่อนเริ่มกิจกรรม: ผู้มีสิทธิ์สามารถเพิ่ม/ลดผู้จัดร่วมได้ตามปกติ
- ระหว่างกิจกรรม: แก้ไขได้เฉพาะผู้มีสิทธิ์และต้องระบุเหตุผลอย่างน้อย 10 ตัวอักษร
- หลังสิ้นสุดกิจกรรม: รายชื่อถูกล็อกสำหรับผู้ใช้ทั่วไป; เฉพาะ ADMIN แก้ได้แบบ Administrative Override พร้อมเหตุผล
- ทุกการเปลี่ยนแปลงเก็บ Audit Trail พร้อม lifecycle, ผู้เพิ่ม/ถอน และเหตุผล
- ปุ่มหลังเคยบันทึกเปลี่ยนเป็น “บันทึกการเปลี่ยนแปลง”
- แสดง “บันทึกล่าสุด” ในหน้าผู้จัดกิจกรรมร่วม
- ถ้ารายชื่อไม่เปลี่ยน ระบบไม่สร้าง Audit event ใหม่
- การเป็น Co-organizer ยังคงเป็นสิทธิ์เฉพาะกิจกรรม ไม่เปลี่ยน role ถาวรของบุคลากร


## V0.5.6 — QR Check-in Time Window Enforcement
- กำหนด Check-in Open / Check-in Close ต่อกิจกรรม
- ค่าเริ่มต้น: เปิดก่อนเวลาเริ่ม 30 นาที และปิดหลังเวลาเริ่ม 30 นาที
- Dynamic QR สร้าง/หมุนได้เฉพาะช่วง Check-in Window
- QR แต่ละ token อายุสูงสุด 45 วินาที และจะไม่เลยเวลาปิด Check-in
- Check-in API ตรวจ window ซ้ำอีกชั้น แม้ token ยังไม่หมดอายุ
- ก่อนเวลาเปิด: QR_CHECKIN_NOT_OPEN
- หลังเวลาปิด: QR_CHECKIN_CLOSED
- Participant scope (OPEN/ROSTER/GROUP), identity และ duplicate checks ยังทำงานร่วมกัน
- เพิ่มช่วง Checkout Open/Close ในกิจกรรมเพื่อรองรับ policy ขั้นต่อไป
- UI แสดงช่วง Check-in และข้อความภาษาไทยเมื่อยังไม่เปิด/ปิดแล้ว/QR หมดอายุ


## V0.5.7 — Portable Demo QR Across Devices
- แก้ปัญหา Demo Mode ที่สร้างกิจกรรมบนเครื่อง A แต่เครื่อง B ไม่มี activityId เดียวกัน จึงเคยถูกตีความเป็น QR หมดอายุ
- Dynamic QR ใน Demo Mode ใช้ format ACTIVADEMO1 ที่บรรจุ activity snapshot ขั้นต่ำสำหรับตรวจ Check-in ข้ามอุปกรณ์
- ฝั่งผู้สแกนสามารถ materialize กิจกรรมชั่วคราวจาก QR แล้วตรวจ Check-in Window, OPEN/ROSTER/GROUP, identity และ duplicate ต่อได้
- QR Demo ยังมีอายุสูงสุด 45 วินาที
- ขยาย QR เป็น 240×240 และใช้ error correction ระดับ L เพื่อให้อ่าน payload ที่ยาวขึ้นได้ง่ายขึ้น
- แก้ข้อความ UI: Demo Mode ไม่อ้างว่าใช้ HMAC-SHA256; HMAC ใช้เฉพาะ Server Mode
- ข้อจำกัดยังคงอยู่: localStorage ไม่ sync attendance ข้ามอุปกรณ์ ดังนั้น Check-in ที่เครื่องผู้เข้าร่วมจะไม่ไปปรากฏบนเครื่อง Staff/Admin จนกว่าจะใช้ shared backend
