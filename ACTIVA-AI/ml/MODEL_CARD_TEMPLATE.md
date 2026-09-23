# ACTIVA-AI Model Card Template

## 1. Model identity
- Model version:
- Training date:
- Code commit:
- Selected model family:

## 2. Intended use
ช่วยจัดลำดับระเบียนการเข้าร่วมกิจกรรมที่ควรได้รับการตรวจสอบโดยมนุษย์ ไม่ใช้เป็นการกล่าวหาการทุจริต และไม่ใช้ตัดสินผลด้านบุคลากรโดยอัตโนมัติ

## 3. Target
REVIEW_REQUIRED vs NO_REVIEW_REQUIRED จาก locked adjudicated ground truth

## 4. Data
- Number of records:
- Number of participants/groups:
- Number of events:
- Positive prevalence:
- Train/validation/test split strategy:
- Data collection period/context:

## 5. Performance
รายงาน Precision, Recall, Specificity, F1, ROC-AUC, PR-AUC, Brier Score และ 95% CI ตาม protocol

## 6. Calibration
- Calibration method:
- Calibration assessment:
- Threshold selection rule:

## 7. Explainability
Permutation importance / approved XAI method; คำอธิบายเป็น predictive association ไม่ใช่ causal explanation

## 8. Human oversight
AI ให้ risk/supporting explanation; authorized human reviewer เป็นผู้ตัดสินใจสุดท้าย

## 9. Limitations and risks
- Dataset shift
- Class imbalance
- Repeated participant/event clustering
- Missing evidence
- Automation bias
- Fairness across relevant operational groups (เฉพาะเมื่อมีฐานจริยธรรมและข้อมูลที่เหมาะสม)

## 10. Deployment gate
ห้าม deploy จนกว่าจะผ่าน locked-test evaluation, calibration review, privacy/security review และ human-review workflow validation
