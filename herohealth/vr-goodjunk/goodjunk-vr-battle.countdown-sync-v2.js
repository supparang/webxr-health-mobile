/* =========================================================
   HeroHealth • GoodJunk Battle Countdown Sync v2
   FILE: /herohealth/vr-goodjunk/goodjunk-vr-battle.countdown-sync-v2.js
   PATCH: v20260514b

   Fix:
   - KK ค้าง 1/2 / เห็นเป็น host
   - countdown ไม่เดินฝั่ง guest
   - ห้าม replace เลขทั่วหน้าแบบ v1 จนกลายเป็น 3/3
   - ใช้ Firebase battleCountdown เป็นตัวกลาง
   ========================================================= */

(() => {
  'use strict';

  const PATCH_ID = 'v20260514b-countdown-sync-v2';
  if (window.__GJ_BATTLE_COUNTDOWN_SYNC_V2__) return;
  window.__GJ_BATTLE_COUNTDOWN_SYNC_V2__ = PATCH_ID;

  const params = new URLSearchParams(location.search);

  const ROOM = cleanRoom(params.get('roomId') || params.get('room') || '');
  const PID = clean(params.get('pid') || '');
  const NAME = clean(params.get('name') || params.get('nick') || 'Player');

  const LOG = '[GJ Battle Countdown Sync v2]';

  let db = null;
  let isRealHost = false;
  let localStarted = false;
  let hostTickerStarted = false;
  let overlay = null;
  let timer = null;

  boot();

  async function boot(){
    if (!ROOM){
      console.warn(LOG, 'no room');
      return;
    }

    try{
      await waitForDb();

      const room = await dbGet(roomPath(ROOM)).catch(() => null);
      isRealHost = !!(room && PID && room.hostPid === PID);

      console.info(LOG, 'loaded', {
        patch: PATCH_ID,
        room: ROOM,
        pid: PID,
        name: NAME,
        isRealHost
      });

      await repairRoleFromRoom(room);
      listenRoom();

      if (isRealHost){
        setTimeout(() => {
          startHostCountdownOnce().catch(err => console.warn(LOG, err));
        }, 650);
      }

      timer = setInterval(() => {
        checkAndRepairCountdown().catch(err => console.warn(LOG, err));
      }, 1200);

      window.addEventListener('pagehide', () => {
        if (timer) clearInterval(timer);
      });

    }catch(err){
      console.warn(LOG, 'boot failed', err);
    }
  }

  async function waitForDb(){
    for (let i = 0; i < 50; i++){
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

      repairRoleFromRoom(room).catch(() => {});

      const cd = room.battleCountdown || null;
      if (cd) applyCountdown(cd);

      const status = clean(room.status || '').toLowerCase();
      const phase = clean(room.phase || room.currentRun?.phase || '').toLowerCase();

      if ((status === 'playing' || phase === 'playing') && !localStarted){
        forceEnterGameplay('room-playing');
      }
    });

    db.ref(`${roomPath(ROOM)}/battleCountdown`).on('value', snap => {
      const cd = snap && snap.val ? snap.val() : null;
      if (cd) applyCountdown(cd);
    });
  }

  async function repairRoleFromRoom(room){
    if (!room || !PID) return;

    const players = collectPlayers(room);
    const mine = players[safeKey(PID)] || null;
    const realRole = PID === room.hostPid || mine?.role === 'host' ? 'host' : 'guest';

    try{
      const u = new URL(location.href);
      u.searchParams.set('role', realRole);
      u.searchParams.set('host', realRole === 'host' ? '1' : '0');
      history.replaceState(null, '', u.toString());
    }catch(_){}

    if (mine && mine.role !== realRole){
      await dbUpdate(`${roomPath(ROOM)}/players/${safeKey(PID)}`, {
        role: realRole,
        lastSeen: Date.now()
      }).catch(() => {});
    }

    isRealHost = realRole === 'host';
  }

  function collectPlayers(room){
    const out = {};
    [
      room.players,
      room.runtimePlayers,
      room.activePlayers,
      room.currentRun?.participants,
      room.currentRun?.runtimePlayers,
      room.currentRun?.activePlayers
    ].forEach(raw => {
      if (!raw || typeof raw !== 'object') return;

      Object.values(raw).filter(Boolean).forEach((p, idx) => {
        const pid = clean(p.pid || p.id || p.playerId || '');
        if (!pid) return;
        const key = safeKey(pid);
        out[key] = {
          ...out[key],
          ...p,
          pid,
          name: clean(p.name || p.nick || `Player ${idx + 1}`),
          nick: clean(p.nick || p.name || `Player ${idx + 1}`),
          role: pid === room.hostPid || p.role === 'host' ? 'host' : 'guest'
        };
      });
    });

    return out;
  }

  async function checkAndRepairCountdown(){
    const room = await dbGet(roomPath(ROOM)).catch(() => null);
    if (!room) return;

    await repairRoleFromRoom(room);

    if (!isRealHost || hostTickerStarted) return;

    const players = collectPlayers(room);
    const count =
      Number(room.activeCount || room.participantCount || room.expectedPlayers || 0) ||
      Object.keys(players).length;

    const status = clean(room.status || '').toLowerCase();
    const cdPhase = clean(room.battleCountdown?.phase || '').toLowerCase();

    if (
      count >= 2 &&
      (status === 'started' || status === 'waiting' || status === 'ready') &&
      cdPhase !== 'countdown' &&
      cdPhase !== 'go' &&
      cdPhase !== 'playing'
    ){
      await startHostCountdownOnce();
    }
  }

  async function startHostCountdownOnce(){
    if (!isRealHost || hostTickerStarted) return;
    hostTickerStarted = true;

    const room = await dbGet(roomPath(ROOM)).catch(() => null);

    const matchId =
      clean(room?.activeMatchId || '') ||
      clean(room?.currentRun?.matchId || '') ||
      clean(params.get('matchId') || '') ||
      `${ROOM}-R1`;

    const players = collectPlayers(room || {});
    const count = Math.max(2, Object.keys(players).length || Number(room?.participantCount || 2));
    const startedAt = Date.now();

    console.info(LOG, 'host countdown start', { count, matchId });

    await writeCountdown({
      roomId: ROOM,
      matchId,
      phase: 'countdown',
      value: 3,
      text: '3',
      count,
      expected: count,
      by: PID || 'host',
      startedAt,
      updatedAt: startedAt
    });

    await sleep(950);
    await writeCountdown({
      roomId: ROOM,
      matchId,
      phase: 'countdown',
      value: 2,
      text: '2',
      count,
      expected: count,
      by: PID || 'host',
      startedAt,
      updatedAt: Date.now()
    });

    await sleep(950);
    await writeCountdown({
      roomId: ROOM,
      matchId,
      phase: 'countdown',
      value: 1,
      text: '1',
      count,
      expected: count,
      by: PID || 'host',
      startedAt,
      updatedAt: Date.now()
    });

    await sleep(950);
    await writeCountdown({
      roomId: ROOM,
      matchId,
      phase: 'go',
      value: 0,
      text: 'GO!',
      count,
      expected: count,
      by: PID || 'host',
      startedAt,
      updatedAt: Date.now()
    });

    await sleep(500);

    const playAt = Date.now();

    await dbUpdate(roomPath(ROOM), {
      status: 'playing',
      phase: 'playing',
      updatedAt: playAt,
      'currentRun/status': 'playing',
      'currentRun/phase': 'playing',
      'currentRun/playAt': playAt,
      'battleCountdown/phase': 'playing',
      'battleCountdown/value': 0,
      'battleCountdown/text': 'GO!',
      'battleCountdown/playAt': playAt,
      'battleCountdown/updatedAt': playAt
    });

    await dbUpdate(matchPath(ROOM, matchId), {
      status: 'playing',
      phase: 'playing',
      playAt,
      updatedAt: playAt
    }).catch(() => {});

    forceEnterGameplay('host-countdown-complete');
  }

  async function writeCountdown(data){
    await dbUpdate(roomPath(ROOM), {
      status: 'started',
      phase: 'countdown',
      updatedAt: Date.now(),
      battleCountdown: data,
      'currentRun/status': 'started',
      'currentRun/phase': 'countdown'
    });
  }

  function applyCountdown(data){
    const phase = clean(data.phase || '').toLowerCase();
    const text = clean(data.text || String(data.value ?? ''));
    const count = Math.max(2, Number(data.count || data.expected || 2));

    if (phase === 'countdown' || phase === 'go'){
      showCountdownOverlay({
        title: `รอบที่ 1 • เตรียมพร้อม Battle ${count}/${count}`,
        value: text || '3'
      });

      if (phase === 'go'){
        setTimeout(() => forceEnterGameplay('go-timeout'), 500);
      }
      return;
    }

    if (phase === 'playing'){
      forceEnterGameplay('countdown-playing');
    }
  }

  function showCountdownOverlay({ title, value }){
    overlay = ensureOverlay();
    overlay.querySelector('[data-gj-title]').textContent = title;
    overlay.querySelector('[data-gj-value]').textContent = value;
    overlay.style.display = 'grid';
  }

  function ensureOverlay(){
    let el = document.getElementById('gjBattleCountdownSyncOverlay');
    if (el) return el;

    el = document.createElement('div');
    el.id = 'gjBattleCountdownSyncOverlay';
    el.innerHTML = `
      <div class="gjbcd-card">
        <div class="gjbcd-icon">⚔️</div>
        <div class="gjbcd-title" data-gj-title>รอบที่ 1 • เตรียมพร้อม Battle 2/2</div>
        <div class="gjbcd-value" data-gj-value>3</div>
      </div>
    `;

    const css = document.createElement('style');
    css.textContent = `
      #gjBattleCountdownSyncOverlay{
        position:fixed;
        inset:0;
        z-index:2147483000;
        display:grid;
        place-items:center;
        background:rgba(120,72,42,.42);
        backdrop-filter:blur(12px);
        padding:18px;
        font-family:system-ui,-apple-system,"Segoe UI","Noto Sans Thai",sans-serif;
      }
      #gjBattleCountdownSyncOverlay .gjbcd-card{
        width:min(620px,92vw);
        border:4px solid #ffbd77;
        border-radius:34px;
        background:#fffdf4;
        box-shadow:0 22px 60px rgba(91,45,17,.24);
        padding:30px 22px;
        text-align:center;
        color:#87311b;
      }
      #gjBattleCountdownSyncOverlay .gjbcd-icon{
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
      #gjBattleCountdownSyncOverlay .gjbcd-title{
        font-size:clamp(30px,6vw,48px);
        line-height:1.18;
        font-weight:1000;
        margin-bottom:18px;
      }
      #gjBattleCountdownSyncOverlay .gjbcd-value{
        font-size:clamp(64px,16vw,130px);
        line-height:1;
        font-weight:1000;
      }
    `;
    document.head.appendChild(css);
    document.body.appendChild(el);

    return el;
  }

  function forceEnterGameplay(reason){
    if (localStarted) return;
    localStarted = true;

    console.info(LOG, 'enter gameplay', reason);

    if (overlay) overlay.style.display = 'none';

    hideOldOverlays();

    window.dispatchEvent(new CustomEvent('hha:battle:countdown-complete', {
      detail:{ roomId: ROOM, reason }
    }));

    window.dispatchEvent(new CustomEvent('hha:battle:start-gameplay', {
      detail:{ roomId: ROOM, reason }
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

    setTimeout(hideOldOverlays, 100);
    setTimeout(hideOldOverlays, 600);
    setTimeout(hideOldOverlays, 1200);
  }

  function hideOldOverlays(){
    const needles = [
      'เตรียมพร้อม Battle',
      'กำลังเตรียม Battle',
      'ลองเริ่มอีกครั้ง'
    ];

    Array.from(document.querySelectorAll('body *')).forEach(node => {
      if (node.id === 'gjBattleCountdownSyncOverlay') return;

      const text = (node.textContent || '').trim();
      if (!text) return;

      if (!needles.some(n => text.includes(n))) return;

      const box = findOverlayBox(node);
      if (box && box.id !== 'gjBattleCountdownSyncOverlay'){
        box.style.display = 'none';
        box.setAttribute('data-gj-hidden-by-countdown-sync', '1');
      }
    });
  }

  function findOverlayBox(el){
    let cur = el;
    for (let i = 0; i < 8 && cur && cur !== document.body; i++){
      const rect = cur.getBoundingClientRect();
      const cs = getComputedStyle(cur);
      if (
        rect.width > 220 &&
        rect.height > 140 &&
        (cs.position === 'fixed' || cs.position === 'absolute' || cs.position === 'relative')
      ){
        return cur;
      }
      cur = cur.parentElement;
    }
    return null;
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
