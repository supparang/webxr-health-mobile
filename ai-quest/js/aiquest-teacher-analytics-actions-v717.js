/* CSAI2102 Teacher Console — Analytics Actions Stability First v7.1.7
   - no MutationObserver
   - no interval
   - no synthetic Inspector tab click
   - guarded one-shot drill-down and cross-filter
*/
(()=>{'use strict';
  if(window.__AIQUEST_TEACHER_ANALYTICS_ACTIONS_V717__)return;
  window.__AIQUEST_TEACHER_ANALYTICS_ACTIONS_V717__=true;
  const VERSION='v7.1.7';
  const runtime=()=>window.AIQUEST_TEACHER_SAFE_V533||window.AIQUEST_TEACHER_SAFE_V532||null;
  const inspector=()=>window.AIQUEST_TEACHER_INSPECTOR_V701||window.AIQUEST_TEACHER_SESSION_DETAIL_UX_V697||null;
  const arr=v=>Array.isArray(v)?v:[];
  const canon=v=>String(v||'').toLowerCase().trim().replace(/[\s_\-:]+/g,'');
  const students=()=>arr(runtime()?.state?.students);
  const findStudent=id=>students().find(s=>String(s.studentId)===String(id))||null;

  let opening=false;
  function openInspector(studentId,session){
    if(opening)return;
    const student=findStudent(studentId),api=inspector();
    if(!student||!api?.open)return;
    opening=true;
    try{api.open(student);}catch(err){opening=false;console.error('[AIQuest] Inspector open failed',err);return;}
    setTimeout(()=>{
      try{
        const sel=document.getElementById('aq701Session');
        if(sel&&session&&[...sel.options].some(o=>canon(o.value)===canon(session))){
          const option=[...sel.options].find(o=>canon(o.value)===canon(session));
          if(option&&sel.value!==option.value){
            sel.value=option.value;
            sel.dispatchEvent(new Event('change',{bubbles:true}));
          }
        }
      }finally{opening=false;}
    },180);
    setTimeout(()=>{opening=false;},1200);
  }

  function decorateHeatmap(){
    const table=document.querySelector('#aqLearningAnalyticsV710 .aq710-heatwrap table');
    if(!table)return;
    const heads=[...table.querySelectorAll('thead th')].slice(1).map(th=>canon(th.textContent));
    [...table.querySelectorAll('tbody tr')].forEach(tr=>{
      const id=String(tr.querySelector('td b')?.textContent||'').trim();
      [...tr.querySelectorAll('td')].slice(1).forEach((td,i)=>{
        if(!id||!heads[i]||td.textContent.trim()==='—')return;
        td.classList.add('aq717-drill');
        td.dataset.studentId=id;
        td.dataset.session=heads[i];
        td.tabIndex=0;
        td.title='เปิด Session นี้ใน Teacher Inspector';
      });
    });
  }

  function decorateCrossFilters(){
    document.querySelectorAll('#aqLearningAnalyticsV710 .aq710-card').forEach(card=>{
      if(!/Weak Concept|Trap Analytics/i.test(card.querySelector('h3')?.textContent||''))return;
      card.querySelectorAll('.aq710-barrow').forEach(row=>{
        const term=String(row.querySelector('b')?.textContent||'').trim();
        if(!term)return;
        row.classList.add('aq717-cross');
        row.dataset.term=term;
        row.tabIndex=0;
      });
    });
  }

  function termsForStudent(student){
    const out=[];
    arr(student?.attempts).forEach(a=>{
      let x=a?.extraJson||a?.extra||{};
      if(typeof x==='string'){try{x=JSON.parse(x)}catch(_){x={}}}
      if(x?.selectedCaseSkill)out.push(String(x.selectedCaseSkill).toLowerCase());
      if(x?.selectedCaseTrap)out.push(String(x.selectedCaseTrap).toLowerCase());
      arr(x?.replayAudit?.cards).forEach(c=>{if(c?.concept)out.push(String(c.concept).toLowerCase());if(c?.trap)out.push(String(c.trap).toLowerCase());});
    });
    return out;
  }

  function filterStudents(term){
    const box=document.getElementById('studentsBox');if(!box)return;
    const q=String(term||'').trim().toLowerCase();let shown=0;
    [...box.querySelectorAll('tbody tr')].forEach(row=>{
      const id=String(row.querySelector('td b')?.textContent||'').trim();
      const hit=!q||termsForStudent(findStudent(id)||{}).some(x=>x.includes(q));
      row.style.display=hit?'':'none';if(hit)shown++;
    });
    let bar=document.getElementById('aq717FilterBar');
    if(!bar){bar=document.createElement('div');bar.id='aq717FilterBar';bar.className='aq717-filterbar';box.parentElement?.insertBefore(bar,box);}
    bar.innerHTML=q?`<b>Cross-filter:</b> ${String(term).replace(/[<>&]/g,'')} • พบ ${shown} คน <button type="button" data-aq717-clear>ล้างตัวกรอง</button>`:'';
    bar.style.display=q?'flex':'none';
    box.scrollIntoView({behavior:'auto',block:'start'});
  }

  function enhance(){
    if(document.getElementById('aqInspectorV701'))return;
    decorateHeatmap();decorateCrossFilters();
  }

  function onClick(e){
    const cell=e.target.closest('.aq717-drill');
    if(cell){e.preventDefault();e.stopPropagation();openInspector(cell.dataset.studentId,cell.dataset.session);return;}
    const cross=e.target.closest('.aq717-cross');
    if(cross){e.preventDefault();filterStudents(cross.dataset.term);return;}
    if(e.target.closest('[data-aq717-clear]')){e.preventDefault();filterStudents('');}
  }

  function boot(){
    const style=document.createElement('style');
    style.textContent='.aq717-drill{cursor:pointer}.aq717-drill:hover,.aq717-drill:focus{box-shadow:inset 0 0 0 2px #38bdf8}.aq717-cross{cursor:pointer;border-radius:10px;padding:5px}.aq717-cross:hover{background:rgba(56,189,248,.08)}.aq717-filterbar{display:none;align-items:center;gap:8px;flex-wrap:wrap;margin:10px 0;padding:10px 12px;border:1px solid rgba(56,189,248,.35);border-radius:13px;background:rgba(56,189,248,.08)}';
    document.head.appendChild(style);
    document.addEventListener('click',onClick,true);
    [600,2200,5000].forEach(ms=>setTimeout(enhance,ms));
    console.log('[AIQuest] Analytics Actions Stability First active',VERSION);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.AIQUEST_TEACHER_ANALYTICS_ACTIONS_V717={VERSION,enhance,openInspector,filterStudents};
})();