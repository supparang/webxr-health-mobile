/* games/shadow-breaker/game.js
   Shadow Breaker (Classic feel kept) + Punch Pads (Circle/Triangle/Square/Pentagon/Hexagon/Diamond/Bomb)
   - ไม่หักคะแนนจากการไม่กด
   - Bomb = เมื่อ "กด" จะตัดคอมโบทันที (ไม่มีลดสกอร์)
   - ผลสรุปท้ายเกม: ให้ดาว 5 ระดับ (★ 0–5)
*/
(function(){
  "use strict";

  // ------------------ Helpers & Globals ------------------
  const byId = (id)=>document.getElementById(id);
  const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));
  const HUB_URL = "https://supparang.github.io/webxr-health-mobile/vr-fitness/";
  const ASSET_BASE = (document.querySelector('meta[name="asset-base"]')?.content || '').replace(/\/+$/,'');

  // Feature switches
  const FX = {
    pacingSmooth:    true,
    pointerHitBoost: true,
    sfxNormalize:    true,
    hudReadable:     true,
    gentleCurve:     true,
    fairScheduler:   true,
    comboBadges:     true,
    feverMode:       true,
    accessibility:   true,
    richResults:     true,
    coachTips:       true,
    safetyCleanup:   true
  };

  function safeRemove(el){ try{
    if(!el) return;
    if(!el.isConnected && !el.parentNode) return;
    if(el.parentNode) el.parentNode.removeChild(el);
    else if(el.remove) el.remove();
  }catch(_e){} }

  // ------------------ SFX ------------------
  const SFX = {
    slash:     new Audio(`${ASSET_BASE}/assets/sfx/slash.wav`),
    perfect:   new Audio(`${ASSET_BASE}/assets/sfx/perfect.wav`),
    miss:      new Audio(`${ASSET_BASE}/assets/sfx/miss.wav`),
    heavy:     new Audio(`${ASSET_BASE}/assets/sfx/heavy.wav`),
    combo:     new Audio(`${ASSET_BASE}/assets/sfx/combo.wav`),
    hp_hit:    new Audio(`${ASSET_BASE}/assets/sfx/hp_hit.wav`),
    boss_roar: new Audio(`${ASSET_BASE}/assets/sfx/boss_roar.wav`),
    tel_slash: new Audio(`${ASSET_BASE}/assets/sfx/tel_slash.wav`),
    tel_shock: new Audio(`${ASSET_BASE}/assets/sfx/tel_shock.wav`),
    success:   new Audio(`${ASSET_BASE}/assets/sfx/success.wav`),
    ui:        new Audio(`${ASSET_BASE}/assets/sfx/success.wav`),
    boom:      new Audio(`${ASSET_BASE}/assets/sfx/miss.wav`)
  };
  Object.values(SFX).forEach(a=>{ try{ a.preload='auto'; a.crossOrigin='anonymous'; }catch(_){} });

  const _sfxLastPlay = new Map();
  function playSfx(a, guardMs=120, vol=1){
    try{
      const now=performance.now();
      if(_sfxLastPlay.get(a) && now - _sfxLastPlay.get(a) < guardMs) return;
      _sfxLastPlay.set(a, now);
      a.volume = vol;
      a.currentTime=0; a.play();
    }catch(_){}
  }
  function sfxPlay(a, guard=120, vol=1){
    if(FX.sfxNormalize) playSfx(a,guard,vol);
    else try{ a.currentTime=0; a.play(); }catch(_){}
  }

  // ------------------ State ------------------
  let running=false, paused=false;
  let timer=null;
  let padTimer=null;
  let score=0, combo=0, maxCombo=0, hits=0, spawns=0, timeLeft=60;
  let feverUntil = 0;
  let bossDown = false;  // ใช้สำหรับคำนวนดาว 5 ระดับ

  const BOSS = { active:false, busy:false, phase:1, hp:0, max:1000, name:'RAZOR', color:'#ff3355' };

  function applyHudToggles(){
    if(FX.hudReadable || FX.accessibility){
      const hud = byId('hud');
      if(hud){ hud.style.font='600 15px system-ui'; hud.style.padding='8px 12px'; }
    }
    if(FX.accessibility){
      const bossBar=byId('bossBar'); if(bossBar){ bossBar.style.borderColor='#fff'; bossBar.style.background='#000'; }
    }
  }

  function scoringMul(){ return (FX.feverMode && performance.now()<feverUntil)? 1.5 : 1.0; }
  function onComboChanged(){
    if(FX.comboBadges && combo>0 && combo%10===0){
      try{ window.APP?.badge?.('Combo x'+(combo/10)); }catch(_){ console.log('Combo', combo); }
      sfxPlay(SFX.combo,150,0.9);
    }
    if(FX.feverMode && combo>=25){ feverUntil = performance.now()+8000; try{ window.APP?.badge?.('FEVER!'); }catch(_){} }
    if(combo>maxCombo) maxCombo=combo;
  }

  const _ignoreStreak = { ring:0, blade:0, core:0, pad:0 };
  function coachTipOnce(kind){
    if(!FX.coachTips) return;
    _ignoreStreak[kind] = (_ignoreStreak[kind]||0) + 1;
    if(_ignoreStreak[kind]===3){
      const msg = kind==='ring' ? 'โฟกัสตอนวงแหวนขยายเกือบสุด'
               : kind==='blade' ? 'ดาบ: แตะทันทีหลังสัญญาณ'
               : kind==='core' ? 'เพชร: แตะทันทีเพื่อคอมโบ'
               : 'Pad: แตะภายในเวลาที่กำหนด';
      let t=byId('coachTip');
      if(!t){
        t=document.createElement('div'); t.id='coachTip';
        Object.assign(t.style,{position:'fixed',left:'12px',bottom:'56px',zIndex:9999,
          background:'rgba(0,0,0,.65)',color:'#e6f7ff',padding:'6px 10px',borderRadius:'10px',font:'600 12px system-ui'});
        document.body.appendChild(t);
      }
      t.textContent='Coach: '+msg; t.style.opacity='1';
      setTimeout(()=>{ t.style.opacity='0'; },1800);
    }
  }
  function resetIgnore(kind){ _ignoreStreak[kind]=0; }

  function floatText(text, color, pos){
    const e=document.createElement('a-entity'), p=pos.clone(); p.y+=0.2;
    e.setAttribute('text',{value:text,color,align:'center',width:2.6});
    e.setAttribute('position',`${p.x} ${p.y} ${p.z}`);
    e.setAttribute('scale','0.001 0.001 0.001');
    e.setAttribute('animation__in',{property:'scale',to:'1 1 1',dur:90,easing:'easeOutQuad'});
    e.setAttribute('animation__rise',{property:'position',to:`${p.x} ${p.y+0.6} ${p.z}`,dur:600,easing:'easeOutQuad'});
    e.setAttribute('animation__fade',{property:'opacity',to:0,dur:480,delay:160,easing:'linear'});
    byId('arena').appendChild(e); setTimeout(()=>safeRemove(e),820);
  }

  function updateHUD(){
    byId('score').textContent = Math.round(score);
    byId('combo').textContent = combo;
    byId('time').textContent  = timeLeft;
  }
  function setPhase(n){ const el=byId('phaseLabel'); if(el) el.textContent='Phase '+n; }

  // ------------------ Boss UI ------------------
  function bossShowUI(s){ const bar=byId('bossBar'); if(bar) bar.style.display=s?'block':'none'; }
  function bossSetHP(v){
    const was=BOSS.hp; BOSS.hp=clamp(v,0,BOSS.max);
    const fill=byId('bossHPFill'); if(fill) fill.style.width=((BOSS.hp/BOSS.max)*100)+'%';
    if(BOSS.phase===1 && BOSS.hp<=BOSS.max*0.5) enterPhase2();
    if(BOSS.hp<=0 && was>0) onBossDefeated();
  }
  function bossDamage(amount, pos){
    const final = Math.max(1, Math.round(amount * scoringMul()));
    sfxPlay(SFX.hp_hit,90,0.95);
    bossSetHP(BOSS.hp - final);
    if(pos) floatText('-'+final,'#ffccdd',pos);
  }
  function bossIntro(){
    const arena=byId('arena');
    const a=document.createElement('a-entity'); a.id='bossAnchor'; a.setAttribute('position','0 1.5 -3');
    const head=document.createElement('a-sphere'); head.setAttribute('radius','0.35'); head.setAttribute('color','#1a1a1a'); head.setAttribute('position','0 0 0');
    const mask=document.createElement('a-box'); mask.setAttribute('depth','0.06'); mask.setAttribute('width','0.55'); mask.setAttribute('height','0.45'); mask.setAttribute('color',BOSS.color); mask.setAttribute('position','0 0 0.25');
    a.appendChild(head); a.appendChild(mask); arena.appendChild(a);
    sfxPlay(SFX.boss_roar,200,0.9);
    bossShowUI(true); bossSetHP(BOSS.max); setPhase(1);
  }

  // ------------------ Boss patterns ------------------
  let _lastPattern = '';
  function pickPattern(){
    const pool=['ring','blade','core'];
    if(FX.fairScheduler && _lastPattern){
      const alt=pool.filter(p=>p!==_lastPattern);
      const p=alt[Math.floor(Math.random()*alt.length)];
      _lastPattern=p; return p;
    }
    const p=pool[Math.floor(Math.random()*pool.length)];
    _lastPattern=p; return p;
  }

  window.__sbStartT = 0;
  function nextDelay(base){
    if(!FX.gentleCurve) return base;
    const sec=(performance.now()-window.__sbStartT)/1000;
    const ease=Math.min(1, sec/45);
    const scaled=base*(1-0.2*ease);
    return Math.max(220, Math.round(scaled));
  }

  function scheduleNext(){
    if(!running || !BOSS.active || BOSS.busy) return;
    BOSS.busy=true;
    const which = pickPattern();
    if(which==='ring') doRing();
    else if(which==='blade') doBlade();
    else doCore();
  }
  function doneAttack(delay=520){
    BOSS.busy=false;
    window.__sbNextTO = setTimeout(scheduleNext, nextDelay(delay));
  }

  function doRing(){
    sfxPlay(SFX.tel_shock,120,1.0);
    const r=document.createElement('a-ring'); r.classList.add('clickable','boss-attack');
    r.setAttribute('position','0 1.2 -2.6'); r.setAttribute('radius-inner','0.05'); r.setAttribute('radius-outer','0.07');
    r.setAttribute('material','color:#ffd166;opacity:.95;shader:flat');
    if(FX.pointerHitBoost){ r.setAttribute('radius-outer', (0.07+0.03).toFixed(2)); }
    byId('arena').appendChild(r);
    let hit=false;
    const start=performance.now(), T=720;
    const step=()=>{ if(!r.parentNode || !running) return;
      const t=(performance.now()-start)/T, base=0.07+t*0.95;
      r.setAttribute('radius-inner', Math.max(0.01, base-0.02));
      r.setAttribute('radius-outer', base);
      if(t>=1){ if(!hit){ coachTipOnce('ring'); } safeRemove(r); doneAttack(460); return; }
      window.__sbRaf = requestAnimationFrame(step);
    };
    r.addEventListener('click', ()=>{
      if(hit) return; hit=true;
      const p=r.object3D.getWorldPosition(new THREE.Vector3());
      floatText('BREAK','#00ffa3',p);
      combo++; onComboChanged(); hits++; score+=Math.round(14*scoringMul()); updateHUD();
      resetIgnore('ring');
      bossDamage(20,p);
      safeRemove(r); doneAttack(420);
    });
    step();
  }

  function doBlade(){
    sfxPlay(SFX.tel_slash,120,1.0);
    const g=document.createElement('a-entity'); g.classList.add('clickable','boss-attack');
    g.setAttribute('geometry','primitive: box; height: 0.04; width: 1.2; depth: 0.04');
    g.setAttribute('material','color:#5de1ff;opacity:.95;transparent:true');
    g.setAttribute('rotation',`0 0 ${-35+Math.round(Math.random()*70)}`);
    g.setAttribute('position','0 1.35 -2.2');
    byId('arena').appendChild(g);
    let ok=false;
    const T=560; const t0=performance.now();
    const timer=()=>{
      if(!g.parentNode || !running) return;
      if(performance.now()-t0 >= T){
        if(!ok){ coachTipOnce('blade'); } safeRemove(g); doneAttack(520); return;
      }
      window.__sbRaf = requestAnimationFrame(timer);
    };
    g.addEventListener('click', ()=>{
      if(ok) return; ok=true;
      const p=g.object3D.getWorldPosition(new THREE.Vector3());
      floatText('PARRY','#00d0ff',p);
      combo++; onComboChanged(); hits++; score+=Math.round(12*scoringMul()); updateHUD();
      resetIgnore('blade');
      bossDamage(16,p);
      safeRemove(g); doneAttack(460);
    });
    timer();
  }

  function doCore(){
    const g=document.createElement('a-icosahedron'); g.classList.add('clickable','boss-attack');
    g.setAttribute('position','0 1.6 -2.4'); g.setAttribute('radius','0.18'); g.setAttribute('color','#00ffa3');
    byId('arena').appendChild(g);
    let grabbed=false;
    const T=700; const t0=performance.now();
    const timer=()=>{
      if(!g.parentNode || !running) return;
      if(performance.now()-t0 >= T){
        if(!grabbed){ coachTipOnce('core'); } safeRemove(g); doneAttack(480); return;
      }
      window.__sbRaf = requestAnimationFrame(timer);
    };
    g.addEventListener('click', ()=>{
      if(grabbed) return; grabbed=true;
      const p=g.object3D.getWorldPosition(new THREE.Vector3());
      floatText('CRITICAL!','#00ffa3',p);
      sfxPlay(SFX.success,130,1.0);
      combo++; onComboChanged(); hits++; score+=Math.round(22*scoringMul()); updateHUD();
      resetIgnore('core');
      bossDamage(28,p);
      safeRemove(g); doneAttack(520);
    });
    timer();
  }

  // ------------------ Punch Pads ------------------
  const PAD_SPEC = [
    { id:'circle',   color:'#00d0ff', shape:'circle',   seg:32,   radius:0.22,   score:10,  dmg:10 },
    { id:'triangle', color:'#ffd166', shape:'circle',   seg:3,    radius:0.26,   score:12,  dmg:12 },
    { id:'square',   color:'#ff6b6b', shape:'box',      size:0.4,               score:12,  dmg:12 },
    { id:'pentagon', color:'#a899ff', shape:'circle',   seg:5,    radius:0.26,   score:14,  dmg:14 },
    { id:'hexagon',  color:'#00ffa3', shape:'circle',   seg:6,    radius:0.26,   score:16,  dmg:14 },
    { id:'diamond',  color:'#c0ffee', shape:'icosa',    r:0.19,                score:22,  dmg:18 },
    { id:'bomb',     color:'#222222', shape:'sphere',   r:0.20,  emissive:'#ff4444', score:0,  dmg:0, bomb:true }
  ];
  let padSpawnIntBase = 1500;
  let padLifeBase     = 1200;

  function nextPadInterval(){
    if(!FX.gentleCurve) return padSpawnIntBase;
    const sec=(performance.now()-window.__sbStartT)/1000;
    const ease=Math.min(1, sec/40);
    return Math.max(700, Math.round(padSpawnIntBase*(1-0.35*ease)));
  }
  function nextPadLife(){
    if(!FX.gentleCurve) return padLifeBase;
    const sec=(performance.now()-window.__sbStartT)/1000;
    const ease=Math.min(1, sec/40);
    return Math.max(800, Math.round(padLifeBase*(1-0.2*ease)));
  }

  function spawnPad(){
    if(!running) return;

    const pool = [...PAD_SPEC, ...PAD_SPEC.filter(p=>!p.bomb), ...PAD_SPEC.filter(p=>!p.bomb)];
    const spec = pool[Math.floor(Math.random()*pool.length)];

    const x = (Math.random()*2.2 - 1.1).toFixed(2);
    const y = (Math.random()*0.7 + 1.1).toFixed(2);
    const z = -2.3;

    let el;
    if(spec.shape==='box'){
      el = document.createElement('a-box');
      const s = spec.size || 0.36;
      el.setAttribute('width', s); el.setAttribute('height', s); el.setAttribute('depth', s);
    }else if(spec.shape==='icosa'){
      el = document.createElement('a-icosahedron');
      el.setAttribute('radius', spec.r || 0.18);
    }else if(spec.shape==='sphere'){
      el = document.createElement('a-sphere');
      el.setAttribute('radius', spec.r || 0.20);
    }else{
      el = document.createElement('a-entity');
      el.setAttribute('geometry', `primitive: circle; radius: ${spec.radius||0.24}; segments: ${spec.seg||32}`);
    }

    el.classList.add('clickable','sb-pad');
    el.setAttribute('position', `${x} ${y} ${z}`);
    const mat = spec.bomb
      ? `color:${spec.color}; metalness:0.2; roughness:0.5; emissive:${spec.emissive||'#aa0000'}; emissiveIntensity:0.6;`
      : `color:${spec.color}; metalness:0.1; roughness:0.4;`;
    el.setAttribute('material', mat + ' opacity:0.95; transparent:true');

    if(FX.pointerHitBoost){
      const collider = document.createElement('a-entity');
      collider.setAttribute('geometry','primitive: circle; radius: 0.32; segments: 24');
      collider.setAttribute('material','color:#ffffff; opacity:0.001; transparent:true');
      collider.classList.add('clickable');
      el.appendChild(collider);
      collider.addEventListener('click', ()=> el.emit('click'));
      collider.addEventListener('mousedown', ()=> el.emit('click'));
    }

    byId('arena').appendChild(el);

    let clicked=false;
    const killT = setTimeout(()=>{
      if(clicked) return;
      coachTipOnce('pad');    // ไม่หักคะแนนถ้าไม่กด
      safeRemove(el);
    }, nextPadLife());

    const onClick = ()=>{
      if(clicked) return; clicked=true;
      clearTimeout(killT);
      const p = el.object3D.getWorldPosition(new THREE.Vector3());
      safeRemove(el);

      if(spec.bomb){
        combo = 0; onComboChanged(); updateHUD();
        floatText('BOMB! Combo reset','#ff7766',p);
        sfxPlay(SFX.boom,120,1.0);
        return;
      }

      hits++;
      combo++; onComboChanged();
      const add = Math.round((spec.score||10) * scoringMul());
      score += add;
      updateHUD();
      floatText('HIT +'+add,(spec.color||'#00d0ff'),p);
      sfxPlay(SFX.slash,120,1.0);
      bossDamage(spec.dmg||10, p);
      resetIgnore('pad');
    };
    el.addEventListener('click', onClick);
    el.addEventListener('mousedown', onClick);
  }

  // ------------------ Boss flow ------------------
  function enterPhase2(){ BOSS.phase=2; setPhase(2); try{ window.APP?.badge?.('Phase 2'); }catch(_){} }
  function onBossDefeated(){
    bossDown = true;
    BOSS.active=false; floatText('BOSS DEFEATED','#00ffa3', new THREE.Vector3(0,1.6,-2.4));
    score+=250; updateHUD(); end();
  }

  // ------------------ Game flow ------------------
  function clearArena(){ const a=byId('arena'); Array.from(a.children).forEach(c=>safeRemove(c)); }

  function start(){
    if(running) return;
    running=true; paused=false;
    window.__sbStartT = performance.now();
    score=0; combo=0; maxCombo=0; hits=0; spawns=0; timeLeft=60; feverUntil=0; bossDown=false;
    byId('results').style.display='none';
    updateHUD(); bossShowUI(false); clearArena();
    BOSS.active=true; BOSS.busy=false; BOSS.phase=1; BOSS.max=1000; BOSS.hp=BOSS.max;
    bossIntro();

    timer = setInterval(()=>{ timeLeft--; byId('time').textContent=timeLeft; if(timeLeft<=0) end(); },1000);

    setTimeout(scheduleNext, 700);

    const tickSpawn = ()=>{
      if(!running) return;
      spawnPad();
      const next = nextPadInterval();
      padTimer = setTimeout(tickSpawn, next);
    };
    tickSpawn();
  }

  // ---- ดาว 5 ระดับ (0–5) ----
  function computeStars(){
    let s = 0;
    if(bossDown) s += 1;                     // ชนะบอส
    if(maxCombo >= 15) s += 1;               // คอมโบระดับเริ่มต้น
    if(maxCombo >= 30) s += 1;               // คอมโบสูง
    if(score >= 300) s += 1;                 // สกอร์รวม
    if(timeLeft >= 10) s += 1;               // จบด้วยเวลาเหลือ
    return clamp(s,0,5);
  }

  function end(){
    running=false; paused=false;
    try{ clearInterval(timer); }catch(_){}
    try{ clearTimeout(padTimer); }catch(_){}
    try{ clearTimeout(window.__sbNextTO); }catch(_){}
    try{ cancelAnimationFrame(window.__sbRaf); }catch(_){}
    bossShowUI(false);

    const acc = maxCombo>0 ? Math.min(100, Math.round((hits/(hits+_ignoreStreak.ring+_ignoreStreak.blade+_ignoreStreak.core+_ignoreStreak.pad+1))*100)) : 0;
    byId('rScore').textContent = Math.round(score);
    byId('rMaxCombo').textContent = maxCombo;
    byId('rAcc').textContent = acc + '%';

    // ★★★★★ (5 ระดับ)
    const stars = computeStars();
    const rStars = byId('rStars');
    if(rStars){ rStars.textContent = '★'.repeat(stars) + '☆'.repeat(5 - stars); }

    if(FX.richResults){
      let extra = byId('rExtra');
      if(!extra){
        extra = document.createElement('div'); extra.id='rExtra'; extra.style.marginTop='8px';
        byId('results').querySelector('.card')?.appendChild(extra);
      }
      extra.innerHTML = `Time Left: <b>${timeLeft}s</b>`;
    }

    byId('results').style.display='flex';
    sfxPlay(SFX.ui,140,1);
  }

  function togglePause(){
    if(!running) return;
    paused=!paused;
    if(paused){
      clearInterval(timer); try{ cancelAnimationFrame(window.__sbRaf); }catch(_){}
      try{ clearTimeout(padTimer); }catch(_){}
      try{ window.APP?.badge?.('Paused'); }catch(_){}
    }else{
      timer = setInterval(()=>{ timeLeft--; byId('time').textContent=timeLeft; if(timeLeft<=0) end(); },1000);
      const next = nextPadInterval();
      padTimer = setTimeout(function tick(){ if(!running||paused) return; spawnPad(); padTimer=setTimeout(tick,nextPadInterval()); }, next);
      try{ window.APP?.badge?.('Resume'); }catch(_){}
    }
  }

  function bankNow(){
    const add=Math.floor(combo*3);
    score+=add; combo=0; updateHUD();
    try{ window.APP?.badge?.('Bank +'+add); }catch(_){}
  }

  // ------------------ Mouse raycast fallback ------------------
  (function pointerRaycast(){
    const sceneEl = document.querySelector('a-scene'); if(!sceneEl) return;
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    function pick(clientX, clientY){
      const cam = sceneEl.camera; if(!cam) return;
      mouse.x =  (clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(clientY / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera(mouse, cam);
      if(FX.pointerHitBoost){ raycaster.far = 100; }
      const clickable = Array.from(document.querySelectorAll('.clickable')).map(el=>el.object3D).filter(Boolean);
      const objs=[]; clickable.forEach(o=>o.traverse(c=>objs.push(c)));
      const hits = raycaster.intersectObjects(objs,true);
      if(hits && hits.length){
        let obj=hits[0].object; while(obj && !obj.el) obj=obj.parent;
        if(obj && obj.el){ obj.el.emit('click'); }
      }
    }
    window.addEventListener('mousedown', e=>pick(e.clientX,e.clientY), {passive:true});
    window.addEventListener('touchstart', e=>{ const t=e.touches?.[0]; if(t) pick(t.clientX,t.clientY); }, {passive:true});
  })();

  // ------------------ Wire Buttons ------------------
  function wire(){
    byId('startBtn')?.addEventListener('click', start);
    byId('replayBtn')?.addEventListener('click', ()=>{ byId('results').style.display='none'; start(); });
    byId('pauseBtn')?.addEventListener('click', togglePause);
    byId('bankBtn')?.addEventListener('click', bankNow);
    byId('backBtn')?.addEventListener('click', ()=>{ location.href = HUB_URL; });
    byId('enterVRBtn')?.addEventListener('click', ()=>{ try{ document.querySelector('a-scene')?.enterVR?.(); }catch(_){} });

    addEventListener('keydown', (ev)=>{
      if(ev.code==='Space'){ ev.preventDefault(); if(!running) start(); else togglePause(); }
      if(ev.code==='Escape'){ end(); }
      if(ev.key==='`'){ const d=byId('debug'); if(d) d.style.display = d.style.display==='none'?'block':'none'; }
    });
  }

  function boot(){ wire(); updateHUD(); applyHudToggles(); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  if(FX.safetyCleanup){
    window.addEventListener('beforeunload', ()=>{
      try{ clearInterval(timer); }catch(_){}
      try{ clearTimeout(padTimer); }catch(_){}
      try{ clearTimeout(window.__sbNextTO); }catch(_){}
      try{ cancelAnimationFrame(window.__sbRaf); }catch(_){}
    });
  }
/* ===== How to Play (Shadow Breaker) · inline UI ===== */
(function installHowTo(){
  // ---- Styles ----
  const css = `
  #sbHelpBtn{position:fixed;left:160px;bottom:12px;z-index:9999;padding:8px 12px;border-radius:10px;border:0;background:#123047;color:#e6f7ff;font:600 12px system-ui;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.3)}
  #sbHelpBtn:hover{filter:brightness(1.1)}
  #sbHowTo{position:fixed;inset:0;z-index:99998;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.65)}
  #sbHowTo .card{width:min(820px,92vw);max-height:86vh;overflow:auto;background:#0b1118;border:1px solid #213546;border-radius:14px;padding:16px 18px;color:#e6f7ff;box-shadow:0 10px 30px rgba(0,0,0,.45)}
  #sbHowTo h2{margin:0 0 8px;font:800 18px/1.2 system-ui;letter-spacing:.3px}
  #sbHowTo h3{margin:14px 0 6px;font:700 14px/1.25 system-ui;color:#9bd1ff}
  #sbHowTo p, #sbHowTo li{font:500 13px/1.5 system-ui;color:#d9f3ff}
  #sbHowTo .grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
  #sbHowTo .cta{display:flex;gap:8px;justify-content:flex-end;margin-top:12px}
  #sbHowTo .btn{padding:8px 12px;border-radius:10px;border:0;font:700 12px system-ui;cursor:pointer}
  #sbHowTo .btn.primary{background:#0e2233;color:#e6f7ff}
  #sbHowTo .btn.ghost{background:transparent;color:#a8cfe6;border:1px solid #2a465c}
  @media (max-width:720px){ #sbHowTo .grid{grid-template-columns:1fr} #sbHelpBtn{left:12px;bottom:54px} }
  `;
  const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);

  // ---- Button (วางถัดจาก Bank – มุมล่างซ้าย) ----
  const btn = document.createElement('button');
  btn.id = 'sbHelpBtn';
  btn.type = 'button';
  btn.textContent = '❓ How to Play';
  document.body.appendChild(btn);

  // ---- Modal ----
  const wrap = document.createElement('section');
  wrap.id = 'sbHowTo';
  wrap.innerHTML = `
    <div class="card" role="dialog" aria-labelledby="sbHowToTitle" aria-modal="true">
      <h2 id="sbHowToTitle">วิธีการเล่น · Shadow Breaker</h2>
      <div class="grid">
        <div>
          <h3>เป้าหมาย</h3>
          <ul>
            <li>ป้องกัน/สวน “ท่าบอส” ที่โผล่ตรงหน้า (ดาบ / วงแหวน / เลเซอร์ / เพชร ฯลฯ)</li>
            <li>ชกรูปทรงเป้า (วงกลม/สามเหลี่ยม/สี่เหลี่ยม/ห้าเหลี่ยม/หกเหลี่ยม) เพื่อเก็บคะแนนและลด HP บอส</li>
            <li>เลี่ยง <b>ระเบิด</b> (Bomb) — ชนแล้วคอมโบจะถูกรีเซ็ต</li>
          </ul>

          <h3>การควบคุม</h3>
          <ul>
            <li><b>เดสก์ท็อป:</b> เมาส์ขยับ = มือขวา | คลิกซ้าย = ชก/พารี/ทำลาย</li>
            <li><b>มือถือ/VR:</b> แตะหน้าจอหรือจิ้มคอนโทรลเลอร์บนเป้า</li>
            <li><b>คีย์ลัด:</b> <code>P</code> = Pause/Resume, <code>B</code> = Bank, <code>\`</code> = Debug</li>
          </ul>

          <h3>คะแนน & คอมโบ</h3>
          <ul>
            <li><b>Perfect</b> ให้คะแนนสูงสุดและเสริมดาเมจ</li>
            <li><b>Good</b> ได้คะแนนปกติ</li>
            <li><b>Miss</b> <u>ไม่หักคะแนน</u> (เฉพาะไม่ได้คลิก) แต่คอมโบจะรีเซ็ตเมื่อโดนระเบิดเท่านั้น</li>
            <li>คอมโบทุก ๆ 10 ครั้งมีแบดจ์และเสียงเชียร์</li>
            <li><b>Fever</b>: คอมโบ 25+ เปิด x1.5 สำหรับ Punch Pad</li>
          </ul>
        </div>

        <div>
          <h3>บอส & แพทเทิร์น</h3>
          <ul>
            <li><b>ดาบ/Slash</b>: คลิกชิ้นดาบเพื่อพารี</li>
            <li><b>วงแหวน</b>: กดทำลายก่อนขยายจนพ้นเวลา (มีแอนิเมชัน “ขยายออก” ให้เห็นชัด)</li>
            <li><b>เลเซอร์</b>: ตัดลำแสงให้ครบก่อนหมดเวลา</li>
            <li><b>เพชร</b>: ชิ้นเป้าโบนัส/คริติคอล</li>
            <li><b>Rush Phase</b> (10 วิ ท้ายเฟส 2): รูปแบบเร็วขึ้นสั้น ๆ แล้วคูลดาวน์</li>
          </ul>

          <h3>ระบบธนาคาร (Bank)</h3>
          <ul>
            <li>คอมโบสะสม = แต้มพิเศษกด <b>Bank</b> เพื่อเก็บเป็นคะแนนถาวร</li>
            <li>ถ้าโดนระเบิดก่อนกด Bank คอมโบจะหลุด (เสียจังหวะ)</li>
          </ul>

          <h3>การปรับแต่ง</h3>
          <ul>
            <li><b>Difficulty</b> เลือกจากดรอปดาวน์ด้านขวาล่าง</li>
            <li><b>Accessibility</b>: สีคอนทราสต์สูง + ขยายฟอนต์ HUD (+15%) เปิดอยู่แล้ว</li>
          </ul>
        </div>
      </div>

      <div class="cta">
        <button class="btn ghost" id="sbHowToClose">Close</button>
        <button class="btn primary" id="sbHowToStart">Start Now</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);

  // ---- Wire events ----
  function openHowTo(){ wrap.style.display = 'flex'; }
  function closeHowTo(){ wrap.style.display = 'none'; }

  btn.addEventListener('click', openHowTo);
  wrap.addEventListener('click', (e)=>{ if(e.target===wrap) closeHowTo(); });
  wrap.querySelector('#sbHowToClose').addEventListener('click', closeHowTo);
  wrap.querySelector('#sbHowToStart').addEventListener('click', ()=>{
    closeHowTo();
    // เรียกปุ่มเริ่มเกมที่มีอยู่แล้ว
    try{ document.getElementById('startBtn')?.click(); }catch(_){}
  });
  window.addEventListener('keydown', (e)=>{ if(e.key==='Escape' && wrap.style.display==='flex') closeHowTo(); });

  // ---- แสดงอัตโนมัติรอบแรก ----
  try{
    const KEY='sb_seenHowTo_v1';
    if(!localStorage.getItem(KEY)){
      setTimeout(openHowTo, 300);
      localStorage.setItem(KEY,'1');
    }
  }catch(_){}

  // ---- ปรับ HUD ให้อ่านง่าย (ถ้าเปิด switch ไว้) ----
  try{
    if (window.FX?.hudReadable || window.FX?.accessibility){
      const hud = document.getElementById('hud');
      if(hud){
        hud.style.fontSize = '15px';
        hud.style.filter = 'contrast(1.15)';
      }
    }
  }catch(_){}
})();

})();
