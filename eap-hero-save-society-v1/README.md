# EAP Hero: Save the Society v1z42 Boss Gate Legacy UI Cleanup

Prototype เกมเรียนและโหมดสอบรายวิชา **ภาษาอังกฤษเพื่อวัตถุประสงค์ทางวิชาการ (EAP)** สำหรับนักศึกษาปริญญาตรี

## ไฟล์
- `index.html`
- `eap-hero.css`
- `eap-hero.js`
- `README.md`
- `QUESTION_DESIGN_NOTES.md`
- `REPLAY_QUESTION_POLICY.md`
- `EXAM_READY_NOTES.md`

## v1z6 Speaking Oral Mode
- แก้ Speaking Mission ไม่ให้ดูเหมือน Writing Mission
- เพิ่ม Oral Task First card
- เพิ่ม Start Speaking / I Finished Speaking timer
- textarea เปลี่ยนเป็น optional evidence notes/transcript
- เพิ่ม checkbox `I spoke`
- Submit ต้องพูดก่อนหรือ tick I spoke
- Speaking score ใช้ checklist + speaking time + notes เป็นหลักฐานเสริม
- AI Help ยังอ่าน notes/transcript ได้ แต่ไม่แทนการพูด

## v1z5 Speaking + AI Output Polish
- แก้ AI Mentor output ให้แสดงชัดใต้ปุ่ม
- ใช้ output id แยกตาม skill/session ลดปัญหา id ซ้ำ
- เพิ่ม fallback แสดงข้อความเมื่อ limit/error
- ขยาย Speaking textarea ให้เหมาะกับ transcript/notes
- เพิ่มคำแนะนำ checklist ก่อนส่ง Speaking Evidence
- แก้ favicon 404 ด้วย data SVG favicon
- ปรับ version display เป็น v1z5

## v1z4 Student Simple Mode + Progressive Unlock
- ตั้งค่า default เป็น Student Simple Mode
- ตั้งค่า default skill difficulty เป็น Easy
- ซ่อน Teacher Tools / QA / Rubric / Revision / Class Activity จากผู้เรียนเริ่มต้น
- Top nav ใน Simple Mode เหลือปุ่มหลักเท่าที่จำเป็น
- Session Path แสดง Core Mission ก่อน
- Support Mission ปลดหลังมี progress/evidence
- Boss Gate / Replay / Exam ค่อยปลดทีหลัง
- มีปุ่ม Teacher Advanced Mode สำหรับอาจารย์
- ลด cognitive load สำหรับนักศึกษาครั้งแรก

## v1z3 Toast Safe Hotfix
- แก้ error `toast is not defined`
- เพิ่ม `safeToast()` ที่ทำงานได้แม้ไม่มี toast เดิม
- แทนที่การเรียก `toast()` ด้วย `safeToast()`
- เพิ่ม toast UI fallback
- Difficulty กดแล้วเปลี่ยนทันทีและไม่ขึ้น console error

## v1z2 Instant Difficulty Update
- แก้ Difficulty กดแล้วไม่เห็นเปลี่ยนทันที
- เพิ่ม updateDifficultyUI() เพื่ออัปเดต DOM ทันที
- กดแล้ว card, icon, button, badge, current rule เปลี่ยนในหน้าเดิม
- ไม่ต้อง refresh หรือกลับเข้าใหม่
- ยัง save ลง localStorage เหมือนเดิม

## v1z1 Difficulty Visibility Hotfix
- แก้ selected state ของ Difficulty ให้มองเห็นชัด
- card ที่เลือกอยู่มี border/halo สีเด่น
- ปุ่มที่เลือกอยู่เปลี่ยนเป็น Selected: Level
- badge ด้านบนขึ้น Selected: Level
- Current Rule แสดงระดับที่เลือกชัดเจน

## v1z Complete Classroom Loop
รวม v1w–v1z ให้ครบในแพ็กเดียวก่อน Firebase

### v1w Difficulty Tier
- Easy / Normal / Hard / Challenge สำหรับ Skill Missions
- เพิ่มคำแนะนำตาม difficulty
- Hard/Challenge มี score bonus เล็กน้อย
- Transcript hint penalty ปรับตาม difficulty

