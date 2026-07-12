/* CSAI2102 Teacher Console — Analytics Actions v7.1.5
   1) Heatmap drill-down to Teacher Inspector
   2) Cross-filter from Weak Concept / Trap Analytics to student table
   3) Evidence Coverage Matrix with Reflection / Replay / Challenge drill-down
*/
(()=>{'use strict';
  if(window.__AIQUEST_TEACHER_ANALYTICS_ACTIONS_V715__)return;
  window.__AIQUEST_TEACHER_ANALYTICS_ACTIONS_V715__=true;
  const VERSION='v7.1.5';
  const ORDER=['s1','s2','s3','b1','s4','s5','s6','b2','s7','s8','s9','b3','s10','s11','s12','b4','s13','s14','s15','b5'];
  const TITLES={s1:'S1',s2:'S2',s3:'S3',b1:'B1',s4:'S4',s5:'S5',s6:'S6',b2:'B2',s7:'S7',s8:'S8',s9:'S9',b3:'B3',s10:'S10',s11:'S11',s12:'S12',b4:'B4',s13:'S13',s14:'S14',s15:'S15',b5:'B5'};
  const runtime=()=>window.AIQUEST_TEACHER_SAFE_V533||window.AIQUEST_TEACHER_SAFE_V532||null;
  const inspector=()=>window.AIQUEST_TEACHER_INSPECTOR_V701||window.AIQUEST_TEACHER_SESSION_DETAIL_UX_V697||null;
  const arr=v=>Array.isArray(v)?v:[];
  const obj=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
  const parse=v=>{if(v&&typeof v==='object')return v;if(typeof v==='string'){try{return JSON.parse(v)}catch(e){return {}}}return {}};
  const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const canon=v=>{const x=String(v||'').toLowerCase().trim().replace(/[\s_\-:]+/g,'');const m={m1:'s1',session1:'s1',mission1:'s1',m2:'s2',session2:'s2',mission2:'s2',m3:'s3',session3:'s3',mission3:'s3',boss1:'b1',m4:'s4',session4:'s4',mission4:'s4',m5:'s5',session5:'s5',mission5:'s5',m6:'s6',session6:'s6',mission6:'s6',boss2:'b2',m7:'s7',session7:'s7',mission7:'s7',m8:'s8',session8:'s8',mission8:'s8',m9:'s9',session9:'s9',mission9:'s9',boss3:'b3',m10:'s10',session10:'s10',mission10:'s10',m11:'s11',session11:'s11',mission11:'s11',m12:'s12',session12:'s12',mission12:'s12',boss4:'b4',m13:'s13',session13:'s13',mission13:'s13',m14:'s14',session14:'s14',mission14:'s14',m15:'s15',session15:'s15',mission15:'s15',boss5:'b5'};return m[x]||x;};
  function students(){return arr(runtime()?.state?.students);}
  function meta(a){const e=parse(a?.extraJson||a?.extra),raw=obj(e.raw||a?.raw),nested=parse(raw.extraJson||e.extraJson);return Object.assign({},e,nested,obj(raw.extraJson));}
  function attempts(s){return arr(s?.attempts).filter(a=>a&&Number.isFinite(Number(a.score)));}
  function findStudent(id){return students().find(s=>String(s.studentId)===String(id))||null;}
  function sessionAttempt(s,id){return attempts(s).filter(a=>canon(a.sessionId||a.missionId)===id).sort((a,b)=>Date.parse(b.serverTs||b.clientTs||b.timestamp||0)-Date.parse(a.serverTs||a.clientTs||a.timestamp||0))[0]||null;}
  function openInspector(studentId,session,tab='overview'){
    const s=findStudent(studentId),api=inspector();if(!s||!api?.open)return;
    api.open(s);
    setTimeout(()=>{
      const sel=document.getElementById('aq701Session');
      if(sel&&[...sel.options].some(o=>o.value===session)){sel.value=session;sel.dispatchEvent(new Event('change',{bubbles:true}));}
      setTimeout(()=>{const btn=document.querySelector(`#aqInspectorV701 [data-tab="${tab}"]`);if(btn)btn.click();},80);
    },80);
  }
  function selectedSubject(){const v=document.getElementById('aq710Student')?.value||'all';return v==='all'?null:findStudent(v);}
  function decorateHeatmap(){
    const host=document.getElementById('aqLearningAnalyticsV710');const table=host?.querySelector('.aq710-heatwrap table');if(!table)return;
    const heads=[...table.querySelectorAll('thead th')].slice(1).map(th=>String(th.textContent||'').trim().toLowerCase());
    [...table.querySelectorAll('tbody tr')].forEach(tr=>{
      const id=String(tr.querySelector('td b')?.textContent||'').trim();
      [...tr.querySelectorAll('td')].slice(1).forEach((td,i)=>{
        const sid=canon(heads[i]);if(!id||!sid||td.textContent.trim()==='—')return;
        td.classList.add('aq715-drill');td.dataset.studentId=id;td.dataset.session=sid;td.setAttribute('role','button');td.tabIndex=0;
        td.title=`เปิด ${TITLES[sid]||sid.toUpperCase()} ของ ${id} ใน Teacher Inspector`;
      });
    });
  }
  function termsForStudent(s){
    const out=[];attempts(s).forEach(a=>{const x=meta(a);if(x.selectedCaseSkill)out.push(String(x.selectedCaseSkill));if(x.selectedCaseTrap)out.push(String(x.selectedCaseTrap));arr(obj(x.replayAudit).cards).forEach(c=>{if(c.concept)out.push(String(c.concept));if(c.trap)out.push(String(c.trap));});});
    return out.map(x=>x.toLowerCase());
  }
  let activeFilter='';
  function filterStudents(term){
    activeFilter=String(term||'').trim();const box=document.getElementById('studentsBox');if(!box)return;
    const rows=[...box.querySelectorAll('tbody tr')];let shown=0;
    rows.forEach(row=>{const id=String(row.querySelector('td b')?.textContent||'').trim(),s=findStudent(id),hit=!activeFilter||termsForStudent(s||{}).some(x=>x.includes(activeFilter.toLowerCase()));row.style.display=hit?'':'none';if(hit)shown++;});
    let bar=document.getElementById('aq715FilterBar');
    if(!bar){bar=document.createElement('div');bar.id='aq715FilterBar';bar.className='aq715-filterbar';box.parentElement?.insertBefore(bar,box);}
    bar.innerHTML=activeFilter?`<b>Cross-filter:</b> ${esc(activeFilter)} • พบ ${shown} คน <button type="button" id="aq715ClearFilter">ล้างตัวกรอง</button>`:'';
    bar.style.display=activeFilter?'flex':'none';document.getElementById('aq715ClearFilter')?.addEventListener('click',()=>filterStudents(''));
    box.scrollIntoView({behavior:'smooth',block:'start'});
  }
  function decorateCrossFilters(){
    const host=document.getElementById('aqLearningAnalyticsV710');if(!host)return;
    [...host.querySelectorAll('.aq710-card')].forEach(card=>{
      const title=String(card.querySelector('h3')?.textContent||'');if(!/Weak Concept|Trap Analytics/i.test(title))return;
      [...card.querySelectorAll('.aq710-barrow')].forEach(row=>{const term=String(row.querySelector('b')?.textContent||'').trim();if(!term)return;row.classList.add('aq715-cross');row.dataset.term=term;row.title=`กรองนักศึกษาที่เกี่ยวข้องกับ ${term}`;row.tabIndex=0;});
    });
  }
  function coverageState(a){
    if(!a)return {reflection:'none',replay:'none',challenge:'none'};
    const x=meta(a),audit=obj(x.challengeAudit),cards=arr(obj(x.replayAudit).cards);
    const reflections=[a.reflection1,a.reflection2,a.reflection3].filter(v=>String(v||'').trim());
    return {
      reflection:reflections.length===3?'full':reflections.length?'partial':'none',
      replay:cards.length>=15?'full':cards.length?'partial':'none',
      challenge:(audit.version||audit.uniqueCorrect||audit.uniqueDistractors)?'full':Object.keys(audit).length?'partial':'none'
    };
  }
  function icon(state){return state==='full'?'●':state==='partial'?'◐':'○';}
  function label(state){return state==='full'?'ครบ':state==='partial'?'บางส่วน':'ไม่มี';}
  function coverageMatrix(){
    const subject=selectedSubject(),rows=subject?[subject]:students().filter(s=>attempts(s).length);if(!rows.length)return '<div class="aq715-empty">ยังไม่มีข้อมูลหลักฐาน</div>';
    return `<div class="aq715-covwrap"><table><thead><tr><th>Student</th>${ORDER.map(id=>`<th>${TITLES[id]}</th>`).join('')}</tr></thead><tbody>${rows.map(s=>`<tr><td><b>${esc(s.studentId)}</b><small>${esc(s.studentName||'')}</small></td>${ORDER.map(id=>{const a=sessionAttempt(s,id),c=coverageState(a);if(!a)return '<td class="aq715-no">—</td>';return `<td class="aq715-pack" data-student="${esc(s.studentId)}" data-session="${id}"><button data-open-tab="reflection" class="${c.reflection}" title="Reflection: ${label(c.reflection)}">R ${icon(c.reflection)}</button><button data-open-tab="replay" class="${c.replay}" title="Replay Audit: ${label(c.replay)}">P ${icon(c.replay)}</button><button data-open-tab="overview" class="${c.challenge}" title="Challenge Evidence: ${label(c.challenge)}">E ${icon(c.challenge)}</button></td>`;}).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  function renderCoverage(){
    const suite=document.getElementById('aqLearningAnalyticsV710');if(!suite)return;
    let sec=document.getElementById('aqEvidenceCoverageV715');if(!sec){sec=document.createElement('section');sec.id='aqEvidenceCoverageV715';sec.className='aq710-card aq715-coverage';suite.appendChild(sec);}sec.innerHTML=`<div class="aq715-covhead"><div><h3>11. Evidence Coverage Matrix</h3><p>R = Reflection • P = Replay Audit • E = Challenge Evidence</p></div><span class="aq715-legend"><i class="full"></i>ครบ <i class="partial"></i>บางส่วน <i class="none"></i>ไม่มี</span></div>${coverageMatrix()}`;
  }
  function enhance(){decorateHeatmap();decorateCrossFilters();renderCoverage();}
  function bind(){
    document.addEventListener('click',e=>{
      const cell=e.target.closest('.aq715-drill');if(cell){openInspector(cell.dataset.studentId,cell.dataset.session,'overview');return;}
      const cross=e.target.closest('.aq715-cross');if(cross){filterStudents(cross.dataset.term);return;}
      const b=e.target.closest('#aqEvidenceCoverageV715 [data-open-tab]');if(b){const td=b.closest('[data-student][data-session]');openInspector(td.dataset.student,td.dataset.session,b.dataset.openTab);}
    });
    document.addEventListener('keydown',e=>{if(e.key!=='Enter'&&e.key!==' ')return;const t=e.target;if(t.classList?.contains('aq715-drill')){e.preventDefault();openInspector(t.dataset.studentId,t.dataset.session,'overview');}else if(t.classList?.contains('aq715-cross')){e.preventDefault();filterStudents(t.dataset.term);}});
    document.getElementById('aq710Student')?.addEventListener('change',()=>setTimeout(renderCoverage,0));
  }
  function boot(){
    const style=document.createElement('style');style.textContent=`
      .aq715-drill{cursor:pointer;outline:none}.aq715-drill:hover,.aq715-drill:focus{box-shadow:inset 0 0 0 2px #38bdf8;transform:translateY(-1px)}
      .aq715-cross{cursor:pointer;border-radius:10px;padding:5px}.aq715-cross:hover,.aq715-cross:focus{background:rgba(56,189,248,.08);outline:1px solid rgba(56,189,248,.45)}
      .aq715-filterbar{display:none;align-items:center;gap:8px;flex-wrap:wrap;margin:10px 0;padding:10px 12px;border:1px solid rgba(56,189,248,.35);border-radius:13px;background:rgba(56,189,248,.08)}.aq715-filterbar button{margin-left:auto;border:1px solid rgba(148,163,184,.3);border-radius:9px;padding:6px 9px;background:#17304d;color:#fff;cursor:pointer}
      .aq715-coverage{grid-column:1/-1}.aq715-covhead{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap}.aq715-covhead p{margin:5px 0 0;color:#9fb2cc}.aq715-legend{display:flex;gap:7px;align-items:center;font-size:12px;color:#cbd5e1}.aq715-legend i{width:9px;height:9px;border-radius:50%;display:inline-block}.aq715-legend .full{background:#34d399}.aq715-legend .partial{background:#fbbf24}.aq715-legend .none{background:#64748b}
      .aq715-covwrap{overflow:auto;margin-top:12px}.aq715-covwrap table{min-width:1180px}.aq715-covwrap th,.aq715-covwrap td{padding:8px;text-align:center}.aq715-covwrap td:first-child{text-align:left;position:sticky;left:0;background:#111c31;z-index:2}.aq715-covwrap small{display:block;color:#9fb2cc}.aq715-pack{white-space:nowrap}.aq715-pack button{width:28px;height:28px;padding:0;margin:1px;border-radius:8px;border:1px solid rgba(148,163,184,.25);background:#17304d;color:#fff;cursor:pointer;font-size:10px;font-weight:900}.aq715-pack button.full{border-color:rgba(52,211,153,.55);color:#bbf7d0;background:rgba(52,211,153,.10)}.aq715-pack button.partial{border-color:rgba(251,191,36,.55);color:#fde68a;background:rgba(251,191,36,.10)}.aq715-pack button.none{color:#94a3b8}.aq715-pack button:hover{transform:translateY(-1px);box-shadow:0 0 0 2px rgba(56,189,248,.3)}.aq715-no{color:#64748b}.aq715-empty{padding:16px;color:#9fb2cc}
    `;document.head.appendChild(style);
    bind();let last='';const obs=new MutationObserver(()=>{const host=document.getElementById('aqLearningAnalyticsV710');if(!host)return;const sig=host.textContent.length+'|'+(document.getElementById('aq710Student')?.value||'');if(sig!==last){last=sig;requestAnimationFrame(enhance);}});obs.observe(document.body,{childList:true,subtree:true,characterData:true});
    setTimeout(enhance,400);setInterval(enhance,1800);
    console.log('[AIQuest] Analytics Actions active',VERSION);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.AIQUEST_TEACHER_ANALYTICS_ACTIONS_V715={VERSION,enhance,openInspector,filterStudents,renderCoverage};
})();