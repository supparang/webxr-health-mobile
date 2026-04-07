'use strict';

(function () {
  const $ = (s) => document.querySelector(s);

  const viewMenu = $('#view-menu');
  const viewPlay = $('#view-play');
  const viewResult = $('#view-result');

  const elMode = $('#jd-mode');
  const elDiff = $('#jd-diff');
  const elDuration = $('#jd-duration');
  const researchBlock = $('#jd-research-block');
  const elPidInput = $('#jd-participant-id');
  const elGroup = $('#jd-group');
  const elNote = $('#jd-note');

  const playRoot = $('#jd-play-area');
  const arena = $('#jd-arena');
  const obsLayer = $('#jd-obstacles');
  const avatar = $('#jd-avatar');

  const hudMode = $('#hud-mode');
  const hudDiff = $('#hud-diff');
  const hudTime = $('#hud-time');
  const hudPhase = $('#hud-phase');
  const hudScore = $('#hud-score');
  const hudCombo = $('#hud-combo');
  const hudStability = $('#hud-stability');
  const hudBoss = $('#hud-boss');

  const hudPattern = $('#hud-pattern');
  const hudRush = $('#hud-rush');
  const hudBossLabel = $('#hud-boss-label');
  const hudBossStatus = $('#hud-boss-status');
  const hudBossCompact = $('#hud-boss-compact');

  const progFill = $('#hud-prog-fill');
  const progText = $('#hud-prog-text');
  const feverFill = $('#hud-fever-fill');
  const feverStatus = $('#hud-fever-status');

  const bossBarWrap = $('#boss-bar-wrap');
  const bossFill = $('#hud-boss-fill');
  const bossStatusRight = $('#hud-boss-status-right');

  const tele = $('#jd-tele');
  const bossIntro = $('#jd-boss-intro');
  const bossIntroText = $('#jd-boss-intro-text');
  const judgeEl = $('#jd-judge');
  const rushBanner = $('#jd-rush-banner');

  const rankBadge = $('#jd-rank-badge');
  const resultTitle = $('#jd-result-title');
  const resultSub = $('#jd-result-sub');
  const resultBoss = $('#jd-result-boss');
  const resultPattern = $('#jd-result-pattern');
  const resultRush = $('#jd-result-rush');
  const resultReward = $('#jd-result-reward');
  const resultRewardIcon = $('#jd-result-reward-icon');
  const resultRewardSub = $('#jd-result-reward-sub');

  const coachTitle = $('#jd-coach-title');
  const coachSummary = $('#jd-coach-summary');
  const coachTip1 = $('#jd-coach-tip-1');
  const coachTip2 = $('#jd-coach-tip-2');

  const resMode = $('#res-mode');
  const resDiff = $('#res-diff');
  const resDuration = $('#res-duration');
  const resTotalObs = $('#res-total-obs');
  const resHits = $('#res-hits');
  const resMiss = $('#res-miss');
  const resJumpHit = $('#res-jump-hit');
  const resDuckHit = $('#res-duck-hit');
  const resJumpMiss = $('#res-jump-miss');
  const resDuckMiss = $('#res-duck-miss');
  const resAcc = $('#res-acc');
  const resRTMean = $('#res-rt-mean');
  const resStabilityMin = $('#res-stability-min');
  const resScore = $('#res-score');
  const resRank = $('#res-rank');

  const resScoreBig = $('#res-score-big');
  const resAccBig = $('#res-acc-big');
  const resComboBig = $('#res-combo-big');
  const resBossEndBig = $('#res-boss-end-big');

  const resPhaseEnd = $('#res-phase-end');
  const resPattern = $('#res-pattern');
  const resBossLabel = $('#res-boss-label');
  const resRush = $('#res-rush');

  const btnDlEvents = $('#jd-btn-dl-events');
  const btnDlSessions = $('#jd-btn-dl-sessions');
  const btnDlTeacher = $('#jd-btn-dl-teacher');
  const btnSendLog = $('#jd-btn-send-log');
  const logStatus = $('#jd-log-status');

  const qs = (k, d = '') => {
    try {
      return (new URL(location.href)).searchParams.get(k) ?? d;
    } catch (_) {
      return d;
    }
  };

  const HHA_CTX = {
    run: qs('run', 'play'),
    diff: qs('diff', 'normal'),
    time: qs('time', '60'),
    seed: qs('seed', ''),
    studyId: qs('studyId', ''),
    phase: qs('phase', ''),
    conditionGroup: qs('conditionGroup', ''),
    log: qs('log', ''),
    view: qs('view', ''),
    pid: qs('pid', 'anon'),
    api: qs('api', ''),
    ai: qs('ai', ''),
    debug: qs('debug', ''),
    hub: qs('hub', './'),
    mode: qs('mode', 'training'),
    duration: qs('duration', qs('time', '60')),
    pro: qs('pro', ''),
    phaseTune: qs('phaseTune', 'dynamicABC')
  };

  let state = null;
  let rafId = 0;

  /* ===== HeroHealth Fitness Recent Bridge ===== */
  function hhFitnessBaseSnapshot() {
    const s = state;
    const durationSec = s && s.duration ? Math.round(Number(s.duration || 0) / 1000) : Number(HHA_CTX.duration || HHA_CTX.time || 60);
    return {
      zone: 'fitness',
      gameId: 'jump-duck',
      game: 'jump-duck',
      pid: String(HHA_CTX.pid || 'anon'),
      name: String(qs('name', qs('nickName', 'Hero')) || 'Hero'),
      studyId: String(HHA_CTX.studyId || ''),
      run: String(HHA_CTX.run || 'play'),
      mode: String(s?.mode || HHA_CTX.mode || 'training'),
      diff: String(s?.diff || HHA_CTX.diff || 'normal'),
      view: String(HHA_CTX.view || 'mobile'),
      time: String(durationSec),
      score: Number(s?.score || 0),
      miss: Number(s?.miss || 0),
      combo: Number(s?.combo || 0),
      bestStreak: Number(s?.maxCombo || 0),
      stability: Number(s?.stability || 0),
      result: String(s?.ended ? 'summary' : (s?.running ? 'running' : 'idle')),
      href: location.href,
      path: location.pathname
    };
  }

  function hhFitnessMark(eventName, extra = {}) {
    try {
      window.HH_FITNESS_LASTGAME?.writeSnapshot({
        ...hhFitnessBaseSnapshot(),
        event: eventName,
        ...extra
      });
    } catch (_) {}
  }

  function hhFitnessSessionStart(extra = {}) {
    hhFitnessMark('session_start', extra);
  }

  function hhFitnessSummaryEnd(extra = {}) {
    hhFitnessMark('summary_end', extra);
  }

  function hhFitnessRematch(extra = {}) {
    hhFitnessMark('rematch', extra);
  }

  function hhFitnessGoHub(extra = {}) {
    hhFitnessMark('go_hub', extra);
  }

  const JD_VISUALS = {
    low: [
      { key: 'low-hurdle', label: 'JUMP', cls: 'low-hurdle' },
      { key: 'low-box', label: 'JUMP', cls: 'low-box' },
      { key: 'low-tyre', label: 'JUMP', cls: 'low-tyre' },
      { key: 'low-bench', label: 'JUMP', cls: 'low-bench' },
      { key: 'low-cones', label: 'JUMP', cls: 'low-cones' },
      { key: 'low-heavy', label: 'JUMP', cls: 'low-heavy' },
      { key: 'low-mini', label: 'JUMP', cls: 'low-mini' }
    ],
    high: [
      { key: 'high-bar', label: 'DUCK', cls: 'high-bar' },
      { key: 'high-ribbon', label: 'DUCK', cls: 'high-ribbon' },
      { key: 'high-ball', label: 'DUCK', cls: 'high-ball' },
      { key: 'high-beam', label: 'DUCK', cls: 'high-beam' },
      { key: 'high-tape', label: 'DUCK', cls: 'high-tape' },
      { key: 'high-heavy', label: 'DUCK', cls: 'high-heavy' },
      { key: 'high-mini', label: 'DUCK', cls: 'high-mini' }
    ]
  };

  const JD_PHASE_TABLE = {
    1: {
      label: 'warmup',
      spawnMs: { easy: 1320, normal: 1140, hard: 980 },
      speedMul: 0.90,
      patterns: ['single', 'single', 'single', 'alt2']
    },
    2: {
      label: 'pressure',
      spawnMs: { easy: 1080, normal: 900, hard: 780 },
      speedMul: 1.00,
      patterns: ['single', 'alt2', 'pair', 'zigzag3']
    },
    3: {
      label: 'boss',
      spawnMs: { easy: 940, normal: 780, hard: 660 },
      speedMul: 1.10,
      patterns: ['pair', 'zigzag3', 'burst4', 'mirror4']
    }
  };

  const JD_BOSS_PROFILES = {
    tempo: {
      key: 'tempo',
      label: 'Tempo Boss',
      icon: '🎵',
      intro: 'จับจังหวะให้เป๊ะ แล้วคอมโบจะพุ่ง!',
      patterns: ['tempo221', 'tempo121', 'tempoAlt6', 'alt4', 'double-low-high'],
      burstEveryMs: 3800,
      feintChance: 0.00,
      speedMul: 1.08
    },

    feint: {
      key: 'feint',
      label: 'Feint Boss',
      icon: '🧠',
      intro: 'อย่ากดเร็วเกินไป บางอันจะพลิกตอนท้าย',
      patterns: ['feintLate2', 'feintLate3', 'fakePair', 'feint2', 'feint3'],
      burstEveryMs: 4300,
      feintChance: 0.38,
      speedMul: 0.98
    },

    shield: {
      key: 'shield',
      label: 'Shield Boss',
      icon: '🛡️',
      intro: 'ต้องตีติดกันเพื่อเจาะเกราะ',
      patterns: ['shieldPair', 'shieldWall', 'shieldBreaker', 'pair'],
      burstEveryMs: 5000,
      feintChance: 0.00,
      speedMul: 1.00
    },

    mirror: {
      key: 'mirror',
      label: 'Mirror Boss',
      icon: '🪞',
      intro: 'จำและอ่านแพทเทิร์นสะท้อนให้ทัน',
      patterns: ['mirrorABBA', 'mirrorBAAB', 'mirrorEcho', 'mirror4'],
      burstEveryMs: 4100,
      feintChance: 0.03,
      speedMul: 1.04
    },

    chaos: {
      key: 'chaos',
      label: 'Chaos Boss',
      icon: '🌪️',
      intro: 'ช่วงท้ายจะบ้าคลั่งและถี่ขึ้น!',
      patterns: ['chaosBurst5', 'chaosBurst6', 'chaosLadder', 'burst4', 'burst5'],
      burstEveryMs: 2850,
      feintChance: 0.08,
      speedMul: 1.14
    }
  };

  const JD_TUNING_PRESETS = {
    A: {
      startXMul: { tiny: 0.80, compact: 0.84, desktop: 0.86 },
      gapBase: { tiny: 182, compact: 170, desktop: 144 },
      speedBase: { tiny: 5.8, compact: 6.0, desktop: 6.8 },
      hitHalfWindow: { tiny: 28, compact: 27, desktop: 28 }
    },
    B: {
      startXMul: { tiny: 0.77, compact: 0.81, desktop: 0.84 },
      gapBase: { tiny: 174, compact: 162, desktop: 138 },
      speedBase: { tiny: 6.0, compact: 6.2, desktop: 7.0 },
      hitHalfWindow: { tiny: 27, compact: 26, desktop: 28 }
    },
    C: {
      startXMul: { tiny: 0.74, compact: 0.78, desktop: 0.82 },
      gapBase: { tiny: 166, compact: 154, desktop: 132 },
      speedBase: { tiny: 6.2, compact: 6.4, desktop: 7.2 },
      hitHalfWindow: { tiny: 26, compact: 25, desktop: 27 }
    },
    CPLUS: {
      startXMul: { tiny: 0.72, compact: 0.76, desktop: 0.80 },
      gapBase: { tiny: 160, compact: 148, desktop: 126 },
      speedBase: { tiny: 6.35, compact: 6.6, desktop: 7.4 },
      hitHalfWindow: { tiny: 25, compact: 24, desktop: 26 }
    }
  };

  const JD_DIRECTOR_CONFIG = {
    enabled: true,
    researchDeterministic: true,
    missStreakSoft: 2,
    missStreakHard: 4,
    comboBoost1: 6,
    comboBoost2: 12,
    maxAssistLevel: 2,
    maxPressureLevel: 2
  };

  function showView(name) {
    viewMenu?.classList.add('hidden');
    viewPlay?.classList.add('hidden');
    viewResult?.classList.add('hidden');

    if (name === 'menu') viewMenu?.classList.remove('hidden');
    if (name === 'play') viewPlay?.classList.remove('hidden');
    if (name === 'result') viewResult?.classList.remove('hidden');
  }

  function jdClamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function jdPick(arr, rng = Math.random) {
    return arr[Math.floor(rng() * arr.length)];
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function mulberry32(seed) {
    let t = seed >>> 0;
    return function () {
      t += 0x6D2B79F5;
      let x = Math.imul(t ^ (t >>> 15), 1 | t);
      x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }

  function strToSeed(s) {
    const str = String(s || '');
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function loadJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function saveJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_) {}
  }

  function saveLastSummary(summary) {
    try {
      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary));
      const histKey = 'HHA_SUMMARY_HISTORY';
      const old = JSON.parse(localStorage.getItem(histKey) || '[]');
      old.unshift(summary);
      while (old.length > 30) old.pop();
      localStorage.setItem(histKey, JSON.stringify(old));
    } catch (_) {}
  }

  function escCsv(v) {
    if (v == null) return '';
    const s = String(v);
    if (s.includes('"') || s.includes(',') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function toCsv(rows) {
    if (!rows || !rows.length) return '';
    const cols = Object.keys(rows[0]);
    const out = [cols.join(',')];
    rows.forEach(r => out.push(cols.map(c => escCsv(r[c])).join(',')));
    return out.join('\n');
  }

  function downloadCsv(text, filename) {
    if (!text) return;
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function setLogStatus(msg, ok) {
    if (!logStatus) return;
    logStatus.textContent = msg;
    logStatus.style.color = ok ? '#22c55e' : '#f59e0b';
  }

  function setHubLinks() {
    const hub = HHA_CTX.hub || '#';
    ['jd-back-hub-menu', 'jd-back-hub-play', 'jd-back-hub-result'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.href = hub;
        if (!el.__hhFitnessHubBound) {
          el.__hhFitnessHubBound = true;
          el.addEventListener('click', () => {
            hhFitnessGoHub({
              score: Number(state?.score || 0),
              miss: Number(state?.miss || 0),
              bestStreak: Number(state?.maxCombo || 0),
              result: state?.ended ? 'summary' : (state?.running ? 'in-progress' : 'menu')
            });
          });
        }
      }
    });
  }

  function updateResearchVisibility() {
    const mode = (elMode?.value || 'training').toLowerCase();
    researchBlock?.classList.toggle('hidden', mode !== 'research');
  }

  function buildParticipant(mode) {
    if (mode !== 'research') {
      return {
        id: String(HHA_CTX.pid || 'anon').trim(),
        group: '',
        note: ''
      };
    }
    return {
      id: (elPidInput?.value || HHA_CTX.pid || 'anon').trim(),
      group: (elGroup?.value || '').trim(),
      note: (elNote?.value || '').trim()
    };
  }

  function jdShowJudge(msg) {
    if (!judgeEl) return;
    judgeEl.textContent = msg;
    judgeEl.classList.add('show');
    clearTimeout(state?.judgeTimer);
    if (state) {
      state.judgeTimer = setTimeout(() => judgeEl.classList.remove('show'), 620);
    }
  }

  function jdTelegraph(msg, ms = 800) {
    if (!tele) return;
    const box = tele.querySelector('.teleBox');
    if (box) box.textContent = msg;
    tele.classList.remove('hidden');
    tele.classList.add('on');

    clearTimeout(state?.teleTimer);
    if (state) {
      state.teleTimer = setTimeout(() => {
        tele.classList.remove('on');
        setTimeout(() => tele.classList.add('hidden'), 140);
      }, ms);
    }
  }

  function jdShowBossIntro(msg) {
    if (!bossIntro || !bossIntroText) return;
    bossIntroText.textContent = msg;
    bossIntro.classList.remove('hidden');
    bossIntro.classList.add('on');

    clearTimeout(state?.bossIntroTimer);
    if (state) {
      state.bossIntroTimer = setTimeout(() => {
        bossIntro.classList.remove('on');
        setTimeout(() => bossIntro.classList.add('hidden'), 140);
      }, 1200);
    }
  }

  function jdUpdateRushBanner() {
    if (!rushBanner || !state) return;
    rushBanner.classList.toggle('hidden', !state.finalRush);
    const txt = rushBanner.querySelector('.rushText');
    if (!txt) return;
    if (state.rushStage === 'warning') txt.textContent = 'WARNING!';
    else if (state.rushStage === 'peak') txt.textContent = 'FINAL RUSH!';
    else if (state.rushStage === 'survive') txt.textContent = 'SURVIVE!';
    else txt.textContent = 'FINAL RUSH!';
  }

  function jdScorePop(root, x, y, text, className = '') {
    if (!root) return;
    const el = document.createElement('div');
    el.className = `jd-score-pop ${className}`.trim();
    el.textContent = text;
    el.style.position = 'absolute';
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.transform = 'translate(-50%, 0) scale(.9)';
    el.style.opacity = '0';
    el.style.pointerEvents = 'none';
    el.style.fontWeight = '1100';
    el.style.fontSize = '18px';
    el.style.color = '#fff';
    el.style.textShadow = '0 2px 10px rgba(0,0,0,.35)';
    el.style.transition = 'transform .18s ease, opacity .18s ease';
    el.style.zIndex = '30';

    if (className === 'perfect') el.style.color = '#fde68a';
    if (className === 'good') el.style.color = '#bbf7d0';
    if (className === 'miss') el.style.color = '#fecaca';

    root.appendChild(el);
    requestAnimationFrame(() => {
      el.style.opacity = '1';
      el.style.transform = 'translate(-50%, -28px) scale(1)';
    });

    setTimeout(() => {
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 220);
    }, 520);
  }

  function jdFlash(root, kind = 'good') {
    if (!root) return;
    root.classList.remove('fx-good', 'fx-perfect', 'fx-miss', 'fx-fever', 'fx-bosshit');
    root.classList.add(`fx-${kind}`);
    setTimeout(() => root.classList.remove(`fx-${kind}`), 180);
  }

  function injectPatchCSS() {
    if (document.getElementById('jd-patch-css-inline')) return;
    const css = document.createElement('style');
    css.id = 'jd-patch-css-inline';
    css.textContent = `
      .jd-score-pop{ position:absolute; z-index:30; transform:translate(-50%,0) scale(.9); opacity:0; pointer-events:none; font-weight:1100; font-size:18px; color:#fff; text-shadow:0 2px 10px rgba(0,0,0,.35); transition:transform .18s ease, opacity .18s ease; }
      .fx-good{ box-shadow: inset 0 0 0 2px rgba(34,197,94,.20); }
      .fx-perfect{ box-shadow: inset 0 0 0 2px rgba(250,204,21,.26), 0 0 26px rgba(250,204,21,.12); }
      .fx-miss{ box-shadow: inset 0 0 0 2px rgba(239,68,68,.22); }
      .fx-fever{ box-shadow: inset 0 0 0 2px rgba(34,211,238,.28), 0 0 32px rgba(34,211,238,.16); }
      .fx-bosshit{ box-shadow: inset 0 0 0 2px rgba(248,113,113,.28), 0 0 28px rgba(248,113,113,.16); }

      .jd-obstacle{
        position:absolute;
        left:0;
        border-radius:20px;
        display:flex;
        align-items:center;
        justify-content:center;
        overflow:hidden;
        border:1px solid rgba(148,163,184,.18);
        background:rgba(15,23,42,.88);
        box-shadow:0 16px 34px rgba(0,0,0,.24);
        z-index:12;
        width:78px;
        height:74px;
      }
      .jd-obstacle.low{ bottom:80px; }
      .jd-obstacle.high{ bottom:194px; }
      .jd-obstacle.variant-heavy{
        width:90px;
        height:82px;
      }
      .jd-obstacle.variant-mini{
        width:64px;
        height:58px;
        border-radius:16px;
      }
      .jd-obstacle.boss{
        box-shadow:0 0 0 6px rgba(239,68,68,.08), 0 16px 34px rgba(0,0,0,.24);
        border-color:rgba(248,113,113,.28);
      }
      .jd-obstacle.feint::after{
        content:"!?";
        position:absolute;
        top:6px;
        right:6px;
        min-width:22px;
        height:22px;
        display:grid;
        place-items:center;
        padding:0 5px;
        border-radius:999px;
        font-size:10px;
        font-weight:1100;
        color:#f5d0fe;
        background:rgba(88,28,135,.88);
      }
      .jd-obstacle .tag{
        position:absolute;
        left:50%;
        bottom:6px;
        transform:translateX(-50%);
        border-radius:999px;
        padding:4px 9px;
        font-size:10px;
        font-weight:1100;
        color:#fff;
        background:rgba(2,6,23,.72);
        border:1px solid rgba(148,163,184,.16);
      }
      .jd-shape{
        position:absolute;
        left:50%;
        transform:translateX(-50%);
      }

      .low-hurdle{
        bottom:8px;
        width:58px;
        height:14px;
        border-radius:999px;
        background:linear-gradient(180deg,#38bdf8,#2563eb);
      }
      .low-hurdle::before,.low-hurdle::after{
        content:"";
        position:absolute;
        top:8px;
        width:8px;
        height:18px;
        background:#93c5fd;
        border-radius:4px;
      }
      .low-hurdle::before{ left:10px; }
      .low-hurdle::after{ right:10px; }

      .low-box{
        bottom:8px;
        width:50px;
        height:30px;
        border-radius:12px;
        background:linear-gradient(180deg,#60a5fa,#2563eb);
      }

      .low-tyre{
        bottom:2px;
        width:52px;
        height:52px;
        border-radius:50%;
        background:radial-gradient(circle at 50% 50%, #0f172a 28%, #475569 29%, #1e293b 58%, #94a3b8 60%, #0f172a 62%);
      }

      .low-bench{
        bottom:14px;
        width:60px;
        height:14px;
        border-radius:8px;
        background:linear-gradient(180deg,#22d3ee,#0891b2);
      }
      .low-bench::before,.low-bench::after{
        content:"";
        position:absolute;
        top:12px;
        width:8px;
        height:16px;
        background:#67e8f9;
        border-radius:4px;
      }
      .low-bench::before{ left:10px; }
      .low-bench::after{ right:10px; }

      .low-cones{
        bottom:8px;
        width:58px;
        height:22px;
      }
      .low-cones::before,.low-cones::after{
        content:"";
        position:absolute;
        bottom:0;
        width:16px;
        height:22px;
        clip-path:polygon(50% 0%, 100% 100%, 0% 100%);
        background:linear-gradient(180deg,#67e8f9,#06b6d4);
      }
      .low-cones::before{ left:6px; }
      .low-cones::after{ right:6px; }

      .low-heavy{
        bottom:4px;
        width:64px;
        height:40px;
        border-radius:14px;
        background:linear-gradient(180deg,#1d4ed8,#1e3a8a);
        box-shadow:inset 0 0 0 3px rgba(191,219,254,.25);
      }
      .low-heavy::before{
        content:"";
        position:absolute;
        left:8px;
        right:8px;
        bottom:8px;
        height:8px;
        border-radius:999px;
        background:rgba(255,255,255,.18);
      }

      .low-mini{
        bottom:16px;
        width:32px;
        height:18px;
        border-radius:999px;
        background:linear-gradient(180deg,#67e8f9,#06b6d4);
      }

      .high-bar{
        top:10px;
        width:62px;
        height:14px;
        border-radius:999px;
        background:linear-gradient(180deg,#f59e0b,#ef4444);
      }
      .high-bar::before,.high-bar::after{
        content:"";
        position:absolute;
        top:10px;
        width:8px;
        height:22px;
        border-radius:999px;
        background:#fdba74;
      }
      .high-bar::before{ left:8px; }
      .high-bar::after{ right:8px; }

      .high-ribbon{
        top:14px;
        width:66px;
        height:10px;
        border-radius:999px;
        background:linear-gradient(90deg,#fb7185,#ef4444,#fb7185);
      }

      .high-ball{
        top:8px;
        width:34px;
        height:34px;
        border-radius:50%;
        background:radial-gradient(circle at 35% 35%, #fde68a, #f59e0b 55%, #b45309 100%);
      }
      .high-ball::after{
        content:"";
        position:absolute;
        left:50%;
        top:30px;
        transform:translateX(-50%);
        width:42px;
        height:8px;
        border-radius:999px;
        background:linear-gradient(90deg,#f59e0b,#ef4444);
      }

      .high-beam{
        top:12px;
        width:68px;
        height:16px;
        border-radius:8px;
        background:linear-gradient(180deg,#fb7185,#dc2626);
      }

      .high-tape{
        top:20px;
        width:64px;
        height:8px;
        border-radius:999px;
        background:linear-gradient(90deg,#fda4af,#ef4444,#fda4af);
        box-shadow:0 0 0 6px rgba(239,68,68,.06);
      }

      .high-heavy{
        top:8px;
        width:70px;
        height:22px;
        border-radius:10px;
        background:linear-gradient(180deg,#dc2626,#7f1d1d);
        box-shadow:inset 0 0 0 3px rgba(254,202,202,.22);
      }
      .high-heavy::before,
      .high-heavy::after{
        content:"";
        position:absolute;
        top:14px;
        width:8px;
        height:18px;
        border-radius:999px;
        background:#fca5a5;
      }
      .high-heavy::before{ left:10px; }
      .high-heavy::after{ right:10px; }

      .high-mini{
        top:20px;
        width:34px;
        height:10px;
        border-radius:999px;
        background:linear-gradient(90deg,#fda4af,#ef4444,#fda4af);
      }
    `;
    document.head.appendChild(css);
  }

  function clearRunTimers(s) {
    if (!s) return;
    if (s.judgeTimer) { clearTimeout(s.judgeTimer); s.judgeTimer = 0; }
    if (s.teleTimer) { clearTimeout(s.teleTimer); s.teleTimer = 0; }
    if (s.bossIntroTimer) { clearTimeout(s.bossIntroTimer); s.bossIntroTimer = 0; }
    if (s.avatarResetTimer) { clearTimeout(s.avatarResetTimer); s.avatarResetTimer = 0; }
  }

  function stopLoop() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
  }

  function resetTransientUI() {
    judgeEl?.classList.remove('show');

    if (tele) {
      tele.classList.remove('on');
      tele.classList.add('hidden');
    }

    if (bossIntro) {
      bossIntro.classList.remove('on');
      bossIntro.classList.add('hidden');
    }

    rushBanner?.classList.add('hidden');

    if (playRoot) {
      playRoot.classList.remove('phase-1', 'phase-2', 'phase-3', 'final-rush', 'boss-frenzy');
      playRoot.classList.remove('fx-good', 'fx-perfect', 'fx-miss', 'fx-fever', 'fx-bosshit');
    }
  }

  function resetPlayHUD() {
    if (hudMode) hudMode.textContent = 'training';
    if (hudDiff) hudDiff.textContent = 'normal';
    if (hudTime) hudTime.textContent = '60.0';
    if (hudPhase) hudPhase.textContent = '1 • warmup';
    if (hudScore) hudScore.textContent = '0';
    if (hudCombo) hudCombo.textContent = '0';
    if (hudStability) hudStability.textContent = '100%';
    if (hudBoss) hudBoss.textContent = '—';
    if (hudPattern) hudPattern.textContent = '—';
    if (hudRush) hudRush.textContent = '—';
    if (hudBossLabel) hudBossLabel.textContent = '—';
    if (hudBossStatus) hudBossStatus.textContent = '—';
    if (hudBossCompact) hudBossCompact.textContent = '—';
    if (progFill) progFill.style.width = '0%';
    if (progText) progText.textContent = '0%';
    if (feverFill) feverFill.style.width = '0%';
    if (feverStatus) feverStatus.textContent = 'Ready';
    if (bossBarWrap) bossBarWrap.classList.add('hidden');
    if (bossFill) bossFill.style.width = '0%';
    if (bossStatusRight) bossStatusRight.textContent = '—';
  }

  function resetResultHUD() {
    if (rankBadge) {
      rankBadge.textContent = 'C';
      rankBadge.classList.remove('rank-s', 'rank-a', 'rank-b', 'rank-c', 'rank-d');
      rankBadge.classList.add('rank-c');
    }

    if (resultTitle) resultTitle.textContent = 'ผ่านด่านฝึกแล้ว!';
    if (resultSub) resultSub.textContent = 'สรุปรอบล่าสุดของ JumpDuck';
    if (resultBoss) resultBoss.textContent = '—';
    if (resultPattern) resultPattern.textContent = '—';
    if (resultRush) resultRush.textContent = '—';
    if (resultReward) resultReward.textContent = 'Keep Training';
    if (resultRewardIcon) resultRewardIcon.textContent = '⭐';
    if (resultRewardSub) resultRewardSub.textContent = 'ฝึกต่ออีกนิด แล้วรอบหน้าจะดีกว่าเดิม';

    if (coachTitle) coachTitle.textContent = 'AI Coach';
    if (coachSummary) coachSummary.textContent = 'สรุปคำแนะนำหลังจบเกม';
    if (coachTip1) coachTip1.textContent = '—';
    if (coachTip2) coachTip2.textContent = '—';

    if (resMode) resMode.textContent = '-';
    if (resDiff) resDiff.textContent = '-';
    if (resDuration) resDuration.textContent = '-';
    if (resTotalObs) resTotalObs.textContent = '0';
    if (resHits) resHits.textContent = '0';
    if (resMiss) resMiss.textContent = '0';
    if (resJumpHit) resJumpHit.textContent = '0';
    if (resDuckHit) resDuckHit.textContent = '0';
    if (resJumpMiss) resJumpMiss.textContent = '0';
    if (resDuckMiss) resDuckMiss.textContent = '0';
    if (resAcc) resAcc.textContent = '0%';
    if (resRTMean) resRTMean.textContent = '0';
    if (resStabilityMin) resStabilityMin.textContent = '0%';
    if (resScore) resScore.textContent = '0';
    if (resRank) resRank.textContent = 'C';
    if (resScoreBig) resScoreBig.textContent = '0';
    if (resAccBig) resAccBig.textContent = '0%';
    if (resComboBig) resComboBig.textContent = '0';
    if (resBossEndBig) resBossEndBig.textContent = '—';
    if (resPhaseEnd) resPhaseEnd.textContent = '-';
    if (resPattern) resPattern.textContent = '-';
    if (resBossLabel) resBossLabel.textContent = '-';
    if (resRush) resRush.textContent = '-';

    if (logStatus) {
      logStatus.textContent = '';
      logStatus.style.color = '';
    }
  }

  function clearArena() {
    if (obsLayer) obsLayer.innerHTML = '';
    document.querySelectorAll('.jd-score-pop').forEach(el => el.remove());

    if (avatar) {
      avatar.classList.remove('avatar-jump', 'avatar-duck');
      avatar.classList.add('avatar-idle');
    }
  }

  function hardResetBeforeRun() {
    stopLoop();
    clearRunTimers(state);
    resetTransientUI();
    clearArena();
    resetPlayHUD();
  }

  function canFinishRun(s) {
    if (!s) return false;
    if (s.finishing) return false;
    if (s.finished) return false;
    return true;
  }

  function jdGetProgress(s) {
    if (!s || !s.duration) return 0;
    return jdClamp(s.elapsed / s.duration, 0, 1);
  }

  function jdPhaseByProgress(progress) {
    if (progress < 0.34) return 1;
    if (progress < 0.72) return 2;
    return 3;
  }

  function jdGetArenaMetrics() {
    const w = Math.max(320, playRoot?.clientWidth || arena?.clientWidth || window.innerWidth || 360);

    let profile = 'desktop';
    if (w <= 430) profile = 'tiny';
    else if (w <= 820) profile = 'compact';
    else profile = 'desktop';

    let hitLineX;
    let avatarLeftPct;

    if (profile === 'tiny') {
      hitLineX = 86;
      avatarLeftPct = 0.088;
    } else if (profile === 'compact') {
      hitLineX = 102;
      avatarLeftPct = 0.108;
    } else {
      hitLineX = 144;
      avatarLeftPct = 0.135;
    }

    return {
      width: w,
      profile,
      hitLineX,
      avatarLeftPct
    };
  }

  function jdTuneKeyByPhase(s) {
    const mode = String(HHA_CTX.phaseTune || 'dynamicABC').toLowerCase();

    if (mode === 'fixeda') return 'A';
    if (mode === 'fixedb') return 'B';
    if (mode === 'fixedc') return 'C';

    if (!s) return 'A';
    if (s.finalRush) return 'CPLUS';
    if (s.phase === 1) return 'A';
    if (s.phase === 2) return 'B';
    return 'C';
  }

  function jdGetTuningForState(s) {
    const profile = s?.layoutProfile || 'desktop';
    const key = jdTuneKeyByPhase(s);
    const preset = JD_TUNING_PRESETS[key] || JD_TUNING_PRESETS.B;

    return {
      key,
      startX: Math.round((s?.arenaWidth || playRoot?.clientWidth || 360) * (preset.startXMul[profile] || 0.8)),
      gapBase: preset.gapBase[profile],
      speedBase: preset.speedBase[profile],
      hitHalfWindow: preset.hitHalfWindow[profile]
    };
  }

  function jdApplyResponsiveLayout(s) {
    if (!s) return;

    const m = jdGetArenaMetrics();
    s.layoutProfile = m.profile;
    s.arenaWidth = m.width;
    s.hitLineX = m.hitLineX;

    const hitline = document.getElementById('jd-hitline');
    if (hitline) hitline.style.left = `${m.hitLineX}px`;

    if (avatar) {
      avatar.style.left = `${Math.round(m.avatarLeftPct * 1000) / 10}%`;
    }

    const tune = jdGetTuningForState(s);
    s.tuneKey = tune.key;
    s.startXBase = tune.startX;
    s.gapBase = tune.gapBase;
    s.hitHalfWindow = tune.hitHalfWindow;

    if (!s.userBaseSpeedLocked) {
      s.baseSpeed = tune.speedBase;
    }
  }

  function jdPatternToSeq(pattern, rng = Math.random) {
    switch (pattern) {
      case 'single':
        return [rng() < 0.5 ? 'low' : 'high'];

      case 'alt2': {
        const a = rng() < 0.5 ? 'low' : 'high';
        const b = a === 'low' ? 'high' : 'low';
        return [a, b];
      }

      case 'alt4': {
        const a = rng() < 0.5 ? 'low' : 'high';
        const b = a === 'low' ? 'high' : 'low';
        return [a, b, a, b];
      }

      case 'pair': {
        const a = rng() < 0.5 ? 'low' : 'high';
        return [a, a];
      }

      case 'zigzag3': {
        const a = rng() < 0.5 ? 'low' : 'high';
        const b = a === 'low' ? 'high' : 'low';
        return [a, b, a];
      }

      case 'mirror4': {
        const a = rng() < 0.5 ? 'low' : 'high';
        const b = a === 'low' ? 'high' : 'low';
        return [a, b, b, a];
      }

      case 'burst4':
        return ['low', 'high', 'low', 'high'];

      case 'burst5':
        return ['low', 'high', 'low', 'high', 'low'];

      case 'double-low-high':
        return ['low', 'low', 'high'];

      case 'double-high-low':
        return ['high', 'high', 'low'];

      case 'feint2':
        return [rng() < 0.5 ? 'low' : 'high', rng() < 0.5 ? 'low' : 'high'];

      case 'feint3':
        return [
          rng() < 0.5 ? 'low' : 'high',
          rng() < 0.5 ? 'low' : 'high',
          rng() < 0.5 ? 'low' : 'high'
        ];

      case 'tempo221':
        return ['low', 'low', 'high', 'high', 'low'];

      case 'tempo121':
        return ['low', 'high', 'high', 'low'];

      case 'tempoAlt6':
        return ['low', 'high', 'low', 'high', 'low', 'high'];

      case 'feintLate2':
        return ['low', 'high'];

      case 'feintLate3':
        return ['high', 'low', 'high'];

      case 'fakePair':
        return ['low', 'low'];

      case 'shieldPair':
        return ['low', 'low', 'high', 'high'];

      case 'shieldWall':
        return ['low', 'high', 'low', 'high'];

      case 'shieldBreaker':
        return ['high', 'high', 'low', 'low', 'high'];

      case 'mirrorABBA':
        return ['low', 'high', 'high', 'low'];

      case 'mirrorBAAB':
        return ['high', 'low', 'low', 'high'];

      case 'mirrorEcho':
        return ['low', 'high', 'low', 'high', 'high', 'low'];

      case 'chaosBurst5':
        return ['low', 'high', 'low', 'high', 'high'];

      case 'chaosBurst6':
        return ['low', 'high', 'low', 'high', 'low', 'high'];

      case 'chaosLadder':
        return ['low', 'low', 'high', 'low', 'high', 'high'];

      default:
        return [rng() < 0.5 ? 'low' : 'high'];
    }
  }

  function jdPatternSpacingStyle(pattern) {
    if (['tempo221', 'tempo121', 'tempoAlt6'].includes(pattern)) return 'tempo';
    if (['feintLate2', 'feintLate3', 'fakePair', 'feint2', 'feint3'].includes(pattern)) return 'feint';
    if (['shieldPair', 'shieldWall', 'shieldBreaker'].includes(pattern)) return 'shield';
    if (['mirrorABBA', 'mirrorBAAB', 'mirrorEcho', 'mirror4'].includes(pattern)) return 'mirror';
    if (['chaosBurst5', 'chaosBurst6', 'chaosLadder', 'burst4', 'burst5'].includes(pattern)) return 'chaos';
    return 'default';
  }

  function jdRushStageByProgress(progress, compact) {
    const warnStart = compact ? 0.86 : 0.84;
    const peakStart = compact ? 0.91 : 0.90;
    const surviveStart = compact ? 0.97 : 0.965;

    if (progress >= surviveStart) return 'survive';
    if (progress >= peakStart) return 'peak';
    if (progress >= warnStart) return 'warning';
    return '';
  }

  function jdObstacleBehaviorByVisualKey(key) {
    const k = String(key || '');

    if (k.endsWith('-heavy')) {
      return {
        variant: 'heavy',
        speedMul: 0.90,
        bonusScore: 4,
        judgeBiasMs: -8
      };
    }

    if (k.endsWith('-mini')) {
      return {
        variant: 'mini',
        speedMul: 1.18,
        bonusScore: 3,
        judgeBiasMs: 10
      };
    }

    return {
      variant: 'normal',
      speedMul: 1.00,
      bonusScore: 0,
      judgeBiasMs: 0
    };
  }

  function jdPatternTag(pattern) {
    if (pattern.includes('tempo')) return 'tempo';
    if (pattern.includes('feint') || pattern === 'fakePair') return 'feint';
    if (pattern.includes('shield')) return 'shield';
    if (pattern.includes('mirror')) return 'mirror';
    if (pattern.includes('chaos')) return 'chaos';
    return 'default';
  }

  function jdCreateObstacle(s, opts) {
    const {
      type = 'low',
      x = 100,
      isBoss = false,
      feint = false,
      phase = 1,
      visualKey = ''
    } = opts || {};

    const pool = type === 'low' ? JD_VISUALS.low : JD_VISUALS.high;
    const visual = visualKey
      ? (pool.find(v => v.key === visualKey) || pool[0])
      : jdPick(pool, s.rng);

    const behavior = jdObstacleBehaviorByVisualKey(visual.key);

    const el = document.createElement('div');
    el.className = `jd-obstacle ${type} variant-${behavior.variant} ${isBoss ? 'boss' : ''} ${feint ? 'feint' : ''}`.trim();

    const shape = document.createElement('div');
    shape.className = `jd-shape ${visual.cls}`;

    const tag = document.createElement('div');
    tag.className = 'tag';
    tag.textContent = visual.label;

    el.appendChild(shape);
    el.appendChild(tag);

    return {
      id: 'obs-' + (s.nextObsId++),
      type,
      need: type === 'low' ? 'jump' : 'duck',
      visualKey: visual.key,
      phase,
      x,
      speed: s.currentSpeed,
      isBoss,
      feint,
      flipAtX: feint ? 36 + Math.floor(s.rng() * 8) : null,
      flipped: false,
      resolved: false,
      spawnedAt: performance.now(),
      el,

      variant: behavior.variant,
      speedMul: behavior.speedMul,
      bonusScore: behavior.bonusScore,
      judgeBiasMs: behavior.judgeBiasMs
    };
  }

  function jdPickVisualKey(s, type) {
    const rng = s.rng || Math.random;
    const pool = type === 'low' ? JD_VISUALS.low : JD_VISUALS.high;
    if (!pool || !pool.length) return '';

    const bossKey = s.bossProfile?.key || '';
    const isPhase3 = s.phase === 3;
    const inRush = !!s.rushStage;

    if (s.phase === 1) {
      if (type === 'low') {
        const easy = pool.filter(v => ['low-hurdle', 'low-box', 'low-cones'].includes(v.key));
        return (easy[Math.floor(rng() * easy.length)] || pool[0]).key;
      } else {
        const easy = pool.filter(v => ['high-bar', 'high-ribbon', 'high-tape'].includes(v.key));
        return (easy[Math.floor(rng() * easy.length)] || pool[0]).key;
      }
    }

    if (bossKey === 'shield' && rng() < 0.35) {
      return type === 'low' ? 'low-heavy' : 'high-heavy';
    }

    if ((bossKey === 'chaos' || inRush) && rng() < 0.28) {
      return type === 'low' ? 'low-mini' : 'high-mini';
    }

    if (isPhase3 && rng() < 0.12) {
      return type === 'low' ? 'low-heavy' : 'high-heavy';
    }

    if (isPhase3 && rng() < 0.16) {
      return type === 'low' ? 'low-mini' : 'high-mini';
    }

    if (s.phase === 2) {
      if (type === 'low') {
        const mid = pool.filter(v => ['low-hurdle', 'low-box', 'low-bench', 'low-cones', 'low-mini'].includes(v.key));
        return (mid[Math.floor(rng() * mid.length)] || pool[0]).key;
      } else {
        const mid = pool.filter(v => ['high-bar', 'high-ribbon', 'high-beam', 'high-tape', 'high-mini'].includes(v.key));
        return (mid[Math.floor(rng() * mid.length)] || pool[0]).key;
      }
    }

    return pool[Math.floor(rng() * pool.length)].key;
  }

  function jdWaveGap(s, indexInSeq, seqLength) {
    const rng = s.rng || Math.random;
    const compact = s.layoutProfile === 'compact' || s.layoutProfile === 'tiny';

    let baseGap = Number(s.gapBase || (compact ? 160 : 136));
    const style = jdPatternSpacingStyle(s.lastPattern || '');

    if (style === 'tempo') {
      const unit = compact ? 118 : 96;
      return unit + (indexInSeq % 2 === 0 ? 0 : 6);
    }

    if (style === 'mirror') {
      const mirrorSetsCompact = [126, 144, 144, 126, 138, 138];
      const mirrorSetsDesktop = [98, 124, 124, 98, 118, 118];
      const arr = compact ? mirrorSetsCompact : mirrorSetsDesktop;
      return arr[indexInSeq] ?? arr[arr.length - 1];
    }

    if (style === 'shield') {
      const shieldGap = compact ? 116 : 92;
      return shieldGap + (seqLength >= 5 ? 2 : 0);
    }

    if (style === 'chaos') {
      const compactChaos = [128, 116, 104, 96, 88, 84, 82];
      const desktopChaos = [104, 96, 88, 80, 74, 70, 68];
      const arr = compact ? compactChaos : desktopChaos;
      return arr[indexInSeq] ?? (compact ? 82 : 68);
    }

    if (style === 'feint') {
      const compactFeint = [134, 118, 96, 88, 84];
      const desktopFeint = [108, 98, 84, 78, 72];
      const arr = compact ? compactFeint : desktopFeint;
      return arr[indexInSeq] ?? (compact ? 88 : 72);
    }

    if (s.finalRush) baseGap -= 4;
    if (s.bossActive) baseGap -= 3;
    if (s.bossFrenzy) baseGap -= 4;

    if (seqLength >= 4) baseGap -= 4;
    if (seqLength >= 5) baseGap -= 2;

    const jitter = compact ? (12 + Math.floor(rng() * 12)) : (8 + Math.floor(rng() * 10));
    return Math.max(compact ? 108 : 82, baseGap + (indexInSeq * 2) + jitter);
  }

  function jdFeintChance(s) {
    const compact = s.layoutProfile === 'compact' || s.layoutProfile === 'tiny';

    if (s.bossActive && s.bossProfile) {
      const base = Number(s.bossProfile.feintChance || 0);
      return compact ? base * 0.72 : base;
    }

    if (s.phase === 1) return 0;
    if (s.phase === 2) return compact ? 0.01 : 0.02;
    if (s.phase === 3) {
      return s.finalRush ? (compact ? 0.035 : 0.05) : (compact ? 0.028 : 0.04);
    }

    return 0;
  }

  function jdApplyObstacleLane(s, obs) {
    if (!s || !obs?.el) return;

    const compact = s.layoutProfile === 'compact' || s.layoutProfile === 'tiny';
    const groundBottom = compact ? 104 : 86;

    let bottomPx = groundBottom - 4;

    if (obs.type === 'low') {
      if (obs.variant === 'heavy') {
        bottomPx = groundBottom - 8;
      } else if (obs.variant === 'mini') {
        bottomPx = groundBottom + 2;
      } else {
        bottomPx = groundBottom - 4;
      }
    } else {
      if (obs.variant === 'heavy') {
        bottomPx = groundBottom + (compact ? 130 : 118);
      } else if (obs.variant === 'mini') {
        bottomPx = groundBottom + (compact ? 116 : 108);
      } else {
        bottomPx = groundBottom + (compact ? 122 : 110);
      }
    }

    obs.el.style.bottom = `${bottomPx}px`;
  }

  function jdObstaclePopY(obs) {
    const fieldH = state?.arena?.offsetHeight || 420;
    const fallbackCompact = state?.layoutProfile === 'compact' || state?.layoutProfile === 'tiny';

    if (!obs?.el) {
      return fallbackCompact ? 170 : 180;
    }

    const bottom = parseFloat(obs.el.style.bottom || (obs.type === 'low' ? '100' : '220'));
    const h = obs.el.offsetHeight || (obs.variant === 'mini' ? 58 : (obs.variant === 'heavy' ? 82 : 74));

    return Math.max(72, fieldH - bottom - h - 12);
  }

  function jdPatternTagFromPool(pattern) {
    return jdPatternTag(pattern);
  }

  function jdDirectorPushEvent(s, kind) {
    if (!s) return;
    s.recentWindow = Array.isArray(s.recentWindow) ? s.recentWindow : [];
    s.recentWindow.push({
      kind,
      t: performance.now()
    });
    if (s.recentWindow.length > 12) s.recentWindow.shift();
  }

  function jdLogEvent(s, type, payload = {}) {
    if (!s) return;

    const row = {
      sessionId: s.sessionId,
      pid: s.pid,
      t_ms: Math.round(performance.now() - s.startedAt),
      eventType: type,

      mode: s.mode,
      diff: s.diff,
      phase: s.phase,
      phaseLabel: s.phaseLabel || '',
      progress: Number((s.progress || 0).toFixed(4)),
      rushStage: s.rushStage || '',
      finalRush: !!s.finalRush,

      bossKey: s.bossProfile?.key || '',
      bossLabel: s.bossProfile?.label || '',
      bossHp: Number(s.bossHp || 0),
      bossPhase2: !!s.bossPhase2,
      bossFrenzy: !!s.bossFrenzy,

      score: Number(s.score || 0),
      combo: Number(s.combo || 0),
      maxCombo: Number(s.maxCombo || 0),
      stability: Number(s.stability || 0),
      fever: Number(s.fever || 0),
      feverActive: !!s.feverActive,

      assistLevel: Number(s.assistLevel || 0),
      pressureLevel: Number(s.pressureLevel || 0),
      directorReason: s.lastDirectorReason || '',
      tuneKey: s.tuneKey || '',

      ...payload
    };

    s.eventLog.push(row);
  }

  function jdDirectorEvaluate(s) {
    if (!s || !s.directorEnabled) return;

    if (s.directorDeterministic) {
      s.assistLevel = 0;
      s.pressureLevel = 0;
      s.lastDirectorReason = 'deterministic';
      return;
    }

    const missStreak = Number(s.missStreak || 0);
    const combo = Number(s.combo || 0);
    const stability = Number(s.stability || 100);
    const jumpMiss = Number(s.jumpMiss || 0);
    const duckMiss = Number(s.duckMiss || 0);

    let assist = 0;
    let pressure = 0;
    let reason = 'neutral';

    if (missStreak >= JD_DIRECTOR_CONFIG.missStreakHard || stability <= 34) {
      assist = 2;
      pressure = 0;
      reason = 'player_overloaded';
    } else if (missStreak >= JD_DIRECTOR_CONFIG.missStreakSoft || stability <= 52) {
      assist = 1;
      pressure = 0;
      reason = 'player_struggling';
    } else if (combo >= JD_DIRECTOR_CONFIG.comboBoost2 && stability >= 72) {
      assist = 0;
      pressure = 2;
      reason = 'player_excelling';
    } else if (combo >= JD_DIRECTOR_CONFIG.comboBoost1 && stability >= 60) {
      assist = 0;
      pressure = 1;
      reason = 'player_confident';
    }

    if (Math.abs(jumpMiss - duckMiss) >= 3 && assist < 2) {
      assist = Math.min(assist + 1, JD_DIRECTOR_CONFIG.maxAssistLevel);
      reason = 'action_imbalance_support';
    }

    s.assistLevel = Math.min(assist, JD_DIRECTOR_CONFIG.maxAssistLevel);
    s.pressureLevel = Math.min(pressure, JD_DIRECTOR_CONFIG.maxPressureLevel);
    s.lastDirectorReason = reason;
    s.lastDirectorAt = performance.now();
  }

  function jdDirectorAdjustPool(s, pool) {
    if (!s || !Array.isArray(pool)) return pool || [];
    if (s.directorDeterministic) return pool;

    let out = [...pool];

    if (s.assistLevel >= 2) {
      out = out.filter(p => ![
        'feint3', 'feintLate3', 'chaosBurst6', 'tempoAlt6', 'mirrorEcho'
      ].includes(p));
      out.push('single', 'alt2', 'pair');
    } else if (s.assistLevel === 1) {
      out = out.filter(p => ![
        'chaosBurst6', 'tempoAlt6'
      ].includes(p));
      out.push('alt2', 'zigzag3');
    }

    if (s.pressureLevel >= 2) {
      out.push('burst4', 'mirror4', 'tempo221', 'chaosBurst5');
    } else if (s.pressureLevel === 1) {
      out.push('pair', 'double-low-high', 'double-high-low');
    }

    return out;
  }

  function jdDirectorAdjustPacing(s, pacing) {
    if (!s || !pacing) return pacing;
    if (s.directorDeterministic) return pacing;

    let { speed, spawnMs, hitHalfWindow } = pacing;

    if (s.assistLevel === 2) {
      speed *= 0.94;
      spawnMs *= 1.10;
      hitHalfWindow += 3;
    } else if (s.assistLevel === 1) {
      speed *= 0.97;
      spawnMs *= 1.05;
      hitHalfWindow += 2;
    }

    if (s.pressureLevel === 2) {
      speed *= 1.05;
      spawnMs *= 0.94;
      hitHalfWindow -= 1;
    } else if (s.pressureLevel === 1) {
      speed *= 1.02;
      spawnMs *= 0.97;
    }

    return {
      speed,
      spawnMs,
      hitHalfWindow
    };
  }

  function jdPickPattern(s) {
    const rng = s.rng || Math.random;
    const compact = s.layoutProfile === 'compact' || s.layoutProfile === 'tiny';
    const rushStage = s.rushStage || '';

    if (s.bossActive && s.bossProfile) {
      let pool = Array.isArray(s.bossProfile.patterns) ? [...s.bossProfile.patterns] : ['alt2'];

      if (rushStage === 'warning') {
        pool.push('pair', 'zigzag3');
      } else if (rushStage === 'peak') {
        pool.push('burst4', 'mirror4', 'tempo221');
      } else if (rushStage === 'survive') {
        if (s.bossProfile.key === 'tempo') {
          pool = ['tempo121', 'tempo221', 'tempoAlt6', 'alt4'];
        } else if (s.bossProfile.key === 'feint') {
          pool = compact
            ? ['feintLate2', 'fakePair', 'alt2']
            : ['feintLate2', 'feintLate3', 'fakePair', 'alt2'];
        } else if (s.bossProfile.key === 'shield') {
          pool = ['shieldPair', 'shieldWall', 'shieldBreaker', 'pair'];
        } else if (s.bossProfile.key === 'mirror') {
          pool = ['mirrorABBA', 'mirrorBAAB', 'mirrorEcho', 'mirror4'];
        } else if (s.bossProfile.key === 'chaos') {
          pool = compact
            ? ['chaosBurst5', 'burst4', 'zigzag3']
            : ['chaosBurst5', 'chaosBurst6', 'chaosLadder', 'burst4'];
        }
      }

      pool = jdDirectorAdjustPool(s, pool);
      return pool[Math.floor(rng() * pool.length)];
    }

    const phaseCfg = JD_PHASE_TABLE[s.phase] || JD_PHASE_TABLE[1];
    let pool = Array.isArray(phaseCfg.patterns) ? [...phaseCfg.patterns] : ['single'];

    if (s.mode === 'training' && s.phase === 1) {
      pool = pool.filter(p => !['burst4', 'burst5', 'mirror4'].includes(p));
    }

    if (rushStage === 'warning') {
      pool = ['alt2', 'pair', 'zigzag3', 'double-low-high'];
    } else if (rushStage === 'peak') {
      pool = ['burst4', 'mirror4', 'tempo221', 'double-high-low', 'shieldPair'];
    } else if (rushStage === 'survive') {
      pool = compact
        ? ['tempo121', 'mirrorABBA', 'shieldPair', 'burst4']
        : ['tempo121', 'mirrorABBA', 'shieldPair', 'chaosBurst5', 'double-low-high'];
    } else if (s.finalRush) {
      pool.push('burst4', 'mirror4');
    }

    pool = jdDirectorAdjustPool(s, pool);
    return pool[Math.floor(rng() * pool.length)];
  }

  function jdSpawnWave(s) {
    if (!s || !s.arena) return;
    if (!s.running) return;

    const rng = s.rng || Math.random;
    const pattern = jdPickPattern(s);
    const seq = jdPatternToSeq(pattern, rng);

    const startX = Number(s.startXBase || 300);
    const feintChance = jdFeintChance(s);

    s.lastPattern = pattern;

    let cursorX = startX;

    seq.forEach((type, index) => {
      let isFeint = false;

      if (['feint2', 'feint3', 'feintLate2', 'feintLate3'].includes(pattern)) {
        isFeint = (index === seq.length - 1);
      } else if (pattern === 'fakePair') {
        isFeint = (index === 1);
      } else if (index === seq.length - 1 && rng() < feintChance) {
        isFeint = true;
      }

      const visualKey = jdPickVisualKey(s, type);

      const obs = jdCreateObstacle(s, {
        type,
        x: cursorX,
        phase: s.phase,
        isBoss: !!s.bossActive,
        feint: isFeint,
        visualKey
      });

      obs.speed = s.currentSpeed;

      if (['feintLate2', 'feintLate3', 'fakePair'].includes(pattern) && obs.feint) {
        obs.flipAtX = (s.hitLineX || 120) + (s.layoutProfile === 'tiny' ? 16 : 12);
      }

      jdApplyObstacleLane(s, obs);

      if (obs.type === 'low') s.spawnCountLow += 1;
      if (obs.type === 'high') s.spawnCountHigh += 1;
      if (obs.variant === 'heavy') s.spawnCountHeavy += 1;
      if (obs.variant === 'mini') s.spawnCountMini += 1;
      if (obs.feint) s.spawnCountFeint += 1;

      jdLogEvent(s, 'spawn', {
        obstacleId: obs.id,
        obstacleNeed: obs.need,
        obstacleType: obs.type,
        obstacleVariant: obs.variant || 'normal',
        obstacleVisual: obs.visualKey || '',
        obstacleFeint: !!obs.feint,
        pattern: pattern,
        patternTag: jdPatternTagFromPool(pattern),
        spawnX: Number(obs.x || 0),
        obstacleSpeed: Number(obs.speed || 0)
      });

      s.obstacles.push(obs);
      s.arena.appendChild(obs.el);
      s.totalObstacles = Number(s.totalObstacles || 0) + 1;

      cursorX += jdWaveGap(s, index, seq.length);
    });

    if (hudPattern) {
      const need = seq[0] === 'low' ? 'LOW / JUMP' : 'HIGH / DUCK';
      hudPattern.textContent = need;
    }
  }

  function jdStartBoss(s) {
    const keys = Object.keys(JD_BOSS_PROFILES);
    const key = keys[Math.floor(s.rng() * keys.length)];
    const boss = JD_BOSS_PROFILES[key];

    s.bossActive = true;
    s.bossHp = 100;
    s.bossProfile = boss;
    s.bossStartedAt = performance.now();
    s.nextBossBurstAt = performance.now() + 900;

    if (hudBossLabel) hudBossLabel.textContent = `${boss.icon} ${boss.label}`;
    if (hudBossStatus) hudBossStatus.textContent = boss.intro;
    if (bossStatusRight) bossStatusRight.textContent = 'BOSS START';
    if (bossBarWrap) bossBarWrap.classList.remove('hidden');

    jdShowBossIntro(`${boss.icon} ${boss.label} • ${boss.intro}`);
    jdTelegraph(`${boss.icon} ${boss.label}`, 850);
    jdShowJudge(`${boss.icon} ${boss.label}`);

    jdLogEvent(s, 'boss_start', {
      bossKey: boss.key,
      bossLabel: boss.label
    });
  }

  function jdMaybeBossBurst(s, now) {
    if (!s || !s.bossActive || !s.bossProfile) return;
    if (now < s.nextBossBurstAt) return;

    const compact = s.layoutProfile === 'compact' || s.layoutProfile === 'tiny';

    jdSpawnWave(s);

    let nextMs = Number(s.bossProfile.burstEveryMs || 4200);

    if (s.bossProfile.key === 'chaos') {
      nextMs *= compact ? 0.97 : 0.92;
    }

    if (s.bossFrenzy) {
      nextMs *= compact ? 0.86 : 0.76;
    }

    if (s.finalRush) {
      nextMs *= compact ? 0.95 : 0.90;
    }

    s.nextBossBurstAt = now + Math.max(compact ? 1320 : 1050, Math.round(nextMs));
  }

  function jdJudgeTiming(inputAgeMs, s) {
    const compact = s.layoutProfile === 'compact' || s.layoutProfile === 'tiny';

    let perfectWindow = compact ? 114 : 105;
    let goodWindow = compact ? 210 : 195;

    if (s.diff === 'easy') {
      perfectWindow = compact ? 126 : 118;
      goodWindow = compact ? 232 : 220;
    } else if (s.diff === 'hard') {
      perfectWindow = compact ? 100 : 92;
      goodWindow = compact ? 182 : 172;
    }

    if (s.finalRush) {
      perfectWindow -= compact ? 4 : 6;
      goodWindow -= compact ? 5 : 8;
    }

    if (s.bossActive) {
      perfectWindow -= compact ? 3 : 4;
      goodWindow -= compact ? 4 : 6;
    }

    if (inputAgeMs <= perfectWindow) return 'perfect';
    if (inputAgeMs <= goodWindow) return 'good';
    return 'late';
  }

  function jdBossDamageFromJudge(judge, s) {
    let dmg = 0;
    if (judge === 'perfect') dmg = 8;
    else if (judge === 'good') dmg = 5;
    if (s.feverActive) dmg += 2;
    if (s.bossFrenzy) dmg += 1;
    return dmg;
  }

  function jdScoreGainFromJudge(judge, s, obs = null) {
    let base = 0;
    if (judge === 'perfect') base = 20;
    else if (judge === 'good') base = 12;
    else base = 0;

    const comboBonus = Math.min(14, Math.floor((s.combo || 0) * 0.9));
    let gain = base + comboBonus;

    if (s.phase === 2) gain += 1;
    if (s.phase === 3) gain += 3;
    if (s.finalRush) gain += 3;
    if (s.feverActive) gain += 5;
    if (s.bossActive) gain += 2;

    if (obs?.variant === 'heavy') gain += 4;
    if (obs?.variant === 'mini') gain += 3;
    if (obs?.bonusScore) gain += Number(obs.bonusScore || 0);

    return Math.max(0, Math.round(gain));
  }

  function jdAddFever(s, judge) {
    if (typeof s.fever !== 'number') s.fever = 0;

    let gain = 0;
    if (judge === 'perfect') gain = 16;
    else if (judge === 'good') gain = 10;

    if ((s.combo || 0) >= 5) gain += 2;
    if (s.phase === 3) gain += 1;
    if (s.finalRush) gain += 1;

    s.fever = Math.min(100, s.fever + gain);

    if (s.fever >= 100 && !s.feverActive) {
      s.feverActive = true;
      s.feverUntil = performance.now() + 4200;
      if (s.playRoot) jdFlash(s.playRoot, 'fever');
      jdShowJudge('🔥 FEVER!');
      jdLogEvent(s, 'fever_start');
    }
  }

  function jdUpdateFeverRuntime(s, now) {
    if (s.feverActive && now >= (s.feverUntil || 0)) {
      s.feverActive = false;
      s.fever = 0;
      jdLogEvent(s, 'fever_end');
    }
    if (!s.feverActive) {
      s.fever = Math.max(0, (s.fever || 0) - 0.04);
    }
  }

  function jdFlipObstacle(obs) {
    if (!obs || !obs.el) return;
    obs.flipped = true;
    obs.type = obs.type === 'low' ? 'high' : 'low';
    obs.need = obs.type === 'low' ? 'jump' : 'duck';
    obs.el.classList.remove('low', 'high');
    obs.el.classList.add(obs.type);

    const tag = obs.el.querySelector('.tag');
    if (tag) tag.textContent = obs.need === 'jump' ? 'JUMP' : 'DUCK';
  }

  function jdStreakTier(combo) {
    const c = Number(combo || 0);
    if (c >= 20) return 4;
    if (c >= 12) return 3;
    if (c >= 7) return 2;
    if (c >= 4) return 1;
    return 0;
  }

  function jdStreakLabel(tier) {
    if (tier === 4) return '👑 UNSTOPPABLE!';
    if (tier === 3) return '🔥 HOT STREAK!';
    if (tier === 2) return '⚡ STREAK x7!';
    if (tier === 1) return '✨ STREAK x4!';
    return '';
  }

  function jdAwardLiveStreakReward(s) {
    if (!s) return;

    const tier = jdStreakTier(s.combo || 0);
    if (tier <= (s.streakTier || 0)) return;

    s.streakTier = tier;
    const msg = jdStreakLabel(tier);
    if (msg) jdShowJudge(msg);

    let bonus = 0;
    if (tier === 1) bonus = 10;
    else if (tier === 2) bonus = 18;
    else if (tier === 3) bonus = 28;
    else if (tier === 4) bonus = 40;

    s.score = Number(s.score || 0) + bonus;

    if (s.arena) {
      jdScorePop(
        s.arena,
        (s.hitLineX || 120) + 34,
        s.layoutProfile === 'tiny' ? 160 : 150,
        `+${bonus}`,
        'perfect'
      );
    }

    jdLogEvent(s, 'streak_reward', {
      streakTier: Number(tier || 0),
      streakLabel: msg || '',
      bonus: Number(bonus || 0)
    });
  }

  function jdAwardNoMissBonusIfEligible(s) {
    if (!s || s.noMissBonusAwarded) return;
    if (!s.liveNoMiss) return;
    if ((s.progress || 0) < 0.995) return;

    s.noMissBonusAwarded = true;
    const bonus = 60;
    s.score = Number(s.score || 0) + bonus;
    jdShowJudge('🏅 NO MISS BONUS!');

    if (s.arena) {
      jdScorePop(
        s.arena,
        (s.hitLineX || 120) + 28,
        s.layoutProfile === 'tiny' ? 150 : 140,
        `+${bonus}`,
        'perfect'
      );
    }

    jdLogEvent(s, 'no_miss_bonus', {
      bonus: Number(bonus || 0)
    });
  }

  function jdAwardRushSurviveIfEligible(s) {
    if (!s || s.rushSurviveAwarded) return;
    if (s.rushStage !== 'survive') return;
    if (!s.finalRush) return;
    if (Number(s.stability || 0) <= 0) return;

    const left = Number(s.timeLeft || 0);
    if (left > 2000) return;

    s.rushSurviveAwarded = true;
    const bonus = 35;
    s.score = Number(s.score || 0) + bonus;
    jdShowJudge('🛟 SURVIVE BONUS!');

    if (s.arena) {
      jdScorePop(
        s.arena,
        (s.hitLineX || 120) + 34,
        s.layoutProfile === 'tiny' ? 175 : 165,
        `+${bonus}`,
        'good'
      );
    }

    jdLogEvent(s, 'rush_survive_bonus', {
      bonus: Number(bonus || 0)
    });
  }

  function jdMaybeTriggerBossPhase2(s) {
    if (!s || !s.bossActive || !s.bossProfile) return;
    if (s.bossPhase2Triggered) return;

    const hp = Number(s.bossHp || 100);
    if (hp > 50) return;

    s.bossPhase2Triggered = true;
    s.bossPhase2 = true;
    s.bossBreakMoments = Number(s.bossBreakMoments || 0) + 1;

    jdShowBossIntro(`${s.bossProfile.icon} ${s.bossProfile.label} • PHASE 2`);
    jdShowJudge('💢 PHASE 2!');
    jdTelegraph('แรงขึ้นแล้ว ระวังให้ดี!', 900);

    s.currentSpeed *= 1.05;
    s.currentSpawnMs *= 0.94;

    jdLogEvent(s, 'boss_phase2', {
      bossBreakMoments: Number(s.bossBreakMoments || 0)
    });
  }

  function jdApplyMissPenalty(s, obs, reason = 'miss') {
    s.miss = Number(s.miss || 0) + 1;
    s.combo = 0;
    s.liveNoMiss = false;
    s.streakTier = 0;

    s.missStreak = Number(s.missStreak || 0) + 1;
    s.hitStreak = 0;
    jdDirectorPushEvent(s, 'miss');

    if (obs?.need === 'jump') s.jumpMiss = Number(s.jumpMiss || 0) + 1;
    else if (obs?.need === 'duck') s.duckMiss = Number(s.duckMiss || 0) + 1;

    let stabLoss = 8;
    if (s.phase === 2) stabLoss = 10;
    if (s.phase === 3) stabLoss = 12;
    if (s.finalRush) stabLoss += 2;
    if (s.bossActive) stabLoss += 2;
    if (obs?.variant === 'heavy') stabLoss += 2;

    s.stability = Math.max(0, Number(s.stability || 100) - stabLoss);

    if (s.bossProfile?.key === 'shield') {
      s.bossChain = 0;
    }

    if (s.playRoot) jdFlash(s.playRoot, 'miss');

    if (s.arena && obs) {
      jdScorePop(
        s.arena,
        obs.x + 42,
        jdObstaclePopY(obs),
        reason === 'wrong' ? 'WRONG' : 'MISS',
        'miss'
      );
    }

    if (s.phaseMiss && s.phaseMiss[s.phase] != null) {
      s.phaseMiss[s.phase] += 1;
    }
    if (s.finalRush) {
      s.rushMiss = Number(s.rushMiss || 0) + 1;
    }

    jdLogEvent(s, 'miss', {
      obstacleId: obs?.id || '',
      obstacleNeed: obs?.need || '',
      obstacleType: obs?.type || '',
      obstacleVariant: obs?.variant || '',
      obstacleVisual: obs?.visualKey || '',
      obstacleFeint: !!obs?.feint,
      reason: reason,
      liveNoMiss: !!s.liveNoMiss
    });

    let txt = reason === 'wrong' ? '❌ WRONG!' : 'MISS';
    if (s.finalRush && s.rushStage === 'survive') txt = '⚠ STAY FOCUSED!';
    jdShowJudge(txt);
  }

  function jdApplySuccessfulHit(s, obs, judge) {
    s.hit = Number(s.hit || 0) + 1;
    s.combo = Number(s.combo || 0) + 1;
    s.maxCombo = Math.max(Number(s.maxCombo || 0), s.combo);

    s.hitStreak = Number(s.hitStreak || 0) + 1;
    s.missStreak = 0;
    jdDirectorPushEvent(s, 'hit');

    if (obs.need === 'jump') s.jumpHit = Number(s.jumpHit || 0) + 1;
    else if (obs.need === 'duck') s.duckHit = Number(s.duckHit || 0) + 1;

    const gain = jdScoreGainFromJudge(judge, s, obs);
    s.score = Number(s.score || 0) + gain;
    jdAddFever(s, judge);

    if (s.playRoot) jdFlash(s.playRoot, judge === 'perfect' ? 'perfect' : 'good');

    if (s.arena) {
      jdScorePop(
        s.arena,
        obs.x + 42,
        jdObstaclePopY(obs),
        `+${gain}`,
        judge === 'perfect' ? 'perfect' : 'good'
      );
    }

    if (s.bossActive) {
      let dmg = jdBossDamageFromJudge(judge, s);

      if (s.bossProfile?.key === 'shield') {
        s.bossChain = Number(s.bossChain || 0) + 1;
        if (s.bossChain >= 3) dmg += 3;
        if (s.bossChain >= 5) dmg += 4;
      } else {
        s.bossChain = 0;
      }

      if (s.bossPhase2) {
        dmg += 1;
      }

      s.bossHp = Math.max(0, Number(s.bossHp || 100) - dmg);
      if (s.playRoot) jdFlash(s.playRoot, 'bosshit');

      jdMaybeTriggerBossPhase2(s);
    }

    jdAwardLiveStreakReward(s);

    if (s.phaseHit && s.phaseHit[s.phase] != null) {
      s.phaseHit[s.phase] += 1;
    }
    if (s.finalRush) {
      s.rushHit = Number(s.rushHit || 0) + 1;
    }

    jdLogEvent(s, 'hit', {
      obstacleId: obs?.id || '',
      obstacleNeed: obs?.need || '',
      obstacleType: obs?.type || '',
      obstacleVariant: obs?.variant || '',
      obstacleVisual: obs?.visualKey || '',
      obstacleFeint: !!obs?.feint,
      judge: judge,
      gain: Number(gain || 0),
      liveNoMiss: !!s.liveNoMiss
    });

    let judgeText = judge === 'perfect' ? '✨ PERFECT!' : '✅ GOOD!';

    if (obs?.variant === 'heavy' && judge === 'perfect') {
      judgeText = '💥 POWER CLEAR!';
    } else if (obs?.variant === 'mini' && judge === 'perfect') {
      judgeText = '⚡ QUICK READ!';
    }

    if (s.bossActive && s.bossProfile?.key === 'tempo' && judge === 'perfect') {
      judgeText = '🎵 ON BEAT!';
    }

    if (s.bossActive && s.bossProfile?.key === 'feint' && obs.feint) {
      judgeText = '🧠 READ IT!';
    }

    if (s.bossActive && s.bossProfile?.key === 'shield' && (s.bossChain || 0) >= 3) {
      judgeText = '🛡️ SHIELD BREAK!';
    }

    if (s.bossActive && s.bossProfile?.key === 'mirror' && ['mirrorABBA','mirrorBAAB','mirrorEcho','mirror4'].includes(s.lastPattern || '')) {
      judgeText = '🪞 MIRROR MASTER!';
    }

    if (s.rushStage === 'survive' && judge === 'perfect') {
      judgeText = '🔥 CLUTCH!';
    } else if (s.rushStage === 'peak' && judge === 'perfect') {
      judgeText = '⚡ HOLD IT!';
    }

    jdShowJudge(judgeText);
  }

  function jdUpdatePhaseAndPacing(s) {
    const progress = jdGetProgress(s);
    const diffKey = s.diff || 'normal';
    const compact = s.layoutProfile === 'compact' || s.layoutProfile === 'tiny';

    s.phase = jdPhaseByProgress(progress);

    const phaseCfg = JD_PHASE_TABLE[s.phase] || JD_PHASE_TABLE[1];
    let spawnMs = phaseCfg.spawnMs[diffKey] || 900;

    jdApplyResponsiveLayout(s);
    jdDirectorEvaluate(s);

    let speed = s.baseSpeed || 6.0;
    speed *= (phaseCfg.speedMul || 1);

    if (s.mode === 'training') {
      if (s.phase === 1) {
        speed *= 1 + (progress * 0.02);
        spawnMs *= 1 - (progress * 0.02);
      } else if (s.phase === 2) {
        speed *= 1 + (progress * 0.05);
        spawnMs *= 1 - (progress * 0.05);
      } else {
        speed *= 1 + (progress * 0.08);
        spawnMs *= 1 - (progress * 0.06);
      }
    }

    if (s.mode === 'test' || s.mode === 'research') {
      if (s.phase === 2) {
        speed *= 1.01;
        spawnMs *= 0.99;
      }
      if (s.phase === 3) {
        speed *= 1.03;
        spawnMs *= 0.97;
      }
    }

    if (s.feverActive) {
      speed *= compact ? 1.04 : 1.06;
    }

    if (s.bossActive && s.bossProfile) {
      speed *= (s.bossProfile.speedMul || 1);
      spawnMs = Math.min(spawnMs, (s.bossProfile.burstEveryMs || 4200) / (compact ? 5.4 : 5.0));
    }

    s.rushStage = jdRushStageByProgress(progress, compact);
    s.finalRush = !!s.rushStage;

    if (s.rushStage === 'warning') {
      speed *= compact ? 1.03 : 1.05;
      spawnMs *= compact ? 0.97 : 0.95;
    } else if (s.rushStage === 'peak') {
      speed *= compact ? 1.08 : 1.12;
      spawnMs *= compact ? 0.91 : 0.88;
    } else if (s.rushStage === 'survive') {
      speed *= compact ? 1.10 : 1.15;
      spawnMs *= compact ? 0.88 : 0.84;
    }

    if (s.bossPhase2) {
      speed *= compact ? 1.04 : 1.06;
      spawnMs *= compact ? 0.95 : 0.93;
    }

    if (s.bossActive && typeof s.bossHp === 'number' && s.bossHp <= 25) {
      speed *= compact ? 1.04 : 1.06;
      spawnMs *= compact ? 0.96 : 0.93;
      s.bossFrenzy = true;
    } else {
      s.bossFrenzy = false;
    }

    const adjusted = jdDirectorAdjustPacing(s, {
      speed,
      spawnMs,
      hitHalfWindow: Number(s.hitHalfWindow || 27)
    });

    speed = adjusted.speed;
    spawnMs = adjusted.spawnMs;
    s.hitHalfWindow = adjusted.hitHalfWindow;

    spawnMs = jdClamp(Math.round(spawnMs), compact ? 430 : 360, 1800);
    speed = jdClamp(speed, compact ? 4.8 : 4.9, compact ? 13.8 : 15.8);

    s.progress = progress;
    s.currentSpawnMs = spawnMs;
    s.currentSpeed = speed;
    s.phaseLabel = phaseCfg.label || `phase-${s.phase}`;
  }

  function jdApplyPhaseFX(s) {
    if (!s || !s.playRoot) return;
    s.playRoot.classList.remove('phase-1', 'phase-2', 'phase-3', 'final-rush', 'boss-frenzy');
    s.playRoot.classList.add(`phase-${s.phase}`);
    if (s.finalRush) s.playRoot.classList.add('final-rush');
    if (s.bossFrenzy) s.playRoot.classList.add('boss-frenzy');
    jdUpdateRushBanner();
  }

  function jdUpdateObstacles(s, dt) {
    if (!s || !Array.isArray(s.obstacles)) return;

    const now = performance.now();
    jdUpdateFeverRuntime(s, now);

    const hitX = Number(s.hitLineX || 144);
    const hitHalfWindow = Number(s.hitHalfWindow || 28);
    const removeX = Number(s.removeX || -120);

    for (let i = s.obstacles.length - 1; i >= 0; i--) {
      const obs = s.obstacles[i];
      if (!obs || !obs.el) continue;

      obs.speed = Number((s.currentSpeed || obs.speed || 7.4) * (obs.speedMul || 1));

      let frameSpeedMul = 1;
      if (s.feverActive) frameSpeedMul *= 1.08;
      if (s.finalRush) frameSpeedMul *= 1.05;
      if (s.bossFrenzy) frameSpeedMul *= 1.06;

      obs.x -= obs.speed * frameSpeedMul * dt * 0.06;
      obs.el.style.transform = `translate(${obs.x}px, 0px)`;

      if (obs.feint && !obs.flipped && obs.flipAtX != null && obs.x <= obs.flipAtX) {
        jdFlipObstacle(obs);
      }

      const inHitZone = Math.abs(obs.x - hitX) <= hitHalfWindow;

      if (!obs.resolved && inHitZone && s.lastInput) {
        const input = s.lastInput;
        const inputAgeMs = (Math.abs(obs.x - hitX) * 3.2) - Number(obs.judgeBiasMs || 0);

        if (input.type === obs.need) {
          const judge = jdJudgeTiming(inputAgeMs, s);
          if (judge !== 'late') {
            obs.resolved = true;
            jdApplySuccessfulHit(s, obs, judge);
            obs.el.remove();
            s.obstacles.splice(i, 1);
            s.lastInput = null;
            continue;
          }
        } else {
          obs.resolved = true;
          jdApplyMissPenalty(s, obs, 'wrong');
          obs.el.remove();
          s.obstacles.splice(i, 1);
          s.lastInput = null;
          continue;
        }
      }

      if (!obs.resolved && obs.x < (hitX - hitHalfWindow - 12)) {
        obs.resolved = true;
        jdApplyMissPenalty(s, obs, 'miss');
        obs.el.remove();
        s.obstacles.splice(i, 1);
        continue;
      }

      if (obs.x < removeX) {
        try { obs.el.remove(); } catch (_) {}
        s.obstacles.splice(i, 1);
      }
    }

    if (s.lastInput && now - s.lastInput.at > 260) {
      s.lastInput = null;
    }
  }

  function jdHandleInput(s, type) {
    if (!s || !s.running) return;

    s.lastInput = {
      type,
      at: performance.now()
    };

    jdLogEvent(s, 'input', {
      inputType: type,
      missStreak: Number(s.missStreak || 0),
      hitStreak: Number(s.hitStreak || 0)
    });

    if (s.avatar) {
      s.avatar.classList.remove('avatar-idle', 'avatar-jump', 'avatar-duck');
      s.avatar.classList.add(type === 'jump' ? 'avatar-jump' : 'avatar-duck');

      clearTimeout(s.avatarResetTimer);
      s.avatarResetTimer = setTimeout(() => {
        if (!s.avatar) return;
        s.avatar.classList.remove('avatar-jump', 'avatar-duck');
        s.avatar.classList.add('avatar-idle');
      }, 180);
    }
  }

  function jdRankByPerformance(accPct, miss, maxCombo, bossDown) {
    if (accPct >= 92 && miss === 0 && bossDown) return 'S';
    if (accPct >= 84 && miss <= 2) return 'A';
    if (accPct >= 70) return 'B';
    if (accPct >= 55) return 'C';
    return 'D';
  }

  function jdRewardFromRank(rank, accPct, bossDown, noMiss) {
    if (rank === 'S' && bossDown && noMiss) return { medal: '🏆', label: 'Legend Run', key: 'legend-run' };
    if (rank === 'S') return { medal: '🥇', label: 'Gold Run', key: 'gold-run' };
    if (rank === 'A') return { medal: '🥈', label: 'Silver Run', key: 'silver-run' };
    if (rank === 'B') return { medal: '🥉', label: 'Bronze Run', key: 'bronze-run' };
    if (accPct >= 60) return { medal: '🎖️', label: 'Clear Run', key: 'clear-run' };
    return { medal: '⭐', label: 'Keep Training', key: 'keep-training' };
  }

  function jdBossBadge(s) {
    if (!s.bossActive || s.bossHp > 0 || !s.bossProfile) return null;
    return {
      key: `boss-${s.bossProfile.key}`,
      icon: s.bossProfile.icon,
      label: s.bossProfile.label
    };
  }

  function jdResultHeadline(rank, bossDown, noMiss) {
    if (rank === 'S' && bossDown && noMiss) {
      return {
        title: 'สุดยอด! Legend Run',
        sub: 'รอบนี้ทั้งแม่น ทั้งนิ่ง และเก็บบอสลงได้แบบไร้ที่ติ'
      };
    }
    if (rank === 'S') {
      return {
        title: 'ยอดเยี่ยมมาก! S Rank',
        sub: 'จังหวะดี อ่านเกมขาด และคุมสนามได้เยี่ยม'
      };
    }
    if (rank === 'A') {
      return {
        title: 'เยี่ยมมาก! A Rank',
        sub: 'เล่นมั่นใจมาก เหลือเก็บรายละเอียดอีกนิด'
      };
    }
    if (rank === 'B') {
      return {
        title: 'ดีมาก! ผ่านแบบมีทรง',
        sub: 'เริ่มอ่าน pattern ได้ดีขึ้น ลองกดให้คมขึ้นอีกนิด'
      };
    }
    if (rank === 'C') {
      return {
        title: 'ผ่านแล้ว! แต่ยังไปได้อีก',
        sub: 'เริ่มจับจังหวะได้แล้ว ลองลด miss และดัน combo ให้สูงขึ้น'
      };
    }
    return {
      title: 'ยังต้องซ้อมอีกนิด',
      sub: 'โฟกัส low = jump / high = duck แล้วรอบหน้าจะดีขึ้นมาก'
    };
  }

  function jdRewardFlavor(reward, bossBadge, rank) {
    if (bossBadge) return `${bossBadge.icon} ปลดตรา ${bossBadge.label} สำเร็จ`;
    if (rank === 'S') return 'จังหวะคมมาก รอบนี้เล่นเหมือนโปรแล้ว';
    if (rank === 'A') return 'เหลืออีกนิดเดียวก็แตะระดับสูงสุด';
    if (rank === 'B') return 'มีพื้นฐานดีแล้ว ดัน accuracy อีกหน่อยจะพุ่งมาก';
    if (rank === 'C') return 'ลองอ่าน silhouette ให้เร็วขึ้น และอย่ากดรีบเกินไป';
    return 'โฟกัส low = jump / high = duck แล้วจะดีขึ้นทันที';
  }

  function jdBossSpecificTitle(s, rank, bossDown, noMiss) {
    const boss = s?.bossProfile?.key || '';

    if (boss === 'tempo' && rank === 'S') return 'Tempo Master';
    if (boss === 'tempo' && rank === 'A') return 'Beat Keeper';

    if (boss === 'feint' && bossDown) return 'Feint Reader';
    if (boss === 'feint' && noMiss) return 'Mind Game Winner';

    if (boss === 'shield' && bossDown) return 'Shield Crusher';
    if (boss === 'shield' && (s?.bossChain || 0) >= 5) return 'Armor Breaker';

    if (boss === 'mirror' && bossDown) return 'Mirror Master';
    if (boss === 'mirror' && noMiss) return 'Pattern Reader';

    if (boss === 'chaos' && bossDown) return 'Chaos Survivor';
    if (boss === 'chaos' && rank === 'S') return 'Storm Legend';

    if (s?.rushStage === 'survive' && noMiss) return 'Final Rush Survivor';
    if (bossDown && noMiss) return 'Boss Finisher';
    if (noMiss) return 'Clean Runner';
    if ((s?.maxCombo || 0) >= 20) return 'Combo Hero';
    return '';
  }

  function jdAnalyzeRun(s) {
    const total = Math.max(1, Number(s.totalObstacles || 0));
    const hit = Number(s.hit || 0);
    const miss = Number(s.miss || 0);

    const jumpHit = Number(s.jumpHit || 0);
    const duckHit = Number(s.duckHit || 0);
    const jumpMiss = Number(s.jumpMiss || 0);
    const duckMiss = Number(s.duckMiss || 0);

    const jumpTotal = Math.max(1, jumpHit + jumpMiss);
    const duckTotal = Math.max(1, duckHit + duckMiss);

    const jumpAcc = (jumpHit / jumpTotal) * 100;
    const duckAcc = (duckHit / duckTotal) * 100;
    const accPct = (hit / total) * 100;

    const weakness = [];
    const strengths = [];
    const tips = [];

    if (jumpAcc < duckAcc - 12) {
      weakness.push('low-obstacle weakness');
      tips.push('คุณพลาดอุปสรรคต่ำมากกว่าอุปสรรคสูง ควรรอจังหวะกระโดดให้ชัดก่อนกด');
    }

    if (duckAcc < jumpAcc - 12) {
      weakness.push('high-obstacle weakness');
      tips.push('คุณพลาดอุปสรรคสูงมากกว่าอุปสรรคต่ำ ลองโฟกัสการหมอบให้เร็วขึ้นอีกนิด');
    }

    if (miss >= 6) {
      weakness.push('overall-pressure');
      tips.push('รอบนี้ miss ค่อนข้างเยอะ ควรลดการกดล่วงหน้าและอ่าน silhouette ให้ชัดขึ้น');
    }

    if ((s.maxCombo || 0) <= 3 && hit >= 8) {
      weakness.push('combo-break');
      tips.push('คุณตีโดนพอสมควร แต่คอมโบหลุดบ่อย ลองรักษาจังหวะให้สม่ำเสมอขึ้น');
    }

    if (s.finalRush && !s.rushSurviveAwarded) {
      weakness.push('final-rush-collapse');
      tips.push('ช่วงท้ายเกมยังหลุดใน Final Rush ลองประคองจังหวะและอย่ากดรีบเกินไป');
    }

    if (s.bossActive && (s.bossHp || 0) > 35) {
      weakness.push('boss-pressure');
      tips.push('รอบนี้กดดันตอนบอสได้ไม่พอ ควรเน้นความแม่นก่อนเร่งคอมโบ');
    }

    if (s.lastDirectorReason === 'player_overloaded') {
      weakness.push('overload-risk');
      tips.push('ระบบตรวจว่ารอบนี้คุณเริ่ม overload ช่วงกลางถึงท้ายเกม ลองลดการกดรีบและอ่านเป็นชุด');
    }

    if (accPct >= 85) strengths.push('high accuracy');
    if ((s.maxCombo || 0) >= 12) strengths.push('combo control');
    if (s.liveNoMiss) strengths.push('clean run');
    if (s.bossActive && (s.bossHp || 0) <= 0) strengths.push('boss down');
    if (s.rushSurviveAwarded) strengths.push('final rush survive');

    if (!tips.length) {
      if (accPct >= 88) {
        tips.push('รอบนี้เล่นดีมากแล้ว ลองดันคอมโบต่อเนื่องและ perfect chain ให้มากขึ้น');
      } else {
        tips.push('พื้นฐานเริ่มดีแล้ว ลองอ่าน obstacle เป็นชุดแทนการมองทีละตัว');
      }
    }

    return {
      accPct: Number(accPct.toFixed(2)),
      jumpAcc: Number(jumpAcc.toFixed(2)),
      duckAcc: Number(duckAcc.toFixed(2)),
      weaknesses: weakness,
      strengths,
      tips,
      directorReason: s.lastDirectorReason || ''
    };
  }

  function jdBuildCoachMessage(s, analysis) {
    const boss = s?.bossProfile?.label || 'Boss';
    const tips = Array.isArray(analysis?.tips) ? analysis.tips : [];
    const strengths = Array.isArray(analysis?.strengths) ? analysis.strengths : [];

    let headline = 'AI Coach';
    let summary = 'ลองอีกครั้งเพื่อพัฒนาจังหวะและความแม่น';

    if (strengths.includes('clean run')) {
      headline = 'AI Coach • Clean Runner';
      summary = 'รอบนี้นิ่งมากและรักษาความผิดพลาดได้ดี';
    } else if (strengths.includes('boss down')) {
      headline = `AI Coach • ${boss} cleared`;
      summary = 'คุณจัดการบอสได้ดีแล้ว รอบต่อไปลองดันความนิ่งช่วงท้ายเพิ่ม';
    } else if (analysis?.weaknesses?.includes('final-rush-collapse')) {
      headline = 'AI Coach • Final Rush focus';
      summary = 'จุดอ่อนหลักของรอบนี้อยู่ช่วงท้ายเกม';
    } else if (analysis?.weaknesses?.includes('high-obstacle weakness')) {
      headline = 'AI Coach • High obstacle focus';
      summary = 'รอบนี้พลาดอุปสรรคสูงมากกว่าอุปสรรคต่ำ';
    } else if (analysis?.weaknesses?.includes('low-obstacle weakness')) {
      headline = 'AI Coach • Low obstacle focus';
      summary = 'รอบนี้พลาดอุปสรรคต่ำมากกว่าอุปสรรคสูง';
    }

    return {
      headline,
      summary,
      primaryTip: tips[0] || 'เล่นซ้ำอีกครั้งเพื่ออ่านแพทเทิร์นให้เร็วขึ้น',
      secondaryTip: tips[1] || ''
    };
  }

  function jdBuildAnalyticsFlags(summary) {
    const flags = [];
    const sf = summary?.sessionFeatures || {};
    const analysis = summary?.analysis || {};

    if ((analysis.weaknesses || []).includes('low-obstacle weakness')) flags.push('LOW_WEAKNESS');
    if ((analysis.weaknesses || []).includes('high-obstacle weakness')) flags.push('HIGH_WEAKNESS');
    if ((analysis.weaknesses || []).includes('final-rush-collapse')) flags.push('FINAL_RUSH_COLLAPSE');
    if ((analysis.weaknesses || []).includes('boss-pressure')) flags.push('BOSS_PRESSURE_HIGH');
    if ((analysis.weaknesses || []).includes('combo-break')) flags.push('COMBO_UNSTABLE');
    if ((analysis.weaknesses || []).includes('overload-risk')) flags.push('OVERLOAD_RISK');

    if (sf.liveNoMiss) flags.push('CLEAN_RUN');
    if (Number(sf.accPct || 0) >= 85) flags.push('HIGH_ACCURACY');
    if (Number(sf.maxCombo || 0) >= 12) flags.push('HIGH_COMBO');

    return flags;
  }

  function jdBuildTeacherSummary(summary) {
    const sf = summary?.sessionFeatures || {};
    const analysis = summary?.analysis || {};
    const coach = summary?.coach || {};
    const flags = jdBuildAnalyticsFlags(summary);

    return {
      sessionId: sf.sessionId || '',
      pid: sf.pid || '',
      mode: sf.mode || '',
      diff: sf.diff || '',

      scoreFinal: Number(sf.scoreFinal || 0),
      accPct: Number(sf.accPct || 0),
      rank: sf.rank || '',
      maxCombo: Number(sf.maxCombo || 0),

      jumpAcc: Number(sf.jumpAcc || 0),
      duckAcc: Number(sf.duckAcc || 0),

      phase1Miss: Number(sf.phase1Miss || 0),
      phase2Miss: Number(sf.phase2Miss || 0),
      phase3Miss: Number(sf.phase3Miss || 0),
      rushMiss: Number(sf.rushMiss || 0),

      bossLabel: sf.bossLabel || '',
      bossHpEnd: Number(sf.bossHpEnd || 0),
      bossDown: !!sf.bossDown,
      bossPhase2: !!sf.bossPhase2,

      assistLevelEnd: Number(sf.assistLevelEnd || 0),
      pressureLevelEnd: Number(sf.pressureLevelEnd || 0),
      directorReason: sf.directorReason || '',

      weaknessTags: (analysis.weaknesses || []).join('|'),
      strengthTags: (analysis.strengths || []).join('|'),
      coachHeadline: coach.headline || '',
      coachTip1: coach.primaryTip || '',
      coachTip2: coach.secondaryTip || '',

      flags: flags.join('|'),
      timestampIso: sf.timestampIso || summary?.timestampIso || ''
    };
  }

  function jdBuildSessionFeatures(s, analysis, rank, endReason) {
    const total = Math.max(1, Number(s.totalObstacles || 0));
    const hit = Number(s.hit || 0);
    const miss = Number(s.miss || 0);

    return {
      sessionId: s.sessionId,
      pid: s.pid,
      mode: s.mode,
      diff: s.diff,

      durationSec: Number(((s.duration || 0) / 1000).toFixed(2)),
      endReason: endReason || '',

      scoreFinal: Number(s.score || 0),
      rank: rank || '',
      accPct: Number(analysis?.accPct || 0),

      totalObstacles: total,
      totalHit: hit,
      totalMiss: miss,

      jumpHit: Number(s.jumpHit || 0),
      duckHit: Number(s.duckHit || 0),
      jumpMiss: Number(s.jumpMiss || 0),
      duckMiss: Number(s.duckMiss || 0),

      jumpAcc: Number(analysis?.jumpAcc || 0),
      duckAcc: Number(analysis?.duckAcc || 0),

      maxCombo: Number(s.maxCombo || 0),
      liveNoMiss: !!s.liveNoMiss,
      rushSurviveAwarded: !!s.rushSurviveAwarded,

      bossKey: s.bossProfile?.key || '',
      bossLabel: s.bossProfile?.label || '',
      bossDown: !!(s.bossActive && (s.bossHp || 0) <= 0),
      bossHpEnd: Number(s.bossHp || 0),
      bossPhase2: !!s.bossPhase2,
      bossBreakMoments: Number(s.bossBreakMoments || 0),

      spawnCountLow: Number(s.spawnCountLow || 0),
      spawnCountHigh: Number(s.spawnCountHigh || 0),
      spawnCountHeavy: Number(s.spawnCountHeavy || 0),
      spawnCountMini: Number(s.spawnCountMini || 0),
      spawnCountFeint: Number(s.spawnCountFeint || 0),

      phase1Hit: Number(s.phaseHit?.[1] || 0),
      phase2Hit: Number(s.phaseHit?.[2] || 0),
      phase3Hit: Number(s.phaseHit?.[3] || 0),

      phase1Miss: Number(s.phaseMiss?.[1] || 0),
      phase2Miss: Number(s.phaseMiss?.[2] || 0),
      phase3Miss: Number(s.phaseMiss?.[3] || 0),

      rushHit: Number(s.rushHit || 0),
      rushMiss: Number(s.rushMiss || 0),

      tuneKey: s.tuneKey || '',
      assistLevelEnd: Number(s.assistLevel || 0),
      pressureLevelEnd: Number(s.pressureLevel || 0),
      directorReason: s.lastDirectorReason || '',
      directorDeterministic: !!s.directorDeterministic,

      weaknessTags: (analysis?.weaknesses || []).join('|'),
      strengthTags: (analysis?.strengths || []).join('|'),

      timestampIso: nowIso()
    };
  }

  function jdRenderResultSummary(s, result) {
    if (!s || !result) return;

    const bossDown = !!(s.bossActive && s.bossHp <= 0);
    const noMiss = Number(s.miss || 0) === 0;
    const headline = jdResultHeadline(result.rank, bossDown, noMiss);

    if (rankBadge) {
      rankBadge.textContent = result.rank || 'C';
      rankBadge.classList.remove('rank-s', 'rank-a', 'rank-b', 'rank-c', 'rank-d');
      rankBadge.classList.add(`rank-${String(result.rank || 'c').toLowerCase()}`);
    }

    if (resultTitle) resultTitle.textContent = headline.title;
    if (resultSub) resultSub.textContent = headline.sub;
    if (resultBoss) resultBoss.textContent = s.bossProfile?.label || (s.bossActive ? 'Boss' : '—');
    if (resultPattern) resultPattern.textContent = s.lastPattern || '—';
    if (resultRush) resultRush.textContent = s.finalRush ? 'FINAL RUSH' : '—';

    if (resultReward) resultReward.textContent = result.bossTitle || result.reward?.label || 'Keep Training';
    if (resultRewardIcon) resultRewardIcon.textContent = result.bossBadge?.icon || result.reward?.medal || '⭐';
    if (resultRewardSub) resultRewardSub.textContent = jdRewardFlavor(result.reward, result.bossBadge, result.rank);

    if (resScoreBig) resScoreBig.textContent = String(s.score || 0);
    if (resAccBig) resAccBig.textContent = `${Number(result.accPct || 0).toFixed(1)}%`;
    if (resComboBig) resComboBig.textContent = String(s.maxCombo || 0);
    if (resBossEndBig) resBossEndBig.textContent = s.bossActive ? `${Math.round(s.bossHp || 0)}%` : '—';

    if (resPhaseEnd) resPhaseEnd.textContent = `${s.phase || '-'} • ${s.phaseLabel || '-'}`;
    if (resPattern) resPattern.textContent = s.lastPattern || '—';
    if (resBossLabel) resBossLabel.textContent = s.bossProfile?.label || '—';
    if (resRush) resRush.textContent = s.finalRush ? 'FINAL RUSH' : 'NO';

    if (coachTitle) coachTitle.textContent = result.coach?.headline || 'AI Coach';
    if (coachSummary) coachSummary.textContent = result.coach?.summary || 'สรุปคำแนะนำหลังจบเกม';
    if (coachTip1) coachTip1.textContent = result.coach?.primaryTip || '—';
    if (coachTip2) coachTip2.textContent = result.coach?.secondaryTip || '—';
  }

  function createState(opts) {
    const seedVal = HHA_CTX.seed || Date.now();
    const rng = mulberry32(strToSeed(seedVal));
    const metrics = jdGetArenaMetrics();

    const s = {
      running: true,
      ended: false,

      pid: String(HHA_CTX.pid || 'anon'),
      diff: opts.diff,
      mode: opts.mode,
      duration: opts.durationMs,
      participant: buildParticipant(opts.mode),

      startedAt: performance.now(),
      elapsed: 0,
      timeLeft: opts.durationMs,
      lastNow: 0,

      rng,

      phase: 1,
      progress: 0,
      phaseLabel: 'warmup',

      baseSpeed: 6.0,
      currentSpeed: 6.0,
      currentSpawnMs: 900,
      userBaseSpeedLocked: false,

      hit: 0,
      miss: 0,
      jumpHit: 0,
      duckHit: 0,
      jumpMiss: 0,
      duckMiss: 0,
      score: 0,
      combo: 0,
      maxCombo: 0,
      stability: 100,

      fever: 0,
      feverActive: false,
      feverUntil: 0,

      totalObstacles: 0,
      nextObsId: 1,
      obstacles: [],
      nextSpawnAt: 0,
      lastInput: null,

      bossActive: false,
      bossHp: 100,
      bossProfile: null,
      bossFrenzy: false,
      bossPhase2: false,
      bossPhase2Triggered: false,
      bossBreakMoments: 0,
      nextBossBurstAt: 0,
      bossChain: 0,

      finalRush: false,
      rushStage: '',
      lastPattern: '',

      liveNoMiss: true,
      streakTier: 0,
      streakBurstsAwarded: {},
      noMissBonusAwarded: false,
      rushSurviveAwarded: false,

      directorEnabled: JD_DIRECTOR_CONFIG.enabled,
      directorDeterministic: (opts.mode === 'research' && JD_DIRECTOR_CONFIG.researchDeterministic),
      assistLevel: 0,
      pressureLevel: 0,
      missStreak: 0,
      hitStreak: 0,
      recentWindow: [],
      lastDirectorReason: '',
      lastDirectorAt: 0,

      sessionId: `jd-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      eventLog: [],
      spawnCountLow: 0,
      spawnCountHigh: 0,
      spawnCountHeavy: 0,
      spawnCountMini: 0,
      spawnCountFeint: 0,
      phaseMiss: { 1: 0, 2: 0, 3: 0 },
      phaseHit: { 1: 0, 2: 0, 3: 0 },
      rushHit: 0,
      rushMiss: 0,

      layoutProfile: metrics.profile,
      arenaWidth: metrics.width,
      hitLineX: metrics.hitLineX,
      hitHalfWindow: 27,
      startXBase: Math.round(metrics.width * 0.8),
      gapBase: 170,
      removeX: -170,
      tuneKey: 'A',

      playRoot,
      arena: obsLayer,
      avatar
    };

    jdApplyResponsiveLayout(s);
    return s;
  }

  function startGame(opts) {
    hardResetBeforeRun();

    state = createState(opts);
    jdApplyResponsiveLayout(state);
    resetResultHUD();

    if (hudMode) hudMode.textContent = state.mode;
    if (hudDiff) hudDiff.textContent = state.diff;
    if (hudTime) hudTime.textContent = (state.duration / 1000).toFixed(1);

    showView('play');

    jdShowJudge('READY!');
    jdTelegraph('แตะบน = JUMP • แตะล่าง = DUCK', 900);

    jdLogEvent(state, 'session_start', {
      mode: state.mode,
      diff: state.diff,
      durationSec: Number((state.duration / 1000).toFixed(2))
    });

    hhFitnessSessionStart({
      mode: state.mode,
      diff: state.diff,
      time: String(Math.round((state.duration || 0) / 1000)),
      score: Number(state.score || 0),
      miss: Number(state.miss || 0),
      combo: Number(state.combo || 0),
      bestStreak: Number(state.maxCombo || 0),
      stability: Number(state.stability || 100),
      result: 'start'
    });

    rafId = requestAnimationFrame(jdTick);
  }

  function jdFinishRun(s, endReason) {
    if (!canFinishRun(s)) return;

    s.finishing = true;
    s.running = false;
    s.ended = true;

    stopLoop();
    clearRunTimers(s);
    resetTransientUI();

    const total = Math.max(1, Number(s.totalObstacles || 0));
    const hit = Number(s.hit || 0);
    const miss = Number(s.miss || 0);
    const accPct = (hit / total) * 100;
    const bossDown = !!(s.bossActive && s.bossHp <= 0);
    const noMiss = miss === 0;
    const rtMean = 0;

    const rank = jdRankByPerformance(accPct, miss, s.maxCombo || 0, bossDown);
    const reward = jdRewardFromRank(rank, accPct, bossDown, noMiss);
    const bossBadge = jdBossBadge(s);
    const bossTitle = jdBossSpecificTitle(s, rank, bossDown, noMiss);
    const analysis = jdAnalyzeRun(s);
    const coach = jdBuildCoachMessage(s, analysis);
    const sessionFeatures = jdBuildSessionFeatures(s, analysis, rank, endReason);
    const teacherSummary = jdBuildTeacherSummary({
      sessionFeatures,
      analysis,
      coach,
      timestampIso: nowIso()
    });

    const pid = String(HHA_CTX.pid || 'anon');
    const profileKey = `JD_PROFILE:${pid}`;
    const bookKey = `JD_CARD_BOOK:${pid}`;
    const lastCardKey = `JD_LAST_CARD:${pid}`;

    const profile = loadJson(profileKey, {});
    profile.bestScore = Math.max(Number(profile.bestScore || 0), Number(s.score || 0));
    profile.streak = noMiss ? Number(profile.streak || 0) + 1 : 0;
    profile.lastReward = reward;
    profile.lastBossBadge = bossBadge || null;
    profile.badges = profile.badges || {};
    profile.lastBoss = s.bossProfile?.key || '';
    profile.lastPattern = s.lastPattern || '';
    profile.lastRush = !!s.finalRush;
    profile.updatedAt = nowIso();

    if (rank === 'S') profile.badges.rankS = true;
    if (noMiss) profile.badges.noMiss = true;
    if (bossDown) profile.badges.bossDown = true;
    if ((s.maxCombo || 0) >= 12) profile.badges.combo12 = true;
    if (accPct >= 85) profile.badges.acc85 = true;
    if (bossBadge) profile.badges[bossBadge.key] = true;

    profile.bossWins = profile.bossWins || {};
    if (bossBadge) {
      profile.bossWins[s.bossProfile.key] = Number(profile.bossWins[s.bossProfile.key] || 0) + 1;
    }

    saveJson(profileKey, profile);

    const book = loadJson(bookKey, { S: 0, A: 0, B: 0, C: 0, total: 0 });
    if (rank === 'S') book.S++;
    else if (rank === 'A') book.A++;
    else if (rank === 'B') book.B++;
    else book.C++;
    book.total++;
    saveJson(bookKey, book);

    const card = {
      icon: bossBadge?.icon || reward.medal,
      title: bossBadge ? `${bossBadge.label} Card` : `${reward.label} Card`,
      rank,
      rewardLabel: reward.label,
      rewardKey: reward.key,
      bossBadgeLabel: bossBadge?.label || '',
      scoreFinal: s.score,
      accPct: Number(accPct.toFixed(2)),
      timestampIso: nowIso()
    };
    saveJson(lastCardKey, card);

    jdLogEvent(s, 'session_end', {
      endReason: endReason || '',
      rank: rank || '',
      accPct: Number(accPct.toFixed(2)),
      sessionScoreFinal: Number(s.score || 0)
    });

    const summary = {
      game: 'jumpduck',
      pid,
      scoreFinal: s.score,
      accPct: Number(accPct.toFixed(2)),
      rank,
      bossVariant: s.bossProfile?.key || '',
      bossLabel: s.bossProfile?.label || '',
      bossTitle: bossTitle || '',
      rewardLabel: reward.label,
      rewardKey: reward.key,
      end_reason: endReason,
      missTotal: miss,
      comboMax: s.maxCombo,
      timestampIso: nowIso(),
      pattern: s.lastPattern || '',
      rush: !!s.finalRush,
      rushStage: s.rushStage || '',
      tuneKey: s.tuneKey || 'A',
      liveNoMiss: !!s.liveNoMiss,
      bossPhase2: !!s.bossPhase2,
      bossBreakMoments: Number(s.bossBreakMoments || 0),
      assistLevel: Number(s.assistLevel || 0),
      pressureLevel: Number(s.pressureLevel || 0),
      directorReason: s.lastDirectorReason || '',
      analysis,
      coach,
      sessionFeatures,
      teacherSummary,
      eventLog: Array.isArray(s.eventLog) ? s.eventLog : []
    };

    saveLastSummary(summary);

    hhFitnessSummaryEnd({
      mode: s.mode,
      diff: s.diff,
      time: String(Math.round((s.duration || 0) / 1000)),
      score: Number(s.score || 0),
      miss: Number(s.miss || 0),
      combo: Number(s.combo || 0),
      bestStreak: Number(s.maxCombo || 0),
      stability: Number(s.stability || 0),
      rank: rank || '',
      accPct: Number(accPct.toFixed(2)),
      bossDown: !!bossDown,
      result: endReason || 'end'
    });

    if (resMode) resMode.textContent = s.mode || '-';
    if (resDiff) resDiff.textContent = s.diff || '-';
    if (resDuration) resDuration.textContent = `${Math.round((s.duration || 0) / 1000)}s`;
    if (resTotalObs) resTotalObs.textContent = String(total);
    if (resHits) resHits.textContent = String(hit);
    if (resMiss) resMiss.textContent = String(miss);
    if (resJumpHit) resJumpHit.textContent = String(s.jumpHit || 0);
    if (resDuckHit) resDuckHit.textContent = String(s.duckHit || 0);
    if (resJumpMiss) resJumpMiss.textContent = String(s.jumpMiss || 0);
    if (resDuckMiss) resDuckMiss.textContent = String(s.duckMiss || 0);
    if (resAcc) resAcc.textContent = `${accPct.toFixed(1)}%`;
    if (resRTMean) resRTMean.textContent = `${rtMean}`;
    if (resStabilityMin) resStabilityMin.textContent = `${Math.round(s.stability || 0)}%`;
    if (resScore) resScore.textContent = String(s.score || 0);
    if (resRank) resRank.textContent = rank;

    jdRenderResultSummary(s, {
      rank,
      accPct,
      reward,
      bossBadge,
      bossTitle,
      analysis,
      coach
    });

    s.finished = true;
    s.finishing = false;
    showView('result');
  }

  function jdTick(now) {
    if (!state) return;
    if (!state.running) return;
    if (state.finished || state.finishing) return;

    if (!state.lastNow) state.lastNow = now;
    const dt = now - state.lastNow;
    state.lastNow = now;

    if (!state._lastLayoutCheck || now - state._lastLayoutCheck > 250) {
      jdApplyResponsiveLayout(state);
      state._lastLayoutCheck = now;
    }

    state.elapsed = now - state.startedAt;
    state.timeLeft = Math.max(0, state.duration - state.elapsed);

    jdUpdatePhaseAndPacing(state);
    jdApplyPhaseFX(state);

    if (!state.bossActive && state.progress >= 0.76) {
      jdStartBoss(state);
    }

    if (!state.nextSpawnAt) {
      state.nextSpawnAt = now + 700;
    }

    if (now >= state.nextSpawnAt) {
      jdSpawnWave(state);
      state.nextSpawnAt = now + state.currentSpawnMs;
    }

    jdMaybeBossBurst(state, now);
    jdUpdateObstacles(state, dt);
    jdAwardNoMissBonusIfEligible(state);
    jdAwardRushSurviveIfEligible(state);

    if (progFill) progFill.style.width = `${Math.round((state.progress || 0) * 100)}%`;
    if (progText) progText.textContent = `${Math.round((state.progress || 0) * 100)}%`;

    if (feverFill) feverFill.style.width = `${Math.round(state.fever || 0)}%`;
    if (feverStatus) feverStatus.textContent = state.feverActive ? 'FEVER!' : 'Ready';

    if (hudMode) hudMode.textContent = state.mode;
    if (hudDiff) hudDiff.textContent = state.diff;
    if (hudTime) hudTime.textContent = (state.timeLeft / 1000).toFixed(1);
    if (hudPhase) hudPhase.textContent = `${state.phase} • ${state.phaseLabel || ''} • ${state.tuneKey || 'A'}`;
    if (hudScore) hudScore.textContent = String(state.score || 0);
    if (hudCombo) hudCombo.textContent = String(state.combo || 0);
    if (hudStability) hudStability.textContent = `${Math.round(state.stability || 0)}%`;
    if (hudBoss) hudBoss.textContent = state.bossActive ? `${Math.round(state.bossHp || 0)}%` : '—';

    if (hudRush) {
      if (state.rushStage === 'warning') hudRush.textContent = 'WARNING';
      else if (state.rushStage === 'peak') hudRush.textContent = 'FINAL RUSH';
      else if (state.rushStage === 'survive') hudRush.textContent = 'SURVIVE';
      else hudRush.textContent = '—';
    }

    if (hudBossLabel) {
      hudBossLabel.textContent = state.bossActive
        ? `${state.bossProfile?.icon || '👾'} ${state.bossProfile?.label || 'Boss'}`
        : '—';
    }

    if (hudBossStatus) {
      hudBossStatus.textContent = state.bossActive
        ? (state.bossFrenzy ? 'FRENZY!' : (state.bossProfile?.intro || 'Boss'))
        : '—';
    }

    if (hudBossCompact) {
      if (!state.bossActive) {
        hudBossCompact.textContent = state.liveNoMiss ? '🏅 NO MISS' : '—';
      } else if (state.bossFrenzy) {
        hudBossCompact.textContent = `${state.bossProfile?.icon || '👾'} FRENZY!`;
      } else if (state.bossPhase2) {
        hudBossCompact.textContent = `${state.bossProfile?.icon || '👾'} PHASE 2`;
      } else {
        hudBossCompact.textContent = `${state.bossProfile?.icon || '👾'} ${state.bossProfile?.label || 'Boss'}`;
      }
    }

    if (bossFill) {
      bossFill.style.width = state.bossActive ? `${Math.max(0, Math.round(state.bossHp || 0))}%` : '0%';
    }

    if (bossStatusRight) {
      if (!state.bossActive) {
        bossStatusRight.textContent = '—';
      } else if (state.bossProfile?.key === 'shield') {
        bossStatusRight.textContent = `HP ${Math.round(state.bossHp || 0)}% • CHAIN ${state.bossChain || 0}`;
      } else {
        bossStatusRight.textContent = `${Math.round(state.bossHp || 0)}%`;
      }
    }

    if (state.timeLeft <= 0) {
      jdFinishRun(state, 'timeup');
      return;
    }

    if (state.stability <= 0) {
      jdFinishRun(state, 'stability-zero');
      return;
    }

    if (state.bossActive && state.bossHp <= 0) {
      jdFinishRun(state, 'boss-down');
      return;
    }

    rafId = requestAnimationFrame(jdTick);
  }

  function bindEvents() {
    document.querySelector('[data-action="start"]')?.addEventListener('click', () => {
      if (state && state.running) return;
      startGame({
        mode: (elMode?.value || HHA_CTX.mode || 'training').toLowerCase(),
        diff: (elDiff?.value || HHA_CTX.diff || 'normal').toLowerCase(),
        durationMs: ((parseInt(elDuration?.value || HHA_CTX.duration || '60', 10) || 60) * 1000)
      });
    });

    document.querySelector('[data-action="tutorial"]')?.addEventListener('click', () => {
      if (state && state.running) return;
      startGame({
        mode: 'training',
        diff: 'easy',
        durationMs: 30000
      });
      jdTelegraph('Tutorial: low = jump • high = duck', 1200);
    });

    document.querySelector('[data-action="play-again"]')?.addEventListener('click', () => {
      hhFitnessRematch({
        score: Number(state?.score || 0),
        miss: Number(state?.miss || 0),
        bestStreak: Number(state?.maxCombo || 0),
        result: 'rematch'
      });

      stopLoop();
      clearRunTimers(state);
      resetTransientUI();
      clearArena();
      showView('menu');
    });

    document.querySelector('[data-action="back-menu"]')?.addEventListener('click', () => {
      stopLoop();
      clearRunTimers(state);
      resetTransientUI();
      clearArena();
      showView('menu');
    });

    $('#btn-jump')?.addEventListener('click', () => jdHandleInput(state, 'jump'));
    $('#btn-duck')?.addEventListener('click', () => jdHandleInput(state, 'duck'));
    $('#btn-stop-early')?.addEventListener('click', () => {
      if (!state || state.finished || state.finishing) return;
      jdFinishRun(state, 'stop-early');
    });

    if (playRoot) {
      playRoot.addEventListener('pointerdown', (ev) => {
        if (!state || !state.running) return;
        const rect = playRoot.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        if (ev.clientY < midY) jdHandleInput(state, 'jump');
        else jdHandleInput(state, 'duck');
      }, { passive:true });
    }

    window.addEventListener('keydown', (ev) => {
      if (!state || !state.running) return;
      const k = String(ev.key || '').toLowerCase();
      if (k === 'arrowup' || k === 'w') jdHandleInput(state, 'jump');
      if (k === 'arrowdown' || k === 's') jdHandleInput(state, 'duck');
    });

    window.addEventListener('resize', () => {
      if (!state) return;
      jdApplyResponsiveLayout(state);
    });

    window.addEventListener('pagehide', () => {
      if (!state) return;
      if (state.finished) return;
      if (state.finishing) return;

      hhFitnessGoHub({
        score: Number(state?.score || 0),
        miss: Number(state?.miss || 0),
        bestStreak: Number(state?.maxCombo || 0),
        result: state?.running ? 'pagehide' : 'leave'
      });
    });

    btnDlEvents?.addEventListener('click', () => {
      const summary = loadJson('HHA_LAST_SUMMARY', null);
      if (!summary || !Array.isArray(summary.eventLog || [])) {
        setLogStatus('ยังไม่มี event log ให้ export', false);
        return;
      }

      downloadCsv(toCsv(summary.eventLog), `jd-events-${Date.now()}.csv`);
      setLogStatus('export events.csv เรียบร้อย', true);
    });

    btnDlSessions?.addEventListener('click', () => {
      const summary = loadJson('HHA_LAST_SUMMARY', null);
      if (!summary || !summary.sessionFeatures) {
        setLogStatus('ยังไม่มี session summary ให้ export', false);
        return;
      }

      downloadCsv(toCsv([summary.sessionFeatures]), `jd-sessions-${Date.now()}.csv`);
      setLogStatus('export sessions.csv เรียบร้อย', true);
    });

    btnDlTeacher?.addEventListener('click', () => {
      const summary = loadJson('HHA_LAST_SUMMARY', null);
      if (!summary || !summary.teacherSummary) {
        setLogStatus('ยังไม่มี teacher summary ให้ export', false);
        return;
      }

      downloadCsv(toCsv([summary.teacherSummary]), `jd-teacher-summary-${Date.now()}.csv`);
      setLogStatus('export teacher-summary.csv เรียบร้อย', true);
    });

    btnSendLog?.addEventListener('click', async () => {
      setLogStatus('ยังไม่ได้เปิด cloud logger ใน patch นี้', false);
    });

    elMode?.addEventListener('change', updateResearchVisibility);
  }

  function init() {
    injectPatchCSS();
    setHubLinks();
    updateResearchVisibility();

    if (elMode && HHA_CTX.mode) elMode.value = HHA_CTX.mode;
    if (elDiff && HHA_CTX.diff) elDiff.value = HHA_CTX.diff;
    if (elDuration && HHA_CTX.duration) elDuration.value = String(HHA_CTX.duration);
    if (elPidInput) elPidInput.value = HHA_CTX.pid || 'anon';

    bindEvents();
    resetPlayHUD();
    resetResultHUD();
    showView('menu');
  }

  init();
})();