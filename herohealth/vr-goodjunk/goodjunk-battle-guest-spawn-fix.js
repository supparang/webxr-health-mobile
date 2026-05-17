/*
  HeroHealth • GoodJunk Battle Guest Spawn Fix
  v20260515-battle-v237-guest-spawn-fix

  Fixes:
  - Guest / KK เข้า Battle แล้วไม่มีเป้า
  - เกมเริ่มแล้ว แต่ local spawn loop ไม่ทำงานในเครื่อง guest
  - ถ้าไม่มี target หลังเริ่ม 2.5–3 วิ ให้เปิด local start/spawn fallback
*/

(function(){
  'use strict';

  window.HHA_GJ_BATTLE_GUEST_SPAWN_FIX =
    'v20260515-battle-v237-guest-spawn-fix';

  const params = new URLSearchParams(location.search);
  const ROOM_ROOT = 'hha-battle/goodjunk/battleV2Rooms';

  const fix = {
    db:null,
    room:'',
    pid:'',
    name:'',
    role:'',
    installed:false,
    started:false,
    spawnFixTimer:null,
    pollTimer:null,
    lastForceAt:0
  };

  function now(){
    return Date.now();
  }

  function safeKey(v){
    return String(v || '')
      .trim()
      .replace(/[.#$/\[\]]/g,'_')
      .slice(0,96) || 'anon';
  }

  function normalizeRoom(v){
    let s = String(v || '').trim().toUpperCase();
    s = s.replace(/\s+/g,'').replace(/[^A-Z0-9-]/g,'');
    if (!s) return '';
    if (!s.startsWith('GJ-BT-')){
      s = 'GJ-BT-' + s
        .replace(/^GJ-BT/i,'')
        .replace(/^GJBT/i,'')
        .replace(/^BT/i,'')
        .replace(/^-/, '');
    }
    return s.slice(0,24);
  }

  function readContext(){
    const s = window.state || window.GJ_STATE || window.BATTLE_STATE || {};

    fix.room = normalizeRoom(
      s.room ||
      s.roomId ||
      params.get('room') ||
      params.get('roomId') ||
      ''
    );

    fix.pid = String(
      s.pid ||
      params.get('pid') ||
      'anon'
    );

    fix.name = String(
      s.name ||
      params.get('name') ||
      params.get('nick') ||
      'Hero'
    );

    fix.role = String(
      s.role ||
      params.get('role') ||
      ''
    );

    return s;
  }

  function roomPath(){
    readContext();
    return `${ROOM_ROOT}/${safeKey(fix.room)}`;
  }

  async function ensureDb(){
    if (fix.db) return fix.db;

    if (window.firebase && firebase.database){
      fix.db = firebase.database();
      return fix.db;
    }

    if (window.HHA_FIREBASE_READY){
      const fb = await window.HHA_FIREBASE_READY;
      if (fb && fb.db){
        fix.db = fb.db;
        return fix.db;
      }
    }

    throw new Error('Firebase database not ready');
  }

  function targetCount(){
    const selectors = [
      '.target',
      '.food',
      '.item',
      '.spawn',
      '.battle-target',
      '[data-target]',
      '[data-food]',
      '[data-kind]'
    ];

    let count = 0;

    selectors.forEach(sel => {
      count += document.querySelectorAll(sel).length;
    });

    return count;
  }

  function hasTargets(){
    return targetCount() > 0;
  }

  function arenaEl(){
    return document.getElementById('arena') ||
      document.getElementById('game') ||
      document.getElementById('stage') ||
      document.querySelector('[data-arena]') ||
      document.querySelector('.arena') ||
      document.querySelector('.game') ||
      document.querySelector('.stage');
  }

  function unlockArena(){
    const arena = arenaEl();

    if (arena){
      arena.style.pointerEvents = 'auto';
      arena.style.touchAction = 'manipulation';
    }

    document.body.style.pointerEvents = 'auto';
    document.body.classList.add('battle-guest-spawn-unlocked');

    const blockers = Array.from(document.querySelectorAll(
      '.countdown,.countdownOverlay,.countdown-modal,.start-countdown,[data-countdown-overlay]'
    ));

    blockers.forEach(el => {
      el.style.display = 'none';
      el.style.visibility = 'hidden';
      el.style.opacity = '0';
      el.style.pointerEvents = 'none';
      el.style.zIndex = '-1';
    });
  }

  function markStarted(room){
    const s = window.state || window.GJ_STATE || window.BATTLE_STATE || null;

    if (s){
      s.gameStarted = true;
      s.waitingForStart = false;
      s.started = true;
      s.running = true;
      s.startedAt = Number(room?.startedAt || now());
    }

    fix.started = true;
    unlockArena();
  }

  function callStartFunctions(room){
    const candidates = [
      'startBattleLocal',
      'startBattleLoop',
      'startGameLoop',
      'startRound',
      'startGame',
      'start'
    ];

    let called = false;

    candidates.forEach(name => {
      if (called) return;
      if (typeof window[name] !== 'function') return;

      try{
        window[name](room || {});
        called = true;
      }catch(err){
        console.warn(`[GJ Guest Spawn Fix] ${name} failed`, err);
      }
    });

    markStarted(room);

    return called;
  }

  function callSpawnFunctions(){
    const candidates = [
      'spawnTarget',
      'spawnFood',
      'spawnItem',
      'spawnOne',
      'spawn',
      'nextTarget',
      'createTarget',
      'createFood'
    ];

    let called = false;

    candidates.forEach(name => {
      if (called) return;
      if (typeof window[name] !== 'function') return;

      try{
        window[name]();
        called = true;
      }catch(err){
        console.warn(`[GJ Guest Spawn Fix] ${name} failed`, err);
      }
    });

    return called;
  }

  function makeEmergencyTarget(){
    const arena = arenaEl();
    if (!arena) return false;

    if (document.querySelector('[data-guest-fallback-target="1"]')) return true;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'target battle-target guest-fallback-target';
    btn.dataset.target = 'good';
    btn.dataset.kind = 'good';
    btn.dataset.guestFallbackTarget = '1';
    btn.textContent = '🍎';

    btn.style.position = 'absolute';
    btn.style.left = '50%';
    btn.style.top = '50%';
    btn.style.transform = 'translate(-50%,-50%)';
    btn.style.width = '76px';
    btn.style.height = '76px';
    btn.style.borderRadius = '24px';
    btn.style.border = '5px solid #69e58e';
    btn.style.background = '#eaffef';
    btn.style.fontSize = '36px';
    btn.style.boxShadow = '0 16px 30px rgba(0,0,0,.16)';
    btn.style.zIndex = '10';
    btn.style.pointerEvents = 'auto';
    btn.style.cursor = 'pointer';

    btn.addEventListener('click', () => {
      btn.remove();

      const s = window.state || window.GJ_STATE || window.BATTLE_STATE || {};
      s.score = Number(s.score || 0) + 20;
      s.good = Number(s.good || 0) + 1;
      s.combo = Number(s.combo || 0) + 1;

      if (typeof window.writeBattleSelf === 'function'){
        window.writeBattleSelf().catch(()=>{});
      }

      setTimeout(() => {
        callSpawnFunctions();
        if (!hasTargets()){
          makeEmergencyTarget();
        }
      }, 250);
    });

    if (getComputedStyle(arena).position === 'static'){
      arena.style.position = 'relative';
    }

    arena.appendChild(btn);
    return true;
  }

  async function writePresence(room){
    try{
      const db = await ensureDb();
      const s = readContext();

      await db.ref(`${roomPath()}/players/${safeKey(fix.pid)}`).update({
        pid:fix.pid,
        name:fix.name,
        role:fix.role || s.role || '',
        view:s.view || params.get('view') || params.get('device') || 'mobile',
        ready:true,
        updatedAt:now(),
        lastSeenAt:now()
      });
    }catch(err){
      console.warn('[GJ Guest Spawn Fix] writePresence failed', err);
    }
  }

  function forceGuestSpawn(room){
    const t = now();

    if (t - fix.lastForceAt < 1800) return;
    fix.lastForceAt = t;

    unlockArena();
    markStarted(room);

    let started = false;

    if (!hasTargets()){
      started = callStartFunctions(room);
    }

    setTimeout(() => {
      if (!hasTargets()){
        callSpawnFunctions();
      }

      setTimeout(() => {
        if (!hasTargets()){
          console.warn('[GJ Guest Spawn Fix] no target after spawn functions, creating emergency target');
          makeEmergencyTarget();
        }
      }, 500);
    }, started ? 600 : 120);

    writePresence(room);
  }

  function shouldFixRoom(room){
    if (!room) return false;

    if (room.finalSummary) return false;
    if (room.status === 'ended' || room.status === 'aborted') return false;

    const status = room.status || '';
    if (status !== 'countdown' && status !== 'started' && status !== 'running'){
      return false;
    }

    return true;
  }

  async function inspectRoom(){
    try{
      readContext();
      if (!fix.room) return;

      const db = await ensureDb();
      const room = await db.ref(roomPath()).get().then(s => s.val()).catch(() => null);

      if (!shouldFixRoom(room)) return;

      const s = window.state || window.GJ_STATE || window.BATTLE_STATE || {};
      const looksStarted =
        s.gameStarted ||
        s.started ||
        s.running ||
        room.status === 'started' ||
        room.status === 'running';

      if (looksStarted && !hasTargets()){
        forceGuestSpawn(room);
        return;
      }

      if (room.status === 'countdown'){
        clearTimeout(fix.spawnFixTimer);
        fix.spawnFixTimer = setTimeout(() => {
          if (!hasTargets()){
            forceGuestSpawn(room);
          }
        }, 3200);
      }

      if (hasTargets()){
        unlockArena();
      }

    }catch(err){
      console.warn('[GJ Guest Spawn Fix] inspectRoom failed', err);
    }
  }

  function attachListener(){
    ensureDb().then(db => {
      readContext();
      if (!fix.room) return;

      db.ref(roomPath()).on('value', snap => {
        const room = snap.val();
        if (!shouldFixRoom(room)) return;

        if (window.state){
          window.state.roomData = room;
        }

        if (room.status === 'started' || room.status === 'running'){
          setTimeout(() => {
            if (!hasTargets()){
              forceGuestSpawn(room);
            }else{
              unlockArena();
            }
          }, 900);
        }

        if (room.status === 'countdown'){
          setTimeout(() => {
            if (!hasTargets()){
              forceGuestSpawn(room);
            }
          }, 3600);
        }
      });
    }).catch(err => {
      console.warn('[GJ Guest Spawn Fix] attachListener failed', err);
    });
  }

  function injectCss(){
    if (document.getElementById('gjGuestSpawnFixCss')) return;

    const style = document.createElement('style');
    style.id = 'gjGuestSpawnFixCss';
    style.textContent = `
      body.battle-guest-spawn-unlocked .countdown,
      body.battle-guest-spawn-unlocked .countdownOverlay,
      body.battle-guest-spawn-unlocked .countdown-modal,
      body.battle-guest-spawn-unlocked .start-countdown,
      body.battle-guest-spawn-unlocked [data-countdown-overlay]{
        display:none !important;
        visibility:hidden !important;
        opacity:0 !important;
        pointer-events:none !important;
        z-index:-1 !important;
      }

      body.battle-guest-spawn-unlocked #arena,
      body.battle-guest-spawn-unlocked #game,
      body.battle-guest-spawn-unlocked #stage,
      body.battle-guest-spawn-unlocked .arena,
      body.battle-guest-spawn-unlocked .game,
      body.battle-guest-spawn-unlocked .stage,
      body.battle-guest-spawn-unlocked [data-arena]{
        pointer-events:auto !important;
        touch-action:manipulation !important;
      }

      .guest-fallback-target{
        animation: gjGuestPulse .85s ease-in-out infinite alternate;
      }

      @keyframes gjGuestPulse{
        from{ transform:translate(-50%,-50%) scale(.96); }
        to{ transform:translate(-50%,-50%) scale(1.05); }
      }
    `;

    document.head.appendChild(style);
  }

  function patchStartFunctions(){
    const names = [
      'startBattleLocal',
      'startBattleLoop',
      'startGameLoop',
      'startRound',
      'startGame',
      'start'
    ];

    names.forEach(name => {
      if (typeof window[name] !== 'function') return;
      if (window[name].__gjGuestSpawnPatched) return;

      const oldFn = window[name];

      const wrapped = function(){
        const out = oldFn.apply(this, arguments);

        setTimeout(() => {
          unlockArena();

          if (!hasTargets()){
            callSpawnFunctions();

            setTimeout(() => {
              if (!hasTargets()){
                makeEmergencyTarget();
              }
            }, 600);
          }
        }, 900);

        return out;
      };

      wrapped.__gjGuestSpawnPatched = true;
      window[name] = wrapped;
    });
  }

  function install(){
    if (fix.installed) return;
    fix.installed = true;

    readContext();
    injectCss();
    patchStartFunctions();
    attachListener();

    fix.pollTimer = setInterval(inspectRoom, 1500);

    setTimeout(inspectRoom, 1000);
    setTimeout(inspectRoom, 3000);
    setTimeout(inspectRoom, 5000);

    window.addEventListener('beforeunload', () => {
      clearInterval(fix.pollTimer);
      clearTimeout(fix.spawnFixTimer);
    });

    console.log('[GJ Guest Spawn Fix] installed', {
      version:window.HHA_GJ_BATTLE_GUEST_SPAWN_FIX,
      room:fix.room,
      pid:fix.pid,
      name:fix.name
    });
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', install);
  }else{
    install();
  }
})();
