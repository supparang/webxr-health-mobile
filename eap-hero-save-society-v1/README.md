# EAP Hero: Save the Society v1r Rubric Review Mode

Prototype เกมเรียนและโหมดสอบรายวิชา **ภาษาอังกฤษเพื่อวัตถุประสงค์ทางวิชาการ (EAP)** สำหรับนักศึกษาปริญญาตรี

## ไฟล์
- `index.html`
- `eap-hero.css`
- `eap-hero.js`
- `README.md`
- `QUESTION_DESIGN_NOTES.md`
- `REPLAY_QUESTION_POLICY.md`
- `EXAM_READY_NOTES.md`

## v1r Rubric Review Mode
- เพิ่ม Portfolio Review Queue
- เพิ่ม Rubric Review สำหรับ Reading/Writing/Listening/Speaking
- Writing rubric: task, organization, tone, vocabulary, grammar, citation/AI ethics
- Speaking rubric: opening, organization, signposting, evidence, fluency, Q&A
- Reading rubric: main idea, keywords, evidence, inference, critical check, clarity
- Listening rubric: main point, keywords, signal words, evidence note, summary, follow-up question
- เพิ่มสถานะ Reviewed / Needs Revision / Excellent / Needs Support
- เพิ่ม Teacher Feedback
- เพิ่ม Export Rubric CSV
- เพิ่ม rubric review เข้า Firebase preview
- ทำให้ portfolio evidence ใช้ตรวจจริงในห้องเรียนได้

## v1q Duplicate Guard
- ตรวจและแก้ duplicate text เล็กน้อยใน Reading template
- แก้ topic label ซ้ำ 1 จุด
- เพิ่ม combo anti-repeat ต่อ Session/Skill
- ระบบจะเลี่ยง topic+template combination ที่เพิ่งออกล่าสุด
- เก็บประวัติ combo ล่าสุดสูงสุด 120 รายการต่อ Session/Skill
- เพิ่ม Skill Template Duplicate Audit ใน QA Lock
- ยังต้องถือว่า semantic near-duplicate อาจมีได้ แต่ exact duplicate guard เข้มขึ้นมาก

## v1p 50 Templates Per Skill
- ขยายแต่ละ skill เป็น 50 templates/prompts/tasks
- Reading 50 templates
- Writing 50 prompts
- Listening 50 tasks
- Speaking 50 prompts
- รวมกับ 15 Sessions × 6 topic/passages ได้ประมาณ 18,000 skill-task combinations
- เหมาะกับใช้ทั้งเทอมและ replay หลายรอบ
- ลดการจำรูปแบบโจทย์และ pattern ได้มากกว่า v1o

## v1o Expanded Skill Templates
- ขยาย Reading templates จาก 4 เป็น 12 แบบ
- ขยาย Writing prompts จาก 6 เป็น 14 แบบ
- ขยาย Listening tasks จาก 5 เป็น 12 แบบ
- ขยาย Speaking prompts จาก 5 เป็น 12 แบบ
- รวมกับ 15 Sessions × 6 topic/passages ทำให้ skill mission combinations เพิ่มขึ้นมาก
- ลดการจำ pattern จากการเล่นซ้ำ
- ครอบคลุม main idea, evidence, inference, purpose, tone, compare, cause-effect, source check, synthesis, speaking Q&A ฯลฯ

## v1n Skill Mission Bank + Anti-Repeat
- เพิ่มคลังโจทย์ Skill Missions สำหรับ Reading/Writing/Listening/Speaking
- แต่ละ Session มี topic/passages หลายชุด
- แต่ละ skill มี mission templates หลายแบบ
- ระบบสุ่มโจทย์และเลี่ยงโจทย์ล่าสุดต่อ Session/Skill
- ลดการจำโจทย์จากการ replay
- QA Lock เพิ่ม check จำนวน skill-task combinations
- เหมาะกับเล่นซ้ำและใช้เป็น portfolio evidence หลายรอบ

