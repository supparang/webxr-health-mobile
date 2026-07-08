/* =========================================================
   EAP Hero Student Home Lobby v20260708
   - Home is a compact lobby, not the full 15-week Learning Path.
   - Start / Continue uses the verified current route from Cloud/Sheet state.
   - Map remains the place to see the full path / route grid.
   - Profile data is not changed: existing studentId + section + Cloud Resume
     continue to be used by eap-player-resume-v1.js and EAP Profile.
   - UI-only. Does not change profile keys, Sheet sync, scores, pass/fail,
     evidence, teacher review, or unlock logic.
========================================================= */
(function(){
  'use strict';

  const VERSION = 'v20260708-EAP-STUDENT-HOME-LOBBY-V1';
  const LOBBY_ID = 'eap-student-compact-lobby';
  const STYLE_ID = 'eap-student-home-lobby-style-v1';
  const ROADMAP_ID = 'eap-student-15week-roadmap';
  const PROFILE_KEY = 'EAP_HERO_PLAYER_PROFILE_V1';
  const STATE_KEY = 'EAP_HERO_PROGRESS_V3';
  const PACK_NAME = 'EAP_HERO_SESSION_CONTENT_PACK';

  function clean(v){ return String(v == null ? '' : v).replace(/\s+/g,' ').trim(); }
  function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])); }
  function read(key, fallback){ try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch(error){ return fallback; } }
  function pack(){ const data = window[PACK_NAME]; return data && Array.isArray(data.routes) ? data : null; }
  function routeId(v){ const raw = clean(v).toUpperCase(); if (!raw) return ''; return /^\d+$/.test(raw) ? 'S' + Number(raw) : raw; }
  function byRouteId(id){ const data = pack(); const rid = routeId(id); return data && rid ? data.routes.find(r => routeId(r.routeId) === rid) || null : null; }
  function sessionNo(route){ const m = clean(route && route.routeId).match(/^S(\d+)$/i); return m ? Number(m[1]) : 0; }

  function isHomeVisible(){
    const bodyText = document.body ? clean(document.body.innerText) : '';
    return /EAP Hero:\s*Save the Society/i.test(bodyText) && /Student Mode|Player Status|Start\s*\/\s*Continue|My Learning Report/i.test(bodyText);
  }

  function profile(){
    const direct = read(PROFILE_KEY, {});
    const state = read(STATE_KEY, {});
    const merged = Object.assign({}, state.profile || {}, state.player || {}, state.user || {}, direct || {});
    const studentId = clean(merged.studentId || merged.id || state.studentId || state.id || '');
    const studentName = clean(merged.studentName || merged.name || state.studentName || state.name || state.playerName || 'Student');
    const section = clean(merged.section || state.section || '122') || '122';
    return { studentId, studentName, section };
  }

  function currentRoute(){
    try {
      if (window.EAPRoadmapLockGuard && typeof window.EAPRoadmapLockGuard.currentRoute === 'function') {
        const route = window.EAPRoadmapLockGuard.currentRoute();
        if (route && route.routeId) return route;
      }
    } catch(error) {}
    const state = read(STATE_KEY, {});
    const stored = routeId(state.currentCloudRoute || state.currentRoute || localStorage.getItem('EAP_HERO_ACTIVE_ROUTE') || localStorage.getItem('EAP_HERO_CURRENT_ROUTE') || localStorage.getItem('EAP_HERO_CURRENT_SESSION') || 'S1');
    return byRouteId(stored) || byRouteId('S1') || { routeId:'S1', title:'Academic Hero Awakening', routeType:'session' };
  }

  function currentLabel(route){
    if (!route) return 'Week 1 / S1';
    if (route.routeType === 'boss_gate') return route.routeId + ' Boss Gate';
    return 'Week ' + (sessionNo(route) || 1) + ' / ' + route.routeId;
  }

  function addStyle(){
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      body.eap-home-lobby-mode #${ROADMAP_ID}{display:none!important}
      #${LOBBY_ID}{
        margin:14px auto 16px;
        max-width:1040px;
        border-radius:22px;
        padding:16px;
        background:linear-gradient(135deg,#102033,#17375e);
        color:#fff;
        border:1px solid rgba(153,246,228,.32);
        box-shadow:0 14px 34px rgba(8,25,45,.22);
        font-family:Arial,'Noto Sans Thai',sans-serif;
      }
      #${LOBBY_ID} *{box-sizing:border-box}
      #${LOBBY_ID} .lob-grid{display:grid;grid-template-columns:1.2fr .8fr;gap:14px;align-items:stretch}
      #${LOBBY_ID} h2{margin:0 0 6px;font-size:clamp(22px,3vw,34px);line-height:1.1;color:#fff;font-weight:950}
      #${LOBBY_ID} p{margin:0;color:#d8edf7;line-height:1.55;font-weight:800}
      #${LOBBY_ID} .lob-now{display:grid;gap:8px;padding:14px;border-radius:18px;background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.16)}
      #${LOBBY_ID} .lob-kicker{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#99f6e4;font-weight:950}
      #${LOBBY_ID} .lob-title{font-size:20px;font-weight:950;color:#fff;line-height:1.2}
      #${LOBBY_ID} .lob-meta{font-size:13px;color:#c7e4f4;font-weight:850}
      #${LOBBY_ID} .lob-actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:14px}
      #${LOBBY_ID} button{border:0;border-radius:14px;padding:12px 14px;font-weight:950;cursor:pointer;min-height:44px;font-size:14px}
      #${LOBBY_ID} .primary{background:#9af3e9;color:#102033;box-shadow:0 10px 24px rgba(45,212,191,.18)}
      #${LOBBY_ID} .secondary{background:rgba(255,255,255,.14);color:#fff;border:1px solid rgba(255,255,255,.20)}
      #${LOBBY_ID} .warn{background:#fff5d6;color:#8a5700}
      @media(max-width:760px){
        #${LOBBY_ID}{margin:10px 8px 14px;padding:13px;border-radius:18px;max-width:calc(100vw - 16px)}
        #${LOBBY_ID} .lob-grid{grid-template-columns:1fr;gap:10px}
        #${LOBBY_ID} .lob-actions{display:grid;grid-template-columns:1fr;gap:8px}
        #${LOBBY_ID} button{width:100%;font-size:14px}
      }
    `;
    document.head.appendChild(style);
  }

  function anchor(){
    const app = document.getElementById('app') || document.body;
    const title = Array.from(app.querySelectorAll('h1,h2')).find(el => /EAP Hero:\s*Save the Society/i.test(clean(el.textContent)));
    const card = title && title.closest('section,div,main');
    return { app, anchor: card || title || app.firstElementChild };
  }

  function openCurrent(){
    const route = currentRoute();
    try {
      localStorage.setItem('EAP_HERO_ACTIVE_ROUTE', route.routeId);
      localStorage.setItem('EAP_HERO_CURRENT_ROUTE', route.routeId);
      const n = sessionNo(route);
      if (n) localStorage.setItem('EAP_HERO_CURRENT_SESSION', String(n));
    } catch(error) {}
    if (route.routeType === 'boss_gate' && window.EAPHero && typeof window.EAPHero.startGateBoss === 'function') return window.EAPHero.startGateBoss(route.routeId);
    if (window.EAPHero && typeof window.EAPHero.skillHub === 'function') return window.EAPHero.skillHub(sessionNo(route) || 1);
    if (window.EAPHero && typeof window.EAPHero.map === 'function') return window.EAPHero.map();
  }

  function openMap(){ if (window.EAPHero && typeof window.EAPHero.map === 'function') window.EAPHero.map(); }
  function openReport(){ if (window.EAPHero && typeof window.EAPHero.report === 'function') window.EAPHero.report(); }
  function openProfile(){ if (window.EAPHero && typeof window.EAPHero.profile === 'function') window.EAPHero.profile(); }

  function render(){
    const route = currentRoute();
    const p = profile();
    const idText = p.studentId ? 'ID ' + p.studentId + ' · Section ' + p.section : 'กรอก Profile ก่อนเริ่มเรียน';
    return `
      <div class="lob-grid">
        <div>
          <div class="lob-kicker">Student Lobby</div>
          <h2>EAP Hero: Save the Society</h2>
          <p>เริ่มจากปุ่ม Start / Continue เพื่อเข้าเส้นทางล่าสุดทันที ส่วน Map ใช้ดูภาพรวม 15 Week และ Boss Gate เท่านั้น</p>
          <div class="lob-actions">
            <button type="button" class="primary" data-eap-lobby-action="continue">▶ Start / Continue</button>
            <button type="button" class="secondary" data-eap-lobby-action="map">🧭 Map</button>
            <button type="button" class="secondary" data-eap-lobby-action="report">📘 My Learning Report</button>
            <button type="button" class="secondary" data-eap-lobby-action="profile">👤 Profile</button>
          </div>
        </div>
        <div class="lob-now">
          <div class="lob-kicker">ตอนนี้</div>
          <div class="lob-title">${esc(currentLabel(route))}</div>
          <div class="lob-meta">${esc(route.title || '')}</div>
          <div class="lob-meta">${esc(p.studentName || 'Student')} · ${esc(idText)}</div>
        </div>
      </div>`;
  }

  function insert(){
    addStyle();
    const home = isHomeVisible();
    document.body.classList.toggle('eap-home-lobby-mode', home);
    const existing = document.getElementById(LOBBY_ID);
    if (!home) { if (existing) existing.remove(); return; }
    const a = anchor();
    let panel = existing;
    if (!panel) {
      panel = document.createElement('section');
      panel.id = LOBBY_ID;
      panel.setAttribute('aria-label','EAP Hero Student Lobby');
      if (a.anchor && a.anchor.parentNode) a.anchor.parentNode.insertBefore(panel, a.anchor.nextSibling);
      else a.app.insertBefore(panel, a.app.firstChild);
    }
    const route = currentRoute();
    const p = profile();
    const key = VERSION + '|' + (route && route.routeId || '') + '|' + p.studentId + '|' + p.section;
    if (panel.dataset.key !== key || !panel.innerHTML) {
      panel.dataset.key = key;
      panel.innerHTML = render();
    }
  }

  function click(e){
    const btn = e.target && e.target.closest && e.target.closest('[data-eap-lobby-action]');
    if (!btn) return;
    e.preventDefault();
    const action = btn.dataset.eapLobbyAction;
    if (action === 'continue') openCurrent();
    if (action === 'map') openMap();
    if (action === 'report') openReport();
    if (action === 'profile') openProfile();
  }

  function start(){
    document.addEventListener('click', click, true);
    window.addEventListener('load', insert);
    window.addEventListener('storage', insert);
    window.addEventListener('eap:resume-synced', () => setTimeout(insert, 180));
    new MutationObserver(insert).observe(document.documentElement, { childList:true, subtree:true, characterData:true });
    insert();
    setInterval(insert, 1400);
  }

  window.EAPStudentHomeLobby = { version: VERSION, refresh: insert, profile, currentRoute };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();