/* =========================================================
   /vocab/vocab.question.js
   TechPath Vocab Arena
   Question Builder / Deck Builder / Distractors
   ========================================================= */

"use strict";

/* =========================================================
   DIFFICULTY FEEL
========================================================= */

const VOCAB_DIFFICULTY_FEEL_V71 = {
  easy: {
    label: "Easy",
    choiceCount: 4,
    timeAdd: 4,
    attackBase: 1,
    attackStageBonus: 0,
    damageScale: 1.15,
    crossBankCount: 0,
    preview: "✨ Easy: คำถามตรง 4 ตัวเลือก เวลาเยอะ เหมาะกับเริ่มจำความหมาย"
  },

  normal: {
    label: "Normal",
    choiceCount: 4,
    timeAdd: 0,
    attackBase: 1,
    attackStageBonus: 1,
    damageScale: 1,
    crossBankCount: 0,
    preview: "⚔️ Normal: สลับนิยาม/สถานการณ์ มีตัวเลือกหลอก ต้องเข้าใจมากขึ้น"
  },

  hard: {
    label: "Hard",
    choiceCount: 5,
    timeAdd: -2,
    attackBase: 2,
    attackStageBonus: 1,
    damageScale: 0.86,
    crossBankCount: 10,
    preview: "🔥 Hard: 5 ตัวเลือก โจทย์บริบทมากขึ้น มีคำข้าม Bank เป็นตัวหลอก"
  },

  challenge: {
    label: "Challenge",
    choiceCount: 5,
    timeAdd: -4,
    attackBase: 3,
    attackStageBonus: 2,
    damageScale: 0.72,
    crossBankCount: 20,
    preview: "💀 Challenge: 5 ตัวเลือก ผสมหลาย Bank เวลาเร็ว ตัวเลือกหลอกหนักสุด"
  }
};

function getDifficultyFeelV71(difficulty){
  return VOCAB_DIFFICULTY_FEEL_V71[difficulty || "easy"] || VOCAB_DIFFICULTY_FEEL_V71.easy;
}

/* =========================================================
   VOCAB EXPANSION
========================================================= */

