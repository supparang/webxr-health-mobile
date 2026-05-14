/* =========================================================
   HeroHealth • GoodJunk Battle Countdown Sync v3 SAFE
   FILE: /herohealth/vr-goodjunk/goodjunk-vr-battle.countdown-sync-v3-safe.js
   PATCH: v20260514d

   Fix:
   - KK ค้างที่ 3
   - Host crash เพราะ countdown/DOM patch เดิมหนักเกินไป
   - Host เท่านั้นเป็นคนเขียน countdown
   - Guest แค่อ่าน countdown
   - ไม่ replace text ทั่วหน้า
   ========================================================= */

(() => {
  'use strict';

  const PATCH_ID = 'v20260514d-countdown-sync-v3-safe';
  if (window.__GJ_BATTLE_COUNTDOWN_SYNC_V3_SAFE__) return;
  window.__GJ_BATTLE_COUNTDOWN_SYNC_V3_SAFE__ = PATCH_ID;

  const qs = new URLSearchParams(location.search);
  const ROOM = cleanRoom(qs.get('roomId') || qs.get('room') || '');
  const PID = clean(qs.get('pid') || '');
  const NAME = clean(qs.get('name') || qs.get('nick') || 'Player');

  const LOG = '[GJ Battle Countdown Sync v3 Safe]';

  let db = null;
  let isHost = false;
  let overlay = null;
  let countdownStarted = false;
  let localPlaying = false;
  let repairTimer = null;

  boot();

  async function boot(){
    if (!ROOM){
      console.warn(LOG, 'missing room');
      return;
    }

    try{
      await waitForDb();

      const room = await dbGet(roomPath(ROOM)).catch(() => null);
      isHost = !!(room && PID && room.hostPid === PID);

      console.info(LOG, 'loaded', {
        patch: PATCH_ID,
        room: ROOM,
        pid: PID,
        name: NAME,
        isHost
      });

      listenRoom();

      if (isHost){
        setTimeout(() => {
          maybeStartCountdown('boot').catch(err => console.warn(LOG, err));
        }, 800);
      }

      repairTimer = setInterval(() => {
        if (isHost && !countdownStarted && !localPlaying){
          maybeStartCountdown('repair').catch(err => console.warn(LOG, err));
        }
      }, 1800);

      window.addEventListener('pagehide', () => {
        if (repairTimer) clearInterval(repairTimer);
      });
    }catch(err){
      console.warn(LOG, 'boot failed', err);
    }
  }

  async function waitForDb(){
    for (let i = 0; i < 60; i++){
      if (window.HHA_FIREBASE_READY){
        const fb = await window.HHA_FIREBASE_READY;
        if (fb && fb.db && fb.auth && fb.auth.currentUser){
          db = fb.db;
          return;
        }
      }
      await sleep(250);
    }
    throw new Error('Firebase auth/db not ready');
  }

  function listenRoom(){
    db.ref(roomPath(ROOM)).on('value', snap => {
      const room = snap && snap.val ? snap.val() : null;
      if (!room) return;

      isHost = !!(PID && room.hostPid === PID);

      const cd = room.battleCountdown || null;
      if (cd) applyCountdown(cd);

      const status = clean(room.status || '').toLowerCase();
      const phase = clean(room.phase || room.currentRun?.phase || '').toLowerCase();

      if (status === 'playing' || phase === 'playing'){
        enterGameplay('room-playing');
      }
    });
  }

  async function maybeStartCountdown(reason){
    if (!isHost || countdownStarted || localPlaying) return;

    const room = await dbGet(roomPath(ROOM)).catch(() => null);
    if (!room) return;

    const status = clean(room.status || '').toLowerCase();
    const phase = clean(room.phase || room.currentRun?.phase || '').toLowerCase();
    const cdPhase = clean(room.battleCountdown?.phase || '').toLowerCase();

    if (phase === 'playing' || status === 'playing' || cdPhase === 'playing') return;
    if (cdPhase === 'countdown' || cdPhase === 'go') return;

    const count = getPlayerCount(room);
    if (count < 2) return;

    if (!(status === 'started' || status === 'waiting' || status === 'ready' || status === '')){
      return;
    }

    countdownStarted = true;
    await runHostCountdown(room, count, reason);
  }

  function getPlayerCount(room){
    const sets = [
      room.players,
      room.runtimePlayers,
      room.activePlayers,
      room.currentRun?.participants,
      room.currentRun?.runtimePlayers,
      room.currentRun?.activePlayers
    ];

    let max = Number(room.activeCount || room.participantCount || room.expectedPlayers || 0);

    sets.forEach(s => {
      if (s && typeof s === 'object'){
        max = Math.max(max, Object.keys(s).length);
      }
    });

    return max;
  }

  async function runHostCountdown(room, count, reason){
    const matchId =
      clean(room.activeMatchId || '') ||
      clean(room.currentRun?.matchId || '') ||
      clean(qs.get('matchId') || '') ||
      `${ROOM}-R1`;

    const expected = Math.max(2, count);
    const token = `${matchId}-${Date.now()}`;

    console.info(LOG, 'host countdown start', { matchId, expected, reason });

    await setCountdown({ matchId, expected, token, phase:'countdown', value:3, text:'3' });
    await sleep(950);

    await setCountdown({ matchId, expected, token, phase:'countdown', value:2, text:'2' });
    await sleep(950);

    await setCountdown({ matchId, expected, token, phase:'countdown', value:1, text:'1' });
    await sleep(950);

    await setCountdown({ matchId, expected, token, phase:'go', value:0, text:'GO!' });
    await sleep(500);

    const playAt = Date.now();

    await dbUpdate(roomPath(ROOM), {
      status:'playing',
      phase:'playing',
      updatedAt:playAt,
      'currentRun/status':'playing',
      'currentRun/phase':'playing',
      'currentRun/playAt':playAt,
      'battleCountdown/phase':'playing',
      'battleCountdown/value':0,
      'battleCountdown/text':'GO!',
      'battleCountdown/playAt':playAt,
      'battleCountdown/updatedAt':playAt
    });

    await dbUpdate(matchPath(ROOM, matchId), {
      status:'playing',
      phase:'playing',
      playAt,
      updatedAt:playAt
    }).catch(() => {});

    enterGameplay('host-complete');
  }

  async function setCountdown({ matchId, expected, token, phase, value, text }){
    const t = Date.now();

    const data = {
      roomId:ROOM,
      matchId,
      token,
      phase,
      value,
      text,
      count:expected,
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

  function applyCountdown(cd){
    const phase = clean(cd.phase || '').toLowerCase();

    if (phase === 'countdown' || phase === 'go'){
      showOverlay({
        title:`รอบที่ 1 • เตรียมพร้อม Battle ${Number(cd.count || cd.expected || 2)}/${Number(cd.expected || cd.count || 2)}`,
        value:clean(cd.text || String(cd.value ?? '3'))
      });

      if (phase === 'go'){
        setTimeout(() => enterGameplay('go'), 520);
      }
      return;
    }

    if (phase === 'playing'){
      enterGameplay('playing');
    }
  }

  function showOverlay({ title, value }){
    const el = ensureOverlay();
    el.querySelector('[data-title]').textContent = title;
    el.querySelector('[data-value]').textContent = value;
    el.style.display = 'grid';
  }

  function ensureOverlay(){
    let el = document.getElementById('gjBattleCountdownSafeOverlay');
    if (el) return el;

    el = document.createElement('div');
    el.id = 'gjBattleCountdownSafeOverlay';
    el.innerHTML = `
      <div class="gjbcd-card">
        <div class="gjbcd-icon">⚔️</div>
        <div class="gjbcd-title" data-title>รอบที่ 1 • เตรียมพร้อม Battle 2/2</div>
        <div class="gjbcd-value" data-value>3</div>
      </div>
    `;

    const css = document.createElement('style');
    css.textContent = `
      #gjBattleCountdownSafeOverlay{
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
      #gjBattleCountdownSafeOverlay .gjbcd-card{
        width:min(620px,92vw);
        border:4px solid #ffbd77;
        border-radius:34px;
        background:#fffdf4;
        box-shadow:0 22px 60px rgba(91,45,17,.24);
        padding:30px 22px;
        text-align:center;
        color:#87311b;
      }
      #gjBattleCountdownSafeOverlay .gjbcd-icon{
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
      #gjBattleCountdownSafeOverlay .gjbcd-title{
        font-size:clamp(30px,6vw,48px);
        line-height:1.18;
        font-weight:1000;
        margin-bottom:18px;
      }
      #gjBattleCountdownSafeOverlay .gjbcd-value{
        font-size:clamp(64px,16vw,128px);
        line-height:1;
        font-weight:1000;
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

    const el = document.getElementById('gjBattleCountdownSafeOverlay');
    if (el) el.style.display = 'none';

    window.dispatchEvent(new CustomEvent('hha:battle:countdown-complete', {
      detail:{ roomId:ROOM, reason }
    }));

    window.dispatchEvent(new CustomEvent('hha:battle:start-gameplay', {
      detail:{ roomId:ROOM, reason }
    }));

    document.dispatchEvent(new CustomEvent('hha:battle:countdown-complete', {
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
      'hideStartOverlay'
    ].forEach(fn => {
      try{
        if (typeof window[fn] === 'function') window[fn]();
      }catch(err){
        console.warn(LOG, `call ${fn} failed`, err);
      }
    });

    setTimeout(hideOldStartCardOnce, 150);
    setTimeout(hideOldStartCardOnce, 700);
  }

  function hideOldStartCardOnce(){
    const needles = ['เตรียมพร้อม Battle', 'กำลังเตรียม Battle', 'ลองเริ่มอีกครั้ง'];

    const nodes = Array.from(document.querySelectorAll('body *')).slice(0, 500);

    nodes.forEach(node => {
      if (node.id === 'gjBattleCountdownSafeOverlay') return;

      const text = (node.textContent || '').trim();
      if (!text) return;
      if (!needles.some(n => text.includes(n))) return;

      let cur = node;
      for (let i = 0; i < 6 && cur && cur !== document.body; i++){
        const rect = cur.getBoundingClientRect();
        if (rect.width > 250 && rect.height > 140){
          cur.style.display = 'none';
          cur.setAttribute('data-hidden-by-countdown-safe', '1');
          return;
        }
        cur = cur.parentElement;
      }
    });
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
    return String(raw || '').trim().replace(/[.#$/\[\]]/g,'_').slice(0,96) || 'key';
  }

  function clean(v){
    return String(v ?? '').trim();
  }

  function cleanRoom(v){
    let s = clean(v).toUpperCase();
    s = s.replace(/\s+/g,'').replace(/[^A-Z0-9-]/g,'');
    if (!s) return '';
    if (!s.startsWith('GJ-BT-')){
      s = 'GJ-BT-' + s.replace(/^GJ-BT/i,'').replace(/^GJBT/i,'').replace(/^BT/i,'').replace(/^-/, '');
    }
    return s.slice(0,16);
  }

  function sleep(ms){
    return new Promise(resolve => setTimeout(resolve, ms));
  }
})();
