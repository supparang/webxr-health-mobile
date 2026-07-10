/* CSAI2102 Teacher Console — Data Accuracy v6.9.8
   - separates Profiles / Active learners / Not started / Attempts
   - Avg Latest excludes learners without a real scored attempt
   - conservative test-data toggle (short synthetic IDs / explicit test markers)
   - disables View when no attempt exists
   - preserves v697 detail UX and challenge-v711 adapter
*/
(()=>{'use strict';
  if(window.__AIQUEST_TEACHER_DATA_ACCURACY_V698__)return;
  window.__AIQUEST_TEACHER_DATA_ACCURACY_V698__=true;
  const VERSION='v6.9.8';
  const runtime=()=>window.AIQUEST_TEACHER_SAFE_V533||window.AIQUEST_TEACHER_SAFE_V532||null;
  const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const num=v=>{const n=Number(v);return Number.isFinite(n)?n:NaN;};
  const attemptsOf=s=>Array.isArray(s?.attempts)?s.attempts.filter(a=>a&&typeof a==='object'):[];
  const scoredAttempts=s=>attemptsOf(s).filter(a=>Number.isFinite(num(a.score)));
  const latestScored=s=>scoredAttempts(s).slice().sort((a,b)=>stamp(b)-stamp(a))[0]||null;
  const stamp=a=>Date.parse(String(a?.serverTs||a?.clientTs||a?.timestamp||''))||0;
  const isActive=s=>scoredAttempts(s).length>0;
  function isTestStudent(s){
    const id=String(s?.studentId||'').trim();
    const name=String(s?.studentName||'').trim().toLowerCase();
    const explicit=s?.isTest===true||attemptsOf(s).some(a=>a?.isTest===true||String(a?.runMode||'').toLowerCase()==='practice');
    const syntheticId=/^\d{1,5}$/.test(id);
    const marker=/(^|\s)(test|demo|ทดลอง|ทดสอบ)(\s|$)/i.test(name);
    return explicit||syntheticId||marker;
  }
  const state={hideTest:true,rendering:false};
  function ensureControls(){
    const filters=document.querySelector('.filters');if(!filters||document.getElementById('aqHideTestV698'))return;
    filters.style.gridTemplateColumns='minmax(240px,1fr) 220px auto';
    const label=document.createElement('label');label.id='aqHideTestWrapV698';label.style.cssText='display:flex;align-items:center;gap:8px;padding:9px 12px;border:1px solid rgba(148,163,184,.22);border-radius:13px;background:#1e293b;color:#e8f1ff;font-weight:750;white-space:nowrap';
    label.innerHTML='<input id="aqHideTestV698" type="checkbox" checked style="width:auto;accent-color:#38bdf8"> ซ่อนข้อมูลทดสอบ';
    filters.appendChild(label);
    document.getElementById('aqHideTestV698').onchange=e=>{state.hideTest=!!e.target.checked;renderAll();};
    const select=document.getElementById('studentFilter');if(select&&!select.querySelector('option[value="active"]')){
      select.insertAdjacentHTML('beforeend','<option value="active">มี Attempt</option><option value="notstarted">ยังไม่เริ่ม</option>');
    }
  }
  function ensureMetrics(){
    const grid=document.querySelector('main.wrap > section.grid.cols3');if(!grid)return;
    grid.style.gridTemplateColumns='repeat(4,minmax(150px,1fr))';
    const cards=[...grid.children];
    if(cards[0]){cards[0].querySelector('span').textContent='Profiles';cards[0].querySelector('b').id='mProfilesV698';}
    if(cards[1]){cards[1].querySelector('span').textContent='Active learners';cards[1].querySelector('b').id='mActiveV698';}
    if(cards[2]){cards[2].querySelector('span').textContent='Avg Latest';cards[2].querySelector('b').id='mAvgV698';}
    if(!document.getElementById('mAttemptsV698')){
      const card=document.createElement('div');card.className='metric';card.innerHTML='<span>Attempts</span><b id="mAttemptsV698">—</b>';grid.appendChild(card);
    }
    if(!document.getElementById('aqDataSummaryV698')){
      const p=document.createElement('p');p.id='aqDataSummaryV698';p.className='muted';p.style.margin='8px 2px 0';grid.insertAdjacentElement('afterend',p);
    }
    let style=document.getElementById('aqDataStyleV698');if(!style){style=document.createElement('style');style.id='aqDataStyleV698';style.textContent='@media(max-width:900px){main.wrap>section.grid.cols3{grid-template-columns:repeat(2,minmax(140px,1fr))!important}}@media(max-width:520px){main.wrap>section.grid.cols3{grid-template-columns:1fr 1fr!important}.aq-no-attempt{font-size:12px}}#studentsBox button[disabled]{opacity:.45;cursor:not-allowed;background:#334155!important}.aq-test-chip{display:inline-flex;margin-left:6px;padding:2px 6px;border-radius:999px;border:1px solid rgba(251,191,36,.35);color:#fde68a;font-size:10px;font-weight:800}.aq-no-attempt{color:#94a3b8;font-weight:750}';document.head.appendChild(style);}
  }
  function visibleStudents(){
    const app=runtime(),students=Array.isArray(app?.state?.students)?app.state.students:[];
    const q=String(document.getElementById('studentSearch')?.value||'').toLowerCase().trim();
    const f=String(document.getElementById('studentFilter')?.value||'all');
    return students.map((s,index)=>({s,index})).filter(({s})=>{
      if(state.hideTest&&isTestStudent(s))return false;
      const active=isActive(s),latest=latestScored(s);
      const focus=[...(Array.isArray(s.risks)?s.risks:[]),...(Array.isArray(s.misconceptions)?s.misconceptions.map(x=>x?.key||x?.label||x):[])].join(' ');
      const hay=`${s.studentId||''} ${s.studentName||''} ${s.section||''} ${focus}`.toLowerCase();
      if(q&&!hay.includes(q))return false;
      if(f==='active'&&!active)return false;
      if(f==='notstarted'&&active)return false;
      if(f==='review'&&active&&Number(latest?.score)>=70&&!(Array.isArray(s.risks)&&s.risks.length))return false;
      if(f==='mastery'&&!(s.mastered===true||Number(s.bestScore)>=85))return false;
      return true;
    });
  }
  function statusPill(s,latest){
    if(!latest)return '<span class="pill warn">ยังไม่เริ่ม</span>';
    const score=Number(latest.score)||0,master=s.mastered===true||Number(s.bestScore)>=85;
    return `<span class="pill ${master?'good':score>=60?'blue':'warn'}">${master?'Mastery':score>=60?'Passed':'Review'}</span>`;
  }
  function renderMetrics(){
    const app=runtime(),all=Array.isArray(app?.state?.students)?app.state.students:[];
    const cohort=state.hideTest?all.filter(s=>!isTestStudent(s)):all.slice();
    const active=cohort.filter(isActive),notStarted=cohort.length-active.length;
    const latestScores=active.map(s=>Number(latestScored(s)?.score)).filter(Number.isFinite);
    const attempts=cohort.reduce((n,s)=>n+scoredAttempts(s).length,0);
    const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
    set('mProfilesV698',cohort.length||'0');set('mActiveV698',active.length||'0');set('mAvgV698',latestScores.length?Math.round(latestScores.reduce((a,b)=>a+b,0)/latestScores.length):'—');set('mAttemptsV698',attempts||'0');
    const p=document.getElementById('aqDataSummaryV698');if(p)p.innerHTML=`Active ${active.length}/${cohort.length} • ยังไม่เริ่ม ${notStarted} • ค่าเฉลี่ยคำนวณจากผู้มีคะแนนจริง ${latestScores.length} คน${state.hideTest?' • ซ่อนข้อมูลทดสอบแล้ว':''}`;
  }
  function renderTable(){
    const box=document.getElementById('studentsBox');if(!box)return;
    const rows=visibleStudents();
    if(!rows.length){box.innerHTML='<div class="loading">ยังไม่พบข้อมูลตามเงื่อนไข</div>';return;}
    const body=rows.map(({s,index})=>{
      const latest=latestScored(s),active=!!latest,test=isTestStudent(s),attemptCount=scoredAttempts(s).length;
      const focus=(Array.isArray(s.risks)&&s.risks[0])||(Array.isArray(s.misconceptions)&&s.misconceptions[0]&&(s.misconceptions[0].key||s.misconceptions[0].label||s.misconceptions[0]))||(active?'—':'ยังไม่ส่ง');
      return `<tr><td><b>${esc(s.studentId||'-')}</b>${test?'<span class="aq-test-chip">TEST</span>':''}<br><span class="muted">${esc(s.studentName||'')} • ${esc(s.section||'101')}</span></td><td>${attemptCount}</td><td>${active?esc(s.bestScore||Math.max(...scoredAttempts(s).map(a=>Number(a.score)||0))):'—'}</td><td>${active?esc(latest.score):'—'}</td><td>${statusPill(s,latest)}</td><td>${esc(focus)}</td><td>${active?`<button class="btn detailBtn" data-index="${index}">View</button>`:'<button class="btn" disabled aria-disabled="true">ยังไม่มีข้อมูล</button>'}</td></tr>`;
    }).join('');
    box.innerHTML=`<div class="table-wrap"><table><thead><tr><th>Student</th><th>Attempts</th><th>Best</th><th>Latest</th><th>Status</th><th>Review focus</th><th></th></tr></thead><tbody>${body}</tbody></table></div>`;
  }
  function renderAll(){
    if(state.rendering)return;state.rendering=true;
    try{ensureControls();ensureMetrics();renderMetrics();renderTable();}finally{state.rendering=false;}
  }
  function boot(){
    ensureControls();ensureMetrics();
    const search=document.getElementById('studentSearch'),filter=document.getElementById('studentFilter');
    if(search)search.addEventListener('input',renderAll);if(filter)filter.addEventListener('change',renderAll);
    const refresh=document.getElementById('refreshBtn');if(refresh)refresh.addEventListener('click',()=>setTimeout(renderAll,800));
    let tries=0;const timer=setInterval(()=>{tries++;const app=runtime();if(app?.state&&Array.isArray(app.state.students)){renderAll();if(app.state.students.length||tries>30)clearInterval(timer);}if(tries>60)clearInterval(timer);},350);
    const box=document.getElementById('studentsBox');if(box){const mo=new MutationObserver(()=>{if(!state.rendering)setTimeout(renderAll,0);});mo.observe(box,{childList:true,subtree:false});}
    console.log('[AIQuest] Teacher data accuracy active',VERSION);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.AIQUEST_TEACHER_DATA_ACCURACY_V698={VERSION,isTestStudent,isActive,latestScored,renderAll};
})();