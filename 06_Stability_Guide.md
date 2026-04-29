# 06 — Stability Guide

## ห้ามทำในช่วงใช้งานจริง

- ห้ามแปะ patch ซ้ำหลายรอบใน `vocab.gs`
- ห้ามให้ `vocab.gs` มี `doGet` / `doPost`
- ห้ามเปลี่ยน endpoint ระหว่างเทอมโดยไม่ทดสอบ
- ห้ามลบ raw tabs
- ห้ามลบ columns ที่ระบบเขียนอยู่

## ถ้าเวลาไม่ใช่ +7

ตรวจว่า `vocab.gs` ใช้:

```text
Asia/Bangkok
+07:00
```

และ endpoint `/exec?api=vocab&action=health` ต้องมี:

```text
timestamp
timestamp_utc
timezone
utc_offset
```

## ถ้า view tabs เป็น 0

ตรวจตามลำดับ:

1. raw tabs มีข้อมูลไหม
2. ข้อมูลมี `api=vocab` หรือ `source=vocab.html` ไหม
3. เล่น `vocab.html` จบ 1 รอบหรือยัง
4. Run `TEST_REFRESH_CLEAN_VIEWS`
5. เปิด `teacher.html` แล้วกด Update Dashboard

## ถ้า Teacher Dashboard ไม่ขึ้นข้อมูล

1. เปิด endpoint `?api=vocab&action=teacher_dashboard_get`
2. เปิด endpoint `?api=vocab&action=refresh_views`
3. ตรวจ console ว่ามี CORS หรือ syntax error ไหม
4. ตรวจว่า `teacher.html` ใช้ endpoint ล่าสุด