### v1x Revision Loop
- Revision Center
- Revise Evidence
- Reflection
- Improvement XP
- Revision Hero badge
- Export Revision CSV

### v1y Teacher Lesson Mode
- สร้าง lesson plan 60/90 นาที
- Core/Support Mission ตาม Session Path
- Start Lesson และ lesson logs
- Export Lesson Logs CSV

### v1z Class Activity / Pair Mission
- Pair Reading
- Peer Review Writing
- Speaking Q&A Pair
- Group Boss Prep
- Mini Debate
- Peer Review Quick Form
- Export Class Activity CSV

## v1v AI Help Button Fix
- แก้ปุ่ม Ask AI Mentor ไม่แสดงคำแนะนำ
- สาเหตุ: inline onclick เรียก aiDraftInputId() ซึ่งอยู่ใน private scope
- แก้ให้ส่ง draft input id เป็น string โดยตรง
- เพิ่ม fallback alert หากหา output box ไม่เจอ
- expose aiDraftInputId เพิ่มเพื่อกัน cache เก่า

## v1u Listening Transcript Control
- Listening Mission ไม่แสดง full transcript ก่อนทำแล้ว
- ก่อนฟังแสดงแค่ Topic/Goal
- เพิ่ม Transcript Hint แบบจำกัด
- Transcript Hint แสดงเฉพาะต้น script และหักคะแนน listening เล็กน้อย
- หลัง Submit Listening Notes เปิด Full Transcript ให้ทบทวนได้
- บันทึก transcript hint logs
- เพิ่ม Export Listening Transcript Hints CSV
- Firebase preview รองรับ listeningTranscriptHints

## v1t Context-Aware AI Help
- AI Help ครั้งที่ 2 อ่าน draft/answer/notes/transcript ที่ผู้เรียนพิมพ์อยู่
- วิเคราะห์เบื้องต้น: word count, evidence, academic tone, structure, question
- ให้ feedback เฉพาะจุด + response frame
- ยังไม่เฉลยและไม่เขียนคำตอบแทนนักศึกษา
- AI Help logs เพิ่ม draftWordCount และ draftNotes
- Export AI Help CSV เพิ่มข้อมูล draft-aware feedback

## v1s Progressive AI Help
- ปรับ AI Help เป็น 2 ระดับ
- ครั้งที่ 1/2: strategy hint / scaffold กว้าง ๆ
- ครั้งที่ 2/2: response frame / sentence starter / checklist ชัดขึ้น
- ยังไม่เฉลยและไม่เขียนคำตอบสุดท้ายแทนนักศึกษา
- บันทึก helpLevel ใน AI Help logs
- Export AI Help CSV เพิ่ม field helpLevel
- เหมาะกับ responsible AI use และ AI literacy

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


## v1z7 Teacher Unlock Fix
- แก้ปุ่ม Unlock Teacher Advanced Mode กดไม่ทำงาน
- expose `setUIMode` และ `unlockTeacherMode` ใน public API
- หลัง unlock แล้วเข้า Teacher Tools ทันที
- แก้ปุ่ม Advanced ให้เรียก unlockTeacherMode
- ปรับ version display เป็น v1z7



## v1z8 Teacher Review Queue Polish
- เพิ่ม filter ใน Review Queue: Skill / Status / Session
- เพิ่มจำนวน Pending / Reviewed
- แยก Evidence Output กับ Help Used
- แสดง AI uses, Transcript Hint, Speaking time, Difficulty เป็น badges
- เพิ่ม Score Reason เพื่ออธิบาย auto score ต่ำ
- เพิ่ม Export Portfolio CSV ใน Review Queue
- เพิ่ม Teacher Reading Guide



## v1z9 Review Queue Compact/Detail View
- เพิ่ม Compact / Detailed toggle ใน Review Queue
- Compact view ลดคอลัมน์เพื่ออ่านง่าย
- Detailed view แสดง Score Reason/Rubric/Evidence ครบ
- Score Reason แสดงเป็น badge
- เพิ่ม View / View Full เพื่อดู evidence detail เต็ม
- หลัง Save Rubric มี toast และกลับ Review Queue พร้อมสถานะอัปเดต


