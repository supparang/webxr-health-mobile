/* =========================================================
   EAP Hero Student Home Lobby v20260708
   V4 SINGLE-CTA ROBUST BOSS START
   - Home shows one clear learner action: Start / Continue.
   - Start / Continue now opens Boss Gate routes through EAPBossFourSkillV4
     if EAPHero.startGateBoss has not finished patching yet.
   - Also falls back to EAPSkillHubRouteLock.runCurrentRoute when available.
   - Existing profile and progress are preserved: studentId + section +
     Cloud Resume still come from the same keys and Sheet API.
   - UI/routing only. Does not change profile keys, Sheet sync, scores,
     pass/fail, evidence, teacher review, or unlock logic.
========================================================= */
(function(){
  'use strict';

  const VERSION = 'v20260710-EAP-STUDENT-HOME-LOBBY-V4-ROBUST-BOSS-START';
  const LOBBY_ID = 'eap-student-compact-lobby';
  const STYLE_ID = 'eap-student-home-lobby-style-v4';
  const ROADMAP_ID = 'eap-student-15week-roadmap';
  const PROFILE_KEY = 'EAP_HERO_PLAYER_PROFILE_V1';
  const STATE_KEY = 'EAP_HERO_PROGRESS_V3';
  const PACK_NAME = 'EAP_HERO_SESSION_CONTENT_PACK';
  const HIDDEN_ATTR = 'data-eap-home-single-hidden';

  function clean(v){ return String(v == null ? '' : v).replace(/\s+/g,' ').trim(); }
  function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])); }
  function read(key, fallback){ try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch(error){ return fallback; } }
  function pack(){ const data = window[PACK_NAME]; return data && Array.isArray(data.routes) ? data : null; }
  function routeId(v){ const raw = clean(v).toUpperCase(); if (!raw) return ''; return /^\d+$/.test(raw) ? 'S' + Number(raw) : raw; }
  function byRouteId(id){ const data = pack(); const rid = routeId(id); return data && rid ? data.routes.find(r => routeId(r.routeId) === rid) || null : null; }
  function sessionNo(route){ const m = clean(route && route.routeId).match(/^S(\d+)$/i); return m ? Number(m[1]) : 0; }
  function gateNo(route){ const m = clean(route && route.routeId || route).match(/^B(\d+)$/i); return m ? Number(m[1]) : 0; }

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
      [${HIDDEN_ATTR}="1"]{display:none!important}
      #${LOBBY_ID}{margin:14px auto 16px;max-width:820px;border-radius:24px;padding:20px;background:linear-gradient(135deg,#102033,#17375e);color:#fff;border:1px solid rgba(153,246,228,.36);box-shadow:0 16px 40px rgba(8,25,45,.26);font-family:Arial,'Noto Sans Thai',sans-serif}
      #${LOBBY_ID} *{box-sizing:border-box}
      #${LOBBY_ID} .lob-grid{display:grid;grid-template-columns:1fr;gap:14px;align-items:stretch;text-align:center}
      #${LOBBY_ID} h2{margin:0 0 6px;font-size:clamp(26px,4vw,42px);line-height:1.08;color:#fff;font-weight:950}
      #${LOBBY_ID} p{margin:0 auto;color:#d8edf7;line-height:1.55;font-weight:850;max-width:660px}
      #${LOBBY_ID} .lob-now{display:grid;gap:5px;padding:13px;border-radius:18px;background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.16);max-width:520px;margin:0 auto;width:100%}
      #${LOBBY_ID} .lob-kicker{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#99f6e4;font-weight:950}
      #${LOBBY_ID} .lob-title{font-size:22px;font-weight:950;color:#fff;line-height:1.2}
      #${LOBBY_ID} .lob-meta{font-size:13px;color:#c7e4f4;font-weight:850}
      #${LOBBY_ID} .lob-actions{display:grid;grid-template-columns:minmax(220px,360px);justify-content:center;gap:9px;margin-top:16px}
      #${LOBBY_ID} button{border:0;border-radius:18px;padding:15px 18px;font-weight:950;cursor:pointer;min-height:56px;font-size:18px}
      #${LOBBY_ID} .primary{background:#9af3e9;color:#102033;box-shadow:0 12px 28px rgba(45,212,191,.22)}
      #${LOBBY_ID} .secondary{background:rgba(255,255,255,.12);color:#dffcf8;border:1px solid rgba(255,255,255,.22);font-size:14px;min-height:44px;padding:10px 14px;border-radius:14px}
      #${LOBBY_ID} .home-hint{font-size:12px;opacity:.9;margin-top:8px;color:#bdeee8}
      #${LOBBY_ID} .profile-hint{font-size:12px;color:#bdeee8;opacity:.9;margin-top:8px}
      @media(max-width:760px){#${LOBBY_ID}{margin:10px 8px 14px;padding:15px;border-radius:20px;max-width:calc(100vw - 16px)}#${LOBBY_ID} .lob-actions{grid-template-columns:1fr}#${LOBBY_ID} button{width:100%;font-size:17px;min-height:54px}#${LOBBY_ID} .secondary{font-size:14px;min-height:44px}}
    `;
    document.head.appendChild(style);
  }

  function hideNode(node){
    if (!node || node.id === LOBBY_ID || node.closest && node.closest('#' + LOBBY_ID)) return;
    node.setAttribute(HIDDEN_ATTR, '1');
    node.setAttribute('aria-hidden', 'true');
  }

  function unhideOwned(){
    Array.from(document.querySelectorAll('[' + HIDDEN_ATTR + '="1"]')).forEach(node => {
      if (!isHomeVisible()) { node.removeAttribute(HIDDEN_ATTR); node.removeAttribute('aria-hidden'); }
    });
  }

  function hideDuplicateActions(){
    if (!isHomeVisible()) { unhideOwned(); return; }
    const actionText = /^(?:🧭\s*)?map$|^(?:▶\s*)?continue$|^start\s*\/\s*continue$|^profile$|^my\s*learning\s*report$|^report$/i;
    Array.from(document.querySelectorAll('button,a,[role="button"]')).forEach(btn => {
      if (btn.closest('#' + LOBBY_ID)) return;
      const t = clean(btn.textContent).replace(/^[📘👤🧭▶]+\s*/,'');
      if (actionText.test(t)) hideNode(btn);
    });
    Array.from(document.querySelectorAll('section,aside,div')).forEach(node => {
      if (node.id === LOBBY_ID || node.closest('#' + LOBBY_ID)) return;
      const t = clean(node.textContent);
      if (/^Player Status\s+/.test(t) && /XP/.test(t) && /Progress/.test(t)) hideNode(node.closest('section,aside,.panel,.card,div') || node);
    });
    const title = Array.from(document.querySelectorAll('h1,h2')).find(el => /EAP Hero:\s*Save the Society/i.test(clean(el.textContent)) && !el.closest('#' + LOBBY_ID));
    const oldIntro = title && title.closest('section,main,.panel,.card,div');
    if (oldIntro) hideNode(oldIntro);
  }

  function anchor(){
    const app = document.getElementById('app') || document.body;
    const title = Array.from(app.querySelectorAll('h1,h2')).find(el => /EAP Hero:\s*Save the Society/i.test(clean(el.textContent)));
    const card = title && title.closest('section,div,main');
    return { app, anchor: card || title || app.firstElementChild };
  }

  function setActive(route){
    try {
      localStorage.setItem('EAP_HERO_ACTIVE_ROUTE', route.routeId);
      localStorage.setItem('EAP_HERO_CURRENT_ROUTE', route.routeId);
      const n = sessionNo(route);
      if (n) localStorage.setItem('EAP_HERO_CURRENT_SESSION', String(n));
    } catch(error) {}
  }

  function openBoss(route){
    const gate = gateNo(route);
    if (!gate) return false;
    if (window.EAPBossFourSkillV4 && typeof window.EAPBossFourSkillV4.start === 'function') { window.EAPBossFourSkillV4.start(gate); return true; }
    if (window.EAPHero && typeof window.EAPHero.startGateBoss === 'function') { window.EAPHero.startGateBoss(route.routeId); return true; }
    setTimeout(function(){ openBoss(route); }, 250);
    return true;
  }

  function openCurrent(){
    const route = currentRoute();
    setActive(route);
    if (route.routeType === 'boss_gate') return openBoss(route);
    if (window.EAPSkillHubRouteLock && typeof window.EAPSkillHubRouteLock.runCurrentRoute === 'function') return window.EAPSkillHubRouteLock.runCurrentRoute();
    if (window.EAPHero && typeof window.EAPHero.skillHub === 'function') return window.EAPHero.skillHub(sessionNo(route) || 1);
    if (window.EAPHero && typeof window.EAPHero.map === 'function') return window.EAPHero.map();
    setTimeout(openCurrent, 250);
  }

  function openProfile(){
    if (window.EAPPlayerProfile && typeof window.EAPPlayerProfile.open === 'function') return window.EAPPlayerProfile.open();
    if (window.EAPHero && typeof window.EAPHero.profile === 'function') return window.EAPHero.profile();
    alert('Profile ยังโหลดไม่เสร็จ กรุณารอสักครู่แล้วกดอีกครั้ง');
  }

  function render(){
    const route = currentRoute();
    const p = profile();
    const idText = p.studentId ? 'ID ' + p.studentId + ' · Section ' + p.section : 'กรอก Profile ก่อนเริ่มเรียน';
    return `<div class="lob-grid"><div><div class="lob-kicker">Student Lobby</div><h2>EAP Hero: Save the Society</h2><p>มีทางเดียวสำหรับนักศึกษา: กด Start / Continue แล้วระบบจะพาไปด่านล่าสุดที่ควรทำ</p><div class="lob-actions"><button type="button" class="primary" data-eap-lobby-action="continue">▶ Start / Continue</button><button type="button" class="secondary" data-eap-lobby-action="profile">👤 เปลี่ยนผู้เรียน / ย้ายเครื่อง</button></div><div class="home-hint">Map / Report ใช้หลังเข้าเรียนแล้ว เพื่อลดความสับสนหน้าแรก</div></div><div class="lob-now"><div class="lob-kicker">ตอนนี้</div><div class="lob-title">${esc(currentLabel(route))}</div><div class="lob-meta">${esc(route.title || '')}</div><div class="lob-meta">${esc(p.studentName || 'Student')} · ${esc(idText)}</div><div class="profile-hint">ย้ายเครื่อง/ใช้เครื่อง Lab: กด “เปลี่ยนผู้เรียน” แล้วกรอก Student ID + Section เดิม ระบบจะดึง progress จาก Sheet</div></div></div>`;
  }

  function insert(){
    addStyle();
    const home = isHomeVisible();
    document.body.classList.toggle('eap-home-lobby-mode', home);
    const existing = document.getElementById(LOBBY_ID);
    if (!home) { if (existing) existing.remove(); unhideOwned(); return; }
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
    if (panel.dataset.key !== key || !panel.innerHTML) { panel.dataset.key = key; panel.innerHTML = render(); }
    hideDuplicateActions();
  }

  function click(e){
    const btn = e.target && e.target.closest && e.target.closest('[data-eap-lobby-action]');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    const action = btn.getAttribute('data-eap-lobby-action');
    if (action === 'profile') return openProfile();
    openCurrent();
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

  window.EAPStudentHomeLobby = { version: VERSION, singleCTA: true, profileSwitch: true, refresh: insert, profile, currentRoute, openCurrent };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();