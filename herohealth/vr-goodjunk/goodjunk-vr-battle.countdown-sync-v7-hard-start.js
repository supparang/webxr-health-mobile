/* =========================================================
   HeroHealth • GoodJunk Battle Countdown Sync v7 Hard Start
   FILE: /herohealth/vr-goodjunk/goodjunk-vr-battle.countdown-sync-v7-hard-start.js
   PATCH: v20260514j

   Fix:
   - KK ไม่เดิน countdown 3 2 1
   - KK ค้างหน้า "รอบที่ 1 • เตรียมพร้อม Battle 2/2"
   - ซ่อน overlay เดิมทุกชนิด
   - ถ้าพบผู้เล่นครบ 2 คน ให้ force start gameplay ทันที
   ========================================================= */

(() => {
  'use strict';

  const PATCH_ID = 'v20260514j-countdown-sync-v7-hard-start';

  if (window.__GJ_BATTLE_COUNTDOWN_SYNC_V7__) return;
  window.__GJ_BATTLE_COUNTDOWN_SYNC_V7__ = PATCH_ID;

  const qs = new URLSearchParams(location.search);

  const ROOM = cleanRoom(qs.get('roomId') || qs.get('room') || '');
  const PID = clean(qs.get('pid') || '');
  const URL_HOST_PID = clean(qs.get('hostPid') || '');

  const LOG = '[GJ Battle Countdown Sync v7 Hard Start]';

  let db = null;
  let auth = null;
  let localStarted = false;
  let readySince = 0;
  let timer = null;
  let observer = null;

  boot();

  async function boot(){
    console.info(LOG, 'loaded', {
      patch: PATCH_ID,
      room: ROOM,
      pid: PID,
      hostPid: URL_HOST_PID
    });

    try{
      await waitForDb();
    }catch(err){
      console.warn(LOG, 'Firebase wait failed; DOM fallback still active', err);
    }

    listenRoom();

    timer = setInterval(tick, 350);

    observer = new MutationObserver(() => {
      tick();
    });

    if (document.body){
      observer.observe(document.body, {
        childList:true,
        subtree:true,
        characterData:true
      });
    }

    window.addEventListener('pagehide', () => {
      if (timer) clearInterval(timer);
      if (observer) observer.disconnect();
    });

    tick();
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
      await sleep(200);
    }
    throw new Error('Firebase not ready');
  }

  function listenRoom(){
    if (!db || !ROOM) return;

    db.ref(roomPath(ROOM)).on('value', snap => {
      const room = snap && snap.val ? snap.val() : null;
      handleRoom(room, 'listener').catch(err => console.warn(LOG, err));
    });
  }

  async function tick(){
    if (localStarted) return;

    const text = bodyText();

    const hasBattleReady =
      /Battle\s*2\/2/i.test(text) ||
      /เตรียมพร้อม\s*Battle\s*2\/2/i.test(text) ||
      /กำลังเตรียม\s*Battle\s*2\/2/i.test(text) ||
      /รอบที่\s*1\s*•\s*เตรียมพร้อม/i.test(text);

    const hasOldWaiting =
      /รอผู้เล่นอีก/i.test(text) ||
      /ลองเริ่มอีกครั้ง/i.test(text) ||
      /กลับ\s*Lobby/i.test(text);

    if (hasBattleReady || hasOldWaiting){
      if (!readySince) readySince = Date.now();

      // แสดง mini countdown ของเราเองทับสั้น ๆ
      const waited = Date.now() - readySince;

      if (waited < 450){
        showMiniCountdown('3');
      }else if (waited < 850){
        showMiniCountdown('2');
      }else if (waited < 1200){
        showMiniCountdown('1');
      }else if (waited < 1450){
        showMiniCountdown('GO!');
      }else{
        await hardStart('dom-battle-ready');
      }
    }

    if (db && ROOM){
      const room = await db.ref(roomPath(ROOM)).get().then(s => s.val()).catch(() => null);
      await handleRoom(room, 'tick');
    }
  }

  async function handleRoom(room, reason){
    if (localStarted || !room) return;

    const count = getPlayerCount(room);
    const status = clean(room.status || '').toLowerCase();
    const phase = clean(room.phase || room.currentRun?.phase || '').toLowerCase();
    const cdPhase = clean(room.battleCountdown?.phase || '').toLowerCase();

    const shouldStart =
      count >= 2 &&
      (
        status === 'started' ||
        status === 'running' ||
        status === 'playing' ||
        status === 'waiting' ||
        phase === 'started' ||
        phase === 'countdown' ||
        phase === 'playing' ||
        cdPhase === 'countdown' ||
        cdPhase === 'go' ||
        cdPhase === 'playing'
      );

    if (!shouldStart) return;

    if (!readySince) readySince = Date.now();

    const waited = Date.now() - readySince;

    if (cdPhase === 'countdown'){
      const v = clean(room.battleCountdown?.text || String(room.battleCountdown?.value || '3'));
      showMiniCountdown(v);
    }else if (cdPhase === 'go'){
      showMiniCountdown('GO!');
    }else{
      showMiniCountdown(waited < 500 ? '3' : waited < 900 ? '2' : waited < 1250 ? '1' : 'GO!');
    }

    if (waited > 1400 || status === 'playing' || phase === 'playing' || cdPhase === 'playing'){
      await hardStart(`room-${reason}-${status}-${phase}-${cdPhase}`);
    }
  }

  async function hardStart(reason){
    if (localStarted) return;
    localStarted = true;

    console.warn(LOG, 'HARD START', reason);

    hideMiniCountdown();
    hardHideOldOverlays();

    await markStarted(reason).catch(() => {});

    const detail = {
      roomId:ROOM,
      pid:PID,
      reason,
      patch:PATCH_ID,
      at:Date.now()
    };

    window.dispatchEvent(new CustomEvent('hha:battle:countdown-complete', { detail }));
    window.dispatchEvent(new CustomEvent('hha:battle:start-gameplay', { detail }));
    window.dispatchEvent(new CustomEvent('hha:battle:hard-start', { detail }));
    window.dispatchEvent(new CustomEvent('hha:game:start', { detail }));

    document.dispatchEvent(new CustomEvent('hha:battle:countdown-complete', { detail }));
    document.dispatchEvent(new CustomEvent('hha:battle:start-gameplay', { detail }));
    document.dispatchEvent(new CustomEvent('hha:battle:hard-start', { detail }));
    document.dispatchEvent(new CustomEvent('hha:game:start', { detail }));

    callStartFunctions(detail);

    setTimeout(() => {
      hardHideOldOverlays();
      callStartFunctions(detail);
    }, 120);

    setTimeout(() => {
      hardHideOldOverlays();
      callStartFunctions(detail);
    }, 500);

    setTimeout(() => {
      hardHideOldOverlays();
    }, 1200);
  }

  function callStartFunctions(detail){
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
      'play',
      'start'
    ].forEach(fn => {
      try{
        if (typeof window[fn] === 'function'){
          window[fn](detail);
        }
      }catch(err){
        console.warn(LOG, `call ${fn} failed`, err);
      }
    });

    // กดปุ่มที่มีข้อความเริ่ม/ลองเริ่มอีกครั้ง เผื่อ runtime ผูก event ไว้กับปุ่ม
    const buttons = Array.from(document.querySelectorAll('button,a,[role="button"]'));
    buttons.forEach(btn => {
      const t = clean(btn.textContent || '');
      if (/เริ่ม|ลองเริ่ม|Start|Play|Battle/i.test(t)){
        try{ btn.click(); }catch(_){}
      }
    });
  }

  async function markStarted(reason){
    if (!db || !ROOM) return;

    const t = Date.now();
    const room = await db.ref(roomPath(ROOM)).get().then(s => s.val()).catch(() => null);

    const matchId =
      clean(room?.activeMatchId || '') ||
      clean(room?.currentRun?.matchId || '') ||
      clean(qs.get('matchId') || '') ||
      `${ROOM}-R1`;

    await db.ref(roomPath(ROOM)).update({
      status:'playing',
      phase:'playing',
      updatedAt:t,

      'currentRun/status':'playing',
      'currentRun/phase':'playing',
      'currentRun/playAt':t,

      [`guestStartSignals/${safeKey(PID || 'guest')}`]: {
        pid:PID || 'guest',
        matchId,
        state:'hard-start',
        reason,
        at:t
      }
    }).catch(() => {});

    await db.ref(matchPath(ROOM, matchId)).update({
      status:'playing',
      phase:'playing',
      playAt:t,
      updatedAt:t
    }).catch(() => {});
  }

  function showMiniCountdown(value){
    const el = ensureMiniCountdown();
    el.querySelector('[data-value]').textContent = value;
    el.style.display = 'grid';
    hardHideOldOverlays(false);
  }

  function hideMiniCountdown(){
    const el = document.getElementById('gjBattleHardStartOverlay');
    if (el) el.style.display = 'none';
  }

  function ensureMiniCountdown(){
    let el = document.getElementById('gjBattleHardStartOverlay');
    if (el) return el;

    el = document.createElement('div');
    el.id = 'gjBattleHardStartOverlay';
    el.innerHTML = `
      <div class="gjhs-card">
        <div class="gjhs-icon">⚔️</div>
        <div class="gjhs-title">Battle พร้อมแล้ว</div>
        <div class="gjhs-value" data-value>3</div>
        <div class="gjhs-note">กำลังเข้าเกม...</div>
      </div>
    `;

    const css = document.createElement('style');
    css.textContent = `
      #gjBattleHardStartOverlay{
        position:fixed;
        inset:0;
        z-index:2147483600;
        display:grid;
        place-items:center;
        padding:18px;
        background:rgba(132,82,48,.42);
        backdrop-filter:blur(12px);
        font-family:system-ui,-apple-system,"Segoe UI","Noto Sans Thai",sans-serif;
      }
      #gjBattleHardStartOverlay .gjhs-card{
        width:min(580px,92vw);
        border:4px solid #ffbd77;
        border-radius:34px;
        background:#fffdf4;
        box-shadow:0 22px 60px rgba(91,45,17,.24);
        padding:28px 20px;
        text-align:center;
        color:#87311b;
      }
      #gjBattleHardStartOverlay .gjhs-icon{
        width:92px;
        height:92px;
        margin:0 auto 14px;
        border-radius:28px;
        display:grid;
        place-items:center;
        font-size:44px;
        background:linear-gradient(180deg,#fff2dd,#ffd6a0);
        border:4px solid #ffbd77;
      }
      #gjBattleHardStartOverlay .gjhs-title{
        font-size:clamp(28px,6vw,44px);
        line-height:1.15;
        font-weight:1000;
      }
      #gjBattleHardStartOverlay .gjhs-value{
        margin-top:12px;
        font-size:clamp(68px,18vw,132px);
        line-height:1;
        font-weight:1000;
      }
      #gjBattleHardStartOverlay .gjhs-note{
        margin-top:10px;
        color:#8a5a00;
        font-size:16px;
        font-weight:900;
      }
    `;

    document.head.appendChild(css);
    document.body.appendChild(el);

    return el;
  }

  function hardHideOldOverlays(includeSelf = true){
    const needles = [
      'กำลังเตรียม Battle',
      'เตรียมพร้อม Battle',
      'รอผู้เล่นอีก',
      'ลองเริ่มอีกครั้ง',
      'กลับ Lobby',
      'Battle 1/2',
      'Battle 2/2'
    ];

    const all = Array.from(document.querySelectorAll('body *'));

    all.forEach(node => {
      if (includeSelf === false && node.id === 'gjBattleHardStartOverlay') return;
      if (node.closest && node.closest('#gjBattleHardStartOverlay')) return;

      const text = clean(node.textContent || '');
      if (!text) return;
      if (!needles.some(n => text.includes(n))) return;

      const box = findOverlayBox(node);
      if (box && box !== document.body && !box.closest('#gjBattleHardStartOverlay')){
        box.style.display = 'none';
        box.style.pointerEvents = 'none';
        box.setAttribute('data-hidden-by-hard-start-v7', '1');
      }
    });
  }

  function findOverlayBox(node){
    let cur = node;

    for (let i = 0; i < 12 && cur && cur !== document.body; i++){
      const rect = cur.getBoundingClientRect();
      const cs = getComputedStyle(cur);

      const looksLikeOverlay =
        cs.position === 'fixed' ||
        Number(cs.zIndex || 0) > 10 ||
        rect.width > 260 && rect.height > 160;

      if (looksLikeOverlay){
        return cur;
      }

      cur = cur.parentElement;
    }

    return node.closest('[role="dialog"], .modal, .overlay, .dialog, .countdown, .start, .card') || null;
  }

  function getPlayerCount(room){
    if (!room) return 0;

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

  function roomPath(roomId){
    return `hha-battle/goodjunk/battleRooms/${safeKey(roomId)}`;
  }

  function matchPath(roomId, matchId){
    return `${roomPath(roomId)}/matches/${safeKey(matchId)}`;
  }

  function bodyText(){
    return document.body ? String(document.body.innerText || document.body.textContent || '') : '';
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
