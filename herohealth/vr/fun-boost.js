/* === /herohealth/vr/fun-boost.js ===
   HHA Universal Fun Boost v1 (Standalone, no imports)
   - Fever Mode + Wave Director + Near-miss + Micro reward FX + Adaptive intensity
   - Emits events:
     - hha:fx {kind, amp, text, ms, colorHint}
     - hha:fever {on, level, remainMs, reason}
     - hha:director {wave, intensity, spawnMul, timeScale}
*/
(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  const clamp = (v,min,max)=>Math.max(min, Math.min(max, v));
  const now = ()=> performance.now ? performance.now() : Date.now();

  function emit(name, detail){
    try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
  }

  function makeRng(seedStr){
    // deterministic-ish PRNG from string (xmur3 + sfc32)
    function xmur3(str){
      for (var i=0,h=1779033703^str.length;i<str.length;i++){
        h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
        h = (h<<13) | (h>>>19);
      }
      return function(){
        h = Math.imul(h ^ (h>>>16), 2246822507);
        h = Math.imul(h ^ (h>>>13), 3266489909);
        return (h ^= h>>>16) >>> 0;
      };
    }
    function sfc32(a,b,c,d){
      return function(){
        a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
        var t = (a + b) | 0;
        a = b ^ (b>>>9);
        b = (c + (c<<3)) | 0;
        c = (c<<21 | c>>>11);
        d = (d + 1) | 0;
        t = (t + d) | 0;
        c = (c + t) | 0;
        return (t >>> 0) / 4294967296;
      };
    }
    const seed = seedStr || 'hha';
    const h = xmur3(seed);
    return sfc32(h(), h(), h(), h());
  }

  function createFunBoost(opts){
    opts = opts || {};
    const cfg = {
      seed: String(opts.seed || ''),
      // base tuning
      baseSpawnMul: (opts.baseSpawnMul != null ? +opts.baseSpawnMul : 1.0),
      baseTimeScale: (opts.baseTimeScale != null ? +opts.baseTimeScale : 1.0),

      // wave cycle
      waveCycleMs: (opts.waveCycleMs != null ? +opts.waveCycleMs : 18000), // 18s cycle
      waveCalm:  { ms: 5200,  spawn: 0.90, time: 1.00 },
      waveRush:  { ms: 6200,  spawn: 1.15, time: 1.00 },
      waveChaos: { ms: 4200,  spawn: 1.35, time: 0.98 },
      waveRelief:{ ms: 2400,  spawn: 0.95, time: 1.00 },

      // intensity (adaptive)
      intensityUpHit:   (opts.intensityUpHit   != null ? +opts.intensityUpHit   : 0.018),
      intensityUpMiss:  (opts.intensityUpMiss  != null ? +opts.intensityUpMiss  : 0.035),
      intensityDownPerfect:(opts.intensityDownPerfect!=null? +opts.intensityDownPerfect: 0.030),
      intensityDecayPerSec:(opts.intensityDecayPerSec!=null? +opts.intensityDecayPerSec: 0.020),

      // fever
      feverChargeHit:   (opts.feverChargeHit   != null ? +opts.feverChargeHit   : 1),
      feverChargePerfect:(opts.feverChargePerfect!=null? +opts.feverChargePerfect: 2),
      feverChargeMiss:  (opts.feverChargeMiss  != null ? +opts.feverChargeMiss  : -2),
      feverThreshold:   (opts.feverThreshold   != null ? +opts.feverThreshold   : 18),
      feverDurationMs:  (opts.feverDurationMs  != null ? +opts.feverDurationMs  : 6500),
      feverSpawnBoost:  (opts.feverSpawnBoost  != null ? +opts.feverSpawnBoost  : 1.25),
      feverTimeScale:   (opts.feverTimeScale   != null ? +opts.feverTimeScale   : 0.90),

      // near miss
      nearMissWindowMs: (opts.nearMissWindowMs != null ? +opts.nearMissWindowMs : 260),

      // fx amplitude
      fxHitAmp:         (opts.fxHitAmp         != null ? +opts.fxHitAmp         : 0.55),
      fxMissAmp:        (opts.fxMissAmp        != null ? +opts.fxMissAmp        : 0.45),
      fxPerfectAmp:     (opts.fxPerfectAmp     != null ? +opts.fxPerfectAmp     : 0.85),
      fxFeverAmp:       (opts.fxFeverAmp       != null ? +opts.fxFeverAmp       : 0.95),
    };

    const rng = makeRng(cfg.seed || String(Math.random()));

    const st = {
      t0: now(),
      lastT: now(),
      // wave
      waveName: 'calm',
      waveT: 0,
      // intensity 0..1
      intensity: 0.18,
      // streak
      streak: 0,
      // fever
      feverCharge: 0,
      feverOn: false,
      feverUntil: 0,
      // near miss book
      lastTimeoutMs: 0,
      // stats
      hit: 0,
      miss: 0,
      perfect: 0,
      nearMiss: 0,
    };

    function waveAt(tMs){
      // cycle inside [calm,rush,chaos,relief]
      const cycle = cfg.waveCalm.ms + cfg.waveRush.ms + cfg.waveChaos.ms + cfg.waveRelief.ms;
      let x = (tMs % cycle);
      if(x < cfg.waveCalm.ms) return ['calm', cfg.waveCalm];
      x -= cfg.waveCalm.ms;
      if(x < cfg.waveRush.ms) return ['rush', cfg.waveRush];
      x -= cfg.waveRush.ms;
      if(x < cfg.waveChaos.ms) return ['chaos', cfg.waveChaos];
      return ['relief', cfg.waveRelief];
    }

    function startFever(reason){
      st.feverOn = true;
      st.feverUntil = now() + cfg.feverDurationMs;
      st.feverCharge = 0;
      emit('hha:fever', { on:true, level:1, remainMs: cfg.feverDurationMs, reason: reason || 'threshold' });
      emit('hha:fx', { kind:'fever_on', amp: cfg.fxFeverAmp, text:'FEVER!', ms: 700, colorHint:'pink' });
    }
    function stopFever(reason){
      st.feverOn = false;
      st.feverUntil = 0;
      emit('hha:fever', { on:false, level:0, remainMs: 0, reason: reason || 'end' });
      emit('hha:fx', { kind:'fever_off', amp: 0.45, text:'', ms: 180, colorHint:'muted' });
    }

    function tick(){
      const t = now();
      const dt = Math.max(0, (t - st.lastT) / 1000);
      st.lastT = t;

      // decay intensity slowly
      st.intensity = clamp(st.intensity - cfg.intensityDecayPerSec * dt, 0, 1);

      // fever timeout
      if(st.feverOn && t >= st.feverUntil){
        stopFever('timeout');
      }

      // wave
      const [wname, wcfg] = waveAt(t - st.t0);
      st.waveName = wname;

      // compute multipliers
      let spawnMul = cfg.baseSpawnMul * wcfg.spawn * (1 + st.intensity * 0.55);
      let timeScale = cfg.baseTimeScale * wcfg.time;

      if(st.feverOn){
        spawnMul *= cfg.feverSpawnBoost;
        timeScale *= cfg.feverTimeScale;
      }

      spawnMul = clamp(spawnMul, 0.65, 2.2);
      timeScale = clamp(timeScale, 0.78, 1.08);

      emit('hha:director', {
        wave: st.waveName,
        intensity: st.intensity,
        spawnMul,
        timeScale
      });

      return { spawnMul, timeScale, wave: st.waveName, intensity: st.intensity, feverOn: st.feverOn };
    }

    function onAction(a){
      // a: {type:'hit'|'miss'|'perfect'|'timeout'|'shot_miss', quality?}
      if(!a || !a.type) return;

      const t = now();
      const type = a.type;

      if(type === 'hit'){
        st.hit++;
        st.streak++;
        st.intensity = clamp(st.intensity + cfg.intensityUpHit, 0, 1);
        st.feverCharge += cfg.feverChargeHit;
        emit('hha:fx', { kind:'hit', amp: cfg.fxHitAmp, text: (st.streak>0 && st.streak%10===0) ? `STREAK ${st.streak}` : '', ms: 120, colorHint:'good' });

        // small “rush flash” every 3 hits
        if(st.streak>0 && st.streak%3===0){
          emit('hha:fx', { kind:'streak', amp: 0.35, text:'', ms: 80, colorHint:'cyan' });
        }

      } else if(type === 'perfect'){
        st.perfect++;
        st.streak++;
        st.intensity = clamp(st.intensity + cfg.intensityUpHit*0.8, 0, 1);
        st.intensity = clamp(st.intensity - cfg.intensityDownPerfect, 0, 1);
        st.feverCharge += cfg.feverChargePerfect;
        emit('hha:fx', { kind:'perfect', amp: cfg.fxPerfectAmp, text:'PERFECT', ms: 240, colorHint:'violet' });
        // micro slowmo hint via director event (game can apply)
        emit('hha:director', { hint:'slowmo', ms: 220 });

      } else if(type === 'timeout'){
        st.miss++;
        st.streak = 0;
        st.intensity = clamp(st.intensity + cfg.intensityUpMiss, 0, 1);
        st.feverCharge += cfg.feverChargeMiss;

        // mark last timeout for near miss detection if someone hits very late (game may call near-miss)
        st.lastTimeoutMs = t;

        emit('hha:fx', { kind:'miss', amp: cfg.fxMissAmp, text:'MISS', ms: 160, colorHint:'amber' });

      } else if(type === 'shot_miss' || type === 'miss'){
        st.miss++;
        st.streak = 0;
        st.intensity = clamp(st.intensity + cfg.intensityUpMiss, 0, 1);
        st.feverCharge += cfg.feverChargeMiss;
        emit('hha:fx', { kind:'miss', amp: cfg.fxMissAmp, text:'MISS', ms: 130, colorHint:'amber' });
      }

      // fever threshold check
      if(!st.feverOn && st.feverCharge >= cfg.feverThreshold){
        startFever('charge');
      }
    }

    function onNearMiss(info){
      // call when target expires close to cursor/hit window
      st.nearMiss++;
      emit('hha:fx', { kind:'near_miss', amp: 0.55, text:'ALMOST!', ms: 220, colorHint:'amber' });
    }

    function getState(){
      return {
        wave: st.waveName,
        intensity: st.intensity,
        streak: st.streak,
        feverOn: st.feverOn,
        feverCharge: st.feverCharge,
        stats: { hit: st.hit, miss: st.miss, perfect: st.perfect, nearMiss: st.nearMiss }
      };
    }

    // helper: compute spawn interval multiplier
    function scaleIntervalMs(baseMs, latestDirector){
      const d = latestDirector || tick();
      return Math.max(80, Math.round(baseMs / (d.spawnMul || 1)));
    }

    return {
      cfg,
      tick,
      onAction,
      onNearMiss,
      getState,
      scaleIntervalMs
    };
  }

  WIN.HHA = WIN.HHA || {};
  WIN.HHA.createFunBoost = createFunBoost;
})();