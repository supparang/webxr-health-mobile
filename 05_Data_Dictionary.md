# 05 — Data Dictionary

## Tabs ที่ครูใช้หลัก

### `class_roster_view`

```text
student_id
display_name
section
email
group
status
note
updated_at
```

### `attendance_sessions`

```text
timestamp
visit_id
student_id
display_name
section
session_code
lesson_id
lesson_title
skill
started_at
ended_at
duration_sec
completed
completion_rate
score
accuracy
last_stage
page_url
source
api
```

### `vocab_sessions_view`

```text
timestamp
display_name
student_id
section
session_code
bank
mode_label
difficulty
duration_sec
score
fair_score
accuracy
mistakes
combo_max
boss_defeated
ai_help_used
ai_assisted
weakest_term
ai_recommended_mode
ai_recommended_difficulty
ai_reason
```

### `vocab_terms_view`

```text
timestamp
display_name
student_id
section
session_code
bank
mode_label
difficulty
stage_name
term
meaning
prompt
selected
answer
is_correct
response_ms
score
combo
ai_help_used_on_question
```

### `students_profile_view`

```text
last_seen_at
display_name
student_id
section
last_bank
last_mode_label
last_difficulty
last_score
last_accuracy
last_combo_max
leaderboard_rank
personal_best
improvement
ai_help_used
ai_assisted
recommended_mode
recommended_difficulty
ai_reason
```

### `vocab_leaderboard_view`

```text
updated_at
rank
display_name
student_id
section
session_code
bank
mode_label
difficulty
best_score
fair_score
best_accuracy
combo_max
ai_assisted
ai_help_used
runs
badge
```

## Raw tabs

Raw tabs เก็บข้อมูลครบเพื่อการวิเคราะห์และ debug:

```text
vocab_sessions
vocab_terms
students_profile
vocab_leaderboard
attendance_events
teacher_followup
teacher_archive
```

ครูไม่ควรเปิด raw tabs เป็นหลัก ยกเว้นต้อง debug
