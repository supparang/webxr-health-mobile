/* =========================================================
   /vocab/vocab.state.js
   TechPath Vocab Arena — State Store
   Version: 20260503a
   Depends on:
   - vocab.config.js
   - vocab.utils.js
========================================================= */
(function(){
  "use strict";

  const WIN = window;

  const APP =
    WIN.VocabConfig ||
    WIN.VOCAB_APP ||
    WIN.VOCAB_CONFIG ||
    {
      selectedBank: "A",
      selectedDifficulty: "easy",
      selectedMode: "learn"
    };

  const U =
    WIN.VocabUtils ||
    WIN.VOCAB_UTILS ||
    {};

  function uid(prefix){
    if(U.uid) return U.uid(prefix || "vocab");

    return String(prefix || "vocab") + "_" + Date.now() + "_" + Math.random().toString(16).slice(2);
  }

  function now(){
    return Date.now();
  }

  function clone(obj){
    try{
      return JSON.parse(JSON.stringify(obj));
    }catch(e){
      return obj;
    }
  }

  function makePowerStats(){
    return {
      feverCount: 0,
      shieldUsed: 0,
      hintUsed: 0,
      laserUsed: 0,
      bossAttackCount: 0,
      aiHelpUsed: 0,
      timeoutCount: 0
    };
  }

  function makeGameState(){
    return {
      active: false,
      ended: false,
      paused: false,

      sessionId: "",
      runId: "",
      visitId: "",

      bank: APP.selectedBank || "A",
      difficulty: APP.selectedDifficulty || "easy",
      mode: APP.selectedMode || "learn",
      modeConfig: null,

      terms: [],
      stagePlan: [],
      stageIndex: 0,
      questionIndexInStage: 0,
      globalQuestionIndex: 0,
      totalQuestions: 0,

      currentStage: null,
      currentQuestion: null,
      questionStartedAt: 0,
      questionLocked: false,

      timerId: null,
      timeLeft: 0,

      score: 0,
      fairScore: 0,
      combo: 0,
      comboMax: 0,
      correct: 0,
      wrong: 0,
      timeout: 0,
      playerHp: 5,

      enemy: null,
      enemyHp: 100,
      enemyHpMax: 100,

      mistakes: [],
      answeredTerms: [],
      termStats: {},
      stageStats: {},

      fever: false,
      feverUntil: 0,
      feverTimerId: null,

      shield: 1,
      hints: 1,
      laserReady: false,
      aiHelpLeft: 0,
      aiHelpUsed: 0,
      aiHelpPenalty: 0,
      currentAiHelpUsed: false,

      powerStats: makePowerStats(),

      startedAt: 0,
      endedAt: 0,
      lastReason: "",

      meta: {},
      lastResult: null,
      lastReward: null,
      lastCoach: null
    };
  }

  const State = {
    version: "vocab-state-20260503a",

    app: APP,

    game: makeGameState(),

    ui: {
      currentScreen: "menu",
      selectedLeaderboardMode: "learn",
      locked: false,
      lastToast: "",
      lastError: null
    },

    student: {
      display_name: "",
      student_id: "",
      section: "",
      session_code: ""
    },

    settings: {
      sound: true,
      guard: true,
      reducedMotion: false
    },

    resetGame(){
      this.clearTimers();
      this.game = makeGameState();
      this.ui.currentScreen = "menu";
      this.ui.locked = false;
      return this.game;
    },

    createSessionId(){
      const sessionId = uid("vocab");
      this.game.sessionId = sessionId;
      this.game.runId = sessionId;
      return sessionId;
    },

    ensureSessionId(){
      if(!this.game.sessionId){
        return this.createSessionId();
      }
      return this.game.sessionId;
    },

    startSession(options){
      options = options || {};

      this.clearTimers();

      const bank = options.bank || APP.selectedBank || this.game.bank || "A";
      const difficulty = options.difficulty || APP.selectedDifficulty || this.game.difficulty || "easy";
      const mode = options.mode || APP.selectedMode || this.game.mode || "learn";

      this.game = makeGameState();

      this.game.active = true;
      this.game.ended = false;
      this.game.paused = false;

      this.game.sessionId = uid("vocab");
      this.game.runId = this.game.sessionId;
      this.game.visitId = options.visitId || "";

      this.game.bank = bank;
      this.game.difficulty = difficulty;
      this.game.mode = mode;
      this.game.modeConfig = options.modeConfig || null;

      this.game.startedAt = now();
      this.game.endedAt = 0;
      this.game.lastReason = "";

      this.game.meta = Object.assign({}, options.meta || {});

      this.ui.currentScreen = "battle";
      this.ui.locked = false;

      try{
        APP.selectedBank = bank;
        APP.selectedDifficulty = difficulty;
        APP.selectedMode = mode;
      }catch(e){}

      return this.game;
    },

    endSession(reason){
      this.clearTimers();

      this.game.active = false;
      this.game.ended = true;
      this.game.paused = false;
      this.game.endedAt = now();
      this.game.lastReason = reason || "completed";
      this.ui.currentScreen = "reward";
      this.ui.locked = false;

      return this.game;
    },

    setScreen(screen){
      this.ui.currentScreen = screen || "menu";
      return this.ui.currentScreen;
    },

    getScreen(){
      return this.ui.currentScreen || "menu";
    },

    getGame(){
      return this.game;
    },

    setGamePatch(patch){
      Object.assign(this.game, patch || {});
      return this.game;
    },

    setStudent(ctx){
      ctx = ctx || {};
      this.student = Object.assign({}, this.student, {
        display_name: String(ctx.display_name || ctx.displayName || this.student.display_name || "").trim(),
        student_id: String(ctx.student_id || ctx.studentId || this.student.student_id || "").trim(),
        section: String(ctx.section || this.student.section || "").trim(),
        session_code: String(ctx.session_code || ctx.sessionCode || this.student.session_code || "").trim()
      });

      return this.student;
    },

    getStudent(){
      return Object.assign({}, this.student);
    },

    clearTimers(){
      try{
        if(this.game && this.game.timerId){
          clearInterval(this.game.timerId);
          clearTimeout(this.game.timerId);
          this.game.timerId = null;
        }
      }catch(e){}

      try{
        if(this.game && this.game.feverTimerId){
          clearTimeout(this.game.feverTimerId);
          clearInterval(this.game.feverTimerId);
          this.game.feverTimerId = null;
        }
      }catch(e){}

      try{
        if(this.game){
          this.game.fever = false;
          this.game.feverUntil = 0;
        }
      }catch(e){}
    },

    initStageStats(stages){
      const stats = {};

      (stages || []).forEach(stage => {
        const id = stage.id || String(stage);
        stats[id] = {
          correct: 0,
          wrong: 0,
          timeout: 0,
          responseMsTotal: 0,
          count: 0
        };
      });

      this.game.stageStats = stats;
      return stats;
    },

    ensureStageStat(stageId){
      const id = stageId || "unknown";

      if(!this.game.stageStats) this.game.stageStats = {};

      if(!this.game.stageStats[id]){
        this.game.stageStats[id] = {
          correct: 0,
          wrong: 0,
          timeout: 0,
          responseMsTotal: 0,
          count: 0
        };
      }

      return this.game.stageStats[id];
    },

    recordAnswer(payload){
      payload = payload || {};

      const stageId =
        payload.stageId ||
        payload.stage_id ||
        (this.game.currentStage && this.game.currentStage.id) ||
        "unknown";

      const term =
        payload.term ||
        payload.term_id ||
        (this.game.currentQuestion && this.game.currentQuestion.correctTerm && this.game.currentQuestion.correctTerm.term) ||
        "";

      const meaning =
        payload.meaning ||
        (this.game.currentQuestion && this.game.currentQuestion.correctTerm && this.game.currentQuestion.correctTerm.meaning) ||
        "";

      const selected = payload.selected || "";
      const isCorrect = !!payload.isCorrect;
      const isTimeout = !!payload.isTimeout;
      const responseMs = Number(payload.responseMs || payload.response_ms || 0) || 0;

      const stat = this.ensureStageStat(stageId);
      stat.count += 1;
      stat.responseMsTotal += responseMs;

      if(isCorrect){
        stat.correct += 1;
        this.game.correct += 1;
      }else{
        stat.wrong += 1;
        this.game.wrong += 1;

        if(isTimeout){
          stat.timeout += 1;
          this.game.timeout += 1;
          this.game.powerStats.timeoutCount += 1;
        }

        if(term){
          this.game.mistakes.push({
            term,
            meaning,
            selected: selected || (isTimeout ? "TIMEOUT" : ""),
            stageId,
            responseMs,
            at: new Date().toISOString()
          });
        }
      }

      if(term){
        const key = String(term).toLowerCase();

        if(!this.game.termStats[key]){
          this.game.termStats[key] = {
            term,
            meaning,
            seen: 0,
            correct: 0,
            wrong: 0,
            timeout: 0,
            responseMsTotal: 0,
            aiHelp: 0
          };
        }

        const t = this.game.termStats[key];
        t.seen += 1;
        t.responseMsTotal += responseMs;

        if(isCorrect) t.correct += 1;
        else t.wrong += 1;

        if(isTimeout) t.timeout += 1;
        if(this.game.currentAiHelpUsed) t.aiHelp += 1;

        this.game.answeredTerms.push({
          term,
          meaning,
          selected,
          stageId,
          correct: isCorrect ? 1 : 0,
          timeout: isTimeout ? 1 : 0,
          responseMs,
          aiHelp: this.game.currentAiHelpUsed ? 1 : 0
        });
      }

      return {
        stageStat: stat,
        termStats: this.game.termStats
      };
    },

    getAccuracy(){
      const total = Number(this.game.correct || 0) + Number(this.game.wrong || 0);
      return total ? Math.round((Number(this.game.correct || 0) / total) * 100) : 0;
    },

    getDurationSec(){
      const start = Number(this.game.startedAt || 0);
      const end = Number(this.game.endedAt || Date.now());
      return start ? Math.max(0, Math.round((end - start) / 1000)) : 0;
    },

    getWeakestTerms(limit){
      limit = limit || 5;

      const map = new Map();

      (this.game.mistakes || []).forEach(m => {
        const key = String(m.term || "").toLowerCase();
        if(!key) return;

        if(!map.has(key)){
          map.set(key, {
            term: m.term,
            meaning: m.meaning,
            count: 0,
            stages: new Set()
          });
        }

        const item = map.get(key);
        item.count += 1;

        if(m.stageId){
          item.stages.add(m.stageId);
        }
      });

      return Array.from(map.values())
        .map(x => ({
          term: x.term,
          meaning: x.meaning,
          count: x.count,
          stages: Array.from(x.stages)
        }))
        .sort((a,b) => b.count - a.count)
        .slice(0, limit);
    },

    getStageSummary(){
      const out = {};

      Object.entries(this.game.stageStats || {}).forEach(([stageId, stat]) => {
        const correct = Number(stat.correct || 0);
        const wrong = Number(stat.wrong || 0);
        const total = correct + wrong;

        out[stageId] = {
          correct,
          wrong,
          timeout: Number(stat.timeout || 0),
          count: Number(stat.count || total || 0),
          accuracy: total ? Math.round((correct / total) * 100) : 0,
          avgResponseMs: stat.count ? Math.round(Number(stat.responseMsTotal || 0) / Number(stat.count || 1)) : 0
        };
      });

      return out;
    },

    buildResult(reason){
      const g = this.game;

      const result = {
        version: APP.version || this.version,
        reason: reason || g.lastReason || "completed",
        sessionId: g.sessionId,
        bank: g.bank,
        difficulty: g.difficulty,
        mode: g.mode,
        modeLabel: g.modeConfig ? g.modeConfig.label : g.mode,
        score: Number(g.score || 0),
        fairScore: Number(g.fairScore || g.score || 0),
        correct: Number(g.correct || 0),
        wrong: Number(g.wrong || 0),
        timeout: Number(g.timeout || 0),
        accuracy: this.getAccuracy(),
        comboMax: Number(g.comboMax || 0),
        durationSec: this.getDurationSec(),
        bossDefeated: Number(g.enemyHp || 0) <= 0,
        enemyName: g.enemy ? g.enemy.name : "",
        weakestTerms: this.getWeakestTerms(8),
        stageStats: this.getStageSummary(),
        powerStats: clone(g.powerStats || {}),
        feverCount: g.powerStats ? Number(g.powerStats.feverCount || 0) : 0,
        shieldUsed: g.powerStats ? Number(g.powerStats.shieldUsed || 0) : 0,
        hintUsed: g.powerStats ? Number(g.powerStats.hintUsed || 0) : 0,
        laserUsed: g.powerStats ? Number(g.powerStats.laserUsed || 0) : 0,
        aiHelpUsed: Number(g.aiHelpUsed || 0),
        aiHelpLeft: Number(g.aiHelpLeft || 0),
        aiHelpPenalty: Number(g.aiHelpPenalty || 0),
        aiAssisted: Number(g.aiHelpUsed || 0) > 0,
        startedAt: g.startedAt ? new Date(g.startedAt).toISOString() : "",
        endedAt: g.endedAt ? new Date(g.endedAt).toISOString() : new Date().toISOString()
      };

      g.lastResult = result;
      return result;
    },

    saveRewardData(result, reward, coach){
      this.game.lastResult = result || null;
      this.game.lastReward = reward || null;
      this.game.lastCoach = coach || null;
    },

    getLastRewardData(){
      return {
        result: this.game.lastResult,
        reward: this.game.lastReward,
        coach: this.game.lastCoach
      };
    }
  };

  /*
    Export หลัก — boot ต้องเจอชื่อนี้
  */
  WIN.VocabState = State;

  /*
    Alias รองรับไฟล์เก่า / patch เก่า
  */
  WIN.VOCAB_STATE = State;
  WIN.vocabState = State;
  WIN.VocabStore = State;

  /*
    Alias ให้โค้ดเก่าที่เรียก vocabGame ยังทำงานได้
    สำคัญ: เป็น reference เดียวกับ State.game
  */
  Object.defineProperty(WIN, "vocabGame", {
    configurable: true,
    enumerable: true,
    get(){
      return State.game;
    },
    set(v){
      if(v && typeof v === "object"){
        State.game = v;
      }
    }
  });

  console.log("[VOCAB STATE] loaded", State.version);
})();
