# TOAST_SAFE_HOTFIX_v1z3

## Bug
Console error:
Uncaught ReferenceError: toast is not defined

## Cause
setSkillDifficulty() เรียก toast() แต่ไฟล์ปัจจุบันไม่มี function toast ใน scope ที่ใช้งานได้

## Fix
- เพิ่ม safeToast(message)
- ถ้ามี toast เดิมจะใช้ toast เดิม
- ถ้าไม่มี จะสร้าง fallback toast DOM เอง
- replace toast(...) → safeToast(...)
