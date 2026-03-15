// /herohealth/vr-brush/brush.core.js
// FULL PATCH v20260315a-BRUSH-MODULAR-PRODUCTION

import { createBrushConfig } from './brush.config.js?v=20260315a';
import { createBrushAudio } from './brush.audio.js?v=20260315a';
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
} from './brush.coach.js?v=20260315a';
import { createBrushFx } from './brush.fx.js?v=20260315a';
import { createBrushUI } from './brush.ui.js?v=20260315a';
import { createBrushBossController } from './brush.boss.js?v=20260315a';
import {
  LS_BRUSH_DRAFT,
  saveBrushDraft,
  loadBrushDraft,
  clearBrushDraft,
  isFreshDraft
} from './brush.storage.js?v=20260315a';
import { buildBrushSummary } from './brush.summary.js?v=20260315a';
import { createBrushZones } from './brush.zones.js?v=20260315a';
import { createBrushScoring } from './brush.scoring.js?v=20260315a';
import { createBrushInput } from './brush.input.js?v=20260315a';

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
  const mouthWrap = byId('mouthWrap');

  const qs = (k, d='')=>{
    try{ return new URL(location.href).searchParams.get(k) ?? d; }
    catch{ return d; }
  };

  const num = (v,d)=>{
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
  };

  const nowISO = ()=> new Date().toISOString();

  const { CFG, DIFF, MODES, ZONES } = createBrushConfig(qs);

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

  const fx = createBrushFx({
    fxLayer,
    trailLayer,
    screenFlash,
    comboBadge,
    phaseToast
  });

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
    totalCleanPct: ()=> zones.totalCleanPct(),
    zoneCleanPct: (zs)=> zones.zoneCleanPct(zs),
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

  const zones = createBrushZones({
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
    refreshZoneUI: ui.refreshZoneUI,
    renderDirtForZone: zones.renderDirtForZone,
    emitHha,
    eventPayload,
    audio,
    laserLine,
    shockRing
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
    stopDemoTutorial,
    DIFF,
    humanZoneInstruction
  });

  function setTopPills(){
    ui.setText('pillGameId', CFG.gameId);
    ui.setText('pillRun', CFG.run || 'play');
    ui.setText('pillDiff', CFG.diff || 'normal');
    ui.setText('pillView', CFG.view || 'pc');
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
    if(S.mode === 'learn') u.searchParams.set('showLearn', '1');
    else u.searchParams.delete('showLearn');
    location.href = u.toString();
  }

  function stopDemoTutorial(){
    if(demoHand) demoHand.classList.remove('on');
    if(demoHint) demoHint.classList.remove('on');
    if(startDemoTutorial._raf){
      cancelAnimationFrame(startDemoTutorial._raf);
      startDemoTutorial._raf = 0;
    }
  }

  function startDemoTutorial(){
    const active = S.zoneState[S.activeZoneIdx];
    if(!active?.el || !demoHand || !demoHint || S.bossStarted || S.finished) return;

    const rr = zones.zoneRectRelative(active.el);
    if(!rr) return;

    demoHand.classList.add('on');
    demoHint.classList.add('on');
    audio.playCue('demo-start');

    const t0 = performance.now();

    const loop = (ts)=>{
      if(S.finished || S.bossStarted){
        stopDemoTutorial();
        return;
      }

      const z = zones.zoneRectRelative(active.el);
      if(!z){
        stopDemoTutorial();
        return;
      }

      const t = (ts - t0) / 1000;
      const swing = (Math.sin(t * Math.PI * 1.6) + 1) / 2;
      const bob = Math.sin(t * Math.PI * 3.2) * 4;

      const x = z.left + z.width * (0.18 + swing * 0.64);
      const y = z.top + z.height * 0.55 + bob;

      demoHand.style.left = x + 'px';
      demoHand.style.top = y + 'px';

      if(t >= 2.6){
        stopDemoTutorial();
        return;
      }

      startDemoTutorial._raf = requestAnimationFrame(loop);
    };

    startDemoTutorial._raf = requestAnimationFrame(loop);
  }

  function updateLearnOverlayText(){
    const el = byId('learnOverlayNow');
    const active = S.zoneState[S.activeZoneIdx];
    if(!el || !active) return;
    el.textContent = `${humanZoneInstruction(active.label)} ในกรอบสีฟ้า`;
  }

  function openLearnOverlay(){
    if(!learnOverlay) return;
    updateLearnOverlayText();
    learnOverlay.style.display = 'grid';
    S.learnOverlayShown = true;
    audio.playCue('learn-open');
  }

  function closeLearnOverlay(){
    if(!learnOverlay) return;
    learnOverlay.style.display = 'none';
  }

  function saveDraft(){
    if(S.finished) return;
    const draft = {
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
    };
    saveBrushDraft(LS_BRUSH_DRAFT, draft);
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

    emitHha('hha:event', eventPayload('brush_restore', {
      timeLeft: S.timeLeft,
      bossPhase: S.bossPhase,
      score: Math.round(S.score)
    }));
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
    stopDemoTutorial();

    const built = buildBrushSummary({
      S,
      CFG,
      currentModeCfg,
      totalCleanPct: zones.totalCleanPct,
      overallRealLifeTip,
      zoneSummaryChecks,
      zoneSummaryLine,
      zoneRealLifeTip,
      rankFrom,
      summaryQuestDone,
      nowISO,
      href: location.href
    });

    const { summary, rank, qDone, totalStars } = built;
    summary.endReason = endReason || (S.bossCompleted ? 'complete' : 'timeup');

    try{ window.HHA_BACKHUB?.setSummary?.(summary); }catch{}

    emitHha('hha:end', eventPayload('end', summary));
    emitHha('hha:event', eventPayload('brush_summary', {
      scoreFinal: summary.scoreFinal,
      accuracyPct: summary.accuracyPct,
      cleanPct: summary.cleanPct,
      bossCompleted: summary.bossCompleted,
      bossPhase: summary.bossPhase,
      maxCombo: summary.maxCombo,
      miss: summary.miss,
      laserPunish: summary.laserPunish,
      shockPerfectCount: summary.shockPerfectCount,
      decoyPunish: summary.decoyPunish,
      questDonePerfectShock: summary.questDonePerfectShock,
      questDoneLaserSurvive: summary.questDoneLaserSurvive,
      questDoneDecoyAvoid: summary.questDoneDecoyAvoid,
      totalStars
    }));

    ui.setText('summaryRank', rank);
    ui.setText('sumScore', String(summary.scoreFinal));
    ui.setText('sumAcc', summary.accuracyPct + '%');
    ui.setText('sumClean', summary.cleanPct + '%');
    ui.setText('sumBoss', S.mode === 'learn' ? 'ไม่มีบอส' : (summary.bossCompleted ? 'ชนะแล้ว' : 'ยังไม่ชนะ'));
    ui.setText('sumCombo', String(summary.maxCombo || 0));
    ui.setText('sumQuest', `${qDone}/3 ผ่าน`);
    ui.setText('summarySub', `${summary.gameTitle} • mode=${summary.mode} • end=${summary.endReason}`);

    ui.setText(
      'resultHeroTitle',
      S.mode === 'learn'
        ? 'ฝึกแปรงฟันเสร็จแล้ว!'
        : (S.bossCompleted ? 'คุณกำจัดบอสหินปูนได้แล้ว!' : 'สรุปการแปรงฟันรอบนี้')
    );
    ui.setText('resultHeroSub', `ฟันสะอาด ${summary.cleanPct}% • ความแม่น ${summary.accuracyPct}% • ดาวรวม ${totalStars}/18`);
    ui.setText('resultHeroRank', rank);

    const rankEl = byId('resultHeroRank');
    if(rankEl){
      rankEl.style.color =
        rank === 'S' ? '#22c55e' :
        rank === 'A' ? '#22d3ee' :
        rank === 'B' ? '#f59e0b' :
        rank === 'C' ? '#fb7185' : '#94a3b8';
    }

    const qShock = byId('sumQShock');
    const qLaser = byId('sumQLaser');
    const qDecoy = byId('sumQDecoy');

    [qShock, qLaser, qDecoy].forEach(el => el && el.classList.remove('ok'));

    if(qShock){
      qShock.textContent = `Shock ${summary.questDonePerfectShock ? '✅' : '⬜'}`;
      qShock.classList.toggle('ok', !!summary.questDonePerfectShock);
    }
    if(qLaser){
      qLaser.textContent = `Laser ${summary.questDoneLaserSurvive ? '✅' : '⬜'}`;
      qLaser.classList.toggle('ok', !!summary.questDoneLaserSurvive);
    }
    if(qDecoy){
      qDecoy.textContent = `Decoy ${summary.questDoneDecoyAvoid ? '✅' : '⬜'}`;
      qDecoy.classList.toggle('ok', !!summary.questDoneDecoyAvoid);
    }

    const summaryCoachWrap = byId('summaryCoachWrap');
    if(summaryCoachWrap){
      const lastCoach = S.coachHistory.slice(-3);
      summaryCoachWrap.innerHTML = lastCoach.length
        ? `
          <div style="font-size:13px; font-weight:950;">Coach Notes</div>
          ${lastCoach.map(c => `
            <div style="border:1px solid rgba(148,163,184,.16); background:rgba(2,6,23,.24); border-radius:14px; padding:10px 12px; color:var(--muted); font-size:12px; line-height:1.5;">
              ${c.text}
            </div>
          `).join('')}
        `
        : '';
    }

    const summaryZoneWrap = byId('summaryZoneWrap');
    if(summaryZoneWrap){
      summaryZoneWrap.innerHTML = `
        <div style="font-size:13px; font-weight:950;">สรุปรายโซน</div>
        ${summary.zoneSummary.map(z => `
          <div style="border:1px solid rgba(148,163,184,.16); background:rgba(2,6,23,.24); border-radius:14px; padding:10px 12px;">
            <div style="display:flex; justify-content:space-between; gap:8px; align-items:center; flex-wrap:wrap;">
              <div style="font-size:13px; font-weight:950;">${z.label}</div>
              <div style="font-size:13px; font-weight:950; color:${z.stars >= 2 ? '#fbbf24' : '#94a3b8'};">
                ${'★'.repeat(z.stars)}${'☆'.repeat(3-z.stars)}
              </div>
            </div>

            <div style="margin-top:6px; color:var(--muted); font-size:12px; line-height:1.5;">
              ${z.line}
            </div>
            <div style="margin-top:6px; color:rgba(229,231,235,.92); font-size:12px; line-height:1.5; font-weight:900;">
              💡 ${z.tip}
            </div>

            <div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap;">
              <span class="summaryQuestBadge ${z.clean ? 'ok' : ''}">สะอาด ${z.clean ? '✅' : '⬜'} (${z.cleanPct}%)</span>
              <span class="summaryQuestBadge ${z.direction ? 'ok' : ''}">ทิศทาง ${z.direction ? '✅' : '⬜'} (${z.dirRate}%)</span>
              <span class="summaryQuestBadge ${z.control ? 'ok' : ''}">คุมดี ${z.control ? '✅' : '⬜'} (พลาด ${z.localMiss})</span>
            </div>
          </div>
        `).join('')}

        <div style="border:1px dashed rgba(148,163,184,.18); background:rgba(2,6,23,.18); border-radius:14px; padding:10px 12px; color:var(--muted); font-size:12px; line-height:1.55;">
          ข้อสังเกต: โซนที่ได้ดาวน้อยมักต้องฝึกเรื่องความทั่วถึงของการถู ทิศทางการถู หรือการลดการกดพลาด
        </div>
      `;
    }

    const summaryTipWrap = byId('summaryTipWrap');
    if(summaryTipWrap){
      summaryTipWrap.innerHTML = `
        <div style="font-size:13px; font-weight:950;">นำไปใช้ตอนแปรงจริง</div>
        <div style="border:1px solid rgba(34,197,94,.18); background:rgba(34,197,94,.10); border-radius:14px; padding:10px 12px; color:var(--text); font-size:13px; line-height:1.55; font-weight:900;">
          ${summary.overallTip}
        </div>
        <div style="color:var(--muted); font-size:12px; line-height:1.5;">
          ลองทำช้า ๆ เบา ๆ และให้ทั่วทุกซี่ตอนแปรงฟันจริง
        </div>
      `;
    }

    if(S.mode === 'learn'){
      audio.playCue('summary-learn');
    } else if(S.bossCompleted){
      audio.playCue('summary-win');
    } else {
      audio.playCue('summary-open');
    }

    if(summaryOverlay) summaryOverlay.style.display = 'grid';
  }

  function restartGame(){
    emitHha('hha:event', eventPayload('brush_restart', {
      score: Math.round(S.score),
      timeLeft: Math.ceil(S.timeLeft)
    }));
    clearDraft();
    stopDemoTutorial();
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
      z.clean = Math.max(0, Math.min(100, z.clean + 6));
      z.dirt = Math.max(0, Math.min(100, z.dirt - 7));
      if(zones.zoneCleanPct(z) >= currentModeCfg().cleanTarget) z.completed = true;
      zones.renderDirtForZone(idx);
    });

    S.score += 30;
    if(arenaCore) fx.spawnPop(arenaCore.clientWidth * .5, 86, 'POLISH!');
    boss.maybeStartBoss(currentModeCfg().cleanTarget);
    ui.refreshZoneUI();
  }

  function bindButtons(){
    byId('btnUV')?.addEventListener('click', ()=>{
      if(byId('btnUV')?.classList.contains('disabled')) return;
      useUV();
    });

    byId('btnPolish')?.addEventListener('click', ()=>{
      if(byId('btnPolish')?.classList.contains('disabled')) return;
      usePolish();
    });

    byId('btnRestart')?.addEventListener('click', restartGame);

    byId('btnStartBoss')?.addEventListener('click', ()=>{
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
      closeLearnOverlay();
      ui.setCoachText('ดูนิ้วตัวอย่างก่อน แล้วค่อยลองถูตามนะ', 'mid');
      audio.playCue('learn-watch');
      stopDemoTutorial();
      setTimeout(()=> startDemoTutorial(), 120);
    });

    byId('btnLearnSkip')?.addEventListener('click', ()=>{
      closeLearnOverlay();
    });

    byId('btnLearnStart')?.addEventListener('click', ()=>{
      closeLearnOverlay();
      ui.setNowDoText('เริ่มจากถูโซนที่มีกรอบสีฟ้า');
      audio.playCue('learn-start');
    });

    byId('btnShowLearnHelp')?.addEventListener('click', ()=>{
      if(S.mode === 'learn'){
        openLearnOverlay();
      } else {
        ui.setCoachText('ดูกรอบสีฟ้าและลองถูตามทิศที่บอกนะ', 'mid');
        stopDemoTutorial();
        setTimeout(()=> startDemoTutorial(), 120);
      }
    });

    byId('btnToggleAudio')?.addEventListener('click', ()=>{
      const on = audio.toggleAudio();
      setAudioPill();

      const u = new URL(location.href);
      u.searchParams.set('audio', on ? '1' : '0');
      history.replaceState({}, '', u.toString());

      if(!on){
        ui.setCoachText('ปิดเสียงแล้ว', 'mid');
      } else {
        audio.ensureAudio();
        audio.playCue('audio-on');
        ui.setCoachText('เปิดเสียงแล้ว', 'good');
      }
    });
  }

  function tick(){
    if(S.finished) return;

    if(S.mode === 'learn' && learnOverlay && learnOverlay.style.display === 'grid'){
      ui.refreshZoneUI();
      return;
    }

    S.timeLeft = Math.max(0, S.timeLeft - 0.1);

    if(!S.bossStarted){
      S.zoneState.forEach((z, idx)=>{
        if(idx !== S.activeZoneIdx){
          z.dirt = Math.max(0, Math.min(100, z.dirt + DIFF.dirtTick * 0.2));
        }
      });
    } else if (!S.bossCompleted){
      const active = S.zoneState[S.activeZoneIdx];
      if(active){
        active.dirt = Math.max(0, Math.min(100, active.dirt + .45));
        zones.renderDirtForZone(S.activeZoneIdx);
      }
    }

    boss.runBossPatternController();
    ui.refreshZoneUI();

    if(Math.round(S.timeLeft) % 5 === 0) emitProgress();
    if(Math.floor(S.timeLeft * 10) % 20 === 0) saveDraft();

    if(S.mode !== 'learn' && S.timeLeft <= 0){
      finishGame(S.bossCompleted ? 'complete' : 'timeup');
    }
  }

  function boot(){
    document.documentElement.classList.toggle('view-cvr', CFG.view === 'cvr');
    document.body.classList.toggle('view-cvr', CFG.view === 'cvr');

    const modeCfg = currentModeCfg();
    if(S.mode === 'learn'){
      S.timeLeft = modeCfg.time;
    } else if(!Number.isFinite(S.timeLeft) || S.timeLeft <= 0){
      S.timeLeft = modeCfg.time;
    }

    setTopPills();
    setAudioPill();
    audio.ensureAudio();
    refreshModeButtons();

    zones.buildZones((idx, ev)=>{
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
        openLearnOverlay();
      } else {
        setTimeout(()=> startDemoTutorial(), 700);
      }
    } else {
      ui.setNowDoText('เริ่มจากถูโซนที่มีกรอบสีฟ้า');
      setTimeout(()=> startDemoTutorial(), 700);
    }

    setInterval(tick, 100);

    window.addEventListener('hha:before-exit', ()=>{
      if(!S.finished){
        try{
          window.HHA_BACKHUB?.setSummary?.({
            gameId: CFG.gameId,
            gameTitle: 'Brush VR',
            gameIcon: '🦷',
            zoneId: 'hygiene',
            pid: CFG.pid || '',
            run: CFG.run || '',
            diff: CFG.diff || '',
            time: String(CFG.time),
            seed: CFG.seed || '',
            studyId: CFG.studyId || '',
            endReason: 'quit',
            mode: S.mode,
            scoreFinal: Math.round(S.score),
            accuracyPct: S.totalActions > 0 ? Math.round((S.hits / S.totalActions) * 1000) / 10 : 0,
            miss: S.miss,
            timePlayedSec: Math.round((S.mode === 'learn' ? 0 : CFG.time - S.timeLeft)),
            cleanPct: zones.totalCleanPct(),
            bossCompleted: S.bossCompleted,
            bossPhase: S.bossPhase,
            maxCombo: S.maxCombo,
            savedAt: nowISO(),
            href: location.href
          });
        }catch{}
      }
    });

    console.log('mouthWrap=', mouthWrap?.getBoundingClientRect());
  }

  boot();
})();