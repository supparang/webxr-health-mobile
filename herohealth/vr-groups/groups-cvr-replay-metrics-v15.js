// === /herohealth/vr-groups/groups-cvr-replay-metrics-v15.js ===
// HeroHealth Groups cVR — v1.5 Replay / Research Metrics
// Adds:
// - Daily Challenge for Cardboard VR
// - Best Score / Best Combo / Badge Collection
// - Aim metrics: aim lock %, avg confidence, shots, hits, misses
// - Comfort metrics: recenter count, reduced FX, large text
// - Next-goal suggestion for replay
// - Enriches HHA_GROUPS_CVR_SUMMARY
// Safe add-on: does not change gameplay / scoring.
// PATCH v20260515-GROUPS-CVR-V15-REPLAY-METRICS

(function () {
  'use strict';

  const VERSION = 'v1.5-cvr-replay-research-metrics-20260515';

  if (window.__HHA_GROUPS_CVR_REPLAY_METRICS_V15__) return;
  window.__HHA_GROUPS_CVR_REPLAY_METRICS_V15__ = true;

  const WIN = window;
  const DOC = document;

  const KEYS = {
    best: 'HHA_GROUPS_CVR_BEST_V15',
    badges: 'HHA_GROUPS_CVR_BADGES_V15',
    history: 'HHA_GROUPS_CVR_HISTORY_V15',
    metrics: 'HHA_GROUPS_CVR_METRICS_V15',
    dailyPrefix: 'HHA_GROUPS_CVR_DAILY_V15_'
  };

  const state = {
    best: null,
    badges: [],
    history: [],
    daily: null,

    startedAt: Date.now(),
    aimSamples: 0,
    aimLockedSamples: 0,
    confidenceSum: 0,
    confidenceMax: 0,

    lastShootShots: 0,
    lastShootHits: 0,
    lastShootMisses: 0,

    lastCoreSig: '',
    itemSeen: 0,
    phaseChanges: 0,
    lastPhase: '',

    poll: null
  };

  function $(id) {
    return DOC.getElementById(id);
  }

  function qs(name, fallback) {
    try {
      return new URL(location.href).searchParams.get(name) || fallback || '';
    } catch (e) {
      return fallback || '';
    }
  }

  function coreApi() {
    return WIN.HHA_GROUPS_CVR_V1 || null;
  }

  function shootApi() {
    return WIN.HHA_GROUPS_CVR_SHOOT_FIX_V11 || null;
  }

  function aimApi() {
    return WIN.HHA_GROUPS_CVR_AIM_ASSIST_V12 || null;
  }

  function comfortApi() {
    return WIN.HHA_GROUPS_CVR_COMFORT_V13 || null;
  }

  function eventBossApi() {
    return WIN.HHA_GROUPS_CVR_EVENT_BOSS_V14 || null;
  }

  function gs() {
    try {
      const a = coreApi();
      if (a && typeof a.getState === 'function') return a.getState() || {};
    } catch (e) {}
    return {};
  }

  function shootState() {
    try {
      const a = shootApi();
      if (a && typeof a.getState === 'function') return a.getState() || {};
    } catch (e) {}
    return {};
  }

  function aimState() {
    try {
      const a = aimApi();
      if (a && typeof a.getTarget === 'function') return a.getTarget() || {};
    } catch (e) {}
    return {};
  }

  function comfortState() {
    try {
      const a = comfortApi();
      if (a && typeof a.getState === 'function') return a.getState() || {};
    } catch (e) {}
    return {};
  }

  function eventBossState() {
    try {
      const a = eventBossApi();
      if (a && typeof a.getState === 'function') return a.getState() || {};
    } catch (e) {}
    return {};
  }

  function getJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function setJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {}
  }

  function todayKey() {
    const d = new Date();
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0')
    ].join('-');
  }

  function hashText(str) {
    let h = 2166136261;
    str = String(str || '');

    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }

    return h >>> 0;
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function clamp(n, min, max) {
    n = Number(n);
    if (!Number.isFinite(n)) n = min;
    return Math.max(min, Math.min(max, n));
  }

  function dailyChallenge() {
    const pid = qs('pid', 'anon');
    const diff = qs('diff', 'normal');
    const key = todayKey();
    const seed = hashText(`${key}|${pid}|groups-cvr|${diff}`);

    const pool = [
      {
        id: 'score',
        icon: '🏆',
        title: 'VR Score Sprint',
        desc: 'ทำคะแนนให้ถึงเป้าหมาย',
        target: diff === 'easy' ? 220 : diff === 'hard' ? 430 : diff === 'challenge' ? 520 : 330,
        unit: 'คะแนน'
      },
      {
        id: 'accuracy',
        icon: '🎯',
        title: 'VR Accuracy',
        desc: 'ทำความแม่นยำให้ถึงเป้าหมาย',
        target: diff === 'easy' ? 65 : diff === 'hard' ? 82 : diff === 'challenge' ? 88 : 75,
        unit: '%'
      },
      {
        id: 'combo',
        icon: '🔥',
        title: 'VR Combo Focus',
        desc: 'ทำคอมโบสูงสุดให้ถึงเป้า',
        target: diff === 'easy' ? 4 : diff === 'hard' ? 8 : diff === 'challenge' ? 10 : 6,
        unit: 'คอมโบ'
      },
      {
        id: 'aim',
        icon: '🎯',
        title: 'Aim Lock',
        desc: 'ล็อกเป้าให้แม่นพอ',
        target: diff === 'easy' ? 45 : diff === 'hard' ? 60 : diff === 'challenge' ? 68 : 55,
        unit: '%'
      },
      {
        id: 'boss',
        icon: '👑',
        title: 'Boss VR',
        desc: 'ตอบถูกใน Boss Phase ให้ได้',
        target: diff === 'easy' ? 2 : diff === 'hard' ? 5 : diff === 'challenge' ? 6 : 4,
        unit: 'ครั้ง'
      }
    ];

    return Object.assign({}, pool[seed % pool.length], {
      date: key,
      key: `${KEYS.dailyPrefix}${key}_${pid}`,
      completed: false,
      bestProgress: 0
    });
  }

  function loadState() {
    state.best = getJson(KEYS.best, null);
    state.badges = getJson(KEYS.badges, []);
    state.history = getJson(KEYS.history, []);

    const d = dailyChallenge();
    const saved = getJson(d.key, null);

    state.daily = saved && saved.id === d.id
      ? Object.assign({}, d, saved)
      : d;
  }

  function injectStyle() {
    if ($('groups-cvr-v15-style')) return;

    const style = DOC.createElement('style');
    style.id = 'groups-cvr-v15-style';
    style.textContent = `
      .cvr-v15-panel{
        margin:16px auto 0;
        max-width:680px;
        border-radius:28px;
        padding:14px;
        background:linear-gradient(180deg,#ffffff,#f4fbff);
        border:2px solid #d7edf7;
        box-shadow:0 14px 34px rgba(35,81,107,.10);
        text-align:left;
      }

      .cvr-v15-title{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:8px;
        color:#244e68;
        font-size:18px;
        line-height:1.15;
        font-weight:1000;
      }

      .cvr-v15-pill{
        flex:0 0 auto;
        border-radius:999px;
        padding:5px 8px;
        background:#fff5ca;
        color:#806000;
        font-size:11px;
        line-height:1;
        font-weight:1000;
        white-space:nowrap;
      }

      .cvr-v15-text{
        margin-top:7px;
        color:#7193a8;
        font-size:13px;
        line-height:1.35;
        font-weight:850;
      }

      .cvr-v15-progress{
        height:10px;
        margin-top:10px;
        border-radius:999px;
        overflow:hidden;
        background:rgba(97,187,255,.16);
      }

      .cvr-v15-progress i{
        display:block;
        height:100%;
        width:0%;
        border-radius:999px;
        background:linear-gradient(90deg,#7ed957,#ffd966,#ff9d3f);
      }

      .cvr-v15-grid{
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:8px;
        margin-top:10px;
      }

      .cvr-v15-mini{
        border-radius:18px;
        padding:10px 7px;
        background:#fff;
        box-shadow:inset 0 0 0 2px #e4f2f8;
        text-align:center;
      }

      .cvr-v15-mini b{
        display:block;
        color:#244e68;
        font-size:22px;
        line-height:1;
        font-weight:1000;
      }

      .cvr-v15-mini span{
        display:block;
        margin-top:4px;
        color:#7193a8;
        font-size:11px;
        line-height:1.15;
        font-weight:850;
      }

      .cvr-v15-summary{
        margin-top:12px;
        border-radius:24px;
        padding:13px;
        background:linear-gradient(180deg,#ffffff,#f5fcff);
        border:2px solid #d7edf7;
      }

      .cvr-v15-summary h3{
        margin:0;
        color:#244e68;
        font-size:17px;
        line-height:1.15;
        font-weight:1000;
      }

      .cvr-v15-summary p{
        margin:7px 0 0;
        color:#7193a8;
        font-size:13px;
        line-height:1.35;
        font-weight:850;
      }

      .cvr-v15-badges{
        display:flex;
        flex-wrap:wrap;
        gap:7px;
        justify-content:center;
        margin-top:10px;
      }

      .cvr-v15-badge{
        border-radius:999px;
        padding:7px 10px;
        background:linear-gradient(135deg,#fff8d5,#ffffff);
        border:2px solid #ffe480;
        color:#6b4c00;
        font-size:12px;
        line-height:1;
        font-weight:1000;
      }

      .cvr-v15-badge.locked{
        background:#f3f6f8;
        border-color:#d8e5ec;
        color:#8aa1af;
        filter:grayscale(.55);
      }

      @media (max-width:460px){
        .cvr-v15-title{
          align-items:flex-start;
          flex-direction:column;
        }

        .cvr-v15-grid{
          grid-template-columns:1fr;
        }
      }
    `;

    DOC.head.appendChild(style);
  }

  function ensureIntroPanel() {
    const card = DOC.querySelector('#intro .card');
    if (!card || $('cvrV15IntroPanel')) return;

    const best = state.best || {};
    const daily = state.daily || dailyChallenge();
    const pct = clamp((Number(daily.bestProgress || 0) / Math.max(1, Number(daily.target))) * 100, 0, 100);

    const panel = DOC.createElement('div');
    panel.id = 'cvrV15IntroPanel';
    panel.className = 'cvr-v15-panel';
    panel.innerHTML = `
      <div class="cvr-v15-title">
        <span>${daily.icon} Daily cVR Challenge: ${daily.title}</span>
        <span class="cvr-v15-pill">${daily.completed ? 'สำเร็จแล้ว' : 'วันนี้'}</span>
      </div>
      <div class="cvr-v15-text">
        ${escapeHtml(daily.desc)}: เป้าหมาย ${daily.target}${daily.unit}
      </div>
      <div class="cvr-v15-progress"><i style="width:${pct}%"></i></div>

      <div class="cvr-v15-grid">
        <div class="cvr-v15-mini"><b>${best.score || 0}</b><span>Best Score</span></div>
        <div class="cvr-v15-mini"><b>${best.bestCombo || 0}</b><span>Best Combo</span></div>
        <div class="cvr-v15-mini"><b>${state.badges.length}</b><span>Badges</span></div>
      </div>
    `;

    const actions = card.querySelector('.actions');
    card.insertBefore(panel, actions);
  }

  function updateIntroPanel() {
    const panel = $('cvrV15IntroPanel');
    if (!panel) return;

    const best = state.best || {};
    const daily = state.daily || dailyChallenge();
    const pct = clamp((Number(daily.bestProgress || 0) / Math.max(1, Number(daily.target))) * 100, 0, 100);

    panel.innerHTML = `
      <div class="cvr-v15-title">
        <span>${daily.icon} Daily cVR Challenge: ${daily.title}</span>
        <span class="cvr-v15-pill">${daily.completed ? 'สำเร็จแล้ว' : 'วันนี้'}</span>
      </div>
      <div class="cvr-v15-text">
        ${escapeHtml(daily.desc)}: เป้าหมาย ${daily.target}${daily.unit}
      </div>
      <div class="cvr-v15-progress"><i style="width:${pct}%"></i></div>

      <div class="cvr-v15-grid">
        <div class="cvr-v15-mini"><b>${best.score || 0}</b><span>Best Score</span></div>
        <div class="cvr-v15-mini"><b>${best.bestCombo || 0}</b><span>Best Combo</span></div>
        <div class="cvr-v15-mini"><b>${state.badges.length}</b><span>Badges</span></div>
      </div>
    `;
  }

  function itemSignature(s) {
    const c = s && s.current ? s.current : null;
    if (!c) return 'none';

    return [
      c.kind || '',
      c.icon || '',
      c.power || '',
      c.group && c.group.key || ''
    ].join('|');
  }

  function pollMetrics() {
    const s = gs();

    if (!s || s.mode !== 'game' || s.ended) return;

    const aim = aimState();
    const confidence = clamp(Number(aim.confidence || 0), 0, 1);

    state.aimSamples += 1;
    state.confidenceSum += confidence;
    state.confidenceMax = Math.max(state.confidenceMax, confidence);

    if (aim.targetKey) {
      state.aimLockedSamples += 1;
    }

    const sig = itemSignature(s);

    if (sig !== state.lastCoreSig) {
      state.lastCoreSig = sig;

      if (sig !== 'none') {
        state.itemSeen += 1;
      }
    }

    const phase = s.phase || '';

    if (phase && phase !== state.lastPhase) {
      if (state.lastPhase) state.phaseChanges += 1;
      state.lastPhase = phase;
    }

    const sh = shootState();

    state.lastShootShots = Number(sh.shots || state.lastShootShots || 0);
    state.lastShootHits = Number(sh.hits || state.lastShootHits || 0);
    state.lastShootMisses = Number(sh.misses || state.lastShootMisses || 0);
  }

  function aimLockPct() {
    if (!state.aimSamples) return 0;
    return Math.round((state.aimLockedSamples / state.aimSamples) * 100);
  }

  function avgConfidencePct() {
    if (!state.aimSamples) return 0;
    return Math.round((state.confidenceSum / state.aimSamples) * 100);
  }

  function getDailyProgress(summary, metrics) {
    const d = state.daily || dailyChallenge();

    switch (d.id) {
      case 'score':
        return Number(summary.score || 0);
      case 'accuracy':
        return Number(summary.accuracy || 0);
      case 'combo':
        return Number(summary.bestCombo || 0);
      case 'aim':
        return Number(metrics.aimLockPct || 0);
      case 'boss':
        return Number(summary.bossCorrect || 0);
      default:
        return 0;
    }
  }

  function updateBest(summary) {
    const old = state.best || {};
    const next = Object.assign({}, old);

    [
      'score',
      'bestCombo',
      'accuracy',
      'correct',
      'missionClear',
      'bossCorrect',
      'goldenHit',
      'decoyDodged',
      'feverCount'
    ].forEach(k => {
      next[k] = Math.max(Number(old[k] || 0), Number(summary[k] || 0));
    });

    next.rank = summary.rank || old.rank || 'VR Food Rookie';
    next.updatedAt = new Date().toISOString();

    state.best = next;
    setJson(KEYS.best, next);
  }

  function mergeBadges(summary, metrics) {
    const set = new Set(state.badges || []);

    if (Array.isArray(summary.badges)) {
      summary.badges.forEach(b => {
        if (b) set.add(String(b));
      });
    }

    if (summary.rank) set.add(String(summary.rank));

    if (metrics.aimLockPct >= 65) set.add('🎯 Aim Lock');
    if (metrics.shots >= 10 && metrics.hitRatePct >= 70) set.add('🥽 VR Shooter');
    if (metrics.recenterCount >= 1) set.add('🎯 Recenter Ready');
    if (metrics.reducedFx) set.add('🌿 Comfort Player');

    state.badges = Array.from(set).slice(0, 90);
    setJson(KEYS.badges, state.badges);
  }

  function updateDaily(summary, metrics) {
    const d = state.daily || dailyChallenge();
    const p = getDailyProgress(summary, metrics);

    d.bestProgress = Math.max(Number(d.bestProgress || 0), p);

    if (p >= Number(d.target || 1)) {
      d.completed = true;
    }

    state.daily = d;
    setJson(d.key, d);
  }

  function updateHistory(summary, metrics) {
    const row = {
      ts: summary.ts || new Date().toISOString(),
      score: Number(summary.score || 0),
      accuracy: Number(summary.accuracy || 0),
      bestCombo: Number(summary.bestCombo || 0),
      rank: summary.rank || 'VR Food Rookie',
      aimLockPct: Number(metrics.aimLockPct || 0),
      hitRatePct: Number(metrics.hitRatePct || 0),
      recenterCount: Number(metrics.recenterCount || 0)
    };

    state.history = [row].concat(state.history || []).slice(0, 12);
    setJson(KEYS.history, state.history);
  }

  function recommendation(summary, metrics) {
    const acc = Number(summary.accuracy || 0);
    const combo = Number(summary.bestCombo || 0);
    const aimLock = Number(metrics.aimLockPct || 0);
    const hitRate = Number(metrics.hitRatePct || 0);
    const recenter = Number(metrics.recenterCount || 0);
    const miss = Number(summary.miss || 0);

    if (recenter === 0) return 'รอบหน้าให้กด RECENTER ก่อนเริ่มเล่น เพื่อให้ประตูอยู่ตรงหน้า';
    if (aimLock < 40) return 'รอบหน้าให้ฝึกเล็ง crosshair ให้นิ่งก่อนแตะจอ';
    if (hitRate < 45) return 'รอบหน้าแตะช้าลงเล็กน้อย และรอให้มีคำว่า “พร้อมยิง” ก่อน';
    if (acc < 65) return 'รอบหน้าเน้นอ่านหมู่ให้ถูกก่อนยิง ความแม่นยำยังต่ำ';
    if (miss >= 5) return 'ตัวหลอกยังทำให้สับสน ควรรอให้ผ่านไป ไม่ต้องยิงทุกอย่าง';
    if (combo < 4) return 'รอบหน้าลองทำคอมโบ 4 ให้ได้ โดยเล็งประตูที่ถูกต่อเนื่อง';
    if (aimLock >= 65 && acc >= 80) return 'ดีมาก รอบหน้าลองเพิ่มระดับความยากหรือเวลาเล่นได้';
    return 'เหมาะสมดี พร้อมใช้ทดสอบจริงใน Cardboard VR';
  }

  function buildMetrics(summary) {
    const sh = shootState();
    const comfort = comfortState();
    const eb = eventBossState();

    const shots = Number(sh.shots || state.lastShootShots || 0);
    const hits = Number(sh.hits || state.lastShootHits || 0);
    const misses = Number(sh.misses || state.lastShootMisses || 0);
    const hitRatePct = shots ? Math.round((hits / shots) * 100) : 0;

    const comfortSettings = comfort.settings || {};

    const metrics = {
      version: VERSION,

      shots,
      hits,
      misses,
      hitRatePct,

      aimSamples: state.aimSamples,
      aimLockedSamples: state.aimLockedSamples,
      aimLockPct: aimLockPct(),
      avgAimConfidencePct: avgConfidencePct(),
      maxAimConfidencePct: Math.round(state.confidenceMax * 100),

      itemSeen: state.itemSeen,
      phaseChanges: state.phaseChanges,

      recenterCount: Number(comfort.recenterCount || 0),
      largeText: Boolean(comfortSettings.largeText),
      reducedFx: Boolean(comfortSettings.reducedFx),
      steady: Boolean(comfortSettings.steady),
      showCoach: Boolean(comfortSettings.showCoach),

      eventCompleted: Number(eb.completed || 0),
      eventFailed: Number(eb.failed || 0),
      bossCleared: Number(eb.bossCleared || 0),
      bossFailed: Number(eb.bossFailed || 0),

      durationMs: Date.now() - state.startedAt
    };

    metrics.recommendation = recommendation(summary || {}, metrics);

    return metrics;
  }

  function nextGoal(summary, metrics) {
    return recommendation(summary, metrics);
  }

  function renderSummary(summary, metrics) {
    const card = DOC.querySelector('#summary .card');
    if (!card) return;

    let box = $('cvrV15Summary');

    if (!box) {
      box = DOC.createElement('div');
      box.id = 'cvrV15Summary';
      box.className = 'cvr-v15-summary';

      const actions = card.querySelector('.actions');
      card.insertBefore(box, actions);
    }

    const d = state.daily || dailyChallenge();
    const p = getDailyProgress(summary, metrics);

    const badgeHtml = state.badges.length
      ? state.badges.slice(0, 10).map(b => `<span class="cvr-v15-badge">${escapeHtml(b)}</span>`).join('')
      : `<span class="cvr-v15-badge locked">ยังไม่มี Badge</span>`;

    box.innerHTML = `
      <h3>🥽 cVR Replay + Research Metrics</h3>
      <p>
        ${escapeHtml(nextGoal(summary, metrics))}<br>
        ${d.icon} Daily Challenge:
        ${d.completed ? 'สำเร็จแล้ว!' : `ทำได้ ${p}/${d.target}${d.unit}`}
      </p>

      <div class="cvr-v15-grid">
        <div class="cvr-v15-mini"><b>${metrics.aimLockPct}%</b><span>Aim Lock</span></div>
        <div class="cvr-v15-mini"><b>${metrics.hitRatePct}%</b><span>Hit Rate</span></div>
        <div class="cvr-v15-mini"><b>${metrics.recenterCount}</b><span>Recenter</span></div>
      </div>

      <div class="cvr-v15-badges">
        ${badgeHtml}
      </div>
    `;
  }

  function handleEnd(detail) {
    setTimeout(() => {
      let summary = detail;

      try {
        if (!summary) {
          const raw = localStorage.getItem('HHA_GROUPS_CVR_SUMMARY');
          if (raw) summary = JSON.parse(raw);
        }
      } catch (e) {}

      if (!summary) return;

      const metrics = buildMetrics(summary);

      updateBest(summary);
      mergeBadges(summary, metrics);
      updateDaily(summary, metrics);
      updateHistory(summary, metrics);
      renderSummary(summary, metrics);
      updateIntroPanel();

      setJson(KEYS.metrics, metrics);

      try {
        const enriched = Object.assign({}, summary, {
          cvrReplayMetrics: {
            version: VERSION,
            best: state.best,
            daily: state.daily,
            badgeCount: state.badges.length,
            metrics,
            nextGoal: nextGoal(summary, metrics)
          }
        });

        localStorage.setItem('HHA_GROUPS_CVR_SUMMARY', JSON.stringify(enriched));
        localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify({
          ts: enriched.ts || new Date().toISOString(),
          game: 'groups',
          mode: 'solo-cvr',
          summary: enriched
        }));
      } catch (e) {}
    }, 380);
  }

  function installEvents() {
    WIN.addEventListener('groups-cvr:end', ev => {
      handleEnd(ev.detail || null);
    });

    WIN.addEventListener('groups:end', ev => {
      handleEnd(ev.detail || null);
    });

    WIN.addEventListener('hha:summary-enriched', ev => {
      handleEnd(ev.detail || null);
    });

    DOC.addEventListener('visibilitychange', () => {
      if (!DOC.hidden) {
        loadState();
        updateIntroPanel();
      }
    });
  }

  function expose() {
    WIN.HHA_GROUPS_CVR_REPLAY_METRICS_V15 = {
      version: VERSION,
      getState: function () {
        return {
          version: VERSION,
          best: state.best,
          badges: state.badges.slice(),
          history: state.history.slice(),
          daily: state.daily,
          liveMetrics: buildMetrics(gs())
        };
      }
    };
  }

  function init() {
    injectStyle();
    loadState();
    ensureIntroPanel();
    installEvents();
    expose();

    state.poll = setInterval(pollMetrics, 250);

    console.info('[Groups cVR v1.5] replay / research metrics installed', VERSION);
  }

  if (DOC.readyState === 'loading') {
    DOC.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
