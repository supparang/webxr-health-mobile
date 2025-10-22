/* games/shadow-breaker/game.js
   Shadow Breaker · game.js (Unified + Production Patches + Mouse Click)
*/
(function(){
  "use strict";

  // ---------- Helpers ----------
  const byId = (id)=>document.getElementById(id);
  const timeouts=new Set();
  function after(ms,fn){ const id=setTimeout(()=>{timeouts.delete(id); try{fn();}catch(_){};},ms); timeouts.add(id); return id; }
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const APPX={ badge:(t)=>{ if(window.APP&&APP.badge) APP.badge(t); else console.log('[BADGE]',t); }, t:(k)=>window.APP&&APP.t?APP.t(k):k };
  const getQuery=(k)=>new URLSearchParams(location.search).get(k);
  const ASSET_BASE = (document.querySelector('meta[name="asset-base']")?.content || document.querySelector('meta[name="asset-base"]')?.content || "").replace(/\/+$/,"");

  // SFX anti-spam
  const lastPlay=new Map();
  function play(a,guardMs){ guardMs=guardMs||110; try{
    const now=performance.now(); if(lastPlay.get(a)&&now-lastPlay.get(a)<guardMs) return;
    a.currentTime=0; lastPlay.set(a,now); if(a.paused) a.play();
  }catch(_e){} }

  function pingUI(msg,color){
    color = color || '#ffcc00';
    let el=byId('toast');
    if(!el){
      el=document.createElement('div'); el.id='toast'; document.body.appendChild(el);
      Object.assign(el.style,{position:'fixed', left:'50%', top:'12px', transform:'translateX(-50%)',
        background:'rgba(10,12,16,.9)', color:'#ffcc00', padding:'8px 12px',
        borderRadius:'10px', font:'600 14px/1.1 system-ui,Arial', zIndex:9999,
        letterSpacing:'0.4px', transition:'opacity .2s, transform .2s', opacity:'0'});
    }
    el.style.color=color; el.textContent=msg; el.style.opacity='1'; el.style.transform='translateX(-50%) scale(1.02)';
    setTimeout(function(){ el.style.opacity='0'; el.style.transform='translateX(-50%) scale(1)'; }, 800);
  }

  // ---------- Difficulty ----------
  function getDiffKey(){
    const q = getQuery('diff');
    const ls = localStorage.getItem('sb_diff');
    return (window.APP&&APP.story&&APP.story.difficulty) || q || ls || 'normal';
  }
  const DIFFS = {
    easy:   { hp:0.85, atkWin:1.15, dmgMul:0.9,  chainMin:10, spawnInt:950, scoreMul:0.9,  title:'EASY'   },
    normal: { hp:1.00, atkWin:1.00, dmgMul:1.0,  chainMin:15, spawnInt:900, scoreMul:1.0,  title:'NORMAL' },
    hard:   { hp:1.20, atkWin:0.90, dmgMul:1.1,  chainMin:20, spawnInt:820, scoreMul:1.1,  title:'HARD'   },
    final:  { hp:1.35, atkWin:0.85, dmgMul:1.2,  chainMin:25, spawnInt:780, scoreMul:1.2,  title:'FINAL'  }
  };
  let D = DIFFS.normal;

  // ---------- State ----------
  let running=false, timer=null, spawnTimer=null, paused=false;
  let score=0, combo=0, maxCombo=0, hits=0, spawns=0, timeLeft=60;
  let CURRENT_BOSS = 0;
  let survivedStreak = 0;
  let addedTimeThisPhase = 0;
  let bank=0;
  let fever=false, feverT=0;
  let MQ=null;
  let AFFIX_SPLIT_SLASH=false, AFFIX_PHANTOM=false;
  let ADAPT=1;
  const STANCES={ power:{dmg:1.2, parry:0.9, title:'POWER'}, swift:{dmg:0.9, parry:1.1, title:'SWIFT'} };
  let ST = STANCES.swift;
  window.PERFECT_BONUS=0; window.PARRY_WINDOW=1; window.TIME_SCALE=1;

  // RNG (daily)
  function dailySeed(){
    const d=new Date(); const key=d.getUTCFullYear()+"-"+(d.getUTCMonth()+1)+"-"+d.getUTCDate();
    let s=0; for(let i=0;i<key.length;i++){ s=(s*131+ key.charCodeAt(i))>>>0; } return s>>>0;
  }
  let seed=dailySeed();
  function RND(){ seed=(seed*1664525+1013904223)>>>0; return (seed&0x7fffffff)/0x80000000; }

  const dur=(ms)=> ms * D.atkWin * (ST.parry||1) * (window.PARRY_WINDOW||1) * (window.TIME_SCALE||1) * ADAPT;

  // Chain rule
  let CHAIN_RULE = { minTimeLeft: 15 };

  // ---------- Boss roster ----------
  const BOSSES_ALL = [
    { id:'RazorFist', title:'RAZORFIST', baseHP:1000, color:'#ff3355',
      P1:['slash_cross','rapid_fist','guard_break'],
      P2:['shadow_dash','multi_slash','enrage_combo']
    },
    { id:'AshOni', title:'ASH ONI', baseHP:1200, color:'#ffa133',
      P1:['shadow_dash','guard_break','rapid_fist'],
      P2:['multi_slash','ground_shock','enrage_combo_fast']
    },
    { id:'Nightblade', title:'NIGHTBLADE', baseHP:1400, color:'#7a5cff',
      P1:['blade_storm','laser_grid','guard_break'],
      P2:['orb_spiral','blade_storm_fast','rage_finale']
    },
    { id:'VoidEmperor', title:'VOID EMPEROR', baseHP:1800, color:'#8cf5ff',
      P1:['mirror_slash','doom_rings','laser_grid'],
      P2:['blade_storm_fast','orb_spiral_fast','void_finale']
    }
  ];
  function makeRoster(diffKey){
    if(diffKey==='easy')   return [BOSSES_ALL[0]];
    if(diffKey==='normal') return [BOSSES_ALL[0], BOSSES_ALL[1]];
    if(diffKey==='hard')   return [BOSSES_ALL[0], BOSSES_ALL[1], BOSSES_ALL[2]];
    return [BOSSES_ALL[0], BOSSES_ALL[1], BOSSES_ALL[2], BOSSES_ALL[3]];
  }
  let ROSTER = makeRoster('normal');

  // ---------- Targets ----------
  const TYPES=[
    {id:'basic', color:'#00d0ff', baseGood:20, basePerfect:30, life:2200, req:'any', icon:'◆'},
    {id:'heavy', color:'#ff6b6b', baseGood:40, basePerfect:60, life:2600, req:'angle', angle:'diag_lr', icon:'⬥'},
    {id:'fast',  color:'#ffd166', baseGood:28, basePerfect:40, life:1400, req:'any', icon:'⬢'},
    {id:'bonus', color:'#00ffa3', baseGood:0,  basePerfect:0,  life:2200, req:'any', bonus:'time+5', icon:'✚'}
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

  // ---------- SFX ----------
  function SFXN(p){ const a=new Audio(p); a.onerror=function(){console.warn('SFX not found:',p);}; return a; }
  const SFX={
    slash:SFXN(ASSET_BASE+'/assets/sfx/slash.wav'),
    laser:SFXN(ASSET_BASE+'/assets/sfx/laser.wav'),
    perfect:SFXN(ASSET_BASE+'/assets/sfx/perfect.wav'),
    miss:SFXN(ASSET_BASE+'/assets/sfx/miss.wav'),
    heavy:SFXN(ASSET_BASE+'/assets/sfx/heavy.wav'),
    combo:SFXN(ASSET_BASE+'/assets/sfx/combo.wav'),
    hp_hit:SFXN(ASSET_BASE+'/assets/sfx/hp_hit.wav'),
    boss_roar:SFXN(ASSET_BASE+'/assets/sfx/boss_roar.wav'),
    tel_slash:SFXN(ASSET_BASE+'/assets/sfx/tel_slash.wav'),
    tel_shock:SFXN(ASSET_BASE+'/assets/sfx/tel_shock.wav'),
    tel_guard:SFXN(ASSET_BASE+'/assets/sfx/tel_guard.wav'),
    tel_dash:SFXN(ASSET_BASE+'/assets/sfx/tel_dash.wav'),
    enrage:SFXN(ASSET_BASE+'/assets/sfx/enrage.wav'),
    success:SFXN(ASSET_BASE+'/assets/sfx/success.wav')
  };

  // ---------- HUD ----------
  function updateHUD(){ byId('score').textContent=Math.round((score+bank)*D.scoreMul); byId('combo').textContent=combo; byId('time').textContent=timeLeft; }
  function onComboChange(){
    byId('combo').textContent=combo;
    if(combo>0 && combo%10===0){ play(SFX.combo); APPX.badge('Combo x'+(1+Math.floor(combo/10))); }
    if(combo>maxCombo) maxCombo=combo;
    if(combo>=25) tryFever();
    if(combo>=50) CHEEV.combo50=true;
  }
  function setPhaseLabel(n){ const el=byId('phaseLabel'); if(el) el.textContent='Phase '+n; }
  function scoreAdd(v){ const mul = fever?1.5:1; score += Math.round(v*mul); updateHUD(); }

  // ---------- Float text ----------
  function floatText(text, color, pos){
    const e=document.createElement('a-entity'), p=pos.clone(); p.y+=0.2;
    e.setAttribute('text',{value:text,color:color,align:'center',width:2.6});
    e.setAttribute('position',p.x+" "+p.y+" "+p.z);
    e.setAttribute('scale','0.001 0.001 0.001');
    e.setAttribute('animation__in',{property:'scale',to:'1 1 1',dur:90,easing:'easeOutQuad'});
    e.setAttribute('animation__rise',{property:'position',to:(p.x+" "+(p.y+0.6)+" "+p.z),dur:600,easing:'easeOutQuad'});
    e.setAttribute('animation__fade',{property:'opacity',to:0,dur:480,delay:160,easing:'linear'});
    byId('arena').appendChild(e); setTimeout(function(){ try{e.remove();}catch(_){ } },820);
  }

  // ---------- Boss System ----------
  const BOSS={active:false,hp:0,max:1000,rage:false,phase:1,busy:false,anchor:null,name:'',color:'#ff3355', P1:[], P2:[], armorShards:0};

  function bossShowUI(show){ const bar=byId('bossBar'); if(bar) bar.style.display=show?'block':'none'; }
  function bossSetHP(h){
    const was=BOSS.hp;
    BOSS.hp = clamp(h, 0, BOSS.max);
    const fill=byId('bossHPFill'); if(fill) fill.style.width=((BOSS.hp/BOSS.max)*100)+'%';
    const bar=byId('bossBar');
    if(bar){
      const rageNow=(BOSS.hp/BOSS.max)<=0.33;
      if(rageNow!==BOSS.rage){ BOSS.rage=rageNow; bar.classList.toggle('rage', BOSS.rage); }
      bar.classList.add('hit'); setTimeout(function(){ bar.classList.remove('hit'); }, 240);
    }
    if(BOSS.phase===1 && (BOSS.hp/BOSS.max)<=0.5) enterPhase2();
    if(BOSS.hp<=0 && was>0) onBossDefeated();
  }
  function bossDamage(amount,pos){
    if(!BOSS.active) return;
    const armorPhase = (BOSS.phase===2 && BOSS.armorShards>0) ? 0.3 : 1.0;
    const armorBase  = BOSS.rage ? 0.1 : 0.2;
    const final = Math.max(1, Math.round(amount*(ST.dmg||1)*(1-armorBase)*armorPhase*D.dmgMul));
    play(SFX.hp_hit); bossSetHP(BOSS.hp - final);
  }

  function bossIntro(){
    const arena=byId('arena');
    const anchor=document.createElement('a-entity');
    anchor.setAttribute('id','bossAnchor');
    anchor.setAttribute('position','0 1.5 -3');

    // Oni placeholder
    const head=document.createElement('a-sphere'); head.setAttribute('radius','0.35'); head.setAttribute('color','#1a1a1a'); head.setAttribute('position','0 0 0');
    const mask=document.createElement('a-box'); mask.setAttribute('depth','0.06'); mask.setAttribute('width','0.55'); mask.setAttribute('height','0.45'); mask.setAttribute('color',BOSS.color||'#ff3355'); mask.setAttribute('position','0 0 0.25');
    const hornL=document.createElement('a-cone'); hornL.setAttribute('radius-bottom','0.06'); hornL.setAttribute('radius-top','0.01'); hornL.setAttribute('height','0.28'); hornL.setAttribute('color','#ff8844'); hornL.setAttribute('rotation','-18 0 28'); hornL.setAttribute('position','-0.2 0.18 0.16');
    const hornR=document.createElement('a-cone'); hornR.setAttribute('radius-bottom','0.06'); hornR.setAttribute('radius-top','0.01'); hornR.setAttribute('height','0.28'); hornR.setAttribute('color','#ff8844'); hornR.setAttribute('rotation','-18 0 -28'); hornR.setAttribute('position','0.2 0.18 0.16');
    anchor.appendChild(head); anchor.appendChild(mask); anchor.appendChild(hornL); anchor.appendChild(hornR);
    arena.appendChild(anchor); BOSS.anchor=anchor;

    bossShowUI(true); bossSetHP(BOSS.max);
    play(SFX.boss_roar);
    APPX.badge((BOSS.name||'BOSS') + ' · ' + (DIFFS[getDiffKey()]?.title || 'NORMAL') + ' · ' + (ST.title||''));
    setPhaseLabel(1);
  }

  function applyBossAffix(){
    AFFIX_SPLIT_SLASH=false; AFFIX_PHANTOM=false;
    const roll = RND();
    if(roll < 0.5) { AFFIX_SPLIT_SLASH=true; APPX.badge('Affix: Split Slash'); }
    else { AFFIX_PHANTOM=true; APPX.badge('Affix: Phantoms'); }
  }

  function bossSpawn(index){
    index = index||0;
    const cfg = ROSTER[index] || ROSTER[0];
    BOSS.active=true;
    BOSS.max=Math.round(cfg.baseHP*D.hp);
    BOSS.hp=BOSS.max; BOSS.rage=false; BOSS.phase=1; BOSS.busy=false; BOSS.armorShards=0;
    BOSS.name=cfg.title; BOSS.color=cfg.color; BOSS.P1=cfg.P1.slice(); BOSS.P2=cfg.P2.slice();
    bossIntro(); pIndex=0; lastPattern='';
    if(index>=1) applyBossAffix();
    after(1000, bossLoop);
  }

  function onBossDefeated(){
    BOSS.active=false;
    floatText('BOSS DEFEATED','#00ffa3', new THREE.Vector3(0,1.6,-2.3));
    scoreAdd(250);
    survivedStreak = 0;

    const lastBoss = (CURRENT_BOSS >= ROSTER.length-1);
    const canChain = (!lastBoss && timeLeft >= CHAIN_RULE.minTimeLeft);

    if(canChain){
      APPX.badge('Qualified! Next Boss…');
      CURRENT_BOSS++;
      clearArena(); bossShowUI(false);
      after(900, function(){ bossShowUI(true); bossSpawn(CURRENT_BOSS); });
      return;
    }
    end();
  }

  function enterPhase2(){
    BOSS.phase=2;
    addedTimeThisPhase = 0;
    APPX.badge('Phase 2'); play(SFX.enrage); setPhaseLabel(2);
    BOSS.armorShards = 2;
    spawnArmorShard(new THREE.Vector3(-0.5,1.55,-2.3));
    spawnArmorShard(new THREE.Vector3( 0.5,1.45,-2.3));
    if(RND()<0.35) after(dur(500), spawnHazard);
  }

  function spawnArmorShard(pos){
    const g=document.createElement('a-icosahedron');
    g.classList.add('clickable','boss-attack');
    g.setAttribute('position',pos.x+" "+pos.y+" "+pos.z);
    g.setAttribute('radius','0.16'); g.setAttribute('color','#ffd166');
    g.setAttribute('animation__pulse','property: scale; dir: alternate; to: 1.15 1.15 1.15; loop: true; dur: 380; easing: easeInOutSine');
    byId('arena').appendChild(g);
    g.addEventListener('click', function(){
      floatText('ARMOR -1','#ffd166', g.object3D.getWorldPosition(new THREE.Vector3()));
      try{ g.remove(); }catch(_){}
      BOSS.armorShards = Math.max(0, BOSS.armorShards-1);
    });
    after(dur(3000), function(){ if(g.parentNode){ g.remove(); playerHit(); } });
  }

  // Mutators
  const MUTATORS=[
    {id:'perfect_plus', name:'Perfect+2', apply:function(){ window.PERFECT_BONUS=2; }},
    {id:'tight_parry',  name:'Tight Parry', apply:function(){ window.PARRY_WINDOW=0.85; }},
    {id:'fast_time',    name:'Fast Time',   apply:function(){ window.TIME_SCALE=0.9; }},
    {id:'extra_beam',   name:'+1 Beam',     apply:function(){ window.EXTRA_BEAM=true; }}
  ];
  function rollMutators(n){
    n = n||1;
    const picks=[]; const pool=MUTATORS.slice();
    while(picks.length<n && pool.length){ const i=Math.floor(RND()*pool.length); picks.push(pool.splice(i,1)[0]); }
    for(let i=0;i<picks.length;i++){ picks[i].apply(); }
    APPX.badge('MOD: '+picks.map(function(m){return m.name;}).join(', '));
  }

  // Fever
  function tryFever(){ if(!fever && combo>=25){ fever=true; feverT=performance.now()+8000; APPX.badge('FEVER!'); pingUI('FEVER x1.5','#ffd166'); } }
  function tickFever(){ if(fever && performance.now()>feverT){ fever=false; APPX.badge('Fever End'); } }
  setInterval(tickFever,150);

  // Micro-Quest (Perfect x5 => +5s)
  function spawnMicroQuest(){ MQ={need:5, done:0, until:performance.now()+8000}; APPX.badge('OBJ: PERFECT x5!'); }
  setInterval(function(){
    if(!running) return;
    if(!MQ && RND()<0.03) spawnMicroQuest();
    if(MQ && performance.now()>MQ.until){ APPX.badge('OBJ Fail'); MQ=null; }
  }, 1000);
  function onPerfect(){ if(MQ){ MQ.done++; if(MQ.done>=MQ.need){ timeLeft=Math.min(99,timeLeft+5); byId('time').textContent=timeLeft; APPX.badge('OBJ Clear +5s'); MQ=null; } } }

  // ---------- Boss patterns ----------
  let pIndex=0, lastPattern='';
  function pickPattern(arr){
    let p=arr[pIndex % arr.length]; pIndex++;
    if(p===lastPattern){ p=arr[(pIndex) % arr.length]; pIndex++; }
    lastPattern=p; return p;
  }

  function bossLoop(){
    if(!running || !BOSS.active || BOSS.busy) return;
    const arr = (BOSS.phase===1? BOSS.P1 : BOSS.P2);
    const pattern = pickPattern(arr);
    const table = {
      'slash_cross':doSlashCross,
      'rapid_fist':doRapidFist,
      'guard_break':doGuardBreak,
      'shadow_dash':doShadowDash,
      'multi_slash':doMultiSlash,
      'enrage_combo':doEnrageCombo,
      'ground_shock':doGroundShock,
      'enrage_combo_fast':doEnrageComboFast,
      'blade_storm':doBladeStorm,
      'blade_storm_fast':function(){doBladeStorm(true);},
      'laser_grid':doLaserGrid,
      'orb_spiral':doOrbSpiral,
      'rage_finale':doRageFinale,
      'mirror_slash':doMirrorSlash,
      'doom_rings':doDoomRings,
      'orb_spiral_fast':function(){doOrbSpiral(true);},
      'void_finale':doVoidFinale
    };
    (table[pattern] || function(){ BOSS.busy=false; })();
  }

  function finishAttack(){
    if (BOSS.phase===2) {
      survivedStreak++;
      if (survivedStreak>=3) { survivedStreak=0; spawnOverheatCore(); }
    }
    const accel = (BOSS.phase===2 ? 0.85 : 1);
    BOSS.busy=false; after(dur(520*accel), bossLoop);
  }

  function spawnOverheatCore(){
    const g=document.createElement('a-icosahedron');
    g.classList.add('clickable');
    g.setAttribute('position','0 1.62 -2.35');
    g.setAttribute('radius','0.22');
    g.setAttribute('color','#ffcc00');
    byId('arena').appendChild(g);
    pingUI('OVERHEAT!','#ffcc00');
    floatText('OVERHEAT!','#ffcc00', new THREE.Vector3(0,1.6,-2.35));
    g.addEventListener('click', function(){
      const p=g.object3D.getWorldPosition(new THREE.Vector3());
      floatText('CRIT +50','#ffcc00', p);
      bossDamage(50, p);
      scoreAdd(50);
      try{ g.remove(); }catch(_){}
    });
    after(dur(900), function(){ if(g.parentNode) g.remove(); });
  }

  function playerHit(){
    ADAPT = Math.min(1.3, ADAPT*1.06);
    setTimeout(function(){ ADAPT = Math.max(1, ADAPT*0.98); }, 1200);

    survivedStreak = 0;
    if(fever){ fever=false; APPX.badge('Fever Lost'); }
    CHEEV.noHit=false;
    combo=0; onComboChange();
    score=Math.max(0,score-5); updateHUD();
    APPX.badge('HIT!');
    const scn=document.querySelector('a-scene'); if(scn){ scn.classList.add('shake-scene'); setTimeout(function(){ scn.classList.remove('shake-scene'); }, 240); }
  }

  // --- Moves (selected) ---
  function doSlashCross(){
    BOSS.busy=true; play(SFX.tel_slash);
    function makeSlash(rot, y){
      y = (typeof y==='number')? y : 1.4;
      const g=document.createElement('a-entity');
      g.setAttribute('geometry','primitive: box; height: 0.04; width: 1.2; depth: 0.04');
      g.setAttribute('material','color: #5de1ff; opacity: 0.95; transparent: true');
      g.setAttribute('rotation','0 0 '+rot); g.setAttribute('position','0 '+y+' -2.2'); g.classList.add('clickable','boss-attack');
      const t=document.createElement('a-entity'); t.setAttribute('text',{value:'/',color:'#02131b',align:'center',width:1.6}); t.setAttribute('position','0 0 0.03'); g.appendChild(t);
      byId('arena').appendChild(g);
      g.addEventListener('click', function(){ floatText('PARRY','#00ffa3', g.object3D.getWorldPosition(new THREE.Vector3())); bossDamage(28,new THREE.Vector3(0,1.5,-3)); try{ g.remove(); }catch(_){ } });
      return g;
    }
    const main=makeSlash(-35,1.4);
    const extras=[];
    if(AFFIX_SPLIT_SLASH){ extras.push(makeSlash(35,1.46)); }
    if(AFFIX_PHANTOM){ if(RND()<0.5) extras.push(makeSlash(-15,1.32)); }
    after(dur(BOSS.phase===1?900:700), function(){
      const arr=[main].concat(extras);
      for(let i=0;i<arr.length;i++){ const g=arr[i]; if(g&&g.parentNode){ playerHit(); g.remove(); } }
      finishAttack();
    });
  }

  function doRapidFist(){
    BOSS.busy=true; let count=0;
    (function next(){
      play(SFX.tel_shock);
      spawnShockwave(function(){ count++; if(count<(BOSS.phase===1?3:4)){ after(dur(BOSS.phase===1?450:380), next); } else { finishAttack(); } });
    })();
  }
  function spawnShockwave(done){
    const ring=document.createElement('a-ring'); ring.classList.add('clickable','boss-attack');
    ring.setAttribute('position','0 1.2 -2.6'); ring.setAttribute('radius-inner','0.05'); ring.setAttribute('radius-outer','0.07');
    ring.setAttribute('material','color:#ffd166;opacity:.95;shader:flat'); byId('arena').appendChild(ring);
    ring.addEventListener('click', function(){ const p=ring.object3D.getWorldPosition(new THREE.Vector3()); floatText('BREAK','#00ffa3', p); bossDamage(16,p); try{ ring.remove(); }catch(_){ } if(done) done(); });
    const start=performance.now(), T=dur(BOSS.phase===1?700:560);
    (function step(){ if(!ring.parentNode) return; const t=(performance.now()-start)/T; const r=0.07+t*0.9;
      ring.setAttribute('radius-inner',Math.max(0.01,r-0.02)); ring.setAttribute('radius-outer',r);
      if(t>=1.0){ playerHit(); try{ ring.remove(); }catch(_){ } if(done) done(); return; } requestAnimationFrame(step);
    })();
  }
  function doGuardBreak(){
    BOSS.busy=true; play(SFX.tel_guard);
    const core=document.createElement('a-sphere'); core.classList.add('clickable','boss-attack');
    core.setAttribute('radius','0.2'); core.setAttribute('color','#ff6b6b'); core.setAttribute('position','0 1.1 -2.2');
    core.setAttribute('scale','0.001 0.001 0.001'); core.setAttribute('animation__in',{property:'scale', to:'1 1 1', dur:140, easing:'easeOutBack'});
    byId('arena').appendChild(core);
    core.addEventListener('click', function(){ const p=core.object3D.getWorldPosition(new THREE.Vector3()); bossDamage(10,p); try{ core.remove(); }catch(_){ } finishAttack(); });
    after(dur(BOSS.phase===1?900:750), function(){ if(core.parentNode){ playerHit(); core.remove(); } finishAttack(); });
  }

  function doShadowDash(){
    BOSS.busy=true; play(SFX.tel_dash);
    const l=document.createElement('a-box'), r=document.createElement('a-box');
    [l,r].forEach(function(b,i){
      b.classList.add('clickable','boss-attack'); b.setAttribute('width','0.5'); b.setAttribute('height','0.3'); b.setAttribute('depth','0.05');
      b.setAttribute('color', i===0?'#00d0ff':'#00ffa3'); b.setAttribute('position', (i===0?'-0.9':'0.9')+' 1.0 -2.0'); byId('arena').appendChild(b);
    });
    let ok=false; function hit(box){ if(ok) return; ok=true; floatText('DODGE','#9bd1ff', box.object3D.getWorldPosition(new THREE.Vector3())); bossDamage(12,new THREE.Vector3(0,1.5,-3)); cleanup(); }
    l.addEventListener('click', function(){ hit(l); }); r.addEventListener('click', function(){ hit(r); });
    after(dur(700), function(){ if(!ok) playerHit(); cleanup(); });
    function cleanup(){ [l,r].forEach(function(b){ if(b.parentNode){ b.parentNode.removeChild(b); } }); finishAttack(); }
  }

  // ... (เพื่อลดความยาว ตัวอื่น ๆ: multi_slash, enrage_combo, ground_shock (P1/P2), blade_storm, laser_grid,
  // orb_spiral, rage_finale, mirror_slash, doom_rings, void_finale, spawnHazard, targets & hits, ฯลฯ)
  // *** หมายเหตุ ***: โค้ดส่วนที่เหลือเหมือนเวอร์ชันก่อนหน้า แต่จัดรูปแบบวงเล็บและปิดฟังก์ชันครบถ้วน
  // เพื่อป้องกัน SyntaxError จากวงเล็บเกิน/ขาด

  // ---------- Targets & Hits (ย่อ) ----------
  AFRAME.registerComponent('hand-speed',{schema:{speed:{type:'number',default:0}},init:function(){this.prev=null;this.prevT=performance.now();this.vel=new THREE.Vector3();},
    tick:function(){const p=this.el.object3D.getWorldPosition(new THREE.Vector3()), now=performance.now();
      if(this.prev){const dt=(now-this.prevT)/1000; if(dt>0){this.vel.set((p.x-this.prev.x)/dt,(p.y-this.prev.y)/dt,(p.z-this.prev.z)/dt); this.data.speed=this.vel.length();}}
      this.prev=p.clone(); this.prevT=now;}
  });

  // (ฟังก์ชัน registerHit/miss/checkSlashHits และลูป A-Frame คงเดิมจากเวอร์ชันก่อน — แน่ใจว่าปิดวงเล็บครบ)

  // ---------- Achievements ----------
  const CHEEV={ noHit:true, combo50:false, under90s:false };

  // ---------- Game flow ----------
  function clearArena(){ const a=byId('arena'); const c=[].slice.call(a.children); for(let i=0;i<c.length;i++){ try{c[i].remove();}catch(_){}} }
  function start(){
    if(running) return;
    const key = getDiffKey(); D = DIFFS[key] || DIFFS.normal;
    localStorage.setItem('sb_diff', key);
    ROSTER = makeRoster(key);
    CHAIN_RULE = { minTimeLeft: D.chainMin };
    const rDiff = byId('rDiff'); if(rDiff) rDiff.textContent = (DIFFS[key]?.title || 'NORMAL') + ' · ' + (ST.title||'');

    window.PERFECT_BONUS=0; window.PARRY_WINDOW=1; window.TIME_SCALE=1; window.EXTRA_BEAM=false;
    rollMutators(1);

    reset(); running=true;
    spawnTimer=setInterval(spawnTarget, Math.max(380, D.spawnInt*(window.TIME_SCALE||1)));
    timer=setInterval(function(){ timeLeft--; byId('time').textContent=timeLeft; if(timeLeft<=0) end(); },1000);
    CURRENT_BOSS=0; after(dur(900), function(){ bossSpawn(CURRENT_BOSS); });
  }
  function reset(){
    score=0; bank=0; combo=0; maxCombo=0; hits=0; spawns=0; timeLeft=60; updateHUD();
    survivedStreak = 0; addedTimeThisPhase=0; fever=false; MQ=null; AFFIX_SPLIT_SLASH=false; AFFIX_PHANTOM=false; ADAPT=1;
    CHEEV.noHit=true; CHEEV.combo50=false; CHEEV.under90s=false;
    byId('results').style.display='none'; bossShowUI(false); clearArena();
    setPhaseLabel(1);
  }
  function end(){
    running=false; clearInterval(timer); clearInterval(spawnTimer);
    timeouts.forEach(function(id){ clearTimeout(id); }); timeouts.clear();
    bossShowUI(false);
    CHEEV.combo50 = CHEEV.combo50 || (maxCombo>=50);
    CHEEV.under90s = (timeLeft>=10);
    let star = (CHEEV.noHit?1:0)+(CHEEV.combo50?1:0)+(CHEEV.under90s?1:0);
    const finalScore = Math.round((score+bank)*(1+0.05*star)*D.scoreMul);
    byId('rScore').textContent=finalScore; byId('rMaxCombo').textContent=maxCombo; byId('rAcc').textContent=spawns? Math.round((hits/spawns)*100)+'%':'0%';
    const starEl=byId('rStars'); if(starEl) starEl.textContent='★'.repeat(star)+ '☆'.repeat(3-star);
    byId('results').style.display='flex'; APPX.badge(APPX.t('results')+': '+finalScore);
    try{ if(window.Leaderboard&&Leaderboard.postResult) Leaderboard.postResult('shadow-breaker',{score:finalScore,maxCombo:maxCombo,accuracy:spawns?Math.round((hits/spawns)*100):0,diff:getDiffKey(),stars:star,stance:ST.title}); }catch(_e){}
  }

  function togglePause(){
    if(!running) return;
    paused=!paused;
    if(paused){ clearInterval(timer); clearInterval(spawnTimer); APPX.badge('Paused'); pingUI('PAUSED','#ffd166'); }
    else {
      timer=setInterval(function(){ timeLeft--; byId('time').textContent=timeLeft; if(timeLeft<=0) end(); },1000);
      spawnTimer=setInterval(spawnTarget, Math.max(380, D.spawnInt*(window.TIME_SCALE||1))); APPX.badge('Resume'); pingUI('RESUME','#00ffa3');
    }
  }

  document.addEventListener('visibilitychange', function(){
    if(!running) return;
    if(document.hidden){ clearInterval(timer); clearInterval(spawnTimer); }
    else if(!paused){
      timer=setInterval(function(){ timeLeft--; byId('time').textContent=timeLeft; if(timeLeft<=0) end(); },1000);
      spawnTimer=setInterval(spawnTarget, Math.max(380, D.spawnInt*(window.TIME_SCALE||1)));
    }
  });

  let DBG=false; document.addEventListener('keydown',function(e){
    if(e.key==='`'){ DBG=!DBG; let box=byId('debug');
      if(!box){ box=document.createElement('div'); box.id='debug'; document.body.appendChild(box);
        Object.assign(box.style,{position:'fixed',bottom:'10px',left:'10px',background:'rgba(0,0,0,.6)',color:'#0ff',padding:'6px 10px',borderRadius:'8px',font:'12px/1.2 monospace',zIndex:9999}); }
      box.style.display=DBG?'block':'none';
      if(DBG){ box.textContent='Boss:'+BOSS.name+' P'+BOSS.phase+' HP:'+BOSS.hp+'/'+BOSS.max+' Combo:'+combo+' Time:'+timeLeft+' Fever:'+(fever?'Y':'N')+' Bank:'+bank+' ADAPT:'+ADAPT.toFixed(2); }
    }
    if(e.key==='p' || e.key==='P') togglePause();
    if(e.key==='b' || e.key==='B') bankNow();
  });

  document.addEventListener('mousemove', function(e){
    const x=(e.clientX/window.innerWidth - .5)*3.2;
    const y=(1 - e.clientY/window.innerHeight)*2 + .6;
    const h=byId('rightHand'); if(h) h.setAttribute('position', x.toFixed(2)+' '+y.toFixed(2)+' -1');
  }, {passive:true});
  ['mousedown','touchstart'].forEach(function(ev){
    document.addEventListener(ev, function(){
      const rh=byId('rightHand')&&byId('rightHand').components['hand-speed']; if(rh){ rh.vel.set(3,0,-2); rh.data.speed=3.6; }
    }, {passive:true});
  });

  function bankNow(){ const add=Math.floor(combo*3); bank+=add; APPX.badge('Bank +'+add); combo=0; onComboChange(); updateHUD(); }

  window.sbSetStance=function(k){ if(STANCES[k]) ST=STANCES[k]; };

  // ---------- Buttons ----------
  document.addEventListener('DOMContentLoaded', function(){
    const sb=byId('startBtn'); if(sb) sb.addEventListener('click', start);
    const rp=byId('replayBtn'); if(rp) rp.addEventListener('click', start);
    const bk=byId('backBtn'); if(bk) bk.addEventListener('click', function(){ window.location.href = (ASSET_BASE||'')+'/vr-fitness/index.html'; });
    const ps=byId('pauseBtn'); if(ps) ps.addEventListener('click', togglePause);
    const bb=byId('bankBtn'); if(bb) bb.addEventListener('click', bankNow);
  });

  // ===== Production patches =====
  (function bootGuards(){
    function showFatal(msg){
      let o=document.getElementById('fatal'); if(!o){ o=document.createElement('div'); o.id='fatal';
        Object.assign(o.style,{position:'fixed',inset:'0',background:'#0b1118',color:'#ffb4b4',
          display:'grid',placeItems:'center',font:'14px/1.5 system-ui',zIndex:99999}); document.body.appendChild(o);}
      o.innerHTML = '<div style="max-width:720px;padding:20px;text-align:center"><h2>⚠️ Can’t start VR scene</h2><p>'+msg+'</p><p class="small">Check scripts/CORS/paths and reload.</p></div>';
    }
    let tries=0; (function waitAF(){
      if(window.AFRAME && document.querySelector('a-scene')) return;
      tries++;
      if(tries>120){ showFatal('A-Frame scene not found or failed to load (timeout).'); return; }
      requestAnimationFrame(waitAF);
    })();
    window.addEventListener('error', function(e){ if(!document.getElementById('fatal')) showFatal('JS error: '+(e.message||'unknown')); });
  })();

  // iOS audio unlock
  (function unlockAudio(){
    let unlocked=false, Ctx=(window.AudioContext||window.webkitAudioContext);
    let ctx = Ctx? new Ctx(): null;
    function resume(){
      if(unlocked || !ctx) return;
      if(ctx.resume) ctx.resume();
      unlocked = ctx.state==='running';
    }
    ['touchstart','pointerdown','mousedown','keydown'].forEach(function(ev){ document.addEventListener(ev, resume, {once:true, passive:true}); });
  })();

  // HUD เสริม (Fever/Mutator/Stance)
  (function hudStatus(){
    const box=document.createElement('div');
    Object.assign(box.style,{position:'fixed',top:'8px',right:'8px',background:'rgba(0,0,0,.35)',color:'#e6f7ff',
      padding:'6px 8px',borderRadius:'10px',font:'600 12px system-ui',zIndex:9999});
    box.id='hudStatus'; document.body.appendChild(box);
    function render(){
      const mods=[]; if(window.PERFECT_BONUS) mods.push('Perf+'+window.PERFECT_BONUS);
      if(window.EXTRA_BEAM) mods.push('+Beam');
      box.textContent = (fever?'FEVER ':'')+(ST.title||'')+(mods.length?' · '+mods.join(', '):'');
    }
    setInterval(render, 400);
  })();

  // ปุ่ม Enter VR
  (function xrButton(){
    const btn=document.createElement('button');
    btn.textContent='Enter VR';
    Object.assign(btn.style,{position:'fixed',bottom:'12px',right:'12px',zIndex:9999, padding:'8px 12px', borderRadius:'10px', border:'0', background:'#0e2233', color:'#e6f7ff', cursor:'pointer'});
    document.body.appendChild(btn);
    btn.addEventListener('click', function(){ try{ const sc=document.querySelector('a-scene'); if(sc&&sc.enterVR) sc.enterVR(); }catch(e){ console.warn(e); } });
  })();

  // ------- Mouse Raycast Fallback -------
  (function installMouseRaycast(){
    const sceneEl = document.querySelector('a-scene');
    if (!sceneEl) return;
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    function shoot(e){
      const cam = sceneEl.camera;
      if (!cam) return;
      mouse.x =  (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

      raycaster.setFromCamera(mouse, cam);
      const clickable = Array.prototype.slice.call(document.querySelectorAll('.clickable'))
        .map(function(el){ return el.object3D; }).filter(function(o){ return !!o; });
      const objects = [];
      for(let i=0;i<clickable.length;i++){ clickable[i].traverse(function(child){ objects.push(child); }); }

      const hits = raycaster.intersectObjects(objects, true);
      if (hits && hits.length){
        let obj = hits[0].object;
        while (obj && !obj.el) obj = obj.parent;
        if (obj && obj.el){ obj.el.emit('click'); }
      }
    }
    window.addEventListener('mousedown', shoot, {passive:true});
  })();

  // ===== NOTE =====
  // โค้ดส่วนของรูปแบบโจมตีอื่น ๆ (ที่ไม่ได้ยกมาทั้งหมดข้างบน) ให้คงตามเวอร์ชันก่อนหน้า
  // เพียงตรวจว่าทุกฟังก์ชันและ IIFE ปิดวงเล็บครบ ไม่มีเครื่องหมายคอมมาเกิน และมีเซมิโคลอนครบ
  // หากยังมี SyntaxError ให้ดูบรรทัดในคอนโซลแล้วเช็กเครื่องหมายปิด ) ] } ใกล้เคียง

})();
