/* CSAI2102 Teacher Console — View Bridge v7.0.0
   Robust standalone bridge for dynamically re-rendered View buttons.
   Uses UX v697 when available; otherwise opens a safe fallback modal.
*/
(()=>{'use strict';
  if(window.__AIQUEST_TEACHER_VIEW_BRIDGE_V700__)return;
  window.__AIQUEST_TEACHER_VIEW_BRIDGE_V700__=true;
  const VERSION='v7.0.0';
  const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const arr=v=>Array.isArray(v)?v:[];
  const num=v=>Number.isFinite(Number(v))?Number(v):0;
  const runtime=()=>window.AIQUEST_TEACHER_SAFE_V533||window.AIQUEST_TEACHER_SAFE_V532||null;
  const stamp=a=>Date.parse(String(a?.serverTs||a?.clientTs||a?.timestamp||''))||0;
  const parse=v=>{if(v&&typeof v==='object')return v;if(typeof v==='string'){try{return JSON.parse(v)}catch(e){return {}}}return {}};
  const meta=a=>{const e=parse(a?.extraJson||a?.extra),raw=(e.raw&&typeof e.raw==='object')?e.raw:{},nested=parse(raw.extraJson||e.extraJson);return Object.assign({},e,nested,(raw.extraJson&&typeof raw.extraJson==='object')?raw.extraJson:{});};
  function students(){return arr(runtime()?.state?.students);}
  function findStudent(btn){
    const row=btn.closest('tr');
    const id=String(row?.querySelector('td b')?.textContent||'').trim();
    const byId=students().find(s=>String(s?.studentId||'').trim()===id);
    if(byId)return byId;
    const idx=Number(btn.dataset.index);
    return Number.isInteger(idx)?students()[idx]||null:null;
  }
  function closeFallback(){document.getElementById('aqViewFallbackV700')?.remove();document.body.style.overflow='';}
  function fallback(student){
    closeFallback();
    const attempts=arr(student?.attempts).slice().sort((a,b)=>stamp(b)-stamp(a));
    const latest=attempts[0]||{};
    const x=meta(latest),audit=(x.challengeAudit&&typeof x.challengeAudit==='object')?x.challengeAudit:{};
    const shell=document.createElement('div');shell.id='aqViewFallbackV700';
    shell.innerHTML=`<style>
      #aqViewFallbackV700{position:fixed;inset:0;z-index:2147483647;background:rgba(2,6,23,.88);display:flex;align-items:center;justify-content:center;padding:16px;color:#e8f1ff;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      #aqViewFallbackV700 *{box-sizing:border-box}#aqViewFallbackV700 .p{width:min(1100px,100%);max-height:92vh;overflow:auto;background:#0f1d33;border:1px solid rgba(148,163,184,.28);border-radius:20px;box-shadow:0 28px 70px rgba(0,0,0,.5)}
      #aqViewFallbackV700 .h{position:sticky;top:0;z-index:2;background:#10213a;padding:14px 16px;border-bottom:1px solid rgba(148,163,184,.2);display:flex;justify-content:space-between;gap:12px;align-items:center}
      #aqViewFallbackV700 .b{padding:16px}#aqViewFallbackV700 button{border:1px solid rgba(148,163,184,.32);border-radius:10px;padding:9px 12px;background:#17304d;color:#fff;font-weight:800;cursor:pointer}
      #aqViewFallbackV700 .g{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}#aqViewFallbackV700 .m{padding:12px;border:1px solid rgba(148,163,184,.2);border-radius:13px;background:rgba(255,255,255,.035)}#aqViewFallbackV700 small{color:#9fb2cc}#aqViewFallbackV700 .m b{display:block;font-size:24px;margin-top:4px}
      #aqViewFallbackV700 .sec{margin-top:14px;padding-top:14px;border-top:1px solid rgba(148,163,184,.18)}#aqViewFallbackV700 .ref{padding:11px;border:1px solid rgba(148,163,184,.2);border-radius:12px;margin-top:8px;background:rgba(255,255,255,.03)}#aqViewFallbackV700 .ref p{white-space:pre-wrap;line-height:1.6}
      #aqViewFallbackV700 table{width:100%;border-collapse:collapse;min-width:760px}#aqViewFallbackV700 th,#aqViewFallbackV700 td{padding:9px;border-bottom:1px solid rgba(148,163,184,.15);text-align:left;font-size:13px}#aqViewFallbackV700 .tw{overflow:auto;border:1px solid rgba(148,163,184,.18);border-radius:12px}
      @media(max-width:760px){#aqViewFallbackV700{padding:0}#aqViewFallbackV700 .p{width:100%;height:100vh;max-height:none;border-radius:0}#aqViewFallbackV700 .g{grid-template-columns:1fr 1fr}}
    </style><div class="p"><div class="h"><div><b>${esc(student?.studentId||'-')} • ${esc(student?.studentName||'')}</b><div><small>View Bridge v700 fallback</small></div></div><button id="aqViewCloseV700">ปิด</button></div><div class="b">
      <div class="g"><div class="m"><small>Attempts</small><b>${attempts.length}</b></div><div class="m"><small>Latest</small><b>${attempts.length?num(latest.score):'—'}</b></div><div class="m"><small>Best</small><b>${attempts.length?Math.max(...attempts.map(a=>num(a.score))):'—'}</b></div><div class="m"><small>Mastery</small><b>${latest.mastered?'TRUE':'FALSE'}</b></div></div>
      <div class="sec"><h3>Selected Case</h3><p>${[x.selectedCaseContext,x.selectedCaseSkill,x.selectedCaseRisk,x.selectedCaseTrap].filter(Boolean).map(esc).join(' • ')||'ไม่มี metadata'}</p></div>
      <div class="sec"><h3>Challenge Evidence</h3><p>Content: ${esc(x.contentVersion||'—')} • Challenge: ${esc(audit.version||'—')} • Unique correct: ${esc(audit.uniqueCorrect??'—')} • Unique distractors: ${esc(audit.uniqueDistractors??'—')}</p></div>
      <div class="sec"><h3>Reflection</h3>${[1,2,3].map(i=>`<div class="ref"><b>${i}) ${esc(x['reflectionPrompt'+i]||('Reflection '+i))}</b><p>${esc(latest['reflection'+i]||'ยังไม่มีคำตอบ')}</p></div>`).join('')}</div>
      <div class="sec"><h3>Attempt History</h3><div class="tw"><table><thead><tr><th>Submitted</th><th>Session</th><th>Score</th><th>Correct</th><th>Accuracy</th><th>Version</th></tr></thead><tbody>${attempts.map(a=>{const am=meta(a);return `<tr><td>${stamp(a)?new Date(stamp(a)).toLocaleString('th-TH'):'—'}</td><td>${esc(a.sessionId||a.missionId||'—')}</td><td>${num(a.score)}</td><td>${num(a.correct)}/${num(a.total)}</td><td>${num(a.accuracy)}%</td><td>${esc(am.contentVersion||a.schemaVersion||'—')}</td></tr>`}).join('')}</tbody></table></div></div>
    </div></div>`;
    document.body.appendChild(shell);document.body.style.overflow='hidden';
    document.getElementById('aqViewCloseV700').onclick=closeFallback;
    shell.addEventListener('click',e=>{if(e.target===shell)closeFallback();});
  }
  function openStudent(btn){
    const student=findStudent(btn);if(!student)return;
    try{
      const ux=window.AIQUEST_TEACHER_SESSION_DETAIL_UX_V697;
      if(ux&&typeof ux.open==='function'){ux.open(student);return;}
    }catch(e){console.error('[AIQuest] v697 open failed',e);}
    fallback(student);
  }
  function handle(e){
    const btn=e.target?.closest?.('#studentsBox .detailBtn,#studentsBox button[data-index],#studentsBox button');
    if(!btn||btn.disabled||btn.getAttribute('aria-disabled')==='true')return;
    if(!/view|ดูรายละเอียด/i.test(String(btn.textContent||'')))return;
    e.preventDefault();e.stopPropagation();
    openStudent(btn);
  }
  document.addEventListener('click',handle,true);
  document.addEventListener('pointerup',e=>{const btn=e.target?.closest?.('#studentsBox .detailBtn,#studentsBox button[data-index]');if(!btn||btn.disabled)return;setTimeout(()=>{if(!document.getElementById('aiquestTeacherDetailV697')&&!document.getElementById('aqViewFallbackV700'))openStudent(btn);},0);},true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeFallback();});
  window.AIQUEST_TEACHER_VIEW_BRIDGE_V700={VERSION,openStudent,fallback};
  console.log('[AIQuest] Teacher View Bridge active',VERSION);
})();