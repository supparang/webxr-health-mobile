<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
  <title>HeroHealth • GoodJunk Duet Runtime</title>
  <meta name="theme-color" content="#9fe3ff" />
  <link rel="icon" href="./favicon.ico" />

  <style>
    :root{
      --sky1:#dff4ff;
      --sky2:#bfe8ff;
      --sky3:#fff7d8;
      --line:#bfe3f2;
      --text:#4d4a42;
      --muted:#7b7a72;
      --green:#7ed957;
      --green2:#58c33f;
      --blue:#7fcfff;
      --blue2:#58b7f5;
      --red:#ff7a7a;
      --red2:#ff5252;
      --yellow:#ffd75a;
      --yellow2:#ffbf3f;
      --card:#fffef9;
      --shadow:0 18px 40px rgba(86,155,194,.16);

      --sat:env(safe-area-inset-top,0px);
      --sar:env(safe-area-inset-right,0px);
      --sab:env(safe-area-inset-bottom,0px);
      --sal:env(safe-area-inset-left,0px);
    }

    *{
      box-sizing:border-box;
      -webkit-tap-highlight-color:transparent;
    }

    html,body{
      margin:0;
      width:100%;
      min-height:100%;
      font-family:system-ui,-apple-system,"Segoe UI",sans-serif;
      color:var(--text);
      background:
        radial-gradient(circle at 12% 8%, rgba(255,255,255,.84), transparent 18%),
        radial-gradient(circle at 86% 10%, rgba(255,255,255,.72), transparent 18%),
        linear-gradient(180deg,var(--sky1),var(--sky2) 54%, var(--sky3));
      overflow:hidden;
    }

    body{
      min-height:100dvh;
      padding:
        calc(10px + var(--sat))
        calc(10px + var(--sar))
        calc(10px + var(--sab))
        calc(10px + var(--sal));
    }

    .app{
      height:calc(100dvh - 20px - var(--sat) - var(--sab));
      max-width:1120px;
      margin:0 auto;
      display:grid;
      grid-template-rows:auto 1fr auto;
      gap:10px;
    }

    .top{
      border-radius:24px;
      border:4px solid var(--line);
      background:linear-gradient(180deg,#fffef9,#f7fff4);
      box-shadow:var(--shadow);
      padding:10px;
      display:grid;
      gap:8px;
    }

    .top-row{
      display:grid;
      grid-template-columns:1fr auto;
      gap:10px;
      align-items:center;
    }

    .title{
      display:flex;
      flex-wrap:wrap;
      gap:8px;
      align-items:center;
      min-width:0;
    }

    .kicker{
      display:inline-flex;
      align-items:center;
      gap:8px;
      min-height:34px;
      padding:7px 12px;
      border-radius:999px;
      border:2px solid var(--line);
      background:#eaf8ff;
      color:#5ea8d0;
      font-size:12px;
      font-weight:1000;
      white-space:nowrap;
    }

    h1{
      margin:0;
      font-size:clamp(20px,4vw,30px);
      font-weight:1000;
      color:#67a91c;
      line-height:1.05;
    }

    .room{
      min-height:34px;
      padding:7px 12px;
      border-radius:999px;
      border:2px solid #d7edf7;
      background:#fff;
      font-size:13px;
      font-weight:1000;
      color:#5b564f;
      white-space:nowrap;
    }

    .hud{
      display:grid;
      grid-template-columns:repeat(6,1fr);
      gap:8px;
    }

    .hud-card{
      min-height:56px;
      border-radius:18px;
      border:3px solid #d7edf7;
      background:#fff;
      padding:8px;
      display:grid;
      align-content:center;
      justify-items:center;
      gap:2px;
    }

    .hud-label{
      font-size:11px;
      font-weight:1000;
      color:#7b7a72;
      line-height:1.1;
      text-align:center;
    }

    .hud-value{
      font-size:20px;
      font-weight:1000;
      color:#3d93b8;
      line-height:1.05;
      text-align:center;
    }

    .arena-wrap{
      min-height:0;
      border-radius:28px;
      border:4px solid var(--line);
      background:
        radial-gradient(circle at 20% 20%, rgba(255,255,255,.92), transparent 18%),
        radial-gradient(circle at 82% 18%, rgba(255,235,150,.34), transparent 22%),
        linear-gradient(180deg,#fffef9,#f8fff4);
      box-shadow:var(--shadow);
      position:relative;
      overflow:hidden;
    }

    .arena{
      position:absolute;
      inset:0;
      overflow:hidden;
      touch-action:none;
    }

    .guide{
      position:absolute;
      left:50%;
      top:50%;
      transform:translate(-50%,-50%);
      width:min(88%,620px);
      border-radius:28px;
      border:4px solid #d7edf7;
      background:rgba(255,255,255,.9);
      padding:20px;
      text-align:center;
      box-shadow:var(--shadow);
      z-index:5;
    }

    .guide h2{
      margin:0;
      font-size:clamp(26px,5vw,42px);
      font-weight:1000;
      color:#67a91c;
    }

    .guide p{
      margin:10px 0 0;
      font-size:16px;
      font-weight:900;
      color:#6b665f;
      line-height:1.65;
    }

    .guide.hide{
      display:none;
    }

    .target{
      position:absolute;
      width:78px;
      height:78px;
      border-radius:26px;
      border:4px solid #fff;
      display:grid;
      place-items:center;
      font-size:38px;
      cursor:pointer;
      user-select:none;
      box-shadow:0 12px 28px rgba(0,0,0,.14);
      transform:translate(-50%,-50%) scale(1);
      transition:transform .08s ease, opacity .16s ease;
      animation:pop .2s ease both;
      z-index:4;
    }

    .target.good{
      background:linear-gradient(180deg,#eaffd9,#baf2a0);
      outline:4px solid rgba(126,217,87,.32);
    }

    .target.junk{
      background:linear-gradient(180deg,#fff0f0,#ffc9c9);
      outline:4px solid rgba(255,82,82,.22);
    }

    .target:active{
      transform:translate(-50%,-50%) scale(.92);
    }

    .target.fade{
      opacity:0;
      pointer-events:none;
      transform:translate(-50%,-50%) scale(.6);
    }

    @keyframes pop{
      from{ transform:translate(-50%,-50%) scale(.4); opacity:0; }
      to{ transform:translate(-50%,-50%) scale(1); opacity:1; }
    }

    .float{
      position:absolute;
      z-index:10;
      pointer-events:none;
      font-size:22px;
      font-weight:1000;
      text-shadow:0 2px 0 rgba(255,255,255,.9);
      animation:rise .75s ease forwards;
    }

    .float.good{ color:#399a24; }
    .float.bad{ color:#d83131; }

    @keyframes rise{
      0%{ opacity:0; transform:translate(-50%,-20%) scale(.8); }
      15%{ opacity:1; }
      100%{ opacity:0; transform:translate(-50%,-120%) scale(1.05); }
    }

    .bottom{
      display:grid;
      grid-template-columns:1fr auto auto;
      gap:10px;
      align-items:center;
    }

    .status{
      min-height:52px;
      border-radius:20px;
      border:3px solid #d7edf7;
      background:#fff;
      padding:10px 14px;
      font-size:15px;
      font-weight:1000;
      color:#6b665f;
      display:flex;
      align-items:center;
      overflow:hidden;
    }

    .btn{
      appearance:none;
      border:none;
      min-height:52px;
      border-radius:20px;
      padding:0 18px;
      font-size:16px;
      font-weight:1000;
      cursor:pointer;
      box-shadow:var(--shadow);
      white-space:nowrap;
    }

    .btn.primary{
      background:linear-gradient(180deg,var(--green),var(--green2));
      color:#173b0b;
    }

    .btn.soft{
      background:#fff;
      border:4px solid #d7edf7;
      color:#645f57;
      box-shadow:none;
    }

    .summary{
      position:fixed;
      inset:0;
      background:rgba(213,241,255,.82);
      backdrop-filter:blur(8px);
      z-index:100;
      padding:
        calc(14px + var(--sat))
        calc(14px + var(--sar))
        calc(14px + var(--sab))
        calc(14px + var(--sal));
      display:none;
      overflow:auto;
    }

    .summary.show{
      display:block;
    }

    .summary-card{
      width:min(980px,100%);
      margin:0 auto;
      border-radius:30px;
      border:4px solid var(--line);
      background:linear-gradient(180deg,#fffef9,#f8fff4);
      box-shadow:var(--shadow);
      padding:18px;
      display:grid;
      gap:14px;
    }

    .summary-head{
      display:grid;
      gap:8px;
      text-align:center;
    }

    .summary-head h2{
      margin:0;
      font-size:clamp(30px,7vw,54px);
      font-weight:1000;
      color:#67a91c;
      line-height:1.05;
    }

    .summary-note{
      margin:0;
      font-size:15px;
      line-height:1.7;
      color:#6b665f;
      font-weight:1000;
    }

    .summary-stats{
      display:grid;
      grid-template-columns:repeat(4,1fr);
      gap:10px;
    }

    .summary-stat{
      min-height:92px;
      border-radius:20px;
      border:3px solid #d7edf7;
      background:#fff;
      padding:12px;
      display:grid;
      align-content:center;
      gap:4px;
    }

    .summary-stat b{
      font-size:12px;
      color:#7b7a72;
      font-weight:1000;
    }

    .summary-stat span{
      font-size:34px;
      color:#4d4a42;
      font-weight:1000;
      line-height:1;
    }

    .player-grid{
      display:grid;
      grid-template-columns:1fr 1fr;
      gap:12px;
    }

    .player-card{
      border-radius:22px;
      border:3px solid #d7edf7;
      background:#fff;
      padding:14px;
      display:grid;
      gap:12px;
    }

    .player-title{
      display:grid;
      grid-template-columns:auto 1fr;
      gap:12px;
      align-items:center;
    }

    .avatar{
      width:62px;
      height:62px;
      border-radius:18px;
      display:grid;
      place-items:center;
      font-size:30px;
      background:linear-gradient(180deg,#fff3de,#ffe0b8);
      border:3px solid #ffd89b;
    }

    .player-title h3{
      margin:0;
      font-size:22px;
      font-weight:1000;
      color:#5b564f;
      line-height:1.1;
    }

    .player-title p{
      margin:5px 0 0;
      font-size:13px;
      font-weight:1000;
      color:#7b7a72;
    }

    .mini-grid{
      display:grid;
      grid-template-columns:1fr 1fr;
      gap:10px;
    }

    .mini{
      border-radius:16px;
      border:2px solid #d7edf7;
      background:#f7fcff;
      padding:10px;
      text-align:center;
    }

    .mini b{
      display:block;
      font-size:11px;
      font-weight:1000;
      color:#7b7a72;
    }

    .mini span{
      display:block;
      margin-top:3px;
      font-size:24px;
      font-weight:1000;
      color:#3d93b8;
    }

    .summary-actions{
      display:grid;
      grid-template-columns:1fr 1fr;
      gap:10px;
    }

    .summary-message{
      border-radius:20px;
      border:3px solid #d7edf7;
      background:#fff;
      padding:12px;
      font-size:15px;
      line-height:1.7;
      font-weight:1000;
      color:#6b665f;
      text-align:center;
    }

    @media (max-width:760px){
      .app{
        height:calc(100dvh - 20px - var(--sat) - var(--sab));
      }

      .top-row{
        grid-template-columns:1fr;
      }

      .hud{
        grid-template-columns:repeat(3,1fr);
      }

      .hud-card{
        min-height:52px;
      }

      .hud-value{
        font-size:18px;
      }

      .bottom{
        grid-template-columns:1fr;
      }

      .btn{
        width:100%;
      }

      .target{
        width:70px;
        height:70px;
        font-size:34px;
        border-radius:24px;
      }

      .summary-stats{
        grid-template-columns:1fr 1fr;
      }

      .player-grid{
        grid-template-columns:1fr;
      }

      .summary-actions{
        grid-template-columns:1fr;
      }
    }
  </style>
</head>

<body>
  <main class="app">
    <section class="top">
      <div class="top-row">
        <div class="title">
          <div class="kicker">🤝 GOODJUNK DUET</div>
          <h1>GoodJunk Team Run</h1>
        </div>
        <div class="room" id="roomText">Room • -</div>
      </div>

      <div class="hud">
        <div class="hud-card">
          <div class="hud-label">เวลา</div>
          <div class="hud-value" id="timeText">0</div>
        </div>
        <div class="hud-card">
          <div class="hud-label">คะแนน</div>
          <div class="hud-value" id="scoreText">0</div>
        </div>
        <div class="hud-card">
          <div class="hud-label">Good</div>
          <div class="hud-value" id="goodText">0</div>
        </div>
        <div class="hud-card">
          <div class="hud-label">Junk/Miss</div>
          <div class="hud-value" id="missText">0</div>
        </div>
        <div class="hud-card">
          <div class="hud-label">Combo</div>
          <div class="hud-value" id="comboText">0</div>
        </div>
        <div class="hud-card">
          <div class="hud-label">Best</div>
          <div class="hud-value" id="bestText">0</div>
        </div>
      </div>
    </section>

    <section class="arena-wrap">
      <div class="arena" id="arena"></div>

      <div class="guide" id="guide">
        <h2>พร้อมลุย Duet!</h2>
        <p>
          แตะ/คลิกอาหารดีให้เร็วที่สุด 🍎🥦<br>
          ระวัง Junk 🍩🥤 ถ้าโดนจะนับเป็น Miss<br>
          คะแนนของทั้ง 2 คนจะรวมเป็นสรุปทีม
        </p>
      </div>
    </section>

    <section class="bottom">
      <div class="status" id="statusText">กำลังเตรียมเกม…</div>
      <button class="btn soft" id="btnBack" type="button">🏠 Hub</button>
      <button class="btn primary" id="btnStart" type="button">▶️ เริ่ม</button>
    </section>
  </main>

  <section class="summary" id="summaryOverlay">
    <div class="summary-card">
      <div class="summary-head">
        <h2 id="summaryTitle">สรุปทีม</h2>
        <p class="summary-note" id="summaryNote">กำลังรวมคะแนน…</p>
      </div>

      <div class="summary-stats">
        <div class="summary-stat">
          <b>คะแนนรวมทีม</b>
          <span id="sumScore">0</span>
        </div>
        <div class="summary-stat">
          <b>Good รวม</b>
          <span id="sumGood">0</span>
        </div>
        <div class="summary-stat">
          <b>Junk/Miss รวม</b>
          <span id="sumMiss">0</span>
        </div>
        <div class="summary-stat">
          <b>คอมโบสูงสุด</b>
          <span id="sumBest">0</span>
        </div>
      </div>

      <div class="player-grid" id="summaryPlayers"></div>

      <div class="summary-message" id="summaryMessage">
        ถ้าอีกฝั่งส่งผลช้า ระบบจะพยายามซ่อมสรุปอัตโนมัติ
      </div>

      <div class="summary-actions">
        <button class="btn primary" id="btnRematch" type="button">🔁 รีแมตช์</button>
        <button class="btn soft" id="btnSummaryHub" type="button">🏠 กลับ Hub</button>
      </div>
    </div>
  </section>

  <script src="https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.12.5/firebase-auth-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.12.5/firebase-database-compat.js"></script>
  <script src="../firebase-config.js?v=20260430-gjduet-runtime-v10"></script>
  <script src="./goodjunk-duet-room-bootstrap.js?v=20260430-gjduet-runtime-v10"></script>

  <script>
  (function(){
    'use strict';

    const qs = new URLSearchParams(location.search);
    let boot = window.HHA_DUET_ROOM_BOOT || null;

    function now(){ return Date.now(); }
    function sleep(ms){ return new Promise(resolve => setTimeout(resolve, ms)); }

    function clamp(n,min,max){
      n = Number(n) || 0;
      return Math.max(min, Math.min(max, n));
    }

    function esc(s){
      return String(s ?? '')
        .replaceAll('&','&amp;')
        .replaceAll('<','&lt;')
        .replaceAll('>','&gt;')
        .replaceAll('"','&quot;')
        .replaceAll("'","&#39;");
    }

    function normalizeRoomCode(raw){
      let v = String(raw || '').trim().toUpperCase();
      v = v.replace(/\s+/g,'');
      v = v.replace(/[^A-Z0-9-]/g,'');

      if (!v) return '';

      if (!v.startsWith('DU-')) {
        v = 'DU-' + v.replace(/^DU/,'').replace(/^-/, '');
      }

      return v.slice(0, 9);
    }

    function readLS(key){
      try { return localStorage.getItem(key) || ''; }
      catch (_) { return ''; }
    }

    function writeSS(key, value){
      try { sessionStorage.setItem(key, value); }
      catch (_) {}
    }

    function readSS(key){
      try { return sessionStorage.getItem(key) || ''; }
      catch (_) { return ''; }
    }

    function makeId(prefix){
      return prefix + '-' + Math.random().toString(36).slice(2, 8).toUpperCase() + '-' + Date.now().toString(36).toUpperCase();
    }

    const roomIdResolved = normalizeRoomCode(qs.get('roomId') || qs.get('room') || '');
    const identityKey = 'HHA_GJ_DUET_IDENTITY__' + roomIdResolved;
    const ssIdentityRaw = readSS(identityKey);
    let ssIdentity = null;

    try {
      ssIdentity = ssIdentityRaw ? JSON.parse(ssIdentityRaw) : null;
    } catch (_) {
      ssIdentity = null;
    }

    function resolveIdentity(){
      const roomId = roomIdResolved || normalizeRoomCode(qs.get('roomId') || qs.get('room') || 'DU-LOCAL');
      const urlPid = String(qs.get('pid') || '').trim();
      const urlName = String(qs.get('name') || qs.get('nick') || '').trim();
      const urlRole = String(qs.get('role') || (qs.get('host') === '1' ? 'host' : 'guest')).trim().toLowerCase();

      const guestPid = readLS('HHA_GJ_DUET_PID__' + roomId + '__guest');
      const hostPid = readLS('HHA_GJ_DUET_PID__' + roomId + '__host');

      let pid = urlPid || makeId('P');
      let name = urlName || 'Hero';
      let role = urlRole === 'host' ? 'host' : 'guest';

      if (ssIdentity && ssIdentity.pid && ssIdentity.roomId === roomId) {
        pid = String(ssIdentity.pid || pid);
        name = String(ssIdentity.name || name);
        role = String(ssIdentity.role || role).toLowerCase() === 'host' ? 'host' : 'guest';
      } else if (urlRole === 'host' && guestPid && guestPid !== urlPid && !hostPid) {
        pid = guestPid;
        role = 'guest';
        if (!urlName || urlName === 'Hero') name = 'Player 2';
      } else if (urlRole === 'host' && guestPid && guestPid !== urlPid && hostPid !== urlPid) {
        pid = guestPid;
        role = 'guest';
        if (!urlName || urlName === 'Hero') name = 'Player 2';
      }

      writeSS(identityKey, JSON.stringify({ roomId, pid, name, role }));

      return {
        roomId,
        pid,
        name,
        role,
        matchId: String(qs.get('matchId') || '').trim() || ('MT-' + now()),
        diff: String(qs.get('diff') || 'normal').trim(),
        durationSec: clamp(Number(qs.get('time') || 150), 30, 300),
        hub: String(qs.get('hub') || '../nutrition-zone.html').trim()
      };
    }

    const ctx = resolveIdentity();

    const ui = {
      roomText: document.getElementById('roomText'),
      timeText: document.getElementById('timeText'),
      scoreText: document.getElementById('scoreText'),
      goodText: document.getElementById('goodText'),
      missText: document.getElementById('missText'),
      comboText: document.getElementById('comboText'),
      bestText: document.getElementById('bestText'),
      arena: document.getElementById('arena'),
      guide: document.getElementById('guide'),
      statusText: document.getElementById('statusText'),
      btnBack: document.getElementById('btnBack'),
      btnStart: document.getElementById('btnStart'),
      summaryOverlay: document.getElementById('summaryOverlay'),
      summaryTitle: document.getElementById('summaryTitle'),
      summaryNote: document.getElementById('summaryNote'),
      sumScore: document.getElementById('sumScore'),
      sumGood: document.getElementById('sumGood'),
      sumMiss: document.getElementById('sumMiss'),
      sumBest: document.getElementById('sumBest'),
      summaryPlayers: document.getElementById('summaryPlayers'),
      summaryMessage: document.getElementById('summaryMessage'),
      btnRematch: document.getElementById('btnRematch'),
      btnSummaryHub: document.getElementById('btnSummaryHub')
    };

    const GOOD_ITEMS = ['🍎','🍌','🥦','🥕','🍚','🥛','🍇','🍊','🥬','🍓'];
    const JUNK_ITEMS = ['🍩','🍟','🥤','🍬','🍔','🍕','🍭','🧁'];

    const state = {
      ready: false,
      running: false,
      ended: false,
      summaryShown: false,

      startAt: 0,
      endAt: 0,
      lastFrameAt: 0,
      nextSpawnAt: 0,

      score: 0,
      good: 0,
      junk: 0,
      miss: 0,
      streak: 0,
      bestStreak: 0,

      targets: [],
      targetSeq: 0
    };

    let resultHeartbeatTimer = 0;
    let finalRepairTimer = 0;

    function setStatus(text){
      ui.statusText.textContent = text;
    }

    function updateHud(){
      const left = state.running
        ? Math.max(0, Math.ceil((state.endAt - now()) / 1000))
        : ctx.durationSec;

      ui.roomText.textContent = ctx.roomId + ' • ' + ctx.name + ' • ' + (ctx.role === 'host' ? 'Host' : 'Guest');
      ui.timeText.textContent = String(left);
      ui.scoreText.textContent = String(Math.max(0, Math.round(state.score)));
      ui.goodText.textContent = String(state.good);
      ui.missText.textContent = String(state.miss);
      ui.comboText.textContent = String(state.streak);
      ui.bestText.textContent = String(state.bestStreak);
    }

    function arenaRect(){
      return ui.arena.getBoundingClientRect();
    }

    function randomItem(list){
      return list[Math.floor(Math.random() * list.length)];
    }

    function diffConfig(){
      const d = String(ctx.diff || 'normal').toLowerCase();

      if (d === 'easy') {
        return { spawnMs: 760, lifeMs: 1700, junkRate: .24, maxTargets: 8 };
      }

      if (d === 'hard') {
        return { spawnMs: 500, lifeMs: 1250, junkRate: .38, maxTargets: 11 };
      }

      if (d === 'challenge') {
        return { spawnMs: 420, lifeMs: 1120, junkRate: .44, maxTargets: 12 };
      }

      return { spawnMs: 620, lifeMs: 1450, junkRate: .31, maxTargets: 10 };
    }

    function spawnTarget(){
      if (!state.running || state.ended) return;

      const cfg = diffConfig();

      if (state.targets.length >= cfg.maxTargets) return;

      const rect = arenaRect();
      const margin = 62;
      const x = margin + Math.random() * Math.max(1, rect.width - margin * 2);
      const y = margin + Math.random() * Math.max(1, rect.height - margin * 2);

      const isJunk = Math.random() < cfg.junkRate;
      const id = 'tg-' + (++state.targetSeq);
      const el = document.createElement('button');

      el.type = 'button';
      el.className = 'target ' + (isJunk ? 'junk' : 'good');
      el.textContent = isJunk ? randomItem(JUNK_ITEMS) : randomItem(GOOD_ITEMS);
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      el.dataset.id = id;

      const item = {
        id,
        el,
        type: isJunk ? 'junk' : 'good',
        bornAt: now(),
        expiresAt: now() + cfg.lifeMs,
        hit: false
      };

      el.addEventListener('pointerdown', function(ev){
        ev.preventDefault();
        hitTarget(item);
      }, { passive:false });

      state.targets.push(item);
      ui.arena.appendChild(el);
    }

    function showFloat(x, y, text, kind){
      const f = document.createElement('div');
      f.className = 'float ' + (kind || 'good');
      f.textContent = text;
      f.style.left = x + 'px';
      f.style.top = y + 'px';
      ui.arena.appendChild(f);
      setTimeout(() => {
        try { f.remove(); } catch (_) {}
      }, 850);
    }

    function removeTarget(item){
      if (!item || !item.el) return;

      item.el.classList.add('fade');

      setTimeout(() => {
        try { item.el.remove(); } catch (_) {}
      }, 160);

      state.targets = state.targets.filter(t => t.id !== item.id);
    }

    function hitTarget(item){
      if (!state.running || state.ended || !item || item.hit) return;

      item.hit = true;

      const x = Number.parseFloat(item.el.style.left) || 0;
      const y = Number.parseFloat(item.el.style.top) || 0;

      if (item.type === 'good') {
        state.good += 1;
        state.streak += 1;
        state.bestStreak = Math.max(state.bestStreak, state.streak);

        const bonus = Math.min(8, Math.floor(state.streak / 5));
        const gain = 10 + bonus;

        state.score += gain;
        showFloat(x, y, '+' + gain + ' GOOD', 'good');
        setStatus('เยี่ยม! เก็บ good ต่อเนื่อง คอมโบ ' + state.streak);
      } else {
        state.junk += 1;
        state.miss += 1;
        state.streak = 0;
        state.score = Math.max(0, state.score - 6);

        showFloat(x, y, 'MISS -6', 'bad');
        setStatus('โดน junk แล้ว! ตั้งหลักใหม่ เก็บ good ต่อ');
      }

      removeTarget(item);
      updateHud();
    }

    function expireTargets(){
      const t = now();
      const expired = state.targets.filter(item => !item.hit && item.expiresAt <= t);

      expired.forEach(item => {
        if (item.type === 'good') {
          state.miss += 1;
          state.streak = 0;

          const x = Number.parseFloat(item.el.style.left) || 0;
          const y = Number.parseFloat(item.el.style.top) || 0;
          showFloat(x, y, 'MISS', 'bad');
        }

        removeTarget(item);
      });
    }

    function frame(){
      if (!state.running || state.ended) return;

      const t = now();

      expireTargets();

      if (t >= state.nextSpawnAt) {
        spawnTarget();

        const cfg = diffConfig();
        const jitter = Math.random() * 180;
        state.nextSpawnAt = t + cfg.spawnMs + jitter;
      }

      if (t >= state.endAt) {
        endGame('natural_end');
        return;
      }

      updateHud();
      requestAnimationFrame(frame);
    }

    function ownSummary(reason){
      return {
        pid: ctx.pid,
        name: ctx.name,
        role: ctx.role || 'guest',
        reason: String(reason || 'end'),
        score: Number(state.score || 0),
        good: Number(state.good || 0),
        junk: Number(state.junk || 0),
        miss: Number(state.miss || 0),
        streak: Number(state.bestStreak || state.streak || 0),
        bestStreak: Number(state.bestStreak || state.streak || 0),
        finished: true,
        finalResult: reason !== 'live',
        updatedAt: now(),
        submittedAt: now()
      };
    }

    function resultSnapshot(reason) {
      return Object.assign({}, ownSummary(reason || 'live'), {
        pid: ctx.pid,
        name: ctx.name,
        role: ctx.role || 'guest',
        roomId: ctx.roomId,
        matchId: ctx.matchId,
        score: Number(state.score || 0),
        good: Number(state.good || 0),
        junk: Number(state.junk || 0),
        miss: Number(state.miss || 0),
        streak: Number(state.bestStreak || state.streak || 0),
        bestStreak: Number(state.bestStreak || state.streak || 0),
        updatedAt: now()
      });
    }

    function getRoomRootPathSafe() {
      try {
        if (boot && typeof boot.getRoomRootPath === 'function') {
          return String(boot.getRoomRootPath() || '')
            .replace(/^\/+/, '')
            .replace(/\/+$/, '');
        }
      } catch (_) {}

      return 'hha-battle/goodjunk/duetRooms/' + String(ctx.roomId || '').trim();
    }

    async function writePlayerResultMirror(matchId, result, kind) {
      try {
        if (!window.firebase || typeof window.firebase.database !== 'function') return false;

        const root = getRoomRootPathSafe();
        const mid = String(matchId || ctx.matchId || '').trim();
        const pid = String(ctx.pid || '').trim();

        if (!root || !mid || !pid) return false;

        const payload = Object.assign({}, result || {}, {
          pid,
          name: ctx.name,
          role: ctx.role || 'guest',
          matchId: mid,
          roomId: ctx.roomId,
          kind: String(kind || 'final'),
          finalResult: String(kind || 'final') !== 'live',
          submittedAt: now(),
          updatedAt: now()
        });

        const db = window.firebase.database();

        await db.ref(root + '/matches/' + mid + '/playerResults/' + pid).set(payload);
        await db.ref(root + '/resultMirror/' + mid + '/' + pid).set(payload);

        if (kind === 'live') {
          await db.ref(root + '/liveResults/' + mid + '/' + pid).set(payload);
        }

        return true;
      } catch (err) {
        console.warn('[GJ-DUET-RUNTIME] writePlayerResultMirror failed:', err);
        return false;
      }
    }

    async function readPathValue(path) {
      try {
        if (!window.firebase || typeof window.firebase.database !== 'function') return {};
        const snap = await window.firebase.database().ref(path).once('value');
        return snap && snap.val ? (snap.val() || {}) : {};
      } catch (err) {
        console.warn('[GJ-DUET-RUNTIME] readPathValue failed:', path, err);
        return {};
      }
    }

    async function readPlayerResultMirror(matchId) {
      const root = getRoomRootPathSafe();
      const mid = String(matchId || ctx.matchId || '').trim();

      if (!root || !mid) return {};

      const live = await readPathValue(root + '/liveResults/' + mid);
      const mirror = await readPathValue(root + '/resultMirror/' + mid);
      const matchResults = await readPathValue(root + '/matches/' + mid + '/playerResults');

      return mergeResults(live || {}, mirror || {}, matchResults || {});
    }

    function mergeResults() {
      const out = {};

      Array.from(arguments).forEach((obj) => {
        Object.keys(obj || {}).forEach((pid) => {
          if (!obj[pid]) return;

          const oldItem = out[pid];
          const newItem = obj[pid];

          if (!oldItem) {
            out[pid] = newItem;
            return;
          }

          const oldTime = Number(oldItem.updatedAt || oldItem.submittedAt || 0);
          const newTime = Number(newItem.updatedAt || newItem.submittedAt || 0);

          if (newTime >= oldTime) {
            out[pid] = newItem;
          }
        });
      });

      return out;
    }

    function countValidResults(results) {
      return Object.keys(results || {}).filter((pid) => {
        const r = results[pid];
        if (!r) return false;

        const hasAnyScore =
          Number(r.score || 0) > 0 ||
          Number(r.good || 0) > 0 ||
          Number(r.miss || 0) > 0 ||
          Number(r.streak || r.bestStreak || 0) > 0;

        const isFinal =
          r.finalResult === true ||
          r.finished === true ||
          String(r.kind || '') === 'final';

        return !!r.pid && (hasAnyScore || isFinal);
      }).length;
    }

    async function writeFinalSummaryDirect(matchId, summary) {
      try {
        if (!window.firebase || typeof window.firebase.database !== 'function') return false;

        const root = getRoomRootPathSafe();
        const mid = String(matchId || ctx.matchId || '').trim();

        if (!root || !mid) return false;

        const payload = Object.assign({}, summary || {}, {
          final: true,
          roomId: ctx.roomId,
          matchId: mid,
          repairedAt: now(),
          updatedAt: now()
        });

        const db = window.firebase.database();

        await db.ref(root + '/matches/' + mid + '/finalSummary').set(payload);
        await db.ref(root + '/finalSummaryMirror/' + mid).set(payload);

        return true;
      } catch (err) {
        console.warn('[GJ-DUET-RUNTIME] writeFinalSummaryDirect failed:', err);
        return false;
      }
    }

    async function readFinalDirect(matchId){
      const root = getRoomRootPathSafe();
      const mid = String(matchId || ctx.matchId || '').trim();

      if (!root || !mid) return null;

      const mirror = await readPathValue(root + '/finalSummaryMirror/' + mid);
      if (mirror && mirror.final) return mirror;

      const matchFinal = await readPathValue(root + '/matches/' + mid + '/finalSummary');
      if (matchFinal && matchFinal.final) return matchFinal;

      return null;
    }

    async function readResultsSafely() {
      let bootResults = {};

      if (boot && typeof boot.readPlayerResults === 'function') {
        try {
          bootResults = await boot.readPlayerResults(ctx.matchId) || {};
        } catch (err) {
          console.warn('[GJ-DUET-RUNTIME] readPlayerResults failed:', err);
        }
      }

      const mirrorResults = await readPlayerResultMirror(ctx.matchId);
      return mergeResults(bootResults, mirrorResults);
    }

    async function readFinalSafely(){
      let final = null;

      if (boot && typeof boot.readFinalSummary === 'function') {
        try {
          final = await boot.readFinalSummary(ctx.matchId);
          if (final && final.final) return final;
        } catch (err) {
          console.warn('[GJ-DUET-RUNTIME] readFinalSummary failed:', err);
        }
      }

      return await readFinalDirect(ctx.matchId);
    }

    async function publishFinalSafely(summary){
      let out = summary;

      if (boot && typeof boot.publishFinalSummary === 'function') {
        try {
          out = await boot.publishFinalSummary(ctx.matchId, summary);
        } catch (err) {
          console.warn('[GJ-DUET-RUNTIME] publishFinalSummary failed:', err);
        }
      }

      await writeFinalSummaryDirect(ctx.matchId, out || summary);
      return out || summary;
    }

    function calcTeamGrade(summary) {
      const score = Number(summary.score || 0);
      const miss = Number(summary.miss || 0);
      const good = Number(summary.good || 0);
      const best = Number(summary.streak || 0);

      if (score >= 1800 && miss <= 10 && good >= 110 && best >= 20) return 'S';
      if (score >= 1300 && miss <= 18 && good >= 80) return 'A';
      if (score >= 700 && good >= 40) return 'B';
      return 'C';
    }

    function medalForGrade(grade) {
      if (grade === 'S') return '🏆';
      if (grade === 'A') return '🥇';
      if (grade === 'B') return '🥈';
      return '🥉';
    }

    function titleForGrade(grade) {
      if (grade === 'S') return 'ยอดเยี่ยม!';
      if (grade === 'A') return 'เก่งมาก!';
      if (grade === 'B') return 'ดีมาก!';
      return 'สู้ต่อได้!';
    }

    function combineLocalSummary(results, meta){
      const list = Object.keys(results || {})
        .map(k => results[k])
        .filter(Boolean);

      const merged = {
        final: true,
        roomId: ctx.roomId,
        matchId: ctx.matchId,
        mode: 'DUET',
        ts: now(),
        players: [],
        score: 0,
        good: 0,
        junk: 0,
        miss: 0,
        streak: 0,
        expectedPlayers: 2,
        finishedPlayers: list.length,
        partial: !!(meta && meta.partial),
        reason: String(meta && meta.reason || '')
      };

      merged.players = list.map(item => ({
        pid: String(item.pid || '').trim(),
        name: String(item.name || '').trim() || 'Player',
        score: Number(item.score || 0),
        good: Number(item.good || 0),
        junk: Number(item.junk || 0),
        miss: Number(item.miss || 0),
        streak: Number(item.streak || item.bestStreak || 0),
        role: String(item.role || 'guest').trim().toLowerCase()
      }));

      merged.players.forEach(item => {
        merged.score += Number(item.score || 0);
        merged.good += Number(item.good || 0);
        merged.junk += Number(item.junk || 0);
        merged.miss += Number(item.miss || 0);
        merged.streak = Math.max(merged.streak, Number(item.streak || 0));
      });

      merged.grade = calcTeamGrade(merged);
      merged.medal = medalForGrade(merged.grade);
      merged.title = titleForGrade(merged.grade);
      merged.note = merged.partial
        ? 'อีกฝั่งส่งผลไม่ทัน ระบบจึงรอและจะซ่อมสรุปให้อัตโนมัติเมื่อข้อมูลมาถึง'
        : 'รวมคะแนนครบทั้งสองคนแล้ว';

      return merged;
    }

    function startResultHeartbeat() {
      if (resultHeartbeatTimer) clearInterval(resultHeartbeatTimer);

      resultHeartbeatTimer = setInterval(function () {
        if (!ctx.matchId || state.summaryShown || state.ended) return;

        const live = resultSnapshot('live');

        writePlayerResultMirror(ctx.matchId, live, 'live').catch(function (err) {
          console.warn('[GJ-DUET-RUNTIME] live result heartbeat failed:', err);
        });
      }, 2500);
    }

    function stopResultHeartbeat() {
      try {
        if (resultHeartbeatTimer) clearInterval(resultHeartbeatTimer);
      } catch (_) {}

      resultHeartbeatTimer = 0;
    }

    async function tryCreateTeamSummary(timeoutMs) {
      const started = now();
      const waitMs = Number(timeoutMs || 18000);
      let results = {};

      while ((now() - started) < waitMs) {
        const final = await readFinalSafely();

        if (final && final.final && !final.partial) {
          return final;
        }

        results = await readResultsSafely();

        if (countValidResults(results) >= 2) {
          const merged = boot && typeof boot.combineDuetSummary === 'function'
            ? boot.combineDuetSummary(ctx.matchId, results, {
                expectedPlayers: 2,
                finishedPlayers: countValidResults(results),
                partial: false,
                reason: 'all_finished'
              })
            : combineLocalSummary(results, {
                partial: false,
                reason: 'all_finished'
              });

          await publishFinalSafely(merged);
          await writeFinalSummaryDirect(ctx.matchId, merged);

          return merged;
        }

        await sleep(500);
      }

      results = await readResultsSafely();

      const validCount = countValidResults(results);

      if (!validCount) {
        const own = resultSnapshot('local_fallback');
        results = {};
        results[ctx.pid] = own;
      }

      const merged = boot && typeof boot.combineDuetSummary === 'function'
        ? boot.combineDuetSummary(ctx.matchId, results, {
            expectedPlayers: 2,
            finishedPlayers: validCount || 1,
            partial: validCount < 2,
            reason: validCount < 2 ? 'timeout_partial' : 'all_finished'
          })
        : combineLocalSummary(results, {
            partial: validCount < 2,
            reason: validCount < 2 ? 'timeout_partial' : 'all_finished'
          });

      await publishFinalSafely(merged);
      await writeFinalSummaryDirect(ctx.matchId, merged);

      return merged;
    }

    async function waitForFinalOrCreate() {
      const first = await readFinalSafely();

      if (first && first.final && !first.partial) {
        return first;
      }

      if (first && first.final && first.partial) {
        const results = await readResultsSafely();

        if (countValidResults(results) >= 2) {
          const repaired = boot && typeof boot.combineDuetSummary === 'function'
            ? boot.combineDuetSummary(ctx.matchId, results, {
                expectedPlayers: 2,
                finishedPlayers: countValidResults(results),
                partial: false,
                reason: 'repaired_from_late_results'
              })
            : combineLocalSummary(results, {
                partial: false,
                reason: 'repaired_from_late_results'
              });

          await writeFinalSummaryDirect(ctx.matchId, repaired);
          return repaired;
        }
      }

      const isHostSide = ctx.role === 'host' || qs.get('host') === '1';

      if (isHostSide) {
        return await tryCreateTeamSummary(20000);
      }

      const guestWaitStart = now();

      while ((now() - guestWaitStart) < 20000) {
        const final = await readFinalSafely();

        if (final && final.final && !final.partial) {
          return final;
        }

        if (final && final.final && final.partial) {
          const results = await readResultsSafely();

          if (countValidResults(results) >= 2) {
            const repaired = boot && typeof boot.combineDuetSummary === 'function'
              ? boot.combineDuetSummary(ctx.matchId, results, {
                  expectedPlayers: 2,
                  finishedPlayers: countValidResults(results),
                  partial: false,
                  reason: 'guest_repaired_from_late_results'
                })
              : combineLocalSummary(results, {
                  partial: false,
                  reason: 'guest_repaired_from_late_results'
                });

            await writeFinalSummaryDirect(ctx.matchId, repaired);
            return repaired;
          }
        }

        await sleep(500);
      }

      return await tryCreateTeamSummary(8000);
    }

    function playerCardHtml(player, idx){
      const role = String(player.role || '').toLowerCase();
      const icon = role === 'host' ? '👑' : '🧑';

      return `
        <div class="player-card">
          <div class="player-title">
            <div class="avatar">${icon}</div>
            <div>
              <h3>${esc(player.name || ('Player ' + (idx + 1)))}</h3>
              <p>${role === 'host' ? 'Host' : 'Player ' + (idx + 1)}</p>
            </div>
          </div>

          <div class="mini-grid">
            <div class="mini"><b>Score</b><span>${Number(player.score || 0)}</span></div>
            <div class="mini"><b>Good</b><span>${Number(player.good || 0)}</span></div>
            <div class="mini"><b>Junk/Miss</b><span>${Number(player.miss || player.junk || 0)}</span></div>
            <div class="mini"><b>Best</b><span>${Number(player.streak || player.bestStreak || 0)}</span></div>
          </div>
        </div>
      `;
    }

    function normalizeSummaryPlayers(summary){
      const players = Array.isArray(summary && summary.players)
        ? summary.players.slice()
        : [];

      players.sort((a,b) => {
        const ah = String(a.role || '').toLowerCase() === 'host' ? 0 : 1;
        const bh = String(b.role || '').toLowerCase() === 'host' ? 0 : 1;
        if (ah !== bh) return ah - bh;
        return Number(b.score || 0) - Number(a.score || 0);
      });

      if (players.length < 2) {
        players.push({
          name: 'Player 2',
          role: 'guest',
          score: 0,
          good: 0,
          junk: 0,
          miss: 0,
          streak: 0,
          bestStreak: 0
        });
      }

      return players.slice(0,2);
    }

    function showSummary(summary){
      state.summaryShown = true;

      const s = summary || {};
      const grade = String(s.grade || calcTeamGrade(s));
      const title = String(s.title || titleForGrade(grade));
      const medal = String(s.medal || medalForGrade(grade));

      ui.summaryTitle.textContent = medal + ' ' + title;
      ui.summaryNote.textContent = s.note || (s.partial
        ? 'อีกฝั่งส่งผลช้า ระบบกำลังรอข้อมูลเพื่อซ่อมสรุป'
        : 'รวมคะแนนทีมสำเร็จ');

      ui.sumScore.textContent = String(Number(s.score || 0));
      ui.sumGood.textContent = String(Number(s.good || 0));
      ui.sumMiss.textContent = String(Number(s.miss || 0));
      ui.sumBest.textContent = String(Number(s.streak || 0));

      const players = normalizeSummaryPlayers(s);
      ui.summaryPlayers.innerHTML = players.map(playerCardHtml).join('');

      if (s.partial) {
        ui.summaryMessage.textContent = 'อีกฝั่งส่งผลไม่ทัน ระบบจะลองรวมคะแนนอีกครั้งอัตโนมัติภายในไม่กี่วินาที';
      } else {
        ui.summaryMessage.textContent = 'รวมคะแนนครบทั้งสองคนแล้ว ยอดเยี่ยมมาก!';
      }

      ui.summaryOverlay.classList.add('show');

      if (summary && summary.partial) {
        if (finalRepairTimer) clearTimeout(finalRepairTimer);

        finalRepairTimer = setTimeout(async function () {
          try {
            const results = await readResultsSafely();

            if (countValidResults(results) >= 2) {
              const repaired = boot && typeof boot.combineDuetSummary === 'function'
                ? boot.combineDuetSummary(ctx.matchId, results, {
                    expectedPlayers: 2,
                    finishedPlayers: countValidResults(results),
                    partial: false,
                    reason: 'ui_repaired_after_partial'
                  })
                : combineLocalSummary(results, {
                    partial: false,
                    reason: 'ui_repaired_after_partial'
                  });

              await writeFinalSummaryDirect(ctx.matchId, repaired);

              state.summaryShown = false;
              ui.summaryOverlay.classList.remove('show');

              showSummary(repaired);
            }
          } catch (err) {
            console.warn('[GJ-DUET-RUNTIME] final repair failed:', err);
          }
        }, 3500);
      }
    }

    async function publishResultAndShowSummary(reason){
      const own = resultSnapshot(reason);

      setStatus('กำลังส่งผลคะแนนของเรา…');

      try {
        await writePlayerResultMirror(ctx.matchId, own, 'final');

        if (boot && typeof boot.publishPlayerResult === 'function') {
          await boot.publishPlayerResult(ctx.matchId, own);
        }

        await writePlayerResultMirror(ctx.matchId, own, 'final');
      } catch (err) {
        console.warn('[GJ-DUET-RUNTIME] publishPlayerResult failed:', err);
        await writePlayerResultMirror(ctx.matchId, own, 'final').catch(function(){});
      }

      setStatus('ส่งผลแล้ว กำลังรอรวมคะแนนทีม…');

      const summary = await waitForFinalOrCreate();

      showSummary(summary);
    }

    function endGame(reason){
      if (state.ended) return;

      state.running = false;
      state.ended = true;

      stopResultHeartbeat();

      state.targets.forEach(item => {
        try { item.el.remove(); } catch (_) {}
      });
      state.targets = [];

      ui.btnStart.disabled = true;
      ui.btnStart.textContent = 'จบเกมแล้ว';

      updateHud();

      publishResultAndShowSummary(reason || 'natural_end').catch(err => {
        console.error('[GJ-DUET-RUNTIME] summary failed:', err);

        const own = resultSnapshot('summary_error');
        const fallback = combineLocalSummary({ [ctx.pid]: own }, {
          partial: true,
          reason: 'summary_error'
        });

        showSummary(fallback);
      });
    }

    function startGame(){
      if (state.running || state.ended) return;

      state.running = true;
      state.ready = true;
      state.startAt = now();
      state.endAt = state.startAt + ctx.durationSec * 1000;
      state.nextSpawnAt = now() + 350;

      ui.guide.classList.add('hide');
      ui.btnStart.disabled = true;
      ui.btnStart.textContent = 'กำลังเล่น';
      setStatus('เริ่มแล้ว! เก็บ good ให้เยอะที่สุด และระวัง junk');

      startResultHeartbeat();
      updateHud();
      requestAnimationFrame(frame);
    }

    async function waitRoomSystemReady(){
      try {
        if (window.HHA_FIREBASE_READY) {
          setStatus('กำลังเชื่อมต่อห้องออนไลน์…');
          const fb = await window.HHA_FIREBASE_READY;

          if (fb && fb.db) {
            window.HHA_FIREBASE_DB = fb.db;
          }
        }
      } catch (err) {
        console.warn('[GJ-DUET-RUNTIME] Firebase ready failed:', err);
      }

      boot = window.HHA_DUET_ROOM_BOOT || null;
    }

    async function init(){
      await waitRoomSystemReady();

      if (boot && typeof boot.setPresence === 'function') {
        try {
          await boot.setPresence({
            ready: true,
            online: true,
            inRuntime: true,
            runtimeAt: now(),
            lastSeen: now()
          });
        } catch (err) {
          console.warn('[GJ-DUET-RUNTIME] setPresence runtime failed:', err);
        }
      }

      updateHud();
      setStatus('พร้อมเล่นแล้ว กดเริ่มเพื่อเริ่มรอบ Duet');

      setTimeout(() => {
        if (!state.running && !state.ended) {
          startGame();
        }
      }, 1200);
    }

    function buildLobbyUrl(){
      const url = new URL('./goodjunk-duet-lobby.html', location.href);

      const keep = [
        'pid','name','nick','diff','time','view','run','zone','cat',
        'game','gameId','theme','hub','api','log','debug'
      ];

      keep.forEach(k => {
        const v = qs.get(k);
        if (v != null && v !== '') url.searchParams.set(k, v);
      });

      url.searchParams.set('roomId', ctx.roomId);
      url.searchParams.set('room', ctx.roomId);
      url.searchParams.set('mode', 'duet');
      url.searchParams.set('entry', 'duet');
      url.searchParams.set('role', ctx.role);
      url.searchParams.set('host', ctx.role === 'host' ? '1' : '0');
      url.searchParams.set('pid', ctx.pid);
      url.searchParams.set('name', ctx.name);
      url.searchParams.set('nick', ctx.name);

      url.searchParams.delete('matchId');

      return url.toString();
    }

    async function rematch(){
      const lobbyUrl = buildLobbyUrl();

      try {
        if (boot && typeof boot.sendRematchSignal === 'function') {
          const nextMatchId = 'MT-' + now() + '-' + Math.random().toString(36).slice(2,7);
          const runUrl = new URL(location.href);

          runUrl.searchParams.set('matchId', nextMatchId);
          runUrl.searchParams.set('pid', ctx.pid);
          runUrl.searchParams.set('name', ctx.name);
          runUrl.searchParams.set('nick', ctx.name);
          runUrl.searchParams.set('role', ctx.role);
          runUrl.searchParams.set('host', ctx.role === 'host' ? '1' : '0');

          await boot.sendRematchSignal(nextMatchId, runUrl.toString());
        }
      } catch (err) {
        console.warn('[GJ-DUET-RUNTIME] rematch signal failed:', err);
      }

      location.href = lobbyUrl;
    }

    function goHub(){
      location.href = ctx.hub || '../nutrition-zone.html';
    }

    ui.btnStart.addEventListener('click', startGame);
    ui.btnBack.addEventListener('click', goHub);
    ui.btnSummaryHub.addEventListener('click', goHub);
    ui.btnRematch.addEventListener('click', rematch);

    window.addEventListener('beforeunload', function(){
      try { stopResultHeartbeat(); } catch (_) {}

      try {
        if (finalRepairTimer) clearTimeout(finalRepairTimer);
      } catch (_) {}

      try {
        if (boot && typeof boot.setPresence === 'function') {
          boot.setPresence({
            online: true,
            inRuntime: false,
            lastSeen: now()
          }).catch(function(){});
        }
      } catch (_) {}
    });

    init().catch(err => {
      console.error('[GJ-DUET-RUNTIME init failed]', err);
      setStatus('โหลดเกมไม่สำเร็จ: ' + (err && err.message ? err.message : String(err)));
    });
  })();
  </script>
</body>
</html>
