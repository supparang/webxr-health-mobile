/* games/shadow-breaker/game.js
   Shadow Breaker · Minimal Playable Core + Coach (Top-Left) + Start works
   - ปุ่ม Start/ Pause/ End คลิกได้
   - โค้ชอยู่มุมบนซ้าย ไม่บังปุ่ม
   - สปอว์นเป้า, คอมโบ, คะแนน, เสียง, ผลลัพธ์
   - Back to Hub ที่ถูกต้อง
*/
(function(){
  "use strict";

  // ---------- Config / Helpers ----------
  const $ = (id)=>document.getElementById(id);
  const HUB_URL = "https://supparang.github.io/webxr-health-mobile/vr-fitness/";
  const ASSET_BASE = (document.querySelector('meta[name="asset-base"]')?.content || '').replace(/\/+$/,'');
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const rnd=(a,b)=>a+Math.random()*(b-a);

  // ---------- Audio ----------
  const SFX = {
    good:    new Audio(`${ASSET_BASE}/assets/sfx/slash.wav`),
    perfect: new Audio(`${ASSET_BASE}/assets/sfx/perfect.wav`),
    miss:    new Audio(`${ASSET_BASE}/assets/sfx/miss.wav`),
    combo:   new Audio(`${ASSET_BASE}/assets/sfx/combo.wav`),
    ui:      new Audio(`${ASSET_BASE}/assets/sfx/success.wav`),
  };
  Object.values(SFX).forEach(a=>{ try{ a.preload='auto'; a.crossOrigin='anonymous'; }catch(_){}});

  // ---------- Coach (Top-Left) ----------
  (function installCoach(){
    if ($('sbCoachBox')) return;
    const box=document.createElement('div'); box.id='sbCoachBox';
    Object.assign(box.style,{
      position:'fixed', left:'14px', top:'72px', zIndex:9999,
      display:'flex', gap:'8px', alignItems:'center',
      background:'rgba(6,14,24,.82)', border:'1px solid rgba(0,255,170,.25)',
      color:'#dff', padding:'8px 10px', borderRadius:'12px',
      maxWidth:'52vw', font:'600 13px/1.25 system-ui,Segoe UI,Arial',
      pointerEvents:'none' // ไม่ดักคลิก
    });
    const avatar=document.createElement('div');
    Object.assign(avatar.style,{
      width:'36px', height:'36px', borderRadius:'50%',
      background:'radial-gradient(#00c9a7,#006b62)',
      boxShadow:'0 0 12px rgba(0,255,200,.45) inset'
    });
    const text=document.createElement('div'); text.id='sbCoachText'; text.textContent='พร้อมลุย!';
    box.appendChild(avatar); box.appendChild(text);
    document.body.appendChild(box);
  })();
  const Coach = (function(){
    const q=[]; let busy=false, last=0;
    function say(msg,ttl=1800){
      const now=performance.now();
      if(now-last<600){ q.push({msg,ttl}); return; }
      last=now;
      const el=$('sbCoachText'); if(!el) return;
      el.textContent=msg;
      if(busy) return;
      busy=true;
      setTimeout(()=>{
        busy=false;
        if(q.length){ const n=q.shift(); say(n.msg,n.ttl); }
      }, ttl);
    }
    return { say };
  })();

  // ---------- Game State ----------
  const GS = {
    running:false, paused:false,
    score:0, combo:0, maxCombo:0, hits:0, spawns:0,
    timeLeft:60, timer:null, spawnTimer:null,
    fallSpeed:0.75, // เริ่มช้า
    spawnInt:1100,  // เริ่มห่าง
    accelEvery:4000, lastAccel:0, accelRAF:null,
  };
  const NOTE_COLORS = ["#00d0ff","#ffd166","#ff6b6b","#00ffa3","#a899ff","#ff9c6b"];
  const NOTE_SIZE = 0.18;
  const HIT_Y = 1.25;
  const WIN_GOOD = 0.19;
  const WIN_PERF = 0.10;

  // ---------- HUD helpers ----------
  function updateHUD(){
    $('score') && ($('score').textContent = GS.score);
    $('combo') && ($('combo').textContent = GS.combo);
    $('time')  && ($('time').textContent  = GS.timeLeft);
  }
  function floatText(text,color,pos){
    const e=document.createElement('a-entity'), p=pos.clone(); p.y+=0.22;
    e.setAttribute('text',{value:text,color,align:'center',width:2.6});
    e.setAttribute('position',`${p.x} ${p.y} ${p.z}`);
    e.setAttribute('scale','0.001 0.001 0.001');
    e.setAttribute('animation__in',{property:'scale',to:'1 1 1',dur:90,easing:'easeOutQuad'});
    e.setAttribute('animation__fade',{property:'opacity',to:0,dur:500,delay:200});
    $('arena')?.appendChild(e);
    setTimeout(()=>{ try{e.remove();}catch(_e){} }, 820);
  }

  // ---------- Notes ----------
  function spawnNote(){
    if(!GS.running) return;
    GS.spawns++;
    const shape = Math.random()<0.5 ? 'a-sphere' : 'a-box';
    const x = rnd(-1.2,1.2).toFixed(2), yStart = 2.6, z = -2.3;
    const c = NOTE_COLORS[Math.floor(Math.random()*NOTE_COLORS.length)];
    const el=document.createElement(shape);
    el.classList.add('clickable','sb-note');
    if(shape==='a-sphere'){ el.setAttribute('radius', NOTE_SIZE); }
    else { el.setAttribute('width', NOTE_SIZE*1.8); el.setAttribute('height', NOTE_SIZE*1.8); el.setAttribute('depth', NOTE_SIZE*1.8); }
    el.setAttribute('material',`color:${c}; opacity:0.95; transparent:true; metalness:0.15; roughness:0.35`);
    el.setAttribute('position',`${x} ${yStart} ${z}`);
    $('arena')?.appendChild(el);

    // รองรับ mouse และ controller: ใช้ event 'click'
    const hit = ()=>onHit(el);
    el.addEventListener('click', hit);
    el.addEventListener('mousedown', hit);

    const born = performance.now();
    let alive = true;
    (function fall(){
      if(!alive || !GS.running) return;
      const t = (performance.now()-born)/1000;
      const y = yStart - t*GS.fallSpeed;
      el.setAttribute('position',`${x} ${y.toFixed(3)} ${z}`);
      // หลุดหน้าต่าง hit -> MISS
      if (y <= HIT_Y - WIN_GOOD*1.35){
        alive=false;
        try{ el.remove(); }catch(_){}
        onMiss(new THREE.Vector3(parseFloat(x),HIT_Y,z));
        return;
      }
      requestAnimationFrame(fall);
    })();
  }

  function onHit(el){
    if(!GS.running) return;
    const p = el.object3D.getWorldPosition(new THREE.Vector3());
    const dy = Math.abs(p.y - HIT_Y);
    let quality = 'good';
    if(dy <= WIN_PERF) quality='perfect'; else if(dy <= WIN_GOOD) quality='good'; else quality='miss';

    try{ el.remove(); }catch(_){}
    if (quality==='miss'){ onMiss(p); return; }

    GS.hits++;
    GS.combo++; GS.maxCombo = Math.max(GS.maxCombo, GS.combo);
    GS.score += (quality==='perfect'? 20 : 10);
    (quality==='perfect'? SFX.perfect : SFX.good).play();
    floatText(quality.toUpperCase(), quality==='perfect'?'#00ffa3':'#00d0ff', p);
    if(GS.combo>0 && GS.combo%10===0){ SFX.combo.play(); Coach.say(`คอมโบ ${GS.combo}! สุดยอด`); }
    updateHUD();
  }
  function onMiss(p){
    GS.combo = 0;
    GS.score = Math.max(0, GS.score-3);
    SFX.miss.play();
    floatText('MISS','#ff5577', p);
    Coach.say('พลาดไปนิด โฟกัสเส้นเขียว!');
    updateHUD();
  }

  function clearNotes(){
    document.querySelectorAll('.sb-note').forEach(n=>{ try{ n.remove(); }catch(_){ } });
  }

  // ---------- Game Flow ----------
  function start(){
    if(GS.running) return;
    GS.running=true; GS.paused=false;
    GS.score=0; GS.combo=0; GS.maxCombo=0; GS.hits=0; GS.spawns=0; GS.timeLeft=60;
    GS.fallSpeed=0.75; GS.spawnInt=1100; GS.accelEvery=4000; GS.lastAccel=performance.now();
    clearNotes(); updateHUD();
    Coach.say('เริ่มจากช้า ๆ จัดท่าให้ดี แล้วฟาด!');

    // เดินเวลา
    GS.timer = setInterval(()=>{
      GS.timeLeft--; $('time') && ($('time').textContent=GS.timeLeft);
      if(GS.timeLeft<=0) end();
    }, 1000);

    // สปอว์นทันที + ตั้ง interval
    spawnNote();
    GS.spawnTimer = setInterval(spawnNote, GS.spawnInt);

    // ค่อย ๆ เร่ง
    const tick = ()=>{
      if(!GS.running || GS.paused) return;
      const now = performance.now();
      if(now - GS.lastAccel >= GS.accelEvery){
        GS.lastAccel = now;
        GS.fallSpeed = clamp(GS.fallSpeed + 0.06, 0.5, 2.2);
        GS.spawnInt  = clamp(GS.spawnInt  - 60, 420, 2000);
        clearInterval(GS.spawnTimer);
        GS.spawnTimer = setInterval(spawnNote, GS.spawnInt);
      }
      GS.accelRAF = requestAnimationFrame(tick);
    };
    tick();
  }

  function pause(){
    if(!GS.running || GS.paused) return;
    GS.paused=true;
    clearInterval(GS.timer); clearInterval(GS.spawnTimer);
    if(GS.accelRAF) cancelAnimationFrame(GS.accelRAF), GS.accelRAF=null;
    Coach.say('พักแป๊บ… พร้อมค่อยกดต่อ');
  }

  function resume(){
    if(!GS.running || !GS.paused) return;
    GS.paused=false;
    GS.timer = setInterval(()=>{ GS.timeLeft--; $('time')&&($('time').textContent=GS.timeLeft); if(GS.timeLeft<=0) end(); }, 1000);
    GS.spawnTimer = setInterval(spawnNote, GS.spawnInt);
    GS.lastAccel = performance.now();
    const tick = ()=>{
      if(!GS.running || GS.paused) return;
      const now = performance.now();
      if(now - GS.lastAccel >= GS.accelEvery){
        GS.lastAccel = now;
        GS.fallSpeed = clamp(GS.fallSpeed + 0.06, 0.5, 2.2);
        GS.spawnInt  = clamp(GS.spawnInt  - 60, 420, 2000);
        clearInterval(GS.spawnTimer);
        GS.spawnTimer = setInterval(spawnNote, GS.spawnInt);
      }
      GS.accelRAF = requestAnimationFrame(tick);
    };
    tick();
    Coach.say('ลุยต่อ!');
  }

  function end(){
    if(!GS.running) return;
    GS.running=false; GS.paused=false;
    clearInterval(GS.timer); clearInterval(GS.spawnTimer);
    if(GS.accelRAF) cancelAnimationFrame(GS.accelRAF), GS.accelRAF=null;
    clearNotes();
    const acc = GS.spawns? Math.round((GS.hits/GS.spawns)*100) : 0;
    $('rScore') && ($('rScore').textContent=GS.score);
    $('rMaxCombo') && ($('rMaxCombo').textContent=GS.maxCombo);
    $('rAcc') && ($('rAcc').textContent=acc+'%');
    $('results') && ( $('results').style.display='flex' );
    SFX.ui.play();
    Coach.say(`จบเกม! คะแนน ${GS.score} · ACC ${acc}%`, 2400);
  }

  // ---------- Buttons wiring ----------
  function wireUI(){
    $('startBtn')?.addEventListener('click', start);
    $('pauseBtn')?.addEventListener('click', ()=>{
      if(!GS.running) return;
      if(GS.paused) resume(); else pause();
    });
    $('bankBtn')?.addEventListener('click', ()=>{ /* Shadow Breaker เดิมมี bank; เวอร์ชันย่อนี้ขอข้าม */ });
    $('replayBtn')?.addEventListener('click', ()=>{ $('results')&&( $('results').style.display='none'); start(); });
    $('backBtn')?.addEventListener('click', ()=>{ location.href = HUB_URL; });

    // คีย์ลัด: Space = Start/Toggle Pause, Esc = End
    addEventListener('keydown', (ev)=>{
      if(ev.code==='Space'){
        ev.preventDefault();
        if(!GS.running) start(); else if(GS.paused) resume(); else pause();
      }
      if(ev.code==='Escape'){ end(); }
    });
  }

  // ---------- Boot ----------
  function boot(){
    wireUI();
    updateHUD();
    // ทำให้ปุ่มแน่ใจว่า clickable (กัน overlay ใด ๆ ): 
    ['startBtn','pauseBtn','bankBtn'].forEach(id=>{
      const b=$(id); if(!b) return;
      b.style.pointerEvents='auto';
      b.style.position=b.style.position||'relative';
      b.style.zIndex= (b.style.zIndex||'') || 10000;
    });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  // ---------- iOS audio unlock ----------
  (function unlockAudio(){
    const Ctx=(window.AudioContext||window.webkitAudioContext); if(!Ctx) return;
    const ctx=new Ctx();
    function resume(){ ctx.resume?.(); remove(); }
    function remove(){ ['touchstart','pointerdown','mousedown','keydown'].forEach(ev=>document.removeEventListener(ev,resume)); }
    ['touchstart','pointerdown','mousedown','keydown'].forEach(ev=>document.addEventListener(ev,resume,{once:true,passive:true}));
  })();

})();
