// /vr-fitness/games/shadow-breaker/game.js
// Minimal boot-safe game.js (no imports) to prevent black screen.
// Reads window.HubLaunch, runs a simple timed loop, reports score/combo,
// supports pause/resume via window.Game.setPaused (used by hub-adapter).

(function(){
  "use strict";

  // ---------- Config from Hub ----------
  const L = (window.HubLaunch || {});
  const GAME_ID = "shadow-breaker";
  const DIFF = (L.diff || "normal");
  const MODE = (L.mode || "timed");
  const DURATION = Math.max(30, Math.min(180, Number(L.time || 90))); // seconds

  // ---------- DOM scaffolding ----------
  const root = document.createElement("div");
  root.id = "sb-root";
  root.style.position = "fixed";
  root.style.inset = "0";
  root.style.background = "#000";
  root.style.color = "#fff";
  root.style.font = "16px/1.4 system-ui,Segoe UI,Inter,Arial";
  root.style.display = "grid";
  root.style.placeItems = "center";
  root.style.userSelect = "none";

  root.innerHTML = `
    <div id="sb-ui" style="text-align:center">
      <div style="opacity:.8;font-size:14px;margin-bottom:6px">VR Fitness — <b>Shadow Breaker</b></div>
      <div style="font-size:40px;font-weight:800;margin:6px 0" id="sb-time">--:--</div>
      <div style="font-size:18px;margin:6px 0">Diff: <b id="sb-diff"></b> | Mode: <b id="sb-mode"></b></div>
      <div style="display:flex;gap:18px;justify-content:center;margin-top:10px">
        <div>Score<br><b id="sb-score" style="font-size:22px">0</b></div>
        <div>Combo<br><b id="sb-combo" style="font-size:22px">0</b></div>
        <div>Stars<br><b id="sb-stars" style="font-size:22px">0</b></div>
      </div>
      <div style="margin-top:18px;opacity:.7;font-size:13px">
        (ทดสอบระบบ Hub: คลิก/แตะเพื่อ +คะแนน, ระบบจะส่ง score/เวลา ให้ Hub ทุกวินาที)
      </div>
      <button id="sb-add" style="margin-top:12px;padding:8px 12px;border-radius:10px;border:0;background:#76e1ff;color:#001018;font-weight:700;cursor:pointer">
        + Hit!
      </button>
    </div>
  `;
  document.body.appendChild(root);

  // ---------- State ----------
  let score = 0;
  let combo = 0;
  let bestCombo = 0;
  let stars = 0;
  let timeLeft = DURATION;
  let paused = false;
  let tickTimer = null;
  let secTimer = null;

  // ---------- UI refs ----------
  const elTime  = document.getElementById("sb-time");
  const elScore = document.getElementById("sb-score");
  const elCombo = document.getElementById("sb-combo");
  const elStars = document.getElementById("sb-stars");
  const elDiff  = document.getElementById("sb-diff");
  const elMode  = document.getElementById("sb-mode");
  const btnAdd  = document.getElementById("sb-add");

  elDiff.textContent = DIFF;
  elMode.textContent = MODE;

  // ---------- Helpers ----------
  const pad = (n)=> (n<10? "0"+n : ""+n);
  function fmtTime(sec){
    sec = Math.max(0, Math.floor(sec));
    return `${pad(Math.floor(sec/60))}:${pad(sec%60)}`;
  }
  function updateStars(){
    // very simple thresholds (you can tune later)
    const pct = 1 - (timeLeft / DURATION);
    const target = (score >= 100 ? 3 : score >= 50 ? 2 : score >= 20 ? 1 : 0);
    stars = Math.max(stars, target);
    elStars.textContent = stars;
    return stars;
  }
  function render(){
    elTime.textContent = fmtTime(timeLeft);
    elScore.textContent = String(score);
    elCombo.textContent = String(combo);
  }

  function onHit(){
    if (paused || timeLeft <= 0) return;
    const diffMul = (DIFF === "easy" ? 1 : DIFF === "hard" ? 2 : DIFF === "final" ? 3 : 1.5);
    const gain = Math.floor(1 * diffMul + combo * 0.2);
    score += Math.max(1, gain);
    combo += 1;
    if(combo > bestCombo) bestCombo = combo;
    updateStars();
    render();
  }

  // ---------- Public API for hub-adapter ----------
  window.Game = window.Game || {};
  window.Game.setPaused = function(flag){
    paused = !!flag;
  };

  // ---------- Core loop (per-frame) ----------
  function frameTick(){
    if (!paused && timeLeft > 0){
      // (optional visual effects per-frame later)
    }
    tickTimer = requestAnimationFrame(frameTick);
  }

  // ---------- Sec tick: time and report to Hub ----------
  function secTick(){
    if (!paused && timeLeft > 0){
      timeLeft -= 1;
      if (typeof window.HubScoreTick === "function"){
        try {
          window.HubScoreTick(score, combo, Math.max(0, timeLeft), stars);
        } catch(e){}
      }
      if (timeLeft <= 0){
        endGame();
        return;
      }
      render();
    }
    secTimer = setTimeout(secTick, 1000);
  }

  function endGame(){
    if (tickTimer) cancelAnimationFrame(tickTimer);
    if (secTimer)  clearTimeout(secTimer);
    // finalize stars one more time
    updateStars();
    // send summary to Hub
    if (typeof window.HubGameEnd === "function"){
      try {
        window.HubGameEnd({ score, maxCombo: bestCombo, stars, time: DURATION });
      } catch(e){}
    }
    // show simple overlay end state
    const end = document.createElement("div");
    end.style.position = "fixed";
    end.style.inset = "0";
    end.style.display = "grid";
    end.style.placeItems = "center";
    end.style.background = "rgba(0,0,0,.55)";
    end.innerHTML = `
      <div style="background:#121528;border:1px solid #2a2f4a;border-radius:14px;padding:16px 18px;text-align:center;max-width:90vw">
        <div style="font-size:18px;margin-bottom:8px"><b>Finished!</b></div>
        <div>Score: <b>${score}</b> | Best Combo: <b>${bestCombo}</b> | Stars: <b>${stars}</b></div>
        <div style="opacity:.8;font-size:12px;margin-top:8px">กด Back ที่ Hub เพื่อกลับ หรือกด Retry ใน Hub</div>
      </div>`;
    document.body.appendChild(end);
  }

  // ---------- Wire events ----------
  btnAdd.addEventListener("click", onHit);

  // First render + start loops
  render();
  tickTimer = requestAnimationFrame(frameTick);
  secTimer  = setTimeout(secTick, 1000);

  // Tell Hub we are ready (if adapter already injected)
  if (typeof window.HubGameReady === "function"){
    try{ window.HubGameReady(); }catch(e){}
  }

})();
