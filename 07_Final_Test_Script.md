# 07 — Final Test Script

## Step 1: Backend Health

เปิด:

```text
/exec?api=vocab&action=health
```

ต้องเห็น:

```text
ok:true
timezone:Asia/Bangkok
utc_offset:+07:00
```

## Step 2: Manual Test in Apps Script

Run:

```text
TEST_VOCAB_APPEND_SESSION
TEST_VOCAB_APPEND_TERM
TEST_VOCAB_PROFILE
TEST_VOCAB_LEADERBOARD
TEST_REFRESH_CLEAN_VIEWS
```

## Step 3: Student Game Test

1. เปิด `vocab.html`
2. กรอกชื่อ `Test Student`
3. กรอกรหัส `999001`
4. Section `TEST`
5. เล่น Bank A / AI Training / Normal
6. เล่นจนจบ

## Step 4: Sheet Check

ต้องมีข้อมูลใน:

```text
vocab_sessions
vocab_terms
students_profile
vocab_leaderboard
```

หลัง refresh views ต้องมีข้อมูลใน:

```text
vocab_sessions_view
vocab_terms_view
students_profile_view
vocab_leaderboard_view
```

## Step 5: Teacher Dashboard Test

1. เปิด `teacher.html`
2. กด Update Dashboard
3. ตรวจ Cohort Triage
4. เปิด Student Insight
5. เปิด Weekly Report
6. เปิด Feedback Center
7. Copy Feedback
8. Archive Report
