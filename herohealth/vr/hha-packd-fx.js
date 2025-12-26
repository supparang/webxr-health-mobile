// === /herohealth/vr/hha-packd-fx.js ===
// HeroHealth PACK D FX (No engine changes)
// Listens:
// - hha:tick {kind,intensity}
// - hha:finalPulse {secLeft}
// - hha:bossAtk {name}
// - hha:fx {type,intensity,ms}  (kick/chroma/hero)
// - hha:panic {level,ms}
// - hha:storm {active}
// Adds:
// - Screen shake (body transform)
// - Vignette border pulse (warn/final/ring/laser)
// - Flash / chroma-ish pulse
// - Beep ticks (WebAudio, auto-unlock on first interaction)
// - Small toast (fallback if Particles.toast not available)

(function (root) {
  'use strict';

  const win = root;
  const doc = win.document;
  if (!doc) return;

  const now = () => (win.performance && performance.now) ? performance.now() : Date.now();
  const clamp = (v,a,b)=> Math.max(a, Math.min(b, v));

  // Optional global Particles (if exists)
  const Particles =
    (win.GAME_MODULES && win.GAME_MODULES.Particles) ||
    win.Particles || null;

  // ------------------------
  // Ensure CSS + FX elements
  // ------------------------
  function ensureStyle() {
    if (doc.getElementById('hha-packd-style')) return;

    const style = doc.createElement('style');
    style.id = 'hha-packd-style';
    style.textContent = `
/* --- HHA PACK D FX (injected) --- */
:root{
  --hhaShakeX: 0px;
  --hhaShakeY: 0px;
  --hhaPulse: 0;
  --hhaVigA: 0;
  --hhaVigB: 0;
  --hhaVigColor: 239,68,68; /* danger default */
}

body.hha-shaking{
  transform: translate3d(var(--hhaShakeX), var(--hhaShakeY), 0);
  will-change: transform, filter;
}

#hhaPackdFx{
  position: fixed;
  inset: 0;
  z-index: 70; /* above playfield, under start overlay (60)?? your start is 60, end is 80 */
  pointer-events: none;
}

#hhaPackdVignette{
  position:absolute; inset:-2px;
  opacity: 1;
  transition: opacity .08s linear;
  background:
    radial-gradient(900px 700px at 50% 50%,
      rgba(0,0,0,0) 55%,
      rgba(var(--hhaVigColor), calc(.06 + var(--hhaVigA)*.22)) 70%,
      rgba(var(--hhaVigColor), calc(.10 + var(--hhaVigB)*.32)) 100%);
  mix-blend-mode: screen;
  filter: blur(.2px);
}

#hhaPackdFlash{
  position:absolute; inset:0;
  opacity: 0;
  background: radial-gradient(800px 520px at 50% 55%,
    rgba(255,255,255,.35), rgba(255,255,255,0) 55%);
  transition: opacity .10s ease;
  mix-blend-mode: screen;
}

#hhaPackdToast{
  position:absolute;
  left: 50%;
  top: 14%;
  transform: translateX(-50%);
  padding: 10px 12px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.18);
  background: rgba(2,6,23,.55);
  backdrop-filter: blur(10px);
  color: rgba(255,255,255,.92);
  font-weight: 950;
  font-family: system-ui,-apple-system,Segoe UI,Roboto,Arial;
  font-size: 12px;
  letter-spacing: .2px;
  opacity: 0;
  transition: opacity .12s ease, transform .12s ease;
  box-shadow: 0 18px 60px rgba(0,0,0,.45);
}

#hhaPackdToast.show{
  opacity: 1;
  transform: translateX(-50%) translateY(-2px);
}

body.hha-chroma{
  filter: saturate(1.25) contrast(1.08);
}

body.hha-hero{
  filter: saturate(1.38) contrast(1.10) brightness(1.03);
}
`;
    doc.head.appendChild(style);
  }

  function ensureFxLayer() {
    let fx = doc.getElementById('hhaPackdFx');
    if (!fx) {
      fx = doc.createElement('div');
      fx.id = 'hhaPackdFx';

      const vig = doc.createElement('div');
      vig.id = 'hhaPackdVignette';

      const flash = doc.createElement('div');
      flash.id = 'hhaPackdFlash';

      const toast = doc.createElement('div');
      toast.id = 'hhaPackdToast';
      toast.textContent = '';

      fx.appendChild(vig);
      fx.appendChild(flash);
      fx.appendChild(toast);
      doc.body.appendChild(fx);
    }
    return fx;
  }

  ensureStyle();
  ensureFxLayer();

  const rootEl = doc.documentElement;
  const body = doc.body;
  const vig = doc.getElementById('hhaPackdVignette');
  const flash = doc.getElementById('hhaPackdFlash');
  const toast = doc.getElementById('hhaPackdToast');

  // -------------
  // Toast helper
  // -------------
  let toastTimer = 0;
  function showToast(msg, ms=900){
    if (!msg) return;
    // Prefer Particles.toast if available
    if (Particles && typeof Particles.toast === 'function') {
      try { Particles.toast(String(msg), { ms }); return; } catch (_) {}
    }
    toast.textContent = String(msg);
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(()=> toast.classList.remove('show'), Math.max(250, ms|0));
  }

  // ----------------
  // WebAudio ticks
  // ----------------
  let AC = null, unlocked = false;

  function ensureAudio(){
    if (AC) return AC;
    const Ctx = win.AudioContext || win.webkitAudioContext;
    if (!Ctx) return null;
    AC = new Ctx();
    return AC;
  }

  function unlockAudio(){
    if (unlocked) return;
    const ac = ensureAudio();
    if (!ac) { unlocked = true; return; }
    // resume on user gesture
    if (ac.state === 'suspended') {
      ac.resume().catch(()=>{});
    }
    // tiny silent blip to unlock on iOS
    try{
      const o = ac.createOscillator();
      const g = ac.createGain();
      g.gain.value = 0.0001;
      o.frequency.value = 220;
      o.connect(g); g.connect(ac.destination);
      o.start();
      o.stop(ac.currentTime + 0.02);
    }catch(_){}
    unlocked = true;
  }

  // auto unlock on first user interaction
  const unlockOnce = ()=>{ unlockAudio(); win.removeEventListener('pointerdown', unlockOnce); win.removeEventListener('touchstart', unlockOnce); };
  win.addEventListener('pointerdown', unlockOnce, { passive:true });
  win.addEventListener('touchstart', unlockOnce, { passive:true });

  function beep(freq=880, durMs=45, vol=0.06){
    const ac = ensureAudio();
    if (!ac) return;
    try{
      const t0 = ac.currentTime;
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(clamp(vol,0.001,0.2), t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + (durMs/1000));
      o.connect(g); g.connect(ac.destination);
      o.start(t0);
      o.stop(t0 + (durMs/1000) + 0.02);
    }catch(_){}
  }

  // -------------------------
  // Shake engine (smooth-ish)
  // -------------------------
  let shakeAmp = 0;       // 0..3
  let shakeEndsAt = 0;
  let shakeKind = 'kick';
  let rafId = 0;

  function startShake(intensity=1, ms=140, kind='kick'){
    shakeKind = kind;
    shakeAmp = Math.max(shakeAmp, clamp(intensity, 0.15, 3.0));
    shakeEndsAt = Math.max(shakeEndsAt, now() + Math.max(60, ms|0));
    body.classList.add('hha-shaking');
    if (!rafId) rafId = requestAnimationFrame(tickShake);
  }

  function tickShake(){
    const t = now();
    const left = Math.max(0, shakeEndsAt - t);
    if (left <= 0){
      rootEl.style.setProperty('--hhaShakeX', '0px');
      rootEl.style.setProperty('--hhaShakeY', '0px');
      body.classList.remove('hha-shaking');
      shakeAmp = 0;
      rafId = 0;
      return;
    }

    // decay
    const k = left / 220;
    const amp = shakeAmp * clamp(k, 0.25, 1);

    // different "feel"
    const s = (shakeKind === 'final') ? 1.25 : (shakeKind === 'laser') ? 1.35 : 1.0;
    const ax = (Math.random()*2 - 1) * (3.2 * amp * s);
    const ay = (Math.random()*2 - 1) * (2.6 * amp * s);

    rootEl.style.setProperty('--hhaShakeX', ax.toFixed(2) + 'px');
    rootEl.style.setProperty('--hhaShakeY', ay.toFixed(2) + 'px');

    rafId = requestAnimationFrame(tickShake);
  }

  // ------------------------
  // Vignette / flash helpers
  // ------------------------
  let vigA = 0, vigB = 0;
  function setVig(colorRgb, a, b){
    if (colorRgb) rootEl.style.setProperty('--hhaVigColor', colorRgb);
    vigA = clamp(a, 0, 1);
    vigB = clamp(b, 0, 1);
    rootEl.style.setProperty('--hhaVigA', String(vigA));
    rootEl.style.setProperty('--hhaVigB', String(vigB));
  }

  let flashTimer = 0;
  function flashOnce(strength=1, ms=120){
    clearTimeout(flashTimer);
    flash.style.opacity = String(clamp(0.15 + 0.40*strength, 0.12, 0.75));
    flashTimer = setTimeout(()=>{ flash.style.opacity = '0'; }, Math.max(60, ms|0));
  }

  // ------------------------
  // Event handlers (PACK D)
  // ------------------------
  // hha:tick kinds: warn/final/ring/laser-warn/laser-fire (from driver or engine)
  win.addEventListener('hha:tick', (ev)=>{
    const d = ev?.detail || {};
    const kind = String(d.kind || 'tick');
    const intensity = clamp(Number(d.intensity ?? 1), 0.2, 3.0);

    if (kind === 'warn'){
      setVig('245,158,11', 0.45, 0.25); // amber
      beep(680, 34, 0.05);
      startShake(0.35*intensity, 90, 'kick');
      return;
    }

    if (kind === 'final'){
      setVig('239,68,68', 0.85, 0.55); // red
      beep(920, 40, 0.07);
      startShake(0.75*intensity, 140, 'final');
      flashOnce(0.55*intensity, 120);
      return;
    }

    if (kind === 'ring'){
      setVig('239,68,68', 0.90, 0.62);
      beep(760, 38, 0.06);
      startShake(0.55*intensity, 120, 'kick');
      return;
    }

    if (kind === 'laser-warn'){
      setVig('239,68,68', 0.70, 0.40);
      beep(560, 30, 0.055);
      startShake(0.45*intensity, 110, 'kick');
      return;
    }

    if (kind === 'laser-fire'){
      setVig('239,68,68', 1.00, 0.75);
      beep(1100, 55, 0.085);
      startShake(1.05*intensity, 180, 'laser');
      flashOnce(0.75*intensity, 140);
      return;
    }

  }, { passive:true });

  // final pulse (from engine or driver)
  win.addEventListener('hha:finalPulse', (ev)=>{
    const sec = Number(ev?.detail?.secLeft ?? 0);
    const strength = clamp((6 - sec) / 6, 0.25, 1);
    setVig('239,68,68', 0.75 + 0.25*strength, 0.45 + 0.30*strength);
    flashOnce(0.35 + 0.35*strength, 120);
    startShake(0.65 + 0.65*strength, 160, 'final');
  }, { passive:true });

  // boss atk announce (from driver observing ring/laser)
  win.addEventListener('hha:bossAtk', (ev)=>{
    const name = String(ev?.detail?.name || '').toLowerCase();
    if (!name) return;
    if (name === 'ring') showToast('😈 BOSS: RING — หาช่องว่าง!', 950);
    else if (name === 'laser') showToast('😈 BOSS: LASER — หลบเส้นแดง!', 950);
    else if (name === 'storm') showToast('🌪️ STORM — ช้าลงแต่โหดขึ้น!', 950);
    else showToast('😈 BOSS ATTACK!', 900);
  }, { passive:true });

  // generic fx from engine (kick/chroma/hero)
  let chromaTimer = 0, heroTimer = 0;

  win.addEventListener('hha:fx', (ev)=>{
    const d = ev?.detail || {};
    const type = String(d.type || '');
    const ms = Math.max(80, Number(d.ms ?? 160));
    const intensity = clamp(Number(d.intensity ?? 1), 0.2, 3.0);

    if (type === 'kick'){
      startShake(0.55*intensity, ms, 'kick');
      return;
    }
    if (type === 'chroma'){
      body.classList.add('hha-chroma');
      clearTimeout(chromaTimer);
      chromaTimer = setTimeout(()=> body.classList.remove('hha-chroma'), ms);
      flashOnce(0.25*intensity, Math.min(160, ms));
      return;
    }
    if (type === 'hero'){
      body.classList.add('hha-hero');
      clearTimeout(heroTimer);
      heroTimer = setTimeout(()=> body.classList.remove('hha-hero'), ms);
      flashOnce(0.35*intensity, Math.min(180, ms));
      startShake(0.35*intensity, Math.min(140, ms), 'kick');
      return;
    }
  }, { passive:true });

  // panic level (edge pressure)
  let panicTimer = 0;
  win.addEventListener('hha:panic', (ev)=>{
    const d = ev?.detail || {};
    const level = clamp(Number(d.level ?? 0), 0, 1);
    const ms = Math.max(0, Number(d.ms ?? 0));

    // map panic -> vignette intensity
    setVig('239,68,68', 0.30 + 0.70*level, 0.15 + 0.65*level);
    if (ms > 0){
      clearTimeout(panicTimer);
      panicTimer = setTimeout(()=> setVig('239,68,68', 0, 0), ms);
    }
  }, { passive:true });

  // storm: slightly dim / warn tint
  win.addEventListener('hha:storm', (ev)=>{
    const active = !!(ev?.detail?.active);
    if (active){
      setVig('245,158,11', 0.55, 0.30);
      showToast('🌪️ STORM!', 750);
    } else {
      setVig('239,68,68', 0, 0);
    }
  }, { passive:true });

  // small ready toast (optional)
  // showToast('PACK D FX ✅', 600);

})(typeof window !== 'undefined' ? window : globalThis);