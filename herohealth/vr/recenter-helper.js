// === /herohealth/vr/recenter-helper.js ===
// Recenter / Calibration helper for Cardboard + cVR (DOM games)
// - shows small RECENTER button
// - shows calibration overlay with center target + "hold still" + countdown
// - emits window event: hha:recenter { view, ts, reason }
// - stores last recenter in localStorage (HHA_RECENTER_LAST)

'use strict';

function qs(k, def=null){
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}

function isCardboard(){
  try { return document.body.classList.contains('cardboard'); } catch { return false; }
}
function isCVR(){
  try { return document.body.classList.contains('view-cvr'); } catch { return false; }
}

let AC=null;
function beep(freq=880, dur=0.06, vol=0.05){
  try{
    if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
    const t0 = AC.currentTime;
    const o = AC.createOscillator();
    const g = AC.createGain();
    o.type='sine';
    o.frequency.value=freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0+0.01);
    g.gain.linearRampToValueAtTime(0.0001, t0+dur);
    o.connect(g); g.connect(AC.destination);
    o.start(t0); o.stop(t0+dur+0.02);
  }catch(_){}
}

function emit(name, detail){
  try{ window.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
}

function ensureStyles(){
  if (document.getElementById('hha-recenter-style')) return;
  const st = document.createElement('style');
  st.id = 'hha-recenter-style';
  st.textContent = `
  .hha-recenter-btn{
    position: fixed;
    left: 50%;
    bottom: calc(14px + env(safe-area-inset-bottom, 0px));
    transform: translateX(-50%);
    z-index: 110; /* above HUD(50) but below result(120) */
    pointer-events: auto;
    user-select: none;
    appearance: none;
    border: 1px solid rgba(148,163,184,.22);
    background: rgba(15,23,42,.66);
    color: rgba(229,231,235,.92);
    padding: 10px 14px;
    border-radius: 999px;
    font: 900 13px/1 system-ui;
    letter-spacing: .2px;
    box-shadow: 0 18px 70px rgba(0,0,0,.45);
    backdrop-filter: blur(10px);
  }
  .hha-recenter-btn[hidden]{ display:none; }

  .hha-calib{
    position: fixed;
    inset: 0;
    z-index: 130;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: calc(18px + env(safe-area-inset-top,0px)) 18px calc(18px + env(safe-area-inset-bottom,0px)) 18px;
    background: rgba(2,6,23,.86);
    backdrop-filter: blur(10px);
    pointer-events: auto;
  }
  .hha-calib[hidden]{ display:none; }

  .hha-calib-card{
    width: min(900px, 100%);
    border-radius: 22px;
    border: 1px solid rgba(148,163,184,.18);
    background: rgba(2,6,23,.72);
    box-shadow: 0 24px 90px rgba(0,0,0,.55);
    padding: 16px;
  }
  .hha-calib-top{
    display:flex; justify-content:space-between; align-items:flex-start; gap:12px;
    margin-bottom: 10px;
  }
  .hha-calib-title{
    margin:0;
    font: 900 16px/1.2 system-ui;
    color: rgba(229,231,235,.95);
  }
  .hha-calib-sub{
    margin:6px 0 0 0;
    color: rgba(148,163,184,.95);
    font: 600 13px/1.35 system-ui;
    white-space: pre-line;
  }
  .hha-calib-stage{
    margin-top: 12px;
    display:grid;
    grid-template-columns: 1fr;
    gap: 12px;
  }
  .hha-calib-aim{
    position: relative;
    height: min(44vh, 360px);
    border-radius: 18px;
    background: radial-gradient(circle at center, rgba(34,211,238,.08), transparent 55%);
    border: 1px solid rgba(148,163,184,.16);
    overflow: hidden;
  }
  .hha-calib-cross{
    position:absolute; left:50%; top:50%;
    transform: translate(-50%,-50%);
    width: 64px; height: 64px;
    border-radius: 999px;
    border: 2px solid rgba(229,231,235,.75);
    box-shadow: 0 18px 70px rgba(0,0,0,.55);
  }
  .hha-calib-cross::after{
    content:"";
    position:absolute; left:50%; top:50%;
    transform: translate(-50%,-50%);
    width: 8px; height: 8px;
    border-radius: 999px;
    background: rgba(34,211,238,.95);
  }
  .hha-calib-cross::before{
    content:"";
    position:absolute; left:50%; top:50%;
    transform: translate(-50%,-50%);
    width: 90px; height: 90px;
    border-radius: 999px;
    border: 1px dashed rgba(34,211,238,.35);
    opacity: .9;
    animation: hhaSpin 2.2s linear infinite;
  }
  @keyframes hhaSpin{
    from{ transform: translate(-50%,-50%) rotate(0deg); }
    to{ transform: translate(-50%,-50%) rotate(360deg); }
  }

  .hha-calib-status{
    display:flex; justify-content:space-between; gap:10px; align-items:center;
    padding: 10px 12px;
    border-radius: 14px;
    background: rgba(15,23,42,.62);
    border: 1px solid rgba(148,163,184,.14);
    color: rgba(229,231,235,.92);
    font: 800 13px/1 system-ui;
  }
  .hha-calib-pill{
    display:inline-flex; align-items:center; gap:8px;
    padding: 8px 10px;
    border-radius: 999px;
    background: rgba(15,23,42,.58);
    border: 1px solid rgba(148,163,184,.14);
    font: 900 12px/1 system-ui;
    color: rgba(229,231,235,.92);
  }
  .hha-calib-btns{ display:flex; flex-wrap:wrap; gap:10px; margin-top: 12px; }
  .hha-calib-btn{
    appearance:none;
    border: 1px solid rgba(148,163,184,.18);
    background: rgba(15,23,42,.62);
    color: rgba(229,231,235,.92);
    padding: 10px 12px;
    border-radius: 14px;
    font: 900 13px/1 system-ui;
    cursor: pointer;
    user-select:none;
  }
  .hha-calib-btn.primary{
    border-color: rgba(34,197,94,.28);
    background: rgba(34,197,94,.16);
  }
  .hha-calib-btn.cyan{
    border-color: rgba(34,211,238,.28);
    background: rgba(34,211,238,.12);
  }
  `;
  document.head.appendChild(st);
}

function buildUI(){
  ensureStyles();

  // small recenter button
  let btn = document.getElementById('hhaRecenterBtn');
  if (!btn){
    btn = document.createElement('button');
    btn.id = 'hhaRecenterBtn';
    btn.className = 'hha-recenter-btn';
    btn.type = 'button';
    btn.textContent = '🎯 RECENTER';
    document.body.appendChild(btn);
  }

  // calibration overlay
  let ov = document.getElementById('hhaCalib');
  if (!ov){
    ov = document.createElement('div');
    ov.id = 'hhaCalib';
    ov.className = 'hha-calib';
    ov.hidden = true;
    ov.innerHTML = `
      <div class="hha-calib-card">
        <div class="hha-calib-top">
          <div>
            <p class="hha-calib-title">Calibration / Recenter</p>
            <p class="hha-calib-sub" id="hhaCalibSub">
โหมด: — 
1) ถือเครื่องให้นิ่ง + กึ่งกลางสายตาอยู่ที่เป้า
2) รอ “นิ่ง” 1.5 วินาที
3) นับถอยหลัง 3…2…1… แล้วเริ่มเล่น</p>
          </div>
          <div class="hha-calib-pill" id="hhaCalibView">view: —</div>
        </div>

        <div class="hha-calib-stage">
          <div class="hha-calib-aim">
            <div class="hha-calib-cross" aria-hidden="true"></div>
          </div>

          <div class="hha-calib-status">
            <div id="hhaCalibStatus">กำลังตรวจความนิ่ง…</div>
            <div class="hha-calib-pill">⏳ <span id="hhaCalibCount">—</span></div>
          </div>
        </div>

        <div class="hha-calib-btns">
          <button class="hha-calib-btn cyan" id="hhaCalibStart">✅ Start Calibration</button>
          <button class="hha-calib-btn" id="hhaCalibSkip">⏭️ Skip</button>
          <button class="hha-calib-btn" id="hhaCalibClose">✖ Close</button>
        </div>
      </div>
    `;
    document.body.appendChild(ov);
  }

  return { btn, ov };
}

// crude “stability” detector using deviceorientation deltas
function makeStability(){
  let last=null;
  let ema=0;
  return function sample(e){
    const a = (e.alpha ?? 0), b=(e.beta ?? 0), g=(e.gamma ?? 0);
    if (!last){
      last = {a,b,g};
      return { stable:false, score:999 };
    }
    const da = Math.abs(a-last.a);
    const db = Math.abs(b-last.b);
    const dg = Math.abs(g-last.g);
    last = {a,b,g};
    const score = da*0.6 + db*0.9 + dg*0.9; // lower is better
    ema = ema*0.85 + score*0.15;
    return { stable: ema < 1.25, score: ema }; // threshold tuned for phones
  };
}

export function initRecenterHelper(opts = {}){
  const viewParam = String(qs('view','')||'').toLowerCase();
  const active = isCardboard() || isCVR() || viewParam === 'cardboard' || viewParam === 'cvr';
  if (!active) return;

  const holdStableSec = Math.max(0.8, Number(opts.holdStableSec ?? 1.5));
  const countdownSec  = Math.max(2, Number(opts.countdownSec ?? 3));
  const { btn, ov } = buildUI();

  // don’t show button on start overlay if user prefers, but default show
  btn.hidden = false;

  const elView = ov.querySelector('#hhaCalibView');
  const elSub  = ov.querySelector('#hhaCalibSub');
  const elStatus = ov.querySelector('#hhaCalibStatus');
  const elCount  = ov.querySelector('#hhaCalibCount');
  const btnStart = ov.querySelector('#hhaCalibStart');
  const btnSkip  = ov.querySelector('#hhaCalibSkip');
  const btnClose = ov.querySelector('#hhaCalibClose');

  function curView(){
    return isCardboard() ? 'cardboard' : (isCVR() ? 'cvr' : (viewParam || 'vr'));
  }

  function open(reason='manual'){
    ov.hidden = false;
    const v = curView();
    if (elView) elView.textContent = `view: ${v}`;
    if (elSub) elSub.textContent =
`โหมด: ${v}
1) ถือเครื่องให้นิ่ง + กึ่งกลางสายตาอยู่ที่เป้า
2) รอ “นิ่ง” ${holdStableSec.toFixed(1)} วินาที
3) นับถอยหลัง ${countdownSec}… แล้วเริ่มเล่น`;
    if (elStatus) elStatus.textContent = 'กด Start Calibration';
    if (elCount) elCount.textContent = '—';
    emit('hha:calib_open', { view:v, reason });
  }
  function close(){
    ov.hidden = true;
    emit('hha:calib_close', { view:curView() });
  }

  let running=false;
  let stableT=0;
  let cd=0;
  let stabFn = makeStability();

  async function start(){
    if (running) return;
    running = true;
    stableT = 0;
    cd = countdownSec;

    // deviceorientation permission on iOS
    try{
      if (typeof DeviceOrientationEvent !== 'undefined'
          && typeof DeviceOrientationEvent.requestPermission === 'function'){
        const p = await DeviceOrientationEvent.requestPermission();
        // allow even if denied; calibration will just run timer without stability
      }
    }catch(_){}

    if (elStatus) elStatus.textContent = `กำลังตรวจความนิ่ง… (ต้องนิ่ง ${holdStableSec.toFixed(1)}s)`;
    if (elCount) elCount.textContent = '—';

    let hasOri=false;
    const onOri = (e)=>{
      hasOri=true;
      const s = stabFn(e);
      if (s.stable) stableT += 0.05;
      else stableT = Math.max(0, stableT - 0.08);

      if (elStatus){
        if (stableT >= holdStableSec){
          elStatus.textContent = `นิ่งแล้ว ✅ เริ่มนับถอยหลัง`;
        } else {
          const pct = Math.round((stableT/holdStableSec)*100);
          elStatus.textContent = `นิ่ง… ${pct}% (score≈${s.score.toFixed(2)})`;
        }
      }
    };
    window.addEventListener('deviceorientation', onOri, true);

    const t0 = performance.now();
    let last = t0;

    function raf(t){
      if (!running) return;
      const dt = Math.min(0.05, Math.max(0.01, (t-last)/1000));
      last = t;

      // if no sensor, allow time-only fallback
      if (!hasOri){
        stableT += dt * 0.65; // slower
        if (elStatus){
          const pct = Math.round((stableT/holdStableSec)*100);
          elStatus.textContent = `ตรวจความนิ่ง (fallback)… ${pct}%`;
        }
      }

      if (stableT >= holdStableSec){
        // countdown
        cd = Math.max(0, cd - dt);
        const secLeft = Math.ceil(cd);
        if (elCount) elCount.textContent = String(secLeft);

        // beep each second edge
        const frac = cd - Math.floor(cd);
        if (Math.abs(frac-0.02) < 0.03) beep(820,0.05,0.05);

        if (cd <= 0.001){
          finish('calibrated');
          return;
        }
      }

      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    function finish(reason){
      running=false;
      window.removeEventListener('deviceorientation', onOri, true);
      beep(1200,0.08,0.06);

      const payload = {
        view: curView(),
        ts: Date.now(),
        reason
      };

      try{
        localStorage.setItem('HHA_RECENTER_LAST', JSON.stringify(payload));
      }catch(_){}

      emit('hha:recenter', payload);
      close();
    }

    // bind skip -> immediate recenter event
    btnSkip?.addEventListener('click', ()=>{
      if (!running) return;
      running=false;
      window.removeEventListener('deviceorientation', onOri, true);
      emit('hha:recenter', { view:curView(), ts: Date.now(), reason:'skip' });
      close();
    }, { once:true });

    // close cancels
    btnClose?.addEventListener('click', ()=>{
      if (!running) { close(); return; }
      running=false;
      window.removeEventListener('deviceorientation', onOri, true);
      emit('hha:recenter', { view:curView(), ts: Date.now(), reason:'cancel' });
      close();
    }, { once:true });
  }

  btn.addEventListener('click', ()=>open('button'));
  btnStart?.addEventListener('click', start);
  btnClose?.addEventListener('click', close);

  // optional auto-open on first time cardboard/cvr
  const auto = String(opts.autoOpen ?? '1') !== '0';
  if (auto){
    try{
      const last = localStorage.getItem('HHA_RECENTER_LAST');
      if (!last) open('first_time');
    }catch(_){
      open('first_time');
    }
  }

  // expose minimal API
  return { open, close };
}