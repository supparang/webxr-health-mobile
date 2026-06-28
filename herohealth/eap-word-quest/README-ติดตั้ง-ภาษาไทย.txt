EAP Word Quest — Core Vocabulary Map + Core AI Package
Version: v1.9.0 (v189 + v190)
Group: 122

ไฟล์ในชุดนี้
1) index.html
   - หน้า Student ที่แก้ script ให้ใช้ Core Vocabulary Map + Core AI
   - ลบการเรียก eap-word-engine-v188-local-ai-learning.js แล้ว

2) eap-core-vocabulary-map-v189.js
   - Vocabulary spine S1–S15 จำนวน 290 Active Vocabulary Targets
   - Boss pools BG1–BG5
   - เป็นแหล่งข้อมูลกลางของ Word Quest และ AI

3) eap-word-engine-v190-core-ai.js
   - AI Help 3 ระดับ (ไม่เฉลยตรง ๆ)
   - AI Difficulty A2 / A2+ / B1 / B1+
   - AI Prediction
   - AI Feedback Coach
   - AI Weak Word Coach
   - AI Challenge Director
   - AI Boss Director
   - AI Teacher Insight data helper

วิธีติดตั้ง
1. อัปโหลดไฟล์ทั้ง 3 ไฟล์ไปไว้ในโฟลเดอร์เดียวกัน:
   /herohealth/eap-word-quest/

2. ให้แทน index.html เดิมด้วย index.html ใน zip นี้

3. เปิดทดสอบด้วย:
   index.html?v=20260616-v190-test1

4. Console test:
   getEapCoreTargetCounts()
   getEapCoreAiState()
   getEapBossAiFocus("BG1")

ข้อสำคัญ
- Package นี้ทำให้ Core Vocabulary Map และ AI ยึด S1–S15 ที่ตกลงกันแล้ว
- Question Bank เดิม eap-word-data-v180-content.js ยังเป็นชุดเดิม
  งานถัดไปคือ v191 Core-Aligned Question Bank เพื่อแทนคำถาม S1–S15 และ Boss Gate
  ให้ตรงกับ 290 targets ทีละ Session
- ไม่ต้องโหลด eap-word-engine-v188-local-ai-learning.js อีก เพราะเป็น glossary เก่า
