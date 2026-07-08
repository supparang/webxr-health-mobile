/* =========================================================
   EAP Hero Student Report Classroom Polish v20260708
   15-week route-aware student report polish.
   - Makes My Learning Report easier for Thai students.
   - Replaces long English explanatory note with Thai classroom note.
   - Adds a clear next-step prompt for the current S1-S15/B1-B5 route.
   - UI-only. Does not change scores, mastery, Sheet sync, or evidence.
========================================================= */
(function(){
  'use strict';

  const VERSION = 'v20260708-STUDENT-REPORT-CLASSROOM-POLISH-15WEEK-V2';
  const PACK_NAME = 'EAP_HERO_SESSION_CONTENT_PACK';
  const STYLE_ID = 'eap-student-report-classroom-polish-style';
  const NOTE_ID = 'eap-student-report-thai-note';
  const NEXT_ID = 'eap-student-report-next-step';
  const SKILLS = ['reading','listening','writing','speaking'];

  function text(value){
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  }

  function esc(value){
    return String(value == null ? '' : value)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#039;');
  }

  function pack(){
    const data = window[PACK_NAME];
    return data && Array.isArray(data.routes) ? data : null;
  }

  function byRouteId(routeId){
    const data = pack();
    const key = text(routeId).toUpperCase();
    if (!data || !key) return null;
    return data.routes.find(route => text(route.routeId).toUpperCase() === key) || null;
  }

  function routeIdFromUrl(){
    const params = new URLSearchParams(location.search);
    const raw = text(params.get('session') || params.get('route') || params.get('stage') || '');
    if (!raw) return '';
    return /^\d+$/.test(raw) ? 'S' + raw : raw.toUpperCase();
  }

  function routeIdFromStorage(){
    const keys = ['EAP_HERO_ACTIVE_ROUTE','EAP_HERO_CURRENT_ROUTE','EAP_HERO_CURRENT_SESSION','EAP_ACTIVE_SESSION'];
    for (const key of keys) {
      try {
        const raw = text(localStorage.getItem(key));
        if (raw) return /^\d+$/.test(raw) ? 'S' + raw : raw.toUpperCase();
      } catch(error) {}
    }
    return '';
  }

  function routeIdFromReport(root){
    const raw = text(root && root.textContent || document.body && document.body.textContent || '');
    const session = raw.match(/Session\s*(\d{1,2})/i);
    if (session) return 'S' + Number(session[1]);
    const data = pack();
    if (!data) return '';
    const lower = raw.toLowerCase();
    const found = data.routes.find(route => {
      const rid = text(route.routeId).toLowerCase();
      const title = text(route.title).toLowerCase();
      return (rid && new RegExp('\\b' + rid + '\\b','i').test(lower)) || (title && lower.includes(title));
    });
    return found ? found.routeId : '';
  }

  function currentRoute(root){
    return byRouteId(routeIdFromUrl()) || byRouteId(routeIdFromReport(root)) || byRouteId(routeIdFromStorage()) || byRouteId('S1');
  }

  function sessionNumber(route){
    const match = text(route && route.routeId).match(/^S(\d+)$/i);
    return match ? Number(match[1]) : 1;
  }

  function role(route, skill){
    return text(route && route.skillContract && route.skillContract[skill] || 'Exposure');
  }

  function requiredSkills(route){
    if (!route) return [];
    if (route.routeType === 'boss_gate') return SKILLS.slice();
    return SKILLS.filter(skill => ['Core','Support','Integrated'].includes(role(route, skill)));
  }

  function skillLabel(skill){
    const raw = text(skill).toLowerCase();
    return raw.slice(0,1).toUpperCase() + raw.slice(1);
  }

  function pendingRequiredSkills(root, route){
    const raw = text(root && root.textContent || '');
    const required = requiredSkills(route);
    const pending = required.filter(skill => {
      const label = skillLabel(skill);
      const rx = new RegExp(label + '\\s*:\\s*(ยังไม่ทำ|not\\s*done|pending)','i');
      return rx.test(raw);
    });
    if (pending.length) return pending;
    if (/เหลือ\s*\d+\s*Skill/i.test(raw)) return required;
    return [];
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
      #${NEXT_ID} .next-route{color:#17375e;margin-bottom:5px}
      #${NEXT_ID} .next-skills{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}
      #${NEXT_ID} .next-pill{display:inline-flex;align-items:center;padding:5px 8px;border-radius:999px;background:#dcfce7;color:#047857;font-size:12px;font-weight:950}
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

  function rememberRoute(route){
    if (!route) return;
    try {
      localStorage.setItem('EAP_HERO_ACTIVE_ROUTE', route.routeId);
      localStorage.setItem('EAP_HERO_CURRENT_ROUTE', route.routeId);
      const sid = text(route.routeId).match(/^S(\d+)$/i);
      if (sid) localStorage.setItem('EAP_HERO_CURRENT_SESSION', String(Number(sid[1])));
    } catch(error) {}
  }

  function startSkill(route, skill){
    const sid = sessionNumber(route);
    rememberRoute(route);
    try {
      if (window.EAPHero && typeof window.EAPHero.openSkillMission === 'function') {
        window.EAPHero.openSkillMission(skillLabel(skill), sid);
        return true;
      }
      if (window.EAPClassroomActionRail && typeof window.EAPClassroomActionRail.startSkill === 'function') {
        return !!window.EAPClassroomActionRail.startSkill(skill);
      }
      if (window.EAPHero && typeof window.EAPHero.skillHub === 'function') {
        window.EAPHero.skillHub(sid);
        return true;
      }
      if (window.EAPHero && typeof window.EAPHero.map === 'function') {
        window.EAPHero.map();
        return true;
      }
    } catch(error) {
      console.warn('[EAP Report Polish] next step failed', error);
    }
    return false;
  }

  function addNextStep(root){
    if (!root) return;
    const route = currentRoute(root);
    const pending = pendingRequiredSkills(root, route);
    let card = document.getElementById(NEXT_ID);

    if (!pending.length) {
      if (card) card.remove();
      return;
    }

    const firstSkill = pending[0];
    const routeLabel = route.routeType === 'boss_gate'
      ? route.routeId + ' · Boss Gate'
      : 'Week ' + sessionNumber(route) + ' / ' + route.routeId;
    const skillPills = pending.map(skill => '<span class="next-pill">' + esc(skillLabel(skill)) + ' · ' + esc(role(route, skill)) + '</span>').join('');

    if (!card) {
      card = document.createElement('div');
      card.id = NEXT_ID;
      const firstCard = Array.from(root.querySelectorAll('div')).find(node => /Reading:\s*(\d+\/100|ยังไม่ทำ)/.test(text(node.textContent || '')));
      if (firstCard && firstCard.parentNode) firstCard.parentNode.insertBefore(card, firstCard.nextSibling);
      else root.insertBefore(card, root.firstChild);
    }

    const key = route.routeId + '|' + pending.join(',');
    if (card.dataset.key !== key) {
      card.dataset.key = key;
      card.innerHTML = '<div class="next-route">✅ ขั้นต่อไปของ <b>' + esc(routeLabel) + '</b>: ' + esc(route.title || '') + '</div>' +
        '<div>เหลือ Skill บังคับที่ต้องทำให้ผ่านก่อน Session นี้สมบูรณ์</div>' +
        '<div class="next-skills">' + skillPills + '</div>' +
        '<button type="button" data-eap-report-next-skill="' + esc(firstSkill) + '">▶ ไปทำ ' + esc(skillLabel(firstSkill)) + '</button>';
    }

    const button = card.querySelector('[data-eap-report-next-skill]');
    if (button && !button.dataset.bound) {
      button.dataset.bound = '1';
      button.addEventListener('click', function(){
        startSkill(currentRoute(root), button.dataset.eapReportNextSkill || firstSkill);
      });
    }
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
      refresh: polish,
      currentRoute: currentRoute
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();