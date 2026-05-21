/* =========================================================
   HeroHealth Groups Race Lobby
   PATCH: v20260521-groups-race-lobby-guard-01
   File: /herohealth/vr-groups/groups-race-lobby-guard.js

   Purpose:
   - Prevent Race starting with only 1 player
   - Block navigation to groups-race-run.html until room has >= 2 players
   - Detect duplicate player name on visible lobby UI
   - Normalize room code display / links
   - Add safe toast + QA badge
========================================================= */
(function(){
  'use strict';

  const PATCH_ID = 'v20260521-groups-race-lobby-guard-01';
  if (window.__HHA_GROUPS_RACE_LOBBY_GUARD__) return;
  window.__HHA_GROUPS_RACE_LOBBY_GUARD__ = true;

  const qs = new URLSearchParams(location.search);

  const BASE = 'https://supparang.github.io/webxr-health-mobile';
  const HERO = BASE + '/herohealth';

  const RUN_FILE = HERO + '/vr-groups/groups-race-run.html';
  const LOBBY_FILE = HERO + '/vr-groups/groups-race-lobby.html';
  const ZONE_FILE = HERO + '/nutrition-zone.html';
  const HUB_FILE = HERO + '/hub.html';

  const state = {
    patch: PATCH_ID,
    room: normalizeRoom(qs.get('roomId') || qs.get('room') || qs.get('code') || ''),
    name: normalizeName(qs.get('name') || qs.get('player') || 'Hero'),
    playerCount: 0,
    duplicateName: false,
    lastReason: '',
    lastScanAt: 0
  };

  window.HHA_GROUPS_RACE_LOBBY_GUARD = state;

  function normalizeRoom(v){
    const raw = String(v || '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 6);

    return raw || makeRoomCode();
  }

  function makeRoomCode(){
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let out = '';
    for (let i = 0; i < 6; i++) {
      out += chars[Math.floor(Math.random() * chars.length)];
    }
    return out;
  }

  function normalizeName(v){
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

  function goLobby(){
    location.href = buildUrl(LOBBY_FILE, { run:null });
  }

  function goZone(){
    location.href = buildUrl(ZONE_FILE, {
      mode:null,
      room:null,
      roomId:null,
      run:null
    });
  }

  function goRun(){
    location.href = buildUrl(RUN_FILE, {
      run:'race',
      race:'1'
    });
  }

  function addStyle(){
    if (document.getElementById('hha-race-lobby-guard-style')) return;

    const style = document.createElement('style');
    style.id = 'hha-race-lobby-guard-style';
    style.textContent = `
      .hha-race-lobby-guard-pill{
        position:fixed;
        right:12px;
        bottom:12px;
        z-index:999998;
        padding:8px 11px;
        border-radius:999px;
        background:rgba(255,255,255,.92);
        color:#17304a;
        border:1px solid rgba(141,205,255,.75);
        box-shadow:0 10px 24px rgba(0,0,0,.18);
        font:900 11px/1.1 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      }

      .hha-race-lobby-guard-toast{
        position:fixed;
        left:50%;
        bottom:calc(62px + env(safe-area-inset-bottom, 0px));
        transform:translateX(-50%) translateY(10px);
        z-index:999999;
        width:min(92vw, 520px);
        padding:12px 16px;
        border-radius:20px;
        background:rgba(22,38,58,.94);
        color:#fff;
        text-align:center;
        font:900 14px/1.35 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        box-shadow:0 18px 42px rgba(0,0,0,.30);
        opacity:0;
        pointer-events:none;
        transition:.18s ease;
      }

      .hha-race-lobby-guard-toast.show{
        opacity:1;
        transform:translateX(-50%) translateY(0);
      }

      .hha-race-start-locked{
        opacity:.52 !important;
        filter:grayscale(.18);
        cursor:not-allowed !important;
      }

      .hha-race-start-ready{
        opacity:1 !important;
        filter:none !important;
      }

      .hha-race-safe-note{
        display:block;
        margin-top:8px;
        padding:8px 10px;
        border-radius:14px;
        background:rgba(255,245,215,.95);
        color:#6e4a00;
        font:900 12px/1.25 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      }
    `;
    document.head.appendChild(style);
  }

  let toastBox = null;
  let toastTimer = null;

  function toast(msg){
    addStyle();

    if (!toastBox) {
      toastBox = document.createElement('div');
      toastBox.className = 'hha-race-lobby-guard-toast';
      document.body.appendChild(toastBox);
    }

    toastBox.textContent = msg;
    toastBox.classList.add('show');

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastBox.classList.remove('show');
    }, 2200);

    try {
      window.dispatchEvent(new CustomEvent('hha:toast', {
        detail:{ type:'warn', message:msg }
      }));
    } catch(e) {}
  }

  function textOf(el){
    return String(el && (el.innerText || el.textContent || el.getAttribute('aria-label') || '') || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function pageText(){
    return String(document.body && document.body.innerText || '');
  }

  function findPlayerArea(){
    const all = Array.from(document.querySelectorAll('section,article,main,div,ul,ol'));

    const candidates = all
      .map(el => {
        const t = textOf(el);
        const r = el.getBoundingClientRect();
        return { el, t, area: r.width * r.height };
      })
      .filter(x => {
        if (x.area < 3000) return false;
        return (
          x.t.includes('ผู้เล่น') ||
          x.t.includes('Live Players') ||
          x.t.includes('Players') ||
          x.t.includes('Player')
        );
      })
      .sort((a,b) => a.area - b.area);

    return candidates.length ? candidates[0].el : null;
  }

  function collectVisibleNames(){
    const area = findPlayerArea();
    const root = area || document.body;

    const texts = Array.from(root.querySelectorAll('*'))
      .map(el => textOf(el))
      .filter(t => {
        if (!t) return false;
        if (t.length > 40) return false;

        const reject = [
          'Live Players',
          'Players',
          'Player',
          'ผู้เล่น',
          'กำลังโหลด',
          'รอข้อมูล',
          'Firebase',
          'พร้อม',
          'รอ...',
          'Race',
          'Start'
        ];

        if (reject.some(x => t.includes(x))) return false;

        return /[A-Za-zก-๙0-9]/.test(t);
      });

    const names = [];

    texts.forEach(t => {
      const clean = normalizeName(t);

      if (!clean) return;
      if (clean.length < 2) return;

      if (
        clean === state.name ||
        clean.includes(state.name) ||
        state.name.includes(clean)
      ) {
        names.push(state.name);
        return;
      }

      if (!/room|code|start|lobby|hub|zone/i.test(clean)) {
        names.push(clean);
      }
    });

    const unique = Array.from(new Set(names));

    if (unique.length === 0 && pageText().includes(state.name)) {
      unique.push(state.name);
    }

    return names.length ? names : unique;
  }

  function detectDuplicateName(names){
    const count = names.filter(n => normalizeName(n).toLowerCase() === state.name.toLowerCase()).length;
    return count > 1;
  }

  function detectPlayerCount(){
    const names = collectVisibleNames();
    const unique = Array.from(new Set(names.map(n => normalizeName(n).toLowerCase())));

    let count = unique.length;

    const t = pageText();

    if (t.includes('ต้องมีอย่างน้อย 2 คน') && count < 2) {
      count = Math.max(count, 1);
    }

    if (t.includes('รอผู้เล่น') && count < 2) {
      count = Math.max(count, 1);
    }

    if (count < 1 && t.includes(state.name)) {
      count = 1;
    }

    state.playerCount = count;
    state.duplicateName = detectDuplicateName(names);

    return count;
  }

  function canStartRace(){
    const count = detectPlayerCount();

    if (state.duplicateName) {
      state.lastReason = 'ชื่อผู้เล่นซ้ำในห้อง กรุณาใช้ชื่อไม่ซ้ำ';
      return false;
    }

    if (count < 2) {
      state.lastReason = 'Race ต้องมีผู้เล่นอย่างน้อย 2 คนก่อนเริ่ม';
      return false;
    }

    state.lastReason = '';
    return true;
  }

  function isStartElement(el){
    const txt = textOf(el);
    const href = String(el.getAttribute && el.getAttribute('href') || '');

    return (
      txt.includes('Start') ||
      txt.includes('Race Start') ||
      txt.includes('เริ่มแข่ง') ||
      txt.includes('เริ่ม Race') ||
      href.includes('groups-race-run.html')
    );
  }

  function isRunLink(el){
    const href = String(el.getAttribute && el.getAttribute('href') || '');
    return href.includes('groups-race-run.html');
  }

  function patchStartButtons(){
    const ready = canStartRace();

    const buttons = Array.from(document.querySelectorAll('a,button,[role="button"],input[type="submit"]'));

    buttons.forEach(btn => {
      if (!isStartElement(btn)) return;

      btn.classList.toggle('hha-race-start-locked', !ready);
      btn.classList.toggle('hha-race-start-ready', ready);
      btn.setAttribute('aria-disabled', ready ? 'false' : 'true');

      if (btn.tagName === 'A') {
        btn.href = buildUrl(RUN_FILE, {
          run:'race',
          race:'1'
        });
      }

      if (!btn.__hhaRaceStartGuardBound) {
        btn.__hhaRaceStartGuardBound = true;

        btn.addEventListener('click', function(ev){
          const ok = canStartRace();

          if (!ok) {
            ev.preventDefault();
            ev.stopPropagation();
            toast(state.lastReason || 'ยังเริ่ม Race ไม่ได้');
            ensureSafeNote(btn);
            return false;
          }

          ev.preventDefault();
          ev.stopPropagation();
          goRun();
          return false;
        }, true);
      }
    });
  }

  function ensureSafeNote(anchor){
    if (!anchor || !anchor.parentElement) return;

    let note = anchor.parentElement.querySelector('.hha-race-safe-note');

    if (!note) {
      note = document.createElement('div');
      note.className = 'hha-race-safe-note';
      anchor.parentElement.appendChild(note);
    }

    note.textContent = state.lastReason || 'Race ต้องรอผู้เล่นครบก่อน';
  }

  function patchRunLinks(){
    Array.from(document.querySelectorAll('a')).forEach(a => {
      if (!isRunLink(a)) return;

      a.href = buildUrl(RUN_FILE, {
        run:'race',
        race:'1'
      });
    });
  }

  function interceptForms(){
    Array.from(document.querySelectorAll('form')).forEach(form => {
      if (form.__hhaRaceFormGuardBound) return;
      form.__hhaRaceFormGuardBound = true;

      form.addEventListener('submit', function(ev){
        const action = String(form.getAttribute('action') || '');
        const txt = textOf(form);

        const likelyRaceStart =
          action.includes('groups-race-run') ||
          txt.includes('Race') ||
          txt.includes('เริ่มแข่ง');

        if (!likelyRaceStart) return;

        if (!canStartRace()) {
          ev.preventDefault();
          ev.stopPropagation();
          toast(state.lastReason || 'ยังเริ่ม Race ไม่ได้');
          return false;
        }
      }, true);
    });
  }

  function patchRoomInputs(){
    const inputs = Array.from(document.querySelectorAll('input,textarea'));

    inputs.forEach(input => {
      const name = String(input.name || input.id || input.placeholder || '').toLowerCase();

      const isRoom =
        name.includes('room') ||
        name.includes('code') ||
        name.includes('ห้อง');

      const isName =
        name.includes('name') ||
        name.includes('player') ||
        name.includes('ชื่อ');

      if (isRoom && !input.__hhaRoomGuardBound) {
        input.__hhaRoomGuardBound = true;

        if (!input.value) input.value = state.room;

        input.addEventListener('input', function(){
          const clean = normalizeRoom(input.value);
          input.value = clean;
          state.room = clean;
          patchRunLinks();
        });
      }

      if (isName && !input.__hhaNameGuardBound) {
        input.__hhaNameGuardBound = true;

        if (!input.value) input.value = state.name;

        input.addEventListener('input', function(){
          state.name = normalizeName(input.value);
          input.value = state.name;
          patchRunLinks();
          patchStartButtons();
        });
      }
    });
  }

  function patchBackButtons(){
    const items = Array.from(document.querySelectorAll('a,button,[role="button"]'));

    items.forEach(el => {
      const txt = textOf(el);
      const href = String(el.getAttribute && el.getAttribute('href') || '');

      const isZone =
        txt.includes('Nutrition Zone') ||
        txt.includes('กลับ Zone') ||
        txt.includes('กลับโซน') ||
        href.includes('nutrition-zone.html');

      const isHub =
        txt.includes('HUB') ||
        txt.includes('Hub') ||
        href.includes('/hub.html');

      if (isZone) {
        if (el.tagName === 'A') {
          el.href = buildUrl(ZONE_FILE, {
            mode:null,
            room:null,
            roomId:null,
            run:null
          });
        }

        if (!el.__hhaZoneGuardBound) {
          el.__hhaZoneGuardBound = true;
          el.addEventListener('click', function(ev){
            ev.preventDefault();
            ev.stopPropagation();
            goZone();
          }, true);
        }
      }

      if (isHub && el.tagName === 'A') {
        el.href = buildUrl(HUB_FILE, {});
      }
    });
  }

  function interceptLocationClicks(){
    if (document.__hhaRaceLobbyGlobalClickGuard) return;
    document.__hhaRaceLobbyGlobalClickGuard = true;

    document.addEventListener('click', function(ev){
      const a = ev.target && ev.target.closest && ev.target.closest('a');

      if (!a) return;

      const href = String(a.href || '');

      if (!href.includes('groups-race-run.html')) return;

      if (!canStartRace()) {
        ev.preventDefault();
        ev.stopPropagation();
        toast(state.lastReason || 'Race ต้องมีผู้เล่นครบก่อน');
        return false;
      }
    }, true);
  }

  function ensurePill(){
    addStyle();

    let pill = document.querySelector('.hha-race-lobby-guard-pill');

    if (!pill) {
      pill = document.createElement('div');
      pill.className = 'hha-race-lobby-guard-pill';
      document.body.appendChild(pill);
    }

    const ready = canStartRace();

    pill.textContent = ready
      ? 'Race Ready • ' + state.playerCount + ' players'
      : 'Race Guard • ' + state.playerCount + '/2 players';

    pill.style.background = ready
      ? 'rgba(222,255,231,.94)'
      : 'rgba(255,255,255,.92)';
  }

  function scan(){
    state.lastScanAt = Date.now();

    patchRoomInputs();
    patchRunLinks();
    patchStartButtons();
    patchBackButtons();
    interceptForms();
    interceptLocationClicks();
    ensurePill();
  }

  function boot(){
    addStyle();

    scan();

    setTimeout(scan, 300);
    setTimeout(scan, 900);
    setTimeout(scan, 1800);

    setInterval(scan, 1200);

    const mo = new MutationObserver(function(){
      clearTimeout(window.__HHA_GROUPS_RACE_LOBBY_SCAN_TIMER__);
      window.__HHA_GROUPS_RACE_LOBBY_SCAN_TIMER__ = setTimeout(scan, 120);
    });

    mo.observe(document.body, {
      childList:true,
      subtree:true,
      characterData:true,
      attributes:true,
      attributeFilter:['href','class','value','disabled','aria-disabled']
    });

    console.info('[HeroHealth Groups Race Lobby]', PATCH_ID, 'ready', state);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, {once:true});
  } else {
    boot();
  }

})();