const VOCAB_EXTRA_TERMS_V71 = {
  A: [
    ["API", "a way for software systems to communicate with each other", "software"],
    ["array", "a list-like data structure that stores multiple values", "coding"],
    ["object", "a data structure with properties and values", "coding"],
    ["string", "text data in a program", "coding"],
    ["integer", "a whole number without decimals", "coding"],
    ["boolean", "a true or false value", "coding"],
    ["condition", "a rule that decides what code should run", "coding"],
    ["parameter", "a value a function receives to work with", "coding"],
    ["argument", "a value passed into a function when it is called", "coding"],
    ["return value", "the result sent back by a function", "coding"],
    ["library", "a collection of reusable code", "software"],
    ["framework", "a structured set of tools for building software", "software"],
    ["repository", "a place where project code is stored and managed", "software"],
    ["commit", "a saved change in a version control system", "software"],
    ["branch", "a separate line of code development", "software"],
    ["merge", "to combine changes from one branch into another", "software"],
    ["request", "a message asking a server for data or action", "software"],
    ["response", "the message a server sends back after a request", "software"],
    ["endpoint", "a specific URL where an API can be accessed", "software"],
    ["authentication", "the process of checking who a user is", "security"],
    ["permission", "the right to access or do something in a system", "security"],
    ["cache", "temporary stored data used to make a system faster", "software"],
    ["backup", "a copy of data kept for safety", "software"],
    ["query", "a request to search or get data from a database", "data"],
    ["exception", "an error or unusual condition in a program", "coding"],
    ["test case", "a set of steps used to check if software works correctly", "testing"],
    ["unit test", "a test for one small part of a program", "testing"],
    ["integration test", "a test that checks if several parts work together", "testing"],
    ["documentation", "written information that explains how a system works", "software"],
    ["refactor", "to improve code structure without changing its behavior", "coding"],
    ["module", "a separate part of a program", "software"],
    ["package", "a bundled set of code or software resources", "software"],
    ["dependency", "software that another program needs to run", "software"],
    ["build", "the process of preparing software to run or release", "software"],
    ["runtime", "the period or environment when a program is running", "software"]
  ],

  B: [
    ["feature engineering", "creating useful input features for a machine learning model", "ai"],
    ["overfitting", "when a model learns training data too closely and performs poorly on new data", "ai"],
    ["underfitting", "when a model is too simple to learn the pattern well", "ai"],
    ["validation set", "data used to tune and check a model during development", "ai"],
    ["testing set", "data used to evaluate a model after training", "ai"],
    ["training set", "data used to teach a model", "ai"],
    ["neural network", "a model inspired by connected layers of artificial neurons", "ai"],
    ["embedding", "a numeric representation of text, image, or data meaning", "ai"],
    ["token", "a small unit of text processed by an AI model", "ai"],
    ["inference", "using a trained model to produce an answer or prediction", "ai"],
    ["confidence", "how sure a model is about its prediction", "ai"],
    ["recall", "how many relevant items a model successfully finds", "ai"],
    ["precision", "how many selected items are actually correct", "ai"],
    ["confusion matrix", "a table showing correct and incorrect classification results", "ai"],
    ["regression", "predicting a number or continuous value", "ai"],
    ["clustering", "grouping similar items without predefined labels", "ai"],
    ["anomaly detection", "finding unusual patterns or outliers in data", "ai"],
    ["data cleaning", "fixing or removing incorrect or messy data", "data"],
    ["data pipeline", "a process that moves and prepares data step by step", "data"],
    ["visualization", "showing data as charts or graphics", "data"],
    ["metric", "a number used to measure performance", "data"],
    ["baseline", "a simple standard result used for comparison", "ai"],
    ["hyperparameter", "a setting chosen before model training", "ai"],
    ["label noise", "incorrect or inconsistent labels in training data", "ai"],
    ["annotation", "adding labels or notes to data", "ai"],
    ["generative AI", "AI that creates text, images, audio, or other content", "ai"],
    ["chatbot", "a program that talks with users through text or voice", "ai"],
    ["recommendation system", "a system that suggests items based on data", "ai"],
    ["computer vision", "AI that understands images or videos", "ai"],
    ["natural language processing", "AI that works with human language", "ai"],
    ["supervised learning", "learning from examples with correct labels", "ai"],
    ["unsupervised learning", "learning patterns from data without labels", "ai"],
    ["reinforcement learning", "learning by receiving rewards or penalties from actions", "ai"],
    ["data privacy", "protecting personal or sensitive data", "data"],
    ["model drift", "when a model becomes less accurate because real data changes", "ai"]
  ],

  C: [
    ["stakeholder", "a person or group affected by a project", "project"],
    ["scope", "the boundaries of what a project will and will not include", "project"],
    ["milestone", "an important point or achievement in a project timeline", "project"],
    ["deliverable", "a finished item or result that must be delivered", "project"],
    ["sprint", "a short planned work period in agile development", "project"],
    ["backlog", "a list of tasks or features waiting to be done", "project"],
    ["priority", "the level of importance of a task", "project"],
    ["risk", "a possible problem that could affect a project", "project"],
    ["issue", "a problem that needs attention", "project"],
    ["approval", "official permission or agreement", "workplace"],
    ["requirement change", "a change to what the system must do", "project"],
    ["user story", "a short description of what a user needs and why", "project"],
    ["acceptance criteria", "conditions that must be met for work to be accepted", "project"],
    ["status update", "a short report about current progress", "workplace"],
    ["handover", "passing work or responsibility to another person", "workplace"],
    ["maintenance", "ongoing work to keep a system working well", "software"],
    ["support ticket", "a record of a user problem or request", "workplace"],
    ["incident", "an unexpected problem that affects service", "workplace"],
    ["escalation", "moving an issue to a higher support level", "workplace"],
    ["negotiation", "discussion to reach an agreement", "workplace"],
    ["proposal", "a document that suggests a plan or solution", "workplace"],
    ["quotation", "a document showing the expected price", "workplace"],
    ["invoice", "a document requesting payment", "workplace"],
    ["contract", "a formal agreement between parties", "workplace"],
    ["stakeholder meeting", "a meeting with people affected by a project", "project"],
    ["progress report", "a document explaining how much work is finished", "project"],
    ["timeline", "a plan showing when tasks should happen", "project"],
    ["budget", "the amount of money planned for a project", "project"],
    ["resource", "people, time, money, or tools used for work", "project"],
    ["responsibility", "a duty or task a person must handle", "workplace"],
    ["collaboration", "working together with others", "workplace"],
    ["user training", "teaching users how to use a system", "workplace"],
    ["rollout", "the planned release of a system to users", "project"],
    ["requirement analysis", "studying what users or clients need", "project"]
  ]
};

