/* =========================================================
   HeroHealth • GoodJunk Battle Countdown Sync v4 Guest Start
   FILE: /herohealth/vr-goodjunk/goodjunk-vr-battle.countdown-sync-v4-guest-start.js
   PATCH: v20260514f

   Fix:
   - Host เข้า gameplay แล้ว แต่ KK/Guest ยังติด overlay 1/2 หรือ 3
   - ถ้า room.status = playing ให้ Guest ซ่อน overlay และเริ่มเล่นทันที
   - ถ้า Host ยังไม่ได้เขียน countdown ให้ Host เขียน 3-2-1-GO
   - ถ้า Guest เข้าหลังเกมเริ่มแล้ว ให้ข้าม countdown และเข้า gameplay เลย
   ========================================================= */

(() => {
  'use strict';

  const PATCH_ID = 'v20260514f-countdown-sync-v4-guest-start';
  if (window.__GJ_BATTLE_COUNTDOWN_SYNC_V4__) return;
  window.__GJ_BATTLE_COUNTDOWN_SYNC_V4__ = PATCH_ID;

  const qs = new URLSearchParams(location.search);

  const ROOM = cleanRoom(qs.get('roomId') || qs.get('room') || '');
  const PID = clean(qs.get('pid') || '');
  const URL_HOST_PID = clean(qs.get('hostPid') || '');

  const LOG = '[GJ Battle Countdown Sync v4]';

  let db = null;
  let auth = null;
  let isHost = false;
  let localPlaying = false;
  let hostCountdownStarted = false;
  let overlay = null;
  let repairTimer = null;

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

      // เช็กทันที เผื่อห้องเริ่มไปแล้วก่อน Guest โหลดไฟล์นี้
      await reactToRoom(room, 'boot');

      repairTimer = setInterval(async () => {
        const latest = await dbGet(roomPath(ROOM)).catch(() => null);
        await reactToRoom(latest, 'repair');
      }, 1000);

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
          auth = fb.auth;
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
      reactToRoom(room, 'listener').catch(err => {
        console.warn(LOG, 'listener failed', err);
      });
    });
  }

  async function reactToRoom(room, reason){
    if (!room) return;

    isHost = getIsHost(room);

    const status = clean(room.status || '').toLowerCase();
    const phase = clean(room.phase || room.currentRun?.phase || '').toLowerCase();
    const cd = room.battleCountdown || null;
    const cdPhase = clean(cd?.phase || '').toLowerCase();

    const count = getPlayerCount(room);
    const expected = Math.max(2, Number(room.expectedPlayers || room.participantCount || room.activeCount || count || 2));

    console.info(LOG, reason, {
      status,
      phase,
      cdPhase,
      count,
      expected,
      isHost
    });

    // สำคัญที่สุด: ถ้าห้อง playing แล้ว ทุกเครื่องต้องเข้า gameplay ทันที
    if (status === 'playing' || phase === 'playing' || cdPhase === 'playing'){
      enterGameplay('room-is-playing');
      return;
    }

    // ถ้ามี countdown กลาง ให้ทุกเครื่องแสดงตาม
    if (cd && (cdPhase === 'countdown' || cdPhase === 'go')){
      showOverlay({
        title: `รอบที่ 1 • เตรียมพร้อม Battle ${count || expected}/${expected}`,
        value: clean(cd.text || String(cd.value ?? '3'))
      });

      if (cdPhase === 'go'){
        setTimeout(() => enterGameplay('go-phase'), 450);
      }
      return;
    }

    // เฉพาะ Host เท่านั้นที่เริ่ม countdown กลาง
    if (
      isHost &&
      !hostCountdownStarted &&
      count >= 2 &&
      (status === 'started' || status === 'waiting' || status === 'ready' || status === '')
    ){
      hostCountdownStarted = true;
      await runHostCountdown(room, count, expected, reason);
    }
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
    await sleep(900);

    await setCountdown({ matchId, token, count, expected, phase:'countdown', value:2, text:'2' });
    await sleep(900);

    await setCountdown({ matchId, token, count, expected, phase:'countdown', value:1, text:'1' });
    await sleep(900);

    await setCountdown({ matchId, token, count, expected, phase:'go', value:0, text:'GO!' });
    await sleep(450);

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

    enterGameplay('host-finished-countdown');
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
    let el = document.getElementById('gjBattleCountdownV4Overlay');
    if (el) return el;

    el = document.createElement('div');
    el.id = 'gjBattleCountdownV4Overlay';
    el.innerHTML = `
      <div class="gjbcd-card">
        <div class="gjbcd-icon">⚔️</div>
        <div class="gjbcd-title" data-title>รอบที่ 1 • เตรียมพร้อม Battle 2/2</div>
        <div class="gjbcd-value" data-value>3</div>
      </div>
    `;

    const css = document.createElement('style');
    css.textContent = `
      #gjBattleCountdownV4Overlay{
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
      #gjBattleCountdownV4Overlay .gjbcd-card{
        width:min(620px,92vw);
        border:4px solid #ffbd77;
        border-radius:34px;
        background:#fffdf4;
        box-shadow:0 22px 60px rgba(91,45,17,.24);
        padding:30px 22px;
        text-align:center;
        color:#87311b;
      }
      #gjBattleCountdownV4Overlay .gjbcd-icon{
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
      #gjBattleCountdownV4Overlay .gjbcd-title{
        font-size:clamp(30px,6vw,48px);
        line-height:1.18;
        font-weight:1000;
        margin-bottom:18px;
      }
      #gjBattleCountdownV4Overlay .gjbcd-value{
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

    const el = document.getElementById('gjBattleCountdownV4Overlay');
    if (el) el.style.display = 'none';

    hideOldStartCards();

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

    setTimeout(hideOldStartCards, 100);
    setTimeout(hideOldStartCards, 500);
    setTimeout(hideOldStartCards, 1000);
  }

  function hideOldStartCards(){
    const needles = [
      'กำลังเตรียม Battle',
      'เตรียมพร้อม Battle',
      'รอผู้เล่นอีก',
      'ลองเริ่มอีกครั้ง'
    ];

    const nodes = Array.from(document.querySelectorAll('body *')).slice(0, 700);

    nodes.forEach(node => {
      if (node.id === 'gjBattleCountdownV4Overlay') return;

      const text = (node.textContent || '').trim();
      if (!text) return;
      if (!needles.some(n => text.includes(n))) return;

      let cur = node;

      for (let i = 0; i < 8 && cur && cur !== document.body; i++){
        const rect = cur.getBoundingClientRect();

        if (rect.width > 240 && rect.height > 120){
          cur.style.display = 'none';
          cur.setAttribute('data-hidden-by-countdown-v4', '1');
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
