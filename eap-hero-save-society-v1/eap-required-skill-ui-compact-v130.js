/* EAP Hero v130 — Compact Required/Optional Skill UI
   - Replaces oversized/misaligned required-skill UI with a compact summary bar.
   - Keeps the four native skill buttons in a balanced 2x2 grid.
   - Shows Required/Optional and score/status inside each button only.
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
    .eap-two-skill-status{
      margin:14px 0 12px!important;padding:12px 14px!important;
      border:1px solid #9fded8!important;border-radius:14px!important;
      background:#effcfb!important;box-shadow:none!important;color:#102033!important;
      display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;
      gap:10px 14px!important;align-items:center!important;
    }
    .eap-two-skill-head{display:contents!important}
    .eap-two-skill-status h3{margin:0!important;font-size:15px!important;line-height:1.25!important}
    .eap-two-skill-status p{margin:3px 0 0!important;font-size:12px!important;line-height:1.35!important;color:#53657d!important}
    .eap-two-skill-counter{grid-column:2!important;grid-row:1!important;padding:6px 10px!important;font-size:11px!important}
    .eap-two-skill-grid{grid-column:1/-1!important;display:flex!important;gap:8px!important;margin:0!important;flex-wrap:wrap!important}
    .eap-two-skill-chip{padding:6px 9px!important;border-radius:999px!important;font-size:11px!important;line-height:1.15!important}
    .eap-optional-skills{grid-column:1/-1!important;margin:0!important;padding:0!important;background:transparent!important;font-size:11px!important;color:#607085!important}
    .eap-two-skill-note{display:none!important}

    .eap-skill-score-line{display:none!important}
    .eap-skill-required,.eap-skill-optional{
      min-height:76px!important;height:auto!important;padding:14px 16px!important;
      border-radius:16px!important;display:flex!important;flex-direction:column!important;
      align-items:center!important;justify-content:center!important;gap:6px!important;
      overflow:hidden!important;opacity:1!important;outline:none!important;
      box-shadow:0 7px 18px rgba(16,32,51,.10)!important;
    }
    .eap-skill-required{border:2px solid #27a6ff!important;background:linear-gradient(135deg,#75d6f4,#9cf0cf)!important}
    .eap-skill-optional{border:1px solid #9ed8dd!important;background:linear-gradient(135deg,#83d7f3,#9cebcf)!important}
    .eap-skill-type-badge{margin:0!important;padding:4px 8px!important;font-size:10px!important;position:static!important}
    .eap-skill-compact-meta{display:block;font-size:10px;line-height:1.25;font-weight:850;text-align:center;color:#496176}
    .eap-skill-required .eap-skill-compact-meta{color:#075c88}
    .eap-skill-required.is-passed{border-color:#18a873!important}

    .eap-skill-compact-grid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:12px!important;align-items:stretch!important}
    .eap-skill-compact-grid > *{min-width:0!important;margin:0!important}

    @media(max-width:720px){
      .eap-two-skill-status{grid-template-columns:1fr auto!important;padding:11px!important}
      .eap-skill-compact-grid{grid-template-columns:1fr!important;gap:9px!important}
      .eap-skill-required,.eap-skill-optional{min-height:68px!important}
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

  function normalizeSkill(value){
    const raw = String(value || '').toLowerCase();
    return ALL_SKILLS.find(s => raw.includes(s.toLowerCase())) || '';
  }

  function sessionNo(){
    const raw = String(
      window.EAPLiveSheetRouteFinalizer?.currentRoute ||
      window.EAPHero?.state?.currentCloudRoute ||
      window.EAPHero?.state?.currentRoute ||
      document.querySelector('[aria-current="page"]')?.textContent ||
      document.getElementById('app')?.innerText || ''
    );
    const m = raw.match(/(?:Session\s*:?\s*|\bS)0?(1[0-5]|[1-9])\b/i);
    return m ? Number(m[1]) : 0;
  }

  function buttons(){
    const app = document.getElementById('app');
    if (!app) return {};
    const visible = [...app.querySelectorAll('button,a,[role="button"]')].filter(el => {
      if (!el.offsetParent) return false;
      const t = String(el.textContent || '');
      return ALL_SKILLS.some(s => new RegExp(`\\b${s}\\b`, 'i').test(t));
    });
    return Object.fromEntries(ALL_SKILLS.map(s => [s, visible.find(el => new RegExp(`\\b${s}\\b`, 'i').test(el.textContent || '')) || null]));
  }

  function scoreMap(sid){
    if (window.EAPTwoSkillProgressV128?.evidenceFor) {
      try { return window.EAPTwoSkillProgressV128.evidenceFor(sid); } catch (_) {}
    }
    return Object.fromEntries(ALL_SKILLS.map(s => [s,0]));
  }

  function compact(){
    addCss();
    const sid = sessionNo();
    if (!sid) return;
    const map = buttons();
    const list = ALL_SKILLS.map(s => map[s]).filter(Boolean);
    if (list.length < 4) return;

    const required = REQUIRED_BY_SESSION[sid] || ['Reading','Writing'];
    const scores = scoreMap(sid);

    // Remove detached status lines produced by the previous renderer.
    document.querySelectorAll('.eap-skill-score-line').forEach(n => n.remove());

    // Put the four native buttons in one stable 2x2 grid without changing click handlers.
    const parents = list.map(b => b.parentElement).filter(Boolean);
    const sameParent = parents.every(p => p === parents[0]);
    const grid = sameParent ? parents[0] : list[0].parentElement;
    if (grid) grid.classList.add('eap-skill-compact-grid');

    ALL_SKILLS.forEach(skill => {
      const button = map[skill];
      if (!button) return;
      const isRequired = required.includes(skill);
      const score = Number(scores?.[skill] || 0);
      const passed = score >= PASS_MARK;
      button.classList.toggle('is-passed', passed);

      let badge = button.querySelector('.eap-skill-type-badge');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'eap-skill-type-badge';
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
        ? (passed ? `ผ่านแล้ว ${score}/100 · เล่นซ้ำได้` : `ต้องผ่าน 60/100${score ? ` · ตอนนี้ ${score}` : ''}`)
        : (score ? `ฝึกเสริม · คะแนนดีที่สุด ${score}` : 'ฝึกเพิ่มได้ · ไม่ใช้ปลดล็อก');
    });
  }

  let timer = 0;
  function schedule(){ clearTimeout(timer); timer = setTimeout(compact, 100); }
  window.addEventListener('load', schedule);
  window.addEventListener('eap:resume-synced', schedule);
  window.addEventListener('eap:route-changed', schedule);
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});

  window.EAPRequiredSkillUICompactV130 = {render:compact,version:'v20260715-v130-compact'};
})();