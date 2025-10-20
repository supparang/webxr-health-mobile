(function(){
  let score=0, timeLeft=60, timer=null, running=false;
  let combo=0, maxCombo=0, hits=0, spawns=0, spawnTimer=null;

  const TYPES=[
    {id:'basic', color:'#00d0ff', baseGood:20, basePerfect:30, life:2200, req:'any'},
    {id:'heavy', color:'#ff6b6b', baseGood:40, basePerfect:60, life:2600, req:'angle', angle:'diag_lr'},
    {id:'fast',  color:'#ffd166', baseGood:28, basePerfect:40, life:1400, req:'any'},
    {id:'bonus', color:'#00ffa3', baseGood:0,  basePerfect:0,  life:2200, req:'any', bonus:'time+5'}
  ];
  const SLASH_SPEED_GOOD=1.4, SLASH_SPEED_PERFECT=2.2, HIT_DISTANCE_GOOD=0.45, HIT_DISTANCE_PERFECT=0.35;

  const ANGLES={'diag_lr': new THREE.Vector3(1,0,-1).normalize(),'diag_rl': new THREE.Vector3(-1,0,-1).normalize(),'updown':new THREE.Vector3(0,-1,-1).normalize(),'downup':new THREE.Vector3(0,1,-1).normalize()};
  const ANGLE_TOL=0.55;

  const sfx={
    slash:   new Audio('../../assets/sfx/slash.wav'),
    laser:   new Audio('../../assets/sfx/laser.wav'),
    perfect: new Audio('../../assets/sfx/perfect.wav'),
    miss:    new Audio('../../assets/sfx/miss.wav'),
    heavy:   new Audio('../../assets/sfx/heavy.wav'),
    combo:   new Audio('../../assets/sfx/combo.wav'),
    tel_slash: new Audio('../../assets/sfx/tel_slash.wav'),
    tel_shock: new Audio('../../assets/sfx/tel_shock.wav'),
    tel_guard: new Audio('../../assets/sfx/tel_guard.wav'),
    boss_roar: new Audio('../../assets/sfx/boss_roar.wav'),
    hp_hit: new Audio('../../assets/sfx/hp_hit.wav'),
    tel_dash: new Audio('../../assets/sfx/tel_dash.wav'),
    enrage: new Audio('../../assets/sfx/enrage.wav'),
    success: new Audio('../../assets/sfx/success.wav')
  };

  function $(q){return document.querySelector(q);} function $el(id){return document.getElementById(id);}
  function shake(){ const scn=document.querySelector('a-scene'); if(!scn) return; scn.classList.add('shake-scene'); setTimeout(()=>scn.classList.remove('shake-scene'), 250); }

  AFRAME.registerComponent('hand-speed',{schema:{speed:{type:'number',default:0}},init(){this.prev=null;this.prevT=performance.now();this.vel=new THREE.Vector3();},
    tick(){const p=this.el.object3D.getWorldPosition(new THREE.Vector3());const now=performance.now();
      if(this.prev){const dt=(now-this.prevT)/1000;if(dt>0){const dx=p.x-this.prev.x,dy=p.y-this.prev.y,dz=p.z-this.prev.z;this.vel.set(dx/dt,dy/dt,dz/dt);this.data.speed=this.vel.length();}}
      this.prev=p.clone();this.prevT=now;}});

  AFRAME.registerComponent('sb-target',{schema:{type:{default:'basic'},req:{default:'any'},angle:{default:''}},init(){
    const el=this.el; el.classList.add('sb-target','clickable'); el.setAttribute('scale','0.001 0.001 0.001');
    el.setAttribute('animation__in',{property:'scale',to:'1 1 1',dur:160,easing:'easeOutBack'});
    const spec=TYPES.find(x=>x.id===this.data.type)||TYPES[0]; el.setAttribute('color', spec.color);
    this.dieTimer=setTimeout(()=>{ miss(el); }, spec.life||2200);
    el.addEventListener('click', ()=>{ registerHit(el,{type:'laser'}); });
    if(spec.req==='angle'){ const guide=document.createElement('a-entity'); const dir=ANGLES[spec.angle]||ANGLES['diag_lr'];
      const rotY=Math.atan2(dir.x,-dir.z)*180/Math.PI; const rotX=Math.asin(dir.y)*180/Math.PI;
      guide.setAttribute('geometry','primitive: box; height: 0.03; width: 0.7; depth: 0.03');
      guide.setAttribute('material','color: #ffffff; opacity: 0.6; transparent: true'); guide.setAttribute('rotation',`${rotX} ${rotY} 0`);
      el.appendChild(guide); }
  },remove(){clearTimeout(this.dieTimer);}});

  function floatText(text,color,pos){const label=document.createElement('a-entity');
    label.setAttribute('text',{value:text,color,align:'center',width:2.6}); const p=pos.clone(); p.y+=0.2;
    label.setAttribute('position',`${p.x} ${p.y} ${p.z}`); label.setAttribute('scale','0.001 0.001 0.001');
    label.setAttribute('animation__in',{property:'scale',to:'1 1 1',dur:90,easing:'easeOutQuad'});
    label.setAttribute('animation__rise',{property:'position',to:`${p.x} ${p.y+0.6} ${p.z}`,dur:600,easing:'easeOutQuad'});
    label.setAttribute('animation__fade',{property:'opacity',to:0,dur:480,delay:160,easing:'linear'});
    $el('arena').appendChild(label); setTimeout(()=>{ label.remove(); },800); }

  function onComboChange(){ $('#combo').textContent=combo; if(combo>0 && combo%10===0){ sfx.combo.currentTime=0; sfx.combo.play().catch(()=>{}); APP.badge('Combo x'+(1+Math.floor(combo/10))); } }

  const BOSS={active:false,hp:0,max:1000,rage:false,name:'RAZORFIST', anchor:null, phase:1, busy:false};
  function bossShowUI(show){ const bar=$el('bossBar'); if(!bar)return; bar.style.display=show?'block':'none'; }
  function bossSetHP(h){ const was=BOSS.hp; BOSS.hp=Math.max(0,Math.min(BOSS.max,h)); const fill=$el('bossHPFill'); if(fill){ fill.style.width=((BOSS.hp/BOSS.max)*100)+'%'; }
    const bar=$el('bossBar'); if(bar){ const rageNow = (BOSS.hp/BOSS.max)<=0.33; if(rageNow!==BOSS.rage){ BOSS.rage=rageNow; bar.classList.toggle('rage', BOSS.rage); } }
    if(BOSS.phase===1 && (BOSS.hp/BOSS.max)<=0.5){ enterPhase2(); }
  }
  function bossBarHit(){ const bar=$el('bossBar'); if(!bar) return; bar.classList.add('hit'); setTimeout(()=>bar.classList.remove('hit'), 260); }
  function bossDamage(amount, pos){
    if(!BOSS.active) return;
    const armor = BOSS.rage ? 0.1 : 0.2;
    const final = Math.max(1, Math.round(amount*(1-armor)));
    bossSetHP(BOSS.hp - final);
    bossBarHit(); sfx.hp_hit.currentTime=0; sfx.hp_hit.play().catch(()=>{});
    if(BOSS.hp<=0){ onBossDefeated(pos); }
  }
  function onBossDefeated(pos){
    BOSS.active=false; floatText('BOSS DEFEATED','#00ffa3', pos||new THREE.Vector3(0,1.5,-2.5));
    APP.badge('RazorFist down!'); score += 250; $('#score').textContent=score; end();
  }

  function bossIntro_OP5(){
    const arena=$el('arena'); const anchor=document.createElement('a-entity'); anchor.setAttribute('id','bossAnchor'); anchor.setAttribute('position','0 1.5 -3');
    const head=document.createElement('a-sphere'); head.setAttribute('radius','0.35'); head.setAttribute('color','#1a1a1a'); head.setAttribute('position','0 0 0');
    const mask=document.createElement('a-box'); mask.setAttribute('depth','0.06'); mask.setAttribute('width','0.55'); mask.setAttribute('height','0.45'); mask.setAttribute('color','#ff3355'); mask.setAttribute('position','0 0 0.25');
    const hornL=document.createElement('a-cone'); hornL.setAttribute('radius-bottom','0.06'); hornL.setAttribute('radius-top','0.01'); hornL.setAttribute('height','0.28'); hornL.setAttribute('color','#ff8844'); hornL.setAttribute('rotation','-18 0 28'); hornL.setAttribute('position','-0.2 0.18 0.16');
    const hornR=document.createElement('a-cone'); hornR.setAttribute('radius-bottom','0.06'); hornR.setAttribute('radius-top','0.01'); hornR.setAttribute('height','0.28'); hornR.setAttribute('color','#ff8844'); hornR.setAttribute('rotation','-18 0 -28'); hornR.setAttribute('position','0.2 0.18 0.16');
    anchor.appendChild(head); anchor.appendChild(mask); anchor.appendChild(hornL); anchor.appendChild(hornR);
    arena.appendChild(anchor); BOSS.anchor=anchor;

    bossShowUI(true); bossSetHP(BOSS.max); sfx.boss_roar.currentTime=0; sfx.boss_roar.play().catch(()=>{});
    APP.badge('BOOM!'); setTimeout(()=>APP.badge('You want power? EARN IT!'), 600);
  }

  function bossSpawn(){ BOSS.active=true; BOSS.max=1000; BOSS.hp=BOSS.max; BOSS.rage=false; BOSS.phase=1; BOSS.busy=false; bossIntro_OP5(); setTimeout(bossLoop, 1200); }

  // Phase 1 Pattern
  const P1 = ['slash_cross','rapid_fist','guard_break']; let pIndex=0;
  // Phase 2 Pattern
  const P2 = ['shadow_dash','multi_slash','enrage_combo'];

  function bossLoop(){
    if(!running || !BOSS.active || BOSS.busy) return;
    const arr = (BOSS.phase===1? P1 : P2);
    const pattern = arr[pIndex % arr.length]; pIndex++;
    if(pattern==='slash_cross') doSlashCross();
    else if(pattern==='rapid_fist') doRapidFist();
    else if(pattern==='guard_break') doGuardBreak();
    else if(pattern==='shadow_dash') doShadowDash();
    else if(pattern==='multi_slash') doMultiSlash();
    else if(pattern==='enrage_combo') doEnrageCombo();
  }
  function after(ms, fn){ return setTimeout(fn, ms); }
  function playerHit(label='#ff5577'){ combo=0; onComboChange(); score = Math.max(0, score-5); $('#score').textContent=score; shake(); APP.badge('HIT!'); floatText('HIT', label, new THREE.Vector3(0,1.5,-2.2)); }

  function doSlashCross(){
    BOSS.busy=true; sfx.tel_slash.currentTime=0; sfx.tel_slash.play().catch(()=>{});
    const arena=$el('arena'); const guide=document.createElement('a-entity');
    guide.setAttribute('geometry','primitive: box; height: 0.04; width: 1.2; depth: 0.04');
    guide.setAttribute('material','color: #ff3355; opacity: 0.85; transparent: true');
    guide.setAttribute('rotation','0 0 -35'); guide.setAttribute('position','0 1.4 -2.2');
    guide.classList.add('clickable','boss-attack');
    guide.addEventListener('click', ()=>{ parry(guide); });
    arena.appendChild(guide);
    const window = BOSS.phase===1? 900 : 700;
    after(window, ()=>{ if(!guide.parentNode){ finishAttack(); return; } playerHit(); guide.parentNode.removeChild(guide); finishAttack(); });
  }
  function parry(el){
    if(!el || !el.parentNode) return;
    floatText('PARRY','#00ffa3', el.object3D.getWorldPosition(new THREE.Vector3()));
    el.parentNode.removeChild(el);
    bossDamage(28, new THREE.Vector3(0,1.5,-3));
    finishAttack();
  }

  function doRapidFist(){
    BOSS.busy=true; let count=0;
    const next = ()=>{
      sfx.tel_shock.currentTime=0; sfx.tel_shock.play().catch(()=>{});
      spawnShockwave( ()=>{ count++; if(count<(BOSS.phase===1?3:4)){ after(BOSS.phase===1?450:380, next); } else { finishAttack(); } } );
    };
    next();
  }
  function spawnShockwave(onDone){
    const ring=document.createElement('a-ring'); ring.classList.add('clickable','boss-attack');
    ring.setAttribute('position','0 1.2 -2.6'); ring.setAttribute('radius-inner','0.05'); ring.setAttribute('radius-outer','0.07');
    ring.setAttribute('material','color: #ffd166; opacity: 0.95; shader: flat');
    const arena=$el('arena'); arena.appendChild(ring);
    ring.addEventListener('click', ()=>{ floatText('BREAK','#00ffa3', ring.object3D.getWorldPosition(new THREE.Vector3())); bossDamage(16, ring.object3D.getWorldPosition(new THREE.Vector3())); cleanup(); });
    const start=performance.now(), dur=BOSS.phase===1?700:560;
    function step(){
      if(!ring.parentNode) return;
      const t=(performance.now()-start)/dur;
      const r=0.07 + t*0.9;
      ring.setAttribute('radius-inner', Math.max(0.01, r-0.02));
      ring.setAttribute('radius-outer', r);
      if(t>=1.0){ playerHit('#ff9c6b'); cleanup(); return; }
      requestAnimationFrame(step);
    }
    function cleanup(){ ring.parentNode && ring.parentNode.removeChild(ring); onDone && onDone(); }
    requestAnimationFrame(step);
  }

  function doGuardBreak(){
    BOSS.busy=true; sfx.tel_guard.currentTime=0; sfx.tel_guard.play().catch(()=>{});
    const core=document.createElement('a-sphere'); core.classList.add('clickable','boss-attack');
    core.setAttribute('radius','0.2'); core.setAttribute('color','#ff6b6b'); core.setAttribute('position','0 1.1 -2.2');
    core.setAttribute('scale','0.001 0.001 0.001');
    core.setAttribute('animation__in',{property:'scale', to:'1 1 1', dur:140, easing:'easeOutBack'});
    $el('arena').appendChild(core);
    core.addEventListener('click', ()=>{ bossDamage(10, core.object3D.getWorldPosition(new THREE.Vector3())); removeCore(); });
    after(BOSS.phase===1?900:750, ()=>{ if(!core.parentNode){ finishAttack(); return; } playerHit('#ff3355'); removeCore(); });
    function removeCore(){ core.parentNode && core.parentNode.removeChild(core); finishAttack(); }
  }

  // === Phase 2: Shadow Dash (dodge left/right) ===
  function doShadowDash(){
    BOSS.busy=true; sfx.tel_dash.currentTime=0; sfx.tel_dash.play().catch(()=>{});
    const l=document.createElement('a-box'), r=document.createElement('a-box');
    [l,r].forEach((b,i)=>{ b.classList.add('clickable','boss-attack'); b.setAttribute('width','0.5'); b.setAttribute('height','0.3'); b.setAttribute('depth','0.05');
      b.setAttribute('color', i===0?'#00d0ff':'#00ffa3'); b.setAttribute('position', (i===0?'-0.9':'0.9')+' 1.0 -2.0'); $el('arena').appendChild(b); });
    let dodged=false;
    const onDodge = (box)=>{ if(dodged) return; dodged=true; floatText('DODGE','#9bd1ff', box.object3D.getWorldPosition(new THREE.Vector3())); bossDamage(12, box.object3D.getWorldPosition(new THREE.Vector3())); cleanup(); };
    l.addEventListener('click', ()=>onDodge(l)); r.addEventListener('click', ()=>onDodge(r));
    after(700, ()=>{ if(!dodged){ playerHit('#ff8844'); cleanup(); } });
    function cleanup(){ l.parentNode && l.parentNode.removeChild(l); r.parentNode && r.parentNode.removeChild(r); finishAttack(); }
  }

  // === Phase 2: Multi-Slash (2 parries in sequence; shorter windows) ===
  function doMultiSlash(){
    BOSS.busy=true;
    const seq=[-35, 35]; let idx=0;
    const next=()=>{
      sfx.tel_slash.currentTime=0; sfx.tel_slash.play().catch(()=>{});
      const g=document.createElement('a-entity'); g.setAttribute('geometry','primitive: box; height: 0.04; width: 1.2; depth: 0.04');
      g.setAttribute('material','color: #ff3355; opacity: 0.85; transparent: true'); g.setAttribute('rotation','0 0 '+seq[idx]); g.setAttribute('position','0 1.35 -2.2');
      g.classList.add('clickable','boss-attack'); $el('arena').appendChild(g);
      let ok=false; g.addEventListener('click', ()=>{ ok=true; floatText('PARRY','#00ffa3', g.object3D.getWorldPosition(new THREE.Vector3())); bossDamage(16, new THREE.Vector3(0,1.5,-3)); g.remove(); });
      after(650, ()=>{ if(g.parentNode){ g.remove(); if(!ok) playerHit('#ff5577'); } idx++; if(idx<seq.length){ after(120, next); } else { finishAttack(); } });
    }; next();
  }

  // === Phase 2: Enrage Combo (fast chain) ===
  function doEnrageCombo(){
    BOSS.busy=true; sfx.enrage.currentTime=0; sfx.enrage.play().catch(()=>{}); APP.badge('ENRAGE!');
    // chain: slash -> shock -> guard core quick -> reward crystal
    const seq=[
      ()=>doSlashCrossQuick(()=>step()),
      ()=>doShockQuick(()=>step()),
      ()=>doGuardQuick(()=>step()),
      ()=>vulnerability(()=>finishAttack())
    ];
    let i=0; function step(){ i++; if(i<seq.length){ seq[i](); } }
    seq[0]();

    function doSlashCrossQuick(done){
      const arena=$el('arena'); const guide=document.createElement('a-entity');
      guide.setAttribute('geometry','primitive: box; height: 0.04; width: 1.2; depth: 0.04');
      guide.setAttribute('material','color: #ff3355; opacity: 0.9; transparent: true');
      guide.setAttribute('rotation','0 0 -35'); guide.setAttribute('position','0 1.4 -2.2'); guide.classList.add('clickable');
      arena.appendChild(guide); let ok=false; sfx.tel_slash.currentTime=0; sfx.tel_slash.play().catch(()=>{});
      guide.addEventListener('click', ()=>{ ok=true; bossDamage(18, new THREE.Vector3(0,1.5,-3)); guide.remove(); done(); });
      after(520, ()=>{ if(guide.parentNode){ guide.remove(); if(!ok) playerHit('#ff5577'); done(); } });
    }
    function doShockQuick(done){
      sfx.tel_shock.currentTime=0; sfx.tel_shock.play().catch(()=>{});
      const ring=document.createElement('a-ring'); ring.classList.add('clickable'); ring.setAttribute('position','0 1.2 -2.6');
      ring.setAttribute('radius-inner','0.05'); ring.setAttribute('radius-outer','0.07'); ring.setAttribute('material','color:#ffd166;opacity:.95;shader:flat');
      $el('arena').appendChild(ring);
      ring.addEventListener('click', ()=>{ bossDamage(14, ring.object3D.getWorldPosition(new THREE.Vector3())); ring.remove(); done(); });
      const start=performance.now(), dur=500; (function step2(){ if(!ring.parentNode) return; const t=(performance.now()-start)/dur; const r=0.07 + t*0.9;
        ring.setAttribute('radius-inner', Math.max(0.01, r-0.02)); ring.setAttribute('radius-outer', r); if(t>=1.0){ playerHit('#ff9c6b'); ring.remove(); done(); return;} requestAnimationFrame(step2);} )();
    }
    function doGuardQuick(done){
      sfx.tel_guard.currentTime=0; sfx.tel_guard.play().catch(()=>{});
      const core=document.createElement('a-sphere'); core.classList.add('clickable'); core.setAttribute('radius','0.18'); core.setAttribute('color','#ff6b6b'); core.setAttribute('position','0 1.15 -2.2');
      core.setAttribute('scale','0.001 0.001 0.001'); core.setAttribute('animation__in',{property:'scale', to:'1 1 1', dur:120, easing:'easeOutBack'});
      $el('arena').appendChild(core); let ok=false; core.addEventListener('click', ()=>{ ok=true; bossDamage(12, core.object3D.getWorldPosition(new THREE.Vector3())); core.remove(); done(); });
      after(600, ()=>{ if(core.parentNode){ core.remove(); if(!ok) playerHit('#ff3355'); done(); } });
    }
    function vulnerability(done){
      // reward - big damage if clicked
      const gem=document.createElement('a-icosahedron'); gem.classList.add('clickable'); gem.setAttribute('position','0 1.6 -2.4');
      gem.setAttribute('radius','0.18'); gem.setAttribute('color','#00ffa3'); $el('arena').appendChild(gem);
      gem.addEventListener('click', ()=>{ floatText('CRITICAL!','#00ffa3', gem.object3D.getWorldPosition(new THREE.Vector3())); bossDamage(40, gem.object3D.getWorldPosition(new THREE.Vector3())); sfx.success.currentTime=0; sfx.success.play().catch(()=>{}); gem.remove(); done(); });
      after(700, ()=>{ if(gem.parentNode){ gem.remove(); done(); } });
    }
  }

  function finishAttack(){ BOSS.busy=false; after(520, bossLoop); }

  function enterPhase2(){ BOSS.phase=2; APP.badge('Phase 2'); sfx.enrage.currentTime=0; sfx.enrage.play().catch(()=>{}); }

  function start(){ if(running) return; reset(); running=true;
    spawnTimer=setInterval(spawnTarget, 900);
    timer=setInterval(()=>{ timeLeft--; $('#time').textContent=timeLeft; if(timeLeft<=0) end(); },1000);
    setTimeout(bossSpawn, 900);
  }
  function reset(){ score=0; timeLeft=60; combo=0; maxCombo=0; hits=0; spawns=0;
    $('#score').textContent=score; $('#time').textContent=timeLeft; onComboChange();
    $el('results').style.display='none'; bossShowUI(false);
    const arena=$el('arena'); Array.from(arena.children).forEach(c=>c.remove()); }
  function end(){ running=false; clearInterval(timer); clearInterval(spawnTimer);
    const acc=spawns? Math.round((hits/spawns)*100):0;
    $el('rScore').textContent=score; $el('rMaxCombo').textContent=maxCombo; $el('rAcc').textContent=acc+'%';
    $el('results').style.display='flex'; APP.badge(APP.t('results')+': '+score);
    if(window.Leaderboard){ Leaderboard.postResult('shadow-breaker', {score,maxCombo,accuracy:acc}); } }

  function spawnTarget(){ spawns++; const arena=$el('arena'); const spec=pickType();
    const el=document.createElement(Math.random()<0.5?'a-box':'a-sphere');
    const x=(Math.random()*3.2-1.6).toFixed(2), y=(Math.random()*1.6+1.0).toFixed(2), z=(Math.random()*-2.0-1.8).toFixed(2);
    el.setAttribute('position',`${x} ${y} ${z}`); el.setAttribute('sb-target',{type:spec.id,req:spec.req,angle:(spec.angle||'')}); arena.appendChild(el); }
  function pickType(){ const r=Math.random(); if(r<0.55) return TYPES[0]; if(r<0.72) return TYPES[2]; if(r<0.92) return TYPES[1]; return TYPES[3]; }

  function applyScore(kind, method, pos, spec){
    if(kind==='miss'){ combo=0; onComboChange(); sfx.miss.currentTime=0; sfx.miss.play().catch(()=>{}); floatText('MISS','#ff5577',pos); return; }
    combo++; if(combo>maxCombo) maxCombo=combo; const mult=1+Math.floor(combo/10);
    let base=0, dmg=0;
    if(method==='laser'){ base=10; dmg=6; } else { if(kind==='perfect'){ base=spec.basePerfect; dmg=18; } else { base=spec.baseGood; dmg=10; } }
    if(spec.id==='heavy'){ dmg += 6; }
    score += base*mult; hits++; $('#score').textContent=score; onComboChange();
    if(method==='laser'){ sfx.laser.currentTime=0; sfx.laser.play().catch(()=>{}); floatText('GOOD','#9bd1ff',pos); }
    else if(spec.id==='heavy'){ sfx.heavy.currentTime=0; sfx.heavy.play().catch(()=>{}); floatText(kind==='perfect'?'HEAVY PERFECT':'HEAVY','#ff9c6b',pos); }
    else if(kind==='perfect'){ sfx.perfect.currentTime=0; sfx.perfect.play().catch(()=>{}); floatText('PERFECT','#00ffa3',pos); }
    else { sfx.slash.currentTime=0; sfx.slash.play().catch(()=>{}); floatText('GOOD','#00d0ff',pos); }
    if(spec.bonus==='time+5'){ timeLeft=Math.min(99,timeLeft+5); $('#time').textContent=timeLeft; floatText('+5s','#00ffa3',pos); }
    bossDamage(dmg, pos);
  }

  function registerHit(target, info){
    if(!target.getAttribute('visible')) return;
    const tpos=target.object3D.getWorldPosition(new THREE.Vector3());
    const comp=target.components['sb-target']; const ttype=comp? comp.data.type:'basic'; const spec=TYPES.find(x=>x.id===ttype)||TYPES[0];
    clearTimeout(comp?.dieTimer); target.setAttribute('animation__out',{property:'scale',to:'0.001 0.001 0.001',dur:120,easing:'easeInBack'});
    setTimeout(()=>{ target.remove(); },130);
    applyScore(info.kind||info.type, info.method||info.type, tpos, spec);
    AudioBus.tap();
  }

  function miss(target){
    if(target && target.parentNode){ const tpos=target.object3D.getWorldPosition(new THREE.Vector3()); target.remove(); applyScore('miss','timeout', tpos, TYPES[0]); }
    else { combo=0; onComboChange(); }
  }

  function dirMatches(v,spec){ if(spec.req!=='angle') return true; const want=ANGLES[spec.angle]||ANGLES['diag_lr']; const vv=v.clone().normalize(); return vv.dot(want)>=ANGLE_TOL; }
  function checkSlashHits(){
    if(!running) return; const arena=$el('arena'); const targets=Array.from(arena.querySelectorAll('.sb-target')); if(targets.length===0) return;
    const lh=$el('leftHand'), rh=$el('rightHand'); const lc=lh.components['hand-speed'], rc=rh.components['hand-speed'];
    const ls=lc?.data?.speed||0, rs=rc?.data?.speed||0; const lv=lc?.vel||new THREE.Vector3(), rv=rc?.vel||new THREE.Vector3();
    const lp=lh.object3D.getWorldPosition(new THREE.Vector3()), rp=rh.object3D.getWorldPosition(new THREE.Vector3());
    targets.forEach(t=>{
      if(!t.getAttribute('visible')) return; const comp=t.components['sb-target']; const spec=TYPES.find(x=>x.id===(comp?.data?.type))||TYPES[0];
      const pos=t.object3D.getWorldPosition(new THREE.Vector3()); const dl=lp.distanceTo(pos), dr=rp.distanceTo(pos);
      if(ls>=SLASH_SPEED_GOOD && dl<=HIT_DISTANCE_GOOD && dirMatches(lv,spec)){ const kind=(ls>=SLASH_SPEED_PERFECT && dl<=HIT_DISTANCE_PERFECT)?'perfect':'good'; registerHit(t,{type:'slash',kind}); return; }
      if(rs>=SLASH_SPEED_GOOD && dr<=HIT_DISTANCE_GOOD && dirMatches(rv,spec)){ const kind=(rs>=SLASH_SPEED_PERFECT && dr<=HIT_DISTANCE_PERFECT)?'perfect':'good'; registerHit(t,{type:'slash',kind}); return; }
    });
  }

  AFRAME.registerSystem('sb-loop',{tick(){ checkSlashHits(); }});

  document.addEventListener('DOMContentLoaded', ()=>{
    $('#startBtn').addEventListener('click', start);
    $('#replayBtn').addEventListener('click', ()=>{ start(); });
    $('#backBtn').addEventListener('click', ()=>{ window.location.href='../../index.html'; });
  });
})();