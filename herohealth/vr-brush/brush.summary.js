// /herohealth/vr-brush/brush.summary.js
// HOTFIX v20260316c-BRUSH-SUMMARY-SAFE

function clamp(v, a, b){
  return Math.max(a, Math.min(b, v));
}

function num(v, d = 0){
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function arr(v){
  return Array.isArray(v) ? v : [];
}

export function buildBrushSummary({
  S,
  CFG,
  currentModeCfg,
  totalCleanPct,
  overallRealLifeTip,
  zoneSummaryChecks,
  zoneSummaryLine,
  zoneRealLifeTip,
  rankFrom,
  summaryQuestDone,
  nowISO,
  href
}){
  const safeZoneState = arr(S?.zoneState);
  const safeZoneMastery = arr(S?.zoneMastery);

  const acc = num(S?.totalActions, 0) > 0
    ? (num(S?.hits, 0) / num(S?.totalActions, 1)) * 100
    : 0;

  const clean = typeof totalCleanPct === 'function'
    ? num(totalCleanPct(), 0)
    : 0;

  const rank = typeof rankFrom === 'function'
    ? rankFrom(num(S?.score, 0), clean, !!S?.bossCompleted)
    : 'C';

  const targetClean = typeof currentModeCfg === 'function'
    ? num(currentModeCfg()?.cleanTarget, 85)
    : 85;

  const zoneSummary = safeZoneMastery.map((m, i)=>{
    let checks = {
      stars: 0,
      clean: false,
      direction: false,
      control: false,
      cleanPct: 0,
      dirRate: 0,
      localMiss: 0
    };

    try{
      if(typeof zoneSummaryChecks === 'function'){
        checks = Object.assign(checks, zoneSummaryChecks(safeZoneState, safeZoneMastery, i, targetClean) || {});
      }
    }catch{}

    let line = `${m?.label || safeZoneState[i]?.label || `โซน ${i+1}`}`;
    try{
      if(typeof zoneSummaryLine === 'function'){
        line = zoneSummaryLine(safeZoneState, safeZoneMastery, i, targetClean) || line;
      }
    }catch{}

    let tip = 'แปรงเบา ๆ ให้ทั่ว';
    try{
      if(typeof zoneRealLifeTip === 'function'){
        tip = zoneRealLifeTip(i) || tip;
      }
    }catch{}

    return {
      id: m?.id || safeZoneState[i]?.id || `zone_${i}`,
      label: m?.label || safeZoneState[i]?.label || `โซน ${i+1}`,
      stars: num(checks?.stars, 0),
      clean: !!checks?.clean,
      direction: !!checks?.direction,
      control: !!checks?.control,
      cleanPct: num(checks?.cleanPct, 0),
      dirRate: num(checks?.dirRate, 0),
      localMiss: num(checks?.localMiss, 0),
      line,
      tip
    };
  });

  let overallTip = 'ทำได้ดีแล้ว อย่าลืมแปรงให้ครบทุกด้านของฟัน';
  try{
    if(typeof overallRealLifeTip === 'function'){
      overallTip = overallRealLifeTip(safeZoneState, safeZoneMastery, targetClean) || overallTip;
    }
  }catch{}

  const summary = {
    gameId: CFG?.gameId || 'brush',
    gameTitle: 'Brush VR',
    gameIcon: '🦷',
    zoneId: 'hygiene',
    pid: CFG?.pid || '',
    run: CFG?.run || '',
    diff: CFG?.diff || '',
    time: String(CFG?.time ?? ''),
    seed: CFG?.seed || '',
    studyId: CFG?.studyId || '',
    mode: S?.mode || 'learn',
    overallTip,
    endReason: S?.bossCompleted ? 'complete' : 'timeup',
    scoreFinal: Math.round(num(S?.score, 0)),
    accuracyPct: Math.round(acc * 10) / 10,
    miss: num(S?.miss, 0),
    timePlayedSec: Math.max(
      0,
      Math.round(num(CFG?.time, 0) - num(S?.timeLeft, 0))
    ),
    cleanPct: clamp(Math.round(clean), 0, 100),
    bossCompleted: !!S?.bossCompleted,
    bossPhase: num(S?.bossPhase, 0),
    bossHits: num(S?.bossHits, 0),
    maxCombo: num(S?.maxCombo, 0),
    questPerfectShock: num(S?.quest?.perfectShock, 0),
    questLaserSurvive: num(S?.quest?.laserSurvive, 0),
    questDecoyAvoid: num(S?.quest?.decoyAvoid, 0),
    questDonePerfectShock: !!S?.quest?.donePerfectShock,
    questDoneLaserSurvive: !!S?.quest?.doneLaserSurvive,
    questDoneDecoyAvoid: !!S?.quest?.doneDecoyAvoid,
    laserPunish: num(S?.metrics?.laserPunish, 0),
    shockPerfectCount: num(S?.metrics?.shockPerfect, 0),
    decoyPunish: num(S?.metrics?.decoyPunish, 0),
    zoneSummary,
    coachHistory: arr(S?.coachHistory).slice(-12),
    savedAt: typeof nowISO === 'function' ? nowISO() : new Date().toISOString(),
    href: href || location.href
  };

  const qDone = [
    typeof summaryQuestDone === 'function' ? !!summaryQuestDone('shock') : !!summary.questDonePerfectShock,
    typeof summaryQuestDone === 'function' ? !!summaryQuestDone('laser') : !!summary.questDoneLaserSurvive,
    typeof summaryQuestDone === 'function' ? !!summaryQuestDone('decoy') : !!summary.questDoneDecoyAvoid
  ].filter(Boolean).length;

  const totalStars = zoneSummary.reduce((a, z)=> a + num(z?.stars, 0), 0);

  return {
    summary,
    rank,
    qDone,
    totalStars
  };
}