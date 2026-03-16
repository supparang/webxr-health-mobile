// === /herohealth/hydration-vr/hydration.safe.js ===
// HeroHealth Hydration VR — SOLO-FIRST FULL PATCH
// PATCH v20260315d-HYD-SOLO-CLOSEOUT

'use strict';

import {
  HYD_GAME,
  HYD_DEFAULT_CAT,
  HYD_STICKER_META,
  isGateDone,
  setGateDone,
  loadHydShelf,
  hydrationShelfText,
  saveHydrationRewards,
  rewardCardTitle,
  rewardCardMini
} from './hydration.shared.js?v=20260315';

export async function boot(cfg = {}){
  const WIN = window;
  const DOC = document;
  const stageEl = DOC.getElementById('stage');
  const layer = DOC.getElementById('layer');
  if(!stageEl || !layer) return;

  // ------------------------------------------------------------
  // helpers
  // ------------------------------------------------------------
  const qs = (k, d='') => {
    try{
      const v = new URLSearchParams(location.search).get(k);
      return v == null ? d : v;
    }catch(e){
      return d;
    }
  };

  const nowMs = ()=> performance.now();
  const nowIso = ()=> new Date().toISOString();

  const clamp = (v,a,b)=>{
    v = Number(v);
    if(!Number.isFinite(v)) v = a;
    return Math.max(a, Math.min(b, v));
  };

  const lerp = (a,b,t)=> a + (b-a)*t;

  function safeJson(v){
    try{ return JSON.stringify(v, null, 2); }
    catch(e){ return String(v); }
  }

  function safeRun(fn, fallback=null){
    try{ return fn(); }
    catch(e){
      console.warn('[hydration] safeRun failed', e);
      return fallback;
    }
  }

  function safeText(el, value){
    if(el) el.textContent = String(value ?? '');
  }

  function safeHtml(el, value){
    if(el) el.innerHTML = String(value ?? '');
  }

  function safeToggle(el, cls, on){
    if(el) el.classList.toggle(cls, !!on);
  }

  async function copyText(text, label='Copied'){
    try{
      await navigator.clipboard.writeText(String(text ?? ''));
      console.log('[hydration]', label);
    }catch(e){
      console.warn('[hydration] clipboard failed', e);
    }
  }

  function isMobileCompact(){
    try{
      return WIN.matchMedia('(max-width: 560px)').matches;
    }catch(e){
      return WIN.innerWidth <= 560;
    }
  }

  // ------------------------------------------------------------
  // params / ctx
  // ------------------------------------------------------------
  const pid = String(qs('pid', 'anon') || 'anon').trim() || 'anon';
  const diff = String(qs('diff', 'normal') || 'normal').toLowerCase();
  const runMode = String(qs('run', 'play') || 'play').toLowerCase();
  const view = String(qs('view', 'mobile') || 'mobile').toLowerCase();
  const hubUrl = String(qs('hub', '../hub.html') || '../hub.html');
  const zoneKey = String(qs('zone', HYD_DEFAULT_CAT) || HYD_DEFAULT_CAT);
  const catKey = String(qs('cat', zoneKey || HYD_DEFAULT_CAT) || HYD_DEFAULT_CAT);
  const gameKey = HYD_GAME;
  const seedStr = String(qs('seed', String(Date.now())));
  const cooldownRequired = String(qs('cooldown', '1')) !== '0';
  const plannedSec = clamp(Number(qs('time', diff === 'hard' ? 90 : 80)), 30, 300);

  // ------------------------------------------------------------
  // ui refs
  // ------------------------------------------------------------
  const ui = {
    score: DOC.getElementById('uiScore'),
    time: DOC.getElementById('uiTime'),
    miss: DOC.getElementById('uiMiss'),
    expire: DOC.getElementById('uiExpire'),
    block: DOC.getElementById('uiBlock'),
    grade: DOC.getElementById('uiGrade'),
    water: DOC.getElementById('uiWater'),
    combo: DOC.getElementById('uiCombo'),
    shield: DOC.getElementById('uiShield'),
    phase: DOC.getElementById('uiPhase'),
    warmDone: DOC.getElementById('uiWarmDone'),
    coolDone: DOC.getElementById('uiCoolDone'),
    aiRisk: DOC.getElementById('aiRisk'),
    aiHint: DOC.getElementById('aiHint'),

    btnSfx: DOC.getElementById('btnSfx'),
    btnPause: DOC.getElementById('btnPause'),
    btnHelp: DOC.getElementById('btnHelp'),
    helpOverlay: DOC.getElementById('helpOverlay'),
    btnHelpStart: DOC.getElementById('btnHelpStart'),
    pauseOverlay: DOC.getElementById('pauseOverlay'),
    btnResume: DOC.getElementById('btnResume'),

    end: DOC.getElementById('end'),
    endTitle: DOC.getElementById('endTitle'),
    endSub: DOC.getElementById('endSub'),
    endGrade: DOC.getElementById('endGrade'),
    endScore: DOC.getElementById('endScore'),
    endMiss: DOC.getElementById('endMiss'),
    endWater: DOC.getElementById('endWater'),
    endCoach: DOC.getElementById('endCoach'),
    endPhaseSummary: DOC.getElementById('endPhaseSummary'),
    endReward: DOC.getElementById('endReward'),
    endBadge: DOC.getElementById('endBadge'),
    endCollection: DOC.getElementById('endCollection'),
    endRewardCard: DOC.getElementById('endRewardCard'),
    endRewardMini: DOC.getElementById('endRewardMini'),
    endStickerRow: DOC.getElementById('endStickerRow'),

    btnCopy: DOC.getElementById('btnCopy'),
    btnCopyEvents: DOC.getElementById('btnCopyEvents'),
    btnCopyTimeline: DOC.getElementById('btnCopyTimeline'),
    btnCopyFeatures: DOC.getElementById('btnCopyFeatures'),
    btnCopyLabels: DOC.getElementById('btnCopyLabels'),
    btnCopyFeaturesCsv: DOC.getElementById('btnCopyFeaturesCsv'),
    btnCopyLabelsCsv: DOC.getElementById('btnCopyLabelsCsv'),
    btnSendCloud: DOC.getElementById('btnSendCloud'),
    btnReplay: DOC.getElementById('btnReplay'),
    btnNextCooldown: DOC.getElementById('btnNextCooldown'),
    btnBackHub: DOC.getElementById('btnBackHub'),

    riskFill: DOC.getElementById('riskFill'),
    coachExplain: DOC.getElementById('coachExplain'),

    missionBar: DOC.getElementById('missionBar'),
    missionChipHit: DOC.getElementById('missionChipHit'),
    missionChipBlock: DOC.getElementById('missionChipBlock'),
    missionChipCombo: DOC.getElementById('missionChipCombo'),
    missionHitNow: DOC.getElementById('missionHitNow'),
    missionHitGoal: DOC.getElementById('missionHitGoal'),
    missionBlockNow: DOC.getElementById('missionBlockNow'),
    missionBlockGoal: DOC.getElementById('missionBlockGoal'),
    missionComboNow: DOC.getElementById('missionComboNow'),
    missionComboGoal: DOC.getElementById('missionComboGoal'),

    calloutLayer: DOC.getElementById('calloutLayer'),
    bossFace: DOC.getElementById('bossFace'),
    stickerBurst: DOC.getElementById('stickerBurst'),

    debugMini: DOC.getElementById('debugMini'),
    dbgPhase: DOC.getElementById('dbgPhase'),
    dbgCombo: DOC.getElementById('dbgCombo'),
    dbgWater: DOC.getElementById('dbgWater'),
    dbgShield: DOC.getElementById('dbgShield'),
    dbgBubbles: DOC.getElementById('dbgBubbles'),
    dbgFps: DOC.getElementById('dbgFps'),
  };

  const zoneSign = DOC.getElementById('zoneSign');

  // ------------------------------------------------------------
  // rng
  // ------------------------------------------------------------
  function xmur3(str){
    str = String(str || '');
    let h = 1779033703 ^ str.length;
    for(let i=0;i<str.length;i++){
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function(){
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return (h ^= (h >>> 16)) >>> 0;
    };
  }

  function sfc32(a,b,c,d){
    return function(){
      a>>>=0; b>>>=0; c>>>=0; d>>>=0;
      let t = (a + b) | 0;
      a = b ^ (b >>> 9);
      b = (c + (c << 3)) | 0;
      c = (c << 21) | (c >>> 11);
      d = (d + 1) | 0;
      t = (t + d) | 0;
      c = (c + t) | 0;
      return (t >>> 0) / 4294967296;
    };
  }

  const seedFn = xmur3(seedStr);
  const rand = sfc32(seedFn(), seedFn(), seedFn(), seedFn());
  const r01 = ()=> rand();
  const pick = arr => arr[Math.floor(r01() * arr.length)] || arr[0];

  // ------------------------------------------------------------
  // tune
  // ------------------------------------------------------------
  const BASE_TUNE = {
    spawnBase: diff === 'hard' ? 2.1 : 1.75,
    ttlGood: diff === 'hard' ? 1.55 : 1.8,
    ttlBad: diff === 'hard' ? 1.7 : 1.9,

    stormSpawnMul: 1.12,
    boss1SpawnMul: 1.10,
    boss2SpawnMul: 1.14,
    boss3SpawnMul: 1.18,
    finalSpawnMul: 1.20,

    stormBadP: 0.34,
    boss1BadP: 0.36,
    boss2BadP: 0.40,
    boss3BadP: 0.44,
    finalBadP: 0.48,

    missLimit: diff === 'hard' ? 16 : 18,

    missionHitGood: 12,
    missionBlock: 3,
    missionCombo: 8,
  };

  const TUNE = { ...BASE_TUNE };

  // ------------------------------------------------------------
  // game state
  // ------------------------------------------------------------
  let playing = true;
  let paused = false;
  let helpOpen = true;
  let endShown = false;

  let lastTick = nowMs();
  let tLeft = plannedSec;

  let score = 0;
  let missBadHit = 0;
  let missGoodExpired = 0;
  let combo = 0;
  let bestCombo = 0;
  let waterPct = 40;
  let shield = 0;
  let blockCount = 0;
  let feverOn = false;

  let phase = 'normal'; // normal | storm | boss | final
  let bossLevel = 0;
  let needZone = 'L';
  let phaseTimer = 0;
  let bossHits = 0;
  let finalHits = 0;
  const bossGoal = 10;
  const finalGoal = 12;

  let spawnAcc = 0;
  let nextStormAt = 22;
  let nextBossAt = 46;
  let nextFinalAt = 68;

  let rafId = 0;
  let loopRunning = false;
  let bootDestroyed = false;
  let fpsTimer = 0;
  let fpsFrames = 0;
  let fpsValue = '—';

  let streakTier = 0;
  let lastCalloutAt = 0;
  let bonusChain = 0;
  let bonusChainTimer = 0;

  const bubbles = new Map();
  let bubbleSeq = 0;

  const riskTimeline = [];
  const featureRows = [];
  const labelRows = [];
  const eventLog = [];

  const phaseStats = {
    normal:{ goodHit:0, badHit:0, expire:0 },
    storm:{ goodHit:0, badHit:0, expire:0 },
    boss1:{ goodHit:0, badHit:0, expire:0 },
    boss2:{ goodHit:0, badHit:0, expire:0 },
    boss3:{ goodHit:0, badHit:0, expire:0 },
    final:{ goodHit:0, badHit:0, expire:0 },
  };

  const missionState = {
    hitGoodDone:false,
    blockDone:false,
    comboDone:false
  };

  // ------------------------------------------------------------
  // audio
  // ------------------------------------------------------------
  const SFX = (() => {
    let ctx = null;
    let unlocked = false;

    function ensure(){
      if(!ctx){
        const AC = WIN.AudioContext || WIN.webkitAudioContext;
        if(AC) ctx = new AC();
      }
      return ctx;
    }

    function beep(freq=440, dur=0.07, type='sine', gain=0.03){
      const c = ensure();
      if(!c || !unlocked) return;
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.value = gain;
      o.connect(g);
      g.connect(c.destination);
      const t = c.currentTime;
      o.start(t);
      o.stop(t + dur);
    }

    return {
      unlock(){
        try{
          const c = ensure();
          if(c && c.state === 'suspended') c.resume();
          unlocked = true;
        }catch(e){}
      },
      good(){ beep(740, 0.05, 'sine', 0.025); },
      bad(){ beep(180, 0.08, 'square', 0.03); },
      shield(){ beep(980, 0.08, 'triangle', 0.03); },
      phase(){ beep(520, 0.14, 'sawtooth', 0.02); },
      setPhaseVolume(){ /* no-op solo */ }
    };
  })();

  // ------------------------------------------------------------
  // misc
  // ------------------------------------------------------------
  function hhDayKey(){
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function currentPhaseKey(){
    if(phase === 'storm') return 'storm';
    if(phase === 'boss') return `boss${bossLevel}`;
    if(phase === 'final') return 'final';
    return 'normal';
  }

  function childDoneText(done){
    return done ? 'เสร็จแล้ว ✅' : 'ยังไม่ทำ ✨';
  }

  function cooldownDone(cat, game, who){
    return isGateDone('cooldown', cat, game, who);
  }

  function buildSummary(reason){
    return {
      reason,
      pid,
      scoreFinal: score,
      missBadHit,
      missGoodExpired,
      waterPct: Math.round(waterPct),
      comboMax: bestCombo,
      blockCount,
      missionsDone: Number(missionState.hitGoodDone) + Number(missionState.blockDone) + Number(missionState.comboDone),
      grade: computeGrade(),
      runMode,
      diff,
      view,
      seed: seedStr,
      aiMode: 'off',
      aiSeed: '',
      aiEnabled: 0,
    };
  }

  function computeGrade(){
    if(score >= 260 && waterPct >= 70 && missBadHit <= 3) return 'S';
    if(score >= 200 && waterPct >= 55 && missBadHit <= 5) return 'A';
    if(score >= 140 && waterPct >= 35 && missBadHit <= 8) return 'B';
    if(score >= 80) return 'C';
    return 'D';
  }

  function totalGoodHits(){
    return phaseStats.normal.goodHit +
      phaseStats.storm.goodHit +
      phaseStats.boss1.goodHit +
      phaseStats.boss2.goodHit +
      phaseStats.boss3.goodHit +
      phaseStats.final.goodHit;
  }

  function logEvent(type, data={}){
    const item = {
      ts: Math.round((plannedSec - tLeft) * 1000),
      type,
      phase: currentPhaseKey(),
      ...data
    };
    eventLog.push(item);
  }

  function buildRisk(){
    return clamp(
      (waterPct < 25 ? (25 - waterPct)/25 * 0.40 : 0) +
      (missBadHit / Math.max(1, TUNE.missLimit)) * 0.30 +
      (phase !== 'normal' && shield <= 0 ? 0.18 : 0) +
      (combo <= 1 ? 0.05 : 0),
      0, 1
    );
  }

  function buildFeatureRow(risk){
    return {
      ts: Math.round((plannedSec - tLeft) * 1000),
      phase: currentPhaseKey(),
      bossLevel,
      score,
      missBadHit,
      missGoodExpired,
      combo,
      bestCombo,
      waterPct: +waterPct.toFixed(2),
      shield,
      blockCount,
      timeLeft: +tLeft.toFixed(2),
      feverOn: feverOn ? 1 : 0,
      inDangerPhase: phase === 'storm' || phase === 'boss' || phase === 'final' ? 1 : 0,
      inCorrectZone: isInNeededZone() ? 1 : 0,
      missRateRecent: 0,
      goodHitRateRecent: 0,
      badHitRateRecent: 0,
      expireRateRecent: 0,
      hitQualityRatio: 0,
      comboStability: 0,
      waterRecoverySlope: 0,
      shieldUsageEfficiency: 0,
      stormSurvivalQuality: 0,
      bossPhasePerformance: 0,
      fatigueProxy: 0,
      frustrationProxy: risk
    };
  }

  function updateTimelineAndFeatures(risk){
    const ts = Math.round((plannedSec - tLeft) * 1000);
    riskTimeline.push({ ts, risk });
    if(riskTimeline.length > 300) riskTimeline.shift();

    featureRows.push(buildFeatureRow(risk));
    if(featureRows.length > 500) featureRows.shift();
  }

  // ------------------------------------------------------------
  // mobile compact helpers
  // ------------------------------------------------------------
  function resetEndSectionVisibility(){
    DOC.querySelectorAll('.end-mobile-optional').forEach(el=>{
      el.style.display = '';
    });
  }

  function hideMobileOptionalEndSections(summary){
    if(!isMobileCompact()) return;

    DOC.querySelectorAll('.end-mobile-optional').forEach(el=>{
      el.style.display = 'none';
    });

    if(summary?.reason === 'final-clear' || summary?.grade === 'S' || summary?.grade === 'A'){
      const rewardCard = DOC.querySelector('.rewardCard.end-mobile-optional');
      if(rewardCard) rewardCard.style.display = '';
    }
  }

  function compactHudForMobileDuringPlay(){
    if(!isMobileCompact()) return;
    DOC.querySelectorAll('.hud-mobile-hide').forEach(el=>{
      el.style.display = 'none';
    });
  }

  // ------------------------------------------------------------
  // phase / coach text
  // ------------------------------------------------------------
  function childZoneLabel(){
    return needZone === 'L' ? 'ฝั่งซ้าย' : 'ฝั่งขวา';
  }

  function childCoachHint(){
    if(isMobileCompact()){
      if(phase === 'storm') return `ไป${childZoneLabel()} + หาโล่`;
      if(phase === 'boss') return `บอส ${bossLevel} ไป${childZoneLabel()}`;
      if(phase === 'final') return `ด่านสุดท้าย ไป${childZoneLabel()}`;
      if(feverOn) return 'ไฟลุก รีบเก็บน้ำ';
      if(waterPct < 25) return 'น้ำต่ำ รีบเก็บน้ำ';
      if(shield <= 0) return 'หาโล่ไว้กันฟ้าผ่า';
      return 'แตะน้ำดี เลี่ยงของไม่ดี';
    }

    if(phase === 'storm'){
      if(shield <= 0) return `พายุกำลังมา! ไป${childZoneLabel()} แล้วหาโล่ 🛡️`;
      return `พายุแรงแล้ว อยู่${childZoneLabel()} ให้ถูก 🌧️`;
    }

    if(phase === 'boss'){
      if(bossLevel === 1){
        if(shield <= 0) return `บอสสายฟ้ามาแล้ว! หาโล่เร็ว 🛡️`;
        return `บอส 1 มาแล้ว ไป${childZoneLabel()} ⚡`;
      }
      if(bossLevel === 2){
        if(shield <= 0) return `บอสแรงขึ้นแล้ว! อย่าลืมเก็บโล่ ⚡`;
        return `บอส 2 โจมตีไว ไป${childZoneLabel()} 🌪️`;
      }
      if(shield <= 0) return `บอส 3 มาแล้ว! ตั้งสติแล้วหาโล่ 👀`;
      return `บอส 3 ดุสุดแล้ว ไป${childZoneLabel()} 🔥`;
    }

    if(phase === 'final'){
      if(shield <= 0) return `ด่านสุดท้ายแล้ว! โล่สำคัญมาก 👑`;
      return `อีกนิดเดียว! ไป${childZoneLabel()} แล้วเก็บน้ำให้ไว 💧`;
    }

    if(feverOn) return 'ไฟลุกแล้ว! กวาดน้ำให้เร็ว 🔥';
    if(waterPct < 25) return 'น้ำน้อยแล้ว รีบเก็บน้ำเพิ่ม 💧';
    if(shield <= 0) return 'ลองหาโล่ไว้ก่อนนะ 🛡️';
    if(combo >= 8) return 'เก่งมาก! คอมโบต่ออีกนิด ✨';
    return 'แตะน้ำดี และอย่าโดนของไม่ดี 😊';
  }

  function phaseSummaryChildText(summary){
    const warmDoneNow = isGateDone('warmup', catKey, gameKey, pid);
    const cooldownDoneNow = isGateDone('cooldown', catKey, gameKey, pid) || cooldownDone(catKey, gameKey, pid);

    let phaseText = 'จบรอบปกติ';
    if(summary.reason === 'final-clear' || phase === 'final' || finalHits >= finalGoal){
      phaseText = 'ผ่านด่านสุดท้าย';
    }else if(phase === 'boss'){
      phaseText = `ถึงบอส ${bossLevel}`;
    }else if(phase === 'storm'){
      phaseText = 'ถึงพายุ';
    }

    if(isMobileCompact()){
      return `${phaseText} • วอร์ม${warmDoneNow ? '✅' : '✨'} • คูล${cooldownDoneNow ? '✅' : '✨'}`;
    }

    return `${phaseText} • วอร์มอัป: ${childDoneText(warmDoneNow)} • คูลดาวน์: ${childDoneText(cooldownDoneNow)}`;
  }

  function childEndCoach(summary){
    if(isMobileCompact()){
      if(summary.reason === 'final-clear') return 'ชนะด่านสุดท้ายแล้ว 🏆';
      if(summary.waterPct <= 10) return 'รอบหน้ารีบเก็บน้ำอีกนิด 💧';
      if(summary.missBadHit >= Math.max(3, Math.floor(BASE_TUNE.missLimit * 0.5))) return 'ระวังของไม่ดีอีกนิด 🚫';
      if(summary.comboMax >= 10) return 'คอมโบดีมาก ✨';
      return 'ลองเล่นอีกครั้งนะ 😊';
    }

    if(summary.reason === 'final-clear') return 'สุดยอดจริง ๆ วันนี้ชนะด่านสุดท้ายแล้ว 🏆';
    if(summary.waterPct <= 10) return 'รอบหน้าลองรีบเก็บน้ำมากขึ้นอีกนิดนะ คราวนี้ใกล้มากแล้ว 💧';
    if(summary.missBadHit >= Math.max(3, Math.floor(BASE_TUNE.missLimit * 0.5))) return 'ถ้าหลบของไม่ดีได้มากขึ้น คะแนนจะพุ่งอีกเยอะเลย 🚫';
    if(summary.comboMax >= 10) return 'คอมโบดีมากแล้ว รอบหน้ามีลุ้นทำได้สูงกว่านี้อีก ✨';
    return 'ทำได้ดีมากแล้ว ลองเล่นอีกรอบเพื่อเก็บรางวัลเพิ่มนะ 😊';
  }

  function childRewardText(summary){
    if(isMobileCompact()){
      if(summary.reason === 'final-clear') return '🏆 ชนะด่านสุดท้าย';
      if((summary.missionsDone || 0) >= 3) return '🎁 ภารกิจครบ';
      if((summary.missionsDone || 0) === 2) return '✨ ภารกิจ 2 อย่าง';
      if((summary.missionsDone || 0) === 1) return '🌟 ภารกิจ 1 อย่าง';
      return '💧 เล่นจบแล้ว';
    }

    if(summary.reason === 'final-clear') return '🏆 ปลดล็อกชัยชนะด่านสุดท้าย';
    if((summary.missionsDone || 0) >= 3) return '🎁 ได้รางวัลภารกิจครบ';
    if((summary.missionsDone || 0) === 2) return '✨ ได้รางวัลภารกิจ 2 อย่าง';
    if((summary.missionsDone || 0) === 1) return '🌟 ได้รางวัลภารกิจ 1 อย่าง';
    if(summary.comboMax >= 10) return '🔥 ได้รางวัลคอมโบสวย';
    return '💧 เก็บประสบการณ์รอบนี้แล้ว';
  }

  function childBadgeText(summary){
    if(isMobileCompact()){
      if(summary.reason === 'final-clear') return '👑 ผู้ชนะ';
      if(summary.grade === 'S') return '⭐ เจ้าน้ำ';
      if(summary.grade === 'A') return '💙 เก่งมาก';
      if(summary.grade === 'B') return '💧 ฮีโร่น้ำ';
      return '🌈 ลองอีกครั้ง';
    }

    if(summary.reason === 'final-clear') return '👑 ผู้พิชิตด่านสุดท้าย';
    if(summary.grade === 'S') return '⭐ เจ้าน้ำตัวจริง';
    if(summary.comboMax >= 10) return '✨ เจ้าคอมโบสายฟ้า';
    if(summary.blockCount >= 3) return '🛡️ ผู้พิทักษ์โล่';
    if(summary.grade === 'A') return '💙 นักเก็บน้ำเก่งมาก';
    if(summary.grade === 'B') return '💧 ฮีโร่น้ำ';
    return '🌈 นักสู้ฝึกหัด';
  }

  // ------------------------------------------------------------
  // fx
  // ------------------------------------------------------------
  function fxRing(x,y){
    const el = DOC.createElement('div');
    el.className = 'fx-ring';
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    stageEl.appendChild(el);
    setTimeout(()=> el.remove(), 500);
  }

  function fxScore(x,y,text){
    const el = DOC.createElement('div');
    el.className = 'fx-score';
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.textContent = text;
    stageEl.appendChild(el);
    setTimeout(()=> el.remove(), 1000);
  }

  function fxBubblePop(el, kind='good'){
    if(!el) return;
    el.classList.add(kind === 'bad' ? 'fx-bad' : 'fx-pop');
  }

  function fxStageFlash(){
    const el = DOC.createElement('div');
    el.className = 'storm-flash';
    stageEl.appendChild(el);
    setTimeout(()=> el.remove(), 250);
  }

  function fxBolt(x){
    const el = DOC.createElement('div');
    el.className = 'bolt';
    el.style.left = `${x}px`;
    stageEl.appendChild(el);
    setTimeout(()=> el.remove(), 350);
  }

  function fxPhaseBanner(text){
    const old = DOC.getElementById('hydrationPhaseBanner');
    if(old) old.remove();

    const banner = DOC.createElement('div');
    banner.id = 'hydrationPhaseBanner';
    banner.style.position = 'absolute';
    banner.style.left = '50%';
    banner.style.top = '38%';
    banner.style.transform = 'translate(-50%,-50%) scale(.92)';
    banner.style.zIndex = '26';
    banner.style.maxWidth = 'min(90vw, 520px)';
    banner.style.padding = '14px 18px';
    banner.style.borderRadius = '22px';
    banner.style.border = '1px solid rgba(255,255,255,.18)';
    banner.style.background = 'rgba(2,6,23,.86)';
    banner.style.backdropFilter = 'blur(10px)';
    banner.style.boxShadow = '0 20px 60px rgba(0,0,0,.35)';
    banner.style.textAlign = 'center';
    banner.style.fontSize = 'clamp(22px, 5vw, 34px)';
    banner.style.fontWeight = '1100';
    banner.style.color = '#fff';
    banner.style.opacity = '0';
    banner.style.transition = 'transform .18s ease, opacity .18s ease';
    banner.textContent = text;
    stageEl.appendChild(banner);

    requestAnimationFrame(()=>{
      banner.style.opacity = '1';
      banner.style.transform = 'translate(-50%,-50%) scale(1)';
    });

    setTimeout(()=>{
      banner.style.opacity = '0';
      banner.style.transform = 'translate(-50%,-50%) scale(.96)';
      setTimeout(()=>{ try{ banner.remove(); }catch(e){} }, 220);
    }, 1100);
  }

  function showCallout(text, tone='good'){
    const now = Date.now();
    if(now - lastCalloutAt < 650) return;
    lastCalloutAt = now;

    if(!ui.calloutLayer) return;
    const liveCount = ui.calloutLayer.querySelectorAll('.callout').length;
    if(liveCount >= 2){
      const first = ui.calloutLayer.querySelector('.callout');
      if(first) first.remove();
    }

    const el = DOC.createElement('div');
    el.className = `callout ${tone}`;
    el.textContent = String(text || '');
    ui.calloutLayer.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(e){} }, 1400);
  }

  function setBossFace(mode='hide'){
    if(!ui.bossFace) return;

    if(mode === 'hide'){
      ui.bossFace.className = 'bossFace';
      ui.bossFace.textContent = '⚡';
      return;
    }

    if(mode === 'storm'){
      ui.bossFace.className = 'bossFace show b1';
      ui.bossFace.textContent = '🌧️';
      return;
    }

    if(mode === 'boss1'){
      ui.bossFace.className = 'bossFace show b1';
      ui.bossFace.textContent = '⚡';
      return;
    }

    if(mode === 'boss2'){
      ui.bossFace.className = 'bossFace show b2';
      ui.bossFace.textContent = '🌪️';
      return;
    }

    if(mode === 'boss3'){
      ui.bossFace.className = 'bossFace show b3';
      ui.bossFace.textContent = '🔥';
      return;
    }

    if(mode === 'final'){
      ui.bossFace.className = 'bossFace show final';
      ui.bossFace.textContent = '👑';
    }
  }

  function spawnSticker(text){
    if(!ui.stickerBurst) return;

    const liveCount = ui.stickerBurst.querySelectorAll('.sticker').length;
    if(liveCount >= 6){
      const first = ui.stickerBurst.querySelector('.sticker');
      if(first) first.remove();
    }

    const el = DOC.createElement('div');
    el.className = 'sticker';
    el.textContent = String(text || '✨');

    const x = 12 + Math.random() * 68;
    const y = 62 + Math.random() * 18;
    el.style.left = `${x}%`;
    el.style.top = `${y}%`;

    ui.stickerBurst.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(e){} }, 1200);
  }

  function clearTransientVisuals(){
    try{ DOC.getElementById('hydrationPhaseBanner')?.remove(); }catch(e){}
    try{ ui.calloutLayer && safeHtml(ui.calloutLayer, ''); }catch(e){}
    try{ ui.stickerBurst && safeHtml(ui.stickerBurst, ''); }catch(e){}

    try{
      for(const b of bubbles.values()){
        b?.el?.remove?.();
      }
      bubbles.clear();
    }catch(e){}
  }

  function fxMission(text){
    showCallout(text, 'good');
  }

  function checkStreakTier(){
    let newTier = 0;
    if(combo >= 15) newTier = 3;
    else if(combo >= 10) newTier = 2;
    else if(combo >= 5) newTier = 1;

    if(newTier > streakTier){
      streakTier = newTier;
      if(newTier === 1){
        showCallout('✨ คอมโบเริ่มมาแล้ว', 'good');
        spawnSticker('✨ COMBO');
      }else if(newTier === 2){
        showCallout('🔥 เก่งมาก! คอมโบแรงขึ้นแล้ว', 'good');
        spawnSticker('🔥 HOT');
      }else if(newTier === 3){
        showCallout('🌟 สุดยอด! คอมโบสวยมาก', 'good');
        spawnSticker('🌟 WOW');
      }
    }

    if(combo === 0){
      streakTier = 0;
    }
  }

  function updateBonusChain(dt){
    if(bonusChainTimer > 0){
      bonusChainTimer = Math.max(0, bonusChainTimer - dt);
      if(bonusChainTimer <= 0){
        bonusChain = 0;
      }
    }
  }

  // ------------------------------------------------------------
  // gameplay helpers
  // ------------------------------------------------------------
  const GOOD = ['💧','💦','🫗'];
  const BAD  = ['🧋','🥤','🍟'];
  const SHLD = ['🛡️'];
  const BONUS = ['🌟','💎','🫧'];

  function isInNeededZone(){
    // mobile solo version: based on bubble half / safe lane concept
    // if no directional danger, treat as true
    return true;
  }

  function phaseSpawnMul(){
    let base = 1.0;
    if(phase === 'storm') base = TUNE.stormSpawnMul;
    else if(phase === 'boss'){
      if(bossLevel === 1) base = TUNE.boss1SpawnMul;
      else if(bossLevel === 2) base = TUNE.boss2SpawnMul;
      else base = TUNE.boss3SpawnMul;
    }else if(phase === 'final'){
      base = TUNE.finalSpawnMul;
    }
    return base * pacingSpawnBoost();
  }

  function phaseBadP(){
    let base = 0.24;
    if(phase === 'storm') base = TUNE.stormBadP;
    else if(phase === 'boss'){
      if(bossLevel === 1) base = TUNE.boss1BadP;
      else if(bossLevel === 2) base = TUNE.boss2BadP;
      else base = TUNE.boss3BadP;
    }else if(phase === 'final'){
      base = TUNE.finalBadP;
    }
    return clamp(base + pacingBadBoost(), 0.12, 0.75);
  }

  function runProgress01(){
    return clamp((plannedSec - tLeft) / Math.max(1, plannedSec), 0, 1);
  }

  function pacingSpawnBoost(){
    const p = runProgress01();
    if(p < 0.20) return 0.88;
    if(p < 0.55) return 1.00;
    if(p < 0.80) return 1.10;
    return 1.22;
  }

  function pacingBadBoost(){
    const p = runProgress01();
    if(p < 0.20) return -0.03;
    if(p < 0.55) return 0.00;
    if(p < 0.80) return 0.03;
    return 0.06;
  }

  let adaptiveTier = 0;

  function updateAdaptiveTier(){
    const p = runProgress01();

    if(p < 0.35 && waterPct < 24 && missBadHit >= 2){
      adaptiveTier = -1;
      return;
    }

    if(combo >= 10 && waterPct > 55 && missBadHit <= 1){
      adaptiveTier = 1;
      return;
    }

    adaptiveTier = 0;
  }

  function adaptiveSpawnFactor(){
    if(adaptiveTier < 0) return 0.90;
    if(adaptiveTier > 0) return 1.08;
    return 1.00;
  }

  function adaptiveBadFactor(){
    if(adaptiveTier < 0) return -0.04;
    if(adaptiveTier > 0) return 0.03;
    return 0.00;
  }

  function safeSpawnXY(){
    const rect = stageEl.getBoundingClientRect();
    const gap = (view === 'mobile') ? 8 : 12;
    const topPad = isMobileCompact() ? 210 : 280;
    const bottomPad = (view === 'mobile') ? 108 : 90;

    const x = lerp(gap, rect.width - gap, r01());
    const y = lerp(topPad, rect.height - bottomPad, r01());

    return {
      x: clamp(x, gap, rect.width - gap),
      y: clamp(y, topPad, rect.height - bottomPad)
    };
  }

  function makeBubble(kind, emoji, ttlSec){
    const { x, y } = safeSpawnXY();
    const id = `b${++bubbleSeq}`;

    const el = DOC.createElement('button');
    el.className = `bubble bubble-${kind}`;
    el.type = 'button';
    el.textContent = emoji;
    el.dataset.id = id;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;

    layer.appendChild(el);

    bubbles.set(id, {
      id, kind, emoji, el, x, y,
      born: nowMs(),
      ttlMs: ttlSec * 1000
    });
  }

  function removeBubble(id){
    const b = bubbles.get(id);
    if(!b) return;
    try{ b.el.remove(); }catch(e){}
    bubbles.delete(id);
  }

  function maybeTriggerFever(){
    feverOn = combo >= 10;
  }

  function maybeCompleteMissions(){
    if(!missionState.hitGoodDone && totalGoodHits() >= TUNE.missionHitGood){
      missionState.hitGoodDone = true;
      score += 20;
      fxMission('ภารกิจเก็บน้ำสำเร็จ +20');
      fxPhaseBanner('💧 ภารกิจน้ำสำเร็จ');
      spawnSticker('💧 CLEAR');
    }

    if(!missionState.blockDone && blockCount >= TUNE.missionBlock){
      missionState.blockDone = true;
      score += 18;
      fxMission('ภารกิจบล็อกสำเร็จ +18');
      fxPhaseBanner('🛡️ ภารกิจโล่สำเร็จ');
      spawnSticker('🛡️ CLEAR');
    }

    if(!missionState.comboDone && bestCombo >= TUNE.missionCombo){
      missionState.comboDone = true;
      score += 22;
      fxMission('ภารกิจคอมโบสำเร็จ +22');
      fxPhaseBanner('✨ ภารกิจคอมโบสำเร็จ');
      spawnSticker('✨ CLEAR');
    }
  }

  function hit(b){
    if(!b || !b.el) return;
    const bx = b.x;
    const by = b.y;

    if(b.kind === 'bonus'){
      combo++;
      bestCombo = Math.max(bestCombo, combo);
      maybeTriggerFever();
      checkStreakTier();

      const add = feverOn ? 40 : 28;
      score += add;
      waterPct = clamp(waterPct + 10, 0, 100);
      shield = clamp(shield + 1, 0, 9);

      bonusChain += 1;
      bonusChainTimer = 3.2;

      if(bonusChain === 2){
        score += 10;
        showCallout('โบนัสต่อเนื่อง +10', 'good');
        spawnSticker('✨ CHAIN');
      }else if(bonusChain >= 3){
        score += 18;
        showCallout('โบนัสต่อเนื่องสุดยอด +18', 'good');
        spawnSticker('🌟 CHAIN');
      }

      SFX.shield();
      fxBubblePop(b.el, 'good');
      fxRing(bx, by);
      fxScore(bx, by, `BONUS +${add}`);
      fxMission('โบนัสพิเศษ! +น้ำ +โล่');
      showCallout('เจอโบนัสพิเศษแล้ว 🎁', 'good');
      spawnSticker('🎁 BONUS');
      logEvent('bonus_hit', { scoreAdd:add, combo, waterPct, shield });

      setTimeout(()=> removeBubble(b.id), 50);
      maybeCompleteMissions();
      return;
    }

    if(b.kind === 'good'){
      combo++;
      bestCombo = Math.max(bestCombo, combo);
      maybeTriggerFever();
      checkStreakTier();

      const add = feverOn ? 16 : 10;
      score += add;
      waterPct = clamp(waterPct + 4.5, 0, 100);
      SFX.good();
      fxBubblePop(b.el, 'good');
      fxRing(bx, by);
      fxScore(bx, by, `+${add}`);
      setTimeout(()=> removeBubble(b.id), 50);

      const ps = phaseStats[currentPhaseKey()] || phaseStats.normal;
      ps.goodHit += 1;
      logEvent('good_hit', { scoreAdd:add, combo });

      if(combo === 3) showCallout('ดีมาก เก็บน้ำต่อได้เลย', 'good');
      if(combo === 7) showCallout('คอมโบสวยมาก ✨', 'good');
      if(combo === 12) showCallout('เก่งสุด ๆ ไปเลย 🌟', 'good');

      maybeCompleteMissions();
      return;
    }

    if(b.kind === 'shield'){
      combo++;
      bestCombo = Math.max(bestCombo, combo);
      maybeTriggerFever();

      shield = clamp(shield + 1, 0, 9);
      score += 6;
      SFX.shield();
      fxBubblePop(b.el, 'good');
      fxRing(bx, by);
      fxScore(bx, by, '🛡️');
      setTimeout(()=> removeBubble(b.id), 50);
      logEvent('shield_hit', { shield });
      return;
    }

    // bad
    combo = 0;
    maybeTriggerFever();
    bonusChain = 0;
    bonusChainTimer = 0;

    score = Math.max(0, score - 9);
    waterPct = clamp(waterPct - 8, 0, 100);
    missBadHit += 1;
    SFX.bad();
    fxBubblePop(b.el, 'bad');
    fxScore(bx, by, '-9');
    setTimeout(()=> removeBubble(b.id), 50);

    const ps = phaseStats[currentPhaseKey()] || phaseStats.normal;
    ps.badHit += 1;
    logEvent('bad_hit', { missBadHit, waterPct });
    showCallout('อุ๊ย โดนของไม่ดี', 'warn');
  }

  function applyLightningStrike(rate=1){
    const rect = stageEl.getBoundingClientRect();
    const x = lerp(20, rect.width - 20, r01());

    fxStageFlash();
    fxBolt(x);
    stageEl.classList.add('fx-shake');
    setTimeout(()=> stageEl.classList.remove('fx-shake'), 220);

    if(shield > 0){
      shield -= 1;
      blockCount += 1;
      logEvent('lightning_block', { shield, blockCount, rate });
      showCallout('เยี่ยมเลย โล่ช่วยไว้ได้ 🛡️', 'good');
      maybeCompleteMissions();
      return;
    }

    waterPct = clamp(waterPct - (10 * rate), 0, 100);
    combo = 0;
    missBadHit += 1;
    logEvent('lightning_hit', { waterPct, missBadHit, rate });
    showCallout('ฟ้าผ่ามาแล้ว รีบตั้งตัว', 'warn');
  }

  function refreshMissionBar(){
    if(ui.missionHitGoal) ui.missionHitGoal.textContent = String(TUNE.missionHitGood);
    if(ui.missionBlockGoal) ui.missionBlockGoal.textContent = String(TUNE.missionBlock);
    if(ui.missionComboGoal) ui.missionComboGoal.textContent = String(TUNE.missionCombo);

    if(ui.missionHitNow) ui.missionHitNow.textContent = String(Math.min(totalGoodHits(), TUNE.missionHitGood));
    if(ui.missionBlockNow) ui.missionBlockNow.textContent = String(Math.min(blockCount, TUNE.missionBlock));
    if(ui.missionComboNow) ui.missionComboNow.textContent = String(Math.min(bestCombo, TUNE.missionCombo));

    if(ui.missionChipHit){
      ui.missionChipHit.classList.toggle('done', missionState.hitGoodDone);
      ui.missionChipHit.classList.toggle('hot', !missionState.hitGoodDone && totalGoodHits() >= TUNE.missionHitGood - 2);
    }

    if(ui.missionChipBlock){
      ui.missionChipBlock.classList.toggle('done', missionState.blockDone);
      ui.missionChipBlock.classList.toggle('hot', !missionState.blockDone && blockCount >= TUNE.missionBlock - 1);
    }

    if(ui.missionChipCombo){
      ui.missionChipCombo.classList.toggle('done', missionState.comboDone);
      ui.missionChipCombo.classList.toggle('hot', !missionState.comboDone && bestCombo >= TUNE.missionCombo - 2);
    }
  }

  function setStagePhase(p){
    stageEl?.classList?.toggle('is-storm', p==='storm');
    stageEl?.classList?.toggle('is-boss', p==='boss');
    stageEl?.classList?.toggle('is-final', p==='final');
    stageEl?.classList?.toggle('is-fever', feverOn);

    stageEl?.classList?.remove('boss-1','boss-2','boss-3','final-win');

    if(p === 'boss'){
      if(bossLevel === 1) stageEl?.classList?.add('boss-1');
      else if(bossLevel === 2) stageEl?.classList?.add('boss-2');
      else if(bossLevel >= 3) stageEl?.classList?.add('boss-3');
    }
  }

  function startStorm(){
    phase = 'storm';
    phaseTimer = 7.5;
    needZone = r01() < 0.5 ? 'L' : 'R';
    setStagePhase('storm');
    fxPhaseBanner('🌧️ พายุมาแล้ว');
    setBossFace('storm');
    showCallout('พายุกำลังมา อยู่ฝั่งที่ปลอดภัยนะ', 'warn');
    SFX.phase();
  }

  function startBoss(level){
    phase = 'boss';
    bossLevel = level;
    phaseTimer = 8.5;
    needZone = r01() < 0.5 ? 'L' : 'R';
    bossHits = 0;
    setStagePhase('boss');
    fxPhaseBanner(`⚡ บอส ${bossLevel} มาแล้ว`);

    if(level === 1){
      setBossFace('boss1');
      showCallout('บอสสายฟ้ามาแล้ว ⚡', 'boss');
    }else if(level === 2){
      setBossFace('boss2');
      showCallout('บอสพายุมาแล้ว 🌪️', 'boss');
    }else{
      setBossFace('boss3');
      showCallout('บอสไฟมาแล้ว 🔥', 'boss');
    }

    SFX.phase();
  }

  function startFinal(){
    phase = 'final';
    phaseTimer = 12;
    needZone = r01() < 0.5 ? 'L' : 'R';
    finalHits = 0;
    setStagePhase('final');
    fxPhaseBanner('👑 ด่านสุดท้าย');
    setBossFace('final');
    showCallout('ด่านสุดท้ายแล้ว สู้ต่ออีกนิด', 'boss');
    SFX.phase();
  }

  function setAIHud(risk, hint){
    safeText(ui.aiRisk, risk.toFixed(2));
    if(ui.riskFill) ui.riskFill.style.width = `${Math.round(clamp(risk, 0, 1) * 100)}%`;
    safeText(ui.aiHint, hint);
  }

  function refreshDebug(dt=0){
    const debugOn = ['1','true','yes','on'].includes(String(qs('debug','0')).toLowerCase());
    if(!ui.debugMini) return;
    safeToggle(ui.debugMini, 'is-hidden', !debugOn);
    if(!debugOn) return;

    fpsTimer += dt;
    fpsFrames += 1;
    if(fpsTimer >= 0.45){
      fpsValue = String(Math.round(fpsFrames / Math.max(0.001, fpsTimer)));
      fpsTimer = 0;
      fpsFrames = 0;
    }

    safeText(ui.dbgPhase, currentPhaseKey());
    safeText(ui.dbgCombo, combo|0);
    safeText(ui.dbgWater, Math.round(waterPct));
    safeText(ui.dbgShield, shield|0);
    safeText(ui.dbgBubbles, bubbles.size);
    safeText(ui.dbgFps, fpsValue);
  }

  function setHUD(){
    safeText(ui.score, score|0);
    safeText(ui.miss, missBadHit|0);
    safeText(ui.water, `${Math.round(waterPct)}%`);
    safeText(ui.grade, computeGrade());
    safeText(ui.warmDone, childDoneText(isGateDone('warmup', catKey, gameKey, pid)));
    safeText(ui.coolDone, childDoneText(isGateDone('cooldown', catKey, gameKey, pid)));

    if(ui.phase){
      if(phase === 'storm'){
        ui.phase.textContent = `🌧️ พายุ • ไป${childZoneLabel()}`;
      }else if(phase === 'boss'){
        ui.phase.textContent = `⚡ บอส ${bossLevel} • ไป${childZoneLabel()} • ${bossHits}/${bossGoal}`;
      }else if(phase === 'final'){
        ui.phase.textContent = `👑 ด่านสุดท้าย • ไป${childZoneLabel()} • ${finalHits}/${finalGoal}`;
      }else if(feverOn){
        ui.phase.textContent = '🔥 ไฟลุก • รีบเก็บน้ำ';
      }else{
        ui.phase.textContent = '💧 ช่วงเก็บน้ำ';
      }
    }

    if(zoneSign){
      if(phase === 'storm'){
        zoneSign.textContent = `🌧️ ตอนนี้ปลอดภัยที่ ${childZoneLabel()}`;
      }else if(phase === 'boss'){
        zoneSign.textContent = `⚡ บอส ${bossLevel} มาแล้ว ไป${childZoneLabel()}`;
      }else if(phase === 'final'){
        zoneSign.textContent = `👑 ด่านสุดท้าย ไป${childZoneLabel()}`;
      }else if(feverOn){
        zoneSign.textContent = '🔥 ไฟลุกแล้ว รีบเก็บน้ำ';
      }else{
        zoneSign.textContent = '';
      }
    }

    const risk = buildRisk();
    let hint = childCoachHint();
    setAIHud(risk, hint);

    refreshMissionBar();
    compactHudForMobileDuringPlay();
  }

  function spawnTick(dt){
    updateAdaptiveTier();
    spawnAcc += (TUNE.spawnBase * phaseSpawnMul() * adaptiveSpawnFactor()) * dt;

    while(spawnAcc >= 1){
      spawnAcc -= 1;

      const p = r01();
      let kind = 'good';
      const badP = clamp(phaseBadP() + adaptiveBadFactor(), 0.10, 0.78);

      const bonusP =
        phase === 'final' ? 0.08 :
        phase === 'boss' ? 0.06 :
        phase === 'storm' ? 0.04 :
        0.03;

      if(phase === 'normal'){
        if(p < 0.58) kind = 'good';
        else if(p < 0.82) kind = 'bad';
        else if(p < 0.92) kind = 'shield';
        else kind = 'bonus';
      }else{
        if(p < bonusP) kind = 'bonus';
        else if(p < (1.0 - badP - 0.08)) kind = 'good';
        else if(p < (1.0 - 0.08)) kind = 'bad';
        else kind = 'shield';
      }

      if(kind === 'good') makeBubble('good', pick(GOOD), TUNE.ttlGood);
      else if(kind === 'shield') makeBubble('shield', pick(SHLD), 2.6);
      else if(kind === 'bonus') makeBubble('bonus', pick(BONUS), 2.2);
      else makeBubble('bad', pick(BAD), TUNE.ttlBad);
    }
  }

  function updateBubbles(now){
    for(const [id, b] of bubbles.entries()){
      if(now - b.born >= b.ttlMs){
        if(b.kind === 'good'){
          missGoodExpired += 1;
          combo = 0;
          phaseStats[currentPhaseKey()].expire += 1;
          logEvent('good_expire', {});
        }
        removeBubble(id);
      }
    }
  }

  function updatePhases(dt){
    const elapsed = plannedSec - tLeft;

    if(phase === 'normal'){
      if(elapsed >= nextStormAt){
        nextStormAt = 1e9;
        startStorm();
      }else if(elapsed >= nextBossAt){
        nextBossAt = 1e9;
        startBoss(1);
      }else if(elapsed >= nextFinalAt){
        nextFinalAt = 1e9;
        startFinal();
      }
      return;
    }

    phaseTimer -= dt;
    if(phase === 'storm'){
      if(Math.random() < 0.025) applyLightningStrike(1);
      if(phaseTimer <= 0){
        phase = 'normal';
        setStagePhase('normal');
        setBossFace('hide');
      }
      return;
    }

    if(phase === 'boss'){
      if(Math.random() < 0.02) applyLightningStrike(1.1);
      if(phaseTimer <= 0 || bossHits >= bossGoal){
        if(bossLevel < 3){
          startBoss(bossLevel + 1);
        }else{
          phase = 'normal';
          setStagePhase('normal');
          setBossFace('hide');
        }
      }
      return;
    }

    if(phase === 'final'){
      if(Math.random() < 0.03) applyLightningStrike(1.2);
      if(finalHits >= finalGoal){
        showEnd('final-clear');
      }else if(phaseTimer <= 0){
        phase = 'normal';
        setStagePhase('normal');
        setBossFace('hide');
      }
    }
  }

  function checkEnd(){
    if(tLeft <= 0) return true;
    if(missBadHit >= TUNE.missLimit) return true;
    if(waterPct <= 0) return true;
    return false;
  }

  function rewardCardMiniText(summary, shelf){
    return rewardCardMini(summary, shelf);
  }

  function renderStickerCollection(shelf){
    if(!ui.endStickerRow) return;
    ui.endStickerRow.innerHTML = '';

    Object.entries(HYD_STICKER_META).forEach(([key, meta])=>{
      const owned = !!(shelf?.stickers || {})[key];
      const chip = DOC.createElement('div');
      chip.className = `stickerChip ${owned ? '' : 'locked'}`.trim();
      chip.textContent = `${meta.icon} ${owned ? meta.label : 'ยังไม่ปลดล็อก'}`;
      ui.endStickerRow.appendChild(chip);
    });
  }

  function setEndButtons(summary){
    if(ui.btnNextCooldown){
      const showCooldown = cooldownRequired && !isGateDone('cooldown', catKey, gameKey, pid);
      ui.btnNextCooldown.classList.toggle('is-hidden', !showCooldown);

      ui.btnNextCooldown.onclick = ()=>{
        if(ui.btnNextCooldown.disabled) return;
        ui.btnNextCooldown.disabled = true;
        ui.btnReplay && (ui.btnReplay.disabled = true);
        ui.btnBackHub && (ui.btnBackHub.disabled = true);

        clearTransientVisuals();
        stopLoop();
        bootDestroyed = true;

        try{
          const u = new URL('../warmup-gate.html', location.href);
          u.searchParams.set('gatePhase', 'cooldown');
          u.searchParams.set('zone', zoneKey);
          u.searchParams.set('cat', catKey);
          u.searchParams.set('game', gameKey);
          u.searchParams.set('theme', gameKey);
          u.searchParams.set('pid', pid);
          u.searchParams.set('view', view);
          u.searchParams.set('run', runMode);
          u.searchParams.set('diff', diff);
          u.searchParams.set('time', String(plannedSec));
          u.searchParams.set('seed', seedStr);
          u.searchParams.set('hub', hubUrl);
          u.searchParams.set('next', hubUrl);
          location.href = u.toString();
        }catch(e){
          console.warn(e);
          try{
            ui.btnReplay && (ui.btnReplay.disabled = false);
            ui.btnBackHub && (ui.btnBackHub.disabled = false);
          }catch(_){}
        }
      };
    }

    if(ui.btnReplay){
      ui.btnReplay.classList.remove('primary');
      ui.btnReplay.classList.add('warn');

      if(ui.btnNextCooldown && ui.btnNextCooldown.classList.contains('is-hidden')){
        ui.btnReplay.classList.remove('warn');
        ui.btnReplay.classList.add('primary');
      }

      ui.btnReplay.onclick = ()=>{
        resetEndSectionVisibility();
        clearTransientVisuals();
        stopLoop();
        bootDestroyed = true;
        const u = new URL(location.href);
        u.searchParams.set('seed', String(Date.now()));
        location.href = u.toString();
      };
    }

    if(ui.btnBackHub){
      ui.btnBackHub.onclick = ()=>{
        clearTransientVisuals();
        stopLoop();
        bootDestroyed = true;
        location.href = hubUrl;
      };
    }
  }

  function showEnd(reason){
    if(endShown) return;
    endShown = true;

    clearTransientVisuals();
    resetEndSectionVisibility();

    playing = false;
    paused = false;

    const shelfBefore = safeRun(()=> loadHydShelf(pid), {
      bestScore:0, bestGrade:'—', finalClearCount:0, totalRuns:0, stickers:{}, lastReward:null
    });

    const summary = safeRun(()=> buildSummary(reason), {
      reason,
      grade:'—',
      scoreFinal:0,
      missBadHit:0,
      waterPct:0,
      comboMax:0,
      blockCount:0,
      missionsDone:0
    });

    const shelf = safeRun(()=> saveHydrationRewards(pid, summary, nowIso()), shelfBefore) || shelfBefore;

    setStagePhase('normal');
    stageEl?.classList?.remove('boss-1','boss-2','boss-3');
    setBossFace('hide');
    if(reason === 'final-clear'){
      stageEl?.classList?.add('final-win');
      try{
        fxPhaseBanner('🏆 ชนะแล้ว');
      }catch(e){}
    }

    if(ui.end) ui.end.setAttribute('aria-hidden','false');

    try{
      ui.end.scrollTop = 0;
    }catch(e){}

    safeText(ui.endTitle, (reason === 'final-clear') ? 'ผ่านด่านสุดท้ายแล้ว!' : 'เล่นจบรอบแล้ว');
    safeText(ui.endSub, `มุมมอง ${view} • ระดับ ${diff}`);
    safeText(ui.endGrade, summary.grade || '—');
    safeText(ui.endScore, String(summary.scoreFinal|0));
    safeText(ui.endMiss, String(summary.missBadHit|0));
    safeText(ui.endWater, `${summary.waterPct}%`);
    safeText(ui.endCoach, childEndCoach(summary));
    safeText(ui.endPhaseSummary, phaseSummaryChildText(summary));
    safeText(ui.endReward, childRewardText(summary));
    safeText(ui.endBadge, childBadgeText(summary));
    safeText(ui.endCollection, hydrationShelfText(shelf));
    safeText(ui.endRewardCard, rewardCardTitle(summary));
    safeText(ui.endRewardMini, rewardCardMiniText(summary, shelf));
    renderStickerCollection(shelf);

    hideMobileOptionalEndSections(summary);

    if(ui.endCollection){
      const wrap = ui.endCollection.closest('.endBox');
      if(wrap){
        wrap.classList.remove('collectionGlow');
        wrap.classList.add('collectionGlow');
      }
    }

    if(Number(summary.scoreFinal || 0) > Number(shelfBefore.bestScore || 0)){
      setTimeout(()=> spawnSticker('🏆 NEW BEST'), 80);
    }
    if(summary.grade === 'S'){
      setTimeout(()=> spawnSticker('⭐ S RANK'), 160);
    }
    if(summary.reason === 'final-clear'){
      setTimeout(()=> spawnSticker('👑 CLEAR'), 240);
      setTimeout(()=> spawnSticker('🏆 WIN'), 80);
      setTimeout(()=> spawnSticker('👑 HERO'), 120);
    }else if(summary.grade === 'A'){
      setTimeout(()=> spawnSticker('💙 GREAT'), 120);
    }else if(summary.grade === 'B'){
      setTimeout(()=> spawnSticker('💧 GOOD'), 120);
    }

    setEndButtons(summary);

    setTimeout(()=>{
      try{
        if(ui.btnNextCooldown && !ui.btnNextCooldown.classList.contains('is-hidden')){
          ui.btnNextCooldown.focus?.();
        }else{
          ui.btnReplay?.focus?.();
        }
      }catch(e){}
    }, 40);
  }

  function scheduleLoop(){
    if(bootDestroyed) return;
    if(loopRunning) return;
    loopRunning = true;
    rafId = requestAnimationFrame(loop);
  }

  function stopLoop(){
    loopRunning = false;
    if(rafId){
      try{ cancelAnimationFrame(rafId); }catch(e){}
      rafId = 0;
    }
  }

  function showHelp(){
    helpOpen = true;
    paused = true;
    ui.helpOverlay?.setAttribute('aria-hidden','false');
  }

  function hideHelp(){
    helpOpen = false;
    ui.helpOverlay?.setAttribute('aria-hidden','true');
    paused = false;
    lastTick = nowMs();
    loopRunning = false;
    scheduleLoop();
  }

  function showPause(){
    paused = true;
    ui.pauseOverlay?.setAttribute('aria-hidden','false');
  }

  function hidePause(){
    ui.pauseOverlay?.setAttribute('aria-hidden','true');
    paused = false;
    lastTick = nowMs();
    loopRunning = false;
    scheduleLoop();
  }

  function loop(t){
    if(bootDestroyed) return;

    if(paused || helpOpen){
      loopRunning = false;
      scheduleLoop();
      return;
    }

    const dt = clamp((t - lastTick) / 1000, 0, 0.05);
    lastTick = t;

    updateBonusChain(dt);

    tLeft = Math.max(0, tLeft - dt);
    waterPct = clamp(waterPct - dt * 0.22, 0, 100);

    spawnTick(dt);
    updateBubbles(t);
    updatePhases(dt);
    setStagePhase(phase);

    const risk = buildRisk();
    updateTimelineAndFeatures(risk);
    setHUD();
    refreshDebug(dt);

    if(checkEnd()){
      showEnd(tLeft <= 0 ? 'time' : (waterPct <= 0 ? 'water-empty' : 'miss-limit'));
      loopRunning = false;
      return;
    }

    loopRunning = false;
    scheduleLoop();
  }

  // ------------------------------------------------------------
  // pointer / shoot
  // ------------------------------------------------------------
  const __bound = {
    pointerLayer:false,
    shoot:false,
    visibility:false,
    unlock:false
  };

  function unlockOnce(){
    SFX.unlock();
  }

  if(!__bound.unlock){
    __bound.unlock = true;
    DOC.addEventListener('pointerdown', unlockOnce, true);
    DOC.addEventListener('touchstart', unlockOnce, true);
    DOC.addEventListener('keydown', unlockOnce, true);
  }

  if(!__bound.pointerLayer){
    __bound.pointerLayer = true;
    layer.addEventListener('pointerdown', (ev)=>{
      if(!playing || paused) return;
      const el = ev.target?.closest?.('.bubble');
      if(!el) return;
      const b = bubbles.get(String(el.dataset.id));
      if(b) hit(b);
    }, { passive:true });
  }

  function pickClosestToCenter(lockPx = 56){
    const rect = stageEl.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    let best = null;
    let bestD = 1e9;

    for(const b of bubbles.values()){
      const dx = b.x - cx;
      const dy = b.y - cy;
      const d = Math.hypot(dx, dy);
      if(d < bestD && d <= lockPx){
        bestD = d;
        best = b;
      }
    }
    return best;
  }

  if(!__bound.shoot){
    __bound.shoot = true;
    WIN.addEventListener('hha:shoot', (ev)=>{
      if(!playing || paused) return;
      const b = pickClosestToCenter(ev?.detail?.lockPx ?? 56);
      if(b) hit(b);
    });
  }

  if(!__bound.visibility){
    __bound.visibility = true;
    DOC.addEventListener('visibilitychange', ()=>{
      if(!playing) return;
      if(DOC.hidden){
        paused = true;
        ui.pauseOverlay?.setAttribute('aria-hidden','false');
      }
    });
  }

  // ------------------------------------------------------------
  // ui actions
  // ------------------------------------------------------------
  if(ui.btnHelp) ui.btnHelp.onclick = showHelp;
  if(ui.btnHelpStart) ui.btnHelpStart.onclick = hideHelp;
  if(ui.btnPause) ui.btnPause.onclick = ()=> paused ? hidePause() : showPause();
  if(ui.btnResume) ui.btnResume.onclick = hidePause;

  if(ui.btnCopy) ui.btnCopy.onclick = async ()=> copyText(safeJson(buildSummary('manual-copy')), 'Copy Summary JSON');
  if(ui.btnCopyEvents) ui.btnCopyEvents.onclick = async ()=> copyText(safeJson(eventLog), 'Copy Events JSON');
  if(ui.btnCopyTimeline) ui.btnCopyTimeline.onclick = async ()=> copyText(safeJson(riskTimeline), 'Copy Timeline JSON');
  if(ui.btnCopyFeatures) ui.btnCopyFeatures.onclick = async ()=> copyText(safeJson({ featureRows }), 'Copy Features JSON');
  if(ui.btnCopyLabels) ui.btnCopyLabels.onclick = async ()=> copyText(safeJson({ labelRows }), 'Copy Labels JSON');
  if(ui.btnCopyFeaturesCsv) ui.btnCopyFeaturesCsv.onclick = async ()=> copyText(featureRows.map(r=> Object.values(r).join(',')).join('\n'), 'Copy Features CSV');
  if(ui.btnCopyLabelsCsv) ui.btnCopyLabelsCsv.onclick = async ()=> copyText(labelRows.map(r=> Object.values(r).join(',')).join('\n'), 'Copy Labels CSV');

  // ------------------------------------------------------------
  // boot visual state
  // ------------------------------------------------------------
  endShown = false;
  setBossFace('hide');
  if(ui.end) ui.end.setAttribute('aria-hidden','true');
  if(ui.pauseOverlay) ui.pauseOverlay.setAttribute('aria-hidden','true');

  SFX.setPhaseVolume('normal');
  showHelp();
  setHUD();
  scheduleLoop();
}