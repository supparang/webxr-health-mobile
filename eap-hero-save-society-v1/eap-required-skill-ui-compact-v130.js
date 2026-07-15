/* EAP Hero v131 — Compact Required/Optional Skill Hub
   - Replaces the oversized v129 summary/card layout shown in the live Session hub.
   - Moves the four existing native skill buttons into one balanced 2x2 grid.
   - Keeps the original button nodes and click handlers intact.
   - Visual-only: does not change score, pass/fail, unlock, Sheet, or evidence.
*/
(() => {
  'use strict';

  const PASS_MARK = 60;
  const ALL_SKILLS = ['Reading', 'Writing', 'Listening', 'Speaking'];
  const REQUIRED_BY_SESSION = {
    1:['Reading','Speaking'], 2:['Reading','Writing'], 3:['Reading','Writing'],
    4:['Reading','Listening'], 5:['Reading','Speaking'], 6:['Reading','Writing'],
    7:['Writing','Speaking'], 8:['Reading','Writing'], 9:['Writing','Speaking'],
    10:['Reading','Writing'], 11:['Writing','Speaking'], 12:['Reading','Writing'],
    13:['Listening','Writing'], 14:['Writing','Speaking'], 15:['Writing','Speaking']
  };

  const css = `
    .eap-rs-summary{display:none!important}
    .eap-rs-score,.eap-skill-score-line{display:none!important}

    .eap-compact-skill-shell{
      width:100%!important;margin:14px 0 10px!important;padding:0!important;
      display:block!important;clear:both!important;
    }
    .eap-compact-skill-summary{
      display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;
      gap:8px 14px!important;align-items:center!important;
      margin:0 0 10px!important;padding:12px 14px!important;
      border:1px solid #9fded8!important;border-radius:14px!important;
      background:#effcfb!important;color:#102033!important;box-shadow:none!important;
    }
    .eap-compact-skill-title{font-size:15px!important;line-height:1.25!important;font-weight:900!important}
    .eap-compact-skill-help{margin-top:3px!important;font-size:11px!important;line-height:1.4!important;color:#53657d!important;font-weight:700!important}
    .eap-compact-skill-count{padding:6px 10px!important;border-radius:999px!important;background:#12375a!important;color:#fff!important;font-size:11px!important;font-weight:900!important;white-space:nowrap!important}
    .eap-compact-skill-chips{grid-column:1/-1!important;display:flex!important;flex-wrap:wrap!important;gap:7px!important}
    .eap-compact-skill-chip{padding:6px 9px!important;border-radius:999px!important;font-size:11px!important;line-height:1.15!important;font-weight:850!important}
    .eap-compact-skill-chip.pass{background:#dff8ea!important;color:#08784f!important}
    .eap-compact-skill-chip.todo{background:#fff0d7!important;color:#8e5200!important}
    .eap-compact-skill-optional{grid-column:1/-1!important;font-size:11px!important;line-height:1.35!important;color:#607085!important;font-weight:750!important}

    .eap-compact-skill-grid{
      display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;
      gap:10px!important;width:100%!important;margin:0!important;padding:0!important;
      align-items:stretch!important;
    }
    .eap-compact-skill-grid > .eap-compact-skill-button{
      width:100%!important;min-width:0!important;min-height:88px!important;height:auto!important;
      margin:0!important;padding:13px 14px!important;border-radius:16px!important;
      display:flex!important;flex-direction:column!important;align-items:center!important;
      justify-content:center!important;gap:5px!important;text-align:center!important;
      overflow:hidden!important;opacity:1!important;outline:none!important;
      box-shadow:0 6px 15px rgba(16,32,51,.10)!important;
      transform:none!important;position:relative!important;inset:auto!important;
    }
    .eap-compact-skill-button.eap-compact-required{
      border:2px solid #27a6ff!important;background:linear-gradient(135deg,#75d6f4,#9cf0cf)!important;
    }
    .eap-compact-skill-button.eap-compact-optional{
      border:1px solid #9ed8dd!important;background:linear-gradient(135deg,#83d7f3,#9cebcf)!important;
    }
    .eap-compact-skill-button.is-passed{border-color:#18a873!important}
    .eap-compact-skill-button .eap-rs-badge,
    .eap-compact-skill-button .eap-skill-type-badge{
      display:inline-flex!important;position:static!important;inset:auto!important;
      margin:0!important;padding:4px 8px!important;border-radius:999px!important;
      font-size:10px!important;line-height:1!important;font-weight:900!important;white-space:nowrap!important;
    }
    .eap-compact-skill-button .required{background:#0b84ff!important;color:#fff!important;border:0!important}
    .eap-compact-skill-button .optional{background:#edf2f7!important;color:#52657c!important;border:1px solid #cbd6e0!important}
    .eap-skill-compact-meta{display:block!important;font-size:10px!important;line-height:1.3!important;font-weight:800!important;text-align:center!important;color:#496176!important}
    .eap-compact-required .eap-skill-compact-meta{color:#075c88!important}

    @media(max-width:720px){
      .eap-compact-skill-summary{grid-template-columns:1fr auto!important;padding:11px!important}
      .eap-compact-skill-grid{grid-template-columns:1fr!important;gap:8px!important}
      .eap-compact-skill-grid > .eap-compact-skill-button{min-height:72px!important;padding:11px 12px!important}
    }
  `;

  function addCss(){
    let style = document.getElementById('eap-required-skill-compact-v130-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'eap-required-skill-compact-v130-style';
      document.head.appendChild(style);
    }
    style.textContent = css;
  }

  function text(v){ return String(v == null ? '' : v).replace(/\s+/g,' ').trim(); }

  function sessionNo(){
    const candidates = [
      window.EAPLiveSheetRouteFinalizer?.currentRoute,
      window.EAPHero?.state?.currentCloudRoute,
      window.EAPHero?.state?.currentRoute,
      window.EAPHero?.state?.currentSession,
      document.querySelector('[aria-current="page"],.active,[aria-selected="true"]')?.textContent,
      ...Array.from(document.querySelectorAll('#app h1,#app h2,#app h3')).map(n => n.textContent)
    ];
    for (const value of candidates) {
      const m = text(value).match(/(?:Session\s*:?\s*|\bS)0?(1[0-5]|[1-9])\b/i);
      if (m) return Number(m[1]);
    }
    return 0;
  }

  function skillButtons(){
    const app = document.getElementById('app');
    if (!app) return {};
    const clickables = [...app.querySelectorAll('button,a,[role="button"],.skill-btn,.skill-card')]
      .filter(el => el.offsetParent !== null);
    const result = {};
    ALL_SKILLS.forEach(skill => {
      const rx = new RegExp(`\\b${skill}\\b`, 'i');
      result[skill] = clickables
        .filter(el => rx.test(text(el.textContent)))
        .sort((a,b) => text(a.textContent).length - text(b.textContent).length)[0] || null;
    });
    return result;
  }

  function scoreMap(sid){
    if (window.EAPTwoSkillProgressV128?.evidenceFor) {
      try { return window.EAPTwoSkillProgressV128.evidenceFor(sid) || {}; } catch (_) {}
    }
    if (window.EAPRequiredSkillUIV129?.requiredSkills) {
      const best = {};
      ALL_SKILLS.forEach(s => best[s] = 0);
      try {
        const state = JSON.parse(localStorage.getItem('EAP_HERO_PROGRESS_V3') || '{}');
        const rows = [...(Array.isArray(state.portfolio) ? state.portfolio : []), ...(window.EAPLiveSheetRouteFinalizer?.records || [])];
        rows.forEach(r => {
          const sm = text(r?.session || r?.sessionId || r?.routeId).match(/(?:Session\s*:?\s*|\bS)0?(1[0-5]|[1-9])\b/i);
          const sk = ALL_SKILLS.find(s => text(r?.skill || r?.skillName || r?.type).toLowerCase().includes(s.toLowerCase()));
          if (!sm || Number(sm[1]) !== sid || !sk) return;
          best[sk] = Math.max(best[sk], Number(r?.bestScore ?? r?.latestScore ?? r?.score ?? 0) || 0);
        });
      } catch (_) {}
      return best;
    }
    return Object.fromEntries(ALL_SKILLS.map(s => [s,0]));
  }

  function topChild(node, root){
    let current = node;
    while (current?.parentElement && current.parentElement !== root) current = current.parentElement;
    return current;
  }

  function commonRoot(nodes){
    let root = nodes[0]?.parentElement;
    while (root && root.id !== 'app') {
      if (nodes.every(n => root.contains(n))) return root;
      root = root.parentElement;
    }
    return document.getElementById('app');
  }

  function render(){
    addCss();
    const sid = sessionNo();
    if (!sid) return;

    const map = skillButtons();
    const buttons = ALL_SKILLS.map(s => map[s]).filter(Boolean);
    if (buttons.length < 4 || new Set(buttons).size < 4) return;

    const required = REQUIRED_BY_SESSION[sid] || ['Reading','Writing'];
    const optional = ALL_SKILLS.filter(s => !required.includes(s));
    const scores = scoreMap(sid);
    const passedCount = required.filter(s => Number(scores?.[s] || 0) >= PASS_MARK).length;

    // Remove the oversized renderer output and detached status text.
    document.querySelectorAll('.eap-rs-summary,.eap-rs-score,.eap-skill-score-line').forEach(n => n.remove());

    let shell = document.querySelector(`.eap-compact-skill-shell[data-session="${sid}"]`);
    if (!shell) {
      const root = commonRoot(buttons);
      const anchor = topChild(buttons[0], root) || buttons[0];
      shell = document.createElement('section');
      shell.className = 'eap-compact-skill-shell';
      shell.dataset.session = String(sid);
      shell.innerHTML = '<div class="eap-compact-skill-summary"></div><div class="eap-compact-skill-grid"></div>';
      anchor.parentElement.insertBefore(shell, anchor);
    }

    const summary = shell.querySelector('.eap-compact-skill-summary');
    const chips = required.map(skill => {
      const score = Number(scores?.[skill] || 0);
      const passed = score >= PASS_MARK;
      return `<span class="eap-compact-skill-chip ${passed ? 'pass' : 'todo'}">${passed ? '✓' : '○'} ${skill} · ${score ? score + '/100' : 'ยังไม่ทำ'}</span>`;
    }).join('');
    summary.innerHTML = `
      <div><div class="eap-compact-skill-title">🎯 Skill บังคับ Session ${sid}</div><div class="eap-compact-skill-help">ผ่าน 2 ทักษะ ทักษะละอย่างน้อย 60/100 เพื่อไป Session ถัดไป</div></div>
      <div class="eap-compact-skill-count">ผ่าน ${passedCount}/2</div>
      <div class="eap-compact-skill-chips">${chips}</div>
      <div class="eap-compact-skill-optional">Skill เสริม: ${optional.join(' · ')} — ฝึกได้ แต่ไม่ใช้ปลดล็อก</div>`;

    const grid = shell.querySelector('.eap-compact-skill-grid');
    ALL_SKILLS.forEach(skill => {
      const button = map[skill];
      if (!button) return;
      const isRequired = required.includes(skill);
      const score = Number(scores?.[skill] || 0);
      const passed = score >= PASS_MARK;

      // Moving the existing node preserves its native click listener.
      if (button.parentElement !== grid) grid.appendChild(button);
      button.classList.remove('eap-rs-required','eap-skill-required','eap-skill-optional');
      button.classList.add('eap-compact-skill-button', isRequired ? 'eap-compact-required' : 'eap-compact-optional');
      button.classList.toggle('is-passed', passed);

      let badge = button.querySelector('.eap-rs-badge,.eap-skill-type-badge');
      if (!badge) {
        badge = document.createElement('span');
        button.appendChild(badge);
      }
      badge.className = `eap-skill-type-badge ${isRequired ? 'required' : 'optional'}`;
      badge.textContent = isRequired ? 'บังคับ' : 'เสริม';

      let meta = button.querySelector('.eap-skill-compact-meta');
      if (!meta) {
        meta = document.createElement('small');
        meta.className = 'eap-skill-compact-meta';
        button.appendChild(meta);
      }
      meta.textContent = isRequired
        ? (passed ? `ผ่านแล้ว ${score}/100 · เล่นซ้ำได้` : `ต้องผ่าน 60/100${score ? ` · ตอนนี้ ${score}/100` : ''}`)
        : (score ? `ฝึกเสริม · คะแนนดีที่สุด ${score}/100` : 'ฝึกเพิ่มได้ · ไม่ใช้ปลดล็อก');
    });

    // Hide empty layout wrappers left behind by the original four-card renderer.
    const app = document.getElementById('app');
    [...app.querySelectorAll('div,section')].forEach(el => {
      if (el === shell || shell.contains(el) || el.contains(shell)) return;
      if (!text(el.textContent) && el.children.length === 0) el.style.display = 'none';
    });
  }

  let timer = 0;
  function schedule(){ clearTimeout(timer); timer = setTimeout(render, 120); }
  window.addEventListener('load', schedule);
  ['eap:resume-synced','eap:route-changed','eap:profile-saved'].forEach(e => window.addEventListener(e, schedule));
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
  setInterval(render, 1500);

  window.EAPRequiredSkillUICompactV130 = {render,version:'v20260715-v131-compact-grid-fix'};
})();