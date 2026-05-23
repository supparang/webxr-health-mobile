(function GoodJunkBattleV2LobbyForceRunAllClientsPatch(){
  'use strict';

  const PATCH_VERSION = 'v2.4.43-lobby-force-run-all-clients';

  const url = new URL(location.href);
  const params = url.searchParams;

  const state = {
    version: PATCH_VERSION,
    redirecting: false,
    lastTarget: '',
    lastRoom: ''
  };

  function $(sel, root){
    return (root || document).querySelector(sel);
  }

  function now(){
    return Date.now();
  }

  function normalizeRoomCode(raw){
    return String(raw || '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '')
      .replace(/[^A-Z0-9_-]/g, '')
      .slice(0, 32);
  }

  function normalizeView(v){
    v = String(v || '').toLowerCase().trim();

    if (v === 'cvr' || v === 'vr' || v === 'cardboard-vr') return 'cardboard';
    if (v === 'cardboard') return 'cardboard';
    if (v === 'mobile' || v === 'phone' || v === 'touch') return 'mobile';
    if (v === 'pc' || v === 'desktop') return 'pc';

    const mobile =
      (window.matchMedia && window.matchMedia('(max-width:760px)').matches) ||
      /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');

    return mobile ? 'mobile' : 'pc';
  }

  function getField(id, fallback){
    const el = $('#' + id);
    return el && el.value ? el.value : fallback;
  }

  function getPid(){
    return String(
      getField('playerId', '') ||
      params.get('pid') ||
      localStorage.getItem('GJ_BATTLE_PID') ||
      localStorage.getItem('HHA_GJ_PID') ||
      'anon'
    ).trim() || 'anon';
  }

  function getName(){
    return String(
      getField('playerName', '') ||
      params.get('name') ||
      localStorage.getItem('GJ_BATTLE_NAME') ||
      localStorage.getItem('HHA_GJ_NAME') ||
      'Hero'
    ).trim() || 'Hero';
  }

  function getView(){
    return normalizeView(
      getField('viewSelect', '') ||
      params.get('view') ||
      params.get('device') ||
      ''
    );
  }

  function getDiff(){
    return String(
      getField('diffSelect', '') ||
      params.get('diff') ||
      'normal'
    );
  }

  function getTime(){
    return String(
      getField('timeSelect', '') ||
      params.get('time') ||
      '90'
    );
  }

  function getActiveRoom(){
    const lobby = window.GJ_BATTLE_LOBBY;
    const text = $('#roomCodeText');

    return normalizeRoomCode(
      params.get('room') ||
      params.get('roomCode') ||
      params.get('code') ||
      params.get('lastRoom') ||
      (lobby && lobby.state && lobby.state.roomCode) ||
      (text && text.textContent && text.textContent.trim() !== '----' ? text.textContent : '') ||
      ''
    );
  }

  function runFileByView(view){
    view = normalizeView(view);

    if (view === 'mobile'){
      return './goodjunk-battle-v2-run-mobile.html';
    }

    if (view === 'cardboard'){
      return './goodjunk-battle-v2-run-cardboard.html';
    }

    return './goodjunk-battle-v2-run-pc.html';
  }

  function buildRunUrl(room, matchId){
    const view = getView();
    const out = new URL(runFileByView(view), location.href);

    params.forEach(function(v, k){
      if (v !== null && v !== ''){
        out.searchParams.set(k, v);
      }
    });

    out.searchParams.set('pid', getPid());
    out.searchParams.set('name', getName());
    out.searchParams.set('view', view);
    out.searchParams.set('device', view);
    out.searchParams.set('diff', getDiff());
    out.searchParams.set('time', getTime());

    out.searchParams.set('mode', 'battle');
    out.searchParams.set('game', 'goodjunk');
    out.searchParams.set('gameId', 'goodjunk');
    out.searchParams.set('entry', 'battle');
    out.searchParams.set('variant', 'battle-v2');
    out.searchParams.set('zone', params.get('zone') || 'nutrition');
    out.searchParams.set('cat', params.get('cat') || 'nutrition');
    out.searchParams.set('theme', params.get('theme') || 'goodjunk');
    out.searchParams.set('run', 'play');
    out.searchParams.set('phase', 'play');

    out.searchParams.set('room', room);
    out.searchParams.set('roomCode', room);

    if (matchId){
      out.searchParams.set('matchId', matchId);
      out.searchParams.set('roundId', matchId);
      out.searchParams.set('runId', matchId);
    }

    if (!out.searchParams.get('hub')){
      out.searchParams.set(
        'hub',
        new URL('../nutrition-zone.html', location.href).toString()
      );
    }

    out.searchParams.set('forceRunAllClients', PATCH_VERSION);
    out.searchParams.set('t', String(now()));

    return out.toString();
  }

  function showGoingOverlay(){
    document.documentElement.classList.add('gj-start-redirecting');

    let box = $('#gjForceRunAllClientsBox');

    if (!box){
      box = document.createElement('div');
      box.id = 'gjForceRunAllClientsBox';
      box.style.cssText = [
        'position:fixed',
        'left:50%',
        'top:50%',
        'transform:translate(-50%,-50%)',
        'z-index:100030',
        'width:min(92vw,430px)',
        'padding:18px 20px',
        'border-radius:28px',
        'border:4px solid rgba(255,199,125,.95)',
        'background:rgba(255,254,248,.98)',
        'color:#753119',
        'font:1000 20px system-ui,sans-serif',
        'text-align:center',
        'box-shadow:0 22px 50px rgba(70,34,10,.24)'
      ].join(';');
      document.body.appendChild(box);
    }

    box.textContent = '⚔️ Battle เริ่มแล้ว กำลังเข้าเกม...';
  }

  function getRoomRef(room){
    const bridge = window.GJ_BATTLE_FIREBASE_BRIDGE;

    if (bridge && typeof bridge.getRoomRef === 'function'){
      return bridge.getRoomRef(room);
    }

    const db = window.GJ_DB || window.GJ_BATTLE_DB || null;

    if (db && typeof db.ref === 'function'){
      return db.ref('herohealth/goodjunk/battleV2Rooms/' + room);
    }

    return null;
  }

  function forceGo(room, matchId, reason){
    if (state.redirecting) return false;

    const target = buildRunUrl(room, matchId);
    state.redirecting = true;
    state.lastTarget = target;

    try{
      const pid = getPid();
      sessionStorage.removeItem('GJ_BATTLE_REDIRECT_' + room + '_' + matchId + '_' + pid);
      sessionStorage.removeItem('GJ_BATTLE_REDIRECT_' + room + '_no-match_' + pid);
    }catch(_){}

    showGoingOverlay();

    console.info('[GJ Battle Force Run All Clients]', {
      reason,
      target
    });

    setTimeout(function(){
      location.replace(target);
    }, 220);

    return true;
  }

  function isPlayPhase(room){
    const phase = String(room.phase || room.status || room.state || '').toLowerCase();
    return ['play','playing','running','battle','active'].includes(phase);
  }

  function attachWatcher(){
    const room = getActiveRoom();
    if (!room) return false;
    if (state.lastRoom === room) return true;

    const ref = getRoomRef(room);
    if (!ref || typeof ref.on !== 'function') return false;

    state.lastRoom = room;

    ref.on('value', function(snapshot){
      const data = snapshot && typeof snapshot.val === 'function'
        ? snapshot.val() || {}
        : {};

      if (!data || !Object.keys(data).length) return;

      const matchId =
        data.matchId ||
        data.roundId ||
        data.runId ||
        data.activeMatchId ||
        '';

      if (isPlayPhase(data)){
        forceGo(room, matchId, 'room-listener-play');
      }
    });

    return true;
  }

  function patchLobbyCheck(){
    const lobby = window.GJ_BATTLE_LOBBY;
    if (!lobby || lobby.__forceRunAllClientsPatched) return;

    lobby.__forceRunAllClientsPatched = true;

    if (typeof lobby.checkRoomForStart === 'function'){
      const original = lobby.checkRoomForStart;

      lobby.checkRoomForStart = function(room, source){
        const data = room || {};
        const activeRoom = normalizeRoomCode(
          data.code ||
          data.room ||
          data.roomCode ||
          getActiveRoom()
        );

        const matchId =
          data.matchId ||
          data.roundId ||
          data.runId ||
          data.activeMatchId ||
          '';

        if (activeRoom && isPlayPhase(data)){
          return forceGo(activeRoom, matchId, source || 'patched-checkRoomForStart');
        }

        return original.apply(lobby, arguments);
      };
    }
  }

  function boot(){
    patchLobbyCheck();
    attachWatcher();

    setInterval(function(){
      patchLobbyCheck();
      attachWatcher();
    }, 500);

    window.GJ_BATTLE_LOBBY_FORCE_RUN_ALL_CLIENTS = {
      version: PATCH_VERSION,
      state,
      buildRunUrl,
      forceGo,
      attachWatcher
    };

    console.info('[GoodJunk Battle Force Run All Clients]', PATCH_VERSION, 'loaded');
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }
})();
