/* EAP Word Quest • Arc 4 Quality Audit • v2.1.3-ARC4-QUALITY-AUDIT-122 */
(() => {
  "use strict";
  const VERSION = "v2.1.3-ARC4-QUALITY-AUDIT-122";
  const SESSIONS = ["S10","S11","S12"];
  if (window.__EAP_WORD_V213_ARC4_AUDIT__) return;
  window.__EAP_WORD_V213_ARC4_AUDIT__ = true;
  if (!window.EAP_CORE_QUESTION_BANK || typeof window.getEapCoreSessionTargets !== "function") return;

  const BANK = window.EAP_CORE_QUESTION_BANK;
  const norm = v => String(v == null ? "" : v).replace(/\s+/g," ").trim();
  const key = v => norm(v).toLowerCase().replace(/[’']/g, "");
  const clone = v => JSON.parse(JSON.stringify(v));

  const CURATED = {
    S10:[
      {target:"trend",level:"B1",question:"Choose the term for the overall pattern in these figures.",context:"Use of the campus study app rises each month from January to April.",options:["trend","table","source","request"],thai:"การเปลี่ยนแปลงต่อเนื่องหลายช่วงเวลาเป็น trend"},
      {target:"remain stable",level:"B1",question:"Choose the term that fits these results.",context:"Library satisfaction stays close to 82% for three months with only very small changes.",options:["remain stable","increase","decrease","compare"],thai:"ตัวเลขเกือบคงเดิม จึงใช้ remain stable"},
      {target:"compare",level:"B1+",question:"Choose the action needed for this report task.",context:"The team looks at attendance in two tutorial groups to identify similarities and differences.",options:["compare","paraphrase","cite","request"],thai:"การมองหาความเหมือนและต่างของข้อมูลคือ compare"},
      {target:"significantly",level:"B1+",question:"Choose the adverb for this large change.",context:"Late submissions fall from 40 per week to 8 after the new reminder system begins.",options:["significantly","slightly","politely","objectively"],thai:"การลดลงมากควรใช้ significantly ไม่ใช่ slightly"}
    ],
    S11:[
      {target:"subject line",level:"B1",question:"Choose the email part that tells the lecturer the topic immediately.",context:"“Request for consultation about Project 2” appears before the message body.",options:["subject line","greeting","closing","attachment"],thai:"บรรทัดที่บอกเรื่องของอีเมลก่อนเนื้อหาคือ subject line"},
      {target:"clarify",level:"B1",question:"Choose the best purpose for this message.",context:"A student asks whether the appendix is required because the assignment guide is not clear.",options:["clarify","attach","close","compare"],thai:"เมื่อกติกายังไม่ชัดและต้องการคำอธิบายเพิ่ม คือ clarify"},
      {target:"follow-up",level:"B1+",question:"Choose the term for this polite second email.",context:"A student wrote last week about a missed assessment and sends a short reminder because no reply has arrived.",options:["follow-up","greeting","citation","trend"],thai:"การติดตามเรื่องเดิมอย่างสุภาพหลังยังไม่ได้คำตอบคือ follow-up"},
      {target:"attachment",level:"B1+",question:"Choose the term for the file sent with the email.",context:"The student includes a PDF draft and writes, “Please find the file attached.”",options:["attachment","subject line","closing","request"],thai:"PDF ที่ส่งมากับอีเมลคือ attachment"}
    ],
    S12:[
      {target:"cite",level:"B1",question:"Choose the action a writer should take after using an idea from a journal article.",context:"The student tells readers where the idea came from in the assignment text.",options:["cite","copy text","guess","compare"],thai:"เมื่อใช้แนวคิดของแหล่งข้อมูล ต้อง cite เพื่อบอกที่มา"},
      {target:"paraphrase",level:"B1",question:"Choose the action that keeps meaning but changes wording and structure.",context:"The student reads a source and rewrites the idea in different language without copying the original sentence.",options:["paraphrase","quote","uncredited copying","attachment"],thai:"paraphrase เปลี่ยนคำและโครงสร้าง แต่เก็บความหมายเดิม"},
      {target:"plagiarism",level:"B1+",question:"Choose the term for this academic integrity problem.",context:"A student uses sentences from a website without quotation marks or acknowledgement.",options:["plagiarism","citation","disclosure","reference"],thai:"ใช้ผลงานผู้อื่นโดยไม่ให้เครดิตอย่างถูกต้องคือ plagiarism"},
      {target:"responsible use",level:"B1+",question:"Choose the term for this AI practice.",context:"The student checks facts, follows course rules, protects data, and explains how AI helped with planning.",options:["responsible use","uncredited copying","bias","irrelevant sentence"],thai:"ใช้ AI อย่างตรวจสอบได้ โปร่งใส และตามกติกาคือ responsible use"}
    ]
  };

  function target(sessionId, term) {
    return (window.getEapCoreSessionTargets(sessionId,{unique:true}) || []).find(t => key(t.term) === key(term)) || null;
  }

  function makeItem(sessionId,row,index) {
    const itemTarget = target(sessionId,row.target);
    if (!itemTarget) return null;
    const seen = new Set();
    const options = [row.target,...row.options].filter(term => {
      const id = key(term); if (!id || seen.has(id)) return false; seen.add(id); return true;
    }).slice(0,4);
    const choices = options.map(term => ({text:term,correct:key(term)===key(row.target),targetId:(target(sessionId,term)||{}).id||""}));
    if (choices.length !== 4 || choices.filter(c=>c.correct).length !== 1) return null;
    return {
      id:`${sessionId}_AUDIT_RICH_${String(index+1).padStart(2,"0")}`,
      sessionId,sourceSessionId:sessionId,type:"application",itemType:"application",level:row.level,
      target:itemTarget.term,targetId:itemTarget.id,targetBand:itemTarget.band,targets:[itemTarget.term],
      question:row.question,context:row.context,choices,answerTerm:itemTarget.term,
      feedback:`Correct. “${itemTarget.term}” is the best answer. ไทย: ${row.thai}`,
      quality:"arc4_audited_application",skillTag:"Arc 4 • Quality-audited application",stemGroup:row.question,
      coreAligned:true,auditVersion:VERSION
    };
  }

  function validate(item) {
    const rows = Array.isArray(item.choices) ? item.choices : [];
    const issues = [];
    if (rows.length !== 4) issues.push("choices_not_four");
    if (rows.filter(row=>row && row.correct).length !== 1) issues.push("correct_count_not_one");
    const seen = new Set();
    rows.forEach(row => { const k=key(row&&row.text); if(!k||seen.has(k)) issues.push("duplicate_or_blank_choice"); seen.add(k); });
    return issues;
  }

  const audit = {version:VERSION,sessions:{},issues:[],appliedAt:new Date().toISOString()};
  SESSIONS.forEach(sessionId => {
    const original = Array.isArray(BANK.bySession[sessionId]) ? BANK.bySession[sessionId] : [];
    const retained = original.filter(item => !/_RICH_\d+$/i.test(norm(item.id)));
    const curated = CURATED[sessionId].map((row,index)=>makeItem(sessionId,row,index)).filter(Boolean);
    const next = [...retained,...curated];
    const issues = next.flatMap(item => validate(item).map(issue => `${item.id}:${issue}`));
    BANK.bySession[sessionId] = next;
    audit.sessions[sessionId] = {before:original.length,after:next.length,curated:curated.length,issues};
    audit.issues.push(...issues);
  });
  BANK.items = Object.values(BANK.bySession).flat();
  BANK.itemTotal = BANK.items.length;
  BANK.summary = Object.fromEntries(Object.entries(BANK.bySession).map(([id,rows])=>[id,rows.length]));
  BANK.audit = Object.assign({},BANK.audit||{},{arc4:audit});
  window.EAP_ARC4_QUALITY_AUDIT = audit;
  window.inspectEapArc4QualityAudit = () => clone(window.EAP_ARC4_QUALITY_AUDIT || audit);
  console.info("[EAP Word Quest] Arc 4 quality audit ready",audit);
})();
