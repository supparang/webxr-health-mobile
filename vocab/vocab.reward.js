/* =========================================================
   /vocab/vocab.reward.js
   TechPath Vocab Arena
   Reward / Summary / Details / Navigation
   ========================================================= */

"use strict";

/* =========================================================
   REWARD CONFIG
========================================================= */

const VOCAB_REWARD = {
  version: "vocab-reward-v1.0.0",
  lastSummaryKey: "VOCAB_LAST_SUMMARY",
  teacherSummaryKey: "VOCAB_TEACHER_SUMMARY",
  maxTeacherRows: 300,
  assistedFairScoreMultiplier: 0.95
};

/* =========================================================
   SAFE HELPERS
========================================================= */

function safeNumberReward(v, fallback = 0){
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function safeRoundReward(v){
  return Math.round(safeNumberReward(v, 0));
}

function safePercentReward(numerator, denominator){
  numerator = safeNumberReward(numerator, 0);
  denominator = safeNumberReward(denominator, 0);

  if(denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

function escapeRewardHtml(s){
  if(typeof escapeHtmlV6 === "function"){
    return escapeHtmlV6(s);
  }

  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function readRewardJson(key, fallback){
  try{
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  }catch(e){
    return fallback;
  }
}

function writeRewardJson(key, value){
  try{
    localStorage.setItem(key, JSON.stringify(value));
  }catch(e){
    console.warn("[VOCAB REWARD] save failed", key, e);
  }
}

function rewardById(id){
  return document.getElementById(id);
}

function rewardModeIcon(mode){
  mode = String(mode || "").toLowerCase();

  if(mode === "speed") return "⚡";
  if(mode === "mission") return "🎯";
  if(mode === "battle") return "👾";
  if(mode === "bossrush") return "💀";
  return "🤖";
}

function rewardModeLabel(mode){
  const m = String(mode || "").toLowerCase();

  if(typeof VOCAB_PLAY_MODES === "object" && VOCAB_PLAY_MODES[m]){
    return VOCAB_PLAY_MODES[m].label || m;
  }

  if(m === "speed") return "Speed Run";
  if(m === "mission") return "Debug Mission";
  if(m === "battle") return "Boss Battle";
  if(m === "bossrush") return "Boss Rush";
  return "AI Training";
}

function cleanRewardPublicText(text){
  return String(text ?? "")
    .replace(/\bv\d+\.\d+(\.\d+)?\b/gi, "")
    .replace(/\bv20\d{6,}[-_a-z0-9]*\b/gi, "")
    .replace(/\bpatch[_ -]?version\b/gi, "")
    .replace(/\bvocab[_ -]?version\b/gi, "")
    .replace(/\brelease[_ -]?pack\b/gi, "")
    .replace(/\bsource[_ -]?guard\b/gi, "")
    .replace(/\bdebug[_ -]?build\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/* =========================================================
   RESULT BUILDING
   แก้ปัญหา Details เป็น 0:
   - ไม่อ่านค่าจาก DOM
   - อ่านจาก vocabGame state โดยตรง
   - fallback ให้ทุก field
========================================================= */

function buildFinalResultFromGameVocab(reason = "completed"){
  const totalAnswered =
    safeNumberReward(vocabGame.correct, 0) +
    safeNumberReward(vocabGame.wrong, 0);

  const startedAt = safeNumberReward(vocabGame.startedAt, Date.now());
  const endedAt = safeNumberReward(vocabGame.endedAt, Date.now());
  const durationSec = Math.max(0, Math.round((endedAt - startedAt) / 1000));

  const mode = vocabGame.mode || VOCAB_APP.selectedMode || "learn";
  const difficulty = vocabGame.difficulty || VOCAB_APP.selectedDifficulty || "normal";
  const bank = vocabGame.bank || VOCAB_APP.selectedBank || "A";

  const enemyName =
    vocabGame.enemy && vocabGame.enemy.name
      ? vocabGame.enemy.name
      : "Enemy";

  const bossDefeated =
    safeNumberReward(vocabGame.enemyHp, 9999) <= 0 ||
    reason === "boss_defeated";

  const powerStats = {
    feverCount: safeNumberReward(vocabGame.powerStats?.feverCount, 0),
    shieldUsed: safeNumberReward(vocabGame.powerStats?.shieldUsed, 0),
    hintUsed: safeNumberReward(vocabGame.powerStats?.hintUsed, 0),
    laserUsed: safeNumberReward(vocabGame.powerStats?.laserUsed, 0),
    bossAttackCount: safeNumberReward(vocabGame.powerStats?.bossAttackCount, 0)
  };

  const aiHelpUsed = safeNumberReward(vocabGame.aiHelpUsed, 0);

  const result = {
    version: VOCAB_APP.version || VOCAB_REWARD.version,
    reason,

    bank,
    difficulty,
    mode,
    modeLabel: rewardModeLabel(mode),

    score: safeNumberReward(vocabGame.score, 0),
    correct: safeNumberReward(vocabGame.correct, 0),
    wrong: safeNumberReward(vocabGame.wrong, 0),
    totalAnswered,
    accuracy: safePercentReward(vocabGame.correct, totalAnswered),

    comboMax: safeNumberReward(vocabGame.comboMax, 0),
    durationSec,

    bossDefeated,
    enemyName,

    playerHpLeft: safeNumberReward(vocabGame.playerHp, 0),
    enemyHpLeft: safeNumberReward(vocabGame.enemyHp, 0),
    enemyHpMax: safeNumberReward(vocabGame.enemyHpMax, 0),

    weakestTerms: buildWeakestTermsReward(),
    stageStats: buildStageStatsReward(),
    powerStats,

    feverCount: powerStats.feverCount,
    shieldUsed: powerStats.shieldUsed,
    hintUsed: powerStats.hintUsed,
    laserUsed: powerStats.laserUsed,
    bossAttackCount: powerStats.bossAttackCount,

    aiHelpUsed,
    aiHelpLeft: safeNumberReward(vocabGame.aiHelpLeft, 0),
    aiHelpPenalty: safeNumberReward(vocabGame.aiHelpPenalty, 0),
    aiAssisted: aiHelpUsed > 0
  };

  return result;
}

function buildWeakestTermsReward(){
  const mistakes = Array.isArray(vocabGame.mistakes) ? vocabGame.mistakes : [];
  const map = new Map();

  mistakes.forEach(m => {
    const term = String(m.term || "").trim();
    if(!term) return;

    if(!map.has(term)){
      map.set(term, {
        term,
        meaning: m.meaning || "",
        count: 0,
        stages: new Set(),
        selected: []
      });
    }

    const item = map.get(term);
    item.count += 1;

    if(m.stageId){
      item.stages.add(m.stageId);
    }

    if(m.selected){
      item.selected.push(m.selected);
    }
  });

  return Array.from(map.values())
    .map(x => ({
      term: x.term,
      meaning: x.meaning,
      count: x.count,
      stages: Array.from(x.stages),
      selected: x.selected.slice(0, 3)
    }))
    .sort((a, b) => b.count - a.count);
}

function buildStageStatsReward(){
  const source = vocabGame.stageStats || {};
  const out = {};

  Object.keys(source).forEach(stageId => {
    const s = source[stageId] || {};
    const correct = safeNumberReward(s.correct, 0);
    const wrong = safeNumberReward(s.wrong, 0);
    const count = safeNumberReward(s.count, correct + wrong);
    const responseMsTotal = safeNumberReward(s.responseMsTotal, 0);

    out[stageId] = {
      correct,
      wrong,
      count,
      total: correct + wrong,
      accuracy: safePercentReward(correct, correct + wrong),
      avgResponseMs: count > 0 ? Math.round(responseMsTotal / count) : 0
    };
  });

  return out;
}

/* =========================================================
   REWARD DATA
========================================================= */

function buildRewardDataV6(result){
  result = result || {};

  let stars = 1;

  if(safeNumberReward(result.accuracy, 0) >= 70) stars = 2;
  if(safeNumberReward(result.accuracy, 0) >= 85 && result.bossDefeated) stars = 3;

  let badge = "Vocabulary Starter";

  if(stars === 2) badge = "Word Fighter";
  if(stars === 3) badge = "Boss Breaker";
  if(stars === 3 && safeNumberReward(result.comboMax, 0) >= 5) badge = "Combo Hero";
  if(stars === 3 && safeNumberReward(result.accuracy, 0) >= 95) badge = "Vocabulary Master";

  const coins =
    Math.round(safeNumberReward(result.score, 0) / 10) +
    stars * 20 +
    (result.bossDefeated ? 50 : 0) +
    (result.aiAssisted ? 0 : 20);

  const message = result.bossDefeated
    ? "คุณปราบบอสคำศัพท์ได้สำเร็จ!"
    : result.reason === "player_defeated"
      ? "บอสยังไม่ล้ม ลองแก้มืออีกครั้ง!"
      : "จบภารกิจแล้ว รอบต่อไปลองเพิ่มความท้าทายอีกนิด!";

  return {
    stars,
    badge,
    coins,
    message
  };
}

/* =========================================================
   AI COACH
========================================================= */

function buildAICoachSummaryV6(result){
  result = result || {};

  const accuracy = safeNumberReward(result.accuracy, 0);
  const combo = safeNumberReward(result.comboMax, 0);
  const mode = String(result.mode || "learn").toLowerCase();
  const difficulty = String(result.difficulty || "normal").toLowerCase();

  let headline = "";
  let nextMode = "";
  let reason = "";

  if(accuracy >= 90 && combo >= 5){
    headline = "ยอดเยี่ยมมาก! คุณตอบแม่นและรักษา combo ได้ดี";
    nextMode = difficulty === "challenge" ? "Boss Rush" : "Debug Mission";
    reason = "ผลลัพธ์แสดงว่าคุณพร้อมใช้คำศัพท์ในโจทย์ที่ซับซ้อนขึ้น";
  }else if(accuracy >= 80){
    headline = "พื้นฐานดีแล้ว ลองฝึกคำศัพท์ในสถานการณ์จริงต่อ";
    nextMode = mode === "mission" ? "Boss Battle" : "Debug Mission";
    reason = "คุณตอบถูกส่วนใหญ่ เหลือแค่เพิ่มความแม่นใน context";
  }else if(accuracy >= 65){
    headline = "เริ่มดีแล้ว รอบต่อไปเน้นคำที่พลาดและอ่านโจทย์ให้ช้าลง";
    nextMode = "AI Training";
    reason = "ระบบพบว่ายังมีคำบางกลุ่มที่สับสน";
  }else{
    headline = "ควรทบทวนคำพื้นฐานอีกนิด แล้วจะทำคะแนนดีขึ้นมาก";
    nextMode = "AI Training / Easy Review";
    reason = "คะแนนและความแม่นยังเหมาะกับการฝึกแบบมี feedback";
  }

  let powerTip = "";

  if(safeNumberReward(result.feverCount, 0) >= 1){
    powerTip = "คุณเข้า Fever ได้แล้ว รอบหน้าลองรักษา combo ให้ยาวขึ้น";
  }else if(combo >= 3){
    powerTip = "คุณเริ่มทำ combo ได้ดี พยายามต่อถึง x5 เพื่อเปิด Fever";
  }else{
    powerTip = "รอบหน้าลองตอบคำง่ายให้ต่อเนื่องก่อน เพื่อสะสมพลังพิเศษ";
  }

  let aiHelpTip = "";

  if(safeNumberReward(result.aiHelpUsed, 0) >= 3){
    aiHelpTip = "ใช้ AI Help หลายครั้ง ควรทบทวน weak words ก่อนเล่นระดับยาก";
  }else if(safeNumberReward(result.aiHelpUsed, 0) > 0){
    aiHelpTip = "ใช้ AI Help ได้เหมาะสม รอบหน้าลองลดจำนวนครั้งเพื่อเพิ่มคะแนน";
  }else{
    aiHelpTip = "รอบนี้ไม่ใช้ AI Help เลย เยี่ยมมาก สามารถเพิ่มความท้าทายได้";
  }

  return {
    headline,
    nextMode,
    reason,
    powerTip,
    aiHelpTip,
    bestStage: getBestStageReward(result),
    weakestTerms: Array.isArray(result.weakestTerms)
      ? result.weakestTerms.slice(0, 5)
      : []
  };
}

function getBestStageReward(result){
  const stats = result.stageStats || {};
  let best = null;

  Object.keys(stats).forEach(stageId => {
    const s = stats[stageId] || {};
    const total = safeNumberReward(s.correct, 0) + safeNumberReward(s.wrong, 0);
    if(total <= 0) return;

    const acc = safeNumberReward(s.correct, 0) / total;

    if(!best || acc > best.acc){
      best = { stageId, acc };
    }
  });

  if(!best) return "Warm-up";

  const stage = Array.isArray(VOCAB_STAGES)
    ? VOCAB_STAGES.find(s => s.id === best.stageId)
    : null;

  return stage ? stage.name : best.stageId;
}

/* =========================================================
   NEXT CHALLENGE
========================================================= */

function recommendNextDifficultyReward(result){
  const accuracy = safeNumberReward(result.accuracy, 0);
  const diff = String(result.difficulty || "normal").toLowerCase();

  if(accuracy >= 95){
    if(diff === "easy") return "normal";
    if(diff === "normal") return "hard";
    if(diff === "hard") return "challenge";
    return "challenge";
  }

  if(accuracy >= 85){
    if(diff === "easy") return "normal";
    if(diff === "normal") return "hard";
    return diff;
  }

  if(accuracy < 60){
    return "easy";
  }

  return diff || "normal";
}

function recommendNextModeReward(result){
  const accuracy = safeNumberReward(result.accuracy, 0);
  const mode = String(result.mode || "learn").toLowerCase();

  if(accuracy >= 90){
    if(mode === "learn") return "mission";
    if(mode === "mission") return "battle";
    if(mode === "battle") return "bossrush";
    return "bossrush";
  }

  if(accuracy >= 75){
    if(mode === "learn") return "speed";
    if(mode === "speed") return "mission";
    return "mission";
  }

  return "learn";
}

function buildNextOptionsReward(result){
  return {
    bank: result.bank || VOCAB_APP.selectedBank || "A",
    difficulty: recommendNextDifficultyReward(result),
    mode: recommendNextModeReward(result)
  };
}

/* =========================================================
   LEADERBOARD RESULT
========================================================= */

function applyLeaderboardToResultReward(result, reward){
  if(typeof updateLeaderboardV68 === "function"){
    try{
      const update = updateLeaderboardV68(result, reward);

      result.rank = update.rank;
      result.personalBest = update.personalBest;
      result.improvement = update.improvement;
      result.classTopScore = update.classTopScore;
      result.fairScore = update.fairScore;

      return result;
    }catch(e){
      console.warn("[VOCAB REWARD] leaderboard update failed", e);
    }
  }

  const fairScore = result.aiAssisted
    ? Math.round(result.score * VOCAB_REWARD.assistedFairScoreMultiplier)
    : result.score;

  result.rank = "";
  result.personalBest = fairScore;
  result.improvement = 0;
  result.classTopScore = fairScore;
  result.fairScore = fairScore;

  return result;
}

/* =========================================================
   SAVE SUMMARY
========================================================= */

function saveLastVocabSummaryV6(payload){
  writeRewardJson(VOCAB_REWARD.lastSummaryKey, {
    savedAt: new Date().toISOString(),
    ...payload
  });
}

function saveTeacherSummaryV63(result, reward, coach){
  const student =
    typeof getStudentContextV63 === "function"
      ? getStudentContextV63()
      : {
          display_name: "Hero",
          student_id: "anon",
          section: "",
          session_code: ""
        };

  const summary = {
    saved_at: new Date().toISOString(),
    session_id: typeof getVocabSessionIdV6 === "function" ? getVocabSessionIdV6() : "",
    display_name: student.display_name,
    student_id: student.student_id,
    section: student.section,
    session_code: student.session_code,

    bank: result.bank,
    difficulty: result.difficulty,
    mode: result.mode,
    mode_label: result.modeLabel,

    score: result.score,
    fair_score: result.fairScore || result.score,
    accuracy: result.accuracy,
    correct: result.correct,
    wrong: result.wrong,
    total_answered: result.totalAnswered,
    combo_max: result.comboMax,
    duration_sec: result.durationSec,
    boss_defeated: result.bossDefeated ? 1 : 0,

    stars: reward.stars,
    badge: reward.badge,
    coins: reward.coins,

    ai_next_mode: coach.nextMode,
    ai_reason: coach.reason,
    ai_help_used: result.aiHelpUsed,
    ai_assisted: result.aiAssisted ? 1 : 0,

    weakest_terms: result.weakestTerms || [],
    stage_stats: result.stageStats || {},
    power_stats: result.powerStats || {}
  };

  const rows = readRewardJson(VOCAB_REWARD.teacherSummaryKey, []);
  rows.push(summary);
  writeRewardJson(
    VOCAB_REWARD.teacherSummaryKey,
    rows.slice(-VOCAB_REWARD.maxTeacherRows)
  );

  return summary;
}

function updateStudentProfileV63(result, reward, coach){
  if(typeof logVocabEventV6 === "function"){
    logVocabEventV6("student_profile_update", {
      last_score: result.score,
      last_accuracy: result.accuracy,
      last_combo_max: result.comboMax,
      last_mode: result.mode,
      last_mode_label: result.modeLabel,
      recommended_mode: coach.nextMode,
      recommended_difficulty: recommendNextDifficultyReward(result),
      ai_reason: coach.reason,
      weak_terms_json: JSON.stringify(result.weakestTerms || []),
      badge: reward.badge,
      stars: reward.stars,
      coins: reward.coins,
      ai_help_used: result.aiHelpUsed,
      ai_assisted: result.aiAssisted ? 1 : 0,
      leaderboard_rank: result.rank || "",
      fair_score: result.fairScore || result.score || 0,
      personal_best: result.personalBest || "",
      improvement: result.improvement || "",
      class_top_score: result.classTopScore || ""
    });
  }
}

/* =========================================================
   RENDER HELPERS
========================================================= */

function rewardStatCard(label, value, sub = ""){
  return `
    <div class="vocab-reward-stat">
      <b>${escapeRewardHtml(value)}</b>
      <span>${escapeRewardHtml(label)}</span>
      ${sub ? `<small>${escapeRewardHtml(sub)}</small>` : ""}
    </div>
  `;
}

function renderRewardStats(result){
  const rank = result.rank ? `#${result.rank}` : "-";
  const personalBest = safeNumberReward(result.personalBest, result.score);
  const improvement = safeNumberReward(result.improvement, 0);

  const improveText =
    improvement > 0
      ? `+${improvement}`
      : improvement < 0
        ? `${Math.abs(improvement)} to PB`
        : "0";

  return `
    <div class="vocab-reward-grid-main">
      ${rewardStatCard("Score", safeRoundReward(result.score))}
      ${rewardStatCard("Accuracy", `${safeRoundReward(result.accuracy)}%`)}
      ${rewardStatCard("Best Combo", `x${safeRoundReward(result.comboMax)}`)}
      ${rewardStatCard("Rank", rank)}
      ${rewardStatCard("Personal Best", safeRoundReward(personalBest))}
      ${rewardStatCard("Progress", improveText)}
    </div>
  `;
}

function renderRewardDetails(result){
  const weakText = renderWeakWordsCompactReward(result);
  const stageText = renderStageStatsCompactReward(result);

  return `
    <details class="vocab-reward-details">
      <summary>Details</summary>

      <div class="vocab-reward-details-body">
        <div class="vocab-reward-grid-detail">
          ${rewardStatCard("Correct", safeRoundReward(result.correct))}
          ${rewardStatCard("Wrong", safeRoundReward(result.wrong))}
          ${rewardStatCard("Answered", safeRoundReward(result.totalAnswered))}
          ${rewardStatCard("Time", `${safeRoundReward(result.durationSec)}s`)}
          ${rewardStatCard("Fever", safeRoundReward(result.feverCount))}
          ${rewardStatCard("Shield Used", safeRoundReward(result.shieldUsed))}
          ${rewardStatCard("Hint Used", safeRoundReward(result.hintUsed))}
          ${rewardStatCard("Laser Used", safeRoundReward(result.laserUsed))}
          ${rewardStatCard("AI Help", safeRoundReward(result.aiHelpUsed))}
          ${rewardStatCard("HP Left", safeRoundReward(result.playerHpLeft))}
          ${rewardStatCard("Enemy HP", `${safeRoundReward(result.enemyHpLeft)}/${safeRoundReward(result.enemyHpMax)}`)}
          ${rewardStatCard("Boss", result.bossDefeated ? "Defeated" : "Alive")}
        </div>

        <div class="vocab-reward-note">
          <b>Weak Words:</b> ${weakText}
        </div>

        <div class="vocab-reward-note">
          <b>Stage:</b> ${stageText}
        </div>
      </div>
    </details>
  `;
}

function renderWeakWordsCompactReward(result){
  const weak = Array.isArray(result.weakestTerms) ? result.weakestTerms : [];

  if(!weak.length){
    return "ยังไม่พบคำที่ควรทบทวน";
  }

  return weak
    .slice(0, 5)
    .map(x => `${escapeRewardHtml(x.term)} (${safeNumberReward(x.count, 1)})`)
    .join(" • ");
}

function renderStageStatsCompactReward(result){
  const stats = result.stageStats || {};
  const keys = Object.keys(stats);

  if(!keys.length){
    return "ยังไม่มีข้อมูล stage";
  }

  return keys.map(stageId => {
    const s = stats[stageId] || {};
    const acc = safeNumberReward(s.accuracy, 0);
    const total = safeNumberReward(s.total, 0);

    return `${escapeRewardHtml(stageId)} ${acc}% (${total})`;
  }).join(" • ");
}

function renderRewardCoach(result, coach){
  const nextOptions = buildNextOptionsReward(result);
  const nextModeLabel = rewardModeLabel(nextOptions.mode);

  return `
    <section class="vocab-reward-coach">
      <h3>🤖 AI Coach</h3>
      <p><b>${escapeRewardHtml(cleanRewardPublicText(coach.headline || ""))}</b></p>
      <p>${escapeRewardHtml(cleanRewardPublicText(coach.reason || ""))}</p>
      <p><b>Next Challenge:</b> ${escapeRewardHtml(nextModeLabel)} • ${escapeRewardHtml(nextOptions.difficulty)}</p>
      <p><b>Tip:</b> ${escapeRewardHtml(cleanRewardPublicText(coach.powerTip || ""))}</p>
      <p><b>AI Help:</b> ${escapeRewardHtml(cleanRewardPublicText(coach.aiHelpTip || ""))}</p>
    </section>
  `;
}

function renderRewardActions(){
  return `
    <div class="vocab-reward-actions">
      <button class="vocab-reward-btn primary" type="button" data-reward-action="again">
        🔁 Play Again
      </button>

      <button class="vocab-reward-btn" type="button" data-reward-action="next">
        🚀 Next Challenge
      </button>

      <button class="vocab-reward-btn secondary" type="button" data-reward-action="menu">
        🏠 Back to Menu
      </button>
    </div>
  `;
}

/* =========================================================
   RENDER REWARD SCREEN
========================================================= */

function renderRewardScreenV6(result, reward, coach){
  const battlePanel = rewardById("v6BattlePanel");
  const menuPanel = rewardById("v6MenuPanel");
  const rewardPanel = rewardById("v6RewardPanel");

  if(battlePanel){
    battlePanel.hidden = true;
    battlePanel.style.display = "none";
    battlePanel.style.pointerEvents = "none";
  }

  if(menuPanel){
    menuPanel.hidden = true;
    menuPanel.style.display = "none";
    menuPanel.style.pointerEvents = "none";
  }

  if(!rewardPanel){
    alert(`จบเกม! Score: ${result.score}, Accuracy: ${result.accuracy}%`);
    return;
  }

  rewardPanel.hidden = false;
  rewardPanel.style.display = "block";
  rewardPanel.style.pointerEvents = "auto";

  const starText =
    "⭐".repeat(safeNumberReward(reward.stars, 1)) +
    "☆".repeat(Math.max(0, 3 - safeNumberReward(reward.stars, 1)));

  const modeIcon = rewardModeIcon(result.mode);
  const modeLabel = rewardModeLabel(result.mode);

  rewardPanel.innerHTML = `
    <div class="vocab-reward-shell">
      <div class="vocab-reward-trophy">🏆</div>

      <h2>Victory Reward</h2>

      <div class="vocab-reward-mode">
        ${modeIcon} ${escapeRewardHtml(modeLabel)}
      </div>

      <div class="vocab-reward-badges">
        <span>🎯 ${escapeRewardHtml(result.difficulty || "normal")}</span>
        <span>📚 Bank ${escapeRewardHtml(result.bank || "-")}</span>
        <span>🏅 ${escapeRewardHtml(result.aiAssisted ? `AI Help x${result.aiHelpUsed}` : "No AI Help")}</span>
        <span>🪙 ${safeRoundReward(reward.coins)} coins</span>
      </div>

      <div class="vocab-reward-stars">${starText}</div>

      <p class="vocab-reward-message">
        ${escapeRewardHtml(cleanRewardPublicText(reward.message || "คุณทำภารกิจสำเร็จ!"))}
      </p>

      ${renderRewardStats(result)}
      ${renderRewardCoach(result, coach)}
      ${renderRewardActions()}
      ${renderRewardDetails(result)}
    </div>
  `;

  bindRewardButtons();
  window.scrollTo({ top: 0, behavior: "auto" });
}

/* =========================================================
   END GAME OVERRIDE
========================================================= */

function endVocabBattleV6(reason = "completed"){
  if(typeof clearTimerV6 === "function") clearTimerV6();
  if(typeof stopFeverV62 === "function") stopFeverV62();

  vocabGame.active = false;
  vocabGame.endedAt = Date.now();

  let result = buildFinalResultFromGameVocab(reason);
  const reward = buildRewardDataV6(result);
  const coach = buildAICoachSummaryV6(result);

  result = applyLeaderboardToResultReward(result, reward);

  saveLastVocabSummaryV6({ result, reward, coach });
  saveTeacherSummaryV63(result, reward, coach);
  updateStudentProfileV63(result, reward, coach);

  renderRewardScreenV6(result, reward, coach);

  if(typeof logVocabEventV6 === "function"){
    logVocabEventV6("session_end", {
      ended_at: new Date(vocabGame.endedAt).toISOString(),
      duration_sec: result.durationSec,
      reason: result.reason,

      score: result.score,
      fair_score: result.fairScore || result.score,
      correct: result.correct,
      wrong: result.wrong,
      total_answered: result.totalAnswered,
      accuracy: result.accuracy,
      combo_max: result.comboMax,

      boss_defeated: result.bossDefeated ? 1 : 0,
      enemy_name: result.enemyName,
      player_hp_left: result.playerHpLeft,
      enemy_hp_left: result.enemyHpLeft,
      enemy_hp_max: result.enemyHpMax,

      stars: reward.stars,
      badge: reward.badge,
      coins: reward.coins,

      ai_headline: coach.headline,
      ai_next_mode: coach.nextMode,
      ai_reason: coach.reason,
      ai_power_tip: coach.powerTip || "",
      ai_help_tip: coach.aiHelpTip || "",
      ai_best_stage: coach.bestStage,

      weakest_terms_json: JSON.stringify(result.weakestTerms || []),
      stage_stats_json: JSON.stringify(result.stageStats || {}),
      power_stats_json: JSON.stringify(result.powerStats || {}),

      fever_count: result.feverCount,
      shield_used: result.shieldUsed,
      hint_used: result.hintUsed,
      laser_used: result.laserUsed,

      ai_help_used: result.aiHelpUsed || 0,
      ai_help_left: result.aiHelpLeft || 0,
      ai_help_penalty: result.aiHelpPenalty || 0,
      ai_assisted: result.aiAssisted ? 1 : 0,

      leaderboard_rank: result.rank || "",
      personal_best: result.personalBest || "",
      improvement: result.improvement || "",
      class_top_score: result.classTopScore || ""
    });
  }
}

/* =========================================================
   REWARD NAVIGATION
========================================================= */

function clearRewardGameTimers(){
  try{
    if(vocabGame.timerId){
      clearInterval(vocabGame.timerId);
      clearTimeout(vocabGame.timerId);
      vocabGame.timerId = null;
    }

    if(vocabGame.feverTimerId){
      clearTimeout(vocabGame.feverTimerId);
      clearInterval(vocabGame.feverTimerId);
      vocabGame.feverTimerId = null;
    }

    vocabGame.fever = false;
    vocabGame.feverUntil = 0;
  }catch(e){}

  if(typeof clearTimerV6 === "function") clearTimerV6();
  if(typeof stopFeverV62 === "function") stopFeverV62();
}

function removeRewardFx(){
  [
    ".v6-float",
    ".v6-laser-beam",
    ".v6-fx-burst",
    ".v72-announcer",
    ".v72-flash",
    ".v72-particle",
    ".v74-toast",
    ".v78-guard-toast"
  ].forEach(sel => {
    document.querySelectorAll(sel).forEach(node => {
      try{ node.remove(); }catch(e){}
    });
  });

  document.body.classList.remove(
    "v72-screen-shake",
    "v72-hard-hit",
    "v72-boss-rage",
    "v72-fever-rainbow",
    "v73-final-lock"
  );
}

function showRewardBattleOnly(){
  const reward = rewardById("v6RewardPanel");
  const menu = rewardById("v6MenuPanel");
  const battle = rewardById("v6BattlePanel");

  if(reward){
    reward.hidden = true;
    reward.style.display = "none";
    reward.style.pointerEvents = "none";
  }

  if(menu){
    menu.hidden = true;
    menu.style.display = "none";
    menu.style.pointerEvents = "none";
  }

  if(battle){
    battle.hidden = false;
    battle.style.display = "";
    battle.style.pointerEvents = "auto";
  }

  window.scrollTo({ top: 0, behavior: "auto" });
}

function showRewardMenuOnly(){
  const reward = rewardById("v6RewardPanel");
  const menu = rewardById("v6MenuPanel");
  const battle = rewardById("v6BattlePanel");

  if(reward){
    reward.hidden = true;
    reward.style.display = "none";
    reward.style.pointerEvents = "none";
  }

  if(battle){
    battle.hidden = true;
    battle.style.display = "none";
    battle.style.pointerEvents = "none";
  }

  if(menu){
    menu.hidden = false;
    menu.style.display = "";
    menu.style.pointerEvents = "auto";
  }

  window.scrollTo({ top: 0, behavior: "auto" });
}

function syncRewardSelections(options){
  if(window.VOCAB_APP){
    VOCAB_APP.selectedBank = options.bank;
    VOCAB_APP.selectedDifficulty = options.difficulty;
    VOCAB_APP.selectedMode = options.mode;
  }

  document.querySelectorAll("[data-v6-bank]").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.v6Bank === options.bank);
  });

  document.querySelectorAll("[data-v6-diff]").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.v6Diff === options.difficulty);
  });

  document.querySelectorAll("[data-v6-mode]").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.v6Mode === options.mode);
  });

  if(typeof updateV6DiffPreview === "function") updateV6DiffPreview();
  if(typeof updateV66ModePreview === "function") updateV66ModePreview();
  if(typeof updateV6BankLabel === "function") updateV6BankLabel();
  if(typeof updateV66ModeHud === "function") updateV66ModeHud();
}