## v1z10 CEFR A2–B1+ Calibration
- ปรับโหมดเริ่มต้นให้เหมาะกับนักศึกษาปี 2 ระดับ A2–B1+
- เพิ่ม CEFR support box ใน Reading/Writing/Listening/Speaking
- เพิ่มคำสั่งภาษาไทยช่วยอธิบายงาน
- เพิ่ม sentence frames
- Simplify คำยาก เช่น evaluate → check, synthesize → combine, limitation → weak point
- Easy = Easy A2, Normal = Normal B1, Hard = Hard B1+, Challenge = Optional
- ลด transcript penalty ในระดับเริ่มต้น
- เพิ่ม score floor/bonus เล็กน้อยสำหรับคำตอบสั้นที่มี evidence
- Challenge ไม่ใช่ค่าเริ่มต้น ใช้เป็น bonus/replay เท่านั้น


## v1z11 CEFR Step-by-Step + Vocabulary + Guided Speaking
- เพิ่ม Step 1/2/3 ในทุก skill
- เพิ่ม Useful Vocabulary box
- เพิ่ม Guided Speaking Frame
- ลด AI penalty ใน Easy A2/Normal B1
- Review Queue แสดง CEFR target badge
- Score Reason ใช้ภาษานุ่มขึ้นสำหรับ A2-B1+


## v1z12 Adaptive AI Help Limits
- ปรับ AI Help จาก 2/2 คงที่ เป็น adaptive ตาม Skill + Difficulty
- Easy A2: Reading 2, Writing/Listening/Speaking 3
- Normal B1: Reading 2, Writing/Listening/Speaking 3
- Hard B1+: 2
- Challenge Optional: 1
- AI Help stage: Hint → Draft feedback → Sentence frame/checklist
- AI penalty เบาลงสำหรับ Easy A2 / Normal B1
- Review Queue แสดง AI Limit เพิ่ม


## v1z13 Final Student Pilot Readiness Lock
- เพิ่ม Pilot Readiness page
- เพิ่ม Student Safe Start
- เพิ่ม Reset Demo Data
- เพิ่ม checklist ตรวจระบบก่อนใช้จริง
- เพิ่ม AI Help note ตาม skill/difficulty ใน CEFR support
- เพิ่ม Student Quick Start, Teacher Pilot Guide, Pilot Checklist
- ล็อกแนวทางใช้กับนักศึกษาปี 2 A2-B1+


## v1z14 Student Learning Report Card Final
- เพิ่ม Student Learning Report Card หลังส่ง evidence
- แจ้งผลแบบ formative feedback: Score + Band + You did well + Next time + Try this
- เพิ่ม My Learning Report สำหรับนักศึกษา
- เพิ่ม Skill summary Reading/Writing/Listening/Speaking
- เพิ่ม Export Student Report CSV
- Teacher Evidence Detail เห็น Student Next Step
- Pilot Readiness ตรวจ Student learning reports


## v1z15 Student Report Navigation Fix
- เพิ่มปุ่ม My Learning Report บนหน้าแรก
- เพิ่มปุ่ม Student Safe Start บนหน้าแรก
- เพิ่มปุ่ม Pilot Readiness บนหน้าแรก
- เพิ่มปุ่ม Report บน top navigation
- เพิ่มคำอธิบายหน้าแรกว่า “ดูผลการเรียนตรงไหน”
- เพิ่ม alias EAPHero.myReports()


## v1z16 Session Button Action Fix
- แก้ปุ่ม Start/Replay Reading/Writing/Listening/Speaking กดไม่ติด
- เพิ่ม EAPHero.openSkillMission(skill, sessionId) เป็น safe launcher
- expose mission aliases readingMission/writingMission/listeningMission/speakingMission
- เพิ่ม cacheVersionNotice ถ้า URL x ไม่ตรงกับ JS version ที่โหลดจริง


## v1z17 Hard Button Binding Fix
- แก้ปุ่ม Session Path ไม่เข้า mission แบบแข็งแรง
- เพิ่ม data-skill/data-session ให้ปุ่ม skill
- เพิ่ม openSkillMissionFromButton()
- เพิ่ม event delegation .js-skill-mission-btn
- เพิ่ม emergency globals EAPHeroOpenSkillMission / EAPHeroOpenSkillMissionFromButton
- เพิ่ม Debug: Open Reading ใน Session Path เพื่อทดสอบ router


