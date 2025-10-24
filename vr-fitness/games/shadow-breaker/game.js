/* games/shadow-breaker/game.js
   Shadow Breaker · game.js (1–15 patches + Rush Phase + Fever Pads + Coach Tips + Accessibility)
*/
(function(){
  "use strict";

  // ---------- Helpers ----------
  const byId = (id)=>document.getElementById(id);
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const getQ = (k)=> new URLSearchParams(location.search).get(k);
  const ASSET_BASE=(document.querySelector('meta[name="asset-base"]')?.content||'').replace(/\/+$/,'');
  const HUB_URL="https://supparang.github.io/webxr-health-mobile/vr-fitness/";

  // safeRemove (กัน removeChild null)
  function safeRemove(el){ try{ if(!el) return; if(el.parentNode) el.parentNode.removeChild(el); else el.remove?.(); }catch(_){} }

  // anti-spam SFX
  const lastPlay=new Map();
  function play(a,guard=110){ try{
    const now=performance.now(); if(lastPlay.get(a)&&now-lastPlay.get(a)<guard) return;
    a.currentTime=0; lastPlay.set(a,now); a.play?.();
  }catch(_){} }

  // small toast
  function ping(msg,color='#ffd166'){ let t=byId('toast'); if(!t){ t=document.createElement('div'); t.id='toast';
    Object.assign(t.style,{position:'fixed',left:'50%',top:'12px',transform:'translateX(-50%)',background:'rgba(10,12,16,.9)',
      color:'#e6f7ff',padding:'8px 12px',borderRadius:'10px',font:'600 13px system-ui',zIndex:9999,opacity:0,transition:'all .2s'}); document.body.appendChild(t); }
    t.style.color=color; t.textContent=msg; t.style.opacity=1; setTimeout(()=>t.style.opacity=0,800);
  }

  // ---------- Difficulty ----------
  const DIFFS = {
    easy:   { hp:0.85, atkWin:1.1,  dmgMul:0.95, chainMin:10, spawnInt:980,  scoreMul:0.9,  title:'EASY'   },
    normal: { hp:1.00, atkWin:1.0,  dmgMul:1.0,  chainMin:15, spawnInt:900,  scoreMul:1.0,  title:'NORMAL' },
    hard:   { hp:1.22, atkWin:0.92, dmgMul:1.08, chainMin:20, spawnInt:820,  scoreMul:1.1,  title:'HARD'   },
    final:  { hp:1.35, atkWin:0.86, dmgMul:1.18, chainMin:25, spawnInt:780,  scoreMul:1.2,  title:'FINAL'  }
  };
  function getDiffKey(){ return getQ('diff') || localStorage.getItem('sb_diff') || (window.APP?.story?.difficulty) || 'normal'; }
  let D = DIFFS.normal;

  // ---------- State ----------
  let running=false, paused=false;
  let timer=null, spawnTimer=null, loopRAF=null;
  let timeLeft=60, score=0, bank=0, combo=0, maxCombo=0, hits=0, spawns=0;
  let fever=false, feverUntil=0, feverPads=false;
  let CURRENT_BOSS=0, survivedStreak=0, addedTimeP2=0;
  let rushPhase=false, rushUntil=0;
  let accessibility=false; // high-contrast + HUD+15%

  // RNG (daily)
  function dailySeed(){ const d=new Date(); const k=`${d.getUTCFullYear()}-${d.getUTCMonth()+1}-${d.getUTCDate()}`; let s=0; for(const c of k){ s=(s*131+c.charCodeAt(0))>>>0; } return s>>>0; }
  let seed=dailySeed(); function RND(){ seed=(seed*1664525+1013904223)>>>0; return (seed&0x7fffffff)/0x80000000; }

  // Time scale wrappers
  let ADAPT=1; let ST={ title:'SWIFT', dmg:0.9, parry:1.1 };
  const dur=(ms)=> ms * D.atkWin * (ST.parry||1) * ADAPT * (rushPhase?0.75:1);

  // ---------- HUD ----------
  function updateHUD(){
    byId('score') && (byId('score').textContent=Math.round((score+bank)*D.scoreMul));
    byId('combo') && (byId('combo').textContent=combo);
    byId('time')  && (byId('time').textContent=timeLeft);
  }
  function onComboChange(){
    if(combo>maxCombo) maxCombo=combo;
    byId('combo')&&(byId('combo').textContent=combo);
    if(combo>0 && combo%10===0) play(SFX.combo);
    // Fever Pads เมื่อคอมโบ ≥ 25 (เฉพาะ Punch Pad)
    if(combo>=25 && !feverPads){ feverPads=true; ping('FEVER PADS x1.5','#00ffa3'); setTimeout(()=>feverPads=false, 12000); }
  }
  function setPhaseLabel(n){ const el=byId('phaseLabel'); if(el) el.textContent='Phase '+n; }

  // ---------- Audio ----------
  const SFXN=(p)=>{ const a=new Audio(p); a.preload='auto'; a.crossOrigin='anonymous'; return a; };
  const SFX={
    slash:SFXN(`${ASSET_BASE}/assets/sfx/slash.wav`),
    perfect:SFXN(`${ASSET_BASE}/assets/sfx/perfect.wav`),
    miss:SFXN(`${ASSET_BASE}/assets/sfx/miss.wav`),
    heavy:SFXN(`${ASSET_BASE}/assets/sfx/heavy.wav`),
    combo:SFXN(`${ASSET_BASE}/assets/sfx/combo.wav`),
    hp_hit:SFXN(`${ASSET_BASE}/assets/sfx/hp_hit.wav`),
    boss_roar:SFXN(`${ASSET_BASE}/assets/sfx/boss_roar.wav`),
    tel_slash:SFXN(`${ASSET_BASE}/assets/sfx/tel_slash.wav`),
    tel_shock:SFXN(`${ASSET_BASE}/assets/sfx/tel_shock.wav`),
    tel_guard:SFXN(`${ASSET_BASE}/assets/sfx/tel_guard.wav`),
    enrage:SFXN(`${ASSET_BASE}/assets/sfx/enrage.wav`),
    success:SFXN(`${ASSET_BASE}/assets/sfx/success.wav`),
    ui:SFXN(`${ASSET_BASE}/assets/sfx/success.wav`)
  };

  // ---------- Boss Roster ----------
  const BOSSES_ALL = [
    { id:'RazorFist',  title:'RAZORFIST',   baseHP:1000, color:'#ff3355',
      P1:['slash_cross','rapid_fist','guard_break'],
      P2:['shadow_dash','multi_slash','enrage_combo'] },
    { id:'AshOni',     title:'ASH ONI',     baseHP:1200, color:'#ffa133',
      P1:['shadow_dash','guard_break','rapid_fist'],
      P2:['multi_slash','ground_shock','enrage_combo_fast'] },
    { id:'Nightblade', title:'NIGHTBLADE',  baseHP:1400, color:'#7a5cff',
      P1:['blade_storm','laser_grid','guard_break'],
      P2:['orb_spiral','blade_storm_fast','rage_finale'] },
    { id:'VoidEmperor',title:'VOID EMPEROR',baseHP:1800, color:'#8cf5ff',
      P1:['mirror_slash','doom_rings','laser_grid'],
      P2:['blade_storm_fast','orb_spiral_fast','void_finale'] }
  ];
  function makeRoster(key){
    if(key==='easy') return [BOSSES_ALL[0]];
    if(key==='normal') return [BOSSES_ALL[0],BOSSES_ALL[1]];
    if(key==='hard')   return [BOSSES_ALL[0],BOSSES_ALL[1],BOSSES_ALL[2]];
    return BOSSES_ALL.slice(0,4);
  }
  let ROSTER=makeRoster('normal');

  // ---------- Boss Runtime ----------
  const BOSS={active:false,hp:0,max:1000,rage:false,phase:1,busy:false,anchor:null,name:'',color:'#ff3355', P1:[], P2:[], armorShards:0};

  function bossShowUI(show){ const bar=byId('bossBar'); if(bar) bar.style.display=show?'block':'none'; }
  function bossSetHP(h){
    const was=BOSS.hp; BOSS.hp = clamp(h,0,BOSS.max);
    const fill=byId('bossHPFill'); if(fill) fill.style.width=((BOSS.hp/BOSS.max)*100)+'%';
    const bar=byId('bossBar'); if(bar){
      const rageNow=(BOSS.hp/BOSS.max)<=0.33; if(rageNow!==BOSS.rage){ BOSS.rage=rageNow; bar.classList.toggle('rage',BOSS.rage); }
    }
    if(BOSS.phase===1 && (BOSS.hp/BOSS.max)<=0.5) enterPhase2();
    if(BOSS.hp<=0 && was>0) onBossDefeated();
  }
  function bossDamage(amount){
    const armorPhase=(BOSS.phase===2 && BOSS.armorShards>0)?0.3:1.0;
    const armorBase=BOSS.rage?0.1:0.2;
    const final=Math.max(1, Math.round(amount*(ST.dmg||1)*(1-armorBase)*armorPhase*D.dmgMul));
    play(SFX.hp_hit); bossSetHP(BOSS.hp-final);
  }
  function bossIntro(){
    const arena=byId('arena');
    const anchor=document.createElement('a-entity'); anchor.id='bossAnchor'; anchor.setAttribute('position','0 1.5 -3');
    // Minimal Oni head
    const head=document.createElement('a-sphere'); head.setAttribute('radius','0.35'); head.setAttribute('color','#141414');
    const mask=document.createElement('a-box'); mask.setAttribute('depth','0.06'); mask.setAttribute('width','0.55'); mask.setAttribute('height','0.45'); mask.setAttribute('color',BOSS.color||'#ff3355'); mask.setAttribute('position','0 0 0.25');
    [head,mask].forEach(n=>anchor.appendChild(n)); arena.appendChild(anchor); BOSS.anchor=anchor;
    bossShowUI(true); bossSetHP(BOSS.max); play(SFX.boss_roar); setPhaseLabel(1);
  }

  // --------- Punch Pads (เพื่อความสนุก/ท้าทายข้อ 5/6/7/11/13/14/15) ----------
  const PAD_COLORS=['#00d0ff','#ffd166','#ff6b6b','#00ffa3','#a899ff'];
  function spawnPad(){
    if(!running) return;
    spawns++;
    const x=(RND()*2.2-1.1).toFixed(2), y=(RND()*1.0+1.0).toFixed(2), z='-2.2';
    const isGold = (RND()<0.1);
    const pad=document.createElement('a-sphere');
    pad.classList.add('clickable','sb-pad');
    pad.setAttribute('radius', isGold? 0.23:0.2);
    const color = feverPads? rainbow() : (isGold?'#ffd166': PAD_COLORS[Math.floor(RND()*PAD_COLORS.length)]);
    pad.setAttribute('color', color);
    pad.setAttribute('position',`${x} ${y} ${z}`);
    if(feverPads) pad.setAttribute('material','emissive:#fff; emissiveIntensity:0.3;');
    byId('arena').appendChild(pad);

    // เตือนก่อนหมดอายุ (ข้อ 6)
    const life = clamp(1400 - Math.min(600, combo*8), 700, 1600);
    pad.setAttribute('animation__blink',`property: material.opacity; dir: alternate; to: .4; loop: true; dur: 160; delay: ${life-520}`);

    // กัน “คลิกรัว” + กันตามด้วย MISS (ข้อ 1/2/8)
    let missT = setTimeout(()=>{ if(pad.dataset.hit==='1') return; softMiss(pad); }, life);
    const hit=()=>{
      if(pad.dataset.hit==='1') return; pad.dataset.hit='1'; clearTimeout(missT);
      let p=pad.object3D.getWorldPosition(new THREE.Vector3());
      const isPerfect = true; // pad ไม่อิงหน้าต่างมุม ให้ perfect ทั้งหมดเพื่อจังหวะสนุก
      hits++; combo++; onComboChange();
      let gain = isGold ? (isPerfect? 26:18) : (isPerfect? 18:10);
      if(feverPads) gain=Math.round(gain*1.5); // Extra: Fever Pads (เฉพาะ Pad)
      score+=gain; if(isGold){ timeLeft=Math.min(99,timeLeft+2); }
      play(isPerfect?SFX.perfect:SFX.slash);
      floatText(isGold?'GOLD!':'HIT', isGold?'#ffd166':'#00d0ff', p);
      safeRemove(pad);
      updateHUD();
    };
    pad.addEventListener('click', hit);
    pad.addEventListener('mousedown', hit);
  }
  function rainbow(){ const t=performance.now()/280; const r=Math.sin(t)*127+128, g=Math.sin(t+2)*127+128, b=Math.sin(t+4)*127+128; return `rgb(${r|0},${g|0},${b|0})`; }

  // ----- Miss / Combo shield (ข้อ 14) -----
  let comboShield=0;
  function softMiss(el){
    // ถ้ามีชิลด์ ให้กัน MISS 1 ครั้ง
    if(comboShield>0){ comboShield=0; floatText('COMBO SHIELD','#9bd1ff', el.object3D.getWorldPosition(new THREE.Vector3())); safeRemove(el); return; }
    hardMiss(el);
  }
  function hardMiss(el){
    try{ safeRemove(el); }catch(_){}
    combo=0; onComboChange(); score=Math.max(0,score-5); play(SFX.miss);
    // Coach: เก็บสถิติ (ข้อ Coach Tips)
    coachTrack('miss:any');
    updateHUD();
  }

  // ---------- Boss Loop / Patterns ----------
  let pIndex=0,lastPattern='';
  function pickPattern(arr){ let p=arr[pIndex%arr.length]; pIndex++; if(p===lastPattern){ p=arr[pIndex%arr.length]; pIndex++; } lastPattern=p; return p; }

  function bossSpawn(i=0){
    const cfg=ROSTER[i]||ROSTER[0];
    BOSS.active=true; BOSS.phase=1; BOSS.rage=false; BOSS.busy=false; BOSS.armorShards=0;
    BOSS.max=Math.round(cfg.baseHP*D.hp); BOSS.hp=BOSS.max; BOSS.name=cfg.title; BOSS.color=cfg.color; BOSS.P1=cfg.P1.slice(); BOSS.P2=cfg.P2.slice();
    bossIntro(); pIndex=0; lastPattern='';
    setTimeout(bossLoop, 900);
  }
  function bossLoop(){
    if(!running || !BOSS.active || BOSS.busy) return;
    // Rush Phase: 10s ท้ายของ Phase 2 (ข้อ Extra 1)
    if(BOSS.phase===2 && !rushPhase && timeLeft<=10){ rushPhase=true; rushUntil=performance.now()+10000; ping('RUSH PHASE!','#ff7a33'); }
    if(rushPhase && performance.now()>rushUntil){ rushPhase=false; ping('Rush Cooldown','#9bd1ff'); }

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
      'enrage_combo_fast':doEnrageComboFast,
      'blade_storm':doBladeStorm,
      'blade_storm_fast':()=>doBladeStorm(true),
      'laser_grid':doLaserGrid,
      'orb_spiral':doOrbSpiral,
      'rage_finale':doRageFinale,
      'mirror_slash':doMirrorSlash,
      'doom_rings':doDoomRings,
      'orb_spiral_fast':()=>doOrbSpiral(true),
      'void_finale':doVoidFinale
    }[pattern]||(()=>{ BOSS.busy=false; }))();
  }

  function finishAttack(){
    if(BOSS.phase===2){ survivedStreak++; if(survivedStreak>=3){ survivedStreak=0; spawnPad(); } }
    // คูลดาวน์ต่างกันตามเฟส (ข้อ 3)
    const cd=(BOSS.phase===1? 560: 420);
    BOSS.busy=false; setTimeout(bossLoop, dur(cd));
  }

  // ---- ตัวอย่างบางแพตเทิร์น (ย่อให้อ่านง่าย แต่ครบเงื่อนไขหลัก) ----
  function doSlashCross(){
    BOSS.busy=true; play(SFX.tel_slash);
    const mk=(rot,y)=>{ const g=document.createElement('a-entity'); g.classList.add('clickable','boss-attack');
      g.setAttribute('geometry','primitive: box; height:.04;width:1.2;depth:.04');
      g.setAttribute('material','color:#5de1ff;opacity:.95;transparent:true');
      g.setAttribute('rotation',`0 0 ${rot}`); g.setAttribute('position',`0 ${y} -2.2`);
      byId('arena').appendChild(g); return g; };
    const a=mk(-35,1.4), b=(RND()<0.5? mk(35,1.46):null);
    let ok=0, need=b?2:1;
    function hit(g){ if(g.dataset.hit==='1') return; g.dataset.hit='1'; ok++; floatText('PARRY','#00ffa3', g.object3D.getWorldPosition(new THREE.Vector3())); bossDamage(18); safeRemove(g); }
    a.addEventListener('click',()=>hit(a)); b&&b.addEventListener('click',()=>hit(b));
    setTimeout(()=>{ if(a.parentNode&&!a.dataset.hit) hardMiss(a); if(b&&b.parentNode&&!b.dataset.hit) hardMiss(b);
      if(ok>=need){} finishAttack();
    }, dur(720));
  }
  function doRapidFist(){ BOSS.busy=true; let n=0, total=(BOSS.phase===1?3:4);
    (function next(){ play(SFX.tel_shock); spawnRing((ok)=>{ n++; if(n<total) setTimeout(next, dur(380)); else finishAttack(); }, (BOSS.phase===1?700:560)); })();
  }
  function spawnRing(done,T=600){
    const r=document.createElement('a-ring'); r.classList.add('clickable','boss-attack');
    r.setAttribute('position','0 1.18 -2.6'); r.setAttribute('radius-inner','0.05'); r.setAttribute('radius-outer','0.07');
    r.setAttribute('material','color:#ffd166;opacity:.95;shader:flat'); byId('arena').appendChild(r);
    let missT=setTimeout(()=>{ if(r.dataset.hit==='1') return; coachTrack('miss:ring'); hardMiss(r); done&&done(false); }, dur(T));
    r.addEventListener('click', ()=>{ if(r.dataset.hit==='1') return; r.dataset.hit='1'; clearTimeout(missT); floatText('BREAK','#ffd166',r.object3D.getWorldPosition(new THREE.Vector3())); bossDamage(16); safeRemove(r); done&&done(true); });
  }
  function doGuardBreak(){
    BOSS.busy=true; play(SFX.tel_guard);
    const core=document.createElement('a-sphere'); core.classList.add('clickable','boss-attack');
    core.setAttribute('radius','0.2'); core.setAttribute('color','#ff6b6b'); core.setAttribute('position','0 1.1 -2.2');
    byId('arena').appendChild(core);
    let missT=setTimeout(()=>{ if(core.dataset.hit==='1') return; hardMiss(core); finishAttack(); }, dur(750));
    core.addEventListener('click', ()=>{ if(core.dataset.hit==='1') return; core.dataset.hit='1'; clearTimeout(missT); bossDamage(12); safeRemove(core); finishAttack(); });
  }
  function doLaserGrid(){
    BOSS.busy=true; play(SFX.tel_slash);
    const beam=(rot,y)=>{ const b=document.createElement('a-entity'); b.classList.add('clickable','boss-attack');
      b.setAttribute('geometry','primitive: box; height:.035;width:1.4;depth:.03');
      b.setAttribute('material','color:#5de1ff;opacity:.95;transparent:true');
      b.setAttribute('rotation',`0 0 ${rot}`); b.setAttribute('position',`0 ${y} -2.2`); byId('arena').appendChild(b); return b; };
    const a=beam(-15,1.32), b=beam(15,1.48);
    let ok=0; const need=2;
    [a,b].forEach(e=>e.addEventListener('click',()=>{ if(e.dataset.hit==='1') return; e.dataset.hit='1'; ok++; floatText('CUT','#5de1ff',e.object3D.getWorldPosition(new THREE.Vector3())); safeRemove(e); }));
    setTimeout(()=>{ // Partial credit (ข้อ 4)
      if(ok===need) bossDamage(28);
      else if(ok===1) bossDamage(12);
      else hardMiss(a);
      [a,b].forEach(e=>safeRemove(e)); finishAttack();
    }, dur(800));
  }

  function doMultiSlash(){ BOSS.busy=true; let i=0, seq=[-35,35];
    (function next(){
      const g=document.createElement('a-entity'); g.classList.add('clickable','boss-attack');
      g.setAttribute('geometry','primitive: box; height:.04;width:1.2;depth:.04');
      g.setAttribute('material','color:#5de1ff;opacity:.95;transparent:true');
      g.setAttribute('rotation',`0 0 ${seq[i]}`); g.setAttribute('position','0 1.35 -2.2'); byId('arena').appendChild(g);
      let missT=setTimeout(()=>{ if(g.dataset.hit==='1') return; hardMiss(g); i++; if(i<seq.length) setTimeout(next, dur(120)); else finishAttack(); }, dur(650));
      g.addEventListener('click',()=>{ if(g.dataset.hit==='1') return; g.dataset.hit='1'; clearTimeout(missT); bossDamage(16); safeRemove(g); i++; if(i<seq.length) setTimeout(next, dur(120)); else finishAttack(); });
    })();
  }

  function doGroundShock(){ // P1
    if(BOSS.phase===2) return doGroundShockP2();
    BOSS.busy=true; let c=0; (function next(){ spawnRing(()=>{ c++; if(c<5) setTimeout(next, dur(300)); else finishAttack(); }, 700); })();
  }
  function doGroundShockP2(){ // P2 lanes
    BOSS.busy=true;
    const lanes=[-0.8,0,0.8]; const safe=lanes[Math.floor(RND()*lanes.length)];
    let ok=0, need=2;
    lanes.forEach(x=>{
      const r=document.createElement('a-ring'); r.classList.add('clickable','boss-attack');
      r.setAttribute('position',`${x} 1.15 -2.6`); r.setAttribute('radius-inner','0.05'); r.setAttribute('radius-outer','0.07');
      r.setAttribute('material',`color:${x===safe?'#00ffa3':'#ffd166'};opacity:.95;shader:flat`);
      byId('arena').appendChild(r);
      r.addEventListener('click',()=>{ if(r.dataset.hit==='1') return; r.dataset.hit='1'; if(x!==safe) ok++; floatText('BREAK',x===safe?'#00ffa3':'#ffd166', r.object3D.getWorldPosition(new THREE.Vector3())); safeRemove(r); });
      setTimeout(()=>safeRemove(r), dur(720));
    });
    setTimeout(()=>{ if(ok>=need) bossDamage(22); else hardMiss(byId('arena')); finishAttack(); }, dur(760));
  }

  function doBladeStorm(fast=false){
    BOSS.busy=true; let i=0, count=fast?4:3;
    (function one(){
      const g=document.createElement('a-entity'); g.classList.add('clickable','boss-attack');
      g.setAttribute('geometry','primitive: box; height:.04;width:1.25;depth:.04');
      g.setAttribute('material','color:#7a5cff;opacity:.9;transparent:true');
      g.setAttribute('rotation',`0 0 ${(-50+RND()*100)|0}`); g.setAttribute('position','0 1.38 -2.2');
      byId('arena').appendChild(g);
      let missT=setTimeout(()=>{ if(g.dataset.hit==='1') return; hardMiss(g); i++; if(i<count) setTimeout(one, dur(110)); else finishAttack(); }, dur(fast?520:650));
      g.addEventListener('click',()=>{ if(g.dataset.hit==='1') return; g.dataset.hit='1'; clearTimeout(missT); bossDamage(fast?18:16); safeRemove(g); i++; if(i<count) setTimeout(one, dur(110)); else finishAttack(); });
    })();
  }
  function doOrbSpiral(fast=false){ // ย่อ: ให้เป็น 4 ลูก หมดเวลา = MISS
    BOSS.busy=true; const center=new THREE.Vector3(0,1.4,-2.3); const orbs=[];
    for(let i=0;i<4;i++){ const o=document.createElement('a-sphere'); o.classList.add('clickable','boss-attack'); o.setAttribute('radius','0.1'); o.setAttribute('color', fast?'#c9b6ff':'#a899ff'); byId('arena').appendChild(o);
      orbs.push(o); o.addEventListener('click',()=>{ if(o.dataset.hit==='1') return; o.dataset.hit='1'; floatText('BREAK','#a899ff',o.object3D.getWorldPosition(new THREE.Vector3())); bossDamage(fast?12:10); safeRemove(o); }); }
    const start=performance.now(), T=dur(fast?1600:2000);
    (function step(){
      let alive=false; const t=(performance.now()-start)/T, w=fast?4.6:3.0; const r=0.55+0.2*Math.sin(t*4);
      orbs.forEach((o,j)=>{ if(!o.parentNode) return; alive=true; const th=(j/4)*Math.PI*2 + t*w; const x=Math.cos(th)*r, y=1.4+Math.sin(th)*r*0.6; o.setAttribute('position',`${x.toFixed(3)} ${y.toFixed(3)} -2.3`); });
      if(t>=1){ if(alive) hardMiss(byId('arena')); finishAttack(); return; }
      requestAnimationFrame(step);
    })();
  }

  function doEnrageCombo(){ BOSS.busy=true; play(SFX.enrage);
    const seq=[()=>slash(()=>step()),()=>ring(()=>step()),()=>guard(()=>step()),()=>gem(()=>finishAttack())]; let j=0; function step(){ j++; if(j<seq.length) seq[j](); } seq[0]();
    function slash(d){ const g=document.createElement('a-entity'); g.classList.add('clickable','boss-attack'); g.setAttribute('geometry','primitive: box; height:.04;width:1.2;depth:.04'); g.setAttribute('material','color:#5de1ff;opacity:.95;transparent:true'); g.setAttribute('rotation','0 0 -30'); g.setAttribute('position','0 1.4 -2.2'); byId('arena').appendChild(g);
      let missT=setTimeout(()=>{ if(g.dataset.hit==='1') return; hardMiss(g); d(); }, dur(520));
      g.addEventListener('click',()=>{ if(g.dataset.hit==='1') return; g.dataset.hit='1'; clearTimeout(missT); bossDamage(18); safeRemove(g); d(); });
    }
    function ring(d){ spawnRing(()=>d(), 500); }
    function guard(d){ const c=document.createElement('a-sphere'); c.classList.add('clickable','boss-attack'); c.setAttribute('radius','0.18'); c.setAttribute('color','#ff6b6b'); c.setAttribute('position','0 1.15 -2.2'); byId('arena').appendChild(c);
      let missT=setTimeout(()=>{ if(c.dataset.hit==='1') return; hardMiss(c); d(); }, dur(600));
      c.addEventListener('click',()=>{ if(c.dataset.hit==='1') return; c.dataset.hit='1'; clearTimeout(missT); bossDamage(12); safeRemove(c); d(); });
    }
    function gem(d){ const g=document.createElement('a-icosahedron'); g.classList.add('clickable','boss-attack'); g.setAttribute('position','0 1.6 -2.4'); g.setAttribute('radius','0.18'); g.setAttribute('color','#00ffa3'); byId('arena').appendChild(g);
      setTimeout(()=>{ safeRemove(g); d(); }, dur(700));
      g.addEventListener('click',()=>{ if(g.dataset.hit==='1') return; g.dataset.hit='1'; floatText('CRITICAL!','#00ffa3',g.object3D.getWorldPosition(new THREE.Vector3())); play(SFX.success); bossDamage(40); safeRemove(g); d(); });
    }
  }
  function doEnrageComboFast(){ const save=BOSS.P2; BOSS.P2=['multi_slash','ground_shock']; doEnrageCombo(); setTimeout(()=>BOSS.P2=save, dur(2000)); }
  function doRageFinale(){ BOSS.busy=true; play(SFX.enrage); doEnrageCombo(); }
  function doMirrorSlash(){ BOSS.busy=true; const a=mk(-26,1.36), b=mk(26,1.44); let ok=0; function mk(rot,y){ const g=document.createElement('a-entity'); g.classList.add('clickable','boss-attack'); g.setAttribute('geometry','primitive: box; height:.04;width:1.25;depth:.04'); g.setAttribute('material','color:#8cf5ff;opacity:.95;transparent:true'); g.setAttribute('rotation',`0 0 ${rot}`); g.setAttribute('position',`0 ${y} -2.2`); byId('arena').appendChild(g); return g; }
    [a,b].forEach(e=>e.addEventListener('click',()=>{ if(e.dataset.hit==='1') return; e.dataset.hit='1'; ok++; floatText('PARRY','#8cf5ff', e.object3D.getWorldPosition(new THREE.Vector3())); safeRemove(e); }));
    setTimeout(()=>{ if(ok>=2) bossDamage(30); else hardMiss(a); [a,b].forEach(e=>safeRemove(e)); finishAttack(); }, dur(560));
  }
  function doDoomRings(){ BOSS.busy=true; const rs=[]; for(let i=0;i<3;i++){ const r=document.createElement('a-ring'); r.classList.add('clickable','boss-attack'); const x=(i-1)*0.6; r.setAttribute('position',`${x} 1.15 -2.6`); r.setAttribute('radius-inner','0.05'); r.setAttribute('radius-outer','0.07'); r.setAttribute('material','color:#ffd166;opacity:.95;shader:flat'); byId('arena').appendChild(r); rs.push(r);
      r.addEventListener('click',()=>{ if(r.dataset.hit==='1') return; r.dataset.hit='1'; floatText('BREAK','#ffd166', r.object3D.getWorldPosition(new THREE.Vector3())); bossDamage(12); safeRemove(r); });
    }
    const start=performance.now(), T=dur(680);
    (function step(){ const t=(performance.now()-start)/T; rs.forEach((r,i)=>{ if(!r.parentNode) return; const base=0.07+t*0.9, off=i*0.02, R=base+off; r.setAttribute('radius-inner',Math.max(0.01,R-0.02)); r.setAttribute('radius-outer',R); });
      if(t>=1){ const broken=rs.filter(r=>!r.parentNode).length; if(broken<2) hardMiss(byId('arena')); rs.forEach(r=>safeRemove(r)); finishAttack(); return; } requestAnimationFrame(step);
    })();
  }
  function doVoidFinale(){ BOSS.busy=true; play(SFX.enrage); doMirrorSlash(); }

  // ---------- Phase / Result ----------
  function enterPhase2(){
    BOSS.phase=2; survivedStreak=0; addedTimeP2=0; setPhaseLabel(2); play(SFX.enrage); ping('Phase 2','#ffd166');
    // ต้องยิงเกราะ 2 ชิ้น
    spawnArmorShard(new THREE.Vector3(-0.5,1.55,-2.3)); spawnArmorShard(new THREE.Vector3(0.5,1.45,-2.3));
  }
  function spawnArmorShard(pos){
    const g=document.createElement('a-icosahedron'); g.classList.add('clickable','boss-attack');
    g.setAttribute('position',`${pos.x} ${pos.y} ${pos.z}`); g.setAttribute('radius','0.16'); g.setAttribute('color','#ffd166');
    g.setAttribute('animation__pulse','property: scale; dir: alternate; to: 1.15 1.15 1.15; loop: true; dur: 360');
    byId('arena').appendChild(g);
    let missT=setTimeout(()=>{ if(g.dataset.hit==='1') return; hardMiss(g); }, dur(3000));
    g.addEventListener('click',()=>{ if(g.dataset.hit==='1') return; g.dataset.hit='1'; clearTimeout(missT); floatText('ARMOR -1','#ffd166', g.object3D.getWorldPosition(new THREE.Vector3())); safeRemove(g); BOSS.armorShards=Math.max(0,(BOSS.armorShards||2)-1); });
  }
  function onBossDefeated(){
    // โบนัสเวลาถ้า Phase 2 และไม่โดน HIT นาน ๆ (ข้อ 13)
    if(BOSS.phase===2 && combo>=15){ timeLeft=Math.min(99,timeLeft+5); updateHUD(); }
    BOSS.active=false; floatText('BOSS DEFEATED','#00ffa3', new THREE.Vector3(0,1.6,-2.3)); score+=250; updateHUD();
    // ไปบอสถัดไปถ้าเวลาเหลือ (chain rule)
    const last=(CURRENT_BOSS>=ROSTER.length-1), canChain=(!last && timeLeft>=D.chainMin);
    if(canChain){ CURRENT_BOSS++; clearArena(); bossShowUI(false); setTimeout(()=>{ bossShowUI(true); bossSpawn(CURRENT_BOSS); }, 900); return; }
    end();
  }

  // ---------- Arena / Flow ----------
  function clearArena(){ const a=byId('arena'); Array.from(a.children).forEach(c=>safeRemove(c)); }
  function playerHit(){ ADAPT=Math.min(1.3,ADAPT*1.06); setTimeout(()=>ADAPT=Math.max(1,ADAPT*0.98),1200); combo=0; onComboChange(); score=Math.max(0,score-5); play(SFX.miss); }

  function start(){
    if(running) return;
    const key=getDiffKey(); D=DIFFS[key]||DIFFS.normal; localStorage.setItem('sb_diff', key);
    ROSTER=makeRoster(key);

    // เวลาเกม (ข้อ 15) – ตัดสั้นบนมือถือ
    timeLeft=/Mobi|Android/i.test(navigator.userAgent)? 50:60;

    score=0; bank=0; combo=0; maxCombo=0; hits=0; spawns=0; fever=false; feverPads=false; comboShield=0;
    rushPhase=false;
    byId('results').style.display='none'; bossShowUI(false); clearArena(); setPhaseLabel(1); updateHUD();

    running=true; paused=false;
    // สปอว์น Punch Pad ตามคอมโบ (ข้อ 5)
    schedulePads();

    timer=setInterval(()=>{ timeLeft--; updateHUD(); if(timeLeft<=0) end(); },1000);

    CURRENT_BOSS=0; setTimeout(()=>bossSpawn(CURRENT_BOSS), dur(900));
  }

  function schedulePads(){
    if(!running) return;
    spawnPad();
    // เว้นช่วงเริ่ม "ห่าง" แล้วค่อยถี่ขึ้นตามคอมโบ (ข้อ 5)
    const base=1500, ramp=Math.min(700, combo*6), next=clamp(base-ramp, 700, 2000);
    spawnTimer=setTimeout(schedulePads, next);
    // คอมโบชิลด์เมื่อครบ 8 ครั้ง (ข้อ 14)
    if(combo===8) comboShield=1;
  }

  function togglePause(){
    if(!running) return;
    paused=!paused;
    if(paused){ clearInterval(timer); clearTimeout(spawnTimer); cancelAnimationFrame(loopRAF); ping('PAUSED','#ffd166'); }
    else { timer=setInterval(()=>{ timeLeft--; updateHUD(); if(timeLeft<=0) end(); },1000); schedulePads(); ping('RESUME','#00ffa3'); }
  }

  function bankNow(){ const add=Math.floor(combo*3); bank+=add; combo=0; onComboChange(); updateHUD(); ping('Bank +'+add,'#9bd1ff'); }

  function end(){
    running=false; paused=false; clearInterval(timer); clearTimeout(spawnTimer); cancelAnimationFrame(loopRAF); bossShowUI(false);
    const acc=spawns? Math.round((hits/spawns)*100) : 0;
    byId('rScore').textContent=Math.round((score+bank)*D.scoreMul);
    byId('rMaxCombo').textContent=maxCombo;
    byId('rAcc').textContent=acc+'%';
    byId('rDiff').textContent=(DIFFS[getDiffKey()]?.title||'NORMAL')+' · '+(ST.title||'');
    // Stars (ง่ายๆ: noHit/50 combo/เวลาเหลือ)
    const star = (acc>=80?1:0)+(maxCombo>=50?1:0)+(timeLeft>=10?1:0);
    byId('rStars').textContent='★'.repeat(star)+'☆'.repeat(3-star);
    byId('results').style.display='flex';
    play(SFX.ui);
  }

  // ---------- Coach Tips (Extra 3) ----------
  const coach={ ringMissStreak:0, lastMsgAt:0 };
  function coachTrack(tag){
    if(tag==='miss:ring'){ coach.ringMissStreak++; } else if(tag==='miss:any'){ /* ไม่ reset ringStreak */ }
    // ทิปเมื่อพลาดวงแหวน 3 ครั้งติด
    if(coach.ringMissStreak>=3 && performance.now()-coach.lastMsgAt>2000){
      coach.lastMsgAt=performance.now(); coach.ringMissStreak=0;
      showCoach('เคล็ดลับ: วงแหวนจะขยายออก–กดให้ก่อนเต็มวงเล็กน้อย!');
    }
  }
  function showCoach(msg){
    let box=byId('coachDock'); if(!box){ box=document.createElement('div'); box.id='coachDock';
      Object.assign(box.style,{position:'fixed',left:'12px',bottom:'56px',zIndex:9999,display:'flex',gap:'8px',alignItems:'center',
        background:'rgba(0,0,0,.55)',border:'1px solid rgba(255,255,255,.08)',color:'#e6f7ff',borderRadius:'10px',padding:'8px 10px',font:'600 12px system-ui'}); document.body.appendChild(box); }
    box.textContent='🎧 Coach: '+msg;
  }

  // ---------- Accessibility (Extra 4) ----------
  function applyAccessibility(on){
    accessibility=!!on;
    const hud=byId('hud'); if(!hud) return;
    hud.style.filter=on?'contrast(1.2) saturate(1.05)':'';
    hud.style.fontSize=on?'15px':'13px';
    document.body.classList.toggle('sb-high-contrast', on);
  }

  // ---------- HUD / Buttons ----------
  document.addEventListener('DOMContentLoaded', ()=>{
    byId('startBtn')?.addEventListener('click', start);
    byId('replayBtn')?.addEventListener('click', start);
    byId('pauseBtn')?.addEventListener('click', togglePause);
    byId('bankBtn')?.addEventListener('click', bankNow);
    byId('backBtn')?.addEventListener('click', ()=>{ location.href=HUB_URL; });

    // Accessibility toggle (กด Alt+A)
    addEventListener('keydown', (e)=>{ if((e.altKey||e.metaKey)&& (e.key==='a'||e.key==='A')){ applyAccessibility(!accessibility); ping(accessibility?'Accessibility ON':'Accessibility OFF','#e6f7ff'); } });

    // Enter VR (กลางล่าง)
    let btn=document.getElementById('enterVRBtn');
    if(!btn){ btn=document.createElement('button'); btn.id='enterVRBtn'; btn.textContent='Enter VR';
      Object.assign(btn.style,{position:'fixed',left:'50%',transform:'translateX(-50%)',bottom:'12px',zIndex:9999,padding:'8px 12px',borderRadius:'10px',border:'0',background:'#0e2233',color:'#e6f7ff',cursor:'pointer'});
      document.body.appendChild(btn);
    }
    btn.addEventListener('click', ()=>{ try{ document.querySelector('a-scene')?.enterVR?.(); }catch(_){}});

    // Mouse raycast (เดสก์ท็อป)
    installPointerRaycast();
    // Easy: beat guide เสริม (ข้อ 12)
    if(getDiffKey()==='easy') installBeatGuide();
  });

  function installPointerRaycast(){
    const scene=document.querySelector('a-scene'); if(!scene) return;
    const ray=new THREE.Raycaster(), mouse=new THREE.Vector2();
    function fire(clientX,clientY){
      const cam=scene.camera; if(!cam) return;
      mouse.x=(clientX/window.innerWidth)*2-1; mouse.y=-(clientY/window.innerHeight)*2+1;
      ray.setFromCamera(mouse, cam);
      const objects=[]; Array.from(document.querySelectorAll('.clickable')).forEach(el=> el.object3D?.traverse(n=>objects.push(n)));
      const hits=ray.intersectObjects(objects,true); if(hits.length){ let o=hits[0].object; while(o && !o.el) o=o.parent; o?.el?.emit('click'); }
    }
    addEventListener('mousedown', e=>fire(e.clientX,e.clientY), {passive:true});
    addEventListener('touchstart', e=>{ const t=e.touches?.[0]; t&&fire(t.clientX,t.clientY); }, {passive:true});
  }

  function installBeatGuide(){
    let ring=document.createElement('a-ring'); ring.setAttribute('radius-inner','0.05'); ring.setAttribute('radius-outer','0.07');
    ring.setAttribute('position','0 1.02 -2.6'); ring.setAttribute('material','color:#9bd1ff;opacity:.6;shader:flat');
    ring.setAttribute('animation__pulse','property: scale; dir: alternate; to: 1.08 1.08 1.08; loop: true; dur: 1000');
    byId('arena').appendChild(ring);
  }

  // ---------- FloatText ----------
  function floatText(text,color,pos){
    const e=document.createElement('a-entity'), p=pos?.clone?.()||new THREE.Vector3(0,1.5,-2.3); p.y+=0.2;
    e.setAttribute('text',{value:text,color,align:'center',width:2.6});
    e.setAttribute('position',`${p.x} ${p.y} ${p.z}`); e.setAttribute('scale','0.001 0.001 0.001');
    e.setAttribute('animation__in',{property:'scale',to:'1 1 1',dur:90,easing:'easeOutQuad'});
    e.setAttribute('animation__rise',{property:'position',to:`${p.x} ${p.y+0.6} ${p.z}`,dur:600,easing:'easeOutQuad'});
    e.setAttribute('animation__fade',{property:'opacity',to:0,dur:480,delay:120,easing:'linear'});
    byId('arena').appendChild(e); setTimeout(()=>safeRemove(e),820);
  }

  // ---------- iOS Audio unlock ----------
  (function unlockAudio(){
    let unlocked=false, Ctx=(window.AudioContext||window.webkitAudioContext), ctx=Ctx? new Ctx(): null;
    function resume(){ if(unlocked||!ctx) return; ctx.resume?.(); unlocked=(ctx.state==='running'); }
    ['touchstart','pointerdown','mousedown','keydown'].forEach(ev=>addEventListener(ev,resume,{once:true,passive:true}));
  })();

  // ---------- Style: high-contrast class ----------
  const style=document.createElement('style');
  style.textContent=`
    .sb-high-contrast #hud { background: rgba(0,0,0,.55)!important; color:#fff!important; text-shadow:0 1px 0 rgba(0,0,0,.2); }
    .sb-high-contrast #bossBar { box-shadow:0 0 0 1px rgba(255,255,255,.28) inset; }
  `;
  document.head.appendChild(style);

  // ---------- Public (optional) ----------
  window.sbSetStance=(k)=>{ if(k==='power') ST={title:'POWER',dmg:1.2,parry:0.9}; else ST={title:'SWIFT',dmg:0.9,parry:1.1}; };

})();
