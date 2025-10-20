function cameraPos() {
  const cam = document.querySelector("[camera]");
  return cam ? cam.object3D.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(0,1.6,0);
}

function isValidStrike(targetEl, { minZ = -1.0, maxDist = 0.9 } = {}) {
  // เงื่อนไข: เป้าอยู่เลย z <= minZ (เข้ามาใกล้พอ) และระยะจากกล้องไม่เกิน maxDist
  const p = new THREE.Vector3();
  targetEl.object3D.getWorldPosition(p);
  const cam = cameraPos();
  const dz = p.z - cam.z;
  const dist = p.distanceTo(cam);
  return (p.z <= minZ) && (dist <= maxDist);
}

(function () {
  const $ = (id) => document.getElementById(id);

  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.style.display = "block";
    clearTimeout(window.__toastHold);
    window.__toastHold = setTimeout(() => (t.style.display = "none"), 1400);
  }

  function getConfig() {
    const diff = APP.state.diff || "normal";
    return diff === "easy"
      ? { holdTime: 1200, spawn: 1800, points: 6 }
      : diff === "hard"
      ? { holdTime: 700, spawn: 1000, points: 10 }
      : { holdTime: 900, spawn: 1400, points: 8 };
  }

  let running = false;

  function startGame() {
    const root = $("gameRoot");
    while (root.firstChild) root.removeChild(root.firstChild);
    running = true;

    function spawnBalancePoint() {
      if (!running) return;

      const cfg = getConfig();
      const point = document.createElement("a-sphere");
      point.setAttribute("radius", "0.28");
      point.setAttribute("color", "#fced13");

      const x = (Math.random() * 4 - 2).toFixed(2);
      const y = (Math.random() * 1 + 1).toFixed(2);
      const z = -3;
      point.setAttribute("position", `${x} ${y} ${z}`);
      root.appendChild(point);

      point.setAttribute(
        "animation__pulse",
        "property: scale; dir: alternate; dur: 600; easing: easeInOutSine; loop: true; to: 1.2 1.2 1.2"
      );

      // กดครั้งเดียวเพื่อ "เริ่มถือ" (simulate hold)
      let held = false, holdTimer = null;
      point.addEventListener("click", () => {
        if (held) return; // กันกดซ้ำ
        held = true;
        // ถือครบเวลา → ได้คะแนน และหายไป
        holdTimer = setTimeout(() => {
          try { root.removeChild(point); } catch (e) {}
          APP.hud.hit(cfg.points);
        }, cfg.holdTime);
      });

      // กัน memory leak
      point.addEventListener("removed", () => {
        if (holdTimer) clearTimeout(holdTimer);
      });

      // สร้างเป้าต่อไป
      setTimeout(spawnBalancePoint, cfg.spawn);
    }

    spawnBalancePoint();
  }

  function bindUI() {
    const overlay = $("overlay");
    const status = $("status");

    // ติดตั้ง HUD
    APP.hud.mount("balance-hold", {
      onRestart: () => {
        startGame();
      },
    });

    $("btnBack").onclick = () => (location.href = "../hub/index.html");

    $("btnStart").onclick = async () => {
      try { await APP.audio.init(); } catch (e) {}
      overlay.classList.add("hidden");
      startGame();     // เริ่มสปอว์นเป้าทรงตัว
      APP.hud.start(); // เริ่มจับเวลา/คะแนน
      toast("Hold steady!");
    };

    $("btnLang").onclick = () =>
      APP.i18n.set(APP.i18n.current === "en" ? "th" : "en");

    $("btnMute").onclick = () => {
      const muted = APP.audio.toggle();
      $("btnMute").textContent = muted ? "🔇 Muted" : "🔈 Sound";
    };

    function render() {
      const s = APP.state;
      status.textContent = `mode:${s.mode} | diff:${s.diff}`;
    }
    document.addEventListener("app:state-change", render);
    render();

    // เมื่อ HUD ส่งสัญญาณจบเกม (หมดเวลา)
    document.addEventListener("vrfit:game-end", () => {
      running = false;
    });
  }

  document.addEventListener("DOMContentLoaded", bindUI);
})();
