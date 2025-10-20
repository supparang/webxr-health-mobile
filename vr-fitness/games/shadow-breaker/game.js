(function(){
  // ===== Core state =====
  let score=0, timeLeft=60, timer=null, running=false;
  let combo=0, maxCombo=0, hits=0, spawns=0, spawnTimer=null;

  // ===== Targets (as before) =====
  const TYPES=[
    {id:'basic', color:'#00d0ff', baseGood:20, basePerfect:30, life:2200, req:'any'},
    {id:'heavy', color:'#ff6b6b', baseGood:40, basePerfect:60, life:2600, req:'angle', angle:'diag_lr'},
    {id:'fast',  color:'#ffd166', baseGood:28, basePerfect:40, life:1400, req:'any'},
    {id:'bonus', color:'#00ffa3', baseGood:0,  basePerfect:0,  life:2200, req:'any', bonus:'time+5'}
  ];
  const SLASH_SPEED_GOOD=1.4, SLASH_SPEED_PERFECT=2.2, HIT_DISTANCE_GOOD=0.45, HIT_DISTANCE_PERFECT=0.35;

  // ===== Slash direction (for 'heavy') =====
  const ANGLES={
    'diag_lr': new THREE.Vector3(1,0,-1).normalize(),
    'diag_rl': new THREE.Vector3(-1,0,-1).normalize(),
    'updown' : new THREE.Vector3(0,-1,-1).normalize(),
    'downup' : new THREE.Vector3(0,1,-1).normalize()
  };
  const ANGLE_TOL=0.55; // easier -> increase

  // ===== SFX =====
  const sfx={
    slash:   new Audio('../../assets/sfx/slash.wav'),
    laser:   new Audio('../../assets/sfx/laser.wav'),
    perfect: new Audio('../../assets/sfx/perfect.wav'),
    miss:    new Audio('../../assets/sfx/miss.wav'),
    heavy:   new Audio('../../assets/sfx/heavy.wav'),
    combo:   new Audio('../../assets/sfx/combo.wav')
  };

  function $(q){return document.querySelector(q);} function $el(id){return document.getElementById(id);}

  // ===== Components =====
  AFRAME.registerComponent('hand-speed',{schema:{speed:{type:'number',default:0}},init(){this.prev=null;this.prevT=performance.now();this.vel=new THREE.Vector3();},
    tick(){const p=this.el.object3D.getWorldPosition(new THREE.Vector3());const now=performance.now();
      if(this.prev){const dt=(now-this.prevT)/1000;if(dt>0){const dx=p.x-this.prev.x,dy=p.y-this.prev.y,dz=p.z-this.prev.z;this.vel.set(dx/dt,dy/dt,dz/dt);this.data.speed=this.vel.length();}}
      this.prev=p.clone();this.prevT=now;}});

  AFRAME.registerComponent('sb-target',{schema:{type:{default:'basic'},req:{default:'any'},angle:{default:''}},init(){
    const el=this.el; el.classList.add('sb-target','clickable'); el.setAttribute('scale','0.001 0.001 0.001');
    el.setAttribute('animation__in',{property:'scale',to:'1 1 1',dur:160,easing:'easeOutBack'});
    const spec=TYPES.find(x=>x.id===this.data.type)||TYPES[0]; el.setAttribute('color', spec.color);
    this.dieTimer=setTimeout(()=>{ miss(el); }, spec.life||2200); el.addEventListener('click', ()=>{ registerHit(el,{type:'laser'}); });
    if(spec.req==='angle'){ const guide=document.createElement('a-entity'); const dir=ANGLES[spec.angle]||ANGLES['diag_lr'];
      const rotY=Math.atan2(dir.x,-dir.z)*180/Math.PI; const rotX=Math.asin(dir.y)*180/Math.PI;
      guide.setAttribute('geometry','primitive: box; height: 0.03; width: 0.7; depth: 0.03');
      guide.setAttribute('material','color: #ffffff; opacity: 0.6; transparent: true'); guide.setAttribute('rotation',`${rotX} ${rotY} 0`);
      el.appendChild(guide); }
  },remove(){clearTimeout(this.dieTimer);}});

  // ===== Floating text =====
  function floatText(text,color,pos){const label=document.createElement('a-entity');
    label.setAttribute('text',{value:text,color,align:'center',width:2.6}); const p=pos.clone(); p.y+=0.2;
    label.setAttribute('position',`${p.x} ${p.y} ${p.z}`); label.setAttribute('scale','0.001 0.001 0.001');
    label.setAttribute('animation__in',{property:'scale',to:'1 1 1',dur:90,easing:'easeOutQuad'});
    label.setAttribute('animation__rise',{property:'position',to:`${p.x} ${p.y+0.6} ${p.z}`,dur:600,easing:'easeOutQuad'});
    label.setAttribute('animation__fade',{property:'opacity',to:0,dur:480,delay:160,easing:'linear'});
    $el('arena').appendChild(label); setTimeout(()=>{ label.remove(); },800); }

  // ===== Combo milestone =====
  function onComboChange(){ $('#combo').textContent=combo; if(combo>0 && combo%10===0){ sfx.combo.currentTime=0; sfx.combo.play().catch(()=>{}); APP.badge('Combo x'+(1+Math.floor(combo/10))); } }

  // ===== Boss (HP4 Oni Rage Mode) =====
  const BOSS={active:false,hp:0,max:1000,rage:false,name:'RAZORFIST'};
  function bossShowUI(show){ const bar=$el('bossBar'); if(!bar)return; bar.style.display=show?'block':'none'; }
  function bossSetHP(h){ BOSS.hp=Math.max(0,Math.min(BOSS.max,h)); const fill=$el('bossHPFill'); if(fill){ fill.style.width=((BOSS.hp/BOSS.max)*100)+'%'; }
    const bar=$el('bossBar'); if(bar){ const rageNow = (BOSS.hp/BOSS.max)<=0.33; if(rageNow!==BOSS.rage){ BOSS.rage=rageNow; bar.classList.toggle('rage', BOSS.rage); } } }
  function bossDamage(amount, pos){
    if(!BOSS.active) return;
    // Oni Armor reduces base dmg slightly; if rage -> armor -50%
    const armor = BOSS.rage ? 0.1 : 0.2;
    const final = Math.max(1, Math.round(amount*(1-armor)));
    bossSetHP(BOSS.hp - final);
    if(BOSS.hp<=0){ onBossDefeated(pos); }
  }
  function onBossDefeated(pos){
    BOSS.active=false; floatText('BOSS DEFEATED','#00ffa3', pos||new THREE.Vector3(0,1.5,-2.5));
    APP.badge('RazorFist down!');
    // End round immediately with victory bonus
    score += 250; $('#score').textContent=score;
    end(); // show results (and Leaderboard)
  }
  function bossIntro_OP5(){
    // Hell Trainer Mode: simple camera-shake + boom text
    bossShowUI(true); bossSetHP(BOSS.max);
    // mini “BOOM” cue
    APP.badge('BOOM!'); setTimeout(()=>APP.badge('You want power? EARN IT!'), 600);
  }
  function bossSpawn(){
    BOSS.active=true; BOSS.max=1000; BOSS.hp=BOSS.max; BOSS.rage=false; bossShowUI(true); bossSetHP(BOSS.max); bossIntro_OP5();
    // (Prototype) Invisible boss anchor (future use for model/attacks)
    const anchor=document.createElement('a-entity'); anchor.setAttribute('id','bossAnchor'); anchor.setAttribute('position','0 1.5 -3');
    $el('arena').appendChild(anchor);
  }

  // ===== Game flow =====
  function start(){
    if(running) return; reset(); running=true;
    // Spawn training targets + Boss together (prototype)
    spawnTimer=setInterval(spawnTarget, 850);
    timer=setInterval(()=>{ timeLeft--; $('#time').textContent=timeLeft; if(timeLeft<=0) end(); },1000);
    // Boss entry a moment after start
    setTimeout(bossSpawn, 900);
  }
  function reset(){
    score=0; timeLeft=60; combo=0; maxCombo=0; hits=0; spawns=0;
    $('#score').textContent=score; $('#time').textContent=timeLeft; onComboChange();
    $el('results').style.display='none'; bossShowUI(false);
    const arena=$el('arena'); Array.from(arena.children).forEach(c=>c.remove());
  }
  function end(){
    running=false; clearInterval(timer); clearInterval(spawnTimer);
    const acc=spawns? Math.round((hits/spawns)*100):0;
    $el('rScore').textContent=score; $el('rMaxCombo').textContent=maxCombo; $el('rAcc').textContent=acc+'%';
    $el('results').style.display='flex'; APP.badge(APP.t('results')+': '+score);
    if(window.Leaderboard){ Leaderboard.postResult('shadow-breaker', {score,maxCombo,accuracy:acc}); }
  }

  // ===== Targets =====
  function spawnTarget(){
    spawns++; const arena=$el('arena'); const spec=pickType();
    const el=document.createElement(Math.random()<0.5?'a-box':'a-sphere');
    const x=(Math.random()*3.2-1.6).toFixed(2), y=(Math.random()*1.6+1.0).toFixed(2), z=(Math.random()*-2.0-1.8).toFixed(2);
    el.setAttribute('position',`${x} ${y} ${z}`); el.setAttribute('sb-target',{type:spec.id,req:spec.req,angle:(spec.angle||'')}); arena.appendChild(el);
  }
  function pickType(){ const r=Math.random(); if(r<0.55) return TYPES[0]; if(r<0.72) return TYPES[2]; if(r<0.92) return TYPES[1]; return TYPES[3]; }

  // ===== Scoring + Boss damage hook =====
  function applyScore(kind, method, pos, spec){
    if(kind==='miss'){ combo=0; onComboChange(); sfx.miss.currentTime=0; sfx.miss.play().catch(()=>{}); floatText('MISS','#ff5577',pos); return; }
    combo++; if(combo>maxCombo) maxCombo=combo; const mult=1+Math.floor(combo/10);
    let base=0, dmg=0;
    if(method==='laser'){ base=10; dmg=6; }
    else { if(kind==='perfect'){ base=spec.basePerfect; dmg=18; } else { base=spec.baseGood; dmg=10; } }
    if(spec.id==='heavy'){ dmg += 6; } // heavy target add-on
    score += base*mult; hits++; $('#score').textContent=score; onComboChange();

    // FX
    if(method==='laser'){ sfx.laser.currentTime=0; sfx.laser.play().catch(()=>{}); floatText('GOOD','#9bd1ff',pos); }
    else if(spec.id==='heavy'){ sfx.heavy.currentTime=0; sfx.heavy.play().catch(()=>{}); floatText(kind==='perfect'?'HEAVY PERFECT':'HEAVY','#ff9c6b',pos); }
    else if(kind==='perfect'){ sfx.perfect.currentTime=0; sfx.perfect.play().catch(()=>{}); floatText('PERFECT','#00ffa3',pos); }
    else { sfx.slash.currentTime=0; sfx.slash.play().catch(()=>{}); floatText('GOOD','#00d0ff',pos); }

    if(spec.bonus==='time+5'){ timeLeft=Math.min(99,timeLeft+5); $('#time').textContent=timeLeft; floatText('+5s','#00ffa3',pos); }

    // === Boss damage here ===
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

  // ===== Direction match =====
  function dirMatches(v,spec){ if(spec.req!=='angle') return true; const want=ANGLES[spec.angle]||ANGLES['diag_lr']; const vv=v.clone().normalize(); return vv.dot(want)>=ANGLE_TOL; }

  // ===== Slash detector =====
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

  // hook loop
  AFRAME.registerSystem('sb-loop',{tick(){ checkSlashHits(); }});

  // UI
  document.addEventListener('DOMContentLoaded', ()=>{
    $('#startBtn').addEventListener('click', start);
    $('#replayBtn').addEventListener('click', ()=>{ start(); });
    $('#backBtn').addEventListener('click', ()=>{ window.location.href='../../index.html'; });
  });
})();
