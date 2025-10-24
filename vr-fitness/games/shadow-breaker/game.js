/* games/shadow-breaker/game.js
   Shadow Breaker · game.js (READY-TO-USE)
   - Mouse/Touch raycast click ✔
   - Boss actions (slash / ring / guard / dash / multi / enrage / blade storm / laser grid / orb spiral / rage finale) ✔
   - Punch Pads (หลายรูปทรง/หลายสี) + Bomb (หักคอมโบ) ✔
   - No MISS เมื่อ "ไม่คลิก" เป้าธรรมดา (เฉพาะ Shadow Breaker) ✔
   - วงแหวนขยายได้ คลิกที่ขอบแล้วติดง่าย ✔
   - Rush Phase 10 วิ.ท้ายเฟส 2 ✔
   - Coach มุมล่างซ้าย ต่อจากปุ่ม Bank ✔
   - Back to Hub ถูกต้อง ✔
*/
(function(){
  "use strict";

  // ---------- Helpers ----------
  const byId = (id)=>document.getElementById(id);
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const HUB_URL = "https://supparang.github.io/webxr-health-mobile/vr-fitness/";
  const ASSET_BASE = (document.querySelector('meta[name="asset-base"]')?.content || '').replace(/\/+$/,'');

  // Safe remove (กัน removeChild of null)
  function safeRemove(el){ try{
    if(!el) return;
    if(!el.isConnected && !el.parentNode) return;
    if(el.parentNode) el.parentNode.removeChild(el); else if(el.remove) el.remove();
  }catch(_){} }

  // ---------- App helpers ----------
  const APPX={ badge:(t)=>{ if(window.APP?.badge) APP.badge(t); else console.log('[BADGE]',t); }, t:(k)=>window.APP?.t?APP.t(k):k };

  // ---------- SFX ----------
  const mkA = (p)=>{ const a=new Audio(p); a.preload='auto'; a.crossOrigin='anonymous'; return a; };
  const SFX = {
    good    : mkA(`${ASSET_BASE}/assets/sfx/slash.wav`),
    perfect : mkA(`${ASSET_BASE}/assets/sfx/perfect.wav`),
    miss    : mkA(`${ASSET_BASE}/assets/sfx/miss.wav`),
    combo   : mkA(`${ASSET_BASE}/assets/sfx/combo.wav`),
    hp_hit  : mkA(`${ASSET_BASE}/assets/sfx/hp_hit.wav`),
    tel_slash:mkA(`${ASSET_BASE}/assets/sfx/tel_slash.wav`),
    tel_shock:mkA(`${ASSET_BASE}/assets/sfx/tel_shock.wav`),
    tel_guard:mkA(`${ASSET_BASE}/assets/sfx/tel_guard.wav`),
    tel_dash :mkA(`${ASSET_BASE}/assets/sfx/tel_dash.wav`),
    enrage  : mkA(`${ASSET_BASE}/assets/sfx/enrage.wav`),
    success : mkA(`${ASSET_BASE}/assets/sfx/success.wav`),
    bomb    : mkA(`${ASSET_BASE}/assets/sfx/hit_bomb.wav`),
  };
  function play(a){ try{ a.currentTime=0; a.play(); }catch(_){ } }

  // ---------- Difficulty ----------
  function getDiffKey(){
    const q = new URLSearchParams(location.search).get('diff');
    const ls = localStorage.getItem('sb_diff');
    return (window.APP?.story?.difficulty) || q || ls || 'normal';
  }
  const DIFFS = {
    easy:   { hp:0.85, atkWin:1.15, dmgMul:0.9,  chainMin:10, spawnInt:1100, scoreMul:0.9,  title:'EASY'   },
    normal: { hp:1.00, atkWin:1.00, dmgMul:1.0,  chainMin:15, spawnInt:950,  scoreMul:1.0,  title:'NORMAL' },
    hard:   { hp:1.20, atkWin:0.92, dmgMul:1.1,  chainMin:20, spawnInt:860,  scoreMul:1.1,  title:'HARD'   },
    final:  { hp:1.35, atkWin:0.88, dmgMul:1.2,  chainMin:25, spawnInt:820,  scoreMul:1.2,  title:'FINAL'  }
  };
  let D = DIFFS.normal;

  // ---------- State ----------
  let running=false, paused=false;
  let timer=null, spawnTimer=null, patternT=null;
  let score=0, combo=0, maxCombo=0, hits=0, spawns=0, timeLeft=60, bank=0;
  let fever=false, feverT=0; let MQ=null;
  let CURRENT_BOSS=0;
  let addedTimeThisPhase=0;
  let rushPhase=false;
  let ringMissStreak=0; // ใช้โชว์ทิปโค้ช

  // Accessibility flags
  let ACC_HIGH_CONTRAST=false, ACC_HUD_LARGE=false;

  // ---------- Coach (UI) ----------
  function coachSay(msg, clr='#e6f7ff'){
    let c=byId('coach');
    if(!c){
      c=document.createElement('div');
      c.id='coach';
      Object.assign(c.style,{
        position:'fixed',bottom:'60px',left:'12px',zIndex:9999,
        background:'rgba(10,16,24,.85)',border:'1px solid rgba(255,255,255,.08)',
        borderRadius:'10px',padding:'8px 10px',color:'#e6f7ff',
        font:'600 12px system-ui',maxWidth:'52vw'
      });
      document.body.appendChild(c);
    }
    c.style.color=clr;
    c.textContent='Coach: '+msg;
    c.style.display='block';
    setTimeout(()=>{ if(c) c.style.display='none'; }, 2200);
  }

  // ---------- HUD ----------
  function updateHUD(){
    byId('score').textContent = Math.round((score+bank)*D.scoreMul);
    byId('combo').textContent = combo;
    byId('time').textContent = timeLeft;
  }
  function onComboChange(){
    byId('combo').textContent = combo;
    if(combo>0 && combo%10===0){ play(SFX.combo); APPX.badge('Combo x'+(1+Math.floor(combo/10))); }
    if(combo>maxCombo) maxCombo=combo;
    if(combo>=25) tryFever();
  }
  function tryFever(){ if(!fever && combo>=25){ fever=true; feverT=performance.now()+8000; APPX.badge('FEVER! Punch Pads x1.5'); } }
  setInterval(()=>{ if(fever && performance.now()>feverT){ fever=false; APPX.badge('Fever End'); } }, 150);

  function setPhaseLabel(n){ const el=byId('phaseLabel'); if(el) el.textContent='Phase '+n; }

  // ---------- Float text ----------
  function floatText(text,color,pos){
    const e=document.createElement('a-entity'), p=pos.clone(); p.y+=0.2;
    e.setAttribute('text',{value:text,color,align:'center',width:2.6});
    e.setAttribute('position',`${p.x} ${p.y} ${p.z}`);
    e.setAttribute('scale','0.001 0.001 0.001');
    e.setAttribute('animation__in',{property:'scale',to:'1 1 1',dur:90,easing:'easeOutQuad'});
    e.setAttribute('animation__rise',{property:'position',to:`${p.x} ${p.y+0.6} ${p.z}`,dur:600,easing:'easeOutQuad'});
    e.setAttribute('animation__fade',{property:'opacity',to:0,dur:480,delay:160,easing:'linear'});
    byId('arena').appendChild(e); setTimeout(()=>safeRemove(e),820);
  }

  // ---------- Boss ----------
  const BOSS={active:false,hp:0,max:1000,rage:false,phase:1,busy:false,name:'',color:'#ff3355', P1:[], P2:[]};
  const BOSSES_ALL = [
    { id:'RazorFist', title:'RAZORFIST', baseHP:1000, color:'#ff3355',
      P1:['slash_cross','rapid_fist','guard_break'],
      P2:['shadow_dash','multi_slash','enrage_combo']
    },
    { id:'Nightblade', title:'NIGHTBLADE', baseHP:1400, color:'#7a5cff',
      P1:['blade_storm','laser_grid','guard_break'],
      P2:['orb_spiral','blade_storm_fast','rage_finale']
    }
  ];
  function makeRoster(diffKey){
    if(diffKey==='easy')   return [BOSSES_ALL[0]];
    if(diffKey==='normal') return [BOSSES_ALL[0], BOSSES_ALL[1]];
    return [BOSSES_ALL[0], BOSSES_ALL[1]];
  }
  let ROSTER = makeRoster('normal');

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
    const base = amount * (BOSS.rage?0.9:0.8) * D.dmgMul;
    play(SFX.hp_hit); bossSetHP(BOSS.hp - Math.max(1, Math.round(base)));
    if(pos) floatText('-'+Math.round(base),'#ffd166',pos);
  }
  function bossIntro(){
    const arena=byId('arena');
    const anchor=document.createElement('a-entity');
    anchor.setAttribute('id','bossAnchor');
    anchor.setAttribute('position','0 1.5 -3');

    const head=document.createElement('a-sphere'); head.setAttribute('radius','0.35'); head.setAttribute('color','#1a1a1a'); head.setAttribute('position','0 0 0');
    const mask=document.createElement('a-box'); mask.setAttribute('depth','0.06'); mask.setAttribute('width','0.55'); mask.setAttribute('height','0.45'); mask.setAttribute('color',BOSS.color||'#ff3355'); mask.setAttribute('position','0 0 0.25');
    anchor.appendChild(head); anchor.appendChild(mask);
    byId('arena').appendChild(anchor);

    bossShowUI(true); bossSetHP(BOSS.max);
    play(SFX.enrage);
    APPX.badge((BOSS.name||'BOSS') + ' · ' + (DIFFS[getDiffKey()]?.title || 'NORMAL'));
    setPhaseLabel(1);
  }
  function bossSpawn(index=0){
    const cfg = ROSTER[index] || ROSTER[0];
    BOSS.active=true; BOSS.busy=false; rushPhase=false; addedTimeThisPhase=0;
    BOSS.max=Math.round(cfg.baseHP*D.hp); BOSS.hp=BOSS.max; BOSS.rage=false; BOSS.phase=1;
    BOSS.name=cfg.title; BOSS.color=cfg.color; BOSS.P1=cfg.P1.slice(); BOSS.P2=cfg.P2.slice();
    bossIntro();
    setTimeout(bossLoop, 700);
  }
  function onBossDefeated(){
    BOSS.active=false;
    floatText('BOSS DEFEATED','#00ffa3', new THREE.Vector3(0,1.6,-2.3));
    score+=250; updateHUD();
    CURRENT_BOSS++;
    const lastBoss = (CURRENT_BOSS >= ROSTER.length);
    if(!lastBoss && timeLeft>=DIFFS[getDiffKey()].chainMin){
      APPX.badge('Qualified! Next Boss…');
      setTimeout(()=>bossSpawn(CURRENT_BOSS), 900);
    }else{
      end();
    }
  }
  function enterPhase2(){
    BOSS.phase=2; rushPhase=false; addedTimeThisPhase=0;
    play(SFX.enrage); APPX.badge('Phase 2'); setPhaseLabel(2);
  }

  // Rush Phase (10s ท้ายเฟส 2)
  function checkRushPhase(){
    if(!BOSS.active || BOSS.phase!==2) return;
    if(timeLeft<=10 && !rushPhase){ rushPhase=true; APPX.badge('RUSH PHASE!'); play(SFX.enrage); }
  }

  // ---------- Patterns ----------
  let pIndex=0, lastPattern='';
  function pick(arr){
    let p=arr[pIndex%arr.length]; pIndex++;
    if(p===lastPattern){ p=arr[(pIndex)%arr.length]; pIndex++; }
    lastPattern=p; return p;
  }
  function bossLoop(){
    if(!running || !BOSS.active || BOSS.busy) return;
    checkRushPhase();
    const arr=(BOSS.phase===1?BOSS.P1:BOSS.P2);
    const pat=pick(arr);
    (PATTERNS[pat]||PATTERNS.guard_break)();
  }
  function finishAttack(delay=520){
    BOSS.busy=false;
    const accel = rushPhase?0.65:(BOSS.phase===2?0.85:1);
    patternT = setTimeout(bossLoop, Math.max(240, delay*accel*DIFFS[getDiffKey()].atkWin));
  }

  const COLORS=['#00d0ff','#ffd166','#ff6b6b','#00ffa3','#a899ff','#ff9c6b'];
  // ---------- Punch Pads (ผู้เล่นคลิกเพื่อทำแต้ม) ----------
  function spawnPad(){
    spawns++;
    const arena=byId('arena');
    const shapes=['a-box','a-sphere','a-icosahedron','a-octahedron','a-tetrahedron'];
    const shape = shapes[Math.floor(Math.random()*shapes.length)];
    const color = COLORS[Math.floor(Math.random()*COLORS.length)];
    const x=(Math.random()*2.8-1.4).toFixed(2), y=(1.05+Math.random()*0.85).toFixed(2), z=(-2.3).toFixed(2);

    const el=document.createElement(shape);
    el.classList.add('clickable','pad');
    if(shape==='a-sphere'){ el.setAttribute('radius','0.17'); }
    else{ el.setAttribute('scale','0.34 0.34 0.34'); }
    el.setAttribute('material',`color:${color}; opacity:${ACC_HIGH_CONTRAST?1:0.95}; transparent:true; metalness:0.1; roughness:0.4`);
    el.setAttribute('position',`${x} ${y} ${z}`);
    arena.appendChild(el);

    // ไม่คลิก = ไม่ MISS → remove เฉย ๆ หลัง 2.4s
    const t = setTimeout(()=>safeRemove(el), 2400);
    const onHit=()=>{
      clearTimeout(t);
      const p=el.object3D.getWorldPosition(new THREE.Vector3());
      safeRemove(el);
      hits++; combo++; maxCombo=Math.max(maxCombo,combo);
      const val = fever? Math.round(15*1.5) : 15;
      score += val;
      play(SFX.good);
      floatText('GOOD', '#00d0ff', p);
      onComboChange();
      updateHUD();
    };
    el.addEventListener('click', onHit);
    el.addEventListener('mousedown', onHit);
  }

  // Bomb (หักคอมโบ แต่ไม่หักคะแนน)
  function spawnBomb(){
    const arena=byId('arena');
    const el=document.createElement('a-octahedron');
    el.classList.add('clickable','bomb');
    el.setAttribute('color','#ff3355');
    el.setAttribute('radius','0.22');
    el.setAttribute('position',`${(Math.random()*2.6-1.3).toFixed(2)} ${(1.1+Math.random()*0.7).toFixed(2)} -2.3`);
    el.setAttribute('animation__pulse','property: scale; dir: alternate; to: 1.15 1.15 1.15; loop: true; dur: 360; easing: easeInOutSine');
    byId('arena').appendChild(el);
    const t=setTimeout(()=>safeRemove(el),2200);
    const onClick=()=>{
      clearTimeout(t);
      const p=el.object3D.getWorldPosition(new THREE.Vector3());
      safeRemove(el);
      combo=0; onComboChange();
      play(SFX.bomb);
      floatText('BOMB! Combo Reset','#ff5577',p);
    };
    el.addEventListener('click', onClick);
    el.addEventListener('mousedown', onClick);
  }

  // Spawn scheduler for pads/bombs
  let padTimer=null;
  function startPadFlow(){
    stopPadFlow();
    const base = Math.max(420, DIFFS[getDiffKey()].spawnInt);
    padTimer = setInterval(()=>{
      // สุ่มโผล่ pad 1-2 ชิ้น
      spawnPad();
      if(Math.random()<0.25) spawnPad();
      // สุ่ม bomb เบาบาง
      if(Math.random()<0.15) spawnBomb();
    }, base);
  }
  function stopPadFlow(){ if(padTimer){ clearInterval(padTimer); padTimer=null; } }

  // ---------- Boss Patterns (คลิกที่วัตถุเพื่อรอดโจมตี) ----------
  const PATTERNS={
    slash_cross(){ // กล่องดาบเฉียงสองแผง
      BOSS.busy=true; play(SFX.tel_slash);
      const mk=(rot,y)=>{
        const g=document.createElement('a-entity');
        g.classList.add('clickable','boss-attack');
        g.setAttribute('geometry','primitive: box; height: 0.04; width: 1.25; depth: 0.04');
        g.setAttribute('material',`color:#5de1ff; opacity:${ACC_HIGH_CONTRAST?1:0.95}; transparent:true`);
        g.setAttribute('rotation',`0 0 ${rot}`); g.setAttribute('position',`0 ${y} -2.2`);
        byId('arena').appendChild(g);
        const onHit=()=>{ floatText('PARRY','#00ffa3', g.object3D.getWorldPosition(new THREE.Vector3())); bossDamage(20,new THREE.Vector3(0,1.5,-3)); safeRemove(g); };
        g.addEventListener('click', onHit); g.addEventListener('mousedown', onHit);
        return g;
      };
      const a=mk(-32,1.36), b=mk(32,1.44);
      setTimeout(()=>{
        if(a?.parentNode){ playerHit(); safeRemove(a); }
        if(b?.parentNode){ playerHit(); safeRemove(b); }
        finishAttack(560);
      }, rushPhase?420:700);
    },

    rapid_fist(){ // วงแหวนช็อกเวฟ 3-4 ชุด
      BOSS.busy=true;
      let count=0, need=(BOSS.phase===1?3:4);
      const next=()=>{ if(count>=need){ finishAttack(480); return; } play(SFX.tel_shock); spawnRing(()=>{ count++; setTimeout(next, rushPhase?220:300); }); };
      next();
    },

    guard_break(){ // ลูกแกนแดง
      BOSS.busy=true; play(SFX.tel_guard);
      const core=document.createElement('a-sphere');
      core.classList.add('clickable','boss-attack');
      core.setAttribute('radius','0.2'); core.setAttribute('color','#ff6b6b');
      core.setAttribute('position','0 1.14 -2.2'); byId('arena').appendChild(core);
      const onHit=()=>{ bossDamage(12, core.object3D.getWorldPosition(new THREE.Vector3())); safeRemove(core); finishAttack(420); };
      core.addEventListener('click', onHit); core.addEventListener('mousedown', onHit);
      setTimeout(()=>{ if(core?.parentNode){ playerHit(); safeRemove(core); } finishAttack(420); }, rushPhase?420:650);
    },

    shadow_dash(){ // กล่องซ้าย/ขวา กดให้ถูกอัน
      BOSS.busy=true; play(SFX.tel_dash);
      const l=document.createElement('a-box'), r=document.createElement('a-box');
      [l,r].forEach((b,i)=>{ b.classList.add('clickable','boss-attack'); b.setAttribute('width','0.5'); b.setAttribute('height','0.3'); b.setAttribute('depth','0.05');
        b.setAttribute('color', i===0?'#00d0ff':'#00ffa3'); b.setAttribute('position', (i===0?'-0.9':'0.9')+' 1.0 -2.0'); byId('arena').appendChild(b); });
      let ok=false; const hit=(box)=>{ if(ok) return; ok=true; floatText('DODGE','#9bd1ff', box.object3D.getWorldPosition(new THREE.Vector3())); bossDamage(12,new THREE.Vector3(0,1.5,-3));
        [l,r].forEach(b=>safeRemove(b)); finishAttack(460); };
      l.addEventListener('click', ()=>hit(l)); r.addEventListener('click', ()=>hit(r));
      l.addEventListener('mousedown', ()=>hit(l)); r.addEventListener('mousedown', ()=>hit(r));
      setTimeout(()=>{ if(!ok){ playerHit(); } [l,r].forEach(b=>safeRemove(b)); finishAttack(480); }, rushPhase?420:700);
    },

    multi_slash(){ // ดาบเฉียงสลับ 2 ชุด
      BOSS.busy=true; const seq=[-32,32]; let i=0;
      const next=()=>{
        play(SFX.tel_slash);
        const g=document.createElement('a-entity');
        g.classList.add('clickable','boss-attack');
        g.setAttribute('geometry','primitive: box; height: 0.04; width: 1.2; depth: 0.04');
        g.setAttribute('material',`color:#5de1ff; opacity:${ACC_HIGH_CONTRAST?1:0.95}; transparent:true`);
        g.setAttribute('rotation','0 0 '+seq[i]); g.setAttribute('position','0 1.35 -2.2');
        byId('arena').appendChild(g);
        let ok=false; const onHit=()=>{ ok=true; floatText('PARRY','#00ffa3', g.object3D.getWorldPosition(new THREE.Vector3())); bossDamage(16,new THREE.Vector3(0,1.5,-3)); safeRemove(g); };
        g.addEventListener('click', onHit); g.addEventListener('mousedown', onHit);
        setTimeout(()=>{ if(g?.parentNode){ safeRemove(g); if(!ok) playerHit(); } i++; if(i<seq.length) setTimeout(next, 120); else finishAttack(520); }, rushPhase?420:650);
      };
      next();
    },

    enrage_combo(){ // สั้น เร็ว
      BOSS.busy=true; play(SFX.enrage); APPX.badge('ENRAGE!');
      const steps=[ 'slash_cross','rapid_fist','guard_break' ];
      let j=0; (function step(){ if(j>=steps.length){ finishAttack(480); return; } PATTERNS[steps[j++]](); setTimeout(step, rushPhase?340:520); })();
    },

    // Nightblade specials
    blade_storm(){ bladeStorm(false); },
    blade_storm_fast(){ bladeStorm(true); },
    laser_grid(){ laserGrid(); },
    orb_spiral(){ orbSpiral(false); },
    rage_finale(){ rageFinale(); },
  };

  function bladeStorm(fast){
    BOSS.busy=true;
    let i=0, count = fast?4:3;
    const doOne=()=>{
      play(SFX.tel_slash);
      const rot = (-50 + Math.random()*100)|0;
      const g=document.createElement('a-entity');
      g.classList.add('clickable','boss-attack');
      g.setAttribute('geometry','primitive: box; height: 0.04; width: 1.25; depth: 0.04');
      g.setAttribute('material',`color:#7a5cff; opacity:${ACC_HIGH_CONTRAST?1:0.9}; transparent:true`);
      g.setAttribute('rotation',`0 0 ${rot}`); g.setAttribute('position','0 1.38 -2.2');
      byId('arena').appendChild(g);
      let ok=false; const onHit=()=>{ ok=true; floatText('PARRY','#a899ff', g.object3D.getWorldPosition(new THREE.Vector3())); bossDamage(fast?18:16,new THREE.Vector3(0,1.5,-3)); safeRemove(g); };
      g.addEventListener('click', onHit); g.addEventListener('mousedown', onHit);
      setTimeout(()=>{ if(g?.parentNode){ safeRemove(g); if(!ok) playerHit(); } i++; if(i<count) setTimeout(doOne, 100); else finishAttack(520); }, rushPhase?420:650);
    };
    doOne();
  }
  function laserGrid(){
    BOSS.busy=true; play(SFX.tel_dash);
    const mk=(x,y,rot)=>{
      const b=document.createElement('a-entity');
      b.classList.add('clickable','boss-attack');
      b.setAttribute('geometry','primitive: box; height: 0.035; width: 1.4; depth: 0.03');
      b.setAttribute('material',`color:#5de1ff; opacity:${ACC_HIGH_CONTRAST?1:0.9}; transparent:true`);
      b.setAttribute('position',`${x} ${y} -2.2`); b.setAttribute('rotation',`0 0 ${rot}`);
      byId('arena').appendChild(b); return b;
    };
    const a=mk(0,1.3,-15), b=mk(0,1.5,15); let ca=false, cb=false;
    const ok=()=>{ if(ca && cb){ bossDamage(28,new THREE.Vector3(0,1.5,-3)); cleanup(); } };
    const ha=()=>{ ca=true; floatText('CUT','#5de1ff', a.object3D.getWorldPosition(new THREE.Vector3())); safeRemove(a); ok(); };
    const hb=()=>{ cb=true; floatText('CUT','#5de1ff', b.object3D.getWorldPosition(new THREE.Vector3())); safeRemove(b); ok(); };
    a.addEventListener('click',ha); a.addEventListener('mousedown',ha);
    b.addEventListener('click',hb); b.addEventListener('mousedown',hb);
    setTimeout(()=>{ cleanup(true); }, rushPhase?520:800);
    function cleanup(timeout){
      if(a?.parentNode){ if(timeout && !ca) playerHit(); safeRemove(a); }
      if(b?.parentNode){ if(timeout && !cb) playerHit(); safeRemove(b); }
      finishAttack(520);
    }
  }
  function orbSpiral(fast){
    BOSS.busy=true;
    const center=new THREE.Vector3(0,1.4,-2.3);
    const orbs=[];
    for(let i=0;i<4;i++){
      const o=document.createElement('a-sphere'); o.classList.add('clickable','boss-attack');
      o.setAttribute('radius','0.1'); o.setAttribute('color', fast?'#c9b6ff':'#a899ff');
      o.dataset.theta = (i/4)*Math.PI*2;
      byId('arena').appendChild(o); orbs.push(o);
      const onHit=()=>{ floatText('BREAK', fast?'#c9b6ff':'#a899ff', o.object3D.getWorldPosition(new THREE.Vector3())); bossDamage(fast?12:10,center); safeRemove(o); };
      o.addEventListener('click',onHit); o.addEventListener('mousedown',onHit);
    }
    const start=performance.now(), T=(rushPhase?1500:(fast?1800:2200))*DIFFS[getDiffKey()].atkWin;
    (function step(){
      const t=(performance.now()-start)/T;
      let alive=false;
      orbs.forEach((o,idx)=>{
        if(!o || !o.parentNode) return; alive=true;
        const theta=(+o.dataset.theta)+t*(fast?4.6:3.2);
        const r=0.5 + 0.2*Math.sin(t*4+idx);
        const x=center.x+Math.cos(theta)*r;
        const y=center.y+Math.sin(theta)*r*0.6;
        o.setAttribute('position',`${x.toFixed(3)} ${y.toFixed(3)} ${center.z}`);
      });
      if(t>=1){ orbs.forEach(o=>{ if(o?.parentNode){ safeRemove(o); playerHit(); } }); finishAttack(520); return; }
      if(!alive){ finishAttack(420); return; }
      requestAnimationFrame(step);
    })();
  }
  function rageFinale(){
    BOSS.busy=true; play(SFX.enrage); APPX.badge('FINAL RAGE!');
    const seq=[ 'slash_cross','rapid_fist','guard_break' ];
    let j=0; (function step(){ if(j>=seq.length){ finishAttack(520); return; } PATTERNS[seq[j++]](); setTimeout(step, rushPhase?320:480); })();
  }

  // Shockwave ring (ขยายรัศมี + คลิกที่ขอบ)
  function spawnRing(done){
    ringMissStreak = Math.min(3, ringMissStreak); // cap ไว้
    const ring=document.createElement('a-ring'); ring.classList.add('clickable','boss-attack');
    ring.setAttribute('position','0 1.2 -2.6'); ring.setAttribute('radius-inner','0.05'); ring.setAttribute('radius-outer','0.08');
    ring.setAttribute('material',`color:#ffd166;opacity:${ACC_HIGH_CONTRAST?1:0.95};shader:flat`); byId('arena').appendChild(ring);

    const onHit=()=>{
      const p=ring.object3D.getWorldPosition(new THREE.Vector3());
      floatText('BREAK','#00ffa3', p); bossDamage(16,p);
      ringMissStreak=0; safeRemove(ring); done&&done();
    };
    ring.addEventListener('click', onHit);
    ring.addEventListener('mousedown', onHit);

    const start=performance.now(), T=(BOSS.phase===1?720:580) * (rushPhase?0.72:1) * DIFFS[getDiffKey()].atkWin;
    (function step(){
      if(!ring?.parentNode) return;
      const t=(performance.now()-start)/T, base=0.08+t*0.95;
      ring.setAttribute('radius-inner', Math.max(0.02, base-0.03));
      ring.setAttribute('radius-outer', base);
      if(t>=1){
        // timeout → ถือว่าบอสดาเมจผู้เล่น (ไม่ใช่ MISS ของผู้เล่นต่อเป้าธรรมดา)
        safeRemove(ring);
        ringMissStreak++;
        if(ringMissStreak>=3){
          coachSay('ทิป: วงแหวนให้คลิก “ขอบ” ตอนกำลังขยาย'); // coach regex behavior
          ringMissStreak=0;
        }
        playerHit(); done&&done(); return;
      }
      requestAnimationFrame(step);
    })();
  }

  function playerHit(){
    // โดนบอส → ไม่หักคะแนน แต่รีเซ็ตคอมโบ
    combo=0; onComboChange();
    const scn=document.querySelector('a-scene'); scn?.classList.add('shake-scene'); setTimeout(()=>scn?.classList.remove('shake-scene'), 240);
  }

  // ---------- Game flow ----------
  function clearArena(){ Array.from(byId('arena').children).forEach(c=>safeRemove(c)); }
  function reset(){
    score=0; bank=0; combo=0; maxCombo=0; hits=0; spawns=0; timeLeft=60; updateHUD();
    byId('results').style.display='none'; bossShowUI(false); clearArena();
    setPhaseLabel(1); ringMissStreak=0; rushPhase=false; fever=false; MQ=null;
  }
  function start(){
    if(running) return;
    const key=getDiffKey(); D=DIFFS[key]||DIFFS.normal; localStorage.setItem('sb_diff', key); ROSTER=makeRoster(key);
    reset(); running=true; paused=false;

    // เวลาเดิน
    timer=setInterval(()=>{ timeLeft--; byId('time').textContent=timeLeft; if(timeLeft<=0) end(); },1000);
    // Spawn pads/bombs
    startPadFlow();
    // เริ่มบอส
    CURRENT_BOSS=0; setTimeout(()=>bossSpawn(CURRENT_BOSS), 700);
  }
  function end(){
    running=false; paused=false;
    clearInterval(timer); stopPadFlow(); clearTimeout(patternT);
    bossShowUI(false);

    // ผลลัพธ์
    const acc = spawns? Math.round((hits/spawns)*100) : 0;
    byId('rScore').textContent = Math.round((score+bank)*D.scoreMul);
    byId('rMaxCombo').textContent = maxCombo;
    byId('rAcc').textContent = acc+'%';
    byId('results').style.display='flex';
    APPX.badge(APPX.t('results')+': '+byId('rScore').textContent);
  }
  function togglePause(){
    if(!running) return;
    paused=!paused;
    if(paused){ clearInterval(timer); stopPadFlow(); APPX.badge('Paused'); }
    else{
      timer=setInterval(()=>{ timeLeft--; byId('time').textContent=timeLeft; if(timeLeft<=0) end(); },1000);
      startPadFlow(); APPX.badge('Resume');
    }
  }
  function bankNow(){
    const add=Math.floor(combo*3); bank+=add; APPX.badge('Bank +'+add); combo=0; onComboChange(); updateHUD();
  }

  // ---------- Buttons ----------
  document.addEventListener('DOMContentLoaded', ()=>{
    byId('startBtn')?.addEventListener('click', start);
    byId('replayBtn')?.addEventListener('click', start);
    byId('backBtn')?.addEventListener('click', ()=>{ location.href = HUB_URL; });
    byId('pauseBtn')?.addEventListener('click', togglePause);
    byId('bankBtn')?.addEventListener('click', bankNow);
  });

  // ---------- Pointer Raycast (Mouse/Touch) ----------
  (function installPointerRaycast(){
    const sceneEl=document.querySelector('a-scene'); if(!sceneEl) return;
    const raycaster=new THREE.Raycaster(); const mouse=new THREE.Vector2();
    function pick(clientX, clientY){
      const cam=sceneEl.camera; if(!cam) return;
      mouse.x=(clientX/window.innerWidth)*2-1;
      mouse.y=-(clientY/window.innerHeight)*2+1;
      raycaster.setFromCamera(mouse, cam);
      const clickable = Array.from(document.querySelectorAll('.clickable')).map(el=>el.object3D).filter(Boolean);
      const objs=[]; clickable.forEach(o=>o.traverse(ch=>objs.push(ch)));
      const hits=raycaster.intersectObjects(objs,true);
      if(hits && hits.length){
        let obj=hits[0].object; while(obj && !obj.el) obj=obj.parent;
        if(obj && obj.el) obj.el.emit('click');
      }
    }
    window.addEventListener('mousedown',e=>pick(e.clientX,e.clientY),{passive:true});
    window.addEventListener('touchstart',e=>{const t=e.touches?.[0]; if(!t) return; pick(t.clientX,t.clientY);},{passive:true});
  })();

  // ---------- iOS Audio unlock ----------
  (function unlockAudio(){
    let unlocked=false, Ctx=(window.AudioContext||window.webkitAudioContext);
    let ctx = Ctx? new Ctx() : null;
    function resume(){ if(unlocked||!ctx) return; ctx.resume?.(); unlocked=(ctx.state==='running'); }
    ['touchstart','pointerdown','mousedown','keydown'].forEach(ev=>document.addEventListener(ev, resume, {once:true, passive:true}));
  })();

  // ---------- Accessibility toggles (optional external calls) ----------
  window.SB_setHighContrast=(on)=>{ ACC_HIGH_CONTRAST=!!on; };
  window.SB_setHudLarge=(on)=>{ ACC_HUD_LARGE=!!on; document.body.style.setProperty('--hud-scale', on? '1.15':'1'); };

  // ---------- Keyboard Shortcuts ----------
  addEventListener('keydown', (ev)=>{
    if(ev.code==='Space'){ ev.preventDefault(); if(!running) start(); else togglePause(); }
    if(ev.code==='Escape'){ if(running) end(); }
  });

  // ---------- Minimal CSS tweak for HUD scale (if used) ----------
  (function injectCSS(){
    const css = `
      :root{ --hud-scale:1; }
      #hud{ transform: scale(var(--hud-scale)); transform-origin: top left; }
    `;
    const s=document.createElement('style'); s.textContent=css; document.head.appendChild(s);
  })();
/* === Coach HUD · bottom-left, next to Bank (Shadow Breaker) ================= */
(function installCoachDock(){
  // หา element ช่วย
  const $ = (id)=>document.getElementById(id);

  // กล่อง + สไตล์
  function createCoach(){
    if (document.getElementById('coachDock')) return document.getElementById('coachDock');

    const dock = document.createElement('div');
    dock.id = 'coachDock';
    Object.assign(dock.style, {
      position:'fixed',
      bottom:'12px', left:'12px',
      display:'flex', alignItems:'center', gap:'8px',
      padding:'8px 10px',
      background:'rgba(7,12,18,.75)',
      border:'1px solid rgba(255,255,255,.08)',
      borderRadius:'12px',
      color:'#e6f7ff',
      font:'600 12px/1.2 system-ui',
      zIndex: 9999,
      pointerEvents: 'none',         // สำคัญ: ไม่บังการคลิกปุ่ม/ฉาก
      maxWidth:'42vw'
    });

    const avatar = document.createElement('div');
    avatar.textContent = '🥊';
    Object.assign(avatar.style, {fontSize:'16px', filter:'drop-shadow(0 1px 0 rgba(0,0,0,.35))'});

    const msg = document.createElement('div');
    msg.id = 'coachMsg';
    Object.assign(msg.style, {
      opacity: .96,
      textShadow:'0 1px 0 #000',
      letterSpacing: '.2px'
    });
    msg.textContent = 'พร้อมลุย! กด Start แล้วโฟกัสที่สัญญาณเตือนของบอสนะ';

    dock.appendChild(avatar);
    dock.appendChild(msg);
    document.body.appendChild(dock);
    return dock;
  }

  // จัดตำแหน่ง “ชิดขวา” ของปุ่ม Bank ถ้ามี
  function positionCoach(){
    const dock = document.getElementById('coachDock') || createCoach();
    const bank = document.getElementById('bankBtn');

    if (!bank){
      // ไม่มีปุ่ม Bank → ยึดมุมล่างซ้ายปกติ
      Object.assign(dock.style, {left:'12px', bottom:'12px', transform:''});
      return;
    }

    const r = bank.getBoundingClientRect();
    const left = Math.max(12, Math.round(r.right + 8));
    const bottom = Math.max(12, Math.round(window.innerHeight - r.bottom));
    Object.assign(dock.style, {left:left+'px', bottom:bottom+'px', transform:''});
  }

  // API สำหรับเรียกจากเกม
  function coachSay(text, tone='info'){
    const box = document.getElementById('coachDock') || createCoach();
    const msg = document.getElementById('coachMsg');
    if (!msg) return;
    msg.textContent = text;

    // โทนสีสั้น ๆ
    const toneColor = {
      info:'#e6f7ff',
      good:'#00ffa3',
      warn:'#ffd166',
      bad:'#ff6b6b'
    }[tone] || '#e6f7ff';

    box.style.borderColor = tone==='warn' ? 'rgba(255,209,102,.45)'
                        : tone==='bad'  ? 'rgba(255,107,107,.45)'
                        : tone==='good' ? 'rgba(0,255,163,.35)'
                                         : 'rgba(255,255,255,.08)';
    box.style.color = toneColor;

    // แอนิเมชันเล็ก ๆ
    box.animate(
      [{transform:'translateY(0)'},{transform:'translateY(-2px)'},{transform:'translateY(0)'}],
      {duration:260, easing:'ease-out'}
    );
  }

  // ติดตั้ง + ติดตามขนาด/เลย์เอาต์
  function boot(){
    createCoach();
    positionCoach();
    // รีตำแหน่งเมื่อมีการ resize/scroll/font load/ปุ่มโผล่ช้า
    ['resize','scroll'].forEach(ev=>window.addEventListener(ev, positionCoach, {passive:true}));
    // Reposition ซ้ำ ๆ ช่วงแรกเผื่อปุ่ม Bank เพิ่งเรนเดอร์
    let tries = 0; const i = setInterval(()=>{ positionCoach(); tries++; if(tries>20) clearInterval(i); }, 150);

    // เผยแพร่ API
    window.coachSay = coachSay;

    // ข้อความหมุนเวียนเบื้องต้น (จะไม่แย่งพื้นที่คลิก เพราะ pointer-events:none)
    const tips = [
      'เคล็ดลับ: วงแหวนให้คลิกที่ “ขอบ” ตอนกำลังขยาย',
      'ถ้าเห็นดาบคู่ ให้คลิกให้ครบทั้งสองอัน',
      'Fever Punch Pads จะให้ x1.5 รีบชกตอนเรืองแสง',
      'โดนบอสตี อย่าตกใจ—ตั้งคอมโบใหม่แล้วลุยต่อ!'
    ];
    let idx=0;
    setInterval(()=>{
      // ไม่กวนถ้าผู้เล่นกำลังสู้: โชว์เบา ๆ พอเตือน
      coachSay(tips[idx%tips.length], 'info'); idx++;
      positionCoach();
    }, 9000);
  }

  if (document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // รีโปซิชันเมื่อปุ่ม Bank เปลี่ยนเลย์เอาต์ (บางธีมโหลดช้า)
  const obs = new MutationObserver(()=>positionCoach());
  obs.observe(document.documentElement, {subtree:true, attributes:true, childList:true});

})();

})();
