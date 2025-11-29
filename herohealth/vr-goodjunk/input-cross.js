// === /HeroHealth/vr-goodjunk/input-cross.js ===
// รวม input ทุกแบบ (เมาส์, แตะหน้าจอ, VR controller / gaze)
// และจัดการ overlay เริ่ม / จบ เกม Good vs Junk VR

export function attachCrossInput({ game, durationMs = 60000 }) {
  const sceneEl = document.getElementById("gameScene");
  const cursorEl = document.getElementById("cursor");

  const uiOverlay = document.getElementById("uiOverlay");
  const startScreen = document.getElementById("startScreen");
  const resultsScreen = document.getElementById("resultsScreen");
  const finalScoreEl = document.getElementById("finalScore");

  const btnEasy = document.getElementById("startButtonEasy");
  const btnNormal = document.getElementById("startButtonNormal");
  const btnHard = document.getElementById("startButtonHard");
  const btnAgain = document.getElementById("playAgainButton");

  let endTimer = null;

  if (!sceneEl || !cursorEl || !uiOverlay) {
    console.warn("[input-cross] missing scene / cursor / overlay element.");
  }

  function hideOverlay() {
    uiOverlay.classList.add("hidden");
  }
  function showOverlay() {
    uiOverlay.classList.remove("hidden");
  }

  function startGame(level) {
    if (!game) return;

    // reset overlay
    startScreen.style.display = "block";
    resultsScreen.style.display = "none";

    hideOverlay();
    game.start(level);

    if (endTimer) clearTimeout(endTimer);
    endTimer = setTimeout(() => {
      // กรณีหมดเวลาเอง
      endGame({ score: window.score || 0 });
    }, durationMs);
  }

  function endGame(detail) {
    if (endTimer) clearTimeout(endTimer);
    endTimer = null;

    if (game) {
      // stop ภายในจะ emit hha:end อยู่แล้ว แต่เรียกซ้ำได้ปลอดภัย
      game.stop();
    }

    const score = detail && typeof detail.score === "number"
      ? detail.score
      : (window.score || 0);

    finalScoreEl.textContent = `คะแนน: ${score}`;
    startScreen.style.display = "none";
    resultsScreen.style.display = "block";
    showOverlay();
  }

  // ปุ่มเริ่ม
  if (btnEasy)   btnEasy.addEventListener("click", () => startGame("easy"));
  if (btnNormal) btnNormal.addEventListener("click", () => startGame("normal"));
  if (btnHard)   btnHard.addEventListener("click", () => startGame("hard"));

  // ปุ่มเล่นอีกครั้ง
  if (btnAgain) {
    btnAgain.addEventListener("click", () => {
      resultsScreen.style.display = "none";
      startScreen.style.display = "block";
    });
  }

  // ฟัง event จบเกมจาก engine (กรณี engine เรียก hha:end เอง)
  window.addEventListener("hha:end", (ev) => {
    const d = ev.detail || {};
    endGame(d);
  });

  // ===== INPUT: VR / Mobile / Mouse =====

  // 1) generic 'click' บน target entity (VR controller + mobile gaze + mouse)
  if (sceneEl) {
    sceneEl.addEventListener("click", (ev) => {
      const t = ev.target;
      if (!t || !t.dataset || !t.dataset.hhaTgt) return;
      if (!game) return;
      game.hitTarget(t);
    });
  }

  // 2) support mouse แบบ “คลิก canvas ตาม cursor” เฉพาะ PC
  function hookCanvasMouse(scene) {
    const canvas = scene && scene.canvas;
    if (!canvas || !cursorEl) return;

    canvas.addEventListener("mousedown", () => {
      if (!game) return;
      const rayComp = cursorEl.components && cursorEl.components.raycaster;
      if (!rayComp || !rayComp.intersectedEls || !rayComp.intersectedEls.length) return;
      const target = rayComp.intersectedEls[0];
      if (target && target.dataset && target.dataset.hhaTgt) {
        game.hitTarget(target);
      }
    });
  }

  if (sceneEl && sceneEl.hasLoaded) {
    hookCanvasMouse(sceneEl);
  } else if (sceneEl) {
    sceneEl.addEventListener("loaded", () => hookCanvasMouse(sceneEl));
  }
}
