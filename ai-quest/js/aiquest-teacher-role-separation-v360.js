
(function(){
  'use strict';

  const VERSION='v3.6.0-split-teacher-student-pages';

  function text(el){
    return String((el && (el.innerText || el.textContent)) || '').replace(/\s+/g,' ').trim();
  }

  function isTeacher(){
    try{
      return new URLSearchParams(location.search).get('teacher') === '1' || /Teacher Mode/i.test(document.body.innerText || '');
    }catch(e){ return false; }
  }

  function isPreviewMode(){
    try{
      return sessionStorage.getItem('AIQUEST_TEACHER_PREVIEW_MODE') === '1';
    }catch(e){ return false; }
  }

  function setPreviewMode(v){
    try{
      if(v) sessionStorage.setItem('AIQUEST_TEACHER_PREVIEW_MODE','1');
      else sessionStorage.removeItem('AIQUEST_TEACHER_PREVIEW_MODE');
    }catch(e){}
  }

  function looksStudentGameplayBlock(el){
    const t=text(el);
    if(!t || t.length < 20) return false;

    const patterns=[
      /Run Mode/i,
      /เลือกโหมดก่อนเริ่มเล่น/i,
      /PRACTICE\s+GRADED\s+REMEDIAL/i,
      /Division\s+\d+/i,
      /AI Rookie Base/i,
      /Search Arena/i,
      /เริ่ม Session/i,
      /Mastery Goal/i,
      /Question Bank\s+\d+/i,
      /No-repeat Smart Randomizer/i,
      /AI Help \+ AI Coach/i
    ];

    return patterns.some(p=>p.test(t));
  }

  function looksTeacherCoreBlock(el){
    const t=text(el);
    return (
      t.includes('All Students Detail') ||
      t.includes('Production Classroom Checklist') ||
      t.includes('Phase Analytics') ||
      t.includes('Students to Review') ||
      t.includes('Students to Support') ||
      t.includes('Misconception Summary') ||
      t.includes('Teaching Decision') ||
      t.includes('Google Sheets Status')
    );
  }

  function hideStudentGameplayInTeacher(){
    if(!isTeacher()) return;
    const preview=isPreviewMode();

    Array.from(document.querySelectorAll('section, article, div')).forEach(el=>{
      if(looksTeacherCoreBlock(el)) return;
      if(!looksStudentGameplayBlock(el)) return;

      // อย่าซ่อน header/topbar
      if(el.closest && el.closest('header, .topbar, .app-header')) return;

      el.setAttribute('data-teacher-student-ui','1');
      el.style.display = preview ? '' : 'none';
    });
  }

  function addTeacherRoleNotice(){
    if(!isTeacher()) return;

    let notice=document.getElementById('teacherRoleSeparationNoticeV334');
    if(notice) return;

    const header=document.querySelector('.topbar, header, .app-header, .hero') || document.body.firstElementChild || document.body;
    notice=document.createElement('div');
    notice.id='teacherRoleSeparationNoticeV334';
    notice.style.maxWidth='980px';
    notice.style.margin='10px auto';
    notice.style.padding='10px 14px';
    notice.style.borderRadius='16px';
    notice.style.border='1px solid rgba(34,211,238,.25)';
    notice.style.background='rgba(15,23,42,.72)';
    notice.style.color='#cbd5e1';
    notice.innerHTML=`
      <b>Teacher Dashboard:</b> แสดงข้อมูลชั้นเรียนและการติดตามผลเป็นหลัก
      <button id="teacherPreviewStudentUIV334" class="btn small" style="margin-left:10px">Preview Student/Mission UI</button>
      <button id="teacherHideStudentUIV334" class="btn small" style="margin-left:6px">Hide Preview</button>
    `;
    header.insertAdjacentElement('afterend', notice);

    const previewBtn=notice.querySelector('#teacherPreviewStudentUIV334');
    const hideBtn=notice.querySelector('#teacherHideStudentUIV334');
    previewBtn.onclick=()=>{
      setPreviewMode(true);
      hideStudentGameplayInTeacher();
      toastSafe('เปิด Preview Student/Mission UI');
    };
    hideBtn.onclick=()=>{
      setPreviewMode(false);
      hideStudentGameplayInTeacher();
      toastSafe('ซ่อน Student/Mission UI แล้ว');
    };
  }

  function toastSafe(msg){
    try{
      if(typeof showToast==='function') showToast(msg);
      else console.log('[AIQuest]',msg);
    }catch(e){
      console.log('[AIQuest]',msg);
    }
  }

  function relabelTeacherButtons(){
    if(!isTeacher()) return;
    Array.from(document.querySelectorAll('button')).forEach(btn=>{
      const t=text(btn);
      if(t === 'Mission Map') btn.title='ใช้ดู/preview แผนด่าน ไม่ใช่ dashboard หลัก';
      if(t === 'Practice') btn.title='ใช้ preview ฝั่งนักศึกษา';
      if(t === 'Replay B2') btn.title='ใช้ replay เพื่อทดสอบ boss ในฐานะครู';
      if(t === 'Dashboard') btn.title='กลับหน้า dashboard ครู';
    });
  }

  function ensureDashboardVisibleHint(){
    if(!isTeacher()) return;
    const body=text(document.body);
    if(!body.includes('Phase Analytics') && !body.includes('All Students Detail') && !body.includes('Production Classroom Checklist')){
      let warn=document.getElementById('teacherDashboardRoleWarningV334');
      if(!warn){
        warn=document.createElement('div');
        warn.id='teacherDashboardRoleWarningV334';
        warn.style.maxWidth='980px';
        warn.style.margin='12px auto';
        warn.style.padding='12px 14px';
        warn.style.borderRadius='16px';
        warn.style.border='1px solid rgba(251,191,36,.35)';
        warn.style.background='rgba(251,191,36,.12)';
        warn.style.color='#fde68a';
        warn.textContent='ยังไม่เห็น Dashboard หลัก: กดปุ่ม Dashboard ด้านบน หรือ refresh หน้าอีกครั้ง';
        document.body.prepend(warn);
      }
    }
  }

  function refresh(){
    if(!isTeacher()) return;
    addTeacherRoleNotice();
    hideStudentGameplayInTeacher();
    relabelTeacherButtons();
    ensureDashboardVisibleHint();
  }

  window.AIQUEST_TEACHER_ROLE_SEPARATION={
    version:VERSION,
    refresh,
    hideStudentGameplayInTeacher,
    setPreviewMode,
    isPreviewMode
  };

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',()=>setTimeout(refresh,450));
  }else{
    setTimeout(refresh,450);
  }

  if(!window.__AIQUEST_TEACHER_ROLE_OBSERVER_V334){
    window.__AIQUEST_TEACHER_ROLE_OBSERVER_V334=new MutationObserver(()=>{
      clearTimeout(window.__AIQUEST_TEACHER_ROLE_TIMER_V334);
      window.__AIQUEST_TEACHER_ROLE_TIMER_V334=setTimeout(refresh,260);
    });
    window.__AIQUEST_TEACHER_ROLE_OBSERVER_V334.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  }

  console.log('[AIQuest] '+VERSION+' loaded', window.AIQUEST_TEACHER_ROLE_SEPARATION);
})();
