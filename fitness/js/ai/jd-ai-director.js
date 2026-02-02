// === js/ai/jd-ai-director.js ===
// Difficulty Director (PACK 2)
// Goal: keep player in fun-zone (accuracy ~ 70–85%) without feeling "cheated"
'use strict';

(function(){
  const WIN = window;
  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));

  function createDirector(){
    let lastTuneAt = 0;

    // target zone
    const TARGET_ACC = 0.78;
    const MIN_ACC = 0.65;
    const MAX_ACC = 0.88;

    // tuning caps per second (smooth)
    const MAX_INTERVAL_SHIFT = 120; // ms per tune
    const MAX_SPEED_SHIFT    = 6;   // units/sec per tune
    const MAX_WINDOW_SHIFT   = 16;  // ms per tune

    function tune(nowMs, ctx){
      // ctx:
      // {mode, adaptiveOn, baseCfg, liveCfg, stats, predictor, boss, progress}
      // returns patch: {spawnIntervalMs?, speedUnitsPerSec?, hitWindowMs?}
      if(!ctx || !ctx.adaptiveOn) return null;

      // throttle
      if(nowMs - lastTuneAt < 900) return null;
      lastTuneAt = nowMs;

      const stats = ctx.stats || {};
      const acc = clamp(stats.accRecent ?? 0, 0, 1);
      const rt  = Number(stats.rtRecent||0);

      const pred = ctx.predictor || {};
      const risk = clamp(pred.risk_miss_next ?? 0.4, 0, 1);

      const base = ctx.baseCfg || {};
      const live = ctx.liveCfg || {};

      let interval = Number(live.spawnIntervalMs ?? base.spawnIntervalMs ?? 1000);
      let speed    = Number(live.speedUnitsPerSec ?? base.speedUnitsPerSec ?? 48);
      let windowMs = Number(live.hitWindowMs ?? base.hitWindowMs ?? 220);

      // If failing -> soften a bit
      if(acc < MIN_ACC || risk > 0.70){
        interval += MAX_INTERVAL_SHIFT;
        speed    -= MAX_SPEED_SHIFT;
        windowMs += MAX_WINDOW_SHIFT;
      }
      // If too easy -> spice up (especially mid/late game)
      else if(acc > MAX_ACC && risk < 0.45){
        const late = (ctx.progress ?? 0) > 0.55 ? 1.0 : 0.7;
        interval -= MAX_INTERVAL_SHIFT * late;
        speed    += MAX_SPEED_SHIFT    * late;
        windowMs -= MAX_WINDOW_SHIFT   * 0.6;
      }
      // In fun zone -> tiny nudge based on RT
      else{
        if(rt > 310){
          interval += 60;
          windowMs += 10;
        }else if(rt < 230){
          interval -= 60;
          speed    += 3;
        }
      }

      // clamp safety
      interval = clamp(interval, 520, 1500);
      speed    = clamp(speed, 32, 78);
      windowMs = clamp(windowMs, 160, 300);

      // don't over-buff during boss: boss already spicy
      if(ctx.boss){
        interval = clamp(interval, 520, 1150);
        speed    = clamp(speed, 36, 80);
        windowMs = clamp(windowMs, 160, 260);
      }

      return {
        spawnIntervalMs: Math.round(interval),
        speedUnitsPerSec: Math.round(speed),
        hitWindowMs: Math.round(windowMs)
      };
    }

    return { tune };
  }

  WIN.JD_AI_DIRECTOR_FACTORY = { createDirector };
})();