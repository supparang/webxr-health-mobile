
(function(){
  'use strict';

  const VERSION = 'v3.4.8-phase1-classroom-ready-final';

  function safeText(el){
    return String((el && (el.innerText || el.textContent)) || '').trim();
  }

  function isTeacherMode(){
    try{
      const qs = new URLSearchParams(location.search);
      return qs.get('teacher') === '1' || /Teacher Mode/i.test(document.body.innerText || '');
    }catch(e){
      return false;
    }
  }

  function phasePassed(id){
    try{
      return !!(state.completed[id] || state.stars[id] || state.mastered[id] || Number(state.bestScore[id] || 0) >= 60);
    }catch(e){
      return false;
    }
  }

  function phase1Ready(){
    return ['m1','m2','b1','m3','m4','m5','b2'].every(phasePassed);
  }

  function hideFloatingEntryInTeacher(){
    if(!isTeacherMode()) return;
    ['aiquestNativeTopBar','roadmapClickFixPanel','roadmapDirectEntryPanel'].forEach(id=>{
      const el=document.getElementById(id);
      if(el) el.style.display='none';
    });
  }

  function compactFloatingEntryInStudent(){
    if(isTeacherMode()) return;
    const bar=document.getElementById('aiquestNativeTopBar');
    if(!bar) return;
    bar.style.opacity='.82';
    bar.style.transform='translateX(-50%) scale(.88)';
    bar.style.bottom='10px';
  }

  function addPhase1ReadyBadge(){
    const existing=document.getElementById('aiquestPhase1ReadyBadge');
    if(existing) existing.remove();

    const header=document.querySelector('.topbar, header, .hero, .app-header') || document.querySelector('.card') || document.body;
    if(!header) return;

    const badge=document.createElement('div');
    badge.id='aiquestPhase1ReadyBadge';
    badge.style.display='inline-flex';
    badge.style.alignItems='center';
    badge.style.gap='8px';
    badge.style.margin='8px 0 0';
    badge.style.padding='8px 12px';
    badge.style.borderRadius='999px';
    badge.style.fontWeight='900';
    badge.style.fontSize='13px';
    badge.style.border='1px solid rgba(34,211,238,.35)';
    badge.style.background=phase1Ready() ? 'rgba(16,185,129,.18)' : 'rgba(148,163,184,.14)';
    badge.style.color=phase1Ready() ? '#bbf7d0' : '#cbd5e1';
    badge.textContent=phase1Ready()
      ? '✓ Phase 1 Ready: S1–S5 + B1–B2 พร้อมใช้งาน'
      : 'Phase 1: S1–S5 + B1–B2 / S6 เปิดใน Phase 2';

    try{
      const subtitle=document.querySelector('.subtitle');
      if(subtitle && subtitle.parentElement) subtitle.parentElement.appendChild(badge);
      else header.prepend(badge);
    }catch(e){
      document.body.prepend(badge);
    }
  }

  function addTeacherChecklist(){
    if(!isTeacherMode()) return;

    const old=document.getElementById('phase1TeacherChecklistV330') || document.getElementById('phase1TeacherChecklistV330') || document.getElementById('phase1TeacherChecklistV330');
    if(old) old.remove();

    const prod = Array.from(document.querySelectorAll('section, div, article'))
      .find(el => /Production Classroom Checklist/i.test(safeText(el)));
    const host = prod || document.querySelector('.card') || document.body;

    const box=document.createElement('div');
    box.id='phase1TeacherChecklistV330';
    box.style.marginTop='14px';
    box.style.padding='14px';
    box.style.borderRadius='18px';
    box.style.border='1px solid rgba(34,211,238,.28)';
    box.style.background='rgba(15,23,42,.62)';
    box.innerHTML = `
      <h3 style="margin:0 0 8px">Phase 1 Classroom Ready Checklist</h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <span class="pill good">✓ Section 101</span>
        <span class="pill good">✓ S1–S5 Open</span>
        <span class="pill good">✓ B1–B2 Gate</span>
        <span class="pill good">✓ Roadmap Card Entry</span>
        <span class="pill good">✓ Submit / Sheets</span>
        <span class="pill good">✓ Accuracy: correct/total</span>
        <span class="pill warn">S6 เปิดใน Phase 2</span>
      </div>
      <p class="muted" style="margin:10px 0 0;font-size:12px">
        ใช้สำหรับปิดชุด S1–S5 + B1–B2 ก่อนเริ่มพัฒนา S6 Knowledge Base Forge
      </p>
    `;
    host.appendChild(box);
  }

  function labelAccuracySource(){
    const tables=Array.from(document.querySelectorAll('table'));
    tables.forEach(table=>{
      const headers=Array.from(table.querySelectorAll('thead th, tr:first-child th, tr:first-child td'))
        .map(x=>safeText(x).toLowerCase());
      const accIndex=headers.findIndex(x=>x.includes('accuracy') || x.includes('ความถูก'));
      if(accIndex<0) return;
      Array.from(table.querySelectorAll('tbody tr')).forEach(tr=>{
        const cells=Array.from(tr.children);
        if(cells.length<=accIndex) return;
        const cell=cells[accIndex];
        const txt=safeText(cell);
        if(txt && txt !== 'N/A'){
          cell.title='Accuracy คำนวณจาก accuracy field หรือ correct/total ไม่ใช่ Score';
        }else if(txt==='N/A'){
          cell.title='ยังไม่มี correct/total สำหรับ attempt นี้';
        }
      });
    });
  }

  function dedupeLatestReflection(){
    const cards=Array.from(document.querySelectorAll('section, div, article'))
      .filter(el=>/Latest Reflection/i.test(safeText(el)));
    cards.forEach(card=>{
      if(card.__phase1DedupeV327) return;
      const lines=safeText(card).split(/\n+/).map(x=>x.trim()).filter(Boolean);
      const seen=new Set();
      let duplicateCount=0;
      lines.forEach(line=>{
        const key=line.replace(/^\d+\)\s*/,'').toLowerCase();
        if(seen.has(key)) duplicateCount++;
        seen.add(key);
      });
      if(duplicateCount>=2){
        const note=document.createElement('div');
        note.className='muted';
        note.style.marginTop='8px';
        note.style.padding='8px 10px';
        note.style.borderRadius='12px';
        note.style.background='rgba(234,179,8,.10)';
        note.style.border='1px solid rgba(234,179,8,.25)';
        note.textContent='หมายเหตุ: reflection รอบเก่าบางรายการซ้ำ เพราะบันทึกจาก prompt เดิมก่อน patch ล่าสุด รอบใหม่จะค่อย ๆ แยกตามคำถามจริงมากขึ้น';
        card.appendChild(note);
      }
      card.__phase1DedupeV327=true;
    });
  }

  function refresh(){
    hideFloatingEntryInTeacher();
    compactFloatingEntryInStudent();
    addPhase1ReadyBadge();
    /* v3.4.8 safe restore: no extra checklist injection */
    labelAccuracySource();
    dedupeLatestReflection();
  }

  window.AIQUEST_PHASE1_READY_CLEANUP = {
    version: VERSION,
    refresh,
    phase1Ready,
    hideFloatingEntryInTeacher
  };

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', () => setTimeout(refresh,300));
  }else{
    setTimeout(refresh,300);
  }

  if(!window.__AIQUEST_PHASE1_READY_OBSERVER_V328){
    window.__AIQUEST_PHASE1_READY_OBSERVER_V328 = new MutationObserver(() => {
      clearTimeout(window.__AIQUEST_PHASE1_READY_TIMER_V328);
      window.__AIQUEST_PHASE1_READY_TIMER_V328 = setTimeout(refresh,180);
    });
    window.__AIQUEST_PHASE1_READY_OBSERVER_V328.observe(document.documentElement, {childList:true, subtree:true, characterData:true});
  }

  console.log('[AIQuest] '+VERSION+' loaded', window.AIQUEST_PHASE1_READY_CLEANUP);
})();
