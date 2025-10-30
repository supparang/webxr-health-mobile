// === VR Fitness — Shadow Breaker (Playable, guaranteed spawns) ===
// - เป้าตกใน 3 เลน (L,C,R) มี wave แรกโผล่ทันที
// - เคลื่อนที่ด้วย 'top' ภายในเลน → มองเห็นแน่
// - ตัดสิน PERFECT/GOOD/MISS, คอมโบ/ดาว/คะแนน
// - ส่ง HubScoreTick ทุกวินาที + HubGameEnd ตอนหมดเวลา
// - pause on blur + รับ hub:pause

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

  const DIFFCFG = {
    easy:   { bpm: 90,  speed: 320,  perfectWin: 26, goodWin: 56, lanes: ["C","L","R"] },
    normal: { bpm: 110, speed: 420,  perfectWin: 24, goodWin: 52, lanes: ["L","C","R"] },
    hard:   { bpm: 130, speed: 520,  perfectWin: 22, goodWin: 48, lanes: ["L","C","R","C"] },
    final:  { bpm: 150, speed: 600,  perfectWin: 20, goodWin: 44, lanes: ["L","C","R","L","C","R"] }
  }[DIFF] || { bpm: 110, speed: 420, perfectWin: 24, goodWin: 52, lanes: ["L","C","R"] };

  const SPAWN_MS = Math.round(60000 / DIFFCFG.bpm);

  // ---------- Helpers ----------
  const $  = (s)=>document.querySelector(s);
  function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }
  function rngPick(arr){ return arr[(Math.random()*arr.length)|0]; }
  function fmt(sec){ const m=(sec/60)|0; const s=(sec%60)|0; return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`; }
  function sendToHub(type, data){ try{ if(window.parent && window.parent!==window){ window.parent.postMessage({type, game:GAME_ID, ...data},"*"); } }catch(e){} }
  function calcStars(score, elapsed){
    const rate = score / Math.max(1, elapsed);
    const mul = {easy:0.85, normal:1, hard:1.2, final:1.35}[DIFF]||1;
    const t=[0.6,1.0,1.6,2.2,3.0].map(x=>x*mul);
    if(rate>=t[4])return 5; if(rate>=t[3])return 4; if(rate>=t[2])return 3; if(rate>=t[1])return 2; if(rate>=t[0])return 1; return 0;
  }

  // ---------- Build HUD + Stage ----------
  const root = document.createElement("div");
  root.innerHTML = `
  <style>
    :root{ --bg:#000; --fg:#fff; --muted:#a9b7d0; --accent:#76e1ff; }
    .wrap{min-height:100vh;background:#000;color:#fff;font:16px/1.5 system-ui,Segoe UI,Inter,Arial}
    .hud{padding-top:26px;text-align:center}
    .title{color:#cfe6ff;margin:0 0 8px 0}
    .timer{font-size:64px;font-weight:800;letter-spacing:1px;margin:10px 0 12px}
    .meta{font-size:20px;color:#dbe8ff;margin-bottom:10px}
    .stats{display:flex;gap:24px;justify-content:center;margin:0 0 8px}
    .stat{min-width:120px}.label{color:#a9b7d0}.val{font-size:30px;font-weight:800}
    .stage{position:relative;margin:18px auto 12px;width:min(880px,94vw);height:56vh;border:1px solid #1b2235;border-radius:16px;background:linear-gradient(180deg,#0a0d18,#03050a 70%);overflow:hidden}
    .lanes{position:absolute;inset:10px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px}
    .lane{position:relative;border:1px dashed #1d2a3f;border-radius:12px;background:linear-gradient(180deg,#0e1724,#0a0f18)}
    .hitline{position:absolute;left:0;right:0;bottom:50px;height:4px;background:linear-gradient(90deg,#00e0ff,#8be7ff);opacity:.85}
    .note{position:absolute;left:50%;transform:translateX(-50%); width:66px;height:66px;border-radius:50%;display:grid;place-items:center;font-weight:900;z-index:2}
    .note.L{background:#ff7d7d;box-shadow:0 0 18px #ff7d7d90}
    .note.C{background:#1f90ff;box-shadow:0 0 18px #1f90ff80}
    .note.R{background:#7dffb6;box-shadow:0 0 18px #7dffb690}
    .judg{position:absolute;left:50%;transform:translateX(-50%);bottom:92px;font-size:22px;font-weight:900;pointer-events:none}
    .judg.perfect{color:#8fe8ff;text-shadow:0 0 10px #8fe8ff}
    .judg.good{color:#b4ff9b;text-shadow:0 0 10px #b4ff9b}
    .judg.miss{color:#ff8a8a;text-shadow:0 0 10px #ff8a8a}
    .help{color:#9db0c8;text-align:center;margin:6px 0 14px 0}
    .keys{color:#9db0c8;text-align:center;margin-top:2px;font-size:13px}
    .paused{position:fixed;left:0;right:0;top:0;height:4px;background:linear-gradient(90deg,#00e0ff,#8be7ff);opacity:0;transition:opacity .2s}
    .paused.show{opacity:1}
  </style>
  <div class="wrap">
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
  $("#diff").textContent = DIFF; $("#mode").textContent = MODE;

  function updateHUD(){
    $("#timer").textContent = fmt(timeLeft);
    $("#score").textContent = score;
    $("#combo").textContent = combo;
    $("#stars").textContent = stars;
  }
  updateHUD();

  // ---------- Stage & lanes ----------
  const laneMap = {
    L: $('.lane[data-lane="L"]'),
    C: $('.lane[data-lane="C"]'),
    R: $('.lane[data-lane="R"]'),
  };
  const hitMapY = {}; // hitline y per lane (px from top)
  for(const k of ["L","C","R"]){
    const lane = laneMap[k];
    const h = lane.clientHeight;
    hitMapY[k] = h - 50; // hit line bottom: 50px
  }

  // ---------- Notes ----------
  const active = new Set();
  function spawnInLane(k){
    const lane = laneMap[k];
    const n = document.createElement("div");
    n.className = `note ${k}`;
    n.style.top = `-70px`; // start above
    n.dataset.y = String(-70);
    n.addEventListener("click", ()=>tryHit(k));
    lane.appendChild(n);
    active.add(n);
  }

  // Wave แรก: โผล่ทันทีให้เห็นเลย
  (function initialWave(){
    DIFFCFG.lanes.forEach((k,i)=>{ setTimeout(()=>spawnInLane(k), i*160); });
  })();

  // Spawn ต่อเนื่อง
  let lastSpawn = performance.now();
  function maybeSpawn(now){
    if(now - lastSpawn >= SPAWN_MS){
      spawnInLane(rngPick(["L","C","R"]));
      lastSpawn = now;
    }
  }

  // เคลื่อนโน้ตด้วย top (px)
  function moveNotes(dt){
    const px = DIFFCFG.speed * dt;
    active.forEach(n=>{
      const y = (+n.dataset.y) + px;
      n.dataset.y = String(y);
      n.style.top = `${y}px`;

      const laneKey = n.classList.contains("L")?"L":(n.classList.contains("R")?"R":"C");
      const missY = hitMapY[laneKey] + DIFFCFG.goodWin + 28;
      if(y > missY){
        judge("miss");
        active.delete(n); n.remove();
      }
    });
  }

  // ---------- Judge ----------
  function flash(kind){
    const stage = $("#stage");
    const el = document.createElement("div");
    el.className = `judg ${kind}`;
    el.textContent = kind==="perfect"?"PERFECT!":kind==="good"?"GOOD":"MISS";
    stage.appendChild(el);
    el.animate([{transform:"translate(-50%,0)",opacity:0},{opacity:1,offset:.25},{transform:"translate(-50%,-22px)",opacity:0}],{duration:650,easing:"ease-out"});
    setTimeout(()=>el.remove(),650);
  }
  function judge(kind){
    const mul = {easy:1.0, normal:1.1, hard:1.25, final:1.35}[DIFF]||1;
    if(kind==="perfect"){
      combo++; bestCombo=Math.max(bestCombo,combo); score += Math.round(2*mul + Math.floor(combo/10));
    }else if(kind==="good"){
      combo++; bestCombo=Math.max(bestCombo,combo); score += Math.round(1*mul + Math.floor(combo/20));
    }else{ combo = 0; }
    stars = calcStars(score, TOTAL_TIME - timeLeft);
    flash(kind);
    updateHUD();
  }

  function tryHit(k){
    if(paused || finished) return;
    // หาโน้ตที่อยู่ใกล้เส้นตีในเลนนั้นที่สุด
    let best=null, bestDist=1e9;
    active.forEach(n=>{
      if(!n.classList.contains(k)) return;
      const y = +n.dataset.y;
      const dist = Math.abs(y - hitMapY[k]);
      if(dist < bestDist){ best=n; bestDist=dist; }
    });
    if(!best) return;
    if(bestDist <= DIFFCFG.perfectWin){ judge("perfect"); remove(best); }
    else if(bestDist <= DIFFCFG.goodWin){ judge("good"); remove(best); }
    else { judge("miss"); }
  }
  function remove(n){ active.delete(n); n.remove(); }

  // ---------- Input ----------
  window.addEventListener("keydown",(e)=>{
    if(e.repeat) return;
    if(e.code==="KeyJ"){ e.preventDefault(); tryHit("L"); }
    if(e.code==="KeyK"){ e.preventDefault(); tryHit("C"); }
    if(e.code==="KeyL"){ e.preventDefault(); tryHit("R"); }
  }, {passive:false});

  // ---------- Loops ----------
  let lastT = performance.now();
  function raf(now){
    if(finished || paused){ lastT = now; requestAnimationFrame(raf); return; }
    const dt = (now - lastT) / 1000;
    lastT = now;
    maybeSpawn(now);
    moveNotes(dt);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);

  const tick = setInterval(()=>{
    if(finished || paused) return;
    timeLeft = Math.max(0, timeLeft - 1);
    updateHUD();
    sendToHub("HubScoreTick", { timeLeft, score, combo, stars });
    if(timeLeft<=0){ endGame(true); }
  }, 1000);

  function endGame(byTime){
    if(finished) return;
    finished = true;
    clearInterval(tick);
    active.forEach(n=>n.remove()); active.clear();
    sendToHub("HubGameEnd", {
      byTime: !!byTime, timeTotal: TOTAL_TIME, timePlayed: TOTAL_TIME - timeLeft,
      score, combo, bestCombo, stars, diff: DIFF, mode: MODE
    });
  }

  // ---------- Pause ----------
  const pausedBar = document.createElement("div");
  pausedBar.className = "paused";
  document.body.appendChild(pausedBar);
  function setPaused(v){ paused = !!v; pausedBar.classList.toggle("show", paused); }
  window.addEventListener("message",(ev)=>{ if((ev.data||{}).type==="hub:pause") setPaused(!!ev.data.value); });
  window.addEventListener("blur", ()=>setPaused(true));
  window.addEventListener("focus", ()=>setPaused(false));
  document.addEventListener("visibilitychange", ()=> setPaused(document.hidden));

  // ---------- Ready for Hub ----------
  sendToHub("game:ready", {ok:true, game:GAME_ID});

})();
