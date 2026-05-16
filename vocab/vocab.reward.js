/* =========================================================
   /vocab/vocab.reward.js
   TechPath Vocab Arena — Reward / Summary Screen
   FULL CLEAN PATCH: v20260503v

   Covers checklist:
   1) End flow summary
   2) Sheet-ready summary fields
   3) Detail-safe fields
   4) Reward screen polish
   5) Leaderboard update
   6) AI Coach recommendation
   7) Weak terms display
   8) Back to menu
   9) Compatible with VocabStorage / VocabLogger / VocabUI
   10) Classroom-ready final summary
========================================================= */

(function(){
  "use strict";

  const WIN = window;
  const DOC = document;

  const VERSION = "vocab-reward-v20260503v";

  /* =========================================================
     BASIC HELPERS
  ========================================================= */

  function $(id){
    return DOC.getElementById(id);
  }

  function qs(sel, root){
    return (root || DOC).querySelector(sel);
  }

  function qsa(sel, root){
    return Array.from((root || DOC).querySelectorAll(sel));
  }

  function log(){
    try{
      console.log.apply(console, ["[VOCAB REWARD]"].concat(Array.from(arguments)));
    }catch(e){}
  }

  function warn(){
    try{
      console.warn.apply(console, ["[VOCAB REWARD]"].concat(Array.from(arguments)));
    }catch(e){}
  }

  function esc(s){
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function readJson(key, fallback){
    try{
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    }catch(e){
      return fallback;
    }
  }

  function writeJson(key, value){
    try{
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    }catch(e){
      return false;
    }
  }

  function getParam(name, fallback){
    try{
      const p = new URLSearchParams(location.search);
      return p.get(name) || fallback || "";
    }catch(e){
      return fallback || "";
    }
  }

  function pick(){
    for(let i = 0; i < arguments.length; i++){
      const v = arguments[i];
      if(v !== undefined && v !== null && v !== ""){
        return v;
      }
    }
    return "";
  }

  function clean(s){
    return String(s ?? "").trim();
  }

  function num(v, fallback){
    const n = Number(v);
    return Number.isFinite(n) ? n : Number(fallback || 0);
  }

  function int(v, fallback){
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : Number(fallback || 0);
  }

  function nowIso(){
    return new Date().toISOString();
  }

  function bangkokIsoNow(){
    const bangkokMs = Date.now() + (7 * 60 * 60 * 1000);
    return new Date(bangkokMs).toISOString().replace("Z", "+07:00");
  }

  function modeLabel(mode){
    const map = {
      learn: "🤖 AI Training",
      speed: "⚡ Speed Run",
      mission: "🎯 Debug Mission",
      battle: "👾 Boss Battle",
      bossrush: "💀 Boss Rush"
    };

    return map[mode] || mode || "🤖 AI Training";
  }

  function difficultyLabel(diff){
    const map = {
      easy: "Easy",
      normal: "Normal",
      hard: "Hard",
      challenge: "Challenge"
    };

    return map[diff] || diff || "Easy";
  }

  function getStudentProfile(){
    if(WIN.VocabStorage && typeof WIN.VocabStorage.loadStudentProfile === "function"){
      try{
        return WIN.VocabStorage.loadStudentProfile();
      }catch(e){}
    }

    return readJson("VOCAB_SPLIT_STUDENT_PROFILE", {}) || {};
  }

  function getUiState(){
    if(WIN.VocabUI && typeof WIN.VocabUI.getState === "function"){
      try{
        return WIN.VocabUI.getState() || {};
      }catch(e){}
    }

    if(WIN.VocabState && typeof WIN.VocabState.get === "function"){
      try{
        return WIN.VocabState.get() || {};
      }catch(e){}
    }

    return WIN.VOCAB_APP || {};
  }

  /* =========================================================
     CSS
  ========================================================= */

  function ensureCss(){
    if($("vocabRewardFinalCss")) return;

    const style = DOC.createElement("style");
    style.id = "vocabRewardFinalCss";
    style.textContent = `
      .vocab-reward-screen{
        width:min(1180px,100%);
        margin:0 auto;
        padding:clamp(12px,3vw,28px);
      }

      .vocab-reward-wrap{
        display:grid;
        gap:16px;
      }

      .vocab-result-hero{
        position:relative;
        overflow:hidden;
        border-radius:32px;
        padding:24px;
        border:1px solid rgba(255,255,255,.16);
        background:
          radial-gradient(circle at 12% 10%, rgba(89,208,255,.26), transparent 32%),
          radial-gradient(circle at 90% 0%, rgba(139,92,246,.26), transparent 34%),
          linear-gradient(135deg,rgba(255,255,255,.14),rgba(255,255,255,.05)),
          rgba(8,17,34,.86);
        box-shadow:0 24px 80px rgba(0,0,0,.38);
        color:var(--text,#eef7ff);
      }

      .vocab-result-hero h1{
        margin:0;
        font-size:clamp(34px,7vw,72px);
        line-height:1;
        letter-spacing:-.055em;
      }

      .vocab-result-hero p{
        margin:12px 0 0;
        color:var(--muted,#a8bdd6);
        font-size:clamp(15px,2.4vw,19px);
        line-height:1.55;
      }

      .vocab-result-badge{
        display:inline-flex;
        align-items:center;
        gap:8px;
        padding:8px 13px;
        border-radius:999px;
        background:rgba(255,209,102,.18);
        border:1px solid rgba(255,209,102,.45);
        color:#fff5cc;
        font-weight:1000;
        margin-bottom:14px;
      }

      .vocab-result-grid{
        display:grid;
        grid-template-columns:repeat(4,1fr);
        gap:12px;
      }

      .vocab-result-card{
        border-radius:24px;
        padding:18px;
        border:1px solid rgba(255,255,255,.16);
        background:rgba(255,255,255,.08);
        color:var(--text,#eef7ff);
        box-shadow:0 16px 44px rgba(0,0,0,.22);
      }

      .vocab-result-card small{
        display:block;
        color:var(--muted,#a8bdd6);
        font-weight:900;
        margin-bottom:8px;
      }

      .vocab-result-card b{
        display:block;
        font-size:clamp(26px,5vw,44px);
        line-height:1;
        letter-spacing:-.04em;
      }

      .vocab-result-card span{
        display:block;
        color:var(--muted,#a8bdd6);
        margin-top:8px;
        font-weight:850;
        line-height:1.35;
      }

      .vocab-result-card.good{
        background:rgba(68,223,147,.14);
        border-color:rgba(68,223,147,.38);
      }

      .vocab-result-card.warn{
        background:rgba(255,209,102,.14);
        border-color:rgba(255,209,102,.38);
      }

      .vocab-result-card.bad{
        background:rgba(255,110,135,.14);
        border-color:rgba(255,110,135,.38);
      }

      .vocab-coach-card,
      .vocab-weak-card,
      .vocab-rank-card{
        border-radius:28px;
        padding:20px;
        border:1px solid rgba(255,255,255,.16);
        background:rgba(9,18,36,.86);
        box-shadow:0 16px 44px rgba(0,0,0,.24);
        color:var(--text,#eef7ff);
      }

      .vocab-coach-card h2,
      .vocab-weak-card h2,
      .vocab-rank-card h2{
        margin:0 0 12px;
        font-size:24px;
        letter-spacing:-.02em;
      }

      .vocab-coach-card p,
      .vocab-weak-card p,
      .vocab-rank-card p{
        margin:0;
        color:var(--muted,#a8bdd6);
        line-height:1.55;
        font-weight:850;
      }

      .vocab-advice-list{
        display:grid;
        gap:10px;
        margin-top:14px;
      }

      .vocab-advice-item{
        padding:12px 14px;
        border-radius:18px;
        background:rgba(255,255,255,.08);
        border:1px solid rgba(255,255,255,.13);
        line-height:1.5;
        font-weight:850;
      }

      .vocab-weak-list{
        display:flex;
        flex-wrap:wrap;
        gap:8px;
        margin-top:14px;
      }

      .vocab-weak-chip{
        display:inline-flex;
        align-items:center;
        gap:6px;
        padding:8px 12px;
        border-radius:999px;
        background:rgba(255,110,135,.14);
        border:1px solid rgba(255,110,135,.34);
        color:#ffd7df;
        font-weight:950;
      }

      .vocab-rank-line{
        display:grid;
        grid-template-columns:repeat(3,1fr);
        gap:10px;
        margin-top:14px;
      }

      .vocab-rank-pill{
        padding:12px;
        border-radius:18px;
        background:rgba(255,255,255,.08);
        border:1px solid rgba(255,255,255,.13);
        text-align:center;
      }

      .vocab-rank-pill small{
        display:block;
        color:var(--muted,#a8bdd6);
        font-weight:850;
      }

      .vocab-rank-pill b{
        display:block;
        margin-top:5px;
        font-size:24px;
        font-weight:1000;
      }

      .vocab-reward-actions{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:12px;
      }

      .vocab-reward-btn{
        min-height:58px;
        border:0;
        border-radius:22px;
        color:#fff;
        font-size:18px;
        font-weight:1000;
        cursor:pointer;
        background:
          radial-gradient(circle at 30% 20%,rgba(255,255,255,.32),transparent 30%),
          linear-gradient(135deg,#59d0ff,#8b5cf6);
        box-shadow:0 18px 44px rgba(89,208,255,.22);
      }

      .vocab-reward-btn.secondary{
        background:rgba(255,255,255,.10);
        border:1px solid rgba(255,255,255,.16);
        box-shadow:none;
      }

      .vocab-reward-note{
        color:var(--muted,#a8bdd6);
        font-size:13px;
        font-weight:800;
        line-height:1.45;
        text-align:center;
      }

      @media(max-width:900px){
        .vocab-result-grid{
          grid-template-columns:1fr 1fr;
        }

        .vocab-rank-line{
          grid-template-columns:1fr;
        }
      }

      @media(max-width:560px){
        .vocab-result-grid{
          grid-template-columns:1fr;
        }

        .vocab-reward-actions{
          grid-template-columns:1fr;
        }

        .vocab-result-hero,
        .vocab-coach-card,
        .vocab-weak-card,
        .vocab-rank-card{
          border-radius:22px;
          padding:16px;
        }
      }
    `;

    DOC.head.appendChild(style);
  }

  /* =========================================================
     SUMMARY NORMALIZATION
  ========================================================= */

  function calculateAccuracy(correct, wrong, fallback){
    const c = num(correct, 0);
    const w = num(wrong, 0);
    const total = c + w;

    if(total <= 0){
      return num(fallback, 0);
    }

    return Math.round((c / total) * 100);
  }

  function extractWeakTerms(summary){
    summary = summary || {};

    const out = [];

    const rawWeak =
      summary.weak_terms ||
      summary.weakTerms ||
      summary.weakest_terms ||
      summary.weakestTerms ||
      summary.mistakes_terms ||
      summary.mistakeTerms ||
      [];

    if(Array.isArray(rawWeak)){
      rawWeak.forEach(function(x){
        if(typeof x === "string"){
          out.push({
            term: clean(x),
            count: 1
          });
        }else if(x && typeof x === "object"){
          out.push({
            term: clean(pick(x.term, x.word, x.vocab, x.name, "")),
            meaning: clean(pick(x.meaning, x.correct_answer, x.correctAnswer, "")),
            count: num(pick(x.count, x.mistakes, 1), 1)
          });
        }
      });
    }

    const weakest = clean(pick(summary.weakest_term, summary.weakestTerm, ""));
    if(weakest && !out.some(x => x.term === weakest)){
      out.push({
        term: weakest,
        count: 1
      });
    }

    return out
      .filter(x => x.term)
      .sort((a,b) => num(b.count,0) - num(a.count,0))
      .slice(0, 6);
  }

  function normalizeSummary(input){
    const s0 = Object.assign({}, getUiState(), input || {});
    const profile = getStudentProfile();

    const mode = clean(pick(s0.mode, s0.selectedMode, "learn")).toLowerCase();
    const diff = clean(pick(s0.difficulty, s0.diff, s0.selectedDifficulty, "easy")).toLowerCase();

    const score = num(pick(s0.score, s0.raw_score, s0.rawScore, 0), 0);
    const aiHelpUsed = num(pick(s0.ai_help_used, s0.aiHelpUsed, 0), 0);
    const fairScore = num(
      pick(
        s0.fair_score,
        s0.fairScore,
        aiHelpUsed > 0 ? Math.round(score * 0.95) : score
      ),
      score
    );

    const correct = num(pick(s0.correct_count, s0.correctCount, 0), 0);
    const wrong = num(pick(s0.wrong_count, s0.wrongCount, s0.mistakes, 0), 0);
    const accuracy = calculateAccuracy(correct, wrong, pick(s0.accuracy, 0));

    const duration = num(pick(s0.duration_sec, s0.durationSec, s0.duration, 0), 0);
    const activeTime = num(pick(s0.active_time_sec, s0.activeTimeSec, duration), duration);

    const questionCount = num(
      pick(
        s0.question_count,
        s0.questionCount,
        s0.totalQuestions,
        correct + wrong,
        0
      ),
      0
    );

    const summary = Object.assign({}, s0, {
      api: "vocab",
      source: "vocab.html",
      schema: pick(s0.schema, "vocab-split-v1"),
      version: pick(s0.version, VERSION),

      action: "session_end",
      event_type: "session_end",
      eventType: "session_end",

      client_ts: pick(s0.client_ts, s0.clientTs, bangkokIsoNow()),
      clientTs: pick(s0.client_ts, s0.clientTs, bangkokIsoNow()),

      session_id: pick(s0.session_id, s0.sessionId, "vocab_" + Date.now()),
      sessionId: pick(s0.session_id, s0.sessionId, "vocab_" + Date.now()),

      display_name: pick(s0.display_name, s0.displayName, profile.display_name, "Hero"),
      displayName: pick(s0.display_name, s0.displayName, profile.display_name, "Hero"),

      student_id: pick(s0.student_id, s0.studentId, profile.student_id, "anon"),
      studentId: pick(s0.student_id, s0.studentId, profile.student_id, "anon"),

      section: pick(s0.section, profile.section, ""),
      session_code: pick(s0.session_code, s0.sessionCode, profile.session_code, ""),
      sessionCode: pick(s0.session_code, s0.sessionCode, profile.session_code, ""),

      bank: pick(s0.bank, s0.selectedBank, "A"),
      mode: mode,
      difficulty: diff,
      diff: diff,

      score: score,
      raw_score: score,
      rawScore: score,

      fair_score: fairScore,
      fairScore: fairScore,

      accuracy: accuracy,

      correct_count: correct,
      correctCount: correct,

      wrong_count: wrong,
      wrongCount: wrong,

      mistakes: num(pick(s0.mistakes, wrong), wrong),

      combo_max: num(pick(s0.combo_max, s0.comboMax, s0.max_combo, s0.maxCombo, 0), 0),
      comboMax: num(pick(s0.combo_max, s0.comboMax, s0.max_combo, s0.maxCombo, 0), 0),

      question_count: questionCount,
      questionCount: questionCount,

      duration_sec: duration,
      durationSec: duration,

      active_time_sec: activeTime,
      activeTimeSec: activeTime,

      ai_help_used: aiHelpUsed,
      aiHelpUsed: aiHelpUsed,

      ai_assisted: aiHelpUsed > 0 ? 1 : num(pick(s0.ai_assisted, s0.aiAssisted, 0), 0),
      aiAssisted: aiHelpUsed > 0 ? 1 : num(pick(s0.ai_assisted, s0.aiAssisted, 0), 0),

      completed: 1,
      boss_defeated: num(pick(s0.boss_defeated, s0.bossDefeated, score > 0 ? 1 : 0), 0),
      bossDefeated: num(pick(s0.boss_defeated, s0.bossDefeated, score > 0 ? 1 : 0), 0)
    });

    const weakTerms = extractWeakTerms(summary);

    summary.weak_terms = weakTerms;
    summary.weakTerms = weakTerms;
    summary.weakest_term = weakTerms[0] ? weakTerms[0].term : clean(pick(summary.weakest_term, summary.weakestTerm, ""));
    summary.weakestTerm = summary.weakest_term;

    const coach = buildCoach(summary);

    summary.ai_recommended_mode = coach.recommendedMode;
    summary.aiRecommendedMode = coach.recommendedMode;
    summary.ai_recommended_difficulty = coach.recommendedDifficulty;
    summary.aiRecommendedDifficulty = coach.recommendedDifficulty;
    summary.ai_reason = coach.reason;
    summary.aiReason = coach.reason;

    return summary;
  }

  /* =========================================================
     AI COACH
  ========================================================= */

  function nextDifficulty(diff, accuracy){
    const order = ["easy", "normal", "hard", "challenge"];
    const i = Math.max(0, order.indexOf(diff));

    if(accuracy >= 85 && i < order.length - 1){
      return order[i + 1];
    }

    if(accuracy < 55 && i > 0){
      return order[i - 1];
    }

    return diff;
  }

  function buildCoach(summary){
    const accuracy = num(summary.accuracy, 0);
    const mode = summary.mode || "learn";
    const diff = summary.difficulty || "easy";
    const weakTerms = extractWeakTerms(summary);
    const aiHelpUsed = num(summary.ai_help_used, 0);

    let recommendedMode = mode;
    let recommendedDifficulty = nextDifficulty(diff, accuracy);
    let tone = "ดีมาก";
    const advice = [];

    if(accuracy >= 85){
      tone = "ยอดเยี่ยม";
      advice.push("คุณเข้าใจคำศัพท์ชุดนี้ดีแล้ว รอบถัดไปลองเพิ่มระดับความยากหรือเปลี่ยนเป็น Speed/Battle เพื่อท้าทายมากขึ้น");
      if(mode === "learn") recommendedMode = "speed";
      else if(mode === "speed") recommendedMode = "battle";
    }else if(accuracy >= 65){
      tone = "กำลังดี";
      advice.push("พื้นฐานค่อนข้างดีแล้ว แต่ยังควรทบทวนคำที่พลาดก่อนขยับระดับ");
      if(mode === "battle") recommendedMode = "mission";
      else recommendedMode = mode;
    }else{
      tone = "ควรทบทวน";
      advice.push("แนะนำกลับไปฝึกแบบ AI Training อีก 1 รอบ เพื่อจำความหมายและดูคำอธิบายให้ชัดขึ้น");
      recommendedMode = "learn";
    }

    if(weakTerms.length){
      advice.push(
        "คำที่ควรทบทวน: " +
        weakTerms.map(x => x.term).slice(0, 5).join(", ")
      );
    }

    if(aiHelpUsed > 0){
      advice.push("รอบนี้มีการใช้ AI Help จึงควรลองเล่นซ้ำอีกครั้งโดยใช้ตัวช่วยให้น้อยลง เพื่อวัดความจำจริง");
    }

    if(summary.mode === "speed" && accuracy < 70){
      advice.push("ใน Speed Run ถ้าความแม่นยังต่ำ ให้ลดความเร็วโดยกลับไปโหมด Learn ก่อน");
    }

    if(summary.mode === "battle" && accuracy < 70){
      advice.push("Boss Battle เหมาะกับคนที่จำคำได้แล้ว ถ้ายังพลาดหลายข้อให้ฝึก Mission/Training ก่อน");
    }

    const reason =
      tone + ": accuracy " + accuracy + "%, score " + summary.score +
      ", weak terms " + weakTerms.length +
      ", AI Help used " + aiHelpUsed + ".";

    return {
      tone,
      advice,
      recommendedMode,
      recommendedDifficulty,
      reason
    };
  }

  function gradeSummary(summary){
    const acc = num(summary.accuracy, 0);
    const score = num(summary.fair_score || summary.score, 0);

    if(acc >= 90) return { label:"S", icon:"🏆", text:"Excellent mastery", cls:"good" };
    if(acc >= 80) return { label:"A", icon:"🌟", text:"Very strong", cls:"good" };
    if(acc >= 65) return { label:"B", icon:"🔥", text:"Good progress", cls:"warn" };
    if(acc >= 50) return { label:"C", icon:"💪", text:"Keep practicing", cls:"warn" };
    return { label:"D", icon:"📘", text:"Review recommended", cls:"bad" };
  }

  /* =========================================================
     SAVE / LOG / LEADERBOARD
  ========================================================= */

  function saveSummary(summary){
    try{
      if(WIN.VocabStorage && typeof WIN.VocabStorage.saveLastSummary === "function"){
        WIN.VocabStorage.saveLastSummary(summary);
      }else{
        writeJson("VOCAB_SPLIT_LAST_SUMMARY", {
          saved_at: nowIso(),
          summary: summary
        });
      }
    }catch(e){
      warn("saveLastSummary failed", e);
    }
  }

  function updateLeaderboard(summary){
    try{
      if(WIN.VocabStorage && typeof WIN.VocabStorage.updateLeaderboard === "function"){
        return WIN.VocabStorage.updateLeaderboard(summary);
      }

      if(WIN.VocabUI && typeof WIN.VocabUI.updateLeaderboardFromResult === "function"){
        return WIN.VocabUI.updateLeaderboardFromResult(summary);
      }
    }catch(e){
      warn("updateLeaderboard failed", e);
    }

    return {
      rank: "-",
      fairScore: summary.fair_score || summary.score || 0,
      personalBest: summary.fair_score || summary.score || 0,
      classTopScore: summary.fair_score || summary.score || 0
    };
  }

  function logSessionEnd(summary){
    try{
      if(WIN.VocabLogger && typeof WIN.VocabLogger.sessionEnd === "function"){
        WIN.VocabLogger.sessionEnd(summary);
        return;
      }

      if(typeof WIN.logVocabSessionEndV6 === "function"){
        WIN.logVocabSessionEndV6(summary);
        return;
      }

      if(typeof WIN.logVocabEventV6 === "function"){
        WIN.logVocabEventV6("session_end", summary);
      }
    }catch(e){
      warn("logSessionEnd failed", e);
    }
  }

  function updateWeakTerms(summary){
    try{
      if(WIN.VocabData && typeof WIN.VocabData.updateWeakTermsFromMistakes === "function"){
        const mistakes = extractWeakTerms(summary).map(function(x){
          return {
            term: x.term,
            meaning: x.meaning || "",
            count: x.count || 1
          };
        });

        WIN.VocabData.updateWeakTermsFromMistakes(mistakes);
      }
    }catch(e){}
  }

  /* =========================================================
     RENDER
  ========================================================= */

  function renderWeakTerms(weakTerms){
    if(!weakTerms || !weakTerms.length){
      return `
        <p>ยังไม่มีคำที่พลาดเด่นชัดในรอบนี้ เยี่ยมมาก!</p>
      `;
    }

    return `
      <p>คำเหล่านี้ควรทบทวนก่อนเล่นรอบถัดไป</p>
      <div class="vocab-weak-list">
        ${
          weakTerms.map(function(x){
            return `
              <span class="vocab-weak-chip">
                📌 ${esc(x.term)}
              </span>
            `;
          }).join("")
        }
      </div>
    `;
  }

  function renderAdvice(coach){
    return `
      <div class="vocab-advice-list">
        ${
          coach.advice.map(function(item){
            return `<div class="vocab-advice-item">✅ ${esc(item)}</div>`;
          }).join("")
        }
      </div>
    `;
  }

  function render(summary, lbResult){
    ensureCss();

    const panel = $("vocabRewardPanel");

    if(!panel){
      alert(
        "Score: " + summary.score +
        "\nAccuracy: " + summary.accuracy + "%"
      );
      return;
    }

    const grade = gradeSummary(summary);
    const coach = buildCoach(summary);
    const weakTerms = extractWeakTerms(summary);

    panel.className = "vocab-screen vocab-reward-screen";
    panel.hidden = false;

    const menu = $("vocabMenuPanel");
    const battle = $("vocabBattlePanel");
    if(menu) menu.hidden = true;
    if(battle) battle.hidden = true;

    const rank = lbResult && lbResult.rank ? lbResult.rank : "-";
    const personalBest = lbResult && lbResult.personalBest !== undefined
      ? lbResult.personalBest
      : summary.fair_score;

    const classTopScore = lbResult && lbResult.classTopScore !== undefined
      ? lbResult.classTopScore
      : summary.fair_score;

    panel.innerHTML = `
      <div class="vocab-reward-wrap">

        <section class="vocab-result-hero">
          <div class="vocab-result-badge">
            ${grade.icon} Grade ${grade.label} • ${esc(grade.text)}
          </div>

          <h1>Mission Complete!</h1>

          <p>
            ${esc(summary.display_name || "Hero")} เล่นโหมด
            <b>${esc(modeLabel(summary.mode))}</b>
            • Bank ${esc(summary.bank)}
            • ${esc(difficultyLabel(summary.difficulty))}
          </p>
        </section>

        <section class="vocab-result-grid">
          <div class="vocab-result-card ${grade.cls}">
            <small>Score</small>
            <b>${Number(summary.score || 0)}</b>
            <span>คะแนนรวมก่อนปรับ AI Help</span>
          </div>

          <div class="vocab-result-card ${summary.ai_help_used > 0 ? "warn" : "good"}">
            <small>Fair Score</small>
            <b>${Number(summary.fair_score || summary.score || 0)}</b>
            <span>${summary.ai_help_used > 0 ? "มีการปรับเพราะใช้ AI Help" : "ไม่ใช้ AI Help"}</span>
          </div>

          <div class="vocab-result-card ${summary.accuracy >= 70 ? "good" : "warn"}">
            <small>Accuracy</small>
            <b>${Number(summary.accuracy || 0)}%</b>
            <span>${Number(summary.correct_count || 0)} ถูก / ${Number(summary.wrong_count || 0)} ผิด</span>
          </div>

          <div class="vocab-result-card">
            <small>Combo Max</small>
            <b>x${Number(summary.combo_max || 0)}</b>
            <span>AI Help used: ${Number(summary.ai_help_used || 0)}</span>
          </div>
        </section>

        <section class="vocab-rank-card">
          <h2>🏆 Leaderboard Status</h2>
          <p>
            ระบบแสดงเฉพาะคะแนนดีที่สุดของผู้เรียนแต่ละคนในแต่ละโหมด
            เพื่อให้อันดับของห้องเรียนไม่ซ้ำคนเดิมหลายแถว
          </p>

          <div class="vocab-rank-line">
            <div class="vocab-rank-pill">
              <small>Your Rank</small>
              <b>#${esc(rank)}</b>
            </div>

            <div class="vocab-rank-pill">
              <small>Personal Best</small>
              <b>${Number(personalBest || 0)}</b>
            </div>

            <div class="vocab-rank-pill">
              <small>Class Top</small>
              <b>${Number(classTopScore || 0)}</b>
            </div>
          </div>
        </section>

        <section class="vocab-coach-card">
          <h2>🤖 AI Coach Recommendation</h2>
          <p>
            รอบถัดไปแนะนำ:
            <b>${esc(modeLabel(coach.recommendedMode))}</b>
            •
            <b>${esc(difficultyLabel(coach.recommendedDifficulty))}</b>
          </p>
          ${renderAdvice(coach)}
        </section>

        <section class="vocab-weak-card">
          <h2>📌 Words to Review</h2>
          ${renderWeakTerms(weakTerms)}
        </section>

        <section class="vocab-reward-actions">
          <button id="vocabPlayAgainBtn" class="vocab-reward-btn" type="button">
            🔁 เล่นอีกครั้ง
          </button>

          <button id="vocabBackMenuBtn" class="vocab-reward-btn secondary" type="button">
            🏠 กลับหน้าแรก
          </button>
        </section>

        <div class="vocab-reward-note">
          บันทึกข้อมูลรอบนี้แล้ว: score, fair_score, accuracy, duration, correct/wrong, AI Help, weak terms, recommendation
        </div>
      </div>
    `;

    bindRewardButtons();
  }

  function bindRewardButtons(){
    const playAgain = $("vocabPlayAgainBtn");
    if(playAgain){
      playAgain.addEventListener("click", function(){
        if(WIN.VocabUI && typeof WIN.VocabUI.startGame === "function"){
          WIN.VocabUI.startGame();
        }else{
          location.reload();
        }
      });
    }

    const backMenu = $("vocabBackMenuBtn");
    if(backMenu){
      backMenu.addEventListener("click", function(){
        const panel = $("vocabRewardPanel");
        const menu = $("vocabMenuPanel");
        const battle = $("vocabBattlePanel");

        if(panel) panel.hidden = true;
        if(battle) battle.hidden = true;
        if(menu) menu.hidden = false;

        if(WIN.VocabUI && typeof WIN.VocabUI.renderLeaderboard === "function"){
          WIN.VocabUI.renderLeaderboard();
        }

        if(WIN.VocabLeaderboard && typeof WIN.VocabLeaderboard.render === "function"){
          WIN.VocabLeaderboard.render();
        }
      });
    }
  }

  /* =========================================================
     PUBLIC SHOW
  ========================================================= */

  function show(summaryInput){
    const summary = normalizeSummary(summaryInput || {});

    saveSummary(summary);
    updateWeakTerms(summary);

    const lbResult = updateLeaderboard(summary);

    /*
      session_end อาจถูก log แล้วจาก UI/game แต่ log ซ้ำแบบ session_end
      ยังรับได้เพราะ logger normalize และเก็บ payload ล่าสุด
      ถ้าต้องการกันซ้ำ สามารถใส่ flag ภายหลัง
    */
    logSessionEnd(summary);

    render(summary, lbResult);

    try{
      if(WIN.VocabUI && typeof WIN.VocabUI.renderLeaderboard === "function"){
        WIN.VocabUI.renderLeaderboard(summary.mode || "learn");
      }
    }catch(e){}

    log("show", summary);

    return {
      summary,
      leaderboard: lbResult
    };
  }

  function getLastSummary(){
    if(WIN.VocabStorage && typeof WIN.VocabStorage.loadLastSummary === "function"){
      try{
        return WIN.VocabStorage.loadLastSummary();
      }catch(e){}
    }

    return readJson("VOCAB_SPLIT_LAST_SUMMARY", null);
  }

  /* =========================================================
     PUBLIC API
  ========================================================= */

  const api = {
    version: VERSION,
    show,
    render,
    normalizeSummary,
    buildCoach,
    gradeSummary,
    getLastSummary
  };

  WIN.VocabReward = api;
  WIN.vocabReward = api;
  WIN.VOCAB_REWARD = api;

  WIN.VocabModules = WIN.VocabModules || {};
  WIN.VocabModules.reward = true;

  WIN.__VOCAB_MODULES__ = WIN.__VOCAB_MODULES__ || {};
  WIN.__VOCAB_MODULES__.reward = true;

  log("loaded", VERSION);
})();
