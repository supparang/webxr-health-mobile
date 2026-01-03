// === /herohealth/vr-groups/ai-director.js ===
// PACK 60: AI Difficulty Director + Explainable micro-tips (play only)
// Deterministic-ready: uses engine's rng if provided for small variations

(function(){
  'use strict';
  const WIN = window;
  WIN.GroupsVR = WIN.GroupsVR || {};

  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  function Director(){
    this.enabled = false;
    this.lastTipAt = 0;
    this.tipEveryMs = 4200;
  }

  Director.prototype.attach = function(engine, opts){
    opts = opts||{};
    this.enabled = !!opts.enabled;
    this.engine = engine;
  };

  Director.prototype.update = function(t){
    if (!this.enabled || !this.engine) return;

    const E = this.engine;
    if (!E.cfg || E.cfg.runMode !== 'play') return;

    // signals
    const acc = E._accuracyPct ? E._accuracyPct() : 0;
    const combo = E.combo||0;
    const miss = E.misses||0;

    // fairness band: don't spike
    // adjust spawn pace gently by editing preset.baseSpawnMs (engine already uses it)
    let base = E.cfg.preset.baseSpawnMs;

    // player strong
    if (acc >= 86 && combo >= 6) base *= 0.985;
    if (acc >= 90 && combo >= 10) base *= 0.975;

    // player struggling
    if (miss >= 8) base *= 1.03;
    if (acc <= 60 && miss >= 6) base *= 1.04;

    E.cfg.preset.baseSpawnMs = clamp(base, 420, 920);

    // also nudge junk/wrong via preset (bounded)
    const p = E.cfg.preset;
    if (acc >= 88 && combo >= 8){
      p.wrongRate = clamp(p.wrongRate + 0.0025, 0.12, 0.46);
      p.junkRate  = clamp(p.junkRate  + 0.0018, 0.08, 0.34);
    } else if (miss >= 8 || acc <= 62){
      p.wrongRate = clamp(p.wrongRate - 0.0030, 0.08, 0.46);
      p.junkRate  = clamp(p.junkRate  - 0.0022, 0.06, 0.34);
    }

    this._tips(t, acc, combo, miss);
  };

  Director.prototype._tips = function(t, acc, combo, miss){
    if (t - this.lastTipAt < this.tipEveryMs) return;
    this.lastTipAt = t;

    // explainable micro tips
    if (miss >= 10){
      WIN.dispatchEvent(new CustomEvent('hha:coach', { detail:{
        mood:'sad',
        text:'พลาดเยอะไปนิด! ลอง “รอเป้าให้นิ่ง 0.2 วิ” แล้วค่อยยิง 🎯'
      }}));
      return;
    }
    if (acc <= 60){
      WIN.dispatchEvent(new CustomEvent('hha:coach', { detail:{
        mood:'neutral',
        text:'ทริค: ดูชื่อหมู่ใน GOAL ก่อน แล้วค่อยยิง เป้าผิดหมู่จะหักแต้ม 😄'
      }}));
      return;
    }
    if (combo >= 10){
      WIN.dispatchEvent(new CustomEvent('hha:coach', { detail:{
        mood:'happy',
        text:'คอมโบเดือดมาก! รักษาจังหวะเดิมไว้ แล้วจะได้ Rank สูง 🔥'
      }}));
      return;
    }
    if (acc >= 88){
      WIN.dispatchEvent(new CustomEvent('hha:coach', { detail:{
        mood:'happy',
        text:'แม่นมาก! เดี๋ยวเกมจะเร่งนิดนึงนะ พร้อมลุย! ⚡'
      }}));
    }
  };

  WIN.GroupsVR.AIDirector = {
    create: ()=> new Director()
  };
})();