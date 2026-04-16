// /english/js/lesson-main.js
import { missionDB } from "./lesson-data.js";
import { initFirebaseRuntime, onAuthStateChanged, ref, get, set, onValue } from "./lesson-firebase.js";
import {
  state,
  clamp,
  clearedMissions,
  markMissionCleared,
  setCurrentUser,
  setDbRuntime,
  getNextMissionId,
  updateDifficulty
} from "./lesson-state.js";
import {
  aiDirector,
  renderAIDirector,
  renderQuestionDiffBadge,
  getBaseTimeForMissionType,
  getDifficultyTimeMod,
  getAdaptiveTimeBonus,
  getAdaptiveSpeakAllowance,
  getAdaptiveDamageAdjustment,
  onMissionLoadedForAI,
  onMissionSuccessForAI,
  onMissionFailForAI
} from "./lesson-ai.js";
import {
  finalBossState,
  isUnitFinal,
  prepareMissionForBossPattern,
  applyUnitTheme,
  ensureFinalBossState,
  resetFinalBossState,
  maybeShowFinalBossIntro,
  renderFinalBossUI,
  triggerImpactFlash,
  animateBossActor,
  showBossCinematic
} from "./lesson-boss.js";
import {
  playerProfile,
  syncProfileUI,
  loadPlayerProfile,
  savePlayerProfile,
  selectAvatar,
  getChestRarity,
  showRewardBadge
} from "./lesson-rewards.js";
import {
  sessionStats,
  saveSessionStats,
  renderHubStatsBoard,
  resetSummaryPanel,
  showEndSummary,
  recordMissionStart,
  recordMissionSuccess,
  recordMissionFail,
  getMissionRunGain
} from "./lesson-summary.js";
import {
  $,
  setText,
  show,
  hide,
  setHudMode,
  setFeedback,
  setTitleBlock,
  setHubVisible,
  showTimer,
  setTimerText,
  setMissionScene,
  hideAllMissionControlsUI,
  setSpeakingPrompt,
  setWritingPrompt,
  setReadingQuestion,
  setChoiceLabelsFor,
  showMissionControlByType,
  showChoiceButtons,
  resetWritingInput,
  setScoreHUD
} from "./lesson-ui.js";

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

window.selectAvatar = function (avatar) {
  const ok = selectAvatar(avatar);
  if (!ok) setFeedback("🔒 Avatar นี้ยังไม่ปลดล็อก", "#ff9f43");
};

window.savePlayerProfile = function (silent = false) {
  return savePlayerProfile(silent);
};

function shortMissionType(type) {
  if (type === "speaking") return "SPEAK";
  if (type === "reading") return "READ";
  if (type === "listening") return "LISTEN";
  if (type === "writing") return "WRITE";
  return "MISSION";
}

function minimalDesc(currentMission, isFinal) {
  const diff = (currentMission?._selectedDifficulty || state.gameDifficulty).toUpperCase();
  if (isFinal) return `FINAL BOSS • ${diff} • HP ${finalBossState.hp}/${finalBossState.maxHp}`;
  return `${shortMissionType(currentMission?.type)} • ${diff}`;
}

function minimalStartFeedback(currentMission, isFinal) {
  if (isFinal) return `👑 FINAL BOSS START • ${currentMission._bossPattern}`;
  return `เริ่มภารกิจได้เลย`;
}

function minimalWinFeedback(timeBonus, finalUnitText = "", levelUpMsg = "") {
  return `✅ CLEAR! +${1000 + timeBonus} PTS${finalUnitText}${levelUpMsg}`;
}

function minimalFailFeedback(damageAmount, levelDownMsg = "") {
  return `❌ SYSTEM HP -${damageAmount}%${levelDownMsg}`;
}

function shortSummaryLines(success, currentMission, extras = []) {
  const lines = [
    `Mission: ${currentMission?.title || "-"}`,
    `Type: ${(currentMission?.type || "-").toUpperCase()}`,
    `Score: ${state.gameScore}`,
    `HP: ${state.systemHP}%`,
    `Combo Peak: x${Math.max(state.comboCount, sessionStats.bestCombo)}`,
    `Diff: ${(currentMission?._selectedDifficulty || state.gameDifficulty).toUpperCase()}`
  ];
  return success ? lines.concat(extras || []) : lines.concat(extras || []);
}

