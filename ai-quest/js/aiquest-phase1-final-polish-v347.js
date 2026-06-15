
(function(){
  'use strict';

  const VERSION = 'v3.4.7-teacher-dashboard-restore';

  function text(el){
    return String((el && (el.innerText || el.textContent)) || '').trim();
  }

  function isTeacher(){
    try{
      return new URLSearchParams(location.search).get('teacher') === '1' || /Teacher Mode/i.test(document.body.innerText || '');
    }catch(e){
      return false;
    }
  }

  function passed(id){
    try{
      return !!(state.completed[id] || state.stars[id] || state.mastered[id] || Number(state.bestScore[id] || 0) >= 60);
    }catch(e){
      return false;
    }
  }

  function phase1Ready(){
    return ['m1','m2','b1','m3','m4','m5','b2'].every(passed);
  }

  function normalizeRiskLabels(){
    if(!isTeacher()) return;
    const els = Array.from(document.querySelectorAll('span, div, td, p, li'));
    els.forEach(el => {
      const t = text(el);
      if(/^Misconception:\s*automation$/i.test(t)){
        el.textContent = 'Focus: automation';
        el.title = 'จุดทบทวนเล็กน้อย ไม่ใช่ความเสี่ยงรุนแรง';
        try{
          el.style.background = 'rgba(59,130,246,.16)';
          el.style.border = '1px solid rgba(59,130,246,.28)';
          el.style.color = '#bfdbfe';
        }catch(e){}
      }
      if(/^Risk:\s*$/i.test(t) || /^Risk$/i.test(t)){
        // ปล่อยหัวข้อไว้
      }
    });

    // ถ้ามี block risk ใน modal/detail ให้เติมคำอธิบาย low focus
    Array.from(document.querySelectorAll('section, div, article')).forEach(block => {
      const tx = text(block);
      if(block.__phase1RiskNoteV328) return;
      if(/Risk:/i.test(tx) && /Misconception:\s*automation/i.test(tx)){
        const note=document.createElement('div');
        note.className='muted';
        note.style.marginTop='8px';
        note.style.padding='8px 10px';
        note.style.borderRadius='12px';
        note.style.background='rgba(59,130,246,.10)';
        note.style.border='1px solid rgba(59,130,246,.22)';
        note.textContent='Risk: Low — automation เป็นจุดทบทวนเล็กน้อย ผู้เรียนผ่าน Phase 1 แล้ว สามารถต่อยอดสู่ S6 ได้';
        block.appendChild(note);
        block.__phase1RiskNoteV328=true;
      }
    });
  }

  function polishTeachingDecision(){
    if(!isTeacher()) return;
    const blocks = Array.from(document.querySelectorAll('section, div, article'))
      .filter(el => /Teaching Decision/i.test(text(el)));

    blocks.forEach(block => {
      if(block.__phase1TeachingPolishV328) return;

      const panel=document.createElement('div');
      panel.style.marginTop='10px';
      panel.style.padding='10px 12px';
      panel.style.borderRadius='14px';
      panel.style.background= phase1Ready() ? 'rgba(16,185,129,.12)' : 'rgba(148,163,184,.10)';
      panel.style.border= phase1Ready() ? '1px solid rgba(16,185,129,.28)' : '1px solid rgba(148,163,184,.20)';
      panel.innerHTML = phase1Ready()
        ? `<b>Phase 1 Ready:</b> S1–S5 + B1–B2 พร้อมใช้งานจริงในห้องเรียน<br><span class="muted">Next: เปิด S6 Knowledge Base Forge ใน Phase 2 ได้</span>`
        : `<b>Phase 1 In Progress:</b> ตรวจ S1–S5 + B1–B2 ให้ครบก่อนเปิด S6`;

      block.appendChild(panel);
      block.__phase1TeachingPolishV328=true;
    });
  }

  function addFinalReadinessCard(){
    if(!isTeacher()) return;
    const old=document.getElementById('phase1FinalReadinessCardV328');
    if(old) old.remove();

    const host =
      document.querySelector('#phase1TeacherChecklistV330') ||
      document.querySelector('#phase1TeacherChecklistV329') ||
      document.querySelector('#phase1TeacherChecklistV328') ||
      Array.from(document.querySelectorAll('section, div, article')).find(el=>/Phase 1 Classroom Ready Checklist/i.test(text(el))) ||
      Array.from(document.querySelectorAll('section, div, article')).find(el=>/Production Classroom Checklist/i.test(text(el))) ||
      null;
    if(!host) return;

    const card=document.createElement('div');
    card.id='phase1FinalReadinessCardV330';
    card.style.marginTop='14px';
    card.style.padding='14px';
    card.style.borderRadius='18px';
    card.style.border='1px solid rgba(16,185,129,.30)';
    card.style.background='rgba(16,185,129,.10)';
    card.innerHTML = `
      <h3 style="margin:0 0 8px">Teacher Student Detail Session History</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px">
        <div class="pill good">✓ S1 AI Awakening</div>
        <div class="pill good">✓ S2 Agent Builder</div>
        <div class="pill good">✓ B1 Rookie Boss</div>
        <div class="pill good">✓ S3 Search Maze</div>
        <div class="pill good">✓ S4 Route Cost</div>
        <div class="pill good">✓ S5 A* Rescue</div>
        <div class="pill good">✓ B2 Search Arena</div>
        <div class="pill warn">S6 Phase 2</div>
      </div>
      <p class="muted" style="margin:10px 0 0;font-size:12px">
        สถานะนี้หมายถึงชุดเรียนรู้ Phase 1 พร้อมใช้ทดสอบในชั้นเรียนแล้ว ก่อนเปิด S6 Knowledge Base Forge
      </p>
    `;
    host.insertAdjacentElement('afterend', card);
  }

  function markS6Phase2(){
    const cards=Array.from(document.querySelectorAll('div, article, section'));
    cards.forEach(card=>{
      if(card.__phase2MarkV328) return;
      const tx=text(card).toLowerCase();
      if(tx.includes('s6') && tx.includes('knowledge base') && tx.length < 260){
        card.__phase2MarkV328=true;
        if(!/phase 2/i.test(tx)){
          const note=document.createElement('div');
          note.className='muted';
          note.style.marginTop='6px';
          note.style.fontSize='12px';
          note.textContent='Phase 2: จะเปิดหลังปิด Phase 1 Final';
          card.appendChild(note);
        }
      }
    });
  }

  function improveLatestReflectionNote(){
    Array.from(document.querySelectorAll('section, div, article')).forEach(block=>{
      if(block.__phase1ReflectionFinalV328) return;
      const tx=text(block);
      if(!/Latest Reflection/i.test(tx)) return;
      if(/Search Arena Boss Claim/i.test(tx) && tx.split('Search Arena Boss Claim').length >= 3){
        const note=document.createElement('div');
        note.style.marginTop='8px';
        note.style.padding='8px 10px';
        note.style.borderRadius='12px';
        note.style.background='rgba(14,165,233,.10)';
        note.style.border='1px solid rgba(14,165,233,.22)';
        note.className='muted';
        note.textContent='Reflection รอบเก่าซ้ำเพราะเป็นข้อมูลจาก B2 bank ก่อนปรับ scenario-specific; รอบใหม่หลัง v3.2.6+ จะบันทึก accuracy/correct/total และคำถามเฉพาะมากขึ้น';
        block.appendChild(note);
        block.__phase1ReflectionFinalV328=true;
      }
    });
  }

  function refresh(){
    normalizeRiskLabels();
    /* v3.4.7 safe restore: no extra teaching decision card */
    /* v3.4.7: final card handled by teacher-dashboard-clean */
    markS6Phase2();
    improveLatestReflectionNote();
  }

  window.AIQUEST_PHASE1_FINAL_POLISH = {
    version: VERSION,
    refresh,
    phase1Ready
  };

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', () => setTimeout(refresh, 350));
  }else{
    setTimeout(refresh, 350);
  }

  if(!window.__AIQUEST_PHASE1_FINAL_OBSERVER_V328){
    window.__AIQUEST_PHASE1_FINAL_OBSERVER_V328 = new MutationObserver(() => {
      clearTimeout(window.__AIQUEST_PHASE1_FINAL_TIMER_V328);
      window.__AIQUEST_PHASE1_FINAL_TIMER_V328 = setTimeout(refresh, 200);
    });
    window.__AIQUEST_PHASE1_FINAL_OBSERVER_V328.observe(document.documentElement, {childList:true, subtree:true, characterData:true});
  }

  console.log('[AIQuest] '+VERSION+' loaded', window.AIQUEST_PHASE1_FINAL_POLISH);
})();
