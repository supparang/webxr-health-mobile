
// Fitness Duo Pro - Game Logic (Thai, Desktop+VR)
(function(){
  const $ = (id)=>document.getElementById(id);
  const q = new URLSearchParams(location.search);
  const st = {
    theme: q.get('theme') || 'jungle',
    mode: (q.get('mode')==='timed') ? 'timed' : 'practice',
    timeLeft: (q.get('mode')==='timed') ? 60 : 999,
    score: 0, combo: 1,
    playing: false,
    spawnEveryMs: 950,
    spawnTimer: 0,
    hit:0, miss:0, total:0
  };

  function toast(msg, ms=900){
    const t=$('toast'); if(!t) return; t.textContent=msg; t.style.display='block';
    setTimeout(()=> t.style.display='none', ms);
  }
  function setThemeSky(name){
    const sky = document.querySelector('#sky');
    const map = {jungle:'#bg-jungle', city:'#bg-city', space:'#bg-space'};
    sky.setAttribute('src', map[name] || '#bg-jungle');
  }
  function updateHUD(){
    const modeText = st.mode==='timed' ? 'จับเวลา' : 'โหมดฝึก';
    $('hudMode').textContent = modeText;
    $('hudTime').textContent = st.mode==='timed' ? `เวลา: ${Math.ceil(st.timeLeft)}` : 'เวลา: ∞';
    $('hudScore').textContent = `คะแนน: ${st.score}`;
    $('hudCombo').textContent = `คอมโบ: x${st.combo}`;
  }
  function addScore(base){
    st.combo = Math.min(5, st.combo+1);
    st.score += base + (st.combo-1)*10;
    updateHUD();
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
    const rx=(Math.random()*2-1)*1.2, ry=1+Math.random()*1.2, rz=-2.2-Math.random()*0.6;
    e.setAttribute('position', {x:rx,y:ry,z:rz});
    e.classList.add('clickable');
    e.setAttribute('animation__pulse','property: scale; to:1.15 1.15 1.15; dir:alternate; loop:true; dur:650');
    e.addEventListener('click', ()=>{ if(!st.playing) return; st.hit++; addScore(100); e.remove(); toast('เยี่ยม! +100', 700); });
    setTimeout(()=>{ if(!e.parentNode) return; st.miss++; st.combo=1; e.remove(); }, 1600+Math.random()*300);
    spawner.appendChild(e);
    st.total++;
  }
  // Manual raycast fallback in case cursor/laser fails
  function manualRay(evt){
    if(!st.playing) return;
    const sceneEl = document.querySelector('a-scene');
    const camEl = document.querySelector('#camera');
    const renderer = sceneEl && sceneEl.renderer;
    const camera = camEl && camEl.getObject3D('camera');
    if(!renderer || !camera) return;
    const rect = renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(((evt.clientX-rect.left)/rect.width)*2-1, -((evt.clientY-rect.top)/rect.height)*2+1);
    const raycaster = new THREE.Raycaster(); raycaster.setFromCamera(mouse, camera);
    const nodes = Array.from(document.querySelectorAll('.clickable')).map(el=>el.object3D).filter(Boolean);
    const hits = raycaster.intersectObjects(nodes, true);
    if(hits.length){
      let obj = hits[0].object;
      while(obj && !obj.el) obj=obj.parent;
      if(obj && obj.el){ obj.el.emit('click'); }
    }
  }
  ['click','mousedown','mouseup'].forEach(t=> window.addEventListener(t, manualRay, {passive:false}));

  function endGame(){
    st.playing=false;
    const stars = (st.score>=1000 && st.miss<=3)?3:(st.score>=600?2:(st.score>=300?1:0));
    toast(`จบเกม | คะแนน ${st.score} | ดาว ${stars}/3`, 2500);
  }

  function loop(){
    let last = performance.now();
    const tick = ()=>{
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

  // Start automatically when the scene is ready
  window.addEventListener('load', ()=>{
    const scene = document.querySelector('a-scene');
    const startNow = ()=>{
      st.playing = true;
      st.spawnTimer = performance.now();
      setThemeSky(st.theme);
      updateHUD();
      clearTargets();
      loop();
    };
    if(scene.hasLoaded){ startNow(); }
    else { scene.addEventListener('loaded', startNow, {once:true}); }
  });
})();
