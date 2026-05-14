/* =========================================================
   HeroHealth • GoodJunk Battle Guest Target Unblock v1
   FILE: /herohealth/vr-goodjunk/goodjunk-vr-battle.guest-target-unblock-v1.js
   PATCH: v20260514l

   Fix:
   - KK เข้า gameplay แล้ว แต่เป้าไม่โผล่
   - HUD ขึ้นแล้ว แต่ spawn engine ไม่เริ่ม
   - Guest เงียบ ไม่มี SFX / ไม่มี target / score ไม่เดิน
   - fallback spawn เฉพาะเมื่อไม่พบ target จริง
   - เขียน progress/results เบื้องต้นเข้า Firebase
   ========================================================= */

(() => {
  'use strict';

  const PATCH_ID = 'v20260514l-guest-target-unblock-v1';

  if (window.__GJ_BATTLE_GUEST_TARGET_UNBLOCK_V1__) return;
  window.__GJ_BATTLE_GUEST_TARGET_UNBLOCK_V1__ = PATCH_ID;

  const qs = new URLSearchParams(location.search);

  const ROOM = cleanRoom(qs.get('roomId') || qs.get('room') || '');
  const PID = clean(qs.get('pid') || '');
  const NAME = clean(qs.get('name') || qs.get('nick') || 'Player');
  const URL_HOST_PID = clean(qs.get('hostPid') || '');
  const URL_MATCH = clean(qs.get('matchId') || '');

  const LOG = '[GJ Battle Guest Target Unblock v1]';

  const GOOD = ['🍎','🍌','🥕','🥦','🍚','🥚','🥛','🐟','🍊','🥬'];
  const JUNK = ['🍟','🥤','🍩','🍬','🍔','🍕','🧁'];
  const POWER = ['⚡','🛡️','💎'];

  let db = null;
  let auth = null;

  let watchTimer = null;
  let spawnTimer = null;
  let progressTimer = null;

  let fallbackStarted = false;
  let firstGameplaySeenAt = 0;
  let lastProgressWriteAt = 0;
  let targetSeq = 0;

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
      name: NAME,
      hostPid: URL_HOST_PID
    });

    waitForDb().catch(err => {
      console.warn(LOG, 'Firebase optional wait failed', err);
    });

    window.addEventListener('hha:battle:start-gameplay', () => {
      firstGameplaySeenAt = Date.now();
      checkAndMaybeStartFallback('event-start-gameplay');
    });

    document.addEventListener('hha:battle:start-gameplay', () => {
      firstGameplaySeenAt = Date.now();
      checkAndMaybeStartFallback('doc-start-gameplay');
    });

    watchTimer = setInterval(() => {
      checkAndMaybeStartFallback('watch');
    }, 450);

    window.addEventListener('pagehide', () => {
      cleanup();
      writeProgress(true).catch(() => {});
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        writeProgress(true).catch(() => {});
      }
    });

    setTimeout(() => checkAndMaybeStartFallback('boot-800'), 800);
    setTimeout(() => checkAndMaybeStartFallback('boot-1600'), 1600);
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

  function checkAndMaybeStartFallback(reason){
    if (fallbackStarted) return;

    const text = bodyText();

    if (isSummaryVisible(text)) return;
    if (!isBattleGameplay(text)) return;

    if (!firstGameplaySeenAt) firstGameplaySeenAt = Date.now();

    const hasNative = hasNativeTargets();

    if (hasNative){
      return;
    }

    const waited = Date.now() - firstGameplaySeenAt;

    if (waited > 1200){
      startFallbackTargets(reason);
    }
  }

  function isBattleGameplay(text){
    const t = String(text || '');

    return (
      /GoodJunk Battle/i.test(t) &&
      (
        /SCORE/i.test(t) ||
        /COMBO/i.test(t) ||
        /HEART/i.test(t) ||
        /ATTACK/i.test(t)
      ) &&
      !/กำลังเตรียม Battle/i.test(t) &&
      !/เตรียมพร้อม Battle/i.test(t)
    );
  }

  function isSummaryVisible(text){
    return (
      /ชนะ Battle/i.test(text) ||
      /แพ้ Battle/i.test(text) ||
      /เสมอ Battle/i.test(text) ||
      /จบ Battle/i.test(text) ||
      /Battle อีกครั้ง/i.test(text)
    );
  }

  function hasNativeTargets(){
    const emojis = GOOD.concat(JUNK, POWER);

    const nodes = Array.from(document.querySelectorAll('button, [role="button"], .target, .item, .food, .junk, .good, div, span'))
      .filter(el => {
        if (!el || !el.isConnected) return false;
        if (el.closest('#gjGuestTargetLayer')) return false;
        if (el.closest('#gjGuestTargetHud')) return false;
        if (el.closest('#gjBattleHardSummary')) return false;

        const rect = el.getBoundingClientRect();
        if (rect.width < 34 || rect.height < 34) return false;
        if (rect.width > 150 || rect.height > 150) return false;

        const text = clean(el.textContent || '');
        if (!text) return false;

        return emojis.some(e => text.includes(e));
      });

    return nodes.length > 0;
  }

  function startFallbackTargets(reason){
    if (fallbackStarted) return;
    fallbackStarted = true;

    readNativeState();

    console.warn(LOG, 'START FALLBACK TARGETS', reason, state);

    ensureLayer();
    ensureHud();
    updateAllHud();

    spawnTarget();
    spawnTarget();

    const interval = getSpawnInterval();

    spawnTimer = setInterval(() => {
      if (isSummaryVisible(bodyText())) {
        cleanup();
        return;
      }

      if (isTimeZero(bodyText())) {
        writeProgress(true).catch(() => {});
        cleanup();
        return;
      }

      const layer = ensureLayer();
      const count = layer.querySelectorAll('.gjgt-target').length;

      if (count < 5){
        spawnTarget();
      }
    }, interval);

    progressTimer = setInterval(() => {
      writeProgress(false).catch(() => {});
    }, 1000);

    window.dispatchEvent(new CustomEvent('hha:battle:guest-target-fallback-start', {
      detail: { roomId: ROOM, pid: PID, reason, patch: PATCH_ID }
    }));

    document.dispatchEvent(new CustomEvent('hha:battle:guest-target-fallback-start', {
      detail: { roomId: ROOM, pid: PID, reason, patch: PATCH_ID }
    }));
  }

  function getSpawnInterval(){
    const diff = clean(qs.get('diff') || 'normal');

    if (diff === 'easy') return 980;
    if (diff === 'hard') return 660;
    if (diff === 'challenge') return 540;

    return 760;
  }

  function spawnTarget(){
    const layer = ensureLayer();
    const rect = playRect();

    targetSeq += 1;

    const roll = Math.random();

    let kind = 'good';
    let emoji = GOOD[Math.floor(Math.random() * GOOD.length)];

    if (roll > 0.70 && roll <= 0.90){
      kind = 'junk';
      emoji = JUNK[Math.floor(Math.random() * JUNK.length)];
    }else if (roll > 0.90){
      kind = 'power';
      emoji = POWER[Math.floor(Math.random() * POWER.length)];
    }

    const size = rand(58, 78);
    const x = rand(rect.left + 12, Math.max(rect.left + 14, rect.right - size - 12));
    const y = rand(rect.top + 12, Math.max(rect.top + 14, rect.bottom - size - 12));

    const el = document.createElement('button');
    el.type = 'button';
    el.className = `gjgt-target ${kind}`;
    el.dataset.kind = kind;
    el.dataset.id = String(targetSeq);
    el.textContent = emoji;

    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;

    let collected = false;

    const timeout = setTimeout(() => {
      if (collected) return;

      if (kind === 'good'){
        state.miss += 1;
        state.combo = 0;
        updateAllHud();
      }

      popTarget(el, false);
    }, kind === 'junk' ? 2600 : 2200);

    function collect(ev){
      ev.preventDefault();
      ev.stopPropagation();

      if (collected) return;
      collected = true;

      clearTimeout(timeout);
      applyTarget(kind, emoji);
      popTarget(el, true);
    }

    el.addEventListener('pointerdown', collect, { passive:false });
    el.addEventListener('click', collect, { passive:false });

    layer.appendChild(el);

    requestAnimationFrame(() => {
      el.classList.add('show');
    });
  }

  function applyTarget(kind, emoji){
    state.updatedAt = Date.now();

    if (kind === 'good'){
      state.good += 1;
      state.combo += 1;
      state.best = Math.max(state.best, state.combo);
      state.score += 10 + Math.min(10, state.combo);

      if (state.good % 4 === 0){
        state.attack = Math.min(3, state.attack + 1);
      }

      beep(620, 0.05);
      vibrate(22);
      flash('+Good', 'good');
    }

    if (kind === 'junk'){
      state.junk += 1;
      state.combo = 0;
      state.miss += 1;
      state.score = Math.max(0, state.score - 8);
      state.heart = Math.max(0, state.heart - 1);

      beep(180, 0.08);
      vibrate([30, 30, 30]);
      flash('-Junk', 'bad');
    }

    if (kind === 'power'){
      if (emoji === '🛡️'){
        state.heart = Math.min(3, state.heart + 1);
        flash('Shield +1', 'power');
      }else{
        state.attack = Math.min(3, state.attack + 1);
        flash('Attack +1', 'power');
      }

      state.score += 5;
      beep(820, 0.06);
      vibrate(18);
    }

    updateAllHud();
    writeProgress(false).catch(() => {});
  }

  function popTarget(el, collected){
    if (!el) return;

    el.classList.add(collected ? 'hit' : 'missed');

    setTimeout(() => {
      try { el.remove(); } catch (_) {}
    }, 180);
  }

  function updateAllHud(){
    state.updatedAt = Date.now();

    patchMetric('SCORE', String(state.score));
    patchMetric('COMBO', String(state.combo));
    patchMetric('HEART', state.heart > 0 ? '❤️'.repeat(state.heart) : '—');
    patchMetric('ATTACK', `${state.attack}/3`);

    const hud = document.getElementById('gjGuestTargetHud');
    if (hud){
      hud.querySelector('[data-score]').textContent = String(state.score);
      hud.querySelector('[data-combo]').textContent = String(state.combo);
      hud.querySelector('[data-heart]').textContent = state.heart > 0 ? '❤️'.repeat(state.heart) : '—';
      hud.querySelector('[data-attack]').textContent = `${state.attack}/3`;
      hud.querySelector('[data-good]').textContent = String(state.good);
      hud.querySelector('[data-junk]').textContent = String(state.junk);
      hud.querySelector('[data-miss]').textContent = String(state.miss);
    }

    window.HHA_GJ_BATTLE_LOCAL_STATE = {
      ...state,
      roomId: ROOM,
      pid: PID,
      name: NAME,
      patch: PATCH_ID
    };
  }

  function readNativeState(){
    const text = bodyText();

    const score = readBlockNumber(text, 'SCORE');
    const combo = readBlockNumber(text, 'COMBO');
    const attack = readFractionFirst(text, 'ATTACK');
    const heart = countHearts(text);

    if (Number.isFinite(score) && score > 0) state.score = score;
    if (Number.isFinite(combo) && combo > 0) state.combo = combo;
    if (Number.isFinite(attack) && attack > 0) state.attack = attack;
    if (Number.isFinite(heart) && heart > 0) state.heart = Math.min(3, heart);

    state.best = Math.max(state.best, state.combo);
  }

  async function writeProgress(force){
    if (!db || !ROOM) return;

    const t = Date.now();

    if (!force && (t - lastProgressWriteAt) < 850) return;
    lastProgressWriteAt = t;

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
      finished: isTimeZero(bodyText()) || isSummaryVisible(bodyText()),
      fallbackTargets: true,
      patch: PATCH_ID,
      updatedAt: t
    };

    await db.ref(roomPath(ROOM)).update({
      updatedAt: t,
      [`progress/${key}`]: payload,
      [`currentRun/progress/${key}`]: payload,
      [`runtimeScores/${key}`]: payload
    }).catch(() => {});

    await db.ref(matchPath(ROOM, matchId)).update({
      updatedAt: t,
      [`progress/${key}`]: payload,
      [`runtimeScores/${key}`]: payload
    }).catch(() => {});
  }

  function ensureLayer(){
    let layer = document.getElementById('gjGuestTargetLayer');
    if (layer) return layer;

    layer = document.createElement('div');
    layer.id = 'gjGuestTargetLayer';

    const css = document.createElement('style');
    css.textContent = `
      #gjGuestTargetLayer{
        position:fixed;
        inset:0;
        z-index:2147482500;
        pointer-events:none;
        overflow:hidden;
        font-family:system-ui,-apple-system,"Segoe UI","Noto Sans Thai",sans-serif;
      }
      #gjGuestTargetLayer .gjgt-target{
        position:fixed;
        border:5px solid rgba(255,189,119,.95);
        border-radius:24px;
        background:linear-gradient(180deg,#fffdf4,#fff3cf);
        box-shadow:
          0 14px 28px rgba(91,45,17,.18),
          inset 0 0 0 2px rgba(255,255,255,.7);
        display:grid;
        place-items:center;
        font-size:34px;
        cursor:pointer;
        pointer-events:auto;
        transform:scale(.45);
        opacity:0;
        transition:transform .15s ease, opacity .15s ease, filter .15s ease;
        touch-action:none;
        user-select:none;
        -webkit-user-select:none;
      }
      #gjGuestTargetLayer .gjgt-target.show{
        transform:scale(1);
        opacity:1;
      }
      #gjGuestTargetLayer .gjgt-target.good{
        border-color:#77e68a;
        background:linear-gradient(180deg,#f7fff0,#dfffd6);
      }
      #gjGuestTargetLayer .gjgt-target.junk{
        border-color:#ff8d8d;
        background:linear-gradient(180deg,#fff2f2,#ffd6d6);
      }
      #gjGuestTargetLayer .gjgt-target.power{
        border-color:#b79cff;
        background:linear-gradient(180deg,#f6f0ff,#e6d9ff);
      }
      #gjGuestTargetLayer .gjgt-target.hit{
        transform:scale(1.35) rotate(8deg);
        opacity:0;
        filter:brightness(1.25);
      }
      #gjGuestTargetLayer .gjgt-target.missed{
        transform:scale(.25);
        opacity:0;
        filter:grayscale(1);
      }

      #gjGuestTargetHud{
        position:fixed;
        left:12px;
        right:12px;
        bottom:calc(12px + env(safe-area-inset-bottom,0px));
        z-index:2147482600;
        border:4px solid #ffbd77;
        border-radius:22px;
        background:rgba(255,253,244,.94);
        box-shadow:0 14px 34px rgba(91,45,17,.18);
        padding:8px;
        display:grid;
        gap:6px;
        pointer-events:none;
        font-family:system-ui,-apple-system,"Segoe UI","Noto Sans Thai",sans-serif;
        color:#87311b;
      }
      #gjGuestTargetHud .gjgth-title{
        font-size:12px;
        font-weight:1000;
        color:#8a5a00;
        text-align:center;
      }
      #gjGuestTargetHud .gjgth-grid{
        display:grid;
        grid-template-columns:repeat(4,1fr);
        gap:6px;
      }
      #gjGuestTargetHud .gjgth-cell{
        border:2px solid #ffd6a0;
        border-radius:14px;
        padding:6px 4px;
        background:#fffaf0;
        text-align:center;
        line-height:1.1;
      }
      #gjGuestTargetHud .gjgth-cell b{
        display:block;
        font-size:17px;
        font-weight:1000;
      }
      #gjGuestTargetHud .gjgth-cell span{
        display:block;
        margin-top:3px;
        font-size:10px;
        font-weight:900;
        color:#8a5a00;
      }
      .gjgt-flash{
        position:fixed;
        left:50%;
        top:42%;
        z-index:2147482700;
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
        animation:gjgtFlash .55s ease both;
      }
      .gjgt-flash.good{ border-color:#77e68a; color:#287b28; }
      .gjgt-flash.bad{ border-color:#ff8d8d; color:#b33b3b; }
      .gjgt-flash.power{ border-color:#b79cff; color:#5b37a6; }
      @keyframes gjgtFlash{
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
    let hud = document.getElementById('gjGuestTargetHud');
    if (hud) return hud;

    hud = document.createElement('div');
    hud.id = 'gjGuestTargetHud';
    hud.innerHTML = `
      <div class="gjgth-title">Guest Fallback Targets • เป้ามาแล้ว เล่นต่อได้เลย</div>
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

  function playRect(){
    const candidates = Array.from(document.querySelectorAll('body *'))
      .map(el => {
        const r = el.getBoundingClientRect();
        const text = clean(el.textContent || '');
        return { el, r, text };
      })
      .filter(x => {
        if (!x.el.isConnected) return false;
        if (x.el.closest('#gjGuestTargetLayer')) return false;
        if (x.el.closest('#gjGuestTargetHud')) return false;
        if (x.r.width < 260 || x.r.height < 230) return false;
        if (x.r.top < 220) return false;
        if (x.text.length > 250) return false;
        return true;
      })
      .sort((a,b) => (b.r.width * b.r.height) - (a.r.width * a.r.height));

    if (candidates.length){
      const r = candidates[0].r;

      return {
        left: Math.max(8, r.left),
        top: Math.max(210, r.top),
        right: Math.min(window.innerWidth - 8, r.right),
        bottom: Math.min(window.innerHeight - 96, r.bottom)
      };
    }

    return {
      left: 14,
      top: Math.max(260, Math.round(window.innerHeight * 0.40)),
      right: window.innerWidth - 14,
      bottom: window.innerHeight - 112
    };
  }

  function patchMetric(label, value){
    try{
      const node = findTextNodeExact(label);
      if (!node) return false;

      const box = findMetricBox(node.parentElement, label);
      if (!box) return false;

      const nodes = textNodes(box)
        .filter(n => n !== node)
        .filter(n => clean(n.nodeValue || '') !== '')
        .filter(n => clean(n.nodeValue || '').toUpperCase() !== label.toUpperCase());

      const target =
        nodes.find(n => /^[\d\s/❤️….\-—]+$/.test(clean(n.nodeValue || ''))) ||
        nodes[nodes.length - 1];

      if (target){
        target.nodeValue = String(value);
        return true;
      }

      const span = document.createElement('b');
      span.textContent = String(value);
      box.appendChild(span);
      return true;

    }catch(_){
      return false;
    }
  }

  function findTextNodeExact(label){
    const nodes = textNodes(document.body);
    const target = String(label || '').toUpperCase();

    return nodes.find(n => clean(n.nodeValue || '').toUpperCase() === target) || null;
  }

  function findMetricBox(start, label){
    let cur = start;

    for (let i = 0; i < 7 && cur && cur !== document.body; i++){
      const text = clean(cur.innerText || cur.textContent || '');
      const labelCount = countMetricLabels(text);

      if (
        text.toUpperCase().includes(label.toUpperCase()) &&
        text.length <= 120 &&
        labelCount <= 2
      ){
        return cur;
      }

      cur = cur.parentElement;
    }

    return start;
  }

  function countMetricLabels(text){
    const labels = ['PLAYER','SCORE','COMBO','HEART','ATTACK','RIVAL'];
    const t = String(text || '').toUpperCase();

    return labels.reduce((n, label) => n + (t.includes(label) ? 1 : 0), 0);
  }

  function readBlockNumber(text, label){
    const lines = linesOf(text);
    const idx = lines.findIndex(x => x.toUpperCase() === label.toUpperCase());

    if (idx >= 0){
      for (let i = idx + 1; i < Math.min(idx + 4, lines.length); i++){
        const n = firstNumber(lines[i]);
        if (Number.isFinite(n)) return n;
      }
    }

    return 0;
  }

  function readFractionFirst(text, label){
    const re = new RegExp(label + '[\\s\\S]{0,60}?(\\d+)\\s*\\/\\s*(\\d+)', 'i');
    const m = String(text || '').match(re);
    return m ? Number(m[1]) : 0;
  }

  function countHearts(text){
    const m = String(text || '').match(/❤️+/);
    if (!m) return 0;
    return Array.from(m[0]).length;
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

  function flash(text, kind){
    const el = document.createElement('div');
    el.className = `gjgt-flash ${kind || ''}`;
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

      const ctx = window.__GJGT_AUDIO_CTX__ || new AudioCtx();
      window.__GJGT_AUDIO_CTX__ = ctx;

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

  function cleanup(){
    if (watchTimer) clearInterval(watchTimer);
    if (spawnTimer) clearInterval(spawnTimer);
    if (progressTimer) clearInterval(progressTimer);

    watchTimer = null;
    spawnTimer = null;
    progressTimer = null;
  }

  function roomPath(roomId){
    return `hha-battle/goodjunk/battleRooms/${safeKey(roomId)}`;
  }

  function matchPath(roomId, matchId){
    return `${roomPath(roomId)}/matches/${safeKey(matchId)}`;
  }

  function textNodes(root){
    if (!root) return [];

    const out = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);

    while (walker.nextNode()){
      out.push(walker.currentNode);
    }

    return out;
  }

  function linesOf(text){
    return String(text || '')
      .split(/\n|\r/)
      .map(s => s.trim())
      .filter(Boolean);
  }

  function firstNumber(s){
    const m = String(s || '').match(/-?\d+/);
    return m ? Number(m[0]) : NaN;
  }

  function bodyText(){
    return document.body ? String(document.body.innerText || document.body.textContent || '') : '';
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
