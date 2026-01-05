// === /herohealth/vr-groups/ai-hooks.js ===
// AI Hooks — PRODUCTION-SAFE (STEP 7)
// ✅ disabled by default
// ✅ enabled only when attach({enabled:true, runMode:'play'})
// ✅ deterministic: uses provided seed -> local rng
// Provides:
// - director: spawnSpeedMul(), ratesBias(), stormPlan()
// - pattern: bias() (wrong/junk skew)
// - tip: micro tips w/ cooldown, explainable

(function(){
  'use strict';
  const WIN = window;
  const NS  = WIN.GroupsVR = WIN.GroupsVR || {};

  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
  function hashSeed(str){
    str = String(str ?? '');
    let h = 2166136261 >>> 0;
    for (let i=0;i<str.length;i++){
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h>>>0;
  }
  function makeRng(seedU32){
    let s = (seedU32>>>0) || 1;
    return function(){
      s = (Math.imul(1664525, s) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }
  function emit(name, detail){
    try{ WIN.dispatchEvent(new CustomEvent(name, {detail})); }catch(_){}
  }

  // ---------------- Tip system (rate-limit) ----------------
  function TipBus(){
    this.lastAt = 0;
    this.coolMs = 1800; // default
  }
  TipBus.prototype.say = function(text, mood){
    const t = (performance && performance.now) ? performance.now() : Date.now();
    if (t - this.lastAt < this.coolMs) return;
    this.lastAt = t;
    emit('hha:coach', { text: String(text||''), mood: String(mood||'neutral') });
  };

  // ---------------- Director ----------------
  function Director(rng){
    this.rng = rng;
    // fairness limits
    this.minMul = 0.82;
    this.maxMul = 1.18;

    // dynamic bias accumulator (smooth)
    this.bias = 0; // - => easier, + => harder
  }

  Director.prototype._updateBias = function(acc, combo, misses, leftSec, rageOn){
    // acc high => harder, low => easier
    let b = 0;

    if (acc >= 90) b += 0.22;
    else if (acc >= 82) b += 0.12;
    else if (acc <= 62) b -= 0.20;
    else if (acc <= 70) b -= 0.10;

    // combo => harder (reward skill)
    if (combo >= 10) b += 0.14;
    else if (combo >= 6) b += 0.08;

    // misses => ease a bit
    if (misses >= 10) b -= 0.18;
    else if (misses >= 7) b -= 0.10;

    // near end => spice but not cruel
    if (leftSec <= 15 && leftSec > 0) b += 0.06;

    // rage on => already hard, don't over-stack
    if (rageOn) b -= 0.05;

    // smooth
    this.bias = clamp(this.bias * 0.72 + b * 0.28, -0.35, 0.35);
    return this.bias;
  };

  // Spawn speed multiplier (used in groups.safe.js)
  Director.prototype.spawnSpeedMul = function(acc, combo, misses, leftSec, rageOn){
    const b = this._updateBias(acc, combo, misses, leftSec, rageOn);
    // bias>0 => faster spawn => mul <1
    // bias<0 => slower spawn => mul >1
    const mul = clamp(1.0 - b, this.minMul, this.maxMul);
    return mul;
  };

  // Rate bias for wrong/junk in _spawnOne
  // returns bias in [-0.12..+0.12] where + => more wrong, less junk
  Director.prototype.ratesBias = function(acc, combo, misses){
    let v = 0;
    if (acc >= 88) v += 0.06;
    if (combo >= 8) v += 0.05;
    if (misses >= 8) v -= 0.07;
    return clamp(v, -0.10, 0.10);
  };

  // Storm plan: adjust stormEverySec / stormLenSec slightly
  Director.prototype.stormPlan = function(baseEverySec, baseLenSec, acc, combo, misses){
    let every = baseEverySec;
    let len   = baseLenSec;

    if (acc >= 88 && combo >= 6){
      every = baseEverySec - 2; // more frequent
      len   = baseLenSec + 1;
    } else if (acc <= 70 || misses >= 9){
      every = baseEverySec + 2; // less frequent
      len   = Math.max(5, baseLenSec - 1);
    }

    // add deterministic jitter
    const j = (this.rng() - 0.5) * 1.2; // -0.6..+0.6
    every = clamp(every + j, 16, 40);
    len   = clamp(len + (this.rng()<0.5?-0.2:0.2), 5, 10);

    return { stormEverySec: every, stormLenSec: len };
  };

  // ---------------- Pattern Director ----------------
  function Pattern(rng){
    this.rng = rng;
    this._bias = 0;
    this._mode = 'neutral'; // neutral | storm | boss | rage
    this._until = 0;
  }
  Pattern.prototype.setMode = function(mode, ms){
    const t = (performance && performance.now) ? performance.now() : Date.now();
    this._mode = String(mode||'neutral');
    this._until = t + (Number(ms)||0);
  };
  Pattern.prototype.bias = function(){
    const t = (performance && performance.now) ? performance.now() : Date.now();
    if (t > this._until) this._mode = 'neutral';

    // + => more wrong, less junk
    if (this._mode === 'storm') return 0.06;
    if (this._mode === 'boss')  return 0.04;
    if (this._mode === 'rage')  return 0.08;
    return 0;
  };

  // ---------------- AIHooks façade ----------------
  const Tip = new TipBus();

  NS.AIHooks = {
    attach(opts){
      opts = opts || {};
      const enabled = !!opts.enabled;
      const runMode = String(opts.runMode||'play');
      if (!enabled || runMode !== 'play'){
        delete NS.__ai;
        return;
      }

      const seed = String(opts.seed || Date.now());
      const rng  = makeRng(hashSeed(seed + '::AIHooks::Groups'));

      const director = new Director(rng);
      const pattern  = new Pattern(rng);

      NS.__ai = { enabled:true, seed, rng, director, pattern, tip: (text,mood)=>{
        Tip.say(text,mood);
      } };

      // listen for progress events to switch pattern mode
      WIN.addEventListener('groups:progress', (ev)=>{
        const d = ev.detail||{};
        const k = String(d.kind||'').toLowerCase();
        if (!NS.__ai || !NS.__ai.enabled) return;

        if (k==='storm_on') pattern.setMode('storm', 9000);
        if (k==='boss_spawn') pattern.setMode('boss', 9000);
        if (k==='rage_on') pattern.setMode('rage', 12000);

        // explainable tips (not spam)
        if (k==='storm_on') NS.__ai.tip('พายุ = เป้าถี่ขึ้น ลองเล็งก่อนแล้วค่อยยิง 🎯', 'fever');
        if (k==='boss_phase2') NS.__ai.tip('บอส PHASE2 ระวัง DECOY! อย่ายิงมั่ว 🌀', 'fever');
        if (k==='rage_storm_burst') NS.__ai.tip('RAGE storm มา! โฟกัสหมู่เดียว ยิงคม ๆ 🔥', 'fever');
      }, {passive:true});

      // boot tip
      NS.__ai.tip('AI Director เปิดแล้ว: ความโหดจะปรับตามผลงานคุณ 😈', 'happy');
    }
  };

})();