/* EAP Hero v125 — Four-Skill Completion & Replay Guidance
   Student-facing layer only. It reads the saved portfolio and makes the
   required completion rule visible without changing assessment results.
*/
(() => {
  'use strict';

  const STATE_KEY = 'EAP_HERO_PROGRESS_V3';
  const SKILLS = ['Reading', 'Writing', 'Listening', 'Speaking'];
  const PASS_MARK = 60;

  const css = `
    .eap-four-skill-status{margin:14px 0 4px;padding:14px;border:1px solid #cfe0ee;border-radius:16px;background:#f8fbff;color:#102033}
    .eap-four-skill-status h3{margin:0 0 5px;font-size:16px}.eap-four-skill-status p{margin:0 0 10px;color:#53657d;font-size:13px}
    .eap-four-skill-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
    .eap-four-skill-chip{border-radius:10px;padding:9px 10px;font-size:12px;font-weight:800;background:#eef3f8;color:#43566c}
    .eap-four-skill-chip.pass{background:#dff7ed;color:#087f5b}.eap-four-skill-chip.todo{background:#fff1d8;color:#a85f00}
    .eap-four-skill-note{margin-top:10px;font-weight:800;color:#17375e}
    .eap-skill-replay-note{display:block;margin-top:5px;font-size:11px;font-weight:800}.eap-skill-replay-note.pass{color:#087f5b}.eap-skill-replay-note.todo{color:#a85f00}
    @media(max-width:720px){.eap-four-skill-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
  `;

  function addCss(){
    if (document.getElementById('eap-four-skill-style')) return;
    const style = document.createElement('style');
    style.id = 'eap-four-skill-style';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function state(){
    try { return JSON.parse(localStorage.getItem(STATE_KEY) || '{}'); }
    catch (_) { return {}; }
  }

  function toNum(value){
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function sessionId(){
    const app = document.getElementById('app');
    const text = String(app?.innerText || '');
    const found = text.match(/Session\s*:?\s*(1[0-5]|[1-9])\b/i);
    return found ? Number(found[1]) : 0;
  }

  function evidenceFor(sid){
    const s = state();
    const portfolio = Array.isArray(s.portfolio) ? s.portfolio : [];
    const best = {};
    SKILLS.forEach(skill => best[skill] = 0);
    portfolio.forEach(entry => {
      const entrySession = Number(entry?.session || entry?.sessionId || 0);
      const skill = String(entry?.skill || '');
      if (entrySession !== sid || !Object.prototype.hasOwnProperty.call(best, skill)) return;
      const score = toNum(entry?.latestScore ?? entry?.score);
      best[skill] = Math.max(best[skill], score);
    });
    return best;
  }

  function summaryHtml(sid, best){
    const done = SKILLS.filter(skill => best[skill] >= PASS_MARK).length;
    const chips = SKILLS.map(skill => {
      const score = best[skill];
      const pass = score >= PASS_MARK;
      return `<div class="eap-four-skill-chip ${pass ? 'pass' : 'todo'}">${pass ? '✓' : '○'} ${skill}: ${score ? score + '/100' : 'ยังไม่ทำ'}</div>`;
    }).join('');
    const complete = done === SKILLS.length;
    return `<section class="eap-four-skill-status" data-eap-four-skill="${sid}">
      <h3>ภารกิจ Session ${sid}: ทำให้ครบ 4 Skills</h3>
      <p>ผ่านแต่ละ Skill ที่ 60/100 ขึ้นไป · เล่นซ้ำได้ทุก Skill และระบบใช้คะแนนดีที่สุด</p>
      <div class="eap-four-skill-grid">${chips}</div>
      <div class="eap-four-skill-note">${complete ? '✓ Session Complete — พร้อมไปด่านถัดไป / Boss Gate' : `เหลือ ${SKILLS.length - done} Skill ที่ต้องผ่านก่อน Session นี้สมบูรณ์`}</div>
    </section>`;
  }

  function findSkillButton(skill){
    const nodes = Array.from(document.querySelectorAll('#app button, #app a'));
    return nodes.find(node => new RegExp(`\\b${skill}\\b`, 'i').test(String(node.textContent || '')));
  }

  function decorateButtons(best){
    SKILLS.forEach(skill => {
      const button = findSkillButton(skill);
      if (!button) return;
      const pass = best[skill] >= PASS_MARK;
      let note = button.parentElement?.querySelector(`.eap-skill-replay-note[data-skill="${skill}"]`);
      if (!note) {
        note = document.createElement('span');
        note.className = 'eap-skill-replay-note';
        note.dataset.skill = skill;
        button.insertAdjacentElement('afterend', note);
      }
      note.className = `eap-skill-replay-note ${pass ? 'pass' : 'todo'}`;
      note.textContent = pass
        ? `✓ ผ่านแล้ว ${best[skill]}/100 · เล่นซ้ำได้เพื่อพัฒนาคะแนน`
        : `○ ยังต้องผ่าน 60/100 · กดฝึก Skill นี้ต่อ`;
    });
  }

  function render(){
    addCss();
    const sid = sessionId();
    if (!sid) return;
    const app = document.getElementById('app');
    if (!app) return;
    const best = evidenceFor(sid);
    const old = app.querySelector('.eap-four-skill-status');
    const target = app.querySelector('.session-path-panel') || app.querySelector('section.panel') || app.querySelector('section');
    if (!target) return;
    if (old) old.remove();
    const heading = target.querySelector('h1,h2,h3');
    if (heading) heading.insertAdjacentHTML('afterend', summaryHtml(sid, best));
    else target.insertAdjacentHTML('afterbegin', summaryHtml(sid, best));
    decorateButtons(best);
  }

  let timer;
  function schedule(){ clearTimeout(timer); timer = setTimeout(render, 80); }
  window.addEventListener('load', schedule);
  new MutationObserver(schedule).observe(document.documentElement, {childList:true, subtree:true});
  window.EAPFourSkillProgressV125 = { render };
})();
