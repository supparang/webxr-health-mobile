/* games/shadow-breaker/game.js
   Shadow Breaker · Fixed Boss Name Overlap (Single Anchor)
   Author: Supparang R.
*/

(function(){
  "use strict";

  // ===== Helpers =====
  const byId = (id)=>document.getElementById(id);
  const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));
  const HUB_URL = "https://supparang.github.io/webxr-health-mobile/vr-fitness/";

  // ===== State =====
  let running=false, paused=false;
  let timer=null, nextTO=null;
  const BOSS = {active:false,busy:false,phase:1,hp:0,max:1000,name:"RAZOR",color:"#ff3355"};
  let score=0,combo=0,maxCombo=0,hits=0,timeLeft=60;
  let bossIndex=0;
  const BOSSES=[
    {title:"RAZOR", color:"#ff3355", baseHP:1000},
    {title:"OBSIDIAN", color:"#55ccff", baseHP:1300},
    {title:"VALKYR", color:"#00ffa3", baseHP:1600},
    {title:"OMEGA CORE", color:"#ff7a33", baseHP:2000}
  ];

  // ===== Safe remove =====
  function safeRemove(el){ try{ if(el && el.parentNode) el.parentNode.removeChild(el); }catch(_){} }

  // ===== HUD =====
  function updateHUD(){
    byId('score').textContent = score;
    byId('combo').textContent = combo;
    byId('time').textContent = timeLeft;
    byId('phaseLabel').textContent = 'Phase '+BOSS.phase;
  }

  // ===== Boss UI Management (Fixed Name Handling) =====
  function killAllBossAnchors(){
    document.querySelectorAll('#bossAnchor').forEach(n=>{ try{n.remove();}catch(_){ } });
  }
  function killAllBossNames(){
    document.querySelectorAll('#bossNameLabel, .boss-name').forEach(n=>{ try{n.remove();}catch(_){ } });
  }
  function getBossAnchor(){
    let a = document.getElementById('bossAnchor');
    if(a) return a;
    killAllBossAnchors();
    killAllBossNames();
    const arena = byId('arena');
    a = document.createElement('a-entity');
    a.id='bossAnchor';
    a.setAttribute('position','0 1.5 -3');
    const head=document.createElement('a-sphere');
    head.setAttribute('radius','0.35');
    head.setAttribute('color','#111');
    const mask=document.createElement('a-box');
    mask.setAttribute('depth','0.06');
    mask.setAttribute('width','0.55');
    mask.setAttribute('height','0.45');
    mask.setAttribute('color',BOSS.color);
    mask.setAttribute('position','0 0 0.25');
    a.appendChild(head); a.appendChild(mask);
    arena.appendChild(a);
    return a;
  }
  function setBossNameLabel(text){
    const a=getBossAnchor();
    killAllBossNames();
    const nameLabel=document.createElement('a-entity');
    nameLabel.id='bossNameLabel';
    nameLabel.classList.add('boss-name');
    nameLabel.setAttribute('text',{value:text||'BOSS',color:'#e6f7ff',align:'center',width:3.2});
    nameLabel.setAttribute('position','0 0.62 0.1');
    a.appendChild(nameLabel);
    const rBoss = byId('rBoss');
    if(rBoss) rBoss.textContent = text || 'BOSS';
  }

  function bossShowUI(s){ const bar=byId('bossBar'); if(bar) bar.style.display=s?'block':'none'; }
  function bossSetHP(v){
    const was=BOSS.hp; BOSS.hp=clamp(v,0,BOSS.max);
    const fill=byId('bossHPFill'); if(fill) fill.style.width=((BOSS.hp/BOSS.max)*100)+'%';
    if(BOSS.hp<=0 && was>0) onBossDefeated();
  }
  function bossDamage(a){ bossSetHP(BOSS.hp-a); }
  function bossIntro(){
    const a=getBossAnchor();
    const mask=a.querySelector('a-box'); if(mask) mask.setAttribute('color',BOSS.color);
    setBossNameLabel(BOSS.name);
    bossShowUI(true);
    bossSetHP(BOSS.max);
    updateHUD();
  }

  // ===== Boss Flow =====
  function spawnBossByIndex(i){
    if(i>=BOSSES.length){ end(); return; }
    const cfg=BOSSES[i];
    BOSS.active=true; BOSS.busy=false; BOSS.phase=1;
    BOSS.name=cfg.title; BOSS.color=cfg.color;
    BOSS.max=cfg.baseHP; BOSS.hp=BOSS.max;
    bossIntro();
    setTimeout(scheduleNext, 700);
  }

  function onBossDefeated(){
    BOSS.active=false;
    safeRemove(document.getElementById('bossNameLabel'));
    safeRemove(document.getElementById('bossAnchor'));
    score+=250;
    bossIndex++;
    if(bossIndex<BOSSES.length){ setTimeout(()=>spawnBossByIndex(bossIndex),1200); }
    else end();
  }

  function scheduleNext(){
    if(!running||BOSS.busy||!BOSS.active) return;
    BOSS.busy=true;
    const type=Math.random();
    if(type<0.33) spawnRing();
    else if(type<0.66) spawnBlade();
    else spawnCore();
  }

  function spawnRing(){
    const arena=byId('arena');
    const r=document.createElement('a-ring');
    r.classList.add('clickable');
    r.setAttribute('position','0 1.2 -2.5');
    r.setAttribute('radius-inner','0.05');
    r.setAttribute('radius-outer','0.07');
    r.setAttribute('material','color:#ffd166;opacity:0.95;shader:flat');
    arena.appendChild(r);
    let clicked=false;
    const start=performance.now();
    const T=800;
    const anim=()=>{
      if(!r.parentNode||!running) return;
      const t=(performance.now()-start)/T;
      const base=0.07+t*1.0;
      r.setAttribute('radius-outer',base);
      if(t>=1){
        if(!clicked){ safeRemove(r); BOSS.busy=false; setTimeout(scheduleNext,700); }
        return;
      }
      requestAnimationFrame(anim);
    };
    r.addEventListener('click',()=>{
      if(clicked) return; clicked=true;
      safeRemove(r);
      bossDamage(20);
      combo++; hits++; score+=15;
      updateHUD();
      BOSS.busy=false;
      setTimeout(scheduleNext,600);
    });
    anim();
  }

  function spawnBlade(){
    const arena=byId('arena');
    const b=document.createElement('a-box');
    b.classList.add('clickable');
    b.setAttribute('width','1.2');
    b.setAttribute('height','0.05');
    b.setAttribute('depth','0.05');
    b.setAttribute('color','#00d0ff');
    b.setAttribute('position','0 1.3 -2.3');
    b.setAttribute('rotation',`0 0 ${-30+Math.random()*60}`);
    arena.appendChild(b);
    let clicked=false;
    const T=700;
    const start=performance.now();
    const anim=()=>{
      if(!b.parentNode||!running) return;
      const t=(performance.now()-start)/T;
      if(t>=1){
        if(!clicked){ safeRemove(b); BOSS.busy=false; setTimeout(scheduleNext,700); }
        return;
      }
      requestAnimationFrame(anim);
    };
    b.addEventListener('click',()=>{
      if(clicked) return; clicked=true;
      safeRemove(b);
      bossDamage(15);
      combo++; hits++; score+=12;
      updateHUD();
      BOSS.busy=false;
      setTimeout(scheduleNext,600);
    });
    anim();
  }

  function spawnCore(){
    const arena=byId('arena');
    const g=document.createElement('a-icosahedron');
    g.classList.add('clickable');
    g.setAttribute('radius','0.18');
    g.setAttribute('color','#00ffa3');
    g.setAttribute('position','0 1.5 -2.5');
    arena.appendChild(g);
    let clicked=false;
    const T=800;
    const start=performance.now();
    const anim=()=>{
      if(!g.parentNode||!running) return;
      if(performance.now()-start>=T){
        if(!clicked){ safeRemove(g); BOSS.busy=false; setTimeout(scheduleNext,700); }
        return;
      }
      requestAnimationFrame(anim);
    };
    g.addEventListener('click',()=>{
      if(clicked) return; clicked=true;
      safeRemove(g);
      bossDamage(25);
      combo++; hits++; score+=18;
      updateHUD();
      BOSS.busy=false;
      setTimeout(scheduleNext,600);
    });
    anim();
  }

  // ===== Game Flow =====
  function clearArena(){ Array.from(byId('arena').children).forEach(c=>safeRemove(c)); }
  function start(){
    if(running) return;
    running=true; paused=false;
    score=0; combo=0; hits=0; maxCombo=0; timeLeft=60; bossIndex=0;
    byId('results').style.display='none';
    clearArena(); bossShowUI(false);
    spawnBossByIndex(bossIndex);
    updateHUD();
    timer=setInterval(()=>{
      timeLeft--;
      byId('time').textContent=timeLeft;
      if(timeLeft<=0) end();
    },1000);
  }
  function end(){
    running=false; clearInterval(timer);
    bossShowUI(false);
    byId('rScore').textContent=score;
    byId('rMaxCombo').textContent=maxCombo;
    byId('rAcc').textContent=Math.min(100,Math.round((hits/Math.max(1,combo))*100))+'%';
    byId('results').style.display='flex';
  }

  // ===== Wire Buttons =====
  function wire(){
    byId('startBtn')?.addEventListener('click',start);
    byId('pauseBtn')?.addEventListener('click',()=>{ paused=!paused; });
    byId('replayBtn')?.addEventListener('click',()=>{ byId('results').style.display='none'; start(); });
    byId('backBtn')?.addEventListener('click',()=>{ location.href=HUB_URL; });
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',wire); else wire();

})();
