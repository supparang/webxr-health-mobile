/* games/shadow-breaker/game.js
   Shadow Breaker · Boss Action + Punch Pads (อยู่กับที่) + รูปทรงหลากหลาย + บอมบ์/เพชร/ดาบ/วงแหวน
   + โค้ช (Coach) มุมซ้ายล่าง ไม่บังปุ่ม — ให้คำแนะนำสั้น ๆ ตามสถานการณ์
*/
(function(){
  "use strict";

  // ---------- Helpers ----------
  const byId = (id)=>document.getElementById(id);
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const ASSET_BASE=(document.querySelector('meta[name="asset-base"]')?.content||'').replace(/\/+$/,'');
  const HUB_URL="https://supparang.github.io/webxr-health-mobile/vr-fitness/";
  const now = ()=>performance.now();
  function safeRemove(el){ try{ if(!el) return; if(el.parentNode) el.parentNode.removeChild(el); else el.remove?.(); }catch(_e){} }

  // ---------- Audio ----------
  const SFX = {
    perfect: new Audio(`${ASSET_BASE}/assets/sfx/perfect.wav`),
    good:    new Audio(`${ASSET_BASE}/assets/sfx/slash.wav`),
    miss:    new Audio(`${ASSET_BASE}/assets/sfx/miss.wav`),
    combo:   new Audio(`${ASSET_BASE}/assets/sfx/combo.wav`),
    ui:      new Audio(`${ASSET_BASE}/assets/sfx/success.wav`),
    roar:    new Audio(`${ASSET_BASE}/assets/sfx/boss_roar.wav`),
    hp_hit:  new Audio(`${ASSET_BASE}/assets/sfx/hp_hit.wav`),
    telA:    new Audio(`${ASSET_BASE}/assets/sfx/tel_guard.wav`),
    telB:    new Audio(`${ASSET_BASE}/assets/sfx/tel_slash.wav`),
    boom:    new Audio(`${ASSET_BASE}/assets/sfx/enrage.wav`)
  };
  Object.values(SFX).forEach(a=>{ try{ a.preload='auto'; a.crossOrigin='anonymous'; }catch(_e){} });
  const lastPlay=new Map();
  function play(a,guardMs=80){ try{ const t=now(); if(lastPlay.get(a)&&t-lastPlay.get(a)<guardMs) return; a.currentTime=0; lastPlay.set(a,t); a.play(); }catch(_e){} }

  // ---------- Difficulty ----------
  const DIFFS = {
    easy:   { hpMul:0.95, title:'EASY',   spawnInt:1150, life:1200, good:230, perfect:120, bossGap:1200 },
    normal: { hpMul:1.00, title:'NORMAL', spawnInt:980,  life:1050, good:200, perfect:100, bossGap:1050 },
    hard:   { hpMul:1.15, title:'HARD',   spawnInt:860,  life:950,  good:180, perfect:90,  bossGap:900  },
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
  let timer=null, spawnTimer=null, bossTimer=null;
  let accelRAF=null, lastAccel=0;

  // Boss
  const BOSS={active:false, busy:false, hp:0, max:1200, phase:1, name:'RAZORFIST', color:'#ff3355'};

  // ---------- Coach ----------
  let coachBox=null, coachTimer=null, coachMuteUntil=0;
  const coachState = {
    ringMissStreak:0,
    slashMissStreak:0,
    bombHitStreak:0,
    padLateStreak:0,
    lastTip:"",
  };
  function installCoach(){
    if(coachBox) return;
    coachBox = document.createElement('div');
    coachBox.id='coachBox';
    Object.assign(coachBox.style,{
      position:'fixed', left:'12px', bottom:'12px', zIndex:9999,
      maxWidth:'52vw', color:'#e6f7ff', background:'rgba(10,16,22,.55)',
      padding:'8px 10px', borderRadius:'12px', font:'600 13px/1.35 system-ui,Arial',
      boxShadow:'0 6px 18px rgba(0,0,0,.25)', backdropFilter:'blur(4px)',
      pointerEvents:'none',  // สำคัญ: ไม่บังการคลิกเกม
      opacity:'0', transition:'opacity .2s ease'
    });
    document.body.appendChild(coachBox);
  }
  function coachSay(msg, time=1300){
    if(!coachBox) installCoach();
    const t=now();
    if(t<coachMuteUntil) return;        // กันสแปม
    if(msg===coachState.lastTip && t<(coachMuteUntil-400)) return;
    coachState.lastTip = msg;
    coachBox.textContent = '🗣️ ' + msg;
    coachBox.style.opacity='1';
    clearTimeout(coachTimer);
    coachTimer = setTimeout(()=>{ coachBox.style.opacity='0'; }, time);
    coachMuteUntil = t + Math.max(1000, time);
  }
  function coachOnStart(){ coachSay('เริ่มช้า ๆ โฟกัสที่วง HIT ขาวก่อน!', 1600); }
  function coachOnCombo(n){
    if(n===10) coachSay('ดีมาก! จังหวะกำลังมา 💥');
    if(n===25) coachSay('เฟิร์ม! คอมโบแรง จงรักษารีธึ่มไว้! 🔥', 1500);
    if(n===50) coachSay('สุดยอด! คุณคุมเกมได้แล้ว! ⚡', 1500);
  }
  function coachOnMissType(type, late=false){
    if(type==='ring'){ coachState.ringMissStreak++; if(coachState.ringMissStreak>=3) coachSay('เคล็ดลับวงแหวน: แตะก่อนถึงขอบสุด ~0.6 วิจากเกิด'); }
    else coachState.ringMissStreak=0;

    if(type==='slash'){ coachState.slashMissStreak++; if(coachState.slashMissStreak>=3) coachSay('Parry ดาบ: รอให้คานแสงนิ่งแล้วแตะเร็ว ๆ'); }
    else coachState.slashMissStreak=0;

    if(type==='bomb'){ coachState.bombHitStreak++; if(coachState.bombHitStreak>=2) coachSay('ลูกบอลแดง = ห้ามแตะ! หลบแล้วรางวัลจะตามมา'); }
    else coachState.bombHitStreak=0;

    if(late){ coachState.padLateStreak++; if(coachState.padLateStreak>=3) coachSay('ช้าไปนิด! ลองแตะเร็วกว่าที่เคย ~0.1-0.2 วิ'); }
    else coachState.padLateStreak=0;
  }

  // ---------- HUD ----------
  function updateHUD(){
    byId('score') && (byId('score').textContent = score);
    byId('combo') && (byId('combo').textContent = combo);
    byId('time')  && (byId('time').textContent  = timeLeft);
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
    play(SFX.hp_hit); bossSetHP(BOSS.hp - Math.max(1,Math.round(amount)));
  }
  function bossIntro(){
    const arena=byId('arena'); if(!arena) return;
    const anchor=document.createElement('a-entity'); anchor.setAttribute('position','0 1.5 -3'); anchor.id='bossAnchor';
    const head=document.createElement('a-sphere'); head.setAttribute('radius','0.35'); head.setAttribute('color','#1a1a1a');
    const mask=document.createElement('a-box'); mask.setAttribute('depth','0.06'); mask.setAttribute('width','0.55'); mask.setAttribute('height','0.45'); mask.setAttribute('color',BOSS.color); mask.setAttribute('position','0 0 0.25');
    anchor.appendChild(head); anchor.appendChild(mask); arena.appendChild(anchor);
    bossShowUI(true); bossSetHP(BOSS.max); play(SFX.roar);
    byId('phaseLabel') && (byId('phaseLabel').textContent='Phase 1');
  }
  function onBossDefeated(){
    BOSS.active=false; BOSS.busy=false;
    floatText('BOSS DEFEATED','#00ffa3', new THREE.Vector3(0,1.6,-2.3));
    score += 250; updateHUD(); end();
  }

  // ---------- Punch Pads (อยู่กับที่ / รูปทรงหลากหลาย) ----------
  const COLORS = ['#00d0ff','#ffd166','#ff6b6b','#00ffa3','#a899ff','#ff9c6b','#8cf5ff'];
  const PAD_Y = 1.18, PAD_Z = -2.25;
  const LANES = [-0.95, -0.48, 0, 0.48, 0.95];
  let padAlive=new Set();
  function clearPads(){ padAlive.forEach(p=>safeRemove(p)); padAlive.clear(); }

  // สร้างเป้ารูปทรงต่าง ๆ
  function makeShape(type,size,color){
    const el=document.createElement('a-entity');
    if(type==='circle'){
      el.setAttribute('geometry', `primitive: circle; radius:${size}`);
      el.setAttribute('material', `color:${color}; opacity:.96; transparent:true; metalness:.05; roughness:.45`);
    } else if(type==='box'){
      const s=size*1.8;
      const b=document.createElement('a-box');
      b.setAttribute('width',s); b.setAttribute('height',s); b.setAttribute('depth',0.04);
      b.setAttribute('color',color);
      el.appendChild(b);
    } else if(type==='triangle'){
      const t=document.createElement('a-triangle');
      const s=size*1.9;
      t.setAttribute('vertex-a',`${-s/2} ${-s/2} 0`);
      t.setAttribute('vertex-b',`${0} ${s/2} 0`);
      t.setAttribute('vertex-c',`${s/2} ${-s/2} 0`);
      t.setAttribute('material',`color:${color}; opacity:.96; side:double`);
      el.appendChild(t);
    } else if(type==='pentagon' || type==='hexagon'){
      const seg = (type==='pentagon')?5:6;
      const c=document.createElement('a-entity');
      c.setAttribute('geometry', `primitive: cylinder; radius:${size*1.15}; height:0.02; segmentsRadial:${seg}`);
      c.setAttribute('material', `color:${color}; metalness:.05; roughness:.45`);
      c.setAttribute('rotation','90 0 0');
      el.appendChild(c);
    }
    return el;
  }

  function spawnPadStatic(){
    if(!running) return;
    spawns++;
    play(SFX.telA);

    const x = LANES[Math.floor(Math.random()*LANES.length)];
    const color = COLORS[Math.floor(Math.random()*COLORS.length)];
    const shapes=['circle','box','triangle','pentagon','hexagon'];
    const type=shapes[Math.floor(Math.random()*shapes.length)];
    const size = 0.36;

    const pad=document.createElement('a-entity');
    pad.classList.add('clickable','sb-pad');
    pad.setAttribute('position', `${x} ${PAD_Y} ${PAD_Z}`);

    const visual = makeShape(type,size,color);
    visual.setAttribute('animation__pulse','property: scale; dir: alternate; to: 1.13 1.13 1.13; loop: true; dur: 340; easing: easeInOutSine');
    pad.appendChild(visual);

    // Proxy collider (วงกลมใส) ให้กดง่าย
    const proxy=document.createElement('a-circle');
    proxy.classList.add('clickable');
    proxy.setAttribute('radius', size*1.35);
    proxy.setAttribute('material','color:#fff;opacity:0.001;transparent:true');
    proxy.setAttribute('position','0 0 0.003');
    pad.appendChild(proxy);

    byId('arena').appendChild(pad);
    padAlive.add(pad);

    // อายุ + timing window
    const LIFE = D.life, MID=LIFE*0.60, WIN_P=D.perfect, WIN_G=D.good;
    const born=now(); let dead=false;

    const hit = ()=>onPadHitTime(pad, born, MID, WIN_P, WIN_G);
    pad.addEventListener('click', hit); proxy.addEventListener('click', hit);
    pad.addEventListener('mousedown', hit); proxy.addEventListener('mousedown', hit);
    pad.addEventListener('touchstart', hit, {passive:true});

    // วงแหวนบอกเวลา (เล็กลง)
    const ring=document.createElement('a-entity');
    ring.setAttribute('geometry', `primitive: ring; radiusInner:${size*0.78}; radiusOuter:${size*1.12}`);
    ring.setAttribute('material', `color:#ffffff; opacity:.35; transparent:true`);
    pad.appendChild(ring);

    (function tick(){
      if(dead || !pad.parentNode) return;
      const t = now() - born;
      const k = clamp(1 - t/LIFE, 0, 1);
      const ri = size*0.78;
      const ro = size*1.12 * (0.6 + 0.4*k);
      ring.setAttribute('geometry', `primitive: ring; radiusInner:${ri}; radiusOuter:${ro}`);
      if(t >= LIFE){
        dead=true; killPad(pad); onMiss(new THREE.Vector3(x, PAD_Y, PAD_Z), 'pad', /*late*/true); return;
      }
      requestAnimationFrame(tick);
    })();
  }
  function onPadHitTime(pad,born,MID,WIN_P,WIN_G){
    if(!running) return;
    if(pad.dataset.done==='1') return; pad.dataset.done='1';
    const t=now()-born, dt=Math.abs(t-MID);
    let q='miss'; if(dt<=WIN_P) q='perfect'; else if(dt<=WIN_G) q='good';
    const p = pad.object3D.getWorldPosition(new THREE.Vector3());
    const late = (t>MID);
    killPad(pad);
    if(q==='miss'){ onMiss(p,'pad',late); return; }
    hits++; combo++; maxCombo=Math.max(maxCombo,combo);
    score += (q==='perfect'? 20 : 12);
    play(q==='perfect'?SFX.perfect:SFX.good);
    floatText(q.toUpperCase(), q==='perfect'?'#00ffa3':'#00d0ff', p);
    if(combo>0 && combo%10===0) play(SFX.combo);
    bossDamage(q==='perfect'?16:10);
    updateHUD();
    coachOnCombo(combo);
  }
  function killPad(pad){ try{ padAlive.delete(pad); pad.replaceWith(pad.cloneNode(false)); }catch(_){}
    safeRemove(pad); }
  function onMiss(p, type='pad', late=false){
    combo=0; score=Math.max(0,score-4);
    play(SFX.miss); floatText('MISS','#ff5577', p||new THREE.Vector3(0,PAD_Y,PAD_Z)); updateHUD();
    const sc=document.querySelector('a-scene'); if(sc){ sc.classList.add('shake-scene'); setTimeout(()=>sc.classList.remove('shake-scene'), 240); }
    coachOnMissType(type, late);
  }

  // ---------- Boss Patterns ----------
  function bossLoop(){
    if(!running || !BOSS.active || BOSS.busy) return;
    BOSS.busy=true;
    const roll=Math.random();
    if(roll < 0.30) doRingExpand(()=>done());
    else if(roll < 0.58) doSwordSlash(()=>done());
    else if(roll < 0.78) doDiamond(()=>done());
    else doBomb(()=>done());
    function done(){ BOSS.busy=false; }
  }

  // วงแหวนขยาย: กดแตกก่อนถึงขอบสุด
  function doRingExpand(done){
    play(SFX.telA);
    const x = LANES[Math.floor(Math.random()*LANES.length)], y=1.15, z=-2.6;
    const ring=document.createElement('a-ring');
    ring.classList.add('clickable','boss-attack');
    ring.setAttribute('position',`${x} ${y} ${z}`);
    ring.setAttribute('radius-inner','0.05'); ring.setAttribute('radius-outer','0.07');
    ring.setAttribute('material','color:#ffd166;opacity:.95;shader:flat');
    byId('arena').appendChild(ring);
    const born=now(), LIFE=720;
    let doneFlag=false;
    const hit=()=>{ if(doneFlag) return; doneFlag=true;
      const p=ring.object3D.getWorldPosition(new THREE.Vector3());
      floatText('BREAK','#ffd166',p); bossDamage(18); safeRemove(ring); done(); };
    ring.addEventListener('click',hit); ring.addEventListener('mousedown',hit); ring.addEventListener('touchstart',hit,{passive:true});
    (function step(){
      if(!ring.parentNode) return;
      const t=now()-born; const base=0.07+(t/LIFE)*0.95;
      ring.setAttribute('radius-inner',Math.max(0.01,base-0.02));
      ring.setAttribute('radius-outer',base);
      if(t>=LIFE){ if(ring.parentNode){ safeRemove(ring); onMiss(new THREE.Vector3(x,y,z),'ring'); } return done(); }
      requestAnimationFrame(step);
    })();
  }

  // ดาบฟาด: คานแสงต้องกดให้ทันเป็น Parry
  function doSwordSlash(done){
    play(SFX.telB);
    const rot = (-40 + Math.random()*80)|0, y=1.38;
    const slash=document.createElement('a-entity');
    slash.classList.add('clickable','boss-attack');
    slash.setAttribute('geometry','primitive: box; height:0.04; width:1.25; depth:0.04');
    slash.setAttribute('material','color:#5de1ff;opacity:.95;transparent:true');
    slash.setAttribute('rotation',`0 0 ${rot}`); slash.setAttribute('position',`0 ${y} -2.2`);
    byId('arena').appendChild(slash);
    let ok=false;
    const hit=()=>{ if(ok) return; ok=true;
      floatText('PARRY','#00ffa3', slash.object3D.getWorldPosition(new THREE.Vector3()));
      bossDamage(22); safeRemove(slash); done(); };
    slash.addEventListener('click',hit); slash.addEventListener('mousedown',hit); slash.addEventListener('touchstart',hit,{passive:true});
    setTimeout(()=>{ if(slash.parentNode){ safeRemove(slash); if(!ok) onMiss(new THREE.Vector3(0,y,-2.2),'slash'); } done(); }, 560);
  }

  // เพชร CRIT
  function doDiamond(done){
    const g=document.createElement('a-icosahedron');
    g.classList.add('clickable','boss-attack');
    g.setAttribute('position','0 1.6 -2.4'); g.setAttribute('radius','0.18'); g.setAttribute('color','#00ffa3');
    byId('arena').appendChild(g);
    const hit=()=>{ const p=g.object3D.getWorldPosition(new THREE.Vector3());
      floatText('CRITICAL +60','#00ffa3', p); score+=40; bossDamage(60); updateHUD(); safeRemove(g); done(); };
    g.addEventListener('click',hit); g.addEventListener('mousedown',hit); g.addEventListener('touchstart',hit,{passive:true});
    setTimeout(()=>{ if(g.parentNode) safeRemove(g); done(); }, 800);
  }

  // ระเบิด: ห้ามกด ถ้ากดลบคะแนน/คอมโบและสั่น
  function doBomb(done){
    play(SFX.boom);
    const x = LANES[Math.floor(Math.random()*LANES.length)];
    const b=document.createElement('a-sphere');
    b.classList.add('clickable','boss-attack');
    b.setAttribute('position',`${x} 1.2 -2.3`); b.setAttribute('radius','0.16'); b.setAttribute('color','#ff3355');
    b.setAttribute('animation__pulse','property: scale; dir: alternate; to: 1.25 1.25 1.25; loop: true; dur: 290; easing: easeInOutSine');
    byId('arena').appendChild(b);
    const punish=()=>{ if(!b.parentNode) return;
      floatText('BOMB! -10','#ff5577', b.object3D.getWorldPosition(new THREE.Vector3()));
      combo=0; score=Math.max(0,score-10); updateHUD(); safeRemove(b);
      const sc=document.querySelector('a-scene'); if(sc){ sc.classList.add('shake-scene'); setTimeout(()=>sc.classList.remove('shake-scene'), 360); }
      coachOnMissType('bomb', false);
      done();
    };
    b.addEventListener('click',punish); b.addEventListener('mousedown',punish); b.addEventListener('touchstart',punish,{passive:true});
    setTimeout(()=>{ if(b.parentNode) safeRemove(b); done(); }, 900);
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

    // เวลาเกม
    timer = setInterval(()=>{ timeLeft--; byId('time').textContent=timeLeft; if(timeLeft<=0) end(); }, 1000);

    // เป้า (เริ่มช้า → ค่อยถี่)
    clearPads();
    spawnPadStatic();
    spawnTimer = setInterval(spawnPadStatic, D.spawnInt);
    lastAccel = now();
    const accelTick = ()=>{
      if(!running) return;
      const t=now();
      if(t-lastAccel>=5000){
        lastAccel=t;
        const next = clamp(D.spawnInt - 40, 600, 2400);
        if(next !== D.spawnInt){
          D.spawnInt = next;
          clearInterval(spawnTimer);
          spawnTimer = setInterval(spawnPadStatic, D.spawnInt);
        }
      }
      accelRAF = requestAnimationFrame(accelTick);
    };
    accelTick();

    // Boss pattern loop
    bossTimer = setInterval(bossLoop, D.bossGap);

    // Coach
    coachOnStart();
  }

  function end(){
    running=false; paused=false;
    clearInterval(timer); timer=null;
    clearInterval(spawnTimer); spawnTimer=null;
    clearInterval(bossTimer); bossTimer=null;
    if(accelRAF){ cancelAnimationFrame(accelRAF); accelRAF=null; }
    clearPads(); bossShowUI(false);

    byId('rScore') && (byId('rScore').textContent = score);
    byId('rMaxCombo') && (byId('rMaxCombo').textContent = maxCombo);
    byId('rAcc') && (byId('rAcc').textContent = (spawns? Math.round((hits/spawns)*100):0) + '%');
    byId('results') && (byId('results').style.display='flex');
    play(SFX.ui);
    coachSay('สรุปผลออกแล้ว ลองรีเพลย์เพื่อแก้จุดพลาดเมื่อกี้!', 1600);
  }

  function togglePause(){
    if(!running) return;
    paused=!paused;
    if(paused){
      clearInterval(timer); clearInterval(spawnTimer); clearInterval(bossTimer);
      if(accelRAF){ cancelAnimationFrame(accelRAF); accelRAF=null; }
      coachSay('พักหายใจสั้น ๆ แล้วไปต่อ!', 1000);
    }else{
      timer = setInterval(()=>{ timeLeft--; byId('time').textContent=timeLeft; if(timeLeft<=0) end(); }, 1000);
      spawnTimer = setInterval(spawnPadStatic, D.spawnInt);
      bossTimer = setInterval(bossLoop, D.bossGap);
      lastAccel = now();
      const accelTick = ()=>{
        if(!running || paused) return;
        const t=now();
        if(t-lastAccel>=5000){
          lastAccel=t;
          const next = clamp(D.spawnInt - 40, 600, 2400);
          if(next !== D.spawnInt){
            D.spawnInt = next;
            clearInterval(spawnTimer);
            spawnTimer = setInterval(spawnPadStatic, D.spawnInt);
          }
        }
        accelRAF = requestAnimationFrame(accelTick);
      };
      accelTick();
      coachSay('ลุยต่อ!', 800);
    }
  }

  // ---------- Pointer Raycast ----------
  function installPointerRaycast(){
    const sceneEl=document.querySelector('a-scene'); if(!sceneEl) return;
    const ray=new THREE.Raycaster(); const mouse=new THREE.Vector2();
    let cam=null, sceneReady=false;
    function ensureCam(){ cam = sceneEl.camera || cam; return !!cam; }
    if(sceneEl.hasLoaded || sceneEl.renderer){ sceneReady=true; ensureCam(); }
    else sceneEl.addEventListener('loaded', ()=>{ sceneReady=true; ensureCam(); });
    function shoot(clientX, clientY){
      if(!sceneReady || !ensureCam()) return;
      mouse.x=(clientX/window.innerWidth)*2-1; mouse.y=-(clientY/window.innerHeight)*2+1;
      ray.setFromCamera(mouse, cam);
      const objs=[]; Array.from(document.querySelectorAll('.clickable')).forEach(el=>el.object3D?.traverse(n=>objs.push(n)));
      const hitsArr=ray.intersectObjects(objs,true);
      if(hitsArr?.length){
        for(let i=0;i<hitsArr.length;i++){
          let o=hitsArr[i].object; while(o && !o.el) o=o.parent;
          if(o?.el){ o.el.emit('click'); break; }
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
    addEventListener('keydown',(e)=>{
      if(e.code==='Space'){ e.preventDefault(); if(!running) start(); else togglePause(); }
      if(e.code==='Escape'){ if(running) end(); }
    });
  }

  // ---------- Boot ----------
  function boot(){
    const key=getDiffKey(); D = DIFFS[key] || DIFFS.normal;
    updateHUD(); bossShowUI(false);
    installCoach(); wireUI(); installPointerRaycast();
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