function refreshMissionWallProgress() {
  missionDB.forEach((mGroup) => {
    const box = document.getElementById(`mission-box-${mGroup.id}`);
    const label = document.getElementById(`mission-text-${mGroup.id}`);
    if (!box || !label) return;

    const basePrefix = isUnitFinal(mGroup.id) ? "👑 FINAL: " : ((mGroup.id % 3 === 0) ? "🔥 BOSS: " : "");
    const cleared = clearedMissions.includes(mGroup.id);

    label.setAttribute("value", `${cleared ? "✅ " : ""}${basePrefix}${mGroup.title}\n(${mGroup.type})`);
    box.setAttribute("material", "opacity", cleared ? 1 : 0.8);

    if (cleared) {
      box.setAttribute("animation__pulse", "property: scale; to: 1.05 1.05 1.05; dir: alternate; dur: 1200; loop: true");
    } else {
      box.removeAttribute("animation__pulse");
      box.setAttribute("scale", "1 1 1");
    }
  });
  syncProfileUI();
}

function setupLeaderboardListener() {
  if (!state.db) return;
  const lbRef = ref(state.db, ["artifacts", state.appId, "public", "data", "vr_leaderboards"].join("/"));

  onValue(lbRef, (snapshot) => {
    let scores = [];
    if (snapshot.exists()) {
      const val = snapshot.val() || {};
      scores = Object.values(val);
    }

    scores.sort((a, b) => (b.score || 0) - (a.score || 0));
    const top5 = scores.slice(0, 5);

    let lbText = "";
    top5.forEach((entry, i) => {
      const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "•";
      const avatar = typeof entry.avatar === "string" ? entry.avatar : "🧑‍💻";
      const safeName = (entry.name || "Hero").substring(0, 10);
      lbText += `${medal} ${avatar} ${safeName} : ${entry.score}\n`;
    });

    if (!scores.length) lbText = "Be the first to clear a mission!";

    const lbList = $("vr-leaderboard-list");
    if (lbList) lbList.setAttribute("value", lbText);
  }, (error) => {
    console.error("RTDB leaderboard listener error:", error);
    const lbList = $("vr-leaderboard-list");
    if (lbList) lbList.setAttribute("value", "Leaderboard Offline");
  });
}

async function bootFirebase() {
  try {
    const runtime = await initFirebaseRuntime();

    if (!runtime || !runtime.auth || !runtime.db) {
      console.warn("Firebase runtime not ready:", runtime);
      syncProfileUI();
      return;
    }

    setDbRuntime(runtime.db, runtime.auth, runtime.auth.currentUser || null, runtime.appId || "english-d4bfa");

    onAuthStateChanged(runtime.auth, async (user) => {
      setCurrentUser(user);

      if (user) {
        setupLeaderboardListener();
        await loadPlayerProfile(state.db, state.currentUser, state.appId);
        await window.checkDailyStreak();
      } else {
        syncProfileUI();
      }
    });
  } catch (e) {
    console.error("RTDB Init Error:", e);
    syncProfileUI();
  }
}

window.checkDailyStreak = async function () {
  if (!state.currentUser || !state.db) return;

  const rewardRef = ref(state.db, ["artifacts", state.appId, "users", state.currentUser.uid, "player_stats", "reward"].join("/"));
  try {
    const snap = await get(rewardRef);
    const rewardData = snap.exists() ? (snap.val() || {}) : {};
    let streak = rewardData.streak || 0;
    let lastLogin = rewardData.lastLogin || "";

    state.currentRewardStreak = streak;
    syncProfileUI();

    const today = new Date().toDateString();
    const chest = $("reward-chest");
    const streakText = $("streak-text");
    if (!chest || !streakText) return;

    if (lastLogin === today) {
      chest.removeAttribute("animation");
      chest.querySelector("a-box")?.setAttribute("color", "#555");
      streakText.setAttribute("value", `Streak: ${streak} Days\n(Come back tomorrow!)`);
      chest.classList.remove("clickable");
    } else {
      chest.setAttribute("animation", "property: position; to: -3.5 0.7 -3; dir: alternate; dur: 1000; loop: true");
      chest.querySelector("a-box")?.setAttribute("color", "#f1c40f");
      streakText.setAttribute("value", `Streak: ${streak} Days\n(Click to Claim!)`);
      chest.classList.add("clickable");
    }
  } catch (e) {
    console.error("Error checking streak (RTDB):", e);
  }
};

