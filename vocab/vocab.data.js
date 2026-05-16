/* =========================================================
   /vocab/vocab.data.js
   TechPath Vocab Arena — Vocabulary Data / Word Banks
   FULL CLEAN PATCH: v20260503t

   Update:
   - ปรับความหมายคำกำกวมให้เฉลยชัดขึ้น
   - interface / client / build / runtime
   - feature / label / confidence / baseline / embedding
   - ยัง compatible กับ vocab.question.js v20260503o+
========================================================= */

(function(){
  "use strict";

  const U = window.VocabUtils;

  if(!U){
    console.error("[VOCAB] vocab.data.js requires vocab.utils.js");
    return;
  }

  const D = {};

  /* =========================================================
     CORE WORD BANKS
  ========================================================= */

  D.banks = {
    A: [
      { term:"algorithm", meaning:"step-by-step instructions to solve a problem", category:"coding", level:"A2" },
      { term:"debug", meaning:"to find and fix errors in code", category:"coding", level:"A2" },
      { term:"variable", meaning:"a named value that can change in a program", category:"coding", level:"A2" },
      { term:"function", meaning:"a reusable block of code that performs a task", category:"coding", level:"A2" },
      { term:"loop", meaning:"a command that repeats actions", category:"coding", level:"A2" },
      { term:"database", meaning:"a system for storing and managing data", category:"data", level:"A2" },
      { term:"interface", meaning:"the screen, controls, or connection that users or systems interact with", category:"ui", level:"A2" },
      { term:"deploy", meaning:"to publish or release a system for users", category:"software", level:"B1" },
      { term:"input", meaning:"data entered into a system", category:"software", level:"A2" },
      { term:"output", meaning:"result produced by a system", category:"software", level:"A2" },
      { term:"server", meaning:"a computer or system that provides services or data", category:"software", level:"A2" },
      { term:"client", meaning:"a user device or program that requests data or services from a server", category:"software", level:"A2" },
      { term:"code", meaning:"instructions written for a computer to run", category:"coding", level:"A2" },
      { term:"syntax", meaning:"rules for writing code correctly", category:"coding", level:"A2" },
      { term:"compile", meaning:"to convert code into a form a computer can run", category:"coding", level:"B1" }
    ],

    B: [
      { term:"dataset", meaning:"a collection of data used for analysis or training", category:"ai", level:"A2" },
      { term:"model", meaning:"a system trained to make predictions or decisions", category:"ai", level:"A2" },
      { term:"training", meaning:"the process of teaching an AI model using data", category:"ai", level:"A2" },
      { term:"prediction", meaning:"an estimated result made by a model", category:"ai", level:"A2" },
      { term:"accuracy", meaning:"how often answers or predictions are correct", category:"ai", level:"A2" },
      { term:"classification", meaning:"putting items into groups or categories", category:"ai", level:"B1" },
      { term:"prompt", meaning:"an instruction given to an AI system", category:"ai", level:"A2" },
      { term:"automation", meaning:"using technology to do tasks automatically", category:"tech", level:"B1" },
      { term:"analytics", meaning:"the process of studying data to find insights", category:"data", level:"B1" },
      { term:"dashboard", meaning:"a screen that shows important information", category:"data", level:"A2" },
      { term:"insight", meaning:"a useful understanding found from data", category:"data", level:"B1" },
      { term:"label", meaning:"the correct category or answer assigned to training data", category:"ai", level:"A2" },
      { term:"feature", meaning:"a measurable input or property used by a model", category:"ai", level:"B1" },
      { term:"bias", meaning:"a pattern that can make results unfair or inaccurate", category:"ai", level:"B1" },
      { term:"evaluate", meaning:"to check how well a model or system works", category:"ai", level:"B1" }
    ],

    C: [
      { term:"requirement", meaning:"something a client or user needs from a system", category:"project", level:"B1" },
      { term:"deadline", meaning:"the final time or date to finish work", category:"project", level:"A2" },
      { term:"feedback", meaning:"comments or advice used to improve work", category:"project", level:"A2" },
      { term:"prototype", meaning:"an early version of a product for testing", category:"project", level:"B1" },
      { term:"presentation", meaning:"a talk or display used to explain ideas", category:"workplace", level:"A2" },
      { term:"meeting", meaning:"a planned discussion with people", category:"workplace", level:"A2" },
      { term:"client", meaning:"a person or organization that receives a service", category:"workplace", level:"A2" },
      { term:"feature", meaning:"a function or part of a product", category:"software", level:"A2" },
      { term:"bug report", meaning:"a document that explains a problem in software", category:"software", level:"B1" },
      { term:"update", meaning:"a newer version or improvement of software", category:"software", level:"A2" },
      { term:"teamwork", meaning:"working together with other people", category:"workplace", level:"A2" },
      { term:"schedule", meaning:"a plan that shows when tasks will happen", category:"project", level:"A2" },
      { term:"task", meaning:"a piece of work that needs to be done", category:"project", level:"A2" },
      { term:"progress", meaning:"movement toward finishing a task or goal", category:"project", level:"A2" },
      { term:"solution", meaning:"a way to solve a problem", category:"workplace", level:"A2" }
    ]
  };

  /* =========================================================
     EXPANDED WORD BANKS
  ========================================================= */

  D.extraTerms = {
    A: [
      ["API","a way for software systems to communicate with each other","software","B1"],
      ["array","a list-like data structure that stores multiple values","coding","A2"],
      ["object","a data structure with properties and values","coding","B1"],
      ["string","text data in a program","coding","A2"],
      ["integer","a whole number without decimals","coding","A2"],
      ["boolean","a true or false value","coding","A2"],
      ["condition","a rule that decides what code should run","coding","A2"],
      ["parameter","a value a function receives to work with","coding","B1"],
      ["argument","a value passed into a function when it is called","coding","B1"],
      ["return value","the result sent back by a function","coding","B1"],
      ["library","a collection of reusable code","software","B1"],
      ["framework","a structured set of tools for building software","software","B1"],
      ["repository","a place where project code is stored and managed","software","B1"],
      ["commit","a saved change in a version control system","software","B1"],
      ["branch","a separate line of code development","software","B1"],
      ["merge","to combine changes from one branch into another","software","B1"],
      ["request","a message asking a server for data or action","software","B1"],
      ["response","the message a server sends back after a request","software","B1"],
      ["endpoint","a specific URL where an API can be accessed","software","B1"],
      ["authentication","the process of checking who a user is","security","B1"],
      ["permission","the right to access or do something in a system","security","B1"],
      ["cache","temporary stored data used to make a system faster","software","B1"],
      ["backup","a copy of data kept for safety","software","A2"],
      ["query","a request to search or get data from a database","data","B1"],
      ["exception","an error or unusual condition in a program","coding","B1"],
      ["test case","a set of steps used to check if software works correctly","testing","B1"],
      ["unit test","a test for one small part of a program","testing","B1"],
      ["integration test","a test that checks if several parts work together","testing","B1"],
      ["documentation","written information that explains how a system works","software","B1"],
      ["refactor","to improve code structure without changing its behavior","coding","B1+"],
      ["module","a separate part of a program","software","B1"],
      ["package","a bundled set of code or software resources","software","B1"],
      ["dependency","software that another program needs to run","software","B1+"],
      ["build","a prepared version of software, or the process of preparing it to run","software","B1"],
      ["runtime","the environment or time when a program is running","software","B1"]
    ],

    B: [
      ["feature engineering","creating useful input features for a machine learning model","ai","B1+"],
      ["overfitting","when a model learns training data too closely and performs poorly on new data","ai","B1+"],
      ["underfitting","when a model is too simple to learn the pattern well","ai","B1+"],
      ["validation set","data used to tune and check a model during development","ai","B1"],
      ["testing set","data used to evaluate a model after training","ai","B1"],
      ["training set","data used to teach a model","ai","A2"],
      ["neural network","a model inspired by connected layers of artificial neurons","ai","B1"],
      ["embedding","a numerical representation that captures the meaning of text, images, or data","ai","B1+"],
      ["token","a small unit of text processed by an AI model","ai","B1"],
      ["inference","using a trained model to produce an answer or prediction","ai","B1+"],
      ["confidence","a score showing how sure a model is about its prediction","ai","B1"],
      ["recall","how many relevant items a model successfully finds","ai","B1+"],
      ["precision","how many selected items are actually correct","ai","B1+"],
      ["confusion matrix","a table showing correct and incorrect classification results","ai","B1+"],
      ["regression","predicting a number or continuous value","ai","B1"],
      ["clustering","grouping similar items without predefined labels","ai","B1+"],
      ["anomaly detection","finding unusual patterns or outliers in data","ai","B1+"],
      ["data cleaning","fixing or removing incorrect or messy data","data","B1"],
      ["data pipeline","a process that moves and prepares data step by step","data","B1+"],
      ["visualization","showing data as charts or graphics","data","B1"],
      ["metric","a number used to measure performance","data","B1"],
      ["baseline","a simple model or result used as a standard for comparison","ai","B1"],
      ["hyperparameter","a setting chosen before model training","ai","B1+"],
      ["label noise","incorrect or inconsistent labels in training data","ai","B1+"],
      ["annotation","adding labels or notes to data","ai","B1"],
      ["generative AI","AI that creates text, images, audio, or other content","ai","B1"],
      ["chatbot","a program that talks with users through text or voice","ai","A2"],
      ["recommendation system","a system that suggests items based on data","ai","B1"],
      ["computer vision","AI that understands images or videos","ai","B1"],
      ["natural language processing","AI that works with human language","ai","B1+"],
      ["supervised learning","learning from examples with correct labels","ai","B1"],
      ["unsupervised learning","learning patterns from data without labels","ai","B1"],
      ["reinforcement learning","learning by receiving rewards or penalties from actions","ai","B1+"],
      ["data privacy","protecting personal or sensitive data","data","B1"],
      ["model drift","when a model becomes less accurate because real data changes","ai","B1+"]
    ],

    C: [
      ["stakeholder","a person or group affected by a project","project","B1"],
      ["scope","the boundaries of what a project will and will not include","project","B1"],
      ["milestone","an important point or achievement in a project timeline","project","B1"],
      ["deliverable","a finished item or result that must be delivered","project","B1"],
      ["sprint","a short planned work period in agile development","project","B1"],
      ["backlog","a list of tasks or features waiting to be done","project","B1"],
      ["priority","the level of importance of a task","project","A2"],
      ["risk","a possible problem that could affect a project","project","A2"],
      ["issue","a problem that needs attention","project","A2"],
      ["approval","official permission or agreement","workplace","B1"],
      ["requirement change","a change to what the system must do","project","B1"],
      ["user story","a short description of what a user needs and why","project","B1+"],
      ["acceptance criteria","conditions that must be met for work to be accepted","project","B1+"],
      ["status update","a short report about current progress","workplace","A2"],
      ["handover","passing work or responsibility to another person","workplace","B1"],
      ["maintenance","ongoing work to keep a system working well","software","B1"],
      ["support ticket","a record of a user problem or request","workplace","B1"],
      ["incident","an unexpected problem that affects service","workplace","B1"],
      ["escalation","moving an issue to a higher support level","workplace","B1+"],
      ["negotiation","discussion to reach an agreement","workplace","B1"],
      ["proposal","a document that suggests a plan or solution","workplace","B1"],
      ["quotation","a document showing the expected price","workplace","B1"],
      ["invoice","a document requesting payment","workplace","B1"],
      ["contract","a formal agreement between parties","workplace","B1"],
      ["stakeholder meeting","a meeting with people affected by a project","project","B1"],
      ["progress report","a document explaining how much work is finished","project","B1"],
      ["timeline","a plan showing when tasks should happen","project","A2"],
      ["budget","the amount of money planned for a project","project","A2"],
      ["resource","people, time, money, or tools used for work","project","B1"],
      ["responsibility","a duty or task a person must handle","workplace","B1"],
      ["collaboration","working together with others","workplace","B1"],
      ["user training","teaching users how to use a system","workplace","B1"],
      ["rollout","the planned release of a system to users","project","B1+"],
      ["requirement analysis","studying what users or clients need","project","B1+"]
    ]
  };

  /* =========================================================
     DIFFICULTY FEEL
  ========================================================= */

  D.difficultyFeel = {
    easy: {
      label: "Easy",
      choiceCount: 4,
      crossBankCount: 0,
      levelAllow: ["A2", "B1"],
      preview: "✨ Easy: คำถามตรง 4 ตัวเลือก เวลาเยอะ เหมาะกับเริ่มจำความหมาย"
    },

    normal: {
      label: "Normal",
      choiceCount: 4,
      crossBankCount: 0,
      levelAllow: ["A2", "B1"],
      preview: "⚔️ Normal: สลับนิยาม/สถานการณ์ มีตัวเลือกหลอกมากขึ้น"
    },

    hard: {
      label: "Hard",
      choiceCount: 5,
      crossBankCount: 10,
      levelAllow: ["A2", "B1", "B1+"],
      preview: "🔥 Hard: 5 ตัวเลือก โจทย์บริบทมากขึ้น มีคำข้าม Bank เป็นตัวหลอก"
    },

    challenge: {
      label: "Challenge",
      choiceCount: 5,
      crossBankCount: 20,
      levelAllow: ["A2", "B1", "B1+"],
      preview: "💀 Challenge: 5 ตัวเลือก ผสมหลาย Bank โจทย์แม่นยำ/สถานการณ์ยาก"
    }
  };

  /* =========================================================
     NORMALIZE / MERGE
  ========================================================= */

  D.normalizeTerm = function normalizeTerm(t, bankFallback = ""){
    if(Array.isArray(t)){
      return {
        term: String(t[0] || "").trim(),
        meaning: String(t[1] || "").trim(),
        category: String(t[2] || "").trim(),
        level: String(t[3] || "").trim(),
        example: String(t[4] || "").trim(),
        bank: bankFallback
      };
    }

    return {
      term: String(t.term || t.word || "").trim(),
      meaning: String(t.meaning || t.definition || t.th || t.translation || "").trim(),
      category: String(t.category || t.group || t.type || "").trim(),
      level: String(t.level || "").trim(),
      example: String(t.example || t.sentence || "").trim(),
      bank: String(t.bank || bankFallback || "").trim()
    };
  };

  D.dedupeTerms = function dedupeTerms(list){
    const seen = new Set();
    const out = [];

    (list || []).forEach(item => {
      const t = D.normalizeTerm(item, item.bank || "");
      const key = U.termKey(t.term);

      if(!key || !t.meaning) return;
      if(seen.has(key)) return;

      seen.add(key);
      out.push(t);
    });

    return out;
  };

  D.applyExpansion = function applyExpansion(){
    Object.keys(D.extraTerms).forEach(bank => {
      if(!D.banks[bank]){
        D.banks[bank] = [];
      }

      const merged = D.banks[bank]
        .map(t => D.normalizeTerm(t, bank))
        .concat((D.extraTerms[bank] || []).map(t => D.normalizeTerm(t, bank)));

      D.banks[bank] = D.dedupeTerms(merged).map(t => ({
        ...t,
        bank
      }));
    });

    return D.banks;
  };

  D.getDifficultyFeel = function getDifficultyFeel(difficulty){
    return D.difficultyFeel[difficulty || "easy"] || D.difficultyFeel.easy;
  };

  D.getBank = function getBank(bank){
    D.applyExpansion();

    const bankId = bank || "A";

    if(window.VOCAB_CUSTOM_BANKS && Array.isArray(window.VOCAB_CUSTOM_BANKS[bankId])){
      return D.dedupeTerms(window.VOCAB_CUSTOM_BANKS[bankId].map(t => D.normalizeTerm(t, bankId)));
    }

    return D.dedupeTerms((D.banks[bankId] || D.banks.A || []).map(t => D.normalizeTerm(t, bankId)));
  };

  D.getAllTerms = function getAllTerms(){
    D.applyExpansion();

    return D.dedupeTerms(
      Object.keys(D.banks).flatMap(bank => {
        return (D.banks[bank] || []).map(t => ({
          ...D.normalizeTerm(t, bank),
          bank
        }));
      })
    );
  };

  D.getOtherBankTerms = function getOtherBankTerms(bank){
    D.applyExpansion();

    return D.dedupeTerms(
      Object.keys(D.banks)
        .filter(b => b !== bank)
        .flatMap(b => (D.banks[b] || []).map(t => ({
          ...D.normalizeTerm(t, b),
          bank: b
        })))
    );
  };

  /* =========================================================
     FILTER / SAMPLE
  ========================================================= */

  D.filterByLevel = function filterByLevel(terms, difficulty){
    const feel = D.getDifficultyFeel(difficulty);
    const allow = new Set(feel.levelAllow || ["A2", "B1", "B1+"]);

    return (terms || []).filter(t => {
      if(!t.level) return true;
      return allow.has(t.level);
    });
  };

  D.sampleTerms = function sampleTerms(list, count){
    const clean = D.dedupeTerms(list);
    return U.shuffle(clean).slice(0, Math.max(0, Number(count || 0)));
  };

  D.buildTermDeck = function buildTermDeck(bank, difficulty){
    D.applyExpansion();

    const feel = D.getDifficultyFeel(difficulty);
    const main = D.filterByLevel(D.getBank(bank), difficulty);

    let deck = main.slice();

    if(Number(feel.crossBankCount || 0) > 0){
      const others = D.filterByLevel(D.getOtherBankTerms(bank), difficulty);
      deck = deck.concat(D.sampleTerms(others, feel.crossBankCount));
    }

    return U.shuffle(D.dedupeTerms(deck));
  };

  /* =========================================================
     WEAK TERM / AI PATH OVERRIDE
  ========================================================= */

  D.weakKey = "VOCAB_WEAK_TERMS";

  D.readWeakTerms = function readWeakTerms(){
    return U.readJson(D.weakKey, []) || [];
  };

  D.saveWeakTerms = function saveWeakTerms(list){
    U.writeJson(D.weakKey, (list || []).slice(0, 30));
  };

  D.updateWeakTermsFromMistakes = function updateWeakTermsFromMistakes(mistakes){
    const existing = D.readWeakTerms();
    const map = new Map();

    existing.forEach(x => {
      const key = U.termKey(x.term);
      if(key){
        map.set(key, {
          term: x.term,
          meaning: x.meaning || "",
          count: Number(x.count || 0),
          last: x.last || ""
        });
      }
    });

    (mistakes || []).forEach(m => {
      const key = U.termKey(m.term);
      if(!key) return;

      if(!map.has(key)){
        map.set(key, {
          term: m.term,
          meaning: m.meaning || "",
          count: 0,
          last: ""
        });
      }

      const item = map.get(key);
      item.count += 1;
      item.last = U.bangkokIsoNow();
    });

    const out = [...map.values()]
      .sort((a,b) => Number(b.count || 0) - Number(a.count || 0))
      .slice(0, 30);

    D.saveWeakTerms(out);
    return out;
  };

  D.buildWeakReviewDeck = function buildWeakReviewDeck(bank){
    const weak = D.readWeakTerms();
    const all = D.getAllTerms();
    const byTerm = new Map(all.map(t => [U.termKey(t.term), t]));

    const weakTerms = weak
      .map(w => byTerm.get(U.termKey(w.term)) || {
        term: w.term,
        meaning: w.meaning || "review this weak word",
        category: "weak-review",
        level: "A2",
        bank: bank || "A"
      })
      .filter(t => t.term && t.meaning);

    const base = D.getBank(bank || "A");

    return D.dedupeTerms(weakTerms.concat(base)).slice(0, 24);
  };

  /* =========================================================
     SITUATION PROMPTS
  ========================================================= */

  D.situationCases = [
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
      keys:["interface","ui","screen","buttons","controls"],
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
      keys:["label","annotation"],
      text:"A data worker adds the correct category or answer to training data. Which word fits best?"
    },
    {
      keys:["feature engineering","feature"],
      text:"A machine learning model uses measurable input properties to learn patterns. Which word fits best?"
    },
    {
      keys:["confidence"],
      text:"A model gives a score showing how sure it is about a prediction. Which word fits best?"
    },
    {
      keys:["embedding"],
      text:"Text or images are converted into numbers that capture their meaning. Which word fits best?"
    },
    {
      keys:["baseline"],
      text:"The team compares a new model with a simple standard model or result. Which word fits best?"
    },
    {
      keys:["requirement","client needs"],
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
      keys:["build"],
      text:"The team prepares a version of the software so it can run or be released. Which word fits best?"
    },
    {
      keys:["runtime"],
      text:"The program is already running inside an environment. Which word fits best?"
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
      text:"The system checks who the user is before allowing access. Which word fits best?"
    },
    {
      keys:["precision","recall","metric"],
      text:"A data analyst explains how well the model finds correct results. Which word fits best?"
    },
    {
      keys:["overfitting"],
      text:"A model performs well on training data but poorly on new data. Which word fits best?"
    },
    {
      keys:["data cleaning"],
      text:"The team fixes messy and incorrect records before analysis. Which word fits best?"
    },
    {
      keys:["stakeholder"],
      text:"The project team talks with people affected by the system. Which word fits best?"
    },
    {
      keys:["scope"],
      text:"The team defines what the project will and will not include. Which word fits best?"
    },
    {
      keys:["milestone"],
      text:"The team reaches an important point in the project timeline. Which word fits best?"
    },
    {
      keys:["deliverable"],
      text:"The client expects a finished item or result from the team. Which word fits best?"
    }
  ];

  D.buildSituationPrompt = function buildSituationPrompt(term, advanced = false){
    const t = D.normalizeTerm(term);
    const word = String(t.term || "").toLowerCase();
    const meaning = String(t.meaning || "").toLowerCase();

    const found = D.situationCases.find(c => {
      return c.keys.some(k => {
        const key = String(k).toLowerCase();
        return word.includes(key) || meaning.includes(key);
      });
    });

    let text = found
      ? found.text
      : `Which word best matches this meaning: "${t.meaning}"?`;

    if(advanced){
      const extras = [
        "Choose the most precise technical term, not just a similar idea.",
        "Focus on what action is happening in the system.",
        "Avoid the option that sounds familiar but does not match the context.",
        "Think like a developer explaining this to a teammate."
      ];

      text += " " + U.pick(extras);
    }

    return text;
  };

  D.buildChallengeCase = function buildChallengeCase(term){
    const t = D.normalizeTerm(term);
    const word = String(t.term || "").toLowerCase();
    const meaning = String(t.meaning || "").toLowerCase();

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
      },
      {
        keys:["feature","feature engineering","hyperparameter"],
        text:"A machine learning team chooses useful measurable inputs before training a model. Which term best fits?"
      },
      {
        keys:["embedding","token","natural language processing"],
        text:"A language model changes words into smaller units or numerical representations to understand meaning. Which term best fits?"
      },
      {
        keys:["baseline","metric","evaluate"],
        text:"The team checks a model by comparing it with a simple standard result. Which term best fits?"
      }
    ];

    const found = cases.find(c => {
      return c.keys.some(k => {
        const key = String(k).toLowerCase();
        return word.includes(key) || meaning.includes(key);
      });
    });

    if(found) return found.text;

    return `A project team needs the concept described as: "${t.meaning}". Which technical word is the most accurate?`;
  };

  /* =========================================================
     TERM HISTORY
  ========================================================= */

  D.historyKey = function historyKey(bank, difficulty, mode){
    return `VOCAB_TERM_HISTORY_${bank || "A"}_${difficulty || "easy"}_${mode || "learn"}`;
  };

  D.readHistory = function readHistory(bank, difficulty, mode){
    return U.readJson(D.historyKey(bank, difficulty, mode), {}) || {};
  };

  D.saveHistory = function saveHistory(bank, difficulty, mode, history){
    U.writeJson(D.historyKey(bank, difficulty, mode), history || {});
  };

  D.rememberTerm = function rememberTerm(term, bank, difficulty, mode){
    const key = U.termKey(term);
    if(!key) return;

    const h = D.readHistory(bank, difficulty, mode);
    h[key] = Number(h[key] || 0) + 1;
    D.saveHistory(bank, difficulty, mode, h);
  };

  D.clearHistory = function clearHistory(){
    Object.keys(localStorage).forEach(k => {
      if(String(k).startsWith("VOCAB_TERM_HISTORY_")){
        localStorage.removeItem(k);
      }
    });
  };

  D.pickNextTerm = function pickNextTerm(terms, options = {}){
    const bank = options.bank || window.vocabGame?.bank || "A";
    const difficulty = options.difficulty || window.vocabGame?.difficulty || "easy";
    const mode = options.mode || window.vocabGame?.mode || "learn";

    const clean = D.dedupeTerms(terms);

    if(!clean.length){
      return {
        term:"debug",
        meaning:"to find and fix errors in code",
        category:"coding",
        level:"A2",
        bank:"A"
      };
    }

    if(clean.length <= 1){
      return clean[0];
    }

    const recent = new Set((window.VOCAB_QUALITY?.recentTerms || []).map(U.termKey));
    const sessionUse = window.vocabGame?.sessionTermUse || {};
    const history = D.readHistory(bank, difficulty, mode);

    const ranked = clean.map(t => {
      const key = U.termKey(t.term);

      const penalty =
        Number(sessionUse[key] || 0) * 1000 +
        Number(history[key] || 0) * 6 +
        (recent.has(key) ? 80 : 0);

      return {
        term: t,
        score: penalty + U.rand()
      };
    }).sort((a,b) => a.score - b.score);

    return ranked[0].term;
  };

  /* =========================================================
     QUALITY STATE
  ========================================================= */

  D.quality = window.VOCAB_QUALITY || {
    recentTerms: [],
    recentPrompts: [],
    maxRecentTerms: 10,
    maxRecentPrompts: 8
  };

  D.rememberQuestion = function rememberQuestion(term, prompt){
    const key = U.termKey(term?.term || term);

    if(key){
      if(window.vocabGame){
        if(!window.vocabGame.sessionTermUse){
          window.vocabGame.sessionTermUse = {};
        }

        window.vocabGame.sessionTermUse[key] =
          Number(window.vocabGame.sessionTermUse[key] || 0) + 1;
      }

      D.quality.recentTerms.push(key);

      while(D.quality.recentTerms.length > Number(D.quality.maxRecentTerms || 10)){
        D.quality.recentTerms.shift();
      }

      D.rememberTerm(
        key,
        window.vocabGame?.bank || "A",
        window.vocabGame?.difficulty || "easy",
        window.vocabGame?.mode || "learn"
      );
    }

    if(prompt){
      D.quality.recentPrompts.push(String(prompt).slice(0, 160));

      while(D.quality.recentPrompts.length > Number(D.quality.maxRecentPrompts || 8)){
        D.quality.recentPrompts.shift();
      }
    }

    window.VOCAB_QUALITY = D.quality;
  };

  /* =========================================================
     PUBLIC / COMPATIBILITY
  ========================================================= */

  D.applyExpansion();

  window.VocabData = D;

  window.VOCAB_BANKS = D.banks;
  window.VOCAB_EXTRA_TERMS_V71 = D.extraTerms;
  window.VOCAB_DIFFICULTY_FEEL_V71 = D.difficultyFeel;
  window.VOCAB_QUALITY = D.quality;

  window.applyVocabularyExpansionV71 = D.applyExpansion;
  window.normalizeTermV61 = D.normalizeTerm;
  window.getDifficultyFeelV71 = D.getDifficultyFeel;
  window.getTermsForBankV6 = D.getBank;
  window.buildTermDeckV71 = D.buildTermDeck;
  window.pickNextTermV61 = function pickNextTermV61(terms){
    return D.pickNextTerm(terms);
  };
  window.rememberQuestionV61 = D.rememberQuestion;
  window.resetVocabMemoryV71 = function resetVocabMemoryV71(){
    D.clearHistory();
    alert("ล้างประวัติคำศัพท์แล้ว รอบต่อไปจะสุ่ม deck ใหม่");
  };

  window.VocabModules = window.VocabModules || {};
  window.VocabModules.data = true;

  window.__VOCAB_MODULES__ = window.__VOCAB_MODULES__ || {};
  window.__VOCAB_MODULES__.data = true;

  console.log("[VOCAB] data loaded", {
    version: "vocab-data-v20260503t",
    A: D.banks.A.length,
    B: D.banks.B.length,
    C: D.banks.C.length
  });

})();
