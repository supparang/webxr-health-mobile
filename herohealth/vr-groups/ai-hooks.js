/* === /herohealth/vr-groups/ai-hooks.js ===
PACK 15: AI Hooks (OFF by default)
✅ Deterministic RNG (seeded)
✅ Attach only when (runMode !== 'research') AND enabled=true
✅ Provides hook points:
   - suggestSpawn(ctx)    -> { forceKind?, lifeMul?, sizeMul?, extraJitter? }
   - onJudge(evt)
   - onTick(state)
   - microTip(state)      -> { text, mood } (rate-limited)
Note: Default behavior = no-op (fair & safe)
*/

(function(root){
  'use strict';
  const NS = root.GroupsVR = root.GroupsVR || {};

  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  function hashSeed(str){
    str=String(str||'');
    let h=2166136261>>>0;
    for(let i=0;i<str.length;i++){
      h ^= str.charCodeAt(i);
      h = Math.imul(h,16777619);
    }
    return h>>>0;
  }
  function makeRng(seedU32){
    let s=(seedU32>>>0)||1;
    return function(){
      s = (Math.imul(1664525,s) + 1013904223)>>>0;
      return s/4294967296;
    };
  }

  const AI = {
    enabled:false,
    runMode:'play',
    seed:'',

    rng: ()=>Math.random(),

    // rate-limit coach tips
    lastTipAt:0,
    tipCooldownMs: 3200,

    attach(cfg){
      cfg = cfg||{};
      this.runMode = String(cfg.runMode||'play');
      this.seed = String(cfg.seed||Date.now());
      this.enabled = !!cfg.enabled && (this.runMode !== 'research');
      this.rng = makeRng(hashSeed(this.seed + '::aihooks'));
      this.lastTipAt = 0;
    },

    detach(){
      this.enabled=false;
    },

    // ---- Difficulty Director hook (optional) ----
    // ctx: { runMode, diff, view, combo, misses, acc, stormOn, isBossPhase, baseSpawnMs, wrongRate, junkRate }
    suggestSpawn(ctx){
      if (!this.enabled) return null;

      // default: no change
      const out = {};

      // Example logic (very light): if misses high -> slightly slow spawn
      const misses = Number(ctx.misses||0);
      const combo  = Number(ctx.combo||0);
      const acc    = Number(ctx.acc||0);

      if (misses >= 10) out.lifeMul = 1.06;
      if (combo >= 10 && acc >= 85) out.lifeMul = 0.96;

      // keep it fair: do not override kind unless explicitly desired
      // out.forceKind = 'good'|'wrong'|'junk';

      return Object.keys(out).length ? out : null;
    },

    // ---- Pattern Generator hook (optional) ----
    // ctx: { playRect, kind, size, rng } -> { x?, y?, bias? }
    // Keep OFF unless you decide to use.
    suggestPosition(ctx){
      if (!this.enabled) return null;
      // default: none
      return null;
    },

    // ---- Judge hook ----
    onJudge(ev){
      if (!this.enabled) return;
      // you can accumulate skill signals here if you want
    },

    // ---- Tick hook ----
    onTick(state){
      if (!this.enabled) return;
      // update internal difficulty signals if desired
    },

    // ---- Micro tips (explainable) ----
    microTip(state){
      if (!this.enabled) return null;
      const t = performance.now();
      if (t - this.lastTipAt < this.tipCooldownMs) return null;

      const acc = Number(state.acc||0);
      const miss = Number(state.misses||0);
      const combo = Number(state.combo||0);
      const storm = !!state.stormOn;

      let text = '';
      let mood = 'neutral';

      if (storm && miss >= 8){
        text = 'พายุมาแล้ว: ลดการรัว เล็งให้ชัวร์ก่อนยิง ⚡';
        mood = 'fever';
      } else if (acc < 55){
        text = 'Accuracy ต่ำ: เล็งให้ตรง “หมู่ปัจจุบัน” ก่อนค่อยยิง 🎯';
        mood = 'sad';
      } else if (combo >= 8){
        text = 'คอมโบสวย! รักษาจังหวะ อย่ารีบเกินไป 🔥';
        mood = 'happy';
      } else {
        // no tip
        return null;
      }

      this.lastTipAt = t;
      return { text, mood };
    }
  };

  NS.AIHooks = AI;
})(typeof window!=='undefined'?window:globalThis);