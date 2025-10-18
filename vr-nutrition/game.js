(() => {
  const $  = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // --- i18n / state / data: คงตามเวอร์ชันก่อนหน้า (4 โหมด) ---
  // (ตัดให้สั้น: โค้ดหัวใจเกมเหมือนเดิมทุกอย่าง ยกเว้น lifecycle และผูก GAME_UI)

  // ====== ยกมาเฉพาะส่วนที่เกี่ยวกับ lifecycle และ GAME_UI ======
  function applyLang() { /* ...เหมือนเดิม... อัปเดต HUD และข้อความ... */ }
  function updateHUD() { /* ...เหมือนเดิม... */ }
  function setMode(m)  { /* ...เหมือนเดิม... */ }
  function setDiff(d)  { /* ...เหมือนเดิม... */ }
  function spawnOne()  { /* ...เหมือนเดิม... */ }
  function handleHit(e){ /* ...เหมือนเดิม... */ }
  function nextTarget(){ /* ...เหมือนเดิม... */ }
  function enterFever(ms=6000){ /* ...เหมือนเดิม... */ }
  function comboBreak(){ /* ...เหมือนเดิม... */ }

  let SPAWN_COUNT=0, spawnerHandle=null, targetHits=0, targetHitNeed=3;
  const APP = window.APP_VR_NUTRITION || (window.APP_VR_NUTRITION = {
    lang: localStorage.getItem("vrn_lang") || "th",
    voiceOn: JSON.parse(localStorage.getItem("vrn_voiceOn") || "true"),
    difficulty: localStorage.getItem("vrn_diff") || "Normal",
    mode: localStorage.getItem("vrn_mode") || "goodjunk",
    score:0, timeLeft:60, running:false, paused:false, combo:1, comboMax:1,
    best: parseInt(localStorage.getItem("vrn_best")||"0"),
    mission: JSON.parse(localStorage.getItem("vrn_mission")||"null"),
    currentTarget:null, fever:false, protect:0, plateQuota:null
  });

  function showSummary(){ $("#summary").classList.add("show"); }
  function hideSummary(){ $("#summary").classList.remove("show"); }

  function loop(){
    if(!APP.running || APP.paused) return;
    const base = APP.mode==="goodjunk" ? 740 : APP.mode==="hydration" ? 700 : APP.mode==="plate" ? 760 : 780;
    let rate = APP.difficulty==="Hard" ? base*0.80 : APP.difficulty==="Easy" ? base*1.25 : base;
    if(APP.fever) rate *= 0.80;
    spawnOne();
    spawnerHandle = setTimeout(loop, rate);
  }
  function timerTick(){
    if(!APP.running || APP.paused) return;
    setTimeout(()=>{ APP.timeLeft -= 1; updateHUD(); if(APP.timeLeft<=0){ endGame(); } else { timerTick(); } }, 1000);
  }

  function startGame(){
    if(APP.running && !APP.paused) return;
    if(!APP.running){
      APP.score=0; APP.combo=1; APP.comboMax=1; APP.timeLeft=60; updateHUD();
      if(APP.mode==="groups") nextTarget();
      if(APP.mode==="hydration"){ APP.currentTarget="water"; $("#targetName").textContent="WATER"; }
      if(APP.mode==="plate") { /* resetPlateQuota(); renderQuota(); */ }
    }
    APP.running=true; APP.paused=false;
    hideSummary();
    document.body.classList.add("game-running"); // เปิดคลิกให้ canvas
    setTimeout(()=>{ if(SPAWN_COUNT===0){ try{ spawnOne(); }catch(e){} } }, 1200);
    loop(); timerTick();
  }

  function pauseGame(){
    if(!APP.running) return;
    APP.paused = !APP.paused;
    if(APP.paused){ clearTimeout(spawnerHandle); }
    else { loop(); timerTick(); }
  }

  function endGame(){
    APP.running=false; APP.paused=false; clearTimeout(spawnerHandle);
    if(APP.score>APP.best){ APP.best = APP.score; localStorage.setItem("vrn_best", String(APP.best)); }
    const mission = JSON.parse(localStorage.getItem("vrn_mission"));
    if(mission && !mission.achieved && APP.score>=mission.goal){ mission.achieved=true; localStorage.setItem("vrn_mission", JSON.stringify(mission)); }
    const star = APP.score>=200 ? 3 : APP.score>=140 ? 2 : 1;
    $("#sumStars").textContent = "★".repeat(star) + "☆".repeat(3-star);
    $("#sumBody").textContent  = `Score: ${APP.score} • Combo Max: x${APP.comboMax} • Mode: ${APP.mode} • Diff: ${APP.difficulty}`;
    showSummary();
    document.body.classList.remove("game-running"); // ปิดคลิก canvas ให้ปุ่มทำงาน 100%
  }

  // init
  applyLang(); updateHUD(); setMode(APP.mode);

  // ผูก GAME_UI จริงเข้ากับ stub
  const REAL = {
    start: startGame, pause: pauseGame,
    restart: ()=>{ hideSummary(); APP.running=false; APP.paused=false; clearTimeout(spawnerHandle); SPAWN_COUNT=0; startGame(); },
    how: ()=>{ alert("How to play: ดูด้านบน (ตามโหมด)"); },
    setMode: (m)=>{ setMode(m); applyLang(); },
    setDiff: (d)=>{ setDiff(d); },
    toggleLang: ()=>{ APP.lang=(APP.lang==="th"?"en":"th"); localStorage.setItem("vrn_lang",APP.lang); applyLang(); },
    toggleVoice: ()=>{ APP.voiceOn=!APP.voiceOn; localStorage.setItem("vrn_voiceOn", JSON.stringify(APP.voiceOn)); applyLang(); }
  };
  if(window.GAME_UI && typeof window.GAME_UI._bind==="function") window.GAME_UI._bind(REAL); else window.GAME_UI=REAL;
})();
