// === /fitness/js/shadow-breaker-trainer.js ===
// Shadow Breaker - Hit Zone Trainer
// PATCH v20260412a-SBT-HIT-ZONE-TRAINER

'use strict';

const SBT_VERSION = 'v20260412a-SBT-HIT-ZONE-TRAINER';

(function () {
  const W = window;
  const D = document;

  const qs = (k, d = '') => {
    try {
      const v = new URL(location.href).searchParams.get(k);
      return v == null || v === '' ? d : v;
    } catch (_) {
      return d;
    }
  };

  const qnum = (k, d = 0) => {
    const n = Number(qs(k, d));
    return Number.isFinite(n) ? n : d;
  };

  const qbool = (k, d = false) => {
    const raw = String(qs(k, d ? '1' : '0')).toLowerCase();
    return ['1', 'true', 'yes', 'y', 'on'].includes(raw);
  };

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const nowMs = () => (performance && performance.now ? performance.now() : Date.now());

  function createRng(seedStr) {
    let h = 1779033703 ^ String(seedStr).length;
    for (let i = 0; i < String(seedStr).length; i++) {
      h = Math.imul(h ^ String(seedStr).charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    let a = ((h ^ (h >>> 16)) >>> 0) || 1;
    return function rng() {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (m) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[m]));
  }

  function escapeAttr(s) {
    return String(s == null ? '' : s).replace(/"/g, '&quot;');
  }

  function buildCtx() {
    const origin = location.origin || '';
    const defaultHub = `${origin}/webxr-health-mobile/herohealth/hub.html`;
    const defaultNext = `${origin}/webxr-health-mobile/fitness/shadow-breaker.html`;

    const timeSec = clamp(qnum('time', 36), 20, 60);
    const targetCount = clamp(qnum('targets', 12), 6, 24);

    return {
      patch: SBT_VERSION,
      pid: qs('pid', 'anon'),
      name: qs('name', 'Hero'),
      nick: qs('nick', qs('name', 'Hero')),
      studyId: qs('studyId', ''),
      run: qs('run', 'play'),
      view: qs('view', 'mobile'),
      seed: qs('seed', String(Date.now())),
      hub: qs('hub', defaultHub),
      next: qs('next', defaultNext),
      diff: qs('diff', 'normal'),
      timeSec,
      targetCount,
      zone: qs('zone', 'fitness'),
      cat: qs('cat', 'fitness'),
      game: 'shadowbreaker-trainer',
      gameId: 'shadowbreaker-trainer',
      theme: 'shadowbreaker-trainer',
      debug: qbool('debug', false)
    };
  }

  const ctx = buildCtx();
  const rng = createRng(ctx.seed);

  const ACTIONS = ['jab', 'cross', 'guard', 'duck'];

  const LABEL = {
    jab: 'JAB',
    cross: 'CROSS',
    guard: 'BLOCK',
    duck: 'DUCK'
  };

  const HELP = {
    jab: 'แตะเป้าตรงจังหวะ',
    cross: 'แตะเป้าตรงจังหวะ',
    guard: 'กดค้าง หรือแตะเป้า',
    duck: 'ปัดลง หรือแตะบาร์'
  };

  const state = {
    started: false,
    ended: false,
    paused: false,
    sessionId: `sbt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    sessionStartAt: 0,
    sessionEndAt: 0,
    loopTimer: 0,

    current: null,
    queue: [],
    nextIndex: 0,
    resolvedCount: 0,

    score: 0,
    combo: 0,
    comboMax: 0,

    judgments: {
      perfect: 0,
      good: 0,
      late: 0,
      miss: 0
    },

    actions: {
      total: 0,
      jab: 0,
      cross: 0,
      guard: 0,
      duck: 0
    },

    runtime: {
      audioReady: false,
      assistOpen: false,
      assistTimer: 0,
      gestureActive: false,
      gestureStartX: 0,
      gestureStartY: 0,
      gestureStartAt: 0,
      lastPointerX: 0,
      lastPointerY: 0,
      holdTimer: 0
    }
  };

  const ui = createUi();

  showIntro();

  function createUi() {
    const root = D.createElement('section');
    root.id = 'sbt-root';
    root.innerHTML = `
      <style>
        #sbt-root{
          min-height:100vh;
          background:
            radial-gradient(circle at top, #173052 0%, #0b1427 58%, #050913 100%);
          color:#fff;
          font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
          position:relative;
          overflow:hidden;
        }

        .sbt-topbar{
          position:absolute;
          left:12px;
          right:12px;
          top:12px;
          z-index:12;
          display:flex;
          justify-content:space-between;
          gap:10px;
          flex-wrap:wrap;
          padding:10px 12px;
          border-radius:16px;
          background:rgba(10,18,38,.72);
          border:1px solid rgba(255,255,255,.08);
          backdrop-filter:blur(8px);
          font-size:14px;
        }

        .sbt-stage{
          position:absolute;
          inset:84px 12px 168px;
          z-index:5;
          overflow:hidden;
          border-radius:24px;
          background:
            radial-gradient(circle at 50% 42%, rgba(108,163,255,.10) 0%, rgba(255,255,255,0) 38%),
            linear-gradient(180deg, rgba(255,255,255,.02) 0%, rgba(255,255,255,.01) 100%);
          border:1px solid rgba(255,255,255,.08);
        }

        .sbt-gesture-layer{
          position:absolute;
          inset:84px 12px 168px;
          z-index:6;
          touch-action:none;
        }

        .sbt-gesture-hint{
          position:absolute;
          left:50%;
          top:10px;
          transform:translateX(-50%);
          font-size:11px;
          font-weight:800;
          color:rgba(255,255,255,.9);
          background:rgba(10,18,38,.42);
          border:1px solid rgba(255,255,255,.08);
          border-radius:999px;
          padding:6px 10px;
          pointer-events:none;
          text-align:center;
        }

        .sbt-center-text{
          position:absolute;
          left:50%;
          top:50%;
          transform:translate(-50%,-50%);
          text-align:center;
          z-index:4;
          pointer-events:none;
        }

        .sbt-title{
          font-size:clamp(26px,5vw,48px);
          font-weight:1000;
          text-shadow:0 0 24px rgba(120,180,255,.20);
        }

        .sbt-sub{
          margin-top:8px;
          font-size:14px;
          opacity:.95;
        }

        .sbt-target-layer{
          position:absolute;
          inset:0;
          z-index:7;
          pointer-events:none;
          touch-action:manipulation;
        }

        .sbt-target{
          position:absolute;
          left:50%;
          top:48%;
          transform:translate(-50%,-50%);
          width:120px;
          height:120px;
          border-radius:999px;
          pointer-events:none;
        }

        .sbt-target.is-jab .sbt-target-body{
          background:radial-gradient(circle at 35% 30%, #8fd3ff 0%, #3a86ff 55%, #143d8f 100%);
        }

        .sbt-target.is-cross .sbt-target-body{
          background:radial-gradient(circle at 35% 30%, #9bf6ff 0%, #4cc9f0 55%, #1c6aa5 100%);
        }

        .sbt-target.is-guard{
          width:136px;
          height:136px;
          border-radius:28px;
        }

        .sbt-target.is-guard .sbt-target-body{
          border-radius:28px;
          background:linear-gradient(180deg, #d7e9ff 0%, #7fb3ff 45%, #275cc9 100%);
        }

        .sbt-target.is-duck{
          width:min(70vw,420px);
          height:26px;
          border-radius:999px;
          top:58%;
        }

        .sbt-target.is-duck .sbt-hit-zone,
        .sbt-target.is-duck .sbt-ring,
        .sbt-target.is-duck .sbt-target-body,
        .sbt-target.is-duck .sbt-tapbox{
          border-radius:999px;
        }

        .sbt-target.is-duck .sbt-target-body{
          background:linear-gradient(90deg, #ffd6a5 0%, #ffad66 50%, #f47c20 100%);
        }

        .sbt-hit-zone{
          position:absolute;
          inset:0;
          border-radius:inherit;
          border:2px dashed rgba(255,255,255,.50);
          background:rgba(255,255,255,.04);
          box-shadow:inset 0 0 0 2px rgba(255,255,255,.03);
        }

        .sbt-ring{
          position:absolute;
          inset:-16px;
          border-radius:inherit;
          border:4px solid rgba(255,255,255,.86);
          box-shadow:0 0 20px rgba(255,255,255,.16);
          animation:sbtRingShrink var(--ring-ms, 1100ms) linear forwards;
        }

        .sbt-target-body{
          position:absolute;
          inset:0;
          border-radius:inherit;
          display:grid;
          place-items:center;
          border:2px solid rgba(255,255,255,.22);
          box-shadow:
            0 0 0 6px rgba(255,255,255,.04),
            0 14px 30px rgba(0,0,0,.24);
          backdrop-filter:blur(3px);
        }

        .sbt-target-label{
          position:absolute;
          left:50%;
          top:calc(100% + 10px);
          transform:translateX(-50%);
          font-weight:1000;
          font-size:14px;
          white-space:nowrap;
          text-shadow:0 2px 10px rgba(0,0,0,.45);
          pointer-events:none;
        }

        .sbt-target-help{
          position:absolute;
          left:50%;
          top:calc(100% + 34px);
          transform:translateX(-50%);
          font-size:11px;
          opacity:.9;
          white-space:nowrap;
          pointer-events:none;
        }

        .sbt-tapbox{
          position:absolute;
          inset:-18px;
          border-radius:inherit;
          background:transparent;
          pointer-events:auto;
          touch-action:manipulation;
          cursor:pointer;
          z-index:2;
        }

        .sbt-target.is-duck .sbt-tapbox{
          inset:-18px 0;
        }

        .sbt-fx{
          position:absolute;
          inset:84px 12px 168px;
          z-index:14;
          pointer-events:none;
          overflow:hidden;
        }

        .sbt-popup{
          position:absolute;
          left:var(--x, 50%);
          top:var(--y, 50%);
          transform:translate(-50%,-50%);
          padding:8px 12px;
          border-radius:999px;
          font-weight:1000;
          font-size:14px;
          color:#fff;
          white-space:nowrap;
          box-shadow:0 10px 22px rgba(0,0,0,.18);
          opacity:0;
          animation:sbtPopupFloat .72s ease-out forwards;
        }

        .sbt-popup.is-perfect{
          background:linear-gradient(180deg, #ffe066 0%, #ffb703 100%);
          color:#442800;
        }

        .sbt-popup.is-good{
          background:linear-gradient(180deg, #7dd3fc 0%, #3b82f6 100%);
        }

        .sbt-popup.is-late{
          background:linear-gradient(180deg, #fbbf24 0%, #f97316 100%);
        }

        .sbt-popup.is-miss{
          background:linear-gradient(180deg, #fca5a5 0%, #ef4444 100%);
        }

        .sbt-burst{
          position:absolute;
          left:var(--x, 50%);
          top:var(--y, 50%);
          width:0;
          height:0;
        }

        .sbt-burst-piece{
          position:absolute;
          left:0;
          top:0;
          width:10px;
          height:10px;
          border-radius:3px;
          opacity:0;
          transform:translate(0,0) scale(.7);
          animation:sbtBurstFly .46s ease-out forwards;
          box-shadow:0 4px 10px rgba(0,0,0,.15);
        }

        .sbt-burst-piece.is-ring{
          width:12px;
          height:12px;
          border-radius:999px;
        }

        .sbt-coach{
          position:absolute;
          left:50%;
          transform:translateX(-50%);
          bottom:116px;
          z-index:16;
          min-height:40px;
          max-width:min(86vw,560px);
          padding:10px 14px 10px 46px;
          border-radius:18px;
          font-size:14px;
          line-height:1.35;
          color:#fff;
          background:rgba(14,24,46,.72);
          border:1px solid rgba(255,255,255,.12);
          box-shadow:0 12px 24px rgba(0,0,0,.18);
          backdrop-filter:blur(8px);
        }

        .sbt-coach::before{
          content:'';
          position:absolute;
          left:12px;
          top:50%;
          width:22px;
          height:22px;
          transform:translateY(-50%);
          border-radius:999px;
          background:radial-gradient(circle at 35% 35%, #fff 0%, #bde0ff 38%, #6aa9ff 100%);
          box-shadow:0 0 12px rgba(130,180,255,.28);
        }

        .sbt-coach.is-warn{
          background:rgba(108,52,10,.84);
        }

        .sbt-coach.is-hype{
          background:rgba(88,18,44,.84);
        }

        .sbt-assist{
          position:absolute;
          right:14px;
          bottom:158px;
          z-index:18;
          border:0;
          border-radius:999px;
          padding:10px 14px;
          font-weight:900;
          font-size:13px;
          color:#fff;
          background:linear-gradient(180deg, rgba(46,92,180,.96) 0%, rgba(27,57,118,.96) 100%);
          box-shadow:0 10px 22px rgba(0,0,0,.20);
        }

        .sbt-assist.is-on{
          background:linear-gradient(180deg, rgba(255,188,66,.98) 0%, rgba(232,122,25,.96) 100%);
        }

        .sbt-pad{
          position:absolute;
          left:12px;
          right:12px;
          bottom:12px;
          z-index:18;
          display:grid;
          grid-template-columns:repeat(4,minmax(0,1fr));
          gap:6px;
          opacity:0;
          transform:translateY(18px);
          pointer-events:none;
          transition:opacity .18s ease, transform .18s ease;
        }

        .sbt-pad[data-open="1"]{
          opacity:.94;
          transform:translateY(0);
          pointer-events:auto;
        }

        .sbt-pad button{
          border:0;
          border-radius:12px;
          padding:10px 6px;
          font-weight:900;
          font-size:12px;
          background:rgba(232,241,255,.96);
          color:#123;
          box-shadow:0 6px 14px rgba(0,0,0,.14);
        }

        .sbt-overlay{
          position:absolute;
          inset:0;
          z-index:30;
        }

        .sbt-overlay[hidden]{
          display:none;
        }

        .sbt-overlay-backdrop{
          position:absolute;
          inset:0;
          background:rgba(4,8,18,.72);
        }

        .sbt-overlay-card{
          position:absolute;
          left:50%;
          top:50%;
          transform:translate(-50%,-50%);
          width:min(92vw,760px);
          max-height:86vh;
          overflow:auto;
          background:#fff;
          color:#172338;
          border-radius:24px;
          padding:20px;
          box-shadow:0 24px 64px rgba(0,0,0,.28);
        }

        .sbt-grid{
          display:grid;
          grid-template-columns:repeat(2,minmax(0,1fr));
          gap:12px;
        }

        .sbt-card{
          background:#f4f8ff;
          border-radius:16px;
          padding:12px 14px;
        }

        .sbt-actions{
          display:flex;
          gap:10px;
          flex-wrap:wrap;
          justify-content:flex-end;
          margin-top:14px;
        }

        .sbt-btn{
          appearance:none;
          border:0;
          border-radius:14px;
          padding:12px 16px;
          font-weight:800;
          text-decoration:none;
          cursor:pointer;
          display:inline-flex;
          align-items:center;
          justify-content:center;
        }

        .sbt-btn-primary{
          background:#3b82f6;
          color:#fff;
        }

        .sbt-btn-secondary{
          background:#eaf2ff;
          color:#13325b;
        }

        @keyframes sbtRingShrink{
          from{ transform:scale(1.92); opacity:.94; }
          to{ transform:scale(1.0); opacity:.20; }
        }

        @keyframes sbtPopupFloat{
          0%{
            opacity:0;
            transform:translate(-50%,-50%) scale(.82);
          }
          18%{
            opacity:1;
            transform:translate(-50%,-58%) scale(1);
          }
          100%{
            opacity:0;
            transform:translate(-50%,-110%) scale(.98);
          }
        }

        @keyframes sbtBurstFly{
          0%{
            opacity:1;
            transform:translate(0,0) scale(.7);
            filter:brightness(1.05);
          }
          100%{
            opacity:0;
            transform:translate(var(--dx, 0px), var(--dy, 0px)) scale(.16) rotate(var(--rot, 0deg));
            filter:brightness(1.2);
          }
        }

        @media (max-width:680px){
          .sbt-grid{
            grid-template-columns:1fr;
          }
          .sbt-gesture-hint{
            max-width:84vw;
            white-space:normal;
            text-align:center;
            line-height:1.25;
          }
          .sbt-target{
            width:96px;
            height:96px;
          }
          .sbt-target.is-guard{
            width:116px;
            height:116px;
          }
          .sbt-target.is-duck{
            width:min(78vw,360px);
          }
          .sbt-assist{
            bottom:158px;
            right:12px;
            font-size:12px;
          }
          .sbt-coach{
            bottom:118px;
            font-size:13px;
          }
        }
      </style>

      <div class="sbt-topbar" data-topbar></div>

      <div class="sbt-stage">
        <div class="sbt-center-text" data-center>
          <div class="sbt-title">Hit Zone Trainer</div>
          <div class="sbt-sub">ฝึกจังหวะก่อนเข้าเกมหลัก</div>
        </div>
        <div class="sbt-target-layer" data-target-layer></div>
      </div>

      <div class="sbt-gesture-layer" data-gesture-layer>
        <div class="sbt-gesture-hint" data-gesture-hint>Tap target • Swipe down = Duck • Hold = Block</div>
      </div>

      <div class="sbt-fx" data-fx></div>

      <div class="sbt-coach" data-coach>แตะเป้าให้ตรงตอนวงหดเข้าเป้า</div>

      <button class="sbt-assist" data-assist-toggle type="button">Assist</button>

      <div class="sbt-pad" data-pad data-open="0">
        <button data-action="jab" type="button">JAB</button>
        <button data-action="cross" type="button">CROSS</button>
        <button data-action="guard" type="button">BLOCK</button>
        <button data-action="duck" type="button">DUCK</button>
      </div>

      <div class="sbt-overlay" data-overlay hidden>
        <div class="sbt-overlay-backdrop"></div>
        <div class="sbt-overlay-card" data-overlay-card></div>
      </div>
    `;

    D.body.appendChild(root);

    const topbar = root.querySelector('[data-topbar]');
    const center = root.querySelector('[data-center]');
    const targetLayer = root.querySelector('[data-target-layer]');
    const gestureLayer = root.querySelector('[data-gesture-layer]');
    const gestureHint = root.querySelector('[data-gesture-hint]');
    const fx = root.querySelector('[data-fx]');
    const coach = root.querySelector('[data-coach]');
    const assistToggle = root.querySelector('[data-assist-toggle]');
    const pad = root.querySelector('[data-pad]');
    const overlay = root.querySelector('[data-overlay]');
    const overlayCard = root.querySelector('[data-overlay-card]');

    return {
      root,
      topbar,
      center,
      targetLayer,
      gestureLayer,
      gestureHint,
      fx,
      coach,
      assistToggle,
      pad,
      overlay,
      overlayCard,

      renderTopbar(remainSec) {
        topbar.innerHTML = `
          <div><strong>${escapeHtml(ctx.nick)}</strong> • Trainer</div>
          <div>Score <strong>${state.score}</strong></div>
          <div>Combo <strong>${state.combo}</strong></div>
          <div>เหลือ <strong>${Math.max(0, remainSec)}</strong> วิ</div>
        `;
      },

      setCoach(text, tone = 'calm') {
        coach.className = `sbt-coach ${tone === 'warn' ? 'is-warn' : tone === 'hype' ? 'is-hype' : ''}`;
        coach.textContent = text || '';
      },

      setGestureHint(text) {
        gestureHint.textContent = text || '';
      },

      setAssistOpen(flag) {
        const open = !!flag;
        pad.dataset.open = open ? '1' : '0';
        assistToggle.classList.toggle('is-on', open);
      },

      autoHideAssist(ms = 2200) {
        clearTimeout(state.runtime.assistTimer);
        state.runtime.assistTimer = setTimeout(() => {
          state.runtime.assistOpen = false;
          this.setAssistOpen(false);
        }, ms);
      },

      showTarget(target) {
        const cls = `is-${target.action}`;
        const label = LABEL[target.action] || 'HIT';
        const help = HELP[target.action] || 'แตะให้ตรงจังหวะ';
        const ringMs = Math.max(300, Number(target.expiresMs || 1100));

        targetLayer.innerHTML = `
          <div class="sbt-target ${cls}" data-target>
            <div
              class="sbt-tapbox"
              data-direct-action="${escapeAttr(target.action)}"
              role="button"
              aria-label="${label}"
              title="${label}"
            ></div>
            <div class="sbt-hit-zone"></div>
            <div class="sbt-ring" style="--ring-ms:${ringMs}ms"></div>
            <div class="sbt-target-body"></div>
            <div class="sbt-target-label">${label}</div>
            <div class="sbt-target-help">${help}</div>
          </div>
        `;
      },

      clearTarget() {
        targetLayer.innerHTML = '';
      },

      targetAnchor() {
        try {
          const el = targetLayer.querySelector('[data-target]');
          if (!el) return { x: '50%', y: '50%' };

          const r = el.getBoundingClientRect();
          const fr = fx.getBoundingClientRect();

          return {
            x: r.left - fr.left + (r.width * 0.78),
            y: r.top - fr.top + (r.height * 0.22)
          };
        } catch (_) {
          return { x: '50%', y: '50%' };
        }
      },

      popup(text, tone = 'good', x = '50%', y = '50%') {
        const el = D.createElement('div');
        el.className = `sbt-popup is-${tone}`;
        el.style.setProperty('--x', typeof x === 'number' ? `${x}px` : String(x));
        el.style.setProperty('--y', typeof y === 'number' ? `${y}px` : String(y));
        el.textContent = text;
        fx.appendChild(el);
        setTimeout(() => el.remove(), 760);
      },

      burst(tone = 'good', x = '50%', y = '50%') {
        const burst = D.createElement('div');
        burst.className = 'sbt-burst';
        burst.style.setProperty('--x', typeof x === 'number' ? `${x}px` : String(x));
        burst.style.setProperty('--y', typeof y === 'number' ? `${y}px` : String(y));

        const palette = tone === 'perfect'
          ? ['#fff7ae', '#ffe066', '#ffcf33', '#ffffff']
          : tone === 'late'
            ? ['#ffd6a5', '#ffad66', '#f97316', '#fff7ed']
            : tone === 'miss'
              ? ['#fecaca', '#f87171', '#ef4444', '#fff1f2']
              : ['#bfdbfe', '#7dd3fc', '#3b82f6', '#eff6ff'];

        const dirs = [
          [-48, -18], [-28, -42], [0, -52], [28, -42],
          [48, -18], [40, 18], [18, 42], [0, 52],
          [-18, 42], [-40, 18]
        ];

        dirs.forEach((pair, i) => {
          const piece = D.createElement('div');
          piece.className = `sbt-burst-piece ${i % 3 === 0 ? 'is-ring' : ''}`;
          piece.style.background = palette[i % palette.length];
          piece.style.setProperty('--dx', `${pair[0]}px`);
          piece.style.setProperty('--dy', `${pair[1]}px`);
          piece.style.setProperty('--rot', `${(i * 36) - 50}deg`);
          piece.style.animationDelay = `${i * 8}ms`;
          burst.appendChild(piece);
        });

        fx.appendChild(burst);
        setTimeout(() => burst.remove(), 520);
      },

      showOverlay(html) {
        overlayCard.innerHTML = html;
        overlay.hidden = false;
      },

      hideOverlay() {
        overlay.hidden = true;
        overlayCard.innerHTML = '';
      }
    };
  }

  function buildQueue() {
    const out = [];
    let last = '';

    for (let i = 0; i < ctx.targetCount; i++) {
      const pool = ACTIONS.filter(a => a !== last || ACTIONS.length <= 1);
      const action = pool[Math.floor(rng() * pool.length)];
      last = action;
      out.push({
        index: i + 1,
        action,
        label: LABEL[action]
      });
    }

    return out;
  }

  function showIntro() {
    ui.showOverlay(`
      <h2 style="margin:0 0 10px">Hit Zone Trainer</h2>
      <p style="margin:6px 0 12px">
        ฝึกให้กดตรงจังหวะก่อนเข้า <strong>Shadow Breaker</strong><br />
        เซสชันนี้ยาว <strong>${ctx.timeSec}</strong> วินาที • เป้าทั้งหมด <strong>${ctx.targetCount}</strong> เป้า
      </p>

      <div class="sbt-grid">
        <div class="sbt-card">
          <strong>วิธีเล่นหลัก</strong>
          <div style="margin-top:6px;">แตะเป้าให้ตรงตอนวงหดเข้า hit zone</div>
        </div>
        <div class="sbt-card">
          <strong>Gesture</strong>
          <div style="margin-top:6px;">Swipe down = Duck, Hold = Block</div>
        </div>
        <div class="sbt-card">
          <strong>ท่าที่ฝึก</strong>
          <div style="margin-top:6px;">JAB / CROSS / BLOCK / DUCK</div>
        </div>
        <div class="sbt-card">
          <strong>เป้าหมาย</strong>
          <div style="margin-top:6px;">เก็บ Perfect และลด Late / Miss ให้ได้มากที่สุด</div>
        </div>
      </div>

      <div class="sbt-actions">
        <a class="sbt-btn sbt-btn-secondary" href="${escapeAttr(ctx.hub)}">กลับ HUB</a>
        <button class="sbt-btn sbt-btn-primary" data-start="1" type="button">เริ่มฝึก</button>
      </div>
    `);

    const startBtn = ui.overlayCard.querySelector('[data-start="1"]');
    startBtn.addEventListener('click', () => {
      ensureAudioReady();
      ui.hideOverlay();
      startSession();
    }, { once: true });
  }

  function startSession() {
    if (state.started) return;

    state.started = true;
    state.sessionStartAt = Date.now();
    state.queue = buildQueue();
    state.nextIndex = 0;
    state.resolvedCount = 0;
    state.combo = 0;
    state.comboMax = 0;
    state.score = 0;
    state.judgments.perfect = 0;
    state.judgments.good = 0;
    state.judgments.late = 0;
    state.judgments.miss = 0;
    state.actions.total = 0;
    state.actions.jab = 0;
    state.actions.cross = 0;
    state.actions.guard = 0;
    state.actions.duck = 0;

    ui.setAssistOpen(false);
    ui.setGestureHint('Tap target • Swipe down = Duck • Hold = Block');
    ui.setCoach('แตะเป้าให้ตรงตอนวงหดเข้าเป้า', 'calm');

    countdownThenRun();
  }

  async function countdownThenRun() {
    for (let i = 3; i >= 1; i--) {
      ui.center.innerHTML = `
        <div class="sbt-title">${i}</div>
        <div class="sbt-sub">เตรียมตัว</div>
      `;
      playSfx('good');
      await sleep(650);
    }

    ui.center.innerHTML = `
      <div class="sbt-title">GO!</div>
      <div class="sbt-sub">แตะให้ตรงจังหวะ</div>
    `;
    playSfx('perfect');
    await sleep(450);

    loop();
  }

  function loop() {
    clearTimeout(state.loopTimer);
    state.loopTimer = setTimeout(frame, 50);
  }

  function frame() {
    if (state.ended) return;

    const elapsed = (Date.now() - state.sessionStartAt) / 1000;
    const remainSec = Math.max(0, Math.ceil(ctx.timeSec - elapsed));
    ui.renderTopbar(remainSec);

    if (elapsed >= ctx.timeSec) {
      if (!state.current) {
        finishSession('time_up');
        return;
      }
    }

    if (state.current) {
      const t = nowMs();

      if (t > state.current.finalMissAtMs) {
        resolveCurrent('miss', state.current.action, { source: 'timeout' });
      }
    }

    if (!state.current && state.nextIndex < state.queue.length && !state.ended) {
      spawnNextTarget();
    }

    if (!state.current && state.nextIndex >= state.queue.length) {
      finishSession('queue_done');
      return;
    }

    loop();
  }

  function spawnNextTarget() {
    if (state.nextIndex >= state.queue.length) return;

    const item = state.queue[state.nextIndex++];
    const spawnAtMs = nowMs();
    const expiresMs = 1050;
    const hitAtMs = spawnAtMs + expiresMs;
    const lateGraceMs = 170;
    const finalMissAtMs = hitAtMs + lateGraceMs;

    state.current = {
      ...item,
      spawnAtMs,
      expiresMs,
      hitAtMs,
      lateGraceMs,
      finalMissAtMs
    };

    ui.showTarget(state.current);
    ui.setCoach(`${LABEL[state.current.action]} • ${HELP[state.current.action]}`, 'calm');
  }

  function classifyJudgment(target) {
    const delta = nowMs() - target.hitAtMs;
    if (Math.abs(delta) <= 85) return 'perfect';
    if (delta < -85) return 'good';
    if (delta <= target.lateGraceMs) return 'late';
    return 'miss';
  }

  function scoreForJudgment(j) {
    if (j === 'perfect') return 140;
    if (j === 'good') return 100;
    if (j === 'late') return 70;
    return 0;
  }

  function labelForJudgment(j) {
    if (j === 'perfect') return 'PERFECT!';
    if (j === 'good') return 'GOOD!';
    if (j === 'late') return 'LATE!';
    return 'MISS';
  }

  function toneForJudgment(j) {
    return j === 'perfect' ? 'perfect' : j === 'good' ? 'good' : j === 'late' ? 'late' : 'miss';
  }

  function resolveCurrent(result, performedAction, meta = {}) {
    const cur = state.current;
    if (!cur) return;

    state.current = null;
    ui.clearTarget();

    state.actions.total += 1;
    if (performedAction && state.actions[performedAction] != null) {
      state.actions[performedAction] += 1;
    }

    const anchor = ui.targetAnchor();

    if (result === 'miss') {
      state.judgments.miss += 1;
      state.combo = 0;
      ui.popup('MISS', 'miss', anchor.x, anchor.y);
      playSfx('miss');
      ui.setCoach('ไม่เป็นไร ลองอ่านวงให้แม่นขึ้นอีกนิด', 'warn');
      state.resolvedCount += 1;
      return;
    }

    const judgment = classifyJudgment(cur);
    state.judgments[judgment] += 1;
    state.score += scoreForJudgment(judgment);
    state.combo += 1;
    state.comboMax = Math.max(state.comboMax, state.combo);

    ui.burst(toneForJudgment(judgment), anchor.x, anchor.y);
    ui.popup(`${labelForJudgment(judgment)} +${scoreForJudgment(judgment)}`, toneForJudgment(judgment), anchor.x, anchor.y);

    if (judgment === 'perfect') {
      playSfx('perfect');
      ui.setCoach('คมมาก! จังหวะตรงสุด ๆ', 'hype');
    } else if (judgment === 'good') {
      playSfx('good');
      ui.setCoach('ดีมาก ใกล้ perfect แล้ว', 'calm');
    } else {
      playSfx('late');
      ui.setCoach('ช้านิดเดียว รอบหน้าลองกดก่อนสุดวงอีกนิด', 'warn');
      state.combo = 0;
    }

    state.resolvedCount += 1;
  }

  function ensureAudioReady() {
    const ctxAudio = getAudioCtx();
    if (!ctxAudio) return null;
    if (ctxAudio.state === 'suspended') {
      try { ctxAudio.resume(); } catch (_) {}
    }
    state.runtime.audioReady = ctxAudio.state === 'running';
    return ctxAudio;
  }

  function getAudioCtx() {
    const AC = W.AudioContext || W.webkitAudioContext;
    if (!AC) return null;

    if (!W.__SBT_AUDIO_CTX__) {
      try {
        W.__SBT_AUDIO_CTX__ = new AC();
      } catch (_) {
        return null;
      }
    }
    return W.__SBT_AUDIO_CTX__;
  }

  function playTone(ctxAudio, {
    freq = 440,
    type = 'sine',
    attack = 0.005,
    decay = 0.12,
    gain = 0.04,
    when = 0
  } = {}) {
    if (!ctxAudio) return;

    const t0 = ctxAudio.currentTime + when;
    const osc = ctxAudio.createOscillator();
    const g = ctxAudio.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);

    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);

    osc.connect(g);
    g.connect(ctxAudio.destination);

    osc.start(t0);
    osc.stop(t0 + attack + decay + 0.02);
  }

  function playSfx(kind = 'good') {
    const ctxAudio = ensureAudioReady();
    if (!ctxAudio) return;

    if (kind === 'perfect') {
      playTone(ctxAudio, { freq: 740, type: 'triangle', gain: 0.05, decay: 0.09 });
      playTone(ctxAudio, { freq: 980, type: 'triangle', gain: 0.035, decay: 0.08, when: 0.03 });
      return;
    }

    if (kind === 'good') {
      playTone(ctxAudio, { freq: 520, type: 'triangle', gain: 0.045, decay: 0.08 });
      playTone(ctxAudio, { freq: 660, type: 'triangle', gain: 0.03, decay: 0.06, when: 0.02 });
      return;
    }

    if (kind === 'late') {
      playTone(ctxAudio, { freq: 420, type: 'sawtooth', gain: 0.035, decay: 0.08 });
      return;
    }

    playTone(ctxAudio, { freq: 210, type: 'square', gain: 0.03, decay: 0.11 });
  }

  function trainerNextUrl() {
    const nextUrl = new URL(ctx.next, location.href);
    nextUrl.searchParams.set('pid', ctx.pid);
    nextUrl.searchParams.set('name', ctx.name);
    nextUrl.searchParams.set('nick', ctx.nick);
    if (ctx.studyId) nextUrl.searchParams.set('studyId', ctx.studyId);
    nextUrl.searchParams.set('run', ctx.run);
    nextUrl.searchParams.set('view', ctx.view);
    nextUrl.searchParams.set('seed', ctx.seed);
    nextUrl.searchParams.set('hub', ctx.hub);
    nextUrl.searchParams.set('diff', ctx.diff);
    nextUrl.searchParams.set('trainer', '1');
    return nextUrl.toString();
  }

  function finishSession(reason = 'done') {
    if (state.ended) return;

    state.ended = true;
    state.sessionEndAt = Date.now();
    clearTimeout(state.loopTimer);
    clearTimeout(state.runtime.holdTimer);
    clearTimeout(state.runtime.assistTimer);

    const totalHits = state.judgments.perfect + state.judgments.good + state.judgments.late;
    const accuracy = Math.round((totalHits / Math.max(1, state.resolvedCount)) * 100);

    const summary = {
      patch: SBT_VERSION,
      sessionId: state.sessionId,
      pid: ctx.pid,
      nick: ctx.nick,
      reason,
      score: state.score,
      comboMax: state.comboMax,
      perfect: state.judgments.perfect,
      good: state.judgments.good,
      late: state.judgments.late,
      miss: state.judgments.miss,
      totalResolved: state.resolvedCount,
      accuracy,
      createdAtIso: new Date().toISOString()
    };

    try {
      localStorage.setItem('SB_TRAINER_LAST_SUMMARY', JSON.stringify(summary));
      const hist = JSON.parse(localStorage.getItem('SB_TRAINER_SUMMARY_HISTORY') || '[]');
      hist.push(summary);
      localStorage.setItem('SB_TRAINER_SUMMARY_HISTORY', JSON.stringify(hist.slice(-30)));
    } catch (_) {}

    const tips = [];
    if (summary.perfect >= Math.max(4, Math.ceil(ctx.targetCount * 0.35))) {
      tips.push('จังหวะดีมาก พร้อมเข้าเกมหลักได้แล้ว');
    } else if (summary.late >= Math.max(3, Math.ceil(ctx.targetCount * 0.25))) {
      tips.push('ช้ากว่าจังหวะอยู่พอสมควร ลองกดก่อนวงหดสุดอีกนิด');
    } else if (summary.miss >= Math.max(3, Math.ceil(ctx.targetCount * 0.25))) {
      tips.push('ยังหลุด timing อยู่บ้าง ควรอ่านวงให้ชัดก่อนแตะ');
    } else {
      tips.push('ฟอร์มโอเคแล้ว เข้า main game ต่อได้');
    }

    if (summary.accuracy >= 85) {
      tips.push('ความแม่นยำสูงมาก');
    } else if (summary.accuracy < 60) {
      tips.push('ลองเล่น trainer อีกรอบก่อนเข้า main game จะช่วยได้');
    }

    if (summary.comboMax >= 5) {
      tips.push('คุณรักษาจังหวะต่อเนื่องได้ดี');
    }

    ui.showOverlay(`
      <h2 style="margin:0 0 10px">Trainer Summary</h2>

      <div class="sbt-grid">
        <div class="sbt-card">
          <strong>Score</strong>
          <div style="margin-top:6px;">${summary.score}</div>
        </div>
        <div class="sbt-card">
          <strong>Accuracy</strong>
          <div style="margin-top:6px;">${summary.accuracy}%</div>
        </div>
        <div class="sbt-card">
          <strong>Perfect</strong>
          <div style="margin-top:6px;">${summary.perfect}</div>
        </div>
        <div class="sbt-card">
          <strong>Good</strong>
          <div style="margin-top:6px;">${summary.good}</div>
        </div>
        <div class="sbt-card">
          <strong>Late</strong>
          <div style="margin-top:6px;">${summary.late}</div>
        </div>
        <div class="sbt-card">
          <strong>Miss</strong>
          <div style="margin-top:6px;">${summary.miss}</div>
        </div>
        <div class="sbt-card">
          <strong>Combo Max</strong>
          <div style="margin-top:6px;">${summary.comboMax}</div>
        </div>
        <div class="sbt-card">
          <strong>Resolved</strong>
          <div style="margin-top:6px;">${summary.totalResolved}/${ctx.targetCount}</div>
        </div>
      </div>

      <div style="margin-top:12px;">
        <strong>Quick Coach</strong>
        <div style="display:grid; gap:8px; margin-top:8px;">
          ${tips.map(t => `
            <div style="padding:10px 12px; border-radius:12px; background:#f4f8ff;">
              ${escapeHtml(t)}
            </div>
          `).join('')}
        </div>
      </div>

      <div class="sbt-actions">
        <a class="sbt-btn sbt-btn-secondary" href="${escapeAttr(ctx.hub)}">กลับ HUB</a>
        <button class="sbt-btn sbt-btn-secondary" data-replay="1" type="button">ฝึกอีกครั้ง</button>
        <a class="sbt-btn sbt-btn-primary" href="${escapeAttr(trainerNextUrl())}">ไป Shadow Breaker</a>
      </div>
    `);

    const replayBtn = ui.overlayCard.querySelector('[data-replay="1"]');
    replayBtn.addEventListener('click', () => {
      location.reload();
    }, { once: true });
  }

  function directTargetHandler(ev) {
    const hit = ev.target.closest('[data-direct-action]');
    if (!hit || !ui.targetLayer.contains(hit)) return;
    if (!state.current) return;

    ev.preventDefault();
    ev.stopPropagation();

    clearTimeout(state.runtime.holdTimer);
    state.runtime.gestureActive = false;

    ensureAudioReady();
    resolveCurrent('hit', hit.getAttribute('data-direct-action') || state.current.action, { source: 'direct_target' });

    ui.setAssistOpen(false);
    state.runtime.assistOpen = false;
  }

  function padAction(action) {
    if (!state.current) return;

    ensureAudioReady();
    resolveCurrent('hit', action, { source: 'pad' });
    ui.autoHideAssist(900);
    state.runtime.assistOpen = false;
  }

  function gestureDown(ev) {
    const hit = ev.target.closest('[data-direct-action]');
    if (hit) return;
    if (!state.started || state.ended) return;

    state.runtime.gestureActive = true;
    state.runtime.gestureStartX = ev.clientX;
    state.runtime.gestureStartY = ev.clientY;
    state.runtime.gestureStartAt = Date.now();
    state.runtime.lastPointerX = ev.clientX;
    state.runtime.lastPointerY = ev.clientY;

    clearTimeout(state.runtime.holdTimer);
    state.runtime.holdTimer = setTimeout(() => {
      if (!state.runtime.gestureActive || !state.current) return;

      const moveX = Math.abs(state.runtime.lastPointerX - state.runtime.gestureStartX);
      const moveY = Math.abs(state.runtime.lastPointerY - state.runtime.gestureStartY);

      if (moveX < 18 && moveY < 18) {
        ensureAudioReady();
        resolveCurrent('hit', 'guard', { source: 'gesture_hold' });
        ui.setGestureHint('BLOCK');
        setTimeout(() => {
          ui.setGestureHint('Tap target • Swipe down = Duck • Hold = Block');
        }, 700);

        ui.setAssistOpen(false);
        state.runtime.assistOpen = false;
        state.runtime.gestureActive = false;
      }
    }, 220);
  }

  function gestureMove(ev) {
    if (!state.runtime.gestureActive) return;
    state.runtime.lastPointerX = ev.clientX;
    state.runtime.lastPointerY = ev.clientY;
  }

  function gestureUp(ev) {
    if (!state.runtime.gestureActive) return;

    clearTimeout(state.runtime.holdTimer);

    const dx = ev.clientX - state.runtime.gestureStartX;
    const dy = ev.clientY - state.runtime.gestureStartY;
    const dt = Date.now() - state.runtime.gestureStartAt;

    state.runtime.gestureActive = false;

    if (!state.current) return;
    if (dt > 520) return;

    if (dy > 56 && Math.abs(dy) > Math.abs(dx)) {
      ensureAudioReady();
      resolveCurrent('hit', 'duck', { source: 'gesture_swipe' });
      ui.setGestureHint('DUCK');
      setTimeout(() => {
        ui.setGestureHint('Tap target • Swipe down = Duck • Hold = Block');
      }, 700);

      ui.setAssistOpen(false);
      state.runtime.assistOpen = false;
    }
  }

  function gestureCancel() {
    clearTimeout(state.runtime.holdTimer);
    state.runtime.gestureActive = false;
  }

  function keyHandler(ev) {
    const map = {
      KeyJ: 'jab',
      KeyK: 'cross',
      KeyG: 'guard',
      KeyD: 'duck'
    };
    const action = map[ev.code];
    if (!action || !state.current) return;

    ensureAudioReady();
    resolveCurrent('hit', action, { source: 'keyboard' });
    ui.setAssistOpen(false);
    state.runtime.assistOpen = false;
  }

  ui.targetLayer.addEventListener('pointerdown', directTargetHandler, { passive: false });
  ui.gestureLayer.addEventListener('pointerdown', gestureDown, { passive: false });
  ui.gestureLayer.addEventListener('pointermove', gestureMove, { passive: true });
  ui.gestureLayer.addEventListener('pointerup', gestureUp, { passive: false });
  ui.gestureLayer.addEventListener('pointercancel', gestureCancel, { passive: true });

  ui.pad.querySelectorAll('button[data-action]').forEach((btn) => {
    btn.addEventListener('click', () => {
      padAction(btn.dataset.action);
    });
  });

  ui.assistToggle.addEventListener('click', () => {
    const nextOpen = !state.runtime.assistOpen;
    state.runtime.assistOpen = nextOpen;
    ui.setAssistOpen(nextOpen);
    if (nextOpen) ui.autoHideAssist(2600);
  });

  D.addEventListener('keydown', keyHandler);

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
})();