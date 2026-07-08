/* =========================================================
   EAP Hero Classroom Map Compact v20260708
   15-week route-aware compact map.
   - No hardcoded Session 1 text.
   - Uses EAP_HERO_SESSION_CONTENT_PACK routeOrder S1-S15 + B1-B5.
   - Shows the current route and pending required skills first.
   - UI-only. Does not change scoring, unlocks, evidence, or Sheet sync.
========================================================= */
(function(){
  'use strict';

  const VERSION = 'v20260708-CLASSROOM-MAP-COMPACT-15WEEK-V2';
  const PACK_NAME = 'EAP_HERO_SESSION_CONTENT_PACK';
  const STYLE_ID = 'eap-classroom-map-compact-style';
  const CARD_ID = 'eap-classroom-map-compact-card';
  const SKILLS = ['reading','listening','writing','speaking'];

  function clean(value){
    return String(value == null ? '' : value).replace(/\s+/g,' ').trim();
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
    const key = clean(routeId).toUpperCase();
    if (!data || !key) return null;
    return data.routes.find(route => clean(route.routeId).toUpperCase() === key) || null;
  }

  function routeIdFromUrl(){
    const params = new URLSearchParams(location.search);
    const raw = clean(params.get('session') || params.get('route') || params.get('stage') || '');
    if (!raw) return '';
    return /^\d+$/.test(raw) ? 'S' + raw : raw.toUpperCase();
  }

  function routeIdFromStorage(){
    const keys = ['EAP_HERO_ACTIVE_ROUTE','EAP_HERO_CURRENT_ROUTE','EAP_HERO_CURRENT_SESSION','EAP_ACTIVE_SESSION'];
    for (const key of keys) {
      try {
        const raw = clean(localStorage.getItem(key));
        if (raw) return /^\d+$/.test(raw) ? 'S' + raw : raw.toUpperCase();
      } catch(error) {}
    }
    return '';
  }

  function titleText(){
    return clean(document.body && document.body.textContent || '').toLowerCase();
  }

  function routeIdFromDom(){
    const data = pack();
    const text = titleText();
    if (!data || !text) return '';

    const explicit = text.match(/session\s*(\d{1,2})/i);
    if (explicit) return 'S' + Number(explicit[1]);

    const found = data.routes.find(route => {
      const rid = clean(route.routeId).toLowerCase();
      const rtitle = clean(route.title).toLowerCase();
      return (rid && new RegExp('\\b' + rid + '\\b','i').test(text)) || (rtitle && text.includes(rtitle));
    });
    return found ? found.routeId : '';
  }

  function currentRoute(){
    return byRouteId(routeIdFromUrl()) || byRouteId(routeIdFromDom()) || byRouteId(routeIdFromStorage()) || byRouteId('S1');
  }

  function sessionNumber(route){
    const match = clean(route && route.routeId).match(/^S(\d+)$/i);
    return match ? Number(match[1]) : 1;
  }

  function role(route, skill){
    return clean(route && route.skillContract && route.skillContract[skill] || 'Exposure');
  }

  function requiredSkills(route){
    if (!route) return [];
    if (route.routeType === 'boss_gate') return SKILLS.slice();
    return SKILLS.filter(skill => ['Core','Support','Integrated'].includes(role(route, skill)));
  }

  function skillLabel(skill){
    const raw = clean(skill).toLowerCase();
    return raw.slice(0,1).toUpperCase() + raw.slice(1);
  }

  function pendingRequiredSkills(route){
    const bodyText = clean(document.body && document.body.textContent || '');
    const required = requiredSkills(route);
    const pending = required.filter(skill => {
      const label = skillLabel(skill);
      const rx = new RegExp(label + '\\s*:\\s*(ยังไม่ทำ|not\\s*done|pending)','i');
      return rx.test(bodyText);
    });
    return pending.length ? pending : required;
  }

  function isMapOrReport(){
    const bodyText = clean(document.body && document.body.textContent || '');
    return /My Learning Report/.test(bodyText) || /Student Learning Reports/.test(bodyText) || /Mission Path/.test(bodyText) || /Session Path/.test(bodyText) || /Focus Route/.test(bodyText) || /ภารกิจ\s*Session/.test(bodyText);
  }

  function injectStyle(){
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${CARD_ID}{
        position:sticky;
        top:8px;
        z-index:1200;
        margin:8px auto 12px;
        max-width:calc(100vw - 28px);
        border-radius:18px;
        padding:12px;
        background:linear-gradient(135deg,#0f172a,#17375e);
        color:#fff;
        box-shadow:0 12px 30px rgba(8,25,45,.28);
        font-family:Arial,'Noto Sans Thai',sans-serif;
      }
      #${CARD_ID} .cmc-title{font-size:16px;font-weight:950;margin-bottom:4px;line-height:1.25}
      #${CARD_ID} .cmc-sub{font-size:12px;opacity:.9;line-height:1.35;margin-bottom:9px}
      #${CARD_ID} .cmc-route{display:inline-flex;align-items:center;margin:0 5px 5px 0;padding:4px 8px;border-radius:999px;background:rgba(232,251,243,.16);color:#dcfff2;font-size:11px;font-weight:950}
      #${CARD_ID} .cmc-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}
      #${CARD_ID} button{border:0;border-radius:12px;padding:10px 8px;font-weight:950;font-size:13px;line-height:1.15;cursor:pointer}
      #${CARD_ID} button.primary{background:#e8fbf3;color:#087f5b}
      #${CARD_ID} button.secondary{background:#edf2f7;color:#1f2937}
      #${CARD_ID} button.ghost{background:#e8f0fe;color:#174ea6}
      #${CARD_ID}.cmc-collapsed .cmc-sub,#${CARD_ID}.cmc-collapsed .cmc-actions,#${CARD_ID}.cmc-collapsed .cmc-route{display:none}
      #${CARD_ID}.cmc-collapsed{padding:9px 11px;border-radius:999px;max-width:max-content}
      #${CARD_ID}.cmc-collapsed .cmc-title{font-size:13px;margin:0;white-space:nowrap}
      @media(max-width:760px){
        #${CARD_ID}{margin:6px auto 10px;padding:10px;border-radius:15px}
        #${CARD_ID} .cmc-title{font-size:14px}
        #${CARD_ID} .cmc-sub{font-size:11px}
        #${CARD_ID} button{font-size:12px;min-height:39px;padding:9px 7px}
      }
    `;
    document.head.appendChild(style);
  }

  function getRoot(){
    return document.getElementById('app') || document.body;
  }

  function rememberRoute(route){
    if (!route) return;
    try {
      localStorage.setItem('EAP_HERO_ACTIVE_ROUTE', route.routeId);
      localStorage.setItem('EAP_HERO_CURRENT_ROUTE', route.routeId);
      const sid = clean(route.routeId).match(/^S(\d+)$/i);
      if (sid) localStorage.setItem('EAP_HERO_CURRENT_SESSION', String(Number(sid[1])));
    } catch(error) {}
  }

  function goSkill(skill){
    const route = currentRoute();
    const sid = sessionNumber(route);
    rememberRoute(route);
    try {
      if (window.EAPHero && typeof window.EAPHero.openSkillMission === 'function') {
        window.EAPHero.openSkillMission(skillLabel(skill), sid);
        return;
      }
      if (window.EAPClassroomActionRail && typeof window.EAPClassroomActionRail.startSkill === 'function') {
        window.EAPClassroomActionRail.startSkill(skill);
        return;
      }
      if (window.EAPHero && typeof window.EAPHero.skillHub === 'function') {
        window.EAPHero.skillHub(sid);
        return;
      }
    } catch(error) {
      console.warn('[EAP Map Compact] skill action failed', error);
    }
  }

  function goBrief(){
    const panel = document.getElementById('eap-session-content-brief');
    if (panel) {
      panel.scrollIntoView({behavior:'smooth', block:'start'});
      return;
    }
    try {
      if (window.EAPHero && typeof window.EAPHero.map === 'function') window.EAPHero.map();
    } catch(error) {}
  }

  function collapseLongBlocks(){
    const root = getRoot();
    if (!root) return;

    const details = Array.from(root.querySelectorAll('details'));
    details.forEach(function(d){
      if (!d.dataset.eapClassroomCompact) {
        d.dataset.eapClassroomCompact = VERSION;
        d.open = false;
      }
    });
  }

  function render(route){
    if (!route) return '';
    const skills = pendingRequiredSkills(route).slice(0,4);
    const isBoss = route.routeType === 'boss_gate';
    const label = isBoss ? route.routeId : 'Week ' + sessionNumber(route) + ' / ' + route.routeId;
    const sub = isBoss
      ? 'Boss Gate รวม 4 Skills จากช่วง ' + esc((route.unlockRule && route.unlockRule.requiresPriorSessions) || '') + ' — Speaking ส่ง Teacher Review'
      : 'เลือก Skill ที่ต้องทำของ ' + esc(route.routeId) + ' ได้ทันที ไม่ล็อกอยู่แค่คาบแรก';
    const buttons = skills.map(function(skill, index){
      return '<button type="button" class="' + (index === 0 ? 'primary' : 'ghost') + '" data-cmc-skill="' + esc(skill) + '">▶ ' + esc(skillLabel(skill)) + ' ' + esc(role(route, skill)) + '</button>';
    }).join('');

    return `
      <div class="cmc-title">🗺️ Map แบบย่อ: ${esc(label)}</div>
      <div class="cmc-sub">${sub}</div>
      <div class="cmc-route">${esc(route.title || '')}</div>
      <div class="cmc-actions">
        ${buttons || '<button type="button" class="primary" data-cmc="brief">📘 Mission Brief</button>'}
        <button type="button" class="secondary" data-cmc="brief">📘 Mission Brief</button>
        <button type="button" class="secondary" data-cmc="collapse">ย่อแถบนี้</button>
        <button type="button" class="secondary" data-cmc="top">ขึ้นบน</button>
      </div>
    `;
  }

  function mount(){
    if (!isMapOrReport()) return;
    injectStyle();
    collapseLongBlocks();

    const route = currentRoute();
    let card = document.getElementById(CARD_ID);
    if (!card) {
      card = document.createElement('div');
      card.id = CARD_ID;
      const root = getRoot();
      root.insertBefore(card, root.firstChild);
    }

    const key = (route ? route.routeId : '') + '|' + pendingRequiredSkills(route).join(',');
    if (card.dataset.key !== key) {
      card.dataset.key = key;
      card.className = '';
      card.innerHTML = render(route);
    }
  }

  function onClick(event){
    const skillBtn = event.target.closest('[data-cmc-skill]');
    if (skillBtn) {
      event.preventDefault();
      goSkill(skillBtn.dataset.cmcSkill);
      return;
    }

    const btn = event.target.closest('[data-cmc]');
    if (!btn) return;
    event.preventDefault();
    const action = btn.dataset.cmc;
    if (action === 'brief') goBrief();
    else if (action === 'top') window.scrollTo({top:0, behavior:'smooth'});
    else if (action === 'collapse') {
      const card = document.getElementById(CARD_ID);
      if (card) card.classList.toggle('cmc-collapsed');
    }
  }

  function start(){
    document.addEventListener('click', onClick, true);
    mount();
    window.setInterval(mount, 1200);
    window.EAPClassroomMapCompact = {
      version: VERSION,
      refresh: mount,
      currentRoute: currentRoute
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();