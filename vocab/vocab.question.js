/* =========================================================
   /vocab/vocab.question.js
   TechPath Vocab Arena — Question Builder
   Version: 20260502a

   ต้องโหลดหลัง:
   - /vocab/vocab.config.js
   - /vocab/vocab.utils.js
   - /vocab/vocab.state.js
   - /vocab/vocab.data.js

   หน้าที่:
   - สร้างโจทย์แต่ละข้อ
   - สร้างตัวเลือก
   - เลือกตัวหลอกตามระดับ
   - ลดคำถามซ้ำ
   - รองรับ warmup / speed / trap / mission / boss
   ========================================================= */

(function(){
  "use strict";

  const U = window.VocabUtils;
  const D = window.VocabData;
  const S = window.VocabState;

  if(!U){
    console.error("[VOCAB] vocab.question.js requires vocab.utils.js");
    return;
  }

  if(!D){
    console.error("[VOCAB] vocab.question.js requires vocab.data.js");
    return;
  }

  if(!S){
    console.warn("[VOCAB] vocab.question.js works better with vocab.state.js");
  }

  const Q = {};

  /* =========================================================
     QUESTION TEMPLATE
  ========================================================= */

  Q.stageTemplates = {
    warmup: [
      term => ({
        mode: "meaning",
        answerMode: "meaning",
        prompt: `What does "${term.term}" mean?`,
        explain: `"${term.term}" means "${term.meaning}".`
      }),
      term => ({
        mode: "meaning",
        answerMode: "meaning",
        prompt: `Choose the best meaning of "${term.term}".`,
        explain: `"${term.term}" means "${term.meaning}".`
      }),
      term => ({
        mode: "reverse",
        answerMode: "term",
        prompt: `Which word means: "${term.meaning}"?`,
        explain: `The word is "${term.term}".`
      })
    ],

    speed: [
      term => ({
        mode: "quick",
        answerMode: "meaning",
        prompt: `Quick! "${term.term}" means...`,
        explain: `Speed question: "${term.term}" = "${term.meaning}".`
      }),
      term => ({
        mode: "quick",
        answerMode: "meaning",
        prompt: `Fast answer: choose the meaning of "${term.term}".`,
        explain: `Speed question: "${term.term}" = "${term.meaning}".`
      }),
      term => ({
        mode: "quick_reverse",
        answerMode: "term",
        prompt: `Fast answer: which word means "${term.meaning}"?`,
        explain: `The answer is "${term.term}".`
      })
    ],

    trap: [
      term => ({
        mode: "trap",
        answerMode: "meaning",
        prompt: `Careful! Which meaning truly matches "${term.term}"?`,
        explain: `Trap clue: focus on the exact meaning of "${term.term}".`
      }),
      term => ({
        mode: "trap",
        answerMode: "meaning",
        prompt: `Trap Round: do not choose a similar-but-wrong meaning. What is "${term.term}"?`,
        explain: `Trap clue: "${term.term}" means "${term.meaning}".`
      }),
      term => ({
        mode: "trap_reverse",
        answerMode: "term",
        prompt: `Trap Round: which technical word exactly means "${term.meaning}"?`,
        explain: `The exact word is "${term.term}".`
      })
    ],

    mission: [
      term => ({
        mode: "context",
        answerMode: "term",
        prompt: D.buildSituationPrompt(term, false),
        explain: `The best word for this situation is "${term.term}".`
      }),
      term => ({
        mode: "context_precision",
        answerMode: "term",
        prompt: D.buildSituationPrompt(term, true),
        explain: `The precise word is "${term.term}".`
      })
    ],

    boss: [
      term => ({
        mode: "boss_context",
        answerMode: "term",
        prompt: `Boss Attack! ${D.buildSituationPrompt(term, true)}`,
        explain: `Boss clue answer: "${term.term}".`
      }),
      term => ({
        mode: "boss_meaning",
        answerMode: "meaning",
        prompt: `Boss Shield! Break it by choosing the exact meaning of "${term.term}".`,
        explain: `"${term.term}" means "${term.meaning}".`
      }),
      term => ({
        mode: "boss_case",
        answerMode: "term",
        prompt: `Final Boss Case: ${D.buildChallengeCase(term)}`,
        explain: `The best answer is "${term.term}" because it matches: ${term.meaning}`
      })
    ]
  };

  /* =========================================================
     DIFFICULTY BLUEPRINT
  ========================================================= */

  Q.buildBlueprint = function buildBlueprint(term, stage, difficulty){
    const cleanTerm = D.normalizeTerm(term);
    const stageId = String(stage?.id || stage || "warmup");
    const diff = String(difficulty || window.vocabGame?.difficulty || "easy").toLowerCase();
    const roll = U.rand();

    if(diff === "easy"){
      if(stageId === "mission" || roll > 0.72){
        return {
          mode: "easy_reverse",
          answerMode: "term",
          prompt: `Which word means: "${cleanTerm.meaning}"?`,
          explain: `The word is "${cleanTerm.term}".`
        };
      }

      return U.pick(Q.stageTemplates.warmup)(cleanTerm);
    }

    if(diff === "normal"){
      if(stageId === "mission" || stageId === "boss" || roll > 0.45){
        return {
          mode: "normal_context",
          answerMode: "term",
          prompt: D.buildSituationPrompt(cleanTerm, false),
          explain: `In this context, the best word is "${cleanTerm.term}".`
        };
      }

      return {
        mode: "normal_meaning",
        answerMode: "meaning",
        prompt: `Choose the best meaning of "${cleanTerm.term}".`,
        explain: `"${cleanTerm.term}" means "${cleanTerm.meaning}".`
      };
    }

    if(diff === "hard"){
      if(stageId === "trap" || stageId === "mission" || roll > 0.35){
        return {
          mode: "hard_precision_context",
          answerMode: "term",
          prompt: D.buildSituationPrompt(cleanTerm, true),
          explain: `The precise term is "${cleanTerm.term}".`
        };
      }

      return {
        mode: "hard_reverse_definition",
        answerMode: "term",
        prompt: `Pick the most accurate technical word for this definition: "${cleanTerm.meaning}"`,
        explain: `The accurate word is "${cleanTerm.term}".`
      };
    }

    /*
      challenge
    */
    if(stageId === "boss" || stageId === "trap" || roll > 0.25){
      return {
        mode: "challenge_workplace_case",
        answerMode: "term",
        prompt: D.buildChallengeCase(cleanTerm),
        explain: `The best answer is "${cleanTerm.term}" because it matches: ${cleanTerm.meaning}`
      };
    }

    return {
      mode: "challenge_precision_meaning",
      answerMode: "meaning",
      prompt: `Precision check: which definition best matches "${cleanTerm.term}" in a CS/AI project?`,
      explain: `"${cleanTerm.term}" = ${cleanTerm.meaning}`
    };
  };

  /* =========================================================
     DISTRACTOR SCORING
  ========================================================= */

  Q.tokenizeMeaning = function tokenizeMeaning(text){
    const stop = new Set([
      "the","and","for","with","that","this","from","into","your","you","are","can","will",
      "a","an","to","of","or","in","on","as","by","is","be","it","its","their","they",
      "คือ","การ","ของ","และ","ใน","ที่","เป็น","ใช้","หรือ","ให้","ได้","กับ","จาก"
    ]);

    return String(text || "")
      .toLowerCase()
      .replace(/[^\w\sก-๙]/g, " ")
      .split(/\s+/)
      .map(x => x.trim())
      .filter(x => x.length > 2 && !stop.has(x));
  };

  Q.sharedKeywordCount = function sharedKeywordCount(a, b){
    const aw = Q.tokenizeMeaning(a);
    const bw = new Set(Q.tokenizeMeaning(b));

    let count = 0;

    aw.forEach(x => {
      if(bw.has(x)){
        count += 1;
      }
    });

    return count;
  };

  Q.scoreDistractor = function scoreDistractor(options){
    const correct = D.normalizeTerm(options.correct || {});
    const candidate = D.normalizeTerm(options.candidate || {});
    const stageId = String(options.stageId || "warmup");
    const difficulty = String(options.difficulty || window.vocabGame?.difficulty || "normal");
    const bank = String(options.bank || window.vocabGame?.bank || "A");

    let score = 0;

    const cw = String(correct.term || "").toLowerCase();
    const cm = String(correct.meaning || "").toLowerCase();
    const cc = String(correct.category || "").toLowerCase();

    const tw = String(candidate.term || "").toLowerCase();
    const tm = String(candidate.meaning || "").toLowerCase();
    const tc = String(candidate.category || "").toLowerCase();

    /*
      category เดียวกัน = เป็นตัวหลอกที่ดี
    */
    if(cc && tc && cc === tc){
      score += difficulty === "easy" ? 2 : 8;
    }

    /*
      คำขึ้นต้นเหมือนกัน หรือความยาวใกล้กัน = หลอกสายตาได้
    */
    if(cw && tw && cw[0] === tw[0]){
      score += difficulty === "easy" ? 1 : 3;
    }

    if(Math.abs(cw.length - tw.length) <= 3){
      score += 2;
    }

    /*
      meaning มี keyword ซ้ำ = หลอกเชิงความหมาย
    */
    const shared = Q.sharedKeywordCount(cm, tm);

    if(difficulty === "challenge"){
      score += shared * 4;
    }else if(difficulty === "hard"){
      score += shared * 3;
    }else{
      score += shared * 2;
    }

    /*
      stage ยากต้องเลือก distractor ที่ใกล้ขึ้น
    */
    if(stageId === "trap"){
      score += 5;
    }

    if(stageId === "boss"){
      score += 3;
    }

    if(difficulty === "hard"){
      score += 2;
    }

    if(difficulty === "challenge"){
      score += 4;
    }

    /*
      Bank B เน้น AI/Data ควรหลอกด้วย category ใกล้กัน
    */
    if(bank === "B" && cc && tc && cc === tc){
      score += 2;
    }

    /*
      กันคะแนนเท่ากัน
    */
    return score + U.rand();
  };

  Q.mixDistractors = function mixDistractors(sortedPool, count){
    const top = sortedPool.slice(0, Math.max(4, count + 2));
    const rest = sortedPool.slice(Math.max(4, count + 2));
    const mixed = [];

    if(top.length) mixed.push(top[0]);

    if(rest.length){
      mixed.push(rest[Math.floor(U.rand() * rest.length)]);
    }

    if(top.length > 1) mixed.push(top[1]);
    if(top.length > 2) mixed.push(top[2]);
    if(top.length > 3) mixed.push(top[3]);

    return D.dedupeTerms(mixed).slice(0, count);
  };

  /* =========================================================
     BUILD CHOICES
  ========================================================= */

  Q.buildChoices = function buildChoices(options){
    const correct = D.normalizeTerm(options.correctTerm || {});
    const allTerms = D.dedupeTerms(options.allTerms || []);
    const answerMode = String(options.answerMode || "meaning");
    const stageId = String(options.stageId || "warmup");
    const difficulty = String(options.difficulty || window.vocabGame?.difficulty || "easy");
    const bank = String(options.bank || window.vocabGame?.bank || "A");

    const feel = D.getDifficultyFeel(difficulty);
    const choiceCount = Number(feel.choiceCount || 4);
    const distractorCount = Math.max(3, choiceCount - 1);

    let pool = allTerms.filter(t => {
      return U.termKey(t.term) !== U.termKey(correct.term);
    });

    if(pool.length < distractorCount){
      pool = pool.concat(D.getOtherBankTerms(bank));
      pool = D.dedupeTerms(pool).filter(t => U.termKey(t.term) !== U.termKey(correct.term));
    }

    pool = pool
      .map(t => ({
        ...t,
        _trapScore: Q.scoreDistractor({
          correct,
          candidate: t,
          stageId,
          difficulty,
          bank
        })
      }))
      .sort((a,b) => Number(b._trapScore || 0) - Number(a._trapScore || 0));

    let distractors;

    if(difficulty === "easy" && stageId === "warmup"){
      distractors = U.shuffle(pool).slice(0, distractorCount);
    }else if(stageId === "speed"){
      distractors = Q.mixDistractors(pool, distractorCount);
    }else{
      distractors = pool.slice(0, distractorCount);
    }

    /*
      fallback เติมให้ครบ
    */
    while(distractors.length < distractorCount && pool.length){
      const extra = U.pick(pool);
      if(extra && !distractors.some(x => U.termKey(x.term) === U.termKey(extra.term))){
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
        meaning: correct.meaning,
        category: correct.category,
        bank: correct.bank
      });

      distractors.forEach(t => {
        choices.push({
          text: t.meaning,
          correct: false,
          term: t.term,
          meaning: t.meaning,
          category: t.category,
          bank: t.bank
        });
      });
    }else{
      choices.push({
        text: correct.term,
        correct: true,
        term: correct.term,
        meaning: correct.meaning,
        category: correct.category,
        bank: correct.bank
      });

      distractors.forEach(t => {
        choices.push({
          text: t.term,
          correct: false,
          term: t.term,
          meaning: t.meaning,
          category: t.category,
          bank: t.bank
        });
      });
    }

    return U.shuffle(choices).slice(0, choiceCount);
  };

  /* =========================================================
     BUILD QUESTION
  ========================================================= */

  Q.buildQuestion = function buildQuestion(stage, options = {}){
    const game = window.vocabGame || {};
    const bank = options.bank || game.bank || "A";
    const difficulty = options.difficulty || game.difficulty || "easy";
    const mode = options.mode || game.mode || "learn";

    const terms = D.dedupeTerms(options.terms || game.terms || D.buildTermDeck(bank, difficulty));
    const correctTerm = D.pickNextTerm(terms, { bank, difficulty, mode });
    const blueprint = Q.buildBlueprint(correctTerm, stage, difficulty);

    D.rememberQuestion(correctTerm, blueprint.prompt);

    const choices = Q.buildChoices({
      correctTerm,
      allTerms: terms,
      answerMode: blueprint.answerMode,
      stageId: stage?.id || stage || "warmup",
      difficulty,
      bank
    });

    return {
      id: `q_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      stageId: stage?.id || stage || "warmup",
      stageName: stage?.name || "",
      mode: blueprint.mode,
      answerMode: blueprint.answerMode,
      prompt: blueprint.prompt,
      correctTerm,
      choices,
      explain: blueprint.explain || "",
      difficultyNote: blueprint.difficultyNote || "",
      bank,
      difficulty,
      playMode: mode
    };
  };

  /* =========================================================
     CORRECT TEXT / ANSWER HELPERS
  ========================================================= */

  Q.getCorrectChoiceText = function getCorrectChoiceText(question){
    if(!question) return "";

    const term = question.correctTerm || {};

    if(question.answerMode === "meaning"){
      return term.meaning || term.definition || "";
    }

    return term.term || term.word || "";
  };

  Q.isChoiceCorrect = function isChoiceCorrect(choice){
    return !!(choice && choice.correct);
  };

  Q.findCorrectChoice = function findCorrectChoice(question){
    if(!question || !Array.isArray(question.choices)) return null;
    return question.choices.find(c => c.correct) || null;
  };

  Q.explainChoice = function explainChoice(question, choice){
    if(!question) return "";

    const correct = question.correctTerm || {};
    const selected = choice || {};

    if(selected.correct){
      return `✅ ถูกต้อง! ${correct.term} = ${correct.meaning}`;
    }

    return `💡 คำตอบที่ถูกคือ ${correct.term} = ${correct.meaning}`;
  };

  /* =========================================================
     AI HELP CLUE
     ใช้กับ vocab.ai.js ต่อได้ แต่มี fallback ไว้
  ========================================================= */

  Q.extractPromptKeywords = function extractPromptKeywords(text){
    const stop = new Set([
      "the","and","for","with","that","this","from","into","your","you","are","can","will",
      "which","word","fits","best","choose","meaning","what","does","mean","term","technical",
      "คำ","คือ","การ","ของ","และ","ใน","ที่","เป็น","ใช้","หรือ","ให้","ได้"
    ]);

    return String(text || "")
      .toLowerCase()
      .replace(/[^\w\sก-๙]/g, " ")
      .split(/\s+/)
      .map(x => x.trim())
      .filter(x => x.length > 3 && !stop.has(x))
      .slice(0, 8);
  };

  Q.buildConceptClue = function buildConceptClue(term){
    const t = D.normalizeTerm(term);
    const w = String(t.term || "").toLowerCase();
    const m = String(t.meaning || "").toLowerCase();

    const clues = [
      {
        keys:["debug","bug","error","fix"],
        text:"กลุ่มคำใบ้: error / fix / code problem → คิดถึงการหาข้อผิดพลาดและแก้ไข"
      },
      {
        keys:["deploy","release","publish","online","rollout"],
        text:"กลุ่มคำใบ้: online / release / users access → คิดถึงการนำระบบไปให้ผู้ใช้ใช้งาน"
      },
      {
        keys:["dataset","data","examples"],
        text:"กลุ่มคำใบ้: many examples / AI learns / collection → คิดถึงชุดข้อมูล"
      },
      {
        keys:["algorithm","step"],
        text:"กลุ่มคำใบ้: step-by-step / solve problem → คิดถึงลำดับขั้นตอน"
      },
      {
        keys:["database","store","records"],
        text:"กลุ่มคำใบ้: store / accounts / records → คิดถึงระบบจัดเก็บข้อมูล"
      },
      {
        keys:["interface","ui","screen","buttons"],
        text:"กลุ่มคำใบ้: buttons / screen / users interact → คิดถึงส่วนที่ผู้ใช้โต้ตอบ"
      },
      {
        keys:["requirement","client","needs"],
        text:"กลุ่มคำใบ้: client needs / system must do → คิดถึงความต้องการของระบบ"
      },
      {
        keys:["deadline","friday","finish"],
        text:"กลุ่มคำใบ้: final date / must finish → คิดถึงกำหนดส่ง"
      },
      {
        keys:["prototype","early","test"],
        text:"กลุ่มคำใบ้: early version / testing idea → คิดถึงต้นแบบ"
      },
      {
        keys:["accuracy","correct"],
        text:"กลุ่มคำใบ้: how often correct → คิดถึงความแม่นยำ"
      },
      {
        keys:["classification","categories","groups"],
        text:"กลุ่มคำใบ้: put into groups/categories → คิดถึงการจัดประเภท"
      },
      {
        keys:["prompt","instruction","ai"],
        text:"กลุ่มคำใบ้: instruction to AI → คิดถึงคำสั่งที่ส่งให้ AI"
      },
      {
        keys:["authentication","permission"],
        text:"กลุ่มคำใบ้: check identity / allowed access → คิดถึงการยืนยันตัวตนหรือสิทธิ์"
      },
      {
        keys:["overfitting"],
        text:"กลุ่มคำใบ้: works on training data but fails on new data → คิดถึง overfitting"
      },
      {
        keys:["precision","recall","metric"],
        text:"กลุ่มคำใบ้: measure model performance → คิดถึงตัวชี้วัดการประเมินผล"
      },
      {
        keys:["scope","deliverable","milestone"],
        text:"กลุ่มคำใบ้: project boundary / important point / output → คิดถึงการจัดการโครงการ"
      }
    ];

    const found = clues.find(c => {
      return c.keys.some(k => {
        const key = String(k).toLowerCase();
        return w.includes(key) || m.includes(key);
      });
    });

    if(found) return found.text;

    return `ลองเทียบคำตอบกับแนวคิดหลัก: ${t.meaning || ""}`;
  };

  Q.buildAiHelp = function buildAiHelp(question, stage){
    const term = D.normalizeTerm(question?.correctTerm || {});
    const prompt = String(question?.prompt || "");
    const answerMode = question?.answerMode || "meaning";
    const stageId = stage?.id || question?.stageId || "";
    const keywords = Q.extractPromptKeywords(prompt);

    const lines = [];

    lines.push("<b>AI Help</b> ช่วยคิด ไม่เฉลยตรง ๆ");

    if(answerMode === "term"){
      lines.push("โจทย์นี้ให้ดู “สถานการณ์” แล้วเลือกคำศัพท์ที่เหมาะที่สุด");
    }else{
      lines.push("โจทย์นี้ถาม “ความหมายที่ถูกต้อง” ของคำศัพท์");
    }

    if(keywords.length){
      lines.push(`Keyword ที่ควรสังเกต: <b>${keywords.map(U.escapeHtml).join(", ")}</b>`);
    }

    const clue = Q.buildConceptClue(term);

    if(clue){
      lines.push(U.escapeHtml(clue));
    }

    if(stageId === "trap"){
      lines.push("ระวังตัวเลือกที่ความหมายใกล้กัน ให้ดูคำหลักในนิยาม ไม่ใช่แค่คำที่ดูคุ้น");
    }

    if(stageId === "mission" || question?.mode === "context" || question?.mode === "boss_context"){
      lines.push("ลองถามตัวเองว่า “ในสถานการณ์นี้ คนกำลังทำอะไรกับระบบ/ข้อมูล/โปรเจกต์?”");
    }

    lines.push("ใช้ AI Help แล้วคะแนนข้อนี้จะลดเล็กน้อย เพื่อให้ Leaderboard ยุติธรรม");

    return lines.join("<br>");
  };

  /* =========================================================
     PUBLIC / COMPATIBILITY
  ========================================================= */

  window.VocabQuestion = Q;

  /*
    compatibility กับ vocab.html เดิม
  */
  window.buildQuestionV6 = function buildQuestionV6(stage){
    return Q.buildQuestion(stage);
  };

  window.buildQuestionBlueprintV71 = function buildQuestionBlueprintV71(term, stage){
    return Q.buildBlueprint(term, stage, window.vocabGame?.difficulty || "easy");
  };

  window.buildChoicesV61 = function buildChoicesV61(options){
    return Q.buildChoices(options || {});
  };

  window.buildChoicesV6 = function buildChoicesV6(correctTerm, allTerms, mode){
    const answerMode = mode === "context" || mode === "boss_context" ? "term" : "meaning";

    return Q.buildChoices({
      correctTerm,
      allTerms,
      answerMode,
      stageId: mode || "warmup",
      difficulty: window.vocabGame?.difficulty || "normal",
      bank: window.vocabGame?.bank || "A"
    });
  };

  window.scoreDistractorV61 = function scoreDistractorV61(args){
    return Q.scoreDistractor({
      correct: args.correct,
      candidate: args.candidate,
      stageId: args.stageId,
      difficulty: args.difficulty,
      bank: args.bank
    });
  };

  window.sharedKeywordCountV61 = Q.sharedKeywordCount;
  window.tokenizeMeaningV61 = Q.tokenizeMeaning;
  window.mixDistractorsV61 = Q.mixDistractors;
  window.getCorrectChoiceTextV62 = Q.getCorrectChoiceText;
  window.buildAiHelpTextV67 = Q.buildAiHelp;
  window.extractPromptKeywordsV67 = Q.extractPromptKeywords;
  window.buildConceptClueV67 = Q.buildConceptClue;

  console.log("[VOCAB] question builder loaded");

})();
