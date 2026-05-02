/* =========================================================
   /vocab/vocab.config.js
   TechPath Vocab Arena — Config
   Version: 20260502c

   สำคัญ:
   - ไฟล์นี้ต้องโหลดก่อนทุกไฟล์ JS อื่น
   - ต้องมี window.VOCAB_APP เสมอ
   - endpoint ล่าสุดอยู่ตรง sheetEndpoint
========================================================= */
(function(){
  "use strict";

  const DEFAULT_ENDPOINT =
    "https://script.google.com/macros/s/AKfycbwsW0ffV5W_A81bNdcj32TDvgVBEUOk6IDPqqmqpePCVhY0X56dEv1XIOh2ygu0AG7i/exec";

  function getParam(name, fallback = ""){
    try{
      const url = new URL(window.location.href);
      return url.searchParams.get(name) || fallback;
    }catch(e){
      return fallback;
    }
  }

  function readLocal(key, fallback = ""){
    try{
      return localStorage.getItem(key) || fallback;
    }catch(e){
      return fallback;
    }
  }

  function normalizeEndpoint(url){
    url = String(url || "").trim();

    if(!url){
      url = DEFAULT_ENDPOINT;
    }

    try{
      const u = new URL(url, window.location.href);

      /*
        Router ฝั่ง Apps Script ใช้ api=vocab
        ดังนั้น endpoint ต้องมี api=vocab เสมอ
      */
      if(!u.searchParams.get("api")){
        u.searchParams.set("api", "vocab");
      }

      return u.toString();
    }catch(e){
      if(url.indexOf("?") >= 0){
        if(url.indexOf("api=") < 0){
          return url + "&api=vocab";
        }
        return url;
      }

      return url + "?api=vocab";
    }
  }

  const endpointFromUrl =
    getParam("apiUrl") ||
    getParam("endpoint") ||
    getParam("sheetEndpoint") ||
    "";

  const endpointFromLocal =
    readLocal("VOCAB_SHEET_ENDPOINT", "");

  const sheetEndpoint = normalizeEndpoint(
    window.VOCAB_SHEET_ENDPOINT ||
    endpointFromUrl ||
    endpointFromLocal ||
    DEFAULT_ENDPOINT
  );

  /*
    Global config
    ต้องใช้ window.VOCAB_APP เท่านั้น เพื่อให้ไฟล์อื่นเรียกได้แน่นอน
  */
  window.VOCAB_APP = {
    appName: "TechPath Vocab Arena",
    publicTitle: "TechPath Vocab Arena",
    publicSubtitle: "CS/AI Vocabulary Challenge",

    version: "vocab-split-v1-20260502c",
    schema: "vocab-split-v1",
    source: "vocab.html",
    api: "vocab",

    sheetEndpoint,

    enableSheetLog: true,
    enableConsoleLog: true,

    /*
      selected state เริ่มต้น
      vocab.ui.js จะเปลี่ยนค่าตามปุ่มที่ผู้เรียนกด
    */
    selectedBank: getParam("bank", "A"),
    selectedDifficulty: getParam("diff", "easy"),
    selectedMode: getParam("mode", "learn"),

    /*
      localStorage keys
    */
    storageKeys: {
      profile: "VOCAB_SPLIT_PROFILE",
      queue: "VOCAB_SPLIT_LOG_QUEUE",
      leaderboard: "VOCAB_SPLIT_LEADERBOARD",
      lastSummary: "VOCAB_SPLIT_LAST_SUMMARY",
      termHistory: "VOCAB_SPLIT_TERM_HISTORY",
      sound: "VOCAB_SPLIT_SOUND_ON",
      guardLog: "VOCAB_SPLIT_GUARD_LOG"
    },

    /*
      query params / teacher settings
    */
    params: {
      seed: getParam("seed", ""),
      pid: getParam("pid", ""),
      name: getParam("name", "") || getParam("nick", ""),
      section: getParam("section", ""),
      sessionCode: getParam("session_code", "") || getParam("studyId", ""),
      qa: getParam("qa", ""),
      teacher: getParam("teacher", ""),
      admin: getParam("admin", ""),
      debug: getParam("debug", "")
    },

    /*
      student mode เป็น default
      QA/Teacher/Admin mode จึงค่อยแสดง panel เพิ่มในอนาคต
    */
    isTeacherMode:
      getParam("teacher") === "1" ||
      getParam("admin") === "1" ||
      getParam("qa") === "1" ||
      getParam("debug") === "1",

    /*
      Source guard
    */
    sourceGuard: {
      enabled:
        getParam("guard", "on") !== "off" &&
        getParam("source_guard", "on") !== "off",

      blockContextMenu: true,
      blockCopy: true,
      blockSelect: true,
      blockPrint: true,
      blockDevtoolsShortcuts: true
    }
  };

  /*
    Backward compatibility:
    กันไฟล์เก่าบางไฟล์เรียก VOCAB_APP ตรง ๆ
  */
  try{
    window.VOCAB_CONFIG = window.VOCAB_APP;
  }catch(e){}

  /*
    Difficulty config
  */
  window.VOCAB_DIFFICULTY = {
    easy: {
      id: "easy",
      label: "Easy",
      icon: "✨",
      totalQuestions: 8,
      timePerQuestion: 22,
      playerHp: 5,
      choiceCount: 4,
      bossMultiplier: 0.8,
      scoreMultiplier: 0.9,
      preview: "✨ Easy: เวลาเยอะ เหมาะกับเริ่มจำความหมาย"
    },

    normal: {
      id: "normal",
      label: "Normal",
      icon: "⚔️",
      totalQuestions: 10,
      timePerQuestion: 16,
      playerHp: 4,
      choiceCount: 4,
      bossMultiplier: 1,
      scoreMultiplier: 1,
      preview: "⚔️ Normal: เริ่มมีตัวเลือกหลอกและโจทย์บริบท"
    },

    hard: {
      id: "hard",
      label: "Hard",
      icon: "🔥",
      totalQuestions: 12,
      timePerQuestion: 12,
      playerHp: 3,
      choiceCount: 5,
      bossMultiplier: 1.25,
      scoreMultiplier: 1.15,
      preview: "🔥 Hard: 5 ตัวเลือก เวลาเร็วขึ้น และต้องเข้าใจ context"
    },

    challenge: {
      id: "challenge",
      label: "Challenge",
      icon: "💀",
      totalQuestions: 15,
      timePerQuestion: 9,
      playerHp: 2,
      choiceCount: 5,
      bossMultiplier: 1.55,
      scoreMultiplier: 1.35,
      preview: "💀 Challenge: เวลาน้อย ตัวหลอกหนัก เหมาะกับผู้ที่พร้อมท้าทาย"
    }
  };

  /*
    Play mode config
  */
  window.VOCAB_PLAY_MODES = {
    learn: {
      id: "learn",
      label: "AI Training",
      shortLabel: "AI",
      icon: "🤖",
      description: "เรียนรู้คำศัพท์แบบค่อยเป็นค่อยไป มี Hint และคำอธิบายชัด",
      totalQuestionBonus: 0,
      timeBonus: 4,
      startHints: 3,
      startShield: 2,
      startAiHelp: 3,
      feverComboNeed: 5,
      laserComboNeed: 8,
      scoreMultiplier: 0.9,
      stageOrder: ["warmup", "warmup", "trap", "mission"]
    },

    speed: {
      id: "speed",
      label: "Speed Run",
      shortLabel: "Speed",
      icon: "⚡",
      description: "ตอบให้ไว ทำ Combo เก็บคะแนน และเข้า Fever เร็วกว่าโหมดอื่น",
      totalQuestionBonus: 2,
      timeBonus: -4,
      startHints: 1,
      startShield: 1,
      startAiHelp: 1,
      feverComboNeed: 4,
      laserComboNeed: 7,
      scoreMultiplier: 1.15,
      stageOrder: ["warmup", "speed", "speed", "trap", "boss"]
    },

    mission: {
      id: "mission",
      label: "Debug Mission",
      shortLabel: "Mission",
      icon: "🎯",
      description: "อ่านสถานการณ์จริง แล้วเลือกคำศัพท์ที่เหมาะสมที่สุด",
      totalQuestionBonus: 2,
      timeBonus: 1,
      startHints: 2,
      startShield: 1,
      startAiHelp: 2,
      feverComboNeed: 5,
      laserComboNeed: 7,
      scoreMultiplier: 1.08,
      stageOrder: ["warmup", "mission", "mission", "trap", "boss"]
    },

    battle: {
      id: "battle",
      label: "Boss Battle",
      shortLabel: "Boss",
      icon: "👾",
      description: "โหมดต่อสู้เต็มระบบ มีบอส HP, Fever, Laser, Shield และแรงกดดันสูง",
      totalQuestionBonus: 3,
      timeBonus: -2,
      startHints: 1,
      startShield: 1,
      startAiHelp: 1,
      feverComboNeed: 5,
      laserComboNeed: 7,
      scoreMultiplier: 1.25,
      stageOrder: ["warmup", "speed", "trap", "mission", "boss", "boss"]
    }
  };

  /*
    Stage config
  */
  window.VOCAB_STAGES = [
    {
      id: "warmup",
      name: "Warm-up Round",
      icon: "✨",
      goal: "เก็บความมั่นใจ ตอบให้ถูก"
    },
    {
      id: "speed",
      name: "Speed Round",
      icon: "⚡",
      goal: "ตอบไวเพื่อเพิ่ม Combo"
    },
    {
      id: "trap",
      name: "Trap Round",
      icon: "🧠",
      goal: "ระวังคำที่ความหมายใกล้กัน"
    },
    {
      id: "mission",
      name: "Mini Mission",
      icon: "🎯",
      goal: "ใช้คำศัพท์กับสถานการณ์จริง"
    },
    {
      id: "boss",
      name: "Boss Battle",
      icon: "👾",
      goal: "โจมตีบอสให้ HP หมด"
    }
  ];

  /*
    Enemy config
  */
  window.VOCAB_ENEMIES = {
    A: {
      name: "Bug Slime",
      title: "Basic Code Bug",
      avatar: "🟢",
      skill: "Speed pressure: ตอบช้าเสีย combo ง่าย",
      hp: 100
    },

    B: {
      name: "Data Ghost",
      title: "AI/Data Trickster",
      avatar: "👻",
      skill: "Smart trap: ตัวเลือกหลอกใกล้เคียงขึ้น",
      hp: 130
    },

    C: {
      name: "Syntax Dragon",
      title: "Workplace Boss",
      avatar: "🐉",
      skill: "Heavy attack: ตอบผิดในบอสโดนแรงขึ้น",
      hp: 160
    }
  };

  /*
    Power-up config
  */
  window.VOCAB_POWER = {
    feverDurationMs: 8500,
    feverDamageMultiplier: 1.6,
    feverScoreMultiplier: 1.5,

    shieldMax: 3,
    hintMax: 4,

    laserDamage: 26,
    laserDamageFever: 38,

    aiHelpScorePenaltyPerUse: 0.10,
    aiHelpMaxPenalty: 0.30
  };

  /*
    Leaderboard config
  */
  window.VOCAB_LEADERBOARD = {
    maxRowsPerMode: 30,
    showTop: 5,
    assistedScoreMultiplier: 0.95
  };

  /*
    Logging helper global
  */
  window.setVocabSheetEndpoint = function(url){
    const endpoint = normalizeEndpoint(url);
    window.VOCAB_APP.sheetEndpoint = endpoint;

    try{
      localStorage.setItem("VOCAB_SHEET_ENDPOINT", endpoint);
    }catch(e){}

    console.log("[VOCAB CONFIG] saved endpoint", endpoint);
    return endpoint;
  };

  window.getVocabSheetEndpoint = function(){
    return window.VOCAB_APP.sheetEndpoint;
  };

  console.log("[VOCAB CONFIG] loaded", window.VOCAB_APP.version);
  console.log("[VOCAB CONFIG] endpoint", window.VOCAB_APP.sheetEndpoint);
})();
/* =========================================================
   EXPORT — vocab.state.js
========================================================= */
(function(){
  "use strict";

  const W = window;

  const api =
    W.VocabState ||
    W.VOCAB_STATE ||
    W.vocabState ||
    {
      version: "vocab-state-export-fallback-20260503a",

      init(){
        if(!W.vocabGame){
          W.vocabGame = {
            active:false,
            sessionId:"",
            bank:"A",
            difficulty:"easy",
            mode:"learn",
            modeConfig:null,
            terms:[],
            stagePlan:[],
            stageIndex:0,
            questionIndexInStage:0,
            globalQuestionIndex:0,
            currentStage:null,
            currentQuestion:null,
            questionStartedAt:0,
            timerId:null,
            timeLeft:0,
            score:0,
            combo:0,
            comboMax:0,
            correct:0,
            wrong:0,
            playerHp:5,
            enemy:null,
            enemyHp:100,
            enemyHpMax:100,
            mistakes:[],
            stageStats:{},
            fever:false,
            feverUntil:0,
            feverTimerId:null,
            shield:1,
            hints:1,
            laserReady:false,
            aiHelpLeft:0,
            aiHelpUsed:0,
            aiHelpPenalty:0,
            currentAiHelpUsed:false,
            powerStats:{
              feverCount:0,
              shieldUsed:0,
              hintUsed:0,
              laserUsed:0,
              bossAttackCount:0
            },
            startedAt:0,
            endedAt:0
          };
        }

        W.vocabGameV6 = W.vocabGame;
        return W.vocabGame;
      },

      get(){
        return W.vocabGame || this.init();
      },

      reset(){
        const g = this.init();

        g.active = false;
        g.sessionId = "";
        g.stagePlan = [];
        g.stageIndex = 0;
        g.questionIndexInStage = 0;
        g.globalQuestionIndex = 0;
        g.currentStage = null;
        g.currentQuestion = null;
        g.timerId = null;
        g.timeLeft = 0;
        g.score = 0;
        g.combo = 0;
        g.comboMax = 0;
        g.correct = 0;
        g.wrong = 0;
        g.playerHp = 5;
        g.enemyHp = 100;
        g.enemyHpMax = 100;
        g.mistakes = [];
        g.stageStats = {};
        g.fever = false;
        g.feverUntil = 0;
        g.feverTimerId = null;
        g.shield = 1;
        g.hints = 1;
        g.laserReady = false;
        g.aiHelpLeft = 0;
        g.aiHelpUsed = 0;
        g.aiHelpPenalty = 0;
        g.currentAiHelpUsed = false;
        g.startedAt = 0;
        g.endedAt = 0;

        return g;
      }
    };

  W.VocabState = api;
  W.VOCAB_STATE = api;
  W.vocabState = api;

  if(!W.vocabGame){
    api.init();
  }

  console.log("[VOCAB STATE] export ready", api.version || "");
})();
