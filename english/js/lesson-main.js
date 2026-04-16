const osc = audioCtx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(520, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(140, audioCtx.currentTime + 0.18);
    osc.connect(masterGain);
    masterGain.gain.setValueAtTime(0.4, audioCtx.currentTime);
    masterGain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.22);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.22);
  } else if (type === "bossClear") {
    [392.0, 523.25, 783.99].forEach((freq, idx) => {
      const osc = audioCtx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime + (idx * 0.03));
      osc.frequency.exponentialRampToValueAtTime(freq * 1.3, audioCtx.currentTime + 0.62 + (idx * 0.03));
      osc.connect(masterGain);
      osc.start(audioCtx.currentTime + (idx * 0.03));
      osc.stop(audioCtx.currentTime + 0.72 + (idx * 0.03));
    });
    masterGain.gain.setValueAtTime(0.34, audioCtx.currentTime);
    masterGain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.75);
  }
}

function takeDamage() {
  showVRFeedback(false);
  playAnswerFX(false);

  let damageAmount = state.gameDifficulty === "easy" ? 15 : (state.gameDifficulty === "normal" ? 25 : 40);
  damageAmount += getAdaptiveDamageAdjustment();
  if (state.currentMission && state.currentMission.id % 3 === 0) damageAmount += 10;
  damageAmount = clamp(Math.round(damageAmount), 8, 50);

  state.systemHP -= damageAmount;
  state.comboCount = 0;
  state.consecutiveLosses++;
  state.consecutiveWins = 0;

  playSFX("fail");
  updateHUD(0);
  expandMissionStats(1300);
  expandMissionHudTextCompact(1300);
  expandMissionTimer(1200);

  const ui = $("ui-container");
  ui?.classList.add("shake");
  setTimeout(() => ui?.classList.remove("shake"), 300);

  if (state.systemHP <= 35) ui?.classList.add("danger-mode");

  let levelDownMsg = "";
  if (state.consecutiveLosses >= 2) {
    if (state.gameDifficulty === "hard") {
      window.setDifficulty("normal");
      levelDownMsg = " • NORMAL";
    } else if (state.gameDifficulty === "normal") {
      window.setDifficulty("easy");
      levelDownMsg = " • EASY";
    }
    state.consecutiveLosses = 0;
  }

  if (state.systemHP <= 0) {
    state.isGameOver = true;
    setFeedback(`💥 SYSTEM OFFLINE${levelDownMsg}`, "#ff4757");
    onMissionFailForAI("damage");
    recordMissionFail(aiDirector.mood);
    resetFinalBossState();
    hideAllScenesAndControls();
    setHudMode("summary");

    showEndSummary(false, state.currentMission, aiDirector.mood, [
      `Outcome: FAIL`
    ]);

    if (state.gameScore > 0) {
      show("game-over-ui");
      $("player-name-input").value = playerProfile.name || "";
    }
    show("btn-return", "inline-block");
  } else {
    setFeedback(minimalFailFeedback(damageAmount, levelDownMsg), "#ff4757");
  }
}

function startTimer(seconds) {
  clearInterval(state.missionTimer);
  state.timeLeft = seconds;
  showTimer(true);
  setMissionTimerAlert(false);

  state.missionTimer = setInterval(() => {
    setTimerText(state.timeLeft);

    if (state.timeLeft <= 10) {
      expandMissionTimer();
      setMissionTimerAlert(true);
    } else {
      setMissionTimerAlert(false);
    }

    if (state.timeLeft <= 0) {
      clearInterval(state.missionTimer);
      setMissionTimerAlert(false);
      setText("timer", "00:00 - TIME UP!");
      onMissionFailForAI("timeout");
      state.systemHP = 0;
      takeDamage();
      return;
    }

    state.timeLeft--;
  }, 1000);
}

