/*
  HeroHealth • GoodJunk Battle Lobby State Guard Patch
  v20260515-battle-lobby-v2211-no-auto-reenter-ended-match

  Purpose:
  - Prevent Lobby from auto-entering old/ended Battle matches
  - Prevent redirect to run when room has finalSummary or status ended
  - Clear stale countdown/started state when the match is already ended
  - Keep Battle 1v1 room stable after summary/rematch/return lobby
*/

(function(){
  'use strict';

  window.HHA_GJ_BATTLE_LOBBY_STATE_GUARD =
    'v20260515-battle-lobby-v2211-no-auto-reenter-ended-match';

  const params = new URLSearchParams(location.search);
  const ROOM_ROOT = 'hha-battle/goodjunk/battleV2Rooms';

  const guard = {
    db:null,
    room:'',
    pid:'',
    name:'',
    view:'',
    installed:false,
    redirectLocked:false,
    pollTimer:null,
    toastTimer:null
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
    return s.slice(0,15);
  }

  function readContext(){
    const state = window.state || window.GJ_STATE || window.BATTLE_STATE || {};

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

    guard.room = normalizeRoom(
      state.room ||
      state.roomId ||
      params.get('room') ||
      params.get('roomId') ||
      roomInput?.value ||
      localStorage.getItem('GJ_BT_ROOM') ||
      ''
    );

    guard.pid = String(
      state.pid ||
      params.get('pid') ||
      pidInput?.value ||
      'anon'
    );

    guard.name = String(
      state.name ||
      params.get('name') ||
      params.get('nick') ||
      nameInput?.value ||
      'Hero'
    );

    guard.view = String(
      state.view ||
      params.get('view') ||
      params.get('device') ||
      viewInput?.value ||
      'mobile'
    );

    return state;
  }

  function roomPath(room){
    const r = normalizeRoom(room || guard.room);
    return `${ROOM_ROOT}/${safeKey(r)}`;
  }

  async function ensureDb(){
    if (guard.db) return guard.db;

    if (window.firebase && firebase.database){
      guard.db = firebase.database();
      return guard.db;
    }

    if (window.HHA_FIREBASE_READY){
      const fb = await window.HHA_FIREBASE_READY;
      if (fb && fb.db){
        guard.db = fb.db;
        return guard.db;
      }
    }

    throw new Error('Firebase database not ready');
  }

  function showGuardToast(text, ms=1800){
    let el =
      document.getElementById('toast') ||
      document.querySelector('.toast');

    if (!el){
      console.log('[GJ Battle Lobby Guard]', text);
      return;
    }

    el.textContent = text;
    el.classList.add('show');
    el.style.display = '';

    clearTimeout(guard.toastTimer);
    guard.toastTimer = setTimeout(() => {
      el.classList.remove('show');
    }, ms);
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

  function isMeInRoom(room){
    readContext();
    return !!room?.players?.[safeKey(guard.pid)] ||
      playersArray(room).some(p => p.pid === guard.pid);
  }

  function isEndedRoom(room){
    return !!room?.finalSummary ||
      room?.status === 'ended' ||
      room?.status === 'aborted';
  }

  function isStaleStartedRoom(room){
    if (!room) return false;
    if (isEndedRoom(room)) return true;

    const status = room.status || 'lobby';

    if (status !== 'countdown' && status !== 'started') return false;

    const updatedAt = Number(room.updatedAt || room.startedAt || room.countdownAt || 0);
    if (!updatedAt) return false;

    // ถ้า countdown/started ค้างนานเกิน 12 นาที ให้ถือว่า stale
    return now() - updatedAt > 12 * 60 * 1000;
  }

  function setStartButtonForEnded(){
    const btn =
      document.getElementById('btnStart') ||
      document.querySelector('[data-start-battle]');

    if (!btn) return;

    btn.disabled = true;
    btn.textContent = 'จบแล้ว • สร้างห้องใหม่';
    btn.classList.add('disabled');
  }

  function setRoomSubtitle(text){
    const el =
      document.getElementById('roomSub') ||
      document.querySelector('[data-room-sub]') ||
      document.querySelector('.roomSub');

    if (el) el.textContent = text;
  }

  function blockOldRedirectFunctions(){
    /*
      สำคัญ:
      เราไม่รู้ชื่อ function redirect ของไฟล์หลักทั้งหมด
      จึงกันผ่าน wrapper ของ location.assign/replace เฉพาะเคสไป battle run จาก ended/finalSummary
    */
    if (window.__GJ_BT_LOCATION_GUARD_INSTALLED__) return;
    window.__GJ_BT_LOCATION_GUARD_INSTALLED__ = true;

    const rawAssign = window.location.assign.bind(window.location);
    const rawReplace = window.location.replace.bind(window.location);

    function shouldBlockUrl(url){
      try{
        const u = new URL(url, location.href);
        const path = u.pathname || '';

        if (!/goodjunk-vr-battle\.html|goodjunk-battle-run\.html/i.test(path)){
          return false;
        }

        return guard.redirectLocked;
      }catch(_){
        return false;
      }
    }

    try{
      window.location.assign = function(url){
        if (shouldBlockUrl(url)){
          console.warn('[GJ Battle Lobby Guard] blocked stale redirect:', url);
          showGuardToast('ห้องนี้จบแล้ว ไม่เข้าเกมเก่าอัตโนมัติ');
          return;
        }
        return rawAssign(url);
      };
    }catch(_){}

    try{
      window.location.replace = function(url){
        if (shouldBlockUrl(url)){
          console.warn('[GJ Battle Lobby Guard] blocked stale replace:', url);
          showGuardToast('ห้องนี้จบแล้ว ไม่เข้าเกมเก่าอัตโนมัติ');
          return;
        }
        return rawReplace(url);
      };
    }catch(_){}
  }

  async function repairEndedRoomIfNeeded(room){
    if (!room || !guard.room) return;

    if (!isEndedRoom(room) && !isStaleStartedRoom(room)) return;

    guard.redirectLocked = true;

    setStartButtonForEnded();

    const activeSummary = !!room.finalSummary;
    const statusText = activeSummary
      ? 'สถานะ: ended • มีผลสรุปแล้ว • ไม่เข้าเกมเก่าอัตโนมัติ'
      : 'สถานะ: ended/stale • ต้องสร้างห้องใหม่';

    setRoomSubtitle(statusText);

    try{
      const db = await ensureDb();

      // เคลียร์เฉพาะสถานะที่จะลากเข้า run เอง ห้ามลบ players
      const patch = {
        updatedAt: now()
      };

      if (room.status === 'countdown' || room.status === 'started'){
        patch.status = room.finalSummary ? 'ended' : 'lobby';
      }

      if (room.finalSummary || room.status === 'ended'){
        patch.activeMatchId = '';
      }

      await db.ref(roomPath()).update(patch);

    }catch(err){
      console.warn('[GJ Battle Lobby Guard] repairEndedRoomIfNeeded failed', err);
    }
  }

  async function inspectRoomOnce(){
    try{
      readContext();
      if (!guard.room) return;

      const db = await ensureDb();
      const room = await db.ref(roomPath()).get().then(s => s.val()).catch(() => null);

      if (!room) return;

      if (isEndedRoom(room) || isStaleStartedRoom(room)){
        await repairEndedRoomIfNeeded(room);
        return;
      }

      // ถ้าเป็นห้องใหม่ปกติให้ปลด redirect lock
      guard.redirectLocked = false;

    }catch(err){
      console.warn('[GJ Battle Lobby Guard] inspectRoomOnce failed', err);
    }
  }

  async function attachRoomGuard(){
    try{
      readContext();
      if (!guard.room) return;

      const db = await ensureDb();

      db.ref(roomPath()).on('value', snap => {
        const room = snap.val();
        if (!room) return;

        if (isEndedRoom(room) || isStaleStartedRoom(room)){
          repairEndedRoomIfNeeded(room);
        }else{
          guard.redirectLocked = false;
        }
      });

    }catch(err){
      console.warn('[GJ Battle Lobby Guard] attachRoomGuard failed', err);
    }
  }

  function addCreateNewRoomHint(){
    const note =
      document.querySelector('.note') ||
      document.querySelector('[data-note]');

    if (!note) return;

    if (document.getElementById('battleStateGuardHint')) return;

    const div = document.createElement('div');
    div.id = 'battleStateGuardHint';
    div.style.marginTop = '8px';
    div.style.fontWeight = '1000';
    div.style.color = '#8a4a00';
    div.textContent = 'ถ้าห้องเก่าจบแล้ว ให้กด “สร้างห้อง Battle” เพื่อเริ่ม match ใหม่';

    note.appendChild(div);
  }

  function install(){
    if (guard.installed) return;
    guard.installed = true;

    readContext();
    blockOldRedirectFunctions();
    addCreateNewRoomHint();

    inspectRoomOnce();
    attachRoomGuard();

    clearInterval(guard.pollTimer);
    guard.pollTimer = setInterval(inspectRoomOnce, 3500);

    console.log('[GJ Battle Lobby Guard] installed', {
      version: window.HHA_GJ_BATTLE_LOBBY_STATE_GUARD,
      room: guard.room,
      pid: guard.pid
    });
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', install);
  }else{
    install();
  }
})();