## v1m Limited AI Mentor
- เพิ่ม AI Mentor แบบจำกัดการใช้
- AI Help ให้ scaffold/hint เท่านั้น ไม่เขียนคำตอบแทน
- จำกัด 2 ครั้งต่อ skill mission และ 8 ครั้งต่อวัน
- ปิด AI Help ใน Exam/Boss
- ใช้ AI Help แล้วมีคะแนน penalty เล็กน้อย
- บันทึก AI Help logs สำหรับ portfolio/analytics
- Export AI Help CSV
- เพิ่ม AI Help preview สำหรับ Firebase schema
- สอดคล้องกับ academic ethics และ AI use declaration

## v1l Unified Map Flow
- แก้ UX ไม่ให้รู้สึกว่า Map กับ Skills เป็นคนละเกม
- Map เป็นเส้นทางหลักเพียงเส้นเดียว
- กด Session จาก Map แล้วเข้า Session Path โดยตรง
- Skills/Four Skills เป็นภารกิจย่อยภายใน Session Path
- เอาปุ่ม Skills ออกจาก top navigation เพื่อลดความซ้ำ
- ปรับ wording: Map → Session Path → Core/Support Mission → Boss Gate → Map
- Replay Hub ยังอยู่เป็นโหมดท้าทายหลังจากมีหลักฐาน/บอสแล้ว

## v1k Skill Path + Replay Challenge
- เพิ่ม Skill Path Lock: Core + Support evidence ก่อนปลด Boss Gate
- เพิ่ม Boss Gate เป็นช่วง: S3, S6, S8, S11, S14, S15
- เพิ่ม Boss Mutation: Standard, Speed, Mirror, Evidence, No Hint, Portfolio
- เพิ่ม Rival Ghost: แข่งกับคะแนน/combo เดิมของตัวเอง
- เพิ่ม Skill Mastery Rank: Reading, Writing, Listening, Speaking, Ethics
- เพิ่ม Replay Hub
- เพิ่ม Secret Missions
- เพิ่ม Boss Gate logs สำหรับ replay analytics

## v1j Four Skills Portfolio
- เพิ่ม Four Skills Mission Hub
- เพิ่ม Reading Mission: อ่าน passage + ตอบ short answer
- เพิ่ม Writing Mission: summary / paragraph / email / data description / AI declaration
- เพิ่ม Listening Mission: mini lecture ด้วย Speech Synthesis + note taking
- เพิ่ม Speaking Mission: presentation/Q&A transcript + self-check checklist
- เพิ่ม Portfolio Evidence เก็บ reading/writing/listening/speaking output
- เพิ่ม Export Portfolio CSV
- เปลี่ยนเกมจาก quiz-only เป็น EAP skill evidence game

## v1i Pre-Firebase QA Lock
- เพิ่ม QA Lock Center
- เพิ่ม runtime error catcher
- เพิ่ม localStorage health check
- เพิ่ม question bank summary
- เพิ่ม QA checklist
- เพิ่ม Export Full Backup JSON
- เพิ่ม Import Backup JSON
- เพิ่ม Export Firebase Preview JSON
- เพิ่ม Clear Active Run แบบไม่ลบ progress
- เพิ่ม Clear Runtime Errors
- เพิ่ม browser/device debug panel
- เตรียม schema ก่อนต่อ Firebase

## v1h Reason Gate + Item Guard
- เพิ่ม Reason Gate / Justification Attack ใน Boss Battle
- ตอบถูกอย่างเดียวไม่พอ บางจังหวะต้องเลือกเหตุผลว่าทำไมคำตอบถูก
- Hero / No Hint / Speed Contract เปิด Reason Gate เข้มขึ้น
- Rage Mode และ combo สูงจะกระตุ้น Reason Gate
- เพิ่ม Item Guard Dashboard ตรวจ length cue, average option length gap, similar item groups
- ช่วยลดการเดาจากตัวเลือกยาว/ภาษาดูวิชาการ

## v1g No Length Cue
- เพิ่ม No-Length-Cue Item Bank 600 ข้อ
- ทุก Session มีชุดข้อใหม่ 40 ข้อที่ลด length cue โดยตรง
- ระบบเลือก `quality: v1g` ก่อน `v1e`
- ตัวเลือกถูกไม่ได้ยาวที่สุดเสมอไป
- ตัวเลือกผิดถูกเขียนให้ดู plausible และมีความยาวใกล้เคียงคำตอบถูก
- ยังคง Hotfix Contract v1f และ Fun Loop เดิมทั้งหมด

