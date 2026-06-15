
(function(){
  'use strict';

  const VERSION='v3.4.0-teacher-dashboard-clean';

  function text(el){
    return String((el && (el.innerText || el.textContent)) || '').replace(/\s+/g,' ').trim();
  }

  function isTeacher(){
    try{
      return new URLSearchParams(location.search).get('teacher') === '1' || /Teacher Mode/i.test(document.body.innerText || '');
    }catch(e){ return false; }
  }

  function sectionTitle(el){
    const t=text(el);
    if(t.includes('All Students Detail')) return 'students';
    if(t.includes('Production Classroom Checklist')) return 'production';
    if(t.includes('Teaching Decision')) return 'decision';
    if(t.includes('Google Sheets Status')) return 'sheets';
    if(t.includes('Phase 1 Classroom Ready Checklist')) return 'checklist';
    return '';
  }

  function removePhaseReadyNoise(){
    if(!isTeacher()) return 0;
    let removed=0;

    Array.from(document.querySelectorAll('div, section, article, p, span')).forEach(el=>{
      const t=text(el);
      if(!t) return;

      const isTopBadge = el.id === 'aiquestPhase1ReadyBadge';
      const isChecklist = t.includes('Phase 1 Classroom Ready Checklist');
      const isCore = t.includes('Teaching Decision') || t.includes('Google Sheets Status') || t.includes('Production Classroom Checklist') || t.includes('All Students Detail');

      const looksPhaseReady =
        t.includes('Phase 1 Ready') &&
        t.includes('S1') &&
        t.includes('B2') &&
        t.length < 320;

      if(looksPhaseReady && !isTopBadge && !isChecklist && !isCore){
        el.remove();
        removed++;
      }
    });

    return removed;
  }

  function normalizePhaseReadyNotes(){
    if(!isTeacher()) return;

    // ลบกล่องเขียวซ้ำที่เป็น “Phase 1 Ready...” แต่ไม่ใช่ badge/checklist
    Array.from(document.querySelectorAll('div, section, article, p')).forEach(el=>{
      const t=text(el);
      if(!t.includes('Phase 1 Ready')) return;
      if(el.id === 'aiquestPhase1ReadyBadge') return;
      if(t.includes('Phase 1 Classroom Ready Checklist')) return;
      if(t.includes('Teaching Decision')) return;
      if(t.includes('Production Classroom Checklist')) return;
      if(t.length < 280){
        el.remove();
      }
    });
  }

  function makeTeacherOrder(){
    if(!isTeacher()) return;

    const body=document.body;
    const cards=Array.from(document.querySelectorAll('section, article, div'))
      .filter(el=>{
        const k=sectionTitle(el);
        if(!k) return false;
        const t=text(el);
        return t.length > 40 && t.length < 2500;
      });

    const picked={};
    cards.forEach(el=>{
      const k=sectionTitle(el);
      if(!picked[k]) picked[k]=el;
    });

    // สร้าง container หลักถ้ายังไม่มี
    let container=document.getElementById('teacherDashboardCleanContainerV331');
    if(!container){
      container=document.createElement('div');
      container.id='teacherDashboardCleanContainerV331';
      container.style.maxWidth='980px';
      container.style.margin='14px auto 24px';
      container.style.display='grid';
      container.style.gap='14px';
      container.style.padding='0 12px';
    }

    const header=document.querySelector('.topbar, header, .hero, .app-header') || document.querySelector('.card') || body.firstElementChild;
    if(header && header.parentElement){
      header.insertAdjacentElement('afterend', container);
    }else{
      body.prepend(container);
    }

    ['students','production','decision','sheets','checklist'].forEach(k=>{
      const el=picked[k];
      if(el && el !== container && !container.contains(el)){
        container.appendChild(el);
      }
    });

    // decision + sheets ให้เป็นสองคอลัมน์ถ้าเจอทั้งคู่
    const decision=picked.decision;
    const sheets=picked.sheets;
    if(decision && sheets && decision.parentElement===container && sheets.parentElement===container){
      let row=document.getElementById('teacherDecisionSheetsRowV331');
      if(!row){
        row=document.createElement('div');
        row.id='teacherDecisionSheetsRowV331';
        row.style.display='grid';
        row.style.gridTemplateColumns='1fr 1fr';
        row.style.gap='14px';
        row.style.alignItems='stretch';
        container.insertBefore(row, decision);
      }
      if(decision.parentElement!==row) row.appendChild(decision);
      if(sheets.parentElement!==row) row.appendChild(sheets);
    }
  }

  function patchTeachingDecisionText(){
    if(!isTeacher()) return;
    Array.from(document.querySelectorAll('section, div, article')).forEach(el=>{
      const t=text(el);
      if(!t.includes('Teaching Decision')) return;
      if(el.__cleanDecisionV331) return;

      // ถ้ามีกล่อง Phase 1 Ready ซ้ำใน decision ให้เหลืออันเดียวแบบสั้น
      Array.from(el.children).forEach(ch=>{
        const ct=text(ch);
        if(ct.includes('Phase 1 Ready') && ct.length < 300){
          ch.remove();
        }
      });

      const note=document.createElement('div');
      note.id='teacherDecisionPhase1NoteV331';
      note.style.marginTop='10px';
      note.style.padding='10px 12px';
      note.style.borderRadius='14px';
      note.style.background='rgba(16,185,129,.12)';
      note.style.border='1px solid rgba(16,185,129,.28)';
      note.innerHTML='<b>Phase 1 Ready:</b> ใช้งาน S1–S5 + B1–B2 ได้แล้ว<br><span class="muted">Next: เริ่ม S6 Knowledge Base Forge ใน Phase 2</span>';
      el.appendChild(note);
      el.__cleanDecisionV331=true;
    });
  }

  function ensureCoreVisible(){
    if(!isTeacher()) return;
    ['All Students Detail','Production Classroom Checklist','Teaching Decision','Google Sheets Status'].forEach(label=>{
      const found=Array.from(document.querySelectorAll('div, section, article')).find(el=>text(el).includes(label));
      if(found){
        found.style.display='';
        found.style.visibility='visible';
        found.style.opacity='1';
      }
    });
  }

  function clean(){
    normalizePhaseReadyNotes();
    patchTeachingDecisionText();
    ensureCoreVisible();
    /* v3.4.0 safe restore: do not move teacher dashboard DOM */
  }

  window.AIQUEST_TEACHER_DASHBOARD_CLEAN = {
    version:VERSION,
    clean,
    makeTeacherOrder,
    normalizePhaseReadyNotes,
    ensureCoreVisible
  };

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',()=>setTimeout(clean,500));
  }else{
    setTimeout(clean,500);
  }

  if(!window.__AIQUEST_TEACHER_CLEAN_OBSERVER_V331){
    window.__AIQUEST_TEACHER_CLEAN_OBSERVER_V331=new MutationObserver(()=>{
      clearTimeout(window.__AIQUEST_TEACHER_CLEAN_TIMER_V331);
      window.__AIQUEST_TEACHER_CLEAN_TIMER_V331=setTimeout(clean,260);
    });
    window.__AIQUEST_TEACHER_CLEAN_OBSERVER_V331.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  }

  console.log('[AIQuest] '+VERSION+' loaded', window.AIQUEST_TEACHER_DASHBOARD_CLEAN);
})();
