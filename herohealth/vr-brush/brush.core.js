// /herohealth/vr-brush/brush.core.js
// ULTRA-SAFE MINIMAL BOOT v20260316d-BRUSH-CORE-MIN

import { createBrushConfig } from './brush.config.js?v=20260316d';
import {
  createZoneMastery,
  zoneDirectionText,
  humanZoneInstruction,
  calcZoneStars
} from './brush.coach.js?v=20260316d';
import { createBrushFx } from './brush.fx.js?v=20260316d';
import { createBrushUI } from './brush.ui.js?v=20260316d';
import { createBrushZones } from './brush.zones.js?v=20260316d';
import { createBrushScoring } from './brush.scoring.js?v=20260316d';
import { createBrushInput } from './brush.input.js?v=20260316d';

(function(){
  'use strict';

  const byId = (id)=>document.getElementById(id);

  const arenaCore = byId('arenaCore');
  const zoneLayer = byId('zoneLayer');
  const zoneList = byId('zoneList');
  const brushCursor = byId('brushCursor');
  const cleanFill = byId('cleanFill');
  const bossHpWrap = byId('bossHpWrap');
  const bossHpFill = byId('bossHpFill');
  const bossHpText = byId('bossHpText');
  const phaseToast = byId('phaseToast');
  const comboBadge = byId('comboBadge');
  const screenFlash = byId('screenFlash');
  const trailLayer = byId('trailLayer');
  const fxLayer = byId('fxLayer');
  const summaryOverlay = byId('summaryOverlay');

  const qs = (k, d='')=>{
    try{ return new URL(location.href).searchParams.get(k) ?? d; }
    catch{ return d; }
  };

  const clamp = (v,a,b)=> Math.max(a, Math.min(b, v));
  const num = (v,d)=>{
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
  };

  const { CFG, DIFF, MODES, ZONES } = createBrushConfig(qs);

  if ((/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)) && qs('view','pc') === 'pc') {
    CFG.view = 'mobile';
  }

  const S = {
    mode: (qs('mode','learn') || 'learn').toLowerCase(),
    score: 0,
    combo: 0,
    maxCombo: 0,
    miss: 0,
    hits: 0,
    totalActions: 0,
    clean: 0,
    timeLeft: CFG.time,
    activeZoneIdx: 0,
    phase: 'learn',
    bossHP: CFG.bossHP,
    bossMaxHP: CFG.bossHP,
    finished: false,
    bossStarted: false,
    bossCompleted: false,
    bossMode: 'idle',
    bossPhase: 0,
    uvUntil: 0,
    uvCdUntil: 0,
    polishCdUntil: 0,
    lastTapAt: 0,
    isBrushing: false,
    brushLastX: 0,
    brushLastY: 0,
    brushLastT: 0,
    brushPathCombo: 0,
    lastBrushDx: 0,
    lastBrushDy: 0,
    coachMsg: '',
    coachUntil: 0,
    coachHistory: [],
    zoneMastery: createZoneMastery(),
    quest: {
      perfectShock: 0,
      decoyAvoid: 0,
      laserSurvive: 0,
      donePerfectShock: false,
      doneDecoyAvoid: false,
      doneLaserSurvive: false
    },
    metrics: {
      laserPunish: 0,
      shockPerfect: 0,
      decoyPunish: 0
    },
    zoneState: ZONES.map(z => ({
      id: z.id,
      label: z.label,
      dirt: 36,
      clean: 0,
      completed: false,
      el: null,
      dirtEl: null
    }))
  };

  function currentModeCfg(){
    return MODES[S.mode] || MODES.learn;
  }

  const fx = createBrushFx({
    fxLayer,
    trailLayer,
    screenFlash,
    comboBadge,
    phaseToast
  });

  let zones;

  const ui = createBrushUI({
    byId,
    arenaCore,
    brushCursor,
    cleanFill,
    bossHpWrap,
    bossHpFill,
    bossHpText,
    hintBadgeEl: byId('hintBadge'),
    nowDoTextEl: byId('nowDoText'),
    coachTextEl: byId('coachText'),
    coachBoxEl: byId('coachBox'),
    nowDoBoxEl: byId('nowDoBox'),
    ZONES,
    S,
    currentModeCfg,
    totalCleanPct: ()=> zones ? zones.totalCleanPct() : 0,
    zoneCleanPct: (zs)=> zones ? zones.zoneCleanPct(zs) : 0,
    calcZoneStars,
    zoneDirectionText,
    humanZoneInstruction
  });

  zones = createBrushZones({
    zoneLayer,
    zoneList,
    arenaCore,
    CFG,
    ZONES,
    S,
    ui
  });

  const scoring = createBrushScoring({
    S,
    DIFF,
    currentModeCfg,
    fx
  });

  const bossStub = {
    maybeStartBoss(){ return false; },
    startBossNow(){},
    punishLaser(){},
    rewardShockPerfect(){},
    punishDecoy(){},
    maybeAdvanceBossPhase(){},
    runBossPatternController(){},
    clearDecoy(){}
  };

  const input = createBrushInput({
    arenaCore,
    S,
    ui,
    fx,
    zones,
    scoring,
    boss: bossStub,
    currentModeCfg,
    zoneDirectionText,
    zoneRealLifeTip: ()=> 'แปรงเบา ๆ ให้ทั่ว',
    zoneCoachFeedback: ()=> ({ tone:'good', text:'ดีมาก ถูต่อในกรอบสีฟ้าได้เลย' }),
    calcZoneStars,
    audio: {
      ensureAudio(){ return false; },
      playCue(){ return false; }
    },
    emitProgress: ()=>{},
    stopDemoTutorial: ()=>{},
    DIFF,
    humanZoneInstruction
  });

  function setTopPills(){
    ui.setText('pillGameId', CFG.gameId);
    ui.setText('pillRun', CFG.run || 'play');
    ui.setText('pillDiff', CFG.diff || 'normal');
    ui.setText('pillView', CFG.view || 'mobile');
    ui.setText('statPid', CFG.pid || '—');
    ui.setText('statSeed', CFG.seed || '—');
    ui.setText('statStudy', CFG.studyId || '—');
    ui.setText('pillAudio', 'off');
  }

  function refreshModeButtons(){
    const learn = byId('btnModeLearn');
    const practice = byId('btnModePractice');
    const challenge = byId('btnModeChallenge');

    [learn, practice, challenge].forEach(el => el && el.classList.remove('modeActive'));
    if(S.mode === 'learn' && learn) learn.classList.add('modeActive');
    if(S.mode === 'practice' && practice) practice.classList.add('modeActive');
    if(S.mode === 'challenge' && challenge) challenge.classList.add('modeActive');
  }

  function setMode(mode){
    S.mode = MODES[mode] ? mode : 'learn';
    const u = new URL(location.href);
    u.searchParams.set('mode', S.mode);
    u.searchParams.set('view', CFG.view || 'mobile');
    u.searchParams.set('seed', String(Date.now()));
    location.href = u.toString();
  }

  function finishGame(){
    if(S.finished) return;
    S.finished = true;

    ui.setText('summaryRank', S.clean >= 85 ? 'A' : (S.clean >= 70 ? 'B' : 'C'));
    ui.setText('sumScore', String(Math.round(S.score || 0)));
    ui.setText('sumAcc', `${S.totalActions > 0 ? Math.round((S.hits / S.totalActions) * 100) : 0}%`);
    ui.setText('sumClean', `${S.clean}%`);
    ui.setText('sumBoss', 'ปิดไว้ชั่วคราว');
    ui.setText('sumCombo', String(S.maxCombo || 0));
    ui.setText('sumQuest', 'minimal');

    ui.setText('resultHeroTitle', 'ทดสอบระบบแปรงฟันสำเร็จ');
    ui.setText('resultHeroSub', `Clean ${S.clean}% • Score ${Math.round(S.score || 0)}`);
    ui.setText('resultHeroRank', S.clean >= 85 ? 'A' : (S.clean >= 70 ? 'B' : 'C'));

    if(summaryOverlay) summaryOverlay.style.display = 'grid';
  }

  function restartGame(){
    const u = new URL(location.href);
    u.searchParams.set('seed', String(Date.now()));
    location.href = u.toString();
  }

  function useUV(){
    const now = performance.now();
    if(now < S.uvCdUntil || S.finished) return;
    S.uvUntil = now + 3200;
    S.uvCdUntil = now + CFG.uvCdMs;
    if(arenaCore) fx.spawnPop(arenaCore.clientWidth * .5, 60, 'UV ON');
    ui.refreshZoneUI();
  }

  function usePolish(){
    const now = performance.now();
    if(now < S.polishCdUntil || S.finished) return;
    S.polishCdUntil = now + CFG.polishCdMs;

    S.zoneState.forEach((z, idx)=>{
      z.clean = clamp(z.clean + 6, 0, 100);
      z.dirt = clamp(z.dirt - 7, 0, 100);
      if(zones.zoneCleanPct(z) >= currentModeCfg().cleanTarget) z.completed = true;
      zones.renderDirtForZone(idx);
    });

    S.score += 20;
    if(arenaCore) fx.spawnPop(arenaCore.clientWidth * .5, 86, 'POLISH!');
    ui.refreshZoneUI();
  }

  function bindButtons(){
    byId('btnUV')?.addEventListener('click', useUV);
    byId('btnPolish')?.addEventListener('click', usePolish);
    byId('btnRestart')?.addEventListener('click', restartGame);
    byId('btnFinish')?.addEventListener('click', finishGame);

    byId('btnCloseSummary')?.addEventListener('click', ()=>{
      if(summaryOverlay) summaryOverlay.style.display = 'none';
    });
    byId('btnSummaryRestart')?.addEventListener('click', restartGame);

    byId('btnBackHub')?.addEventListener('click', ()=>{
      try{ window.HHA_BACKHUB?.goHub?.(); }
      catch{
        const hub = qs('hub','');
        if(hub) location.href = hub;
      }
    });

    byId('btnDockRestart')?.addEventListener('click', restartGame);
    byId('btnDockSummary')?.addEventListener('click', finishGame);
    byId('btnDockHub')?.addEventListener('click', ()=>{
      try{ window.HHA_BACKHUB?.goHub?.(); }
      catch{
        const hub = qs('hub','');
        if(hub) location.href = hub;
      }
    });

    byId('btnModeLearn')?.addEventListener('click', ()=> setMode('learn'));
    byId('btnModePractice')?.addEventListener('click', ()=> setMode('practice'));
    byId('btnModeChallenge')?.addEventListener('click', ()=> setMode('challenge'));

    byId('btnShowLearnHelp')?.addEventListener('click', ()=>{
      ui.setCoachText('ให้ดูกรอบสีฟ้า แล้วลากถูในกรอบนั้น', 'mid');
      ui.setNowDoText(`ให้${humanZoneInstruction(S.zoneState[S.activeZoneIdx]?.label || 'โซนนี้')} ในกรอบสีฟ้า`);
    });

    byId('btnToggleAudio')?.addEventListener('click', ()=>{
      ui.setCoachText('โหมด minimal ปิดเสียงไว้ชั่วคราว', 'mid');
    });

    const bossBtn = byId('btnStartBoss');
    if(bossBtn){
      bossBtn.disabled = true;
      bossBtn.classList.add('disabled');
    }
  }

  function tick(){
    if(S.finished) return;

    if(S.mode !== 'learn'){
      S.timeLeft = Math.max(0, S.timeLeft - 0.1);
      if(S.timeLeft <= 0){
        finishGame();
        return;
      }
    }

    S.zoneState.forEach((z, idx)=>{
      if(idx !== S.activeZoneIdx){
        z.dirt = clamp(z.dirt + DIFF.dirtTick * 0.15, 0, 100);
      }
    });

    ui.refreshZoneUI();
  }

  function boot(){
    document.documentElement.classList.toggle('view-cvr', CFG.view === 'cvr');
    document.body.classList.toggle('view-cvr', CFG.view === 'cvr');

    if(S.mode === 'learn') S.timeLeft = 9999;

    setTopPills();
    refreshModeButtons();

    zones.buildZones((idx, ev)=>{
      input.onZonePointerDown(idx, ev);
    });

    bindButtons();
    input.bindInput();

    ui.setCoachText('เริ่มจากลากถูในกรอบสีฟ้ากลางรูปฟัน', 'mid');
    ui.setNowDoText(`ให้${humanZoneInstruction(S.zoneState[S.activeZoneIdx]?.label || 'โซนนี้')} ในกรอบสีฟ้า`);
    ui.refreshZoneUI();

    setInterval(tick, 100);
  }

  try{
    boot();
  }catch(err){
    console.error('Brush minimal boot failed:', err);
    alert('Brush VR minimal boot failed: ' + (err?.message || err));
  }
})();