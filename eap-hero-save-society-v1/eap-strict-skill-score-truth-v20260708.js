/* =========================================================
   EAP Hero Strict Per-Skill Score Truth Guard v20260802
   Production required/support status renderer.
   - Reads portfolio evidence by Session + Skill.
   - Uses the Session card detector already proven in production.
   - Labels skill controls as required/support at the source card.
   - UI-only. Does not change stored data, Sheet sync, scoring, or unlock logic.
========================================================= */
(function(){
  'use strict';

  const VERSION = 'v20260802-STRICT-SKILL-STATUS-V3-REQUIRED-SUPPORT';
  const STATE_KEY = 'EAP_HERO_PROGRESS_V3';
  const PASS_MARK = 60;
  const STYLE_ID = 'eap-strict-skill-score-truth-style';
  const GUARD_CLASS = 'eap-strict-skill-truth-guard';
  const CONTROL_CLASS = 'eap-skill-status-control-v3';
  const BADGE_CLASS = 'eap-skill-status-badge-v3';
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
    const serverRecords = Array.isArray(s.serverResume && s.serverResume.records) ? s.serverResume.records : [];
    const serverAttempts = Array.isArray(s.serverResume && s.serverResume.attempts) ? s.serverResume.attempts : [];
    const rows = portfolio.concat(serverRecords, serverAttempts);
    const best = {};

    for (let sid = 1; sid <= 15; sid++) {
      best[sid] = {};
      SKILLS.forEach(skill => { best[sid][skill] = 0; });
    }

    rows.forEach(entry => {
      const sid = normalizeSession(entry && (entry.session || entry.sessionId || entry.routeId || entry.sessionCode));
      const skill = normalizeSkill(entry && (entry.skill || entry.skillName || entry.evidenceType || entry.taskId || entry.type));
      if (!sid || !skill) return;
      best[sid][skill] = Math.max(best[sid][skill] || 0, entryScore(entry));
    });

    return best;
  }

  function injectStyle(){
    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }
    style.textContent = `
      .${GUARD_CLASS}{
        margin-top:10px;
        padding:12px 14px;
        border-radius:14px;
        background:#fff7ed;
        border:2px solid rgba(234,88,12,.34);
        color:#7c2d12;
        font:800 12px/1.45 Arial,'Noto Sans Thai',sans-serif;
      }
      .${GUARD_CLASS}.ok{
        background:#ecfdf5;
        border-color:rgba(16,185,129,.42);
        color:#065f46;
      }
      .${GUARD_CLASS} .title{display:block;font-size:14px;margin-bottom:5px;color:#9a3412}
      .${GUARD_CLASS}.ok .title{color:#065f46}
      .${GUARD_CLASS} .condition{display:block;margin-bottom:6px}
      .${GUARD_CLASS} .row{display:block;margin:2px 0}
      .${GUARD_CLASS} .pass{color:#047857}
      .${GUARD_CLASS} .todo{color:#a16207}
      .${GUARD_CLASS} .support{color:#2563eb}
      .${GUARD_CLASS} .progress{display:block;margin-top:7px;padding-top:6px;border-top:1px solid rgba(124,45,18,.18);font-size:13px}

      .${CONTROL_CLASS}{position:relative!important;min-height:70px!important;padding-top:30px!important;overflow:visible!important}
      .${CONTROL_CLASS}.required{outline:3px solid #f59e0b!important;outline-offset:2px!important}
      .${CONTROL_CLASS}.required.passed{outline-color:#16a34a!important}
      .${CONTROL_CLASS}.support{opacity:.9!important}
      .${BADGE_CLASS}{
        position:absolute!important;z-index:999!important;top:4px!important;left:50%!important;
        transform:translateX(-50%)!important;white-space:nowrap!important;
        padding:4px 9px!important;border-radius:999px!important;
        font:900 10px/1.2 Arial,'Noto Sans Thai',sans-serif!important;
        pointer-events:none!important;
      }
      .${CONTROL_CLASS}.required .${BADGE_CLASS}{background:#f59e0b!important;color:#431407!important}
      .${CONTROL_CLASS}.required.passed .${BADGE_CLASS}{background:#16a34a!important;color:#fff!important}
      .${CONTROL_CLASS}.support .${BADGE_CLASS}{background:#dbeafe!important;color:#1e3a8a!important}
      @media(max-width:700px){
        .${CONTROL_CLASS}{min-height:62px!important;padding-top:27px!important}
        .${BADGE_CLASS}{font-size:9px!important;padding:3px 6px!important}
      }
    `;
  }

  function sessionCardNodes(){
    const nodes = Array.from(document.querySelectorAll('#app div,#app section,#app article'));
    return nodes.filter(node => {
      const t = text(node.textContent);
      if (!/^SESSION\s+(1[0-5]|[1-9])\b/i.test(t)) return false;
      const rect = node.getBoundingClientRect();
      return rect.width >= 120 && rect.height >= 80 && rect.height <= 520;
    });
  }

  function sessionFromNode(node){
    const m = text(node.textContent).match(/^SESSION\s+(1[0-5]|[1-9])\b/i);
    return m ? Number(m[1]) : 0;
  }

  function modelFor(sid, best){
    const required = REQUIRED[sid] || ['Reading','Writing'];
    return SKILLS.map(skill => {
      const score = best[sid] && best[sid][skill] ? best[sid][skill] : 0;
      return {
        skill,
        required: required.includes(skill),
        score,
        pass: score >= PASS_MARK
      };
    });
  }

  function htmlFor(sid, best){
    const model = modelFor(sid, best);
    const requiredRows = model.filter(row => row.required);
    const supportRows = model.filter(row => !row.required);
    const passedCount = requiredRows.filter(row => row.pass).length;
    const complete = passedCount === requiredRows.length;
    const next = sid < 15 ? 'S' + (sid + 1) : 'Boss/Completion';

    const rows = requiredRows.map(row =>
      '<span class="row ' + (row.pass ? 'pass' : 'todo') + '">' +
      (row.pass ? '✓ ' : '○ ') + '<b>' + row.skill + '</b> — บังคับ: ' +
      (row.score ? row.score + '/60' : 'ยังไม่พบหลักฐาน') + '</span>'
    ).join('');

    const supportText = supportRows.map(row => row.skill).join(' + ');

    return '<strong class="title">เงื่อนไขบังคับของ S' + sid + '</strong>' +
      '<span class="condition">ต้องผ่าน <b>' + requiredRows.map(row => row.skill).join(' + ') +
      '</b> อย่างน้อย 60 คะแนนต่อ Skill จึงปลดล็อก <b>' + next + '</b></span>' +
      rows +
      '<span class="row support">Skill เสริม: ' + supportText + ' — ทำเพิ่มได้ แต่ใช้แทน Skill บังคับไม่ได้</span>' +
      '<span class="progress ' + (complete ? 'pass' : 'todo') + '">สถานะ Skill บังคับ: <b>' +
      passedCount + '/' + requiredRows.length + ' ผ่านแล้ว</b></span>';
  }

  function skillControl(node, skill){
    const candidates = Array.from(node.querySelectorAll('button,[role="button"],a,div,span'));
    return candidates
      .filter(el => {
        const label = text(el.textContent);
        if (!label || label.length > 30) return false;
        if (!new RegExp('(?:^|\\s)' + skill + '(?:$|\\s)','i').test(label)) return false;
        const rect = el.getBoundingClientRect();
        return rect.width >= 90 && rect.height >= 25;
      })
      .sort((a,b) => {
        const aInteractive = a.matches('button,[role="button"],a') ? 0 : 1;
        const bInteractive = b.matches('button,[role="button"],a') ? 0 : 1;
        if (aInteractive !== bInteractive) return aInteractive - bInteractive;
        return a.getBoundingClientRect().width - b.getBoundingClientRect().width;
      })[0] || null;
  }

  function patchSkillControls(node, sid, best){
    const model = modelFor(sid, best);

    model.forEach(row => {
      const control = skillControl(node, row.skill);
      if (!control) return;

      control.classList.add(CONTROL_CLASS);
      control.classList.toggle('required', row.required);
      control.classList.toggle('support', !row.required);
      control.classList.toggle('passed', row.required && row.pass);
      control.dataset.eapSkill = row.skill;
      control.dataset.eapRequirement = row.required ? 'required' : 'support';
      control.dataset.eapScore = String(row.score || 0);

      let badge = control.querySelector(':scope > .' + BADGE_CLASS);
      if (!badge) {
        badge = document.createElement('span');
        badge.className = BADGE_CLASS;
        badge.setAttribute('aria-hidden','true');
        control.appendChild(badge);
      }

      badge.textContent = row.required
        ? (row.pass ? '✓ บังคับ · ผ่านแล้ว' : '★ บังคับ · ต้องผ่าน')
        : 'เสริม · ทำเพิ่มได้';
    });
  }

  function patchCards(force){
    const app = document.getElementById('app');
    if (!app) return;
    injectStyle();

    const appKey = text(app.textContent).slice(0, 1600);
    const best = strictPortfolioBest();
    const dataKey = JSON.stringify(best);

    if (!force && appKey === lastAppTextKey && dataKey === lastDataKey) return;

    lastAppTextKey = appKey;
    lastDataKey = dataKey;

    sessionCardNodes().forEach(node => {
      const sid = sessionFromNode(node);
      if (!sid) return;

      patchSkillControls(node, sid, best);

      const model = modelFor(sid, best);
      const requiredRows = model.filter(row => row.required);
      const complete = requiredRows.every(row => row.pass);
      const key = JSON.stringify(model);
      let guard = node.querySelector(':scope > .' + GUARD_CLASS);
      const html = htmlFor(sid, best);

      if (!guard) {
        guard = document.createElement('div');
        node.appendChild(guard);
      }

      guard.className = GUARD_CLASS + (complete ? ' ok' : '');
      guard.dataset.session = String(sid);
      guard.dataset.truthKey = key;
      guard.dataset.version = VERSION;
      if (guard.innerHTML !== html) guard.innerHTML = html;
    });
  }

  function schedule(force){
    clearTimeout(timer);
    timer = setTimeout(() => patchCards(!!force), 120);
  }

  function loadResultScoreClarity(){
    if (window.EAPResultScoreClarityV128) return;
    if (document.querySelector('script[data-eap-result-score-clarity="v128"]')) return;
    const script = document.createElement('script');
    script.src = './eap-result-score-clarity-v128.js?v=20260802-result-score-clarity-v128-production';
    script.async = false;
    script.dataset.eapResultScoreClarity = 'v128';
    document.head.appendChild(script);
  }

  function start(){
    loadResultScoreClarity();
    schedule(true);
    const observer = new MutationObserver(mutations => {
      if (mutations.some(m => !(m.target && m.target.closest && m.target.closest('.' + GUARD_CLASS)))) {
        schedule(false);
      }
    });
    observer.observe(document.getElementById('app') || document.documentElement, {childList:true,subtree:true,characterData:true});
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
