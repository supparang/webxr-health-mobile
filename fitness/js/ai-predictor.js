// === /fitness/js/ai-predictor.js — Online AI Predictor (ML-ready, no DL runtime) ===
'use strict';

function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

function ewma(prev, x, alpha){
  if (prev == null || Number.isNaN(prev)) return x;
  return prev + alpha * (x - prev);
}

export function createAIPredictor(){
  const S = {
    // rolling stats
    rt_mean: null,
    rt_var:  null,
    acc_ewma: 0.75,
    miss_ewma: 0.10,
    bomb_ewma: 0.05,
    combo_ewma: 0.0,

    // recent window
    lastHitAt: 0,
    missStreak: 0,
    hitStreak: 0,

    // fatigue proxies
    lowHpSec: 0,
    feverSec: 0,

    // outputs
    skill_pred: 0.5,
    fatigue_pred: 0.2,
    fail5_pred: 0.2,

    // counters
    n_hits: 0,
    n_events: 0,
  };

  function observeEvent(e){
    // e: {type:'hit'|'timeout'|'super'..., grade, rtMs, targetType, isBossFace, bossPhase, playerHp, feverOn, combo}
    S.n_events++;

    if (e.type === 'hit'){
      S.n_hits++;
      S.lastHitAt = e.nowMs || 0;
      S.hitStreak++;
      S.missStreak = 0;

      // RT update (only for normal hits)
      if (typeof e.rtMs === 'number' && e.rtMs > 0 && e.targetType === 'normal'){
        const x = e.rtMs;
        const m0 = S.rt_mean;
        S.rt_mean = ewma(S.rt_mean, x, 0.12);
        // simple var EWMA around mean
        const diff = (m0 == null) ? 0 : (x - S.rt_mean);
        S.rt_var = ewma(S.rt_var, diff*diff, 0.10);
      }

      const good = (e.grade === 'perfect' || e.grade === 'good');
      const bad  = (e.grade === 'bad' || e.grade === 'bomb');

      S.acc_ewma = ewma(S.acc_ewma, good ? 1 : (bad ? 0 : 0.6), 0.10);
      S.bomb_ewma = ewma(S.bomb_ewma, (e.grade === 'bomb') ? 1 : 0, 0.08);

      const c = Number(e.combo || 0);
      S.combo_ewma = ewma(S.combo_ewma, clamp(c/12, 0, 1), 0.08);
    }

    if (e.type === 'timeout' || (e.type === 'hit' && e.grade === 'bomb')){
      S.missStreak++;
      S.hitStreak = 0;
      S.miss_ewma = ewma(S.miss_ewma, 1, 0.12);
      // decay acc a bit
      S.acc_ewma = ewma(S.acc_ewma, 0.25, 0.07);
    } else {
      S.miss_ewma = ewma(S.miss_ewma, 0, 0.05);
    }
  }

  function observeTick(dtMs, state){
    // fatigue signals
    const hp = Number(state.playerHp || 1);
    if (hp <= 0.30) S.lowHpSec += dtMs/1000;
    if (state.feverOn) S.feverSec += dtMs/1000;

    // derive features
    const rt = (S.rt_mean == null) ? 520 : S.rt_mean;         // ms
    const rt_sd = Math.sqrt(Math.max(0, S.rt_var || 0));       // ms
    const acc = clamp(S.acc_ewma, 0, 1);
    const miss = clamp(S.miss_ewma, 0, 1);
    const bomb = clamp(S.bomb_ewma, 0, 1);
    const combo = clamp(S.combo_ewma, 0, 1);

    // skill: high acc + low rt + stable rt + combo
    // map rt 250..700 to 1..0
    const rtScore = clamp(1 - (rt - 250) / 450, 0, 1);
    const sdScore = clamp(1 - (rt_sd - 40) / 220, 0, 1);

    const phase = Number(state.bossPhase || 1);
    const phasePenalty = phase === 3 ? 0.06 : phase === 2 ? 0.03 : 0;

    const skill =
      0.40*acc +
      0.22*rtScore +
      0.12*sdScore +
      0.18*combo -
      0.10*bomb -
      phasePenalty;

    // fatigue: low hp time + miss streak + high rt
    const hpRisk = clamp((0.40 - hp) / 0.40, 0, 1);
    const streakRisk = clamp(S.missStreak / 4, 0, 1);
    const slowRisk = clamp((rt - 420) / 400, 0, 1);

    const fatigue =
      0.38*hpRisk +
      0.30*streakRisk +
      0.18*slowRisk +
      0.14*miss;

    // fail5_pred: chance to fail soon (0..1)
    // add “danger” when miss streak grows or hp low
    let fail5 =
      0.46*fatigue +
      0.20*miss +
      0.16*hpRisk +
      0.10*streakRisk +
      0.08*(1 - acc);

    // if player is in fever, reduce fail probability a bit
    if (state.feverOn) fail5 *= 0.88;

    S.skill_pred = clamp(skill, 0, 1);
    S.fatigue_pred = clamp(fatigue, 0, 1);
    S.fail5_pred = clamp(fail5, 0, 1);
  }

  function snapshot(){
    return {
      skill_pred: +S.skill_pred.toFixed(3),
      fatigue_pred: +S.fatigue_pred.toFixed(3),
      fail5_pred: +S.fail5_pred.toFixed(3),
      rt_mean: S.rt_mean == null ? '' : +S.rt_mean.toFixed(1),
      rt_sd: S.rt_var == null ? '' : +Math.sqrt(Math.max(0,S.rt_var)).toFixed(1),
      acc_ewma: +S.acc_ewma.toFixed(3),
      miss_ewma: +S.miss_ewma.toFixed(3),
      bomb_ewma: +S.bomb_ewma.toFixed(3),
      miss_streak: S.missStreak|0,
      hit_streak: S.hitStreak|0,
    };
  }

  return { observeEvent, observeTick, snapshot };
}