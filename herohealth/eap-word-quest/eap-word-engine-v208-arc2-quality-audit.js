/* =========================================================
   EAP Word Quest • Arc 2 Quality Audit
   File: /herohealth/eap-word-quest/eap-word-engine-v208-arc2-quality-audit.js
   Version: v2.0.8-ARC2-QUALITY-AUDIT-122

   Scope: S4 Signal Relay, S5 Evidence Court, S6 Summary Press Room

   What this patch does:
   - Replaces the four generic rich-application items in each Arc 2 Session
     with short, classroom-realistic scenarios.
   - Improves every generated repair item's context and feedback.
   - Keeps the agreed target counts and total item variants unchanged.
   - Adds validation for duplicate choices, missing correct options, and
     accidental answer leakage.
   - Does not change gating, score, AI policy, logs, or stored progress.
========================================================= */
(() => {
  "use strict";

  const VERSION = "v2.0.8-ARC2-QUALITY-AUDIT-122";
  const SESSIONS = ["S4", "S5", "S6"];

  if (window.__EAP_WORD_V208_ARC2_AUDIT__) return;
  window.__EAP_WORD_V208_ARC2_AUDIT__ = true;

  if (!window.EAP_CORE_QUESTION_BANK || typeof window.getEapCoreSessionTargets !== "function") {
    console.warn("[EAP Word Quest] v208 needs the Core question bank before it.");
    return;
  }

  const BANK = window.EAP_CORE_QUESTION_BANK;
  const norm = (value) => String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  const key = (value) => norm(value).toLowerCase().replace(/[’']/g, "").replace(/…/g, "");
  const clone = (value) => JSON.parse(JSON.stringify(value));

  const REPAIR_CASES = {
    S4: {
      keyword: {
        question: "Which target would improve this search plan?",
        context: "A student searches an online library with the whole sentence “I need sources for a campus recycling project.” The search will work better with one focused term.",
        thai: "ใช้ keyword สั้นและตรงหัวข้อ เพื่อค้นหาข้อมูลได้เร็วขึ้น"
      },
      cause: {
        question: "Which target names why this event happened?",
        context: "The group missed the rehearsal because two members received the schedule late.",
        thai: "cause คือเหตุที่ทำให้เหตุการณ์เกิดขึ้น"
      },
      contrast: {
        question: "Which target repairs the relationship between these two ideas?",
        context: "The new app is easy to use. It has very few privacy settings. The ideas are different in an important way.",
        thai: "contrast ใช้เมื่อสองแนวคิดต่างหรือขัดกันอย่างชัดเจน"
      },
      result: {
        question: "Which target explains what happened after the problem?",
        context: "The server was unavailable for two hours. As a result, students submitted their work late.",
        thai: "result คือสิ่งที่เกิดตามมาหลังเหตุการณ์หรือปัญหา"
      },
      example: {
        question: "Which target helps the writer make this idea clearer?",
        context: "The report says that students can use several digital tools, such as shared documents and online calendars.",
        thai: "example ยกกรณีเฉพาะเพื่อทำให้แนวคิดชัดขึ้น"
      },
      sequence: {
        question: "Which target describes the order in this instruction?",
        context: "First choose a topic, then collect sources, and finally submit the outline.",
        thai: "sequence แสดงลำดับขั้นตอน"
      },
      "consequently": {
        question: "Which target gives a formal link from cause to result?",
        context: "The workshop room was changed at short notice. Consequently, several students arrived late.",
        thai: "consequently เชื่อมเหตุไปสู่ผลอย่างเป็นทางการ"
      },
      "in contrast": {
        question: "Which target introduces a clear difference?",
        context: "The first survey had a high response rate. In contrast, the second survey had very few replies.",
        thai: "in contrast ใช้เปรียบความแตกต่างจากข้อความก่อนหน้า"
      }
    },
    S5: {
      claim: {
        question: "Which target describes the statement that needs checking?",
        context: "A website says, “Group study always gives better grades,” but it gives no data or source.",
        thai: "claim คือข้อกล่าวที่ยังต้องมีหลักฐานรองรับ"
      },
      fact: {
        question: "Which target fits information that can be checked?",
        context: "The university library closes at 20:00 on weekdays. The time can be checked on the official website.",
        thai: "fact ตรวจสอบได้ว่าเป็นจริงหรือเท็จ"
      },
      opinion: {
        question: "Which target describes this personal judgment?",
        context: "“Online classes are more enjoyable than face-to-face classes” reflects one student's view.",
        thai: "opinion คือความเห็นส่วนบุคคล ไม่ใช่หลักฐาน"
      },
      evidence: {
        question: "Which target would strengthen this argument?",
        context: "A team says that late submissions are increasing. It needs attendance records or submission data to support the statement.",
        thai: "evidence คือข้อมูลที่ใช้สนับสนุนหรือทดสอบ claim"
      },
      source: {
        question: "Which target identifies where this information came from?",
        context: "A student quotes numbers from a faculty survey report and needs to tell readers where the numbers were found.",
        thai: "source คือแหล่งที่มาของข้อมูล"
      },
      reliable: {
        question: "Which target describes information that can be trusted because it is accurate and supported?",
        context: "A report explains its method, gives dates, and provides links to its data.",
        thai: "reliable เน้นความถูกต้องและความน่าเชื่อถือของข้อมูล"
      },
      credible: {
        question: "Which target best describes this academic source?",
        context: "The article has a named author, a university publisher, references, and evidence for its conclusions.",
        thai: "credible คือแหล่งข้อมูลที่น่าเชื่อถือและมีหลักฐานรองรับ"
      },
      bias: {
        question: "Which target names the problem in this post?",
        context: "The post only lists benefits of the product and ignores every limitation or opposing view.",
        thai: "bias คือความเอนเอียงที่ทำให้มุมมองไม่สมดุล"
      },
      verdict: {
        question: "Which target belongs at the end of this evidence check?",
        context: "After reading two sources, checking their authors, and comparing their data, the team makes a final decision.",
        thai: "verdict คือข้อสรุปหลังตรวจสอบข้อมูล"
      },
      assumption: {
        question: "Which target describes an idea accepted without enough proof?",
        context: "A group assumes that every student owns a laptop, but it has not asked anyone or checked data.",
        thai: "assumption คือสิ่งที่คิดว่าเป็นจริงโดยยังไม่มีหลักฐานพอ"
      },
      counterclaim: {
        question: "Which target adds a fair opposing view?",
        context: "One student argues for online quizzes. Another explains that some learners have unstable internet access.",
        thai: "counterclaim คือข้อโต้แย้งที่ตอบกลับ claim เดิม"
      }
    },
    S6: {
      summary: {
        question: "Which target describes this short restatement?",
        context: "A student reads a page about study planning and writes two sentences that keep only the central message.",
        thai: "summary เก็บใจความหลักให้สั้นและชัด"
      },
      "main point": {
        question: "Which target should appear first in a good summary?",
        context: "The article explains that early planning helps teams share work and meet deadlines. The summary should keep this central message.",
        thai: "main point คือใจความสำคัญที่สุดที่ไม่ควรหายไป"
      },
      "key detail": {
        question: "Which target names a small but important supporting detail?",
        context: "A summary mentions the main point and also notes that the survey included 250 students.",
        thai: "key detail คือรายละเอียดสำคัญที่ช่วยสนับสนุนใจความหลัก"
      },
      "own words": {
        question: "Which target shows that the writer has not copied the source?",
        context: "The student changes the wording and sentence structure but keeps the original meaning.",
        thai: "own words คือเขียนความหมายเดิมด้วยภาษาของตนเอง"
      },
      paraphrase: {
        question: "Which target is the best action here?",
        context: "The source says, “Students must plan their work early.” The writer needs to express the same idea in different language and structure.",
        thai: "paraphrase คือเปลี่ยนคำและโครงสร้าง แต่คงความหมายเดิม"
      },
      "copy-paste": {
        question: "Which target identifies this problem?",
        context: "A student puts a full sentence from a website into a summary without changing any words.",
        thai: "copy-paste คือคัดลอกคำเดิมตรง ๆ ซึ่งไม่ใช่การสรุปด้วยภาษาตนเอง"
      },
      concise: {
        question: "Which target describes this stronger summary?",
        context: "The revised summary removes repeated examples but keeps the main point and one useful detail.",
        thai: "concise คือสั้น แต่ยังชัดและครบใจความสำคัญ"
      },
      synthesize: {
        question: "Which target describes this advanced summary task?",
        context: "A writer compares two articles and combines their main ideas into one short paragraph.",
        thai: "synthesize คือเชื่อมและรวมแนวคิดสำคัญจากมากกว่าหนึ่งแหล่ง"
      },
      objective: {
        question: "Which target improves this academic summary?",
        context: "The sentence “This is the best idea ever” should be replaced by a statement based on evidence rather than personal feeling.",
        thai: "objective คือยึดหลักฐาน ไม่ใช่ความรู้สึกส่วนตัว"
      }
    }
  };

  const CURATED = {
    S4: [
      {
        target:"therefore / as a result", level:"B1",
        question:"Choose the signal phrase that completes the message.",
        context:"Attendance was low at the first workshop. ___, the lecturer repeated it on Friday.",
        options:["because / since","however / although","therefore / as a result","for example / such as"],
        thai:"ดูความสัมพันธ์: การเข้าเรียนน้อยเป็นเหตุ และการจัดซ้ำคือผลที่ตามมา"
      },
      {
        target:"however / although", level:"B1",
        question:"Choose the signal phrase that shows a contrast.",
        context:"The new learning app is easy to use. ___, it does not protect user data well.",
        options:["because / since","however / although","therefore / as a result","first / then / finally"],
        thai:"สองประโยคมีข้อดีและข้อจำกัดที่ต่างกัน จึงต้องใช้ contrast"
      },
      {
        target:"for example / such as", level:"B1+",
        question:"Choose the phrase that introduces examples.",
        context:"The team can use online collaboration tools, ___ shared documents and project boards.",
        options:["for example / such as","therefore / as a result","however / although","because / since"],
        thai:"คำตอบต้องนำเข้าสู่ตัวอย่างของ collaboration tools"
      },
      {
        target:"first / then / finally", level:"B1+",
        question:"Choose the phrase group that makes the process clear.",
        context:"___ choose a topic; ___ collect evidence; ___ upload the final file.",
        options:["first / then / finally","because / since","however / although","for example / such as"],
        thai:"โจทย์ต้องการลำดับขั้นตอน ไม่ใช่เหตุ ผล หรือความต่าง"
      }
    ],
    S5: [
      {
        target:"claim", level:"B1",
        question:"Before any proof is given, what is this statement?",
        context:"“Online learning always improves achievement.”",
        options:["claim","fact","opinion","evidence"],
        thai:"ข้อความนี้ต้องมีหลักฐานก่อนจึงเชื่อถือได้ จึงเป็น claim"
      },
      {
        target:"evidence", level:"B1",
        question:"What would best support the team's statement?",
        context:"The team says that late submissions increased this month. It needs records from the submission system.",
        options:["evidence","bias","opinion","counterclaim"],
        thai:"ข้อมูลจากระบบส่งงานใช้ตรวจสอบหรือสนับสนุน claim ได้"
      },
      {
        target:"credible", level:"B1+",
        question:"Which term best describes this source?",
        context:"The article names its author, is published by a university, explains its method, and gives references.",
        options:["credible","bias","assumption","verdict"],
        thai:"แหล่งข้อมูลที่มีผู้เขียน แหล่งเผยแพร่ วิธีการ และอ้างอิง ช่วยให้ credible"
      },
      {
        target:"bias", level:"B1+",
        question:"What risk appears in this post?",
        context:"The post lists only benefits of a product and ignores all limitations and opposing views.",
        options:["bias","fact","evidence","source"],
        thai:"เมื่อเลือกเสนอเพียงด้านเดียวโดยไม่พูดถึงข้อจำกัด อาจมี bias"
      }
    ],
    S6: [
      {
        target:"summary", level:"B1",
        question:"Which task best describes a summary?",
        context:"Keep the central message of a long text in a short form, using new language and leaving out repeated examples.",
        options:["summary","copy-paste","opinion","source"],
        thai:"summary ต้องสั้น ชัด และเก็บใจความหลัก"
      },
      {
        target:"paraphrase", level:"B1",
        question:"Which action avoids copying the source word-for-word?",
        context:"Express the same meaning with different words and sentence structure.",
        options:["paraphrase","copy-paste","key detail","source"],
        thai:"paraphrase เปลี่ยนคำและโครงสร้าง แต่คงความหมาย"
      },
      {
        target:"objective", level:"B1+",
        question:"Which quality should improve this summary?",
        context:"The writer adds: “This is the most amazing solution ever.” The summary should use evidence instead of personal feeling.",
        options:["objective","opinion","copy-paste","main point"],
        thai:"งานสรุปเชิงวิชาการควร objective คือยึดหลักฐานมากกว่าความรู้สึก"
      },
      {
        target:"concise", level:"B1+",
        question:"Which quality does this revised summary show?",
        context:"It removes repeated examples but keeps the main point and one useful detail in two clear sentences.",
        options:["concise","irrelevant","bias","assumption"],
        thai:"concise คือสั้น กระชับ แต่ยังไม่เสียใจความ"
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
    return {
      text: term,
      correct: Boolean(correct),
      targetId: target ? target.id : ""
    };
  }

  function createCuratedItem(sessionId, row, index) {
    const target = findTarget(sessionId, row.target);
    if (!target) return null;
    const optionTerms = [];
    const seen = new Set();
    [row.target, ...(row.options || [])].forEach((term) => {
      const k = key(term);
      if (!k || seen.has(k)) return;
      seen.add(k);
      optionTerms.push(term);
    });
    const choices = optionTerms.slice(0,4).map((term) => makeChoice(sessionId, term, key(term) === key(row.target)));
    if (choices.length !== 4 || choices.filter((choice) => choice.correct).length !== 1) return null;

    return {
      id: `${sessionId}_AUDIT_RICH_${String(index + 1).padStart(2,"0")}`,
      sessionId,
      sourceSessionId: sessionId,
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
      quality:"arc2_audited_application",
      skillTag:"Arc 2 • Quality-audited application",
      stemGroup:row.question,
      coreAligned:true,
      auditVersion:VERSION
    };
  }

  function enrichRepairItem(item, sessionId) {
    const targetKey = key(item.target);
    const scenario = REPAIR_CASES[sessionId] && REPAIR_CASES[sessionId][targetKey];
    if (!scenario || item.type !== "repair") return item;
    const patched = Object.assign({}, item, {
      question:scenario.question,
      context:scenario.context,
      feedback:`Correct. “${item.target}” fits this academic situation. ไทย: ${scenario.thai}`,
      quality:"arc2_audited_repair",
      stemGroup:scenario.question,
      auditVersion:VERSION
    });
    return patched;
  }

  function validateItem(item) {
    const issues = [];
    const choices = Array.isArray(item.choices) ? item.choices : [];
    const correct = choices.filter((choice) => choice && choice.correct);
    if (choices.length !== 4) issues.push("choices_not_four");
    if (correct.length !== 1) issues.push("correct_count_not_one");
    const seen = new Set();
    choices.forEach((choice) => {
      const candidate = key(choice && choice.text);
      if (!candidate || seen.has(candidate)) issues.push("duplicate_or_blank_choice");
      seen.add(candidate);
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
        before: original.length,
        after: next.length,
        curated: curated.length,
        auditedRepairItems: next.filter((item) => item.quality === "arc2_audited_repair").length,
        issues
      };
      audit.issues.push(...issues);
    });

    BANK.items = Object.values(BANK.bySession).flat();
    BANK.itemTotal = BANK.items.length;
    BANK.summary = Object.fromEntries(Object.entries(BANK.bySession).map(([id, rows]) => [id, rows.length]));
    BANK.audit = audit;
    window.EAP_ARC2_QUALITY_AUDIT = audit;
    return audit;
  }

  const report = applyAudit();

  window.inspectEapArc2QualityAudit = () => clone(window.EAP_ARC2_QUALITY_AUDIT || report);

  console.info("[EAP Word Quest] Arc 2 quality audit ready", report);
})();
