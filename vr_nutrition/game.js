(()=>{
  const $=s=>document.querySelector(s), $$=s=>document.querySelectorAll(s);
  const dbg=(m)=>{ $("#dbg").textContent='STATE: '+m; };

  const state={
    lang: localStorage.getItem('ng_lang') || 'th',
    difficulty: localStorage.getItem('ng_diff') || 'Normal',
    mode: localStorage.getItem('ng_mode') || 'goodjunk',
    score:0, timeLeft:60, running:false, paused:false, combo:1, comboMax:1, best: parseInt(localStorage.getItem('ng_best')||'0'),
    fever:false
  };
  const I18N={ th:{start:"เริ่มเกม",pause:"พัก",restart:"เริ่มใหม่",score:"คะแนน",time:"เวลา",best:"สถิติ",mode:"โหมด",diff:"ความยาก",combo:"คอมโบ",
                    modeGJ:"ดี vs ขยะ",modeGroups:"จาน 5 หมู่",modeHydra:"Hydration",modePlate:"Build Plate",summary:"สรุปผล"},
               en:{start:"Start",pause:"Pause",restart:"Restart",score:"Score",time:"Time",best:"Best",mode:"Mode",diff:"Difficulty",combo:"Combo",
                    modeGJ:"Good vs Junk",modeGroups:"Food Groups",modeHydration:"Hydration",modePlate:"Build Plate",summary:"Summary"} };
  function t(k){ return (I18N[state.lang][k]||k); }
  function applyLang(){
    $("#lblScore").textContent=t("score"); $("#lblTime").textContent=t("time"); $("#lblBest").textContent=t("best");
    $("#lblMode").textContent=t("mode"); $("#lblDiff").textContent=t("diff"); $("#lblCombo").textContent=t("combo");
    $("#sumTitle").textContent=t("summary");
    $$("[data-i18n=modeGJ]").forEach(e=>e.textContent=t("modeGJ"));
    $$("[data-i18n=modeGroups]").forEach(e=>e.textContent=t("modeGroups"));
    $$("[data-i18n=modeHydra]").forEach(e=>e.textContent=t("modeHydration"));
    $$("[data-i18n=modePlate]").forEach(e=>e.textContent=t("modePlate"));
    $$("[data-i18n=start]").forEach(e=>e.textContent=t("start"));
    $$("[data-i18n=pause]").forEach(e=>e.textContent=t("pause"));
    $$("[data-i18n=restart]").forEach(e=>e.textContent=t("restart"));
    $("#modeName").textContent=
      state.mode==="goodjunk"?t("modeGJ"):state.mode==="groups"?t("modeGroups"):state.mode==="hydration"?t("modeHydration"):t("modePlate");
  }
  function updateHUD(){
    $("#score").textContent=state.score; $("#time").textContent=state.timeLeft; $("#best").textContent=state.best;
    $("#difficulty").textContent=state.difficulty; $("#combo").textContent='x'+state.combo;
  }

  // THREE basic scene + WebXR
  const canvas=$("#c");
  const renderer = new THREE.WebGLRenderer({canvas, antialias:false, alpha:false, powerPreference:'high-performance', precision:'mediump'});
  renderer.setClearColor(0x061018, 1);
  renderer.xr.enabled = true;
  const vrBtn = VRButton.createButton(renderer);
  $("#vrBtn").replaceWith(vrBtn); // replace our placeholder with native VR button

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 2, 0.01, 100);
  camera.position.set(0, 1.6, 2.8);
  scene.add(new THREE.AmbientLight(0xffffff, 1.0));

  const group = new THREE.Group(); scene.add(group);

  // Reticle (center on screen UI)
  const ret=$("#ret");
  // Raycaster for mouse & gaze
  const raycaster=new THREE.Raycaster(); const mouse=new THREE.Vector2();
  function castCenter(){
    // center of screen
    raycaster.setFromCamera(new THREE.Vector2(0,0), camera);
    return raycaster.intersectObjects(Array.from(ACTIVE));
  }

  // lanes
  const LANE_X=[-0.9,-0.45,0,0.45,0.9], LANE_Y=[-0.2,-0.05,0.12,0.26], LANE_Z=-2.0;
  const occupied=new Set(), cooldown=new Map(); let lastLane=null;
  function now(){ return performance.now(); }
  function isAdj(r,c){ if(!lastLane) return false; const [pr,pc]=lastLane; return Math.abs(pr-r)<=1 && Math.abs(pc-c)<=1; }
  function pickLane(){
    const cand=[];
    for(let r=0;r<LANE_Y.length;r++){ for(let c=0;c<LANE_X.length;c++){
      const k=r+','+c, cd=cooldown.get(k)||0, free=!occupied.has(k)&&now()>cd&&!isAdj(r,c);
      if(free) cand.push({r,c,k});
    }}
    if(!cand.length) return null;
    const p=cand[Math.floor(Math.random()*cand.length)];
    occupied.add(p.k); lastLane=[p.r,p.c];
    return {x:LANE_X[p.c], y:1.6+LANE_Y[p.r], z:LANE_Z-0.1*Math.abs(p.c-2), key:p.k};
  }
  function releaseLane(k){ occupied.delete(k); cooldown.set(k, now()+800); }

  const COLORS=[0x39dfff,0x00ff99,0xffdd00,0xff5577,0x99ff66,0x00ffff,0xff66ff,0xffaa00,0x00ffaa,0xaa00ff];
  const ACTIVE=new Set();
  function makeCube(color){
    const geo=new THREE.BoxGeometry(0.38,0.38,0.18);
    const mat=new THREE.MeshBasicMaterial({color:color}); // unlit
    const m=new THREE.Mesh(geo, mat);
    return m;
  }

  function spawn(){
    const lane=pickLane(); if(!lane) return;
    const col=COLORS[Math.floor(Math.random()*COLORS.length)];
    const cube=makeCube(col); cube.position.set(lane.x, lane.y, lane.z);
    cube.userData={lane:lane.key, meta: pickMeta()};
    group.add(cube); ACTIVE.add(cube); SPAWN_COUNT++;

    // timed remove
    const life = state.difficulty==='Hard'?1900:state.difficulty==='Easy'?4200:3000;
    setTimeout(()=>{
      if(!cube.parent) return;
      const m=cube.userData.meta;
      if(!m.special){
        if(state.mode==='goodjunk'){ if(m.good===false){ state.score+=1; updateHUD(); } else { comboBreak(); } }
        else if(state.mode==='groups'){ if(m.group===currentTarget){ comboBreak(); } }
        else if(state.mode==='hydration'){ if(m.hydra!=='water'){ state.score+=1; updateHUD(); } }
      }
      destroy(cube);
    }, life + Math.floor(Math.random()*500-250));
  }

  function destroy(cube){
    if(cube.parent) cube.parent.remove(cube);
    ACTIVE.delete(cube);
    releaseLane(cube.userData.lane);
  }

  // Meta & modes
  const foods = {
    goodjunk: [{good:true},{good:true},{good:true},{good:false},{good:false},{good:false}],
    groups: ['grains','protein','veggies','fruits','dairy'],
    hydration: ['water','soda','sugar']
  };
  function pickMeta(){
    if(Math.random()<0.10){ const sp=['time','fever','shield','slow','bomb']; return {special: sp[Math.floor(Math.random()*sp.length)]}; }
    if(state.mode==='goodjunk'){
      const goodBias=state.difficulty==='Easy'?0.70:state.difficulty==='Hard'?0.45:0.58;
      const isGood = Math.random()<goodBias;
      return {good:isGood};
    }
    if(state.mode==='groups'){
      const g=foods.groups[Math.floor(Math.random()*foods.groups.length)];
      return {group:g};
    }
    if(state.mode==='hydration'){
      const rate=state.difficulty==='Easy'?0.75:state.difficulty==='Hard'?0.55:0.65;
      const isWater = Math.random()<rate;
      return {hydra: isWater?'water':(Math.random()<0.5?'soda':'sugar')};
    }
    const g=foods.groups[Math.floor(Math.random()*foods.groups.length)];
    return {group:g, plate:true};
  }

  let currentTarget='grains', plateQuota=null, targetHits=0;
  function nextTarget(){
    const arr=foods.groups.slice(); const idx=arr.indexOf(currentTarget); if(idx>=0) arr.splice(idx,1);
    currentTarget = arr[Math.floor(Math.random()*arr.length)];
  }
  function resetPlateQuota(){ const base={grains:2,veggies:2,protein:1,fruits:1,dairy:1}; if(state.difficulty==='Hard') base.veggies=3; plateQuota=base; }
  function comboBreak(){ state.combo=1; setFever(false); updateHUD(); }

  // FEVER
  const FEVER_MULT=2.0, FEVER_BONUS=1; let feverTimer=null;
  function setFever(on){ state.fever=on; document.body.classList.toggle('fever', on); }
  function enterFever(ms=6000){ if(feverTimer) clearTimeout(feverTimer); setFever(true); feverTimer=setTimeout(()=>setFever(false), ms); }
  function extendFever(extra=1200){ if(!state.fever||!feverTimer) return; clearTimeout(feverTimer); feverTimer=setTimeout(()=>setFever(false), extra); }

  // Input — mouse/touch
  function onClick(ev){
    if(!state.running||state.paused) return;
    const rect=canvas.getBoundingClientRect();
    const x=(ev.clientX-rect.left)/rect.width*2-1;
    const y=-(ev.clientY-rect.top)/rect.height*2+1;
    const m=new THREE.Vector2(x,y);
    raycaster.setFromCamera(m, camera);
    const inter=raycaster.intersectObjects(Array.from(ACTIVE));
    if(inter.length>0){ handleHit(inter[0].object); destroy(inter[0].object); }
  }
  canvas.addEventListener('click', onClick);
  canvas.addEventListener('touchstart', (e)=>{ if(e.touches&&e.touches[0]) onClick({clientX:e.touches[0].clientX, clientY:e.touches[0].clientY, preventDefault:()=>{}}); }, {passive:true});

  // Gaze dwell
  let gazeTarget=null, gazeStart=0; const DWELL=700;
  function handleGaze(dt){
    if(!state.running||state.paused) return;
    const inter=castCenter();
    if(inter.length>0){
      const o=inter[0].object;
      if(gazeTarget!==o){ gazeTarget=o; gazeStart=performance.now(); $("#ret").classList.add('progress'); }
      else {
        if(performance.now()-gazeStart >= DWELL){
          handleHit(o); destroy(o); gazeTarget=null; $("#ret").classList.remove('progress');
        }
      }
    } else { gazeTarget=null; $("#ret").classList.remove('progress'); }
  }

  function handleHit(obj){
    const m=obj.userData.meta;
    if(m.special){
      if(m.special==='time'){ state.timeLeft=Math.min(99, state.timeLeft+5); }
      if(m.special==='fever'){ enterFever(); }
      if(m.special==='slow'){ const old=state.difficulty; state.difficulty='Easy'; setTimeout(()=>state.difficulty=old,2000); }
      if(m.special==='bomb'){ comboBreak(); state.score=Math.max(0, state.score-5); }
      updateHUD(); return;
    }
    let good=false, base=0;
    if(state.mode==='goodjunk'){ good=m.good===true; base=good?5:-3; if(!good) comboBreak(); }
    else if(state.mode==='groups'){ good=m.group===currentTarget; base=good?6:-2; if(good){ targetHits++; if(targetHits>=3){ nextTarget(); targetHits=0; } } else comboBreak(); }
    else if(state.mode==='hydration'){ good=m.hydra==='water'; base=good?4:-4; if(good && state.combo%3===0){ state.timeLeft=Math.min(99, state.timeLeft+2);} else if(!good) comboBreak(); }
    else if(state.mode==='plate'){
      if(m.group){
        if(!plateQuota) resetPlateQuota();
        if(plateQuota[m.group]>0){ good=true; plateQuota[m.group]-=1; if(Object.values(plateQuota).every(v=>v<=0)){ base+=12; resetPlateQuota(); } }
        else { base+=1; }
      }
    }
    let delta = good ? base*state.combo : base;
    if(state.fever && delta>0){ delta = Math.round(delta*FEVER_MULT) + FEVER_BONUS; }
    state.score=Math.max(0, state.score+delta);
    if(good){ state.combo=Math.min(5,state.combo+1); state.comboMax=Math.max(state.comboMax,state.combo); if(state.combo>=4 && !state.fever) enterFever(); }
    updateHUD();
  }

  // Loop
  let SPAWN_COUNT=0, spH=null, tmH=null, watchdogH=null;
  function loop(){ if(!state.running||state.paused) return; spawn(); spH=setTimeout(loop, 740); }
  function timer(){ if(!state.running||state.paused) return; tmH=setTimeout(()=>{ state.timeLeft--; updateHUD(); if(state.timeLeft<=0){ endGame(); } else timer(); }, 1000); }

  function start(){
    state.score=0; state.combo=1; state.comboMax=1; state.timeLeft=60; updateHUD();
    if(state.mode==='groups'){ nextTarget(); }
    if(state.mode==='plate'){ resetPlateQuota(); }
    state.running=true; state.paused=false;
    setTimeout(spawn, 200); loop(); timer();
    // watchdog
    clearTimeout(watchdogH); let seenT=state.timeLeft, seenS=SPAWN_COUNT;
    (function kick(){ const stuck=(seenT===state.timeLeft)||(seenS===SPAWN_COUNT); if(stuck){ clearTimeout(spH); clearTimeout(tmH); setTimeout(()=>{ spawn(); loop(); timer(); },150); dbg('watchdog kick'); } seenT=state.timeLeft; seenS=SPAWN_COUNT; watchdogH=setTimeout(kick,1200); })();
  }
  function pause(){ if(!state.running) return; state.paused=!state.paused; if(state.paused){ clearTimeout(spH); clearTimeout(tmH);} else { loop(); timer(); } }
  function endGame(){
    state.running=false; state.paused=false; clearTimeout(spH); clearTimeout(tmH);
    if(state.score>state.best){ state.best=state.score; localStorage.setItem('ng_best', String(state.best)); }
    const star=state.score>=200?3:state.score>=140?2:1;
    $("#sumStars").textContent="★".repeat(star)+"☆".repeat(3-star);
    $("#sumBody").textContent=`Score: ${state.score} • Combo Max: x${state.comboMax} • Mode: ${state.mode} • Diff: ${state.difficulty}`;
    $("#summary").style.display='flex';
  }

  // Resize
  function resize(){
    const w=window.innerWidth, h=window.innerHeight;
    renderer.setSize(w,h, false); camera.aspect=w/h; camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize); resize();

  // Render frame (handle VR gaze in the loop)
  function renderLoop(t){
    if(renderer.xr.isPresenting){
      handleGaze(t);
    }
    renderer.render(scene,camera);
  }
  renderer.setAnimationLoop(renderLoop);

  // Public UI
  window.UI={
    start: ()=>{ $("#summary").style.display='none'; start(); },
    pause: ()=>pause(),
    restart: ()=>{ $("#summary").style.display='none'; state.running=false; state.paused=false; clearTimeout(spH); clearTimeout(tmH); SPAWN_COUNT=0; start(); },
    setMode: (m)=>{ state.mode=m; localStorage.setItem('ng_mode',m); applyLang(); },
    setDiff: (d)=>{ state.difficulty=d; localStorage.setItem('ng_diff',d); updateHUD(); },
    toggleLang: ()=>{ state.lang=(state.lang==='th'?'en':'th'); localStorage.setItem('ng_lang',state.lang); applyLang(); }
  };

  // Init
  applyLang(); updateHUD();
  dbg('ready');
})();