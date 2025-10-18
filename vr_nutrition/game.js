// game.js — fail-safe start: watchdog + spawn fallback + modal guard + plate fix
(() => {
  const $  = s => document.querySelector(s);
  const $$ = s => document.querySelectorAll(s);

  // ---------- State ----------
  const APP = {
    lang: localStorage.getItem("vrn_lang") || "th",
    voiceOn: JSON.parse(localStorage.getItem("vrn_voiceOn") || "true"),
    difficulty: localStorage.getItem("vrn_diff") || "Normal",
    mode: localStorage.getItem("vrn_mode") || "goodjunk",
    score:0, timeLeft:60, running:false, paused:false, combo:1, comboMax:1,
    best: parseInt(localStorage.getItem("vrn_best")||"0"),
    currentTarget:null, fever:false, protect:0, plateQuota:null
  };

  // ---------- Quick HUD helpers ----------
  const setHUD = () => {
    $("#score") && ($("#score").textContent = APP.score);
    $("#time")  && ($("#time").textContent  = APP.timeLeft);
    $("#best")  && ($("#best").textContent  = APP.best);
    $("#difficulty") && ($("#difficulty").textContent = APP.difficulty);
    $("#combo") && ($("#combo").textContent = "x"+APP.combo);
  };
  const showSummary = () => $("#summary") && $("#summary").classList.add("show");
  const hideSummary = () => $("#summary") && $("#summary").classList.remove("show");

  // ---------- Data ----------
  const foods = {
    goodjunk: [
      {id:"#apple",good:true},{id:"#broccoli",good:true},{id:"#water",good:true},
      {id:"#burger",good:false},{id:"#soda",good:false},{id:"#donut",good:false}
    ],
    groups: [
      {id:"#g_grains",group:"grains"},{id:"#g_protein",group:"protein"},
      {id:"#g_veggies",group:"veggies"},{id:"#g_fruits",group:"fruits"},{id:"#g_dairy",group:"dairy"}
    ],
    hydration: [{id:"#water",type:"water"},{id:"#soda",type:"soda"},{id:"#donut",type:"sugar"}]
  };
  const targets=["grains","protein","veggies","fruits","dairy"];

  // ---------- Spawn grid (กันซ้อน/ชิด) ----------
  const CFG={scale:0.78,maxActive:{Easy:3,Normal:4,Hard:5}};
  const LANE_X=[-0.80,0,0.80], LANE_Y=[-0.05,0.12,0.29], LANE_Z=[-0.36,0,0.36];
  const ACTIVE=new Set(); let occ=new Set(), cool=new Map(), last=null;
  const now=()=>performance.now();
  const isAdj=(r,c)=> last ? (Math.abs(last[0]-r)<=1 && Math.abs(last[1]-c)<=1) : false;
  function lanePick(){
    const cand=[];
    for(let r=0;r<3;r++) for(let c=0;c<3;c++){
      const k=r+","+c, free=!occ.has(k) && now()>(cool.get(k)||0) && !isAdj(r,c);
      cand.push({r,c,k,free});
    }
    const free=cand.filter(x=>x.free);
    if(!free.length) return null;
    const pick=free[Math.floor(Math.random()*free.length)];
    occ.add(pick.k); last=[pick.r,pick.c];
    return {x:LANE_X[pick.c],y:LANE_Y[pick.r],z:LANE_Z[(pick.r+pick.c)%3],k:pick.k};
  }
  function laneRelease(k){ occ.delete(k); cool.set(k, now()+800); }

  // ---------- Asset fallback ----------
  const imgReady = sel => { const el=document.querySelector(sel); return !!(el && (el.complete===true || el.naturalWidth>0)); };

  // ---------- Pick item per mode (แก้บั๊ก plate) ----------
  function pickSrcMeta(){
    if(APP.mode==="goodjunk"){
      const bias=APP.difficulty==="Easy"?0.7:APP.difficulty==="Hard"?0.45:0.58;
      const pool=Math.random()<bias ? foods.goodjunk.filter(f=>f.good) : foods.goodjunk.filter(f=>!f.good);
      const f=pool[Math.floor(Math.random()*pool.length)];
      return {src:f.id, meta:{good:!!f.good}};
    }
    if(APP.mode==="groups"){
      const f=foods.groups[Math.floor(Math.random()*foods.groups.length)];
      return {src:f.id, meta:{group:f.group}};
    }
    if(APP.mode==="hydration"){
      const rate=APP.difficulty==="Easy"?0.75:APP.difficulty==="Hard"?0.55:0.65;
      const pool=Math.random()<rate ? foods.hydration.filter(x=>x.type==="water") : foods.hydration.filter(x=>x.type!=="water");
      const f=pool[Math.floor(Math.random()*pool.length)];
      return {src:f.id, meta:{hydra:f.type}};
    }
    // plate (fix: ใช้ foods.groups.length)
    const f=foods.groups[Math.floor(Math.random()*foods.groups.length)];
    return {src:f.id, meta:{group:f.group, plate:true}};
  }

  // ---------- Hit logic (ย่อส่วน – เดิมเหมือนเวอร์ชันเต็ม) ----------
  function comboBreak(){ APP.combo=1; setHUD(); }
  function handleHit(ent){
    const meta=JSON.parse(ent.dataset.meta||"{}");
    let good=false, delta=0;
    if(APP.mode==="goodjunk"){ good=meta.good===true; delta=good?5:-3; if(!good) comboBreak(); }
    else if(APP.mode==="groups"){ good=meta.group===APP.currentTarget; delta=good?6:-2; if(!good) comboBreak(); }
    else if(APP.mode==="hydration"){ good=meta.hydra==="water"; delta=good?4:-4; if(!good) comboBreak(); }
    else if(APP.mode==="plate"){ if(meta.group){ good=true; delta=5; } }
    if(good){ APP.combo=Math.min(5,APP.combo+1); APP.comboMax=Math.max(APP.comboMax,APP.combo); }
    APP.score=Math.max(0,APP.score + (good ? delta*APP.combo : delta));
    setHUD();
  }

  // ---------- Spawn (ใส่ try/catch กันลูปตาย + fallback สี) ----------
  let SPAWN_COUNT=0;
  function spawnOne(){
    try{
      const root=$("#spawnerRoot"); if(!root) return;
      const max=CFG.maxActive[APP.difficulty]||4; if(ACTIVE.size>=max) return;
      const lane=lanePick(); if(!lane) return;

      const pick=pickSrcMeta();
      const useImg = imgReady(pick.src);
      const ent = document.createElement(useImg ? "a-image" : "a-entity");
      if (useImg){
        ent.setAttribute("src",pick.src);
        ent.setAttribute("geometry","primitive:plane;width:1;height:1");
        ent.setAttribute("material","shader:flat;transparent:true;opacity:0.98");
      } else {
        const colors=['#39d','#0f9','#fd0','#f55','#9f6','#0ff','#f0f'];
        const c=colors[Math.floor(Math.random()*colors.length)];
        ent.setAttribute("geometry","primitive:plane;width:1;height:1");
        ent.setAttribute("material",`shader:flat;color:${c};opacity:0.98`);
      }
      ent.setAttribute("class","clickable");
      ent.setAttribute("position",`${lane.x} ${lane.y} ${lane.z}`);
      ent.setAttribute("scale",`${CFG.scale} ${CFG.scale} ${CFG.scale}`);
      ent.dataset.meta=JSON.stringify(pick.meta); ent.dataset.slotKey=lane.k;

      const remove=()=>{ if(ent.parentNode) ent.parentNode.removeChild(ent); ACTIVE.delete(ent); laneRelease(lane.k); };
      ent.addEventListener("click", ()=>{ handleHit(ent); remove(); });

      root.appendChild(ent); ACTIVE.add(ent); SPAWN_COUNT++;

      const life=APP.difficulty==="Hard"?1900:APP.difficulty==="Easy"?4200:3000;
      setTimeout(()=>{ if(ent.parentNode){ remove(); }}, life);
    }catch(e){
      // กันลูปดับ: รอสั้น ๆ แล้ววนต่อ
      console.error("spawn error", e);
    }
  }

  // ---------- Loops ----------
  let loopH=null, timerH=null;
  function loop(){ if(!APP.running || APP.paused) return;
    const base=740, rate=APP.difficulty==="Hard"?base*0.8:APP.difficulty==="Easy"?base*1.25:base;
    spawnOne();
    loopH = setTimeout(loop, rate);
  }
  function tick(){ if(!APP.running || APP.paused) return;
    timerH = setTimeout(()=>{ APP.timeLeft--; setHUD(); if(APP.timeLeft<=0){ endGame(); } else tick(); }, 1000);
  }

  // ---------- Mode helpers ----------
  function setMode(m){
    APP.mode=m; localStorage.setItem("vrn_mode",m);
    $("#modeName") && ($("#modeName").textContent =
      m==="goodjunk" ? "Good vs Junk" : m==="groups" ? "Food Groups" : m==="hydration" ? "Hydration" : "Build Plate");
    $("#targetBox") && ($("#targetBox").style.display = (m==="groups"||m==="hydration")?"block":"none");
    $("#quotaBox")  && ($("#quotaBox").style.display  = (m==="plate")?"block":"none");
    if(m==="groups"){ nextTarget(); }
    if(m==="hydration"){ APP.currentTarget="water"; $("#targetName") && ($("#targetName").textContent="WATER"); }
  }
  function setDiff(d){ APP.difficulty=d; localStorage.setItem("vrn_diff",d); setHUD(); }
  function nextTarget(){
    const pool=targets.slice(); if(APP.currentTarget){ const i=pool.indexOf(APP.currentTarget); if(i>=0) pool.splice(i,1); }
    APP.currentTarget=pool[Math.floor(Math.random()*pool.length)];
    $("#targetName") && ($("#targetName").textContent = APP.currentTarget.toUpperCase());
  }

  // ---------- Start/Pause/End (+ watchdog) ----------
  let watchdogH=null, lastTimeSeen=null;
  function startGame(){
    // ปิดตัวบังฉากทุกอย่างก่อน
    hideSummary();
    const how = $("#howModal"); how && how.classList.remove("show");

    if(!APP.running){
      APP.score=0; APP.combo=1; APP.comboMax=1; APP.timeLeft=60;
      setHUD(); setMode(APP.mode);
    }
    APP.running=true; APP.paused=false;

    document.body.classList.add("game-running");
    setTimeout(()=>{ spawnOne(); }, 300);
    loop(); tick();

    // Watchdog: ถ้า 1.2s ยังไม่เดินเวลา/ไม่ spawn → kick อีกรอบ
    lastTimeSeen = APP.timeLeft;
    clearTimeout(watchdogH);
    watchdogH = setTimeout(()=>{
      const noTime = (APP.timeLeft === lastTimeSeen);
      const noSpawn = (SPAWN_COUNT === 0);
      if(noTime || noSpawn){
        console.warn("Watchdog kick: restarting loops");
        clearTimeout(loopH); clearTimeout(timerH);
        setTimeout(()=>{ spawnOne(); loop(); tick(); }, 200);
      }
    }, 1200);
  }
  function pauseGame(){ if(!APP.running) return; APP.paused=!APP.paused;
    if(APP.paused){ clearTimeout(loopH); clearTimeout(timerH); }
    else { loop(); tick(); }
  }
  function endGame(){
    APP.running=false; APP.paused=false;
    clearTimeout(loopH); clearTimeout(timerH); clearTimeout(watchdogH);
    if(APP.score>APP.best){ APP.best=APP.score; localStorage.setItem("vrn_best", String(APP.best)); }
    $("#sumStars") && ($("#sumStars").textContent = APP.score>=200?"★★★":APP.score>=140?"★★☆":"★☆☆");
    $("#sumBody")  && ($("#sumBody").textContent  = `Score: ${APP.score} • Combo Max: x${APP.comboMax} • Mode: ${APP.mode} • Diff: ${APP.difficulty}`);
    showSummary();
    document.body.classList.remove("game-running");
  }

  // ---------- Scene click fallback ----------
  (function(){
    const scene=document.querySelector("a-scene"); if(!scene) return;
    scene.addEventListener("click",(e)=>{
      const el=e.target; if(el && el.classList && el.classList.contains("clickable")) el.dispatchEvent(new Event("click"));
    });
  })();

  // ---------- Bind to UI ----------
  const REAL = {
    start: startGame, pause: pauseGame,
    restart: ()=>{ hideSummary(); APP.running=false; APP.paused=false; clearTimeout(loopH); clearTimeout(timerH); SPAWN_COUNT=0; startGame(); },
    how: ()=>{ /* ใช้ของ index */ },
    setMode: m=> setMode(m),
    setDiff: d=> setDiff(d),
    toggleLang: ()=>{ APP.lang=(APP.lang==="th"?"en":"th"); localStorage.setItem("vrn_lang",APP.lang); }
  };
  if(window.GAME_UI && typeof window.GAME_UI._bind==="function") window.GAME_UI._bind(REAL);
  else window.GAME_UI = REAL;

  // ---------- Init ----------
  setMode(APP.mode); setHUD();
})();
