/* games/shadow-breaker/game.js
   Shadow Breaker · ULTIMATE (15-Features-in-1)
   - Adaptive AI / Critical / Shadow Clone / Blade Counter / Finisher
   - EXP+Badges / Training / Mission Board / Dynamic Difficulty
   - Cinematic Intro & Finisher / Themed Arena
   - Energy (Super Gauge) / Crowd+Coach / Post-Game Timeline
   - No “auto miss” on ignoring targets (no accidental punishment)
*/
(function(){
  "use strict";

  // -------------------- Utils & Config --------------------
  const $ = (id)=>document.getElementById(id);
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const HUB_URL="https://supparang.github.io/webxr-health-mobile/vr-fitness/";
  const ASSET_BASE=(document.querySelector('meta[name="asset-base"]')?.content||'').replace(/\/+$/,'');
  const getQ=(k)=>new URLSearchParams(location.search).get(k);
  const inTraining = (getQ('mode')==='training'); // โหมดซ้อม (ไม่มีเวลา/ไม่มีแพ้)

  // Null-safe removal
  function safeRemove(el){ try{ if(!el) return; if(el.parentNode) el.parentNode.removeChild(el); else el.remove?.(); }catch(_){} }

  // Toast
  function toast(msg, color='#ffd166'){ let t=$('toast'); if(!t){ t=document.createElement('div'); t.id='toast';
    Object.assign(t.style,{position:'fixed',left:'50%',top:'10px',transform:'translateX(-50%)',
      background:'rgba(0,0,0,.75)',color:'#fff',padding:'8px 12px',borderRadius:'10px',
      font:'600 12px system-ui',zIndex:99999,transition:'opacity .2s,transform .2s'});
    document.body.appendChild(t);} t.style.color=color; t.textContent=msg; t.style.opacity='1';
    t.style.transform='translateX(-50%) scale(1.02)'; setTimeout(()=>{ t.style.opacity='0';t.style.transform='translateX(-50%)';},900);
  }

  // Badges / i18n proxy
  const APPX={ badge:(t)=>{ if(window.APP?.badge) APP.badge(t); else console.log('[BADGE]',t); } };

  // RNG
  function dailySeed(){ const d=new Date(); const s=`${d.getUTCFullYear()}-${d.getUTCMonth()+1}-${d.getUTCDate()}`;
    let h=0; for(const c of s) h=(h*131+c.charCodeAt(0))>>>0; return h>>>0; }
  let seed=dailySeed();
  function RND(){ seed=(seed*1664525+1013904223)>>>0; return (seed&0x7fffffff)/0x80000000; }

  // SFX
  const SFX=(name)=>{ const a=new Audio(`${ASSET_BASE}/assets/sfx/${name}.wav`); a.crossOrigin='anonymous'; a.preload='auto'; return a; };
  const AUDIO={
    slash:SFX('slash'),
    perfect:SFX('perfect'),
    miss:SFX('miss'),
    combo:SFX('combo'),
    hp:SFX('hp_hit'),
    roar:SFX('boss_roar'),
    tel_slash:SFX('tel_slash'),
    tel_shock:SFX('tel_shock'),
    enrage:SFX('enrage'),
    success:SFX('success'),
    coach_now:SFX('success'),
    crowd_wow:SFX('combo'),
  };

  // Coach (มุมล่างซ้ายถัดจาก Bank)
  function ensureCoachDock(){
    if($('coachDock')) return;
    const d=document.createElement('div'); d.id='coachDock';
    Object.assign(d.style,{
      position:'fixed',left:'12px',bottom:'58px', // อยู่ถัดจากปุ่ม Bank (ซ้ายล่าง)
      background:'rgba(0,0,0,.5)',color:'#e6f7ff',
      padding:'6px 10px',borderRadius:'10px',font:'600 12px system-ui',zIndex:9999,
      maxWidth:'60vw'
    });
    d.textContent='Coach ready! กด Start เพื่อเริ่ม';
    document.body.appendChild(d);
  }
  function coach(msg){ ensureCoachDock(); $('coachDock').textContent=msg; }

  // Theming (ฉากเปลี่ยน)
  const THEMES=[
    { sky:'#0a0f14', name:'Dojo Night' },
    { sky:'#121a26', name:'Neon' },
    { sky:'#060b10', name:'Storm' },
  ];
  function applyTheme(i=0){
    const a=document.querySelector('a-scene'); if(!a) return;
    let bg=document.getElementById('arenaBG'); if(!bg){
      bg=document.createElement('a-entity'); bg.id='arenaBG';
      a.appendChild(bg);
    }
    const sky=THEMES[(i%THEMES.length)].sky;
    // แผงพื้นหลัง
    let p=bg.querySelector('a-plane'); if(!p){ p=document.createElement('a-plane'); bg.appendChild(p); }
    p.setAttribute('color', sky); p.setAttribute('position','0 1.5 -3'); p.setAttribute('width','8'); p.setAttribute('height','4'); p.setAttribute('opacity','0.82');
  }

  // -------------------- Difficulty & State --------------------
  const DIFFS={ easy:{hp:0.85, score:0.9, spawn:900}, normal:{hp:1.0, score:1.0, spawn:820}, hard:{hp:1.2, score:1.1, spawn:780}, final:{hp:1.35, score:1.2, spawn:740} };
  function getDiffKey(){ return localStorage.getItem('sb_diff') || getQ('diff') || 'normal'; }

  const STANCES={ swift:{dmg:0.95, title:'SWIFT'}, power:{dmg:1.2, title:'POWER'} };
  let ST=STANCES.swift;

  // Game state
  let running=false, paused=false;
  let score=0, bank=0, combo=0, maxCombo=0, hits=0, timeLeft=60, spawns=0;
  let CURRENT_BOSS=0, fever=false, feverT=0, ADAPT=1;
  let timer=null, spawnTimer=null;
  let D=DIFFS.normal;

  // Energy/Super Gauge
  let energy=0; // 0..100 -> กดท่าไม้ตาย
  function addEnergy(v){ energy=clamp(energy+v,0,100); updateHUD(); }

  // Timeline เก็บวินาที/เหตุการณ์
  const TL=[]; const timeNow=()=> (performance.now()/1000).toFixed(2);

  // EXP & Badges & Missions
  const XP={total: +(localStorage.getItem('sb_xp')||0)};
  const BADGE=JSON.parse(localStorage.getItem('sb_badge')||'{}');
  const MISSIONS=[
    {id:'noBankWin', title:'ชนะรอบโดยไม่กด Bank', ok:false, check:()=> (winNoBank) },
    {id:'combo50',   title:'ทำคอมโบ 50+', ok:false, check:()=> (maxCombo>=50) },
    {id:'fever3',    title:'เข้า Fever 3 ครั้ง', ok:false, check:()=> (feverCount>=3) }
  ];
  let winNoBank=true, feverCount=0;

  // Boss object
  const BOSS={active:false, hp:0, max:1000, phase:1, rage:false, busy:false, armor:0, color:'#ff3355', name:'', P1:[], P2:[]};

  // HUD
  function updateHUD(){
    $('score').textContent=Math.round(score*D.score + bank);
    $('combo').textContent=combo;
    $('time').textContent=inTraining? '∞' : timeLeft;
    $('phaseLabel').textContent='Phase '+BOSS.phase;
    const fill=$('bossHPFill'); if(fill){ fill.style.width=((BOSS.hp/BOSS.max)*100)+'%'; }
    // Energy bar (ใช้ element ที่มี id=energyBar ถ้ามี)
    let e=$('energyBar'); if(!e){
      e=document.createElement('div'); e.id='energyBar';
      Object.assign(e.style,{position:'fixed',right:'12px',bottom:'56px',width:'160px',height:'8px',background:'#0b1118',border:'1px solid #203446',borderRadius:'10px',overflow:'hidden',zIndex:9999});
      const f=document.createElement('div'); f.id='energyFill';
      Object.assign(f.style,{height:'100%',width:'0%',background:'#00ffa3',transition:'width .15s'});
      e.appendChild(f); document.body.appendChild(e);
    }
    const ef=$('energyFill'); if(ef){ ef.style.width=energy+'%'; }
  }

  // Fever
  function tryFever(){ if(!fever && combo>=25){ fever=true; feverT=performance.now()+8000; feverCount++; toast('FEVER! x1.5','#ffd166'); APPX.badge('FEVER!'); } }
  function tickFever(){ if(fever && performance.now()>feverT){ fever=false; toast('Fever End','#9bd1ff'); } }
  setInterval(tickFever,150);

  // -------------------- Boss roster & Patterns --------------------
  const BOSSES=[
    { id:'RazorFist', title:'RAZORFIST', baseHP:1000, color:'#ff3355',
      P1:['ring_wave','blade_simple','guard_core'],
      P2:['shadow_dash','blade_multi','enrage_combo'] },
    { id:'AshOni', title:'ASH ONI', baseHP:1200, color:'#ffa133',
      P1:['ring_seq','blade_simple','guard_core'],
      P2:['clone_trick','ring_wave_fast','counter_test'] },
    { id:'Nightblade', title:'NIGHTBLADE', baseHP:1400, color:'#7a5cff',
      P1:['blade_rand','laser_grid','guard_core'],
      P2:['orb_spiral','blade_multi_fast','rage_finale'] },
    { id:'VoidEmperor', title:'VOID EMPEROR', baseHP:1800, color:'#8cf5ff',
      P1:['mirror_slash','doom_rings','laser_grid'],
      P2:['orb_spiral_fast','void_finale','rush_phase'] }
  ];

  function makeRoster(diff){
    if(diff==='easy')   return [BOSSES[0]];
    if(diff==='normal') return [BOSSES[0],BOSSES[1]];
    if(diff==='hard')   return [BOSSES[0],BOSSES[1],BOSSES[2]];
    return BOSSES.slice(0,4);
  }
  let ROSTER=makeRoster(getDiffKey());

  // Cinematic intro
  function bossIntro(){
    applyTheme(CURRENT_BOSS);
    const arena=$('arena');
    const anchor=document.createElement('a-entity'); anchor.id='bossAnchor'; anchor.setAttribute('position','0 1.5 -3');
    const head=document.createElement('a-sphere'); head.setAttribute('radius','0.34'); head.setAttribute('color','#0c0c0c');
    const mask=document.createElement('a-box'); mask.setAttribute('depth','0.06'); mask.setAttribute('width','0.55'); mask.setAttribute('height','0.45'); mask.setAttribute('color',BOSS.color); mask.setAttribute('position','0 0 0.24');
    anchor.appendChild(head); anchor.appendChild(mask); arena.appendChild(anchor);
    AUDIO.roar.play(); APPX.badge(BOSS.name+' · '+(ST.title||'')); $('bossBar').style.display='block';
  }

  function bossSpawn(i=0){
    const cfg=ROSTER[i]; BOSS.active=true; BOSS.phase=1; BOSS.busy=false;
    BOSS.name=cfg.title; BOSS.color=cfg.color; BOSS.max=Math.round(cfg.baseHP*D.hp); BOSS.hp=BOSS.max; BOSS.P1=cfg.P1.slice(); BOSS.P2=cfg.P2.slice();
    bossIntro(); scheduleNext();
  }

  // -------------------- Scoring & Events --------------------
  function floatText(text, color, pos){
    const e=document.createElement('a-entity'), p=pos.clone(); p.y+=0.18;
    e.setAttribute('text',{value:text,color,align:'center',width:3});
    e.setAttribute('position',`${p.x} ${p.y} ${p.z}`);
    e.setAttribute('scale','0.001 0.001 0.001');
    e.setAttribute('animation__in',{property:'scale',to:'1 1 1',dur:90,easing:'easeOutBack'});
    e.setAttribute('animation__fade',{property:'opacity',to:0,dur:520,delay:200});
    $('arena').appendChild(e); setTimeout(()=>safeRemove(e),900);
  }
  function addScore(v){ const mul=fever?1.5:1; score+=Math.round(v*mul); updateHUD(); }

  function onHitQuality(kind, pos){
    if(kind==='CRIT'){ addScore(40); AUDIO.perfect.play(); floatText('CRITICAL!!','#00ffa3',pos); combo++; }
    else if(kind==='PERFECT'){ addScore(20); AUDIO.perfect.play(); floatText('PERFECT','#00ffa3',pos); combo++; }
    else if(kind==='GOOD'){ addScore(10); AUDIO.slash.play(); floatText('GOOD','#00d0ff',pos); combo++; }
    maxCombo=Math.max(maxCombo,combo);
    if(combo>0 && combo%10===0){ AUDIO.combo.play(); APPX.badge('Combo x'+(1+Math.floor(combo/10))); }
    tryFever(); addEnergy(2);
    TL.push({t:timeNow(), evt:kind});
    updateHUD();
  }

  // ไม่กด = ไม่ miss (ตามคำสั่ง)
  function onMiss(pos){
    TL.push({t:timeNow(), evt:'MISS'}); // แค่ log, ไม่หักคอมโบ/คะแนน
    // (ถ้าอยากเตือนเบา ๆ)
    floatText('MISS','#ff5577',pos);
    // coach เฉพาะพลาดซ้ำแบบ regex (เช่น วงแหวน)
    missRingCount++; if(missRingCount>=3){ coach('ใบ้: วงแหวนต้อง “คลิกตอนขอบชนพอดี” จะได้ GOOD/CRIT'); missRingCount=0; }
  }

  // -------------------- Patterns Core --------------------
  function doneAttack(delay=520){ BOSS.busy=false; setTimeout(scheduleNext, delay); }
  function scheduleNext(){
    if(!running || !BOSS.active || BOSS.busy) return;
    const arr=(BOSS.phase===1? BOSS.P1 : BOSS.P2);
    const key=arr[(Math.floor(RND()*arr.length))];
    (PATTERNS[key]||(()=>doneAttack()))();
  }

  // Critical window helper
  function makeRing({x=0,y=1.2,z=-2.6,dur=650,critW=0.06,goodW=0.14,color='#ffd166', fast=false}={}){
    const r=document.createElement('a-ring'); r.classList.add('clickable','boss-attack');
    r.setAttribute('position',`${x} ${y} ${z}`); r.setAttribute('radius-inner','0.05'); r.setAttribute('radius-outer','0.07');
    r.setAttribute('material',`color:${color};opacity:.96;shader:flat`);
    $('arena').appendChild(r);
    const T=fast? (dur*0.72) : dur;
    const t0=performance.now();
    function step(){
      if(!r.parentNode) return;
      const t=(performance.now()-t0)/T; const base=0.07+t*0.95;
      r.setAttribute('radius-inner',Math.max(0.01,base-0.02)); r.setAttribute('radius-outer',base);
      if(t<1) requestAnimationFrame(step); else { safeRemove(r); onMiss(new THREE.Vector3(x,y,z)); }
    }
    requestAnimationFrame(step);

    // Hit window detection
    function click(){
      // ตรวจจับจังหวะ: ให้ CRIT ที่ช่วงฐาน r ประมาณ 0.42–0.46 ของทาง (สั้นมาก)
      const t=(performance.now()-t0)/T;
      const center=0.45; // เป้ากลาง
      const dt=Math.abs(t-center);
      const pos=new THREE.Vector3(x,y,z);
      if(dt<=critW) onHitQuality('CRIT',pos);
      else if(dt<=goodW) onHitQuality('PERFECT',pos);
      else onHitQuality('GOOD',pos);
      safeRemove(r);
    }
    r.addEventListener('click', click);
    r.addEventListener('mousedown', click);
    return r;
  }

  // Blade counter (สวนกลับช่วงสั้น)
  function makeBlade({rot=-30,y=1.38,z=-2.2,color='#5de1ff',window=0.20,stun=1500}={}){
    const g=document.createElement('a-entity');
    g.classList.add('clickable','boss-attack');
    g.setAttribute('geometry','primitive: box; height: 0.035; width: 1.25; depth: 0.035');
    g.setAttribute('material',`color:${color};opacity:.95;transparent:true`);
    g.setAttribute('rotation',`0 0 ${rot}`); g.setAttribute('position',`0 ${y} ${z}`);
    $('arena').appendChild(g);
    const t0=performance.now(); AUDIO.tel_slash.play();
    let done=false;
    function click(){
      if(done) return; done=true;
      const dt=(performance.now()-t0)/1000;
      if(dt<=window){ // เคาน์เตอร์สำเร็จ
        TL.push({t:timeNow(),evt:'COUNTER'});
        floatText('COUNTER!','#00ffa3',new THREE.Vector3(0,y,z));
        addScore(30); addEnergy(10); // สตั๊นบอส
        BOSS.busy=true; setTimeout(()=>{ BOSS.busy=false; }, stun);
      }else{
        onHitQuality('GOOD', new THREE.Vector3(0,y,z));
      }
      safeRemove(g); doneAttack(380);
    }
    g.addEventListener('click', click); g.addEventListener('mousedown', click);
    setTimeout(()=>{ if(g.parentNode){ safeRemove(g); onMiss(new THREE.Vector3(0,y,z)); doneAttack(120);} }, 560);
  }

  // Clone (ตัวจริง + ตัวหลอก)
  function makeCloneSet(){
    const realIndex = (RND()<0.5? 0:1);
    const clones = [-0.6,0.6].map((x,i)=>{
      const b=document.createElement('a-box'); b.classList.add('clickable','boss-attack');
      b.setAttribute('width','0.5'); b.setAttribute('height','0.3'); b.setAttribute('depth','0.05');
      b.setAttribute('color', i===realIndex? '#00ffa3':'#7a5cff'); b.setAttribute('position',`${x} 1.1 -2.0`);
      $('arena').appendChild(b); return b;
    });
    let resolved=false;
    clones.forEach((el,i)=>el.addEventListener('click', ()=>{
      if(resolved) return; resolved=true;
      if(i===realIndex){ onHitQuality('PERFECT', el.object3D.getWorldPosition(new THREE.Vector3())); addScore(20); }
      else{ floatText('FAKE','#ff5577', el.object3D.getWorldPosition(new THREE.Vector3())); }
      clones.forEach(safeRemove); doneAttack(420);
    }));
    setTimeout(()=>{ clones.forEach(c=>{ if(c.parentNode) safeRemove(c); }); if(!resolved) onMiss(new THREE.Vector3(0,1.1,-2)); doneAttack(120); }, 700);
  }

  // Bomb that breaks combo only (ไม่หักคะแนน)
  function spawnBomb(){
    const g=document.createElement('a-icosahedron'); g.classList.add('clickable','boss-attack');
    g.setAttribute('position','0 1.55 -2.3'); g.setAttribute('radius','0.18'); g.setAttribute('color','#ff3355');
    $('arena').appendChild(g);
    function click(){
      combo=0; floatText('BOMB! Combo Reset','#ff5577', g.object3D.getWorldPosition(new THREE.Vector3())); safeRemove(g); doneAttack(300);
    }
    g.addEventListener('click', click); g.addEventListener('mousedown', click);
    setTimeout(()=>{ if(g.parentNode) safeRemove(g); doneAttack(120); }, 900);
  }

  // Patterns
  let missRingCount=0;
  const PATTERNS={
    ring_wave(){ AUDIO.tel_shock.play(); makeRing({}); doneAttack(740); },
    ring_seq(){ AUDIO.tel_shock.play(); makeRing({x:-0.7}); setTimeout(()=>makeRing({x:0}),220); setTimeout(()=>makeRing({x:0.7}),440); doneAttack(900); },
    ring_wave_fast(){ AUDIO.tel_shock.play(); makeRing({fast:true}); setTimeout(()=>makeRing({x:0.55,fast:true}),140); setTimeout(()=>makeRing({x:-0.55,fast:true}),280); doneAttack(820); },

    blade_simple(){ makeBlade({}); },
    blade_multi(){ makeBlade({rot:-35}); setTimeout(()=>makeBlade({rot:35}),180); },
    blade_multi_fast(){ makeBlade({rot:-32,window:0.15}); setTimeout(()=>makeBlade({rot:0,window:0.15}),160); setTimeout(()=>makeBlade({rot:32,window:0.15}),320); },

    guard_core(){ // เพชรแตกแล้วได้พลัง
      const g=document.createElement('a-icosahedron'); g.classList.add('clickable','boss-attack');
      g.setAttribute('position','0 1.45 -2.3'); g.setAttribute('radius','0.18'); g.setAttribute('color','#ffd166');
      $('arena').appendChild(g);
      const click=()=>{ onHitQuality('PERFECT', g.object3D.getWorldPosition(new THREE.Vector3())); addEnergy(8); safeRemove(g); doneAttack(360); };
      g.addEventListener('click', click); g.addEventListener('mousedown', click);
      setTimeout(()=>{ if(g.parentNode){ safeRemove(g); onMiss(new THREE.Vector3(0,1.45,-2.3)); doneAttack(120); } }, 700);
    },

    shadow_dash(){ // หลบ/เลือกข้าง
      const L=document.createElement('a-box'), R=document.createElement('a-box');
      [L,R].forEach((b,i)=>{ b.classList.add('clickable','boss-attack'); b.setAttribute('width','0.5'); b.setAttribute('height','0.3'); b.setAttribute('depth','0.05');
        b.setAttribute('color', i? '#00d0ff':'#00ffa3'); b.setAttribute('position', `${i?0.9:-0.9} 1.0 -2.0`); $('arena').appendChild(b); });
      let ok=false; const hit=(box)=>{ if(ok) return; ok=true; onHitQuality('GOOD', box.object3D.getWorldPosition(new THREE.Vector3())); [L,R].forEach(safeRemove); doneAttack(300); };
      L.addEventListener('click',()=>hit(L)); R.addEventListener('click',()=>hit(R));
      setTimeout(()=>{ if(!ok) onMiss(new THREE.Vector3(0,1.0,-2.0)); [L,R].forEach(safeRemove); doneAttack(120); }, 760);
    },

    clone_trick(){ makeCloneSet(); },

    laser_grid(){ // คัทสองเส้น
      const mk=(y,rot)=>{ const b=document.createElement('a-entity');
        b.classList.add('clickable','boss-attack'); b.setAttribute('geometry','primitive: box; height:0.035;width:1.4;depth:0.03');
        b.setAttribute('material','color:#5de1ff;opacity:.95;transparent:true');
        b.setAttribute('position',`0 ${y} -2.2`); b.setAttribute('rotation',`0 0 ${rot}`); $('arena').appendChild(b); return b; };
      const a=mk(1.3,-14), b=mk(1.5,14); AUDIO.tel_shock.play();
      let ca=false, cb=false;
      const clickA=()=>{ ca=true; onHitQuality('GOOD', a.object3D.getWorldPosition(new THREE.Vector3())); safeRemove(a); check(); };
      const clickB=()=>{ cb=true; onHitQuality('GOOD', b.object3D.getWorldPosition(new THREE.Vector3())); safeRemove(b); check(); };
      a.addEventListener('click',clickA); b.addEventListener('click',clickB);
      function check(){ if(ca&&cb){ doneAttack(300); } }
      setTimeout(()=>{ [a,b].forEach(el=>{ if(el.parentNode){ safeRemove(el);} }); doneAttack(120); }, 800);
    },

    orb_spiral(){ // วิ่งวน (คลิกทุบ)
      const center=new THREE.Vector3(0,1.4,-2.3);
      const orbs=[]; for(let i=0;i<4;i++){ const o=document.createElement('a-sphere'); o.classList.add('clickable','boss-attack');
        o.setAttribute('radius','0.1'); o.setAttribute('color','#a899ff'); o.dataset.theta=(i/4)*Math.PI*2; $('arena').appendChild(o);
        const click=()=>{ onHitQuality('GOOD', o.object3D.getWorldPosition(new THREE.Vector3())); safeRemove(o); };
        o.addEventListener('click',click); orbs.push(o);
      }
      const T=2000, t0=performance.now();
      function step(){
        const t=(performance.now()-t0)/T; let alive=false;
        orbs.forEach((o,idx)=>{ if(!o.parentNode) return; alive=true;
          const th=(+o.dataset.theta)+t*3.2; const r=0.55+0.2*Math.sin(t*4+idx);
          o.setAttribute('position', `${(center.x+Math.cos(th)*r).toFixed(3)} ${(center.y+Math.sin(th)*r*0.6).toFixed(3)} ${center.z}`);
        });
        if(t<1 && alive) requestAnimationFrame(step); else { orbs.forEach(safeRemove); doneAttack(180); }
      }
      requestAnimationFrame(step);
    },

    mirror_slash(){ makeBlade({rot:-28}); setTimeout(()=>makeBlade({rot:28}),160); },
    doom_rings(){ makeRing({x:-0.6}); setTimeout(()=>makeRing({x:0}),180); setTimeout(()=>makeRing({x:0.6}),360); },
    orb_spiral_fast(){ const saved=this.orb_spiral; PATTERNS.orb_spiral(); }, // ใช้ชุดเดียวแบบเร็วขึ้นผ่าน makeRing fast ก็ได้

    enrage_combo(){ AUDIO.enrage.play(); makeRing({}); setTimeout(()=>makeBlade({}),220); setTimeout(()=>spawnBomb(),450); doneAttack(820); },
    counter_test(){ makeBlade({window:0.18}); },

    rage_finale(){ AUDIO.enrage.play(); makeBlade({rot:-26,window:0.16}); setTimeout(()=>makeRing({fast:true}),220); setTimeout(()=>makeBlade({rot:26,window:0.16}),420); doneAttack(820); },

    // โหมด Rush 10 วินาทีท้ายเฟส 2
    rush_phase(){
      if(BOSS.phase!==2){ doneAttack(120); return; }
      const endAt=performance.now()+10000; AUDIO.enrage.play(); APPX.badge('RUSH PHASE!!');
      (function loop(){
        if(performance.now()>endAt){ doneAttack(240); return; }
        const r=RND(); if(r<0.4) PATTERNS.ring_wave_fast(); else if(r<0.8) PATTERNS.blade_multi_fast(); else PATTERNS.laser_grid();
        setTimeout(loop, 260);
      })();
    },
  };

  // -------------------- Boss Damage & Phase --------------------
  function bossDamage(dmg, pos){
    const v=Math.max(1, Math.round(dmg*(ST.dmg||1)));
    BOSS.hp=clamp(BOSS.hp - v, 0, BOSS.max); AUDIO.hp.play(); updateHUD();
    floatText('-'+v, '#ff9c6b', pos||new THREE.Vector3(0,1.5,-3));
    if(BOSS.phase===1 && (BOSS.hp/BOSS.max)<=0.5) enterPhase2();
    if(BOSS.hp<=0) bossDefeated();
  }
  function enterPhase2(){
    BOSS.phase=2; APPX.badge('Phase 2'); AUDIO.enrage.play(); coach('ระวัง Rush Phase 10 วิ. ท้าย!');
  }
  function bossDefeated(){
    floatText('BOSS DEFEATED','#00ffa3', new THREE.Vector3(0,1.6,-2.3));
    addScore(250); BOSS.active=false; $('bossBar').style.display='none';
    // ถ้ามีบอสถัดไป + เวลาเหลือ (training mode ข้ามเงื่อนไขเวลา)
    if(CURRENT_BOSS < ROSTER.length-1 && (inTraining || timeLeft>=15)){
      CURRENT_BOSS++; APPX.badge('Next Boss…'); clearArena(); setTimeout(()=>bossSpawn(CURRENT_BOSS), 900);
    }else{ end(); }
  }

  // -------------------- Player-facing Systems --------------------
  function clearArena(){ const a=$('arena'); Array.from(a.children).forEach(safeRemove); }

  // Finisher/Shadow Burst (เมื่อ energy=100 หรือ combo>=50)
  function tryFinisher(){
    if(energy<100 && combo<50) { toast('เกจยังไม่พอ!'); return; }
    energy=0; updateHUD(); APPX.badge('SHADOW BURST!!'); AUDIO.success.play();
    // กล้องแฟลชเล็กน้อย + dmg ก้อน
    bossDamage(150, new THREE.Vector3(0,1.5,-3));
  }

  // Accessibility (สูงคอนทราสต์ + HUD +15%)
  function applyAccessibility(){
    if(getQ('acc')!=='on') return;
    document.body.style.filter='contrast(1.15) saturate(1.02)';
    document.querySelectorAll('#hud, #hudStatus, #coachDock').forEach(el=>{
      el && (el.style.fontSize='115%');
    });
    toast('Accessibility: +Contrast +HUD size');
  }

  // -------------------- Game Flow --------------------
  let timeTicker=null;
  function start(){
    if(running) return;
    running=true; paused=false;
    D=DIFFS[getDiffKey()]||DIFFS.normal;
    ROSTER=makeRoster(getDiffKey());
    CURRENT_BOSS=0; combo=0; maxCombo=0; hits=0; spawns=0; score=0; bank=0; energy=0; TL.length=0; winNoBank=true; fever=false; feverT=0; missRingCount=0;
    clearArena(); coach('เริ่ม! โฟกัสที่ “ขอบชนพอดี” ของวงแหวนเพื่อ CRITICAL');
    updateHUD();
    $('results').style.display='none';
    $('bossBar').style.display='block';
    if(!inTraining){
      timeLeft=60; $('time').textContent=timeLeft;
      timeTicker=setInterval(()=>{ if(!running) return; timeLeft--; $('time').textContent=timeLeft; if(timeLeft<=0) end(); },1000);
    } else {
      $('time').textContent='∞';
    }
    bossSpawn(CURRENT_BOSS);
  }
  function end(){
    if(!running) return;
    running=false; paused=false;
    try{ clearInterval(timeTicker); }catch(_){}
    $('bossBar').style.display='none';

    // EXP & badge & missions
    if(maxCombo>=50) BADGE.combo50=true;
    MISSIONS.forEach(m=>{ m.ok = m.check(); });
    XP.total += Math.round((score*D.score + bank)/20);
    localStorage.setItem('sb_xp', XP.total);
    localStorage.setItem('sb_badge', JSON.stringify(BADGE));

    // Summary
    $('rScore').textContent=Math.round(score*D.score + bank);
    $('rMaxCombo').textContent=maxCombo;
    $('rAcc').textContent= (spawns? Math.round((hits/spawns)*100):0)+'%';
    $('rDiff').textContent=(getDiffKey()||'normal').toUpperCase()+' · '+ST.title;
    const star = (maxCombo>=50?1:0) + (feverCount>=2?1:0) + (inTraining?0:(timeLeft>=10?1:0));
    $('rStars').textContent='★'.repeat(star)+'☆'.repeat(3-star);
    $('results').style.display='flex';
    // Timeline text (ย่อ)
    const tlBox = (function ensure(){
      let b=$('tlBox'); if(b) return b;
      b=document.createElement('div'); b.id='tlBox'; b.style.marginTop='8px'; b.style.font='12px system-ui'; b.style.maxHeight='120px'; b.style.overflow='auto';
      $('results')?.querySelector('.card')?.appendChild(b); return b;
    })();
    tlBox.innerHTML = '<div style="opacity:.8">Timeline: '+ TL.slice(-20).map(e=>`${e.t}s:${e.evt}`).join(' | ') +'</div>';

    // Dynamic difficulty suggestion
    if(maxCombo>=60) localStorage.setItem('sb_diff','hard');

    AUDIO.success.play();
  }
  function togglePause(){
    if(!running) return;
    paused=!paused;
    if(paused){ APPX.badge('Paused'); toast('PAUSED'); }
    else { APPX.badge('Resume'); toast('RESUME','#00ffa3'); }
  }
  function bankNow(){ const add=Math.floor(combo*3); bank+=add; combo=0; APPX.badge('Bank +'+add); updateHUD(); winNoBank=false; }

  // -------------------- Inputs & Wiring --------------------
  function wire(){
    $('startBtn')?.addEventListener('click', start);
    $('replayBtn')?.addEventListener('click', start);
    $('backBtn')?.addEventListener('click', ()=>{ location.href=HUB_URL; });
    $('pauseBtn')?.addEventListener('click', togglePause);
    $('bankBtn')?.addEventListener('click', bankNow);
    document.addEventListener('keydown', (e)=>{
      if(e.key==='p'||e.key==='P') togglePause();
      if(e.key==='b'||e.key==='B') bankNow();
      if(e.key==='z'||e.key==='Z'||e.code==='Space') tryFinisher();
    });
    // Pointer raycast fallback
    (function pointer(){
      const scene=document.querySelector('a-scene'); if(!scene) return;
      const ray=new THREE.Raycaster(), vec=new THREE.Vector2();
      function pick(cx,cy){
        const cam=scene.camera; if(!cam) return;
        vec.x=(cx/window.innerWidth)*2-1; vec.y=-(cy/window.innerHeight)*2+1;
        ray.setFromCamera(vec, cam);
        const els=Array.from(document.querySelectorAll('.clickable')).map(el=>el.object3D).filter(Boolean);
        const objs=[]; els.forEach(o=>o.traverse(c=>objs.push(c)));
        const hits=ray.intersectObjects(objs,true);
        if(hits && hits.length){ let o=hits[0].object; while(o && !o.el) o=o.parent; o?.el?.emit('click'); }
      }
      window.addEventListener('mousedown',e=>pick(e.clientX,e.clientY),{passive:true});
      window.addEventListener('touchstart',e=>{ const t=e.touches?.[0]; if(t) pick(t.clientX,t.clientY); },{passive:true});
    })();
  }

  // -------------------- Boot --------------------
  function boot(){
    wire(); ensureCoachDock(); applyTheme(0); applyAccessibility(); updateHUD();
    coach('Tip: วงแหวน = จิ้มตอนขอบชนพอดี (CRITICAL), ดาบ = สวนภายใน 0.2s');
  }
  if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded', boot); } else boot();

  // iOS audio unlock
  (function unlock(){
    const C=window.AudioContext||window.webkitAudioContext; if(!C) return;
    const cx=new C(); function resume(){
      cx.resume?.();
      if(cx.state==='running'){ window.removeEventListener('touchstart',resume); window.removeEventListener('mousedown',resume); window.removeEventListener('keydown',resume); }
    }
    window.addEventListener('touchstart',resume,{once:true,passive:true});
    window.addEventListener('mousedown',resume,{once:true,passive:true});
    window.addEventListener('keydown',resume,{once:true,passive:true});
  })();

})();
