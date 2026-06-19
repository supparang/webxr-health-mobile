/* === HeroHealth • Handwash Hero AR ===
 * Path: /herohealth/hygiene/handwash/handwash.js
 * Version: 20260619-HANDWASH-AR-V1
 *
 * Core flow:
 * เปิดน้ำ → มือเปียก → ปิดน้ำ → กดสบู่ → ถูมือครบ 7 จุด → เปิดน้ำล้าง → ปิดน้ำ → เช็ดมือ → Summary
 */

(function () {
  "use strict";

  const VERSION = "20260619-HANDWASH-AR-V1";
  const GAME_ID = "handwash-ar";
  const ZONE_ID = "hygiene";

  const qs = new URLSearchParams(window.location.search);

  const ROUTES = {
    hygieneZone: qs.get("zone") || "../../hygiene-zone.html",
    hub: qs.get("hub") || "../../hub.html"
  };

  const SHEET_ENDPOINT =
    qs.get("sheet") ||
    window.HH_HANDWASH_SHEET_ENDPOINT ||
    "";

  const DIFFICULTY_PRESETS = {
    easy: {
      label: "Easy",
      durationSec: 60,
      wrongPenalty: 20,
      hintMode: "full"
    },
    normal: {
      label: "Normal",
      durationSec: 45,
      wrongPenalty: 30,
      hintMode: "medium"
    },
    hard: {
      label: "Hard",
      durationSec: 35,
      wrongPenalty: 40,
      hintMode: "low"
    }
  };

  const SCRUB_STEPS = [
    {
      id: "palm",
      label: "ถูฝ่ามือ",
      icon: "🖐",
      tip: "ถูฝ่ามือให้ทั่ว เพื่อเริ่มกระจายฟองสบู่"
    },
    {
      id: "backHand",
      label: "ถูหลังมือ",
      icon: "🤚",
      tip: "เชื้อโรคอาจอยู่บนหลังมือ ต้องถูให้สะอาด"
    },
    {
      id: "betweenFingers",
      label: "ถูซอกนิ้ว",
      icon: "🦠",
      tip: "ซอกนิ้วเป็นจุดที่มักถูกลืม ระวังให้ดี"
    },
    {
      id: "backFingers",
      label: "ถูหลังนิ้ว",
      icon: "✨",
      tip: "ถูหลังนิ้วให้ครบ เพื่อกำจัดเชื้อโรคที่ติดอยู่"
    },
    {
      id: "thumbs",
      label: "ถูนิ้วหัวแม่มือ",
      icon: "👍",
      tip: "นิ้วหัวแม่มือใช้จับสิ่งของบ่อย ต้องถูเป็นพิเศษ"
    },
    {
      id: "fingertips",
      label: "ถูปลายนิ้วและเล็บ",
      icon: "💅",
      tip: "ปลายนิ้วและเล็บเป็นจุดสำคัญ ต้องถูให้สะอาด"
    },
    {
      id: "fullFoamCoverage",
      label: "ถูให้ฟองครอบคลุมทั่วมือ",
      icon: "🫧",
      tip: "ตรวจให้แน่ใจว่าฟองสบู่ครอบคลุมทั่วมือแล้ว"
    }
  ];

  const SCORE = {
    waterOpenStart: 50,
    wetHands: 50,
    waterCloseBeforeSoap: 100,
    soapApplied: 80,
    scrubStep: 100,
    comboBonus: 20,
    scrubComplete: 300,
    waterOpenRinse: 80,
    rinsedSoap: 80,
    waterCloseAfterRinse: 100,
    driedHands: 100,
    perfectProcessBonus: 500,
    wrongOrderPenalty: -30,
    waterMistakePenalty: -100,
    dryMissingPenalty: -150
  };

  const STORAGE_KEYS = {
    best: "herohealth:hygiene:handwash:best",
    progress: "herohealth:hygiene:progress",
    attempts: "herohealth:hygiene:handwash:attempts"
  };

  const el = {};

  let timerId = null;
  let toastTimer = null;
  let currentDiff = null;
  let state = null;

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    cacheElements();
    setupDifficulty();
    bindEvents();
    updateStaticLabels();
    resetState();
    updateUI();
    startCamera();
  }

  function cacheElements() {
    el.app = document.getElementById("app");
    el.cameraVideo = document.getElementById("cameraVideo");
    el.cameraFallback = document.getElementById("cameraFallback");

    el.difficultyLabel = document.getElementById("difficultyLabel");
    el.briefDiffText = document.getElementById("briefDiffText");

    el.timerText = document.getElementById("timerText");
    el.scoreText = document.getElementById("scoreText");
    el.comboText = document.getElementById("comboText");
    el.stepText = document.getElementById("stepText");

    el.missionIcon = document.getElementById("missionIcon");
    el.missionTitle = document.getElementById("missionTitle");
    el.missionTip = document.getElementById("missionTip");

    el.btnFaucet = document.getElementById("btnFaucet");
    el.faucetLabel = document.getElementById("faucetLabel");
    el.btnSoap = document.getElementById("btnSoap");
    el.btnTowel = document.getElementById("btnTowel");

    el.briefOverlay = document.getElementById("briefOverlay");
    el.countdownOverlay = document.getElementById("countdownOverlay");
    el.countdownText = document.getElementById("countdownText");
    el.summaryOverlay = document.getElementById("summaryOverlay");

    el.btnStart = document.getElementById("btnStart");
    el.btnReplay = document.getElementById("btnReplay");

    el.btnBackZoneTop = document.getElementById("btnBackZoneTop");
    el.btnBackZoneBrief = document.getElementById("btnBackZoneBrief");
    el.btnBackZoneSummary = document.getElementById("btnBackZoneSummary");
    el.btnBackHub = document.getElementById("btnBackHub");

    el.scrubSpots = Array.from(document.querySelectorAll(".scrub-spot"));
    el.processItems = Array.from(document.querySelectorAll(".process-item"));

    el.foamFill = document.getElementById("foamFill");
    el.floatingFeedback = document.getElementById("floatingFeedback");
    el.toast = document.getElementById("toast");

    el.summaryBadgeIcon = document.getElementById("summaryBadgeIcon");
    el.summaryTitle = document.getElementById("summaryTitle");
    el.summarySubtitle = document.getElementById("summarySubtitle");
    el.summaryScore = document.getElementById("summaryScore");
    el.summaryStars = document.getElementById("summaryStars");
    el.summaryAccuracy = document.getElementById("summaryAccuracy");
    el.summaryScrub = document.getElementById("summaryScrub");
    el.summaryWater = document.getElementById("summaryWater");
    el.summaryMistakes = document.getElementById("summaryMistakes");
    el.badgeList = document.getElementById("badgeList");
    el.summaryRecommend = document.getElementById("summaryRecommend");
  }

  function setupDifficulty() {
    const raw = String(qs.get("diff") || qs.get("difficulty") || "normal").toLowerCase();
    currentDiff = DIFFICULTY_PRESETS[raw] ? raw : "normal";

    const customTime = Number(qs.get("time") || qs.get("duration") || "");
    if (Number.isFinite(customTime) && customTime >= 20 && customTime <= 180) {
      DIFFICULTY_PRESETS[currentDiff] = {
        ...DIFFICULTY_PRESETS[currentDiff],
        durationSec: Math.round(customTime)
      };
    }
  }

  function bindEvents() {
    el.btnStart.addEventListener("click", startGame);
    el.btnReplay.addEventListener("click", startGame);

    el.btnFaucet.addEventListener("click", onFaucetTap);
    el.btnSoap.addEventListener("click", onSoapTap);
    el.btnTowel.addEventListener("click", onTowelTap);

    el.scrubSpots.forEach((spot) => {
      spot.addEventListener("click", () => onScrubSpotTap(spot.dataset.step));
    });

    el.btnBackZoneTop.addEventListener("click", goHygieneZone);
    el.btnBackZoneBrief.addEventListener("click", goHygieneZone);
    el.btnBackZoneSummary.addEventListener("click", goHygieneZone);
    el.btnBackHub.addEventListener("click", goHub);

    document.addEventListener("visibilitychange", () => {
      if (document.hidden && state && state.phase !== "brief" && state.phase !== "summary") {
        pauseTimerOnly();
      }
    });
  }

  function updateStaticLabels() {
    const preset = DIFFICULTY_PRESETS[currentDiff];
    el.difficultyLabel.textContent = preset.label;
    el.briefDiffText.textContent = `${preset.label} • ${preset.durationSec} วินาที`;
  }

  function resetState() {
    const preset = DIFFICULTY_PRESETS[currentDiff];

    state = {
      version: VERSION,
      game: GAME_ID,
      zone: ZONE_ID,
      mode: "AR",
      phase: "brief",
      difficulty: currentDiff,
      durationSec: preset.durationSec,
      remainingSec: preset.durationSec,

      score: 0,
      combo: 0,
      bestCombo: 0,
      foamLevel: 0,

      startedAt: null,
      endedAt: null,
      endReason: "",

      waterOn: false,
      currentScrubIndex: 0,

      actionPasses: 0,
      actionMistakes: 0,
      waterMistakes: 0,
      soapMistakes: 0,
      orderMistakes: 0,
      scrubMistakes: 0,

      checks: {
        waterOpenStart: false,
        wetHands: false,
        waterCloseBeforeSoap: false,
        soapApplied: false,
        foamCreated: false,

        palm: false,
        backHand: false,
        betweenFingers: false,
        backFingers: false,
        thumbs: false,
        fingertips: false,
        fullFoamCoverage: false,

        scrubComplete: false,
        waterOpenRinse: false,
        rinsedSoap: false,
        waterCloseAfterRinse: false,
        driedHands: false
      },

      badges: [],
      weakestStep: "none",
      recommendation: ""
    };

    clearInterval(timerId);
    timerId = null;
    el.app.classList.remove("water-on", "foamy");
    el.summaryOverlay.classList.remove("active");
    el.countdownOverlay.classList.remove("active");
    el.briefOverlay.classList.add("active");
  }

  async function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showCameraFallback();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      el.cameraVideo.srcObject = stream;
      await el.cameraVideo.play();
      el.cameraFallback.style.display = "none";
    } catch (err) {
      showCameraFallback();
    }
  }

  function showCameraFallback() {
    el.cameraFallback.style.display = "grid";
  }

  async function startGame() {
    resetState();
    state.phase = "countdown";
    state.startedAt = new Date().toISOString();

    el.briefOverlay.classList.remove("active");
    el.summaryOverlay.classList.remove("active");
    updateUI();

    await runCountdown();
    state.phase = "wet";
    startTimer();
    updateMissionForPhase();
    updateUI();
    showToast("เริ่มจากเปิดน้ำให้มือเปียกก่อน");
  }

  function runCountdown() {
    return new Promise((resolve) => {
      const sequence = ["3", "2", "1", "ลุย!"];
      let i = 0;

      el.countdownOverlay.classList.add("active");
      el.countdownText.textContent = sequence[i];

      const id = setInterval(() => {
        i += 1;

        if (i >= sequence.length) {
          clearInterval(id);
          el.countdownOverlay.classList.remove("active");
          resolve();
          return;
        }

        el.countdownText.textContent = sequence[i];
      }, 720);
    });
  }

  function startTimer() {
    clearInterval(timerId);
    timerId = setInterval(() => {
      if (!state || isGameStopped()) return;

      state.remainingSec -= 1;

      if (state.remainingSec <= 0) {
        state.remainingSec = 0;
        updateUI();
        endGame("timeup");
        return;
      }

      updateUI();
    }, 1000);
  }

  function pauseTimerOnly() {
    clearInterval(timerId);
    timerId = null;
  }

  function isGameStopped() {
    return ["brief", "summary", "completed", "timeup"].includes(state.phase);
  }

  function onFaucetTap() {
    if (!state || isGameStopped()) return;

    switch (state.phase) {
      case "wet":
        setWater(true);
        passCheck("waterOpenStart", SCORE.waterOpenStart);
        passCheck("wetHands", SCORE.wetHands);
        state.phase = "closeBeforeSoap";
        showFeedback("+100 💧");
        showToast("ดีมาก! ตอนนี้ปิดน้ำก่อนกดสบู่");
        break;

      case "closeBeforeSoap":
        if (!state.waterOn) {
          wrongAction("ต้องเปิดน้ำให้มือเปียกก่อน", "water");
          return;
        }
        setWater(false);
        passCheck("waterCloseBeforeSoap", SCORE.waterCloseBeforeSoap);
        state.phase = "soap";
        showFeedback("+100 🚰");
        showToast("ยอดเยี่ยม ประหยัดน้ำแล้ว ต่อไปกดสบู่");
        break;

      case "soap":
        wrongAction("ตอนนี้ต้องกดสบู่ก่อน ยังไม่ต้องเปิดน้ำ", "water");
        break;

      case "scrub":
        wrongAction("ยังถูมือไม่ครบ อย่าเพิ่งเปิดน้ำล้าง", "water");
        break;

      case "rinseOpen":
        setWater(true);
        passCheck("waterOpenRinse", SCORE.waterOpenRinse);
        state.phase = "rinsing";
        showFeedback("+80 💦");
        showToast("กำลังล้างฟองสบู่ออก...");
        updateUI();
        setTimeout(() => {
          if (!state || state.phase !== "rinsing") return;
          state.foamLevel = 0;
          passCheck("rinsedSoap", SCORE.rinsedSoap);
          state.phase = "closeAfterRinse";
          showToast("ล้างฟองครบแล้ว อย่าลืมปิดน้ำ");
          updateUI();
        }, 900);
        break;

      case "rinsing":
        showToast("รอสักครู่ กำลังล้างฟองสบู่");
        break;

      case "closeAfterRinse":
        if (!state.waterOn) {
          wrongAction("น้ำปิดอยู่แล้ว ต่อไปเช็ดมือให้แห้ง", "water");
          state.phase = "dry";
          updateUI();
          return;
        }
        setWater(false);
        passCheck("waterCloseAfterRinse", SCORE.waterCloseAfterRinse);
        state.phase = "dry";
        showFeedback("+100 🚰");
        showToast("ดีมาก! ขั้นสุดท้าย เช็ดมือให้แห้ง");
        break;

      case "dry":
        wrongAction("ตอนนี้ต้องเช็ดมือ ไม่ต้องเปิดน้ำแล้ว", "water");
        break;

      default:
        wrongAction("ยังไม่ถึงขั้นใช้ก๊อกน้ำ", "water");
        break;
    }

    updateMissionForPhase();
    updateUI();
  }

  function onSoapTap() {
    if (!state || isGameStopped()) return;

    if (state.phase !== "soap") {
      if (!state.checks.wetHands) {
        wrongAction("ต้องเปิดน้ำให้มือเปียกก่อนกดสบู่", "soap");
      } else if (!state.checks.waterCloseBeforeSoap) {
        wrongAction("ควรปิดน้ำก่อนกดสบู่", "soap");
      } else {
        wrongAction("ยังไม่ถึงขั้นกดสบู่", "soap");
      }
      updateUI();
      return;
    }

    passCheck("soapApplied", SCORE.soapApplied);
    passCheck("foamCreated", 0);
    state.foamLevel = 30;
    state.phase = "scrub";
    state.currentScrubIndex = 0;
    showFeedback("+80 🧴");
    showToast("เริ่มถูมือให้ครบ 7 จุด");
    updateMissionForPhase();
    updateUI();
  }

  function onTowelTap() {
    if (!state || isGameStopped()) return;

    if (state.phase !== "dry") {
      if (!state.checks.rinsedSoap) {
        wrongAction("ยังเช็ดมือไม่ได้ ต้องล้างฟองสบู่ออกก่อน", "order");
      } else {
        wrongAction("ยังไม่ถึงขั้นเช็ดมือ", "order");
      }
      updateUI();
      return;
    }

    passCheck("driedHands", SCORE.driedHands);
    showFeedback("+100 🧻");
    endGame("completed");
  }

  function onScrubSpotTap(stepId) {
    if (!state || isGameStopped()) return;

    if (state.phase !== "scrub") {
      if (!state.checks.soapApplied) {
        wrongAction("ต้องกดสบู่ก่อนถูมือ", "order");
      } else {
        wrongAction("ยังไม่ถึงขั้นถูมือ", "order");
      }
      updateUI();
      return;
    }

    const currentStep = SCRUB_STEPS[state.currentScrubIndex];

    if (!currentStep) {
      state.phase = "rinseOpen";
      updateMissionForPhase();
      updateUI();
      return;
    }

    if (stepId !== currentStep.id) {
      state.scrubMistakes += 1;
      wrongAction(`ยังไม่ใช่จุดนี้ ตอนนี้ต้องทำ: ${currentStep.label}`, "scrub");
      updateUI();
      return;
    }

    if (state.checks[stepId]) {
      showToast("จุดนี้ผ่านแล้ว ไปจุดถัดไป");
      return;
    }

    passCheck(stepId, SCORE.scrubStep);
    state.combo += 1;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    state.score += state.combo * SCORE.comboBonus;
    state.foamLevel = clamp(state.foamLevel + 12, 0, 100);

    showFeedback(`+${SCORE.scrubStep + state.combo * SCORE.comboBonus} ${currentStep.icon}`);
    state.currentScrubIndex += 1;

    if (state.currentScrubIndex >= SCRUB_STEPS.length) {
      passCheck("scrubComplete", SCORE.scrubComplete);
      state.phase = "rinseOpen";
      showToast("ถูครบทุกจุดแล้ว เปิดน้ำเพื่อล้างฟองสบู่");
    } else {
      const next = SCRUB_STEPS[state.currentScrubIndex];
      showToast(`ต่อไป: ${next.label}`);
    }

    updateMissionForPhase();
    updateUI();
  }

  function passCheck(checkName, scoreValue) {
    if (!state.checks[checkName]) {
      state.checks[checkName] = true;
      state.actionPasses += 1;
      state.score += scoreValue;
    }
  }

  function wrongAction(message, type) {
    const preset = DIFFICULTY_PRESETS[currentDiff];
    const penalty = type === "water"
      ? Math.abs(SCORE.waterMistakePenalty)
      : preset.wrongPenalty;

    state.actionMistakes += 1;
    state.orderMistakes += 1;
    state.combo = 0;
    state.score = Math.max(0, state.score - penalty);

    if (type === "water") state.waterMistakes += 1;
    if (type === "soap") state.soapMistakes += 1;

    showFeedback(`-${penalty} ⚠️`);
    showToast(message);
  }

  function setWater(isOn) {
    state.waterOn = Boolean(isOn);
    el.app.classList.toggle("water-on", state.waterOn);
  }

  function updateMissionForPhase() {
    if (!state) return;

    const map = {
      brief: {
        icon: "🧼",
        title: "ภารกิจล้างมือพิชิตเชื้อโรค",
        tip: "ทำครบ Water → Soap → Scrub → Rinse → Dry"
      },
      wet: {
        icon: "🚰",
        title: "เปิดน้ำให้มือเปียก",
        tip: "แตะก๊อกน้ำ เพื่อเริ่มล้างมือให้ถูกขั้น"
      },
      closeBeforeSoap: {
        icon: "💧",
        title: "ปิดน้ำก่อนกดสบู่",
        tip: "ปิดน้ำเพื่อไม่ให้น้ำไหลทิ้ง แล้วจึงกดสบู่"
      },
      soap: {
        icon: "🧴",
        title: "กดสบู่",
        tip: "ใช้สบู่ก่อนถูมือ เพื่อช่วยกำจัดเชื้อโรค"
      },
      scrub: getScrubMission(),
      rinseOpen: {
        icon: "💦",
        title: "เปิดน้ำล้างฟองสบู่",
        tip: "ถูครบแล้ว เปิดน้ำเพื่อล้างฟองออก"
      },
      rinsing: {
        icon: "🫧",
        title: "กำลังล้างฟองสบู่",
        tip: "รอสักครู่ ให้ฟองสบู่ถูกล้างออก"
      },
      closeAfterRinse: {
        icon: "🚰",
        title: "ปิดน้ำหลังล้าง",
        tip: "อย่าลืมปิดน้ำหลังล้างมือเสร็จ"
      },
      dry: {
        icon: "🧻",
        title: "เช็ดมือให้แห้ง",
        tip: "ขั้นสุดท้าย เช็ดมือให้แห้งก่อนจบภารกิจ"
      }
    };

    const item = map[state.phase] || map.brief;
    el.missionIcon.textContent = item.icon;
    el.missionTitle.textContent = item.title;
    el.missionTip.textContent = item.tip;
  }

  function getScrubMission() {
    const step = SCRUB_STEPS[state.currentScrubIndex] || SCRUB_STEPS[SCRUB_STEPS.length - 1];

    return {
      icon: step.icon,
      title: step.label,
      tip: step.tip
    };
  }

  function updateUI() {
    if (!state) return;

    el.app.dataset.phase = state.phase;
    el.timerText.textContent = String(state.remainingSec);
    el.scoreText.textContent = String(state.score);
    el.comboText.textContent = String(state.combo);
    el.stepText.textContent = `${getCompletedScrubCount()}/${SCRUB_STEPS.length}`;

    el.faucetLabel.textContent = state.waterOn ? "ปิดน้ำ" : "เปิดน้ำ";
    el.app.classList.toggle("water-on", state.waterOn);
    el.app.classList.toggle("foamy", state.foamLevel > 0 && !state.checks.rinsedSoap);

    el.foamFill.style.width = `${clamp(state.foamLevel, 0, 100)}%`;

    updateControlAvailability();
    updateScrubSpots();
    updateProcessStrip();
  }

  function updateControlAvailability() {
    const phase = state.phase;

    el.btnFaucet.disabled = ![
      "wet",
      "closeBeforeSoap",
      "rinseOpen",
      "closeAfterRinse"
    ].includes(phase);

    el.btnSoap.disabled = phase !== "soap";
    el.btnTowel.disabled = phase !== "dry";
  }

  function updateScrubSpots() {
    const activeStep = SCRUB_STEPS[state.currentScrubIndex];

    el.scrubSpots.forEach((spot) => {
      const id = spot.dataset.step;
      const isDone = Boolean(state.checks[id]);
      const isActive = state.phase === "scrub" && activeStep && activeStep.id === id;

      spot.classList.toggle("done", isDone);
      spot.classList.toggle("active", isActive);
      spot.classList.toggle("locked", state.phase !== "scrub" || (!isDone && !isActive));
      spot.disabled = state.phase !== "scrub";
    });
  }

  function updateProcessStrip() {
    el.processItems.forEach((item) => {
      const checkName = item.dataset.check;
      item.classList.toggle("done", Boolean(state.checks[checkName]));
    });
  }

  function getCompletedScrubCount() {
    return SCRUB_STEPS.reduce((sum, step) => {
      return sum + (state.checks[step.id] ? 1 : 0);
    }, 0);
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    el.toast.textContent = message;
    el.toast.classList.add("show");

    toastTimer = setTimeout(() => {
      el.toast.classList.remove("show");
    }, 1800);
  }

  function showFeedback(message) {
    el.floatingFeedback.textContent = message;
    el.floatingFeedback.classList.remove("show");

    requestAnimationFrame(() => {
      el.floatingFeedback.classList.add("show");
    });
  }

  function endGame(reason) {
    clearInterval(timerId);
    timerId = null;

    state.endReason = reason;
    state.endedAt = new Date().toISOString();

    if (reason === "timeup") {
      state.phase = "timeup";
      if (!state.checks.driedHands) {
        state.score = Math.max(0, state.score + SCORE.dryMissingPenalty);
      }
    } else {
      state.phase = "completed";
    }

    setWater(false);
    finalizeResult();
    renderSummary();
    saveResult();
    sendResultToSheet();
    updateUI();

    setTimeout(() => {
      el.summaryOverlay.classList.add("active");
    }, 350);
  }

  function finalizeResult() {
    const completedScrubs = getCompletedScrubCount();
    const completedProcess = isProcessComplete();

    if (completedProcess && state.actionMistakes === 0) {
      state.score += SCORE.perfectProcessBonus;
    }

    state.accuracy = computeAccuracy();
    state.stars = computeStars(state.accuracy, completedScrubs, completedProcess);
    state.grade = computeGrade(state.accuracy, state.stars, completedProcess);
    state.badges = computeBadges(completedScrubs, completedProcess);
    state.weakestStep = computeWeakestStep();
    state.recommendation = computeRecommendation(completedScrubs, completedProcess);
  }

  function computeAccuracy() {
    const total = state.actionPasses + state.actionMistakes;
    if (total <= 0) return 0;
    return Math.round((state.actionPasses / total) * 100);
  }

  function computeStars(accuracy, completedScrubs, completedProcess) {
    if (accuracy >= 90 && completedScrubs >= 7 && completedProcess) return 3;
    if (accuracy >= 75 && completedScrubs >= 6) return 2;
    if (accuracy >= 60 && completedScrubs >= 5) return 1;
    return 0;
  }

  function computeGrade(accuracy, stars, completedProcess) {
    if (completedProcess && stars === 3 && accuracy >= 95) return "Hygiene Master";
    if (stars === 3) return "Clean Hero";
    if (stars === 2) return "Good Washer";
    if (stars === 1) return "Try Again Hero";
    return "Need More Practice";
  }

  function computeBadges(completedScrubs, completedProcess) {
    const badges = [];

    if (state.checks.waterCloseBeforeSoap && state.checks.waterCloseAfterRinse && state.waterMistakes === 0) {
      badges.push("🚰 Water Saver");
    }

    if (state.checks.soapApplied && state.soapMistakes === 0) {
      badges.push("🧼 Soap Starter");
    }

    if (completedScrubs >= 7) {
      badges.push("🫧 Foam Master");
      badges.push("🦠 Germ Hunter");
    }

    if (state.checks.driedHands) {
      badges.push("🧻 Dry Hand Hero");
    }

    if (completedProcess && state.orderMistakes === 0) {
      badges.push("🏆 Hygiene Master");
    }

    return badges;
  }

  function computeWeakestStep() {
    const missing = SCRUB_STEPS.find((step) => !state.checks[step.id]);
    if (missing) return missing.id;

    if (!state.checks.waterCloseBeforeSoap || !state.checks.waterCloseAfterRinse) {
      return "water";
    }

    if (!state.checks.driedHands) {
      return "dry";
    }

    return "none";
  }

  function computeRecommendation(completedScrubs, completedProcess) {
    if (completedProcess && state.orderMistakes === 0) {
      return "ยอดเยี่ยม! คุณล้างมือครบขั้นตอน ถูกลำดับ และไม่ลืมปิดน้ำ รอบต่อไปลองทำให้เร็วขึ้นโดยยังคงความแม่นยำ";
    }

    if (!state.checks.waterCloseBeforeSoap || !state.checks.waterCloseAfterRinse) {
      return "รอบต่อไปอย่าลืมปิดน้ำทั้งก่อนถูสบู่และหลังล้างมือ เพื่อเป็น Water Saver";
    }

    if (!state.checks.soapApplied) {
      return "ต้องใช้สบู่ก่อนถูมือ เพราะสบู่ช่วยให้การล้างมือมีประสิทธิภาพมากขึ้น";
    }

    if (completedScrubs < 7) {
      const missing = SCRUB_STEPS.find((step) => !state.checks[step.id]);
      return `รอบนี้ยังไม่ครบทุกจุด จุดที่ควรฝึกเพิ่มคือ "${missing ? missing.label : "ถูมือให้ทั่ว"}"`;
    }

    if (!state.checks.rinsedSoap) {
      return "ถูมือครบแล้ว แต่ต้องเปิดน้ำล้างฟองสบู่ออกให้เรียบร้อย";
    }

    if (!state.checks.driedHands) {
      return "อย่าลืมเช็ดมือให้แห้งหลังล้างมือ เพื่อให้กระบวนการล้างมือสมบูรณ์";
    }

    return "ทำได้ดีแล้ว รอบต่อไปลองลดการทำผิดลำดับและเพิ่มความแม่นยำ";
  }

  function isProcessComplete() {
    return Boolean(
      state.checks.waterOpenStart &&
      state.checks.wetHands &&
      state.checks.waterCloseBeforeSoap &&
      state.checks.soapApplied &&
      state.checks.scrubComplete &&
      state.checks.waterOpenRinse &&
      state.checks.rinsedSoap &&
      state.checks.waterCloseAfterRinse &&
      state.checks.driedHands
    );
  }

  function renderSummary() {
    const completedScrubs = getCompletedScrubCount();
    const waterCloseCount =
      (state.checks.waterCloseBeforeSoap ? 1 : 0) +
      (state.checks.waterCloseAfterRinse ? 1 : 0);

    const starText = state.stars > 0 ? "⭐".repeat(state.stars) : "ต้องฝึกเพิ่ม";

    el.summaryScore.textContent = String(state.score);
    el.summaryStars.textContent = starText;
    el.summaryAccuracy.textContent = `${state.accuracy}%`;
    el.summaryScrub.textContent = `${completedScrubs}/${SCRUB_STEPS.length}`;
    el.summaryWater.textContent = `${waterCloseCount}/2`;
    el.summaryMistakes.textContent = String(state.orderMistakes);
    el.summaryRecommend.textContent = state.recommendation;

    el.summaryTitle.textContent =
      state.endReason === "completed" ? "ภารกิจสำเร็จ!" : "หมดเวลาแล้ว";

    el.summarySubtitle.textContent = state.grade;

    el.summaryBadgeIcon.textContent =
      state.grade === "Hygiene Master" ? "🏆" :
      state.grade === "Clean Hero" ? "🧼" :
      state.grade === "Good Washer" ? "🫧" :
      "💪";

    el.badgeList.innerHTML = "";

    if (state.badges.length === 0) {
      const chip = document.createElement("span");
      chip.className = "badge-chip";
      chip.textContent = "ลองอีกครั้งเพื่อปลดล็อก Badge";
      el.badgeList.appendChild(chip);
    } else {
      state.badges.forEach((badge) => {
        const chip = document.createElement("span");
        chip.className = "badge-chip";
        chip.textContent = badge;
        el.badgeList.appendChild(chip);
      });
    }
  }

  function buildResultPayload() {
    const completedScrubs = getCompletedScrubCount();
    const participantId = qs.get("pid") || qs.get("participantId") || "anon";
    const name = qs.get("name") || "";
    const classLevel = qs.get("class") || qs.get("classLevel") || "P5";
    const sessionId = qs.get("session") || createSessionId();
    const studyId = qs.get("studyId") || "HYGIENE-P5-2026";

    return {
      game: GAME_ID,
      zone: ZONE_ID,
      version: VERSION,
      timestamp: state.endedAt,
      startedAt: state.startedAt,
      sessionId,
      studyId,
      participantId,
      name,
      classLevel,

      mode: state.mode,
      difficulty: state.difficulty,
      durationSec: state.durationSec,
      remainingSec: state.remainingSec,
      endReason: state.endReason,

      score: state.score,
      accuracy: state.accuracy,
      completedSteps: completedScrubs,
      totalSteps: SCRUB_STEPS.length,
      wrongSteps: state.scrubMistakes,
      bestCombo: state.bestCombo,
      stars: state.stars,
      grade: state.grade,

      waterOpenStart: passFail(state.checks.waterOpenStart),
      wetHands: passFail(state.checks.wetHands),
      waterCloseBeforeSoap: passFail(state.checks.waterCloseBeforeSoap),
      soapApplied: passFail(state.checks.soapApplied),
      foamCreated: passFail(state.checks.foamCreated),

      palmStep: passFail(state.checks.palm),
      backHandStep: passFail(state.checks.backHand),
      betweenFingersStep: passFail(state.checks.betweenFingers),
      backFingersStep: passFail(state.checks.backFingers),
      thumbsStep: passFail(state.checks.thumbs),
      fingertipsStep: passFail(state.checks.fingertips),
      fullFoamCoverage: passFail(state.checks.fullFoamCoverage),

      waterOpenRinse: passFail(state.checks.waterOpenRinse),
      rinsedSoap: passFail(state.checks.rinsedSoap),
      waterCloseAfterRinse: passFail(state.checks.waterCloseAfterRinse),
      driedHands: passFail(state.checks.driedHands),

      waterMistakes: state.waterMistakes,
      soapMistakes: state.soapMistakes,
      orderMistakes: state.orderMistakes,
      scrubMistakes: state.scrubMistakes,

      weakestStep: state.weakestStep,
      badges: state.badges.join("|"),
      recommendation: state.recommendation,
      hygieneProcessComplete: isProcessComplete() ? "yes" : "no",

      userAgent: navigator.userAgent
    };
  }

  function saveResult() {
    const payload = buildResultPayload();

    saveAttempt(payload);
    saveBest(payload);
    saveProgress(payload);
  }

  function saveAttempt(payload) {
    const attempts = readJson(STORAGE_KEYS.attempts, []);
    attempts.unshift(payload);

    try {
      localStorage.setItem(STORAGE_KEYS.attempts, JSON.stringify(attempts.slice(0, 30)));
    } catch (err) {
      // localStorage may be full or disabled; gameplay should continue.
    }
  }

  function saveBest(payload) {
    const oldBest = readJson(STORAGE_KEYS.best, null);

    if (!oldBest || Number(payload.score) > Number(oldBest.score || 0)) {
      try {
        localStorage.setItem(STORAGE_KEYS.best, JSON.stringify(payload));
      } catch (err) {
        // Ignore storage error.
      }
    }
  }

  function saveProgress(payload) {
    const progress = readJson(STORAGE_KEYS.progress, {});

    progress.handwash = {
      status: payload.stars > 0 ? "completed" : "attempted",
      bestScore: Math.max(Number(payload.score || 0), Number(progress.handwash?.bestScore || 0)),
      stars: Math.max(Number(payload.stars || 0), Number(progress.handwash?.stars || 0)),
      accuracy: Math.max(Number(payload.accuracy || 0), Number(progress.handwash?.accuracy || 0)),
      grade: payload.grade,
      badge: payload.badges,
      lastPlayedAt: payload.timestamp,
      nextMission: payload.stars >= 1 ? "brush" : "handwash"
    };

    try {
      localStorage.setItem(STORAGE_KEYS.progress, JSON.stringify(progress));
    } catch (err) {
      // Ignore storage error.
    }
  }

  function sendResultToSheet() {
    if (!SHEET_ENDPOINT) return;

    const payload = buildResultPayload();

    try {
      fetch(SHEET_ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify(payload)
      }).catch(() => {});
    } catch (err) {
      // Ignore network error to avoid blocking gameplay.
    }
  }

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
      return fallback;
    }
  }

  function passFail(value) {
    return value ? "pass" : "fail";
  }

  function createSessionId() {
    const d = new Date();
    const stamp = [
      d.getFullYear(),
      pad2(d.getMonth() + 1),
      pad2(d.getDate()),
      "-",
      pad2(d.getHours()),
      pad2(d.getMinutes()),
      pad2(d.getSeconds())
    ].join("");

    return `handwash-${stamp}-${Math.random().toString(16).slice(2, 8)}`;
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function goHygieneZone() {
    window.location.href = ROUTES.hygieneZone;
  }

  function goHub() {
    window.location.href = ROUTES.hub;
  }
})();
