# CONTEXT_AWARE_AI_HELP_v1t

## แนวคิด
AI Help ครั้งที่ 2 ควรตรวจจากคำตอบ/ร่างแรกของผู้เรียน ไม่ใช่ให้กรอบทั่วไปเหมือนเดิม

## การทำงาน
- ครั้งที่ 1: strategy-hint
- ครั้งที่ 2: draft-aware-response-frame

## สิ่งที่ตรวจจาก draft
- word count
- มี evidence/example/reason หรือไม่
- มี academic tone หรือไม่
- มี structure/signposting หรือไม่
- Listening มี follow-up question หรือไม่
- Reading มี main idea/keyword/support หรือไม่

## Log เพิ่ม
- draftWordCount
- draftNotes
- helpLevel = draft-aware-response-frame

## ข้อจำกัด
เป็น rule-based formative feedback ยังไม่ใช่ external generative AI
ปลอดภัยสำหรับ GitHub Pages และเหมาะก่อนต่อ Firebase
