/* =========================================================
   HeroHealth • GoodJunk Battle Countdown Sync v5 Guest Unblock
   FILE: /herohealth/vr-goodjunk/goodjunk-vr-battle.countdown-sync-v5-guest-unblock.js
   PATCH: v20260514g

   Fix:
   - KK เห็น Battle 2/2 แต่ค้างเลข 3
   - Guest ไม่เริ่มเพราะ countdown เดิมเป็นของ Host/local
   - ถ้าห้อง started/countdown และ count >= 2 ให้ Guest เข้า gameplay เอง
   - ซ่อน overlay เก่าที่มี "เตรียมพร้อม Battle / กำลังเตรียม Battle"
   ========================================================= */

(() => {
  'use strict';

  const PATCH_ID = 'v20260514g-countdown-sync-v5-guest-unblock';
  if (window.__GJ_BATTLE_COUNTDOWN_SYNC_V5__) return;
  window.__GJ_BATTLE_COUNTDOWN_SYNC_V5__ = PATCH_ID;

  const qs = new URLSearchParams(location.search);

  const ROOM = cleanRoom(qs.get('roomId') || qs.get('room') || '');
  const PID = clean(qs.get('pid') || '');
  const URL_HOST_PID = clean(qs.get('hostPid') || '');

  const LOG = '[GJ Battle Countdown Sync v5]';

  let db = null;
  let auth = null;
  let isHost = false;
  let localPlaying = false;
  let hostCountdownStarted = false;
  let firstReadyAt = 0;
  let forceTimer = null;
  let overlay = null;

  boot();

  async function boot(){
    if (!ROOM){
      console.warn(LOG, 'missing room');
      return;
    }

    try{
      await waitForDb();

      console.info(LOG, 'loaded', {
        patch: PATCH_ID,
        room: ROOM,
        pid: PID,
        urlHostPid: URL_HOST_PID,
        uid: auth?.currentUser?.uid || ''
      });

      const room = await dbGet(roomPath(ROOM)).catch(() => null);
      isHost = getIsHost(room);

      listenRoom();
      await reactToRoom(room, 'boot');

      forceTimer = setInterval(async () => {
        const latest = await dbGet(roomPath(ROOM)).catch(() => null);
        await reactToRoom(latest, 'repair');
      }, 650);

      window.addEventListener('pagehide', () => {
        if (forceTimer) clearInterval(forceTimer);
      });

    }catch(err){
      console.warn(LOG, 'boot failed', err);
    }
  }

  async function waitForDb(){
    for (let i = 0; i < 70; i++){
      if (window.HHA_FIREBASE_READY){
        const fb = await window.HHA_FIREBASE_READY;
        if (fb && fb.db && fb.auth && fb.auth.currentUser){
          db = fb.db;
          auth = fb.auth;
          return;
        }
      }
      await sleep(200);
    }
    throw new Error('Firebase auth/db not ready');
  }

  function listenRoom(){
    db.ref(roomPath(ROOM)).on('value', snap => {
      const room = snap && snap.val ? snap.val() : null;
      reactToRoom(room, 'listener').catch(err => {
        console.warn(LOG, 'listener failed', err);
      });
    });
  }

  async function reactToRoom(room, reason){
    if (!room || localPlaying) return;

    isHost = getIsHost(room);

    const status = clean(room.status || '').toLowerCase();
    const phase = clean(room.phase || room.currentRun?.phase || '').toLowerCase();
    const cd = room.battleCountdown || null;
    const cdPhase = clean(cd?.phase || '').toLowerCase();

    const count = getPlayerCount(room);
    const expected = Math.max(
      2,
      Number(room.expectedPlayers || 0),
      Number(room.participantCount || 0),
      Number(room.activeCount || 0),
      count || 2
    );

    const startedLike =
      status === 'started' ||
      status === 'running' ||
      status === 'playing' ||
      status === 'waiting' ||
      phase === 'started' ||
      phase === 'countdown' ||
      phase === 'playing' ||
      cdPhase === 'countdown' ||
      cdPhase === 'go' ||
      cdPhase === 'playing';

    console.info(LOG, reason, {
      status,
      phase,
      cdPhase,
      count,
      expected,
      isHost,
      startedLike
    });

    if (status === 'playing' || phase === 'playing' || cdPhase === 'playing'){
      enterGameplay('room-playing');
      return;
    }

    if (cd && (cdPhase === 'countdown' || cdPhase === 'go')){
      showOverlay({
        title:`รอบที่ 1 • เตรียมพร้อม Battle ${count || expected}/${expected}`,
        value: clean(cd.text || String(cd.value ?? '3'))
      });

      if (cdPhase === 'go'){
        setTimeout(() => enterGameplay('go-phase'), 350);
      }
      return;
    }

    if (isHost && !hostCountdownStarted && count >= 2 && startedLike){
      hostCountdownStarted = true;
      await runHostCountdown(room, count, expected, reason);
      return;
    }

    /*
      จุดแก้สำคัญ:
      Guest ไม่ต้องรอ countdown กลางตลอดไป
      ถ้าเห็นผู้เล่นครบ 2/2 และห้องเริ่มแล้ว ให้ปลด overlay เอง
    */
    if (!isHost && count >= 2 && startedLike){
      if (!firstReadyAt) firstReadyAt = Date.now();

      showOverlay({
        title:`รอบที่ 1 • เตรียมพร้อม Battle ${count}/${expected}`,
        value:'3'
      });

      const waited = Date.now() - firstReadyAt;

      if (waited > 1200){
        await markGuestReadyToPlay(room).catch(() => {});
        enterGameplay('guest-unblock-started-2of2');
      }
    }
  }

  async function markGuestReadyToPlay(room){
    const matchId =
      clean(room.activeMatchId || '') ||
      clean(room.currentRun?.matchId || '') ||
      clean(qs.get('matchId') || '') ||
      `${ROOM}-R1`;

    const t = Date.now();

    await dbUpdate(roomPath(ROOM), {
      updatedAt:t,
      [`guestStartSignals/${safeKey(PID || 'guest')}`]: {
        pid: PID || 'guest',
        matchId,
        state:'guest-unblocked',
        at:t
      }
    });
  }

  function getIsHost(room){
    const hostPid = clean(URL_HOST_PID || room?.hostPid || '');
    return !!(PID && hostPid && PID === hostPid);
  }

  function getPlayerCount(room){
    const buckets = [
      room.players,
      room.runtimePlayers,
      room.activePlayers,
      room.currentRun?.participants,
      room.currentRun?.runtimePlayers,
      room.currentRun?.activePlayers
    ];

    let max = Number(room.activeCount || room.participantCount || room.expectedPlayers || 0);

    buckets.forEach(obj => {
      if (obj && typeof obj === 'object'){
        max = Math.max(max, Object.keys(obj).length);
      }
    });

    return max;
  }

  async function runHostCountdown(room, count, expected, reason){
    const matchId =
      clean(room.activeMatchId || '') ||
      clean(room.currentRun?.matchId || '') ||
      clean(qs.get('matchId') || '') ||
      `${ROOM}-R1`;

    const token = `${matchId}-${Date.now()}`;

    console.info(LOG, 'host countdown start', { matchId, count, expected, reason });

    await setCountdown({ matchId, token, count, expected, phase:'countdown', value:3, text:'3' });
    await sleep(700);

    await setCountdown({ matchId, token, count, expected, phase:'countdown', value:2, text:'2' });
    await sleep(700);

    await setCountdown({ matchId, token, count, expected, phase:'countdown', value:1, text:'1' });
    await sleep(700);

    await setCountdown({ matchId, token, count, expected, phase:'go', value:0, text:'GO!' });
    await sleep(350);

    const t = Date.now();

    await dbUpdate(roomPath(ROOM), {
      status:'playing',
      phase:'playing',
      updatedAt:t,

      'currentRun/status':'playing',
      'currentRun/phase':'playing',
      'currentRun/playAt':t,

      'battleCountdown/phase':'playing',
      'battleCountdown/value':0,
      'battleCountdown/text':'GO!',
      'battleCountdown/playAt':t,
      'battleCountdown/updatedAt':t
    });

    await dbUpdate(matchPath(ROOM, matchId), {
      status:'playing',
      phase:'playing',
      playAt:t,
      updatedAt:t
    }).catch(() => {});

    enterGameplay('host-countdown-complete');
  }

  async function setCountdown({ matchId, token, count, expected, phase, value, text }){
    const t = Date.now();

    const data = {
      roomId:ROOM,
      matchId,
      token,
      phase,
      value,
      text,
      count,
      expected,
      by:PID || 'host',
      updatedAt:t
    };

    await dbUpdate(roomPath(ROOM), {
      status:'started',
      phase:'countdown',
      updatedAt:t,
      battleCountdown:data,

      'currentRun/status':'started',
      'currentRun/phase':'countdown',
      'currentRun/matchId':matchId
    });
  }

  function showOverlay({ title, value }){
    const el = ensureOverlay();
    el.querySelector('[data-title]').textContent = title;
    el.querySelector('[data-value]').textContent = value;
    el.style.display = 'grid';
  }

  function ensureOverlay(){
    let el = document.getElementById('gjBattleCountdownV5Overlay');
    if (el) return el;

    el = document.createElement('div');
    el.id = 'gjBattleCountdownV5Overlay';
    el.innerHTML = `
      <div class="gjbcd-card">
        <div class="gjbcd-icon">⚔️</div>
        <div class="gjbcd-title" data-title>รอบที่ 1 • เตรียมพร้อม Battle 2/2</div>
        <div class="gjbcd-value" data-value>3</div>
        <div class="gjbcd-note">กำลังเชื่อม Battle ให้พร้อมเล่น...</div>
      </div>
    `;

    const css = document.createElement('style');
    css.textContent = `
      #gjBattleCountdownV5Overlay{
        position:fixed;
        inset:0;
        z-index:2147483000;
        display:grid;
        place-items:center;
        background:rgba(132,82,48,.44);
        backdrop-filter:blur(12px);
        padding:18px;
        font-family:system-ui,-apple-system,"Segoe UI","Noto Sans Thai",sans-serif;
      }
      #gjBattleCountdownV5Overlay .gjbcd-card{
        width:min(620px,92vw);
        border:4px solid #ffbd77;
        border-radius:34px;
        background:#fffdf4;
        box-shadow:0 22px 60px rgba(91,45,17,.24);
        padding:30px 22px;
        text-align:center;
        color:#87311b;
      }
      #gjBattleCountdownV5Overlay .gjbcd-icon{
        width:96px;
        height:96px;
        margin:0 auto 18px;
        border-radius:30px;
        display:grid;
        place-items:center;
        font-size:46px;
        background:linear-gradient(180deg,#fff2dd,#ffd6a0);
        border:4px solid #ffbd77;
      }
      #gjBattleCountdownV5Overlay .gjbcd-title{
        font-size:clamp(28px,6vw,46px);
        line-height:1.18;
        font-weight:1000;
        margin-bottom:18px;
      }
      #gjBattleCountdownV5Overlay .gjbcd-value{
        font-size:clamp(64px,16vw,128px);
        line-height:1;
        font-weight:1000;
      }
      #gjBattleCountdownV5Overlay .gjbcd-note{
        margin-top:14px;
        font-size:16px;
        font-weight:900;
        color:#8a5a00;
      }
    `;

    document.head.appendChild(css);
    document.body.appendChild(el);
    return el;
  }

  function enterGameplay(reason){
    if (localPlaying) return;
    localPlaying = true;

    console.info(LOG, 'enter gameplay', reason);

    const el = document.getElementById('gjBattleCountdownV5Overlay');
    if (el) el.style.display = 'none';

    hardHideOldStartCards();

    window.dispatchEvent(new CustomEvent('hha:battle:countdown-complete', {
      detail:{ roomId:ROOM, reason }
    }));

    window.dispatchEvent(new CustomEvent('hha:battle:start-gameplay', {
      detail:{ roomId:ROOM, reason }
    }));

    document.dispatchEvent(new CustomEvent('hha:battle:countdown-complete', {
      detail:{ roomId:ROOM, reason }
    }));

    document.dispatchEvent(new CustomEvent('hha:battle:start-gameplay', {
      detail:{ roomId:ROOM, reason }
    }));

    [
      'startGame',
      'startBattle',
      'beginGame',
      'beginBattle',
      'startRound',
      'beginRound',
      'resumeGame',
      'hideStartOverlay',
      'forceStart',
      'forceStartGame',
      'play'
    ].forEach(fn => {
      try{
        if (typeof window[fn] === 'function') window[fn]();
      }catch(err){
        console.warn(LOG, `call ${fn} failed`, err);
      }
    });

    setTimeout(hardHideOldStartCards, 50);
    setTimeout(hardHideOldStartCards, 250);
    setTimeout(hardHideOldStartCards, 750);
    setTimeout(hardHideOldStartCards, 1500);
  }

  function hardHideOldStartCards(){
    const needles = [
      'กำลังเตรียม Battle',
      'เตรียมพร้อม Battle',
      'รอผู้เล่นอีก',
      'ลองเริ่มอีกครั้ง',
      'กลับ Lobby'
    ];

    const all = Array.from(document.querySelectorAll('body *'));

    all.forEach(node => {
      if (node.id === 'gjBattleCountdownV5Overlay') return;

      const text = (node.textContent || '').trim();
      if (!text) return;
      if (!needles.some(n => text.includes(n))) return;

      const box = findBigBox(node);
      if (box && box !== document.body){
        box.style.display = 'none';
        box.style.pointerEvents = 'none';
        box.setAttribute('data-hidden-by-countdown-v5', '1');
      }
    });

    // กันฉากหลังยัง blur เพราะ overlay เก่า
    Array.from(document.querySelectorAll('body *')).slice(0, 500).forEach(el => {
      const cs = getComputedStyle(el);
      if (
        (cs.backdropFilter && cs.backdropFilter !== 'none') ||
        (cs.webkitBackdropFilter && cs.webkitBackdropFilter !== 'none')
      ){
        const text = (el.textContent || '').trim();
        if (needles.some(n => text.includes(n))){
          el.style.display = 'none';
          el.setAttribute('data-hidden-by-countdown-v5-blur', '1');
        }
      }
    });
  }

  function findBigBox(el){
    let cur = el;

    for (let i = 0; i < 10 && cur && cur !== document.body; i++){
      const rect = cur.getBoundingClientRect();
      const cs = getComputedStyle(cur);

      if (
        rect.width > 240 &&
        rect.height > 120 &&
        (
          cs.position === 'fixed' ||
          cs.position === 'absolute' ||
          cs.position === 'relative' ||
          Number(cs.zIndex || 0) > 10
        )
      ){
        return cur;
      }

      cur = cur.parentElement;
    }

    return el.closest('[role="dialog"], .modal, .overlay, .dialog, .countdown, .start') || null;
  }

  function roomPath(roomId){
    return `hha-battle/goodjunk/battleRooms/${safeKey(roomId)}`;
  }

  function matchPath(roomId, matchId){
    return `${roomPath(roomId)}/matches/${safeKey(matchId)}`;
  }

  function dbGet(path){
    return db.ref(path).get().then(s => s && s.val ? s.val() : null);
  }

  function dbUpdate(path, value){
    return db.ref(path).update(value).then(() => value);
  }

  function safeKey(raw){
    return String(raw || '')
      .trim()
      .replace(/[.#$/\[\]]/g,'_')
      .slice(0,96) || 'key';
  }

  function clean(v){
    return String(v ?? '').trim();
  }

  function cleanRoom(v){
    let s = clean(v).toUpperCase();
    s = s.replace(/\s+/g,'').replace(/[^A-Z0-9-]/g,'');

    if (!s) return '';

    if (!s.startsWith('GJ-BT-')){
      s = 'GJ-BT-' + s
        .replace(/^GJ-BT/i,'')
        .replace(/^GJBT/i,'')
        .replace(/^BT/i,'')
        .replace(/^-/, '');
    }

    return s.slice(0,16);
  }

  function sleep(ms){
    return new Promise(resolve => setTimeout(resolve, ms));
  }
})();
