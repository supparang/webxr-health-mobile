window.onload = function () {
  const releaseLoading =
    window.__TECHPATH_RELEASE_LOADING__ ||
    function () {
      const loading = $("loading");
      if (!loading) return;
      loading.style.opacity = "0";
      setTimeout(() => {
        loading.style.display = "none";
      }, 250);
    };

  const showBootError =
    window.__TECHPATH_SHOW_BOOT_ERROR__ ||
    function (raw) {
      console.error(raw);
      setFeedback("⚠️ Boot error — see console", "#ff6b81");
    };

  try {
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
  } catch (e) {
    showBootError(e?.stack || e?.message || e);
  } finally {
    releaseLoading();
  }

  try {
    bootFirebase();
  } catch (e) {
    console.error("bootFirebase failed:", e);
    setRewardChestState("error", { note: "Reward Offline" });
    setLeaderboardBoardState("error");
  }

  try {
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
  } catch (e) {
    console.error("post-boot listener failed:", e);
  }
};