
(function(){
  'use strict';

  const VERSION='v3.2.9-phase1-final-dedupe';

  function txt(el){
    return String((el && (el.innerText || el.textContent)) || '').replace(/\s+/g,' ').trim();
  }

  function isTeacher(){
    try{
      return new URLSearchParams(location.search).get('teacher') === '1' || /Teacher Mode/i.test(document.body.innerText || '');
    }catch(e){ return false; }
  }

  function removeDuplicatePhaseReadyBlocks(){
    if(!isTeacher()) return 0;

    const blocks = Array.from(document.querySelectorAll('div, section, article'))
      .filter(el => {
        const t=txt(el);
        return t.includes('Phase 1 Ready') && t.includes('S1') && t.includes('B2') && t.length < 350;
      });

    let keptTeaching = false;
    let keptFinal = false;
    let removed = 0;

    blocks.forEach(el => {
      const t=txt(el);
      const isBadge = el.id === 'aiquestPhase1ReadyBadge';
      const isChecklist = /Classroom Ready Checklist/i.test(t);
      const isFinalCard = /Classroom Ready Final/i.test(t) || el.id === 'phase1FinalReadinessCardV328' || el.id === 'phase1FinalReadinessCardV329';
      const isTeachingDecisionNote = /Next:\s*เปิด S6/i.test(t) && !isFinalCard && !isChecklist && !isBadge;

      if(isBadge || isChecklist){
        return;
      }

      if(isFinalCard){
        if(keptFinal){
          el.remove(); removed++;
        }else{
          keptFinal = true;
          el.id = 'phase1FinalReadinessCardV329';
        }
        return;
      }

      if(isTeachingDecisionNote){
        if(keptTeaching){
          el.remove(); removed++;
        }else{
          keptTeaching = true;
          el.id = 'phase1TeachingDecisionNoteV329';
        }
      }
    });

    return removed;
  }

  function normalizeTeachingDecision(){
    if(!isTeacher()) return;

    const candidates = Array.from(document.querySelectorAll('section, div, article'))
      .filter(el => /Teaching Decision/i.test(txt(el)) && txt(el).length < 900);

    candidates.forEach(block => {
      if(block.__phase1DecisionNormalizedV329) return;

      // Remove multiple appended green notes inside this block, keep one.
      const childNotes = Array.from(block.children).filter(ch => {
        const t=txt(ch);
        return t.includes('Phase 1 Ready') && t.includes('Next:') && t.length < 260;
      });

      childNotes.slice(1).forEach(ch => ch.remove());

      if(!childNotes.length){
        const note=document.createElement('div');
        note.id='phase1TeachingDecisionNoteV329';
        note.style.marginTop='10px';
        note.style.padding='10px 12px';
        note.style.borderRadius='14px';
        note.style.background='rgba(16,185,129,.12)';
        note.style.border='1px solid rgba(16,185,129,.28)';
        note.innerHTML='<b>Phase 1 Ready:</b> S1–S5 + B1–B2 พร้อมใช้งานจริงในห้องเรียน<br><span class="muted">Next: เปิด S6 Knowledge Base Forge ใน Phase 2 ได้</span>';
        block.appendChild(note);
      }

      block.__phase1DecisionNormalizedV329=true;
    });
  }

  function keepOneFinalCard(){
    if(!isTeacher()) return;

    const cards = Array.from(document.querySelectorAll('div, section, article'))
      .filter(el => {
        const t=txt(el);
        return /Phase 1 Classroom Ready Final/i.test(t) && t.includes('S1') && t.includes('B2');
      });

    cards.forEach((card,i) => {
      if(i>0){
        card.remove();
      }else{
        card.id='phase1FinalReadinessCardV329';
      }
    });
  }

  function keepOneChecklist(){
    if(!isTeacher()) return;

    const cards = Array.from(document.querySelectorAll('div, section, article'))
      .filter(el => {
        const t=txt(el);
        return /Phase 1 Classroom Ready Checklist/i.test(t) && t.includes('Section 101');
      });

    cards.forEach((card,i) => {
      if(i>0){
        card.remove();
      }else{
        card.id='phase1TeacherChecklistV329';
      }
    });
  }

  function removeRepeatedS6Notes(){
    if(!isTeacher()) return;
    const notes = Array.from(document.querySelectorAll('div, p, span'))
      .filter(el => {
        const t=txt(el);
        return t.includes('Next: เปิด S6 Knowledge Base Forge') && t.length < 180;
      });

    let seen = false;
    notes.forEach(el => {
      // Keep the one inside Teaching Decision; remove loose duplicates.
      const parentText = txt(el.parentElement);
      const inDecision = parentText.includes('Teaching Decision');
      if(inDecision && !seen){
        seen=true;
        return;
      }
      if(seen || !inDecision){
        el.remove();
      }
    });
  }

  function clean(){
    removeDuplicatePhaseReadyBlocks();
    normalizeTeachingDecision();
    keepOneFinalCard();
    keepOneChecklist();
    removeRepeatedS6Notes();
  }

  window.AIQUEST_PHASE1_FINAL_DEDUPE = {
    version: VERSION,
    clean,
    removeDuplicatePhaseReadyBlocks,
    normalizeTeachingDecision,
    keepOneFinalCard,
    keepOneChecklist
  };

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', () => setTimeout(clean, 500));
  }else{
    setTimeout(clean, 500);
  }

  if(!window.__AIQUEST_PHASE1_DEDUPE_OBSERVER_V329){
    window.__AIQUEST_PHASE1_DEDUPE_OBSERVER_V329 = new MutationObserver(() => {
      clearTimeout(window.__AIQUEST_PHASE1_DEDUPE_TIMER_V329);
      window.__AIQUEST_PHASE1_DEDUPE_TIMER_V329 = setTimeout(clean, 240);
    });
    window.__AIQUEST_PHASE1_DEDUPE_OBSERVER_V329.observe(document.documentElement, {childList:true, subtree:true, characterData:true});
  }

  console.log('[AIQuest] '+VERSION+' loaded', window.AIQUEST_PHASE1_FINAL_DEDUPE);
})();
