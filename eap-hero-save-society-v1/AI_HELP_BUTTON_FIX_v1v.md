# AI_HELP_BUTTON_FIX_v1v

## Bug
กด Ask AI Mentor แล้วไม่แสดงคำแนะนำ

## Cause
ปุ่มใน HTML เรียก aiDraftInputId() จาก inline onclick แต่ฟังก์ชันอยู่ใน private scope

## Fix
ส่ง draft input id เป็น string โดยตรง:
- Reading: readAns0
- Writing: writingOut
- Listening: listeningNotes
- Speaking: speakingOut

เพิ่ม fallback alert ถ้า output box ไม่เจอ
