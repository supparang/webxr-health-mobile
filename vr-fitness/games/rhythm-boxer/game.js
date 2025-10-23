/* games/rhythm-boxer/game.js
   Rhythm Boxer · คลิกได้จริง · เริ่มช้าแล้วค่อยเร็ว · เส้น HIT LINE · Good/Miss/Perfect · Back to Hub ถูกต้อง
*/
(function(){
  "use strict";

  // ---------- Helpers ----------
  const $ = (id)=>document.getElementById(id);
  const ASSET_BASE = (document.querySelector('meta[name="asset-base"]')?.content || '').replace(/\/+$/,'');
  const HUB_URL = "https://supparang.github.io/webxr-health-mobile/vr-fitness/";
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

  // ---------- Audio ----------
  const SFX = {
    good: new Audio(`${ASSET_BASE}/assets/sfx/slash.wav`),
    perfect: new Audio(`${ASSET_BASE}/assets/sfx/perfect.wav`),
    miss: new Audio(`${ASSET_BASE}/assets/sfx/miss.wav`),
    combo: new Audio(`${ASSET_BASE}/assets/sfx/combo.wav`),
    ui: new Audio(`${ASSET_BASE}/assets/sfx/success.wav`)
  };
  Object.values(SFX).forEach(a=>{ a.preload='auto'; a.crossOrigin='anonymous'; });

  let music = new Audio(); music.crossOrigin='anonymous'; music.preload='auto';

  // ---------- Game State ----------
  const RB = window.RB = (window.RB||{});
  RB.running=false; RB.paused=false;

  let score=0, combo=0, maxCombo=0, hits=0, spawns=0, timeLeft=60;
  let timer=null, spawnTimer=null;
  let speedPreset='standard';
  let spawnInt=1200; // จะปรับตาม preset และจะลดลงเรื่อย ๆ
  let fallSpeed=0.6; // เริ่มช้า (m/s) — จะเพิ่มทีละน้อย
  let accelEvery=4000; // ms ปรับความเร็วทุก ๆ นี้
  let lastAccel=0;

  // NOTE Spec
  const COLORS=["#00d0ff","#ffd166","#ff6b6b","#00ffa3","#a899ff"];
  const NOTE_SIZE=0.16; // ใหญ่ขึ้น
  const HIT_Y=1.1; // y ของเส้น hit line
  const HIT_WIN_GOOD=0.16; // ระยะ y windows
  const HIT_WIN_PERF=0.08;

  function badge(t){ try{ console.log('[RB]',t);}catch(_e){} }

  // ---------- UI ----------
  function updateHUD(){
    $('hudScore').textContent = score;
    $('hudCombo').textContent = combo;
    $('hudTime').textContent = timeLeft;
    $('hudSpeed').textContent = speedPreset[0].toUpperCase()+speedPreset.slice(1);
  }
  function floatText(text,color,pos){
    const e=document.createElement('a-entity'), p=pos.clone(); p.y+=0.22;
    e.setAttribute('text',{value:text,color,align:'center',width:2.6});
    e.setAttribute('position',`${p.x} ${p.y} ${p.z}`);
    e.setAttribute('scale','0.001 0.001 0.001');
    e.setAttribute('animation__in',{property:'scale',to:'1 1 1',dur:90,easing:'easeOutQuad'});
    e.setAttribute('animation__rise',{property:'position',to:`${p.x} ${p.y+0.6} ${p.z}`,dur:600,easing:'easeOutQuad'});
    e.setAttribute('animation__fade',{property:'opacity',to:0,dur:480,delay:160,easing:'linear'});
    $('arena').appendChild(e); setTimeout(()=>{ try{e.remove();}catch(_e){} },820);
  }

  // ---------- Notes ----------
  function spawnNote(){
    spawns++;
    const x = (Math.random()*2.4 - 1.2).toFixed(2);
    const z = -2.3;
    const yStart = 2.7; // สูงกว่าหน่อย
    const shape = Math.random()<0.5 ? 'a-sphere' : 'a-box';
    const c = COLORS[Math.floor(Math.random()*COLORS.length)];

    const el=document.createElement(shape);
    el.classList.add('clickable','rb-note');
    if(shape==='a-sphere'){
      el.setAttribute('radius', NOTE_SIZE);
    }else{
      el.setAttribute('width', NOTE_SIZE*1.8);
      el.setAttribute('height', NOTE_SIZE*1.8);
      el.setAttribute('depth', NOTE_SIZE*1.8);
    }
    el.setAttribute('material', `color:${c}; opacity:0.95; transparent:true; metalness:0.1; roughness:0.4`);
    el.setAttribute('position', `${x} ${yStart} ${z}`);
    $('arena').appendChild(el);

    const start=performance.now();
    const me = {el, alive:true};
    el.addEventListener('click', ()=>{ if(me.alive) onHit(el); });

    function step(){
      if(!me.alive) return;
      const dt = (performance.now()-start)/1000;
      const y = yStart - dt*fallSpeed;
      el.setAttribute('position', `${x} ${y.toFixed(3)} ${z}`);
      // ผ่าน HIT LINE แล้ว?
      if(y <= HIT_Y - HIT_WIN_GOOD*1.2){
        me.alive=false;
        try{ el.remove(); }catch(_){}
        onMiss(new THREE.Vector3(parseFloat(x),HIT_Y,z));
        return;
      }
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function onHit(el){
    // วัดจากระยะ y ใกล้เส้น HIT LINE
    const p = el.object3D.getWorldPosition(new THREE.Vector3());
    const dy = Math.abs(p.y - HIT_Y);
    let quality='good';
    if(dy <= HIT_WIN_PERF) quality='perfect';
    else if(dy <= HIT_WIN_GOOD) quality='good';
    else quality='miss';

    try{ el.remove(); }catch(_){}
    if(quality==='miss'){
      onMiss(p); return;
    }
    hits++;
    combo++; maxCombo=Math.max(maxCombo, combo);
    let add = (quality==='perfect'? 20 : 10);
    score += add;
    (quality==='perfect'? SFX.perfect : SFX.good).play();
    floatText(quality.toUpperCase(), quality==='perfect' ? '#00ffa3' : '#00d0ff', p);
    if(combo>0 && combo%10===0){ SFX.combo.play(); }
    updateHUD();
  }

  function onMiss(p){
    combo=0;
    score = Math.max(0, score-3);
    SFX.miss.play();
    floatText('MISS','#ff5577', p);
    updateHUD();
  }

  // ---------- Flow ----------
  function start(){
    if(RB.running) return;
    RB.running=true; RB.paused=false;
    score=0; combo=0; maxCombo=0; hits=0; spawns=0; timeLeft=60;
    // ตั้งค่าเริ่มช้า แล้วค่อยเร็ว
    setBaseByPreset();
    fallSpeed = presetFall(speedPreset); // เริ่มช้า
    spawnInt = presetSpawn(speedPreset); // เริ่มห่าง
    lastAccel = performance.now();
    updateHUD();

    // เวลาเดิน
    timer = setInterval(()=>{ timeLeft--; $('hudTime').textContent=timeLeft; if(timeLeft<=0) endGame(); }, 1000);

    // สุ่มโน้ต
    spawnTimer = setInterval(spawnNote, spawnInt);

    // เร่งความเร็วทีละนิด
    tickAccel();

    // เพลง
    playSelectedSong();
    badge('Start');
  }

  function tickAccel(){
    if(!RB.running) return;
    const now = performance.now();
    if(now - lastAccel >= accelEvery){
      lastAccel = now;
      // เร่งทีละน้อย: เร่งตกลง (เร็วขึ้น) และลดช่วง spawn
      fallSpeed = clamp(fallSpeed + 0.06, 0.45, 2.2);
      spawnInt = clamp(spawnInt - 60, 420, 2000);
      // รีเซ็ต interval spawn
      clearInterval(spawnTimer);
      spawnTimer = setInterval(spawnNote, spawnInt);
      badge(`Accel → fall:${fallSpeed.toFixed(2)} spawnInt:${spawnInt}`);
    }
    requestAnimationFrame(tickAccel);
  }

  function pause(){
    if(!RB.running || RB.paused) return;
    RB.paused=true;
    clearInterval(timer); clearInterval(spawnTimer);
    music.pause();
  }
  function resume(){
    if(!RB.running || !RB.paused) return;
    RB.paused=false;
    timer = setInterval(()=>{ timeLeft--; $('hudTime').textContent=timeLeft; if(timeLeft<=0) endGame(); }, 1000);
    spawnTimer = setInterval(spawnNote, spawnInt);
    music.play().catch(()=>{});
  }

  function endGame(){
    if(!RB.running) return;
    RB.running=false; RB.paused=false;
    clearInterval(timer); clearInterval(spawnTimer);
    try{ music.pause(); }catch(_){}

    // ล้างโน้ตค้าง
    Array.from(document.querySelectorAll('.rb-note')).forEach(n=>{ try{ n.remove(); }catch(_){} });

    const acc = spawns? Math.round((hits/spawns)*100) : 0;
    $('rSong').textContent = $('hudSong').textContent || '—';
    $('rScore').textContent = score;
    $('rMaxCombo').textContent = maxCombo;
    $('rAcc').textContent = acc+'%';
    $('results').style.display='flex';
    SFX.ui.play();
    badge('End');
  }

  // ---------- Music ----------
  function playSelectedSong(){
    const opt = $('#songSel')?.selectedOptions?.[0];
    const url = opt?.value;
    const title = opt?.dataset?.title || opt?.textContent || '—';
    $('hudSong').textContent = title || '—';
    if(!url || url==='none'){ try{ music.pause(); }catch(_){ } return; }
    try{
      music.src = url;
      music.currentTime = 0;
      music.play().catch(()=>{ /* ผู้ใช้ยังไม่กด interaction */ });
    }catch(_e){}
  }

  // ---------- Presets ----------
  function setSpeed(v){ speedPreset = (v||'standard'); updateHUD(); }
  function setBaseByPreset(){
    if(speedPreset==='beginner'){
      fallSpeed=0.55; spawnInt=1400; accelEvery=4500;
    }else if(speedPreset==='challenge'){
      fallSpeed=0.85; spawnInt=900; accelEvery=3500;
    }else{ // standard
      fallSpeed=0.7; spawnInt=1100; accelEvery=4000;
    }
  }
  function presetFall(v){ return v==='beginner'?0.55 : v==='challenge'?0.85 : 0.7; }
  function presetSpawn(v){ return v==='beginner'?1400: v==='challenge'?900 : 1100; }

  // ---------- Export ให้ปุ่มเรียก ----------
  RB.start = start;
  RB.pause = pause;
  RB.resume = resume;
  RB.endGame = endGame;
  RB.playSelectedSong = playSelectedSong;
  RB.setSpeed = setSpeed;

  // ---------- Safety ----------
  window.addEventListener('beforeunload', ()=>{
    try{ clearInterval(timer); clearInterval(spawnTimer); }catch(_){}
  });

  // ---------- Enter VR ปุ่มกลางล่าง (กันซ้ำ) ----------
  (function xrButton(){
    if (document.getElementById('enterVRBtn')) return;
    const btn=document.createElement('button');
    btn.id='enterVRBtn';
    btn.textContent='Enter VR';
    Object.assign(btn.style,{
      position:'fixed', left:'50%', transform:'translateX(-50%)',
      bottom:'12px', zIndex:2147483647,
      padding:'8px 12px', borderRadius:'10px', border:'0',
      background:'#0e2233', color:'#e6f7ff', cursor:'pointer'
    });
    document.body.appendChild(btn);
    btn.addEventListener('click', ()=>{ try{ const sc=document.querySelector('a-scene'); sc?.enterVR?.(); }catch(e){ console.warn(e); } });
  })();

  // ---------- iOS Audio Unlock ----------
  (function unlockAudio(){
    let unlocked=false, Ctx=(window.AudioContext||window.webkitAudioContext);
    let ctx = Ctx? new Ctx() : null;
    function resume(){
      if(unlocked || !ctx) return;
      ctx.resume?.(); unlocked = (ctx.state==='running');
    }
    ['touchstart','pointerdown','mousedown','keydown'].forEach(ev=>document.addEventListener(ev, resume, {once:true, passive:true}));
  })();

})();
