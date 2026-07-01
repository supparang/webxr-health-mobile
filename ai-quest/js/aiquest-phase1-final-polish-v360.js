
(function(){
  'use strict';

  const VERSION = 'v4.1.2-s6-access-loader';

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

  function loadS6AccessGate(){
    if(isTeacher()) return;
    if(window.AIQuestS6AccessGateV412 || document.getElementById('aiquestS6AccessGateV412')) return;
    const script=document.createElement('script');
    script.id='aiquestS6AccessGateV412';
    script.src='./js/aiquest-s6-access-gate-v412.js?v=20260701-s6access412';
    script.async=true;
    document.head.appendChild(script);
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
    });

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
    improveLatestReflectionNote();
    loadS6AccessGate();
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