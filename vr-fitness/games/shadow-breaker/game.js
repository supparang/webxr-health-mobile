/* games/shadow-breaker/game.js
   Shadow Breaker · Patched: วงแหวนขยายจริง + ดาบกากบาททำงาน + ลูปบอสต่อเนื่อง + ปุ่มเริ่มเกม
*/
(function(){
  "use strict";

  // ---------- Helpers ----------
  const byId = (id)=>document.getElementById(id);
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const getQuery=(k)=>new URLSearchParams(location.search).get(k);
  const ASSET_BASE=(document.querySelector('meta[name="asset-base"]')?.content||'').replace(/\/+$/,'');
  const HUB_URL="https://supparang.github.io/webxr-health-mobile/vr-fitness/";

  // Null-safe remove (กัน removeChild of null)
  function safeRemove(el){
    try{
      if(!el) return;
      if(el.parentNode) el.parentNode.removeChild(el);
      else if(el.remove) el.remove();
    }catch(_e){}
  }

  // UI ping
  function ping(msg,color='#ffd166'){
    let t=byId('toast'); if(!t){
      t=document.createElement('div'); t.id='toast';
      Object.assign(t.style,{position:'fixed',left:'50%',top:'12px',transform:'translateX(-50%)',
        background:'rgba(10,12,16,.9)',padding:'8px 12px',borderRadius:'10px',color:'#e6f7ff',
        font:'600 13px system-ui',zIndex:9999,transition:'opacity .2s, transform .2s'});
      document.body.appendChild(t);
    }
    t.style.color=color; t.textContent=msg; t.style.opacity='1'; t.style.transform='translateX(-50%) scale(1.02)';
    setTimeout(()=>{ t.style.opacity='0'; t.style.transform='translateX(-50%)'; }, 800);
  }

  // ---------- Audio ----------
  const SFX = {
    tel_slash: new Audio(`${ASSET_BASE}/assets/sfx/tel_slash.wav`),
    tel_shock: new Audio(`${ASSET_BASE}/assets/sfx/tel_shock.wav`),
    hp_hit:    new Audio(`${ASSET_BASE}/assets/sfx/hp_hit.wav`),
    miss:      new Audio(`${ASSET_BASE}/assets/sfx/miss.wav`),
    roar:      new Audio(`${ASSET_BASE}/assets/sfx/boss_roar.wav`),
  };
  Object.values(SFX).forEach(a=>{ try{ a.preload='auto'; a.crossOrigin='anonymous'; }catch(_e){} });
  const lastPlay=new Map();
  function play(a,guardMs=90){ try{
    const now=performance.now(); if(lastPlay.get(a)&&now-lastPlay.get(a)<guardMs) return;
    a.currentTime=0; lastPlay.set(a,now); a.play();
  }catch(_e){} }

  // ---------- Difficulty / timing ----------
  const DIFFS = {
    easy:   { hp:0.9,  atkWin:1.10, title:'EASY'   },
    normal: { hp:1.0,  atkWin:1.00, title:'NORMAL' },
    hard:   { hp:1.15, atkWin:0.92, title:'HARD'   },
    final:  { hp:1.25, atkWin:0.88, title:'FINAL'  },
  };
  function getDiffKey(){
    return (window.APP?.story?.difficulty) || getQuery('diff') || localStorage.getItem('sb_diff') || 'normal';
  }
  let D = DIFFS.normal;
  let TIME_SCALE = 1; // เผื่อปรับในอนาคต
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
  let running=false, paused=false, timer=null;
  let score=0, combo=0, maxCombo=0, hits=0, spawns=0, timeLeft=60;

  const BOSS = { active:false, busy:false, hp:0, max:1000, phase:1, rage:false, name:'', color:'#ff3355' };
  let pIndex=0, lastPattern='', survivedStreak=0;

  const ROSTER = [
    { id:'RazorFist', title:'RAZORFIST', baseHP:1000, color:'#ff3355',
      P1:['slash_cross','ground_shock'], P2:['slash_cross','ground_shock'] }
  ];

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
    ping('PHASE 2','#00ffa3');
  }

  function onBossDefeated(){
    BOSS.active=false; BOSS.busy=false;
    floatText('BOSS DEFEATED','#00ffa3', new THREE.Vector3(0,1.6,-2.3));
    score += 250; updateHUD();
    end(); // จบเดโมรอบนี้
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

  // ท่า: Ground Shock (เรียกวงแหวน)
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
      'ground_shock': doGroundShock,
      'slash_cross' : doSlashCross
    }[pattern]||(()=>{ BOSS.busy=false; setTimeout(bossLoop, dur(200)); }))();
  }

  // หลังจบท่า ให้คูลดาวน์เล็กน้อยแล้วต่อท่าถัดไป
  function finishAttack(){
    if (BOSS.phase === 2) {
      survivedStreak++;
      if (survivedStreak >= 3) { survivedStreak = 0; /* TODO: ใส่ Overheat/Bonus ถ้าต้องการ */ }
    }
    BOSS.busy=false;
    setTimeout(bossLoop, dur(BOSS.phase===2?420:560));
  }

  // ---------- Flow ----------
  function updateHUD(){
    byId('score').textContent = score;
    byId('combo').textContent = combo;
    byId('time').textContent  = timeLeft;
  }

  function playerHit(){
    combo=0; updateHUD(); play(SFX.miss);
    const scn=document.querySelector('a-scene'); scn?.classList?.add('shake-scene');
    setTimeout(()=>scn?.classList?.remove('shake-scene'), 240);
  }
  function hardMiss(anchor){
    playerHit();
    floatText('MISS','#ff5577', anchor?.object3D?.getWorldPosition?.(new THREE.Vector3()) || new THREE.Vector3(0,1.4,-2.2));
  }

  function start(){
    if(running) return;
    running=true; paused=false;
    const key=getDiffKey(); D = DIFFS[key] || DIFFS.normal;
    try{ localStorage.setItem('sb_diff', key); }catch(_){}

    score=0; combo=0; maxCombo=0; hits=0; spawns=0; timeLeft=60; updateHUD();
    bossShowUI(false);
    // เวลาเดิน
    timer=setInterval(()=>{ timeLeft--; byId('time').textContent=timeLeft; if(timeLeft<=0) end(); },1000);

    // สร้างบอส
    const cfg=ROSTER[0];
    BOSS.active=true; BOSS.busy=false; BOSS.phase=1; BOSS.rage=false;
    BOSS.max=Math.round(cfg.baseHP * D.hp); BOSS.hp=BOSS.max; BOSS.name=cfg.title; BOSS.color=cfg.color;
    bossIntro();
    pIndex=0; lastPattern=''; survivedStreak=0;

    // ให้เริ่มลูปชัวร์
    setTimeout(bossLoop, dur(900));
  }

  function end(){
    running=false; paused=false;
    clearInterval(timer); timer=null;
    bossShowUI(false);
    // ผลลัพธ์
    byId('rScore').textContent = score;
    byId('rMaxCombo').textContent = maxCombo;
    byId('rAcc').textContent = (spawns? Math.round((hits/spawns)*100):0) + '%';
    byId('results').style.display='flex';
  }

  function togglePause(){
    if(!running) return;
    paused=!paused;
    if(paused){ clearInterval(timer); timer=null; ping('PAUSED'); }
    else{
      timer=setInterval(()=>{ timeLeft--; byId('time').textContent=timeLeft; if(timeLeft<=0) end(); },1000);
      ping('RESUME','#00ffa3'); bossLoop();
    }
  }

  // ---------- Wire buttons ----------
  function wireUI(){
    byId('startBtn')?.addEventListener('click', start);
    byId('pauseBtn')?.addEventListener('click', togglePause);
    byId('replayBtn')?.addEventListener('click', ()=>{ byId('results').style.display='none'; start(); });
    byId('backBtn')?.addEventListener('click', ()=>{ location.href = HUB_URL; });
    // คีย์ลัด
    addEventListener('keydown', (e)=>{
      if(e.code==='Space'){ e.preventDefault(); if(!running) start(); else togglePause(); }
      if(e.code==='Escape'){ if(running) end(); }
    });
  }

  // ---------- Mouse raycast (ให้คลิก a-entity ได้ด้วยเมาส์) ----------
  function installMouseRaycast(){
    const sceneEl=document.querySelector('a-scene'); if(!sceneEl) return;
    const ray=new THREE.Raycaster(); const mouse=new THREE.Vector2();
    function shoot(e){
      const cam=sceneEl.camera; if(!cam) return;
      mouse.x=(e.clientX/window.innerWidth)*2-1;
      mouse.y=-(e.clientY/window.innerHeight)*2+1;
      ray.setFromCamera(mouse,cam);
      const objs=[]; Array.from(document.querySelectorAll('.clickable')).forEach(el=>el.object3D?.traverse(n=>objs.push(n)));
      const hits=ray.intersectObjects(objs,true);
      if(hits?.length){
        let o=hits[0].object; while(o && !o.el) o=o.parent; if(o?.el) o.el.emit('click');
      }
    }
    addEventListener('mousedown',shoot,{passive:true});
    addEventListener('touchstart',(e)=>{ const t=e.touches?.[0]; if(!t) return; shoot({clientX:t.clientX, clientY:t.clientY}); },{passive:true});
  }

  function boot(){
    wireUI();
    installMouseRaycast();
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
