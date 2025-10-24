/* games/shadow-breaker/game.js
   Shadow Breaker · เพิ่ม “Punch Pads” ให้ชกจริง + ฮิตง่ายขึ้น + สปอว์นต่อเนื่อง + เมาส์/ทัชคลิกโดนแน่
   - มีทั้งลวดลายบอส (วงแหวน/ดาบกากบาท) และเป้าชก (Pads) สลับกัน
   - เริ่มช้า สปอว์นห่าง แล้วค่อยเร่ง
   - โดน = GOOD / PERFECT + เสียงเอฟเฟกต์ + สะสมคอมโบ + ลด HP บอส
*/
(function(){
  "use strict";

  // ---------- Helpers ----------
  const byId = (id)=>document.getElementById(id);
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const getQuery=(k)=>new URLSearchParams(location.search).get(k);
  const ASSET_BASE=(document.querySelector('meta[name="asset-base"]')?.content||'').replace(/\/+$/,'');
  const HUB_URL="https://supparang.github.io/webxr-health-mobile/vr-fitness/";

  // Null-safe remove
  function safeRemove(el){ try{ if(!el) return; if(el.parentNode) el.parentNode.removeChild(el); else el.remove?.(); }catch(_e){} }

  // ---------- Audio ----------
  const SFX = {
    tel_slash: new Audio(`${ASSET_BASE}/assets/sfx/tel_slash.wav`),
    tel_shock: new Audio(`${ASSET_BASE}/assets/sfx/tel_shock.wav`),
    hp_hit:    new Audio(`${ASSET_BASE}/assets/sfx/hp_hit.wav`),
    miss:      new Audio(`${ASSET_BASE}/assets/sfx/miss.wav`),
    good:      new Audio(`${ASSET_BASE}/assets/sfx/slash.wav`),
    perfect:   new Audio(`${ASSET_BASE}/assets/sfx/perfect.wav`),
    combo:     new Audio(`${ASSET_BASE}/assets/sfx/combo.wav`),
    ui:        new Audio(`${ASSET_BASE}/assets/sfx/success.wav`),
    roar:      new Audio(`${ASSET_BASE}/assets/sfx/boss_roar.wav`)
  };
  Object.values(SFX).forEach(a=>{ try{ a.preload='auto'; a.crossOrigin='anonymous'; }catch(_e){} });
  const lastPlay=new Map();
  function play(a,guardMs=90){ try{ const now=performance.now(); if(lastPlay.get(a)&&now-lastPlay.get(a)<guardMs) return; a.currentTime=0; lastPlay.set(a,now); a.play(); }catch(_e){} }

  // ---------- Difficulty / timing ----------
  const DIFFS = {
    easy:   { hp:0.9,  atkWin:1.10, title:'EASY',   padSpawn:1100, padSpeed:0.55 },
    normal: { hp:1.0,  atkWin:1.00, title:'NORMAL', padSpawn:950,  padSpeed:0.65 },
    hard:   { hp:1.15, atkWin:0.92, title:'HARD',   padSpawn:820,  padSpeed:0.78 },
    final:  { hp:1.25, atkWin:0.88, title:'FINAL',  padSpawn:760,  padSpeed:0.88 },
  };
  function getDiffKey(){
    return (window.APP?.story?.difficulty) || getQuery('diff') || localStorage.getItem('sb_diff') || 'normal';
  }
  let D = DIFFS.normal;
  let TIME_SCALE = 1;
  const dur = (ms)=> ms * D.atkWin * TIME_SCALE;

  // ---------- Float text ----------
  function floatText(text,color,pos){
    const e=document.createElement('a-entity'), p=pos.clone(); p.y+=0.22;
    e.setAttribute('text',{value:text,color,align:'center',width:2.6});
    e.setAttribute('position',`${p.x} ${p.y} ${p.z}`);
    e.setAttribute('scale','0.001 0.001 0.001');
    e.setAttribute('animation__in',{property:'scale',to:'1 1 1',dur:90,easing:'easeOutQuad'});
    e.setAttribute('animation__rise',{property:'position',to:`${p.x} ${p.y+0.6} ${p.z}`,dur:600,easing:'easeOutQuad'});
    e.setAttribute('animation__fade',{property:'opacity',to:0,dur:480,delay:160,easing:'linear'});
    byId('arena')?.appendChild(e); setTimeout(()=>safeRemove(e),820);
  }

  // ---------- Game/Boss state ----------
  let running=false, paused=false, timer=null, padTimer=null, accelRAF=null;
  let score=0, combo=0, maxCombo=0, hits=0, spawns=0, timeLeft=60;

  const BOSS = { active:false, busy:false, hp:0, max:1000, phase:1, rage:false, name:'', color:'#ff3355' };
  let pIndex=0, lastPattern='', survivedStreak=0;

  const ROSTER = [
    { id:'RazorFist', title:'RAZORFIST', baseHP:1000, color:'#ff3355',
      P1:['pads','ground_shock','slash_cross','pads'], P2:['pads','slash_cross','ground_shock','pads'] }
  ];

  // ---------- HUD ----------
  function updateHUD(){
    byId('score').textContent = score;
    byId('combo').textContent = combo;
    byId('time').textContent  = timeLeft;
  }

  // ---------- Boss UI ----------
  function bossShowUI(show){ const bar=byId('bossBar'); if(bar) bar.style.display=show?'block':'none'; }
  function bossSetHP(v){
    const was=BOSS.hp;
    BOSS.hp = clamp(v,0,BOSS.max);
    const fill=byId('bossHPFill'); if(fill) fill.style.width=((BOSS.hp/BOSS.max)*100)+'%';
    if(BOSS.phase===1 && (BOSS.hp/BOSS.max)<=0.5) enterPhase2();
    if(BOSS.hp<=0 && was>0) onBossDefeated();
  }
  function bossDamage(amount){
    play(SFX.hp_hit);
    bossSetHP(BOSS.hp - Math.max(1, Math.round(amount)));
  }

  function bossIntro(){
    const arena=byId('arena'); if(!arena) return;
    const anchor=document.createElement('a-entity'); anchor.setAttribute('position','0 1.5 -3'); anchor.id='bossAnchor';
    const head=document.createElement('a-sphere'); head.setAttribute('radius','0.35'); head.setAttribute('color','#1a1a1a'); head.setAttribute('position','0 0 0');
    const mask=document.createElement('a-box'); mask.setAttribute('depth','0.06'); mask.setAttribute('width','0.55'); mask.setAttribute('height','0.45'); mask.setAttribute('color',BOSS.color); mask.setAttribute('position','0 0 0.25');
    anchor.appendChild(head); anchor.appendChild(mask); arena.appendChild(anchor);
    bossShowUI(true); bossSetHP(BOSS.max); play(SFX.roar);
    const ph=byId('phaseLabel'); if(ph) ph.textContent='Phase 1';
  }

  function enterPhase2(){
    BOSS.phase=2; survivedStreak=0;
    const ph=byId('phaseLabel'); if(ph) ph.textContent='Phase 2';
    floatText('PHASE 2','#00ffa3', new THREE.Vector3(0,1.6,-2.3));
    // เร่งสปอว์น Pads เล็กน้อย
    padSpawnInterval = clamp(padSpawnInterval - 120, 420, 2400);
    restartPadTimer();
  }

  function onBossDefeated(){
    BOSS.active=false; BOSS.busy=false;
    floatText('BOSS DEFEATED','#00ffa3', new THREE.Vector3(0,1.6,-2.3));
    score += 250; updateHUD();
    end(); // จบรอบนี้
  }

  // ---------- Patterns ----------
  function pickPattern(arr){
    let p=arr[pIndex % arr.length]; pIndex++;
    if(p===lastPattern){ p=arr[pIndex % arr.length]; pIndex++; }
    lastPattern=p; return p;
  }

  // วงแหวนขยายด้วย RAF
  function spawnRing(done, T = 600){
    const r = document.createElement('a-ring');
    r.classList.add('clickable','boss-attack');
    r.setAttribute('position','0 1.18 -2.6');
    r.setAttribute('radius-inner','0.05');
    r.setAttribute('radius-outer','0.07');
    r.setAttribute('material','color:#ffd166;opacity:.95;shader:flat');
    byId('arena').appendChild(r);

    let clicked = false;
    r.addEventListener('click', ()=> {
      if (clicked) return;
      clicked = true;
      floatText('BREAK','#ffd166',r.object3D.getWorldPosition(new THREE.Vector3()));
      bossDamage(16);
      safeRemove(r);
      done && done(true);
    });

    const start = performance.now();
    const total = dur(T);
    (function step(){
      if (!r.parentNode) return;
      const t = clamp((performance.now() - start)/total, 0, 1);
      const base = 0.07 + t * 0.9;
      r.setAttribute('radius-inner', Math.max(0.01, base - 0.02));
      r.setAttribute('radius-outer', base);
      if (t >= 1){
        if(!clicked){ hardMiss(r); safeRemove(r); done && done(false); }
        return;
      }
      requestAnimationFrame(step);
    })();
  }

  // ท่า: Ground Shock
  function doGroundShock(){
    BOSS.busy=true; play(SFX.tel_shock);
    let c=0, need=(BOSS.phase===1?3:4);
    (function next(){
      spawnRing((ok)=>{ c += ok?1:0; if(c<need){ setTimeout(next, dur(220)); } else { finishAttack(); } }, BOSS.phase===1?700:560);
    })();
  }

  // ท่า: Slash Cross (ดาบกากบาท)
  function doSlashCross(){
    BOSS.busy = true; play(SFX.tel_slash);
    const makeSlash = (rot, y) => {
      const g = document.createElement('a-entity');
      g.classList.add('clickable','boss-attack');
      g.setAttribute('geometry','primitive: box; height:.04; width:1.2; depth:.04');
      g.setAttribute('material','color:#5de1ff; opacity:.95; transparent:true');
      g.setAttribute('rotation',`0 0 ${rot}`);
      g.setAttribute('position',`0 ${y} -2.2`);
      byId('arena').appendChild(g);
      return g;
    };
    const a = makeSlash(-35, 1.40);
    const b = makeSlash( 35, 1.46);
    let cleared = 0;
    function hit(g){
      if (g.dataset.hit === '1') return;
      g.dataset.hit = '1';
      cleared++;
      floatText('PARRY','#00ffa3', g.object3D.getWorldPosition(new THREE.Vector3()));
      bossDamage(18);
      safeRemove(g);
    }
    a.addEventListener('click', ()=>hit(a));
    b.addEventListener('click', ()=>hit(b));
    setTimeout(()=>{
      if (a.parentNode && a.dataset.hit!=='1') hardMiss(a), safeRemove(a);
      if (b.parentNode && b.dataset.hit!=='1') hardMiss(b), safeRemove(b);
      finishAttack();
    }, dur(720));
  }

  // ลูปของบอส
  function bossLoop(){
    if(!running || !BOSS.active || BOSS.busy) return;
    const cfg = ROSTER[0];
    const arr = (BOSS.phase===1? cfg.P1 : cfg.P2);
    const pattern = pickPattern(arr);
    ({
      'pads'        : doPadBurst,
      'ground_shock': doGroundShock,
      'slash_cross' : doSlashCross
    }[pattern]||(()=>{ BOSS.busy=false; setTimeout(bossLoop, dur(200)); }))();
  }

  function finishAttack(){
    if (BOSS.phase === 2) {
      survivedStreak++;
      if (survivedStreak >= 3) { survivedStreak = 0; /* hook พิเศษในอนาคต */ }
    }
    BOSS.busy=false;
    setTimeout(bossLoop, dur(BOSS.phase===2?420:560));
  }

  // ---------- Punch Pads (เป้าชกให้โดนจริง) ----------
  const PAD_COLORS = ['#00d0ff','#ffd166','#ff6b6b','#00ffa3','#a899ff'];
  const PAD_SIZE = 0.26;            // ใหญ่ขึ้นให้กดง่าย
  const PAD_HIT_GOOD = 0.22;        // window กว้างขึ้น
  const PAD_HIT_PERF = 0.12;
  const PAD_HIT_Y = 1.15;           // เส้น Hit Line กลางหน้า

  let padSpeed = 0.65;              // m/s
  let padSpawnInterval = 1000;      // ms
  let lastAccel = 0;
  let padAlive = new Set();

  function doPadBurst(){
    // แค่ประกาศว่าช่วงนี้ให้ “Pads system” ทำงานต่อเนื่อง แล้วปล่อยลูปบอสเดินต่อ
    // ตัว pads จะสปอว์นพื้นหลังไปเรื่อย ๆ อยู่แล้ว
    setTimeout(finishAttack, dur(300));
  }

  function spawnPad(){
    if(!running) return;
    spawns++;

    // ตำแหน่งแบบ lane 3 ช่อง (-0.8, 0, 0.8) + สุ่มเล็กน้อย
    const lanes = [-0.85, 0, 0.85];
    const x = (lanes[Math.floor(Math.random()*lanes.length)] + (Math.random()*0.18-0.09)).toFixed(2);
    const z = -2.25;
    const yStart = 2.6;
    const color = PAD_COLORS[Math.floor(Math.random()*PAD_COLORS.length)];

    const pad=document.createElement('a-entity');
    pad.classList.add('clickable','sb-pad');
    pad.setAttribute('geometry', `primitive: circle; radius: ${PAD_SIZE}`);
    pad.setAttribute('material', `color:${color}; opacity:0.96; transparent:true; metalness:0.05; roughness:0.45`);
    pad.setAttribute('position', `${x} ${yStart} ${z}`);
    // Halo
    const halo=document.createElement('a-entity');
    halo.setAttribute('geometry', `primitive: ring; radiusInner:${PAD_SIZE*0.78}; radiusOuter:${PAD_SIZE*1.15}`);
    halo.setAttribute('material', `color:#ffffff; opacity:0.25; transparent:true`);
    pad.appendChild(halo);

    byId('arena').appendChild(pad);
    padAlive.add(pad);

    // คลิก = ยิง event hit
    const hitHandler=()=>onPadHit(pad);
    pad.addEventListener('click', hitHandler);
    pad.addEventListener('mousedown', hitHandler);

    const born = performance.now();
    let alive = true;

    // ตกลงด้วย RAF
    (function step(){
      if(!alive || !running) return;
      const t = (performance.now()-born)/1000;
      const y = yStart - t*padSpeed;
      pad.setAttribute('position', `${x} ${y.toFixed(3)} ${z}`);

      // ผ่าน Window ล่างสุด => MISS
      if(y <= PAD_HIT_Y - PAD_HIT_GOOD*1.4){
        alive=false;
        killPad(pad);
        onMiss(new THREE.Vector3(parseFloat(x), PAD_HIT_Y, z));
        return;
      }
      requestAnimationFrame(step);
    })();
  }

  function onPadHit(pad){
    if(!running) return;
    // ป้องกัน “Perfect/Good แล้วต่อด้วย Miss ในโน้ตเดียว” ด้วยธง handled
    if(pad.dataset.handled==='1') return;
    pad.dataset.handled='1';

    const p = pad.object3D.getWorldPosition(new THREE.Vector3());
    const dy = Math.abs(p.y - PAD_HIT_Y);
    let quality='good';
    if(dy <= PAD_HIT_PERF) quality='perfect';
    else if(dy <= PAD_HIT_GOOD) quality='good';
    else quality='miss';

    killPad(pad);

    if(quality==='miss'){ onMiss(p); return; }

    hits++;
    combo++; maxCombo=Math.max(maxCombo, combo);
    score += (quality==='perfect'? 18 : 10);
    (quality==='perfect'? SFX.perfect : SFX.good).play();
    floatText(quality.toUpperCase(), quality==='perfect' ? '#00ffa3' : '#00d0ff', p);
    if(combo>0 && combo%10===0){ play(SFX.combo); }

    // ทำดาเมจกับบอสเล็กน้อยตอนชกโดน
    bossDamage(quality==='perfect'? 14 : 8);

    updateHUD();
  }

  function killPad(pad){
    try{
      padAlive.delete(pad);
      pad.removeEventListener('click', onPadHit);
      pad.removeEventListener('mousedown', onPadHit);
    }catch(_){}
    safeRemove(pad);
  }

  function clearPads(){
    padAlive.forEach(p=>safeRemove(p));
    padAlive.clear();
  }

  function onMiss(p){
    combo=0;
    score = Math.max(0, score-4);
    play(SFX.miss);
    floatText('MISS','#ff5577', p || new THREE.Vector3(0, PAD_HIT_Y,-2.2));
    updateHUD();
  }

  // ---------- Flow ----------
  function playerHit(){
    // ใช้ตอนพลาดจากแพทเทิร์นบอส
    onMiss(new THREE.Vector3(0, PAD_HIT_Y,-2.2));
    const scn=document.querySelector('a-scene'); scn?.classList?.add('shake-scene');
    setTimeout(()=>scn?.classList?.remove('shake-scene'), 240);
  }

  function start(){
    if(running) return;
    running=true; paused=false;

    const key=getDiffKey(); D = DIFFS[key] || DIFFS.normal;
    try{ localStorage.setItem('sb_diff', key); }catch(_){}
    padSpeed = D.padSpeed;
    padSpawnInterval = D.padSpawn;

    score=0; combo=0; maxCombo=0; hits=0; spawns=0; timeLeft=60; updateHUD();
    bossShowUI(false);
    clearPads();

    // เวลาเดิน
    timer=setInterval(()=>{ timeLeft--; byId('time').textContent=timeLeft; if(timeLeft<=0) end(); },1000);

    // บอส
    const cfg=ROSTER[0];
    BOSS.active=true; BOSS.busy=false; BOSS.phase=1; BOSS.rage=false;
    BOSS.max=Math.round(cfg.baseHP * D.hp); BOSS.hp=BOSS.max; BOSS.name=cfg.title; BOSS.color=cfg.color;
    bossIntro(); pIndex=0; lastPattern=''; survivedStreak=0;

    // เริ่มสปอว์น Pads
    restartPadTimer();

    // ค่อย ๆ เร่ง: ทุก 4s เพิ่มความเร็ว / ลดช่วงสปอว์น
    lastAccel = performance.now();
    const accelTick = ()=>{
      if(!running) return;
      const now=performance.now();
      if(now - lastAccel >= 4000){
        lastAccel = now;
        padSpeed = clamp(padSpeed + 0.05, 0.45, 1.6);
        padSpawnInterval = clamp(padSpawnInterval - 60, 420, 2400);
        restartPadTimer();
      }
      accelRAF = requestAnimationFrame(accelTick);
    };
    accelTick();

    // ลูปบอส
    setTimeout(bossLoop, dur(900));
  }

  function restartPadTimer(){
    clearInterval(padTimer);
    padTimer = setInterval(spawnPad, padSpawnInterval);
  }

  function end(){
    running=false; paused=false;
    clearInterval(timer); timer=null;
    clearInterval(padTimer); padTimer=null;
    if(accelRAF){ cancelAnimationFrame(accelRAF); accelRAF=null; }
    bossShowUI(false);
    clearPads();

    byId('rScore').textContent = score;
    byId('rMaxCombo').textContent = maxCombo;
    byId('rAcc').textContent = (spawns? Math.round((hits/spawns)*100):0) + '%';
    byId('results').style.display='flex';
    play(SFX.ui);
  }

  function togglePause(){
    if(!running) return;
    paused=!paused;
    if(paused){
      clearInterval(timer); clearInterval(padTimer);
      if(accelRAF){ cancelAnimationFrame(accelRAF); accelRAF=null; }
    }else{
      timer=setInterval(()=>{ timeLeft--; byId('time').textContent=timeLeft; if(timeLeft<=0) end(); },1000);
      restartPadTimer();
      lastAccel = performance.now();
      const accelTick = ()=>{
        if(!running || paused) return;
        const now=performance.now();
        if(now - lastAccel >= 4000){
          lastAccel = now;
          padSpeed = clamp(padSpeed + 0.05, 0.45, 1.6);
          padSpawnInterval = clamp(padSpawnInterval - 60, 420, 2400);
          restartPadTimer();
        }
        accelRAF = requestAnimationFrame(accelTick);
      };
      accelTick();
      bossLoop();
    }
  }

  function hardMiss(anchor){
    playerHit();
    floatText('MISS','#ff5577', anchor?.object3D?.getWorldPosition?.(new THREE.Vector3()) || new THREE.Vector3(0,1.4,-2.2));
  }

  // ---------- Wire buttons ----------
  function wireUI(){
    byId('startBtn')?.addEventListener('click', start);
    byId('pauseBtn')?.addEventListener('click', togglePause);
    byId('replayBtn')?.addEventListener('click', ()=>{ byId('results').style.display='none'; start(); });
    byId('backBtn')?.addEventListener('click', ()=>{ location.href = HUB_URL; });
    addEventListener('keydown', (e)=>{
      if(e.code==='Space'){ e.preventDefault(); if(!running) start(); else togglePause(); }
      if(e.code==='Escape'){ if(running) end(); }
    });
  }

  // ---------- Mouse/Touch raycast: ให้คลิก a-entity โดนแน่ ----------
  function installPointerRaycast(){
    const sceneEl=document.querySelector('a-scene'); if(!sceneEl) return;
    const ray=new THREE.Raycaster(); const mouse=new THREE.Vector2();
    function shoot(clientX, clientY){
      const cam=sceneEl.camera; if(!cam) return;
      mouse.x=(clientX/window.innerWidth)*2-1;
      mouse.y=-(clientY/window.innerHeight)*2+1;
      ray.setFromCamera(mouse,cam);
      const objs=[]; Array.from(document.querySelectorAll('.clickable')).forEach(el=>el.object3D?.traverse(n=>objs.push(n)));
      const hitsArr=ray.intersectObjects(objs,true);
      if(hitsArr?.length){
        let o=hitsArr[0].object; while(o && !o.el) o=o.parent; if(o?.el) o.el.emit('click');
      }
    }
    addEventListener('mousedown',(e)=>shoot(e.clientX,e.clientY),{passive:true});
    addEventListener('touchstart',(e)=>{ const t=e.touches?.[0]; if(!t) return; shoot(t.clientX,t.clientY); },{passive:true});
  }

  // ---------- Boot ----------
  function boot(){
    wireUI();
    installPointerRaycast();
    updateHUD();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  // iOS/Autoplay unlock
  (function unlockAudio(){
    let unlocked=false, Ctx=(window.AudioContext||window.webkitAudioContext); let ctx = Ctx? new Ctx():null;
    function resume(){ if(unlocked||!ctx) return; ctx.resume?.(); unlocked=(ctx.state==='running'); }
    ['touchstart','pointerdown','mousedown','keydown'].forEach(ev=>document.addEventListener(ev,resume,{once:true,passive:true}));
  })();

})();
