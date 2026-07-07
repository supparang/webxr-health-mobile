/* CSAI2102 Teacher S2 Review Focus v6.8.0
   Makes Review focus consistent with the latest S2 Skill Breakdown.
   A missed skill in the latest submitted Deck must never be hidden by a generic “no review focus” message.
*/
(()=>{'use strict';
  if(window.__AIQUEST_TEACHER_S2_REVIEW_FOCUS_V680__)return;
  window.__AIQUEST_TEACHER_S2_REVIEW_FOCUS_V680__=true;

  const runtime=()=>window.AIQUEST_TEACHER_SAFE_V533||window.AIQUEST_TEACHER_SAFE_V532||null;
  const num=value=>{const n=Number(value);return Number.isFinite(n)?n:0;};
  const parse=value=>{if(!value)return null;if(typeof value==='object')return value;try{return JSON.parse(String(value));}catch(e){return null;}};
  const stamp=attempt=>Date.parse(String(attempt?.serverTs||attempt?.clientTs||attempt?.timestamp||''))||0;
  const isS2=attempt=>String(attempt?.sessionId||attempt?.missionId||'').trim().toLowerCase()==='s2';
  const PREFIX='S2 Skill review: ';

  function latestS2Meta(student){
    const attempts=(student?.attempts||[]).filter(isS2).slice().sort((a,b)=>stamp(b)-stamp(a));
    for(const attempt of attempts){
      for(const candidate of [attempt.extraJson,attempt.extra,attempt.metrics,attempt.detail,attempt.payload]){
        const meta=parse(candidate);
        if(meta&&meta.s2Skills&&typeof meta.s2Skills==='object')return {attempt,meta};
      }
    }
    return null;
  }
  function label(skill){
    const map={
      'PEAS ครบองค์ประกอบ':'PEAS Board',
      'Sensor / Actuator':'Sensor / Actuator',
      'Performance measure':'Performance Measure',
      'Rational action':'Rational Action',
      'Human oversight':'Human Oversight',
      'Trade-off':'Safety Trade-off',
      'Scope boundary':'Scope Boundary',
      'Human override':'Human Override',
      'Audit trail':'Audit Trail',
      'Agent test':'Agent Testing'
    };
    return map[skill]||skill;
  }
  function guidance(skill){
    const raw=String(skill||'').toLowerCase();
    if(raw.includes('conflicting goals')||raw.includes('trade-off'))return 'ทบทวนการจัดลำดับความปลอดภัยและสิทธิ์ของผู้ใช้เหนือความเร็ว เมื่อเป้าหมายขัดกัน';
    if(raw.includes('user rights'))return 'ทบทวนสิทธิ์ผู้ใช้ การอธิบายผล และช่องทางอุทธรณ์';
    if(raw.includes('human override')||raw.includes('human oversight'))return 'ทบทวนจุดส่งต่อให้มนุษย์หยุด อนุมัติ หรือแก้ไขการตัดสินใจของ Agent';
    if(raw.includes('scope'))return 'ทบทวนขอบเขตการทำงานและเงื่อนไขที่ระบบต้องส่งต่อมนุษย์';
    return 'ทบทวนหลักการของทักษะนี้จาก Case ที่พลาดใน Deck ล่าสุด';
  }
  function reviewLines(student){
    const record=latestS2Meta(student);
    if(!record)return [];
    const skills=record.meta.s2Skills||{};
    return Object.entries(skills)
      .filter(([,row])=>row&&num(row.total)>0&&num(row.correct)<num(row.total))
      .sort((a,b)=>((num(a[1].correct)/Math.max(1,num(a[1].total)))-(num(b[1].correct)/Math.max(1,num(b[1].total))))
      .slice(0,3)
      .map(([skill,row])=>PREFIX+label(skill)+' '+num(row.correct)+'/'+num(row.total)+' — '+guidance(skill));
  }
  function applyStudent(student){
    const old=Array.isArray(student.risks)?student.risks.map(String):[];
    const stable=old.filter(item=>!item.startsWith(PREFIX));
    const derived=reviewLines(student);
    const next=[...derived,...stable];
    const changed=next.join('|')!==old.join('|');
    student.risks=next;
    student._s2ReviewFocusV680=derived;
    return changed;
  }
  function updateOpenModal(){
    const modal=document.getElementById('aiquestDirectStudentDetailV674');
    if(!modal)return;
    const id=String(modal.querySelector('h2')?.textContent||'').split('•')[0].trim();
    const student=(runtime()?.state?.students||[]).find(row=>String(row.studentId||'').trim()===id);
    if(!student)return;
    const section=[...modal.querySelectorAll('section')].find(node=>/^Review focus$/i.test(String(node.querySelector('h3')?.textContent||'').trim()));
    const paragraph=section?.querySelector('p');
    if(paragraph)paragraph.textContent=(student.risks||[]).join(' • ')||'ไม่มีจุดที่ระบบระบุ';
  }
  function refreshStudentTable(){
    const search=document.getElementById('studentSearch');
    if(search&&typeof search.oninput==='function')search.oninput();
  }
  function apply(){
    const app=runtime();
    const students=app?.state?.students;
    if(!Array.isArray(students)||!students.length)return;
    let changed=false;
    students.forEach(student=>{if(applyStudent(student))changed=true;});
    if(changed)refreshStudentTable();
    updateOpenModal();
  }
  const state=document.getElementById('loadState');
  if(state)new MutationObserver(()=>setTimeout(apply,90)).observe(state,{childList:true,characterData:true,subtree:true});
  new MutationObserver(()=>setTimeout(updateOpenModal,0)).observe(document.body,{childList:true,subtree:true});
  setInterval(apply,350);
  apply();
})();
