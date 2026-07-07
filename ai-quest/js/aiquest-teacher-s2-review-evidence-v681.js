/* CSAI2102 Teacher S2 Evidence Review v6.8.1
   Direct modal overlay: report the exact skill evidence from the latest submitted S2 deck.
   This prevents a generic score warning from hiding concrete skill gaps.
*/
(()=>{'use strict';
  if(window.__AIQUEST_TEACHER_S2_REVIEW_EVIDENCE_V681__)return;
  window.__AIQUEST_TEACHER_S2_REVIEW_EVIDENCE_V681__=true;
  const runtime=()=>window.AIQUEST_TEACHER_SAFE_V533||window.AIQUEST_TEACHER_SAFE_V532||null;
  const num=value=>{const n=Number(value);return Number.isFinite(n)?n:0;};
  const parse=value=>{if(!value)return null;if(typeof value==='object')return value;try{return JSON.parse(String(value));}catch(e){return null;}};
  const stamp=attempt=>Date.parse(String(attempt?.serverTs||attempt?.clientTs||attempt?.timestamp||''))||0;
  const isS2=attempt=>String(attempt?.sessionId||attempt?.missionId||'').trim().toLowerCase()==='s2';
  const esc=value=>String(value==null?'':value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
  function latestRecord(student){
    const attempts=(student?.attempts||[]).filter(isS2).slice().sort((a,b)=>stamp(b)-stamp(a));
    for(const attempt of attempts){
      for(const candidate of [attempt.extraJson,attempt.extra,attempt.metrics,attempt.detail,attempt.payload]){
        const meta=parse(candidate);
        if(meta?.s2Skills&&typeof meta.s2Skills==='object')return {attempt,meta};
      }
    }
    return null;
  }
  function name(skill){
    const map={'PEAS ครบองค์ประกอบ':'PEAS Board','Sensor / Actuator':'Sensor / Actuator','Performance measure':'Performance Measure','Rational action':'Rational Action','Human oversight':'Human Oversight','Trade-off':'Safety Trade-off','Audit trail':'Audit Trail','Scope boundary':'Scope Boundary','Human override':'Human Override','Agent test':'Agent Testing'};
    return map[skill]||skill;
  }
  function coach(skill){
    const text=String(skill||'').toLowerCase();
    if(text.includes('audit'))return 'ทบทวนการบันทึก percept–decision–action เพื่อให้ตรวจสอบย้อนหลังได้';
    if(text.includes('scope'))return 'ทบทวนขอบเขตที่ระบบไม่ควรตัดสินเอง และเงื่อนไขส่งต่อผู้รับผิดชอบ';
    if(text.includes('sensor'))return 'ทบทวนความน่าเชื่อถือของข้อมูลรับรู้ และ safe fallback เมื่อข้อมูลคลาดเคลื่อน';
    if(text.includes('performance'))return 'ทบทวนตัวชี้วัดที่รวมความปลอดภัยและผลกระทบต่อผู้ใช้ ไม่วัดความเร็วอย่างเดียว';
    if(text.includes('oversight')||text.includes('override'))return 'ทบทวนจุดที่มนุษย์ต้องกำกับ หยุด หรืออนุมัติการทำงานของ Agent';
    return 'ทบทวน Case ที่พลาดและอธิบายหลักฐานที่ใช้ตัดสินใจ';
  }
  function gaps(student){
    const record=latestRecord(student);if(!record)return [];
    return Object.entries(record.meta.s2Skills||{}).filter(([,row])=>row&&num(row.total)>0&&num(row.correct)<num(row.total)).sort((a,b)=>(num(a[1].correct)/Math.max(1,num(a[1].total)))-(num(b[1].correct)/Math.max(1,num(b[1].total))).slice(0,4).map(([skill,row])=>({skill,label:name(skill),correct:num(row.correct),total:num(row.total),coach:coach(skill)}));
  }
  function personFor(modal){
    const id=String(modal.querySelector('h2')?.textContent||'').split('•')[0].trim();
    return (runtime()?.state?.students||[]).find(student=>String(student.studentId||'').trim()===id)||null;
  }
  function render(){
    const modal=document.getElementById('aiquestDirectStudentDetailV674');if(!modal)return;
    const student=personFor(modal),rows=gaps(student);if(!student||!rows.length)return;
    const section=[...modal.querySelectorAll('section')].find(node=>/^Review focus$/i.test(String(node.querySelector('h3')?.textContent||'').trim()));
    if(!section)return;
    let panel=section.querySelector('#aiquestS2EvidenceReviewV681');
    if(!panel){panel=document.createElement('div');panel.id='aiquestS2EvidenceReviewV681';panel.style.cssText='margin-top:9px;padding:11px;border:1px solid rgba(251,191,36,.42);border-radius:13px;background:rgba(251,191,36,.08);line-height:1.55';section.appendChild(panel);}
    panel.innerHTML='<b>จุดทบทวนจาก S2 Deck ล่าสุด</b><div style="display:grid;gap:7px;margin-top:8px">'+rows.map(item=>'<div><b style="color:#fde68a">'+esc(item.label)+' '+item.correct+'/'+item.total+'</b><br><span style="color:#e8f1ff">'+esc(item.coach)+'</span></div>').join('')+'</div>';
    const generic=section.querySelector('p');
    if(generic){generic.textContent='คะแนนล่าสุด '+num(student.latestScore)+' • ใช้รายการด้านล่างเป็นจุดทบทวนเฉพาะทักษะ';generic.style.color='#9fb2cc';}
  }
  new MutationObserver(()=>setTimeout(render,0)).observe(document.body,{childList:true,subtree:true});
  setInterval(render,220);render();
})();
