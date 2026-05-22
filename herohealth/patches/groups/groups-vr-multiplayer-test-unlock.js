/* =========================================================
   HeroHealth Food Groups Launcher
   PATCH: v20260522-groups-vr-multiplayer-test-unlock-01
   File: /herohealth/patches/groups/groups-vr-multiplayer-test-unlock.js

   Purpose:
   - Keep Solo as production path
   - Open Race / Battle / Duet / Coop as TEST entries
   - Let teacher/dev enter multiplayer lobby pages for testing
   - Multiplayer supports PC/Mobile first
   - Cardboard VR multiplayer remains locked unless ?mpcvr=1
========================================================= */
(function(){
  'use strict';

  const PATCH_ID = 'v20260522-groups-vr-multiplayer-test-unlock-01';

  if (window.__HHA_GROUPS_VR_MULTIPLAYER_TEST_UNLOCK__) return;
  window.__HHA_GROUPS_VR_MULTIPLAYER_TEST_UNLOCK__ = true;

  const qs = new URLSearchParams(location.search);

  const allowMpcvr =
    qs.get('mpcvr') === '1' ||
    qs.get('debug') === '1' ||
    qs.get('teacher') === '1';

  const mpModes = ['race','battle','duet','coop'];

  const modeLabels = {
    solo:'Solo',
    race:'Race',
    battle:'Battle',
    duet:'Duet',
    coop:'Coop'
  };

  const modeIcons = {
    solo:'🌱',
    race:'🏁',
    battle:'⚔️',
    duet:'🧑‍🤝‍🧑',
    coop:'🤝'
  };

  const viewLabels = {
    pc:'PC / Notebook',
    mobile:'Mobile',
    cvr:'Cardboard VR'
  };

  const routeMap = {
    race:'/herohealth/vr-groups/groups-race-lobby.html',
    battle:'/herohealth/vr-groups/groups-battle-lobby.html',
    duet:'/herohealth/vr-groups/groups-duet-lobby.html',
    coop:'/herohealth/vr-groups/groups-coop-lobby.html'
  };

  function repoBase(){
    const path = location.pathname;
    const marker = '/herohealth/';
    const idx = path.indexOf(marker);

    if (idx >= 0) {
      return location.origin + path.slice(0, idx);
    }

    return location.origin + '/webxr-health-mobile';
  }

  const BASE = repoBase();
  const HERO = BASE + '/herohealth';
  const ZONE = HERO + '/nutrition-zone.html';

  const launcherState =
    window.HHA_GROUPS_LAUNCHER &&
    window.HHA_GROUPS_LAUNCHER.state ||
    {
      mode:'solo',
      view:normalizeView(qs.get('view') || ''),
      variant:'arena'
    };

  window.HHA_GROUPS_LAUNCHER_MP_TEST = {
    patch:PATCH_ID,
    state:launcherState,
    allowMpcvr:allowMpcvr,
    buildLobbyUrl:buildLobbyUrl
  };

  function getParam(name, fallback){
    const v = qs.get(name);
    return v === null || v === '' ? fallback : v;
  }

  function isMobileUA(){
    return /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(navigator.userAgent || '');
  }

  function normalizeView(v){
    const raw = String(v || '').toLowerCase();

    if (['pc','desktop','notebook','laptop'].includes(raw)) return 'pc';
    if (['mobile','phone','touch','tablet'].includes(raw)) return 'mobile';
    if (['cvr','cardboard','cardboard-vr','vr','webxr'].includes(raw)) return 'cvr';

    return isMobileUA() ? 'mobile' : 'pc';
  }

  function makeRoomCode(){
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let out = '';

    for (let i = 0; i < 6; i++) {
      out += chars[Math.floor(Math.random() * chars.length)];
    }

    return out;
  }

  function currentRoom(){
    const raw =
      qs.get('roomId') ||
      qs.get('room') ||
      qs.get('code') ||
      sessionStorage.getItem('HHA_GROUPS_MP_TEST_ROOM') ||
      '';

    const clean = String(raw || '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 8);

    if (clean) return clean;

    const made = makeRoomCode();

    try {
      sessionStorage.setItem('HHA_GROUPS_MP_TEST_ROOM', made);
    } catch(e) {}

    return made;
  }

  function buildZoneUrl(){
    const out = new URL(ZONE);

    [
      'pid',
      'name',
      'studentId',
      'studentName',
      'classSection',
      'diff',
      'time',
      'view',
      'studyId',
      'conditionGroup',
      'api',
      'log'
    ].forEach(function(k){
      const v = qs.get(k);
      if (v !== null && v !== '') out.searchParams.set(k, v);
    });

    out.searchParams.set('pid', getParam('pid', 'anon'));
    out.searchParams.set('name', getParam('name', 'Hero'));
    out.searchParams.set('diff', getParam('diff', 'normal'));
    out.searchParams.set('time', getParam('time', '90'));
    out.searchParams.set('view', launcherState.view || normalizeView(''));
    out.searchParams.set('zone', 'nutrition');
    out.searchParams.set('cat', 'nutrition');
    out.searchParams.set('game', 'groups');

    return out.toString();
  }

  function buildLobbyUrl(mode, extra){
    const m = mpModes.includes(mode) ? mode : 'race';
    const path = routeMap[m];

    const out = new URL(BASE + path);
    const room = currentRoom();
    const view = normalizeView(launcherState.view || qs.get('view') || '');

    [
      'pid',
      'name',
      'studentId',
      'studentName',
      'classSection',
      'studyId',
      'conditionGroup',
      'api',
      'log',
      'qa',
      'debug',
      'teacher'
    ].forEach(function(k){
      const v = qs.get(k);
      if (v !== null && v !== '') out.searchParams.set(k, v);
    });

    out.searchParams.set('pid', getParam('pid', 'anon'));
    out.searchParams.set('name', getParam('name', 'Hero'));

    out.searchParams.set('room', room);
    out.searchParams.set('roomId', room);

    out.searchParams.set('mode', m);
    out.searchParams.set('mp', '1');
    out.searchParams.set('test', '1');

    out.searchParams.set('view', view);
    out.searchParams.set('diff', getParam('diff', 'normal'));
    out.searchParams.set('time', getParam('time', '90'));

    out.searchParams.set('zone', 'nutrition');
    out.searchParams.set('cat', 'nutrition');
    out.searchParams.set('game', 'groups');
    out.searchParams.set('gameId', 'groups');
    out.searchParams.set('entry', 'groups-vr-mp-test');
    out.searchParams.set('hub', getParam('hub', buildZoneUrl()));
    out.searchParams.set('back', getParam('back', buildZoneUrl()));
    out.searchParams.set('return', getParam('return', buildZoneUrl()));

    if (!out.searchParams.get('seed')) {
      out.searchParams.set('seed', String(Date.now()));
    }

    Object.entries(extra || {}).forEach(function(pair){
      const k = pair[0];
      const v = pair[1];

      if (v === null || v === undefined) out.searchParams.delete(k);
      else out.searchParams.set(k, String(v));
    });

    return out.toString();
  }

  function addStyle(){
    if (document.getElementById('hha-groups-vr-mp-test-style')) return;

    const style = document.createElement('style');
    style.id = 'hha-groups-vr-mp-test-style';
    style.textContent = `
      .hha-mp-test-ready{
        opacity:1 !important;
        filter:none !important;
        cursor:pointer !important;
      }

      .hha-mp-test-ready::after{
        content:"TEST";
        position:absolute;
        left:12px;
        top:12px;
        z-index:4;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        min-height:28px;
        padding:5px 9px;
        border-radius:999px;
        background:rgba(255,248,223,.95);
        color:#8b6810;
        border:2px solid rgba(255,217,102,.85);
        font:950 12px/1 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      }

      .hha-mp-test-selected{
        border-color:rgba(142,118,255,.95) !important;
        box-shadow:0 18px 44px rgba(142,118,255,.18) !important;
      }

      .hha-mp-cvr-locked{
        opacity:.48 !important;
        filter:grayscale(.2) !important;
        cursor:not-allowed !important;
      }

      .hha-mp-test-pill{
        position:fixed;
        right:12px;
        bottom:calc(12px + env(safe-area-inset-bottom, 0px));
        z-index:999998;
        padding:8px 11px;
        border-radius:999px;
        background:rgba(255,255,255,.92);
        color:#17304a;
        border:1px solid rgba(142,118,255,.45);
        box-shadow:0 10px 24px rgba(0,0,0,.16);
        font:900 11px/1.1 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        pointer-events:none;
      }

      body.hha-mp-test-mode #soloVariantSection{
        display:none !important;
      }
    `;

    document.head.appendChild(style);
  }

  let toastBox = null;
  let toastTimer = null;

  function toast(message){
    let box = document.getElementById('toast');

    if (!box) {
      if (!toastBox) {
        toastBox = document.createElement('div');
        toastBox.style.cssText = [
          'position:fixed',
          'left:50%',
          'bottom:calc(20px + env(safe-area-inset-bottom,0px))',
          'transform:translateX(-50%) translateY(18px)',
          'z-index:999999',
          'width:min(92vw,560px)',
          'padding:12px 16px',
          'border-radius:20px',
          'background:rgba(21,48,74,.94)',
          'color:white',
          'text-align:center',
          'font-weight:900',
          'box-shadow:0 18px 44px rgba(0,0,0,.25)',
          'opacity:0',
          'pointer-events:none',
          'transition:.18s ease'
        ].join(';');

        document.body.appendChild(toastBox);
      }

      box = toastBox;
    }

    box.textContent = String(message || '');
    box.classList.add('show');
    box.style.opacity = '1';
    box.style.transform = 'translateX(-50%) translateY(0)';

    clearTimeout(toastTimer);
    toastTimer = setTimeout(function(){
      box.classList.remove('show');
      box.style.opacity = '0';
      box.style.transform = 'translateX(-50%) translateY(18px)';
    }, 1900);
  }

  function setBadge(el, text, kind){
    const badge = el.querySelector('.badge');

    if (!badge) return;

    badge.textContent = text;
    badge.className = 'badge ' + (kind || 'soon');
  }

  function updateModeCards(){
    document.querySelectorAll('[data-mode]').forEach(function(card){
      const mode = card.getAttribute('data-mode');

      if (mpModes.includes(mode)) {
        card.classList.remove('disabled');
        card.classList.add('hha-mp-test-ready');
        card.removeAttribute('data-disabled');
        setBadge(card, 'TEST', 'soon');
      }

      card.classList.toggle('active', launcherState.mode === mode);
      card.classList.toggle('hha-mp-test-selected', launcherState.mode === mode && mpModes.includes(mode));
    });
  }

  function updateDeviceCards(){
    const isMp = mpModes.includes(launcherState.mode);

    document.querySelectorAll('[data-view]').forEach(function(card){
      const view = card.getAttribute('data-view');

      card.classList.toggle('active', launcherState.view === view);

      if (!isMp) {
        card.classList.remove('hha-mp-cvr-locked');
        return;
      }

      if (view === 'cvr' && !allowMpcvr) {
        card.classList.add('hha-mp-cvr-locked');
        card.setAttribute('data-disabled', '1');
        setBadge(card, 'ทำทีหลัง', 'soon');
      } else {
        card.classList.remove('hha-mp-cvr-locked');
        card.removeAttribute('data-disabled');
        setBadge(card, view === 'cvr' ? 'TEST cVR' : 'TEST', 'ready');
      }
    });
  }

  function ensurePill(){
    addStyle();

    let pill = document.querySelector('.hha-mp-test-pill');

    if (!pill) {
      pill = document.createElement('div');
      pill.className = 'hha-mp-test-pill';
      document.body.appendChild(pill);
    }

    const isMp = mpModes.includes(launcherState.mode);

    pill.textContent = isMp
      ? 'Multiplayer TEST • ' + (modeLabels[launcherState.mode] || launcherState.mode)
      : 'Solo Production';
  }

  function updateSummary(){
    const isMp = mpModes.includes(launcherState.mode);

    document.body.classList.toggle('hha-mp-test-mode', isMp);

    updateModeCards();
    updateDeviceCards();
    ensurePill();

    if (!isMp) return;

    if (launcherState.view === 'cvr' && !allowMpcvr) {
      launcherState.view = 'pc';
    }

    const modeLabel = modeLabels[launcherState.mode] || launcherState.mode;
    const viewLabel = viewLabels[launcherState.view] || launcherState.view;
    const room = currentRoom();
    const targetUrl = buildLobbyUrl(launcherState.mode);

    const statusPill = document.getElementById('statusPill');
    const modePill = document.getElementById('modePill');
    const devicePill = document.getElementById('devicePill');
    const summaryTitle = document.getElementById('summaryTitle');
    const summaryText = document.getElementById('summaryText');
    const infoMode = document.getElementById('infoMode');
    const infoView = document.getElementById('infoView');
    const infoVariant = document.getElementById('infoVariant');
    const debugUrl = document.getElementById('debugUrl');
    const startBtn = document.getElementById('startBtn');

    if (statusPill) statusPill.textContent = '🧪 Multiplayer TEST';
    if (modePill) modePill.textContent = (modeIcons[launcherState.mode] || '🧩') + ' ' + modeLabel + ' TEST';
    if (devicePill) devicePill.textContent = deviceIcon(launcherState.view) + ' ' + viewLabel;

    if (summaryTitle) {
      summaryTitle.textContent = 'ทดสอบ: ' + modeLabel + ' • ' + viewLabel;
    }

    if (summaryText) {
      summaryText.textContent =
        'จะเปิดหน้า Lobby สำหรับทดสอบ Multiplayer ด้วย Room Code ' +
        room +
        ' • ใช้ PC/Mobile ก่อน ส่วน cVR multiplayer ทำภายหลัง';
    }

    if (infoMode) infoMode.textContent = modeLabel;
    if (infoView) infoView.textContent = viewLabel;
    if (infoVariant) infoVariant.textContent = room;

    if (debugUrl) debugUrl.textContent = targetUrl;

    if (startBtn) {
      startBtn.disabled = false;
      startBtn.textContent = 'เข้า Test Lobby';
    }
  }

  function deviceIcon(view){
    if (view === 'mobile') return '📱';
    if (view === 'cvr') return '🥽';
    return '💻';
  }

  function handleModeClick(ev){
    const card = ev.target && ev.target.closest && ev.target.closest('[data-mode]');

    if (!card) return;

    const mode = card.getAttribute('data-mode');

    if (!mpModes.includes(mode)) return;

    ev.preventDefault();
    ev.stopPropagation();

    if (typeof ev.stopImmediatePropagation === 'function') {
      ev.stopImmediatePropagation();
    }

    launcherState.mode = mode;

    if (launcherState.view === 'cvr' && !allowMpcvr) {
      launcherState.view = 'pc';
      toast('Multiplayer เริ่มทดสอบด้วย PC/Mobile ก่อน ส่วน Cardboard VR ทำทีหลัง');
    } else {
      toast('เปิด ' + (modeLabels[mode] || mode) + ' แบบ TEST');
    }

    updateSummary();

    return false;
  }

  function handleDeviceClick(ev){
    const card = ev.target && ev.target.closest && ev.target.closest('[data-view]');

    if (!card) return;
    if (!mpModes.includes(launcherState.mode)) return;

    const view = normalizeView(card.getAttribute('data-view'));

    ev.preventDefault();
    ev.stopPropagation();

    if (typeof ev.stopImmediatePropagation === 'function') {
      ev.stopImmediatePropagation();
    }

    if (view === 'cvr' && !allowMpcvr) {
      toast('Cardboard VR สำหรับ Multiplayer จะทำทีหลัง — ถ้าจะทดสอบจริงเติม ?mpcvr=1');
      launcherState.view = 'pc';
      updateSummary();
      return false;
    }

    launcherState.view = view;
    updateSummary();

    return false;
  }

  function handleStartClick(ev){
    if (!mpModes.includes(launcherState.mode)) return;

    ev.preventDefault();
    ev.stopPropagation();

    if (typeof ev.stopImmediatePropagation === 'function') {
      ev.stopImmediatePropagation();
    }

    if (launcherState.view === 'cvr' && !allowMpcvr) {
      toast('Multiplayer cVR ยังล็อกไว้ก่อน');
      return false;
    }

    const url = buildLobbyUrl(launcherState.mode, {
      seed:Date.now()
    });

    console.info('[Groups Multiplayer TEST] start', {
      patch:PATCH_ID,
      mode:launcherState.mode,
      view:launcherState.view,
      url:url
    });

    location.href = url;

    return false;
  }

  function handleCopyClick(ev){
    if (!mpModes.includes(launcherState.mode)) return;

    const btn = ev.target && ev.target.closest && ev.target.closest('#copyBtn');

    if (!btn) return;

    ev.preventDefault();
    ev.stopPropagation();

    if (typeof ev.stopImmediatePropagation === 'function') {
      ev.stopImmediatePropagation();
    }

    const url = buildLobbyUrl(launcherState.mode);

    try {
      navigator.clipboard.writeText(url);
      toast('คัดลอกลิงก์ Test Lobby แล้ว');
    } catch(e) {
      toast(url);
    }

    return false;
  }

  function bind(){
    if (document.__hhaGroupsMpTestBound) return;
    document.__hhaGroupsMpTestBound = true;

    document.addEventListener('click', handleModeClick, true);
    document.addEventListener('click', handleDeviceClick, true);

    const startBtn = document.getElementById('startBtn');

    if (startBtn) {
      startBtn.addEventListener('click', handleStartClick, true);
    }

    document.addEventListener('click', handleCopyClick, true);
  }

  function scan(){
    updateSummary();
  }

  function boot(){
    addStyle();
    bind();

    scan();

    setTimeout(scan, 300);
    setTimeout(scan, 900);
    setTimeout(scan, 1600);

    const mo = new MutationObserver(function(){
      clearTimeout(window.__HHA_GROUPS_MP_TEST_SCAN_TIMER__);
      window.__HHA_GROUPS_MP_TEST_SCAN_TIMER__ = setTimeout(scan, 120);
    });

    mo.observe(document.body, {
      childList:true,
      subtree:true,
      characterData:true,
      attributes:true,
      attributeFilter:['class','data-disabled','disabled','href']
    });

    console.info('[HeroHealth Groups Launcher]', PATCH_ID, {
      allowMpcvr:allowMpcvr,
      state:launcherState,
      routes:routeMap
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }

})();
