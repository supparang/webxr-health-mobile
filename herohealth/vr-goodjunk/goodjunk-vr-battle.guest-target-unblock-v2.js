/* =========================================================
   HeroHealth • GoodJunk Battle Guest Target Unblock v2
   FILE: /herohealth/vr-goodjunk/goodjunk-vr-battle.guest-target-unblock-v2.js
   PATCH: v20260514m

   Fix:
   - KK เป้าโผล่มา 2 แล้วค้าง
   - เป้าคลิก/แตะไม่ติดเพราะ layer เกมเดิมบัง
   - ใช้ watchdog เติมเป้าเสมอ
   - ใช้ pointer capture ระดับ document เพื่อเก็บเป้าแม้ปุ่มจริงไม่รับ event
   - เขียนคะแนน KK เข้า Firebase ต่อเนื่อง
   ========================================================= */

(() => {
  'use strict';

  const PATCH_ID = 'v20260514m-guest-target-unblock-v2';

  if (window.__GJ_BATTLE_GUEST_TARGET_UNBLOCK_V2__) return;
  window.__GJ_BATTLE_GUEST_TARGET_UNBLOCK_V2__ = PATCH_ID;

  const qs = new URLSearchParams(location.search);

  const ROOM = cleanRoom(qs.get('roomId') || qs.get('room') || '');
  const PID = clean(qs.get('pid') || '');
  const NAME = clean(qs.get('name') || qs.get('nick') || 'Player');
  const URL_MATCH = clean(qs.get('matchId') || '');

  const LOG = '[GJ Battle Guest Target Unblock v2]';

  const GOOD = ['🍎','🍌','🥕','🥦','🍚','🥚','🥛','🐟','🍊','🥬'];
  const JUNK = ['🍟','🥤','🍩','🍬','🍔','🍕','🧁'];
  const POWER = ['⚡','🛡️','💎'];

  const TARGET_MAX = 5;

  let db = null;
  let auth = null;

  let started = false;
  let stopped = false;

  let watchTimer = null;
  let maintainTimer = null;
  let progressTimer = null;
  let rafId = 0;

  let lastSpawnAt = 0;
  let lastProgressAt = 0;
  let seq = 0;

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
    startedAt: Date.now(),
    updatedAt: Date.now()
  };

  boot();

  async function boot(){
    console.info(LOG, 'loaded', {
      patch: PATCH_ID,
      room: ROOM,
      pid: PID,
      name: NAME
    });

    waitForDb().catch(err => {
      console.warn(LOG, 'Firebase optional wait failed', err);
    });

    document.addEventListener('pointerdown', capturePointer, true);
    document.addEventListener('touchstart', captureTouch, true);
    document.addEventListener('click', captureClick, true);

    window.addEventListener('hha:battle:start-gameplay', () => {
      maybeStart('event-start-gameplay');
    });

    document.addEventListener('hha:battle:start-gameplay', () => {
      maybeStart('doc-start-gameplay');
    });

    watchTimer = setInterval(() => {
      maybeStart('watch');
    }, 350);

    setTimeout(() => maybeStart('boot-700'), 700);
    setTimeout(() => maybeStart('boot-1300'), 1300);
    setTimeout(() => maybeStart('boot-2200'), 2200);

    window.addEventListener('pagehide', () => {
      writeProgress(true, true).catch(() => {});
      cleanup();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        writeProgress(true, true).catch(() => {});
      }
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

  function maybeStart(reason){
    if (started || stopped) return;

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

    if (!gameplay) return;

    const nativeTargetCount = countNativeTargets();

    // ถ้า engine เดิมมีเป้าแล้ว ไม่ต้องทำ fallback
    // แต่ถ้ามีเป้าแค่ 1-2 แล้วนิ่งนาน v2 จะเริ่ม fallback ช่วย
    const shouldStart = nativeTargetCount === 0 || nativeTargetCount <= 2;

    if (!shouldStart) return;

    startFallback(reason, nativeTargetCount);
  }

  function startFallback(reason, nativeTargetCount){
    if (started || stopped) return;
    started = true;

    console.warn(LOG, 'START FALLBACK v2', { reason, nativeTargetCount });

    removeOldFallbackV1();
    ensureLayer();
    ensureHud();
    updateHud();
    updateExportStats();

    for (let i = 0; i < 4; i++){
      spawnTarget();
    }

    maintainTimer = setInterval(maintainTargets, 260);
    progressTimer = setInterval(() => {
      writeProgress(false, false).catch(() => {});
    }, 900);

    rafLoop();

    window.dispatchEvent(new CustomEvent('hha:battle:guest-target-fallback-v2-start', {
      detail: { roomId: ROOM, pid: PID, patch: PATCH_ID, reason }
    }));
  }

  function maintainTargets(){
    if (stopped) return;

    const text = bodyText();

    if (isSummary(text)){
      stopOnly();
      return;
    }

    if (isTimeZero(text)){
      writeProgress(true, true).catch(() => {});
      stopOnly();
      return;
    }

    expireTargets();

    const alive = targets.size;
    const now = Date.now();
    const interval = spawnInterval();

    if (alive < TARGET_MAX && (now - lastSpawnAt) >= interval){
      spawnTarget();
      lastSpawnAt = now;
    }

    if (alive <= 1){
      spawnTarget();
      spawnTarget();
      lastSpawnAt = now;
    }

    updateHud();
    updateExportStats();
  }

  function rafLoop(){
    if (stopped) return;

    expireTargets();

    if (started && targets.size < 3 && !isSummary(bodyText()) && !isTimeZero(bodyText())){
      spawnTarget();
    }

    rafId = requestAnimationFrame(rafLoop);
  }

  function spawnInterval(){
    const diff = clean(qs.get('diff') || 'normal');

    if (diff === 'easy') return 850;
    if (diff === 'hard') return 560;
    if (diff === 'challenge') return 460;

    return 660;
  }

  function spawnTarget(){
    if (stopped) return;

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

    const size = rand(62, 84);

    const x = rand(
      area.left + 10,
      Math.max(area.left + 12, area.right - size - 10)
    );

    const y = rand(
      area.top + 10,
      Math.max(area.top + 12, area.bottom - size - 10)
    );

    const id = `gt-${seq}-${Date.now()}`;

    const el = document.createElement('button');
    el.type = 'button';
    el.className = `gjgt2-target ${kind}`;
    el.dataset.gjgt2 = '1';
    el.dataset.id = id;
    el.dataset.kind = kind;
    el.textContent = emoji;

    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;

    const life = kind === 'junk' ? 2600 : 2300;

    targets.set(id, {
      id,
      el,
      kind,
      emoji,
      bornAt: Date.now(),
      expiresAt: Date.now() + life,
      collected: false
    });

    el.addEventListener('pointerdown', ev => {
      ev.preventDefault();
      ev.stopPropagation();
      collectById(id, 'target-pointer');
    }, { passive:false });

    el.addEventListener('click', ev => {
      ev.preventDefault();
      ev.stopPropagation();
      collectById(id, 'target-click');
    }, { passive:false });

    layer.appendChild(el);

    requestAnimationFrame(() => {
      el.classList.add('show');
    });
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
    if (!started || stopped) return;
    const touch = ev.touches && ev.touches[0];
    if (!touch) return;
    captureAt(touch.clientX, touch.clientY, ev);
  }

  function capturePointer(ev){
    if (!started || stopped) return;
    captureAt(ev.clientX, ev.clientY, ev);
  }

  function captureClick(ev){
    if (!started || stopped) return;
    captureAt(ev.clientX, ev.clientY, ev);
  }

  function captureAt(x, y, ev){
    const hit = findTargetAt(x, y);
    if (!hit) return;

    ev.preventDefault();
    ev.stopPropagation();

    collectById(hit.id, 'document-capture');
  }

  function findTargetAt(x, y){
    let best = null;
    let bestArea = Infinity;

    for (const t of targets.values()){
      if (!t || !t.el || !t.el.isConnected || t.collected) continue;

      const r = t.el.getBoundingClientRect();

      const pad = 12;

      const inside =
        x >= r.left - pad &&
        x <= r.right + pad &&
        y >= r.top - pad &&
        y <= r.bottom + pad;

      if (!inside) continue;

      const area = r.width * r.height;

      if (area < bestArea){
        best = t;
        bestArea = area;
      }
    }

    return best;
  }

  function collectById(id, reason){
    const t = targets.get(id);
    if (!t || t.collected) return;

    t.collected = true;

    applyTarget(t.kind, t.emoji, reason);
    removeTarget(id, 'collected');
  }

  function applyTarget(kind, emoji, reason){
    state.updatedAt = Date.now();

    if (kind === 'good'){
      state.good += 1;
      state.combo += 1;
      state.best = Math.max(state.best, state.combo);

      const comboBonus = Math.min(12, state.combo);
      state.score += 10 + comboBonus;

      if (state.good % 4 === 0){
        state.attack = Math.min(3, state.attack + 1);
      }

      feedback('+Good', 'good', 620);
    }

    if (kind === 'junk'){
      state.junk += 1;
      state.miss += 1;
      state.combo = 0;
      state.score = Math.max(0, state.score - 8);
      state.heart = Math.max(0, state.heart - 1);

      feedback('-Junk', 'bad', 180);
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

    writeProgress(false, false).catch(() => {});

    window.dispatchEvent(new CustomEvent('hha:battle:guest-target-hit', {
      detail: {
        roomId: ROOM,
        pid: PID,
        name: NAME,
        kind,
        emoji,
        reason,
        state: { ...state }
      }
    }));
  }

  function removeTarget(id, reason){
    const t = targets.get(id);
    if (!t) return;

    targets.delete(id);

    if (t.el && t.el.isConnected){
      t.el.classList.add(reason === 'collected' ? 'hit' : 'missed');

      setTimeout(() => {
        try { t.el.remove(); } catch (_) {}
      }, 140);
    }

    updateHud();
    updateExportStats();
  }

  function updateHud(){
    const hud = ensureHud();

    setText(hud, '[data-score]', state.score);
    setText(hud, '[data-combo]', state.combo);
    setText(hud, '[data-heart]', state.heart > 0 ? '❤️'.repeat(state.heart) : '—');
    setText(hud, '[data-attack]', `${state.attack}/3`);
    setText(hud, '[data-good]', state.good);
    setText(hud, '[data-junk]', state.junk);
    setText(hud, '[data-miss]', state.miss);
    setText(hud, '[data-targets]', targets.size);

    window.HHA_GJ_BATTLE_LOCAL_STATE = {
      ...state,
      roomId: ROOM,
      pid: PID,
      name: NAME,
      patch: PATCH_ID,
      fallbackTargets: true
    };
  }

  function updateExportStats(){
    let el = document.getElementById('gjGuestStatsExportV2');

    if (!el){
      el = document.createElement('div');
      el.id = 'gjGuestStatsExportV2';
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
      'GJ_GUEST_FALLBACK_STATS_V2',
      `PLAYER`,
      NAME,
      `SCORE`,
      String(state.score),
      `COMBO`,
      String(state.combo),
      `HEART`,
      String(state.heart),
      `ATTACK`,
      `${state.attack}/3`,
      `GOOD`,
      String(state.good),
      `JUNK`,
      String(state.junk),
      `MISS`,
      String(state.miss)
    ].join('\n');
  }

  async function writeProgress(force, finished){
    if (!db || !ROOM) return;

    const now = Date.now();

    if (!force && (now - lastProgressAt) < 650) return;
    lastProgressAt = now;

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

  function ensureLayer(){
    let layer = document.getElementById('gjGuestTargetLayerV2');
    if (layer) return layer;

    layer = document.createElement('div');
    layer.id = 'gjGuestTargetLayerV2';

    const css = document.createElement('style');
    css.textContent = `
      #gjGuestTargetLayerV2{
        position:fixed;
        inset:0;
        z-index:2147483900;
        pointer-events:none;
        overflow:hidden;
        font-family:system-ui,-apple-system,"Segoe UI","Noto Sans Thai",sans-serif;
      }

      #gjGuestTargetLayerV2 .gjgt2-target{
        position:fixed;
        border:6px solid #72e98a;
        border-radius:28px;
        background:linear-gradient(180deg,#ffffff,#ecffe9);
        box-shadow:
          0 18px 34px rgba(50,120,40,.22),
          inset 0 0 0 2px rgba(255,255,255,.75);
        display:grid;
        place-items:center;
        font-size:38px;
        cursor:pointer;
        pointer-events:auto;
        touch-action:none;
        user-select:none;
        -webkit-user-select:none;
        transform:scale(.45);
        opacity:0;
        transition:
          transform .13s ease,
          opacity .13s ease,
          filter .13s ease;
      }

      #gjGuestTargetLayerV2 .gjgt2-target.show{
        transform:scale(1);
        opacity:1;
      }

      #gjGuestTargetLayerV2 .gjgt2-target.junk{
        border-color:#ff8d8d;
        background:linear-gradient(180deg,#fffafa,#ffe1e1);
        box-shadow:0 18px 34px rgba(190,50,50,.22);
      }

      #gjGuestTargetLayerV2 .gjgt2-target.power{
        border-color:#b79cff;
        background:linear-gradient(180deg,#ffffff,#eee4ff);
        box-shadow:0 18px 34px rgba(100,70,180,.22);
      }

      #gjGuestTargetLayerV2 .gjgt2-target.hit{
        transform:scale(1.4) rotate(8deg);
        opacity:0;
        filter:brightness(1.25);
      }

      #gjGuestTargetLayerV2 .gjgt2-target.missed{
        transform:scale(.25);
        opacity:0;
        filter:grayscale(1);
      }

      #gjGuestTargetHudV2{
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

      #gjGuestTargetHudV2 .gjgth-title{
        font-size:13px;
        font-weight:1000;
        text-align:center;
        color:#8a5a00;
      }

      #gjGuestTargetHudV2 .gjgth-grid{
        display:grid;
        grid-template-columns:repeat(4,1fr);
        gap:7px;
      }

      #gjGuestTargetHudV2 .gjgth-cell{
        border:2px solid #ffd6a0;
        border-radius:16px;
        padding:7px 4px;
        background:#fffaf0;
        text-align:center;
        line-height:1.1;
      }

      #gjGuestTargetHudV2 .gjgth-cell b{
        display:block;
        font-size:18px;
        font-weight:1000;
      }

      #gjGuestTargetHudV2 .gjgth-cell span{
        display:block;
        margin-top:3px;
        font-size:10px;
        font-weight:900;
        color:#8a5a00;
      }

      .gjgt2-flash{
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
        animation:gjgt2Flash .55s ease both;
      }

      .gjgt2-flash.good{
        border-color:#77e68a;
        color:#287b28;
      }

      .gjgt2-flash.bad{
        border-color:#ff8d8d;
        color:#b33b3b;
      }

      .gjgt2-flash.power{
        border-color:#b79cff;
        color:#5b37a6;
      }

      @keyframes gjgt2Flash{
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
    let hud = document.getElementById('gjGuestTargetHudV2');
    if (hud) return hud;

    hud = document.createElement('div');
    hud.id = 'gjGuestTargetHudV2';
    hud.innerHTML = `
      <div class="gjgth-title">
        Guest Fallback v2 • แตะเป้าได้เลย • Targets <span data-targets>0</span>
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
    const hud = document.getElementById('gjGuestTargetHudV2');
    const hudTop = hud ? hud.getBoundingClientRect().top : window.innerHeight - 170;

    const candidates = Array.from(document.querySelectorAll('body *'))
      .map(el => {
        const r = el.getBoundingClientRect();
        const text = clean(el.textContent || '');
        return { el, r, text };
      })
      .filter(x => {
        if (!x.el.isConnected) return false;
        if (x.el.closest('#gjGuestTargetLayerV2')) return false;
        if (x.el.closest('#gjGuestTargetHudV2')) return false;
        if (x.r.width < 260 || x.r.height < 260) return false;
        if (x.r.top < 260) return false;
        if (x.r.bottom > hudTop - 8) return false;
        if (x.text.length > 260) return false;
        return true;
      })
      .sort((a,b) => (b.r.width * b.r.height) - (a.r.width * a.r.height));

    if (candidates.length){
      const r = candidates[0].r;

      return {
        left: Math.max(10, r.left),
        top: Math.max(260, r.top),
        right: Math.min(window.innerWidth - 10, r.right),
        bottom: Math.min(hudTop - 12, r.bottom)
      };
    }

    return {
      left: 14,
      top: Math.max(300, Math.round(window.innerHeight * 0.42)),
      right: window.innerWidth - 14,
      bottom: Math.max(340, hudTop - 12)
    };
  }

  function countNativeTargets(){
    const emojis = GOOD.concat(JUNK, POWER);

    return Array.from(document.querySelectorAll('button, [role="button"], div, span'))
      .filter(el => {
        if (!el || !el.isConnected) return false;
        if (el.closest('#gjGuestTargetLayerV2')) return false;
        if (el.closest('#gjGuestTargetHudV2')) return false;
        if (el.closest('#gjGuestTargetLayer')) return false;
        if (el.closest('#gjGuestTargetHud')) return false;

        const r = el.getBoundingClientRect();
        if (r.width < 34 || r.height < 34) return false;
        if (r.width > 160 || r.height > 160) return false;
        if (r.top < 240) return false;

        const text = clean(el.textContent || '');
        if (!text) return false;

        return emojis.some(e => text.includes(e));
      }).length;
  }

  function removeOldFallbackV1(){
    ['gjGuestTargetLayer','gjGuestTargetHud'].forEach(id => {
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
    el.className = `gjgt2-flash ${kind || ''}`;
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

      const ctx = window.__GJGT2_AUDIO_CTX__ || new AudioCtx();
      window.__GJGT2_AUDIO_CTX__ = ctx;

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

  function isTimeZero(text){
    const t = String(text || '').replace(/\s+/g, ' ');

    return (
      /เวลา\s*0s/i.test(t) ||
      /เวลา\s*0\s*s/i.test(t) ||
      /เวลา\s*0\b/i.test(t) ||
      /\b0s\s*•/i.test(t) ||
      /time\s*0/i.test(t)
    );
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

  function stopOnly(){
    stopped = true;

    if (maintainTimer) clearInterval(maintainTimer);
    if (progressTimer) clearInterval(progressTimer);
    if (rafId) cancelAnimationFrame(rafId);

    maintainTimer = null;
    progressTimer = null;
    rafId = 0;
  }

  function cleanup(){
    stopOnly();

    if (watchTimer) clearInterval(watchTimer);
    watchTimer = null;

    document.removeEventListener('pointerdown', capturePointer, true);
    document.removeEventListener('touchstart', captureTouch, true);
    document.removeEventListener('click', captureClick, true);
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
