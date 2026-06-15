# TEACHER_UNLOCK_FIX_v1z7

## Bug
ปุ่ม Unlock Teacher Advanced Mode กดแล้วไม่ทำงาน

## Cause
ปุ่มเรียก EAPHero.setUIMode('advanced') แต่ setUIMode ไม่ได้ expose ใน public API

## Fix
- expose setUIMode
- เพิ่ม unlockTeacherMode()
- ปุ่ม unlock เรียก EAPHero.unlockTeacherMode()
- unlock แล้วเข้า Teacher Tools ทันที
