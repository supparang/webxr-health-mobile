// === /herohealth/vr-groups/predictor.js ===
// GroupsVR Predictor — Baseline ML (deterministic, no RNG)
// ✅ Enabled only when AIHooks.attach({enabled:true, runMode:'play'})
// ✅ Emits predictions via AIHooks (ai:pred) + optional coach tips
// ✅ Deep Learning hook point: setModel(fn) for future TFJS/ONNX, etc.

(function(root){
  'use strict';
  const NS = root.GroupsVR = root.GroupsVR || {};

  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));
  const sigmoid = (x)=> 1/(1+Math.exp(-x));
  const nowMs = ()=> (root.performance && performance.now) ? performance.now() : Date.now();

  function Predictor(){
    this.enabled = false;
    this.runMode = 'play';

    // rolling state (fed from events)
    this.S = {
      timeLeft: 0,
      score: 0,
      combo: 0,
      misses: 0,
      acc: 0,
      grade: 'C',

      goalPct: 0,
      miniOn: 0,
      miniPct: 0,
      miniLeft: 0,
      miniNeed: 0,
      miniNow: 0,

      powerCur: 0,
      powerThr: 8,

      stormOn: 0,
      bossActive: 0,
      pressure: 0,
    };

    // rolling hit stats for mini prediction
    this._winMs = 4500;
    this._hits = []; // {t, good}
    this._lastTipAt = 0;
    this._lastPredAt = 0;

    // optional external model
    this._modelFn = null; // (features)=>{mistakeRisk, miniSuccessProb, junkRisk}
  }

  Predictor.prototype.setEnabled = function(on, runMode){
    this.enabled = !!on;
    this.runMode = String(runMode||'play');
  };

  Predictor.prototype.setModel = function(fn){
    this._modelFn = (typeof fn === 'function') ? fn : null;
  };

  Predictor.prototype.reset = function(){
    this._hits = [];
    this._lastTipAt = 0;
    this._lastPredAt = 0;
  };

  Predictor.prototype.feed = function(type, d){
    if(!this.enabled || this.runMode!=='play') return;
    d = d || {};
    const S = this.S;

    if(type==='time')  S.timeLeft = Number(d.left||0)|0;
    if(type==='score'){ S.score=Number(d.score||0)|0; S.combo=Number(d.combo||0)|0; S.misses=Number(d.misses||0)|0; }
    if(type==='rank') { S.grade=String(d.grade||'C'); S.acc=Number(d.accuracy||0)|0; }

    if(type==='quest'){
      S.goalPct = Number(d.goalPct||0);
      S.miniOn  = (d.miniTimeLeftSec && Number(d.miniTimeLeftSec)>0) ? 1 : 0;
      S.miniPct = Number(d.miniPct||0);
      S.miniLeft= Number(d.miniTimeLeftSec||0)|0;
      S.miniNeed= Number(d.miniTotal||0)|0;
      S.miniNow = Number(d.miniNow||0)|0;
    }

    if(type==='power'){ S.powerCur=Number(d.charge||0)|0; S.powerThr=Number(d.threshold||8)|0; }

    if(type==='progress'){
      const k = String(d.kind||'');
      if(k==='storm_on')  S.stormOn = 1;
      if(k==='storm_off') S.stormOn = 0;
      if(k==='boss_spawn') S.bossActive = 1;
      if(k==='boss_down')  S.bossActive = 0;
      if(k==='pressure')   S.pressure = Number(d.level||0)|0;
    }

    if(type==='judge'){
      const k = String(d.kind||'');
      const t = nowMs();
      // track good-hit density (for mini feasibility)
      if(k==='good'){
        this._hits.push({ t, good:1 });
      }else if(k==='bad'){
        this._hits.push({ t, good:0 });
      }else if(k==='miss'){
        this._hits.push({ t, good:0 });
      }
      // prune
      const cut = t - this._winMs;
      while(this._hits.length && this._hits[0].t < cut) this._hits.shift();
    }
  };

  Predictor.prototype._features = function(){
    const S = this.S;
    const t = nowMs();
    const cut = t - this._winMs;

    // compute recent good rate
    let n=0, g=0;
    for(const it of this._hits){
      if(it.t >= cut){
        n++;
        g += it.good ? 1 : 0;
      }
    }
    const goodRate = (n>0) ? (g/n) : 0.5; // fallback neutral
    const hitPerSec = (this._hits.length / (this._winMs/1000)); // all judged density

    // mini feasibility
    let miniNeedLeft = 0;
    if(S.miniOn){
      miniNeedLeft = Math.max(0, (Number(S.miniNeed||0) - Number(S.miniNow||0)));
    }
    const miniTime = Math.max(0, Number(S.miniLeft||0));
    const reqPerSec = (S.miniOn && miniTime>0) ? (miniNeedLeft / miniTime) : 0;

    return {
      timeLeft: S.timeLeft,
      combo: S.combo,
      misses: S.misses,
      acc: S.acc,
      pressure: S.pressure,
      stormOn: S.stormOn,
      bossActive: S.bossActive,
      miniOn: S.miniOn,
      miniNeedLeft,
      miniTime,
      goodRate,      // 0..1
      hitPerSec,     // density proxy
      reqPerSec,     // mini required rate
    };
  };

  Predictor.prototype.predict = function(){
    if(!this.enabled || this.runMode!=='play') return null;

    const f = this._features();

    // If external model exists, use it (still deterministic from f)
    if(this._modelFn){
      try{
        const out = this._modelFn(f) || {};
        return {
          mistakeRisk: clamp(out.mistakeRisk, 0, 1),
          junkRisk: clamp(out.junkRisk, 0, 1),
          miniSuccessProb: clamp(out.miniSuccessProb, 0, 1),
          features: f
        };
      }catch(_){}
    }

    // Baseline ML-ish heuristic (sigmoid)
    // higher pressure/storm/mini urgency -> risk up; higher combo/acc -> risk down
    const x =
      (-0.25)
      + (0.55 * clamp(f.pressure,0,3))
      + (0.35 * f.stormOn)
      + (0.18 * f.bossActive)
      + (0.22 * f.miniOn)
      + (0.35 * clamp((f.reqPerSec - (f.goodRate*0.9)), -1, 1))
      + (0.08 * clamp((12 - f.timeLeft)/12, 0, 1))
      - (0.20 * clamp(f.combo/10, 0, 1))
      - (0.22 * clamp(f.acc/100, 0, 1));

    const mistakeRisk = clamp(sigmoid(x), 0, 1);

    // junk risk proxy: increases with pressure + storm + low acc
    const jx =
      (-0.35)
      + (0.45 * clamp(f.pressure,0,3))
      + (0.30 * f.stormOn)
      - (0.28 * clamp(f.acc/100, 0, 1))
      - (0.12 * clamp(f.combo/10, 0, 1));
    const junkRisk = clamp(sigmoid(jx), 0, 1);

    // mini success probability: compare achievable vs required
    // achievable rate ≈ (goodRate * hitPerSec) scaled
    let miniSuccessProb = 0.5;
    if(f.miniOn){
      const achievable = (f.goodRate * Math.max(0.2, f.hitPerSec)) * 0.55;
      const need = Math.max(0.05, f.reqPerSec);
      const ratio = clamp(achievable / need, 0, 2.0);
      // map ratio -> prob
      miniSuccessProb = clamp(sigmoid((ratio - 1.0) * 3.0), 0, 1);
    }else{
      miniSuccessProb = 0.5;
    }

    return { mistakeRisk, junkRisk, miniSuccessProb, features: f };
  };

  Predictor.prototype.tip = function(pred){
    if(!pred) return null;
    const f = pred.features || {};
    const r = pred.mistakeRisk;

    // tip logic (keep short + actionable)
    if(f.miniOn && pred.miniSuccessProb < 0.40){
      return { text:'MINI เสี่ยงไม่ทัน! เล็งให้ตรงหมู่ก่อน แล้วค่อยยิงรัว 🎯', mood:'fever', level:'warn' };
    }
    if(f.stormOn && r > 0.72){
      return { text:'พายุโหด! ชะลอนิด เล็งก่อนยิง จะไม่พลาด 🌀', mood:'neutral', level:'warn' };
    }
    if(r > 0.78){
      return { text:'ระวังพลาดสูง! หยุดยิงมั่ว 1 วิ แล้วเล็งใหม่ 👀', mood:'sad', level:'danger' };
    }
    if(r > 0.62){
      return { text:'เริ่มเสี่ยงพลาด—โฟกัสเฉพาะหมู่ที่ถูก ✅', mood:'neutral', level:'info' };
    }
    if(f.combo >= 8 && r < 0.45){
      return { text:'คอมโบดีมาก! รักษาจังหวะเดิมไว้ 🔥', mood:'happy', level:'good' };
    }
    return null;
  };

  Predictor.prototype.shouldTip = function(){
    const t = nowMs();
    return (t - this._lastTipAt) > 2600; // rate-limit
  };

  Predictor.prototype.markTip = function(){
    this._lastTipAt = nowMs();
  };

  NS.Predictor = new Predictor();
})(window);