# 08 — Release Freeze Notes

## Freeze Rule

หลังจากชุดนี้ผ่าน QA แล้ว ให้ถือเป็น version ใช้งานจริงทั้งเทอม

## เปลี่ยนได้เฉพาะ

- แก้ typo
- ปรับข้อความครู/นักศึกษา
- แก้ bug ที่ทำให้ข้อมูลไม่เข้า
- ปรับ UI เล็กน้อยไม่กระทบ schema

## ไม่ควรเปลี่ยนระหว่างเทอม

- ชื่อ tab
- ชื่อ column สำคัญ
- endpoint
- schema ของ raw data
- router logic
- timezone logic
- refresh view logic

## เวอร์ชันที่แนะนำให้ระบุในเอกสาร

```text
Vocab Arcade Final Semester Release v10.0
Teacher Dashboard v9.9+
Vocab Backend v9 + v9.1
Timezone: Asia/Bangkok +07:00
```
