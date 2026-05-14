/* =========================================================
   HeroHealth • GoodJunk Battle Guest Target Unblock v5
   FILE: /herohealth/vr-goodjunk/goodjunk-vr-battle.guest-target-unblock-v5-playable-buttons.js
   PATCH: v20260514q

   Fix:
   - KK เห็นเป้า แต่แตะไม่ได้ / timer ไม่เดิน
   - v5 ใช้ปุ่ม target จริงบน top layer
   - ไม่มี invisible catcher แยก
   - timer / spawn / score / summary ทำเองครบ
   ========================================================= */

(() => {
  'use strict';

  const PATCH_ID = 'v20260514q-guest-target-unblock-v5-playable-buttons';

  if (window.__GJ_BATTLE_GUEST_TARGET_UNBLOCK_V5__) return;
  window.__GJ_BATTLE_GUEST_TARGET_UNBLOCK_V5__ = PATCH_ID;

  const qs = new URLSearchParams(location.search);

  const ROOM = cleanRoom(qs.get('roomId') || qs.get('room') || '');
  const PID = clean(qs.get('pid') || '');
  const NAME = clean(qs.get('name') || qs.get('nick') || 'Player');
  const MATCH_ID_URL = clean(qs.get('matchId') || '');
  const GAME_SEC = clamp(Number(qs.get('time') || 90), 30, 240);

  const LOG = '[GJ Battle Guest v5]';

  const GOOD = ['🍎','🍌','🥕','🥦','🍚','🥚','🥛','🐟','🍊','🥬'];
  const JUNK = ['🍟','🥤','🍩','🍬','🍔','🍕','🧁'];
  const POWER = ['⚡','🛡️','💎'];

  let db = null;
  let auth = null;

  let started = false;
  let finished = false;

  let watchTimer = null;
  let tickTimer = null;
  let writeTimer = null;

  let startedAt = 0;
  let lastWriteAt = 0;
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
    miss: 0
  };

  boot();

  function boot(){
    console.info(LOG, 'loaded', { patch: PATCH_ID, room: ROOM, pid: PID, name: NAME });

    waitForDb().catch(err => console.warn(LOG, 'Firebase optional:', err));

    watchTimer = setInterval(() => maybeStart('watch'), 300);

    window.addEventListener('hha:battle:start-gameplay', () => maybeStart('event'));
    document.addEventListener('hha:battle:start-gameplay', () => maybeStart('doc-event'));

    setTimeout(() => maybeStart('boot-500'), 500);
    setTimeout(() => maybeStart('boot-1200'), 1200);
    setTimeout(() => maybeStart('boot-2200'), 2200);

    window.addEventListener('pagehide', () => {
      writeProgress(true).catch(() => {});
      cleanup();
    });
  }

  async function waitForDb(){
    for (let i = 0; i < 60; i++){
      if (window.HHA_FIREBASE_READY){
        const fb = await window.HHA_FIREBASE_READY;
        if (fb && fb.db && fb.auth && fb.auth.currentUser){
          db = fb.db;
          auth = fb.auth;
          console.info(LOG, 'Firebase ready', auth.currentUser.uid);
          return;
        }
      }
      await sleep(200);
    }
  }

  function maybeStart(reason){
    if (started || finished) return;

    const text = bodyText();

    if (isSummary(text)) return;

    const isBattlePage =
      /GoodJunk Battle/i.test(text) ||
      String(location.href).includes('goodjunk-vr-battle');

    const oldFallback =
      document.getElementById('gjTapCatcherV4') ||
      document.getElementById('gjGuestTargetLayerV3') ||
      document.getElementById('gjGuestTargetLayerV2') ||
      document.getElementById('gjGuestTargetLayer') ||
      /Guest Fallback/i.test(text);

    const waitGuest =
      /รอคู่แข่ง/i.test(text) ||
      /WAIT/i.test(text) ||
      /RIVAL\s*0/i.test(text);

    if (!isBattlePage) return;

    if (oldFallback || waitGuest || reason.startsWith('boot')){
      start(reason);
    }
  }

  function start(reason){
    if (started || finished) return;

    started = true;
    startedAt = Date.now();

    console.warn(LOG, 'START v5 playable buttons', reason);

    removeOldFallbacks();
    ensureUI();
    updateHud();

    for (let i = 0; i < 5; i++){
      spawnTarget();
    }

    tickTimer = setInterval(tick, 180);
    writeTimer = setInterval(() => writeProgress(false).catch(() => {}), 900);

    markPlaying().catch(() => {});
  }

  function tick(){
    if (finished) return;

    if (timeLeft() <= 0){
      finish('time-up');
      return;
    }

    expireTargets();

    while (targets.size < 5){
      spawnTarget();
    }

    updateHud();
    updateExportStats();
  }

  function spawnTarget(){
    if (finished) return;

    const layer = document.getElementById('gjv5Targets');
    if (!layer) return;

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

    const size = rand(72, 96);
    const x = rand(area.left, Math.max(area.left, area.right - size));
    const y = rand(area.top, Math.max(area.top, area.bottom - size));

    const id = `v5-${seq}-${Date.now()}`;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `gjv5-target ${kind}`;
    btn.dataset.id = id;
    btn.dataset.kind = kind;
    btn.textContent = emoji;
    btn.style.left = `${x}px`;
    btn.style.top = `${y}px`;
    btn.style.width = `${size}px`;
    btn.style.height = `${size}px`;

    const target = {
      id,
      btn,
      kind,
      emoji,
      bornAt: Date.now(),
      expiresAt: Date.now() + (kind === 'junk' ? 3200 : 2800),
      hit: false
    };

    targets.set(id, target);

    const hit = ev => {
      if (ev){
        ev.preventDefault();
        ev.stopPropagation();
      }
      collect(id, 'button-event');
    };

    btn.onclick = hit;
    btn.onpointerdown = hit;
    btn.onpointerup = hit;
    btn.ontouchstart = hit;
    btn.ontouchend = hit;
    btn.onmousedown = hit;
    btn.onmouseup = hit;

    layer.appendChild(btn);

    requestAnimationFrame(() => btn.classList.add('show'));
  }

  function expireTargets(){
    const now = Date.now();

    for (const [id, t] of targets.entries()){
      if (!t || t.hit) continue;

      if (now >= t.expiresAt){
        if (t.kind === 'good'){
          state.miss += 1;
          state.combo = 0;
        }

        removeTarget(id, 'missed');
      }
    }
  }

  function collect(id, reason){
    const t = targets.get(id);
    if (!t || t.hit || finished) return;

    t.hit = true;

    if (t.kind === 'good'){
      state.good += 1;
      state.combo += 1;
      state.best = Math.max(state.best, state.combo);
      state.score += 10 + Math.min(15, state.combo);

      if (state.good % 4 === 0){
        state.attack = Math.min(3, state.attack + 1);
      }

      flash('+Good', 'good');
      beep(620);
      vibrate(20);
    }

    if (t.kind === 'junk'){
      state.junk += 1;
      state.miss += 1;
      state.combo = 0;
      state.score = Math.max(0, state.score - 10);
      state.heart = Math.max(0, state.heart - 1);

      flash('-Junk', 'bad');
      beep(180);
      vibrate([25,25,25]);

      if (state.heart <= 0){
        removeTarget(id, 'hit');
        finish('heart-zero');
        return;
      }
    }

    if (t.kind === 'power'){
      state.score += 5;

      if (t.emoji === '🛡️'){
        state.heart = Math.min(3, state.heart + 1);
        flash('Shield +1', 'power');
      }else{
        state.attack = Math.min(3, state.attack + 1);
        flash('Attack +1', 'power');
      }

      beep(820);
      vibrate(18);
    }

    removeTarget(id, 'hit');

    setTimeout(() => {
      if (!finished) spawnTarget();
    }, 80);

    updateHud();
    updateExportStats();
    writeProgress(false).catch(() => {});

    console.info(LOG, 'hit', { reason, kind: t.kind, score: state.score });
  }

  function removeTarget(id, mode){
    const t = targets.get(id);
    if (!t) return;

    targets.delete(id);

    if (t.btn && t.btn.isConnected){
      t.btn.classList.add(mode === 'hit' ? 'hit' : 'missed');

      setTimeout(() => {
        try { t.btn.remove(); } catch (_) {}
      }, 160);
    }
  }

  function ensureUI(){
    if (document.getElementById('gjv5Root')) return;

    const root = document.createElement('div');
    root.id = 'gjv5Root';
    root.innerHTML = `
      <div id="gjv5Play">
        <div id="gjv5Targets"></div>
      </div>

      <div id="gjv5Hud">
        <div class="gjv5-title">
          Guest Fallback v5 • แตะปุ่มอาหารได้เลย • เวลา <b data-time>${GAME_SEC}</b>s • Targets <b data-targets>0</b>
        </div>

        <div class="gjv5-grid">
          <div><b data-score>0</b><span>Score</span></div>
          <div><b data-combo>0</b><span>Combo</span></div>
          <div><b data-heart>❤️❤️❤️</b><span>Heart</span></div>
          <div><b data-attack>0/3</b><span>Attack</span></div>
        </div>

        <div class="gjv5-grid">
          <div><b data-good>0</b><span>Good</span></div>
          <div><b data-junk>0</b><span>Junk</span></div>
          <div><b data-miss>0</b><span>Miss</span></div>
          <div><b>${escapeHtml(NAME)}</b><span>Player</span></div>
        </div>
      </div>
    `;

    const css = document.createElement('style');
    css.textContent = `
      #gjv5Root{
        position:fixed;
        inset:0;
        z-index:2147484600;
        pointer-events:auto;
        font-family:system-ui,-apple-system,"Segoe UI","Noto Sans Thai",sans-serif;
      }

      #gjv5Play{
        position:fixed;
        inset:0;
        z-index:2147484601;
        pointer-events:none;
      }

      #gjv5Targets{
        position:fixed;
        inset:0;
        z-index:2147484602;
        pointer-events:none;
      }

      .gjv5-target{
        position:fixed;
        z-index:2147484603;
        pointer-events:auto;
        touch-action:manipulation;
        user-select:none;
        -webkit-user-select:none;
        display:grid;
        place-items:center;
        border:7px solid #72e98a;
        border-radius:30px;
        background:linear-gradient(180deg,#ffffff,#ecffe9);
        box-shadow:0 18px 34px rgba(50,120,40,.25);
        font-size:42px;
        cursor:pointer;
        opacity:0;
        transform:scale(.45);
        transition:transform .13s ease, opacity .13s ease, filter .13s ease;
      }

      .gjv5-target.show{
        opacity:1;
        transform:scale(1);
      }

      .gjv5-target.junk{
        border-color:#ff8d8d;
        background:linear-gradient(180deg,#fffafa,#ffe1e1);
      }

      .gjv5-target.power{
        border-color:#b79cff;
        background:linear-gradient(180deg,#ffffff,#eee4ff);
      }

      .gjv5-target.hit{
        opacity:0;
        transform:scale(1.5) rotate(8deg);
        filter:brightness(1.25);
      }

      .gjv5-target.missed{
        opacity:0;
        transform:scale(.2);
        filter:grayscale(1);
      }

      #gjv5Hud{
        position:fixed;
        left:12px;
        right:12px;
        bottom:calc(12px + env(safe-area-inset-bottom,0px));
        z-index:2147484604;
        pointer-events:none;
        border:4px solid #ffbd77;
        border-radius:24px;
        background:rgba(255,253,244,.97);
        box-shadow:0 16px 34px rgba(91,45,17,.18);
        padding:9px;
        display:grid;
        gap:7px;
        color:#87311b;
      }

      .gjv5-title{
        text-align:center;
        color:#8a5a00;
        font-size:13px;
        font-weight:1000;
      }

      .gjv5-grid{
        display:grid;
        grid-template-columns:repeat(4,1fr);
        gap:7px;
      }

      .gjv5-grid div{
        border:2px solid #ffd6a0;
        border-radius:16px;
        padding:7px 4px;
        text-align:center;
        background:#fffaf0;
        line-height:1.1;
      }

      .gjv5-grid b{
        display:block;
        font-size:18px;
        font-weight:1000;
      }

      .gjv5-grid span{
        display:block;
        margin-top:3px;
        font-size:10px;
        font-weight:900;
        color:#8a5a00;
      }

      .gjv5-flash{
        position:fixed;
        left:50%;
        top:42%;
        z-index:2147484700;
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
        animation:gjv5Flash .55s ease both;
      }

      .gjv5-flash.good{ border-color:#77e68a; color:#287b28; }
      .gjv5-flash.bad{ border-color:#ff8d8d; color:#b33b3b; }
      .gjv5-flash.power{ border-color:#b79cff; color:#5b37a6; }

      @keyframes gjv5Flash{
        0%{ opacity:0; transform:translate(-50%,-30%) scale(.75); }
        20%{ opacity:1; transform:translate(-50%,-50%) scale(1.06); }
        100%{ opacity:0; transform:translate(-50%,-85%) scale(.9); }
      }
    `;

    document.head.appendChild(css);
    document.body.appendChild(root);
  }

  function updateHud(){
    const root = document.getElementById('gjv5Root');
    if (!root) return;

    setText(root, '[data-time]', timeLeft());
    setText(root, '[data-targets]', targets.size);
    setText(root, '[data-score]', state.score);
    setText(root, '[data-combo]', state.combo);
    setText(root, '[data-heart]', state.heart > 0 ? '❤️'.repeat(state.heart) : '—');
    setText(root, '[data-attack]', `${state.attack}/3`);
    setText(root, '[data-good]', state.good);
    setText(root, '[data-junk]', state.junk);
    setText(root, '[data-miss]', state.miss);

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
    let el = document.getElementById('gjGuestStatsExportV5');

    if (!el){
      el = document.createElement('div');
      el.id = 'gjGuestStatsExportV5';
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
      'GJ_GUEST_FALLBACK_STATS_V5',
      'PLAYER', NAME,
      'SCORE', String(state.score),
      'COMBO', String(state.combo),
      'HEART', String(state.heart),
      'ATTACK', `${state.attack}/3`,
      'GOOD', String(state.good),
      'JUNK', String(state.junk),
      'MISS', String(state.miss),
      'TIME', String(timeLeft())
    ].join('\n');
  }

  async function markPlaying(){
    if (!db || !ROOM) return;

    const t = Date.now();

    await db.ref(roomPath(ROOM)).update({
      status:'playing',
      phase:'playing',
      updatedAt:t,
      [`guestPlayableSignals/${safeKey(PID || 'guest')}`]: {
        pid:PID || 'guest',
        name:NAME,
        state:'playable-buttons-v5',
        patch:PATCH_ID,
        at:t
      }
    }).catch(() => {});
  }

  async function writeProgress(force){
    if (!db || !ROOM) return;

    const t = Date.now();

    if (!force && t - lastWriteAt < 650) return;
    lastWriteAt = t;

    const room = await db.ref(roomPath(ROOM)).get().then(s => s.val()).catch(() => null);

    const matchId =
      MATCH_ID_URL ||
      clean(room?.activeMatchId || '') ||
      clean(room?.currentRun?.matchId || '') ||
      `${ROOM}-R1`;

    const key = safeKey(PID || 'guest');

    const payload = {
      roomId:ROOM,
      matchId,
      pid:PID || 'guest',
      name:NAME || 'Guest',
      score:Number(state.score || 0),
      combo:Number(state.combo || 0),
      bestStreak:Number(state.best || 0),
      heart:Number(state.heart || 0),
      attack:Number(state.attack || 0),
      good:Number(state.good || 0),
      junk:Number(state.junk || 0),
      miss:Number(state.miss || 0),
      timeLeft:timeLeft(),
      finished:!!finished,
      fallbackTargets:true,
      patch:PATCH_ID,
      updatedAt:t
    };

    await db.ref(roomPath(ROOM)).update({
      updatedAt:t,
      [`progress/${key}`]:payload,
      [`runtimeScores/${key}`]:payload,
      [`currentRun/progress/${key}`]:payload,
      [`currentRun/runtimeScores/${key}`]:payload
    }).catch(() => {});

    await db.ref(matchPath(ROOM, matchId)).update({
      updatedAt:t,
      [`progress/${key}`]:payload,
      [`runtimeScores/${key}`]:payload
    }).catch(() => {});
  }

  async function finish(reason){
    if (finished) return;

    finished = true;

    console.warn(LOG, 'FINISH', reason, state);

    cleanupTimersOnly();

    await writeProgress(true).catch(() => {});

    showSummary(reason);
  }

  function showSummary(reason){
    let old = document.getElementById('gjv5Summary');
    if (old) old.remove();

    const box = document.createElement('div');
    box.id = 'gjv5Summary';
    box.innerHTML = `
      <div class="gjv5sum-card">
        <div class="gjv5sum-icon">🏁</div>
        <h1>จบ Battle!</h1>
        <div class="gjv5sum-note">ผลฝั่ง ${escapeHtml(NAME)} • ${escapeHtml(reason)}</div>

        <div class="gjv5sum-grid">
          <div><b>${state.score}</b><span>Score</span></div>
          <div><b>${state.combo}</b><span>Combo</span></div>
          <div><b>${state.good}</b><span>Good</span></div>
          <div><b>${state.junk}</b><span>Junk</span></div>
          <div><b>${state.miss}</b><span>Miss</span></div>
          <div><b>${state.attack}/3</b><span>Attack</span></div>
        </div>

        <div class="gjv5sum-actions">
          <button type="button" data-again>🔁 Battle อีกครั้ง</button>
          <button type="button" data-lobby>⚔️ กลับ Lobby</button>
          <button type="button" data-hub>🏠 Hub</button>
        </div>
      </div>
    `;

    const css = document.createElement('style');
    css.textContent = `
      #gjv5Summary{
        position:fixed;
        inset:0;
        z-index:2147484800;
        display:grid;
        place-items:center;
        padding:18px;
        background:rgba(132,82,48,.50);
        backdrop-filter:blur(13px);
        font-family:system-ui,-apple-system,"Segoe UI","Noto Sans Thai",sans-serif;
      }

      #gjv5Summary .gjv5sum-card{
        width:min(720px,94vw);
        border:4px solid #ffbd77;
        border-radius:34px;
        background:#fffdf4;
        box-shadow:0 22px 60px rgba(91,45,17,.26);
        padding:24px 18px;
        color:#87311b;
        text-align:center;
      }

      #gjv5Summary .gjv5sum-icon{
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

      #gjv5Summary h1{
        margin:0;
        font-size:clamp(34px,7vw,54px);
        line-height:1.1;
        font-weight:1000;
      }

      #gjv5Summary .gjv5sum-note{
        margin:12px 0;
        padding:11px;
        border:3px dashed #ffbd77;
        border-radius:20px;
        font-weight:1000;
        color:#8a5a00;
      }

      #gjv5Summary .gjv5sum-grid{
        display:grid;
        grid-template-columns:repeat(3,1fr);
        gap:10px;
        margin-top:12px;
      }

      #gjv5Summary .gjv5sum-grid div{
        border:3px solid #ffcf93;
        border-radius:18px;
        padding:12px;
        background:#fffaf0;
      }

      #gjv5Summary .gjv5sum-grid b{
        display:block;
        font-size:28px;
      }

      #gjv5Summary .gjv5sum-grid span{
        display:block;
        font-size:13px;
        font-weight:900;
      }

      #gjv5Summary .gjv5sum-actions{
        display:flex;
        gap:10px;
        flex-wrap:wrap;
        margin-top:16px;
      }

      #gjv5Summary button{
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

      [
        'pid','name','nick','diff','time','view','hub',
        'zone','cat','game','gameId','theme','room','roomId'
      ].forEach(k => {
        const v = qs.get(k);
        if (v) u.searchParams.set(k, v);
      });

      u.searchParams.set('mode','battle');
      u.searchParams.set('entry','battle');
      u.searchParams.set('recommendedMode','battle');

      location.href = u.toString();
    });

    box.querySelector('[data-hub]').addEventListener('click', () => {
      location.href = qs.get('hub') || '../nutrition-zone.html';
    });
  }

  function playArea(){
    const hud = document.getElementById('gjv5Hud');
    const hudTop = hud ? hud.getBoundingClientRect().top : window.innerHeight - 190;

    return {
      left: 20,
      top: Math.max(300, Math.round(window.innerHeight * 0.42)),
      right: window.innerWidth - 20,
      bottom: Math.max(360, hudTop - 18)
    };
  }

  function timeLeft(){
    if (!startedAt) return GAME_SEC;
    return Math.max(0, Math.ceil(GAME_SEC - ((Date.now() - startedAt) / 1000)));
  }

  function removeOldFallbacks(){
    [
      'gjGuestTargetLayer',
      'gjGuestTargetHud',
      'gjGuestTargetLayerV2',
      'gjGuestTargetHudV2',
      'gjGuestTargetLayerV3',
      'gjGuestTargetHudV3',
      'gjTapCatcherV4',
      'gjv5Root'
    ].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        try { el.remove(); } catch (_) {}
      }
    });
  }

  function cleanupTimersOnly(){
    if (tickTimer) clearInterval(tickTimer);
    if (writeTimer) clearInterval(writeTimer);

    tickTimer = null;
    writeTimer = null;
  }

  function cleanup(){
    cleanupTimersOnly();

    if (watchTimer) clearInterval(watchTimer);
    watchTimer = null;
  }

  function flash(text, kind){
    const el = document.createElement('div');
    el.className = `gjv5-flash ${kind || ''}`;
    el.textContent = text;

    document.body.appendChild(el);

    setTimeout(() => {
      try { el.remove(); } catch (_) {}
    }, 620);
  }

  function beep(freq){
    try{
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = window.__GJGT5_AUDIO_CTX__ || new AudioCtx();
      window.__GJGT5_AUDIO_CTX__ = ctx;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.frequency.value = freq || 440;
      gain.gain.value = 0.045;

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.055);
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

  function roomPath(roomId){
    return `hha-battle/goodjunk/battleRooms/${safeKey(roomId)}`;
  }

  function matchPath(roomId, matchId){
    return `${roomPath(roomId)}/matches/${safeKey(matchId)}`;
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
