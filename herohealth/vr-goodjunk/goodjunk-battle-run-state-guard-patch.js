/*
  HeroHealth • GoodJunk Battle Run State Guard Patch
  v20260515-battle-run-v234-countdown-ended-state-guard

  Purpose:
  - Prevent stale countdown overlay from staying forever
  - If room is ended/finalSummary, hide countdown and show final summary
  - If countdown is stuck > 4.5s, force local start
  - Stop old ended match from looking like a new game
*/

(function(){
  'use strict';

  window.HHA_GJ_BATTLE_RUN_STATE_GUARD =
    'v20260515-battle-run-v234-countdown-ended-state-guard';

  const params = new URLSearchParams(location.search);
  const ROOM_ROOT = 'hha-battle/goodjunk/battleV2Rooms';

  const guard = {
    db:null,
    room:'',
    pid:'',
    name:'',
    matchId:'',
    installed:false,
    countdownWatchTimer:null,
    roomListenerAttached:false,
    forcedStart:false,
    endedHandled:false
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

    guard.room = normalizeRoom(
      state.room ||
      state.roomId ||
      params.get('room') ||
      params.get('roomId') ||
      ''
    );

    guard.pid = String(
      state.pid ||
      params.get('pid') ||
      'anon'
    );

    guard.name = String(
      state.name ||
      params.get('name') ||
      params.get('nick') ||
      'Hero'
    );

    guard.matchId = String(
      state.matchId ||
      params.get('matchId') ||
      ''
    );

    return state;
  }

  function roomPath(){
    readContext();
    return `${ROOM_ROOT}/${safeKey(guard.room)}`;
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

  function countdownEl(){
    return document.getElementById('countdown') ||
      document.getElementById('countdownOverlay') ||
      document.querySelector('[data-countdown-overlay]') ||
      document.querySelector('.countdown') ||
      document.querySelector('.countdownOverlay');
  }

  function hideCountdown(){
    const el = countdownEl();
    if (!el) return;

    el.classList.remove('show');
    el.classList.remove('active');
    el.setAttribute('aria-hidden','true');
    el.style.display = 'none';
    el.style.pointerEvents = 'none';
  }

  function showOverlay(){
    const overlay =
      document.getElementById('summaryOverlay') ||
      document.getElementById('resultOverlay') ||
      document.getElementById('overlay') ||
      document.querySelector('[data-summary-overlay]') ||
      document.querySelector('.overlay');

    if (overlay){
      overlay.classList.add('show');
      overlay.style.display = overlay.style.display === 'none' ? 'flex' : overlay.style.display;
    }
  }

  function setText(selectors, text){
    for (const sel of selectors){
      let el = null;

      if (sel.startsWith('#')){
        el = document.getElementById(sel.slice(1));
      }else{
        el = document.querySelector(sel);
      }

      if (el){
        el.textContent = text;
        return true;
      }
    }

    return false;
  }

  function heartText(hp){
    const n = Math.max(0, Math.min(100, Number(hp || 0)));
    const full = Math.ceil(n / 20);
    return '❤️'.repeat(full) + '♡'.repeat(Math.max(0,5-full));
  }

  function safePlayerName(p, fallback='Player'){
    const n = String(p?.name || p?.nick || p?.displayName || '').trim();

    if (!n) return fallback;
    if (/^(sfx|sound|audio|เสียง)$/i.test(n)) return fallback;
    if (/🔊/.test(n)) return fallback;

    return n;
  }

  function renderSummaryFallback(summary){
    if (!summary) return;

    readContext();

    const myPid = guard.pid;
    const players = summary.players || {};
    const me = players[safeKey(myPid)] || Object.values(players).find(p => p.pid === myPid) || null;
    const rival = Object.values(players).find(p => p.pid !== myPid) || null;

    const result =
      !summary.winnerPid
        ? 'draw'
        : summary.winnerPid === myPid
          ? 'win'
          : 'lose';

    const titleText =
      result === 'win'
        ? 'ชนะ Battle!'
        : result === 'lose'
          ? 'แพ้ Battle!'
          : 'เสมอ Battle!';

    setText(['#summaryTitle','[data-summary-title]','.summary-title'], titleText);

    setText(
      ['#summaryReason','[data-summary-reason]','.summary-reason'],
      `รอบที่ ${Number(summary.roundNo || 1)} • ${summary.reason || 'สรุปผล'}`
    );

    setText(
      ['#summaryMyName','[data-summary-my-name]','.summary-my-name'],
      `คุณ: ${safePlayerName(me, guard.name || 'Hero')}`
    );

    setText(
      ['#summaryRivalName','[data-summary-rival-name]','.summary-rival-name'],
      `คู่แข่ง: ${safePlayerName(rival, 'คู่แข่ง')}`
    );

    setText(
      ['#summaryMyScore','[data-summary-my-score]','.summary-my-score'],
      String(Number(me?.score || 0))
    );

    setText(
      ['#summaryRivalScore','[data-summary-rival-score]','.summary-rival-score'],
      String(Number(rival?.score || 0))
    );

    setText(
      ['#summaryMyHeart','[data-summary-my-heart]','.summary-my-heart'],
      heartText(Number(me?.hp || 0))
    );

    setText(
      ['#summaryRivalHeart','[data-summary-rival-heart]','.summary-rival-heart'],
      heartText(Number(rival?.hp || 0))
    );

    showOverlay();
  }

  function handleEndedRoom(room){
    if (!room || guard.endedHandled) return;

    if (!room.finalSummary && room.status !== 'ended' && room.status !== 'aborted'){
      return;
    }

    guard.endedHandled = true;

    hideCountdown();

    try{
      if (window.state){
        window.state.ended = true;
        window.state.gameStarted = false;
        window.state.waitingForStart = false;
      }
    }catch(_){}

    try{
      clearInterval(window.playerSyncTimer);
      clearInterval(window.countdownTimer);
    }catch(_){}

    if (room.finalSummary){
      if (typeof window.renderBattleSummaryFromFinal === 'function'){
        window.renderBattleSummaryFromFinal(room.finalSummary);
      }else{
        renderSummaryFallback(room.finalSummary);
      }
    }else{
      showOverlay();
      setText(['#summaryTitle','[data-summary-title]','.summary-title'], 'Battle จบแล้ว');
      setText(['#summaryReason','[data-summary-reason]','.summary-reason'], 'ห้องนี้เป็น match เก่าที่จบแล้ว');
    }

    console.warn('[GJ Battle Run Guard] ended room handled', {
      room:guard.room,
      status:room.status,
      hasFinalSummary:!!room.finalSummary
    });
  }

  function forceLocalStart(room){
    if (guard.forcedStart || guard.endedHandled) return;

    guard.forcedStart = true;

    hideCountdown();

    try{
      if (window.state){
        window.state.gameStarted = true;
        window.state.waitingForStart = false;
        window.state.startedAt = Number(room?.startedAt || Date.now());
      }
    }catch(_){}

    if (typeof window.startBattleLocal === 'function'){
      window.startBattleLocal(room || {});
      return;
    }

    if (typeof window.startGameLoop === 'function'){
      window.startGameLoop();
      return;
    }

    if (typeof window.startBattleLoop === 'function'){
      window.startBattleLoop();
      return;
    }

    if (typeof window.start === 'function'){
      window.start();
      return;
    }

    document.body.classList.add('battle-started');

    console.warn('[GJ Battle Run Guard] forced local start, no explicit start function found');
  }

  function watchCountdownStuck(room){
    clearTimeout(guard.countdownWatchTimer);

    guard.countdownWatchTimer = setTimeout(() => {
      if (guard.endedHandled) return;

      const el = countdownEl();
      if (!el) return;

      const visible =
        el.classList.contains('show') ||
        el.classList.contains('active') ||
        getComputedStyle(el).display !== 'none';

      if (!visible) return;

      console.warn('[GJ Battle Run Guard] countdown stuck > 4.5s, forcing start');
      forceLocalStart(room || {});
    }, 4500);
  }

  async function inspectRoomOnce(){
    try{
      readContext();
      if (!guard.room) return;

      const db = await ensureDb();
      const room = await db.ref(roomPath()).get().then(s => s.val()).catch(() => null);
      if (!room) return;

      if (room.finalSummary || room.status === 'ended' || room.status === 'aborted'){
        handleEndedRoom(room);
        return;
      }

      if (room.status === 'countdown'){
        watchCountdownStuck(room);
      }

      if (room.status === 'started'){
        hideCountdown();
      }

    }catch(err){
      console.warn('[GJ Battle Run Guard] inspectRoomOnce failed', err);
    }
  }

  async function attachRoomListener(){
    if (guard.roomListenerAttached) return;
    guard.roomListenerAttached = true;

    try{
      readContext();
      if (!guard.room) return;

      const db = await ensureDb();

      db.ref(roomPath()).on('value', snap => {
        const room = snap.val();
        if (!room) return;

        if (window.state){
          window.state.roomData = room;
        }

        if (room.finalSummary || room.status === 'ended' || room.status === 'aborted'){
          handleEndedRoom(room);
          return;
        }

        if (room.status === 'countdown'){
          watchCountdownStuck(room);
        }

        if (room.status === 'started'){
          hideCountdown();
        }
      });

    }catch(err){
      console.warn('[GJ Battle Run Guard] attachRoomListener failed', err);
    }
  }

  function patchLegacyCountdownFunctions(){
    if (window.__GJ_BT_RUN_COUNTDOWN_GUARD_INSTALLED__) return;
    window.__GJ_BT_RUN_COUNTDOWN_GUARD_INSTALLED__ = true;

    const names = [
      'showBattleCountdown',
      'showCountdown',
      'startCountdown'
    ];

    names.forEach(name => {
      if (typeof window[name] !== 'function') return;

      const oldFn = window[name];

      window[name] = function(room){
        const result = oldFn.apply(this, arguments);
        watchCountdownStuck(room || window.state?.roomData || {});
        return result;
      };
    });
  }

  function install(){
    if (guard.installed) return;
    guard.installed = true;

    readContext();

    patchLegacyCountdownFunctions();
    attachRoomListener();
    inspectRoomOnce();

    setInterval(inspectRoomOnce, 3000);

    window.addEventListener('beforeunload', () => {
      clearTimeout(guard.countdownWatchTimer);
    });

    console.log('[GJ Battle Run Guard] installed', {
      version:window.HHA_GJ_BATTLE_RUN_STATE_GUARD,
      room:guard.room,
      pid:guard.pid,
      matchId:guard.matchId
    });
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', install);
  }else{
    install();
  }
})();
