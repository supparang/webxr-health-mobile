// === /fitness/js/jumpduck.js ===
// JumpDuck FUNMAX FINAL
// PATCH v20260415j-JUMPDuck-FUNMAX-BOSS-PHASE-THEME
// ✅ Apps Script / Cloud logging paused
// ✅ Fun Pack: mission + power-up + SFX + shake + toast
// ✅ Boss Pack: boss personality + special skill
// ✅ Stage Variety: Sunny/Rainbow/Night/Snow/Lava
// ✅ Boss Phase Theme: each boss has unique background + phase 2 enraged theme
// ✅ Fitness Zone flow + cooldown flow

'use strict';

(function () {
  const D = document;
  const W = window;
  const $ = (s) => D.querySelector(s);

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
  const feverStatus = $('#fever-status');

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
  const resPatternBox = $('#res-pattern');
  const resBossLabel = $('#res-boss-label');
  const resRushBox = $('#res-rush');

  const btnDlEvents = $('#jd-btn-dl-events');
  const btnDlSessions = $('#jd-btn-dl-sessions');
  const btnDlTeacher = $('#jd-btn-dl-teacher');
  const btnSendLog = $('#jd-btn-send-log');
  const btnContinueFlow = $('#jd-btn-continue-flow');
  const logStatus = $('#jd-log-status');

  const FIT_ZONE_FALLBACK = 'https://supparang.github.io/webxr-health-mobile/herohealth/fitness-zone.html';

  let state = null;
  let rafId = 0;
  let JD_AUDIO_CTX = null;

  const qs = (k, d = '') => {
    try {
      return (new URL(location.href)).searchParams.get(k) ?? d;
    } catch (_) {
      return d;
    }
  };

  const qbool = (k, d = false) => {
    const v = String(qs(k, d ? '1' : '0')).trim().toLowerCase();
    return ['1', 'true', 'yes', 'y', 'on'].includes(v);
  };

  const absUrl = (raw, fallback = '') => {
    const value = String(raw || '').trim();
    try {
      if (value) return new URL(value, location.href).href;
    } catch (_) {}
    try {
      if (fallback) return new URL(fallback, location.href).href;
    } catch (_) {}
    return fallback || '';
  };

  const looksLikeFitnessRoot = (href = '') => {
    const s = String(href || '').toLowerCase();
    return (
      s === 'https://supparang.github.io/webxr-health-mobile/fitness' ||
      s === 'https://supparang.github.io/webxr-health-mobile/fitness/' ||
      s.endsWith('/webxr-health-mobile/fitness') ||
      s.endsWith('/webxr-health-mobile/fitness/')
    );
  };

  const resolveFitnessZoneHref = () => {
    const rawHub = absUrl(qs('hub', ''), '');
    const rawHubRoot = absUrl(qs('hubRoot', ''), '');

    if (rawHub && !looksLikeFitnessRoot(rawHub)) return rawHub;
    if (rawHubRoot && !looksLikeFitnessRoot(rawHubRoot)) return rawHubRoot;

    return FIT_ZONE_FALLBACK;
  };

  const resolveLauncherHref = () => {
    const rawLauncher = absUrl(qs('launcher', ''), '');
    if (rawLauncher && !looksLikeFitnessRoot(rawLauncher)) return rawLauncher;

    const u = new URL(location.href);
    u.searchParams.delete('phase');
    u.searchParams.delete('gatePhase');
    u.searchParams.delete('next');
    u.searchParams.delete('nextKey');
    u.searchParams.delete('cdnext');
    u.searchParams.delete('wgskip');
    u.searchParams.delete('autostart');
    u.searchParams.delete('entry');
    u.searchParams.delete('forcegate');
    u.searchParams.delete('resetGate');
    u.searchParams.set('hub', resolveFitnessZoneHref());
    u.searchParams.set('hubRoot', resolveFitnessZoneHref());
    return u.toString();
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
    view: qs('view', 'mobile'),
    pid: qs('pid', 'anon'),
    name: qs('name', qs('nickName', 'Hero')),
    api: qs('api', ''),
    ai: qs('ai', ''),
    debug: qs('debug', ''),
    mode: qs('mode', 'training'),
    duration: qs('duration', qs('time', '60')),
    pro: qs('pro', ''),
    phaseTune: qs('phaseTune', 'dynamicABC'),
    autostart: qbool('autostart', false),
    hub: resolveFitnessZoneHref(),
    hubRoot: resolveFitnessZoneHref(),
    launcher: resolveLauncherHref(),
    game: 'jump-duck',
    gameId: 'jump-duck',
    theme: qs('theme', 'jump-duck'),
    zone: qs('zone', 'fitness'),
    cat: qs('cat', 'fitness')
  };

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

  const JD_TUNING_PRESETS = {
    A: {
      startXMul: { tiny: 1.06, compact: 1.02, desktop: 0.86 },
      gapBase: { tiny: 248, compact: 214, desktop: 144 },
      speedBase: { tiny: 4.9, compact: 5.3, desktop: 6.8 },
      hitHalfWindow: { tiny: 36, compact: 33, desktop: 28 }
    },
    B: {
      startXMul: { tiny: 1.08, compact: 1.04, desktop: 0.84 },
      gapBase: { tiny: 236, compact: 202, desktop: 138 },
      speedBase: { tiny: 5.1, compact: 5.5, desktop: 7.0 },
      hitHalfWindow: { tiny: 35, compact: 32, desktop: 28 }
    },
    C: {
      startXMul: { tiny: 1.10, compact: 1.06, desktop: 0.82 },
      gapBase: { tiny: 222, compact: 190, desktop: 132 },
      speedBase: { tiny: 5.4, compact: 5.8, desktop: 7.2 },
      hitHalfWindow: { tiny: 33, compact: 31, desktop: 27 }
    },
    CPLUS: {
      startXMul: { tiny: 1.12, compact: 1.08, desktop: 0.80 },
      gapBase: { tiny: 210, compact: 180, desktop: 126 },
      speedBase: { tiny: 5.6, compact: 6.0, desktop: 7.4 },
      hitHalfWindow: { tiny: 31, compact: 30, desktop: 26 }
    }
  };

  const JD_STAGE_THEMES = {
    sunny: {
      key: 'sunny',
      label: 'Sunny Field',
      icon: '🌤️',
      toast: '🌤️ Sunny Field! วอร์มอัพให้พร้อม',
      speedMul: 1.00,
      spawnMul: 1.00,
      scoreBonus: 0
    },
    rainbow: {
      key: 'rainbow',
      label: 'Rainbow Road',
      icon: '🌈',
      toast: '🌈 Rainbow Road! คอมโบมีโบนัส',
      speedMul: 1.02,
      spawnMul: 0.98,
      scoreBonus: 2
    },
    night: {
      key: 'night',
      label: 'Night Stadium',
      icon: '🌙',
      toast: '🌙 Night Stadium! โฟกัสให้ดี',
      speedMul: 1.04,
      spawnMul: 0.96,
      scoreBonus: 3
    },
    snow: {
      key: 'snow',
      label: 'Snow Track',
      icon: '❄️',
      toast: '❄️ Snow Track! ระวังจังหวะลื่น',
      speedMul: 0.96,
      spawnMul: 1.04,
      scoreBonus: 1
    },
    lava: {
      key: 'lava',
      label: 'Lava Floor',
      icon: '🌋',
      toast: '🌋 Lava Floor! ช่วงนี้ดุเดือด',
      speedMul: 1.10,
      spawnMul: 0.88,
      scoreBonus: 4
    }
  };

  const JD_BOSS_PROFILES = {
    tempo: {
      key: 'tempo',
      label: 'Tempo Boss',
      icon: '🎵',
      intro: 'จับจังหวะให้เป๊ะ แล้วคอมโบจะพุ่ง!',
      skillName: 'Beat Chain',
      specialToast: '🎵 Beat Chain! กดให้ตรงจังหวะ',
      patterns: ['tempo221', 'tempo121', 'tempoAlt6', 'alt4', 'double-low-high'],
      specialPatterns: ['tempo121', 'tempo221', 'tempoAlt6'],
      burstEveryMs: 3800,
      specialEveryMs: 5200,
      feintChance: 0.00,
      speedMul: 1.06
    },
    feint: {
      key: 'feint',
      label: 'Feint Boss',
      icon: '🧠',
      intro: 'อย่ากดเร็วเกินไป บางอันจะพลิกตอนท้าย',
      skillName: 'Fake Move',
      specialToast: '🧠 Fake Move! อย่ากดเร็วเกินไป',
      patterns: ['feintLate2', 'feintLate3', 'fakePair', 'feint2', 'feint3'],
      specialPatterns: ['feintLate2', 'feintLate3', 'fakePair'],
      burstEveryMs: 4300,
      specialEveryMs: 5800,
      feintChance: 0.42,
      speedMul: 0.98
    },
    shield: {
      key: 'shield',
      label: 'Shield Boss',
      icon: '🛡️',
      intro: 'ต้องตีติดกันเพื่อเจาะเกราะ',
      skillName: 'Armor Guard',
      specialToast: '🛡️ Armor Guard! ทำคอมโบเพื่อเจาะเกราะ',
      patterns: ['shieldPair', 'shieldWall', 'shieldBreaker', 'pair'],
      specialPatterns: ['shieldPair', 'shieldWall', 'shieldBreaker'],
      burstEveryMs: 5000,
      specialEveryMs: 6200,
      feintChance: 0.00,
      speedMul: 1.00
    },
    mirror: {
      key: 'mirror',
      label: 'Mirror Boss',
      icon: '🪞',
      intro: 'จำและอ่านแพทเทิร์นสะท้อนให้ทัน',
      skillName: 'Mirror Echo',
      specialToast: '🪞 Mirror Echo! จำลำดับให้ดี',
      patterns: ['mirrorABBA', 'mirrorBAAB', 'mirrorEcho', 'mirror4'],
      specialPatterns: ['mirrorABBA', 'mirrorBAAB', 'mirrorEcho'],
      burstEveryMs: 4100,
      specialEveryMs: 5600,
      feintChance: 0.03,
      speedMul: 1.03
    },
    chaos: {
      key: 'chaos',
      label: 'Chaos Boss',
      icon: '🌪️',
      intro: 'ช่วงท้ายจะบ้าคลั่งและถี่ขึ้น!',
      skillName: 'Storm Surge',
      specialToast: '🌪️ Storm Surge! ตั้งสติให้ดี',
      patterns: ['chaosBurst5', 'chaosBurst6', 'chaosLadder', 'burst4', 'burst5'],
      specialPatterns: ['chaosBurst5', 'chaosBurst6', 'chaosLadder'],
      burstEveryMs: 3000,
      specialEveryMs: 5000,
      feintChance: 0.08,
      speedMul: 1.12
    }
  };

  const JD_BOSS_THEME_META = {
    tempo: {
      key: 'tempo',
      label: 'Neon Beat Arena',
      icon: '🎵',
      toast: '🎵 เข้าสู่ Neon Beat Arena!',
      enragedToast: '🎵 Tempo Boss เร่งจังหวะแล้ว!'
    },
    feint: {
      key: 'feint',
      label: 'Mind Maze',
      icon: '🧠',
      toast: '🧠 เข้าสู่ Mind Maze!',
      enragedToast: '🧠 Feint Boss หลอกหนักขึ้น!'
    },
    shield: {
      key: 'shield',
      label: 'Armor Castle',
      icon: '🛡️',
      toast: '🛡️ เข้าสู่ Armor Castle!',
      enragedToast: '🛡️ Shield Boss เสริมเกราะแล้ว!'
    },
    mirror: {
      key: 'mirror',
      label: 'Crystal Mirror',
      icon: '🪞',
      toast: '🪞 เข้าสู่ Crystal Mirror!',
      enragedToast: '🪞 Mirror Boss สะท้อนเร็วขึ้น!'
    },
    chaos: {
      key: 'chaos',
      label: 'Storm Rift',
      icon: '🌪️',
      toast: '🌪️ เข้าสู่ Storm Rift!',
      enragedToast: '🌪️ Chaos Boss คลั่งแล้ว!'
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

  function jdClamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
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
      localStorage.setItem(`HHA_LAST_SUMMARY:jump-duck:${String(HHA_CTX.pid || 'anon')}`, JSON.stringify(summary));
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
    const a = D.createElement('a');
    a.href = url;
    a.download = filename;
    D.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function setLogStatus(msg, ok) {
    if (!logStatus) return;
    logStatus.textContent = msg || '';
    logStatus.style.color = ok ? '#22c55e' : '#f59e0b';
  }

  function showView(name) {
    viewMenu?.classList.add('hidden');
    viewPlay?.classList.add('hidden');
    viewResult?.classList.add('hidden');

    if (name === 'menu') viewMenu?.classList.remove('hidden');
    if (name === 'play') viewPlay?.classList.remove('hidden');
    if (name === 'result') viewResult?.classList.remove('hidden');
  }

  function injectPatchCSS() {
    if (D.getElementById('jd-funmax-css-inline')) return;

    const css = D.createElement('style');
    css.id = 'jd-funmax-css-inline';
    css.textContent = `
      .jd-score-pop{
        position:absolute;
        z-index:30;
        transform:translate(-50%,0) scale(.9);
        opacity:0;
        pointer-events:none;
        font-weight:1100;
        font-size:18px;
        color:#fff;
        text-shadow:0 2px 10px rgba(0,0,0,.35);
        transition:transform .18s ease, opacity .18s ease;
      }

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

      .jd-obstacle.variant-heavy{ width:90px; height:82px; }
      .jd-obstacle.variant-mini{ width:64px; height:58px; border-radius:16px; }

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

      .low-hurdle{ bottom:8px; width:58px; height:14px; border-radius:999px; background:linear-gradient(180deg,#38bdf8,#2563eb); }
      .low-hurdle::before,.low-hurdle::after{ content:""; position:absolute; top:8px; width:8px; height:18px; background:#93c5fd; border-radius:4px; }
      .low-hurdle::before{ left:10px; }
      .low-hurdle::after{ right:10px; }

      .low-box{ bottom:8px; width:50px; height:30px; border-radius:12px; background:linear-gradient(180deg,#60a5fa,#2563eb); }

      .low-tyre{
        bottom:2px; width:52px; height:52px; border-radius:50%;
        background:radial-gradient(circle at 50% 50%, #0f172a 28%, #475569 29%, #1e293b 58%, #94a3b8 60%, #0f172a 62%);
      }

      .low-bench{ bottom:14px; width:60px; height:14px; border-radius:8px; background:linear-gradient(180deg,#22d3ee,#0891b2); }
      .low-bench::before,.low-bench::after{ content:""; position:absolute; top:12px; width:8px; height:16px; background:#67e8f9; border-radius:4px; }
      .low-bench::before{ left:10px; }
      .low-bench::after{ right:10px; }

      .low-cones{ bottom:8px; width:58px; height:22px; }
      .low-cones::before,.low-cones::after{
        content:""; position:absolute; bottom:0; width:16px; height:22px;
        clip-path:polygon(50% 0%, 100% 100%, 0% 100%);
        background:linear-gradient(180deg,#67e8f9,#06b6d4);
      }
      .low-cones::before{ left:6px; }
      .low-cones::after{ right:6px; }

      .low-heavy{
        bottom:4px; width:64px; height:40px; border-radius:14px;
        background:linear-gradient(180deg,#1d4ed8,#1e3a8a);
        box-shadow:inset 0 0 0 3px rgba(191,219,254,.25);
      }

      .low-heavy::before{
        content:""; position:absolute; left:8px; right:8px; bottom:8px; height:8px;
        border-radius:999px; background:rgba(255,255,255,.18);
      }

      .low-mini{ bottom:16px; width:32px; height:18px; border-radius:999px; background:linear-gradient(180deg,#67e8f9,#06b6d4); }

      .high-bar{ top:10px; width:62px; height:14px; border-radius:999px; background:linear-gradient(180deg,#f59e0b,#ef4444); }
      .high-bar::before,.high-bar::after{ content:""; position:absolute; top:10px; width:8px; height:22px; border-radius:999px; background:#fdba74; }
      .high-bar::before{ left:8px; }
      .high-bar::after{ right:8px; }

      .high-ribbon{ top:14px; width:66px; height:10px; border-radius:999px; background:linear-gradient(90deg,#fb7185,#ef4444,#fb7185); }

      .high-ball{
        top:8px; width:34px; height:34px; border-radius:50%;
        background:radial-gradient(circle at 35% 35%, #fde68a, #f59e0b 55%, #b45309 100%);
      }

      .high-ball::after{
        content:""; position:absolute; left:50%; top:30px; transform:translateX(-50%);
        width:42px; height:8px; border-radius:999px; background:linear-gradient(90deg,#f59e0b,#ef4444);
      }

      .high-beam{ top:12px; width:68px; height:16px; border-radius:8px; background:linear-gradient(180deg,#fb7185,#dc2626); }

      .high-tape{
        top:20px; width:64px; height:8px; border-radius:999px;
        background:linear-gradient(90deg,#fda4af,#ef4444,#fda4af);
        box-shadow:0 0 0 6px rgba(239,68,68,.06);
      }

      .high-heavy{
        top:8px; width:70px; height:22px; border-radius:10px;
        background:linear-gradient(180deg,#dc2626,#7f1d1d);
        box-shadow:inset 0 0 0 3px rgba(254,202,202,.22);
      }

      .high-heavy::before,.high-heavy::after{
        content:""; position:absolute; top:14px; width:8px; height:18px; border-radius:999px; background:#fca5a5;
      }
      .high-heavy::before{ left:10px; }
      .high-heavy::after{ right:10px; }

      .high-mini{ top:20px; width:34px; height:10px; border-radius:999px; background:linear-gradient(90deg,#fda4af,#ef4444,#fda4af); }

      .jd-fun-toast{
        position:absolute;
        left:50%;
        top:92px;
        transform:translateX(-50%) translateY(-8px) scale(.96);
        z-index:38;
        min-width:190px;
        max-width:min(86vw,520px);
        min-height:44px;
        padding:10px 16px;
        border-radius:999px;
        display:grid;
        place-items:center;
        text-align:center;
        font-size:15px;
        font-weight:1100;
        color:#23435a;
        background:rgba(255,255,255,.96);
        border:2px solid rgba(255,224,138,.9);
        box-shadow:0 14px 28px rgba(63,122,156,.16);
        opacity:0;
        pointer-events:none;
        transition:opacity .16s ease, transform .16s ease;
      }

      .jd-fun-toast.show{
        opacity:1;
        transform:translateX(-50%) translateY(0) scale(1);
      }

      .jd-fun-toast.good{ border-color:#bbf7d0; color:#166534; }
      .jd-fun-toast.warn{ border-color:#fecaca; color:#991b1b; }
      .jd-fun-toast.boss{ border-color:#fcd34d; color:#7c2d12; background:#fff7ed; }
      .jd-fun-toast.power{ border-color:#bae6fd; color:#075985; background:#f0f9ff; }

      .jd-mission-hud{
        position:absolute;
        left:10px;
        top:10px;
        z-index:32;
        width:min(300px,72vw);
        display:grid;
        gap:6px;
        pointer-events:none;
      }

      .jd-mission-title{
        display:inline-flex;
        width:max-content;
        max-width:100%;
        min-height:30px;
        padding:6px 10px;
        border-radius:999px;
        background:rgba(255,255,255,.94);
        border:2px solid rgba(215,237,247,.95);
        color:#1e5678;
        font-size:12px;
        font-weight:1100;
        box-shadow:0 8px 18px rgba(63,122,156,.10);
      }

      .jd-mission-item{
        min-height:34px;
        padding:7px 10px;
        border-radius:14px;
        background:rgba(255,255,255,.90);
        border:2px solid rgba(215,237,247,.88);
        color:#23435a;
        font-size:12px;
        font-weight:1000;
        display:grid;
        grid-template-columns:1fr auto;
        gap:8px;
        align-items:center;
        box-shadow:0 8px 18px rgba(63,122,156,.08);
      }

      .jd-mission-item.done{
        background:#f0fdf4;
        border-color:#bbf7d0;
        color:#166534;
      }

      .jd-powerup{
        position:absolute;
        left:0;
        bottom:176px;
        width:58px;
        height:58px;
        border-radius:50%;
        z-index:13;
        display:grid;
        place-items:center;
        font-size:28px;
        background:linear-gradient(180deg,#ffffff,#e0f2fe);
        border:3px solid #bae6fd;
        box-shadow:0 0 0 8px rgba(186,230,253,.22),0 14px 26px rgba(63,122,156,.18);
        animation:jdPowerFloat .82s ease-in-out infinite alternate;
        will-change:transform;
      }

      @keyframes jdPowerFloat{
        from{ filter:brightness(1); }
        to{ filter:brightness(1.14); }
      }

      #jd-play-area.fun-shake-small{ animation:jdShakeSmall .18s linear 1; }
      #jd-play-area.fun-shake-big{ animation:jdShakeBig .24s linear 1; }

      @keyframes jdShakeSmall{
        0%,100%{ transform:translateX(0); }
        25%{ transform:translateX(-3px); }
        50%{ transform:translateX(3px); }
        75%{ transform:translateX(-2px); }
      }

      @keyframes jdShakeBig{
        0%,100%{ transform:translateX(0); }
        20%{ transform:translateX(-7px); }
        40%{ transform:translateX(7px); }
        60%{ transform:translateX(-5px); }
        80%{ transform:translateX(5px); }
      }

      .jd-stage-banner{
        position:absolute;
        right:10px;
        top:10px;
        z-index:32;
        min-height:34px;
        padding:7px 12px;
        border-radius:999px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:6px;
        background:rgba(255,255,255,.92);
        border:2px solid rgba(215,237,247,.92);
        color:#1e5678;
        font-size:12px;
        font-weight:1100;
        box-shadow:0 8px 18px rgba(63,122,156,.10);
        pointer-events:none;
      }

      #jd-play-area{
        transition:background .42s ease, filter .22s ease;
      }

      #jd-play-area.stage-sunny{
        background:
          radial-gradient(circle at 18% 18%, rgba(255,255,255,.86), transparent 18%),
          radial-gradient(circle at 80% 18%, rgba(255,235,160,.55), transparent 14%),
          linear-gradient(180deg,#dff6ff 0%,#f7fdff 64%,#dff7d2 64%,#b9ef9f 100%);
      }

      #jd-play-area.stage-rainbow{
        background:
          radial-gradient(circle at 24% 18%, rgba(255,255,255,.84), transparent 18%),
          linear-gradient(135deg,rgba(255,214,232,.88),rgba(220,244,255,.9),rgba(232,255,215,.88)),
          linear-gradient(180deg,#e9fbff 0%,#fff 64%,#d7f7c8 64%,#a6e98a 100%);
      }

      #jd-play-area.stage-night{
        background:
          radial-gradient(circle at 20% 18%, rgba(255,255,255,.38), transparent 8%),
          radial-gradient(circle at 70% 20%, rgba(255,255,255,.18), transparent 5%),
          linear-gradient(180deg,#172554 0%,#1e3a8a 54%,#23345f 54%,#1f2a44 100%);
      }

      #jd-play-area.stage-lava{
        background:
          radial-gradient(circle at 76% 18%, rgba(255,198,120,.42), transparent 18%),
          linear-gradient(180deg,#431407 0%,#7c2d12 58%,#3b140c 58%,#250b08 100%);
      }

      #jd-play-area.stage-snow{
        background:
          radial-gradient(circle at 18% 20%, rgba(255,255,255,.88), transparent 18%),
          linear-gradient(180deg,#e0f2fe 0%,#f8fbff 60%,#eaf7ff 60%,#dbeafe 100%);
      }

      #jd-play-area.stage-night #jd-ground{
        background:linear-gradient(180deg,#334155,#1e293b);
        border-top-color:rgba(148,163,184,.28);
      }

      #jd-play-area.stage-lava #jd-ground{
        background:
          radial-gradient(circle at 20% 38%, rgba(251,146,60,.55), transparent 16%),
          radial-gradient(circle at 74% 48%, rgba(239,68,68,.45), transparent 18%),
          linear-gradient(180deg,#7c2d12,#1c0705);
        border-top-color:rgba(251,146,60,.45);
      }

      #jd-play-area.stage-snow #jd-ground{
        background:
          radial-gradient(circle at 16% 40%, rgba(255,255,255,.8), transparent 16%),
          radial-gradient(circle at 72% 32%, rgba(255,255,255,.72), transparent 18%),
          linear-gradient(180deg,#eff6ff,#bfdbfe);
        border-top-color:rgba(147,197,253,.45);
      }

      .jd-stage-flake,
      .jd-stage-spark,
      .jd-stage-star{
        position:absolute;
        z-index:3;
        pointer-events:none;
        opacity:.82;
        animation:jdStageFloat 2.4s linear infinite;
      }

      .jd-stage-flake{ color:#fff; font-size:18px; }
      .jd-stage-spark{ color:#f97316; font-size:20px; }
      .jd-stage-star{ color:#fde68a; font-size:15px; }

      @keyframes jdStageFloat{
        from{ transform:translateY(-20px) rotate(0deg); opacity:.1; }
        20%{ opacity:.85; }
        to{ transform:translateY(260px) rotate(160deg); opacity:0; }
      }

      #jd-play-area.phase-boss-gate{
        background:
          radial-gradient(circle at 50% 18%, rgba(255,255,255,.38), transparent 12%),
          radial-gradient(circle at 22% 22%, rgba(251,191,36,.28), transparent 16%),
          linear-gradient(180deg,#1e293b 0%,#334155 54%,#111827 54%,#0f172a 100%) !important;
      }

      #jd-play-area.phase-boss-gate #jd-ground{
        background:linear-gradient(180deg,#475569,#1e293b) !important;
        border-top-color:rgba(251,191,36,.36) !important;
      }

      #jd-play-area.boss-theme-tempo{
        background:
          radial-gradient(circle at 50% 18%, rgba(255,255,255,.42), transparent 12%),
          repeating-linear-gradient(90deg, rgba(56,189,248,.14) 0 12px, rgba(168,85,247,.13) 12px 24px),
          linear-gradient(180deg,#0f172a 0%,#1e1b4b 58%,#172554 58%,#0f172a 100%) !important;
      }

      #jd-play-area.boss-theme-tempo #jd-ground{
        background:
          repeating-linear-gradient(90deg, rgba(56,189,248,.24) 0 18px, rgba(168,85,247,.20) 18px 36px),
          linear-gradient(180deg,#312e81,#111827) !important;
        border-top-color:rgba(56,189,248,.55) !important;
      }

      #jd-play-area.boss-theme-feint{
        background:
          radial-gradient(circle at 70% 18%, rgba(216,180,254,.35), transparent 14%),
          radial-gradient(circle at 22% 28%, rgba(244,114,182,.20), transparent 18%),
          linear-gradient(180deg,#2e1065 0%,#581c87 56%,#1e1b4b 56%,#111827 100%) !important;
      }

      #jd-play-area.boss-theme-feint #jd-ground{
        background:
          repeating-linear-gradient(135deg, rgba(192,132,252,.20) 0 16px, rgba(244,114,182,.16) 16px 32px),
          linear-gradient(180deg,#581c87,#1e1b4b) !important;
        border-top-color:rgba(216,180,254,.46) !important;
      }

      #jd-play-area.boss-theme-shield{
        background:
          radial-gradient(circle at 50% 18%, rgba(226,232,240,.45), transparent 13%),
          linear-gradient(180deg,#334155 0%,#475569 52%,#1f2937 52%,#0f172a 100%) !important;
      }

      #jd-play-area.boss-theme-shield #jd-ground{
        background:
          repeating-linear-gradient(90deg, rgba(203,213,225,.20) 0 24px, rgba(100,116,139,.18) 24px 48px),
          linear-gradient(180deg,#64748b,#1e293b) !important;
        border-top-color:rgba(203,213,225,.52) !important;
      }

      #jd-play-area.boss-theme-mirror{
        background:
          radial-gradient(circle at 32% 20%, rgba(255,255,255,.55), transparent 12%),
          radial-gradient(circle at 74% 28%, rgba(125,211,252,.35), transparent 15%),
          linear-gradient(135deg,#dff7ff 0%,#bae6fd 32%,#e0e7ff 64%,#93c5fd 100%) !important;
      }

      #jd-play-area.boss-theme-mirror #jd-ground{
        background:
          linear-gradient(135deg, rgba(255,255,255,.78), rgba(147,197,253,.72), rgba(224,231,255,.8)),
          linear-gradient(180deg,#bfdbfe,#93c5fd) !important;
        border-top-color:rgba(255,255,255,.72) !important;
      }

      #jd-play-area.boss-theme-chaos{
        background:
          radial-gradient(circle at 74% 16%, rgba(239,68,68,.38), transparent 18%),
          radial-gradient(circle at 22% 24%, rgba(251,146,60,.30), transparent 16%),
          linear-gradient(160deg,#111827 0%,#431407 38%,#7f1d1d 70%,#0f172a 100%) !important;
      }

      #jd-play-area.boss-theme-chaos #jd-ground{
        background:
          radial-gradient(circle at 20% 38%, rgba(251,146,60,.65), transparent 16%),
          radial-gradient(circle at 74% 48%, rgba(239,68,68,.55), transparent 18%),
          linear-gradient(180deg,#7f1d1d,#1c0705) !important;
        border-top-color:rgba(251,146,60,.55) !important;
      }

      #jd-play-area.boss-enraged{
        filter:saturate(1.18) contrast(1.04);
      }

      #jd-play-area.boss-theme-tempo.boss-enraged{
        background:
          radial-gradient(circle at 50% 18%, rgba(255,255,255,.55), transparent 12%),
          repeating-linear-gradient(90deg, rgba(34,211,238,.24) 0 10px, rgba(244,114,182,.22) 10px 20px),
          linear-gradient(180deg,#0f172a 0%,#4c1d95 56%,#172554 56%,#020617 100%) !important;
      }

      #jd-play-area.boss-theme-feint.boss-enraged{
        background:
          radial-gradient(circle at 50% 18%, rgba(244,114,182,.42), transparent 18%),
          repeating-linear-gradient(135deg, rgba(216,180,254,.20) 0 16px, rgba(88,28,135,.34) 16px 32px),
          linear-gradient(180deg,#3b0764 0%,#701a75 58%,#1e1b4b 58%,#020617 100%) !important;
      }

      #jd-play-area.boss-theme-shield.boss-enraged{
        background:
          radial-gradient(circle at 50% 18%, rgba(248,250,252,.52), transparent 13%),
          repeating-linear-gradient(90deg, rgba(226,232,240,.22) 0 20px, rgba(71,85,105,.36) 20px 40px),
          linear-gradient(180deg,#475569 0%,#1f2937 56%,#020617 100%) !important;
      }

      #jd-play-area.boss-theme-mirror.boss-enraged{
        background:
          radial-gradient(circle at 34% 20%, rgba(255,255,255,.72), transparent 14%),
          radial-gradient(circle at 72% 28%, rgba(14,165,233,.48), transparent 18%),
          linear-gradient(135deg,#f8fafc 0%,#7dd3fc 32%,#c4b5fd 66%,#38bdf8 100%) !important;
      }

      #jd-play-area.boss-theme-chaos.boss-enraged{
        background:
          radial-gradient(circle at 72% 16%, rgba(248,113,113,.58), transparent 18%),
          radial-gradient(circle at 24% 26%, rgba(251,146,60,.48), transparent 16%),
          repeating-linear-gradient(135deg, rgba(239,68,68,.18) 0 18px, rgba(15,23,42,.22) 18px 36px),
          linear-gradient(160deg,#020617 0%,#7f1d1d 42%,#ea580c 70%,#111827 100%) !important;
      }

      @media (max-width:620px){
        .jd-mission-hud{
          left:8px;
          top:8px;
          width:min(260px,70vw);
        }

        .jd-mission-item{
          font-size:11px;
          min-height:30px;
          padding:6px 8px;
        }

        .jd-fun-toast{
          top:76px;
          font-size:13px;
          min-height:40px;
          padding:8px 12px;
        }

        .jd-powerup{
          width:50px;
          height:50px;
          font-size:24px;
        }

        .jd-stage-banner{
          right:8px;
          top:48px;
          font-size:11px;
          min-height:30px;
          padding:6px 9px;
        }
      }
    `;

    D.head.appendChild(css);
  }

  function jdSfx(type = 'hit') {
    try {
      const AC = W.AudioContext || W.webkitAudioContext;
      if (!AC) return;

      if (!JD_AUDIO_CTX) JD_AUDIO_CTX = new AC();
      const ctx = JD_AUDIO_CTX;

      if (ctx.state === 'suspended') ctx.resume().catch(() => {});

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      const map = {
        start:   { f1: 520, f2: 720, dur: .12, vol: .045 },
        hit:     { f1: 660, f2: 880, dur: .10, vol: .042 },
        perfect: { f1: 880, f2: 1320, dur: .14, vol: .052 },
        miss:    { f1: 180, f2: 120, dur: .18, vol: .055 },
        power:   { f1: 740, f2: 1180, dur: .18, vol: .052 },
        mission: { f1: 620, f2: 1040, dur: .20, vol: .055 },
        boss:    { f1: 120, f2: 260, dur: .34, vol: .060 },
        win:     { f1: 760, f2: 1280, dur: .26, vol: .055 },
        warn:    { f1: 240, f2: 190, dur: .20, vol: .045 }
      };

      const cfg = map[type] || map.hit;
      const t = ctx.currentTime;

      osc.type = type === 'miss' || type === 'boss' ? 'sawtooth' : 'sine';
      osc.frequency.setValueAtTime(cfg.f1, t);
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, cfg.f2), t + cfg.dur);

      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(cfg.vol, t + .012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + cfg.dur);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + cfg.dur + .02);
    } catch (_) {}
  }

  function jdFunToast(msg, kind = 'good', ms = 760) {
    if (!playRoot) return;

    let el = D.getElementById('jd-fun-toast');
    if (!el) {
      el = D.createElement('div');
      el.id = 'jd-fun-toast';
      el.className = 'jd-fun-toast';
      playRoot.appendChild(el);
    }

    el.textContent = msg;
    el.className = `jd-fun-toast ${kind}`.trim();

    requestAnimationFrame(() => el.classList.add('show'));

    clearTimeout(el.__timer);
    el.__timer = setTimeout(() => {
      el.classList.remove('show');
    }, ms);
  }

  function jdFunShake(kind = 'small') {
    if (!playRoot) return;
    const cls = kind === 'big' ? 'fun-shake-big' : 'fun-shake-small';
    playRoot.classList.remove('fun-shake-small', 'fun-shake-big');
    void playRoot.offsetWidth;
    playRoot.classList.add(cls);
    setTimeout(() => playRoot.classList.remove(cls), kind === 'big' ? 260 : 200);
  }

  function jdFlash(root, kind = 'good') {
    if (!root) return;
    root.classList.remove('fx-good', 'fx-perfect', 'fx-miss', 'fx-fever', 'fx-bosshit');
    root.classList.add(`fx-${kind}`);
    setTimeout(() => root.classList.remove(`fx-${kind}`), 180);
  }

  function jdScorePop(root, x, y, text, className = '') {
    if (!root) return;

    const el = D.createElement('div');
    el.className = `jd-score-pop ${className}`.trim();
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;

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
    }, 560);
  }

  function jdAvatarEl() {
    return avatar || D.getElementById('jd-avatar');
  }

  function jdSetAvatarMood(mood = 'happy') {
    const el = jdAvatarEl();
    if (!el) return;
    el.classList.remove('mood-happy', 'mood-focus', 'mood-wow', 'mood-sad', 'mood-fever', 'mood-bossdown');
    el.classList.add(`mood-${mood}`);
  }

  function jdSetAvatarRank(rank = 'c') {
    const el = jdAvatarEl();
    if (!el) return;
    el.classList.remove('rank-s', 'rank-a', 'rank-b', 'rank-c', 'rank-d');
    el.classList.add(`rank-${String(rank || 'c').toLowerCase()}`);
  }

  function jdClearAvatarRank() {
    const el = jdAvatarEl();
    if (!el) return;
    el.classList.remove('rank-s', 'rank-a', 'rank-b', 'rank-c', 'rank-d');
  }

  function jdAvatarCheerBossDown() {
    const el = jdAvatarEl();
    if (!el) return;
    el.classList.add('mood-bossdown');
    setTimeout(() => {
      el.classList.remove('mood-bossdown');
    }, 900);
  }

  function hhFitnessBaseSnapshot() {
    const s = state;
    const durationSec = s && s.duration
      ? Math.round(Number(s.duration || 0) / 1000)
      : Number(HHA_CTX.duration || HHA_CTX.time || 60);

    return {
      zone: 'fitness',
      gameId: 'jump-duck',
      game: 'jump-duck',
      pid: String(HHA_CTX.pid || 'anon'),
      name: String(HHA_CTX.name || 'Hero'),
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
      W.HH_FITNESS_LASTGAME?.writeSnapshot({
        ...hhFitnessBaseSnapshot(),
        event: eventName,
        ...extra
      });
    } catch (_) {}
  }

  function hhFitnessSessionStart(extra = {}) { hhFitnessMark('session_start', extra); }
  function hhFitnessSummaryEnd(extra = {}) { hhFitnessMark('summary_end', extra); }
  function hhFitnessRematch(extra = {}) { hhFitnessMark('rematch', extra); }
  function hhFitnessGoHub(extra = {}) { hhFitnessMark('go_hub', extra); }

  function buildCooldownGateHref(summary = {}) {
    const u = new URL('../herohealth/warmup-gate.html', location.href);
    const zoneHref = HHA_CTX.hub || FIT_ZONE_FALLBACK;
    const launcherHref = HHA_CTX.launcher || resolveLauncherHref();

    u.searchParams.set('phase', 'cooldown');
    u.searchParams.set('game', 'jump-duck');
    u.searchParams.set('gameId', 'jump-duck');
    u.searchParams.set('theme', 'jump-duck');
    u.searchParams.set('zone', 'fitness');
    u.searchParams.set('cat', 'fitness');
    u.searchParams.set('pid', String(HHA_CTX.pid || 'anon'));
    if (HHA_CTX.name) u.searchParams.set('name', HHA_CTX.name);
    if (HHA_CTX.studyId) u.searchParams.set('studyId', HHA_CTX.studyId);
    u.searchParams.set('run', String(HHA_CTX.run || 'play'));
    u.searchParams.set('diff', String(summary.diff || HHA_CTX.diff || 'normal'));
    u.searchParams.set('time', String(summary.time || HHA_CTX.time || '60'));
    u.searchParams.set('view', String(HHA_CTX.view || 'mobile'));
    u.searchParams.set('seed', String(HHA_CTX.seed || Date.now()));
    u.searchParams.set('mode', String(summary.mode || HHA_CTX.mode || 'training'));
    u.searchParams.set('hub', zoneHref);
    u.searchParams.set('hubRoot', zoneHref);
    u.searchParams.set('launcher', launcherHref);
    u.searchParams.set('next', zoneHref);
    u.searchParams.set('cdnext', zoneHref);

    if (summary.score != null) u.searchParams.set('score', String(summary.score));
    if (summary.miss != null) u.searchParams.set('miss', String(summary.miss));
    if (summary.accPct != null) u.searchParams.set('accuracy', Number(summary.accPct).toFixed(1));
    if (summary.bestStreak != null) u.searchParams.set('bestStreak', String(summary.bestStreak));
    if (summary.rank) u.searchParams.set('grade', String(summary.rank).toUpperCase());

    return u.toString();
  }

  function setHubLinks() {
    const hub = HHA_CTX.hub || FIT_ZONE_FALLBACK;
    const ids = ['jd-go-zone-menu', 'jd-back-hub-menu', 'jd-control-hub', 'jd-back-hub-play', 'jd-back-hub-result'];

    ids.forEach(id => {
      const el = D.getElementById(id);
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

    clearTimeout(state?.teleTimer);
    if (state) {
      state.teleTimer = setTimeout(() => {
        tele.classList.add('hidden');
      }, ms);
    }
  }

  function jdShowBossIntro(msg) {
    if (!bossIntro || !bossIntroText) return;
    bossIntroText.textContent = msg;
    bossIntro.classList.remove('hidden');

    clearTimeout(state?.bossIntroTimer);
    if (state) {
      state.bossIntroTimer = setTimeout(() => {
        bossIntro.classList.add('hidden');
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

  function jdRemoveBossThemeClasses() {
    if (!playRoot) return;

    playRoot.classList.remove(
      'phase-boss-gate',
      'boss-theme-tempo',
      'boss-theme-feint',
      'boss-theme-shield',
      'boss-theme-mirror',
      'boss-theme-chaos',
      'boss-enraged'
    );
  }

  function resetTransientUI() {
    judgeEl?.classList.remove('show');
    tele?.classList.add('hidden');
    bossIntro?.classList.add('hidden');
    rushBanner?.classList.add('hidden');

    if (playRoot) {
      playRoot.classList.remove('phase-1', 'phase-2', 'phase-3', 'final-rush', 'boss-frenzy');
      playRoot.classList.remove('fx-good', 'fx-perfect', 'fx-miss', 'fx-fever', 'fx-bosshit');
      playRoot.classList.remove('stage-sunny', 'stage-rainbow', 'stage-night', 'stage-snow', 'stage-lava');
      jdRemoveBossThemeClasses();
    }

    D.querySelectorAll('.jd-fun-toast,.jd-mission-hud,.jd-stage-banner,.jd-stage-flake,.jd-stage-spark,.jd-stage-star,.jd-powerup').forEach(el => el.remove());

    jdSetAvatarMood('happy');
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

  function jdResultHeadline(rank) {
    if (rank === 'S') {
      return {
        title: 'สุดยอดมาก!',
        sub: 'รอบนี้เล่นได้เก่งมากและแม่นมาก'
      };
    }

    if (rank === 'A') {
      return {
        title: 'เยี่ยมมาก!',
        sub: 'อีกนิดเดียวก็ถึงระดับสูงสุดแล้ว'
      };
    }

    if (rank === 'B') {
      return {
        title: 'ดีมาก!',
        sub: 'เริ่มจับจังหวะได้ดีแล้ว'
      };
    }

    if (rank === 'C') {
      return {
        title: 'ผ่านแล้ว! แต่ยังไปได้อีก',
        sub: 'เริ่มจับจังหวะได้แล้ว ลองพลาดให้น้อยลง และทำคอมโบให้สูงขึ้น'
      };
    }

    return {
      title: 'ลองอีกครั้งนะ',
      sub: 'รอบหน้าลองดูสิ่งกีดขวางให้เร็วขึ้นอีกนิด'
    };
  }

  function resetResultHUD() {
    if (rankBadge) {
      rankBadge.textContent = 'C';
      rankBadge.classList.remove('rank-s', 'rank-a', 'rank-b', 'rank-c', 'rank-d');
      rankBadge.classList.add('rank-c');
    }

    if (resultTitle) resultTitle.textContent = 'ผ่านแล้ว! แต่ยังไปได้อีก';
    if (resultSub) resultSub.textContent = 'รอบหน้าลองพลาดให้น้อยลง และทำคอมโบให้สูงขึ้น';

    if (resultReward) resultReward.textContent = 'ผ่านด่านแล้ว';
    if (resultRewardIcon) resultRewardIcon.textContent = '⭐';
    if (resultRewardSub) resultRewardSub.textContent = 'ลองดูสิ่งกีดขวางให้ชัดขึ้น แล้วค่อยกด';

    if (coachTip1) coachTip1.textContent = 'รอบหน้าลองดูรูปสิ่งกีดขวางให้ชัดก่อนกด';

    if (resScoreBig) resScoreBig.textContent = '0';
    if (resMiss) resMiss.textContent = '0';
    if (resComboBig) resComboBig.textContent = '0';

    if (resultBoss) resultBoss.textContent = '—';
    if (resultPattern) resultPattern.textContent = '—';
    if (resultRush) resultRush.textContent = '—';

    if (coachTitle) coachTitle.textContent = 'โค้ชแนะนำ';
    if (coachSummary) coachSummary.textContent = 'สรุปคำแนะนำหลังจบเกม';
    if (coachTip2) coachTip2.textContent = '—';

    if (resMode) resMode.textContent = '-';
    if (resDiff) resDiff.textContent = '-';
    if (resDuration) resDuration.textContent = '-';
    if (resTotalObs) resTotalObs.textContent = '0';
    if (resHits) resHits.textContent = '0';
    if (resJumpHit) resJumpHit.textContent = '0';
    if (resDuckHit) resDuckHit.textContent = '0';
    if (resJumpMiss) resJumpMiss.textContent = '0';
    if (resDuckMiss) resDuckMiss.textContent = '0';
    if (resAcc) resAcc.textContent = '0%';
    if (resRTMean) resRTMean.textContent = '0';
    if (resStabilityMin) resStabilityMin.textContent = '0%';
    if (resScore) resScore.textContent = '0';
    if (resRank) resRank.textContent = 'C';
    if (resAccBig) resAccBig.textContent = '0%';
    if (resBossEndBig) resBossEndBig.textContent = '—';
    if (resPhaseEnd) resPhaseEnd.textContent = '-';
    if (resPatternBox) resPatternBox.textContent = '-';
    if (resBossLabel) resBossLabel.textContent = '-';
    if (resRushBox) resRushBox.textContent = '-';

    setLogStatus('', true);
    jdClearAvatarRank();
  }

  function clearArena() {
    if (obsLayer) obsLayer.innerHTML = '';
    D.querySelectorAll('.jd-score-pop').forEach(el => el.remove());
    D.querySelectorAll('.jd-powerup').forEach(el => el.remove());

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
    jdClearAvatarRank();
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
    const w = Math.max(320, playRoot?.clientWidth || arena?.clientWidth || W.innerWidth || 360);

    let profile = 'desktop';
    if (w <= 430) profile = 'tiny';
    else if (w <= 820) profile = 'compact';
    else profile = 'desktop';

    let hitLineX;
    let avatarLeftPct;

    if (profile === 'tiny') {
      hitLineX = 96;
      avatarLeftPct = 0.062;
    } else if (profile === 'compact') {
      hitLineX = 110;
      avatarLeftPct = 0.094;
    } else {
      hitLineX = 144;
      avatarLeftPct = 0.135;
    }

    return { width: w, profile, hitLineX, avatarLeftPct };
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

    const hitline = D.getElementById('jd-hitline');
    if (hitline) hitline.style.left = `${m.hitLineX}px`;

    if (avatar) {
      avatar.style.left = `${Math.round(m.avatarLeftPct * 1000) / 10}%`;

      if (m.profile === 'tiny') {
        avatar.style.width = '88px';
        avatar.style.height = '110px';
      } else if (m.profile === 'compact') {
        avatar.style.width = '98px';
        avatar.style.height = '122px';
      } else {
        avatar.style.width = '110px';
        avatar.style.height = '136px';
      }
    }

    const tune = jdGetTuningForState(s);
    s.tuneKey = tune.key;
    s.startXBase = tune.startX;
    s.gapBase = tune.gapBase;
    s.hitHalfWindow = tune.hitHalfWindow;

    if (!s.userBaseSpeedLocked) s.baseSpeed = tune.speedBase;
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
        return [rng() < 0.5 ? 'low' : 'high', rng() < 0.5 ? 'low' : 'high', rng() < 0.5 ? 'low' : 'high'];

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

  function jdWaveGap(s, indexInSeq, seqLength) {
    const rng = s.rng || Math.random;
    const compact = s.layoutProfile === 'compact' || s.layoutProfile === 'tiny';

    let baseGap = Number(s.gapBase || (compact ? 170 : 136));
    const style = jdPatternSpacingStyle(s.lastPattern || '');

    if (style === 'tempo') {
      const unit = compact ? 146 : 96;
      return unit + (indexInSeq % 2 === 0 ? 0 : 10);
    }

    if (style === 'mirror') {
      const mirrorSetsCompact = [156, 174, 174, 156, 166, 166];
      const mirrorSetsDesktop = [98, 124, 124, 98, 118, 118];
      const arr = compact ? mirrorSetsCompact : mirrorSetsDesktop;
      return arr[indexInSeq] ?? arr[arr.length - 1];
    }

    if (style === 'shield') {
      const shieldGap = compact ? 144 : 92;
      return shieldGap + (seqLength >= 5 ? 6 : 0);
    }

    if (style === 'chaos') {
      const compactChaos = [150, 140, 130, 120, 110, 102, 96];
      const desktopChaos = [104, 96, 88, 80, 74, 70, 68];
      const arr = compact ? compactChaos : desktopChaos;
      return arr[indexInSeq] ?? (compact ? 96 : 68);
    }

    if (style === 'feint') {
      const compactFeint = [158, 144, 128, 118, 110];
      const desktopFeint = [108, 98, 84, 78, 72];
      const arr = compact ? compactFeint : desktopFeint;
      return arr[indexInSeq] ?? (compact ? 110 : 72);
    }

    if (s.finalRush) baseGap -= 2;
    if (s.bossActive) baseGap -= 2;
    if (s.bossFrenzy) baseGap -= 3;
    if (seqLength >= 4) baseGap -= 2;

    if (compact) {
      baseGap += 18;
      if (indexInSeq > 0) baseGap += 10;
      if (seqLength >= 3) baseGap += 8;
    }

    const jitter = compact ? (14 + Math.floor(rng() * 14)) : (8 + Math.floor(rng() * 10));
    return Math.max(compact ? 132 : 82, baseGap + (indexInSeq * 3) + jitter);
  }

  function jdShouldHoldSpawnForReadability(s) {
    if (!s) return false;

    const compact = s.layoutProfile === 'compact' || s.layoutProfile === 'tiny';
    if (!compact) return false;

    const hitX = Number(s.hitLineX || 100);

    const active = (s.obstacles || []).filter(obs =>
      obs &&
      !obs.resolved &&
      obs.x > (hitX - 40) &&
      obs.x < (hitX + 320)
    );

    if (active.length >= 2) return true;

    const hasNearLow = active.some(obs => obs.type === 'low' && obs.x < hitX + 190);
    const hasNearHigh = active.some(obs => obs.type === 'high' && obs.x < hitX + 210);

    if (hasNearLow && hasNearHigh) return true;
    if (hasNearLow) return true;

    return false;
  }

  function jdGetSpawnFloorX(s) {
    if (!s) return 0;

    const compact = s.layoutProfile === 'compact' || s.layoutProfile === 'tiny';
    if (!compact) return 0;

    const active = (s.obstacles || []).filter(obs => obs && !obs.resolved);
    if (!active.length) return 0;

    const farthest = Math.max(...active.map(obs => Number(obs.x || 0)));
    return farthest + (s.layoutProfile === 'tiny' ? 178 : 156);
  }

  function jdObstacleBehaviorByVisualKey(key) {
    const k = String(key || '');

    if (k.endsWith('-heavy')) {
      return { variant: 'heavy', speedMul: 0.90, bonusScore: 4, judgeBiasMs: -8 };
    }

    if (k.endsWith('-mini')) {
      return { variant: 'mini', speedMul: 1.18, bonusScore: 3, judgeBiasMs: 10 };
    }

    return { variant: 'normal', speedMul: 1.00, bonusScore: 0, judgeBiasMs: 0 };
  }

  function jdPatternTag(pattern) {
    if (pattern.includes('tempo')) return 'tempo';
    if (pattern.includes('feint') || pattern === 'fakePair') return 'feint';
    if (pattern.includes('shield')) return 'shield';
    if (pattern.includes('mirror')) return 'mirror';
    if (pattern.includes('chaos')) return 'chaos';

    return 'default';
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
      }

      const easy = pool.filter(v => ['high-bar', 'high-ribbon', 'high-tape'].includes(v.key));
      return (easy[Math.floor(rng() * easy.length)] || pool[0]).key;
    }

    if (bossKey === 'shield' && rng() < 0.35) return type === 'low' ? 'low-heavy' : 'high-heavy';
    if ((bossKey === 'chaos' || inRush) && rng() < 0.28) return type === 'low' ? 'low-mini' : 'high-mini';
    if (isPhase3 && rng() < 0.12) return type === 'low' ? 'low-heavy' : 'high-heavy';
    if (isPhase3 && rng() < 0.16) return type === 'low' ? 'low-mini' : 'high-mini';

    if (s.phase === 2) {
      if (type === 'low') {
        const mid = pool.filter(v => ['low-hurdle', 'low-box', 'low-bench', 'low-cones', 'low-mini'].includes(v.key));
        return (mid[Math.floor(rng() * mid.length)] || pool[0]).key;
      }

      const mid = pool.filter(v => ['high-bar', 'high-ribbon', 'high-beam', 'high-tape', 'high-mini'].includes(v.key));
      return (mid[Math.floor(rng() * mid.length)] || pool[0]).key;
    }

    return pool[Math.floor(rng() * pool.length)].key;
  }

  function jdCreateObstacle(s, opts) {
    const { type = 'low', x = 100, isBoss = false, feint = false, phase = 1, visualKey = '' } = opts || {};

    const pool = type === 'low' ? JD_VISUALS.low : JD_VISUALS.high;
    const visual = visualKey
      ? (pool.find(v => v.key === visualKey) || pool[0])
      : pool[Math.floor(s.rng() * pool.length)];

    const behavior = jdObstacleBehaviorByVisualKey(visual.key);

    const el = D.createElement('div');
    el.className = `jd-obstacle ${type} variant-${behavior.variant} ${isBoss ? 'boss' : ''} ${feint ? 'feint' : ''}`.trim();

    const shape = D.createElement('div');
    shape.className = `jd-shape ${visual.cls}`;

    const tag = D.createElement('div');
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

  function jdApplyObstacleLane(s, obs) {
    if (!s || !obs?.el) return;

    const compact = s.layoutProfile === 'compact' || s.layoutProfile === 'tiny';
    const groundBottom = compact ? 104 : 86;

    let bottomPx = groundBottom - 4;

    if (obs.type === 'low') {
      if (obs.variant === 'heavy') bottomPx = groundBottom - 8;
      else if (obs.variant === 'mini') bottomPx = groundBottom + 2;
      else bottomPx = groundBottom - 4;
    } else {
      if (obs.variant === 'heavy') bottomPx = groundBottom + (compact ? 130 : 118);
      else if (obs.variant === 'mini') bottomPx = groundBottom + (compact ? 116 : 108);
      else bottomPx = groundBottom + (compact ? 122 : 110);
    }

    obs.el.style.bottom = `${bottomPx}px`;
  }

  function jdObstaclePopY(obs) {
    const fieldH = state?.arena?.offsetHeight || 420;
    const fallbackCompact = state?.layoutProfile === 'compact' || state?.layoutProfile === 'tiny';

    if (!obs?.el) return fallbackCompact ? 170 : 180;

    const bottom = parseFloat(obs.el.style.bottom || (obs.type === 'low' ? '100' : '220'));
    const h = obs.el.offsetHeight || (obs.variant === 'mini' ? 58 : (obs.variant === 'heavy' ? 82 : 74));

    return Math.max(72, fieldH - bottom - h - 12);
  }

  function jdFeintChance(s) {
    const compact = s.layoutProfile === 'compact' || s.layoutProfile === 'tiny';

    if (s.bossActive && s.bossProfile) {
      const base = Number(s.bossProfile.feintChance || 0);
      return compact ? base * 0.72 : base;
    }

    if (s.phase === 1) return 0;
    if (s.phase === 2) return compact ? 0.01 : 0.02;
    if (s.phase === 3) return s.finalRush ? (compact ? 0.03 : 0.05) : (compact ? 0.025 : 0.04);

    return 0;
  }

  function jdBossForcedPattern(s) {
    if (!s || !Array.isArray(s.forceBossPatterns)) return '';
    if (!s.forceBossPatterns.length) return '';
    return s.forceBossPatterns.shift();
  }

  function jdPickPattern(s) {
    const rng = s.rng || Math.random;
    const compact = s.layoutProfile === 'compact' || s.layoutProfile === 'tiny';
    const rushStage = s.rushStage || '';

    const forced = jdBossForcedPattern(s);
    if (forced) return forced;

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
          pool = compact ? ['feintLate2', 'fakePair', 'alt2'] : ['feintLate2', 'feintLate3', 'fakePair', 'alt2'];
        } else if (s.bossProfile.key === 'shield') {
          pool = ['shieldPair', 'shieldWall', 'shieldBreaker', 'pair'];
        } else if (s.bossProfile.key === 'mirror') {
          pool = ['mirrorABBA', 'mirrorBAAB', 'mirrorEcho', 'mirror4'];
        } else if (s.bossProfile.key === 'chaos') {
          pool = compact ? ['chaosBurst5', 'burst4', 'zigzag3'] : ['chaosBurst5', 'chaosBurst6', 'chaosLadder', 'burst4'];
        }
      }

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

    return pool[Math.floor(rng() * pool.length)];
  }

  function jdSpawnWave(s) {
    if (!s || !s.arena || !s.running) return;

    const rng = s.rng || Math.random;
    const pattern = jdPickPattern(s);
    const seq = jdPatternToSeq(pattern, rng);
    const startX = Number(s.startXBase || 300);
    const feintChance = jdFeintChance(s);

    s.lastPattern = pattern;

    let cursorX = Math.max(startX, jdGetSpawnFloorX(s));

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
        pattern,
        patternTag: jdPatternTag(pattern),
        spawnX: Number(obs.x || 0),
        obstacleSpeed: Number(obs.speed || 0),
        stageKey: String(s.stageKey || ''),
        bossThemeKey: String(s.bossThemeKey || '')
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

  function jdBuildMissions(s) {
    const hard = String(s.diff || '') === 'hard';

    if (hard) {
      return [
        { id: 'combo12', label: 'ทำคอมโบ 12', target: 12, value: 0, done: false, reward: 75 },
        { id: 'hit25', label: 'ผ่านให้ถูก 25 ครั้ง', target: 25, value: 0, done: false, reward: 70 },
        { id: 'duck8', label: 'ผ่าน DUCK 8 ครั้ง', target: 8, value: 0, done: false, reward: 45 }
      ];
    }

    if (String(s.diff || '') === 'easy') {
      return [
        { id: 'hit10', label: 'ผ่านให้ถูก 10 ครั้ง', target: 10, value: 0, done: false, reward: 35 },
        { id: 'combo5', label: 'ทำคอมโบ 5', target: 5, value: 0, done: false, reward: 35 },
        { id: 'duck4', label: 'ผ่าน DUCK 4 ครั้ง', target: 4, value: 0, done: false, reward: 25 }
      ];
    }

    return [
      { id: 'hit15', label: 'ผ่านให้ถูก 15 ครั้ง', target: 15, value: 0, done: false, reward: 45 },
      { id: 'combo8', label: 'ทำคอมโบ 8', target: 8, value: 0, done: false, reward: 55 },
      { id: 'jump5', label: 'ผ่าน JUMP 5 ครั้ง', target: 5, value: 0, done: false, reward: 35 }
    ];
  }

  function jdMissionValue(s, id) {
    if (id === 'hit10') return Number(s.hit || 0);
    if (id === 'hit15') return Number(s.hit || 0);
    if (id === 'hit25') return Number(s.hit || 0);
    if (id === 'combo5') return Number(s.combo || 0);
    if (id === 'combo8') return Number(s.combo || 0);
    if (id === 'combo12') return Number(s.combo || 0);
    if (id === 'jump5') return Number(s.jumpHit || 0);
    if (id === 'duck4') return Number(s.duckHit || 0);
    if (id === 'duck8') return Number(s.duckHit || 0);

    return 0;
  }

  function jdRenderMissions(s) {
    if (!playRoot || !s) return;

    let root = D.getElementById('jd-mission-hud');
    if (!root) {
      root = D.createElement('div');
      root.id = 'jd-mission-hud';
      root.className = 'jd-mission-hud';
      playRoot.appendChild(root);
    }

    const missions = Array.isArray(s.missions) ? s.missions : [];

    root.innerHTML = `
      <div class="jd-mission-title">🎯 ภารกิจรอบนี้</div>
      ${missions.map(m => `
        <div class="jd-mission-item ${m.done ? 'done' : ''}">
          <span>${m.done ? '✅' : '⭐'} ${m.label}</span>
          <b>${Math.min(m.value || 0, m.target)}/${m.target}</b>
        </div>
      `).join('')}
    `;
  }

  function jdUpdateMissions(s) {
    if (!s || !Array.isArray(s.missions)) return;

    s.missions.forEach(m => {
      if (m.done) return;

      m.value = jdMissionValue(s, m.id);

      if (m.value >= m.target) {
        m.done = true;
        s.score = Number(s.score || 0) + Number(m.reward || 0);

        jdFunToast(`ภารกิจสำเร็จ! +${m.reward}`, 'good', 900);
        jdSfx('mission');

        if (s.arena) {
          jdScorePop(s.arena, (s.hitLineX || 120) + 54, 112, `MISSION +${m.reward}`, 'perfect');
        }

        jdLogEvent(s, 'mission_done', {
          missionId: m.id,
          missionLabel: m.label,
          missionReward: Number(m.reward || 0)
        });
      }
    });

    jdRenderMissions(s);
  }

  function jdPowerIcon(type) {
    if (type === 'shield') return '🛡️';
    if (type === 'slow') return '🦴';
    if (type === 'fever') return '⭐';

    return '⚡';
  }

  function jdCreatePowerup(s, type, x) {
    const el = D.createElement('div');
    el.className = `jd-powerup power-${type}`;
    el.textContent = jdPowerIcon(type);

    const compact = s.layoutProfile === 'compact' || s.layoutProfile === 'tiny';
    el.style.bottom = compact ? '208px' : '184px';

    return {
      id: `power-${Date.now()}-${Math.floor(Math.random() * 9999)}`,
      type,
      x,
      speed: Math.max(3.8, Number(s.currentSpeed || 5.5) * .72),
      el,
      resolved: false
    };
  }

  function jdMaybeSpawnPowerup(s, now) {
    if (!s || !s.running || !s.arena) return;

    if (!s.nextPowerupAt) {
      s.nextPowerupAt = now + 4200 + Math.floor((s.rng || Math.random)() * 1800);
      return;
    }

    if (now < s.nextPowerupAt) return;

    const rng = s.rng || Math.random;
    const roll = rng();

    let type = 'shield';
    if (roll > .68) type = 'fever';
    else if (roll > .34) type = 'slow';

    const startX = Math.max(
      Number(s.startXBase || 300) + 80,
      jdGetSpawnFloorX(s) + 90
    );

    const p = jdCreatePowerup(s, type, startX);
    s.powerups.push(p);
    s.arena.appendChild(p.el);

    s.nextPowerupAt = now + 6200 + Math.floor(rng() * 3800);

    jdLogEvent(s, 'powerup_spawn', {
      powerupId: p.id,
      powerupType: p.type,
      spawnX: Number(p.x || 0)
    });
  }

  function jdActivatePowerup(s, type) {
    const now = performance.now();

    if (type === 'shield') {
      s.shieldCharges = Math.min(2, Number(s.shieldCharges || 0) + 1);
      jdFunToast('🛡️ ได้ Shield Paw กันพลาด 1 ครั้ง!', 'power', 1050);
    } else if (type === 'slow') {
      s.slowMoUntil = now + 3500;
      jdFunToast('🦴 Slow Bone! เกมช้าลง 3 วิ', 'power', 1050);
    } else if (type === 'fever') {
      s.fever = Math.min(100, Number(s.fever || 0) + 45);
      jdFunToast('⭐ Fever Star! เกจพลังเพิ่ม!', 'power', 1050);
    }

    jdSfx('power');

    jdLogEvent(s, 'powerup_collect', {
      powerupType: type,
      shieldCharges: Number(s.shieldCharges || 0),
      slowMoActive: !!(s.slowMoUntil && now < s.slowMoUntil),
      fever: Number(s.fever || 0)
    });
  }

  function jdUpdatePowerups(s, dt) {
    if (!s || !Array.isArray(s.powerups)) return;

    const hitX = Number(s.hitLineX || 100);
    const now = performance.now();

    for (let i = s.powerups.length - 1; i >= 0; i--) {
      const p = s.powerups[i];
      if (!p || !p.el) continue;

      let mul = 1;
      if (s.slowMoUntil && now < s.slowMoUntil) mul *= .62;

      p.x -= p.speed * mul * dt * 0.06;
      p.el.style.transform = `translate(${p.x}px, 0px)`;

      if (!p.resolved && p.x <= hitX + 20) {
        p.resolved = true;
        jdActivatePowerup(s, p.type);
        p.el.remove();
        s.powerups.splice(i, 1);
        continue;
      }

      if (p.x < -120) {
        p.el.remove();
        s.powerups.splice(i, 1);
      }
    }
  }

  function jdTryShieldBlock(s, obs, reason) {
    if (!s) return false;
    if (Number(s.shieldCharges || 0) <= 0) return false;

    s.shieldCharges = Math.max(0, Number(s.shieldCharges || 0) - 1);

    jdFunToast('🛡️ Shield Paw ช่วยไว้!', 'power', 900);
    jdSfx('power');

    if (s.arena && obs) {
      jdScorePop(s.arena, obs.x + 42, jdObstaclePopY(obs), 'SHIELD', 'good');
    }

    jdLogEvent(s, 'shield_block', {
      obstacleId: obs?.id || '',
      obstacleNeed: obs?.need || '',
      reason,
      shieldCharges: Number(s.shieldCharges || 0)
    });

    return true;
  }

  function jdStagePickForProgress(progress, s) {
    const p = Number(progress || 0);

    if (p < 0.24) return 'sunny';
    if (p < 0.48) return 'rainbow';
    if (p < 0.70) return 'night';

    if (s?.bossGateShown || s?.bossActive || p >= 0.86) return 'lava';

    return 'snow';
  }

  function jdGetStage(s) {
    const key = s?.stageKey || 'sunny';
    return JD_STAGE_THEMES[key] || JD_STAGE_THEMES.sunny;
  }

  function jdSetStageBanner(text) {
    if (!playRoot) return;

    let banner = D.getElementById('jd-stage-banner');
    if (!banner) {
      banner = D.createElement('div');
      banner.id = 'jd-stage-banner';
      banner.className = 'jd-stage-banner';
      playRoot.appendChild(banner);
    }

    banner.textContent = text;
  }

  function jdApplyStageTheme(s, key, silent = false) {
    if (!s || !playRoot) return;
    if (s.bossActive || s.bossGateShown) return;

    const nextKey = key || 'sunny';
    if (s.stageKey === nextKey) return;

    const prev = s.stageKey || '';
    s.stageKey = nextKey;

    playRoot.classList.remove('stage-sunny', 'stage-rainbow', 'stage-night', 'stage-snow', 'stage-lava');
    playRoot.classList.add(`stage-${nextKey}`);

    const stage = jdGetStage(s);
    jdSetStageBanner(`${stage.icon} ${stage.label}`);

    if (!silent && prev) {
      jdFunToast(stage.toast, nextKey === 'lava' ? 'boss' : 'good', 1200);
      jdSfx(nextKey === 'lava' ? 'boss' : 'mission');
      jdFunShake(nextKey === 'lava' ? 'big' : 'small');

      jdLogEvent(s, 'stage_change', {
        fromStage: prev,
        toStage: nextKey,
        stageLabel: stage.label
      });
    }
  }

  function jdMaybeUpdateStage(s) {
    if (!s) return;
    const next = jdStagePickForProgress(s.progress || 0, s);
    jdApplyStageTheme(s, next, false);
  }

  function jdStageBonusScore(s, judge) {
    const stage = jdGetStage(s);
    let bonus = Number(stage.scoreBonus || 0);

    if (stage.key === 'rainbow' && Number(s.combo || 0) >= 6) {
      bonus += judge === 'perfect' ? 5 : 2;
    }

    if (stage.key === 'night' && judge === 'perfect') {
      bonus += 4;
    }

    if (stage.key === 'lava') {
      bonus += judge === 'perfect' ? 7 : 3;
    }

    if (stage.key === 'snow' && judge === 'perfect') {
      bonus += 3;
    }

    return Math.max(0, Math.round(bonus));
  }

  function jdStagePacingAdjust(s, speed, spawnMs) {
    const stage = jdGetStage(s);
    let nextSpeed = speed * Number(stage.speedMul || 1);
    let nextSpawn = spawnMs * Number(stage.spawnMul || 1);

    if (stage.key === 'snow' && !s.bossActive && !s.bossGateShown) {
      const now = performance.now();

      if (!s.snowSlipNextAt) s.snowSlipNextAt = now + 3200;

      if (now >= s.snowSlipNextAt) {
        s.snowSlipUntil = now + 900;
        s.snowSlipNextAt = now + 5200 + Math.floor((s.rng || Math.random)() * 1800);
        jdFunToast('❄️ พื้นลื่น! จังหวะช้าลงนิดหนึ่ง', 'power', 850);
        jdSfx('warn');
      }

      if (s.snowSlipUntil && now < s.snowSlipUntil) {
        nextSpeed *= 0.86;
        nextSpawn *= 1.06;
      }
    }

    return {
      speed: nextSpeed,
      spawnMs: nextSpawn
    };
  }

  function jdStageParticleTick(s, now) {
    if (!s || !playRoot) return;

    if (!s.nextStageParticleAt) s.nextStageParticleAt = now + 700;
    if (now < s.nextStageParticleAt) return;

    const stage = s.bossActive ? { key: s.bossThemeKey || 'lava' } : jdGetStage(s);
    const rng = s.rng || Math.random;

    let symbol = '';
    let cls = '';

    if (stage.key === 'snow') {
      symbol = '❄';
      cls = 'jd-stage-flake';
    } else if (stage.key === 'lava' || stage.key === 'chaos') {
      symbol = '🔥';
      cls = 'jd-stage-spark';
    } else if (stage.key === 'night' || stage.key === 'tempo' || stage.key === 'mirror') {
      symbol = '✦';
      cls = 'jd-stage-star';
    } else {
      s.nextStageParticleAt = now + 1000;
      return;
    }

    const el = D.createElement('div');
    el.className = cls;
    el.textContent = symbol;
    el.style.left = `${Math.round(rng() * 92 + 2)}%`;
    el.style.top = '-20px';
    el.style.animationDuration = `${2.1 + rng() * 1.2}s`;

    playRoot.appendChild(el);

    setTimeout(() => el.remove(), 3600);

    s.nextStageParticleAt = now + 380 + Math.floor(rng() * 520);
  }

  function jdBossThemeMeta(s) {
    const key = String(s?.bossProfile?.key || '');
    return JD_BOSS_THEME_META[key] || null;
  }

  function jdApplyBossGateTheme(s) {
    if (!s || !playRoot || s.bossGateShown) return;

    s.bossGateShown = true;

    jdRemoveBossThemeClasses();
    playRoot.classList.remove('stage-sunny', 'stage-rainbow', 'stage-night', 'stage-snow', 'stage-lava');
    playRoot.classList.add('phase-boss-gate');

    jdSetStageBanner('⚠️ Boss Gate');
    jdFunToast('⚠️ Boss Gate เปิดแล้ว เตรียมตัว!', 'boss', 1200);
    jdSfx('warn');
    jdFunShake('small');

    jdLogEvent(s, 'boss_gate', {
      progress: Number(s.progress || 0)
    });
  }

  function jdApplyBossTheme(s, reason = 'boss_start') {
    if (!s || !playRoot || !s.bossProfile) return;

    const meta = jdBossThemeMeta(s);
    if (!meta) return;

    jdRemoveBossThemeClasses();
    playRoot.classList.remove('stage-sunny', 'stage-rainbow', 'stage-night', 'stage-snow', 'stage-lava');

    const cls = `boss-theme-${meta.key}`;
    playRoot.classList.add(cls);

    if (s.bossPhase2) {
      playRoot.classList.add('boss-enraged');
    }

    s.bossThemeKey = meta.key;
    s.bossThemeLabel = meta.label;

    jdSetStageBanner(`${meta.icon} ${meta.label}`);

    if (reason === 'boss_start') {
      jdFunToast(meta.toast, 'boss', 1250);
      jdSfx('boss');
      jdFunShake('big');
    }

    jdLogEvent(s, 'boss_theme_apply', {
      bossKey: String(s.bossProfile.key || ''),
      bossThemeKey: meta.key,
      bossThemeLabel: meta.label,
      bossPhase2: !!s.bossPhase2,
      reason
    });
  }

  function jdApplyBossEnrageTheme(s) {
    if (!s || !playRoot || !s.bossProfile) return;

    const meta = jdBossThemeMeta(s);
    if (!meta) return;

    if (!playRoot.classList.contains(`boss-theme-${meta.key}`)) {
      jdApplyBossTheme(s, 'boss_phase2');
    }

    if (!playRoot.classList.contains('boss-enraged')) {
      playRoot.classList.add('boss-enraged');
    }

    if (!s.bossEnrageThemeShown) {
      s.bossEnrageThemeShown = true;

      jdSetStageBanner(`${meta.icon} ${meta.label} • Phase 2`);
      jdFunToast(meta.enragedToast, 'boss', 1250);
      jdSfx('warn');
      jdFunShake('big');

      jdLogEvent(s, 'boss_theme_enraged', {
        bossKey: String(s.bossProfile.key || ''),
        bossThemeKey: meta.key,
        bossThemeLabel: meta.label
      });
    }
  }

  function jdBossInitSpecialState(s) {
    if (!s || !s.bossProfile) return;

    s.bossSpecialNextAt = performance.now() + 1200;
    s.bossSpecialCount = 0;
    s.forceBossPatterns = [];
    s.bossShieldArmor = 0;
    s.bossTempoUntil = 0;
    s.bossMirrorUntil = 0;
    s.bossChaosUntil = 0;
    s.bossFeintUntil = 0;

    if (s.bossProfile.key === 'shield') {
      s.bossShieldArmor = 24;
    }
  }

  function jdBossQueuePatterns(s, patterns, count = 1) {
    if (!s || !Array.isArray(patterns) || !patterns.length) return;

    s.forceBossPatterns = Array.isArray(s.forceBossPatterns)
      ? s.forceBossPatterns
      : [];

    const rng = s.rng || Math.random;

    for (let i = 0; i < count; i++) {
      const p = patterns[Math.floor(rng() * patterns.length)];
      s.forceBossPatterns.push(p);
    }
  }

  function jdBossTriggerSpecial(s, now) {
    if (!s || !s.bossActive || !s.bossProfile) return;

    const boss = s.bossProfile;
    const key = boss.key;

    s.bossSpecialCount = Number(s.bossSpecialCount || 0) + 1;

    jdFunToast(boss.specialToast || `${boss.icon} ${boss.skillName}`, 'boss', 1250);
    jdSfx(key === 'chaos' ? 'boss' : 'warn');
    jdFunShake(key === 'chaos' ? 'big' : 'small');

    if (key === 'tempo') {
      s.bossTempoUntil = now + 4300;
      jdBossQueuePatterns(s, boss.specialPatterns, 2);
      jdTelegraph('🎵 จับจังหวะ: PERFECT = โบนัส!', 1000);
    }

    if (key === 'feint') {
      s.bossFeintUntil = now + 4600;
      jdBossQueuePatterns(s, boss.specialPatterns, 2);
      jdTelegraph('🧠 อย่ากดเร็ว ดูให้ชัดก่อน!', 1000);
    }

    if (key === 'shield') {
      s.bossShieldArmor = Math.min(44, Number(s.bossShieldArmor || 0) + 18);
      jdBossQueuePatterns(s, boss.specialPatterns, 1);
      jdTelegraph('🛡️ เกราะหนาขึ้น! ทำคอมโบเพื่อเจาะ', 1050);
    }

    if (key === 'mirror') {
      s.bossMirrorUntil = now + 4800;
      jdBossQueuePatterns(s, boss.specialPatterns, 2);
      jdTelegraph('🪞 จำแพทเทิร์นสะท้อนให้ทัน!', 1050);
    }

    if (key === 'chaos') {
      s.bossChaosUntil = now + 3600;
      jdBossQueuePatterns(s, boss.specialPatterns, 2);
      jdTelegraph('🌪️ Storm Surge!', 900);
    }

    jdLogEvent(s, 'boss_special', {
      bossKey: key,
      bossSkill: boss.skillName || '',
      bossSpecialCount: Number(s.bossSpecialCount || 0),
      bossShieldArmor: Number(s.bossShieldArmor || 0)
    });
  }

  function jdMaybeBossSpecial(s, now) {
    if (!s || !s.bossActive || !s.bossProfile) return;

    if (!s.bossSpecialNextAt) {
      s.bossSpecialNextAt = now + 1600;
      return;
    }

    if (now < s.bossSpecialNextAt) return;

    jdBossTriggerSpecial(s, now);

    const base = Number(s.bossProfile.specialEveryMs || 5600);
    const hp = Number(s.bossHp || 100);
    const hpPressure = hp <= 45 ? 0.78 : 1;
    const frenzyPressure = s.bossFrenzy ? 0.82 : 1;

    s.bossSpecialNextAt = now + Math.round(base * hpPressure * frenzyPressure);
  }

  function jdBossDamageWithArmor(s, rawDmg, judge) {
    if (!s || !s.bossActive || !s.bossProfile) return rawDmg;
    if (s.bossProfile.key !== 'shield') return rawDmg;

    const armor = Number(s.bossShieldArmor || 0);
    if (armor <= 0) return rawDmg;

    let pierce = judge === 'perfect' ? 8 : 5;

    if ((s.bossChain || 0) >= 3) pierce += 4;
    if ((s.bossChain || 0) >= 5) pierce += 6;

    s.bossShieldArmor = Math.max(0, armor - pierce);

    jdFunToast(`🛡️ เจาะเกราะ -${pierce}`, 'boss', 640);

    if (s.bossShieldArmor <= 0) {
      jdFunToast('💥 เกราะแตกแล้ว! ตีบอสได้เต็มแรง', 'good', 900);
      jdSfx('perfect');
      jdFunShake('big');
      return rawDmg + 6;
    }

    return Math.max(1, Math.round(rawDmg * 0.35));
  }

  function jdBossHitBonus(s, judge) {
    if (!s || !s.bossActive || !s.bossProfile) return 0;

    const now = performance.now();
    const key = s.bossProfile.key;
    let bonus = 0;

    if (key === 'tempo' && s.bossTempoUntil && now < s.bossTempoUntil && judge === 'perfect') {
      bonus += 10;
      jdFunToast('🎵 Beat Perfect +10', 'good', 560);
    }

    if (key === 'mirror' && s.bossMirrorUntil && now < s.bossMirrorUntil && judge === 'perfect') {
      bonus += 8;
      jdFunToast('🪞 Mirror Read +8', 'good', 560);
    }

    if (key === 'chaos' && s.bossChaosUntil && now < s.bossChaosUntil) {
      bonus += judge === 'perfect' ? 9 : 4;
    }

    return bonus;
  }

  function jdBossMissPenaltyBoost(s, obs, reason) {
    if (!s || !s.bossActive || !s.bossProfile) return 0;

    const now = performance.now();
    const key = s.bossProfile.key;

    if (key === 'feint' && s.bossFeintUntil && now < s.bossFeintUntil) {
      jdFunToast('🧠 Feint หลอกสำเร็จ! รอบหน้ารอให้ชัดก่อน', 'warn', 900);
      return 3;
    }

    if (key === 'chaos' && s.bossChaosUntil && now < s.bossChaosUntil) {
      return 2;
    }

    return 0;
  }

  function jdBossStatusLine(s) {
    if (!s || !s.bossActive || !s.bossProfile) return '—';

    const boss = s.bossProfile;
    const now = performance.now();
    const parts = [];

    parts.push(`${boss.icon} ${boss.label}`);

    if (boss.key === 'shield') parts.push(`Armor ${Math.round(s.bossShieldArmor || 0)}`);
    if (boss.key === 'tempo' && s.bossTempoUntil > now) parts.push('Beat Chain');
    if (boss.key === 'feint' && s.bossFeintUntil > now) parts.push('Fake Move');
    if (boss.key === 'mirror' && s.bossMirrorUntil > now) parts.push('Mirror Echo');
    if (boss.key === 'chaos' && s.bossChaosUntil > now) parts.push('Storm Surge');

    return parts.join(' • ');
  }

  function jdStartBoss(s) {
    if (!s || s.bossActive) return;

    const keys = Object.keys(JD_BOSS_PROFILES);
    const key = keys[Math.floor(s.rng() * keys.length)];
    const boss = JD_BOSS_PROFILES[key];

    s.bossActive = true;
    s.bossHp = 100;
    s.bossProfile = boss;
    s.bossStartedAt = performance.now();
    s.nextBossBurstAt = performance.now() + 900;

    jdBossInitSpecialState(s);
    jdApplyBossTheme(s, 'boss_start');

    if (hudBossLabel) hudBossLabel.textContent = `${boss.icon} ${boss.label}`;
    if (hudBossStatus) hudBossStatus.textContent = boss.intro;
    if (bossStatusRight) bossStatusRight.textContent = 'BOSS START';
    if (bossBarWrap) bossBarWrap.classList.remove('hidden');

    jdShowBossIntro(`${boss.icon} ${boss.label} • ${boss.intro}`);
    jdTelegraph(`${boss.icon} ${boss.label}`, 850);
    jdShowJudge(`${boss.icon} ${boss.label}`);

    jdSfx('boss');
    jdFunShake('big');
    jdFunToast(`${boss.icon} บอสมาแล้ว! ตั้งสติให้ดี`, 'boss', 1300);

    jdLogEvent(s, 'boss_start', {
      bossKey: boss.key,
      bossLabel: boss.label,
      bossSkill: boss.skillName || '',
      bossShieldArmor: Number(s.bossShieldArmor || 0)
    });
  }

  function jdMaybeBossPhaseGate(s, now) {
    if (!s || !s.running) return;

    if (!s.bossActive && Number(s.progress || 0) >= 0.70) {
      jdApplyBossGateTheme(s);
    }

    if (!s.bossActive && Number(s.progress || 0) >= 0.82) {
      jdStartBoss(s);
    }
  }

  function jdMaybeBossBurst(s, now) {
    if (!s || !s.bossActive || !s.bossProfile) return;
    if (now < s.nextBossBurstAt) return;

    const compact = s.layoutProfile === 'compact' || s.layoutProfile === 'tiny';

    jdSpawnWave(s);

    let nextMs = Number(s.bossProfile.burstEveryMs || 4200);

    if (s.bossProfile.key === 'chaos') nextMs *= compact ? 0.97 : 0.92;
    if (s.bossFrenzy) nextMs *= compact ? 0.86 : 0.76;
    if (s.finalRush) nextMs *= compact ? 0.95 : 0.90;

    s.nextBossBurstAt = now + Math.max(compact ? 1320 : 1050, Math.round(nextMs));
  }

  function jdMaybeTriggerBossPhase2(s) {
    if (!s || !s.bossActive || !s.bossProfile) return;
    if (s.bossPhase2Triggered) return;

    const hp = Number(s.bossHp || 100);
    if (hp > 50) return;

    s.bossPhase2Triggered = true;
    s.bossPhase2 = true;

    jdApplyBossEnrageTheme(s);

    s.bossBreakMoments = Number(s.bossBreakMoments || 0) + 1;

    jdShowBossIntro(`${s.bossProfile.icon} ${s.bossProfile.label} • PHASE 2`);
    jdShowJudge('💢 PHASE 2!');
    jdTelegraph('แรงขึ้นแล้ว ระวังให้ดี!', 900);

    jdSfx('warn');
    jdFunShake('big');
    jdFunToast('💢 บอสแรงขึ้นแล้ว!', 'boss', 1200);

    s.currentSpeed *= 1.05;
    s.currentSpawnMs *= 0.94;

    jdLogEvent(s, 'boss_phase2', {
      bossBreakMoments: Number(s.bossBreakMoments || 0),
      bossThemeKey: String(s.bossThemeKey || ''),
      bossThemeLabel: String(s.bossThemeLabel || '')
    });
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

  function jdDirectorPushEvent(s, kind) {
    if (!s) return;

    s.recentWindow = Array.isArray(s.recentWindow) ? s.recentWindow : [];
    s.recentWindow.push({ kind, t: performance.now() });

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
      stageKey: String(s.stageKey || ''),
      stageLabel: String(jdGetStage(s).label || ''),
      progress: Number((s.progress || 0).toFixed(4)),
      rushStage: s.rushStage || '',
      finalRush: !!s.finalRush,
      bossKey: s.bossProfile?.key || '',
      bossLabel: s.bossProfile?.label || '',
      bossThemeKey: String(s.bossThemeKey || ''),
      bossThemeLabel: String(s.bossThemeLabel || ''),
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

    return { speed, spawnMs, hitHalfWindow };
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

    if (s.feverActive) speed *= compact ? 1.04 : 1.06;

    if (s.bossActive && s.bossProfile) {
      speed *= (s.bossProfile.speedMul || 1);
      spawnMs = Math.min(spawnMs, (s.bossProfile.burstEveryMs || 4200) / (compact ? 5.4 : 5.0));

      const now = performance.now();

      if (s.bossProfile.key === 'tempo' && s.bossTempoUntil && now < s.bossTempoUntil) {
        spawnMs *= compact ? 0.96 : 0.92;
      }

      if (s.bossProfile.key === 'feint' && s.bossFeintUntil && now < s.bossFeintUntil) {
        speed *= 0.96;
        spawnMs *= 1.05;
      }

      if (s.bossProfile.key === 'shield' && Number(s.bossShieldArmor || 0) > 0) {
        speed *= 0.96;
        spawnMs *= 1.04;
      }

      if (s.bossProfile.key === 'mirror' && s.bossMirrorUntil && now < s.bossMirrorUntil) {
        spawnMs *= compact ? 1.03 : 0.98;
      }

      if (s.bossProfile.key === 'chaos' && s.bossChaosUntil && now < s.bossChaosUntil) {
        speed *= compact ? 1.08 : 1.14;
        spawnMs *= compact ? 0.88 : 0.82;
      }
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

    if (!s.bossActive && !s.bossGateShown) {
      const stageAdjust = jdStagePacingAdjust(s, speed, spawnMs);
      speed = stageAdjust.speed;
      spawnMs = stageAdjust.spawnMs;
    }

    spawnMs = jdClamp(Math.round(spawnMs), compact ? 470 : 360, 1800);
    speed = jdClamp(speed, compact ? 4.3 : 4.9, compact ? 13.0 : 15.8);

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

  function jdJudgeTiming(inputAgeMs, s) {
    const compact = s.layoutProfile === 'compact' || s.layoutProfile === 'tiny';

    let perfectWindow = compact ? 124 : 105;
    let goodWindow = compact ? 228 : 195;

    if (s.diff === 'easy') {
      perfectWindow = compact ? 138 : 118;
      goodWindow = compact ? 248 : 220;
    } else if (s.diff === 'hard') {
      perfectWindow = compact ? 108 : 92;
      goodWindow = compact ? 192 : 172;
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

      jdSetAvatarMood('fever');
      jdShowJudge('🔥 FEVER!');
      jdFunToast('🔥 Fever Mode! คะแนนพุ่ง!', 'power', 1000);
      jdSfx('power');

      jdLogEvent(s, 'fever_start');
    }
  }

  function jdUpdateFeverRuntime(s, now) {
    if (s.feverActive && now >= (s.feverUntil || 0)) {
      s.feverActive = false;
      s.fever = 0;
      jdSetAvatarMood('happy');
      jdLogEvent(s, 'fever_end');
    }

    if (!s.feverActive) s.fever = Math.max(0, (s.fever || 0) - 0.04);
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
      jdScorePop(s.arena, (s.hitLineX || 120) + 34, s.layoutProfile === 'tiny' ? 160 : 150, `+${bonus}`, 'perfect');
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
    jdFunToast('🏅 ไม่พลาดเลย! +60', 'good', 900);
    jdSfx('mission');

    if (s.arena) {
      jdScorePop(s.arena, (s.hitLineX || 120) + 28, s.layoutProfile === 'tiny' ? 150 : 140, `+${bonus}`, 'perfect');
    }

    jdLogEvent(s, 'no_miss_bonus', { bonus: Number(bonus || 0) });
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
    jdFunToast('🛟 รอดช่วงสุดท้าย! +35', 'good', 900);
    jdSfx('mission');

    if (s.arena) {
      jdScorePop(s.arena, (s.hitLineX || 120) + 34, s.layoutProfile === 'tiny' ? 175 : 165, `+${bonus}`, 'good');
    }

    jdLogEvent(s, 'rush_survive_bonus', { bonus: Number(bonus || 0) });
  }

  function jdApplyMissPenalty(s, obs, reason = 'miss') {
    if (jdTryShieldBlock(s, obs, reason)) {
      return;
    }

    jdSfx('miss');
    jdFunShake('big');

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

    const bossExtraLoss = jdBossMissPenaltyBoost(s, obs, reason);
    if (bossExtraLoss > 0) {
      s.stability = Math.max(0, Number(s.stability || 100) - bossExtraLoss);
    }

    if (s.bossProfile?.key === 'shield') s.bossChain = 0;

    if (s.playRoot) jdFlash(s.playRoot, 'miss');

    if (s.arena && obs) {
      jdScorePop(s.arena, obs.x + 42, jdObstaclePopY(obs), reason === 'wrong' ? 'WRONG' : 'MISS', 'miss');
    }

    if (s.phaseMiss && s.phaseMiss[s.phase] != null) s.phaseMiss[s.phase] += 1;
    if (s.finalRush) s.rushMiss = Number(s.rushMiss || 0) + 1;

    jdLogEvent(s, 'miss', {
      obstacleId: obs?.id || '',
      obstacleNeed: obs?.need || '',
      obstacleType: obs?.type || '',
      obstacleVariant: obs?.variant || '',
      obstacleVisual: obs?.visualKey || '',
      obstacleFeint: !!obs?.feint,
      reason,
      bossExtraLoss: Number(bossExtraLoss || 0),
      liveNoMiss: !!s.liveNoMiss
    });

    let txt = reason === 'wrong' ? '❌ WRONG!' : 'MISS';

    if (s.finalRush && s.rushStage === 'survive') txt = '⚠ STAY FOCUSED!';

    jdSetAvatarMood('sad');

    setTimeout(() => {
      if (!state?.running) return;
      jdSetAvatarMood(state?.feverActive ? 'fever' : 'happy');
    }, 320);

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
    const bossBonus = jdBossHitBonus(s, judge);
    const stageBonus = s.bossActive ? 0 : jdStageBonusScore(s, judge);
    const totalGain = gain + bossBonus + stageBonus;

    s.score = Number(s.score || 0) + totalGain;

    jdSfx(judge === 'perfect' ? 'perfect' : 'hit');
    jdFunShake('small');

    jdAddFever(s, judge);

    if (s.playRoot) jdFlash(s.playRoot, judge === 'perfect' ? 'perfect' : 'good');

    if (s.arena) {
      jdScorePop(s.arena, obs.x + 42, jdObstaclePopY(obs), `+${totalGain}`, judge === 'perfect' ? 'perfect' : 'good');
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

      if (s.bossPhase2) dmg += 1;

      dmg = jdBossDamageWithArmor(s, dmg, judge);

      s.bossHp = Math.max(0, Number(s.bossHp || 100) - dmg);

      if (s.playRoot) jdFlash(s.playRoot, 'bosshit');

      if (s.arena) {
        jdScorePop(
          s.arena,
          (s.hitLineX || 120) + 80,
          88,
          `BOSS -${Math.round(dmg)}`,
          judge === 'perfect' ? 'perfect' : 'good'
        );
      }

      jdMaybeTriggerBossPhase2(s);
    }

    jdAwardLiveStreakReward(s);
    jdUpdateMissions(s);

    if (s.phaseHit && s.phaseHit[s.phase] != null) s.phaseHit[s.phase] += 1;
    if (s.finalRush) s.rushHit = Number(s.rushHit || 0) + 1;

    jdLogEvent(s, 'hit', {
      obstacleId: obs?.id || '',
      obstacleNeed: obs?.need || '',
      obstacleType: obs?.type || '',
      obstacleVariant: obs?.variant || '',
      obstacleVisual: obs?.visualKey || '',
      obstacleFeint: !!obs?.feint,
      judge,
      gain: Number(gain || 0),
      bossBonus: Number(bossBonus || 0),
      stageBonus: Number(stageBonus || 0),
      totalGain: Number(totalGain || 0),
      bossSkill: String(s.bossProfile?.skillName || ''),
      bossShieldArmor: Number(s.bossShieldArmor || 0),
      liveNoMiss: !!s.liveNoMiss
    });

    jdSetAvatarMood(judge === 'perfect' ? 'wow' : 'happy');

    let judgeText = judge === 'perfect' ? '✨ PERFECT!' : '✅ GOOD!';

    if (obs?.variant === 'heavy' && judge === 'perfect') judgeText = '💥 POWER CLEAR!';
    else if (obs?.variant === 'mini' && judge === 'perfect') judgeText = '⚡ QUICK READ!';

    if (s.bossActive && s.bossProfile?.key === 'tempo' && judge === 'perfect') judgeText = '🎵 ON BEAT!';
    if (s.bossActive && s.bossProfile?.key === 'feint' && obs.feint) judgeText = '🧠 READ IT!';
    if (s.bossActive && s.bossProfile?.key === 'shield' && (s.bossChain || 0) >= 3) judgeText = '🛡️ SHIELD BREAK!';
    if (s.bossActive && s.bossProfile?.key === 'mirror' && ['mirrorABBA','mirrorBAAB','mirrorEcho','mirror4'].includes(s.lastPattern || '')) judgeText = '🪞 MIRROR MASTER!';

    if (s.rushStage === 'survive' && judge === 'perfect') judgeText = '🔥 CLUTCH!';
    else if (s.rushStage === 'peak' && judge === 'perfect') judgeText = '⚡ HOLD IT!';

    if (s.feverActive) jdSetAvatarMood('fever');

    jdShowJudge(judgeText);
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

      if (s.slowMoUntil && now < s.slowMoUntil) {
        frameSpeedMul *= 0.62;
      }

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

    if (s.lastInput && now - s.lastInput.at > 300) {
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

      jdSetAvatarMood(type === 'jump' ? 'wow' : 'focus');

      const mouth = s.avatar?.querySelector('.jd-dog-mouth');

      if (mouth) {
        if (type === 'jump') {
          mouth.style.width = '10px';
          mouth.style.height = '10px';
        } else {
          mouth.style.width = '12px';
          mouth.style.height = '4px';
        }
      }

      clearTimeout(s.avatarResetTimer);

      s.avatarResetTimer = setTimeout(() => {
        if (!s.avatar) return;

        s.avatar.classList.remove('avatar-jump', 'avatar-duck');
        s.avatar.classList.add('avatar-idle');

        jdSetAvatarMood(s.feverActive ? 'fever' : 'happy');

        const mouth2 = s.avatar?.querySelector('.jd-dog-mouth');

        if (mouth2) {
          mouth2.style.width = '14px';
          mouth2.style.height = '7px';
        }
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

  function jdRewardFromRank(rank, accPct) {
    if (rank === 'S') return { medal: '🏆', label: 'สุดยอดมาก', key: 'legend-run' };
    if (rank === 'A') return { medal: '🥇', label: 'เยี่ยมมาก', key: 'gold-run' };
    if (rank === 'B') return { medal: '🥈', label: 'เก่งมาก', key: 'silver-run' };
    if (accPct >= 60) return { medal: '⭐', label: 'ผ่านด่านแล้ว', key: 'clear-run' };

    return { medal: '🌱', label: 'ลองอีกครั้ง', key: 'keep-training' };
  }

  function jdBossBadge(s) {
    if (!s.bossActive || s.bossHp > 0 || !s.bossProfile) return null;

    return {
      key: `boss-${s.bossProfile.key}`,
      icon: s.bossProfile.icon,
      label: s.bossProfile.label
    };
  }

  function jdBossSpecificTitle(s, rank, bossDown, noMiss) {
    if (bossDown && noMiss) return 'ชนะบอสแบบไม่พลาด';
    if (bossDown) return 'ชนะบอสได้แล้ว';
    if (noMiss) return 'รอบนี้ไม่พลาดเลย';
    if ((s?.maxCombo || 0) >= 20) return 'คอมโบเก่งมาก';
    if (rank === 'A' || rank === 'S') return 'รอบนี้เก่งมาก';

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
      tips.push('คุณพลาดของที่อยู่ต่ำบ่อยกว่า ลองรอให้เห็นชัด แล้วค่อยกระโดด');
    }

    if (duckAcc < jumpAcc - 12) {
      weakness.push('high-obstacle weakness');
      tips.push('คุณพลาดของที่อยู่สูงบ่อยกว่า ลองหมอบให้เร็วขึ้นอีกนิด');
    }

    if (miss >= 6) {
      weakness.push('overall-pressure');
      tips.push('รอบนี้พลาดค่อนข้างเยอะ ลองอย่ากดเร็วเกินไป และดูรูปสิ่งกีดขวางให้ชัดขึ้น');
    }

    if ((s.maxCombo || 0) <= 3 && hit >= 8) {
      weakness.push('combo-break');
      tips.push('คุณตีโดนพอสมควร แต่คอมโบหลุดบ่อย ลองรักษาจังหวะให้สม่ำเสมอขึ้น');
    }

    if (s.finalRush && !s.rushSurviveAwarded) {
      weakness.push('final-rush-collapse');
      tips.push('ช่วงท้ายเกมยังหลุดง่าย ลองใจเย็นและอย่ากดรีบเกินไป');
    }

    if (s.bossActive && (s.bossHp || 0) > 35) {
      weakness.push('boss-pressure');
      tips.push('รอบนี้ยังตีบอสได้ไม่พอ ลองเน้นความแม่นก่อนเร่งคอมโบ');
    }

    if (s.lastDirectorReason === 'player_overloaded') {
      weakness.push('overload-risk');
      tips.push('ถ้าเริ่มงง ลองมองเป็นชุดทีละอันและกดช้าลงนิดหนึ่ง');
    }

    if (accPct >= 85) strengths.push('high accuracy');
    if ((s.maxCombo || 0) >= 12) strengths.push('combo control');
    if (s.liveNoMiss) strengths.push('clean run');
    if (s.bossActive && (s.bossHp || 0) <= 0) strengths.push('boss down');
    if (s.rushSurviveAwarded) strengths.push('final rush survive');

    if (!tips.length) {
      if (accPct >= 88) tips.push('รอบนี้เล่นดีมากแล้ว ลองทำคอมโบต่อเนื่องให้นานขึ้น');
      else tips.push('พื้นฐานเริ่มดีแล้ว ลองอ่านสิ่งกีดขวางเป็นชุดแทนการมองทีละอัน');
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

    let headline = 'โค้ชแนะนำ';
    let summary = 'ลองอีกครั้งเพื่อพัฒนาจังหวะและความแม่น';

    if (strengths.includes('clean run')) {
      headline = 'โค้ชแนะนำ';
      summary = 'รอบนี้นิ่งมากและแทบไม่พลาดเลย';
    } else if (strengths.includes('boss down')) {
      headline = 'โค้ชแนะนำ';
      summary = `คุณจัดการ ${boss} ได้ดีแล้ว`;
    } else if (analysis?.weaknesses?.includes('final-rush-collapse')) {
      headline = 'โค้ชแนะนำ';
      summary = 'จุดที่ต้องฝึกเพิ่มคือช่วงท้ายเกม';
    } else if (analysis?.weaknesses?.includes('high-obstacle weakness')) {
      headline = 'โค้ชแนะนำ';
      summary = 'รอบนี้พลาดของที่อยู่สูงบ่อยกว่า';
    } else if (analysis?.weaknesses?.includes('low-obstacle weakness')) {
      headline = 'โค้ชแนะนำ';
      summary = 'รอบนี้พลาดของที่อยู่ต่ำบ่อยกว่า';
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
      bossThemeLabel: sf.bossThemeLabel || '',
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
      stageKeyEnd: String(s.stageKey || ''),
      stageLabelEnd: String(jdGetStage(s).label || ''),
      bossKey: s.bossProfile?.key || '',
      bossLabel: s.bossProfile?.label || '',
      bossThemeKey: String(s.bossThemeKey || ''),
      bossThemeLabel: String(s.bossThemeLabel || ''),
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

    const headline = jdResultHeadline(result.rank);

    if (rankBadge) {
      rankBadge.textContent = result.rank || 'C';
      rankBadge.classList.remove('rank-s', 'rank-a', 'rank-b', 'rank-c', 'rank-d');
      rankBadge.classList.add(`rank-${String(result.rank || 'c').toLowerCase()}`);
    }

    if (resultTitle) resultTitle.textContent = headline.title;
    if (resultSub) resultSub.textContent = headline.sub;

    if (resultReward) {
      resultReward.textContent = result.bossTitle || result.reward?.label || 'ผ่านด่านแล้ว';
    }

    if (resultRewardIcon) resultRewardIcon.textContent = result.bossBadge?.icon || result.reward?.medal || '⭐';

    if (resultRewardSub) {
      resultRewardSub.textContent =
        result.coach?.primaryTip ||
        'รอบหน้าลองดูสิ่งกีดขวางให้ชัดขึ้น และอย่ากดเร็วเกินไป';
    }

    if (resScoreBig) resScoreBig.textContent = String(s.score || 0);
    if (resMiss) resMiss.textContent = String(s.miss || 0);
    if (resComboBig) resComboBig.textContent = String(s.maxCombo || 0);

    if (resultBoss) resultBoss.textContent = s.bossProfile?.label || '—';
    if (resultPattern) resultPattern.textContent = s.lastPattern || '—';
    if (resultRush) resultRush.textContent = s.finalRush ? 'FINAL RUSH' : '—';

    if (coachTitle) coachTitle.textContent = result.coach?.headline || 'โค้ชแนะนำ';
    if (coachSummary) coachSummary.textContent = result.coach?.summary || 'สรุปคำแนะนำหลังจบเกม';

    if (coachTip1) {
      coachTip1.textContent =
        result.coach?.primaryTip ||
        'รอบหน้าจำให้แม่นว่า ต่ำ = กระโดด และ สูง = หมอบ';
    }

    if (coachTip2) coachTip2.textContent = result.coach?.secondaryTip || '—';

    if (resScore) resScore.textContent = String(s.score || 0);
    if (resRank) resRank.textContent = String(result.rank || 'C');

    if (resAcc) {
      const acc = Number(result.accPct || 0);
      resAcc.textContent = `${acc.toFixed(1)}%`;
    }
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

      stageKey: '',
      nextStageParticleAt: 0,
      snowSlipNextAt: 0,
      snowSlipUntil: 0,

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

      powerups: [],
      nextPowerupAt: 0,
      shieldCharges: 0,
      slowMoUntil: 0,
      missions: [],

      nextSpawnAt: 0,
      lastInput: null,

      bossGateShown: false,
      bossActive: false,
      bossHp: 100,
      bossProfile: null,
      bossFrenzy: false,
      bossPhase2: false,
      bossPhase2Triggered: false,
      bossBreakMoments: 0,
      nextBossBurstAt: 0,
      bossChain: 0,

      bossThemeKey: '',
      bossThemeLabel: '',
      bossEnrageThemeShown: false,

      bossSpecialNextAt: 0,
      bossSpecialCount: 0,
      forceBossPatterns: [],
      bossShieldArmor: 0,
      bossTempoUntil: 0,
      bossMirrorUntil: 0,
      bossChaosUntil: 0,
      bossFeintUntil: 0,

      finalRush: false,
      rushStage: '',
      lastPattern: '',

      liveNoMiss: true,
      streakTier: 0,
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
    jdApplyStageTheme(s, 'sunny', true);

    s.missions = jdBuildMissions(s);

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

    jdClearAvatarRank();
    jdSetAvatarMood('happy');

    jdShowJudge('READY!');
    jdSfx('start');
    jdRenderMissions(state);
    jdFunToast('🎯 ทำภารกิจให้ครบเพื่อรับโบนัส!', 'good', 1200);
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

    rafId = W.requestAnimationFrame(jdTick);
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

    jdSfx(rank === 'S' || rank === 'A' || bossDown ? 'win' : 'start');

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

    jdSetAvatarRank(rank);
    if (bossDown) jdAvatarCheerBossDown();

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
    profile.lastBossTheme = s.bossThemeLabel || '';
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
    if (bossBadge) profile.bossWins[s.bossProfile.key] = Number(profile.bossWins[s.bossProfile.key] || 0) + 1;

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
      bossThemeLabel: s.bossThemeLabel || '',
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
      bossThemeKey: String(s.bossThemeKey || ''),
      bossThemeLabel: String(s.bossThemeLabel || ''),
      bossPhase: s.bossPhase2 ? 2 : 1,
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
      stageKey: String(s.stageKey || ''),
      stageLabel: String(jdGetStage(s).label || ''),
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
      eventLog: Array.isArray(s.eventLog) ? s.eventLog : [],
      cooldownHref: buildCooldownGateHref({
        score: s.score,
        miss,
        accPct,
        bestStreak: s.maxCombo,
        rank,
        mode: s.mode,
        diff: s.diff,
        time: Math.round((s.duration || 0) / 1000)
      })
    };

    saveLastSummary(summary);

    try {
      W.HH_FITNESS_LASTGAME?.writeSnapshot({
        event: 'summary_ready',
        zone: 'fitness',
        gameId: 'jump-duck',
        game: 'jump-duck',
        score: Number(s.score || 0),
        miss: Number(s.miss || 0),
        bestStreak: Number(s.maxCombo || 0),
        rank: rank || '',
        result: endReason || 'end'
      });
    } catch (_) {}

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
    if (!state || !state.running || state.finished || state.finishing) return;

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

    jdMaybeUpdateStage(state);
    jdStageParticleTick(state, now);

    jdMaybeBossPhaseGate(state, now);

    if (!state.nextSpawnAt) state.nextSpawnAt = now + 760;

    if (now >= state.nextSpawnAt) {
      if (jdShouldHoldSpawnForReadability(state)) {
        state.nextSpawnAt = now + 120;
      } else {
        jdSpawnWave(state);
        state.nextSpawnAt = now + state.currentSpawnMs;
      }
    }

    jdMaybeBossSpecial(state, now);
    jdMaybeBossBurst(state, now);

    jdMaybeSpawnPowerup(state, now);
    jdUpdatePowerups(state, dt);

    jdUpdateObstacles(state, dt);
    jdUpdateMissions(state);

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
        : (state.bossGateShown ? '⚠️ Boss Gate' : '—');
    }

    if (hudBossStatus) {
      hudBossStatus.textContent = state.bossActive
        ? (state.bossFrenzy ? 'FRENZY! • ' + jdBossStatusLine(state) : jdBossStatusLine(state))
        : (state.bossGateShown ? 'Boss incoming...' : '—');
    }

    if (hudBossCompact) {
      if (!state.bossActive) {
        hudBossCompact.textContent = state.bossGateShown ? 'Boss Gate' : (state.liveNoMiss ? '🏅 NO MISS' : '—');
      } else if (state.bossFrenzy) {
        hudBossCompact.textContent = `${state.bossProfile?.icon || '👾'} FRENZY`;
      } else if (state.bossPhase2) {
        hudBossCompact.textContent = `${state.bossProfile?.icon || '👾'} PHASE 2`;
      } else {
        hudBossCompact.textContent = state.bossProfile?.skillName || state.bossProfile?.label || 'Boss';
      }
    }

    if (bossFill) {
      bossFill.style.width = state.bossActive ? `${Math.max(0, Math.round(state.bossHp || 0))}%` : '0%';
    }

    if (bossStatusRight) {
      if (!state.bossActive) bossStatusRight.textContent = state.bossGateShown ? 'READY' : '—';
      else if (state.bossProfile?.key === 'shield') {
        bossStatusRight.textContent = `HP ${Math.round(state.bossHp || 0)}% • ARMOR ${Math.round(state.bossShieldArmor || 0)}`;
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

    rafId = W.requestAnimationFrame(jdTick);
  }

  function bindEvents() {
    D.querySelector('[data-action="start"]')?.addEventListener('click', () => {
      if (state && state.running) return;

      startGame({
        mode: (elMode?.value || HHA_CTX.mode || 'training').toLowerCase(),
        diff: (elDiff?.value || HHA_CTX.diff || 'normal').toLowerCase(),
        durationMs: ((parseInt(elDuration?.value || HHA_CTX.duration || '60', 10) || 60) * 1000)
      });
    });

    D.querySelector('[data-action="tutorial"]')?.addEventListener('click', () => {
      if (state && state.running) return;

      startGame({
        mode: 'training',
        diff: 'easy',
        durationMs: 30000
      });

      jdTelegraph('Tutorial: low = jump • high = duck', 1200);
    });

    D.querySelector('[data-action="play-again"]')?.addEventListener('click', () => {
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

    btnContinueFlow?.addEventListener('click', () => {
      const summary = loadJson('HHA_LAST_SUMMARY', null);

      const href = summary?.cooldownHref || buildCooldownGateHref({
        score: Number(state?.score || 0),
        miss: Number(state?.miss || 0),
        accPct: state ? (Number(state.hit || 0) / Math.max(1, Number(state.totalObstacles || 0))) * 100 : 0,
        bestStreak: Number(state?.maxCombo || 0),
        rank: String(resRank?.textContent || 'C'),
        mode: String(state?.mode || HHA_CTX.mode || 'training'),
        diff: String(state?.diff || HHA_CTX.diff || 'normal'),
        time: Math.round(Number(state?.duration || (Number(HHA_CTX.time || 60) * 1000)) / 1000)
      });

      location.href = href;
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
      }, { passive: true });
    }

    W.addEventListener('keydown', (ev) => {
      if (!state || !state.running) return;

      const k = String(ev.key || '').toLowerCase();

      if (k === 'arrowup' || k === 'w') jdHandleInput(state, 'jump');
      if (k === 'arrowdown' || k === 's') jdHandleInput(state, 'duck');
    });

    W.addEventListener('resize', () => {
      if (!state) return;
      jdApplyResponsiveLayout(state);
    });

    W.addEventListener('pagehide', () => {
      if (!state || state.finished || state.finishing) return;

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
      setLogStatus('พัก Apps Script / Cloud logging ไว้ก่อนตามที่ตั้งใจไว้', false);
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
    jdSetAvatarMood('happy');

    if (HHA_CTX.autostart) {
      setTimeout(() => {
        if (state?.running) return;

        startGame({
          mode: (elMode?.value || HHA_CTX.mode || 'training').toLowerCase(),
          diff: (elDiff?.value || HHA_CTX.diff || 'normal').toLowerCase(),
          durationMs: ((parseInt(elDuration?.value || HHA_CTX.duration || '60', 10) || 60) * 1000)
        });
      }, 120);
    }
  }

  init();
})();