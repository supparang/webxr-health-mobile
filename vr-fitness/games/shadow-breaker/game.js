/* games/shadow-breaker/game.js
   Shadow Breaker · game.js (4 แพตช์รวมครบ: ensureArena + watchdog + flow-safe combo + raycast รอกล้อง)
*/
(function(){
  "use strict";

  // ---------- Helpers ----------
  const byId = (id)=>document.getElementById(id);
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const getQuery=(k)=>new URLSearchParams(location.search).get(k);
  const ASSET_BASE = (document.querySelector('meta[name="asset-base"]')?.content || '').replace(/\/+$/,'');
  const HUB_URL = "https://supparang.github.io/webxr-health-mobile/vr-fitness/";

  // ป้าย / แปล (fallback เป็น console)
  const APPX = {
    badge:(t)=>{ if(window.APP?.badge) APP.badge(t); else console.log('[BADGE]',t); },
    t:(k)=>window.APP?.t?APP.t(k):k
  };

  // Null-safe remover (กัน removeChild of null จากภายใน A-Frame)
  function safeRemove(el){
    try{
      if(!el) return;
      if(!el.isConnected && !el.parentNode) return;
      if(el.parentNode) el.parentNode.removeChild(el);
      else if(el.remove) el.remove();
    }catch(_){}
  }

  // Timer helpers
  const timeouts = new Set();
  function after(ms, fn){
    const id = setTimeout(()=>{ timeouts.delete(id); try{ fn(); }catch(_e){} }, ms);
    timeouts.add(id); return id;
  }

  // ให้แน่ใจว่า #arena มีเสมอ (ถ้าไม่มีก็สร้างให้)
  function ensureArena(){
    let arena = byId('arena');
    if (!arena){
      const scn = document.querySelector('a-scene') || document.body;
      arena = document.createElement('a-entity');
      arena.id = 'arena';
      arena.setAttribute('position','0 0 0');
      scn.appendChild(arena);
      console.warn('[SB] #arena missing → created fallback a-entity.');
    }
    return arena;
  }

  // ---------- SFX ----------
  const sfx = (p)=>{ const a=new Audio(p); a.preload='auto'; a.crossOrigin='anonymous'; return a; };
  const SFX = {
    slash: sfx(`${ASSET_BASE}/assets/sfx/slash.wav`),
    perfect: sfx(`${ASSET_BASE}/assets/sfx/perfect.wav`),
    miss: sfx(`${ASSET_BASE}/assets/sfx/miss.wav`),
    combo: sfx(`${ASSET_BASE}/assets/sfx/combo.wav`),
    hp_hit: sfx(`${ASSET_BASE}/assets/sfx/hp_hit.wav`),
    boss_roar: sfx(`${ASSET_BASE}/assets/sfx/boss_roar.wav`),
    tel_slash: sfx(`${ASSET_BASE}/assets/sfx/tel_slash.wav`),
    tel_shock: sfx(`${ASSET_BASE}/assets/sfx/tel_shock.wav`),
    tel_guard: sfx(`${ASSET_BASE}/assets/sfx/tel_guard.wav`),
    tel_dash: sfx(`${ASSET_BASE}/assets/sfx/tel_dash.wav`),
    enrage: sfx(`${ASSET_BASE}/assets/sfx/enrage.wav`),
    success: sfx(`${ASSET_BASE}/assets/sfx/success.wav`)
  };

  // ---------- Difficulty ----------
  function getDiffKey(){
    const q = getQuery('diff');
    const ls = localStorage.getItem('sb_diff');
    return (window.APP?.story?.difficulty) || q || ls || 'normal';
  }
  const DIFFS = {
    easy:   { hp:0.85, atkWin:1.15, dmgMul:0.9,  spawnInt:950, scoreMul:0.9,  title:'EASY'   },
    normal: { hp:1.00, atkWin:1.00, dmgMul:1.0,  spawnInt:900, scoreMul:1.0,  title:'NORMAL' },
    hard:   { hp:1.20, atkWin:0.90, dmgMul:1.1,  spawnInt:820, scoreMul:1.1,  title:'HARD'   },
    final:  { hp:1.35, atkWin:0.85, dmgMul:1.2,  spawnInt:780, scoreMul:1.2,  title:'FINAL'  }
  };
  let D = DIFFS.normal;
  const dur = (ms)=> ms * D.atkWin;

  // ---------- State ----------
  let running=false, paused=false;
  let timer=null, spawnTimer=null;
  let score=0, combo=0, maxCombo=0, hits=0, spawns=0, timeLeft=60;
  let CURRENT_BOSS=0;

  // ---------- HUD ----------
  function updateHUD(){
    byId('score') && (byId('score').textContent = Math.round(score*D.scoreMul));
    byId('combo') && (byId('combo').textContent = combo);
    byId('time')  && (byId('time').textContent  = timeLeft);
  }
  function setPhaseLabel(n){ const el=byId('phaseLabel'); if(el) el.textContent='Phase '+n; }
  function onComboChange(){
    byId('combo') && (byId('combo').textContent=combo);
    if(combo>0 && combo%10===0){ SFX.combo.play(); APPX.badge('Combo x'+(1+Math.floor(combo/10))); }
    if(combo>maxCombo) maxCombo=combo;
  }

  // ---------- Boss System ----------
  const BOSSES_ALL = [
    { id:'RazorFist',   title:'RAZORFIST',   baseHP:1000, color:'#ff3355',
      P1:['slash_cross','rapid_fist','guard_break'], P2:['shadow_dash','multi_slash','enrage_combo'] },
    { id:'AshOni',      title:'ASH ONI',     baseHP:1200, color:'#ffa133',
      P1:['shadow_dash','guard_break','rapid_fist'],   P2:['multi_slash','ground_shock','enrage_combo_fast'] },
    { id:'Nightblade',  title:'NIGHTBLADE',  baseHP:1400, color:'#7a5cff',
      P1:['blade_storm','laser_grid','guard_break'],   P2:['orb_spiral','blade_storm','rage_finale'] },
    { id:'VoidEmperor', title:'VOID EMPEROR',baseHP:1800, color:'#8cf5ff',
      P1:['mirror_slash','doom_rings','laser_grid'],   P2:['blade_storm','orb_spiral','void_finale'] }
  ];
  function makeRoster(diffKey){
    if(diffKey==='easy')   return [BOSSES_ALL[0]];
    if(diffKey==='normal') return [BOSSES_ALL[0], BOSSES_ALL[1]];
    if(diffKey==='hard')   return [BOSSES_ALL[0], BOSSES_ALL[1], BOSSES_ALL[2]];
    return BOSSES_ALL.slice();
  }
  let ROSTER = makeRoster('normal');

  const BOSS={active:false,hp:0,max:1,rage:false,phase:1,busy:false,name:'',color:'#ff3355',P1:[],P2:[],_patternStartedAt:0};

  function bossShowUI(show){ const bar=byId('bossBar'); if(bar) bar.style.display=show?'block':'none'; }
  function bossSetHP(h){
    const was=BOSS.hp;
    BOSS.hp = clamp(h,0,BOSS.max);
    const fill=byId('bossHPFill'); if(fill) fill.style.width=((BOSS.hp/BOSS.max)*100)+'%';
    if(BOSS.phase===1 && (BOSS.hp/BOSS.max)<=0.5) enterPhase2();
    if(BOSS.hp<=0 && was>0) onBossDefeated();
  }
  function bossDamage(amount){
    const final = Math.max(1, Math.round(amount*D.dmgMul));
    SFX.hp_hit.play(); bossSetHP(BOSS.hp - final);
  }

  function bossIntro(){
    const arena=ensureArena();
    const anchor=document.createElement('a-entity');
    anchor.id='bossAnchor';
    anchor.setAttribute('position','0 1.5 -3');
    // หัว + หน้ากากแบบง่าย
    const head=document.createElement('a-sphere'); head.setAttribute('radius','0.35'); head.setAttribute('color','#1a1a1a');
    const mask=document.createElement('a-box');    mask.setAttribute('width','0.55'); mask.setAttribute('height','0.45'); mask.setAttribute('depth','0.06'); mask.setAttribute('color',BOSS.color);
    mask.setAttribute('position','0 0 0.25');
    anchor.appendChild(head); anchor.appendChild(mask);
    arena.appendChild(anchor);

    bossShowUI(true); bossSetHP(BOSS.max);
    SFX.boss_roar.play();
    APPX.badge((BOSS.name||'BOSS')+' · '+(DIFFS[getDiffKey()]?.title||'NORMAL')); setPhaseLabel(1);
  }

  function bossSpawn(index=0){
    const cfg = ROSTER[index] || ROSTER[0];
    BOSS.active=true; BOSS.busy=false; BOSS.phase=1; BOSS.rage=false;
    BOSS.max=Math.round(cfg.baseHP*D.hp); BOSS.hp=BOSS.max;
    BOSS.name=cfg.title; BOSS.color=cfg.color; BOSS.P1=cfg.P1.slice(); BOSS.P2=cfg.P2.slice();
    bossIntro();
    after(800, bossLoop);
  }

  function enterPhase2(){
    BOSS.phase=2; setPhaseLabel(2);
    APPX.badge('Phase 2'); SFX.enrage.play();
  }

  function onBossDefeated(){
    BOSS.active=false;
    floatText('BOSS DEFEATED','#00ffa3', new THREE.Vector3(0,1.6,-2.3));
    score += 250; updateHUD();
    end(); // จบเกมเมื่อชนะบอสชุดสุดท้าย (ย่น logic เพื่อความชัด)
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
    ensureArena().appendChild(e); setTimeout(()=>safeRemove(e),820);
  }

  // ---------- Patterns (ย่อให้ครบ loop) ----------
  function finishAttack(){
    BOSS.busy=false;
    after(dur(520), bossLoop);
  }

  // ท่าพื้นฐาน: สร้าง object คลิกได้ แล้ว timeout = โดน
  function doSlashCross(done){
    BOSS.busy=true; SFX.tel_slash.play();
    const g=document.createElement('a-entity');
    g.classList.add('clickable','boss-attack');
    g.setAttribute('geometry','primitive: box; height:0.04; width:1.2; depth:0.04');
    g.setAttribute('material','color:#5de1ff;opacity:.95;transparent:true');
    g.setAttribute('rotation','0 0 -35'); g.setAttribute('position','0 1.4 -2.2');
    ensureArena().appendChild(g);
    let ok=false;
    g.addEventListener('click', ()=>{ ok=true; floatText('PARRY','#00ffa3', g.object3D.getWorldPosition(new THREE.Vector3())); bossDamage(20); safeRemove(g); done&&done(); });
    after(dur(700), ()=>{ if(g && g.parentNode){ safeRemove(g); if(!ok) playerHit(); } done&&done(); });
  }

  function spawnShockwave(done){
    SFX.tel_shock.play();
    const ring=document.createElement('a-ring');
    ring.classList.add('clickable','boss-attack');
    ring.setAttribute('position','0 1.2 -2.6');
    ring.setAttribute('radius-inner','0.05'); ring.setAttribute('radius-outer','0.07');
    ring.setAttribute('material','color:#ffd166;opacity:.95;shader:flat');
    ensureArena().appendChild(ring);
    let ok=false;
    ring.addEventListener('click', ()=>{ ok=true; floatText('BREAK','#00ffa3', ring.object3D.getWorldPosition(new THREE.Vector3())); bossDamage(14); safeRemove(ring); done&&done(); });
    after(dur(600), ()=>{ if(ring && ring.parentNode){ if(!ok) playerHit(); safeRemove(ring); } done&&done(); });
  }

  function doRapidFist(done){
    BOSS.busy=true; let c=0, need=(BOSS.phase===1?3:4);
    (function next(){
      spawnShockwave(()=>{ c++; if(c<need) after(dur(300),next); else done&&done(); });
    })();
  }

  function doGuardBreak(done){
    BOSS.busy=true; SFX.tel_guard.play();
    const core=document.createElement('a-sphere');
    core.classList.add('clickable','boss-attack');
    core.setAttribute('radius','0.2'); core.setAttribute('color','#ff6b6b');
    core.setAttribute('position','0 1.1 -2.2');
    ensureArena().appendChild(core);
    let ok=false;
    core.addEventListener('click', ()=>{ ok=true; floatText('BREAK','#ff9c6b', core.object3D.getWorldPosition(new THREE.Vector3())); bossDamage(16); safeRemove(core); done&&done(); });
    after(dur(760), ()=>{ if(core && core.parentNode){ if(!ok) playerHit(); safeRemove(core); } done&&done(); });
  }

  function doShadowDash(done){
    BOSS.busy=true; SFX.tel_dash.play();
    const L=document.createElement('a-box'), R=document.createElement('a-box');
    [L,R].forEach((b,i)=>{ b.classList.add('clickable','boss-attack'); b.setAttribute('width','0.5'); b.setAttribute('height','0.3'); b.setAttribute('depth','0.05');
      b.setAttribute('color', i? '#00ffa3':'#00d0ff'); b.setAttribute('position', (i? '0.9':'-0.9')+' 1.0 -2.0'); ensureArena().appendChild(b); });
    let ok=false; const hit=(box)=>{ if(ok) return; ok=true; floatText('DODGE','#9bd1ff', box.object3D.getWorldPosition(new THREE.Vector3())); bossDamage(12); cleanup(); };
    L.addEventListener('click', ()=>hit(L)); R.addEventListener('click', ()=>hit(R));
    after(dur(700), ()=>{ if(!ok) playerHit(); cleanup(); });
    function cleanup(){ [L,R].forEach(b=>b && b.parentNode && safeRemove(b)); done&&done(); }
  }

  // คอมโบแบบ flow-safe (ทุกขั้นส่ง callback ต่อ)
  function doMultiSlash(done){
    BOSS.busy=true;
    const seq=[-35,35]; let i=0;
    (function step(){
      SFX.tel_slash.play();
      const g=document.createElement('a-entity');
      g.classList.add('clickable','boss-attack');
      g.setAttribute('geometry','primitive: box; height:0.04; width:1.2; depth:0.04');
      g.setAttribute('material','color:#5de1ff;opacity:.95;transparent:true');
      g.setAttribute('rotation',`0 0 ${seq[i]}`); g.setAttribute('position','0 1.35 -2.2');
      ensureArena().appendChild(g);
      let ok=false;
      g.addEventListener('click', ()=>{ ok=true; floatText('PARRY','#00ffa3', g.object3D.getWorldPosition(new THREE.Vector3())); bossDamage(16); safeRemove(g); });
      after(dur(650), ()=>{
        if(g && g.parentNode){ if(!ok) playerHit(); safeRemove(g); }
        i++; if(i<seq.length) after(dur(120),step); else done&&done();
      });
    })();
  }

  function doEnrageCombo(done){
    BOSS.busy=true; SFX.enrage.play(); APPX.badge('ENRAGE!');
    const steps=[ (next)=>spawnShockwave(next), (next)=>doMultiSlash(next), (next)=>doGuardBreak(next) ];
    let j=0; (function run(){ if(j>=steps.length){ done&&done(); return; } steps[j++](run); })();
  }

  function doGroundShock(done){
    if(BOSS.phase===2){
      // เวอร์ชันเร่ง
      let c=0; const lanes=[-0.8,0,0.8], safe=lanes[Math.floor(Math.random()*lanes.length)];
      lanes.forEach(x=>{
        const r=document.createElement('a-ring'); r.classList.add('clickable','boss-attack');
        r.setAttribute('position',`${x} 1.15 -2.6`);
        r.setAttribute('radius-inner','0.05'); r.setAttribute('radius-outer','0.07');
        r.setAttribute('material',`color:${x===safe?'#00ffa3':'#ffd166'};opacity:.95;shader:flat`);
        ensureArena().appendChild(r);
        r.addEventListener('click', ()=>{ if(x!==safe) c++; floatText('BREAK', x===safe?'#00ffa3':'#ffd166', r.object3D.getWorldPosition(new THREE.Vector3())); safeRemove(r); });
        after(dur(700), ()=>safeRemove(r));
      });
      after(dur(760), ()=>{ if(c>=2) bossDamage(22); else playerHit(); done&&done(); });
    }else{
      // ปกติ
      let c=0; let need=5;
      (function next(){ spawnShockwave(()=>{ c++; if(c<need) after(dur(300),next); else done&&done(); }); })();
    }
  }

  // รวมเป็นตารางเรียกใช้ง่าย
  const PATTERNS = {
    'slash_cross': doSlashCross,
    'rapid_fist':  doRapidFist,
    'guard_break': doGuardBreak,
    'shadow_dash': doShadowDash,
    'multi_slash': doMultiSlash,
    'enrage_combo': doEnrageCombo,
    'ground_shock': doGroundShock,
    'enrage_combo_fast': doEnrageCombo // ใช้ชุดเดียวแต่เร็วขึ้นจาก phase
  };

  let pIndex=0, lastPattern='';
  function pickPattern(arr){
    let p = arr[pIndex % arr.length]; pIndex++;
    if(p===lastPattern){ p = arr[pIndex % arr.length]; pIndex++; }
    lastPattern = p; return p;
  }

  // Watchdog กัน pattern ค้าง
  function bossLoop(){
    if(!running || !BOSS.active || BOSS.busy) return;
    const arr = (BOSS.phase===1? BOSS.P1 : BOSS.P2);
    const p = pickPattern(arr);
    const fn = PATTERNS[p] || (cb=>{ cb&&cb(); });
    BOSS.busy = true; BOSS._patternStartedAt = performance.now();
    fn(()=>{ // ทุกท่าต้องเรียก done() → มารวม finishAttack ที่นี่
      finishAttack();
    });

    // ถ้า 5.2 วินาทีแล้วยังไม่จบ ให้จบเอง (กันค้าง)
    setTimeout(()=>{
      if(!running || !BOSS.active) return;
      const elapsed = performance.now() - (BOSS._patternStartedAt||0);
      if(BOSS.busy && elapsed>5200){
        console.warn('[SB] watchdog force finish');
        finishAttack();
      }
    }, 5300);
  }

  // ---------- Player feedback ----------
  function playerHit(){
    combo=0; onComboChange();
    score=Math.max(0,score-5); updateHUD();
    APPX.badge('HIT!');
    const scn=document.querySelector('a-scene'); scn?.classList?.add('shake-scene');
    setTimeout(()=>scn?.classList?.remove('shake-scene'), 240);
  }

  // ---------- Game flow ----------
  function reset(){
    score=0; combo=0; maxCombo=0; hits=0; spawns=0; timeLeft=60; updateHUD();
    byId('results') && (byId('results').style.display='none');
    bossShowUI(false);
    const a=ensureArena(); Array.from(a.children).forEach(c=>safeRemove(c));
    setPhaseLabel(1);
  }

  function start(){
    if(running) return;
    ensureArena();
    const key = getDiffKey(); D = DIFFS[key] || DIFFS.normal;
    localStorage.setItem('sb_diff', key);
    ROSTER = makeRoster(key);
    byId('rDiff') && (byId('rDiff').textContent = (DIFFS[key]?.title||'NORMAL'));

    reset(); running=true; paused=false;

    timer=setInterval(()=>{ timeLeft--; byId('time') && (byId('time').textContent=timeLeft); if(timeLeft<=0) end(); },1000);

    CURRENT_BOSS=0; after(dur(900), ()=>bossSpawn(CURRENT_BOSS));
  }

  function end(){
    running=false; paused=false;
    clearInterval(timer); clearInterval(spawnTimer);
    timeouts.forEach(clearTimeout); timeouts.clear();
    bossShowUI(false);

    const finalScore = Math.round(score*D.scoreMul);
    byId('rScore') && (byId('rScore').textContent=finalScore);
    byId('rMaxCombo') && (byId('rMaxCombo').textContent=maxCombo);
    byId('rAcc') && (byId('rAcc').textContent='—');
    byId('results') && (byId('results').style.display='flex');
    APPX.badge(APPX.t('results')+': '+finalScore);
  }

  function togglePause(){
    if(!running) return;
    paused=!paused;
    if(paused){ clearInterval(timer); APPX.badge('Paused'); }
    else{ timer=setInterval(()=>{ timeLeft--; byId('time') && (byId('time').textContent=timeLeft); if(timeLeft<=0) end(); },1000); APPX.badge('Resume'); }
  }

  // ---------- Wire UI ----------
  function wireUI(){
    byId('startBtn')?.addEventListener('click', start);
    byId('replayBtn')?.addEventListener('click', ()=>{ byId('results').style.display='none'; start(); });
    byId('backBtn')?.addEventListener('click', ()=>{ location.href = HUB_URL; });
    byId('pauseBtn')?.addEventListener('click', togglePause);
    byId('bankBtn')?.addEventListener('click', ()=>{ combo=0; onComboChange(); APPX.badge('Banked'); });

    // ช็อตคัตคีย์
    addEventListener('keydown', (ev)=>{
      if(ev.key==='p' || ev.key==='P') togglePause();
      if(ev.key===' ') { ev.preventDefault(); if(!running) start(); else togglePause(); }
    });
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', wireUI);
  }else{
    wireUI();
  }

  // ---------- Mouse/Touch Raycast (รอกล้องก่อน) ----------
  (function installPointerRaycast(){
    const sceneEl = document.querySelector('a-scene');
    if (!sceneEl) return;
    let tries=0;
    (function waitCam(){
      if(sceneEl.camera){ bind(); }
      else if(++tries<120){ requestAnimationFrame(waitCam); }
      else { console.warn('[SB] camera not ready; raycast disabled.'); }
    })();

    function bind(){
      const raycaster = new THREE.Raycaster();
      const mouse = new THREE.Vector2();
      function pick(clientX, clientY){
        if(!sceneEl.camera) return;
        mouse.x =  (clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(mouse, sceneEl.camera);

        const objects=[];
        document.querySelectorAll('.clickable').forEach(el=> el.object3D?.traverse(o=>objects.push(o)));
        const hits = raycaster.intersectObjects(objects, true);
        if(hits && hits.length){
          let o = hits[0].object; while(o && !o.el) o = o.parent;
          o?.el?.emit('click');
        }
      }
      window.addEventListener('mousedown', e=>pick(e.clientX, e.clientY), {passive:true});
      window.addEventListener('touchstart', e=>{ const t=e.touches?.[0]; if(t) pick(t.clientX, t.clientY); }, {passive:true});
    }
  })();

  // ---------- iOS Audio Unlock ----------
  (function unlockAudio(){
    let unlocked=false, Ctx=(window.AudioContext||window.webkitAudioContext);
    const ctx = Ctx? new Ctx():null;
    function resume(){
      if(unlocked||!ctx) return;
      ctx.resume?.(); unlocked=(ctx.state==='running');
    }
    ['touchstart','pointerdown','mousedown','keydown'].forEach(ev=>document.addEventListener(ev, resume, {once:true, passive:true}));
  })();

  // ---------- Tiny CSS shake (ถ้ายังไม่มี) ----------
  (function injectShake(){
    if(document.getElementById('sb-shake-style')) return;
    const css = `
      .shake-scene{ animation:sbshake .24s linear; }
      @keyframes sbshake{ 25%{transform:translateX(2px)} 50%{transform:translateX(-2px)} 75%{transform:translateX(2px)} }
    `;
    const s=document.createElement('style'); s.id='sb-shake-style'; s.textContent=css; document.head.appendChild(s);
  })();

})();
