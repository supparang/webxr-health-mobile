/* EAP Word Quest • Arc 5 Quality Audit • v2.1.4-ARC5-QUALITY-AUDIT-122 */
(() => {
  "use strict";
  const VERSION = "v2.1.4-ARC5-QUALITY-AUDIT-122";
  const SESSIONS = ["S13","S14","S15"];
  if (window.__EAP_WORD_V214_ARC5_AUDIT__) return;
  window.__EAP_WORD_V214_ARC5_AUDIT__ = true;
  if (!window.EAP_CORE_QUESTION_BANK || typeof window.getEapCoreSessionTargets !== "function") return;

  const BANK = window.EAP_CORE_QUESTION_BANK;
  const norm = v => String(v == null ? "" : v).replace(/\s+/g," ").trim();
  const key = v => norm(v).toLowerCase().replace(/[’']/g, "");
  const clone = v => JSON.parse(JSON.stringify(v));

  const CURATED = {
    S13:[
      {target:"main point",level:"B1",question:"Choose the information a listener should record first.",context:"A lecturer explains why students should plan research tasks early, then gives two examples from group projects.",options:["main point","useful detail","distractor","speaker"],thai:"เริ่มจาก main point เพราะเป็นใจความหลักที่รายละเอียดอื่นช่วยสนับสนุน"},
      {target:"note-taking",level:"B1",question:"Choose the skill used in this situation.",context:"During a short lecture, a student writes keywords and one example instead of copying every sentence.",options:["note-taking","copy-paste","closing","citation"],thai:"จด keyword และรายละเอียดสำคัญระหว่างฟังคือ note-taking"},
      {target:"inference",level:"B1+",question:"Choose the term for this careful conclusion.",context:"The speaker says that booking rooms is often difficult at noon and that many students work in the corridor. The listener concludes that study spaces may be limited at that time.",options:["inference","summary","quote","outline"],thai:"สรุปจากเบาะแสที่ผู้พูดไม่ได้พูดตรง ๆ คือ inference"},
      {target:"distractor",level:"B1+",question:"Choose the term for this misleading listening option.",context:"The lecture is about study planning, but one answer choice mentions a singer's concert and does not connect to the talk.",options:["distractor","useful detail","main point","evidence"],thai:"ตัวเลือกที่ดูเหมือนเกี่ยวแต่ไม่ตอบโจทย์จริงคือ distractor"}
    ],
    S14:[
      {target:"opening",level:"B1",question:"Choose the part that should begin a short academic presentation.",context:"The speaker introduces the topic and tells the audience why it matters before giving details.",options:["opening","closing","evidence","feedback"],thai:"ส่วนแรกของการนำเสนอที่เปิดหัวข้อและดึงความสนใจคือ opening"},
      {target:"signpost",level:"B1",question:"Choose the feature used in this sentence.",context:"“First, I will explain the issue. Next, I will show the survey results.”",options:["signpost","citation","reflection","request"],thai:"First และ Next ช่วยบอกเส้นทางการนำเสนอ จึงเป็น signpost"},
      {target:"outline",level:"B1+",question:"Choose the term for this short plan at the start of a talk.",context:"The presenter tells the audience that the talk will cover the problem, evidence, and one recommendation.",options:["outline","example","conclusion","stakeholder"],thai:"การบอกหัวข้อหลักที่จะพูดก่อนเริ่มรายละเอียดคือ outline"},
      {target:"conclusion",level:"B1+",question:"Choose the part that brings this presentation together.",context:"After reviewing the evidence and recommendation, the speaker restates the central message and ends the talk clearly.",options:["conclusion","opening","transition","attachment"],thai:"ส่วนที่รวบยอดประเด็นสำคัญและปิดการนำเสนอคือ conclusion"}
    ],
    S15:[
      {target:"problem statement",level:"B1",question:"Choose the item that should clearly define this project issue.",context:"A solution brief begins: “Students have too few quiet places for group work between classes.”",options:["problem statement","recommendation","reflection","next step"],thai:"การระบุปัญหาให้ชัดตั้งแต่ต้นคือ problem statement"},
      {target:"evidence",level:"B1",question:"Choose what makes this solution brief convincing.",context:"The team includes a survey showing that 72% of students could not find a study space at peak time.",options:["evidence","opinion","greeting","distractor"],thai:"ผลสำรวจเป็น evidence ที่รองรับว่าปัญหาเกิดขึ้นจริง"},
      {target:"reflection",level:"B1+",question:"Choose the term for this final learning step.",context:"After the presentation, the team explains what worked, what needs improvement, and what it learned from the audience's comments.",options:["reflection","opening","citation","sequence"],thai:"การคิดทบทวนสิ่งที่ทำและสิ่งที่เรียนรู้คือ reflection"},
      {target:"sustainable",level:"B1+",question:"Choose the word for this long-term solution quality.",context:"The proposal uses existing rooms, avoids waste, and can continue next year without creating new long-term problems.",options:["sustainable","temporary","irrelevant","rude"],thai:"แนวทางที่ทำต่อได้ระยะยาวโดยไม่สร้างผลเสียคือ sustainable"}
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
      quality:"arc5_audited_application",skillTag:"Arc 5 • Quality-audited application",stemGroup:row.question,
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
    const stem = `${norm(item.question)} ${norm(item.context)}`.toLowerCase();
    if (/answer\s*:/i.test(stem)) issues.push("answer_leak");
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
  BANK.audit = Object.assign({},BANK.audit||{},{arc5:audit});
  window.EAP_ARC5_QUALITY_AUDIT = audit;
  window.inspectEapArc5QualityAudit = () => clone(window.EAP_ARC5_QUALITY_AUDIT || audit);
  console.info("[EAP Word Quest] Arc 5 quality audit ready",audit);
})();
