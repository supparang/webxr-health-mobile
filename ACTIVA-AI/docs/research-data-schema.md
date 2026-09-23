# Research Data Schema

ชุดข้อมูลวิจัยต้องแยกจากฐานข้อมูลปฏิบัติการและใช้รหัสลดการระบุตัวบุคคล

## Core fields
- record_id
- participant_hash
- event_id
- activity_type
- qr_valid
- identity_verified
- checkin_time
- checkout_time
- duration_ratio
- staff_verified
- signature_verified
- missing_evidence_count
- evidence_mismatch_count
- consistency_status
- rule_flag
- ai_model_version
- ai_prediction
- risk_probability
- human_reviewer_hash
- human_decision
- review_reason
- review_time_seconds
- ground_truth
- final_status

## Ground-truth rule
AI prediction ต้องไม่ถูกเปิดให้ผู้ประเมิน ground truth เห็นในช่วง labeling เพื่อลด automation bias และ label contamination

เหตุผลของ ground truth ใช้ multi-label reason codes และมี final target แยกต่างหาก เช่น REVIEW_REQUIRED / NO_REVIEW_REQUIRED
