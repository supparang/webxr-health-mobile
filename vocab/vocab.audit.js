/* =========================================================
   /vocab/vocab.audit.js
   TechPath Vocab Arena — Answer Audit Tool
   PATCH: v20260503s

   Purpose:
   - ตรวจว่าแต่ละข้อมีเฉลยถูกต้องเชิงโครงสร้าง
   - ตรวจว่า correct answer อยู่ใน choices จริง
   - ตรวจตัวเลือกซ้ำ
   - ตรวจ term / meaning ว่าง
   - ตรวจคำถาม fallback เช่น Question text / Option A-D
   - แสดงรายงานใน console.table
========================================================= */

(function(){
  "use strict";

  const WIN = window;
  const VERSION = "vocab-audit-v20260503s";

  const BANKS = ["A", "B", "C"];
  const MODES = ["learn", "speed", "mission", "battle"];
  const DIFFS = ["easy", "normal", "hard", "challenge"];

  function clean(s){
    return String(s ?? "").trim();
  }

  function norm(s){
    return clean(s).toLowerCase().replace(/\s+/g, " ");
  }

  function pick(){
    for(let i = 0; i < arguments.length; i++){
      const v = arguments[i];
      if(v !== undefined && v !== null && v !== "") return v;
    }
    return "";
  }

  function getQuestionEngine(){
    return (
      WIN.VocabQuestion ||
      WIN.VocabQuestions ||
      WIN.VocabQuestionEngine ||
      null
    );
  }

  function getQuestions(bank, difficulty, mode){
    const engine = getQuestionEngine();

    if(!engine){
      return [];
    }

    if(typeof engine.getQuestions === "function"){
      return engine.getQuestions({
        bank,
        difficulty,
        diff: difficulty,
        mode,
        count: 50,
        seed: "AUDIT_" + bank + "_" + difficulty + "_" + mode
      }) || [];
    }

    if(typeof engine.buildQuestions === "function"){
      return engine.buildQuestions(bank, difficulty, mode, 50) || [];
    }

    if(typeof engine.pickQuestions === "function"){
      return engine.pickQuestions(bank, difficulty, mode, 50) || [];
    }

    return [];
  }

  function getEntries(bank){
    const engine = getQuestionEngine();

    if(!engine){
      return [];
    }

    if(typeof engine.getEntries === "function"){
      return engine.getEntries(bank) || [];
    }

    if(typeof engine.getBankEntries === "function"){
      return engine.getBankEntries(bank) || [];
    }

    return [];
  }

  function normalizeChoice(c){
    if(c && typeof c === "object"){
      return {
        text: clean(pick(c.text, c.label, c.value, c.answer, "")),
        value: clean(pick(c.value, c.text, c.label, c.answer, "")),
        correctFlag:
          c.correct === true ||
          c.isCorrect === true ||
          c.is_correct === true ||
          c.answer === true
      };
    }

    return {
      text: clean(c),
      value: clean(c),
      correctFlag: false
    };
  }

  function normalizeQuestion(q){
    q = q || {};

    const rawChoices =
      q.choices ||
      q.options ||
      q.answers ||
      [];

    const choices = Array.isArray(rawChoices)
      ? rawChoices.map(normalizeChoice)
      : [];

    let correct = clean(
      pick(
        q.correct,
        q.correct_answer,
        q.correctAnswer,
        q.answer,
        q.key,
        q.solution,
        ""
      )
    );

    const correctIndex = pick(
      q.correctIndex,
      q.correct_index,
      q.answerIndex,
      q.answer_index,
      ""
    );

    if(!correct && correctIndex !== "" && choices[Number(correctIndex)]){
      correct = choices[Number(correctIndex)].value;
    }

    if(!correct){
      const flagged = choices.find(function(c){
        return c.correctFlag;
      });

      if(flagged){
        correct = flagged.value;
      }
    }

    return {
      id: clean(pick(q.id, q.qid, q.question_id, "")),
      bank: clean(pick(q.bank, "")),
      difficulty: clean(pick(q.difficulty, q.diff, "")),
      mode: clean(pick(q.mode, "")),
      term: clean(pick(q.term, q.word, q.vocab, q.keyword, "")),
      prompt: clean(pick(q.prompt, q.question, q.question_text, q.questionText, q.text, "")),
      correct,
      choices,
      explain: clean(pick(q.explain, q.explanation, q.feedback, "")),
      raw: q
    };
  }

  function hasDuplicateValues(values){
    const seen = new Set();
    const duplicates = [];

    values.forEach(function(v){
      const key = norm(v);
      if(!key) return;

      if(seen.has(key)){
        duplicates.push(v);
      }else{
        seen.add(key);
      }
    });

    return duplicates;
  }

  function auditQuestion(q, context){
    const item = normalizeQuestion(q);

    const choiceValues = item.choices.map(function(c){
      return c.value;
    });

    const choiceTexts = item.choices.map(function(c){
      return c.text;
    });

    const correctInChoices = choiceValues.some(function(v){
      return norm(v) === norm(item.correct);
    });

    const duplicatedChoices = hasDuplicateValues(choiceValues);

    const correctCountByFlag = item.choices.filter(function(c){
      return c.correctFlag;
    }).length;

    const fallbackQuestion =
      norm(item.prompt) === "question text" ||
      norm(item.prompt).includes("question text");

    const fallbackChoices =
      choiceValues.length === 4 &&
      norm(choiceValues[0]) === "option a" &&
      norm(choiceValues[1]) === "option b" &&
      norm(choiceValues[2]) === "option c" &&
      norm(choiceValues[3]) === "option d";

    const issues = [];

    if(!item.term) issues.push("NO_TERM");
    if(!item.prompt) issues.push("NO_PROMPT");
    if(!item.correct) issues.push("NO_CORRECT");
    if(item.choices.length < 4) issues.push("CHOICES_LESS_THAN_4");
    if(item.choices.length > 4) issues.push("CHOICES_MORE_THAN_4");
    if(item.correct && !correctInChoices) issues.push("CORRECT_NOT_IN_CHOICES");
    if(duplicatedChoices.length) issues.push("DUPLICATED_CHOICES");
    if(correctCountByFlag > 1) issues.push("MULTIPLE_CORRECT_FLAGS");
    if(fallbackQuestion) issues.push("FALLBACK_QUESTION_TEXT");
    if(fallbackChoices) issues.push("FALLBACK_OPTION_A_D");
    if(norm(item.term) === norm(item.correct)) issues.push("TERM_EQUALS_CORRECT");
    if(!item.explain) issues.push("NO_EXPLANATION");

    return {
      ok: issues.length === 0,
      issues: issues.join(", "),
      bank: context.bank,
      difficulty: context.difficulty,
      mode: context.mode,
      id: item.id,
      term: item.term,
      prompt: item.prompt,
      correct: item.correct,
      choices: choiceValues.join(" | "),
      duplicatedChoices: duplicatedChoices.join(" | "),
      correctInChoices,
      correctCountByFlag
    };
  }

  function auditEntries(){
    const rows = [];

    BANKS.forEach(function(bank){
      const entries = getEntries(bank);

      entries.forEach(function(e, index){
        const term = clean(pick(e.term, e.word, e.vocab, e.keyword, ""));
        const meaning = clean(pick(e.meaning, e.definition, e.def, e.answer, e.correct, e.thai, e.translation, ""));

        const issues = [];

        if(!term) issues.push("ENTRY_NO_TERM");
        if(!meaning) issues.push("ENTRY_NO_MEANING");
        if(norm(term) === norm(meaning)) issues.push("ENTRY_TERM_EQUALS_MEANING");

        rows.push({
          ok: issues.length === 0,
          issues: issues.join(", "),
          bank,
          index,
          term,
          meaning,
          category: clean(pick(e.category, e.cat, e.topic, "")),
          raw: e
        });
      });
    });

    return rows;
  }

  function auditQuestions(){
    const rows = [];

    BANKS.forEach(function(bank){
      DIFFS.forEach(function(difficulty){
        MODES.forEach(function(mode){
          const questions = getQuestions(bank, difficulty, mode);

          if(!questions.length){
            rows.push({
              ok: false,
              issues: "NO_QUESTIONS_GENERATED",
              bank,
              difficulty,
              mode,
              id: "",
              term: "",
              prompt: "",
              correct: "",
              choices: "",
              duplicatedChoices: "",
              correctInChoices: false,
              correctCountByFlag: 0
            });

            return;
          }

          questions.forEach(function(q){
            rows.push(
              auditQuestion(q, {
                bank,
                difficulty,
                mode
              })
            );
          });
        });
      });
    });

    return rows;
  }

  function summarize(rows){
    const total = rows.length;
    const bad = rows.filter(function(r){ return !r.ok; });
    const byIssue = {};

    bad.forEach(function(r){
      clean(r.issues).split(",").map(clean).filter(Boolean).forEach(function(issue){
        byIssue[issue] = (byIssue[issue] || 0) + 1;
      });
    });

    return {
      total,
      ok: total - bad.length,
      bad: bad.length,
      byIssue
    };
  }

  function runAudit(){
    const entryRows = auditEntries();
    const questionRows = auditQuestions();

    const badEntries = entryRows.filter(function(r){
      return !r.ok;
    });

    const badQuestions = questionRows.filter(function(r){
      return !r.ok;
    });

    console.group("🧪 VOCAB AUDIT " + VERSION);

    console.log("Entry summary:", summarize(entryRows));
    console.table(badEntries.length ? badEntries : entryRows.slice(0, 10));

    console.log("Question summary:", summarize(questionRows));
    console.table(badQuestions.length ? badQuestions : questionRows.slice(0, 20));

    console.groupEnd();

    return {
      version: VERSION,
      entries: {
        summary: summarize(entryRows),
        rows: entryRows,
        bad: badEntries
      },
      questions: {
        summary: summarize(questionRows),
        rows: questionRows,
        bad: badQuestions
      }
    };
  }

  function exportCsv(rows){
    rows = rows || [];

    if(!rows.length){
      return "";
    }

    const headers = Object.keys(rows[0]).filter(function(k){
      return k !== "raw";
    });

    const csv = [
      headers.join(",")
    ].concat(
      rows.map(function(row){
        return headers.map(function(h){
          return '"' + String(row[h] ?? "").replaceAll('"', '""') + '"';
        }).join(",");
      })
    ).join("\n");

    return csv;
  }

  function downloadBadQuestionsCsv(){
    const result = runAudit();
    const csv = exportCsv(result.questions.bad);

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8"
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = "vocab-question-audit-bad.csv";
    a.click();

    setTimeout(function(){
      URL.revokeObjectURL(url);
    }, 1000);
  }

  const api = {
    version: VERSION,
    runAudit,
    auditEntries,
    auditQuestions,
    downloadBadQuestionsCsv
  };

  WIN.VocabAudit = api;

  console.log("[VOCAB AUDIT] loaded", VERSION);
  console.log("Run: VocabAudit.runAudit()");
  console.log("Download bad questions CSV: VocabAudit.downloadBadQuestionsCsv()");
})();
