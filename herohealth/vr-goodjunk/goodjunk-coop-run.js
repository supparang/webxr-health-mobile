// /herohealth/vr-goodjunk/goodjunk-coop-run.js
// GoodJunk Coop Run
// FULL CORE PATCH v20260331-COOP-RUN-COOPROOMS-FULL

(() => {
  'use strict';

  const W = window;
  const D = document;
  const qs = new URLSearchParams(location.search);

  const ctx = W.__GJ_RUN_CTX__ || {
    pid: qs.get('pid') || 'anon',
    name: qs.get('name') || '',
    studyId: qs.get('studyId') || '',
    roomId: qs.get('roomId') || qs.get('room') || '',
    role: qs.get('role') || 'player',
    mode: 'coop',
    diff: qs.get('diff') || 'normal',
    time: qs.get('time') || '180',
    seed: qs.get('seed') || String(Date.now()),
    startAt: Number(qs.get('startAt') || 0) || 0,
    hub: qs.get('hub') || '../hub.html',
    view: qs.get('view') || 'mobile',
    run: qs.get('run') || 'play',
    gameId: qs.get('gameId') || 'goodjunk',
    spectator: qs.get('spectator') === '1'
  };

  const ROOM_PATH = `hha-battle/goodjunk/coopRooms/${ctx.roomId}`;

  const GOOD_ITEMS = ['🍎','🥕','🥦','🍌','🥛','🥗','🍉','🐟'];
  const JUNK_ITEMS = ['🍟','🍩','🍭','🍔','🥤','🍕','🧁','🍫'];

  const ui = {
    root: null,
    stage: null,
    layer: null,
    hudTop: null,
    note: null,
    score: null,
    time: null,
    team: null,
    goal: null,
    fill: null,
    mission: null,
    missionSub: null,
    bossWrap: null,
    bossFill: null,
    bossLabel: null
  };

  const state = {
    firebase: null,
    db: null,
    roomRef: null,
    myRef: null,

    room: null,
    roomListenerBound: false,

    width: 0,
    height: 0,

    running: false,
    ended: false,
    summaryShown: false,

    loopRaf: 0,
    syncTimer: 0,
    saveTimer: 0,

    lastTs: 0,
    startedAtPerf: 0,

    totalMs: 0,
    timeLeftMs: 0,

    score: 0,
    contribution: 0,
    miss: 0,
    bestStreak: 0,
    streak: 0,
    helps: 0,
    stars: 0,

    goodHit: 0,
    junkHit: 0,
    goodMiss: 0,

    shieldCharges: 0,
    doubleUntil: 0,
    freezeUntil: 0,
    teamFeverUntil: 0,
    bossWeakUntil: 0,
    bossWeakTriggered: false,

    currentRematchToken: 0,
    authoritativeEventSeq: 0,
    lastAppliedEventKey: '',

    eventReqBusy: false,
    bossReqBusy: false,

    finalizeBusy: false,
    cleanupBusy: false,
    finalSnapshotWritten: false,
    lastCleanupAt: 0,

    roundSeed: '',
    roundStartAtMs: 0,
    spawnCursor: 0,
    powerCursor: 0,
    restoredFromCache: false,

    bossAuthority: {
      active: false,
      hp: 0,
      hpMax: 0,
      cleared: false,
      weakUntil: 0
    },

    bossId: '',
    bossStarted: false,
    bossCleared: false,
    bossHits: 0,

    targetSeq: 0,
    targets: new Map(),

    mission: null,
    missionBonusGiven: false,
    missionFailed: false
  };

  function emit(name, detail) {
    try {
      W.dispatchEvent(new CustomEvent(name, { detail }));
    } catch (_) {}
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = D.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => resolve(src);
      s.onerror = () => reject(new Error(`load failed: ${src}`));
      D.head.appendChild(s);
    });
  }

  function num(v, d = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
  }

  function int(v, d = 0) {
    return Math.round(num(v, d));
  }

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function clampInt(v, a, b) {
    return Math.round(clamp(num(v, a), a, b));
  }

  function now() {
    return Date.now();
  }

  function fmtClock(sec) {
    const s = Math.max(0, int(sec, 0));
    const mm = Math.floor(s / 60);
    const ss = s % 60;
    return `${mm}:${String(ss).padStart(2, '0')}`;
  }

  function cleanText(v) {
    return String(v || '').trim();
  }

  function normalizePid(raw) {
    const v = cleanText(raw).replace(/[.#$[\]/]/g, '-');
    if (!v || v.toLowerCase() === 'anon') return cleanText(ctx.pid || 'anon');
    return v;
  }

  function soundEnabled() {
    return W.__GJ_COOP_SOUND_ON__ !== false;
  }

  function reducedMotion() {
    return W.__GJ_COOP_REDUCED_MOTION__ === true;
  }

  function hashString(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function seeded(seedText) {
    let seed = hashString(String(seedText || 'seed')) || 1;
    return function () {
      seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pickBySeed(arr, seedText) {
    if (!arr || !arr.length) return '';
    const r = seeded(seedText);
    return arr[Math.floor(r() * arr.length)] || arr[0];
  }

  function roomStorageKey() {
    const token = Number(state.room?.match?.coop?.rematchToken || state.currentRematchToken || 0) || 0;
    return `GJ_COOP_ROUND_CACHE:${ctx.roomId}:${ctx.pid}:${token}`;
  }

  function saveRoundCache() {
    try {
      const payload = {
        ts: now(),
        roomId: ctx.roomId,
        pid: ctx.pid,
        rematchToken: Number(state.room?.match?.coop?.rematchToken || state.currentRematchToken || 0) || 0,
        roundSeed: state.roundSeed || '',
        roundStartAtMs: Number(state.roundStartAtMs || 0) || 0,

        score: state.score,
        contribution: state.contribution,
        miss: state.miss,
        bestStreak: state.bestStreak,
        streak: state.streak,
        helps: state.helps,
        stars: state.stars,

        goodHit: state.goodHit,
        junkHit: state.junkHit,
        goodMiss: state.goodMiss,

        shieldCharges: state.shieldCharges,
        doubleUntil: state.doubleUntil,
        freezeUntil: state.freezeUntil,
        teamFeverUntil: state.teamFeverUntil,
        bossWeakUntil: state.bossWeakUntil,

        mission: state.mission,
        missionBonusGiven: !!state.missionBonusGiven,
        missionFailed: !!state.missionFailed,

        bossStarted: !!state.bossStarted,
        bossCleared: !!state.bossCleared,
        bossHits: Number(state.bossHits || 0) || 0,

        spawnCursor: Number(state.spawnCursor || 0) || 0,
        powerCursor: Number(state.powerCursor || 0) || 0
      };
      sessionStorage.setItem(roomStorageKey(), JSON.stringify(payload));
    } catch (_) {}
  }

  function restoreRoundCache() {
    try {
      const raw = sessionStorage.getItem(roomStorageKey());
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (!data || typeof data !== 'object') return false;
      if ((now() - Number(data.ts || 0)) > 20 * 60 * 1000) return false;

      state.roundSeed = String(data.roundSeed || state.roundSeed || '');
      state.roundStartAtMs = Number(data.roundStartAtMs || state.roundStartAtMs || 0) || 0;

      state.score = Number(data.score || 0) || 0;
      state.contribution = Number(data.contribution || state.score || 0) || 0;
      state.miss = Number(data.miss || 0) || 0;
      state.bestStreak = Number(data.bestStreak || 0) || 0;
      state.streak = Number(data.streak || 0) || 0;
      state.helps = Number(data.helps || 0) || 0;
      state.stars = Number(data.stars || 0) || 0;

      state.goodHit = Number(data.goodHit || 0) || 0;
      state.junkHit = Number(data.junkHit || 0) || 0;
      state.goodMiss = Number(data.goodMiss || 0) || 0;

      state.shieldCharges = Number(data.shieldCharges || 0) || 0;
      state.doubleUntil = Number(data.doubleUntil || 0) || 0;
      state.freezeUntil = Number(data.freezeUntil || 0) || 0;
      state.teamFeverUntil = Number(data.teamFeverUntil || 0) || 0;
      state.bossWeakUntil = Number(data.bossWeakUntil || 0) || 0;

      state.mission = data.mission && typeof data.mission === 'object' ? data.mission : state.mission;
      state.missionBonusGiven = !!data.missionBonusGiven;
      state.missionFailed = !!data.missionFailed;

      state.bossStarted = !!data.bossStarted;
      state.bossCleared = !!data.bossCleared;
      state.bossHits = Number(data.bossHits || 0) || 0;

      state.spawnCursor = Number(data.spawnCursor || 0) || 0;
      state.powerCursor = Number(data.powerCursor || 0) || 0;

      state.restoredFromCache = true;
      return true;
    } catch (_) {
      return false;
    }
  }

  function clearRoundCache() {
    try {
      sessionStorage.removeItem(roomStorageKey());
    } catch (_) {}
  }

  function startRoundCacheLoop() {
    stopRoundCacheLoop();
    state.saveTimer = setInterval(() => {
      if (!state.ended) saveRoundCache();
    }, 900);
  }

  function stopRoundCacheLoop() {
    if (state.saveTimer) {
      clearInterval(state.saveTimer);
      state.saveTimer = 0;
    }
  }

  function preset() {
    const diff = String(ctx.diff || 'normal').toLowerCase();
    if (diff === 'easy') {
      return {
        spawnMs: 900,
        goodRatio: 0.74,
        speedMin: 80,
        speedMax: 130,
        sizeMin: 74,
        sizeMax: 98,
        teamGoal: 260,
        bossHp: 16,
        bossReward: 36
      };
    }
    if (diff === 'hard') {
      return {
        spawnMs: 560,
        goodRatio: 0.58,
        speedMin: 120,
        speedMax: 190,
        sizeMin: 62,
        sizeMax: 86,
        teamGoal: 420,
        bossHp: 24,
        bossReward: 50
      };
    }
    return {
      spawnMs: 700,
      goodRatio: 0.66,
      speedMin: 96,
      speedMax: 160,
      sizeMin: 68,
      sizeMax: 92,
      teamGoal: 360,
      bossHp: 20,
      bossReward: 42
    };
  }

  function chooseMission() {
    const all = [
      { title: 'เก็บของดี 12 ชิ้น', desc: 'แตะอาหารดีให้ได้อย่างน้อย 12 ชิ้น', kind: 'goodHit', target: 12, bonus: 18 },
      { title: 'พลาดไม่เกิน 6', desc: 'พยายามไม่พลาดของดีมากเกินไป', kind: 'miss', target: 6, bonus: 16 },
      { title: 'ทำคอมโบ 6', desc: 'เก็บต่อเนื่องให้ได้ streak สูงสุด 6', kind: 'streak', target: 6, bonus: 18 }
    ];
    return { ...all[int(seeded(`${ctx.roomId}:${ctx.seed}:mission`)() * all.length, 0)] };
  }

  function missionCleared() {
    if (!state.mission) return false;
    if (state.mission.kind === 'goodHit') return state.goodHit >= state.mission.target;
    if (state.mission.kind === 'miss') return state.miss <= state.mission.target;
    if (state.mission.kind === 'streak') return state.bestStreak >= state.mission.target;
    return false;
  }

  function maybeClearMission(showFx = false) {
    if (!state.mission || state.missionBonusGiven) return;
    if (!missionCleared()) return;

    state.missionBonusGiven = true;
    state.score += Number(state.mission.bonus || 0);
    state.contribution = state.score;
    state.stars += 1;

    if (showFx) {
      showNote('Mission Clear!');
      setTimeout(hideNote, 900);
    }
  }

  function activeDouble() {
    return now() < state.doubleUntil || now() < state.teamFeverUntil;
  }

  function activeBossWeak() {
    return now() < state.bossWeakUntil;
  }

  function stageSize() {
    const rect = ui.stage.getBoundingClientRect();
    state.width = Math.max(320, Math.round(rect.width));
    state.height = Math.max(420, Math.round(rect.height));
  }

  function injectStyle() {
    if (D.getElementById('gj-coop-run-style')) return;

    const style = D.createElement('style');
    style.id = 'gj-coop-run-style';
    style.textContent = `
      .gj-coop-root{
        position:absolute; inset:0; z-index:1;
        display:grid; grid-template-rows:1fr;
      }
      .gj-coop-stage{
        position:relative;
        width:100%;
        height:100%;
        overflow:hidden;
        border-radius:32px;
        background:
          radial-gradient(circle at 20% 10%, rgba(255,255,255,.55), transparent 18%),
          linear-gradient(180deg,#dff6ff 0%, #bfe8ff 44%, #fff6d7 100%);
      }
      .gj-coop-stage::before{
        content:"";
        position:absolute; left:-8%; right:-8%; bottom:-22px; height:120px;
        border-radius:999px 999px 0 0;
        background:linear-gradient(180deg,#9be26c,#6ecb47);
        box-shadow:0 -6px 18px rgba(0,0,0,.08) inset;
      }
      .gj-coop-hud-top{
        position:absolute; left:12px; right:12px; top:12px;
        display:grid; gap:10px;
        z-index:6;
        pointer-events:none;
      }
      .gj-coop-hud-row{
        display:grid;
        grid-template-columns:repeat(4,minmax(0,1fr));
        gap:8px;
      }
      .gj-coop-chip{
        min-height:54px;
        padding:10px 12px;
        border-radius:20px;
        background:linear-gradient(180deg,rgba(255,255,255,.94),rgba(246,252,255,.94));
        border:3px solid #c8e7ef;
        box-shadow:0 10px 22px rgba(86,155,194,.10);
        color:#6d6a62;
      }
      .gj-coop-chip .l{
        display:block; font-size:11px; font-weight:1000; color:#8aa1b0; margin-bottom:4px;
      }
      .gj-coop-chip .v{
        display:block; font-size:20px; font-weight:1000; color:#4d4a42; line-height:1.05;
      }
      .gj-coop-mission{
        min-height:64px;
        padding:12px 14px;
        border-radius:22px;
        background:linear-gradient(180deg,rgba(255,255,255,.94),rgba(255,250,240,.94));
        border:3px solid #e6d3b4;
        box-shadow:0 10px 22px rgba(86,155,194,.10);
        color:#6f6b63;
      }
      .gj-coop-mission .t{
        font-size:14px; font-weight:1000; color:#7a63c7; margin-bottom:4px;
      }
      .gj-coop-mission .s{
        font-size:12px; line-height:1.55; font-weight:1000; color:#7d7568;
      }
      .gj-coop-goal{
        display:grid; gap:6px;
      }
      .gj-coop-bar{
        width:100%; height:16px; overflow:hidden;
        border-radius:999px;
        background:rgba(255,255,255,.66);
        border:2px solid #c8e7ef;
      }
      .gj-coop-fill{
        height:100%; width:0%;
        background:linear-gradient(90deg,#8bdc61,#57c23f);
        border-radius:999px;
      }
      .gj-coop-boss{
        position:absolute;
        left:12px; right:12px; top:164px;
        z-index:6;
        display:none;
        gap:6px;
      }
      .gj-coop-boss .label{
        font-size:12px; font-weight:1000; color:#8b5d2c;
        padding:0 2px;
      }
      .gj-coop-boss .bar{
        width:100%; height:18px; overflow:hidden;
        border-radius:999px;
        background:rgba(255,255,255,.7);
        border:2px solid #ffd0b4;
      }
      .gj-coop-boss .fill{
        height:100%; width:0%;
        background:linear-gradient(90deg,#ffca7b,#ff8e61);
        border-radius:999px;
      }
      .gj-coop-note{
        position:absolute;
        left:50%;
        bottom:132px;
        transform:translateX(-50%);
        z-index:6;
        min-width:180px;
        max-width:min(88vw,520px);
        min-height:46px;
        padding:10px 16px;
        border-radius:20px;
        background:linear-gradient(180deg,rgba(255,255,255,.96),rgba(255,250,241,.96));
        border:3px solid #e6d3b4;
        box-shadow:0 12px 22px rgba(86,155,194,.12);
        display:none;
        place-items:center;
        text-align:center;
        color:#7a6757;
        font-size:14px;
        font-weight:1000;
      }
      .gj-coop-layer{
        position:absolute; inset:0; z-index:3;
      }
      .gj-coop-target{
        position:absolute;
        appearance:none; border:0; cursor:pointer;
        display:grid; place-items:center;
        border-radius:999px;
        box-shadow:0 16px 26px rgba(86,155,194,.16);
        transform:translateZ(0);
        user-select:none;
        -webkit-tap-highlight-color:transparent;
      }
      .gj-coop-target.good{
        background:linear-gradient(180deg,#f7fff1,#eaffdf);
        border:3px solid #a9dc8e;
      }
      .gj-coop-target.junk{
        background:linear-gradient(180deg,#fff4f1,#ffe0d8);
        border:3px solid #ffb7a4;
      }
      .gj-coop-target.power{
        background:linear-gradient(180deg,#f4edff,#fffdf8);
        border:3px solid #d8cff8;
      }
      .gj-coop-target.boss{
        background:linear-gradient(180deg,#fff2ea,#ffd3bc);
        border:4px solid #ffb085;
        box-shadow:0 18px 34px rgba(255,144,97,.24);
      }
      .gj-coop-emoji{
        font-size:clamp(28px,4vw,42px);
        line-height:1;
        filter:drop-shadow(0 2px 0 rgba(255,255,255,.7));
        pointer-events:none;
      }
      .gj-coop-tag{
        position:absolute;
        bottom:-8px;
        left:50%;
        transform:translateX(-50%);
        min-height:20px;
        padding:3px 10px;
        border-radius:999px;
        background:rgba(255,255,255,.96);
        border:2px solid #dceef5;
        font-size:10px;
        font-weight:1000;
        color:#6d6a62;
        white-space:nowrap;
        pointer-events:none;
      }
      .gj-fx{
        position:absolute;
        transform:translate(-50%,-50%);
        z-index:8;
        font-size:18px;
        line-height:1;
        font-weight:1000;
        pointer-events:none;
        text-shadow:0 2px 0 rgba(255,255,255,.9);
        animation:gj-fx-rise .5s ease forwards;
      }
      @keyframes gj-fx-rise{
        0%{ opacity:0; transform:translate(-50%,-20%) scale(.8); }
        20%{ opacity:1; }
        100%{ opacity:0; transform:translate(-50%,-140%) scale(1.05); }
      }
      .gj-stage-pulse-good{ animation:gj-stage-pulse-good .18s ease; }
      .gj-stage-pulse-bad{ animation:gj-stage-pulse-bad .18s ease; }
      .gj-stage-pulse-boss{ animation:gj-stage-pulse-boss .24s ease; }

      @keyframes gj-stage-pulse-good{
        0%{ box-shadow:none; }
        100%{ box-shadow:0 0 0 9999px rgba(88,195,63,.05) inset; }
      }
      @keyframes gj-stage-pulse-bad{
        0%{ transform:translateX(0); }
        25%{ transform:translateX(-3px); }
        50%{ transform:translateX(3px); }
        75%{ transform:translateX(-2px); }
        100%{ transform:translateX(0); }
      }
      @keyframes gj-stage-pulse-boss{
        0%{ box-shadow:none; }
        100%{ box-shadow:0 0 0 9999px rgba(255,138,61,.06) inset; }
      }

      .gj-spectator-pill{
        position:absolute; right:12px; bottom:12px; z-index:6;
        display:inline-flex; align-items:center; gap:8px;
        min-height:40px; padding:8px 12px; border-radius:999px;
        background:rgba(255,255,255,.86);
        border:2px solid rgba(191,227,242,.95);
        box-shadow:0 10px 22px rgba(86,155,194,.12);
        color:#6d6a62; font-size:12px; font-weight:1000;
      }
      @media (max-width:820px){
        .gj-coop-hud-row{ grid-template-columns:repeat(2,minmax(0,1fr)); }
        .gj-coop-boss{ top:228px; }
      }
    `;
    D.head.appendChild(style);
  }

  function buildStage() {
    injectStyle();

    const mount = D.getElementById('gameMount');
    mount.innerHTML = `
      <div class="gj-coop-root">
        <div class="gj-coop-stage" id="gjCoopStage">
          <div class="gj-coop-hud-top">
            <div class="gj-coop-hud-row">
              <div class="gj-coop-chip"><span class="l">MY SCORE</span><span class="v" id="gjHudScore">0</span></div>
              <div class="gj-coop-chip"><span class="l">TIME</span><span class="v" id="gjHudTime">0:00</span></div>
              <div class="gj-coop-chip"><span class="l">TEAM</span><span class="v" id="gjHudTeam">0</span></div>
              <div class="gj-coop-chip"><span class="l">GOAL</span><span class="v" id="gjHudGoal">0</span></div>
            </div>

            <div class="gj-coop-mission">
              <div class="t" id="gjHudMission">Mission</div>
              <div class="s" id="gjHudMissionSub">...</div>
            </div>

            <div class="gj-coop-goal">
              <div class="gj-coop-bar"><div class="gj-coop-fill" id="gjHudTeamFill"></div></div>
            </div>
          </div>

          <div class="gj-coop-boss" id="gjBossWrap">
            <div class="label" id="gjBossLabel">Boss HP</div>
            <div class="bar"><div class="fill" id="gjBossFill"></div></div>
          </div>

          <div class="gj-coop-note" id="gjCoopNote"></div>
          <div class="gj-coop-layer" id="gjCoopLayer"></div>
          ${ctx.spectator ? '<div class="gj-spectator-pill">👀 กำลังดูรอบนี้</div>' : ''}
        </div>
      </div>
    `;

    ui.root = mount.querySelector('.gj-coop-root');
    ui.stage = D.getElementById('gjCoopStage');
    ui.layer = D.getElementById('gjCoopLayer');
    ui.score = D.getElementById('gjHudScore');
    ui.time = D.getElementById('gjHudTime');
    ui.team = D.getElementById('gjHudTeam');
    ui.goal = D.getElementById('gjHudGoal');
    ui.fill = D.getElementById('gjHudTeamFill');
    ui.mission = D.getElementById('gjHudMission');
    ui.missionSub = D.getElementById('gjHudMissionSub');
    ui.note = D.getElementById('gjCoopNote');
    ui.bossWrap = D.getElementById('gjBossWrap');
    ui.bossFill = D.getElementById('gjBossFill');
    ui.bossLabel = D.getElementById('gjBossLabel');

    stageSize();
    W.addEventListener('resize', stageSize, { passive: true });
  }

  function showNote(text) {
    if (!ui.note) return;
    ui.note.textContent = String(text || '');
    ui.note.style.display = 'grid';
  }

  function hideNote() {
    if (!ui.note) return;
    ui.note.style.display = 'none';
  }

  function pulseStage(kind = 'good') {
    if (!ui.stage || reducedMotion()) return;
    const cls = kind === 'bad'
      ? 'gj-stage-pulse-bad'
      : kind === 'boss'
        ? 'gj-stage-pulse-boss'
        : 'gj-stage-pulse-good';

    ui.stage.classList.remove('gj-stage-pulse-good', 'gj-stage-pulse-bad', 'gj-stage-pulse-boss');
    void ui.stage.offsetWidth;
    ui.stage.classList.add(cls);
    setTimeout(() => ui.stage?.classList.remove(cls), 220);
  }

  function ensureAudio() {
    if (state.audioCtx) return state.audioCtx;
    try {
      const AC = W.AudioContext || W.webkitAudioContext;
      if (!AC) return null;
      state.audioCtx = new AC();
      return state.audioCtx;
    } catch (_) {
      return null;
    }
  }

  function playTone(type = 'good') {
    if (ctx.spectator || !soundEnabled()) return;
    const ac = ensureAudio();
    if (!ac) return;

    try {
      if (ac.state === 'suspended') ac.resume().catch(() => {});
      const o = ac.createOscillator();
      const g = ac.createGain();

      o.type = type === 'bad' ? 'square' : type === 'boss' ? 'triangle' : 'sine';
      o.frequency.value = type === 'bad' ? 180 : type === 'boss' ? 480 : 760;
      g.gain.value = 0.0001;

      o.connect(g);
      g.connect(ac.destination);

      const t = ac.currentTime;
      g.gain.linearRampToValueAtTime(type === 'bad' ? 0.02 : 0.03, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + (type === 'boss' ? 0.18 : 0.12));
      o.start(t);
      o.stop(t + (type === 'boss' ? 0.2 : 0.14));
    } catch (_) {}
  }

  function spawnFx(x, y, text, warm = false) {
    const el = D.createElement('div');
    el.className = 'gj-fx';
    el.textContent = String(text || '');
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.color = warm ? '#d97706' : '#16a34a';
    ui.stage.appendChild(el);
    setTimeout(() => el.remove(), 520);
  }

  function removeTarget(target) {
    if (!target || target.dead) return;
    target.dead = true;
    try { target.el?.remove(); } catch (_) {}
    if (state.targets.has(target.id)) state.targets.delete(target.id);
  }

  function participants(room = state.room) {
    const ids = Array.isArray(room?.match?.participantIds)
      ? room.match.participantIds.map(normalizePid).filter(Boolean)
      : [];
    if (!ids.length) return (room?.players || []).filter((p) => p.connected !== false);
    return (room?.players || []).filter((p) => ids.includes(normalizePid(p.id)));
  }

  function amParticipant(room = state.room) {
    if (ctx.spectator) return true;
    return participants(room).some((p) => normalizePid(p.id) === normalizePid(ctx.pid));
  }

  function isHost(room = state.room) {
    return normalizePid(room?.hostId) === normalizePid(ctx.pid);
  }

  function teamGoal(room = state.room) {
    const roomGoal = num(room?.teamGoal || room?.goal || room?.match?.coop?.goal, 0);
    return Math.max(1, roomGoal || preset().teamGoal);
  }

  function teamScore(room = state.room) {
    const players = room?.players || [];
    const sum = players.reduce((acc, p) => acc + num(p.contribution ?? p.score ?? p.finalScore, 0), 0);
    return Math.max(sum, num(room?.teamScore, 0));
  }

  function participantsFinished(room = state.room) {
    const part = participants(room);
    if (!part.length) return false;
    return part.every((p) => !!p.finished);
  }

  function sortedSummaryPlayers(room = state.room) {
    return [...(room?.players || [])]
      .map((p) => ({
        pid: normalizePid(p.id),
        name: cleanText(p.name || p.id),
        score: num(p.score ?? p.finalScore ?? 0, 0),
        contribution: num(p.contribution ?? p.score ?? p.finalScore ?? 0, 0),
        miss: num(p.miss, 0),
        bestStreak: num(p.streak, 0),
        helps: num(p.helps, 0),
        finished: !!p.finished
      }))
      .sort((a, b) => {
        if (b.contribution !== a.contribution) return b.contribution - a.contribution;
        if (a.miss !== b.miss) return a.miss - b.miss;
        if (b.bestStreak !== a.bestStreak) return b.bestStreak - a.bestStreak;
        return a.name.localeCompare(b.name, 'th');
      });
  }

  function pushBridgeState() {
    const summaryPlayers = sortedSummaryPlayers(state.room);
    const detail = {
      pid: ctx.pid,
      roomId: ctx.roomId,
      mode: 'coop',
      score: state.score,
      contribution: state.contribution,
      miss: state.miss,
      bestStreak: state.bestStreak,
      helps: state.helps,
      timeLeftSec: Math.ceil(Math.max(0, state.timeLeftMs) / 1000),
      teamScore: teamScore(state.room),
      teamGoal: teamGoal(state.room),
      players: summaryPlayers,
      playersList: summaryPlayers,
      playerCount: summaryPlayers.length,
      finalClear: teamScore(state.room) >= teamGoal(state.room),
      ended: state.ended,
      endedAt: new Date(now()).toISOString()
    };

    emit('coop:update', detail);
    emit('coop:players', { players: summaryPlayers });
    emit('coop:team', detail);

    try { W.CoopSafe?.setState(detail); } catch (_) {}
    try { W.CoopSafe?.setPlayers(summaryPlayers); } catch (_) {}
    try { W.CoopSafe?.setTeamProgress(detail); } catch (_) {}

    if (ui.score) ui.score.textContent = String(state.score);
    if (ui.time) ui.time.textContent = fmtClock(Math.ceil(Math.max(0, state.timeLeftMs) / 1000));
    if (ui.team) ui.team.textContent = String(teamScore(state.room));
    if (ui.goal) ui.goal.textContent = String(teamGoal(state.room));
    if (ui.fill) ui.fill.style.width = `${clamp((teamScore(state.room) / Math.max(1, teamGoal(state.room))) * 100, 0, 100)}%`;

    if (ui.mission && state.mission) {
      ui.mission.textContent = state.mission.title;
      ui.missionSub.textContent = state.mission.desc;
    }

    try {
      W.__GJ_COOP_SET_REMATCH_STATE__?.({
        isHost: !ctx.spectator && isHost(state.room) && amParticipant(state.room),
        canRematch: state.ended ? (!ctx.spectator && isHost(state.room) && participants(state.room).filter((p) => p.connected !== false).length >= Math.max(2, state.room?.minPlayers || 2)) : false
      });
    } catch (_) {}

    try {
      W.__GJ_COOP_SET_HOST_CONTROL__?.({
        isHost: !ctx.spectator && isHost(state.room) && amParticipant(state.room),
        running: !!state.running && !state.ended,
        ended: !!state.ended,
        canRematch: state.ended ? (!ctx.spectator && isHost(state.room) && participants(state.room).filter((p) => p.connected !== false).length >= Math.max(2, state.room?.minPlayers || 2)) : false
      });
    } catch (_) {}
  }

  function startSyncLoop() {
    stopSyncLoop();
    state.syncTimer = setInterval(async () => {
      if (ctx.spectator || state.ended || !state.myRef) return;
      try {
        await syncSelf({
          finished: false,
          phase: 'run',
          score: Number(state.score || 0),
          contribution: Number(state.score || 0),
          miss: Number(state.miss || 0),
          streak: Number(state.bestStreak || 0),
          helps: Number(state.helps || 0)
        });
      } catch (_) {}
    }, 1200);
  }

  function stopSyncLoop() {
    if (state.syncTimer) {
      clearInterval(state.syncTimer);
      state.syncTimer = 0;
    }
  }

  async function syncSelf(patch = {}) {
    if (!state.myRef) return;
    await state.myRef.update({
      ...patch,
      lastSeenAt: now(),
      name: cleanText(ctx.name || ctx.pid),
      connected: true
    });
  }

  async function joinRunPresence() {
    if (!state.myRef || ctx.spectator) return;
    await syncSelf({
      ready: true,
      finished: false,
      phase: 'run'
    });
    try {
      await state.myRef.onDisconnect().update({
        connected: false,
        phase: 'lobby'
      });
    } catch (_) {}
  }

  async function waitStartGate() {
    const startAt = Number(state.room?.match?.coop?.runtime?.startAt || state.room?.startAt || ctx.startAt || now()) || now();
    const waitMs = Math.max(0, startAt - now());
    if (!waitMs) return;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  async function ensureFirebase() {
    if (W.HHA_FIREBASE_DB && W.HHA_FIREBASE) {
      state.firebase = W.HHA_FIREBASE;
      state.db = W.HHA_FIREBASE_DB;
      return;
    }

    if (!W.firebase) {
      await loadScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
      await loadScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-database-compat.js');
    }

    if (!W.HHA_FIREBASE_CONFIG && !W.HEROHEALTH_FIREBASE_CONFIG && !W.FIREBASE_CONFIG) {
      try {
        await loadScript('../firebase-config.js');
      } catch (_) {
        try {
          await loadScript('./firebase-config.js');
        } catch (_) {}
      }
    }

    const cfg =
      W.HHA_FIREBASE_CONFIG ||
      W.HEROHEALTH_FIREBASE_CONFIG ||
      W.FIREBASE_CONFIG ||
      W.__firebaseConfig ||
      W.firebaseConfig;

    if (!cfg || !cfg.apiKey || !cfg.projectId) {
      throw new Error('ไม่พบ Firebase config');
    }

    const fb = W.firebase;
    const app = (fb.apps && fb.apps.length)
      ? fb.app()
      : fb.initializeApp(cfg);

    state.firebase = fb;
    state.db = fb.database(app);

    W.HHA_FIREBASE = fb;
    W.HHA_FIREBASE_DB = state.db;
    W.HHA_FIREBASE_READY = true;

    emit('hha:firebase_ready', { ok: true });
  }

  function roomFromRaw(raw) {
    const playersMap = raw?.players && typeof raw.players === 'object' ? raw.players : {};
    const players = Object.keys(playersMap).map((pid) => ({
      id: normalizePid(pid),
      ...playersMap[pid]
    }));

    return {
      roomId: cleanText(raw?.roomId || ctx.roomId),
      hostId: normalizePid(raw?.hostId || ''),
      minPlayers: num(raw?.minPlayers, 2),
      maxPlayers: num(raw?.maxPlayers, 10),
      status: cleanText(raw?.status || 'waiting') || 'waiting',
      startAt: num(raw?.startAt, 0) || 0,
      players,
      teamGoal: num(raw?.teamGoal || raw?.goal || 0, 0),
      teamScore: num(raw?.teamScore || 0, 0),
      match: {
        participantIds: Array.isArray(raw?.match?.participantIds)
          ? raw.match.participantIds.map(normalizePid).filter(Boolean)
          : [],
        lockedAt: num(raw?.match?.lockedAt, 0) || 0,
        status: cleanText(raw?.match?.status || 'idle') || 'idle',
        coop: {
          finishedAt: num(raw?.match?.coop?.finishedAt, 0) || 0,
          rematchToken: num(raw?.match?.coop?.rematchToken, 0) || 0,
          shared: {
            seq: num(raw?.match?.coop?.shared?.seq, 0) || 0,
            type: cleanText(raw?.match?.coop?.shared?.type || ''),
            issuedAt: num(raw?.match?.coop?.shared?.issuedAt, 0) || 0,
            feverUntil: num(raw?.match?.coop?.shared?.feverUntil, 0) || 0,
            freezeUntil: num(raw?.match?.coop?.shared?.freezeUntil, 0) || 0,
            bossWeakUntil: num(raw?.match?.coop?.shared?.bossWeakUntil, 0) || 0,
            shieldAll: num(raw?.match?.coop?.shared?.shieldAll, 0) || 0,
            fromPid: cleanText(raw?.match?.coop?.shared?.fromPid || '')
          },
          currentEvent: {
            seq: num(raw?.match?.coop?.currentEvent?.seq, 0) || 0,
            type: cleanText(raw?.match?.coop?.currentEvent?.type || ''),
            issuedAt: num(raw?.match?.coop?.currentEvent?.issuedAt, 0) || 0,
            feverUntil: num(raw?.match?.coop?.currentEvent?.feverUntil, 0) || 0,
            freezeUntil: num(raw?.match?.coop?.currentEvent?.freezeUntil, 0) || 0,
            bossWeakUntil: num(raw?.match?.coop?.currentEvent?.bossWeakUntil, 0) || 0,
            shieldAll: num(raw?.match?.coop?.currentEvent?.shieldAll, 0) || 0,
            bonusScore: num(raw?.match?.coop?.currentEvent?.bonusScore, 0) || 0,
            text: cleanText(raw?.match?.coop?.currentEvent?.text || ''),
            fromPid: cleanText(raw?.match?.coop?.currentEvent?.fromPid || '')
          },
          boss: {
            active: !!raw?.match?.coop?.boss?.active,
            hp: num(raw?.match?.coop?.boss?.hp, 0) || 0,
            hpMax: num(raw?.match?.coop?.boss?.hpMax, 0) || 0,
            cleared: !!raw?.match?.coop?.boss?.cleared,
            weakUntil: num(raw?.match?.coop?.boss?.weakUntil, 0) || 0,
            startedAt: num(raw?.match?.coop?.boss?.startedAt, 0) || 0
          },
          eventRequests: raw?.match?.coop?.eventRequests && typeof raw.match.coop.eventRequests === 'object'
            ? raw.match.coop.eventRequests
            : {},
          hitRequests: raw?.match?.coop?.hitRequests && typeof raw.match.coop.hitRequests === 'object'
            ? raw.match.coop.hitRequests
            : {},
          runtime: raw?.match?.coop?.runtime && typeof raw.match.coop.runtime === 'object'
            ? {
                version: cleanText(raw.match.coop.runtime.version || 'R6'),
                roundSeed: cleanText(raw.match.coop.runtime.roundSeed || ''),
                durationSec: num(raw.match.coop.runtime.durationSec, 0) || 0,
                startAt: num(raw.match.coop.runtime.startAt, 0) || 0,
                createdAt: num(raw.match.coop.runtime.createdAt, 0) || 0
              }
            : null,
          resultSnapshot: raw?.match?.coop?.resultSnapshot && typeof raw.match.coop.resultSnapshot === 'object'
            ? raw.match.coop.resultSnapshot
            : null
        }
      }
    };
  }

  function buildAuthoritativeSnapshot(reason = 'finished') {
    const players = sortedSummaryPlayers(state.room);
    return {
      version: 'R9',
      roomId: ctx.roomId,
      reason,
      finishedAt: now(),
      finalClear: teamScore(state.room) >= teamGoal(state.room),
      teamScore: teamScore(state.room),
      teamGoal: teamGoal(state.room),
      players,
      playerCount: players.length,
      result: teamScore(state.room) >= teamGoal(state.room) ? 'ผ่านเป้าหมายทีม' : 'จบรอบ',
      missionTitle: state.mission?.title || '',
      missionDesc: state.mission?.desc || '',
      missionCleared: missionCleared(),
      missionBonus: missionCleared() ? Number(state.mission?.bonus || 0) : 0,
      bossCleared: !!state.bossCleared,
      bossHits: Number(state.bossHits || 0),
      teamFeverUsed: !!(state.teamFeverUntil > 0),
      bossWeakTriggered: !!state.bossWeakTriggered,
      createdBy: ctx.pid
    };
  }

  function snapshotForMe(snapshot) {
    const players = Array.isArray(snapshot?.players) ? snapshot.players : [];
    const mine = players.find((p) => String(p.pid || '') === String(ctx.pid || '')) || null;
    return {
      score: Number(mine?.score || mine?.contribution || state.score || 0) || 0,
      contribution: Number(mine?.contribution || mine?.score || state.score || 0) || 0,
      miss: Number(mine?.miss || state.miss || 0) || 0,
      bestStreak: Number(mine?.bestStreak || state.bestStreak || 0) || 0,
      helps: Number(mine?.helps || state.helps || 0) || 0
    };
  }

  function summaryFromSnapshot(snapshot, reason = 'finished') {
    const mine = snapshotForMe(snapshot);
    return {
      mode: 'coop',
      game: 'goodjunk-coop',
      gameId: ctx.gameId,
      pid: ctx.pid,
      name: ctx.name || ctx.pid,
      roomId: ctx.roomId,
      diff: ctx.diff,
      time: ctx.time,
      result: snapshot?.result || (snapshot?.finalClear ? 'ผ่านเป้าหมายทีม' : 'จบรอบ'),
      reason: snapshot?.reason || reason,
      score: mine.score,
      contribution: mine.contribution,
      teamScore: Number(snapshot?.teamScore || 0) || 0,
      teamGoal: Number(snapshot?.teamGoal || 0) || 0,
      players: Number(snapshot?.playerCount || (snapshot?.players?.length || 0)) || 0,
      playersList: Array.isArray(snapshot?.players) ? snapshot.players : [],
      miss: mine.miss,
      goodHit: state.goodHit,
      junkHit: state.junkHit,
      bestStreak: mine.bestStreak,
      duration: ctx.time,
      finalClear: !!snapshot?.finalClear,
      missionTitle: snapshot?.missionTitle || '',
      missionDesc: snapshot?.missionDesc || '',
      missionCleared: !!snapshot?.missionCleared,
      missionBonus: Number(snapshot?.missionBonus || 0) || 0,
      shieldCharges: state.shieldCharges,
      bossCleared: !!snapshot?.bossCleared,
      stars: state.stars,
      teamFeverUsed: !!snapshot?.teamFeverUsed,
      bossWeakTriggered: !!snapshot?.bossWeakTriggered,
      bossHits: Number(snapshot?.bossHits || 0) || 0,
      endedAt: new Date(Number(snapshot?.finishedAt || now())).toISOString(),
      summary: {
        mode: 'coop',
        score: mine.score,
        contribution: mine.contribution,
        teamScore: Number(snapshot?.teamScore || 0) || 0,
        teamGoal: Number(snapshot?.teamGoal || 0) || 0,
        playerCount: Number(snapshot?.playerCount || (snapshot?.players?.length || 0)) || 0,
        players: Array.isArray(snapshot?.players) ? snapshot.players : [],
        miss: mine.miss,
        goodHit: state.goodHit,
        junkHit: state.junkHit,
        bestStreak: mine.bestStreak,
        duration: ctx.time,
        finalClear: !!snapshot?.finalClear,
        roomId: ctx.roomId,
        result: snapshot?.result || (snapshot?.finalClear ? 'ผ่านเป้าหมายทีม' : 'จบรอบ'),
        reason: snapshot?.reason || reason,
        missionTitle: snapshot?.missionTitle || '',
        missionDesc: snapshot?.missionDesc || '',
        missionCleared: !!snapshot?.missionCleared,
        missionBonus: Number(snapshot?.missionBonus || 0) || 0,
        shieldCharges: state.shieldCharges,
        bossCleared: !!snapshot?.bossCleared,
        stars: state.stars,
        teamFeverUsed: !!snapshot?.teamFeverUsed,
        bossWeakTriggered: !!snapshot?.bossWeakTriggered,
        bossHits: Number(snapshot?.bossHits || 0) || 0,
        endedAt: new Date(Number(snapshot?.finishedAt || now())).toISOString()
      }
    };
  }

  async function finalizeSummaryIfNeeded(reason = 'finished') {
    if (state.summaryShown) return;
    state.summaryShown = true;

    const snapshot = state.room?.match?.coop?.resultSnapshot;
    const summary = snapshot
      ? summaryFromSnapshot(snapshot, reason)
      : summaryFromSnapshot(buildAuthoritativeSnapshot(reason), reason);

    summary.playersList = Array.isArray(summary?.summary?.players) ? summary.summary.players : (summary.playersList || []);

    try { W.CoopSafe?.finishGame(summary.summary); } catch (_) {}
    emit('coop:finish', summary.summary);
    emit('gj:coop-summary', summary);
    emit('gj:summary', summary);
    emit('hha:summary', summary);

    try {
      localStorage.setItem(`GJ_COOP_LAST_SUMMARY_${ctx.roomId}_${ctx.pid}`, JSON.stringify(summary));
      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary));
    } catch (_) {}
  }

  async function hostFinalizeRound(reason = 'finished') {
    if (!isHost(state.room) || !state.roomRef || state.finalizeBusy) return false;
    if (state.finalSnapshotWritten && state.room?.match?.coop?.resultSnapshot) return true;

    state.finalizeBusy = true;
    try {
      const snapshot = buildAuthoritativeSnapshot(reason);
      await state.roomRef.update({
        status: 'finished',
        updatedAt: now(),
        'match/status': 'finished',
        'match/coop/finishedAt': now(),
        'match/coop/resultSnapshot': snapshot
      });
      state.finalSnapshotWritten = true;
      return true;
    } catch (err) {
      console.warn('[GJ-COOP-ENGINE] hostFinalizeRound failed:', err);
      return false;
    } finally {
      state.finalizeBusy = false;
    }
  }

  async function hostCleanupQueues(room = state.room) {
    if (!isHost(room) || !state.roomRef || state.cleanupBusy) return;
    if ((now() - state.lastCleanupAt) < 1800) return;

    state.cleanupBusy = true;
    state.lastCleanupAt = now();

    try {
      const updates = {};
      const nowTs = now();

      const eventReq = room?.match?.coop?.eventRequests || {};
      for (const [key, req] of Object.entries(eventReq)) {
        const at = Number(req?.at || 0) || 0;
        if (!at || (nowTs - at) > 12000) {
          updates[`match/coop/eventRequests/${key}`] = null;
        }
      }

      const hitReq = room?.match?.coop?.hitRequests || {};
      for (const [key, req] of Object.entries(hitReq)) {
        const at = Number(req?.at || 0) || 0;
        if (!at || (nowTs - at) > 8000) {
          updates[`match/coop/hitRequests/${key}`] = null;
        }
      }

      if (Object.keys(updates).length) {
        await state.roomRef.update(updates);
      }
    } catch (err) {
      console.warn('[GJ-COOP-ENGINE] hostCleanupQueues failed:', err);
    } finally {
      state.cleanupBusy = false;
    }
  }

  async function hostEmitCurrentEvent(type, patch = {}) {
    if (!state.roomRef) return false;
    const seq = now();
    try {
      await state.roomRef.child('match/coop/currentEvent').set({
        seq,
        type: String(type || '').trim(),
        issuedAt: now(),
        feverUntil: 0,
        freezeUntil: 0,
        bossWeakUntil: 0,
        shieldAll: 0,
        bonusScore: 0,
        text: '',
        fromPid: ctx.pid,
        ...patch
      });
      return true;
    } catch (err) {
      console.warn('[GJ-COOP-ENGINE] hostEmitCurrentEvent failed:', err);
      return false;
    }
  }

  async function enqueueTeamEvent(type, patch = {}) {
    if (!state.roomRef || !state.room) return false;

    if (isHost(state.room)) {
      return hostEmitCurrentEvent(type, patch);
    }

    const key = `${ctx.pid}_${now()}_${Math.floor(Math.random() * 1000)}`;
    try {
      await state.roomRef.child(`match/coop/eventRequests/${key}`).set({
        type: String(type || '').trim(),
        at: now(),
        fromPid: ctx.pid,
        ...patch
      });
      return true;
    } catch (err) {
      console.warn('[GJ-COOP-ENGINE] enqueueTeamEvent failed:', err);
      return false;
    }
  }

  async function hostProcessEventRequests(room = state.room) {
    if (!isHost(room) || state.eventReqBusy || !state.roomRef) return;

    const reqMap = room?.match?.coop?.eventRequests || {};
    const entries = Object.entries(reqMap).sort((a, b) => num(a[1]?.at, 0) - num(b[1]?.at, 0));
    if (!entries.length) return;

    state.eventReqBusy = true;
    try {
      const [key, req] = entries[0];
      const type = String(req?.type || '').trim();
      const updates = {};
      updates[`match/coop/eventRequests/${key}`] = null;

      if (type === 'shield-all') {
        updates['match/coop/currentEvent'] = {
          seq: now(),
          type,
          issuedAt: now(),
          shieldAll: 1,
          feverUntil: 0,
          freezeUntil: 0,
          bossWeakUntil: 0,
          bonusScore: 0,
          text: 'Team Shield +1',
          fromPid: String(req?.fromPid || ctx.pid)
        };
      } else if (type === 'team-fever') {
        updates['match/coop/currentEvent'] = {
          seq: now(),
          type,
          issuedAt: now(),
          shieldAll: 0,
          feverUntil: Number(req?.feverUntil || (now() + 7000)),
          freezeUntil: 0,
          bossWeakUntil: 0,
          bonusScore: 0,
          text: 'Team Fever!',
          fromPid: String(req?.fromPid || ctx.pid)
        };
      } else if (type === 'team-freeze') {
        updates['match/coop/currentEvent'] = {
          seq: now(),
          type,
          issuedAt: now(),
          shieldAll: 0,
          feverUntil: 0,
          freezeUntil: Number(req?.freezeUntil || (now() + 4500)),
          bossWeakUntil: 0,
          bonusScore: 0,
          text: 'Freeze ทั้งทีม!',
          fromPid: String(req?.fromPid || ctx.pid)
        };
      } else {
        await state.roomRef.child(`match/coop/eventRequests/${key}`).remove();
        state.eventReqBusy = false;
        return;
      }

      await state.roomRef.update(updates);
    } catch (err) {
      console.warn('[GJ-COOP-ENGINE] hostProcessEventRequests failed:', err);
    } finally {
      state.eventReqBusy = false;
    }
  }

  async function requestBossHit(power = 1) {
    if (!state.roomRef || !state.room?.match?.coop?.boss?.active) return false;
    const key = `${ctx.pid}_${now()}_${Math.floor(Math.random() * 1000)}`;
    try {
      await state.roomRef.child(`match/coop/hitRequests/${key}`).set({
        pid: ctx.pid,
        power: Number(power || 1) || 1,
        at: now()
      });
      return true;
    } catch (err) {
      console.warn('[GJ-COOP-ENGINE] requestBossHit failed:', err);
      return false;
    }
  }

  async function hostProcessBossHitRequests(room = state.room) {
    if (!isHost(room) || state.bossReqBusy || !state.roomRef) return;

    const boss = room?.match?.coop?.boss;
    if (!boss || !boss.active || boss.cleared) return;

    const reqMap = room?.match?.coop?.hitRequests || {};
    const entries = Object.entries(reqMap).sort((a, b) => num(a[1]?.at, 0) - num(b[1]?.at, 0));
    if (!entries.length) return;

    state.bossReqBusy = true;
    try {
      const hpMax = num(boss.hpMax || preset().bossHp, preset().bossHp);
      const oldHp = num(boss.hp || hpMax, hpMax);
      const totalHit = entries.reduce((sum, [, req]) => sum + Math.max(1, num(req?.power, 1)), 0);
      const nextHp = Math.max(0, oldHp - totalHit);

      const updates = {};
      entries.forEach(([key]) => {
        updates[`match/coop/hitRequests/${key}`] = null;
      });

      updates['match/coop/boss/hp'] = nextHp;

      const halfThreshold = Math.ceil(hpMax / 2);
      if (oldHp > halfThreshold && nextHp <= halfThreshold && nextHp > 0) {
        const weakUntil = now() + 5500;
        updates['match/coop/boss/weakUntil'] = weakUntil;
        updates['match/coop/currentEvent'] = {
          seq: now(),
          type: 'boss-weak',
          issuedAt: now(),
          shieldAll: 0,
          feverUntil: 0,
          freezeUntil: 0,
          bossWeakUntil: weakUntil,
          bonusScore: 0,
          text: 'Boss Weak Point!',
          fromPid: ctx.pid
        };
      }

      if (nextHp <= 0) {
        updates['match/coop/boss/active'] = false;
        updates['match/coop/boss/cleared'] = true;
        updates['match/coop/currentEvent'] = {
          seq: now(),
          type: 'boss-clear',
          issuedAt: now(),
          shieldAll: 0,
          feverUntil: 0,
          freezeUntil: 0,
          bossWeakUntil: 0,
          bonusScore: Number(preset().bossReward || 40),
          text: 'Boss Clear! โบนัสทั้งทีม',
          fromPid: ctx.pid
        };
      }

      await state.roomRef.update(updates);
    } catch (err) {
      console.warn('[GJ-COOP-ENGINE] hostProcessBossHitRequests failed:', err);
    } finally {
      state.bossReqBusy = false;
    }
  }

  function applyAuthoritativeEventFromRoom(room = state.room) {
    const ev = room?.match?.coop?.currentEvent;
    if (!ev) return;

    const seq = Number(ev.seq || 0) || 0;
    const type = String(ev.type || '').trim();
    const key = `${seq}:${type}`;

    if (!seq || !type || key === state.lastAppliedEventKey) return;
    state.lastAppliedEventKey = key;
    state.authoritativeEventSeq = seq;

    if (Number(ev.feverUntil || 0) > now()) {
      state.teamFeverUntil = Math.max(state.teamFeverUntil, Number(ev.feverUntil || 0));
      showNote(ev.text || 'Team Fever!');
      setTimeout(hideNote, 700);
    }

    if (Number(ev.freezeUntil || 0) > now()) {
      state.freezeUntil = Math.max(state.freezeUntil, Number(ev.freezeUntil || 0));
      showNote(ev.text || 'Freeze ทั้งทีม!');
      setTimeout(hideNote, 700);
    }

    if (Number(ev.bossWeakUntil || 0) > now()) {
      state.bossWeakUntil = Math.max(state.bossWeakUntil, Number(ev.bossWeakUntil || 0));
      state.bossWeakTriggered = true;
      showNote(ev.text || 'Boss Weak Point!');
      setTimeout(hideNote, 700);
    }

    if (Number(ev.shieldAll || 0) > 0) {
      state.shieldCharges = Math.min(5, state.shieldCharges + Number(ev.shieldAll || 0));
      showNote(ev.text || `Team Shield +${Number(ev.shieldAll || 0)}`);
      setTimeout(hideNote, 700);
    }

    if (Number(ev.bonusScore || 0) > 0) {
      state.score += Number(ev.bonusScore || 0);
      state.contribution = state.score;
      showNote(ev.text || `+${Number(ev.bonusScore || 0)}`);
      setTimeout(hideNote, 800);
    }

    writeHud();
    pushBridgeState();
  }

  function syncBossAuthorityFromRoom(room = state.room) {
    const boss = room?.match?.coop?.boss;
    if (!boss) return;

    state.bossAuthority = {
      active: !!boss.active,
      hp: Number(boss.hp || 0) || 0,
      hpMax: Number(boss.hpMax || 0) || 0,
      cleared: !!boss.cleared,
      weakUntil: Number(boss.weakUntil || 0) || 0
    };

    if (Number(boss.weakUntil || 0) > now()) {
      state.bossWeakUntil = Math.max(state.bossWeakUntil, Number(boss.weakUntil || 0));
    }

    if (state.bossAuthority.active && !state.targets.get(state.bossId)) {
      spawnBossTarget(state.bossAuthority.hpMax || preset().bossHp);
    }

    const bossTarget = state.targets.get(state.bossId);
    if (bossTarget && bossTarget.kind === 'boss') {
      bossTarget.hp = state.bossAuthority.hp;
      bossTarget.hpMax = state.bossAuthority.hpMax;
    }

    if (ui.bossWrap) {
      if (state.bossAuthority.active || state.bossAuthority.cleared) {
        ui.bossWrap.style.display = '';
        const pct = state.bossAuthority.hpMax > 0
          ? clamp((state.bossAuthority.hp / state.bossAuthority.hpMax) * 100, 0, 100)
          : 0;
        ui.bossFill.style.width = `${pct}%`;
        ui.bossLabel.textContent = state.bossAuthority.cleared ? 'Boss Clear!' : `Boss HP ${state.bossAuthority.hp}/${state.bossAuthority.hpMax}`;
      } else {
        ui.bossWrap.style.display = 'none';
      }
    }

    if (state.bossAuthority.cleared) {
      state.bossCleared = true;
      const currentBoss = state.targets.get(state.bossId);
      if (currentBoss) removeTarget(currentBoss);
    }

    writeHud();
  }

  function spawnSeedBase() {
    const runtimeSeed = cleanText(state.room?.match?.coop?.runtime?.roundSeed || '');
    if (runtimeSeed) return runtimeSeed;
    return `${ctx.roomId}:${ctx.seed}:${state.currentRematchToken || 0}`;
  }

  function makeSpawnRng(index, salt = 'spawn') {
    return seeded(`${spawnSeedBase()}:${salt}:${index}`);
  }

  function plannedSpawnTimeMs(index) {
    const p = preset();
    const r = makeSpawnRng(index, 'spawn-time');
    const jitter = 0.88 + (r() * 0.28);
    return Math.floor(index * p.spawnMs * jitter);
  }

  function plannedPowerTimeMs(index) {
    const base = 4200;
    const r = makeSpawnRng(index, 'power-time');
    const jitter = 0.92 + (r() * 0.36);
    return Math.floor(index * base * jitter);
  }

  function buildSpawnSpec(index) {
    const p = preset();
    const r = makeSpawnRng(index, 'spawn-spec');

    const good = r() < p.goodRatio;
    const size = clampInt(p.sizeMin + ((p.sizeMax - p.sizeMin) * r()), p.sizeMin, p.sizeMax);
    const x = clampInt(10 + ((state.width - size - 20) * r()), 10, Math.max(10, state.width - size - 10));
    const y = -size - clampInt(r() * 28, 0, 28);
    const speed = p.speedMin + ((p.speedMax - p.speedMin) * r());

    return { good, size, x, y, speed, index };
  }

  function buildPowerSpec(index) {
    const r = makeSpawnRng(index, 'power-spec');
    const kinds = ['shield','double','freeze'];
    const powerType = kinds[Math.floor(r() * kinds.length)] || 'shield';

    const size = 70;
    const x = clampInt(16 + ((state.width - size - 32) * r()), 16, Math.max(16, state.width - size - 16));
    const y = -size - 16;
    return { powerType, size, x, y, speed: 120, index };
  }

  function createFallingTargetFromSpec(spec) {
    if (!state.running || !spec) return;

    const id = `gjc-${++state.targetSeq}`;
    const el = D.createElement('button');
    el.type = 'button';
    el.className = `gj-coop-target ${spec.good ? 'good' : 'junk'}`;
    el.style.left = `${spec.x}px`;
    el.style.top = `${spec.y}px`;
    el.style.width = `${spec.size}px`;
    el.style.height = `${spec.size}px`;
    el.innerHTML = `
      <div class="gj-coop-emoji">${spec.good ? pickBySeed(GOOD_ITEMS, `${spawnSeedBase()}:good:${spec.index}`) : pickBySeed(JUNK_ITEMS, `${spawnSeedBase()}:junk:${spec.index}`)}</div>
      <div class="gj-coop-tag">${spec.good ? 'good' : 'junk'}</div>
    `;

    const target = {
      id,
      el,
      kind: spec.good ? 'good' : 'junk',
      x: spec.x,
      y: spec.y,
      size: spec.size,
      speed: spec.speed,
      dead: false
    };

    el.addEventListener('click', () => hitTarget(target));
    ui.layer.appendChild(el);
    state.targets.set(id, target);
  }

  function spawnPowerTargetFromSpec(spec) {
    if (!state.running || !spec) return;

    const icon = spec.powerType === 'shield' ? '🛡️' : spec.powerType === 'double' ? '✨' : '❄️';
    const label = spec.powerType === 'shield' ? 'shield' : spec.powerType === 'double' ? 'x2' : 'freeze';

    const id = `gjc-p-${++state.targetSeq}`;
    const el = D.createElement('button');
    el.type = 'button';
    el.className = 'gj-coop-target power';
    el.style.left = `${spec.x}px`;
    el.style.top = `${spec.y}px`;
    el.style.width = `${spec.size}px`;
    el.style.height = `${spec.size}px`;
    el.innerHTML = `
      <div class="gj-coop-emoji">${icon}</div>
      <div class="gj-coop-tag">${label}</div>
    `;

    const target = {
      id,
      el,
      kind: 'power',
      powerType: spec.powerType,
      x: spec.x,
      y: spec.y,
      size: spec.size,
      speed: spec.speed,
      dead: false
    };

    el.addEventListener('click', () => hitTarget(target));
    ui.layer.appendChild(el);
    state.targets.set(id, target);
  }

  function spawnBossTarget(hpMax = preset().bossHp) {
    const size = clampInt(Math.min(state.width * 0.20, 136), 96, 136);
    const x = clampInt(state.width * 0.5 - size * 0.5, 20, Math.max(20, state.width - size - 20));
    const y = 76;

    const id = `gjc-b-${++state.targetSeq}`;
    const el = D.createElement('button');
    el.type = 'button';
    el.className = 'gj-coop-target boss';
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.innerHTML = `
      <div class="gj-coop-emoji">👾</div>
      <div class="gj-coop-tag">boss</div>
    `;

    const target = {
      id,
      el,
      kind: 'boss',
      x,
      y,
      size,
      dx: Math.random() > 0.5 ? 160 : -160,
      hp: hpMax,
      hpMax,
      dead: false
    };

    el.addEventListener('click', () => hitTarget(target));
    ui.layer.appendChild(el);
    state.targets.set(id, target);
    state.bossId = id;
    state.bossStarted = true;
    ui.bossWrap.style.display = '';
  }

  async function maybeStartBossPhase() {
    if (state.bossStarted || state.bossCleared) return;
    const elapsed = state.totalMs - state.timeLeftMs;
    if (elapsed < state.totalMs * 0.62) return;
    if (!isHost(state.room) || !state.roomRef) return;

    state.bossStarted = true;
    const hpMax = preset().bossHp;

    try {
      await state.roomRef.update({
        'match/coop/boss': {
          active: true,
          hp: hpMax,
          hpMax,
          cleared: false,
          weakUntil: 0,
          startedAt: now()
        }
      });
      await hostEmitCurrentEvent('boss-start', {
        text: 'Boss Phase!'
      });
    } catch (err) {
      console.warn('[GJ-COOP-ENGINE] maybeStartBossPhase failed:', err);
    }
  }

  async function applyPower(powerType) {
    if (powerType === 'shield') {
      await enqueueTeamEvent('shield-all', { shieldAll: 1 });
      return;
    }
    if (powerType === 'double') {
      await enqueueTeamEvent('team-fever', { feverUntil: now() + 7000 });
      return;
    }
    if (powerType === 'freeze') {
      await enqueueTeamEvent('team-freeze', { freezeUntil: now() + 4500 });
    }
  }

  function writeHud() {
    if (ui.score) ui.score.textContent = String(state.score);
    if (ui.time) ui.time.textContent = fmtClock(Math.ceil(Math.max(0, state.timeLeftMs) / 1000));
    if (ui.team) ui.team.textContent = String(teamScore(state.room));
    if (ui.goal) ui.goal.textContent = String(teamGoal(state.room));
    if (ui.fill) ui.fill.style.width = `${clamp((teamScore(state.room) / Math.max(1, teamGoal(state.room))) * 100, 0, 100)}%`;

    if (state.mission && ui.mission) {
      ui.mission.textContent = state.mission.title;
      ui.missionSub.textContent = missionCleared()
        ? `${state.mission.desc} • สำเร็จแล้ว`
        : state.mission.desc;
    }
  }

  function hitTarget(target) {
    if (!state.running || state.ended || !target || target.dead || ctx.spectator) return;

    const cx = target.x + target.size / 2;
    const cy = target.y + target.size / 2;

    if (target.kind === 'good') {
      state.score += activeDouble() ? 20 : 10;
      state.contribution = state.score;
      state.goodHit += 1;
      state.streak += 1;
      state.bestStreak = Math.max(state.bestStreak, state.streak);
      spawnFx(cx, cy, `+${activeDouble() ? 20 : 10}`, false);
      playTone('good');
      pulseStage('good');
      maybeClearMission(true);
      writeHud();
      pushBridgeState();
      removeTarget(target);
      return;
    }

    if (target.kind === 'junk') {
      if (state.shieldCharges > 0) {
        state.shieldCharges -= 1;
        spawnFx(cx, cy, 'BLOCK', true);
      } else {
        state.junkHit += 1;
        state.miss += 1;
        state.streak = 0;
        spawnFx(cx, cy, 'MISS', true);
        playTone('bad');
        pulseStage('bad');
      }
      writeHud();
      pushBridgeState();
      removeTarget(target);
      return;
    }

    if (target.kind === 'power') {
      applyPower(target.powerType).catch(() => {});
      spawnFx(cx, cy, target.powerType === 'shield' ? 'TEAM' : target.powerType === 'double' ? 'x2' : 'FREEZE', true);
      playTone('good');
      pulseStage('good');
      writeHud();
      pushBridgeState();
      removeTarget(target);
      return;
    }

    if (target.kind === 'boss') {
      let hitPower = activeDouble() ? 2 : 1;
      if (activeBossWeak()) hitPower += 1;

      spawnFx(cx, cy, 'HIT', true);
      requestBossHit(hitPower).catch(() => {});
      playTone('boss');
      pulseStage('boss');
      writeHud();
      pushBridgeState();
    }
  }

  function updateTargets(dt) {
    const freeze = now() < state.freezeUntil;
    for (const target of [...state.targets.values()]) {
      if (!target || target.dead) continue;

      if (target.kind === 'boss') {
        if (!state.bossAuthority.active && !state.bossAuthority.cleared) continue;
        if (state.bossAuthority.cleared) {
          removeTarget(target);
          continue;
        }
        target.x += (target.dx || 0) * dt;
        if (target.x <= 18 || target.x + target.size >= state.width - 18) {
          target.dx = -(target.dx || 160);
        }
        target.el.style.left = `${clampInt(target.x, 18, state.width - target.size - 18)}px`;
        target.el.style.top = `${target.y}px`;
        continue;
      }

      if (!freeze) {
        target.y += (target.speed || 100) * dt;
      }

      target.el.style.top = `${target.y}px`;

      if (target.y > state.height + 30) {
        if (target.kind === 'good') {
          state.goodMiss += 1;
          state.miss += 1;
          state.streak = 0;
        }
        removeTarget(target);
      }
    }
  }

  function gameFrame(ts) {
    if (!state.running || state.ended) return;

    const dtMs = Math.max(0, Math.min(48, ts - state.lastTs));
    const dt = dtMs / 1000;
    state.lastTs = ts;

    state.timeLeftMs = Math.max(0, state.totalMs - (ts - state.startedAtPerf));

    const elapsedMs = state.totalMs - state.timeLeftMs;

    while (elapsedMs >= plannedSpawnTimeMs(state.spawnCursor)) {
      createFallingTargetFromSpec(buildSpawnSpec(state.spawnCursor));
      state.spawnCursor += 1;
    }

    while (elapsedMs >= plannedPowerTimeMs(state.powerCursor + 1)) {
      state.powerCursor += 1;
      spawnPowerTargetFromSpec(buildPowerSpec(state.powerCursor));
    }

    maybeStartBossPhase().catch(() => {});
    updateTargets(dt);
    maybeClearMission(false);
    writeHud();
    pushBridgeState();

    if (state.timeLeftMs <= 0) {
      finishGame('timeup').catch((err) => {
        console.warn('[GJ-COOP-ENGINE] finishGame failed:', err);
      });
      return;
    }

    state.loopRaf = requestAnimationFrame(gameFrame);
  }

  function resetLocalRoundState() {
    state.running = false;
    state.ended = false;
    state.summaryShown = false;

    if (state.loopRaf) cancelAnimationFrame(state.loopRaf);
    state.loopRaf = 0;

    stopSyncLoop();
    stopRoundCacheLoop();
    clearRoundCache();

    state.restoredFromCache = false;
    state.roundSeed = '';
    state.roundStartAtMs = 0;
    state.spawnCursor = 0;
    state.powerCursor = 0;

    state.totalMs = 0;
    state.timeLeftMs = 0;

    state.score = 0;
    state.contribution = 0;
    state.miss = 0;
    state.bestStreak = 0;
    state.streak = 0;
    state.helps = 0;
    state.stars = 0;

    state.goodHit = 0;
    state.junkHit = 0;
    state.goodMiss = 0;

    state.shieldCharges = 0;
    state.doubleUntil = 0;
    state.freezeUntil = 0;
    state.teamFeverUntil = 0;
    state.bossWeakUntil = 0;
    state.bossWeakTriggered = false;

    state.bossAuthority = {
      active: false,
      hp: 0,
      hpMax: 0,
      cleared: false,
      weakUntil: 0
    };

    state.currentRematchToken = 0;
    state.authoritativeEventSeq = 0;
    state.lastAppliedEventKey = '';

    state.finalizeBusy = false;
    state.cleanupBusy = false;
    state.finalSnapshotWritten = false;
    state.lastCleanupAt = 0;

    state.eventReqBusy = false;
    state.bossReqBusy = false;

    state.mission = chooseMission();
    state.missionBonusGiven = false;
    state.missionFailed = false;

    state.bossStarted = false;
    state.bossCleared = false;
    state.bossId = '';
    state.bossHits = 0;

    state.targets.forEach((t) => removeTarget(t));
    state.targets.clear();

    ui.bossWrap.style.display = 'none';

    try { W.__GJ_HIDE_COOP_SUMMARY__?.(); } catch (_) {}
    hideNote();
    writeHud();
    pushBridgeState();
  }

  function startGameplay() {
    if (state.running || state.ended) return;

    state.running = true;
    state.ended = false;

    state.roundSeed = spawnSeedBase();
    state.roundStartAtMs = Number(state.room?.match?.coop?.runtime?.startAt || state.room?.startAt || ctx.startAt || now()) || now();

    const durationSec = Number(state.room?.match?.coop?.runtime?.durationSec || ctx.time || 120) || 120;
    state.totalMs = durationSec * 1000;

    const restored = restoreRoundCache();

    if (!restored) {
      state.timeLeftMs = state.totalMs;
      state.score = 0;
      state.contribution = 0;
      state.miss = 0;
      state.bestStreak = 0;
      state.streak = 0;
      state.helps = 0;
      state.stars = 0;
      state.goodHit = 0;
      state.junkHit = 0;
      state.goodMiss = 0;

      state.shieldCharges = 0;
      state.doubleUntil = 0;
      state.freezeUntil = 0;
      state.teamFeverUntil = 0;
      state.bossWeakUntil = 0;
      state.bossWeakTriggered = false;

      state.bossAuthority = {
        active: false,
        hp: 0,
        hpMax: 0,
        cleared: false,
        weakUntil: 0
      };

      state.mission = chooseMission();
      state.missionBonusGiven = false;
      state.missionFailed = false;

      state.bossStarted = false;
      state.bossCleared = false;
      state.bossId = '';
      state.bossHits = 0;

      state.spawnCursor = 0;
      state.powerCursor = 0;
    }

    const elapsedSinceStart = Math.max(0, now() - state.roundStartAtMs);
    state.timeLeftMs = Math.max(0, state.totalMs - elapsedSinceStart);

    state.lastTs = performance.now();
    state.startedAtPerf = state.lastTs - elapsedSinceStart;

    state.currentRematchToken = Number(state.room?.match?.coop?.rematchToken || state.currentRematchToken || 0);
    state.authoritativeEventSeq = Number(state.room?.match?.coop?.currentEvent?.seq || 0) || 0;
    state.finalSnapshotWritten = false;
    state.lastAppliedEventKey = '';

    hideNote();
    writeHud();
    pushBridgeState();

    if (!ctx.spectator) {
      startSyncLoop();
      startRoundCacheLoop();
    }

    if (ctx.spectator) {
      showNote('กำลังดูรอบนี้');
      setTimeout(hideNote, 900);
    } else if (state.restoredFromCache) {
      showNote('กลับเข้าสู่รอบเดิมแล้ว');
      setTimeout(hideNote, 900);
    }

    state.loopRaf = requestAnimationFrame(gameFrame);
  }

  async function finishGame(reason = 'finished') {
    if (state.ended) return;

    maybeClearMission(true);

    state.ended = true;
    state.running = false;

    if (state.loopRaf) cancelAnimationFrame(state.loopRaf);
    state.loopRaf = 0;

    stopSyncLoop();
    stopRoundCacheLoop();

    state.targets.forEach((t) => removeTarget(t));
    state.targets.clear();

    if (!ctx.spectator && typeof syncSelf === 'function') {
      await syncSelf({
        finished: true,
        phase: 'done',
        finalScore: Number(state.score || 0),
        score: Number(state.score || 0),
        contribution: Number(state.score || 0),
        miss: Number(state.miss || 0),
        streak: Number(state.bestStreak || 0),
        helps: Number(state.helps || 0)
      });
    }

    clearRoundCache();

    if (isHost(state.room) && participantsFinished(state.room)) {
      await hostFinalizeRound(reason);
    }

    await finalizeSummaryIfNeeded(reason);
  }

  async function hostRequestRematch() {
    if (!state.roomRef || !state.room) return false;
    if (!isHost(state.room)) {
      showNote('เฉพาะ Host เท่านั้นที่เริ่มรอบใหม่ได้');
      setTimeout(hideNote, 900);
      return false;
    }

    const connectedParticipants = participants(state.room).filter((p) => p.connected !== false);
    if (connectedParticipants.length < Math.max(2, state.room.minPlayers || 2)) {
      showNote('ผู้เล่นในห้องยังไม่พอสำหรับเริ่มรอบใหม่');
      setTimeout(hideNote, 900);
      return false;
    }

    const rematchToken = now();
    const startAt = rematchToken + 4000;

    const updates = {
      status: 'countdown',
      startAt,
      updatedAt: now(),
      match: {
        participantIds: connectedParticipants.map((p) => p.id),
        lockedAt: now(),
        status: 'countdown',
        coop: {
          finishedAt: 0,
          rematchToken,
          shared: {
            seq: rematchToken + 1,
            type: 'rematch',
            issuedAt: now(),
            feverUntil: 0,
            freezeUntil: 0,
            bossWeakUntil: 0,
            shieldAll: 0,
            fromPid: ctx.pid
          },
          currentEvent: {
            seq: rematchToken + 2,
            type: 'rematch',
            issuedAt: now(),
            feverUntil: 0,
            freezeUntil: 0,
            bossWeakUntil: 0,
            shieldAll: 0,
            bonusScore: 0,
            text: 'Host เริ่มรอบใหม่แล้ว!',
            fromPid: ctx.pid
          },
          boss: {
            active: false,
            hp: 0,
            hpMax: 0,
            cleared: false,
            weakUntil: 0,
            startedAt: 0
          },
          eventRequests: {},
          hitRequests: {},
          resultSnapshot: null,
          runtime: {
            version: 'R9',
            roundSeed: `${ctx.roomId}:${ctx.seed}:${rematchToken}`,
            durationSec: Number(ctx.time || 120) || 120,
            startAt,
            createdAt: now()
          }
        }
      }
    };

    const playerPatchRoot = {};
    connectedParticipants.forEach((p) => {
      playerPatchRoot[`players/${p.id}/finished`] = false;
      playerPatchRoot[`players/${p.id}/finalScore`] = 0;
      playerPatchRoot[`players/${p.id}/score`] = 0;
      playerPatchRoot[`players/${p.id}/contribution`] = 0;
      playerPatchRoot[`players/${p.id}/miss`] = 0;
      playerPatchRoot[`players/${p.id}/streak`] = 0;
      playerPatchRoot[`players/${p.id}/helps`] = 0;
      playerPatchRoot[`players/${p.id}/phase`] = 'run';
      playerPatchRoot[`players/${p.id}/ready`] = true;
      playerPatchRoot[`players/${p.id}/connected`] = true;
      playerPatchRoot[`players/${p.id}/lastSeenAt`] = now();
    });

    try {
      await state.roomRef.update({
        ...updates,
        ...playerPatchRoot
      });
      return true;
    } catch (err) {
      console.warn('[GJ-COOP-ENGINE] hostRequestRematch failed:', err);
      return false;
    }
  }

  async function hostAbortRound() {
    if (!state.roomRef || !state.room || !isHost(state.room)) return false;

    try {
      await state.roomRef.update({
        status: 'waiting',
        startAt: null,
        updatedAt: now(),
        'match/status': 'idle',
        'match/participantIds': [],
        'match/lockedAt': null,
        'match/coop/currentEvent': {
          seq: now(),
          type: 'abort',
          issuedAt: now(),
          feverUntil: 0,
          freezeUntil: 0,
          bossWeakUntil: 0,
          shieldAll: 0,
          bonusScore: 0,
          text: 'Host ยกเลิกรอบนี้แล้ว',
          fromPid: ctx.pid
        },
        'match/coop/runtime': null
      });
      return true;
    } catch (err) {
      console.warn('[GJ-COOP-ENGINE] hostAbortRound failed:', err);
      return false;
    }
  }

  async function hostReturnLobby() {
    if (!state.roomRef || !state.room || !isHost(state.room)) return false;

    try {
      await state.roomRef.update({
        status: 'waiting',
        startAt: null,
        updatedAt: now(),
        'match/status': 'idle',
        'match/participantIds': [],
        'match/lockedAt': null,
        'match/coop/currentEvent': {
          seq: now(),
          type: 'return-lobby',
          issuedAt: now(),
          feverUntil: 0,
          freezeUntil: 0,
          bossWeakUntil: 0,
          shieldAll: 0,
          bonusScore: 0,
          text: 'Host พาทุกคนกลับ Lobby แล้ว',
          fromPid: ctx.pid
        },
        'match/coop/runtime': null
      });
      return true;
    } catch (err) {
      console.warn('[GJ-COOP-ENGINE] hostReturnLobby failed:', err);
      return false;
    }
  }

  function buildLobbyUrl() {
    const q = new URLSearchParams({
      pid: ctx.pid,
      name: ctx.name || '',
      studyId: ctx.studyId || '',
      diff: ctx.diff || 'normal',
      time: String(ctx.time || 120),
      seed: ctx.seed || String(Date.now()),
      hub: ctx.hub || '../hub.html',
      view: ctx.view || 'mobile',
      run: ctx.run || 'play',
      gameId: ctx.gameId || 'goodjunk',
      mode: 'coop',
      roomId: ctx.roomId || ''
    });

    return `./goodjunk-coop-lobby.html?${q.toString()}`;
  }

  function goToLobbySoon(message = '', delay = 700) {
    if (message) {
      try { showNote(message); } catch (_) {}
    }
    setTimeout(() => {
      location.href = buildLobbyUrl();
    }, delay);
  }

  function bindRoom() {
    if (!state.roomRef) return;
    if (state.roomListenerBound) return;
    state.roomListenerBound = true;

    state.roomRef.on('value', async (snap) => {
      const raw = snap.val();

      if (!raw) {
        if (!state.summaryShown) {
          goToLobbySoon('ห้องนี้ถูกปิดแล้ว');
        }
        return;
      }

      const prevRematchToken = state.currentRematchToken || 0;
      state.room = roomFromRaw(raw);

      const newRematchToken = Number(state.room?.match?.coop?.rematchToken || 0) || 0;

      applyAuthoritativeEventFromRoom(state.room);
      syncBossAuthorityFromRoom(state.room);
      pushBridgeState();

      const currentType = String(state.room?.match?.coop?.currentEvent?.type || '').trim();

      if (currentType === 'return-lobby' || currentType === 'abort') {
        clearRoundCache();
        stopRoundCacheLoop();
        stopSyncLoop();

        goToLobbySoon(
          currentType === 'abort'
            ? 'Host ยกเลิกรอบนี้แล้ว'
            : 'Host พาทุกคนกลับ Lobby แล้ว'
        );
        return;
      }

      if (
        state.ended &&
        newRematchToken &&
        newRematchToken !== prevRematchToken &&
        state.room.status === 'countdown'
      ) {
        state.currentRematchToken = newRematchToken;
        resetLocalRoundState();

        if (amParticipant(state.room)) {
          try {
            if (!ctx.spectator) {
              await joinRunPresence();
            }
            await waitStartGate();
            if (!state.ended && amParticipant(state.room)) {
              startGameplay();
            }
          } catch (err) {
            console.warn('[GJ-COOP-ENGINE] rematch restart failed:', err);
          }
        }
        return;
      }

      if (state.ended) {
        if (
          state.room?.match?.coop?.resultSnapshot ||
          state.room.status === 'finished' ||
          participantsFinished(state.room)
        ) {
          await finalizeSummaryIfNeeded('room-finished');
        }
        return;
      }

      if (state.running && isHost(state.room) && participantsFinished(state.room)) {
        await hostFinalizeRound('all-finished');
      }

      await hostProcessEventRequests(state.room);
      await hostProcessBossHitRequests(state.room);
      await hostCleanupQueues(state.room);
    });
  }

  async function boot() {
    try {
      buildStage();
      state.mission = chooseMission();
      writeHud();
      pushBridgeState();

      await ensureFirebase();

      state.roomRef = state.db.ref(ROOM_PATH);
      state.myRef = state.roomRef.child('players').child(normalizePid(ctx.pid));

      const firstSnap = await state.roomRef.once('value');
      const raw = firstSnap.val();

      if (!raw) {
        showNote('ไม่พบห้องนี้');
        setTimeout(() => { location.href = buildLobbyUrl(); }, 900);
        return;
      }

      state.room = roomFromRaw(raw);
      bindRoom();

      if (!amParticipant(state.room) && !ctx.spectator) {
        showNote('รอบนี้คุณไม่ได้อยู่ใน participant ของรอบนี้');
        pushBridgeState();
        return;
      }

      if (!ctx.spectator) {
        await joinRunPresence();
      }

      pushBridgeState();
      await waitStartGate();

      if (!state.room) {
        showNote('ไม่พบข้อมูลรอบนี้');
        return;
      }

      if (!amParticipant(state.room) && !ctx.spectator) {
        showNote('participant ไม่ถูกต้อง');
        return;
      }

      startGameplay();

      W.__GJ_COOP_REMATCH__ = hostRequestRematch;
      W.__GJ_COOP_HOST_ABORT__ = hostAbortRound;
      W.__GJ_COOP_RETURN_LOBBY__ = hostReturnLobby;

      W.addEventListener('beforeunload', () => {
        stopSyncLoop();
        stopRoundCacheLoop();
        if (ctx.spectator) return;
        try {
          state.myRef?.update({
            connected: false,
            phase: state.ended ? 'done' : 'lobby'
          });
        } catch (_) {}
      });
    } catch (err) {
      console.error('[GJ-COOP-ENGINE] boot failed:', err);
      showNote(`เข้าเกมไม่สำเร็จ: ${String(err?.message || err)}`);
    }
  }

  boot();
})();