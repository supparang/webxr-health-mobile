# 01 — Deploy Checklist

## A) Apps Script

1. เปิด Apps Script ที่ผูกกับ Google Sheet
2. ตรวจไฟล์ `Code.gs`, `vocab.gs`, และ attendance handler ถ้ามี
3. `Code.gs` ต้องเป็น router เท่านั้น
4. `vocab.gs` ต้องไม่มี `doGet` / `doPost`
5. Run:
   - `TEST_VOCAB_HEALTH`
   - `TEST_VOCAB_APPEND_SESSION`
   - `TEST_VOCAB_APPEND_TERM`
   - `TEST_VOCAB_PROFILE`
   - `TEST_VOCAB_LEADERBOARD`
   - `TEST_REFRESH_CLEAN_VIEWS`
6. Deploy → Manage deployments → Edit → Version: New version → Deploy

## B) Endpoint Health Test

เปิด:

```text
/exec?api=vocab&action=health
```

ต้องเห็น:

```text
ok: true
timestamp: ...+07:00
timestamp_utc: ...Z
timezone: Asia/Bangkok
utc_offset: +07:00
```

## C) Web Files

Deploy ไปที่ GitHub Pages:

```text
/vocab.html
/teacher.html
```

## D) หลัง Deploy

1. เปิด `vocab.html`
2. เล่นจบ 1 รอบ
3. เปิด Google Sheet ดู raw tabs
4. เปิด `/exec?api=vocab&action=refresh_views`
5. เปิด `teacher.html`
6. กด `Update Dashboard`
