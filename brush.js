(() => {
  'use strict';

  // PATCH v20260513-P47-BRUSH-JS-NULL-GUARD
  // - Guard optional HUD/Boss/Layer DOM nodes before touching .style / appendChild.


  const qs = new URLSearchParams(location.search);

  const GAME_ID = 'brush';
  const GAME_VARIANT = 'brush-v5-single';
  const GAME_TITLE = 'Brush V5: Mouth Rescue Adventure';

  const SCENE_IDS = {
    launcher: 'launcher',
    intro: 'intro',
    scan: 'scan',
    guided: 'guided',
    pressure: 'pressure',
    fever: 'fever',
    bossBreak: 'bossBreak',
    boss: 'boss',
    finish: 'finish',
    summary: 'summary'
  };

  const MODE_CONFIG = {
    learn: {
      id: 'learn',
      label: 'Learn',
      durationSec: 90,
      scanSec: 6,
      bossBreakSec: 8,
      targetScanCount: 2
    },
    adventure: {
      id: 'adventure',
      label: 'Adventure',
      durationSec: 90,
      scanSec: 5,
      bossBreakSec: 7,
      targetScanCount: 3
    },
    rescue: {
      id: 'rescue',
      label: 'Rescue',
      durationSec: 75,
      scanSec: 4,
      bossBreakSec: 6,
      targetScanCount: 3
    }
  };

  const ZONE_DEFS = [
    { id: 'upper-left', label: 'บนซ้าย', patternType: 'horizontal' },
    { id: 'upper-front', label: 'บนหน้า', patternType: 'circle' },
    { id: 'upper-right', label: 'บนขวา', patternType: 'horizontal' },
    { id: 'lower-left', label: 'ล่างซ้าย', patternType: 'vertical' },
    { id: 'lower-front', label: 'ล่างหน้า', patternType: 'circle' },
    { id: 'lower-right', label: 'ล่างขวา', patternType: 'vertical' }
  ];

  const COACH_LINES = {
    intro: ['คราบกำลังบุกแล้ว ไปช่วยฟันกัน!', 'เริ่มจากจุดอันตรายก่อนนะ'],
    scan: ['หาจุดสกปรกที่สุดให้เจอ', 'มองที่ขอบเหงือกและซอกฟัน'],
    guided: ['ค่อย ๆ แปรงตามทิศนะ', 'เยี่ยมเลย ทำตามลายให้ต่อเนื่อง'],
    pressure: ['หลายโซนเริ่มเสี่ยงแล้ว!', 'เลือกโซนให้ดีก่อนคราบลาม'],
    fever: ['สุดยอด! เข้า FEVER แล้ว!', 'รีบเก็บให้ได้มากที่สุด!'],
    bossBreak: ['ทำลายโล่ให้แตก!', 'แตะจุดอ่อนให้ครบ!'],
    boss: ['ตอนนี้แหละ รีบแปรงโจมตี!', 'บอสกำลังอ่อนแรง!'],
    finish: ['ฟันสะอาดสดใส ๆ', 'เยี่ยมมาก ภารกิจเสร็จแล้ว']
  };

  const THREAT_RULES = {
    passiveRisePerSec: 2.4,
    cleanDropPerHit: 1.8
  };

  const FEVER_RULES = {
    comboThreshold: 12,
    durationMs: 6000,
    cleanMultiplier: 1.45,
    scoreMultiplier: 2
  };

  const SCORE_RULES = {
    patternHit: 10,
    zoneComplete: 100,
    scanHit: 50,
    scanSpecialHit: 100,
    bossBreakHit: 40,
    bossBreakPerfect: 200
  };

  const PATTERN_LABELS_TH = {
    horizontal: 'ปัดซ้าย-ขวา',
    vertical: 'ปัดขึ้น-ลง',
    circle: 'วนเป็นวง'
  };

  const BALANCE_RULES = {
    mobile: {
      scanSecOffset: -1,
      guidedMs: 9000,
      pressureMs: 26000,
      bossBreakSecOffset: 0,
      feverComboThreshold: 10,
      bossWindowBonusMs: 1200
    },
    desktop: {
      scanSecOffset: 0,
      guidedMs: 11000,
      pressureMs: 30000,
      bossBreakSecOffset: 0,
      feverComboThreshold: 12,
      bossWindowBonusMs: 0
    }
  };

  const mode = MODE_CONFIG[qs.get('mode') || 'adventure'] || MODE_CONFIG.adventure;

  const ctx = {
    pid: qs.get('pid') || 'anon',
    name: qs.get('name') || 'Hero',
    modeId: mode.id,
    modeLabel: mode.label,
    diff: qs.get('diff') || 'normal',
    view: qs.get('view') || 'mobile',
    runMode: qs.get('run') || 'play',
    hub: qs.get('hub') || '../hub.html',
    seed: qs.get('seed') || '',
    gameId: GAME_ID,
    gameVariant: GAME_VARIANT,
    gameTitle: GAME_TITLE
  };

  const el = {
    sceneStage: document.getElementById('sceneStage'),
    sceneMoodOverlay: document.getElementById('sceneMoodOverlay'),
    sceneSparkleOverlay: document.getElementById('sceneSparkleOverlay'),

    timeText: document.getElementById('timeText'),
    scoreText: document.getElementById('scoreText'),
    comboText: document.getElementById('comboText'),
    threatText: document.getElementById('threatText'),
    sceneText: document.getElementById('sceneText'),

    coachFace: document.getElementById('coachFace'),
    coachLine: document.getElementById('coachLine'),
    leftHud: document.getElementById('leftHud'),
    coachLayer: document.getElementById('coachLayer'),

    targetBanner: document.getElementById('targetBanner'),
    targetBannerText: document.getElementById('targetBannerText'),
    targetBannerSub: document.getElementById('targetBannerSub'),

    sceneInstructionCard: document.getElementById('sceneInstructionCard'),
    sceneInstructionText: document.getElementById('sceneInstructionText'),

    sceneLegendCard: document.getElementById('sceneLegendCard'),
    sceneLegendText: document.getElementById('sceneLegendText'),

    helperCard: document.getElementById('helperCard'),

    scanTimerText: document.getElementById('scanTimerText'),
    scanFoundText: document.getElementById('scanFoundText'),
    objectiveText: document.getElementById('objectiveText'),

    bossShieldText: document.getElementById('bossShieldText'),
    bossBreakTimerText: document.getElementById('bossBreakTimerText'),
    bossBreakCountText: document.getElementById('bossBreakCountText'),

    summaryModal: document.getElementById('summaryModal'),
    summaryRank: document.getElementById('summaryRank'),
    summaryScore: document.getElementById('summaryScore'),
    summaryCoverage: document.getElementById('summaryCoverage'),
    summaryAccuracy: document.getElementById('summaryAccuracy'),
    summaryAdvice: document.getElementById('summaryAdvice'),
    summaryStars: document.getElementById('summaryStars'),
    summaryLiveNote: document.getElementById('summaryLiveNote'),

    btnStart: document.getElementById('btnStart'),
    btnReplay: document.getElementById('btnReplay'),
    btnPause: document.getElementById('btnPause'),
    btnBackHub: document.getElementById('btnBackHub'),

    objectiveCard: document.getElementById('objectiveCard'),
    scanCard: document.getElementById('scanCard'),
    bossCard: document.getElementById('bossCard'),

    brushInputLayer: document.getElementById('brushInputLayer'),
    brushCursor: document.getElementById('brushCursor'),

    plaqueLayer: document.getElementById('plaqueLayer'),
    scanTargetLayer: document.getElementById('scanTargetLayer'),
    bossVisualLayer: document.getElementById('bossVisualLayer'),
    bossCore: document.getElementById('bossCore'),
    bossShieldVisual: document.getElementById('bossShieldVisual'),
    bossMouth: document.getElementById('bossMouth'),
    bossWeakPointLayer: document.getElementById('bossWeakPointLayer'),
    fxLayer: document.getElementById('fxLayer'),
    scorePopupLayer: document.getElementById('scorePopupLayer'),

    srLiveStatus: document.getElementById('srLiveStatus')
  };

  const state = createInitialState();
  const logger = createLogger();
  const sfx = createSimpleAudio();

  injectRuntimeStyles();
  bindEvents();
  bindBrushInputLayer();
  bindBossWeakpoints();
  closeSummary();
  renderLauncher();
  renderFrame();

  function createInitialState() {
    return {
      ctx,
      running: false,
      paused: false,
      sceneId: SCENE_IDS.launcher,
      sceneEnteredAtMs: 0,

      time: {
        startedAtIso: '',
        lastTs: 0,
        elapsedMs: 0,
        durationPlannedSec: mode.durationSec,
        remainingSec: mode.durationSec
      },

      score: {
        total: 0,
        combo: 0,
        comboMax: 0,
        feverActive: false,
        feverEndAtMs: 0
      },

      threat: { percent: 0 },

      zones: ZONE_DEFS.map((z) => ({
        ...z,
        cleanPercent: 0,
        threatPercent: 25,
        visited: false,
        done: false,
        hits: 0,
        misses: 0,
        dwellMs: 0
      })),

      activeZoneId: 'upper-front',

      brushInput: {
        active: false,
        pointerId: null,
        lastX: 0,
        lastY: 0,
        lastHitAtMs: 0
      },

      metrics: {
        hits: 0,
        misses: 0,
        warnings: 0
      },

      scan: {
        played: false,
        active: false,
        roundId: '',
        startedAtMs: 0,
        durationSec: 0,
        targetGoal: 0,
        hits: 0,
        misses: 0,
        specialHits: 0,
        targets: [],
        picked: new Set(),
        accuracyPercent: 0,
        completedGoal: false
      },

      bossBreak: {
        played: false,
        active: false,
        roundId: '',
        startedAtMs: 0,
        durationSec: 0,
        targetGoal: 4,
        hits: 0,
        misses: 0,
        accuracyPercent: 0,
        success: false,
        damageWindowMs: 0
      },

      boss: {
        active: false,
        hpPercent: 100,
        cleared: false,
        damageWindowEndAtMs: 0
      }
    };
  }

  function injectRuntimeStyles() {
    const css = `
      .center-ui-hidden{ display:none !important; }

      .zone-ring.is-hidden-scene{
        opacity:0 !important;
        pointer-events:none !important;
      }

      .zone-ring{
        transition:
          opacity .18s ease,
          transform .18s ease,
          box-shadow .18s ease,
          filter .18s ease,
          border-color .18s ease,
          background .18s ease;
      }

      .zone-ring:not(.is-zone-active):not(.is-zone-done){
        opacity:.20 !important;
        transform:scale(.90);
        filter:saturate(.78);
      }

      .zone-ring.is-zone-active{
        opacity:1 !important;
        transform:scale(1.18) !important;
        border-color:#fff7c2 !important;
        background:radial-gradient(circle, rgba(255,255,255,.36), rgba(255,210,110,.42)) !important;
        box-shadow:
          0 0 0 12px rgba(255,214,107,.22),
          0 0 32px rgba(255,214,107,.42) !important;
        animation:brushTargetBeat .68s ease-in-out infinite alternate;
        filter:saturate(1.18);
      }

      .zone-ring.is-zone-done{
        opacity:.78 !important;
        transform:scale(1.02);
        filter:saturate(1.02);
      }

      .zone-ring.is-priority{
        opacity:1 !important;
        transform:scale(1.22) !important;
        border-color:#ff9eb0 !important;
        background:radial-gradient(circle, rgba(255,255,255,.34), rgba(255,122,154,.34)) !important;
        box-shadow:
          0 0 0 12px rgba(255,122,154,.18),
          0 0 30px rgba(255,122,154,.34) !important;
        animation:priorityBeat .56s ease-in-out infinite alternate;
      }

      .zone-btn.is-priority{
        border-color:#ff9eb0 !important;
        background:linear-gradient(180deg,#fff5f8,#ffe7ee) !important;
        box-shadow:
          0 0 0 3px rgba(255,122,154,.14),
          0 10px 24px rgba(71,156,197,.12) !important;
      }

      .zone-btn.is-priority::after{
        content:'!';
        float:right;
        color:#c93d5d;
        font-weight:1000;
      }

      @keyframes brushTargetBeat{
        0%{ transform:scale(1.08); }
        100%{ transform:scale(1.18); }
      }

      @keyframes priorityBeat{
        0%{ transform:scale(1.12); }
        100%{ transform:scale(1.22); }
      }

      #bossVisualLayer,#bossWeakPointLayer{
        display:none;
      }

      #plaqueLayer,#scanTargetLayer,#fxLayer,#scorePopupLayer{
        position:absolute;
        inset:0;
        pointer-events:none;
        z-index:14;
      }

      .plaque-node,.scan-target,.fx-burst,.score-popup{
        position:absolute;
        transform:translate(-50%, -50%);
      }

      .plaque-node{
        width:26px;
        height:26px;
        border-radius:999px;
        background:radial-gradient(circle at 35% 35%, #fff1ae 0 25%, #ffd46d 25% 65%, #e4a43c 65% 100%);
        border:2px solid rgba(255,255,255,.92);
        box-shadow:0 4px 10px rgba(186,112,38,.18);
        transition:opacity .12s ease, transform .12s ease;
      }
      .plaque-node.is-heavy{ width:34px; height:34px; }
      .plaque-node.is-gap{ width:18px; height:18px; border-radius:8px; }
      .plaque-node.is-dim{ opacity:.35; transform:translate(-50%, -50%) scale(.86); }

      .scan-target{
        position:absolute;
        transform:translate(-50%, -50%);
        width:64px;
        height:64px;
        border-radius:999px;
        border:4px solid #fff;
        background:
          radial-gradient(circle at 35% 35%, rgba(255,255,255,.98) 0 18%, rgba(182,244,255,.96) 18% 48%, rgba(94,205,255,.92) 48% 100%);
        box-shadow:
          0 0 0 8px rgba(114,215,255,.20),
          0 0 26px rgba(114,215,255,.34);
        font-weight:1000;
        color:#1d5a75;
        pointer-events:auto;
        cursor:pointer;
        animation:scanPulseStrong .85s ease-in-out infinite alternate;
      }

      .scan-target::after{
        content:'SCAN';
        position:absolute;
        left:50%;
        top:50%;
        transform:translate(-50%,-50%);
        font-size:12px;
        letter-spacing:.08em;
        font-weight:1000;
        color:#174a61;
        text-shadow:0 1px 0 rgba(255,255,255,.85);
      }

      .scan-target.is-special{
        background:
          radial-gradient(circle at 35% 35%, rgba(255,255,255,.99) 0 18%, rgba(255,243,178,.96) 18% 48%, rgba(255,210,94,.92) 48% 100%);
        box-shadow:
          0 0 0 8px rgba(255,214,107,.24),
          0 0 28px rgba(255,214,107,.40);
        animation:scanPulseBonus .7s ease-in-out infinite alternate;
      }

      .scan-target.is-special::after{
        content:'BONUS';
        color:#8a5c00;
      }

      .scan-target.is-decoy{
        background:
          radial-gradient(circle at 35% 35%, rgba(255,255,255,.96) 0 18%, rgba(255,190,205,.94) 18% 48%, rgba(255,102,126,.90) 48% 100%);
        box-shadow:
          0 0 0 8px rgba(255,102,126,.20),
          0 0 26px rgba(255,102,126,.34);
        animation:scanPulseDanger .7s ease-in-out infinite alternate;
      }

      .scan-target.is-decoy::after{
        content:'TRAP';
        color:#8a2743;
      }

      .scan-target.is-picked{
        opacity:.26;
        transform:translate(-50%, -50%) scale(.78);
        pointer-events:none;
        filter:grayscale(.2);
        animation:none;
      }

      @keyframes scanPulseStrong{
        0%{
          transform:translate(-50%, -50%) scale(.94);
          box-shadow:
            0 0 0 6px rgba(114,215,255,.16),
            0 0 18px rgba(114,215,255,.24);
        }
        100%{
          transform:translate(-50%, -50%) scale(1.06);
          box-shadow:
            0 0 0 10px rgba(114,215,255,.22),
            0 0 30px rgba(114,215,255,.36);
        }
      }

      @keyframes scanPulseBonus{
        0%{
          transform:translate(-50%, -50%) scale(.96);
          box-shadow:
            0 0 0 7px rgba(255,214,107,.18),
            0 0 20px rgba(255,214,107,.28);
        }
        100%{
          transform:translate(-50%, -50%) scale(1.10);
          box-shadow:
            0 0 0 12px rgba(255,214,107,.26),
            0 0 34px rgba(255,214,107,.46);
        }
      }

      @keyframes scanPulseDanger{
        0%{
          transform:translate(-50%, -50%) scale(.96);
          box-shadow:
            0 0 0 7px rgba(255,102,126,.16),
            0 0 18px rgba(255,102,126,.24);
        }
        100%{
          transform:translate(-50%, -50%) scale(1.08);
          box-shadow:
            0 0 0 12px rgba(255,102,126,.24),
            0 0 30px rgba(255,102,126,.42);
        }
      }

      .fx-burst{
        width:16px;
        height:16px;
        border-radius:999px;
        background:radial-gradient(circle, rgba(255,255,255,.98), rgba(114,215,255,.55) 62%, transparent 72%);
        animation:brushFxPop .36s ease-out forwards;
      }

      .fx-burst.is-miss{
        background:radial-gradient(circle, rgba(255,255,255,.95), rgba(255,102,126,.55) 62%, transparent 72%);
      }

      .fx-burst.is-complete{
        width:24px;
        height:24px;
        background:radial-gradient(circle, rgba(255,255,255,.98), rgba(143,236,192,.62) 62%, transparent 72%);
      }

      @keyframes brushFxPop{
        0%{ transform:translate(-50%, -50%) scale(.2); opacity:1; }
        100%{ transform:translate(-50%, -50%) scale(1.8); opacity:0; }
      }

      .score-popup{
        min-width:54px;
        padding:6px 10px;
        border-radius:999px;
        background:rgba(255,255,255,.96);
        border:2px solid rgba(255,255,255,.96);
        box-shadow:0 8px 16px rgba(71,156,197,.14);
        font-size:13px;
        font-weight:1000;
        white-space:nowrap;
        pointer-events:none;
        animation:brushScorePop .68s ease-out forwards;
      }

      .score-popup.is-good{ color:#1f8f66; }
      .score-popup.is-perfect{ color:#d48b00; }
      .score-popup.is-bad{ color:#c93d5d; }
      .score-popup.is-clear{ color:#1f8f66; }
      .score-popup.is-boss{ color:#c93d5d; }
      .score-popup.is-combo{ color:#7a52d4; }

      @keyframes brushScorePop{
        0%{ transform:translate(-50%, -50%) scale(.72); opacity:0; }
        12%{ transform:translate(-50%, -50%) scale(1.05); opacity:1; }
        100%{ transform:translate(-50%, -105%) scale(1.02); opacity:0; }
      }

      .boss-weakpoint{
        border-color:#fff6c9 !important;
        background:
          radial-gradient(circle at 35% 35%, rgba(255,255,255,.95) 0 14%, rgba(255,210,94,.42) 14% 40%, rgba(255,95,150,.52) 40% 100%) !important;
        box-shadow:
          0 0 0 12px rgba(255,126,174,.18),
          0 0 36px rgba(255,208,107,.46) !important;
        animation:weakPulseStrong .62s ease-in-out infinite alternate !important;
      }

      .boss-weakpoint::after{
        content:'HIT';
        position:absolute;
        inset:0;
        display:grid;
        place-items:center;
        font-size:18px;
        font-weight:1000;
        letter-spacing:.08em;
        color:#fffbe0;
        text-shadow:0 0 14px rgba(255,240,150,.72);
      }

      .boss-weakpoint.is-hit{
        opacity:.18 !important;
        transform:scale(.74) !important;
        filter:grayscale(.4);
        animation:none !important;
      }

      @keyframes weakPulseStrong{
        0%{
          transform:scale(1);
          box-shadow:
            0 0 0 10px rgba(255,126,174,.16),
            0 0 22px rgba(255,126,174,.28);
        }
        100%{
          transform:scale(1.12);
          box-shadow:
            0 0 0 14px rgba(255,208,107,.24),
            0 0 38px rgba(255,208,107,.52);
        }
      }

      .coach-card.mood-happy{
        background:linear-gradient(180deg,#f7fff9,#e8fff0) !important;
        border-color:#bcebd0 !important;
      }
      .coach-card.mood-warning{
        background:linear-gradient(180deg,#fff8ef,#ffe7c9) !important;
        border-color:#f2d29a !important;
      }
      .coach-card.mood-danger{
        background:linear-gradient(180deg,#fff4f7,#ffe2ea) !important;
        border-color:#efbfd0 !important;
      }
      .coach-card.mood-boss{
        background:linear-gradient(180deg,#fff3f6,#ffdce5) !important;
        border-color:#efb5c5 !important;
      }

      .coach-face.mood-happy{
        background:linear-gradient(180deg,#e7fff1,#c7f6dc) !important;
        border-color:#a9e6c3 !important;
      }
      .coach-face.mood-warning{
        background:linear-gradient(180deg,#fff9e7,#ffe5a9) !important;
        border-color:#f0cf7a !important;
      }
      .coach-face.mood-danger{
        background:linear-gradient(180deg,#ffeef2,#ffc5d3) !important;
        border-color:#f0a7bc !important;
      }
      .coach-face.mood-boss{
        background:linear-gradient(180deg,#ffe8ef,#ffbfd0) !important;
        border-color:#ee9eb8 !important;
      }

      .scene-phase-flash{
        position:fixed;
        inset:0;
        z-index:55;
        pointer-events:none;
        opacity:0;
        background:rgba(255,255,255,.0);
      }
      .scene-phase-flash.is-show{
        animation:scenePhaseFlash .42s ease-out forwards;
      }
      .scene-phase-flash.kind-scan{
        background:radial-gradient(circle at 50% 50%, rgba(114,215,255,.28), rgba(114,215,255,0) 62%);
      }
      .scene-phase-flash.kind-boss{
        background:radial-gradient(circle at 50% 50%, rgba(255,102,126,.24), rgba(255,102,126,0) 62%);
      }
      .scene-phase-flash.kind-clear{
        background:radial-gradient(circle at 50% 50%, rgba(143,236,192,.28), rgba(143,236,192,0) 62%);
      }

      @keyframes scenePhaseFlash{
        0%{ opacity:0; transform:scale(.96); }
        25%{ opacity:1; transform:scale(1); }
        100%{ opacity:0; transform:scale(1.06); }
      }

      .finish-sparkle{
        position:absolute;
        width:16px;
        height:16px;
        border-radius:999px;
        pointer-events:none;
        z-index:15;
        background:
          radial-gradient(circle, rgba(255,255,255,.98) 0 18%, rgba(255,255,255,.72) 18% 38%, rgba(255,255,255,0) 38% 100%);
        animation:finishSparkleFloat 1.25s ease-out forwards;
      }

      .finish-sparkle::before,
      .finish-sparkle::after{
        content:'';
        position:absolute;
        left:50%;
        top:50%;
        background:rgba(255,255,255,.92);
        transform:translate(-50%,-50%);
        border-radius:999px;
      }

      .finish-sparkle::before{
        width:2px;
        height:16px;
      }

      .finish-sparkle::after{
        width:16px;
        height:2px;
      }

      @keyframes finishSparkleFloat{
        0%{
          transform:translate(-50%,-50%) scale(.2);
          opacity:0;
        }
        18%{
          opacity:1;
        }
        100%{
          transform:translate(-50%,-120%) scale(1.18);
          opacity:0;
        }
      }

      .victory-confetti{
        position:fixed;
        top:-20px;
        width:12px;
        height:18px;
        border-radius:4px;
        pointer-events:none;
        z-index:60;
        opacity:.95;
        animation:confettiFall linear forwards;
      }

      .victory-confetti.shape-rect{ border-radius:3px; }
      .victory-confetti.shape-pill{
        width:10px;
        height:22px;
        border-radius:999px;
      }
      .victory-confetti.shape-dot{
        width:12px;
        height:12px;
        border-radius:999px;
      }

      @keyframes confettiFall{
        0%{
          transform:translate3d(0,-24px,0) rotate(0deg);
          opacity:0;
        }
        10%{ opacity:1; }
        100%{
          transform:translate3d(var(--dx, 0px), 115vh, 0) rotate(var(--rot, 480deg));
          opacity:0;
        }
      }

      .summary-rank-hero{
        min-height:120px;
        border-radius:26px;
        background:linear-gradient(180deg,#fffaf0,#fff3cf);
        border:2px solid rgba(255,255,255,.98);
        box-shadow:
          0 16px 36px rgba(222,170,64,.18),
          inset 0 10px 18px rgba(255,255,255,.46);
        display:grid;
        place-items:center;
        text-align:center;
        padding:14px;
      }

      .summary-rank-hero .rank-big{
        font-size:56px;
        line-height:1;
        font-weight:1000;
        color:#b77900;
        text-shadow:0 2px 0 rgba(255,255,255,.66);
      }

      .summary-rank-hero .rank-sub{
        margin-top:6px;
        font-size:14px;
        font-weight:900;
        color:#7d6a32;
        letter-spacing:.05em;
        text-transform:uppercase;
      }

      .summary-extra-grid{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:10px;
      }

      .summary-extra-card{
        min-height:96px;
        border-radius:22px;
        background:linear-gradient(180deg,#ffffff,#f7fcff);
        border:2px solid rgba(255,255,255,.96);
        box-shadow:0 8px 20px rgba(71,156,197,.10);
        padding:12px;
        display:grid;
        gap:6px;
      }

      .summary-extra-card strong{
        font-size:12px;
        color:#5f7f8f;
        text-transform:uppercase;
        letter-spacing:.04em;
      }

      .summary-extra-card .main{
        font-size:22px;
        font-weight:1000;
        color:#23404d;
        line-height:1.1;
      }

      .summary-extra-card .sub{
        font-size:13px;
        color:#6b7f8a;
        font-weight:800;
        line-height:1.3;
      }

      .summary-extra-card.is-best{
        background:linear-gradient(180deg,#f7fff9,#e8fff0);
        border-color:#bcebd0;
      }

      .summary-extra-card.is-worst{
        background:linear-gradient(180deg,#fff7fa,#ffe8ef);
        border-color:#f0c3d1;
      }

      @media (max-width: 720px){
        #topHud{
          grid-template-columns:repeat(3,minmax(0,1fr)) !important;
          gap:6px !important;
        }

        #topHud .hud-chip:nth-child(4),
        #topHud .hud-chip:nth-child(5){
          display:none !important;
        }

        #leftHud.is-mobile-hidden,
        #coachLayer.is-mobile-hidden,
        #helperCard.is-mobile-hidden,
        #sceneLegendCard.is-mobile-hidden,
        #sceneInstructionCard.is-mobile-hidden{
          display:none !important;
        }

        .target-banner{
          top:calc(70px + var(--safe-top)) !important;
          min-height:48px !important;
          padding:8px 10px !important;
          border-radius:16px !important;
          box-shadow:0 10px 20px rgba(178,91,118,.14) !important;
        }

        .target-banner strong{
          font-size:10px !important;
          margin-bottom:2px !important;
        }

        .target-banner b{
          font-size:17px !important;
          line-height:1.05 !important;
        }

        .target-banner span{
          font-size:11px !important;
          line-height:1.2 !important;
        }

        #bottomHud{
          bottom:62px !important;
          gap:6px !important;
        }

        .bottom-card{
          min-height:48px !important;
          padding:8px 10px !important;
          border-radius:16px !important;
        }

        #objectiveCard .big{
          font-size:14px !important;
        }

        #objectiveCard .sub{
          display:none !important;
        }

        .summary-rank-hero .rank-big{
          font-size:44px;
        }

        .summary-extra-grid{
          grid-template-columns:1fr;
        }
      }
    `;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }

  function createLogger() {
    const buffer = [];
    let currentSceneId = SCENE_IDS.launcher;
    let startAt = performance.now();
    let currentSessionId = makeSessionId();

    return {
      get sessionId() {
        return currentSessionId;
      },
      newSession() {
        currentSessionId = makeSessionId();
        buffer.length = 0;
      },
      setScene(sceneId) {
        currentSceneId = sceneId;
      },
      event(type, payload = {}) {
        buffer.push({
          type,
          at: new Date().toISOString(),
          timeFromStartMs: Math.round(performance.now() - startAt),
          sceneId: currentSceneId,
          sessionId: currentSessionId,
          pid: ctx.pid,
          ...payload
        });
      },
      startSession(payload = {}) {
        this.newSession();
        startAt = performance.now();
        this.event('brush_session_start', payload);
      },
      finish(payload = {}) {
        this.event('brush_session_finish', payload);
      },
      flush() {
        try {
          const key = 'HHA_BRUSH_SINGLE_LOGS';
          const oldLogs = JSON.parse(localStorage.getItem(key) || '[]');
          oldLogs.push(...buffer);
          localStorage.setItem(key, JSON.stringify(oldLogs));
          buffer.length = 0;
        } catch {}
      }
    };
  }

  function makeSessionId() {
    return `brush-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function createSimpleAudio() {
    let ctxAudio = null;

    function ensureCtx() {
      if (!ctxAudio) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctxAudio = new AC();
      }
      return ctxAudio;
    }

    async function unlock() {
      const audioCtx = ensureCtx();
      if (!audioCtx) return;
      if (audioCtx.state === 'suspended') {
        try { await audioCtx.resume(); } catch {}
      }
    }

    function beep(freq = 440, duration = 0.08, type = 'sine', gainValue = 0.03) {
      const audioCtx = ensureCtx();
      if (!audioCtx) return;

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.value = gainValue;

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      const now = audioCtx.currentTime;
      gain.gain.setValueAtTime(gainValue, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.start(now);
      osc.stop(now + duration);
    }

    return {
      unlock,
      hitGood() {
        beep(620, 0.06, 'sine', 0.028);
      },
      hitPerfect() {
        beep(740, 0.08, 'triangle', 0.032);
        setTimeout(() => beep(920, 0.08, 'triangle', 0.026), 55);
      },
      miss() {
        beep(220, 0.10, 'sawtooth', 0.022);
      },
      scanBonus() {
        beep(860, 0.07, 'triangle', 0.03);
        setTimeout(() => beep(1020, 0.07, 'triangle', 0.024), 60);
      },
      bossHit() {
        beep(180, 0.07, 'square', 0.028);
        setTimeout(() => beep(140, 0.08, 'square', 0.022), 45);
      },
      clear() {
        beep(660, 0.07, 'triangle', 0.03);
        setTimeout(() => beep(820, 0.07, 'triangle', 0.024), 60);
        setTimeout(() => beep(980, 0.08, 'triangle', 0.02), 120);
      }
    };
  }

  function bindEvents() {
    el.btnStart?.addEventListener('click', async () => {
      await sfx.unlock();
      startGame();
    });

    el.btnReplay?.addEventListener('click', async () => {
      await sfx.unlock();
      replayGame();
    });

    el.btnPause?.addEventListener('click', togglePause);
    el.btnBackHub?.addEventListener('click', backToHub);

    document.querySelectorAll('[data-zone]').forEach((node) => {
      node.addEventListener('click', () => {
        const zoneId = node.getAttribute('data-zone') || '';
        if (zoneId) onZoneSelect(zoneId, 'button');
      });
    });

    document.querySelectorAll('[data-ring-zone]').forEach((ring) => {
      ring.addEventListener('click', () => {
        const zoneId = ring.getAttribute('data-ring-zone') || '';
        if (zoneId) onZoneSelect(zoneId, 'ring');
      });
    });

    window.addEventListener('keydown', (e) => {
      if (!state.running || state.paused) return;

      if (e.code === 'Space') {
        e.preventDefault();
        simulateBrushHit({ dragDirection: 'horizontal' });
      }

      if (e.code === 'KeyQ') onZoneSelect('upper-left', 'keyboard');
      if (e.code === 'KeyW') onZoneSelect('upper-front', 'keyboard');
      if (e.code === 'KeyE') onZoneSelect('upper-right', 'keyboard');
      if (e.code === 'KeyA') onZoneSelect('lower-left', 'keyboard');
      if (e.code === 'KeyS') onZoneSelect('lower-front', 'keyboard');
      if (e.code === 'KeyD') onZoneSelect('lower-right', 'keyboard');
    });

    window.addEventListener('beforeunload', () => logger.flush());
  }

  function bindBossWeakpoints() {
    document.querySelectorAll('[data-boss-weakpoint]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!state.bossBreak.active) return;
        const id = btn.getAttribute('data-boss-weakpoint') || '';
        onBossBreakHit(id);
      });
    });
  }

  function bindBrushInputLayer() {
    const layer = el.brushInputLayer;
    if (!layer) return;

    layer.addEventListener('pointerdown', onBrushPointerDown);
    layer.addEventListener('pointermove', onBrushPointerMove);
    layer.addEventListener('pointerup', onBrushPointerUp);
    layer.addEventListener('pointercancel', onBrushPointerUp);
    layer.addEventListener('pointerleave', onBrushPointerUp);
  }

  function onBrushPointerDown(e) {
    if (!state.running || state.paused) return;
    if (!isBrushInputScene(state.sceneId)) return;

    const point = getPointFromEvent(e);
    state.brushInput.active = true;
    state.brushInput.pointerId = e.pointerId;
    state.brushInput.lastX = point.x;
    state.brushInput.lastY = point.y;
    state.brushInput.lastHitAtMs = 0;

    el.brushInputLayer?.classList.add('is-active');
    el.brushInputLayer?.classList.remove('is-idle');

    try {
      el.brushInputLayer?.setPointerCapture?.(e.pointerId);
    } catch {}

    updateBrushCursorFromPoint(point);
  }

  function onBrushPointerMove(e) {
    if (!state.brushInput.active) return;
    if (state.brushInput.pointerId !== e.pointerId) return;
    if (!isBrushInputScene(state.sceneId)) return;

    const point = getPointFromEvent(e);
    const dx = point.x - state.brushInput.lastX;
    const dy = point.y - state.brushInput.lastY;
    const dist = distance2d(point.x, point.y, state.brushInput.lastX, state.brushInput.lastY);
    const now = performance.now();

    const angleDeg = Math.atan2(dy, dx) * (180 / Math.PI);
    updateBrushCursorFromPoint(point, Number.isFinite(angleDeg) ? angleDeg : -18);

    const enoughDistance = dist >= brushDragDistanceThresholdPx();
    const enoughTime = (now - state.brushInput.lastHitAtMs) >= brushHitThrottleMs();

    if (enoughDistance && enoughTime) {
      const dragDirection = detectBrushDirection(dx, dy);
      simulateBrushHit({ dragDirection });
      state.brushInput.lastHitAtMs = now;
    }

    state.brushInput.lastX = point.x;
    state.brushInput.lastY = point.y;
  }

  function onBrushPointerUp(e) {
    if (state.brushInput.pointerId !== null && e.pointerId !== state.brushInput.pointerId) return;
    resetBrushInputState();
    el.brushInputLayer?.classList.remove('is-active');
    el.brushInputLayer?.classList.add('is-idle');
    hideBrushCursor();
  }

  function startGame() {
    resetRunState();
    closeSummary();

    state.running = true;
    state.paused = false;
    state.time.startedAtIso = new Date().toISOString();
    state.time.lastTs = performance.now();

    if (el.btnStart) {
      el.btnStart.textContent = '▶ Start';
    }

    logger.startSession({
      modeId: state.ctx.modeId,
      diff: state.ctx.diff,
      view: state.ctx.view
    });

    syncScenePresentation(SCENE_IDS.intro);
    enterScene(SCENE_IDS.intro);
    requestAnimationFrame(tick);
  }

  function replayGame() {
    closeSummary();
    resetRunState();
    renderLauncher();
    startGame();
  }

  function togglePause() {
    if (!state.running) return;

    state.paused = !state.paused;

    if (state.paused) {
      resetBrushInputState();
      hideBrushCursor();
    }

    logger.event(state.paused ? 'brush_pause' : 'brush_resume', {
      sceneId: state.sceneId,
      elapsedMs: Math.round(state.time.elapsedMs)
    });

    if (!state.paused) {
      state.time.lastTs = performance.now();
      requestAnimationFrame(tick);
    }

    renderCoach(state.paused ? '⏸️' : '🪥', state.paused ? 'พักเกมอยู่' : 'กลับมาเล่นต่อแล้ว');
  }

  function backToHub() {
    logger.flush();
    location.href = state.ctx.hub;
  }

  function tick(ts) {
    if (!state.running || state.paused) return;

    const dt = Math.max(0, ts - state.time.lastTs);
    state.time.lastTs = ts;
    state.time.elapsedMs += dt;
    state.time.remainingSec = Math.max(0, state.time.durationPlannedSec - Math.floor(state.time.elapsedMs / 1000));

    updateScene();
    updateGlobalSystems(dt);
    renderFrame();

    if (
      state.time.remainingSec <= 0 &&
      state.sceneId !== SCENE_IDS.finish &&
      state.sceneId !== SCENE_IDS.summary
    ) {
      enterScene(SCENE_IDS.finish);
      return;
    }

    requestAnimationFrame(tick);
  }

  function enterScene(sceneId) {
    state.sceneId = sceneId;
    state.sceneEnteredAtMs = performance.now();
    logger.setScene(sceneId);
    logger.event('brush_scene_enter', { sceneId });

    syncScenePresentation(sceneId);

    if (sceneId === SCENE_IDS.intro) {
      renderCoach('👀', 'ดูตัวอย่างสั้น ๆ ก่อน เดี๋ยวจะเริ่มเล่นจริง');
      flashScene('scan');
    } else if (sceneId === SCENE_IDS.scan) {
      startScanMiniGame();
    } else if (sceneId === SCENE_IDS.guided) {
      renderCoach('🙂', randomPick(COACH_LINES.guided));
    } else if (sceneId === SCENE_IDS.pressure) {
      const priority = getPriorityZone();
      renderCoach(
        '⚠️',
        priority
          ? `หลายโซนเริ่มเสี่ยงแล้ว • รีบช่วย ${priority.label} ก่อน`
          : randomPick(COACH_LINES.pressure)
      );
    } else if (sceneId === SCENE_IDS.bossBreak) {
      startBossBreakMiniGame();
    } else if (sceneId === SCENE_IDS.boss) {
      startBossPhase();
      renderCoach('👑', 'โล่แตกแล้ว! รีบโจมตีก่อนบอสฟื้นตัว');
    } else if (sceneId === SCENE_IDS.finish) {
      renderCoach('✨', randomPick(COACH_LINES.finish));
    } else if (sceneId === SCENE_IDS.summary) {
      finishGame();
    }

    renderFrame();
  }

  function updateScene() {
    const age = performance.now() - state.sceneEnteredAtMs;

    if (state.sceneId === SCENE_IDS.intro) {
      updateCenterTexts(SCENE_IDS.intro);
      setRingSceneState(SCENE_IDS.intro);
      renderMiniMap();

      if (age >= 1200) {
        enterScene(SCENE_IDS.scan);
      }
      return;
    }

    if (state.sceneId === SCENE_IDS.scan) {
      updateScan();
      return;
    }

    if (state.sceneId === SCENE_IDS.guided && age >= getGuidedDurationMs()) {
      enterScene(SCENE_IDS.pressure);
      return;
    }

    if (state.sceneId === SCENE_IDS.pressure) {
      if (!state.score.feverActive && Math.floor(state.score.combo) >= getFeverComboThreshold()) {
        startFever();
      }
      if (age >= getPressureDurationMs()) {
        enterScene(SCENE_IDS.bossBreak);
      }
      return;
    }

    if (state.sceneId === SCENE_IDS.bossBreak) {
      updateBossBreak();
      return;
    }

    if (state.sceneId === SCENE_IDS.boss) {
      if (!state.boss.cleared && performance.now() > state.boss.damageWindowEndAtMs) {
        enterScene(SCENE_IDS.finish);
        return;
      }
      if (state.boss.hpPercent <= 0 && !state.boss.cleared) {
        state.boss.cleared = true;
        enterScene(SCENE_IDS.finish);
      }
      return;
    }

    if (state.sceneId === SCENE_IDS.finish && age >= 1000) {
      enterScene(SCENE_IDS.summary);
    }
  }

  function updateGlobalSystems(dt) {
    const dtSec = dt / 1000;

    if (
      state.sceneId === SCENE_IDS.guided ||
      state.sceneId === SCENE_IDS.pressure ||
      state.sceneId === SCENE_IDS.boss
    ) {
      let rise = 0;

      if (state.sceneId === SCENE_IDS.guided) {
        rise = 1.4;
      } else if (state.sceneId === SCENE_IDS.pressure) {
        rise = 2.2;
      } else if (state.sceneId === SCENE_IDS.boss) {
        rise = 2.8;
      }

      state.threat.percent = clamp(state.threat.percent + rise * dtSec, 0, 100);
    }

    state.zones.forEach((zone) => {
      if (zone.done) return;

      if (state.sceneId === SCENE_IDS.guided) {
        if (zone.id !== state.activeZoneId) {
          zone.threatPercent = clamp(zone.threatPercent + 1.2 * dtSec, 0, 100);
        } else {
          zone.threatPercent = clamp(zone.threatPercent - 1.4 * dtSec, 0, 100);
        }
        return;
      }

      if (state.sceneId === SCENE_IDS.pressure) {
        if (zone.id === state.activeZoneId) {
          zone.threatPercent = clamp(zone.threatPercent - 2.4 * dtSec, 0, 100);
        } else {
          const pressureBoost = (zone.threatPercent || 0) >= 70 ? 4.2 : 2.8;
          zone.threatPercent = clamp(zone.threatPercent + pressureBoost * dtSec, 0, 100);
        }
        return;
      }

      if (state.sceneId === SCENE_IDS.boss) {
        zone.threatPercent = clamp(zone.threatPercent + 0.7 * dtSec, 0, 100);
      }
    });

    if (state.score.feverActive && performance.now() >= state.score.feverEndAtMs) {
      endFever();
    }
  }

  function startScanMiniGame() {
    state.scan = {
      played: true,
      active: true,
      roundId: `scan-${Date.now()}`,
      startedAtMs: performance.now(),
      durationSec: getScanDurationSec(),
      targetGoal: mode.targetScanCount,
      hits: 0,
      misses: 0,
      specialHits: 0,
      targets: buildScanTargets(mode.targetScanCount),
      picked: new Set(),
      accuracyPercent: 0,
      completedGoal: false
    };

    renderCoach('🔎', randomPick(COACH_LINES.scan));
    setObjective(`หาจุดสกปรกอันตราย ${state.scan.targetGoal} จุด`, SCENE_IDS.scan);
    updateCenterTexts(SCENE_IDS.scan);
    renderScanTargets();
    flashScene('scan');
  }

  function buildScanTargets(goal) {
    const pool = [
      { id: 't1', zoneId: 'upper-front', type: 'bonus', special: true,  x: 50, y: 28 },
      { id: 't2', zoneId: 'upper-left',  type: 'real',  special: false, x: 24, y: 38 },
      { id: 't3', zoneId: 'lower-right', type: 'real',  special: false, x: 76, y: 66 },
      { id: 't4', zoneId: 'lower-front', type: 'real',  special: false, x: 50, y: 72 },
      { id: 't5', zoneId: 'upper-right', type: 'decoy', special: false, x: 76, y: 34 },
      { id: 't6', zoneId: 'lower-left',  type: 'decoy', special: false, x: 24, y: 64 }
    ];

    if (goal <= 2) return [pool[0], pool[1], pool[4], pool[5]];
    if (goal === 3) return [pool[0], pool[1], pool[2], pool[4], pool[5]];
    return pool;
  }

  function renderScanTargets() {
    clearNode(el.scanTargetLayer);

    if (!el.scanTargetLayer) return;
    if (!state.scan.active) return;

    state.scan.targets.forEach((target) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'scan-target';

      if (target.special) btn.classList.add('is-special');
      if (target.type === 'decoy') btn.classList.add('is-decoy');
      if (state.scan.picked.has(target.id)) btn.classList.add('is-picked');

      btn.disabled = state.scan.picked.has(target.id);
      btn.style.left = `${target.x}%`;
      btn.style.top = `${target.y}%`;

      if (target.type === 'decoy') {
        btn.setAttribute('aria-label', 'Danger decoy');
      } else if (target.special) {
        btn.setAttribute('aria-label', 'Bonus scan target');
      } else {
        btn.setAttribute('aria-label', 'Scan target');
      }

      btn.addEventListener('click', () => onScanPick(target.id));
      el.scanTargetLayer.appendChild(btn);
    });
  }

  function onScanPick(id) {
    if (!state.scan.active) return;
    if (state.scan.picked.has(id)) return;

    state.scan.picked.add(id);
    const target = state.scan.targets.find((t) => t.id === id);
    if (!target) return;

    if (target.type === 'decoy') {
      state.scan.misses += 1;
      state.metrics.misses += 1;
      state.metrics.warnings += 1;
      state.score.combo = 0;
      state.threat.percent = clamp(state.threat.percent + 6, 0, 100);

      showBigPopup(target.x, target.y - 4, 'กับดัก!', 'bad');
      playFx(target.x, target.y, 'miss');
      renderCoach('😵', 'อันนี้เป็นเป้าหลอก! ลองหา SCAN หรือ BONUS');
      flashScene('boss');
      sfx.miss();
    } else {
      state.scan.hits += 1;
      if (target.special) state.scan.specialHits += 1;

      showBigPopup(
        target.x,
        target.y - 4,
        target.special ? 'โบนัสสแกน +100' : 'สแกน +50',
        target.special ? 'perfect' : 'good'
      );
      playFx(target.x, target.y, 'hit');
      renderCoach('🔎', target.special ? 'เยี่ยม! เจอจุดโบนัสแล้ว' : 'ดีมาก เจอจุดสแกนถูกต้อง');
      flashScene('scan');

      if (target.special) sfx.scanBonus();
      else sfx.hitGood();
    }

    updateCenterTexts(state.sceneId);
    renderScanTargets();
    renderFrame();
  }

  function updateScan() {
    const elapsedSec = (performance.now() - state.scan.startedAtMs) / 1000;
    const remain = Math.max(0, state.scan.durationSec - elapsedSec);
    const need = Math.max(0, state.scan.targetGoal - state.scan.hits);

    if (remain <= 2.2 && need > 0) {
      renderCoach('⏰', `เหลืออีก ${need} จุด • รีบแตะเป้าสแกนให้ครบ`);
    } else if (remain <= 4 && need > 0) {
      renderCoach('🔎', `ยังต้องหาอีก ${need} จุด`);
    }

    if (elapsedSec >= state.scan.durationSec || state.scan.hits >= state.scan.targetGoal) {
      const attempts = state.scan.hits + state.scan.misses;
      state.scan.accuracyPercent = attempts ? Math.round((state.scan.hits / attempts) * 100) : 0;
      state.scan.completedGoal = state.scan.hits >= state.scan.targetGoal;

      const scoreGain =
        state.scan.hits * SCORE_RULES.scanHit +
        state.scan.specialHits * (SCORE_RULES.scanSpecialHit - SCORE_RULES.scanHit);

      state.score.total += scoreGain;

      if (state.scan.accuracyPercent >= 75) {
        state.threat.percent = clamp(state.threat.percent - 10, 0, 100);
        state.score.combo += 2;
      } else if (!state.scan.completedGoal) {
        state.threat.percent = clamp(state.threat.percent + 6, 0, 100);
      }

      state.scan.active = false;
      clearNode(el.scanTargetLayer);

      if (state.scan.completedGoal) {
        showBigPopup(50, 26, 'สแกนครบ!', 'clear');
      } else {
        showBigPopup(50, 26, 'สแกนไม่ครบ', 'bad');
      }

      enterScene(SCENE_IDS.guided);
    }
  }

  function startBossBreakMiniGame() {
    state.bossBreak = {
      played: true,
      active: true,
      roundId: `boss-${Date.now()}`,
      startedAtMs: performance.now(),
      durationSec: getBossBreakDurationSec(),
      targetGoal: 4,
      hits: 0,
      misses: 0,
      accuracyPercent: 0,
      success: false,
      damageWindowMs: 0
    };

    resetBossWeakpoints();
    renderCoach('💥', randomPick(COACH_LINES.bossBreak));
    setObjective('ทำลายจุดอ่อนให้ครบ 4 จุด', SCENE_IDS.bossBreak);
    flashScene('boss');
  }

  function updateBossBreak() {
    const elapsedSec = (performance.now() - state.bossBreak.startedAtMs) / 1000;
    if (elapsedSec >= state.bossBreak.durationSec || state.bossBreak.hits >= state.bossBreak.targetGoal) {
      const attempts = state.bossBreak.hits + state.bossBreak.misses;
      state.bossBreak.accuracyPercent = attempts ? Math.round((state.bossBreak.hits / attempts) * 100) : 0;
      state.bossBreak.success = state.bossBreak.hits >= state.bossBreak.targetGoal;
      state.bossBreak.damageWindowMs = getBossDamageWindowMs();

      state.score.total += state.bossBreak.hits * SCORE_RULES.bossBreakHit;
      if (state.bossBreak.success) {
        state.score.total += SCORE_RULES.bossBreakPerfect;
        showBigPopup(50, 28, 'SHIELD BREAK', 'boss');
      }

      state.bossBreak.active = false;
      enterScene(SCENE_IDS.boss);
    }
  }

  function resetBossWeakpoints() {
    document.querySelectorAll('[data-boss-weakpoint]').forEach((btn) => {
      btn.classList.remove('is-hit');
      btn.disabled = false;
    });
  }

  function onBossBreakHit(id) {
    if (!state.bossBreak.active) return;

    const btn = document.querySelector(`[data-boss-weakpoint="${id}"]`);
    if (!btn || btn.classList.contains('is-hit')) return;

    btn.classList.add('is-hit');
    btn.disabled = true;
    state.bossBreak.hits += 1;

    const pos = elementCenterPercent(btn);

    showBigPopup(pos.x, pos.y - 4, `จุดอ่อน +${SCORE_RULES.bossBreakHit}`, 'boss');
    playFx(pos.x, pos.y, 'hit');
    renderCoach('👑', `ดีมาก เหลืออีก ${Math.max(0, state.bossBreak.targetGoal - state.bossBreak.hits)} จุด`);
    flashScene('boss');

    renderFrame();
  }

  function startBossPhase() {
    state.boss.active = true;
    state.boss.hpPercent = 100;
    state.boss.cleared = false;
    state.boss.damageWindowEndAtMs = performance.now() + (state.bossBreak.damageWindowMs || 2500);

    renderCoach('👑', 'โล่แตกแล้ว! รีบโจมตีก่อนบอสฟื้นตัว');
    setObjective('โล่แตกแล้ว รีบแปรงโจมตีบอส!', SCENE_IDS.boss);
    updateCenterTexts(SCENE_IDS.boss);
    showBigPopup(50, 24, 'เริ่มโจมตีบอส!', 'boss');
    flashScene('boss');
  }

  function onZoneSelect(zoneId, source = 'ring') {
    if (!state.running && state.sceneId !== SCENE_IDS.launcher && state.sceneId !== SCENE_IDS.intro) return;

    const zone = state.zones.find((z) => z.id === zoneId);
    if (!zone) return;

    state.activeZoneId = zoneId;
    zone.visited = true;

    logger.event('brush_zone_select', {
      zoneId,
      source
    });

    updateCenterTexts(state.sceneId);
    renderCoach('🦷', `ตอนนี้ช่วยโซน ${zone.label}`);
    renderFrame();
  }

  function isBrushInputScene(sceneId) {
    return sceneId === SCENE_IDS.guided || sceneId === SCENE_IDS.pressure || sceneId === SCENE_IDS.boss;
  }

  function getPointFromEvent(e) {
    return {
      x: Number(e.clientX || 0),
      y: Number(e.clientY || 0)
    };
  }

  function distance2d(ax, ay, bx, by) {
    return Math.hypot(ax - bx, ay - by);
  }

  function updateBrushCursorFromPoint(point, angleDeg = -18) {
    if (!el.brushCursor) return;
    el.brushCursor.hidden = false;
    el.brushCursor.style.left = `${point.x}px`;
    el.brushCursor.style.top = `${point.y}px`;
    el.brushCursor.style.transform = `translate(-50%, -50%) rotate(${angleDeg}deg)`;
  }

  function hideBrushCursor() {
    if (!el.brushCursor) return;
    el.brushCursor.hidden = true;
  }

  function brushHitThrottleMs() {
    if (state.ctx.view === 'mobile') return 60;
    if (state.ctx.view === 'cvr') return 110;
    return 80;
  }

  function brushDragDistanceThresholdPx() {
    if (state.ctx.view === 'mobile') return 10;
    return 14;
  }

  function resetBrushInputState() {
    state.brushInput.active = false;
    state.brushInput.pointerId = null;
    state.brushInput.lastX = 0;
    state.brushInput.lastY = 0;
    state.brushInput.lastHitAtMs = 0;
  }

  function detectBrushDirection(dx, dy) {
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    const bias = state.ctx.view === 'mobile' ? 1.15 : 1.35;

    if (ax < 2 && ay < 2) return 'none';
    if (ax > ay * bias) return 'horizontal';
    if (ay > ax * bias) return 'vertical';
    return 'circle';
  }

  function getPatternMatchScore(expectedPattern, dragDirection) {
    const mobile = state.ctx.view === 'mobile';

    if (!expectedPattern || dragDirection === 'none') return 0;
    if (expectedPattern === dragDirection) return 1;

    if (
      (expectedPattern === 'horizontal' && dragDirection === 'circle') ||
      (expectedPattern === 'vertical' && dragDirection === 'circle')
    ) {
      return mobile ? 0.70 : 0.45;
    }

    if (
      expectedPattern === 'circle' &&
      (dragDirection === 'horizontal' || dragDirection === 'vertical')
    ) {
      return mobile ? 0.55 : 0.35;
    }

    return mobile ? 0.20 : 0;
  }

  function getPatternResultLabel(score) {
    if (score >= 0.75) return 'perfect';
    if (score >= 0.20) return 'ok';
    return 'bad';
  }

  function simulateBrushHit(detail = {}) {
    if (!state.running || state.paused) return;
    if (!isBrushInputScene(state.sceneId)) return;

    const zone = state.zones.find((z) => z.id === state.activeZoneId);
    if (!zone) return;
    if (zone.done && state.sceneId !== SCENE_IDS.boss) return;

    const dragDirection = detail.dragDirection || 'none';
    let matchScore = getPatternMatchScore(zone.patternType, dragDirection);

    if (state.ctx.view === 'mobile' && state.sceneId === SCENE_IDS.guided && matchScore > 0) {
      matchScore = Math.min(1, matchScore + 0.08);
    }

    if (state.ctx.view === 'mobile' && state.sceneId === SCENE_IDS.boss && matchScore > 0) {
      matchScore = Math.min(1, matchScore + 0.12);
    }

    const resultLabel = getPatternResultLabel(matchScore);
    const anchor = getZoneAnchor(zone.id);

    if (resultLabel === 'bad') {
      zone.misses += 1;
      state.metrics.misses += 1;
      state.metrics.warnings += 1;
      state.score.combo = 0;

      showPopup(anchor.x, anchor.y - 4, 'MISS', 'bad');
      playFx(anchor.x, anchor.y, 'miss');
      renderCoach('😵', `ลองใหม่ โซน ${zone.label} ควรแปรงแบบ ${PATTERN_LABELS_TH[zone.patternType] || zone.patternType}`);
      flashScene('boss');
      sfx.miss();
      renderFrame();
      return;
    }

    const scoreMultiplier = state.score.feverActive ? FEVER_RULES.scoreMultiplier : 1;
    const cleanMultiplier = state.score.feverActive ? FEVER_RULES.cleanMultiplier : 1;
    const pressureBonus = getPressureBonusForZone(zone.id);

    const baseClean = resultLabel === 'perfect' ? 2.6 : 1.8;
    const cleanGain = baseClean * cleanMultiplier * pressureBonus;

    const baseScore = resultLabel === 'perfect'
      ? SCORE_RULES.patternHit
      : Math.round(SCORE_RULES.patternHit * 0.8);

    const scoreGain = baseScore * scoreMultiplier * pressureBonus;

    zone.cleanPercent = clamp(zone.cleanPercent + cleanGain, 0, 100);
    zone.threatPercent = clamp(zone.threatPercent - THREAT_RULES.cleanDropPerHit, 0, 100);
    zone.hits += 1;
    zone.visited = true;
    zone.dwellMs += 120;

    state.metrics.hits += 1;
    state.score.total += Math.round(scoreGain);
    state.score.combo += (resultLabel === 'perfect' ? 1 : 0.5);
    state.score.comboMax = Math.max(state.score.comboMax, Math.floor(state.score.combo));
    state.threat.percent = clamp(state.threat.percent - THREAT_RULES.cleanDropPerHit, 0, 100);

    if (!state.score.feverActive && Math.floor(state.score.combo) >= getFeverComboThreshold()) {
      startFever();
    }

    const priority = getPriorityZone();
    const isPriorityNow =
      state.sceneId === SCENE_IDS.pressure &&
      priority &&
      priority.id === zone.id;

    if (resultLabel === 'perfect') {
      showBigPopup(
        anchor.x,
        anchor.y - 4,
        isPriorityNow ? `PERFECT +${Math.round(scoreGain)} URGENT` : `PERFECT +${Math.round(scoreGain)}`,
        'perfect'
      );
      renderCoach(
        '😄',
        isPriorityNow
          ? `ยอดเยี่ยม! ช่วยโซนเสี่ยง ${zone.label} ได้ตรงจุด`
          : `ดีมาก โซน ${zone.label} ใช้ ${PATTERN_LABELS_TH[zone.patternType] || zone.patternType} ถูกแล้ว`
      );
      flashScene('scan');
      sfx.hitPerfect();
    } else {
      showPopup(
        anchor.x,
        anchor.y - 4,
        isPriorityNow ? `GOOD +${Math.round(scoreGain)} URGENT` : `GOOD +${Math.round(scoreGain)}`,
        'good'
      );
      renderCoach(
        '😊',
        isPriorityNow
          ? `ดีแล้ว กำลังช่วยโซนเสี่ยง ${zone.label}`
          : `เกือบดีแล้ว ลองให้เป็น ${PATTERN_LABELS_TH[zone.patternType] || zone.patternType} ชัดขึ้น`
      );
      sfx.hitGood();
    }

    if (Math.floor(state.score.combo) > 0 && Math.floor(state.score.combo) % 5 === 0) {
      showBigPopup(anchor.x, anchor.y - 12, `COMBO x${Math.floor(state.score.combo)}`, 'combo');
    }

    playFx(anchor.x, anchor.y, 'hit');

    if (!zone.done && zone.cleanPercent >= 100) {
      zone.done = true;
      zone.completedAtMs = Math.round(state.time.elapsedMs);
      state.score.total += SCORE_RULES.zoneComplete;
      showBigPopup(anchor.x, anchor.y - 14, `เคลียร์ ${zone.label}!`, 'clear');
      playFx(anchor.x, anchor.y, 'complete');
      sfx.clear();
    }

    if (state.sceneId === SCENE_IDS.boss) {
      const prevHp = state.boss.hpPercent;
      const bossStageBefore = getBossStage();

      let bossDamageBase = resultLabel === 'perfect' ? 8 : 4;
      if (bossStageBefore.id === 'angry') bossDamageBase += 1;
      if (bossStageBefore.id === 'rage') bossDamageBase += 2;

      const bossDamage = state.score.feverActive ? bossDamageBase * 1.4 : bossDamageBase;
      state.boss.hpPercent = clamp(state.boss.hpPercent - bossDamage, 0, 100);

      showBigPopup(
        50,
        34,
        bossStageBefore.id === 'rage'
          ? `RAGE HIT -${Math.round(bossDamage)}`
          : `บอสโดน -${Math.round(bossDamage)}`,
        'boss'
      );

      sfx.bossHit();
      maybeAnnounceBossStageChange(prevHp, state.boss.hpPercent);
    }

    updateCenterTexts(state.sceneId);
    renderFrame();
  }

  function startFever() {
    state.score.feverActive = true;
    state.score.feverEndAtMs = performance.now() + FEVER_RULES.durationMs;
    renderCoach('🔥', randomPick(COACH_LINES.fever));
  }

  function endFever() {
    state.score.feverActive = false;
    state.score.feverEndAtMs = 0;
  }

  function renderFrame() {
    renderTopHud();
    renderMiniMap();
    renderPlaques();

    if (state.sceneId === SCENE_IDS.scan && state.scan.active) {
      const remain = Math.max(0, Math.ceil(state.scan.durationSec - ((performance.now() - state.scan.startedAtMs) / 1000)));
      renderScanHud(`${remain}s`, `${state.scan.hits} / ${state.scan.targetGoal}`);
      renderScanTargets();
    } else {
      renderScanHud('', '');
      clearNode(el.scanTargetLayer);
    }

    if (state.sceneId === SCENE_IDS.bossBreak && state.bossBreak.active) {
      const remain = Math.max(0, Math.ceil(state.bossBreak.durationSec - ((performance.now() - state.bossBreak.startedAtMs) / 1000)));
      renderBossBreakHud(
        `${Math.max(0, state.bossBreak.targetGoal - state.bossBreak.hits)}`,
        `${remain}s`,
        `${state.bossBreak.hits} / ${state.bossBreak.targetGoal}`
      );
    } else {
      renderBossBreakHud('', '', '');
    }

    setBossUiState(state.sceneId);
  }

  function renderTopHud() {
    setText(el.timeText, `${state.time.remainingSec}s`);
    setText(el.scoreText, Math.round(state.score.total));
    setText(el.comboText, Math.floor(state.score.combo));
    setText(el.threatText, `${Math.round(state.threat.percent)}%`);
    setText(el.sceneText, state.sceneId);

    const threatNum = Math.round(state.threat.percent);
    if (el.threatText) {
      if (threatNum >= 75) el.threatText.style.color = '#c93d5d';
      else if (threatNum >= 45) el.threatText.style.color = '#9b7200';
      else el.threatText.style.color = '';
    }

    if (el.scoreText) {
      if (state.score.feverActive) {
        el.scoreText.style.color = '#e5672d';
        el.scoreText.style.textShadow = '0 0 12px rgba(255,160,88,.35)';
      } else {
        el.scoreText.style.color = '';
        el.scoreText.style.textShadow = '';
      }
    }
  }

  function renderMiniMap() {
    const priority = getPriorityZone();
    const showFocus =
      state.sceneId === SCENE_IDS.scan ||
      state.sceneId === SCENE_IDS.guided ||
      state.sceneId === SCENE_IDS.pressure ||
      state.sceneId === SCENE_IDS.intro;

    const introDemoZoneId = getIntroDemoZoneId();

    state.zones.forEach((zone) => {
      const isIntroDemo = state.sceneId === SCENE_IDS.intro && introDemoZoneId === zone.id;
      const isActiveZone = zone.id === state.activeZoneId && state.sceneId !== SCENE_IDS.intro;

      const btn = document.querySelector(`[data-zone="${zone.id}"]`);
      if (btn) {
        btn.textContent = `${zone.label} ${Math.round(zone.cleanPercent)}%`;
        btn.dataset.state = zone.done ? 'done' : (isActiveZone || isIntroDemo) ? 'active' : 'idle';
        btn.classList.toggle('is-priority',
          state.sceneId === SCENE_IDS.pressure &&
          priority &&
          priority.id === zone.id &&
          !zone.done
        );
      }

      const ring = document.querySelector(`[data-ring-zone="${zone.id}"]`);
      if (!ring) return;

      ring.classList.toggle('is-zone-active', (isActiveZone || isIntroDemo) && showFocus);
      ring.classList.toggle('is-zone-done', zone.done);
      ring.classList.toggle('is-scene-focus', showFocus && (isActiveZone || isIntroDemo));
      ring.classList.toggle('is-priority',
        state.sceneId === SCENE_IDS.pressure &&
        priority &&
        priority.id === zone.id &&
        !zone.done
      );

      if (!showFocus) {
        ring.classList.remove('is-zone-active');
      }
    });
  }

  function renderPlaques() {
    clearNode(el.plaqueLayer);

    if (!el.plaqueLayer) return;

    if (!['guided', 'pressure', 'boss'].includes(state.sceneId)) {
      return;
    }

    state.zones.forEach((zone) => {
      if (zone.done || zone.cleanPercent >= 100) return;

      const anchor = getZoneAnchor(zone.id);
      const dirty = Math.max(0, 100 - zone.cleanPercent);
      const count = dirty >= 70 ? 4 : dirty >= 40 ? 3 : dirty > 0 ? 2 : 0;

      for (let i = 0; i < count; i++) {
        const node = document.createElement('div');
        node.className = 'plaque-node';
        if (i === 0 && dirty >= 70) node.classList.add('is-heavy');
        if (i === count - 1 && dirty < 45) node.classList.add('is-gap');
        if (dirty < 30) node.classList.add('is-dim');

        const offset = plaqueOffset(zone.patternType, i);
        node.style.left = `${anchor.x + offset.dx}%`;
        node.style.top = `${anchor.y + offset.dy}%`;
        el.plaqueLayer.appendChild(node);
      }
    });
  }

  function plaqueOffset(patternType, i) {
    const maps = {
      horizontal: [{ dx: -10, dy: 0 }, { dx: 0, dy: -8 }, { dx: 11, dy: 2 }, { dx: 2, dy: 11 }],
      vertical: [{ dx: 0, dy: -10 }, { dx: 0, dy: 6 }, { dx: -8, dy: 16 }, { dx: 10, dy: -18 }],
      circle: [{ dx: -8, dy: -6 }, { dx: 10, dy: -6 }, { dx: 0, dy: 12 }, { dx: -10, dy: 14 }]
    };
    return (maps[patternType] || maps.horizontal)[i] || { dx: 0, dy: 0 };
  }

  function renderScanHud(timerText, foundText) {
    const active = !!(timerText || foundText);
    el.scanCard?.classList.toggle('is-collapsed', !active);
    setText(el.scanTimerText, timerText);
    setText(el.scanFoundText, foundText);
  }

  function renderBossBreakHud(shieldText, timerText, countText) {
    const active = !!(shieldText || timerText || countText);
    el.bossCard?.classList.toggle('is-collapsed', !active);
    setText(el.bossShieldText, shieldText);
    setText(el.bossBreakTimerText, timerText);
    setText(el.bossBreakCountText, countText);
  }

  function renderCoach(face, line) {
    setText(el.coachFace, face);
    setText(el.coachLine, line);

    let mood = 'normal';

    if (['✨', '🪥', '😄', '😊'].includes(face)) mood = 'happy';
    else if (['⚠️', '⏰', '🔎'].includes(face)) mood = 'warning';
    else if (['😵', '🔥'].includes(face)) mood = 'danger';
    else if (['👑', '😠'].includes(face)) mood = 'boss';

    setCoachMood(mood);
  }

  function setObjective(text, sceneId) {
    setText(el.objectiveText, text);

    el.objectiveCard?.classList.remove(
      'is-scan-mode',
      'is-guided-mode',
      'is-pressure-mode',
      'is-boss-mode',
      'is-finish-mode'
    );

    if (sceneId === SCENE_IDS.scan) {
      el.objectiveCard?.classList.add('is-scan-mode');
    } else if (sceneId === SCENE_IDS.guided || sceneId === SCENE_IDS.intro || sceneId === SCENE_IDS.launcher) {
      el.objectiveCard?.classList.add('is-guided-mode');
    } else if (sceneId === SCENE_IDS.pressure || sceneId === SCENE_IDS.fever) {
      el.objectiveCard?.classList.add('is-pressure-mode');
    } else if (sceneId === SCENE_IDS.bossBreak || sceneId === SCENE_IDS.boss) {
      el.objectiveCard?.classList.add('is-boss-mode');
    } else if (sceneId === SCENE_IDS.finish || sceneId === SCENE_IDS.summary) {
      el.objectiveCard?.classList.add('is-finish-mode');
    }
  }

  function renderSceneMood(sceneId) {
    if (!el.sceneStage) return;

    el.sceneStage.dataset.scene = sceneId || '';

    el.scanCard?.classList.remove('is-emphasis');
    el.bossCard?.classList.remove('is-emphasis');
    el.helperCard?.classList.remove('is-warning', 'is-success');

    if (sceneId === SCENE_IDS.scan) {
      el.scanCard?.classList.add('is-emphasis');
    } else if (sceneId === SCENE_IDS.pressure || sceneId === SCENE_IDS.fever) {
      el.helperCard?.classList.add('is-warning');
    } else if (sceneId === SCENE_IDS.bossBreak || sceneId === SCENE_IDS.boss) {
      el.bossCard?.classList.add('is-emphasis');
      el.helperCard?.classList.add('is-warning');
    } else if (sceneId === SCENE_IDS.finish || sceneId === SCENE_IDS.summary) {
      el.helperCard?.classList.add('is-success');
    }
  }

  function syncScenePresentation(sceneId) {
    renderSceneMood(sceneId);
    setObjective(getSceneObjectiveText(sceneId), sceneId);

    const active = isBrushInputScene(sceneId);

    if (el.brushInputLayer) {
      el.brushInputLayer.style.pointerEvents = active ? 'auto' : 'none';
    }

    if (!active) {
      resetBrushInputState();
      hideBrushCursor();
    }

    setCenterUiState(sceneId);
    setBossUiState(sceneId);
    setRingSceneState(sceneId);
    updateCenterTexts(sceneId);
    updateLegendText(sceneId);
    setLegendVisible(
      sceneId === SCENE_IDS.launcher ||
      sceneId === SCENE_IDS.intro ||
      sceneId === SCENE_IDS.scan ||
      sceneId === SCENE_IDS.guided ||
      sceneId === SCENE_IDS.pressure ||
      sceneId === SCENE_IDS.bossBreak ||
      sceneId === SCENE_IDS.boss
    );

    applyMobileDeclutter(sceneId);
    announceStatus(`ตอนนี้อยู่ช่วง ${sceneId}`);

    if (el.helperCard) {
      if (sceneId === SCENE_IDS.launcher) {
        el.helperCard.innerHTML = 'แตะ <strong>เริ่มช่วยฟัน</strong> แล้วทำตามคำแนะนำบนหน้าจอ';
      } else if (sceneId === SCENE_IDS.intro) {
        el.helperCard.innerHTML = 'ดูวงที่เด้งไว้เป็นตัวอย่าง • อีกเดี๋ยวเริ่มจริง';
      } else if (sceneId === SCENE_IDS.scan) {
        el.helperCard.innerHTML = 'แตะ SCAN / BONUS แล้วหลบ TRAP';
      } else if (sceneId === SCENE_IDS.bossBreak) {
        el.helperCard.innerHTML = 'แตะจุดอ่อนให้ครบเพื่อทำลายโล่';
      } else if (active) {
        el.helperCard.innerHTML = 'ลากเพื่อแปรง • เลือกโซนให้ถูกก่อน';
      } else if (sceneId === SCENE_IDS.finish || sceneId === SCENE_IDS.summary) {
        el.helperCard.innerHTML = '';
      } else {
        el.helperCard.innerHTML = 'แตะวงสีขาวเพื่อเลือกโซน';
      }
    }
  }

  function setCenterUiState(sceneId) {
    const mobile = isMobileCompactMode();

    const showTargetBanner =
      sceneId === SCENE_IDS.launcher ||
      sceneId === SCENE_IDS.intro ||
      sceneId === SCENE_IDS.scan ||
      sceneId === SCENE_IDS.guided ||
      sceneId === SCENE_IDS.pressure ||
      sceneId === SCENE_IDS.boss;

    const showInstruction =
      sceneId === SCENE_IDS.launcher ||
      sceneId === SCENE_IDS.intro ||
      sceneId === SCENE_IDS.scan ||
      sceneId === SCENE_IDS.bossBreak;

    const showHelper =
      sceneId === SCENE_IDS.launcher ||
      sceneId === SCENE_IDS.intro ||
      (!mobile && sceneId === SCENE_IDS.scan);

    if (el.targetBanner) {
      el.targetBanner.classList.toggle('center-ui-hidden', !showTargetBanner);
    }

    if (el.sceneInstructionCard) {
      el.sceneInstructionCard.classList.toggle('center-ui-hidden', !showInstruction);
    }

    if (el.helperCard) {
      el.helperCard.classList.toggle('center-ui-hidden', !showHelper);
    }
  }

  function setLegendVisible(visible) {
    if (el.sceneLegendCard) {
      el.sceneLegendCard.classList.toggle('is-hidden', !visible);
    }
  }

  function isMobileCompactMode() {
    return state.ctx.view === 'mobile' || window.matchMedia('(max-width: 720px)').matches;
  }

  function applyMobileDeclutter(sceneId) {
    const mobile = isMobileCompactMode();
    if (!mobile) {
      el.leftHud?.classList.remove('is-mobile-hidden');
      el.coachLayer?.classList.remove('is-mobile-hidden');
      el.helperCard?.classList.remove('is-mobile-hidden');
      el.sceneLegendCard?.classList.remove('is-mobile-hidden');
      el.sceneInstructionCard?.classList.remove('is-mobile-hidden');
      return;
    }

    const showLeftHud =
      sceneId === SCENE_IDS.launcher || sceneId === SCENE_IDS.intro;

    const showCoach =
      sceneId === SCENE_IDS.launcher ||
      sceneId === SCENE_IDS.intro ||
      sceneId === SCENE_IDS.finish ||
      sceneId === SCENE_IDS.summary;

    const showInstruction =
      sceneId === SCENE_IDS.launcher ||
      sceneId === SCENE_IDS.scan ||
      sceneId === SCENE_IDS.bossBreak;

    const showLegend =
      sceneId === SCENE_IDS.launcher ||
      sceneId === SCENE_IDS.scan ||
      sceneId === SCENE_IDS.bossBreak;

    const showHelper =
      sceneId === SCENE_IDS.launcher ||
      sceneId === SCENE_IDS.intro;

    el.leftHud?.classList.toggle('is-mobile-hidden', !showLeftHud);
    el.coachLayer?.classList.toggle('is-mobile-hidden', !showCoach);
    el.sceneInstructionCard?.classList.toggle('is-mobile-hidden', !showInstruction);
    el.sceneLegendCard?.classList.toggle('is-mobile-hidden', !showLegend);
    el.helperCard?.classList.toggle('is-mobile-hidden', !showHelper);
  }

  function updateLegendText(sceneId) {
    if (!el.sceneLegendText) return;

    if (sceneId === SCENE_IDS.launcher || sceneId === SCENE_IDS.intro) {
      el.sceneLegendText.textContent = 'เลือกโซน → ลากแปรง → สแกน → สู้บอส';
    } else if (sceneId === SCENE_IDS.scan) {
      el.sceneLegendText.textContent = 'SCAN = แตะเป้า • BONUS = แตะได้คะแนนเพิ่ม • TRAP = อย่าแตะ';
    } else if (sceneId === SCENE_IDS.guided) {
      el.sceneLegendText.textContent = 'เลือกโซนที่เด้ง แล้วลากแปรงตามท่าที่เกมบอก';
    } else if (sceneId === SCENE_IDS.pressure) {
      el.sceneLegendText.textContent = 'ช่วยโซนเสี่ยงก่อน จะได้คะแนนและลดการลามของคราบ';
    } else if (sceneId === SCENE_IDS.bossBreak) {
      el.sceneLegendText.textContent = 'แตะจุดอ่อนที่กระพริบให้ครบเพื่อทำลายโล่';
    } else if (sceneId === SCENE_IDS.boss) {
      el.sceneLegendText.textContent = 'ลากแปรงต่อเนื่องใส่บอสก่อนหน้าต่างโจมตีหมด';
    } else {
      el.sceneLegendText.textContent = '';
    }
  }

  function setBossUiState(sceneId) {
    const showBoss = sceneId === SCENE_IDS.bossBreak || sceneId === SCENE_IDS.boss;

    if (el.bossVisualLayer) {
      el.bossVisualLayer.style.display = showBoss ? 'block' : 'none';
    }

    if (el.bossWeakPointLayer) {
      el.bossWeakPointLayer.style.display = sceneId === SCENE_IDS.bossBreak ? 'block' : 'none';
    }

    const hp = Math.max(0, Math.min(100, state.boss.hpPercent || 100));
    const bossStage = getBossStage();
    const inBossFight = sceneId === SCENE_IDS.boss;

    if (el.bossShieldVisual) {
      if (sceneId === SCENE_IDS.bossBreak) {
        el.bossShieldVisual.style.opacity = '1';
        el.bossShieldVisual.style.transform = 'translate(-50%,-50%) scale(1)';
        el.bossShieldVisual.style.filter = 'saturate(1)';
      } else if (sceneId === SCENE_IDS.boss) {
        el.bossShieldVisual.style.opacity = hp > 65 ? '.22' : hp > 35 ? '.10' : '.03';
        el.bossShieldVisual.style.transform = hp > 35
          ? 'translate(-50%,-50%) scale(.94)'
          : 'translate(-50%,-50%) scale(.84)';
        el.bossShieldVisual.style.filter = hp > 35 ? 'saturate(.9)' : 'saturate(.45) brightness(1.15)';
      } else {
        el.bossShieldVisual.style.opacity = '0';
      }
    }

    if (el.bossCore) {
      if (showBoss) {
        let hpScale = 1;
        let filter = '';
        let boxShadow = '';

        if (sceneId === SCENE_IDS.bossBreak) {
          hpScale = 1;
          filter = 'saturate(1)';
          boxShadow = '0 0 0 16px rgba(255,120,170,.18), 0 24px 48px rgba(143,16,66,.24)';
        } else {
          if (bossStage.id === 'healthy') {
            hpScale = 0.98 + (hp / 100) * 0.06;
            filter = 'saturate(1) brightness(1)';
            boxShadow = '0 0 0 14px rgba(255,120,170,.16), 0 22px 42px rgba(143,16,66,.22)';
          } else if (bossStage.id === 'angry') {
            hpScale = 0.90 + (hp / 100) * 0.08;
            filter = 'saturate(1.18) brightness(1.05)';
            boxShadow = '0 0 0 18px rgba(255,130,120,.18), 0 0 28px rgba(255,145,112,.24), 0 24px 48px rgba(143,16,66,.26)';
          } else {
            hpScale = 0.84 + (hp / 100) * 0.08;
            filter = 'saturate(1.36) brightness(1.12) drop-shadow(0 0 24px rgba(255,120,145,.32))';
            boxShadow = '0 0 0 20px rgba(255,92,120,.20), 0 0 36px rgba(255,92,120,.30), 0 24px 56px rgba(143,16,66,.30)';
          }
        }

        el.bossCore.style.opacity = '1';
        el.bossCore.style.transform = `translate(-50%,-50%) scale(${hpScale})`;
        el.bossCore.style.filter = filter;
        el.bossCore.style.boxShadow = boxShadow;
      } else {
        el.bossCore.style.opacity = '0';
        el.bossCore.style.filter = '';
        el.bossCore.style.boxShadow = '';
      }
    }

    if (el.bossMouth) {
      if (showBoss) {
        el.bossMouth.style.opacity = '1';

        if (!inBossFight) {
          el.bossMouth.style.transform = 'translate(-50%,-50%) scale(1)';
        } else {
          if (bossStage.id === 'healthy') {
            el.bossMouth.style.transform = 'translate(-50%,-50%) scale(1)';
          } else if (bossStage.id === 'angry') {
            el.bossMouth.style.transform = 'translate(-50%,-50%) scale(1.08)';
          } else {
            el.bossMouth.style.transform = 'translate(-50%,-50%) scale(1.22)';
          }
        }
      } else {
        el.bossMouth.style.opacity = '0';
      }
    }

    document.querySelectorAll('.boss-eye').forEach((eye) => {
      eye.style.opacity = showBoss ? '1' : '0';

      if (!showBoss) {
        eye.style.transform = 'scale(1)';
        eye.style.filter = '';
        return;
      }

      if (sceneId === SCENE_IDS.bossBreak) {
        eye.style.transform = 'scale(1)';
        eye.style.filter = '';
        return;
      }

      if (bossStage.id === 'healthy') {
        eye.style.transform = 'scale(1)';
        eye.style.filter = 'drop-shadow(0 0 8px rgba(255,120,145,.18))';
      } else if (bossStage.id === 'angry') {
        eye.style.transform = 'scale(1.10)';
        eye.style.filter = 'drop-shadow(0 0 12px rgba(255,120,145,.28))';
      } else {
        eye.style.transform = 'scale(1.18)';
        eye.style.filter = 'drop-shadow(0 0 16px rgba(255,120,145,.40))';
      }
    });
  }

  function setRingSceneState(sceneId) {
    const showRings =
      sceneId === SCENE_IDS.launcher ||
      sceneId === SCENE_IDS.intro ||
      sceneId === SCENE_IDS.scan ||
      sceneId === SCENE_IDS.guided ||
      sceneId === SCENE_IDS.pressure;

    const introDemoZoneId = getIntroDemoZoneId();

    document.querySelectorAll('[data-ring-zone]').forEach((ring) => {
      const ringZoneId = ring.getAttribute('data-ring-zone') || '';

      ring.classList.toggle('is-hidden-scene', !showRings);
      ring.style.pointerEvents = showRings ? 'auto' : 'none';

      if (sceneId === SCENE_IDS.intro) {
        ring.classList.toggle('is-zone-active', ringZoneId === introDemoZoneId);
        ring.classList.toggle('is-scene-focus', ringZoneId === introDemoZoneId);
      }
    });
  }

  function updateCenterTexts(sceneId) {
    const zone = state.zones.find((z) => z.id === state.activeZoneId);
    const priority = getPriorityZone();
    const patternLabel = zone ? (PATTERN_LABELS_TH[zone.patternType] || zone.patternType) : '';
    const introDemoZoneId = getIntroDemoZoneId();
    const introDemoZone = state.zones.find((z) => z.id === introDemoZoneId);

    if (el.targetBannerText && el.targetBannerSub) {
      if (sceneId === SCENE_IDS.launcher) {
        const onboard = getOnboardingStepText(sceneId);
        el.targetBannerText.textContent = onboard.title;
        el.targetBannerSub.textContent = onboard.sub;

      } else if (sceneId === SCENE_IDS.intro) {
        el.targetBannerText.textContent = introDemoZone
          ? `ลองดูโซน: ${introDemoZone.label}`
          : 'ดูตัวอย่างเร็ว ๆ';

        el.targetBannerSub.textContent = introDemoZone
          ? `อีกเดี๋ยวจะต้องแปรงโซนแบบนี้`
          : 'วงที่เด้ง = โซนเป้าหมาย';

      } else if (sceneId === SCENE_IDS.scan) {
        const remain = Math.max(0, state.scan.targetGoal - state.scan.hits);
        el.targetBannerText.textContent = `สแกนอีก ${remain} จุด`;
        el.targetBannerSub.textContent = 'แตะ SCAN/BONUS • หลีกเลี่ยง TRAP';

      } else if (sceneId === SCENE_IDS.guided) {
        el.targetBannerText.textContent = zone
          ? `เป้าหมาย: ${zone.label}`
          : 'เลือกโซน';

        el.targetBannerSub.textContent = zone
          ? `แปรงโซนนี้ด้วยท่า ${patternLabel}`
          : 'แตะวงสีขาวเพื่อเลือกโซน';

      } else if (sceneId === SCENE_IDS.pressure) {
        const reason = getPriorityReason(priority);
        const priorityPattern = priority
          ? (PATTERN_LABELS_TH[priority.patternType] || priority.patternType)
          : '';

        el.targetBannerText.textContent = priority
          ? `ด่วน: ${priority.label} (${reason})`
          : 'เลือกโซนด่วน';

        el.targetBannerSub.textContent = priority
          ? `แนะนำให้ช่วยก่อน • ใช้ท่า ${priorityPattern}`
          : 'เลือกโซนที่ควรช่วยก่อน';

      } else if (sceneId === SCENE_IDS.boss) {
        const bossStage = getBossStage();
        el.targetBannerText.textContent = `บอส: ${bossStage.labelTh}`;
        el.targetBannerSub.textContent = `HP ${Math.round(state.boss.hpPercent)}% • โจมตีต่อเนื่องเพื่อลดพลังบอส`;

      } else {
        el.targetBannerText.textContent = 'เลือกโซน';
        el.targetBannerSub.textContent = 'แตะวงสีขาวเพื่อเลือกโซนที่จะแปรง';
      }
    }

    if (el.sceneInstructionText) {
      if (sceneId === SCENE_IDS.launcher) {
        el.sceneInstructionText.textContent = 'เริ่มเกมแล้วจะมี 3 ช่วง: สแกน → แปรง → สู้บอส';
      } else if (sceneId === SCENE_IDS.intro) {
        el.sceneInstructionText.textContent = 'ดูวงที่เด้งไว้เป็นตัวอย่าง • เดี๋ยวจะเริ่มจริง';
      } else if (sceneId === SCENE_IDS.scan) {
        el.sceneInstructionText.textContent = 'แตะเป้าที่เขียนว่า SCAN หรือ BONUS • อย่าแตะ TRAP';
      } else if (sceneId === SCENE_IDS.bossBreak) {
        el.sceneInstructionText.textContent = 'แตะจุดอ่อนที่กระพริบให้ครบเพื่อทำลายโล่';
      } else {
        el.sceneInstructionText.textContent = '';
      }
    }
  }

  function getSceneObjectiveText(sceneId) {
    switch (sceneId) {
      case SCENE_IDS.launcher: return `พร้อมเริ่มภารกิจ ${state.ctx.modeLabel || 'Adventure'}`;
      case SCENE_IDS.intro: return 'ดูตัวอย่างการเลือกโซน';
      case SCENE_IDS.scan: return 'หาเป้าสแกนอันตรายให้ครบ';
      case SCENE_IDS.guided: return 'เลือกโซนและแปรงตามทิศที่โค้ชแนะนำ';
      case SCENE_IDS.pressure: return 'ช่วยโซนเสี่ยงก่อนคราบจะลุกลาม';
      case SCENE_IDS.bossBreak: return 'ทำลายโล่บอสด้วยการโจมตีจุดอ่อน';
      case SCENE_IDS.boss: return 'รีบแปรงโจมตีบอสก่อนมันฟื้นตัว';
      case SCENE_IDS.finish: return 'ภารกิจเสร็จแล้ว เตรียมดูผลลัพธ์';
      case SCENE_IDS.summary: return 'สรุปผลการช่วยฟันของรอบนี้';
      default: return 'เตรียมภารกิจกู้ฟัน';
    }
  }

  function renderLauncher() {
    closeSummary();
    clearRuntimeVisuals();
    resetCoachVisualState();
    resetCenterCards();
    resetHudCards();

    setCenterUiState(SCENE_IDS.launcher);
    setBossUiState(SCENE_IDS.launcher);
    setRingSceneState(SCENE_IDS.launcher);
    updateCenterTexts(SCENE_IDS.launcher);
    updateLegendText(SCENE_IDS.launcher);
    setLegendVisible(true);

    renderCoach('🪥', 'พร้อมหรือยัง? เดี๋ยวเราจะช่วยฟันให้สะอาดกัน');
    setObjective(`พร้อมเริ่มภารกิจ ${state.ctx.modeLabel || 'Adventure'}`, SCENE_IDS.launcher);
    renderSceneMood(SCENE_IDS.launcher);

    if (el.btnStart) {
      el.btnStart.textContent = '▶ เริ่มช่วยฟัน';
    }

    applyMobileDeclutter(SCENE_IDS.launcher);
    announceStatus('พร้อมเริ่มเกม');
  }

  function finishGame() {
    state.running = false;
    resetBrushInputState();
    hideBrushCursor();

    const result = buildResult();
    saveResult(result);
    logger.finish(result);
    logger.flush();

    setObjective('สรุปผลการช่วยฟันของรอบนี้', SCENE_IDS.summary);
    renderSceneMood(SCENE_IDS.summary);
    setCenterUiState(SCENE_IDS.summary);
    setBossUiState(SCENE_IDS.summary);
    setRingSceneState(SCENE_IDS.summary);
    setLegendVisible(false);

    renderCoach('✨', 'ภารกิจเสร็จแล้ว มาดูผลลัพธ์กัน');

    setText(el.summaryRank, result.finalRank);
    setText(el.summaryScore, result.finalScore);
    setText(el.summaryCoverage, `${result.coveragePercent}%`);
    setText(el.summaryAccuracy, `${result.accuracyPercent}%`);
    setText(el.summaryAdvice, result.summaryAdvice);

    const summaryTitle = el.summaryModal?.querySelector('.summary-title');
    const summarySub = el.summaryModal?.querySelector('.summary-sub');

    if (summaryTitle) {
      summaryTitle.textContent = `ภารกิจสำเร็จ • Rank ${result.finalRank}`;
    }

    if (summarySub) {
      summarySub.textContent = state.boss.cleared
        ? 'คุณช่วยทั้งปากและปราบบอสได้สำเร็จ'
        : 'คุณช่วยทั้งปากได้ดีมาก และเกือบปราบบอสสำเร็จ';
    }

    renderSummaryStars(result);
    renderSummaryLiveNote(result);
    ensureSummaryExtras(result);

    flashScene('clear');
    spawnFinishSparkles(state.boss.cleared ? 24 : 14);

    if (el.summaryModal) {
      el.summaryModal.hidden = false;
    }

    spawnVictoryConfetti(state.boss.cleared ? 42 : 28);
    showBigPopup(50, 18, state.boss.cleared ? 'ชนะแล้ว!' : 'ภารกิจเสร็จ!', 'clear');
    sfx.clear();

    console.log('Brush finish layer counts:', debugLayerCounts());
  }

  function buildResult() {
    const hits = state.metrics.hits;
    const misses = state.metrics.misses;
    const attempts = hits + misses;
    const coveragePercent = Math.round(state.zones.reduce((a, z) => a + z.cleanPercent, 0) / state.zones.length);
    const accuracyPercent = attempts ? Math.round((hits / attempts) * 100) : 0;
    const safeZones = getSafeZoneCount();
    const bestZone = getBestZone();
    const worstZone = getWorstZone();

    let finalRank = 'C';
    if (coveragePercent >= 90 && accuracyPercent >= 85) finalRank = 'S';
    else if (coveragePercent >= 80 && accuracyPercent >= 75) finalRank = 'A';
    else if (coveragePercent >= 65 && accuracyPercent >= 60) finalRank = 'B';

    let summaryAdvice = 'ลองเล่นอีกครั้งเพื่อเก็บทุกโซนให้สมบูรณ์ขึ้น';
    if (coveragePercent >= 90 && accuracyPercent >= 85) {
      summaryAdvice = `ยอดเยี่ยมมาก แปรงได้ทั่วทั้งปากและแม่นยำสุด ๆ • โซนปลอดภัย ${safeZones}/6`;
    } else if (coveragePercent >= 80 && accuracyPercent >= 70) {
      summaryAdvice = `ดีมากแล้ว เหลือเพิ่มความแม่นของท่าแปรงอีกนิด • โซนปลอดภัย ${safeZones}/6`;
    } else if (coveragePercent >= 60) {
      summaryAdvice = `รอบหน้าลองช่วยโซนเสี่ยงก่อนเมื่อเกมเตือน • โซนปลอดภัย ${safeZones}/6`;
    } else {
      summaryAdvice = `เริ่มได้ดีแล้ว ลองเลือกโซนให้เร็วและตามคำแนะนำกลางจอ • โซนปลอดภัย ${safeZones}/6`;
    }

    if (state.boss.cleared) {
      summaryAdvice += ' • คุณปราบบอสสำเร็จ';
    } else {
      summaryAdvice += ` • พลังบอสคงเหลือ ${Math.round(state.boss.hpPercent || 0)}%`;
    }

    return {
      sessionId: logger.sessionId,
      finalRank,
      rankLabelThai: getRankLabelThai(finalRank),
      finalScore: Math.round(state.score.total),
      coveragePercent,
      accuracyPercent,
      summaryAdvice,
      bestZoneLabel: bestZone ? bestZone.label : '-',
      bestZoneText: bestZone
        ? `ความสะอาด ${Math.round(bestZone.cleanPercent || 0)}% • ความเสี่ยง ${Math.round(bestZone.threatPercent || 0)}%`
        : '-',
      worstZoneLabel: worstZone ? worstZone.label : '-',
      worstZoneText: worstZone
        ? `ความสะอาด ${Math.round(worstZone.cleanPercent || 0)}% • ความเสี่ยง ${Math.round(worstZone.threatPercent || 0)}%`
        : '-'
    };
  }

  function saveResult(result) {
    try {
      localStorage.setItem('HHA_BRUSH_LAST_RESULT', JSON.stringify(result));
      const rows = JSON.parse(localStorage.getItem('HHA_BRUSH_CSV_ROWS') || '[]');
      rows.push({
        sessionId: result.sessionId,
        finalRank: result.finalRank,
        finalScore: result.finalScore,
        coveragePercent: result.coveragePercent,
        accuracyPercent: result.accuracyPercent,
        bestZoneLabel: result.bestZoneLabel,
        worstZoneLabel: result.worstZoneLabel
      });
      localStorage.setItem('HHA_BRUSH_CSV_ROWS', JSON.stringify(rows));
    } catch {}
  }

  function resetRunState() {
    state.running = false;
    state.paused = false;
    state.sceneId = SCENE_IDS.launcher;
    state.sceneEnteredAtMs = 0;

    state.time.startedAtIso = '';
    state.time.lastTs = 0;
    state.time.elapsedMs = 0;
    state.time.durationPlannedSec = mode.durationSec;
    state.time.remainingSec = mode.durationSec;

    state.score.total = 0;
    state.score.combo = 0;
    state.score.comboMax = 0;
    state.score.feverActive = false;
    state.score.feverEndAtMs = 0;

    state.threat.percent = 0;

    state.zones.forEach((z) => {
      z.cleanPercent = 0;
      z.threatPercent = 25;
      z.visited = false;
      z.done = false;
      z.hits = 0;
      z.misses = 0;
      z.dwellMs = 0;
      delete z.completedAtMs;
    });

    state.activeZoneId = 'upper-front';

    state.brushInput.active = false;
    state.brushInput.pointerId = null;
    state.brushInput.lastX = 0;
    state.brushInput.lastY = 0;
    state.brushInput.lastHitAtMs = 0;

    state.metrics.hits = 0;
    state.metrics.misses = 0;
    state.metrics.warnings = 0;

    state.scan.played = false;
    state.scan.active = false;
    state.scan.roundId = '';
    state.scan.startedAtMs = 0;
    state.scan.durationSec = 0;
    state.scan.targetGoal = 0;
    state.scan.hits = 0;
    state.scan.misses = 0;
    state.scan.specialHits = 0;
    state.scan.targets = [];
    state.scan.picked = new Set();
    state.scan.accuracyPercent = 0;
    state.scan.completedGoal = false;

    state.bossBreak.played = false;
    state.bossBreak.active = false;
    state.bossBreak.roundId = '';
    state.bossBreak.startedAtMs = 0;
    state.bossBreak.durationSec = 0;
    state.bossBreak.targetGoal = 4;
    state.bossBreak.hits = 0;
    state.bossBreak.misses = 0;
    state.bossBreak.accuracyPercent = 0;
    state.bossBreak.success = false;
    state.bossBreak.damageWindowMs = 0;

    state.boss.active = false;
    state.boss.hpPercent = 100;
    state.boss.cleared = false;
    state.boss.damageWindowEndAtMs = 0;

    resetBrushInputState();
    hideBrushCursor();
    clearRuntimeVisuals();
    resetBossWeakpoints();
    resetCoachVisualState();
    resetCenterCards();
    resetHudCards();
    resetSummaryVisuals();
  }

  function clearRuntimeVisuals() {
    clearNode(el.fxLayer);
    clearNode(el.scorePopupLayer);
    clearNode(el.scanTargetLayer);
    clearNode(el.plaqueLayer);

    document.querySelectorAll('[data-boss-weakpoint]').forEach((btn) => {
      btn.classList.remove('is-hit');
      btn.disabled = false;
    });

    document.querySelectorAll('.victory-confetti').forEach((n) => n.remove());
    document.querySelectorAll('.finish-sparkle').forEach((n) => n.remove());

    const flash = document.getElementById('scenePhaseFlash');
    if (flash) {
      flash.className = 'scene-phase-flash';
    }
  }

  function resetCoachVisualState() {
    setCoachMood('normal');
    if (el.coachFace) el.coachFace.textContent = '🪥';
    if (el.coachLine) el.coachLine.textContent = 'พร้อมช่วยฟันแล้ว กดเริ่มได้เลย';
  }

  function resetCenterCards() {
    if (el.targetBannerText) el.targetBannerText.textContent = 'เริ่มช่วยฟัน';
    if (el.targetBannerSub) el.targetBannerSub.textContent = '1) แตะวง • 2) ลากแปรง • 3) ชนะบอส';

    if (el.sceneInstructionText) {
      el.sceneInstructionText.textContent = 'เริ่มเกมแล้วจะมี 3 ช่วง: สแกน → แปรง → สู้บอส';
    }

    if (el.sceneLegendText) {
      el.sceneLegendText.textContent = 'SCAN = แตะเป้า • BONUS = แตะได้คะแนนเพิ่ม • TRAP = อย่าแตะ';
    }

    if (el.helperCard) {
      el.helperCard.innerHTML = 'แตะ <strong>เริ่มช่วยฟัน</strong> แล้วทำตามคำแนะนำบนหน้าจอ';
    }
  }

  function resetHudCards() {
    el.objectiveCard?.classList.remove(
      'is-scan-mode',
      'is-guided-mode',
      'is-pressure-mode',
      'is-boss-mode',
      'is-finish-mode'
    );
    el.scanCard?.classList.remove('is-emphasis');
    el.bossCard?.classList.remove('is-emphasis');
    el.scanCard?.classList.add('is-collapsed');
    el.bossCard?.classList.add('is-collapsed');

    if (el.timeText) el.timeText.textContent = `${mode.durationSec}s`;
    if (el.scoreText) el.scoreText.textContent = '0';
    if (el.comboText) el.comboText.textContent = '0';
    if (el.threatText) el.threatText.textContent = '0%';
    if (el.sceneText) el.sceneText.textContent = 'launcher';

    if (el.scanTimerText) el.scanTimerText.textContent = '';
    if (el.scanFoundText) el.scanFoundText.textContent = '';
    if (el.bossShieldText) el.bossShieldText.textContent = '';
    if (el.bossBreakTimerText) el.bossBreakTimerText.textContent = '';
    if (el.bossBreakCountText) el.bossBreakCountText.textContent = '';
  }

  function resetSummaryVisuals() {
    const summaryTitle = el.summaryModal?.querySelector('.summary-title');
    const summarySub = el.summaryModal?.querySelector('.summary-sub');

    if (summaryTitle) summaryTitle.textContent = 'Brush V5 Summary';
    if (summarySub) summarySub.textContent = 'สรุปผลรอบนี้หลังช่วยทั้งปากเสร็จ';

    if (el.summaryRank) el.summaryRank.textContent = '-';
    if (el.summaryScore) el.summaryScore.textContent = '0';
    if (el.summaryCoverage) el.summaryCoverage.textContent = '0%';
    if (el.summaryAccuracy) el.summaryAccuracy.textContent = '0%';
    if (el.summaryAdvice) el.summaryAdvice.textContent = 'ลองเล่นอีกรอบเพื่อดูความต่างของผลลัพธ์';
    if (el.summaryLiveNote) el.summaryLiveNote.textContent = 'รอสรุปผลรอบนี้';
    if (el.summaryStars) el.summaryStars.innerHTML = '';

    const rankHero = document.getElementById('summaryRankHero');
    if (rankHero) rankHero.remove();

    const extraGrid = document.getElementById('summaryExtraGrid');
    if (extraGrid) extraGrid.remove();
  }

  function closeSummary() {
    if (el.summaryModal) {
      el.summaryModal.hidden = true;
    }

    document.querySelectorAll('.victory-confetti').forEach((n) => n.remove());
    document.querySelectorAll('.finish-sparkle').forEach((n) => n.remove());

    const flash = document.getElementById('scenePhaseFlash');
    if (flash) {
      flash.className = 'scene-phase-flash';
    }
  }

  function debugLayerCounts() {
    return {
      fx: el.fxLayer?.children?.length || 0,
      popup: el.scorePopupLayer?.children?.length || 0,
      scan: el.scanTargetLayer?.children?.length || 0,
      plaque: el.plaqueLayer?.children?.length || 0,
      bossWeak: el.bossWeakPointLayer?.querySelectorAll?.('.is-hit')?.length || 0
    };
  }

  function announceStatus(text) {
    if (el.srLiveStatus) {
      el.srLiveStatus.textContent = text;
    }
  }

  function getBalanceProfile() {
    return state.ctx.view === 'mobile' ? BALANCE_RULES.mobile : BALANCE_RULES.desktop;
  }

  function getScanDurationSec() {
    const p = getBalanceProfile();
    return Math.max(3, mode.scanSec + p.scanSecOffset);
  }

  function getGuidedDurationMs() {
    return getBalanceProfile().guidedMs;
  }

  function getPressureDurationMs() {
    return getBalanceProfile().pressureMs;
  }

  function getBossBreakDurationSec() {
    const p = getBalanceProfile();
    return Math.max(4, mode.bossBreakSec + p.bossBreakSecOffset);
  }

  function getFeverComboThreshold() {
    return getBalanceProfile().feverComboThreshold;
  }

  function getBossDamageWindowMs() {
    const base = state.bossBreak.success ? 6000 : 2500;
    const p = getBalanceProfile();

    let bonus = 0;
    if ((state.bossBreak.accuracyPercent || 0) >= 75) bonus += 1000;
    if ((state.scan.accuracyPercent || 0) >= 75) bonus += 600;

    return base + p.bossWindowBonusMs + bonus;
  }

  function getPriorityZone() {
    const candidates = state.zones
      .filter((z) => !z.done)
      .slice()
      .sort((a, b) => {
        const threatDiff = (b.threatPercent || 0) - (a.threatPercent || 0);
        if (Math.abs(threatDiff) > 0.01) return threatDiff;
        return (a.cleanPercent || 0) - (b.cleanPercent || 0);
      });

    return candidates[0] || null;
  }

  function getPriorityReason(zone) {
    if (!zone) return '';
    const threat = Math.round(zone.threatPercent || 0);

    if (threat >= 85) return 'วิกฤต';
    if (threat >= 65) return 'เสี่ยงสูง';
    if (threat >= 45) return 'ควรรีบช่วย';
    return 'กำลังเสี่ยง';
  }

  function getPressureBonusForZone(zoneId) {
    if (state.sceneId !== SCENE_IDS.pressure) return 1;

    const priority = getPriorityZone();
    if (!priority) return 1;

    return priority.id === zoneId ? 1.35 : 1;
  }

  function getSafeZoneCount() {
    return state.zones.filter((z) => (z.threatPercent || 0) < 40).length;
  }

  function getBossStage() {
    return getBossStageFromHp(state.boss.hpPercent || 100);
  }

  function getBossStageFromHp(hpValue) {
    const hp = Math.max(0, Math.min(100, hpValue || 100));

    if (hp > 66) return { id: 'healthy', labelTh: 'ปกติ', labelEn: 'HEALTHY', color: 'normal' };
    if (hp > 33) return { id: 'angry', labelTh: 'โกรธ', labelEn: 'ANGRY', color: 'warning' };
    return { id: 'rage', labelTh: 'คลั่ง', labelEn: 'RAGE', color: 'danger' };
  }

  function maybeAnnounceBossStageChange(prevHp, nextHp) {
    const prevStage = getBossStageFromHp(prevHp);
    const nextStage = getBossStageFromHp(nextHp);

    if (prevStage.id !== nextStage.id) {
      if (nextStage.id === 'angry') {
        showBigPopup(50, 24, 'บอสเริ่มโกรธ!', 'boss');
        renderCoach('😠', 'บอสเริ่มโกรธแล้ว รีบโจมตีต่อ');
      } else if (nextStage.id === 'rage') {
        showBigPopup(50, 24, 'บอสคลั่ง!', 'boss');
        renderCoach('🔥', 'ระวัง! บอสเข้าสู่ช่วงคลั่งแล้ว');
        state.threat.percent = clamp(state.threat.percent + 10, 0, 100);
      }
    }
  }

  function getBestZone() {
    return state.zones
      .slice()
      .sort((a, b) => {
        const cleanDiff = (b.cleanPercent || 0) - (a.cleanPercent || 0);
        if (Math.abs(cleanDiff) > 0.01) return cleanDiff;
        return (a.threatPercent || 0) - (b.threatPercent || 0);
      })[0] || null;
  }

  function getWorstZone() {
    return state.zones
      .slice()
      .sort((a, b) => {
        const cleanDiff = (a.cleanPercent || 0) - (b.cleanPercent || 0);
        if (Math.abs(cleanDiff) > 0.01) return cleanDiff;
        return (b.threatPercent || 0) - (a.threatPercent || 0);
      })[0] || null;
  }

  function getRankLabelThai(rank) {
    if (rank === 'S') return 'สุดยอดแชมป์ฟันสะอาด';
    if (rank === 'A') return 'ยอดเยี่ยมมาก';
    if (rank === 'B') return 'ดีมาก';
    return 'พยายามอีกนิด';
  }

  function getIntroDemoZoneId() {
    if (state.sceneId !== SCENE_IDS.intro) return null;

    const elapsed = performance.now() - state.sceneEnteredAtMs;
    const cycle = Math.floor(elapsed / 650) % 3;
    const ids = ['upper-front', 'lower-front', 'upper-left'];
    return ids[cycle] || 'upper-front';
  }

  function getOnboardingStepText(sceneId) {
    if (sceneId === SCENE_IDS.launcher) {
      return {
        title: 'เริ่มช่วยฟัน',
        sub: '1) แตะวง • 2) ลากแปรง • 3) ชนะบอส'
      };
    }

    if (sceneId === SCENE_IDS.intro) {
      return {
        title: 'ดูตัวอย่างเร็ว ๆ',
        sub: 'วงที่เด้ง = โซนเป้าหมาย • อีกเดี๋ยวจะเริ่มสแกน'
      };
    }

    return {
      title: '',
      sub: ''
    };
  }

  function spawnVictoryConfetti(count = 36) {
    const colors = ['#72d7ff', '#ffb8d9', '#ffe07f', '#8eecc0', '#ff8fa1', '#caa8ff'];
    const shapes = ['shape-rect', 'shape-pill', 'shape-dot'];

    for (let i = 0; i < count; i++) {
      const piece = document.createElement('div');
      piece.className = `victory-confetti ${shapes[i % shapes.length]}`;
      piece.style.left = `${Math.random() * 100}vw`;
      piece.style.background = colors[i % colors.length];
      piece.style.setProperty('--dx', `${(Math.random() - 0.5) * 180}px`);
      piece.style.setProperty('--rot', `${240 + Math.random() * 520}deg`);
      piece.style.animationDuration = `${2.6 + Math.random() * 1.2}s`;
      piece.style.animationDelay = `${Math.random() * 0.25}s`;
      document.body.appendChild(piece);
      setTimeout(() => piece.remove(), 4200);
    }
  }

  function ensureSceneFlashLayer() {
    let node = document.getElementById('scenePhaseFlash');
    if (!node) {
      node = document.createElement('div');
      node.id = 'scenePhaseFlash';
      node.className = 'scene-phase-flash';
      document.body.appendChild(node);
    }
    return node;
  }

  function flashScene(kind = 'scan') {
    const node = ensureSceneFlashLayer();
    node.className = `scene-phase-flash kind-${kind} is-show`;
    setTimeout(() => {
      node.className = 'scene-phase-flash';
    }, 460);
  }

  function spawnFinishSparkles(count = 18) {
    if (!el.fxLayer) return;

    for (let i = 0; i < count; i++) {
      const s = document.createElement('div');
      s.className = 'finish-sparkle';
      s.style.left = `${12 + Math.random() * 76}%`;
      s.style.top = `${18 + Math.random() * 58}%`;
      s.style.animationDelay = `${Math.random() * 0.25}s`;
      el.fxLayer.appendChild(s);
      setTimeout(() => s.remove(), 1600);
    }
  }

  function setCoachMood(mood = 'normal') {
    const card = el.coachFace?.closest('.coach-card');
    const face = el.coachFace;

    if (!card || !face) return;

    card.classList.remove('mood-happy', 'mood-warning', 'mood-danger', 'mood-boss');
    face.classList.remove('mood-happy', 'mood-warning', 'mood-danger', 'mood-boss');

    if (mood !== 'normal') {
      card.classList.add(`mood-${mood}`);
      face.classList.add(`mood-${mood}`);
    }
  }

  function renderSummaryStars(result) {
    if (!el.summaryStars) return;

    let onCount = 1;
    if (result.finalRank === 'S') onCount = 5;
    else if (result.finalRank === 'A') onCount = 4;
    else if (result.finalRank === 'B') onCount = 3;
    else onCount = 2;

    el.summaryStars.innerHTML = Array.from({ length: 5 }, (_, i) => {
      return `<span class="summary-star ${i < onCount ? 'is-on' : ''}">⭐</span>`;
    }).join('');
  }

  function renderSummaryLiveNote(result) {
    if (!el.summaryLiveNote) return;

    const zoneText = result.bestZoneLabel && result.worstZoneLabel
      ? `เด่นสุด: ${result.bestZoneLabel} • ควรฝึกเพิ่ม: ${result.worstZoneLabel}`
      : 'ลองเล่นอีกครั้งเพื่อเก็บทุกโซนให้ครบ';

    el.summaryLiveNote.textContent = zoneText;
  }

  function ensureSummaryExtras(result) {
    if (!el.summaryModal) return;

    let rankHero = el.summaryModal.querySelector('#summaryRankHero');
    if (!rankHero) {
      rankHero = document.createElement('div');
      rankHero.id = 'summaryRankHero';
      rankHero.className = 'summary-rank-hero';

      const summaryGrid = el.summaryModal.querySelector('.summary-grid');
      if (summaryGrid && summaryGrid.parentNode) {
        summaryGrid.parentNode.insertBefore(rankHero, summaryGrid);
      }
    }

    rankHero.innerHTML = `
      <div>
        <div class="rank-big">${result.finalRank}</div>
        <div class="rank-sub">${result.rankLabelThai}</div>
      </div>
    `;

    let extraGrid = el.summaryModal.querySelector('#summaryExtraGrid');
    if (!extraGrid) {
      extraGrid = document.createElement('div');
      extraGrid.id = 'summaryExtraGrid';
      extraGrid.className = 'summary-extra-grid';

      const adviceCard = document.getElementById('summaryAdvice')?.closest('.bottom-card');
      if (adviceCard && adviceCard.parentNode) {
        adviceCard.parentNode.insertBefore(extraGrid, adviceCard);
      }
    }

    extraGrid.innerHTML = `
      <div class="summary-extra-card is-best">
        <strong>โซนที่ดีที่สุด</strong>
        <div class="main">${result.bestZoneLabel}</div>
        <div class="sub">${result.bestZoneText}</div>
      </div>
      <div class="summary-extra-card is-worst">
        <strong>โซนที่ควรพัฒนา</strong>
        <div class="main">${result.worstZoneLabel}</div>
        <div class="sub">${result.worstZoneText}</div>
      </div>
    `;
  }

  function showPopup(x, y, text, kind = 'good') {
    if (!el.scorePopupLayer) return;
    const node = document.createElement('div');
    node.className = `score-popup is-${kind}`;
    node.textContent = text;
    node.style.left = `${x}%`;
    node.style.top = `${y}%`;
    el.scorePopupLayer.appendChild(node);
    setTimeout(() => node.remove(), 760);
  }

  function showBigPopup(x, y, text, kind = 'good') {
    showPopup(x, y, text, kind);
    setTimeout(() => showPopup(x, y - 3, text, kind), 40);
    setTimeout(() => showPopup(x, y - 6, text, kind), 85);
  }

  function playFx(x, y, kind = 'hit') {
    if (!el.fxLayer) return;
    const node = document.createElement('div');
    node.className = 'fx-burst';
    if (kind === 'miss') node.classList.add('is-miss');
    if (kind === 'complete') node.classList.add('is-complete');
    node.style.left = `${x}%`;
    node.style.top = `${y}%`;
    el.fxLayer.appendChild(node);
    setTimeout(() => node.remove(), 380);
  }

  function getZoneAnchor(zoneId) {
    const map = {
      'upper-left': { x: 24, y: 35 },
      'upper-front': { x: 50, y: 27 },
      'upper-right': { x: 76, y: 35 },
      'lower-left': { x: 24, y: 63 },
      'lower-front': { x: 50, y: 72 },
      'lower-right': { x: 76, y: 63 }
    };
    return map[zoneId] || { x: 50, y: 50 };
  }

  function elementCenterPercent(node) {
    const rect = node.getBoundingClientRect();
    const x = ((rect.left + rect.width / 2) / window.innerWidth) * 100;
    const y = ((rect.top + rect.height / 2) / window.innerHeight) * 100;
    return { x, y };
  }

  function parsePercent(value) {
    return Number(String(value).replace('%', '').trim()) || 0;
  }

  function setText(node, value) {
    if (node) node.textContent = String(value ?? '');
  }

  function clearNode(node) {
    if (node) node.innerHTML = '';
  }

  function randomPick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }
})();