function applyVocabularyExpansionV71(){
  Object.keys(VOCAB_EXTRA_TERMS_V71).forEach(bank => {
    if(!VOCAB_BANKS[bank]) VOCAB_BANKS[bank] = [];

    const seen = new Set(
      VOCAB_BANKS[bank].map(t => String(t.term || "").toLowerCase())
    );

    VOCAB_EXTRA_TERMS_V71[bank].forEach(row => {
      const item = {
        term: row[0],
        meaning: row[1],
        category: row[2]
      };

      const key = String(item.term || "").toLowerCase();

      if(key && !seen.has(key)){
        VOCAB_BANKS[bank].push(item);
        seen.add(key);
      }
    });
  });
}

/* =========================================================
   TERM NORMALIZATION
========================================================= */

function normalizeTermV61(t){
  return {
    term: String(t.term || t.word || "").trim(),
    meaning: String(t.meaning || t.definition || t.th || t.translation || "").trim(),
    category: String(t.category || t.group || t.type || "").trim(),
    example: String(t.example || t.sentence || "").trim(),
    level: String(t.level || "").trim(),
    bank: String(t.bank || "").trim()
  };
}

function getTermsForBankV6(bank){
  if(window.VOCAB_BANKS && Array.isArray(window.VOCAB_BANKS[bank])){
    return window.VOCAB_BANKS[bank];
  }

  if(window.WORD_BANKS && Array.isArray(window.WORD_BANKS[bank])){
    return window.WORD_BANKS[bank];
  }

  return VOCAB_BANKS[bank] || VOCAB_BANKS.A || [];
}

function sampleTermsV71(list, count){
  const pool = shuffleV61(
    (list || [])
      .map(normalizeTermV61)
      .filter(t => t.term && t.meaning)
  );

  return pool.slice(0, Math.max(0, count || 0));
}

