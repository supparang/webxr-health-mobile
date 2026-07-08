/* =========================================================
   EAP Hero Classroom Action Rail v20260708
   Classroom polished quick actions.
   UI-only: no scoring, mastery, evidence, or Sheet sync changes.
========================================================= */
(function(){
  'use strict';

  const VERSION = 'v20260708-CLASSROOM-ACTION-RAIL-V2';
  const PACK_NAME = 'EAP_HERO_SESSION_CONTENT_PACK';
  const PANEL_ID = 'eap-session-content-brief';
  const RAIL_ID = 'eap-classroom-action-rail';
  const STYLE_ID = 'eap-classroom-action-rail-style';
  const SKILLS = ['reading','listening','writing','speaking'];

  const clean = value => String(value == null ? '' : value).trim();
  const esc = value => String(value == null ? '' : value)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#039;');

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

  function titleText(){
    return Array.from(document.querySelectorAll('h1,h2,h3,.mission-title,.session-title,.eap-title,.card-title'))
      .map(el => clean(el.textContent))
      .filter(Boolean)
      .join(' | ')
      .toLowerCase();
  }

  function currentRoute(){
    const data = pack();
    if (!data) return null;

    const fromUrl = byRouteId(routeIdFromUrl());
    if (fromUrl) return fromUrl;

    const title = titleText();
    const fromTitle = data.routes.find(route => {
      const rid = clean(route.routeId).toLowerCase();
      const rtitle = clean(route.title).toLowerCase();
      return (rtitle && title.includes(rtitle)) || (rid && title.includes(rid));
    });
    if (fromTitle) return fromTitle;

    try {
      const raw = clean(localStorage.getItem('EAP_HERO_CURRENT_SESSION'));
      const session = raw ? (/^\d+$/.test(raw) ? 'S' + raw : raw.toUpperCase()) : '';
      const fromStore = byRouteId(session);
      if (fromStore) return fromStore;
    } catch(error) {}

    return byRouteId('S1');
  }

  function sessionNumber(route){
    const match = clean(route && route.routeId).match(/^S(\d+)$/i);
    return match ? Number(match[1]) : 1;
  }

  function role(route, skill){
    return clean(route && route.skillContract && route.skillContract[skill] || 'Exposure');
  }

  function primarySkills(route){
    if (!route) return [];
    if (route.routeType === 'boss_gate') {
      return ['reading','listening','writing','speaking'];
    }
    return SKILLS.filter(skill => ['Core','Support'].includes(role(route, skill)));
  }

  function skillLabel(skill){
    const raw = clean(skill).toLowerCase();
    return raw.slice(0,1).toUpperCase() + raw.slice(1);
  }

  function hero(){
    return window.EAPHero || window.EapHero || window.eapHero || null;
  }

  function clickExistingSkillButton(skill, sid){
    const labels = [skill, skillLabel(skill), skill.toUpperCase()];
    for (const label of labels) {
      const el = document.querySelector('[data-skill="' + label + '"][data-session="' + sid + '"]');
      if (el && typeof el.click === 'function') {
        el.click();
        return true;
      }
    }
    return false;
  }

  function startSkill(skill, route){
    const api = hero();
    const sid = sessionNumber(route);
    const niceSkill = skillLabel(skill);

    try {
      if (api && typeof api.openSkillMission === 'function') {
        api.openSkillMission(niceSkill, sid);
        return true;
      }

      if (api && typeof api.openSkillMissionFromButton === 'function') {
        const fake = document.createElement('button');
        fake.dataset.skill = niceSkill;
        fake.dataset.session = String(sid);
        api.openSkillMissionFromButton(fake);
        return true;
      }

      if (clickExistingSkillButton(skill, sid)) {
        return true;
      }

      if (api && typeof api.skillHub === 'function') {
        api.skillHub(sid);
        return true;
      }

      if (api && typeof api.map === 'function') {
        api.map();
        return true;
      }
    } catch(error) {
      console.warn('[EAP Classroom Rail] startSkill failed', error);
    }

    return false;
  }

  function openMap(){
    const api = hero();
    try {
      if (api && typeof api.map === 'function') {
        api.map();
        return;
      }
    } catch(error) {}
    location.hash = '#map';
  }

  function openReport(){
    const api = hero();
    try {
      if (api && typeof api.renderStudentReports === 'function') {
        api.renderStudentReports();
        return;
      }
      if (api && typeof api.report === 'function') {
        api.report();
        return;
      }
    } catch(error) {}
    openMap();
  }

  function style(){
    if (document.getElementById(STYLE_ID)) return;
    const css = document.createElement('style');
    css.id = STYLE_ID;
    css.textContent = `
      #${RAIL_ID}{margin:10px 0 0;padding:10px;border-radius:15px;background:linear-gradient(135deg,#102033,#17375e);color:#fff;box-shadow:0 10px 22px rgba(8,25,45,.18)}
      #${RAIL_ID} .rail-title{font-size:14px;font-weight:950;margin-bottom:8px;display:flex;justify-content:space-between;gap:8px;align-items:center}
      #${RAIL_ID} .rail-title small{display:none}
      #${RAIL_ID} .rail-actions{display:grid;grid-template-columns:repeat(auto-fit,minmax(132px,1fr));gap:8px}
      #${RAIL_ID} button{border:0;border-radius:12px;padding:10px 8px;font-weight:950;cursor:pointer;background:#e8fbf3;color:#075c46;box-shadow:inset 0 -1px 0 rgba(0,0,0,.12);font-size:13px;line-height:1.18;min-height:42px}
      #${RAIL_ID} button.support{background:#e8f0fe;color:#174ea6}
      #${RAIL_ID} button.boss{background:#fff5d6;color:#8a5700}
      #${RAIL_ID} button.utility{background:#edf2f7;color:#1f2937}
      #${RAIL_ID} .rail-note{margin-top:7px;font-size:11px;opacity:.84;line-height:1.35}
      @media(max-width:760px){
        #${RAIL_ID}{padding:9px;border-radius:13px;margin-top:8px}
        #${RAIL_ID} .rail-title{font-size:13px;margin-bottom:7px}
        #${RAIL_ID} .rail-actions{grid-template-columns:1fr 1fr;gap:7px}
        #${RAIL_ID} button{font-size:12px;min-height:38px;padding:9px 7px}
        #${RAIL_ID} .rail-note{font-size:10px}
      }
    `;
    document.head.appendChild(css);
  }

  function buttonFor(skill, route, index){
    const r = role(route, skill);
    const cls = r === 'Support' ? 'support' : (route.routeType === 'boss_gate' ? 'boss' : '');
    const label = route.routeType === 'boss_gate'
      ? '▶ Boss ' + skillLabel(skill)
      : (r === 'Core' ? '▶ เริ่ม Core: ' : '▶ ต่อ Support: ') + skillLabel(skill);

    return '<button type="button" class="' + cls + '" data-eap-start-skill="' + esc(skill) + '">' + esc(label) + '</button>';
  }

  function render(route){
    if (!route) return '';
    const skills = primarySkills(route);
    const buttons = skills.map((skill, index) => buttonFor(skill, route, index)).join('');
    const note = route.routeType === 'boss_gate'
      ? 'Boss Gate รวม 4 skills และ Speaking จะส่งให้ครูตรวจ'
      : 'ทำ Core ก่อน แล้วต่อ Support; Exposure เป็นฝึกเสริม ไม่บล็อกการไปต่อ';

    return `
      <div class="rail-title">
        <span>🚀 เริ่มภารกิจทันที</span>
        <small>${esc(VERSION)}</small>
      </div>
      <div class="rail-actions">
        ${buttons || '<button type="button" class="utility" data-eap-action="map">🗺️ Map</button>'}
        <button type="button" class="utility" data-eap-action="map">🗺️ Map</button>
        <button type="button" class="utility" data-eap-action="report">📘 Report</button>
      </div>
      <div class="rail-note">${esc(note)}</div>
    `;
  }

  function mount(){
    const panel = document.getElementById(PANEL_ID);
    const data = pack();
    if (!panel || !data) return;
    style();

    const route = currentRoute();
    const key = route ? route.routeId : '';

    let rail = document.getElementById(RAIL_ID);
    if (!rail) {
      rail = document.createElement('div');
      rail.id = RAIL_ID;
      const compact = panel.querySelector('.eap-brief-compact');
      if (compact) compact.insertAdjacentElement('afterend', rail);
      else panel.appendChild(rail);
    }

    if (rail.dataset.routeId !== key) {
      rail.dataset.routeId = key;
      rail.innerHTML = render(route);
    }
  }

  function onClick(event){
    const start = event.target.closest('[data-eap-start-skill]');
    if (start) {
      event.preventDefault();
      const ok = startSkill(start.dataset.eapStartSkill, currentRoute());
      if (!ok) console.info('[EAP Classroom Rail] Use the original Practice button if this route is not ready.');
      return;
    }

    const action = event.target.closest('[data-eap-action]');
    if (action) {
      event.preventDefault();
      if (action.dataset.eapAction === 'report') openReport();
      else openMap();
    }
  }

  window.EAPClassroomActionRail = {
    version: VERSION,
    refresh: mount,
    startSkill: function(skill){ return startSkill(skill, currentRoute()); }
  };

  function start(){
    document.addEventListener('click', onClick, true);
    mount();
    window.setInterval(mount, 1200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
