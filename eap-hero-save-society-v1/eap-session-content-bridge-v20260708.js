/* =========================================================
   EAP Hero Session Content Bridge v20260708
   Classroom compact mode for student game.
   - Shows a short Mission Brief first.
   - Keeps vocabulary / frames / four-skill details expandable.
   - Adds safe bottom space so floating Sheet button does not cover content.
   - Does not change score, pass/fail, mastery, Sheet transport, or core runtime.
========================================================= */
(function(){
  'use strict';

  const PACK_NAME = 'EAP_HERO_SESSION_CONTENT_PACK';
  const STYLE_ID = 'eap-session-content-bridge-style';
  const PANEL_ID = 'eap-session-content-brief';
  const VERSION = 'v20260708-STUDENT-BRIEF-CLASSROOM-COMPACT-V2';
  const SKILLS = ['reading','listening','writing','speaking'];

  const esc = value => String(value == null ? '' : value)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#039;');

  const clean = value => String(value == null ? '' : value).trim();

  function pack(){
    const data = window[PACK_NAME];
    return data && Array.isArray(data.routes) ? data : null;
  }

  function byRouteId(routeId){
    const data = pack();
    const key = clean(routeId).toUpperCase();
    if (!data || !key) return null;
    return data.routes.find(route => clean(route.routeId).toUpperCase() === key) || null;
  }

  function titleText(){
    return Array.from(document.querySelectorAll('h1,h2,h3,.mission-title,.session-title,.eap-title,.card-title'))
      .map(el => clean(el.textContent))
      .filter(Boolean)
      .join(' | ');
  }

  function routeFromUrl(){
    const params = new URLSearchParams(location.search);
    const raw = clean(params.get('session') || params.get('route') || params.get('stage') || '');
    if (!raw) return '';
    if (/^\d+$/.test(raw)) return 'S' + raw;
    return raw.toUpperCase();
  }

  function routeFromDom(){
    const data = pack();
    const title = titleText().toLowerCase();
    if (!data || !title) return '';

    const found = data.routes.find(route => {
      const rid = clean(route.routeId).toLowerCase();
      const rtitle = clean(route.title).toLowerCase();
      return (rtitle && title.includes(rtitle)) || (rid && title.includes(rid));
    });

    return found ? found.routeId : '';
  }

  function routeFromStorage(){
    const keys = ['EAP_HERO_ACTIVE_ROUTE','EAP_HERO_CURRENT_ROUTE','EAP_HERO_CURRENT_SESSION'];
    for (const key of keys) {
      try {
        const raw = clean(localStorage.getItem(key));
        if (raw) return /^\d+$/.test(raw) ? 'S' + raw : raw.toUpperCase();
      } catch(error) {}
    }
    return '';
  }

  function currentRoute(){
    return byRouteId(routeFromUrl()) || byRouteId(routeFromDom()) || byRouteId(routeFromStorage()) || byRouteId('S1');
  }

  function missionFor(route, skill){
    return (route.missions || []).find(m => clean(m.skill).toLowerCase() === skill) || null;
  }

  function roleLabel(route, skill){
    const role = route.skillContract && route.skillContract[skill];
    return clean(role || 'Exposure');
  }

  function roleClass(role){
    return role === 'Exposure' ? 'exposure' : 'mastery';
  }

  function requiredSkills(route){
    return SKILLS.filter(skill => {
      const role = roleLabel(route, skill);
      return role === 'Core' || role === 'Support' || role === 'Integrated';
    });
  }

  function compactSentence(route){
    const required = requiredSkills(route)
      .map(skill => skill + ' ' + roleLabel(route, skill))
      .join(' + ');

    if (route.routeType === 'boss_gate') {
      return 'Boss mission: complete integrated Reading, Listening, Writing and Speaking. Speaking creates a Teacher Review item.';
    }

    return required
      ? 'Today focus: ' + required + '. Exposure skills are practice evidence only.'
      : 'Today focus: complete the learning mission and record evidence.';
  }

  function style(){
    if (document.getElementById(STYLE_ID)) return;
    const css = document.createElement('style');
    css.id = STYLE_ID;
    css.textContent = `
      html,body{scroll-padding-bottom:120px!important}
      body{padding-bottom:max(96px,env(safe-area-inset-bottom))!important}
      #app{padding-bottom:92px!important}
      #${PANEL_ID}{margin:12px auto 16px;max-width:1040px;border:1px solid rgba(120,150,180,.35);border-radius:18px;background:linear-gradient(135deg,#ffffff,#f1fbff);box-shadow:0 10px 28px rgba(8,25,45,.10);color:#102033;overflow:hidden;font-family:Arial,'Noto Sans Thai',sans-serif}
      #${PANEL_ID} *{box-sizing:border-box}
      #${PANEL_ID} .eap-brief-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:13px 15px;background:#edf8ff;border-bottom:1px solid rgba(120,150,180,.25)}
      #${PANEL_ID} h2{margin:0;font-size:18px;line-height:1.2;font-weight:900;color:#102033}
      #${PANEL_ID} .eap-brief-sub{margin-top:4px;color:#53677f;font-size:12px;font-weight:800;line-height:1.35}
      #${PANEL_ID} .eap-brief-version{font-size:10px;color:#607085;white-space:nowrap;opacity:.75}
      #${PANEL_ID} .eap-brief-body{padding:12px 14px;display:grid;gap:10px}
      #${PANEL_ID} .eap-brief-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}
      #${PANEL_ID} .eap-brief-box{border:1px solid #dbe7f2;border-radius:14px;background:#fff;padding:11px;line-height:1.45}
      #${PANEL_ID} .eap-brief-box strong{display:block;margin-bottom:7px;color:#17375e;font-size:15px}
      #${PANEL_ID} .eap-brief-compact{border:1px solid #bfe9dc;background:linear-gradient(135deg,#edfff7,#ffffff);border-radius:16px;padding:12px;line-height:1.45;font-weight:850;color:#123}
      #${PANEL_ID} .eap-next{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
      #${PANEL_ID} .eap-pill{display:inline-flex;align-items:center;margin:3px 4px 3px 0;padding:4px 8px;border-radius:999px;background:#e8f0fe;color:#174ea6;font-size:12px;font-weight:900;line-height:1.2}
      #${PANEL_ID} .eap-pill.exposure{background:#f3e8ff;color:#6b21a8}
      #${PANEL_ID} .eap-pill.mastery{background:#e8fbf3;color:#087f5b}
      #${PANEL_ID} .eap-pill.warn{background:#fff5d6;color:#8a5700}
      #${PANEL_ID} .eap-frame{margin:4px 0;padding:8px 10px;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0;font-size:13px;line-height:1.35}
      #${PANEL_ID} details{border:1px solid #dbe7f2;border-radius:12px;background:#fff;overflow:hidden}
      #${PANEL_ID} summary{padding:10px 12px;font-weight:950;cursor:pointer;color:#17375e;list-style:none}
      #${PANEL_ID} summary::-webkit-details-marker{display:none}
      #${PANEL_ID} summary:after{content:' แตะเพื่อเปิด';font-size:11px;color:#64748b;font-weight:800;float:right;margin-top:2px}
      #${PANEL_ID} details[open] summary:after{content:' ปิด'}
      #${PANEL_ID} .eap-skill{padding:0 12px 12px;color:#102033;font-size:13px;line-height:1.45}
      #${PANEL_ID} .eap-skill h3{margin:10px 0 6px;font-size:14px;color:#17375e}
      #${PANEL_ID} .eap-classroom-note{font-size:12px;color:#53677f;line-height:1.35}
      #${PANEL_ID} .eap-brief-details{display:grid;gap:10px}
      @media(max-width:760px){
        #${PANEL_ID}{margin:8px 8px 14px;border-radius:16px;max-width:calc(100vw - 16px)}
        #${PANEL_ID} .eap-brief-head{display:block;padding:12px}
        #${PANEL_ID} h2{font-size:17px;line-height:1.18}
        #${PANEL_ID} .eap-brief-sub{font-size:12px}
        #${PANEL_ID} .eap-brief-version{display:none}
        #${PANEL_ID} .eap-brief-body{padding:10px;gap:9px}
        #${PANEL_ID} .eap-brief-grid{grid-template-columns:1fr;gap:8px}
        #${PANEL_ID} .eap-brief-box{padding:10px;border-radius:13px}
        #${PANEL_ID} .eap-brief-box strong{font-size:14px;margin-bottom:5px}
        #${PANEL_ID} .eap-brief-compact{font-size:13px;padding:10px;border-radius:13px}
        #${PANEL_ID} .eap-pill{font-size:11px;padding:4px 7px;margin:2px 3px 2px 0}
        #${PANEL_ID} .eap-frame{font-size:12px;padding:7px 8px}
        #${PANEL_ID} summary{padding:9px 10px;font-size:14px}
        #${PANEL_ID} .eap-skill{font-size:12px;padding:0 10px 10px}
      }
    `;
    document.head.appendChild(css);
  }

  function renderSkillContract(route){
    return SKILLS.map(skill => {
      const role = roleLabel(route, skill);
      return `<span class="eap-pill ${roleClass(role)}">${esc(skill)} · ${esc(role)}</span>`;
    }).join('');
  }

  function renderRequired(route){
    const list = requiredSkills(route);
    if (!list.length) return '<span class="eap-pill warn">Practice mission</span>';
    return list.map(skill => {
      const role = roleLabel(route, skill);
      return `<span class="eap-pill ${roleClass(role)}">${esc(skill)} · ${esc(role)}</span>`;
    }).join('');
  }

  function renderDetails(route){
    const vocab = (((route.microLesson || {}).vocabulary) || []).slice(0,8);
    const frames = (((route.microLesson || {}).usefulFrames) || []).slice(0,5);

    const skillBlocks = SKILLS.map(skill => {
      const m = missionFor(route, skill);
      const role = roleLabel(route, skill);
      if (!m) return '';
      return `
        <details>
          <summary>${esc(skill.toUpperCase())} · <span class="eap-pill ${roleClass(role)}">${esc(role)}</span></summary>
          <div class="eap-skill">
            <h3>Mission Prompt</h3>
            <p>${esc(m.prompt)}</p>
            <h3>Student Checklist</h3>
            <p>${(m.checklist || []).map(x => `<span class="eap-pill">${esc(x)}</span>`).join('')}</p>
            <h3>Useful Example</h3>
            <p>${esc(m.sampleOutput)}</p>
          </div>
        </details>`;
    }).join('');

    return `
      <details>
        <summary>🔤 Vocabulary + Useful Frames</summary>
        <div class="eap-skill">
          <h3>Vocabulary</h3>
          <p>${vocab.map(v => `<span class="eap-pill">${esc(v.term || v)}</span>`).join('')}</p>
          <h3>Useful Frames</h3>
          ${frames.map(frame => `<div class="eap-frame">${esc(frame)}</div>`).join('')}
        </div>
      </details>
      ${skillBlocks}`;
  }

  function render(route){
    if (!route) return '';
    const intro = (route.microLesson || {}).studentIntro || '';
    const bossNote = route.routeType === 'boss_gate'
      ? '<span class="eap-pill warn">Boss Speaking → Teacher Review</span>'
      : '<span class="eap-pill warn">Exposure does not block progress</span>';

    return `
      <div class="eap-brief-head">
        <div>
          <h2>📘 Mission Brief: ${esc(route.routeId)} · ${esc(route.title)}</h2>
          <div class="eap-brief-sub">${esc(route.subtitle || '')} · CEFR ${esc(route.cefrBand || '')}</div>
        </div>
        <div class="eap-brief-version">${esc(VERSION)}</div>
      </div>
      <div class="eap-brief-body">
        <div class="eap-brief-compact">
          <div>🎯 ${esc(intro)}</div>
          <div class="eap-next">${renderRequired(route)}${bossNote}</div>
        </div>
        <details>
          <summary>🧩 Skill Contract ทั้งหมด</summary>
          <div class="eap-skill">${renderSkillContract(route)}<p class="eap-classroom-note">Core + Support ใช้เป็น Mastery ของ Session ส่วน Exposure เป็นหลักฐานการฝึก ไม่บล็อกการไปต่อ</p></div>
        </details>
        <div class="eap-brief-details">${renderDetails(route)}</div>
      </div>`;
  }

  function mount(){
    const data = pack();
    if (!data) return;
    style();

    let panel = document.getElementById(PANEL_ID);
    if (!panel) {
      panel = document.createElement('section');
      panel.id = PANEL_ID;
      panel.setAttribute('aria-label','EAP Hero Learning Brief');

      const app = document.getElementById('app') || document.body;
      const target = app.firstElementChild && app.firstElementChild.parentNode === app ? app.firstElementChild : null;
      if (target) app.insertBefore(panel, target.nextSibling);
      else app.appendChild(panel);
    }

    const route = currentRoute();
    const nextKey = route ? route.routeId : '';
    if (panel.dataset.routeId === nextKey && panel.innerHTML) return;
    panel.dataset.routeId = nextKey;
    panel.innerHTML = render(route);
  }

  window.EAPHeroContentBridge = {
    version: VERSION,
    getPack: pack,
    getRoute: byRouteId,
    refresh: mount
  };

  function start(){
    mount();
    window.setInterval(mount, 1800);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
