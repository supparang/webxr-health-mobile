/* Fitness Duo - Desktop Stable */
window.APP = (function(){
  const $ = (id)=>document.getElementById(id);
  const st = {
    theme: 'jungle',
    mode: 'practice',
    timeLeft: 999,
    score: 0,
    combo: 1,
    playing: false,
    spawnEveryMs: 1100,
    spawnTimer: 0,
    hit: 0, miss: 0, total: 0
  };

  function toast(msg, ms=1200){
    const t=$('toast'); t.textContent=msg; t.style.display='block';
    setTimeout(()=> t.style.display='none', ms);
  }

  function setThemeSky(name){
    st.theme = name;
    const sky = document.querySelector('#sky');
    const map = {jungle:'#bg-jungle', city:'#bg-city', space:'#bg-space'};
    sky.setAttribute('src', map[name] || '#bg-jungle');
  }

  function lockSceneClicks(on){
    const scene = document.querySelector('a-scene');
    scene.style.pointerEvents = on ? 'none' : 'auto';
  }

  function updateHUD(){
    $('hudMode').textContent = st.mode==='timed' ? 'จับเวลา' : 'โหมดฝึก';
    $('hudTime').textContent = st.mode==='timed' ? `เวลา: ${Math.ceil(st.timeLeft)}` : 'เวลา: ∞';
    $('hudScore').textContent = `คะแนน: ${st.score}`;
    $('hudCombo').textContent = `คอมโบ: x${st.combo}`;
  }

  function start(mode){
    st.mode = mode || 'practice';
    st.timeLeft = st.mode==='timed' ? 60 : 999;
    st.score = 0; st.combo=1; st.hit=0; st.miss=0; st.total=0;
    st.playing = true; st.spawnTimer = performance.now();
    document.getElementById('menu').classList.add('hidden');
    lockSceneClicks(false);
    updateHUD();
    clearTargets();
    loop();
  }

  function pauseToMenu(){
    st.playing = false;
    document.getElementById('menu').classList.remove('hidden');
    lockSceneClicks(true);
  }

  function clearTargets(){
    const spawner = document.querySelector('#spawner');
    while (spawner.firstChild) spawner.removeChild(spawner.firstChild);
  }

  function spawn(){
    const spawner = document.querySelector('#spawner');
    const e = document.createElement('a-entity');
    e.setAttribute('geometry', 'primitive: sphere; radius: 0.22');
    e.setAttribute('material', 'color:#39c5bb; emissive:#083; metalness:0.1; roughness:0.4');
    const rx=(Math.random()*2-1)*1.2;
    const ry=1 + Math.random()*1.2;
    const rz=-2.2 - Math.random()*0.6;
    e.setAttribute('position', {x:rx,y:ry,z:rz});
    e.classList.add('clickable');
    e.setAttribute('animation__pulse','property: scale; to:1.15 1.15 1.15; dir:alternate; loop:true; dur:650');

    e.addEventListener('click', ()=>{ if(!st.playing)return;
      st.hit++; addScore(100); e.remove(); toast('เยี่ยม! +100', 700);
    });

    setTimeout(()=>{ if(!e.parentNode) return; st.miss++; st.combo=1; e.remove(); }, 1600+Math.random()*300);

    spawner.appendChild(e);
    st.total++;
  }

  function addScore(base){
    st.combo = Math.min(5, st.combo+1);
    st.score += base + (st.combo-1)*10;
    updateHUD();
  }

  function endGame(){
    st.playing=false;
    lockSceneClicks(true);
    const stars = (st.score>=1000 && st.miss<=3)?3:(st.score>=600?2:(st.score>=300?1:0));
    toast(`จบเกม | คะแนน ${st.score} | ดาว ${stars}/3`, 2500);
    document.getElementById('menu').classList.remove('hidden');
  }

  function loop(){
    let last=performance.now();
    const tick=()=>{
      if(!st.playing) return;
      const now=performance.now(), dt=(now-last)/1000; last=now;
      if(now - st.spawnTimer > st.spawnEveryMs){ st.spawnTimer=now; spawn(); }
      if(st.mode==='timed'){
        st.timeLeft = Math.max(0, st.timeLeft - dt);
        $('hudTime').textContent = `เวลา: ${Math.ceil(st.timeLeft)}`;
        if(st.timeLeft<=0){ endGame(); return; }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // --- DOM Bindings ---
  window.addEventListener('DOMContentLoaded', ()=>{
    lockSceneClicks(true);
    setThemeSky('jungle');
    updateHUD();

    // Theme chips
    document.querySelectorAll('.theme').forEach(el=>{
      el.addEventListener('click', ()=>{
        document.querySelectorAll('.theme').forEach(c=>c.classList.remove('active'));
        el.classList.add('active');
        setThemeSky(el.dataset.theme);
      });
    });
    document.querySelector('.theme[data-theme="jungle"]').classList.add('active');

    // Buttons
    document.getElementById('startTimed').addEventListener('click', ()=> start('timed'));
    document.getElementById('startPractice').addEventListener('click', ()=> start('practice'));
    document.getElementById('pauseBtn').addEventListener('click', ()=> pauseToMenu());

    // Keyboard shortcuts
    window.addEventListener('keydown', (e)=>{
      if(e.key==='Enter') start('timed');
      if(e.key==='Escape') pauseToMenu();
      if(e.key.toLowerCase()==='r') start(st.mode);
    });
  });

  return { start, pauseToMenu };
})();