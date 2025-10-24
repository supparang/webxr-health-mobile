/* games/shadow-breaker/game.js
   Shadow Breaker (Classic feel kept) + FX toggles (1,2,4,5,6,7,8,9,11,12,13,14)
   - ค่าเริ่มต้น: ปิดทั้งหมด (= เล่นเหมือนเดิม)
   - เปิดใช้: ตั้งค่าในอ็อบเจ็กต์ FX ด้านล่าง
*/
(function(){
  "use strict";

  // ------------------ Helpers & Globals ------------------
  const byId = (id)=>document.getElementById(id);
  const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));
  const HUB_URL = "https://supparang.github.io/webxr-health-mobile/vr-fitness/";
  const ASSET_BASE = (document.querySelector('meta[name="asset-base"]')?.content || '').replace(/\/+$/,'');

  // Feature switches (ALL OFF by default to keep classic)
  const FX = {
    pacingSmooth:    true, // [1] rAF pacing (ลื่นขึ้น)
    pointerHitBoost: true, // [2] ขยายพื้นที่ฮิตเล็กน้อยของเป้าคลิก
    sfxNormalize:    true, // [4] จัดวอลุ่ม + กันสแปมเสียง
    hudReadable:     true, // [5] HUD ใหญ่ขึ้นเล็กน้อย
    gentleCurve:     true, // [6] โค้งความเร็ว/ดีเลย์นุ่มขึ้น (ค่อย ๆ เร็ว)
    fairScheduler:   true, // [7] กันสุ่มแพทเทิร์นซ้ำติดกัน
    comboBadges:     true, // [8] ป๊อปอัปทุกคอมโบ x10
    feverMode:       true, // [9] ช่วงคูณคะแนนเมื่อคอมโบสูง
    accessibility:   true, // [11] High contrast + HUD +15%
    richResults:     true, // [12] สรุปผลละเอียด
    coachTips:       true, // [13] โค้ชให้คำใบ้เมื่อ “ละเลยชนิดเดิม 3 ครั้งติด”
    safetyCleanup:   true   // [14] null-safe + clear interval/rAF ตอนออก
  };

  // ------ Null-safe remove ------
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
    ui:        new Audio(`${ASSET_BASE}/assets/sfx/success.wav`)
  };
  Object.values(SFX).forEach(a=>{ try{ a.preload='auto'; a.crossOrigin='anonymous'; }catch(_){} });

  // SFX normalize helper
  const _sfxLastPlay = new Map();
  function playSfx(a, guardMs=120, vol=1){
    try{
      if(FX.sfxNormalize){
        const now=performance.now();
        if(_sfxLastPlay.get(a) && now - _sfxLastPlay.get(a) < guardMs) return;
        _sfxLastPlay.set(a, now);
        a.volume = vol;
      }
      a.currentTime=0; a.play();
    }catch(_){}
  }
  function sfxPlay(a, guard=120, vol=1){
    if(FX.sfxNormalize) playSfx(a,guard,vol);
    else try{ a.currentTime=0; a.play(); }catch(_){}
  }

  // ------------------ State ------------------
  let running=false, paused=false;
  let timer=null, spawnTimer=null; // สำหรับเป้าทั่วไป (เกมเวอร์ชันเดิมไม่มีวิ่งถาวร—ใช้บอสลูป)
  let score=0, combo=0, maxCombo=0, hits=0, spawns=0, timeLeft=60;
  let feverUntil = 0;

  const BOSS = { active:false, busy:false, phase:1, hp:0, max:1000, name:'RAZOR', color:'#ff3355' };

  // HUD apply
  function applyHudToggles(){
    if(FX.hudReadable || FX.accessibility){
      const hud = byId('hud');
      if(hud){ hud.style.font='600 15px system-ui'; hud.style.padding='8px 12px'; }
    }
    if(FX.accessibility){
      const bossBar=byId('bossBar'); if(bossBar){ bossBar.style.borderColor='#fff'; bossBar.style.background='#000'; }
    }
  }

  // Fever + combo badges
  function scoringMul(){ return (FX.feverMode && performance.now()<feverUntil)? 1.5 : 1.0; }
  function onComboChanged(){
    if(FX.comboBadges && combo>0 && combo%10===0){
      try{ window.APP?.badge?.('Combo x'+(combo/10)); }catch(_){ console.log('Combo', combo); }
      sfxPlay(SFX.combo,150,0.9);
    }
    if(FX.feverMode && combo>=25){ feverUntil = performance.now()+8000; try{ window.APP?.badge?.('FEVER!'); }catch(_){} }
    if(combo>maxCombo) maxCombo=combo;
  }

  // Coach tips
  const _ignoreStreak = { ring:0, blade:0, core:0 };
  function coachTipOnce(kind){
    if(!FX.coachTips) return;
    _ignoreStreak[kind] = (_ignoreStreak[kind]||0) + 1;
    if(_ignoreStreak[kind]===3){
      const msg = kind==='ring' ? 'โฟกัสตอนวงแหวนขยายเกือบสุด'
               : kind==='blade' ? 'ดาบ: แตะทันทีหลังสัญญาณ'
               : 'เพชร: แตะทันทีที่โผล่เพื่อคอมโบ';
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

  // Float text
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

  // HUD
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

  // ------------------ Patterns (ring / blade / core) ------------------
  // Fair scheduler
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

  // Gentle pacing
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

  // ---- Ring (คลิกเมื่อวงขยายใกล้เต็ม) ----
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

  // ---- Blade (เส้นดาบให้แตะเร็ว ๆ) ----
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
    const timer=( )=>{
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

  // ---- Core (เพชรโบนัส) ----
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

  // ------------------ Boss flow ------------------
  function enterPhase2(){ BOSS.phase=2; setPhase(2); try{ window.APP?.badge?.('Phase 2'); }catch(_){} }
  function onBossDefeated(){
    BOSS.active=false; floatText('BOSS DEFEATED','#00ffa3', new THREE.Vector3(0,1.6,-2.4));
    score+=250; updateHUD(); end();
  }

  // ------------------ Game flow ------------------
  function clearArena(){ const a=byId('arena'); Array.from(a.children).forEach(c=>safeRemove(c)); }

  function start(){
    if(running) return;
    running=true; paused=false;
    window.__sbStartT = performance.now();
    score=0; combo=0; maxCombo=0; hits=0; spawns=0; timeLeft=60; feverUntil=0;
    byId('results').style.display='none';
    updateHUD(); bossShowUI(false); clearArena();
    BOSS.active=true; BOSS.busy=false; BOSS.phase=1; BOSS.max=1000; BOSS.hp=BOSS.max;
    bossIntro();

    // นับเวลาถอยหลัง
    timer = setInterval(()=>{ timeLeft--; byId('time').textContent=timeLeft; if(timeLeft<=0) end(); },1000);

    // เริ่มลูปบอส
    setTimeout(scheduleNext, 700);
  }

  function end(){
    running=false; paused=false;
    try{ clearInterval(timer); }catch(_){}
    try{ clearInterval(spawnTimer); }catch(_){}
    try{ clearTimeout(window.__sbNextTO); }catch(_){}
    try{ cancelAnimationFrame(window.__sbRaf); }catch(_){}
    bossShowUI(false);

    const acc = (hits>0 || spawns>0) ? Math.round((hits/(hits+(_ignoreStreak.ring+_ignoreStreak.blade+_ignoreStreak.core))) * 100) : 0;
    byId('rScore').textContent = Math.round(score);
    byId('rMaxCombo').textContent = maxCombo;
    byId('rAcc').textContent = acc + '%';

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
      try{ window.APP?.badge?.('Paused'); }catch(_){}
    }else{
      timer = setInterval(()=>{ timeLeft--; byId('time').textContent=timeLeft; if(timeLeft<=0) end(); },1000);
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

    // Hotkeys
    addEventListener('keydown', (ev)=>{
      if(ev.code==='Space'){ ev.preventDefault(); if(!running) start(); else togglePause(); }
      if(ev.code==='Escape'){ end(); }
      if(ev.key==='`'){ const d=byId('debug'); if(d) d.style.display = d.style.display==='none'?'block':'none'; }
    });
  }

  // ------------------ Boot & Safety ------------------
  function boot(){ wire(); updateHUD(); applyHudToggles(); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  if(FX.safetyCleanup){
    window.addEventListener('beforeunload', ()=>{
      try{ clearInterval(timer); }catch(_){}
      try{ clearInterval(spawnTimer); }catch(_){}
      try{ clearTimeout(window.__sbNextTO); }catch(_){}
      try{ cancelAnimationFrame(window.__sbRaf); }catch(_){}
    });
  }

})();
