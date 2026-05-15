// === /herohealth/vr-groups/groups-mobile-thrill-v97.js ===
// HeroHealth Groups Mobile — v9.7 Thrill Layer
// Adds: combo announcer, danger edge, boss HP, particle bursts, near-ground warning,
// fever/boss visual intensity, stage callouts, stronger mobile game feel.
// PATCH v20260514-GROUPS-MOBILE-V97-THRILL

(function () {
  'use strict';

  const VERSION = 'v9.7-mobile-thrill-layer-20260514';

  if (window.__HHA_GROUPS_MOBILE_V97_THRILL__) {
    console.warn('[Groups Mobile v9.7] already installed');
    return;
  }

  window.__HHA_GROUPS_MOBILE_V97_THRILL__ = true;

  const WIN = window;
  const DOC = document;

  const state = {
    lastCombo: 0,
    lastScore: 0,
    lastPhase: '',
    lastMode: '',
    lastDangerAt: 0,
    lastPulseAt: 0,
    bossHp: 0,
    bossMax: 8,
    warned: false,
    audio: null,
    poll: null
  };

  function $(id) {
    return DOC.getElementById(id);
  }

  function api() {
    return WIN.HHA_GROUPS_MOBILE_V9 || null;
  }

  function gameState() {
    try {
      const a = api();
      if (a && typeof a.getState === 'function') return a.getState() || {};
    } catch (e) {}
    return {};
  }

  function isGameActive(s) {
    return s && s.mode === 'game' && !s.ended;
  }

  function injectStyle() {
    if ($('groups-mobile-v97-style')) return;

    const style = DOC.createElement('style');
    style.id = 'groups-mobile-v97-style';
    style.textContent = `
      :root{
        --v97-safe-top: env(safe-area-inset-top, 0px);
        --v97-safe-bottom: env(safe-area-inset-bottom, 0px);
      }

      body.v97-thrill-on .game{
        transition: filter .22s ease, background .28s ease;
      }

      body.v97-boss .game{
        background:
          radial-gradient(circle at 50% 22%, rgba(255,160,120,.55), rgba(255,255,255,0) 35%),
          linear-gradient(rgba(255,255,255,.40) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,.40) 1px, transparent 1px),
          linear-gradient(180deg,#fff3e7,#bdeeff) !important;
        background-size:auto,54px 54px,54px 54px,auto !important;
      }

      body.v97-danger .game::after{
        content:"";
        position:absolute;
        inset:0;
        z-index:70;
        pointer-events:none;
        background:
          radial-gradient(circle at 50% 50%, rgba(255,255,255,0) 48%, rgba(255,105,105,.36) 100%);
        animation:v97DangerPulse .36s ease-in-out infinite alternate;
      }

      @keyframes v97DangerPulse{
        from{opacity:.22;}
        to{opacity:.82;}
      }

      body.v97-hit .game{
        filter:brightness(1.08) saturate(1.08);
      }

      body.v97-miss .game{
        animation:v97MissShake .22s ease both;
      }

      @keyframes v97MissShake{
        0%{transform:translateX(0);}
        20%{transform:translateX(-4px);}
        45%{transform:translateX(4px);}
        70%{transform:translateX(-2px);}
        100%{transform:translateX(0);}
      }

      .v97-combo{
        position:absolute;
        left:50%;
        top:calc(118px + var(--v97-safe-top));
        transform:translateX(-50%);
        z-index:78;
        min-width:min(72vw,360px);
        max-width:calc(100vw - 24px);
        border-radius:999px;
        padding:9px 14px;
        background:linear-gradient(135deg,rgba(255,255,255,.96),rgba(255,246,203,.94));
        color:#8a5200;
        box-shadow:0 16px 42px rgba(35,81,107,.18);
        border:2px solid rgba(255,217,102,.9);
        font-size:clamp(16px,4.4vw,24px);
        line-height:1.08;
        text-align:center;
        font-weight:1000;
        pointer-events:none;
        opacity:0;
        scale:.9;
      }

      .v97-combo.show{
        animation:v97ComboPop .82s ease both;
      }

      @keyframes v97ComboPop{
        0%{opacity:0; transform:translateX(-50%) translateY(12px); scale:.82;}
        18%{opacity:1; transform:translateX(-50%) translateY(0); scale:1.05;}
        72%{opacity:1; transform:translateX(-50%) translateY(-4px); scale:1;}
        100%{opacity:0; transform:translateX(-50%) translateY(-18px); scale:.95;}
      }

      .v97-bossbar{
        position:absolute;
        left:10px;
        right:10px;
        top:calc(176px + var(--v97-safe-top));
        z-index:36;
        border-radius:18px;
        padding:8px 10px;
        background:rgba(255,255,255,.92);
        box-shadow:0 12px 30px rgba(35,81,107,.13);
        pointer-events:none;
        display:none;
      }

      body.v97-boss .v97-bossbar{
        display:block;
      }

      .v97-boss-top{
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:8px;
        font-size:12px;
        font-weight:1000;
        color:#8a3c20;
      }

      .v97-boss-meter{
        height:9px;
        margin-top:6px;
        border-radius:999px;
        overflow:hidden;
        background:rgba(255,125,125,.18);
      }

      .v97-boss-meter i{
        display:block;
        height:100%;
        width:0%;
        border-radius:999px;
        background:linear-gradient(90deg,#ff7d7d,#ffb347,#ffd966);
        transition:width .18s ease;
      }

      .v97-particles{
        position:absolute;
        inset:0;
        z-index:79;
        pointer-events:none;
        overflow:hidden;
      }

      .v97-p{
        position:absolute;
        width:10px;
        height:10px;
        border-radius:999px;
        background:#ffd966;
        opacity:0;
        animation:v97Particle .72s ease-out forwards;
      }

      @keyframes v97Particle{
        0%{
          opacity:1;
          transform:translate(0,0) scale(1);
        }
        100%{
          opacity:0;
          transform:translate(var(--dx),var(--dy)) scale(.25);
        }
      }

      .v97-stage-toast{
        position:absolute;
        left:50%;
        top:42%;
        transform:translate(-50%,-50%);
        z-index:81;
        width:min(82vw,420px);
        border-radius:30px;
        padding:18px 14px;
        text-align:center;
        background:linear-gradient(145deg,rgba(255,255,255,.97),rgba(255,247,218,.95));
        color:#6f4300;
        box-shadow:0 26px 72px rgba(35,81,107,.24);
        font-size:clamp(24px,7vw,42px);
        line-height:1.08;
        font-weight:1000;
        pointer-events:none;
        opacity:0;
      }

      .v97-stage-toast.show{
        animation:v97StageToast .95s ease both;
      }

      @keyframes v97StageToast{
        0%{opacity:0; transform:translate(-50%,-42%) scale(.8);}
        18%{opacity:1; transform:translate(-50%,-50%) scale(1.08);}
        72%{opacity:1; transform:translate(-50%,-50%) scale(1);}
        100%{opacity:0; transform:translate(-50%,-58%) scale(.92);}
      }

      body.v97-fever-extreme .v97-stage-toast{
        background:linear-gradient(145deg,#fff6bd,#ffffff);
        color:#9b5200;
      }

      @media (max-height:740px){
        .v97-combo{
          top:calc(108px + var(--v97-safe-top));
        }

        .v97-bossbar{
          top:calc(154px + var(--v97-safe-top));
        }
      }
    `;

    DOC.head.appendChild(style);
  }

  function ensureLayer() {
    const game = $('game');
    if (!game) return;

    if (!$('v97Combo')) {
      const combo = DOC.createElement('div');
      combo.id = 'v97Combo';
      combo.className = 'v97-combo';
      combo.textContent = 'Combo!';
      game.appendChild(combo);
    }

    if (!$('v97Bossbar')) {
      const boss = DOC.createElement('div');
      boss.id = 'v97Bossbar';
      boss.className = 'v97-bossbar';
      boss.innerHTML = `
        <div class="v97-boss-top">
          <span>👑 Boss Pressure</span>
          <span id="v97BossText">0/8</span>
        </div>
        <div class="v97-boss-meter"><i id="v97BossFill"></i></div>
      `;
      game.appendChild(boss);
    }

    if (!$('v97Particles')) {
      const particles = DOC.createElement('div');
      particles.id = 'v97Particles';
      particles.className = 'v97-particles';
      game.appendChild(particles);
    }

    if (!$('v97StageToast')) {
      const toast = DOC.createElement('div');
      toast.id = 'v97StageToast';
      toast.className = 'v97-stage-toast';
      toast.textContent = 'Ready!';
      game.appendChild(toast);
    }
  }

  function showCombo(text) {
    const el = $('v97Combo');
    if (!el) return;

    el.textContent = text;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }

  function stageToast(text) {
    const el = $('v97StageToast');
    if (!el) return;

    el.textContent = text;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }

  function updateBossBar() {
    const fill = $('v97BossFill');
    const text = $('v97BossText');

    if (!fill || !text) return;

    const pct = Math.max(0, Math.min(100, (state.bossHp / state.bossMax) * 100));
    fill.style.width = pct + '%';
    text.textContent = `${state.bossHp}/${state.bossMax}`;
  }

  function burst(kind) {
    const layer = $('v97Particles');
    const food = $('food');
    if (!layer || !food) return;

    const r = food.getBoundingClientRect();
    const root = layer.getBoundingClientRect();
    const cx = r.left + r.width / 2 - root.left;
    const cy = r.top + r.height / 2 - root.top;

    const colors = {
      good: ['#7ed957', '#ffd966', '#61bbff'],
      miss: ['#ff7d7d', '#ffb3b3', '#ffd1d1'],
      golden: ['#ffd966', '#ffb347', '#fff2a8'],
      fever: ['#ff9d3f', '#ffd966', '#ffffff'],
      boss: ['#ff7d7d', '#ff9d3f', '#ffd966']
    }[kind] || ['#ffd966', '#7ed957', '#61bbff'];

    for (let i = 0; i < 18; i++) {
      const p = DOC.createElement('i');
      p.className = 'v97-p';

      const ang = (Math.PI * 2 * i) / 18;
      const dist = 42 + Math.random() * 54;

      p.style.left = cx + 'px';
      p.style.top = cy + 'px';
      p.style.background = colors[i % colors.length];
      p.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
      p.style.setProperty('--dy', Math.sin(ang) * dist + 'px');

      layer.appendChild(p);
      setTimeout(() => p.remove(), 820);
    }
  }

  function pulseBody(cls, ms) {
    DOC.body.classList.add(cls);
    setTimeout(() => DOC.body.classList.remove(cls), ms || 180);
  }

  function unlockAudio() {
    try {
      if (!state.audio) {
        const AC = WIN.AudioContext || WIN.webkitAudioContext;
        if (AC) state.audio = new AC();
      }

      if (state.audio && state.audio.state === 'suspended') {
        state.audio.resume();
      }
    } catch (e) {}
  }

  function beep(freq, dur, type) {
    try {
      unlockAudio();

      const ctx = state.audio;
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type || 'sine';
      osc.frequency.value = freq || 660;

      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (dur || 0.08));

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + (dur || 0.08) + 0.02);
    } catch (e) {}
  }

  function vibrate(pattern) {
    try {
      if (navigator.vibrate) navigator.vibrate(pattern);
    } catch (e) {}
  }

  function nearGroundDanger(s) {
    if (!isGameActive(s)) {
      DOC.body.classList.remove('v97-danger');
      state.warned = false;
      return;
    }

    const food = $('food');
    const stage = $('stage');

    if (!food || !stage) return;

    const fr = food.getBoundingClientRect();
    const sr = stage.getBoundingClientRect();

    const bottomGap = sr.bottom - fr.bottom;
    const danger = bottomGap < Math.max(42, sr.height * 0.12);

    DOC.body.classList.toggle('v97-danger', danger);

    const now = Date.now();

    if (danger && !state.warned && now - state.lastDangerAt > 800) {
      state.warned = true;
      state.lastDangerAt = now;
      beep(260, 0.07, 'triangle');
      vibrate(18);
    }

    if (!danger) {
      state.warned = false;
    }
  }

  function handlePhase(s) {
    const phase = s.phase || '';

    DOC.body.classList.toggle('v97-boss', phase === 'boss');

    if (phase !== state.lastPhase) {
      state.lastPhase = phase;
      state.bossHp = 0;
      updateBossBar();

      if (phase === 'storm') {
        stageToast('⚡ Speed Sort!');
        beep(860, 0.1);
        vibrate([25, 20, 25]);
      }

      if (phase === 'boss') {
        stageToast('👑 BOSS RUSH!');
        burst('boss');
        beep(360, 0.14, 'sawtooth');
        setTimeout(() => beep(620, 0.12), 120);
        vibrate([40, 25, 40]);
      }
    }
  }

  function handleCombo(s) {
    const combo = Number(s.combo || 0);
    const score = Number(s.score || 0);

    if (combo !== state.lastCombo) {
      if (combo === 5) {
        showCombo('🔥 Combo 5!');
        burst('good');
      } else if (combo === 10) {
        showCombo('⚡ Super Sort x10!');
        burst('golden');
        beep(960, 0.09);
      } else if (combo === 15) {
        showCombo('🚀 Mega Combo x15!');
        burst('fever');
        beep(1160, 0.11);
        vibrate([30, 20, 30]);
      } else if (combo > 0 && combo % 20 === 0) {
        showCombo(`🏆 Ultra Combo x${combo}!`);
        burst('fever');
        stageToast('unstoppable!');
      }

      state.lastCombo = combo;
    }

    if (score !== state.lastScore) {
      state.lastScore = score;
    }
  }

  function handleFever(s) {
    const active = Boolean(s.feverActive);

    DOC.body.classList.toggle('v97-fever-extreme', active);

    if (active && Date.now() - state.lastPulseAt > 1200) {
      state.lastPulseAt = Date.now();
      burst('fever');
    }
  }

  function poll() {
    const s = gameState();

    if (!s || !s.mode) return;

    DOC.body.classList.toggle('v97-thrill-on', s.mode === 'game');

    handlePhase(s);
    handleCombo(s);
    handleFever(s);
    nearGroundDanger(s);

    if (!isGameActive(s)) {
      DOC.body.classList.remove('v97-danger', 'v97-boss', 'v97-fever-extreme');
    }
  }

  function installEvents() {
    WIN.addEventListener('groups:judge', function (ev) {
      const d = ev.detail || {};
      const s = gameState();

      if (d.ok || d.correct) {
        pulseBody('v97-hit', 160);

        if (d.kind === 'golden') {
          burst('golden');
          showCombo('⭐ Golden Hit!');
        } else if (d.feverActive) {
          burst('fever');
        } else {
          burst('good');
        }

        if ((d.phase || s.phase) === 'boss') {
          state.bossHp = Math.min(state.bossMax, state.bossHp + 1);
          updateBossBar();

          if (state.bossHp >= state.bossMax) {
            stageToast('👑 Boss Broken!');
            burst('boss');
            beep(1080, 0.12);
            vibrate([35, 20, 35]);
            state.bossHp = 0;
            setTimeout(updateBossBar, 220);
          }
        }
      } else {
        pulseBody('v97-miss', 240);
        burst('miss');
        showCombo('ระวัง! คอมโบหลุด');
      }
    });

    WIN.addEventListener('groups:decoy-dodged', function () {
      showCombo('🚫 หลบตัวหลอก!');
      burst('good');
      beep(740, 0.08);
    });

    WIN.addEventListener('groups:fever', function () {
      stageToast('🔥 FEVER MODE!');
      burst('fever');
      beep(1260, 0.13);
    });

    WIN.addEventListener('groups:shield-used', function () {
      showCombo('🛡️ Shield Save!');
      burst('good');
    });

    WIN.addEventListener('groups:end', function () {
      DOC.body.classList.remove(
        'v97-danger',
        'v97-boss',
        'v97-fever-extreme',
        'v97-hit',
        'v97-miss'
      );
      state.bossHp = 0;
      updateBossBar();
    });

    DOC.addEventListener('pointerdown', unlockAudio, { once: true, passive: true });
    DOC.addEventListener('touchstart', unlockAudio, { once: true, passive: true });
  }

  function init() {
    injectStyle();
    ensureLayer();
    installEvents();

    state.poll = setInterval(poll, 120);

    WIN.HHA_GROUPS_MOBILE_V97_THRILL = {
      version: VERSION,
      poll,
      stageToast,
      showCombo,
      burst,
      getState: function () {
        return {
          version: VERSION,
          bossHp: state.bossHp,
          bossMax: state.bossMax,
          lastCombo: state.lastCombo,
          lastPhase: state.lastPhase
        };
      }
    };

    console.info('[Groups Mobile v9.7] thrill layer installed', VERSION);
  }

  if (DOC.readyState === 'loading') {
    DOC.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
