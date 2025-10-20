(function () {
  const $ = (id) => document.getElementById(id);

  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.style.display = "block";
    clearTimeout(window.__t);
    window.__t = setTimeout(() => (t.style.display = "none"), 1400);
  }

  // ค่าความเร็วตามความยาก
  function getConfig() {
    const diff = APP.state.diff || "normal";
    return diff === "easy"
      ? { speed: 0.8, spawn: 1200 }
      : diff === "hard"
      ? { speed: 1.4, spawn: 600 }
      : { speed: 1.0, spawn: 900 };
  }

  // เริ่มเกม
  function startGame() {
    const root = $("gameRoot");
    while (root.firstChild) root.removeChild(root.firstChild);

    let running = true;

    // ฟังก์ชันสร้างกล่องโจมตี
    function spawnTarget() {
      if (!running) return;

      const el = document.createElement("a-box");
      el.setAttribute("color", "#f93");
      el.setAttribute("depth", "0.5");
      el.setAttribute("height", "0.5");
      el.setAttribute("width", "0.5");

      // ตำแหน่งสุ่มด้านหน้า
      const x = (Math.random() * 6 - 3).toFixed(2);
      const z = (-3 - Math.random() * 4).toFixed(2);
      el.setAttribute("position", `${x} 1.4 ${z}`);

      root.appendChild(el);

      // เคลื่อนเข้าใส่ผู้เล่น
      const { speed, spawn } = getConfig();
      const duration = Math.max(350, 2800 / speed);
      el.setAttribute(
        "animation",
        `property: position; to: ${x} 1.4 -0.4; dur: ${duration}; easing: linear`
      );

      el.addEventListener("animationcomplete", () => {
        try {
          root.removeChild(el);
        } catch (e) {}
      });

      // ทำลายได้เมื่อคลิก
      el.classList.add("clickable");
      el.addEventListener("click", () => {
        try {
          root.removeChild(el);
        } catch (e) {}
      });

      // สร้างต่อ
      setTimeout(spawnTarget, spawn);
    }

    spawnTarget();

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

    // ปุ่มกลับ Hub
    $("btnBack").onclick = () => {
      location.href = "../hub/index.html";
    };

    // ปุ่ม Start
    $("btnStart").onclick = async () => {
      try {
        await APP.audio.init();
      } catch (e) {}
      APP.setState({ scene: "playing" });
      overlay.classList.add("hidden");
      startGame();
      toast("Start!");
    };

    // ปุ่มภาษา
    $("btnLang").onclick = () => {
      APP.i18n.set(APP.i18n.current === "en" ? "th" : "en");
    };

    // ปุ่มเสียง
    $("btnMute").onclick = () => {
      const mute = APP.audio.toggle();
      $("btnMute").textContent = mute ? "🔇 Muted" : "🔈 Sound";
    };

    // อัปเดตสถานะ
    function render() {
      const s = APP.state;
      status.textContent = `mode:${s.mode} | diff:${s.diff} | lang:${s.lang}`;
    }

    document.addEventListener("app:state-change", render);
    render();
  }

  document.addEventListener("DOMContentLoaded", bindUI);
})();
