// === VR Fitness — Shadow Breaker (minimal playable core) ===
// ES Module (โหลดจาก play.html)
// - อ่านพารามิเตอร์จาก window.HubLaunch
// - HUD: Timer / Diff / Mode / Score / Combo / Stars / ปุ่ม Hit!
// - Logic: กด Hit เพิ่มคะแนน+คอมโบ, นับเวลาถอยหลัง, คิดดาวจากประสิทธิภาพ
// - Integration: ส่ง tick ให้ Hub ทุก 1s และส่ง GameEnd เมื่อหมดเวลา
// - Pause on blur + รับ message 'hub:pause' จาก Hub

(function(){
  "use strict";

  // ---------- Launch Params ----------
  const L = window.HubLaunch || {};
  const GAME_ID = "shadow-breaker";
  const MODE = (L.mode||"timed");
  const DIFF = (L.diff||"normal");
  const TOTAL_TIME = clamp(+L.time || 90, 30, 180); // seconds

  // ---------- State ----------
  let timeLeft = TOTAL_TIME;
  let score = 0;
  let combo = 0;
  let bestCombo = 0;
  let paused = false;
  let started = false;
  let finished = false;

  // ---------- Helpers ----------
  function $(s){ return document.querySelector(s); }
  function clamp(n,a,b){ return Math.max(a, Math.min(b, n)); }
  function fmtTime(sec){
    const m = Math.floor(sec/60);
    const s = Math.floor(sec%60);
    return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
  }
  function sendToHub(type, data){
    try{
      if(window.parent && window.parent !== window){
        window.parent.postMessage({type, game: GAME_ID, ...data}, "*");
      }
    }catch(e){}
  }

  // ดาว 0–5 จาก “ประสิทธิภาพต่อวินาที” ปรับด้วย difficulty
  function starsFor(score, elapsed){
    const sec = Math.max(1, elapsed);
    const rate = score / sec; // คะแนนต่อวินาที
    const diffMul = { easy:0.85, normal:1.0, hard:1.2, final:1.35 }[DIFF] || 1.0;

    // เกณฑ์แบบนุ่มนวล (คะแนน/วินาที)
    const t1 = 0.6 * diffMul;  // ★1
    const t2 = 1.0 * diffMul;  // ★2
    const t3 = 1.6 * diffMul;  // ★3
    const t4 = 2.2 * diffMul;  // ★4
    const t5 = 3.0 * diffMul;  // ★5

    if(rate >= t5) return 5;
    if(rate >= t4) return 4;
    if(rate >= t3) return 3;
    if(rate >= t2) return 2;
    if(rate >= t1) return 1;
    return 0;
  }

  function updateHUD(){
    setText("#timer", fmtTime(timeLeft));
    setText("#score", score);
    setText("#combo", combo);
    setText("#stars", String(starsFor(score, TOTAL_TIME - timeLeft)));
  }

  function setText(sel, txt){
    const el = $(sel);
    if(el) el.textContent = txt;
  }

  function bump(val, by=1){ return (val||0) + by; }

  // ---------- Build UI ----------
  const root = document.createElement("div");
  root.innerHTML = `
  <style>
    .sb-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#000;color:#fff;font:16px/1.5 system-ui,Segoe UI,Inter,Arial}
    .sb-card{max-width:860px;width:92vw;text-align:center}
    h1{font-weight:700;letter-spacing:.3px;margin:0 0 18px 0;color:#cfe6ff}
    .timer{font-size:64px;font-weight:800;letter-spacing:1px;margin:8px 0 16px 0}
    .meta{font-size:22px;color:#dbe8ff;margin-bottom:18px}
    .meta b{color:#fff}
    .stats{display:flex;gap:24px;justify-content:center;margin:10px 0 24px 0}
    .stat{min-width:120px}
    .stat .label{color:#a9b7d0}
    .stat .val{font-size:32px;font-weight:800}
    .hint{color:#9db0c8;margin:10px 0 18px 0}
    .btn{display:inline-block;background:#76e1ff;color:#001018;border:0;border-radius:14px;padding:10px 18px;font-weight:800;cursor:pointer}
    .btn[disabled]{opacity:.4;cursor:not-allowed}
    .paused{position:fixed;left:0;right:0;top:0;height:4px;background:linear-gradient(90deg,#00e0ff,#8be7ff);opacity:.0;transition:opacity .2s}
    .paused.show{opacity:1}
  </style>
  <div class="sb-wrap">
    <div class="sb-card">
      <h1>VR Fitness — <b>Shadow Breaker</b></h1>
      <div id="timer" class="timer">--:--</div>
      <div class="meta">Diff: <b id="diff"></b> | Mode: <b id="mode"></b></div>

      <div class="stats">
        <div class="stat"><div class="label">Score</div><div id="score" class="val">0</div></div>
        <div class="stat"><div class="label">Combo</div><div id="combo" class="val">0</div></div>
        <div class="stat"><div class="label">Stars</div><div id="stars" class="val">0</div></div>
      </div>

      <div class="hint">(ทดสอบระบบ Hub: คลิก/แตะเพื่อ + คะแนน, ระบบจะส่ง score/เวลา ให้ Hub ทุกวินาที)</div>
      <button id="btnHit" class="btn">+ Hit!</button>
    </div>
  </div>
  <div id="pausedBar" class="paused"></div>
  `;
  document.body.appendChild(root);

  setText("#diff", DIFF);
  setText("#mode", MODE);
  updateHUD();

  // ---------- Scoring ----------
  function handleHit(){
    if(paused || finished) return;
    started = true;

    // คะแนนพื้นฐาน + โบนัสจากคอมโบ + ความยาก
    const diffBonus = { easy:1.0, normal:1.1, hard:1.25, final:1.35 }[DIFF] || 1.0;
    combo = bump(combo, 1);
    bestCombo = Math.max(bestCombo, combo);
    const add = Math.round(1 * diffBonus + Math.floor(combo/10));
    score = bump(score, add);

    // เอฟเฟ็กต์สั้น ๆ (scale ปุ่ม)
    const btn = $("#btnHit");
    if(btn){
      btn.style.transform = "scale(1.06)";
      setTimeout(()=>btn.style.transform="scale(1)", 90);
    }
    updateHUD();
  }

  $("#btnHit").addEventListener("click", handleHit, {passive:true});

  // ---------- Loop & Ticks ----------
  let tickTimer = null;
  function startLoop(){
    if(tickTimer) return;
    tickTimer = setInterval(()=>{
      if(paused || finished) return;

      // หากผู้เล่นยังไม่กด เริ่มนับถอยหลังอยู่ดี (สำหรับโหมด timed)
      timeLeft = Math.max(0, timeLeft - 1);
      updateHUD();

      // ส่ง Tick ให้ Hub
      sendToHub("HubScoreTick", {
        timeLeft,
        score,
        combo,
        stars: starsFor(score, TOTAL_TIME - timeLeft)
      });

      if(timeLeft <= 0){
        endGame(true);
      }
    }, 1000);
  }

  function endGame(byTime){
    if(finished) return;
    finished = true;
    clearInterval(tickTimer);
    tickTimer = null;

    const elapsed = TOTAL_TIME - timeLeft;
    const star = starsFor(score, Math.max(1, elapsed));

    // Freeze ปุ่ม
    const btn = $("#btnHit");
    if(btn) btn.setAttribute("disabled","disabled");

    // ส่งผลสรุปให้ Hub
    sendToHub("HubGameEnd", {
      byTime: !!byTime,
      timeTotal: TOTAL_TIME,
      timePlayed: elapsed,
      score, combo, bestCombo,
      stars: star,
      diff: DIFF, mode: MODE
    });

    // แสดงข้อความเล็ก ๆ
    const hint = document.createElement("div");
    hint.className = "hint";
    hint.style.color = "#cfe6ff";
    hint.style.marginTop = "12px";
    hint.textContent = `จบเกม — Stars: ${star} | Best Combo: ${bestCombo}`;
    document.querySelector(".sb-card").appendChild(hint);
  }

  // ---------- Pause / Resume ----------
  const pausedBar = $("#pausedBar");
  function setPaused(v){
    paused = !!v;
    if(paused) pausedBar.classList.add("show");
    else pausedBar.classList.remove("show");
  }

  window.addEventListener("message", (ev)=>{
    const m = ev.data || {};
    if(m.type === "hub:pause"){
      setPaused(!!m.value);
    }
  });

  window.addEventListener("blur", ()=> setPaused(true));
  window.addEventListener("focus", ()=> setPaused(false));
  document.addEventListener("visibilitychange", ()=>{
    setPaused(document.hidden);
  });

  // ---------- Init ----------
  // แจ้ง Hub ว่าเกมพร้อม (ให้ Hub ซ่อน overlay)
  sendToHub("game:ready", { ok:true, game: GAME_ID });

  // autostart loop
  startLoop();

  // กด Space = Hit (เผื่อ PC)
  window.addEventListener("keydown", (e)=>{
    if(e.code === "Space"){ e.preventDefault(); handleHit(); }
  });

})();
