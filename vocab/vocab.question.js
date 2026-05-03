/* =========================================================
   /vocab/vocab.question.js
   TechPath Vocab Arena — Question Engine
   FULL CLEAN PATCH: v20260503o

   Fix:
   - export window.VocabQuestion
   - read real banks from vocab.data.js in many possible shapes
   - convert bank entries into playable MCQ questions
   - prevent fallback Question text / Option A-D
   - support A/B/C banks
   - support difficulty/mode
   - deterministic shuffle by seed
========================================================= */

(function(){
  "use strict";

  const WIN = window;
  const VERSION = "vocab-question-v20260503o";

  const BANK_LABELS = {
    A: "Basic CS Words",
    B: "AI / Data Words",
    C: "Workplace / Project"
  };

  function log(){
    try{
      console.log.apply(console, ["[VOCAB QUESTION]"].concat(Array.from(arguments)));
    }catch(e){}
  }

  function warn(){
    try{
      console.warn.apply(console, ["[VOCAB QUESTION]"].concat(Array.from(arguments)));
    }catch(e){}
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

  function toArray(v){
    return Array.isArray(v) ? v : [];
  }

  function hashSeed(s){
    s = String(s ?? "vocab");
    let h = 2166136261;

    for(let i = 0; i < s.length; i++){
      h ^= s.charCodeAt(i);
      h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
    }

    return h >>> 0;
  }

  function seededRandom(seed){
    let t = hashSeed(seed);

    return function(){
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(arr, seed){
    arr = arr.slice();
    const rnd = seededRandom(seed || Date.now());

    for(let i = arr.length - 1; i > 0; i--){
      const j = Math.floor(rnd() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }

    return arr;
  }

  function uniqueBy(arr, fn){
    const seen = new Set();
    const out = [];

    arr.forEach(function(item){
      const key = clean(fn(item)).toLowerCase();
      if(!key || seen.has(key)) return;

      seen.add(key);
      out.push(item);
    });

    return out;
  }

  /* =========================================================
     DATA DISCOVERY
  ========================================================= */

  function possibleSources(){
    return [
      WIN.VocabData,
      WIN.VocabBankData,
      WIN.VocabBanks,
      WIN.VOCAB_DATA,
      WIN.VOCAB_BANKS,
      WIN.VOCAB_WORD_BANKS,
      WIN.WORD_BANKS,
      WIN.BANKS,
      WIN.VocabConfig && WIN.VocabConfig.data,
      WIN.VOCAB_APP && WIN.VOCAB_APP.data
    ].filter(Boolean);
  }

  function unwrapBankSource(src){
    if(!src) return null;

    if(src.banks) return src.banks;
    if(src.wordBanks) return src.wordBanks;
    if(src.word_banks) return src.word_banks;
    if(src.data) return src.data;
    if(src.vocab) return src.vocab;
    if(src.items) return src.items;

    return src;
  }

  function readBankRaw(bank){
    bank = clean(bank || "A").toUpperCase();

    const sources = possibleSources();

    for(const src of sources){
      try{
        if(typeof src.getBank === "function"){
          const got = src.getBank(bank);
          if(Array.isArray(got) && got.length) return got;
        }

        if(typeof src.getWords === "function"){
          const got = src.getWords(bank);
          if(Array.isArray(got) && got.length) return got;
        }

        if(typeof src.getEntries === "function"){
          const got = src.getEntries(bank);
          if(Array.isArray(got) && got.length) return got;
        }

        const root = unwrapBankSource(src);

        if(!root) continue;

        if(Array.isArray(root)){
          const filtered = root.filter(function(x){
            const b = clean(pick(x.bank, x.bank_id, x.bankId, x.group, ""));
            return !b || b.toUpperCase() === bank;
          });

          if(filtered.length) return filtered;
        }

        if(root[bank] && Array.isArray(root[bank])) return root[bank];

        const lower = bank.toLowerCase();
        if(root[lower] && Array.isArray(root[lower])) return root[lower];

        const bankKey = "bank" + bank;
        if(root[bankKey] && Array.isArray(root[bankKey])) return root[bankKey];

        const bankKey2 = "Bank" + bank;
        if(root[bankKey2] && Array.isArray(root[bankKey2])) return root[bankKey2];

        if(root.banks && root.banks[bank] && Array.isArray(root.banks[bank])){
          return root.banks[bank];
        }
      }catch(e){}
    }

    return [];
  }

  function normalizeEntry(item, bank, index){
    if(typeof item === "string"){
      return {
        id: bank + "-" + index,
        bank: bank,
        term: item,
        meaning: item,
        thai: "",
        category: "",
        cefr: "",
        example: "",
        hint: ""
      };
    }

    item = item || {};

    const term = clean(
      pick(
        item.term,
        item.word,
        item.vocab,
        item.keyword,
        item.text,
        item.name,
        item.en,
        item.english,
        item.title
      )
    );

    const meaning = clean(
      pick(
        item.meaning,
        item.definition,
        item.def,
        item.answer,
        item.correct,
        item.correct_answer,
        item.correctAnswer,
        item.thai,
        item.th,
        item.translation,
        item.description,
        item.desc
      )
    );

    const thai = clean(
      pick(
        item.thai,
        item.th,
        item.translation,
        item.meaning_th,
        item.meaningTh,
        ""
      )
    );

    return {
      id: clean(pick(item.id, item.qid, item.key, bank + "-" + index)),
      bank: clean(pick(item.bank, item.bankId, item.bank_id, bank)),
      term: term,
      meaning: meaning || thai || term,
      thai: thai,
      category: clean(pick(item.category, item.cat, item.topic, "")),
      cefr: clean(pick(item.cefr, item.level, "")),
      example: clean(pick(item.example, item.sentence, item.context, "")),
      hint: clean(pick(item.hint, item.tip, "")),
      raw: item
    };
  }

  function getEntries(bank){
    bank = clean(bank || "A").toUpperCase();

    const raw = readBankRaw(bank);
    const normalized = raw
      .map(function(item, index){
        return normalizeEntry(item, bank, index);
      })
      .filter(function(x){
        return x.term && x.meaning;
      });

    return uniqueBy(normalized, function(x){
      return x.term + "::" + x.meaning;
    });
  }

  function allEntries(){
    return ["A", "B", "C"].flatMap(function(bank){
      return getEntries(bank);
    });
  }

  /* =========================================================
     QUESTION BUILDING
  ========================================================= */

  function difficultyCount(diff){
    const map = {
      easy: 8,
      normal: 10,
      hard: 12,
      challenge: 15
    };

    return map[clean(diff).toLowerCase()] || 8;
  }

  function difficultyLabel(diff){
    const map = {
      easy: "Easy",
      normal: "Normal",
      hard: "Hard",
      challenge: "Challenge"
    };

    return map[clean(diff).toLowerCase()] || "Easy";
  }

  function modeLabel(mode){
    const map = {
      learn: "AI Training",
      speed: "Speed Run",
      mission: "Debug Mission",
      battle: "Boss Battle"
    };

    return map[clean(mode).toLowerCase()] || "AI Training";
  }

  function questionPrompt(entry, mode){
    mode = clean(mode || "learn").toLowerCase();

    if(mode === "mission"){
      return 'In a CS/AI work situation, what does "' + entry.term + '" mean?';
    }

    if(mode === "speed"){
      return 'Quick! What does "' + entry.term + '" mean?';
    }

    if(mode === "battle"){
      return 'Boss asks: What does "' + entry.term + '" mean?';
    }

    return 'What does "' + entry.term + '" mean?';
  }

  function makeDistractors(entry, bankEntries, all, seed){
    const sameBank = bankEntries
      .filter(function(x){
        return clean(x.meaning).toLowerCase() !== clean(entry.meaning).toLowerCase();
      });

    const global = all
      .filter(function(x){
        return clean(x.meaning).toLowerCase() !== clean(entry.meaning).toLowerCase();
      });

    const pool = uniqueBy(sameBank.concat(global), function(x){
      return x.meaning;
    });

    return shuffle(pool, seed)
      .slice(0, 3)
      .map(function(x){
        return x.meaning;
      });
  }

  function buildQuestion(entry, bankEntries, globalEntries, options, index){
    options = options || {};

    const bank = clean(options.bank || entry.bank || "A").toUpperCase();
    const difficulty = clean(options.difficulty || options.diff || "easy").toLowerCase();
    const mode = clean(options.mode || "learn").toLowerCase();
    const seed = pick(options.seed, Date.now()) + "::" + bank + "::" + difficulty + "::" + mode + "::" + index + "::" + entry.term;

    const correct = entry.meaning;
    const distractors = makeDistractors(entry, bankEntries, globalEntries, seed);

    while(distractors.length < 3){
      distractors.push(
        [
          "a tool for writing or running code",
          "a problem that needs to be fixed",
          "a plan for building software",
          "a system for storing and managing data",
          "text data in a program",
          "a rule that decides what code should run",
          "a whole number without decimals"
        ][distractors.length]
      );
    }

    const choices = shuffle([correct].concat(distractors.slice(0, 3)), seed + "::choices")
      .map(function(text){
        return {
          text: text,
          value: text,
          correct: text === correct
        };
      });

    const explainParts = [];

    explainParts.push('"' + entry.term + '" means "' + correct + '".');

    if(entry.example){
      explainParts.push("Example: " + entry.example);
    }

    if(entry.thai && entry.thai !== correct){
      explainParts.push("TH: " + entry.thai);
    }

    return {
      id: bank + "-" + difficulty + "-" + mode + "-" + index + "-" + hashSeed(entry.term),
      bank: bank,
      difficulty: difficulty,
      diff: difficulty,
      difficultyLabel: difficultyLabel(difficulty),
      mode: mode,
      modeLabel: modeLabel(mode),

      stage_id: "stage-" + (index + 1),
      stageId: "stage-" + (index + 1),
      stage_name: "Question " + (index + 1),
      stageName: "Question " + (index + 1),

      term: entry.term,
      word: entry.term,
      prompt: questionPrompt(entry, mode),
      question: questionPrompt(entry, mode),
      question_text: questionPrompt(entry, mode),
      questionText: questionPrompt(entry, mode),

      choices: choices,
      options: choices,
      correct: correct,
      correct_answer: correct,
      correctAnswer: correct,
      answer: correct,

      hint:
        entry.hint ||
        "Think about where this word is used in coding, software, AI, or project work.",

      explain: explainParts.join(" "),
      explanation: explainParts.join(" "),

      cefr: entry.cefr,
      category: entry.category,
      source: "vocab.question.js",
      raw: entry.raw || entry
    };
  }

  function getQuestions(opts){
    opts = opts || {};

    const bank = clean(opts.bank || opts.selectedBank || "A").toUpperCase();
    const difficulty = clean(opts.difficulty || opts.diff || opts.selectedDifficulty || "easy").toLowerCase();
    const mode = clean(opts.mode || opts.selectedMode || "learn").toLowerCase();
    const count = Number(opts.count || opts.limit || difficultyCount(difficulty));

    const bankEntries = getEntries(bank);
    const globalEntries = allEntries();

    if(!bankEntries.length){
      warn("No entries found for bank", bank, "sources:", possibleSources());
      return [];
    }

    const selected = shuffle(bankEntries, pick(opts.seed, Date.now()) + "::" + bank + "::" + difficulty + "::" + mode)
      .slice(0, count);

    return selected.map(function(entry, index){
      return buildQuestion(entry, bankEntries, globalEntries, {
        bank: bank,
        difficulty: difficulty,
        diff: difficulty,
        mode: mode,
        seed: pick(opts.seed, Date.now())
      }, index);
    });
  }

  function buildQuestions(bank, difficulty, mode, count){
    return getQuestions({
      bank: bank,
      difficulty: difficulty,
      mode: mode,
      count: count || difficultyCount(difficulty)
    });
  }

  function pickQuestions(bank, difficulty, mode, count){
    return buildQuestions(bank, difficulty, mode, count);
  }

  function getDebugSummary(){
    return {
      version: VERSION,
      banks: {
        A: getEntries("A").length,
        B: getEntries("B").length,
        C: getEntries("C").length
      },
      sourcesFound: possibleSources().length
    };
  }

  const api = {
    version: VERSION,

    getEntries,
    getBankEntries: getEntries,
    allEntries,

    getQuestions,
    buildQuestions,
    pickQuestions,

    normalizeEntry,
    buildQuestion,

    getDebugSummary
  };

  WIN.VocabQuestion = api;
  WIN.VocabQuestions = api;
  WIN.VocabQuestionEngine = api;

  WIN.VocabModules = WIN.VocabModules || {};
  WIN.VocabModules.question = true;

  WIN.__VOCAB_MODULES__ = WIN.__VOCAB_MODULES__ || {};
  WIN.__VOCAB_MODULES__.question = true;

  log("loaded", VERSION, getDebugSummary());
})();
