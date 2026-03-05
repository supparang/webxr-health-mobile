// === /herohealth/vr-brush/brush.missions.js ===
// BrushMissions — stage/mission helpers + badge builder
// PATCH v20260304-BRUSH-MISSIONS
(function(){
  'use strict';
  const WIN = window;

  function stageFromClean(clean){
    if(clean < 40) return 'A';
    if(clean < 80) return 'B';
    return 'C';
  }

  function buildBadges(summary){
    const b = [];
    const acc = Number(summary.accuracyPct)||0;
    const miss = Number(summary.miss)||0;
    const combo = Number(summary.comboMax)||0;
    const evi = summary?.evidence?.total ?? 0;
    const quizOk = !!summary?.quiz?.correct;
    const timePlayed = Number(summary.timePlayedSec)||0;

    if(acc >= 82) b.push({emo:'🎯', text:'แม่นมาก (ACC ≥ 82%)'});
    if(miss <= 10) b.push({emo:'🧼', text:'ระวังพลาด (MISS ≤ 10)'});
    if(combo >= 8) b.push({emo:'🔥', text:'คอมโบไฟลุก (COMBO ≥ 8)'});
    if(evi >= 3) b.push({emo:'🧩', text:'นักสืบหลักฐาน (B ครบ 3/3)'});
    if(quizOk) b.push({emo:'🧠', text:'ตอบวิเคราะห์ถูก (Quiz ✅)'});
    if(timePlayed > 0 && timePlayed <= 25) b.push({emo:'⚡', text:'สปีดดี (ชนะ ≤ 25s)'});

    if(b.length === 0) b.push({emo:'✅', text:'เริ่มต้นดี! ลองอีกครั้งจะดีกว่าเดิม'});
    return b.slice(0, 8);
  }

  WIN.BrushMissions = { stageFromClean, buildBadges };
})();