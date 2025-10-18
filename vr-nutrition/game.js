// game.js — force-ready on Windows Chrome (no more stuck "waiting…")
(() => {
  const $ = s => document.querySelector(s);

  // ---------- Debug HUD ----------
  function dbg(msg){
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
  let loopH=null, timerH=null;

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

  // ---------- Readiness (robust) ----------
  let sceneReady=false, assetsReady=false, forceStarted=false;
  let forceAllTimeout=null, forceSceneTimeout=null, forceAssetsTimeout=null;

  function hasCanvas(){
    return !!document.querySelector('canvas.a-canvas');
  }
  function sceneLooksReady(scene){
    return !!(scene && (scene.hasLoaded || scene.renderer || scene.canvas || hasCanvas() || (scene.systems && Object.keys(scene.systems).length)));
  }

  function markSceneReady(){
    if(sceneReady) return;
    sceneReady = true;
    dbg(`scene:ready assets:${assetsReady}`);
  }
  function markAssetsReady(){
    if(assetsReady) return;
    assetsReady = true;
    dbg(`scene:${sceneReady} assets:ready`);
  }

  function watchReady(){
    const scene  = document.querySelector('a-scene');
    const assets = document.querySelector('a-assets');

    // AFRAME script readiness
    if(!window.AFRAME){
      dbg('waiting AFRAME…');
      const w = setInterval(()=>{
        if(window.AFRAME){ clearInterval(w); watchReady(); }
      }, 60);
      // ultimate guard
      setTimeout(()=>{ if(!window.AFRAME){ dbg('AFRAME timeout → force start'); markSceneReady(); markAssetsReady(); startGame(true); }}, 4000);
      return;
    }

    // Scene events
    if(scene){
      if(sceneLooksReady(scene)) markSceneReady();
      scene.addEventListener('loaded', markSceneReady, {once:true});
      scene.addEventListener('render-target-loaded', markSceneReady, {once:true});
      // camera sometimes emits when renderer ready
      const cam = document.querySelector('[camera]');
      cam && cam.addEventListener('render-target-loaded', markSceneReady, {once:true});
    } else {
      // poll scene creation
      const p = setInterval(()=>{
        const sc = document.querySelector('a-scene');
        if(sc){ clearInterval(p); watchReady(); }
      }, 80);
    }

    // Assets events
    if(assets){
      assets.addEventListener('loaded', markAssetsReady, {once:true});
      // if images already complete
      const imgs = assets.querySelectorAll('img');
      if(imgs.length){
        let allDone = true;
        imgs.forEach(img=>{ if(img.complete === false) allDone=false; });
        if(allDone) markAssetsReady();
      } else {
        // no images → treat as ready
        markAssetsReady();
      }
    } else {
      // no a-assets tag → treat ready
      markAssetsReady();
    }

    // Timeouts (force-ready)
    forceSceneTimeout = setTimeout(()=>{ if(!sceneReady){ dbg('scene timeout→force ready'); markSceneReady(); } }, 2000);
    forceAssetsTimeout= setTimeout(()=>{ if(!assetsReady){ dbg('assets timeout→force ready'); markAssetsReady(); } }, 2000);

    // Ultimate fallback: start anyway after a grace period
    forceAllTimeout = setTimeout(()=>{
      if(!forceStarted && (!sceneReady || !assetsReady)){
        dbg(`ultimate force start (scene:${sceneReady} assets:${assetsReady})`);
        markSceneReady(); markAssetsReady();
        startGame(true);
      }
    }, 3000);
  }

  // ---------- Spawner (minimal to visualize) ----------
  const ACTIVE = new Set();
  const IMG_IDS = ["#apple","#broccoli","#water","#burger","#soda","#donut","#g_grains","#g_protein","#g_veggies","#g_fruits","#g_dairy"];
  function imgOK(id){
    const el = document.querySelector(id);
    return !!(el && (el.complete !== false));
  }
  function spawnOne(){
    const root = document.getElementById('spawnerRoot');
    if(!root){ dbg('no spawnerRoot'); return; }
    const maxAct = APP.difficulty==="Hard"?5:APP.difficulty==="Easy"?3:4;
    if(ACTIVE.size >= maxAct) return;

    const pick = a => a[Math.floor(Math.random()*a.length)];
    const x = pick([-0.9, 0, 0.9]);
    const y = pick([-0.05, 0.12, 0.29]);
    const z = pick([-0.36, 0, 0.36]);
    const srcId = pick(IMG_IDS);
    const hasImg = imgOK(srcId);

    const ent = document.createElement(hasImg ? 'a-image' : 'a-entity');
    if (hasImg) {
      ent.setAttribute('src', srcId);
      ent.setAttribute('geometry','primitive:plane;width:1;height:1');
      ent.setAttribute('material','shader:flat;transparent:true;opacity:0.98');
    } else {
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

  // ---------- Lifecycle ----------
  function startGame(forced=false){
    if(APP.running && !APP.paused) return;

    if(!forced){
      // normal path: require ready
      if(!(sceneReady && assetsReady)){
        dbg(`waiting… scene:${sceneReady} assets:${assetsReady}`);
        const w = setInterval(()=>{
          if(sceneReady && assetsReady){
            clearInterval(w);
            startGame(false);
          }
        }, 80);
        return;
      }
    }

    // clear force timers (if any)
    clearTimeout(forceAllTimeout);
    clearTimeout(forceSceneTimeout);
    clearTimeout(forceAssetsTimeout);
    forceStarted = forced;

    if(!APP.running){
      APP.score=0; APP.combo=1; APP.comboMax=1; APP.timeLeft=60; updateHUD();
    }
    APP.running=true; APP.paused=false;
    document.body.classList.add('game-running');
    setTimeout(()=>{ spawnOne(); loop(); timer(); }, forced ? 200 : 300);

    dbg(`game: running ${forced?'(forced)':''}`);
  }

  function pauseGame(){
    if(!APP.running) return;
    APP.paused = !APP.paused;
    if(APP.paused){ clearTimeout(loopH); clearTimeout(timerH); dbg('game: paused'); }
    else { dbg('game: resumed'); loop(); timer(); }
  }

  function endGame(){
    APP.running=false; APP.paused=false;
    clearTimeout(loopH); clearTimeout(timerH);
    if(APP.score>APP.best){ APP.best=APP.score; localStorage.setItem("vrn_best", String(APP.best)); }

    const stars = APP.score>=200 ? "★★★" : APP.score>=140 ? "★★☆" : "★☆☆";
    const sum = document.getElementById('summary');
    if(sum){
      $('#sumStars').textContent = stars;
      $('#sumBody').textContent  = `Score: ${APP.score} • Combo Max: x${APP.comboMax} • Mode: ${APP.mode} • Diff: ${APP.difficulty}`;
      sum.classList.add('show');
    }
    document.body.classList.remove('game-running');
    dbg('game: ended');
  }

  // Scene click fallback (safety)
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
    restart: ()=>{ const sum=$("#summary"); sum && sum.classList.remove('show');
                   APP.running=false; APP.paused=false; clearTimeout(loopH); clearTimeout(timerH);
                   APP.score=0; APP.combo=1; APP.comboMax=1; APP.timeLeft=60; updateHUD(); startGame(); },
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
