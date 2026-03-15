// /herohealth/vr-brush/brush.boss.js

export function createBrushBossController(ctx){
  const {
    S,
    CFG,
    setBossBanner,
    showPhaseToast,
    flashScreen,
    spawnPop,
    spawnSparkle,
    setCoachText,
    showCoachToast,
    refreshZoneUI,
    renderDirtForZone,
    emitHha,
    eventPayload,
    audio,
    laserLine,
    shockRing
  } = ctx;

  function bossPhaseCfg(phase){
    return CFG.bossPhases.find(p => p.phase === phase) || CFG.bossPhases[CFG.bossPhases.length - 1];
  }

  function scheduleNextBossPattern(delayMs){
    S.bossNextPatternAt = performance.now() + (delayMs || (1200 + Math.random()*1000));
  }

  function clearDecoy(){
    if(S.decoyZoneIdx >= 0 && S.zoneState[S.decoyZoneIdx]?.el){
      S.zoneState[S.decoyZoneIdx].el.classList.remove('decoy');
    }
    S.decoyZoneIdx = -1;
  }

  function setBossPhase(phase){
    S.bossPhase = phase;
    const cfg = bossPhaseCfg(phase);
    S.bossHP = cfg.hp;
    S.bossMaxHP = cfg.hp;
    setBossBanner(`🦠 Phase ${phase}: ${cfg.label}`);
    showPhaseToast(`PHASE ${phase}`);
    flashScreen('boss');
    emitHha('hha:event', eventPayload('boss_phase_start', {
      bossPhase: phase,
      bossHP: S.bossHP,
      bossLabel: cfg.label
    }));
  }

  function maybeAdvanceBossPhase(x, y){
    if(S.bossHP > 0) return false;

    if(S.bossPhase < 3){
      S.bossPhase++;
      setBossPhase(S.bossPhase);
      spawnPop(x, y, `PHASE ${S.bossPhase}`);
      setCoachText(`ยอดเยี่ยม! ผ่านบอสเฟส ${S.bossPhase - 1} แล้ว`, 'good');
      showCoachToast(`ผ่านเฟส ${S.bossPhase - 1}`);
      audio.playCue('boss-phase', `ผ่านเฟส ${S.bossPhase}`);
      scheduleNextBossPattern(900);
      return true;
    }

    S.bossCompleted = true;
    S.phase = 'polish';
    clearDecoy();
    laserLine?.classList.remove('on');
    shockRing?.classList.remove('on');
    spawnPop(x, y, 'ชนะบอส!');
    setCoachText('สุดยอด! กำจัดบอสหินปูนได้แล้ว', 'good');
    showCoachToast('ชนะบอสแล้ว!');
    audio.playCue('boss-win');
    emitHha('hha:event', eventPayload('boss_complete', { bossPhase: S.bossPhase }));
    return true;
  }

  function bossPhasePatternPool(){
    if(S.bossPhase <= 1) return ['shock'];
    if(S.bossPhase === 2) return ['shock','laser'];
    return ['shock','laser','decoy'];
  }

  function pickBossPattern(){
    const pool = bossPhasePatternPool();
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function bossEnterLaser(){
    S.bossPattern = 'laser';
    S.bossMode = 'laserWarn';
    S.bossModeUntil = performance.now() + 1000;
    S.laserY = 28 + Math.random()*44;

    if(laserLine){
      laserLine.style.top = S.laserY + '%';
      laserLine.classList.add('on');
    }

    setBossBanner('🚫 LASER! หยุดแปรงชั่วคราว');
    setCoachText('เลเซอร์กำลังมา หยุดก่อนนะ', 'warn');
    audio.playCue('boss-laser');
    emitHha('hha:event', eventPayload('boss_laser_warn', { y:S.laserY }));
  }

  function bossLaserLive(){
    S.bossMode = 'laserLive';
    S.bossModeUntil = performance.now() + 1100;
    laserLine?.classList.add('on');
    setBossBanner('🚫 LASER ACTIVE — แตะจะโดนหักคะแนน');
    emitHha('hha:event', eventPayload('boss_laser_live', { y:S.laserY }));
  }

  function bossExitLaser(){
    laserLine?.classList.remove('on');
    S.quest.laserSurvive++;
    if(S.quest.laserSurvive >= 2) S.quest.doneLaserSurvive = true;
    S.bossMode = 'idle';
    S.bossPattern = 'none';
    scheduleNextBossPattern(900);
  }

  function bossEnterShock(){
    S.bossPattern = 'shock';
    S.bossMode = 'shockWait';
    S.shockGoodAt = performance.now() + 700;
    S.bossModeUntil = S.shockGoodAt + 260;

    if(shockRing){
      shockRing.classList.remove('on');
      void shockRing.offsetWidth;
      shockRing.classList.add('on');
    }

    setBossBanner('⚡ SHOCK! แตะให้ตรงจังหวะวงแหวน');
    setCoachText('รอจังหวะแล้วแตะตามวงแหวน', 'mid');
    audio.playCue('boss-shock');
    emitHha('hha:event', eventPayload('boss_shock_start', {}));
  }

  function bossExitShock(){
    shockRing?.classList.remove('on');
    S.bossMode = 'idle';
    S.bossPattern = 'none';
    scheduleNextBossPattern(950);
  }

  function bossEnterDecoy(){
    clearDecoy();
    S.bossPattern = 'decoy';
    S.bossMode = 'decoy';
    S.bossModeUntil = performance.now() + 1800;

    const candidates = S.zoneState
      .map((z,i)=> ({ z, i }))
      .filter(v => v.i !== S.activeZoneIdx);

    if(candidates.length){
      const pick = candidates[(Math.random()*candidates.length)|0];
      S.decoyZoneIdx = pick.i;
      pick.z.el?.classList.add('decoy');
    }

    setBossBanner('🪞 DECOY! แตะเฉพาะโซนจริงที่เรืองแสง');
    setCoachText('มีโซนหลอกแล้ว แตะเฉพาะโซนจริงนะ', 'warn');
    audio.playCue('boss-decoy');
    emitHha('hha:event', eventPayload('boss_decoy_start', { decoyZoneIdx:S.decoyZoneIdx }));
  }

  function bossExitDecoy(){
    clearDecoy();
    S.quest.decoyAvoid++;
    if(S.quest.decoyAvoid >= 2) S.quest.doneDecoyAvoid = true;
    S.bossMode = 'idle';
    S.bossPattern = 'none';
    scheduleNextBossPattern(900);
  }

  function runBossPatternController(){
    if(!S.bossStarted || S.bossCompleted || S.finished) return;
    const now = performance.now();

    if(S.bossMode === 'idle' && now >= S.bossNextPatternAt){
      const p = pickBossPattern();
      if(p === 'laser') bossEnterLaser();
      else if(p === 'shock') bossEnterShock();
      else bossEnterDecoy();
      return;
    }

    if(S.bossMode === 'laserWarn' && now >= S.bossModeUntil) return bossLaserLive();
    if(S.bossMode === 'laserLive' && now >= S.bossModeUntil) return bossExitLaser();
    if(S.bossMode === 'shockWait' && now >= S.bossModeUntil) return bossExitShock();
    if(S.bossMode === 'decoy' && now >= S.bossModeUntil) return bossExitDecoy();
  }

  function punishLaser(x, y){
    S.score = Math.max(0, S.score - 18);
    S.combo = 0;
    S.miss++;
    S.totalActions++;
    S.metrics.laserPunish++;
    S.quest.laserSurvive = 0;
    flashScreen('bad');
    spawnPop(x, y, 'LASER!');
    audio.playCue('laser-hit');
    emitHha('hha:event', eventPayload('boss_laser_punish', {}));
  }

  function rewardShockPerfect(x, y){
    S.score += 36;
    S.combo += 2;
    S.maxCombo = Math.max(S.maxCombo, S.combo);
    S.bossHP = Math.max(0, S.bossHP - 18);
    S.bossHits++;
    S.metrics.shockPerfect++;
    S.quest.perfectShock++;
    if(S.quest.perfectShock >= 3) S.quest.donePerfectShock = true;
    spawnPop(x, y, 'SHOCK PERFECT');
    spawnSparkle(x, y);
    audio.playCue('shock-perfect');
    bossExitShock();
    refreshZoneUI();
  }

  function punishDecoy(x, y){
    S.score = Math.max(0, S.score - 14);
    S.combo = 0;
    S.miss++;
    S.totalActions++;
    S.metrics.decoyPunish++;
    S.quest.decoyAvoid = 0;
    flashScreen('bad');
    spawnPop(x, y, 'DECOY');
    audio.playCue('decoy-hit');
    const dz = S.zoneState[S.decoyZoneIdx];
    dz?.el?.classList.add('fakeTap');
    setTimeout(()=> dz?.el?.classList.remove('fakeTap'), 260);
    emitHha('hha:event', eventPayload('boss_decoy_punish', { decoyZoneIdx:S.decoyZoneIdx }));
  }

  function maybeStartBoss(targetClean){
    if(S.bossStarted) return false;
    const allReady = S.zoneState.every(z => Math.round(z.clean) >= targetClean);
    if(!allReady) return false;

    S.bossStarted = true;
    S.phase = 'boss';
    S.activeZoneIdx = 0;
    S.bossPhase = 1;
    setBossPhase(1);

    S.zoneState.forEach((z, i)=>{
      z.completed = Math.round(z.clean) >= targetClean;
      if(i === S.activeZoneIdx){
        z.dirt = 100;
        renderDirtForZone(i);
      }
    });

    setBossBanner('🦠 บอสหินปูนปรากฏแล้ว!');
    scheduleNextBossPattern(1000);
    emitHha('hha:event', eventPayload('boss_start', { bossHP: S.bossHP }));
    return true;
  }

  function startBossNow(targetClean){
    S.zoneState.forEach(z=>{
      z.clean = Math.max(z.clean, targetClean);
      z.completed = true;
    });
    maybeStartBoss(targetClean);
    scheduleNextBossPattern(600);
    refreshZoneUI();
  }

  return {
    bossPhaseCfg,
    scheduleNextBossPattern,
    clearDecoy,
    setBossPhase,
    maybeAdvanceBossPhase,
    runBossPatternController,
    punishLaser,
    rewardShockPerfect,
    punishDecoy,
    maybeStartBoss,
    startBossNow
  };
}