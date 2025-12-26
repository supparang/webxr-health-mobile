// === /herohealth/vr/hha-hud.js ===
// Hero Health Academy — Global HUD Binder (DOM/VR) — PRO PACK
// ✅ Updates: score/time/rank/quests/coach/end
// ✅ NEW: Counter window badge + Pulse overlay (bossPulse) + light Audio hooks (tick/counter/bossAtk)
// ✅ Safe: no double bind, safe if elements missing

(function (root) {
  'use strict';

  const doc = root.document;
  if (!doc) return;

  if (root.__HHA_HUD_BOUND__) return;
  root.__HHA_HUD_BOUND__ = true;

  const $ = (id) => doc.getElementById(id);

  // ---------- CSS (inject once) ----------
  function injectCSS() {
    if (doc.getElementById('hha-hud-pro-css')) return;
    const style = doc.createElement('style');
    style.id = 'hha-hud-pro-css';
    style.textContent = `
      .hha-float-layer{
        position:fixed; inset:0;
        z-index: 70;
        pointer-events:none;
      }
      .hha-counter-badge{
        position:fixed;
        left:50%;
        top: calc(10px + 78px);
        transform: translateX(-50%);
        z-index: 72;
        display:none;
        pointer-events:none;
        padding: 10px 12px;
        border-radius: 999px;
        background: rgba(2,6,23,.72);
        border: 1px solid rgba(148,163,184,.22);
        box-shadow: 0 18px 50px rgba(0,0,0,.42);
        backdrop-filter: blur(10px);
        font-family: system-ui,-apple-system,Segoe UI,Roboto,Arial;
        font-weight: 1000;
        font-size: 12px;
        letter-spacing: .2px;
        opacity: .98;
      }
      .hha-counter-badge.on{
        box-shadow:
          0 18px 50px rgba(0,0,0,.42),
          0 0 26px rgba(34,197,94,.18),
          0 0 50px rgba(245,158,11,.10);
        border-color: rgba(34,197,94,.26);
      }
      .hha-counter-bar{
        height: 8px;
        width: 140px;
        border-radius: 999px;
        overflow:hidden;
        background: rgba(255,255,255,.10);
        border: 1px solid rgba(255,255,255,.14);
        margin-left: 10px;
      }
      .hha-counter-fill{
        height:100%;
        width:100%;
        border-radius:999px;
        background: linear-gradient(90deg, rgba(34,197,94,.92), rgba(245,158,11,.90));
        transform: translateZ(0);
      }

      .hha-pulse{
        position:fixed;
        width: 160px;
        height: 160px;
        border-radius: 999px;
        transform: translate(-50%, -50%);
        border: 2px solid rgba(34,197,94,.82);
        box-shadow:
          0 0 0 6px rgba(34,197,94,.14),
          0 0 28px rgba(34,197,94,.18),
          0 0 52px rgba(245,158,11,.08);
        background: radial-gradient(circle at 50% 50%,
          rgba(34,197,94,.12) 0%,
          rgba(34,197,94,.08) 35%,
          rgba(34,197,94,0) 70%);
        opacity: 0;
        pointer-events:none;
        z-index: 71;
        transition: opacity .08s linear, transform .08s linear;
      }
      .hha-pulse.on{ opacity: .98; }
      .hha-pulse small{
        position:absolute;
        left:50%; top:50%;
        transform: translate(-50%,-50%);
        font-family: system-ui,-apple-system,Segoe UI,Roboto,Arial;
        font-weight: 1000;
        font-size: 12px;
        letter-spacing:.2px;
        color: rgba(255,255,255,.92);
        text-shadow: 0 10px 25px rgba(0,0,0,.55);
      }

      .hha-mini-toast{
        position:fixed;
        left:50%;
        bottom: 86px;
        transform: translateX(-50%);
        z-index: 73;
        display:none;
        pointer-events:none;
        padding: 10px 12px;
        border-radius: 16px;
        background: rgba(2,6,23,.72);
        border: 1px solid rgba(148,163,184,.22);
        box-shadow: 0 18px 50px rgba(0,0,0,.42);
        backdrop-filter: blur(10px);
        font-family: system-ui,-apple-system,Segoe UI,Roboto,Arial;
        font-weight: 950;
        font-size: 12px;
        opacity:.98;
      }
      .hha-mini-toast.on{ display:block; }
      @media (max-height: 640px){
        .hha-counter-badge{ top: calc(10px + 64px); }
      }
    `;
    doc.head.appendChild(style);
  }

  // ---------- Floating layer ----------
  let floatLayer = null;
  let pulseEl = null;
  let counterEl = null;
  let counterFill = null;
  let toastEl = null;

  function ensureFloatLayer() {
    injectCSS();
    if (floatLayer) return;

    floatLayer = doc.createElement('div');
    floatLayer.className = 'hha-float-layer';

    pulseEl = doc.createElement('div');
    pulseEl.className = 'hha-pulse';
    pulseEl.innerHTML = `<small>⚡ PULSE</small>`;

    counterEl = doc.createElement('div');
    counterEl.className = 'hha-counter-badge';
    counterEl.innerHTML = `🛡️ <span>COUNTER!</span>
      <div class="hha-counter-bar"><div class="hha-counter-fill"></div></div>`;

    counterFill = counterEl.querySelector('.hha-counter-fill');

    toastEl = doc.createElement('div');
    toastEl.className = 'hha-mini-toast';

    floatLayer.appendChild(pulseEl);
    floatLayer.appendChild(counterEl);
    floatLayer.appendChild(toastEl);

    (doc.body || doc.documentElement).appendChild(floatLayer);
  }

  // ---------- Tiny audio (WebAudio) ----------
  let audioCtx = null;
  let audioOK = false;

  function ensureAudio() {
    if (audioCtx) return;
    try {
      const AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return;
      audioCtx = new AC();
      audioOK = true;
    } catch (_) {
      audioOK = false;
    }
  }

  function beep(freq, durMs, gain) {
    if (!audioOK || !audioCtx) return;
    try {
      const t0 = audioCtx.currentTime;
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = 'sine';
      o.frequency.value = Math.max(80, Number(freq) || 440);
      g.gain.value = 0.0001;

      o.connect(g);
      g.connect(audioCtx.destination);

      const peak = Math.min(0.12, Math.max(0.01, Number(gain) || 0.06));
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(peak, t0 + 0.010);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + (Math.max(40, durMs|0) / 1000));

      o.start(t0);
      o.stop(t0 + (Math.max(40, durMs|0) / 1000) + 0.02);
    } catch (_) {}
  }

  // arm audio on first gesture
  root.addEventListener('pointerdown', () => {
    ensureAudio();
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
  }, { passive:true, once:true });

  // ---------- Helpers ----------
  function setText(id, v) {
    const el = $(id);
    if (el) el.textContent = String(v);
  }

  function setWidth(id, pct) {
    const el = $(id);
    if (el) el.style.width = Math.max(0, Math.min(100, Number(pct)||0)) + '%';
  }

  function showToast(msg, ms=900) {
    ensureFloatLayer();
    if (!toastEl) return;
    toastEl.textContent = String(msg || '');
    toastEl.classList.add('on');
    setTimeout(() => { try{ toastEl.classList.remove('on'); }catch(_){} }, Math.max(250, ms|0));
  }

  // ---------- Counter badge ----------
  let counterHideT = 0;
  function showCounter(msLeft, msTotal, kind) {
    ensureFloatLayer();
    if (!counterEl || !counterFill) return;

    const total = Math.max(50, msTotal|0);
    const left  = Math.max(0, msLeft|0);
    const pct = Math.max(0, Math.min(1, left / total));

    counterEl.style.display = 'inline-flex';
    counterEl.classList.add('on');
    counterFill.style.width = Math.round(pct * 100) + '%';

    // different beeps by kind
    if (kind === 'open') beep(740, 60, 0.06);
    if (kind === 'success') beep(980, 90, 0.08);
    if (kind === 'fail') beep(220, 110, 0.07);

    clearTimeout(counterHideT);
    counterHideT = setTimeout(() => {
      try { counterEl.style.display = 'none'; counterEl.classList.remove('on'); } catch(_) {}
    }, 180);
  }

  function hideCounter() {
    ensureFloatLayer();
    try { counterEl.style.display = 'none'; counterEl.classList.remove('on'); } catch(_) {}
  }

  // ---------- Pulse overlay ----------
  let pulseHideT = 0;
  function showPulse(x, y, ttlMs) {
    ensureFloatLayer();
    if (!pulseEl) return;

    pulseEl.style.left = (x|0) + 'px';
    pulseEl.style.top  = (y|0) + 'px';
    pulseEl.classList.add('on');

    // subtle ping
    beep(520, 70, 0.05);

    clearTimeout(pulseHideT);
    pulseHideT = setTimeout(() => {
      try { pulseEl.classList.remove('on'); } catch(_) {}
    }, Math.max(120, ttlMs|0));
  }

  // ---------- Event bindings ----------
  // score
  root.addEventListener('hha:score', (ev) => {
    const d = (ev && ev.detail) ? ev.detail : {};
    if (d.score != null) setText('hhaScore', d.score|0);
    if (d.combo != null) setText('hhaCombo', d.combo|0);
    if (d.misses != null) setText('hhaMiss', d.misses|0);

    // optional: show small toast on shield change
    if (d.shield != null && d._toastShield) showToast(`🛡️ SHIELD ${d.shield|0}`, 650);
  });

  // time (compat)
  root.addEventListener('hha:time', (ev) => {
    const d = (ev && ev.detail) ? ev.detail : {};
    if (d.sec != null) setText('hhaTime', d.sec|0);
  });

  // rank ticker
  root.addEventListener('hha:rank', (ev) => {
    const d = (ev && ev.detail) ? ev.detail : {};
    if (d.grade != null) setText('hhaGrade', d.grade);
  });

  // quests
  root.addEventListener('quest:update', (ev) => {
    const d = (ev && ev.detail) ? ev.detail : {};
    // goal
    const g = d.goal || null;
    const m = d.mini || null;

    const gTitle = g ? (g.title || 'Goal') : (d.goalTitle || 'Goal');
    const gCur   = g ? (g.cur|0) : (d.goalCur|0);
    const gTgt   = g ? (g.target|0) : (d.goalTarget|0);

    setText('qGoalTitle', `Goal: ${gTitle || '—'}`);
    setText('qGoalCur', gCur|0);
    setText('qGoalMax', gTgt|0);
    setWidth('qGoalFill', (gTgt>0 ? (gCur/gTgt)*100 : 0));

    // mini
    const mTitle = m ? (m.title || 'Mini') : (d.miniTitle || 'Mini');
    const mCur   = m ? (m.cur|0) : (d.miniCur|0);
    const mTgt   = m ? (m.target|0) : (d.miniTarget|0);

    setText('qMiniTitle', `Mini: ${mTitle || '—'}`);
    setText('qMiniCur', mCur|0);
    setText('qMiniMax', mTgt|0);
    setWidth('qMiniFill', (mTgt>0 ? (mCur/mTgt)*100 : 0));

    // mini timer (optional)
    const tLeft = (m && m.tLeft != null) ? m.tLeft : d.miniTLeft;
    if (tLeft != null && $('qMiniTLeft')) $('qMiniTLeft').textContent = String(tLeft);
  });

  // coach
  root.addEventListener('hha:coach', (ev) => {
    const d = (ev && ev.detail) ? ev.detail : {};
    if (d.line != null) setText('hhaCoachLine', d.line);
    if (d.sub != null) setText('hhaCoachSub', d.sub);
    if (d.mood != null && $('hhaCoachImg')) {
      const mood = String(d.mood||'neutral');
      const map = {
        happy: './img/coach-happy.png',
        sad: './img/coach-sad.png',
        fever: './img/coach-fever.png',
        neutral: './img/coach-neutral.png'
      };
      $('hhaCoachImg').src = map[mood] || map.neutral;
    }
  });

  // end summary (if page provides end elements)
  root.addEventListener('hha:end', (ev) => {
    const d = (ev && ev.detail) ? ev.detail : {};
    // If the HTML fallback exists, let it show; but also toast a “GG”
    showToast(`🎉 จบเกม! GRADE ${d.grade || '—'}`, 1100);
    beep(660, 90, 0.06);
    setTimeout(()=>beep(880, 120, 0.07), 90);
  });

  // boss pulse
  root.addEventListener('hha:bossPulse', (ev) => {
    const d = (ev && ev.detail) ? ev.detail : {};
    if (d.x != null && d.y != null) showPulse(d.x|0, d.y|0, d.ttlMs|0);
  });

  // counter window
  root.addEventListener('hha:counter', (ev) => {
    const d = (ev && ev.detail) ? ev.detail : {};
    if (!d || d.active === false) { hideCounter(); return; }
    showCounter(d.msLeft|0, d.msTotal|0, d.kind || 'open');
  });

  // tick (ring/laser/final)
  root.addEventListener('hha:tick', (ev) => {
    const d = (ev && ev.detail) ? ev.detail : {};
    const kind = String(d.kind || 'tick');
    const intensity = Math.max(0.2, Math.min(3, Number(d.intensity)||1));
    // map to tones
    if (kind.includes('laser')) beep(520 + 60*intensity, 45, 0.035);
    else if (kind.includes('ring')) beep(430 + 45*intensity, 45, 0.035);
    else if (kind.includes('final')) beep(700 + 70*intensity, 45, 0.04);
  });

  // boss atk (optional cue)
  root.addEventListener('hha:bossAtk', (ev) => {
    const d = (ev && ev.detail) ? ev.detail : {};
    const name = String(d.name || '');
    if (!name) return;
    if (name === 'ring') showToast('⚠️ RING! หา “ช่องว่าง” แล้วหลบ', 900);
    if (name === 'laser') showToast('⚠️ LASER! หลบเส้น!', 900);
    if (name === 'storm') showToast('⚠️ STORM! คุมจังหวะ!', 900);
  });

  // init
  ensureFloatLayer();

})(window);