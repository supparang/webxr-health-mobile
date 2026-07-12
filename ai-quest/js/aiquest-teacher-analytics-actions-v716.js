/* CSAI2102 Teacher Console — Analytics Actions Safe v7.1.6
   - Heatmap drill-down
   - Cross-filter analytics
   - Evidence Coverage Matrix
   - no MutationObserver render loop / guarded Inspector opening
*/
(()=>{'use strict';
  if(window.__AIQUEST_TEACHER_ANALYTICS_ACTIONS_V716__)return;
  window.__AIQUEST_TEACHER_ANALYTICS_ACTIONS_V716__=true;
  const VERSION='v7.1.6';
  const ORDER=['s1','s2','s3','b1','s4','s5','s6','b2','s7','s8','s9','b3','s10','s11','s12','b4','s13','s14','s15','b5'];
  const TITLES={s1:'S1',s2:'S2',s3:'S3',b1:'B1',s4:'S4',s5:'S5',s6:'S6',b2:'B2',s7:'S7',s8:'S8',s9:'S9',b3:'B3',s10:'S10',s11:'S11',s12:'S12',b4:'B4',s13:'S13',s14:'S14',s15:'S15',b5:'B5'};
  const runtime=()=>window.AIQUEST_TEACHER_SAFE_V533||window.AIQUEST_TEACHER_SAFE_V532||null;
  const inspector=()=>window.AIQUEST_TEACHER_INSPECTOR_V701||window.AIQUEST_TEACHER_SESSION_DETAIL_UX_V697||null;
  const arr=v=>Array.isArray(v)?v:[];
  const obj=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
  const parse=v=>{if(v&&typeof v==='object')return v;if(typeof v==='string'){try{return JSON.parse(v)}catch(e){return {}}}return {}};
  const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const canon=v=>{const x=String(v||'').toLowerCase().trim().replace(/[\s_\-:]+/g,'');const m={m1:'s1',session1:'s1',mission1:'s1',m2:'s2',session2:'s2',mission2:'s2',m3:'s3',session3:'s3',mission3:'s3',boss1:'b1',m4:'s4',session4:'s4',mission4:'s4',m5:'s5',session5:'s5',mission5:'s5',m6:'s6',session6:'s6',mission6:'s6',boss2:'b2',m7:'s7',session7:'s7',mission7:'s7',m8:'s8',session8:'s8',mission8:'s8',m9:'s9',session9:'s9',mission9:'s9',boss3:'b3',m10:'s10',session10:'s10',mission10:'s10',m11:'s11',session11:'s11',mission11:'s11',m12:'s12',session12:'s12',mission12:'s12',boss4:'b4',m13:'s13',session13:'s13',mission13:'s13',m14:'s14',session14:'s14',mission14:'s14',m15:'s15',session15:'s15',mission15:'s15',boss5:'b5'};return m[x]||x;};
  const students=()=>arr(runtime()?.state?.students);
  const attempts=s=>arr(s?.attempts).filter(a=>a&&Number.isFinite(Number(a.score)));
  const findStudent=id=>students().find(s=>String(s.studentId)===String(id))||null;
  function meta(a){const e=parse(a?.extraJson||a?.extra),raw=obj(e.raw||a?.raw),nested=parse(raw.extraJson||e.extraJson);return Object.assign({},e,nested,obj(raw.extraJson));}
  function sessionAttempt(s,id){return attempts(s).filter(a=>canon(a.sessionId||a.missionId)===id).sort((a,b)=>Date.parse(b.serverTs||b.clientTs||b.timestamp||0)-Date.parse(a.serverTs||a.clientTs||a.timestamp||0))[0]||null;}

  let opening=false;
  function openInspector(studentId,session,tab='overview'){
    if(opening)return;
    const s=findStudent(studentId),api=inspector();if(!s||!api?.open)return;
    opening=true;
    try{api.open(s);}catch(e){opening=false;console.error('[AIQuest] Inspector open failed',e);return;}
    const finish=()=>{opening=false;};
    setTimeout(()=>{
      const sel=document.getElementById('aq701Session');
      if(sel&&[...sel.options].some(o=>o.value===session)&&sel.value!==session){sel.value=session;sel.dispatchEvent(new Event('change',{bubbles:true}));}
      setTimeout(()=>{const btn=document.querySelector(`#aqInspectorV701 [data-tab="${tab}"]`);if(btn&&!btn.classList.contains('active'))btn.click();finish();},120);
    },120);
    setTimeout(finish,1200);
  }

  function selectedSubject(){const v=document.getElementById('aq710Student')?.value||'all';return v==='all'?null:findStudent(v);}
  function decorateHeatmap(){
    const table=document.querySelector('#aqLearningAnalyticsV710 .aq710-heatwrap table');if(!table)return;
    const heads=[...table.querySelectorAll('thead th')].slice(1).map(th=>canon(th.textContent));
    [...table.querySelectorAll('tbody tr')].forEach(tr=>{const id=String(tr.querySelector('td b')?.textContent||'').trim();[...tr.querySelectorAll('td')].slice(1).forEach((td,i)=>{const sid=heads[i];if(!id||!sid||td.textContent.trim()==='—')return;td.classList.add('aq716-drill');td.dataset.studentId=id;td.dataset.session=sid;td.tabIndex=0;td.title=`เปิด ${TITLES[sid]||sid.toUpperCase()} ของ ${id}`;});});
  }
  function termsForStudent(s){const out=[];attempts(s).forEach(a=>{const x=meta(a);if(x.selectedCaseSkill)out.push(String(x.selectedCaseSkill));if(x.selectedCaseTrap)out.push(String(x.selectedCaseTrap));arr(obj(x.replayAudit).cards).forEach(c=>{if(c.concept)out.push(String(c.concept));if(c.trap)out.push(String(c.trap));});});return out.map(x=>x.toLowerCase());}
  let activeFilter='';
  function filterStudents(term){
    activeFilter=String(term||'').trim();const box=document.getElementById('studentsBox');if(!box)return;
    const rows=[...box.querySelectorAll('tbody tr')];let shown=0;
    rows.forEach(row=>{const id=String(row.querySelector('td b')?.textContent||'').trim(),s=findStudent(id),hit=!activeFilter||termsForStudent(s||{}).some(x=>x.includes(activeFilter.toLowerCase()));row.style.display=hit?'':'none';if(hit)shown++;});
    let bar=document.getElementById('aq716FilterBar');if(!bar){bar=document.createElement('div');bar.id='aq716FilterBar';bar.className='aq716-filterbar';box.parentElement?.insertBefore(bar,box);}
    bar.innerHTML=activeFilter?`<b>Cross-filter:</b> ${esc(activeFilter)} • พบ ${shown} คน <button type="button" data-aq716-clear>ล้างตัวกรอง</button>`:'';bar.style.display=activeFilter?'flex':'none';
    box.scrollIntoView({behavior:'smooth',block:'start'});
  }
  function decorateCrossFilters(){document.querySelectorAll('#aqLearningAnalyticsV710 .aq710-card').forEach(card=>{if(!/Weak Concept|Trap Analytics/i.test(card.querySelector('h3')?.textContent||''))return;card.querySelectorAll('.aq710-barrow').forEach(row=>{const term=String(row.querySelector('b')?.textContent||'').trim();if(!term)return;row.classList.add('aq716-cross');row.dataset.term=term;row.tabIndex=0;row.title=`กรองนักศึกษาที่เกี่ยวข้องกับ ${term}`;});});}
  function coverageState(a){if(!a)return {reflection:'none',replay:'none',challenge:'none'};const x=meta(a),audit=obj(x.challengeAudit),cards=arr(obj(x.replayAudit).cards),refs=[a.reflection1,a.reflection2,a.reflection3].filter(v=>String(v||'').trim());return {reflection:refs.length===3?'full':refs.length?'partial':'none',replay:cards.length>=15?'full':cards.length?'partial':'none',challenge:(audit.version||audit.uniqueCorrect||audit.uniqueDistractors)?'full':Object.keys(audit).length?'partial':'none'};}
  const icon=s=>s==='full'?'●':s==='partial'?'◐':'○';
  const label=s=>s==='full'?'ครบ':s==='partial'?'บางส่วน':'ไม่มี';
  function coverageHTML(){const subject=selectedSubject(),rows=subject?[subject]:students().filter(s=>attempts(s).length);if(!rows.length)return '<div class="aq716-empty">ยังไม่มีข้อมูลหลักฐาน</div>';return `<div class="aq716-covwrap"><table><thead><tr><th>Student</th>${ORDER.map(id=>`<th>${TITLES[id]}</th>`).join('')}</tr></thead><tbody>${rows.map(s=>`<tr><td><b>${esc(s.studentId)}</b><small>${esc(s.studentName||'')}</small></td>${ORDER.map(id=>{const a=sessionAttempt(s,id),c=coverageState(a);if(!a)return '<td class="aq716-no">—</td>';return `<td class="aq716-pack" data-student="${esc(s.studentId)}" data-session="${id}"><button data-open-tab="reflection" class="${c.reflection}" title="Reflection: ${label(c.reflection)}">R ${icon(c.reflection)}</button><button data-open-tab="replay" class="${c.replay}" title="Replay: ${label(c.replay)}">P ${icon(c.replay)}</button><button data-open-tab="overview" class="${c.challenge}" title="Evidence: ${label(c.challenge)}">E ${icon(c.challenge)}</button></td>`;}).join('')}</tr>`).join('')}</tbody></table></div>`;}
  let coverageSig='';
  function renderCoverage(){
    const suite=document.getElementById('aqLearningAnalyticsV710');if(!suite||document.getElementById('aqInspectorV701'))return;
    const subject=selectedSubject(),sig=(subject?.studentId||'all')+'|'+students().map(s=>`${s.studentId}:${attempts(s).length}`).join(',');if(sig===coverageSig&&document.getElementById('aqEvidenceCoverageV716'))return;coverageSig=sig;
    let sec=document.getElementById('aqEvidenceCoverageV716');if(!sec){sec=document.createElement('section');sec.id='aqEvidenceCoverageV716';sec.className='aq710-card aq716-coverage';suite.appendChild(sec);}sec.innerHTML=`<div class="aq716-covhead"><div><h3>11. Evidence Coverage Matrix</h3><p>R = Reflection • P = Replay Audit • E = Challenge Evidence</p></div><span>● ครบ • ◐ บางส่วน • ○ ไม่มี</span></div>${coverageHTML()}`;
  }
  function enhance(){if(document.getElementById('aqInspectorV701'))return;decorateHeatmap();decorateCrossFilters();renderCoverage();}

  function onClick(e){
    const cell=e.target.closest('.aq716-drill');if(cell){e.preventDefault();e.stopPropagation();openInspector(cell.dataset.studentId,cell.dataset.session,'overview');return;}
    const cross=e.target.closest('.aq716-cross');if(cross){e.preventDefault();filterStudents(cross.dataset.term);return;}
    const clear=e.target.closest('[data-aq716-clear]');if(clear){e.preventDefault();filterStudents('');return;}
    const b=e.target.closest('#aqEvidenceCoverageV716 [data-open-tab]');if(b){e.preventDefault();e.stopPropagation();const td=b.closest('[data-student][data-session]');if(td)openInspector(td.dataset.student,td.dataset.session,b.dataset.openTab);}
  }
  function onKey(e){if(e.key!=='Enter'&&e.key!==' ')return;const t=e.target;if(t.classList?.contains('aq716-drill')){e.preventDefault();openInspector(t.dataset.studentId,t.dataset.session,'overview');}else if(t.classList?.contains('aq716-cross')){e.preventDefault();filterStudents(t.dataset.term);}}
  function boot(){
    const style=document.createElement('style');style.textContent=`.aq716-drill{cursor:pointer}.aq716-drill:hover,.aq716-drill:focus{box-shadow:inset 0 0 0 2px #38bdf8}.aq716-cross{cursor:pointer;border-radius:10px;padding:5px}.aq716-cross:hover{background:rgba(56,189,248,.08)}.aq716-filterbar{display:none;align-items:center;gap:8px;flex-wrap:wrap;margin:10px 0;padding:10px 12px;border:1px solid rgba(56,189,248,.35);border-radius:13px;background:rgba(56,189,248,.08)}.aq716-filterbar button{margin-left:auto}.aq716-coverage{grid-column:1/-1}.aq716-covhead{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}.aq716-covhead p{margin:5px 0;color:#9fb2cc}.aq716-covwrap{overflow:auto;margin-top:12px}.aq716-covwrap table{min-width:1180px}.aq716-covwrap th,.aq716-covwrap td{text-align:center;padding:8px}.aq716-covwrap td:first-child{text-align:left;position:sticky;left:0;background:#111c31;z-index:2}.aq716-covwrap small{display:block;color:#9fb2cc}.aq716-pack{white-space:nowrap}.aq716-pack button{width:28px;height:28px;padding:0;margin:1px;border-radius:8px;border:1px solid rgba(148,163,184,.25);background:#17304d;color:#fff;cursor:pointer;font-size:10px;font-weight:900}.aq716-pack button.full{color:#bbf7d0;border-color:#34d399}.aq716-pack button.partial{color:#fde68a;border-color:#fbbf24}.aq716-pack button.none{color:#94a3b8}.aq716-no{color:#64748b}`;document.head.appendChild(style);
    document.addEventListener('click',onClick,true);document.addEventListener('keydown',onKey,true);
    setInterval(enhance,1200);setTimeout(enhance,400);
    console.log('[AIQuest] Analytics Actions Safe active',VERSION);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.AIQUEST_TEACHER_ANALYTICS_ACTIONS_V716={VERSION,enhance,openInspector,filterStudents,renderCoverage};
})();