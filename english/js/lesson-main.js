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
  document.body.dataset.missionType = state.currentMission.type || "";

  if (state.currentMission.type === "speaking") {
    setSpeakingPrompt(state.currentMission.title, state.currentMission.exactPhrase);
    setMissionPrompt(`"${state.currentMission.exactPhrase}"`, "SPEAK");
    startTimer(clamp(getBaseTimeForMissionType("speaking") + timeMod, 18, 80));
  } else if (state.currentMission.type === "reading") {
    setReadingQuestion(state.currentMission.question);
    setChoiceLabelsFor("reading", state.currentMission.choices);
    setMissionPrompt(state.currentMission.question || "อ่านข้อความแล้วเลือกคำตอบที่ถูกต้อง", "READ");
    showChoiceButtons(true);
    startTimer(clamp(getBaseTimeForMissionType("reading") + timeMod, 18, 80));
  } else if (state.currentMission.type === "listening") {
    setChoiceLabelsFor("listening", state.currentMission.choices);
    setMissionPrompt("กด Play Audio แล้วเลือกคำตอบ", "LISTEN");
    showChoiceButtons(true);
    startTimer(clamp(getBaseTimeForMissionType("listening") + timeMod, 18, 80));
  } else if (state.currentMission.type === "writing") {
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