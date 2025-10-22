/* Shadow Breaker · game.js (Boss chaining: beat Boss 1 within time → auto-load Boss 2) */
(function(){
  // ---------- Helpers ----------
  const $ = (q)=>document.querySelector(q);
  const byId = (id)=>document.getElementById(id);
  const after = (ms, fn)=>setTimeout(fn, ms);
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const APPX={ badge:(t)=>{ if(window.APP?.badge) APP.badge(t); else console.log('[BADGE]',t); }, t:(k)=>window.APP?.t?APP.t(k):k };

  // ---------- State ----------
  let running=false, timer=null, spawnTimer=null;
  let score=0, combo=0, maxCombo=0, hits=0, spawns=0, timeLeft=60;

  // ---------- Chain rule (เปลี่ยนได้) ----------
  const CHAIN_RULE = { minTimeLeft: 15 }; // วินาทีที่ต้องเหลือเพื่อไปบอส 2
  let CURRENT_BOSS = 0;

  // ---------- Boss roster (เพิ่ม/แก้บอสได้ที่นี่) ----------
  const BOSSES = [
    {
      id:'RazorFist', title:'RAZORFIST', maxHP:1000, color:'#ff3355',
      P1:['slash_cross','rapid_fist','guard_break'],
      P2:['shadow_dash','multi_slash','enrage_combo']
    },
    {
      id:'AshOni', title:'ASH ONI', maxHP:1200, color:'#ffa133',
      // เปลี่ยนลำดับ/สไตล์ให้ต่างจากบอสแรก
      P1:['shadow_dash','guard_break','rapid_fist'],
      P2:['multi_slash','ground_shock','enrage_combo_fast'] // มีท่าใหม่ ground_shock+เวอร์ชันเร็ว
    }
  ];

  // ---------- Targets ----------
  const TYPES=[
    {id:'basic', color:'#00d0ff', baseGood:20, basePerfect:30, life:2200, req:'any'},
    {id:'heavy', color:'#ff6b6b', baseGood:40, basePerfect:60, life:2600, req:'angle', angle:'diag_lr'},
    {id:'fast',  color:'#ffd166', baseGood:28, basePerfect:40, life:1400, req:'any'},
    {id:'bonus', color:'#00ffa3', baseGood:0,  basePerfect:0,  life:2200, req:'any', bonus:'time+5'}
  ];
  const SLASH_SPEED_GOOD=1.4, SLASH_SPEED_PERFECT=2.2;
  const HIT_DISTANCE_GOOD=0.46, HIT_DISTANCE_PERFECT=0.34;
  const ANGLES={
    diag_lr: new THREE.Vector3(1,0,-1).normalize(),
    diag_rl: new THREE.Vector3(-1,0,-1).normalize(),
    updown : new THREE.Vector3(0,-1,-1).normalize(),
    downup : new THREE.Vector3(0,1,-1).normalize()
  };
  const ANGLE_TOL=0.55;

  // ---------- SFX (safe) ----------
  const SFXN=(p)=>{ const a=new Audio(p); a.onerror=()=>{}; return a; };
  const SFX={
    slash:SFXN('../../assets/sfx/slash.wav'),
    laser:SFXN('../../assets/sfx/laser.wav'),
    perfect:SFXN('../../assets/sfx/perfect.wav'),
    miss:SFXN('../../assets/sfx/miss.wav'),
    heavy:SFXN('../../assets/sfx/heavy.wav'),
    combo:SFXN('../../assets/sfx/combo.wav'),
    hp_hit:SFXN('../../assets/sfx/hp_hit.wav'),
    boss_roar:SFXN('../../assets/sfx/boss_roar.wav'),
    tel_slash:SFXN('../../assets/sfx/tel_slash.wav'),
    tel_shock:SFXN('../../assets/sfx/tel_shock.wav'),
    tel_guard:SFXN('../../assets/sfx/tel_guard.wav'),
    tel_dash:SFXN('../../assets/sfx/tel_dash.wav'),
    enrage:SFXN('../../assets/sfx/enrage.wav'),
    success:SFXN('../../assets/sfx/success.wav')
  };

  // ---------- HUD ----------
  function updateHUD(){ byId('score').textContent=score; byId('combo').textContent=combo; byId('time').textContent=timeLeft; }
  function onComboChange(){
    byId('combo').textContent=combo;
    if(combo>0 && combo%10===0){ try{ SFX.combo.currentTime=0; SFX.combo.play(); }catch(e){} APPX.badge('Combo x'+(1+Math.floor(combo/10))); }
  }

  // ---------- Floating text ----------
  function floatText(text, color, pos){
    const e=document.createElement('a-entity'), p=pos.clone(); p.y+=0.2;
    e.setAttribute('text',{value:text,color,align:'center',width:2.6});
    e.setAttribute('position',`${p.x} ${p.y} ${p.z}`);
    e.setAttribute('scale','0.001 0.001 0.001');
    e.setAttribute('animation__in',{property:'scale',to:'1 1 1',dur:90,easing:'easeOutQuad'});
    e.setAttribute('animation__rise',{property:'position',to:`${p.x} ${p.y+0.6} ${p.z}`,dur:600,easing:'easeOutQuad'});
    e.setAttribute('animation__fade',{property:'opacity',to:0,dur:480,delay:160,easing:'linear'});
    byId('arena').appendChild(e); setTimeout(()=>e.remove(),820);
  }

  // ---------- Boss System ----------
  const BOSS={active:false,hp:0,max:1000,rage:false,phase:1,busy:false,anchor:null,name:'',color:'#ff3355', P1:[], P2:[]};

  function bossShowUI(show){ const bar=byId('bossBar'); if(bar) bar.style.display=show?'block':'none'; }
  function bossSetHP(h){
    const was=BOSS.hp;
    BOSS.hp = clamp(h, 0, BOSS.max);
    const fill=byId('bossHPFill'); if(fill) fill.style.width=((BOSS.hp/BOSS.max)*100)+'%';
    const bar=byId('bossBar');
    if(bar){
      const rageNow=(BOSS.hp/BOSS.max)<=0.33;
      if(rageNow!==BOSS.rage){ BOSS.rage=rageNow; bar.classList.toggle('rage', BOSS.rage); }
      bar.classList.add('hit'); setTimeout(()=>bar.classList.remove('hit'), 240);
    }
    if(BOSS.phase===1 && (BOSS.hp/BOSS.max)<=0.5) enterPhase2();
    if(BOSS.hp<=0 && was>0) onBossDefeated();
  }
  function bossDamage(amount,pos){
    if(!BOSS.active) return;
    const armor = BOSS.rage ? 0.1 : 0.2;
    const final = Math.max(1, Math.round(amount*(1-armor)));
    try{ SFX.hp_hit.currentTime=0; SFX.hp_hit.play(); }catch(e){}
    bossSetHP(BOSS.hp - final);
  }

  function bossIntro(){
    const arena=byId('arena');
    const anchor=document.createElement('a-entity');
    anchor.setAttribute('id','bossAnchor');
    anchor.setAttribute('position','0 1.5 -3');

    // Oni placeholder (เปลี่ยนสีตามบอส)
    const head=document.createElement('a-sphere'); head.setAttribute('radius','0.35'); head.setAttribute('color','#1a1a1a'); head.setAttribute('position','0 0 0');
    const mask=document.createElement('a-box'); mask.setAttribute('depth','0.06'); mask.setAttribute('width','0.55'); mask.setAttribute('height','0.45'); mask.setAttribute('color',BOSS.color||'#ff3355'); mask.setAttribute('position','0 0 0.25');
    const hornL=document.createElement('a-cone'); hornL.setAttribute('radius-bottom','0.06'); hornL.setAttribute('radius-top','0.01'); hornL.setAttribute('height','0.28'); hornL.setAttribute('color','#ff8844'); hornL.setAttribute('rotation','-18 0 28'); hornL.setAttribute('position','-0.2 0.18 0.16');
    const hornR=document.createElement('a-cone'); hornR.setAttribute('radius-bottom','0.06'); hornR.setAttribute('radius-top','0.01'); hornR.setAttribute('height','0.28'); hornR.setAttribute('color','#ff8844'); hornR.setAttribute('rotation','-18 0 -28'); hornR.setAttribute('position','0.2 0.18 0.16');
    anchor.appendChild(head); anchor.appendChild(mask); anchor.appendChild(hornL); anchor.appendChild(hornR);
    arena.appendChild(anchor); BOSS.anchor=anchor;

    bossShowUI(true); bossSetHP(BOSS.max);
    try{ SFX.boss_roar.currentTime=0; SFX.boss_roar.play(); }catch(e){}
    APPX.badge(BOSS.name || 'BOSS');
  }

  function bossSpawn(index=0){
    const cfg = BOSSES[index] || BOSSES[0];
    BOSS.active=true; BOSS.max=cfg.maxHP; BOSS.hp=cfg.maxHP; BOSS.rage=false; BOSS.phase=1; BOSS.busy=false;
    BOSS.name=cfg.title; BOSS.color=cfg.color; BOSS.P1=cfg.P1.slice(); BOSS.P2=cfg.P2.slice();
    bossIntro(); pIndex=0; after(1000, bossLoop);
  }

  function onBossDefeated(){
    BOSS.active=false;
    floatText('BOSS DEFEATED','#00ffa3', new THREE.Vector3(0,1.6,-2.3));
    score += 250; updateHUD();

    const lastBoss = (CURRENT_BOSS >= BOSSES.length-1);
    const canChain = (!lastBoss && timeLeft >= CHAIN_RULE.minTimeLeft);

    if(canChain){
      APPX.badge('Qualified! Next Boss…');
      CURRENT_BOSS++;
      // เคลียร์สนาม แล้วเรียกบอสถัดไปโดยไม่รีเซ็ตเวลา/คะแนน
      clearArena(); bossShowUI(false);
      after(900, ()=>{ bossShowUI(true); bossSpawn(CURRENT_BOSS); });
      return;
    }

    // ไม่เข้าเงื่อนไขต่อบอส → จบเกมตามปกติ
    end();
  }

  function enterPhase2(){ BOSS.phase=2; APPX.badge('Phase 2'); try{ SFX.enrage.currentTime=0; SFX.enrage.play(); }catch(e){} }

  // ---------- Boss patterns ----------
  let pIndex=0;
  function bossLoop(){
    if(!running || !BOSS.active || BOSS.busy) return;
    const arr = (BOSS.phase===1? BOSS.P1 : BOSS.P2);
    const pattern = arr[pIndex % arr.length]; pIndex++;
    ({
      'slash_cross':doSlashCross,
      'rapid_fist':doRapidFist,
      'guard_break':doGuardBreak,
      'shadow_dash':doShadowDash,
      'multi_slash':doMultiSlash,
      'enrage_combo':doEnrageCombo,
      // Boss 2 เฉพาะ:
      'ground_shock':doGroundShock,
      'enrage_combo_fast':doEnrageComboFast
    }[pattern]||(()=>{ BOSS.busy=false; }))();
  }
  function finishAttack(){ BOSS.busy=false; after(520, bossLoop); }
  function playerHit(){
    combo=0; onComboChange();
    score=Math.max(0,score-5); updateHUD();
    APPX.badge('HIT!');
    const scn=document.querySelector('a-scene'); if(scn){ scn.classList.add('shake-scene'); setTimeout(()=>scn.classList.remove('shake-scene'), 240); }
  }

  // --- Moves (Phase 1/2) ---
  function doSlashCross(){
    BOSS.busy=true; try{ SFX.tel_slash.currentTime=0; SFX.tel_slash.play(); }catch(e){}
    const g=document.createElement('a-entity');
    g.setAttribute('geometry','primitive: box; height: 0.04; width: 1.2; depth: 0.04');
    g.setAttribute('material','color: #ff3355; opacity: 0.85; transparent: true');
    g.setAttribute('rotation','0 0 -35'); g.setAttribute('position','0 1.4 -2.2'); g.classList.add('clickable','boss-attack');
    g.addEventListener('click', ()=>{ floatText('PARRY','#00ffa3', g.object3D.getWorldPosition(new THREE.Vector3())); bossDamage(28,new THREE.Vector3(0,1.5,-3)); g.remove(); finishAttack(); });
    byId('arena').appendChild(g);
    after(BOSS.phase===1?900:700, ()=>{ if(g.parentNode){ playerHit(); g.remove(); } finishAttack(); });
  }
  function doRapidFist(){
    BOSS.busy=true; let count=0;
    const next=()=>{ try{ SFX.tel_shock.currentTime=0; SFX.tel_shock.play(); }catch(e){}
      spawnShockwave(()=>{ count++; if(count<(BOSS.phase===1?3:4)){ after(BOSS.phase===1?450:380,next);} else { finishAttack(); } });
    }; next();
  }
  function spawnShockwave(done){
    const ring=document.createElement('a-ring'); ring.classList.add('clickable','boss-attack');
    ring.setAttribute('position','0 1.2 -2.6'); ring.setAttribute('radius-inner','0.05'); ring.setAttribute('radius-outer','0.07');
    ring.setAttribute('material','color:#ffd166;opacity:.95;shader:flat'); byId('arena').appendChild(ring);
    ring.addEventListener('click', ()=>{ const p=ring.object3D.getWorldPosition(new THREE.Vector3()); floatText('BREAK','#00ffa3', p); bossDamage(16,p); ring.remove(); done&&done(); });
    const start=performance.now(), dur=(BOSS.phase===1?700:560);
    (function step(){ if(!ring.parentNode) return; const t=(performance.now()-start)/dur; const r=0.07+t*0.9;
      ring.setAttribute('radius-inner',Math.max(0.01,r-0.02)); ring.setAttribute('radius-outer',r);
      if(t>=1.0){ playerHit(); ring.remove(); done&&done(); return; } requestAnimationFrame(step);
    })();
  }
  function doGuardBreak(){
    BOSS.busy=true; try{ SFX.tel_guard.currentTime=0; SFX.tel_guard.play(); }catch(e){}
    const core=document.createElement('a-sphere'); core.classList.add('clickable','boss-attack');
    core.setAttribute('radius','0.2'); core.setAttribute('color','#ff6b6b'); core.setAttribute('position','0 1.1 -2.2');
    core.setAttribute('scale','0.001 0.001 0.001'); core.setAttribute('animation__in',{property:'scale',to:'1 1 1',dur:140,easing:'easeOutBack'});
    byId('arena').appendChild(core);
    core.addEventListener('click', ()=>{ const p=core.object3D.getWorldPosition(new THREE.Vector3()); bossDamage(10,p); core.remove(); finishAttack(); });
    after(BOSS.phase===1?900:750, ()=>{ if(core.parentNode){ playerHit(); core.remove(); } finishAttack(); });
  }
  function doShadowDash(){
    BOSS.busy=true; try{ SFX.tel_dash.currentTime=0; SFX.tel_dash.play(); }catch(e){}
    const l=document.createElement('a-box'), r=document.createElement('a-box');
    [l,r].forEach((b,i)=>{ b.classList.add('clickable','boss-attack'); b.setAttribute('width','0.5'); b.setAttribute('height','0.3'); b.setAttribute('depth','0.05');
      b.setAttribute('color', i===0?'#00d0ff':'#00ffa3'); b.setAttribute('position', (i===0?'-0.9':'0.9')+' 1.0 -2.0'); byId('arena').appendChild(b); });
    let ok=false; const hit=(box)=>{ if(ok) return; ok=true; floatText('DODGE','#9bd1ff', box.object3D.getWorldPosition(new THREE.Vector3())); bossDamage(12,new THREE.Vector3(0,1.5,-3)); cleanup(); };
    l.addEventListener('click', ()=>hit(l)); r.addEventListener('click', ()=>hit(r));
    after(700, ()=>{ if(!ok) playerHit(); cleanup(); });
    function cleanup(){ [l,r].forEach(b=>b.parentNode&&b.parentNode.removeChild(b)); finishAttack(); }
  }
  function doMultiSlash(){
    BOSS.busy=true; const seq=[-35,35]; let i=0;
    const next=()=>{ try{ SFX.tel_slash.currentTime=0; SFX.tel_slash.play(); }catch(e){}
      const g=document.createElement('a-entity'); g.setAttribute('geometry','primitive: box; height: 0.04; width: 1.2; depth: 0.04');
      g.setAttribute('material','color: #ff3355; opacity: 0.85; transparent: true'); g.setAttribute('rotation','0 0 '+seq[i]); g.setAttribute('position','0 1.35 -2.2');
      g.classList.add('clickable','boss-attack'); byId('arena').appendChild(g);
      let ok=false; g.addEventListener('click', ()=>{ ok=true; floatText('PARRY','#00ffa3', g.object3D.getWorldPosition(new THREE.Vector3())); bossDamage(16,new THREE.Vector3(0,1.5,-3)); g.remove(); });
      after(650, ()=>{ if(g.parentNode){ g.remove(); if(!ok) playerHit(); } i++; if(i<seq.length){ after(120,next); } else { finishAttack(); } });
    }; next();
  }
  function doEnrageCombo(){
    BOSS.busy=true; try{ SFX.enrage.currentTime=0; SFX.enrage.play(); }catch(e){} APPX.badge('ENRAGE!');
    const seq=[()=>qs(()=>step()), ()=>qw(()=>step()), ()=>qg(()=>step()), ()=>gem(()=>finishAttack())];
    let j=0; function step(){ j++; if(j<seq.length) seq[j](); } seq[0]();

    function qs(done){ // quick slash
      const g=document.createElement('a-entity'); g.setAttribute('geometry','primitive: box; height: 0.04; width: 1.2; depth: 0.04');
      g.setAttribute('material','color:#ff3355;opacity:.9;transparent:true'); g.setAttribute('rotation','0 0 -35'); g.setAttribute('position','0 1.4 -2.2'); g.classList.add('clickable');
      byId('arena').appendChild(g); let ok=false; try{ SFX.tel_slash.currentTime=0; SFX.tel_slash.play(); }catch(e){}
      g.addEventListener('click', ()=>{ ok=true; bossDamage(18,new THREE.Vector3(0,1.5,-3)); g.remove(); done(); });
      after(520, ()=>{ if(g.parentNode){ g.remove(); if(!ok) playerHit(); } done(); });
    }
    function qw(done){ // quick shock
      try{ SFX.tel_shock.currentTime=0; SFX.tel_shock.play(); }catch(e){}
      const ring=document.createElement('a-ring'); ring.classList.add('clickable'); ring.setAttribute('position','0 1.2 -2.6');
      ring.setAttribute('radius-inner','0.05'); ring.setAttribute('radius-outer','0.07'); ring.setAttribute('material','color:#ffd166;opacity:.95;shader:flat');
      byId('arena').appendChild(ring);
      ring.addEventListener('click', ()=>{ bossDamage(14, ring.object3D.getWorldPosition(new THREE.Vector3())); ring.remove(); done(); });
      const start=performance.now(), dur=500; (function step(){ if(!ring.parentNode) return; const t=(performance.now()-start)/dur, r=0.07+t*0.9;
        ring.setAttribute('radius-inner',Math.max(0.01,r-0.02)); ring.setAttribute('radius-outer',r); if(t>=1.0){ playerHit(); ring.remove(); done(); return; } requestAnimationFrame(step);
      })();
    }
    function qg(done){ // quick guard
      try{ SFX.tel_guard.currentTime=0; SFX.tel_guard.play(); }catch(e){}
      const core=document.createElement('a-sphere'); core.classList.add('clickable'); core.setAttribute('radius','0.18'); core.setAttribute('color','#ff6b6b'); core.setAttribute('position','0 1.15 -2.2');
      core.setAttribute('scale','0.001 0.001 0.001'); core.setAttribute('animation__in',{property:'scale',to:'1 1 1',dur:120,easing:'easeOutBack'});
      byId('arena').appendChild(core); let ok=false; core.addEventListener('click', ()=>{ ok=true; bossDamage(12, core.object3D.getWorldPosition(new THREE.Vector3())); core.remove(); done(); });
      after(600, ()=>{ if(core.parentNode){ core.remove(); if(!ok) playerHit(); } done(); });
    }
    function gem(done){
      const g=document.createElement('a-icosahedron'); g.classList.add('clickable'); g.setAttribute('position','0 1.6 -2.4'); g.setAttribute('radius','0.18'); g.setAttribute('color','#00ffa3'); byId('arena').appendChild(g);
      g.addEventListener('click', ()=>{ floatText('CRITICAL!','#00ffa3', g.object3D.getWorldPosition(new THREE.Vector3())); try{ SFX.success.currentTime=0; SFX.success.play(); }catch(e){} bossDamage(40, g.object3D.getWorldPosition(new THREE.Vector3())); g.remove(); done(); });
      after(700, ()=>{ if(g.parentNode){ g.remove(); } done(); });
    }
  }

  // --- Boss 2 specials ---
  function doGroundShock(){
    // วงแหวนพุ่งขึ้นจากพื้น 5 ลูกเร็วขึ้น
    BOSS.busy=true; let c=0;
    const next=()=>{ try{ SFX.tel_shock.currentTime=0; SFX.tel_shock.play(); }catch(e){}
      spawnShockwave(()=>{ c++; if(c<5){ after(300,next);} else { finishAttack(); } });
    }; next();
  }
  function doEnrageComboFast(){
    // เหมือน enrage แต่เวลาสั้นลง
    const saveP2=BOSS.P2; const tmp=['multi_slash','ground_shock']; BOSS.P2=tmp;
    doEnrageCombo(); // ใช้ของเดิมแต่ pattern pool ถูกบีบ
    // คืนค่าหลังจบ (รอจังหวะ finishAttack เรียก bossLoop ต่อไป)
    after(2000, ()=>{ BOSS.P2=saveP2; });
  }

  // ---------- Targets & Hits ----------
  AFRAME.registerComponent('hand-speed',{schema:{speed:{type:'number',default:0}},init(){this.prev=null;this.prevT=performance.now();this.vel=new THREE.Vector3();},
    tick(){const p=this.el.object3D.getWorldPosition(new THREE.Vector3()), now=performance.now();
      if(this.prev){const dt=(now-this.prevT)/1000; if(dt>0){this.vel.set((p.x-this.prev.x)/dt,(p.y-this.prev.y)/dt,(p.z-this.prev.z)/dt); this.data.speed=this.vel.length();}}
      this.prev=p.clone(); this.prevT=now;}
  });

  AFRAME.registerComponent('sb-target',{schema:{type:{default:'basic'},req:{default:'any'},angle:{default:''}},init(){
    const el=this.el; el.classList.add('sb-target','clickable'); el.setAttribute('scale','0.001 0.001 0.001');
    el.setAttribute('animation__in',{property:'scale',to:'1 1 1',dur:160,easing:'easeOutBack'});
    const spec=TYPES.find(x=>x.id===this.data.type)||TYPES[0]; el.setAttribute('color', spec.color);
    this.dieTimer=setTimeout(()=>{ miss(el); }, spec.life||2200);
    el.addEventListener('click', ()=> registerHit(el,{type:'laser'}));
    if(spec.req==='angle'){ const dir=ANGLES[spec.angle]||ANGLES.diag_lr;
      const rotY=Math.atan2(dir.x,-dir.z)*180/Math.PI, rotX=Math.asin(dir.y)*180/Math.PI;
      const g=document.createElement('a-entity'); g.setAttribute('geometry','primitive: box; height: 0.03; width: 0.7; depth: 0.03');
      g.setAttribute('material','color:#ffffff;opacity:.55;transparent:true'); g.setAttribute('rotation',`${rotX} ${rotY} 0`); el.appendChild(g); }
  },remove(){ clearTimeout(this.dieTimer); }});

  function spawnTarget(){
    spawns++;
    const spec = pickType();
    const el=document.createElement(Math.random()<0.5?'a-box':'a-sphere');
    const x=(Math.random()*3.2-1.6).toFixed(2), y=(Math.random()*1.6+1.0).toFixed(2), z=(Math.random()*-2.0-1.8).toFixed(2);
    el.setAttribute('position',`${x} ${y} ${z}`); el.setAttribute('sb-target',{type:spec.id,req:spec.req,angle:(spec.angle||'')}); byId('arena').appendChild(el);
  }
  function pickType(){ const r=Math.random(); if(r<0.55) return TYPES[0]; if(r<0.72) return TYPES[2]; if(r<0.92) return TYPES[1]; return TYPES[3]; }

  function dirMatches(v,spec){ if(spec.req!=='angle') return true; const want=ANGLES[spec.angle]||ANGLES.diag_lr; const vv=v.clone().normalize(); return vv.dot(want)>=ANGLE_TOL; }
  function applyScore(kind, method, pos, spec){
    if(kind==='miss'){ combo=0; onComboChange(); try{ SFX.miss.currentTime=0; SFX.miss.play(); }catch(e){} floatText('MISS','#ff5577',pos); return; }
    combo++; if(combo>maxCombo) maxCombo=combo; const mult=1+Math.floor(combo/10);
    let base=0, dmg=0;
    if(method==='laser'){ base=10; dmg=6; } else { if(kind==='perfect'){ base=spec.basePerfect; dmg=18; } else { base=spec.baseGood; dmg=10; } }
    if(spec.id==='heavy') dmg+=6;
    score += base*mult; hits++; updateHUD(); onComboChange();
    if(method==='laser'){ try{ SFX.laser.currentTime=0; SFX.laser.play(); }catch(e){} floatText('GOOD','#9bd1ff',pos); }
    else if(spec.id==='heavy'){ try{ SFX.heavy.currentTime=0; SFX.heavy.play(); }catch(e){} floatText(kind==='perfect'?'HEAVY PERFECT':'HEAVY','#ff9c6b',pos); }
    else if(kind==='perfect'){ try{ SFX.perfect.currentTime=0; SFX.perfect.play(); }catch(e){} floatText('PERFECT','#00ffa3',pos); }
    else { try{ SFX.slash.currentTime=0; SFX.slash.play(); }catch(e){} floatText('GOOD','#00d0ff',pos); }
    if(spec.bonus==='time+5'){ timeLeft=Math.min(99,timeLeft+5); byId('time').textContent=timeLeft; floatText('+5s','#00ffa3',pos); }
    bossDamage(dmg, pos);
  }
  function registerHit(target, info){
    if(!target.getAttribute('visible')) return;
    const p=target.object3D.getWorldPosition(new THREE.Vector3());
    const comp=target.components['sb-target']; const spec=TYPES.find(x=>x.id===(comp?.data?.type))||TYPES[0];
    clearTimeout(comp?.dieTimer); target.setAttribute('animation__out',{property:'scale',to:'0.001 0.001 0.001',dur:120,easing:'easeInBack'});
    setTimeout(()=>target.remove(),130);
    applyScore(info.kind||info.type, info.method||info.type, p, spec);
    try{ window.AudioBus?.tap?.(); }catch(e){}
  }
  function miss(target){
    if(target && target.parentNode){ const p=target.object3D.getWorldPosition(new THREE.Vector3()); target.remove(); applyScore('miss','timeout', p, TYPES[0]); }
    else { combo=0; onComboChange(); }
  }
  function checkSlashHits(){
    if(!running) return;
    const arena=byId('arena'); const targets=Array.from(arena.querySelectorAll('.sb-target')); if(targets.length===0) return;
    const lh=byId('leftHand'), rh=byId('rightHand'); const lc=lh?.components['hand-speed'], rc=rh?.components['hand-speed'];
    const ls=lc?.data?.speed||0, rs=rc?.data?.speed||0; const lv=lc?.vel||new THREE.Vector3(), rv=rc?.vel||new THREE.Vector3();
    const lp=lh?.object3D.getWorldPosition(new THREE.Vector3())||new THREE.Vector3(), rp=rh?.object3D.getWorldPosition(new THREE.Vector3())||new THREE.Vector3();
    for(const t of targets){
      if(!t.getAttribute('visible')) continue; const comp=t.components['sb-target']; const spec=TYPES.find(x=>x.id===(comp?.data?.type))||TYPES[0];
      const pos=t.object3D.getWorldPosition(new THREE.Vector3()); const dl=lp.distanceTo(pos), dr=rp.distanceTo(pos);
      if(ls>=SLASH_SPEED_GOOD && dl<=HIT_DISTANCE_GOOD && dirMatches(lv,spec)){ const k=(ls>=SLASH_SPEED_PERFECT && dl<=HIT_DISTANCE_PERFECT)?'perfect':'good'; registerHit(t,{type:'slash',kind:k}); continue; }
      if(rs>=SLASH_SPEED_GOOD && dr<=HIT_DISTANCE_GOOD && dirMatches(rv,spec)){ const k=(rs>=SLASH_SPEED_PERFECT && dr<=HIT_DISTANCE_PERFECT)?'perfect':'good'; registerHit(t,{type:'slash',kind:k}); continue; }
    }
  }
  AFRAME.registerSystem('sb-loop',{tick(){ checkSlashHits(); }});

  // ---------- Game flow ----------
  function clearArena(){ const a=byId('arena'); Array.from(a.children).forEach(c=>c.remove()); }
  function start(){
    if(running) return;
    reset(); running=true;
    spawnTimer=setInterval(spawnTarget, 900);
    timer=setInterval(()=>{ timeLeft--; byId('time').textContent=timeLeft; if(timeLeft<=0) end(); },1000);
    CURRENT_BOSS=0; after(900, ()=>bossSpawn(CURRENT_BOSS));
  }
  function reset(){
    score=0; combo=0; maxCombo=0; hits=0; spawns=0; timeLeft=60; updateHUD();
    byId('results').style.display='none'; bossShowUI(false); clearArena();
  }
  function end(){
    running=false; clearInterval(timer); clearInterval(spawnTimer); bossShowUI(false);
    const acc=spawns? Math.round((hits/spawns)*100):0;
    byId('rScore').textContent=score; byId('rMaxCombo').textContent=maxCombo; byId('rAcc').textContent=acc+'%';
    byId('results').style.display='flex'; APPX.badge(APPX.t('results')+': '+score);
    try{ window.Leaderboard?.postResult?.('shadow-breaker',{score,maxCombo,accuracy:acc}); }catch(e){}
  }

  // ---------- Buttons ----------
  document.addEventListener('DOMContentLoaded', ()=>{
    byId('startBtn')?.addEventListener('click', start);
    byId('replayBtn')?.addEventListener('click', start);
    byId('backBtn')?.addEventListener('click', ()=>{ window.location.href='../../index.html'; });
  });
})();
