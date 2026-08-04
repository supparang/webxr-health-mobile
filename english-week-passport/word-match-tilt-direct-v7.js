(function () {
  "use strict";

  const VERSION = "2026-08-04-WORD-MATCH-DIRECT-TILT-V7";
  const TRIGGER_DEG = 4.4;
  const CALIBRATION_MS = 480;
  const SETTLE_MS = 300;
  const DWELL_MS = 920;
  const MOVE_COOLDOWN_MS = 260;
  const MOTION_DELTA = 0.18;

  const syntheticEvents = new WeakSet();
  const state = {
    rawGamma:0,
    rawBeta:0,
    previousGamma:null,
    previousBeta:null,
    centerGamma:0,
    centerBeta:0,
    calibrationStartedAt:0,
    calibrationGamma:0,
    calibrationBeta:0,
    calibrationCount:0,
    calibrated:false,
    sensorSeen:false,
    lastMotionAt:0,
    settled:false,
    armed:false,
    focusedId:"",
    movedForCurrent:false,
    dwellStart:0,
    cooldownUntil:0,
    raf:0,
    neutralTimer:0
  };

  function finite(value) {
    return Number.isFinite(Number(value));
  }

  function guide(message, mode) {
    const host = document.getElementById("ewTiltGuide");
    const text = document.getElementById("ewTiltGuideText");
    if (host) host.dataset.mode = mode || "";
    if (text) text.textContent = message;
  }

  function selectableCards() {
    return Array.from(document.querySelectorAll(".memory-card:not(.matched):not(.flipped):not([disabled])"))
      .filter(card => card.getBoundingClientRect().width > 20);
  }

  function cardCenter(card) {
    const rect = card.getBoundingClientRect();
    return { x:rect.left + rect.width / 2, y:rect.top + rect.height / 2, rect };
  }

  function currentCard(cards) {
    return cards.find(card => card.dataset.cardId === state.focusedId) || null;
  }

  function defaultCard(cards) {
    const cx = innerWidth / 2;
    const cy = innerHeight * 0.52;
    return cards.slice().sort((a, b) => {
      const ac = cardCenter(a);
      const bc = cardCenter(b);
      return Math.hypot(ac.x - cx, ac.y - cy) - Math.hypot(bc.x - cx, bc.y - cy);
    })[0] || null;
  }

  function directionalCard(cards, current, direction) {
    if (!current) return defaultCard(cards);
    const origin = cardCenter(current);
    return cards.filter(card => card !== current).map(card => {
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
    }).filter(item => item.valid).sort((a, b) => a.score - b.score)[0]?.card || null;
  }

  function focusCard(card, moved) {
    document.querySelectorAll(".memory-card.ew-tilt-focus").forEach(item => item.classList.remove("ew-tilt-focus"));
    if (!card) {
      state.focusedId = "";
      state.movedForCurrent = false;
      state.dwellStart = 0;
      return;
    }
    card.classList.add("ew-tilt-focus");
    state.focusedId = card.dataset.cardId || "";
    state.dwellStart = 0;
    if (moved) {
      state.movedForCurrent = true;
      try { navigator.vibrate?.(18); } catch (_) {}
      const rect = card.getBoundingClientRect();
      if (rect.top < 86 || rect.bottom > innerHeight - 84) {
        try { card.scrollIntoView({ behavior:"smooth", block:"center", inline:"center" }); }
        catch (_) { card.scrollIntoView(); }
      }
    }
  }

  function direction(dx, dy) {
    if (Math.abs(dx) < TRIGGER_DEG && Math.abs(dy) < TRIGGER_DEG) return "";
    if (Math.abs(dx) >= Math.abs(dy) * 1.08) return dx < 0 ? "left" : "right";
    return dy < 0 ? "up" : "down";
  }

  function resetCalibration(now) {
    state.calibrationStartedAt = now;
    state.calibrationGamma = 0;
    state.calibrationBeta = 0;
    state.calibrationCount = 0;
    state.calibrated = false;
    state.settled = false;
    state.armed = false;
    state.lastMotionAt = now;
  }

  function onRawOrientation(event) {
    if (syntheticEvents.has(event)) return;
    if (!finite(event.gamma) || !finite(event.beta)) return;

    event.stopImmediatePropagation();
    const now = performance.now();
    const gamma = Number(event.gamma);
    const beta = Number(event.beta);
    state.sensorSeen = true;

    if (!state.calibrationStartedAt) resetCalibration(now);
    if (!state.calibrated) {
      state.calibrationGamma += gamma;
      state.calibrationBeta += beta;
      state.calibrationCount += 1;
      if (now - state.calibrationStartedAt >= CALIBRATION_MS && state.calibrationCount >= 4) {
        state.centerGamma = state.calibrationGamma / state.calibrationCount;
        state.centerBeta = state.calibrationBeta / state.calibrationCount;
        state.rawGamma = gamma;
        state.rawBeta = beta;
        state.previousGamma = gamma;
        state.previousBeta = beta;
        state.lastMotionAt = now;
        state.calibrated = true;
      }
      return;
    }

    const delta = state.previousGamma == null
      ? 0
      : Math.hypot(gamma - state.previousGamma, beta - state.previousBeta);
    state.previousGamma = gamma;
    state.previousBeta = beta;
    state.rawGamma = gamma;
    state.rawBeta = beta;
    if (delta > MOTION_DELTA) {
      state.lastMotionAt = now;
      state.settled = false;
      state.dwellStart = 0;
    }

    const dx = gamma - state.centerGamma;
    const dy = beta - state.centerBeta;
    const command = direction(dx, dy);
    if (command && state.armed && now >= state.cooldownUntil) {
      const cards = selectableCards();
      let focused = currentCard(cards);
      if (!focused) focused = defaultCard(cards);
      const next = directionalCard(cards, focused, command);
      state.cooldownUntil = now + MOVE_COOLDOWN_MS;
      state.armed = false;
      state.settled = false;
      state.lastMotionAt = now;
      if (next) {
        focusCard(next, true);
        guide("หยุดนิ่งเพื่อยืนยัน หรือเอียงต่อไปใบถัดไป", "moving");
      } else {
        try { navigator.vibrate?.([15, 35, 15]); } catch (_) {}
        guide("ถึงขอบกระดานแล้ว หยุดนิ่งเพื่อตั้งศูนย์ใหม่", "edge");
      }
    }
  }

  function makeNeutralEvent() {
    let event;
    try {
      event = new DeviceOrientationEvent("deviceorientation", { alpha:0, beta:0, gamma:0, absolute:false });
    } catch (_) {
      event = new Event("deviceorientation");
      Object.defineProperties(event, {
        alpha:{ value:0 }, beta:{ value:0 }, gamma:{ value:0 }, absolute:{ value:false }
      });
    }
    syntheticEvents.add(event);
    window.dispatchEvent(event);
  }

  function gameBusy() {
    return document.querySelectorAll(".memory-card.flipped:not(.matched)").length >= 2;
  }

  function loop() {
    const cards = selectableCards();
    if (cards.length) {
      let focused = currentCard(cards);
      if (!focused) {
        focused = defaultCard(cards);
        focusCard(focused, false);
        state.movedForCurrent = false;
      } else {
        focused.classList.add("ew-tilt-focus");
      }

      const now = performance.now();
      if (!state.sensorSeen) {
        guide("กำลังรอ Motion Sensor", "waiting");
      } else if (!state.calibrated) {
        const progress = Math.min(100, Math.round((now - state.calibrationStartedAt) / CALIBRATION_MS * 100));
        guide(`ถือเครื่องนิ่งเพื่อปรับศูนย์ ${progress}%`, "calibrating");
      } else if (gameBusy()) {
        state.dwellStart = 0;
        guide("กำลังตรวจคู่การ์ด…", "busy");
      } else if (now - state.lastMotionAt >= SETTLE_MS) {
        if (!state.settled) {
          state.centerGamma = state.rawGamma;
          state.centerBeta = state.rawBeta;
          state.settled = true;
          state.armed = true;
          state.dwellStart = 0;
        }

        if (state.movedForCurrent && now >= state.cooldownUntil) {
          if (!state.dwellStart) state.dwellStart = now;
          const percent = Math.min(100, Math.round((now - state.dwellStart) / DWELL_MS * 100));
          guide(`นิ่งเพื่อเปิด ${percent}% • เอียงต่อได้ก่อนครบ`, "dwell");
          if (percent >= 100) {
            state.dwellStart = 0;
            state.movedForCurrent = false;
            state.armed = false;
            state.cooldownUntil = now + MOVE_COOLDOWN_MS;
            focused.click();
            state.focusedId = "";
          }
        } else {
          guide("พร้อมแล้ว • เอียงเบา ๆ ไปทิศที่ต้องการ", "ready");
        }
      } else {
        state.dwellStart = 0;
        guide("เอียงเบา ๆ แล้วหยุดนิ่ง ไม่ต้องคืนองศาเดิม", "moving");
      }
    }
    state.raf = requestAnimationFrame(loop);
  }

  function rewriteInstructions() {
    const instruction = document.querySelector(".game-panel .instruction");
    if (instruction) instruction.textContent = "เอียงเบา ๆ เลื่อนทีละใบ • หยุดนิ่งตั้งศูนย์ใหม่ • นิ่งต่อเพื่อเปิด";
    const feedback = document.getElementById("memoryFeedback");
    if (feedback && feedback.textContent.includes("ปรับศูนย์")) {
      feedback.textContent = "เอียงเบา ๆ แล้วหยุดนิ่ง ระบบจะตั้งมุมปัจจุบันเป็นศูนย์ใหม่";
    }
  }

  const observer = new MutationObserver(rewriteInstructions);
  observer.observe(document.documentElement, { childList:true, subtree:true });

  window.addEventListener("deviceorientation", onRawOrientation, true);
  state.neutralTimer = window.setInterval(makeNeutralEvent, 90);
  state.raf = requestAnimationFrame(loop);
  rewriteInstructions();

  function cleanup() {
    cancelAnimationFrame(state.raf);
    clearInterval(state.neutralTimer);
    observer.disconnect();
    window.removeEventListener("deviceorientation", onRawOrientation, true);
  }
  window.addEventListener("pagehide", cleanup, { once:true });
  window.addEventListener("beforeunload", cleanup, { once:true });

  window.EW_WORD_MATCH_DIRECT_TILT = Object.freeze({
    version:VERSION,
    triggerDegrees:TRIGGER_DEG,
    settleMs:SETTLE_MS,
    dwellMs:DWELL_MS,
    policy:"direct-capture-auto-center",
    touchFallback:false
  });
}());
