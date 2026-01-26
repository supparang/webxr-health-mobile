// === /herohealth/vr/ai-predictor.js ===
// AI Predictor (Lightweight ML + tiny MLP option) — HHA
// ✅ Deterministic-friendly (uses stable weights; optional online learning only in play)
// ✅ Predicts "miss risk" for next 2–3 seconds
// ✅ Emits: hha:predict { pMiss, risk, why[], tsSec }
// ✅ Optional coach tips (caller decides)
// Modes:
//   - research/practice => prediction ON (ok) but NO online-learning + NO auto tips by default
//   - play => prediction + optional online learning + tips OK

'use strict';

const clamp = (v,min,max)=>Math.max(min,Math.min(max,v));
const sigmoid = (x)=> 1 / (1 + Math.exp(-x));

function nowSec(){
  const t = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  return t/1000;
}

export function createPredictor({
  mode='play',
  model='logit',          // 'logit' | 'mlp'
  enableOnline=false,     // allow small SGD updates (ONLY recommended in play)
  lr=0.03,
  emit=()=>{},
  tipCooldownSec=4.5,
} = {}){

  const allowLearn = (mode === 'play') && !!enableOnline;

  // ---- feature normalization helpers (roughly 0..1) ----
  const fFever = (fever)=> clamp((Number(fever)||0)/100, 0, 1);
  const fCombo = (combo)=> clamp((Number(combo)||0)/18, 0, 1);
  const fMissRate = (missDeltaPerSec)=> clamp((Number(missDeltaPerSec)||0)/1.2, 0, 1); // 0..~1
  const fSpawn = (spawnMs)=> clamp((900 - (Number(spawnMs)||900))/420, 0, 1); // faster spawn => higher
  const fBoss = (boss)=> boss ? 1 : 0;
  const fPattern = (name)=>{
    // riskier patterns get higher
    const n = String(name||'').toLowerCase();
    if(n.includes('boss')) return 1;
    if(n === 'rain') return 0.85;
    if(n === 'zigzag') return 0.70;
    if(n === 'lanes') return 0.55;
    if(n === 'ring') return 0.50;
    return 0.25; // calm/unknown
  };

  // ---- state ----
  const S = {
    lastSec: 0,
    lastMiss: 0,
    missRate: 0,          // EWMA miss per sec
    pMiss: 0.15,
    lastTipAt: -1e9,
    // for online learning
    lastLabelMissHit: 0,  // label window marker
  };

  // ---- LOGIT weights (stable) ----
  // score = b + Σ(w_i * f_i)
  let W = {
    b: -1.10,
    fever:  1.35,
    missR:  2.10,
    spawn:  1.25,
    boss:   1.00,
    pattern:0.85,
    combo: -0.90
  };

  // ---- Tiny MLP option (2-layer) ----
  // hidden = relu(Ax + a0) ; out = sigmoid(B·hidden + b0)
  // (weights are fixed & small; online learning optional but off by default)
  let MLP = {
    A: [
      [ 0.90, 1.30, 0.80, 0.70, 0.40, -0.60], // h1
      [ 0.60, 1.70, 1.10, 0.90, 0.55, -0.80], // h2
      [ 1.10, 0.90, 1.40, 0.80, 0.65, -0.55], // h3
      [ 0.75, 1.05, 0.95, 0.90, 0.50, -0.70], // h4
    ],
    a0: [ -0.55, -0.65, -0.60, -0.58 ],
    B:  [  1.10,  1.25,  1.05,  1.15 ],
    b0: -1.05
  };

  function relu(x){ return x>0 ? x : 0; }

  function packFeatures(x){
    // x = { fever, missRate, spawn, boss, pattern, combo }
    const v = [
      fFever(x.fever),
      fMissRate(x.missRate),
      fSpawn(x.spawnMs),
      fBoss(x.bossActive),
      fPattern(x.patternName),
      fCombo(x.combo)
    ];
    return v;
  }

  function scoreLogit(v){
    const b = W.b;
    const s =
      b +
      W.fever  * v[0] +
      W.missR  * v[1] +
      W.spawn  * v[2] +
      W.boss   * v[3] +
      W.pattern* v[4] +
      W.combo  * v[5];
    return s;
  }

  function scoreMLP(v){
    const h = [];
    for(let i=0;i<MLP.A.length;i++){
      let z = MLP.a0[i];
      const row = MLP.A[i];
      for(let j=0;j<v.length;j++) z += row[j]*v[j];
      h.push(relu(z));
    }
    let s = MLP.b0;
    for(let i=0;i<h.length;i++) s += MLP.B[i]*h[i];
    return s;
  }

  function explain(v, p){
    // pick top 2 contributors (simple heuristic)
    const parts = [
      { k:'FEVER สูง',   val: v[0], w:(model==='logit'?W.fever:1.0) },
      { k:'MISS ถี่',    val: v[1], w:(model==='logit'?W.missR:1.6) },
      { k:'เป้าออกถี่',  val: v[2], w:(model==='logit'?W.spawn:1.1) },
      { k:'โหมดบอส',    val: v[3], w:(model==='logit'?W.boss:0.9) },
      { k:'แพทเทิร์นยาก',val: v[4], w:(model==='logit'?W.pattern:1.0) },
      { k:'คอมโบต่ำ',   val: (1 - v[5]), w:0.8 },
    ];
    parts.sort((a,b)=> (b.val*b.w) - (a.val*a.w));
    const why = parts.slice(0,2).map(p=>p.k);
    let risk = 'low';
    if(p >= 0.68) risk='high';
    else if(p >= 0.45) risk='mid';
    return { why, risk };
  }

  function onlineUpdateLogit(v, label){
    // label: 1 => miss happened in recent window, 0 => no miss
    const p = sigmoid(scoreLogit(v));
    const err = (label - p); // gradient ascent on log-likelihood
    W.b += lr * err;
    W.fever   += lr * err * v[0];
    W.missR   += lr * err * v[1];
    W.spawn   += lr * err * v[2];
    W.boss    += lr * err * v[3];
    W.pattern += lr * err * v[4];
    W.combo   += lr * err * v[5];
  }

  function update(input={}){
    const tSec = nowSec();
    if(!S.lastSec) S.lastSec = tSec;

    const miss = Number(input.miss||0);
    const dt = Math.max(0.001, tSec - S.lastSec);

    // miss per second (delta), then EWMA
    const dMiss = Math.max(0, miss - (S.lastMiss||0));
    const rate = dMiss / dt;
    S.missRate = (S.missRate*0.70) + (rate*0.30);

    S.lastMiss = miss;
    S.lastSec = tSec;

    const v = packFeatures({
      fever: input.fever,
      missRate: S.missRate,
      spawnMs: input.spawnMs,
      bossActive: !!input.bossActive,
      patternName: input.patternName,
      combo: input.combo
    });

    let s = (model === 'mlp') ? scoreMLP(v) : scoreLogit(v);
    let p = sigmoid(s);

    // smooth output a bit (prevent jumpy)
    S.pMiss = (S.pMiss*0.72) + (p*0.28);

    const ex = explain(v, S.pMiss);

    // emit predict event
    try{
      emit('hha:predict', {
        pMiss: S.pMiss,
        risk: ex.risk,
        why: ex.why,
        tsSec: tSec
      });
    }catch(_){}

    return { pMiss: S.pMiss, risk: ex.risk, why: ex.why };
  }

  // Label training helper: call this when a MISS happens (or in window)
  function labelMissHappened(){
    if(!allowLearn) return;
    S.lastLabelMissHit = nowSec();
  }

  // call periodically (e.g., every 1s) to apply learning signal for recent window
  function learnTick(latestFeatures){
    if(!allowLearn) return;

    const t = nowSec();
    const label = (t - S.lastLabelMissHit) <= 1.2 ? 1 : 0; // miss in last ~1.2s
    const v = packFeatures({
      fever: latestFeatures.fever,
      missRate: S.missRate,
      spawnMs: latestFeatures.spawnMs,
      bossActive: !!latestFeatures.bossActive,
      patternName: latestFeatures.patternName,
      combo: latestFeatures.combo
    });

    // only logit learning (mlp learning is intentionally off here)
    onlineUpdateLogit(v, label);
  }

  // simple tip gating (caller may use)
  function canTip(){
    const t = nowSec();
    if((t - S.lastTipAt) < tipCooldownSec) return false;
    S.lastTipAt = t;
    return true;
  }

  return { update, labelMissHappened, learnTick, canTip };
}