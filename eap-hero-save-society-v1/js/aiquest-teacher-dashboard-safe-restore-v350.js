
(function(){
  'use strict';

  const VERSION='v3.5.0-teacher-dashboard-safe-restore';

  function t(el){
    return String((el && (el.innerText || el.textContent)) || '').replace(/\s+/g,' ').trim();
  }

  function teacher(){
    try{
      return new URLSearchParams(location.search).get('teacher') === '1' || /Teacher Mode/i.test(document.body.innerText || '');
    }catch(e){ return false; }
  }

  function removeInjectedNoise(){
    if(!teacher()) return 0;
    let removed=0;

    const injectedIds=[
      'teacherDashboardCleanContainerV332',
      'teacherDashboardCleanContainerV331',
      'teacherDecisionSheetsRowV332',
      'teacherDecisionSheetsRowV331',
      'phase1FinalReadinessCardV332',
      'phase1FinalReadinessCardV331',
      'phase1FinalReadinessCardV330',
      'phase1FinalReadinessCardV329'
    ];
    injectedIds.forEach(id=>{
      const el=document.getElementById(id);
      if(el){
        // ถ้ามี core dashboard อยู่ข้างใน อย่าลบทิ้ง ให้ unwrap เด็กกลับ parent ก่อน
        const parent=el.parentElement;
        if(parent){
          while(el.firstChild) parent.insertBefore(el.firstChild, el);
          el.remove();
          removed++;
        }
      }
    });

    // ลบกล่อง Phase 1 Ready ที่สั้นและซ้ำ แต่ไม่ใช่ badge ด้านบน
    Array.from(document.querySelectorAll('div, section, article, p')).forEach(el=>{
      const tx=t(el);
      if(!tx) return;
      if(el.id === 'aiquestPhase1ReadyBadge') return;
      if(tx.includes('Production Classroom Checklist')) return;
      if(tx.includes('All Students Detail')) return;
      if(tx.includes('Google Sheets Status')) return;
      if(tx.includes('Teaching Decision')) return;
      if(tx.includes('Phase 1 Classroom Ready Checklist')) return;

      const noise =
        tx.includes('Phase 1 Ready') &&
        tx.includes('S1') &&
        tx.includes('B2') &&
        tx.length < 260;

      if(noise){
        el.remove();
        removed++;
      }
    });

    return removed;
  }

  function resetBadInlineLayout(){
    if(!teacher()) return;

    Array.from(document.querySelectorAll('div, section, article')).forEach(el=>{
      const tx=t(el);

      // แก้เฉพาะ core blocks ที่เคยถูกย้าย/บีบ
      const isCore =
        tx.includes('Teaching Decision') ||
        tx.includes('Google Sheets Status') ||
        tx.includes('Production Classroom Checklist') ||
        tx.includes('All Students Detail');

      if(!isCore) return;

      el.style.maxWidth='';
      el.style.width='';
      el.style.gridColumn='';
      el.style.transform='';
      el.style.position=el.style.position === 'fixed' ? '' : el.style.position;
      el.style.left='';
      el.style.right='';
      el.style.bottom='';
      el.style.minWidth='';
      el.style.display = el.style.display === 'none' ? '' : el.style.display;
      el.style.visibility='visible';
      el.style.opacity='1';
    });
  }

  function forceDashboardButtonAvailable(){
    if(!teacher()) return;
    const btns=Array.from(document.querySelectorAll('button'));
    const dashboard=btns.find(b=>/Dashboard/i.test(t(b)));
    if(dashboard){
      dashboard.style.outline='1px solid rgba(34,211,238,.35)';
      dashboard.title='กดเพื่อกลับหน้า Dashboard ครู';
    }
  }

  function addMinimalPhaseBadgeOnly(){
    if(!teacher()) return;
    const old=document.getElementById('aiquestPhase1ReadyBadge');
    if(old){
      old.textContent='✓ Phase 1 Ready: S1–S5 + B1–B2 พร้อมใช้งาน';
      old.style.whiteSpace='normal';
      old.style.maxWidth='320px';
    }
  }

  function clean(){
    removeInjectedNoise();
    resetBadInlineLayout();
    forceDashboardButtonAvailable();
    addMinimalPhaseBadgeOnly();
  }

  window.AIQUEST_TEACHER_DASHBOARD_SAFE_RESTORE={
    version:VERSION,
    clean,
    removeInjectedNoise,
    resetBadInlineLayout
  };

  // Keep old object name for console compatibility
  window.AIQUEST_TEACHER_DASHBOARD_CLEAN=window.AIQUEST_TEACHER_DASHBOARD_SAFE_RESTORE;

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',()=>setTimeout(clean,500));
  }else{
    setTimeout(clean,500);
  }

  if(!window.__AIQUEST_TEACHER_SAFE_RESTORE_OBSERVER_V332){
    window.__AIQUEST_TEACHER_SAFE_RESTORE_OBSERVER_V332=new MutationObserver(()=>{
      clearTimeout(window.__AIQUEST_TEACHER_SAFE_RESTORE_TIMER_V332);
      window.__AIQUEST_TEACHER_SAFE_RESTORE_TIMER_V332=setTimeout(clean,250);
    });
    window.__AIQUEST_TEACHER_SAFE_RESTORE_OBSERVER_V332.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  }

  console.log('[AIQuest] '+VERSION+' loaded', window.AIQUEST_TEACHER_DASHBOARD_SAFE_RESTORE);
})();
