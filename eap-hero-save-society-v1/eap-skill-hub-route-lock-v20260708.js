/* =========================================================
   EAP Hero Skill Hub Route Lock v20260708
   V1 CURRENT-ROUTE ONLY
   - Start / Continue must open only the current route from Cloud/Sheet.
   - Skill Mission Hub must not expose S1-S15 as free navigation.
   - Session selector buttons inside Skill Hub are hidden/blocked.
   - EAPHero.skillHub/openSkillMission are guarded so locked/future sessions
     cannot be opened by stale buttons or old scripts.
   - UI/routing only. Does not change scores, pass/fail, Sheet, evidence,
     teacher review, or the stored profile.
========================================================= */
(function(){
  'use strict';

  const VERSION = 'v20260708-EAP-SKILL-HUB-ROUTE-LOCK-V1-CURRENT-ONLY';
  const STATE_KEY = 'EAP_HERO_PROGRESS_V3';
  const PACK_NAME = 'EAP_HERO_SESSION_CONTENT_PACK';
  const STYLE_ID = 'eap-skill-hub-route-lock-style-v1';
  const NOTICE_ID = 'eap-skill-hub-route-lock-notice';

  function clean(v){ return String(v == null ? '' : v).replace(/\s+/g,' ').trim(); }
  function norm(v){ const raw = clean(v).toUpperCase(); return /^\d+$/.test(raw) ? 'S' + Number(raw) : raw; }
  function num(v){ const n = Number(v); return Number.isFinite(n) ? n : 0; }
  function readState(){ try { return JSON.parse(localStorage.getItem(STATE_KEY) || '{}'); } catch(error){ return {}; } }
  function pack(){ const data = window[PACK_NAME]; return data && Array.isArray(data.routes) ? data : null; }
  function routeList(){
    const data = pack();
    if (!data) return [];
    const order = Array.isArray(data.routeOrder) && data.routeOrder.length ? data.routeOrder : data.routes.map(r => r.routeId);
    return order.map(id => data.routes.find(r => norm(r.routeId) === norm(id))).filter(Boolean);
  }
  function routeById(id){ const rid = norm(id); return routeList().find(r => norm(r.routeId) === rid) || null; }
  function sessionNo(route){ const m = clean(route && route.routeId).match(/^S(\d+)$/i); return m ? Number(m[1]) : 0; }
  function isCloudState(s){ s = s || readState(); return !!(s.serverResume || s.cloudResumeStatus === 'ok' || clean(s.currentCloudRoute)); }

  function currentRoute(){
    const state = readState();

    /* Prefer the route computed from verified Cloud/Sheet state. */
    if (isCloudState(state) && clean(state.currentCloudRoute)) {
      const fromCloud = routeById(state.currentCloudRoute);
      if (fromCloud) return fromCloud;
    }

    try {
      if (window.EAPRoadmapLockGuard && typeof window.EAPRoadmapLockGuard.currentRoute === 'function') {
        const fromGuard = window.EAPRoadmapLockGuard.currentRoute();
        if (fromGuard && fromGuard.routeId) return fromGuard;
      }
    } catch(error) {}

    const fromStore = routeById(localStorage.getItem('EAP_HERO_ACTIVE_ROUTE')) ||
      routeById(localStorage.getItem('EAP_HERO_CURRENT_ROUTE')) ||
      routeById(localStorage.getItem('EAP_HERO_CURRENT_SESSION'));
    return fromStore || routeById('S1') || { routeId:'S1', title:'Academic Hero Awakening', routeType:'session' };
  }

  function currentLabel(route){
    if (!route) return 'S1';
    if (route.routeType === 'boss_gate') return clean(route.routeId) + ' Boss Gate';
    return 'Week ' + (sessionNo(route) || 1) + ' / ' + clean(route.routeId);
  }

  function setActive(route){
    if (!route || !route.routeId) return;
    try {
      localStorage.setItem('EAP_HERO_ACTIVE_ROUTE', clean(route.routeId));
      localStorage.setItem('EAP_HERO_CURRENT_ROUTE', clean(route.routeId));
      const n = sessionNo(route);
      if (n) localStorage.setItem('EAP_HERO_CURRENT_SESSION', String(n));
    } catch(error) {}
  }

  function hero(){ return window.EAPHero || window.EapHero || window.eapHero || null; }

  function runCurrentRoute(){
    const api = hero();
    const route = currentRoute();
    setActive(route);
    if (route && route.routeType === 'boss_gate' && api && typeof api.startGateBoss === 'function') {
      api.startGateBoss(route.routeId);
      return true;
    }
    const sid = sessionNo(route) || 1;
    if (api && typeof api.__skillHubRouteLockOriginalSkillHub === 'function') {
      api.__skillHubRouteLockOriginalSkillHub.call(api, sid);
      return true;
    }
    if (api && typeof api.skillHub === 'function' && !api.__skillHubRouteLockCalling) {
      api.__skillHubRouteLockCalling = true;
      try { api.skillHub(sid); } finally { api.__skillHubRouteLockCalling = false; }
      return true;
    }
    return false;
  }

  function addStyle(){
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      [data-eap-skillhub-switcher-hidden="1"]{display:none!important}
      #${NOTICE_ID}{
        margin:10px 0 14px;padding:12px 14px;border-radius:14px;
        background:#fff5d6;color:#7c4a00;border:1px solid rgba(217,119,6,.22);
        font:900 13px/1.45 Arial,'Noto Sans Thai',sans-serif;
      }
      #${NOTICE_ID} b{color:#102033}
    `;
    document.head.appendChild(style);
  }

  function isSkillHub(){
    const app = document.getElementById('app');
    const text = clean(app && app.innerText || '');
    return /EAP\s+Skill\s+Mission\s+Hub/i.test(text) || /Session\s+Path/i.test(text) && /Skills:\s*Reading/i.test(text);
  }

  function isSessionButton(node){
    if (!node) return false;
    const text = clean(node.textContent || '');
    return /^S(?:ession\s*)?(1[0-5]|[1-9])\b/i.test(text);
  }

  function hideSessionSwitcher(){
    if (!isSkillHub()) return;
    addStyle();
    const app = document.getElementById('app');
    if (!app) return;

    const sessionButtons = Array.from(app.querySelectorAll('button,a,[role="button"]')).filter(isSessionButton);
    if (sessionButtons.length < 4) return;

    let holder = null;
    for (const btn of sessionButtons) {
      let node = btn.parentElement;
      for (let depth = 0; node && depth < 5; depth++, node = node.parentElement) {
        const count = Array.from(node.querySelectorAll('button,a,[role="button"]')).filter(isSessionButton).length;
        if (count >= Math.min(8, sessionButtons.length)) { holder = node; break; }
      }
      if (holder) break;
    }

    if (holder && holder.id !== NOTICE_ID) {
      holder.setAttribute('data-eap-skillhub-switcher-hidden','1');
      holder.setAttribute('aria-hidden','true');
      const route = currentRoute();
      if (!document.getElementById(NOTICE_ID)) {
        const notice = document.createElement('div');
        notice.id = NOTICE_ID;
        notice.innerHTML = '🔒 เลือก Session เองไม่ได้ในหน้านี้ — ระบบล็อกตามเส้นทางล่าสุด: <b>' + currentLabel(route) + '</b>. ใช้ปุ่ม Skill ของด่านนี้ หรือกลับ Map เพื่อดูภาพรวม';
        holder.insertAdjacentElement('afterend', notice);
      }
    }
  }

  function requestedSessionFromArgs(args){
    for (const arg of Array.from(args || [])) {
      if (typeof arg === 'number') return 'S' + arg;
      const raw = clean(arg);
      if (/^\d+$/.test(raw)) return 'S' + Number(raw);
      if (/^S\d+$/i.test(raw)) return norm(raw);
    }
    return '';
  }

  function patchHero(){
    const api = hero();
    if (!api || api.__skillHubRouteLockPatched) return;
    api.__skillHubRouteLockPatched = true;

    if (typeof api.skillHub === 'function') {
      api.__skillHubRouteLockOriginalSkillHub = api.skillHub;
      api.skillHub = function(){
        if (api.__skillHubRouteLockCalling) return api.__skillHubRouteLockOriginalSkillHub.apply(api, arguments);
        const requested = requestedSessionFromArgs(arguments);
        const route = currentRoute();
        const target = norm(route && route.routeId || 'S1');
        if (requested && requested !== target) {
          setActive(route);
          return runCurrentRoute();
        }
        return api.__skillHubRouteLockOriginalSkillHub.apply(api, arguments);
      };
    }

    if (typeof api.openSkillMission === 'function') {
      api.__skillHubRouteLockOriginalOpenSkillMission = api.openSkillMission;
      api.openSkillMission = function(skill, sid){
        const route = currentRoute();
        const targetSid = sessionNo(route);
        if (route && route.routeType === 'boss_gate') return runCurrentRoute();
        if (targetSid && num(sid || targetSid) !== targetSid) {
          return api.__skillHubRouteLockOriginalOpenSkillMission.call(api, skill, targetSid);
        }
        return api.__skillHubRouteLockOriginalOpenSkillMission.apply(api, arguments);
      };
    }
  }

  function blockSessionButtonClicks(event){
    if (!isSkillHub()) return;
    const btn = event.target && event.target.closest && event.target.closest('button,a,[role="button"]');
    if (!isSessionButton(btn)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    runCurrentRoute();
  }

  let timer = null;
  function schedule(){
    clearTimeout(timer);
    timer = setTimeout(function(){ patchHero(); hideSessionSwitcher(); }, 120);
  }

  function start(){
    addStyle();
    document.addEventListener('click', blockSessionButtonClicks, true);
    window.addEventListener('load', schedule);
    window.addEventListener('storage', schedule);
    window.addEventListener('eap:resume-synced', schedule);
    new MutationObserver(schedule).observe(document.documentElement, { childList:true, subtree:true, characterData:true });
    schedule();
    setInterval(schedule, 1200);
  }

  window.EAPSkillHubRouteLock = { version: VERSION, refresh: schedule, currentRoute, runCurrentRoute };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();