## Hotfix v1f
- แก้ `Uncaught ReferenceError: contract is not defined` ใน `startBoss()`
- Boss Contract ใช้งานได้ทั้ง Standard / Brave / Hero / No Hint / Speed Scholar
- คงระบบ Balanced Item Bank v1e และ unique fingerprint กันข้อซ้ำไว้เหมือนเดิม

## Features v1e Balanced Items
- เพิ่ม Balanced Item Bank 600 ข้อใหม่
- ทุก Session มีข้อ balanced อย่างน้อย 40 ข้อ
- ตัวเลือกผิด/ถูกออกแบบให้ความยาวใกล้เคียงกันขึ้น
- ตัวเลือกหลอก plausible ขึ้น ไม่ใช่ผิดแบบหลุดโลก
- ระบบสุ่มจะเลือก v1e balanced items ก่อน
- เพิ่ม unique fingerprint เพื่อกันคำถามซ้ำ/คล้ายกันในรอบเดียวกัน
- Exam Mode ใช้ balanced item pool ก่อนเพื่อลด length cue
- ยังสุ่มตำแหน่งตัวเลือกทุกข้อเหมือนเดิม

## Features v1d Fun Loop
- เพิ่ม Fun Loop Hub
- เพิ่ม Daily Streak
- เพิ่ม Daily Challenge
- เพิ่ม Boss Contract: Standard / Brave / Hero / No Hint / Speed Scholar
- เพิ่ม Treasure Chest หลังชนะบอส
- เพิ่ม Coins, Titles, Recent Chest History
- เพิ่ม Achievements พร้อม Claim Reward
- ปรับ Rematch ให้เลือก Contract เพื่อเล่นซ้ำแบบท้าทาย
- เพิ่ม XP multiplier ตาม Contract
- เพิ่ม No Hint Contract และ Speed Run style

## Features v1c
- ขยาย question bank เพิ่มอีก 675 ข้อ
- รวมทั้งเกมประมาณ 930+ ข้อ
- แต่ละ Session ประมาณ 60+ ข้อ
- สุ่มข้อคำถามและสุ่มตัวเลือกทุกครั้ง
- Practice ใช้ 4 ข้อ/รอบ
- Boss Battle ใช้ 7–10 ข้อ/รอบตาม difficulty
- Midterm Exam: Sessions 1–8, 60 ข้อ, 75 นาที
- Final Exam: Sessions 1–15, 80 ข้อ, 100 นาที
- Exam Mode ไม่เฉลยทันทีระหว่างสอบ
- มี timer, answered count, unanswered review
- บันทึก attempt, score, time used, warnings
- มี tab-switch warning สำหรับ fair-play เบื้องต้น
- Export Game CSV และ Export Exam CSV
- Teacher Dashboard แสดง Exam Logs

## วิธีใช้บน GitHub Pages
1. สร้างโฟลเดอร์ เช่น `/eap-hero/`
2. อัปโหลดไฟล์ทั้งหมดเข้าไป
3. เปิด URL เช่น `https://<username>.github.io/<repo>/eap-hero/index.html`
4. ให้นักศึกษากรอก Profile ก่อนสอบ
5. เข้า `Exam` แล้วเลือก Midterm หรือ Final
6. หลังสอบ ให้อาจารย์เข้า `Teacher Dashboard` แล้ว Export Exam CSV

## หมายเหตุสำคัญ
ระบบนี้เป็น client-side prototype ที่ใช้ localStorage จึงเหมาะกับการสอบในห้องแบบมีผู้คุมและใช้เครื่อง/เบราว์เซอร์ที่กำหนด  
ถ้าจะใช้สอบ high-stakes จริงมาก ควรต่อ Google Sheets/Firebase/server-side logging เพิ่มเพื่อป้องกันการ reset localStorage หรือแก้ไขไฟล์
