/* games/shadow-breaker/game.js
   Shadow Breaker · game.js (byId fix + Start works + Coach bottom-left + Correct Hub + Mouse/Touch click)
*/
(function(){
  "use strict";

  // ---------- Helpers ----------
  function byId(id){ return document.getElementById(id); }
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const getQuery=(k)=>new URLSearchParams(location.search).get(k);
  const ASSET_BASE=(document.querySelector('meta[name="asset-base"]')?.content||'').replace(/\/+$/,'');
  const HUB_URL="https://supparang.github.io/webxr-health-mobile/vr-fitness/";

  const APPX={
    badge:(t)=>{ if(window.APP?.badge) APP.badge(t); else console.log('[BADGE]',t); },
    t:(k)=>window.APP?.t?APP.t(k):k
  };

  // null-safe remove (กัน removeChild of null)
  function safeRemove(el){
    try{ if(!el) return; if(!el.isConnected && !el.parentNode) return;
      if(el.parentNode) el.parentNode.removeChild(el); else el.remove?.();
    }catch(_){}
  }

  // timeouts guard
  const timeouts = new Set();
  const after=(ms,fn)=>{ const id=setTimeout(()=>{timeouts.delete(id); try{fn();}catch(_){}} ,ms); timeouts.add(id); return id; };

  // ---------- Difficulty ----------
  function getDiffKey(){
    const q=getQuery('diff'); const ls=localStorage.getItem('sb_diff');
    return (window.APP?.story?.difficulty)||q||ls||'normal';
  }
  const DIFFS={
    easy:   { hp:0.85, atkWin:1.15, dmgMul:0.9,  chainMin:10, spawnInt:950, scoreMul:0.9,  title:'EASY'   },
    normal: { hp:1.00, atkWin:1.00, dmgMul:1.0,  chainMin:15, spawnInt:900, scoreMul:1.0,  title:'NORMAL' },
    hard:   { hp:1.20, atkWin:0.90, dmgMul:1.1,  chainMin:20, spawnInt:820, scoreMul:1.1,  title:'HARD'   },
    final:  { hp:1.35, atkWin:0.85, dmgMul:1.2,  chainMin:25, spawnInt:780, scoreMul:1.2,  title:'FINAL'  }
  };
  let D=DIFFS.normal;

  // ---------- RNG ----------
  function dailySeed(){
    const d=new Date(); const key=`${d.getUTCFullYear()}-${d.getUTCMonth()+1}-${d.getUTCDate()}`;
    let s=0; for(const c of key){ s=(s*131+c.charCodeAt(0))>>>0; } return s>>>0;
  }
  let seed=dailySeed();
  function RND(){ seed=(seed*1664525+1013904223)>>>0; return (seed&0x7fffffff)/0x80000000; }

  // ---------- State ----------
  let running=false, paused=false, timer=null, spawnTimer=null;
  let score=0, combo=0, maxCombo=0, hits=0, spawns=0, timeLeft=60;
  let CURRENT_BOSS=0, fever=false, feverT=0, MQ=null, bank=0;
  let ADAPT=1, AFFIX_PHANTOM=false, AFFIX_SPLIT_SLASH=false;
  const STANCES={ power:{dmg:1.2, parry:0.9, title:'POWER'}, swift:{dmg:0.9, parry:1.1, title:'SWIFT'} };
  let ST=STANCES.swift;
  window.PERFECT_BONUS=0; window.PARRY_WINDOW=1; window.TIME_SCALE=1;
  const dur=(ms)=> ms*D.atkWin*(ST.parry||1)*(window.PARRY_WINDOW||1)*(window.TIME_SCALE||1);

  // ---------- Types / hit windows ----------
  const TYPES=[
    {id:'basic', color:'#00d0ff', baseGood:20, basePerfect:30, life:2200, req:'any', icon:'◆'},
    {id:'heavy', color:'#ff6b6b', baseGood:40, basePerfect:60, life:2600, req:'angle', angle:'diag_lr', icon:'⬥'},
    {id:'fast',  color:'#ffd166', baseGood:28, basePerfect:40, life:1400, req:'any', icon:'⬢'},
    {id:'bonus', color:'#00ffa3', baseGood:0,  basePerfect:0,  life:2200, req:'any', bonus:'time+5', icon:'✚'}
  ];
  const SLASH_SPEED_GOOD=1.2, SLASH_SPEED_PERFECT=2.0; // โอนอ่อนลงให้ตีง่ายขึ้นเล็กน้อย
  const HIT_DISTANCE_GOOD=0.52, HIT_DISTANCE_PERFECT=0.36;

  // ---------- Angles ----------
  const ANGLES={
    diag_lr: new THREE.Vector3(1,0,-1).normalize(),
    diag_rl: new THREE.Vector3(-1,0,-1).normalize(),
    updown : new THREE.Vector3(0,-1,-1).normalize(),
    downup : new THREE.Vector3(0,1,-1).normalize()
  };
  const ANGLE_TOL=0.55;

  // ---------- SFX ----------
  const SFXN=(p)=>{ const a=new Audio(p); a.onerror=()=>console.warn('SFX missing',p); a.crossOrigin='anonymous'; return a; };
  const SFX={
    slash:SFXN(`${ASSET_BASE}/assets/sfx/slash.wav`),
    laser:SFXN(`${ASSET_BASE}/assets/sfx/laser.wav`),
    perfect:SFXN(`${ASSET_BASE}/assets/sfx/perfect.wav`),
    miss:SFXN(`${ASSET_BASE}/assets/sfx/miss.wav`),
    heavy:SFXN(`${ASSET_BASE}/assets/sfx/heavy.wav`),
    combo:SFXN(`${ASSET_BASE}/assets/sfx/combo.wav`),
    hp_hit:SFXN(`${ASSET_BASE}/assets/sfx/hp_hit.wav`),
    boss_roar:SFXN(`${ASSET_BASE}/assets/sfx/boss_roar.wav`),
    success:SFXN(`${ASSET_BASE}/assets/sfx/success.wav`),
    enrage:SFXN(`${ASSET_BASE}/assets/sfx/enrage.wav`),
  };
  const lastPlay=new Map();
  function play(a,guardMs=120){ try{
    const now=performance.now(); if(lastPlay.get(a)&&now-lastPlay.get(a)<guardMs) return;
    a.currentTime=0; lastPlay.set(a,now); if(a.paused) a.play();
  }catch(_){ } }

  // ---------- HUD ----------
  function updateHUD(){ byId('score').textContent=Math.round((score+bank)*D.scoreMul); byId('combo').textContent=combo; byId('time').textContent=timeLeft; }
  function onComboChange(){
    byId('combo').textContent=combo;
    if(combo>0 && combo%10===0){ play(SFX.combo); APPX.badge('Combo x'+(1+Math.floor(combo/10))); }
    if(combo>maxCombo) maxCombo=combo;
    if(combo>=25) tryFever();
  }
  function setPhaseLabel(n){ const el=byId('phaseLabel'); if(el) el.textContent='Phase '+n; }
  function scoreAdd(v){ const mul = fever?1.5:1; score += Math.round(v*mul); updateHUD(); }

  function floatText(text,color,pos){
    const e=document.createElement('a-entity'), p=pos.clone(); p.y+=0.22;
    e.setAttribute('text',{value:text,color,align:'center',width:2.6});
    e.setAttribute('position',`${p.x} ${p.y} ${p.z}`);
    e.setAttribute('scale','0.001 0.001 0.001');
    e.setAttribute('animation__in',{property:'scale',to:'1 1 1',dur:90,easing:'easeOutQuad'});
    e.setAttribute('animation__rise',{property:'position',to:`${p.x} ${p.y+0.6} ${p.z}`,dur:600,easing:'easeOutQuad'});
    e.setAttribute('animation__fade',{property:'opacity',to:0,dur:480,delay:160,easing:'linear'});
    byId('arena').appendChild(e); setTimeout(()=>safeRemove(e),820);
  }

  // ---------- Boss ----------
  const BOSS={active:false,hp:0,max:1000,rage:false,phase:1,busy:false,anchor:null,name:'',color:'#ff3355', P1:[], P2:[], armorShards:0};
  const BOSSES_ALL=[
    { id:'RazorFist', title:'RAZORFIST', baseHP:1000, color:'#ff3355',
      P1:['slash_cross','rapid_fist','guard_break'],
      P2:['shadow_dash','multi_slash','enrage_combo']
    },
    { id:'AshOni', title:'ASH ONI', baseHP:1200, color:'#ffa133',
      P1:['shadow_dash','guard_break','rapid_fist'],
      P2:['multi_slash','ground_shock','enrage_combo_fast']
    }
  ];
  function makeRoster(diffKey){
    if(diffKey==='easy')   return [BOSSES_ALL[0]];
    if(diffKey==='normal') return [BOSSES_ALL[0], BOSSES_ALL[1]];
    return [BOSSES_ALL[0], BOSSES_ALL[1]];
  }
  let ROSTER=makeRoster('normal');

  function bossShowUI(show){ const bar=byId('bossBar'); if(bar) bar.style.display=show?'block':'none'; }
  function bossSetHP(h){
    const was=BOSS.hp;
    BOSS.hp = clamp(h,0,BOSS.max);
    const fill=byId('bossHPFill'); if(fill) fill.style.width=((BOSS.hp/BOSS.max)*100)+'%';
    const bar=byId('bossBar');
    if(bar){
      const rageNow=(BOSS.hp/BOSS.max)<=0.33;
      if(rageNow!==BOSS.rage){ BOSS.rage=rageNow; bar.classList.toggle('rage', BOSS.rage); }
    }
    if(BOSS.phase===1 && (BOSS.hp/BOSS.max)<=0.5) enterPhase2();
    if(BOSS.hp<=0 && was>0) onBossDefeated();
  }
  function bossDamage(amount,pos){
    if(!BOSS.active) return;
    const armorPhase=(BOSS.phase===2 && BOSS.armorShards>0)?0.3:1.0;
    const armorBase=BOSS.rage?0.1:0.2;
    const final=Math.max(1,Math.round(amount*(ST.dmg||1)*(1-armorBase)*armorPhase*D.dmgMul));
    play(SFX.hp_hit); bossSetHP(BOSS.hp-final);
  }

  function bossIntro(){
    const arena=byId('arena');
    const anchor=document.createElement('a-entity');
    anchor.setAttribute('id','bossAnchor');
    anchor.setAttribute('position','0 1.5 -3');
    // simple head
    const head=document.createElement('a-sphere'); head.setAttribute('radius','0.35'); head.setAttribute('color','#1a1a1a');
    const mask=document.createElement('a-box'); mask.setAttribute('depth','0.06'); mask.setAttribute('width','0.55'); mask.setAttribute('height','0.45'); mask.setAttribute('color',BOSS.color||'#ff3355'); mask.setAttribute('position','0 0 0.25');
    anchor.appendChild(head); anchor.appendChild(mask);
    arena.appendChild(anchor); BOSS.anchor=anchor;

    bossShowUI(true); bossSetHP(BOSS.max);
    play(SFX.boss_roar);
    APPX.badge((BOSS.name||'BOSS')+' · '+(DIFFS[getDiffKey()]?.title||'NORMAL')+' · '+(ST.title||'')); setPhaseLabel(1);
  }

  function applyBossAffix(){
    AFFIX_SPLIT_SLASH=false; AFFIX_PHANTOM=false;
    const roll=RND();
    if(roll<0.5){ AFFIX_SPLIT_SLASH=true; APPX.badge('Affix: Split Slash'); }
    else { AFFIX_PHANTOM=true; APPX.badge('Affix: Phantoms'); }
  }

  function bossSpawn(index=0){
    const cfg=ROSTER[index]||ROSTER[0];
    BOSS.active=true; BOSS.max=Math.round(cfg.baseHP*D.hp); BOSS.hp=BOSS.max; BOSS.rage=false; BOSS.phase=1; BOSS.busy=false; BOSS.armorShards=0;
    BOSS.name=cfg.title; BOSS.color=cfg.color; BOSS.P1=cfg.P1.slice(); BOSS.P2=cfg.P2.slice();
    bossIntro(); pIndex=0; lastPattern='';
    if(index>=1) applyBossAffix();
    after(800, bossLoop);
  }

  function onBossDefeated(){
    BOSS.active=false;
    floatText('BOSS DEFEATED','#00ffa3', new THREE.Vector3(0,1.6,-2.3));
    scoreAdd(250);
    end();
  }

  function enterPhase2(){
    BOSS.phase=2; APPX.badge('Phase 2'); play(SFX.enrage); setPhaseLabel(2);
  }

  // Mutators (สุ่มบัฟเล็ก ๆ)
  const MUTATORS=[
    {id:'perfect_plus', name:'Perfect+2', apply:()=>{ window.PERFECT_BONUS=2; }},
    {id:'extra_beam',   name:'+1 Beam',   apply:()=>{ window.EXTRA_BEAM=true; }},
  ];
  function rollMutators(n=1){
    const picks=[]; const pool=[...MUTATORS];
    while(picks.length<n && pool.length){ const i=Math.floor(RND()*pool.length); picks.push(pool.splice(i,1)[0]); }
    picks.forEach(m=>m.apply()); APPX.badge('MOD: '+picks.map(m=>m.name).join(', '));
  }

  // Fever
  function tryFever(){ if(!fever && combo>=25){ fever=true; feverT=performance.now()+8000; APPX.badge('FEVER!'); } }
  setInterval(()=>{ if(fever && performance.now()>feverT){ fever=false; APPX.badge('Fever End'); } },150);

  // Micro Quest: Perfect x5 => +5s
  function spawnMicroQuest(){ MQ={need:5, done:0, until:performance.now()+8000}; APPX.badge('OBJ: PERFECT x5!'); }
  setInterval(()=>{ if(!running) return; if(!MQ && RND()<0.03) spawnMicroQuest(); if(MQ && performance.now()>MQ.until){ MQ=null; } },1000);
  function onPerfect(){ if(MQ){ MQ.done++; if(MQ.done>=MQ.need){ timeLeft=Math.min(99,timeLeft+5); byId('time').textContent=timeLeft; MQ=null; } } }

  // ---------- Patterns ----------
  let pIndex=0, lastPattern='';
  function pickPattern(arr){
    let p=arr[pIndex % arr.length]; pIndex++;
    if(p===lastPattern){ p=arr[(pIndex) % arr.length]; pIndex++; }
    lastPattern=p; return p;
  }
  function bossLoop(){
    if(!running || !BOSS.active || BOSS.busy) return;
    const arr=(BOSS.phase===1? BOSS.P1 : BOSS.P2);
    const pattern=pickPattern(arr);
    ({
      'slash_cross':doSlashCross,
      'rapid_fist':doRapidFist,
      'guard_break':doGuardBreak,
      'shadow_dash':doShadowDash,
      'multi_slash':doMultiSlash,
      'enrage_combo':doEnrageCombo,
      'ground_shock':doGroundShock,
      'enrage_combo_fast':doEnrageCombo,
    }[pattern]||(()=>{ BOSS.busy=false; }))();
  }
  function finishAttack(){ BOSS.busy=false; after(dur(520), bossLoop); }

  function doSlashCross(){
    BOSS.busy=true; play(SFX.slash);
    const mk=(rot)=>{ const g=document.createElement('a-entity');
      g.setAttribute('geometry','primitive: box; height:0.04;width:1.2;depth:0.04');
      g.setAttribute('material','color:#5de1ff;opacity:.95;transparent:true');
      g.setAttribute('rotation',`0 0 ${rot}`); g.setAttribute('position','0 1.4 -2.2');
      g.classList.add('clickable','boss-attack'); byId('arena').appendChild(g); return g; };
    const a=mk(-35), b= (AFFIX_SPLIT_SLASH? mk(35) : null);
    let ca=false, cb=!b;
    const ok=()=>{ if(ca && cb){ bossDamage(28,new THREE.Vector3(0,1.5,-3)); cleanup(); } };
    a.addEventListener('click', ()=>{ ca=true; floatText('PARRY','#00ffa3', a.object3D.getWorldPosition(new THREE.Vector3())); safeRemove(a); ok(); });
    b?.addEventListener('click', ()=>{ cb=true; floatText('PARRY','#00ffa3', b.object3D.getWorldPosition(new THREE.Vector3())); safeRemove(b); ok(); });
    after(dur(700), ()=>{ cleanup(true); });
    function cleanup(to){ if(a?.parentNode){ safeRemove(a); if(to && !ca) playerHit(); } if(b?.parentNode){ safeRemove(b); if(to && !cb) playerHit(); } finishAttack(); }
  }
  function doRapidFist(){
    BOSS.busy=true; let c=0;
    (function next(){ spawnShockwave(()=>{ c++; if(c<3){ after(dur(420), next);} else finishAttack(); }); })();
  }
  function spawnShockwave(done){
    const ring=document.createElement('a-ring'); ring.classList.add('clickable','boss-attack');
    ring.setAttribute('position','0 1.2 -2.6'); ring.setAttribute('radius-inner','0.05'); ring.setAttribute('radius-outer','0.07');
    ring.setAttribute('material','color:#ffd166;opacity:.95;shader:flat'); byId('arena').appendChild(ring);
    ring.addEventListener('click', ()=>{ const p=ring.object3D.getWorldPosition(new THREE.Vector3()); floatText('BREAK','#00ffa3', p); bossDamage(16,p); safeRemove(ring); done&&done(); });
    const start=performance.now(), T=dur(620);
    (function step(){ if(!ring || !ring.parentNode) return; const t=(performance.now()-start)/T; const r=0.07+t*0.9;
      ring.setAttribute('radius-inner',Math.max(0.01,r-0.02)); ring.setAttribute('radius-outer',r);
      if(t>=1){ playerHit(); safeRemove(ring); done&&done(); return; } requestAnimationFrame(step);
    })();
  }
  function doGuardBreak(){
    BOSS.busy=true;
    const core=document.createElement('a-sphere'); core.classList.add('clickable','boss-attack');
    core.setAttribute('radius','0.2'); core.setAttribute('color','#ff6b6b'); core.setAttribute('position','0 1.1 -2.2');
    core.setAttribute('scale','0.001 0.001 0.001'); core.setAttribute('animation__in',{property:'scale',to:'1 1 1',dur:140,easing:'easeOutBack'});
    byId('arena').appendChild(core);
    core.addEventListener('click', ()=>{ const p=core.object3D.getWorldPosition(new THREE.Vector3()); bossDamage(10,p); safeRemove(core); finishAttack(); });
    after(dur(760), ()=>{ if(core && core.parentNode){ playerHit(); safeRemove(core); } finishAttack(); });
  }
  function doShadowDash(){
    BOSS.busy=true;
    const l=document.createElement('a-box'), r=document.createElement('a-box');
    [l,r].forEach((b,i)=>{ b.classList.add('clickable','boss-attack'); b.setAttribute('width','0.5'); b.setAttribute('height','0.3'); b.setAttribute('depth','0.05');
      b.setAttribute('color', i===0?'#00d0ff':'#00ffa3'); b.setAttribute('position', (i===0?'-0.9':'0.9')+' 1.0 -2.0'); byId('arena').appendChild(b); });
    let ok=false; const hit=(box)=>{ if(ok) return; ok=true; floatText('DODGE','#9bd1ff', box.object3D.getWorldPosition(new THREE.Vector3())); bossDamage(12,new THREE.Vector3(0,1.5,-3)); cleanup(); };
    l.addEventListener('click', ()=>hit(l)); r.addEventListener('click', ()=>hit(r));
    after(dur(700), ()=>{ if(!ok) playerHit(); cleanup(); });
    function cleanup(){ [l,r].forEach(b=>b && b.parentNode && safeRemove(b)); finishAttack(); }
  }
  function doMultiSlash(){
    BOSS.busy=true; const seq=[-35,35]; let i=0;
    (function next(){
      const g=document.createElement('a-entity'); g.setAttribute('geometry','primitive: box; height:0.04;width:1.2;depth:0.04');
      g.setAttribute('material','color:#5de1ff;opacity:.95;transparent:true'); g.setAttribute('rotation','0 0 '+seq[i]); g.setAttribute('position','0 1.35 -2.2');
      g.classList.add('clickable','boss-attack'); byId('arena').appendChild(g);
      let ok=false; g.addEventListener('click', ()=>{ ok=true; floatText('PARRY','#00ffa3', g.object3D.getWorldPosition(new THREE.Vector3())); bossDamage(16,new THREE.Vector3(0,1.5,-3)); safeRemove(g); });
      after(dur(650), ()=>{ if(g && g.parentNode){ safeRemove(g); if(!ok) playerHit(); } i++; if(i<seq.length){ after(dur(120),next);} else finishAttack(); });
    })();
  }
  function doEnrageCombo(){ BOSS.busy=true; APPX.badge('ENRAGE!');
    const seq=[()=>spawnShockwave(()=>step()), ()=>doMultiSlash(()=>step())]; let j=0; function step(){ j++; if(j<seq.length) seq[j](); else finishAttack(); } seq[0]();
  }
  function doGroundShock(){ return doRapidFist(); }

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
    const label=document.createElement('a-entity'); label.setAttribute('text',{value:spec.icon||'•',color:'#02131b',align:'center',width:1.8}); label.setAttribute('position','0 0 0.03'); el.appendChild(label);
    this.dieTimer=setTimeout(()=>{ miss(el); }, spec.life||2200);
    el.addEventListener('click', ()=> registerHit(el,{type:'laser'}));
    if(spec.req==='angle'){ const dir=ANGLES[spec.angle]||ANGLES.diag_lr;
      const rotY=Math.atan2(dir.x,-dir.z)*180/Math.PI, rotX=Math.asin(dir.y)*180/Math.PI;
      const g=document.createElement('a-entity'); g.setAttribute('geometry','primitive: box; height: 0.03; width: 0.7; depth: 0.03');
      g.setAttribute('material','color:#ffffff;opacity:.55;transparent:true'); g.setAttribute('rotation',`${rotX} ${rotY} 0`); el.appendChild(g); }
  },remove(){ clearTimeout(this.dieTimer); }});

  function pickType(){ const r=RND(); if(r<0.6) return TYPES[0]; if(r<0.8) return TYPES[2]; if(r<0.95) return TYPES[1]; return TYPES[3]; }
  function spawnTarget(){
    spawns++;
    const spec=pickType();
    const el=document.createElement(RND()<0.5?'a-box':'a-sphere');
    const x=(RND()*3.2-1.6).toFixed(2), y=(RND()*1.6+1.0).toFixed(2), z=(RND()*-2.0-1.8).toFixed(2);
    el.setAttribute('position',`${x} ${y} ${z}`); el.setAttribute('sb-target',{type:spec.id,req:spec.req,angle:(spec.angle||'')}); byId('arena').appendChild(el);
  }

  function dirMatches(v,spec){ if(spec.req!=='angle') return true; const want=ANGLES[spec.angle]||ANGLES.diag_lr; const vv=v.clone().normalize(); return vv.dot(want)>=ANGLE_TOL; }
  function applyScore(kind, method, pos, spec){
    if(kind==='miss'){ combo=0; onComboChange(); play(SFX.miss); floatText('MISS','#ff5577',pos); return; }
    combo++; onComboChange();
    let base=0, dmg=0;
    if(method==='laser'){ base=10; dmg=6; } else { if(kind==='perfect'){ base=spec.basePerfect+(window.PERFECT_BONUS||0); dmg=18; onPerfect(); } else { base=spec.baseGood; dmg=10; } }
    if(spec.id==='heavy') dmg+=6;

    scoreAdd(base);
    hits++; updateHUD();

    if(method==='laser'){ play(SFX.laser); floatText('GOOD','#9bd1ff',pos); }
    else if(spec.id==='heavy'){ play(SFX.heavy); floatText(kind==='perfect'?'HEAVY PERFECT':'HEAVY','#ff9c6b',pos); }
    else if(kind==='perfect'){ play(SFX.perfect); floatText('PERFECT','#00ffa3',pos); }
    else { play(SFX.slash); floatText('GOOD','#00d0ff',pos); }

    if(spec.bonus==='time+5'){ timeLeft=Math.min(99,timeLeft+5); byId('time').textContent=timeLeft; floatText('+5s','#00ffa3',pos); }
    bossDamage(dmg,pos);
  }
  function registerHit(target, info){
    if(!target.getAttribute('visible')) return;
    const p=target.object3D.getWorldPosition(new THREE.Vector3());
    const comp=target.components['sb-target']; const spec=TYPES.find(x=>x.id===(comp?.data?.type))||TYPES[0];
    clearTimeout(comp?.dieTimer); target.setAttribute('animation__out',{property:'scale',to:'0.001 0.001 0.001',dur:120,easing:'easeInBack'});
    setTimeout(()=>safeRemove(target),130);
    applyScore(info.kind||info.type, info.method||info.type, p, spec);
  }
  function miss(target){
    if(target && target.parentNode){ const p=target.object3D.getWorldPosition(new THREE.Vector3()); safeRemove(target); applyScore('miss','timeout', p, TYPES[0]); }
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

  // ---------- Game Flow ----------
  function clearArena(){ const a=byId('arena'); Array.from(a.children).forEach(c=>safeRemove(c)); }
  function reset(){
    score=0; bank=0; combo=0; maxCombo=0; hits=0; spawns=0; timeLeft=60; updateHUD();
    fever=false; MQ=null; AFFIX_PHANTOM=false; AFFIX_SPLIT_SLASH=false; ADAPT=1;
    byId('results').style.display='none'; bossShowUI(false); clearArena();
    setPhaseLabel(1);
  }
  function start(){
    if(running) return;
    const key=getDiffKey(); D=DIFFS[key]||DIFFS.normal; localStorage.setItem('sb_diff',key);
    ROSTER=makeRoster(key);
    window.PERFECT_BONUS=0; window.PARRY_WINDOW=1; window.TIME_SCALE=1; window.EXTRA_BEAM=false;
    rollMutators(1);

    reset(); running=true;
    spawnTimer=setInterval(spawnTarget, Math.max(420, D.spawnInt*(window.TIME_SCALE||1)));
    timer=setInterval(()=>{ timeLeft--; byId('time').textContent=timeLeft; if(timeLeft<=0) end(); },1000);

    CURRENT_BOSS=0; after(dur(900), ()=>bossSpawn(CURRENT_BOSS));
    coachSay("เริ่ม! ฟันให้เร็วพอ แล้วเล็งเป้าให้ใกล้ ๆ ตัว");
  }
  function end(){
    running=false; clearInterval(timer); clearInterval(spawnTimer);
    timeouts.forEach(clearTimeout); timeouts.clear();
    bossShowUI(false);

    const acc = spawns? Math.round((hits/spawns)*100) : 0;
    byId('rScore').textContent=Math.round((score+bank)*D.scoreMul);
    byId('rMaxCombo').textContent=maxCombo;
    byId('rAcc').textContent=acc+'%';
    byId('results').style.display='flex';
  }
  function togglePause(){
    if(!running) return;
    paused=!paused;
    if(paused){ clearInterval(timer); clearInterval(spawnTimer); coachSay("พักหายใจสักนิด แล้วลุยต่อ!"); }
    else {
      timer=setInterval(()=>{ timeLeft--; byId('time').textContent=timeLeft; if(timeLeft<=0) end(); },1000);
      spawnTimer=setInterval(spawnTarget, Math.max(420, D.spawnInt*(window.TIME_SCALE||1)));
      coachSay("ไปต่อ!");
    }
  }
  function bankNow(){ const add=Math.floor(combo*3); bank+=add; APPX.badge('Bank +'+add); combo=0; onComboChange(); updateHUD(); }

  // ---------- Coach (ล่างซ้ายใกล้ปุ่ม Bank) ----------
  function mountCoach(){
    if(byId('coachDock')) return;
    const dock=document.createElement('div');
    dock.id='coachDock';
    Object.assign(dock.style,{
      position:'fixed', left:'12px', bottom:'58px', zIndex:9999, display:'flex', gap:'8px', alignItems:'center'
    });
    dock.innerHTML=`
      <div id="coachBubble" style="
        max-width: 58vw; background:rgba(12,22,30,.85); color:#e6f7ff;
        border:1px solid rgba(255,255,255,.08); border-radius:12px; padding:8px 10px;
        font:600 12px system-ui; box-shadow:0 4px 14px rgba(0,0,0,.25);">
        👟 โค้ช: แตะ/ฟันให้เร็วพอ แล้วเข้าจังหวะ!
      </div>
      <button id="coachMute" style="padding:6px 10px;border:0;border-radius:10px;background:#0e2233;color:#e6f7ff;cursor:pointer">Hide</button>`;
    document.body.appendChild(dock);
    byId('coachMute').addEventListener('click', ()=>{
      const b=byId('coachBubble'); if(!b) return; const vis=b.style.display!=='none';
      b.style.display= vis ? 'none' : 'block';
      byId('coachMute').textContent= vis ? 'Show' : 'Hide';
    });
  }
  function coachSay(msg){
    const b=byId('coachBubble'); if(!b) return; b.textContent='👟 โค้ช: '+msg;
  }

  // ---------- Wire Buttons ----------
  document.addEventListener('DOMContentLoaded', ()=>{
    mountCoach();
    byId('startBtn')?.addEventListener('click', start);
    byId('replayBtn')?.addEventListener('click', ()=>{ byId('results').style.display='none'; start(); });
    byId('backBtn')?.addEventListener('click', ()=>{ location.href=HUB_URL; });
    byId('pauseBtn')?.addEventListener('click', togglePause);
    byId('bankBtn')?.addEventListener('click', bankNow);
  });

  // ---------- Pointer Raycast (คลิกเมาส์/ทัชให้โดนแน่) ----------
  (function installPointerRaycast(){
    const sceneEl=document.querySelector('a-scene'); if(!sceneEl) return;
    const raycaster=new THREE.Raycaster(); const mouse=new THREE.Vector2();
    function pick(clientX,clientY){
      const cam=sceneEl.camera; if(!cam) return;
      mouse.x=(clientX/window.innerWidth)*2-1; mouse.y=-(clientY/window.innerHeight)*2+1;
      raycaster.setFromCamera(mouse, cam);
      const objects=[]; Array.from(document.querySelectorAll('.clickable')).forEach(el=> el.object3D?.traverse(o=>objects.push(o)));
      const hits=raycaster.intersectObjects(objects,true);
      if(hits && hits.length){ let o=hits[0].object; while(o && !o.el) o=o.parent; o?.el?.emit('click'); }
    }
    addEventListener('mousedown',e=>pick(e.clientX,e.clientY),{passive:true});
    addEventListener('touchstart',e=>{ const t=e.touches?.[0]; if(t) pick(t.clientX,t.clientY); },{passive:true});
  })();

  // ---------- Safety ----------
  window.addEventListener('beforeunload', ()=>{
    try{ clearInterval(timer); clearInterval(spawnTimer); }catch(_){}
    try{ timeouts.forEach(clearTimeout); timeouts.clear(); }catch(_){}
  });

  // ---------- iOS audio unlock ----------
  (function unlockAudio(){
    let unlocked=false, Ctx=(window.AudioContext||window.webkitAudioContext);
    let ctx=Ctx?new Ctx():null;
    function resume(){ if(unlocked||!ctx) return; ctx.resume?.(); unlocked=(ctx.state==='running'); }
    ['touchstart','pointerdown','mousedown','keydown'].forEach(ev=>document.addEventListener(ev,resume,{once:true,passive:true}));
  })();

})();
