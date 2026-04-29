# TechPath English / Vocab Arcade — v10.0 Final Semester Release

ชุดนี้เป็นแนวทางปิดงานสำหรับใช้งานจริงทั้งเทอม โดยเน้น 4 เรื่อง:
1. Final Release
2. คู่มือครูและนักศึกษา
3. QA Checklist
4. Stability / Data Hygiene

## เวอร์ชันที่ควร Freeze

| ส่วน | เวอร์ชันใช้งาน |
|---|---|
| `Code.gs` | Main Router: `api=attendance` + `api=vocab` |
| `vocab.gs` | v9 Bangkok Time + v9.1 Clean View Sheets |
| `vocab.html` | v7.x ล่าสุดที่ deploy แล้วใช้งานจริง |
| `teacher.html` | v9.9 Feedback Center + Follow-up Actions |
| Google Sheet | Raw tabs + View tabs ตามโครง v9.1 |

## หลักการใช้งานทั้งเทอม

- Raw tabs เก็บข้อมูลครบเพื่อ analytics / AI learning / debugging
- View tabs ให้ครูเปิดดูจริง
- Teacher dashboard เป็นศูนย์กลางสำหรับเริ่มคาบ จบคาบ รายงานรายสัปดาห์ และ feedback
- หลังจาก Freeze ไม่ควรเพิ่ม feature ใหม่จนกว่า QA ผ่านครบ
