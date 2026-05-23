(function GoodJunkBattleV2LobbyStartWatchdogPatch(){
  'use strict';

  const PATCH_VERSION = 'v2.4.39-lobby-start-watchdog-force-run';

  const url = new URL(location.href);
  const params = url.searchParams;

  const state = {
    starting:false,
    startedAt:0,
    target:'',
    timer:null
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
      'pc'
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

  function getRoom(){
    const input = $('#roomCodeInput');
    const text = $('#roomCodeText');

    return normalizeRoomCode(
      (window.GJ_BATTLE_LOBBY &&
       window.GJ_BATTLE_LOBBY.state &&
       window.GJ_BATTLE_LOBBY.state.roomCode) ||
      (input && input.value) ||
      (text && text.textContent) ||
      params.get('room') ||
      params.get('roomCode') ||
      params.get('code') ||
      params.get('lastRoom') ||
      localStorage.getItem('GJ_BATTLE_LAST_ROOM') ||
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

  function buildRunUrl(matchId){
    const view = getView();
    const out = new URL(runFileByView(view), location.href);
    const room = getRoom();

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

    if (room){
      out.searchParams.set('room', room);
      out.searchParams.set('roomCode', room);
    }

    const mid =
      matchId ||
      params.get('matchId') ||
      params.get('roundId') ||
      ('m_' + now());

    out.searchParams.set('matchId', mid);
    out.searchParams.set('roundId', mid);

    if (!out.searchParams.get('hub')){
      out.searchParams.set(
        'hub',
        new URL('../nutrition-zone.html', location.href).toString()
      );
    }

    out.searchParams.set('startWatchdog', PATCH_VERSION);
    out.searchParams.set('t', String(now()));

    return out.toString();
  }

  function showOverlay(){
    document.documentElement.classList.add('gj-start-redirecting');

    let box = $('#gjStartWatchdogBox');

    if (!box){
      box = document.createElement('div');
      box.id = 'gjStartWatchdogBox';
      box.style.cssText = [
        'position:fixed',
        'left:50%',
        'top:50%',
        'transform:translate(-50%,-50%)',
        'z-index:100020',
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

  function forceGo(matchId, reason){
    const target = buildRunUrl(matchId);

    state.target = target;

    try{
      sessionStorage.removeItem('GJ_BATTLE_REDIRECT_' + getRoom() + '_no-match_' + getPid());
    }catch(_){}

    console.info('[GJ Battle Start Watchdog] forceGo', {
      reason,
      target
    });

    location.href = target;
  }

  function getBridgeRoomRef(){
    const room = getRoom();

    if (!room) return null;

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

  function watchRoomForPlay(){
    const ref = getBridgeRoomRef();

    if (!ref || typeof ref.on !== 'function'){
      return false;
    }

    ref.on('value', function(snapshot){
      if (!state.starting) return;

      const room = snapshot && typeof snapshot.val === 'function'
        ? snapshot.val() || {}
        : {};

      const phase = String(room.phase || room.status || room.state || '').toLowerCase();
      const matchId = room.matchId || room.roundId || room.runId || room.activeMatchId || '';

      if (
        phase === 'play' ||
        phase === 'playing' ||
        phase === 'battle' ||
        phase === 'active'
      ){
        forceGo(matchId, 'room-phase-play');
      }
    });

    return true;
  }

  async function writePlayFallback(){
    const ref = getBridgeRoomRef();
    if (!ref || typeof ref.update !== 'function') return false;

    const matchId = 'm_' + now() + '_' + Math.random().toString(16).slice(2, 8);

    try{
      await ref.update({
        phase:'play',
        status:'play',
        state:'play',
        matchId:matchId,
        roundId:matchId,
        runId:matchId,
        activeMatchId:matchId,
        startedAt:now(),
        updatedAt:now(),
        startWatchdogVersion:PATCH_VERSION
      });

      const pid = getPid();

      if (typeof ref.child === 'function' && pid){
        await ref.child('players').child(pid).update({
          status:'in-game',
          phase:'play',
          currentPage:'run',
          matchId:matchId,
          roundId:matchId,
          left:false,
          quit:false,
          disconnected:false,
          updatedAt:now()
        });
      }

      forceGo(matchId, 'fallback-write-play');
      return true;
    }catch(err){
      console.warn('[GJ Battle Start Watchdog] writePlayFallback failed', err);
      return false;
    }
  }

  function startWatchdog(){
    if (state.starting) return;

    state.starting = true;
    state.startedAt = now();

    showOverlay();
    watchRoomForPlay();

    clearTimeout(state.timer);

    /*
     * ถ้า logic เดิมไม่ redirect ภายใน 1.6 วิ ให้พาเข้า run เอง
     */
    state.timer = setTimeout(async function(){
      if (!state.starting) return;

      const wrote = await writePlayFallback();

      if (!wrote){
        forceGo('', 'timeout-direct-run');
      }
    }, 1600);
  }

  function patchStartButton(){
    const btn = $('#btnStartBattle');

    if (!btn || btn.dataset.gjStartWatchdogBound === '1') return;

    btn.dataset.gjStartWatchdogBound = '1';

    btn.addEventListener('click', function(){
      startWatchdog();
    }, true);
  }

  function patchLobbyStartBattle(){
    const lobby = window.GJ_BATTLE_LOBBY;

    if (!lobby || lobby.__startWatchdogPatched) return;

    if (typeof lobby.startBattle !== 'function') return;

    lobby.__startWatchdogPatched = true;

    const original = lobby.startBattle;

    lobby.startBattle = async function(){
      startWatchdog();

      try{
        return await original.apply(lobby, arguments);
      }catch(err){
        console.warn('[GJ Battle Start Watchdog] original startBattle failed', err);
        await writePlayFallback();
        return false;
      }
    };
  }

  function boot(){
    patchStartButton();
    patchLobbyStartBattle();

    setInterval(function(){
      patchStartButton();
      patchLobbyStartBattle();
    }, 500);

    window.GJ_BATTLE_LOBBY_START_WATCHDOG = {
      version: PATCH_VERSION,
      state,
      startWatchdog,
      forceGo,
      buildRunUrl,
      writePlayFallback
    };

    console.info('[GoodJunk Battle Lobby Start Watchdog]', PATCH_VERSION, 'loaded');
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }
})();
