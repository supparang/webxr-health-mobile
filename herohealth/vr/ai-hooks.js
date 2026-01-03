// === /herohealth/vr/ai-hooks.js ===
// HHA AI Hooks — Universal (PRODUCTION SAFE)
// - Default: enabled only in play mode
// - Study/Research: deterministic but AI actions OFF by default (can enable via qs ai=1)
// - Provides: createAIHooks({ game, runMode, diff, seed, view, coachFn, emitFn })
// - Emits: hha:ai events (coach-tip, difficulty-signal, pattern, note)

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

// mulberry32 rng (seeded)
function mulberry32(seed){
  let t = (seed >>> 0) || 1;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function qsParam(name, def=null){
  try{ return new URL(location.href).searchParams.get(name) ?? def; }
  catch(_){ return def; }
}

export function createAIHooks(opts={}){
  const game   = opts.game   || 'unknown';
  const runMode= (opts.runMode||'play').toLowerCase();
  const diff   = (opts.diff||'normal').toLowerCase();
  const view   = (opts.view||'mobile').toLowerCase();
  const seed   = Number(opts.seed)||13579;

  const emitFn  = typeof opts.emitFn === 'function'
    ? opts.emitFn
    : (name, detail)=>{ try{ ROOT.dispatchEvent(new CustomEvent(name,{detail})); }catch(_){ } };

  const coachFn = typeof opts.coachFn === 'function' ? opts.coachFn : null;

  // ---- Policy defaults ----
  const study = (runMode === 'study' || runMode === 'research');
  const qsAI  = qsParam('ai', null);     // ai=1 override
  const qsTips= qsParam('tips', null);   // tips=1 override
  const enableInStudy = (qsAI === '1');  // explicit only
  const enabledDefault = !study;         // play only
  const enabled = enabledDefault || enableInStudy;

  const tipsDefault = !study;            // play only
  const tipsEnabled = (study ? (qsTips==='1') : true);

  // deterministic RNG for AI planning even when disabled
  const rng = mulberry32(seed ^ 0xA11C0DE);

  const AI = {
    game, runMode, diff, view, seed,
    enabled,
    tipsEnabled,
    rng,

    // rate-limit tips
    lastTipMs: 0,
    tipCooldownMs: clamp(Number(opts.tipCooldownMs)||6500, 1200, 20000),

    emit(type, data){
      emitFn('hha:ai', { game, type, ...(data||{}), meta:{ runMode, diff, view, seed } });
    },

    note(msg){
      this.emit('note', { msg });
    },

    maybeTip(key, msg, mood='neutral'){
      if(!this.enabled) return;
      if(!this.tipsEnabled) return;

      const t = (ROOT.performance && performance.now) ? performance.now() : Date.now();
      if(t - this.lastTipMs < this.tipCooldownMs) return;

      this.lastTipMs = t;
      if(coachFn) coachFn(msg, mood);
      this.emit('coach-tip', { key, msg, mood });
    },

    difficultySignal(payload){
      // can be emitted even if AI disabled (useful for research logs)
      this.emit('difficulty-signal', payload || {});
    },

    pattern(plan){
      // can be emitted even if AI disabled (pattern plan for deterministic research)
      this.emit('pattern', plan || {});
    },

    // helper: pick by rng (deterministic)
    pick(arr){
      arr = Array.isArray(arr) ? arr : [];
      if(!arr.length) return null;
      return arr[Math.floor(this.rng()*arr.length)] || arr[0];
    }
  };

  // announce policy
  AI.emit('policy', {
    enabled: AI.enabled,
    tipsEnabled: AI.tipsEnabled,
    study,
    override: { ai: qsAI, tips: qsTips }
  });

  return AI;
}