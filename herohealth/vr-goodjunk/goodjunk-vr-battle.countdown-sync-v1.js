/* =========================================================
   HeroHealth • GoodJunk Battle Countdown Sync
   FILE: /herohealth/vr-goodjunk/goodjunk-vr-battle.countdown-sync-v1.js
   PATCH: v20260514a

   Fix:
   - Guest/KK ค้างที่ countdown 3
   - Host เป็นคนเขียน countdown กลางลง Firebase
   - Guest อ่าน countdown จาก Firebase แล้วอัปเดต UI ตาม
   - ถ้า countdown จบ ให้ซ่อน overlay/เริ่ม gameplay ด้วย event fallback
   ========================================================= */

(() => {
  'use strict';

  const PATCH_ID = 'v20260514a-countdown-sync';
  if (window.__GJ_BATTLE_COUNTDOWN_SYNC__) return;
  window.__GJ_BATTLE_COUNTDOWN_SYNC__ = PATCH_ID;

  const params = new URLSearchParams(location.search);

  const ROOM = cleanRoom(params.get('roomId') || params.get('room') || '');
  const PID = clean(params.get('pid') || '');
  const ROLE = clean(params.get('role') || '');
  const IS_HOST = params.get('host') === '1' || ROLE === 'host';

  const LOG = '[GJ Battle Countdown Sync]';

  let db = null;
  let localStarted = false;
  let hostTickerStarted = false;
  let lastPhase = '';

  boot();

  async function boot(){
    if (!ROOM){
      console.warn(LOG, 'no room');
      return;
    }

    try{
      await waitForDb();

      console.info(LOG, 'loaded', {
        patch: PATCH_ID,
        room: ROOM,
        pid: PID,
        isHost: IS_HOST
      });

      listenCountdown();

      if (IS_HOST){
        setTimeout(() => {
          startHostCountdownOnce().catch(err => console.warn(LOG, err));
        }, 450);
      }

      // fallback: ถ้าห้อง started แล้วแต่ไม่มี countdown ให้ host สร้างใหม่
      setInterval(() => {
        checkAndRepairCountdown().catch(err => console.warn(LOG, err));
      }, 1200);

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

  function listenCountdown(){
    db.ref(`${roomPath(ROOM)}/battleCountdown`).on('value', snap => {
      const data = snap && snap.val ? snap.val() : null;
      if (!data) return;

      applyCountdown(data);
    });

    db.ref(roomPath(ROOM)).on('value', snap => {
      const room = snap && snap.val ? snap.val() : null;
      if (!room) return;

      const cd = room.battleCountdown || null;
      if (cd) applyCountdown(cd);

      const status = clean(room.status || '').toLowerCase();
      const phase = clean(room.phase || room.currentRun?.phase || '').toLowerCase();

      if ((status === 'playing' || phase === 'playing') && !localStarted){
        forceEnterGameplay('room-playing');
      }
    });
  }

  async function checkAndRepairCountdown(){
    if (!IS_HOST || hostTickerStarted) return;

    const room = await dbGet(roomPath(ROOM));
    if (!room) return;

    const status = clean(room.status || '').toLowerCase();
    const count =
      Number(room.activeCount || room.participantCount || room.expectedPlayers || 0) ||
      Object.keys(room.players || {}).length ||
      Object.keys(room.runtimePlayers || {}).length ||
      Object.keys(room.currentRun?.participants || {}).length;

    const cd = room.battleCountdown || null;
    const cdPhase = clean(cd?.phase || '').toLowerCase();

    if (
      count >= 2 &&
      (status === 'started' || status === 'waiting' || status === 'ready') &&
      cdPhase !== 'countdown' &&
      cdPhase !== 'playing'
    ){
      await startHostCountdownOnce();
    }
  }

  async function startHostCountdownOnce(){
    if (!IS_HOST || hostTickerStarted) return;
    hostTickerStarted = true;

    const room = await dbGet(roomPath(ROOM)).catch(() => null);
    const matchId =
      clean(room?.activeMatchId || '') ||
      clean(room?.currentRun?.matchId || '') ||
      clean(params.get('matchId') || '') ||
      `${ROOM}-R1`;

    const startedAt = Date.now();
    const base = {
      roomId: ROOM,
      matchId,
      phase: 'countdown',
      by: PID || 'host',
      startedAt,
      updatedAt: startedAt
    };

    console.info(LOG, 'host countdown start');

    await writeCountdown({
      ...base,
      value: 3,
      text: '3'
    });

    await sleep(950);
    await writeCountdown({
      ...base,
      value: 2,
      text: '2',
      updatedAt: Date.now()
    });

    await sleep(950);
    await writeCountdown({
      ...base,
      value: 1,
      text: '1',
      updatedAt: Date.now()
    });

    await sleep(950);
    await writeCountdown({
      ...base,
      value: 0,
      text: 'GO!',
      phase: 'go',
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

    const matchPathValue = matchPath(ROOM, matchId);
    await dbUpdate(matchPathValue, {
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

    if (phase === lastPhase && phase === 'playing') return;
    lastPhase = phase;

    if (phase === 'countdown' || phase === 'go'){
      patchCountdownText(text, phase);
      showOverlay();
      return;
    }

    if (phase === 'playing'){
      forceEnterGameplay('countdown-listener-playing');
    }
  }

  function patchCountdownText(text, phase){
    const safeText = text || '3';

    replaceText(/รอบที่\s*\d+\s*•\s*เตรียมพร้อม\s*Battle\s*\d+\/\d+/g, 'รอบที่ 1 • เตรียมพร้อม Battle 2/2');
    replaceText(/\b[321]\b/g, safeText);

    // หาเลขใหญ่กลาง overlay แล้วเปลี่ยนโดยตรง
    const candidates = Array.from(document.querySelectorAll('h1,h2,h3,div,span,p,strong,b'))
      .filter(el => {
        const t = (el.textContent || '').trim();
        return t === '3' || t === '2' || t === '1' || t === 'GO!' || t === '0';
      });

    candidates.forEach(el => {
      el.textContent = safeText;
    });

    if (phase === 'go'){
      setTimeout(() => forceEnterGameplay('go-timeout'), 450);
    }
  }

  function showOverlay(){
    // ไม่ต้องทำมาก แค่กันกรณี overlay ถูกซ่อน
    document.body.classList.remove('battle-playing');
  }

  function forceEnterGameplay(reason){
    if (localStarted) return;
    localStarted = true;

    console.info(LOG, 'force enter gameplay', reason);

    hideCountdownOverlay();

    window.dispatchEvent(new CustomEvent('hha:battle:countdown-complete', {
      detail:{ roomId: ROOM, reason }
    }));

    window.dispatchEvent(new CustomEvent('hha:battle:start-gameplay', {
      detail:{ roomId: ROOM, reason }
    }));

    document.dispatchEvent(new CustomEvent('hha:battle:countdown-complete', {
      detail:{ roomId: ROOM, reason }
    }));

    // พยายามเรียกฟังก์ชันเริ่มเกมที่อาจมีอยู่ใน runtime เดิม
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
        if (typeof window[fn] === 'function'){
          window[fn]();
        }
      }catch(err){
        console.warn(LOG, `call ${fn} failed`, err);
      }
    });

    // fallback: คลิกปุ่ม/ซ่อน modal ที่เป็น overlay รอเริ่ม
    setTimeout(hideCountdownOverlay, 120);
    setTimeout(hideCountdownOverlay, 600);
    setTimeout(hideCountdownOverlay, 1200);
  }

  function hideCountdownOverlay(){
    document.body.classList.add('battle-playing');

    const textNeedles = [
      'เตรียมพร้อม Battle',
      'กำลังเตรียม Battle',
      'ลองเริ่มอีกครั้ง'
    ];

    const all = Array.from(document.querySelectorAll('body *'));

    all.forEach(el => {
      const t = (el.textContent || '').trim();

      if (!t) return;

      const hit = textNeedles.some(n => t.includes(n));

      if (hit){
        const box = findOverlayBox(el);
        if (box){
          box.style.display = 'none';
          box.setAttribute('data-countdown-hidden', '1');
        }
      }
    });
  }

  function findOverlayBox(el){
    let cur = el;
    for (let i = 0; i < 8 && cur && cur !== document.body; i++){
      const cs = getComputedStyle(cur);
      const rect = cur.getBoundingClientRect();

      if (
        rect.width > 220 &&
        rect.height > 150 &&
        (cs.position === 'fixed' || cs.position === 'absolute' || cs.position === 'relative')
      ){
        return cur;
      }

      cur = cur.parentElement;
    }

    return el.closest('[role="dialog"], .modal, .overlay, .dialog, .start, .countdown') || null;
  }

  function replaceText(pattern, replacement){
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node){
          const text = node.nodeValue || '';
          pattern.lastIndex = 0;
          return pattern.test(text)
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT;
        }
      }
    );

    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    nodes.forEach(node => {
      node.nodeValue = String(node.nodeValue || '').replace(pattern, replacement);
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