window.claimReward = async function () {
  if (!state.currentUser || !state.db) {
    setFeedback("⚠️ รอเชื่อมต่อเซิร์ฟเวอร์สักครู่...", "#ff9f43");
    return;
  }

  const rewardRef = ref(state.db, ["artifacts", state.appId, "users", state.currentUser.uid, "player_stats", "reward"].join("/"));

  try {
    const chest = $("reward-chest");
    chest?.classList.remove("clickable");

    const snap = await get(rewardRef);
    const rewardData = snap.exists() ? (snap.val() || {}) : {};
    let streak = rewardData.streak || 0;
    let lastLogin = rewardData.lastLogin || "";

    const today = new Date().toDateString();
    if (lastLogin === today) {
      setFeedback("🎁 วันนี้รับรางวัลไปแล้ว", "#ffeaa7");
      return;
    }

    let yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    streak = (lastLogin === yesterday.toDateString()) ? streak + 1 : 1;

    await set(rewardRef, { lastLogin: today, streak });

    state.currentRewardStreak = streak;
    const rarity = getChestRarity(streak);
    const streakBonus = streak * 200;
    const bonus = rarity.bonus + streakBonus;

    playSFX("win");
    updateHUD(bonus);
    showVRFeedback(true, `+${bonus} REWARD!`);
    showRewardBadge(rarity.name, rarity.color);

    chest?.removeAttribute("animation");
    chest?.querySelector("a-box")?.setAttribute("color", "#555");
    $("streak-text")?.setAttribute("value", `Streak: ${streak} Days\n(Claimed)`);

    syncProfileUI();
    setFeedback(`🎁 ${rarity.name} CHEST +${bonus}`, rarity.color);
  } catch (e) {
    console.error("Error claiming reward (RTDB):", e);
    $("reward-chest")?.classList.add("clickable");
    setFeedback("❌ เกิดข้อผิดพลาดในการรับรางวัล", "#ff4757");
  }
};

function generateMissionWall() {
  const wall = $("mission-wall");
  if (!wall) return;

  let index = 0;

  for (let row = 0; row < 3; row++) {
    let yPos = 1.2 - (row * 0.8);
    for (let col = 0; col < 5; col++) {
      if (index >= missionDB.length) break;
      let mGroup = missionDB[index];

      let angle = (col - 2) * 15;
      let rad = angle * Math.PI / 180;
      let radius = 4;
      let xPos = Math.sin(rad) * radius;
      let zPos = -Math.cos(rad) * radius + 4;

      let isBoss = (mGroup.id % 3 === 0);
      let isFinalUnit = isUnitFinal(mGroup.id);

      let color = isFinalUnit ? "#f1c40f" : (
        isBoss ? "#e74c3c" : (
          mGroup.type === "speaking" ? "#27ae60" :
          mGroup.type === "reading" ? "#3498db" :
          mGroup.type === "listening" ? "#e67e22" : "#9b59b6"
        )
      );

      let boxWidth = (isBoss || isFinalUnit) ? "1.5" : "1.2";
      let boxHeight = (isBoss || isFinalUnit) ? "0.8" : "0.6";

      let entity = document.createElement("a-entity");
      entity.setAttribute("position", `${xPos} ${yPos} ${zPos}`);
      entity.setAttribute("rotation", `0 ${-angle} 0`);

      let box = document.createElement("a-box");
      box.setAttribute("id", `mission-box-${mGroup.id}`);
      box.setAttribute("class", "clickable");
      box.setAttribute("width", boxWidth);
      box.setAttribute("height", boxHeight);
      box.setAttribute("depth", "0.1");
      box.setAttribute("color", color);
      box.setAttribute("material", "opacity: 0.8");

      box.addEventListener("mouseenter", () => {
        box.setAttribute("material", "color", "#00e5ff");
        box.setAttribute("scale", "1.1 1.1 1.1");
      });

      box.addEventListener("mouseleave", () => {
        box.setAttribute("material", "color", color);
        box.setAttribute("scale", "1 1 1");
      });

      box.addEventListener("click", () => loadMission(mGroup.id));

      let titlePrefix = isFinalUnit ? "👑 FINAL: " : (isBoss ? "🔥 BOSS: " : "");
      let text = document.createElement("a-text");
      text.setAttribute("id", `mission-text-${mGroup.id}`);
      text.setAttribute("value", `${titlePrefix}${mGroup.title}\n(${mGroup.type})`);
      text.setAttribute("align", "center");
      text.setAttribute("position", "0 0 0.06");
      text.setAttribute("scale", isBoss ? "0.5 0.5 0.5" : "0.4 0.4 0.4");

      entity.appendChild(box);
      entity.appendChild(text);
      wall.appendChild(entity);
      index++;
    }
  }

  refreshMissionWallProgress();
}

