// === /herohealth/vr-groups/ai-hooks.js ===
// PACK 69: AI Hooks v2 (disabled by default; research-safe)

(function(){
  'use strict';
  const WIN = window;

  function qs(k, def=null){
    try{ return new URL(location.href).searchParams.get(k) ?? def; }catch{ return def; }
  }
  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  function hashSeed(str){
    str=String(str??'');
    let h=2166136261>>>0;
    for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619); }
    return h>>>0;
  }
  function makeRng(u32){
    let s=(u32>>>0)||1;
    return ()=>((s=(Math.imul(1664525,s)+1013904223)>>>0)/4294967296);
  }

  function emitCoach(text, mood='neutral'){
    try{ WIN.dispatchEvent(new CustomEvent('hha:coach',{detail:{text,mood}})); }catch(_){}
  }

  const AI = {
    enabled:false,
    runMode:'play',
    seed:'0',
    rng:()=>Math.random(),

    lastTipAt:0,
    tipCooldownMs: 4200,
    lastPatchAt:0,

    attach(cfg){
      cfg = cfg||{};
      AI.runMode = (String(cfg.runMode||'play').toLowerCase()==='research') ? 'research' : 'play';

      if (AI.runMode === 'research'){ AI.enabled = false; return; } // hard safety

      AI.enabled = !!cfg.enabled;  // default OFF
      AI.seed = String(cfg.seed ?? qs('seed', Date.now()));
      AI.rng = makeRng(hashSeed(AI.seed + '::aihooks'));

      AI.lastTipAt = 0;
      AI.lastPatchAt = 0;

      if (AI.enabled) emitCoach('AI Assist เปิดแล้ว 🤖', 'happy');
    },

    // 1) Difficulty Director
    onTick(state){
      if (!AI.enabled) return null;
      const t = Date.now();
      if (t - AI.lastPatchAt < 380) return null;
      AI.lastPatchAt = t;

      const acc = clamp(state.accPct, 0, 100);
      const combo = clamp(state.combo, 0, 99);
      const misses = clamp(state.misses, 0, 99);

      let spawnMul = 1.0;
      if (acc >= 88) spawnMul *= 0.92;
      if (combo >= 8) spawnMul *= 0.90;
      if (misses >= 8) spawnMul *= 1.10;
      if (state.stormOn) spawnMul *= 0.86;

      const jitter = (AI.rng() - 0.5) * 0.04;
      spawnMul = clamp(spawnMul + jitter, 0.82, 1.18);

      return { spawnMul };
    },

    // 2) Coach micro-tips (explainable + rate-limit)
    onJudge(state, judge){
      if (!AI.enabled) return;
      const t = Date.now();
      if (t - AI.lastTipAt < AI.tipCooldownMs) return;

      const k = String(judge.kind||'').toLowerCase();
      const acc = clamp(state.accPct, 0, 100);

      if (k === 'bad' || k === 'miss'){
        AI.lastTipAt = t;
        emitCoach('ทิป: ดูชื่อหมู่ด้านบนก่อนยิง 0.5 วิ แล้วค่อยแตะ 🔍', 'neutral');
        return;
      }
      if (k === 'good' && acc < 65){
        AI.lastTipAt = t;
        emitCoach('ทิป: เล็งกลางเป้าให้นิ่ง แล้วค่อยยิง 🎯', 'neutral');
        return;
      }
      if (k === 'boss'){
        AI.lastTipAt = t;
        emitCoach('ทิปบอส: ยิงต่อเนื่อง “กลางวง” จะละลาย HP เร็ว 💥', 'fever');
      }
    },

    // 3) Pattern hints
    onStormBoss(state, kind){
      if (!AI.enabled) return;
      const t = Date.now();
      if (t - AI.lastTipAt < AI.tipCooldownMs) return;

      kind = String(kind||'').toLowerCase();
      if (kind === 'storm_on'){ AI.lastTipAt = t; emitCoach('พายุ: เป้าถี่ขึ้น—คุมจังหวะ ⚡', 'fever'); }
      if (kind === 'boss_spawn'){ AI.lastTipAt = t; emitCoach('บอส: โฟกัสเป้าเดียว ยิงรัว ๆ 😈', 'fever'); }
    }
  };

  WIN.GroupsVR = WIN.GroupsVR || {};
  WIN.GroupsVR.AIHooks = AI;
})();