function currentRewardOptions(){
  return {
    bank: vocabGame.bank || VOCAB_APP.selectedBank || "A",
    difficulty: vocabGame.difficulty || VOCAB_APP.selectedDifficulty || "normal",
    mode: vocabGame.mode || VOCAB_APP.selectedMode || "learn"
  };
}

function startRewardRun(kind){
  clearRewardGameTimers();
  removeRewardFx();

  let options = currentRewardOptions();

  if(kind === "next"){
    const lastSummary = readRewardJson(VOCAB_REWARD.lastSummaryKey, null);

    if(lastSummary && lastSummary.result){
      options = buildNextOptionsReward(lastSummary.result);
    }else{
      options = {
        ...options,
        mode: "mission",
        difficulty: recommendNextDifficultyReward(options)
      };
    }
  }

  syncRewardSelections(options);
  showRewardBattleOnly();

  setTimeout(() => {
    if(typeof startVocabBattleV6 === "function"){
      startVocabBattleV6(options);
      setTimeout(showRewardBattleOnly, 80);
      return;
    }

    location.reload();
  }, 80);
}

function backRewardMenu(){
  clearRewardGameTimers();
  removeRewardFx();

  vocabGame.active = false;

  showRewardMenuOnly();

  if(typeof renderLeaderboardV68 === "function"){
    renderLeaderboardV68(VOCAB_APP.selectedMode || "learn");
  }
}

