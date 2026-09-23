# Evidence Policy

ACTIVA-AI ใช้ Policy-Aware Evidence Verification แทนการใช้กฎเดียวกับทุกกิจกรรม

Policy_a = { R_a, O_a, theta_a }

- R_a = หลักฐานที่จำเป็น
- O_a = หลักฐานเสริม
- theta_a = เกณฑ์ของกิจกรรม เช่น สัดส่วนเวลาขั้นต่ำ

## Evidence types
- Event QR
- Identity
- Check-in
- Check-out
- Temporal consistency
- Duration
- Staff verification
- Signature/supporting evidence

## หลักการสถานะ
Attendance Status และ Evidence Status ต้องไม่รวมเป็นตัวเดียว

Attendance Status ตัวอย่าง:
- CHECKED_IN
- CHECKED_OUT
- LATE
- EARLY_LEAVE

Evidence Status ตัวอย่าง:
- COMPLETE
- INCOMPLETE
- CONSISTENT
- INCONSISTENT
- REVIEW_REQUIRED
- VERIFIED

Recorded Attendance ไม่เท่ากับ Verified Participation.
