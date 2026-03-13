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

  const JD_VISUALS = {
    low: [
      { key: 'low-hurdle', label: 'JUMP', cls: 'low-hurdle' },
      { key: 'low-box', label: 'JUMP', cls: 'low-box' },
      { key: 'low-tyre', label: 'JUMP', cls: 'low-tyre' },
      { key: 'low-bench', label: 'JUMP', cls: 'low-bench' },
      { key: 'low-cones', label: 'JUMP', cls: 'low-cones' }
    ],
    high: [
      { key: 'high-bar', label: 'DUCK', cls: 'high-bar' },
      { key: 'high-ribbon', label: 'DUCK', cls: 'high-ribbon' },
      { key: 'high-ball', label: 'DUCK', cls: 'high-ball' },
      { key: 'high-beam', label: 'DUCK', cls: 'high-beam' },
      { key: 'high-tape', label: 'DUCK', cls: 'high-tape' }
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
      intro: 'จับจังหวะ 2-2-1 ให้ดี!',
      patterns: ['alt2', 'alt4', 'double-low-high', 'double-high-low'],
      burstEveryMs: 4000,
      feintChance: 0.02,
      speedMul: 1.08
    },
    feint: {
      key: 'feint',
      label: 'Feint Boss',
      icon: '🧠',
      intro: 'อย่ารีบกด! บางอันจะกลับด้าน',
      patterns: ['feint2', 'feint3', 'single', 'alt2'],
      burstEveryMs: 4600,
      feintChance: 0.34,
      speedMul: 0.98
    },
    shield: {
      key: 'shield',
      label: 'Shield Boss',
      icon: '🛡️',
      intro: 'ต้องตีติด ๆ กันถึงจะลดเกราะได้แรง',
      patterns: ['pair', 'double-low-high', 'double-high-low', 'mirror4'],
      burstEveryMs: 5100,
      feintChance: 0.01,
      speedMul: 1.00
    },
    mirror: {
      key: 'mirror',
      label: 'Mirror Boss',
      icon: '🪞',
      intro: 'จำแพทเทิร์นสลับให้ทัน',
      patterns: ['mirror4', 'alt4', 'zigzag3'],
      burstEveryMs: 4200,
      feintChance: 0.06,
      speedMul: 1.04
    },
    chaos: {
      key: 'chaos',
      label: 'Chaos Boss',
      icon: '🌪️',
      intro: 'ช่วงท้ายถี่และปั่นมาก!',
      patterns: ['burst4', 'burst5', 'zigzag3', 'pair'],
      burstEveryMs: 3000,
      feintChance: 0.10,
      speedMul: 1.14
    }
  };

  const JD_TUNING_PRESETS = {
    A: {
      startXMul: { tiny: 0.80, compact: 0.84, desktop: 0.86 },
      gapBase:   { tiny: 182,  compact: 170,  desktop: 144 },
      speedBase: { tiny: 5.8,  compact: 6.0,  desktop: 6.8 },
      hitHalfWindow: { tiny: 28, compact: 27, desktop: 28 }
    },
    B: {
      startXMul: { tiny: 0.77, compact: 0.81, desktop: 0.84 },
      gapBase:   { tiny: 174,  compact: 162,  desktop: 138 },
      speedBase: { tiny: 6.0,  compact: 6.2,  desktop: 7.0 },
      hitHalfWindow: { tiny: 27, compact: 26, desktop: 28 }
    },
    C: {
      startXMul: { tiny: 0.74, compact: 0.78, desktop: 0.82 },
      gapBase:   { tiny: 166,  compact: 154,  desktop: 132 },
      speedBase: { tiny: 6.2,  compact: 6.4,  desktop: 7.2 },
      hitHalfWindow: { tiny: 26, compact: 25, desktop: 27 }
    },
    CPLUS: {
      startXMul: { tiny: 0.72, compact: 0.76, desktop: 0.80 },
      gapBase:   { tiny: 160,  compact: 148,  desktop: 126 },
      speedBase: { tiny: 6.35, compact: 6.6,  desktop: 7.4 },
      hitHalfWindow: { tiny: 25, compact: 24, desktop: 26 }
    }
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
      if (el) el.href = hub;
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
      state.judgeTimer = setTimeout(() => judgeEl.classList.remove('show'), 520);
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
        border-radius:20px;
        display:flex;
        align-items:center;
        justify-content:center;
        overflow:hidden;
        border:1px solid rgba(148,163,184,.18);
        background:rgba(15,23,42,.88);
        box-shadow:0 16px 34px rgba(0,0,0,.24);
        z-index:12;
        width:86px;
        height:86px;
      }
      .jd-obstacle.low { bottom:78px; }
      .jd-obstacle.high { bottom:172px; }
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
      .low-hurdle{ bottom:18px; width:58px; height:14px; border-radius:999px; background:linear-gradient(180deg,#38bdf8,#2563eb); }
      .low-hurdle::before,.low-hurdle::after{ content:""; position:absolute; top:8px; width:8px; height:20px; background:#93c5fd; border-radius:4px; }
      .low-hurdle::before{ left:10px; } .low-hurdle::after{ right:10px; }

      .low-box{ bottom:18px; width:50px; height:34px; border-radius:12px; background:linear-gradient(180deg,#60a5fa,#2563eb); }

      .low-tyre{ bottom:10px; width:56px; height:56px; border-radius:50%; background:radial-gradient(circle at 50% 50%, #0f172a 28%, #475569 29%, #1e293b 58%, #94a3b8 60%, #0f172a 62%); }

      .low-bench{ bottom:28px; width:60px; height:14px; border-radius:8px; background:linear-gradient(180deg,#22d3ee,#0891b2); }
      .low-bench::before,.low-bench::after{ content:""; position:absolute; top:12px; width:8px; height:18px; background:#67e8f9; border-radius:4px; }
      .low-bench::before{ left:10px; } .low-bench::after{ right:10px; }

      .low-cones{ bottom:18px; width:58px; height:22px; }
      .low-cones::before,.low-cones::after{ content:""; position:absolute; bottom:0; width:16px; height:22px; clip-path:polygon(50% 0%, 100% 100%, 0% 100%); background:linear-gradient(180deg,#67e8f9,#06b6d4); }
      .low-cones::before{ left:6px; } .low-cones::after{ right:6px; }

      .high-bar{ top:18px; width:62px; height:14px; border-radius:999px; background:linear-gradient(180deg,#f59e0b,#ef4444); }
      .high-bar::before,.high-bar::after{ content:""; position:absolute; top:10px; width:8px; height:22px; border-radius:999px; background:#fdba74; }
      .high-bar::before{ left:8px; } .high-bar::after{ right:8px; }

      .high-ribbon{ top:18px; width:66px; height:10px; border-radius:999px; background:linear-gradient(90deg,#fb7185,#ef4444,#fb7185); }

      .high-ball{ top:10px; width:34px; height:34px; border-radius:50%; background:radial-gradient(circle at 35% 35%, #fde68a, #f59e0b 55%, #b45309 100%); }
      .high-ball::after{ content:""; position:absolute; left:50%; top:30px; transform:translateX(-50%); width:42px; height:8px; border-radius:999px; background:linear-gradient(90deg,#f59e0b,#ef4444); }

      .high-beam{ top:16px; width:68px; height:16px; border-radius:8px; background:linear-gradient(180deg,#fb7185,#dc2626); }
      .high-tape{ top:22px; width:64px; height:8px; border-radius:999px; background:linear-gradient(90deg,#fda4af,#ef4444,#fda4af); box-shadow:0 0 0 6px rgba(239,68,68,.06); }
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
      hitLineX = 94;
      avatarLeftPct = 0.115;
    } else if (profile === 'compact') {
      hitLineX = 108;
      avatarLeftPct = 0.125;
    } else {
      hitLineX = 144;
      avatarLeftPct = 0.14;
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
        return [rng() < 0.5 ? 'low' : 'high', rng() < 0.5 ? 'low' : 'high', rng() < 0.5 ? 'low' : 'high'];
      default:
        return [rng() < 0.5 ? 'low' : 'high'];
    }
  }

  function jdPickPattern(s) {
    const rng = s.rng || Math.random;

    if (s.bossActive && s.bossProfile) {
      if (s.bossProfile.key === 'mirror' && rng() < 0.55) return 'mirror4';
      if (s.bossProfile.key === 'tempo' && rng() < 0.45) return rng() < 0.5 ? 'alt4' : 'double-low-high';
      if (s.bossProfile.key === 'chaos' && rng() < 0.45) return rng() < 0.5 ? 'burst4' : 'burst5';
      if (s.bossProfile.key === 'feint' && rng() < 0.50) return rng() < 0.5 ? 'feint2' : 'feint3';
      if (s.bossProfile.key === 'shield' && rng() < 0.45) return rng() < 0.5 ? 'pair' : 'double-high-low';

      const bossPatterns = s.bossProfile.patterns || ['alt2'];
      return bossPatterns[Math.floor(rng() * bossPatterns.length)];
    }

    const phaseCfg = JD_PHASE_TABLE[s.phase] || JD_PHASE_TABLE[1];
    let pool = Array.isArray(phaseCfg.patterns) ? [...phaseCfg.patterns] : ['single'];

    if (s.finalRush) {
      if (s.phase === 2) pool.push('pair', 'zigzag3');
      if (s.phase === 3) pool.push('burst4', 'mirror4', 'alt4');
    }

    if (s.mode === 'training' && s.phase === 1) {
      pool = pool.filter(p => !['burst4', 'burst5', 'mirror4'].includes(p));
    }

    return pool[Math.floor(rng() * pool.length)];
  }

  function jdPickVisualKey(s, type) {
    const rng = s.rng || Math.random;
    const pool = type === 'low' ? JD_VISUALS.low : JD_VISUALS.high;
    if (!pool || !pool.length) return '';

    if (s.phase === 1) {
      if (type === 'low') {
        const easy = pool.filter(v => ['low-hurdle', 'low-box', 'low-cones'].includes(v.key));
        return (easy[Math.floor(rng() * easy.length)] || pool[0]).key;
      } else {
        const easy = pool.filter(v => ['high-bar', 'high-ribbon', 'high-tape'].includes(v.key));
        return (easy[Math.floor(rng() * easy.length)] || pool[0]).key;
      }
    }

    if (s.phase === 2) {
      if (type === 'low') {
        const mid = pool.filter(v => ['low-hurdle', 'low-box', 'low-bench', 'low-cones'].includes(v.key));
        return (mid[Math.floor(rng() * mid.length)] || pool[0]).key;
      } else {
        const mid = pool.filter(v => ['high-bar', 'high-ribbon', 'high-beam', 'high-tape'].includes(v.key));
        return (mid[Math.floor(rng() * mid.length)] || pool[0]).key;
      }
    }

    return pool[Math.floor(rng() * pool.length)].key;
  }

  function jdWaveGap(s, indexInSeq, seqLength) {
    const rng = s.rng || Math.random;
    const compact = s.layoutProfile === 'compact' || s.layoutProfile === 'tiny';

    let baseGap = Number(s.gapBase || (compact ? 160 : 136));

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

  function jdCreateObstacle(s, opts) {
    const { type = 'low', x = 100, isBoss = false, feint = false, phase = 1, visualKey = '' } = opts || {};

    const pool = type === 'low' ? JD_VISUALS.low : JD_VISUALS.high;
    const visual = visualKey
      ? (pool.find(v => v.key === visualKey) || pool[0])
      : jdPick(pool, s.rng);

    const el = document.createElement('div');
    el.className = `jd-obstacle ${type} ${isBoss ? 'boss' : ''} ${feint ? 'feint' : ''}`.trim();

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
      el
    };
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

      if (pattern.startsWith('feint')) {
        isFeint = true;
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

      s.obstacles.push(obs);
      s.arena.appendChild(obs.el);
      s.totalObstacles = Number(s.totalObstacles || 0) + 1;

      cursorX += jdWaveGap(s, index, seq.length);
    });

    if (hudPattern) hudPattern.textContent = pattern;
  }

  function jdUpdatePhaseAndPacing(s) {
    const progress = jdGetProgress(s);
    const diffKey = s.diff || 'normal';
    const compact = s.layoutProfile === 'compact' || s.layoutProfile === 'tiny';

    s.phase = jdPhaseByProgress(progress);

    const phaseCfg = JD_PHASE_TABLE[s.phase] || JD_PHASE_TABLE[1];
    let spawnMs = phaseCfg.spawnMs[diffKey] || 900;

    jdApplyResponsiveLayout(s);

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

    const finalRushStart = compact ? 0.88 : 0.86;
    s.finalRush = progress >= finalRushStart && !s.ended;

    if (s.finalRush) {
      const rushT = (progress - finalRushStart) / (1 - finalRushStart);
      speed *= 1 + (rushT * (compact ? 0.08 : 0.12));
      spawnMs *= 1 - (rushT * (compact ? 0.06 : 0.10));
    }

    if (s.bossActive && typeof s.bossHp === 'number' && s.bossHp <= 25) {
      speed *= compact ? 1.04 : 1.06;
      spawnMs *= compact ? 0.96 : 0.93;
      s.bossFrenzy = true;
    } else {
      s.bossFrenzy = false;
    }

    spawnMs = jdClamp(Math.round(spawnMs), compact ? 430 : 360, 1800);
    speed = jdClamp(speed, compact ? 4.8 : 4.9, compact ? 13.6 : 15.6);

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

  function jdScoreGainFromJudge(judge, s) {
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
    }
  }

  function jdUpdateFeverRuntime(s, now) {
    if (s.feverActive && now >= (s.feverUntil || 0)) {
      s.feverActive = false;
      s.fever = 0;
    }
    if (!s.feverActive) {
      s.fever = Math.max(0, (s.fever || 0) - 0.04);
    }
  }

  function jdObstaclePopY(obs) {
    const compact = state?.layoutProfile === 'compact' || state?.layoutProfile === 'tiny';
    if (!obs) return compact ? 170 : 180;
    if (compact) return obs.type === 'low' ? 220 : 110;
    return obs.type === 'low' ? 245 : 135;
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

  function jdApplyMissPenalty(s, obs, reason = 'miss') {
    s.miss = Number(s.miss || 0) + 1;
    s.combo = 0;

    if (obs?.need === 'jump') s.jumpMiss = Number(s.jumpMiss || 0) + 1;
    else if (obs?.need === 'duck') s.duckMiss = Number(s.duckMiss || 0) + 1;

    let stabLoss = 8;
    if (s.phase === 2) stabLoss = 10;
    if (s.phase === 3) stabLoss = 12;
    if (s.finalRush) stabLoss += 2;
    if (s.bossActive) stabLoss += 2;

    s.stability = Math.max(0, Number(s.stability || 100) - stabLoss);

    if (s.bossProfile?.key === 'shield') {
      s.bossChain = 0;
    }

    if (s.playRoot) jdFlash(s.playRoot, 'miss');

    if (s.arena && obs) {
      jdScorePop(s.arena, obs.x + 42, jdObstaclePopY(obs), reason === 'wrong' ? 'WRONG' : 'MISS', 'miss');
    }

    jdShowJudge(reason === 'wrong' ? '❌ WRONG!' : 'MISS');
  }

  function jdApplySuccessfulHit(s, obs, judge) {
    s.hit = Number(s.hit || 0) + 1;
    s.combo = Number(s.combo || 0) + 1;
    s.maxCombo = Math.max(Number(s.maxCombo || 0), s.combo);

    if (obs.need === 'jump') s.jumpHit = Number(s.jumpHit || 0) + 1;
    else if (obs.need === 'duck') s.duckHit = Number(s.duckHit || 0) + 1;

    const gain = jdScoreGainFromJudge(judge, s);
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

      s.bossHp = Math.max(0, Number(s.bossHp || 100) - dmg);
      if (s.playRoot) jdFlash(s.playRoot, 'bosshit');
    }

    jdShowJudge(judge === 'perfect' ? '✨ PERFECT!' : '✅ GOOD!');
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

      obs.speed = Number(s.currentSpeed || obs.speed || 7.4);

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
        const inputAgeMs = Math.abs(obs.x - hitX) * 3.2;

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

    if (resultReward) resultReward.textContent = result.reward?.label || 'Keep Training';
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
      nextBossBurstAt: 0,
      bossChain: 0,

      finalRush: false,
      lastPattern: '',

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

    const summary = {
      game: 'jumpduck',
      pid,
      scoreFinal: s.score,
      accPct: Number(accPct.toFixed(2)),
      rank,
      bossVariant: s.bossProfile?.key || '',
      bossLabel: s.bossProfile?.label || '',
      rewardLabel: reward.label,
      rewardKey: reward.key,
      end_reason: endReason,
      missTotal: miss,
      comboMax: s.maxCombo,
      timestampIso: nowIso(),
      pattern: s.lastPattern || '',
      rush: !!s.finalRush,
      tuneKey: s.tuneKey || 'A'
    };
    saveLastSummary(summary);

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

    jdRenderResultSummary(s, { rank, accPct, reward, bossBadge });

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

    if (hudPattern) hudPattern.textContent = state.lastPattern || '—';
    if (hudRush) hudRush.textContent = state.finalRush ? 'FINAL RUSH!' : '—';

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
        hudBossCompact.textContent = '—';
      } else if (state.bossFrenzy) {
        hudBossCompact.textContent = `${state.bossProfile?.icon || '👾'} FRENZY!`;
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

    btnDlEvents?.addEventListener('click', () => {
      const summary = loadJson('HHA_LAST_SUMMARY', null);
      if (!summary) {
        setLogStatus('ยังไม่มีข้อมูลรอบล่าสุดให้ export', false);
        return;
      }

      const rows = [{
        game: summary.game,
        boss: summary.bossVariant || '',
        bossLabel: summary.bossLabel || '',
        pattern: summary.pattern || '',
        rush: !!summary.rush,
        score: summary.scoreFinal || 0,
        miss: summary.missTotal || 0,
        comboMax: summary.comboMax || 0,
        rank: summary.rank || '',
        timestampIso: summary.timestampIso || '',
        tuneKey: summary.tuneKey || ''
      }];

      downloadCsv(toCsv(rows), `jd-events-${Date.now()}.csv`);
      setLogStatus('export events.csv เรียบร้อย', true);
    });

    btnDlSessions?.addEventListener('click', () => {
      const summary = loadJson('HHA_LAST_SUMMARY', null);
      if (!summary) {
        setLogStatus('ยังไม่มีข้อมูลรอบล่าสุดให้ export', false);
        return;
      }

      const rows = [{
        game: summary.game,
        pid: summary.pid || 'anon',
        boss: summary.bossVariant || '',
        bossLabel: summary.bossLabel || '',
        rush: !!summary.rush,
        scoreFinal: summary.scoreFinal || 0,
        accPct: summary.accPct || 0,
        rank: summary.rank || '',
        comboMax: summary.comboMax || 0,
        missTotal: summary.missTotal || 0,
        end_reason: summary.end_reason || '',
        timestampIso: summary.timestampIso || '',
        tuneKey: summary.tuneKey || ''
      }];

      downloadCsv(toCsv(rows), `jd-sessions-${Date.now()}.csv`);
      setLogStatus('export sessions.csv เรียบร้อย', true);
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