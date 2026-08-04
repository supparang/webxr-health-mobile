(function () {
  "use strict";

  const VERSION = "2026-08-04-WORD-MATCH-TILT-RUNTIME-V9";
  const CALIBRATE_MS = 460;
  const TRIGGER_DEG = 4.6;
  const RELEASE_DEG = 3.4;
  const PULSE_DEG = 15;
  const PULSE_MS = 320;
  const SETTLE_RECENTER_MS = 420;
  const syntheticEvents = new WeakSet();

  const state = {
    active:false,
    startedAt:0,
    calibrated:false,
    count:0,
    sumGamma:0,
    sumBeta:0,
    centerGamma:0,
    centerBeta:0,
    lastGamma:null,
    lastBeta:null,
    lastMotionAt:0,
    latched:false,
    pulseUntil:0,
    axis:"",
    sign:0
  };

  function finite(value) {
    return Number.isFinite(Number(value));
  }

  function boardReady() {
    return Boolean(document.getElementById("memoryGrid") && document.querySelector(".memory-card"));
  }

  function reset(now) {
    state.active = true;
    state.startedAt = now;
    state.calibrated = false;
    state.count = 0;
    state.sumGamma = 0;
    state.sumBeta = 0;
    state.centerGamma = 0;
    state.centerBeta = 0;
    state.lastGamma = null;
    state.lastBeta = null;
    state.lastMotionAt = now;
    state.latched = false;
    state.pulseUntil = 0;
    state.axis = "";
    state.sign = 0;
  }

  function makeSynthetic(source, gamma, beta) {
    let event;
    try {
      event = new DeviceOrientationEvent("deviceorientation", {
        alpha:finite(source.alpha) ? Number(source.alpha) : 0,
        beta,
        gamma,
        absolute:Boolean(source.absolute)
      });
    } catch (_) {
      event = new Event("deviceorientation");
      Object.defineProperties(event, {
        alpha:{ value:finite(source.alpha) ? Number(source.alpha) : 0 },
        beta:{ value:beta },
        gamma:{ value:gamma },
        absolute:{ value:Boolean(source.absolute) }
      });
    }
    syntheticEvents.add(event);
    return event;
  }

  function emit(source, gamma, beta) {
    window.dispatchEvent(makeSynthetic(source, gamma, beta));
  }

  function onOrientation(event) {
    if (syntheticEvents.has(event)) return;
    if (!boardReady()) {
      state.active = false;
      return;
    }
    if (!finite(event.gamma) || !finite(event.beta)) return;

    event.stopImmediatePropagation();
    const now = performance.now();
    const gamma = Number(event.gamma);
    const beta = Number(event.beta);

    if (!state.active) reset(now);

    if (!state.calibrated) {
      state.sumGamma += gamma;
      state.sumBeta += beta;
      state.count += 1;
      if (now - state.startedAt >= CALIBRATE_MS && state.count >= 4) {
        state.centerGamma = state.sumGamma / state.count;
        state.centerBeta = state.sumBeta / state.count;
        state.lastGamma = gamma;
        state.lastBeta = beta;
        state.lastMotionAt = now;
        state.calibrated = true;
      }
      emit(event, 0, 0);
      return;
    }

    const motion = state.lastGamma == null
      ? 0
      : Math.hypot(gamma - state.lastGamma, beta - state.lastBeta);
    state.lastGamma = gamma;
    state.lastBeta = beta;
    if (motion > 0.16) state.lastMotionAt = now;

    let dx = gamma - state.centerGamma;
    let dy = beta - state.centerBeta;
    const magnitude = Math.max(Math.abs(dx), Math.abs(dy));

    if (!state.latched && magnitude >= TRIGGER_DEG) {
      state.axis = Math.abs(dx) >= Math.abs(dy) * 1.06 ? "x" : "y";
      state.sign = (state.axis === "x" ? dx : dy) < 0 ? -1 : 1;
      state.latched = true;
      state.pulseUntil = now + PULSE_MS;
      try { navigator.vibrate?.(14); } catch (_) {}
    }

    if (state.latched && magnitude <= RELEASE_DEG) {
      state.latched = false;
      state.axis = "";
      state.sign = 0;
    } else if (state.latched && now - state.lastMotionAt >= SETTLE_RECENTER_MS) {
      state.centerGamma = gamma;
      state.centerBeta = beta;
      state.latched = false;
      state.axis = "";
      state.sign = 0;
      dx = 0;
      dy = 0;
    } else if (!state.latched && now - state.lastMotionAt >= SETTLE_RECENTER_MS) {
      state.centerGamma += dx * 0.18;
      state.centerBeta += dy * 0.18;
    }

    if (now <= state.pulseUntil) {
      emit(event,
        state.axis === "x" ? state.sign * PULSE_DEG : 0,
        state.axis === "y" ? state.sign * PULSE_DEG : 0
      );
    } else {
      emit(event, 0, 0);
    }
  }

  function updateBoardCopyOnce() {
    if (!boardReady()) return false;
    const instruction = document.querySelector(".game-panel .instruction");
    if (instruction && instruction.dataset.tiltV9 !== "1") {
      instruction.dataset.tiltV9 = "1";
      instruction.textContent = "เอียงเบา ๆ เลื่อนทีละใบ • หยุดนิ่งเพื่อเปิด • ระบบตั้งศูนย์ใหม่อัตโนมัติ";
    }
    return true;
  }

  const boardPoll = window.setInterval(() => {
    if (updateBoardCopyOnce()) window.clearInterval(boardPoll);
  }, 250);

  window.addEventListener("deviceorientation", onOrientation, true);
  window.addEventListener("pagehide", () => {
    window.clearInterval(boardPoll);
    window.removeEventListener("deviceorientation", onOrientation, true);
  }, { once:true });

  window.EW_WORD_MATCH_TILT_RUNTIME = Object.freeze({
    version:VERSION,
    triggerDegrees:TRIGGER_DEG,
    pulseDegrees:PULSE_DEG,
    activeOnlyWhenBoardReady:true,
    mutationObserver:false,
    touchFallback:false
  });
}());
