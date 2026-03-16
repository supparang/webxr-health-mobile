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
  stopDemoTutorial,
  DIFF,
  humanZoneInstruction
}){
  let activePointerId = null;

  function movementDirection(dx, dy){
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    if(ax < 2 && ay < 2) return 'none';
    if(ax > ay * 1.15) return 'horizontal';
    if(ay > ax * 1.15) return 'vertical';
    return 'diagonal';
  }

  function directionScore(idx, dx, dy){
    const want = (idx === 2 || idx === 5) ? 'horizontal' : 'vertical';
    const got = movementDirection(dx, dy);

    if(got === 'none') return 1;
    if(got === want) return 1.3;
    if(got === 'diagonal') return 0.95;
    return 0.72;
  }

  function beginBrush(ev){
    if(!arenaCore) return;
    activePointerId = ev.pointerId ?? null;

    try{
      arenaCore.setPointerCapture?.(ev.pointerId);
    }catch{}

    S.isBrushing = true;
    scoring?.resetBrushCombo?.();

    const r = arenaCore.getBoundingClientRect();
    S.brushLastX = ev.clientX - r.left;
    S.brushLastY = ev.clientY - r.top;
    S.brushLastT = performance.now();

    fx?.spawnTrail?.(S.brushLastX, S.brushLastY, 0);
  }

  function endBrush(ev){
    if(activePointerId !== null && ev?.pointerId != null && ev.pointerId !== activePointerId){
      return;
    }

    try{
      arenaCore?.releasePointerCapture?.(activePointerId);
    }catch{}

    activePointerId = null;
    S.isBrushing = false;
    scoring?.resetBrushCombo?.();
    ui?.hideBrushCursor?.();
    ui?.resetDirBadge?.(S.activeZoneIdx);
  }

  function onPointerDown(ev){
    if(S.finished || !arenaCore) return;

    ev.preventDefault();
    stopDemoTutorial?.();
    ui?.updateBrushCursor?.(ev);
    audio?.ensureAudio?.();

    beginBrush(ev);
  }

  function onPointerMove(ev){
    if(activePointerId !== null && ev.pointerId != null && ev.pointerId !== activePointerId){
      return;
    }

    if(!S.isBrushing || S.finished || !arenaCore) return;

    ev.preventDefault();
    ui?.updateBrushCursor?.(ev);

    const r = arenaCore.getBoundingClientRect();
    const x = ev.clientX - r.left;
    const y = ev.clientY - r.top;
    const dx = x - S.brushLastX;
    const dy = y - S.brushLastY;
    const dist = Math.hypot(dx, dy);

    S.lastBrushDx = dx;
    S.lastBrushDy = dy;

    if(dist < 6) return;

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

        if(star >= 3) audio?.playCue?.('zone-perfect');
        else audio?.playCue?.('zone-clear');

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

        if(Math.random() < 0.22){
          fx?.spawnFoam?.(x, y);
        }

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

  function onZonePointerDown(idx, ev){
    if(S.finished || !arenaCore) return;

    ev.preventDefault();
    stopDemoTutorial?.();
    ui?.updateBrushCursor?.(ev);
    audio?.ensureAudio?.();
    beginBrush(ev);

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
          if(S.bossHP <= 0){
            boss?.maybeAdvanceBossPhase?.(x, y);
          }
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

      ui?.setNowDoText?.(
        `ยังไม่ใช่โซนนี้ • ให้ถู ${humanZoneInstruction?.(S.zoneState[S.activeZoneIdx]?.label || 'โซนที่กำหนด')}`
      );
      ui?.setCoachText?.('ยังไม่ใช่โซนนี้นะ ลองดูกรอบสีฟ้า', 'warn');
      audio?.playCue?.('wrong-zone');
      ui?.refreshZoneUI?.();
      return;
    }

    if(S.phase !== 'boss'){
      const boost = performance.now() < S.uvUntil ? 1.15 : 1;
      const delta = (DIFF?.stroke || 8) * 0.45 * boost;

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

        if(star >= 3) audio?.playCue?.('zone-perfect');
        else audio?.playCue?.('zone-clear');
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
      const dmg = (DIFF?.bossStroke || 11) * 0.5 * boost;

      S.bossHP = Math.max(0, S.bossHP - dmg);
      zs.clean = Math.max(0, Math.min(100, zs.clean + 1.4 * boost));
      zs.dirt = Math.max(0, Math.min(100, zs.dirt - 2.4 * boost));

      S.bossHits++;
      scoring?.addScore?.(7 * boost, x, y, boost > 1 ? 'BOSS!' : 'HIT');
      zones?.pulseZone?.(idx, true);
      fx?.flashScreen?.('boss');

      zones?.renderDirtForZone?.(idx);
      if(S.bossHP <= 0){
        boss?.maybeAdvanceBossPhase?.(x, y);
      }

      ui?.refreshZoneUI?.();
      emitProgress?.();
    }
  }

  function bindInput(){
    if(!arenaCore) return;

    arenaCore.addEventListener('pointerdown', onPointerDown, { passive:false });
    arenaCore.addEventListener('pointermove', onPointerMove, { passive:false });
    arenaCore.addEventListener('pointerup', endBrush, { passive:false });
    arenaCore.addEventListener('pointercancel', endBrush, { passive:false });
    arenaCore.addEventListener('pointerleave', endBrush, { passive:false });
  }

  return {
    bindInput,
    endBrush,
    onPointerDown,
    onPointerMove,
    onZonePointerDown,
    directionScore,
    movementDirection
  };
}