(function GoodJunkBattleV2LobbyStatusStabilizerPatch(){
  'use strict';

  const PATCH_VERSION = 'v2.4.44-lobby-status-stabilizer';
  const STABLE_MS = 1200;
  const RENDER_EVERY_MS = 350;

  const state = {
    version: PATCH_VERSION,
    lastWantedKey: '',
    lastAppliedKey: '',
    lastWantedAt: 0,
    lastAppliedAt: 0,
    wanted: null,
    renderTimer: null
  };

  function now(){ return Date.now(); }
  function $(sel, root){ return (root || document).querySelector(sel); }

  function normalizeRoomCode(raw){
    const out = String(raw || '').trim().toUpperCase().replace(/\s+/g, '').replace(/[^A-Z0-9_-]/g, '').slice(0, 32);
    if (!out || /^-+$/.test(out) || /^_+$/.test(out)) return '';
    return out;
  }

  function safeObj(v){ return v && typeof v === 'object' ? v : {}; }
  function safeNum(v, fallback){ const n = Number(v); return Number.isFinite(n) ? n : Number(fallback || 0); }

  function getMyPid(){
    const input = $('#playerId');
    return String((input && input.value) || localStorage.getItem('GJ_BATTLE_PID') || localStorage.getItem('HHA_GJ_PID') || 'anon').trim() || 'anon';
  }

  function getRoomFromLobby(){
    if (window.GJ_BATTLE_LOBBY && window.GJ_BATTLE_LOBBY.state && window.GJ_BATTLE_LOBBY.state.room) return window.GJ_BATTLE_LOBBY.state.room;
    if (window.GJ_BATTLE_LOBBY_HOST_REPAIR && window.GJ_BATTLE_LOBBY_HOST_REPAIR.state) return window.GJ_BATTLE_LOBBY_HOST_REPAIR.state.lastRoom || null;
    return null;
  }

  function normalizePlayer(id, raw){
    raw = safeObj(raw);
    const status = String(raw.status || '').toLowerCase();
    const left = !!(raw.left === true || raw.quit === true || raw.disconnected === true || status === 'left' || status === 'offline');
    const lastSeen = safeNum(raw.lastSeen || raw.heartbeatAt || raw.updatedAt || raw.joinedAt, 0);
    const age = lastSeen ? now() - lastSeen : 0;
    const online = !left && (!lastSeen || age <= 16000);

    return {id:String(id || raw.pid || ''), pid:String(raw.pid || id || ''), name:raw.name || raw.playerName || raw.displayName || id || 'Hero', host:!!raw.host, role:String(raw.role || ''), left, online, lastSeen, raw};
  }

  function normalizeRoom(room){
    room = safeObj(room);
    const playersMap = safeObj(room.players);
    const players = Object.entries(playersMap).map(pair => normalizePlayer(pair[0], pair[1]));
    const online = players.filter(p => p.online);
    const hostPid = String(room.hostPid || '').trim();

    const liveHost = online.find(p => String(p.id) === hostPid || String(p.pid) === hostPid || p.host || p.role === 'host') || null;
    const mePid = getMyPid();
    const me = players.find(p => String(p.id) === mePid || String(p.pid) === mePid) || null;
    const meIsHost = !!(me && (String(me.id) === hostPid || String(me.pid) === hostPid || me.host || me.role === 'host'));

    return {
      raw:room,
      code:normalizeRoomCode(room.code || room.room || room.roomCode || ''),
      phase:String(room.phase || room.status || room.state || 'lobby').toLowerCase(),
      hostPid,
      players,
      online,
      liveHost,
      me,
      meIsHost
    };
  }

  function decideStableStatus(){
    const room = getRoomFromLobby();
    const nr = normalizeRoom(room || {});
    const dbReady = !!(
      window.GJ_BATTLE_DB_READY ||
      (window.GJ_BATTLE_FIREBASE_BRIDGE && typeof window.GJ_BATTLE_FIREBASE_BRIDGE.isReady === 'function' && window.GJ_BATTLE_FIREBASE_BRIDGE.isReady())
    );

    if (!dbReady){
      return {key:'db-wait', cls:'warn', text:'DB กำลังเชื่อมต่อ • รอสักครู่', btnText:'⚠️ DB ยังไม่พร้อม', disabled:true, ready:false};
    }

    if (!nr.code){
      return {key:'ready-no-room', cls:'good', text:'DB พร้อมแล้ว • สร้างห้องหรือเข้าห้องได้', btnText:'⏳ รอผู้เล่นอีก 1 คน', disabled:true, ready:false};
    }

    if (['play','playing','battle','active'].includes(nr.phase)){
      return {key:'play-phase', cls:'good', text:'Battle เริ่มแล้ว • กำลังเข้าเกม', btnText:'⚔️ Battle เริ่มแล้ว', disabled:true, ready:false};
    }

    const onlineCount = nr.online.length;

    if (onlineCount >= 2 && nr.meIsHost){
      return {key:'ready-host-' + nr.hostPid + '-' + onlineCount, cls:'good', text:'พร้อมแล้ว • มีผู้เล่นออนไลน์ ' + onlineCount + ' คน • คุณเป็น Host เริ่ม Battle ได้', btnText:'⚔️ Host เริ่ม Battle', disabled:false, ready:true};
    }

    if (onlineCount >= 2 && !nr.meIsHost){
      const hostName = nr.liveHost ? nr.liveHost.name : 'Host';
      return {key:'ready-wait-host-' + nr.hostPid + '-' + onlineCount, cls:'warn', text:'พร้อมแล้ว • มีผู้เล่นออนไลน์ ' + onlineCount + ' คน • รอ ' + hostName + ' เริ่ม Battle', btnText:'⏳ รอ Host เริ่ม Battle', disabled:true, ready:false};
    }

    if (onlineCount === 1){
      return {key:'need-one-' + (nr.me ? nr.me.id : 'me'), cls:'warn', text:'อยู่ในห้องแล้ว • รอคู่แข่งอีก 1 คน', btnText:'⏳ รอผู้เล่นอีก 1 คน', disabled:true, ready:false};
    }

    return {key:'sync-empty', cls:'warn', text:'กำลัง sync ผู้เล่นในห้อง...', btnText:'⏳ ยังไม่พร้อมเริ่ม', disabled:true, ready:false};
  }

  function requestApply(next){
    if (!next) return;
    const key = next.key + '|' + next.text + '|' + next.btnText;
    if (key !== state.lastWantedKey){
      state.lastWantedKey = key;
      state.lastWantedAt = now();
      state.wanted = next;
      return;
    }
    state.wanted = next;
  }

  function applyWanted(force){
    const wanted = state.wanted || decideStableStatus();
    if (!wanted) return;

    const key = wanted.key + '|' + wanted.text + '|' + wanted.btnText;
    const age = now() - state.lastWantedAt;

    if (!force && key !== state.lastAppliedKey && age < STABLE_MS) return;

    const status = $('#lobbyStatus');
    const btn = $('#btnStartBattle');

    if (status){
      status.className = 'status ' + wanted.cls;
      status.textContent = wanted.text;
      status.setAttribute('data-gj-stable-text', wanted.text);
      status.setAttribute('data-gj-stable-cls', wanted.cls);
    }

    if (btn){
      btn.disabled = !!wanted.disabled;
      btn.textContent = wanted.btnText;
      btn.classList.toggle('is-ready', !!wanted.ready);
      btn.classList.toggle('is-disabled', !!wanted.disabled);
    }

    state.lastAppliedKey = key;
    state.lastAppliedAt = now();
  }

  function startLoop(){
    clearInterval(state.renderTimer);
    state.renderTimer = setInterval(function(){
      requestApply(decideStableStatus());
      applyWanted(false);
    }, RENDER_EVERY_MS);
    requestApply(decideStableStatus());
    applyWanted(true);
  }

  function boot(){
    document.documentElement.dataset.gjLobbyStatusStabilizer = PATCH_VERSION;
    startLoop();

    window.addEventListener('gj:battle-lobby-host-repaired', function(){
      setTimeout(function(){ requestApply(decideStableStatus()); applyWanted(true); }, 120);
    });

    window.addEventListener('gj:battle-db-ready', function(){
      setTimeout(function(){ requestApply(decideStableStatus()); applyWanted(true); }, 120);
    });

    window.GJ_BATTLE_LOBBY_STATUS_STABILIZER = {
      version:PATCH_VERSION,
      state,
      decideStableStatus,
      requestApply,
      applyWanted
    };

    console.info('[GoodJunk Battle Lobby Status Stabilizer]', PATCH_VERSION, 'loaded');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();
