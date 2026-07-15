/* EAP Hero v128 — Required/Optional Skill UI for S1–S15
   - Exactly two required skills per session, pass mark 60/100.
   - Adds a persistent required-skill summary panel to the current Skill Hub.
   - Adds visible REQUIRED / OPTIONAL badges directly inside all four skill buttons.
   - Uses the current Session route and the real four-skill button group instead of broad section selectors.
   - Does not change scores, pass/fail, unlock rules, Sheet data, or evidence.
*/
(() => {
  'use strict';

  const STATE_KEY = 'EAP_HERO_PROGRESS_V3';
  const ALL_SKILLS = ['Reading', 'Writing', 'Listening', 'Speaking'];
  const PASS_MARK = 60;

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
    .eap-two-skill-status{margin:16px 0 14px;padding:16px;border:1px solid #b8d6ea;border-radius:18px;background:linear-gradient(135deg,#f8fcff,#edf8ff);color:#102033;box-shadow:0 8px 22px rgba(18,53,82,.08)}
    .eap-two-skill-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}
    .eap-two-skill-status h3{margin:0;font-size:17px;line-height:1.3}
    .eap-two-skill-status p{margin:5px 0 0;color:#53657d;font-size:13px}
    .eap-two-skill-counter{border-radius:999px;padding:7px 11px;background:#17375e;color:#fff;font-size:12px;font-weight:900;white-space:nowrap}
    .eap-two-skill-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:12px}
    .eap-two-skill-chip{border-radius:12px;padding:10px 12px;font-size:13px;font-weight:900;border:1px solid transparent}
    .eap-two-skill-chip.pass{background:#dff7ed;color:#087f5b;border-color:#9de1c8}
    .eap-two-skill-chip.todo{background:#fff1d8;color:#9a5700;border-color:#f6cc87}
    .eap-optional-skills{margin-top:10px;padding:9px 11px;border-radius:11px;background:#eef3f8;font-size:12px;color:#53657d;font-weight:800}
    .eap-two-skill-note{margin-top:10px;font-weight:900;color:#17375e;font-size:13px}

    .eap-skill-required,.eap-skill-optional{position:relative!important;overflow:visible!important}
    .eap-skill-required{outline:3px solid rgba(11,132,255,.20)!important;box-shadow:0 8px 20px rgba(11,132,255,.12)!important}
    .eap-skill-optional{opacity:.92}
    .eap-skill-type-badge{display:inline-flex;align-items:center;justify-content:center;margin-left:8px;padding:4px 8px;border-radius:999px;font-size:10px;line-height:1;font-weight:950;letter-spacing:.02em;vertical-align:middle;white-space:nowrap}
    .eap-skill-type-badge.required{background:#0b84ff;color:#fff}
    .eap-skill-type-badge.optional{background:#e9eef4;color:#52657c;border:1px solid #cfd9e4}
    .eap-skill-score-line{display:block;margin-top:6px;font-size:11px;font-weight:900;line-height:1.25}
    .eap-skill-score-line.pass{color:#087f5b}
    .eap-skill-score-line.todo{color:#a85f00}
    .eap-skill-score-line.optional{color:#607085}

    @media(max-width:720px){
      .eap-two-skill-grid{grid-template-columns:1fr}
      .eap-skill-type-badge{display:flex;width:max-content;margin:5px auto 0}
    }
  `;

  function addCss(){
    if (document.getElementById('eap-two-skill-style-v128')) return;
    const style = document.createElement('style');
    style.id = 'eap-two-skill-style-v128';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function readState(){
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
    const exact = raw.match(/^S(?:ESSION)?\s*0?(1[0-5]|[1-9])$/);
    if (exact) return Number(exact[1]);
    if (/^0?(1[0-5]|[1-9])$/.test(raw)) return Number(raw);
    const mixed = raw.match(/(?:^|\b)(?:SESSION\s*:?[\s]*|S)0?(1[0-5]|[1-9])(?:\b|_)/);
    return mixed ? Number(mixed[1]) : 0;
  }

  function normalizeSkill(value){
    const raw = text(value).toLowerCase();
    return ALL_SKILLS.find(skill => raw === skill.toLowerCase() || raw.includes(skill.toLowerCase())) || '';
  }

  function sessionId(){
    const app = document.getElementById('app');
    if (!app) return 0;

    const routeCandidates = [
      window.EAPLiveSheetRouteFinalizer?.currentRoute,
      window.EAPHero?.state?.currentCloudRoute,
      window.EAPHero?.state?.currentRoute,
      window.EAPHero?.state?.currentSession,
      app.querySelector('[aria-current="page"]')?.textContent,
      app.querySelector('.active[data-session], .is-active[data-session], [data-active="true"][data-session]')?.getAttribute('data-session')
    ];
    for (const candidate of routeCandidates) {
      const sid = normalizeSessionNo(candidate);
      if (sid) return sid;
    }

    const headings = Array.from(app.querySelectorAll('h1,h2,h3,.lob-now,.session-title'));
    for (const node of headings) {
      const sid = normalizeSessionNo(node.textContent);
      if (sid) return sid;
    }

    const activeTab = Array.from(app.querySelectorAll('button,a')).find(node => {
      const label = text(node.textContent);
      const active = node.matches('.active,.is-active,[aria-selected="true"],[aria-current="page"]');
      return active && /^S(?:ESSION)?\s*0?(1[0-5]|[1-9])\b/i.test(label);
    });
    return normalizeSessionNo(activeTab?.textContent || app.innerText);
  }

  function requiredSkills(sid){
    return REQUIRED_BY_SESSION[sid] || ['Reading', 'Writing'];
  }

  function evidenceFor(sid){
    const s = readState();
    const portfolio = Array.isArray(s.portfolio) ? s.portfolio : [];
    const sessionProgress = s.sessionProgress && typeof s.sessionProgress === 'object' ? s.sessionProgress : {};
    const routeStatus = s.routeStatus && typeof s.routeStatus === 'object' ? s.routeStatus : {};
    const best = Object.fromEntries(ALL_SKILLS.map(skill => [skill, 0]));

    portfolio.forEach(entry => {
      const entrySession = normalizeSessionNo(entry?.session || entry?.sessionId || entry?.routeId || entry?.sessionCode);
      const skill = normalizeSkill(entry?.skill || entry?.skillName || entry?.evidenceType || entry?.taskId || entry?.type);
      if (entrySession !== sid || !skill) return;
      const score = toNum(entry?.latestScore ?? entry?.score ?? entry?.bestScore);
      best[skill] = Math.max(best[skill], score);
    });

    ['S' + sid, String(sid), 's' + sid].forEach(key => {
      [sessionProgress[key], routeStatus[key]].forEach(row => {
        if (!row) return;
        const scores = row.scores && typeof row.scores === 'object' ? row.scores : {};
        ALL_SKILLS.forEach(skill => { best[skill] = Math.max(best[skill], toNum(scores[skill])); });
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
      return `<div class="eap-two-skill-chip ${pass ? 'pass' : 'todo'}">${pass ? '✓' : '○'} ${skill} · ${score ? score + '/100' : 'ยังไม่ทำ'}</div>`;
    }).join('');
    return `<section class="eap-two-skill-status" data-eap-two-skill="${sid}">
      <div class="eap-two-skill-head">
        <div><h3>🎯 Skill บังคับของ Session ${sid}</h3><p>ต้องผ่านทั้ง 2 ทักษะ ทักษะละอย่างน้อย 60/100 · เล่นซ้ำได้และเก็บคะแนนดีที่สุด</p></div>
        <div class="eap-two-skill-counter">ผ่าน ${done}/2</div>
      </div>
      <div class="eap-two-skill-grid">${chips}</div>
      <div class="eap-optional-skills">◇ Skill เสริม: ${optional.join(' · ')} — ฝึกได้ แต่ไม่ใช้ปลดล็อก Session ถัดไป</div>
      <div class="eap-two-skill-note">${done === 2 ? '✓ Session Complete — พร้อมไปด่านถัดไป / Boss Gate' : `ยังเหลือ ${2 - done} Skill บังคับที่ต้องผ่าน`}</div>
    </section>`;
  }

  function skillButtons(){
    const app = document.getElementById('app');
    if (!app) return {};
    const candidates = Array.from(app.querySelectorAll('button,a,[role="button"]')).filter(node => {
      if (!node.offsetParent) return false;
      const label = text(node.textContent);
      return ALL_SKILLS.some(skill => new RegExp(`(?:^|\\s|[📖✍🎧🎤])${skill}(?:\\s|$)`, 'i').test(label));
    });
    const result = {};
    ALL_SKILLS.forEach(skill => {
      result[skill] = candidates.find(node => new RegExp(`\\b${skill}\\b`, 'i').test(text(node.textContent))) || null;
    });
    return result;
  }

  function commonAncestor(nodes){
    const valid = nodes.filter(Boolean);
    if (!valid.length) return null;
    let current = valid[0];
    while (current && current.id !== 'app') {
      if (valid.every(node => current.contains(node))) return current;
      current = current.parentElement;
    }
    return document.getElementById('app');
  }

  function findHubRoot(buttonMap){
    const app = document.getElementById('app');
    const buttons = Object.values(buttonMap).filter(Boolean);
    if (buttons.length < 2) return null;
    const common = commonAncestor(buttons);
    if (common && common !== app) {
      let node = common;
      while (node.parentElement && node.parentElement !== app) {
        const t = text(node.innerText);
        if (/Session\s*:?[\s]*\d+|Session Path|Skill Mission Hub/i.test(t) && t.length < 2500) return node;
        node = node.parentElement;
      }
      return common;
    }
    return null;
  }

  function decorateButtons(best, required, buttonMap){
    ALL_SKILLS.forEach(skill => {
      const button = buttonMap[skill];
      if (!button) return;
      const isRequired = required.includes(skill);
      const pass = best[skill] >= PASS_MARK;
      button.classList.toggle('eap-skill-required', isRequired);
      button.classList.toggle('eap-skill-optional', !isRequired);

      let badge = button.querySelector(`.eap-skill-type-badge[data-skill="${skill}"]`);
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'eap-skill-type-badge';
        badge.dataset.skill = skill;
        button.appendChild(badge);
      }
      badge.className = `eap-skill-type-badge ${isRequired ? 'required' : 'optional'}`;
      badge.textContent = isRequired ? 'บังคับ' : 'เสริม';

      let scoreLine = button.parentElement?.querySelector(`.eap-skill-score-line[data-skill="${skill}"]`);
      if (!scoreLine) {
        scoreLine = document.createElement('span');
        scoreLine.className = 'eap-skill-score-line';
        scoreLine.dataset.skill = skill;
        button.insertAdjacentElement('afterend', scoreLine);
      }
      if (isRequired) {
        scoreLine.className = `eap-skill-score-line ${pass ? 'pass' : 'todo'}`;
        scoreLine.textContent = pass
          ? `✓ ผ่านแล้ว ${best[skill]}/100 · เล่นซ้ำได้`
          : `○ ต้องผ่านอย่างน้อย 60/100${best[skill] ? ` · ตอนนี้ ${best[skill]}/100` : ''}`;
      } else {
        scoreLine.className = 'eap-skill-score-line optional';
        scoreLine.textContent = best[skill] >= PASS_MARK
          ? `◇ Skill เสริม ${best[skill]}/100 · ไม่ใช้ปลดล็อก`
          : '◇ ฝึกเพิ่มได้ · ไม่ใช้ปลดล็อก';
      }
    });
  }

  let rendering = false;
  let lastFingerprint = '';

  function render(){
    if (rendering) return;
    addCss();
    const sid = sessionId();
    if (!sid) return;
    const buttonMap = skillButtons();
    const visibleCount = Object.values(buttonMap).filter(Boolean).length;
    if (visibleCount < 2) return;

    const root = findHubRoot(buttonMap);
    if (!root) return;
    const best = evidenceFor(sid);
    const required = requiredSkills(sid);
    const fingerprint = [sid, ...ALL_SKILLS.map(s => best[s]), visibleCount].join('|');

    rendering = true;
    try {
      const app = document.getElementById('app');
      app?.querySelectorAll('.eap-two-skill-status,.eap-four-skill-status').forEach(node => node.remove());

      const firstButton = Object.values(buttonMap).find(Boolean);
      let insertionPoint = firstButton;
      while (insertionPoint.parentElement && insertionPoint.parentElement !== root) insertionPoint = insertionPoint.parentElement;
      insertionPoint.insertAdjacentHTML('beforebegin', summaryHtml(sid, best));
      decorateButtons(best, required, buttonMap);
      lastFingerprint = fingerprint;
    } finally {
      rendering = false;
    }
  }

  let timer = 0;
  function schedule(){
    clearTimeout(timer);
    timer = setTimeout(render, 120);
  }

  window.addEventListener('load', schedule);
  window.addEventListener('storage', schedule);
  window.addEventListener('eap:resume-synced', schedule);
  window.addEventListener('eap:profile-saved', schedule);
  window.addEventListener('eap:route-changed', schedule);
  new MutationObserver(() => {
    if (!rendering) schedule();
  }).observe(document.documentElement, {childList:true, subtree:true});

  window.EAPTwoSkillProgressV128 = {
    render,
    requiredSkills,
    evidenceFor,
    version:'v20260715-v128-required-optional-ui'
  };
})();