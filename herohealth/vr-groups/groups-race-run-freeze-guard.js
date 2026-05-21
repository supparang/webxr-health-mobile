/* =========================================================
   HeroHealth Groups Race Run
   PATCH: v20260521-groups-race-run-freeze-guard-01
   File: /herohealth/vr-groups/groups-race-run-freeze-guard.js

   Purpose:
   - Prevent Page Unresponsive on Race waiting page
   - Guard aggressive setInterval / setTimeout loops
   - Add Firebase waiting timeout
   - Stop race from auto-starting with only 1 player
   - Add safe fallback UI if Firebase is slow/unavailable
========================================================= */
(function(){
  'use strict';

  const PATCH_ID = 'v20260521-groups-race-run-freeze-guard-01';
  if (window.__HHA_GROUPS_RACE_RUN_FREEZE_GUARD__) return;
  window.__HHA_GROUPS_RACE_RUN_FREEZE_GUARD__ = true;

  const qs = new URLSearchParams(location.search);

  const BASE = 'https://supparang.github.io/webxr-health-mobile';
  const HERO = BASE + '/herohealth';
  const LOBBY = HERO + '/vr-groups/groups-race-lobby.html';
  const HUB = HERO + '/hub.html';
  const ZONE = HERO + '/nutrition-zone.html';

  const room =
    qs.get('roomId') ||
    qs.get('room') ||
    qs.get('code') ||
    '';

  const playerName =
    qs.get('name') ||
    qs.get('player') ||
    'Hero';

  const view =
    qs.get('view') ||
    'pc';

  const diff =
    qs.get('diff') ||
    'normal';

  const originalSetInterval = window.setInterval.bind(window);
  const originalClearInterval = window.clearInterval.bind(window);
  const originalSetTimeout = window.setTimeout.bind(window);

  const intervalMeta = new Map();

  window.HHA_GROUPS_RACE_SAFE = {
    patch: PATCH_ID,
    room,
    playerName,
    startedAt: Date.now(),
    firebaseReady: false,
    playerCount: 0,
    isSafeFallback: false,
    intervals: intervalMeta,
    stopAllIntervals,
    goLobby,
    goZone
  };

  function log(){
    try {
      console.info.apply(console, ['[Groups Race Guard]'].concat(Array.from(arguments)));
    } catch(e) {}
  }

  function warn(){
    try {
      console.warn.apply(console, ['[Groups Race Guard]'].concat(Array.from(arguments)));
    } catch(e) {}
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
      'room',
      'roomId',
      'studyId',
      'conditionGroup',
      'api',
      'log',
      'hub'
    ].forEach(k => {
      const v = qs.get(k);
      if (v !== null && v !== '') out.searchParams.set(k, v);
    });

    Object.entries(extra || {}).forEach(([k,v]) => {
      if (v === null || v === undefined) out.searchParams.delete(k);
      else out.searchParams.set(k, String(v));
    });

    return out.toString();
  }

  function goLobby(){
    location.href = buildUrl(LOBBY, {
      room,
      roomId: room,
      name: playerName,
      diff,
      view,
      mode: 'race',
      run: null
    });
  }

  function goZone(){
    location.href = buildUrl(ZONE, {
      zone: 'nutrition',
      game: 'groups',
      mode: null,
      run: null,
      room: null,
      roomId: null
    });
  }

  function stopAllIntervals(){
    intervalMeta.forEach((meta, id) => {
      try {
        originalClearInterval(id);
      } catch(e) {}
    });
    intervalMeta.clear();
    warn('All guarded intervals stopped');
  }

  window.setInterval = function guardedSetInterval(fn, delay){
    const requestedDelay = Number(delay || 0);

    let safeDelay = requestedDelay;

    if (!Number.isFinite(safeDelay) || safeDelay < 120) {
      safeDelay = 350;
    }

    if (safeDelay < 250) {
      safeDelay = 250;
    }

    let longRunCount = 0;
    let runCount = 0;

    const wrapped = function(){
      const started = performance.now();

      try {
        runCount += 1;

        if (runCount > 1200 && safeDelay < 500) {
          warn('Interval stopped because it ran too many times', {
            requestedDelay,
            safeDelay,
            runCount
          });
          originalClearInterval(id);
          intervalMeta.delete(id);
          return;
        }

        return typeof fn === 'function' ? fn.apply(this, arguments) : undefined;
      } catch(err) {
        warn('Interval callback error blocked', err);
      } finally {
        const cost = performance.now() - started;

        if (cost > 80) longRunCount += 1;
        else longRunCount = Math.max(0, longRunCount - 1);

        if (longRunCount >= 5) {
          warn('Interval stopped because callback is too heavy', {
            requestedDelay,
            safeDelay,
            cost,
            runCount
          });

          originalClearInterval(id);
          intervalMeta.delete(id);

          showFallback(
            'Race ทำงานหนักเกินไป',
            'ระบบหยุด loop ที่ทำให้หน้าเว็บค้างแล้ว กรุณากลับ Lobby แล้วเริ่มใหม่'
          );
        }
      }
    };

    const id = originalSetInterval(wrapped, safeDelay);

    intervalMeta.set(id, {
      requestedDelay,
      safeDelay,
      createdAt: Date.now()
    });

    return id;
  };

  window.clearInterval = function guardedClearInterval(id){
    intervalMeta.delete(id);
    return originalClearInterval(id);
  };

  function toast(msg){
    try {
      window.dispatchEvent(new CustomEvent('hha:toast', {
        detail: {
          type: 'warn',
          message: msg
        }
      }));
    } catch(e) {
      console.warn(msg);
    }
  }

  function addStyle(){
    if (document.getElementById('hha-race-freeze-guard-style')) return;

    const style = document.createElement('style');
    style.id = 'hha-race-freeze-guard-style';
    style.textContent = `
      .hha-race-safe-box{
        position:fixed;
        left:50%;
        top:50%;
        transform:translate(-50%, -50%);
        z-index:999999;
        width:min(92vw, 560px);
        padding:22px;
        border-radius:28px;
        background:rgba(255,255,255,.96);
        color:#17304a;
        border:3px solid rgba(141,205,255,.75);
        box-shadow:0 28px 80px rgba(0,0,0,.35);
        font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        text-align:center;
      }

      .hha-race-safe-box h2{
        margin:0 0 10px;
        font-size:clamp(24px, 5vw, 34px);
        line-height:1.15;
      }

      .hha-race-safe-box p{
        margin:0 0 16px;
        color:#64798a;
        font-weight:800;
        font-size:clamp(14px, 3vw, 17px);
        line-height:1.45;
      }

      .hha-race-safe-actions{
        display:flex;
        flex-wrap:wrap;
        justify-content:center;
        gap:12px;
        margin-top:16px;
      }

      .hha-race-safe-actions button{
        border:0;
        border-radius:999px;
        padding:13px 18px;
        min-height:48px;
        font-weight:900;
        cursor:pointer;
        font-size:15px;
      }

      .hha-race-safe-actions .primary{
        background:linear-gradient(135deg,#61bbff,#2f95ff);
        color:white;
      }

      .hha-race-safe-actions .soft{
        background:#eef8ff;
        color:#17304a;
      }

      .hha-race-safe-actions .danger{
        background:#ffe8dd;
        color:#8b2f1d;
      }

      .hha-race-safe-pill{
        position:fixed;
        right:12px;
        bottom:12px;
        z-index:999998;
        padding:8px 11px;
        border-radius:999px;
        background:rgba(255,255,255,.9);
        color:#17304a;
        border:1px solid rgba(141,205,255,.7);
        box-shadow:0 10px 24px rgba(0,0,0,.18);
        font:900 11px/1.1 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      }
    `;

    document.head.appendChild(style);
  }

  function showFallback(title, message){
    if (window.HHA_GROUPS_RACE_SAFE.isSafeFallback) return;
    window.HHA_GROUPS_RACE_SAFE.isSafeFallback = true;

    addStyle();

    const old = document.querySelector('.hha-race-safe-box');
    if (old) old.remove();

    const box = document.createElement('div');
    box.className = 'hha-race-safe-box';
    box.innerHTML = `
      <h2>⚠️ ${escapeHtml(title || 'Race ยังไม่พร้อม')}</h2>
      <p>${escapeHtml(message || 'ระบบกำลังรอข้อมูลจากห้องแข่งขันนานเกินไป')}</p>
      <p>
        Room Code: <b>${escapeHtml(room || '-')}</b><br>
        Player: <b>${escapeHtml(playerName || 'Hero')}</b>
      </p>
      <div class="hha-race-safe-actions">
        <button class="primary" type="button" data-act="lobby">← กลับ Lobby</button>
        <button class="soft" type="button" data-act="reload">ลองโหลดใหม่</button>
        <button class="danger" type="button" data-act="zone">กลับ Nutrition Zone</button>
      </div>
    `;

    document.body.appendChild(box);

    box.querySelector('[data-act="lobby"]').addEventListener('click', goLobby);
    box.querySelector('[data-act="zone"]').addEventListener('click', goZone);
    box.querySelector('[data-act="reload"]').addEventListener('click', function(){
      location.reload();
    });

    toast(title || 'Race ยังไม่พร้อม');
  }

  function escapeHtml(s){
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function pageText(){
    return String(document.body && document.body.innerText || '');
  }

  function detectPlayerCount(){
    const t = pageText();

    const livePlayers = Array.from(document.querySelectorAll('*'))
      .filter(el => {
        const txt = String(el.innerText || '').trim();
        if (!txt) return false;
        if (txt.length > 80) return false;

        return (
          txt.includes('พร้อม') ||
          txt.includes('รอ') ||
          txt.includes('Hero') ||
          txt.includes(playerName)
        );
      });

    const roomNames = new Set();

    livePlayers.forEach(el => {
      const txt = String(el.innerText || '').replace(/\s+/g, ' ').trim();
      if (txt.includes('Hero')) roomNames.add('Hero');
      if (playerName && txt.includes(playerName)) roomNames.add(playerName);
    });

    if (t.includes('ต้องมีอย่างน้อย 2 คน')) {
      window.HHA_GROUPS_RACE_SAFE.playerCount = Math.max(window.HHA_GROUPS_RACE_SAFE.playerCount, 1);
      return 1;
    }

    const guessed = Math.max(roomNames.size, window.HHA_GROUPS_RACE_SAFE.playerCount || 0);

    window.HHA_GROUPS_RACE_SAFE.playerCount = guessed;

    return guessed;
  }

  function patchStartButtons(){
    const count = detectPlayerCount();

    const buttons = Array.from(document.querySelectorAll('button,a,[role="button"]'));

    buttons.forEach(btn => {
      const txt = String(btn.innerText || btn.textContent || '').replace(/\s+/g, ' ').trim();

      const isStart =
        txt.includes('Start') ||
        txt.includes('เริ่มแข่ง') ||
        txt.includes('Race Start');

      if (!isStart) return;

      if (count < 2) {
        btn.setAttribute('aria-disabled', 'true');
        btn.style.opacity = '.55';
        btn.style.pointerEvents = 'auto';

        btn.addEventListener('click', function(ev){
          ev.preventDefault();
          ev.stopPropagation();
          toast('Race ต้องมีผู้เล่นอย่างน้อย 2 คนก่อนเริ่ม');
        }, true);
      }
    });
  }

  function patchBackButtons(){
    const buttons = Array.from(document.querySelectorAll('button,a,[role="button"]'));

    buttons.forEach(btn => {
      const txt = String(btn.innerText || btn.textContent || '').replace(/\s+/g, ' ').trim();
      const href = String(btn.getAttribute && btn.getAttribute('href') || '');

      const isLobby =
        txt.includes('กลับ Lobby') ||
        txt.includes('Lobby') ||
        href.includes('groups-race-lobby');

      const isHub =
        txt.includes('กลับ HUB') ||
        txt.includes('กลับ Hub') ||
        txt.includes('HUB') ||
        href.includes('/hub.html');

      if (isLobby) {
        if (btn.tagName === 'A') btn.href = buildUrl(LOBBY, { room, roomId: room });
        btn.addEventListener('click', function(ev){
          ev.preventDefault();
          ev.stopPropagation();
          goLobby();
        }, true);
      }

      if (isHub) {
        if (btn.tagName === 'A') btn.href = buildUrl(HUB, {});
      }
    });
  }

  function ensurePill(){
    if (document.querySelector('.hha-race-safe-pill')) return;
    addStyle();

    const pill = document.createElement('div');
    pill.className = 'hha-race-safe-pill';
    pill.textContent = 'Race Guard ON';
    document.body.appendChild(pill);
  }

  function installWatchdog(){
    originalSetTimeout(function(){
      const t = pageText();

      const stillWaiting =
        t.includes('กำลังเชื่อมต่อ Firebase') ||
        t.includes('กำลังตรวจสอบห้อง') ||
        t.includes('กำลังโหลดข้อมูลผู้เล่น') ||
        t.includes('รอผู้เล่นพร้อม');

      if (stillWaiting && !window.HHA_GROUPS_RACE_SAFE.firebaseReady) {
        stopAllIntervals();

        showFallback(
          'Firebase / ห้องแข่งตอบช้า',
          'หน้านี้รอข้อมูลห้องนานเกินไป จึงหยุด loop เพื่อกัน browser ค้าง'
        );
      }
    }, 9000);

    originalSetInterval(function(){
      try {
        patchStartButtons();
        patchBackButtons();

        const t = pageText();
        if (
          t.includes('Live Players') &&
          !t.includes('กำลังเชื่อมต่อ Firebase') &&
          !t.includes('กำลังโหลดข้อมูลผู้เล่น')
        ) {
          window.HHA_GROUPS_RACE_SAFE.firebaseReady = true;
        }
      } catch(e) {
        warn('watchdog scan error', e);
      }
    }, 1200);
  }

  function bindErrors(){
    window.addEventListener('error', function(ev){
      warn('error captured', ev.message || ev.error);
    }, true);

    window.addEventListener('unhandledrejection', function(ev){
      warn('promise rejection captured', ev.reason);
    }, true);
  }

  function boot(){
    addStyle();
    ensurePill();
    patchStartButtons();
    patchBackButtons();
    installWatchdog();
    bindErrors();

    log(PATCH_ID, {
      room,
      playerName,
      view,
      diff
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, {once:true});
  } else {
    boot();
  }

})();
