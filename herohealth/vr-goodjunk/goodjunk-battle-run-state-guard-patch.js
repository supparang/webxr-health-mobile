/*
  HeroHealth • GoodJunk Battle Run State Guard Patch
  v20260515-battle-run-v236-matchid-guard

  Fixes:
  - Countdown overlay ค้างเลข 3 แล้วบังคลิก
  - เป้า spawn แล้วแต่เล่นไม่ได้ เพราะ overlay/pointer-events ยังทับสนาม
  - กัน force start ซ้ำจน spawn เป้าหลายชุด
  - ถ้าเกมกำลังเล่นอยู่แล้ว ให้ซ่อน countdown ทันที
  - ถ้าห้อง ended/finalSummary ค่อยแสดง summary
  - ถ้า URL matchId ใหม่ แต่ room finalSummary เป็นของ match เก่า ให้ ignore finalSummary เก่า
*/

(function(){
  'use strict';

  window.HHA_GJ_BATTLE_RUN_STATE_GUARD =
    'v20260515-battle-run-v236-matchid-guard';

  const params = new URLSearchParams(location.search);
  const ROOM_ROOT = 'hha-battle/goodjunk/battleV2Rooms';

  const guard = {
    db:null,
    room:'',
    pid:'',
    name:'',
    matchId:'',
    installed:false,
    roomListenerAttached:false,
    countdownWatchTimer:null,
    pollTimer:null,
    endedHandled:false,
    startUnlocked:false,
    lastRoomStatus:'',
    lastActiveMatchId:''
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
      document.querySelector('.countdownOverlay') ||
      document.querySelector('.countdown') ||
      document.querySelector('.countdown-modal') ||
      document.querySelector('.start-countdown');
  }

  function looksLikeCountdownText(el){
    if (!el) return false;
    const t = String(el.textContent || '').trim();
    return /Battle\s*พร้อม|กำลังเข้าเกม|^\s*3\s*$|^\s*2\s*$|^\s*1\s*$|GO/i.test(t);
  }

  function findCountdownByText(){
    const nodes = Array.from(document.querySelectorAll('div,section,article,aside'));
    return nodes.find(el => {
      const st = getComputedStyle(el);
      if (st.position !== 'fixed' && st.position !== 'absolute') return false;
      if (st.display === 'none' || st.visibility === 'hidden') return false;
      return looksLikeCountdownText(el);
    }) || null;
  }

  function hideCountdown(){
    const list = [
      countdownEl(),
      findCountdownByText()
    ].filter(Boolean);

    list.forEach(el => {
      el.classList.remove('show');
      el.classList.remove('active');
      el.classList.remove('open');
      el.setAttribute('aria-hidden','true');
      el.style.display = 'none';
      el.style.visibility = 'hidden';
      el.style.opacity = '0';
      el.style.pointerEvents = 'none';
      el.style.zIndex = '-1';
    });

    document.body.classList.add('battle-countdown-cleared');
  }

  function unlockPointerLayers(){
    const maybeBlockers = Array.from(document.querySelectorAll(
      '.countdown,.countdownOverlay,.countdown-modal,.start-countdown,[data-countdown-overlay],.modal,.overlay'
    ));

    maybeBlockers.forEach(el => {
      if (!el) return;
      if (looksLikeCountdownText(el)){
        el.style.pointerEvents = 'none';
      }
    });

    const gameArea =
      document.getElementById('arena') ||
      document.getElementById('game') ||
      document.getElementById('stage') ||
      document.querySelector('[data-arena]') ||
      document.querySelector('.arena') ||
      document.querySelector('.game') ||
      document.querySelector('.stage');

    if (gameArea){
      gameArea.style.pointerEvents = 'auto';
    }

    document.body.style.pointerEvents = 'auto';
  }

  function hasTargetsOnScreen(){
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

    return selectors.some(sel => document.querySelectorAll(sel).length > 0);
  }

  function gameLooksRunning(){
    const s = window.state || window.GJ_STATE || window.BATTLE_STATE || {};

    if (s.gameStarted || s.started || s.running) return true;
    if (Number(s.timeLeft || s.remaining || 0) > 0 && hasTargetsOnScreen()) return true;
    if (hasTargetsOnScreen()) return true;

    const text = document.body.innerText || '';
    if (/เวลา\s*\d+s|Targets\s*\d+|Guest Touch Fix|Score|Combo|Heart|Attack/i.test(text) && hasTargetsOnScreen()){
      return true;
    }

    return false;
  }

  function markLocalStarted(room){
    const s = window.state || window.GJ_STATE || window.BATTLE_STATE || null;

    if (s){
      s.gameStarted = true;
      s.waitingForStart = false;
      s.started = true;
      s.running = true;
      s.startedAt = Number(room?.startedAt || now());
    }

    guard.startUnlocked = true;

    document.body.classList.add('battle-started');
    document.body.classList.add('battle-run-unlocked');

    hideCountdown();
    unlockPointerLayers();
  }

  function startOnlyIfNotRunning(room){
    if (guard.endedHandled) return;

    if (gameLooksRunning()){
      markLocalStarted(room);
      return;
    }

    if (guard.startUnlocked){
      hideCountdown();
      unlockPointerLayers();
      return;
    }

    guard.startUnlocked = true;

    hideCountdown();
    unlockPointerLayers();

    const startFns = [
      'startBattleLocal',
      'startGameLoop',
      'startBattleLoop',
      'start'
    ];

    for (const name of startFns){
      if (typeof window[name] === 'function'){
        try{
          window[name](room || {});
          markLocalStarted(room);
          return;
        }catch(err){
          console.warn(`[GJ Battle Run Guard] ${name} failed`, err);
        }
      }
    }

    markLocalStarted(room);
    console.warn('[GJ Battle Run Guard] no start function found, unlocked UI only');
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

  function showSummaryOverlay(){
    const overlay =
      document.getElementById('summaryOverlay') ||
      document.getElementById('resultOverlay') ||
      document.getElementById('overlay') ||
      document.querySelector('[data-summary-overlay]');

    if (overlay){
      overlay.classList.add('show');
      overlay.classList.add('active');
      overlay.style.display = overlay.style.display === 'none' ? 'flex' : overlay.style.display;
      overlay.style.visibility = 'visible';
      overlay.style.opacity = '1';
      overlay.style.pointerEvents = 'auto';
      overlay.style.zIndex = '9999';
    }
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
    const me =
      players[safeKey(myPid)] ||
      Object.values(players).find(p => p.pid === myPid) ||
      null;

    const rival =
      Object.values(players).find(p => p.pid !== myPid) ||
      null;

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
    setText(['#summaryReason','[data-summary-reason]','.summary-reason'], `รอบที่ ${Number(summary.roundNo || 1)} • ${summary.reason || 'สรุปผล'}`);
    setText(['#summaryMyName','[data-summary-my-name]','.summary-my-name'], `คุณ: ${safePlayerName(me, guard.name || 'Hero')}`);
    setText(['#summaryRivalName','[data-summary-rival-name]','.summary-rival-name'], `คู่แข่ง: ${safePlayerName(rival, 'คู่แข่ง')}`);
    setText(['#summaryMyScore','[data-summary-my-score]','.summary-my-score'], String(Number(me?.score || 0)));
    setText(['#summaryRivalScore','[data-summary-rival-score]','.summary-rival-score'], String(Number(rival?.score || 0)));
    setText(['#summaryMyHeart','[data-summary-my-heart]','.summary-my-heart'], heartText(Number(me?.hp || 0)));
    setText(['#summaryRivalHeart','[data-summary-rival-heart]','.summary-rival-heart'], heartText(Number(rival?.hp || 0)));

    showSummaryOverlay();
  }

  function finalSummaryBelongsToCurrentMatch(room){
    const urlMatchId = params.get('matchId') || guard.matchId || '';
    const roomMatchId = room?.activeMatchId || room?.matchId || '';
    const finalMatchId = room?.finalSummary?.matchId || '';

    if (!room?.finalSummary) return false;

    if (urlMatchId && finalMatchId && urlMatchId !== finalMatchId){
      return false;
    }

    if (urlMatchId && roomMatchId && urlMatchId !== roomMatchId){
      return false;
    }

    return true;
  }

  function handleEndedRoom(room){
    if (!room) return;

    const urlMatchId = params.get('matchId') || '';
    const roomMatchId = room?.activeMatchId || room?.matchId || '';
    const finalMatchId = room?.finalSummary?.matchId || '';

    if (
      room?.finalSummary &&
      urlMatchId &&
      (
        (roomMatchId && urlMatchId !== roomMatchId) ||
        (finalMatchId && urlMatchId !== finalMatchId)
      )
    ){
      console.warn('[GJ Battle Run Guard] ignore old finalSummary because matchId changed', {
        urlMatchId,
        roomMatchId,
        finalMatchId
      });
      return;
    }

    if (!room.finalSummary && room.status !== 'ended' && room.status !== 'aborted'){
      return;
    }

    guard.endedHandled = true;

    hideCountdown();
    unlockPointerLayers();

    try{
      const s = window.state || window.GJ_STATE || window.BATTLE_STATE || null;
      if (s){
        s.ended = true;
        s.gameStarted = false;
        s.waitingForStart = false;
        s.running = false;
      }
    }catch(_){}

    if (room.finalSummary && finalSummaryBelongsToCurrentMatch(room)){
      if (typeof window.renderBattleSummaryFromFinal === 'function'){
        window.renderBattleSummaryFromFinal(room.finalSummary);
      }else{
        renderSummaryFallback(room.finalSummary);
      }
      return;
    }

    if (room.status === 'ended' || room.status === 'aborted'){
      setText(['#summaryTitle','[data-summary-title]','.summary-title'], 'Battle จบแล้ว');
      setText(['#summaryReason','[data-summary-reason]','.summary-reason'], 'ห้องนี้เป็น match เก่าที่จบแล้ว');
      showSummaryOverlay();
    }
  }

  function watchCountdownStuck(room){
    clearTimeout(guard.countdownWatchTimer);

    guard.countdownWatchTimer = setTimeout(() => {
      if (guard.endedHandled) return;

      if (gameLooksRunning()){
        console.warn('[GJ Battle Run Guard] countdown still visible while game running, hiding overlay');
        markLocalStarted(room);
        return;
      }

      const el = countdownEl() || findCountdownByText();
      if (!el) return;

      const st = getComputedStyle(el);
      const visible =
        el.classList.contains('show') ||
        el.classList.contains('active') ||
        st.display !== 'none';

      if (!visible) return;

      console.warn('[GJ Battle Run Guard] countdown stuck > 4.5s, unlocking without duplicate spawn');
      startOnlyIfNotRunning(room || {});
    }, 4500);
  }

  async function inspectRoomOnce(){
    try{
      readContext();
      if (!guard.room) return;

      const db = await ensureDb();
      const room = await db.ref(roomPath()).get().then(s => s.val()).catch(() => null);
      if (!room) return;

      guard.lastRoomStatus = room.status || '';
      guard.lastActiveMatchId = room.activeMatchId || room.matchId || '';

      if (room.finalSummary || room.status === 'ended' || room.status === 'aborted'){
        handleEndedRoom(room);
        return;
      }

      if (room.status === 'started'){
        startOnlyIfNotRunning(room);
        return;
      }

      if (room.status === 'countdown'){
        if (gameLooksRunning()){
          markLocalStarted(room);
          return;
        }

        watchCountdownStuck(room);
        return;
      }

      if (gameLooksRunning()){
        markLocalStarted(room);
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

        if (room.status === 'started'){
          startOnlyIfNotRunning(room);
          return;
        }

        if (room.status === 'countdown'){
          if (gameLooksRunning()){
            markLocalStarted(room);
          }else{
            watchCountdownStuck(room);
          }
        }
      });

    }catch(err){
      console.warn('[GJ Battle Run Guard] attachRoomListener failed', err);
    }
  }

  function patchCountdownFunctions(){
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

        setTimeout(() => {
          if (gameLooksRunning()){
            markLocalStarted(room || window.state?.roomData || {});
          }else{
            watchCountdownStuck(room || window.state?.roomData || {});
          }
        }, 50);

        return result;
      };
    });
  }

  function injectCssGuard(){
    if (document.getElementById('gjBattleRunGuardCss')) return;

    const style = document.createElement('style');
    style.id = 'gjBattleRunGuardCss';
    style.textContent = `
      body.battle-run-unlocked .countdown,
      body.battle-run-unlocked .countdownOverlay,
      body.battle-run-unlocked .countdown-modal,
      body.battle-run-unlocked .start-countdown,
      body.battle-run-unlocked [data-countdown-overlay]{
        display:none !important;
        visibility:hidden !important;
        opacity:0 !important;
        pointer-events:none !important;
        z-index:-1 !important;
      }

      body.battle-run-unlocked .arena,
      body.battle-run-unlocked .game,
      body.battle-run-unlocked .stage,
      body.battle-run-unlocked #arena,
      body.battle-run-unlocked #game,
      body.battle-run-unlocked #stage,
      body.battle-run-unlocked [data-arena]{
        pointer-events:auto !important;
      }
    `;
    document.head.appendChild(style);
  }

  function install(){
    if (guard.installed) return;
    guard.installed = true;

    readContext();
    injectCssGuard();
    patchCountdownFunctions();
    attachRoomListener();
    inspectRoomOnce();

    guard.pollTimer = setInterval(() => {
      if (guard.endedHandled) return;

      if (gameLooksRunning()){
        markLocalStarted(window.state?.roomData || {});
      }else{
        inspectRoomOnce();
      }
    }, 1200);

    window.addEventListener('beforeunload', () => {
      clearTimeout(guard.countdownWatchTimer);
      clearInterval(guard.pollTimer);
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