window.setDifficulty = function (level) {
  updateDifficulty(level);

  $("diff-easy-box")?.setAttribute("material", "opacity", "0.4");
  $("diff-normal-box")?.setAttribute("material", "opacity", "0.4");
  $("diff-hard-box")?.setAttribute("material", "opacity", "0.4");
  $(`diff-${level}-box`)?.setAttribute("material", "opacity", "1");

  renderAIDirector();
  renderQuestionDiffBadge(level);
};

function loadMission(id) {
  const missionGroup = missionDB.find(m => m.id === id);
  if (!missionGroup) return;

  state.currentMission = prepareMissionForBossPattern(missionGroup, aiDirector);
  if (!state.currentMission) {
    setFeedback("⚠️ ยังไม่มีโจทย์สำหรับด่านนี้", "#ff9f43");
    return;
  }

  state.lastMissionId = missionGroup.id;
  const isBoss = (state.currentMission.id % 3 === 0);
  const isFinal = isUnitFinal(state.currentMission.id);

  if (isFinal) ensureFinalBossState(state.currentMission.id);
  else resetFinalBossState();

  setHubVisible(false);
  hideAllScenesAndControls();
  setHudMode("mission");
  resetSummaryPanel();
  hide("btn-next");
  renderFinalBossUI();
  applyUnitTheme(state.currentMission.id);

  if (isFinal) {
    maybeShowFinalBossIntro(state.currentMission.id, () => playSFX("bossIntro"));
  }

  onMissionLoadedForAI(state.currentMission, isUnitFinal);

  const titlePrefix = isFinal ? "👑 " : (isBoss ? "🔥 " : "📍 ");
  const titleColor = isFinal
    ? (state.currentMission._bossPatternColor || "#f1c40f")
    : (isBoss ? "#e74c3c" : "#ff4757");

  setTitleBlock(
    `${titlePrefix}SESSION ${id}: ${state.currentMission.title.toUpperCase()} [${state.gameDifficulty.toUpperCase()}]`,
    minimalDesc(state.currentMission, isFinal),
    titleColor
  );

  setFeedback(minimalStartFeedback(state.currentMission, isFinal), isFinal ? "#f1c40f" : "#00e5ff");

  flashMissionTypeTag(state.currentMission.type, true);
  recordMissionStart(state.currentMission, aiDirector.mood);

  const timeMod = getDifficultyTimeMod() + getAdaptiveTimeBonus() + (state.currentMission._bossTimeAdjust || 0);

  const hackerBoss = $("hackerBoss");
  if ((isBoss || isFinal) && hackerBoss) {
    hackerBoss.setAttribute("visible", "true");
    hackerBoss.removeAttribute("animation");
    const bossTargetY = isFinal ? 1.4 : 2;
    const bossDur = isFinal ? 18000 : 40000;
    setTimeout(() => {
      hackerBoss.setAttribute("animation", `property: position; to: 0 ${bossTargetY} -3; dur: ${bossDur}; easing: linear`);
    }, 50);
  } else if (hackerBoss) {
    hackerBoss.setAttribute("visible", "false");
  }

  setMissionScene(state.currentMission.type);
  showMissionControlByType(state.currentMission.type);

  if (state.currentMission.type === "speaking") {
    setSpeakingPrompt(state.currentMission.title, state.currentMission.exactPhrase);
    startTimer(clamp(getBaseTimeForMissionType("speaking") + timeMod, 18, 80));
  } else if (state.currentMission.type === "reading") {
    setReadingQuestion(state.currentMission.question);
    setChoiceLabelsFor("reading", state.currentMission.choices);
    showChoiceButtons(true);
    startTimer(clamp(getBaseTimeForMissionType("reading") + timeMod, 18, 80));
  } else if (state.currentMission.type === "listening") {
    setChoiceLabelsFor("listening", state.currentMission.choices);
    showChoiceButtons(true);
    startTimer(clamp(getBaseTimeForMissionType("listening") + timeMod, 18, 80));
  } else if (state.currentMission.type === "writing") {
    setWritingPrompt(state.currentMission.prompt);
    show("write-input", "inline-block");
    resetWritingInput();

    if (hackerBoss) {
      hackerBoss.removeAttribute("animation");
      setTimeout(() => {
        hackerBoss.setAttribute("animation", "property: position; to: 0 1 -2; dur: 45000; easing: linear");
      }, 50);
    }

    startTimer(clamp(getBaseTimeForMissionType("writing") + timeMod, 18, 80));
  }
}