## v1z18 Mission ID Scope Fix
- แก้ error `id is not defined` ตอนเปิด mission
- ปรับ AI/CEFR helper labels ให้ใช้ s.id/sessionId ที่อยู่ใน scope
- คง hard button binding จาก v1z17


## v1z19 AI Help Session Scope Fix
- แก้ error `s is not defined` ตอนเปิด mission
- renderAIHelpBox ใช้ `sessionId` เท่านั้น ไม่ใช้ `s.id` หรือ `id` ที่อยู่นอก scope
- ปุ่ม AI Help สร้าง label ด้วย `aiHelpButtonLabel(skill, sessionId)`
- คง hard binding และ id scope fix จาก v1z17-v1z18


## v1z20 Adaptive AI Limit Runtime Fix
- แก้ AI Mentor ยังใช้ limit เก่า 2/2 ทั้งที่ CEFR box บอก 3/3
- canUseAI() ใช้ adaptiveAIHelpLimit(skill)
- renderAIHelpBox() แสดง left/limit ตาม skill+difficulty จริง
- useAIHelp() แสดง Uses left ตาม adaptive limit
- aiHelpButtonLabel() ใช้ limit เดียวกันทั้งหมด


## v1z21 Report Card Contrast Polish
- แก้ Learning Report Card ตัวอักษรจาง อ่านยาก
- ปรับพื้นหลัง/ขอบ/สีตัวอักษรของ Excellent/Good/Developing/Needs Practice
- ปรับ Try this sentence frame ให้เห็นชัด
- ปรับ Result page contrast สำหรับใช้งานหน้าชั้นเรียน
- ฐานรวม v1z20 Adaptive AI Limit Runtime Fix


## v1z22 Answer Box Size Polish
- ขยายช่องตอบ Writing ให้ใหญ่ขึ้นมาก
- ขยายช่อง Speaking notes/transcript
- ขยาย Listening notes และ Reading short answers
- เพิ่มปุ่ม Expand / Clear สำหรับช่องตอบหลัก
- ปรับ font, line-height, contrast, focus state ให้เหมาะกับ A2-B1+


## v1z23 Speaking Speech-to-Text Input
- เพิ่ม Speech-to-Text ใน Speaking Mission
- ปุ่ม Start Voice Input / Stop Voice Input
- ถอดเสียงภาษาอังกฤษลง speakingTranscript อัตโนมัติเมื่อ browser รองรับ Web Speech API
- ยังแก้ไข transcript/notes ได้ก่อน Submit
- ถ้า browser ไม่รองรับ จะแจ้งให้พิมพ์ notes เอง


## v1z24 Listening AI Voice Lab Polish
- ยกระดับ Listening เป็น AI Voice Lab ด้วย Web Speech Synthesis
- เลือกเสียงอังกฤษที่ดีที่สุดใน browser เท่าที่รองรับ
- เลือก Accent: US/UK/AU English
- ปรับ Speed/Pitch
- Play / Pause / Resume / Replay chunk / Slow mode / Stop
- เล่น lecture เป็น sentence chunks พร้อม highlight chunk ที่กำลังฟัง
- Transcript ยังซ่อนสำหรับการฝึกฟัง แต่มี chunk highlight เพื่อช่วย A2-B1+


## v1z25 Pre/Post Learning Gain + Reflection
- เพิ่ม Pre-test / Post-test 12 ข้อสำหรับ A2-B1+
- คำนวณ raw gain และ normalized gain
- เพิ่ม Session Reflection: learned / difficult / improve
- Export Pre/Post CSV และ Reflection CSV
- เพิ่มปุ่ม Pre/Post Gain บนหน้าแรกและ top nav


## v1z26 Pre/Post Contrast + Research Panel Polish
- แก้กล่อง How to use in class ตัวอักษรจาง อ่านยาก
- ปรับ research flow steps ให้เป็นกล่องอ่านง่าย
- เพิ่ม Learning gain interpretation
- เพิ่ม research note สำหรับใช้ใน pilot/research
- ปรับ contrast ของ pre/post items และ choices


