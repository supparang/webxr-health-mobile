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
  recordMissionFail
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
  setScoreHUD,
  setMissionPrompt,
  clearMissionPrompt,
  scheduleFeedbackClear,
  cancelFeedbackClear,
  scheduleMissionHeaderCollapse,
  expandMissionHeader,
  scheduleMissionStatsCollapse,
  expandMissionStats,
  scheduleMissionPromptChromeCollapse,
  expandMissionPromptChrome,
  scheduleBossChromeCollapse,
  expandBossChrome,
  scheduleMissionTopChipsCollapse,
  expandMissionTopChips,
  scheduleMissionTitleUltraMini,
  expandMissionTitleUltraMini,
  scheduleMissionTimerCompact,
  expandMissionTimer,
  setMissionTimerAlert,
  scheduleMissionHudTextCompact,
  expandMissionHudTextCompact,
  togglePromptFocusExpanded,
  resetPromptFocusExpanded
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
  if (isFinal) return `FINAL • ${diff} • ${finalBossState.hp}/${finalBossState.maxHp}`;
  return `${shortMissionType(currentMission?.type)} • ${diff}`;
}

function minimalWinFeedback(timeBonus, finalUnitText = "", levelUpMsg = "") {
  return `✅ CLEAR! +${1000 + timeBonus} PTS${finalUnitText}${levelUpMsg}`;
}

function minimalFailFeedback(damageAmount, levelDownMsg = "") {
  return `❌ SYSTEM HP -${damageAmount}%${levelDownMsg}`;
}

