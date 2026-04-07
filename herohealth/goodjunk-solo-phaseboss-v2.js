function endGame(bossClear) {
  if (state.ended || state.uiLock.summaryShown) return;
  state.uiLock.summaryShown = true;
  state.ended = true;
  state.running = false;
  cancelAnimationFrame(state.raf);
  clearItems();

  state.metrics.bossEndAt = state.boss.active ? nowMs() : 0;
  state.metrics.bossDurationMs =
    state.metrics.bossEnterAt > 0 && state.metrics.bossEndAt > 0
      ? (state.metrics.bossEndAt - state.metrics.bossEnterAt)
      : 0;
  state.metrics.clearTimeMs = nowMs() - state.metrics.runStartAt;

  const stars = starsFromSummary(bossClear);
  const grade = calcGrade(bossClear);
  const medal = medalEmojiForGrade(grade);
  const payload = buildResearchPayload(bossClear, grade);
  saveResearchPayload(payload);
  const isRageClear = !!(bossClear && state.boss.rageTriggered);

  const dailyMeta = readDailyBossMeta();
  dailyMeta.plays += 1;
  if (bossClear) dailyMeta.clears += 1;
  if (isRageClear) dailyMeta.rageClears += 1;
  dailyMeta.bestScore = Math.max(dailyMeta.bestScore || 0, state.score);
  dailyMeta.bestStreak = Math.max(dailyMeta.bestStreak || 0, state.bestStreak);

  if (!dailyMeta.bestGrade || gradeScore(grade) > gradeScore(dailyMeta.bestGrade)) {
    dailyMeta.bestGrade = grade;
  }

  dailyMeta.rematchStreak = bossClear ? (dailyMeta.rematchStreak || 0) + 1 : 0;

  const metaReward = computeBossRewardMeta({
    bossClear,
    rageClear: isRageClear,
    grade,
    miss: state.miss,
    bestStreak: state.bestStreak,
    score: state.score
  });

  dailyMeta.lastReward = metaReward.reward;
  dailyMeta.lastBadge = metaReward.badge;

  const dailyResult = evaluateDailyChallenge({
    bossClear,
    rageClear: isRageClear,
    miss: state.miss,
    bestStreak: state.bestStreak,
    score: state.score
  });

  writeDailyBossMeta(dailyMeta);

  const hubSnapshot = buildHubSnapshot({
    bossClear,
    rageClear: isRageClear,
    grade,
    metaReward,
    dailyChallenge: dailyResult
  });
  saveHubSnapshot(hubSnapshot);

  ui.sumTitle.textContent =
    isRageClear ? 'Rage Finale Clear!' :
    bossClear ? 'Food Hero Complete!' :
    'Great Job!';

  ui.sumSub.textContent =
    isRageClear
      ? 'เธอฝ่าช่วง Rage Finale และโค่น Junk King ได้แบบสุดมันส์'
      : bossClear
        ? 'เธอช่วยปกป้องเมืองอาหารดีและเอาชนะ Junk King ได้แล้ว'
        : state.phase >= 2
          ? 'ผ่านด่านก่อนบอสได้ดีมาก รอบหน้าลุยต่อได้อีก'
          : 'เริ่มต้นได้ดีมาก เก็บอาหารดีต่อไปนะ';

  ui.sumStars.textContent = '⭐'.repeat(stars);
  ui.sumGrade.textContent = grade;
  ui.sumGrade.className = 'gjsb-grade ' + grade.toLowerCase();
  ui.sumMedal.textContent = medal;

  runVictoryPolish(bossClear, grade);
  addSummaryRibbon(
    isRageClear
      ? `🔥 ${metaReward.reward}`
      : bossClear
        ? `🏆 ${metaReward.reward}`
        : `⭐ ${metaReward.reward}`
  );

  ui.sumGrid.innerHTML = `
    <div class="gjsb-stat"><div class="k">ระดับ</div><div class="v">${diffKey}</div></div>
    <div class="gjsb-stat"><div class="k">คะแนน</div><div class="v">${state.score}</div></div>
    <div class="gjsb-stat"><div class="k">พลาด</div><div class="v">${state.miss}</div></div>
    <div class="gjsb-stat"><div class="k">คอมโบสูงสุด</div><div class="v">${state.bestStreak}</div></div>
    <div class="gjsb-stat"><div class="k">แตะของดี</div><div class="v">${state.hitsGood}</div></div>
    <div class="gjsb-stat"><div class="k">ตีบอส</div><div class="v">${state.powerHits}</div></div>
    <div class="gjsb-stat"><div class="k">โดนพายุขยะ</div><div class="v">${state.stormHits}</div></div>
    <div class="gjsb-stat"><div class="k">โดนของลวง</div><div class="v">${state.baitHits}</div></div>
    <div class="gjsb-stat"><div class="k">เป้าหายไป</div><div class="v">${state.weakMissed}</div></div>
    <div class="gjsb-stat"><div class="k">ถึงไหนแล้ว</div><div class="v">${getReachedLabel(bossClear)}</div></div>
    <div class="gjsb-stat"><div class="k">เวลาเจอบอส</div><div class="v">${state.metrics.bossDurationMs ? (state.metrics.bossDurationMs / 1000).toFixed(1) + 's' : '-'}</div></div>
    <div class="gjsb-stat"><div class="k">Run Variant</div><div class="v">${state.replay.runLabel || 'Balanced'}</div></div>
    ${buildMetaSummaryHtml(metaReward, dailyResult, dailyMeta)}
  `;

  ui.sumCoach.textContent = coachMessage(bossClear);
  ui.sumNextHint.textContent = nextHintMessage(bossClear);

  ui.sumCoach.textContent += ` • วันนี้ได้ ${metaReward.badge}`;
  ui.sumNextHint.textContent += dailyResult.done
    ? ' • Daily challenge วันนี้สำเร็จแล้ว'
    : ` • Daily challenge: ${dailyResult.title}`;

  ui.sumExportBox.innerHTML = `
    <strong>payload พร้อม export แล้ว</strong><br>
    sessionId: ${payload.sessionId}<br>
    events: ${payload.events.length}<br>
    grade: ${payload.outcome.grade}<br>
    bossClear: ${payload.outcome.bossClear ? 'yes' : 'no'}
  `;

  if (ui && ui.btnReplay) {
    ui.btnReplay.textContent =
      bossClear
        ? `🔥 เล่นอีกครั้ง (${dailyMeta.rematchStreak})`
        : '🔁 ลองใหม่';
  }

  saveLastSummary({
    source: 'goodjunk-solo-phaseboss-v2',
    gameId: ctx.gameId || 'goodjunk',
    mode: 'solo',
    pid: ctx.pid || 'anon',
    diff: diffKey,
    score: state.score,
    miss: state.miss,
    bestStreak: state.bestStreak,
    hitsGood: state.hitsGood,
    hitsBad: state.hitsBad,
    powerHits: state.powerHits,
    stormHits: state.stormHits,
    baitHits: state.baitHits,
    weakMissed: state.weakMissed,
    bossDefeated: !!bossClear,
    phaseReached: state.boss.active ? 'boss' : ('phase-' + state.phase),
    bossStageReached: state.boss.stageReached,
    rageTriggered: !!state.boss.rageTriggered,
    finalGrade: grade,
    rewardTitle: metaReward.reward,
    rewardBadge: metaReward.badge,
    dailyChallengeTitle: dailyResult.title,
    dailyChallengeDone: dailyResult.done,
    rematchStreak: dailyMeta.rematchStreak
  });

  try {
    const hhaSummary = {
      session_id: state.research.sessionId,
      pid: ctx.pid || 'anon',
      name: ctx.name || 'Hero',
      student_code:
        q.get('student_code') ||
        q.get('studentNo') ||
        q.get('studentKey') ||
        '',
      grade: q.get('grade') || '',
      class_room: q.get('classRoom') || '',
      school: q.get('schoolCode') || '',
      campus: q.get('campus') || '',
      age: q.get('age') || '',
      sex: q.get('sex') || '',

      game: 'goodjunk',
      game_title: 'GoodJunk Solo Boss',
      zone: ctx.zone || 'nutrition',
      mode: 'solo',
      run: ctx.run || 'play',
      research_phase: q.get('phase') || '',
      study_id: ctx.studyId || '',
      condition_group: q.get('conditionGroup') || '',
      variant: 'phaseboss',
      pick_mode: 'manual',
      diff: diffKey,
      difficulty: diffKey,
      timeSec: Math.round(state.timeTotal / 1000),
      durationSec: Math.max(0, Math.round((Date.now() - state.metrics.runStartAt) / 1000)),
      startAt: state.metrics.runStartAt,
      endAt: Date.now(),
      seed: ctx.seed || '',
      view: ctx.view || 'mobile',
      view_mode: ctx.view || 'mobile',

      score: state.score,
      hits: state.hitsGood,
      goodHit: state.hitsGood,
      junkHit: state.hitsBad,
      goodMiss: state.goodMissed,
      miss: state.miss,
      accuracy_pct:
        (state.hitsGood + state.hitsBad + state.goodMissed) > 0
          ? Math.round((state.hitsGood / (state.hitsGood + state.hitsBad + state.goodMissed)) * 10000) / 100
          : 0,
      bestStreak: state.bestStreak,
      comboMax: state.bestStreak,
      boss_phase_reached: bossClear ? 1 : 0,
      level_reached: state.phase,
      team_score: state.score,
      partner_score: 0,
      opponent_score: 0,
      rank: grade,
      room_id: '',
      match_id: '',
      partner_pid: '',
      opponent_pid: '',

      completed: true,
      reason: bossClear ? 'boss_clear' : (state.timeLeft <= 0 ? 'timeout' : 'end'),
      summary_json: JSON.stringify({
        grade,
        bossClear: !!bossClear,
        rageTriggered: !!state.boss.rageTriggered,
        phaseReached: state.phase,
        bossStageReached: state.boss.stageReached,
        reward: metaReward ? metaReward.reward : '',
        dailyChallenge: dailyResult ? dailyResult.title : ''
      }),

      app_version: 'herohealth',
      game_version: 'goodjunk-solo-phaseboss-v2',
      schema_version: 'v20260403-HHA-RECEIVER-V4'
    };

    window.__HHA_LAST_SUMMARY__ = hhaSummary;
    window.dispatchEvent(new CustomEvent('hha:end', { detail: hhaSummary }));
    dlog('dispatched hha:end', hhaSummary);

    if (window.HHACloudLogger && typeof window.HHACloudLogger.flushFromSummary === 'function') {
      window.HHACloudLogger.flushFromSummary(hhaSummary);
      dlog('direct logger flush called');
    }
  } catch (err) {
    console.error('[GJSB] hha:end dispatch/flush failed', err);
  }

  writeRematchState({
    count: state.replay.rematchCount + 1,
    lastSeed: String(ctx.seed || ''),
    lastGrade: grade,
    lastBossStage: String(state.boss.stageReached || '')
  });

  clearRuntimeTimers();
  clearArenaPressure();
  ui.pauseOverlay.classList.remove('show');
  ui.summary.classList.add('show');

  safeTimeout(() => {
    if (ui && ui.summaryCard) {
      ui.summaryCard.scrollTop = 0;
    }
  }, 30);
}