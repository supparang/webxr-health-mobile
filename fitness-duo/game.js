/* Fitness Adventure VR - minimal playable loop with theme selection, scoring, and results */
window.APP = (function(){
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
    totalSpawned: 0
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
    showToast(`Theme: ${name}`);
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
    st.mode = mode;
    st.timeLeft = mode==='timed' ? 60 : 999;
    st.score = 0;
    st.combo = 1;
    st.missCount = 0;
    st.hitCount = 0;
    st.totalSpawned = 0;
    st.playing = true;

    hud.style.display = 'block';
    menuPanel.style.display = 'none';
    resultPanel.style.display = 'none';
    $('hudMode').textContent = mode==='timed' ? 'Timed' : 'Practice';
    $('hudTime').textContent = `Time: ${st.timeLeft}`;
    $('hudScore').textContent = `Score: ${st.score}`;
    $('hudCombo').textContent = `Combo: x${st.combo}`;

    setThemeSky(st.theme);
    clearTargets();
    tickLoop();
  }

  function pause(){
    st.playing = false;
    showToast('Paused');
    backToMenu();
  }

  function backToMenu(){
    st.playing = false;
    hud.style.display = 'none';
    resultPanel.style.display = 'none';
    menuPanel.style.display = 'block';
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
    $('scoreLine').textContent = `Score: ${st.score}`;
    const stars = calcStars(st.score, st.missCount);
    $('starLine').textContent = '★'.repeat(stars) + ' ' + '☆'.repeat(3-stars);
    $('summaryLine').textContent = `Hits: ${st.hitCount} | Misses: ${st.missCount} | Spawned: ${st.totalSpawned}`;
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
      showFloatingText(t.getAttribute('position'), 'Perfect! +100');
    });

    // auto-miss after some time
    setTimeout(()=>{
      if (!t.parentNode) return; // already hit
      st.missCount++;
      st.combo = 1;
      $('hudCombo').textContent = `Combo: x${st.combo}`;
      t.setAttribute('material', 'color: #aa4444');
      t.setAttribute('animation__fade', 'property: components.material.material.opacity; to: 0; dur: 300');
      setTimeout(()=> t.remove(), 320);
    }, 1600 + Math.random()*400);

    spawner.appendChild(t);
    st.totalSpawned++;
  }

  function showFloatingText(pos, text){
    const label = document.createElement('a-entity');
    label.setAttribute('text', `value: ${text}; align: center; width: 2; color: #fff`);
    label.setAttribute('position', {x: pos.x, y: pos.y+0.4, z: pos.z});
    label.setAttribute('animation__rise', 'property: position; to: '+pos.x+' '+(pos.y+1)+' '+pos.z+'; dur: 600');
    label.setAttribute('animation__fade', 'property: components.text.material.opacity; to: 0; dur: 600; delay: 0');
    document.querySelector('a-scene').appendChild(label);
    setTimeout(()=>label.remove(), 650);
  }

  function addScore(base){
    st.combo = Math.min(st.combo+1, 5);
    const bonus = (st.combo-1)*10;
    st.score += base + bonus;
    $('hudScore').textContent = `Score: ${st.score}`;
    $('hudCombo').textContent = `Combo: x${st.combo}`;
  }

  // ---- Weekly Mission (stub) ----
  function openWeeklyMission(){
    const weekId = getWeekId();
    const key = 'fd_week_'+weekId;
    const done = localStorage.getItem(key)==='1';
    const goal = 1200;
    const msg = done ?
      `Week ${weekId}: Completed ✔️` :
      `Week ${weekId}: Score ${goal}+ in Timed mode to complete.`;
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
    const start = performance.now();
    function tick(){
      if (!st.playing) return;
      const now = performance.now();
      if (now - st.spawnTimer > st.spawnEveryMs){
        st.spawnTimer = now;
        spawnTarget();
      }
      // timer
      if (st.mode==='timed'){
        const elapsed = Math.floor((now - start)/1000);
        const left = Math.max(0, 60 - elapsed);
        if (left !== st.timeLeft){
          st.timeLeft = left;
          $('hudTime').textContent = `Time: ${st.timeLeft}`;
          if (st.timeLeft <= 0){
            checkWeeklyComplete();
            endGame();
            return;
          }
        }
      }else{
        $('hudTime').textContent = 'Time: ∞';
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  // Init on DOM ready
  window.addEventListener('DOMContentLoaded', ()=>{
    selectTheme(st.theme);
    // activate initial highlight
    document.querySelectorAll('.theme-chip').forEach(c=>{
      c.classList.toggle('active', c.dataset.theme===st.theme);
    });
  });

  return {
    startGame, pause, backToMenu, restart,
    selectTheme, openWeeklyMission
  };
})();