window.checkChoiceAnswer = function (selectedLetter) {
  if (state.isGameOver || !state.currentMission) return;
  const isChoiceMission = state.currentMission.type === "reading" || state.currentMission.type === "listening";
  if (!isChoiceMission || !Array.isArray(state.currentMission.choices) || !state.currentMission.answer) return;
  const correctChoiceStr = state.currentMission.choices.find(c => typeof c === "string" && c.startsWith(state.currentMission.answer));
  if (!correctChoiceStr) return;
  if (correctChoiceStr.startsWith(selectedLetter)) winMission();
  else takeDamage();
};

window.checkWritingAnswer = function () {
  if (state.isGameOver || !state.currentMission) return;
  const answer = $("write-input")?.value.toLowerCase() || "";
  const matchedKeywords = state.currentMission.keywords.filter(kw => answer.includes(kw));
  if (matchedKeywords.length >= state.currentMission.minMatch) winMission();
  else {
    setFeedback(state.currentMission.failMsg, "#ff4757");
    takeDamage();
  }
};

window.playAudio = function () {
  if (state.isGameOver || !state.currentMission) return;
  if ("speechSynthesis" in window) {
    const utterance = new SpeechSynthesisUtterance(state.currentMission.audioText);
    utterance.lang = "en-US";
    utterance.rate = state.gameDifficulty === "hard" ? 1.0 : 0.9;
    speechSynthesis.speak(utterance);
    setFeedback("🔊 กำลังฟัง...", "#00e5ff");
  }
};

