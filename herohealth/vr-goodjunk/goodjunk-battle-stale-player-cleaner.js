/*
  HeroHealth • GoodJunk Battle Stale Player Cleaner
  v20260515-battle-v238-stale-player-cleaner

  Fixes:
  - ห้อง Battle เดิมมีผู้เล่นค้าง
  - Hero เข้าเล่นต่อจากห้องเก่าเอง
  - ผู้เล่นเก่าที่ปิดหน้าไปแล้วยังนับเป็น 2/2
  - Guest/Host stale ทำให้ start/rematch ผิด
*/

(function(){
  'use strict';

  window.HHA_GJ_BATTLE_STALE_PLAYER_CLEANER =
    'v20260515-battle-v238-stale-player-cleaner';

  const params = new URLSearchParams(location.search);
  const ROOM_ROOT = 'hha-battle/goodjunk/battleV2Rooms';

  const STALE_MS = 45000;
  const HARD_STALE_MS = 2 * 60 * 1000;

  const cleaner = {
    db:null,
    room:'',
    pid:'',
    name:'',
    role:'',
    view:'',
    installed:false,
    heartbeatTimer:null,
    cleanTimer:null,
    listenerAttached:false
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

    const roomInput =
      document.getElementById('roomCode') ||
      document.querySelector('[name="room"]') ||
      document.querySelector('[data-room-code]');

    const pidInput =
      document.getElementById('pid') ||
      document.querySelector('[name="pid"]');

    const nameInput =
      document.getElementById('name') ||
      document.querySelector('[name="name"]');

    const viewInput =
      document.getElementById('view') ||
      document.querySelector('[name="view"]');

    cleaner.room = normalizeRoom(
      s.room ||
      s.roomId ||
      params.get('room') ||
      params.get('roomId') ||
      roomInput?.value ||
      localStorage.getItem('GJ_BT_ROOM') ||
      ''
    );

    cleaner.pid = String(
      s.pid ||
      params.get('pid') ||
      pidInput?.value ||
      'anon'
    );

    cleaner.name = String(
      s.name ||
      params.get('name') ||
      params.get('nick') ||
      nameInput?.value ||
      'Hero'
    );

    cleaner.role = String(
      s.role ||
      params.get('role') ||
      ''
    );

    cleaner.view = String(
      s.view ||
      params.get('view') ||
      params.get('device') ||
      viewInput?.value ||
      'mobile'
    );

    return s;
  }

  function roomPath(){
    readContext();
    return `${ROOM_ROOT}/${safeKey(cleaner.room)}`;
  }

  async function ensureDb(){
    if (cleaner.db) return cleaner.db;

    if (window.firebase && firebase.database){
      cleaner.db = firebase.database();
      return cleaner.db;
    }

    if (window.HHA_FIREBASE_READY){
      const fb = await window.HHA_FIREBASE_READY;
      if (fb && fb.db){
        cleaner.db = fb.db;
        return cleaner.db;
      }
    }

    throw new Error('Firebase database not ready');
  }

  function playersArray(room){
    return Object.values(room?.players || {})
      .filter(Boolean)
      .sort((a,b) => {
        const ar = a.role === 'host' ? 0 : 1;
        const br = b.role === 'host' ? 0 : 1;
        if (ar !== br) return ar - br;
        return Number(a.joinedAt || 0) - Number(b.joinedAt || 0);
      });
  }

  function isStalePlayer(p, ms=STALE_MS){
    const last = Number(p?.lastSeenAt || p?.updatedAt || 0);
    if (!last) return true;
    return now() - last > ms;
  }

  function activePlayers(room){
    return playersArray(room).filter(p => !isStalePlayer(p, STALE_MS));
  }

  function meKey(){
    readContext();
    return safeKey(cleaner.pid);
  }

  async function heartbeat(){
    try{
      readContext();
      if (!cleaner.room || !cleaner.pid) return;

      const db = await ensureDb();

      const ref = db.ref(`${roomPath()}/players/${meKey()}`);

      await ref.update({
        pid:cleaner.pid,
        name:cleaner.name,
        role:cleaner.role || '',
        view:cleaner.view,
        ready:true,
        updatedAt:now(),
        lastSeenAt:now()
      });

      // เมื่อปิดหน้า ให้ mark offline ไม่ปล่อยค้าง
      try{
        ref.onDisconnect().update({
          ready:false,
          offline:true,
          updatedAt:now(),
          lastSeenAt:now()
        });
      }catch(_){}

    }catch(err){
      console.warn('[GJ Battle Stale Cleaner] heartbeat failed', err);
    }
  }

  async function cleanStalePlayers(room){
    try{
      if (!room || !cleaner.room) return;

      const db = await ensureDb();

      const status = room.status || 'lobby';
      const updates = {};
      let changed = false;

      const players = playersArray(room);
      const active = activePlayers(room);

      players.forEach(p => {
        const key = safeKey(p.pid);

        // คนที่ stale มาก ๆ ให้ลบออกจาก lobby/countdown เท่านั้น
        // ถ้าเกมกำลัง started อยู่ อย่าลบทันที แค่ mark offline
        if (isStalePlayer(p, HARD_STALE_MS)){
          if (status === 'lobby' || status === 'countdown' || status === 'ended' || status === 'aborted'){
            updates[`players/${key}`] = null;
          }else{
            updates[`players/${key}/offline`] = true;
            updates[`players/${key}/ready`] = false;
            updates[`players/${key}/updatedAt`] = now();
          }
          changed = true;
        }else if (isStalePlayer(p, STALE_MS)){
          updates[`players/${key}/offline`] = true;
          updates[`players/${key}/ready`] = false;
          changed = true;
        }
      });

      // ถ้าห้องอยู่ countdown/started แต่ active เหลือน้อยกว่า 2 ให้หยุด auto-run
      if ((status === 'countdown' || status === 'started') && active.length < 2){
        updates.status = 'lobby';
        updates.activeMatchId = '';
        updates.startedAt = null;
        updates.countdownAt = null;
        updates.updatedAt = now();
        changed = true;
      }

      // ถ้า finalSummary มีแล้ว ห้ามมี activeMatchId ลากเข้า run
      if (room.finalSummary || status === 'ended'){
        updates.activeMatchId = '';
        updates.updatedAt = now();
        changed = true;
      }

      if (changed){
        await db.ref(roomPath()).update(updates);
        console.log('[GJ Battle Stale Cleaner] cleaned room', {
          room:cleaner.room,
          status,
          players:players.length,
          active:active.length,
          updates
        });
      }

      updateLocalUi(room, active);

    }catch(err){
      console.warn('[GJ Battle Stale Cleaner] cleanStalePlayers failed', err);
    }
  }

  function updateLocalUi(room, active){
    const status = room?.status || 'lobby';

    const badge =
      document.getElementById('roomBadge') ||
      document.querySelector('[data-room-badge]');

    if (badge){
      badge.textContent = `${active.length}/2`;
    }

    const sub =
      document.getElementById('roomSub') ||
      document.querySelector('[data-room-sub]') ||
      document.querySelector('.roomSub');

    if (sub && /battle-lobby/i.test(location.pathname)){
      sub.textContent =
        `สถานะ: ${status} • Battle 1v1 • ออนไลน์ ${active.length}/2 • stale จะถูกล้างอัตโนมัติ`;
    }

    const btnStart =
      document.getElementById('btnStart') ||
      document.querySelector('[data-start-battle]');

    if (btnStart && /battle-lobby/i.test(location.pathname)){
      if (active.length < 2){
        btnStart.disabled = true;
        btnStart.textContent = `⏳ ต้องมีผู้เล่นออนไลน์ 2 คน (${active.length}/2)`;
      }
    }
  }

  async function inspectOnce(){
    try{
      readContext();
      if (!cleaner.room) return;

      const db = await ensureDb();
      const room = await db.ref(roomPath()).get().then(s => s.val()).catch(() => null);
      if (!room) return;

      await cleanStalePlayers(room);

    }catch(err){
      console.warn('[GJ Battle Stale Cleaner] inspectOnce failed', err);
    }
  }

  async function attachListener(){
    if (cleaner.listenerAttached) return;
    cleaner.listenerAttached = true;

    try{
      readContext();
      if (!cleaner.room) return;

      const db = await ensureDb();

      db.ref(roomPath()).on('value', snap => {
        const room = snap.val();
        if (!room) return;

        cleanStalePlayers(room);
      });

    }catch(err){
      console.warn('[GJ Battle Stale Cleaner] attachListener failed', err);
    }
  }

  function patchStartButton(){
    const btn =
      document.getElementById('btnStart') ||
      document.querySelector('[data-start-battle]');

    if (!btn || btn.__gjStaleCleanerPatched) return;
    btn.__gjStaleCleanerPatched = true;

    btn.addEventListener('click', async ev => {
      try{
        const db = await ensureDb();
        const room = await db.ref(roomPath()).get().then(s => s.val()).catch(() => null);
        if (!room) return;

        const active = activePlayers(room);

        if (active.length !== 2){
          ev.preventDefault();
          ev.stopImmediatePropagation();

          alert(`Battle ต้องมีผู้เล่นออนไลน์ 2 คน ตอนนี้ออนไลน์ ${active.length}/2`);

          await cleanStalePlayers(room);
          return false;
        }

      }catch(err){
        console.warn('[GJ Battle Stale Cleaner] start guard failed', err);
      }
    }, true);
  }

  function patchJoinButton(){
    const btn =
      document.getElementById('btnJoin') ||
      document.querySelector('[data-join-battle]');

    if (!btn || btn.__gjStaleJoinPatched) return;
    btn.__gjStaleJoinPatched = true;

    btn.addEventListener('click', async () => {
      setTimeout(inspectOnce, 600);
      setTimeout(inspectOnce, 1800);
    }, true);
  }

  function patchCreateButton(){
    const btn =
      document.getElementById('btnCreate') ||
      document.querySelector('[data-create-battle]');

    if (!btn || btn.__gjStaleCreatePatched) return;
    btn.__gjStaleCreatePatched = true;

    btn.addEventListener('click', async () => {
      setTimeout(inspectOnce, 600);
      setTimeout(inspectOnce, 1800);
    }, true);
  }

  function injectCss(){
    if (document.getElementById('gjBattleStaleCleanerCss')) return;

    const style = document.createElement('style');
    style.id = 'gjBattleStaleCleanerCss';
    style.textContent = `
      .player.offline,
      .player[data-offline="1"]{
        opacity:.45 !important;
        filter:grayscale(.45);
      }
    `;
    document.head.appendChild(style);
  }

  function install(){
    if (cleaner.installed) return;
    cleaner.installed = true;

    readContext();
    injectCss();

    heartbeat();
    clearInterval(cleaner.heartbeatTimer);
    cleaner.heartbeatTimer = setInterval(heartbeat, 5000);

    attachListener();
    inspectOnce();

    clearInterval(cleaner.cleanTimer);
    cleaner.cleanTimer = setInterval(inspectOnce, 7000);

    patchStartButton();
    patchJoinButton();
    patchCreateButton();

    setTimeout(patchStartButton, 1000);
    setTimeout(patchJoinButton, 1000);
    setTimeout(patchCreateButton, 1000);

    window.addEventListener('beforeunload', () => {
      try{
        clearInterval(cleaner.heartbeatTimer);
        clearInterval(cleaner.cleanTimer);

        if (cleaner.db && cleaner.room && cleaner.pid){
          cleaner.db.ref(`${roomPath()}/players/${meKey()}`).update({
            ready:false,
            offline:true,
            updatedAt:now(),
            lastSeenAt:now()
          });
        }
      }catch(_){}
    });

    console.log('[GJ Battle Stale Cleaner] installed', {
      version:window.HHA_GJ_BATTLE_STALE_PLAYER_CLEANER,
      room:cleaner.room,
      pid:cleaner.pid,
      name:cleaner.name
    });
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', install);
  }else{
    install();
  }
})();
