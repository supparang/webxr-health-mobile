(function () {
  const $ = (id) => document.getElementById(id);

  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.style.display = "block";
    clearTimeout(window.__toastTimer);
    window.__toastTimer = setTimeout(() => (t.style.display = "none"), 1400);
  }

  // ตั้งค่าความยากของ Rhythm Boxer
  function getConfig() {
    const diff = APP.state.diff || "normal";
    return diff === "easy"
      ? { speed: 0.7, spawn: 1100 }
      : diff === "hard"
      ? { speed: 1.4, spawn: 650 }
      : { speed: 1.0, spawn: 850 };
  }

  // เริ่มเกม
  function startGame() {
    const root = $("gameRoot");
    while (root.firstChild) root.removeChild(root.firstChild);

    let running = true;

    function spawnBeat() {
      if (!running) return;

      const beat = document.createElement("a-sphere");
      beat.setAttribute("radius", "0.25");
      beat.setAttribute("color", "#39f");

      // ตำแหน่งแบบแถวหน้า
      const x = (Math.random() * 4 - 2).toFixed(2);
      const z = -4;
      beat.setAttribute("position", `${x} 1.4 ${z}`);
      root.appendChild(beat);

      // Animation เคลื่อนเข้าหาผู้เล่น
      const { speed, spawn } = getConfig();
      const duration = Math.max(350, 2600 / speed);
      beat.setAttribute(
        "animation",
        `property: position; to: ${x} 1.4 -0.3; dur: ${duration}; easing: linear`
      );

      // Animation เต้นตามจังหวะ (pulse)
      beat.setAttribute(
        "animation__pulse",
        "property: scale; dir: alternate; dur: 350; easing: easeInOutSine; loop: true; to: 1.3 1.3 1.3"
      );

      // คลิกเพื่อทำลาย
      beat.classList.add("clickable");
      beat.addEventListener("click", () => {
        try {
          root.removeChild(beat);
        } catch (e) {}
      });

      // auto remove เมื่อจบอนิเมชัน
      beat.addEventListener("animationcomplete", () => {
        try {
          root.removeChild(beat);
        } catch (e) {}
      });

      // spawn ลูกต่อไปตาม diff
      setTimeout(spawnBeat, spawn);
    }

    spawnBeat();

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

    // ปุ่มย้อนกลับ
    $("btnBack").onclick = () => {
      location.href = "../hub/index.html";
    };

    // ปุ่มเริ่มเกม
    $("btnStart").onclick = async () => {
      try {
        await APP.audio.init();
      } catch (e) {}
      APP.setState({ scene: "playing" });
      overlay.classList.add("hidden");
      startGame();
      toast("Beat started!");
    };

    // ปุ่มภาษา
    $("btnLang").onclick = () => {
      APP.i18n.set(APP.i18n.current === "en" ? "th" : "en");
    };

    // ปุ่มเปิด-ปิดเสียง
    $("btnMute").onclick = () => {
      const mute = APP.audio.toggle();
      $("btnMute").textContent = mute ? "🔇 Muted" : "🔈 Sound";
    };

    // แสดงสถานะบน HUD
    function render() {
      const s = APP.state;
      status.textContent = `mode:${s.mode} | diff:${s.diff} | lang:${s.lang}`;
    }

    document.addEventListener("app:state-change", render);
    render();
  }

  document.addEventListener("DOMContentLoaded", bindUI);
})();
