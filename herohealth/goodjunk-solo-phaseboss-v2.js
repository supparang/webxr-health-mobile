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
        spawn1: 930,
        spawn2: 780,
        bossHp: 16,
        scoreGood: 12,
        penaltyJunk: 7,
        weakDamage: 2,
        weakEvery: 1300,
        stormEvery: 2400
      },
      normal: {
        p1Goal: 90,
        p2Goal: 220,
        spawn1: 760,
        spawn2: 620,
        bossHp: 22,
        scoreGood: 10,
        penaltyJunk: 8,
        weakDamage: 2,
        weakEvery: 1100,
        stormEvery: 1900
      },
      hard: {
        p1Goal: 110,
        p2Goal: 260,
        spawn1: 620,
        spawn2: 500,
        bossHp: 28,
        scoreGood: 9,
        penaltyJunk: 9,
        weakDamage: 3,
        weakEvery: 900,
        stormEvery: 1500
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

      timeTotal: Math.max(90, Number(ctx.time || 150)) * 1000,
      timeLeft: Math.max(90, Number(ctx.time || 150)) * 1000,

      lastTs: 0,
      spawnAcc: 0,
      seq: 0,
      raf: 0,

      bannerMs: 0,
      praiseMs: 0,
      items: new Map(),

      research: {
        sessionId: 'gjsb-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
        events: []
      },

      metrics: {
        runStartAt: Date.now(),
        bossEnterAt: 0,
        bossEndAt: 0,
        bossDurationMs: 0,
        clearTimeMs: 0
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
        patternMs: 0,
        weakTimer: 0,
        stormTimer: 0,
        weakId: '',
        rage: false,
        rageTriggered: false,
        killSequence: false
      }
    };

    let ui = null;

    function dlog() {
      if (!DEBUG) return;
      try { console.log('[GJSB]', ...arguments); } catch (_) {}
    }

    function rand() {
      return Math.random();
    }

    function range(min, max) {
      return min + Math.random() * (max - min);
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
      if (state.research.events.length > 400) {
        state.research.events.shift();
      }
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
      try {
        localStorage.setItem(key, value);
      } catch (_) {}
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
        }

        .gjsb-item.good{ background:linear-gradient(180deg,#f7fff1,#ffffff); }
        .gjsb-item.junk,
        .gjsb-item.storm{
          background:linear-gradient(180deg,#fff3f3,#ffffff);
          border-color:#ffd3d3;
        }

        .gjsb-item.weak{
          background:linear-gradient(180deg,#fff8d5,#ffffff);
          border-color:#ffe08a;
          animation:gjsbPulse .9s infinite;
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
          color:#6b7280;
          font-weight:1000;
          pointer-events:none;
        }

        @keyframes gjsbPulse{
          0%,100%{ transform:scale(1); }
          50%{ transform:scale(1.06); }
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

        .gjsb-summary{
          position:absolute;
          inset:0;
          z-index:60;
          display:none;
          place-items:center;
          background:rgba(255,255,255,.30);
          backdrop-filter:blur(4px);
          padding:16px;
        }
        .gjsb-summary.show{ display:grid; }

        .gjsb-summary-card{
          width:min(94vw,760px);
          max-height:88vh;
          overflow:auto;
          border-radius:28px;
          background:linear-gradient(180deg,#fffef8,#f8fff3);
          border:4px solid #bfe3f2;
          box-shadow:0 18px 36px rgba(86,155,194,.18);
          padding:18px;
          color:#55514a;
        }

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
          font-size:28px;
          font-weight:1000;
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
        }

        .gjsb-btn.replay{ background:linear-gradient(180deg,#7ed957,#58c33f); color:#173b0b; }
        .gjsb-btn.cooldown{ background:linear-gradient(180deg,#7fcfff,#58b7f5); color:#08374d; }
        .gjsb-btn.hub{ background:#fff; color:#6c6a61; border:3px solid #d7edf7; }

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

            <div class="gjsb-boss" id="bossWrap">
              <div class="gjsb-boss-card" id="bossCard">
                <div class="gjsb-boss-head">
                  <div class="gjsb-boss-icon" id="bossIcon">🍔</div>
                  <div>
                    <div class="gjsb-boss-title">Junk King</div>
                    <div class="gjsb-boss-sub" id="bossPatternText">อ่านจังหวะก่อน แล้วค่อยโจมตี</div>
                  </div>
                </div>

                <div class="gjsb-boss-stage" id="bossStageText">Stage A • Learn</div>
                <div class="gjsb-patternChip" id="bossPatternChip">Target Hunt</div>
                <div class="gjsb-rageBadge" id="bossRageBadge">🔥 Rage Finale</div>

                <div class="gjsb-boss-bar">
                  <div class="gjsb-boss-fill" id="bossHpFill"></div>
                </div>
                <div class="gjsb-boss-hp" id="bossHpText">HP 0 / 0</div>
              </div>
            </div>

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
                <div class="gjsb-coach" id="sumCoach">วันนี้ทำได้ดีมาก ลองเก็บอาหารดีต่อเนื่อง และระวัง junk ให้มากขึ้นนะ</div>
                <div class="gjsb-nextHint" id="sumNextHint">รอบหน้าลองเข้าไปให้ถึงบอสและลด miss ลงอีกนิดนะ</div>
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

        bossWrap: document.getElementById('bossWrap'),
        bossCard: document.getElementById('bossCard'),
        bossIcon: document.getElementById('bossIcon'),
        bossPatternText: document.getElementById('bossPatternText'),
        bossStageText: document.getElementById('bossStageText'),
        bossPatternChip: document.getElementById('bossPatternChip'),
        bossRageBadge: document.getElementById('bossRageBadge'),
        bossHpText: document.getElementById('bossHpText'),
        bossHpFill: document.getElementById('bossHpFill'),

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

    function drawItem(item) {
      item.el.style.transform = 'translate(' + item.x + 'px,' + item.y + 'px)';
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
        id, kind, emoji, x, y, size, vx, vy, el, dead: false,
        baseX: x,
        lifeMs: 0,
        dir: rand() < 0.5 ? -1 : 1
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

    function spawnFood(phase) {
      const r = stageRect();
      const phase2 = phase === 2;
      const goodRatio = phase2 ? 0.58 : 0.70;
      const isGood = rand() < goodRatio;
      const size = phase2 ? range(52, 78) : range(58, 86);
      const x = range(10, Math.max(12, r.width - size - 10));
      const y = -size - range(0, 30);
      const vx = range(-35, 35);
      const vy = phase2 ? range(170, 270) : range(120, 190);

      createItem(
        isGood ? 'good' : 'junk',
        isGood ? GOOD[Math.floor(rand() * GOOD.length)] : JUNK[Math.floor(rand() * JUNK.length)],
        x, y, size, vx, vy,
        isGood ? 'good' : 'junk'
      );
    }

    function spawnWeakTarget() {
      if (!state.boss.active || state.boss.weakId) return;

      const r = stageRect();
      const stageKey = state.boss.rage ? 'R' : state.boss.stage;
      const size =
        stageKey === 'A' ? 92 :
        stageKey === 'B' ? 78 :
        stageKey === 'C' ? 66 :
        58;

      const x = clamp(range(120, r.width - size - 120), 30, r.width - size - 30);
      const y = clamp(range(140, r.height * 0.54), 120, r.height - size - 140);

      const speed =
        stageKey === 'A' ? 110 :
        stageKey === 'B' ? 165 :
        stageKey === 'C' ? 220 :
        260;

      const item = createItem(
        'weak',
        '🎯',
        x,
        y,
        size,
        speed * (rand() < 0.5 ? -1 : 1),
        range(-18, 18),
        'weak'
      );

      state.boss.weakId = item.id;
    }

    function spawnStorm() {
      if (!state.boss.active) return;

      const r = stageRect();
      const size = range(44, 62);
      const x = range(10, Math.max(12, r.width - size - 10));
      const y = -size - range(0, 20);
      const vx = range(-60, 60);
      const vy = state.boss.rage ? range(300, 420) : range(220, 320);

      createItem(
        'storm',
        JUNK[Math.floor(rand() * JUNK.length)],
        x,
        y,
        size,
        vx,
        vy,
        'storm'
      );
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
      ui.bossStageText.textContent = state.boss.rage ? 'Rage Finale' : ('Stage ' + state.boss.stage);
      ui.bossPatternChip.textContent = state.boss.pattern === 'storm' ? 'Junk Storm' : 'Target Hunt';
      ui.bossPatternText.textContent =
        state.boss.pattern === 'storm'
          ? 'หลบ junk แล้วรอจังหวะโจมตี'
          : 'ตามเป้าทองให้ทันแล้วแตะโจมตี';

      ui.bossHpText.textContent = 'HP ' + state.boss.hp + ' / ' + state.boss.maxHp;
      ui.bossHpFill.style.transform =
        'scaleX(' + clamp(state.boss.hp / state.boss.maxHp, 0, 1) + ')';
    }

    function renderHud() {
      const narrow = window.innerWidth < 720;

      ui.score.textContent = narrow ? ('S • ' + state.score) : ('Score • ' + state.score);
      ui.time.textContent = narrow ? ('T • ' + fmtTime(state.timeLeft)) : ('Time • ' + fmtTime(state.timeLeft));
      ui.miss.textContent = narrow ? ('M • ' + state.miss) : ('Miss • ' + state.miss);
      ui.streak.textContent = narrow ? ('C • ' + state.streak) : ('Streak • ' + state.streak);

      if (state.boss.active) {
        ui.phase.textContent = narrow
          ? ('B • ' + (state.boss.rage ? 'R' : state.boss.stage))
          : ('Boss • ' + (state.boss.rage ? 'Rage' : state.boss.stage));
      } else {
        ui.phase.textContent = narrow ? ('P • ' + state.phase) : ('Phase • ' + state.phase);
      }

      ui.progress.style.transform =
        'scaleX(' + clamp(state.timeLeft / state.timeTotal, 0, 1) + ')';

      ui.btnMute.textContent = state.muted ? '🔇 Mute' : '🔊 Sound';
      ui.btnMute.classList.toggle('active', !state.muted);

      updateBossUi();
    }

    function onHit(item) {
      if (!state.running || state.ended || state.paused || !item || item.dead) return;

      const cx = item.x + item.size / 2;
      const cy = item.y + item.size / 2;

      if (item.kind === 'good') {
        state.hitsGood += 1;
        state.streak += 1;
        state.bestStreak = Math.max(state.bestStreak, state.streak);

        const bonus = Math.min(10, Math.floor(state.streak / 3) * 2);
        const gain = cfg.scoreGood + bonus;
        state.score += gain;

        fx(cx, cy, '+' + gain, '#2f8f2f');
        playSfx('good');
        if (state.streak === 3 || state.streak === 5 || state.streak === 8) {
          setBanner('คอมโบดีมาก!', 720);
        }
        removeItem(item);
      } else if (item.kind === 'junk' || item.kind === 'storm') {
        state.hitsBad += 1;
        state.miss += 1;
        state.streak = 0;
        state.score = Math.max(0, state.score - cfg.penaltyJunk);

        if (item.kind === 'storm') state.stormHits += 1;

        fx(cx, cy, 'MISS', '#d16b27');
        playSfx('bad');
        setBanner(item.kind === 'storm' ? 'โดน Junk Storm!' : 'ระวัง junk!', 720);
        removeItem(item);
      } else if (item.kind === 'weak') {
        state.powerHits += 1;
        state.streak += 1;
        state.bestStreak = Math.max(state.bestStreak, state.streak);

        const damage = state.boss.rage ? Math.max(2, cfg.weakDamage) : cfg.weakDamage;
        state.boss.hp = Math.max(0, state.boss.hp - damage);
        state.score += damage >= 3 ? 30 : 22;

        fx(cx, cy, damage >= 3 ? 'MEGA!' : 'POWER!', '#cf8a00');
        playSfx('boss-hit');
        removeItem(item);

        if (state.boss.hp <= 0) {
          state.boss.hp = 0;
          renderHud();
          playSfx('boss-clear');
          endGame(true);
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
      setBanner('Phase 2 • เร็วขึ้นและยากขึ้น', 1200);
      pushEvent('phase_enter', { phase: 2, score: state.score });
      renderHud();
    }

    function enterBoss() {
      state.phase = 3;
      state.boss.active = true;
      state.boss.hp = cfg.bossHp;
      state.boss.maxHp = cfg.bossHp;
      state.boss.stage = 'A';
      state.boss.stageReached = 'A';
      state.boss.pattern = 'hunt';
      state.boss.patternMs = 0;
      state.boss.weakTimer = 0;
      state.boss.stormTimer = 0;
      state.boss.weakId = '';
      state.boss.rage = false;
      state.boss.rageTriggered = false;
      state.metrics.bossEnterAt = nowMs();

      clearItems();
      state.spawnAcc = 0;

      playSfx('phase');
      setBanner('Boss Phase • Junk King มาแล้ว!', 1400);
      pushEvent('boss_enter', { hp: cfg.bossHp, score: state.score });
      renderHud();
    }

    function updateWeak(item, dt) {
      const r = stageRect();

      item.lifeMs += dt;
      item.x += item.vx * dt / 1000;
      item.y += Math.sin(item.lifeMs / 240) * 0.9;

      if (item.x <= 12) {
        item.x = 12;
        item.vx = Math.abs(item.vx);
      }
      if (item.x + item.size >= r.width - 12) {
        item.x = r.width - item.size - 12;
        item.vx = -Math.abs(item.vx);
      }

      const minY = 128;
      const maxY = Math.max(minY + 10, r.height - item.size - 160);
      item.y = clamp(item.y, minY, maxY);

      drawItem(item);
    }

    function updateBoss(dt) {
      if (!state.boss.active) return;

      const hpRatio = state.boss.hp / state.boss.maxHp;

      if (!state.boss.rageTriggered && hpRatio <= 0.25) {
        state.boss.rage = true;
        state.boss.rageTriggered = true;
        state.boss.stageReached = 'RAGE';
        setBanner('🔥 Rage Finale!', 1200);
      }

      if (!state.boss.rage) {
        state.boss.stage = hpRatio > 0.66 ? 'A' : hpRatio > 0.33 ? 'B' : 'C';
        state.boss.stageReached = state.boss.stage;
      }

      state.boss.patternMs += dt;
      state.boss.weakTimer += dt;
      state.boss.stormTimer += dt;

      const patternCycle = state.boss.rage ? 2200 : 3200;
      if (state.boss.patternMs >= patternCycle) {
        state.boss.patternMs = 0;
        state.boss.pattern = state.boss.pattern === 'hunt' ? 'storm' : 'hunt';
        setBanner(state.boss.pattern === 'storm' ? '⚠️ Junk Storm!' : '🎯 Target Hunt!', 820);
      }

      const weakEvery = state.boss.rage ? Math.max(520, cfg.weakEvery - 240) : cfg.weakEvery;
      const stormEvery = state.boss.rage ? Math.max(760, cfg.stormEvery - 420) : cfg.stormEvery;

      if (state.boss.pattern === 'hunt' && state.boss.weakTimer >= weakEvery) {
        state.boss.weakTimer = 0;
        spawnWeakTarget();
      }

      if (state.boss.pattern === 'storm' && state.boss.stormTimer >= stormEvery) {
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
      if (bossClear && state.miss <= 5) {
        return 'สุดยอดเลย! เธอผ่านทุก phase และจัดการ Junk King ได้อย่างมั่นใจ';
      }
      if (bossClear) {
        return 'เยี่ยมมาก! ชนะบอสแล้ว รอบหน้าลองลด miss ลงอีกนิด จะได้เกรดสูงขึ้น';
      }
      if (state.boss.active) {
        return 'ใกล้มากแล้ว! เธอถึงบอสแล้ว รอบหน้าลองอ่านจังหวะ weak target ให้แม่นขึ้น';
      }
      if (state.phase >= 2) {
        return 'ดีมาก! ผ่าน Phase 2 แล้ว รอบหน้าทะลุบอสได้แน่';
      }
      return 'เริ่มต้นได้ดีเลย ลองเก็บอาหารดีให้ต่อเนื่อง และหลบ junk ให้แม่นขึ้น';
    }

    function nextHintMessage(bossClear) {
      if (bossClear && state.miss <= 3) {
        return '🎯 Challenge ต่อไป: ลองจบแบบ Miss ไม่เกิน 2 และทำ Best Streak ให้ถึง 12';
      }
      if (bossClear) {
        return '🏆 Challenge ต่อไป: ลองเคลียร์บอสให้เร็วขึ้น และอย่าโดน Junk Storm';
      }
      if (state.boss.active) {
        return '👑 Challenge ต่อไป: ไปให้ถึง Rage Finale แล้วปิดบอสให้ได้';
      }
      if (state.phase >= 2) {
        return '⚡ Challenge ต่อไป: ทำคะแนนให้ถึงเกณฑ์เข้าบอสเร็วขึ้น';
      }
      return '🍎 Challenge ต่อไป: รักษาคอมโบให้นานขึ้น แล้วแตะของดีต่อเนื่อง';
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

    function buildReplayUrl() {
      const u = new URL('./goodjunk-solo-boss.html', location.href);
      u.searchParams.set('pid', ctx.pid || 'anon');
      u.searchParams.set('name', ctx.name || 'Hero');
      if (ctx.studyId) u.searchParams.set('studyId', ctx.studyId);
      u.searchParams.set('mode', 'solo');
      u.searchParams.set('entry', 'solo-boss');
      u.searchParams.set('phaseBoss', '1');
      u.searchParams.set('boss', '1');
      u.searchParams.set('theme', 'phaseboss');
      u.searchParams.set('diff', diffKey);
      u.searchParams.set('time', String(Math.round(state.timeTotal / 1000)));
      u.searchParams.set('seed', String(Date.now() + Math.floor(Math.random() * 10000)));
      u.searchParams.set('hub', ctx.hub || new URL('./hub-v2.html', location.href).toString());
      u.searchParams.set('view', ctx.view || 'mobile');
      u.searchParams.set('run', ctx.run || 'play');
      u.searchParams.set('gameId', ctx.gameId || 'goodjunk');
      u.searchParams.set('zone', ctx.zone || 'nutrition');
      if (DEBUG) u.searchParams.set('debug', '1');
      return u.toString();
    }

    function buildCooldownUrl() {
      const u = new URL('./warmup-gate.html', location.href);
      u.searchParams.set('phase', 'cooldown');
      u.searchParams.set('game', 'goodjunk');
      u.searchParams.set('gameId', 'goodjunk');
      u.searchParams.set('theme', 'goodjunk');
      u.searchParams.set('cat', 'nutrition');
      u.searchParams.set('zone', 'nutrition');
      u.searchParams.set('pid', ctx.pid || 'anon');
      u.searchParams.set('name', ctx.name || 'Hero');
      if (ctx.studyId) u.searchParams.set('studyId', ctx.studyId);
      u.searchParams.set('diff', diffKey);
      u.searchParams.set('time', String(Math.round(state.timeTotal / 1000)));
      u.searchParams.set('seed', ctx.seed || String(Date.now()));
      u.searchParams.set('hub', ctx.hub || new URL('./hub-v2.html', location.href).toString());
      u.searchParams.set('view', ctx.view || 'mobile');
      u.searchParams.set('run', ctx.run || 'play');
      u.searchParams.set('forcegate', '1');
      if (DEBUG) u.searchParams.set('debug', '1');
      return u.toString();
    }

    function endGame(bossClear) {
      if (state.ended) return;

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

      ui.sumTitle.textContent = bossClear ? 'Food Hero Complete!' : 'Great Job!';
      ui.sumSub.textContent = bossClear
        ? 'เธอช่วยปกป้องเมืองอาหารดีและเอาชนะ Junk King ได้แล้ว'
        : state.phase >= 2
          ? 'ผ่านด่านก่อนบอสได้ดีมาก รอบหน้าลุยต่อได้อีก'
          : 'เริ่มต้นได้ดีมาก เก็บอาหารดีต่อไปนะ';

      ui.sumStars.textContent = '⭐'.repeat(stars);
      ui.sumGrade.textContent = grade;
      ui.sumGrade.className = 'gjsb-grade ' + grade.toLowerCase();
      ui.sumMedal.textContent = medal;

      ui.sumGrid.innerHTML = `
        <div class="gjsb-stat"><div class="k">Score</div><div class="v">${state.score}</div></div>
        <div class="gjsb-stat"><div class="k">Miss</div><div class="v">${state.miss}</div></div>
        <div class="gjsb-stat"><div class="k">Best Streak</div><div class="v">${state.bestStreak}</div></div>
        <div class="gjsb-stat"><div class="k">Good Hit</div><div class="v">${state.hitsGood}</div></div>
        <div class="gjsb-stat"><div class="k">Power Hit</div><div class="v">${state.powerHits}</div></div>
        <div class="gjsb-stat"><div class="k">Storm Hit</div><div class="v">${state.stormHits}</div></div>
        <div class="gjsb-stat"><div class="k">Reached</div><div class="v">${
          bossClear
            ? (state.boss.rageTriggered ? 'Rage Clear' : 'Boss Clear')
            : (state.boss.active ? ('Boss ' + state.boss.stageReached) : ('Phase ' + state.phase))
        }</div></div>
        <div class="gjsb-stat"><div class="k">Boss Time</div><div class="v">${
          state.metrics.bossDurationMs ? (state.metrics.bossDurationMs / 1000).toFixed(1) + 's' : '-'
        }</div></div>
      `;

      ui.sumCoach.textContent = coachMessage(bossClear);
      ui.sumNextHint.textContent = nextHintMessage(bossClear);
      ui.sumExportBox.innerHTML = `
        <strong>payload พร้อม export แล้ว</strong><br>
        sessionId: ${payload.sessionId}<br>
        events: ${payload.events.length}<br>
        grade: ${payload.outcome.grade}<br>
        bossClear: ${payload.outcome.bossClear ? 'yes' : 'no'}
      `;

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
        bossDefeated: !!bossClear,
        phaseReached: state.boss.active ? 'boss' : ('phase-' + state.phase),
        bossStageReached: state.boss.stageReached,
        rageTriggered: !!state.boss.rageTriggered,
        finalGrade: grade
      });

      clearRuntimeTimers();
      ui.pauseOverlay.classList.remove('show');
      ui.summary.classList.add('show');
    }

    function pauseGame(reason) {
      if (state.ended || state.paused) return;
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
      state.paused = false;
      state.pauseReason = '';
      ui.pauseOverlay.classList.remove('show');
      state.lastTs = performance.now();
    }

    function beforeNavigationCleanup() {
      clearRuntimeTimers();
      state.running = false;
    }

    function bindButtons() {
      ui.btnReplay.addEventListener('click', function () {
        beforeNavigationCleanup();
        location.href = buildReplayUrl();
      });

      ui.btnCooldown.addEventListener('click', function () {
        beforeNavigationCleanup();
        location.href = buildCooldownUrl();
      });

      ui.btnCopyJson.addEventListener('click', async function () {
        const payload = window.HHA_LAST_BOSS_PAYLOAD || null;
        if (!payload) {
          ui.sumExportBox.textContent = 'ยังไม่มี payload ให้คัดลอก';
          return;
        }

        const ok = await safeCopyText(JSON.stringify(payload, null, 2));
        ui.sumExportBox.innerHTML = ok
          ? '<strong>คัดลอก JSON แล้ว</strong>'
          : '<strong>คัดลอกไม่สำเร็จ</strong>';
      });

      ui.btnHub.addEventListener('click', function () {
        beforeNavigationCleanup();
        location.href = ctx.hub || new URL('./hub-v2.html', location.href).toString();
      });

      ui.btnPause.addEventListener('click', function () {
        if (state.paused) resumeGame();
        else pauseGame('manual');
      });

      ui.btnMute.addEventListener('click', function () {
        state.muted = !state.muted;
        renderHud();
      });

      ui.btnResume.addEventListener('click', function () {
        resumeGame();
      });

      ui.btnPauseHub.addEventListener('click', function () {
        beforeNavigationCleanup();
        location.href = ctx.hub || new URL('./hub-v2.html', location.href).toString();
      });

      document.addEventListener('visibilitychange', function () {
        if (document.hidden && !state.ended) pauseGame('hidden');
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

    function updateFallingItem(item, dt) {
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

      if (item.y > r.height + item.size * 0.5) {
        if (item.kind === 'good') {
          state.miss += 1;
          state.goodMissed += 1;
          state.streak = 0;
        }
        removeItem(item);
      }
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

      state.metrics.runStartAt = nowMs();
      state.lastTs = performance.now();
      state.running = true;

      bindButtons();
      renderHud();
      setBanner('เริ่มเลย! เก็บอาหารดี แล้วหลีกเลี่ยง junk', 1300);

      state.raf = requestAnimationFrame(loop);
      window.__GJ_ENGINE_MOUNTED__ = true;

      dlog('engine started');
    }

    if (!window.__GJSB_PHASEBOSS_BOOTED__) {
      window.__GJSB_PHASEBOSS_BOOTED__ = true;

      injectStyle();
      ui = buildUI();
      start();
    } else {
      dlog('boot skipped: already booted');
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