/* =========================================================
   /vocab/vocab.final-qa.js
   TechPath Vocab Arena — Final QA / Production Hardening
   FULL FINAL PATCH: v20260503r2

   r2 changes:
   - Silent QA only: never show QA panel automatically
   - Do not auto-flush old local queue on startup / online
   - Add archiveAndClearQueue(reason)
   - Keep manual tools:
       VocabFinalQA.getLastReport()
       VocabFinalQA.showQaPanel()
       VocabFinalQA.flushQueue(25)
       VocabFinalQA.archiveAndClearQueue("reason")
========================================================= */

(function(){
  "use strict";

  var WIN = window;
  var DOC = document;
  var VERSION = "vocab-final-qa-v20260503r2";

  var MODES = ["learn", "speed", "mission", "battle"];
  var DIFFICULTIES = ["easy", "normal", "hard", "challenge"];
  var BANKS = ["A", "B", "C"];

  var EXIT_SENT = false;
  var LAST_REPORT = null;

  function $(id){
    return DOC.getElementById(id);
  }

  function qs(sel, root){
    return (root || DOC).querySelector(sel);
  }

  function log(){
    try{
      console.log.apply(console, ["[VOCAB FINAL QA]"].concat(Array.prototype.slice.call(arguments)));
    }catch(e){}
  }

  function warn(){
    try{
      console.warn.apply(console, ["[VOCAB FINAL QA]"].concat(Array.prototype.slice.call(arguments)));
    }catch(e){}
  }

  function clean(v){
    return String(v == null ? "" : v).trim();
  }

  function lower(v){
    return clean(v).toLowerCase();
  }

  function num(v, fallback){
    var n = Number(v);
    return Number.isFinite(n) ? n : Number(fallback || 0);
  }

  function int(v, fallback){
    var n = parseInt(v, 10);
    return Number.isFinite(n) ? n : Number(fallback || 0);
  }

  function pick(){
    for(var i = 0; i < arguments.length; i++){
      var v = arguments[i];
      if(v !== undefined && v !== null && v !== "") return v;
    }
    return "";
  }

  function esc(s){
    if(WIN.VocabUtils && typeof WIN.VocabUtils.escapeHtml === "function"){
      return WIN.VocabUtils.escapeHtml(s);
    }

    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function readJson(key, fallback){
    try{
      var raw = localStorage.getItem(key);
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
      warn("writeJson failed", key, e);
      return false;
    }
  }

  function getParam(name, fallback){
    try{
      var p = new URLSearchParams(location.search);
      return p.get(name) || fallback || "";
    }catch(e){
      return fallback || "";
    }
  }

  function nowIso(){
    try{
      return new Date().toISOString();
    }catch(e){
      return "";
    }
  }

  function bangkokIsoNow(){
    try{
      var ms = Date.now() + (7 * 60 * 60 * 1000);
      return new Date(ms).toISOString().replace("Z", "+07:00");
    }catch(e){
      return nowIso();
    }
  }

  function getEndpoint(){
    var app = WIN.VOCAB_APP || WIN.VocabConfig || WIN.VOCAB_CONFIG || {};
    return (
      getParam("api") ||
      getParam("endpoint") ||
      app.endpoint ||
      app.sheetEndpoint ||
      app.apiEndpoint ||
      app.vocabEndpoint ||
      WIN.VOCAB_SHEET_ENDPOINT ||
      ""
    );
  }

  function normalizeMode(mode){
    mode = lower(mode || "learn");
    if(mode === "ai" || mode === "training" || mode === "ai_training") return "learn";
    if(mode === "debug" || mode === "debug_mission") return "mission";
    if(mode === "boss" || mode === "boss_battle") return "battle";
    if(MODES.indexOf(mode) >= 0) return mode;
    return "learn";
  }

  function normalizeDifficulty(diff){
    diff = lower(diff || "normal");
    if(DIFFICULTIES.indexOf(diff) >= 0) return diff;
    return "normal";
  }

  function displayMode(mode){
    mode = normalizeMode(mode);
    return {
      learn: "AI Training",
      speed: "Speed Run",
      mission: "Debug Mission",
      battle: "Boss Battle"
    }[mode] || "AI Training";
  }

  function modeIcon(mode){
    mode = normalizeMode(mode);
    return {
      learn: "🤖",
      speed: "⚡",
      mission: "🎯",
      battle: "👾"
    }[mode] || "🤖";
  }

  function getProfile(){
    if(WIN.VocabStorage && typeof WIN.VocabStorage.loadStudentProfile === "function"){
      try{
        return WIN.VocabStorage.loadStudentProfile() || {};
      }catch(e){}
    }

    var saved =
      readJson("VOCAB_SPLIT_STUDENT_PROFILE", {}) ||
      readJson("VOCAB_V71_STUDENT_PROFILE", {}) ||
      {};

    return {
      display_name: pick(saved.display_name, saved.displayName, getParam("name"), getParam("nick"), "Hero"),
      student_id: pick(saved.student_id, saved.studentId, getParam("student_id"), getParam("sid"), getParam("pid"), "anon"),
      section: pick(saved.section, getParam("section"), ""),
      session_code: pick(saved.session_code, saved.sessionCode, getParam("session_code"), getParam("studyId"), "")
    };
  }

  function getState(){
    try{
      if(WIN.VocabState && typeof WIN.VocabState.get === "function"){
        return WIN.VocabState.get() || {};
      }
    }catch(e){}

    try{
      if(WIN.VocabState && WIN.VocabState.state){
        return WIN.VocabState.state || {};
      }
    }catch(e){}

    return WIN.VOCAB_APP || {};
  }

  function getGame(){
    return WIN.VocabGame || WIN.vocabGame || WIN.VOCAB_GAME || {};
  }

  function getGameData(){
    var g = getGame();
    var s = getState();
    var app = WIN.VOCAB_APP || {};
    return Object.assign({}, app, s, g || {});
  }

  function getStudentKey(row){
    row = row || {};

    var sid = clean(pick(row.student_id, row.studentId, row.sid, ""));
    var name = lower(pick(row.display_name, row.displayName, row.name, "Hero"));
    var section = lower(pick(row.section, row.class_section, row.classSection, ""));

    if(sid && sid !== "anon") return "sid:" + sid;
    return "name:" + name + "|section:" + section;
  }

  function compactLeaderboardRows(rows){
    rows = Array.isArray(rows) ? rows : [];

    var map = Object.create(null);

    rows.forEach(function(row){
      row = row || {};
      var key = getStudentKey(row);
      var current = map[key];

      var newScore = num(pick(row.fair_score, row.fairScore, row.score, 0), 0);
      var oldScore = current
        ? num(pick(current.fair_score, current.fairScore, current.score, 0), 0)
        : -Infinity;

      var newAcc = num(row.accuracy, 0);
      var oldAcc = current ? num(current.accuracy, 0) : -Infinity;

      var newCombo = num(pick(row.combo_max, row.comboMax, row.max_combo, 0), 0);
      var oldCombo = current ? num(pick(current.combo_max, current.comboMax, current.max_combo, 0), 0) : -Infinity;

      var better = false;

      if(!current) better = true;
      else if(newScore > oldScore) better = true;
      else if(newScore === oldScore && newAcc > oldAcc) better = true;
      else if(newScore === oldScore && newAcc === oldAcc && newCombo > oldCombo) better = true;
      else if(
        newScore === oldScore &&
        newAcc === oldAcc &&
        newCombo === oldCombo &&
        String(row.timestamp || "") >= String(current.timestamp || "")
      ){
        better = true;
      }

      if(better){
        row.attempts = current ? int(current.attempts, 1) + 1 : int(row.attempts, 1);
        row.best_saved_at = row.best_saved_at || bangkokIsoNow();
        map[key] = row;
      }else if(current){
        current.attempts = int(current.attempts, 1) + 1;
        map[key] = current;
      }
    });

    return Object.keys(map).map(function(k){
      return map[k];
    }).sort(function(a, b){
      var s =
        num(pick(b.fair_score, b.fairScore, b.score, 0), 0) -
        num(pick(a.fair_score, a.fairScore, a.score, 0), 0);

      if(s !== 0) return s;

      var acc = num(b.accuracy, 0) - num(a.accuracy, 0);
      if(acc !== 0) return acc;

      return String(b.timestamp || "").localeCompare(String(a.timestamp || ""));
    });
  }

  function compactLeaderboardNow(){
    if(WIN.VocabStorage && typeof WIN.VocabStorage.compactLeaderboardNow === "function"){
      try{
        return WIN.VocabStorage.compactLeaderboardNow();
      }catch(e){
        warn("native compactLeaderboardNow failed", e);
      }
    }

    var key = "VOCAB_SPLIT_LEADERBOARD";
    var board = readJson(key, null) || readJson("VOCAB_V71_LEADERBOARD", null) || {};
    var out = { learn: [], speed: [], mission: [], battle: [], bossrush: [] };

    Object.keys(out).forEach(function(mode){
      out[mode] = compactLeaderboardRows(Array.isArray(board[mode]) ? board[mode] : []).slice(0, 50);
    });

    writeJson(key, out);
    writeJson("VOCAB_V71_LEADERBOARD", out);

    return out;
  }

  function getWeakTerms(result){
    result = result || {};

    if(Array.isArray(result.weakestTerms) && result.weakestTerms.length){
      return result.weakestTerms.map(function(x){
        if(typeof x === "string") return { term: x, count: 1 };
        return {
          term: clean(pick(x.term, x.word, x.name, "")),
          count: int(pick(x.count, x.mistakes, x.wrong, 1), 1)
        };
      }).filter(function(x){
        return !!x.term;
      });
    }

    var map = Object.create(null);
    var mistakes = Array.isArray(result.mistakes) ? result.mistakes : [];

    mistakes.forEach(function(m){
      var term = clean(pick(m.term, m.word, m.question_term, ""));
      if(!term) return;
      map[term] = (map[term] || 0) + 1;
    });

    return Object.keys(map).map(function(term){
      return { term: term, count: map[term] };
    }).sort(function(a, b){
      return b.count - a.count;
    });
  }

  function normalizeResult(result){
    result = Object.assign({}, result || {});

    var g = getGameData();
    var profile = getProfile();

    result.bank = clean(pick(result.bank, g.bank, g.selectedBank, "A")).toUpperCase();
    result.mode = normalizeMode(pick(result.mode, g.mode, g.selectedMode, "learn"));
    result.modeLabel = pick(result.modeLabel, displayMode(result.mode));
    result.difficulty = normalizeDifficulty(
      pick(result.difficulty, result.diff, g.difficulty, g.diff, g.selectedDifficulty, "normal")
    );
    result.diff = result.difficulty;

    result.display_name = clean(pick(result.display_name, result.displayName, profile.display_name, "Hero"));
    result.displayName = result.display_name;

    result.student_id = clean(pick(result.student_id, result.studentId, profile.student_id, "anon"));
    result.studentId = result.student_id;

    result.section = clean(pick(result.section, profile.section, ""));
    result.session_code = clean(pick(result.session_code, result.sessionCode, profile.session_code, ""));

    result.score = num(pick(result.score, g.score, 0), 0);
    result.raw_score = num(pick(result.raw_score, result.rawScore, result.score), result.score);

    result.aiHelpUsed = int(
      pick(result.aiHelpUsed, result.ai_help_used, g.aiHelpUsed, g.powerStats && g.powerStats.aiHelpUsed, 0),
      0
    );
    result.ai_help_used = result.aiHelpUsed;

    result.ai_assisted = result.aiHelpUsed > 0
      ? 1
      : int(pick(result.ai_assisted, result.aiAssisted, 0), 0);

    result.aiAssisted = result.ai_assisted;

    result.fair_score = num(
      pick(
        result.fair_score,
        result.fairScore,
        result.aiHelpUsed > 0 ? Math.round(result.score * 0.95) : result.score
      ),
      result.score
    );
    result.fairScore = result.fair_score;

    result.correctCount = int(pick(result.correctCount, result.correct_count, g.correct, g.correctCount, 0), 0);
    result.wrongCount = int(pick(result.wrongCount, result.wrong_count, g.wrong, g.wrongCount, 0), 0);

    result.correct_count = result.correctCount;
    result.wrong_count = result.wrongCount;

    result.mistakes = Array.isArray(result.mistakes)
      ? result.mistakes
      : (Array.isArray(g.mistakes) ? g.mistakes : []);

    result.mistakes_count = int(
      pick(result.mistakes_count, result.mistakesCount, result.wrongCount, result.mistakes.length, 0),
      0
    );

    var total = int(
      pick(
        result.questionCount,
        result.question_count,
        result.totalQuestions,
        g.globalQuestionIndex,
        result.correctCount + result.wrongCount,
        0
      ),
      0
    );

    result.questionCount = total;
    result.question_count = total;

    if(result.accuracy === undefined || result.accuracy === null || result.accuracy === ""){
      var answered = result.correctCount + result.wrongCount;
      result.accuracy = answered > 0 ? Math.round((result.correctCount / answered) * 100) : 0;
    }else{
      result.accuracy = Math.round(num(result.accuracy, 0));
    }

    result.comboMax = int(pick(result.comboMax, result.combo_max, g.comboMax, g.combo_max, 0), 0);
    result.combo_max = result.comboMax;

    result.weakestTerms = getWeakTerms(result).slice(0, 8);
    result.weakest_term = result.weakestTerms.length
      ? result.weakestTerms[0].term
      : clean(pick(result.weakest_term, result.weakestTerm, ""));

    result.weakestTerm = result.weakest_term;

    result.timestamp = clean(pick(result.timestamp, result.ended_at, result.endedAt, bangkokIsoNow()));
    result.ended_at = clean(pick(result.ended_at, result.endedAt, bangkokIsoNow()));
    result.client_ts = bangkokIsoNow();

    return result;
  }

  function recommendNext(result){
    result = normalizeResult(result || {});

    var acc = num(result.accuracy, 0);
    var mistakes = int(pick(result.mistakes_count, result.wrongCount, result.wrong_count, 0), 0);
    var mode = normalizeMode(result.mode);
    var diff = normalizeDifficulty(result.difficulty);
    var weakCount = result.weakestTerms ? result.weakestTerms.length : 0;
    var aiHelp = int(pick(result.aiHelpUsed, result.ai_help_used, 0), 0);

    var nextMode = "learn";
    var nextDifficulty = diff;
    var headline = "ทำได้ดีแล้ว รอบต่อไปโฟกัสความแม่นและรักษา Combo ให้ยาวขึ้น";
    var reason = "balanced_next_step";

    if(acc >= 92 && mistakes <= 1 && aiHelp === 0){
      nextMode = mode === "battle" ? "battle" : (mode === "mission" ? "battle" : "mission");

      if(diff === "easy") nextDifficulty = "normal";
      else if(diff === "normal") nextDifficulty = "hard";
      else nextDifficulty = "challenge";

      headline = "ยอดเยี่ยมมาก! พร้อมขยับไปภารกิจที่ยากขึ้นแล้ว";
      reason = "high_accuracy_no_help";
    }else if(acc >= 80){
      nextMode = mode === "learn" ? "speed" : (mode === "speed" ? "mission" : "battle");
      nextDifficulty = diff === "easy" ? "normal" : diff;
      headline = "พื้นฐานเริ่มแน่นแล้ว รอบต่อไปเพิ่มความเร็วหรือบริบทจริง";
      reason = "good_accuracy_progress";
    }else if(acc >= 65){
      nextMode = weakCount >= 3 ? "learn" : "speed";
      nextDifficulty = diff;
      headline = "ใกล้ผ่านระดับนี้แล้ว ทบทวนคำที่พลาดก่อนเพิ่มความยาก";
      reason = "medium_accuracy_review";
    }else{
      nextMode = "learn";
      nextDifficulty = "easy";
      headline = "ควรกลับไป AI Training เพื่อทบทวนคำสำคัญก่อน";
      reason = "needs_foundation_review";
    }

    var review = (result.weakestTerms || []).slice(0, 4).map(function(x){
      return x.term;
    }).filter(Boolean);

    return {
      nextMode: nextMode,
      nextModeLabel: displayMode(nextMode),
      nextModeIcon: modeIcon(nextMode),
      nextDifficulty: nextDifficulty,
      headline: headline,
      reason: reason,
      reviewTerms: review,
      ai_recommended_mode: nextMode,
      ai_recommended_difficulty: nextDifficulty,
      ai_reason: reason
    };
  }

  function saveFinalSummary(result, recommendation){
    var payload = {
      saved_at: bangkokIsoNow(),
      version: VERSION,
      result: result || {},
      recommendation: recommendation || {}
    };

    writeJson("VOCAB_FINAL_LAST_SUMMARY", payload);

    if(WIN.VocabStorage && typeof WIN.VocabStorage.saveLastSummary === "function"){
      try{
        WIN.VocabStorage.saveLastSummary(payload);
      }catch(e){}
    }

    return payload;
  }

  function loggerLog(action, data){
    var logger = WIN.VocabLogger || WIN.vocabLogger || null;
    data = data || {};

    try{
      if(logger && typeof logger.log === "function"){
        logger.log(action, data);
        return true;
      }

      if(logger && typeof logger.logEvent === "function"){
        logger.logEvent(action, data);
        return true;
      }

      if(typeof WIN.logVocabEventV6 === "function"){
        WIN.logVocabEventV6(action, data);
        return true;
      }
    }catch(e){
      warn("loggerLog failed", action, e);
    }

    return false;
  }

  function logRecommendationOnce(result, rec){
    var key = [
      "VOCAB_FINAL_AI_REC",
      pick(result.session_id, result.sessionId, "no-session"),
      result.bank,
      result.mode,
      result.difficulty,
      result.score,
      result.accuracy
    ].join("|");

    try{
      if(sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    }catch(e){}

    loggerLog("ai_recommendation", {
      session_id: pick(result.session_id, result.sessionId, ""),
      bank: result.bank,
      mode: result.mode,
      difficulty: result.difficulty,
      score: result.score,
      fair_score: result.fair_score,
      accuracy: result.accuracy,
      mistakes: result.mistakes_count,
      weakest_term: result.weakest_term,
      ai_help_used: result.aiHelpUsed,
      ai_recommended_mode: rec.nextMode,
      ai_recommended_difficulty: rec.nextDifficulty,
      ai_reason: rec.reason,
      extra_json: JSON.stringify({
        version: VERSION,
        recommendation: rec
      })
    });
  }

  function injectFinalCoach(result, rec){
    var panel = $("vocabRewardPanel") || $("v6RewardPanel");
    if(!panel || $("vocabFinalCoachBox")) return;

    var box = DOC.createElement("section");
    box.id = "vocabFinalCoachBox";
    box.className = "vocab-final-coach-box";

    var review = rec.reviewTerms && rec.reviewTerms.length
      ? rec.reviewTerms.join(" • ")
      : "ยังไม่พบคำที่ต้องทบทวนเป็นพิเศษ";

    box.innerHTML = [
      '<h3>✅ Final QA Coach</h3>',
      '<p><b>รอบต่อไป:</b> ' + esc(rec.nextModeIcon + " " + rec.nextModeLabel + " • " + rec.nextDifficulty) + '</p>',
      '<p><b>เหตุผล:</b> ' + esc(rec.headline) + '</p>',
      '<p><b>คำที่ควรทบทวน:</b> ' + esc(review) + '</p>',
      '<p class="vocab-final-muted">ระบบบันทึกคำแนะนำนี้ไว้ใน summary/log เพื่อให้ teacher dashboard วิเคราะห์ต่อได้</p>'
    ].join("");

    var card = qs(".vocab-reward-card", panel) || panel.firstElementChild || panel;
    card.appendChild(box);
  }

  function patchReward(){
    var Reward = WIN.VocabReward || WIN.VOCAB_REWARD;
    if(!Reward || typeof Reward.render !== "function" || Reward.__vocabFinalQaPatched) return false;

    var originalRender = Reward.render;

    Reward.render = function(result, reward, coach){
      result = normalizeResult(result || {});
      var rec = recommendNext(result);

      result.ai_recommended_mode = rec.nextMode;
      result.aiRecommendedMode = rec.nextMode;
      result.ai_recommended_difficulty = rec.nextDifficulty;
      result.aiRecommendedDifficulty = rec.nextDifficulty;
      result.ai_reason = rec.reason;
      result.aiReason = rec.reason;

      var mergedCoach = Object.assign({}, coach || {}, {
        headline: (coach && coach.headline) || rec.headline,
        nextMode: rec.nextModeLabel,
        nextDifficulty: rec.nextDifficulty,
        reason: rec.reason,
        reviewTerms: rec.reviewTerms
      });

      saveFinalSummary(result, rec);
      logRecommendationOnce(result, rec);

      var out = originalRender.call(this, result, reward, mergedCoach);

      setTimeout(function(){
        injectFinalCoach(result, rec);
      }, 30);

      return out;
    };

    Reward.__vocabFinalQaPatched = true;
    WIN.VocabReward = Reward;
    WIN.VOCAB_REWARD = Reward;

    return true;
  }

  function readQueue(){
    if(WIN.VocabStorage && typeof WIN.VocabStorage.readLocalQueue === "function"){
      try{
        return WIN.VocabStorage.readLocalQueue() || [];
      }catch(e){}
    }

    return readJson("VOCAB_SPLIT_LOG_QUEUE", []) || [];
  }

  function saveQueue(queue){
    queue = Array.isArray(queue) ? queue : [];

    if(WIN.VocabStorage && typeof WIN.VocabStorage.saveLocalQueue === "function"){
      try{
        WIN.VocabStorage.saveLocalQueue(queue);
        return true;
      }catch(e){}
    }

    return writeJson("VOCAB_SPLIT_LOG_QUEUE", queue);
  }

  function archiveAndClearQueue(reason){
    var queue = readQueue();

    var payload = {
      archived_at: bangkokIsoNow(),
      reason: reason || "manual_archive",
      count: Array.isArray(queue) ? queue.length : 0,
      queue: Array.isArray(queue) ? queue : []
    };

    try{
      localStorage.setItem(
        "VOCAB_ARCHIVED_LOG_QUEUE_" + Date.now(),
        JSON.stringify(payload)
      );
    }catch(e){
      warn("archive queue failed", e);
    }

    saveQueue([]);

    return {
      ok: true,
      archived: payload.count,
      reason: payload.reason
    };
  }

  function normalizeQueuedPayload(item){
    if(!item) return null;
    if(item.payload && typeof item.payload === "object") return item.payload;
    if(item.action || item.event_type || item.eventType) return item;
    return null;
  }

  async function flushQueue(limit){
    limit = Math.max(1, int(limit, 25));

    var endpoint = getEndpoint();
    var queue = readQueue();

    if(!endpoint || !queue.length){
      return {
        ok: true,
        sent: 0,
        remaining: queue.length,
        reason: !endpoint ? "missing_endpoint" : "empty"
      };
    }

    var sent = 0;
    var remaining = [];

    for(var i = 0; i < queue.length; i++){
      var item = queue[i];
      var payload = normalizeQueuedPayload(item);

      if(!payload) continue;

      if(sent >= limit){
        remaining.push(item);
        continue;
      }

      try{
        var res = await fetch(endpoint, {
          method: "POST",
          mode: "cors",
          cache: "no-store",
          headers: {
            "Content-Type": "text/plain;charset=utf-8"
          },
          body: JSON.stringify(payload)
        });

        if(res.ok){
          sent += 1;
        }else{
          remaining.push(item);
        }
      }catch(e){
        remaining.push(item);
      }
    }

    saveQueue(remaining);

    return {
      ok: remaining.length === 0,
      sent: sent,
      remaining: remaining.length
    };
  }

  function buildExitPayload(){
    var p = getProfile();
    var g = getGameData();

    return {
      api: "vocab",
      source: "vocab.html",
      schema: "vocab-split-v1",
      version: VERSION,
      action: "page_exit",
      event_type: "page_exit",
      eventType: "page_exit",
      client_ts: bangkokIsoNow(),

      display_name: pick(p.display_name, p.displayName, "Hero"),
      displayName: pick(p.display_name, p.displayName, "Hero"),

      student_id: pick(p.student_id, p.studentId, "anon"),
      studentId: pick(p.student_id, p.studentId, "anon"),

      section: pick(p.section, ""),
      session_code: pick(p.session_code, p.sessionCode, ""),

      bank: pick(g.bank, g.selectedBank, "A"),
      mode: normalizeMode(pick(g.mode, g.selectedMode, "learn")),
      difficulty: normalizeDifficulty(pick(g.difficulty, g.diff, g.selectedDifficulty, "normal")),

      score: num(pick(g.score, 0), 0),
      accuracy: num(pick(g.accuracy, 0), 0),

      page_url: location.href,
      user_agent: navigator.userAgent || "",

      extra_json: JSON.stringify({
        version: VERSION,
        queueSize: readQueue().length
      })
    };
  }

  function sendExitBeacon(){
    if(EXIT_SENT) return false;
    EXIT_SENT = true;

    var endpoint = getEndpoint();
    if(!endpoint || !navigator.sendBeacon) return false;

    try{
      var blob = new Blob([JSON.stringify(buildExitPayload())], {
        type: "text/plain;charset=utf-8"
      });

      return navigator.sendBeacon(endpoint, blob);
    }catch(e){
      return false;
    }
  }

  function installExitHandlers(){
    if(WIN.__VOCAB_FINAL_EXIT_BOUND__) return;
    WIN.__VOCAB_FINAL_EXIT_BOUND__ = true;

    WIN.addEventListener("pagehide", sendExitBeacon, { capture: true });

    DOC.addEventListener("visibilitychange", function(){
      if(DOC.visibilityState === "hidden"){
        sendExitBeacon();
      }
    }, { capture: true });

    /*
      r2: Do not auto-flush old queue.
      Reason: old local queue may already have been sent to Sheet.
      Manual flush only:
        VocabFinalQA.flushQueue(50)
    */
  }

  function moduleStatus(){
    return {
      config: !!(WIN.VocabConfig || WIN.VOCAB_APP || WIN.VOCAB_CONFIG),
      utils: !!WIN.VocabUtils,
      data: !!(WIN.VocabData || WIN.VOCAB_DATA || WIN.VOCAB_BANKS),
      state: !!WIN.VocabState,
      storage: !!WIN.VocabStorage,
      logger: !!(WIN.VocabLogger || WIN.vocabLogger || WIN.logVocabEventV6),
      question: !!(WIN.VocabQuestion || WIN.VocabQuestions),
      modePools: !!WIN.VocabModePools,
      ui: !!WIN.VocabUI,
      game: !!(WIN.VocabGame || WIN.vocabGame || WIN.VOCAB_GAME),
      reward: !!(WIN.VocabReward || WIN.VOCAB_REWARD),
      finalQa: true
    };
  }

  function validateQuestion(q){
    if(!q) return false;

    var choices = Array.isArray(q.choices)
      ? q.choices
      : (Array.isArray(q.options) ? q.options : []);

    var correctCount = choices.filter(function(c){
      return !!(c && c.correct);
    }).length;

    return !!(q.prompt || q.question || q.question_text || q.questionText) &&
      choices.length >= 4 &&
      correctCount === 1;
  }

  function getQuestionsForQA(bank, diff, mode){
    var Q = WIN.VocabQuestion || WIN.VocabQuestions || null;
    if(!Q) return [];

    try{
      if(typeof Q.getQuestions === "function"){
        return Q.getQuestions({
          bank: bank,
          difficulty: diff,
          diff: diff,
          mode: mode,
          count: 4,
          seed: "final-qa"
        });
      }

      if(typeof Q.buildQuestions === "function"){
        return Q.buildQuestions(bank, diff, mode, 4);
      }

      if(typeof Q.pickQuestions === "function"){
        return Q.pickQuestions(bank, diff, mode, 4);
      }
    }catch(e){
      warn("question QA failed", bank, diff, mode, e);
    }

    return [];
  }

  function getEntriesForQA(bank, mode, diff){
    var MP = WIN.VocabModePools || null;
    var Q = WIN.VocabQuestion || WIN.VocabQuestions || null;

    try{
      if(MP && typeof MP.getPool === "function"){
        return MP.getPool(mode || "learn", diff || "easy") || [];
      }

      if(Q && typeof Q.getEntries === "function"){
        return Q.getEntries(mode || bank || "A", diff || "easy") || [];
      }

      if(Q && typeof Q.getBankEntries === "function"){
        return Q.getBankEntries(bank || "A") || [];
      }
    }catch(e){}

    return [];
  }

  function qaQuestionCoverage(){
    var rows = [];
    var failed = [];

    MODES.forEach(function(mode){
      DIFFICULTIES.forEach(function(diff){
        var entries = getEntriesForQA("MODE", mode, diff);
        var questions = getQuestionsForQA("MODE", diff, mode);
        var valid = questions.filter(validateQuestion).length;

        rows.push({
          mode: mode,
          difficulty: diff,
          entries: entries.length,
          questions: questions.length,
          valid: valid
        });

        if(WIN.VocabModePools){
          if(entries.length !== 20){
            failed.push("Mode pool count issue: " + mode + " / " + diff + " = " + entries.length + "/20 terms");
          }
        }else{
          if(entries.length < 4){
            failed.push("Question bank has fewer than 4 entries: " + mode + " / " + diff);
          }
        }

        if(questions.length < Math.min(4, Math.max(1, entries.length)) || valid !== questions.length){
          failed.push("Question build issue: " + mode + " / " + diff + " = " + valid + "/" + questions.length + " valid");
        }
      });
    });

    if(WIN.VocabModePools && typeof WIN.VocabModePools.audit === "function"){
      try{
        var auditReport = WIN.VocabModePools.audit();
        if(!auditReport.ok){
          failed = failed.concat(auditReport.errors || []);
        }
      }catch(e){
        failed.push("VocabModePools.audit failed");
      }
    }

    return {
      rows: rows,
      failed: failed
    };
  }

  function qaLeaderboard(){
    var board = null;
    var failed = [];
    var duplicateCount = 0;

    try{
      board = WIN.VocabStorage && typeof WIN.VocabStorage.readLeaderboard === "function"
        ? WIN.VocabStorage.readLeaderboard()
        : (readJson("VOCAB_SPLIT_LEADERBOARD", {}) || {});
    }catch(e){
      board = {};
      failed.push("Cannot read leaderboard");
    }

    ["learn", "speed", "mission", "battle", "bossrush"].forEach(function(mode){
      var rows = Array.isArray(board && board[mode]) ? board[mode] : [];
      var seen = Object.create(null);

      rows.forEach(function(row){
        var key = getStudentKey(row);

        if(seen[key]){
          duplicateCount += 1;
        }

        seen[key] = true;
      });
    });

    if(duplicateCount > 0){
      failed.push("Leaderboard still has duplicate learner rows: " + duplicateCount);
    }

    return {
      duplicateCount: duplicateCount,
      failed: failed
    };
  }

  function qaDom(){
    var required = [
      "vocabApp",
      "vocabMenuPanel",
      "vocabBattlePanel",
      "vocabRewardPanel",
      "vocabStartBtn",
      "vocabLeaderboardBox",
      "vocabQuestionText",
      "vocabChoices",
      "vocabExplainBox",
      "vocabAiHelpBtn"
    ];

    var missing = required.filter(function(id){
      return !$(id);
    });

    return {
      required: required,
      missing: missing,
      failed: missing.map(function(id){
        return "Missing DOM id: " + id;
      })
    };
  }

  function qaEndpoint(){
    var endpoint = getEndpoint();
    var ok = /^https:\/\/script\.google\.com\/macros\/s\//.test(endpoint);

    return {
      endpoint: endpoint,
      ok: ok,
      failed: ok ? [] : ["Vocab endpoint missing or not Apps Script /exec"]
    };
  }

  function runSmokeTest(options){
    options = options || {};

    compactLeaderboardNow();

    var status = moduleStatus();

    var requiredModules = [
      "config",
      "utils",
      "data",
      "state",
      "storage",
      "logger",
      "question",
      "ui",
      "game",
      "reward"
    ];

    var missingModules = requiredModules.filter(function(k){
      return !status[k];
    });

    var q = qaQuestionCoverage();
    var lb = qaLeaderboard();
    var dom = qaDom();
    var endpoint = qaEndpoint();

    var failed = []
      .concat(missingModules.map(function(k){
        return "Missing module: " + k;
      }))
      .concat(q.failed)
      .concat(lb.failed)
      .concat(dom.failed)
      .concat(endpoint.failed);

    var report = {
      ok: failed.length === 0,
      version: VERSION,
      checked_at: bangkokIsoNow(),
      moduleStatus: status,
      questionCoverage: q.rows,
      leaderboard: {
        duplicateCount: lb.duplicateCount
      },
      dom: dom,
      endpoint: endpoint,
      queueSize: readQueue().length,
      failed: failed
    };

    LAST_REPORT = report;
    writeJson("VOCAB_FINAL_QA_REPORT", report);

    /*
      r2 Silent QA:
      Do not show panel automatically on game screen.
      Manual only:
        VocabFinalQA.showQaPanel()
    */
    if(options.forceShow === true){
      showQaPanel(report);
    }

    if(report.ok){
      log("smoke test OK", report);
    }else{
      warn("smoke test has issues", report);
    }

    return report;
  }

  function ensureCss(){
    if($("vocabFinalQaCss")) return;

    var style = DOC.createElement("style");
    style.id = "vocabFinalQaCss";
    style.textContent = "\
      .vocab-final-coach-box{margin-top:16px;padding:16px;border-radius:22px;background:rgba(34,197,94,.12);border:1px solid rgba(34,197,94,.35);color:var(--text,#eef7ff);line-height:1.55;}\
      .vocab-final-coach-box h3{margin:0 0 8px;font-size:20px;}\
      .vocab-final-coach-box p{margin:7px 0;}\
      .vocab-final-muted{opacity:.76;font-size:13px;}\
      .vocab-final-qa-panel{position:fixed;left:12px;right:12px;bottom:12px;z-index:999999;max-height:56vh;overflow:auto;padding:16px;border-radius:22px;background:rgba(2,6,23,.94);border:1px solid rgba(255,255,255,.18);color:#eef7ff;box-shadow:0 24px 70px rgba(0,0,0,.35);font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;}\
      .vocab-final-qa-panel h3{margin:0 0 10px;}\
      .vocab-final-qa-panel pre{white-space:pre-wrap;font-size:12px;line-height:1.45;}\
      .vocab-final-qa-close{float:right;border:0;border-radius:999px;padding:8px 12px;font-weight:900;cursor:pointer;}\
    ";

    DOC.head.appendChild(style);
  }

  function showQaPanel(report){
    ensureCss();

    var old = $("vocabFinalQaPanel");
    if(old) old.remove();

    report = report || LAST_REPORT || runSmokeTest();

    var panel = DOC.createElement("section");
    panel.id = "vocabFinalQaPanel";
    panel.className = "vocab-final-qa-panel";

    panel.innerHTML = [
      '<button class="vocab-final-qa-close" type="button">ปิด</button>',
      '<h3>' + (report.ok ? '✅ Vocab Final QA: PASS' : '⚠️ Vocab Final QA: CHECK') + '</h3>',
      '<pre>' + esc(JSON.stringify(report, null, 2)) + '</pre>'
    ].join("");

    panel.querySelector("button").addEventListener("click", function(){
      panel.remove();
    });

    DOC.body.appendChild(panel);
  }

  function installApi(){
    WIN.VocabFinalQA = {
      version: VERSION,

      runSmokeTest: runSmokeTest,

      showQaPanel: function(){
        return showQaPanel(LAST_REPORT || runSmokeTest());
      },

      compactLeaderboardNow: compactLeaderboardNow,

      flushQueue: flushQueue,
      archiveAndClearQueue: archiveAndClearQueue,

      recommendNext: recommendNext,
      normalizeResult: normalizeResult,

      sendExitBeacon: sendExitBeacon,

      getQueueSize: function(){
        return readQueue().length;
      },

      readQueue: readQueue,

      getLastReport: function(){
        return LAST_REPORT || readJson("VOCAB_FINAL_QA_REPORT", null);
      }
    };

    WIN.__VOCAB_MODULES__ = WIN.__VOCAB_MODULES__ || {};
    WIN.__VOCAB_MODULES__.finalQa = true;

    WIN.VocabModules = WIN.VocabModules || {};
    WIN.VocabModules.finalQa = true;
  }

  function boot(){
    ensureCss();
    installApi();
    installExitHandlers();
    compactLeaderboardNow();
    patchReward();

    setTimeout(function(){
      patchReward();
      runSmokeTest({
        show: false
      });
    }, 800);

    /*
      r2 Silent production mode:
      Do not auto-flush local queue on startup.
      Manual only:
        VocabFinalQA.flushQueue(25)
    */

    log("loaded", VERSION);
  }

  if(DOC.readyState === "loading"){
    DOC.addEventListener("DOMContentLoaded", boot, { once: true });
  }else{
    boot();
  }
})();
