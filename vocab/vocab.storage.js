/* =========================================================
   /vocab/vocab.storage.js
   TechPath Vocab Arena — Storage / Profile / Leaderboard
   Version: 20260502c

   ต้องโหลดหลัง:
   - vocab.config.js
   - vocab.state.js
   - vocab.utils.js

   ใช้โดย:
   - vocab.ui.js
   - vocab.game.js
   - vocab.reward.js
   - vocab.logger.js
========================================================= */
(function(){
  "use strict";

  if(!window.VOCAB_APP){
    console.error("[VOCAB STORAGE] VOCAB_APP is not defined. Load vocab.config.js first.");
    window.VOCAB_APP = { storageKeys:{} };
  }

  if(!window.VocabUtils){
    console.error("[VOCAB STORAGE] VocabUtils is not defined. Load vocab.utils.js first.");
  }

  const U = window.VocabUtils || {};
  const APP = window.VOCAB_APP;

  const KEYS = Object.assign({
    profile: "VOCAB_SPLIT_PROFILE",
    leaderboard: "VOCAB_SPLIT_LEADERBOARD",
    lastSummary: "VOCAB_SPLIT_LAST_SUMMARY",
    localLogQueue: "VOCAB_SPLIT_LOG_QUEUE",
    teacherLast: "VOCAB_SPLIT_TEACHER_LAST",
    mastery: "VOCAB_SPLIT_MASTERY",
    weakTerms: "VOCAB_SPLIT_WEAK_TERMS",
    settings: "VOCAB_SPLIT_SETTINGS",
    seed: "VOCAB_SPLIT_SEED"
  }, APP.storageKeys || {});

  APP.storageKeys = KEYS;

  /* =========================================================
     RAW STORAGE
  ========================================================= */

  function canUseLocalStorage(){
    try{
      const k = "__VOCAB_STORAGE_TEST__";
      localStorage.setItem(k, "1");
      localStorage.removeItem(k);
      return true;
    }catch(e){
      return false;
    }
  }

  function readRaw(key, fallback){
    try{
      const raw = localStorage.getItem(key);
      return raw == null ? fallback : raw;
    }catch(e){
      return fallback;
    }
  }

  function writeRaw(key, value){
    try{
      localStorage.setItem(key, String(value));
      return true;
    }catch(e){
      console.warn("[VOCAB STORAGE] writeRaw failed", key, e);
      return false;
    }
  }

  function removeRaw(key){
    try{
      localStorage.removeItem(key);
      return true;
    }catch(e){
      return false;
    }
  }

  function readJson(key, fallback){
    try{
      const raw = localStorage.getItem(key);
      if(!raw) return fallback;
      return JSON.parse(raw);
    }catch(e){
      return fallback;
    }
  }

  function writeJson(key, value){
    try{
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    }catch(e){
      console.warn("[VOCAB STORAGE] writeJson failed", key, e);
      return false;
    }
  }

  function appendJsonList(key, item, maxRows){
    const list = readJson(key, []);
    const safeList = Array.isArray(list) ? list : [];

    safeList.push(item);

    const trimmed = safeList.slice(-Math.max(1, Number(maxRows || 300)));
    writeJson(key, trimmed);

    return trimmed;
  }

  function clearByPrefix(prefix){
    try{
      Object.keys(localStorage).forEach(k => {
        if(String(k).startsWith(prefix)){
          localStorage.removeItem(k);
        }
      });
      return true;
    }catch(e){
      return false;
    }
  }

  /* =========================================================
     SETTINGS
  ========================================================= */

  function defaultSettings(){
    return {
      sound: true,
      guardEnabled: true,
      showTeacherPanels: false,
      compactReward: true,
      lastBank: "A",
      lastDifficulty: "easy",
      lastMode: "learn",
      updatedAt: U.nowIso ? U.nowIso() : new Date().toISOString()
    };
  }

  function readSettings(){
    return Object.assign(defaultSettings(), readJson(KEYS.settings, {}));
  }

  function saveSettings(settings){
    const next = Object.assign(defaultSettings(), settings || {}, {
      updatedAt: U.nowIso ? U.nowIso() : new Date().toISOString()
    });

    writeJson(KEYS.settings, next);
    return next;
  }

  function setSetting(name, value){
    const settings = readSettings();
    settings[name] = value;
    return saveSettings(settings);
  }

  /* =========================================================
     STUDENT PROFILE
  ========================================================= */

  function defaultProfile(){
    return {
      display_name: "",
      student_id: "",
      section: "",
      session_code: "",
      last_bank: "A",
      last_difficulty: "easy",
      last_mode: "learn",
      last_score: 0,
      last_accuracy: 0,
      best_score: 0,
      best_accuracy: 0,
      best_combo: 0,
      total_sessions: 0,
      total_correct: 0,
      total_wrong: 0,
      total_play_sec: 0,
      coins: 0,
      xp: 0,
      level: 1,
      streak: 0,
      last_play_day: "",
      recommended_mode: "AI Training",
      recommended_difficulty: "easy",
      weak_terms_json: "[]",
      mastery_json: "{}",
      updatedAt: ""
    };
  }

  function readProfile(){
    return Object.assign(defaultProfile(), readJson(KEYS.profile, {}));
  }

  function saveProfile(profile){
    const prev = readProfile();

    const next = Object.assign({}, prev, profile || {}, {
      updatedAt: U.nowIso ? U.nowIso() : new Date().toISOString()
    });

    writeJson(KEYS.profile, next);
    return next;
  }

  function hydrateProfileFromForm(){
    const profile = readProfile();

    const setValue = (id, value) => {
      const el = document.getElementById(id);
      if(el && value != null && value !== ""){
        el.value = value;
      }
    };

    const getParam = U.getParam || function(){ return ""; };

    setValue("v63DisplayName", getParam("name", "") || getParam("nick", "") || profile.display_name);
    setValue("v63StudentId", getParam("student_id", "") || getParam("sid", "") || getParam("pid", "") || profile.student_id);
    setValue("v63Section", getParam("section", "") || profile.section);
    setValue("v63SessionCode", getParam("session_code", "") || getParam("studyId", "") || profile.session_code);

    return profile;
  }

  function readStudentFromForm(){
    if(U.getStudentContext){
      return U.getStudentContext();
    }

    const getVal = id => {
      const el = document.getElementById(id);
      return el ? String(el.value || "").trim() : "";
    };

    return {
      display_name: getVal("v63DisplayName") || "Hero",
      student_id: getVal("v63StudentId") || "anon",
      section: getVal("v63Section"),
      session_code: getVal("v63SessionCode")
    };
  }

  function saveStudentFromForm(){
    const student = readStudentFromForm();

    saveProfile({
      display_name: student.display_name,
      student_id: student.student_id,
      section: student.section,
      session_code: student.session_code
    });

    return student;
  }

  function updateProfileAfterResult(result, reward, coach){
    result = result || {};
    reward = reward || {};
    coach = coach || {};

    const profile = readProfile();
    const student = readStudentFromForm();

    const correct = Number(result.correct || 0);
    const wrong = Number(result.wrong || 0);
    const score = Number(result.score || 0);
    const accuracy = Number(result.accuracy || 0);
    const comboMax = Number(result.comboMax || result.combo_max || 0);
    const durationSec = Number(result.durationSec || result.duration_sec || 0);

    const day = U.todayKey ? U.todayKey() : new Date().toISOString().slice(0,10);
    let streak = Number(profile.streak || 0);

    if(profile.last_play_day !== day){
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yKey = yesterday.toISOString().slice(0,10);

      streak = profile.last_play_day === yKey ? streak + 1 : 1;
    }

    const totalCorrect = Number(profile.total_correct || 0) + correct;
    const totalWrong = Number(profile.total_wrong || 0) + wrong;
    const totalAnswers = totalCorrect + totalWrong;
    const overallAccuracy = totalAnswers ? Math.round((totalCorrect / totalAnswers) * 100) : 0;

    const xpGain = Math.max(10, Math.round(score / 40) + accuracy);
    const coinsGain = Math.max(5, Math.round(score / 35) + Number(reward.stars || 0) * 10);

    let xp = Number(profile.xp || 0) + xpGain;
    let level = Number(profile.level || 1);
    let need = xpNeed(level);

    while(xp >= need){
      xp -= need;
      level += 1;
      need = xpNeed(level);
    }

    const weakTerms = Array.isArray(result.weakestTerms) ? result.weakestTerms : [];

    const next = saveProfile({
      display_name: student.display_name,
      student_id: student.student_id,
      section: student.section,
      session_code: student.session_code,

      last_bank: result.bank || profile.last_bank || "A",
      last_difficulty: result.difficulty || profile.last_difficulty || "easy",
      last_mode: result.mode || profile.last_mode || "learn",

      last_score: score,
      last_accuracy: accuracy,
      last_combo_max: comboMax,
      last_duration_sec: durationSec,

      best_score: Math.max(Number(profile.best_score || 0), score),
      best_accuracy: Math.max(Number(profile.best_accuracy || 0), accuracy),
      best_combo: Math.max(Number(profile.best_combo || 0), comboMax),

      total_sessions: Number(profile.total_sessions || 0) + 1,
      total_correct: totalCorrect,
      total_wrong: totalWrong,
      total_accuracy: overallAccuracy,
      total_play_sec: Number(profile.total_play_sec || 0) + durationSec,

      coins: Number(profile.coins || 0) + coinsGain,
      xp,
      level,
      streak,
      last_play_day: day,

      recommended_mode: coach.nextMode || profile.recommended_mode || "AI Training",
      recommended_difficulty: coach.nextDifficulty || result.difficulty || profile.recommended_difficulty || "easy",

      weak_terms_json: JSON.stringify(weakTerms),
      mastery_json: JSON.stringify(buildMasterySnapshotFromResult(result)),

      last_reward_stars: Number(reward.stars || 0),
      last_reward_badge: reward.badge || "",
      last_xp_gain: xpGain,
      last_coins_gain: coinsGain
    });

    return {
      profile: next,
      xpGain,
      coinsGain,
      level,
      streak
    };
  }

  function xpNeed(level){
    level = Math.max(1, Number(level || 1));
    return 100 + (level - 1) * 45;
  }

  /* =========================================================
     LOCAL EVENT LOG QUEUE
  ========================================================= */

  function appendLocalLog(payload){
    const max = Number(APP.maxLocalLogs || 900);
    return appendJsonList(KEYS.localLogQueue, payload, max);
  }

  function readLocalLogQueue(){
    return readJson(KEYS.localLogQueue, []);
  }

  function clearLocalLogQueue(){
    return writeJson(KEYS.localLogQueue, []);
  }

  function getLocalLogCount(){
    const q = readLocalLogQueue();
    return Array.isArray(q) ? q.length : 0;
  }

  /* =========================================================
     LAST SUMMARY / REWARD DATA
  ========================================================= */

  function normalizeResult(result){
    result = result || {};

    const correct = Number(result.correct || 0);
    const wrong = Number(result.wrong || 0);
    const total = correct + wrong;
    const accuracy = result.accuracy != null
      ? Number(result.accuracy || 0)
      : (total ? Math.round((correct / total) * 100) : 0);

    return Object.assign({
      version: APP.version || "",
      sessionId: result.sessionId || result.session_id || "",
      bank: result.bank || "A",
      difficulty: result.difficulty || "easy",
      mode: result.mode || "learn",
      modeLabel: result.modeLabel || result.mode_label || "AI Training",
      reason: result.reason || "completed",

      score: Number(result.score || 0),
      correct,
      wrong,
      total,
      accuracy,

      comboMax: Number(result.comboMax || result.combo_max || 0),
      durationSec: Number(result.durationSec || result.duration_sec || 0),
      bossDefeated: !!(result.bossDefeated || result.boss_defeated),

      enemyName: result.enemyName || result.enemy_name || "",

      rank: result.rank || "",
      fairScore: Number(result.fairScore || result.fair_score || result.score || 0),
      personalBest: Number(result.personalBest || result.personal_best || result.score || 0),
      improvement: Number(result.improvement || 0),
      classTopScore: Number(result.classTopScore || result.class_top_score || result.score || 0),

      aiHelpUsed: Number(result.aiHelpUsed || result.ai_help_used || 0),
      aiHelpLeft: Number(result.aiHelpLeft || result.ai_help_left || 0),
      aiAssisted: !!(result.aiAssisted || result.ai_assisted),
      aiHelpPenalty: Number(result.aiHelpPenalty || result.ai_help_penalty || 0),

      feverCount: Number(result.feverCount || result.fever_count || result.powerStats?.feverCount || 0),
      shieldUsed: Number(result.shieldUsed || result.shield_used || result.powerStats?.shieldUsed || 0),
      hintUsed: Number(result.hintUsed || result.hint_used || result.powerStats?.hintUsed || 0),
      laserUsed: Number(result.laserUsed || result.laser_used || result.powerStats?.laserUsed || 0),

      weakestTerms: Array.isArray(result.weakestTerms) ? result.weakestTerms : [],
      stageStats: result.stageStats || result.stage_stats || {},
      powerStats: result.powerStats || result.power_stats || {}
    }, result);
  }

  function saveLastSummary(payload){
    payload = payload || {};

    const normalized = {
      savedAt: U.nowIso ? U.nowIso() : new Date().toISOString(),
      result: normalizeResult(payload.result || payload),
      reward: payload.reward || {},
      coach: payload.coach || {}
    };

    writeJson(KEYS.lastSummary, normalized);
    return normalized;
  }

  function readLastSummary(){
    return readJson(KEYS.lastSummary, null);
  }

  function clearLastSummary(){
    return removeRaw(KEYS.lastSummary);
  }

  /* =========================================================
     TEACHER SUMMARY
  ========================================================= */

  function appendTeacherSummary(result, reward, coach){
    const student = readStudentFromForm();
    const r = normalizeResult(result);
    const item = {
      saved_at: U.nowIso ? U.nowIso() : new Date().toISOString(),
      session_id: r.sessionId || "",
      display_name: student.display_name,
      student_id: student.student_id,
      section: student.section,
      session_code: student.session_code,

      bank: r.bank,
      difficulty: r.difficulty,
      mode: r.mode,
      mode_label: r.modeLabel,

      score: r.score,
      fair_score: r.fairScore,
      accuracy: r.accuracy,
      correct: r.correct,
      wrong: r.wrong,
      combo_max: r.comboMax,
      duration_sec: r.durationSec,

      boss_defeated: r.bossDefeated ? 1 : 0,
      ai_help_used: r.aiHelpUsed,
      ai_assisted: r.aiAssisted ? 1 : 0,

      stars: Number(reward?.stars || 0),
      badge: reward?.badge || "",

      ai_next_mode: coach?.nextMode || "",
      ai_next_difficulty: coach?.nextDifficulty || "",
      ai_reason: coach?.reason || coach?.headline || "",

      weakest_terms: r.weakestTerms,
      stage_stats: r.stageStats,
      power_stats: r.powerStats
    };

    return appendJsonList(KEYS.teacherLast, item, 250);
  }

  function readTeacherSummaries(){
    return readJson(KEYS.teacherLast, []);
  }

  /* =========================================================
     LEADERBOARD
  ========================================================= */

  function defaultLeaderboard(){
    return {
      learn: [],
      speed: [],
      mission: [],
      battle: [],
      bossrush: []
    };
  }

  function readLeaderboard(){
    return Object.assign(defaultLeaderboard(), readJson(KEYS.leaderboard, {}));
  }

  function saveLeaderboard(board){
    const merged = Object.assign(defaultLeaderboard(), board || {});
    writeJson(KEYS.leaderboard, merged);
    return merged;
  }

  function modeFromResult(result){
    return String(result?.mode || APP.selectedMode || "learn").toLowerCase();
  }

  function assistedScore(score, aiAssisted){
    const multiplier = Number(APP.leaderboardAssistedMultiplier || 0.95);
    return aiAssisted ? Math.round(Number(score || 0) * multiplier) : Number(score || 0);
  }

  function updateLeaderboard(result, reward){
    const r = normalizeResult(result);
    const student = readStudentFromForm();
    const board = readLeaderboard();
    const mode = modeFromResult(r);

    if(!board[mode]) board[mode] = [];

    const fairScore = assistedScore(r.score, r.aiAssisted);

    const sessionId =
      r.sessionId ||
      (window.vocabGame && window.vocabGame.sessionId) ||
      `vocab_${Date.now()}_${Math.random().toString(16).slice(2)}`;

    const previousPersonalBest = board[mode]
      .filter(x => String(x.student_id || "") === String(student.student_id || "anon"))
      .reduce((best, x) => Math.max(best, Number(x.fair_score || x.score || 0)), 0);

    const entry = {
      id: `${student.student_id || "anon"}_${mode}_${Date.now()}`,
      session_id: sessionId,
      timestamp: U.nowIso ? U.nowIso() : new Date().toISOString(),

      display_name: student.display_name || "Hero",
      student_id: student.student_id || "anon",
      section: student.section || "",
      session_code: student.session_code || "",

      bank: r.bank,
      difficulty: r.difficulty,
      mode: r.mode,
      mode_label: r.modeLabel,

      score: r.score,
      fair_score: fairScore,
      accuracy: r.accuracy,
      combo_max: r.comboMax,
      boss_defeated: r.bossDefeated ? 1 : 0,

      stars: Number(reward?.stars || 0),
      badge: reward?.badge || "",

      ai_assisted: r.aiAssisted ? 1 : 0,
      ai_help_used: r.aiHelpUsed
    };

    board[mode].push(entry);

    board[mode].sort((a,b) => {
      const scoreDiff = Number(b.fair_score || b.score || 0) - Number(a.fair_score || a.score || 0);
      if(scoreDiff !== 0) return scoreDiff;

      const accDiff = Number(b.accuracy || 0) - Number(a.accuracy || 0);
      if(accDiff !== 0) return accDiff;

      return Number(b.combo_max || 0) - Number(a.combo_max || 0);
    });

    const maxRows = Number(APP.leaderboardMaxRows || 50);
    board[mode] = board[mode].slice(0, maxRows);

    saveLeaderboard(board);

    const rank = board[mode].findIndex(x => x.session_id === sessionId) + 1;
    const personalBest = Math.max(previousPersonalBest, fairScore);
    const improvement = previousPersonalBest ? fairScore - previousPersonalBest : fairScore;
    const classTopScore = board[mode][0]
      ? Number(board[mode][0].fair_score || board[mode][0].score || 0)
      : fairScore;

    return {
      entry,
      mode,
      rank,
      fairScore,
      personalBest,
      improvement,
      classTopScore,
      rows: board[mode]
    };
  }

  function getLeaderboardRows(mode, limit){
    const board = readLeaderboard();
    mode = String(mode || APP.selectedMode || "learn").toLowerCase();

    return (board[mode] || []).slice(0, Number(limit || APP.leaderboardShowTop || 5));
  }

  function getPersonalBest(mode, studentId){
    const board = readLeaderboard();
    mode = String(mode || APP.selectedMode || "learn").toLowerCase();
    studentId = String(studentId || readStudentFromForm().student_id || "anon");

    const rows = board[mode] || [];
    const personalRows = rows.filter(r => String(r.student_id || "") === studentId);

    if(!personalRows.length){
      return {
        score: 0,
        rank: "",
        row: null
      };
    }

    const best = personalRows.reduce((a,b) => {
      return Number(a.fair_score || a.score || 0) >= Number(b.fair_score || b.score || 0) ? a : b;
    });

    const rank = rows.findIndex(r => r.session_id === best.session_id) + 1;

    return {
      score: Number(best.fair_score || best.score || 0),
      rank: rank || "",
      row: best
    };
  }

  function clearLeaderboard(){
    return saveLeaderboard(defaultLeaderboard());
  }

  /* =========================================================
     MASTERY / WEAK TERMS
  ========================================================= */

  function defaultMastery(){
    return {
      terms: {},
      daily: {},
      updatedAt: ""
    };
  }

  function readMastery(){
    return Object.assign(defaultMastery(), readJson(KEYS.mastery, {}));
  }

  function saveMastery(mastery){
    const next = Object.assign(defaultMastery(), mastery || {}, {
      updatedAt: U.nowIso ? U.nowIso() : new Date().toISOString()
    });

    writeJson(KEYS.mastery, next);
    return next;
  }

  function termKey(term){
    if(U.termKey) return U.termKey(term);
    return String(term || "").trim().toLowerCase();
  }

  function ensureTermMastery(mastery, term, meta){
    const key = termKey(term);
    if(!key) return null;

    if(!mastery.terms[key]){
      mastery.terms[key] = {
        term: String(term || ""),
        meaning: meta?.meaning || "",
        bank: meta?.bank || "",
        seen: 0,
        correct: 0,
        wrong: 0,
        streak: 0,
        missStreak: 0,
        avgMs: 0,
        aiHelp: 0,
        lastSeen: "",
        masteryScore: 0,
        level: "New",
        stages: {},
        modes: {}
      };
    }

    if(meta?.meaning && !mastery.terms[key].meaning){
      mastery.terms[key].meaning = meta.meaning;
    }

    if(meta?.bank && !mastery.terms[key].bank){
      mastery.terms[key].bank = meta.bank;
    }

    return mastery.terms[key];
  }

  function masteryLevel(rec){
    const seen = Number(rec?.seen || 0);
    const correct = Number(rec?.correct || 0);
    const wrong = Number(rec?.wrong || 0);
    const streak = Number(rec?.streak || 0);

    if(!seen){
      return { label:"New", score:0, icon:"🌱" };
    }

    const acc = correct / Math.max(1, seen);
    let score = Math.round(acc * 70 + Math.min(20, streak * 5) - Math.min(20, wrong * 4));
    score = Math.max(0, Math.min(100, score));

    if(score >= 88 && seen >= 3) return { label:"Mastered", score, icon:"🏆" };
    if(score >= 68) return { label:"Strong", score, icon:"💪" };
    if(score >= 42) return { label:"Learning", score, icon:"📘" };
    return { label:"Weak", score, icon:"🧩" };
  }

  function updateMasteryFromAnswer(answer){
    answer = answer || {};

    const term = answer.term || answer.term_id || answer.correct_term || "";
    if(!term) return readMastery();

    const mastery = readMastery();
    const rec = ensureTermMastery(mastery, term, {
      meaning: answer.meaning || "",
      bank: answer.bank || ""
    });

    if(!rec) return mastery;

    const ok =
      answer.is_correct === true ||
      answer.is_correct === 1 ||
      String(answer.is_correct) === "1" ||
      String(answer.correct) === "true";

    const ms = Number(answer.response_ms || answer.responseMs || 0);
    const stage = answer.stage_id || answer.stage || "unknown";
    const mode = answer.mode || APP.selectedMode || "unknown";

    rec.seen += 1;
    rec.lastSeen = U.nowIso ? U.nowIso() : new Date().toISOString();
    rec.avgMs = rec.seen <= 1
      ? ms
      : Math.round((Number(rec.avgMs || 0) * (rec.seen - 1) + ms) / rec.seen);

    if(ok){
      rec.correct += 1;
      rec.streak += 1;
      rec.missStreak = 0;
    }else{
      rec.wrong += 1;
      rec.streak = 0;
      rec.missStreak += 1;
    }

    rec.stages[stage] = Number(rec.stages[stage] || 0) + 1;
    rec.modes[mode] = Number(rec.modes[mode] || 0) + 1;

    if(Number(answer.ai_help_used_on_question || 0)){
      rec.aiHelp += 1;
    }

    const level = masteryLevel(rec);
    rec.level = level.label;
    rec.masteryScore = level.score;

    const day = U.todayKey ? U.todayKey() : new Date().toISOString().slice(0,10);

    if(!mastery.daily[day]){
      mastery.daily[day] = { answers:0, correct:0, wrong:0, weakPracticed:0 };
    }

    mastery.daily[day].answers += 1;

    if(ok) mastery.daily[day].correct += 1;
    else mastery.daily[day].wrong += 1;

    saveMastery(mastery);
    updateWeakTermsFromMastery(mastery);

    return mastery;
  }

  function buildMasterySnapshotFromResult(result){
    const stageStats = result?.stageStats || {};
    const out = {};

    Object.entries(stageStats).forEach(([stageId, stat]) => {
      const correct = Number(stat.correct || 0);
      const wrong = Number(stat.wrong || 0);
      const total = correct + wrong;

      out[stageId] = {
        correct,
        wrong,
        accuracy: total ? Math.round((correct / total) * 100) : 0,
        avg_response_ms: stat.count
          ? Math.round(Number(stat.responseMsTotal || 0) / Number(stat.count || 1))
          : 0
      };
    });

    return out;
  }

  function updateWeakTermsFromMastery(mastery){
    mastery = mastery || readMastery();

    const rows = Object.values(mastery.terms || {})
      .map(rec => {
        const level = masteryLevel(rec);
        const weakScore =
          Number(rec.wrong || 0) * 20 +
          Number(rec.missStreak || 0) * 15 +
          Number(rec.aiHelp || 0) * 5 +
          (100 - level.score);

        return Object.assign({}, rec, {
          level: level.label,
          masteryScore: level.score,
          weakScore
        });
      })
      .sort((a,b) => Number(b.weakScore || 0) - Number(a.weakScore || 0))
      .slice(0, 30);

    writeJson(KEYS.weakTerms, rows);
    return rows;
  }

  function readWeakTerms(limit){
    const rows = readJson(KEYS.weakTerms, []);
    return (Array.isArray(rows) ? rows : []).slice(0, Number(limit || 10));
  }

  function clearMastery(){
    writeJson(KEYS.mastery, defaultMastery());
    writeJson(KEYS.weakTerms, []);
  }

  /* =========================================================
     RESET / EXPORT
  ========================================================= */

  function resetAllLocalData(){
    [
      KEYS.profile,
      KEYS.leaderboard,
      KEYS.lastSummary,
      KEYS.localLogQueue,
      KEYS.teacherLast,
      KEYS.mastery,
      KEYS.weakTerms,
      KEYS.settings,
      KEYS.seed
    ].forEach(removeRaw);

    clearByPrefix("VOCAB_V71_TERM_HISTORY_");
    clearByPrefix("VOCAB_V75_WEEK_");
  }

  function exportLocalData(){
    return {
      exportedAt: U.nowIso ? U.nowIso() : new Date().toISOString(),
      version: APP.version || "",
      profile: readProfile(),
      settings: readSettings(),
      leaderboard: readLeaderboard(),
      lastSummary: readLastSummary(),
      teacherSummaries: readTeacherSummaries(),
      mastery: readMastery(),
      weakTerms: readWeakTerms(50),
      localLogQueue: readLocalLogQueue()
    };
  }

  /* =========================================================
     EXPORT
  ========================================================= */

  window.VocabStorage = {
    keys: KEYS,

    canUseLocalStorage,
    readRaw,
    writeRaw,
    removeRaw,
    readJson,
    writeJson,
    appendJsonList,
    clearByPrefix,

    readSettings,
    saveSettings,
    setSetting,

    readProfile,
    saveProfile,
    hydrateProfileFromForm,
    readStudentFromForm,
    saveStudentFromForm,
    updateProfileAfterResult,
    xpNeed,

    appendLocalLog,
    readLocalLogQueue,
    clearLocalLogQueue,
    getLocalLogCount,

    normalizeResult,
    saveLastSummary,
    readLastSummary,
    clearLastSummary,

    appendTeacherSummary,
    readTeacherSummaries,

    readLeaderboard,
    saveLeaderboard,
    updateLeaderboard,
    getLeaderboardRows,
    getPersonalBest,
    clearLeaderboard,

    readMastery,
    saveMastery,
    updateMasteryFromAnswer,
    buildMasterySnapshotFromResult,
    updateWeakTermsFromMastery,
    readWeakTerms,
    clearMastery,
    masteryLevel,

    resetAllLocalData,
    exportLocalData
  };

  /*
    Backward compatibility names
  */
  window.readJsonV63 = readJson;
  window.saveStudentContextV63 = saveStudentFromForm;
  window.getStudentContextV63 = readStudentFromForm;
  window.saveLastVocabSummaryV6 = function(payload){
    return saveLastSummary(payload || {});
  };
  window.readLastVocabSummaryV6 = readLastSummary;

  console.log("[VOCAB STORAGE] loaded");
})();
