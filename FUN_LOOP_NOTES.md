# FUN_LOOP_NOTES v1d

เพิ่มระบบก่อนต่อ Firebase เพื่อให้เกมสนุก ท้าทาย เร้าใจ และเล่นซ้ำได้มากขึ้น

## Added
1. Fun Loop Hub
2. Daily Streak
3. Daily Challenge
4. Boss Contract
   - Standard Mission
   - Brave Contract
   - Hero Contract
   - No Hint Contract
   - Speed Scholar
5. Treasure Chest
   - Bronze
   - Silver
   - Gold
   - Legendary
6. Coins
7. Titles
8. Achievements
9. Achievement Rewards
10. Rematch Contract

## Why before Firebase?
ระบบเหล่านี้ยังใช้ localStorage ได้ และจะช่วยพิสูจน์ว่า learning loop สนุกจริงก่อนย้ายไปเก็บข้อมูลบน Firebase

## Next Firebase fields
- users/{uid}/profile
- users/{uid}/progress
- users/{uid}/logs
- users/{uid}/examLogs
- users/{uid}/fun/coins
- users/{uid}/fun/chests
- users/{uid}/fun/titles
- users/{uid}/fun/achievementsClaimed
- users/{uid}/fun/daily
