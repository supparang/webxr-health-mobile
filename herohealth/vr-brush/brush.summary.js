// /herohealth/vr-brush/brush.summary.js

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
  const acc = S.totalActions > 0 ? (S.hits / S.totalActions) * 100 : 0;
  const clean = totalCleanPct();
  const rank = rankFrom(S.score, clean, S.bossCompleted);
  const targetClean = currentModeCfg().cleanTarget;

  const summary = {
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
    mode: S.mode,
    overallTip: overallRealLifeTip(S.zoneState, S.zoneMastery, targetClean),
    endReason: S.bossCompleted ? 'complete' : 'timeup',
    scoreFinal: Math.round(S.score),
    accuracyPct: Math.round(acc * 10) / 10,
    miss: S.miss,
    timePlayedSec: Math.round(CFG.time - S.timeLeft),
    cleanPct: clean,
    bossCompleted: S.bossCompleted,
    bossPhase: S.bossPhase,
    bossHits: S.bossHits,
    maxCombo: S.maxCombo,
    questPerfectShock: S.quest.perfectShock,
    questLaserSurvive: S.quest.laserSurvive,
    questDecoyAvoid: S.quest.decoyAvoid,
    questDonePerfectShock: S.quest.donePerfectShock,
    questDoneLaserSurvive: S.quest.doneLaserSurvive,
    questDoneDecoyAvoid: S.quest.doneDecoyAvoid,
    laserPunish: S.metrics.laserPunish,
    shockPerfectCount: S.metrics.shockPerfect,
    decoyPunish: S.metrics.decoyPunish,
    zoneSummary: S.zoneMastery.map((m, i)=>{
      const checks = zoneSummaryChecks(S.zoneState, S.zoneMastery, i, targetClean);
      return {
        id: m.id,
        label: m.label,
        stars: checks?.stars || 0,
        clean: !!checks?.clean,
        direction: !!checks?.direction,
        control: !!checks?.control,
        cleanPct: checks?.cleanPct || 0,
        dirRate: checks?.dirRate || 0,
        localMiss: checks?.localMiss || 0,
        line: zoneSummaryLine(S.zoneState, S.zoneMastery, i, targetClean),
        tip: zoneRealLifeTip(i)
      };
    }),
    coachHistory: S.coachHistory.slice(-12),
    savedAt: nowISO(),
    href
  };

  const qDone = [
    summaryQuestDone('shock'),
    summaryQuestDone('laser'),
    summaryQuestDone('decoy')
  ].filter(Boolean).length;

  const totalStars = summary.zoneSummary.reduce((a,z)=> a + z.stars, 0);

  return {
    summary,
    rank,
    qDone,
    totalStars
  };
}