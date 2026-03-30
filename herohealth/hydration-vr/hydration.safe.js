// === /herohealth/hydration-vr/hydration.safe.js ===
// FULL PATCH v20260329h-HYDRATION-DUET-FULL
// - HeroHealth UI
// - mobile readability
// - storm / boss / final rush drama
// - duet sync barrier
// - duet combined summary

export async function boot() {
  const WIN = window;
  const DOC = document;

  const qs = (k, d = '') => {
    try {
      const v = new URLSearchParams(location.search).get(k);
      return v == null || v === '' ? d : v;
    } catch {
      return d;
    }
  };

  const clamp = (v, a, b) => {
    v = Number(v);
    if (!Number.isFinite(v)) v = a;
    return Math.max(a, Math.min(b, v));
  };

  const lerp = (a, b, t) => a + (b - a) * t;
  const nowMs = () => (performance && performance.now ? performance.now() : Date.now());

  function xmur3(str) {
    str = String(str || '');
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return (h ^= (h >>> 16)) >>> 0;
    };
  }

  function sfc32(a, b, c, d) {
    return function () {
      a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
      let t = (a + b) | 0;
      a = b ^ (b >>> 9);
      b = (c + (c << 3)) | 0;
      c = (c << 21) | (c >>> 11);
      d = (d + 1) | 0;
      t = (t + d) | 0;
      c = (c + t) | 0;
      return (t >>> 0) / 4294967296;
    };
  }

  const seedStr = String(qs('seed', Date.now()));
  const seedFn = xmur3(seedStr);
  const rand = sfc32(seedFn(), seedFn(), seedFn(), seedFn());
  const r01 = () => rand();
  const pick = (arr) => arr[Math.floor(r01() * arr.length)] || arr[0];

  const diff = String(qs('diff', 'normal')).toLowerCase();
  const view = String(qs('view', 'mobile')).toLowerCase();
  const hubUrl = String(qs('hub', '../hub.html'));
  const game = String(qs('game', 'hydration'));
  const theme = String(qs('theme', 'hydration'));
  const zone = String(qs('zone', 'nutrition'));
  const cat = String(qs('cat', zone || 'nutrition'));
  const mode = String(qs('mode', 'solo'));
  const pid = String(qs('pid', 'anon'));
  const nick = String(qs('nick', qs('nickName', 'Player'))) || 'Player';
  const runMode = String(qs('run', 'play'));
  const cooldownRequired = String(qs('cooldown', '1')) !== '0';
  const plannedSecRaw = Number(qs('time', diff === 'hard' ? 90 : 80));
  const plannedSec = clamp(
    Number.isFinite(plannedSecRaw) && plannedSecRaw > 0
      ? plannedSecRaw
      : (diff === 'hard' ? 90 : 80),
    30,
    300
  );

  const duet = {
    enabled: mode === 'duet' && String(qs('multiplayer', '0')) === '1',
    roomCode: String(qs('roomCode', '')),
    uid: String(qs('uid', '')),
    db: null,
    roomRef: null,
    roomData: null,
    isHost: false,
    started: false,
    armedAt: 0,
    startCommitSent: false,
    waitingForPeerEnd: false,
    combinedShown: false,
    roomListener: null,
    countdownTimer: 0,
    gateStartedAt: 0
  };

  const ui = {
    stage: DOC.getElementById('stage'),
    layer: DOC.getElementById('layer'),
    zoneSign: DOC.getElementById('zoneSign'),
    calloutLayer: DOC.getElementById('calloutLayer'),
    stickerBurst: DOC.getElementById('stickerBurst'),
    bossFace: DOC.getElementById('bossFace'),
    stageMascotFace: DOC.getElementById('stageMascotFace'),
    stageMascotMood: DOC.getElementById('stageMascotMood'),

    hhPlayerName: DOC.getElementById('hhPlayerName'),
    hhPlayerHint: DOC.getElementById('hhPlayerHint'),
    hhDiffText: DOC.getElementById('hhDiffText'),
    hhViewText: DOC.getElementById('hhViewText'),
    hhTimeText: DOC.getElementById('hhTimeText'),

    score: DOC.getElementById('uiScore'),
    time: DOC.getElementById('uiTime'),
    miss: DOC.getElementById('uiMiss'),
    expire: DOC.getElementById('uiExpire'),
    block: DOC.getElementById('uiBlock'),
    grade: DOC.getElementById('uiGrade'),
    water: DOC.getElementById('uiWater'),
    combo: DOC.getElementById('uiCombo'),
    shield: DOC.getElementById('uiShield'),
    phase: DOC.getElementById('uiPhase'),
    warmDone: DOC.getElementById('uiWarmDone'),
    coolDone: DOC.getElementById('uiCoolDone'),
    aiRisk: DOC.getElementById('aiRisk'),
    aiHint: DOC.getElementById('aiHint'),
    aiRiskMini: DOC.getElementById('aiRiskMini'),
    aiHintMini: DOC.getElementById('aiHintMini'),
    coachExplain: DOC.getElementById('coachExplain'),
    riskFill: DOC.getElementById('riskFill'),

    missionHitNow: DOC.getElementById('missionHitNow'),
    missionHitGoal: DOC.getElementById('missionHitGoal'),
    missionBlockNow: DOC.getElementById('missionBlockNow'),
    missionBlockGoal: DOC.getElementById('missionBlockGoal'),
    missionComboNow: DOC.getElementById('missionComboNow'),
    missionComboGoal: DOC.getElementById('missionComboGoal'),
    missionChipHit: DOC.getElementById('missionChipHit'),
    missionChipBlock: DOC.getElementById('missionChipBlock'),
    missionChipCombo: DOC.getElementById('missionChipCombo'),

    duetOverlay: DOC.getElementById('duetOverlay'),
    duetGateTitle: DOC.getElementById('duetGateTitle'),
    duetGateSub: DOC.getElementById('duetGateSub'),
    duetGateMeName: DOC.getElementById('duetGateMeName'),
    duetGatePeerName: DOC.getElementById('duetGatePeerName'),
    duetGateMeState: DOC.getElementById('duetGateMeState'),
    duetGatePeerState: DOC.getElementById('duetGatePeerState'),
    duetGateCountdown: DOC.getElementById('duetGateCountdown'),

    helpOverlay: DOC.getElementById('helpOverlay'),
    btnHelp: DOC.getElementById('btnHelp'),
    btnHelpStart: DOC.getElementById('btnHelpStart'),

    pauseOverlay: DOC.getElementById('pauseOverlay'),
    btnPause: DOC.getElementById('btnPause'),
    btnResume: DOC.getElementById('btnResume'),

    btnSfx: DOC.getElementById('btnSfx'),

    end: DOC.getElementById('end'),
    endTitle: DOC.getElementById('endTitle'),
    endSub: DOC.getElementById('endSub'),
    endGrade: DOC.getElementById('endGrade'),
    endScore: DOC.getElementById('endScore'),
    endMiss: DOC.getElementById('endMiss'),
    endWater: DOC.getElementById('endWater'),
    endPhaseMini: DOC.getElementById('endPhaseMini'),
    endStars: DOC.getElementById('endStars'),
    endCoach: DOC.getElementById('endCoach'),
    endPhaseSummary: DOC.getElementById('endPhaseSummary'),
    endReward: DOC.getElementById('endReward'),
    endBadge: DOC.getElementById('endBadge'),
    endCollection: DOC.getElementById('endCollection'),
    endRewardCard: DOC.getElementById('endRewardCard'),
    endRewardMini: DOC.getElementById('endRewardMini'),
    endStickerRow: DOC.getElementById('endStickerRow'),
    btnEndToggleDetail: DOC.getElementById('btnEndToggleDetail'),
    endDetailWrap: DOC.getElementById('endDetailWrap'),

    duetEndBoard: DOC.getElementById('duetEndBoard'),
    duetEndMeName: DOC.getElementById('duetEndMeName'),
    duetEndMeScore: DOC.getElementById('duetEndMeScore'),
    duetEndMeMeta: DOC.getElementById('duetEndMeMeta'),
    duetEndPeerName: DOC.getElementById('duetEndPeerName'),
    duetEndPeerScore: DOC.getElementById('duetEndPeerScore'),
    duetEndPeerMeta: DOC.getElementById('duetEndPeerMeta'),
    duetEndWinner: DOC.getElementById('duetEndWinner'),

    btnCopy: DOC.getElementById('btnCopy'),
    btnCopyEvents: DOC.getElementById('btnCopyEvents'),
    btnCopyTimeline: DOC.getElementById('btnCopyTimeline'),
    btnCopyFeatures: DOC.getElementById('btnCopyFeatures'),
    btnCopyLabels: DOC.getElementById('btnCopyLabels'),
    btnCopyFeaturesCsv: DOC.getElementById('btnCopyFeaturesCsv'),
    btnCopyLabelsCsv: DOC.getElementById('btnCopyLabelsCsv'),
    btnSendCloud: DOC.getElementById('btnSendCloud'),

    btnReplay: DOC.getElementById('btnReplay'),
    btnNextCooldown: DOC.getElementById('btnNextCooldown'),
    btnBackHub: DOC.getElementById('btnBackHub'),

    debugMini: DOC.getElementById('debugMini'),
    dbgPhase: DOC.getElementById('dbgPhase'),
    dbgCombo: DOC.getElementById('dbgCombo'),
    dbgWater: DOC.getElementById('dbgWater'),
    dbgShield: DOC.getElementById('dbgShield'),
    dbgBubbles: DOC.getElementById('dbgBubbles'),
    dbgFps: DOC.getElementById('dbgFps')
  };

  const stageEl = ui.stage;
  const layer = ui.layer;
  if (!stageEl || !layer) return;

  const GOOD = ['💧', '💦', '🫗'];
  const BAD = ['🧋', '🥤', '🍟'];
  const SHLD = ['🛡️'];
  const BONUS = ['🌟', '💎', '🫧'];
  const LIGHTNING = ['⚡'];

  const TUNE = {
    spawnBase:
      diff === 'hard' ? 1.95 :
      diff === 'easy' ? 1.45 :
      1.65,

    ttlGood:
      diff === 'hard' ? 1.66 :
      diff === 'easy' ? 2.10 :
      1.90,

    ttlBad:
      diff === 'hard' ? 1.78 :
      diff === 'easy' ? 2.06 :
      1.95,

    missLimit:
      diff === 'hard' ? 15 :
      diff === 'easy' ? 20 :
      18,

    missionHitGood:
      diff === 'hard' ? 11 :
      diff === 'easy' ? 9 :
      10,

    missionBlock:
      diff === 'hard' ? 3 : 2,

    missionCombo:
      diff === 'hard' ? 7 :
      diff === 'easy' ? 5 :
      6
  };

  const PHASE_PLAN = (() => {
    const total = plannedSec;
    const normalEnd = total * 0.30;
    const stormEnd = total * 0.45;
    const bossEnd = total * 0.70;
    const finalRushStart = total * 0.90;
    const bossSpan = bossEnd - stormEnd;
    const bossMood1End = stormEnd + bossSpan * 0.33;
    const bossMood2End = stormEnd + bossSpan * 0.66;
    return {
      total,
      normalEnd,
      stormEnd,
      bossEnd,
      finalRushStart,
      bossMood1End,
      bossMood2End
    };
  })();

  let helpOpen = true;
  let paused = false;
  let ended = false;
  let muted = false;

  let tLeft = plannedSec;
  let score = 0;
  let waterPct = 40;
  let combo = 0;
  let bestCombo = 0;
  let shield = 0;
  let missBadHit = 0;
  let missGoodExpired = 0;
  let blockCount = 0;
  let goodHits = 0;
  let finalHits = 0;
  const finalGoal = clamp(Math.round(plannedSec * 0.13), 8, 16);

  let spawnAcc = 0;
  let bubbleWatchdogSec = 0;
  let liveTargetWatchdogSec = 0;

  let currentPhase = 'normal';
  let bossMood = 0;
  let phaseAnnounced = '';
  let finalRushCelebrated = false;

  let lightningCd = 0;
  let lightningWarnTimer = 0;
  let lightningPendingStep = null;
  let lightningThreatId = '';
  let lightningPatternQueue = [];
  let lightningPatternLabel = '';
  let lightningPatternHint = '';
  let lightningPatternRun = {
    label: '',
    total: 0,
    blocked: 0,
    missed: 0,
    resolved: false
  };

  let rafId = 0;
  let lastTick = 0;
  let fpsFrames = 0;
  let fpsTimer = 0;
  let fpsValue = '—';

  let bubbleSeq = 0;
  const bubbles = new Map();
  const eventLog = [];
  const riskTimeline = [];
  const featureRows = [];
  const labelRows = [];

  function logEvent(type, data = {}) {
    eventLog.push({
      ts: Math.round((plannedSec - tLeft) * 1000),
      type,
      phase: currentPhaseKey(),
      ...data
    });
  }

  function currentPhaseKey() {
    if (currentPhase === 'boss') return `boss${bossMood || 1}`;
    return currentPhase;
  }

  function elapsedSec() {
    return plannedSec - tLeft;
  }

  function isMobileCompact() {
    return WIN.matchMedia ? WIN.matchMedia('(max-width: 640px)').matches : WIN.innerWidth <= 640;
  }

  function setText(el, v) {
    if (el) el.textContent = String(v ?? '');
  }

  function addClassIf(el, cls, on) {
    if (el) el.classList.toggle(cls, !!on);
  }

  function formatClock(sec) {
    const s = Math.max(0, Math.ceil(sec));
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  }

  function safeLocalSet(key, value) {
    try { localStorage.setItem(key, value); } catch {}
  }

  function safeLocalGet(key, fallback = '') {
    try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
  }

  function niceDiffText(v) {
    const s = String(v || '').toLowerCase();
    if (s === 'easy') return 'Easy';
    if (s === 'hard') return 'Hard';
    return 'Normal';
  }

  function niceViewText(v) {
    const s = String(v || '').toLowerCase();
    if (s === 'pc') return 'PC';
    if (s === 'cvr') return 'Cardboard';
    return 'Mobile';
  }

  function bindKidHudMeta() {
    setText(ui.hhPlayerName, nick || 'Player');
    setText(ui.hhPlayerHint, 'Hydration Hero');
    setText(ui.hhDiffText, niceDiffText(diff));
    setText(ui.hhViewText, niceViewText(view));
    setText(ui.hhTimeText, `${plannedSec} วินาที`);
  }

  function currentGrade() {
    if (score >= 260 && waterPct >= 72 && missBadHit <= 3) return 'S';
    if (score >= 200 && waterPct >= 58 && missBadHit <= 5) return 'A';
    if (score >= 140 && waterPct >= 40 && missBadHit <= 8) return 'B';
    if (score >= 80) return 'C';
    return 'D';
  }

  function buildRisk() {
    return clamp(
      (waterPct < 25 ? ((25 - waterPct) / 25) * 0.40 : 0) +
      (missBadHit / Math.max(1, TUNE.missLimit)) * 0.30 +
      (currentPhase !== 'normal' && shield <= 0 ? 0.18 : 0) +
      (combo <= 1 ? 0.05 : 0),
      0, 1
    );
  }

  function phaseProfile() {
    const elapsed = elapsedSec();
    if (elapsed < PHASE_PLAN.normalEnd) return { phase: 'normal', bossMood: 0 };
    if (elapsed < PHASE_PLAN.stormEnd) return { phase: 'storm', bossMood: 0 };
    if (elapsed < PHASE_PLAN.bossEnd) {
      let mood = 1;
      if (elapsed >= PHASE_PLAN.bossMood2End) mood = 3;
      else if (elapsed >= PHASE_PLAN.bossMood1End) mood = 2;
      return { phase: 'boss', bossMood: mood };
    }
    return { phase: 'final', bossMood: 0 };
  }

  function inFinalRushNow() {
    return currentPhase === 'final' && elapsedSec() >= PHASE_PLAN.finalRushStart;
  }

  function currentPhaseText() {
    if (currentPhase === 'storm') return '🌧️ ช่วงพายุ';
    if (currentPhase === 'boss') {
      if (bossMood === 1) return '⚡ บอสเริ่มกดดัน';
      if (bossMood === 2) return '🌪️ บอสแรงขึ้น';
      return '🔥 บอสโกรธแล้ว';
    }
    if (currentPhase === 'final') {
      return inFinalRushNow() ? '⚡ FINAL RUSH' : '👑 ด่านสุดท้าย';
    }
    return combo >= 10 ? '🔥 ไฟลุก • รีบเก็บน้ำ' : '💧 ช่วงเก็บน้ำ';
  }

  function applyStagePhaseVisuals() {
    stageEl.classList.toggle('is-storm', currentPhase === 'storm');
    stageEl.classList.toggle('is-boss', currentPhase === 'boss');
    stageEl.classList.toggle('is-final', currentPhase === 'final');
    stageEl.classList.toggle('is-fever', combo >= 10);

    stageEl.classList.remove('boss-1', 'boss-2', 'boss-3');
    if (currentPhase === 'boss') {
      if (bossMood === 1) stageEl.classList.add('boss-1');
      else if (bossMood === 2) stageEl.classList.add('boss-2');
      else stageEl.classList.add('boss-3');
    }

    if (ui.bossFace) {
      if (currentPhase === 'storm') {
        ui.bossFace.className = 'boss-face show b1';
        ui.bossFace.textContent = '🌧️';
      } else if (currentPhase === 'boss') {
        ui.bossFace.className = `boss-face show ${bossMood === 1 ? 'b1' : bossMood === 2 ? 'b2' : 'b3'}`;
        ui.bossFace.textContent = bossMood === 1 ? '⚡' : bossMood === 2 ? '🌪️' : '🔥';
      } else if (currentPhase === 'final') {
        ui.bossFace.className = 'boss-face show final';
        ui.bossFace.textContent = '👑';
      } else {
        ui.bossFace.className = 'boss-face';
        ui.bossFace.textContent = '⚡';
      }
    }
  }

  function showDuetOverlay() {
    if (ui.duetOverlay) ui.duetOverlay.setAttribute('aria-hidden', 'false');
  }

  function hideDuetOverlay() {
    if (ui.duetOverlay) ui.duetOverlay.setAttribute('aria-hidden', 'true');
  }

  function showHelp() {
    helpOpen = true;
    if (ui.helpOverlay) ui.helpOverlay.setAttribute('aria-hidden', 'false');
  }

  function hideHelp() {
    helpOpen = false;
    if (ui.helpOverlay) ui.helpOverlay.setAttribute('aria-hidden', 'true');
    paused = false;
    lastTick = nowMs();
    ensureStarterTargets(true);
    emergencySpawnIfEmpty();
    scheduleLoop();
  }

  function showPause() {
    paused = true;
    if (ui.pauseOverlay) ui.pauseOverlay.setAttribute('aria-hidden', 'false');
  }

  function hidePause() {
    paused = false;
    if (ui.pauseOverlay) ui.pauseOverlay.setAttribute('aria-hidden', 'true');
    lastTick = nowMs();
    scheduleLoop();
  }

  function showCallout(text, tone = 'good') {
    if (!ui.calloutLayer) return;
    const el = DOC.createElement('div');
    el.className = `callout ${tone}`;
    el.textContent = String(text || '');
    ui.calloutLayer.appendChild(el);
    setTimeout(() => {
      try { el.remove(); } catch {}
    }, 1350);
  }

  function spawnSticker(text) {
    if (!ui.stickerBurst) return;
    const el = DOC.createElement('div');
    el.className = 'sticker';
    el.textContent = String(text || '✨');
    el.style.left = `${12 + r01() * 76}%`;
    el.style.top = `${60 + r01() * 22}%`;
    ui.stickerBurst.appendChild(el);
    setTimeout(() => {
      try { el.remove(); } catch {}
    }, 1100);
  }

  function fxRing(x, y) {
    const el = DOC.createElement('div');
    el.className = 'fx-ring';
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    stageEl.appendChild(el);
    setTimeout(() => {
      try { el.remove(); } catch {}
    }, 450);
  }

  function fxScore(x, y, text) {
    const el = DOC.createElement('div');
    el.className = 'fx-score';
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.textContent = String(text || '');
    stageEl.appendChild(el);
    setTimeout(() => {
      try { el.remove(); } catch {}
    }, 950);
  }

  function fxBubblePop(el, bad = false) {
    if (!el) return;
    el.classList.add(bad ? 'fx-bad' : 'fx-pop');
  }

  function fxStageFlash() {
    const el = DOC.createElement('div');
    el.className = 'storm-flash';
    stageEl.appendChild(el);
    setTimeout(() => {
      try { el.remove(); } catch {}
    }, 260);
  }

  function fxBolt(x) {
    const el = DOC.createElement('div');
    el.className = 'bolt';
    el.style.left = `${x}px`;
    stageEl.appendChild(el);
    setTimeout(() => {
      try { el.remove(); } catch {}
    }, 350);
  }

  function fxPhaseBanner(text) {
    const old = DOC.getElementById('hydrationPhaseBanner');
    if (old) old.remove();

    const banner = DOC.createElement('div');
    banner.id = 'hydrationPhaseBanner';
    banner.style.position = 'absolute';
    banner.style.left = '50%';
    banner.style.top = '38%';
    banner.style.transform = 'translate(-50%,-50%) scale(.92)';
    banner.style.zIndex = '26';
    banner.style.maxWidth = 'min(90vw, 520px)';
    banner.style.padding = '14px 18px';
    banner.style.borderRadius = '22px';
    banner.style.border = '1px solid rgba(255,255,255,.18)';
    banner.style.background = 'rgba(5,10,28,.86)';
    banner.style.backdropFilter = 'blur(10px)';
    banner.style.boxShadow = '0 20px 60px rgba(0,0,0,.35)';
    banner.style.textAlign = 'center';
    banner.style.fontSize = 'clamp(20px, 4vw, 30px)';
    banner.style.fontWeight = '1100';
    banner.style.color = '#fff';
    banner.style.opacity = '0';
    banner.style.transition = 'transform .18s ease, opacity .18s ease';
    banner.textContent = text;
    stageEl.appendChild(banner);

    requestAnimationFrame(() => {
      banner.style.opacity = '1';
      banner.style.transform = 'translate(-50%,-50%) scale(1)';
    });

    setTimeout(() => {
      banner.style.opacity = '0';
      banner.style.transform = 'translate(-50%,-50%) scale(.96)';
      setTimeout(() => {
        try { banner.remove(); } catch {}
      }, 220);
    }, 1050);
  }

  function phaseCheerClass(kind) {
    if (kind === 'storm') return 'phase-cheer-storm';
    if (kind === 'boss') return 'phase-cheer-boss';
    if (kind === 'rage') return 'phase-cheer-rage';
    if (kind === 'final' || kind === 'rush') return 'phase-cheer-final';
    return '';
  }

  function pulsePhaseCheer(kind) {
    const cls = phaseCheerClass(kind);
    if (!cls) return;
    stageEl.classList.remove(
      'phase-cheer-storm',
      'phase-cheer-boss',
      'phase-cheer-rage',
      'phase-cheer-final'
    );
    stageEl.classList.add(cls);
    setTimeout(() => {
      stageEl.classList.remove(cls);
    }, 380);
  }

  function makePhaseCheerLayer() {
    const layerEl = DOC.createElement('div');
    layerEl.className = 'phase-cheer-layer';
    stageEl.appendChild(layerEl);
    return layerEl;
  }

  function addPhaseRibbon(kind, title, sub) {
    const layerEl = makePhaseCheerLayer();
    const ribbon = DOC.createElement('div');
    ribbon.className = `phase-ribbon ${kind}`;
    ribbon.innerHTML = `
      <span class="phase-ribbon-main">${title}</span>
      <span class="phase-ribbon-sub">${sub}</span>
    `;
    layerEl.appendChild(ribbon);
    setTimeout(() => {
      try { layerEl.remove(); } catch {}
    }, 1550);
  }

  function addPhaseBurstIcon(icon) {
    const layerEl = makePhaseCheerLayer();
    const node = DOC.createElement('div');
    node.className = 'phase-burst-icon';
    node.textContent = String(icon || '✨');
    layerEl.appendChild(node);
    setTimeout(() => {
      try { layerEl.remove(); } catch {}
    }, 1150);
  }

  function addPhaseSparkSpray(kind, icon) {
    const layerEl = makePhaseCheerLayer();
    const wrap = DOC.createElement('div');
    wrap.className = 'phase-stars-spray';
    layerEl.appendChild(wrap);

    const count = isMobileCompact() ? 8 : 12;
    for (let i = 0; i < count; i += 1) {
      const spark = DOC.createElement('div');
      spark.className = 'phase-spark';
      spark.textContent = i % 3 === 0 ? icon : (kind === 'storm' ? '✨' : kind === 'final' ? '⭐' : '💥');
      const left = 50 + lerp(-14, 14, r01());
      const top = 34 + lerp(-6, 8, r01());
      spark.style.left = `${left}%`;
      spark.style.top = `${top}%`;
      spark.style.setProperty('--tx', `${lerp(-120, 120, r01()).toFixed(0)}px`);
      spark.style.setProperty('--ty', `${lerp(-90, 50, r01()).toFixed(0)}px`);
      spark.style.animationDelay = `${(i * 0.03).toFixed(2)}s`;
      wrap.appendChild(spark);
    }

    setTimeout(() => {
      try { layerEl.remove(); } catch {}
    }, 1350);
  }

  function addPhaseMilestoneChip(kind, text) {
    const chip = DOC.createElement('div');
    chip.className = `phase-milestone-chip ${kind}`;
    chip.textContent = String(text || '');
    stageEl.appendChild(chip);
    setTimeout(() => {
      try { chip.remove(); } catch {}
    }, 1700);
  }

  function celebratePhaseEntry(kind, config) {
    if (!config || !stageEl) return;
    pulsePhaseCheer(kind);
    addPhaseRibbon(kind, config.title, config.sub);
    addPhaseBurstIcon(config.icon);
    addPhaseSparkSpray(kind, config.spark || config.icon || '✨');
    addPhaseMilestoneChip(kind, config.chip || config.title);
  }

  function pulseStage(kind) {
    stageEl.classList.remove(
      'stage-good-pop',
      'stage-bad-pop',
      'stage-bonus-pop',
      'stage-shield-pop',
      'stage-threat-pop'
    );

    const cls =
      kind === 'good' ? 'stage-good-pop' :
      kind === 'bad' ? 'stage-bad-pop' :
      kind === 'bonus' ? 'stage-bonus-pop' :
      kind === 'shield' ? 'stage-shield-pop' :
      kind === 'threat' ? 'stage-threat-pop' :
      '';

    if (!cls) return;

    stageEl.classList.add(cls);
    setTimeout(() => {
      stageEl.classList.remove(cls);
    }, 220);
  }

  function bubbleBadge(kind) {
    if (kind === 'good') return 'GOOD';
    if (kind === 'bad') return 'BAD';
    if (kind === 'shield') return 'SHIELD';
    if (kind === 'bonus') return 'BONUS';
    if (kind === 'threat') return 'BLOCK';
    return '';
  }

  function bubbleFloatClass() {
    const n = Math.floor(r01() * 3);
    if (n === 0) return 'float-a';
    if (n === 1) return 'float-b';
    return 'float-c';
  }

  function laneX(lane = 'C') {
    const rect = stageEl.getBoundingClientRect();
    const ratio = lane === 'L' ? 0.22 : lane === 'R' ? 0.78 : 0.50;
    return clamp(rect.width * ratio, 28, Math.max(36, rect.width - 28));
  }

  function lightningThreatY() {
    const rect = stageEl.getBoundingClientRect();
    return clamp(rect.height * (isMobileCompact() ? 0.28 : 0.25), 88, Math.max(130, rect.height - 180));
  }

  function safeSpawnXY(kind = 'good') {
    const rect = stageEl.getBoundingClientRect();

    const sidePad = clamp(Math.round(rect.width * 0.09), 24, 60);
    const topPad = isMobileCompact()
      ? clamp(Math.round(rect.height * 0.16), 80, 150)
      : clamp(Math.round(rect.height * 0.18), 90, 170);

    const bottomPad = isMobileCompact()
      ? clamp(Math.round(rect.height * 0.18), 100, 150)
      : clamp(Math.round(rect.height * 0.16), 96, 138);

    const minX = sidePad;
    const maxX = Math.max(sidePad + 30, rect.width - sidePad);

    let minY = topPad;
    let maxY = Math.max(topPad + 40, rect.height - bottomPad);

    if (kind === 'shield') {
      minY = Math.max(topPad, rect.height * 0.22);
      maxY = Math.min(maxY, rect.height * 0.48);
    }

    return {
      x: clamp(lerp(minX, maxX, r01()), minX, maxX),
      y: clamp(lerp(minY, maxY, r01()), minY, maxY)
    };
  }

  function countLiveTargets() {
    let n = 0;
    for (const b of bubbles.values()) {
      if (!b || !b.el || !b.el.isConnected) continue;
      if (['good', 'bad', 'shield', 'bonus', 'threat'].includes(String(b.kind || ''))) n += 1;
    }
    return n;
  }

  function countFriendlyTargets() {
    let n = 0;
    for (const b of bubbles.values()) {
      if (!b || !b.el || !b.el.isConnected) continue;
      if (['good', 'shield', 'bonus'].includes(String(b.kind || ''))) n += 1;
    }
    return n;
  }

  function makeBubble(kind, emoji, ttlSec, meta = {}) {
    const forcedX = Number.isFinite(meta.x) ? Number(meta.x) : null;
    const forcedY = Number.isFinite(meta.y) ? Number(meta.y) : null;
    const pos = (forcedX != null && forcedY != null)
      ? { x: forcedX, y: forcedY }
      : safeSpawnXY(kind);

    const id = `b${++bubbleSeq}`;
    const el = DOC.createElement('button');
    el.className = `bubble bubble-${kind}`;
    el.dataset.kind = kind;
    el.dataset.badge = bubbleBadge(kind);
    el.classList.add(bubbleFloatClass());
    el.type = 'button';
    el.textContent = String(emoji || '');
    el.dataset.id = id;
    el.style.left = `${pos.x}px`;
    el.style.top = `${pos.y}px`;

    if (kind === 'threat') {
      el.style.animation = 'threat-pulse .68s ease-in-out infinite alternate';
    }

    layer.appendChild(el);

    const item = {
      id,
      kind,
      emoji,
      el,
      x: pos.x,
      y: pos.y,
      born: nowMs(),
      ttlMs: ttlSec * 1000,
      ...meta
    };

    bubbles.set(id, item);
    return item;
  }

  function removeThreatLaneGuides() {
    stageEl.querySelectorAll('.threat-lane-guide').forEach((node) => {
      try { node.remove(); } catch {}
    });
  }

  function removeBubble(id) {
    const b = bubbles.get(id);
    if (!b) return;
    try { b.el.remove(); } catch {}
    bubbles.delete(id);

    if (id === lightningThreatId) {
      lightningThreatId = '';
      removeThreatLaneGuides();
    }
  }

  function makeStarterBubble(kind, emoji, ttlSec, xr, yr, meta = {}) {
    const rect = stageEl.getBoundingClientRect();
    const x = clamp(rect.width * xr, 40, Math.max(50, rect.width - 40));
    const y = clamp(rect.height * yr, 110, Math.max(150, rect.height - 130));
    return makeBubble(kind, emoji, ttlSec, { ...meta, x, y });
  }

  function ensureStarterTargets(force = false) {
    if (!stageEl || !layer) return;

    const rect = stageEl.getBoundingClientRect();
    if (rect.width < 160 || rect.height < 260) return;

    let hasGood = false;
    let hasShieldBubble = false;
    let liveCount = 0;

    for (const b of bubbles.values()) {
      if (!b || !b.el || !b.el.isConnected) continue;
      liveCount += 1;
      if (b.kind === 'good') hasGood = true;
      if (b.kind === 'shield') hasShieldBubble = true;
    }

    if (!force && liveCount >= 2 && hasGood) return;

    if (!hasGood) {
      makeStarterBubble('good', pick(GOOD), Math.max(2.8, TUNE.ttlGood + 0.55), 0.32, 0.58);
      makeStarterBubble('good', pick(GOOD), Math.max(2.7, TUNE.ttlGood + 0.40), 0.68, 0.48);
    }

    if (!hasShieldBubble) {
      makeStarterBubble('shield', pick(SHLD), 3.1, 0.50, 0.30);
    }

    showCallout('เริ่มได้เลย 💧', 'good');
  }

  function emergencySpawnIfEmpty() {
    if (countLiveTargets() <= 0) {
      ensureStarterTargets(true);
    }
  }

  function updateLiveTargetWatchdog(dt) {
    const liveTargets = countLiveTargets();
    const friendlyTargets = countFriendlyTargets();

    if (liveTargets > 0 && friendlyTargets > 0) {
      liveTargetWatchdogSec = 0;
      return;
    }

    liveTargetWatchdogSec += dt;
    if (liveTargetWatchdogSec >= 0.85) {
      ensureStarterTargets(true);
      liveTargetWatchdogSec = 0;
    }
  }

  function resetPatternRun() {
    lightningPatternRun = {
      label: '',
      total: 0,
      blocked: 0,
      missed: 0,
      resolved: false
    };
  }

  function tryResolvePatternRun() {
    if (lightningPatternRun.resolved) return;
    if (!lightningPatternRun.label || lightningPatternRun.total <= 0) return;

    const allDone =
      !lightningThreatId &&
      !lightningPendingStep &&
      lightningWarnTimer <= 0 &&
      lightningPatternQueue.length <= 0;

    if (!allDone) return;

    lightningPatternRun.resolved = true;
    const success =
      lightningPatternRun.blocked >= lightningPatternRun.total &&
      lightningPatternRun.missed <= 0;

    if (success) {
      const bonus =
        (currentPhase === 'final' ? 26 : currentPhase === 'boss' ? 20 : 14) +
        Math.max(0, lightningPatternRun.total - 1) * 6;

      score += bonus;
      waterPct = clamp(waterPct + Math.min(12, 4 + lightningPatternRun.total * 2), 0, 100);
      combo += 1;
      bestCombo = Math.max(bestCombo, combo);

      fxPhaseBanner('⚡ PATTERN CLEAR');
      showCallout(`แพทเทิร์นสำเร็จ +${bonus}`, 'good');
      spawnSticker('⚡ CLEAR');
      spawnSticker('🌟 BONUS');

      logEvent('lightning_pattern_clear', {
        label: lightningPatternRun.label,
        total: lightningPatternRun.total,
        bonus
      });
    } else {
      logEvent('lightning_pattern_fail', {
        label: lightningPatternRun.label,
        total: lightningPatternRun.total,
        blocked: lightningPatternRun.blocked,
        missed: lightningPatternRun.missed
      });
    }
  }

  function getSpawnProfile() {
    if (currentPhase === 'storm') {
      return { good: 0.50, bad: 0.24, shield: 0.20, bonus: 0.06 };
    }
    if (currentPhase === 'boss') {
      if (bossMood === 1) return { good: 0.49, bad: 0.28, shield: 0.16, bonus: 0.07 };
      if (bossMood === 2) return { good: 0.45, bad: 0.33, shield: 0.14, bonus: 0.08 };
      return { good: 0.41, bad: 0.38, shield: 0.12, bonus: 0.09 };
    }
    if (currentPhase === 'final') {
      if (inFinalRushNow()) return { good: 0.43, bad: 0.35, shield: 0.12, bonus: 0.10 };
      return { good: 0.47, bad: 0.29, shield: 0.15, bonus: 0.09 };
    }
    return { good: 0.58, bad: 0.20, shield: 0.14, bonus: 0.08 };
  }

  function phaseSpawnMul() {
    if (currentPhase === 'storm') return 1.00;
    if (currentPhase === 'boss') {
      if (bossMood === 1) return 1.05;
      if (bossMood === 2) return 1.11;
      return 1.16;
    }
    if (currentPhase === 'final') return inFinalRushNow() ? 1.22 : 1.08;
    return 1.0;
  }

  function spawnTick(dt) {
    bubbleWatchdogSec += dt;
    spawnAcc += (TUNE.spawnBase * phaseSpawnMul()) * dt;

    while (spawnAcc >= 1) {
      spawnAcc -= 1;

      const profile = getSpawnProfile();
      const bonusP = clamp(profile.bonus, 0.02, 0.14);
      const shieldP = clamp(profile.shield + (shield <= 0 ? 0.03 : 0), 0.06, 0.24);
      const badP = clamp(profile.bad, 0.10, 0.62);
      const goodP = clamp(1 - bonusP - shieldP - badP, 0.18, 0.72);
      const total = goodP + badP + shieldP + bonusP;
      const p = r01() * total;

      let kind = 'good';
      if (p < goodP) kind = 'good';
      else if (p < goodP + badP) kind = 'bad';
      else if (p < goodP + badP + shieldP) kind = 'shield';
      else kind = 'bonus';

      if (kind === 'good') {
        makeBubble('good', pick(GOOD), TUNE.ttlGood);
      } else if (kind === 'bad') {
        makeBubble('bad', pick(BAD), TUNE.ttlBad);
      } else if (kind === 'shield') {
        makeBubble('shield', pick(SHLD), 2.9);
      } else {
        makeBubble('bonus', pick(BONUS), 2.30);
      }
    }

    if (countLiveTargets() > 0) {
      bubbleWatchdogSec = 0;
    } else if (bubbleWatchdogSec >= 1.05) {
      ensureStarterTargets(true);
      emergencySpawnIfEmpty();
      bubbleWatchdogSec = 0;
    }
  }

  function lightningDamage(rate = 1) {
    if (currentPhase === 'final') return 11.5 * rate;
    if (currentPhase === 'boss') return 10.5 * rate;
    return 9.0 * rate;
  }

  function applyLightningStrike(rate = 1, x = null, softBlock = false) {
    const rect = stageEl.getBoundingClientRect();
    const hitX = Number.isFinite(x) ? Number(x) : laneX('C');

    fxStageFlash();
    fxBolt(hitX);

    if (rate >= 1.12) {
      fxBolt(clamp(hitX + lerp(-30, 30, r01()), 18, rect.width - 18));
    }

    stageEl.classList.add('fx-shake');
    setTimeout(() => stageEl.classList.remove('fx-shake'), 220);

    if (shield > 0 && softBlock) {
      shield -= 1;
      blockCount += 1;
      fxScore(hitX, Math.max(70, rect.height * 0.20), 'AUTO BLOCK');
      spawnSticker('🛡️ BLOCK');
      showCallout('โล่ช่วยไว้ได้ แต่คราวหน้ากดให้ทันนะ', 'good');
      logEvent('lightning_auto_block', { shield, blockCount, rate });
      return;
    }

    const damage = lightningDamage(rate);
    waterPct = clamp(waterPct - damage, 0, 100);
    combo = 0;
    missBadHit += 1;

    fxScore(hitX, Math.max(70, rect.height * 0.20), `-${Math.round(damage)}`);
    spawnSticker('⚡ OUCH');
    showCallout('ฟ้าผ่ามาแล้ว รีบเก็บน้ำคืน 💧', 'warn');

    logEvent('lightning_hit', { rate, damage, waterPct, missBadHit });
  }

  function patternLabelFromLanes(lanes = []) {
    const icons = lanes.map((lane) => {
      if (lane === 'L') return 'ซ้าย';
      if (lane === 'R') return 'ขวา';
      return 'กลาง';
    });
    return icons.join('→');
  }

  function buildLightningPatternForCurrentPhase() {
    let patterns = [];

    if (currentPhase === 'storm') {
      patterns = [
        ['L'],
        ['R'],
        ['C'],
        ['L', 'R'],
        ['R', 'L']
      ];
    } else if (currentPhase === 'boss') {
      if (bossMood === 1) {
        patterns = [
          ['L', 'R'],
          ['R', 'L'],
          ['C', 'L'],
          ['C', 'R']
        ];
      } else if (bossMood === 2) {
        patterns = [
          ['L', 'C', 'R'],
          ['R', 'C', 'L'],
          ['L', 'C'],
          ['R', 'C']
        ];
      } else {
        patterns = [
          ['L', 'C', 'R'],
          ['R', 'C', 'L'],
          ['L', 'R', 'L'],
          ['R', 'L', 'R']
        ];
      }
    } else if (currentPhase === 'final') {
      patterns = inFinalRushNow()
        ? [
            ['L', 'C', 'R'],
            ['R', 'C', 'L'],
            ['L', 'R', 'C'],
            ['C', 'L', 'C', 'R']
          ]
        : [
            ['L', 'C', 'R'],
            ['R', 'C', 'L'],
            ['L', 'R', 'C']
          ];
    }

    if (!patterns.length) return null;
    const lanes = pick(patterns);

    return {
      label: patternLabelFromLanes(lanes),
      steps: lanes.map((lane, idx, arr) => ({
        lane,
        rate:
          currentPhase === 'storm'
            ? 1.00 + idx * 0.03
            : currentPhase === 'boss'
              ? (bossMood === 1 ? 1.02 : bossMood === 2 ? 1.10 : 1.18) + idx * 0.04
              : (inFinalRushNow() ? 1.22 : 1.12) + idx * 0.05,
        patternIndex: idx,
        total: arr.length,
        label: patternLabelFromLanes(lanes)
      }))
    };
  }

  function maybeQueueLightningPattern(dt) {
    if (lightningThreatId || lightningPendingStep || lightningWarnTimer > 0 || lightningPatternQueue.length > 0) {
      return;
    }

    let perSec = 0;
    if (currentPhase === 'storm') perSec = 0.42;
    else if (currentPhase === 'boss') perSec = bossMood === 1 ? 0.50 : bossMood === 2 ? 0.64 : 0.78;
    else if (currentPhase === 'final') perSec = inFinalRushNow() ? 0.90 : 0.68;

    if (perSec <= 0) return;
    if (r01() >= perSec * dt) return;

    const pattern = buildLightningPatternForCurrentPhase();
    if (!pattern) return;

    lightningPatternQueue = pattern.steps.slice();
    lightningPatternLabel = pattern.label;
    lightningPatternHint = `แพทเทิร์น: ${pattern.label}`;
    lightningPatternRun = {
      label: pattern.label,
      total: lightningPatternQueue.length,
      blocked: 0,
      missed: 0,
      resolved: false
    };

    fxPhaseBanner(pattern.label);
    showCallout(`⚠️ ${pattern.label}`, currentPhase === 'storm' ? 'warn' : 'boss');
    logEvent('lightning_pattern_queue', { label: pattern.label, total: lightningPatternQueue.length });
  }

  function armThreatStep(step) {
    if (!step) return;
    lightningPendingStep = step;
    lightningWarnTimer = isMobileCompact() ? 0.28 : 0.42;
    lightningCd = Math.max(lightningCd, isMobileCompact() ? 0.95 : 1.10);

    const x = laneX(step.lane);
    const marker = DOC.createElement('div');
    marker.style.position = 'absolute';
    marker.style.left = `${x - 16}px`;
    marker.style.top = '14px';
    marker.style.width = '32px';
    marker.style.height = '32px';
    marker.style.borderRadius = '999px';
    marker.style.display = 'grid';
    marker.style.placeItems = 'center';
    marker.style.fontSize = '16px';
    marker.style.fontWeight = '1000';
    marker.style.color = '#111827';
    marker.style.background = 'rgba(255,216,92,.95)';
    marker.style.boxShadow = '0 10px 28px rgba(255,216,92,.30)';
    marker.style.border = '1px solid rgba(255,255,255,.75)';
    marker.style.pointerEvents = 'none';
    marker.style.zIndex = '21';
    marker.textContent = step.lane === 'L' ? '⬅️' : step.lane === 'R' ? '➡️' : '⭕';
    stageEl.appendChild(marker);

    setTimeout(() => {
      try { marker.remove(); } catch {}
    }, isMobileCompact() ? 360 : 520);
  }

  function spawnLightningThreatFromPending() {
    if (!lightningPendingStep) return;
    const step = lightningPendingStep;
    const x = laneX(step.lane);
    const y = lightningThreatY();
    const ttl = isMobileCompact() ? 1.00 : 1.18;

    const b = makeBubble('threat', pick(LIGHTNING), ttl, {
      x,
      y,
      lane: step.lane,
      rate: step.rate,
      patternIndex: step.patternIndex,
      total: step.total,
      patternLabel: step.label
    });

    lightningThreatId = b.id;
    lightningPendingStep = null;

    showCallout(shield > 0 ? '⚡ ใช้โล่แตะสายฟ้า!' : '⚡ รีบหาโล่แล้วแตะสายฟ้า!', 'boss');
    logEvent('lightning_threat_spawn', {
      lane: step.lane,
      rate: step.rate,
      patternIndex: step.patternIndex,
      total: step.total,
      label: step.label
    });
  }

  function updateLightningSystem(dt) {
    if (lightningCd > 0) {
      lightningCd = Math.max(0, lightningCd - dt);
    }

    if (lightningWarnTimer > 0) {
      lightningWarnTimer = Math.max(0, lightningWarnTimer - dt);
      if (lightningWarnTimer <= 0 && lightningPendingStep) {
        spawnLightningThreatFromPending();
      }
    }

    if (!lightningThreatId && !lightningPendingStep && lightningWarnTimer <= 0 && lightningCd <= 0 && lightningPatternQueue.length > 0) {
      const step = lightningPatternQueue.shift();
      armThreatStep(step);
    }

    if (!lightningThreatId && !lightningPendingStep && lightningWarnTimer <= 0 && lightningPatternQueue.length <= 0) {
      if (!lightningPatternRun.resolved) {
        tryResolvePatternRun();
      } else {
        lightningPatternLabel = '';
        lightningPatternHint = '';
      }
    }
  }

  function syncStageMascot() {
    if (!ui.stageMascotFace || !ui.stageMascotMood) return;

    let face = '💧';
    let mood = 'พร้อมเริ่มแล้ว';

    if (currentPhase === 'storm') {
      face = '🌧️';
      mood = 'พายุมาแล้ว ระวังสายฟ้านะ';
    } else if (currentPhase === 'boss') {
      if (bossMood === 1) {
        face = '⚡';
        mood = 'บอสมาแล้ว หาโล่ไว้ก่อน';
      } else if (bossMood === 2) {
        face = '🌪️';
        mood = 'บอสแรงขึ้นแล้ว รีบเก็บน้ำ';
      } else {
        face = '🔥';
        mood = 'บอสโกรธแล้ว สู้ต่ออีกนิด';
      }
    } else if (currentPhase === 'final') {
      face = '👑';
      mood = inFinalRushNow()
        ? 'FINAL RUSH! รีบเก็บน้ำเลย'
        : 'ถึงด่านสุดท้ายแล้ว';
    } else if (combo >= 10) {
      face = '🔥';
      mood = 'ไฟลุกแล้ว เก็บต่อได้เลย';
    } else if (waterPct < 25) {
      face = '💦';
      mood = 'น้ำน้อยแล้ว รีบเก็บน้ำเพิ่ม';
    } else if (shield <= 0) {
      face = '🛡️';
      mood = 'ลองหาโล่ไว้ก่อนนะ';
    } else {
      face = '💧';
      mood = 'เก็บน้ำดีต่อได้เลย';
    }

    setText(ui.stageMascotFace, face);
    setText(ui.stageMascotMood, mood);
  }

  function syncPhaseDramaDecor() {
    if (!stageEl) return;
    stageEl.classList.toggle('boss-rage', currentPhase === 'boss' && bossMood >= 2);
    stageEl.classList.toggle('final-rush', currentPhase === 'final' && inFinalRushNow());
    if (ui.zoneSign) {
      if (currentPhase === 'storm') ui.zoneSign.style.letterSpacing = '.01em';
      else if (currentPhase === 'boss') ui.zoneSign.style.letterSpacing = bossMood >= 2 ? '.02em' : '.01em';
      else if (currentPhase === 'final' && inFinalRushNow()) ui.zoneSign.style.letterSpacing = '.03em';
      else ui.zoneSign.style.letterSpacing = '';
    }
  }

  function isThreatLive() {
    return !!(lightningThreatId || lightningPendingStep || lightningWarnTimer > 0 || lightningPatternQueue.length > 0);
  }

  function findBestFocusBubble() {
    let threat = null;
    let shieldBubble = null;
    let goodBubble = null;

    for (const b of bubbles.values()) {
      if (!b || !b.el || !b.el.isConnected) continue;
      if (b.kind === 'threat' && !threat) threat = b;
      else if (b.kind === 'shield' && !shieldBubble) shieldBubble = b;
      else if (b.kind === 'good' && !goodBubble) goodBubble = b;
    }

    if (threat) return threat;
    if (shield <= 0 && shieldBubble) return shieldBubble;
    if (waterPct < 25 && goodBubble) return goodBubble;
    return null;
  }

  function clearBubbleFocusClasses() {
    for (const b of bubbles.values()) {
      if (!b || !b.el) continue;
      b.el.classList.remove('bubble-focus', 'bubble-priority');
      delete b.el.dataset.priority;
    }
  }

  function syncBubbleFocus() {
    clearBubbleFocusClasses();

    for (const b of bubbles.values()) {
      if (!b || !b.el) continue;
      if (b.kind === 'threat' || b.kind === 'shield') {
        b.el.classList.add('bubble-priority');
        b.el.dataset.priority = '1';
      }
    }

    const focusBubble = findBestFocusBubble();
    if (focusBubble && focusBubble.el) {
      focusBubble.el.classList.add('bubble-focus', 'bubble-priority');
      focusBubble.el.dataset.priority = '1';
    }
  }

  function ensureThreatLaneGuide() {
    removeThreatLaneGuides();
    if (!isMobileCompact() || !isThreatLive()) return;

    let lane = 'C';
    if (lightningPendingStep && lightningPendingStep.lane) {
      lane = lightningPendingStep.lane;
    } else {
      const liveThreat = bubbles.get(lightningThreatId);
      if (liveThreat && liveThreat.lane) lane = liveThreat.lane;
    }

    const guide = DOC.createElement('div');
    guide.className = 'threat-lane-guide';
    const x = laneX(lane);
    guide.style.left = `${x}px`;
    stageEl.appendChild(guide);
  }

  function ensureScreenEdgeHint() {
    let hint = stageEl.querySelector('.screen-edge-hint');
    if (!hint) {
      hint = DOC.createElement('div');
      hint.className = 'screen-edge-hint';
      stageEl.appendChild(hint);
    }
  }

  function syncCompactHudFocus() {
    if (!stageEl) return;

    stageEl.classList.add('mobile-readable');
    stageEl.classList.toggle('compact-danger', waterPct < 20 || missBadHit >= Math.max(3, Math.floor(TUNE.missLimit * 0.55)));
    stageEl.classList.toggle('compact-low-water', waterPct < 28);
    stageEl.classList.toggle('compact-threat-live', isThreatLive());
    stageEl.classList.toggle('compact-final-rush', currentPhase === 'final' && inFinalRushNow());

    const statGrid = DOC.querySelector('.stats-grid-kid');
    if (statGrid) statGrid.classList.add('compact-mobile-live');

    const cards = statGrid ? Array.from(statGrid.querySelectorAll('.stat-card')) : [];
    cards.forEach((c) => c.classList.remove('critical', 'focus'));

    if (cards.length) {
      const waterCard = cards.find((c) => c.querySelector('#uiWater'));
      const shieldCard = cards.find((c) => c.querySelector('#uiShield'));
      const timeCard = cards.find((c) => c.querySelector('#uiTime'));

      if (waterCard && waterPct < 28) waterCard.classList.add('critical');
      if (shieldCard && isThreatLive()) shieldCard.classList.add('focus');
      if (timeCard && currentPhase === 'final' && inFinalRushNow()) timeCard.classList.add('focus');
    }

    ensureScreenEdgeHint();
    ensureThreatLaneGuide();
    syncBubbleFocus();

    if (ui.zoneSign && isMobileCompact()) {
      if (isThreatLive()) {
        ui.zoneSign.textContent = shield > 0 ? '⚡ ใช้โล่บล็อกสายฟ้า!' : '⚡ รีบหาโล่แล้วแตะสายฟ้า!';
      } else if (currentPhase === 'final' && inFinalRushNow()) {
        ui.zoneSign.textContent = '⚡ FINAL RUSH • รีบเก็บน้ำ!';
      } else if (waterPct < 25) {
        ui.zoneSign.textContent = '💧 น้ำน้อยแล้ว รีบเก็บน้ำเพิ่ม';
      }
    }
  }

  function updatePhaseState() {
    const p = phaseProfile();
    const key = `${p.phase}-${p.bossMood}`;

    currentPhase = p.phase;
    bossMood = p.bossMood;
    applyStagePhaseVisuals();

    if (phaseAnnounced !== key) {
      phaseAnnounced = key;

      if (currentPhase === 'storm') {
        fxPhaseBanner('🌧️ พายุมาแล้ว');
        showCallout('พายุมาแล้ว ระวังสายฟ้า', 'warn');

        celebratePhaseEntry('storm', {
          title: 'Storm Time!',
          sub: 'ระวังสายฟ้า แล้วรีบหาโล่',
          icon: '🌧️',
          spark: '⚡',
          chip: 'เข้าสู่ช่วงพายุแล้ว'
        });

      } else if (currentPhase === 'boss') {
        if (bossMood === 1) {
          fxPhaseBanner('⚡ บอสมาแล้ว');
          showCallout('บอสเริ่มแล้ว', 'boss');

          celebratePhaseEntry('boss', {
            title: 'Boss Stage!',
            sub: 'เริ่มด่านบอสแล้ว สู้เลย',
            icon: '⚡',
            spark: '✨',
            chip: 'เข้าสู่ด่านบอส'
          });

        } else if (bossMood === 2) {
          fxPhaseBanner('🌪️ บอสแรงขึ้น');
          showCallout('บอสแรงขึ้นแล้ว', 'boss');

          celebratePhaseEntry('boss', {
            title: 'Boss Power Up!',
            sub: 'บอสเริ่มแรงขึ้นแล้ว',
            icon: '🌪️',
            spark: '💥',
            chip: 'บอสแข็งแรงขึ้น'
          });

        } else {
          fxPhaseBanner('🔥 บอสโกรธแล้ว');
          showCallout('บอสเข้าสู่ Rage Mode', 'boss');

          celebratePhaseEntry('rage', {
            title: 'Rage Mode!',
            sub: 'บอสโกรธแล้ว ตั้งสติไว้',
            icon: '🔥',
            spark: '💥',
            chip: 'บอสเข้าสู่ Rage Mode'
          });
        }

      } else if (currentPhase === 'final') {
        fxPhaseBanner('👑 ด่านสุดท้าย');
        showCallout('ด่านสุดท้ายแล้ว สู้ต่ออีกนิด', 'boss');

        celebratePhaseEntry('final', {
          title: 'Final Stage!',
          sub: 'ถึงด่านสุดท้ายแล้ว',
          icon: '👑',
          spark: '⭐',
          chip: 'เข้าสู่ด่านสุดท้าย'
        });
      }
    }

    if (currentPhase === 'final' && inFinalRushNow() && !finalRushCelebrated) {
      finalRushCelebrated = true;
      fxPhaseBanner('⚡ FINAL RUSH');
      showCallout('รีบเลย เหลือเวลาไม่มากแล้ว!', 'boss');
      spawnSticker('⚡ RUSH');

      celebratePhaseEntry('rush', {
        title: 'Final Rush!',
        sub: 'รีบเก็บน้ำเลย เหลือเวลาไม่มาก',
        icon: '⚡',
        spark: '⭐',
        chip: 'เข้าสู่ FINAL RUSH'
      });
    }
  }

  function checkMissions() {
    setText(ui.missionHitGoal, TUNE.missionHitGood);
    setText(ui.missionBlockGoal, TUNE.missionBlock);
    setText(ui.missionComboGoal, TUNE.missionCombo);

    setText(ui.missionHitNow, Math.min(goodHits, TUNE.missionHitGood));
    setText(ui.missionBlockNow, Math.min(blockCount, TUNE.missionBlock));
    setText(ui.missionComboNow, Math.min(bestCombo, TUNE.missionCombo));

    addClassIf(ui.missionChipHit, 'done', goodHits >= TUNE.missionHitGood);
    addClassIf(ui.missionChipHit, 'hot', goodHits >= Math.max(1, TUNE.missionHitGood - 2) && goodHits < TUNE.missionHitGood);

    addClassIf(ui.missionChipBlock, 'done', blockCount >= TUNE.missionBlock);
    addClassIf(ui.missionChipBlock, 'hot', blockCount >= Math.max(1, TUNE.missionBlock - 1) && blockCount < TUNE.missionBlock);

    addClassIf(ui.missionChipCombo, 'done', bestCombo >= TUNE.missionCombo);
    addClassIf(ui.missionChipCombo, 'hot', bestCombo >= Math.max(1, TUNE.missionCombo - 2) && bestCombo < TUNE.missionCombo);
  }

  function setHUD() {
    setText(ui.score, score);
    setText(ui.time, formatClock(tLeft));
    setText(ui.miss, missBadHit);
    setText(ui.expire, missGoodExpired);
    setText(ui.block, blockCount);
    setText(ui.grade, currentGrade());
    setText(ui.water, `${Math.round(waterPct)}%`);
    setText(ui.combo, combo);
    setText(ui.shield, shield);
    setText(ui.warmDone, 'พร้อม ✨');
    setText(ui.coolDone, cooldownRequired ? 'รอหลังเกม ✨' : 'ไม่ใช้');

    let phaseText = currentPhaseText();
    if (lightningPatternLabel && (lightningThreatId || lightningPendingStep || lightningPatternQueue.length > 0)) {
      phaseText += ` • ${lightningPatternLabel}`;
    }
    setText(ui.phase, phaseText);

    const risk = buildRisk();
    setText(ui.aiRisk, risk.toFixed(2));
    setText(ui.aiRiskMini, risk.toFixed(2));

    let coach = 'แตะน้ำดี และอย่าโดนของไม่ดี 😊';
    if (lightningPatternHint && (lightningThreatId || lightningPendingStep || lightningPatternQueue.length > 0)) {
      coach = shield > 0
        ? `⚡ ${lightningPatternHint} แล้วใช้โล่บล็อก`
        : `⚡ ${lightningPatternHint} แต่ยังไม่มีโล่`;
    } else if (currentPhase === 'final') {
      coach = inFinalRushNow() ? 'รีบเก็บน้ำเลย เหลือเวลาไม่มากแล้ว!' : 'ด่านสุดท้ายแล้ว อย่าพลาดนะ';
    } else if (currentPhase === 'boss') {
      coach = shield > 0 ? 'บอสมาแล้ว ใช้โล่บล็อกสายฟ้าได้' : 'บอสมาแล้ว หาโล่ไว้ก่อน';
    } else if (currentPhase === 'storm') {
      coach = shield > 0 ? 'พายุมาแล้ว ใช้โล่ช่วยได้' : 'พายุมาแล้ว รีบหาโล่';
    } else if (combo >= 10) {
      coach = 'ไฟลุกแล้ว! กวาดน้ำให้เร็ว 🔥';
    } else if (waterPct < 25) {
      coach = 'น้ำน้อยแล้ว รีบเก็บน้ำเพิ่ม 💧';
    } else if (shield <= 0) {
      coach = 'ลองหาโล่ไว้ก่อนนะ 🛡️';
    }

    setText(ui.aiHint, coach);
    setText(ui.aiHintMini, coach);
    setText(ui.coachExplain, coach);

    if (ui.riskFill) ui.riskFill.style.width = `${Math.round(risk * 100)}%`;

    if (ui.zoneSign) {
      if (lightningPatternLabel && (lightningThreatId || lightningPendingStep || lightningPatternQueue.length > 0)) {
        ui.zoneSign.textContent = `⚠️ แพทเทิร์น: ${lightningPatternLabel}`;
      } else if (currentPhase === 'storm') {
        ui.zoneSign.textContent = '🌧️ พายุมาแล้ว ระวังสายฟ้า';
      } else if (currentPhase === 'boss') {
        ui.zoneSign.textContent = bossMood === 1 ? '⚡ บอสเริ่มแล้ว' : bossMood === 2 ? '🌪️ บอสแรงขึ้น' : '🔥 บอส Rage Mode';
      } else if (currentPhase === 'final') {
        ui.zoneSign.textContent = inFinalRushNow() ? '⚡ FINAL RUSH' : '👑 ด่านสุดท้าย';
      } else if (combo >= 10) {
        ui.zoneSign.textContent = '🔥 ไฟลุกแล้ว รีบเก็บน้ำ';
      } else {
        ui.zoneSign.textContent = '';
      }
    }

    checkMissions();
    syncStageMascot();
    syncPhaseDramaDecor();
    syncCompactHudFocus();
    stageEl.classList.toggle('has-shield', shield > 0);

    const debugOn = ['1', 'true', 'yes', 'on'].includes(String(qs('debug', '0')).toLowerCase());
    addClassIf(ui.debugMini, 'is-hidden', !debugOn);

    if (debugOn) {
      fpsFrames += 1;
      fpsTimer += 1 / 60;

      if (fpsTimer >= 0.45) {
        fpsValue = String(Math.round(fpsFrames / Math.max(0.001, fpsTimer)));
        fpsFrames = 0;
        fpsTimer = 0;
      }

      setText(ui.dbgPhase, currentPhaseKey());
      setText(ui.dbgCombo, combo);
      setText(ui.dbgWater, Math.round(waterPct));
      setText(ui.dbgShield, shield);
      setText(ui.dbgBubbles, countLiveTargets());
      setText(ui.dbgFps, fpsValue);
    }
  }

  function updateBubbles(now) {
    for (const [id, b] of Array.from(bubbles.entries())) {
      if (now - b.born < b.ttlMs) continue;

      if (b.kind === 'threat') {
        if (b.patternLabel) lightningPatternRun.missed += 1;
        const bx = Number(b.x || laneX('C'));
        const rate = Number(b.rate || 1);

        removeBubble(id);
        applyLightningStrike(rate, bx, true);
        tryResolvePatternRun();
        continue;
      }

      if (b.kind === 'good') {
        missGoodExpired += 1;
        combo = 0;
        logEvent('good_expire', {});
      }

      removeBubble(id);
    }
  }

  function hitBubble(b) {
    if (!b || !b.el) return;

    const bx = b.x;
    const by = b.y;

    if (b.kind === 'threat') {
      if (shield > 0) {
        shield -= 1;
        blockCount += 1;
        combo += 1;
        bestCombo = Math.max(bestCombo, combo);

        const add =
          currentPhase === 'final' ? 18 :
          currentPhase === 'boss' ? 16 :
          14;

        score += add;

        fxBubblePop(b.el, false);
        pulseStage('threat');
        fxRing(bx, by);
        fxScore(bx, by, 'BLOCK');
        spawnSticker('⚡ BLOCK');
        spawnSticker('🛡️ NICE');

        if (b.patternLabel) {
          lightningPatternRun.blocked += 1;
          const remain = Math.max(0, Number(b.total || 0) - lightningPatternRun.blocked);
          if (remain > 0) {
            showCallout(`ดีมาก เหลืออีก ${remain} จุด`, 'good');
          } else {
            showCallout('บล็อกครบชุดแล้ว!', 'good');
          }
        } else {
          showCallout('บล็อกสายฟ้าสำเร็จ 🛡️', 'good');
        }

        logEvent('lightning_threat_block', {
          scoreAdd: add,
          shield,
          blockCount,
          combo,
          label: b.patternLabel || ''
        });

        setTimeout(() => {
          removeBubble(b.id);
          tryResolvePatternRun();
        }, 40);
      } else {
        fxScore(bx, by, '🛡️?');
        showCallout('ต้องมีโล่ก่อนถึงจะกันได้', 'warn');
        logEvent('lightning_threat_tap_no_shield', {});
      }
      return;
    }

    if (b.kind === 'bonus') {
      combo += 1;
      bestCombo = Math.max(bestCombo, combo);
      score += combo >= 10 ? 40 : 28;
      waterPct = clamp(waterPct + 10, 0, 100);
      shield = clamp(shield + 1, 0, 9);

      fxBubblePop(b.el, false);
      pulseStage('bonus');
      fxRing(bx, by);
      fxScore(bx, by, 'BONUS');
      spawnSticker('🎁 BONUS');
      showCallout('โบนัสพิเศษแล้ว 🎁', 'good');

      logEvent('bonus_hit', { combo, waterPct, shield });

      setTimeout(() => removeBubble(b.id), 40);
      return;
    }

    if (b.kind === 'good') {
      combo += 1;
      bestCombo = Math.max(bestCombo, combo);
      goodHits += 1;
      if (currentPhase === 'final') finalHits += 1;

      const add = combo >= 10 ? 16 : 10;
      score += add;
      waterPct = clamp(waterPct + 4.5, 0, 100);

      fxBubblePop(b.el, false);
      pulseStage('good');
      fxRing(bx, by);
      fxScore(bx, by, `+${add}`);

      if (combo === 3) showCallout('ดีมาก เก็บน้ำต่อได้เลย', 'good');
      if (combo === 7) showCallout('คอมโบสวยมาก ✨', 'good');
      if (combo === 12) showCallout('เก่งสุด ๆ ไปเลย 🌟', 'good');

      logEvent('good_hit', { scoreAdd: add, combo, waterPct, finalHits });

      setTimeout(() => removeBubble(b.id), 40);
      return;
    }

    if (b.kind === 'shield') {
      combo += 1;
      bestCombo = Math.max(bestCombo, combo);
      shield = clamp(shield + 1, 0, 9);
      score += 6;

      fxBubblePop(b.el, false);
      pulseStage('shield');
      fxRing(bx, by);
      fxScore(bx, by, '🛡️');
      spawnSticker('🛡️ READY');
      showCallout('ได้โล่แล้ว พร้อมกันสายฟ้า!', 'good');

      logEvent('shield_hit', { shield });

      setTimeout(() => removeBubble(b.id), 40);
      return;
    }

    combo = 0;
    score = Math.max(0, score - 9);
    waterPct = clamp(waterPct - 8, 0, 100);
    missBadHit += 1;

    fxBubblePop(b.el, true);
    pulseStage('bad');
    fxScore(bx, by, '-9');
    showCallout('อุ๊ย โดนของไม่ดี', 'warn');

    logEvent('bad_hit', { missBadHit, waterPct });
    setTimeout(() => removeBubble(b.id), 40);
  }

  function checkEnd() {
    if (tLeft <= 0) return true;
    if (waterPct <= 0) return true;
    if (missBadHit >= TUNE.missLimit) return true;
    return false;
  }

  function qualifiesSoftFinalClear() {
    return (
      currentPhase === 'final' &&
      tLeft <= 0.25 &&
      waterPct >= 72 &&
      score >= Math.max(120, Math.round(plannedSec * 1.8))
    );
  }

  function clearTransientVisuals() {
    try { DOC.getElementById('hydrationPhaseBanner')?.remove(); } catch {}
    try { if (ui.calloutLayer) ui.calloutLayer.innerHTML = ''; } catch {}
    try { if (ui.stickerBurst) ui.stickerBurst.innerHTML = ''; } catch {}
    try { removeThreatLaneGuides(); } catch {}

    for (const b of Array.from(bubbles.values())) {
      try { b.el.remove(); } catch {}
    }
    bubbles.clear();

    lightningThreatId = '';
    lightningPendingStep = null;
    lightningPatternQueue = [];
    lightningPatternLabel = '';
    lightningPatternHint = '';
    resetPatternRun();

    liveTargetWatchdogSec = 0;
    bubbleWatchdogSec = 0;
  }

  function scheduleLoop() {
    if (ended || paused || helpOpen) return;
    if (duet.enabled && !duet.started) return;
    if (rafId) return;
    rafId = requestAnimationFrame(loop);
  }

  function loop(t) {
    rafId = 0;
    if (ended || paused || helpOpen) return;
    if (duet.enabled && !duet.started) return;

    if (!lastTick) lastTick = t;
    const dt = clamp((t - lastTick) / 1000, 0, 0.05);
    lastTick = t;

    tLeft = Math.max(0, tLeft - dt);
    waterPct = clamp(waterPct - dt * 0.16, 0, 100);

    updatePhaseState();
    updateLightningSystem(dt);
    maybeQueueLightningPattern(dt);
    spawnTick(dt);
    updateBubbles(nowMs());
    updateLiveTargetWatchdog(dt);
    setHUD();

    riskTimeline.push({
      ts: Math.round((plannedSec - tLeft) * 1000),
      risk: buildRisk()
    });

    featureRows.push({
      ts: Math.round((plannedSec - tLeft) * 1000),
      phase: currentPhaseKey(),
      score,
      waterPct: +waterPct.toFixed(2),
      shield,
      combo,
      missBadHit,
      missGoodExpired,
      blockCount
    });

    if (finalHits >= finalGoal) {
      showEnd('final-clear');
      return;
    }

    if (checkEnd()) {
      if (tLeft <= 0 && qualifiesSoftFinalClear()) showEnd('final-clear');
      else if (tLeft <= 0) showEnd('time');
      else if (waterPct <= 0) showEnd('water-empty');
      else showEnd('miss-limit');
      return;
    }

    scheduleLoop();
  }

  function buildSummary(reason = 'time') {
    return {
      reason,
      pid,
      nick,
      game,
      theme,
      zone,
      cat,
      mode,
      runMode,
      diff,
      view,
      seed: seedStr,
      plannedSec,
      score,
      waterPct: Math.round(waterPct),
      missBadHit,
      missGoodExpired,
      blockCount,
      comboMax: bestCombo,
      goodHits,
      finalHits,
      finalGoal,
      grade: currentGrade(),
      ts: new Date().toISOString()
    };
  }

  function saveLastSummary(summary) {
    safeLocalSet('HHA_LAST_SUMMARY', JSON.stringify(summary));
    const raw = safeLocalGet('HHA_SUMMARY_HISTORY', '[]');
    let arr = [];
    try { arr = JSON.parse(raw); } catch {}
    if (!Array.isArray(arr)) arr = [];
    arr.unshift(summary);
    if (arr.length > 30) arr = arr.slice(0, 30);
    safeLocalSet('HHA_SUMMARY_HISTORY', JSON.stringify(arr));
  }

  function renderStickerCollection() {
    if (!ui.endStickerRow) return;
    ui.endStickerRow.innerHTML = '';

    const list = [
      { icon: '💧', label: 'เริ่มเก็บน้ำ' },
      { icon: '🛡️', label: 'นักป้องกัน' },
      { icon: '⚡', label: 'ผู้ท้าสายฟ้า' },
      { icon: '👑', label: 'ผู้พิชิตด่านสุดท้าย' }
    ];

    list.forEach((it) => {
      const chip = DOC.createElement('div');
      chip.className = 'stickerChip';
      chip.textContent = `${it.icon} ${it.label}`;
      ui.endStickerRow.appendChild(chip);
    });
  }

  function setEndDetailExpanded(expanded) {
    if (!ui.endDetailWrap) return;
    ui.endDetailWrap.classList.toggle('is-collapsed', !expanded);
    if (ui.btnEndToggleDetail) {
      ui.btnEndToggleDetail.textContent = expanded ? 'ซ่อนรายละเอียด' : 'ดูรายละเอียดเพิ่ม';
    }
  }

  function endPhaseMiniText(reason) {
    if (reason === 'final-clear') return 'ชนะด่าน';
    if (currentPhase === 'final') return 'ด่านสุดท้าย';
    if (currentPhase === 'boss') return 'ด่านบอส';
    if (currentPhase === 'storm') return 'พายุ';
    return 'ปกติ';
  }

  function endCoachText(summary, reason) {
    if (reason === 'final-clear') return 'สุดยอดมาก! วันนี้ผ่านด่านสุดท้ายได้แล้ว 🏆';
    if (summary.waterPct <= 10) return 'รอบหน้าลองรีบเก็บน้ำดีเพิ่มอีกนิดนะ 💧';
    if (summary.missBadHit >= Math.max(3, Math.floor(TUNE.missLimit * 0.5))) return 'ถ้าหลบของไม่ดีได้มากขึ้น คะแนนจะพุ่งอีกเยอะเลย 🚫';
    if (summary.comboMax >= 10) return 'คอมโบดีมากแล้ว รอบหน้ามีลุ้นทำได้สูงกว่านี้อีก ✨';
    if (summary.blockCount >= TUNE.missionBlock) return 'กันสายฟ้าเก่งมากเลย ลองเก็บคอมโบเพิ่มอีกนิด 🌩️';
    return 'เล่นได้ดีแล้ว ลองเก็บน้ำดีต่อเนื่องให้มากขึ้นนะ 😊';
  }

  function endRewardText(summary, reason) {
    if (reason === 'final-clear') return '🏆 ปลดล็อกชัยชนะด่านสุดท้าย';
    if (summary.blockCount >= TUNE.missionBlock) return '🛡️ ได้รางวัลนักป้องกัน';
    if (summary.comboMax >= TUNE.missionCombo) return '✨ ได้รางวัลคอมโบสวย';
    if (summary.grade === 'A' || summary.grade === 'S') return '💧 ได้รางวัลฮีโร่น้ำ';
    return '💧 เล่นจบแล้ว';
  }

  function endBadgeText(summary, reason) {
    if (reason === 'final-clear') return '👑 ผู้พิชิตด่านสุดท้าย';
    if (summary.grade === 'S') return '⭐ เจ้าน้ำตัวจริง';
    if (summary.grade === 'A') return '💙 นักเก็บน้ำเก่งมาก';
    if (summary.grade === 'B') return '💧 ฮีโร่น้ำ';
    return '🌈 ลองอีกครั้ง';
  }

  function endPhaseSummaryText(reason) {
    if (reason === 'final-clear') return 'ผ่านด่านสุดท้ายได้สำเร็จ';
    if (currentPhase === 'final') return 'ไปถึงด่านสุดท้ายแล้ว';
    if (currentPhase === 'boss') return 'ไปถึงด่านบอสแล้ว';
    if (currentPhase === 'storm') return 'ไปถึงช่วงพายุแล้ว';
    return 'เล่นได้จนจบรอบปกติ';
  }

  function endStarCount(summary, reason) {
    if (reason === 'final-clear') return 3;
    if (summary.grade === 'S') return 3;
    if (summary.grade === 'A') return 3;
    if (summary.grade === 'B') return 2;
    if (summary.grade === 'C') return 1;
    return 1;
  }

  function renderEndStars(count) {
    if (!ui.endStars) return;
    const total = 3;
    const safeCount = Math.max(0, Math.min(total, Number(count) || 0));
    ui.endStars.innerHTML = '';
    for (let i = 0; i < total; i += 1) {
      const star = DOC.createElement('span');
      star.className = `end-star ${i < safeCount ? 'on' : 'off'}`;
      star.textContent = '⭐';
      ui.endStars.appendChild(star);
    }
  }

  function buildCooldownUrl() {
    const u = new URL('../warmup-gate.html', location.href);
    u.searchParams.set('gatePhase', 'cooldown');
    u.searchParams.set('game', game);
    u.searchParams.set('theme', theme);
    u.searchParams.set('zone', zone);
    u.searchParams.set('cat', cat);
    u.searchParams.set('mode', mode);
    u.searchParams.set('hub', hubUrl);
    u.searchParams.set('next', hubUrl);
    u.searchParams.set('pid', pid);
    u.searchParams.set('nick', nick);
    u.searchParams.set('nickName', nick);
    u.searchParams.set('seed', String(Date.now()));
    u.searchParams.set('diff', diff);
    u.searchParams.set('run', runMode);
    u.searchParams.set('view', view);
    u.searchParams.set('time', String(plannedSec));
    u.searchParams.set('cooldown', cooldownRequired ? '1' : '0');
    return u.toString();
  }

  /* duet helpers */
  function duetRoomPath() {
    return `hha-battle/hydration/duetRooms/${duet.roomCode}`;
  }

  function firebaseConfigFromWindow() {
    const list = [
      WIN.HHA_FIREBASE_CONFIG,
      WIN.HEROHEALTH_FIREBASE_CONFIG,
      WIN.FIREBASE_CONFIG,
      WIN.__firebaseConfig
    ];
    for (const cfg of list) {
      if (cfg && typeof cfg === 'object' && cfg.apiKey && cfg.projectId) return cfg;
    }
    return null;
  }

  async function ensureDuetFirebase() {
    if (!duet.enabled) return;
    if (typeof firebase === 'undefined') {
      throw new Error('Firebase SDK not loaded in duet run');
    }

    let app = null;
    if (firebase.apps && firebase.apps.length) {
      app = firebase.app();
    } else {
      const cfg = firebaseConfigFromWindow();
      if (!cfg) throw new Error('Missing Firebase config in duet run');
      app = firebase.initializeApp(cfg);
    }

    duet.db = firebase.database(app);
  }

  function duetSortedPlayers(room) {
    return Object.values((room && room.players) || {}).sort((a, b) => {
      const aj = Number(a && a.joinedAt) || 0;
      const bj = Number(b && b.joinedAt) || 0;
      return aj - bj;
    });
  }

  function duetMePeer(room) {
    const players = duetSortedPlayers(room);
    const me = players.find((p) => p && p.uid === duet.uid) || null;
    const peer = players.find((p) => p && p.uid !== duet.uid) || null;
    return { players, me, peer };
  }

  function stopDuetCountdownTicker() {
    if (duet.countdownTimer) {
      clearInterval(duet.countdownTimer);
      duet.countdownTimer = 0;
    }
  }

  function startDuetCountdownTicker(startAt) {
    stopDuetCountdownTicker();
    duet.gateStartedAt = startAt || 0;
    if (!startAt) return;

    duet.countdownTimer = setInterval(() => {
      if (!duet.gateStartedAt) {
        stopDuetCountdownTicker();
        return;
      }
      const remainMs = duet.gateStartedAt - Date.now();
      if (remainMs <= 0) {
        setText(ui.duetGateCountdown, 'GO!');
        stopDuetCountdownTicker();
        if (!duet.started) startDuetGameplay();
        return;
      }
      const remain = Math.max(1, Math.ceil(remainMs / 1000));
      setText(ui.duetGateCountdown, String(remain));
    }, 150);
  }

  function setDuetGateTexts(room) {
    const { players, me, peer } = duetMePeer(room);

    setText(ui.duetGateMeName, me?.name || nick || 'ฉัน');
    setText(ui.duetGatePeerName, peer?.name || 'กำลังรอเพื่อน');

    const myState =
      !me ? 'กำลังเข้าเกม...' :
      me.phase === 'finished' ? 'จบรอบแล้ว' :
      me.runReady ? 'พร้อมแล้ว' :
      'กำลังโหลด...';

    const peerState =
      !peer ? 'กำลังรอ...' :
      peer.phase === 'finished' ? 'จบรอบแล้ว' :
      peer.runReady ? 'พร้อมแล้ว' :
      'กำลังเข้าเกม...';

    setText(ui.duetGateMeState, myState);
    setText(ui.duetGatePeerState, peerState);

    if (players.length < 2) {
      setText(ui.duetGateTitle, 'กำลังรอเพื่อนเข้าเกม');
      setText(ui.duetGateSub, 'เมื่อครบ 2 คนแล้ว ระบบจะเริ่มนับถอยหลัง');
      setText(ui.duetGateCountdown, 'รอเพื่อนเข้าเกม...');
      stopDuetCountdownTicker();
      return;
    }

    const gate = (((room || {}).match || {}).runGate || {});
    const startAt = Number(gate.startedAt) || 0;

    if (startAt > Date.now()) {
      setText(ui.duetGateTitle, 'เตรียมเริ่มพร้อมกัน');
      setText(ui.duetGateSub, 'ทั้งสองคนเข้าเกมแล้ว กำลังนับถอยหลัง');
      startDuetCountdownTicker(startAt);
      return;
    }

    if (duet.started) {
      setText(ui.duetGateTitle, duet.waitingForPeerEnd ? 'รอเพื่อนจบรอบ' : 'เริ่มแล้ว');
      setText(ui.duetGateSub, duet.waitingForPeerEnd ? 'ส่งผลของคุณแล้ว กำลังรออีกคน' : 'เริ่มเล่นพร้อมกันแล้ว');
      setText(ui.duetGateCountdown, duet.waitingForPeerEnd ? 'รอผลสรุปคู่...' : 'GO!');
      stopDuetCountdownTicker();
      return;
    }

    setText(ui.duetGateTitle, 'กำลังจัดคิวเริ่มพร้อมกัน');
    setText(ui.duetGateSub, 'รอให้ host สร้าง start barrier');
    setText(ui.duetGateCountdown, 'พร้อม...');
    stopDuetCountdownTicker();
  }

  async function armDuetStartIfHost(room) {
    if (!duet.enabled || !duet.isHost || duet.startCommitSent || !duet.roomRef) return;

    const { players } = duetMePeer(room);
    const bothReady = players.length === 2 && players.every((p) => p && p.runReady === true);
    const gate = (((room || {}).match || {}).runGate || {});
    if (!bothReady || Number(gate.startedAt) > 0) return;

    duet.startCommitSent = true;
    const armedAt = Date.now() + 2200;

    await duet.roomRef.child('match/runGate').update({
      startedAt: armedAt,
      armedBy: duet.uid,
      state: 'armed'
    });

    await duet.roomRef.update({
      status: 'running',
      updatedAt: firebase.database.ServerValue.TIMESTAMP
    });
  }

  function startDuetGameplay() {
    if (duet.started) return;

    duet.started = true;
    duet.waitingForPeerEnd = false;
    ended = false;
    hideDuetOverlay();
    stopDuetCountdownTicker();

    paused = false;
    helpOpen = false;
    lastTick = nowMs();

    ensureStarterTargets(true);
    emergencySpawnIfEmpty();
    scheduleLoop();
  }

  async function markDuetRunReady() {
    if (!duet.enabled || !duet.db || !duet.roomCode || !duet.uid) return;
    const ref = duet.db.ref(`${duetRoomPath()}/players/${duet.uid}`);
    await ref.update({
      connected: true,
      phase: 'running',
      runReady: true,
      runLoadedAt: firebase.database.ServerValue.TIMESTAMP,
      lastSeenAt: firebase.database.ServerValue.TIMESTAMP,
      name: nick,
      pid
    });
  }

  function duetReports(room) {
    return (((room || {}).match || {}).reports) || {};
  }

  function bothDuetReportsReady(room) {
    const reports = duetReports(room);
    const { peer } = duetMePeer(room);
    if (!reports || !reports[duet.uid]) return false;
    if (!peer || !peer.uid || !reports[peer.uid]) return false;
    return true;
  }

  function renderCombinedDuetEnd(room) {
    if (duet.combinedShown) return;

    const reports = duetReports(room);
    const { peer } = duetMePeer(room);

    const myReport = reports[duet.uid];
    const peerReport = peer ? reports[peer.uid] : null;
    if (!myReport || !peerReport) return;

    duet.combinedShown = true;
    duet.waitingForPeerEnd = false;
    hideDuetOverlay();
    stopDuetCountdownTicker();

    if (ui.duetEndBoard) ui.duetEndBoard.classList.remove('hidden');
    if (ui.end) ui.end.setAttribute('aria-hidden', 'false');

    clearTransientVisuals();
    ended = true;
    paused = false;

    const myScore = Number(myReport.score || 0);
    const peerScore = Number(peerReport.score || 0);

    let winnerText = '🤝 เสมอกันสุดมันส์';
    if (myScore > peerScore) winnerText = `🏆 ${myReport.name || nick} ชนะรอบนี้`;
    else if (peerScore > myScore) winnerText = `🏆 ${peerReport.name || 'เพื่อน'} ชนะรอบนี้`;

    setText(ui.endTitle, 'รอบคู่จบแล้ว');
    setText(ui.endSub, `Duet • ${niceDiffText(diff)} • ${niceViewText(view)}`);
    setText(ui.endGrade, myReport.grade || currentGrade());
    setText(ui.endScore, myScore);
    setText(ui.endMiss, Number(myReport.missBadHit || 0));
    setText(ui.endWater, `${Number(myReport.waterPct || 0)}%`);
    if (ui.endPhaseMini) setText(ui.endPhaseMini, 'Duet');

    renderEndStars(endStarCount({
      grade: myReport.grade || currentGrade(),
      waterPct: Number(myReport.waterPct || 0),
      missBadHit: Number(myReport.missBadHit || 0),
      comboMax: Number(myReport.comboMax || 0),
      blockCount: Number(myReport.blockCount || 0)
    }, myReport.reason || 'duet'));

    setText(ui.endCoach, winnerText);
    setText(ui.endPhaseSummary, 'เริ่มพร้อมกันและสรุปผลเมื่อครบทั้งสองคน');
    setText(ui.endReward, myScore >= peerScore ? '💧 คุณเก็บน้ำได้ดีกว่าในรอบนี้' : '🌊 ลองอีกครั้งเพื่อแซงเพื่อน');
    setText(ui.endBadge, myScore >= peerScore ? '🤝 Duet Winner' : '🌈 Duet Challenger');
    setText(ui.endCollection, `ฉัน ${myScore} คะแนน • เพื่อน ${peerScore} คะแนน`);
    setText(ui.endRewardCard, 'Hydration Duet');
    setText(ui.endRewardMini, 'สรุปผลแบบคู่พร้อมกันแล้ว');
    setText(ui.duetEndMeName, myReport.name || nick);
    setText(ui.duetEndMeScore, myScore);
    setText(ui.duetEndMeMeta, `น้ำ ${Number(myReport.waterPct || 0)}% • เกรด ${myReport.grade || '-'}`);
    setText(ui.duetEndPeerName, peerReport.name || 'เพื่อน');
    setText(ui.duetEndPeerScore, peerScore);
    setText(ui.duetEndPeerMeta, `น้ำ ${Number(peerReport.waterPct || 0)}% • เกรด ${peerReport.grade || '-'}`);
    setText(ui.duetEndWinner, winnerText);

    renderStickerCollection();

    if (ui.btnNextCooldown) {
      ui.btnNextCooldown.classList.toggle('is-hidden', !cooldownRequired);
      ui.btnNextCooldown.onclick = () => {
        location.href = buildCooldownUrl();
      };
    }

    if (ui.btnReplay) {
      ui.btnReplay.onclick = () => {
        const u = new URL(location.href);
        u.searchParams.set('seed', String(Date.now()));
        location.href = u.toString();
      };
    }

    if (ui.btnBackHub) {
      ui.btnBackHub.onclick = () => {
        location.href = hubUrl;
      };
    }

    const compact = isMobileCompact();
    setEndDetailExpanded(!compact);
  }

  async function commitDuetSummary(reason) {
    if (!duet.enabled || duet.waitingForPeerEnd || !duet.roomRef) return;

    duet.waitingForPeerEnd = true;
    paused = true;

    const summary = buildSummary(reason);
    saveLastSummary(summary);

    await duet.roomRef.child(`match/reports/${duet.uid}`).set({
      uid: duet.uid,
      pid,
      name: nick,
      reason,
      score: summary.score,
      waterPct: summary.waterPct,
      missBadHit: summary.missBadHit,
      missGoodExpired: summary.missGoodExpired,
      blockCount: summary.blockCount,
      comboMax: summary.comboMax,
      goodHits: summary.goodHits,
      finalHits: summary.finalHits,
      finalGoal: summary.finalGoal,
      grade: summary.grade,
      finishedAt: firebase.database.ServerValue.TIMESTAMP
    });

    await duet.roomRef.child(`players/${duet.uid}`).update({
      phase: 'finished',
      finished: true,
      finalScore: summary.score,
      ready: false,
      lastSeenAt: firebase.database.ServerValue.TIMESTAMP
    });

    showDuetOverlay();
    setText(ui.duetGateTitle, 'รอเพื่อนจบรอบ');
    setText(ui.duetGateSub, 'ส่งผลของคุณแล้ว กำลังรอผลของอีกคน');
    setText(ui.duetGateCountdown, 'รอผลสรุปคู่...');
  }

  async function initDuetSync() {
    if (!duet.enabled) return;

    helpOpen = false;
    paused = true;
    lastTick = 0;

    if (ui.helpOverlay) ui.helpOverlay.setAttribute('aria-hidden', 'true');
    showDuetOverlay();

    await ensureDuetFirebase();
    duet.roomRef = duet.db.ref(duetRoomPath());

    await markDuetRunReady();

    duet.roomListener = async (snap) => {
      const room = snap.val();
      duet.roomData = room || null;

      if (!room) {
        setText(ui.duetGateTitle, 'ไม่พบห้อง');
        setText(ui.duetGateSub, 'ห้อง duet นี้อาจถูกลบหรือหมดอายุแล้ว');
        setText(ui.duetGateCountdown, 'กลับไป lobby');
        stopDuetCountdownTicker();
        return;
      }

      duet.isHost = room.hostId === duet.uid;
      setDuetGateTexts(room);
      await armDuetStartIfHost(room);

      const gate = (((room || {}).match || {}).runGate || {});
      const startAt = Number(gate.startedAt) || 0;
      duet.armedAt = startAt;

      if (!duet.started && startAt > 0 && Date.now() >= startAt) {
        startDuetGameplay();
      }

      if (duet.waitingForPeerEnd && bothDuetReportsReady(room)) {
        renderCombinedDuetEnd(room);
      }
    };

    duet.roomRef.on('value', duet.roomListener);
  }

  async function showEnd(reason) {
    if (ended && !duet.enabled) return;

    if (duet.enabled && !duet.combinedShown) {
      clearTransientVisuals();
      ended = true;
      await commitDuetSummary(reason);
      return;
    }

    if (ended && duet.enabled && duet.combinedShown) return;

    ended = true;
    paused = false;
    clearTransientVisuals();

    if (reason === 'final-clear') {
      stageEl.classList.add('final-win');
    }

    const summary = buildSummary(reason);
    saveLastSummary(summary);

    if (ui.duetEndBoard) ui.duetEndBoard.classList.add('hidden');
    if (ui.end) ui.end.setAttribute('aria-hidden', 'false');

    setText(
      ui.endTitle,
      reason === 'final-clear'
        ? 'สุดยอด! ผ่านด่านสุดท้ายแล้ว'
        : 'เก่งมาก! จบรอบแล้ว'
    );

    setText(ui.endSub, `มุมมอง ${view} • ระดับ ${diff}`);
    setText(ui.endGrade, summary.grade);
    setText(ui.endScore, summary.score);
    setText(ui.endMiss, summary.missBadHit);
    setText(ui.endWater, `${summary.waterPct}%`);
    setText(ui.endPhaseMini, endPhaseMiniText(reason));
    renderEndStars(endStarCount(summary, reason));

    setText(ui.endCoach, endCoachText(summary, reason));
    setText(ui.endPhaseSummary, endPhaseSummaryText(reason));
    setText(ui.endReward, endRewardText(summary, reason));
    setText(ui.endBadge, endBadgeText(summary, reason));
    setText(ui.endCollection, `สถิติล่าสุด • คะแนน ${summary.score} • เกรด ${summary.grade}`);
    setText(
      ui.endRewardCard,
      reason === 'final-clear' ? 'Hydration Master' : 'Hydration Hero'
    );
    setText(
      ui.endRewardMini,
      reason === 'final-clear'
        ? 'วันนี้ผ่านด่านสุดท้ายได้สำเร็จ'
        : 'รอบนี้เก็บน้ำได้ดีขึ้นอีกนิด'
    );

    renderStickerCollection();

    if (ui.btnNextCooldown) {
      ui.btnNextCooldown.classList.toggle('is-hidden', !cooldownRequired);
      ui.btnNextCooldown.onclick = () => {
        location.href = buildCooldownUrl();
      };
    }

    if (ui.btnReplay) {
      ui.btnReplay.onclick = () => {
        const u = new URL(location.href);
        u.searchParams.set('seed', String(Date.now()));
        location.href = u.toString();
      };
    }

    if (ui.btnBackHub) {
      ui.btnBackHub.onclick = () => {
        location.href = hubUrl;
      };
    }

    const compact = isMobileCompact();
    setEndDetailExpanded(!compact);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(String(text || ''));
      showCallout('คัดลอกแล้ว', 'good');
    } catch {
      console.warn('[hydration] clipboard failed');
    }
  }

  /* events */
  layer.addEventListener('pointerdown', (ev) => {
    if (paused || helpOpen || ended) return;
    const el = ev.target?.closest?.('.bubble');
    if (!el) return;
    const b = bubbles.get(String(el.dataset.id || ''));
    if (b) hitBubble(b);
  });

  WIN.addEventListener('resize', () => {
    try {
      if (countLiveTargets() <= 0) ensureStarterTargets(true);
    } catch {}
  });

  if (ui.btnHelp) ui.btnHelp.onclick = showHelp;
  if (ui.btnHelpStart) ui.btnHelpStart.onclick = hideHelp;
  if (ui.btnPause) ui.btnPause.onclick = () => paused ? hidePause() : showPause();
  if (ui.btnResume) ui.btnResume.onclick = hidePause;

  if (ui.btnSfx) {
    ui.btnSfx.onclick = () => {
      muted = !muted;
      ui.btnSfx.textContent = muted ? '🔇 เสียง' : '🔊 เสียง';
    };
  }

  if (ui.btnCopy) ui.btnCopy.onclick = () => copyText(JSON.stringify(buildSummary('manual-copy'), null, 2));
  if (ui.btnCopyEvents) ui.btnCopyEvents.onclick = () => copyText(JSON.stringify(eventLog, null, 2));
  if (ui.btnCopyTimeline) ui.btnCopyTimeline.onclick = () => copyText(JSON.stringify(riskTimeline, null, 2));
  if (ui.btnCopyFeatures) ui.btnCopyFeatures.onclick = () => copyText(JSON.stringify(featureRows, null, 2));
  if (ui.btnCopyLabels) ui.btnCopyLabels.onclick = () => copyText(JSON.stringify(labelRows, null, 2));
  if (ui.btnCopyFeaturesCsv) ui.btnCopyFeaturesCsv.onclick = () => {
    const rows = featureRows.map((r) => Object.values(r).join(',')).join('\n');
    copyText(rows);
  };
  if (ui.btnCopyLabelsCsv) ui.btnCopyLabelsCsv.onclick = () => {
    const rows = labelRows.map((r) => Object.values(r).join(',')).join('\n');
    copyText(rows);
  };
  if (ui.btnSendCloud) ui.btnSendCloud.onclick = () => {
    showCallout('เวอร์ชันนี้ยังไม่ส่ง cloud', 'warn');
  };

  if (ui.btnEndToggleDetail) {
    ui.btnEndToggleDetail.onclick = () => {
      if (!ui.endDetailWrap) return;
      const isCollapsed = ui.endDetailWrap.classList.contains('is-collapsed');
      setEndDetailExpanded(isCollapsed);
    };
  }

  if (ui.end) ui.end.setAttribute('aria-hidden', 'true');
  if (ui.pauseOverlay) ui.pauseOverlay.setAttribute('aria-hidden', 'true');
  if (ui.helpOverlay) ui.helpOverlay.setAttribute('aria-hidden', 'true');
  if (ui.duetOverlay) ui.duetOverlay.setAttribute('aria-hidden', 'true');

  bindKidHudMeta();
  applyStagePhaseVisuals();
  syncPhaseDramaDecor();
  setHUD();

  if (duet.enabled) {
    await initDuetSync();
  } else {
    ensureStarterTargets(true);
    showHelp();
  }
}