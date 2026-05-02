/* =========================================================
   /vocab/vocab.config.js
   TechPath Vocab Arena — Central Config
   Version: 20260502a

   ใช้เก็บ:
   - App config / endpoint
   - Difficulty
   - Play modes
   - Enemies
   - Stages
   - Power-up config
   - AI Help config
   - Leaderboard config
   - Word banks
   ========================================================= */

(function(){
  "use strict";

  const SHEET_ENDPOINT =
    window.VOCAB_SHEET_ENDPOINT ||
    localStorage.getItem("VOCAB_SHEET_ENDPOINT") ||
    "https://script.google.com/macros/s/AKfycbwsW0ffV5W_A81bNdcj32TDvgVBEUOk6IDPqqmqpePCVhY0X56dEv1XIOh2ygu0AG7i/exec?api=vocab";

  const VOCAB_APP = {
    version: "v20260502a-split-files",
    publicTitle: "TechPath Vocab Arena",
    publicSubtitle: "CS/AI Vocabulary Challenge",

    sheetEndpoint: SHEET_ENDPOINT,
    api: "vocab",
    source: "vocab.html",
    schema: "vocab-split-v1",

    queueKey: "VOCAB_LOG_QUEUE",
    profileKey: "VOCAB_STUDENT_PROFILE",
    teacherKey: "VOCAB_TEACHER_LAST",
    leaderboardKey: "VOCAB_MODE_LEADERBOARD",

    enableSheetLog: true,
    enableConsoleLog: true,

    selectedBank: "A",
    selectedDifficulty: "easy",
    selectedMode: "learn"
  };

  const VOCAB_DIFFICULTY = {
    easy: {
      id: "easy",
      label: "Easy",
      totalQuestions: 8,
      timePerQuestion: 18,
      playerHp: 5,
      bossMultiplier: 0.8,
      choiceCount: 4,
      timeAdd: 4,
      attackBase: 1,
      attackStageBonus: 0,
      damageScale: 1.15,
      crossBankCount: 0,
      preview: "✨ Easy: คำถามตรง 4 ตัวเลือก เวลาเยอะ เหมาะกับเริ่มจำความหมาย"
    },

    normal: {
      id: "normal",
      label: "Normal",
      totalQuestions: 10,
      timePerQuestion: 14,
      playerHp: 4,
      bossMultiplier: 1,
      choiceCount: 4,
      timeAdd: 0,
      attackBase: 1,
      attackStageBonus: 1,
      damageScale: 1,
      crossBankCount: 0,
      preview: "⚔️ Normal: สลับนิยาม/สถานการณ์ มีตัวเลือกหลอก ต้องเข้าใจจริง"
    },

    hard: {
      id: "hard",
      label: "Hard",
      totalQuestions: 12,
      timePerQuestion: 11,
      playerHp: 3,
      bossMultiplier: 1.25,
      choiceCount: 5,
      timeAdd: -2,
      attackBase: 2,
      attackStageBonus: 1,
      damageScale: 0.86,
      crossBankCount: 10,
      preview: "🔥 Hard: 5 ตัวเลือก โจทย์บริบทมากขึ้น มีคำข้าม bank เป็นตัวหลอก"
    },

    challenge: {
      id: "challenge",
      label: "Challenge",
      totalQuestions: 15,
      timePerQuestion: 8,
      playerHp: 2,
      bossMultiplier: 1.5,
      choiceCount: 5,
      timeAdd: -4,
      attackBase: 3,
      attackStageBonus: 2,
      damageScale: 0.72,
      crossBankCount: 20,
      preview: "💀 Challenge: 5 ตัวเลือก ผสมหลาย bank เวลาเร็ว บอสลงโทษหนัก"
    }
  };

  const VOCAB_PLAY_MODES = {
    learn: {
      id: "learn",
      label: "AI Training",
      shortLabel: "AI",
      icon: "🤖",
      title: "Learn Mode",
      description: "เรียนรู้คำศัพท์แบบค่อยเป็นค่อยไป มี Hint เยอะ Shield มาก และคำอธิบายชัด",
      totalQuestionBonus: 0,
      timeBonus: 5,
      startHints: 3,
      startShield: 2,
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
      title: "Speed Mode",
      description: "ตอบให้ไว ทำ Combo เก็บคะแนน และเข้า Fever เร็วกว่าโหมดอื่น",
      totalQuestionBonus: 2,
      timeBonus: -4,
      startHints: 1,
      startShield: 1,
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
      title: "Mission Mode",
      description: "อ่านสถานการณ์จริง แล้วเลือกคำศัพท์ที่เหมาะสมที่สุด เหมาะกับ CS/AI workplace context",
      totalQuestionBonus: 2,
      timeBonus: 2,
      startHints: 2,
      startShield: 1,
      feverComboNeed: 5,
      laserComboNeed: 7,
      scoreMultiplier: 1.05,
      stageOrder: ["warmup", "mission", "mission", "trap", "boss"]
    },

    battle: {
      id: "battle",
      label: "Boss Battle",
      shortLabel: "Boss",
      icon: "👾",
      title: "Battle Mode",
      description: "โหมดต่อสู้เต็มระบบ มีบอส HP, Fever, Laser, Shield และแรงกดดันสูง",
      totalQuestionBonus: 3,
      timeBonus: -2,
      startHints: 1,
      startShield: 1,
      feverComboNeed: 5,
      laserComboNeed: 7,
      scoreMultiplier: 1.25,
      stageOrder: ["warmup", "speed", "trap", "mission", "boss", "boss"]
    },

    bossrush: {
      id: "bossrush",
      label: "Boss Rush",
      shortLabel: "Rush",
      icon: "💀",
      title: "Boss Rush Mode",
      description: "บอสต่อเนื่อง เวลาเร็ว AI Help น้อย คะแนนสูง เหมาะกับ Weekly Challenge",
      totalQuestionBonus: 5,
      timeBonus: -5,
      startHints: 0,
      startShield: 1,
      feverComboNeed: 4,
      laserComboNeed: 6,
      scoreMultiplier: 1.45,
      stageOrder: ["boss", "trap", "boss", "mission", "boss", "boss"]
    }
  };

  const VOCAB_ENEMIES = {
    A: {
      bank: "A",
      name: "Bug Slime",
      title: "Basic Code Bug",
      avatar: "🟢",
      skill: "Speed pressure: ตอบช้าเสีย combo ง่าย",
      hp: 100
    },

    B: {
      bank: "B",
      name: "Data Ghost",
      title: "AI/Data Trickster",
      avatar: "👻",
      skill: "Smart trap: ตัวเลือกหลอกใกล้เคียงขึ้น",
      hp: 130
    },

    C: {
      bank: "C",
      name: "Syntax Dragon",
      title: "Workplace Boss",
      avatar: "🐉",
      skill: "Heavy attack: ตอบผิดในบอสโดนแรงขึ้น",
      hp: 160
    }
  };

  const VOCAB_STAGES = [
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

  const VOCAB_POWER = {
    feverDurationMs: 8500,
    feverDamageMultiplier: 1.6,
    feverScoreMultiplier: 1.5,
    shieldMax: 3,
    hintMax: 4
  };

  const VOCAB_AI_HELP = {
    scorePenaltyPerUse: 0.10,
    maxPenalty: 0.30,

    modeBase: {
      learn: 3,
      speed: 1,
      mission: 2,
      battle: 1,
      bossrush: 0
    },

    difficultyBonus: {
      easy: 1,
      normal: 0,
      hard: -1,
      challenge: -1
    }
  };

  const VOCAB_LEADERBOARD = {
    key: "VOCAB_MODE_LEADERBOARD",
    maxRowsPerMode: 30,
    showTop: 5,
    assistedScoreMultiplier: 0.95
  };

  const VOCAB_QUALITY = {
    recentTerms: [],
    recentPrompts: [],
    maxRecentTerms: 10,
    maxRecentPrompts: 8,
    rngSeed: null
  };

  const VOCAB_BANKS = {
    A: [
      { term:"algorithm", meaning:"step-by-step instructions to solve a problem", category:"coding" },
      { term:"debug", meaning:"to find and fix errors in code", category:"coding" },
      { term:"variable", meaning:"a named value that can change in a program", category:"coding" },
      { term:"function", meaning:"a reusable block of code that performs a task", category:"coding" },
      { term:"loop", meaning:"a command that repeats actions", category:"coding" },
      { term:"database", meaning:"a system for storing and managing data", category:"data" },
      { term:"interface", meaning:"the part of a system users interact with", category:"ui" },
      { term:"deploy", meaning:"to publish or release a system for users", category:"software" },
      { term:"input", meaning:"data entered into a system", category:"software" },
      { term:"output", meaning:"result produced by a system", category:"software" },
      { term:"server", meaning:"a computer or system that provides services or data", category:"software" },
      { term:"client", meaning:"a program or user that requests a service", category:"software" },
      { term:"code", meaning:"instructions written for a computer to run", category:"coding" },
      { term:"syntax", meaning:"rules for writing code correctly", category:"coding" },
      { term:"compile", meaning:"to convert code into a form a computer can run", category:"coding" },

      { term:"API", meaning:"a way for software systems to communicate with each other", category:"software" },
      { term:"array", meaning:"a list-like data structure that stores multiple values", category:"coding" },
      { term:"object", meaning:"a data structure with properties and values", category:"coding" },
      { term:"string", meaning:"text data in a program", category:"coding" },
      { term:"integer", meaning:"a whole number without decimals", category:"coding" },
      { term:"boolean", meaning:"a true or false value", category:"coding" },
      { term:"condition", meaning:"a rule that decides what code should run", category:"coding" },
      { term:"parameter", meaning:"a value a function receives to work with", category:"coding" },
      { term:"argument", meaning:"a value passed into a function when it is called", category:"coding" },
      { term:"return value", meaning:"the result sent back by a function", category:"coding" },
      { term:"library", meaning:"a collection of reusable code", category:"software" },
      { term:"framework", meaning:"a structured set of tools for building software", category:"software" },
      { term:"repository", meaning:"a place where project code is stored and managed", category:"software" },
      { term:"commit", meaning:"a saved change in a version control system", category:"software" },
      { term:"branch", meaning:"a separate line of code development", category:"software" },
      { term:"merge", meaning:"to combine changes from one branch into another", category:"software" },
      { term:"request", meaning:"a message asking a server for data or action", category:"software" },
      { term:"response", meaning:"the message a server sends back after a request", category:"software" },
      { term:"endpoint", meaning:"a specific URL where an API can be accessed", category:"software" },
      { term:"authentication", meaning:"the process of checking who a user is", category:"security" },
      { term:"permission", meaning:"the right to access or do something in a system", category:"security" },
      { term:"cache", meaning:"temporary stored data used to make a system faster", category:"software" },
      { term:"backup", meaning:"a copy of data kept for safety", category:"software" },
      { term:"query", meaning:"a request to search or get data from a database", category:"data" },
      { term:"exception", meaning:"an error or unusual condition in a program", category:"coding" },
      { term:"test case", meaning:"a set of steps used to check if software works correctly", category:"testing" },
      { term:"unit test", meaning:"a test for one small part of a program", category:"testing" },
      { term:"integration test", meaning:"a test that checks if several parts work together", category:"testing" },
      { term:"documentation", meaning:"written information that explains how a system works", category:"software" },
      { term:"refactor", meaning:"to improve code structure without changing its behavior", category:"coding" },
      { term:"module", meaning:"a separate part of a program", category:"software" },
      { term:"package", meaning:"a bundled set of code or software resources", category:"software" },
      { term:"dependency", meaning:"software that another program needs to run", category:"software" },
      { term:"build", meaning:"the process of preparing software to run or release", category:"software" },
      { term:"runtime", meaning:"the period or environment when a program is running", category:"software" }
    ],

    B: [
      { term:"dataset", meaning:"a collection of data used for analysis or training", category:"ai" },
      { term:"model", meaning:"a system trained to make predictions or decisions", category:"ai" },
      { term:"training", meaning:"the process of teaching an AI model using data", category:"ai" },
      { term:"prediction", meaning:"an estimated result made by a model", category:"ai" },
      { term:"accuracy", meaning:"how often answers or predictions are correct", category:"ai" },
      { term:"classification", meaning:"putting items into groups or categories", category:"ai" },
      { term:"prompt", meaning:"an instruction given to an AI system", category:"ai" },
      { term:"automation", meaning:"using technology to do tasks automatically", category:"tech" },
      { term:"analytics", meaning:"the process of studying data to find insights", category:"data" },
      { term:"dashboard", meaning:"a screen that shows important information", category:"data" },
      { term:"insight", meaning:"a useful understanding found from data", category:"data" },
      { term:"label", meaning:"a name or category assigned to data", category:"ai" },
      { term:"feature", meaning:"an input or property used by a model", category:"ai" },
      { term:"bias", meaning:"a pattern that can make results unfair or inaccurate", category:"ai" },
      { term:"evaluate", meaning:"to check how well a model or system works", category:"ai" },

      { term:"feature engineering", meaning:"creating useful input features for a machine learning model", category:"ai" },
      { term:"overfitting", meaning:"when a model learns training data too closely and performs poorly on new data", category:"ai" },
      { term:"underfitting", meaning:"when a model is too simple to learn the pattern well", category:"ai" },
      { term:"validation set", meaning:"data used to tune and check a model during development", category:"ai" },
      { term:"testing set", meaning:"data used to evaluate a model after training", category:"ai" },
      { term:"training set", meaning:"data used to teach a model", category:"ai" },
      { term:"neural network", meaning:"a model inspired by connected layers of artificial neurons", category:"ai" },
      { term:"embedding", meaning:"a numeric representation of text, image, or data meaning", category:"ai" },
      { term:"token", meaning:"a small unit of text processed by an AI model", category:"ai" },
      { term:"inference", meaning:"using a trained model to produce an answer or prediction", category:"ai" },
      { term:"confidence", meaning:"how sure a model is about its prediction", category:"ai" },
      { term:"recall", meaning:"how many relevant items a model successfully finds", category:"ai" },
      { term:"precision", meaning:"how many selected items are actually correct", category:"ai" },
      { term:"confusion matrix", meaning:"a table showing correct and incorrect classification results", category:"ai" },
      { term:"regression", meaning:"predicting a number or continuous value", category:"ai" },
      { term:"clustering", meaning:"grouping similar items without predefined labels", category:"ai" },
      { term:"anomaly detection", meaning:"finding unusual patterns or outliers in data", category:"ai" },
      { term:"data cleaning", meaning:"fixing or removing incorrect or messy data", category:"data" },
      { term:"data pipeline", meaning:"a process that moves and prepares data step by step", category:"data" },
      { term:"visualization", meaning:"showing data as charts or graphics", category:"data" },
      { term:"metric", meaning:"a number used to measure performance", category:"data" },
      { term:"baseline", meaning:"a simple standard result used for comparison", category:"ai" },
      { term:"hyperparameter", meaning:"a setting chosen before model training", category:"ai" },
      { term:"label noise", meaning:"incorrect or inconsistent labels in training data", category:"ai" },
      { term:"annotation", meaning:"adding labels or notes to data", category:"ai" },
      { term:"generative AI", meaning:"AI that creates text, images, audio, or other content", category:"ai" },
      { term:"chatbot", meaning:"a program that talks with users through text or voice", category:"ai" },
      { term:"recommendation system", meaning:"a system that suggests items based on data", category:"ai" },
      { term:"computer vision", meaning:"AI that understands images or videos", category:"ai" },
      { term:"natural language processing", meaning:"AI that works with human language", category:"ai" },
      { term:"supervised learning", meaning:"learning from examples with correct labels", category:"ai" },
      { term:"unsupervised learning", meaning:"learning patterns from data without labels", category:"ai" },
      { term:"reinforcement learning", meaning:"learning by receiving rewards or penalties from actions", category:"ai" },
      { term:"data privacy", meaning:"protecting personal or sensitive data", category:"data" },
      { term:"model drift", meaning:"when a model becomes less accurate because real data changes", category:"ai" }
    ],

    C: [
      { term:"requirement", meaning:"something a client or user needs from a system", category:"project" },
      { term:"deadline", meaning:"the final time or date to finish work", category:"project" },
      { term:"feedback", meaning:"comments or advice used to improve work", category:"project" },
      { term:"prototype", meaning:"an early version of a product for testing", category:"project" },
      { term:"presentation", meaning:"a talk or display used to explain ideas", category:"workplace" },
      { term:"meeting", meaning:"a planned discussion with people", category:"workplace" },
      { term:"client", meaning:"a person or organization that receives a service", category:"workplace" },
      { term:"feature", meaning:"a function or part of a product", category:"software" },
      { term:"bug report", meaning:"a document that explains a problem in software", category:"software" },
      { term:"update", meaning:"a newer version or improvement of software", category:"software" },
      { term:"teamwork", meaning:"working together with other people", category:"workplace" },
      { term:"schedule", meaning:"a plan that shows when tasks will happen", category:"project" },
      { term:"task", meaning:"a piece of work that needs to be done", category:"project" },
      { term:"progress", meaning:"movement toward finishing a task or goal", category:"project" },
      { term:"solution", meaning:"a way to solve a problem", category:"workplace" },

      { term:"stakeholder", meaning:"a person or group affected by a project", category:"project" },
      { term:"scope", meaning:"the boundaries of what a project will and will not include", category:"project" },
      { term:"milestone", meaning:"an important point or achievement in a project timeline", category:"project" },
      { term:"deliverable", meaning:"a finished item or result that must be delivered", category:"project" },
      { term:"sprint", meaning:"a short planned work period in agile development", category:"project" },
      { term:"backlog", meaning:"a list of tasks or features waiting to be done", category:"project" },
      { term:"priority", meaning:"the level of importance of a task", category:"project" },
      { term:"risk", meaning:"a possible problem that could affect a project", category:"project" },
      { term:"issue", meaning:"a problem that needs attention", category:"project" },
      { term:"approval", meaning:"official permission or agreement", category:"workplace" },
      { term:"requirement change", meaning:"a change to what the system must do", category:"project" },
      { term:"user story", meaning:"a short description of what a user needs and why", category:"project" },
      { term:"acceptance criteria", meaning:"conditions that must be met for work to be accepted", category:"project" },
      { term:"status update", meaning:"a short report about current progress", category:"workplace" },
      { term:"handover", meaning:"passing work or responsibility to another person", category:"workplace" },
      { term:"maintenance", meaning:"ongoing work to keep a system working well", category:"software" },
      { term:"support ticket", meaning:"a record of a user problem or request", category:"workplace" },
      { term:"incident", meaning:"an unexpected problem that affects service", category:"workplace" },
      { term:"escalation", meaning:"moving an issue to a higher support level", category:"workplace" },
      { term:"negotiation", meaning:"discussion to reach an agreement", category:"workplace" },
      { term:"proposal", meaning:"a document that suggests a plan or solution", category:"workplace" },
      { term:"quotation", meaning:"a document showing the expected price", category:"workplace" },
      { term:"invoice", meaning:"a document requesting payment", category:"workplace" },
      { term:"contract", meaning:"a formal agreement between parties", category:"workplace" },
      { term:"stakeholder meeting", meaning:"a meeting with people affected by a project", category:"project" },
      { term:"progress report", meaning:"a document explaining how much work is finished", category:"project" },
      { term:"timeline", meaning:"a plan showing when tasks should happen", category:"project" },
      { term:"budget", meaning:"the amount of money planned for a project", category:"project" },
      { term:"resource", meaning:"people, time, money, or tools used for work", category:"project" },
      { term:"responsibility", meaning:"a duty or task a person must handle", category:"workplace" },
      { term:"collaboration", meaning:"working together with others", category:"workplace" },
      { term:"user training", meaning:"teaching users how to use a system", category:"workplace" },
      { term:"rollout", meaning:"the planned release of a system to users", category:"project" },
      { term:"requirement analysis", meaning:"studying what users or clients need", category:"project" }
    ]
  };

  const VOCAB_PUBLIC_LABELS = {
    banks: {
      A: {
        title: "Bank A",
        label: "Basic CS Words",
        description: "คำพื้นฐานสาย Coding / Software"
      },
      B: {
        title: "Bank B",
        label: "AI / Data Words",
        description: "คำศัพท์ AI, Data, Dashboard"
      },
      C: {
        title: "Bank C",
        label: "Workplace / Project",
        description: "คำใช้จริงในงาน ทีม ลูกค้า และโปรเจกต์"
      }
    }
  };

  window.VOCAB_APP = VOCAB_APP;
  window.VOCAB_DIFFICULTY = VOCAB_DIFFICULTY;
  window.VOCAB_PLAY_MODES = VOCAB_PLAY_MODES;
  window.VOCAB_ENEMIES = VOCAB_ENEMIES;
  window.VOCAB_STAGES = VOCAB_STAGES;
  window.VOCAB_POWER = VOCAB_POWER;
  window.VOCAB_AI_HELP = VOCAB_AI_HELP;
  window.VOCAB_LEADERBOARD = VOCAB_LEADERBOARD;
  window.VOCAB_QUALITY = VOCAB_QUALITY;
  window.VOCAB_BANKS = VOCAB_BANKS;
  window.VOCAB_PUBLIC_LABELS = VOCAB_PUBLIC_LABELS;

  window.VOCAB_CONFIG = {
    app: VOCAB_APP,
    difficulty: VOCAB_DIFFICULTY,
    playModes: VOCAB_PLAY_MODES,
    enemies: VOCAB_ENEMIES,
    stages: VOCAB_STAGES,
    power: VOCAB_POWER,
    aiHelp: VOCAB_AI_HELP,
    leaderboard: VOCAB_LEADERBOARD,
    quality: VOCAB_QUALITY,
    banks: VOCAB_BANKS,
    publicLabels: VOCAB_PUBLIC_LABELS
  };

  console.log("[VOCAB] config loaded", VOCAB_APP.version);

})();
