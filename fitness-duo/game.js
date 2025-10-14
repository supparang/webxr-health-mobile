/* Fitness Adventure VR - minimal playable loop with theme selection, scoring, and results */
window.APP = (function(){

function setSceneInteractive(on){
  const scene = document.querySelector('a-scene');
  if (!scene) return;
  scene.style.pointerEvents = on ? 'auto' : 'none';
}


// ---- Debug utilities ----
const debugEl = document.getElementById('debugPanel');
function debug(msg){
  try{
    if (!debugEl) return;
    const t = new Date().toLocaleTimeString();
    debugEl.style.display = 'block';
    debugEl.textContent += `[${t}] ${msg}\n`;
  }catch(e){}
}
window.addEventListener('error', (e)=>{
  debug('ERROR: ' + (e.message || e));
});

// Multi-input helper to bind click/touch/pointer
function bindMulti(el, handler){
  if (!el) return;
  const safe = (ev)=>{ try{ ev.preventDefault(); ev.stopPropagation(); }catch(_e){} handler(ev); };
  el.addEventListener('click', safe, {passive:false});
  el.addEventListener('touchstart', safe, {passive:false});
  el.addEventListener('pointerdown', safe, {passive:false});
}

  const st = {
    theme: localStorage.getItem('fd_theme') || 'jungle',
    mode: 'practice',
    timeLeft: 60,
    score: 0,
    combo: 1,
    playing: false,
    spawnTimer: 0,
    spawnEveryMs: 1200,
    missCount: 0,
    hitCount: 0,
    totalจำนวนเป้า: 0
  };

  // ---- UI helpers ----
  const $ = (id)=>document.getElementById(id);
  const menuPanel = $('menuPanel');
  const resultPanel = $('resultPanel');
  const hud = $('hud');
  const toast = $('toast');

  function showToast(msg, ms=1400){
    toast.textContent = msg; toast.style.display='block';
    setTimeout(()=>toast.style.display='none', ms);
  }

  // ---- Theme ----
  function selectTheme(name){
    st.theme = name;
    localStorage.setItem('fd_theme', name);
    document.querySelectorAll('.theme-chip').forEach(c=>{
      c.classList.toggle('active', c.dataset.theme===name);
    });
    setThemeSky(name);
    showToast(`ธีม: ${name}`);
  }

  function setThemeSky(name){
    const sky = document.querySelector('#sky');
    const id = {jungle:'#bg-jungle', city:'#bg-city', space:'#bg-space'}[name] || '#bg-jungle';
    sky.setAttribute('src', id);
    sky.setAttribute('rotation', {x:0,y:0,z:0});
    // Ensure visible even if asset late-loads
    sky.addEventListener('materialtextureloaded', ()=>{
      sky.setAttribute('color', '#FFFFFF');
    }, {once:true});
  }

  // ---- Game Flow ----
  function startGame({mode='practice'}={}){
    try{
      st.mode = mode;
      st.timeLeft = mode==='timed' ? 60 : 999;
      st.score = 0;
      st.combo = 1;
      st.missCount = 0;
      st.hitCount = 0;
      st.totalSpawned = 0;
      st.playing = true;
      st.spawnTimer = performance.now();

      // UI
      if (hud) hud.style.display = 'block';
      if (menuPanel) menuPanel.style.display = 'none';
      if (resultPanel) resultPanel.style.display = 'none';
      const modeText = mode==='timed' ? 'จับเวลา' : 'โหมดฝึก';
      if ($('hudMode')) $('hudMode').textContent = modeText;
      if ($('hudTime')) $('hudTime').textContent = mode==='timed' ? 'เวลา: 60' : 'เวลา: ∞';
      if ($('hudScore')) $('hudScore').textContent = 'คะแนน: 0';
      if ($('hudCombo')) $('hudCombo').textContent = 'คอมโบ: x1';

      setThemeSky(st.theme);
      clearTargets();
      tickLoop();
      debug('startGame OK: mode=' + modeText);
    }catch(err){
      debug('startGame ERROR: ' + err);
    }
  }

  function pause(){
    st.playing = false;
    showToast('หยุดชั่วคราว');
    backToMenu();
  }

  function backToMenu(){
    const ss = document.getElementById('safeStart'); if (ss) ss.style.display='none';
    st.playing = false;
    hud.style.display = 'none';
    resultPanel.style.display = 'none';
    menuPanel.style.display = 'block';
    setSceneInteractive(false);
    // highlight selected theme
    document.querySelectorAll('.theme-chip').forEach(c=>{
      c.classList.toggle('active', c.dataset.theme===st.theme);
    });
  }

  function restart(){
    startGame({mode: st.mode});
  }

  function endGame(){
    st.playing = false;
    hud.style.display = 'none';
    resultPanel.style.display = 'block';
    $('scoreLine').textContent = `คะแนน: ${st.score}`;
    const stars = calcStars(st.score, st.missCount);
    $('starLine').textContent = '★'.repeat(stars) + ' ' + '☆'.repeat(3-stars);
    $('summaryLine').textContent = `ถูกเป้า: ${st.hitCount} | พลาด: ${st.missCount} | จำนวนเป้า: ${st.totalSpawned}`;
  }

  function calcStars(score, miss){
    if (score >= 1000 && miss <= 3) return 3;
    if (score >= 600) return 2;
    if (score >= 300) return 1;
    return 0;
  }

  // ---- Spawning Targets ----
  function clearTargets(){
    const spawner = document.querySelector('#spawner');
    while (spawner.firstChild) spawner.removeChild(spawner.firstChild);
  }

  function spawnTarget(){
    const spawner = document.querySelector('#spawner');
    const t = document.createElement('a-entity');
    t.setAttribute('geometry', 'primitive: sphere; radius: 0.2');
    t.setAttribute('material', 'color: #39c5bb; emissive: #0a2; metalness:0.1; roughness:0.4');
    const rx = (Math.random()*2-1)*1.2;
    const ry = 1 + Math.random()*1.2;
    const rz = -2.2 - Math.random()*0.6;
    t.setAttribute('position', {x:rx, y:ry, z:rz});
    t.classList.add('clickable');

    // outline/glow via animation
    t.setAttribute('animation__pulse', 'property: scale; to: 1.15 1.15 1.15; dir: alternate; loop: true; dur: 650');

    // click handler
    t.addEventListener('click', ()=>{
      if (!st.playing) return;
      st.hitCount++;
      addScore(100);
      // pop effect
      t.setAttribute('animation__pop', 'property: scale; to: 0 0 0; dur: 180; easing: easeInQuad');
      setTimeout(()=> t.remove(), 180);
      showToast('เยี่ยม! +100');
    });

    // auto-miss after some time
    setTimeout(()=>{
      if (!t.parentNode) return; // already hit
      st.missCount++;
      st.combo = 1;
      $('hudCombo').textContent = `คอมโบ: x${st.combo}`;
      t.setAttribute('material', 'color: #aa4444');
      t.setAttribute('animation__fade', 'property: components.material.material.opacity; to: 0; dur: 300');
      setTimeout(()=> t.remove(), 320);
    }, 1600 + Math.random()*400);

    spawner.appendChild(t);
    st.totalSpawned++;
  }

  function showFloatingText(pos, text){ /* disabled for Thai UI: use toast instead */ }

  function addScore(base){
    st.combo = Math.min(st.combo+1, 5);
    const bonus = (st.combo-1)*10;
    st.score += base + bonus;
    $('hudScore').textContent = `คะแนน: ${st.score}`;
    $('hudCombo').textContent = `คอมโบ: x${st.combo}`;
  }

  // ---- Weekly Mission (stub) ----
  function openWeeklyMission(){
    const weekId = getWeekId();
    const key = 'fd_week_'+weekId;
    const done = localStorage.getItem(key)==='1';
    const goal = 1200;
    const msg = done ?
      `สัปดาห์ ${weekId}: ทำสำเร็จ ✔️` :
      `สัปดาห์ ${weekId}: ทำคะแนน ${goal}+ ในโหมดจับเวลาเพื่อผ่านภารกิจ`;
    showToast(msg, 2400);
  }
  function getWeekId(){
    const d = new Date();
    const onejan = new Date(d.getFullYear(),0,1);
    return Math.ceil((((d - onejan) / 86400000) + onejan.getDay()+1)/7);
  }
  function checkWeeklyComplete(){
    if (st.mode!=='timed') return;
    const weekId = getWeekId();
    if (st.score >= 1200 && st.missCount <= 5){
      localStorage.setItem('fd_week_'+weekId, '1');
    }
  }

  // ---- Main loop ----
  function tickLoop(){
    let last = performance.now();
    function tick(){
      try{
        if (!st.playing) return;
        const now = performance.now();
        const dt = (now - last)/1000; last = now;

        if (now - st.spawnTimer > st.spawnEveryMs){
          st.spawnTimer = now;
          spawnTarget();
        }

        if (st.mode==='timed'){
          st.timeLeft = Math.max(0, st.timeLeft - dt);
          const left = Math.ceil(st.timeLeft);
          if ($('hudTime')) $('hudTime').textContent = `เวลา: ${left}`;
          if (st.timeLeft <= 0){
            checkWeeklyComplete();
            endGame();
            debug('Timer ended');
            return;
          }
        }else{
          if ($('hudTime')) $('hudTime').textContent = 'เวลา: ∞';
        }
        requestAnimationFrame(tick);
      }catch(err){
        debug('tick ERROR: ' + err);
      }
    }
    requestAnimationFrame(tick);
  }

  // Init on DOM ready
  window.addEventListener('DOMContentLoaded', ()=>{
    // Force menu visible on load
    menuPanel.style.display = 'block';
    hud.style.display = 'none';
    resultPanel.style.display = 'none';
    setSceneInteractive(false);
    selectTheme(st.theme);
    // activate initial highlight
    document.querySelectorAll('.theme-chip').forEach(c=>{
      c.classList.toggle('active', c.dataset.theme===st.theme);
    });


// Safe Start overlay bindings
bindMulti(document.getElementById('safeStartBtn'), ()=>{
  const ss = document.getElementById('safeStart'); if (ss) ss.style.display='none';
  startGame({mode:'practice'});
});
bindMulti(document.getElementById('safeStartTimedBtn'), ()=>{
  const ss = document.getElementById('safeStart'); if (ss) ss.style.display='none';
  startGame({mode:'timed'});
});
bindMulti(document.getElementById('toggleDebugBtn'), ()=>{
  const dp = document.getElementById('debugPanel');
  if (dp) dp.style.display = (dp.style.display==='none' || !dp.style.display) ? 'block' : 'none';
});

// Bind main menu buttons with multi-input as well
bindMulti(document.getElementById('startTimedBtn'), ()=> startGame({mode:'timed'}));
bindMulti(document.getElementById('practiceBtn'), ()=> startGame({mode:'practice'}));

function bindAllInputs(el, handler){
  if (!el) return;
  const safe = (ev)=>{ try{ ev.preventDefault(); ev.stopPropagation(); }catch(_e){} handler(ev); };
  ['click','touchstart','pointerdown','mousedown','mouseup'].forEach(t=>{
    el.addEventListener(t, safe, {passive:false});
  });
}
bindAllInputs(document.getElementById('safeStartBtn'), ()=>{
  const ss = document.getElementById('safeStart'); if (ss) ss.style.display='none';
  hardStart('practice', 2);
});
bindAllInputs(document.getElementById('safeStartTimedBtn'), ()=>{
  const ss = document.getElementById('safeStart'); if (ss) ss.style.display='none';
  hardStart('timed', 2);
});
bindAllInputs(document.getElementById('forceStartBtn'), ()=>{
  const ss = document.getElementById('safeStart'); if (ss) ss.style.display='none';
  hardStart('timed', 3);
});
// Also upgrade the main menu buttons
bindAllInputs(document.getElementById('startTimedBtn'), ()=> hardStart('timed',2));
bindAllInputs(document.getElementById('practiceBtn'), ()=> hardStart('practice',2));
bindAllInputs(document.getElementById('weeklyBtn'), ()=> openWeeklyMission());

function bindAllInputs(el, handler){
  if (!el) return;
  const safe = (ev)=>{ try{ ev.preventDefault(); ev.stopPropagation(); }catch(_e){} handler(ev); };
  ['click','touchstart','pointerdown','mousedown','mouseup'].forEach(t=>{
    el.addEventListener(t, safe, {passive:false});
  });
}
bindAllInputs(document.getElementById('safeStartBtn'), ()=>{
  const ss = document.getElementById('safeStart'); if (ss) ss.style.display='none';
  hardStart('practice', 2);
});
bindAllInputs(document.getElementById('safeStartTimedBtn'), ()=>{
  const ss = document.getElementById('safeStart'); if (ss) ss.style.display='none';
  hardStart('timed', 2);
});
bindAllInputs(document.getElementById('forceStartBtn'), ()=>{
  const ss = document.getElementById('safeStart'); if (ss) ss.style.display='none';
  hardStart('timed', 3);
});
// Also upgrade the main menu buttons
bindAllInputs(document.getElementById('startTimedBtn'), ()=> hardStart('timed',2));
bindAllInputs(document.getElementById('practiceBtn'), ()=> hardStart('practice',2));
bindAllInputs(document.getElementById('weeklyBtn'), ()=> openWeeklyMission());

window.startTimed = ()=> APP.startGame({mode:'timed'});
window.startPractice = ()=> APP.startGame({mode:'practice'});
