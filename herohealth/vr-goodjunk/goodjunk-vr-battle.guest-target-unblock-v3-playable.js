/* =========================================================
   HeroHealth • GoodJunk Battle Guest Target Unblock v3 Playable
   FILE: /herohealth/vr-goodjunk/goodjunk-vr-battle.guest-target-unblock-v3-playable.js
   PATCH: v20260514n

   Fix:
   - KK เห็นเป้า fallback แล้ว แต่ค้าง / แตะไม่ติด / คะแนนไม่ขึ้น
   - v3 ทำ playable loop เองครบ:
     1) spawn เติมเอง
     2) pointer/touch/click capture
     3) timer ของ Guest fallback เอง
     4) เขียนคะแนน Firebase
     5) จบแล้วขึ้น Summary เอง
   ========================================================= */

(() => {
  'use strict';

  const PATCH_ID = 'v20260514n-guest-target-unblock-v3-playable';

  if (window.__GJ_BATTLE_GUEST_TARGET_UNBLOCK_V3__) return;
  window.__GJ_BATTLE_GUEST_TARGET_UNBLOCK_V3__ = PATCH_ID;

  const qs = new URLSearchParams(location.search);

  const ROOM = cleanRoom(qs.get('roomId') || qs.get('room') || '');
  const PID = clean(qs.get('pid') || '');
  const NAME = clean(qs.get('name') || qs.get('nick') || 'Player');
  const URL_MATCH = clean(qs.get('matchId') || '');
  const GAME_SEC = clamp(Number(qs.get('time') || 90), 30, 240);

  const LOG = '[GJ Battle Guest Target Unblock v3]';

  const GOOD = ['🍎','🍌','🥕','🥦','🍚','🥚','🥛','🐟','🍊','🥬'];
  const JUNK = ['🍟','🥤','🍩','🍬','🍔','🍕','🧁'];
  const POWER = ['⚡','🛡️','💎'];

  const TARGET_MAX = 5;

  let db = null;
  let auth = null;

  let started = false;
  let stopped = false;
  let finished = false;

  let watchTimer = null;
  let gameTimer = null;
  let progressTimer = null;

  let roundStartAt = 0;
  let seq = 0;
  let lastSpawnAt = 0;
  let lastWriteAt = 0;

  const targets = new Map();

  const state = {
    score: 0,
    combo: 0,
    best: 0,
    heart: 3,
    attack: 0,
    good: 0,
    junk: 0,
    miss: 0,
    startedAt: 0,
    updatedAt: 0
  };

  boot();

  function boot(){
    console.info(LOG, 'loaded', {
      patch: PATCH_ID,
      room: ROOM,
      pid: PID,
      name: NAME,
      gameSec: GAME_SEC
    });

    waitForDb().catch(err => {
      console.warn(LOG, 'Firebase optional wait failed', err);
    });

    installCapture();

    window.addEventListener('hha:battle:start-gameplay', () => maybeStart('event-start-gameplay'));
    document.addEventListener('hha:battle:start-gameplay', () => maybeStart('doc-start-gameplay'));

    watchTimer = setInterval(() => maybeStart('watch'), 300);

    setTimeout(() => maybeStart('boot-600'), 600);
    setTimeout(() => maybeStart('boot-1200'), 1200);
    setTimeout(() => maybeStart('boot-2000'), 2000);

    window.addEventListener('pagehide', () => {
      writeProgress(true).catch(() => {});
      cleanup();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) writeProgress(true).catch(() => {});
    });
  }

  async function waitForDb(){
    for (let i = 0; i < 60; i++){
      if (window.HHA_FIREBASE_READY){
        const fb = await window.HHA_FIREBASE_READY;
        if (fb && fb.db && fb.auth && fb.auth.currentUser){
          db = fb.db;
          auth = fb.auth;
          console.info(LOG, 'Firebase ready', { uid: auth.currentUser.uid });
          return;
        }
      }
      await sleep(200);
    }
  }

  function installCapture(){
    const opts = { capture:true, passive:false };

    window.addEventListener('pointerdown', capturePointer, opts);
    window.addEventListener('pointerup', capturePointer, opts);
    window.addEventListener('click', capturePointer, opts);
    window.addEventListener('touchstart', captureTouch, opts);
    window.addEventListener('touchend', captureTouch, opts);

    document.addEventListener('pointerdown', capturePointer, opts);
    document.addEventListener('pointerup', capturePointer, opts);
    document.addEventListener('click', capturePointer, opts);
    document.addEventListener('touchstart', captureTouch, opts);
    document.addEventListener('touchend', captureTouch, opts);
  }

  function maybeStart(reason){
    if (started || stopped || finished) return;

    const text = bodyText();

    if (isSummary(text)) return;

    const gameplay =
      /GoodJunk Battle/i.test(text) &&
      (
        /SCORE/i.test(text) ||
        /COMBO/i.test(text) ||
        /HEART/i.test(text) ||
        /ATTACK/i.test(text)
      ) &&
      !/กำลังเตรียม Battle/i.test(text) &&
      !/เตรียมพร้อม Battle/i.test(text);

    const oldFallbackVisible =
      document.getElementById('gjGuestTargetLayer') ||
      document.getElementById('gjGuestTargetLayerV2') ||
      /Guest Fallback/i.test(text);

    if (!gameplay && !oldFallbackVisible) return;

    startPlayableFallback(reason);
  }

  function startPlayableFallback(reason){
    if (started || stopped || finished) return;
    started = true;

    console.warn(LOG, 'START PLAYABLE FALLBACK v3', reason);

    removeOldFallbacks();

    state.startedAt = Date.now();
    state.updatedAt = Date.now();
    roundStartAt = Date.now();

    ensureLayer();
    ensureHud();
    updateHud();

    for (let i = 0; i < TARGET_MAX; i++){
      spawnTarget();
    }

    gameTimer = setInterval(gameLoop, 180);
    progressTimer = setInterval(() => writeProgress(false).catch(() => {}), 900);

    markRoomPlaying().catch(() => {});

    window.dispatchEvent(new CustomEvent('hha:battle:guest-target-fallback-v3-start', {
      detail:{ roomId:ROOM, pid:PID, name:NAME, patch:PATCH_ID, reason }
    }));
  }

  function gameLoop(){
    if (stopped || finished) return;

    const remain = remainingSec();

    if (remain <= 0){
      finishGame('guest-fallback-v3-timeout');
      return;
    }

    expireTargets();

    while (targets.size < TARGET_MAX){
      spawnTarget();
    }

    const now = Date.now();
    if (targets.size < TARGET_MAX + 1 && now - lastSpawnAt > spawnInterval()){
      spawnTarget();
      lastSpawnAt = now;
    }

    updateHud();
    updateExportStats();
  }

  function spawnTarget(){
    if (stopped || finished) return;

    const layer = ensureLayer();
    const area = playArea();

    seq += 1;

    const roll = Math.random();

    let kind = 'good';
    let emoji = pick(GOOD);

    if (roll > 0.72 && roll <= 0.90){
      kind = 'junk';
      emoji = pick(JUNK);
    }else if (roll > 0.90){
      kind = 'power';
      emoji = pick(POWER);
    }

    const size = rand(66, 88);
    const x = rand(area.left + 10, Math.max(area.left + 12, area.right - size - 10));
    const y = rand(area.top + 10, Math.max(area.top + 12, area.bottom - size - 10));

    const id = `gt3-${seq}-${Date.now()}`;

    const el = document.createElement('button');
    el.type = 'button';
    el.className = `gjgt3-target ${kind}`;
    el.dataset.gjgt3 = '1';
    el.dataset.id = id;
    el.dataset.kind = kind;
    el.textContent = emoji;

    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;

    const life = kind === 'junk' ? 3000 : 2600;

    targets.set(id, {
      id,
      el,
      kind,
      emoji,
      bornAt: Date.now(),
      expiresAt: Date.now() + life,
      collected: false
    });

    const collect = ev => {
      if (ev) {
        ev.preventDefault();
        ev.stopPropagation();
      }
      collectTarget(id, 'direct-target-event');
    };

    el.addEventListener('pointerdown', collect, { passive:false });
    el.addEventListener('pointerup', collect, { passive:false });
    el.addEventListener('click', collect, { passive:false });
    el.addEventListener('touchstart', collect, { passive:false });
    el.addEventListener('touchend', collect, { passive:false });

    layer.appendChild(el);

    requestAnimationFrame(() => el.classList.add('show'));
  }

  function expireTargets(){
    const now = Date.now();

    for (const [id, t] of targets.entries()){
      if (!t || t.collected) continue;

      if (now >= t.expiresAt){
        if (t.kind === 'good'){
          state.miss += 1;
          state.combo = 0;
        }
        removeTarget(id, 'expired');
      }
    }
  }

  function captureTouch(ev){
    if (!started || stopped || finished) return;

    const touch =
      ev.changedTouches && ev.changedTouches[0] ||
      ev.touches && ev.touches[0];

    if (!touch) return;

    captureAt(touch.clientX, touch.clientY, ev);
  }

  function capturePointer(ev){
    if (!started || stopped || finished) return;

    if (typeof ev.clientX !== 'number' || typeof ev.clientY !== 'number') return;

    captureAt(ev.clientX, ev.clientY, ev);
  }

  function captureAt(x, y, ev){
    const hit = findTargetAt(x, y);

    if (!hit) return;

    ev.preventDefault();
    ev.stopPropagation();

    collectTarget(hit.id, 'global-capture');
  }

  function findTargetAt(x, y){
    let best = null;
    let bestDist = Infinity;

    for (const t of targets.values()){
      if (!t || !t.el || !t.el.isConnected || t.collected) continue;

      const r = t.el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;

      const pad = 34;

      const inside =
        x >= r.left - pad &&
        x <= r.right + pad &&
        y >= r.top - pad &&
        y <= r.bottom + pad;

      if (!inside) continue;

      const dist = Math.hypot(x - cx, y - cy);

      if (dist < bestDist){
        best = t;
        bestDist = dist;
      }
    }

    return best;
  }

  function collectTarget(id, reason){
    const t = targets.get(id);

    if (!t || t.collected) return;

    t.collected = true;

    applyTarget(t.kind, t.emoji, reason);
    removeTarget(id, 'collected');

    if (targets.size < TARGET_MAX){
      setTimeout(spawnTarget, 80);
    }
  }

  function applyTarget(kind, emoji, reason){
    state.updatedAt = Date.now();

    if (kind === 'good'){
      state.good += 1;
      state.combo += 1;
      state.best = Math.max(state.best, state.combo);

      const bonus = Math.min(15, state.combo);
      state.score += 10 + bonus;

      if (state.good % 4 === 0){
        state.attack = Math.min(3, state.attack + 1);
      }

      feedback('+Good', 'good', 620);
    }

    if (kind === 'junk'){
      state.junk += 1;
      state.miss += 1;
      state.combo = 0;
      state.score = Math.max(0, state.score - 10);
      state.heart = Math.max(0, state.heart - 1);

      feedback('-Junk', 'bad', 180);

      if (state.heart <= 0){
        finishGame('guest-fallback-v3-heart-zero');
        return;
      }
    }

    if (kind === 'power'){
      if (emoji === '🛡️'){
        state.heart = Math.min(3, state.heart + 1);
        feedback('Shield +1', 'power', 820);
      }else{
        state.attack = Math.min(3, state.attack + 1);
        feedback('Attack +1', 'power', 820);
      }

      state.score += 5;
    }

    updateHud();
    updateExportStats();

    writeProgress(false).catch(() => {});

    window.HHA_GJ_BATTLE_LOCAL_STATE = {
      ...state,
      roomId: ROOM,
      pid: PID,
      name: NAME,
      patch: PATCH_ID,
      fallbackTargets: true
    };
  }

  function removeTarget(id, reason){
    const t = targets.get(id);
    if (!t) return;

    targets.delete(id);

    if (t.el && t.el.isConnected){
      t.el.classList.add(reason === 'collected' ? 'hit' : 'missed');

      setTimeout(() => {
        try { t.el.remove(); } catch (_) {}
      }, 150);
    }
  }

  function updateHud(){
    const hud = ensureHud();

    setText(hud, '[data-time]', remainingSec());
    setText(hud, '[data-score]', state.score);
    setText(hud, '[data-combo]', state.combo);
    setText(hud, '[data-heart]', state.heart > 0 ? '❤️'.repeat(state.heart) : '—');
    setText(hud, '[data-attack]', `${state.attack}/3`);
    setText(hud, '[data-good]', state.good);
    setText(hud, '[data-junk]', state.junk);
    setText(hud, '[data-miss]', state.miss);
    setText(hud, '[data-targets]', targets.size);
  }

  function updateExportStats(){
    let el = document.getElementById('gjGuestStatsExportV3');

    if (!el){
      el = document.createElement('div');
      el.id = 'gjGuestStatsExportV3';
      el.setAttribute('aria-hidden','true');
      el.style.position = 'fixed';
      el.style.left = '-99999px';
      el.style.top = '-99999px';
      el.style.width = '1px';
      el.style.height = '1px';
      el.style.overflow = 'hidden';
      document.body.appendChild(el);
    }

    el.textContent = [
      'GJ_GUEST_FALLBACK_STATS_V3',
      'PLAYER',
      NAME,
      'SCORE',
      String(state.score),
      'COMBO',
      String(state.combo),
      'HEART',
      String(state.heart),
      'ATTACK',
      `${state.attack}/3`,
      'GOOD',
      String(state.good),
      'JUNK',
      String(state.junk),
      'MISS',
      String(state.miss),
      'TIME',
      String(remainingSec())
    ].join('\n');
  }

  async function markRoomPlaying(){
    if (!db || !ROOM) return;

    const now = Date.now();

    await db.ref(roomPath(ROOM)).update({
      status:'playing',
      phase:'playing',
      updatedAt:now,
      [`guestPlayableSignals/${safeKey(PID || 'guest')}`]: {
        pid: PID || 'guest',
        name: NAME,
        state:'playable-fallback-v3',
        patch: PATCH_ID,
        at: now
      }
    }).catch(() => {});
  }

  async function writeProgress(force){
    if (!db || !ROOM) return;

    const now = Date.now();

    if (!force && now - lastWriteAt < 650) return;
    lastWriteAt = now;

    const room = await db.ref(roomPath(ROOM)).get().then(s => s.val()).catch(() => null);

    const matchId =
      URL_MATCH ||
      clean(room?.activeMatchId || '') ||
      clean(room?.currentRun?.matchId || '') ||
      `${ROOM}-R1`;

    const key = safeKey(PID || 'guest');

    const payload = {
      roomId: ROOM,
      matchId,
      pid: PID || 'guest',
      name: NAME || 'Guest',

      score: Number(state.score || 0),
      combo: Number(state.combo || 0),
      bestStreak: Number(state.best || 0),
      heart: Number(state.heart || 0),
      attack: Number(state.attack || 0),
      good: Number(state.good || 0),
      junk: Number(state.junk || 0),
      miss: Number(state.miss || 0),
      timeLeft: remainingSec(),

      finished: !!finished,
      fallbackTargets: true,
      patch: PATCH_ID,
      updatedAt: now
    };

    await db.ref(roomPath(ROOM)).update({
      updatedAt: now,
      [`progress/${key}`]: payload,
      [`runtimeScores/${key}`]: payload,
      [`currentRun/progress/${key}`]: payload,
      [`currentRun/runtimeScores/${key}`]: payload
    }).catch(() => {});

    await db.ref(matchPath(ROOM, matchId)).update({
      updatedAt: now,
      [`progress/${key}`]: payload,
      [`runtimeScores/${key}`]: payload
    }).catch(() => {});
  }

  async function finishGame(reason){
    if (finished) return;
    finished = true;
    stopped = true;

    console.warn(LOG, 'FINISH PLAYABLE FALLBACK v3', reason, state);

    cleanupTimersOnly();

    await writeProgress(true).catch(() => {});

    window.dispatchEvent(new CustomEvent('hha:battle:finish', {
      detail:{ ...state, roomId:ROOM, pid:PID, name:NAME, reason, patch:PATCH_ID }
    }));

    showSummary(reason);
  }

  function showSummary(reason){
    let old = document.getElementById('gjGuestFallbackSummaryV3');
    if (old) old.remove();

    const box = document.createElement('div');
    box.id = 'gjGuestFallbackSummaryV3';
    box.innerHTML = `
      <div class="gjgfs-card">
        <div class="gjgfs-icon">🏁</div>
        <h1>จบ Battle!</h1>
        <div class="gjgfs-note">ผลฝั่ง ${escapeHtml(NAME)} • ${escapeHtml(reason)}</div>

        <div class="gjgfs-grid">
          <div><b>${state.score}</b><span>Score</span></div>
          <div><b>${state.combo}</b><span>Combo</span></div>
          <div><b>${state.good}</b><span>Good</span></div>
          <div><b>${state.junk}</b><span>Junk</span></div>
          <div><b>${state.miss}</b><span>Miss</span></div>
          <div><b>${state.attack}/3</b><span>Attack</span></div>
        </div>

        <div class="gjgfs-actions">
          <button type="button" data-again>🔁 Battle อีกครั้ง</button>
          <button type="button" data-lobby>⚔️ กลับ Lobby</button>
          <button type="button" data-hub>🏠 Hub</button>
        </div>
      </div>
    `;

    const css = document.createElement('style');
    css.textContent = `
      #gjGuestFallbackSummaryV3{
        position:fixed;
        inset:0;
        z-index:2147484100;
        display:grid;
        place-items:center;
        padding:18px;
        background:rgba(132,82,48,.50);
        backdrop-filter:blur(13px);
        font-family:system-ui,-apple-system,"Segoe UI","Noto Sans Thai",sans-serif;
      }
      #gjGuestFallbackSummaryV3 .gjgfs-card{
        width:min(720px,94vw);
        border:4px solid #ffbd77;
        border-radius:34px;
        background:#fffdf4;
        box-shadow:0 22px 60px rgba(91,45,17,.26);
        padding:24px 18px;
        color:#87311b;
        text-align:center;
      }
      #gjGuestFallbackSummaryV3 .gjgfs-icon{
        width:82px;
        height:82px;
        margin:0 auto 10px;
        display:grid;
        place-items:center;
        border-radius:26px;
        border:4px solid #ffbd77;
        background:linear-gradient(180deg,#fff2dd,#ffd6a0);
        font-size:40px;
      }
      #gjGuestFallbackSummaryV3 h1{
        margin:0;
        font-size:clamp(34px,7vw,54px);
        line-height:1.1;
        font-weight:1000;
      }
      #gjGuestFallbackSummaryV3 .gjgfs-note{
        margin:12px 0;
        padding:11px;
        border:3px dashed #ffbd77;
        border-radius:20px;
        font-weight:1000;
        color:#8a5a00;
      }
      #gjGuestFallbackSummaryV3 .gjgfs-grid{
        display:grid;
        grid-template-columns:repeat(3,1fr);
        gap:10px;
        margin-top:12px;
      }
      #gjGuestFallbackSummaryV3 .gjgfs-grid div{
        border:3px solid #ffcf93;
        border-radius:18px;
        padding:12px;
        background:#fffaf0;
      }
      #gjGuestFallbackSummaryV3 .gjgfs-grid b{
        display:block;
        font-size:28px;
      }
      #gjGuestFallbackSummaryV3 .gjgfs-grid span{
        display:block;
        font-size:13px;
        font-weight:900;
      }
      #gjGuestFallbackSummaryV3 .gjgfs-actions{
        display:flex;
        gap:10px;
        flex-wrap:wrap;
        margin-top:16px;
      }
      #gjGuestFallbackSummaryV3 button{
        flex:1 1 170px;
        min-height:52px;
        border-radius:18px;
        border:3px solid #ffbd77;
        background:#fff;
        color:#87311b;
        font-size:16px;
        font-weight:1000;
      }
    `;

    document.head.appendChild(css);
    document.body.appendChild(box);

    box.querySelector('[data-again]').addEventListener('click', () => location.reload());

    box.querySelector('[data-lobby]').addEventListener('click', () => {
      const u = new URL('./goodjunk-battle-lobby.html', location.href);
      ['pid','name','nick','diff','time','view','hub','zone','cat','game','gameId','theme','room','roomId'].forEach(k => {
        const v = qs.get(k);
        if (v) u.searchParams.set(k, v);
      });
      u.searchParams.set('mode','battle');
      u.searchParams.set('entry','battle');
      location.href = u.toString();
    });

    box.querySelector('[data-hub]').addEventListener('click', () => {
      location.href = qs.get('hub') || '../nutrition-zone.html';
    });
  }

  function ensureLayer(){
    let layer = document.getElementById('gjGuestTargetLayerV3');
    if (layer) return layer;

    layer = document.createElement('div');
    layer.id = 'gjGuestTargetLayerV3';

    const css = document.createElement('style');
    css.textContent = `
      #gjGuestTargetLayerV3{
        position:fixed;
        inset:0;
        z-index:2147483900;
        pointer-events:none;
        overflow:hidden;
        font-family:system-ui,-apple-system,"Segoe UI","Noto Sans Thai",sans-serif;
      }

      #gjGuestTargetLayerV3 .gjgt3-target{
        position:fixed;
        border:6px solid #72e98a;
        border-radius:30px;
        background:linear-gradient(180deg,#ffffff,#ecffe9);
        box-shadow:
          0 18px 34px rgba(50,120,40,.22),
          inset 0 0 0 2px rgba(255,255,255,.75);
        display:grid;
        place-items:center;
        font-size:40px;
        cursor:pointer;
        pointer-events:auto;
        touch-action:none;
        user-select:none;
        -webkit-user-select:none;
        transform:scale(.45);
        opacity:0;
        transition:transform .13s ease, opacity .13s ease, filter .13s ease;
      }

      #gjGuestTargetLayerV3 .gjgt3-target.show{
        transform:scale(1);
        opacity:1;
      }

      #gjGuestTargetLayerV3 .gjgt3-target.junk{
        border-color:#ff8d8d;
        background:linear-gradient(180deg,#fffafa,#ffe1e1);
        box-shadow:0 18px 34px rgba(190,50,50,.22);
      }

      #gjGuestTargetLayerV3 .gjgt3-target.power{
        border-color:#b79cff;
        background:linear-gradient(180deg,#ffffff,#eee4ff);
        box-shadow:0 18px 34px rgba(100,70,180,.22);
      }

      #gjGuestTargetLayerV3 .gjgt3-target.hit{
        transform:scale(1.45) rotate(8deg);
        opacity:0;
        filter:brightness(1.25);
      }

      #gjGuestTargetLayerV3 .gjgt3-target.missed{
        transform:scale(.25);
        opacity:0;
        filter:grayscale(1);
      }

      #gjGuestTargetHudV3{
        position:fixed;
        left:12px;
        right:12px;
        bottom:calc(12px + env(safe-area-inset-bottom,0px));
        z-index:2147483950;
        border:4px solid #ffbd77;
        border-radius:24px;
        background:rgba(255,253,244,.96);
        box-shadow:0 16px 34px rgba(91,45,17,.18);
        padding:9px;
        display:grid;
        gap:7px;
        pointer-events:none;
        font-family:system-ui,-apple-system,"Segoe UI","Noto Sans Thai",sans-serif;
        color:#87311b;
      }

      #gjGuestTargetHudV3 .gjgth-title{
        font-size:13px;
        font-weight:1000;
        text-align:center;
        color:#8a5a00;
      }

      #gjGuestTargetHudV3 .gjgth-grid{
        display:grid;
        grid-template-columns:repeat(4,1fr);
        gap:7px;
      }

      #gjGuestTargetHudV3 .gjgth-cell{
        border:2px solid #ffd6a0;
        border-radius:16px;
        padding:7px 4px;
        background:#fffaf0;
        text-align:center;
        line-height:1.1;
      }

      #gjGuestTargetHudV3 .gjgth-cell b{
        display:block;
        font-size:18px;
        font-weight:1000;
      }

      #gjGuestTargetHudV3 .gjgth-cell span{
        display:block;
        margin-top:3px;
        font-size:10px;
        font-weight:900;
        color:#8a5a00;
      }

      .gjgt3-flash{
        position:fixed;
        left:50%;
        top:42%;
        z-index:2147484000;
        transform:translate(-50%,-50%);
        border:4px solid #ffbd77;
        border-radius:999px;
        background:#fffdf4;
        padding:10px 18px;
        color:#87311b;
        font-weight:1000;
        font-size:24px;
        box-shadow:0 12px 30px rgba(91,45,17,.20);
        pointer-events:none;
        animation:gjgt3Flash .55s ease both;
      }

      .gjgt3-flash.good{ border-color:#77e68a; color:#287b28; }
      .gjgt3-flash.bad{ border-color:#ff8d8d; color:#b33b3b; }
      .gjgt3-flash.power{ border-color:#b79cff; color:#5b37a6; }

      @keyframes gjgt3Flash{
        0%{ opacity:0; transform:translate(-50%,-30%) scale(.75); }
        20%{ opacity:1; transform:translate(-50%,-50%) scale(1.06); }
        100%{ opacity:0; transform:translate(-50%,-85%) scale(.9); }
      }
    `;

    document.head.appendChild(css);
    document.body.appendChild(layer);

    return layer;
  }

  function ensureHud(){
    let hud = document.getElementById('gjGuestTargetHudV3');
    if (hud) return hud;

    hud = document.createElement('div');
    hud.id = 'gjGuestTargetHudV3';
    hud.innerHTML = `
      <div class="gjgth-title">
        Guest Fallback v3 • เล่นได้ทันที • เวลา <span data-time>${GAME_SEC}</span>s • Targets <span data-targets>0</span>
      </div>

      <div class="gjgth-grid">
        <div class="gjgth-cell"><b data-score>0</b><span>Score</span></div>
        <div class="gjgth-cell"><b data-combo>0</b><span>Combo</span></div>
        <div class="gjgth-cell"><b data-heart>❤️❤️❤️</b><span>Heart</span></div>
        <div class="gjgth-cell"><b data-attack>0/3</b><span>Attack</span></div>
      </div>

      <div class="gjgth-grid">
        <div class="gjgth-cell"><b data-good>0</b><span>Good</span></div>
        <div class="gjgth-cell"><b data-junk>0</b><span>Junk</span></div>
        <div class="gjgth-cell"><b data-miss>0</b><span>Miss</span></div>
        <div class="gjgth-cell"><b>${escapeHtml(NAME)}</b><span>Player</span></div>
      </div>
    `;

    document.body.appendChild(hud);
    return hud;
  }

  function playArea(){
    const hud = document.getElementById('gjGuestTargetHudV3');
    const hudTop = hud ? hud.getBoundingClientRect().top : window.innerHeight - 180;

    return {
      left: 18,
      top: Math.max(310, Math.round(window.innerHeight * 0.42)),
      right: window.innerWidth - 18,
      bottom: Math.max(360, hudTop - 16)
    };
  }

  function remainingSec(){
    if (!roundStartAt) return GAME_SEC;
    return Math.max(0, Math.ceil(GAME_SEC - ((Date.now() - roundStartAt) / 1000)));
  }

  function spawnInterval(){
    const diff = clean(qs.get('diff') || 'normal');

    if (diff === 'easy') return 850;
    if (diff === 'hard') return 560;
    if (diff === 'challenge') return 460;

    return 660;
  }

  function removeOldFallbacks(){
    [
      'gjGuestTargetLayer',
      'gjGuestTargetHud',
      'gjGuestTargetLayerV2',
      'gjGuestTargetHudV2'
    ].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        try { el.remove(); } catch (_) {}
      }
    });
  }

  function feedback(text, kind, freq){
    flash(text, kind);
    beep(freq || 520, 0.055);
    vibrate(kind === 'bad' ? [25,25,25] : 20);
  }

  function flash(text, kind){
    const el = document.createElement('div');
    el.className = `gjgt3-flash ${kind || ''}`;
    el.textContent = text;
    document.body.appendChild(el);

    setTimeout(() => {
      try { el.remove(); } catch (_) {}
    }, 620);
  }

  function beep(freq, dur){
    try{
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = window.__GJGT3_AUDIO_CTX__ || new AudioCtx();
      window.__GJGT3_AUDIO_CTX__ = ctx;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.frequency.value = freq || 440;
      gain.gain.value = 0.045;

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + (dur || 0.06));
    }catch(_){}
  }

  function vibrate(pattern){
    try{
      if (navigator.vibrate) navigator.vibrate(pattern);
    }catch(_){}
  }

  function setText(root, selector, value){
    const el = root.querySelector(selector);
    if (el) el.textContent = String(value);
  }

  function isSummary(text){
    return (
      /ชนะ Battle/i.test(text) ||
      /แพ้ Battle/i.test(text) ||
      /เสมอ Battle/i.test(text) ||
      /จบ Battle/i.test(text) ||
      /Battle อีกครั้ง/i.test(text)
    );
  }

  function cleanupTimersOnly(){
    if (gameTimer) clearInterval(gameTimer);
    if (progressTimer) clearInterval(progressTimer);
    gameTimer = null;
    progressTimer = null;
  }

  function cleanup(){
    cleanupTimersOnly();

    if (watchTimer) clearInterval(watchTimer);
    watchTimer = null;
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

  function pick(arr){
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function rand(min, max){
    return Math.round(min + Math.random() * Math.max(0, max - min));
  }

  function clamp(n, min, max){
    if (!Number.isFinite(n)) return min;
    return Math.max(min, Math.min(max, n));
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

  function escapeHtml(s){
    return String(s ?? '')
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'","&#39;");
  }

  function sleep(ms){
    return new Promise(resolve => setTimeout(resolve, ms));
  }
})();
