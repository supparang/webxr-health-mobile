CSAI2102 AI Quest — PATCH v3.2.6 Accuracy Payload + Server

ปัญหา:
v3.2.5 ถูกหลักที่ไม่ใช้ Score แทน Accuracy แล้ว
แต่รอบใหม่ยังขึ้น N/A เพราะ payload ที่ส่งเข้า Google Sheets ไม่ส่ง accuracy/correct/total ครบ หรือ Apps Script ไม่คำนวณ accuracy ก่อนบันทึก

แก้:
1) compactAttemptForSync() เพิ่ม:
   - accuracy
   - correct
   - total
   - usedTimeSec
   - timeLeftSec
2) เพิ่ม helper ใน index:
   - accuracyPayloadValueV326()
   - correctPayloadValueV326()
   - totalPayloadValueV326()
3) เพิ่ม aiquest-submit-accuracy-payload-v326.js
   normalize payload ก่อน fetch ส่ง Google Sheets
4) Apps Script เพิ่ม:
   - computeAccuracyServer_()
   - normalizeAttemptAccuracy_()
   - appendAttempt_ คำนวณ accuracy จาก correct/total ก่อนเขียนชีต
5) ถ้าไม่มี correct/total จริง จึงแสดง N/A

เปิด:
 /ai-quest/index.html?teacher=1&v=20260614-accpayload326

ทดสอบ:
- เล่น B2 หรือ S3 ใหม่ 1 รอบ แล้วส่งผล
- Console ตอนส่งควรเห็น accuracy/correct/total ใน Google Sheets slim payload
- Teacher Detail รอบใหม่ควรขึ้น Accuracy จริง ไม่ใช่ N/A

เช็ก:
 AIQUEST_SUBMIT_ACCURACY_PAYLOAD
 AIQUEST_TEACHER_ACCURACY_FIX
