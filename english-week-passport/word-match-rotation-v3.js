(async function () {
  "use strict";

  const rotation = window.EW_ROTATION;
  const VERSION = "2026-08-03-WORD-MATCH-TILT-SNAP-V3";
  const ENGINE_URL = "./word-match-memory.js?v=20260803-memory3";
  const PAIR_BANK = Object.freeze([
    {id:"wm01",word:"journey",meaning:"การเดินทาง",emoji:"🧳",level:"A2"},
    {id:"wm02",word:"healthy",meaning:"มีสุขภาพดี",emoji:"🥗",level:"A2"},
    {id:"wm03",word:"device",meaning:"อุปกรณ์",emoji:"📱",level:"A2"},
    {id:"wm04",word:"schedule",meaning:"กำหนดการ",emoji:"🗓️",level:"A2"},
    {id:"wm05",word:"passport",meaning:"หนังสือเดินทาง",emoji:"🛂",level:"A2"},
    {id:"wm06",word:"exercise",meaning:"การออกกำลังกาย",emoji:"🏃",level:"A2"},
    {id:"wm07",word:"environment",meaning:"สิ่งแวดล้อม",emoji:"🌱",level:"A2+"},
    {id:"wm08",word:"volunteer",meaning:"อาสาสมัคร",emoji:"🙋",level:"A2+"},
    {id:"wm09",word:"protect",meaning:"ปกป้อง",emoji:"🛡️",level:"A2+"},
    {id:"wm10",word:"community",meaning:"ชุมชน",emoji:"🏘️",level:"A2+"},
    {id:"wm11",word:"destination",meaning:"จุดหมายปลายทาง",emoji:"📍",level:"A2+"},
    {id:"wm12",word:"improve",meaning:"พัฒนาให้ดีขึ้น",emoji:"📈",level:"A2+"},
    {id:"wm13",word:"opportunity",meaning:"โอกาส",emoji:"🚪",level:"B1"},
    {id:"wm14",word:"confident",meaning:"มั่นใจ",emoji:"💪",level:"B1"},
    {id:"wm15",word:"reliable",meaning:"น่าเชื่อถือ",emoji:"✅",level:"B1"},
    {id:"wm16",word:"feedback",meaning:"ข้อมูลป้อนกลับ",emoji:"📊",level:"B1"},
    {id:"wm17",word:"pollution",meaning:"มลพิษ",emoji:"🌫️",level:"B1"},
    {id:"wm18",word:"interview",meaning:"การสัมภาษณ์",emoji:"🧑‍💼",level:"B1"},
    {id:"wm19",word:"achievement",meaning:"ความสำเร็จ",emoji:"🏆",level:"B1+"},
    {id:"wm20",word:"responsibility",meaning:"ความรับผิดชอบ",emoji:"🧭",level:"B1+"},
    {id:"wm21",word:"sustainable",meaning:"ยั่งยืน",emoji:"♻️",level:"B1+"},
    {id:"wm22",word:"collaboration",meaning:"การทำงานร่วมกัน",emoji:"🤝",level:"B1+"},
    {id:"wm23",word:"recommendation",meaning:"ข้อเสนอแนะ",emoji:"💡",level:"B1+"},
    {id:"wm24",word:"communication",meaning:"การสื่อสาร",emoji:"💬",level:"B1+"}
  ]);

  const assignment = rotation?.getAssignment();
  const selectedPool = rotation
    ? rotation.balancedSample(PAIR_BANK, 12, "word_match:pool", item => item.level)
    : PAIR_BANK.slice(0, 12);
  rotation?.installStageRandom("word_match");

  function escapeScriptJson(value) {
    return JSON.stringify(value).replace(/</g, "\\u003c");
  }

  async function loadEngine() {
    const response = await fetch(ENGINE_URL, { cache:"no-store" });
    if (!response.ok) throw new Error(`WORD_MATCH_ENGINE_${response.status}`);
    let source = await response.text();
    source = source.replace(
      /const PAIRS\s*=\s*Object\.freeze\(\[[\s\S]*?\]\);/,
      `const PAIRS = Object.freeze(${escapeScriptJson(selectedPool)});`
    );
    source = source.replace("Word Match Village Memory Game", "Word Match Village Tilt Snap Mission");
    const blob = new Blob([source], { type:"text/javascript" });
    const objectUrl = URL.createObjectURL(blob);
    const script = document.createElement("script");
    script.src = objectUrl;
    script.onload = () => URL.revokeObjectURL(objectUrl);
    script.onerror = () => URL.revokeObjectURL(objectUrl);
    document.body.appendChild(script);
  }

  const control = {
    permissionRequested:false,
    sensorSeen:false,
    calibrated:false,
    calibrating:false,
    calibrationStartedAt:0,
    calibrationGamma:0,
    calibrationBeta:0,
    calibrationCount:0,
    baselineGamma:0,
    baselineBeta:0,
    targetX:0,
    targetY:0,
    smoothX:0,
    smoothY:0,
    armed:false,
    neutralSince:0,
    focusedCardId:"",
    needsMove:true,
    dwellStart:0,
    cooldownUntil:0,
    lastMoveAt:0,
    raf:0
  };

  const ENTER_DEGREES = 8.5;
  const RELEASE_DEGREES = 4.2;
  const CALIBRATION_MS = 650;
  const NEUTRAL_ARM_MS = 150;
  const DWELL_MS = 760;
  const MOVE_COOLDOWN_MS = 260;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function beginCalibration() {
    control.calibrating = true;
    control.calibrated = false;
    control.sensorSeen = false;
    control.calibrationStartedAt = performance.now();
    control.calibrationGamma = 0;
    control.calibrationBeta = 0;
    control.calibrationCount = 0;
    control.targetX = 0;
    control.targetY = 0;
    control.smoothX = 0;
    control.smoothY = 0;
    control.armed = false;
    control.neutralSince = 0;
    control.needsMove = true;
    control.dwellStart = 0;
  }

  async function requestOrientationPermission() {
    if (control.permissionRequested) return;
    control.permissionRequested = true;
    beginCalibration();
    try {
      if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
        const result = await DeviceOrientationEvent.requestPermission();
        if (result !== "granted") throw new Error("MOTION_PERMISSION_DENIED");
      }
    } catch (error) {
      console.warn("Motion permission unavailable", error);
    }
  }

  function onOrientation(event) {
    if (!control.permissionRequested) return;
    if (!Number.isFinite(event.gamma) || !Number.isFinite(event.beta)) return;
    control.sensorSeen = true;

    if (!control.calibrated) {
      if (!control.calibrating) beginCalibration();
      control.calibrationGamma += event.gamma;
      control.calibrationBeta += event.beta;
      control.calibrationCount += 1;
      if (performance.now() - control.calibrationStartedAt >= CALIBRATION_MS && control.calibrationCount >= 4) {
        control.baselineGamma = control.calibrationGamma / control.calibrationCount;
        control.baselineBeta = control.calibrationBeta / control.calibrationCount;
        control.calibrated = true;
        control.calibrating = false;
        control.neutralSince = performance.now();
      }
      return;
    }

    control.targetX = clamp(event.gamma - control.baselineGamma, -24, 24);
    control.targetY = clamp(event.beta - control.baselineBeta, -22, 22);
  }

  function selectableCards() {
    return Array.from(document.querySelectorAll(".memory-card:not(.matched):not(.flipped):not([disabled])"))
      .filter(card => {
        const rect = card.getBoundingClientRect();
        return rect.width > 20 && rect.height > 20;
      });
  }

  function cardCenter(card) {
    const rect = card.getBoundingClientRect();
    return { x:rect.left + rect.width / 2, y:rect.top + rect.height / 2, rect };
  }

  function cardId(card) {
    return String(card?.dataset?.cardId || "");
  }

  function currentCard(cards) {
    return cards.find(card => cardId(card) === control.focusedCardId) || null;
  }

  function defaultCard(cards) {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight * 0.52;
    return cards.slice().sort((a, b) => {
      const ac = cardCenter(a);
      const bc = cardCenter(b);
      return Math.hypot(ac.x - cx, ac.y - cy) - Math.hypot(bc.x - cx, bc.y - cy);
    })[0] || null;
  }

  function directionalCard(cards, current, direction) {
    if (!current) return defaultCard(cards);
    const origin = cardCenter(current);
    const candidates = cards.filter(card => card !== current).map(card => {
      const center = cardCenter(card);
      const dx = center.x - origin.x;
      const dy = center.y - origin.y;
      let valid = false;
      let forward = 0;
      let cross = 0;
      if (direction === "left") { valid = dx < -12; forward = -dx; cross = Math.abs(dy); }
      if (direction === "right") { valid = dx > 12; forward = dx; cross = Math.abs(dy); }
      if (direction === "up") { valid = dy < -12; forward = -dy; cross = Math.abs(dx); }
      if (direction === "down") { valid = dy > 12; forward = dy; cross = Math.abs(dx); }
      return { card, valid, score:forward + cross * 1.65 };
    }).filter(item => item.valid).sort((a, b) => a.score - b.score);
    return candidates[0]?.card || null;
  }

  function ensureCardVisible(card) {
    if (!card) return;
    const rect = card.getBoundingClientRect();
    if (rect.top < 86 || rect.bottom > window.innerHeight - 78) {
      try { card.scrollIntoView({ behavior:"smooth", block:"center", inline:"center" }); }
      catch (_) { card.scrollIntoView(); }
    }
  }

  function focusCard(card, moved) {
    document.querySelectorAll(".memory-card.ew-tilt-focus").forEach(item => item.classList.remove("ew-tilt-focus"));
    if (!card) {
      control.focusedCardId = "";
      return;
    }
    card.classList.add("ew-tilt-focus");
    control.focusedCardId = cardId(card);
    control.dwellStart = 0;
    if (moved) {
      control.needsMove = false;
      control.lastMoveAt = performance.now();
      ensureCardVisible(card);
      navigator.vibrate?.(18);
    }
  }

  function directionFromTilt() {
    const x = control.smoothX;
    const y = control.smoothY;
    if (Math.abs(x) < ENTER_DEGREES && Math.abs(y) < ENTER_DEGREES) return "";
    if (Math.abs(x) >= Math.abs(y) * 1.08) return x < 0 ? "left" : "right";
    return y < 0 ? "up" : "down";
  }

  function ensureControlUi() {
    if (!document.getElementById("ewTiltGuide")) {
      const guide = document.createElement("div");
      guide.id = "ewTiltGuide";
      guide.innerHTML = '<span class="ew-arrows">◀ ▲ ▼ ▶</span><strong id="ewTiltGuideText">วางเครื่องนิ่งเพื่อปรับศูนย์</strong>';
      document.body.appendChild(guide);
    }
  }

  function rewriteCopy() {
    const introLead = document.querySelector(".intro-card .lead");
    if (introLead && introLead.textContent.includes("เปิดการ์ด")) {
      introLead.textContent = "เอียงมือถือเพื่อเลื่อน Focus ทีละใบ กลับเครื่องสู่กลาง แล้วค้างเพื่อเปิด จับคู่คำอังกฤษกับความหมายไทยให้ครบ 6 คู่";
    }
    const start = document.getElementById("startBtn");
    if (start) start.textContent = "เริ่ม Tilt Snap Memory";
    const instruction = document.querySelector(".game-panel .instruction");
    if (instruction) instruction.textContent = "เอียงหนึ่งครั้งเลื่อนหนึ่งใบ • คืนเครื่องสู่กลาง • ค้างเพื่อเปิด";
  }

  function guideText(message, mode) {
    const guide = document.getElementById("ewTiltGuide");
    const text = document.getElementById("ewTiltGuideText");
    if (!guide || !text) return;
    guide.dataset.mode = mode || "";
    text.textContent = message;
  }

  function updateTiltSnap() {
    ensureControlUi();
    rewriteCopy();

    control.smoothX += (control.targetX - control.smoothX) * 0.24;
    control.smoothY += (control.targetY - control.smoothY) * 0.24;

    const board = document.getElementById("memoryGrid");
    const cards = selectableCards();
    if (!board || !cards.length) {
      control.focusedCardId = "";
      control.dwellStart = 0;
      guideText("เริ่มภารกิจเพื่อเปิด Tilt Snap", "idle");
      control.raf = requestAnimationFrame(updateTiltSnap);
      return;
    }

    let focused = currentCard(cards);
    if (!focused) {
      focused = defaultCard(cards);
      focusCard(focused, false);
      control.needsMove = true;
    } else {
      focused.classList.add("ew-tilt-focus");
    }

    const now = performance.now();
    if (!control.permissionRequested) {
      guideText("กดเริ่มเกมเพื่ออนุญาต Motion Sensor", "waiting");
      control.raf = requestAnimationFrame(updateTiltSnap);
      return;
    }
    if (!control.sensorSeen) {
      guideText("กำลังรอ Motion Sensor", "waiting");
      control.raf = requestAnimationFrame(updateTiltSnap);
      return;
    }
    if (!control.calibrated) {
      const elapsed = Math.max(0, now - control.calibrationStartedAt);
      guideText(`ถือเครื่องนิ่งเพื่อปรับศูนย์ ${Math.min(100, Math.round(elapsed / CALIBRATION_MS * 100))}%`, "calibrating");
      control.raf = requestAnimationFrame(updateTiltSnap);
      return;
    }

    const neutral = Math.abs(control.smoothX) <= RELEASE_DEGREES && Math.abs(control.smoothY) <= RELEASE_DEGREES;
    if (neutral) {
      if (!control.neutralSince) control.neutralSince = now;
      if (now - control.neutralSince >= NEUTRAL_ARM_MS) control.armed = true;
    } else {
      control.neutralSince = 0;
      control.dwellStart = 0;
    }

    const direction = directionFromTilt();
    if (direction && control.armed && now >= control.cooldownUntil) {
      const next = directionalCard(cards, focused, direction);
      control.armed = false;
      control.neutralSince = 0;
      control.dwellStart = 0;
      control.cooldownUntil = now + MOVE_COOLDOWN_MS;
      if (next) {
        focusCard(next, true);
        focused = next;
        guideText(`เลือกใบใหม่แล้ว • คืนเครื่องสู่กลางเพื่อยืนยัน`, "moved");
      } else {
        navigator.vibrate?.([15, 30, 15]);
        guideText("ถึงขอบกระดานแล้ว • คืนเครื่องสู่กลาง", "edge");
      }
      control.raf = requestAnimationFrame(updateTiltSnap);
      return;
    }

    if (!neutral) {
      const directionLabel = direction === "left" ? "ซ้าย" : direction === "right" ? "ขวา" : direction === "up" ? "ขึ้น" : direction === "down" ? "ลง" : "";
      guideText(directionLabel ? `กำลังอ่านคำสั่ง ${directionLabel} • คืนเครื่องสู่กลาง` : "เอียงเพิ่มอีกเล็กน้อย", "moving");
      control.raf = requestAnimationFrame(updateTiltSnap);
      return;
    }

    if (control.needsMove) {
      guideText("เอียงไปยังการ์ดที่ต้องการหนึ่งครั้ง", "ready");
      control.raf = requestAnimationFrame(updateTiltSnap);
      return;
    }

    if (now - control.lastMoveAt < 120 || now < control.cooldownUntil) {
      guideText("คืนเครื่องสู่กลางและถือให้นิ่ง", "settling");
      control.raf = requestAnimationFrame(updateTiltSnap);
      return;
    }

    if (!control.dwellStart) control.dwellStart = now;
    const percent = Math.min(100, Math.round((now - control.dwellStart) / DWELL_MS * 100));
    focused.style.setProperty("--ew-dwell", `${percent}%`);
    guideText(`${assignment?.passportRotation || "P"} • กำลังเปิด ${percent}%`, "dwell");

    if (percent >= 100) {
      control.cooldownUntil = now + 520;
      control.dwellStart = 0;
      control.needsMove = true;
      control.armed = false;
      control.neutralSince = 0;
      focused.style.removeProperty("--ew-dwell");
      focused.click();
      navigator.vibrate?.(28);
    }

    control.raf = requestAnimationFrame(updateTiltSnap);
  }

  document.addEventListener("click", event => {
    if (event.target?.closest?.("#startBtn")) requestOrientationPermission();
    const card = event.target?.closest?.(".memory-card");
    if (card && event.isTrusted) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }
  }, true);

  window.addEventListener("deviceorientation", onOrientation, true);
  window.addEventListener("pagehide", () => {
    cancelAnimationFrame(control.raf);
    window.removeEventListener("deviceorientation", onOrientation, true);
  });

  const observer = new MutationObserver(rewriteCopy);
  observer.observe(document.documentElement, { childList:true, subtree:true });

  const style = document.createElement("style");
  style.textContent = `
    .memory-card{pointer-events:none!important;position:relative}
    .memory-card.ew-tilt-focus{outline:4px solid #facc15!important;outline-offset:4px;filter:brightness(1.10);transform:translateY(-2px) scale(1.02);z-index:2}
    .memory-card.ew-tilt-focus::after{content:"";position:absolute;inset:-7px;border-radius:inherit;border:4px solid rgba(255,255,255,.92);clip-path:inset(calc(100% - var(--ew-dwell,0%)) 0 0 0);pointer-events:none}
    #ewTiltGuide{position:fixed;z-index:9999;left:50%;bottom:max(10px,env(safe-area-inset-bottom));transform:translateX(-50%);width:min(94vw,430px);padding:8px 12px;border-radius:16px;background:rgba(7,24,39,.94);color:white;display:flex;align-items:center;justify-content:center;gap:9px;box-shadow:0 6px 22px rgba(0,0,0,.28);pointer-events:none;text-align:center}
    #ewTiltGuide .ew-arrows{font-size:.82rem;color:#facc15;white-space:nowrap}
    #ewTiltGuide strong{font-size:.75rem;line-height:1.25}
    #ewTiltGuide[data-mode="dwell"]{background:rgba(15,82,68,.95)}
    #ewTiltGuide[data-mode="edge"]{background:rgba(128,51,22,.95)}
    .game-panel{padding-bottom:74px!important}
  `;
  document.head.appendChild(style);

  try {
    await loadEngine();
    updateTiltSnap();
  } catch (error) {
    console.error(error);
    const root = document.getElementById("memoryRoot");
    if (root) root.innerHTML = `<section class="intro-card"><div class="hero">⚠️</div><h1>โหลด Word Match ไม่สำเร็จ</h1><p class="lead">${String(error.message || error)}</p><button onclick="location.reload()" class="btn primary">โหลดใหม่</button></section>`;
  }
}());