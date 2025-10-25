(function(){
  "use strict";

  const menu = document.getElementById('menu');
  const hud = document.getElementById('hud');
  const result = document.getElementById('result');

  const scoreEl = document.getElementById('score');
  const timerEl = document.getElementById('timer');
  const feverBar = document.getElementById('feverBar');

  const rScore = document.getElementById('rScore');
  const rStreak = document.getElementById('rStreak');
  const rAcc = document.getElementById('rAcc');
  const starsEl = document.getElementById('stars');

  const coachText = document.getElementById('coach');
  const scene = document.querySelector('a-scene');
  const obstaclesRoot = document.getElementById('obstacles');
  const sky = document.getElementById('sky');
  const ground = document.getElementById('ground');

  const btnStart = document.getElementById('start');
  const btnRetry = document.getElementById('retry');
  const btnHome = document.getElementById('home');
  const toggleBgmBtn = document.getElementById('toggleBgm');
  const toggleCoachBtn = document.getElementById('toggleCoach');

  // Audio
  const sfx = {
    bgm: document.getElementById('sfx-bgm'),
    hit: document.getElementById('sfx-hit'),
    miss: document.getElementById('sfx-miss'),
    fever: document.getElementById('sfx-fever'),
    coachReady: document.getElementById('coach-ready'),
    coachGood: document.getElementById('coach-good'),
    coachMiss: document.getElementById('coach-miss')
  };
  sfx.bgm.loop = true;

  let audioEnabled = true;
  let coachEnabled = true;

  // State
  let state = "idle"; // idle | playing | ended
  let diff = "normal";
  let theme = "forest";

  let score = 0, timeLeft = 90, fever = 0;
  let streak = 0, bestStreak = 0;
  let hitCount = 0, missCount = 0;
  let spawnTimer = 0, spawnInterval = 1800;
  let gameTimerId = null, spawnerId = null;

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
  }

  // UI interactions
  menu.addEventListener('click', (e)=>{
    const t = e.target;
    if(t.dataset.diff){ setDiff(t.dataset.diff); Array.from(t.parentElement.children).forEach(b=>b.classList.remove('primary')); t.classList.add('primary'); }
    if(t.dataset.theme){ setTheme(t.dataset.theme); Array.from(t.parentElement.children).forEach(b=>b.classList.remove('primary')); t.classList.add('primary'); }
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
  btnStart.addEventListener('touchend', (e)=>{ e.preventDefault(); startGame(); });
  btnRetry.addEventListener('click', ()=>{ hide(result); show(menu); });
  btnRetry.addEventListener('touchend', (e)=>{ e.preventDefault(); hide(result); show(menu); });
  btnHome?.addEventListener('click', ()=>{ hide(result); show(menu); });
  btnHome?.addEventListener('touchend', (e)=>{ e.preventDefault(); hide(result); show(menu); });

  function show(el){ el.classList.add('show'); if(el.id==='menu' || el.id==='result'){ document.body.classList.add('menu-open'); } }
  function hide(el){ el.classList.remove('show'); if(el.id==='menu' || el.id==='result'){ document.body.classList.remove('menu-open'); } }

  function updateHUD(){
    scoreEl.textContent = String(score);
    timerEl.textContent = String(timeLeft);
    feverBar.style.width = `${fever}%`;
  }

  function startGame(){
    if(state!=="idle") return;
    state="playing";
    hide(menu);
    show(hud);
    score=0; fever=0; streak=0; bestStreak=0; hitCount=0; missCount=0;
    obstaclesRoot.innerHTML = "";
    updateHUD();
    speakCoach("Ready! Let's go!");
    sfx.coachReady.currentTime = 0; if(audioEnabled) sfx.coachReady.play();
    if(audioEnabled){ try { sfx.bgm.currentTime=0; sfx.bgm.play(); } catch(e){} }

    // countdown
    if(gameTimerId) clearInterval(gameTimerId);
    gameTimerId = setInterval(()=>{
      if(state!=="playing") { clearInterval(gameTimerId); return; }
      timeLeft--;
      if(timeLeft<=0){ endGame(); }
      updateHUD();
    }, 1000);

    // spawner
    if(spawnerId) clearInterval(spawnerId);
    spawnerId = setInterval(spawnObstacle, spawnInterval);
  }

  function endGame(){
    state="ended";
    clearInterval(gameTimerId); clearInterval(spawnerId);
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
    let star = 1;
    if(score>200) star=2;
    if(score>400) star=3;
    if(score>650) star=4;
    if(score>900) star=5;
    starsEl.textContent = "★".repeat(star) + "☆".repeat(5-star);
    show(result);
    speakCoach(`Finished! Score ${score}. Accuracy ${acc} percent. Great job!`);
  }

  // Spawn / mechanics
  let jumping=false, ducking=false;
  window.addEventListener('keydown', (e)=>{
    if(state!=="playing") return;
    if(e.key==="ArrowUp"||e.key==="w"||e.key===" "){ doJump(); }
    if(e.key==="ArrowDown"||e.key==="s"||e.key==="Control"){ doDuck(); }
  });

  function doJump(){
    jumping = true;
    setTimeout(()=> jumping=false, 650);
    coachText.setAttribute("text","value","Jump!");
  }
  function doDuck(){
    ducking = true;
    setTimeout(()=> ducking=false, 650);
    coachText.setAttribute("text","value","Duck!");
  }

  function spawnObstacle(){
    if(state!=="playing") return;
    // pick type
    const type = Math.random()>0.5 ? "jump" : "duck";
    const obs = document.createElement('a-box');
    obs.setAttribute('depth', 0.6);
    obs.setAttribute('width', 1.6);
    obs.setAttribute('height', type==="jump" ? 0.45 : 1.2);
    obs.setAttribute('material', `src: ${type==="jump" ? "#tx-jump" : "#tx-duck"}`);
    const y = (type==="jump") ? 0.35 : 1.1;
    obs.setAttribute('position', `0 ${y} -18`);
    obstaclesRoot.appendChild(obs);

    const dur = (diff==="easy")? 2500 : (diff==="normal")? 2000 : 1500;
    obs.setAttribute('animation', {
      property: 'position',
      to: `0 ${y} 0.3`,
      dur: dur,
      easing: 'linear',
      loop: false
    });

    setTimeout(()=> checkCollision(obs, type), dur-200);
  }

  function checkCollision(obs, type){
    if(state!=="playing") return;
    const success = (type==="jump" && jumping) || (type==="duck" && ducking);
    if(success){
      hitCount++;
      streak++;
      if(streak>bestStreak) bestStreak=streak;
      score += 10 + Math.floor(streak/5)*5;
      fever = Math.min(100, fever+8);
      if(audioEnabled){ sfx.hit.currentTime=0; sfx.hit.play(); }
      if(streak%10===0){ speakCoach("Awesome streak! Keep it up!"); }
      if(fever===100){ if(audioEnabled){ sfx.fever.currentTime=0; sfx.fever.play(); } speakCoach("Fever mode! Go go go!"); }
    }else{
      missCount++;
      streak=0;
      fever = Math.max(0, fever-15);
      if(audioEnabled){ sfx.miss.currentTime=0; sfx.miss.play(); }
      speakCoach("Miss!");
    }
    obs.remove();
    updateHUD();
  }

  // Adaptive coach via Web Speech API
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
        // fallback: small cue
        if(audioEnabled){ sfx.coachGood.currentTime=0; sfx.coachGood.play(); }
      }
    }catch(e){ /* ignore */}
  }

  // Initialize defaults
  setDiff("normal");
  setTheme("forest");
  show(menu);
  coachText.setAttribute("text","value","Pick difficulty & theme, then Start!");

})();