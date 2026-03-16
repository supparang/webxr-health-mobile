// /herohealth/vr-brush/brush.core.js
// HOTFIX v20260316c-BRUSH-MOBILE-UNFREEZE

import { createBrushConfig } from './brush.config.js?v=20260316c';
import { createBrushAudio } from './brush.audio.js?v=20260316c';
import {
  createZoneMastery,
  zoneDirectionText,
  humanZoneInstruction,
  calcZoneStars,
  zoneCoachFeedback,
  zoneSummaryChecks,
  zoneSummaryLine,
  zoneRealLifeTip,
  overallRealLifeTip
} from './brush.coach.js?v=20260316c';
import { createBrushFx } from './brush.fx.js?v=20260316c';
import { createBrushUI } from './brush.ui.js?v=20260316c';
import { createBrushBossController } from './brush.boss.js?v=20260316c';
import {
  LS_BRUSH_DRAFT,
  saveBrushDraft,
  loadBrushDraft,
  clearBrushDraft,
  isFreshDraft
} from './brush.storage.js?v=20260316c';
import { buildBrushSummary } from './brush.summary.js?v=20260316c';
import { createBrushZones } from './brush.zones.js?v=20260316c';
import { createBrushScoring } from './brush.scoring.js?v=20260316c';
import { createBrushInput } from './brush.input.js?v=20260316c';
import { createBrushTutorial } from './brush.tutorial.js?v=20260316c';