function bindRewardButtons(){
  const reward = rewardById("v6RewardPanel");
  if(!reward) return;

  reward.querySelectorAll("[data-reward-action]").forEach(btn => {
    btn.addEventListener("click", e => {
      e.preventDefault();
      e.stopPropagation();

      const action = btn.dataset.rewardAction;

      if(action === "again"){
        startRewardRun("again");
      }else if(action === "next"){
        startRewardRun("next");
      }else if(action === "menu"){
        backRewardMenu();
      }
    });
  });
}

/* =========================================================
   GLOBAL BUTTON FALLBACK
========================================================= */

window.__VOCAB_V81_PLAY_AGAIN = function(){
  startRewardRun("again");
};

window.__VOCAB_V81_NEXT_CHALLENGE = function(){
  startRewardRun("next");
};

window.__VOCAB_V81_BACK_MENU = function(){
  backRewardMenu();
};

/* =========================================================
   SCREEN GOVERNOR
========================================================= */

function rewardScreenGovernor(){
  const reward = rewardById("v6RewardPanel");
  const battle = rewardById("v6BattlePanel");
  const menu = rewardById("v6MenuPanel");

  if(!reward || !battle || !menu) return;

  if(!reward.hidden && reward.innerHTML.trim()){
    menu.hidden = true;
    menu.style.display = "none";
    battle.hidden = true;
    battle.style.display = "none";
    reward.style.display = "block";
    reward.style.pointerEvents = "auto";
    return;
  }

  if(vocabGame && vocabGame.active){
    reward.hidden = true;
    reward.style.display = "none";
    menu.hidden = true;
    menu.style.display = "none";
    battle.hidden = false;
    battle.style.display = "";
  }
}

setInterval(rewardScreenGovernor, 400);

/* =========================================================
   PUBLIC DEBUG
========================================================= */

window.previewVocabLastSummary = function(){
  return readRewardJson(VOCAB_REWARD.lastSummaryKey, null);
};

window.previewVocabTeacherSummary = function(){
  return readRewardJson(VOCAB_REWARD.teacherSummaryKey, []);
};

window.resetVocabRewardData = function(){
  localStorage.removeItem(VOCAB_REWARD.lastSummaryKey);
  localStorage.removeItem(VOCAB_REWARD.teacherSummaryKey);
  alert("ล้างข้อมูล reward summary แล้ว");
};

console.log("[VOCAB] reward module loaded", VOCAB_REWARD.version);
