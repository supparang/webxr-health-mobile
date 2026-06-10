# INSTANT_DIFFICULTY_UPDATE_v1z2

## Bug/UX issue
กดเลือก Difficulty แล้ว state ถูกบันทึก แต่ผู้ใช้ไม่เห็นการเปลี่ยนทันทีชัดเจน

## Fix
- เพิ่ม data-difficulty-card
- เพิ่ม data-difficulty-icon
- เพิ่ม data-difficulty-button
- เพิ่ม data-current-difficulty
- เพิ่ม currentDifficultyRule
- เพิ่ม updateDifficultyUI(level)
- setSkillDifficulty(level) จะ update DOM ทันทีโดยไม่ต้อง refresh
