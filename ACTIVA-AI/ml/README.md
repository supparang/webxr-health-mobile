# ACTIVA-AI ML Baseline Pipeline

ส่วนนี้เป็น **research pipeline** สำหรับฝึกโมเดลหลังจาก Ground Truth ถูก adjudicate และ lock แล้วเท่านั้น

## โมเดลที่เปรียบเทียบ
- Logistic Regression — interpretable baseline
- Random Forest
- Gradient Boosting

ไม่มีการกำหนดผู้ชนะล่วงหน้า โมเดลถูกเลือกด้วย PR-AUC บน validation set และ final test set ถูกกันออกจากการเลือกโมเดล

## การแบ่งข้อมูล
ค่าเริ่มต้นแบ่งแบบ group-aware ตาม participant_hash เพื่อลด leakage จากบุคคลเดิมปรากฏหลาย record

หากคำถามวิจัยต้องการ generalization ข้ามกิจกรรม ควรวางแผน sensitivity analysis ที่ group by event_id เพิ่มเติม และกำหนดไว้ใน protocol ก่อนเปิด final test result

## Metrics
- Precision
- Recall / Sensitivity
- Specificity
- F1
- ROC-AUC
- PR-AUC
- Brier Score
- Calibration curve
- Cluster bootstrap 95% CI บน test groups

## Explainability ใน baseline
ใช้ permutation importance เพื่อบอกว่าตัวแปรใดช่วยการพยากรณ์ ไม่ใช้ตีความเชิงสาเหตุ

## วิธีใช้
1. Export locked dataset จาก GET /api/ml/dataset
2. บันทึกเป็น JSON
3. ติดตั้ง:
   pip install -r ml/requirements.txt
4. ฝึก:
   python ml/train_baselines.py --input locked_dataset.json --output-dir ml/out

## ข้อห้ามเชิงวิจัย
- ห้าม train จาก Ground Truth ที่ยังไม่ LOCKED
- ห้าม tune โมเดลจาก final test set
- ห้ามรายงาน synthetic CI dataset เป็นผลวิจัย
- ห้ามเรียก rule-based score ว่า AI probability
- ห้ามตีความ feature importance เป็น causality
