(function () {
  'use strict';

  try {
    const q = new URLSearchParams(location.search);
    const mount =
      document.getElementById('gameMount') ||
      document.getElementById('goodjunkGameMount') ||
      document.getElementById('app') ||
      document.body;

    const ctx = window.__GJ_RUN_CTX__ || {
      pid: q.get('pid') || 'anon',
      name: q.get('name') || '',
      studyId: q.get('studyId') || '',
      diff: q.get('diff') || 'normal',
      time: q.get('time') || '150',
      seed: q.get('seed') || String(Date.now()),
      hub: q.get('hub') || new URL('./hub-v2.html', location.href).toString(),
      view: q.get('view') || 'mobile',
      run: q.get('run') || 'play',
      gameId: q.get('gameId') || 'goodjunk'
    };

    const DEBUG = q.get('debug') === '1';

    const ROOT_ID = 'gjSoloBossRootClean';
    const STYLE_ID = 'gjSoloBossStyleClean';
    const LAST_SUMMARY_KEY = 'HHA_LAST_SUMMARY';
    const SUMMARY_HISTORY_KEY = 'HHA_SUMMARY_HISTORY';
    const RESEARCH_LAST_KEY = 'HHA_GJ_BOSS_RESEARCH_LAST';
    const RESEARCH_HISTORY_KEY = 'HHA_GJ_BOSS_RESEARCH_HISTORY';

    const GOOD = ['🍎', '🥕', '🥦', '🍌', '🥛', '🥗', '🍉', '🐟'];
    const JUNK = ['🍟', '🍩', '🍭', '🍔', '🥤', '🍕', '🧁', '🍫'];

    const DIFF = {
      easy: {
        p1Goal: 70,
        p2Goal: 170,
        spawn1: 940,
        spawn2: 790,
        bossHp: 16,
        scoreGood: 12,
        penaltyJunk: 7,
        penaltyFake: 5
      },
      normal: {
        p1Goal: 90,
        p2Goal: 220,
        spawn1: 760,
        spawn2: 620,
        bossHp: 22,
        scoreGood: 10,
        penaltyJunk: 8,
        penaltyFake: 6
      },
      hard: {
        p1Goal: 110,
        p2Goal: 260,
        spawn1: 620,
        spawn2: 500,
        bossHp: 28,
        scoreGood: 9,
        penaltyJunk: 9,
        penaltyFake: 7
      }
    };

    const diffKey = DIFF[ctx.diff] ? ctx.diff : 'normal';
    const cfg = DIFF[diffKey];

    const state = {
      running: false,
      ended: false,
      paused: false,
      muted: false,
      pauseReason: '',
      score: 0,
      miss: 0,
      streak: 0,
      bestStreak: 0,
      hitsGood: 0,
      hitsBad: 0,
      goodMissed: 0,
      powerHits: 0,
      stormHits: 0,
      spawnedStorm: 0,
      phase: 1,
      timeTotal: Math.max(90, Number(ctx.time || 150)) * 1000,
      timeLeft: Math.max(90, Number(ctx.time || 150)) * 1000,
      lastTs: 0,
      spawnAcc: 0,
      seq: 0,
      raf: 0,
      praiseMs: 0,
      hudAwakeMs: 1800,
      presentationLockMs: 0,
      items: new Map(),
      lastTelegraphAt: 0,
      a11y: {
        reducedMotion: false,
        highContrastTelegraph: false
      },
      metrics: {
        runStartAt: Date.now(),
        bossEnterAt: 0,
        bossEndAt: 0,
        telegraphShown: 0,
        telegraphByPattern: { hunt: 0, break: 0, storm: 0 },
        telegraphReactMs: [],
        patternStarts: { hunt: 0, break: 0, storm: 0 },
        weakHitsByStage: { A: 0, B: 0, C: 0, RAGE: 0 },
        weakHitsByPattern: { hunt: 0, break: 0, storm: 0 },
        fakeWeakTapped: 0,
        stormDodgedApprox: 0,
        stormSpawned: 0,
        rageEntered: false,
        rageAtHp: 0,
        bossDurationMs: 0,
        clearTimeMs: 0
      },
      research: {
        sessionId: 'gjsb-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
        events: [],
        splits: {
          phase1StartAt: 0,
          phase2StartAt: 0,
          bossStartAt: 0,
          rageStartAt: 0,
          endAt: 0
        },
        counters: {
          goodTap: 0,
          junkTap: 0,
          fakeTap: 0,
          weakTap: 0,
          stormHit: 0,
          goodMiss: 0
        }
      },
      runtime: {
        timers: new Set(),
        mounted: false,
        started: false,
        destroyed: false
      },
      boss: {
        active: false,
        hp: 0,
        maxHp: 0,
        stage: 'A',
        stageReached: 'A',
        pattern: 'hunt',
        patternTimeLeft: 0,
        patternCycleIndex: -1,
        weakId: '',
        fakeWeakActive: false,
        fakeWeakDecoyId: '',
        telegraphOn: false,
        telegraphText: '',
        telegraphMs: 0,
        stormBurstLeft: 0,
        stormBurstGapMs: 0,
        stormWaveCooldown: 0,
        weakRetargetMs: 0,
        weakRetargetAcc: 0,
        rage: false,
        rageTriggered: false,
        rageEnterMs: 0,
        killSequence: false,
        introShowing: false,
        lowHpTier: 0
      }
    };

    let ui = null;

    /* วาง functions เดิมทั้งหมดต่อจากตรงนี้ได้เลย */
    /* injectStyle(), buildUI(), bindButtons(), update(), loop(), start() ... */

    if (!window.__GJSB_PHASEBOSS_BOOTED__) {
      window.__GJSB_PHASEBOSS_BOOTED__ = true;

      injectStyle();
      ui = buildUI();
      bindButtons();
      layoutInnerHud();
      start();
    }
  } catch (err) {
    const msg =
      err && (err.stack || err.message)
        ? String(err.stack || err.message)
        : 'unknown boot error';

    window.__GJ_BOOT_FAIL__ = msg;

    try { console.error('[GJSB BOOT ERROR]', err); } catch (_) {}

    if (window.__GJ_SHOW_BOOT_ERROR__) {
      window.__GJ_SHOW_BOOT_ERROR__(msg);
    }
  }
})();