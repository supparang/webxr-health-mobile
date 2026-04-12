(function () {
  'use strict';

  const W = window;
  const D = document;

  const ctx = W.__GJ_RUN_CTX__ || {};
  const MODE = String(ctx.mode || 'duet').trim().toLowerCase();

  const GOOD = ['🍎','🥕','🥦','🍌','🥛','🥗','🍉','🐟'];
  const JUNK = ['🍟','🍩','🍭','🍔','🥤','🍕','🧁','🍫'];

  const MODE_LABEL = {
    duet: 'DUET',
    race: 'RACE',
    battle: 'BATTLE',
    coop: 'CO-OP'
  };

  const MODE_ICON = {
    duet: '🤝',
    race: '🏁',
    battle: '⚔️',
    coop: '🫶'
  };

  const MODE_TITLE = {
    duet: 'GoodJunk Duet',
    race: 'GoodJunk Race',
    battle: 'GoodJunk Battle',
    coop: 'GoodJunk Co-op'
  };

  function clean(v, fallback='') {
    const s = String(v || '').trim();
    return s || fallback;
  }

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, Number(v) || 0));
  }

  function nowMs() {
    return (performance && performance.now) ? performance.now() : Date.now();
  }

  function fmtTime(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  const state = {
    running: false,
    ended: false,
    paused: false,
    raf: 0,
    lastTs: 0,
    spawnAcc: 0,

    timeTotal: Math.max(45, Number(ctx.time || 90)) * 1000,
    timeLeft: Math.max(45, Number(ctx.time || 90)) * 1000,

    score: 0,
    miss: 0,
    streak: 0,
    bestStreak: 0,
    hitsGood: 0,
    hitsBad: 0,

    roomId: clean(ctx.roomId || ''),
    role: clean(ctx.role || 'player'),
    mode: MODE,

    teamScore: 0,
    teamMiss: 0,
    teamCombo: 0,
    teamGoal: 0,
    teamGoalMax: MODE === 'coop' ? 120 : 0,
    contribution: 0,
    enemyScore: 0,
    attacksSent: 0,
    attacksReceived: 0,
    rank: 1,
    leaderScore: 0,

    items: new Map(),
    seq: 0
  };

  W.state = state;
  W.ctx = ctx;

  const root = D.getElementById('gameMount') || D.body;

  root.innerHTML = `
    <div id="gjRoot" class="gj-root">
      <div class="gj-stage" id="gjStage">
        <div class="gj-cloud c1"></div>
        <div class="gj-cloud c2"></div>
        <div class="gj-cloud c3"></div>
        <div class="gj-ground"></div>

        <div class="gj-hud">
          <div class="gj-chip" id="hudMode">${MODE_ICON[MODE] || '🎮'} ${MODE_LABEL[MODE] || MODE}</div>
          <div class="gj-chip" id="hudScore">Score • 0</div>
          <div class="gj-chip" id="hudTime">Time • 0:00</div>
          <div class="gj-chip" id="hudMiss">Miss • 0</div>
          <div class="gj-chip" id="hudStreak">Streak • 0</div>
        </div>

        <div class="gj-banner" id="hudBanner">เก็บ good และหลบ junk</div>

        <div class="gj-arena" id="gjArena"></div>

        <div class="gj-bottomActions">
          <button class="gj-btn small" id="btnPause" type="button">⏸ Pause</button>
          <button class="gj-btn small" id="btnEndNow" type="button">✅ จบเกม</button>
        </div>

        <div class="gjsb-summary" id="summary">
          <div class="gjsb-summary-card" id="summaryCard">
            <div class="gjsb-summary-head">
              <div class="gjsb-medal" id="sumMedal">⭐</div>
              <div class="gjsb-grade b" id="sumGrade">OK</div>
              <h2 id="sumTitle" style="margin:8px 0 0;font-size:38px;line-height:1.05;color:#67a91c;">Match Complete!</h2>
              <div id="sumSub" style="margin-top:6px;font-size:15px;color:#7b7a72;font-weight:1000;">สรุปผลการเล่น</div>
              <div class="gjsb-stars" id="sumStars">⭐⭐</div>
            </div>

            <div class="gjsb-summary-grid" id="sumGrid"></div>
            <div class="gjsb-coach" id="sumCoach">เล่นได้ดีมาก</div>
            <div class="gjsb-nextHint" id="sumNextHint">เป้าหมายต่อไป: เก็บ good ให้มากขึ้น</div>
            <div class="gjsb-exportBox" id="sumExportBox">payload พร้อมสรุป</div>

            <div class="gjsb-actions">
              <button class="gjsb-btn replay" id="btnReplay">🔁 เล่นใหม่</button>
              <button class="gjsb-btn cooldown" id="btnCooldown">🧊 ไป Cooldown</button>
              <button class="gjsb-btn hub" id="btnHub">🏠 กลับ HUB</button>
            </div>
          </div>
        </div>

        <div class="gj-pause" id="pauseOverlay">
          <div class="gj-pause-card">
            <div class="gj-pause-title">พักก่อนนะ</div>
            <div class="gj-pause-sub">เกมถูกหยุดไว้ชั่วคราว</div>
            <div class="gj-pause-actions">
              <button class="gj-btn" id="btnResume" type="button">▶️ เล่นต่อ</button>
              <button class="gj-btn ghost" id="btnPauseHub" type="button">🏠 กลับ HUB</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  const style = D.createElement('style');
  style.textContent = `
    .gj-root{
      position:absolute;
      inset:0;
      overflow:hidden;
      font-family:system-ui,-apple-system,"Segoe UI",sans-serif;
    }
    .gj-stage{
      position:absolute;
      inset:0;
      overflow:hidden;
      background:
        radial-gradient(circle at 20% 16%, rgba(255,255,255,.12), transparent 18%),
        radial-gradient(circle at 82% 10%, rgba(255,255,255,.10), transparent 18%),
        linear-gradient(180deg,#93d9ff 0%, #ccefff 54%, #fff3c9 100%);
    }
    .gj-ground{
      position:absolute;
      left:0; right:0; bottom:0;
      height:18%;
      background:linear-gradient(180deg,#9be26a,#67c94c);
      box-shadow:inset 0 4px 0 rgba(255,255,255,.25);
    }
    .gj-cloud{
      position:absolute;
      width:110px;
      height:34px;
      border-radius:999px;
      background:rgba(255,255,255,.75);
      filter:blur(.5px);
      box-shadow:
        40px 0 0 4px rgba(255,255,255,.75),
        82px 6px 0 0 rgba(255,255,255,.65);
      opacity:.9;
    }
    .gj-cloud.c1{ left:6%; top:8%; }
    .gj-cloud.c2{ left:64%; top:13%; transform:scale(1.18); }
    .gj-cloud.c3{ left:30%; top:22%; transform:scale(.9); }

    .gj-hud{
      position:absolute;
      left:8px;
      right:8px;
      top:8px;
      z-index:20;
      display:grid;
      grid-template-columns:repeat(auto-fit,minmax(110px,1fr));
      gap:6px;
    }

    .gj-chip{
      min-height:30px;
      padding:6px 8px;
      border-radius:999px;
      background:rgba(255,255,255,.88);
      color:#55514a;
      box-shadow:0 6px 12px rgba(86,155,194,.10);
      border:2px solid rgba(191,227,242,.95);
      font-size:11px;
      font-weight:1000;
      text-align:center;
    }

    .gj-banner{
      position:absolute;
      left:50%;
      top:56px;
      transform:translateX(-50%);
      z-index:21;
      min-height:34px;
      padding:8px 14px;
      border-radius:999px;
      background:#fff;
      color:#666055;
      border:2px solid rgba(191,227,242,.95);
      font-size:12px;
      font-weight:1000;
      box-shadow:0 8px 18px rgba(86,155,194,.10);
    }

    .gj-arena{
      position:absolute;
      inset:98px 8px 96px 8px;
      overflow:hidden;
      z-index:10;
    }

    .gj-item{
      position:absolute;
      left:0;
      top:0;
      display:grid;
      place-items:center;
      border:none;
      cursor:pointer;
      border-radius:22px;
      background:rgba(255,255,255,.92);
      box-shadow:0 10px 22px rgba(86,155,194,.18);
      border:3px solid rgba(191,227,242,.95);
      user-select:none;
      -webkit-user-select:none;
    }

    .gj-item.good{
      background:linear-gradient(180deg,#f7fff1,#ffffff);
    }

    .gj-item.junk{
      background:linear-gradient(180deg,#fff3f3,#ffffff);
      border-color:#ffd3d3;
    }

    .gj-emoji{
      font-size:34px;
      line-height:1;
      pointer-events:none;
    }

    .gj-tag{
      position:absolute;
      left:6px;
      right:6px;
      bottom:4px;
      text-align:center;
      font-size:10px;
      font-weight:1000;
      pointer-events:none;
      color:#666055;
    }

    .gj-fx{
      position:absolute;
      transform:translate(-50%,-50%);
      font-size:16px;
      font-weight:1000;
      z-index:30;
      pointer-events:none;
      animation:gjFx .75s ease forwards;
      text-shadow:0 8px 18px rgba(0,0,0,.14);
    }

    @keyframes gjFx{
      from{ opacity:1; transform:translate(-50%,-10%); }
      to{ opacity:0; transform:translate(-50%,-150%); }
    }

    .gj-bottomActions{
      position:absolute;
      left:8px;
      right:8px;
      bottom:12px;
      z-index:22;
      display:flex;
      gap:8px;
      justify-content:flex-end;
    }

    .gj-btn{
      border:none;
      border-radius:16px;
      min-height:42px;
      padding:10px 14px;
      background:linear-gradient(180deg,#7fcfff,#58b7f5);
      color:#08374d;
      font-size:14px;
      font-weight:1000;
      cursor:pointer;
      box-shadow:0 10px 18px rgba(86,155,194,.12);
    }

    .gj-btn.small{
      min-height:38px;
      font-size:12px;
      padding:8px 12px;
    }

    .gj-btn.ghost{
      background:#fff;
      color:#6c6a61;
      border:3px solid #d7edf7;
    }

    .gj-pause{
      position:absolute;
      inset:0;
      z-index:70;
      display:none;
      place-items:center;
      background:rgba(255,255,255,.42);
      backdrop-filter:blur(4px);
    }

    .gj-pause.show{ display:grid; }

    .gj-pause-card{
      width:min(88vw,420px);
      border-radius:24px;
      background:linear-gradient(180deg,#fffef8,#fff);
      border:4px solid #d7edf7;
      box-shadow:0 18px 36px rgba(86,155,194,.18);
      padding:18px;
      text-align:center;
      color:#5a554c;
    }

    .gj-pause-title{
      font-size:28px;
      line-height:1.08;
      font-weight:1000;
      color:#67a91c;
    }

    .gj-pause-sub{
      margin-top:8px;
      font-size:14px;
      line-height:1.55;
      color:#7b7a72;
      font-weight:1000;
    }

    .gj-pause-actions{
      display:grid;
      gap:10px;
      margin-top:16px;
    }

    .gjsb-summary{
      position:absolute;
      inset:0;
      z-index:80;
      display:none;
      place-items:center;
      background:
        radial-gradient(circle at 50% 22%, rgba(255,255,255,.34), transparent 22%),
        rgba(255,255,255,.26);
      backdrop-filter: blur(7px);
      padding:16px;
    }

    .gjsb-summary.show{ display:grid; }

    .gjsb-summary-card{
      width:min(94vw,760px);
      max-height:88vh;
      overflow:auto;
      border-radius:28px;
      background:linear-gradient(180deg,#fffef8,#f8fff3);
      border:5px solid #bfe3f2;
      box-shadow:0 24px 52px rgba(86,155,194,.22);
      padding:18px;
      color:#55514a;
    }

    .gjsb-summary-head{
      text-align:center;
      margin-bottom:14px;
    }

    .gjsb-medal{
      margin:10px auto 0;
      width:110px;
      height:110px;
      border-radius:32px;
      display:grid;
      place-items:center;
      font-size:50px;
      background:linear-gradient(180deg,#fff8d8,#fffef6);
      border:4px solid #d7edf7;
      box-shadow:0 12px 24px rgba(86,155,194,.14);
    }

    .gjsb-grade{
      margin-top:10px;
      display:inline-flex;
      align-items:center;
      justify-content:center;
      min-width:110px;
      padding:10px 16px;
      border-radius:999px;
      font-size:24px;
      font-weight:1000;
      background:#fff;
      border:3px solid #d7edf7;
      color:#5a6f80;
    }

    .gjsb-stars{
      font-size:30px;
      line-height:1;
      margin:10px 0 6px;
    }

    .gjsb-summary-grid{
      display:grid;
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap:10px;
    }

    .gjsb-stat{
      border-radius:18px;
      background:#fff;
      border:3px solid #d7edf7;
      padding:12px;
    }

    .gjsb-stat .k{
      font-size:12px;
      color:#7b7a72;
      font-weight:1000;
    }

    .gjsb-stat .v{
      margin-top:6px;
      font-size:24px;
      font-weight:1000;
      line-height:1.2;
    }

    .gjsb-coach,
    .gjsb-nextHint,
    .gjsb-exportBox{
      margin-top:12px;
      border-radius:18px;
      background:linear-gradient(180deg,#fffef6,#fff);
      border:3px solid #d7edf7;
      padding:12px 14px;
      font-size:14px;
      line-height:1.5;
      color:#6b675f;
      font-weight:1000;
    }

    .gjsb-actions{
      display:grid;
      gap:10px;
      margin-top:16px;
    }

    .gjsb-btn{
      border:none;
      border-radius:18px;
      padding:14px 16px;
      font-size:16px;
      font-weight:1000;
      cursor:pointer;
      box-shadow:0 10px 18px rgba(86,155,194,.10);
    }

    .gjsb-btn.replay{ background:linear-gradient(180deg,#7ed957,#58c33f); color:#173b0b; }
    .gjsb-btn.cooldown{ background:linear-gradient(180deg,#7fcfff,#58b7f5); color:#08374d; }
    .gjsb-btn.hub{ background:#fff; color:#6c6a61; border:3px solid #d7edf7; }

    @media (max-width:720px){
      .gj-hud{
        grid-template-columns:repeat(3,minmax(0,1fr));
      }
      .gj-chip{
        font-size:10px;
        min-height:28px;
        padding:4px 6px;
      }
      .gj-arena{
        inset:94px 8px 92px 8px;
      }
      .gjsb-summary-grid{
        grid-template-columns:1fr;
      }
    }
  `;
  D.head.appendChild(style);

  const ui = {
    stage: D.getElementById('gjStage'),
    arena: D.getElementById('gjArena'),
    hudMode: D.getElementById('hudMode'),
    hudScore: D.getElementById('hudScore'),
    hudTime: D.getElementById('hudTime'),
    hudMiss: D.getElementById('hudMiss'),
    hudStreak: D.getElementById('hudStreak'),
    banner: D.getElementById('hudBanner'),

    btnPause: D.getElementById('btnPause'),
    btnEndNow: D.getElementById('btnEndNow'),
    btnResume: D.getElementById('btnResume'),
    btnPauseHub: D.getElementById('btnPauseHub'),

    pauseOverlay: D.getElementById('pauseOverlay'),

    summary: D.getElementById('summary'),
    summaryCard: D.getElementById('summaryCard'),
    sumTitle: D.getElementById('sumTitle'),
    sumSub: D.getElementById('sumSub'),
    sumMedal: D.getElementById('sumMedal'),
    sumGrade: D.getElementById('sumGrade'),
    sumStars: D.getElementById('sumStars'),
    sumGrid: D.getElementById('sumGrid'),
    sumCoach: D.getElementById('sumCoach'),
    sumNextHint: D.getElementById('sumNextHint'),
    sumExportBox: D.getElementById('sumExportBox'),
    btnReplay: D.getElementById('btnReplay'),
    btnCooldown: D.getElementById('btnCooldown'),
    btnHub: D.getElementById('btnHub')
  };

  W.ui = ui;

  function buildHubUrl() {
    return clean(ctx.hub, new URL('../hub-v2.html', location.href).toString());
  }

  function buildReplayUrl() {
    const mode = MODE;
    const pathMap = {
      duet: '../goodjunk-duet-play.html',
      race: '../goodjunk-race-play.html',
      battle: '../goodjunk-battle-play.html',
      coop: '../goodjunk-coop-play.html'
    };
    const u = new URL(pathMap[mode] || '../goodjunk-launcher.html', location.href);
    const nextSeed = String(Date.now());

    u.searchParams.set('pid', clean(ctx.pid, 'anon'));
    u.searchParams.set('name', clean(ctx.name || ctx.nick, 'Hero'));
    u.searchParams.set('nick', clean(ctx.nick || ctx.name, 'Hero'));
    u.searchParams.set('mode', mode);
    u.searchParams.set('entry', mode);
    u.searchParams.set('recommendedMode', mode);
    u.searchParams.set('diff', clean(ctx.diff, 'normal'));
    u.searchParams.set('time', String(Math.round(state.timeTotal / 1000)));
    u.searchParams.set('seed', nextSeed);
    u.searchParams.set('hub', buildHubUrl());
    u.searchParams.set('view', clean(ctx.view, 'mobile'));
    u.searchParams.set('run', clean(ctx.run, 'play'));
    u.searchParams.set('zone', clean(ctx.zone, 'nutrition'));
    u.searchParams.set('cat', clean(ctx.cat, 'nutrition'));
    u.searchParams.set('game', clean(ctx.game, 'goodjunk'));
    u.searchParams.set('gameId', clean(ctx.gameId, 'goodjunk'));
    u.searchParams.set('theme', 'goodjunk');
    if (state.roomId) {
      u.searchParams.set('roomId', state.roomId);
      u.searchParams.set('room', state.roomId);
    }
    u.searchParams.set('role', state.role || 'player');
    return u.toString();
  }

  function buildCooldownUrl() {
    const u = new URL('../warmup-gate.html', location.href);
    u.searchParams.set('phase', 'cooldown');
    u.searchParams.set('gatePhase', 'cooldown');
    u.searchParams.set('game', 'goodjunk');
    u.searchParams.set('gameId', 'goodjunk');
    u.searchParams.set('theme', 'goodjunk');
    u.searchParams.set('cat', clean(ctx.cat, 'nutrition'));
    u.searchParams.set('zone', clean(ctx.zone, 'nutrition'));
    u.searchParams.set('pid', clean(ctx.pid, 'anon'));
    u.searchParams.set('name', clean(ctx.name || ctx.nick, 'Hero'));
    u.searchParams.set('diff', clean(ctx.diff, 'normal'));
    u.searchParams.set('time', String(Math.round(state.timeTotal / 1000)));
    u.searchParams.set('seed', clean(ctx.seed, String(Date.now())));
    u.searchParams.set('view', clean(ctx.view, 'mobile'));
    u.searchParams.set('run', clean(ctx.run, 'play'));
    u.searchParams.set('hub', buildHubUrl());
    u.searchParams.set('mode', MODE);
    u.searchParams.set('entry', MODE);
    u.searchParams.set('recommendedMode', MODE);
    if (state.roomId) {
      u.searchParams.set('roomId', state.roomId);
      u.searchParams.set('room', state.roomId);
    }
    u.searchParams.set('role', state.role || 'player');
    return u.toString();
  }

  function emitFx(x, y, text, color) {
    const el = D.createElement('div');
    el.className = 'gj-fx';
    el.textContent = text;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.color = color || '#333';
    ui.stage.appendChild(el);
    setTimeout(() => {
      try { el.remove(); } catch (_) {}
    }, 760);
  }

  function setBanner(text) {
    if (ui.banner) ui.banner.textContent = text;
  }

  function renderHud() {
    if (ui.hudMode) ui.hudMode.textContent = `${MODE_ICON[MODE] || '🎮'} ${MODE_LABEL[MODE] || MODE}`;
    if (ui.hudScore) ui.hudScore.textContent = `Score • ${state.score}`;
    if (ui.hudTime) ui.hudTime.textContent = `Time • ${fmtTime(state.timeLeft)}`;
    if (ui.hudMiss) ui.hudMiss.textContent = `Miss • ${state.miss}`;
    if (ui.hudStreak) ui.hudStreak.textContent = `Streak • ${state.streak}`;
  }

  function createItem(kind) {
    const arenaRect = ui.arena.getBoundingClientRect();
    const size = rand(56, 82);
    const x = rand(6, Math.max(8, arenaRect.width - size - 6));
    const y = -size - rand(0, 40);
    const vy = kind === 'good' ? rand(140, 220) : rand(170, 260);
    const vx = rand(-32, 32);

    const el = D.createElement('button');
    el.type = 'button';
    el.className = `gj-item ${kind}`;
    el.style.width = size + 'px';
    el.style.height = size + 'px';
    el.innerHTML = `
      <div class="gj-emoji">${kind === 'good' ? pick(GOOD) : pick(JUNK)}</div>
      <div class="gj-tag">${kind}</div>
    `;

    ui.arena.appendChild(el);

    const item = {
      id: 'it-' + (++state.seq),
      kind,
      x,
      y,
      size,
      vx,
      vy,
      dead: false,
      el
    };

    el.addEventListener('pointerdown', function (ev) {
      ev.preventDefault();
      onHit(item);
    }, { passive: false });

    state.items.set(item.id, item);
    drawItem(item);
    return item;
  }

  function drawItem(item) {
    item.el.style.left = item.x + 'px';
    item.el.style.top = item.y + 'px';
  }

  function removeItem(item) {
    if (!item || item.dead) return;
    item.dead = true;
    try { item.el.remove(); } catch (_) {}
    state.items.delete(item.id);
  }

  function onHit(item) {
    if (!state.running || state.ended || state.paused || !item || item.dead) return;

    const cx = item.x + item.size / 2;
    const cy = item.y + item.size / 2;

    if (item.kind === 'good') {
      state.hitsGood += 1;
      state.streak += 1;
      state.bestStreak = Math.max(state.bestStreak, state.streak);

      const bonus = Math.floor(state.streak / 4);
      const gain = 10 + bonus;
      state.score += gain;

      if (MODE === 'duet') {
        state.teamScore = state.score;
        state.teamCombo = state.bestStreak;
      }
      if (MODE === 'coop') {
        state.teamScore = state.score;
        state.teamGoal = Math.min(state.teamGoalMax, state.teamGoal + 6);
        state.contribution += 6;
      }
      if (MODE === 'race') {
        state.leaderScore = Math.max(state.leaderScore, state.score + rand(0, 20));
        state.rank = state.score >= state.leaderScore - 8 ? 1 : 2;
      }
      if (MODE === 'battle') {
        if (Math.random() < 0.28) state.attacksSent += 1;
        state.enemyScore = Math.max(state.enemyScore, Math.round(state.score * rand(0.7, 1.15)));
      }

      emitFx(cx, cy, '+' + gain, '#2f8f2f');
      setBanner(state.streak >= 5 ? 'คอมโบดีมาก!' : 'เก็บ good ต่อไป!');
      removeItem(item);
    } else {
      state.hitsBad += 1;
      state.miss += 1;
      state.streak = 0;
      state.score = Math.max(0, state.score - 8);

      if (MODE === 'duet') {
        state.teamMiss = state.miss;
      }
      if (MODE === 'coop') {
        state.teamMiss = state.miss;
      }
      if (MODE === 'battle') {
        state.attacksReceived += 1;
      }

      emitFx(cx, cy, 'MISS', '#d16b27');
      setBanner('หลบ junk ให้ดี!');
      removeItem(item);
    }

    renderHud();
  }

  function updateItems(dt) {
    const arenaRect = ui.arena.getBoundingClientRect();

    state.items.forEach((item) => {
      if (item.dead) return;

      item.x += item.vx * dt / 1000;
      item.y += item.vy * dt / 1000;

      if (item.x <= 4) {
        item.x = 4;
        item.vx *= -1;
      }
      if (item.x + item.size >= arenaRect.width - 4) {
        item.x = arenaRect.width - item.size - 4;
        item.vx *= -1;
      }

      drawItem(item);

      if (item.y > arenaRect.height + item.size * 0.5) {
        if (item.kind === 'good') {
          state.miss += 1;
          state.streak = 0;
          if (MODE === 'duet') state.teamMiss = state.miss;
          if (MODE === 'coop') state.teamMiss = state.miss;
        }
        removeItem(item);
      }
    });
  }

  function openSummary() {
    if (ui.summary) ui.summary.classList.add('show');

    if (ui.sumTitle) ui.sumTitle.textContent = 'Match Complete!';
    if (ui.sumSub) ui.sumSub.textContent = 'สรุปผลการเล่น';
    if (ui.sumMedal) ui.sumMedal.textContent = '⭐';
    if (ui.sumGrade) {
      ui.sumGrade.textContent = 'OK';
      ui.sumGrade.className = 'gjsb-grade b';
    }
    if (ui.sumStars) ui.sumStars.textContent = '⭐⭐';

    if (ui.sumGrid) {
      ui.sumGrid.innerHTML = [
        `<div class="gjsb-stat"><div class="k">โหมด</div><div class="v">${MODE.toUpperCase()}</div></div>`,
        `<div class="gjsb-stat"><div class="k">คะแนน</div><div class="v">${state.score}</div></div>`,
        `<div class="gjsb-stat"><div class="k">Miss</div><div class="v">${state.miss}</div></div>`,
        `<div class="gjsb-stat"><div class="k">Best Streak</div><div class="v">${state.bestStreak}</div></div>`
      ].join('');
    }

    if (ui.sumCoach) ui.sumCoach.textContent = 'กำลังสร้างสรุปผลของโหมดนี้';
    if (ui.sumNextHint) ui.sumNextHint.textContent = 'เป้าหมายต่อไป: เก็บ good ให้มากขึ้น';
    if (ui.sumExportBox) ui.sumExportBox.innerHTML = `<strong>generic summary</strong><br>mode: ${MODE}`;

    if (W.GJSummaryRewriteHotfix && typeof W.GJSummaryRewriteHotfix.rewriteSummaryNow === 'function') {
      setTimeout(function () {
        W.GJSummaryRewriteHotfix.rewriteSummaryNow();
      }, 0);
    }
  }

  function endGame() {
    if (state.ended) return;
    state.ended = true;
    state.running = false;

    try { cancelAnimationFrame(state.raf); } catch (_) {}

    state.teamScore = MODE === 'duet' || MODE === 'coop' ? state.score : state.teamScore;
    state.teamMiss = MODE === 'duet' || MODE === 'coop' ? state.miss : state.teamMiss;
    state.teamCombo = MODE === 'duet' ? state.bestStreak : state.teamCombo;
    state.leaderScore = MODE === 'race' ? Math.max(state.leaderScore, state.score + 3) : state.leaderScore;
    state.rank = MODE === 'race' ? (state.score >= state.leaderScore - 8 ? 1 : 2) : state.rank;
    state.enemyScore = MODE === 'battle' ? Math.max(state.enemyScore, Math.round(state.score * 0.92)) : state.enemyScore;

    openSummary();
  }

  function pauseGame() {
    if (state.ended) return;
    state.paused = true;
    if (ui.pauseOverlay) ui.pauseOverlay.classList.add('show');
  }

  function resumeGame() {
    if (state.ended) return;
    state.paused = false;
    if (ui.pauseOverlay) ui.pauseOverlay.classList.remove('show');
    state.lastTs = nowMs();
  }

  function loop(ts) {
    if (!state.running || state.ended) return;

    const dt = Math.min(40, (ts - state.lastTs) || 16);
    state.lastTs = ts;

    if (!state.paused) {
      state.timeLeft -= dt;
      if (state.timeLeft <= 0) {
        state.timeLeft = 0;
        renderHud();
        endGame();
        return;
      }

      state.spawnAcc += dt;
      const spawnEvery = 560;

      while (state.spawnAcc >= spawnEvery) {
        state.spawnAcc -= spawnEvery;
        createItem(Math.random() < 0.72 ? 'good' : 'junk');
      }

      updateItems(dt);
      renderHud();
    }

    state.raf = requestAnimationFrame(loop);
  }

  function bind() {
    if (ui.btnPause) {
      ui.btnPause.addEventListener('click', function () {
        if (state.paused) resumeGame();
        else pauseGame();
      });
    }

    if (ui.btnResume) {
      ui.btnResume.addEventListener('click', function () {
        resumeGame();
      });
    }

    if (ui.btnPauseHub) {
      ui.btnPauseHub.addEventListener('click', function () {
        location.href = buildHubUrl();
      });
    }

    if (ui.btnEndNow) {
      ui.btnEndNow.addEventListener('click', function () {
        endGame();
      });
    }

    if (ui.btnReplay) {
      ui.btnReplay.addEventListener('click', function () {
        location.href = buildReplayUrl();
      });
    }

    if (ui.btnCooldown) {
      ui.btnCooldown.addEventListener('click', function () {
        location.href = buildCooldownUrl();
      });
    }

    if (ui.btnHub) {
      ui.btnHub.addEventListener('click', function () {
        location.href = buildHubUrl();
      });
    }

    W.addEventListener('blur', function () {
      if (!state.ended) pauseGame();
    });

    D.addEventListener('visibilitychange', function () {
      if (D.hidden && !state.ended) pauseGame();
    });
  }

  function start() {
    bind();
    renderHud();
    setBanner('เก็บ good และหลบ junk');
    state.running = true;
    state.lastTs = nowMs();
    state.raf = requestAnimationFrame(loop);
  }

  start();
})();