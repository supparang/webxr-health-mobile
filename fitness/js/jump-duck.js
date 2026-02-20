// === /fitness/js/jump-duck.js ===
// Jump-Duck — VR Fitness Academy (HHA Standard)
// FULL v20260220-bossALL-aiPRED
// ✅ Boss for Training/Test/Research
// ✅ Boss phases 1-3 + HP + Break moment
// ✅ Mixed boss: tempo shift + double + hold-duck + feint (decoy)
// ✅ Risk-Reward: Overdrive + Shield + Cashout
// ✅ AI prediction baseline (research-locked)
// ✅ CSV sessions/events + optional remote POST via ?log=
// ✅ Input: keyboard, touch (top/bottom), action buttons, VR shoot (hha:shoot)

'use strict';

(function () {
  const WIN = window;
  const DOC = document;

  // ---------------- utils ----------------
  const $ = (sel) => DOC.querySelector(sel);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const clamp01 = (v) => clamp(v, 0, 1);
  const now = () => performance.now();

  function qs(name, def = '') {
    try {
      const sp = new URL(location.href).searchParams;
      const v = sp.get(name);
      return v == null ? def : v;
    } catch (_) { return def; }
  }
  function toLowerSafe(x, def = '') {
    return String(x == null ? def : x).trim().toLowerCase();
  }
  function isFiniteNum(x) { return Number.isFinite(Number(x)); }
  function fmt1(x) { return (Number.isFinite(x) ? x.toFixed(1) : '0.0'); }
  function isoNow() { return new Date().toISOString(); }

  // deterministic RNG (for research repeatability)
  function makeRng(seedStr) {
    let seed = 0;
    const s = String(seedStr || '0');
    for (let i = 0; i < s.length; i++) seed = (seed * 31 + s.charCodeAt(i)) >>> 0;
    return function rnd() {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  }

  // CSV helpers
  function csvEscape(v) {
    v = (v == null) ? '' : String(v);
    if (/[",\n\r]/.test(v)) v = '"' + v.replace(/"/g, '""') + '"';
    return v;
  }
  function toCsvRow(obj, cols) {
    return cols.map(k => csvEscape(obj && obj[k] != null ? obj[k] : '')).join(',');
  }
  class CsvTable {
    constructor(columns) { this.columns = columns.slice(0); this.rows = []; }
    add(row) { this.rows.push(Object.assign({}, row)); }
    toCsv() {
      const head = this.columns.join(',');
      const body = this.rows.map(r => toCsvRow(r, this.columns)).join('\n');
      return head + (body ? '\n' + body : '');
    }
    clear() { this.rows.length = 0; }
  }

  async function postJson(url, payload) {
    if (!url) return { ok: false, error: 'no_url' };
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const txt = await res.text();
      let j = null;
      try { j = JSON.parse(txt); } catch (_) { j = { raw: txt }; }
      return { ok: res.ok, status: res.status, data: j };
    } catch (err) {
      return { ok: false, error: String(err && (err.message || err) || err) };
    }
  }

  // ---------------- DOM ----------------
  const fatalEl = $('#jd-fatal');

  const viewMenu = $('#view-menu');
  const viewPlay = $('#view-play');
  const viewResult = $('#view-result');

  const selMode = $('#jd-mode');
  const selDiff = $('#jd-diff');
  const selDur = $('#jd-duration');

  const researchBlock = $('#jd-research-block');
  const inpPid = $('#jd-participant-id');
  const inpGroup = $('#jd-group');
  const inpNote = $('#jd-note');

  const playArea = $('#jd-play-area');
  const obstaclesEl = $('#jd-obstacles');
  const avatarEl = $('#jd-avatar');
  const judgeEl = $('#jd-judge');

  const teleEl = $('#jd-tele');

  const hud = {
    phase: $('#hud-phase'),
    boss: $('#hud-boss'),
    mode: $('#hud-mode'),
    diff: $('#hud-diff'),
    duration: $('#hud-duration'),
    stability: $('#hud-stability'),
    time: $('#hud-time'),
    obstacles: $('#hud-obstacles'),
    score: $('#hud-score'),
    combo: $('#hud-combo'),

    progFill: $('#hud-prog-fill'),
    progText: $('#hud-prog-text'),

    feverFill: $('#hud-fever-fill'),
    feverStatus: $('#hud-fever-status'),

    bossWrap: $('#boss-bar-wrap'),
    bossFill: $('#hud-boss-fill'),
    bossStatus: $('#hud-boss-status'),
  };

  const res = {
    mode: $('#res-mode'),
    diff: $('#res-diff'),
    duration: $('#res-duration'),
    totalObs: $('#res-total-obs'),
    hits: $('#res-hits'),
    miss: $('#res-miss'),
    jHit: $('#res-jump-hit'),
    dHit: $('#res-duck-hit'),
    jMiss: $('#res-jump-miss'),
    dMiss: $('#res-duck-miss'),
    acc: $('#res-acc'),
    rtMean: $('#res-rt-mean'),
    stabMin: $('#res-stability-min'),
    score: $('#res-score'),
    rank: $('#res-rank'),
  };

  const sfx = {
    hit: $('#jd-sfx-hit'),
    miss: $('#jd-sfx-miss'),
    combo: $('#jd-sfx-combo'),
    beep: $('#jd-sfx-beep'),
    boss: $('#jd-sfx-boss'),
    fever: $('#jd-sfx-fever'),
  };
  function playSfx(a, vol = 0.9) {
    try {
      if (!a) return;
      a.currentTime = 0;
      a.volume = clamp(vol, 0, 1);
      const p = a.play();
      if (p && p.catch) p.catch(() => {});
    } catch (_) {}
  }

  function showFatal(err) {
    try {
      const msg = String(err && (err.stack || err.message) || err);
      fatalEl.textContent = 'JUMP-DUCK FATAL:\n' + msg;
      fatalEl.classList.remove('jd-hidden');
    } catch (_) {}
  }

  function switchView(name) {
    viewMenu.classList.add('jd-hidden');
    viewPlay.classList.add('jd-hidden');
    viewResult.classList.add('jd-hidden');
    if (name === 'menu') viewMenu.classList.remove('jd-hidden');
    else if (name === 'play') viewPlay.classList.remove('jd-hidden');
    else viewResult.classList.remove('jd-hidden');
  }

  // ---------------- device / input modes ----------------
  const VIEW = (() => {
    // allow override with ?view=pc|mobile|cvr|vr
    const q = toLowerSafe(qs('view', ''));
    if (q === 'pc' || q === 'mobile' || q === 'cvr' || q === 'vr') return q;
    const touch = ('ontouchstart' in WIN) || (navigator.maxTouchPoints > 0);
    return touch ? 'mobile' : 'pc';
  })();
  DOC.documentElement.classList.add('view-' + VIEW);

  function bindInput() {
    // keyboard
    DOC.addEventListener('keydown', (ev) => {
      if (!STATE.running) return;
      const k = (ev.key || '').toLowerCase();
      if (k === 'arrowup' || k === 'w') action('jump', 'key');
      if (k === 'arrowdown' || k === 's') action('duck', 'key');
      if (k === ' ') { // space -> jump
        ev.preventDefault();
        action('jump', 'key');
      }
    });

    // touch play area: top = jump, bottom = duck (but not block UI)
    if (playArea) {
      playArea.addEventListener('pointerdown', (ev) => {
        if (!STATE.running) return;
        const rect = playArea.getBoundingClientRect();
        const y = ev.clientY - rect.top;
        const half = rect.height * 0.5;
        if (y < half) action('jump', 'touch');
        else action('duck', 'touch');
      }, { passive: true });
    }

    // quick buttons
    DOC.addEventListener('click', (ev) => {
      const btn = ev.target && ev.target.closest ? ev.target.closest('[data-action]') : null;
      if (!btn) return;
      const a = btn.getAttribute('data-action');
      if (!a) return;

      if (a === 'start') startFromMenu();
      else if (a === 'tutorial') startTutorial();
      else if (a === 'stop-early') stopGame('manual-stop');
      else if (a === 'play-again') replay();
      else if (a === 'back-menu') backToMenu();
      else if (a === 'jump') action('jump', 'btn');
      else if (a === 'duck') action('duck', 'btn');
    });

    // VR shoot (center tap): treat as "confirm action" based on gaze/pose
    // Here: alternate (or decide from last telegraph): we map shoot -> "smart" action (AI assist light)
    WIN.addEventListener('hha:shoot', (ev) => {
      if (!STATE.running) return;
      // heuristic: if next obstacle is high -> duck else jump
      const nxt = peekNextObstacle();
      if (!nxt) return action('jump', 'vr');
      action(nxt.kind === 'high' || nxt.kind === 'high-long' ? 'duck' : 'jump', 'vr');
    });
  }

  // ---------------- game config ----------------
  const CFG = {
    // spawn timing
    leadSec: 2.2,             // time obstacle travels before hit line
    baseInterval: { easy: 0.92, normal: 0.76, hard: 0.62 }, // seconds between spawns (phase 1 baseline)
    speedMul: { easy: 0.95, normal: 1.00, hard: 1.08 },    // travel speed multiplier

    // judgment windows (sec)
    winPerfect: 0.080,
    winGreat: 0.130,
    winGood: 0.185,

    // score
    scorePerfect: 160,
    scoreGreat: 110,
    scoreGood: 70,
    scoreMissPenalty: 0,

    // fever
    feverAdd: { perfect: 0.10, great: 0.07, good: 0.045 },
    feverDecayPerMiss: 0.10,
    feverDropOnOverdriveMiss: 0.22,

    // boss
    boss: {
      enabled: true,
      phases: 3,
      hpDrainOnHit: { p1: 0.015, p2: 0.020, p3: 0.028 },     // per judged hit
      hpPenaltyOnMiss: { p1: 0.000, p2: 0.008, p3: 0.012 },  // miss reduces boss hp slower? -> we penalize player score instead; here we make boss tougher by regen tiny
      armorStart: 0.35,           // break armor once
      breakFreezeMs: 220,
    },

    // risk-reward
    cashoutEvery: 10,
    cashoutBonusPerStep: 120,
    overdrive: {
      minFever: 0.80,
      durationSec: 7.5,
      scoreMul: 1.5,
      tightenWinMul: 0.86, // narrower windows
    },
    shield: {
      enabled: true,
      dropPhase: 3,
      dropAtTimeFrac: 0.55, // around mid phase3
    },

    // obstacle types probabilities (base)
    probs: {
      low: 0.52,
      high: 0.48,
    }
  };

  // ---------------- state ----------------
  const STATE = {
    running: false,
    ended: false,

    mode: 'training', // training|test|research
    diff: 'normal',
    durationPlannedSec: 60,
    tutorial: false,

    seed: '',
    rnd: null,

    // timing
    t0: 0,
    lastTs: 0,
    elapsed: 0,
    timeLeft: 0,

    // gameplay
    score: 0,
    combo: 0,
    comboMax: 0,

    totalObs: 0,
    hit: 0,
    miss: 0,
    jumpHit: 0,
    duckHit: 0,
    jumpMiss: 0,
    duckMiss: 0,

    rtSum: 0,
    rtN: 0,

    stability: 100,
    stabilityMin: 100,

    // fever
    fever: 0,
    feverActive: false,
    feverTime: 0,

    // risk
    overdriveOn: false,
    overdriveLeft: 0,
    shieldOn: false,
    shieldUsed: false,
    cashoutReady: false,

    // boss
    boss: {
      active: false,
      phase: 1,
      hp: 1,
      armor: 0,
      breakUsed: false,
      name: 'MIXED',
      shieldDropDone: false,
    },

    // obstacle stream
    obstacles: [], // { id, tHit, kind, decoy, holdSec, revealed, el, spawnedAt, judged:false, actionNeeded:'jump'|'duck' }
    nextId: 1,

    // AI prediction
    ai: {
      locked: false,           // in test/research locked
      assistOn: false,         // only in training via ?ai=1 (still prediction-only here)
      fatigueRisk: 0,
      driftScore: 0,
      predictMissBurst: 0,
      tip: '',
      nextTick: 0,
      // rolling
      miss5s: [],
      hit5s: [],
      rt5s: [],
      off5s: [],
      comboBreaks10s: [],
      lastCombo: 0,
    },

    // research meta
    meta: { pid: '', group: '', note: '' },

    // logging
    sessionId: '',
    startIso: '',
    endIso: '',
    logUrl: '',

    events: new CsvTable([
      'timestampIso','runMode','gameMode','diff','sessionId','eventType','timeFromStartMs',
      'obstacleId','itemType','lane','rtMs','judgment','totalScore','combo',
      'feverState','feverValue','bossPhase','bossHp','overdriveOn','shieldOn',
      'ai_locked','ai_predictMissBurst','ai_driftScore','ai_fatigueRisk','extra'
    ]),
    sessions: new CsvTable([
      'timestampIso','runMode','gameMode','diff','durationPlannedSec','durationPlayedSec',
      'sessionId','scoreFinal','comboMax','misses','obstaclesTotal',
      'jumpHit','duckHit','jumpMiss','duckMiss',
      'accuracyPct','avgRtMs','stabilityMinPct',
      'bossPhaseEnd','bossHpEnd','feverTimePct',
      'ai_locked','ai_predictMissBurst','ai_driftScore','ai_fatigueRisk',
      'reason','startTimeIso','endTimeIso','participantId','group','note','__extraJson'
    ]),
  };

  function makeSessionId() {
    const t = Date.now().toString(36);
    const r = Math.random().toString(36).slice(2, 7);
    return `JD-${t}-${r}`;
  }

  function applyMenuVisibility() {
    const m = toLowerSafe(selMode.value, 'training');
    researchBlock.classList.toggle('jd-hidden', m !== 'research');
  }

  // ---------------- boss/phase logic ----------------
  function phaseForTimeFrac(f) {
    if (f < 0.34) return 1;
    if (f < 0.72) return 2;
    return 3;
  }

  function setTele(on, text) {
    if (!teleEl) return;
    teleEl.classList.toggle('jd-hidden', !on);
    teleEl.classList.toggle('on', !!on);
    const inner = teleEl.querySelector('.jd-tele-inner');
    if (inner && text) inner.textContent = text;
  }

  function bossHpDrainOnHit() {
    const p = STATE.boss.phase;
    if (p === 1) return CFG.boss.hpDrainOnHit.p1;
    if (p === 2) return CFG.boss.hpDrainOnHit.p2;
    return CFG.boss.hpDrainOnHit.p3;
  }

  function maybeStartBoss() {
    // Boss always enabled for ALL modes (Training/Test/Research) ✅
    if (!CFG.boss.enabled) return;
    STATE.boss.active = true;
    STATE.boss.hp = 1;
    STATE.boss.armor = CFG.boss.armorStart;
    STATE.boss.breakUsed = false;
    STATE.boss.name = 'MIXED';
    STATE.boss.phase = 1;
    STATE.boss.shieldDropDone = false;
    hud.bossWrap && hud.bossWrap.classList.remove('jd-hidden');
    hud.bossStatus && (hud.bossStatus.textContent = 'READY');
    hud.boss && (hud.boss.textContent = STATE.boss.name);
  }

  function updateBossByTime() {
    if (!STATE.boss.active) return;
    const frac = (STATE.elapsed / STATE.durationPlannedSec);
    const pPrev = STATE.boss.phase;
    const pNow = phaseForTimeFrac(frac);
    if (pNow !== pPrev) {
      STATE.boss.phase = pNow;
      hud.phase && (hud.phase.textContent = String(pNow));
      playSfx(sfx.boss, 0.8);

      // telegraph tempo shift entering phase2
      if (pNow === 2) {
        setTele(true, '⚡ TEMPO SHIFT');
        setTimeout(() => setTele(false), 550);
      }
      if (pNow === 3) {
        setTele(true, '🔥 BOSS BURST');
        setTimeout(() => setTele(false), 550);
      }
    }
    // shield drop (phase 3 mid)
    if (CFG.shield.enabled && STATE.boss.phase === CFG.shield.dropPhase && !STATE.boss.shieldDropDone) {
      const phaseFrac = (frac - 0.72) / (1 - 0.72);
      if (phaseFrac >= CFG.shield.dropAtTimeFrac) {
        // drop a "shield pickup" as a special obstacle (auto pickup on correct action)
        spawnSpecial('shield');
        STATE.boss.shieldDropDone = true;
      }
    }
  }

  function applyBossDamageFromHit(mult = 1) {
    if (!STATE.boss.active) return;
    let d = bossHpDrainOnHit() * mult;

    // armor first
    if (STATE.boss.armor > 0) {
      const a0 = STATE.boss.armor;
      STATE.boss.armor = Math.max(0, STATE.boss.armor - d * 1.6);
      d = d * 0.35; // while armor on, real hp drains slower
      if (a0 > 0 && STATE.boss.armor === 0 && !STATE.boss.breakUsed) {
        STATE.boss.breakUsed = true;
        // BREAK moment: freeze a bit
        setTele(true, '💥 BREAK!');
        setTimeout(() => setTele(false), 420);
        // micro-freeze: pause movement briefly by shifting t0
        const freeze = CFG.boss.breakFreezeMs;
        STATE.t0 += freeze;
      }
    }

    STATE.boss.hp = Math.max(0, STATE.boss.hp - d);
  }

  // ---------------- obstacle generation ----------------
  function baseInterval() {
    const d = STATE.diff;
    let iv = CFG.baseInterval[d] || CFG.baseInterval.normal;

    // phase adjustments
    const p = STATE.boss.phase;
    if (p === 2) iv *= 0.88;
    if (p === 3) iv *= 0.82;

    // tutorial slower
    if (STATE.tutorial) iv *= 1.15;

    return clamp(iv, 0.40, 1.20);
  }

  function pickObstacleKind() {
    const rnd = STATE.rnd;

    // Phase 2/3 introduce specials
    const p = STATE.boss.phase;

    // chance gates
    const allowFeint = (p >= 2);
    const allowDouble = (p >= 2);
    const allowHold = (p >= 2);

    // decide base high/low
    const r = rnd();
    let kind = (r < CFG.probs.low) ? 'low' : 'high';

    // specials
    if (allowHold && rnd() < (STATE.diff === 'hard' ? 0.18 : 0.12)) {
      // hold duck: high-long
      kind = 'high-long';
    }

    // feint (decoy): make it readable with reveal near hit line
    let decoy = false;
    if (allowFeint && rnd() < (STATE.diff === 'hard' ? 0.14 : 0.10)) {
      decoy = true;
    }

    // double: handled at schedule time (spawn two close)
    const wantDouble = allowDouble && (rnd() < (STATE.diff === 'hard' ? 0.22 : 0.14));

    return { kind, decoy, wantDouble };
  }

  function spawnObstacleAt(tHit, kind, opt = {}) {
    const id = STATE.nextId++;
    const o = {
      id,
      tHit,
      kind,           // 'low'|'high'|'high-long'|'shield'
      decoy: !!opt.decoy,
      holdSec: opt.holdSec || (kind === 'high-long' ? (STATE.diff === 'hard' ? 0.85 : 0.70) : 0),
      revealed: false,
      judged: false,
      spawnedAt: now(),
      actionNeeded: (kind === 'high' || kind === 'high-long') ? 'duck' : 'jump',
      el: null,
      special: opt.special || '',
    };
    STATE.obstacles.push(o);
    STATE.totalObs++;
    return o;
  }

  function spawnSpecial(type) {
    // schedule shield pickup to arrive soon
    const tHit = STATE.elapsed + CFG.leadSec + 0.85;
    spawnObstacleAt(tHit, 'shield', { special: 'shield', decoy: false, holdSec: 0 });
  }

  function renderSpawn(o) {
    const el = DOC.createElement('div');
    el.className = 'jd-obstacle';

    // position by kind
    const isLow = (o.kind === 'low');
    const isHigh = (o.kind === 'high' || o.kind === 'high-long');
    const isShield = (o.kind === 'shield');

    if (isLow) el.classList.add('jd-obstacle--low');
    else el.classList.add('jd-obstacle--high');

    const inner = DOC.createElement('div');
    inner.className = 'jd-obstacle-inner';

    const icon = DOC.createElement('div');
    icon.className = 'jd-obs-icon';

    const tag = DOC.createElement('div');
    tag.className = 'jd-obs-tag';

    if (isShield) {
      icon.textContent = '🛡️';
      tag.textContent = 'SHIELD';
      el.classList.add('jd-reveal'); // always clear
    } else if (isLow) {
      icon.textContent = '🧱';
      tag.textContent = 'LOW';
    } else if (isHigh) {
      icon.textContent = (o.kind === 'high-long') ? '🌀' : '🚧';
      tag.textContent = (o.kind === 'high-long') ? 'HOLD' : 'HIGH';
    }

    inner.appendChild(icon);
    inner.appendChild(tag);
    el.appendChild(inner);

    // feint visuals
    if (o.decoy) el.classList.add('jd-feint');

    obstaclesEl.appendChild(el);
    o.el = el;
  }

  function updateObstaclePositions() {
    // travel from right to hit line at left 24% (CSS hit line)
    const lead = CFG.leadSec / (CFG.speedMul[STATE.diff] || 1.0);
    const rect = playArea.getBoundingClientRect();
    const w = rect.width || 800;

    // anchor x so that at tHit it's around hit line (24% of width)
    const xHit = w * 0.24;
    const xStart = w + 120; // offscreen right
    const xTravel = xStart - xHit;

    for (const o of STATE.obstacles) {
      if (o.judged) continue;
      const dt = o.tHit - STATE.elapsed; // time until hit
      const p = 1 - clamp01(dt / lead);  // 0..1
      const x = xStart - xTravel * p;

      // reveal feint near end (readable, fair)
      if (o.decoy && !o.revealed && dt < 0.40) {
        o.revealed = true;
        if (o.el) o.el.classList.add('jd-reveal');
      }

      // spawn DOM when within lead window
      if (!o.el && dt < lead + 0.02) {
        renderSpawn(o);
      }

      if (o.el) {
        o.el.style.left = x.toFixed(1) + 'px';
      }

      // timeout past hit line
      if (dt < -CFG.winGood - 0.10) {
        // missed by timeout if not judged
        applyMiss(o, 'timeout');
      }
    }

    // cleanup judged elements
    STATE.obstacles = STATE.obstacles.filter(o => {
      if (o.judged && o.el) { o.el.remove(); o.el = null; }
      return !o.judged;
    });
  }

  function peekNextObstacle() {
    // next arriving obstacle (soonest tHit >= now)
    let best = null;
    let bestDt = 999;
    for (const o of STATE.obstacles) {
      if (o.judged) continue;
      const dt = o.tHit - STATE.elapsed;
      if (dt >= -0.2 && dt < bestDt) { bestDt = dt; best = o; }
    }
    return best;
  }

  function scheduleSpawns(dtSec) {
    // spawn based on elapsed time increments
    // We'll keep a "nextSpawnAt" in STATE.ai.nextTick? Use separate:
    if (!STATE._nextSpawnAt) STATE._nextSpawnAt = 0;

    while (STATE.elapsed >= STATE._nextSpawnAt) {
      const iv = baseInterval();
      const baseT = STATE.elapsed + CFG.leadSec + 0.25; // time it should hit later

      const pick = pickObstacleKind();
      const kind = pick.kind;

      if (pick.wantDouble) {
        // double pattern (fast swap)
        const kind2 = (kind === 'low') ? 'high' : 'low';
        spawnObstacleAt(baseT, kind, { decoy: pick.decoy });
        spawnObstacleAt(baseT + clamp(iv * 0.42, 0.28, 0.45), kind2, { decoy: false });
      } else {
        spawnObstacleAt(baseT, kind, { decoy: pick.decoy });
      }

      STATE._nextSpawnAt += iv;
      if (STATE._nextSpawnAt < STATE.elapsed + 0.05) STATE._nextSpawnAt = STATE.elapsed + iv;
    }
  }

  // ---------------- judge/action ----------------
  function tightenedWindows() {
    if (!STATE.overdriveOn) return { p: CFG.winPerfect, g: CFG.winGreat, b: CFG.winGood };
    const m = CFG.overdrive.tightenWinMul;
    return { p: CFG.winPerfect * m, g: CFG.winGreat * m, b: CFG.winGood * m };
  }

  function showJudge(text, cls) {
    if (!judgeEl) return;
    judgeEl.textContent = text;
    judgeEl.classList.remove('ok', 'combo', 'miss', 'show');
    if (cls) judgeEl.classList.add(cls);
    judgeEl.classList.add('show');
    setTimeout(() => judgeEl.classList.remove('show'), 180);
  }

  function setAvatarPose(pose) {
    if (!avatarEl) return;
    avatarEl.classList.remove('jump', 'duck');
    if (pose === 'jump') avatarEl.classList.add('jump');
    if (pose === 'duck') avatarEl.classList.add('duck');
    setTimeout(() => avatarEl.classList.remove('jump', 'duck'), 140);
  }

  function applyHit(o, judgment, rtMs, src) {
    STATE.hit++;
    STATE.combo++;
    STATE.comboMax = Math.max(STATE.comboMax, STATE.combo);

    // per action
    if (o.actionNeeded === 'jump') STATE.jumpHit++;
    else STATE.duckHit++;

    // score
    let base = CFG.scoreGood;
    if (judgment === 'perfect') base = CFG.scorePerfect;
    else if (judgment === 'great') base = CFG.scoreGreat;

    // overdrive multiplier
    const mul = STATE.overdriveOn ? CFG.overdrive.scoreMul : 1.0;
    const delta = Math.round(base * mul);
    STATE.score += delta;

    // fever
    STATE.fever = clamp01(STATE.fever + (CFG.feverAdd[judgment] || 0.03));
    if (!STATE.feverActive && STATE.fever >= 1) {
      STATE.feverActive = true;
      playSfx(sfx.fever, 0.85);
    }

    // boss damage
    const bossMult = (STATE.boss.phase === 3 && STATE.overdriveOn) ? 1.35 : 1.0;
    applyBossDamageFromHit(bossMult);

    // RT
    if (rtMs != null && Number.isFinite(rtMs)) {
      STATE.rtSum += rtMs;
      STATE.rtN++;
    }

    // stability proxy (simple): penalize rapid misses; hits recover slowly
    STATE.stability = clamp(STATE.stability + 0.45, 55, 100);
    STATE.stabilityMin = Math.min(STATE.stabilityMin, STATE.stability);

    // cashout readiness
    STATE.cashoutReady = (STATE.combo > 0 && (STATE.combo % CFG.cashoutEvery === 0));

    // shield pickup
    if (o.kind === 'shield') {
      STATE.shieldOn = true;
      STATE.shieldUsed = false;
      setTele(true, '🛡️ SHIELD READY');
      setTimeout(() => setTele(false), 480);
    }

    // sfx/feedback
    playSfx(sfx.hit, judgment === 'perfect' ? 0.9 : 0.75);
    if (STATE.combo > 0 && STATE.combo % 10 === 0) playSfx(sfx.combo, 0.75);

    showJudge(judgment.toUpperCase(), (judgment === 'perfect' || judgment === 'great') ? 'ok' : 'combo');

    // log event
    logEvent('hit', o, judgment, rtMs, src, { scoreDelta: delta });
  }

  function applyMiss(o, kind) {
    if (o.judged) return;
    o.judged = true;

    // shield block
    if (STATE.shieldOn && !STATE.shieldUsed) {
      STATE.shieldUsed = true;
      STATE.shieldOn = false;
      setTele(true, '🛡️ BLOCK!');
      setTimeout(() => setTele(false), 350);
      showJudge('BLOCK', 'ok');
      logEvent('miss_blocked', o, 'block', '', 'shield', {});
      return;
    }

    STATE.miss++;
    STATE.combo = 0;

    if (o.actionNeeded === 'jump') STATE.jumpMiss++;
    else STATE.duckMiss++;

    // fever decay
    if (STATE.overdriveOn) STATE.fever = clamp01(STATE.fever - CFG.feverDropOnOverdriveMiss);
    else STATE.fever = clamp01(STATE.fever - CFG.feverDecayPerMiss);
    if (STATE.feverActive && STATE.fever < 0.60) STATE.feverActive = false;

    // stability drop
    STATE.stability = clamp(STATE.stability - (kind === 'timeout' ? 9.0 : 7.0), 0, 100);
    STATE.stabilityMin = Math.min(STATE.stabilityMin, STATE.stability);

    // shake
    if (playArea) {
      playArea.classList.add('shake');
      setTimeout(() => playArea.classList.remove('shake'), 200);
    }

    playSfx(sfx.miss, 0.9);
    showJudge('MISS', 'miss');

    logEvent(kind === 'timeout' ? 'timeout' : 'miss', o, 'miss', '', 'sys', {});
  }

  function applyBlankMiss(actionType) {
    // user acted but no obstacle in window -> small penalty
    STATE.miss++;
    STATE.combo = 0;

    if (actionType === 'jump') STATE.jumpMiss++;
    else STATE.duckMiss++;

    STATE.fever = clamp01(STATE.fever - 0.06);
    if (STATE.feverActive && STATE.fever < 0.60) STATE.feverActive = false;

    STATE.stability = clamp(STATE.stability - 4.5, 0, 100);
    STATE.stabilityMin = Math.min(STATE.stabilityMin, STATE.stability);

    playSfx(sfx.miss, 0.6);
    showJudge('MISS', 'miss');

    logEvent('blank', null, 'miss', '', 'blank', { action: actionType });
  }

  function findBestObstacleForAction(actionType) {
    const w = tightenedWindows();
    let best = null;
    let bestAbs = 999;

    for (const o of STATE.obstacles) {
      if (o.judged) continue;
      if (o.actionNeeded !== actionType) continue;

      const dt = STATE.elapsed - o.tHit;  // negative early, positive late
      const a = Math.abs(dt);

      if (a < bestAbs) {
        bestAbs = a;
        best = { o, dt };
      }
    }

    if (!best) return null;
    if (bestAbs > w.b) return null;

    // decoy: if decoy and revealed => treat as "do nothing" obstacle (blank miss if acted)
    if (best.o.decoy) {
      // if revealed, it's a feint → player should NOT act; treat as blank miss
      if (best.o.revealed) return { decoyTrap: true, o: best.o, dt: best.dt };
      // if not revealed, allow it to behave normally (keeps fairness)
    }

    // hold-duck: must keep duck held; handled in action()
    return best;
  }

  // hold state for duck
  let HOLD = { on: false, until: 0, targetId: 0 };

  function action(actionType, src) {
    if (!STATE.running) return;

    setAvatarPose(actionType);

    // cashout tap (only in CVR/VR?) -> we keep auto-cashout option: long-press not needed
    // (we do auto cashout when ready and user hits perfect streak in overdrive; simple)

    const best = findBestObstacleForAction(actionType);
    if (!best) {
      return applyBlankMiss(actionType);
    }

    if (best.decoyTrap) {
      // feint revealed: acting is punished lightly
      best.o.judged = true;
      if (best.o.el) best.o.el.remove();
      applyBlankMiss(actionType);
      logEvent('feint_trap', best.o, 'miss', '', src, {});
      return;
    }

    const o = best.o;
    const dt = best.dt;
    const w = tightenedWindows();

    // judgment by timing
    let judgment = 'good';
    if (Math.abs(dt) <= w.p) judgment = 'perfect';
    else if (Math.abs(dt) <= w.g) judgment = 'great';

    const rtMs = Math.round(Math.abs(dt) * 1000);

    // hold-duck logic
    if (o.kind === 'high-long') {
      if (actionType !== 'duck') {
        applyMiss(o, 'wrong');
        o.judged = true;
        return;
      }
      // start hold; only count hit if held enough
      HOLD.on = true;
      HOLD.targetId = o.id;
      HOLD.until = now() + (o.holdSec * 1000);
      showJudge('HOLD', 'combo');
      logEvent('hold_start', o, 'hold', rtMs, src, { holdSec: o.holdSec });

      // mark as "pending"; don't judge yet
      o._holdPending = true;
      // remove visual only after hold completes
      return;
    }

    // shield pickup behaves like normal hit
    o.judged = true;
    applyHit(o, judgment, rtMs, src);

    // overdrive trigger (risk-reward)
    maybeTriggerOverdrive();

    // cashout auto prompt (light)
    if (STATE.cashoutReady) {
      setTele(true, `💰 CASHOUT +${CFG.cashoutBonusPerStep}`);
      setTimeout(() => setTele(false), 380);
    }
  }

  function updateHold() {
    if (!HOLD.on) return;
    if (!STATE.running) { HOLD.on = false; return; }

    const t = now();
    // find hold obstacle still pending
    const o = STATE.obstacles.find(x => x && x.id === HOLD.targetId);
    if (!o) { HOLD.on = false; return; }

    if (t >= HOLD.until) {
      // success hold -> count as hit (great by default)
      o.judged = true;
      if (o.el) { o.el.classList.add('jd-reveal'); }
      applyHit(o, 'great', 0, 'hold');
      logEvent('hold_ok', o, 'great', 0, 'hold', {});
      // remove visual
      if (o.el) o.el.remove();
      HOLD.on = false;
      maybeTriggerOverdrive();
      return;
    }

    // if player breaks hold early by jumping, we treat as miss (we can't detect pose, so detect explicit jump)
    // handled via action(): if user presses jump while HOLD.on -> break
  }

  // break hold if jump happens
  const _origAction = action;
  action = function(actionType, src){
    if (HOLD.on && actionType === 'jump') {
      const o = STATE.obstacles.find(x => x && x.id === HOLD.targetId);
      if (o && !o.judged) {
        o.judged = true;
        if (o.el) o.el.remove();
        HOLD.on = false;
        applyMiss(o, 'hold_break');
        logEvent('hold_break', o, 'miss', '', src, {});
        return;
      }
    }
    return _origAction(actionType, src);
  };

  // ---------------- overdrive / cashout ----------------
  function maybeTriggerOverdrive() {
    if (STATE.overdriveOn) return;
    if (STATE.fever < CFG.overdrive.minFever) return;

    // start overdrive in Phase 3 (most exciting), or in Phase2 hard
    const p = STATE.boss.phase;
    const allow = (p >= 3) || (p === 2 && STATE.diff === 'hard');
    if (!allow) return;

    STATE.overdriveOn = true;
    STATE.overdriveLeft = CFG.overdrive.durationSec;
    setTele(true, '⚡ OVERDRIVE');
    setTimeout(() => setTele(false), 520);
    playSfx(sfx.boss, 0.7);
  }

  function updateOverdrive(dtSec) {
    if (!STATE.overdriveOn) return;
    STATE.overdriveLeft -= dtSec;
    if (STATE.overdriveLeft <= 0) {
      STATE.overdriveOn = false;
      STATE.overdriveLeft = 0;
    }
  }

  function doCashoutIfReady() {
    if (!STATE.cashoutReady) return;
    // auto cashout after a successful hit following the threshold
    // (keeps it simple; you can later add a button)
    STATE.score += CFG.cashoutBonusPerStep;
    STATE.combo = 0;
    STATE.cashoutReady = false;
    setTele(true, `💰 CASHOUT +${CFG.cashoutBonusPerStep}`);
    setTimeout(() => setTele(false), 360);
  }

  // ---------------- AI prediction baseline ----------------
  function aiInit() {
    const aiQ = toLowerSafe(qs('ai', '0'));
    STATE.ai.assistOn = (aiQ === '1' || aiQ === 'true');

    // lock AI effects in test/research (still show predictions)
    STATE.ai.locked = (STATE.mode === 'test' || STATE.mode === 'research');

    STATE.ai.nextTick = 0;
    STATE.ai.miss5s = [];
    STATE.ai.hit5s = [];
    STATE.ai.rt5s = [];
    STATE.ai.comboBreaks10s = [];
    STATE.ai.lastCombo = 0;
  }

  function aiPushRolling(arr, item, maxN) {
    arr.push(item);
    if (arr.length > maxN) arr.splice(0, arr.length - maxN);
  }

  function aiTick() {
    if (!STATE.running) return;
    const t = STATE.elapsed;
    if (t < STATE.ai.nextTick) return;
    STATE.ai.nextTick = t + 0.50;

    // rolling window snapshots
    // (approx: store last 10 ticks = 5s)
    const missNow = STATE.miss;
    const hitNow = STATE.hit;

    // we store diffs (like counters)
    if (!STATE.ai._lastMiss) STATE.ai._lastMiss = missNow;
    if (!STATE.ai._lastHit) STATE.ai._lastHit = hitNow;

    const dMiss = Math.max(0, missNow - STATE.ai._lastMiss);
    const dHit = Math.max(0, hitNow - STATE.ai._lastHit);

    STATE.ai._lastMiss = missNow;
    STATE.ai._lastHit = hitNow;

    aiPushRolling(STATE.ai.miss5s, dMiss, 10);
    aiPushRolling(STATE.ai.hit5s, dHit, 10);

    // RT rolling: use avg recent; fallback
    const rtRecent = STATE.rtN ? (STATE.rtSum / STATE.rtN) : 0;
    aiPushRolling(STATE.ai.rt5s, rtRecent, 10);

    // combo breaks
    const cb = (STATE.ai.lastCombo > 0 && STATE.combo === 0) ? 1 : 0;
    STATE.ai.lastCombo = STATE.combo;
    aiPushRolling(STATE.ai.comboBreaks10s, cb, 20);

    const miss5 = STATE.ai.miss5s.reduce((a, b) => a + b, 0);
    const hit5 = STATE.ai.hit5s.reduce((a, b) => a + b, 0);
    const act5 = miss5 + hit5;

    const missRate5 = act5 ? (miss5 / act5) : 0;
    const comboBreaks10 = STATE.ai.comboBreaks10s.reduce((a, b) => a + b, 0);

    // drift score: higher when RT increases + stability drops
    const rtMean5 = STATE.ai.rt5s.reduce((a, b) => a + b, 0) / Math.max(1, STATE.ai.rt5s.length);
    const rtNorm = clamp01(rtMean5 / 520); // normalize around 520ms
    const stabInv = clamp01((100 - STATE.stability) / 60);

    const driftScore = clamp01(0.55 * rtNorm + 0.45 * stabInv);

    // fatigue risk: miss rate + drift
    const fatigueRisk = clamp01(0.60 * missRate5 + 0.40 * driftScore);

    // predict miss burst next 5s (baseline)
    const predictMissBurst = (missRate5 > 0.35 || comboBreaks10 >= 2 || fatigueRisk > 0.62) ? 1 : 0;

    STATE.ai.driftScore = driftScore;
    STATE.ai.fatigueRisk = fatigueRisk;
    STATE.ai.predictMissBurst = predictMissBurst;

    // tip (short, explainable)
    let tip = '';
    if (predictMissBurst) tip = 'ชะลอ 1 จังหวะ แล้วค่อยเร่ง (โฟกัส LOW/HIGH ให้ชัด)';
    else if (STATE.boss.phase >= 2 && driftScore > 0.45) tip = 'ระวัง TEMPO SHIFT — กะจังหวะใหม่ก่อน';
    else if (STATE.overdriveOn) tip = 'OVERDRIVE: หน้าต่างแคบขึ้น เล่นให้ “ชัวร์”';
    STATE.ai.tip = tip;

    // (research lock) — ไม่ปรับ difficulty/spawn ใด ๆ
  }

  // ---------------- logging ----------------
  function logEvent(eventType, o, judgment, rtMs, src, extraObj) {
    const row = {
      timestampIso: isoNow(),
      runMode: STATE.mode,
      gameMode: STATE.tutorial ? 'tutorial' : 'play',
      diff: STATE.diff,
      sessionId: STATE.sessionId,
      eventType,
      timeFromStartMs: Math.round(STATE.elapsed * 1000),

      obstacleId: o ? o.id : '',
      itemType: o ? (o.kind + (o.decoy ? ':feint' : '') + (o.special ? ':' + o.special : '')) : '',
      lane: '',
      rtMs: (rtMs == null ? '' : rtMs),
      judgment: judgment || '',
      totalScore: STATE.score,
      combo: STATE.combo,

      feverState: STATE.feverActive ? 'on' : 'off',
      feverValue: STATE.fever.toFixed(3),
      bossPhase: STATE.boss.phase,
      bossHp: STATE.boss.hp.toFixed(3),
      overdriveOn: STATE.overdriveOn ? 1 : 0,
      shieldOn: STATE.shieldOn ? 1 : 0,

      ai_locked: STATE.ai.locked ? 1 : 0,
      ai_predictMissBurst: STATE.ai.predictMissBurst ? 1 : 0,
      ai_driftScore: (STATE.ai.driftScore || 0).toFixed(3),
      ai_fatigueRisk: (STATE.ai.fatigueRisk || 0).toFixed(3),
      extra: extraObj ? JSON.stringify(extraObj) : ''
    };
    STATE.events.add(row);
  }

  async function flushRemoteSessionIfAny(reason) {
    const url = STATE.logUrl;
    if (!url) return;

    // send session summary row (sessions table) as JSON
    const csvSession = STATE.sessions.toCsv();
    const csvEvents = STATE.events.toCsv();

    const payload = {
      _table: 'sessions',
      type: 'session',
      timestampIso: isoNow(),
      sessionId: STATE.sessionId,
      runMode: STATE.mode,
      game: 'jump-duck',
      diff: STATE.diff,
      reason,
      // include both CSV for archive
      sessionCsv: csvSession,
      eventsCsv: csvEvents,
      // include key fields for Sheets columns if you want to map later
      scoreFinal: STATE.score,
      comboMax: STATE.comboMax,
      misses: STATE.miss,
      obstaclesTotal: STATE.totalObs,
      accuracyPct: calcAcc().toFixed(2),
      avgRtMs: calcAvgRt().toFixed(1),
      stabilityMinPct: STATE.stabilityMin.toFixed(1),
      bossPhaseEnd: STATE.boss.phase,
      bossHpEnd: STATE.boss.hp.toFixed(3),
      feverTimePct: calcFeverTimePct().toFixed(2),
      participantId: STATE.meta.pid || '',
      group: STATE.meta.group || '',
      note: STATE.meta.note || '',
      ai_locked: STATE.ai.locked ? 1 : 0,
      ai_predictMissBurst: STATE.ai.predictMissBurst ? 1 : 0,
      ai_driftScore: (STATE.ai.driftScore || 0).toFixed(3),
      ai_fatigueRisk: (STATE.ai.fatigueRisk || 0).toFixed(3),
      __extraJson: JSON.stringify({
        view: VIEW,
        seed: STATE.seed,
        tutorial: STATE.tutorial,
        shieldUsed: STATE.shieldUsed,
        overdriveUsed: !!STATE._overdriveEver,
      })
    };

    // POST once (your GAS can flatten JSON)
    await postJson(url, payload);

    // optionally send events rows as separate table (if you want):
    // await postJson(url, { _table:'events', type:'event', sessionId:STATE.sessionId, eventsCsv: csvEvents });
  }

  // ---------------- HUD update ----------------
  function calcAcc() {
    const judged = STATE.hit + STATE.miss;
    if (!judged) return 0;
    return (STATE.hit / judged) * 100;
  }
  function calcAvgRt() {
    return STATE.rtN ? (STATE.rtSum / STATE.rtN) : 0;
  }
  function calcFeverTimePct() {
    const dur = Math.max(0.001, Math.min(STATE.elapsed, STATE.durationPlannedSec));
    return (STATE.feverTime / dur) * 100;
  }

  function updateHud() {
    hud.mode && (hud.mode.textContent = cap(STATE.mode));
    hud.diff && (hud.diff.textContent = STATE.diff);
    hud.duration && (hud.duration.textContent = STATE.durationPlannedSec + 's');

    hud.time && (hud.time.textContent = fmt1(STATE.timeLeft));
    hud.score && (hud.score.textContent = String(STATE.score));
    hud.combo && (hud.combo.textContent = String(STATE.combo));
    hud.obstacles && (hud.obstacles.textContent = `${STATE.totalObs} / ${STATE.totalObs}`);

    hud.stability && (hud.stability.textContent = Math.round(STATE.stability) + '%');

    // progress
    const p = clamp01(STATE.elapsed / STATE.durationPlannedSec);
    hud.progFill && (hud.progFill.style.transform = `scaleX(${p.toFixed(4)})`);
    hud.progText && (hud.progText.textContent = Math.round(p * 100) + '%');

    // fever
    hud.feverFill && (hud.feverFill.style.transform = `scaleX(${STATE.fever.toFixed(4)})`);
    if (hud.feverStatus) {
      if (STATE.overdriveOn) {
        hud.feverStatus.textContent = 'OVERDRIVE';
        hud.feverStatus.classList.add('on');
      } else if (STATE.feverActive) {
        hud.feverStatus.textContent = 'FEVER!';
        hud.feverStatus.classList.add('on');
      } else if (STATE.fever >= 0.85) {
        hud.feverStatus.textContent = 'BUILD';
        hud.feverStatus.classList.remove('on');
      } else {
        hud.feverStatus.textContent = 'READY';
        hud.feverStatus.classList.remove('on');
      }
    }

    // boss
    hud.phase && (hud.phase.textContent = String(STATE.boss.phase));
    hud.boss && (hud.boss.textContent = STATE.boss.name || 'MIXED');
    if (hud.bossFill) {
      const hp = clamp01(STATE.boss.hp);
      hud.bossFill.style.transform = `scaleX(${hp.toFixed(4)})`;
    }
    if (hud.bossStatus) {
      let t = '—';
      if (STATE.boss.armor > 0 && !STATE.boss.breakUsed) t = 'ARMOR';
      else if (STATE.boss.breakUsed) t = 'BREAK!';
      else t = (STATE.boss.phase === 3 ? 'BURST' : (STATE.boss.phase === 2 ? 'SHIFT' : 'WARM'));
      hud.bossStatus.textContent = t;
      hud.bossStatus.classList.toggle('on', STATE.boss.phase >= 2);
    }
  }

  function cap(s) {
    s = String(s || '');
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // ---------------- loop ----------------
  let RAF = 0;
  function loop(ts) {
    if (!STATE.running) return;

    if (!STATE.t0) STATE.t0 = ts;
    const dtMs = ts - STATE.lastTs;
    STATE.lastTs = ts;

    const dtSec = Math.max(0, dtMs / 1000);

    // time
    STATE.elapsed = (ts - STATE.t0) / 1000;
    STATE.timeLeft = Math.max(0, STATE.durationPlannedSec - STATE.elapsed);

    // fever time
    if (STATE.feverActive || STATE.overdriveOn) STATE.feverTime += dtSec;

    // boss phase/time behavior
    updateBossByTime();

    // spawn
    scheduleSpawns(dtSec);

    // movement
    updateObstaclePositions();

    // hold updates
    updateHold();

    // overdrive countdown
    if (STATE.overdriveOn) STATE._overdriveEver = true;
    updateOverdrive(dtSec);

    // AI tick (prediction baseline)
    aiTick();

    // auto cashout if ready and just hit (simple: if combo==0 but cashoutReady false we already paid)
    if (STATE.cashoutReady && STATE.combo === 0) STATE.cashoutReady = false;
    if (STATE.cashoutReady && STATE.combo > 0 && STATE.combo % CFG.cashoutEvery === 0) {
      // if user keeps going, do nothing; cashout only after next success:
    }

    // update HUD
    updateHud();

    // end?
    if (STATE.timeLeft <= 0.001) {
      stopGame('time-end');
      return;
    }
    if (STATE.boss.active && STATE.boss.hp <= 0) {
      stopGame('boss-defeat');
      return;
    }

    RAF = requestAnimationFrame(loop);
  }

  // ---------------- start/stop ----------------
  function readParamsIntoMenu() {
    try {
      const m = toLowerSafe(qs('mode', ''));
      const d = toLowerSafe(qs('diff', ''));
      const dur = qs('duration', '');

      if (m && selMode) selMode.value = (m === 'research' ? 'research' : (m === 'test' ? 'test' : 'training'));
      if (d && selDiff) selDiff.value = (d === 'easy' || d === 'hard' ? d : 'normal');
      if (dur && selDur && isFiniteNum(dur)) {
        const v = String(Math.round(Number(dur)));
        const opt = Array.from(selDur.options).find(o => o.value === v);
        if (opt) selDur.value = v;
      }

      applyMenuVisibility();
    } catch (_) {}
  }

  function setBackLinks() {
    // keep hub param passthrough if present
    const hub = qs('hub', '');
    const back = hub ? hub : 'hub.html';
    const a1 = $('#jd-back-hub-menu');
    const a2 = $('#jd-back-hub-play');
    const a3 = $('#jd-back-hub-result');
    [a1, a2, a3].forEach(a => { if (a) a.href = back; });
  }

  function startFromMenu() {
    const mode = toLowerSafe(selMode.value, 'training');
    const diff = toLowerSafe(selDiff.value, 'normal');
    const dur = Number(selDur.value || 60);

    const meta = {
      pid: (inpPid && inpPid.value || '').trim(),
      group: (inpGroup && inpGroup.value || '').trim(),
      note: (inpNote && inpNote.value || '').trim()
    };

    startGame(mode, diff, dur, false, meta);
  }

  function startTutorial() {
    const diff = toLowerSafe(selDiff.value, 'normal');
    startGame('training', diff, 15, true, { pid: '', group: '', note: 'tutorial' });
  }

  function startGame(mode, diff, dur, tutorial, meta) {
    // reset
    STATE.running = true;
    STATE.ended = false;

    STATE.mode = (mode === 'research') ? 'research' : (mode === 'test' ? 'test' : 'training');
    STATE.diff = (diff === 'easy' || diff === 'hard') ? diff : 'normal';
    STATE.durationPlannedSec = clamp(Number(dur) || 60, 15, 180);
    STATE.tutorial = !!tutorial;

    STATE.seed = qs('seed', '') || (STATE.mode === 'research' || STATE.mode === 'test' ? 'R1' : String(Date.now()));
    STATE.rnd = makeRng(STATE.seed + '|' + STATE.mode + '|' + STATE.diff + '|' + STATE.durationPlannedSec);

    STATE.score = 0;
    STATE.combo = 0;
    STATE.comboMax = 0;

    STATE.totalObs = 0;
    STATE.hit = 0;
    STATE.miss = 0;
    STATE.jumpHit = 0;
    STATE.duckHit = 0;
    STATE.jumpMiss = 0;
    STATE.duckMiss = 0;

    STATE.rtSum = 0;
    STATE.rtN = 0;

    STATE.stability = 100;
    STATE.stabilityMin = 100;

    STATE.fever = 0;
    STATE.feverActive = false;
    STATE.feverTime = 0;

    STATE.overdriveOn = false;
    STATE.overdriveLeft = 0;
    STATE._overdriveEver = false;

    STATE.shieldOn = false;
    STATE.shieldUsed = false;

    STATE.cashoutReady = false;

    HOLD.on = false;
    HOLD.until = 0;
    HOLD.targetId = 0;

    // boss for ALL modes
    maybeStartBoss();

    // obstacles
    STATE.obstacles.length = 0;
    STATE.nextId = 1;
    STATE._nextSpawnAt = 0;

    // session/logging
    STATE.sessionId = makeSessionId();
    STATE.startIso = isoNow();
    STATE.endIso = '';
    STATE.meta = meta || { pid: '', group: '', note: '' };

    STATE.events.clear();
    STATE.sessions.clear();

    // remote log url
    STATE.logUrl = String(qs('log', '') || '').trim();

    // ai init
    aiInit();

    // hud init
    hud.bossWrap && hud.bossWrap.classList.remove('jd-hidden');

    // clear DOM
    obstaclesEl && (obstaclesEl.innerHTML = '');
    setTele(false);

    // switch to play
    switchView('play');

    // kickoff
    STATE.t0 = 0;
    STATE.lastTs = 0;
    RAF && cancelAnimationFrame(RAF);
    RAF = requestAnimationFrame(loop);

    // beep
    playSfx(sfx.beep, 0.55);

    // log start event
    logEvent('start', null, '', '', 'sys', { seed: STATE.seed, view: VIEW });
  }

  function stopGame(reason) {
    if (!STATE.running || STATE.ended) return;
    STATE.running = false;
    STATE.ended = true;
    RAF && cancelAnimationFrame(RAF);

    STATE.endIso = isoNow();

    // finalize metrics
    const durPlayed = Math.min(STATE.elapsed, STATE.durationPlannedSec);
    const acc = calcAcc();
    const avgRt = calcAvgRt();
    const feverPct = calcFeverTimePct();

    // rank
    const rank =
      acc >= 95 ? 'SSS' :
      acc >= 90 ? 'SS' :
      acc >= 85 ? 'S' :
      acc >= 75 ? 'A' :
      acc >= 65 ? 'B' : 'C';

    // fill result UI
    res.mode && (res.mode.textContent = cap(STATE.mode));
    res.diff && (res.diff.textContent = STATE.diff);
    res.duration && (res.duration.textContent = STATE.durationPlannedSec + 's');

    res.totalObs && (res.totalObs.textContent = String(STATE.totalObs));
    res.hits && (res.hits.textContent = String(STATE.hit));
    res.miss && (res.miss.textContent = String(STATE.miss));

    res.jHit && (res.jHit.textContent = String(STATE.jumpHit));
    res.dHit && (res.dHit.textContent = String(STATE.duckHit));
    res.jMiss && (res.jMiss.textContent = String(STATE.jumpMiss));
    res.dMiss && (res.dMiss.textContent = String(STATE.duckMiss));

    res.acc && (res.acc.textContent = acc.toFixed(1) + ' %');
    res.rtMean && (res.rtMean.textContent = (avgRt ? Math.round(avgRt) + ' ms' : '-'));
    res.stabMin && (res.stabMin.textContent = STATE.stabilityMin.toFixed(1) + ' %');
    res.score && (res.score.textContent = String(STATE.score));
    res.rank && (res.rank.textContent = rank);

    // build session row + CSV
    const sessRow = {
      timestampIso: isoNow(),
      runMode: STATE.mode,
      gameMode: STATE.tutorial ? 'tutorial' : 'play',
      diff: STATE.diff,
      durationPlannedSec: STATE.durationPlannedSec,
      durationPlayedSec: durPlayed.toFixed(2),
      sessionId: STATE.sessionId,
      scoreFinal: STATE.score,
      comboMax: STATE.comboMax,
      misses: STATE.miss,
      obstaclesTotal: STATE.totalObs,

      jumpHit: STATE.jumpHit,
      duckHit: STATE.duckHit,
      jumpMiss: STATE.jumpMiss,
      duckMiss: STATE.duckMiss,

      accuracyPct: acc.toFixed(3),
      avgRtMs: avgRt ? avgRt.toFixed(1) : '',
      stabilityMinPct: STATE.stabilityMin.toFixed(2),

      bossPhaseEnd: STATE.boss.phase,
      bossHpEnd: STATE.boss.hp.toFixed(3),
      feverTimePct: feverPct.toFixed(3),

      ai_locked: STATE.ai.locked ? 1 : 0,
      ai_predictMissBurst: STATE.ai.predictMissBurst ? 1 : 0,
      ai_driftScore: (STATE.ai.driftScore || 0).toFixed(3),
      ai_fatigueRisk: (STATE.ai.fatigueRisk || 0).toFixed(3),

      reason: reason || 'end',
      startTimeIso: STATE.startIso,
      endTimeIso: STATE.endIso,

      participantId: STATE.meta.pid || '',
      group: STATE.meta.group || '',
      note: STATE.meta.note || '',

      __extraJson: JSON.stringify({
        view: VIEW,
        seed: STATE.seed,
        tutorial: STATE.tutorial,
        bossName: STATE.boss.name,
        breakUsed: STATE.boss.breakUsed,
        armorEnd: STATE.boss.armor,
        overdriveEver: !!STATE._overdriveEver,
        shieldUsed: STATE.shieldUsed,
      })
    };
    STATE.sessions.add(sessRow);

    // end log event
    logEvent('end', null, rank, '', 'sys', { reason, acc, avgRt, rank });

    // optional remote flush
    flushRemoteSessionIfAny(reason).catch(() => {});

    // go result view
    switchView('result');
  }

  function replay() {
    // replay with same mode/diff/duration; keep seed new unless research/test (deterministic)
    const meta = STATE.meta;
    const mode = STATE.mode;
    const diff = STATE.diff;
    const dur = STATE.durationPlannedSec;
    const tut = STATE.tutorial;
    startGame(mode, diff, dur, tut, meta);
  }

  function backToMenu() {
    switchView('menu');
  }

  // ---------------- boot ----------------
  function boot() {
    try {
      applyMenuVisibility();
      setBackLinks();
      readParamsIntoMenu();
      bindInput();

      if (selMode) selMode.addEventListener('change', applyMenuVisibility);

      // default view
      switchView('menu');

      // auto-start if ?autostart=1
      const auto = toLowerSafe(qs('autostart', '0'));
      if (auto === '1' || auto === 'true') startFromMenu();

    } catch (err) {
      showFatal(err);
    }
  }

  // safety
  WIN.addEventListener('error', (e) => showFatal(e && e.error || e && e.message || e));
  WIN.addEventListener('unhandledrejection', (e) => showFatal(e && e.reason || e));

  boot();

})();