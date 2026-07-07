/* CSAI2102 Teacher Core Reflection Evidence v6.7.6
   Shows the selected real-deck Case for S1/S3–S9/Boss core reflections in the
   Teacher Detail view. It exposes evidence binding and semantic checks, but does not
   auto-grade academic quality; the teacher retains that judgment.
*/
(()=>{'use strict';
  if(window.__AIQUEST_TEACHER_CORE_REFLECTION_EVIDENCE_V676__)return;
  window.__AIQUEST_TEACHER_CORE_REFLECTION_EVIDENCE_V676__=true;

  const PREFIX='Core reflection evidence: ';
  const app=()=>window.AIQUEST_TEACHER_SAFE_V533||window.AIQUEST_TEACHER_SAFE_V532||null;
  const esc=value=>String(value==null?'':value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
  const parse=value=>{if(!value)return{};if(typeof value==='object')return value;try{return JSON.parse(String(value));}catch(e){return{}}};
  const stamp=attempt=>Date.parse(String(attempt?.serverTs||attempt?.clientTs||attempt?.timestamp||''))||0;
  const canonical=value=>String(value||'').trim().toLowerCase().replace(/[\s_\-:]+/g,'');
  const coreIds=new Set(['s1','s2','s3','b1','s4','s5','s6','b2','s7','s8','s9','b3']);
  const labels={s1:'S1 • AI Spotter',s2:'S2 • Agent Builder',s3:'S3 • Search Maze',b1:'B1 • Foundation Boss',s4:'S4 • Route Cost Challenge',s5:'S5 • A* Rescue Mission',s6:'S6 • Minimax Arena',b2:'B2 • Search & Game Boss',s7:'S7 • Rule Chain Builder',s8:'S8 • Bayes Console',s9:'S9 • Expert Diagnosis Board',b3:'B3 • Reasoning Boss'};

  function sessionId(attempt){
    const raw=canonical(attempt?.sessionId||attempt?.missionId);
    const map={m1:'s1',m2:'s2',m3:'s3',m4:'s4',m5:'s5',m6:'s6',m7:'s7',m8:'s8',m9:'s9',boss1:'b1',boss2:'b2',boss3:'b3'};
    return map[raw]||raw;
  }
  function isCore(attempt){return coreIds.has(sessionId(attempt));}
  function person(modal){
    const id=String(modal.querySelector('h2')?.textContent||'').split('•')[0].trim();
    return (app()?.state?.students||[]).find(student=>String(student.studentId||'').trim()===id)||null;
  }
  function attemptExtra(attempt){
    for(const value of [attempt?.extraJson,attempt?.extra,attempt?.metrics,attempt?.detail,attempt?.payload?.extraJson]){
      const extra=parse(value);if(extra&&Object.keys(extra).length)return extra;
    }
    return {};
  }
  function latestEvidence(student){
    const attempts=(student?.attempts||[]).filter(isCore).slice().sort((a,b)=>stamp(b)-stamp(a));
    for(const attempt of attempts){
      const extra=attemptExtra(attempt);
      const evidence=extra.coreReflectionEvidence||null;
      if(evidence&&typeof evidence==='object'&&evidence.selectedCaseId)return {attempt,extra,evidence,legacy:false};
      if(extra.selectedCaseId&&extra.coreReflectionEvidenceCaptured){
        return {attempt,extra,evidence:{selectedCaseId:extra.selectedCaseId,selectedCaseContext:extra.selectedCaseContext,selectedCasePhase:extra.selectedCasePhase,selectedCaseFocus:extra.selectedCaseFocus,selectedCaseExpectedConcept:extra.selectedCaseExpectedConcept,integrity:{ok:!!extra.coreReflectionEvidenceBound}},legacy:false};
      }
    }
    const last=attempts[0]||null;
    return last?{attempt:last,extra:attemptExtra(last),evidence:null,legacy:true}:null;
  }
  function checkRows(integrity){
    const c=integrity&&integrity.checks&&typeof integrity.checks==='object'?integrity.checks:{};
    const labels={contextR1:'ข้อ 1 ระบุ Context',conceptR1:'ข้อ 1 ตอบแนวคิด Case',contextR2:'ข้อ 2 เชื่อม Context',conceptR2:'ข้อ 2 เชื่อมแนวคิด Case',humanReviewR3:'ข้อ 3 ระบุ human review'};
    const keys=Object.keys(labels).filter(key=>key in c);
    if(!keys.length)return '';
    return '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:9px">'+keys.map(key=>'<span style="display:inline-flex;padding:4px 7px;border:1px solid '+(c[key]?'rgba(52,211,153,.42)':'rgba(251,113,133,.42)')+';border-radius:999px;color:'+(c[key]?'#bbf7d0':'#fecdd3')+';background:'+(c[key]?'rgba(52,211,153,.08)':'rgba(251,113,133,.08)')+';font-size:11px;font-weight:800">'+(c[key]?'✓ ':'✕ ')+esc(labels[key])+'</span>').join('')+'</div>';
  }
  function card(label,value){return '<div style="padding:10px;border:1px solid rgba(148,163,184,.20);border-radius:12px;background:rgba(255,255,255,.035)"><span style="display:block;font-size:11px;color:#9fb2cc">'+esc(label)+'</span><b style="line-height:1.45">'+esc(value||'—')+'</b></div>';}
  function reviewRisk(student,data){
    if(!student)return false;
    const old=Array.isArray(student.risks)?student.risks.map(String):[];
    const keep=old.filter(item=>!item.startsWith(PREFIX));
    const ev=data?.evidence,ok=!!(ev?.integrity?.ok)||!!data?.extra?.coreReflectionEvidenceBound;
    const next=ev&&!ok?[PREFIX+'ตรวจความเชื่อมโยง Reflection ของ '+(labels[sessionId(data.attempt)]||sessionId(data.attempt).toUpperCase())]:keep;
    const merged=ev&&!ok?[...next,...keep]:keep;
    const changed=merged.join('|')!==old.join('|');student.risks=merged;return changed;
  }
  function applyRisks(){
    const students=app()?.state?.students;if(!Array.isArray(students)||!students.length)return;
    let changed=false;students.forEach(student=>{if(reviewRisk(student,latestEvidence(student)))changed=true;});
    if(changed){const search=document.getElementById('studentSearch');if(search&&typeof search.oninput==='function')search.oninput();}
  }
  function render(){
    const modal=document.getElementById('aiquestDirectStudentDetailV674');
    if(!modal||modal.querySelector('#aiquestCoreReflectionEvidenceV676'))return;
    const student=person(modal),data=latestEvidence(student);if(!student||!data)return;
    const ev=data.evidence,extra=data.extra||{},session=sessionId(data.attempt),title=labels[session]||session.toUpperCase();
    const panel=document.createElement('section');panel.id='aiquestCoreReflectionEvidenceV676';panel.style.cssText='margin-top:16px;padding-top:14px;border-top:1px solid rgba(148,163,184,.18)';
    if(!ev){
      panel.innerHTML='<h3 style="margin:0">Core Reflection Evidence • Selected Case</h3><p style="margin:6px 0;color:#9fb2cc;line-height:1.55">'+esc(title)+' • ผลล่าสุดเป็นข้อมูลก่อนเปิด Case Evidence Gate หรือยังไม่มีการเลือก Case</p><div style="margin-top:10px;padding:11px 12px;border:1px solid rgba(251,191,36,.46);border-radius:13px;background:rgba(251,191,36,.10);color:#fde68a"><b>⚠ ยังไม่มี Core Selected Case Evidence</b><br><span style="font-size:12px">ใช้เป็นข้อมูลประวัติได้ แต่ครูยังตรวจความเชื่อมโยงระหว่าง Case กับ Reflection แบบอัตโนมัติไม่ได้</span></div>';
    }else{
      const integrity=ev.integrity||{},ok=!!integrity.ok||!!extra.coreReflectionEvidenceBound,deck=ev.deckRound||extra.replayRound||'—';
      panel.innerHTML='<h3 style="margin:0">Core Reflection Evidence • Selected Case</h3><p style="margin:6px 0;color:#9fb2cc;line-height:1.55">'+esc(title)+' • Case ที่นักศึกษาเลือกจาก Replay Deck จริงก่อนส่ง Reflection</p>'+ 
        '<div style="margin:10px 0;padding:11px 12px;border:1px solid '+(ok?'rgba(52,211,153,.45)':'rgba(251,113,133,.48)')+';border-radius:13px;background:'+(ok?'rgba(52,211,153,.10)':'rgba(251,113,133,.10)')+';color:'+(ok?'#bbf7d0':'#fecdd3')+'"><b>'+(ok?'✓ Core Evidence Binding ผ่านก่อนส่งผล':'⚠ Core Evidence Binding ไม่ผ่านหรือข้อมูลไม่ครบ')+'</b><br><span style="font-size:12px">Deck #'+esc(deck)+' • Case ID '+esc(ev.selectedCaseId)+'</span>'+checkRows(integrity)+'</div>'+
        '<div style="display:grid;grid-template-columns:repeat(3,minmax(150px,1fr));gap:8px">'+card('Context',ev.selectedCaseContext)+card('Phase',ev.selectedCasePhase)+card('Focus',ev.selectedCaseFocus)+'</div>'+ 
        '<div style="margin-top:9px;padding:10px;border:1px solid rgba(167,139,250,.30);border-radius:12px;background:rgba(88,28,135,.12);line-height:1.55"><span style="display:block;font-size:11px;color:#c4b5fd">Expected concept</span><b>'+esc(ev.selectedCaseExpectedConcept||'—')+'</b>'+(ev.selectedCasePrompt?'<div style="margin-top:7px;color:#dbeafe"><span style="color:#9fb2cc">Prompt:</span> '+esc(ev.selectedCasePrompt)+'</div>':'')+'</div>'+ 
        '<p style="margin:10px 0 0;color:#9fb2cc;font-size:12px;line-height:1.55">ระบบตรวจความเชื่อมโยงของหลักฐานเท่านั้น การประเมินคุณภาพภาษา เหตุผล และความเข้าใจยังเป็นดุลยพินิจของอาจารย์</p>';
    }
    const reflection=[...modal.querySelectorAll('section')].find(node=>/^Latest Reflection$/i.test(String(node.querySelector('h3')?.textContent||'').trim()));
    if(reflection)reflection.insertAdjacentElement('beforebegin',panel);else modal.firstElementChild?.appendChild(panel);
  }
  function boot(){
    const state=document.getElementById('loadState');if(state)new MutationObserver(()=>setTimeout(applyRisks,80)).observe(state,{childList:true,characterData:true,subtree:true});
    new MutationObserver(()=>setTimeout(render,0)).observe(document.body,{childList:true,subtree:true});
    setInterval(()=>{applyRisks();render();},300);applyRisks();render();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
