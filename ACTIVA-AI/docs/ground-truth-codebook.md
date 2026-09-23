# แนวทางการสร้าง Ground Truth สำหรับ ACTIVA-AI

## หลักการ
Ground Truth ต้องไม่สร้างจากผลทำนายของ AI และผู้ประเมิน Ground Truth ไม่ควรเห็นคะแนนความเสี่ยงหรือคำแนะนำจาก AI ระหว่างการติดป้ายข้อมูล

## เป้าหมายหลัก
ใช้ตัวแปรเป้าหมายแบบสองกลุ่ม:
- REVIEW_REQUIRED
- NO_REVIEW_REQUIRED

## Reason Codes แบบหลายป้าย
หนึ่งระเบียนสามารถมีปัญหามากกว่าหนึ่งประเภทได้ จึงไม่บังคับให้ INCOMPLETE, INCONSISTENT และ ANOMALY เป็นกลุ่มที่แยกจากกัน

ตัวอย่าง reason codes:
- MISSING_QR
- MISSING_IDENTITY
- MISSING_CHECKOUT
- MISSING_STAFF_VERIFICATION
- SHORT_DURATION
- DUPLICATE_SCAN
- TEMPORAL_CONFLICT
- STAFF_WITHOUT_CHECKIN
- OTHER

## กระบวนการ
1. ผู้ประเมินอย่างน้อย 2 คนตรวจหลักฐานโดยอิสระในชุดที่ใช้ประเมินความสอดคล้อง
2. บันทึก target และ reason codes
3. ผู้ประเมินไม่เห็น AI prediction
4. กรณีไม่ตรงกันเข้าสู่ adjudication
5. ล็อก Ground Truth ก่อนประเมินโมเดลบน test set
6. รายงาน inter-rater agreement เช่น Cohen's kappa เมื่อการออกแบบข้อมูลเหมาะสม

## การป้องกัน Data Leakage
- train/validation/test ต้องแยกก่อนการปรับ threshold ขั้นสุดท้าย
- feature engineering, hyperparameter tuning และ calibration ใช้เฉพาะ train/validation
- final test set ถูกล็อกจนกว่าจะจบขั้นตอนพัฒนาโมเดล
