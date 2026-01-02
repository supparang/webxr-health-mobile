// === /herohealth/vr-groups/ai-hooks.js ===
// Pack15: AI Hooks — PRODUCTION (disabled by default)
// Purpose: provide "insertion points" only (no adaptive cheating)
// - AI Difficulty Director hooks (observe => suggest difficulty knobs)
// - AI Coach micro-tips hooks (observe => suggest tips with rate-limit)
// - AI Pattern Generator hooks (seeded, deterministic)
// Enable only in PLAY with ?ai=1 ; ALWAYS disabled in research

(function(){
  'use strict';
  const WIN = window;

  const clamp=(v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };
  const qs=(k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } };

  function runMode(){
    const r = String(qs('run','play')||'play').toLowerCase();
    return (r==='research') ? 'research' : 'play';
  }
  function boolParam(k, def=false){
    const v = String(qs(k, def?'1':'0')|| (def?'1':'0')).toLowerCase();
    return (v==='1'||v==='true'||v==='yes');
  }

  // ---------- deterministic RNG ----------
  function hashStr(s){
    s=String(s||''); let h=2166136261;
    for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); }
    return (h>>>0);
  }
  function makeRng(seedStr){
    let x = hashStr(seedStr) || 123456789;
    return function(){
      x ^= x << 13; x >>>= 0;
      x ^= x >> 17; x >>>= 0;
      x ^= x << 5;  x >>>= 0;
      return (x>>>0) / 4294967296;
    };
  }

  // ---------- core object ----------
  const AIHooks = {
    enabled:false,
    runMode:'play',
    seed:'',
    rng: ()=>Math.random(),

    // Director "suggestions" only — the game engine may choose to apply or ignore
    director: {
      // suggested knobs; engine may read these if it wants (future)
      spawnMul: 1.0,
      sizeMul:  1.0,
      badRate:  0.0,
      lockPx:   null
    },

    coach: {
      lastAt:0,
      cooldownMs: 2800,
      // Emits suggestion via event only
      suggest(text, mood='neutral'){
        const now = performance.now();
        if (now - AIHooks.coach.lastAt < AIHooks.coach.cooldownMs) return;
        AIHooks.coach.lastAt = now;
        try{
          WIN.dispatchEvent(new CustomEvent('hha:coach', { detail:{ text, mood } }));
        }catch(_){}
      }
    },

    pattern: {
      // seeded pick helper
      pick(arr){
        if(!Array.isArray(arr) || !arr.length) return null;
        const i = Math.floor(AIHooks.rng()*arr.length);
        return arr[Math.max(0, Math.min(arr.length-1, i))];
      },
      // deterministic shuffle (Fisher–Yates)
      shuffle(arr){
        const a = (arr||[]).slice();
        for(let i=a.length-1;i>0;i--){
          const j = Math.floor(AIHooks.rng()*(i+1));
          const t=a[i]; a[i]=a[j]; a[j]=t;
        }
        return a;
      }
    },

    attach({ runMode, seed, enabled }){
      AIHooks.runMode = (runMode==='research') ? 'research' : 'play';
      // research forced off
      AIHooks.enabled = (AIHooks.runMode!=='research') && !!enabled;
      AIHooks.seed = String(seed || Date.now());
      AIHooks.rng = makeRng('AI|' + AIHooks.seed);

      // reset director defaults
      AIHooks.director.spawnMul = 1.0;
      AIHooks.director.sizeMul  = 1.0;
      AIHooks.director.badRate  = 0.0;
      AIHooks.director.lockPx   = null;

      // announce state (optional)
      try{
        WIN.dispatchEvent(new CustomEvent('ai:state', {
          detail:{ enabled: AIHooks.enabled, runMode: AIHooks.runMode, seed: AIHooks.seed }
        }));
      }catch(_){}
    },

    detach(){
      AIHooks.enabled=false;
      try{ WIN.dispatchEvent(new CustomEvent('ai:state', { detail:{ enabled:false } })); }catch(_){}
    }
  };

  // ---------- observation hooks ----------
  // These DO NOT change game directly. They only suggest.
  function onScore(ev){
    if(!AIHooks.enabled) return;
    const d = ev.detail||{};
    const acc = clamp(Number(d.accuracyGoodPct ?? d.accuracy ?? 0)/100, 0, 1);
    const combo = Number(d.combo||0);

    // Director suggestion: if high skill, slightly harder; if low, slightly easier (bounded)
    // (engine may apply later; right now this is just state)
    const skill = clamp(acc*0.7 + clamp(combo/20,0,1)*0.3, 0, 1);

    AIHooks.director.spawnMul = clamp(1.05 + (skill-0.5)*0.25, 0.92, 1.18);
    AIHooks.director.sizeMul  = clamp(1.00 - (skill-0.5)*0.18, 0.86, 1.10);
    AIHooks.director.badRate  = clamp((skill-0.45)*0.10, 0.0, 0.12);

    // Coach micro-tips (rate limited)
    const miss = Number(d.misses||0);
    if (miss>=10 && acc<0.65) AIHooks.coach.suggest('ลอง “เล็งค้างนิดเดียว” แล้วค่อยยิง จะลด MISS ได้มาก', 'sad');
    else if (combo>=12 && acc>=0.75) AIHooks.coach.suggest('คอมโบกำลังสวย! รักษาจังหวะยิงให้เสถียร 👏', 'happy');
  }

  function onProgress(ev){
    if(!AIHooks.enabled) return;
    const k = String((ev.detail||{}).kind||'').toLowerCase();
    if(k==='storm_on') AIHooks.coach.suggest('พายุมาแล้ว! โฟกัสยิงเป้าที่ชัวร์ อย่ารัว 👀', 'neutral');
    if(k==='boss_spawn') AIHooks.coach.suggest('BOSS! เก็บแต้มแบบปลอดภัยก่อน แล้วค่อยดันคอมโบ', 'fever');
  }

  WIN.addEventListener('hha:score', onScore, {passive:true});
  WIN.addEventListener('groups:progress', onProgress, {passive:true});

  // Expose
  WIN.GroupsVR = WIN.GroupsVR || {};
  WIN.GroupsVR.AIHooks = AIHooks;

})();