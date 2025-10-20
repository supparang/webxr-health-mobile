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
    clearTimeout(window.__toastJump);
    window.__toastJump = setTimeout(() => (t.style.display = "none"), 1400);
  }

  function getConfig() {
    const diff = APP.state.diff || "normal";
    return diff === "easy"
      ? { speed: 0.9, spawn: 1300 }
      : diff === "hard"
      ? { speed: 1.4, spawn: 700 }
      : { speed: 1.1, spawn: 950 };
  }

  let running = false;

  function startGame() {
    const root = $("gameRoot");
    while (root.firstChild) root.removeChild(root.firstChild);
    running = true;

    function spawnObstacle() {
      if (!running) return;

      // สุ่มชนิดสิ่งกีดขวาง: สูง = ต้อง "Duck" / เตี้ย = ต้อง "Jump"
      const isHigh = Math.random() > 0.5;
      const block = document.createElement("a-box");
      block.setAttribute("color", isHigh ? "#ff4040" : "#40ff40");
      block.classList.add("obstacle");

      const height = isHigh ? 2.2 : 0.6;
      const y = isHigh ? 1.1 : 0.3;
      block.setAttribute("position", `0 ${y} -6`);
      block.setAttribute("scale", `3 ${height} 0.5`);
      $("gameRoot").appendChild(block);

      const { speed, spawn } = getConfig();
      const dur = Math.max(300, 3000 / speed);
      block.setAttribute(
        "animation",
        `property: position; to: 0 ${y} -0.5; dur: ${dur}; easing: linear`
      );

      // ถ้ามาถึงผู้เล่น = พลาด
      block.addEventListener("animationcomplete", () => {
        try { $("gameRoot").removeChild(block); } catch (e) {}
        APP.hud.miss();
      });

      // คลิกบล็อกให้หาย = ถือว่าหลบถูก (ให้คะแนนเล็กน้อย)
      block.classList.add("clickable");
      block.addEventListener("click", () => {
        try { $("gameRoot").removeChild(block); } catch (e) {}
        APP.hud.hit(5);
      });

      setTimeout(spawnObstacle, spawn);
    }

    spawnObstacle();
  }

  function bindUI() {
    const overlay = $("overlay");
    const status = $("status");

    // ติดตั้ง HUD
    APP.hud.mount("jump-duck", {
      onRestart: () => {
        startGame();
      },
    });

    $("btnBack").onclick = () => (location.href = "../hub/index.html");

    $("btnStart").onclick = async () => {
      try { await APP.audio.init(); } catch (e) {}
      overlay.classList.add("hidden");
      startGame();     // เริ่มสปอว์นสิ่งกีดขวาง
      APP.hud.start(); // เริ่มจับเวลา/คะแนน
      toast("Go! Jump or Duck!");
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

    // จบเกมเมื่อหมดเวลา
    document.addEventListener("vrfit:game-end", () => {
      running = false;
    });
  }

  document.addEventListener("DOMContentLoaded", bindUI);
})();