(function(){
  'use strict';

  const byId = (id)=>document.getElementById(id);

  const arenaCore = byId('arenaCore');
  const zoneLayer = byId('zoneLayer');
  const zoneList = byId('zoneList');
  const brushCursor = byId('brushCursor');
  const cleanFill = byId('cleanFill');
  const bossBanner = byId('bossBanner');
  const summaryOverlay = byId('summaryOverlay');
  const laserLine = byId('laserLine');
  const shockRing = byId('shockRing');
  const bossHpWrap = byId('bossHpWrap');
  const bossHpFill = byId('bossHpFill');
  const bossHpText = byId('bossHpText');
  const phaseToast = byId('phaseToast');
  const comboBadge = byId('comboBadge');
  const screenFlash = byId('screenFlash');
  const demoHand = byId('demoHand');
  const demoHint = byId('demoHint');
  const trailLayer = byId('trailLayer');
  const fxLayer = byId('fxLayer');
  const coachToast = byId('coachToast');
  const learnOverlay = byId('learnOverlay');

  const qs = (k, d='')=>{
    try{ return new URL(location.href).searchParams.get(k) ?? d; }
    catch{ return d; }
  };

  const num = (v,d)=>{
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
  };

  const clamp = (v,a,b)=> Math.max(a, Math.min(b, v));
  const nowISO = ()=> new Date().toISOString();

  const { CFG, DIFF, MODES, ZONES } = createBrushConfig(qs);

  // force mobile if open on phone and not explicitly cvr
  if ((/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)) && qs('view','pc') === 'pc') {
    CFG.view = 'mobile';
  }

  const S = {
    startedAt: performance.now(),
    mode: (qs('mode','learn') || 'learn').toLowerCase(),
    score: 0,
    combo: 0,
    maxCombo: 0,
    miss: 0,
    hits: 0,
    bossHits: 0,
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
    bossPattern: 'none',
    bossPhase: 0,
    lastTapAt: 0,
    uvUntil: 0,
    uvCdUntil: 0,
    polishCdUntil: 0,
    bossMode: 'idle',
    bossModeUntil: 0,
    bossNextPatternAt: 0,
    laserY: 50,
    shockGoodAt: 0,
    decoyZoneIdx: -1,
    isBrushing: false,
    brushLastX: 0,
    brushLastY: 0,
    brushLastT: 0,
    brushPathCombo: 0,
    lastBrushDx: 0,
    lastBrushDy: 0,
    learnOverlayShown: false,
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
      dirt: 30 + Math.round(Math.random()*25),
      clean: 0,
      completed: false,
      el: null,
      dirtEl: null
    }))
  };

  function currentModeCfg(){
    return MODES[S.mode] || MODES.learn;
  }

  function emitHha(type, detail){
    try{
      window.dispatchEvent(new CustomEvent(type, { detail }));
    }catch{}
  }

  function eventPayload(type, extra){
    return Object.assign({
      type,
      ts: nowISO(),
      gameId: CFG.gameId,
      pid: CFG.pid,
      run: CFG.run,
      diff: CFG.diff,
      time: CFG.time,
      seed: CFG.seed,
      studyId: CFG.studyId,
      href: location.href
    }, extra || {});
  }

  const audio = createBrushAudio({
    audioEnabled: qs('audio','1') !== '0',
    voiceEnabled: qs('voice','1') !== '0',
    speakRate: 1.02,
    speakPitch: 1.08,
    speakVolume: 0.9
  });

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

  function showCoachToast(text){
    if(!coachToast) return;
    coachToast.textContent = text;
    coachToast.style.display = 'block';
    coachToast.classList.remove('on');
    void coachToast.offsetWidth;
    coachToast.classList.add('on');
    setTimeout(()=>{
      if(coachToast) coachToast.style.display = 'none';
    }, 900);
  }

  zones = createBrushZones({
    zoneLayer,
    zoneList,
    arenaCore,
    CFG,
    ZONES,
    S,
    ui
  });

  const boss = createBrushBossController({
    S,
    CFG,
    setBossBanner: (text)=>{
      if(!bossBanner) return;
      bossBanner.textContent = text;
      bossBanner.classList.add('on');
    },
    showPhaseToast: fx.showPhaseToast,
    flashScreen: fx.flashScreen,
    spawnPop: fx.spawnPop,
    spawnSparkle: fx.spawnSparkle,
    setCoachText: ui.setCoachText,
    showCoachToast,
    refreshZoneUI: ()=> ui.refreshZoneUI(),
    renderDirtForZone: (idx)=> zones.renderDirtForZone(idx),
    emitHha,
    eventPayload,
    audio,
    laserLine,
    shockRing
  });

  const scoring = createBrushScoring({
    S,
    DIFF,
    currentModeCfg,
    fx
  });

  const tutorial = createBrushTutorial({
    S,
    demoHand,
    demoHint,
    learnOverlay,
    arenaCore,
    audio,
    zones,
    humanZoneInstruction,
    getActiveZone: ()=> S.zoneState[S.activeZoneIdx]
  });

  function emitStart(){
    emitHha('hha:start', eventPayload('start', {
      gameId: CFG.gameId,
      pid: CFG.pid,
      run: CFG.run,
      diff: CFG.diff,
      view: CFG.view,
      seed: CFG.seed,
      studyId: CFG.studyId,
      mode: S.mode
    }));
  }

  function emitProgress(){
    emitHha('hha:time', eventPayload('progress', {
      gameId: CFG.gameId,
      score: Math.round(S.score),
      combo: S.combo,
      miss: S.miss,
      clean: S.clean,
      bossHP: S.bossStarted ? Math.max(0, Math.ceil(S.bossHP)) : null,
      phase: S.phase,
      bossPhase: S.bossPhase,
      timeLeft: Math.ceil(S.timeLeft),
      mode: S.mode
    }));
  }

  const input = createBrushInput({
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
    stopDemoTutorial: ()=> tutorial.stopDemoTutorial(),
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
  }

  function setAudioPill(){
    ui.setText('pillAudio', audio.getState().audioEnabled ? 'on' : 'off');
  }

  function refreshModeButtons(){
    const learn = byId('btnModeLearn');
    const practice = byId('btnModePractice');
    const challenge = byId('btnModeChallenge');

    [learn, practice, challenge].forEach(el => el && el.classList.remove('modeActive'));
    if(S.mode === 'learn' && learn) learn.classList.add('modeActive');
    if(S.mode === 'practice' && practice) practice.classList.add('modeActive');
    if(S.mode === 'challenge' && challenge) challenge.classList.add('modeActive');

    ui.setText('pillMode', currentModeCfg().label);
  }

  function setMode(mode){
    S.mode = MODES[mode] ? mode : 'learn';
    const u = new URL(location.href);
    u.searchParams.set('mode', S.mode);
    if (CFG.view === 'mobile') u.searchParams.set('view', 'mobile');
    if(S.mode === 'learn') u.searchParams.set('showLearn', '1');
    else u.searchParams.delete('showLearn');
    u.searchParams.set('seed', String(Date.now()));
    location.href = u.toString();
  }

  function saveDraft(){
    if(S.finished) return;
    saveBrushDraft(LS_BRUSH_DRAFT, {
      gameId: CFG.gameId,
      pid: CFG.pid,
      run: CFG.run,
      diff: CFG.diff,
      view: CFG.view,
      seed: CFG.seed,
      studyId: CFG.studyId,
      timeLeft: S.timeLeft,
      score: S.score,
      combo: S.combo,
      maxCombo: S.maxCombo,
      miss: S.miss,
      hits: S.hits,
      bossHits: S.bossHits,
      totalActions: S.totalActions,
      clean: S.clean,
      activeZoneIdx: S.activeZoneIdx,
      phase: S.phase,
      bossStarted: S.bossStarted,
      bossCompleted: S.bossCompleted,
      bossPhase: S.bossPhase,
      bossHP: S.bossHP,
      bossMaxHP: S.bossMaxHP,
      mode: S.mode,
      zoneState: S.zoneState.map(z => ({
        id:z.id, label:z.label, dirt:z.dirt, clean:z.clean, completed:z.completed
      })),
      zoneMastery: JSON.parse(JSON.stringify(S.zoneMastery)),
      quest: JSON.parse(JSON.stringify(S.quest)),
      metrics: JSON.parse(JSON.stringify(S.metrics)),
      savedAt: nowISO(),
      href: location.href
    });
  }

  function clearDraft(){
    clearBrushDraft(LS_BRUSH_DRAFT);
  }

  function tryRestoreDraft(){
    const draft = loadBrushDraft(LS_BRUSH_DRAFT);
    if(!draft) return;
    if((draft.gameId||'') !== CFG.gameId) return;
    if((draft.pid||'') !== (CFG.pid||'')) return;
    if((draft.run||'') !== (CFG.run||'')) return;
    if(!isFreshDraft(draft.savedAt, 1000 * 60 * 20)) return;

    const ok = confirm('พบเกม Brush ที่ค้างไว้ ต้องการเล่นต่อหรือไม่?');
    if(!ok){
      clearDraft();
      return;
    }

    S.timeLeft = num(draft.timeLeft, S.timeLeft);
    S.score = num(draft.score, S.score);
    S.combo = num(draft.combo, S.combo);
    S.maxCombo = num(draft.maxCombo, S.maxCombo);
    S.miss = num(draft.miss, S.miss);
    S.hits = num(draft.hits, S.hits);
    S.bossHits = num(draft.bossHits, S.bossHits);
    S.totalActions = num(draft.totalActions, S.totalActions);
    S.clean = num(draft.clean, S.clean);
    S.activeZoneIdx = num(draft.activeZoneIdx, S.activeZoneIdx);
    S.phase = draft.phase || S.phase;
    S.bossStarted = !!draft.bossStarted;
    S.bossCompleted = !!draft.bossCompleted;
    S.bossPhase = num(draft.bossPhase, S.bossPhase);
    S.bossHP = num(draft.bossHP, S.bossHP);
    S.bossMaxHP = num(draft.bossMaxHP, S.bossMaxHP);
    S.mode = draft.mode || S.mode;

    if(Array.isArray(draft.zoneState) && draft.zoneState.length === S.zoneState.length){
      draft.zoneState.forEach((z, i)=>{
        S.zoneState[i].dirt = num(z.dirt, S.zoneState[i].dirt);
        S.zoneState[i].clean = num(z.clean, S.zoneState[i].clean);
        S.zoneState[i].completed = !!z.completed;
      });
    }

    if(Array.isArray(draft.zoneMastery) && draft.zoneMastery.length === S.zoneMastery.length){
      draft.zoneMastery.forEach((m, i)=>{
        Object.assign(S.zoneMastery[i], m);
      });
    }

    if(draft.quest) S.quest = Object.assign(S.quest, draft.quest);
    if(draft.metrics) S.metrics = Object.assign(S.metrics, draft.metrics);

    zones.refreshAllDirt();
    if(arenaCore) fx.spawnPop(arenaCore.clientWidth * 0.5, 64, 'RESTORED');
    fx.showPhaseToast('CONTINUE');
  }

  function summaryQuestDone(kind){
    if(kind === 'shock') return !!S.quest.donePerfectShock;
    if(kind === 'laser') return !!S.quest.doneLaserSurvive;
    if(kind === 'decoy') return !!S.quest.doneDecoyAvoid;
    return false;
  }

  function rankFrom(score, clean, bossDone){
    const qDone = [
      S.quest.donePerfectShock,
      S.quest.doneLaserSurvive,
      S.quest.doneDecoyAvoid
    ].filter(Boolean).length;

    if(score >= 1050 && clean >= 94 && bossDone && qDone >= 3) return 'S';
    if(score >= 820 && clean >= 88 && bossDone && qDone >= 2) return 'A';
    if(score >= 620 && clean >= 80) return 'B';
    if(score >= 420 && clean >= 70) return 'C';
    return 'D';
  }

  function finishGame(endReason){
    if(S.finished) return;
    S.finished = true;
    clearDraft();
    boss.clearDecoy?.();
    laserLine?.classList.remove('on');
    shockRing?.classList.remove('on');
    bossBanner?.classList.remove('on');
    tutorial.stopDemoTutorial();

    const built = buildBrushSummary({
      S,
      CFG,
      currentModeCfg,
      totalCleanPct: ()=> zones.totalCleanPct(),
      overallRealLifeTip,
      zoneSummaryChecks,
      zoneSummaryLine,
      zoneRealLifeTip,
      rankFrom,
      summaryQuestDone,
      nowISO,
      href: location.href
    });

    const { summary, rank, qDone } = built;
    summary.endReason = endReason || (S.bossCompleted ? 'complete' : 'timeup');

    try{ window.HHA_BACKHUB?.setSummary?.(summary); }catch{}

    ui.setText('summaryRank', rank);
    ui.setText('sumScore', String(summary.scoreFinal));
    ui.setText('sumAcc', summary.accuracyPct + '%');
    ui.setText('sumClean', summary.cleanPct + '%');
    ui.setText('sumBoss', S.mode === 'learn' ? 'ไม่มีบอส' : (summary.bossCompleted ? 'ชนะแล้ว' : 'ยังไม่ชนะ'));
    ui.setText('sumCombo', String(summary.maxCombo || 0));
    ui.setText('sumQuest', `${qDone}/3`);

    if(summaryOverlay) summaryOverlay.style.display = 'grid';
  }

  function restartGame(){
    clearDraft();
    tutorial.stopDemoTutorial();
    const u = new URL(location.href);
    u.searchParams.set('seed', String(Date.now()));
    location.href = u.toString();
  }

  function useUV(){
    if(!currentModeCfg().uv) return;
    const now = performance.now();
    if(now < S.uvCdUntil || S.finished) return;
    S.uvUntil = now + 3200;
    S.uvCdUntil = now + CFG.uvCdMs;
    if(arenaCore) fx.spawnPop(arenaCore.clientWidth * .5, 60, 'UV ON');
    ui.refreshZoneUI();
  }

  function usePolish(){
    if(!currentModeCfg().polish) return;
    const now = performance.now();
    if(now < S.polishCdUntil || S.finished) return;
    S.polishCdUntil = now + CFG.polishCdMs;

    S.zoneState.forEach((z, idx)=>{
      z.clean = clamp(z.clean + 6, 0, 100);
      z.dirt = clamp(z.dirt - 7, 0, 100);
      if(zones.zoneCleanPct(z) >= currentModeCfg().cleanTarget) z.completed = true;
      zones.renderDirtForZone(idx);
    });

    S.score += 30;
    if(arenaCore) fx.spawnPop(arenaCore.clientWidth * .5, 86, 'POLISH!');
    boss.maybeStartBoss(currentModeCfg().cleanTarget);
    ui.refreshZoneUI();
  }

  function bindButtons(){
    byId('btnUV')?.addEventListener('click', ()=> useUV());
    byId('btnPolish')?.addEventListener('click', ()=> usePolish());
    byId('btnRestart')?.addEventListener('click', restartGame);
    byId('btnStartBoss')?.addEventListener('click', ()=> {
      if(!currentModeCfg().boss) return;
      boss.startBossNow(currentModeCfg().cleanTarget);
    });
    byId('btnFinish')?.addEventListener('click', ()=> finishGame(S.bossCompleted ? 'complete' : 'quit'));
    byId('btnCloseSummary')?.addEventListener('click', ()=> { if(summaryOverlay) summaryOverlay.style.display = 'none'; });
    byId('btnSummaryRestart')?.addEventListener('click', restartGame);

    byId('btnBackHub')?.addEventListener('click', ()=>{
      try{ window.HHA_BACKHUB?.goHub?.(); }
      catch{
        const hub = qs('hub','');
        if(hub) location.href = hub;
      }
    });

    byId('btnDockRestart')?.addEventListener('click', restartGame);
    byId('btnDockSummary')?.addEventListener('click', ()=> finishGame(S.bossCompleted ? 'complete' : 'quit'));
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

    byId('btnLearnWatch')?.addEventListener('click', ()=>{
      tutorial.closeLearnOverlay();
      ui.setCoachText('ดูนิ้วตัวอย่างก่อน แล้วค่อยลองถูตามนะ', 'mid');
      audio.playCue('learn-watch');
      tutorial.stopDemoTutorial();
      setTimeout(()=> tutorial.startDemoTutorial(), 120);
    });

    byId('btnLearnSkip')?.addEventListener('click', ()=> tutorial.closeLearnOverlay());

    byId('btnLearnStart')?.addEventListener('click', ()=>{
      tutorial.closeLearnOverlay();
      ui.setNowDoText('เริ่มจากถูโซนที่มีกรอบสีฟ้า');
      audio.playCue('learn-start');
    });

    byId('btnShowLearnHelp')?.addEventListener('click', ()=>{
      if(S.mode === 'learn'){
        tutorial.openLearnOverlay();
      } else {
        ui.setCoachText('ดูกรอบสีฟ้าและลองถูตามทิศที่บอกนะ', 'mid');
        tutorial.stopDemoTutorial();
        setTimeout(()=> tutorial.startDemoTutorial(), 120);
      }
    });

    byId('btnToggleAudio')?.addEventListener('click', ()=>{
      const on = audio.toggleAudio();
      setAudioPill();

      const u = new URL(location.href);
      u.searchParams.set('audio', on ? '1' : '0');
      history.replaceState({}, '', u.toString());
    });
  }

  function tick(){
    if(S.finished) return;

    if(S.mode === 'learn' && tutorial.isLearnOverlayOpen()){
      ui.refreshZoneUI();
      return;
    }

    if(S.mode !== 'learn'){
      S.timeLeft = Math.max(0, S.timeLeft - 0.1);
    }

    if(!S.bossStarted){
      S.zoneState.forEach((z, idx)=>{
        if(idx !== S.activeZoneIdx){
          z.dirt = clamp(z.dirt + DIFF.dirtTick * 0.2, 0, 100);
        }
      });
    } else if (!S.bossCompleted){
      const active = S.zoneState[S.activeZoneIdx];
      if(active){
        active.dirt = clamp(active.dirt + .45, 0, 100);
        zones.renderDirtForZone(S.activeZoneIdx);
      }
    }

    boss.runBossPatternController();
    ui.refreshZoneUI();

    if(S.mode !== 'learn' && Math.round(S.timeLeft) % 5 === 0) emitProgress();
    if(S.mode !== 'learn' && Math.floor(S.timeLeft * 10) % 20 === 0) saveDraft();

    if(S.mode !== 'learn' && S.timeLeft <= 0){
      finishGame(S.bossCompleted ? 'complete' : 'timeup');
    }
  }

  function boot(){
    document.documentElement.classList.toggle('view-cvr', CFG.view === 'cvr');
    document.body.classList.toggle('view-cvr', CFG.view === 'cvr');

    if(S.mode === 'learn'){
      S.timeLeft = 9999;
    }

    setTopPills();
    setAudioPill();
    refreshModeButtons();

    zones.buildZones((idx, ev)=> {
      input.onZonePointerDown(idx, ev);
    });

    tryRestoreDraft();
    bindButtons();
    input.bindInput();
    ui.refreshZoneUI();
    emitStart();

    if(S.mode === 'learn'){
      ui.setNowDoText('เริ่มจากดูกรอบสีฟ้าก่อน');
      const shouldShowLearn = qs('showLearn','1') !== '0';
      if(shouldShowLearn){
        tutorial.openLearnOverlay();
      } else {
        setTimeout(()=> tutorial.startDemoTutorial(), 500);
      }
    } else {
      ui.setNowDoText('เริ่มจากถูโซนที่มีกรอบสีฟ้า');
      setTimeout(()=> tutorial.startDemoTutorial(), 500);
    }

    setInterval(tick, 100);
  }

  try{
    boot();
  }catch(err){
    console.error('Brush boot failed:', err);
    alert('Brush VR โหลดไม่สมบูรณ์: ' + (err?.message || err));
  }
})();