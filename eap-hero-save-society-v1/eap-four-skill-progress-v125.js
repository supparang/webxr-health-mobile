/* EAP Hero v127 — Two-Required-Skill Completion & Replay Guidance
   Each session requires exactly two agreed core skills at 60/100.
   The other two skills are optional practice and never block progression.
   V127 fixes S-prefixed session IDs from Cloud/Sheet evidence, e.g. S1.
*/
(() => {
  'use strict';

  const STATE_KEY = 'EAP_HERO_PROGRESS_V3';
  const ALL_SKILLS = ['Reading', 'Writing', 'Listening', 'Speaking'];
  const PASS_MARK = 60;

  /* Agreed required pair for every session. */
  const REQUIRED_BY_SESSION = {
    1: ['Reading', 'Speaking'],
    2: ['Reading', 'Writing'],
    3: ['Reading', 'Writing'],
    4: ['Reading', 'Listening'],
    5: ['Reading', 'Speaking'],
    6: ['Reading', 'Writing'],
    7: ['Writing', 'Speaking'],
    8: ['Reading', 'Writing'],
    9: ['Writing', 'Speaking'],
    10: ['Reading', 'Writing'],
    11: ['Writing', 'Speaking'],
    12: ['Reading', 'Writing'],
    13: ['Listening', 'Writing'],
    14: ['Writing', 'Speaking'],
    15: ['Writing', 'Speaking']
  };

  const css = `
    .eap-two-skill-status{margin:14px 0 4px;padding:14px;border:1px solid #cfe0ee;border-radius:16px;background:#f8fbff;color:#102033}
    .eap-two-skill-status h3{margin:0 0 5px;font-size:16px}.eap-two-skill-status p{margin:0 0 10px;color:#53657d;font-size:13px}
    .eap-two-skill-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
    .eap-two-skill-chip{border-radius:10px;padding:9px 10px;font-size:12px;font-weight:800;background:#eef3f8;color:#43566c}
    .eap-two-skill-chip.pass{background:#dff7ed;color:#087f5b}.eap-two-skill-chip.todo{background:#fff1d8;color:#a85f00}
    .eap-optional-skills{margin-top:10px;font-size:12px;color:#607085}
    .eap-two-skill-note{margin-top:10px;font-weight:800;color:#17375e}
    .eap-skill-replay-note{display:block;margin-top:5px;font-size:11px;font-weight:800}.eap-skill-replay-note.pass{color:#087f5b}.eap-skill-replay-note.todo{color:#a85f00}.eap-skill-replay-note.optional{color:#53657d}
    @media(max-width:720px){.eap-two-skill-grid{grid-template-columns:1fr}}
  `;

  function addCss(){
    if (document.getElementById('eap-two-skill-style')) return;
    const style = document.createElement('style');
    style.id = 'eap-two-skill-style';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function state(){
    try { return JSON.parse(localStorage.getItem(STATE_KEY) || '{}'); }
    catch (_) { return {}; }
  }

  function text(value){
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  }

  function toNum(value){
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function normalizeSessionNo(value){
    const raw = text(value).toUpperCase();
    if (!raw) return 0;
    const s = raw.match(/^S(?:ESSION)?\s*0?(1[0-5]|[1-9])$/);
    if (s) return Number(s[1]);
    if (/^0?(1[0-5]|[1-9])$/.test(raw)) return Number(raw);
    const mixed = raw.match(/(?:^|\b)S(?:ESSION)?\s*0?(1[0-5]|[1-9])(?:\b|_)/);
    return mixed ? Number(mixed[1]) : 0;
  }

  function normalizeSkill(value){
    const raw = text(value).toLowerCase();
    return ALL_SKILLS.find(skill => raw === skill.toLowerCase() || raw.indexOf(skill.toLowerCase()) >= 0) || '';
  }

  function sessionId(){
    const app = document.getElementById('app');
    const pageText = String(app?.innerText || '');
    const found = pageText.match(/Session\s*:?[\s]*(1[0-5]|[1-9])\b/i);
    return found ? Number(found[1]) : 0;
  }

  function requiredSkills(sid){
    return REQUIRED_BY_SESSION[sid] || ['Reading', 'Writing'];
  }

  function evidenceFor(sid){
    const s = state();
    const portfolio = Array.isArray(s.portfolio) ? s.portfolio : [];
    const sessionProgress = s.sessionProgress && typeof s.sessionProgress === 'object' ? s.sessionProgress : {};
    const routeStatus = s.routeStatus && typeof s.routeStatus === 'object' ? s.routeStatus : {};
    const best = {};
    ALL_SKILLS.forEach(skill => { best[skill] = 0; });

    /* 1) Prefer portfolio/recent evidence. V126 missed records like sessionId:'S1'. */
    portfolio.forEach(entry => {
      const entrySession = normalizeSessionNo(entry?.session || entry?.sessionId || entry?.routeId || entry?.sessionCode);
      const skill = normalizeSkill(entry?.skill || entry?.skillName || entry?.evidenceType || entry?.taskId || entry?.type);
      if (entrySession !== sid || !skill) return;
      const score = toNum(entry?.latestScore ?? entry?.score ?? entry?.bestScore);
      best[skill] = Math.max(best[skill], score);
    });

    /* 2) Merge Cloud Resume sessionProgress/routeStatus, so restored Sheet rows appear immediately. */
    const keys = ['S' + sid, String(sid), 's' + sid];
    keys.forEach(key => {
      [sessionProgress[key], routeStatus[key]].forEach(row => {
        if (!row) return;
        const scores = row.scores && typeof row.scores === 'object' ? row.scores : {};
        ALL_SKILLS.forEach(skill => {
          best[skill] = Math.max(best[skill], toNum(scores[skill]));
        });
        if (Array.isArray(row.passed)) {
          row.passed.forEach(skillName => {
            const skill = normalizeSkill(skillName);
            if (skill) best[skill] = Math.max(best[skill], PASS_MARK);
          });
        }
      });
    });

    return best;
  }

  function summaryHtml(sid, best){
    const required = requiredSkills(sid);
    const optional = ALL_SKILLS.filter(skill => !required.includes(skill));
    const done = required.filter(skill => best[skill] >= PASS_MARK).length;
    const chips = required.map(skill => {
      const score = best[skill];
      const pass = score >= PASS_MARK;
      return `<div class="eap-two-skill-chip ${pass ? 'pass' : 'todo'}">${pass ? '✓' : '○'} ${skill}: ${score ? score + '/100' : 'ยังไม่ทำ'}</div>`;
    }).join('');
    const complete = done === required.length;
    return `<section class="eap-two-skill-status" data-eap-two-skill="${sid}">
      <h3>ภารกิจ Session ${sid}: ผ่าน Skill บังคับ 2 Skills</h3>
      <p>Skill บังคับผ่านที่ 60/100 ขึ้นไป · เล่นซ้ำได้ทุก Skill และระบบใช้คะแนนดีที่สุด</p>
      <div class="eap-two-skill-grid">${chips}</div>
      <div class="eap-optional-skills">Skill เสริม (ไม่บังคับเพื่อปลดล็อก): ${optional.join(' · ')}</div>
      <div class="eap-two-skill-note">${complete ? '✓ Session Complete — พร้อมไปด่านถัดไป / Boss Gate' : `เหลือ ${required.length - done} Skill บังคับที่ต้องผ่านก่อน Session นี้สมบูรณ์`}</div>
    </section>`;
  }

  function findSkillButton(skill){
    const nodes = Array.from(document.querySelectorAll('#app button, #app a'));
    return nodes.find(node => new RegExp(`\\b${skill}\\b`, 'i').test(String(node.textContent || '')));
  }

  function decorateButtons(best, required){
    ALL_SKILLS.forEach(skill => {
      const button = findSkillButton(skill);
      if (!button) return;
      const isRequired = required.includes(skill);
      const pass = best[skill] >= PASS_MARK;
      let note = button.parentElement?.querySelector(`.eap-skill-replay-note[data-skill="${skill}"]`);
      if (!note) {
        note = document.createElement('span');
        note.className = 'eap-skill-replay-note';
        note.dataset.skill = skill;
        button.insertAdjacentElement('afterend', note);
      }
      if (!isRequired) {
        note.className = 'eap-skill-replay-note optional';
        note.textContent = pass
          ? `✓ Skill เสริมผ่านแล้ว ${best[skill]}/100 · เล่นซ้ำได้เพื่อพัฒนา`
          : '◇ Skill เสริม · ฝึกเพิ่มได้ แต่ไม่บังคับเพื่อปลดล็อก';
        return;
      }
      note.className = `eap-skill-replay-note ${pass ? 'pass' : 'todo'}`;
      note.textContent = pass
        ? `✓ Skill บังคับผ่านแล้ว ${best[skill]}/100 · เล่นซ้ำได้เพื่อพัฒนาคะแนน`
        : `○ Skill บังคับ · ยังต้องผ่าน 60/100`;
    });
  }

  function render(){
    addCss();
    const sid = sessionId();
    if (!sid) return;
    const app = document.getElementById('app');
    if (!app) return;
    const best = evidenceFor(sid);
    const required = requiredSkills(sid);
    const old = app.querySelector('.eap-two-skill-status, .eap-four-skill-status');
    const target = app.querySelector('.session-path-panel') || app.querySelector('section.panel') || app.querySelector('section');
    if (!target) return;
    if (old) old.remove();
    const heading = target.querySelector('h1,h2,h3');
    if (heading) heading.insertAdjacentHTML('afterend', summaryHtml(sid, best));
    else target.insertAdjacentHTML('afterbegin', summaryHtml(sid, best));
    decorateButtons(best, required);
  }

  let timer;
  function schedule(){ clearTimeout(timer); timer = setTimeout(render, 80); }
  window.addEventListener('load', schedule);
  window.addEventListener('storage', schedule);
  window.addEventListener('eap:resume-synced', schedule);
  window.addEventListener('eap:profile-saved', schedule);
  new MutationObserver(schedule).observe(document.documentElement, {childList:true, subtree:true});
  window.EAPTwoSkillProgressV126 = { render, requiredSkills, evidenceFor, version:'v20260709-v127-s-prefix-fix' };
})();