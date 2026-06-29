/* EAP Word Quest • Arc 1 Quality Audit • v2.1.7-ARC1-QUALITY-AUDIT-122 */
(() => {
  "use strict";
  const VERSION = "v2.1.7-ARC1-QUALITY-AUDIT-122";
  const SESSIONS = ["S1","S2","S3"];
  if (window.__EAP_WORD_V217_ARC1_AUDIT__) return;
  window.__EAP_WORD_V217_ARC1_AUDIT__ = true;
  if (!window.EAP_CORE_QUESTION_BANK || typeof window.getEapCoreSessionTargets !== "function") return;

  const BANK = window.EAP_CORE_QUESTION_BANK;
  const norm = v => String(v == null ? "" : v).replace(/\s+/g," ").trim();
  const key = v => norm(v).toLowerCase().replace(/[’']/g,"");
  const clone = v => JSON.parse(JSON.stringify(v));

  const CURATED = {
    S1:[
      {target:"academic goal",level:"A2+",question:"Choose the best term for this study aim.",context:"A student wants to improve academic reading by the end of the course and writes a clear target for it.",options:["academic goal","attendance","source","summary"],thai:"เป้าหมายการเรียนที่อยากบรรลุคือ academic goal"},
      {target:"weekly action",level:"A2+",question:"Choose the term for this practical plan.",context:"“Every Thursday, I will practise reading one short academic text for 20 minutes.”",options:["weekly action","final result","main idea","deadline"],thai:"สิ่งที่ลงมือทำเป็นประจำทุกสัปดาห์คือ weekly action"},
      {target:"realistic",level:"B1",question:"Choose the word that describes this stronger plan.",context:"A student plans to learn five useful terms each week instead of trying to learn 300 terms overnight.",options:["realistic","irrelevant","rude","optional"],thai:"แผนที่ทำได้จริงตามเวลาและกำลังของตนคือ realistic"},
      {target:"measurable",level:"B1+",question:"Choose the word that describes this target.",context:"“I will score at least 70% on the next vocabulary practice.” The student can check whether it was achieved.",options:["measurable","informal","bias","sequence"],thai:"เป้าหมายที่ตรวจสอบได้ด้วยคะแนนหรือหลักฐานคือ measurable"}
    ],
    S2:[
      {target:"deadline",level:"A2+",question:"Choose the word that tells students the latest time to act.",context:"A notice says, “Submit the reflection by Friday at 17:00.”",options:["deadline","timetable","attendance","outline"],thai:"เวลาสุดท้ายที่ต้องส่งงานคือ deadline"},
      {target:"context clue",level:"A2+",question:"Choose the strategy that helps with this unknown word.",context:"A notice says “Attendance is compulsory; all students must be present.” The nearby words explain the meaning of compulsory.",options:["context clue","copy-paste","citation","closing"],thai:"คำรอบข้างที่ช่วยเดาความหมายของคำคือ context clue"},
      {target:"collocation",level:"B1",question:"Choose the term for words commonly used together.",context:"In a campus notice, “course requirement” is a natural word pair that students often see together.",options:["collocation","word family","main point","recommendation"],thai:"คำที่มักใช้คู่กันอย่างเป็นธรรมชาติคือ collocation"},
      {target:"word family",level:"B1+",question:"Choose the term for this related set of forms.",context:"The student groups submit, submission, and submitted to see how one word changes in different grammar roles.",options:["word family","signal word","transition","source"],thai:"ชุดคำที่เกี่ยวข้องกันแต่เปลี่ยนรูปตามหน้าที่คือ word family"}
    ],
    S3:[
      {target:"main idea",level:"A2+",question:"Choose the term for the most important message in this paragraph.",context:"A paragraph explains that planning early helps groups divide work, meet deadlines, and reduce stress.",options:["main idea","supporting detail","example","word family"],thai:"ข้อความที่ครอบคลุมใจความทั้งหมดคือ main idea"},
      {target:"supporting detail",level:"A2+",question:"Choose the term for this sentence.",context:"“For example, one group used a shared calendar to assign tasks.” This sentence helps explain the paragraph's main point.",options:["supporting detail","topic sentence","conclusion","deadline"],thai:"รายละเอียดที่ยกมาอธิบายหรือสนับสนุนใจความหลักคือ supporting detail"},
      {target:"relevant",level:"B1",question:"Choose the word for information that belongs in this task.",context:"A report about library opening hours includes the times when the library opens and closes.",options:["relevant","irrelevant","rude","stable"],thai:"ข้อมูลที่เกี่ยวข้องโดยตรงกับหัวข้อคือ relevant"},
      {target:"implied meaning",level:"B1+",question:"Choose the term for this reading skill.",context:"A notice says the study room is full every afternoon. A reader concludes that students may need to book early, even though the notice does not say this directly.",options:["implied meaning","exact quote","subject line","percentage"],thai:"ความหมายที่ข้อความชี้ให้เข้าใจแต่ไม่ได้บอกตรง ๆ คือ implied meaning"}
    ]
  };

  function target(sessionId,term){ return (window.getEapCoreSessionTargets(sessionId,{unique:true})||[]).find(t=>key(t.term)===key(term))||null; }
  function makeItem(sessionId,row,index){
    const itemTarget=target(sessionId,row.target); if(!itemTarget) return null;
    const seen=new Set(); const options=[row.target,...row.options].filter(term=>{const id=key(term); if(!id||seen.has(id)) return false; seen.add(id); return true;}).slice(0,4);
    const choices=options.map(term=>({text:term,correct:key(term)===key(row.target),targetId:(target(sessionId,term)||{}).id||""}));
    if(choices.length!==4||choices.filter(c=>c.correct).length!==1) return null;
    return {id:`${sessionId}_AUDIT_RICH_${String(index+1).padStart(2,"0")}`,sessionId,sourceSessionId:sessionId,type:"application",itemType:"application",level:row.level,target:itemTarget.term,targetId:itemTarget.id,targetBand:itemTarget.band,targets:[itemTarget.term],question:row.question,context:row.context,choices,answerTerm:itemTarget.term,feedback:`Correct. “${itemTarget.term}” is the best answer. ไทย: ${row.thai}`,quality:"arc1_audited_application",skillTag:"Arc 1 • Quality-audited application",stemGroup:row.question,coreAligned:true,auditVersion:VERSION};
  }
  function validate(item){
    const rows=Array.isArray(item.choices)?item.choices:[]; const issues=[];
    if(rows.length!==4) issues.push("choices_not_four"); if(rows.filter(row=>row&&row.correct).length!==1) issues.push("correct_count_not_one");
    const seen=new Set(); rows.forEach(row=>{const id=key(row&&row.text); if(!id||seen.has(id)) issues.push("duplicate_or_blank_choice"); seen.add(id);});
    const stem=`${norm(item.question)} ${norm(item.context)}`.toLowerCase(); if(/answer\s*:/i.test(stem)) issues.push("answer_leak"); return issues;
  }
  const audit={version:VERSION,sessions:{},issues:[],appliedAt:new Date().toISOString()};
  SESSIONS.forEach(sessionId=>{
    const original=Array.isArray(BANK.bySession[sessionId])?BANK.bySession[sessionId]:[];
    const retained=original.filter(item=>!/_RICH_\d+$/i.test(norm(item.id)));
    const curated=CURATED[sessionId].map((row,index)=>makeItem(sessionId,row,index)).filter(Boolean);
    const next=[...retained,...curated]; const issues=next.flatMap(item=>validate(item).map(issue=>`${item.id}:${issue}`));
    BANK.bySession[sessionId]=next; audit.sessions[sessionId]={before:original.length,after:next.length,curated:curated.length,issues}; audit.issues.push(...issues);
  });
  BANK.items=Object.values(BANK.bySession).flat(); BANK.itemTotal=BANK.items.length; BANK.summary=Object.fromEntries(Object.entries(BANK.bySession).map(([id,rows])=>[id,rows.length]));
  BANK.audit=Object.assign({},BANK.audit||{},{arc1:audit}); window.EAP_ARC1_QUALITY_AUDIT=audit; window.inspectEapArc1QualityAudit=()=>clone(window.EAP_ARC1_QUALITY_AUDIT||audit);
  console.info("[EAP Word Quest] Arc 1 quality audit ready",audit);
})();
