/* =========================================================
   EAP Word Quest • Engine QA Hotfix
   File: /herohealth/eap-word-quest/eap-word-engine-v163-qa-hotfix.js
   Version: v1.6.3-QA-SENTENCE-LEAK-TUNED

   Purpose:
   - Tune academic_sentence QA
   - Do not flag broad single words such as project/system/data/report/user
   - Still flag exact target leaks for multi-word academic terms
   - Re-export QA / item validity / round quality / final release helpers
========================================================= */

"use strict";

(function(){
  const HOTFIX_VERSION = "v1.6.3-QA-SENTENCE-LEAK-TUNED";

  window.APP_VERSION = HOTFIX_VERSION;

  const QUESTION_BANK = Array.isArray(window.QUESTION_BANK) ? window.QUESTION_BANK : [];
  const SPECS = window.EAP_VOCAB_SPECS || {};

  const CONTENT_SESSIONS = [
    "S1","S2","S3",
    "S4","S5","S6",
    "S7","S8","S9",
    "S10","S11","S12",
    "S13","S14","S15"
  ];

  const BOSS_SESSIONS = ["BG1","BG2","BG3","BG4","BG5"];

  const BOSS_GATE_CONFIG = {
    BG1:{ label:"Boss Gate 1", sessions:["S1","S2","S3"], minRound:24, minPool:360 },
    BG2:{ label:"Boss Gate 2", sessions:["S4","S5","S6"], minRound:24, minPool:360 },
    BG3:{ label:"Boss Gate 3", sessions:["S7","S8","S9"], minRound:24, minPool:360 },
    BG4:{ label:"Boss Gate 4", sessions:["S10","S11","S12"], minRound:26, minPool:360 },
    BG5:{ label:"Final Boss Gate", sessions:CONTENT_SESSIONS.slice(), minRound:30, minPool:1800 }
  };

  const BROAD_SINGLE_TARGETS = new Set([
    "project",
    "system",
    "data",
    "report",
    "user",
    "users",
    "student",
    "students",
    "team",
    "skill",
    "skills",
    "learning",
    "academic",
    "communication",
    "information",
    "task",
    "work",
    "result",
    "results",
    "outcome",
    "outcomes",
    "presentation",
    "email",
    "meeting",
    "discussion",
    "problem",
    "solution",
    "feature",
    "function",
    "process",
    "input",
    "output",
    "model"
  ]);

  const BANNED_PROMPT_FRAGMENTS = [
    "which option is the correct",
    "this is useful for the task",
    "upgrade this plain sentence",
    "near-miss challenge",
    "which option is correct",
    "choose the sentence that sounds most academic"
  ];

  function normalizeText(value){
    return String(value == null ? "" : value).replace(/\s+/g," ").trim();
  }

  function canonicalText(value){
    return normalizeText(value)
      .toLowerCase()
      .replace(/[“”]/g,'"')
      .replace(/[‘’]/g,"'")
      .replace(/[‐-‒–—−]/g," ")
      .replace(/\busers\b/g,"user")
      .replace(/\bskills\b/g,"skill")
      .replace(/\bitems\b/g,"item")
      .replace(/\boutcomes\b/g,"outcome")
      .replace(/\bresults\b/g,"result")
      .replace(/\bfindings\b/g,"finding")
      .replace(/\btasks\b/g,"task")
      .replace(/\s+/g," ")
      .trim();
  }

  function familyFromText(text){
    const t = canonicalText(text);

    if(/\b(goal|objective|aim|purpose|target)\b/.test(t)) return "goal";
    if(/\b(need|requirement|gap|problem|issue|challenge|barrier|limitation|constraint)\b/.test(t)) return "need_problem";
    if(/\b(user|learner|participant|audience|recipient|sender|candidate|applicant)\b/.test(t)) return "people";
    if(/\b(scope|context|boundary|coverage|range)\b/.test(t)) return "scope_context";
    if(/\b(benefit|value|impact|advantage|effect)\b/.test(t)) return "benefit_value";
    if(/\b(system|interface|database|algorithm|workflow|process|input|output|dashboard|button|menu|screen|storage)\b/.test(t)) return "system";
    if(/\b(error|bug|fix|patch|debug|crash|freeze|hotfix|fallback|link|file|cache)\b/.test(t)) return "bug_fix";
    if(/\b(email|reply|request|greeting|attachment|signature|tone|language|inquiry)\b/.test(t)) return "email";
    if(/\b(meeting|discussion|agenda|decision|consensus|participant|moderator|minutes)\b/.test(t)) return "meeting";
    if(/\b(data|dataset|model|accuracy|analysis|finding|evidence|chart|prediction|variable)\b/.test(t)) return "data_ai";
    if(/\b(career|cv|interview|qualification|portfolio|pitch|leadership|employability)\b/.test(t)) return "career";
    if(/\b(reflection|presentation|outcome|recommendation|improvement|future work|showcase)\b/.test(t)) return "presentation_reflection";
    if(/\b(skill|teamwork|creativity|motivation|confidence|experience|background)\b/.test(t)) return "profile_skill";

    return "general";
  }

  function meaningfulTokens(value){
    const generic = new Set([
      "project","learning","academic","user","student","system","team",
      "final","professional","data","report","task","work","clear","clearly",
      "communication","context","information","supports","explains","provides",
      "uses","use","with","before","after","the","and","for","in","to",
      "express","sentence","accurately"
    ]);

    return canonicalText(value)
      .split(" ")
      .filter(t => t && t.length > 2 && !generic.has(t));
  }

  function areConfusableTerm(a,b){
    const ca = canonicalText(a);
    const cb = canonicalText(b);

    if(!ca || !cb) return true;
    if(ca === cb) return true;

    const fa = familyFromText(ca);
    const fb = familyFromText(cb);

    if(fa !== "general" && fa === fb) return true;

    const ta = meaningfulTokens(ca);
    const tb = new Set(meaningfulTokens(cb));
    const overlap = ta.filter(t => tb.has(t));

    return overlap.length >= 1;
  }

  function hasBadDistractor(item){
    const badWords = [
      "banana",
      "chair",
      "weather",
      "sandwich",
      "shoe",
      "food menu",
      "travel plan",
      "classroom color",
      "option ",
      "near alternative",
      "nice and useful",
      "good and students can learn"
    ];

    return (item.choices || []).some(choice => {
      const c = normalizeText(choice).toLowerCase();
      return badWords.some(bad => c.includes(bad));
    });
  }

  function promptIssue(item){
    const prompt = normalizeText(item.prompt);
    const low = prompt.toLowerCase();

    if(!prompt) return "missing-prompt";
    if(BANNED_PROMPT_FRAGMENTS.some(fragment => low.includes(fragment))) return "ambiguous-prompt";

    if(
      item.type === "academic_sentence" ||
      item.type === "applied_context" ||
      item.type === "context_gap" ||
      item.type === "collocation_meaning" ||
      item.type === "term_definition"
    ){
      if(!item.targetMeaning) return "missing-target-meaning";
      if(!prompt.includes(item.targetMeaning)) return "prompt-missing-target-meaning";
    }

    return "";
  }

  function isQuotedExactLeak(sentence,target){
    const raw = normalizeText(sentence).toLowerCase();
    const t = normalizeText(target).toLowerCase();

    if(!t) return false;

    return (
      raw.includes(`“${t}”`) ||
      raw.includes(`"${t}"`) ||
      raw.includes(`'${t}'`)
    );
  }

  function isMultiWordTargetLeak(sentence,target){
    const low = canonicalText(sentence);
    const t = canonicalText(target);
    const parts = t.split(" ").filter(Boolean);

    if(parts.length < 2) return false;

    return low.includes(t);
  }

  function isMeaningLeak(sentence,meaning){
    const low = canonicalText(sentence);
    const m = canonicalText(meaning);

    if(!m) return false;

    return low.includes(m);
  }

  function sentenceChoiceIssue(item){
    const choices = Array.isArray(item.choices) ? item.choices.map(normalizeText) : [];
    const answer = normalizeText(item.answer);
    const unique = new Set(choices.map(c => c.toLowerCase()));
    const target = normalizeText(item.targetTerm || item.word || "");
    const canonicalTarget = canonicalText(target);
    const targetParts = canonicalTarget.split(" ").filter(Boolean);
    const isBroadSingleTarget =
      targetParts.length === 1 &&
      BROAD_SINGLE_TARGETS.has(canonicalTarget);

    if(!answer) return "missing-answer";
    if(choices.length !== 4) return "choices-not-4";
    if(unique.size !== choices.length) return "duplicate-choices";
    if(!choices.includes(answer)) return "answer-not-in-choices";
    if(hasBadDistractor(item)) return "weak-distractor";

    const leaks = choices.filter(c => c !== answer).filter(choice => {
      if(isMeaningLeak(choice,item.targetMeaning)) return true;

      if(isBroadSingleTarget){
        return false;
      }

      if(isQuotedExactLeak(choice,target)) return true;
      if(isMultiWordTargetLeak(choice,target)) return true;

      return false;
    });

    if(leaks.length) return "sentence-target-leak";

    return "";
  }

  function termChoiceIssue(item){
    const choices = Array.isArray(item.choices) ? item.choices.map(normalizeText) : [];
    const answer = normalizeText(item.answer);
    const unique = new Set(choices.map(c => c.toLowerCase()));

    if(!answer) return "missing-answer";
    if(choices.length !== 4) return "choices-not-4";
    if(unique.size !== choices.length) return "duplicate-choices";
    if(!choices.includes(answer)) return "answer-not-in-choices";
    if(hasBadDistractor(item)) return "weak-distractor";
    if(choices.filter(c => c !== answer).some(c => areConfusableTerm(c,answer))) return "semantic-collision";

    return "";
  }

  function choiceIssue(item){
    if(item.type === "academic_sentence"){
      return sentenceChoiceIssue(item);
    }

    return termChoiceIssue(item);
  }

  function itemIssue(item){
    if(!item || typeof item !== "object") return "invalid-item";
    if(!item.id) return "missing-id";
    if(!item.session) return "missing-session";
    if(!item.word) return "missing-word";
    if(!item.type) return "missing-type";
    if(!item.level) return "missing-level";

    const p = promptIssue(item);
    if(p) return p;

    const c = choiceIssue(item);
    if(c) return c;

    return "";
  }

  function getPoolBySession(sessionId){
    if(sessionId === "DAILY" || sessionId === "SPEED" || sessionId === "WEAK"){
      return QUESTION_BANK.filter(q => CONTENT_SESSIONS.includes(q.session));
    }

    if(BOSS_GATE_CONFIG[sessionId]){
      const targets = BOSS_GATE_CONFIG[sessionId].sessions;
      return QUESTION_BANK.filter(q => targets.includes(q.session));
    }

    return QUESTION_BANK.filter(q => q.session === sessionId);
  }

  function questionWordKey(q){
    return canonicalText(q && (q.word || q.targetTerm || q.answer || q.id));
  }

  function shuffle(arr){
    const a = arr.slice();

    for(let i = a.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      [a[i],a[j]] = [a[j],a[i]];
    }

    return a;
  }

  function sampleUniqueWords(pool,count){
    const out = [];
    const seen = new Set();

    for(const q of shuffle(pool || [])){
      if(out.length >= count) break;

      const key = questionWordKey(q);
      if(seen.has(key)) continue;

      seen.add(key);
      out.push(q);
    }

    return out;
  }

  function buildInspectionRound(target){
    if(BOSS_GATE_CONFIG[target]){
      const cfg = BOSS_GATE_CONFIG[target];
      return sampleUniqueWords(getPoolBySession(target),target === "BG5" ? 30 : cfg.minRound);
    }

    if(target === "DAILY"){
      const pool = QUESTION_BANK.filter(q =>
        CONTENT_SESSIONS.includes(q.session) &&
        (q.level === "B1" || q.level === "B1+")
      );
      return sampleUniqueWords(pool.length >= 15 ? pool : getPoolBySession("DAILY"),15);
    }

    if(target === "SPEED"){
      return sampleUniqueWords(getPoolBySession("SPEED"),40);
    }

    if(target === "WEAK"){
      return sampleUniqueWords(getPoolBySession("WEAK"),12);
    }

    return sampleUniqueWords(getPoolBySession(target),12);
  }

  function choiceIsObviouslyWeak(choice,answer){
    const c = normalizeText(choice).toLowerCase();
    const a = normalizeText(answer).toLowerCase();

    if(!c) return true;
    if(c === a) return false;

    if(
      c.includes("option ") ||
      c.includes("near alternative") ||
      c.includes("nice and useful") ||
      c.includes("good and students can learn")
    ){
      return true;
    }

    if(/\b[a-z]{4,}e{2}\b/.test(c)) return true;
    if(/\b[a-z]{4,}(?:tioned|mented|nessed|shiped|ableed|backed)\b/.test(c)) return true;
    if(/\b[a-z]{4,}(?:inged|eded)\b/.test(c)) return true;

    return false;
  }

  function hasChoiceLengthDominance(q){
    if(!q || q.type !== "academic_sentence") return false;

    const answer = normalizeText(q.answer);
    const choices = Array.isArray(q.choices) ? q.choices.map(normalizeText) : [];
    const others = choices.filter(c => c && c !== answer);

    if(!answer || !others.length) return false;

    const answerLen = answer.length;
    const avgOtherLen = others.reduce((sum,c) => sum + c.length,0) / others.length;
    const maxOtherLen = Math.max.apply(null,others.map(c => c.length));
    const minOtherLen = Math.min.apply(null,others.map(c => c.length));

    if(answerLen > avgOtherLen * 1.9 && answerLen > maxOtherLen + 32) return true;
    if(maxOtherLen > minOtherLen * 2.8 && maxOtherLen - minOtherLen > 56) return true;

    return false;
  }

  function runEapQaLock(){
    const bank = window.QUESTION_BANK || [];
    const duplicateIds = [];
    const idSet = new Set();

    bank.forEach(item => {
      if(!item || !item.id) return;

      if(idSet.has(item.id)) duplicateIds.push(item.id);
      else idSet.add(item.id);
    });

    const issueItems = bank
      .map(item => ({
        id:item && item.id,
        session:item && item.session,
        word:item && item.word,
        type:item && item.type,
        level:item && item.level,
        issue:itemIssue(item)
      }))
      .filter(row => row.issue);

    const sessionRows = CONTENT_SESSIONS.map(sessionId => {
      const specWords = SPECS[sessionId] && Array.isArray(SPECS[sessionId].words)
        ? SPECS[sessionId].words.length
        : 0;

      const sessionItems = bank.filter(q => q.session === sessionId);
      const issueCount = issueItems.filter(q => q.session === sessionId).length;

      const row = {
        session:sessionId,
        words:specWords,
        items:sessionItems.length,
        expectedMinItems:120,
        A2:sessionItems.filter(q => q.level === "A2").length,
        A2plus:sessionItems.filter(q => q.level === "A2+").length,
        B1:sessionItems.filter(q => q.level === "B1").length,
        B1plus:sessionItems.filter(q => q.level === "B1+").length,
        hardItems:sessionItems.filter(q =>
          q.type === "academic_sentence" ||
          q.type === "applied_context" ||
          q.type === "context_gap"
        ).length,
        issueItems:issueCount
      };

      row.status =
        row.words >= 20 &&
        row.items >= 120 &&
        row.issueItems === 0
          ? "PASS"
          : "CHECK";

      return row;
    });

    const bossRows = BOSS_SESSIONS.map(gateId => {
      const cfg = BOSS_GATE_CONFIG[gateId];
      const pool = getPoolBySession(gateId);
      const bySession = {};

      cfg.sessions.forEach(s => {
        bySession[s] = pool.filter(q => q.session === s).length;
      });

      const hardPool = pool.filter(q =>
        q.type === "academic_sentence" ||
        q.type === "applied_context" ||
        q.type === "context_gap"
      ).length;

      return {
        gate:gateId,
        label:cfg.label,
        minRound:cfg.minRound,
        pool:pool.length,
        hardPool,
        sessions:cfg.sessions.join("/"),
        distribution:JSON.stringify(bySession),
        status:pool.length >= cfg.minPool && hardPool >= Math.round(pool.length * 0.45) ? "PASS" : "CHECK"
      };
    });

    const totalWords = sessionRows.reduce((sum,row) => sum + row.words,0);
    const totalItems = bank.length;
    const weakDistractors = bank.filter(hasBadDistractor).length;

    const summary = {
      version:HOTFIX_VERSION,
      totalWords,
      totalItems,
      expectedItems:1800,
      duplicateIds:duplicateIds.length,
      itemIssues:issueItems.length,
      weakDistractors,
      sessionsPass:sessionRows.filter(r => r.status === "PASS").length + "/" + sessionRows.length,
      bossGatesPass:bossRows.filter(r => r.status === "PASS").length + "/" + bossRows.length,
      finalStatus:
        totalWords >= 300 &&
        totalItems >= 1800 &&
        duplicateIds.length === 0 &&
        issueItems.length === 0 &&
        sessionRows.every(r => r.status === "PASS") &&
        bossRows.every(r => r.status === "PASS")
          ? "QA PASS"
          : "QA CHECK"
    };

    console.group("[EAP Word Quest] QA LOCK v1.6.3");
    console.log("Summary:",summary);
    console.table(sessionRows);
    console.table(bossRows);

    if(issueItems.length){
      console.warn("Validity / item issues:",issueItems.slice(0,120));
    }

    console.groupEnd();

    window.EAP_QA_REPORT = {
      summary,
      sessions:sessionRows,
      bossGates:bossRows,
      duplicateIds,
      issueItems
    };

    return window.EAP_QA_REPORT;
  }

  function inspectItemValidity(sessionId){
    const bank = (window.QUESTION_BANK || []).filter(q => !sessionId || q.session === sessionId);

    const rows = bank.map(item => ({
      id:item.id,
      session:item.session,
      word:item.word,
      type:item.type,
      level:item.level,
      targetMeaning:item.targetMeaning || "",
      targetTerm:item.targetTerm || item.word || "",
      answer:item.answer,
      promptIssue:promptIssue(item),
      choiceIssue:choiceIssue(item),
      status:itemIssue(item) ? "CHECK" : "PASS"
    }));

    const summary = {
      version:HOTFIX_VERSION,
      session:sessionId || "ALL",
      checked:rows.length,
      pass:rows.filter(r => r.status === "PASS").length,
      check:rows.filter(r => r.status !== "PASS").length,
      status:rows.every(r => r.status === "PASS") ? "ITEM VALIDITY PASS" : "ITEM VALIDITY CHECK"
    };

    console.group(`[EAP Word Quest] Item Validity Inspect v1.6.3: ${sessionId || "ALL"}`);
    console.log("Summary:",summary);
    console.table(rows.filter(r => r.status !== "PASS").slice(0,120));
    console.groupEnd();

    return { summary, rows };
  }

  function runItemValiditySuite(){
    const results = CONTENT_SESSIONS.map(sessionId => {
      const report = inspectItemValidity(sessionId);

      return {
        session:sessionId,
        checked:report.summary.checked,
        pass:report.summary.pass,
        check:report.summary.check,
        status:report.summary.status === "ITEM VALIDITY PASS" ? "PASS" : "CHECK",
        report
      };
    });

    const summary = {
      version:HOTFIX_VERSION,
      checkedAt:new Date().toISOString(),
      sessions:results.length,
      pass:results.filter(r => r.status === "PASS").length,
      check:results.filter(r => r.status !== "PASS").length,
      status:results.every(r => r.status === "PASS") ? "ITEM VALIDITY PASS" : "ITEM VALIDITY CHECK"
    };

    console.group("[EAP Word Quest] Item Validity Suite v1.6.3");
    console.log("Summary:",summary);
    console.table(results.map(r => ({
      session:r.session,
      checked:r.checked,
      pass:r.pass,
      check:r.check,
      status:r.status
    })));
    console.groupEnd();

    window.EAP_ITEM_VALIDITY_REPORT = { summary, results };

    return window.EAP_ITEM_VALIDITY_REPORT;
  }

  function inspectRoundQuality(sessionId,rounds){
    const target = sessionId || "S1";
    const n = Number(rounds || 10);
    const rows = [];

    for(let i = 1; i <= n; i++){
      const round = buildInspectionRound(target);
      const words = round.map(questionWordKey);
      const duplicatedWords = words.filter((w,idx) => words.indexOf(w) !== idx);

      const weakChoiceItems = round.filter(q => {
        const answer = normalizeText(q.answer).toLowerCase();
        return (q.choices || []).some(choice => choiceIsObviouslyWeak(choice,answer));
      });

      const lengthDominanceItems = round.filter(q => hasChoiceLengthDominance(q));
      const invalidItems = round.filter(q => itemIssue(q));

      rows.push({
        round:i,
        mission:target,
        questions:round.length,
        uniqueWords:new Set(words).size,
        duplicateWords:[...new Set(duplicatedWords)].join(", ") || "-",
        weakChoiceItems:weakChoiceItems.length,
        lengthDominanceItems:lengthDominanceItems.length,
        invalidItems:invalidItems.length,
        status:
          duplicatedWords.length === 0 &&
          weakChoiceItems.length === 0 &&
          lengthDominanceItems.length === 0 &&
          invalidItems.length === 0
            ? "PASS"
            : "CHECK"
      });
    }

    console.group(`[EAP Word Quest] Round Quality Inspect v1.6.3: ${target}`);
    console.table(rows);
    console.groupEnd();

    return rows;
  }

  function runRoundQualitySuite(){
    const targets = [
      "S1","S2","S3",
      "S4","S7","S10","S13",
      "BG1","BG2","BG3","BG4","BG5",
      "DAILY","SPEED","WEAK"
    ];

    const results = targets.map(target => {
      const rows = inspectRoundQuality(target,target === "BG5" ? 5 : 8);
      const pass = rows.every(r => r.status === "PASS");

      return {
        target,
        rounds:rows.length,
        status:pass ? "PASS" : "CHECK",
        checkedRows:rows
      };
    });

    const summary = {
      version:HOTFIX_VERSION,
      checkedAt:new Date().toISOString(),
      targets:results.length,
      pass:results.filter(r => r.status === "PASS").length,
      check:results.filter(r => r.status !== "PASS").length,
      status:results.every(r => r.status === "PASS") ? "ROUND QUALITY PASS" : "ROUND QUALITY CHECK"
    };

    console.group("[EAP Word Quest] Round Quality Suite v1.6.3");
    console.log("Summary:",summary);
    console.table(results.map(r => ({
      target:r.target,
      rounds:r.rounds,
      status:r.status
    })));
    console.groupEnd();

    window.EAP_ROUND_QUALITY_REPORT = { summary, results };

    return window.EAP_ROUND_QUALITY_REPORT;
  }

  function runFinalReleaseCheck(){
    const qaReport = runEapQaLock();
    const itemValidityReport = runItemValiditySuite();
    const roundQualityReport = runRoundQualitySuite();

    let smokeReport = null;
    let smokeStatus = "CHECK";

    try{
      if(typeof window.runCourseFlowSmokeTest === "function"){
        smokeReport = window.runCourseFlowSmokeTest();
        smokeStatus = smokeReport &&
          smokeReport.summary &&
          smokeReport.summary.status === "SMOKE PASS"
            ? "PASS"
            : "CHECK";
      }
    }catch(err){
      console.warn("[EAP Word Quest] Smoke test failed:",err);
    }

    const bossEvidence = BOSS_SESSIONS.map(g => `${g}:${getPoolBySession(g).length}`).join(" | ");

    const checklist = [
      {
        id:"QA_PASS",
        label:"Content QA must pass",
        status:qaReport.summary.finalStatus === "QA PASS" ? "PASS" : "CHECK",
        evidence:qaReport.summary.finalStatus
      },
      {
        id:"ITEM_VALIDITY_PASS",
        label:"Item validity must pass",
        status:itemValidityReport.summary.status === "ITEM VALIDITY PASS" ? "PASS" : "CHECK",
        evidence:itemValidityReport.summary.status
      },
      {
        id:"ROUND_QUALITY_PASS",
        label:"Round quality must pass",
        status:roundQualityReport.summary.status === "ROUND QUALITY PASS" ? "PASS" : "CHECK",
        evidence:roundQualityReport.summary.status
      },
      {
        id:"BOSS_GATES_READY",
        label:"Boss Gates ready",
        status:BOSS_SESSIONS.every(g => getPoolBySession(g).length >= BOSS_GATE_CONFIG[g].minPool) ? "PASS" : "CHECK",
        evidence:bossEvidence
      },
      {
        id:"TEST_HELPERS_READY",
        label:"Test helpers ready",
        status:
          typeof window.runEapQaLock === "function" &&
          typeof window.inspectItemValidity === "function" &&
          typeof window.runItemValiditySuite === "function" &&
          typeof window.runRoundQualitySuite === "function"
            ? "PASS"
            : "CHECK",
        evidence:"QA / item validity / round quality helpers"
      },
      {
        id:"SMOKE_PASS",
        label:"Course flow smoke test must pass",
        status:smokeStatus,
        evidence:smokeReport && smokeReport.summary ? smokeReport.summary.status : "Smoke report not available"
      }
    ];

    const finalStatus = checklist.every(row => row.status === "PASS")
      ? "FINAL READY"
      : "FINAL CHECK";

    const report = {
      version:HOTFIX_VERSION,
      checkedAt:new Date().toISOString(),
      finalStatus,
      qaStatus:qaReport.summary.finalStatus,
      itemValidityStatus:itemValidityReport.summary.status,
      roundQualityStatus:roundQualityReport.summary.status,
      smokeStatus:smokeReport && smokeReport.summary ? smokeReport.summary.status : "SMOKE CHECK",
      checklist,
      qaReport,
      itemValidityReport,
      roundQualityReport,
      smokeReport
    };

    window.EAP_FINAL_RELEASE_REPORT = report;

    console.group("[EAP Word Quest] FINAL RELEASE CHECK v1.6.3");
    console.log("Final Status:",report.finalStatus);
    console.log("QA Status:",report.qaStatus);
    console.log("Item Validity Status:",report.itemValidityStatus);
    console.log("Round Quality Status:",report.roundQualityStatus);
    console.log("Smoke Status:",report.smokeStatus);
    console.table(checklist);
    console.groupEnd();

    return report;
  }

  window.EAP_VALIDITY_RULES = Object.assign({},window.EAP_VALIDITY_RULES || {},{
    expectedItems:1800,
    expectedItemsPerSession:120,
    expectedBossPool:360,
    expectedFinalBossPool:1800,
    version:"v1.6.3"
  });

  window.EAP_DATA_SUMMARY = Object.assign({},window.EAP_DATA_SUMMARY || {},{
    version:HOTFIX_VERSION,
    totalItems:QUESTION_BANK.length,
    expectedItems:1800,
    qaTuned:true,
    finalStatus:QUESTION_BANK.length === 1800 ? "VALID DATA PASS" : "VALID DATA CHECK"
  });

  window.runEapQaLock = runEapQaLock;
  window.inspectItemValidity = inspectItemValidity;
  window.runItemValiditySuite = runItemValiditySuite;
  window.inspectRoundQuality = inspectRoundQuality;
  window.runRoundQualitySuite = runRoundQualitySuite;
  window.runFinalReleaseCheck = runFinalReleaseCheck;

  window.eapRelease = Object.assign({},window.eapRelease || {},{
    check:runFinalReleaseCheck,
    qa:runEapQaLock,
    itemValidity:runItemValiditySuite,
    inspectItem:inspectItemValidity,
    roundQuality:runRoundQualitySuite,
    inspect:inspectRoundQuality
  });

  window.eapTest = Object.assign({},window.eapTest || {},{
    qa:runEapQaLock,
    itemValidity:runItemValiditySuite,
    inspectItem:inspectItemValidity,
    roundQuality:runRoundQualitySuite,
    inspect:inspectRoundQuality
  });

  const versionPill = document.getElementById("versionPill");
  if(versionPill){
    versionPill.title = HOTFIX_VERSION;
  }

  console.info("[EAP Word Quest] v1.6.3 QA sentence leak tuned:",{
    version:HOTFIX_VERSION,
    items:QUESTION_BANK.length,
    helpers:[
      "runEapQaLock()",
      "inspectItemValidity('S3')",
      "runItemValiditySuite()",
      "inspectRoundQuality('S3',20)",
      "runRoundQualitySuite()",
      "runFinalReleaseCheck()"
    ]
  });
})();
