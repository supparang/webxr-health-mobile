/* CSAI2102 Teacher S2 Reflection Evidence Panel v6.8.1 */
(()=>{'use strict';
  if(window.__AIQUEST_TEACHER_S2_REFLECTION_EVIDENCE_V681__)return;
  window.__AIQUEST_TEACHER_S2_REFLECTION_EVIDENCE_V681__=true;

  const esc=value=>String(value==null?'':value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
  const app=()=>window.AIQUEST_TEACHER_SAFE_V533||window.AIQUEST_TEACHER_SAFE_V532||null;
  const parse=value=>{if(!value)return{};if(typeof value==='object')return value;try{return JSON.parse(String(value))}catch(e){return{}}};
  const stamp=attempt=>Date.parse(String(attempt&& (attempt.serverTs||attempt.clientTs||attempt.timestamp)||''))||0;
  const s2=attempt=>String(attempt&& (attempt.sessionId||attempt.missionId)||'').trim().toLowerCase()==='s2';
  const policy=value=>({verify:'Verify',reversible:'Reversible',threshold:'Threshold',rights:'User rights',audit:'Audit',scope:'Scope',base:'Base'}[String(value||'').toLowerCase()]||String(value||'—'));

  function person(modal){
    const id=String(modal.querySelector('h2')?.textContent||'').split('•')[0].trim();
    return (app()?.state?.students||[]).find(student=>String(student.studentId||'').trim()===id)||null;
  }
  function latestEvidence(student){
    const attempts=(student?.attempts||[]).filter(s2).sort((a,b)=>stamp(b)-stamp(a));
    for(const attempt of attempts){
      const extra=parse(attempt.extraJson)||parse(attempt.extra)||parse(attempt.payload?.extraJson)||{};
      const item=extra.reflectionEvidence||null;
      if(item&&typeof item==='object'&&item.selectedCaseId)return {attempt,extra,evidence:item};
      if(extra.selectedCaseId)return {attempt,extra,evidence:{selectedCaseId:extra.selectedCaseId,selectedCaseContext:extra.selectedCaseContext,selectedCaseSkill:extra.selectedCaseSkill,selectedCasePolicy:extra.selectedCasePolicy,integrity:{ok:!!extra.reflectionEvidenceBound}}};
    }
    return attempts.length?{attempt:attempts[0],extra:parse(attempts[0].extraJson)||parse(attempts[0].extra)||{},evidence:null}:null;
  }
  function card(label,value){return '<div style="padding:10px;border:1px solid rgba(148,163,184,.20);border-radius:12px;background:rgba(255,255,255,.035)"><span style="display:block;font-size:11px;color:#9fb2cc">'+esc(label)+'</span><b style="line-height:1.45">'+esc(value||'—')+'</b></div>';}
  function render(){
    const modal=document.getElementById('aiquestDirectStudentDetailV674');
    if(!modal||modal.querySelector('#aiquestS2ReflectionEvidenceV681'))return;
    const student=person(modal),data=latestEvidence(student);
    if(!student||!data)return;
    const ev=data.evidence,extra=data.extra||{};
    const panel=document.createElement('section');
    panel.id='aiquestS2ReflectionEvidenceV681';
    panel.style.cssText='margin-top:16px;padding-top:14px;border-top:1px solid rgba(148,163,184,.18)';
    if(!ev){
      panel.innerHTML='<h3 style="margin:0">S2 Reflection Evidence • Selected Case</h3><div style="margin-top:10px;padding:11px 12px;border:1px solid rgba(251,191,36,.46);border-radius:13px;background:rgba(251,191,36,.10);color:#fde68a"><b>⚠ ผล S2 ล่าสุดยังไม่มี Selected Case Evidence</b><br><span style="font-size:12px">เป็นผลก่อนเปิด Reflection Evidence Gate หรือการส่งผลไม่ครบ</span></div>';
    }else{
      const ok=!!(ev.integrity&&ev.integrity.ok)||!!extra.reflectionEvidenceBound;
      const deck=ev.deckRound||extra.replayRound||'—';
      panel.innerHTML='<h3 style="margin:0">S2 Reflection Evidence • Selected Case</h3><p style="margin:6px 0;color:#9fb2cc;line-height:1.55">Case ที่นักศึกษาเลือกจาก Deck จริงก่อนส่ง Reflection</p>'+
        '<div style="margin:10px 0;padding:11px 12px;border:1px solid '+(ok?'rgba(52,211,153,.45)':'rgba(251,113,133,.48)')+';border-radius:13px;background:'+(ok?'rgba(52,211,153,.10)':'rgba(251,113,133,.10)')+';color:'+(ok?'#bbf7d0':'#fecdd3')+'"><b>'+ (ok?'✓ Evidence Binding ผ่านก่อนส่งผล':'⚠ Evidence Binding ไม่ผ่านหรือข้อมูลไม่ครบ')+'</b><br><span style="font-size:12px">Deck #'+esc(deck)+' • Case ID '+esc(ev.selectedCaseId)+'</span></div>'+
        '<div style="display:grid;grid-template-columns:repeat(3,minmax(150px,1fr));gap:8px">'+card('Context',ev.selectedCaseContext)+card('Skill',ev.selectedCaseSkill)+card('Answer policy',policy(ev.selectedCasePolicy))+'</div>';
    }
    const anchor=modal.querySelector('#aiquestS2ReplayAuditV679')||modal.querySelector('#aiquestS2SkillPanelV675');
    if(anchor)anchor.insertAdjacentElement('afterend',panel);else modal.querySelector('.modal-panel')?.appendChild(panel);
  }
  function boot(){new MutationObserver(()=>setTimeout(render,0)).observe(document.body,{childList:true,subtree:true});setInterval(render,350);render();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();