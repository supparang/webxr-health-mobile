// === /fitness/js/ai-predictor.js ===
// Shadow Breaker — AI Predictor (DL-lite, no deps)
// ✅ FIX: exports named 'AIPredictor' (prevents engine.js import crash)
// ✅ Safe: works even if disabled / in research mode
// ✅ Optional global compat: window.RB_AI (legacy)

'use strict';

function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }

export class AIPredictor {
  constructor(opts = {}){
    this.enabled = !!opts.enabled;               // play-only by default
    this.alpha = clamp(opts.alpha ?? 0.25, 0.05, 0.65); // EMA smoothing
    this.state = {
      // simple running signals
      fatigue: 0,          // 0..1
      rhythm: 0,           // 0..1
      streak: 0,           // 0..1
      missRate: 0,         // 0..1
      lastTs: 0
    };
  }

  setEnabled(on){
    this.enabled = !!on;
  }

  isEnabled(){
    return !!this.enabled;
  }

  // snapshot: { dtMs, hit:boolean, miss:boolean, combo:number, reactionMs:number, pace:number }
  // return: { fatigue01, paceHint, aimHint, tipKey }
  predict(snapshot = {}){
    if(!this.enabled){
      return { fatigue01: 0, paceHint: 'steady', aimHint: 'none', tipKey: '' };
    }

    const dt = clamp(Number(snapshot.dtMs ?? 16), 8, 500);
    const hit = !!snapshot.hit;
    const miss = !!snapshot.miss;
    const combo = clamp(Number(snapshot.combo ?? 0), 0, 999);
    const reaction = clamp(Number(snapshot.reactionMs ?? 260), 80, 900);

    // derive raw signals
    const missRaw = miss ? 1 : 0;
    const hitRaw  = hit ? 1 : 0;

    // fatigue proxy: slow reaction + misses
    const fatigueRaw =
      clamp((reaction - 220) / 520, 0, 1) * 0.55 +
      missRaw * 0.35 +
      clamp(1 - hitRaw, 0, 1) * 0.10;

    // rhythm proxy: stable hit stream + combo
    const rhythmRaw =
      hitRaw * 0.55 +
      clamp(combo / 18, 0, 1) * 0.45;

    // streak proxy: combo
    const streakRaw = clamp(combo / 12, 0, 1);

    // EMA update
    const a = this.alpha;
    const S = this.state;
    S.fatigue = S.fatigue ? (S.fatigue*(1-a) + fatigueRaw*a) : fatigueRaw;
    S.rhythm  = S.rhythm  ? (S.rhythm*(1-a)  + rhythmRaw*a)  : rhythmRaw;
    S.streak  = S.streak  ? (S.streak*(1-a)  + streakRaw*a)  : streakRaw;
    S.missRate= S.missRate? (S.missRate*(1-a)+ missRaw*a)    : missRaw;
    S.lastTs  = (S.lastTs||0) + dt;

    const fatigue01 = clamp(S.fatigue, 0, 1);

    // heuristics → hints
    let paceHint = 'steady';
    if(fatigue01 > 0.70) paceHint = 'slowdown';
    else if(S.rhythm > 0.78 && fatigue01 < 0.45) paceHint = 'speedup';

    let aimHint = 'none';
    if(S.missRate > 0.35) aimHint = 'center';
    else if(S.missRate > 0.20) aimHint = 'focus';

    // tip key (for coach to map to text)
    let tipKey = '';
    if(aimHint === 'center') tipKey = 'aim_center';
    else if(paceHint === 'slowdown') tipKey = 'pace_breathe';
    else if(paceHint === 'speedup') tipKey = 'pace_push';
    else if(S.streak > 0.75) tipKey = 'keep_combo';

    return { fatigue01, paceHint, aimHint, tipKey };
  }
}

/* ---------- Legacy/global compat (optional) ---------- */
try{
  // Provide a default instance for older code paths if needed
  const inst = new AIPredictor({ enabled: false });
  // legacy name people used before
  window.RB_AI = window.RB_AI || inst;
}catch(_){}