function buildTermDeckV71(bank, difficulty){
  applyVocabularyExpansionV71();

  const feel = getDifficultyFeelV71(difficulty);
  const main = getTermsForBankV6(bank)
    .map(t => ({
      ...normalizeTermV61(t),
      bank
    }))
    .filter(t => t.term && t.meaning);

  let deck = main.slice();

  if((feel.crossBankCount || 0) > 0){
    const otherBanks = Object.keys(VOCAB_BANKS).filter(b => b !== bank);

    const others = otherBanks.flatMap(b =>
      getTermsForBankV6(b).map(t => ({
        ...normalizeTermV61(t),
        bank: b
      }))
    );

    deck = deck.concat(sampleTermsV71(others, feel.crossBankCount));
  }

  const seen = new Set();

  return shuffleV61(deck.filter(t => {
    const key = String(t.term || "").toLowerCase();
    if(!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }));
}

/* =========================================================
   TERM HISTORY / NO REPEAT
========================================================= */

function getHistoryKeyV71(){
  return `VOCAB_TERM_HISTORY_${vocabGame.bank || VOCAB_APP.selectedBank || "A"}_${vocabGame.difficulty || VOCAB_APP.selectedDifficulty || "easy"}_${vocabGame.mode || VOCAB_APP.selectedMode || "learn"}`;
}

function readTermHistoryV71(){
  if(typeof readJsonV63 === "function"){
    return readJsonV63(getHistoryKeyV71(), {});
  }

  try{
    return JSON.parse(localStorage.getItem(getHistoryKeyV71()) || "{}") || {};
  }catch(e){
    return {};
  }
}

function saveTermHistoryV71(history){
  try{
    localStorage.setItem(getHistoryKeyV71(), JSON.stringify(history || {}));
  }catch(e){}
}

function pickNextTermV61(terms){
  const clean = (terms || [])
    .map(normalizeTermV61)
    .filter(t => t.term && t.meaning);

  if(!clean.length){
    return {
      term: "debug",
      meaning: "to find and fix errors in code",
      category: "coding",
      bank: "A"
    };
  }

  if(clean.length <= 1){
    return clean[0];
  }

  if(!vocabGame.sessionTermUse){
    vocabGame.sessionTermUse = {};
  }

  const history = readTermHistoryV71();
  const recent = new Set(
    (VOCAB_QUALITY.recentTerms || []).map(x => String(x).toLowerCase())
  );

  const ranked = clean.map(t => {
    const key = String(t.term || "").toLowerCase();

    const sessionUsePenalty = Number(vocabGame.sessionTermUse[key] || 0) * 1000;
    const historyPenalty = Number(history[key] || 0) * 6;
    const recentPenalty = recent.has(key) ? 80 : 0;
    const randomNoise = randV61();

    return {
      term: t,
      score: sessionUsePenalty + historyPenalty + recentPenalty + randomNoise
    };
  });

  ranked.sort((a, b) => a.score - b.score);

  return ranked[0].term;
}

function rememberQuestionV61(term, prompt){
  const word = String(term?.term || "").toLowerCase();

  if(!vocabGame.sessionTermUse){
    vocabGame.sessionTermUse = {};
  }

  if(word){
    vocabGame.sessionTermUse[word] = Number(vocabGame.sessionTermUse[word] || 0) + 1;

    VOCAB_QUALITY.recentTerms.push(word);

    while(VOCAB_QUALITY.recentTerms.length > VOCAB_QUALITY.maxRecentTerms){
      VOCAB_QUALITY.recentTerms.shift();
    }

    const history = readTermHistoryV71();
    history[word] = Number(history[word] || 0) + 1;
    saveTermHistoryV71(history);
  }

  if(prompt){
    VOCAB_QUALITY.recentPrompts.push(String(prompt).slice(0, 140));

    while(VOCAB_QUALITY.recentPrompts.length > VOCAB_QUALITY.maxRecentPrompts){
      VOCAB_QUALITY.recentPrompts.shift();
    }
  }
}

function resetVocabMemoryV71(){
  try{
    Object.keys(localStorage).forEach(k => {
      if(String(k).startsWith("VOCAB_TERM_HISTORY_")){
        localStorage.removeItem(k);
      }
    });

    alert("ล้างประวัติคำศัพท์แล้ว รอบต่อไปจะสุ่ม deck ใหม่");
  }catch(e){
    alert("ล้างประวัติไม่ได้: " + e.message);
  }
}

/* =========================================================
   QUESTION BUILDER
========================================================= */

function buildQuestionV6(stage){
  const terms = vocabGame.terms || [];
  const correctTerm = pickNextTermV61(terms);
  const blueprint = buildQuestionBlueprintV71(correctTerm, stage);

  rememberQuestionV61(correctTerm, blueprint.prompt);

  const choices = buildChoicesV61({
    correctTerm,
    allTerms: terms,
    answerMode: blueprint.answerMode,
    stageId: stage.id,
    difficulty: vocabGame.difficulty,
    bank: vocabGame.bank
  });

  return {
    id: `q_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    stageId: stage.id,
    mode: blueprint.mode,
    answerMode: blueprint.answerMode,
    prompt: blueprint.prompt,
    correctTerm,
    choices,
    explain: blueprint.explain || "",
    difficultyNote: blueprint.difficultyNote || ""
  };
}

function buildQuestionBlueprintV71(term, stage){
  const difficulty = vocabGame.difficulty || "easy";
  const stageId = stage?.id || "warmup";
  const roll = randV61();

  if(difficulty === "easy"){
    if(stageId === "mission" || roll > 0.68){
      return {
        mode: "easy_reverse",
        answerMode: "term",
        prompt: `Which word means: "${term.meaning}"?`,
        explain: `The word is "${term.term}".`
      };
    }

    return buildWarmupQuestionV61(term);
  }

  if(difficulty === "normal"){
    if(stageId === "mission" || stageId === "boss" || roll > 0.45){
      return {
        mode: "normal_context",
        answerMode: "term",
        prompt: buildSituationPromptV71(term, false),
        explain: `In this context, the best word is "${term.term}".`
      };
    }

    return {
      mode: "normal_meaning",
      answerMode: "meaning",
      prompt: `Choose the best meaning of "${term.term}".`,
      explain: `"${term.term}" means "${term.meaning}".`
    };
  }

  if(difficulty === "hard"){
    if(stageId === "trap" || roll > 0.35){
      return {
        mode: "hard_precision_context",
        answerMode: "term",
        prompt: buildSituationPromptV71(term, true),
        explain: `The precise term is "${term.term}".`
      };
    }

    return {
      mode: "hard_reverse_definition",
      answerMode: "term",
      prompt: `Pick the most accurate technical word for this definition: "${term.meaning}"`,
      explain: `The accurate word is "${term.term}".`
    };
  }

  if(stageId === "boss" || stageId === "trap" || roll > 0.25){
    return {
      mode: "challenge_workplace_case",
      answerMode: "term",
      prompt: buildChallengeCaseV71(term),
      explain: `The best answer is "${term.term}" because it matches: ${term.meaning}`
    };
  }

  return {
    mode: "challenge_precision_meaning",
    answerMode: "meaning",
    prompt: `Precision check: which definition best matches "${term.term}" in a CS/AI project?`,
    explain: `"${term.term}" = ${term.meaning}`
  };
}

/* =========================================================
   BASIC QUESTION TYPES
========================================================= */

function buildWarmupQuestionV61(term){
  return {
    mode: "meaning",
    answerMode: "meaning",
    prompt: pickTemplateV61([
      `What does "${term.term}" mean?`,
      `Choose the best meaning of "${term.term}".`,
      `"${term.term}" is closest to which meaning?`
    ]),
    explain: `"${term.term}" means "${term.meaning}".`
  };
}

function buildSpeedQuestionV61(term){
  return {
    mode: "quick",
    answerMode: "meaning",
    prompt: pickTemplateV61([
      `Quick! "${term.term}" means...`,
      `Fast answer: choose the meaning of "${term.term}".`,
      `Speed Round: what is "${term.term}"?`
    ]),
    explain: `Speed question: "${term.term}" = "${term.meaning}".`
  };
}

function buildTrapQuestionV61(term){
  return {
    mode: "trap",
    answerMode: "meaning",
    prompt: pickTemplateV61([
      `Careful! Which meaning truly matches "${term.term}"?`,
      `Trap Round: do not choose a similar-but-wrong meaning. What is "${term.term}"?`,
      `"${term.term}" is often confused with other words. Pick the correct meaning.`
    ]),
    explain: `Trap clue: focus on the exact meaning of "${term.term}".`
  };
}

function buildMissionQuestionV61(term){
  return {
    mode: "context",
    answerMode: "term",
    prompt: buildSituationPromptV61(term),
    explain: `The best word for this situation is "${term.term}".`
  };
}

function buildBossQuestionV61(term){
  const useContext = randV61() > 0.45;

  if(useContext){
    return {
      mode: "boss_context",
      answerMode: "term",
      prompt: `Boss Attack! ${buildSituationPromptV61(term)}`,
      explain: `Boss clue answer: "${term.term}".`
    };
  }

  return {
    mode: "boss_meaning",
    answerMode: "meaning",
    prompt: `Boss Shield! Break it by choosing the exact meaning of "${term.term}".`,
    explain: `"${term.term}" means "${term.meaning}".`
  };
}

/* =========================================================
   CONTEXT PROMPTS
========================================================= */

function buildSituationPromptV71(term, advanced){
  const base = buildSituationPromptV61(term);

  if(!advanced) return base;

  const extras = [
    "Choose the most precise technical term, not just a similar idea.",
    "Focus on what action is happening in the system.",
    "Avoid the option that sounds familiar but does not match the context.",
    "Think like a developer explaining this to a teammate."
  ];

  return `${base} ${extras[Math.floor(randV61() * extras.length)]}`;
}

function buildSituationPromptV61(term){
  const word = String(term.term || "").toLowerCase();
  const meaning = String(term.meaning || "").toLowerCase();

  const cases = [
    {
      keys: ["debug", "bug", "error"],
      text: "Your app has an error before release. You need to find and fix the problem. Which word fits best?"
    },
    {
      keys: ["deploy", "release", "publish"],
      text: "Your team finished the website and wants users to access it online. Which word fits best?"
    },
    {
      keys: ["dataset", "data"],
      text: "An AI model learns from many examples stored together. Which word fits best?"
    },
    {
      keys: ["algorithm", "step"],
      text: "A program follows step-by-step instructions to solve a problem. Which word fits best?"
    },
    {
      keys: ["database", "store"],
      text: "A system needs to store accounts, scores, and user records. Which word fits best?"
    },
    {
      keys: ["interface", "ui", "screen"],
      text: "Users click buttons, menus, and screens to use an app. Which word fits best?"
    },
    {
      keys: ["variable"],
      text: "In code, you need a named value that can change. Which word fits best?"
    },
    {
      keys: ["function"],
      text: "You want to reuse a block of code that performs a task. Which word fits best?"
    },
    {
      keys: ["loop", "repeat"],
      text: "The program must repeat the same action many times. Which word fits best?"
    },
    {
      keys: ["model", "prediction"],
      text: "An AI system is trained to make decisions or predictions. Which word fits best?"
    },
    {
      keys: ["training"],
      text: "The AI learns from data before it can answer well. Which word fits best?"
    },
    {
      keys: ["accuracy"],
      text: "You want to measure how often the answers are correct. Which word fits best?"
    },
    {
      keys: ["classification"],
      text: "The AI puts images or messages into different categories. Which word fits best?"
    },
    {
      keys: ["prompt"],
      text: "You type an instruction to an AI system. Which word fits best?"
    },
    {
      keys: ["automation"],
      text: "A task is done by technology without a person doing every step. Which word fits best?"
    },
    {
      keys: ["dashboard"],
      text: "A screen shows scores, progress, and important information. Which word fits best?"
    },
    {
      keys: ["requirement"],
      text: "A client tells the team what the system must do. Which word fits best?"
    },
    {
      keys: ["deadline"],
      text: "The project must be finished by Friday. Which word fits best?"
    },
    {
      keys: ["feedback"],
      text: "Your teacher gives comments to help improve your project. Which word fits best?"
    },
    {
      keys: ["prototype"],
      text: "Your team builds an early version to test the idea. Which word fits best?"
    },
    {
      keys: ["client"],
      text: "A company pays your team to build a system. Which word fits best?"
    },
    {
      keys: ["feature"],
      text: "Login, leaderboard, and search are parts of an app. Which word fits best?"
    },
    {
      keys: ["bug report"],
      text: "A tester writes a document explaining a software problem. Which word fits best?"
    },
    {
      keys: ["update"],
      text: "The app gets a newer version with improvements. Which word fits best?"
    },
    {
      keys: ["syntax"],
      text: "Your code has the wrong writing rules and cannot run. Which word fits best?"
    },
    {
      keys: ["compile"],
      text: "The code is converted into a form the computer can run. Which word fits best?"
    },
    {
      keys: ["schedule"],
      text: "The team plans when each task will happen. Which word fits best?"
    },
    {
      keys: ["progress"],
      text: "You report how much work is already finished. Which word fits best?"
    },
    {
      keys: ["solution"],
      text: "You find a way to solve the client's problem. Which word fits best?"
    },
    {
      keys: ["authentication"],
      text: "Before opening private data, the system checks who the user is. Which word fits best?"
    },
    {
      keys: ["permission"],
      text: "The system decides whether a user is allowed to access a feature. Which word fits best?"
    },
    {
      keys: ["cache"],
      text: "The app stores temporary data to load faster next time. Which word fits best?"
    },
    {
      keys: ["backup"],
      text: "The team keeps a copy of important data for safety. Which word fits best?"
    },
    {
      keys: ["repository"],
      text: "The team stores and manages project code in one shared place. Which word fits best?"
    },
    {
      keys: ["commit"],
      text: "A developer saves a set of code changes in version control. Which word fits best?"
    },
    {
      keys: ["branch"],
      text: "A developer works on a separate line of code without affecting the main version. Which word fits best?"
    },
    {
      keys: ["merge"],
      text: "The team combines code changes from one branch into another. Which word fits best?"
    },
    {
      keys: ["overfitting"],
      text: "A model performs well on training data but poorly on new data. Which word fits best?"
    },
    {
      keys: ["underfitting"],
      text: "A model is too simple and cannot learn the pattern well. Which word fits best?"
    },
    {
      keys: ["validation set"],
      text: "The team uses a separate data set to tune the model during development. Which word fits best?"
    },
    {
      keys: ["testing set"],
      text: "The team uses unseen data to evaluate the final model. Which word fits best?"
    },
    {
      keys: ["precision"],
      text: "The analyst checks how many selected results are actually correct. Which word fits best?"
    },
    {
      keys: ["recall"],
      text: "The analyst checks how many relevant items the model successfully found. Which word fits best?"
    },
    {
      keys: ["confusion matrix"],
      text: "The analyst uses a table to show correct and incorrect classification results. Which word fits best?"
    },
    {
      keys: ["clustering"],
      text: "The AI groups similar items without predefined labels. Which word fits best?"
    },
    {
      keys: ["anomaly detection"],
      text: "The system finds unusual patterns that may be errors or risks. Which word fits best?"
    },
    {
      keys: ["stakeholder"],
      text: "The project manager talks to people affected by the project. Which word fits best?"
    },
    {
      keys: ["scope"],
      text: "The team defines what the project will and will not include. Which word fits best?"
    },
    {
      keys: ["milestone"],
      text: "The project reaches an important checkpoint in the timeline. Which word fits best?"
    },
    {
      keys: ["deliverable"],
      text: "The client expects a finished item or result from the team. Which word fits best?"
    },
    {
      keys: ["sprint"],
      text: "The agile team works during a short planned work period. Which word fits best?"
    },
    {
      keys: ["backlog"],
      text: "The team has a list of tasks waiting to be done. Which word fits best?"
    }
  ];

  const found = cases.find(c => c.keys.some(k => word.includes(k) || meaning.includes(k)));

  if(found) return found.text;

  if(term.example){
    return `Read this situation: "${term.example}" Which word fits best?`;
  }

  return `Which word best matches this meaning: "${term.meaning}"?`;
}

function buildChallengeCaseV71(term){
  const word = String(term.term || "").toLowerCase();
  const meaning = String(term.meaning || "").toLowerCase();

  const cases = [
    {
      keys: ["api", "endpoint", "request", "response"],
      text: "Your team connects a mobile app to a server. The app sends data to a specific URL and receives data back. Which term best fits?"
    },
    {
      keys: ["authentication", "permission", "privacy"],
      text: "A user cannot open private data until the system checks who they are and what they are allowed to access. Which term best fits?"
    },
    {
      keys: ["overfitting", "underfitting", "validation", "testing set"],
      text: "A model looks excellent during practice but performs badly with new unseen data. Which term best explains the problem?"
    },
    {
      keys: ["precision", "recall", "confusion matrix", "metric"],
      text: "A data analyst must explain how well the model finds correct results and where it makes mistakes. Which term best fits?"
    },
    {
      keys: ["stakeholder", "scope", "milestone", "deliverable"],
      text: "During a project meeting, the team clarifies what must be included, who is affected, and what must be delivered. Which term best fits?"
    },
    {
      keys: ["debug", "exception", "bug report", "test case"],
      text: "Before release, a tester writes steps to reproduce an error so the developer can find and fix it. Which term best fits?"
    },
    {
      keys: ["deploy", "rollout", "release", "build"],
      text: "The system is ready and the team prepares it so real users can access it. Which term best fits?"
    },
    {
      keys: ["dataset", "label", "annotation", "data cleaning"],
      text: "Before training AI, the team prepares examples, fixes messy records, and adds categories to data. Which term best fits?"
    },
    {
      keys: ["sprint", "backlog", "priority", "acceptance criteria"],
      text: "In an agile team, members choose important tasks from a list and define when the work is accepted. Which term best fits?"
    },
    {
      keys: ["risk", "issue", "escalation", "incident"],
      text: "A serious service problem appears, and the team must report it to a higher support level. Which term best fits?"
    }
  ];

  const found = cases.find(c => c.keys.some(k => word.includes(k) || meaning.includes(k)));

  if(found) return found.text;

  return `A project team needs the concept described as: "${term.meaning}". Which technical word is the most accurate?`;
}

/* =========================================================
   CHOICE BUILDER
========================================================= */

function buildChoicesV61({ correctTerm, allTerms, answerMode, stageId, difficulty, bank }){
  const correct = normalizeTermV61(correctTerm);

  const terms = (allTerms || [])
    .map(normalizeTermV61)
    .filter(t => t.term && t.meaning);

  const feel = getDifficultyFeelV71(difficulty || vocabGame.difficulty);
  const choiceCount = feel.choiceCount || 4;
  const distractorCount = Math.max(3, choiceCount - 1);

  let pool = terms.filter(t =>
    String(t.term).toLowerCase() !== String(correct.term).toLowerCase()
  );

  pool = pool
    .map(t => ({
      ...t,
      _trapScore: scoreDistractorV61({
        correct,
        candidate: t,
        stageId,
        difficulty,
        bank
      })
    }))
    .sort((a, b) => b._trapScore - a._trapScore);

  let distractors;

  if((difficulty || vocabGame.difficulty) === "easy"){
    distractors = shuffleV61(pool).slice(0, distractorCount);
  }else if(stageId === "speed"){
    distractors = mixDistractorsV61(pool).slice(0, distractorCount);
  }else{
    distractors = pool.slice(0, distractorCount);
  }

  while(distractors.length < distractorCount && pool.length){
    const extra = pool[Math.floor(randV61() * pool.length)];

    if(!distractors.some(x => String(x.term).toLowerCase() === String(extra.term).toLowerCase())){
      distractors.push(extra);
    }else{
      break;
    }
  }

  const choices = [];

  if(answerMode === "meaning"){
    choices.push({
      text: correct.meaning,
      correct: true,
      term: correct.term,
      meaning: correct.meaning
    });

    distractors.forEach(t => {
      choices.push({
        text: t.meaning,
        correct: false,
        term: t.term,
        meaning: t.meaning
      });
    });
  }else{
    choices.push({
      text: correct.term,
      correct: true,
      term: correct.term,
      meaning: correct.meaning
    });

    distractors.forEach(t => {
      choices.push({
        text: t.term,
        correct: false,
        term: t.term,
        meaning: t.meaning
      });
    });
  }

  return shuffleV61(choices).slice(0, choiceCount);
}

function buildChoicesV6(correctTerm, allTerms, mode){
  const answerMode = mode === "context" || mode === "boss_context" ? "term" : "meaning";

  return buildChoicesV61({
    correctTerm,
    allTerms,
    answerMode,
    stageId: mode || "warmup",
    difficulty: vocabGame.difficulty || "normal",
    bank: vocabGame.bank || "A"
  });
}

function mixDistractorsV61(sortedPool){
  const top = sortedPool.slice(0, 6);
  const rest = sortedPool.slice(6);
  const mixed = [];

  if(top.length) mixed.push(top[0]);

  if(rest.length){
    mixed.push(rest[Math.floor(randV61() * rest.length)]);
  }

  if(top.length > 1) mixed.push(top[1]);
  if(top.length > 2) mixed.push(top[2]);
  if(top.length > 3) mixed.push(top[3]);

  return mixed.filter(Boolean);
}

function scoreDistractorV61({ correct, candidate, stageId, difficulty, bank }){
  const d = difficulty || vocabGame.difficulty || "normal";

  let score = 0;

  const cw = String(correct.term || "").toLowerCase();
  const cm = String(correct.meaning || "").toLowerCase();
  const cc = String(correct.category || "").toLowerCase();

  const tw = String(candidate.term || "").toLowerCase();
  const tm = String(candidate.meaning || "").toLowerCase();
  const tc = String(candidate.category || "").toLowerCase();

  if(cc && tc && cc === tc){
    score += d === "easy" ? 2 : 8;
  }

  if(cw && tw && cw[0] === tw[0]){
    score += d === "easy" ? 1 : 3;
  }

  if(Math.abs(cw.length - tw.length) <= 3){
    score += 2;
  }

  const shared = sharedKeywordCountV61(cm, tm);
  score += shared * (d === "challenge" ? 4 : d === "hard" ? 3 : 2);

  if(stageId === "trap") score += 5;
  if(stageId === "boss") score += 3;
  if(d === "hard") score += 2;
  if(d === "challenge") score += 4;
  if(bank === "B" && cc === tc) score += 2;

  score += randV61();

  return score;
}

/* =========================================================
   TEXT ANALYSIS HELPERS
========================================================= */

function sharedKeywordCountV61(a, b){
  const aw = tokenizeMeaningV61(a);
  const bw = new Set(tokenizeMeaningV61(b));

  let count = 0;

  aw.forEach(x => {
    if(bw.has(x)) count += 1;
  });

  return count;
}

function tokenizeMeaningV61(s){
  const stop = new Set([
    "the","and","for","with","that","this","from","into","your","you","are","can","will",
    "a","an","to","of","or","in","on","as","by","is","be","it","its","how","when","what",
    "using","used","user","users","system","data",
    "คือ","การ","ของ","และ","ใน","ที่","เป็น","ใช้","หรือ","ให้","ได้"
  ]);

  return String(s || "")
    .toLowerCase()
    .replace(/[^\w\sก-๙]/g, " ")
    .split(/\s+/)
    .map(x => x.trim())
    .filter(x => x.length > 2 && !stop.has(x));
}

function pickTemplateV61(list){
  if(!Array.isArray(list) || !list.length) return "";
  return list[Math.floor(randV61() * list.length)];
}

/* =========================================================
   PUBLIC DEBUG HELPERS
========================================================= */

window.resetVocabMemoryV71 = resetVocabMemoryV71;

window.previewVocabDeck = function(bank = "A", difficulty = "normal"){
  return buildTermDeckV71(bank, difficulty);
};

window.previewVocabQuestion = function(bank = "A", difficulty = "normal", stageId = "mission"){
  const oldBank = vocabGame.bank;
  const oldDifficulty = vocabGame.difficulty;

  vocabGame.bank = bank;
  vocabGame.difficulty = difficulty;
  vocabGame.terms = buildTermDeckV71(bank, difficulty);

  const stage = VOCAB_STAGES.find(s => s.id === stageId) || VOCAB_STAGES[0];
  const q = buildQuestionV6(stage);

  vocabGame.bank = oldBank;
  vocabGame.difficulty = oldDifficulty;

  return q;
};
