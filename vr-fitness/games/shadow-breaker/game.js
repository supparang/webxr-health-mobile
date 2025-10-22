/* games/shadow-breaker/game.js
   Shadow Breaker · game.js (Unified + 10 Fun Boosters + Production Patches)
   - Includes: Mutators, Fever, Boss Affix, Micro-Quest, Daily Seed RNG, Combo Bank,
               Stances, Hazard, Achievements/Stars, Adaptive Fairness + Colorblind-safe + SFX mix cap
   - Production patches: A-Frame guard + error overlay, Mobile audio unlock (iOS),
                         HUD status badge, WebXR helper button, visibility pause guards
*/
(function(){
  // ---------- Helpers ----------
  const byId = (id)=>document.getElementById(id);
  let timeouts=new Set();
  const after=(ms,fn)=>{ const id=setTimeout(()=>{timeouts.delete(id); fn();},ms); timeouts.add(id); return id; };
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const APPX={ badge:(t)=>{ if(window.APP?.badge) APP.badge(t); else console.log('[BADGE]',t); }, t:(k)=>window.APP?.t?APP.t(k):k };
  const getQuery=(k)=>new URLSearchParams(location.search).get(k);
  // SFX anti-spam (mix cap)
  const lastPlay=new Map();
  const play=(a,guardMs=110)=>{ try{
    const now=performance.now(); if(lastPlay.get(a)&&now-lastPlay.get(a)<guardMs) return;
    a.currentTime=0; lastPlay.set(a,now); if(a.paused) a.play();
  }catch(e){} };
  // Toast
  function pingUI(msg,color='#ffcc00'){
    let el=byId('toast');
    if(!el){
      el=document.createElement('div'); el.id='toast'; document.body.appendChild(el);
      Object.assign(el.style,{
        position:'fixed', left:'50%', top:'12px', transform:'translateX(-50%)',
        background:'rgba(10,12,16,.9)', color:'#ffcc00', padding:'8px 12px',
        borderRadius:'10px', font:'600 14px/1.1 system-ui,Arial', zIndex:9999,
        letterSpacing:'0.4px', transition:'opacity .2s, transform .2s', opacity:'0'
      });
    }
    el.style.color=color; el.textContent=msg; el.style.opacity='1'; el.style.transform='translateX(-50%) scale(1.02)';
    setTimeout(()=>{ el.style.opacity='0'; el.style.transform='translateX(-50%) scale(1)'; }, 800);
  }

  // ---------- Difficulty ----------
  function getDiffKey(){
    const q = getQuery('diff');
    const ls = localStorage.getItem('sb_diff');
    return (window.APP?.story?.difficulty) || q || ls || 'normal';
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
  let survivedStreak = 0;       // Overheat
  let addedTimeThisPhase = 0;   // cap Perfect +1s
  let bank=0;                   // Combo Bank
  let fever=false, feverT=0;    // Fever mode
  let MQ=null;                  // Micro-quest
  let AFFIX_SPLIT_SLASH=false, AFFIX_PHANTOM=false; // Boss affix
  let ADAPT=1;                  // Adaptive fairness multiplier for timings
  // User options (Mutators/Stances)
  window.PERFECT_BONUS=0;       // extra score per perfect (mutator)
  window.PARRY_WINDOW=1;        // <1 = แคบลง
  window.TIME_SCALE=1;          // <1 = เร็วขึ้น
  const STANCES={ power:{dmg:1.2, parry:0.9, title:'POWER'}, swift:{dmg:0.9, parry:1.1, title:'SWIFT'} };
  let ST = STANCES.swift;       // setจาก UI ภายนอกได้: window.sbSetStance('power'|'swift')

  // ---------- Daily Seed RNG ----------
  function dailySeed(){
    const d=new Date(); const key=`${d.getUTCFullYear()}-${d.getUTCMonth()+1}-${d.getUTCDate()}`;
    let s=0; for(const c of key){ s=(s*131+ c.charCodeAt(0))>>>0; } return s>>>0;
  }
  let seed=dailySeed();
  function rnd(){ seed=(seed*1664525+1013904223)>>>0; return (seed&0x7fffffff)/0x80000000; }
  const RND=()=>rnd();

  // Duration helper (รวม difficulty + stance + mutator + adaptive)
  const dur=(ms)=> ms * D.atkWin * (ST.parry||1) * (window.PARRY_WINDOW||1) * (window.TIME_SCALE||1) * ADAPT;

  // ---------- Chain rule ----------
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
    e.setAttribute('text',{value:text,color,align:'center',width:2.6});
    e.setAttribute('position',`${p.x} ${p.y} ${p.z}`);
    e.setAttribute('scale','0.001 0.001 0.001');
    e.setAttribute('animation__in',{property:'scale',to:'1 1 1',dur:90,easing:'easeOutQuad'});
    e.setAttribute('animation__rise',{property:'position',to:`${p.x} ${p.y+0.6} ${p.z}`,dur:600,easing:'easeOutQuad'});
    e.setAttribute('animation__fade',{property:'opacity',to:0,dur:480,delay:160,easing:'linear'});
    byId('arena').appendChild(e); setTimeout(()=>e.remove(),820);
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
      bar.classList.add('hit'); setTimeout(()=>bar.classList.remove('hit'), 240);
    }
    if(BOSS.phase===1 && (BOSS.hp/BOSS.max)<=0.5) enterPhase2();
    if(BOSS.hp<=0 && was>0) onBossDefeated();
  }
  function bossDamage(amount,pos){
    if(!BOSS.active) return;
    const armorPhase = (BOSS.phase===2 && BOSS.armorShards>0) ? 0.3 : 1.0; // ลดดาเมจถ้าเกราะยังอยู่
    const armorBase  = BOSS.rage ? 0.1 : 0.2;
    const final = Math.max(1, Math.round(amount*(ST.dmg||1)*(1-armorBase)*armorPhase*D.dmgMul));
    play(SFX.hp_hit); bossSetHP(BOSS.hp - final);
  }

  function bossIntro(){
    const arena=byId('arena');
    const anchor=document.createElement('a-entity');
    anchor.setAttribute('id','bossAnchor');
    anchor.setAttribute('position','0 1.5 -3');

    // Oni placeholder (สีตามบอส) + colorblind-safe รูปทรงชัดเจน
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
    // เลือก affix สำหรับบอสตั้งแต่ตัวที่ 2 ขึ้นไป
    AFFIX_SPLIT_SLASH=false; AFFIX_PHANTOM=false;
    const roll = RND();
    if(roll < 0.5) { AFFIX_SPLIT_SLASH=true; APPX.badge('Affix: Split Slash'); }
    else { AFFIX_PHANTOM=true; APPX.badge('Affix: Phantoms'); }
  }

  function bossSpawn(index=0){
    const cfg = ROSTER[index] || ROSTER[0];
    BOSS.active=true;
    BOSS.max=Math.round(cfg.baseHP*D.hp);
    BOSS.hp=BOSS.max; BOSS.rage=false; BOSS.phase=1; BOSS.busy=false; BOSS.armorShards=0;
    BOSS.name=cfg.title; BOSS.color=cfg.color; BOSS.P1=cfg.P1.slice(); BOSS.P2=cfg.P2.slice();
    bossIntro(); pIndex=0; lastPattern='';
    if(index>=1) applyBossAffix(); // ตั้งแต่บอส 2
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
      after(900, ()=>{ bossShowUI(true); bossSpawn(CURRENT_BOSS); });
      return;
    }
    end();
  }

  function enterPhase2(){
    BOSS.phase=2;
    addedTimeThisPhase = 0;
    APPX.badge('Phase 2'); play(SFX.enrage); setPhaseLabel(2);
    // เกราะแตก 2 ชิ้น
    BOSS.armorShards = 2;
    spawnArmorShard(new THREE.Vector3(-0.5,1.55,-2.3));
    spawnArmorShard(new THREE.Vector3( 0.5,1.45,-2.3));
    // โอกาสสุ่ม Hazard
    if(RND()<0.35) after(dur(500), spawnHazard);
  }

  function spawnArmorShard(pos){
    const g=document.createElement('a-icosahedron');
    g.classList.add('clickable','boss-attack');
    g.setAttribute('position',`${pos.x} ${pos.y} ${pos.z}`);
    g.setAttribute('radius','0.16'); g.setAttribute('color','#ffd166');
    g.setAttribute('animation__pulse','property: scale; dir: alternate; to: 1.15 1.15 1.15; loop: true; dur: 380; easing: easeInOutSine');
    byId('arena').appendChild(g);
    g.addEventListener('click', ()=>{
      floatText('ARMOR -1','#ffd166', g.object3D.getWorldPosition(new THREE.Vector3()));
      g.remove();
      BOSS.armorShards = Math.max(0, BOSS.armorShards-1);
    });
    after(dur(3000), ()=>{ if(g.parentNode){ g.remove(); playerHit(); } });
  }

  // ---------- Mutators ----------
  const MUTATORS=[
    {id:'perfect_plus', name:'Perfect+2', apply:()=>{ window.PERFECT_BONUS=2; }},
    {id:'tight_parry',  name:'Tight Parry', apply:()=>{ window.PARRY_WINDOW=0.85; }},
    {id:'fast_time',    name:'Fast Time',   apply:()=>{ window.TIME_SCALE=0.9; }},
    {id:'extra_beam',   name:'+1 Beam',     apply:()=>{ window.EXTRA_BEAM=true; }},
  ];
  function rollMutators(n=1){
    const picks=[]; const pool=[...MUTATORS];
    while(picks.length<n && pool.length){ const i=Math.floor(RND()*pool.length); picks.push(pool.splice(i,1)[0]); }
    picks.forEach(m=>m.apply()); APPX.badge('MOD: '+picks.map(m=>m.name).join(', '));
  }

  // ---------- Fever ----------
  function tryFever(){ if(!fever && combo>=25){ fever=true; feverT=performance.now()+8000; APPX.badge('FEVER!'); pingUI('FEVER x1.5','#ffd166'); } }
  function tickFever(){ if(fever && performance.now()>feverT){ fever=false; APPX.badge('Fever End'); } }
  setInterval(tickFever,150);

  // ---------- Micro-Quest ----------
  function spawnMicroQuest(){
    MQ={need:5, done:0, until:performance.now()+8000};
    APPX.badge('OBJ: PERFECT x5!');
  }
  setInterval(()=>{
    if(!running) return;
    if(!MQ && RND()<0.03) spawnMicroQuest();
    if(MQ && performance.now()>MQ.until){ APPX.badge('OBJ Fail'); MQ=null; }
  }, 1000);

  function onPerfect(){
    if(MQ){ MQ.done++; if(MQ.done>=MQ.need){ timeLeft=Math.min(99,timeLeft+5); byId('time').textContent=timeLeft; APPX.badge('OBJ Clear +5s'); MQ=null; } }
  }

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
    ({
      // base
      'slash_cross':doSlashCross,
      'rapid_fist':doRapidFist,
      'guard_break':doGuardBreak,
      'shadow_dash':doShadowDash,
      'multi_slash':doMultiSlash,
      'enrage_combo':doEnrageCombo,
      // boss 2
      'ground_shock':doGroundShock,
      'enrage_combo_fast':doEnrageComboFast,
      // boss 3
      'blade_storm':doBladeStorm,
      'blade_storm_fast':()=>doBladeStorm(true),
      'laser_grid':doLaserGrid,
      'orb_spiral':doOrbSpiral,
      'rage_finale':doRageFinale,
      // final boss
      'mirror_slash':doMirrorSlash,
      'doom_rings':doDoomRings,
      'orb_spiral_fast':()=>doOrbSpiral(true),
      'void_finale':doVoidFinale
    }[pattern]||(()=>{ BOSS.busy=false; }))();
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
    g.addEventListener('click', ()=>{
      const p=g.object3D.getWorldPosition(new THREE.Vector3());
      floatText('CRIT +50','#ffcc00', p);
      bossDamage(50, p);
      scoreAdd(50);
      g.remove();
    });
    after(dur(900), ()=>{ if(g.parentNode) g.remove(); });
  }

  function playerHit(){
    // Adaptive: เร่งวินโดว์ให้ผ่อนลงเล็กน้อย (ตัวเลขมาก = ช้าลง)
    ADAPT = Math.min(1.3, ADAPT*1.06);
    setTimeout(()=>{ ADAPT = Math.max(1, ADAPT*0.98); }, 1200);

    survivedStreak = 0; // โดนตี รีเซ็ต Overheat
    if(fever){ fever=false; APPX.badge('Fever Lost'); }
    CHEEV.noHit=false;
    combo=0; onComboChange();
    score=Math.max(0,score-5); updateHUD();
    APPX.badge('HIT!');
    const scn=document.querySelector('a-scene'); if(scn){ scn.classList.add('shake-scene'); setTimeout(()=>scn.classList.remove('shake-scene'), 240); }
  }

  // --- Moves: บอส 1–2 ---
  function doSlashCross(){
    BOSS.busy=true; play(SFX.tel_slash);
    const makeSlash=(rot, y=1.4)=>{
      const g=document.createElement('a-entity');
      g.setAttribute('geometry','primitive: box; height: 0.04; width: 1.2; depth: 0.04');
      g.setAttribute('material','color: #5de1ff; opacity: 0.95; transparent: true'); // สีมาตรฐาน Slash
      g.setAttribute('rotation',`0 0 ${rot}`); g.setAttribute('position',`0 ${y} -2.2`); g.classList.add('clickable','boss-attack');
      // icon text on beam (colorblind-safe)
      const t=document.createElement('a-entity'); t.setAttribute('text',{value:'/',color:'#02131b',align:'center',width:1.6}); t.setAttribute('position','0 0 0.03'); g.appendChild(t);
      byId('arena').appendChild(g);
      g.addEventListener('click', ()=>{ floatText('PARRY','#00ffa3', g.object3D.getWorldPosition(new THREE.Vector3())); bossDamage(28,new THREE.Vector3(0,1.5,-3)); g.remove(); });
      return g;
    };
    const main=makeSlash(-35,1.4);
    const extras=[];
    if(AFFIX_SPLIT_SLASH){ extras.push(makeSlash(35,1.46)); }
    if(AFFIX_PHANTOM){ if(RND()<0.5) extras.push(makeSlash(-15,1.32)); }
    after(dur(BOSS.phase===1?900:700), ()=>{
      [main,...extras].forEach(g=>{ if(g.parentNode){ playerHit(); g.remove(); } }); finishAttack();
    });
  }

  function doRapidFist(){
    BOSS.busy=true; let count=0;
    const next=()=>{ play(SFX.tel_shock);
      spawnShockwave(()=>{ count++; if(count<(BOSS.phase===1?3:4)){ after(dur(BOSS.phase===1?450:380),next);} else { finishAttack(); } });
    }; next();
  }
  function spawnShockwave(done){
    const ring=document.createElement('a-ring'); ring.classList.add('clickable','boss-attack');
    ring.setAttribute('position','0 1.2 -2.6'); ring.setAttribute('radius-inner','0.05'); ring.setAttribute('radius-outer','0.07');
    ring.setAttribute('material','color:#ffd166;opacity:.95;shader:flat'); byId('arena').appendChild(ring);
    ring.addEventListener('click', ()=>{ const p=ring.object3D.getWorldPosition(new THREE.Vector3()); floatText('BREAK','#00ffa3', p); bossDamage(16,p); ring.remove(); done&&done(); });
    const start=performance.now(), T=dur(BOSS.phase===1?700:560);
    (function step(){ if(!ring.parentNode) return; const t=(performance.now()-start)/T; const r=0.07+t*0.9;
      ring.setAttribute('radius-inner',Math.max(0.01,r-0.02)); ring.setAttribute('radius-outer',r);
      if(t>=1.0){ playerHit(); ring.remove(); done&&done(); return; } requestAnimationFrame(step);
    })();
  }
  function doGuardBreak(){
    BOSS.busy=true; play(SFX.tel_guard);
    const core=document.createElement('a-sphere'); core.classList.add('clickable','boss-attack');
    core.setAttribute('radius','0.2'); core.setAttribute('color','#ff6b6b'); core.setAttribute('position','0 1.1 -2.2');
    core.setAttribute('scale','0.001 0.001 0.001'); core.setAttribute('animation__in',{property:'scale', to:'1 1 1', dur:140, easing:'easeOutBack'});
    byId('arena').appendChild(core);
    core.addEventListener('click', ()=>{
      const p=core.object3D.getWorldPosition(new THREE.Vector3());
      bossDamage(10,p); core.remove(); finishAttack();
    });
    after(dur(BOSS.phase===1?900:750), ()=>{ if(core.parentNode){ playerHit(); core.remove(); } finishAttack(); });
  }
  function doShadowDash(){
    BOSS.busy=true; play(SFX.tel_dash);
    const l=document.createElement('a-box'), r=document.createElement('a-box');
    [l,r].forEach((b,i)=>{ b.classList.add('clickable','boss-attack'); b.setAttribute('width','0.5'); b.setAttribute('height','0.3'); b.setAttribute('depth','0.05');
      b.setAttribute('color', i===0?'#00d0ff':'#00ffa3'); b.setAttribute('position', (i===0?'-0.9':'0.9')+' 1.0 -2.0'); byId('arena').appendChild(b); });
    let ok=false; const hit=(box)=>{ if(ok) return; ok=true; floatText('DODGE','#9bd1ff', box.object3D.getWorldPosition(new THREE.Vector3())); bossDamage(12,new THREE.Vector3(0,1.5,-3)); cleanup(); };
    l.addEventListener('click', ()=>hit(l)); r.addEventListener('click', ()=>hit(r));
    after(dur(700), ()=>{ if(!ok) playerHit(); cleanup(); });
    function cleanup(){ [l,r].forEach(b=>b.parentNode&&b.parentNode.removeChild(b)); finishAttack(); }
  }
  function doMultiSlash(){
    BOSS.busy=true; const seq=[-35,35]; let i=0;
    const next=()=>{ play(SFX.tel_slash);
      const g=document.createElement('a-entity'); g.setAttribute('geometry','primitive: box; height: 0.04; width: 1.2; depth: 0.04');
      g.setAttribute('material','color: #5de1ff; opacity: 0.95; transparent: true'); g.setAttribute('rotation','0 0 '+seq[i]); g.setAttribute('position','0 1.35 -2.2');
      g.classList.add('clickable','boss-attack'); byId('arena').appendChild(g);
      let ok=false; g.addEventListener('click', ()=>{ ok=true; floatText('PARRY','#00ffa3', g.object3D.getWorldPosition(new THREE.Vector3())); bossDamage(16,new THREE.Vector3(0,1.5,-3)); g.remove(); });
      after(dur(650), ()=>{ if(g.parentNode){ g.remove(); if(!ok) playerHit(); } i++; if(i<seq.length){ after(dur(120),next); } else { finishAttack(); } });
    }; next();
  }
  function doEnrageCombo(){
    BOSS.busy=true; play(SFX.enrage); APPX.badge('ENRAGE!');
    const seq=[()=>qs(()=>step()), ()=>qw(()=>step()), ()=>qg(()=>step()), ()=>gem(()=>finishAttack())];
    let j=0; function step(){ j++; if(j<seq.length) seq[j](); } seq[0]();

    function qs(done){
      const g=document.createElement('a-entity'); g.setAttribute('geometry','primitive: box; height: 0.04; width: 1.2; depth: 0.04');
      g.setAttribute('material','color:#5de1ff;opacity:.95;transparent:true'); g.setAttribute('rotation','0 0 -35'); g.setAttribute('position','0 1.4 -2.2'); g.classList.add('clickable');
      byId('arena').appendChild(g); let ok=false; play(SFX.tel_slash);
      g.addEventListener('click', ()=>{ ok=true; bossDamage(18,new THREE.Vector3(0,1.5,-3)); g.remove(); done(); });
      after(dur(520), ()=>{ if(g.parentNode){ g.remove(); if(!ok) playerHit(); } done(); });
    }
    function qw(done){
      play(SFX.tel_shock);
      const ring=document.createElement('a-ring'); ring.classList.add('clickable'); ring.setAttribute('position','0 1.2 -2.6');
      ring.setAttribute('radius-inner','0.05'); ring.setAttribute('radius-outer','0.07'); ring.setAttribute('material','color:#ffd166;opacity:.95;shader:flat');
      byId('arena').appendChild(ring);
      ring.addEventListener('click', ()=>{ bossDamage(14, ring.object3D.getWorldPosition(new THREE.Vector3())); ring.remove(); done(); });
      const start=performance.now(), T=dur(500); (function step(){ if(!ring.parentNode) return; const t=(performance.now()-start)/T, r=0.07+t*0.9;
        ring.setAttribute('radius-inner',Math.max(0.01,r-0.02)); ring.setAttribute('radius-outer',r); if(t>=1.0){ playerHit(); ring.remove(); done(); return; } requestAnimationFrame(step);
      })();
    }
    function qg(done){
      play(SFX.tel_guard);
      const core=document.createElement('a-sphere'); core.classList.add('clickable'); core.setAttribute('radius','0.18'); core.setAttribute('color','#ff6b6b'); core.setAttribute('position','0 1.15 -2.2');
      core.setAttribute('scale','0.001 0.001 0.001'); core.setAttribute('animation__in',{property:'scale',to:'1 1 1',dur:120,easing:'easeOutBack'});
      byId('arena').appendChild(core); let ok=false; core.addEventListener('click', ()=>{ ok=true; bossDamage(12, core.object3D.getWorldPosition(new THREE.Vector3())); core.remove(); done(); });
      after(dur(600), ()=>{ if(core.parentNode){ core.remove(); if(!ok) playerHit(); } done(); });
    }
    function gem(done){
      const g=document.createElement('a-icosahedron'); g.classList.add('clickable'); g.setAttribute('position','0 1.6 -2.4'); g.setAttribute('radius','0.18'); g.setAttribute('color','#00ffa3'); byId('arena').appendChild(g);
      g.addEventListener('click', ()=>{ floatText('CRITICAL!','#00ffa3', g.object3D.getWorldPosition(new THREE.Vector3())); play(SFX.success); bossDamage(40, g.object3D.getWorldPosition(new THREE.Vector3())); g.remove(); done(); });
      after(dur(700), ()=>{ if(g.parentNode){ g.remove(); } done(); });
    }
  }

  // --- Boss 2 specials ---
  function doGroundShock(){
    if (BOSS.phase===2) return doGroundShockP2();
    BOSS.busy=true; let c=0;
    const next=()=>{ play(SFX.tel_shock);
      spawnShockwave(()=>{ c++; if(c<5){ after(dur(300),next);} else { finishAttack(); } });
    }; next();
  }
  function doGroundShockP2(){
    BOSS.busy=true;
    const lanes = [-0.8, 0, 0.8];
    const safe = lanes[Math.floor(RND()*lanes.length)];
    let doneCount=0, need=2;

    lanes.forEach(x=>{
      const r=document.createElement('a-ring'); r.classList.add('clickable','boss-attack');
      r.setAttribute('position',`${x} 1.15 -2.6`);
      r.setAttribute('radius-inner','0.05'); r.setAttribute('radius-outer','0.07');
      r.setAttribute('material',`color:${x===safe?'#00ffa3':'#ffd166'};opacity:.9;shader:flat`);
      byId('arena').appendChild(r);
      r.addEventListener('click', ()=>{ if(x!==safe){ doneCount++; } floatText('BREAK', x===safe?'#00ffa3':'#ffd166', r.object3D.getWorldPosition(new THREE.Vector3())); r.remove(); });

      const start=performance.now(), T=dur(720);
      (function step(){
        if(!r.parentNode) return;
        const t=(performance.now()-start)/T, base=0.07+t*0.9;
        r.setAttribute('radius-inner',Math.max(0.01,base-0.02));
        r.setAttribute('radius-outer',base);
        if(t>=1){ if(r.parentNode) r.remove(); return; }
        requestAnimationFrame(step);
      })();
    });

    after(dur(760), ()=>{
      if(doneCount<need) playerHit();
      else bossDamage(22,new THREE.Vector3(0,1.5,-3));
      finishAttack();
    });
  }
  function doEnrageComboFast(){
    const saveP2=BOSS.P2; const tmp=['multi_slash','ground_shock']; BOSS.P2=tmp;
    doEnrageCombo(); after(dur(2000), ()=>{ BOSS.P2=saveP2; });
  }

  // --- Boss 3 specials ---
  function doBladeStorm(fast=false){
    BOSS.busy=true;
    const count = fast? 4 : 3;
    let i=0;
    const doOne=()=>{
      play(SFX.tel_slash);
      const rot = (-50 + RND()*100).toFixed(0);
      const g=document.createElement('a-entity');
      g.setAttribute('geometry','primitive: box; height: 0.04; width: 1.25; depth: 0.04');
      g.setAttribute('material','color:#7a5cff; opacity:0.9; transparent:true');
      g.setAttribute('rotation',`0 0 ${rot}`); g.setAttribute('position','0 1.38 -2.2'); g.classList.add('clickable','boss-attack');
      byId('arena').appendChild(g);
      if(AFFIX_PHANTOM && RND()<0.4){ const p=g.cloneNode(); p.object3D.position.y+=0.06; byId('arena').appendChild(p); }
      let ok=false; g.addEventListener('click', ()=>{ ok=true; floatText('PARRY','#a899ff', g.object3D.getWorldPosition(new THREE.Vector3())); bossDamage(fast?18:16,new THREE.Vector3(0,1.5,-3)); g.remove(); });
      after(dur(fast?520:650), ()=>{ if(g.parentNode){ g.remove(); if(!ok) playerHit(); } i++; if(i<count){ after(dur(100),doOne); } else { finishAttack(); } });
    };
    doOne();
  }
  function doLaserGrid(){
    BOSS.busy=true;
    const makeBeam=(x,y,rot)=>{
      const b=document.createElement('a-entity');
      b.setAttribute('geometry','primitive: box; height: 0.035; width: 1.4; depth: 0.03');
      b.setAttribute('material','color:#5de1ff; opacity:0.9; transparent:true');
      b.setAttribute('position',`${x} ${y} -2.2`); b.setAttribute('rotation',`0 0 ${rot}`);
      b.classList.add('clickable','boss-attack'); byId('arena').appendChild(b); return b;
    };
    play(SFX.tel_dash);
    const a=makeBeam(0,1.3,-15), b=makeBeam(0,1.5,15);
    let ca=false, cb=false;
    if(window.EXTRA_BEAM){ const c=makeBeam(0,1.4,0); c.addEventListener('click', ()=>{ floatText('CUT','#5de1ff', c.object3D.getWorldPosition(new THREE.Vector3())); c.remove(); }); after(dur(800),()=>{ c.parentNode&&c.remove(); }); }
    const ok=()=>{ if(ca && cb){ bossDamage(28,new THREE.Vector3(0,1.5,-3)); cleanup(); } };
    a.addEventListener('click', ()=>{ ca=true; floatText('CUT','#5de1ff', a.object3D.getWorldPosition(new THREE.Vector3())); a.remove(); ok(); });
    b.addEventListener('click', ()=>{ cb=true; floatText('CUT','#5de1ff', b.object3D.getWorldPosition(new THREE.Vector3())); b.remove(); ok(); });
    after(dur(800), ()=>{ cleanup(true); });
    function cleanup(timeout){
      if(a.parentNode){ a.remove(); if(timeout && !ca) playerHit(); }
      if(b.parentNode){ b.remove(); if(timeout && !cb) playerHit(); }
      finishAttack();
    }
  }
  function doOrbSpiral(fast=false){
    BOSS.busy=true;
    const center=new THREE.Vector3(0,1.4,-2.3);
    const orbs=[];
    for(let i=0;i<4;i++){
      const o=document.createElement('a-sphere'); o.classList.add('clickable','boss-attack');
      o.setAttribute('radius','0.1'); o.setAttribute('color', fast?'#c9b6ff':'#a899ff');
      o.dataset.theta = (i/4)*Math.PI*2;
      byId('arena').appendChild(o); orbs.push(o);
      o.addEventListener('click', ()=>{ floatText('BREAK', fast?'#c9b6ff':'#a899ff', o.object3D.getWorldPosition(new THREE.Vector3())); bossDamage(fast?12:10,center); o.remove(); });
    }
    const start=performance.now(), T=dur(fast?1800:(BOSS.phase===1?2600:2000));
    (function step(){
      const t=(performance.now()-start)/T;
      let alive=false;
      orbs.forEach((o,idx)=>{
        if(!o.parentNode) return;
        alive=true;
        const theta = (+o.dataset.theta) + t* (fast?4.6:(BOSS.phase===1?2.5:3.6));
        const r = 0.5 + 0.2*Math.sin(t*4+idx);
        const x = center.x + Math.cos(theta)*r;
        const y = center.y + Math.sin(theta)*r*0.6;
        o.setAttribute('position',`${x.toFixed(3)} ${y.toFixed(3)} ${center.z}`);
      });
      if(t>=1){ orbs.forEach(o=>{ if(o.parentNode){ o.remove(); playerHit(); } }); finishAttack(); return; }
      if(!alive){ finishAttack(); return; }
      requestAnimationFrame(step);
    })();
  }
  function doRageFinale(){
    BOSS.busy=true; play(SFX.enrage); APPX.badge('FINAL RAGE!');
    const seq=[()=>qs(()=>step()), ()=>qw(()=>step()), ()=>gem(()=>finishAttack(true))];
    let j=0; function step(){ j++; if(j<seq.length) seq[j](); } seq[0]();

    function qs(done){
      const g=document.createElement('a-entity'); g.setAttribute('geometry','primitive: box; height: 0.04; width: 1.25; depth: 0.04');
      g.setAttribute('material','color:#7a5cff;opacity:.95;transparent:true'); g.setAttribute('rotation','0 0 -30'); g.setAttribute('position','0 1.4 -2.2'); g.classList.add('clickable');
      byId('arena').appendChild(g); let ok=false; play(SFX.tel_slash);
      g.addEventListener('click', ()=>{ ok=true; bossDamage(22,new THREE.Vector3(0,1.5,-3)); g.remove(); done(); });
      after(dur(450), ()=>{ if(g.parentNode){ g.remove(); if(!ok) playerHit(); } done(); });
    }
    function qw(done){
      play(SFX.tel_shock);
      const ring=document.createElement('a-ring'); ring.classList.add('clickable'); ring.setAttribute('position','0 1.2 -2.6');
      ring.setAttribute('radius-inner','0.05'); ring.setAttribute('radius-outer','0.07'); ring.setAttribute('material','color:#ffd166;opacity:.95;shader:flat');
      byId('arena').appendChild(ring);
      ring.addEventListener('click', ()=>{ bossDamage(18, ring.object3D.getWorldPosition(new THREE.Vector3())); ring.remove(); done(); });
      const start=performance.now(), T=dur(420); (function step(){ if(!ring.parentNode) return; const t=(performance.now()-start)/T, r=0.07+t*0.9;
        ring.setAttribute('radius-inner',Math.max(0.01,r-0.02)); ring.setAttribute('radius-outer',r); if(t>=1.0){ playerHit(); ring.remove(); done(); return; } requestAnimationFrame(step);
      })();
    }
    function gem(done){
      const g=document.createElement('a-icosahedron'); g.classList.add('clickable'); g.setAttribute('position','0 1.6 -2.4'); g.setAttribute('radius','0.2'); g.setAttribute('color','#00ffa3'); byId('arena').appendChild(g);
      g.addEventListener('click', ()=>{ floatText('CRITICAL!','#00ffa3', g.object3D.getWorldPosition(new THREE.Vector3())); play(SFX.success); bossDamage(60, g.object3D.getWorldPosition(new THREE.Vector3())); g.remove(); done(); });
      after(dur(600), ()=>{ if(g.parentNode){ g.remove(); done(); } });
    }
  }

  // --- Final Boss specials ---
  function doMirrorSlash(){
    BOSS.busy=true;
    const mk=(rot, y)=>{ const g=document.createElement('a-entity');
      g.setAttribute('geometry','primitive: box; height: 0.04; width: 1.25; depth: 0.04');
      g.setAttribute('material','color:#8cf5ff;opacity:.95;transparent:true');
      g.setAttribute('rotation',`0 0 ${rot}`); g.setAttribute('position',`0 ${y} -2.2`);
      g.classList.add('clickable','boss-attack'); byId('arena').appendChild(g); return g; };
    play(SFX.tel_slash);
    const a=mk(-28,1.36), b=mk(28,1.44);
    let ca=false, cb=false;
    const ok=()=>{ if(ca && cb){ bossDamage(30,new THREE.Vector3(0,1.5,-3)); cleanup(); } };
    a.addEventListener('click', ()=>{ ca=true; floatText('PARRY','#8cf5ff', a.object3D.getWorldPosition(new THREE.Vector3())); a.remove(); ok(); });
    b.addEventListener('click', ()=>{ cb=true; floatText('PARRY','#8cf5ff', b.object3D.getWorldPosition(new THREE.Vector3())); b.remove(); ok(); });
    after(dur(560), ()=>{ cleanup(true); });
    function cleanup(timeout){
      if(a.parentNode){ a.remove(); if(timeout && !ca) playerHit(); }
      if(b.parentNode){ b.remove(); if(timeout && !cb) playerHit(); }
      finishAttack();
    }
  }
  function doDoomRings(){
    BOSS.busy=true;
    const rings=[];
    for(let i=0;i<3;i++){
      const r=document.createElement('a-ring'); r.classList.add('clickable','boss-attack');
      const x = (i-1)*0.6; r.setAttribute('position',`${x} 1.15 -2.6`); r.setAttribute('radius-inner','0.05'); r.setAttribute('radius-outer','0.07');
      r.setAttribute('material','color:#ffd166;opacity:.95;shader:flat'); byId('arena').appendChild(r); rings.push(r);
      r.addEventListener('click', ()=>{ floatText('BREAK','#ffd166', r.object3D.getWorldPosition(new THREE.Vector3())); bossDamage(12,new THREE.Vector3(0,1.5,-3)); r.remove(); });
    }
    const start=performance.now(), T=dur(680);
    (function step(){
      const t=(performance.now()-start)/T;
      rings.forEach((r,idx)=>{ if(!r.parentNode) return; const base=0.07+t*0.9, off=idx*0.02;
        const R=base+off; r.setAttribute('radius-inner',Math.max(0.01,R-0.02)); r.setAttribute('radius-outer',R); });
      if(t>=1){ const broken = rings.filter(r=>!r.parentNode).length; if(broken<2) playerHit(); rings.forEach(r=>r.parentNode&&r.remove()); finishAttack(); return; }
      requestAnimationFrame(step);
    })();
  }
  function doVoidFinale(){
    BOSS.busy=true; play(SFX.enrage); APPX.badge('VOID FINALE!');
    const seq=[()=>ms(()=>step()), ()=>lg(()=>step()), ()=>vg(()=>finishAttack())];
    let j=0; function step(){ j++; if(j<seq.length) seq[j](); } seq[0]();

    function ms(done){ play(SFX.tel_slash);
      const a=mk(-26,1.36), b=mk(26,1.44); let ca=false, cb=false;
      a.addEventListener('click', ()=>{ ca=true; a.remove(); ok(); });
      b.addEventListener('click', ()=>{ cb=true; b.remove(); ok(); });
      after(dur(420), ()=>{ if(!ca||!cb) playerHit(); done(); });
      function mk(rot,y){ const g=document.createElement('a-entity'); g.classList.add('clickable'); g.setAttribute('geometry','primitive: box; height:0.04;width:1.25;depth:0.04'); g.setAttribute('material','color:#8cf5ff;opacity:.95;transparent:true'); g.setAttribute('rotation',`0 0 ${rot}`); g.setAttribute('position',`0 ${y} -2.2`); byId('arena').appendChild(g); return g; }
      function ok(){ if(ca&&cb){ bossDamage(26,new THREE.Vector3(0,1.5,-3)); done(); } }
    }
    function lg(done){
      const a=beam(0,1.32,-14), b=beam(0,1.48,14); let ca=false, cb=false;
      a.addEventListener('click', ()=>{ ca=true; a.remove(); ok(); });
      b.addEventListener('click', ()=>{ cb=true; b.remove(); ok(); });
      after(dur(620), ()=>{ if(!ca||!cb) playerHit(); done(); });
      function beam(x,y,rot){ const e=document.createElement('a-entity'); e.classList.add('clickable'); e.setAttribute('geometry','primitive: box; height:.035;width:1.4;depth:.03'); e.setAttribute('material','color:#5de1ff;opacity:.95;transparent:true'); e.setAttribute('position',`${x} ${y} -2.2`); e.setAttribute('rotation',`0 0 ${rot}`); byId('arena').appendChild(e); return e; }
      function ok(){ if(ca&&cb){ bossDamage(28,new THREE.Vector3(0,1.5,-3)); done(); } }
    }
    function vg(done){
      const g=document.createElement('a-icosahedron'); g.classList.add('clickable'); g.setAttribute('position','0 1.6 -2.4'); g.setAttribute('radius','0.2'); g.setAttribute('color','#00ffa3'); byId('arena').appendChild(g);
      g.addEventListener('click', ()=>{ bossDamage(70, g.object3D.getWorldPosition(new THREE.Vector3())); g.remove(); done(); });
      after(dur(520), ()=>{ if(g.parentNode){ g.remove(); } done(); });
    }
  }

  // ---------- Hazard ----------
  function spawnHazard(){
    const z=document.createElement('a-cylinder');
    z.setAttribute('radius','0.5'); z.setAttribute('height','0.02');
    z.setAttribute('color','#ff3355'); z.setAttribute('position','0 0.9 -2.2');
    z.classList.add('clickable'); byId('arena').appendChild(z);
    z.addEventListener('click', ()=>{ floatText('SAFE ZONE','#00ffa3', z.object3D.getWorldPosition(new THREE.Vector3())); z.setAttribute('color','#00ffa3'); bossDamage(10, new THREE.Vector3(0,1.5,-3)); });
    after(dur(3000), ()=>z.parentNode&&z.remove());
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
    // icon label
    const label=document.createElement('a-entity'); label.setAttribute('text',{value:spec.icon||'•',color:'#02131b',align:'center',width:1.8}); label.setAttribute('position','0 0 0.03'); el.appendChild(label);
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
    const el=document.createElement(RND()<0.5?'a-box':'a-sphere');
    const x=(RND()*3.2-1.6).toFixed(2), y=(RND()*1.6+1.0).toFixed(2), z=(RND()*-2.0-1.8).toFixed(2);
    el.setAttribute('position',`${x} ${y} ${z}`); el.setAttribute('sb-target',{type:spec.id,req:spec.req,angle:(spec.angle||'')}); byId('arena').appendChild(el);
  }
  function pickType(){ const r=RND(); if(r<0.55) return TYPES[0]; if(r<0.72) return TYPES[2]; if(r<0.92) return TYPES[1]; return TYPES[3]; }

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

    // โบนัส Phase 2: PERFECT +1s (ยกเว้น laser) จำกัดต่อเฟส
    if (BOSS.phase===2 && kind==='perfect' && method!=='laser' && addedTimeThisPhase<12) {
      timeLeft = Math.min(99, timeLeft + 1);
      addedTimeThisPhase++;
      byId('time').textContent = timeLeft;
      floatText('+1s','#00ffa3', pos);
    }

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

  // ---------- Achievements ----------
  const CHEEV={ noHit:true, combo50:false, under90s:false };

  // ---------- Game flow ----------
  function clearArena(){ const a=byId('arena'); Array.from(a.children).forEach(c=>c.remove()); }
  function start(){
    if(running) return;
    const key = getDiffKey(); D = DIFFS[key] || DIFFS.normal;
    localStorage.setItem('sb_diff', key);
    ROSTER = makeRoster(key);
    CHAIN_RULE = { minTimeLeft: D.chainMin };
    const rDiff = byId('rDiff'); if(rDiff) rDiff.textContent = (DIFFS[key]?.title || 'NORMAL') + ' · ' + (ST.title||'');

    // reset mutators/flags
    window.PERFECT_BONUS=0; window.PARRY_WINDOW=1; window.TIME_SCALE=1; window.EXTRA_BEAM=false;
    rollMutators(1);

    reset(); running=true;
    spawnTimer=setInterval(spawnTarget, Math.max(380, D.spawnInt*(window.TIME_SCALE||1)));
    timer=setInterval(()=>{ timeLeft--; byId('time').textContent=timeLeft; if(timeLeft<=0) end(); },1000);
    CURRENT_BOSS=0; after(dur(900), ()=>bossSpawn(CURRENT_BOSS));
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
    timeouts.forEach(clearTimeout); timeouts.clear();
    bossShowUI(false);
    CHEEV.combo50 = CHEEV.combo50 || (maxCombo>=50);
    CHEEV.under90s = (timeLeft>=10);
    let star = (CHEEV.noHit?1:0)+(CHEEV.combo50?1:0)+(CHEEV.under90s?1:0);
    const finalScore = Math.round((score+bank)*(1+0.05*star)*D.scoreMul);
    byId('rScore').textContent=finalScore; byId('rMaxCombo').textContent=maxCombo; byId('rAcc').textContent=spawns? Math.round((hits/spawns)*100)+'%':'0%';
    const starEl=byId('rStars'); if(starEl) starEl.textContent='★'.repeat(star)+ '☆'.repeat(3-star);
    byId('results').style.display='flex'; APPX.badge(APPX.t('results')+': '+finalScore);
    try{ window.Leaderboard?.postResult?.('shadow-breaker',{score:finalScore,maxCombo,accuracy:spawns?Math.round((hits/spawns)*100):0,diff:getDiffKey(),stars:star,stance:ST.title}); }catch(e){}
  }

  // Pause / Resume (P key)
  function togglePause(){
    if(!running) return;
    paused=!paused;
    if(paused){ clearInterval(timer); clearInterval(spawnTimer); APPX.badge('Paused'); pingUI('PAUSED','#ffd166'); }
    else {
      timer=setInterval(()=>{ timeLeft--; byId('time').textContent=timeLeft; if(timeLeft<=0) end(); },1000);
      spawnTimer=setInterval(spawnTarget, Math.max(380, D.spawnInt*(window.TIME_SCALE||1))); APPX.badge('Resume'); pingUI('RESUME','#00ffa3');
    }
  }

  // Visibility pause
  document.addEventListener('visibilitychange', ()=>{
    if(!running) return;
    if(document.hidden){ clearInterval(timer); clearInterval(spawnTimer); }
    else if(!paused){
      timer=setInterval(()=>{ timeLeft--; byId('time').textContent=timeLeft; if(timeLeft<=0) end(); },1000);
      spawnTimer=setInterval(spawnTarget, Math.max(380, D.spawnInt*(window.TIME_SCALE||1)));
    }
  });

  // Debug HUD (`)
  let DBG=false; document.addEventListener('keydown',e=>{
    if(e.key==='`'){ DBG=!DBG; let box=byId('debug');
      if(!box){ box=document.createElement('div'); box.id='debug'; document.body.appendChild(box);
        Object.assign(box.style,{position:'fixed',bottom:'10px',left:'10px',background:'rgba(0,0,0,.6)',color:'#0ff',padding:'6px 10px',borderRadius:'8px',font:'12px/1.2 monospace',zIndex:9999}); }
      box.style.display=DBG?'block':'none';
      if(DBG){ box.textContent=`Boss:${BOSS.name} P${BOSS.phase} HP:${BOSS.hp}/${BOSS.max} Combo:${combo} Time:${timeLeft} Fever:${fever?'Y':'N'} Bank:${bank} ADAPT:${ADAPT.toFixed(2)}`; }
    }
    if(e.key==='p' || e.key==='P') togglePause();
    if(e.key==='b' || e.key==='B') bankNow();
  });

  // Mouse/Touch input (PC/Mobile มือขวาเคลื่อน)
  document.addEventListener('mousemove', e=>{
    const x=(e.clientX/window.innerWidth - .5)*3.2;
    const y=(1 - e.clientY/window.innerHeight)*2 + .6;
    const h=byId('rightHand'); if(h) h.setAttribute('position', `${x.toFixed(2)} ${y.toFixed(2)} -1`);
  }, {passive:true});
  ['mousedown','touchstart'].forEach(ev=>document.addEventListener(ev, ()=>{
    const rh=byId('rightHand')?.components['hand-speed']; if(rh){ rh.vel.set(3,0,-2); rh.data.speed=3.6; }
  }, {passive:true}));

  // Combo Bank hotkey & function
  function bankNow(){ const add=Math.floor(combo*3); bank+=add; APPX.badge('Bank +'+add); combo=0; onComboChange(); updateHUD(); }

  // Public stance setter (ต่อ UI ภายนอกได้)
  window.sbSetStance=(k)=>{ if(STANCES[k]) ST=STANCES[k]; };

  // ---------- Buttons ----------
  document.addEventListener('DOMContentLoaded', ()=>{
    byId('startBtn')?.addEventListener('click', start);
    byId('replayBtn')?.addEventListener('click', start);
    byId('backBtn')?.addEventListener('click', ()=>{ window.location.href='../../index.html'; });
    byId('pauseBtn')?.addEventListener('click', togglePause);
    byId('bankBtn')?.addEventListener('click', bankNow);
  });

  /* =======================
     PRODUCTION PATCHES
     1) Guard A-Frame + Error Overlay
     2) Mobile Audio Unlock (iOS)
     3) HUD Status (Fever/Mutator/Stance)
     4) WebXR Helper Button
     ======================= */

  // 1) Guard A-Frame + Error Overlay (กันหน้าขาว)
  (function bootGuards(){
    function showFatal(msg){
      let o=document.getElementById('fatal'); if(!o){ o=document.createElement('div'); o.id='fatal';
        Object.assign(o.style,{position:'fixed',inset:'0',background:'#0b1118',color:'#ffb4b4',
          display:'grid',placeItems:'center',font:'14px/1.5 system-ui',zIndex:99999}); document.body.appendChild(o);}
      o.innerHTML = '<div style="max-width:720px;padding:20px;text-align:center">'+
        '<h2>⚠️ Can’t start VR scene</h2><p>'+msg+'</p>'+
        '<p class="small">Check scripts/CORS/paths and reload.</p></div>';
    }
    let tries=0; (function waitAF(){
      if(window.AFRAME && document.querySelector('a-scene')) return;
      tries++;
      if(tries>120){ showFatal('A-Frame scene not found or failed to load (timeout).'); return; }
      requestAnimationFrame(waitAF);
    })();
    window.addEventListener('error', e=>{ if(!document.getElementById('fatal')) showFatal('JS error: '+(e.message||'unknown')); });
  })();

  // 2) Mobile Audio Unlock (iOS)
  (function unlockAudio(){
    let unlocked=false, ctx = (window.AudioContext||window.webkitAudioContext)? new (window.AudioContext||window.webkitAudioContext)() : null;
    function resume(){
      if(unlocked || !ctx) return;
      ctx.resume?.(); unlocked = ctx.state==='running';
    }
    ['touchstart','pointerdown','mousedown','keydown'].forEach(ev=>document.addEventListener(ev, resume, {once:true, passive:true}));
  })();

  // 3) HUD สถานะเสริม (Fever/Mutator/Stance)
  (function hudStatus(){
    const box=document.createElement('div');
    Object.assign(box.style,{position:'fixed',top:'8px',right:'8px',background:'rgba(0,0,0,.35)',color:'#e6f7ff',
      padding:'6px 8px',borderRadius:'10px',font:'600 12px system-ui',zIndex:9999});
    box.id='hudStatus'; document.body.appendChild(box);
    function render(){
      const mods=[]; if(window.PERFECT_BONUS) mods.push('Perf+'+window.PERFECT_BONUS);
      if(window.EXTRA_BEAM) mods.push('+Beam');
      box.textContent = `${fever?'FEVER ':''}${(ST.title||'')}${mods.length?' · '+mods.join(', '):''}`;
    }
    setInterval(render, 400);
  })();

  // 4) WebXR Fallback ปุ่มเข้า/ออก
  (function xrButton(){
    const scene=()=>document.querySelector('a-scene');
    const btn=document.createElement('button');
    btn.textContent='Enter VR';
    Object.assign(btn.style,{position:'fixed',bottom:'12px',right:'12px',zIndex:9999, padding:'8px 12px', borderRadius:'10px', border:'0', background:'#0e2233', color:'#e6f7ff', cursor:'pointer'});
    document.body.appendChild(btn);
    btn.addEventListener('click', ()=>{ try{ scene()?.enterVR?.(); }catch(e){ console.warn(e); } });
  })();

})();
