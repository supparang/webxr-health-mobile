// === VR Fitness — Shadow Breaker (Playable DOM version) ===
// - Lanes: 3 ช่อง (Left, Center, Right)
// - เป้าจะ "ตกลง" มาที่เส้นตี (hit line) ให้กด J / K / L หรือคลิก/แตะที่เป้า
// - ตัดสิน: Perfect / Good / Miss (คำนวณจากระยะห่างเส้นตี)
// - คอมโบ/ดาว/คะแนน, ส่ง tick ให้ Hub ทุกวินาที, GameEnd ตอนหมดเวลา
// - Pause on blur + รับ hub:pause

(function(){
  "use strict";

  // ---------- Launch ----------
  const L = window.HubLaunch || {};
  const GAME_ID = "shadow-breaker";
  const MODE = (L.mode||"timed");
  const DIFF = (L.diff||"normal");
  const TOTAL_TIME = clamp(+L.time || 90, 30, 180);

  // ---------- State ----------
  let timeLeft = TOTAL_TIME;
  let score = 0;
  let combo = 0;
  let bestCombo = 0;
  let stars = 0;
  let paused = false;
  let finished = false;

  // ---------- Difficulty table ----------
  const DIFFCFG = {
    easy:   { bpm: 90,  fallSpeed: 380,  perfectWin: 26, goodWin: 56 },
    normal: { bpm: 110, fallSpeed: 460,  perfectWin: 24, goodWin: 52 },
    hard:   { bpm: 130, fallSpeed: 550,  perfectWin: 22, goodWin: 48 },
    final:  { bpm: 150, fallSpeed: 640,  perfectWin: 20, goodWin: 44 }
  }[DIFF] || { bpm: 110, fallSpeed: 460, perfectWin: 24, goodWin: 52 };

  // ช่วง spawn (ms) ตาม bpm
  const SPAWN_MS = Math.round(60000 / DIFFCFG.bpm); // โน้ตความถี่คงที่เรียบ ๆ
  const LANES = ["L","C","R"];

  // ---------- Helpers ----------
  const $  = (s)=>document.querySelector(s);
  const $$ = (s)=>[...document.querySelectorAll(s)];
  function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }
  function sendToHub(type, data){
    try{ if(window.parent && window.parent!==window){
      window.parent.postMessage({type, game: GAME_ID, ...data}, "*");
    }}catch(e){}
  }
  function fmt(sec){ const m=(sec/60)|0; const s=(sec%60)|0; return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`; }
  function rngPick(arr){ return arr[(Math.random()*arr.length)|0]; }

  // ดาว 0–5 จากคะแนน/วินาที ปรับด้วย diff
  function calcStars(score, elapsed){
    const rate = score / Math.max(1, elapsed);
    const mul = {easy:0.85, normal:1, hard:1.2, final:1.35}[DIFF]||1;
    const t=[0.6,1.0,1.6,2.2,3.0].map(x=>x*mul);
    if(rate>=t[4]) return 5; if(rate>=t[3]) return 4; if(rate>=t[2]) return 3; if(rate>=t[1]) return 2; if(rate>=t[0]) return 1; return 0;
  }

  // ---------- Build HUD + Stage ----------
  const root = document.createElement("div");
  root.innerHTML = `
  <style>
    :root{ --bg:#000; --fg:#fff; --muted:#a9b7d0; --accent:#76e1ff; }
    html,body{background:#000;color:#fff}
    .sb-wrap{min-height:100vh;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,Segoe UI,Inter,Arial}
    .hud{padding-top:26px;text-align:center}
    .title{color:#cfe6ff;margin:0 0 8px 0}
    .timer{font-size:64px;font-weight:800;letter-spacing:1px;margin:10px 0 12px}
    .meta{font-size:20px;color:#dbe8ff;margin-bottom:10px}
    .stats{display:flex;gap:24px;justify-content:center;margin:0 0 8px}
    .stat{min-width:120px}
    .stat .label{color:var(--muted)}
    .stat .val{font-size:30px;font-weight:800}
    .stage{position:relative;margin:18px auto 12px auto;width:min(880px,94vw);height:56vh;border:1px solid #1b2235;border-radius:16px;background:linear-gradient(180deg,#0a0d18,#03050a 70%);overflow:hidden}
    .lanes{position:absolute;inset:10px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px}
    .lane{position:relative;border:1px dashed #1d2a3f;border-radius:12px;background:linear-gradient(180deg,#0e1724,#0a0f18)}
    .hitline{position:absolute;left:0;right:0;bottom:50px;height:4px;background:linear-gradient(90deg,#00e0ff,#8be7ff);opacity:.8}
    .note{position:absolute;left:0;right:0; width:66px; height:66px; margin:0 auto; border-radius:50%; background:#1f90ff; box-shadow:0 0 18px #1f90ff80; display:grid;place-items:center; font-weight:900}
    .note[data-lane="L"]{background:#ff7d7d; box-shadow:0 0 18px #ff7d7d90}
    .note[data-lane="R"]{background:#7dffb6; box-shadow:0 0 18px #7dffb690}
    .judg{position:absolute;left:50%;transform:translateX(-50%);bottom:90px;font-size:22px;font-weight:900;pointer-events:none}
    .judg.perfect{color:#8fe8ff;text-shadow:0 0 10px #8fe8ff}
    .judg.good{color:#b4ff9b;text-shadow:0 0 10px #b4ff9b}
    .judg.miss{color:#ff8a8a;text-shadow:0 0 10px #ff8a8a}
    .help{color:#9db0c8;text-align:center;margin:6px 0 14px 0}
    .keys{color:#9db0c8;text-align:center;margin-top:2px;font-size:13px}
    .paused{position:fixed;left:0;right:0;top:0;height:4px;background:linear-gradient(90deg,#00e0ff,#8be7ff);opacity:0;transition:opacity .2s}
    .paused.show{opacity:1}
  </style>
  <div class="sb-wrap">
    <div class="hud">
      <h2 class="title">VR Fitness — <b>Shadow Breaker</b></h2>
      <div id="timer" class="timer">--:--</div>
      <div class="meta">Diff: <b id="diff"></b> | Mode: <b id="mode"></b></div>
      <div class="stats">
        <div class="stat"><div class="label">Score</div><div id="score" class="val">0</div></div>
        <div class="stat"><div class="label">Combo</div><div id="combo" class="val">0</div></div>
        <div class="stat"><div class="label">Stars</div><div id="stars" class="val">0</div></div>
      </div>
    </div>
    <div class="stage" id="stage">
      <div class="lanes">
        <div class="lane" data-lane="L"><div class="hitline"></div></div>
        <div class="lane" data-lane="C"><div class="hitline"></div></div>
        <div class="lane" data-lane="R"><div class="hitline"></div></div>
      </div>
    </div>
    <div class="help">(คลิก/แตะเป้าหรือกดแป้น J K L ให้ตรงเส้น — Perfect/Good/Miss)</div>
    <div class="keys">Keys: J = Left, K = Center, L = Right</div>
  </div>
  <div id="pausedBar" class="paused"></div>
  `;
  document.body.appendChild(root);

  $("#diff").textContent = DIFF;
  $("#mode").textContent = MODE;

  // ---------- HUD update ----------
  function updateHUD(){
    $("#timer").textContent = fmt(timeLeft);
    $("#score").textContent = score;
    $("#combo").textContent = combo;
    $("#stars").textContent = stars;
  }
  updateHUD();

  // ---------- Stage / Notes ----------
  const stage = $("#stage");
  const hitY = stage.getBoundingClientRect().height - 50 - 10; // 50px up from bottom, minus 10 inset

  const notes = new Set(); // active notes
  let lastSpawn = 0;

  function spawnNote(){
    const lane = rngPick(LANES);
    const n = document.createElement("div");
    n.className = "note";
    n.dataset.lane = lane;
    n.style.top = "-70px"; // start above view
    n.style.cursor = "pointer";
    n.dataset.y = "-70"; // for animation
    n.addEventListener("click", ()=>tryHit(lane));
    stage.appendChild(n);
    notes.add(n);
  }

  // animation loop
  let rafId=null, lastT=0;
  function loop(t){
    if(finished || paused){ rafId = requestAnimationFrame(loop); return; }
    if(!lastT) lastT = t;
    const dt = (t - lastT) / 1000; // sec
    lastT = t;

    // spawn rhythm
    if(t - lastSpawn > SPAWN_MS){
      spawnNote();
      lastSpawn = t;
    }

    // move notes
    const h = stage.getBoundingClientRect().height;
    const FALL = DIFFCFG.fallSpeed * dt; // px per frame
    notes.forEach(n=>{
      const y = (+n.dataset.y) + FALL;
      n.dataset.y = String(y);
      n.style.transform = `translateY(${y}px)`;
      // miss if passed hit line
      if(y > hitY + DIFFCFG.goodWin + 26){ // miss buffer
        judge("miss");
        notes.delete(n);
        n.remove();
      }
    });

    rafId = requestAnimationFrame(loop);
  }

  // ---------- Judgement ----------
  function tryHit(whichLane){
    if(paused || finished) return;
    // find closest note in that lane to hit line
    let best = null, bestDist = 1e9;
    notes.forEach(n=>{
      if(n.dataset.lane !== whichLane) return;
      const y = +n.dataset.y;
      const dist = Math.abs(y - hitY);
      if(dist < bestDist){ best = n; bestDist = dist; }
    });
    if(!best) return; // nothing in that lane
    if(bestDist <= DIFFCFG.perfectWin){
      judge("perfect");
      pop(best);
    }else if(bestDist <= DIFFCFG.goodWin){
      judge("good");
      pop(best);
    }else{
      judge("miss"); // too far
    }
  }

  function pop(n){
    notes.delete(n);
    // tiny burst
    n.animate([{transform:n.style.transform, opacity:1},{transform:`${n.style.transform} scale(1.25)`,opacity:0}],{duration:140,easing:"ease-out"});
    setTimeout(()=>n.remove(),140);
  }

  function judge(kind){
    const dmul = {easy:1.0, normal:1.1, hard:1.25, final:1.35}[DIFF]||1;
    if(kind==="perfect"){
      combo++; bestCombo=Math.max(bestCombo,combo);
      score += Math.round(2*dmul + Math.floor(combo/10));
      flash("perfect");
    }else if(kind==="good"){
      combo++; bestCombo=Math.max(bestCombo,combo);
      score += Math.round(1*dmul + Math.floor(combo/20));
      flash("good");
    }else{ // miss
      combo = 0;
      flash("miss");
    }
    stars = calcStars(score, TOTAL_TIME - timeLeft);
    updateHUD();
  }

  function flash(kind){
    const el = document.createElement("div");
    el.className = `judg ${kind}`;
    el.textContent = (kind==="perfect"?"PERFECT!":kind==="good"?"GOOD":"MISS");
    stage.appendChild(el);
    el.animate([{transform:"translate(-50%,0)",opacity:0},{opacity:1,offset:.25},{transform:"translate(-50%,-22px)",opacity:0}],{duration:650,easing:"ease-out"});
    setTimeout(()=>el.remove(),650);
  }

  // ---------- Input ----------
  window.addEventListener("keydown",(e)=>{
    if(e.repeat) return;
    if(e.code==="KeyJ"){ e.preventDefault(); tryHit("L"); }
    if(e.code==="KeyK"){ e.preventDefault(); tryHit("C"); }
    if(e.code==="KeyL"){ e.preventDefault(); tryHit("R"); }
  }, {passive:false});

  // ---------- Timer / Hub ticks ----------
  let tick = setInterval(()=>{
    if(finished || paused) return;
    timeLeft = Math.max(0, timeLeft - 1);
    updateHUD();
    sendToHub("HubScoreTick", { timeLeft, score, combo, stars });
    if(timeLeft<=0){ endGame(true); }
  }, 1000);

  function endGame(byTime){
    if(finished) return;
    finished = true;
    cancelAnimationFrame(rafId);
    clearInterval(tick);
    notes.forEach(n=>n.remove()); notes.clear();
    sendToHub("HubGameEnd", {
      byTime: !!byTime, timeTotal: TOTAL_TIME, timePlayed: TOTAL_TIME - timeLeft,
      score, combo, bestCombo, stars, diff: DIFF, mode: MODE
    });
    // banner small
    flash("good");
  }

  // ---------- Pause / Resume ----------
  const pausedBar = $("#pausedBar");
  function setPaused(v){
    paused = !!v;
    pausedBar.classList.toggle("show", paused);
  }
  window.addEventListener("message", (ev)=>{
    if((ev.data||{}).type==="hub:pause"){ setPaused(!!ev.data.value); }
  });
  window.addEventListener("blur", ()=>setPaused(true));
  window.addEventListener("focus", ()=>setPaused(false));
  document.addEventListener("visibilitychange", ()=> setPaused(document.hidden));

  // ---------- Start ----------
  sendToHub("game:ready", {ok:true, game:GAME_ID});
  lastSpawn = performance.now(); // spawn asap
  rafId = requestAnimationFrame(loop);

})();
