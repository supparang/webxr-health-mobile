// === /herohealth/vr-groups/risk-meter.js ===
// Risk Meter (lightweight inference) — SAFE
// ✅ Uses last 1Hz sample => predicts "risk of miss soon" (baseline heuristic)
// ✅ Shows Risk bar + label on HUD
// Config: window.GVR_RISK_CONFIG = { enabled:true, smoothing:0.35 }

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;

  const CFG = Object.assign({
    enabled: true,
    smoothing: 0.35, // EMA
  }, WIN.GVR_RISK_CONFIG || {});

  const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number(v)||0));
  const sigmoid=(x)=> 1/(1+Math.exp(-x));

  let enabled = !!CFG.enabled;
  let ema = 0;

  function qs(s){ return DOC.querySelector(s); }

  function ensureUI(){
    const wrap = qs('#riskWrap');
    const fill = qs('#riskFill');
    const txt  = qs('#riskText');
    return { wrap, fill, txt };
  }

  function reset(){
    ema = 0;
    const ui = ensureUI();
    if (ui.fill) ui.fill.style.width = '0%';
    if (ui.txt) ui.txt.textContent = 'RISK: —';
    if (ui.wrap) ui.wrap.classList.remove('risk-hi','risk-mid','risk-lo');
  }

  function label(r){
    if (r >= 0.72) return { t:'RISK: HIGH', c:'risk-hi' };
    if (r >= 0.42) return { t:'RISK: MID',  c:'risk-mid' };
    return { t:'RISK: LOW',  c:'risk-lo' };
  }

  // Baseline "model": weighted features -> sigmoid
  // Intuition:
  // - pressure, storm, miniGap, low accuracy, high miss count, fast spawn => higher risk
  function predict(sample){
    const acc = clamp(sample.accGoodPct, 0, 100);
    const misses = clamp(sample.misses, 0, 60);
    const pressure = clamp(sample.pressure, 0, 3);
    const storm = sample.storm ? 1 : 0;

    const miniOn = sample.miniOn ? 1 : 0;
    const miniNeed = clamp(sample.miniNeed||0, 0, 10);
    const miniNow  = clamp(sample.miniNow||0, 0, 10);
    const miniGap = (miniOn && miniNeed>0) ? clamp((miniNeed-miniNow)/miniNeed, 0, 1) : 0;

    const spawnMs = clamp(sample.spawnEveryMs||650, 250, 1200);
    const fast = clamp((720 - spawnMs)/720, 0, 1);

    // normalized terms
    const lowAcc = clamp((75 - acc)/30, 0, 1);   // below ~75% increases risk
    const missLvl= clamp(misses/14, 0, 1);

    // "logit"
    let x = -1.25;                // bias (so default low)
    x += 1.35 * lowAcc;
    x += 1.10 * missLvl;
    x += 0.55 * fast;
    x += 0.60 * storm;
    x += 0.75 * (pressure/3);
    x += 0.80 * miniGap;

    // small stabilizer: if acc very high and misses low, push down
    if (acc >= 88 && misses <= 2) x -= 0.55;

    return sigmoid(x);
  }

  function updateUI(r){
    const ui = ensureUI();
    if (!ui.fill || !ui.txt || !ui.wrap) return;

    const pct = Math.round(clamp(r,0,1)*100);
    ui.fill.style.width = pct + '%';

    const L = label(r);
    ui.txt.textContent = `${L.t} (${pct}%)`;

    ui.wrap.classList.remove('risk-hi','risk-mid','risk-lo');
    ui.wrap.classList.add(L.c);
  }

  // events
  WIN.addEventListener('hha:start', (ev)=>{
    const d = ev.detail || {};
    const runMode = String(d.runMode||'play');
    // enabled in research/practice always, play always (just HUD) — you can disable if wanted
    enabled = !!CFG.enabled;
    reset();
    if (!enabled) return;
  }, { passive:true });

  WIN.addEventListener('groups:mltrace', (ev)=>{
    if (!enabled) return;
    const d = ev.detail || {};
    if (d.kind !== 'sample' || !d.sample) return;

    const r = predict(d.sample);
    // EMA smoothing
    ema = (ema===0) ? r : (CFG.smoothing*r + (1-CFG.smoothing)*ema);
    updateUI(ema);
  }, { passive:true });

})();