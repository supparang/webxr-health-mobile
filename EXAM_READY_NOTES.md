# EXAM_READY_NOTES v1c

## Question Bank
- เพิ่มคำถาม 45 ข้อต่อ Session จาก v1b
- รวมกับคลังเดิมแล้วแต่ละ Session มีประมาณ 60+ ข้อ
- รวมทั้งเกมประมาณ 930+ ข้อ

## Randomization
- สุ่มชุดข้อคำถามทุกครั้ง
- สุ่มลำดับตัวเลือกทุกข้อ
- ระบบพยายามเลี่ยงข้อที่เพิ่งออก
- ใน Boss Battle 1 รอบไม่วนข้อซ้ำ

## Exam Mode
- Midterm: Sessions 1–8, 60 questions, 75 minutes
- Final: Sessions 1–15, 80 questions, 100 minutes
- No instant feedback
- No hint
- Answer review before submit
- Auto-submit when time is up
- Records unanswered questions
- Records tab-switch warnings
- Export Exam CSV

## Fair-play Limitations
This is a client-side static web prototype. It is suitable for supervised classroom exams,
but not fully secure for high-stakes assessment unless connected to server-side logging.

Recommended next secure upgrades:
1. Firebase Auth / Google Sign-in
2. Firestore or Google Sheets logging
3. Teacher exam code generated server-side
4. One-attempt lock per student ID
5. Server timestamp
6. Item exposure control
