# 04 — QA Checklist

## A) Apps Script

- [ ] `/exec?api=vocab&action=health` ได้ `ok:true`
- [ ] เวลาเป็น `+07:00`
- [ ] มี `timestamp_utc` สำรอง
- [ ] `TEST_VOCAB_APPEND_SESSION` ลง `vocab_sessions`
- [ ] `TEST_VOCAB_APPEND_TERM` ลง `vocab_terms`
- [ ] `TEST_VOCAB_PROFILE` ลง `students_profile`
- [ ] `TEST_VOCAB_LEADERBOARD` ลง `vocab_leaderboard`
- [ ] `TEST_REFRESH_CLEAN_VIEWS` สร้าง/อัปเดต view tabs

## B) Vocab Game

- [ ] เปิด `vocab.html` ได้
- [ ] เลือก Bank / Mode / Difficulty ได้
- [ ] เล่นจบ 1 รอบได้
- [ ] Summary แสดงผล
- [ ] ส่งข้อมูลเข้า Sheet
- [ ] payload มี `api=vocab`
- [ ] payload มี `source=vocab.html`
- [ ] payload มี schema vocab version ล่าสุด

## C) Google Sheet

Raw tabs:
- [ ] `vocab_sessions`
- [ ] `vocab_terms`
- [ ] `students_profile`
- [ ] `vocab_leaderboard`

View tabs:
- [ ] `vocab_sessions_view`
- [ ] `vocab_terms_view`
- [ ] `students_profile_view`
- [ ] `vocab_leaderboard_view`
- [ ] `class_roster_view`

## D) Teacher Dashboard

- [ ] เปิด `teacher.html` ได้
- [ ] `Update Dashboard` ทำงานปุ่มเดียว
- [ ] Cohort Triage แสดงกลุ่มถูกต้อง
- [ ] Student Insight รายบุคคลเปิดได้
- [ ] Weak Terms Insight แสดงคำที่อ่อน
- [ ] Weekly Report ทำงาน
- [ ] Feedback Center สร้างข้อความได้
- [ ] Follow-up rows ลง `teacher_followup`
- [ ] Archive Report ลง `teacher_archive`

## E) Stability

- [ ] ไม่มี error ใน console
- [ ] ไม่มี CORS error
- [ ] ไม่เกิดข้อมูล lesson ไหลเข้า vocab
- [ ] View tabs ไม่กลายเป็น 0 หลังมีข้อมูลจริง
- [ ] ครูไม่ต้องเปิด raw tabs เพื่อใช้งานประจำวัน
