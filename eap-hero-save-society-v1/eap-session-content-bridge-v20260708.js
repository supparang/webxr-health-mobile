/* =========================================================
   EAP Hero Session Content Bridge v20260708
   Uses window.EAP_HERO_SESSION_CONTENT_PACK to show learning
   content inside the student game without changing scores.
========================================================= */
(function(){
  'use strict';

  const PACK_NAME = 'EAP_HERO_SESSION_CONTENT_PACK';
  const STYLE_ID = 'eap-session-content-bridge-style';
  const PANEL_ID = 'eap-session-content-brief';
  const VERSION = 'v20260708-STUDENT-CONTENT-BRIDGE';
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

  function style(){
    if (document.getElementById(STYLE_ID)) return;
    const css = document.createElement('style');
    css.id = STYLE_ID;
    css.textContent = `
      #${PANEL_ID}{margin:14px auto;max-width:1040px;border:1px solid rgba(120,150,180,.35);border-radius:18px;background:linear-gradient(135deg,#ffffff,#f1fbff);box-shadow:0 10px 28px rgba(8,25,45,.10);color:#102033;overflow:hidden;font-family:Arial,'Noto Sans Thai',sans-serif}
      #${PANEL_ID} .eap-brief-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:14px 16px;background:#edf8ff;border-bottom:1px solid rgba(120,150,180,.25)}
      #${PANEL_ID} h2{margin:0;font-size:18px;font-weight:900;color:#102033}
      #${PANEL_ID} .eap-brief-sub{margin-top:3px;color:#53677f;font-size:12px;font-weight:700}
      #${PANEL_ID} .eap-brief-version{font-size:11px;color:#607085;white-space:nowrap}
      #${PANEL_ID} .eap-brief-body{padding:14px 16px;display:grid;gap:12px}
      #${PANEL_ID} .eap-brief-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}
      #${PANEL_ID} .eap-brief-box{border:1px solid #dbe7f2;border-radius:14px;background:#fff;padding:12px}
      #${PANEL_ID} .eap-brief-box strong{display:block;margin-bottom:6px;color:#17375e}
      #${PANEL_ID} .eap-pill{display:inline-flex;margin:3px 4px 3px 0;padding:4px 8px;border-radius:999px;background:#e8f0fe;color:#174ea6;font-size:12px;font-weight:800}
      #${PANEL_ID} .eap-pill.exposure{background:#f3e8ff;color:#6b21a8}
      #${PANEL_ID} .eap-pill.mastery{background:#e8fbf3;color:#087f5b}
      #${PANEL_ID} .eap-frame{margin:4px 0;padding:8px 10px;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0;font-size:13px}
      #${PANEL_ID} details{border:1px solid #dbe7f2;border-radius:12px;background:#fff;overflow:hidden}
      #${PANEL_ID} summary{padding:10px 12px;font-weight:900;cursor:pointer;color:#17375e}
      #${PANEL_ID} .eap-skill{padding:0 12px 12px;color:#102033;font-size:13px}
      #${PANEL_ID} .eap-skill h3{margin:10px 0 6px;font-size:15px}
      @media(max-width:760px){#${PANEL_ID}{margin:10px 8px}#${PANEL_ID} .eap-brief-head{display:block}}
    `;
    document.head.appendChild(css);
  }

  function render(route){
    if (!route) return '';
    const vocab = (((route.microLesson || {}).vocabulary) || []).slice(0,8);
    const frames = (((route.microLesson || {}).usefulFrames) || []).slice(0,6);

    const skillBlocks = SKILLS.map(skill => {
      const m = missionFor(route, skill);
      const role = roleLabel(route, skill);
      const roleClass = role === 'Exposure' ? 'exposure' : 'mastery';
      if (!m) return '';
      return `
        <details>
          <summary>${esc(skill.toUpperCase())} · <span class="eap-pill ${roleClass}">${esc(role)}</span></summary>
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
      <div class="eap-brief-head">
        <div>
          <h2>📘 Learning Brief: ${esc(route.routeId)} · ${esc(route.title)}</h2>
          <div class="eap-brief-sub">${esc(route.subtitle || '')} · CEFR ${esc(route.cefrBand || '')} · ${esc(route.focus || '')}</div>
        </div>
        <div class="eap-brief-version">${esc(VERSION)}</div>
      </div>
      <div class="eap-brief-body">
        <div class="eap-brief-grid">
          <div class="eap-brief-box"><strong>🎯 What students learn</strong>${esc((route.microLesson || {}).studentIntro || '')}</div>
          <div class="eap-brief-box"><strong>🧩 Skill Contract</strong>${SKILLS.map(skill => `<span class="eap-pill ${roleLabel(route,skill)==='Exposure'?'exposure':'mastery'}">${esc(skill)} · ${esc(roleLabel(route,skill))}</span>`).join('')}</div>
          <div class="eap-brief-box"><strong>🔤 Vocabulary</strong>${vocab.map(v => `<span class="eap-pill">${esc(v.term || v)}</span>`).join('')}</div>
        </div>
        <div class="eap-brief-box"><strong>🧠 Useful Frames</strong>${frames.map(frame => `<div class="eap-frame">${esc(frame)}</div>`).join('')}</div>
        ${skillBlocks}
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
