# HeroHealth — AI Prediction Pack (FAIR) v1
เป้าหมาย: ให้ “AI/ML/DL” มีจริง ใช้ได้จริง และ “แฟร์” ต่อเด็ก/ผู้เล่น + “แฟร์” ต่อการวิจัย

---

## 0) สรุปคำตอบตรง ๆ (ตามที่ถาม)
### ยังมีอะไรที่ “ยังไม่ได้ทำตามที่ตกลงไว้”
- ✅ HHA Standard (หลัก ๆ) คุณทำไปเยอะแล้ว: HUD/quest/end summary/back hub/seeded research/flush logger/vr-ui.js
- ❌ Deep Learning “จริง” ยังไม่ได้อยู่ในเกมตอนนี้  
  ที่มีตอนนี้คือ “Hooks + Metrics + Prediction rule-based” (ถ้ามี) ยังไม่ใช่ DL inference
- ❌ ยังไม่มี “dataset pipeline” + “model training” + “model versioning” + “inference gating” ที่ครบวงจร

### ทำ Deep Learning หรือยัง?
- ถ้าหมายถึง “ฝึกโมเดล (train) จากข้อมูล gameplay จริง + เอาโมเดลมา infer ในเกม” → **ยังไม่ใช่**
- ถ้าหมายถึง “มีโครงให้ทำ / มีตัวชี้วัด / เก็บข้อมูลพร้อมฝึกได้” → **ใกล้แล้ว** แต่ต้องเพิ่ม `ticks 1Hz` และ schema เพิ่มอีกนิด

---

## 1) นิยาม “AI Prediction (แฟร์)” ของ HeroHealth
เราแบ่ง 3 ชั้น (สำคัญมาก):

### ชั้น A — Explainable / Rule-based (เริ่มได้ทันที)
- ทำนาย `risk` จาก metrics ง่าย ๆ เช่น miss rate, rt, fever
- ข้อดี: อธิบายได้, เสถียร, แฟร์, ไม่ต้องมีข้อมูลเยอะ
- ใช้ใน play ได้เลย (เด็กเห็นเหตุผล)

### ชั้น B — ML เบา ๆ (Logistic/GBDT) (ต้องมี dataset)
- ทำนาย `p(miss in next 10s)` หรือ `p(dropout)`
- ข้อดี: แม่นกว่า rule, ยังพออธิบายได้
- ใช้ใน play ได้ แต่ต้อง “gating” (ดูหัวข้อ 4)

### ชั้น C — Deep Learning (GRU/LSTM/TCN)
- ใช้ sequence window (เช่น 20 วินาทีย้อนหลัง) → ทำนายอนาคต 10 วินาที
- ข้อดี: จับ pattern ซับซ้อนได้
- ข้อควรระวัง: เสี่ยง overfit, อธิบายยาก, ต้องคุม fairness

---

## 2) Prediction tasks ที่เหมาะกับเกม (และวัดผลได้จริง)
เลือก 2 งานหลักก่อน (แนะนำ):

### Task P1: Miss Risk (Binary)
- `y = 1` ถ้าในอีก `H=10s` จะเกิด miss ≥ 1
- ใช้เพื่อ: AI Coach เตือนก่อนพลาด, ปรับ spawn rate แบบแฟร์

### Task P2: Miss Count (Regression)
- `y = miss(t+H) - miss(t)`  
- ใช้เพื่อ: ปรับ difficulty แบบ “นุ่ม” ไม่แกว่ง

(เสริมทีหลัง)
- P3: “frustration” proxy (จาก miss burst + rt degrade)
- P4: “boss fail risk”
- P5: “engagement/dropout risk” (ถ้ามี event pause/exit)

---

## 3) ข้อมูลที่ต้อง “เก็บเพิ่ม” ให้ DL ทำได้จริง (แพ็คแฟร์)
ตอนนี้คุณมี event ดีมากแล้ว แต่ DL ต้อง “time series” ที่สม่ำเสมอ

### เพิ่ม 1 ตาราง: `ticks` (แนะนำ 1Hz)
ต่อ sessionId มีแถวทุก 1 วินาที (หรือ 2Hz ก็ได้ แต่ 1Hz พอ)

**ขั้นต่ำ columns**
- sessionId, sec, tLeftSec, durationPlannedSec
- score, miss, combo, fever, shield
- spawnRate (ของ engine ตอนนั้น)
- bossOn, bossPhase, bossHp, bossHpMax
- stormOn, rageOn
- per-second counts:
  - goodHit_1s, junkHit_1s, expireGood_1s, starHit_1s, shieldHit_1s, diamondHit_1s
- rtAvg_5s (rolling mean)
- (optional) view, diff, runMode, seed (จะใส่ใน sessions ก็ได้)