## v1z27 Research Dataset Export
- เพิ่ม Research Dataset Panel
- เพิ่ม Export Research Dataset CSV รวมข้อมูลสำคัญไฟล์เดียว
- รวม Portfolio, Learning Report, AI uses, Speaking seconds, Pre/Post score, Learning gain, Reflection, Rubric, Teacher feedback
- เพิ่มปุ่ม 🧪 Research บน top nav


## v1z28 Student Menu Role Mode Fix
- แยก Role Mode: Student / Teacher / Researcher
- Student Mode เห็นเฉพาะ Start/Continue, Map, My Learning Report, Profile
- Teacher Mode เห็น Teacher Dashboard, Review Queue, Pre/Post Gain
- Researcher Mode เห็น Research Dataset, Pre/Post Gain, Pilot Readiness
- ซ่อนเมนู Cards/Fun/Replay/Exam/QA/Teacher/Research จากผู้เรียน


## v1z29 Hard Student Only UI Lock
- บังคับซ่อนเมนู Teacher/Research/QA/Exam/Cards/Fun/Replay ใน Student Mode
- เพิ่ม DOM cleanup หลัง render ด้วย hardStudentOnlyUILock()
- เพิ่ม forceStudentMode()
- หน้าแรกเหลือ Student actions: Start/Continue, Map, My Learning Report, Profile
- แก้ปัญหา pattern เดิมจับปุ่มจริงไม่ครบ


## v1z30 True Student UI Lock
- แก้ v1z29 ที่ยังเห็น Teacher/Cards/Fun/Replay/Exam/QA บน topbar
- ซ่อน EAPHero.gallery() และ EAPHero.teacherTools() ซึ่งเป็นชื่อจริงใน topbar
- เรียก cleanup หลัง app.innerHTML render จริง
- Guard ปุ่ม advanced บนหน้าแรก
- บังคับ Student Mode บนหน้าแรก


## v1z31 Student Map Clarity Polish
- เพิ่ม Continue Session บน top nav / map
- เพิ่มคำแนะนำบน Map ว่าผู้เรียนควรทำอะไรต่อ
- เปลี่ยน Boss Cards/Cards ที่ผู้เรียนเห็นเป็น Progress
- เพิ่มคำอธิบาย session locked ด้วย CSS


## v1z32 Continue Button Binding Fix
- แก้ปุ่ม Continue กดไม่ติด
- เพิ่ม continueFromButton()
- เพิ่ม bindContinueButtons() ด้วย data-action="continue-session"
- เพิ่ม fallback global EAPHeroContinueSession()
- ป้องกัน student UI lock ซ่อนปุ่ม Continue


## v1z33 Student Pilot Final Lock
- เพิ่ม Student Pilot Final Check
- ตรวจ Student menu, Continue binding, Mission launcher, Learning Report, Listening AI Voice, Speaking STT fallback, Student UI lock, runtime errors
- เพิ่ม Test Continue และ Force Student Mode ในหน้าตรวจ
- ใช้ปิดรอบ local pilot ก่อนเข้าห้องเรียนจริง


## v1z34 Session Quality Audit + A2-B1+ Balance
- เพิ่ม SESSION_QUALITY_AUDIT ครบ S1-S15
- ระบุ CEFR level, risk, core/support skill, expected answer length, objective, vocabulary, sentence frame, teacher note
- เพิ่ม Session Quality Guide ใน Skill Path
- เพิ่มหน้า Session Quality Audit สำหรับอาจารย์ตรวจภาพรวม
- เพิ่ม Pilot Final Check ให้ตรวจว่ามี audit ครบ 15 sessions


## v1z35 Reading Mission Coherence + AI Help Fix
- แก้ Reading mission S5 จาก quote/citation wording ให้ตรงกับ bias awareness
- เพิ่ม readingQuestionSetForSession() สำหรับ S5/S12/general reading
- แก้ AI Mentor state ที่ขึ้น 2/2 left แต่บอก limit reached
- เพิ่ม repairAIHelpBoxes() และ runAIHelpRepairSoon()
- ปรับสีข้อความ AI Mentor ให้เข้มและอ่านง่ายขึ้น


