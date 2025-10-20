(function () {
  window.APP = window.APP || {};

  // format วินาที → mm:ss
  function fmtTime(sec) {
    const s = Math.max(0, Math.floor(sec));
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const r = (s % 60).toString().padStart(2, "0");
    return `${m}:${r}`;
  }

  // Simple timer (countdown หรือ countup)
  function createTimer({ duration = 60, mode = "down", onTick, onDone }) {
    let start = performance.now();
    let raf = null;
    let stopped = false;

    function tick(now) {
      if (stopped) return;
      const elapsed = (now - start) / 1000;
      const remaining = Math.max(0, duration - elapsed);
      const value = mode === "down" ? remaining : elapsed;
      onTick && onTick({ elapsed, remaining, value });
      if (mode === "down" && remaining <= 0) {
        onDone && onDone();
        return;
      }
      raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);

    return {
      stop() {
        stopped = true;
        if (raf) cancelAnimationFrame(raf);
      },
      // สำหรับหยุด-เริ่มต่อในอนาคต ถ้าต้องการ
    };
  }

  function createScore() {
    const state = { score: 0, combo: 0, bestCombo: 0, hits: 0, misses: 0 };
    return {
      add(points = 1) {
        state.combo += 1;
        state.bestCombo = Math.max(state.bestCombo, state.combo);
        state.score += points * state.combo; // ให้แต้มทวีคูณตามคอมโบเล็กน้อย
        state.hits += 1;
        return { ...state };
      },
      miss() {
        state.combo = 0;
        state.misses += 1;
        return { ...state };
      },
      get() {
        return { ...state };
      },
      reset() {
        state.score = 0;
        state.combo = 0;
        state.bestCombo = 0;
        state.hits = 0;
        state.misses = 0;
      },
    };
  }

  // บันทึกผลแบบง่าย ๆ ต่อเกม ลง localStorage
  function saveResult(gameKey, result) {
    try {
      const KEY = `vrfit:${gameKey}:results`;
      const list = JSON.parse(localStorage.getItem(KEY) || "[]");
      list.unshift({ ts: Date.now(), ...result });
      localStorage.setItem(KEY, JSON.stringify(list.slice(0, 20))); // เก็บล่าสุด 20 รายการ
    } catch (e) {
      console.warn("saveResult failed", e);
    }
  }

  APP.utils = { fmtTime, createTimer, createScore, saveResult };
})();
