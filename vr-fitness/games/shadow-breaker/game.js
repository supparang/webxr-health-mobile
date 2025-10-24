/* games/shadow-breaker/game.js
   Shadow Breaker · โหมด “เป้าอยู่กับที่ ไม่วิ่ง” + คลิกติดแน่
   - เป้าแบบ Punch Pad โผล่อยู่กับที่ (ไม่วิ่ง) ใช้ “จังหวะเวลา” เป็นเกณฑ์กด
   - ฮิตบ็อกซ์ใหญ่ + โปร่งใสช่วยเล็ง (proxy collider)
   - หน้าต่าง PERFECT/GOOD อิงเวลาตรงกลางของอายุเป้า (timing window)
   - Raycast เมาส์/ทัช รอให้กล้องพร้อมก่อน และยิงซ้ำอย่างทนทาน
   - ปุ่ม Start/Pause/End/Back ใช้งานครบ
*/
(function(){
  "use strict";

  // ---------- Helpers ----------
  const byId = (id)=>document.getElementById(id);
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const ASSET_BASE=(document.querySelector('meta[name="asset-base"]')?.content||'').replace(/\/+$/,'');
  const HUB_URL="https://supparang.github.io/webxr-health-mobile/vr-fitness/";

  function safeRemove(el){ try{ if(!el) return; if(el.parentNode) el.parentNode.removeChild(el); else el.remove?.(); }catch(_e){} }
  function now(){ return performance.now(); }

  // ---------- Audio ----------
  const SFX = {
    perfect: new Audio(`${ASSET_BASE}/assets/sfx/perfect.wav`),
    good:    new Audio(`${ASSET_BASE}/assets/sfx/slash.wav`),
    miss:    new Audio(`${ASSET_BASE}/assets/sfx/miss.wav`),
    combo:   new Audio(`${ASSET_BASE}/assets/sfx/combo.wav`),
    ui:      new Audio(`${ASSET_BASE}/assets/sfx/success.wav`),
    roar:    new Audio(`${ASSET_BASE}/assets/sfx/boss_roar.wav`),
    hp_hit:  new Audio(`${ASSET_BASE}/assets/sfx/hp_hit.wav`),
    tel:     new Audio(`${ASSET_BASE}/assets/sfx/tel_guard.wav`)
  };
  Object.values(SFX).forEach(a=>{ try{ a.preload='auto'; a.crossOrigin='anonymous'; }catch(_e){} });
  const lastPlay=new Map();
  function play(a,guardMs=70){ try{ const t=now(); if(lastPlay.get(a)&&t-lastPlay.get(a)<guardMs) return; a.currentTime=0; lastPlay.set(a,t); a.play(); }catch(_e){} }

  // ---------- Difficulty ----------
  const DIFFS = {
    easy:   { hpMul:0.95, title:'EASY',   spawnInt:1100, life:1200, good:220, perfect:110 },
    normal: { hpMul:1.00, title:'NORMAL', spawnInt:950,  life:1050, good:190, perfect:95  },
    hard:   { hpMul:1.15, title:'HARD',   spawnInt:820,  life:950,  good:170, perfect:85  },
  };
  function getDiffKey(){
    return (window.APP?.story?.difficulty) ||
           new URLSearchParams(location.search).get('diff') ||
           localStorage.getItem('sb_diff') || 'normal';
  }
  let D = DIFFS.normal;

  // ---------- Game state ----------
  let running=false, paused=false;
  let score=0, combo=0, maxCombo=0, hits=0, spawns=0, timeLeft=60;
  let timer=null, spawnTimer=null;
  let accelRAF=null, lastAccel=0;

  // Boss (ยังคงมีเพื่อความต่อเนื่องของระบบ)
  const BOSS={active:false, busy:false, hp:0, max:1200, phase:1, name:'RAZORFIST', color:'#ff3355'};

  // ---------- HUD ----------
  function updateHUD(){
    byId('score').textContent = score;
    byId('combo').textContent = combo;
    byId('time').textContent  = timeLeft;
  }

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

  // ---------- Boss UI ----------
  function bossShowUI(show){ const bar=byId('bossBar'); if(bar) bar.style.display=show?'block':'none'; }
  function bossSetHP(h){
    const was=BOSS.hp;
    BOSS.hp = clamp(h,0,BOSS.max);
    const fill=byId('bossHPFill'); if(fill) fill.style.width=((BOSS.hp/BOSS.max)*100)+'%';
    if(BOSS.hp<=0 && was>0){ onBossDefeated(); }
  }
  function bossDamage(amount){
    play(SFX.hp_hit);
    bossSetHP(BOSS.hp - Math.max(1,Math.round(amount)));
  }
  function bossIntro(){
    const arena=byId('arena'); if(!arena) return;
    const anchor=document.createElement('a-entity'); anchor.setAttribute('position','0 1.5 -3'); anchor.id='bossAnchor';
    const head=document.createElement('a-sphere'); head.setAttribute('radius','0.35'); head.setAttribute('color','#1a1a1a');
    const mask=document.createElement('a-box'); mask.setAttribute('depth','0.06'); mask.setAttribute('width','0.55'); mask.setAttribute('height','0.45'); mask.setAttribute('color',BOSS.color); mask.setAttribute('position','0 0 0.25');
    anchor.appendChild(head); anchor.appendChild(mask); arena.appendChild(anchor);
    bossShowUI(true); bossSetHP(BOSS.max); play(SFX.roar);
    const ph=byId('phaseLabel'); if(ph) ph.textContent='Phase 1';
  }
  function onBossDefeated(){
    BOSS.active=false; BOSS.busy=false;
    floatText('BOSS DEFEATED','#00ffa3', new THREE.Vector3(0,1.6,-2.3));
    score += 250; updateHUD(); end();
  }

  // ---------- Punch Pad (STATIC) ----------
  // อยู่กับที่ ใช้เวลาเป็นเกณฑ์: ให้ “กดใกล้จุดกึ่งกลางอายุเป้า” จะได้ PERFECT/GOOD
  const PAD_COLORS = ['#00d0ff','#ffd166','#ff6b6b','#00ffa3','#a899ff','#ff9c6b'];
  const PAD_SIZE = 0.36; // ใหญ่
  const PAD_Y = 1.18;
  const PAD_Z = -2.25;

  let padAlive=new Set();
  function clearPads(){ padAlive.forEach(p=>safeRemove(p)); padAlive.clear(); }

  function spawnPadStatic(){
    if(!running) return;
    spawns++;
    play(SFX.tel);

    const lanes = [-0.95, -0.48, 0, 0.48, 0.95];
    const x = lanes[Math.floor(Math.random()*lanes.length)];
    const color = PAD_COLORS[Math.floor(Math.random()*PAD_COLORS.length)];

    const pad=document.createElement('a-entity');
    pad.classList.add('clickable','sb-pad');
    pad.setAttribute('geometry', `primitive: circle; radius:${PAD_SIZE}`);
    pad.setAttribute('material', `color:${color}; opacity:.96; transparent:true; metalness:.05; roughness:.45`);
    pad.setAttribute('position', `${x} ${PAD_Y} ${PAD_Z}`);

    // เอฟเฟกต์ “pulse” บอกจังหวะ: ให้วัดเวลาได้ง่าย
    pad.setAttribute('animation__pulse','property: scale; dir: alternate; to: 1.15 1.15 1.15; loop: true; dur: 360; easing: easeInOutSine');

    // วงแหวนจับเวลา (countdown ring) – ค่อย ๆ หนา→บาง
    const ring=document.createElement('a-entity');
    ring.setAttribute('geometry', `primitive: ring; radiusInner:${PAD_SIZE*0.78}; radiusOuter:${PAD_SIZE*1.12}`);
    ring.setAttribute('material', `color:#ffffff; opacity:.35; transparent:true`);
    pad.appendChild(ring);

    // Proxy collider โปร่งใส ใหญ่กว่าปกติ (คลิกติดง่าย)
    const proxy=document.createElement('a-circle');
    proxy.classList.add('clickable');
    proxy.setAttribute('radius', PAD_SIZE*1.35);
    proxy.setAttribute('material','color:#fff;opacity:0.001;transparent:true');
    proxy.setAttribute('position','0 0 0.003');
    pad.appendChild(proxy);

    byId('arena').appendChild(pad);
    padAlive.add(pad);

    // อายุเป้า + หน้าต่าง PERFECT/GOOD
    const LIFE = D.life;                 // อายุทั้งหมดของ pad (ms)
    const MID  = LIFE * 0.60;            // “จุดกึ่งกลาง” ที่ควรกด
    const WIN_P = D.perfect;             // perfect window (+/- ms)
    const WIN_G = D.good;                // good window (+/- ms)

    const born = now();
    let dead=false;

    // คลิก/แตะ
    const hit = ()=>onPadHitTime(pad, born, MID, WIN_P, WIN_G);
    pad.addEventListener('click', hit); proxy.addEventListener('click', hit);
    pad.addEventListener('mousedown', hit); proxy.addEventListener('mousedown', hit);
    pad.addEventListener('touchstart', hit, {passive:true});

    // อัปเดตวงแหวนให้เห็น countdown
    (function tick(){
      if(dead || !pad.parentNode) return;
      const t = now() - born;
      const k = clamp(1 - t/LIFE, 0, 1); // 1 → 0
      const ri = PAD_SIZE*0.78;
      const ro = PAD_SIZE*1.12 * (0.6 + 0.4*k); // เล็กลงเรื่อย ๆ
      ring.setAttribute('geometry', `primitive: ring; radiusInner:${ri}; radiusOuter:${ro}`);
      if(t >= LIFE){
        dead=true; killPad(pad); onMiss(new THREE.Vector3(x, PAD_Y, PAD_Z));
        return;
      }
      requestAnimationFrame(tick);
    })();
  }

  function onPadHitTime(pad, born, MID, WIN_P, WIN_G){
    if(!running) return;
    if(pad.dataset.done==='1') return;
    pad.dataset.done='1';

    const t = now() - born;
    const dt = Math.abs(t - MID);

    // ตัดสินคุณภาพจากเวลา
    let q='miss';
    if(dt <= WIN_P) q='perfect';
    else if(dt <= WIN_G) q='good';

    const p = pad.object3D.getWorldPosition(new THREE.Vector3());
    killPad(pad);

    if(q==='miss'){ onMiss(p); return; }

    hits++; combo++; maxCombo=Math.max(maxCombo,combo);
    score += (q==='perfect'? 20 : 12);
    (q==='perfect'? SFX.perfect : SFX.good).play();
    floatText(q.toUpperCase(), q==='perfect'?'#00ffa3':'#00d0ff', p);
    if(combo>0 && combo%10===0) play(SFX.combo);

    // ทำดาเมจบอสเล็กน้อยให้มีฟีดแบ็กต่อเนื่อง
    bossDamage(q==='perfect'? 16 : 10);
    updateHUD();
  }

  function killPad(pad){
    try{
      padAlive.delete(pad);
      pad.replaceWith(pad.cloneNode(false)); // remove listeners ชั่วพริบตา
    }catch(_){}
    safeRemove(pad);
  }

  function onMiss(p){
    combo=0;
    score = Math.max(0, score-4);
    play(SFX.miss);
    floatText('MISS', '#ff5577', p || new THREE.Vector3(0, PAD_Y, PAD_Z));
    updateHUD();
  }

  // ---------- Flow ----------
  function start(){
    if(running) return;
    running=true; paused=false;

    const key = getDiffKey(); D = DIFFS[key] || DIFFS.normal;
    try{ localStorage.setItem('sb_diff', key); }catch(_){}
    score=0; combo=0; maxCombo=0; hits=0; spawns=0; timeLeft=60; updateHUD();

    // Boss init
    BOSS.active=true; BOSS.busy=false; BOSS.phase=1; BOSS.max = Math.round(1200 * D.hpMul); BOSS.hp=BOSS.max;
    bossIntro();

    // เวลานับถอยหลังเกม
    timer = setInterval(()=>{ timeLeft--; byId('time').textContent=timeLeft; if(timeLeft<=0) end(); }, 1000);

    // สปอว์น “เป้าอยู่กับที่” เรื่อย ๆ
    clearPads();
    spawnPadStatic();
    spawnTimer = setInterval(spawnPadStatic, D.spawnInt);

    // ค่อย ๆ เร่ง (สั้น ๆ แค่ให้ถี่ขึ้นนิดหน่อย)
    lastAccel = now();
    const accelTick = ()=>{
      if(!running) return;
      const t=now();
      if(t-lastAccel>=5000){
        lastAccel=t;
        const next = clamp(D.spawnInt - 40, 600, 2000);
        if(next !== D.spawnInt){
          D.spawnInt = next;
          clearInterval(spawnTimer);
          spawnTimer = setInterval(spawnPadStatic, D.spawnInt);
        }
      }
      accelRAF = requestAnimationFrame(accelTick);
    };
    accelTick();
  }

  function end(){
    running=false; paused=false;
    clearInterval(timer); timer=null;
    clearInterval(spawnTimer); spawnTimer=null;
    if(accelRAF){ cancelAnimationFrame(accelRAF); accelRAF=null; }
    clearPads();
    bossShowUI(false);

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
      clearInterval(timer); clearInterval(spawnTimer);
      if(accelRAF){ cancelAnimationFrame(accelRAF); accelRAF=null; }
    }else{
      timer = setInterval(()=>{ timeLeft--; byId('time').textContent=timeLeft; if(timeLeft<=0) end(); }, 1000);
      spawnTimer = setInterval(spawnPadStatic, D.spawnInt);
      lastAccel = now();
      const accelTick = ()=>{
        if(!running || paused) return;
        const t=now();
        if(t-lastAccel>=5000){
          lastAccel=t;
          const next = clamp(D.spawnInt - 40, 600, 2000);
          if(next !== D.spawnInt){
            D.spawnInt = next;
            clearInterval(spawnTimer);
            spawnTimer = setInterval(spawnPadStatic, D.spawnInt);
          }
        }
        accelRAF = requestAnimationFrame(accelTick);
      };
      accelTick();
    }
  }

  // ---------- Pointer Raycast (mouse/touch) ----------
  function installPointerRaycast(){
    const sceneEl=document.querySelector('a-scene'); if(!sceneEl) return;
    const ray=new THREE.Raycaster(); const mouse=new THREE.Vector2();
    let cam=null, sceneReady=false;

    function ensureCam(){ cam = sceneEl.camera || cam; return !!cam; }
    if(sceneEl.hasLoaded || sceneEl.renderer){ sceneReady=true; ensureCam(); }
    else sceneEl.addEventListener('loaded', ()=>{ sceneReady=true; ensureCam(); });

    function shoot(clientX, clientY){
      if(!sceneReady || !ensureCam()) return;
      mouse.x=(clientX/window.innerWidth)*2-1;
      mouse.y=-(clientY/window.innerHeight)*2+1;
      ray.setFromCamera(mouse, cam);

      const objs=[];
      Array.from(document.querySelectorAll('.clickable')).forEach(el=>el.object3D?.traverse(n=>objs.push(n)));
      const hitsArr=ray.intersectObjects(objs,true);
      if(hitsArr?.length){
        let i=0; // เลือกตัวแรกที่มี el
        while(i<hitsArr.length){
          let o=hitsArr[i].object;
          while(o && !o.el) o=o.parent;
          if(o?.el){ o.el.emit('click'); break; }
          i++;
        }
      }
    }

    addEventListener('mousedown',(e)=>shoot(e.clientX,e.clientY),{passive:true});
    addEventListener('touchstart',(e)=>{ const t=e.touches?.[0]; if(!t) return; shoot(t.clientX,t.clientY); },{passive:true});
  }

  // ---------- Wire UI ----------
  function wireUI(){
    byId('startBtn')?.addEventListener('click', start);
    byId('pauseBtn')?.addEventListener('click', togglePause);
    byId('replayBtn')?.addEventListener('click', ()=>{ byId('results').style.display='none'; start(); });
    byId('backBtn')?.addEventListener('click', ()=>{ location.href = HUB_URL; });

    // คีย์ลัด
    addEventListener('keydown',(e)=>{
      if(e.code==='Space'){ e.preventDefault(); if(!running) start(); else togglePause(); }
      if(e.code==='Escape'){ if(running) end(); }
    });
  }

  // ---------- Boot ----------
  function boot(){
    const key=getDiffKey(); D = DIFFS[key] || DIFFS.normal;
    updateHUD(); bossShowUI(false);
    wireUI(); installPointerRaycast();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  // iOS/Autoplay unlock
  (function unlockAudio(){
    let unlocked=false, Ctx=(window.AudioContext||window.webkitAudioContext), ctx=Ctx? new Ctx():null;
    function resume(){ if(unlocked||!ctx) return; ctx.resume?.(); unlocked = (ctx.state==='running'); }
    ['touchstart','pointerdown','mousedown','keydown'].forEach(ev=>document.addEventListener(ev,resume,{once:true,passive:true}));
  })();

})();
