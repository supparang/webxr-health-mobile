/* =========================================================
   /vocab/vocab.question.js
   TechPath Vocab Arena — Question Builder
   Version: 20260503a
   Depends on:
   - vocab.config.js
   - vocab.utils.js
   - vocab.data.js
   - vocab.state.js
========================================================= */
(function(){
  "use strict";

  const WIN = window;

  const APP =
    WIN.VocabConfig ||
    WIN.VOCAB_APP ||
    WIN.VOCAB_CONFIG ||
    {};

  const U =
    WIN.VocabUtils ||
    WIN.VOCAB_UTILS ||
    {};

  const Data =
    WIN.VocabData ||
    WIN.VOCAB_DATA ||
    {};

  const State =
    WIN.VocabState ||
    WIN.VOCAB_STATE ||
    {};

  function rand(){
    if(U.rand) return U.rand();
    return Math.random();
  }

  function shuffle(arr){
    if(U.shuffle) return U.shuffle(arr);

    const a = Array.isArray(arr) ? arr.slice() : [];

    for(let i = a.length - 1; i > 0; i--){
      const j = Math.floor(rand() * (i + 1));
      const t = a[i];
      a[i] = a[j];
      a[j] = t;
    }

    return a;
  }

  function normalizeTerm(t){
    if(Data.normalizeTerm) return Data.normalizeTerm(t);

    return {
      term: String(t && (t.term || t.word) || "").trim(),
      meaning: String(t && (t.meaning || t.definition || t.th || t.translation) || "").trim(),
      category: String(t && (t.category || t.group || t.type) || "").trim(),
      example: String(t && (t.example || t.sentence) || "").trim(),
      bank: String(t && t.bank || "").trim(),
      level: String(t && t.level || "").trim()
    };
  }

  function getBanks(){
    if(Data.BANKS) return Data.BANKS;
    if(Data.VOCAB_BANKS) return Data.VOCAB_BANKS;
    if(WIN.VOCAB_BANKS) return WIN.VOCAB_BANKS;
    return {};
  }

  function getBankTerms(bank){
    if(Data.getBankTerms) return Data.getBankTerms(bank);
    if(Data.getTermsForBank) return Data.getTermsForBank(bank);

    const banks = getBanks();
    return banks[bank] || banks.A || [];
  }

  function getAllTerms(){
    if(Data.getAllTerms) return Data.getAllTerms();

    const banks = getBanks();
    const out = [];

    Object.keys(banks || {}).forEach(bank => {
      (banks[bank] || []).forEach(t => {
        out.push(Object.assign({}, normalizeTerm(t), { bank }));
      });
    });

    return out;
  }

  function safeLower(s){
    return String(s || "").toLowerCase();
  }

  function termKey(t){
    return safeLower(t && (t.term || t.word) || t || "").trim();
  }

  function tokenizeMeaning(s){
    const stop = new Set([
      "the","and","for","with","that","this","from","into","your","you","are","can","will",
      "which","word","fits","best","choose","meaning","what","does","mean",
      "a","an","to","of","or","in","on","as","by","is","be","using","used","system",
      "คือ","การ","ของ","และ","ใน","ที่","เป็น","ใช้","หรือ","ให้","ได้","คำ","ระบบ"
    ]);

    return String(s || "")
      .toLowerCase()
      .replace(/[^\w\sก-๙]/g, " ")
      .split(/\s+/)
      .map(x => x.trim())
      .filter(x => x.length > 2 && !stop.has(x));
  }

  function sharedKeywordCount(a, b){
    const aw = tokenizeMeaning(a);
    const bw = new Set(tokenizeMeaning(b));

    let count = 0;

    aw.forEach(x => {
      if(bw.has(x)) count += 1;
    });

    return count;
  }

  const QUESTION_QUALITY = {
    recentTerms: [],
    recentPrompts: [],
    maxRecentTerms: 10,
    maxRecentPrompts: 8
  };

  const DIFFICULTY_FEEL = {
    easy: {
      label: "Easy",
      choiceCount: 4,
      crossBankCount: 0,
      trapWeight: 1,
      preview: "✨ Easy: เวลาเยอะ เหมาะกับเริ่มจำความหมาย"
    },
    normal: {
      label: "Normal",
      choiceCount: 4,
      crossBankCount: 0,
      trapWeight: 2,
      preview: "⚔️ Normal: สลับนิยาม/สถานการณ์ มีตัวเลือกหลอกมากขึ้น"
    },
    hard: {
      label: "Hard",
      choiceCount: 5,
      crossBankCount: 10,
      trapWeight: 3,
      preview: "🔥 Hard: 5 ตัวเลือก มีคำข้าม Bank และโจทย์บริบทมากขึ้น"
    },
    challenge: {
      label: "Challenge",
      choiceCount: 5,
      crossBankCount: 20,
      trapWeight: 4,
      preview: "💀 Challenge: 5 ตัวเลือก ผสมหลาย Bank เวลาเร็ว และตัวหลอกหนัก"
    }
  };

  const DEFAULT_STAGES = [
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

  function getDifficultyFeel(difficulty){
    return DIFFICULTY_FEEL[difficulty || "easy"] || DIFFICULTY_FEEL.easy;
  }

  function sampleTerms(list, count){
    return shuffle((list || []).map(normalizeTerm).filter(t => t.term && t.meaning))
      .slice(0, Math.max(0, Number(count || 0)));
  }

  function buildTermDeck(bank, difficulty){
    const feel = getDifficultyFeel(difficulty);
    const main = getBankTerms(bank).map(normalizeTerm).filter(t => t.term && t.meaning);

    let deck = main.slice();

    if((feel.crossBankCount || 0) > 0){
      const others = getAllTerms()
        .map(normalizeTerm)
        .filter(t => t.term && t.meaning && String(t.bank || "") !== String(bank || ""));

      deck = deck.concat(sampleTerms(others, feel.crossBankCount));
    }

    const seen = new Set();

    return shuffle(deck.filter(t => {
      const k = termKey(t);
      if(!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    }));
  }

  function buildStagePlan(totalQuestions, stageOrder){
    const stagesBase =
      (Data.STAGES && Array.isArray(Data.STAGES) && Data.STAGES.length)
        ? Data.STAGES
        : DEFAULT_STAGES;

    const order =
      Array.isArray(stageOrder) && stageOrder.length
        ? stageOrder
        : stagesBase.map(s => s.id);

    const stages = order
      .map(id => stagesBase.find(s => s.id === id))
      .filter(Boolean);

    const total = Math.max(1, Number(totalQuestions || 8));
    const each = Math.floor(total / stages.length);

    let remaining = total;

    return stages.map((stage, index) => {
      let count = each;

      if(index < total % stages.length){
        count += 1;
      }

      if(index === stages.length - 1){
        count = remaining;
      }

      remaining -= count;

      return Object.assign({}, stage, { count });
    }).filter(stage => stage.count > 0);
  }

  function readTermUseHistory(){
    try{
      const g = State.game || WIN.vocabGame || {};
      const key = [
        "VOCAB_TERM_HISTORY",
        g.bank || APP.selectedBank || "A",
        g.difficulty || APP.selectedDifficulty || "easy",
        g.mode || APP.selectedMode || "learn"
      ].join("_");

      return JSON.parse(localStorage.getItem(key) || "{}") || {};
    }catch(e){
      return {};
    }
  }

  function saveTermUseHistory(history){
    try{
      const g = State.game || WIN.vocabGame || {};
      const key = [
        "VOCAB_TERM_HISTORY",
        g.bank || APP.selectedBank || "A",
        g.difficulty || APP.selectedDifficulty || "easy",
        g.mode || APP.selectedMode || "learn"
      ].join("_");

      localStorage.setItem(key, JSON.stringify(history || {}));
    }catch(e){}
  }

  function pickNextTerm(terms){
    const clean = (terms || []).map(normalizeTerm).filter(t => t.term && t.meaning);

    if(!clean.length){
      return {
        term: "debug",
        meaning: "to find and fix errors in code",
        category: "coding",
        bank: "A"
      };
    }

    if(clean.length <= 1) return clean[0];

    const g = State.game || WIN.vocabGame || {};
    if(!g.sessionTermUse) g.sessionTermUse = {};

    const history = readTermUseHistory();
    const recent = new Set(QUESTION_QUALITY.recentTerms.map(x => safeLower(x)));

    const ranked = clean.map(t => {
      const k = termKey(t);

      const score =
        (Number(g.sessionTermUse[k] || 0) * 1000) +
        (Number(history[k] || 0) * 6) +
        (recent.has(k) ? 50 : 0) +
        rand();

      return { term: t, score };
    }).sort((a,b) => a.score - b.score);

    return ranked[0].term;
  }

  function rememberQuestion(term, prompt){
    const g = State.game || WIN.vocabGame || {};
    if(!g.sessionTermUse) g.sessionTermUse = {};

    const k = termKey(term);

    if(k){
      g.sessionTermUse[k] = Number(g.sessionTermUse[k] || 0) + 1;

      QUESTION_QUALITY.recentTerms.push(k);
      while(QUESTION_QUALITY.recentTerms.length > QUESTION_QUALITY.maxRecentTerms){
        QUESTION_QUALITY.recentTerms.shift();
      }

      const history = readTermUseHistory();
      history[k] = Number(history[k] || 0) + 1;
      saveTermUseHistory(history);
    }

    if(prompt){
      QUESTION_QUALITY.recentPrompts.push(String(prompt).slice(0, 140));
      while(QUESTION_QUALITY.recentPrompts.length > QUESTION_QUALITY.maxRecentPrompts){
        QUESTION_QUALITY.recentPrompts.shift();
      }
    }
  }

  function pickTemplate(list){
    return list[Math.floor(rand() * list.length)];
  }

  function buildSituationPrompt(term){
    const word = safeLower(term.term);
    const meaning = safeLower(term.meaning);

    const cases = [
      {
        keys:["debug","bug","error","fix"],
        text:"Your app has an error before release. You need to find and fix the problem. Which word fits best?"
      },
      {
        keys:["deploy","release","publish","online","rollout"],
        text:"Your team finished the website and wants users to access it online. Which word fits best?"
      },
      {
        keys:["dataset","data","examples"],
        text:"An AI model learns from many examples stored together. Which word fits best?"
      },
      {
        keys:["algorithm","step"],
        text:"A program follows step-by-step instructions to solve a problem. Which word fits best?"
      },
      {
        keys:["database","store","records"],
        text:"A system needs to store accounts, scores, and user records. Which word fits best?"
      },
      {
        keys:["interface","ui","screen","buttons"],
        text:"Users click buttons, menus, and screens to use an app. Which word fits best?"
      },
      {
        keys:["variable"],
        text:"In code, you need a named value that can change. Which word fits best?"
      },
      {
        keys:["function"],
        text:"You want to reuse a block of code that performs a task. Which word fits best?"
      },
      {
        keys:["loop","repeat"],
        text:"The program must repeat the same action many times. Which word fits best?"
      },
      {
        keys:["model","prediction"],
        text:"An AI system is trained to make decisions or predictions. Which word fits best?"
      },
      {
        keys:["training"],
        text:"The AI learns from data before it can answer well. Which word fits best?"
      },
      {
        keys:["accuracy"],
        text:"You want to measure how often the answers are correct. Which word fits best?"
      },
      {
        keys:["classification"],
        text:"The AI puts images or messages into different categories. Which word fits best?"
      },
      {
        keys:["prompt"],
        text:"You type an instruction to an AI system. Which word fits best?"
      },
      {
        keys:["automation"],
        text:"A task is done by technology without a person doing every step. Which word fits best?"
      },
      {
        keys:["dashboard"],
        text:"A screen shows scores, progress, and important information. Which word fits best?"
      },
      {
        keys:["requirement"],
        text:"A client tells the team what the system must do. Which word fits best?"
      },
      {
        keys:["deadline"],
        text:"The project must be finished by Friday. Which word fits best?"
      },
      {
        keys:["feedback"],
        text:"Your teacher gives comments to help improve your project. Which word fits best?"
      },
      {
        keys:["prototype"],
        text:"Your team builds an early version to test the idea. Which word fits best?"
      },
      {
        keys:["client"],
        text:"A company pays your team to build a system. Which word fits best?"
      },
      {
        keys:["feature"],
        text:"Login, leaderboard, and search are parts of an app. Which word fits best?"
      },
      {
        keys:["bug report"],
        text:"A tester writes a document explaining a software problem. Which word fits best?"
      },
      {
        keys:["update"],
        text:"The app gets a newer version with improvements. Which word fits best?"
      },
      {
        keys:["syntax"],
        text:"Your code has the wrong writing rules and cannot run. Which word fits best?"
      },
      {
        keys:["compile"],
        text:"The code is converted into a form the computer can run. Which word fits best?"
      },
      {
        keys:["schedule","timeline"],
        text:"The team plans when each task will happen. Which word fits best?"
      },
      {
        keys:["progress"],
        text:"You report how much work is already finished. Which word fits best?"
      },
      {
        keys:["solution"],
        text:"You find a way to solve the client's problem. Which word fits best?"
      },
      {
        keys:["authentication","permission"],
        text:"The system checks who the user is and what they are allowed to access. Which word fits best?"
      },
      {
        keys:["privacy"],
        text:"The team protects personal or sensitive information from misuse. Which word fits best?"
      },
      {
        keys:["overfitting"],
        text:"A model performs well on training data but poorly on new data. Which word fits best?"
      },
      {
        keys:["precision","recall","metric"],
        text:"A data analyst measures how well the model finds correct results. Which word fits best?"
      }
    ];

    const found = cases.find(c => c.keys.some(k => word.includes(k) || meaning.includes(k)));

    if(found) return found.text;

    if(term.example){
      return `Read this situation: "${term.example}" Which word fits best?`;
    }

    return `Which word best matches this meaning: "${term.meaning}"?`;
  }

  function buildChallengeCase(term){
    const word = safeLower(term.term);
    const meaning = safeLower(term.meaning);

    const cases = [
      {
        keys:["api","endpoint","request","response"],
        text:"Your team connects a mobile app to a server. The app sends data to a specific URL and receives data back. Which term best fits?"
      },
      {
        keys:["authentication","permission","privacy"],
        text:"A user cannot open private data until the system checks who they are and what they are allowed to access. Which term best fits?"
      },
      {
        keys:["overfitting","underfitting","validation","testing set"],
        text:"A model looks excellent during practice but performs badly with new unseen data. Which term best explains the problem?"
      },
      {
        keys:["precision","recall","confusion matrix","metric"],
        text:"A data analyst must explain how well the model finds correct results and where it makes mistakes. Which term best fits?"
      },
      {
        keys:["stakeholder","scope","milestone","deliverable"],
        text:"During a project meeting, the team clarifies what must be included, who is affected, and what must be delivered. Which term best fits?"
      },
      {
        keys:["debug","exception","bug report","test case"],
        text:"Before release, a tester writes steps to reproduce an error so the developer can find and fix it. Which term best fits?"
      },
      {
        keys:["deploy","rollout","release","build"],
        text:"The system is ready and the team prepares it so real users can access it. Which term best fits?"
      },
      {
        keys:["dataset","label","annotation","data cleaning"],
        text:"Before training AI, the team prepares examples, fixes messy records, and adds categories to data. Which term best fits?"
      }
    ];

    const found = cases.find(c => c.keys.some(k => word.includes(k) || meaning.includes(k)));

    if(found) return found.text;

    return `A project team needs the concept described as: "${term.meaning}". Which technical word is the most accurate?`;
  }

  function buildBlueprint(term, stage, difficulty){
    const d = difficulty || "easy";
    const stageId = stage && stage.id ? stage.id : "warmup";
    const roll = rand();

    if(d === "easy"){
      if(stageId === "mission" || roll > 0.68){
        return {
          mode: "easy_reverse",
          answerMode: "term",
          prompt: `Which word means: "${term.meaning}"?`,
          explain: `The word is "${term.term}".`
        };
      }

      return {
        mode: "meaning",
        answerMode: "meaning",
        prompt: pickTemplate([
          `What does "${term.term}" mean?`,
          `Choose the best meaning of "${term.term}".`,
          `"${term.term}" is closest to which meaning?`
        ]),
        explain: `"${term.term}" means "${term.meaning}".`
      };
    }

    if(d === "normal"){
      if(stageId === "mission" || stageId === "boss" || roll > 0.45){
        return {
          mode: "normal_context",
          answerMode: "term",
          prompt: buildSituationPrompt(term),
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

    if(d === "hard"){
      if(stageId === "trap" || stageId === "mission" || stageId === "boss" || roll > 0.35){
        return {
          mode: "hard_precision_context",
          answerMode: "term",
          prompt: `${buildSituationPrompt(term)} Choose the most precise technical term, not just a similar idea.`,
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

    if(stageId === "boss" || stageId === "trap" || stageId === "mission" || roll > 0.25){
      return {
        mode: "challenge_workplace_case",
        answerMode: "term",
        prompt: buildChallengeCase(term),
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

  function scoreDistractor(correct, candidate, stageId, difficulty, bank){
    const d = difficulty || "normal";
    const feel = getDifficultyFeel(d);

    let score = 0;

    const cw = safeLower(correct.term);
    const cm = safeLower(correct.meaning);
    const cc = safeLower(correct.category);

    const tw = safeLower(candidate.term);
    const tm = safeLower(candidate.meaning);
    const tc = safeLower(candidate.category);

    if(cc && tc && cc === tc) score += d === "easy" ? 2 : 8;
    if(cw && tw && cw[0] === tw[0]) score += d === "easy" ? 1 : 3;
    if(Math.abs(cw.length - tw.length) <= 3) score += 2;

    const shared = sharedKeywordCount(cm, tm);
    score += shared * (feel.trapWeight || 2);

    if(stageId === "trap") score += 5;
    if(stageId === "boss") score += 3;
    if(d === "hard") score += 2;
    if(d === "challenge") score += 4;
    if(bank === "B" && cc === tc) score += 2;

    return score + rand();
  }

  function mixDistractors(sortedPool){
    const top = sortedPool.slice(0, 8);
    const rest = sortedPool.slice(8);
    const mixed = [];

    if(top.length) mixed.push(top[0]);
    if(rest.length) mixed.push(rest[Math.floor(rand() * rest.length)]);
    if(top.length > 1) mixed.push(top[1]);
    if(top.length > 2) mixed.push(top[2]);
    if(top.length > 3) mixed.push(top[3]);

    return mixed.filter(Boolean);
  }

  function buildChoices(options){
    options = options || {};

    const correct = normalizeTerm(options.correctTerm);
    const allTerms = (options.allTerms || []).map(normalizeTerm).filter(t => t.term && t.meaning);
    const answerMode = options.answerMode || "meaning";
    const stageId = options.stageId || "warmup";
    const difficulty = options.difficulty || "easy";
    const bank = options.bank || "A";

    const feel = getDifficultyFeel(difficulty);
    const choiceCount = Math.max(4, Number(feel.choiceCount || 4));
    const distractorCount = Math.max(3, choiceCount - 1);

    let pool = allTerms.filter(t => termKey(t) !== termKey(correct));

    if(pool.length < distractorCount){
      pool = pool.concat(
        getAllTerms()
          .map(normalizeTerm)
          .filter(t => t.term && t.meaning && termKey(t) !== termKey(correct))
      );
    }

    const seenPool = new Set();

    pool = pool.filter(t => {
      const k = termKey(t);
      if(!k || seenPool.has(k)) return false;
      seenPool.add(k);
      return true;
    });

    pool = pool
      .map(t => Object.assign({}, t, {
        _trapScore: scoreDistractor(correct, t, stageId, difficulty, bank)
      }))
      .sort((a,b) => b._trapScore - a._trapScore);

    let distractors;

    if(difficulty === "easy"){
      distractors = shuffle(pool).slice(0, distractorCount);
    }else if(stageId === "speed"){
      distractors = mixDistractors(pool).slice(0, distractorCount);
    }else{
      distractors = pool.slice(0, distractorCount);
    }

    while(distractors.length < distractorCount && pool.length){
      const extra = pool[Math.floor(rand() * pool.length)];
      if(!distractors.some(x => termKey(x) === termKey(extra))){
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

    return shuffle(choices.slice(0, choiceCount));
  }

  function buildQuestion(stage){
    const g = State.game || WIN.vocabGame || {};

    const terms =
      Array.isArray(g.terms) && g.terms.length
        ? g.terms
        : buildTermDeck(g.bank || APP.selectedBank || "A", g.difficulty || APP.selectedDifficulty || "easy");

    const bank = g.bank || APP.selectedBank || "A";
    const difficulty = g.difficulty || APP.selectedDifficulty || "easy";
    const stageObj = stage || g.currentStage || DEFAULT_STAGES[0];

    const correctTerm = pickNextTerm(terms);
    const blueprint = buildBlueprint(correctTerm, stageObj, difficulty);

    rememberQuestion(correctTerm, blueprint.prompt);

    const choices = buildChoices({
      correctTerm,
      allTerms: terms,
      answerMode: blueprint.answerMode,
      stageId: stageObj.id,
      difficulty,
      bank
    });

    return {
      id: `q_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      stageId: stageObj.id,
      mode: blueprint.mode,
      answerMode: blueprint.answerMode,
      prompt: blueprint.prompt,
      correctTerm,
      choices,
      explain: blueprint.explain || "",
      difficultyNote: blueprint.difficultyNote || ""
    };
  }

  function getCorrectChoiceText(question){
    if(!question) return "";

    const term = question.correctTerm || {};

    if(question.answerMode === "meaning"){
      return term.meaning || term.definition || "";
    }

    return term.term || term.word || "";
  }

  function isCorrectChoice(question, choiceText){
    const correct = getCorrectChoiceText(question);
    return String(choiceText || "").includes(correct);
  }

  function resetQuestionMemory(){
    QUESTION_QUALITY.recentTerms = [];
    QUESTION_QUALITY.recentPrompts = [];

    try{
      Object.keys(localStorage).forEach(k => {
        if(String(k).startsWith("VOCAB_TERM_HISTORY_")){
          localStorage.removeItem(k);
        }
      });
    }catch(e){}
  }

  const Question = {
    version: "vocab-question-20260503a",

    DEFAULT_STAGES,
    DIFFICULTY_FEEL,

    getDifficultyFeel,
    buildTermDeck,
    buildStagePlan,
    buildQuestion,
    buildChoices,
    buildBlueprint,
    buildSituationPrompt,
    buildChallengeCase,
    pickNextTerm,
    rememberQuestion,
    getCorrectChoiceText,
    isCorrectChoice,
    normalizeTerm,
    resetQuestionMemory
  };

  /*
    Export หลัก — boot ต้องเจอชื่อนี้
  */
  WIN.VocabQuestion = Question;

  /*
    Alias รองรับ boot/patch หลายชื่อ
  */
  WIN.VOCAB_QUESTION = Question;
  WIN.VocabQuestions = Question;
  WIN.VOCAB_QUESTIONS = Question;

  /*
    Alias สำหรับโค้ดเก่าที่เคยเรียกชื่อ global โดยตรง
  */
  WIN.buildTermDeckV71 = buildTermDeck;
  WIN.buildStagePlanV66 = buildStagePlan;
  WIN.buildStagePlanV6 = buildStagePlan;
  WIN.buildQuestionV6 = buildQuestion;
  WIN.buildChoicesV61 = buildChoices;
  WIN.getCorrectChoiceTextV62 = getCorrectChoiceText;
  WIN.resetVocabMemoryV71 = resetQuestionMemory;

  console.log("[VOCAB QUESTION] loaded", Question.version);
})();
