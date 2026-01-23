// === /herohealth/vr-groups/ai-hooks.js ===
// AI Hooks (GroupsVR) — Prediction + Dataset capture
// ✅ Enabled only when: run=play AND ?ai=1
// ✅ Research/Practice: OFF (caller already passes enabled=false)
// ✅ Emits: ai:risk {riskPct, reasons[]}
// ✅ Stores dataset: localStorage HHA_GROUPS_ML_DATASET (cap rows)
// ✅ Labels last 3s frames when MISS happens (wrong/junk/expire_good/mini_fail)

(function(root){
  'use strict';
  const NS = root.GroupsVR = root.GroupsVR || {};

  const LS_DATA = 'HHA_GROUPS_ML_DATASET';
  const MAX_ROWS = 5000;        // keep small, export later
  const LABEL_WINDOW_MS = 3000; // label frames within 3s before a miss

  const nowMs = ()=> (root.performance && performance.now) ? performance.now() : Date.now();

  function safeParse(json, def){
    try{ return JSON.parse(json); }catch{ return def; }
  }
  function safeSetLS(k, v){
    try{ localStorage.setItem(k, JSON.stringify(v)); }catch{}
  }
  function safeGetLS(k, def){
    try{ return safeParse(localStorage.getItem(k)||'', def); }catch{ return def; }
  }

  function qs(k, def=null){
    try{ return new URL(location.href).searchParams.get(k) ?? def; }catch{ return def; }
  }

  // --- Online labeling buffer (frames waiting for label) ---
  const buf = []; // {tMs, x, y, label?}
  function pushFrame(row){
    buf.push(row);
    // trim old buffer to ~10s
    const cut = row.tMs - 12000;
    while(buf.length && buf[0].tMs < cut) buf.shift();
  }

  function labelRecentMiss(missKind, tMs){
    const from = tMs - LABEL_WINDOW_MS;
    for(let i=buf.length-1;i>=0;i--){
      const r = buf[i];
      if (r.tMs < from) break;
      // label=1 for frames close to miss
      r.label = 1;
      r.missKind = missKind;
    }
  }

  function flushLabeledToDataset(){
    // move frames that are "old enough" to be finalized label (default 0)
    const dataset = safeGetLS(LS_DATA, []);
    const t = nowMs();
    const finalizeBefore = t - 3500; // allow time for late label

    let moved = 0;
    for(let i=0;i<buf.length;){
      const r = buf[i];
      if (r.tMs <= finalizeBefore){
        const out = Object.assign({}, r);
        if (out.label == null) out.label = 0;
        dataset.push(out);
        buf.splice(i,1);
        moved++;
      }else{
        i++;
      }
    }

    if (moved){
      // cap
      if (dataset.length > MAX_ROWS) dataset.splice(0, dataset.length - MAX_ROWS);
      safeSetLS(LS_DATA, dataset);
    }
  }

  // --- Risk model (baseline heuristic; replace with ML later) ---
  function clamp(v,a,b){ v=+v||0; return v<a?a:(v>b?b:v); }

  function riskFromTelemetry(d){
    // Inputs (normalized)
    const acc = clamp((d.accGoodPct||0)/100, 0, 1);
    const pressure = clamp((d.pressure||0)/3, 0, 1);
    const missRate = clamp((d.misses||0)/18, 0, 1);
    const storm = d.stormOn ? 1 : 0;
    const mini = d.miniOn ? 1 : 0;
    const onscreen = clamp((d.targetsOnScreen||0)/12, 0, 1);
    const comboLow = (d.combo||0) <= 1 ? 1 : 0;

    // Weighted sum → sigmoid-ish
    const z =
      (+0.9*(1-acc)) +
      (+1.2*pressure) +
      (+0.9*missRate) +
      (+0.45*storm) +
      (+0.35*mini) +
      (+0.35*onscreen) +
      (+0.25*comboLow);

    // map to 0..100 (soft)
    const risk = 100 * (1 - Math.exp(-z)); // smooth increasing
    const reasons = [];
    if (acc < 0.65) reasons.push('ACC ต่ำ');
    if (pressure > 0.34) reasons.push('PRESSURE สูง');
    if (storm) reasons.push('STORM');
    if (mini) reasons.push('MINI');
    if (onscreen > 0.55) reasons.push('เป้าเยอะ');
    if (comboLow) reasons.push('คอมโบหลุด');

    return { riskPct: clamp(risk, 0, 100), reasons };
  }

  function emit(name, detail){
    try{ root.dispatchEvent(new CustomEvent(name,{detail})); }catch{}
  }

  // --- Attach / Detach ---
  let attached = false;
  let enabled = false;
  let runMode = 'play';
  let seed = '';
  let sessionId = '';

  function makeSessionId(){
    return 'GVR-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,7);
  }

  function onTelemetry(ev){
    if (!enabled) return;
    const d = ev.detail || {};
    const t = nowMs();

    // compute risk + emit UI
    const R = riskFromTelemetry(d);
    emit('ai:risk', { riskPct: Math.round(R.riskPct), reasons: R.reasons });

    // create training row (features) — label later
    const row = {
      tMs: Math.round(t),
      sessionId,
      seed: String(seed || d.seed || ''),
      runMode: String(runMode || d.runMode || ''),
      diff: String(d.diff||''),

      // features
      leftSec: d.leftSec|0,
      score: d.score|0,
      combo: d.combo|0,
      misses: d.misses|0,
      accGoodPct: d.accGoodPct|0,
      pressure: d.pressure|0,
      stormOn: d.stormOn ? 1 : 0,
      miniOn: d.miniOn ? 1 : 0,
      miniForbidJunk: d.miniForbidJunk ? 1 : 0,
      targetsOnScreen: d.targetsOnScreen|0,
      powerCharge: d.powerCharge|0,
      powerThreshold: d.powerThreshold|0,
      goalNow: d.goalNow|0,
      goalNeed: d.goalNeed|0,

      // model target placeholder
      label: null
    };

    pushFrame(row);
    flushLabeledToDataset();
  }

  function onProgress(ev){
    if (!enabled) return;
    const d = ev.detail || {};
    // label events that represent a "miss outcome"
    if (d.kind === 'miss'){
      labelRecentMiss(String(d.why||'miss'), nowMs());
    }
  }

  function onJudge(ev){
    if (!enabled) return;
    const d = ev.detail || {};
    const k = String(d.kind||'');
    // treat miss/bad as label triggers too
    if (k === 'miss') labelRecentMiss('miss', nowMs());
    if (k === 'bad')  labelRecentMiss('bad', nowMs());
  }

  function attach(cfg){
    cfg = cfg || {};
    enabled = !!cfg.enabled;
    runMode = String(cfg.runMode||'play');
    seed = String(cfg.seed||'');
    if (!sessionId) sessionId = makeSessionId();

    if (attached) return;
    attached = true;

    root.addEventListener('groups:telemetry', onTelemetry, {passive:true});
    root.addEventListener('groups:progress',  onProgress,  {passive:true});
    root.addEventListener('hha:judge',        onJudge,     {passive:true});
  }

  function detach(){
    if (!attached) return;
    attached = false;
    enabled = false;

    root.removeEventListener('groups:telemetry', onTelemetry);
    root.removeEventListener('groups:progress',  onProgress);
    root.removeEventListener('hha:judge',        onJudge);

    // finalize remaining frames as label=0
    const dataset = safeGetLS(LS_DATA, []);
    while(buf.length){
      const r = buf.shift();
      if (r.label == null) r.label = 0;
      dataset.push(r);
    }
    if (dataset.length > MAX_ROWS) dataset.splice(0, dataset.length - MAX_ROWS);
    safeSetLS(LS_DATA, dataset);

    sessionId = '';
  }

  function getDataset(){
    return safeGetLS(LS_DATA, []);
  }
  function clearDataset(){
    safeSetLS(LS_DATA, []);
  }

  NS.AIHooks = { attach, detach, getDataset, clearDataset };

})(window);