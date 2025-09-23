
window.HealthSuiteConfig = {
  points: { HWQ:1.0, NUT:1.0, DANCE:1.0, TOOTH:1.0, HYDR:1.0, BAL:1.0, GERM:1.2, FOOD:1.2 },
  leaderboard: { topN: 10 },
  sheets: { writeUrl: "", readUrl: "" },
  badges: [
    { id:'all6_once',     label:'🏅 เล่นครบ 6 เกม',                   rule:'allGamesCompletedOnce', bonus: 50 },
    { id:'finisher10',    label:'🏅 จบเกมรวม ≥ 10 ครั้ง',             rule:'totalCompletionsAtLeast', n:10, bonus: 30 },
    { id:'streak3',       label:'🔥 เล่นต่อเนื่อง ≥ 3 วัน',           rule:'streakAtLeast', days:3,  bonus: 20 },
    { id:'germ_pro',      label:'🦠 Germ Defender ≥ 300',             rule:'gameScoreAtLeast', game:'germdefender', score:300, bonus: 25 },
    { id:'food_rush_pro', label:'🍎 Food Rush ≥ 300',                 rule:'gameScoreAtLeast', game:'foodrush', score:300, bonus: 25 },
    { id:'dance_weekdays',label:'💃 Dance ≥ 5 ครั้ง (จันทร์–ศุกร์)', rule:'weeklyGameCountOnWeekdays', game:'dance', n:5, bonus: 20 },
    { id:'wash_weekly10', label:'🧼 Handwash ≥ 10 ครั้ง/สัปดาห์',     rule:'weeklyGameCountAtLeast', game:'handwash', n:10, bonus: 25 },
    { id:'nutri_month30', label:'🥗 Nutrition ≥ 30 ครั้ง/เดือน',      rule:'monthlyGameCountAtLeast', game:'nutrition', n:30, bonus: 40 },
    { id:'time_window_am',label:'⏰ เล่น 06:00–08:00 ≥ 5 ครั้ง/เดือน',rule:'monthlyTimeWindowCountAtLeast', start:'06:00', end:'08:00', n:5, bonus: 20 }
  ]
};
