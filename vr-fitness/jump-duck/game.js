(function () {
  const $ = (id) => document.getElementById(id);

  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.style.display = "block";
    clearTimeout(window.__toastBeat);
    window.__toastBeat = setTimeout(() => (t.style.display = "none"), 1400);
  }

  // ความยากของ Rhythm Boxer
  function getConfig() {
    const diff = APP.state.diff || "normal";
    return diff === "easy"
      ? { speed: 0.8, spawn: 1100 }
      : diff === "hard"
      ? { speed: 1.4, spawn: 650 }
      : { speed: 1.0, spawn: 850 };
  }

  let running = false;

  function startGame() {
    const root = $("gameRoot");
    while (root.firstChild) root.removeChild(root.firstChild);
    running = true;

    function spawnBeat() {
      if (!running) return;

      const beat = document.createElement("a-sphere");
      beat.setAttribute("radius", "0.25");
      beat.setAttribute("color", "#39f");

      // แถวหน้ากึ่งกลาง ซ้าย/ขวาแบบสุ่มเล็กน้อย
      const x = (Math.random() * 4 - 2).toFixed(2);
      const z = -4;
      beat.setAttribute("position", `${x} 1.4 ${z}`);
      root.appendChild(beat);

      const { speed, spawn } = getConfig();
      const dur = Math.max(320, 2600 / speed);

      // เคลื่อนเข้าหาผู้เล่น + เต้นเป็นจังหวะ
      beat.setAttribute("animation__move", `property: position; to: ${x} 1.4 -0.3; dur: ${dur}; easing: linear`);
      beat.setAttribute("animation__pulse", "property: scale; dir: alternate; dur: 350; easing: easeInOutSine; loop: true; to: 1.3 1.3 1.3");

      // โดน = คลิกทำลาย (ให้คะแนน)
      beat.classList.add("clickable");
      beat.addEventListener("click", () => {
        try { root.removeChild(beat); } catch (e) {}
        APP.hud.hit(8); // แต้มพื้นฐาน 8 ต่อโน้ต
      });

      // พลาด = มาถึงระยะ -0.3 แล้วไม่โดน
      beat.addEventListener("animation__move-complete", () => {
        try { root.removeChild(beat); } catch (e) {}
        APP.hud.miss();
      });

      // สร้างลูกต่อไปตาม diff
      setTimeout(spawnBeat, spawn);
    }

    spawnBeat();
  }

  function bindUI() {
    const overlay = $("overlay");
    const status = $("status");

    // ติดตั้ง HUD
    APP.hud.mount("rhythm-boxer", {
      onRestart: () => {
        startGame();
      },
    });

    $("btnBack").onclick = () => {
      location.href = "../hub/index.html";
    };

    $("btnStart").onclick = async () => {
      try { await APP.audio.init(); } catch (e) {}
      overlay.classList.add("hidden");
      startGame();     // เริ่มสปอว์น
      APP.hud.start(); // เริ่มจับเวลา/คะแนน
      toast("Beat started!");
    };

    $("btnLang").onclick = () => {
      APP.i18n.set(APP.i18n.current === "en" ? "th" : "en");
    };

    $("btnMute").onclick = () => {
      const mute = APP.audio.toggle();
      $("btnMute").textContent = mute ? "🔇 Muted" : "🔈 Sound";
    };

    function render() {
      const s = APP.state;
      status.textContent = `mode:${s.mode} | diff:${s.diff}`;
    }
    document.addEventListener("app:state-change", render);
    render();

    // จบเกมเมื่อหมดเวลา (HUD จะยิง event ให้)
    document.addEventListener("vrfit:game-end", () => {
      running = false;
    });
  }

  document.addEventListener("DOMContentLoaded", bindUI);
})();