function winMission() {
  clearInterval(state.missionTimer);
  playSFX("win");
  showVRFeedback(true);
  playAnswerFX(true);

  $("ui-container")?.classList.remove("danger-mode");
  const isFinal = state.currentMission && isUnitFinal(state.currentMission.id);

  if (isFinal && finalBossState.active && finalBossState.hp > 1) {
    finalBossState.hp -= 1;
    renderFinalBossUI();

    const chipRewardBase = 450 + (state.timeLeft * 6) + (state.currentMission.id === 5 ? 180 : 0);
    updateHUD(chipRewardBase);

    playSFX("bossHit");
    triggerImpactFlash("hit");
    animateBossActor("hit");
    showVRFeedback(true, "⚔ BOSS HIT!");
    showBossCinematic("BOSS HIT!", `HP ${finalBossState.hp}/${finalBossState.maxHp}`, 900);

    setFeedback(`⚔ HP ${finalBossState.hp}/${finalBossState.maxHp}`, "#f1c40f");
    scheduleFeedbackClear(900);
    expandMissionTimer(1000);
    hideAllScenesAndControls();

    setTimeout(() => {
      if (!state.isGameOver) loadMission(state.currentMission.id);
    }, 900);
    return;
  }

  const timeBonus = state.timeLeft * 10;
  if (state.systemHP < 100) {
    const healAmount = state.gameDifficulty === "easy" ? 20 : (state.gameDifficulty === "normal" ? 10 : 5);
    state.systemHP += Math.min(100 - state.systemHP, healAmount);
  }

  const bossMultiplier = (state.currentMission && state.currentMission.id % 3 === 0) ? 2 : 1;
  const finalUnitBonus = (state.currentMission && isUnitFinal(state.currentMission.id))
    ? (state.currentMission.id === 5 ? 3000 : state.currentMission.id === 10 ? 2700 : 3200)
    : 0;

  updateHUD(((1000 + timeBonus) * bossMultiplier) + finalUnitBonus);

  if (state.currentMission) {
    markMissionCleared(state.currentMission.id);
    refreshMissionWallProgress();
  }
  recordMissionSuccess(state.currentMission, aiDirector.mood, isUnitFinal);

  state.consecutiveWins++;
  state.consecutiveLosses = 0;
  onMissionSuccessForAI();

  let levelUpMsg = "";
  if (state.consecutiveWins >= 2) {
    if (state.gameDifficulty === "easy") {
      window.setDifficulty("normal");
      levelUpMsg = " • NORMAL";
    } else if (state.gameDifficulty === "normal" && aiDirector.pressure >= 2) {
      window.setDifficulty("hard");
      levelUpMsg = " • HARD";
    }
    state.consecutiveWins = 0;
  }

  const finalUnitText = (state.currentMission && isUnitFinal(state.currentMission.id)) ? " • UNIT CLEAR" : "";
  setFeedback(minimalWinFeedback(timeBonus, finalUnitText, levelUpMsg), "#2ed573");

  if (state.currentMission && isUnitFinal(state.currentMission.id)) {
    playSFX("bossClear");
    triggerImpactFlash("clear");
    animateBossActor("clear");
    showBossCinematic(`UNIT ${state.currentMission.id} CLEARED!`, "Final boss defeated", 1500);
    showVRFeedback(true, "👑 UNIT CLEAR!");
    resetFinalBossState();
  }

  hideAllScenesAndControls();
  setHudMode("summary");

  showEndSummary(true, state.currentMission, aiDirector.mood, [
    `Bonus: +${timeBonus}`
  ]);

  show("btn-next", "inline-block");
  show("btn-return", "inline-block");
}

function updateHUD(pointsToAdd = 0) {
  state.gameScore += pointsToAdd;
  if (pointsToAdd > 0) state.comboCount++;
  else if (pointsToAdd === 0) state.comboCount = 0;

  const scoreDisplay = $("score-display");
  if (scoreDisplay && pointsToAdd > 0) {
    scoreDisplay.classList.add("score-anim");
    setTimeout(() => scoreDisplay.classList.remove("score-anim"), 500);
  }

  setScoreHUD(state.gameScore, state.systemHP);

  if (document.body.dataset.missionType) {
    if (state.timeLeft > 0) setTimerText(state.timeLeft);
    expandMissionStats(pointsToAdd > 0 ? 1200 : 900);
    expandMissionHudTextCompact(pointsToAdd > 0 ? 1200 : 900);
  }

  if (pointsToAdd > 0 && state.comboCount >= 2) {
    showComboPopup();
  }

  if (state.comboCount > sessionStats.bestCombo) {
    sessionStats.bestCombo = state.comboCount;
    saveSessionStats();
    renderHubStatsBoard();
  }
}

function hideAllScenesAndControls() {
  hideAllMissionControlsUI();
  clearMissionPrompt();
  cancelFeedbackClear();
  expandMissionHeader();
  expandMissionStats();
  expandMissionPromptChrome();
  expandBossChrome();
  expandMissionTopChips();
  expandMissionTitleUltraMini();
  expandMissionTimer();
  expandMissionHudTextCompact();
  resetPromptFocusExpanded();
  setMissionTimerAlert(false);
  document.body.dataset.missionType = "";
  clearInterval(state.missionTimer);
}

window.playNextMission = function () {
  const nextId = getNextMissionId(state.lastMissionId || 1, missionDB.length);
  loadMission(nextId);
};

window.returnToHub = function () {
  state.isGameOver = false;
  state.systemHP = 100;

  $("boss-cinematic")?.classList.remove("show");
  $("impact-flash")?.classList.remove("impact-hit", "impact-clear");

  hideAllScenesAndControls();
  setHudMode("hub");
  hide("game-over-ui");
  $("ui-container")?.classList.remove("danger-mode");
  setHubVisible(true);

  setTitleBlock("TECHPATH VR", "เลือกด่านแล้วเริ่มเล่นได้เลย", "#00e5ff");
  applyUnitTheme(0);
  hide("btn-next");
  hide("btn-return");
  setFeedback("", "#ffffff");
  resetSummaryPanel();
  renderHubStatsBoard();
  state.currentMission = null;
  renderQuestionDiffBadge(state.gameDifficulty);
}

window.onload = function () {
  setHudMode("hub");
  generateMissionWall();
  window.setDifficulty("normal");
  syncProfileUI();
  renderAIDirector();
  renderFinalBossUI();
  renderHubStatsBoard();
  renderQuestionDiffBadge("normal");
  setRewardChestState("loading");
  setLeaderboardBoardState("idle");
  bootFirebase();

  setTimeout(() => {
    const loading = $("loading");
    if (!loading) return;
    loading.style.opacity = "0";
    setTimeout(() => loading.style.display = "none", 1000);
  }, 1000);

  $("write-input")?.addEventListener("keypress", function (e) {
    if (e.key === "Enter") window.checkWritingAnswer();
  });

  $("profile-name-input")?.addEventListener("keypress", function (e) {
    if (e.key === "Enter") window.savePlayerProfile();
  });

  $("mission-prompt-box")?.addEventListener("click", function () {
    const ui = $("ui-container");
    if (!ui) return;
    if (!ui.classList.contains("mission-mode")) return;
    if (!ui.classList.contains("mission-hp-critical")) return;
    togglePromptFocusExpanded();
  });
};