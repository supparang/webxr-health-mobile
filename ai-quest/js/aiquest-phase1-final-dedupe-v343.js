
(function(){
  'use strict';

  const VERSION='v3.4.3-teacher-dashboard-restore';

  function txt(el){
    return String((el && (el.innerText || el.textContent)) || '').replace(/\s+/g,' ').trim();
  }

  function isTeacher(){
    try{
      return new URLSearchParams(location.search).get('teacher') === '1' || /Teacher Mode/i.test(document.body.innerText || '');
    }catch(e){ return false; }
  }

  function protectCoreDashboard(){
    if(!isTeacher()) return;
    const keywords=[
      'All Students Detail',
      'Production Classroom Checklist',
      'Teaching Decision',
      'Google Sheets Status',
      'Student',
      'Attempts',
      'Best',
      'Latest',
      'Reflection',
      'Risk',
      'Detail'
    ];
    Array.from(document.querySelectorAll('div, section, article, table')).forEach(el=>{
      const t=txt(el);
      if(keywords.some(k=>t.includes(k))){
        el.setAttribute('data-aiquest-core-dashboard','1');
        el.style.display = el.style.display === 'none' ? '' : el.style.display;
      }
    });
  }

  function isCore(el){
    return !!(el && el.closest && el.closest('[data-aiquest-core-dashboard="1"]'));
  }

  function removeOnlyLooseDuplicatePhaseNotes(){
    if(!isTeacher()) return 0;
    let removed=0;

    const notes=Array.from(document.querySelectorAll('div, p, span'))
      .filter(el=>{
        if(isCore(el)) return false;
        const t=txt(el);
        return t.includes('Phase 1 Ready') &&
               t.includes('Next:') &&
               t.includes('S6 Knowledge Base Forge') &&
               t.length < 260;
      });

    let kept=false;
    notes.forEach(el=>{
      if(!kept){
        kept=true;
        el.id='phase1TeachingDecisionNoteV330';
      }else{
        el.remove();
        removed++;
      }
    });
    return removed;
  }

  function keepOneFinalCardAndOneChecklist(){
    if(!isTeacher()) return;
    const finalCards=Array.from(document.querySelectorAll('div, section, article'))
      .filter(el=>{
        const t=txt(el);
        return t.includes('Phase 1') && t.includes('Final') && t.includes('S1') && t.includes('B2') && t.length < 900;
      });

    let keptFinal=false;
    finalCards.forEach(el=>{
      if(isCore(el)) return;
      if(!keptFinal){
        keptFinal=true;
        el.id='phase1FinalReadinessCardV330';
      }else{
        el.remove();
      }
    });

    const checklists=Array.from(document.querySelectorAll('div, section, article'))
      .filter(el=>{
        const t=txt(el);
        return t.includes('Phase 1 Classroom Ready Checklist') && t.includes('Section 101') && t.length < 900;
      });

    let keptChecklist=false;
    checklists.forEach(el=>{
      if(isCore(el)) return;
      if(!keptChecklist){
        keptChecklist=true;
        el.id='phase1TeacherChecklistV330';
      }else{
        el.remove();
      }
    });
  }

  function ensureTeacherMainNotEmpty(){
    if(!isTeacher()) return;
    const bodyText=txt(document.body);
    if(!bodyText.includes('All Students Detail') && !bodyText.includes('Production Classroom Checklist')){
      const warn=document.getElementById('teacherDashboardRestoreWarningV330') || document.createElement('div');
      warn.id='teacherDashboardRestoreWarningV330';
      warn.style.margin='16px auto';
      warn.style.maxWidth='980px';
      warn.style.padding='14px';
      warn.style.borderRadius='16px';
      warn.style.border='1px solid rgba(251,191,36,.35)';
      warn.style.background='rgba(251,191,36,.12)';
      warn.style.color='#fde68a';
      warn.innerHTML='<b>Dashboard restore note:</b> ถ้ายังไม่เห็น Student table / Production Checklist ให้กดปุ่ม Dashboard หรือ refresh แบบ hard reload อีกครั้ง';
      document.body.prepend(warn);
    }
  }

  function clean(){
    protectCoreDashboard();
    /* v3.4.3 safe restore: no card/checklist relocation */
    try{ removeOnlyLooseDuplicatePhaseNotes(); }catch(e){}
    ensureTeacherMainNotEmpty();
  }

  window.AIQUEST_PHASE1_FINAL_DEDUPE = {
    version: VERSION,
    clean,
    protectCoreDashboard,
    keepOneFinalCardAndOneChecklist,
    removeOnlyLooseDuplicatePhaseNotes
  };
  window.AIQUEST_TEACHER_DASHBOARD_RESTORE = window.AIQUEST_PHASE1_FINAL_DEDUPE;

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', () => setTimeout(clean, 500));
  }else{
    setTimeout(clean, 500);
  }

  if(!window.__AIQUEST_TEACHER_RESTORE_OBSERVER_V330){
    window.__AIQUEST_TEACHER_RESTORE_OBSERVER_V330 = new MutationObserver(() => {
      clearTimeout(window.__AIQUEST_TEACHER_RESTORE_TIMER_V330);
      window.__AIQUEST_TEACHER_RESTORE_TIMER_V330 = setTimeout(clean, 260);
    });
    window.__AIQUEST_TEACHER_RESTORE_OBSERVER_V330.observe(document.documentElement, {childList:true, subtree:true, characterData:true});
  }

  console.log('[AIQuest] '+VERSION+' loaded', window.AIQUEST_TEACHER_DASHBOARD_RESTORE);
})();
