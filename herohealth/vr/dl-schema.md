# HeroHealth (GoodJunkVR) — Deep Learning Ready Schema (v1)

เป้าหมาย: ทำ dataset สำหรับ ML/DL เพื่อทำนายความเสี่ยง “พลาด (MISS)” ล่วงหน้า และทำ AI Coach แบบ rate-limit
ข้อกำหนด HHA: โหมด research ต้อง deterministic + ปิด AI (แต่ logging เปิดได้)

---

## 0) Identifiers (ต้องมีทุกตาราง)
- sessionId: string (UUID/ULID) — สร้างตอน hha:start แล้วใช้ร่วมทุก log
- projectTag: string — "GoodJunkVR"
- gameVersion: string — เช่น "GoodJunkVR_SAFE_2026-01-13a"
- runMode: "play" | "practice" | "research"
- diff: "easy" | "normal" | "hard"
- view: "pc" | "mobile" | "vr" | "cvr"
- seed: string
- studyId?: string
- phase?: string
- conditionGroup?: string
- startTimeIso: string (ISO)
- endTimeIso?: string (ISO)

> แนะนำเพิ่ม userId/subjectId ถ้ามี เพื่อ split train/test ตามบุคคล

---

## 1) Table: sessions (1 row / session) — จาก hha:end
คีย์:
- sessionId, projectTag, gameVersion, startTimeIso, endTimeIso
Context:
- runMode, diff, view, seed, studyId?, phase?, conditionGroup?
Duration:
- durationPlannedSec: number
- durationPlayedSec: number
Outcome:
- scoreFinal: number
- comboMax: number
- misses: number
- grade: string
Quest:
- goalsCleared: number
- goalsTotal: number
- miniCleared: number
- miniTotal: number
Counts:
- nTargetGoodSpawned: number
- nTargetJunkSpawned: number
- nTargetStarSpawned: number
- nTargetShieldSpawned: number
- nTargetDiamondSpawned: number
- nHitGood: number
- nHitJunk: number
- nHitJunkGuard: number
- nExpireGood: number
Metrics:
- accuracyGoodPct?: number
- junkErrorPct?: number
- avgRtGoodMs?: number
- medianRtGoodMs?: number
- fastHitRatePct?: number
- rtBreakdownJson?: string

---

## 2) Table: events (event log) — หลายแถว / session
คีย์:
- sessionId
เวลา:
- tMs: number  (ms since start)  **แนะนำ** (แม่นกว่า ISO)
- tLeftSec: number
ชนิดเหตุการณ์:
- eventType:
  - "hit_good" | "hit_junk" | "hit_star" | "hit_shield" | "hit_diamond"
  - "expire_good"
  - "boss_on" | "boss_off"
  - "boss_phase"   (value=1|2)
  - "storm_on" | "storm_off"
  - "rage_on" | "rage_off"
  - "mini_clear" | "goal_clear"
payload (optional แต่แนะนำ):
- deltaScore?: number
- deltaMiss?: number
- rtMs?: number
- x?: number
- y?: number
state snapshot (optional):
- score?: number
- miss?: number
- combo?: number
- fever?: number
- shield?: number
- bossOn?: 0|1
- bossPhase?: 0|1|2
- bossHp?: number
- bossHpMax?: number
- stormOn?: 0|1
- rageOn?: 0|1

---

## 3) Table: ticks (1Hz state) — หลายแถว / session
คีย์:
- sessionId
เวลา:
- sec: number (0..T)
- tLeftSec: number
state:
- score: number
- miss: number
- combo: number
- fever: number
- shield: number
control:
- spawnRate: number   (ค่าที่ engine ใช้จริง ณ วินาทีนั้น)
phases:
- bossOn: 0|1
- bossPhase: 0|1|2
- bossHp: number
- bossHpMax: number
- stormOn: 0|1
- rageOn: 0|1
event-count-per-sec (derived or logged):
- goodHit_1s: number
- junkHit_1s: number
- expireGood_1s: number
- starHit_1s: number
- shieldHit_1s: number
- diamondHit_1s: number
rt rolling:
- rtAvg_5s?: number

> ticks สำคัญมากสำหรับ GRU/LSTM เพราะเป็น sequence input

---

## 4) Labels สำหรับ training
กำหนด W=20s (window) และ H=10s (horizon)

A) y_miss_next10 (binary)
- y=1 ถ้า miss[t+H] - miss[t] >= 1 else 0

B) y_miss_count10 (regression)
- y = miss[t+H] - miss[t]

C) y_junkhit_next10 (binary, จาก events)
- y=1 ถ้ามี hit_junk ใน (t, t+H] else 0

---

## 5) Recommended Features (per timestep)
ต่อวินาที x[t]:
- timeLeftNorm = tLeftSec / durationPlannedSec
- scoreDelta_1s, missDelta_1s
- combo, comboBreak
- fever, shield
- spawnRate
- bossOn, bossPhase, bossHpNorm
- stormOn, rageOn
- goodHit_1s, junkHit_1s, expireGood_1s, starHit_1s, shieldHit_1s, diamondHit_1s
- rtAvg_5s

---

## 6) Fair / Research rules (HHA)
- research: deterministic seed + adaptive OFF + AI OFF (แต่ logging allowed)
- train/val/test: แนะนำ split ตาม userId; ถ้าไม่มี ให้ split ตาม session และกัน seed ซ้ำข้ามชุด
- Coach tip ต้อง rate-limit (เช่น 1 ครั้ง/6–8s) และ log การแสดง tip