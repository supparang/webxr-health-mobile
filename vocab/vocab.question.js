/* =========================================================
   /vocab/vocab.question.js
   TechPath Vocab Arena — Question Engine
   FULL CLEAN PATCH: v20260503w

   Includes:
   - export window.VocabQuestion
   - read real banks from vocab.data.js
   - generate playable MCQ questions
   - correct answer always in choices
   - smarter distractors by mode/difficulty
   - avoid ambiguous distractors in easy/normal
   - allow more challenging close distractors in hard/challenge
   - situation/context prompts
   - audit helpers
========================================================= */

(function(){
  "use strict";

  const WIN = window;

  const VERSION = "vocab-question-v20260503w";

  const BANKS = ["A", "B", "C"];

  const BANK_LABELS = {
    A: "Basic CS Words",
    B: "AI / Data Words",
    C: "Workplace / Project"
  };

  const MODE_LABELS = {
    learn: "AI Training",
    speed: "Speed Run",
    mission: "Debug Mission",
    battle: "Boss Battle",
    bossrush: "Boss Rush"
  };

  const DIFFICULTY_LABELS = {
    easy: "Easy",
    normal: "Normal",
    hard: "Hard",
    challenge: "Challenge"
  };

  /*
    กลุ่มคำที่ใกล้กันมาก ควรระวังเวลาเอามาเป็นตัวหลอก
    easy/normal จะเลี่ยงการเอากลุ่มเดียวกันมาอยู่ด้วยกันมากเกินไป
  */
  const AMBIGUITY_GROUPS = [
    ["client", "server", "request", "response", "endpoint", "api"],
    ["interface", "dashboard", "screen", "ui"],
    ["feature", "feature engineering", "input", "property"],
    ["schedule", "timeline", "deadline", "milestone"],
    ["accuracy", "precision", "recall", "metric", "confidence"],
    ["training set", "validation set", "testing set", "dataset"],
    ["label", "annotation", "label noise", "classification"],
    ["deploy", "rollout", "release", "build"],
    ["debug", "bug report", "exception", "test case"],
    ["requirement", "requirement analysis", "scope", "acceptance criteria"],
    ["stakeholder", "stakeholder meeting", "client"],
    ["prototype", "model", "baseline"],
    ["task", "backlog", "sprint", "deliverable"],
    ["collaboration", "teamwork", "meeting"]
  ];

  const SAFE_FALLBACK_DISTRACTORS = [
    "a tool for writing or running code",
    "a problem that needs to be fixed",
    "a plan for building software",
    "a system for storing and managing data",
    "text data in a program",
    "a rule that decides what code should run",
    "a whole number without decimals",
    "a screen that shows important information",
    "comments or advice used to improve work",
    "a way to solve a problem"
  ];

  /* =========================================================
     BASIC HELPERS
  ========================================================= */

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

  function norm(s){
    return clean(s).toLowerCase().replace(/\s+/g, " ");
  }

  function toInt(v, fallback){
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : Number(fallback || 0);
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
    arr = Array.isArray(arr) ? arr.slice() : [];

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

    (arr || []).forEach(function(item){
      const key = norm(fn(item));
      if(!key || seen.has(key)) return;

      seen.add(key);
      out.push(item);
    });

    return out;
  }

  function termKey(entry){
    return norm(
      pick(
        entry && entry.term,
        entry && entry.word,
        entry && entry.vocab,
        ""
      )
    );
  }

  function meaningKey(entry){
    return norm(
      pick(
        entry && entry.meaning,
        entry && entry.definition,
        entry && entry.correct,
        entry && entry.answer,
        ""
      )
    );
  }

  function sameMeaning(a, b){
    return norm(a) && norm(a) === norm(b);
  }

  function wordContainsAny(text, list){
    text = norm(text);

    return (list || []).some(function(x){
      const key = norm(x);
      return key && text.includes(key);
    });
  }

  function ambiguityGroupOf(entry){
    const word = norm(entry.term || entry.word || "");
    const meaning = norm(entry.meaning || entry.definition || "");

    for(const group of AMBIGUITY_GROUPS){
      if(wordContainsAny(word, group) || wordContainsAny(meaning, group)){
        return group.join("|");
      }
    }

    return "";
  }

  function sameAmbiguityGroup(a, b){
    const ga = ambiguityGroupOf(a);
    const gb = ambiguityGroupOf(b);

    return ga && gb && ga === gb;
  }

  function categoryOf(entry){
    return norm(entry.category || entry.cat || entry.topic || "");
  }

  function bankOf(entry){
    return clean(entry.bank || "A").toUpperCase();
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

        if(typeof src.buildTermDeck === "function"){
          const got = src.buildTermDeck(bank, "challenge");
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
        word: item,
        meaning: item,
        category: "",
        level: "",
        cefr: "",
        example: "",
        hint: "",
        raw: item
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

    const category = clean(
      pick(
        item.category,
        item.cat,
        item.topic,
        ""
      )
    );

    const level = clean(
      pick(
        item.level,
        item.cefr,
        ""
      )
    );

    return {
      id: clean(pick(item.id, item.qid, item.key, bank + "-" + index)),
      bank: clean(pick(item.bank, item.bankId, item.bank_id, bank)),
      term: term,
      word: term,
      meaning: meaning || thai || term,
      definition: meaning || thai || term,
      thai: thai,
      category: category,
      level: level,
      cefr: level,
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
    return BANKS.flatMap(function(bank){
      return getEntries(bank);
    });
  }

  /* =========================================================
     DIFFICULTY / MODE RULES
  ========================================================= */

  function normalizeDifficulty(diff){
    diff = norm(diff || "easy");

    if(["easy", "normal", "hard", "challenge"].includes(diff)){
      return diff;
    }

    return "easy";
  }

  function normalizeMode(mode){
    mode = norm(mode || "learn");

    if(mode === "ai" || mode === "training" || mode === "ai_training"){
      return "learn";
    }

    if(mode === "debug" || mode === "debug_mission"){
      return "mission";
    }

    if(mode === "boss" || mode === "boss_battle"){
      return "battle";
    }

    if(["learn", "speed", "mission", "battle", "bossrush"].includes(mode)){
      return mode;
    }

    return "learn";
  }

  function questionCountByDifficulty(diff){
    const map = {
      easy: 8,
      normal: 10,
      hard: 12,
      challenge: 15
    };

    return map[normalizeDifficulty(diff)] || 8;
  }

  function choiceCountByDifficulty(diff){
    /*
      UI ตอนนี้รองรับ 4 ตัวเลือกได้ดีที่สุด
      เก็บ 4 ไว้ก่อนเพื่อไม่ให้หน้าจอแน่นเกินไป
    */
    return 4;
  }

  function levelWeight(level){
    level = norm(level);

    if(level === "a2") return 1;
    if(level === "b1") return 2;
    if(level === "b1+") return 3;

    return 2;
  }

  function filterEntriesForDifficulty(entries, difficulty){
    difficulty = normalizeDifficulty(difficulty);

    if(difficulty === "easy"){
      return entries.filter(function(x){
        return levelWeight(x.level || x.cefr) <= 2;
      });
    }

    if(difficulty === "normal"){
      return entries.filter(function(x){
        return levelWeight(x.level || x.cefr) <= 2;
      });
    }

    return entries;
  }

  /* =========================================================
     PROMPT BUILDING
  ========================================================= */

  function getVocabData(){
    return WIN.VocabData || null;
  }

  function situationPrompt(entry, difficulty, mode){
    const data = getVocabData();

    try{
      if(data && typeof data.buildChallengeCase === "function" && ["hard", "challenge"].includes(difficulty)){
        return data.buildChallengeCase(entry);
      }

      if(data && typeof data.buildSituationPrompt === "function" && ["mission", "battle"].includes(mode)){
        return data.buildSituationPrompt(entry, ["hard", "challenge"].includes(difficulty));
      }
    }catch(e){}

    const word = entry.term;

    if(mode === "mission"){
      return 'In a CS/AI work situation, what does "' + word + '" mean?';
    }

    if(mode === "speed"){
      return 'Quick! What does "' + word + '" mean?';
    }

    if(mode === "battle" || mode === "bossrush"){
      return 'Boss asks: What does "' + word + '" mean?';
    }

    if(difficulty === "hard" || difficulty === "challenge"){
      return 'Choose the most accurate meaning of "' + word + '".';
    }

    return 'What does "' + word + '" mean?';
  }

  function explanation(entry, correct){
    const parts = [];

    parts.push('"' + entry.term + '" means "' + correct + '".');

    if(entry.example){
      parts.push("Example: " + entry.example);
    }

    if(entry.thai && entry.thai !== correct){
      parts.push("TH: " + entry.thai);
    }

    if(entry.category){
      parts.push("Category: " + entry.category + ".");
    }

    return parts.join(" ");
  }

  function hintFor(entry){
    if(entry.hint) return entry.hint;

    const cat = norm(entry.category);

    if(cat === "coding"){
      return "Think about how this word is used when writing code.";
    }

    if(cat === "ai"){
      return "Think about how this word is used in AI or machine learning.";
    }

    if(cat === "data"){
      return "Think about how this word is used with data.";
    }

    if(cat === "project"){
      return "Think about how this word is used in project work.";
    }

    if(cat === "workplace"){
      return "Think about how this word is used in a workplace conversation.";
    }

    if(cat === "software"){
      return "Think about how this word is used when building software.";
    }

    return "Look for the meaning that best matches the technical context.";
  }

  /* =========================================================
     DISTRACTOR SCORING
  ========================================================= */

  function distractorScore(candidate, answer, difficulty, mode){
    difficulty = normalizeDifficulty(difficulty);
    mode = normalizeMode(mode);

    if(!candidate || !answer) return -9999;

    if(sameMeaning(candidate.meaning, answer.meaning)){
      return -9999;
    }

    if(norm(candidate.term) === norm(answer.term)){
      return -9999;
    }

    let score = 0;

    const sameBank = bankOf(candidate) === bankOf(answer);
    const sameCat = categoryOf(candidate) && categoryOf(candidate) === categoryOf(answer);
    const sameGroup = sameAmbiguityGroup(candidate, answer);

    /*
      Easy/Normal:
      - ไม่อยากให้กำกวมเกินไป
      - เลือกตัวหลอกคนละกลุ่ม/คนละ category ได้บ้าง
    */
    if(difficulty === "easy"){
      score += sameBank ? 18 : 4;
      score += sameCat ? -8 : 10;
      score += sameGroup ? -40 : 10;
      score += Math.abs(levelWeight(candidate.level) - levelWeight(answer.level)) <= 1 ? 4 : -2;
    }

    if(difficulty === "normal"){
      score += sameBank ? 18 : 6;
      score += sameCat ? 4 : 6;
      score += sameGroup ? -22 : 6;
      score += Math.abs(levelWeight(candidate.level) - levelWeight(answer.level)) <= 1 ? 5 : -2;
    }

    /*
      Hard/Challenge:
      - เอาคำใกล้กันได้ แต่ต้องไม่ใช่ความหมายเดียวกัน
      - category เดียวกันทำให้ท้าทายขึ้น
    */
    if(difficulty === "hard"){
      score += sameBank ? 14 : 10;
      score += sameCat ? 16 : 2;
      score += sameGroup ? 10 : 0;
      score += Math.abs(levelWeight(candidate.level) - levelWeight(answer.level)) <= 1 ? 6 : -1;
    }

    if(difficulty === "challenge"){
      score += sameBank ? 10 : 14;
      score += sameCat ? 18 : 4;
      score += sameGroup ? 16 : 0;
      score += Math.abs(levelWeight(candidate.level) - levelWeight(answer.level)) <= 1 ? 6 : 0;
    }

    /*
      Battle/Mission ควรเน้น context จึงอนุญาตคำใกล้กันมากกว่า learn
    */
    if(["mission", "battle", "bossrush"].includes(mode)){
      score += sameCat ? 4 : 0;
      score += sameGroup ? 4 : 0;
    }

    /*
      กันตัวหลอกที่เป็นคำตอบซ้ำในรูปแบบนิยามคล้ายกันมาก
    */
    const cm = norm(candidate.meaning);
    const am = norm(answer.meaning);

    if(cm.includes(am) || am.includes(cm)){
      score -= 45;
    }

    return score;
  }

  function makeDistractors(answer, bankEntries, globalEntries, options){
    options = options || {};

    const difficulty = normalizeDifficulty(options.difficulty || options.diff);
    const mode = normalizeMode(options.mode);

    const seed = pick(options.seed, Date.now()) + "::distractors::" + answer.term;

    const pool = uniqueBy(
      []
        .concat(bankEntries || [])
        .concat(globalEntries || []),
      function(x){
        return x.meaning;
      }
    ).filter(function(x){
      return !sameMeaning(x.meaning, answer.meaning) &&
             norm(x.term) !== norm(answer.term);
    });

    const scored = pool.map(function(candidate, index){
      return {
        candidate: candidate,
        score:
          distractorScore(candidate, answer, difficulty, mode) +
          seededRandom(seed + "::" + index)() * 0.25
      };
    }).filter(function(x){
      return x.score > -100;
    });

    scored.sort(function(a, b){
      return b.score - a.score;
    });

    const selected = [];
    const seenMeanings = new Set();

    for(const item of scored){
      const c = item.candidate;
      const key = norm(c.meaning);

      if(!key || seenMeanings.has(key)) continue;

      /*
        Easy: จำกัด ambiguity group ไม่ให้เยอะเกิน
      */
      if(difficulty === "easy"){
        const hasSameGroup = selected.some(function(x){
          return sameAmbiguityGroup(x, c);
        });

        if(hasSameGroup && sameAmbiguityGroup(c, answer)){
          continue;
        }
      }

      seenMeanings.add(key);
      selected.push(c);

      if(selected.length >= 3) break;
    }

    let fallbackIndex = 0;

    while(selected.length < 3){
      const meaning = SAFE_FALLBACK_DISTRACTORS[fallbackIndex % SAFE_FALLBACK_DISTRACTORS.length];
      fallbackIndex += 1;

      if(sameMeaning(meaning, answer.meaning)) continue;
      if(seenMeanings.has(norm(meaning))) continue;

      seenMeanings.add(norm(meaning));

      selected.push({
        term: "fallback-" + fallbackIndex,
        meaning: meaning,
        category: "fallback",
        level: "A2",
        bank: "X"
      });
    }

    return selected.slice(0, 3);
  }

  /* =========================================================
     QUESTION BUILDING
  ========================================================= */

  function buildQuestion(entry, bankEntries, globalEntries, options, index){
    options = options || {};

    const bank = clean(options.bank || entry.bank || "A").toUpperCase();
    const difficulty = normalizeDifficulty(options.difficulty || options.diff || "easy");
    const mode = normalizeMode(options.mode || "learn");
    const seed =
      pick(options.seed, Date.now()) +
      "::" + bank +
      "::" + difficulty +
      "::" + mode +
      "::" + index +
      "::" + entry.term;

    const correct = entry.meaning;

    const distractors = makeDistractors(entry, bankEntries, globalEntries, {
      bank: bank,
      difficulty: difficulty,
      mode: mode,
      seed: seed
    });

    const rawChoices = [
      {
        text: correct,
        value: correct,
        correct: true
      }
    ].concat(
      distractors.map(function(x){
        return {
          text: x.meaning,
          value: x.meaning,
          correct: false
        };
      })
    );

    const choices = shuffle(rawChoices, seed + "::choices");

    const prompt = situationPrompt(entry, difficulty, mode);

    return {
      id: bank + "-" + difficulty + "-" + mode + "-" + index + "-" + hashSeed(entry.term),
      bank: bank,
      bankLabel: BANK_LABELS[bank] || bank,
      difficulty: difficulty,
      diff: difficulty,
      difficultyLabel: DIFFICULTY_LABELS[difficulty] || difficulty,
      mode: mode,
      modeLabel: MODE_LABELS[mode] || mode,

      stage_id: "stage-" + (index + 1),
      stageId: "stage-" + (index + 1),
      stage_name: "Question " + (index + 1),
      stageName: "Question " + (index + 1),

      term: entry.term,
      word: entry.term,
      prompt: prompt,
      question: prompt,
      question_text: prompt,
      questionText: prompt,

      choices: choices,
      options: choices,

      correct: correct,
      correct_answer: correct,
      correctAnswer: correct,
      answer: correct,

      hint: hintFor(entry),
      explain: explanation(entry, correct),
      explanation: explanation(entry, correct),

      cefr: entry.cefr || entry.level,
      level: entry.level || entry.cefr,
      category: entry.category,

      source: "vocab.question.js",
      version: VERSION,

      raw: entry.raw || entry
    };
  }

  function getQuestions(opts){
    opts = opts || {};

    const bank = clean(opts.bank || opts.selectedBank || "A").toUpperCase();
    const difficulty = normalizeDifficulty(opts.difficulty || opts.diff || opts.selectedDifficulty || "easy");
    const mode = normalizeMode(opts.mode || opts.selectedMode || "learn");
    const count = toInt(opts.count || opts.limit || questionCountByDifficulty(difficulty), questionCountByDifficulty(difficulty));
    const seed = pick(opts.seed, Date.now());

    const bankEntriesRaw = getEntries(bank);
    const bankEntries = filterEntriesForDifficulty(bankEntriesRaw, difficulty);

    const globalEntries = allEntries();

    if(!bankEntries.length){
      warn("No entries found for bank", bank, "sources:", possibleSources());

      return [];
    }

    const selected = shuffle(
      bankEntries,
      seed + "::" + bank + "::" + difficulty + "::" + mode
    ).slice(0, count);

    return selected.map(function(entry, index){
      return buildQuestion(entry, bankEntries, globalEntries, {
        bank: bank,
        difficulty: difficulty,
        diff: difficulty,
        mode: mode,
        seed: seed
      }, index);
    });
  }

  function buildQuestions(bank, difficulty, mode, count){
    return getQuestions({
      bank: bank,
      difficulty: difficulty,
      diff: difficulty,
      mode: mode,
      count: count || questionCountByDifficulty(difficulty)
    });
  }

  function pickQuestions(bank, difficulty, mode, count){
    return buildQuestions(bank, difficulty, mode, count);
  }

  function filterEntriesForDifficulty(entries, difficulty){
    return filterByLevel(entries, difficulty);
  }

  function filterByLevel(entries, difficulty){
    entries = Array.isArray(entries) ? entries : [];
    difficulty = normalizeDifficulty(difficulty);

    if(difficulty === "easy"){
      const filtered = entries.filter(function(x){
        return levelWeight(x.level || x.cefr) <= 2;
      });
      return filtered.length ? filtered : entries;
    }

    if(difficulty === "normal"){
      const filtered = entries.filter(function(x){
        return levelWeight(x.level || x.cefr) <= 2;
      });
      return filtered.length ? filtered : entries;
    }

    return entries;
  }

  /* =========================================================
     AUDIT HELPERS
  ========================================================= */

  function auditQuestion(q){
    q = q || {};

    const choices = Array.isArray(q.choices) ? q.choices : [];
    const correct = clean(pick(q.correct, q.correct_answer, q.correctAnswer, q.answer, ""));

    const choiceValues = choices.map(function(c){
      return clean(
        typeof c === "object"
          ? pick(c.value, c.text, c.label, "")
          : c
      );
    });

    const issues = [];

    if(!q.term) issues.push("NO_TERM");
    if(!q.prompt && !q.question) issues.push("NO_PROMPT");
    if(!correct) issues.push("NO_CORRECT");
    if(choices.length !== 4) issues.push("CHOICES_NOT_4");

    const correctInChoices = choiceValues.some(function(v){
      return sameMeaning(v, correct);
    });

    if(correct && !correctInChoices){
      issues.push("CORRECT_NOT_IN_CHOICES");
    }

    const seen = new Set();
    choiceValues.forEach(function(v){
      const key = norm(v);
      if(!key) return;

      if(seen.has(key)){
        issues.push("DUPLICATE_CHOICE");
      }

      seen.add(key);
    });

    if(norm(q.prompt) === "question text"){
      issues.push("FALLBACK_PROMPT");
    }

    if(choiceValues.join("|").toLowerCase() === "option a|option b|option c|option d"){
      issues.push("FALLBACK_CHOICES");
    }

    return {
      ok: issues.length === 0,
      issues: Array.from(new Set(issues)),
      term: q.term || "",
      correct: correct,
      choices: choiceValues,
      prompt: q.prompt || q.question || ""
    };
  }

  function auditAll(){
    const rows = [];

    BANKS.forEach(function(bank){
      ["easy", "normal", "hard", "challenge"].forEach(function(difficulty){
        ["learn", "speed", "mission", "battle"].forEach(function(mode){
          const questions = getQuestions({
            bank: bank,
            difficulty: difficulty,
            mode: mode,
            count: 20,
            seed: "AUDIT_" + bank + "_" + difficulty + "_" + mode
          });

          questions.forEach(function(q){
            const audit = auditQuestion(q);

            rows.push({
              bank: bank,
              difficulty: difficulty,
              mode: mode,
              ok: audit.ok,
              issues: audit.issues.join(", "),
              term: audit.term,
              correct: audit.correct,
              choices: audit.choices.join(" | "),
              prompt: audit.prompt
            });
          });
        });
      });
    });

    const bad = rows.filter(function(x){
      return !x.ok;
    });

    console.group("🧪 VOCAB QUESTION AUDIT " + VERSION);
    console.log({
      total: rows.length,
      ok: rows.length - bad.length,
      bad: bad.length
    });
    console.table(bad.length ? bad : rows.slice(0, 20));
    console.groupEnd();

    return {
      version: VERSION,
      rows: rows,
      bad: bad,
      summary: {
        total: rows.length,
        ok: rows.length - bad.length,
        bad: bad.length
      }
    };
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

  /* =========================================================
     PUBLIC API
  ========================================================= */

  const api = {
    version: VERSION,

    getEntries,
    getBankEntries: getEntries,
    allEntries,

    getQuestions,
    buildQuestions,
    pickQuestions,

    buildQuestion,
    normalizeEntry,

    auditQuestion,
    auditAll,

    getDebugSummary,

    normalizeMode,
    normalizeDifficulty
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
