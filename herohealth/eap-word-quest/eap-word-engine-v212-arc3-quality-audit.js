/* =========================================================
   EAP Word Quest • Arc 3 Quality Audit
   File: /herohealth/eap-word-quest/eap-word-engine-v212-arc3-quality-audit.js
   Version: v2.1.2-ARC3-QUALITY-AUDIT-122

   Scope: S7 Tone Switchboard, S8 Paragraph Repair Lab,
          S9 Campus Solution Pitch

   Student-learning safeguards:
   - Replaces generic rich items with short academic situations.
   - Uses plausible but functionally distinct distractors.
   - Adds Thai explanation after an answer; never before an answer.
   - Keeps target counts and item totals unchanged.
   - Validates 4 choices, exactly one correct answer, duplicate choices,
     and accidental answer-leak text.
   - Does not change gates, scores, timers, logs or AI policy.
========================================================= */
(() => {
  "use strict";

  const VERSION = "v2.1.2-ARC3-QUALITY-AUDIT-122";
  const SESSIONS = ["S7", "S8", "S9"];

  if (window.__EAP_WORD_V212_ARC3_AUDIT__) return;
  window.__EAP_WORD_V212_ARC3_AUDIT__ = true;

  if (!window.EAP_CORE_QUESTION_BANK || typeof window.getEapCoreSessionTargets !== "function") {
    console.warn("[EAP Word Quest] v212 needs the Core question bank before it.");
    return;
  }

  const BANK = window.EAP_CORE_QUESTION_BANK;
  const norm = (value) => String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  const key = (value) => norm(value).toLowerCase().replace(/[’']/g, "").replace(/…/g, "");
  const clone = (value) => JSON.parse(JSON.stringify(value));

  const REPAIR_CASES = {
    S7: {
      formal: {
        question: "Which target best describes the language needed in this email?",
        context: "A student writes to a lecturer to ask for a meeting about missed work. The message should be respectful and suitable for university communication.",
        thai: "formal คือภาษาที่เหมาะกับการสื่อสารเชิงวิชาการหรือทางการ"
      },
      informal: {
        question: "Which target describes this message style?",
        context: "“Hey, send me the file now!” is written to a close friend, not to a lecturer or an academic office.",
        thai: "informal คือภาษากันเอง ใช้ได้กับคนใกล้ชิดแต่ไม่เหมาะกับบริบททางการ"
      },
      polite: {
        question: "Which target improves the tone of this request?",
        context: "A student needs to ask a librarian for help finding a journal article without sounding demanding.",
        thai: "polite คือสุภาพ เคารพผู้อ่าน และไม่ออกคำสั่งตรงเกินไป"
      },
      rude: {
        question: "Which target identifies the problem in this message?",
        context: "“You must reply today. I need the answer.” is sent to a lecturer with no greeting or respectful request.",
        thai: "rude คือการใช้ภาษาที่ห้วนหรือไม่สุภาพต่อผู้อ่าน"
      },
      "academic tone": {
        question: "Which target should guide this revision?",
        context: "A report says, “This app is super awesome.” The writer needs more neutral wording suitable for an academic report.",
        thai: "academic tone คือโทนภาษาที่ชัด สุภาพ และเป็นกลางสำหรับงานเรียน"
      },
      audience: {
        question: "Which target helps the writer choose the right words?",
        context: "The same project update will be read by first-year students, lecturers, and community partners. The writer must consider who will read it.",
        thai: "audience คือกลุ่มผู้อ่านหรือผู้ฟังที่มีผลต่อการเลือกภาษา"
      },
      stance: {
        question: "Which target describes the writer's position toward an idea?",
        context: "In a discussion post, a student agrees with part of a proposal but explains one limitation.",
        thai: "stance คือจุดยืนหรือท่าทีของผู้เขียนต่อประเด็น"
      },
      request: {
        question: "Which target describes the purpose of this sentence?",
        context: "“Could you please confirm the room for tomorrow's presentation?”",
        thai: "request คือการขอความช่วยเหลือหรือข้อมูลอย่างชัดเจน"
      },
      hedging: {
        question: "Which target makes this statement more careful?",
        context: "Instead of saying “The method proves the result,” the writer says “The method may support the result.”",
        thai: "hedging คือการลดความฟันธงเมื่อหลักฐานยังไม่เด็ดขาด"
      },
      register: {
        question: "Which target describes choosing language for the situation?",
        context: "A student writes differently in a group chat, an email to a lecturer, and a formal report.",
        thai: "register คือระดับภาษาให้เหมาะกับสถานการณ์และผู้รับสาร"
      }
    },
    S8: {
      paragraph: {
        question: "Which target describes this group of related sentences?",
        context: "Five sentences all explain how planning helps students meet deadlines. Together they form one organized unit of writing.",
        thai: "paragraph คือกลุ่มประโยคที่พัฒนาแนวคิดเดียวกัน"
      },
      "topic sentence": {
        question: "Which target should introduce this paragraph?",
        context: "The following sentences explain that shared calendars help team members see deadlines, divide tasks, and avoid missed meetings.",
        thai: "topic sentence บอกแนวคิดหลักของย่อหน้าและนำผู้อ่านเข้าสู่รายละเอียด"
      },
      "supporting detail": {
        question: "Which target fits this sentence?",
        context: "“For example, the team used a shared calendar to assign one task to each member.” This sentence explains or proves the main idea.",
        thai: "supporting detail คือรายละเอียดที่ช่วยอธิบายหรือสนับสนุน topic sentence"
      },
      support: {
        question: "Which target describes what the example does?",
        context: "After claiming that peer feedback improves drafts, the writer gives a specific example from a class workshop.",
        thai: "support คือการช่วยยืนยันหรืออธิบายแนวคิดหลัก"
      },
      example: {
        question: "Which target makes this idea clearer?",
        context: "The writer says that students use many study tools and then names a timetable app and a shared document.",
        thai: "example คือกรณีเฉพาะที่ช่วยให้แนวคิดชัดขึ้น"
      },
      "closing sentence": {
        question: "Which target should end this paragraph?",
        context: "The paragraph has explained a problem, given evidence, and discussed a solution. The final sentence should bring the point to a clear close.",
        thai: "closing sentence ช่วยปิดย่อหน้าและย้ำใจความสำคัญ"
      },
      link: {
        question: "Which target connects this sentence to the idea before it?",
        context: "The writer uses “Therefore” to show that the next sentence follows logically from the evidence.",
        thai: "link คือคำหรือวลีที่เชื่อมความคิดของประโยคและย่อหน้า"
      },
      "irrelevant sentence": {
        question: "Which target identifies the sentence that should be removed?",
        context: "A paragraph about time management includes the sentence, “My favourite singer released a new album yesterday.”",
        thai: "irrelevant sentence คือประโยคที่ไม่สนับสนุนหัวข้อของย่อหน้า"
      },
      cohesion: {
        question: "Which target describes why this paragraph flows well?",
        context: "The writer repeats key terms carefully and uses pronouns and linking words so each sentence connects naturally to the next.",
        thai: "cohesion คือความเชื่อมโยงที่ทำให้ข้อความลื่นไหล"
      },
      transition: {
        question: "Which target signals a move to the next idea?",
        context: "The writer uses “In addition” before introducing another benefit of the proposed solution.",
        thai: "transition คือคำเชื่อมที่พาผู้อ่านจากความคิดหนึ่งไปอีกความคิดหนึ่ง"
      }
    },
    S9: {
      problem: {
        question: "Which target names the issue the team must solve?",
        context: "Many students cannot find a quiet place to work between classes, so they often leave campus without completing group tasks.",
        thai: "problem คือประเด็นหรืออุปสรรคที่ต้องการแก้ไข"
      },
      reason: {
        question: "Which target explains why this problem happens?",
        context: "The team finds that the study room is often full because students cannot reserve a time slot in advance.",
        thai: "reason คือเหตุผลที่อธิบายว่าทำไมปัญหาจึงเกิดขึ้น"
      },
      evidence: {
        question: "Which target would make this pitch stronger?",
        context: "The team says that students need more charging stations. It includes results from a survey of 180 students.",
        thai: "evidence คือข้อมูลที่ใช้สนับสนุนข้อเสนอ"
      },
      example: {
        question: "Which target helps listeners understand the problem?",
        context: "The presenter explains that a student missed an online submission because there was no charging point in the library.",
        thai: "example คือกรณีที่ช่วยให้ปัญหาหรือแนวคิดเห็นภาพชัดขึ้น"
      },
      solution: {
        question: "Which target answers the problem directly?",
        context: "The team proposes installing bookable charging desks near the library entrance.",
        thai: "solution คือแนวทางแก้ปัญหาที่เสนอให้ทำได้จริง"
      },
      recommendation: {
        question: "Which target fits the final action statement?",
        context: "After presenting the problem, data, and a solution, the group tells the faculty what it should do next.",
        thai: "recommendation คือข้อเสนอแนะว่าควรดำเนินการอย่างไร"
      },
      benefit: {
        question: "Which target explains a positive result of the proposal?",
        context: "With more charging desks, students can complete group work on campus instead of leaving early.",
        thai: "benefit คือผลดีที่คาดว่าจะเกิดจากแนวทางแก้ปัญหา"
      },
      impact: {
        question: "Which target describes the wider change caused by the proposal?",
        context: "The new booking system may reduce conflicts over study spaces across the whole faculty.",
        thai: "impact คือผลกระทบหรือการเปลี่ยนแปลงที่เกิดขึ้นในวงกว้าง"
      },
      pitch: {
        question: "Which target describes this short persuasive presentation?",
        context: "In two minutes, the group introduces a campus problem, presents evidence, and asks the faculty to support one practical solution.",
        thai: "pitch คือการนำเสนอเพื่อโน้มน้าวให้ผู้ฟังเห็นด้วยกับข้อเสนอ"
      },
      feasible: {
        question: "Which target asks whether this idea can really be done?",
        context: "The group checks the budget, available rooms, staff time, and equipment before presenting its plan.",
        thai: "feasible คือทำได้จริงภายใต้เวลา งบประมาณ และทรัพยากรที่มี"
      },
      priority: {
        question: "Which target helps the team choose what to solve first?",
        context: "The group compares three campus problems and selects the one that affects the most students and needs action soon.",
        thai: "priority คือสิ่งที่ควรได้รับการจัดการก่อน"
      }
    }
  };

  const CURATED = {
    S7: [
      {
        target:"formal", level:"B1",
        question:"Choose the word that best describes the style needed here.",
        context:"You are emailing a lecturer to ask about a missed assessment. The message should be respectful and suitable for university communication.",
        options:["formal","informal","rude","irrelevant"],
        thai:"อีเมลถึงอาจารย์ควรใช้ formal language ไม่ใช่ภาษากันเองหรือห้วน"
      },
      {
        target:"polite", level:"B1",
        question:"Choose the word that best improves this request.",
        context:"“Could you please let me know whether the consultation is still available?”",
        options:["polite","rude","informal","bias"],
        thai:"Could you please… เป็นรูปแบบขอข้อมูลอย่าง polite"
      },
      {
        target:"audience", level:"B1+",
        question:"Choose the word that explains why the writer changes the message.",
        context:"A project update is rewritten because it will be read by school students instead of lecturers.",
        options:["audience","source","evidence","sequence"],
        thai:"ผู้รับสารเปลี่ยนไป จึงต้องคำนึงถึง audience และปรับภาษาให้เหมาะ"
      },
      {
        target:"request", level:"B1+",
        question:"Choose the term that describes the main purpose of this sentence.",
        context:"“Would it be possible to extend the deadline by one day?”",
        options:["request","stance","summary","verdict"],
        thai:"ประโยคนี้เป็น request เพราะผู้เขียนกำลังขอสิ่งหนึ่งอย่างสุภาพ"
      }
    ],
    S8: [
      {
        target:"topic sentence", level:"B1",
        question:"Choose the part that should come first in this paragraph.",
        context:"The next sentences explain how a shared calendar helps students see deadlines, divide tasks, and reduce missed meetings.",
        options:["topic sentence","closing sentence","supporting detail","irrelevant sentence"],
        thai:"topic sentence ควรเปิดย่อหน้าและบอกแนวคิดหลักก่อนรายละเอียด"
      },
      {
        target:"supporting detail", level:"B1",
        question:"Choose the label for this sentence.",
        context:"“For example, one group used a shared calendar to assign a deadline to each member.” The sentence gives information that explains the main idea.",
        options:["supporting detail","topic sentence","closing sentence","transition"],
        thai:"ประโยคนี้เป็น supporting detail เพราะช่วยอธิบายและสนับสนุนใจความหลัก"
      },
      {
        target:"link", level:"B1+",
        question:"Choose the word that describes the role of “Therefore”.",
        context:"The writer uses “Therefore” before a conclusion that follows from the evidence in the previous sentence.",
        options:["link","example","paragraph","stance"],
        thai:"Therefore ทำหน้าที่เป็น link เชื่อมหลักฐานไปสู่ข้อสรุป"
      },
      {
        target:"irrelevant sentence", level:"B1+",
        question:"Choose the best label for this sentence in a paragraph about study planning.",
        context:"“My favourite singer released a new album yesterday.”",
        options:["irrelevant sentence","supporting detail","topic sentence","closing sentence"],
        thai:"ประโยคนี้ไม่เกี่ยวกับการวางแผนการเรียน จึงเป็น irrelevant sentence"
      }
    ],
    S9: [
      {
        target:"problem", level:"B1",
        question:"Choose the term that names the issue in this pitch.",
        context:"Many students cannot find a quiet place to work between classes, so group tasks are often unfinished.",
        options:["problem","solution","benefit","recommendation"],
        thai:"ข้อความนี้บอกอุปสรรคที่ต้องแก้ จึงเป็น problem"
      },
      {
        target:"evidence", level:"B1",
        question:"Choose what would make this claim more convincing.",
        context:"The team says that students need more charging stations and includes survey results from 180 students.",
        options:["evidence","opinion","priority","pitch"],
        thai:"ผลสำรวจเป็น evidence ที่ช่วยสนับสนุนข้อเสนอของทีม"
      },
      {
        target:"solution", level:"B1+",
        question:"Choose the term for the team's proposed action.",
        context:"The group suggests installing bookable charging desks near the library entrance.",
        options:["solution","problem","impact","reason"],
        thai:"การติดตั้งโต๊ะชาร์จที่จองได้คือแนวทางแก้ จึงเป็น solution"
      },
      {
        target:"recommendation", level:"B1+",
        question:"Choose the term for this final statement.",
        context:"“We recommend that the faculty pilot the booking system for one semester.”",
        options:["recommendation","evidence","example","benefit"],
        thai:"We recommend… คือการเสนอให้ผู้มีอำนาจตัดสินใจทำสิ่งต่อไป"
      }
    ]
  };

  function targetsFor(sessionId) {
    return window.getEapCoreSessionTargets(sessionId, { unique:true }) || [];
  }

  function findTarget(sessionId, term) {
    const needle = key(term);
    return targetsFor(sessionId).find((target) => key(target.term) === needle) || null;
  }

  function makeChoice(sessionId, term, correct) {
    const target = findTarget(sessionId, term);
    return { text:term, correct:Boolean(correct), targetId:target ? target.id : "" };
  }

  function createCuratedItem(sessionId, row, index) {
    const target = findTarget(sessionId, row.target);
    if (!target) return null;

    const terms = [];
    const seen = new Set();
    [row.target, ...(row.options || [])].forEach((term) => {
      const id = key(term);
      if (!id || seen.has(id)) return;
      seen.add(id);
      terms.push(term);
    });
    const choices = terms.slice(0,4).map((term) => makeChoice(sessionId, term, key(term) === key(row.target)));
    if (choices.length !== 4 || choices.filter((choice) => choice.correct).length !== 1) return null;

    return {
      id:`${sessionId}_AUDIT_RICH_${String(index + 1).padStart(2,"0")}`,
      sessionId,
      sourceSessionId:sessionId,
      type:"application",
      itemType:"application",
      level:row.level || "B1",
      target:target.term,
      targetId:target.id,
      targetBand:target.band,
      targets:[target.term],
      question:row.question,
      context:row.context,
      choices,
      answerTerm:target.term,
      feedback:`Correct. “${target.term}” is the best answer. ไทย: ${row.thai}`,
      quality:"arc3_audited_application",
      skillTag:"Arc 3 • Quality-audited application",
      stemGroup:row.question,
      coreAligned:true,
      auditVersion:VERSION
    };
  }

  function enrichRepairItem(item, sessionId) {
    const scenario = REPAIR_CASES[sessionId] && REPAIR_CASES[sessionId][key(item.target)];
    if (!scenario || item.type !== "repair") return item;
    return Object.assign({}, item, {
      question:scenario.question,
      context:scenario.context,
      feedback:`Correct. “${item.target}” fits this academic situation. ไทย: ${scenario.thai}`,
      quality:"arc3_audited_repair",
      stemGroup:scenario.question,
      auditVersion:VERSION
    });
  }

  function validateItem(item) {
    const issues = [];
    const choices = Array.isArray(item.choices) ? item.choices : [];
    const correct = choices.filter((choice) => choice && choice.correct);
    if (choices.length !== 4) issues.push("choices_not_four");
    if (correct.length !== 1) issues.push("correct_count_not_one");

    const seen = new Set();
    choices.forEach((choice) => {
      const value = key(choice && choice.text);
      if (!value || seen.has(value)) issues.push("duplicate_or_blank_choice");
      seen.add(value);
    });

    const stem = `${norm(item.question)} ${norm(item.context)}`.toLowerCase();
    const answer = key(item.answerTerm || item.target);
    if (answer && stem.includes(`answer: ${answer}`)) issues.push("answer_leak");
    return issues;
  }

  function applyAudit() {
    const audit = { version:VERSION, sessions:{}, issues:[], appliedAt:new Date().toISOString() };

    SESSIONS.forEach((sessionId) => {
      const original = Array.isArray(BANK.bySession[sessionId]) ? BANK.bySession[sessionId] : [];
      const preserved = original
        .filter((item) => !/_RICH_\d+$/i.test(norm(item.id)))
        .map((item) => enrichRepairItem(item, sessionId));
      const curated = (CURATED[sessionId] || [])
        .map((row, index) => createCuratedItem(sessionId, row, index))
        .filter(Boolean);
      const next = [...preserved, ...curated];
      const issues = next.flatMap((item) => validateItem(item).map((issue) => `${item.id}:${issue}`));

      BANK.bySession[sessionId] = next;
      audit.sessions[sessionId] = {
        before:original.length,
        after:next.length,
        curated:curated.length,
        auditedRepairItems:next.filter((item) => item.quality === "arc3_audited_repair").length,
        issues
      };
      audit.issues.push(...issues);
    });

    BANK.items = Object.values(BANK.bySession).flat();
    BANK.itemTotal = BANK.items.length;
    BANK.summary = Object.fromEntries(Object.entries(BANK.bySession).map(([id, rows]) => [id, rows.length]));
    BANK.audit = Object.assign({}, BANK.audit || {}, { arc3:audit });
    window.EAP_ARC3_QUALITY_AUDIT = audit;
    return audit;
  }

  const report = applyAudit();
  window.inspectEapArc3QualityAudit = () => clone(window.EAP_ARC3_QUALITY_AUDIT || report);

  console.info("[EAP Word Quest] Arc 3 quality audit ready", report);
})();