window.startRecognition = function () {
  if (state.isGameOver || !state.currentMission) return;
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    setFeedback("⚠️ เบราว์เซอร์ไม่รองรับไมค์", "#ff9f43");
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.interimResults = true;

  $("btn-speak").disabled = true;
  setFeedback("🎙️ กำลังฟัง...", "#00e5ff");

  recognition.onresult = (event) => {
    let currentTranscript = "";
    let isFinal = false;

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      currentTranscript += event.results[i][0].transcript;
      if (event.results[i].isFinal) isFinal = true;
    }

    let text = currentTranscript.toLowerCase()
      .replace(/i'm/g, "i am")
      .replace(/it's/g, "it is")
      .replace(/we're/g, "we are")
      .replace(/[.,!?]/g, "");

    let targetWords = state.currentMission.exactPhrase.split(" ");
    let matchCount = 0;

    targetWords.forEach(word => {
      if (new RegExp(`\\b${word}\\b`, "i").test(text)) matchCount++;
    });

    let allowance = getAdaptiveSpeakAllowance();
    let passThreshold = Math.max(1, targetWords.length - allowance);
    let isMatch = matchCount >= passThreshold;

    setFeedback(`กำลังฟัง: ${matchCount}/${targetWords.length}`, "#f1c40f");

    if (isMatch) {
      recognition.stop();
      winMission();
    } else if (isFinal) {
      setFeedback(`❌ ${state.currentMission.failMsg}`, "#ff4757");
      takeDamage();
      $("btn-speak").disabled = false;
    }
  };

  recognition.onend = () => {
    if (!state.isGameOver && $("mission-speaking-scene")?.getAttribute("visible") === "true") {
      $("btn-speak").disabled = false;
      if (($("feedback")?.innerText || "").includes("กำลังฟัง")) {
        setFeedback("⚠️ ไมค์ตัด ลองใหม่อีกครั้ง", "#ff4757");
      }
    }
  };

  recognition.onerror = (event) => {
    if (event.error === "no-speech") {
      setFeedback("⚠️ ไม่ได้ยินเสียง", "#ff4757");
    } else if (event.error === "not-allowed") {
      setFeedback("⚠️ ยังไม่ได้อนุญาตไมค์", "#ff4757");
    } else {
      setFeedback(`⚠️ ไมค์ผิดพลาด (${event.error})`, "#ff4757");
    }
    $("btn-speak").disabled = false;
  };

  recognition.start();
};

window.addEventListener("keydown", function (e) {
  if (state.isGameOver || !state.currentMission) return;
  if (
    document.activeElement === $("write-input") ||
    document.activeElement === $("player-name-input") ||
    document.activeElement === $("profile-name-input")
  ) return;

  if (state.currentMission.type === "reading" || state.currentMission.type === "listening") {
    const key = e.key.toUpperCase();
    if (key === "A" || key === "B" || key === "C") window.checkChoiceAnswer(key);
  }
});

window.submitScore = async function () {
  const nameInput = $("player-name-input");
  const typedName = nameInput.value.trim();
  const name = typedName || playerProfile.name || "Unknown Dev";
  if (!typedName && nameInput) nameInput.value = name;

  if (!state.currentUser || !state.db) {
    setFeedback("❌ เชื่อมต่อฐานข้อมูลไม่ได้", "#ff4757");
    return;
  }

  const btn = $("btn-submit-score");
  btn.disabled = true;
  btn.innerText = "Saving...";

  try {
    playerProfile.name = name.slice(0, 24);
    syncProfileUI();

    const profileRef = ref(state.db, ["artifacts", state.appId, "users", state.currentUser.uid, "profile", "main"].join("/"));
    await set(profileRef, {
      name: playerProfile.name,
      avatar: playerProfile.avatar || "🧑‍💻",
      updatedAt: Date.now()
    });

    const scoreRef = ref(state.db, ["artifacts", state.appId, "public", "data", "vr_leaderboards", state.currentUser.uid].join("/"));
    const snap = await get(scoreRef);
    const oldData = snap.exists() ? snap.val() : null;
    const oldBest = oldData && typeof oldData.score === "number" ? oldData.score : 0;
    const bestScore = Math.max(oldBest, state.gameScore);

    await set(scoreRef, {
      name,
      avatar: playerProfile.avatar || "🧑‍💻",
      score: bestScore,
      timestamp: Date.now(),
      userId: state.currentUser.uid
    });

    setFeedback(
      state.gameScore > oldBest
        ? `✅ New High Score ${bestScore}`
        : `✅ บันทึกชื่อเรียบร้อยแล้ว`,
      "#2ed573"
    );

    hide("game-over-ui");
  } catch (e) {
    console.error("Error saving score (RTDB):", e);
    setFeedback("❌ บันทึกคะแนนไม่สำเร็จ", "#ff4757");
    btn.disabled = false;
    btn.innerText = "Save Score";
  }
};

function getMissionTypeFXLabel(type, success = true) {
  const map = {
    speaking: success ? "VOICE LOCKED IN" : "VOICE LOST",
    reading: success ? "READING BOOST" : "READING ERROR",
    listening: success ? "LISTEN LOCK" : "MISHEARD",
    writing: success ? "CODE PATCHED" : "SYNTAX FAIL"
  };
  return map[type] || (success ? "SUCCESS" : "FAIL");
}

function flashMissionTypeTag(type, success = true) {
  const tag = $("mission-type-tag");
  if (!tag) return;
  tag.textContent = getMissionTypeFXLabel(type, success);
  tag.style.color = success ? "#2ed573" : "#ff6b81";
  tag.style.borderColor = success ? "rgba(46,213,115,0.35)" : "rgba(255,107,129,0.35)";
  tag.classList.remove("show");
  void tag.offsetWidth;
  tag.classList.add("show");
  clearTimeout(flashMissionTypeTag._timer);
  flashMissionTypeTag._timer = setTimeout(() => tag.classList.remove("show"), 940);
}

function spawnAnswerBurst(success = true, count = 8) {
  const layer = $("answer-fx-layer");
  if (!layer) return;

  for (let i = 0; i < count; i++) {
    const dot = document.createElement("div");
    dot.className = "answer-burst " + (success ? "success" : "fail");
    const angle = (Math.PI * 2 * i) / count;
    const distance = success ? 70 + (i % 3) * 20 : 55 + (i % 2) * 18;
    const dx = Math.round(Math.cos(angle) * distance) + "px";
    const dy = Math.round(Math.sin(angle) * distance) + "px";
    dot.style.setProperty("--dx", dx);
    dot.style.setProperty("--dy", dy);
    layer.appendChild(dot);
    setTimeout(() => dot.remove(), success ? 760 : 660);
  }
}

function flashScreenResult(success = true) {
  const ui = $("ui-container");
  if (!ui) return;
  ui.classList.remove("screen-glow-success", "screen-glow-fail");
  void ui.offsetWidth;
  ui.classList.add(success ? "screen-glow-success" : "screen-glow-fail");
  setTimeout(() => ui.classList.remove("screen-glow-success", "screen-glow-fail"), 460);
}

function showComboPopup() {
  if (state.comboCount < 2) return;
  const popup = $("combo-popup");
  if (!popup) return;
  popup.textContent = state.comboCount >= 5 ? `🔥 PERFECT x${state.comboCount}` : `⚡ COMBO x${state.comboCount}`;
  popup.classList.remove("show");
  void popup.offsetWidth;
  popup.classList.add("show");
  clearTimeout(showComboPopup._timer);
  showComboPopup._timer = setTimeout(() => popup.classList.remove("show"), 920);
}

function playAnswerFX(success = true) {
  const burstCount = success ? Math.min(12, 6 + state.comboCount) : 7;
  spawnAnswerBurst(success, burstCount);
  flashScreenResult(success);
  flashMissionTypeTag(state.currentMission?.type || "generic", success);
  if (success) showComboPopup();
}

function showVRFeedback(isSuccess, customText = null) {
  const fx = $("vr-feedback-fx");
  const textEl = $("vr-feedback-text");
  if (!fx || !textEl) return;

  fx.setAttribute("visible", "true");
  fx.removeAttribute("animation");

  if (isSuccess) {
    textEl.setAttribute("value", customText || getMissionTypeFXLabel(state.currentMission?.type, true));
    textEl.setAttribute("color", "#2ed573");
  } else {
    textEl.setAttribute("value", customText || getMissionTypeFXLabel(state.currentMission?.type, false));
    textEl.setAttribute("color", "#ff4757");
  }

  fx.setAttribute("animation", "property: position; from: 0 2.5 -2.5; to: 0 3.2 -2.5; dur: 800; easing: easeOutQuad");
  setTimeout(() => fx.setAttribute("visible", "false"), 800);
}

function playSFX(type) {
  if (audioCtx.state === "suspended") audioCtx.resume();
  const masterGain = audioCtx.createGain();
  masterGain.connect(audioCtx.destination);

  if (type === "win") {
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime + (i * 0.06));
      osc.connect(masterGain);
      osc.start(audioCtx.currentTime + (i * 0.06));
      osc.stop(audioCtx.currentTime + 0.22 + (i * 0.06));
    });
    masterGain.gain.setValueAtTime(0.18, audioCtx.currentTime);
    masterGain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
  } else if (type === "fail") {
    const osc = audioCtx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(220, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, audioCtx.currentTime + 0.25);
    osc.connect(masterGain);
    masterGain.gain.setValueAtTime(0.20, audioCtx.currentTime);
    masterGain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.28);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.28);
  } else if (type === "bossIntro") {
    [164.81, 220.0, 329.63].forEach((freq, idx) => {
      const osc = audioCtx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime + (idx * 0.05));
      osc.frequency.exponentialRampToValueAtTime(freq * 1.9, audioCtx.currentTime + 0.55 + (idx * 0.05));
      osc.connect(masterGain);
      osc.start(audioCtx.currentTime + (idx * 0.05));
      osc.stop(audioCtx.currentTime + 0.75 + (idx * 0.05));
    });
    masterGain.gain.setValueAtTime(0.22, audioCtx.currentTime);
    masterGain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.8);
  } else if (type === "bossHit") {
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
      `Outcome: FAIL`,
      `Mission Gain: ${getMissionRunGain()}`
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

  state.missionTimer = setInterval(() => {
    setTimerText(state.timeLeft);

    if (state.timeLeft <= 0) {
      clearInterval(state.missionTimer);
      setText("timer", "00:00 - TIME UP!");
      onMissionFailForAI("timeout");
      state.systemHP = 0;
      takeDamage();
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

    setFeedback(`⚔️ BOSS HIT! HP ${finalBossState.hp}/${finalBossState.maxHp}`, "#f1c40f");
    hideAllScenesAndControls();

    setTimeout(() => {
      if (!state.isGameOver) loadMission(state.currentMission.id);
    }, 900);
    return;
  }

  let timeBonus = state.timeLeft * 10;
  let actualHeal = 0;
  if (state.systemHP < 100) {
    let healAmount = state.gameDifficulty === "easy" ? 20 : (state.gameDifficulty === "normal" ? 10 : 5);
    actualHeal = Math.min(100 - state.systemHP, healAmount);
    state.systemHP += actualHeal;
  }

  let bossMultiplier = (state.currentMission && state.currentMission.id % 3 === 0) ? 2 : 1;
  let finalUnitBonus = (state.currentMission && isUnitFinal(state.currentMission.id))
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

  const finalUnitText = (state.currentMission && isUnitFinal(state.currentMission.id))
    ? " • UNIT CLEAR"
    : "";

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
    `Time Bonus: +${timeBonus}`,
    `Mission Gain: +${getMissionRunGain()}`
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

  setScoreHUD(state.gameScore, state.systemHP, state.comboCount);

  if (state.comboCount > sessionStats.bestCombo) {
    sessionStats.bestCombo = state.comboCount;
    saveSessionStats();
    renderHubStatsBoard();
  }
}

function hideAllScenesAndControls() {
  hideAllMissionControlsUI();
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

  setTitleBlock("TECHPATH VR: MAIN HUB", "เลือกภารกิจต่อไปได้เลย", "#00e5ff");
  applyUnitTheme(0);
  hide("btn-next");
  hide("btn-return");
  setFeedback("", "#ffffff");
  resetSummaryPanel();
  renderHubStatsBoard();
  state.currentMission = null;
  renderQuestionDiffBadge(state.gameDifficulty);
};

window.onload = function () {
  setHudMode("hub");
  generateMissionWall();
  window.setDifficulty("normal");
  syncProfileUI();
  renderAIDirector();
  renderFinalBossUI();
  renderHubStatsBoard();
  renderQuestionDiffBadge("normal");
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
};
