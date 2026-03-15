// /herohealth/vr-brush/brush.input.js

export function createBrushInput({
  arenaCore,
  S,
  ui,
  fx,
  zones,
  scoring,
  boss,
  currentModeCfg,
  zoneDirectionText,
  zoneRealLifeTip,
  zoneCoachFeedback,
  calcZoneStars,
  audio,
  emitProgress,
  emitHha,
  eventPayload,
  stopDemoTutorial
}){
  function bindInput(){
    if(!arenaCore) return;

    arenaCore.addEventListener('pointermove', onPointerMove);
    arenaCore.addEventListener('pointerdown', onPointerDown);
    arenaCore.addEventListener('pointerup', endBrush);
    arenaCore.addEventListener('pointercancel', endBrush);
    arenaCore.addEventListener('pointerleave', endBrush);
  }

  function onPointerDown(ev){
    stopDemoTutorial?.();
    ui?.updateBrushCursor?.(ev);
    audio?.ensureAudio?.();
    if(S.finished) return;

    const r = arenaCore.getBoundingClientRect();
    S.isBrushing = true;
    scoring?.resetBrushCombo?.();
    S.brushLastX = ev.clientX - r.left;
    S.brushLastY = ev.clientY - r.top;
    S.brushLastT = performance.now();
    fx?.spawnTrail?.(S.brushLastX, S.brushLastY, 0);
  }

  function onPointerMove(ev){
    ui?.updateBrushCursor?.(ev);
    if(!S.isBrushing || S.finished) return;

    const r = arenaCore.getBoundingClientRect();
    const x = ev.clientX - r.left;
    const y = ev.clientY - r.top;
    const dx = x - S.brushLastX;
    const dy = y - S.brushLastY;
    const dist = Math.hypot(dx, dy);

    S.lastBrushDx = dx;
    S.lastBrushDy = dy;

    if(dist < 8) return;

    const rot = Math.atan2(dy || 0.001, dx || 0.001) * 180 / Math.PI;
    fx?.spawnTrail?.(x, y, rot);

    const activeIdx = S.activeZoneIdx;
    const insideActive = zones?.pointInZone?.(activeIdx, x, y);

    if(insideActive && !S.bossStarted){
      scoring?.addBrushDragProgress?.({
        idx: activeIdx,
        dist,
        x,
        y,
        directionScore,
        zoneState: S.zoneState,
        zoneMastery: S.zoneMastery,
        zoneDirectionText,
        ui,
        audio
      });

      zones?.renderDirtForZone?.(activeIdx);

      const zs = S.zoneState[activeIdx];
      if(zones?.markZoneCompleted?.(activeIdx, currentModeCfg().cleanTarget)){
        const star = calcZoneStars(
          S.zoneState,
          S.zoneMastery,
          activeIdx,
          currentModeCfg().cleanTarget
        );

        fx?.spawnPop?.(x, y, `ครบโซน! ${'★'.repeat(star)}${'☆'.repeat(3-star)}`);

        const coach = zoneCoachFeedback({
          zoneState: S.zoneState,
          zoneMastery: S.zoneMastery,
          idx: activeIdx,
          mode: S.mode,
          targetClean: currentModeCfg().cleanTarget
        });

        const tip = zoneRealLifeTip(activeIdx);
        ui?.setCoachText?.(`${coach.text} • ${tip}`, coach.tone);
        audio?.playCue?.(star >= 3 ? 'zone-perfect' : 'zone-clear');

        S.coachHistory.push({
          ts: new Date().toISOString(),
          zoneId: zs.id,
          zoneLabel: zs.label,
          star,
          text: `${coach.text} • ${tip}`,
          tone: coach.tone
        });
      }

      zones?.maybeAdvanceZone?.();
      boss?.maybeStartBoss?.(currentModeCfg().cleanTarget);
    }
    else if(insideActive && S.phase === 'boss' && !S.bossCompleted){
      if(S.bossMode === 'laserLive'){
        boss?.punishLaser?.(x, y);
        scoring?.resetBrushCombo?.();
      } else if(S.bossMode !== 'shockWait' && S.bossMode !== 'decoy'){
        const dirBoost = directionScore(activeIdx, dx, dy);
        const dmg = dist * 0.08 * dirBoost;
        S.bossHP = Math.max(0, S.bossHP - dmg);
        S.score += Math.max(0, Math.round(dist * 0.16 * dirBoost));
        if(Math.random() < 0.22) fx?.spawnFoam?.(x, y);
        zones?.renderDirtForZone?.(activeIdx);
        if(S.bossHP <= 0){
          boss?.maybeAdvanceBossPhase?.(x, y);
        }
      }
    }
    else{
      scoring?.resetBrushCombo?.();
    }

    ui?.updateDirBadge?.(S.activeZoneIdx, dx, dy, directionScore);

    S.brushLastX = x;
    S.brushLastY = y;
    S.brushLastT = performance.now();
    ui?.refreshZoneUI?.();
  }

  function endBrush(){
    S.isBrushing = false;
    scoring?.resetBrushCombo?.();
    ui?.hideBrushCursor?.();
    ui?.resetDirBadge?.(S.activeZoneIdx);
  }

  function directionScore(idx, dx, dy){
    const want = (S.zoneState[idx] && S.zoneState[idx].id && (
      idx === 2 || idx === 5
    )) ? 'horizontal' : ((idx === 2 || idx === 5) ? 'horizontal' : 'vertical');

    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    let got = 'none';
    if(ax >= 2 || ay >= 2){
      if(ax > ay * 1.15) got = 'horizontal';
      else if(ay > ax * 1.15) got = 'vertical';
      else got = 'diagonal';
    }

    if(got === 'none') return 1;
    if(got === want) return 1.3;
    if(got === 'diagonal') return 0.95;
    return 0.72;
  }

  function onZonePointerDown(idx, ev, helpers){
    if(S.finished || !arenaCore) return;
    stopDemoTutorial?.();

    const rect = arenaCore.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;
    const zs = S.zoneState[idx];
    const isActive = idx === S.activeZoneIdx;
    const now = performance.now();

    if(S.phase === 'boss' && !S.bossCompleted){
      if(S.bossMode === 'laserLive'){
        boss?.punishLaser?.(x, y);
        ui?.refreshZoneUI?.();
        return;
      }

      if(S.bossMode === 'shockWait'){
        const goodWindow = Math.abs(now - S.shockGoodAt) <= 140;
        if(isActive && goodWindow){
          boss?.rewardShockPerfect?.(x, y);
          zones?.renderDirtForZone?.(idx);
          if(S.bossHP <= 0) boss?.maybeAdvanceBossPhase?.(x, y);
          ui?.refreshZoneUI?.();
          emitProgress?.();
          return;
        } else {
          scoring?.addMiss?.(x, y, goodWindow ? 'ผิดโซน' : 'พลาดจังหวะ');
          zones?.pulseZone?.(idx, false);
          const mShock = S.zoneMastery[idx];
          if(mShock) mShock.localMiss++;
          ui?.setCoachText?.('ลองแตะตามจังหวะอีกครั้ง', 'warn');
          ui?.refreshZoneUI?.();
          return;
        }
      }

      if(S.bossMode === 'decoy' && idx === S.decoyZoneIdx){
        boss?.punishDecoy?.(x, y);
        ui?.refreshZoneUI?.();
        return;
      }
    }

    if(!isActive){
      scoring?.addMiss?.(x, y, 'ผิดโซน');
      zones?.pulseZone?.(idx, false);
      const activeMastery = S.zoneMastery[S.activeZoneIdx];
      if(activeMastery) activeMastery.localMiss++;
      ui?.setNowDoText?.(`ยังไม่ใช่โซนนี้ • ให้ถู ${helpers?.humanZoneInstruction?.(S.zoneState[S.activeZoneIdx]?.label || 'โซนที่กำหนด')}`);
      ui?.setCoachText?.('ยังไม่ใช่โซนนี้นะ ลองดูกรอบสีฟ้า', 'warn');
      audio?.playCue?.('wrong-zone');
      ui?.refreshZoneUI?.();
      return;
    }

    if(S.phase !== 'boss'){
      const boost = performance.now() < S.uvUntil ? 1.15 : 1;
      const delta = (helpers?.DIFF?.stroke || 8) * 0.45 * boost;
      zs.clean = Math.max(0, Math.min(100, zs.clean + delta));
      zs.dirt = Math.max(0, Math.min(100, zs.dirt - delta * 0.85));

      scoring?.addScore?.(4 * boost, x, y, boost > 1 ? 'CLEAN+' : 'CLEAN');
      zones?.pulseZone?.(idx, true);

      if(zones?.markZoneCompleted?.(idx, currentModeCfg().cleanTarget)){
        const star = calcZoneStars(
          S.zoneState,
          S.zoneMastery,
          idx,
          currentModeCfg().cleanTarget
        );

        fx?.spawnPop?.(x, y, `ครบโซน! ${'★'.repeat(star)}${'☆'.repeat(3-star)}`);

        const coach = zoneCoachFeedback({
          zoneState: S.zoneState,
          zoneMastery: S.zoneMastery,
          idx,
          mode: S.mode,
          targetClean: currentModeCfg().cleanTarget
        });

        const tip = zoneRealLifeTip(idx);
        ui?.setCoachText?.(`${coach.text} • ${tip}`, coach.tone);
        audio?.playCue?.(star >= 3 ? 'zone-perfect' : 'zone-clear');

        S.coachHistory.push({
          ts: new Date().toISOString(),
          zoneId: zs.id,
          zoneLabel: zs.label,
          star,
          text: `${coach.text} • ${tip}`,
          tone: coach.tone
        });
      }

      zones?.renderDirtForZone?.(idx);
      zones?.maybeAdvanceZone?.();
      boss?.maybeStartBoss?.(currentModeCfg().cleanTarget);
      ui?.refreshZoneUI?.();
      emitProgress?.();
      return;
    }

    if(S.phase === 'boss' && !S.bossCompleted){
      const boost = performance.now() < S.uvUntil ? 1.1 : 1;
      const dmg = (helpers?.DIFF?.bossStroke || 11) * 0.5 * boost;
      S.bossHP = Math.max(0, S.bossHP - dmg);
      zs.clean = Math.max(0, Math.min(100, zs.clean + 1.4 * boost));
      zs.dirt = Math.max(0, Math.min(100, zs.dirt - 2.4 * boost));

      S.bossHits++;
      scoring?.addScore?.(7 * boost, x, y, boost > 1 ? 'BOSS!' : 'HIT');
      zones?.pulseZone?.(idx, true);
      fx?.flashScreen?.('boss');

      zones?.renderDirtForZone?.(idx);
      if(S.bossHP <= 0) boss?.maybeAdvanceBossPhase?.(x, y);

      ui?.refreshZoneUI?.();
      emitProgress?.();
    }
  }

  return {
    bindInput,
    onZonePointerDown
  };
}