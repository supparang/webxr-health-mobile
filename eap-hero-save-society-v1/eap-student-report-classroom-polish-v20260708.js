/* =========================================================
   EAP Hero Student Report Classroom Polish v20260708
   - Makes My Learning Report easier for Thai students.
   - Replaces long English explanatory note with Thai classroom note.
   - Adds a clear next-step prompt when one required skill remains.
   - UI-only. Does not change scores, mastery, Sheet sync, or evidence.
========================================================= */
(function(){
  'use strict';

  const VERSION = 'v20260708-STUDENT-REPORT-CLASSROOM-POLISH-V1';
  const STYLE_ID = 'eap-student-report-classroom-polish-style';
  const NOTE_ID = 'eap-student-report-thai-note';
  const NEXT_ID = 'eap-student-report-next-step';

  function text(value){
    return String(value == null ? '' : value).replace(/\s+/g,' ').trim();
  }

  function injectStyle(){
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${NOTE_ID},#${NEXT_ID}{
        margin:12px 0;
        padding:13px 14px;
        border-radius:16px;
        line-height:1.45;
        font-family:Arial,'Noto Sans Thai',sans-serif;
        box-shadow:0 8px 20px rgba(8,25,45,.10);
      }
      #${NOTE_ID}{
        background:#eef8ff;
        color:#12324d;
        border:1px solid rgba(97,155,190,.35);
        font-weight:800;
      }
      #${NEXT_ID}{
        background:linear-gradient(135deg,#e8fbf3,#ffffff);
        color:#064e3b;
        border:1px solid rgba(16,185,129,.32);
        font-weight:900;
      }
      #${NEXT_ID} button{
        margin-top:9px;
        border:0;
        border-radius:12px;
        padding:10px 12px;
        background:#0f766e;
        color:#fff;
        font-weight:950;
        font-size:14px;
        cursor:pointer;
      }
      @media(max-width:760px){
        #${NOTE_ID},#${NEXT_ID}{
          margin:10px 0;
          padding:11px 12px;
          border-radius:14px;
          font-size:14px;
        }
        #${NEXT_ID} button{width:100%;font-size:13px;min-height:40px}
      }
    `;
    document.head.appendChild(style);
  }

  function findReportRoot(){
    const candidates = Array.from(document.querySelectorAll('section,main,div'));
    return candidates.find(node => /My Learning Report/.test(text(node.textContent || ''))) || null;
  }

  function removeEnglishLegacyNote(root){
    if (!root) return;
    const nodes = Array.from(root.querySelectorAll('p,div,span'));
    nodes.forEach(node => {
      const t = text(node.textContent);
      if (t.indexOf('Best retained evidence is shown once per Session and Skill') >= 0) {
        node.style.display = 'none';
        node.setAttribute('aria-hidden','true');
      }
    });
  }

  function hasSpeakingPending(root){
    const raw = text(root && root.textContent || '');
    return /Speaking:\s*ยังไม่ทำ/.test(raw) || /เหลือ\s*1\s*Skill/.test(raw);
  }

  function addThaiNote(root){
    if (!root || document.getElementById(NOTE_ID)) return;
    const h = Array.from(root.querySelectorAll('h1,h2,h3')).find(node => /My Learning Report/.test(text(node.textContent || '')));
    const anchor = Array.from(root.querySelectorAll('p,div')).find(node => text(node.textContent).indexOf('Best retained evidence') >= 0) || h;
    const note = document.createElement('div');
    note.id = NOTE_ID;
    note.textContent = 'รายงานนี้ใช้ดูความก้าวหน้าและ feedback เพื่อพัฒนาครั้งถัดไป ระบบจะแสดงคะแนนดีที่สุดของแต่ละ Session และ Skill โดยไม่นำข้อมูลเก่าที่เป็น legacy มาเป็นคะแนนใหม่';
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(note, anchor.nextSibling);
    else root.appendChild(note);
  }

  function addNextStep(root){
    if (!root || document.getElementById(NEXT_ID) || !hasSpeakingPending(root)) return;
    const card = document.createElement('div');
    card.id = NEXT_ID;
    card.innerHTML = '<div>✅ Reading Core ผ่านแล้ว — ขั้นต่อไปให้ทำ <b>Speaking Support</b> เพื่อให้ Session 1 สมบูรณ์</div><button type="button">▶ ไปทำ Speaking Support</button>';
    const firstCard = Array.from(root.querySelectorAll('div')).find(node => /Reading:\s*100\/100/.test(text(node.textContent || '')));
    if (firstCard && firstCard.parentNode) firstCard.parentNode.insertBefore(card, firstCard.nextSibling);
    else root.insertBefore(card, root.firstChild);

    const button = card.querySelector('button');
    button.addEventListener('click', function(){
      try {
        if (window.EAPHero && typeof window.EAPHero.openSkillMission === 'function') {
          window.EAPHero.openSkillMission('Speaking', 1);
          return;
        }
        if (window.EAPClassroomActionRail && typeof window.EAPClassroomActionRail.startSkill === 'function') {
          window.EAPClassroomActionRail.startSkill('speaking');
          return;
        }
        if (window.EAPHero && typeof window.EAPHero.skillHub === 'function') {
          window.EAPHero.skillHub(1);
          return;
        }
      } catch(error) {
        console.warn('[EAP Report Polish] next step failed', error);
      }
    });
  }

  function polish(){
    injectStyle();
    const root = findReportRoot();
    if (!root) return;
    removeEnglishLegacyNote(root);
    addThaiNote(root);
    addNextStep(root);
  }

  function start(){
    polish();
    window.setInterval(polish, 900);
    window.EAPStudentReportClassroomPolish = {
      version: VERSION,
      refresh: polish
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