## v1z36 Reading sessionId Scope Fix
- แก้ runtime error: sessionId is not defined ตอนกด Start Reading
- ใช้ __readingSessionId = arguments[0] || state.currentSession || 1
- เพิ่ม safeMissionSessionId()
- ป้องกันการเรียก mission ด้วย sessionId ว่าง


## v1z37 Mission-Specific Frame Alignment Fix
- แก้ Useful frame ที่ไม่สัมพันธ์กับคำถามจริง
- เพิ่ม missionSpecificReadingGuide() ครบ S1-S15
- S5 ใช้ frame เรื่อง reader group / bias / emotional language
- S6 ใช้ frame เรื่อง audience / purpose / own words ให้ตรงกับคำถาม reader group
- ลดปัญหา frame กลางที่ทำให้ผู้เรียนตอบคนละเรื่อง


## v1z38 Full Mission Coherence Alignment Lock
- เพิ่มชั้นควบคุมความสอดคล้องทั้งระบบ S1-S15 × 4 skills
- เพิ่ม MISSION_COHERENCE_FOCUS และ alignmentFor()
- Reading: question/frame/vocab ปรับตาม variant จริง เช่น purpose/tone/source/compare/cause/evidence/main idea
- Writing: frame ปรับตาม email/data/summary/AI declaration/paragraph
- Listening: frame ปรับตาม note/detail/question task
- Speaking: frame ปรับตาม presentation/problem-solution
- AI Mentor ใช้ alignedAIHelpMessage() ให้ hint ตรงกับ task จริง
- ซ่อน Teacher note จาก Student Mode
- เพิ่ม Full Mission Coherence Audit ตรวจ 60 mission alignments


## v1z39 Boss Gate Timeline Restructure Final
- ปรับตรรกะ Boss Gate ให้ถูกต้อง: Boss Gate อยู่หลังจบชุด Session ไม่ใช่แทน Session
- โครงใหม่: S1-S3 → Boss Gate 1, S4-S6 → Boss Gate 2, S7-S9 → Boss Gate 3, S10-S12 → Boss Gate 4, S13-S15 → Final Boss
- เพิ่ม BOSS_GATE_PLAN ครบ 5 Gates
- เพิ่ม Boss Gate Timeline บน Map
- แยก Session Bosses 15/15 และ Boss Gates 5/5
- เพิ่ม bossGateNoticeForSession() หลัง S3/S6/S9/S12/S15
- เพิ่ม renderBossGateTimeline() และ openBossGate()


## v1z40 Boss Gate Unlock Enforcement
- Boss Gate ไม่สามารถเข้าได้ทุกอันแล้ว
- Gate 1 ต้องจบ S1-S3 ก่อน
- Gate 2 ต้องจบ S4-S6 และผ่าน Gate 1 ก่อน
- Gate 3 ต้องจบ S7-S9 และผ่าน Gate 2 ก่อน
- Gate 4 ต้องจบ S10-S12 และผ่าน Gate 3 ก่อน
- Final Boss ต้องจบ S13-S15 และผ่าน Gate 4 ก่อน
- เพิ่ม bossGateUnlockReport(), renderBossGateLocked(), bossGateLockMessage()


## v1z41 Boss Gate Completion Detection Fix
- แก้ Gate 1 เข้าไม่ได้ทั้งที่ S1-S3 มีดาว/หลักฐานแล้ว
- เพิ่ม sessionCompletionReport() และ skillEvidenceCountForSession()
- Gate unlock รู้จักหลักฐานหลายแบบ: session.done/completed, bossCards, portfolio, learningReports, submissions, logs, stars, xp
- เพิ่มรายละเอียดในหน้า locked ว่าแต่ละ Session ขาดอะไร
- เพิ่ม repairLegacySessionCompletion() สำหรับ repair localStorage เดิม


## v1z42 Boss Gate Legacy UI Cleanup
- ซ่อน UI เก่า Boss Gate Available ที่ยังโผล่ในหน้า Session
- กัน boss-gate-notice ซ้ำ
- ทำให้ Session ปกติยังเป็น Session ไม่ใช่ Boss Gate
- เหลือระบบ Boss Gate Timeline ใหม่เป็น source of truth
