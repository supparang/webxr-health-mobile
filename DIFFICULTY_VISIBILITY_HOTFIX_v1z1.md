# DIFFICULTY_VISIBILITY_HOTFIX_v1z1

## Bug/UX issue
ผู้ใช้กดเลือก Difficulty ได้ แต่ selected state ดูไม่ชัด เพราะปุ่ม Current เป็นสีเทาและ card ไม่เด่น

## Fix
- เพิ่ม .difficulty-card.selected
- เพิ่ม halo/border สีฟ้าเขียว
- ปุ่ม selected ใช้ .btn.success
- ปุ่มขึ้นข้อความ Selected: Level
- Badge ด้านบนขึ้น Selected: Level
