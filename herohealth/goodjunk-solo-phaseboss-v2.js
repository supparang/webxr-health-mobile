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
      name: q.get('name') || q.get('nickName') || 'Hero',
      studyId: q.get('studyId') || '',
      diff: q.get('diff') || 'normal',
      time: q.get('time') || '150',
      seed: q.get('seed') || String(Date.now()),
      hub: q.get('hub') || new URL('./hub-v2.html', location.href).toString(),
      view: q.get('view') || 'mobile',
      run: q.get('run') || 'play',
      gameId: q.get('gameId') || 'goodjunk',
      zone: q.get('zone') || 'nutrition'
    };

    const DEBUG = q.get('debug') === '1';

    const ROOT_ID = 'gjSoloBossRootClean';
    const STYLE_ID = 'gjSoloBossStyleFullFinal';

    const LAST_SUMMARY_KEY = 'HHA_LAST_SUMMARY';
    const SUMMARY_HISTORY_KEY = 'HHA_SUMMARY_HISTORY';
    const RESEARCH_LAST_KEY = 'HHA_GJ_BOSS_RESEARCH_LAST';
    const RESEARCH_HISTORY_KEY = 'HHA_GJ_BOSS_RESEARCH_HISTORY';
    const GJ_REMATCH_KEY = 'HHA_GJ_BOSS_REMATCH_STATE';
    const GJ_DAILY_HINT_KEY = 'HHA_GJ_BOSS_DAILY_HINT';
    const GJ_HUB_SNAPSHOT_KEY = 'HHA_GJ_HUB_SNAPSHOT';
    const GJ_DAILY_BOSS_META_KEY = 'HHA_GJ_BOSS_DAILY_META';

    const GOOD = ['🍎', '🥕', '🥦', '🍌', '🥛', '🥗', '🍉', '🐟'];
    const JUNK = ['🍟', '🍩', '🍭', '🍔', '🥤', '🍕', '🧁', '🍫'];

    const DIFF = {
      easy: {
        p1Goal: 70,
        p2Goal: 170,
        spawn1: 930,
        spawn2: 780,
        bossHp: 16,
        scoreGood: 12,
        penaltyJunk: 7
      },
      normal: {
        p1Goal: 90,
        p2Goal: 220,
        spawn1: 760,
        spawn2: 620,
        bossHp: 22,
        scoreGood: 10,
        penaltyJunk: 8
      },
      hard: {
        p1Goal: 110,
        p2Goal: 260,
        spawn1: 620,
        spawn2: 500,
        bossHp: 28,
        scoreGood: 9,
        penaltyJunk: 9
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
      phase: 1,

      score: 0,
      miss: 0,
      streak: 0,
      bestStreak: 0,
      hitsGood: 0,
      hitsBad: 0,
      powerHits: 0,
      stormHits: 0,
      goodMissed: 0,
      baitHits: 0,
      weakMissed: 0,

      timeTotal: Math.max(90, Number(ctx.time || 150)) * 1000,
      timeLeft: Math.max(90, Number(ctx.time || 150)) * 1000,

      lastTs: 0,
      spawnAcc: 0,
      seq: 0,
      raf: 0,

      items: new Map(),

      research: {
        sessionId: 'gjsb-' + Date.now() + '-' + ((Date.now() ^ ((performance.now() * 1000) | 0)) >>> 0).toString(36),
        events: []
      },

      metrics: {
        runStartAt: Date.now(),
        bossEnterAt: 0,
        bossEndAt: 0,
        bossDurationMs: 0,
        clearTimeMs: 0,
        stageShiftCount: 0,
        patternShiftCount: 0
      },

      runtime: {
        timers: new Set(),
        started: false,
        destroyed: false
      },

      uiLock: {
        navBusy: false,
        summaryShown: false
      },

      rng: {
        seedBase: 0,
        runRand: null
      },

      replay: {
        rematchCount: 0,
        sessionVariant: null,
        lastPatterns: [],
        recentSafeLanes: [],
        runLabel: ''
      },

      boss: {
        active: false,
        hp: 0,
        maxHp: 0,
        stage: 'A',
        stageReached: 'A',
        pattern: 'hunt',
        patternClock: 0,
        weakTimer: 0,
        stormTimer: 0,
        weakId: '',
        rage: false,
        rageTriggered: false
      },

      arena: {
        active: false,
        lanes: 3,
        telegraphMs: 0,
        sweepMs: 0,
        cycleGapMs: 0,
        safeLane: 1,
        warnedLanes: [],
        sweepingLanes: [],
        lastPattern: '',
        overlayReady: false
      }
    };

    let ui = null;
    let __gateUrlToolsPromise = null;

    function dlog() {
      if (!DEBUG) return;
      try { console.log('[GJSB]', ...arguments); } catch (_) {}
    }

    function clamp(v, a, b) {
      return Math.max(a, Math.min(b, v));
    }

    function nowMs() {
      return Date.now();
    }

    function fmtTime(ms) {
      const total = Math.max(0, Math.ceil(ms / 1000));
      const m = Math.floor(total / 60);
      const s = total % 60;
      return m + ':' + String(s).padStart(2, '0');
    }

    function xmur3(str) {
      let h = 1779033703 ^ str.length;
      for (let i = 0; i < str.length; i++) {
        h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
        h = (h << 13) | (h >>> 19);
      }
      return function() {
        h = Math.imul(h ^ (h >>> 16), 2246822507);
        h = Math.imul(h ^ (h >>> 13), 3266489909);
        return (h ^= h >>> 16) >>> 0;
      };
    }

    function mulberry32(a) {
      return function() {
        let t = a += 0x6D2B79F5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }

    function makeRunRandom(seedText) {
      const seedFn = xmur3(String(seedText || 'gjsb-default-seed'));
      const seed = seedFn();
      return {
        base: seed,
        next: mulberry32(seed)
      };
    }

    function runRand() {
      if (!state.rng.runRand) return Math.random();
      return state.rng.runRand();
    }

    function runRange(min, max) {
      return min + runRand() * (max - min);
    }

    function pickOne(list) {
      if (!Array.isArray(list) || !list.length) return null;
      return list[Math.floor(runRand() * list.length)];
    }

    function stageRect() {
      return ui.stage.getBoundingClientRect();
    }

    function safeTimeout(fn, ms) {
      const id = setTimeout(() => {
        state.runtime.timers.delete(id);
        try { fn(); } catch (err) { dlog('timer error', err); }
      }, ms);
      state.runtime.timers.add(id);
      return id;
    }

    function clearRuntimeTimers() {
      state.runtime.timers.forEach((id) => {
        try { clearTimeout(id); } catch (_) {}
      });
      state.runtime.timers.clear();
    }

    function pushEvent(type, detail) {
      state.research.events.push({
        t: nowMs(),
        type: String(type || 'event'),
        detail: detail || {}
      });
      if (state.research.events.length > 500) state.research.events.shift();
    }

    function storageGet(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw == null ? fallback : raw;
      } catch (_) {
        return fallback;
      }
    }

    function storageSet(key, value) {
      try { localStorage.setItem(key, value); } catch (_) {}
    }

    function safeJsonParse(text, fallback) {
      try { return JSON.parse(text); } catch (_) { return fallback; }
    }

    async function safeCopyText(text) {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
          return true;
        }
      } catch (_) {}
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', 'readonly');
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        ta.remove();
        return !!ok;
      } catch (_) {
        return false;
      }
    }

    function getLocalDateKey() {
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return y + '-' + m + '-' + day;
    }

    function shouldShowDailyTutorial() {
      const raw = storageGet(GJ_DAILY_HINT_KEY, '');
      return raw !== getLocalDateKey();
    }

    function markDailyTutorialSeen() {
      storageSet(GJ_DAILY_HINT_KEY, getLocalDateKey());
    }

    function getTodayKey() {
      return getLocalDateKey();
    }

    function readRematchState() {
      const raw = storageGet(GJ_REMATCH_KEY, '');
      const parsed = safeJsonParse(raw, null);
      if (!parsed || typeof parsed !== 'object') {
        return {
          count: 0,
          lastSeed: '',
          lastGrade: '',
          lastBossStage: '',
          updatedAt: 0
        };
      }
      return {
        count: Number(parsed.count || 0),
        lastSeed: String(parsed.lastSeed || ''),
        lastGrade: String(parsed.lastGrade || ''),
        lastBossStage: String(parsed.lastBossStage || ''),
        updatedAt: Number(parsed.updatedAt || 0)
      };
    }

    function writeRematchState(next) {
      storageSet(GJ_REMATCH_KEY, JSON.stringify({
        count: Number(next.count || 0),
        lastSeed: String(next.lastSeed || ''),
        lastGrade: String(next.lastGrade || ''),
        lastBossStage: String(next.lastBossStage || ''),
        updatedAt: Date.now()
      }));
    }

    function readDailyBossMeta() {
      const raw = storageGet(GJ_DAILY_BOSS_META_KEY, '');
      const parsed = safeJsonParse(raw, null);
      if (!parsed || typeof parsed !== 'object' || parsed.date !== getTodayKey()) {
        return {
          date: getTodayKey(),
          plays: 0,
          clears: 0,
          rageClears: 0,
          bestScore: 0,
          bestGrade: '',
          bestStreak: 0,
          rematchStreak: 0,
          lastReward: '',
          lastBadge: ''
        };
      }
      return parsed;
    }

    function writeDailyBossMeta(meta) {
      storageSet(GJ_DAILY_BOSS_META_KEY, JSON.stringify({
        date: getTodayKey(),
        plays: Number(meta.plays || 0),
        clears: Number(meta.clears || 0),
        rageClears: Number(meta.rageClears || 0),
        bestScore: Number(meta.bestScore || 0),
        bestGrade: String(meta.bestGrade || ''),
        bestStreak: Number(meta.bestStreak || 0),
        rematchStreak: Number(meta.rematchStreak || 0),
        lastReward: String(meta.lastReward || ''),
        lastBadge: String(meta.lastBadge || '')
      }));
    }

    function gradeScore(grade) {
      if (grade === 'S') return 4;
      if (grade === 'A') return 3;
      if (grade === 'B') return 2;
      return 1;
    }

    function getDailyChallenge() {
      const pool = [
        { id: 'clear-boss', title: 'เคลียร์บอส 1 ครั้ง', check: ({ bossClear }) => !!bossClear },
        { id: 'rage-clear', title: 'เคลียร์ Rage Finale', check: ({ rageClear }) => !!rageClear },
        { id: 'low-miss', title: 'จบเกม Miss ไม่เกิน 5', check: ({ miss }) => Number(miss) <= 5 },
        { id: 'combo-8', title: 'ทำคอมโบให้ถึง 8', check: ({ bestStreak }) => Number(bestStreak) >= 8 },
        { id: 'score-240', title: 'ทำคะแนนอย่างน้อย 240', check: ({ score }) => Number(score) >= 240 }
      ];
      const key = getTodayKey();
      const idx = key.split('-').join('').split('').reduce((a, b) => a + Number(b || 0), 0) % pool.length;
      return pool[idx];
    }

    function evaluateDailyChallenge(result) {
      const ch = getDailyChallenge();
      return {
        id: ch.id,
        title: ch.title,
        done: !!ch.check(result)
      };
    }

    function computeBossRewardMeta({ bossClear, rageClear, grade, miss, bestStreak, score }) {
      if (rageClear && grade === 'S' && miss <= 3) {
        return {
          badge: '👑 Mythic Food Hero',
          reward: 'Rage Crown',
          hallRank: 'Legend',
          deckTier: 'Mythic',
          rivalArc: 'Junk King Down'
        };
      }
      if (bossClear && grade === 'A') {
        return {
          badge: '🏆 Master Food Hero',
          reward: 'Victory Crest',
          hallRank: 'Champion',
          deckTier: 'Epic',
          rivalArc: 'Boss Crusher'
        };
      }
      if (bossClear) {
        return {
          badge: '🥇 Food Hero',
          reward: 'Boss Medal',
          hallRank: 'Hero',
          deckTier: 'Rare',
          rivalArc: 'Boss Route'
        };
      }
      if (score >= cfg.p2Goal) {
        return {
          badge: '🥈 Rising Hero',
          reward: 'Phase Star',
          hallRank: 'Rookie+',
          deckTier: 'Uncommon',
          rivalArc: 'Into Boss'
        };
      }
      return {
        badge: '🥉 Training Hero',
        reward: 'Practice Sticker',
        hallRank: 'Rookie',
        deckTier: 'Starter',
        rivalArc: 'Learning Run'
      };
    }

    function buildHubSnapshot({ bossClear, rageClear, grade, metaReward, dailyChallenge }) {
      const completionPct = bossClear ? (rageClear ? 100 : 92) : state.phase >= 2 ? 72 : 46;

      return {
        hero: {
          pid: ctx.pid || 'anon',
          name: ctx.name || 'Hero',
          diff: diffKey,
          run: ctx.run || 'play'
        },
        archive: {
          completionPct,
          hallRank: metaReward.hallRank,
          recent: [
            { group: 'boss', label: bossClear ? (rageClear ? 'Rage Clear' : 'Boss Clear') : `Phase ${state.phase}` },
            { group: 'grade', label: grade },
            { group: 'reward', label: metaReward.reward }
          ]
        },
        reward: {
          title: metaReward.reward,
          badge: metaReward.badge.split(' ')[0] || '🏆'
        },
        rivalry: {
          key: metaReward.rivalArc.toLowerCase().replace(/\s+/g, '-'),
          label: metaReward.rivalArc,
          deckTier: metaReward.deckTier
        },
        target: {
          key: bossClear ? 'solo-boss-rematch' : 'clear-boss',
          group: 'goodjunk',
          label: bossClear ? 'Solo Boss Rematch' : 'Reach Boss'
        },
        nextPlan: {
          title: bossClear ? 'Recommended Next Run' : 'Try Again',
          reason: bossClear
            ? (rageClear ? 'ลองรักษาแรงกดดันให้จบแบบพลาดน้อยลง' : 'ลองผ่าน Rage Finale ให้ได้')
            : 'ลองอีกครั้งเพื่อไปให้ถึงบอส',
          mode: 'solo-boss',
          chips: [
            metaReward.deckTier,
            dailyChallenge.done ? 'Daily Done' : 'Daily Open',
            bossClear ? 'Rematch Ready' : 'Practice'
          ]
        }
      };
    }

    function saveHubSnapshot(snapshot) {
      storageSet(GJ_HUB_SNAPSHOT_KEY, JSON.stringify(snapshot));
    }

    function buildMetaSummaryHtml(metaReward, dailyResult, dailyMeta) {
      return `
        <div class="gjsb-stat"><div class="k">เหรียญรางวัล</div><div class="v">${metaReward.badge}</div></div>
        <div class="gjsb-stat"><div class="k">ของรางวัล</div><div class="v">${metaReward.reward}</div></div>
        <div class="gjsb-stat"><div class="k">ภารกิจวันนี้</div><div class="v">${dailyResult.done ? '✅ สำเร็จ' : '⏳ ยังไม่สำเร็จ'}</div></div>
        <div class="gjsb-stat"><div class="k">เป้าหมาย</div><div class="v">${dailyResult.title}</div></div>
        <div class="gjsb-stat"><div class="k">วันนี้เล่น</div><div class="v">${dailyMeta.plays}</div></div>
        <div class="gjsb-stat"><div class="k">เล่นต่อเนื่อง</div><div class="v">${dailyMeta.rematchStreak}</div></div>
        <div class="gjsb-stat"><div class="k">ชนะบอสวันนี้</div><div class="v">${dailyMeta.clears}</div></div>
        <div class="gjsb-stat"><div class="k">ชนะ Rage วันนี้</div><div class="v">${dailyMeta.rageClears}</div></div>
      `;
    }

    function buildSessionVariant() {
      const rematchInfo = readRematchState();
      const count = rematchInfo.count || 0;

      const variantPool = [
        'balanced',
        'bait-heavy',
        'storm-heavy',
        'fast-weak',
        'safe-lane-shift'
      ];

      const variant = variantPool[count % variantPool.length] || 'balanced';

      state.replay.rematchCount = count;
      state.replay.sessionVariant = variant;
      state.replay.runLabel =
        variant === 'bait-heavy' ? 'Bait Mix' :
        variant === 'storm-heavy' ? 'Storm Mix' :
        variant === 'fast-weak' ? 'Quick Weak' :
        variant === 'safe-lane-shift' ? 'Shift Lane' :
        'Balanced';

      return variant;
    }

    function pushReplayPattern(pattern) {
      state.replay.lastPatterns.push(pattern);
      if (state.replay.lastPatterns.length > 4) state.replay.lastPatterns.shift();
    }

    function pushRecentSafeLane(laneIndex) {
      state.replay.recentSafeLanes.push(laneIndex);
      if (state.replay.recentSafeLanes.length > 4) state.replay.recentSafeLanes.shift();
    }

    function getDiffTuning() {
      if (diffKey === 'easy') {
        return {
          scoreGoodBonus: 1,
          junkPenaltyMul: 0.9,
          weakSizeMul: 1.12,
          weakEveryMul: 1.14,
          weakLifeMul: 1.22,
          weakSpeedMul: 0.88,
          stormEveryMul: 1.22,
          stormSpeedMul: 0.88,
          baitChanceMul: 0.72,
          phaseFoodSpeedMul: 0.9,
          goodRatioBonusP1: 0.04,
          goodRatioBonusP2: 0.03,
          safeLaneHoldBias: 0.68
        };
      }

      if (diffKey === 'hard') {
        return {
          scoreGoodBonus: 0,
          junkPenaltyMul: 1.08,
          weakSizeMul: 0.92,
          weakEveryMul: 0.90,
          weakLifeMul: 0.84,
          weakSpeedMul: 1.12,
          stormEveryMul: 0.84,
          stormSpeedMul: 1.14,
          baitChanceMul: 1.22,
          phaseFoodSpeedMul: 1.08,
          goodRatioBonusP1: -0.02,
          goodRatioBonusP2: -0.03,
          safeLaneHoldBias: 0.18
        };
      }

      return {
        scoreGoodBonus: 0,
        junkPenaltyMul: 1,
        weakSizeMul: 1,
        weakEveryMul: 1,
        weakLifeMul: 1,
        weakSpeedMul: 1,
        stormEveryMul: 1,
        stormSpeedMul: 1,
        baitChanceMul: 1,
        phaseFoodSpeedMul: 1,
        goodRatioBonusP1: 0,
        goodRatioBonusP2: 0,
        safeLaneHoldBias: 0.4
      };
    }

    function chooseSafeLaneSmart() {
      const tune = getDiffTuning();
      const lanes = [0, 1, 2];
      const recent = state.replay.recentSafeLanes.slice(-2);
      const last = recent.length ? recent[recent.length - 1] : null;

      if (last != null && runRand() < tune.safeLaneHoldBias) {
        pushRecentSafeLane(last);
        return last;
      }

      const candidates = lanes.filter((lane) => recent.indexOf(lane) < 0);
      const pool = candidates.length ? candidates : lanes;
      const pick = pool[Math.floor(runRand() * pool.length)];
      pushRecentSafeLane(pick);
      return pick;
    }

    function pickBossPatternSmart(stageCfg) {
      const cycle = Array.isArray(stageCfg.patternCycle) ? stageCfg.patternCycle.slice() : ['hunt'];
      const last = state.replay.lastPatterns[state.replay.lastPatterns.length - 1] || '';
      const recentTwo = state.replay.lastPatterns.slice(-2);

      let candidates = cycle.slice();

      if (cycle.length > 1 && last) {
        const nonRepeat = candidates.filter((p) => p !== last);
        if (nonRepeat.length) candidates = nonRepeat;
      }

      if (cycle.length > 2 && recentTwo.length >= 2 && recentTwo[0] === recentTwo[1]) {
        const antiLoop = candidates.filter((p) => p !== recentTwo[1]);
        if (antiLoop.length) candidates = antiLoop;
      }

      const variant = state.replay.sessionVariant || 'balanced';

      if (variant === 'bait-heavy' && candidates.indexOf('trick') >= 0 && runRand() < 0.42) return 'trick';
      if (variant === 'storm-heavy' && candidates.indexOf('storm') >= 0 && runRand() < 0.45) return 'storm';
      if (variant === 'fast-weak' && candidates.indexOf('pressure') >= 0 && runRand() < 0.38) return 'pressure';
      if (variant === 'safe-lane-shift' && candidates.indexOf('pressure') >= 0 && runRand() < 0.34) return 'pressure';

      return pickOne(candidates) || cycle[0] || 'hunt';
    }

    function playTone(freq, duration, type, gainValue) {
      if (state.muted) return;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        if (!playTone._ctx) playTone._ctx = new AC();
        const ac = playTone._ctx;
        const osc = ac.createOscillator();
        const gain = ac.createGain();

        osc.type = type || 'triangle';
        osc.frequency.value = freq || 440;
        gain.gain.value = gainValue || 0.02;

        osc.connect(gain);
        gain.connect(ac.destination);

        const now = ac.currentTime;
        gain.gain.setValueAtTime(gainValue || 0.02, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + (duration || 0.08));

        osc.start(now);
        osc.stop(now + (duration || 0.08));
      } catch (_) {}
    }

    function playSfx(kind) {
      if (kind === 'good') {
        playTone(720, 0.05, 'triangle', 0.018);
        safeTimeout(() => playTone(900, 0.05, 'triangle', 0.014), 35);
        return;
      }
      if (kind === 'bad') {
        playTone(220, 0.08, 'sawtooth', 0.02);
        return;
      }
      if (kind === 'phase') {
        playTone(520, 0.08, 'triangle', 0.024);
        safeTimeout(() => playTone(780, 0.10, 'triangle', 0.024), 80);
        safeTimeout(() => playTone(1040, 0.12, 'triangle', 0.024), 180);
        return;
      }
      if (kind === 'boss-hit') {
        playTone(560, 0.08, 'square', 0.024);
        safeTimeout(() => playTone(840, 0.08, 'triangle', 0.02), 45);
        return;
      }
      if (kind === 'boss-clear') {
        playTone(784, 0.10, 'triangle', 0.03);
        safeTimeout(() => playTone(988, 0.12, 'triangle', 0.03), 110);
        safeTimeout(() => playTone(1174, 0.16, 'triangle', 0.032), 240);
      }
    }

    function getChildPatternText(pattern) {
      if (pattern === 'trick') return 'หลอก';
      if (pattern === 'pressure') return 'รีบ';
      if (pattern === 'burst') return 'เร็ว';
      if (pattern === 'storm') return 'หลบ';
      return 'ตี!';
    }

    function getChildPatternLabel(pattern) {
      if (pattern === 'trick') return 'เป้าหลอก';
      if (pattern === 'pressure') return 'ช่วงรีบ';
      if (pattern === 'burst') return 'ช่วงไว';
      if (pattern === 'storm') return 'พายุขยะ';
      return 'เป้าทอง';
    }

    function getChildPatternHint(pattern) {
      if (pattern === 'trick') return 'อย่าแตะของลวงใกล้เป้า';
      if (pattern === 'pressure') return 'หา SAFE lane ก่อนค่อยตี';
      if (pattern === 'burst') return 'เป้าโผล่ไว ตีติดกันเลย';
      if (pattern === 'storm') return 'หลบของขยะก่อน';
      return 'แตะเป้าทองให้ทัน';
    }

    function getChildStageTitle(stageKey) {
      if (stageKey === 'B') return 'Stage B • เป้าหลอก';
      if (stageKey === 'C') return 'Stage C • ช่วงรีบ';
      if (stageKey === 'RAGE') return 'Rage Finale';
      return 'Stage A • ฝึกก่อน';
    }

    function getChildStageHint(stageKey) {
      if (stageKey === 'B') return 'ระวังของลวงใกล้เป้า';
      if (stageKey === 'C') return 'อ่านช่องปลอดภัยก่อน';
      if (stageKey === 'RAGE') return 'โผล่ไวมาก ตีต่อเนื่อง';
      return 'เป้าทองใหญ่ แตะให้ทัน';
    }

    function getGateUrlTools() {
      if (!__gateUrlToolsPromise) {
        __gateUrlToolsPromise = import('./gate/gate-url.js');
      }
      return __gateUrlToolsPromise;
    }

    function injectStyle() {
      if (document.getElementById(STYLE_ID)) return;

      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = `
        #${ROOT_ID}{
          position:absolute;
          inset:0;
          overflow:hidden;
          font-family:system-ui,-apple-system,"Segoe UI",sans-serif;
          color:#fff;
        }

        .gjsb-stage{
          position:absolute;
          inset:0;
          overflow:hidden;
          background:
            radial-gradient(circle at 20% 16%, rgba(255,255,255,.12), transparent 18%),
            radial-gradient(circle at 82% 10%, rgba(255,255,255,.10), transparent 18%),
            linear-gradient(180deg,#93d9ff 0%, #ccefff 54%, #fff3c9 100%);
        }

        .gjsb-ground{
          position:absolute;
          left:0; right:0; bottom:0;
          height:18%;
          background:linear-gradient(180deg,#9be26a,#67c94c);
          box-shadow:inset 0 4px 0 rgba(255,255,255,.25);
        }

        .gjsb-cloud{
          position:absolute;
          width:110px;
          height:34px;
          border-radius:999px;
          background:rgba(255,255,255,.75);
          filter:blur(.5px);
          box-shadow:
            40px 0 0 4px rgba(255,255,255,.75),
            82px 6px 0 0 rgba(255,255,255,.65);
          opacity:.9;
        }
        .gjsb-cloud.c1{ left:6%; top:8%; }
        .gjsb-cloud.c2{ left:64%; top:13%; transform:scale(1.18); }
        .gjsb-cloud.c3{ left:30%; top:22%; transform:scale(.9); }

        .gjsb-topHud{
          position:absolute;
          left:8px;
          right:8px;
          top:8px;
          z-index:30;
          display:grid;
          gap:6px;
        }

        .gjsb-bar{
          display:grid;
          grid-template-columns:repeat(auto-fit,minmax(110px,1fr));
          gap:6px;
          align-items:center;
        }

        .gjsb-pill{
          min-height:30px;
          padding:6px 8px;
          border-radius:999px;
          background:rgba(255,255,255,.88);
          color:#55514a;
          box-shadow:0 6px 12px rgba(86,155,194,.10);
          border:2px solid rgba(191,227,242,.95);
          font-size:11px;
          font-weight:1000;
          text-align:center;
        }

        .gjsb-pill.emph{
          background:linear-gradient(180deg,#fff8dc,#fff1bc);
          border-color:#ffe08a;
          color:#9d6016;
          animation:gjsbPillPop .28s ease-out 1;
        }

        @keyframes gjsbPillPop{
          0%{ transform:scale(.96); }
          60%{ transform:scale(1.04); }
          100%{ transform:scale(1); }
        }

        .gjsb-banner{
          justify-self:center;
          min-height:34px;
          padding:8px 14px;
          border-radius:999px;
          background:#fff;
          color:#666055;
          border:2px solid rgba(191,227,242,.95);
          font-size:12px;
          font-weight:1000;
          box-shadow:0 8px 18px rgba(86,155,194,.10);
          opacity:0;
          transform:translateY(-4px);
          transition:.18s ease;
        }
        .gjsb-banner.show{
          opacity:1;
          transform:translateY(0);
        }
        .gjsb-banner.kill{
          background:linear-gradient(180deg,#fff8dc,#fff1bc);
          border-color:#ffe08a;
          color:#9d6016;
          box-shadow:0 12px 22px rgba(255,181,71,.16);
          animation:gjsbKillBanner .36s ease-out 1;
        }
        @keyframes gjsbKillBanner{
          0%{ transform:translateY(-4px) scale(.96); }
          60%{ transform:translateY(0) scale(1.04); }
          100%{ transform:translateY(0) scale(1); }
        }

        .gjsb-progressWrap{
          height:8px;
          border-radius:999px;
          background:rgba(255,255,255,.82);
          border:2px solid rgba(191,227,242,.95);
          overflow:hidden;
          width:100%;
          box-shadow:0 6px 12px rgba(86,155,194,.08);
        }

        .gjsb-progressFill{
          height:100%;
          width:100%;
          transform-origin:left center;
          background:linear-gradient(90deg,#7fcfff,#7ed957);
          transition:transform .1s linear;
        }

        .gjsb-utilRow{
          display:flex;
          gap:6px;
          align-items:center;
          justify-content:flex-end;
        }

        .gjsb-utilBtn{
          min-height:32px;
          min-width:32px;
          padding:6px 10px;
          border:none;
          border-radius:12px;
          background:rgba(255,255,255,.92);
          color:#57534c;
          border:2px solid rgba(191,227,242,.95);
          box-shadow:0 6px 12px rgba(86,155,194,.08);
          font-size:11px;
          font-weight:1000;
          cursor:pointer;
        }

        .gjsb-utilBtn.active{
          background:#eefbff;
          color:#2d6f94;
        }

        .gjsb-arenaOverlay{
          position:absolute;
          inset:96px 10px 120px 10px;
          z-index:24;
          pointer-events:none;
          display:grid;
          grid-template-columns:repeat(3,minmax(0,1fr));
          gap:8px;
        }

        .gjsb-lane{
          position:relative;
          border-radius:18px;
          overflow:hidden;
          background:linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.02));
          border:2px solid rgba(255,255,255,.06);
          transition:background .16s ease, border-color .16s ease, box-shadow .16s ease, transform .16s ease;
        }

        .gjsb-lane::after{
          content:'';
          position:absolute;
          inset:0;
          opacity:0;
          transition:opacity .16s ease;
        }

        .gjsb-lane.warn{
          background:linear-gradient(180deg, rgba(255,210,210,.18), rgba(255,170,170,.10));
          border-color:rgba(255,166,166,.52);
          box-shadow:inset 0 0 0 2px rgba(255,205,205,.18);
        }

        .gjsb-lane.warn::after{
          opacity:1;
          background:
            repeating-linear-gradient(
              -45deg,
              rgba(255,120,120,.16) 0 12px,
              rgba(255,255,255,0) 12px 24px
            );
        }

        .gjsb-lane.safe{
          background:linear-gradient(180deg, rgba(179,241,255,.18), rgba(127,207,255,.10));
          border-color:rgba(127,207,255,.56);
          box-shadow:inset 0 0 0 2px rgba(194,239,255,.18);
        }

        .gjsb-lane.safe::after{
          opacity:1;
          background:linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,0));
        }

        .gjsb-lane.sweep{
          background:linear-gradient(180deg, rgba(255,160,160,.28), rgba(255,90,90,.14));
          border-color:rgba(255,120,120,.70);
          box-shadow:inset 0 0 0 2px rgba(255,220,220,.18), 0 0 0 3px rgba(255,120,120,.10);
        }

        .gjsb-lane.sweep::before{
          content:'';
          position:absolute;
          left:10%;
          right:10%;
          top:-18%;
          height:34%;
          border-radius:999px;
          background:linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,0));
          animation:gjsbSweepPulse .45s linear infinite;
        }

        @keyframes gjsbSweepPulse{
          0%{ transform:translateY(0); opacity:.45; }
          100%{ transform:translateY(230%); opacity:.10; }
        }

        .gjsb-laneLabel{
          position:absolute;
          left:8px;
          right:8px;
          top:8px;
          display:flex;
          align-items:center;
          justify-content:center;
          min-height:24px;
          border-radius:999px;
          font-size:10px;
          font-weight:1000;
          color:rgba(255,255,255,.92);
          background:rgba(0,0,0,.12);
          backdrop-filter:blur(2px);
          letter-spacing:.02em;
          text-align:center;
          line-height:1.15;
        }

        .gjsb-laneLabel .cue{
          display:block;
          margin-top:2px;
          font-size:9px;
          opacity:.94;
        }

        .gjsb-stageCue{
          position:absolute;
          left:50%;
          top:22%;
          transform:translateX(-50%);
          z-index:40;
          min-width:min(88vw,380px);
          max-width:min(90vw,420px);
          display:none;
          border-radius:22px;
          border:3px solid #d7edf7;
          background:linear-gradient(180deg,#fffef8,#ffffff);
          box-shadow:0 18px 36px rgba(86,155,194,.18);
          padding:14px 16px;
          text-align:center;
          color:#5a554c;
        }

        .gjsb-stageCue.show{
          display:block;
          animation:gjsbStageCuePop .36s ease-out 1;
        }

        @keyframes gjsbStageCuePop{
          0%{ opacity:0; transform:translateX(-50%) translateY(8px) scale(.96); }
          100%{ opacity:1; transform:translateX(-50%) translateY(0) scale(1); }
        }

        .gjsb-stageCue .k{
          font-size:11px;
          font-weight:1000;
          color:#5ea8d0;
          letter-spacing:.06em;
        }

        .gjsb-stageCue .t{
          margin-top:4px;
          font-size:24px;
          line-height:1.05;
          font-weight:1000;
          color:#4d4a42;
        }

        .gjsb-stageCue .s{
          margin-top:6px;
          font-size:13px;
          line-height:1.55;
          font-weight:1000;
          color:#6c6a61;
        }

        .gjsb-tutorial{
          position:absolute;
          inset:0;
          z-index:78;
          display:none;
          place-items:center;
          background:rgba(255,255,255,.30);
          backdrop-filter:blur(5px);
          padding:16px;
        }

        .gjsb-tutorial.show{
          display:grid;
        }

        .gjsb-tutorialCard{
          width:min(92vw,520px);
          border-radius:26px;
          border:4px solid #d7edf7;
          background:linear-gradient(180deg,#fffef8,#ffffff);
          box-shadow:0 20px 40px rgba(86,155,194,.18);
          padding:18px;
          color:#5a554c;
          text-align:center;
        }

        .gjsb-tutorialCard .badge{
          display:inline-flex;
          align-items:center;
          justify-content:center;
          min-height:34px;
          padding:8px 14px;
          border-radius:999px;
          background:#eefbff;
          border:2px solid #cdeeff;
          color:#2d6f8b;
          font-size:12px;
          font-weight:1000;
        }

        .gjsb-tutorialCard h3{
          margin:12px 0 8px;
          font-size:24px;
          line-height:1.06;
          color:#67a91c;
        }

        .gjsb-tutorialList{
          margin-top:12px;
          display:grid;
          gap:8px;
          text-align:left;
        }

        .gjsb-tutorialItem{
          border-radius:16px;
          border:2px solid #d7edf7;
          background:#fff;
          padding:10px 12px;
          font-size:13px;
          line-height:1.6;
          font-weight:1000;
          color:#666055;
        }

        .gjsb-tutorialActions{
          margin-top:14px;
          display:grid;
          gap:10px;
        }

        .gjsb-tutorialBtn{
          border:none;
          border-radius:16px;
          min-height:46px;
          padding:10px 14px;
          font-size:15px;
          font-weight:1000;
          cursor:pointer;
        }

        .gjsb-tutorialBtn.primary{
          background:linear-gradient(180deg,#7ed957,#58c33f);
          color:#173b0b;
        }

        .gjsb-tutorialBtn.soft{
          background:#fff;
          color:#6c6a61;
          border:3px solid #d7edf7;
        }

        .gjsb-boss{
          position:absolute;
          right:10px;
          bottom:108px;
          z-index:28;
          width:min(220px,38vw);
          display:none;
        }
        .gjsb-boss.show{ display:block; }

        .gjsb-boss-card{
          border-radius:18px;
          background:linear-gradient(180deg,#fffdf4,#fff7da);
          border:3px solid rgba(255,212,92,.95);
          box-shadow:0 10px 18px rgba(86,155,194,.12);
          padding:8px 9px;
          color:#5e5a52;
          position:relative;
        }

        .gjsb-boss-card.rage{
          border-color:#ffb0a2;
          box-shadow:0 12px 24px rgba(86,155,194,.14), 0 0 0 6px rgba(255,120,120,.12);
        }

        .gjsb-boss-card.hurt{
          animation:gjsbBossHurt .28s ease-out 1;
        }

        .gjsb-boss-card.rage.hurt{
          animation:gjsbBossHurtRage .28s ease-out 1;
        }

        @keyframes gjsbBossHurt{
          0%{ transform:scale(1); box-shadow:0 10px 18px rgba(86,155,194,.12); }
          18%{ transform:scale(1.03); box-shadow:0 0 0 6px rgba(255,140,95,.18), 0 14px 24px rgba(86,155,194,.16); }
          100%{ transform:scale(1); box-shadow:0 10px 18px rgba(86,155,194,.12); }
        }

        @keyframes gjsbBossHurtRage{
          0%{ transform:scale(1); }
          18%{ transform:scale(1.045); box-shadow:0 0 0 7px rgba(255,96,96,.24), 0 12px 24px rgba(86,155,194,.18), 0 0 0 10px rgba(255,220,220,.12); }
          100%{ transform:scale(1); }
        }

        .gjsb-boss-head{
          display:grid;
          grid-template-columns:40px 1fr;
          gap:7px;
          align-items:center;
        }

        .gjsb-boss-icon{
          width:40px;
          height:40px;
          border-radius:14px;
          display:grid;
          place-items:center;
          font-size:22px;
          background:linear-gradient(180deg,#fff0be,#ffe08a);
          border:2px solid rgba(255,212,92,.95);
        }

        .gjsb-boss-title{
          font-size:14px;
          font-weight:1000;
          line-height:1.05;
        }

        .gjsb-boss-sub{
          margin-top:3px;
          font-size:10px;
          line-height:1.25;
          color:#7b7a72;
          font-weight:1000;
        }

        .gjsb-boss-stage{
          margin-top:7px;
          display:inline-flex;
          align-items:center;
          justify-content:center;
          padding:5px 8px;
          border-radius:999px;
          background:#fff;
          border:2px solid #f3df97;
          font-size:10px;
          font-weight:1000;
        }

        .gjsb-patternChip{
          display:inline-flex;
          align-items:center;
          justify-content:center;
          margin-top:8px;
          padding:6px 10px;
          border-radius:999px;
          background:#eefbff;
          border:2px solid #cdeeff;
          color:#31739a;
          font-size:11px;
          font-weight:1000;
        }

        .gjsb-rageBadge{
          display:none;
          margin-top:8px;
          align-items:center;
          justify-content:center;
          padding:6px 10px;
          border-radius:999px;
          font-size:11px;
          font-weight:1000;
          background:#fff0f0;
          border:2px solid #ffc6c6;
          color:#b3472d;
        }
        .gjsb-rageBadge.show{ display:inline-flex; }

        .gjsb-boss-bar{
          margin-top:10px;
          height:14px;
          border-radius:999px;
          overflow:hidden;
          background:#eef4f7;
          border:2px solid #d9eaf5;
        }

        .gjsb-boss-fill{
          height:100%;
          width:100%;
          transform-origin:left center;
          background:linear-gradient(90deg,#ffd45c,#ff8f3b);
          transition:transform .12s linear;
        }

        .gjsb-boss-hp{
          margin-top:4px;
          text-align:right;
          font-size:10px;
          font-weight:1000;
          color:#7b7a72;
        }

        .gjsb-item{
          position:absolute;
          left:0;
          top:0;
          display:grid;
          place-items:center;
          border:none;
          cursor:pointer;
          border-radius:22px;
          background:rgba(255,255,255,.92);
          box-shadow:0 10px 22px rgba(86,155,194,.18);
          border:3px solid rgba(191,227,242,.95);
          color:#222;
          user-select:none;
          -webkit-user-select:none;
          will-change:left,top;
        }

        .gjsb-item.good{ background:linear-gradient(180deg,#f7fff1,#ffffff); }
        .gjsb-item.junk,
        .gjsb-item.storm{
          background:linear-gradient(180deg,#fff3f3,#ffffff);
          border-color:#ffd3d3;
        }

        .gjsb-item.junk.bait{
          background:linear-gradient(180deg,#fff5ea,#ffffff);
          border-color:#ffd1b0;
          box-shadow:0 0 0 4px rgba(255,181,71,.16), 0 10px 22px rgba(86,155,194,.18);
        }

        .gjsb-item.weak.hunt{
          border-color:#ffe08a;
          background:linear-gradient(180deg,#fff8d5,#ffffff);
        }

        .gjsb-item.weak.trick{
          border-color:#ffb7ea;
          background:linear-gradient(180deg,#fff0fb,#ffffff);
          box-shadow:0 0 0 4px rgba(255,183,234,.14), 0 10px 22px rgba(86,155,194,.18);
        }

        .gjsb-item.weak.pressure{
          border-color:#ffbdbd;
          background:linear-gradient(180deg,#ffe8e8,#ffffff);
          box-shadow:0 0 0 4px rgba(255,140,140,.12), 0 10px 22px rgba(86,155,194,.18);
        }

        .gjsb-item.weak.burst{
          border-color:#ffbe7a;
          background:linear-gradient(180deg,#fff0e5,#ffffff);
          box-shadow:0 0 0 4px rgba(255,181,71,.14), 0 10px 22px rgba(86,155,194,.18);
        }

        .gjsb-emoji{
          font-size:34px;
          line-height:1;
          pointer-events:none;
        }

        .gjsb-tag{
          position:absolute;
          left:6px;
          right:6px;
          bottom:4px;
          text-align:center;
          font-size:10px;
          font-weight:1000;
          pointer-events:none;
        }

        .gjsb-tag.pattern-hunt{ color:#9d6016; }
        .gjsb-tag.pattern-trick{ color:#a33f8c; }
        .gjsb-tag.pattern-pressure{ color:#b3472d; }
        .gjsb-tag.pattern-burst{ color:#b56400; }

        .gjsb-item.weak{
          animation:gjsbPulse .9s infinite;
        }

        @keyframes gjsbPulse{
          0%,100%{ box-shadow:0 10px 22px rgba(86,155,194,.18); filter:brightness(1); }
          50%{ box-shadow:0 0 0 4px rgba(255,224,138,.22), 0 10px 22px rgba(86,155,194,.18); filter:brightness(1.06); }
        }

        .gjsb-trail{
          position:absolute;
          border-radius:20px;
          pointer-events:none;
          z-index:21;
          opacity:.34;
          animation:gjsbTrailFade .28s ease-out forwards;
          filter:blur(.6px);
        }

        @keyframes gjsbTrailFade{
          0%{ opacity:.34; transform:scale(.98); }
          100%{ opacity:0; transform:scale(1.08); }
        }

        .gjsb-fx{
          position:absolute;
          transform:translate(-50%,-50%);
          font-size:16px;
          font-weight:1000;
          z-index:35;
          pointer-events:none;
          animation:gjsbFx .75s ease forwards;
          text-shadow:0 8px 18px rgba(0,0,0,.14);
        }

        @keyframes gjsbFx{
          from{ opacity:1; transform:translate(-50%,-10%); }
          to{ opacity:0; transform:translate(-50%,-150%); }
        }

        .gjsb-stage.hitstop{
          animation:gjsbHitStop .08s steps(1,end) 1;
        }

        @keyframes gjsbHitStop{
          0%{ transform:scale(1); filter:saturate(1); }
          100%{ transform:scale(.996); filter:saturate(1.05); }
        }

        .gjsb-stage.rage-vignette{
          box-shadow:inset 0 0 0 4px rgba(255,110,110,.14), inset 0 0 90px rgba(255,80,80,.12);
        }

        .gjsb-finisherFlash{
          position:absolute;
          inset:0;
          z-index:79;
          pointer-events:none;
          opacity:0;
          background:radial-gradient(circle at 50% 42%, rgba(255,245,170,.98), rgba(255,255,255,.78) 22%, rgba(255,255,255,0) 58%);
        }

        .gjsb-finisherFlash.show{
          animation:gjsbFinisherFlash .72s ease-out 1;
        }

        @keyframes gjsbFinisherFlash{
          0%{ opacity:0; transform:scale(.96); }
          14%{ opacity:1; transform:scale(1.01); }
          100%{ opacity:0; transform:scale(1.05); }
        }

        .gjsb-pause{
          position:absolute;
          inset:0;
          z-index:70;
          display:none;
          place-items:center;
          background:rgba(255,255,255,.42);
          backdrop-filter:blur(4px);
        }

        .gjsb-pause.show{
          display:grid;
        }

        .gjsb-pauseCard{
          width:min(88vw,420px);
          border-radius:24px;
          background:linear-gradient(180deg,#fffef8,#fff);
          border:4px solid #d7edf7;
          box-shadow:0 18px 36px rgba(86,155,194,.18);
          padding:18px;
          text-align:center;
          color:#5a554c;
        }

        .gjsb-pauseTitle{
          font-size:28px;
          line-height:1.08;
          font-weight:1000;
          color:#67a91c;
        }

        .gjsb-pauseSub{
          margin-top:8px;
          font-size:14px;
          line-height:1.55;
          color:#7b7a72;
          font-weight:1000;
        }

        .gjsb-pauseActions{
          display:grid;
          gap:10px;
          margin-top:16px;
        }

        .gjsb-pauseBtn{
          border:none;
          border-radius:18px;
          padding:13px 16px;
          font-size:15px;
          font-weight:1000;
          cursor:pointer;
        }

        .gjsb-pauseBtn.resume{
          background:linear-gradient(180deg,#7ed957,#58c33f);
          color:#173b0b;
        }

        .gjsb-pauseBtn.hub{
          background:#fff;
          color:#6c6a61;
          border:3px solid #d7edf7;
        }

        .gjsb-stage.victory-lock::after{
          content:'';
          position:absolute;
          inset:0;
          z-index:52;
          background:
            radial-gradient(circle at 50% 35%, rgba(255,255,255,.22), transparent 26%),
            linear-gradient(180deg, rgba(255,255,255,.24), rgba(255,255,255,.48));
          backdrop-filter: blur(5px) saturate(1.02);
          pointer-events:none;
        }

        .gjsb-stage.victory-flash::before{
          content:'';
          position:absolute;
          inset:0;
          z-index:53;
          background:
            radial-gradient(circle at 50% 42%, rgba(255,247,188,.92), rgba(255,255,255,.66) 28%, rgba(255,255,255,0) 60%);
          animation:gjsbVictoryFlash .7s ease-out forwards;
          pointer-events:none;
        }

        @keyframes gjsbVictoryFlash{
          0%{ opacity:0; transform:scale(.96); }
          18%{ opacity:1; transform:scale(1.01); }
          100%{ opacity:0; transform:scale(1.03); }
        }

        .gjsb-stage.victory-shake{
          animation:gjsbVictoryShake .34s ease-out 1;
        }

        @keyframes gjsbVictoryShake{
          0%{ transform:translate3d(0,0,0); }
          20%{ transform:translate3d(-3px,1px,0); }
          40%{ transform:translate3d(4px,-2px,0); }
          60%{ transform:translate3d(-2px,2px,0); }
          80%{ transform:translate3d(2px,-1px,0); }
          100%{ transform:translate3d(0,0,0); }
        }

        .gjsb-summary{
          position:absolute;
          inset:0;
          z-index:80;
          display:none;
          place-items:center;
          background:
            radial-gradient(circle at 50% 22%, rgba(255,255,255,.34), transparent 22%),
            rgba(255,255,255,.26);
          backdrop-filter: blur(7px);
          padding:16px;
        }
        .gjsb-summary.show{ display:grid; }

        .gjsb-summary-card{
          position:relative;
          overflow:hidden;
          width:min(94vw,760px);
          max-height:88vh;
          overflow:auto;
          border-radius:28px;
          background:linear-gradient(180deg,#fffef8,#f8fff3);
          border:5px solid #bfe3f2;
          box-shadow:
            0 24px 52px rgba(86,155,194,.22),
            0 0 0 8px rgba(255,255,255,.24);
          padding:18px;
          color:#55514a;
          transform:translateY(10px) scale(.98);
          opacity:0;
          animation:gjsbSummaryPop .42s cubic-bezier(.2,.9,.2,1) forwards;
        }

        @keyframes gjsbSummaryPop{
          0%{ opacity:0; transform:translateY(12px) scale(.97); }
          100%{ opacity:1; transform:translateY(0) scale(1); }
        }

        .gjsb-summary-card::before{
          content:'';
          position:absolute;
          inset:-30% auto auto -10%;
          width:180px;
          height:180px;
          border-radius:999px;
          background:radial-gradient(circle, rgba(255,255,255,.28), rgba(255,255,255,0) 70%);
          pointer-events:none;
        }

        .gjsb-summary-card::after{
          content:'';
          position:absolute;
          right:-24px;
          top:-24px;
          width:120px;
          height:120px;
          border-radius:28px;
          background:linear-gradient(180deg, rgba(255,255,255,.18), rgba(255,255,255,0));
          transform:rotate(18deg);
          pointer-events:none;
        }

        .gjsb-summary-card.grade-s{
          border-color:#ffe08a !important;
          box-shadow:0 24px 56px rgba(255,181,71,.22), 0 0 0 8px rgba(255,247,219,.40);
        }
        .gjsb-summary-card.grade-a{ border-color:#cfe9b8 !important; }
        .gjsb-summary-card.grade-b{ border-color:#cdeeff !important; }
        .gjsb-summary-card.grade-c{ border-color:#ead7c6 !important; }

        .gjsb-summary-head{
          text-align:center;
          margin-bottom:14px;
        }

        .gjsb-medal{
          margin:10px auto 0;
          width:110px;
          height:110px;
          border-radius:32px;
          display:grid;
          place-items:center;
          font-size:50px;
          background:linear-gradient(180deg,#fff8d8,#fffef6);
          border:4px solid #d7edf7;
          box-shadow:0 12px 24px rgba(86,155,194,.14);
        }

        .gjsb-medal.victory-burst{
          animation:gjsbMedalBurst .7s cubic-bezier(.2,.9,.2,1);
        }

        @keyframes gjsbMedalBurst{
          0%{ transform:scale(.88) rotate(-10deg); }
          38%{ transform:scale(1.12) rotate(6deg); }
          100%{ transform:scale(1) rotate(0); }
        }

        .gjsb-grade{
          margin-top:10px;
          display:inline-flex;
          align-items:center;
          justify-content:center;
          min-width:110px;
          padding:10px 16px;
          border-radius:999px;
          font-size:24px;
          font-weight:1000;
          background:#fff;
          border:3px solid #d7edf7;
          color:#5a6f80;
        }
        .gjsb-grade.s{ color:#a05a00; border-color:#ffe08a; background:#fff8db; }
        .gjsb-grade.a{ color:#45802d; border-color:#cfe9b8; background:#f7fff0; }
        .gjsb-grade.b{ color:#2d6f8b; border-color:#cdeeff; background:#f1fbff; }
        .gjsb-grade.c{ color:#8b6a53; border-color:#ead7c6; background:#fff8f3; }

        .gjsb-stars{
          font-size:30px;
          line-height:1;
          margin:10px 0 6px;
        }

        .gjsb-stars.victory-stars{
          animation:gjsbStarsPop .7s ease-out;
        }

        @keyframes gjsbStarsPop{
          0%{ letter-spacing:-6px; opacity:.2; transform:translateY(8px) scale(.94); }
          100%{ letter-spacing:0; opacity:1; transform:translateY(0) scale(1); }
        }

        .gjsb-victory-ribbon{
          margin:10px auto 0;
          display:inline-flex;
          align-items:center;
          justify-content:center;
          min-height:34px;
          padding:8px 14px;
          border-radius:999px;
          background:linear-gradient(180deg,#fff8dc,#fff2b8);
          border:2px solid #ffe08a;
          color:#9d6016;
          font-size:12px;
          font-weight:1000;
          box-shadow:0 8px 18px rgba(255,181,71,.12);
        }

        .gjsb-summary-grid{
          display:grid;
          grid-template-columns:repeat(2,minmax(0,1fr));
          gap:10px;
        }

        .gjsb-stat{
          border-radius:18px;
          background:#fff;
          border:3px solid #d7edf7;
          padding:12px;
        }

        .gjsb-stat .k{
          font-size:12px;
          color:#7b7a72;
          font-weight:1000;
        }

        .gjsb-stat .v{
          margin-top:6px;
          font-size:24px;
          font-weight:1000;
          line-height:1.2;
        }

        .gjsb-coach,
        .gjsb-nextHint,
        .gjsb-exportBox{
          margin-top:12px;
          border-radius:18px;
          background:linear-gradient(180deg,#fffef6,#fff);
          border:3px solid #d7edf7;
          padding:12px 14px;
          font-size:14px;
          line-height:1.5;
          color:#6b675f;
          font-weight:1000;
        }

        .gjsb-actions{
          display:grid;
          gap:10px;
          margin-top:16px;
        }

        .gjsb-btn{
          border:none;
          border-radius:18px;
          padding:14px 16px;
          font-size:16px;
          font-weight:1000;
          cursor:pointer;
          transition:transform .14s ease, box-shadow .14s ease;
          box-shadow:0 10px 18px rgba(86,155,194,.10);
        }
        .gjsb-btn:hover{ transform:translateY(-1px); }
        .gjsb-btn:active{ transform:translateY(0); }

        .gjsb-btn.replay{ background:linear-gradient(180deg,#7ed957,#58c33f); color:#173b0b; }
        .gjsb-btn.cooldown{ background:linear-gradient(180deg,#7fcfff,#58b7f5); color:#08374d; }
        .gjsb-btn.hub{ background:#fff; color:#6c6a61; border:3px solid #d7edf7; }

        .gjsb-confetti-layer{
          position:absolute;
          inset:0;
          overflow:hidden;
          pointer-events:none;
          z-index:81;
        }

        .gjsb-confetti{
          position:absolute;
          top:-18px;
          width:12px;
          height:18px;
          border-radius:4px;
          opacity:.95;
          animation:gjsbConfettiFall linear forwards;
          will-change:transform,opacity;
        }

        @keyframes gjsbConfettiFall{
          0%{ transform:translate3d(0,-10px,0) rotate(0deg); opacity:0; }
          10%{ opacity:1; }
          100%{ transform:translate3d(var(--dx, 0px), var(--dy, 110vh), 0) rotate(var(--rot, 540deg)); opacity:0; }
        }

        @media (max-width:720px){
          .gjsb-bar{
            grid-template-columns:repeat(3,minmax(0,1fr));
          }
          .gjsb-pill{
            min-height:28px;
            padding:4px 6px;
            font-size:10px;
          }
          .gjsb-utilBtn{
            flex:1 1 0;
            min-height:34px;
            border-radius:10px;
            font-size:10px;
            padding:6px 8px;
          }
          .gjsb-arenaOverlay{
            inset:92px 8px 116px 8px;
            gap:6px;
          }
          .gjsb-lane{
            border-radius:14px;
          }
          .gjsb-laneLabel{
            font-size:9px;
            min-height:20px;
            top:6px;
            left:6px;
            right:6px;
          }
          .gjsb-stageCue{
            top:24%;
            min-width:min(92vw,360px);
            padding:12px 14px;
          }
          .gjsb-stageCue .t{
            font-size:20px;
          }
          .gjsb-stageCue .s{
            font-size:12px;
          }
          .gjsb-boss{
            width:min(154px,42vw);
            right:8px;
            bottom:92px;
          }
          .gjsb-summary-grid{
            grid-template-columns:1fr;
          }
        }
      `;
      document.head.appendChild(style);
    }

    function buildUI() {
      mount.innerHTML = `
        <div id="${ROOT_ID}">
          <div class="gjsb-stage" id="gjsbStage">
            <div class="gjsb-cloud c1"></div>
            <div class="gjsb-cloud c2"></div>
            <div class="gjsb-cloud c3"></div>
            <div class="gjsb-ground"></div>

            <div class="gjsb-topHud">
              <div class="gjsb-bar">
                <div class="gjsb-pill" id="hudScore">Score • 0</div>
                <div class="gjsb-pill" id="hudTime">Time • 0:00</div>
                <div class="gjsb-pill" id="hudMiss">Miss • 0</div>
                <div class="gjsb-pill" id="hudStreak">Streak • 0</div>
                <div class="gjsb-pill" id="hudPhase">Phase • 1</div>
              </div>

              <div class="gjsb-banner" id="hudBanner">เริ่มเลย! เก็บอาหารดี แล้วหลีกเลี่ยง junk</div>

              <div class="gjsb-progressWrap">
                <div class="gjsb-progressFill" id="hudProgress"></div>
              </div>

              <div class="gjsb-utilRow">
                <button class="gjsb-utilBtn" id="btnPause" type="button">⏸ Pause</button>
                <button class="gjsb-utilBtn" id="btnMute" type="button">🔊 Sound</button>
              </div>
            </div>

            <div class="gjsb-arenaOverlay" id="arenaOverlay">
              <div class="gjsb-lane" data-lane="0"><div class="gjsb-laneLabel">ช่อง 1</div></div>
              <div class="gjsb-lane" data-lane="1"><div class="gjsb-laneLabel">ช่อง 2</div></div>
              <div class="gjsb-lane" data-lane="2"><div class="gjsb-laneLabel">ช่อง 3</div></div>
            </div>

            <div class="gjsb-stageCue" id="stageCue">
              <div class="k" id="stageCueK">ด่านบอส</div>
              <div class="t" id="stageCueT">Stage A • ฝึกก่อน</div>
              <div class="s" id="stageCueS">เป้าทองใหญ่ แตะให้ทัน</div>
            </div>

            <div class="gjsb-tutorial" id="tutorialOverlay">
              <div class="gjsb-tutorialCard">
                <div class="badge">GOODJUNK BOSS GUIDE</div>
                <h3>จำ 4 อย่างนี้ก่อนลุย</h3>
                <div class="gjsb-tutorialList">
                  <div class="gjsb-tutorialItem">🎯 <b>เป้าทอง</b> = แตะเพื่อตีบอส</div>
                  <div class="gjsb-tutorialItem">🍟 <b>ของลวง</b> = อย่าแตะ</div>
                  <div class="gjsb-tutorialItem">🟦 <b>ปลอดภัย</b> = ไปช่องนี้ก่อน</div>
                  <div class="gjsb-tutorialItem">🔥 <b>ช่วงสุดท้าย</b> = เป้าโผล่ไวมาก</div>
                </div>
                <div class="gjsb-tutorialActions">
                  <button class="gjsb-tutorialBtn primary" id="btnTutorialGo" type="button">🎮 เข้าใจแล้ว ลุยเลย</button>
                  <button class="gjsb-tutorialBtn soft" id="btnTutorialSkip" type="button">ข้ามครั้งนี้</button>
                </div>
              </div>
            </div>

            <div class="gjsb-boss" id="bossWrap">
              <div class="gjsb-boss-card" id="bossCard">
                <div class="gjsb-boss-head">
                  <div class="gjsb-boss-icon" id="bossIcon">🍔</div>
                  <div>
                    <div class="gjsb-boss-title">Junk King</div>
                    <div class="gjsb-boss-sub" id="bossPatternText">แตะเป้าทองให้ทัน</div>
                  </div>
                </div>

                <div class="gjsb-boss-stage" id="bossStageText">Stage A • ฝึกก่อน</div>
                <div class="gjsb-patternChip" id="bossPatternChip">เป้าทอง</div>
                <div class="gjsb-rageBadge" id="bossRageBadge">🔥 Rage Finale</div>

                <div class="gjsb-boss-bar">
                  <div class="gjsb-boss-fill" id="bossHpFill"></div>
                </div>
                <div class="gjsb-boss-hp" id="bossHpText">HP 0 / 0</div>
              </div>
            </div>

            <div class="gjsb-finisherFlash" id="finisherFlash"></div>

            <div class="gjsb-pause" id="pauseOverlay">
              <div class="gjsb-pauseCard">
                <div class="gjsb-pauseTitle">พักก่อนนะ</div>
                <div class="gjsb-pauseSub" id="pauseSub">เกมถูกหยุดไว้ชั่วคราว กดเล่นต่อได้เมื่อพร้อม</div>

                <div class="gjsb-pauseActions">
                  <button class="gjsb-pauseBtn resume" id="btnResume" type="button">▶️ เล่นต่อ</button>
                  <button class="gjsb-pauseBtn hub" id="btnPauseHub" type="button">🏠 กลับ HUB</button>
                </div>
              </div>
            </div>

            <div class="gjsb-summary" id="summary">
              <div class="gjsb-summary-card" id="summaryCard">
                <div class="gjsb-summary-head">
                  <div class="gjsb-medal" id="sumMedal">🥈</div>
                  <div class="gjsb-grade b" id="sumGrade">B</div>
                  <h2 id="sumTitle" style="margin:8px 0 0;font-size:38px;line-height:1.05;color:#67a91c;">Great Job!</h2>
                  <div id="sumSub" style="margin-top:6px;font-size:15px;color:#7b7a72;font-weight:1000;">มาดูผลการเล่นรอบนี้กัน</div>
                  <div class="gjsb-stars" id="sumStars">⭐</div>
                </div>

                <div class="gjsb-summary-grid" id="sumGrid"></div>
                <div class="gjsb-coach" id="sumCoach">เก่งมาก ลองต่ออีกนิดนะ</div>
                <div class="gjsb-nextHint" id="sumNextHint">เป้าหมายต่อไป: ไปให้ถึงบอสให้เร็วขึ้น</div>
                <div class="gjsb-exportBox" id="sumExportBox">payload พร้อม export หลังจบเกม</div>

                <div class="gjsb-actions">
                  <button class="gjsb-btn replay" id="btnReplay">🔁 เล่นใหม่</button>
                  <button class="gjsb-btn cooldown" id="btnCooldown">🧊 ไป Cooldown</button>
                  <button class="gjsb-btn hub" id="btnCopyJson">📋 คัดลอก JSON</button>
                  <button class="gjsb-btn hub" id="btnHub">🏠 กลับ HUB</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;

      return {
        root: document.getElementById(ROOT_ID),
        stage: document.getElementById('gjsbStage'),
        score: document.getElementById('hudScore'),
        time: document.getElementById('hudTime'),
        miss: document.getElementById('hudMiss'),
        streak: document.getElementById('hudStreak'),
        phase: document.getElementById('hudPhase'),
        progress: document.getElementById('hudProgress'),
        banner: document.getElementById('hudBanner'),

        btnPause: document.getElementById('btnPause'),
        btnMute: document.getElementById('btnMute'),

        arenaOverlay: document.getElementById('arenaOverlay'),
        arenaLanes: Array.from(document.querySelectorAll('#arenaOverlay .gjsb-lane')),

        stageCue: document.getElementById('stageCue'),
        stageCueK: document.getElementById('stageCueK'),
        stageCueT: document.getElementById('stageCueT'),
        stageCueS: document.getElementById('stageCueS'),

        tutorialOverlay: document.getElementById('tutorialOverlay'),
        btnTutorialGo: document.getElementById('btnTutorialGo'),
        btnTutorialSkip: document.getElementById('btnTutorialSkip'),

        bossWrap: document.getElementById('bossWrap'),
        bossCard: document.getElementById('bossCard'),
        bossIcon: document.getElementById('bossIcon'),
        bossPatternText: document.getElementById('bossPatternText'),
        bossStageText: document.getElementById('bossStageText'),
        bossPatternChip: document.getElementById('bossPatternChip'),
        bossRageBadge: document.getElementById('bossRageBadge'),
        bossHpText: document.getElementById('bossHpText'),
        bossHpFill: document.getElementById('bossHpFill'),

        finisherFlash: document.getElementById('finisherFlash'),

        pauseOverlay: document.getElementById('pauseOverlay'),
        pauseSub: document.getElementById('pauseSub'),
        btnResume: document.getElementById('btnResume'),
        btnPauseHub: document.getElementById('btnPauseHub'),

        summary: document.getElementById('summary'),
        summaryCard: document.getElementById('summaryCard'),
        sumMedal: document.getElementById('sumMedal'),
        sumGrade: document.getElementById('sumGrade'),
        sumTitle: document.getElementById('sumTitle'),
        sumSub: document.getElementById('sumSub'),
        sumStars: document.getElementById('sumStars'),
        sumGrid: document.getElementById('sumGrid'),
        sumCoach: document.getElementById('sumCoach'),
        sumNextHint: document.getElementById('sumNextHint'),
        sumExportBox: document.getElementById('sumExportBox'),
        btnReplay: document.getElementById('btnReplay'),
        btnCooldown: document.getElementById('btnCooldown'),
        btnCopyJson: document.getElementById('btnCopyJson'),
        btnHub: document.getElementById('btnHub')
      };
    }

    function setBanner(text, ms) {
      if (!ui || !ui.banner) return;
      ui.banner.textContent = text;
      ui.banner.classList.add('show');

      if (setBanner._t) {
        try { clearTimeout(setBanner._t); } catch (_) {}
        state.runtime.timers.delete(setBanner._t);
      }

      setBanner._t = safeTimeout(() => {
        if (ui && ui.banner) ui.banner.classList.remove('show');
      }, ms || 900);
    }

    function strongBanner(text, ms) {
      if (!ui || !ui.banner) return;
      setBanner(text, ms || 820);
      ui.banner.classList.remove('kill');
      void ui.banner.offsetWidth;
      ui.banner.classList.add('kill');
      safeTimeout(() => {
        if (ui && ui.banner) ui.banner.classList.remove('kill');
      }, 420);
    }

    function showStageCue(title, subtitle, kicker) {
      if (!ui || !ui.stageCue) return;

      ui.stageCueK.textContent = kicker || 'ด่านบอส';
      ui.stageCueT.textContent = title || '';
      ui.stageCueS.textContent = subtitle || '';
      ui.stageCue.classList.remove('show');
      void ui.stageCue.offsetWidth;
      ui.stageCue.classList.add('show');

      if (showStageCue._t) {
        try { clearTimeout(showStageCue._t); } catch (_) {}
        state.runtime.timers.delete(showStageCue._t);
      }

      showStageCue._t = safeTimeout(() => {
        if (ui && ui.stageCue) ui.stageCue.classList.remove('show');
      }, 1400);
    }

    function showTutorialOverlay() {
      if (!ui || !ui.tutorialOverlay) return;
      ui.tutorialOverlay.classList.add('show');
      pauseGame('manual');
    }

    function hideTutorialOverlay() {
      if (!ui || !ui.tutorialOverlay) return;
      ui.tutorialOverlay.classList.remove('show');
      markDailyTutorialSeen();
      resumeGame();
    }

    function fx(x, y, text, color) {
      const el = document.createElement('div');
      el.className = 'gjsb-fx';
      el.textContent = text;
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      el.style.color = color || '#333';
      ui.stage.appendChild(el);
      safeTimeout(() => { try { el.remove(); } catch (_) {} }, 760);
    }

    function stageHitStop(ms) {
      if (!ui || !ui.stage) return;
      ui.stage.classList.remove('hitstop');
      void ui.stage.offsetWidth;
      ui.stage.classList.add('hitstop');

      safeTimeout(() => {
        if (ui && ui.stage) ui.stage.classList.remove('hitstop');
      }, ms || 90);
    }

    function bossHurtPulse() {
      if (!ui || !ui.bossCard) return;
      ui.bossCard.classList.remove('hurt');
      void ui.bossCard.offsetWidth;
      ui.bossCard.classList.add('hurt');

      safeTimeout(() => {
        if (ui && ui.bossCard) ui.bossCard.classList.remove('hurt');
      }, 320);
    }

    function flashFinisher() {
      if (!ui || !ui.finisherFlash) return;
      ui.finisherFlash.classList.remove('show');
      void ui.finisherFlash.offsetWidth;
      ui.finisherFlash.classList.add('show');

      safeTimeout(() => {
        if (ui && ui.finisherFlash) ui.finisherFlash.classList.remove('show');
      }, 760);
    }

    function pulseScorePill() {
      if (!ui || !ui.score) return;
      ui.score.classList.remove('emph');
      void ui.score.offsetWidth;
      ui.score.classList.add('emph');

      safeTimeout(() => {
        if (ui && ui.score) ui.score.classList.remove('emph');
      }, 320);
    }

    function spawnWeakTrail(item) {
      if (!ui || !ui.stage || !item || item.dead) return;
      const trail = document.createElement('div');
      trail.className = 'gjsb-trail';
      trail.style.left = item.x + 'px';
      trail.style.top = item.y + 'px';
      trail.style.width = item.size + 'px';
      trail.style.height = item.size + 'px';
      trail.style.background =
        item.bossPattern === 'burst'
          ? 'linear-gradient(180deg,rgba(255,190,122,.42),rgba(255,255,255,.10))'
          : item.bossPattern === 'pressure'
            ? 'linear-gradient(180deg,rgba(255,160,160,.34),rgba(255,255,255,.08))'
            : item.bossPattern === 'trick'
              ? 'linear-gradient(180deg,rgba(255,183,234,.32),rgba(255,255,255,.08))'
              : 'linear-gradient(180deg,rgba(255,224,138,.32),rgba(255,255,255,.08))';

      ui.stage.appendChild(trail);
      safeTimeout(() => {
        try { trail.remove(); } catch (_) {}
      }, 320);
    }

    function updateRageVignette() {
      if (!ui || !ui.stage) return;
      ui.stage.classList.toggle('rage-vignette', !!state.boss.rage);
    }

    function addSummaryRibbon(text) {
      if (!ui || !ui.summaryCard) return;

      let ribbon = ui.summaryCard.querySelector('.gjsb-victory-ribbon');
      if (!ribbon) {
        ribbon = document.createElement('div');
        ribbon.className = 'gjsb-victory-ribbon';
        const head = ui.summaryCard.querySelector('.gjsb-summary-head');
        if (head) head.appendChild(ribbon);
      }
      ribbon.textContent = text;
    }

    function setSummaryCardTheme(grade) {
      if (!ui || !ui.summaryCard) return;
      ui.summaryCard.classList.remove('grade-s', 'grade-a', 'grade-b', 'grade-c');
      ui.summaryCard.classList.add('grade-' + String(grade || 'b').toLowerCase());
    }

    function burstMedalAndStars() {
      if (ui && ui.sumMedal) {
        ui.sumMedal.classList.remove('victory-burst');
        void ui.sumMedal.offsetWidth;
        ui.sumMedal.classList.add('victory-burst');
      }

      if (ui && ui.sumStars) {
        ui.sumStars.classList.remove('victory-stars');
        void ui.sumStars.offsetWidth;
        ui.sumStars.classList.add('victory-stars');
      }
    }

    function spawnVictoryConfetti(count) {
      if (!ui || !ui.summary) return;

      let layer = ui.summary.querySelector('.gjsb-confetti-layer');
      if (!layer) {
        layer = document.createElement('div');
        layer.className = 'gjsb-confetti-layer';
        ui.summary.appendChild(layer);
      }
      layer.innerHTML = '';

      const total = Math.max(16, count || 26);
      const colors = ['#ffd45c', '#7ed957', '#7fcfff', '#ff9fc7', '#ffb547', '#caa7ff'];

      for (let i = 0; i < total; i++) {
        const piece = document.createElement('div');
        piece.className = 'gjsb-confetti';
        piece.style.left = runRange(2, 96) + '%';
        piece.style.background = colors[i % colors.length];
        piece.style.setProperty('--dx', runRange(-120, 120).toFixed(0) + 'px');
        piece.style.setProperty('--dy', runRange(300, 760).toFixed(0) + 'px');
        piece.style.setProperty('--rot', runRange(280, 880).toFixed(0) + 'deg');
        piece.style.animationDuration = runRange(1.6, 2.7).toFixed(2) + 's';
        piece.style.animationDelay = runRange(0, 0.25).toFixed(2) + 's';
        layer.appendChild(piece);
      }

      safeTimeout(() => {
        try { layer.innerHTML = ''; } catch (_) {}
      }, 3200);
    }

    function runVictoryPolish(bossClear, grade) {
      if (!ui || !ui.stage) return;

      ui.stage.classList.add('victory-lock', 'victory-flash', 'victory-shake');
      safeTimeout(() => {
        if (ui && ui.stage) ui.stage.classList.remove('victory-flash');
      }, 760);
      safeTimeout(() => {
        if (ui && ui.stage) ui.stage.classList.remove('victory-shake');
      }, 420);

      setSummaryCardTheme(grade);
      burstMedalAndStars();

      if (bossClear && state.boss.rageTriggered) {
        addSummaryRibbon('🔥 Rage Finale Clear');
        spawnVictoryConfetti(34);
      } else if (bossClear) {
        addSummaryRibbon('👑 Boss Clear');
        spawnVictoryConfetti(26);
      } else {
        addSummaryRibbon('⭐ Great Try');
        spawnVictoryConfetti(18);
      }
    }

    function getArenaBounds() {
      const r = stageRect();
      const left = 10;
      const right = r.width - 10;
      const top = Math.max(118, r.height * 0.22);
      const bottom = Math.max(top + 20, r.height - 150);
      const width = right - left;
      const laneW = width / state.arena.lanes;
      return { left, right, top, bottom, width, laneW };
    }

    function getSafeSpawnBounds(itemSize) {
      const r = stageRect();

      const topHudBottom = 96;
      const bossReservedRight = state.boss.active ? Math.min(220, r.width * 0.34) : 0;

      const left = 10;
      const right = Math.max(left + 80, r.width - itemSize - 10 - bossReservedRight);
      const top = Math.max(112, topHudBottom + 8);
      const bottom = Math.max(top + 60, r.height - itemSize - 138);

      return { left, right, top, bottom };
    }

    function getLaneRect(laneIndex) {
      const b = getArenaBounds();
      const lane = clamp(laneIndex, 0, state.arena.lanes - 1);
      const x1 = b.left + lane * b.laneW;
      const x2 = x1 + b.laneW;
      return {
        left: x1,
        right: x2,
        top: b.top,
        bottom: b.bottom,
        width: x2 - x1,
        height: b.bottom - b.top
      };
    }

    function pickLaneCenterX(laneIndex, itemSize) {
      const rect = getLaneRect(laneIndex);
      const margin = Math.max(14, itemSize * 0.18);
      const minX = rect.left + margin;
      const maxX = rect.right - itemSize - margin;
      return clamp(runRange(minX, maxX), minX, maxX);
    }

    function updateLaneCueLabels() {
      if (!ui || !ui.arenaLanes) return;

      ui.arenaLanes.forEach((laneEl, idx) => {
        const label = laneEl.querySelector('.gjsb-laneLabel');
        if (!label) return;

        if (state.arena.sweepingLanes.indexOf(idx) >= 0) {
          label.innerHTML = 'อันตราย<span class="cue">หลบ!</span>';
        } else if (state.arena.safeLane === idx && state.boss.active && (state.boss.stage === 'C' || state.boss.rage)) {
          label.innerHTML = 'ปลอดภัย<span class="cue">มาช่องนี้</span>';
        } else if (state.arena.warnedLanes.indexOf(idx) >= 0) {
          label.innerHTML = 'เตือน<span class="cue">เตรียมย้าย</span>';
        } else {
          label.innerHTML = 'ช่อง ' + (idx + 1);
        }
      });
    }

    function renderArenaOverlay() {
      if (!ui || !ui.arenaLanes || !ui.arenaLanes.length) return;

      if (ui && ui.summary && ui.summary.classList.contains('show')) {
        if (ui.arenaOverlay) ui.arenaOverlay.style.display = 'none';
        return;
      }

      const showArena = state.boss.active && (state.boss.stage === 'C' || state.boss.rage);
      if (ui.arenaOverlay) ui.arenaOverlay.style.display = showArena ? 'grid' : 'none';

      ui.arenaLanes.forEach((laneEl, idx) => {
        laneEl.classList.toggle('warn', state.arena.warnedLanes.indexOf(idx) >= 0);
        laneEl.classList.toggle('safe', state.arena.safeLane === idx && showArena);
        laneEl.classList.toggle('sweep', state.arena.sweepingLanes.indexOf(idx) >= 0);
      });

      updateLaneCueLabels();
    }

    function clearArenaPressure() {
      state.arena.telegraphMs = 0;
      state.arena.sweepMs = 0;
      state.arena.warnedLanes = [];
      state.arena.sweepingLanes = [];
      state.arena.lastPattern = '';
      renderArenaOverlay();
    }

    function startArenaTelegraph(patternName) {
      const lanes = [0, 1, 2];
      state.arena.active = true;
      state.arena.lastPattern = patternName || 'sweep';
      state.arena.safeLane = chooseSafeLaneSmart();

      if (patternName === 'fake-sweep') {
        state.arena.warnedLanes = lanes.slice();
      } else {
        state.arena.warnedLanes = lanes.filter((x) => x !== state.arena.safeLane);
      }

      state.arena.telegraphMs = state.boss.rage ? 520 : 760;
      state.arena.sweepMs = 0;
      state.arena.sweepingLanes = [];
      renderArenaOverlay();
    }

    function beginArenaSweep() {
      state.arena.telegraphMs = 0;
      state.arena.sweepMs = state.boss.rage ? 700 : 980;
      state.arena.sweepingLanes = state.arena.warnedLanes.slice();
      renderArenaOverlay();
      spawnSweepJunk();
    }

    function spawnSweepJunk() {
      const sweepLanes = state.arena.sweepingLanes.slice();
      if (!sweepLanes.length) return;

      sweepLanes.forEach((laneIndex) => {
        const rect = getLaneRect(laneIndex);
        const count = state.boss.rage ? 3 : 2;

        for (let i = 0; i < count; i++) {
          const size = runRange(42, 60);
          const x = clamp(
            runRange(rect.left + 10, rect.right - size - 10),
            rect.left + 8,
            rect.right - size - 8
          );
          const y = -size - runRange(0, 50) - i * 26;
          const tune = getDiffTuning();
          const vx = runRange(-24, 24) * tune.stormSpeedMul;
          const vy = (state.boss.rage ? runRange(320, 430) : runRange(240, 340)) * tune.stormSpeedMul;

          const storm = createItem(
            'storm',
            JUNK[Math.floor(runRand() * JUNK.length)],
            x,
            y,
            size,
            vx,
            vy,
            'sweep'
          );
          storm.lifeMax = 2600;
        }
      });
    }

    function drawItem(item) {
      item.el.style.left = item.x + 'px';
      item.el.style.top = item.y + 'px';
    }

    function createItem(kind, emoji, x, y, size, vx, vy, label) {
      const id = 'it-' + (++state.seq);
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'gjsb-item ' + kind;
      el.style.width = size + 'px';
      el.style.height = size + 'px';
      el.innerHTML =
        '<div class="gjsb-emoji">' + emoji + '</div>' +
        '<div class="gjsb-tag">' + (label || kind) + '</div>';

      ui.stage.appendChild(el);

      const item = {
        id,
        kind,
        emoji,
        x,
        y,
        size,
        vx,
        vy,
        el,
        dead: false,
        baseX: x,
        baseY: y,
        lifeMs: 0,
        lifeMax: 0,
        dir: runRand() < 0.5 ? -1 : 1,
        bossPattern: '',
        bossStageKey: '',
        damage: 0,
        nextFlipAt: 0,
        verticalTarget: y,
        baited: false
      };

      el.addEventListener('pointerdown', function (ev) {
        ev.preventDefault();
        onHit(item);
      }, { passive: false });

      state.items.set(id, item);
      drawItem(item);
      return item;
    }

    function removeItem(item) {
      if (!item || item.dead) return;
      item.dead = true;
      try { item.el.remove(); } catch (_) {}
      state.items.delete(item.id);
      if (state.boss.weakId === item.id) state.boss.weakId = '';
    }

    function clearItems() {
      state.items.forEach((item) => removeItem(item));
      state.items.clear();
      state.boss.weakId = '';
    }

    function clearCurrentWeak() {
      if (!state.boss.weakId) return;
      const weak = state.items.get(state.boss.weakId);
      if (weak) removeItem(weak);
      state.boss.weakId = '';
    }

    function spawnFood(phase) {
      const tune = getDiffTuning();
      const phase2 = phase === 2;

      const goodRatioBase = phase2 ? 0.70 : 0.78;
      const goodRatio = clamp(
        goodRatioBase + (phase2 ? tune.goodRatioBonusP2 : tune.goodRatioBonusP1),
        0.56,
        0.88
      );

      const isGood = runRand() < goodRatio;
      const size = phase2 ? runRange(52, 78) : runRange(58, 86);

      const safe = getSafeSpawnBounds(size);
      const x = clamp(runRange(safe.left, safe.right), safe.left, safe.right);
      const y = -size - runRange(0, 30);

      const vx = runRange(-35, 35) * tune.phaseFoodSpeedMul;
      const vy = (phase2 ? runRange(170, 270) : runRange(120, 190)) * tune.phaseFoodSpeedMul;

      createItem(
        isGood ? 'good' : 'junk',
        isGood ? GOOD[Math.floor(runRand() * GOOD.length)] : JUNK[Math.floor(runRand() * JUNK.length)],
        x,
        y,
        size,
        vx,
        vy,
        isGood ? 'good' : 'junk'
      );
    }

    function spawnJunkBaitNear(weak) {
      if (!weak || weak.dead) return;
      const r = stageRect();
      const size = clamp(weak.size * 0.78, 42, 64);
      const x = clamp(weak.x + runRange(-72, 72), 8, r.width - size - 8);
      const y = clamp(weak.y + runRange(-42, 42), 110, r.height - size - 120);

      const bait = createItem(
        'junk',
        JUNK[Math.floor(runRand() * JUNK.length)],
        x,
        y,
        size,
        runRange(-18, 18),
        runRange(40, 85),
        'bait'
      );
      bait.el.classList.add('bait');
      bait.lifeMax = 1100;
      return bait;
    }

    function getBossStageConfig() {
      const variant = state.replay.sessionVariant || 'balanced';
      const tune = getDiffTuning();

      if (state.boss.rage) {
        const mobileMul = window.innerWidth < 720 ? 0.92 : 1;
        return {
          key: 'RAGE',
          label: 'Rage Finale',
          uiLabel: 'Rage Finale',
          weakSize: Math.round((variant === 'fast-weak' ? 54 : 58) * tune.weakSizeMul),
          weakEvery: ((variant === 'storm-heavy' ? 520 : 560) * tune.weakEveryMul) / mobileMul,
          stormEvery: ((variant === 'storm-heavy' ? 820 : 920) * tune.stormEveryMul) / mobileMul,
          weakLifeMs: (variant === 'fast-weak' ? 900 : 980) * tune.weakLifeMul,
          weakSpeedX: (variant === 'fast-weak' ? 265 : 245) * tune.weakSpeedMul,
          weakSpeedY: 20 * tune.weakSpeedMul,
          damage: 3,
          baitChance: Math.min(0.32, (variant === 'bait-heavy' ? 0.16 : 0.10) * tune.baitChanceMul),
          patternCycle: ['burst', 'storm', 'burst'],
          patternDuration: diffKey === 'easy' ? 1020 : diffKey === 'hard' ? 900 : 950
        };
      }

      if (state.boss.stage === 'A') {
        return {
          key: 'A',
          label: 'Stage A • Learn',
          uiLabel: 'Stage A • Learn',
          weakSize: Math.round(96 * tune.weakSizeMul),
          weakEvery: 1180 * tune.weakEveryMul,
          stormEvery: 2600 * tune.stormEveryMul,
          weakLifeMs: 2200 * tune.weakLifeMul,
          weakSpeedX: 110 * tune.weakSpeedMul,
          weakSpeedY: 10 * tune.weakSpeedMul,
          damage: 2,
          baitChance: 0,
          patternCycle: ['hunt'],
          patternDuration: diffKey === 'easy' ? 1500 : diffKey === 'hard' ? 1280 : 1400
        };
      }

      if (state.boss.stage === 'B') {
        return {
          key: 'B',
          label: 'Stage B • Trick',
          uiLabel: 'Stage B • Trick',
          weakSize: Math.round((variant === 'fast-weak' ? 76 : 80) * tune.weakSizeMul),
          weakEvery: (variant === 'fast-weak' ? 880 : 960) * tune.weakEveryMul,
          stormEvery: (variant === 'storm-heavy' ? 1550 : 1850) * tune.stormEveryMul,
          weakLifeMs: (variant === 'fast-weak' ? 1450 : 1650) * tune.weakLifeMul,
          weakSpeedX: (variant === 'fast-weak' ? 188 : 170) * tune.weakSpeedMul,
          weakSpeedY: 14 * tune.weakSpeedMul,
          damage: 2,
          baitChance: Math.min(0.72, (variant === 'bait-heavy' ? 0.62 : 0.42) * tune.baitChanceMul),
          patternCycle: ['hunt', 'trick', 'storm'],
          patternDuration: diffKey === 'easy' ? 1180 : diffKey === 'hard' ? 980 : 1050
        };
      }

      return {
        key: 'C',
        label: 'Stage C • Pressure',
        uiLabel: 'Stage C • Pressure',
        weakSize: Math.round((variant === 'fast-weak' ? 60 : 66) * tune.weakSizeMul),
        weakEvery: (variant === 'fast-weak' ? 680 : 760) * tune.weakEveryMul,
        stormEvery: (variant === 'storm-heavy' ? 980 : 1180) * tune.stormEveryMul,
        weakLifeMs: (variant === 'fast-weak' ? 980 : 1200) * tune.weakLifeMul,
        weakSpeedX: (variant === 'fast-weak' ? 245 : 220) * tune.weakSpeedMul,
        weakSpeedY: 18 * tune.weakSpeedMul,
        damage: 2,
        baitChance: Math.min(0.48, (variant === 'bait-heavy' ? 0.36 : 0.25) * tune.baitChanceMul),
        patternCycle: ['pressure', 'storm', 'hunt'],
        patternDuration: diffKey === 'easy' ? 980 : diffKey === 'hard' ? 780 : 850
      };
    }

    function getPatternLabel(pattern) {
      return getChildPatternLabel(pattern);
    }

    function getPatternSub(pattern) {
      return getChildPatternHint(pattern);
    }

    function spawnWeakTarget() {
      if (!state.boss.active || state.boss.weakId) return;

      const r = stageRect();
      const stageCfg = getBossStageConfig();
      const pattern = state.boss.pattern || 'hunt';

      const minX = Math.max(80, r.width * 0.18);
      const maxX = Math.max(minX + 30, r.width - stageCfg.weakSize - 80);
      const minY = Math.max(118, r.height * 0.22);
      const maxY = Math.max(minY + 30, r.height * 0.54);

      let x;
      if (state.boss.active && (state.boss.stage === 'C' || state.boss.rage)) {
        x = pickLaneCenterX(state.arena.safeLane, stageCfg.weakSize);
      } else {
        x = clamp(runRange(minX, maxX), minX, maxX);
      }
      const y = clamp(runRange(minY, maxY), minY, maxY);

      const speedMul =
        pattern === 'burst' ? 1.18 :
        pattern === 'pressure' ? 1.08 :
        pattern === 'trick' ? 1.02 : 1;

      const item = createItem(
        'weak',
        pattern === 'burst' ? '⚡' : '🎯',
        x,
        y,
        stageCfg.weakSize,
        stageCfg.weakSpeedX * speedMul * (runRand() < 0.5 ? -1 : 1),
        runRange(-stageCfg.weakSpeedY, stageCfg.weakSpeedY),
        'weak'
      );

      item.lifeMax = stageCfg.weakLifeMs;
      item.bossPattern = pattern;
      item.bossStageKey = stageCfg.key;
      item.damage = stageCfg.damage;
      item.verticalTarget = y;
      item.nextFlipAt =
        pattern === 'trick' ? 280 :
        pattern === 'burst' ? 180 :
        pattern === 'pressure' ? 340 : 0;

      item.el.classList.add('hunt');
      if (pattern === 'trick') {
        item.el.classList.remove('hunt');
        item.el.classList.add('trick');
      }
      if (pattern === 'pressure') {
        item.el.classList.remove('hunt');
        item.el.classList.add('pressure');
      }
      if (pattern === 'burst') {
        item.el.classList.remove('hunt');
        item.el.classList.add('burst');
      }

      const tag = item.el.querySelector('.gjsb-tag');
      if (tag) {
        tag.textContent = getChildPatternText(pattern);
        tag.className = 'gjsb-tag ' + (
          pattern === 'trick' ? 'pattern-trick' :
          pattern === 'pressure' ? 'pattern-pressure' :
          pattern === 'burst' ? 'pattern-burst' :
          'pattern-hunt'
        );
      }

      state.boss.weakId = item.id;

      if (stageCfg.baitChance > 0 && runRand() < stageCfg.baitChance) {
        spawnJunkBaitNear(item);
        item.baited = true;
      }

      if (DEBUG) {
        console.log('[GJSB weak spawn]', {
          x: item.x,
          y: item.y,
          size: item.size,
          stage: state.boss.stage,
          rage: state.boss.rage,
          pattern: pattern
        });
      }
    }

    function spawnStorm() {
      if (!state.boss.active) return;

      const tune = getDiffTuning();
      const size = runRange(44, 62);
      const safe = getSafeSpawnBounds(size);
      const x = clamp(runRange(safe.left, safe.right), safe.left, safe.right);
      const y = -size - runRange(0, 20);
      const vx = runRange(-60, 60) * tune.stormSpeedMul;
      const vy = (state.boss.rage ? runRange(300, 400) : runRange(220, 320)) * tune.stormSpeedMul;

      const storm = createItem(
        'storm',
        JUNK[Math.floor(runRand() * JUNK.length)],
        x,
        y,
        size,
        vx,
        vy,
        'storm'
      );
      storm.lifeMax = 2600;
    }

    function getBossStageByHp() {
      const ratio = state.boss.hp / state.boss.maxHp;
      if (ratio > 0.66) return 'A';
      if (ratio > 0.33) return 'B';
      return 'C';
    }

    function setBossStage(nextStage) {
      if (state.boss.stage === nextStage) return;
      state.boss.stage = nextStage;
      state.boss.stageReached = nextStage;
      state.metrics.stageShiftCount += 1;
      state.boss.patternClock = 0;
      state.boss.weakTimer = 9999;
      clearCurrentWeak();
      strongBanner(
        nextStage === 'B'
          ? 'Stage B • เป้าหลอก'
          : nextStage === 'C'
            ? 'Stage C • ช่วงรีบ'
            : 'Stage A • ฝึกก่อน',
        1100
      );
      showStageCue(
        getChildStageTitle(nextStage),
        getChildStageHint(nextStage),
        'ด่านบอส'
      );
      playSfx('phase');
    }

    function enterRageFinale() {
      if (state.boss.rageTriggered) return;
      state.boss.rageTriggered = true;
      state.boss.rage = true;
      state.boss.stageReached = 'RAGE';
      state.boss.patternClock = 0;
      state.boss.weakTimer = 9999;
      clearCurrentWeak();
      strongBanner('🔥 Rage Finale!', 1200);
      showStageCue(getChildStageTitle('RAGE'), getChildStageHint('RAGE'), 'ช่วงสุดท้าย');
      playSfx('phase');
      pushEvent('boss_rage', { hp: state.boss.hp });
    }

    function setBossPattern(nextPattern) {
      if (state.boss.pattern === nextPattern) return;
      state.boss.pattern = nextPattern;
      state.metrics.patternShiftCount += 1;
      pushReplayPattern(nextPattern);
      clearCurrentWeak();
      state.boss.weakTimer = 9999;

      strongBanner(getPatternLabel(nextPattern) + ' • ' + getPatternSub(nextPattern), 850);
      if (nextPattern === 'trick' || nextPattern === 'pressure' || nextPattern === 'burst') {
        showStageCue(
          getChildPatternLabel(nextPattern),
          getChildPatternHint(nextPattern),
          'รูปแบบบอส'
        );
      }

      pushEvent('boss_pattern', {
        stage: state.boss.rage ? 'RAGE' : state.boss.stage,
        pattern: nextPattern
      });
    }

    function updateBossUi() {
      if (!state.boss.active) {
        ui.bossWrap.classList.remove('show');
        return;
      }

      ui.bossWrap.classList.add('show');
      ui.bossCard.classList.toggle('rage', !!state.boss.rage);
      ui.bossRageBadge.classList.toggle('show', !!state.boss.rage);

      ui.bossIcon.textContent = state.boss.rage ? '👹' : '🍔';
      ui.bossStageText.textContent = getChildStageTitle(state.boss.rage ? 'RAGE' : state.boss.stage);
      ui.bossPatternChip.textContent = getPatternLabel(state.boss.pattern);
      ui.bossPatternText.textContent = getPatternSub(state.boss.pattern);

      ui.bossHpText.textContent = 'HP ' + state.boss.hp + ' / ' + state.boss.maxHp;
      ui.bossHpFill.style.transform = 'scaleX(' + clamp(state.boss.hp / state.boss.maxHp, 0, 1) + ')';
    }

    function renderHud() {
      const narrow = window.innerWidth < 720;

      ui.score.textContent = narrow ? ('🪙 ' + state.score) : ('Score • ' + state.score);
      ui.time.textContent = narrow ? ('⏱ ' + fmtTime(state.timeLeft)) : ('Time • ' + fmtTime(state.timeLeft));
      ui.miss.textContent = narrow ? ('⚠️ ' + state.miss) : ('Miss • ' + state.miss);
      ui.streak.textContent = narrow ? ('🔥 ' + state.streak) : ('Streak • ' + state.streak);

      if (state.boss.active) {
        ui.phase.textContent = narrow
          ? ('🦹 ' + (state.boss.rage ? 'Rage' : state.boss.stage))
          : ('Boss • ' + (state.boss.rage ? 'Rage' : state.boss.stage));
      } else {
        ui.phase.textContent = narrow ? ('⭐ ' + state.phase) : ('Phase • ' + state.phase);
      }

      ui.progress.style.transform = 'scaleX(' + clamp(state.timeLeft / state.timeTotal, 0, 1) + ')';

      ui.btnMute.textContent = state.muted ? '🔇 Mute' : '🔊 Sound';
      ui.btnMute.classList.toggle('active', !state.muted);

      updateBossUi();
      updateRageVignette();
      renderArenaOverlay();
    }

    function onHit(item) {
      if (!state.running || state.ended || state.paused || !item || item.dead) return;

      const cx = item.x + item.size / 2;
      const cy = item.y + item.size / 2;

      if (item.kind === 'good') {
        const tune = getDiffTuning();
        state.hitsGood += 1;
        state.streak += 1;
        state.bestStreak = Math.max(state.bestStreak, state.streak);

        const bonus = Math.min(10, Math.floor(state.streak / 3) * 2);
        const gain = cfg.scoreGood + bonus + tune.scoreGoodBonus;
        state.score += gain;

        fx(cx, cy, '+' + gain, '#2f8f2f');
        playSfx('good');
        if (state.streak === 3 || state.streak === 5 || state.streak === 8) {
          setBanner('คอมโบดีมาก!', 720);
        }
        removeItem(item);
      } else if (item.kind === 'junk' || item.kind === 'storm') {
        const tune = getDiffTuning();
        state.hitsBad += 1;
        state.miss += 1;
        state.streak = 0;
        state.score = Math.max(0, state.score - Math.round(cfg.penaltyJunk * tune.junkPenaltyMul));

        if (item.kind === 'storm') state.stormHits += 1;
        if (item.el.classList.contains('bait')) state.baitHits += 1;

        stageHitStop(55);
        fx(cx, cy, item.el.classList.contains('bait') ? 'BAIT!' : 'MISS', '#d16b27');
        playSfx('bad');
        strongBanner(
          item.el.classList.contains('bait')
            ? 'โดน bait หลอก!'
            : item.kind === 'storm'
              ? 'โดน Junk Storm!'
              : 'ระวัง junk!',
          720
        );
        removeItem(item);
      } else if (item.kind === 'weak') {
        state.powerHits += 1;
        state.streak += 1;
        state.bestStreak = Math.max(state.bestStreak, state.streak);

        const damage = item.damage || getBossStageConfig().damage;
        state.boss.hp = Math.max(0, state.boss.hp - damage);
        state.score += damage >= 3 ? 30 : 22;

        stageHitStop(item.bossPattern === 'burst' ? 105 : 80);
        bossHurtPulse();
        pulseScorePill();

        fx(
          cx,
          cy,
          item.bossPattern === 'burst'
            ? 'BURST!'
            : item.bossPattern === 'pressure'
              ? 'RUSH!'
              : item.bossPattern === 'trick'
                ? 'TRICK HIT!'
                : damage >= 3 ? 'MEGA!' : 'POWER!',
          '#cf8a00'
        );
        playSfx('boss-hit');
        removeItem(item);

        if (state.boss.hp <= 0) {
          state.boss.hp = 0;
          renderHud();

          stageHitStop(140);
          bossHurtPulse();
          flashFinisher();
          strongBanner(
            state.boss.rageTriggered ? '🔥 Rage Break!' : '👑 Boss Down!',
            980
          );

          playSfx('boss-clear');

          safeTimeout(() => {
            endGame(true);
          }, 180);
          return;
        }

        setBanner('โดนแล้ว! โจมตีต่อ!', 720);
      }

      renderHud();
    }

    function enterPhase2() {
      state.phase = 2;
      clearItems();
      state.spawnAcc = 0;
      playSfx('phase');
      strongBanner('Phase 2 • เร็วขึ้นและยากขึ้น', 1200);
      pushEvent('phase_enter', { phase: 2, score: state.score });
      renderHud();
    }

    function enterBoss() {
      state.phase = 3;
      state.boss.active = true;
      const hpBonus =
        diffKey === 'easy' ? -2 :
        diffKey === 'hard' ? 2 : 0;
      state.boss.hp = Math.max(12, cfg.bossHp + hpBonus);
      state.boss.maxHp = state.boss.hp;
      state.boss.stage = 'A';
      state.boss.stageReached = 'A';
      state.boss.pattern = 'hunt';
      state.boss.patternClock = 0;
      state.boss.weakTimer = 9999;
      state.boss.stormTimer = 0;
      state.boss.weakId = '';
      state.boss.rage = false;
      state.boss.rageTriggered = false;
      state.metrics.bossEnterAt = nowMs();

      state.arena.safeLane = 1;
      state.arena.cycleGapMs = 0;
      clearArenaPressure();

      clearItems();
      state.spawnAcc = 0;

      playSfx('phase');
      strongBanner('Boss Phase • Junk King มาแล้ว!', 1400);
      showStageCue(getChildStageTitle('A'), getChildStageHint('A'), 'เริ่มสู้บอส');
      pushEvent('boss_enter', { hp: state.boss.hp, score: state.score });
      renderHud();
    }

    function updateWeak(item, dt) {
      const r = stageRect();
      item.lifeMs += dt;

      if (item.lifeMax > 0 && item.lifeMs >= item.lifeMax) {
        state.weakMissed += 1;
        state.miss += 1;
        state.streak = 0;
        fx(item.x + item.size / 2, item.y + item.size / 2, 'MISS!', '#d16b27');
        setBanner(diffKey === 'easy' ? 'ไม่เป็นไร ลองใหม่!' : 'ช้าไป! เป้าหายแล้ว', 620);
        removeItem(item);
        return;
      }

      const mode = item.bossPattern || 'hunt';

      if (mode === 'hunt') {
        item.x += item.vx * dt / 1000;
        item.y = item.baseY + Math.sin(item.lifeMs / 240) * 8;
      } else if (mode === 'trick') {
        item.x += item.vx * dt / 1000;
        item.y += (item.verticalTarget - item.y) * 0.08;

        if (item.lifeMs >= item.nextFlipAt) {
          item.vx *= -1;
          item.nextFlipAt += 260;
          item.verticalTarget = clamp(
            item.baseY + runRange(-28, 28),
            Math.max(118, r.height * 0.22),
            Math.max(140, r.height * 0.54)
          );
        }
      } else if (mode === 'pressure') {
        const flipStep = diffKey === 'easy' ? 380 : diffKey === 'hard' ? 260 : 320;

        item.x += item.vx * dt / 1000;
        item.y += item.vy * dt / 1000;

        if (item.lifeMs >= item.nextFlipAt) {
          item.nextFlipAt += flipStep;
          item.vx *= runRand() < 0.5 ? -1 : 1;
          item.vy = runRange(
            diffKey === 'easy' ? -20 : -28,
            diffKey === 'easy' ? 20 : 28
          );
        }
      } else if (mode === 'burst') {
        item.x += item.vx * 1.08 * dt / 1000;
        item.y = item.baseY + Math.sin(item.lifeMs / 120) * 14;

        if (item.lifeMs >= item.nextFlipAt) {
          item.vx *= -1;
          item.nextFlipAt += 180;
        }
      }

      if (item.x <= 12) {
        item.x = 12;
        item.vx = Math.abs(item.vx);
      }
      if (item.x + item.size >= r.width - 12) {
        item.x = r.width - item.size - 12;
        item.vx = -Math.abs(item.vx);
      }

      const minY = Math.max(118, r.height * 0.22);
      const maxY = Math.max(minY + 10, r.height - item.size - 160);
      item.y = clamp(item.y, minY, maxY);

      if (item.bossPattern === 'burst') {
        if (runRand() < 0.55) spawnWeakTrail(item);
      } else if (item.bossPattern === 'pressure') {
        if (runRand() < 0.24) spawnWeakTrail(item);
      }

      drawItem(item);
    }

    function updateFallingItem(item, dt) {
      item.lifeMs += dt;
      item.x += item.vx * dt / 1000;
      item.y += item.vy * dt / 1000;

      const r = stageRect();

      if (item.x <= 8) {
        item.x = 8;
        item.vx *= -1;
      }
      if (item.x + item.size >= r.width - 8) {
        item.x = r.width - item.size - 8;
        item.vx *= -1;
      }

      drawItem(item);

      if (item.lifeMax > 0 && item.lifeMs >= item.lifeMax) {
        removeItem(item);
        return;
      }

      if (item.y > r.height + item.size * 0.5) {
        if (item.kind === 'good') {
          state.miss += 1;
          state.goodMissed += 1;
          state.streak = 0;
        }
        removeItem(item);
      }
    }

    function updateBoss(dt) {
      if (!state.boss.active) return;

      const hpRatio = state.boss.hp / state.boss.maxHp;

      if (!state.boss.rageTriggered && hpRatio <= 0.15) {
        enterRageFinale();
      }

      if (!state.boss.rage) {
        const nextStage = getBossStageByHp();
        setBossStage(nextStage);
      }

      const stageCfg = getBossStageConfig();

      state.boss.patternClock += dt;
      state.boss.weakTimer += dt;
      state.boss.stormTimer += dt;

      const patternTick = stageCfg.patternDuration;
      if (state.boss.patternClock >= patternTick) {
        state.boss.patternClock = 0;
        const nextPattern = pickBossPatternSmart(stageCfg);
        setBossPattern(nextPattern);
      }

      const useArenaPressure = state.boss.stage === 'C' || state.boss.rage;

      if (useArenaPressure) {
        state.arena.cycleGapMs += dt;

        if (
          state.arena.telegraphMs <= 0 &&
          state.arena.sweepMs <= 0 &&
          state.arena.cycleGapMs >= (state.boss.rage ? 1200 : 1800)
        ) {
          state.arena.cycleGapMs = 0;
          startArenaTelegraph(runRand() < 0.28 ? 'fake-sweep' : 'sweep');
          setBanner(
            state.arena.lastPattern === 'fake-sweep'
              ? '⚠️ Fake Sweep • หา SAFE lane ให้เจอ'
              : '⚠️ Lane Sweep • อ่าน SAFE lane',
            760
          );
        }

        if (state.arena.telegraphMs > 0) {
          state.arena.telegraphMs -= dt;
          if (state.arena.telegraphMs <= 0) {
            beginArenaSweep();
          }
        } else if (state.arena.sweepMs > 0) {
          state.arena.sweepMs -= dt;
          if (state.arena.sweepMs <= 0) {
            state.arena.sweepingLanes = [];
            state.arena.warnedLanes = [];
            renderArenaOverlay();
          }
        }
      } else {
        clearArenaPressure();
        state.arena.cycleGapMs = 0;
      }

      const weakSpawnDelay =
        state.boss.pattern === 'storm'
          ? stageCfg.weakEvery * 1.15
          : stageCfg.weakEvery;

      if (state.boss.weakTimer >= weakSpawnDelay && !state.boss.weakId) {
        state.boss.weakTimer = 0;
        spawnWeakTarget();
      }

      const allowStorm =
        state.boss.pattern === 'storm' ||
        state.boss.pattern === 'pressure' ||
        state.boss.pattern === 'burst';

      if (allowStorm && state.boss.stormTimer >= stageCfg.stormEvery) {
        state.boss.stormTimer = 0;
        spawnStorm();
      }
    }

    function calcGrade(bossClear) {
      if (bossClear && state.miss <= 3 && state.bestStreak >= 10) return 'S';
      if (bossClear && state.miss <= 7) return 'A';
      if (bossClear || (state.score >= cfg.p2Goal && state.miss <= 10)) return 'B';
      return 'C';
    }

    function medalEmojiForGrade(grade) {
      if (grade === 'S') return '🏆';
      if (grade === 'A') return '🥇';
      if (grade === 'B') return '🥈';
      return '🥉';
    }

    function starsFromSummary(bossClear) {
      if (bossClear && state.miss <= 5) return 3;
      if (bossClear || state.boss.active) return 2;
      return 1;
    }

    function coachMessage(bossClear) {
      if (bossClear && state.boss.rageTriggered && state.miss <= 5) {
        return 'เก่งมาก! ผ่านช่วงสุดท้ายและโค่นบอสได้แล้ว';
      }
      if (bossClear) {
        return 'เยี่ยมเลย! ชนะบอสแล้ว รอบหน้าลองพลาดให้น้อยลง';
      }
      if (state.boss.active) {
        return 'เกือบแล้ว! รอบหน้าลองอ่านเป้ากับของลวงให้ทัน';
      }
      if (state.phase >= 2) {
        return 'ดีมาก! ผ่านด่านก่อนบอสแล้ว';
      }
      return 'เริ่มดีเลย ลองเก็บของดีต่อเนื่องนะ';
    }

    function nextHintMessage(bossClear) {
      if (bossClear && state.boss.rageTriggered && state.miss <= 3) {
        return 'เป้าหมายต่อไป: ชนะช่วงสุดท้ายแบบพลาดน้อยมาก';
      }
      if (bossClear) {
        return 'เป้าหมายต่อไป: ลองผ่าน Rage Finale ให้เนียนขึ้น';
      }
      if (state.boss.active) {
        return 'เป้าหมายต่อไป: อ่านช่องปลอดภัยแล้วตีต่อเนื่อง';
      }
      if (state.phase >= 2) {
        return 'เป้าหมายต่อไป: ไปให้ถึงบอสให้เร็วขึ้น';
      }
      return 'เป้าหมายต่อไป: รักษาคอมโบให้นานขึ้น';
    }

    function getReachedLabel(bossClear) {
      if (bossClear) return state.boss.rageTriggered ? 'Rage Clear' : 'Boss Clear';
      if (state.boss.active) return 'Boss ' + state.boss.stageReached;
      return 'Phase ' + state.phase;
    }

    function buildResearchPayload(bossClear, grade) {
      return {
        source: 'goodjunk-solo-phaseboss-v2',
        sessionId: state.research.sessionId,
        ts: nowMs(),
        participant: {
          pid: ctx.pid || 'anon',
          name: ctx.name || '',
          studyId: ctx.studyId || ''
        },
        context: {
          gameId: ctx.gameId || 'goodjunk',
          mode: 'solo',
          diff: diffKey,
          run: ctx.run || 'play',
          timeSec: Math.round(state.timeTotal / 1000),
          seed: ctx.seed || '',
          view: ctx.view || 'mobile'
        },
        outcome: {
          bossClear: !!bossClear,
          rageTriggered: !!state.boss.rageTriggered,
          grade: grade,
          score: state.score,
          miss: state.miss,
          bestStreak: state.bestStreak,
          phaseReached: state.boss.active ? 'boss' : ('phase-' + state.phase),
          bossStageReached: state.boss.stageReached,
          lastPattern: state.boss.pattern
        },
        performance: {
          hitsGood: state.hitsGood,
          hitsBad: state.hitsBad,
          goodMissed: state.goodMissed,
          powerHits: state.powerHits,
          stormHits: state.stormHits,
          baitHits: state.baitHits,
          weakMissed: state.weakMissed,
          bossDurationMs: state.metrics.bossDurationMs,
          clearTimeMs: state.metrics.clearTimeMs
        },
        events: state.research.events.slice()
      };
    }

    function saveLastSummary(payload) {
      try {
        const item = { ts: Date.now(), ...payload };
        storageSet(LAST_SUMMARY_KEY, JSON.stringify(item));

        const arr = safeJsonParse(storageGet(SUMMARY_HISTORY_KEY, '[]'), []);
        const list = Array.isArray(arr) ? arr : [];
        list.unshift(item);
        storageSet(SUMMARY_HISTORY_KEY, JSON.stringify(list.slice(0, 40)));
      } catch (_) {}
    }

    function saveResearchPayload(payload) {
      try {
        storageSet(RESEARCH_LAST_KEY, JSON.stringify(payload));

        const arr = safeJsonParse(storageGet(RESEARCH_HISTORY_KEY, '[]'), []);
        const list = Array.isArray(arr) ? arr : [];
        list.unshift(payload);
        storageSet(RESEARCH_HISTORY_KEY, JSON.stringify(list.slice(0, 30)));
      } catch (_) {}

      window.HHA_LAST_BOSS_PAYLOAD = payload;
    }

    async function buildReplayUrl() {
      const mod = await getGateUrlTools();
      const gateCtx = mod.readCtxFromUrl(location.href);

      return mod.buildWarmupGateUrl(
        {
          ...gateCtx,
          pid: ctx.pid || gateCtx.pid || 'anon',
          name: ctx.name || gateCtx.name || 'Hero',
          studyId: ctx.studyId || gateCtx.studyId || '',
          diff: diffKey,
          time: String(Math.round(state.timeTotal / 1000)),
          seed: String(Date.now() + Math.floor(runRand() * 10000)),
          hub: ctx.hub || gateCtx.hub || new URL('./hub-v2.html', location.href).toString(),
          view: ctx.view || gateCtx.view || 'mobile',
          run: ctx.run || gateCtx.run || 'play',
          game: 'goodjunk',
          gameId: 'goodjunk',
          theme: 'goodjunk',
          cat: 'nutrition',
          zone: 'nutrition',
          mode: 'solo'
        },
        './goodjunk-solo-boss.html',
        {
          entry: 'solo-boss',
          phaseBoss: '1',
          boss: '1',
          recommendedMode: 'solo-boss',
          debug: DEBUG ? '1' : ''
        }
      );
    }

    async function buildCooldownUrl(extra = {}) {
      const mod = await getGateUrlTools();
      const gateCtx = mod.readCtxFromUrl(location.href);

      return mod.buildCooldownGateUrl(
        {
          ...gateCtx,
          pid: ctx.pid || gateCtx.pid || 'anon',
          name: ctx.name || gateCtx.name || 'Hero',
          studyId: ctx.studyId || gateCtx.studyId || '',
          diff: diffKey,
          time: String(Math.round(state.timeTotal / 1000)),
          seed: String(ctx.seed || gateCtx.seed || Date.now()),
          hub: ctx.hub || gateCtx.hub || new URL('./hub-v2.html', location.href).toString(),
          view: ctx.view || gateCtx.view || 'mobile',
          run: ctx.run || gateCtx.run || 'play',
          game: 'goodjunk',
          gameId: 'goodjunk',
          theme: 'goodjunk',
          cat: 'nutrition',
          zone: 'nutrition',
          mode: 'solo'
        },
        {
          cdnext: './goodjunk-launcher.html',
          entry: 'solo-boss',
          phaseBoss: '1',
          boss: '1',
          forcegate: '1',
          debug: DEBUG ? '1' : '',
          ...extra
        }
      );
    }

    function clearTransientUi() {
      if (!ui) return;

      if (ui.pauseOverlay) ui.pauseOverlay.classList.remove('show');
      if (ui.summary) ui.summary.classList.remove('show');
      if (ui.stageCue) ui.stageCue.classList.remove('show');
      if (ui.tutorialOverlay) ui.tutorialOverlay.classList.remove('show');
      if (ui.finisherFlash) ui.finisherFlash.classList.remove('show');

      if (ui.stage) {
        ui.stage.classList.remove(
          'victory-lock',
          'victory-flash',
          'victory-shake',
          'hitstop',
          'rage-vignette'
        );
      }

      if (ui.bossCard) ui.bossCard.classList.remove('hurt');
      if (ui.banner) ui.banner.classList.remove('kill');
      if (ui.score) ui.score.classList.remove('emph');

      const layer = ui.summary && ui.summary.querySelector('.gjsb-confetti-layer');
      if (layer) layer.innerHTML = '';
    }

    function pauseGame(reason) {
      if (state.ended || state.paused) return;
      if (ui && ui.summary && ui.summary.classList.contains('show')) return;
      if (ui && ui.tutorialOverlay && ui.tutorialOverlay.classList.contains('show')) return;

      state.paused = true;
      state.pauseReason = String(reason || 'pause');

      ui.pauseSub.textContent =
        state.pauseReason === 'hidden'
          ? 'เกมหยุดอัตโนมัติเมื่อหน้าจอถูกสลับออก เพื่อไม่ให้พลาดระหว่างเล่น'
          : 'เกมถูกหยุดไว้ชั่วคราว กดเล่นต่อได้เมื่อพร้อม';

      ui.pauseOverlay.classList.add('show');
    }

    function resumeGame() {
      if (state.ended || !state.paused) return;
      if (ui && ui.summary && ui.summary.classList.contains('show')) return;

      state.paused = false;
      state.pauseReason = '';
      ui.pauseOverlay.classList.remove('show');
      state.lastTs = performance.now();
    }

    function setNavBusy(flag) {
      state.uiLock.navBusy = !!flag;

      const targets = [
        ui && ui.btnReplay,
        ui && ui.btnCooldown,
        ui && ui.btnHub,
        ui && ui.btnPauseHub
      ].filter(Boolean);

      targets.forEach((btn) => {
        btn.disabled = !!flag;
        btn.style.pointerEvents = flag ? 'none' : 'auto';
        btn.style.opacity = flag ? '.72' : '1';
      });
    }

    function beforeNavigationCleanup() {
      clearRuntimeTimers();
      state.running = false;
      state.paused = false;
      clearItems();
      clearArenaPressure();
      clearTransientUi();

      try { cancelAnimationFrame(state.raf); } catch (_) {}
    }

    async function safeNavigateAsync(urlOrFactory, fallbackUrl) {
      if (state.uiLock.navBusy) return;

      setNavBusy(true);
      beforeNavigationCleanup();

      let href = '';

      try {
        href =
          typeof urlOrFactory === 'function'
            ? await urlOrFactory()
            : await Promise.resolve(urlOrFactory);
      } catch (err) {
        console.error('[GJSB] async navigation build failed', err);
      }

      if (!href) {
        href = fallbackUrl || ctx.hub || new URL('./hub-v2.html', location.href).toString();
      }

      location.href = href;
    }

    function safeNavigate(url) {
      safeNavigateAsync(url, ctx.hub || new URL('./hub-v2.html', location.href).toString());
    }

    async function finishBossRunViaCooldown(extra = {}) {
      const payload = window.HHA_LAST_BOSS_PAYLOAD || null;

      if (payload) {
        try {
          saveResearchPayload(payload);
        } catch (_) {}
      }

      safeNavigateAsync(
        () => buildCooldownUrl(extra),
        new URL('./goodjunk-launcher.html', location.href).toString()
      );
    }

    function bindButtons() {
      if (ui.btnReplay && !ui.btnReplay.__bound) {
        ui.btnReplay.__bound = true;
        ui.btnReplay.addEventListener('click', function () {
          safeNavigateAsync(
            () => buildReplayUrl(),
            new URL('./goodjunk-launcher.html', location.href).toString()
          );
        });
      }

      if (ui.btnCooldown && !ui.btnCooldown.__bound) {
        ui.btnCooldown.__bound = true;
        ui.btnCooldown.addEventListener('click', function () {
          safeNavigateAsync(
            () => buildCooldownUrl(),
            new URL('./goodjunk-launcher.html', location.href).toString()
          );
        });
      }

      if (ui.btnCopyJson && !ui.btnCopyJson.__bound) {
        ui.btnCopyJson.__bound = true;
        ui.btnCopyJson.addEventListener('click', async function () {
          const payload = window.HHA_LAST_BOSS_PAYLOAD || null;
          if (!payload) {
            ui.sumExportBox.textContent = 'ยังไม่มี payload ให้คัดลอก';
            return;
          }
          const ok = await safeCopyText(JSON.stringify(payload, null, 2));
          ui.sumExportBox.innerHTML = ok ? '<strong>คัดลอก JSON แล้ว</strong>' : '<strong>คัดลอกไม่สำเร็จ</strong>';
        });
      }

      if (ui.btnHub && !ui.btnHub.__bound) {
        ui.btnHub.__bound = true;
        ui.btnHub.addEventListener('click', function () {
          safeNavigate(ctx.hub || new URL('./hub-v2.html', location.href).toString());
        });
      }

      if (ui.btnPause && !ui.btnPause.__bound) {
        ui.btnPause.__bound = true;
        ui.btnPause.addEventListener('click', function () {
          if (state.paused) resumeGame();
          else pauseGame('manual');
        });
      }

      if (ui.btnMute && !ui.btnMute.__bound) {
        ui.btnMute.__bound = true;
        ui.btnMute.addEventListener('click', function () {
          state.muted = !state.muted;
          renderHud();
        });
      }

      if (ui.btnResume && !ui.btnResume.__bound) {
        ui.btnResume.__bound = true;
        ui.btnResume.addEventListener('click', function () {
          resumeGame();
        });
      }

      if (ui.btnPauseHub && !ui.btnPauseHub.__bound) {
        ui.btnPauseHub.__bound = true;
        ui.btnPauseHub.addEventListener('click', function () {
          safeNavigate(ctx.hub || new URL('./hub-v2.html', location.href).toString());
        });
      }

      if (ui.btnTutorialGo && !ui.btnTutorialGo.__bound) {
        ui.btnTutorialGo.__bound = true;
        ui.btnTutorialGo.addEventListener('click', hideTutorialOverlay);
      }

      if (ui.btnTutorialSkip && !ui.btnTutorialSkip.__bound) {
        ui.btnTutorialSkip.__bound = true;
        ui.btnTutorialSkip.addEventListener('click', hideTutorialOverlay);
      }

      if (!bindButtons.__globalBound) {
        bindButtons.__globalBound = true;

        document.addEventListener('visibilitychange', function () {
          if (document.hidden && !state.ended && !(ui && ui.summary && ui.summary.classList.contains('show'))) {
            pauseGame('hidden');
          }
        });

        window.addEventListener('blur', function () {
          if (!state.ended) pauseGame('hidden');
        });

        window.addEventListener('resize', function () {
          renderHud();
        }, { passive: true });

        window.addEventListener('keydown', function (ev) {
          if (state.ended) return;

          if (ev.key === 'p' || ev.key === 'P') {
            ev.preventDefault();
            if (state.paused) resumeGame();
            else pauseGame('manual');
          }

          if (ev.key === 'm' || ev.key === 'M') {
            ev.preventDefault();
            state.muted = !state.muted;
            renderHud();
          }
        });

        window.addEventListener('beforeunload', function () {
          beforeNavigationCleanup();
        });
      }
    }

    function endGame(bossClear) {
      if (state.ended || state.uiLock.summaryShown) return;
      state.uiLock.summaryShown = true;
      state.ended = true;
      state.running = false;
      cancelAnimationFrame(state.raf);
      clearItems();

      state.metrics.bossEndAt = state.boss.active ? nowMs() : 0;
      state.metrics.bossDurationMs =
        state.metrics.bossEnterAt > 0 && state.metrics.bossEndAt > 0
          ? (state.metrics.bossEndAt - state.metrics.bossEnterAt)
          : 0;
      state.metrics.clearTimeMs = nowMs() - state.metrics.runStartAt;

      const stars = starsFromSummary(bossClear);
      const grade = calcGrade(bossClear);
      const medal = medalEmojiForGrade(grade);
      const payload = buildResearchPayload(bossClear, grade);
      saveResearchPayload(payload);
      const isRageClear = !!(bossClear && state.boss.rageTriggered);

      const dailyMeta = readDailyBossMeta();
      dailyMeta.plays += 1;
      if (bossClear) dailyMeta.clears += 1;
      if (isRageClear) dailyMeta.rageClears += 1;
      dailyMeta.bestScore = Math.max(dailyMeta.bestScore || 0, state.score);
      dailyMeta.bestStreak = Math.max(dailyMeta.bestStreak || 0, state.bestStreak);

      if (!dailyMeta.bestGrade || gradeScore(grade) > gradeScore(dailyMeta.bestGrade)) {
        dailyMeta.bestGrade = grade;
      }

      dailyMeta.rematchStreak = bossClear ? (dailyMeta.rematchStreak || 0) + 1 : 0;

      const metaReward = computeBossRewardMeta({
        bossClear,
        rageClear: isRageClear,
        grade,
        miss: state.miss,
        bestStreak: state.bestStreak,
        score: state.score
      });

      dailyMeta.lastReward = metaReward.reward;
      dailyMeta.lastBadge = metaReward.badge;

      const dailyResult = evaluateDailyChallenge({
        bossClear,
        rageClear: isRageClear,
        miss: state.miss,
        bestStreak: state.bestStreak,
        score: state.score
      });

      writeDailyBossMeta(dailyMeta);

      const hubSnapshot = buildHubSnapshot({
        bossClear,
        rageClear: isRageClear,
        grade,
        metaReward,
        dailyChallenge: dailyResult
      });
      saveHubSnapshot(hubSnapshot);

      ui.sumTitle.textContent =
        isRageClear ? 'Rage Finale Clear!' :
        bossClear ? 'Food Hero Complete!' :
        'Great Job!';

      ui.sumSub.textContent =
        isRageClear
          ? 'เธอฝ่าช่วง Rage Finale และโค่น Junk King ได้แบบสุดมันส์'
          : bossClear
            ? 'เธอช่วยปกป้องเมืองอาหารดีและเอาชนะ Junk King ได้แล้ว'
            : state.phase >= 2
              ? 'ผ่านด่านก่อนบอสได้ดีมาก รอบหน้าลุยต่อได้อีก'
              : 'เริ่มต้นได้ดีมาก เก็บอาหารดีต่อไปนะ';

      ui.sumStars.textContent = '⭐'.repeat(stars);
      ui.sumGrade.textContent = grade;
      ui.sumGrade.className = 'gjsb-grade ' + grade.toLowerCase();
      ui.sumMedal.textContent = medal;

      runVictoryPolish(bossClear, grade);
      addSummaryRibbon(
        isRageClear
          ? `🔥 ${metaReward.reward}`
          : bossClear
            ? `🏆 ${metaReward.reward}`
            : `⭐ ${metaReward.reward}`
      );

      ui.sumGrid.innerHTML = `
        <div class="gjsb-stat"><div class="k">ระดับ</div><div class="v">${diffKey}</div></div>
        <div class="gjsb-stat"><div class="k">คะแนน</div><div class="v">${state.score}</div></div>
        <div class="gjsb-stat"><div class="k">พลาด</div><div class="v">${state.miss}</div></div>
        <div class="gjsb-stat"><div class="k">คอมโบสูงสุด</div><div class="v">${state.bestStreak}</div></div>
        <div class="gjsb-stat"><div class="k">แตะของดี</div><div class="v">${state.hitsGood}</div></div>
        <div class="gjsb-stat"><div class="k">ตีบอส</div><div class="v">${state.powerHits}</div></div>
        <div class="gjsb-stat"><div class="k">โดนพายุขยะ</div><div class="v">${state.stormHits}</div></div>
        <div class="gjsb-stat"><div class="k">โดนของลวง</div><div class="v">${state.baitHits}</div></div>
        <div class="gjsb-stat"><div class="k">เป้าหายไป</div><div class="v">${state.weakMissed}</div></div>
        <div class="gjsb-stat"><div class="k">ถึงไหนแล้ว</div><div class="v">${getReachedLabel(bossClear)}</div></div>
        <div class="gjsb-stat"><div class="k">เวลาเจอบอส</div><div class="v">${state.metrics.bossDurationMs ? (state.metrics.bossDurationMs / 1000).toFixed(1) + 's' : '-'}</div></div>
        <div class="gjsb-stat"><div class="k">Run Variant</div><div class="v">${state.replay.runLabel || 'Balanced'}</div></div>
        ${buildMetaSummaryHtml(metaReward, dailyResult, dailyMeta)}
      `;

      ui.sumCoach.textContent = coachMessage(bossClear);
      ui.sumNextHint.textContent = nextHintMessage(bossClear);

      ui.sumCoach.textContent += ` • วันนี้ได้ ${metaReward.badge}`;
      ui.sumNextHint.textContent += dailyResult.done
        ? ' • Daily challenge วันนี้สำเร็จแล้ว'
        : ` • Daily challenge: ${dailyResult.title}`;

      ui.sumExportBox.innerHTML = `
        <strong>payload พร้อม export แล้ว</strong><br>
        sessionId: ${payload.sessionId}<br>
        events: ${payload.events.length}<br>
        grade: ${payload.outcome.grade}<br>
        bossClear: ${payload.outcome.bossClear ? 'yes' : 'no'}<br>
        replayFlow: warmup-gate → boss run<br>
        finishFlow: cooldown-gate → launcher
      `;

      if (ui && ui.btnReplay) {
        ui.btnReplay.textContent =
          bossClear
            ? `🔥 เล่นอีกครั้ง (${dailyMeta.rematchStreak})`
            : '🔁 ลองใหม่';
      }

      saveLastSummary({
        source: 'goodjunk-solo-phaseboss-v2',
        gameId: ctx.gameId || 'goodjunk',
        mode: 'solo',
        pid: ctx.pid || 'anon',
        diff: diffKey,
        score: state.score,
        miss: state.miss,
        bestStreak: state.bestStreak,
        hitsGood: state.hitsGood,
        hitsBad: state.hitsBad,
        powerHits: state.powerHits,
        stormHits: state.stormHits,
        baitHits: state.baitHits,
        weakMissed: state.weakMissed,
        bossDefeated: !!bossClear,
        phaseReached: state.boss.active ? 'boss' : ('phase-' + state.phase),
        bossStageReached: state.boss.stageReached,
        rageTriggered: !!state.boss.rageTriggered,
        finalGrade: grade,
        rewardTitle: metaReward.reward,
        rewardBadge: metaReward.badge,
        dailyChallengeTitle: dailyResult.title,
        dailyChallengeDone: dailyResult.done,
        rematchStreak: dailyMeta.rematchStreak
      });

      writeRematchState({
        count: state.replay.rematchCount + 1,
        lastSeed: String(ctx.seed || ''),
        lastGrade: grade,
        lastBossStage: String(state.boss.stageReached || '')
      });

      clearRuntimeTimers();
      clearArenaPressure();
      ui.pauseOverlay.classList.remove('show');
      ui.summary.classList.add('show');

      ui.btnReplay.textContent = bossClear ? '🔥 เล่นใหม่ผ่าน Warmup' : '🔁 ลองใหม่ผ่าน Warmup';
      ui.btnCooldown.textContent = '🧊 ไป Cooldown';

      safeTimeout(() => {
        if (ui && ui.summaryCard) {
          ui.summaryCard.scrollTop = 0;
        }
      }, 30);
    }

    function update(dt) {
      if (state.paused) {
        renderHud();
        return;
      }

      state.timeLeft -= dt;
      if (state.timeLeft <= 0) {
        state.timeLeft = 0;
        endGame(false);
        return;
      }

      if (!state.boss.active) {
        const spawnEvery = state.phase === 1 ? cfg.spawn1 : cfg.spawn2;
        state.spawnAcc += dt;

        while (state.spawnAcc >= spawnEvery) {
          state.spawnAcc -= spawnEvery;
          spawnFood(state.phase);
        }
      }

      state.items.forEach((item) => {
        if (item.dead) return;

        if (item.kind === 'weak') {
          updateWeak(item, dt);
          return;
        }

        updateFallingItem(item, dt);
      });

      if (!state.boss.active && state.phase === 1 && state.score >= cfg.p1Goal) {
        enterPhase2();
      } else if (!state.boss.active && state.phase === 2 && state.score >= cfg.p2Goal) {
        enterBoss();
      }

      if (state.boss.active) {
        updateBoss(dt);
      }

      renderHud();
    }

    function loop(ts) {
      if (!state.running || state.ended || state.runtime.destroyed) return;

      const dt = Math.min(40, (ts - state.lastTs) || 16);
      state.lastTs = ts;

      try {
        update(dt);
      } catch (err) {
        console.error('[GJSB] loop failed', err);
        state.running = false;
        state.ended = true;
        window.__GJ_BOOT_FAIL__ = String(err && (err.stack || err.message) || err);
        if (window.__GJ_SHOW_BOOT_ERROR__) {
          window.__GJ_SHOW_BOOT_ERROR__(window.__GJ_BOOT_FAIL__);
        }
        return;
      }

      state.raf = requestAnimationFrame(loop);
    }

    function start() {
      if (state.runtime.started) {
        dlog('start skipped: already started');
        return;
      }

      state.runtime.started = true;
      state.runtime.destroyed = false;

      clearRuntimeTimers();
      clearTransientUi();

      const rematchInfo = readRematchState();
      const derivedSeed = [
        String(ctx.seed || 'seed'),
        String(ctx.pid || 'anon'),
        String(rematchInfo.count || 0),
        String(diffKey)
      ].join('|');

      const seeded = makeRunRandom(derivedSeed);
      state.rng.seedBase = seeded.base;
      state.rng.runRand = seeded.next;

      buildSessionVariant();
      state.replay.lastPatterns = [];
      state.replay.recentSafeLanes = [];

      state.uiLock.navBusy = false;
      state.uiLock.summaryShown = false;
      setNavBusy(false);

      state.arena.safeLane = 1;
      state.arena.cycleGapMs = 0;
      clearArenaPressure();

      if (ui && ui.pauseOverlay) ui.pauseOverlay.classList.remove('show');
      if (ui && ui.finisherFlash) ui.finisherFlash.classList.remove('show');
      if (ui && ui.bossCard) ui.bossCard.classList.remove('hurt');
      if (ui && ui.banner) ui.banner.classList.remove('kill');
      if (ui && ui.score) ui.score.classList.remove('emph');
      if (ui && ui.stageCue) ui.stageCue.classList.remove('show');
      if (ui && ui.tutorialOverlay) ui.tutorialOverlay.classList.remove('show');

      state.metrics.runStartAt = nowMs();
      state.lastTs = performance.now();
      state.running = true;

      bindButtons();
      renderHud();

      if (shouldShowDailyTutorial()) {
        safeTimeout(() => {
          if (!state.ended) showTutorialOverlay();
        }, 260);
      }

      setBanner('เริ่มเลย! เก็บอาหารดี แล้วหลีกเลี่ยง junk', 1300);

      state.raf = requestAnimationFrame(loop);
      window.__GJ_ENGINE_MOUNTED__ = true;

      if (window.__GJ_HIDE_LOADING__) {
        window.__GJ_HIDE_LOADING__();
      }

      dlog('engine started');
    }

    window.HHGoodJunkPhaseBossGate = {
      buildReplayUrl,
      buildCooldownUrl,
      finishBossRunViaCooldown
    };

    injectStyle();
    ui = buildUI();
    start();

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