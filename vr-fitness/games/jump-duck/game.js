(function(){
  "use strict";

  const menu = document.getElementById('menu');
  const hud = document.getElementById('hud');
  const result = document.getElementById('result');

  const scoreEl = document.getElementById('score');
  const timerEl = document.getElementById('timer');
  const feverBar = document.getElementById('feverBar');
  const multEl = document.getElementById('mult');
  const puShieldEl = document.getElementById('puShield');
  const puSlowEl = document.getElementById('puSlow');
  const puHealEl = document.getElementById('puHeal');
  const puSuperEl = document.getElementById('puSuper');

  const rScore = document.getElementById('rScore');
  const rStreak = document.getElementById('rStreak');
  const rAcc = document.getElementById('rAcc');
  const starsEl = document.getElementById('stars');

  const coachText = document.getElementById('coach');
  const scene = document.querySelector('a-scene');
  const obstaclesRoot = document.getElementById('obstacles');
  const sky = document.getElementById('sky');
  const ground = document.getElementById('ground');
  const envLight = document.getElementById('envLight');
  const dirLight = document.getElementById('dirLight');

  const btnStart = document.getElementById('start');
  const btnRetry = document.getElementById('retry');
  const btnHome = document.getElementById('home');
  const toggleBgmBtn = document.getElementById('toggleBgm');
  const toggleCoachBtn = document.getElementById('toggleCoach');
  const btnUseShield = document.getElementById('btnUseShield');
  const btnUseSlow = document.getElementById('btnUseSlow');
  const btnUseHeal = document.getElementById('btnUseHeal');
  const fxFlash = document.getElementById('fxFlash');

  // Audio
  const sfx = {
    bgm: document.getElementById('sfx-bgm'),
    hit: document.getElementById('sfx-hit'),
    miss: document.getElementById('sfx-miss'),
    fever: document.getElementById('sfx-fever'),
    powerup: document.getElementById('sfx-powerup'),
    super: document.getElementById('sfx-super'),
    coachReady: document.getElementById('coach-ready'),
    coachGood: document.getElementById('coach-good'),
    coachMiss: document.getElementById('coach-miss'),
    perfect: document.getElementById('sfx-perfect'),
    good: document.getElementById('sfx-good')
  };
  sfx.bgm.loop = true;

  let audioEnabled = true;
  let coachEnabled = true;

  // State
  let state = "idle"; // idle | playing | ended
  let diff = "normal";
  let theme = "forest";
  let mode = "classic"; // classic | speed | endurance | zen | boss

  // Core stats
  let score = 0, timeLeft = 90, fever = 0;
  // Power-ups & Super Fever
  let shieldCharges = 0;
  let slowUntil = 0; // timestamp
  let superFeverUntil = 0; // timestamp when super fever ends
  let streak = 0, bestStreak = 0;
  let hitCount = 0, missCount = 0;

  // Combo / Multiplier
  let multiplier = 1.0;
  function calcMultiplier(){
    if(streak >= 30) return 2.5;
    if(streak >= 20) return 2.0;
    if(streak >= 10) return 1.5;
    return 1.0;
  }

  // Obstacles
  let spawnTimer = 0, spawnInterval = 1800;
  let gameTimerId = null, spawnerId = null;
  let gameEndAt = 0; let tickerId = null;
  let poolReady=false;

  // Configurable settings
  let powerupRate = 'normal'; // low|normal|high
  let slowDurationSec = 3.5;
  let superFeverSec = 6;

  // Action flags
  let jumping=false, ducking=false, dashingL=false, dashingR=false, actedAt=0;
  // Calibration & thresholds
  let playerHeight = 1.6; // default eye height (meters)
  let yScale = 1.0; // derived from playerHeight/1.6

  function setTheme(name){
    theme = name;
    if(name==="forest"){ sky.setAttribute('src', '#bg-forest'); ground.setAttribute('color','#6ac36a'); }
    if(name==="city"){ sky.setAttribute('src', '#bg-city'); ground.setAttribute('color','#9ca3af'); }
    if(name==="space"){ sky.setAttribute('src', '#bg-space'); ground.setAttribute('color','#111827'); }
  }

  function setDiff(name){
    diff = name;
    if(name==="easy"){ timeLeft = 90; spawnInterval = 2200; }
    if(name==="normal"){ timeLeft = 85; spawnInterval = 1700; }
    if(name==="hard"){ timeLeft = 80; spawnInterval = 1200; }
    // mode overrides will adjust later
    return timeLeft;
  }

  function setMode(name){
    mode = name;
    if(name==="classic"){ /* keep diff */ }
    if(name==="speed"){ /* Speed Rush */ spawnInterval = Math.max(900, spawnInterval-500); timeLeft = 60; }
    if(name==="endurance"){ spawnInterval = spawnInterval + 400; timeLeft = 180; }
    if(name==="zen"){ spawnInterval = spawnInterval + 600; timeLeft = 120; }
    if(name==="boss"){ timeLeft = Math.max(70, timeLeft); /* last 60s boss */ }
  }

  // UI interactions
  menu.addEventListener('click', (e)=>{
    const t = e.target;
    if(t.dataset.diff){ setDiff(t.dataset.diff); Array.from(t.parentElement.children).forEach(b=>b.classList.remove('primary')); t.classList.add('primary'); }
    if(t.dataset.theme){ setTheme(t.dataset.theme); Array.from(t.parentElement.children).forEach(b=>b.classList.remove('primary')); t.classList.add('primary'); }
    if(t.dataset.mode){ setMode(t.dataset.mode); Array.from(t.parentElement.children).forEach(b=>b.classList.remove('primary')); t.classList.add('primary'); }
    if(t.dataset.purate){ powerupRate = t.dataset.purate; Array.from(t.parentElement.children).forEach(b=>b.classList.remove('primary')); t.classList.add('primary'); }
    if(t.dataset.slowdur){ slowDurationSec = parseFloat(t.dataset.slowdur); Array.from(t.parentElement.children).forEach(b=>b.classList.remove('primary')); t.classList.add('primary'); }
    if(t.dataset.superdur){ superFeverSec = parseInt(t.dataset.superdur,10); Array.from(t.parentElement.children).forEach(b=>b.classList.remove('primary')); t.classList.add('primary'); }
  });

  toggleBgmBtn.addEventListener('click', ()=>{
    audioEnabled = !audioEnabled;
    toggleBgmBtn.textContent = "BGM: " + (audioEnabled ? "On" : "Off");
    if(!audioEnabled) sfx.bgm.pause();
  });
  toggleCoachBtn.addEventListener('click', ()=>{
    coachEnabled = !coachEnabled;
    toggleCoachBtn.textContent = "Coach: " + (coachEnabled ? "On" : "Off");
  });

  btnStart.addEventListener('click', startGame);
  document.getElementById('btnCalibrateHtml')?.addEventListener('click', calibrateHeight);
  const btn3dStart = document.getElementById('btn3d-start');
  const btn3dCal = document.getElementById('btn3d-cal');
  btn3dStart?.addEventListener('click', ()=>{ startGame(); });
  btn3dCal?.addEventListener('click', calibrateHeight);
  scene.addEventListener('enter-vr', ()=>{ try{ document.getElementById('menu3d').setAttribute('visible', true); }catch(e){} hide(menu); });
  scene.addEventListener('exit-vr', ()=>{ try{ document.getElementById('menu3d').setAttribute('visible', true); }catch(e){} show(menu); });
  btnStart.addEventListener('touchend', (e)=>{ e.preventDefault(); startGame(); });
  btnRetry.addEventListener('click', resetToMenu);
  btnRetry.addEventListener('touchend', (e)=>{ e.preventDefault(); resetToMenu(); });
  btnHome?.addEventListener('click', resetToMenu);
  btnHome?.addEventListener('touchend', (e)=>{ e.preventDefault(); resetToMenu(); });
  // Manual activation buttons
  function useShield(){ if(state!=='playing') return; if(shieldCharges<=0) return; shieldCharges--; speakCoach('Shield armed!'); if(sfx.powerup){ try{sfx.powerup.currentTime=0;sfx.powerup.play();}catch(e){} } updateHUD(); }
  function useSlow(){ if(state!=='playing') return; slowUntil = Date.now() + Math.floor(slowDurationSec*1000); speakCoach('Slow time!'); if(sfx.powerup){ try{sfx.powerup.currentTime=0;sfx.powerup.play();}catch(e){} } updateHUD(); }
  function useHeal(){ if(state!=='playing') return; fever = Math.min(100, fever + 20); speakCoach('Energy boost!'); if(sfx.powerup){ try{sfx.powerup.currentTime=0;sfx.powerup.play();}catch(e){} } updateHUD(); }

  btnUseShield?.addEventListener('click', useShield);
  btnUseShield?.addEventListener('touchend', (e)=>{ e.preventDefault(); useShield(); });
  btnUseSlow?.addEventListener('click', useSlow);
  btnUseSlow?.addEventListener('touchend', (e)=>{ e.preventDefault(); useSlow(); });
  btnUseHeal?.addEventListener('click', useHeal);
  btnUseHeal?.addEventListener('touchend', (e)=>{ e.preventDefault(); useHeal(); });

  // Hotkeys: Q/E/R
  window.addEventListener('keydown', (e)=>{
    if(state!=='playing') return;
    if(e.key==='q' || e.key==='Q') useShield();
    if(e.key==='e' || e.key==='E') useSlow();
    if(e.key==='r' || e.key==='R') useHeal();
  });


  function show(el){ el.classList.add('show'); if(el.id==='menu' || el.id==='result'){ document.body.classList.add('menu-open'); } }

  function calibrateHeight(){
    try{
      const cam = document.querySelector('[camera]');
      const y = parseFloat(cam.getAttribute('position').y);
      if(!isNaN(y) && y>0.9 && y<2.3){ playerHeight = y; yScale = playerHeight/1.6; speakCoach(`Height set to ${playerHeight.toFixed(2)} meters.`); }
      else { speakCoach('Calibration failed. Stand naturally and try again.'); }
    }catch(e){ speakCoach('Calibration not available.'); }
  }
  function hide(el){ el.classList.remove('show'); if(el.id==='menu' || el.id==='result'){ document.body.classList.remove('menu-open'); } }

  function updateHUD(){
    scoreEl.textContent = String(score);
    timerEl.textContent = String(timeLeft);
    feverBar.style.width = `${fever}%`;
    multEl.textContent = `x${multiplier.toFixed(1)}`;
    puShieldEl.textContent = `S:${shieldCharges}`;
    puSlowEl.textContent = `T:${Math.max(0, Math.ceil((slowUntil-Date.now())/1000))}`;
    puHealEl.textContent = `H:${Math.min(100, fever)}`;
    puSuperEl.textContent = `SF:${Math.max(0, Math.ceil((superFeverUntil-Date.now())/1000))}`;
  }

  function startTicker(){
    stopTicker();
    tickerId = setInterval(()=>{
      if(state!=="playing") return;
      const now = Date.now();
      const remainingMs = Math.max(0, gameEndAt - now);
      const sec = Math.ceil(remainingMs/1000);
      if(sec <= timeLeft){ timeLeft = sec; }
      updateHUD();
      dynamicEnvironmentTick();
      // super fever tick visuals
      if(superFeverUntil>0 && superFeverUntil<=Date.now()){ superFeverUntil = 0; }
      if(remainingMs<=0){ endGame(); }
    }, 200);
  }
  function stopTicker(){ if(tickerId){ clearInterval(tickerId); tickerId=null; } }

  function startGame(){
    if(state!=="idle" && state!=="ended") return;
    state="playing";
    hide(menu);
    show(hud);

    // Reset stats
    score=0; fever=0; streak=0; bestStreak=0; hitCount=0; missCount=0;
    multiplier = 1.0; actedAt = 0;
    obstaclesRoot.innerHTML = "";

    // apply diff & mode
    setDiff(diff);
    setMode(mode);

    speakCoach("Ready! Let's go!");
    sfx.coachReady.currentTime = 0; if(audioEnabled) sfx.coachReady.play();
    if(audioEnabled){ try { sfx.bgm.currentTime=0; sfx.bgm.play(); } catch(e){} }

    // countdown (timestamp-based)
    const durSec = timeLeft;
    gameEndAt = Date.now() + durSec*1000;
    startTicker();

    // init pool & spawner
    if(!poolReady){ initPool(); poolReady=true; }
    if(spawnerId) clearInterval(spawnerId);
    spawnerId = setInterval(spawnObstacle, spawnInterval);

    // boss phase: last 60s become boss pattern
    if(mode==="boss"){
      setTimeout(()=>{ speakCoach("Boss challenge! Survive the final minute!"); }, Math.max(0,(durSec-60))*1000);
    }
  }

  function endGame(){
    state="ended";
    clearInterval(gameTimerId); clearInterval(spawnerId);
    stopTicker();
    if(audioEnabled) sfx.bgm.pause();
    showResult();
  }

  function showResult(){
    hide(hud);
    // compute stats
    const total = hitCount + missCount;
    const acc = total>0 ? Math.round((hitCount/total)*100) : 0;
    rScore.textContent = String(score);
    rStreak.textContent = String(bestStreak);
    rAcc.textContent = acc + "%";

    // Rank by score & accuracy
    let rank = "C";
    if(acc>=50 && score>=300) rank = "B";
    if(acc>=70 && score>=600) rank = "A";
    if(acc>=85 && score>=900) rank = "S";
    // Stars by score
    let star = 1;
    if(score>200) star=2;
    if(score>400) star=3;
    if(score>650) star=4;
    if(score>900) star=5;
    starsEl.textContent = `Rank ${rank} · ` + "★".repeat(star) + "☆".repeat(5-star);

    show(result);
    speakCoach(`Finished! Rank ${rank}. Score ${score}. Accuracy ${acc} percent. Great job!`);
  }

  function resetToMenu(){
    stopTicker();
    try{ if(gameTimerId) clearInterval(gameTimerId); }catch(e){}
    try{ if(spawnerId) clearInterval(spawnerId); }catch(e){}
    try{ sfx.bgm.pause(); }catch(e){}
    state = "idle";
    if(obstaclesRoot) obstaclesRoot.innerHTML = "";
    hide(result);
    show(menu);
  }

  // Controls (keyboard)
  window.addEventListener('keydown', (e)=>{
    if(state!=="playing") return;
    if(e.key==="ArrowUp"||e.key==="w"||e.key===" "){ doJump(); }
    if(e.key==="ArrowDown"||e.key==="s"||e.key==="Control"){ doDuck(); }
    if(e.key==="ArrowLeft"||e.key==="a"){ doDashL(); }
    if(e.key==="ArrowRight"||e.key==="d"){ doDashR(); }
  });

  function doJump(){ jumping = true; actedAt = Date.now(); setTimeout(()=> jumping=false, 650); coachText.setAttribute("text","value","Jump!"); }
  function doDuck(){ ducking = true; actedAt = Date.now(); setTimeout(()=> ducking=false, 650); coachText.setAttribute("text","value","Duck!"); }
  function doDashL(){ dashingL = true; actedAt = Date.now(); setTimeout(()=> dashingL=false, 650); coachText.setAttribute("text","value","Dash Left!"); }
  function doDashR(){ dashingR = true; actedAt = Date.now(); setTimeout(()=> dashingR=false, 650); coachText.setAttribute("text","value","Dash Right!"); }


  // ---------- Entity Pool ----------
  const POOL = { box: [], torus: [], sphere: [] };
  function initPool(){
    for(let i=0;i<28;i++){ const e=document.createElement('a-box'); e.setAttribute('visible', false); obstaclesRoot.appendChild(e); POOL.box.push(e); }
    for(let i=0;i<10;i++){ const e=document.createElement('a-torus'); e.setAttribute('visible', false); obstaclesRoot.appendChild(e); POOL.torus.push(e); }
    for(let i=0;i<12;i++){ const e=document.createElement('a-sphere'); e.setAttribute('visible', false); obstaclesRoot.appendChild(e); POOL.sphere.push(e); }
  }
  function getFromPool(kind){
    const arr = POOL[kind]; if(!arr || arr.length===0) return null;
    const e = arr.pop(); e.setAttribute('visible', true); return e;
  }
  function returnToPool(e){
    if(!e) return;
    e.removeAttribute('animation'); e.setAttribute('visible', false);
    // reset common attributes
    e.removeAttribute('material'); e.removeAttribute('color'); e.setAttribute('position','0 -99 0');
    // push back
    const tag = e.tagName.toLowerCase();
    if(tag==='a-box') POOL.box.push(e);
    else if(tag==='a-torus') POOL.torus.push(e);
    else POOL.sphere.push(e);
  }

  // Spawn / mechanics
  function spawnObstacle(){
    if(state!=="playing") return;

    // Pick type with weights
    const types = ["jump","duck","dashL","dashR","ring","bomb","pu"];
    /* dynamic weights */ const weights = (powerupRate==='low')
      ? [0.28,0.28,0.16,0.16,0.07,0.05,0.03]
      : (powerupRate==='high')
      ? [0.24,0.24,0.14,0.14,0.08,0.05,0.11]
      : [0.26,0.26,0.15,0.15,0.07,0.05,0.06];
    const r = Math.random();
    let cum=0, type=types[0];
    for(let i=0;i<types.length;i++){ cum += weights[i]; if(r<=cum){ type=types[i]; break; } }

    // Boss pattern: faster mix
    let localDur = (diff==="easy")? 2500 : (diff==="normal")? 2000 : 1500;
    if(mode==="speed") localDur = Math.max(900, localDur-600);
    if(mode==="endurance") localDur = localDur + 300;
    if(mode==="boss" && timeLeft<=60){ localDur = Math.max(800, localDur-500); }
    // slow-time effect
    if(Date.now()<slowUntil){ localDur = Math.max(localDur*1.6, localDur+500); }

    const obs = (type==="ring") ? getFromPool('torus') : (type==="pu" ? getFromPool('sphere') : getFromPool('box')); if(!obs) return;
    let y = 0.35, height = 0.45, width = 1.6, depth = 0.6;
    if(type==="duck"){ y = 1.1; height = 1.2; }
    if(type==="dashL" || type==="dashR"){ y = 0.9*yScale; height = 0.7; width = 1.0; }
    if(type==="ring"){ y = 1.1; }
    obs.setAttribute('depth', depth);
    obs.setAttribute('width', width);
    obs.setAttribute('height', height);
    if(type==="jump") obs.setAttribute('material', 'src: #tx-jump');
    if(type==="duck") obs.setAttribute('material', 'src: #tx-duck');
    if(type==="dashL") obs.setAttribute('color', '#f59e0b');
    if(type==="dashR") obs.setAttribute('color', '#3b82f6');
    if(type==="ring") obs.setAttribute('radius', 0.9), obs.setAttribute('radius-tubular', 0.05), obs.setAttribute('color', '#22d3ee');
    if(type==="bomb") obs.setAttribute('color', '#111'); obs.setAttribute('height',0.7); y=0.9;
    if(type==="pu"){
      // power-up: choose one of shield/slow/heal
      const puTypes = ['shield','slow','heal'];
      const pick = puTypes[Math.floor(Math.random()*puTypes.length)];
      obs.setAttribute('geometry','primitive: sphere; radius: 0.35');
      const mat = pick==='shield' ? 'src: #tx-shield' : (pick==='slow' ? 'src: #tx-slow' : 'src: #tx-heal');
      obs.setAttribute('material', mat);
      obs.setAttribute('class', `pu-${pick}`);
      y = 1.0;
    }

    let x = 0;
    if(type==="dashL") x = -1.2;
    if(type==="dashR") x = +1.2;
    obs.setAttribute('position', `${x} ${y} -18`);
    obstaclesRoot.appendChild(obs);

    obs.setAttribute('animation', {
      property: 'position',
      to: `${x} ${y} 0.3`,
      dur: localDur,
      easing: 'linear',
      loop: false
    });

    obs._impactAt = Date.now() + (localDur-180);
    setTimeout(()=> checkCollision(obs, type, x, y), localDur-180);
  }

  function checkCollision(obs, type, x, y){
    if(state!=="playing") return;
    const now = Date.now();
    const actedRecently = (now - actedAt) <= 500; // 0.5s reaction window
    const impact = obs._impactAt || now;
    const delta = Math.abs((actedAt||0) - impact);
    const isPerfect = delta <= 150;
    const isGood = !isPerfect && delta <= 300;

    let success = false;
    if(type==="jump") success = jumping;
    else if(type==="duck") success = ducking;
    else if(type==="dashL") success = dashingL;
    else if(type==="dashR") success = dashingR;
    else if(type==="ring") success = jumping && actedRecently; // precise jump within window
    else if(type==="bomb") success = !actedRecently; // do nothing near bomb

    // collect power-ups automatically when reach player
    if(type==="pu"){
      addPowerUpToInventory(obs);
      return;
    }

    if(mode==="zen"){
      // Zen: no score, only coach guidance
      if(success){ speakCoach("Nice and steady."); }
      else { speakCoach("Breathe. Try again."); }
      returnToPool(obs); updateHUD(); return;
    }

    if(success){
      hitCount++;
      streak++;
      if(streak>bestStreak) bestStreak=streak;
      multiplier = calcMultiplier(); if(superFeverUntil>Date.now()) multiplier = Math.max(multiplier, 3.0);
      let base = 10;
      if(type==="ring") base = 20;
      if(type==="bomb") base = 15; // reward for restraint
      score += Math.floor(base * multiplier);
      fever = Math.min(100, fever + (type==="ring"?12:8));
      if(audioEnabled){ sfx.hit.currentTime=0; sfx.hit.play(); }
      if(streak===10) speakCoach("Great flow! Multiplier up!");
      if(streak===20) speakCoach("Unstoppable combo!");
      if(streak>0 && streak%10===0) speakCoach(`Streak ${streak}! Keep going!`);
      if(fever===100 && superFeverUntil<=Date.now()){
        // require an additional 5-hit streak to activate Super Fever, or trigger if already in streak>=5
        if(streak>=5){
          superFeverUntil = Date.now() + superFeverSec*1000; // 6s super
          multiplier = Math.max(multiplier, 3.0);
          if(audioEnabled){ try{ sfx.super.currentTime=0; sfx.super.play(); }catch(e){} }
          speakCoach('SUPER FEVER!');
          // brief flash sky
          try{ document.getElementById('sky').setAttribute('color','#ffd54f'); setTimeout(()=>{ document.getElementById('sky').setAttribute('color', null); }, 600); }catch(e){}
          try{ fxFlash.classList.add('show'); setTimeout(()=> fxFlash.classList.remove('show'), 300); }catch(e){}
        }else{
          if(audioEnabled){ sfx.fever.currentTime=0; sfx.fever.play(); }
          speakCoach('Fever mode! Keep building!');
        }
      }
    }else{
      // use shield if available to ignore one miss
      if(shieldCharges>0){ shieldCharges--; speakCoach('Shield saved you!'); if(audioEnabled){ sfx.powerup.currentTime=0; sfx.powerup.play(); } obs.remove(); updateHUD(); return; }
      missCount++; superFeverUntil=0;
      streak=0;
      multiplier = calcMultiplier(); if(superFeverUntil>Date.now()) multiplier = Math.max(multiplier, 3.0);
      fever = Math.max(0, fever-15);
      if(audioEnabled){ sfx.miss.currentTime=0; sfx.miss.play(); }
      speakCoach(type==="bomb" ? "Boom! Wait next time!" : "Miss! Focus on the next one!");
    }
    returnToPool(obs);
    updateHUD();
  }



  function addPowerUpToInventory(puEntity){
    if(!puEntity) return;
    const cls = puEntity.getAttribute('class') || '';
    if(cls.includes('pu-shield')){
      shieldCharges += 1;
      speakCoach("Shield collected.");
    }else if(cls.includes('pu-slow')){
      // store as immediate-usable via button (we'll just allow multiple presses; we don't track charges for slow separately)
      // trigger a small indicator by briefly bumping the T timer +1 (visual hint)
      slowUntil = Math.max(slowUntil, Date.now()); // no-op reserve
      speakCoach("Slow collected.");
    }else if(cls.includes('pu-heal')){
      // store as inventory via heal by instant add on use; since we don't track count, we'll apply immediate +20 on use
      speakCoach("Heal collected.");
    }
    try{ puEntity.remove(); }catch(e){}
    updateHUD();
  }

  function applyPowerUp(puEntity){
    if(!puEntity) return;
    const cls = puEntity.getAttribute('class') || '';
    if(cls.includes('pu-shield')){
      shieldCharges += 1;
      speakCoach("Shield ready!");
    }else if(cls.includes('pu-slow')){
      slowUntil = Date.now() + Math.floor(slowDurationSec*1000); // 3.5s slow-time
      speakCoach("Slow time!");
    }else if(cls.includes('pu-heal')){
      fever = Math.min(100, fever + 20);
      speakCoach("Energy boost!");
      // if healing pushes fever to 100, consider Super Fever trigger on next success
    }
    if(sfx.powerup && sfx.powerup.play){ try{ sfx.powerup.currentTime=0; sfx.powerup.play(); }catch(e){} }
    puEntity.remove();
    updateHUD();
  }

  // Adaptive coach situational cues every few seconds
  setInterval(()=>{
    if(state!=="playing" || !coachEnabled) return;
    if(timeLeft<=10){ speakCoach("Final 10 seconds, give it all!"); return; }
    if(missCount>=3 && hitCount<5){ speakCoach("Reset your rhythm. One by one!"); }
  }, 5000);

  // Dynamic environment tick: day-night cycle intensity
  function dynamicEnvironmentTick(){
    if(!envLight || !dirLight) return;
    const total =  Math.max(1, (diff==="hard"?80:(diff==="normal"?85:90)));
    const t = (total-timeLeft)/total; // 0..1
    // simple sinusoid for ambient
    const amb = 0.8 + 0.2*Math.sin(t*2*Math.PI);
    envLight.setAttribute('light', `type: ambient; intensity: ${amb.toFixed(2)}; color: #ffffff`);
    // directional simulating sun angle
    const dirInt = (theme==="space")? 0.4 : 0.6 + 0.2*Math.cos(t*2*Math.PI);
    dirLight.setAttribute('light', `type: directional; intensity: ${dirInt.toFixed(2)}; color: #ffffff`);
  }

  // Speech
  function speakCoach(text){
    if(!coachEnabled) return;
    coachText.setAttribute("text","value", text);
    try{
      if('speechSynthesis' in window){
        const u = new SpeechSynthesisUtterance(text);
        u.rate = 1.05; u.pitch = 1.0; u.lang = 'en-US';
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
      }else{
        if(audioEnabled){ sfx.coachGood.currentTime=0; sfx.coachGood.play(); }
      }
    }catch(e){ /* ignore */}
  }

  // Initialize defaults
  setDiff("normal");
  setMode("classic");
  setTheme("forest");
  show(menu);
  document.body.classList.add('menu-open');
  coachText.setAttribute("text","value","Pick difficulty, mode & theme, then Start!");

})();