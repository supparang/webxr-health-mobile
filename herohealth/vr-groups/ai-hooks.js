// === /herohealth/vr-groups/ai-hooks.js ===
// GroupsVR AI Hooks — DL-ready (TFJS optional)
// ✅ enabled only when ?ai=1 and runMode=play
// ✅ research/practice: ALWAYS OFF
// ✅ Listens: groups:telemetry (1 Hz) from groups.safe.js
// ✅ Emits: ai:tip (for coach), ai:risk (optional), ai:mode
// ✅ Dataset store: getDataset(), clearDataset()
// ✅ DL: if ?dl=1 -> try load TFJS model at ./models/groups-risk/model.json
//     - if model missing -> fallback to EMA/heuristic

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if(!WIN) return;

  const NS = (WIN.GroupsVR = WIN.GroupsVR || {});
  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));
  const qs = (k, d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } };

  function emit(name, detail){
    try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
  }

  function runModeFrom(ctx){ return String((ctx && ctx.runMode) || 'play').toLowerCase(); }
  function isResearchOrPractice(rm){ return (rm==='research' || rm==='practice'); }

  function aiWanted(){
    const run = String(qs('run','play')||'play').toLowerCase();
    const on  = String(qs('ai','0')||'0').toLowerCase();
    if (run === 'research') return false;
    return (on==='1' || on==='true');
  }

  function dlWanted(){
    const v = String(qs('dl','0')||'0').toLowerCase();
    return (v==='1' || v==='true');
  }

  // ---------------- Dataset store ----------------
  const DATASET = [];
  const MAX_ROWS = 6000; // ~100 นาทีที่ 1Hz (พอ)

  // rows are telemetry + derived risk
  function pushRow(row){
    DATASET.push(row);
    if (DATASET.length > MAX_ROWS) DATASET.splice(0, DATASET.length - MAX_ROWS);
  }

  // ---------------- Simple EMA/Heuristic fallback ----------------
  // goal: estimate "risk of failing soon / making mistakes soon"
  // output: risk 0..1, and label buckets
  const EMA = { v: 0.25 };
  function emaUpdate(x, alpha){ EMA.v = (alpha*x) + (1-alpha)*EMA.v; return EMA.v; }

  function heuristicRisk(t){
    // t: telemetry
    const acc = clamp(t.accGoodPct, 0, 100) / 100;
    const miss = clamp(t.misses, 0, 99);
    const combo = clamp(t.combo, 0, 99);
    const pressure = clamp(t.pressure, 0, 3)/3;
    const storm = t.stormOn ? 1 : 0;
    const mini  = t.miniOn ? 1 : 0;

    // intuition:
    // - low acc + high misses + high pressure + storm/mini => risk up
    // - high combo => risk down
    let r = 0;
    r += (1-acc) * 0.55;
    r += Math.min(1, miss/12) * 0.28;
    r += pressure * 0.18;
    r += storm * 0.10;
    r += mini  * 0.08;
    r -= Math.min(1, combo/10) * 0.18;

    r = clamp(r, 0, 1);
    const smooth = emaUpdate(r, 0.28);
    return { raw:r, smooth, mode:'heuristic' };
  }

  // ---------------- DL model (TFJS optional) ----------------
  // We load TFJS only when needed to avoid blocking.
  let DL = {
    enabled: false,
    loaded: false,
    model: null,
    fail: false,
    lastErr: ''
  };

  async function ensureTFJS(){
    if (WIN.tf && WIN.tf.loadLayersModel) return true;
    // lazy-load from CDN? (คุณอาจไม่อยากพึ่ง CDN)
    // ✅ safest: if you host tf.min.js locally at ../vr/tf.min.js then include in groups-vr.html
    // We will NOT auto-inject network script here to avoid surprises.
    return false;
  }

  async function tryLoadDLModel(){
    if (DL.loaded || DL.fail) return;
    DL.loaded = true;
    const okTF = await ensureTFJS();
    if (!okTF){
      DL.fail = true;
      DL.lastErr = 'tfjs_not_found';
      return;
    }
    try{
      // expects file at: /herohealth/vr-groups/models/groups-risk/model.json
      const url = new URL('./models/groups-risk/model.json', location.href).toString();
      DL.model = await WIN.tf.loadLayersModel(url);
      DL.fail = false;
    }catch(e){
      DL.fail = true;
      DL.lastErr = String(e && e.message ? e.message : e);
      DL.model = null;
    }
  }

  // DL input design (sequence length)
  const SEQ = 12; // 12 seconds window
  // feature order for DL
  const FEAT_KEYS = [
    'acc', 'misses', 'combo', 'pressure',
    'storm', 'mini', 'targets', 'power',
    'goalProg', 'leftN'
  ];
  function buildFeat(t){
    const acc = clamp(t.accGoodPct, 0, 100)/100;
    const misses = clamp(t.misses, 0, 99)/20;   // normalize
    const combo  = clamp(t.combo, 0, 99)/20;
    const pressure = clamp(t.pressure,0,3)/3;
    const storm = t.stormOn?1:0;
    const mini  = t.miniOn?1:0;
    const targets = clamp(t.targetsOnScreen,0,30)/30;
    const power   = clamp(t.powerCharge,0,99)/12;
    const goalProg = clamp(t.goalNeed? (t.goalNow/t.goalNeed) : 0, 0, 1);
    const leftN = clamp(t.leftSec,0,180)/180;
    return [acc, misses, combo, pressure, storm, mini, targets, power, goalProg, leftN];
  }

  // rolling buffer for DL sequence
  const SEQBUF = [];
  function seqPush(vec){
    SEQBUF.push(vec);
    if (SEQBUF.length > SEQ) SEQBUF.shift();
  }

  async function dlPredictRisk(){
    if (!DL.model || !WIN.tf) return null;
    if (SEQBUF.length < SEQ) return null;

    // input shape: [1, SEQ, F]
    const F = FEAT_KEYS.length;
    const flat = [];
    for (let i=0;i<SEQ;i++){
      const v = SEQBUF[i] || new Array(F).fill(0);
      for (let j=0;j<F;j++) flat.push(Number(v[j])||0);
    }

    const tf = WIN.tf;
    const x = tf.tensor(flat, [1, SEQ, F]);
    try{
      const y = DL.model.predict(x);
      const val = Array.isArray(y) ? y[0] : y;
      const out = await val.data();
      // assume single sigmoid output
      const risk = clamp(out[0], 0, 1);
      return { risk, mode:'dl' };
    }finally{
      try{ x.dispose(); }catch(_){}
    }
  }

  // ---------------- Tips policy ----------------
  let lastTipAt = 0;
  function maybeTip(t, riskInfo){
    const now = Date.now();
    if (now - lastTipAt < 2200) return; // rate limit

    const rm = String(t.runMode||'play');
    if (rm !== 'play') return;

    const risk = (riskInfo && (riskInfo.smooth ?? riskInfo.risk)) ?? 0.25;
    const pressure = clamp(t.pressure,0,3);

    // buckets
    let mood = 'neutral';
    let text = '';

    if (risk >= 0.78 || pressure >= 3){
      mood = 'sad';
      text = 'ช้าลงนิด! เล็งให้ตรงหมู่ก่อนยิงนะ 😤';
    }else if (risk >= 0.62 || pressure >= 2){
      mood = 'fever';
      text = 'โหมดกดดัน! ดูหมู่ให้ชัวร์ แล้วค่อยยิง 🔥';
    }else if (risk <= 0.28 && (t.combo||0) >= 6){
      mood = 'happy';
      text = 'ดีมาก! คอมโบมาแล้ว เก็บต่อเลย ✨';
    }else{
      // occasional neutral nudge when mini/storm
      if (t.stormOn){
        mood = 'fever';
        text = 'พายุมา! อย่ายิงมั่ว เล็งทีละอัน 🌪️';
      }else if (t.miniOn){
        mood = 'neutral';
        text = 'MINI อยู่! โฟกัสให้ถูกหมู่ก่อน 👍';
      }else{
        return; // no tip
      }
    }

    lastTipAt = now;
    emit('ai:tip', { text, mood, risk: Number(risk.toFixed(3)), mode: riskInfo.mode });
  }

  // ---------------- Attach / Listener ----------------
  let ATTACHED = false;
  let ENABLED = false;

  function onTelemetry(ev){
    if (!ENABLED) return;
    const t = ev.detail || {};

    // build features and push to sequence buffer
    const vec = buildFeat(t);
    seqPush(vec);

    // fallback risk
    const h = heuristicRisk(t);

    // by default use heuristic
    let chosen = { mode:'heuristic', smooth:h.smooth, raw:h.raw };

    // try DL if enabled
    if (DL.enabled && !DL.fail){
      // load model once
      tryLoadDLModel().then(async ()=>{
        const pr = await dlPredictRisk();
        if (pr && pr.risk != null){
          chosen = { mode:'dl', risk: pr.risk };
        }
        // emit + dataset store with final chosen
        finalize(t, h, chosen);
      });
      return; // finalize async
    }

    finalize(t, h, chosen);
  }

  function finalize(t, h, chosen){
    const riskVal = (chosen.mode==='dl') ? chosen.risk : chosen.smooth;

    // emit risk signal
    emit('ai:risk', { risk: riskVal, mode: chosen.mode });

    // store dataset row (DL-friendly)
    const row = {
      ts: Date.now(),
      runMode: t.runMode,
      diff: t.diff,
      seed: t.seed,

      leftSec: t.leftSec,
      score: t.score,
      combo: t.combo,
      misses: t.misses,
      accGoodPct: t.accGoodPct,
      pressure: t.pressure,
      stormOn: t.stormOn,
      miniOn: t.miniOn,
      targetsOnScreen: t.targetsOnScreen,
      powerCharge: t.powerCharge,
      powerThreshold: t.powerThreshold,
      goalNow: t.goalNow,
      goalNeed: t.goalNeed,

      // heuristic
      riskRaw: Number((h.raw ?? 0).toFixed(4)),
      riskSmooth: Number((h.smooth ?? 0).toFixed(4)),

      // chosen
      riskFinal: Number((riskVal ?? 0).toFixed(4)),
      riskMode: chosen.mode
    };
    pushRow(row);

    maybeTip(t, (chosen.mode==='dl') ? { risk:riskVal, mode:'dl' } : { smooth:riskVal, mode:'heuristic' });
  }

  const API = {
    attach(ctx){
      const rm = runModeFrom(ctx);
      if (isResearchOrPractice(rm)){
        ENABLED = false;
        emit('ai:mode', { enabled:false, reason:'research_or_practice' });
        return;
      }
      ENABLED = !!(ctx && ctx.enabled) && aiWanted();
      DL.enabled = ENABLED && dlWanted();

      if (!ATTACHED){
        ATTACHED = true;
        WIN.addEventListener('groups:telemetry', onTelemetry, { passive:true });
      }

      emit('ai:mode', {
        enabled: ENABLED,
        dl: DL.enabled ? 1 : 0,
        reason: ENABLED ? 'play' : 'disabled'
      });
    },

    getDataset(){
      return DATASET.slice();
    },

    clearDataset(){
      DATASET.length = 0;
      SEQBUF.length = 0;
      EMA.v = 0.25;
      lastTipAt = 0;
    }
  };

  NS.AIHooks = API;
})();