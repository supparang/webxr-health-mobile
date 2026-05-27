/* =========================================================
   HeroHealth Groups Race Run
   PATCH: v20260521-groups-race-run-safe-waiting-ui-02
   File: /herohealth/vr-groups/groups-race-run-safe-waiting-ui.js

   Purpose:
   - Fix waiting room UI showing Room Code "-" and Player "-"
   - Show safe waiting/recovery UI while Firebase is slow
   - Lock Race Start until at least 2 players
   - Preserve room/name when returning to Lobby
   - Avoid “looks frozen” state even when backend is unavailable
========================================================= */
(function(){
  'use strict';

  const PATCH_ID = 'v20260521-groups-race-run-safe-waiting-ui-02';
  if (window.__HHA_GROUPS_RACE_RUN_SAFE_WAITING_UI__) return;
  window.__HHA_GROUPS_RACE_RUN_SAFE_WAITING_UI__ = true;

  const qs = new URLSearchParams(location.search);

  const BASE = 'https://supparang.github.io/webxr-health-mobile';
  const HERO = BASE + '/herohealth';

  const RUN_FILE = HERO + '/vr-groups/groups-race-run.html';
  const LOBBY_FILE = HERO + '/vr-groups/groups-race-lobby.html';
  const ZONE_FILE = HERO + '/nutrition-zone.html';
  const HUB_FILE = HERO + '/hub.html';

  const state = {
    patch: PATCH_ID,
    room: cleanRoom(qs.get('roomId') || qs.get('room') || qs.get('code') || ''),
    name: cleanName(qs.get('name') || qs.get('player') || qs.get('playerName') || 'Hero'),
    diff: qs.get('diff') || 'normal',
    view: qs.get('view') || 'pc',
    playerCount: 1,
    firebaseReady: false,
    safeModeShown: false,
    lastScanAt: 0,
    startedAt: Date.now()
  };

  window.HHA_GROUPS_RACE_RUN_SAFE_UI = state;

  function cleanRoom(v){
    return String(v || '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 8) || 'ROOM';
  }

  function cleanName(v){
    return String(v || 'Hero')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 24) || 'Hero';
  }

  function buildUrl(base, extra){
    const out = new URL(base, location.href);

    [
      'pid',
      'name',
      'diff',
      'time',
      'view',
      'seed',
      'studyId',
      'conditionGroup',
      'api',
      'log',
      'hub'
    ].forEach(k => {
      const v = qs.get(k);
      if (v !== null && v !== '') out.searchParams.set(k, v);
    });

    out.searchParams.set('room', state.room);
    out.searchParams.set('roomId', state.room);
    out.searchParams.set('name', state.name);
    out.searchParams.set('mode', 'race');
    out.searchParams.set('game', 'groups');
    out.searchParams.set('gameId', 'groups');
    out.searchParams.set('zone', 'nutrition');

    Object.entries(extra || {}).forEach(([k,v]) => {
      if (v === null || v === undefined) out.searchParams.delete(k);
      else out.searchParams.set(k, String(v));
    });

    return out.toString();
  }

  function lobbyUrl(){
    return buildUrl(LOBBY_FILE, {
      run:null,
      race:null
    });
  }

  function zoneUrl(){
    return buildUrl(ZONE_FILE, {
      run:null,
      race:null,
      room:null,
      roomId:null,
      mode:null
    });
  }

  function retryUrl(){
    return buildUrl(RUN_FILE, {
      run:'race',
      race:'1',
      retry:Date.now()
    });
  }

  function addStyle(){
    if (document.getElementById('hha-race-safe-waiting-style')) return;

    const style = document.createElement('style');
    style.id = 'hha-race-safe-waiting-style';
    style.textContent = `
      .hha-race-safe-status{
        position:fixed;
        left:50%;
        bottom:calc(16px + env(safe-area-inset-bottom, 0px));
        transform:translateX(-50%);
        z-index:999998;
        width:min(92vw, 680px);
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:12px;
        padding:12px 14px;
        border-radius:24px;
        background:rgba(255,255,255,.94);
        color:#17304a;
        border:2px solid rgba(141,205,255,.72);
        box-shadow:0 18px 44px rgba(0,0,0,.24);
        font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      }

      .hha-race-safe-status strong{
        display:block;
        font-size:14px;
        line-height:1.15;
      }

      .hha-race-safe-status small{
        display:block;
        margin-top:3px;
        color:#657f91;
        font-weight:800;
        line-height:1.2;
      }

      .hha-race-safe-status .mini{
        display:flex;
        gap:8px;
        flex-wrap:wrap;
        justify-content:flex-end;
      }

      .hha-race-safe-status button{
        border:0;
        border-radius:999px;
        min-height:34px;
        padding:7px 11px;
        cursor:pointer;
        font-weight:900;
        color:#17304a;
        background:#eef8ff;
      }

      .hha-race-safe-status button.primary{
        color:white;
        background:linear-gradient(135deg,#61bbff,#2f95ff);
      }

      .hha-race-safe-card{
        position:fixed;
        left:50%;
        top:50%;
        transform:translate(-50%, -50%);
        z-index:999999;
        width:min(92vw, 580px);
        padding:22px;
        border-radius:30px;
        background:rgba(255,255,255,.97);
        color:#17304a;
        border:3px solid rgba(141,205,255,.78);
        box-shadow:0 30px 90px rgba(0,0,0,.36);
        text-align:center;
        font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      }

      .hha-race-safe-card h2{
        margin:0 0 10px;
        font-size:clamp(25px, 5vw, 36px);
        line-height:1.12;
      }

      .hha-race-safe-card p{
        margin:0 auto 14px;
        max-width:460px;
        color:#657f91;
        font-weight:850;
        font-size:clamp(14px, 3vw, 17px);
        line-height:1.45;
      }

      .hha-race-code-row{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:10px;
        margin:14px auto;
        max-width:430px;
      }

      .hha-race-code-box{
        padding:12px 10px;
        border-radius:20px;
        background:linear-gradient(180deg,#f5fbff,#ffffff);
        border:2px solid rgba(202,234,245,.9);
        box-shadow:0 8px 18px rgba(24,70,104,.08);
      }

      .hha-race-code-box b{
        display:block;
        margin-top:4px;
        font-size:22px;
        color:#17304a;
        letter-spacing:.5px;
      }

      .hha-race-code-box span{
        display:block;
        color:#728b9a;
        font-weight:900;
        font-size:12px;
      }

      .hha-race-safe-actions{
        display:flex;
        justify-content:center;
        flex-wrap:wrap;
        gap:10px;
        margin-top:16px;
      }

      .hha-race-safe-actions button,
      .hha-race-safe-actions a{
        border:0;
        border-radius:999px;
        min-height:46px;
        padding:12px 17px;
        cursor:pointer;
        font-weight:950;
        font-size:15px;
        text-decoration:none;
        display:inline-flex;
        align-items:center;
        justify-content:center;
      }

      .hha-race-safe-actions .primary{
        color:white;
        background:linear-gradient(135deg,#61bbff,#2f95ff);
      }

      .hha-race-safe-actions .soft{
        color:#17304a;
        background:#eef8ff;
      }

      .hha-race-safe-actions .danger{
        color:#8b2f1d;
        background:#ffe8dd;
      }

      .hha-race-start-disabled{
        opacity:.48 !important;
        filter:grayscale(.22);
        cursor:not-allowed !important;
      }

      .hha-race-param-fixed{
        animation:hhaRaceParamPulse .55s ease both;
      }

      @keyframes hhaRaceParamPulse{
        from{ filter:brightness(1.35); transform:scale(1.02); }
        to{ filter:none; transform:scale(1); }
      }

      @media (max-width:720px){
        .hha-race-safe-status{
          align-items:flex-start;
          flex-direction:column;
        }

        .hha-race-safe-status .mini{
          width:100%;
          justify-content:flex-start;
        }

        .hha-race-code-row{
          grid-template-columns:1fr;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function textOf(el){
    return String(el && (el.innerText || el.textContent || el.getAttribute('aria-label') || '') || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function pageText(){
    return String(document.body && document.body.innerText || '');
  }

  function looksLikeDashValue(t){
    const s = String(t || '').trim();
    return s === '-' || s === '–' || s === '—' || s === '';
  }

  function setText(el, value){
    if (!el) return;
    if (textOf(el) === value) return;
    el.textContent = value;
    el.classList.add('hha-race-param-fixed');
  }

  function findValueNearLabel(labelText){
    const all = Array.from(document.querySelectorAll('*'));

    for (const el of all) {
      const t = textOf(el);
      if (!t) continue;

      if (!t.toLowerCase().includes(labelText.toLowerCase())) continue;

      const parent = el.parentElement;
      if (!parent) continue;

      const kids = Array.from(parent.querySelectorAll('*'));

      for (const k of kids) {
        if (k === el) continue;

        const kt = textOf(k);

        if (looksLikeDashValue(kt)) return k;

        if (
          labelText.toLowerCase().includes('room') &&
          /^[A-Z0-9]{4,8}$/.test(kt)
        ) {
          return k;
        }

        if (
          labelText.toLowerCase().includes('player') &&
          kt.length > 0 &&
          kt.length <= 28 &&
          !kt.toLowerCase().includes('player')
        ) {
          return k;
        }
      }

      const next = el.nextElementSibling;
      if (next) return next;
    }

    return null;
  }

  function forceRoomAndPlayerText(){
    const roomEl = findValueNearLabel('Room Code');
    const playerEl = findValueNearLabel('Player');

    if (roomEl) setText(roomEl, state.room);
    if (playerEl) setText(playerEl, state.name);

    // fallback: replace visible standalone dash boxes in the left status card
    const dashEls = Array.from(document.querySelectorAll('*'))
      .filter(el => {
        const t = textOf(el);
        if (!looksLikeDashValue(t)) return false;
        const r = el.getBoundingClientRect();
        if (r.width < 8 || r.height < 8) return false;
        if (r.left > window.innerWidth * 0.55) return false;
        return true;
      })
      .slice(0, 2);

    if (!roomEl && dashEls[0]) setText(dashEls[0], state.room);
    if (!playerEl && dashEls[1]) setText(dashEls[1], state.name);
  }

  function detectFirebaseReady(){
    const t = pageText();

    const loading =
      t.includes('กำลังเชื่อมต่อ Firebase') ||
      t.includes('กำลังตรวจสอบห้อง') ||
      t.includes('กำลังโหลดข้อมูลผู้เล่น') ||
      t.includes('รอข้อมูลจาก Firebase');

    const hasLive =
      t.includes('Live Players') &&
      !t.includes('กำลังโหลดข้อมูลผู้เล่น');

    if (!loading && hasLive) {
      state.firebaseReady = true;
    }

    return state.firebaseReady;
  }

  function detectPlayerCount(){
    const t = pageText();

    let count = 0;

    if (t.includes(state.name)) count = Math.max(count, 1);

    const possiblePlayerRows = Array.from(document.querySelectorAll('*'))
      .map(el => textOf(el))
      .filter(t => {
        if (!t) return false;
        if (t.length > 80) return false;

        if (
          t.includes('กำลังโหลด') ||
          t.includes('Firebase') ||
          t.includes('Live Players') ||
          t.includes('ผู้เล่นในห้อง') ||
          t.includes('รอ...')
        ) {
          return false;
        }

        return (
          t.includes('พร้อม') ||
          t.includes('Ready') ||
          t.includes(state.name)
        );
      });

    const names = new Set();

    possiblePlayerRows.forEach(row => {
      if (row.includes(state.name)) names.add(state.name.toLowerCase());

      const m = row.match(/[A-Za-zก-๙0-9_ -]{2,24}/g);
      if (m) {
        m.forEach(x => {
          const c = cleanName(x);
          if (
            c &&
            c.length >= 2 &&
            !/ready|พร้อม|player|race|room|code|start|firebase/i.test(c)
          ) {
            names.add(c.toLowerCase());
          }
        });
      }
    });

    count = Math.max(count, names.size);

    if (count < 1) count = 1;

    state.playerCount = count;

    return count;
  }

  function canStart(){
    return detectPlayerCount() >= 2 && detectFirebaseReady();
  }

  function lockStartButtons(){
    const ok = canStart();

    Array.from(document.querySelectorAll('a,button,[role="button"]')).forEach(el => {
      const txt = textOf(el);
      const href = String(el.getAttribute && el.getAttribute('href') || '');

      const isStart =
        txt.includes('เริ่มแข่ง') ||
        txt.includes('Race Start') ||
        txt.includes('Start') ||
        href.includes('groups-race-run.html');

      if (!isStart) return;

      el.classList.toggle('hha-race-start-disabled', !ok);
      el.setAttribute('aria-disabled', ok ? 'false' : 'true');

      if (!el.__hhaRaceSafeStartBound) {
        el.__hhaRaceSafeStartBound = true;

        el.addEventListener('click', function(ev){
          if (!canStart()) {
            ev.preventDefault();
            ev.stopPropagation();

            showSafeCard(
              'ยังเริ่ม Race ไม่ได้',
              'ต้องมีผู้เล่นอย่างน้อย 2 คน และห้องต้องโหลดข้อมูลสำเร็จก่อนเริ่มแข่ง'
            );

            return false;
          }
        }, true);
      }
    });
  }

  function patchBackButtons(){
    Array.from(document.querySelectorAll('a,button,[role="button"]')).forEach(el => {
      const txt = textOf(el);
      const href = String(el.getAttribute && el.getAttribute('href') || '');

      const isLobby =
        txt.includes('กลับ Lobby') ||
        txt.includes('Lobby') ||
        href.includes('groups-race-lobby.html');

      const isHub =
        txt.includes('กลับ HUB') ||
        txt.includes('HUB') ||
        href.includes('/hub.html');

      const isZone =
        txt.includes('Nutrition Zone') ||
        txt.includes('กลับ Zone') ||
        href.includes('nutrition-zone.html');

      if (isLobby) {
        if (el.tagName === 'A') el.href = lobbyUrl();

        if (!el.__hhaRaceLobbyBackBound) {
          el.__hhaRaceLobbyBackBound = true;
          el.addEventListener('click', function(ev){
            ev.preventDefault();
            ev.stopPropagation();
            location.href = lobbyUrl();
          }, true);
        }
      }

      if (isZone) {
        if (el.tagName === 'A') el.href = zoneUrl();

        if (!el.__hhaRaceZoneBackBound) {
          el.__hhaRaceZoneBackBound = true;
          el.addEventListener('click', function(ev){
            ev.preventDefault();
            ev.stopPropagation();
            location.href = zoneUrl();
          }, true);
        }
      }

      if (isHub && el.tagName === 'A') {
        el.href = buildUrl(HUB_FILE, {});
      }
    });
  }

  function ensureSafeStatus(){
    addStyle();

    let box = document.querySelector('.hha-race-safe-status');

    if (!box) {
      box = document.createElement('div');
      box.className = 'hha-race-safe-status';
      box.innerHTML = `
        <div>
          <strong data-race-safe-title>Race Waiting Guard</strong>
          <small data-race-safe-sub>กำลังตรวจสอบห้อง...</small>
        </div>
        <div class="mini">
          <button type="button" data-race-safe-copy>คัดลอก Room</button>
          <button type="button" data-race-safe-lobby>กลับ Lobby</button>
        </div>
      `;
      document.body.appendChild(box);

      box.querySelector('[data-race-safe-copy]').addEventListener('click', copyRoom);
      box.querySelector('[data-race-safe-lobby]').addEventListener('click', function(){
        location.href = lobbyUrl();
      });
    }

    const title = box.querySelector('[data-race-safe-title]');
    const sub = box.querySelector('[data-race-safe-sub]');

    const count = detectPlayerCount();
    const ready = detectFirebaseReady();

    title.textContent = ready
      ? 'Race Room Ready Check'
      : 'Race Waiting Guard';

    sub.textContent = ready
      ? `Room ${state.room} • Player ${state.name} • ผู้เล่น ${count}/2`
      : `Room ${state.room} • Player ${state.name} • รอ Firebase / ผู้เล่น ${count}/2`;
  }

  function copyRoom(){
    const text = state.room;

    try {
      navigator.clipboard.writeText(text);
      toast('คัดลอก Room Code แล้ว: ' + text);
    } catch(e) {
      toast('Room Code: ' + text);
    }
  }

  let toastTimer = null;

  function toast(message){
    let t = document.querySelector('.hha-race-safe-toast');

    if (!t) {
      t = document.createElement('div');
      t.className = 'hha-race-safe-toast';
      t.style.cssText = [
        'position:fixed',
        'left:50%',
        'bottom:90px',
        'transform:translateX(-50%)',
        'z-index:1000000',
        'width:min(90vw,520px)',
        'padding:12px 16px',
        'border-radius:18px',
        'background:rgba(22,38,58,.94)',
        'color:#fff',
        'text-align:center',
        'font:900 14px/1.35 system-ui',
        'box-shadow:0 18px 42px rgba(0,0,0,.30)',
        'opacity:0',
        'transition:.18s ease',
        'pointer-events:none'
      ].join(';');
      document.body.appendChild(t);
    }

    t.textContent = message;
    t.style.opacity = '1';

    clearTimeout(toastTimer);
    toastTimer = setTimeout(function(){
      t.style.opacity = '0';
    }, 1800);
  }

  function showSafeCard(title, message){
    addStyle();

    state.safeModeShown = true;

    let card = document.querySelector('.hha-race-safe-card');

    if (!card) {
      card = document.createElement('div');
      card.className = 'hha-race-safe-card';
      document.body.appendChild(card);
    }

    card.innerHTML = `
      <h2>⚠️ ${escapeHtml(title || 'Race ยังไม่พร้อม')}</h2>
      <p>${escapeHtml(message || 'ระบบกำลังรอข้อมูลห้องแข่งขัน')}</p>

      <div class="hha-race-code-row">
        <div class="hha-race-code-box">
          <span>Room Code</span>
          <b>${escapeHtml(state.room)}</b>
        </div>
        <div class="hha-race-code-box">
          <span>Player</span>
          <b>${escapeHtml(state.name)}</b>
        </div>
      </div>

      <p>
        สถานะตอนนี้: ผู้เล่น ${detectPlayerCount()}/2 •
        Firebase ${detectFirebaseReady() ? 'พร้อม' : 'ยังไม่พร้อม'}
      </p>

      <div class="hha-race-safe-actions">
        <button class="primary" type="button" data-act="copy">คัดลอก Room Code</button>
        <a class="soft" href="${escapeHtml(lobbyUrl())}" data-act="lobby">← กลับ Lobby</a>
        <a class="soft" href="${escapeHtml(retryUrl())}" data-act="retry">ลองโหลดใหม่</a>
        <a class="danger" href="${escapeHtml(zoneUrl())}" data-act="zone">กลับ Nutrition Zone</a>
      </div>
    `;

    card.querySelector('[data-act="copy"]').addEventListener('click', copyRoom);
  }

  function hideSafeCardIfReady(){
    if (!state.safeModeShown) return;
    if (!canStart()) return;

    const card = document.querySelector('.hha-race-safe-card');
    if (card) card.remove();

    state.safeModeShown = false;
  }

  function escapeHtml(s){
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function watchdog(){
    const age = Date.now() - state.startedAt;
    const ready = detectFirebaseReady();

    if (ready) return;

    if (age > 7000 && !state.safeModeShown) {
      showSafeCard(
        'ยังรอข้อมูลห้องแข่ง',
        'ระบบยังรับข้อมูลจาก Firebase ไม่สำเร็จ แต่หน้าไม่ค้างแล้ว สามารถกลับ Lobby หรือลองโหลดใหม่ได้'
      );
    }
  }

  function scan(){
    state.lastScanAt = Date.now();

    forceRoomAndPlayerText();
    detectFirebaseReady();
    detectPlayerCount();
    lockStartButtons();
    patchBackButtons();
    ensureSafeStatus();
    hideSafeCardIfReady();
  }

  function boot(){
    addStyle();

    scan();

    setTimeout(scan, 250);
    setTimeout(scan, 800);
    setTimeout(scan, 1600);
    setTimeout(watchdog, 7200);

    setInterval(scan, 1200);
    setInterval(watchdog, 3500);

    const mo = new MutationObserver(function(){
      clearTimeout(window.__HHA_GROUPS_RACE_SAFE_UI_TIMER__);
      window.__HHA_GROUPS_RACE_SAFE_UI_TIMER__ = setTimeout(scan, 120);
    });

    mo.observe(document.body, {
      childList:true,
      subtree:true,
      characterData:true,
      attributes:true,
      attributeFilter:['href','class','style','aria-disabled']
    });

    console.info('[Groups Race Run Safe Waiting UI]', PATCH_ID, {
      room:state.room,
      name:state.name,
      view:state.view,
      diff:state.diff
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, {once:true});
  } else {
    boot();
  }

})();
(function(){
  'use strict';

  const PATCH_ID = 'v20260527-race-run-safe-waiting-ui-03';

  if (window.__HHA_GROUPS_RACE_SAFE_WAITING_UI_03__) return;
  window.__HHA_GROUPS_RACE_SAFE_WAITING_UI_03__ = true;

  const qs = new URLSearchParams(location.search);

  function $(id){ return document.getElementById(id); }

  function getRoom(){
    return (
      qs.get('roomId') ||
      qs.get('room') ||
      qs.get('code') ||
      sessionStorage.getItem('HHA_GROUPS_RACE_ROOM') ||
      ''
    ).trim().toUpperCase();
  }

  function getName(){
    return (
      qs.get('name') ||
      qs.get('playerName') ||
      sessionStorage.getItem('HHA_GROUPS_RACE_NAME') ||
      'Hero'
    ).trim();
  }

  function setText(id, text){
    const el = $(id);
    if (el) el.textContent = text;
  }

  function paintBase(){
    const room = getRoom();
    const name = getName();

    if (room) {
      setText('metaRoom', room);
      try { sessionStorage.setItem('HHA_GROUPS_RACE_ROOM', room); } catch(e) {}
    }

    if (name) {
      setText('metaName', name);
      try { sessionStorage.setItem('HHA_GROUPS_RACE_NAME', name); } catch(e) {}
    }

    const status = $('statusMsg');
    if (status) {
      status.className = 'status-text warn';
      status.textContent = room
        ? 'เข้าห้องแล้ว: ' + room + ' • กำลังซิงก์ผู้เล่นจาก Firebase...'
        : 'ไม่พบ Room Code ใน URL';
    }

    const state = $('roomState');
    if (state) {
      state.textContent = room
        ? 'ห้อง ' + room + ' พร้อมรอผู้เล่นอย่างน้อย 2 คน'
        : 'ยังไม่มี Room Code';
    }

    const list = $('playersList');
    if (list && room && /กำลังโหลดข้อมูลผู้เล่น/.test(list.textContent || '')) {
      list.innerHTML =
        '<div class="player">' +
          '<div class="left">' +
            '<div class="avatar">🏁</div>' +
            '<div>' +
              '<div class="name">' + escapeHtml(name) + '</div>' +
              '<div class="tag">Host / local waiting • room ' + escapeHtml(room) + '</div>' +
            '</div>' +
          '</div>' +
          '<div class="right wait">รอเพื่อน</div>' +
        '</div>';
    }
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, function(c){
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];
    });
  }

  function patchButtons(){
    const room = getRoom();
    const name = getName();

    const backLobby = $('btnBackLobby');
    if (backLobby && !backLobby.__hhaSafeBound) {
      backLobby.__hhaSafeBound = true;
      backLobby.addEventListener('click', function(ev){
        ev.preventDefault();
        location.href =
          './groups-race-lobby.html?room=' + encodeURIComponent(room) +
          '&roomId=' + encodeURIComponent(room) +
          '&name=' + encodeURIComponent(name);
      }, true);
    }

    const backHub = $('btnBackHub');
    if (backHub && !backHub.__hhaSafeBound) {
      backHub.__hhaSafeBound = true;
      backHub.addEventListener('click', function(ev){
        ev.preventDefault();
        location.href = '../groups-vr.html?mode=race&view=pc&name=' + encodeURIComponent(name);
      }, true);
    }
  }

  function boot(){
    paintBase();
    patchButtons();

    setTimeout(paintBase, 300);
    setTimeout(paintBase, 900);
    setTimeout(paintBase, 1800);

    console.info('[Groups Race Safe Waiting UI]', PATCH_ID, {
      room: getRoom(),
      name: getName()
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }
})();
