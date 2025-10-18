(() => {
  const $ = s => document.querySelector(s);
  const dbg = msg => { const d=$("#dbg"); d && (d.textContent = msg); };

  // สถานะหลัก
  const APP = { score:0, timeLeft:60, running:false, paused:false, difficulty:"Normal", combo:1, comboMax:1 };

  // HUD ย่อ
  function updateHUD(){ /* มีแต่ debug ในรุ่นทดสอบนี้ */ }

  // ตรวจพร้อม (หลายสัญญาณ) + บังคับเริ่มถ้าเงียบเกิน
  let sceneReady=false;
  function checkReadyAndStart(force=false){
    const scene = $('#scene');
    const hasCanvas = !!document.querySelector('canvas.a-canvas');
    const rendererOK = !!(scene && (scene.hasLoaded || scene.renderer || scene.canvas || hasCanvas));

    if(force || rendererOK){
      sceneReady = true;
      dbg('engine ready → start');
      startGame(true);
      return;
    }
    dbg('waiting engine…');
  }

  function wireReadiness(){
    const scene = $('#scene');
    if(!scene){ dbg('no scene?'); setTimeout(wireReadiness,100); return; }

    // 1) ถ้าโหลดแล้ว
    if (scene.hasLoaded){ checkReadyAndStart(true); return; }

    // 2) ฟัง loaded / render-target-loaded
    scene.addEventListener('loaded', ()=>{ checkReadyAndStart(true); }, {once:true});
    scene.addEventListener('render-target-loaded', ()=>{ checkReadyAndStart(true); }, {once:true});

    // 3) เผื่อไว้: force หลัง 1200ms
    setTimeout(()=>{ if(!sceneReady) checkReadyAndStart(true); }, 1200);
  }

  // สปอว์นเป็นทรงกลมสี (ไม่ใช้รูป)
  const ACTIVE = new Set();
  function spawnOne(){
    const root = $('#spawnerRoot'); if(!root){ dbg('no spawnerRoot'); return; }
    const maxAct = APP.difficulty==="Hard"?5:APP.difficulty==="Easy"?3:4;
    if(ACTIVE.size >= maxAct) return;

    const pick = a => a[Math.floor(Math.random()*a.length)];
    const x = pick([-0.9, 0, 0.9]);
    const y = pick([-0.05, 0.12, 0.29]);
    const z = pick([-0.36, 0, 0.36]);
    const colors = ['#39d','#0f9','#fd0','#f55','#9f6','#0ff','#f0f'];
    const color = pick(colors);

    const ent = document.createElement('a-sphere');
    ent.setAttribute('radius','0.35');
    ent.setAttribute('color', color);
    ent.setAttribute('position', `${x} ${y} ${z}`);
    ent.setAttribute('class','clickable');
    ent.setAttribute('material','shader:flat;opacity:0.95');

    ent.addEventListener('click', ()=>{
      APP.score += 5; APP.combo = Math.min(5, APP.combo+1); APP.comboMax = Math.max(APP.comboMax, APP.combo);
      updateHUD(); ent.remove(); ACTIVE.delete(ent);
    });

    root.appendChild(ent); ACTIVE.add(ent);

    const life = APP.difficulty==="Hard"?1800:APP.difficulty==="Easy"?4200:3000;
    setTimeout(()=>{ if(ent.parentNode){ ent.remove(); ACTIVE.delete(ent); } }, life);
  }

  let loopH=null, timerH=null;
  function loop(){
    if(!APP.running || APP.paused) return;
    spawnOne();
    const base=720, rate=APP.difficulty==="Hard"?base*0.8:APP.difficulty==="Easy"?base*1.25:base;
    loopH = setTimeout(loop, rate);
  }
  function timer(){
    if(!APP.running || APP.paused) return;
    timerH = setTimeout(()=>{
      APP.timeLeft--; updateHUD();
      if(APP.timeLeft<=0){ endGame(); } else timer();
    }, 1000);
  }

  function startGame(forced){
    if(APP.running && !APP.paused) return;
    if(!forced){ dbg('guard start (should not happen)'); }

    APP.running = true; APP.paused=false;
    APP.score=0; APP.combo=1; APP.comboMax=1; APP.timeLeft=60; updateHUD();
    document.body.classList.add('game-running');
    setTimeout(()=>{ spawnOne(); loop(); timer(); }, 200);
    dbg('game running');
  }

  function pauseGame(){
    if(!APP.running) return;
    APP.paused = !APP.paused;
    if(APP.paused){ clearTimeout(loopH); clearTimeout(timerH); dbg('paused'); }
    else { dbg('resumed'); loop(); timer(); }
  }

  function endGame(){
    APP.running=false; APP.paused=false; clearTimeout(loopH); clearTimeout(timerH);
    document.body.classList.remove('game-running');
    dbg('ended');
  }

  // bind ให้ปุ่มใน index เรียกได้
  const REAL = {
    start: ()=>{ dbg('start clicked'); checkReadyAndStart(false); },
    pause: ()=> pauseGame(),
    restart: ()=>{ dbg('restart clicked'); endGame(); setTimeout(()=>checkReadyAndStart(false), 50); }
  };
  window.GAME_UI = REAL; // ใช้ตรง ๆ

  // เริ่มเฝ้าพร้อม engine
  wireReadiness();
  dbg('ready (click ▶ เริ่มเกม)');
})();