> สำคัญ: research mode ต้อง deterministic → seed fixed + adaptive OFF + AI OFF  
> แต่ `ticks` ยังต้องเก็บได้เหมือนเดิม

---

## 4) “Gating” เพื่อความแฟร์ (Play vs Research)
### 4.1 Run mode rules
- **run=play**: เปิด AI Coach + (optional) Prediction
- **run=research/practice**:  
  - AI prediction **OFF** (หรือ ON แต่ไม่ส่งผลต่อเกม)  
  - adaptive **OFF**  
  - pattern generator **seeded** เท่านั้น

### 4.2 “Prediction ON” แต่ “No Gameplay Change” (โหมดวิจัย)
ทำได้ถ้าต้องการเก็บผลโมเดล โดย:
- infer ได้
- log ค่า p̂
- แต่ห้ามไปเปลี่ยน spawn/size/life/quest

---

## 5) Metric ที่ต้อง log เพื่อ “ยืนยันว่ามี DL จริง”
### ระดับ training
- modelName, modelVersion, trainDate
- dataset window params: W, H, features list
- eval metrics: AUC, F1, Brier, calibration plot summary
- fairness checks: per view/diff performance

### ระดับ inference (ในเกม)
ทุก 1Hz tick:
- pred_p_miss10s (float 0..1)
- pred_miss_count10s (float)
- modelVersion hash
- gating flags (influence: true/false)

> ถ้าไม่มี 3 อย่างนี้ → “ยังไม่ใช่ DL/ML ที่ deploy จริง” (แฟร์ ๆ)

---

## 6) วิธีทำให้ “สนุกท้าทายเร้าใจ” แบบไม่โกง
**หลัก:** prediction ใช้เพื่อ “เตือน/ช่วย” ไม่ใช่ “ลงโทษเพิ่ม”

แนะนำ 3 รูปแบบ:
1) **Coach micro-tip** (อธิบายได้)  
   - “ตอนนี้เร็วเกิน 900ms + miss ติดกัน 2 → ลองช้าลง 1 จังหวะ”
2) **Safety window** (แฟร์)  
   - ถ้า p(miss) สูงมาก → ลด junk weight เล็กน้อย 5–8 วินาที
3) **Reward loop**  
   - ถ้า p(miss) ต่ำ + combo ดี → โยน diamond/bonus 1 ครั้ง (สนุก)

ห้ามทำ:
- p(miss) สูงแล้ว “เพิ่ม junk หนัก ๆ” = เด็กจะรู้สึกโดนกลั่นแกล้ง

---

## 7) สถานะ GoodJunkVR ตอนนี้ (ตามโค้ด safe ที่คุณแปะจริง)
### ✅ มีแล้ว
- Boss/Storm/Rage (A+B+C)
- Quest goal + mini (เร็ว/หลบ junk/เก็บติดกัน)
- Seeded RNG research mode
- vr-ui + crosshair shooting
- flush-hardened logger + end summary + back hub
- metrics หลายอย่าง (RT, counts, accuracy)

### ❌ ยังไม่มี (Deep Learning จริง)
- ticks 1Hz schema + export
- training pipeline (dataset windows) + train model
- model artifact + versioning + inference runtime
- pred logging per tick + gating

---

## 8) Roadmap “ทำ DL ให้จริง” แบบเร็วและไม่พัง
1) เพิ่ม `ticks 1Hz` emission → เข้า `events/ticks` sheet
2) ใช้ `dl-dataset-builder.py` สร้าง windows (W=20, H=10)
3) train baseline:
   - logistic regression / lightgbm (ถ้ามี) ก่อน
4) ถ้า baseline ดี → train GRU/LSTM (DL)
5) export model → (ทางเลือก)
   - TFJS (deploy in browser) หรือ
   - tiny MLP in JS (ถ้าจะง่าย)
6) เพิ่ม `pred_*` ลง tick log + end summary

---

## 9) Checklist “แพ็คแฟร์” ก่อนพูดว่า ‘มี Deep Learning แล้ว’
- [ ] ticks 1Hz มีจริงและเก็บทุก session
- [ ] dataset window build ได้จริง (W,H) และ reproduce ได้
- [ ] มี modelVersion + metrics report (AUC/F1/calibration)
- [ ] ในเกมมี inference + log pred ต่อ tick
- [ ] research mode ไม่ให้ pred เปลี่ยน gameplay (หรือ pred OFF)

---

## 10) ข้อสรุปสุดท้าย
ตอนนี้คุณ “พร้อมมาก” ในเชิงโครงสร้างเกมและ logging  
แต่ “Deep learning deploy จริง” ยังไม่เกิด จนกว่าจะมี **ticks → dataset → train → inference → version + log**

แพ็คนี้คือ “ทางเดินแฟร์” ที่ทำให้ DL มีจริงได้แบบไม่เสียความยุติธรรมของเกมและไม่พังงานวิจัย