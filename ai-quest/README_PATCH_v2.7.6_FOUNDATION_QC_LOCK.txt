CSAI2102 AI Quest — PATCH v2.7.6 Foundation QC Lock
======================================================

เป้าหมาย
--------
หลัง v2.7.5 เพิ่มคลัง S1-S3+B1 ขนาดใหญ่แล้ว รอบนี้เพิ่ม QC Lock ก่อนเปิด S4
เพื่อให้มั่นใจว่า bank โหลดครบ จำนวนถึงเกณฑ์ และระบบ no-repeat ยังทำงาน

สิ่งที่เพิ่ม
------------
1. Foundation QC Tool v2.7.6
   - AIQUEST_FOUNDATION_AUDIT_V276.counts()
   - AIQUEST_FOUNDATION_AUDIT_V276.countStatus()
   - AIQUEST_FOUNDATION_AUDIT_V276.report()
   - AIQUEST_FOUNDATION_AUDIT_V276.noRepeatReport()
   - AIQUEST_FOUNDATION_AUDIT_V276.resetAll()

2. Threshold Gate ก่อนเปิด S4
   - S1 target >= 300 tasks
   - S2 target >= 220 tasks
   - B1 target >= 200 claims
   - S3 target >= 300 tasks

3. Pattern Scan
   - ตรวจ sample ของ answer-too-long
   - ตรวจ prefix cue เช่น ถูก/ไม่ถูก ที่อาจทำให้เดาได้
   - รายงานเป็น patternIssues

4. No-repeat Sampling
   - ทดลอง buildMission1Round / buildSession2Round / buildBoss1Round / buildSession3Round
   - ตรวจ family duplicate ภายในรอบ

5. Production Checklist แสดง Foundation QC Lock
   - เพิ่ม pill: Foundation Bank QC
   - เพิ่มกล่อง Foundation QC Lock พร้อม counts S1/S2/B1/S3

ติดตั้ง
-------
1. อัปโหลดไฟล์ทั้งหมดใน aiquest_patch
2. แทนที่ Apps Script Code.gs ทั้งไฟล์
3. Deploy Apps Script เป็น version ใหม่
4. เปิด:
   /ai-quest/index.html?v=20260612-foundqc276

ตรวจสอบใน Console
------------------
AIQUEST_FOUNDATION_AUDIT_V276.counts()
AIQUEST_FOUNDATION_AUDIT_V276.countStatus()
AIQUEST_FOUNDATION_AUDIT_V276.noRepeatReport()
AIQUEST_FOUNDATION_AUDIT_V276.report()

ผลที่ควรเห็น
-------------
- Production Checklist: Server v2.7.6
- Production Checklist: Foundation Bank QC เป็นเครื่องหมายถูก
- Foundation QC Lock: PASS พร้อมก่อน S4
- counts ของ S1/S2/B1/S3 ผ่าน threshold
