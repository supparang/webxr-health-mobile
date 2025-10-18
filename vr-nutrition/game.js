// game.js — robust start (scene/assets ready) + spawn fallback + debug HUD
(() => {
  const $ = s => document.querySelector(s);

  // ---------- Debug HUD ----------
  function setDebug(msg){
    let el = document.getElementById('dbg');
    if(!el){
      el = document.createElement('div');
      el.id = 'dbg';
      el.style.cssText = 'position:fixed;left:10px;bottom:10px;z-index:2147483647;color:#0ff;font:12px/1.2 system-ui;background:rgba(0,0,0,.5);padding:6px 8px;border:1px solid #0ff;border-radius:8px';
      document.body.appendChild(el);
    }
    el.textContent = msg;
  }

  // ---------- State ----------
  const APP = {
    mode: localStorage.getItem("vrn_mode") || "goodjunk",
    difficulty: localStorage.getItem("vrn_diff") || "Normal",
    score:0, timeLeft:60, running:false, paused:false, combo:1, comboMax:1,
    best: parseInt(localStorage.getItem("vrn_best")||"0")
  };
  let loopH=null, timerH=null, sceneReady=false, assetsReady=false;

  // ---------- HUD ----------
  function updateHUD(){
    const map = {goodjunk:"Good vs Junk", groups:"Food Groups", hydration:"Hydration", plate:"Build Plate"};
    $("#score") && ($("#score").textContent=APP.score);
    $("#time") && ($("#time").textContent=APP.timeLeft);
    $("#best") && ($("#best").textContent=APP.best);
    $("#difficulty") && ($("#difficulty").textContent=APP.difficulty);
    $("#combo") && ($("#combo").textContent="x"+APP.combo);
    $("#modeName") && ($("#modeName").textContent = map[APP.mode] || APP.mode);
  }
  function setMode(m){ APP.mode=m; localStorage.setItem("vrn_mode",m); updateHUD(); }
  function setDiff(d){ APP.difficulty=d; localStorage.setItem("vrn_diff",d); updateHUD(); }

  // ---------- Scene & Assets readiness ----------
  function watchReady(){
    const scene = document.querySelector('a-scene');
    const assets= document.querySelector('a-assets');
    if (!scene) { setTimeout(watchReady, 50); return; }

    const markSceneReady = ()=>{ sceneReady = true; setDebug(`scene:ready assets:${assetsReady}`); };
    const markAssetsReady= ()=>{ assetsReady= true; setDebug(`scene:${sceneReady} assets:ready`); };

    if (scene.hasLoaded) markSceneReady();
    else scene.addEventListener('loaded', markSceneReady, {once:true});

    if (assets){
      // a-assets fires 'loaded' when all child assets are loaded (or errored but finished)
      assets.addEventListener('loaded', markAssetsReady, {once:true});
      // fallback timeout: evenหาก 'loaded' ไม่ยิง ให้ถือว่า ready หลัง 1.5s
      setTimeout(()=>{ if(!assetsReady){ assetsReady=true; setDebug(`assets:timeout→ready`);} }, 1500);
    } else {
      assetsReady = true; // ไม่มี a-assets ก็ถือว่าพร้อม
    }
  }

  // ---------- Spawn with fallback ----------
  const ACTIVE = new Set();
  const IMG_IDS = ["#apple","#broccoli","#water","#burger","#soda","#donut","#g_grains","#g_protein","#g_veggies","#g_fruits","#g_dairy"];
  function imgExists(id){
    const el = document.querySelector(id);
    return !!(el && el.complete !== false); // ถ้ามีใน a-assets ถือว่าใช้ได้
  }
  function spawnOne(){
    const root = document.getElementById('spawnerRoot');
    if(!root){ setDebug('no spawnerRoot'); return; }

    const maxAct = APP.difficulty==="Hard"?5:APP.difficulty==="Easy"?3:4;
    if(ACTIVE.size >= maxAct) return;

    // pick position (relative to spawnerRoot at z≈-2.2)
    const pick = arr => arr[Math.floor(Math.random()*arr.length)];
    const x = pick([-0.9, 0, 0.9]);
    const y = pick([-0.05, 0.12, 0.29]);
    const z = pick([-0.36, 0, 0.36]);

    const srcId = pick(IMG_IDS);
    const hasImg = imgExists(srcId);

    const ent = document.createElement(hasImg ? 'a-image' : 'a-entity');
    if (hasImg) {
      ent.setAttribute('src', srcId);
      ent.setAttribute('geometry','primitive:plane;width:1;height:1');
      ent.setAttribute('material','shader:flat;transparent:true;opacity:0.98');
    } else {
      // Fallback: สีแทนรูป (เห็นแน่ ๆ)
      ent.setAttribute('geometry','primitive:plane;width:1;height:1');
      ent.setAttribute('material','color:#39d;opacity:0.95;shader:flat');
    }
    ent.setAttribute('class','clickable');
    ent.setAttribute('position', `${x} ${y} ${z}`);
    ent.setAttribute('scale','0.78 0.78 0.78');
    ent.setAttribute('animation__pulse','property: scale; dir: alternate; dur: 640; loop: true; to: 0.85 0.85 0.85');

    ent.addEventListener('click', ()=>{
      APP.score += 5;
      APP.combo = Math.min(5, APP.combo+1);
      APP.comboMax = Math.max(APP.comboMax, APP.combo);
      updateHUD();
      ent.remove(); ACTIVE.delete(ent);
    });

    root.appendChild(ent);
    ACTIVE.add(ent);

    const life = APP.difficulty==="Hard"?1900:APP.difficulty==="Easy"?4200:3000;
    setTimeout(()=>{ if(ent.parentNode){ ent.remove(); ACTIVE.delete(ent); } }, life);
  }

  function loop(){
    if(!APP.running || APP.paused) return;
    spawnOne();
    const base=760, rate=APP.difficulty==="Hard"?base*0.8:APP.difficulty==="Easy"?base*1.25:base;
    loopH = setTimeout(loop, rate);
  }
  function timer(){
    if(!APP.running || APP.paused) return;
    timerH = setTimeout(()=>{
      APP.timeLeft--; updateHUD();
      if(APP.timeLeft<=0){ endGame(); } else timer();
    }, 1000);
  }

  function canStartNow(){
    // รอทั้ง scene และ assets เพื่อกันเคส spawn ก่อนฉากพร้อม
    return sceneReady && assetsReady;
  }

  // ---------- Lifecycle ----------
  function startGame(){
    if(APP.running && !APP.paused) return;

    // รอพร้อมจริงก่อนเริ่ม
    if(!canStartNow()){
      setDebug(`waiting… scene:${sceneReady} assets:${assetsReady}`);
      const wait = setInterval(()=>{
        if(canStartNow()){
          clearInterval(wait);
          startGame(); // เรียกซ้ำเมื่อพร้อม
        }
      }, 100);
      return;
    }

    if(!APP.running){
      APP.score=0; APP.combo=1; APP.comboMax=1; APP.timeLeft=60; updateHUD();
    }
    APP.running=true; APP.paused=false;

    // เปิดคลิกให้ฉาก (index จัดการ pointer-events ผ่าน class นี้)
    document.body.classList.add('game-running');

    // เคส Chrome บางเครื่อง: spawn ครั้งแรกหลังพร้อม 200–500ms
    setTimeout(()=>{ spawnOne(); loop(); timer(); }, 300);

    setDebug('game: running (spawn loop started)');
  }

  function pauseGame(){
    if(!APP.running) return;
    APP.paused = !APP.paused;
    if(APP.paused){ clearTimeout(loopH); clearTimeout(timerH); setDebug('game: paused'); }
    else { setDebug('game: resumed'); loop(); timer(); }
  }

  function endGame(){
    APP.running=false; APP.paused=false;
    clearTimeout(loopH); clearTimeout(timerH);
    if(APP.score>APP.best){ APP.best=APP.score; localStorage.setItem("vrn_best", String(APP.best)); }

    const stars = APP.score>=200 ? "★★★" : APP.score>=140 ? "★★☆" : "★☆☆";
    const sum = document.getElementById('summary');
    if(sum){
      document.getElementById('sumStars').textContent = stars;
      document.getElementById('sumBody').textContent  = `Score: ${APP.score} • Combo Max: x${APP.comboMax} • Mode: ${APP.mode} • Diff: ${APP.difficulty}`;
      sum.classList.add('show');
    }

    document.body.classList.remove('game-running'); // ปิดคลิกฉากให้เมนูทำงาน
    setDebug('game: ended');
  }

  // ---------- Scene click fallback (safety) ----------
  (function(){
    const scene = document.querySelector('a-scene');
    if(!scene) return;
    scene.addEventListener('click', (e)=>{
      const el=e.target;
      if(el && el.classList && el.classList.contains('clickable')){
        el.dispatchEvent(new Event('click'));
      }
    });
  })();

  // ---------- Init & bind ----------
  updateHUD(); setMode(APP.mode); watchReady();

  const REAL = {
    start: startGame, pause: pauseGame,
    restart: ()=>{ const sum=document.getElementById('summary'); sum && sum.classList.remove('show');
                   APP.running=false; APP.paused=false; clearTimeout(loopH); clearTimeout(timerH);
                   APP.score=0; APP.combo=1; APP.comboMax=1; APP.timeLeft=60; updateHUD();
                   startGame(); },
    how: ()=>{ if(typeof window.openHow==='function'){ window.openHow(`
      <div><b>เริ่ม:</b> เลือกโหมด/ความยาก แล้วกดเริ่มเกม</div>
      <div><b>การควบคุม:</b> คลิก/แตะ หรือจ้องใน VR จนวงแหวนครบ</div>
      <div><b>ทิปส์:</b> รักษาคอมโบ คะแนนพุ่งไว</div>`); } },
    setMode:(m)=> setMode(m), setDiff:(d)=> setDiff(d),
    toggleLang:()=>{}, toggleVoice:()=>{}
  };
  if(window.GAME_UI && typeof window.GAME_UI._bind==='function'){ window.GAME_UI._bind(REAL); }
  else { window.GAME_UI = REAL; }
})();
