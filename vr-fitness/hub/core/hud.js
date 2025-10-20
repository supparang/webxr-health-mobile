(function () {
  window.APP = window.APP || {};
  const U = () => APP.utils; // shorthand

  // สร้าง DOM HUD ด้านบน (ร่วมกับปุ่มที่หน้าเกมอยู่แล้ว)
  function ensureHUD() {
    let bar = document.getElementById("vrfit-hudbar");
    if (bar) return bar;

    bar = document.createElement("div");
    bar.id = "vrfit-hudbar";
    bar.style.position = "fixed";
    bar.style.top = "44px"; // หลบแถวปุ่มบนสุดของแต่ละหน้า
    bar.style.left = "0";
    bar.style.right = "0";
    bar.style.display = "flex";
    bar.style.gap = "8px";
    bar.style.padding = "10px";
    bar.style.zIndex = "9";
    bar.style.pointerEvents = "none";

    const pill = (id, label) => {
      const el = document.createElement("div");
      el.id = id;
      el.style.background = "#151515";
      el.style.border = "1px solid #2a2a2a";
      el.style.borderRadius = "999px";
      el.style.padding = "6px 10px";
      el.style.color = "#eaeaea";
      el.style.fontFamily = "system-ui,Segoe UI,Roboto,Arial,sans-serif";
      el.style.fontSize = "14px";
      el.style.pointerEvents = "auto";
      el.textContent = label;
      return el;
    };

    const left = document.createElement("div");
    left.style.display = "flex";
    left.style.gap = "8px";

    const right = document.createElement("div");
    right.style.display = "flex";
    right.style.gap = "8px";
    right.style.marginLeft = "auto";

    left.appendChild(pill("hud-game", "Game"));
    left.appendChild(pill("hud-mode", "Mode"));
    left.appendChild(pill("hud-diff", "Diff"));

    right.appendChild(pill("hud-time", "Time 00:00"));
    right.appendChild(pill("hud-combo", "Combo x0"));
    right.appendChild(pill("hud-score", "Score 0"));

    bar.appendChild(left);
    bar.appendChild(right);
    document.body.appendChild(bar);
    return bar;
  }

  // สร้าง/อัปเดตจอดำท้ายเกม
  function ensureGameOver() {
    let wrap = document.getElementById("vrfit-gameover");
    if (wrap) return wrap;

    wrap = document.createElement("div");
    wrap.id = "vrfit-gameover";
    wrap.style.position = "fixed";
    wrap.style.inset = "0";
    wrap.style.display = "none";
    wrap.style.alignItems = "center";
    wrap.style.justifyContent = "center";
    wrap.style.background = "rgba(0,0,0,.7)";
    wrap.style.zIndex = "50";

    const panel = document.createElement("div");
    panel.style.background = "#111";
    panel.style.color = "#fff";
    panel.style.padding = "22px";
    panel.style.borderRadius = "16px";
    panel.style.minWidth = "280px";
    panel.style.border = "1px solid #222";
    panel.style.fontFamily = "system-ui,Segoe UI,Roboto,Arial,sans-serif";
    panel.style.textAlign = "center";

    panel.innerHTML = `
      <h3 style="margin:0 0 6px 0">Workout Complete</h3>
      <p id="vrfit-go-stats" style="opacity:.85;margin:8px 0 16px 0">Time 00:00 · Score 0 · Best Combo x0</p>
      <div style="display:flex;gap:8px;justify-content:center">
        <button id="vrfit-go-restart" style="padding:8px 12px;border-radius:10px;border:1px solid #2a2a2a;background:#1e90ff;color:#fff">Restart</button>
        <button id="vrfit-go-hub" style="padding:8px 12px;border-radius:10px;border:1px solid #2a2a2a;background:#222;color:#fff">Hub</button>
      </div>
    `;
    wrap.appendChild(panel);
    document.body.appendChild(wrap);
    return wrap;
  }

  // สถานะภายใน HUD
  const state = {
    timer: null,
    score: null,
    running: false,
    totalTimeSec: 60,
    mode: "down", // "down" = นับถอยหลัง, "up" = นับขึ้น (สำหรับ free)
    onRestart: null,
    gameKey: "game",
  };

  function renderStatic() {
    const s = APP.state || {};
    const tGame = document.getElementById("hud-game");
    const tMode = document.getElementById("hud-mode");
    const tDiff = document.getElementById("hud-diff");

    if (tGame) tGame.textContent = `Game ${s.game || ""}`;
    if (tMode) tMode.textContent = `Mode ${s.mode || ""}`;
    if (tDiff) tDiff.textContent = `Diff ${s.diff || ""}`;
  }

  function renderDynamic(t, sc) {
    const timeEl = document.getElementById("hud-time");
    const comboEl = document.getElementById("hud-combo");
    const scoreEl = document.getElementById("hud-score");

    if (timeEl) {
      const val = state.mode === "down" ? t.remaining : t.value;
      timeEl.textContent = `Time ${U().fmtTime(val)}`;
    }
    if (comboEl) comboEl.textContent = `Combo x${sc.combo}`;
    if (scoreEl) scoreEl.textContent = `Score ${sc.score}`;
  }

  // --- API สำหรับเกมเรียกใช้ ---

  // เรียกครั้งเดียวตอนหน้าเกมโหลด
  function mount(gameKey, { onRestart } = {}) {
    ensureHUD();
    ensureGameOver();
    state.onRestart = onRestart || null;
    state.gameKey = gameKey || "game";
    renderStatic();
  }

  // เรียกตอนเริ่มเกมจริง (หลังผู้เล่นกด Start)
  function start() {
    if (state.running) return;
    state.running = true;

    // เลือกโหมดตาม APP.state.mode
    const s = APP.state || {};
    state.mode = s.mode === "free" ? "up" : "down";
    state.totalTimeSec = s.mode === "free" ? 3600 : 60; // free = สูงไว้ก่อน (1 ชม.), timed = 60s

    // สร้าง score + timer
    state.score = APP.utils.createScore();

    state.timer = U().createTimer({
      duration: state.totalTimeSec,
      mode: state.mode,
      onTick: (t) => {
        renderDynamic(t, state.score.get());
      },
      onDone: () => {
        finish();
      },
    });
  }

  // ให้เกมเรียกเมื่อผู้เล่นตีโดน/ทำถูก
  function hit(points = 1) {
    if (!state.running || !state.score) return;
    state.score.add(points);
  }

  // ให้เกมเรียกเมื่อพลาด
  function miss() {
    if (!state.running || !state.score) return;
    state.score.miss();
  }

  // เรียกเมื่อจบเกม (หมดเวลา หรือเกมสั่งจบเอง)
  function finish() {
    if (!state.running) return;
    state.running = false;
    if (state.timer) {
      state.timer.stop();
      state.timer = null;
    }

    // แสดงสรุป
    const res = state.score ? state.score.get() : { score: 0, combo: 0, bestCombo: 0, hits: 0, misses: 0 };
    const s = APP.state || {};
    const statsEl = document.getElementById("vrfit-go-stats");
    const txt = `Mode ${s.mode || ""} · Score ${res.score} · Best Combo x${res.bestCombo}`;
    if (statsEl) statsEl.textContent = txt;

    // บันทึกผล
    U().saveResult(state.gameKey, {
      mode: s.mode || "",
      diff: s.diff || "",
      score: res.score,
      bestCombo: res.bestCombo,
      hits: res.hits,
      misses: res.misses,
    });

    const wrap = ensureGameOver();
    wrap.style.display = "flex";

    // ปุ่มในหน้าจบเกม
    const btnHub = document.getElementById("vrfit-go-hub");
    const btnRestart = document.getElementById("vrfit-go-restart");
    if (btnHub) {
      btnHub.onclick = () => (location.href = "../hub/index.html");
    }
    if (btnRestart) {
      btnRestart.onclick = () => {
        wrap.style.display = "none";
        // รีเซ็ตคะแนนใหม่
        state.score && state.score.reset();
        // ให้เกมรีสตาร์ตสภาพภายใน (เช่น ล้างเป้า/สปอว์นใหม่)
        if (typeof state.onRestart === "function") state.onRestart();
        // เริ่มจับเวลาใหม่
        start();
      };
    }

    // แจ้ง event เผื่อเกมอยากฟัง
    document.dispatchEvent(new CustomEvent("vrfit:game-end", { detail: { result: res } }));
  }

  APP.hud = { mount, start, hit, miss, finish };
})();
