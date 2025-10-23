/* games/rhythm-boxer/game.js
   Rhythm Boxer · Mouse/Touch Aim (Raycast) + Big Hitbox + Slow-to-Fast Ramp + Start/Pause near Song + Safe Removals
*/
(function(){
  "use strict";

  // ---------- Helpers ----------
  const $ = (id)=>document.getElementById(id);
  const ASSET_BASE = (document.querySelector('meta[name="asset-base"]')?.content || '').replace(/\/+$/,'');
  function ping(msg,color='#ffcc00'){
    const t=$('toast'); if(!t) return;
    t.style.color=color; t.textContent=msg;
    t.style.opacity='1'; t.style.transform='translateX(-50%) scale(1.02)';
    setTimeout(()=>{ t.style.opacity='0'; t.style.transform='translateX(-50%) scale(1)'; }, 900);
  }
  function safeRemove(el){
    try{
      if(!el) return;
      if(!el.isConnected && !el.parentNode) return;
      if(el.parentNode) el.parentNode.removeChild(el);
      else if(el.remove) el.remove();
    }catch(_){}
  }

  // ---------- Difficulty / Speed ----------
  const DIFF = {
    easy:   { spawn: 620, speed: 1.00, ramp: 1.000,  name:'EASY'   },
    normal: { spawn: 560, speed: 1.10, ramp: 1.0006, name:'NORMAL' },
    hard:   { spawn: 520, speed: 1.18, ramp: 1.0010, name:'HARD'   },
    final:  { spawn: 480, speed: 1.25, ramp: 1.0014, name:'FINAL'  },
  };
  function getDiffKey(){ return (new URLSearchParams(location.search).get('diff')) || localStorage.getItem('rb_diff') || 'normal'; }
  let D = DIFF.normal;

  // ---------- SFX ----------
  const SFX = {
    hit: new Audio(`${ASSET_BASE}/assets/sfx/perfect.wav`),
    good: new Audio(`${ASSET_BASE}/assets/sfx/slash.wav`),
    miss: new Audio(`${ASSET_BASE}/assets/sfx/miss.wav`),
    combo: new Audio(`${ASSET_BASE}/assets/sfx/combo.wav`),
  };
  const lastPlay=new Map();
  function play(a,guard=70){ try{ const now=performance.now(); if(lastPlay.get(a)&&now-lastPlay.get(a)<guard) return; a.currentTime=0; lastPlay.set(a,now); a.play(); }catch(_e){} }

  // ---------- State ----------
  let running=false, paused=false;
  let score=0, combo=0, maxCombo=0, timeLeft=60;
  let spawnTimer=null, secondTimer=null;
  let speedMul = 0.75; // เริ่มช้า แล้วค่อยเร่ง
  let spawnMs;

  // ---------- HUD ----------
  function hud(){ $('sc').textContent = score; $('cb').textContent=combo; $('tm').textContent=timeLeft; }

  // ---------- Judge ----------
  // เส้น Hit line อยู่ประมาณ y ~ 0.0 (ด้วยตำแหน่ง lanes = y=0), เราตั้งเป้าให้โน้ตลงมาถึง y≈0.0
  const JUDGE = {
    perfect: 0.10, // ระยะ |y - 0| ที่ยังถือว่าเพอร์เฟกต์
    good:    0.22,
  };
  function judgeAndRemove(root){
    if(!root || !root.parentNode) return;
    // อ่าน y ปัจจุบัน
    const pos = root.getAttribute('position');
    const dy = Math.abs(pos.y - 0.0);
    safeRemove(root);

    if(dy <= JUDGE.perfect){
      combo++; score += 30; play(SFX.hit);
      ping('PERFECT','#00ffa3');
    }else if(dy <= JUDGE.good){
      combo++; score += 18; play(SFX.good);
      ping('GOOD','#9bd1ff');
    }else{
      combo = 0; play(SFX.miss);
      ping('LATE','#ff5577');
    }
    if(combo>0 && combo%10===0) play(SFX.combo);
    if(combo>maxCombo) maxCombo=combo;
    hud();
  }
  function onMiss(){
    combo = 0; play(SFX.miss); hud();
  }

  // ---------- Beat ----------
  function makeBeat(lane, laneY=0.75, customSpeedMul=1){
    const lanes=$('lanes'); if(!lanes) return;

    // root = ตัวคลิกจริง
    const root=document.createElement('a-entity');
    root.classList.add('beat','clickable');
    root.setAttribute('position', `${lane*0.9} ${laneY} 0`);
    lanes.appendChild(root);

    // visual เล็กสวย
    const vis=document.createElement('a-sphere');
    vis.setAttribute('radius','0.12');
    vis.setAttribute('color', lane===0?'#7a5cff':(lane<0?'#00d0ff':'#ffd166'));
    vis.setAttribute('position','0 0 0');
    root.appendChild(vis);

    // collider ใหญ่ โปร่งใส => กดง่าย
    const col=document.createElement('a-sphere');
    col.setAttribute('radius','0.24');
    col.setAttribute('material','opacity:0.001; transparent:true; color:#000');
    col.setAttribute('position','0 0 0');
    root.appendChild(col);

    const spd=0.0032*D.speed*speedMul*customSpeedMul;
    const born=performance.now();

    function step(){
      if(!root || !root.parentNode) return;
      const t=performance.now()-born;
      const y=laneY - t*spd; // ไหลลง
      root.setAttribute('position', `${lane*0.9} ${y.toFixed(3)} 0`);
      if(y<=-0.78){ safeRemove(root); onMiss(); return; }
      requestAnimationFrame(step);
    }

    root.addEventListener('click', ()=>judgeAndRemove(root));
    requestAnimationFrame(step);
  }

  // สคริปต์เพลงแบบง่าย: สุ่ม lane และจังหวะ
  function songScript(kind){
    // 3 เลน: -1, 0, +1
    if(kind==='intro'){
      return { len:60, chart:(beat)=>{
        // เริ่มช้า (speedMul ค่อยๆ เพิ่ม)
        makeBeat(-1, 0.75, 0.9); makeBeat(1, 0.78, 0.9);
        setTimeout(()=>{ makeBeat(0, 0.76, 0.95); }, 260);
      }, density:1.0 };
    }
    if(kind==='rush'){
      return { len:60, chart:(beat)=>{
        makeBeat([-1,0,1][Math.floor(Math.random()*3)], 0.8, 1.0);
      }, density:1.2 };
    }
    // boss
    return { len:60, chart:(beat)=>{
      const lanes=[-1,-1,0,1,1,0][beat%6];
      makeBeat(lanes, 0.8, 1.05);
    }, density:1.35 };
  }

  // ---------- Flow ----------
  function start(){
    if(running) return;
    // difficulty
    const key = $('diffSel')?.value || getDiffKey();
    localStorage.setItem('rb_diff', key);
    D = DIFF[key] || DIFF.normal;
    spawnMs = D.spawn;

    running = true; paused=false;
    score=0; combo=0; maxCombo=0; timeLeft=60; speedMul = 0.75; // เริ่มช้า
    hud();

    $('pauseBtn').disabled=false;

    const song = $('songSel')?.value || 'intro';
    const script = songScript(song);
    const born = performance.now();

    // สร้างบีตตามความหนาแน่น + สปีดเร่งละนิดทุกวินาที
    let beatCount = 0;
    spawnTimer = setInterval(()=>{
      if(!running || paused) return;
      script.chart(beatCount++);
    }, Math.max(280, spawnMs));

    secondTimer = setInterval(()=>{
      if(!running || paused) return;
      timeLeft--; if(timeLeft<=0){ end(); return; }
      // เร่งสปีดอย่างนิ่ม
      speedMul *= D.ramp;
      hud();
    }, 1000);

    ping(`START · ${DIFF[key].name}`);
  }

  function end(){
    running=false;
    try{ clearInterval(spawnTimer); clearInterval(secondTimer); }catch(_){}
    spawnTimer=null; secondTimer=null;
    // ล้างบีตที่ค้าง
    const lanes=$('lanes'); if(lanes){ Array.from(lanes.children).forEach(c=>safeRemove(c)); }
    $('pauseBtn').disabled=true;
    ping(`RESULT: ${score} · Combo ${maxCombo}`,'#00ffa3');
  }

  function togglePause(){
    if(!running) return;
    paused = !paused;
    ping(paused?'PAUSED':'RESUME', paused?'#ffd166':'#00ffa3');
  }

  // ---------- UI ----------
  document.addEventListener('DOMContentLoaded', ()=>{
    $('startBtn')?.addEventListener('click', start, {passive:true});
    $('pauseBtn')?.addEventListener('click', togglePause, {passive:true});
    $('diffSel')?.addEventListener('change', e=>{
      const v=e.target.value; try{ localStorage.setItem('rb_diff', v); }catch(_){}
    }, {passive:true});
    $('enterVRBtn')?.addEventListener('click', ()=>{
      try{ document.querySelector('a-scene')?.enterVR?.(); }catch(_){}
    }, {passive:true});
  });

  // ---------- Mouse / Touch Raycast (ยิงหา .clickable ให้โดนชัวร์) ----------
  (function installPointerRaycast(){
    const sceneEl = document.querySelector('a-scene');
    if (!sceneEl) return;
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    function pick(x,y){
      const cam = sceneEl.camera; if (!cam) return;
      mouse.x =  (x / window.innerWidth) * 2 - 1;
      mouse.y = -(y / window.innerHeight) * 2 + 1;

      raycaster.setFromCamera(mouse, cam);
      const objs = Array.from(document.querySelectorAll('.clickable'))
        .map(el => el.object3D).filter(Boolean);
      const all=[]; objs.forEach(o=>o.traverse(c=>all.push(c)));

      const hits = raycaster.intersectObjects(all, true);
      if (hits && hits.length){
        let obj = hits[0].object;
        while (obj && !obj.el) obj = obj.parent;
        if (obj && obj.el){ obj.el.emit('click'); }
      }
    }
    window.addEventListener('pointerdown', e=>pick(e.clientX,e.clientY), {passive:true});
    // สำรอง
    window.addEventListener('mousedown', e=>pick(e.clientX,e.clientY), {passive:true});
    window.addEventListener('touchstart', e=>{
      const t=e.touches?.[0]; if(t) pick(t.clientX,t.clientY);
    }, {passive:true});
  })();

  // ---------- Guards ----------
  window.addEventListener('beforeunload', ()=>{
    try{ clearInterval(spawnTimer); clearInterval(secondTimer); }catch(_){}
  });

})();
