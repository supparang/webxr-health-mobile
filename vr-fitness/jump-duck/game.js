(function () {
  const $ = (id) => document.getElementById(id);

  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.style.display = "block";
    clearTimeout(window.__toastJump);
    window.__toastJump = setTimeout(() => (t.style.display = "none"), 1400);
  }

  // ความยากของเกม Jump & Duck
  function getConfig() {
    const diff = APP.state.diff || "normal";
    return diff === "easy"
      ? { speed: 0.9, spawn: 1300 }
      : diff === "hard"
      ? { speed: 1.4, spawn: 700 }
      : { speed: 1.1, spawn: 950 };
  }

  // เริ่มเกม
  function startGame() {
    const root = $("gameRoot");
    while (root.firstChild) root.removeChild(root.firstChild);

    let running = true;

    function spawnObstacle() {
      if (!running) return;

      // สุ่มแบบสิ่งกีดขวาง: สูงให้ก้ม (duck) หรือเตี้ยให้กระโดด (jump)
      const isHigh = Math.random() > 0.5;
      const block = document.createElement("a-box");
      block.setAttribute("color", isHigh ? "#ff4040" : "#40ff40");
      block.classList.add("obstacle");

      // กำหนดขนาดและตำแหน่ง
      const height = isHigh ? 2.2 : 0.6;
      const y = isHigh ? 1.1 : 0.3;
      block.setAttribute("position", `0 ${y} -6`);
      block.setAttribute("scale", `3 ${height} 0.5`);

      root.appendChild(block);

      // เคลื่อนเข้าหาผู้เล่น
      const { speed, spawn } = getConfig();
      block.setAttribute(
        "animation",
        `property: position; to: 0 ${y} -0.5; dur: ${3000 / speed}; easing: linear`
      );

      block.addEventListener("animationcomplete", () => {
        try {
          root.removeChild(block);
        } catch (e) {}
      });

      // spawn ต่อ
      setTimeout(spawnObstacle, spawn);
    }

    spawnObstacle();

    window.addEventListener(
      "beforeunload",
      () => {
        running = false;
      },
      { once: true }
    );
  }

  function bindUI() {
    const overlay = $("overlay");
    const status = $("status");

    // ปุ่มกลับ
    $("btnBack").onclick = () => {
      location.href = "../hub/index.html";
    };

    // ปุ่มเริ่ม
    $("btnStart").onclick = async () => {
      try {
        await APP.audio.init();
      } catch (e) {}
      APP.setState({ scene: "playing" });
      overlay.classList.add("hidden");
      startGame();
      toast("Go! Jump or Duck!");
    };

    // เปลี่ยนภาษา
    $("btnLang").onclick = () => {
      APP.i18n.set(APP.i18n.current === "en" ? "th" : "en");
    };

    // ปิด/เปิดเสียง
    $("btnMute").onclick = () => {
      const muted = APP.audio.toggle();
      $("btnMute").textContent = muted ? "🔇 Muted" : "🔈 Sound";
    };

    // แสดงสถานะ HUD
    function render() {
      const s = APP.state;
      status.textContent = `mode:${s.mode} | diff:${s.diff} | lang:${s.lang}`;
    }
    document.addEventListener("app:state-change", render);
    render();
  }

  document.addEventListener("DOMContentLoaded", bindUI);
})();
