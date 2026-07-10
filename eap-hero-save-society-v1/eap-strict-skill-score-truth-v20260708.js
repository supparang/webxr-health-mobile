/* =========================================================
   EAP Hero Strict Per-Skill Score Truth Guard v20260708
   Stable version:
   - Reads portfolio evidence by Session + Skill.
   - Adds a truth overlay only when its content changes.
   - Avoids writing DOM repeatedly, preventing MutationObserver flicker.
   - UI-only. Does not change stored data, Sheet sync, scoring, or unlock logic.
========================================================= */
(function(){
  'use strict';

  const VERSION = 'v20260708-STRICT-SKILL-SCORE-TRUTH-V2-NO-FLICKER';
  const STATE_KEY = 'EAP_HERO_PROGRESS_V3';
  const PASS_MARK = 60;
  const STYLE_ID = 'eap-strict-skill-score-truth-style';
  const GUARD_CLASS = 'eap-strict-skill-truth-guard';
  const SKILLS = ['Reading','Writing','Listening','Speaking'];
  const REQUIRED = {
    1: ['Reading','Speaking'],
    2: ['Reading','Writing'],
    3: ['Reading','Writing'],
    4: ['Reading','Listening'],
    5: ['Reading','Speaking'],
    6: ['Reading','Writing'],
    7: ['Writing','Speaking'],
    8: ['Reading','Writing'],
    9: ['Writing','Speaking'],
    10: ['Reading','Writing'],
    11: ['Writing','Speaking'],
    12: ['Reading','Writing'],
    13: ['Listening','Writing'],
    14: ['Writing','Speaking'],
    15: ['Writing','Speaking']
  };

  let lastAppTextKey = '';
  let lastDataKey = '';
  let timer = null;

  function text(value){
    return String(value == null ? '' : value).replace(/\s+/g,' ').trim();
  }

  function num(value){
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function state(){
    try { return JSON.parse(localStorage.getItem(STATE_KEY) || '{}') || {}; }
    catch(error) { return {}; }
  }

  function normalizeSession(value){
    const raw = text(value).toUpperCase();
    const m = raw.match(/^S(?:ESSION)?\s*0?(1[0-5]|[1-9])$/) || raw.match(/(?:^|\b)S(?:ESSION)?\s*0?(1[0-5]|[1-9])(?:\b|_)/);
    if (m) return Number(m[1]);
    return /^0?(1[0-5]|[1-9])$/.test(raw) ? Number(raw) : 0;
  }

  function normalizeSkill(value){
    const raw = text(value).toLowerCase();
    return SKILLS.find(skill => raw === skill.toLowerCase() || raw.indexOf(skill.toLowerCase()) >= 0) || '';
  }

  function entryScore(entry){
    return num(entry.latestScore ?? entry.score ?? entry.bestScore ?? entry.autoScore ?? entry.missionTaskScore);
  }

  function strictPortfolioBest(){
    const s = state();
    const portfolio = Array.isArray(s.portfolio) ? s.portfolio : [];
    const best = {};

    for (let sid = 1; sid <= 15; sid++) {
      best[sid] = {};
      SKILLS.forEach(skill => { best[sid][skill] = 0; });
    }

    portfolio.forEach(entry => {
      const sid = normalizeSession(entry && (entry.session || entry.sessionId || entry.routeId || entry.sessionCode));
      const skill = normalizeSkill(entry && (entry.skill || entry.skillName || entry.evidenceType || entry.taskId || entry.type));
      if (!sid || !skill) return;
      best[sid][skill] = Math.max(best[sid][skill] || 0, entryScore(entry));
    });

    return best;
  }

  function injectStyle(){
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .${GUARD_CLASS}{
        margin-top:8px;
        padding:9px 10px;
        border-radius:12px;
        background:#fff7ed;
        border:1px solid rgba(234,88,12,.26);
        color:#7c2d12;
        font:800 11px Arial,'Noto Sans Thai',sans-serif;
        line-height:1.35;
      }
      .${GUARD_CLASS}.ok{
        background:#ecfdf5;
        border-color:rgba(16,185,129,.28);
        color:#065f46;
      }
      .${GUARD_CLASS} .row{display:block;margin:2px 0}
      .${GUARD_CLASS} .pass{color:#047857}
      .${GUARD_CLASS} .todo{color:#a16207}
    `;
    document.head.appendChild(style);
  }

  function sessionCardNodes(){
    const nodes = Array.from(document.querySelectorAll('#app div,#app section,#app article'));
    return nodes.filter(node => {
      const t = text(node.textContent);
      if (!/^SESSION\s+(1[0-5]|[1-9])\b/i.test(t)) return false;
      const rect = node.getBoundingClientRect();
      return rect.width >= 120 && rect.height >= 80 && rect.height <= 460;
    });
  }

  function sessionFromNode(node){
    const m = text(node.textContent).match(/^SESSION\s+(1[0-5]|[1-9])\b/i);
    return m ? Number(m[1]) : 0;
  }

  function modelFor(sid, best){
    const required = REQUIRED[sid] || ['Reading','Writing'];
    return required.map(skill => {
      const score = best[sid] && best[sid][skill] ? best[sid][skill] : 0;
      return { skill, score, pass: score >= PASS_MARK };
    });
  }

  function htmlFor(sid, best){
    const model = modelFor(sid, best);
    const rows = model.map(row => '<span class="row ' + (row.pass ? 'pass' : 'todo') + '">' +
      (row.pass ? '✓ ' : '○ ') + row.skill + ': ' + (row.score ? row.score + '/60' : 'ยังไม่พบหลักฐาน') +
      '</span>').join('');
    const complete = model.every(row => row.pass);
    return '<b>คะแนนจริงแยกตาม Skill</b>' + rows +
      (complete ? '<span class="row pass">Session ผ่านตามหลักฐานจริง</span>' : '<span class="row todo">ยังไม่ครบตามหลักฐานจริง</span>');
  }

  function patchCards(force){
    const app = document.getElementById('app');
    if (!app) return;
    injectStyle();

    const appKey = text(app.textContent).slice(0, 1200);
    const best = strictPortfolioBest();
    const dataKey = JSON.stringify(best);

    if (!force && appKey === lastAppTextKey && dataKey === lastDataKey) {
      return;
    }

    lastAppTextKey = appKey;
    lastDataKey = dataKey;

    sessionCardNodes().forEach(node => {
      const sid = sessionFromNode(node);
      if (!sid) return;

      const model = modelFor(sid, best);
      const key = JSON.stringify(model);
      let guard = node.querySelector(':scope > .' + GUARD_CLASS);
      const html = htmlFor(sid, best);
      const complete = model.every(row => row.pass);

      if (!guard) {
        guard = document.createElement('div');
        guard.className = GUARD_CLASS + (complete ? ' ok' : '');
        guard.dataset.session = String(sid);
        guard.dataset.truthKey = key;
        guard.innerHTML = html;
        node.appendChild(guard);
        return;
      }

      if (guard.dataset.truthKey === key) return;
      guard.dataset.truthKey = key;
      guard.className = GUARD_CLASS + (complete ? ' ok' : '');
      guard.innerHTML = html;
    });
  }

  function schedule(force){
    clearTimeout(timer);
    timer = setTimeout(() => patchCards(!!force), 180);
  }

  function start(){
    schedule(true);
    window.addEventListener('storage', () => schedule(true));
    window.addEventListener('eap:resume-synced', () => schedule(true));
    window.addEventListener('eap:profile-saved', () => schedule(true));
    window.addEventListener('eap:cloud-resume-applied', () => schedule(true));
    window.EAPStrictSkillScoreTruth = {
      version: VERSION,
      refresh: function(){ schedule(true); },
      strictPortfolioBest: strictPortfolioBest
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