function clipMissionTitle(text = "", max = 18) {
  const s = String(text || "").trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function getMissionTypeMeta(type = "") {
  if (type === "speaking") return { icon: "🎤", color: "#2ed573", short: "SPEAK" };
  if (type === "reading") return { icon: "📘", color: "#4dabf7", short: "READ" };
  if (type === "listening") return { icon: "🎧", color: "#ffa94d", short: "LISTEN" };
  if (type === "writing") return { icon: "⌨️", color: "#b197fc", short: "WRITE" };
  return { icon: "✨", color: "#7bedff", short: "MISSION" };
}

function getMissionWallMeta(mGroup, cleared = false) {
  const typeMeta = getMissionTypeMeta(mGroup?.type);
  const isBoss = (mGroup?.id % 3 === 0);
  const isFinal = isUnitFinal(mGroup?.id);

  const baseColor = isFinal
    ? "#f1c40f"
    : isBoss
      ? "#ff6b81"
      : typeMeta.color;

  const plateColor = isFinal
    ? "#2b2408"
    : isBoss
      ? "#2a0f18"
      : "#0f172a";

  const subtitle = isFinal ? "FINAL" : (isBoss ? "BOSS" : typeMeta.short);
  const icon = isFinal ? "👑" : (isBoss ? "⚡" : typeMeta.icon);

  const width = isFinal ? 1.56 : (isBoss ? 1.44 : 1.18);
  const height = isFinal ? 0.92 : (isBoss ? 0.82 : 0.68);
  const haloOpacity = cleared ? 0.28 : (isFinal ? 0.16 : (isBoss ? 0.13 : 0.11));
  const boxOpacity = cleared ? 1 : 0.92;

  const title = clipMissionTitle(mGroup?.title || `Session ${mGroup?.id}`, isFinal ? 16 : 18);
  const labelTop = `${cleared ? "✅ " : ""}${icon} S${mGroup?.id}`;
  const labelBottom = title;
  const labelTag = subtitle;

  return {
    isBoss,
    isFinal,
    baseColor,
    plateColor,
    subtitle,
    icon,
    width,
    height,
    haloOpacity,
    boxOpacity,
    labelTop,
    labelBottom,
    labelTag
  };
}

function applyMissionWallAmbientFX(root, halo, box, meta) {
  if (!root || !halo || !box || !meta) return;

  root.removeAttribute("animation__float");
  halo.removeAttribute("animation__halo");
  box.removeAttribute("animation__idle");

  const floatToY = meta.isFinal ? 0.028 : (meta.isBoss ? 0.022 : 0.016);
  const floatDur = meta.isFinal ? 2100 : (meta.isBoss ? 2300 : 2500);

  root.setAttribute(
    "animation__float",
    `property: position; dir: alternate; dur: ${floatDur}; loop: true; to: 0 ${floatToY} 0; easing: easeInOutSine`
  );

  halo.setAttribute(
    "animation__halo",
    `property: material.opacity; dir: alternate; dur: ${meta.isFinal ? 900 : 1200}; loop: true; to: ${meta.isFinal ? 0.26 : 0.18}; easing: easeInOutSine`
  );

  if (meta.isBoss || meta.isFinal) {
    box.setAttribute(
      "animation__idle",
      `property: rotation; dir: alternate; dur: ${meta.isFinal ? 2600 : 3200}; loop: true; to: 0 0 ${meta.isFinal ? 2.2 : 1.4}; easing: easeInOutSine`
    );
  }
}

function applyMissionWallHoverFX(root, halo, box, meta, hovered = false) {
  if (!root || !halo || !box || !meta) return;

  root.removeAttribute("animation__hoverScale");
  halo.removeAttribute("animation__hoverGlow");
  box.removeAttribute("animation__hoverDepth");

  if (!hovered) {
    root.setAttribute("scale", "1 1 1");
    box.setAttribute("position", "0 0 0");
    return;
  }

  root.setAttribute(
    "animation__hoverScale",
    "property: scale; dur: 140; to: 1.08 1.08 1.08; easing: easeOutQuad"
  );

  halo.setAttribute(
    "animation__hoverGlow",
    `property: material.opacity; dur: 140; to: ${meta.isFinal ? 0.34 : 0.28}; easing: easeOutQuad`
  );

  box.setAttribute(
    "animation__hoverDepth",
    "property: position; dur: 140; to: 0 0 0.018; easing: easeOutQuad"
  );
}

function applyMissionWallClearedFX(root, halo, box, meta, cleared = false) {
  if (!root || !halo || !box || !meta) return;

  halo.removeAttribute("animation__clearedPulse");
  box.removeAttribute("animation__clearedPulse");

  if (!cleared) return;

  halo.setAttribute(
    "animation__clearedPulse",
    `property: scale; dir: alternate; dur: ${meta.isFinal ? 700 : 900}; loop: true; to: 1.05 1.05 1.05; easing: easeInOutSine`
  );

  box.setAttribute(
    "animation__clearedPulse",
    `property: material.emissiveIntensity; dir: alternate; dur: ${meta.isFinal ? 700 : 900}; loop: true; to: ${meta.isFinal ? 0.95 : 0.58}; easing: easeInOutSine`
  );
}

function setMissionWallVisualState(mGroup, opts = {}) {
  const { cleared = false, hovered = false } = opts;
  const meta = getMissionWallMeta(mGroup, cleared);

  const plate = document.getElementById(`mission-plate-${mGroup.id}`);
  const halo = document.getElementById(`mission-halo-${mGroup.id}`);
  const box = document.getElementById(`mission-box-${mGroup.id}`);
  const textTop = document.getElementById(`mission-text-top-${mGroup.id}`);
  const textBottom = document.getElementById(`mission-text-bottom-${mGroup.id}`);
  const tag = document.getElementById(`mission-tag-${mGroup.id}`);
  const root = document.getElementById(`mission-root-${mGroup.id}`);

  if (!plate || !halo || !box || !textTop || !textBottom || !tag || !root) return;

  const activeColor = hovered ? "#7bedff" : meta.baseColor;
  const activeScale = hovered ? "1.08 1.08 1.08" : (cleared ? "1.02 1.02 1.02" : "1 1 1");

  plate.setAttribute("color", meta.plateColor);
  plate.setAttribute("material", `opacity: ${hovered ? 0.98 : 0.88}; shader: flat`);
  plate.setAttribute("width", meta.width + 0.26);
  plate.setAttribute("height", meta.height + 0.26);

  halo.setAttribute("color", activeColor);
  halo.setAttribute(
    "material",
    `opacity: ${hovered ? Math.min(meta.haloOpacity + 0.10, 0.36) : meta.haloOpacity}; shader: flat`
  );
  halo.setAttribute("width", meta.width + (hovered ? 0.42 : 0.34));
  halo.setAttribute("height", meta.height + (hovered ? 0.42 : 0.34));

  box.setAttribute("color", activeColor);
  box.setAttribute("width", meta.width);
  box.setAttribute("height", meta.height);
  box.setAttribute(
    "material",
    `opacity: ${meta.boxOpacity}; metalness: 0.18; roughness: 0.56; emissive: ${activeColor}; emissiveIntensity: ${hovered ? 0.48 : (cleared ? 0.36 : 0.18)}`
  );

  root.setAttribute("scale", activeScale);

  textTop.setAttribute("value", meta.labelTop);
  textTop.setAttribute("color", hovered ? "#ffffff" : activeColor);

  textBottom.setAttribute("value", meta.labelBottom);
  textBottom.setAttribute("color", "#ffffff");

  tag.setAttribute("value", meta.labelTag);
  tag.setAttribute("color", hovered ? "#ffffff" : activeColor);

  applyMissionWallAmbientFX(root, halo, box, meta);
  applyMissionWallHoverFX(root, halo, box, meta, hovered);
  applyMissionWallClearedFX(root, halo, box, meta, cleared);
}

function refreshMissionWallProgress() {
  missionDB.forEach((mGroup) => {
    const cleared = clearedMissions.includes(mGroup.id);
    setMissionWallVisualState(mGroup, { cleared, hovered: false });
  });
  syncProfileUI();
}

function getRewardChestNodes() {
  return {
    root: $("reward-chest"),
    panel: $("reward-card-panel"),
    frame: $("reward-card-frame"),
    aura: $("reward-aura"),
    body: $("reward-chest-body"),
    lid: $("reward-chest-lid"),
    text: $("streak-text")
  };
}

function clearRewardChestFX() {
  const n = getRewardChestNodes();
  if (!n.root) return;
  n.root.removeAttribute("animation__float");
  n.root.removeAttribute("animation__claim");
  n.aura?.removeAttribute("animation__pulse");
  n.aura?.removeAttribute("animation__claim");
  n.lid?.removeAttribute("animation__gleam");
  n.frame?.removeAttribute("animation__frame");
}

function setRewardChestState(mode = "idle", opts = {}) {
  const { streak = 0, rarityColor = "#ffeaa7", note = "" } = opts;
  const n = getRewardChestNodes();
  if (!n.root || !n.text) return;

  clearRewardChestFX();
  const safeNote = note ? `\n${note}` : "";
  n.root.classList.remove("clickable");

  if (mode === "loading") {
    n.panel?.setAttribute("color", "#0f172a");
    n.frame?.setAttribute("color", "#7bedff");
    n.frame?.setAttribute("material", "wireframe: true; opacity: 0.26");
    n.aura?.setAttribute("color", "#7bedff");
    n.aura?.setAttribute("material", "opacity: 0.10; shader: flat");
    n.body?.setAttribute("color", "#8c6239");
    n.lid?.setAttribute("color", "#8fa7b3");
    n.text.setAttribute("value", "Loading...");
    n.text.setAttribute("color", "#ffffff");
    n.root.setAttribute("animation__float", "property: position; dir: alternate; dur: 1800; loop: true; to: -3.72 0.77 -3.08; easing: easeInOutSine");
    return;
  }

  if (mode === "claimable") {
    n.root.classList.add("clickable");
    n.panel?.setAttribute("color", "#101826");
    n.frame?.setAttribute("color", "#ffeaa7");
    n.frame?.setAttribute("material", "wireframe: true; opacity: 0.44");
    n.aura?.setAttribute("color", "#ffeaa7");
    n.aura?.setAttribute("material", "opacity: 0.20; shader: flat");
    n.body?.setAttribute("color", "#8c6239");
    n.lid?.setAttribute("color", "#f1c40f");
    n.text.setAttribute("value", `Streak: ${streak} Days${safeNote || "\nTap to Claim"}`);
    n.text.setAttribute("color", "#ffffff");
    n.root.setAttribute("animation__float", "property: position; dir: alternate; dur: 1050; loop: true; to: -3.72 0.82 -3.08; easing: easeInOutSine");
    n.aura?.setAttribute("animation__pulse", "property: material.opacity; dir: alternate; dur: 800; loop: true; from: 0.14; to: 0.30; easing: easeInOutSine");
    n.lid?.setAttribute("animation__gleam", "property: rotation; dir: alternate; dur: 1200; loop: true; to: 0 0 3; easing: easeInOutSine");
    n.frame?.setAttribute("animation__frame", "property: material.opacity; dir: alternate; dur: 900; loop: true; from: 0.26; to: 0.52; easing: easeInOutSine");
    return;
  }

  if (mode === "claimed") {
    n.panel?.setAttribute("color", "#101826");
    n.frame?.setAttribute("color", rarityColor);
    n.frame?.setAttribute("material", "wireframe: true; opacity: 0.34");
    n.aura?.setAttribute("color", rarityColor);
    n.aura?.setAttribute("material", "opacity: 0.18; shader: flat");
    n.body?.setAttribute("color", "#8c6239");
    n.lid?.setAttribute("color", rarityColor);
    n.text.setAttribute("value", `Streak: ${streak} Days${safeNote || "\nClaimed"}`);
    n.text.setAttribute("color", "#ffffff");
    n.aura?.setAttribute("animation__pulse", "property: material.opacity; dir: alternate; dur: 1600; loop: true; from: 0.10; to: 0.20; easing: easeInOutSine");
    return;
  }

  if (mode === "error") {
    n.panel?.setAttribute("color", "#1b1220");
    n.frame?.setAttribute("color", "#ff6b81");
    n.frame?.setAttribute("material", "wireframe: true; opacity: 0.36");
    n.aura?.setAttribute("color", "#ff6b81");
    n.aura?.setAttribute("material", "opacity: 0.12; shader: flat");
    n.body?.setAttribute("color", "#8c6239");
    n.lid?.setAttribute("color", "#c97a7a");
    n.text.setAttribute("value", note || "Reward Offline");
    n.text.setAttribute("color", "#ffd6db");
    return;
  }

  n.panel?.setAttribute("color", "#0f172a");
  n.frame?.setAttribute("color", "#7bedff");
  n.frame?.setAttribute("material", "wireframe: true; opacity: 0.26");
  n.aura?.setAttribute("color", "#7bedff");
  n.aura?.setAttribute("material", "opacity: 0.10; shader: flat");
  n.body?.setAttribute("color", "#8c6239");
  n.lid?.setAttribute("color", "#8fa7b3");
  n.text.setAttribute("value", `Streak: ${streak} Days${safeNote}`);
  n.text.setAttribute("color", "#ffffff");
}

function playRewardChestClaimFX(rarityColor = "#ffeaa7") {
  const n = getRewardChestNodes();
  if (!n.root) return;

  clearRewardChestFX();
  n.frame?.setAttribute("color", rarityColor);
  n.aura?.setAttribute("color", rarityColor);
  n.lid?.setAttribute("color", rarityColor);
  n.root.setAttribute("animation__claim", "property: scale; dur: 260; dir: alternate; loop: 2; to: 1.08 1.08 1.08; easing: easeOutBack");
  n.aura?.setAttribute("animation__claim", "property: scale; dur: 360; dir: alternate; loop: 2; to: 1.18 1.18 1.18; easing: easeOutQuad");
}

function getLeaderboardNodes() {
  return {
    panel: $("leaderboard-panel"),
    frame: $("leaderboard-frame"),
    header: $("leaderboard-header-panel"),
    title: $("leaderboard-title"),
    subtitle: $("leaderboard-subtitle"),
    list: $("vr-leaderboard-list")
  };
}

function clearLeaderboardFX() {
  const n = getLeaderboardNodes();
  n.frame?.removeAttribute("animation__frame");
  n.panel?.removeAttribute("animation__panel");
}

function setLeaderboardBoardState(mode = "idle") {
  const n = getLeaderboardNodes();
  if (!n.list) return;
  clearLeaderboardFX();

  if (mode === "active") {
    n.panel?.setAttribute("color", "#101826");
    n.frame?.setAttribute("color", "#7bedff");
    n.frame?.setAttribute("material", "wireframe: true; opacity: 0.34");
    n.header?.setAttribute("color", "#152238");
    n.title?.setAttribute("color", "#ffeaa7");
    n.subtitle?.setAttribute("color", "#cbd5e1");
    n.list.setAttribute("color", "#ffffff");
    n.frame?.setAttribute("animation__frame", "property: material.opacity; dir: alternate; dur: 1600; loop: true; from: 0.22; to: 0.36; easing: easeInOutSine");
    return;
  }

  if (mode === "empty") {
    n.panel?.setAttribute("color", "#101826");
    n.frame?.setAttribute("color", "#94a3b8");
    n.frame?.setAttribute("material", "wireframe: true; opacity: 0.22");
    n.header?.setAttribute("color", "#152238");
    n.title?.setAttribute("color", "#dbeafe");
    n.subtitle?.setAttribute("color", "#94a3b8");
    n.list.setAttribute("color", "#dbeafe");
    return;
  }

  if (mode === "error") {
    n.panel?.setAttribute("color", "#1b1220");
    n.frame?.setAttribute("color", "#ff6b81");
    n.frame?.setAttribute("material", "wireframe: true; opacity: 0.34");
    n.header?.setAttribute("color", "#26151d");
    n.title?.setAttribute("color", "#ffd6db");
    n.subtitle?.setAttribute("color", "#ffb3c1");
    n.list.setAttribute("color", "#ffd6db");
    return;
  }

  n.panel?.setAttribute("color", "#101826");
  n.frame?.setAttribute("color", "#7bedff");
  n.frame?.setAttribute("material", "wireframe: true; opacity: 0.28");
  n.header?.setAttribute("color", "#152238");
  n.title?.setAttribute("color", "#ffeaa7");
  n.subtitle?.setAttribute("color", "#cbd5e1");
  n.list.setAttribute("color", "#ffffff");
}

function setupLeaderboardListener() {
  if (!state.db) {
    setLeaderboardBoardState("error");
    const list = $("vr-leaderboard-list");
    if (list) list.setAttribute("value", "Leaderboard Offline");
    return;
  }

  const lbRef = ref(state.db, ["artifacts", state.appId, "public", "data", "vr_leaderboards"].join("/"));

  onValue(lbRef, (snapshot) => {
    let scores = [];
    if (snapshot.exists()) {
      const val = snapshot.val() || {};
      scores = Object.values(val);
    }

    scores.sort((a, b) => (b.score || 0) - (a.score || 0));
    const top5 = scores.slice(0, 5);

    const lbList = $("vr-leaderboard-list");
    if (!lbList) return;

    if (!top5.length) {
      setLeaderboardBoardState("empty");
      lbList.setAttribute("value", "No clears yet\nBe the first legend!");
      return;
    }

    let lbText = "";
    top5.forEach((entry, i) => {
      const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "•";
      const avatar = typeof entry.avatar === "string" ? entry.avatar : "🧑‍💻";
      const safeName = String(entry.name || "Hero").substring(0, 10);
      lbText += `${medal} ${avatar} ${safeName}  ${entry.score}\n`;
    });

    lbList.setAttribute("value", lbText.trim());
    setLeaderboardBoardState("active");
  }, (error) => {
    console.error("RTDB leaderboard listener error:", error);
    const lbList = $("vr-leaderboard-list");
    if (lbList) lbList.setAttribute("value", "Leaderboard Offline");
    setLeaderboardBoardState("error");
  });
}

async function bootFirebase() {
  try {
    const runtime = await initFirebaseRuntime();

    if (!runtime || !runtime.auth || !runtime.db) {
      console.warn("Firebase runtime not ready:", runtime);
      syncProfileUI();
      setRewardChestState("error", { note: "Reward Offline" });
      setLeaderboardBoardState("error");
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
    setRewardChestState("error", { note: "Reward Offline" });
    setLeaderboardBoardState("error");
  }
}

window.checkDailyStreak = async function () {
  if (!state.currentUser || !state.db) {
    setRewardChestState("error", { note: "Reward Offline" });
    return;
  }

  const rewardRef = ref(state.db, ["artifacts", state.appId, "users", state.currentUser.uid, "player_stats", "reward"].join("/"));

  try {
    setRewardChestState("loading");

    const snap = await get(rewardRef);
    const rewardData = snap.exists() ? (snap.val() || {}) : {};
    const streak = rewardData.streak || 0;
    const lastLogin = rewardData.lastLogin || "";

    state.currentRewardStreak = streak;
    syncProfileUI();

    const today = new Date().toDateString();

    if (lastLogin === today) {
      setRewardChestState("claimed", {
        streak,
        rarityColor: "#7bedff",
        note: "Claimed Today"
      });
    } else {
      setRewardChestState("claimable", {
        streak,
        note: "Tap to Claim"
      });
    }
  } catch (e) {
    console.error("Error checking streak (RTDB):", e);
    setRewardChestState("error", { note: "Reward Offline" });
  }
};

window.claimReward = async function () {
  if (!state.currentUser || !state.db) {
    setFeedback("⚠️ รอเชื่อมต่อเซิร์ฟเวอร์สักครู่...", "#ff9f43");
    setRewardChestState("error", { note: "Reward Offline" });
    return;
  }

  const rewardRef = ref(state.db, ["artifacts", state.appId, "users", state.currentUser.uid, "player_stats", "reward"].join("/"));

  try {
    setRewardChestState("loading");

    const snap = await get(rewardRef);
    const rewardData = snap.exists() ? (snap.val() || {}) : {};
    let streak = rewardData.streak || 0;
    const lastLogin = rewardData.lastLogin || "";

    const today = new Date().toDateString();
    if (lastLogin === today) {
      setFeedback("🎁 วันนี้รับรางวัลไปแล้ว", "#ffeaa7");
      setRewardChestState("claimed", {
        streak,
        rarityColor: "#7bedff",
        note: "Claimed Today"
      });
      return;
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    streak = (lastLogin === yesterday.toDateString()) ? streak + 1 : 1;

    await set(rewardRef, { lastLogin: today, streak });

    state.currentRewardStreak = streak;
    const rarity = getChestRarity(streak);
    const rarityColor = rarity?.color || "#ffeaa7";
    const streakBonus = streak * 200;
    const bonus = (rarity?.bonus || 0) + streakBonus;

    playSFX("win");
    updateHUD(bonus);
    showVRFeedback(true, `+${bonus} REWARD!`);
    showRewardBadge(rarity.name, rarityColor);
    playRewardChestClaimFX(rarityColor);

    setRewardChestState("claimed", {
      streak,
      rarityColor,
      note: rarity?.name || "Claimed"
    });

    syncProfileUI();
    setFeedback(`🎁 ${rarity.name} CHEST +${bonus}`, rarityColor);
    scheduleFeedbackClear(1600);
  } catch (e) {
    console.error("Error claiming reward (RTDB):", e);
    setRewardChestState("error", { note: "Claim Failed" });
    setFeedback("❌ เกิดข้อผิดพลาดในการรับรางวัล", "#ff4757");
  }
};

function generateMissionWall() {
  const wall = $("mission-wall");
  if (!wall) return;

  wall.innerHTML = "";
  let index = 0;

  for (let row = 0; row < 3; row++) {
    const rowY = 1.22 - (row * 0.84);
    const rowRadius = 4.1 + (row * 0.16);

    for (let col = 0; col < 5; col++) {
      if (index >= missionDB.length) break;

      const mGroup = missionDB[index];
      const meta = getMissionWallMeta(mGroup, false);
      const angle = (col - 2) * 14;
      const rad = angle * Math.PI / 180;
      const xPos = Math.sin(rad) * rowRadius;
      const zPos = -Math.cos(rad) * rowRadius + 4.1;

      const root = document.createElement("a-entity");
      root.setAttribute("id", `mission-root-${mGroup.id}`);
      root.setAttribute("position", `${xPos} ${rowY} ${zPos}`);
      root.setAttribute("rotation", `0 ${-angle} 0`);

      const halo = document.createElement("a-plane");
      halo.setAttribute("id", `mission-halo-${mGroup.id}`);
      halo.setAttribute("position", "0 0 -0.04");
      halo.setAttribute("width", meta.width + 0.34);
      halo.setAttribute("height", meta.height + 0.34);
      halo.setAttribute("color", meta.baseColor);
      halo.setAttribute("material", `opacity: ${meta.haloOpacity}; shader: flat`);

      const plate = document.createElement("a-plane");
      plate.setAttribute("id", `mission-plate-${mGroup.id}`);
      plate.setAttribute("position", "0 0 -0.02");
      plate.setAttribute("width", meta.width + 0.26);
      plate.setAttribute("height", meta.height + 0.26);
      plate.setAttribute("color", meta.plateColor);
      plate.setAttribute("material", "opacity: 0.88; shader: flat");

      const border = document.createElement("a-plane");
      border.setAttribute("position", "0 0 0.032");
      border.setAttribute("width", meta.width + 0.08);
      border.setAttribute("height", meta.height + 0.08);
      border.setAttribute("color", meta.baseColor);
      border.setAttribute("material", "opacity: 0.20; shader: flat");

      const box = document.createElement("a-box");
      box.setAttribute("id", `mission-box-${mGroup.id}`);
      box.setAttribute("class", "clickable");
      box.setAttribute("width", meta.width);
      box.setAttribute("height", meta.height);
      box.setAttribute("depth", "0.08");
      box.setAttribute("color", meta.baseColor);
      box.setAttribute(
        "material",
        `opacity: ${meta.boxOpacity}; metalness: 0.18; roughness: 0.56; emissive: ${meta.baseColor}; emissiveIntensity: 0.18`
      );

      const textTop = document.createElement("a-text");
      textTop.setAttribute("id", `mission-text-top-${mGroup.id}`);
      textTop.setAttribute("value", meta.labelTop);
      textTop.setAttribute("align", "center");
      textTop.setAttribute("position", `0 ${meta.height * 0.18} 0.05`);
      textTop.setAttribute("scale", "0.42 0.42 0.42");
      textTop.setAttribute("color", meta.baseColor);
      textTop.setAttribute("width", "4");

      const textBottom = document.createElement("a-text");
      textBottom.setAttribute("id", `mission-text-bottom-${mGroup.id}`);
      textBottom.setAttribute("value", meta.labelBottom);
      textBottom.setAttribute("align", "center");
      textBottom.setAttribute("position", `0 ${-meta.height * 0.08} 0.05`);
      textBottom.setAttribute("scale", "0.34 0.34 0.34");
      textBottom.setAttribute("color", "#ffffff");
      textBottom.setAttribute("width", "4.6");

      const tag = document.createElement("a-text");
      tag.setAttribute("id", `mission-tag-${mGroup.id}`);
      tag.setAttribute("value", meta.labelTag);
      tag.setAttribute("align", "center");
      tag.setAttribute("position", `0 ${-meta.height * 0.34} 0.05`);
      tag.setAttribute("scale", "0.26 0.26 0.26");
      tag.setAttribute("color", meta.baseColor);
      tag.setAttribute("width", "4");

      box.addEventListener("mouseenter", () => {
        setMissionWallVisualState(mGroup, {
          cleared: clearedMissions.includes(mGroup.id),
          hovered: true
        });
      });

      box.addEventListener("mouseleave", () => {
        setMissionWallVisualState(mGroup, {
          cleared: clearedMissions.includes(mGroup.id),
          hovered: false
        });
      });

      box.addEventListener("click", () => loadMission(mGroup.id));

      root.appendChild(halo);
      root.appendChild(plate);
      root.appendChild(border);
      root.appendChild(box);
      root.appendChild(textTop);
      root.appendChild(textBottom);
      root.appendChild(tag);

      if (meta.isFinal) {
        const crown = document.createElement("a-text");
        crown.setAttribute("value", "👑");
        crown.setAttribute("align", "center");
        crown.setAttribute("position", `0 ${meta.height * 0.62} 0.05`);
        crown.setAttribute("scale", "0.52 0.52 0.52");
        crown.setAttribute("color", "#ffeaa7");
        root.appendChild(crown);
      } else if (meta.isBoss) {
        const spark = document.createElement("a-text");
        spark.setAttribute("value", "⚡");
        spark.setAttribute("align", "center");
        spark.setAttribute("position", `0 ${meta.height * 0.60} 0.05`);
        spark.setAttribute("scale", "0.44 0.44 0.44");
        spark.setAttribute("color", "#ff9aa2");
        root.appendChild(spark);
      }

      applyMissionWallAmbientFX(root, halo, box, meta);
      wall.appendChild(root);
      index++;
    }
  }

  refreshMissionWallProgress();
}

window.setDifficulty = function (level) {
  updateDifficulty(level);

  $("diff-easy-box")?.setAttribute("material", "opacity", "0.52");
  $("diff-normal-box")?.setAttribute("material", "opacity", "0.52");
  $("diff-hard-box")?.setAttribute("material", "opacity", "0.52");
  $(`diff-${level}-box`)?.setAttribute("material", "opacity", "1");

  renderAIDirector();
  renderQuestionDiffBadge(level);
};

function normalizeWritingText(text = "") {
  return String(text || "")
    .toLowerCase()
    .replace(/i'm/g, "i am")
    .replace(/it's/g, "it is")
    .replace(/we're/g, "we are")
    .replace(/[.,!?;:()"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function analyzeWritingAnswer(mission, answer) {
  const clean = normalizeWritingText(answer);
  const keywords = Array.isArray(mission?.keywords) ? mission.keywords : [];

  const matched = keywords.filter(kw => clean.includes(String(kw).toLowerCase()));
  const missing = keywords.filter(kw => !clean.includes(String(kw).toLowerCase()));

  let needed = Number(mission?.minMatch || 1);
  if (aiDirector.support >= 2 || state.systemHP <= 35 || state.consecutiveLosses >= 2) {
    needed = Math.max(1, needed - 1);
  }

  const coverage = keywords.length ? Math.round((matched.length / keywords.length) * 100) : 0;

  let hint = "";
  if (missing.length > 0) {
    hint = `AI Hint: ลองใส่คำสำคัญ เช่น ${missing.slice(0, 2).join(", ")}`;
  } else {
    hint = "AI Hint: มี keyword ครบแล้ว ลองเขียนให้เป็นประโยคสมบูรณ์ขึ้น";
  }

  return {
    matched,
    missing,
    needed,
    coverage,
    pass: matched.length >= needed,
    hint
  };
}

function getWritingStarter(mission) {
  if (mission?.starter) return mission.starter;

  const title = String(mission?.title || "").toLowerCase();

  if (title.includes("introduce")) return "Starter: My name is ... I study ...";
  if (title.includes("email")) return "Starter: Dear ..., I am writing to ...";
  if (title.includes("opinion")) return "Starter: I think ... because ...";
  if (title.includes("plan")) return "Starter: First, I will ... Then, I will ...";
  if (title.includes("bug")) return "Starter: The bug happens when ...";
  if (title.includes("report")) return "Starter: The problem is ...";
  if (title.includes("goal")) return "Starter: In the future, I want to ...";

  return "Starter: I think ... because ...";
}

function buildWritingCoachPrompt(mission, result) {
  const base = mission?.prompt || "Write your answer";
  const parts = [base];

  if (result?.hint) parts.push(result.hint);
  parts.push(getWritingStarter(mission));

  if (Array.isArray(result?.matched) && result.matched.length) {
    parts.push(`Matched: ${result.matched.join(", ")}`);
  }

  if (Array.isArray(result?.missing) && result.missing.length) {
    parts.push(`Missing: ${result.missing.slice(0, 3).join(", ")}`);
  }

  return parts.join("\n\n");
}

function loadMission(id) {
  const missionGroup = missionDB.find(m => m.id === id);
  if (!missionGroup) return;

  state.currentMission = prepareMissionForBossPattern(missionGroup, aiDirector);
  if (!state.currentMission) {
    setFeedback("⚠️ ยังไม่มีโจทย์สำหรับด่านนี้", "#ff9f43");
    return;
  }

  state.lastMissionId = missionGroup.id;
  state.isGameOver = false;

  const isBoss = (state.currentMission.id % 3 === 0);
  const isFinal = isUnitFinal(state.currentMission.id);

  if (isFinal) ensureFinalBossState(state.currentMission.id);
  else resetFinalBossState();

  setHubVisible(false);
  hideAllScenesAndControls();

  resetSummaryPanel();
  hide("summary-panel");
  hide("game-over-ui");
  hide("btn-next");
  hide("btn-return");
  hide("choice-buttons");
  hide("write-input");
  hide("btn-submit-write");
  hide("btn-play-audio");
  hide("btn-speak");

  setHudMode("mission");
  document.body.classList.remove("summary-mode", "hub-mode");
  document.body.classList.add("mission-mode");
  document.body.dataset.missionType = state.currentMission.type || "";

  renderFinalBossUI();
  applyUnitTheme(state.currentMission.id);
  expandBossChrome();

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

  expandMissionHeader();
  expandMissionStats();
  expandMissionTopChips();
  expandMissionTitleUltraMini();
  expandMissionTimer();
  expandMissionHudTextCompact();
  setMissionTimerAlert(false);

  setFeedback(isFinal ? "👑 FINAL BOSS" : "START!", isFinal ? "#f1c40f" : "#00e5ff");
  scheduleFeedbackClear(document.body.dataset.missionType === "speaking" ? 750 : (isFinal ? 1300 : 850));
  scheduleMissionHeaderCollapse(state.currentMission.type === "speaking" ? 900 : 1200);
  scheduleMissionStatsCollapse(state.currentMission.type === "speaking" ? 950 : 1300);
  scheduleMissionTopChipsCollapse(state.currentMission.type === "speaking" ? 750 : 1050);
  scheduleMissionTitleUltraMini(state.currentMission.type === "speaking" ? 700 : 1150);
  scheduleMissionTimerCompact(state.currentMission.type === "speaking" ? 700 : 1100);
  scheduleMissionHudTextCompact(state.currentMission.type === "speaking" ? 650 : 1000);

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
    showChoiceButtons(false);
    hide("write-input");
    hide("btn-submit-write");
    hide("btn-play-audio");
    setSpeakingPrompt(state.currentMission.title, state.currentMission.exactPhrase);
    setMissionPrompt(`"${state.currentMission.exactPhrase}"`, "SPEAK");
    startTimer(clamp(getBaseTimeForMissionType("speaking") + timeMod, 18, 80));

  } else if (state.currentMission.type === "reading") {
    hide("write-input");
    hide("btn-submit-write");
    hide("btn-play-audio");
    setReadingQuestion(state.currentMission.question);
    setChoiceLabelsFor("reading", state.currentMission.choices);
    setMissionPrompt(state.currentMission.question || "อ่านข้อความแล้วเลือกคำตอบที่ถูกต้อง", "READ");
    showChoiceButtons(true);
    startTimer(clamp(getBaseTimeForMissionType("reading") + timeMod, 18, 80));

  } else if (state.currentMission.type === "listening") {
    hide("write-input");
    hide("btn-submit-write");
    setChoiceLabelsFor("listening", state.currentMission.choices);
    setMissionPrompt("กด Play Audio แล้วเลือกคำตอบ", "LISTEN");
    showChoiceButtons(true);
    startTimer(clamp(getBaseTimeForMissionType("listening") + timeMod, 18, 80));

  } else if (state.currentMission.type === "writing") {
    showChoiceButtons(false);
    hide("btn-play-audio");
    hide("btn-speak");
    setWritingPrompt(state.currentMission.prompt);
    setMissionPrompt(
      `${state.currentMission.prompt || "พิมพ์คำตอบ"}\n\n${getWritingStarter(state.currentMission)}`,
      "WRITE"
    );
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

  expandMissionPromptChrome();
  resetPromptFocusExpanded();
  scheduleMissionPromptChromeCollapse(state.currentMission.type === "speaking" ? 800 : 1100);

  if (isBoss || isFinal) {
    scheduleBossChromeCollapse(state.currentMission.type === "speaking" ? 900 : 1300);
  }
}

window.loadMission = loadMission;

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

  const answer = $("write-input")?.value || "";
  const result = analyzeWritingAnswer(state.currentMission, answer);

  if (result.pass) {
    setFeedback(
      `✍️ ${result.coverage}% • ${result.matched.length}/${state.currentMission.keywords.length}`,
      "#2ed573"
    );
    scheduleFeedbackClear(900);
    winMission();
    return;
  }

  setMissionPrompt(buildWritingCoachPrompt(state.currentMission, result), "WRITE");
  setFeedback(`❌ ${result.matched.length}/${result.needed} keyword`, "#ff4757");
  scheduleFeedbackClear(900);
  takeDamage();
};

window.playAudio = function () {
  if (state.isGameOver || !state.currentMission) return;
  if ("speechSynthesis" in window) {
    const utterance = new SpeechSynthesisUtterance(state.currentMission.audioText);
    utterance.lang = "en-US";
    utterance.rate = state.gameDifficulty === "hard" ? 1.0 : 0.9;
    speechSynthesis.speak(utterance);
    setFeedback("🔊 PLAYING...", "#00e5ff");
    scheduleFeedbackClear(800);
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

    const text = currentTranscript.toLowerCase()
      .replace(/i'm/g, "i am")
      .replace(/it's/g, "it is")
      .replace(/we're/g, "we are")
      .replace(/[.,!?]/g, "");

    const targetWords = state.currentMission.exactPhrase.split(" ");
    let matchCount = 0;

    targetWords.forEach(word => {
      if (new RegExp(`\\b${word}\\b`, "i").test(text)) matchCount++;
    });

    const allowance = getAdaptiveSpeakAllowance();
    const passThreshold = Math.max(1, targetWords.length - allowance);
    const isMatch = matchCount >= passThreshold;

    setFeedback(`🎙 ${matchCount}/${targetWords.length}`, "#f1c40f");
    scheduleFeedbackClear(700);

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
  btn.innerText = "Saving.";

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
  hide("summary-panel");
  hide("game-over-ui");
  hide("btn-next");
  hide("btn-return");

  document.body.classList.remove("summary-mode", "hub-mode");
  document.body.classList.add("mission-mode");

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

  document.body.classList.remove("mission-mode", "summary-mode");
  document.body.classList.add("hub-mode");

  setTitleBlock("TECHPATH VR", "เลือกด่านแล้วเริ่มเล่นได้เลย", "#00e5ff");
  applyUnitTheme(0);
  hide("btn-next");
  hide("btn-return");
  hide("summary-panel");
  setFeedback("", "#ffffff");
  resetSummaryPanel();
  renderHubStatsBoard();
  state.currentMission = null;
  renderQuestionDiffBadge(state.gameDifficulty);
};

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