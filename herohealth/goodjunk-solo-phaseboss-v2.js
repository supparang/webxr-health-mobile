(function () {
  'use strict';

  const q = new URLSearchParams(location.search);
  const mount = document.getElementById('gameMount') || document.body;

  const ctx = window.__GJ_RUN_CTX__ || {
    pid: q.get('pid') || 'anon',
    name: q.get('name') || '',
    studyId: q.get('studyId') || '',
    diff: q.get('diff') || 'normal',
    time: q.get('time') || '150',
    seed: q.get('seed') || String(Date.now()),
    hub: q.get('hub') || new URL('./hub.html', location.href).toString(),
    nextAfterCooldown: q.get('nextAfterCooldown') || '',
    cdnext: q.get('cdnext') || '',
    view: q.get('view') || 'mobile',
    run: q.get('run') || 'play',
    gameId: q.get('gameId') || 'goodjunk'
  };

  const ROOT_ID = 'gjSoloBossRoot';
  const STYLE_ID = 'gjSoloBossStyle';

  const GOOD = ['🍎','🥕','🥦','🍌','🥛','🥗','🍉','🐟'];
  const JUNK = ['🍟','🍩','🍭','🍔','🥤','🍕','🧁','🍫'];

  const DIFF = {
    easy:   { p1Goal: 70,  p2Goal: 170, spawn1: 900, spawn2: 740, storm: 1250, bossHp: 16, weakSize: 96, weakSpeed: 180 },
    normal: { p1Goal: 90,  p2Goal: 220, spawn1: 760, spawn2: 620, storm: 980,  bossHp: 22, weakSize: 82, weakSpeed: 240 },
    hard:   { p1Goal: 110, p2Goal: 260, spawn1: 620, spawn2: 500, storm: 820,  bossHp: 28, weakSize: 72, weakSpeed: 300 }
  };

  const diffKey = DIFF[ctx.diff] ? ctx.diff : 'normal';
  const cfg = DIFF[diffKey];

  let state = {
    running: false,
    ended: false,
    phase: 1,
    score: 0,
    miss: 0,
    streak: 0,
    bestStreak: 0,
    hitsGood: 0,
    hitsBad: 0,
    missedGood: 0,
    powerHits: 0,
    spawnedStorm: 0,
    stormHits: 0,

    timeTotal: Math.max(90, Number(ctx.time || 150)) * 1000,
    timeLeft: Math.max(90, Number(ctx.time || 150)) * 1000,

    lastTs: 0,
    spawnAcc: 0,
    stormAcc: 0,
    weakMoveAcc: 0,

    items: new Map(),
    seq: 0,
    raf: 0,

    boss: {
      active: false,
      hp: cfg.bossHp,
      maxHp: cfg.bossHp,
      weakId: '',
      stage: 1,
      pattern: 'learn',
      vx: 0,
      vy: 0
    }
  };

  function rand() {
    return Math.random();
  }

  function range(min, max) {
    return min + Math.random() * (max - min);
  }

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function stageRect() {
    return ui.stage.getBoundingClientRect();
  }

  function fmtTime(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function getCooldownTarget() {
    return String(ctx.nextAfterCooldown || '').trim()
      || String(ctx.cdnext || '').trim()
      || String(ctx.hub || '').trim()
      || new URL('./hub.html', location.href).toString();
  }

  function buildCooldownUrl() {
    const u = new URL('./warmup-gate.html', location.href);
    u.searchParams.set('phase', 'cooldown');
    u.searchParams.set('game', 'goodjunk');
    u.searchParams.set('gameId', 'goodjunk');
    u.searchParams.set('theme', 'goodjunk');
    u.searchParams.set('cat', 'nutrition');
    u.searchParams.set('zone', 'nutrition');
    u.searchParams.set('pid', ctx.pid || 'anon');
    u.searchParams.set('name', ctx.name || 'Hero');
    if (ctx.studyId) u.searchParams.set('studyId', ctx.studyId);
    u.searchParams.set('diff', diffKey);
    u.searchParams.set('time', String(Math.round(state.timeTotal / 1000)));
    u.searchParams.set('seed', ctx.seed || String(Date.now()));
    u.searchParams.set('hub', ctx.hub || new URL('./hub.html', location.href).toString());
    u.searchParams.set('view', ctx.view || 'mobile');
    u.searchParams.set('run', ctx.run || 'play');
    u.searchParams.set('forcegate', '1');
    u.searchParams.set('nextAfterCooldown', getCooldownTarget());

    const passthrough = ['api','conditionGroup','phase','studentKey','schoolCode','classRoom','studentNo','nickName'];
    passthrough.forEach((k) => {
      const v = q.get(k);
      if (v) u.searchParams.set(k === 'phase' ? 'phaseTag' : k, v);
    });

    return u.toString();
  }

  function buildReplayUrl() {
    const u = new URL('./goodjunk-vr.html', location.href);
    u.searchParams.set('pid', ctx.pid || 'anon');
    u.searchParams.set('name', ctx.name || 'Hero');
    if (ctx.studyId) u.searchParams.set('studyId', ctx.studyId);
    u.searchParams.set('mode', 'solo');
    u.searchParams.set('diff', diffKey);
    u.searchParams.set('time', String(Math.round(state.timeTotal / 1000)));
    u.searchParams.set('seed', String(Date.now()));
    u.searchParams.set('hub', ctx.hub || new URL('./hub.html', location.href).toString());
    u.searchParams.set('view', ctx.view || 'mobile');
    u.searchParams.set('run', ctx.run || 'play');
    u.searchParams.set('gameId', ctx.gameId || 'goodjunk');
    u.searchParams.set('zone', 'nutrition');
    if (ctx.nextAfterCooldown) u.searchParams.set('nextAfterCooldown', ctx.nextAfterCooldown);
    if (ctx.cdnext) u.searchParams.set('cdnext', ctx.cdnext);
    return u.toString();
  }

  function saveSummary(summary) {
    try {
      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary));
      const raw = localStorage.getItem('HHA_SUMMARY_HISTORY');
      const arr = raw ? JSON.parse(raw) : [];
      const next = Array.isArray(arr) ? arr : [];
      next.unshift(summary);
      localStorage.setItem('HHA_SUMMARY_HISTORY', JSON.stringify(next.slice(0, 40)));
    } catch {}
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
      #${ROOT_ID}{
        position:absolute; inset:0; overflow:hidden;
        font-family:system-ui,-apple-system,"Segoe UI",sans-serif;
        color:#fff;
      }
      .gjsb-stage{
        position:absolute; inset:12px;
        border-radius:28px;
        overflow:hidden;
        background:
          radial-gradient(circle at 20% 18%, rgba(255,255,255,.12), transparent 18%),
          radial-gradient(circle at 80% 10%, rgba(255,255,255,.10), transparent 18%),
          linear-gradient(180deg,#93d9ff 0%, #ccefff 52%, #fff3c9 100%);
        box-shadow: inset 0 0 0 4px rgba(255,255,255,.35);
      }
      .gjsb-ground{
        position:absolute; left:0; right:0; bottom:0; height:18%;
        background:linear-gradient(180deg,#9be26a,#67c94c);
        box-shadow: inset 0 4px 0 rgba(255,255,255,.25);
      }
      .gjsb-cloud{
        position:absolute; width:110px; height:34px; border-radius:999px;
        background:rgba(255,255,255,.75);
        filter:blur(.5px);
        box-shadow:
          40px 0 0 4px rgba(255,255,255,.75),
          82px 6px 0 0 rgba(255,255,255,.65);
        opacity:.9;
      }
      .gjsb-cloud.c1{ left:6%; top:8%; }
      .gjsb-cloud.c2{ left:64%; top:13%; transform:scale(1.18); }
      .gjsb-cloud.c3{ left:30%; top:22%; transform:scale(.9); }

      .gjsb-hud{
        position:absolute; left:12px; right:12px; top:12px;
        display:grid; gap:10px; z-index:30; pointer-events:none;
      }
      .gjsb-row{
        display:flex; gap:8px; flex-wrap:wrap; align-items:center;
      }
      .gjsb-pill{
        pointer-events:auto;
        padding:10px 14px; border-radius:999px;
        background:rgba(255,255,255,.9);
        color:#55514a; font-weight:1000; font-size:13px;
        box-shadow:0 8px 18px rgba(86,155,194,.16);
        border:2px solid rgba(191,227,242,.95);
      }
      .gjsb-banner{
        align-self:center;
        max-width:min(92vw,680px);
        margin:0 auto;
        padding:14px 18px;
        border-radius:22px;
        background:rgba(255,255,255,.92);
        color:#5e5a52;
        border:3px solid rgba(191,227,242,.95);
        box-shadow:0 12px 24px rgba(86,155,194,.14);
        text-align:center;
        font-weight:1000;
        transition:opacity .2s ease, transform .2s ease;
      }
      .gjsb-banner.hide{ opacity:0; transform:translateY(-8px); }

      .gjsb-boss{
        position:absolute; left:12px; right:12px; top:110px;
        z-index:25; display:none;
      }
      .gjsb-boss.show{ display:block; }
      .gjsb-boss-card{
        width:min(520px,100%);
        margin:0 auto;
        border-radius:22px;
        background:rgba(255,255,255,.92);
        border:3px solid rgba(255,212,92,.95);
        box-shadow:0 12px 24px rgba(86,155,194,.14);
        padding:12px 14px;
        color:#5e5a52;
      }
      .gjsb-boss-top{
        display:flex; justify-content:space-between; gap:8px; align-items:center;
        font-weight:1000;
      }
      .gjsb-boss-bar{
        margin-top:8px; height:14px; border-radius:999px;
        overflow:hidden; background:#e8eef2; border:2px solid #d9eaf5;
      }
      .gjsb-boss-fill{
        height:100%; width:100%;
        transform-origin:left center;
        background:linear-gradient(90deg,#ffd45c,#ff8f3b);
        transition:transform .12s linear;
      }

      .gjsb-item{
        position:absolute;
        display:grid; place-items:center;
        border:none; cursor:pointer;
        border-radius:22px;
        background:rgba(255,255,255,.92);
        box-shadow:0 10px 22px rgba(86,155,194,.18);
        border:3px solid rgba(191,227,242,.95);
        color:#222;
        user-select:none;
        -webkit-user-select:none;
      }
      .gjsb-item.good{ background:linear-gradient(180deg,#f7fff1,#ffffff); }
      .gjsb-item.junk,
      .gjsb-item.storm{ background:linear-gradient(180deg,#fff3f3,#ffffff); border-color:#ffd3d3; }
      .gjsb-item.weak{ background:linear-gradient(180deg,#fff8d5,#ffffff); border-color:#ffe08a; animation:gjsbPulse .9s infinite; }
      @keyframes gjsbPulse{
        0%,100%{ transform:scale(1); }
        50%{ transform:scale(1.06); }
      }
      .gjsb-emoji{ font-size:34px; line-height:1; pointer-events:none; }
      .gjsb-tag{
        position:absolute; left:6px; right:6px; bottom:4px;
        text-align:center; font-size:10px; color:#6b7280; font-weight:1000;
        pointer-events:none;
      }

      .gjsb-fx{
        position:absolute; transform:translate(-50%,-50%);
        font-size:16px; font-weight:1000; z-index:35; pointer-events:none;
        animation:gjsbFx .75s ease forwards;
        text-shadow:0 8px 18px rgba(0,0,0,.14);
      }
      @keyframes gjsbFx{
        from{ opacity:1; transform:translate(-50%,-10%); }
        to{ opacity:0; transform:translate(-50%,-150%); }
      }

      .gjsb-summary{
        position:absolute; inset:0; z-index:60;
        display:none; place-items:center;
        background:rgba(255,255,255,.32);
        backdrop-filter:blur(4px);
        padding:16px;
      }
      .gjsb-summary.show{ display:grid; }
      .gjsb-summary-card{
        width:min(94vw,760px);
        max-height:88vh; overflow:auto;
        border-radius:28px;
        background:linear-gradient(180deg,#fffef8,#f8fff3);
        border:4px solid #bfe3f2;
        box-shadow:0 18px 36px rgba(86,155,194,.18);
        padding:18px;
        color:#55514a;
      }
      .gjsb-summary-head{
        text-align:center; margin-bottom:14px;
      }
      .gjsb-stars{
        font-size:30px; line-height:1; margin:10px 0 6px;
      }
      .gjsb-summary-grid{
        display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px;
      }
      .gjsb-stat{
        border-radius:18px;
        background:#fff;
        border:3px solid #d7edf7;
        padding:12px;
      }
      .gjsb-stat .k{ font-size:12px; color:#7b7a72; font-weight:1000; }
      .gjsb-stat .v{ margin-top:6px; font-size:28px; font-weight:1000; }
      .gjsb-actions{
        display:grid; gap:10px; margin-top:16px;
      }
      .gjsb-btn{
        border:none; border-radius:18px; padding:14px 16px;
        font-size:16px; font-weight:1000; cursor:pointer;
      }
      .gjsb-btn.replay{ background:linear-gradient(180deg,#7ed957,#58c33f); color:#173b0b; }
      .gjsb-btn.cooldown{ background:linear-gradient(180deg,#7fcfff,#58b7f5); color:#08374d; }
      .gjsb-btn.hub{ background:#fff; color:#6c6a61; border:3px solid #d7edf7; }

      @media (max-width:720px){
        .gjsb-summary-grid{ grid-template-columns:1fr; }
        .gjsb-item .gjsb-emoji{ font-size:28px; }
      }
    `;
    document.head.appendChild(s);
  }

  function buildUI() {
    mount.innerHTML = `
      <div id="${ROOT_ID}">
        <div class="gjsb-stage" id="gjsbStage">
          <div class="gjsb-cloud c1"></div>
          <div class="gjsb-cloud c2"></div>
          <div class="gjsb-cloud c3"></div>
          <div class="gjsb-ground"></div>

          <div class="gjsb-hud">
            <div class="gjsb-row">
              <div class="gjsb-pill" id="hudScore">Score • 0</div>
              <div class="gjsb-pill" id="hudTime">Time • 0:00</div>
              <div class="gjsb-pill" id="hudMiss">Miss • 0</div>
              <div class="gjsb-pill" id="hudStreak">Streak • 0</div>
              <div class="gjsb-pill" id="hudPhase">Phase • 1</div>
            </div>
            <div class="gjsb-banner" id="hudBanner">เก็บอาหารดี หลีกเลี่ยง junk แล้วไปสู้กับ Junk King!</div>
          </div>

          <div class="gjsb-boss" id="bossWrap">
            <div class="gjsb-boss-card">
              <div class="gjsb-boss-top">
                <div id="bossLabel">🍔 Junk King • Stage 1</div>
                <div id="bossHpText">HP 0 / 0</div>
              </div>
              <div class="gjsb-boss-bar">
                <div class="gjsb-boss-fill" id="bossHpFill"></div>
              </div>
            </div>
          </div>

          <div class="gjsb-summary" id="summary">
            <div class="gjsb-summary-card">
              <div class="gjsb-summary-head">
                <div style="font-size:14px;font-weight:1000;color:#67a91c;">GOODJUNK SOLO BOSS v2</div>
                <h2 id="sumTitle" style="margin:8px 0 0;font-size:40px;line-height:1.05;color:#67a91c;">Great Job!</h2>
                <div id="sumSub" style="margin-top:6px;font-size:15px;color:#7b7a72;font-weight:1000;">มาดูผลการเล่นรอบนี้กัน</div>
                <div class="gjsb-stars" id="sumStars">⭐</div>
              </div>

              <div class="gjsb-summary-grid" id="sumGrid"></div>

              <div class="gjsb-actions">
                <button class="gjsb-btn replay" id="btnReplay">🔁 เล่นใหม่</button>
                <button class="gjsb-btn cooldown" id="btnCooldown">🧊 ไป Cooldown</button>
                <button class="gjsb-btn hub" id="btnHub">🏠 กลับ HUB</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    return {
      root: document.getElementById(ROOT_ID),
      stage: document.getElementById('gjsbStage'),
      banner: document.getElementById('hudBanner'),
      score: document.getElementById('hudScore'),
      time: document.getElementById('hudTime'),
      miss: document.getElementById('hudMiss'),
      streak: document.getElementById('hudStreak'),
      phase: document.getElementById('hudPhase'),
      bossWrap: document.getElementById('bossWrap'),
      bossLabel: document.getElementById('bossLabel'),
      bossHpText: document.getElementById('bossHpText'),
      bossHpFill: document.getElementById('bossHpFill'),
      summary: document.getElementById('summary'),
      sumTitle: document.getElementById('sumTitle'),
      sumSub: document.getElementById('sumSub'),
      sumStars: document.getElementById('sumStars'),
      sumGrid: document.getElementById('sumGrid'),
      btnReplay: document.getElementById('btnReplay'),
      btnCooldown: document.getElementById('btnCooldown'),
      btnHub: document.getElementById('btnHub')
    };
  }

  function fx(x, y, text, color) {
    const el = document.createElement('div');
    el.className = 'gjsb-fx';
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.color = color || '#333';
    ui.stage.appendChild(el);
    setTimeout(() => el.remove(), 760);
  }

  function setBanner(text, autoHide) {
    ui.banner.textContent = text;
    ui.banner.classList.remove('hide');
    if (autoHide) {
      setTimeout(() => ui.banner.classList.add('hide'), autoHide);
    }
  }

  function setBossStage() {
    const ratio = state.boss.hp / state.boss.maxHp;
    if (ratio > 0.66) {
      state.boss.stage = 1;
      state.boss.pattern = 'learn';
    } else if (ratio > 0.33) {
      state.boss.stage = 2;
      state.boss.pattern = 'pressure';
    } else {
      state.boss.stage = 3;
      state.boss.pattern = 'final';
    }
  }

  function renderHud() {
    ui.score.textContent = `Score • ${state.score}`;
    ui.time.textContent = `Time • ${fmtTime(state.timeLeft)}`;
    ui.miss.textContent = `Miss • ${state.miss}`;
    ui.streak.textContent = `Streak • ${state.streak}`;
    ui.phase.textContent = state.boss.active ? `Boss • Stage ${state.boss.stage}` : `Phase • ${state.phase}`;

    if (state.boss.active) {
      ui.bossWrap.classList.add('show');
      ui.bossLabel.textContent = `🍔 Junk King • Stage ${state.boss.stage}`;
      ui.bossHpText.textContent = `HP ${state.boss.hp} / ${state.boss.maxHp}`;
      ui.bossHpFill.style.transform = `scaleX(${clamp(state.boss.hp / state.boss.maxHp, 0, 1)})`;
    } else {
      ui.bossWrap.classList.remove('show');
    }
  }

  function createItem(kind, emoji, x, y, size, vx, vy, label) {
    const id = `it-${++state.seq}`;
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `gjsb-item ${kind}`;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.innerHTML = `<div class="gjsb-emoji">${emoji}</div><div class="gjsb-tag">${label || kind}</div>`;
    ui.stage.appendChild(el);

    const item = {
      id, kind, emoji, x, y, size, vx, vy, el, dead: false
    };

    el.addEventListener('pointerdown', function (ev) {
      ev.preventDefault();
      onHit(item);
    }, { passive: false });

    state.items.set(id, item);
    drawItem(item);
    return item;
  }

  function drawItem(item) {
    item.el.style.transform = `translate(${item.x}px, ${item.y}px)`;
  }

  function removeItem(item) {
    if (!item || item.dead) return;
    item.dead = true;
    try { item.el.remove(); } catch {}
    state.items.delete(item.id);
    if (state.boss.weakId === item.id) state.boss.weakId = '';
  }

  function onHit(item) {
    if (!state.running || state.ended) return;

    const cx = item.x + item.size / 2;
    const cy = item.y + item.size / 2;

    if (item.kind === 'good') {
      state.hitsGood += 1;
      state.streak += 1;
      state.bestStreak = Math.max(state.bestStreak, state.streak);
      const bonus = Math.min(10, Math.floor(state.streak / 3) * 2);
      const gain = 10 + bonus;
      state.score += gain;
      fx(cx, cy, `+${gain}`, '#2f8f2f');
      setBanner('เยี่ยม! เก็บอาหารดีต่อไป', 650);
      removeItem(item);
    } else if (item.kind === 'junk' || item.kind === 'storm') {
      state.hitsBad += 1;
      state.miss += 1;
      state.streak = 0;
      state.score = Math.max(0, state.score - 8);
      if (item.kind === 'storm') state.stormHits += 1;
      fx(cx, cy, 'MISS', '#d16b27');
      setBanner(item.kind === 'storm' ? 'อย่ากดพายุ junk!' : 'ระวัง junk!', 700);
      removeItem(item);
    } else if (item.kind === 'weak') {
      state.powerHits += 1;
      state.streak += 1;
      state.bestStreak = Math.max(state.bestStreak, state.streak);

      const damage = state.boss.stage === 2 ? 2 : 1;
      state.boss.hp = Math.max(0, state.boss.hp - damage);
      state.score += damage === 2 ? 24 : 15;

      fx(cx, cy, damage === 2 ? 'CRUSH!' : 'POWER!', '#cf8a00');
      removeItem(item);

      if (state.boss.hp <= 0) {
        endGame(true);
        return;
      }

      setBossStage();
      setBanner(
        state.boss.stage === 1 ? 'Boss Stage 1 • Learn'
        : state.boss.stage === 2 ? 'Boss Stage 2 • Pressure'
        : 'Boss Stage 3 • Final',
        900
      );
    }

    renderHud();
  }

  function missGood(item) {
    state.miss += 1;
    state.missedGood += 1;
    state.streak = 0;
    fx(item.x + item.size / 2, Math.max(30, item.y), 'พลาดของดี', '#d18d00');
    removeItem(item);
    renderHud();
  }

  function spawnFood(phase) {
    const r = stageRect();
    const phase2 = phase === 2;
    const goodRatio = phase2 ? 0.58 : 0.7;
    const isGood = rand() < goodRatio;
    const size = phase2 ? range(52, 78) : range(58, 86);
    const x = range(10, Math.max(12, r.width - size - 10));
    const y = -size - range(0, 30);
    const vx = range(-40, 40);
    const vy = phase2 ? range(160, 260) : range(110, 180);

    createItem(
      isGood ? 'good' : 'junk',
      isGood ? GOOD[Math.floor(rand() * GOOD.length)] : JUNK[Math.floor(rand() * JUNK.length)],
      x, y, size, vx, vy,
      isGood ? 'good' : 'junk'
    );
  }

  function spawnStorm() {
    const r = stageRect();
    const size = range(42, 62);
    const x = range(10, Math.max(12, r.width - size - 10));
    const y = -size - range(0, 20);
    const vx = range(-60, 60);
    const vy = state.boss.stage === 3 ? range(240, 360) : range(180, 280);
    state.spawnedStorm += 1;
    createItem('storm', JUNK[Math.floor(rand() * JUNK.length)], x, y, size, vx, vy, 'storm');
  }

  function spawnWeak() {
    if (state.boss.weakId) return;

    const r = stageRect();
    const size = state.boss.stage === 1 ? cfg.weakSize + 14 : state.boss.stage === 2 ? cfg.weakSize + 4 : cfg.weakSize - 4;
    const x = range(20, Math.max(22, r.width - size - 20));
    const y = range(140, Math.max(150, r.height - size - 40));
    const speed = state.boss.stage === 1 ? cfg.weakSpeed * 0.82 : state.boss.stage === 2 ? cfg.weakSpeed : cfg.weakSpeed * 1.15;

    const item = createItem('weak', '🎯', x, y, size, range(-speed, speed), range(-speed, speed), 'weak');
    state.boss.weakId = item.id;
  }

  function updateWeak(item, dt, r) {
    item.x += item.vx * dt / 1000;
    item.y += item.vy * dt / 1000;

    const minY = 120;

    if (item.x <= 8) { item.x = 8; item.vx *= -1; }
    if (item.x + item.size >= r.width - 8) { item.x = r.width - item.size - 8; item.vx *= -1; }
    if (item.y <= minY) { item.y = minY; item.vy *= -1; }
    if (item.y + item.size >= r.height - 18) { item.y = r.height - item.size - 18; item.vy *= -1; }

    drawItem(item);
  }

  function enterPhase2() {
    state.phase = 2;
    clearItems();
    state.spawnAcc = 0;
    setBanner('Phase 2 • เร็วขึ้นและกดดันขึ้น', 1200);
    renderHud();
  }

  function enterBoss() {
    state.phase = 3;
    state.boss.active = true;
    state.boss.hp = cfg.bossHp;
    state.boss.maxHp = cfg.bossHp;
    state.boss.stage = 1;
    state.boss.pattern = 'learn';
    clearItems();
    state.spawnAcc = 0;
    state.stormAcc = 0;
    state.weakMoveAcc = 0;
    setBanner('Boss Phase • Junk King มาแล้ว!', 1400);
    spawnWeak();
    renderHud();
  }

  function clearItems() {
    state.items.forEach(removeItem);
    state.items.clear();
    state.boss.weakId = '';
  }

  function update(dt) {
    state.timeLeft -= dt;
    if (state.timeLeft <= 0) {
      state.timeLeft = 0;
      endGame(false);
      return;
    }

    const r = stageRect();

    if (!state.boss.active) {
      const spawnEvery = state.phase === 1 ? cfg.spawn1 : cfg.spawn2;
      state.spawnAcc += dt;
      while (state.spawnAcc >= spawnEvery) {
        state.spawnAcc -= spawnEvery;
        spawnFood(state.phase);
      }
    } else {
      state.stormAcc += dt;
      if (state.stormAcc >= cfg.storm) {
        state.stormAcc = 0;
        spawnStorm();
      }
      spawnWeak();
    }

    state.items.forEach((item) => {
      if (item.dead) return;

      if (item.kind === 'weak') {
        updateWeak(item, dt, r);
        return;
      }

      item.x += item.vx * dt / 1000;
      item.y += item.vy * dt / 1000;

      if (item.x <= 8) { item.x = 8; item.vx *= -1; }
      if (item.x + item.size >= r.width - 8) { item.x = r.width - item.size - 8; item.vx *= -1; }

      drawItem(item);

      if (item.y > r.height + item.size * 0.5) {
        if (item.kind === 'good') missGood(item);
        else removeItem(item);
      }
    });

    if (!state.boss.active && state.phase === 1 && state.score >= cfg.p1Goal) {
      enterPhase2();
    } else if (!state.boss.active && state.phase === 2 && state.score >= cfg.p2Goal) {
      enterBoss();
    }

    if (state.boss.active) {
      setBossStage();
    }

    renderHud();
  }

  function loop(ts) {
    if (!state.running || state.ended) return;

    const dt = Math.min(40, (ts - state.lastTs) || 16);
    state.lastTs = ts;

    update(dt);
    state.raf = requestAnimationFrame(loop);
  }

  function starsFromSummary(bossClear) {
    if (bossClear && state.miss <= 5) return 3;
    if (bossClear || state.boss.active) return 2;
    return 1;
  }

  function endGame(bossClear) {
    if (state.ended) return;
    state.ended = true;
    state.running = false;
    cancelAnimationFrame(state.raf);
    clearItems();

    const stars = starsFromSummary(bossClear);
    const summary = {
      source: 'goodjunk-solo-phaseboss-v2-safe',
      gameId: ctx.gameId || 'goodjunk',
      mode: 'solo',
      pid: ctx.pid || 'anon',
      studyId: ctx.studyId || '',
      diff: diffKey,
      run: ctx.run || 'play',
      score: state.score,
      miss: state.miss,
      bestStreak: state.bestStreak,
      hitsGood: state.hitsGood,
      hitsBad: state.hitsBad,
      missedGood: state.missedGood,
      powerHits: state.powerHits,
      stormHits: state.stormHits,
      stormSpawned: state.spawnedStorm,
      bossDefeated: !!bossClear,
      phaseReached: state.boss.active ? 'boss' : `phase-${state.phase}`,
      updatedAt: Date.now()
    };

    saveSummary(summary);

    ui.sumTitle.textContent = bossClear ? 'Food Hero Complete!' : 'Great Job!';
    ui.sumSub.textContent = bossClear
      ? 'เธอช่วยปกป้องเมืองอาหารดีและเอาชนะ Junk King ได้แล้ว'
      : state.phase >= 2
        ? 'ผ่านด่านก่อนบอสได้ดีมาก รอบหน้าลุยต่อได้อีก'
        : 'เริ่มต้นได้ดีมาก เก็บอาหารดีต่อไปนะ';
    ui.sumStars.textContent = '⭐'.repeat(stars);

    ui.sumGrid.innerHTML = `
      <div class="gjsb-stat"><div class="k">Score</div><div class="v">${state.score}</div></div>
      <div class="gjsb-stat"><div class="k">Miss</div><div class="v">${state.miss}</div></div>
      <div class="gjsb-stat"><div class="k">Best Streak</div><div class="v">${state.bestStreak}</div></div>
      <div class="gjsb-stat"><div class="k">Reached</div><div class="v">${bossClear ? 'Boss Clear' : (state.boss.active ? 'Boss' : `Phase ${state.phase}`)}</div></div>
      <div class="gjsb-stat"><div class="k">Good Hit</div><div class="v">${state.hitsGood}</div></div>
      <div class="gjsb-stat"><div class="k">Power Hit</div><div class="v">${state.powerHits}</div></div>
    `;

    ui.summary.classList.add('show');
  }

  function bindButtons() {
    ui.btnReplay.addEventListener('click', function () {
      location.href = buildReplayUrl();
    });

    ui.btnCooldown.addEventListener('click', function () {
      location.href = buildCooldownUrl();
    });

    ui.btnHub.addEventListener('click', function () {
      location.href = ctx.hub || new URL('./hub.html', location.href).toString();
    });
  }

  function start() {
    window.__GJ_ENGINE_MOUNTED__ = true;
    state.running = true;
    state.lastTs = performance.now();
    renderHud();
    setBanner('เริ่มเลย! เก็บอาหารดี แล้วหลีกเลี่ยง junk', 1300);
    state.raf = requestAnimationFrame(loop);
  }

  injectStyle();
  const ui = buildUI();
  bindButtons();
  window.__GJ_ENGINE_MOUNTED__ = true;
  start();
})();