CSAI2102 AI Quest — PATCH v3.2.5 Accurate Accuracy Model

แก้แนวคิดจาก v3.2.4:
Score ไม่เท่ากับ Accuracy เสมอ
ห้ามใช้ score แทน accuracy แบบเงียบ ๆ

กติกาใหม่:
1) Accuracy ใช้ field accuracy ถ้ามีจริง
2) หรือคำนวณจาก correct / total * 100
3) ถ้าไม่มี accuracy และไม่มี correct/total ให้แสดง N/A
4) ไม่ใช้ score เป็น fallback

เพิ่ม:
- aiquest-teacher-accuracy-fix-v325.js
- aiquest-submit-accuracy-payload-v325.js

ผล:
- Attempts table จะไม่แสดง Accuracy=Score ถ้าไม่มีหลักฐานความถูกต้อง
- future submission จะพยายามส่ง accuracy เมื่อมี correct/total
- ถ้า attempt เก่าไม่มี correct/total จะแสดง N/A

เปิด:
 /ai-quest/index.html?teacher=1&v=20260614-accurate325

เช็ก:
 AIQUEST_TEACHER_ACCURACY_FIX
 AIQUEST_SUBMIT_ACCURACY_PAYLOAD
