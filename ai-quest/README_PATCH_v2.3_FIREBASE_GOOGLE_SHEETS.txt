CSAI2102 AI Quest — PATCH v2.3 Firebase + Google Sheets
=========================================================

ชุดนี้ทำต่อจนถึง v2.3 ตามลำดับ:
- v2.1c Classroom Entry + System Check
- v2.2 Data Contract + Classroom Config
- v2.3 Firebase + Google Sheets Sync

ไฟล์สำคัญ
----------
aiquest_patch/
  index.html
  classroom-config.html
  teacher-dashboard.html
  session2-agent-preview.html
  results.html
  js/
    aiquest-classroom-entry-v21c.js
    aiquest-data-contract-v22.js
    aiquest-sync-v23.js
    aiquest-gameplay-lockdown-v21b.js
    aiquest-adaptive-coach-v19.js
    aiquest-gate-support-v18.js
    mission1-hard-choice-upgrade.js
    mission2-agent-bank-v21.js
    aiquest-storage.js
    aiquest-cloud-logger.js
  apps-script/
    Code.gs
  README_PATCH_v2.3_FIREBASE_GOOGLE_SHEETS.txt

สิ่งที่เพิ่ม
------------

v2.1c Classroom Entry + System Check
- Classroom Entry Gate
- System Check
- Draft/Resume placeholder
- Submit Policy Notice
- Teacher Override placeholder

v2.2 Data Contract + Classroom Config
- schemaVersion = 2.2.0
- courseId / classId / term / section / teacherId
- runMode / scorePolicy / feedbackPolicy
- profile / attempt / event / progress builder
- validator ก่อน sync
- หน้าใหม่ /ai-quest/classroom-config.html

v2.3 Firebase + Google Sheets Sync
- queue sync กลาง
- submitProfile()
- submitAttempt()
- submitEvent()
- syncAll()
- Google Sheets ผ่าน Apps Script action=sync_v23
- Firebase RTDB REST พร้อมใช้เมื่อใส่ databaseURL

Apps Script URL ล่าสุด
----------------------
https://script.google.com/macros/s/AKfycbwXSUHbhVbZtKcjNIDzs4TawAohdeInm1MxLpomVeST2JilOL3L0LWQtT4_Yb7fbJG9/exec

วิธีติดตั้ง
-----------
1. แตก zip
2. อัปโหลดทับ /ai-quest/
3. เปิด /ai-quest/classroom-config.html
4. ตั้งค่า:
   - courseId
   - term
   - classId
   - section
   - scorePolicy
   - Apps Script URL
   - Firebase Config ถ้าจะเปิด Firebase
5. เปิด /ai-quest/index.html

Console ต้องเห็น
----------------
[AIQuest] v2.1c-classroom-entry-system-check loaded
[AIQuest] v2.2-data-contract-classroom-config loaded
[AIQuest] v2.3-firebase-google-sheets-sync loaded

การเปิด Firebase
----------------
ใน classroom-config.html:
1. ใส่ Firebase Config JSON เช่น
   {
     "databaseURL":"https://YOUR-PROJECT-default-rtdb.asia-southeast1.firebasedatabase.app"
   }
2. ตั้ง Firebase = ON
3. บันทึก Config

หมายเหตุ Firebase Rules สำหรับทดสอบเท่านั้น
---------------------------------------------
อย่าใช้ production rules แบบเปิดถาวร
สำหรับ pilot สั้น ๆ อาจใช้ rules ชั่วคราว แล้วค่อยล็อก auth ภายหลัง

Apps Script
-----------
ใน Code.gs เดิม ให้เพิ่ม routing นี้ใน doPost(e):

var body = aiquest_v23_parse_(e);
if (body.action === 'sync_v23') {
  return aiquest_v23_output_(aiquest_v23_sync_(body.kind, body.payload || {}));
}

ถ้า Code.gs ใน zip ถูกนำไปใช้ทั้งไฟล์/รวมกับเดิมแล้ว ให้ตรวจว่ามีฟังก์ชัน:
- aiquest_v23_parse_
- aiquest_v23_output_
- aiquest_v23_sync_
- aiquest_v23_updateTeacherSummary_

สถานะ
------
ชุดนี้เป็น v2.3 integration-ready patch
ก่อนใช้จริงในห้องเรียน:
- ทดสอบ Google Sheets 1 attempt
- ทดสอบ session_events ว่ามีแถว
- ถ้าเปิด Firebase ให้ทดสอบ 1 profile + 1 attempt + events ก่อน
