(function () {
  const $ = (id) => document.getElementById(id);

  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.style.display = "block";
    clearTimeout(window.__toastHold);
    window.__toastHold = setTimeout(() => (t.style.display = "none"), 1400);
  }

  // Config ความยากสำหรับ Balance Hold
  function getConfig() {
    const diff = APP.state.diff || "normal";
    return diff === "easy"
      ? { holdTime: 1200, spawn: 1800 }
      : diff === "hard"
      ? { holdTime: 700, spawn: 1000 }
      : { holdTime: 900, spawn: 1400 };
  }

  // สร้าง "ด่านทรงตัว" แบบกดค้าง Hold
  function startGame() {
    const root = $("gameRoot");
    while (root.firstChild) root.removeChild(root.firstChild);

    let running = true;

    function spawnBalancePoint() {
      if (!running) return;

      const point = document.createElement("a-sphere");
      point.setAttribute("radius", "0.28");
      point.setAttribute("color", "#fced13");

      // สุ่มตำแหน่งด้านหน้า
      const x = (Math.random() * 4 - 2).toFixed(2);
      const y = (Math.random() * 1 + 1).toFixed(2);
      point.setAttribute("position", `${x} ${y} -3`);

      // ปล่อยออกมาทีละลูก
      root.appendChild(point);

      // Animation ให้ดูเหมือนสั่นๆ ต้องประคอง
      point.setAttribute(
        "animation__pulse",
        "property: scale; dir: alternate; dur: 600; easing: easeInOutSine; loop: true; to: 1.2 1.2 1.2"
      );

      // ต้องค้างให้ครบเวลาเพื่อให้หายไป
      point.addEventListener("click", () => {
        const hold = getConfig().holdTime;
        setTimeout(() => {
          try {
            root.removeChild(point);
          } catch (e) {}
        }, hold);
      });

      // spawn ต่อ
      setTimeout(spawnBalancePoint, getConfig().spawn);
    }

    spawnBalancePoint();

    // หยุดเมื่อออกหน้า
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

    // กลับ Hub
    $("btnBack").onclick = () => {
      location.href = "../hub/index.html";
    };

    // เริ่มเกม
    $("btnStart").onclick = async () => {
      try {
        await APP.audio.init();
      } catch (e) {}
      APP.setState({ scene: "playing" });
      overlay.classList.add("hidden");
      startGame();
      toast("Hold steady!");
    };

    // ภาษา
    $("btnLang").onclick = () => {
      APP.i18n.set(APP.i18n.current === "en" ? "th" : "en");
    };

    // ปิด/เปิดเสียง
    $("btnMute").onclick = () => {
      const muted = APP.audio.toggle();
      $("btnMute").textContent = muted ? "🔇 Muted" : "🔈 Sound";
    };

    // สถานะ HUD
    function render() {
      const s = APP.state;
      status.textContent = `mode:${s.mode} | diff:${s.diff} | lang:${s.lang}`;
    }
    document.addEventListener("app:state-change", render);
    render();
  }

  document.addEventListener("DOMContentLoaded", bindUI);
})();
