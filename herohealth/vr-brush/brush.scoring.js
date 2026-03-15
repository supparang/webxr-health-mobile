// /herohealth/vr-brush/brush.scoring.js

export function createBrushScoring({
  S,
  DIFF,
  currentModeCfg,
  fx
}){
  function addScore(base, x, y, label){
    S.score += base;
    S.hits++;
    S.totalActions++;

    const now = performance.now();
    if(now - S.lastTapAt <= DIFF.comboWindow) S.combo++;
    else S.combo = 1;

    S.lastTapAt = now;
    S.maxCombo = Math.max(S.maxCombo, S.combo);

    const mult = 1 + Math.min(1.2, S.combo * 0.03);
    S.score += Math.round(base * (mult - 1));

    fx?.spawnPop?.(x, y, label || (`+${Math.round(base)}`));
    fx?.spawnSparkle?.(x, y);
    fx?.flashScreen?.('good');
    fx?.showComboBadge?.(S.combo);
  }

  function addMiss(x, y, reason){
    S.miss++;
    S.totalActions++;
    S.combo = 0;
    S.score = Math.max(0, S.score - currentModeCfg().missPenalty);
    fx?.spawnPop?.(x, y, reason || 'MISS');
    fx?.flashScreen?.('bad');
  }

  function rewardMiniScore(score){
    S.score += Math.max(0, score || 0);
  }

  function resetCombo(){
    S.combo = 0;
  }

  function resetBrushCombo(){
    S.brushPathCombo = 0;
  }

  function addBrushDragProgress({
    idx,
    dist,
    x,
    y,
    directionScore,
    zoneState,
    zoneMastery,
    zoneDirectionText,
    ui,
    audio
  }){
    const zs = zoneState[idx];
    if(!zs) return;

    const safeDist = Math.max(0, dist);
    if(safeDist < 4) return;

    const continuous = performance.now() - S.brushLastT <= 120;
    if(continuous) S.brushPathCombo = Math.min(140, S.brushPathCombo + safeDist);
    else S.brushPathCombo = safeDist;

    const pathBoost =
      S.brushPathCombo >= 120 ? 1.55 :
      S.brushPathCombo >= 80  ? 1.35 :
      S.brushPathCombo >= 40  ? 1.18 : 1;

    const dirBoost = directionScore(idx, S.lastBrushDx, S.lastBrushDy);
    const cleanGain = safeDist * 0.055 * pathBoost * dirBoost;

    zs.clean = Math.max(0, Math.min(100, zs.clean + cleanGain));
    zs.dirt  = Math.max(0, Math.min(100, zs.dirt - cleanGain * (
      dirBoost >= 1.25 ? 1.2 : dirBoost < 0.9 ? 0.72 : 0.95
    )));

    const microScore = Math.max(0, Math.round(safeDist * 0.12 * pathBoost * dirBoost));
    rewardMiniScore(microScore);

    const ms = zoneMastery[idx];
    if(dirBoost >= 1.25){
      if(ms) ms.correctDirHits++;
      if(Math.random() < 0.04){
        ui?.setCoachText?.(`ดีมาก กำลัง${zoneDirectionText(idx)}ได้ถูกต้อง`, 'good');
        audio?.playCue?.('dir-good');
      }
    } else if(dirBoost < 0.9){
      if(ms) ms.wrongDirHits++;
      if(Math.random() < 0.03){
        ui?.setCoachText?.(`ลอง${zoneDirectionText(idx)}เบา ๆ นะ จะสะอาดเร็วขึ้น`, 'warn');
        audio?.playCue?.('dir-warn');
      }
    }

    if(Math.random() < 0.18){
      fx?.spawnFoam?.(x, y);
    }
  }

  return {
    addScore,
    addMiss,
    rewardMiniScore,
    resetCombo,
    resetBrushCombo,
    addBrushDragProgress
  };
}