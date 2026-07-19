
# CSAI2102 AI Quest — Module 2 Coding Lab Pilot

ขอบเขตชุดนี้:

- S1 AI vs Automation
- S2 Intelligent Agent
- S3 Breadth-First Search
- B1 Integrated AI Foundations Boss

## โครงสร้างไฟล์

### apps_script
- `AIQuestCoding_Config.gs`
- `AIQuestCoding_Receiver.gs`
- `AIQuestCoding_Router_Patch.txt`

### web
- `coding-lab.html`
- `aiquest-coding-client.js`
- `labs.json`

### notebooks
- Notebook สำหรับ S1, S2, S3 และ B1

## วิธีติดตั้ง

1. ติดตั้ง AI Quest Core v3.0 ก่อน
2. เพิ่มไฟล์ `.gs` ทั้งสองไฟล์ใน Apps Script
3. เพิ่ม branch จาก `AIQuestCoding_Router_Patch.txt` ใน Router เดิม
4. Deploy Web App ใหม่
5. นำโฟลเดอร์ `web` ขึ้น GitHub Pages หรือ Hosting เดิมของ AI Quest
6. เปิด Lab เช่น:

`coding-lab.html?session=S1&endpoint=YOUR_APPS_SCRIPT_URL`

## เกณฑ์คะแนน

- Run 30
- Modify 50
- Challenge 20

คะแนน Coding อย่างน้อย 60 จึงผ่านเงื่อนไขบังคับของ Session

## ข้อควรทราบ

หน้า Lab รุ่น Pilot นี้ยังใช้หลักฐานจากผู้เรียนและ Output ที่กรอกเอง
จึงเหมาะกับ Formative Assessment และการเรียนรู้ ไม่ควรใช้เป็นข้อสอบ
ที่มีผลคะแนนสูงโดยลำพัง

รุ่นถัดไปควรเพิ่ม:
- random parameters
- test cases
- teacher review
- token validation
- dashboard
