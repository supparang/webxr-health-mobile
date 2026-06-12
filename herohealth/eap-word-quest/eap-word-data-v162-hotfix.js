/* =========================================================
   EAP Word Quest • Data Hotfix
   File: /herohealth/eap-word-quest/eap-word-data-v162-hotfix.js
   Version: v1.6.2-ACADEMIC-SENTENCE-CLEAN

   Purpose:
   - Rebuild academic_sentence items only
   - Remove target leak from sentence distractors
   - Add missing academic_sentence items if previous bank has 1500
   - Keep final bank at 1800 items
========================================================= */

"use strict";

(function(){
  window.APP_VERSION = "v1.6.2-ACADEMIC-SENTENCE-CLEAN";

  const specs = window.EAP_VOCAB_SPECS || {};
  const oldBank = Array.isArray(window.QUESTION_BANK) ? window.QUESTION_BANK : [];

  function normalizeText(value){
    return String(value == null ? "" : value).replace(/\s+/g," ").trim();
  }

  function cleanIdPart(text){
    return String(text || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g,"-")
      .replace(/^-+|-+$/g,"")
      .slice(0,48) || "item";
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

  function allSpecsFlat(){
    return Object.entries(specs).flatMap(([sessionId,session]) =>
      (session.words || []).map(w => {
        const posLower = String(w.pos || "").toLowerCase();
        return Object.assign({},w,{
          session:sessionId,
          theme:session.theme || w.theme || sessionId,
          isVerb:/verb/.test(posLower),
          family:w.family || familyFromText(`${w.w} ${w.th} ${w.collocation}`)
        });
      })
    );
  }

  const ALL_SPECS = allSpecsFlat();

  function sentenceFor(spec){
    const term = normalizeText(spec.w);
    const theme = normalizeText(spec.theme || "Academic Task");

    if(spec.isVerb){
      return `In ${theme}, the writer uses “${term}” accurately in an academic sentence.`;
    }

    return `In ${theme}, the report uses “${term}” accurately in an academic sentence.`;
  }

  function hasBadText(value){
    const t = canonicalText(value);
    const bad = [
      "option ",
      "near alternative",
      "nice and useful",
      "good and students can learn",
      "banana",
      "chair",
      "weather",
      "sandwich",
      "shoe",
      "food menu",
      "travel plan"
    ];

    return bad.some(x => t.includes(x));
  }

  function isSafeDistractorSentence(sentence,targetSpec){
    const low = canonicalText(sentence);
    const target = canonicalText(targetSpec.w);
    const meaning = canonicalText(targetSpec.th);

    if(!low) return false;
    if(hasBadText(low)) return false;

    /*
      สำคัญ:
      - ห้าม distractor มี target term ของคำตอบ
      - เช่น target = project → ห้ามประโยคหลอกมี project scope/project timeline
      - target เป็น multi-word ก็ห้าม phrase นั้นตรง ๆ
    */
    if(target && low.includes(target)) return false;

    /*
      ป้องกันกรณีมี target meaning ไทยหลุดใน choice
    */
    if(meaning && low.includes(meaning)) return false;

    return true;
  }

  function uniqueChoices(list){
    const out = [];
    const seen = new Set();

    list.forEach(choice => {
      const clean = normalizeText(choice);
      const key = clean.toLowerCase();

      if(!clean || seen.has(key)) return;

      seen.add(key);
      out.push(clean);
    });

    return out;
  }

  function buildSentenceChoices(spec){
    const answer = sentenceFor(spec);

    const candidateSentences = ALL_SPECS
      .filter(x => x.w !== spec.w)
      .filter(x => x.family !== spec.family)
      .map(sentenceFor)
      .filter(sentence => sentence !== answer)
      .filter(sentence => isSafeDistractorSentence(sentence,spec));

    const genericSafe = [
      "In Academic Writing, the report uses “evaluation result” accurately in an academic sentence.",
      "In Technical Communication, the report uses “system output” accurately in an academic sentence.",
      "In Meeting Summary, the report uses “action item” accurately in an academic sentence.",
      "In Project Presentation, the report uses “supporting evidence” accurately in an academic sentence.",
      "In Professional Email, the report uses “attachment note” accurately in an academic sentence.",
      "In AI Report, the report uses “model accuracy” accurately in an academic sentence.",
      "In Career Pitch, the report uses “professional summary” accurately in an academic sentence.",
      "In User Guide, the report uses “input validation” accurately in an academic sentence.",
      "In Team Progress, the report uses “status report” accurately in an academic sentence.",
      "In Final Reflection, the report uses “improvement plan” accurately in an academic sentence."
    ].filter(sentence => isSafeDistractorSentence(sentence,spec));

    const choices = uniqueChoices([answer].concat(candidateSentences,genericSafe));

    return choices.slice(0,4);
  }

  function makeAcademicSentenceItem(spec){
    const choices = buildSentenceChoices(spec);
    const answer = sentenceFor(spec);

    return {
      id:`${spec.session}-${cleanIdPart(spec.w)}-academic_sentence-${String(spec.order).padStart(3,"0")}`,
      session:spec.session,
      word:spec.w,
      type:"academic_sentence",
      level:"B1+",
      prompt:`Choose the academic sentence that expresses “${spec.th}” in ${spec.theme}.`,
      answer,
      choices,
      explanation:`This sentence uses “${spec.w}” to express “${spec.th}” in ${spec.theme}.`,
      targetMeaning:spec.th,
      targetTerm:spec.w,
      semanticFamily:spec.family
    };
  }

  function isValidAcademicSentenceItem(item){
    const choices = Array.isArray(item.choices) ? item.choices.map(normalizeText) : [];
    const answer = normalizeText(item.answer);
    const unique = new Set(choices.map(x => x.toLowerCase()));

    if(!item.id || !item.session || !item.word) return false;
    if(item.type !== "academic_sentence") return false;
    if(item.level !== "B1+") return false;
    if(!item.prompt || !item.prompt.includes(item.targetMeaning)) return false;
    if(!answer) return false;
    if(choices.length !== 4) return false;
    if(unique.size !== 4) return false;
    if(!choices.includes(answer)) return false;

    return choices
      .filter(choice => choice !== answer)
      .every(choice => isSafeDistractorSentence(choice,item));
  }

  const nonAcademic = oldBank.filter(item => item && item.type !== "academic_sentence");
  const academicSentenceItems = ALL_SPECS.map(makeAcademicSentenceItem);

  const invalidAcademic = academicSentenceItems.filter(item => !isValidAcademicSentenceItem(item));

  if(invalidAcademic.length){
    console.warn("[EAP Word Quest] v1.6.2 academic_sentence hotfix still has invalid items:",invalidAcademic.slice(0,80));
  }

  window.QUESTION_BANK = nonAcademic.concat(academicSentenceItems);

  const sessionCounts = {};
  window.QUESTION_BANK.forEach(item => {
    sessionCounts[item.session] = (sessionCounts[item.session] || 0) + 1;
  });

  window.EAP_VALIDITY_RULES = Object.assign({},window.EAP_VALIDITY_RULES || {},{
    expectedItems:1800,
    expectedItemsPerSession:120,
    expectedBossPool:360,
    expectedFinalBossPool:1800,
    version:"v1.6.2"
  });

  window.EAP_DATA_SUMMARY = {
    version:window.APP_VERSION,
    totalWords:ALL_SPECS.length,
    totalItems:window.QUESTION_BANK.length,
    expectedItems:1800,
    expectedItemsPerSession:120,
    academicSentenceItems:academicSentenceItems.length,
    invalidAcademicSentenceItems:invalidAcademic.length,
    sessionCounts,
    finalStatus:
      ALL_SPECS.length === 300 &&
      window.QUESTION_BANK.length === 1800 &&
      invalidAcademic.length === 0
        ? "VALID DATA PASS"
        : "VALID DATA CHECK"
  };

  console.info("[EAP Word Quest] v1.6.2 academic_sentence hotfix applied:",window.EAP_DATA_SUMMARY);
})();
