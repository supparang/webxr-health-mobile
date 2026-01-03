// === /herohealth/vr/vr-calibration.js ===
// HeroHealth — Calibration / Recenter Helper (Cardboard + cVR)
// - Shows overlay in cardboard/cvr before starting
// - Guides user posture + horizon level + tap-to-recenter
// - Works even without A-Frame (pure DOM + optional vr-ui integration)
// - Emits: hha:calib:open / hha:calib:done / hha:calib:skip

'use strict';

(function(root){
  const DOC = root.document;

  const qs=(k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };
  const clamp=(v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };

  function emit(name, detail){
    try{ root.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
  }

  function isCardboard(){ try{ return DOC.body.classList.contains('cardboard'); }catch(_){ return false; } }
  function isCVR(){ try{ return DOC.body.classList.contains('view-cvr'); }catch(_){ return false; } }
  function wantCalib(){
    // auto for cardboard/cvr unless disabled
    const q = String(qs('calib','')).toLowerCase();
    if (q==='0'||q==='off'||q==='false'||q==='no') return false;
    return isCardboard() || isCVR();
  }

  // ---------- minimal recenter integration ----------
  // If vr-ui.js exists, try to trigger its recenter behavior:
  // - by clicking its recenter button if present
  // - else dispatching a standard event "hha:recenter"
  async function doRecenter(){
    try{
      const btn = DOC.querySelector('[data-hha-recenter], #btnRecenter, .hha-btn-recenter');
      if (btn && typeof btn.click === 'function'){ btn.click(); return true; }
    }catch(_){}
    try{
      root.dispatchEvent(new CustomEvent('hha:recenter', { detail:{ source:'calibration', ts:Date.now() } }));
      return true;
    }catch(_){}
    return false;
  }

  // ---------- UI ----------
  function ensureStyle(){
    if (DOC.getElementById('hha-calib-style')) return;
    const st = DOC.createElement('style');
    st.id='hha-calib-style';
    st.textContent = `
    .hha-calib-backdrop{
      position:fixed; inset:0; z-index:9999;
      background: rgba(2,6,23,.86);
      backdrop-filter: blur(10px);
      display:flex; align-items:center; justify-content:center;
      padding: calc(14px + env(safe-area-inset-top,0px)) calc(14px + env(safe-area-inset-right,0px))
               calc(14px + env(safe-area-inset-bottom,0px)) calc(14px + env(safe-area-inset-left,0px));
      font-family: system-ui,-apple-system,Segoe UI,Roboto,Arial;
      color: #e5e7eb;
    }
    .hha-calib-card{
      width:min(920px,100%);
      border-radius:22px;
      border:1px solid rgba(148,163,184,.18);
      background: rgba(2,6,23,.72);
      box-shadow: 0 24px 90px rgba(0,0,0,.55);
      overflow:hidden;
    }
    .hha-calib-top{
      display:flex; gap:14px; align-items:flex-start;
      padding:16px 16px 10px 16px;
      border-bottom:1px solid rgba(148,163,184,.12);
      background: linear-gradient(180deg, rgba(34,211,238,.10), transparent 60%);
    }
    .hha-calib-logo{
      width:54px; height:54px; border-radius:16px;
      background: rgba(34,211,238,.12);
      border:1px solid rgba(34,211,238,.18);
      display:flex; align-items:center; justify-content:center;
      font-size:28px;
      flex:0 0 auto;
    }
    .hha-calib-title{
      margin:0; font-weight:900; font-size:16px; letter-spacing:.2px;
    }
    .hha-calib-sub{
      margin:6px 0 0 0;
      font-size:13px;
      color: rgba(148,163,184,.95);
      line-height:1.35;
      white-space:pre-line;
    }
    .hha-calib-body{
      padding:14px 16px 16px 16px;
      display:grid;
      grid-template-columns: 1.05fr .95fr;
      gap:12px;
    }
    @media (max-width: 820px){
      .hha-calib-body{ grid-template-columns:1fr; }
    }
    .hha-calib-panel{
      border-radius:18px;
      border:1px solid rgba(148,163,184,.14);
      background: rgba(15,23,42,.55);
      padding:12px;
    }
    .hha-calib-h{
      margin:0 0 8px 0;
      font-size:13px;
      font-weight:900;
      letter-spacing:.2px;
    }
    .hha-calib-steps{
      margin:0; padding-left:18px;
      line-height:1.55;
      color: rgba(229,231,235,.92);
      font-size:13px;
    }
    .hha-calib-steps li{ margin:6px 0; }
    .hha-calib-meterRow{
      display:flex; gap:10px; align-items:center; justify-content:space-between;
      margin-top:10px;
    }
    .hha-calib-pill{
      display:inline-flex; align-items:center; gap:8px;
      padding:8px 10px;
      border-radius:999px;
      border:1px solid rgba(148,163,184,.14);
      background: rgba(2,6,23,.42);
      font-size:12px;
      color: rgba(229,231,235,.90);
    }
    .hha-calib-bar{
      height:10px; border-radius:999px; overflow:hidden;
      background: rgba(148,163,184,.18);
      border:1px solid rgba(148,163,184,.12);
      margin-top:10px;
    }
    .hha-calib-bar > div{
      height:100%;
      width: 50%;
      background: linear-gradient(90deg, rgba(34,197,94,.95), rgba(34,211,238,.95));
    }
    .hha-calib-grid2{
      display:grid; grid-template-columns:1fr 1fr; gap:10px;
      margin-top:10px;
    }
    .hha-calib-kv{
      display:flex; justify-content:space-between; gap:10px;
      padding:10px 12px;
      border-radius:14px;
      border:1px solid rgba(148,163,184,.12);
      background: rgba(2,6,23,.40);
      font-size:12px;
      color: rgba(229,231,235,.92);
    }
    .hha-calib-kv b{ font-size:14px; }
    .hha-calib-btnRow{
      display:flex; flex-wrap:wrap; gap:10px;
      margin-top:12px;
    }
    .hha-calib-btn{
      appearance:none;
      border:1px solid rgba(148,163,184,.18);
      background: rgba(15,23,42,.62);
      color:#e5e7eb;
      padding:10px 12px;
      border-radius:14px;
      font-weight:900;
      font-size:13px;
      cursor:pointer;
      user-select:none;
    }
    .hha-calib-btn.primary{
      border-color: rgba(34,197,94,.26);
      background: rgba(34,197,94,.16);
    }
    .hha-calib-btn.cyan{
      border-color: rgba(34,211,238,.26);
      background: rgba(34,211,238,.12);
    }
    .hha-calib-btn.warn{
      border-color: rgba(245,158,11,.26);
      background: rgba(245,158,11,.14);
    }
    .hha-calib-hint{
      margin-top:10px;
      font-size:12px;
      color: rgba(229,231,235,.85);
      line-height:1.35;
      white-space:pre-line;
    }
    `;
    DOC.head.appendChild(st);
  }

  function buildUI(){
    ensureStyle();

    const back = DOC.createElement('div');
    back.className = 'hha-calib-backdrop';
    back.id = 'hhaCalib';

    back.innerHTML = `
      <div class="hha-calib-card">
        <div class="hha-calib-top">
          <div class="hha-calib-logo">🎯</div>
          <div>
            <p class="hha-calib-title">Calibration / Recenter</p>
            <p class="hha-calib-sub">สำหรับ Cardboard / cVR
• จับมือถือให้นิ่ง “ขนานพื้น” และมองตรงกลางจอ
• กด Recenter ให้ crosshair อยู่กลางจริง แล้วค่อยเริ่มเกม</p>
          </div>
        </div>

        <div class="hha-calib-body">
          <div class="hha-calib-panel">
            <p class="hha-calib-h">ทำตามนี้ (15–20 วินาที)</p>
            <ol class="hha-calib-steps">
              <li>ถือมือถือให้ “ตรง” และนิ่ง 2 วินาที (ห้ามส่าย)</li>
              <li>เงย/ก้มให้น้อยที่สุด ให้เส้นขอบฟ้า “ระดับ”</li>
              <li>เล็ง crosshair ไปกลางจอ → กด <b>RECENTER</b></li>
              <li>ลองแตะยิง 1 ครั้ง ถ้าล็อกเป้าได้ แปลว่าโอเค</li>
            </ol>

            <div class="hha-calib-meterRow">
              <span class="hha-calib-pill">Stability <b id="calibStable">0</b>%</span>
              <span class="hha-calib-pill">Tilt <b id="calibTilt">0</b>°</span>
              <span class="hha-calib-pill">Status <b id="calibStatus">…</b></span>
            </div>
            <div class="hha-calib-bar"><div id="calibBar"></div></div>

            <div class="hha-calib-grid2">
              <div class="hha-calib-kv"><span>Best Stable</span><b id="calibBest">0%</b></div>
              <div class="hha-calib-kv"><span>Hold Time</span><b id="calibHold">0.0s</b></div>
            </div>

            <div class="hha-calib-btnRow">
              <button class="hha-calib-btn cyan" id="btnCalibRecenter">🎯 RECENTER</button>
              <button class="hha-calib-btn" id="btnCalibTestShot">🫧 Test Shot</button>
              <button class="hha-calib-btn primary" id="btnCalibStart">✅ Start Game</button>
              <button class="hha-calib-btn warn" id="btnCalibSkip">⏭ Skip</button>
            </div>

            <div class="hha-calib-hint" id="calibHint">ทิป: ถ้า crosshair เอียง/เบี้ยว ให้กด RECENTER อีกครั้ง แล้วเริ่มใหม่</div>
          </div>

          <div class="hha-calib-panel">
            <p class="hha-calib-h">คำแนะนำแบบโหด 😈</p>
            <div class="hha-calib-hint">
• ถ้า Tilt > 12° → เกมจะ “หลุดเป้า” ง่าย  
• อย่ารีบกด Start ตอนมือถือยังส่าย  
• กด Test Shot แล้วดูว่ามี feedback (judge/hitfx) โผล่ไหม  
• สำหรับ Cardboard: แนะนำ Fullscreen + landscape ก่อนเสมอ
            </div>

            <p class="hha-calib-h" style="margin-top:12px;">Auto rule</p>
            <div class="hha-calib-hint">
ถ้า Stability ≥ 82% ต่อเนื่อง ≥ 1.2s → สถานะจะเป็น READY (เริ่มได้เลย)
            </div>
          </div>
        </div>
      </div>
    `;

    DOC.body.appendChild(back);
    return back;
  }

  // ---------- Sensor / stability ----------
  // We estimate stability from deviceorientation changes
  const M = {
    lastA: null,
    emaJitter: 0.0,
    stableHold: 0.0,
    bestStable: 0,
    tiltDeg: 0,
    ready: false,
    started: false,
    on: false
  };

  function jitterScore(){
    // lower jitter -> higher stability
    // emaJitter around 0.3..4+ (deg change)
    const j = clamp(M.emaJitter, 0, 6);
    const score = clamp(100 - j*18, 0, 100);
    return score;
  }

  function setUI(stablePct){
    const elStable = DOC.getElementById('calibStable');
    const elTilt = DOC.getElementById('calibTilt');
    const elStatus = DOC.getElementById('calibStatus');
    const elBest = DOC.getElementById('calibBest');
    const elHold = DOC.getElementById('calibHold');
    const bar = DOC.getElementById('calibBar');
    const hint = DOC.getElementById('calibHint');

    if (elStable) elStable.textContent = String(stablePct|0);
    if (elTilt) elTilt.textContent = String(M.tiltDeg.toFixed(0));
    if (elBest) elBest.textContent = String(M.bestStable|0);
    if (elHold) elHold.textContent = `${M.stableHold.toFixed(1)}s`;

    const ready = (stablePct >= 82 && M.stableHold >= 1.2 && M.tiltDeg <= 12);
    M.ready = ready;

    if (elStatus) elStatus.textContent = ready ? 'READY' : (stablePct >= 70 ? 'HOLD…' : 'SHAKY');
    if (bar) bar.style.width = `${clamp(stablePct,0,100)}%`;

    if (hint){
      if (M.tiltDeg > 12) hint.textContent = '⚠️ Tilt สูงเกินไป: ปรับมือถือให้ขนานพื้นแล้วกด RECENTER';
      else if (stablePct < 70) hint.textContent = '🌀 มือถือส่าย: หยุดนิ่ง 2 วินาที แล้วค่อยเริ่ม';
      else if (!ready) hint.textContent = '⏳ เกือบแล้ว: ค้างให้นิ่งต่ออีกนิด จนขึ้น READY';
      else hint.textContent = '✅ พร้อมลุย: กด Start Game ได้เลย';
    }
  }

  function onOrient(ev){
    const a = Number(ev.alpha||0);
    const b = Number(ev.beta||0);
    const g = Number(ev.gamma||0);

    // tilt estimate: beta ~ pitch, gamma ~ roll
    M.tiltDeg = Math.max(Math.abs(b), Math.abs(g));

    if (M.lastA == null){
      M.lastA = {a,b,g};
      return;
    }
    const da = Math.abs(a - M.lastA.a);
    const db = Math.abs(b - M.lastA.b);
    const dg = Math.abs(g - M.lastA.g);
    M.lastA = {a,b,g};

    // jitter approx (deg)
    const d = (da*0.2 + db*0.55 + dg*0.55);
    M.emaJitter = M.emaJitter*0.86 + d*0.14;

    const stable = jitterScore();
    M.bestStable = Math.max(M.bestStable, stable);

    // stable hold when stable AND tilt ok
    if (stable >= 82 && M.tiltDeg <= 12) M.stableHold += 0.05;
    else M.stableHold = Math.max(0, M.stableHold - 0.08);

    setUI(stable);
  }

  async function enableSensors(){
    if (M.on) return true;
    try{
      // iOS requires permission
      const D = root.DeviceOrientationEvent;
      if (D && typeof D.requestPermission === 'function'){
        const res = await D.requestPermission();
        if (res !== 'granted') return false;
      }
    }catch(_){}
    try{
      root.addEventListener('deviceorientation', onOrient, true);
      M.on = true;
      return true;
    }catch(_){}
    return false;
  }

  function disableSensors(){
    if (!M.on) return;
    try{ root.removeEventListener('deviceorientation', onOrient, true); }catch(_){}
    M.on = false;
  }

  // ---------- public start gate ----------
  function closeOverlay(kind){
    const ov = DOC.getElementById('hhaCalib');
    if (ov) ov.remove();
    disableSensors();
    emit(kind==='skip' ? 'hha:calib:skip' : 'hha:calib:done', {
      ready: !!M.ready,
      stableBest: M.bestStable|0,
      stableHold: Number(M.stableHold||0),
      tiltDeg: Number(M.tiltDeg||0),
      ts: Date.now()
    });
  }

  function startGame(){
    closeOverlay('done');
    // start game
    try{ root.dispatchEvent(new CustomEvent('hha:start', { detail:{ source:'calibration' } })); }catch(_){}
  }

  // ---------- boot ----------
  function boot(){
    if (!wantCalib()) return;

    // If already started (e.g. user bypass), do nothing
    // but in our architecture, hha:start is fired after overlay hidden
    emit('hha:calib:open', { ts:Date.now() });

    const ov = buildUI();
    setUI(0);

    const btnRe = DOC.getElementById('btnCalibRecenter');
    const btnTest = DOC.getElementById('btnCalibTestShot');
    const btnStart = DOC.getElementById('btnCalibStart');
    const btnSkip = DOC.getElementById('btnCalibSkip');

    // sensor enable must be user gesture on iOS; so enable on first tap
    async function ensureOn(){
      if (M.started) return;
      M.started = true;
      await enableSensors();
    }

    btnRe?.addEventListener('click', async ()=>{
      await ensureOn();
      await doRecenter();
      // little nudge to encourage hold stable
      M.stableHold = Math.max(0, M.stableHold - 0.15);
    });

    btnTest?.addEventListener('click', async ()=>{
      await ensureOn();
      // trigger a shot event to see judge/hitfx feedback
      try{
        root.dispatchEvent(new CustomEvent('hha:shoot', { detail:{ source:'calibration', x:0.5, y:0.5, ts:Date.now() } }));
      }catch(_){}
    });

    btnStart?.addEventListener('click', async ()=>{
      await ensureOn();
      // allow start even if not ready, but show stricter behavior in hint
      startGame();
    });

    btnSkip?.addEventListener('click', async ()=>{
      await ensureOn();
      closeOverlay('skip');
      // allow manual start elsewhere
      try{ root.dispatchEvent(new CustomEvent('hha:start', { detail:{ source:'calibration-skip' } })); }catch(_){}
    });

    // also allow tap anywhere to request permission + start sensors
    ov.addEventListener('pointerdown', ensureOn, { passive:true });

  }

  // Delay slightly (so body class view-cvr/cardboard applied)
  setTimeout(boot, 200);

})(typeof window !== 'undefined' ? window : globalThis);