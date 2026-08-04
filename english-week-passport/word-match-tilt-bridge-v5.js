(function () {
  "use strict";

  const VERSION = "2026-08-04-WORD-MATCH-TILT-GESTURE-BRIDGE-V5";
  const nativeAdd = window.addEventListener.bind(window);
  const nativeRemove = window.removeEventListener.bind(window);
  const wrappers = new WeakMap();

  const CALIBRATE_MS = 450;
  const TRIGGER_DEG = 4.8;
  const RELEASE_DEG = 3.8;
  const PULSE_DEG = 13;
  const PULSE_MS = 270;
  const DRIFT_DELAY_MS = 620;

  function finite(value) {
    return Number.isFinite(Number(value));
  }

  function makeController(listener) {
    const state = {
      startedAt:0,
      calibrated:false,
      count:0,
      sumGamma:0,
      sumBeta:0,
      centerGamma:0,
      centerBeta:0,
      previousGamma:null,
      previousBeta:null,
      stableSince:0,
      latched:false,
      latchedAt:0,
      axis:"",
      sign:0,
      pulseUntil:0,
      gestures:0
    };

    function synthetic(source, gamma, beta) {
      return {
        alpha:source.alpha,
        beta,
        gamma,
        absolute:source.absolute,
        bubbles:false,
        cancelable:false,
        type:"deviceorientation",
        timeStamp:source.timeStamp,
        ewTiltBridgeVersion:VERSION,
        ewTiltGesture:true
      };
    }

    return function bridgedOrientation(event) {
      if (!finite(event?.gamma) || !finite(event?.beta)) {
        listener.call(window, event);
        return;
      }

      const now = performance.now();
      const rawGamma = Number(event.gamma);
      const rawBeta = Number(event.beta);

      if (!state.startedAt) state.startedAt = now;
      if (!state.calibrated) {
        state.sumGamma += rawGamma;
        state.sumBeta += rawBeta;
        state.count += 1;
        if (now - state.startedAt >= CALIBRATE_MS && state.count >= 4) {
          state.centerGamma = state.sumGamma / state.count;
          state.centerBeta = state.sumBeta / state.count;
          state.previousGamma = rawGamma;
          state.previousBeta = rawBeta;
          state.calibrated = true;
        }
        listener.call(window, synthetic(event, 0, 0));
        return;
      }

      const velocity = state.previousGamma == null
        ? 0
        : Math.hypot(rawGamma - state.previousGamma, rawBeta - state.previousBeta);
      state.previousGamma = rawGamma;
      state.previousBeta = rawBeta;

      let dx = rawGamma - state.centerGamma;
      let dy = rawBeta - state.centerBeta;
      const magnitude = Math.max(Math.abs(dx), Math.abs(dy));

      if (velocity <= 0.28) {
        if (!state.stableSince) state.stableSince = now;
      } else {
        state.stableSince = 0;
      }

      if (!state.latched && magnitude <= RELEASE_DEG + 1.2) {
        state.centerGamma += dx * 0.045;
        state.centerBeta += dy * 0.045;
        dx = rawGamma - state.centerGamma;
        dy = rawBeta - state.centerBeta;
      }

      if (!state.latched && magnitude >= TRIGGER_DEG) {
        state.axis = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
        state.sign = (state.axis === "x" ? dx : dy) < 0 ? -1 : 1;
        state.latched = true;
        state.latchedAt = now;
        state.pulseUntil = now + PULSE_MS;
        state.stableSince = 0;
        state.gestures += 1;
        try { navigator.vibrate?.(14); } catch (_) {}
      }

      if (state.latched && state.stableSince && now - state.stableSince >= DRIFT_DELAY_MS) {
        state.centerGamma += (rawGamma - state.centerGamma) * 0.12;
        state.centerBeta += (rawBeta - state.centerBeta) * 0.12;
        dx = rawGamma - state.centerGamma;
        dy = rawBeta - state.centerBeta;
      }

      if (state.latched && Math.max(Math.abs(dx), Math.abs(dy)) <= RELEASE_DEG) {
        state.latched = false;
        state.axis = "";
        state.sign = 0;
        state.stableSince = 0;
      }

      let gamma = 0;
      let beta = 0;
      if (now <= state.pulseUntil) {
        if (state.axis === "x") gamma = state.sign * PULSE_DEG;
        if (state.axis === "y") beta = state.sign * PULSE_DEG;
      }

      listener.call(window, synthetic(event, gamma, beta));
    };
  }

  window.addEventListener = function patchedAdd(type, listener, options) {
    if (type !== "deviceorientation" || typeof listener !== "function") {
      return nativeAdd(type, listener, options);
    }
    let wrapper = wrappers.get(listener);
    if (!wrapper) {
      wrapper = makeController(listener);
      wrappers.set(listener, wrapper);
    }
    return nativeAdd(type, wrapper, options);
  };

  window.removeEventListener = function patchedRemove(type, listener, options) {
    if (type === "deviceorientation" && typeof listener === "function") {
      return nativeRemove(type, wrappers.get(listener) || listener, options);
    }
    return nativeRemove(type, listener, options);
  };

  function rewriteGuide() {
    const instruction = document.querySelector(".game-panel .instruction");
    if (instruction) instruction.textContent = "เอียงเบา ๆ หนึ่งจังหวะ = เลื่อนหนึ่งใบ • ระบบคืนศูนย์ให้อัตโนมัติ • ค้างเพื่อเปิด";
    const lead = document.querySelector(".intro-card .lead");
    if (lead?.textContent.includes("เอียงมือถือ")) {
      lead.textContent = "เอียงมือถือเบา ๆ เพื่อเลื่อน Focus ทีละใบ ระบบคืนศูนย์ให้อัตโนมัติ แล้วค้างเพื่อเปิด จับคู่คำอังกฤษกับความหมายไทยให้ครบ 6 คู่";
    }
  }

  const observer = new MutationObserver(rewriteGuide);
  observer.observe(document.documentElement, {childList:true, subtree:true});
  rewriteGuide();

  window.EW_WORD_MATCH_TILT_BRIDGE = Object.freeze({
    version:VERSION,
    policy:"gesture-pulse-auto-center",
    triggerDegrees:TRIGGER_DEG,
    releaseDegrees:RELEASE_DEG,
    pulseDegrees:PULSE_DEG,
    pulseMs:PULSE_MS,
    touchFallback:false
  });
}());
