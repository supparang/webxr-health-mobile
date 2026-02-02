// === /herohealth/vr/hha-fx-director.js ===
// HHA FX Director — PRODUCTION (SAFE, NO-DEPS)
// ✅ Ensures a shared FX layer + CSS keyframes
// ✅ Guarantees Particles.scorePop / Particles.burstAt exist (even if particles.js minimal)
// ✅ Listens to common HHA events:
//    - hha:judge {label}
//    - hha:celebrate {kind, grade}
//    - quest:update {goal, mini}
//    - hha:time {t}   (seconds left)
// ✅ Adds intensity states (GoodJunk defaults):
//    - time <= 30  => STORM
//    - miss >= 4   => BOSS
//    - miss >= 5   => RAGE
// ✅ Safe: never throws, never blocks UI (pointer-events:none)

(function (root) {
  'use strict';

  const DOC = root.document;
  if (!DOC || root.__HHA_FX_DIRECTOR__) return;
  root.__HHA_FX_DIRECTOR__ = true;

  // ---------- helpers ----------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const now = () => (root.performance ? root.performance.now() : Date.now());
  const rand = (a, b) => a + Math.random() * (b - a);
  const byId = (id) => DOC.getElementById(id);

  function safeParseNum(s, def = 0) {
    const n = Number(String(s || '').replace(/[^\d.\-]/g, ''));
    return Number.isFinite(n) ? n : def;
  }

  function ensureFxLayer() {
    let layer = DOC.querySelector('.hha-fx-layer');
    if (layer) return layer;

    layer = DOC.createElement('div');
    layer.className = 'hha-fx-layer';
    // z-index สูงพอให้ "ไม่หาย" แม้ HUD/overlay เยอะ (แต่ pointer-events:none ไม่บังปุ่ม)
    layer.style.cssText =
      'position:fixed;inset:0;pointer-events:none;z-index:260;overflow:hidden;';

    DOC.body.appendChild(layer);
    return layer;
  }

  function injectCssOnce() {
    if (DOC.getElementById('hha-fx-style')) return;

    const st = DOC.createElement('style');
    st.id = 'hha-fx-style';
    st.textContent = `
      .hha-fx-layer{ contain: layout paint; }
      .hha-fx-pop{
        position:absolute;
        transform: translate(-50%,-50%);
        font: 900 18px/1 system-ui, -apple-system, "Segoe UI", "Noto Sans Thai", sans-serif;
        color:#fff;
        text-shadow: 0 10px 26px rgba(0,0,0,.55);
        opacity:.98;
        will-change: transform, opacity, filter;
        animation: hhaPop 560ms ease-out forwards;
        filter: drop-shadow(0 10px 20px rgba(0,0,0,.35));
      }
      @keyframes hhaPop{
        0%{ transform:translate(-50%,-40%) scale(.92); opacity:.92; }
        55%{ transform:translate(-50%,-78%) scale(1.18); opacity:1; }
        100%{ transform:translate(-50%,-96%) scale(1.05); opacity:0; }
      }

      .hha-burst{
        position:absolute;
        width:10px; height:10px;
        left:0; top:0;
        transform: translate(-50%,-50%);
        border-radius: 999px;
        opacity: .95;
        will-change: transform, opacity;
        animation: hhaBurst 520ms ease-out forwards;
        mix-blend-mode: screen;
      }
      @keyframes hhaBurst{
        0%{ transform:translate(-50%,-50%) scale(.55); opacity:.9; }
        70%{ transform:translate(-50%,-50%) scale(4.2); opacity:.75; }
        100%{ transform:translate(-50%,-50%) scale(6.8); opacity:0; }
      }

      /* Screen pulse states (storm/boss/rage) */
      body.hha-storm::before,
      body.hha-boss::before,
      body.hha-rage::before{
        content:"";
        position:fixed; inset:0;
        pointer-events:none;
        z-index:240;
        opacity:0;
        transition: opacity 180ms ease;
      }
      body.hha-storm::before{
        background:
          radial-gradient(1200px 700px at 50% 35%, rgba(56,189,248,.14), transparent 60%),
          radial-gradient(900px 520px at 30% 80%, rgba(34,197,94,.08), transparent 58%),
          radial-gradient(900px 520px at 70% 80%, rgba(168,85,247,.08), transparent 58%);
        opacity:.9;
        animation: hhaStormPulse 1.1s ease-in-out infinite;
      }
      @keyframes hhaStormPulse{
        0%,100%{ filter: saturate(1.05) brightness(1); }
        50%{ filter: saturate(1.2) brightness(1.05); }
      }

      body.hha-boss::before{
        background:
          radial-gradient(1100px 650px at 50% 40%, rgba(245,158,11,.14), transparent 62%),
          radial-gradient(900px 520px at 20% 90%, rgba(239,68,68,.08), transparent 60%),
          radial-gradient(900px 520px at 80% 90%, rgba(239,68,68,.08), transparent 60%);
        opacity:.92;
        animation: hhaBossThump .85s ease-in-out infinite;
      }
      @keyframes hhaBossThump{
        0%,100%{ transform:translateZ(0); }
        50%{ transform:translateZ(0) scale(1.01); }
      }

      body.hha-rage::before{
        background:
          radial-gradient(1000px 600px at 50% 45%, rgba(239,68,68,.16), transparent 63%),
          radial-gradient(800px 480px at 30% 85%, rgba(244,63,94,.10), transparent 60%),
          radial-gradient(800px 480px at 70% 85%, rgba(244,63,94,.10), transparent 60%);
        opacity:.95;
        animation: hhaRageFlicker .65s linear infinite;
      }
      @keyframes hhaRageFlicker{
        0%{ filter: contrast(1.05) brightness(1.0); }
        35%{ filter: contrast(1.10) brightness(1.06); }
        70%{ filter: contrast(1.02) brightness(1.02); }
        100%{ filter: contrast(1.06) brightness(1.0); }
      }

      /* Optional little shake */
      body.hha-shake{
        animation: hhaShake 180ms linear 1;
      }
      @keyframes hhaShake{
        0%{ transform: translate(0,0); }
        25%{ transform: translate(2px,-1px); }
        50%{ transform: translate(-2px,1px); }
        75%{ transform: translate(2px,1px); }
        100%{ transform: translate(0,0); }
      }
    `;
    DOC.head.appendChild(st);
  }

  function popText(x, y, text) {
    try {
      injectCssOnce();
      const layer = ensureFxLayer();
      const el = DOC.createElement('div');
      el.className = 'hha-fx-pop';
      el.textContent = String(text || '');
      el.style.left = Math.round(x) + 'px';
      el.style.top = Math.round(y) + 'px';
      layer.appendChild(el);
      setTimeout(() => { try { el.remove(); } catch (_) {} }, 650);
    } catch (_) {}
  }

  function burstAt(x, y, kind) {
    try {
      injectCssOnce();
      const layer = ensureFxLayer();
      const el = DOC.createElement('div');
      el.className = 'hha-burst';
      el.style.left = Math.round(x) + 'px';
      el.style.top = Math.round(y) + 'px';

      // kind → โทนต่างกัน (ไม่กำหนดสีแบบตายตัวด้วย CSS theme; ใช้ opacity/gradient)
      const k = String(kind || 'good');
      if (k === 'bad' || k === 'junk' || k === 'miss') {
        el.style.background = 'radial-gradient(circle, rgba(239,68,68,.95), rgba(239,68,68,.10), transparent 70%)';
      } else if (k === 'star') {
        el.style.background = 'radial-gradient(circle, rgba(250,204,21,.95), rgba(250,204,21,.12), transparent 70%)';
      } else if (k === 'shield' || k === 'block') {
        el.style.background = 'radial-gradient(circle, rgba(34,197,94,.92), rgba(34,197,94,.10), transparent 70%)';
      } else if (k === 'diamond') {
        el.style.background = 'radial-gradient(circle, rgba(56,189,248,.92), rgba(56,189,248,.10), transparent 70%)';
      } else {
        el.style.background = 'radial-gradient(circle, rgba(167,139,250,.92), rgba(167,139,250,.10), transparent 70%)';
      }

      layer.appendChild(el);
      setTimeout(() => { try { el.remove(); } catch (_) {} }, 560);
    } catch (_) {}
  }

  function scorePop(x, y, text) {
    // ใช้ popText เป็นหลัก แต่เพิ่ม “แรง” อีกนิดด้วย burst บาง ๆ
    try {
      popText(x, y, text);
      burstAt(x, y, String(text || '').includes('-') ? 'bad' : 'good');
    } catch (_) {}
  }

  function shake(ms) {
    try {
      DOC.body.classList.add('hha-shake');
      setTimeout(() => { try { DOC.body.classList.remove('hha-shake'); } catch (_) {} }, clamp(ms || 180, 80, 420));
    } catch (_) {}
  }

  // ---------- guarantee Particles API ----------
  function ensureParticlesApi() {
    try {
      root.Particles = root.Particles || {};
      if (typeof root.Particles.popText !== 'function') root.Particles.popText = popText;
      if (typeof root.Particles.burstAt !== 'function') root.Particles.burstAt = burstAt;
      if (typeof root.Particles.scorePop !== 'function') root.Particles.scorePop = scorePop;
    } catch (_) {}
  }

  // ---------- shared FX facade ----------
  const HHA_FX = {
    layer: ensureFxLayer,
    popText,
    burstAt,
    scorePop,
    shake,

    setStorm(on) {
      try { DOC.body.classList.toggle('hha-storm', !!on); } catch (_) {}
    },
    setBoss(on) {
      try { DOC.body.classList.toggle('hha-boss', !!on); } catch (_) {}
    },
    setRage(on) {
      try { DOC.body.classList.toggle('hha-rage', !!on); } catch (_) {}
    }
  };

  root.HHA_FX = root.HHA_FX || HHA_FX;

  // ---------- state machine (storm/boss/rage) ----------
  const FXSTATE = {
    stormOn: false,
    bossOn: false,
    rageOn: false,
    lastJudgeAt: 0
  };

  function readMiss() {
    // GoodJunk: #hud-miss
    const el = byId('hud-miss');
    if (!el) return 0;
    return safeParseNum(el.textContent, 0);
  }

  function setStormIfNeeded(tSecLeft) {
    // requirement: time <= 30s => storm
    const want = Number(tSecLeft) <= 30;
    if (want !== FXSTATE.stormOn) {
      FXSTATE.stormOn = want;
      HHA_FX.setStorm(want);
      if (want) HHA_FX.popText(innerW()*0.5, innerH()*0.18, '⛈️ STORM!');
    }
  }

  function setBossRageIfNeeded() {
    // requirement: miss >= 4 => boss, miss >= 5 => rage
    const miss = readMiss();
    const wantBoss = miss >= 4;
    const wantRage = miss >= 5;

    if (wantBoss !== FXSTATE.bossOn) {
      FXSTATE.bossOn = wantBoss;
      HHA_FX.setBoss(wantBoss);
      if (wantBoss) { HHA_FX.popText(innerW()*0.5, innerH()*0.22, '👑 BOSS!'); HHA_FX.shake(180); }
    }

    if (wantRage !== FXSTATE.rageOn) {
      FXSTATE.rageOn = wantRage;
      HHA_FX.setRage(wantRage);
      if (wantRage) { HHA_FX.popText(innerW()*0.5, innerH()*0.26, '🔥 RAGE!'); HHA_FX.shake(240); }
    }
  }

  function innerW(){ return DOC.documentElement.clientWidth || root.innerWidth || 360; }
  function innerH(){ return DOC.documentElement.clientHeight || root.innerHeight || 640; }

  // ---------- event listeners ----------
  function onJudge(ev) {
    try {
      ensureParticlesApi();
      injectCssOnce();
      ensureFxLayer();

      const d = ev && ev.detail ? ev.detail : {};
      const label = String(d.label || '').trim();
      const t = now();

      // rate-limit judge spam (กันเด้งถี่จนเหมือนหาย)
      if (t - FXSTATE.lastJudgeAt < 45) return;
      FXSTATE.lastJudgeAt = t;

      // position: center-ish but slightly above crosshair
      const x = innerW() * rand(0.45, 0.55);
      const y = innerH() * rand(0.40, 0.50);

      if (!label) return;

      // mapping label -> style
      const up = label.toUpperCase();
      if (up.includes('MISS')) {
        HHA_FX.scorePop(x, y, 'MISS');
        HHA_FX.shake(160);
      } else if (up.includes('OOPS') || up.includes('BAD')) {
        HHA_FX.scorePop(x, y, 'OOPS!');
        HHA_FX.shake(140);
      } else if (up.includes('BLOCK')) {
        HHA_FX.scorePop(x, y, 'BLOCK!');
        HHA_FX.burstAt(x, y, 'block');
      } else if (up.includes('STAR')) {
        HHA_FX.scorePop(x, y, '⭐ MISS -1');
        HHA_FX.burstAt(x, y, 'star');
      } else if (up.includes('SHIELD')) {
        HHA_FX.scorePop(x, y, '🛡️ +1');
        HHA_FX.burstAt(x, y, 'shield');
      } else if (up.includes('DIAMOND')) {
        HHA_FX.scorePop(x, y, '💎 BONUS!');
        HHA_FX.burstAt(x, y, 'diamond');
      } else if (up.includes('MINI')) {
        HHA_FX.scorePop(x, y, '✅ MINI!');
      } else if (up.includes('GOAL')) {
        HHA_FX.scorePop(x, y, '🎯 GOAL!');
      } else if (up.includes('FAST')) {
        HHA_FX.scorePop(x, y, '⚡ FAST!');
      } else {
        // GOOD or generic
        HHA_FX.scorePop(x, y, label);
      }

      // after any judge update boss/rage check
      setBossRageIfNeeded();

    } catch (_) {}
  }

  function onCelebrate(ev) {
    try {
      ensureParticlesApi();
      injectCssOnce();
      ensureFxLayer();

      const d = ev && ev.detail ? ev.detail : {};
      const kind = String(d.kind || '').toLowerCase();
      const grade = String(d.grade || '').toUpperCase();

      const x = innerW() * 0.5;
      const y = innerH() * 0.22;

      if (kind === 'mini') {
        HHA_FX.popText(x, y, '✨ MINI CLEAR!');
        for (let i=0;i<3;i++) HHA_FX.burstAt(innerW()*rand(0.25,0.75), innerH()*rand(0.35,0.65), 'star');
      } else if (kind === 'end') {
        HHA_FX.popText(x, y, `🏁 FINISH ${grade || ''}`.trim());
        for (let i=0;i<6;i++) HHA_FX.burstAt(innerW()*rand(0.2,0.8), innerH()*rand(0.25,0.7), 'good');
      } else {
        HHA_FX.popText(x, y, '🎉');
        HHA_FX.burstAt(x, y, 'good');
      }
    } catch (_) {}
  }

  function onQuestUpdate(ev) {
    // เบา ๆ ไม่ทำให้รก แต่ช่วยให้ “รู้สึกว่าระบบยังทำงาน”
    try {
      const d = ev && ev.detail ? ev.detail : {};
      const goal = d.goal || null;
      const mini = d.mini || null;

      // แสดงเฉพาะตอนมีการสลับ mini/goal ชัด ๆ
      if (mini && mini.done) return;

      // ไม่ pop ถี่
      if (Math.random() < 0.35) return;

      const x = innerW() * 0.5;
      const y = innerH() * 0.30;

      if (mini && mini.title && mini.cur === 0) {
        HHA_FX.popText(x, y, `MINI: ${mini.title}`);
      } else if (goal && goal.title && goal.cur === 0) {
        HHA_FX.popText(x, y, `GOAL: ${goal.title}`);
      }
    } catch (_) {}
  }

  function onTime(ev) {
    try {
      const d = ev && ev.detail ? ev.detail : {};
      const tSec = Number(d.t);
      if (!Number.isFinite(tSec)) return;

      // storm trigger
      setStormIfNeeded(tSec);

      // boss/rage check occasionally near end
      if (tSec <= 30) setBossRageIfNeeded();
    } catch (_) {}
  }

  // ---------- init ----------
  try {
    ensureParticlesApi();
    injectCssOnce();
    ensureFxLayer();

    root.addEventListener('hha:judge', onJudge, { passive:true });
    root.addEventListener('hha:celebrate', onCelebrate, { passive:true });
    root.addEventListener('quest:update', onQuestUpdate, { passive:true });
    root.addEventListener('hha:time', onTime, { passive:true });

    // also listen from document (บางเกม dispatch ที่ document)
    DOC.addEventListener('hha:judge', onJudge, { passive:true });
    DOC.addEventListener('hha:celebrate', onCelebrate, { passive:true });
    DOC.addEventListener('quest:update', onQuestUpdate, { passive:true });
    DOC.addEventListener('hha:time', onTime, { passive:true });

  } catch (_) {}

})(window);