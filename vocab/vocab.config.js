/* =========================================================
   /vocab/vocab.config.js
   TechPath Vocab Arena — Central Config
   ใช้กำหนด endpoint / version / storage keys / default options
   ========================================================= */
(function(){
  "use strict";

  window.VOCAB_APP_CONFIG = {
    version: "vocab-split-v1-20260501",
    publicTitle: "TechPath Vocab Arena",
    publicSubtitle: "CS/AI Vocabulary Challenge",

    /*
      Endpoint ล่าสุด
      ถ้าเปลี่ยน Apps Script ในอนาคต ให้แก้ไฟล์นี้ไฟล์เดียว
    */
    endpoint: "https://script.google.com/macros/s/AKfycbwsW0ffV5W_A81bNdcj32TDvgVBEUOk6IDPqqmqpePCVhY0X56dEv1XIOh2ygu0AG7i/exec?api=vocab",

    api: "vocab",
    source: "vocab.html",
    schema: "vocab-split-v1",

    storage: {
      queueKey: "VOCAB_SPLIT_LOG_QUEUE",
      profileKey: "VOCAB_SPLIT_STUDENT_PROFILE",
      teacherKey: "VOCAB_SPLIT_TEACHER_LAST",
      leaderboardKey: "VOCAB_SPLIT_LEADERBOARD",
      lastSummaryKey: "VOCAB_SPLIT_LAST_SUMMARY",
      soundKey: "VOCAB_SPLIT_SOUND_ON"
    },

    defaults: {
      bank: "A",
      difficulty: "easy",
      mode: "learn",
      enableSheetLog: true,
      enableConsoleLog: true
    },

    difficulty: {
      easy: {
        label: "Easy",
        totalQuestions: 8,
        timePerQuestion: 18,
        playerHp: 5,
        preview: "✨ Easy: 8 ข้อ เวลาเยอะ HP มาก เหมาะกับการทบทวน"
      },
      normal: {
        label: "Normal",
        totalQuestions: 10,
        timePerQuestion: 14,
        playerHp: 4,
        preview: "⚔️ Normal: 10 ข้อ เริ่มมีแรงกดดัน และตัวเลือกหลอกดีขึ้น"
      },
      hard: {
        label: "Hard",
        totalQuestions: 12,
        timePerQuestion: 11,
        playerHp: 3,
        preview: "🔥 Hard: 12 ข้อ HP น้อยลง ตัวเลือกยากขึ้น และต้องตอบแม่น"
      },
      challenge: {
        label: "Challenge",
        totalQuestions: 15,
        timePerQuestion: 8,
        playerHp: 2,
        preview: "💀 Challenge: 15 ข้อ เวลาน้อย HP น้อย ตัวเลือกหลอกหนักสุด"
      }
    },

    modes: {
      learn: {
        id: "learn",
        label: "AI Training",
        shortLabel: "AI",
        icon: "🤖",
        description: "เรียนรู้คำศัพท์แบบค่อยเป็นค่อยไป มี Hint และคำอธิบายชัด",
        startHints: 3,
        startShield: 2,
        timeBonus: 5,
        scoreMultiplier: 0.9,
        stageOrder: ["warmup", "warmup", "trap", "mission"]
      },
      speed: {
        id: "speed",
        label: "Speed Run",
        shortLabel: "Speed",
        icon: "⚡",
        description: "ตอบให้ไว ทำ Combo เก็บคะแนน และเข้า Fever เร็ว",
        startHints: 1,
        startShield: 1,
        timeBonus: -4,
        scoreMultiplier: 1.15,
        stageOrder: ["warmup", "speed", "speed", "trap", "boss"]
      },
      mission: {
        id: "mission",
        label: "Debug Mission",
        shortLabel: "Mission",
        icon: "🎯",
        description: "อ่านสถานการณ์จริง แล้วเลือกคำศัพท์ที่เหมาะสมที่สุด",
        startHints: 2,
        startShield: 1,
        timeBonus: 2,
        scoreMultiplier: 1.05,
        stageOrder: ["warmup", "mission", "mission", "trap", "boss"]
      },
      battle: {
        id: "battle",
        label: "Boss Battle",
        shortLabel: "Boss",
        icon: "👾",
        description: "โหมดต่อสู้เต็มระบบ มีบอส HP, Fever, Laser และ Shield",
        startHints: 1,
        startShield: 1,
        timeBonus: -2,
        scoreMultiplier: 1.25,
        stageOrder: ["warmup", "speed", "trap", "mission", "boss", "boss"]
      }
    },

    banks: {
      A: {
        label: "Bank A",
        title: "Basic CS Words",
        desc: "คำพื้นฐานสาย Coding / Software"
      },
      B: {
        label: "Bank B",
        title: "AI / Data Words",
        desc: "คำศัพท์ AI, Data, Dashboard"
      },
      C: {
        label: "Bank C",
        title: "Workplace / Project",
        desc: "คำใช้จริงในงาน ทีม ลูกค้า และโปรเจกต์"
      }
    }
  };

  /*
    ให้ไฟล์อื่นเรียกใช้ endpoint ได้ง่าย
  */
  window.VOCAB_SHEET_ENDPOINT = window.VOCAB_APP_CONFIG.endpoint;

  console.log("[VOCAB CONFIG] loaded", window.VOCAB_APP_CONFIG.version);
})();
