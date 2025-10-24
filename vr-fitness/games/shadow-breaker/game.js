/* games/shadow-breaker/game.js
   Shadow Breaker (Classic feel kept)
   - Difficulty/Assist + Boss Names + Punch Pads + Coach Tips
   - ไม่หักคะแนนจากการ “ไม่กด”
   - Bomb = เมื่อ "กด" จะตัดคอมโบทันที (ไม่มีลดสกอร์)
   - ดาว 5 ระดับ (★ 0–5) ในสรุปผล
   - NEW:
     • Match length by difficulty (Easy=90s / Normal=85s / Hard=80s / Final=75s)
     • Tutorial (first play only) แบบสั้น: “ชก Pad เดโม 3 ครั้ง” แล้วเข้าเกม
     • 5s Count-down overlay ก่อนเริ่ม (ทุกครั้ง)
     • คงฟีเจอร์ก่อนหน้า: Early-Ease 15s, Cheer SFX, Micro-goals, VFX flash, Soft-end
*/
(function(){
  "use strict";

  // ------------------ Helpers & Globals ------------------
  const byId   = (id)=>document.getElementById(id);
  const clamp  = (n,a,b)=>Math.max(a,Math.min(b,n));
  const HUB_URL   = "https://supparang.github.io/webxr-health-mobile/vr-fitness/";
  const ASSET_BASE= (document.querySelector('meta[name="asset-base"]')?.content || '').replace(/\/+$/,'');

  // Feature switches (เปิดทั้งหมด)
  const FX = {
    pacingSmooth:    true,
    pointerHitBoost: true,
    sfxNormalize:    true,
    hudReadable:     true,
    gentleCurve:     true,
    fairScheduler:   true,
    comboBadges:     true,
    feverMode:       true,
    accessibility:   true,
    richResults:     true,
    coachTips:       true,
    safetyCleanup:   true
  };

  function safeRemove(el){ try{
    if(!el) return;
    if(el.parentNode) el.parentNode.removeChild(el);
    else if(el.remove) el.remove();
  }catch(_e){} }

  // ------------------ SFX ------------------
  const SFX = {
    slash:     new Audio(`${ASSET_BASE}/assets/sfx/slash.wav`),
    perfect:   new Audio(`${ASSET_BASE}/assets/sfx/perfect.wav`),
    miss:      new Audio(`${ASSET_BASE}/assets/sfx/miss.wav`),
    heavy:     new Audio(`${ASSET_BASE}/assets/sfx/heavy.wav`),
    combo:     new Audio(`${ASSET_BASE}/assets/sfx/combo.wav`),
    hp_hit:    new Audio(`${ASSET_BASE}/assets/sfx/hp_hit.wav`),
    boss_roar: new Audio(`${ASSET_BASE}/assets/sfx/boss_roar.wav`),
    tel_slash: new Audio(`${ASSET_BASE}/assets/sfx/tel_slash.wav`),
    tel_shock: new Audio(`${ASSET_BASE}/assets/sfx/tel_shock.wav`),
    success:   new Audio(`${ASSET_BASE}/assets/sfx/success.wav`),
    ui:        new Audio(`${ASSET_BASE}/assets/sfx/success.wav`),
    boom:      new Audio(`${ASSET_BASE}/assets/sfx/miss.wav`),
    cheer:     new Audio(`${ASSET_BASE}/assets/sfx/combo.wav`)
  };
  Object.values(SFX).forEach(a=>{ try{ a.preload='auto'; a.crossOrigin='anonymous'; }catch(_){} });

  const _sfxLastPlay = new Map();
  function playSfx(a, guardMs=120, vol=1){
    try{
      const now=performance.now();
      if(_sfxLastPlay.get(a) && now - _sfxLastPlay.get(a) < guardMs) return;
      _sfxLastPlay.set(a, now);
      a.volume = vol;
      a.currentTime=0; a.play();
    }catch(_){}
  }
  function sfxPlay(a, guard=120, vol=1){
    if(FX.sfxNormalize) playSfx(a,guard,vol);
    else try{ a.currentTime=0; a.play(); }catch(_){}
  }

  // ------------------ Difficulty & Assist ------------------
  function getQ(k){ return new URLSearchParams(location.search).get(k); }

  const DIFFS = {
    easy:   { bossHP:0.60, padSpawn:1.50, padLife:1.60, attackTime:1.45, feverAt:15, bombRate:0.00, delayScale:1.25, title:'EASY',   matchSec:90 },
    normal: { bossHP:1.00, padSpawn:1.00, padLife:1.00, attackTime:1.00, feverAt:25, bombRate:0.12, delayScale:1.00, title:'NORMAL', matchSec:85 },
    hard:   { bossHP:1.20, padSpawn:0.85, padLife:0.90, attackTime:0.90, feverAt:25, bombRate:0.18, delayScale:0.95, title:'HARD',   matchSec:80 },
    final:  { bossHP:1.35, padSpawn:0.78, padLife:0.85, attackTime:0.85, feverAt:25, bombRate:0.22, delayScale:0.90, title:'FINAL',  matchSec:75 }
  };
  let DIFF = DIFFS.normal;
  const ASSIST = (getQ('assist')==='1');

  function getDiffKey(){
    try{
      const q = getQ('diff');
      if (q && DIFFS[q]) return q;
      const ls = localStorage.getItem('sb_diff');
      if (ls && DIFFS[ls]) return ls;
    }catch(_){}
    return 'normal';
  }

  function applyDifficulty(){
    const key = getDiffKey();
    DIFF = DIFFS[key] || DIFFS.normal;
    padSpawnIntBase = Math.round(1500 * DIFF.padSpawn);
    padLifeBase     = Math.round(1200 * DIFF.padLife);
    const rDiff = byId('rDiff'); if (rDiff){ rDiff.textContent = (DIFF.title||'NORMAL'); }
  }

  function Tm(ms){ let t = ms * DIFF.attackTime; if (ASSIST) t *= 1.15; return Math.round(t); }
  function nextDelayScale(ms){ let t = ms * DIFF.delayScale; if (ASSIST) t *= 1.10; return Math.round(t); }

  // ------------------ State ------------------
  let running=false, paused=false, starting=false;
  let timer=null, padTimer=null, coachHypeTimer=null;
  let score=0, combo=0, maxCombo=0, hits=0, spawns=0, timeLeft=85;
  let startTimeMs=0, feverUntil=0, bossDown=false;
  let softEnding=false, softEndTO=null;

  // Micro-goals
  let goalActive=false, goalTO=null, goalEndsAt=0, lastGoalStart=0, goalTarget=0, goalType='points', goalBaselineScore=0, goalProgressHits=0;

  // Boss Roster
  const BOSSES = [
    { id:'RazorFist',   title:'RAZORFIST',    color:'#ff3355', baseHP:1000 },
    { id:'AshOni',      title:'ASH ONI',      color:'#ffa133', baseHP:1200 },
    { id:'Nightblade',  title:'NIGHTBLADE',   color:'#7a5cff', baseHP:1400 },
    { id:'VoidEmperor', title:'VOID EMPEROR', color:'#8cf5ff', baseHP:1800 }
  ];
  let bossIndex = 0;
  const BOSS = { active:false, busy:false, phase:1, hp:0, max:1000, name:'', color:'#ff3355' };

  // HUD tweaks
  function applyHudToggles(){
    if(FX.hudReadable || FX.accessibility){
      const hud = byId('hud');
      if(hud){ hud.style.font='600 15px system-ui'; hud.style.padding='8px 12px'; }
    }
    if(FX.accessibility){
      const bossBar=byId('bossBar'); if(bossBar){ bossBar.style.borderColor='#fff'; bossBar.style.background='#000'; }
    }
    if(!byId('microGoal')){
      const mg=document.createElement('div');
      mg.id='microGoal';
      Object.assign(mg.style,{ position:'fixed', left:'50%', transform:'translateX(-50%)',
        top:'10px', zIndex:9999, background:'rgba(8,14,22,.85)', color:'#e6f7ff', padding:'6px 10px',
        border:'1px solid #234', borderRadius:'10px', font:'700 12px system-ui', display:'none' });
      mg.innerHTML = '<span id="mgText"></span> <span id="mgTimer" style="opacity:.9"></span>';
      document.body.appendChild(mg);
    }
    // Countdown overlay
    if(!byId('sbCountdown')){
      const c=document.createElement('div'); c.id='sbCountdown';
      Object.assign(c.style,{ position:'fixed', inset:'0', display:'none', alignItems:'center', justifyContent:'center',
        background:'rgba(0,0,0,.55)', color:'#e6f7ff', font:'900 56px/1 system-ui', zIndex:99999, textShadow:'0 4px 18px rgba(0,0,0,.65)' });
      c.innerHTML = '<div id="sbCountdownNum">5</div>';
      document.body.appendChild(c);
    }
    // Tutorial overlay (first play)
    if(!byId('sbTut')){
      const t=document.createElement('div'); t.id='sbTut';
      Object.assign(t.style,{ position:'fixed', inset:'0', display:'none', alignItems:'center', justifyContent:'center',
        background:'rgba(0,0,0,.65)', color:'#e6f7ff', zIndex:99998 });
      t.innerHTML = `
        <div style="background:#0b1118;border:1px solid #213546;border-radius:14px;padding:16px 18px;max-width:720px;width:92vw">
          <h3 style="margin:0 0 8px;font:800 18px system-ui;color:#9bd1ff">Tutorial · Shadow Breaker</h3>
          <p style="margin:4px 0 10px;font:600 13px system-ui;color:#d9f3ff">
            แตะ/คลิก <b>เป้าเดโม</b> ให้ครบ <b>3 ครั้ง</b> เพื่อเริ่มเกมจริง
          </p>
          <div style="display:flex;gap:8px;justify-content:flex-end">
            <button id="sbTutSkip" style="padding:8px 12px;border-radius:10px;border:1px solid #2a465c;background:transparent;color:#a8cfe6;font:700 12px system-ui">Skip</button>
            <button id="sbTutStart" style="padding:8px 12px;border-radius:10px;border:0;background:#0e2233;color:#e6f7ff;font:700 12px system-ui">Start Practice</button>
          </div>
        </div>`;
      document.body.appendChild(t);
    }
  }

  function updateMicroGoalHUD(){
    const box=byId('microGoal'); if(!box) return;
    const t=byId('mgText'), tm=byId('mgTimer');
    if(!goalActive){ box.style.display='none'; return; }
    const remain = Math.max(0, Math.ceil((goalEndsAt - performance.now())/1000));
    if(t && tm){
      const txt = goalType==='points' ? `Micro-goal: เก็บให้ถึง ${goalTarget} คะแนน!` : `Micro-goal: ชกให้โดน ${goalTarget} ครั้ง!`;
      t.textContent = txt + ' ';
      tm.textContent = `(${remain}s)`;
    }
    box.style.display='block';
  }

  function scoringMul(){ return (FX.feverMode && performance.now()<feverUntil)? 1.5 : 1.0; }
  function onComboChanged(){
    if([10,20,30].includes(combo)){ sfxPlay(SFX.cheer,160,1); try{ window.APP?.badge?.('Crowd Cheer! Combo '+combo); }catch(_){} }
    if(FX.comboBadges && combo>0 && combo%10===0){ try{ window.APP?.badge?.('Combo x'+(combo/10)); }catch(_){ } sfxPlay(SFX.combo,150,0.9); }
    if(FX.feverMode && combo>= (DIFF.feverAt||25)){ const old=feverUntil; feverUntil = performance.now()+8000; if(performance.now()>old){ try{ window.APP?.badge?.('FEVER!'); }catch(_){ } } }
    if(combo>maxCombo) maxCombo=combo;
  }

  const _ignoreStreak = { ring:0, blade:0, core:0, pad:0 };
  function coachTipOnce(kind){
    if(!FX.coachTips) return;
    _ignoreStreak[kind] = (_ignoreStreak[kind]||0) + 1;
    if(_ignoreStreak[kind]===3){
      const msg = kind==='ring' ? 'โฟกัสตอนวงแหวนขยายเกือบสุด'
               : kind==='blade' ? 'ดาบ: แตะทันทีหลังสัญญาณ'
               : kind==='core' ? 'เพชร: แตะทันทีเพื่อคริติคอล'
               : 'Pad: แตะภายในเวลาที่กำหนด';
      let t=byId('coachTip');
      if(!t){
        t=document.createElement('div'); t.id='coachTip';
        Object.assign(t.style,{position:'fixed',left:'12px',bottom:'56px',zIndex:9999,
          background:'rgba(0,0,0,.65)',color:'#e6f7ff',padding:'6px 10px',borderRadius:'10px',font:'600 12px system-ui'});
        document.body.appendChild(t);
      }
      t.textContent='Coach: '+msg; t.style.opacity='1';
      setTimeout(()=>{ t.style.opacity='0'; },1800);
    }
  }
  function resetIgnore(kind){ _ignoreStreak[kind]=0; }

  function floatText(text, color, pos){
    const e=document.createElement('a-entity'), p=pos.clone(); p.y+=0.2;
    e.setAttribute('text',{value:text,color,align:'center',width:2.6});
    e.setAttribute('position',`${p.x} ${p.y} ${p.z}`);
    e.setAttribute('scale','0.001 0.001 0.001');
    e.setAttribute('animation__in',{property:'scale',to:'1 1 1',dur:90,easing:'easeOutQuad'});
    e.setAttribute('animation__rise',{property:'position',to:`${p.x} ${p.y+0.6} ${p.z}`,dur:600,easing:'easeOutQuad'});
    e.setAttribute('animation__fade',{property:'opacity',to:0,dur:480,delay:160,easing:'linear'});
    byId('arena').appendChild(e); setTimeout(()=>safeRemove(e),820);
  }

  function updateHUD(){ byId('score').textContent = Math.round(score); byId('combo').textContent = combo; byId('time').textContent  = timeLeft; updateMicroGoalHUD(); }
  function setPhase(n){ const el=byId('phaseLabel'); if(el) el.textContent='Phase '+n; }

  // ---------- Boss Anchor: singleton ----------
  function killAllBossAnchors(){ document.querySelectorAll('#bossAnchor').forEach(n=>{ try{ n.remove(); }catch(_){}}); }
  function killAllBossNames(){ document.querySelectorAll('#bossNameLabel, .boss-name').forEach(n=>{ try{ n.remove(); }catch(_){}}); }
  function getBossAnchor(){
    let a = document.getElementById('bossAnchor');
    if (a) return a;
    killAllBossAnchors(); killAllBossNames();
    const arena = byId('arena');
    a = document.createElement('a-entity');
    a.id='bossAnchor'; a.setAttribute('position','0 1.5 -3');
    const head=document.createElement('a-sphere'); head.setAttribute('radius','0.35'); head.setAttribute('color','#1a1a1a'); head.setAttribute('position','0 0 0');
    const mask=document.createElement('a-box');   mask.setAttribute('depth','0.06');   mask.setAttribute('width','0.55');   mask.setAttribute('height','0.45');   mask.setAttribute('color', BOSS.color || '#ff3355');   mask.setAttribute('position','0 0 0.25');
    a.appendChild(head); a.appendChild(mask); arena.appendChild(a);
    return a;
  }
  function setBossNameLabel(text){
    const a = getBossAnchor();
    killAllBossNames(); a.querySelectorAll('.boss-name').forEach(n=>{ try{ n.remove(); }catch(_){ } });
    const nameLabel = document.createElement('a-entity');
    nameLabel.id='bossNameLabel'; nameLabel.classList.add('boss-name');
    nameLabel.setAttribute('text',{value:(text||'BOSS'), color:'#e6f7ff', align:'center', width:3.2});
    nameLabel.setAttribute('position','0 0.62 0.1');
    a.appendChild(nameLabel);
    const rBoss = byId('rBoss'); if(rBoss) rBoss.textContent = text || 'BOSS';
  }

  // ------------------ Boss UI ------------------
  function bossShowUI(s){ const bar=byId('bossBar'); if(bar) bar.style.display=s?'block':'none'; }
  function bossSetHP(v){
    const was=BOSS.hp; BOSS.hp=clamp(v,0,BOSS.max);
    const fill=byId('bossHPFill'); if(fill) fill.style.width=((BOSS.hp/BOSS.max)*100)+'%';
    if(BOSS.phase===1 && BOSS.hp<=BOSS.max*0.5) enterPhase2();
    if(BOSS.hp<=0 && was>0) onBossDefeated();
  }
  function bossDamage(amount, pos){
    const final = Math.max(1, Math.round(amount * scoringMul()));
    sfxPlay(SFX.hp_hit,90,0.95);
    bossSetHP(BOSS.hp - final);
    // VFX flash 120ms บนหน้ากาก
    try{
      const a=getBossAnchor(); const mask=a?.querySelector('a-box');
      if(mask){
        const orig=mask.getAttribute('material')||'';
        mask.setAttribute('material', (orig?orig+'; ':'')+'emissive:#ff4444; emissiveIntensity:0.85');
        setTimeout(()=>{ mask.setAttribute('material', orig); }, 120);
      }
    }catch(_){}
    if(pos) floatText('-'+final,'#ffccdd',pos);
  }
  function bossIntro(){
    const a = getBossAnchor();
    const mask = a.querySelector('a-box'); if(mask) mask.setAttribute('color', BOSS.color || '#ff3355');
    setBossNameLabel(BOSS.name || 'BOSS');
    sfxPlay(SFX.boss_roar,200,0.9);
    bossShowUI(true); bossSetHP(BOSS.max); setPhase(1);
  }

  // ------------------ Boss patterns ------------------
  let _lastPattern = '';
  function pickPattern(){
    const pool=['ring','blade','core'];
    if(FX.fairScheduler && _lastPattern){
      const alt=pool.filter(p=>p!==_lastPattern);
      const p=alt[Math.floor(Math.random()*alt.length)];
      _lastPattern=p; return p;
    }
    const p=pool[Math.floor(Math.random()*pool.length)];
    _lastPattern=p; return p;
  }

  window.__sbStartT = 0;
  function nextDelay(base){
    if(!FX.gentleCurve) return nextDelayScale(base);
    const sec=(performance.now()-window.__sbStartT)/1000;
    const ease=Math.min(1, sec/45);
    const scaled=base*(1-0.2*ease);
    return Math.max(220, nextDelayScale(Math.round(scaled)));
  }

  function scheduleNext(){
    if(!running || !BOSS.active || BOSS.busy) return;
    BOSS.busy=true;
    const which = pickPattern();
    if(which==='ring') doRing();
    else if(which==='blade') doBlade();
    else doCore();
  }
  function doneAttack(delay=520){
    BOSS.busy=false;
    if(!running) return;
    window.__sbNextTO = setTimeout(scheduleNext, nextDelay(delay));
  }

  function doRing(){
    sfxPlay(SFX.tel_shock,120,1.0);
    const r=document.createElement('a-ring'); r.classList.add('clickable','boss-attack');
    r.setAttribute('position','0 1.2 -2.6'); r.setAttribute('radius-inner','0.05'); r.setAttribute('radius-outer','0.07');
    r.setAttribute('material','color:#ffd166;opacity:.95;shader:flat');
    if(FX.pointerHitBoost || ASSIST){ r.setAttribute('radius-outer', (0.07+0.04).toFixed(2)); }
    byId('arena').appendChild(r);

    let hit=false;
    const start=performance.now(), T=Tm(720);
    const step=()=>{ if(!r.parentNode || !running) return;
      const t=(performance.now()-start)/T, base=0.07+t*0.95;
      r.setAttribute('radius-inner', Math.max(0.01, base-0.02));
      r.setAttribute('radius-outer', base);
      if(t>=1){ if(!hit){ coachTipOnce('ring'); } safeRemove(r); doneAttack(nextDelayScale(460)); return; }
      window.__sbRaf = requestAnimationFrame(step);
    };
    r.addEventListener('click', ()=>{
      if(hit) return; hit=true;
      const p=r.object3D.getWorldPosition(new THREE.Vector3>());
      floatText('BREAK','#00ffa3',p);
      combo++; onComboChanged(); hits++; score+=Math.round(14*scoringMul()); updateHUD();
      resetIgnore('ring');
      bossDamage(20,p);
      safeRemove(r); doneAttack(nextDelayScale(420));
    });
    step();
  }

  function doBlade(){
    sfxPlay(SFX.tel_slash,120,1.0);
    const g=document.createElement('a-entity'); g.classList.add('clickable','boss-attack');
    g.setAttribute('geometry','primitive: box; height: 0.04; width: 1.2; depth: 0.04');
    g.setAttribute('material','color:#5de1ff;opacity:.95;transparent:true');
    g.setAttribute('rotation',`0 0 ${-35+Math.round(Math.random()*70)}`);
    g.setAttribute('position','0 1.35 -2.2');
    byId('arena').appendChild(g);
    let ok=false;
    const T=Tm(560); const t0=performance.now();
    const timer=()=>{
      if(!g.parentNode || !running) return;
      if(performance.now()-t0 >= T){
        if(!ok){ coachTipOnce('blade'); } safeRemove(g); doneAttack(nextDelayScale(520)); return;
      }
      window.__sbRaf = requestAnimationFrame(timer);
    };
    g.addEventListener('click', ()=>{
      if(ok) return; ok=true;
      const p=g.object3D.getWorldPosition(new THREE.Vector3>());
      floatText('PARRY','#00d0ff',p);
      combo++; onComboChanged(); hits++; score+=Math.round(12*scoringMul()); updateHUD();
      resetIgnore('blade');
      bossDamage(16,p);
      safeRemove(g); doneAttack(nextDelayScale(460));
    });
    timer();
  }

  function doCore(){
    const g=document.createElement('a-icosahedron'); g.classList.add('clickable','boss-attack');
    g.setAttribute('position','0 1.6 -2.4'); g.setAttribute('radius','0.18'); g.setAttribute('color','#00ffa3');
    byId('arena').appendChild(g);
    let grabbed=false;
    const T=Tm(700); const t0=performance.now();
    const timer=()=>{
      if(!g.parentNode || !running) return;
      if(performance.now()-t0 >= T){
        if(!grabbed){ coachTipOnce('core'); } safeRemove(g); doneAttack(nextDelayScale(480)); return;
      }
      window.__sbRaf = requestAnimationFrame(timer);
    };
    g.addEventListener('click', ()=>{
      if(grabbed) return; grabbed=true;
      const p=g.object3D.getWorldPosition(new THREE.Vector3>());
      floatText('CRITICAL!','#00ffa3',p);
      sfxPlay(SFX.success,130,1.0);
      combo++; onComboChanged(); hits++; score+=Math.round(22*scoringMul()); updateHUD();
      resetIgnore('core');
      bossDamage(28,p);
      safeRemove(g); doneAttack(nextDelayScale(520));
    });
    timer();
  }

  // ------------------ Punch Pads ------------------
  const PAD_SPEC = [
    { id:'circle',   color:'#00d0ff', shape:'circle',   seg:32,   radius:0.22,   score:10,  dmg:10 },
    { id:'triangle', color:'#ffd166', shape:'circle',   seg:3,    radius:0.26,   score:12,  dmg:12 },
    { id:'square',   color:'#ff6b6b', shape:'box',      size:0.4,               score:12,  dmg:12 },
    { id:'pentagon', color:'#a899ff', shape:'circle',   seg:5,    radius:0.26,   score:14,  dmg:14 },
    { id:'hexagon',  color:'#00ffa3', shape:'circle',   seg:6,    radius:0.26,   score:16,  dmg:14 },
    { id:'diamond',  color:'#c0ffee', shape:'icosa',    r:0.19,                score:22,  dmg:18 },
    { id:'bomb',     color:'#222222', shape:'sphere',   r:0.20,  emissive:'#ff4444', score:0,  dmg:0, bomb:true }
  ];
  let padSpawnIntBase = 1500;
  let padLifeBase     = 1200;

  function isEarly15s(){ return (performance.now() - startTimeMs) < 15000; }

  function nextPadInterval(){
    let base = padSpawnIntBase;
    if(isEarly15s()){ base = Math.round(base * (1.10 + Math.random()*0.05)); }
    if(!FX.gentleCurve) return base;
    const sec=(performance.now()-window.__sbStartT)/1000;
    const ease=Math.min(1, sec/40);
    return Math.max(700, Math.round(base*(1-0.35*ease)));
  }
  function nextPadLife(){
    if(!FX.gentleCurve) return padLifeBase;
    const sec=(performance.now()-window.__sbStartT)/1000;
    const ease=Math.min(1, sec/40);
    return Math.max(800, Math.round(padLifeBase*(1-0.2*ease)));
  }

  function spawnPad(){
    if(!running || starting) return;

    let pool;
    if (DIFF === DIFFS.easy) pool = PAD_SPEC.filter(p=>!p.bomb);
    else {
      const includeBomb = Math.random() < (DIFF.bombRate||0);
      pool = includeBomb ? PAD_SPEC : PAD_SPEC.filter(p=>!p.bomb);
    }
    const spec = pool[Math.floor(Math.random()*pool.length)];

    const x = (Math.random()*2.2 - 1.1).toFixed(2);
    const y = (Math.random()*0.7 + 1.1).toFixed(2);
    const z = -2.3;

    let el;
    if(spec.shape==='box'){
      el = document.createElement('a-box'); const s = spec.size || 0.36; el.setAttribute('width', s); el.setAttribute('height', s); el.setAttribute('depth', s);
    }else if(spec.shape==='icosa'){
      el = document.createElement('a-icosahedron'); el.setAttribute('radius', spec.r || 0.18);
    }else if(spec.shape==='sphere'){
      el = document.createElement('a-sphere'); el.setAttribute('radius', spec.r || 0.20);
    }else{ el = document.createElement('a-entity'); el.setAttribute('geometry', `primitive: circle; radius: ${spec.radius||0.24}; segments: ${spec.seg||32}`); }

    el.classList.add('clickable','sb-pad');
    el.setAttribute('position', `${x} ${y} ${z}`);
    const mat = spec.bomb
      ? `color:${spec.color}; metalness:0.2; roughness:0.5; emissive:${spec.emissive||'#aa0000'}; emissiveIntensity:0.6;`
      : `color:${spec.color}; metalness:0.1; roughness:0.4;`;
    el.setAttribute('material', mat + ' opacity:0.95; transparent:true');

    if(FX.pointerHitBoost || ASSIST){
      const collider = document.createElement('a-entity');
      collider.setAttribute('geometry','primitive: circle; radius: 0.34; segments: 24');
      collider.setAttribute('material','color:#ffffff; opacity:0.001; transparent:true');
      collider.classList.add('clickable');
      el.appendChild(collider);
      collider.addEventListener('click', ()=> el.emit('click'));
      collider.addEventListener('mousedown', ()=> el.emit('click'));
    }

    byId('arena').appendChild(el);

    let clicked=false;
    const killT = setTimeout(()=>{ if(clicked) return; coachTipOnce('pad'); safeRemove(el); }, nextPadLife());

    const onClick = ()=>{
      if(clicked) return; clicked=true;
      clearTimeout(killT);
      const p = el.object3D.getWorldPosition(new THREE.Vector3());
      safeRemove(el);

      if(spec.bomb){
        combo = 0; onComboChanged(); updateHUD();
        floatText('BOMB! Combo reset','#ff7766',p);
        sfxPlay(SFX.boom,120,1.0);
        return;
      }

      hits++; combo++; onComboChanged();
      const add = Math.round((spec.score||10) * scoringMul());
      score += add;
      if(goalActive && goalType==='hits') goalProgressHits++;
      updateHUD();
      floatText('HIT +'+add,(spec.color||'#00d0ff'),p);
      sfxPlay(SFX.slash,120,1.0);
      bossDamage(spec.dmg||10, p);
      resetIgnore('pad');
    };
    el.addEventListener('click', onClick);
    el.addEventListener('mousedown', onClick);
  }

  // ------------------ Boss flow ------------------
  function enterPhase2(){ BOSS.phase=2; setPhase(2); try{ window.APP?.badge?.('Phase 2'); }catch(_){ } }

  function onBossDefeated(){
    bossDown = true;
    BOSS.active=false; floatText('BOSS DEFEATED','#00ffa3', new THREE.Vector3(0,1.6,-2.4));
    score+=250; updateHUD();
    bossIndex++;
    if (bossIndex < BOSSES.length){
      setTimeout(()=>spawnBossByIndex(bossIndex), 900);
    } else {
      requestEnd();
    }
  }

  function spawnBossByIndex(i){
    if (i >= BOSSES.length) { requestEnd(); return; }
    const cfg = BOSSES[i];
    BOSS.active=true; BOSS.busy=false; BOSS.phase=1;
    BOSS.name  = cfg.title;
    BOSS.color = cfg.color;
    BOSS.max   = Math.round(cfg.baseHP * DIFF.bossHP);
    BOSS.hp    = BOSS.max;
    bossIntro();
    setTimeout(scheduleNext, 700);
  }

  // ------------------ Tutorial-first-play (สั้น) ------------------
  function hasSeenTutorial(){ try{ return !!localStorage.getItem('sb_tut_done'); }catch(_){ return false; } }
  function markTutorialDone(){ try{ localStorage.setItem('sb_tut_done','1'); }catch(_){} }

  function runTutorialThenCountdown(){
    const tut=byId('sbTut'); if(!tut){ doCountdownAndPlay(); return; }
    tut.style.display='flex';
    const arena = byId('arena');

    let hitCount = 0, demoEl=null;
    function spawnDemoPad(){
      safeRemove(demoEl);
      demoEl = document.createElement('a-entity');
      demoEl.classList.add('clickable');
      demoEl.setAttribute('geometry','primitive: circle; radius: 0.28; segments: 24');
      demoEl.setAttribute('material','color:#00ffa3; opacity:0.95; transparent:true;');
      demoEl.setAttribute('position','0 1.3 -2.2');
      arena.appendChild(demoEl);
      const collider=document.createElement('a-entity');
      collider.setAttribute('geometry','primitive: circle; radius: 0.36; segments: 24');
      collider.setAttribute('material','color:#fff; opacity:0.001; transparent:true');
      collider.classList.add('clickable');
      demoEl.appendChild(collider);
      const onHit=()=>{
        hitCount++;
        floatText('OK','#00ffa3', demoEl.object3D.getWorldPosition(new THREE.Vector3()));
        sfxPlay(SFX.success,120,1);
        safeRemove(demoEl);
        if(hitCount>=3){ finish(); } else { setTimeout(spawnDemoPad, 300); }
      };
      demoEl.addEventListener('click', onHit);
      demoEl.addEventListener('mousedown', onHit);
      collider.addEventListener('click', ()=> demoEl.emit('click'));
      collider.addEventListener('mousedown', ()=> demoEl.emit('click'));
    }

    function finish(){
      markTutorialDone();
      tut.style.display='none';
      doCountdownAndPlay();
    }

    byId('sbTutStart').onclick = ()=>{ spawnDemoPad(); };
    byId('sbTutSkip').onclick  = ()=>{ markTutorialDone(); tut.style.display='none'; doCountdownAndPlay(); };
  }

  // ------------------ 5s Count-down ------------------
  function doCountdownAndPlay(){
    const cd=byId('sbCountdown'), num=byId('sbCountdownNum');
    if(!cd || !num){ actuallyStartPlay(); return; }
    starting=true;
    cd.style.display='flex';
    let n=5; num.textContent = n;
    const tick=()=>{
      if(n<=0){ cd.style.display='none'; starting=false; actuallyStartPlay(); return; }
      num.textContent = n;
      sfxPlay(SFX.ui,140,1);
      n--;
      setTimeout(tick, 1000);
    };
    setTimeout(tick, 0);
  }

  // ------------------ Game flow ------------------
  function clearArena(){ const a=byId('arena'); Array.from(a.children).forEach(c=>safeRemove(c)); }

  function start(){
    if(running || starting) return;
    applyDifficulty();
    // เซ็ตเวลาแมตช์ตามโหมด
    timeLeft = clamp(DIFF.matchSec|0, 60, 120); // safety
    updateHUD();

    // Tutorial-first-play?
    if(!hasSeenTutorial()){ runTutorialThenCountdown(); }
    else { doCountdownAndPlay(); }
  }

  function actuallyStartPlay(){
    if(running) return;
    running=true; paused=false;
    window.__sbStartT = performance.now();
    startTimeMs = performance.now();
    score=0; combo=0; maxCombo=0; hits=0; spawns=0; feverUntil=0; bossDown=false;
    softEnding=false; clearTimeout(softEndTO);
    goalActive=false; clearTimeout(goalTO);

    byId('results').style.display='none';
    updateHUD(); bossShowUI(false); clearArena();

    bossIndex = 0; // เริ่มที่บอสตัวแรก
    spawnBossByIndex(bossIndex);

    clearInterval(timer);
    timer = setInterval(()=>{
      if(!running) return;
      timeLeft--; byId('time').textContent=timeLeft;
      trySpawnMicroGoal(); updateHUD();
      if(timeLeft<=0) requestEnd();
    },1000);

    const tickSpawn = ()=>{
      if(!running || paused) return;
      spawnPad();
      const next = nextPadInterval();
      padTimer = setTimeout(tickSpawn, next);
    };
    clearTimeout(padTimer); tickSpawn();

    clearInterval(coachHypeTimer);
    coachHypeTimer = setInterval(()=>{
      if(!running) return;
      if(Math.random()<0.5){
        const m = ['สุดยอด!', 'ดีมาก!', 'จังหวะมาแล้ว!', 'ต่อเนื่องไว้!', 'เก่งมาก!'][Math.floor(Math.random()*5)];
        let t=byId('coachTip');
        if(!t){
          t=document.createElement('div'); t.id='coachTip';
          Object.assign(t.style,{position:'fixed',left:'12px',bottom:'56px',zIndex:9999,
            background:'rgba(0,0,0,.65)',color:'#e6f7ff',padding:'6px 10px',borderRadius:'10px',font:'600 12px system-ui'});
          document.body.appendChild(t);
        }
        t.textContent='Coach: '+m; t.style.opacity='1'; setTimeout(()=>{ t.style.opacity='0'; },1500);
      }
    }, 12000);
  }

  // Micro-goals
  function trySpawnMicroGoal(){
    if(goalActive) return;
    const elapsed = (performance.now()-startTimeMs)/1000;
    if(elapsed < 15) return;
    if(performance.now() - lastGoalStart < 28_000) return;

    goalActive=true;
    lastGoalStart = performance.now();
    goalEndsAt    = performance.now() + 10_000;
    goalType = (Math.random()<0.55) ? 'points' : 'hits';
    if(goalType==='points'){
      const base = (getDiffKey()==='easy') ? 40 : 60;
      goalTarget = base + Math.floor(Math.random()*25);
      goalBaselineScore = score;
    }else{
      goalTarget = (getDiffKey()==='easy') ? 4 : 6;
      goalProgressHits = 0;
    }
    updateMicroGoalHUD();

    clearTimeout(goalTO);
    goalTO = setTimeout(()=>{
      let success=false;
      if(goalType==='points'){ success = (score - goalBaselineScore) >= goalTarget; }
      else{ success = (goalProgressHits >= goalTarget); }
      const box=byId('microGoal');
      if(success){ score += 50; updateHUD(); if(box){ box.style.background='rgba(7,32,20,.9)'; box.style.borderColor='#2a5'; } sfxPlay(SFX.success,150,1); }
      else{ if(box){ box.style.background='rgba(32,10,10,.9)'; box.style.borderColor='#522'; } sfxPlay(SFX.miss,150,1); }
      setTimeout(()=>{ goalActive=false; if(box){ box.style.display='none'; box.style.background='rgba(8,14,22,.85)'; box.style.borderColor='#234'; } }, 900);
    }, 10_000);
  }

  // ดาว 5 ระดับ
  function computeStars(){
    let s = 0;
    if(bossDown) s += 1;
    if(maxCombo >= 15) s += 1;
    if(maxCombo >= 30) s += 1;
    if(score >= 300) s += 1;
    if(timeLeft >= 10) s += 1;
    return clamp(s,0,5);
  }

  // Soft-end
  function requestEnd(){
    if(!running) return;
    if(softEnding) return;
    softEnding=true;
    try{ clearTimeout(padTimer); }catch(_){}
    try{ clearTimeout(window.__sbNextTO); }catch(_){}
    try{ cancelAnimationFrame(window.__sbRaf); }catch(_){}
    softEndTO = setTimeout(finalizeEnd, 1000);
  }

  function finalizeEnd(){
    if(!running) return;
    running=false; paused=false;
    try{ clearInterval(timer); }catch(_){}
    try{ clearTimeout(padTimer); }catch(_){}
    try{ clearTimeout(window.__sbNextTO); }catch(_){}
    try{ cancelAnimationFrame(window.__sbRaf); }catch(_){}
    try{ clearInterval(coachHypeTimer); }catch(_){}
    bossShowUI(false);

    const acc = maxCombo>0 ? Math.min(100, Math.round((hits/(hits+_ignoreStreak.ring+_ignoreStreak.blade+_ignoreStreak.core+_ignoreStreak.pad+1))*100)) : 0;
    byId('rScore').textContent = Math.round(score);
    byId('rMaxCombo').textContent = maxCombo;
    byId('rAcc').textContent = acc + '%';

    const stars = computeStars();
    const rStars = byId('rStars'); if(rStars){ rStars.textContent = '★'.repeat(stars) + '☆'.repeat(5 - stars); }
    const rBoss = byId('rBoss');  if(rBoss) rBoss.textContent = BOSS.name || '—';
    const rDiff = byId('rDiff');  if(rDiff) rDiff.textContent = (DIFF.title || 'NORMAL');

    if(FX.richResults){
      let extra = byId('rExtra');
      if(!extra){ extra = document.createElement('div'); extra.id='rExtra'; extra.style.marginTop='8px'; byId('results').querySelector('.card')?.appendChild(extra); }
      extra.innerHTML = `Time Left: <b>${Math.max(0,timeLeft)}s</b>`;
    }

    byId('results').style.display='flex';
    sfxPlay(SFX.ui,140,1);
  }

  function bankNow(){ const add=Math.floor(combo*3); score+=add; combo=0; updateHUD(); try{ window.APP?.badge?.('Bank +'+add); }catch(_){ } }

  // ------------------ Mouse raycast fallback ------------------
  (function pointerRaycast(){
    const sceneEl = document.querySelector('a-scene'); if(!sceneEl) return;
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    function pick(clientX, clientY){
      const cam = sceneEl.camera; if(!cam) return;
      mouse.x =  (clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(clientY / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera(mouse, cam);
      if(FX.pointerHitBoost){ raycaster.far = 100; }
      const clickable = Array.from(document.querySelectorAll('.clickable')).map(el=>el.object3D).filter(Boolean);
      const objs=[]; clickable.forEach(o=>o.traverse(c=>objs.push(c)));
      const hitsR = raycaster.intersectObjects(objs,true);
      if(hitsR && hitsR.length){
        let obj=hitsR[0].object; while(obj && !obj.el) obj=obj.parent;
        if(obj && obj.el){ obj.el.emit('click'); }
      }
    }
    window.addEventListener('mousedown', e=>pick(e.clientX,e.clientY), {passive:true});
    window.addEventListener('touchstart', e=>{ const t=e.touches?.[0]; if(t) pick(t.clientX,t.clientY); }, {passive:true});
  })();

  // ------------------ Wire Buttons ------------------
  function wire(){
    byId('startBtn')?.addEventListener('click', start);
    byId('replayBtn')?.addEventListener('click', ()=>{ byId('results').style.display='none'; start(); });
    byId('pauseBtn')?.addEventListener('click', ()=>{ if(!running) return; paused=!paused;
      if(paused){ clearInterval(timer); try{ cancelAnimationFrame(window.__sbRaf); }catch(_){}
        try{ clearTimeout(padTimer); }catch(_){} try{ window.APP?.badge?.('Paused'); }catch(_){}
      }else{
        timer = setInterval(()=>{ timeLeft--; byId('time').textContent=timeLeft; trySpawnMicroGoal(); updateHUD(); if(timeLeft<=0) requestEnd(); },1000);
        const next = nextPadInterval();
        padTimer = setTimeout(function tick(){ if(!running||paused) return; spawnPad(); padTimer=setTimeout(tick,nextPadInterval()); }, next);
        try{ window.APP?.badge?.('Resume'); }catch(_){}
      }
    });
    byId('bankBtn')?.addEventListener('click', bankNow);
    byId('backBtn')?.addEventListener('click', ()=>{ location.href = HUB_URL; });
    byId('enterVRBtn')?.addEventListener('click', ()=>{ try{ document.querySelector('a-scene')?.enterVR?.(); }catch(_){} });

    addEventListener('keydown', (ev)=>{
      if(ev.code==='Space'){ ev.preventDefault(); if(!running && !starting) start(); else if(running) { const e=new Event('click'); byId('pauseBtn')?.dispatchEvent(e); } }
      if(ev.code==='Escape'){ requestEnd(); }
      if(ev.key==='`'){ const d=byId('debug'); if(d) d.style.display = d.style.display==='none'?'block':'none'; }
    });
  }

  function boot(){ wire(); updateHUD(); applyHudToggles(); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  if(FX.safetyCleanup){
    window.addEventListener('beforeunload', ()=>{
      try{ clearInterval(timer); }catch(_){}
      try{ clearTimeout(padTimer); }catch(_){}
      try{ clearTimeout(window.__sbNextTO); }catch(_){}
      try{ cancelAnimationFrame(window.__sbRaf); }catch(_){}
      try{ clearInterval(coachHypeTimer); }catch(_){}
      try{ clearTimeout(softEndTO); }catch(_){}
      try{ clearTimeout(goalTO); }catch(_){}
    });
  }

  /* ===== How to Play (Quick) ===== */
  ;(function installHowTo(){
    const css = `
    #sbHelpBtn{position:fixed;left:160px;bottom:12px;z-index:9999;padding:8px 12px;border-radius:10px;border:0;background:#123047;color:#e6f7ff;font:600 12px system-ui;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.3)}
    #sbHelpBtn:hover{filter:brightness(1.1)}
    #sbHowTo{position:fixed;inset:0;z-index:99998;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.65)}
    #sbHowTo .card{width:min(820px,92vw);max-height:86vh;overflow:auto;background:#0b1118;border:1px solid #213546;border-radius:14px;padding:16px 18px;color:#e6f7ff;box-shadow:0 10px 30px rgba(0,0,0,.45)}
    #sbHowTo h2{margin:0 0 8px;font:800 18px/1.2 system-ui;letter-spacing:.3px}
    #sbHowTo p, #sbHowTo li{font:500 13px/1.5 system-ui;color:#d9f3ff}
    #sbHowTo .cta{display:flex;gap:8px;justify-content:flex-end;margin-top:12px}
    #sbHowTo .btn{padding:8px 12px;border-radius:10px;border:0;font:700 12px system-ui;cursor:pointer}
    #sbHowTo .btn.primary{background:#0e2233;color:#e6f7ff}
    #sbHowTo .btn.ghost{background:transparent;color:#a8cfe6;border:1px solid #2a465c}
    @media (max-width:720px){ #sbHelpBtn{left:12px;bottom:54px} }
    `;
    const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);

    const btn = document.createElement('button');
    btn.id = 'sbHelpBtn'; btn.type='button'; btn.textContent='❓ How to Play';
    document.body.appendChild(btn);

    const wrap = document.createElement('section');
    wrap.id = 'sbHowTo';
    wrap.innerHTML = `
      <div class="card" role="dialog" aria-labelledby="sbHowToTitle" aria-modal="true">
        <h2 id="sbHowToTitle">วิธีการเล่น · Shadow Breaker</h2>
        <ul>
          <li>ชกเป้าหลากรูปทรงเพื่อลด HP บอส • เลี่ยง Bomb (รีเซ็ตคอมโบ)</li>
          <li>Space = Start/Pause, Esc = End, B = Bank</li>
          <li>คอมโบ 25+ = Fever x1.5 · มี Cheer SFX ที่ 10/20/30</li>
        </ul>
        <div class="cta">
          <button class="btn ghost" id="sbHowToClose">Close</button>
          <button class="btn primary" id="sbHowToStart">Start Now</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);

    function openHowTo(){ wrap.style.display = 'flex'; }
    function closeHowTo(){ wrap.style.display = 'none'; }

    btn.addEventListener('click', openHowTo);
    wrap.addEventListener('click', (e)=>{ if(e.target===wrap) closeHowTo(); });
    wrap.querySelector('#sbHowToClose').addEventListener('click', closeHowTo);
    wrap.querySelector('#sbHowToStart').addEventListener('click', ()=>{ closeHowTo(); byId('startBtn')?.click(); });

    try{
      const KEY='sb_seenHowTo_v1';
      if(!localStorage.getItem(KEY)){
        setTimeout(openHowTo, 300);
        localStorage.setItem(KEY,'1');
      }
    }catch(_){}
  })();

  /* ===== Difficulty Dock (Easy / Normal / Hard / Final) ===== */
  ;(function installDifficultyDock(){
    if (document.getElementById('sbDiffDock')) return;

    function getQ(k){ return new URLSearchParams(location.search).get(k); }
    const DIFF_KEYS = { easy:1, normal:1, hard:1, final:1 };
    const current =
      getQ('diff') ||
      (function(){ try{return localStorage.getItem('sb_diff');}catch(_){ return null; } })() ||
      (window.APP && APP.story && APP.story.difficulty) ||
      'normal';
    const picked = DIFF_KEYS[current] ? current : 'normal';

    const css = `
      #sbDiffDock{
        position:fixed; right:12px; bottom:12px; z-index:99999;
        display:flex; align-items:center; gap:8px;
        background:rgba(10,16,24,.78); backdrop-filter:saturate(1.1) blur(4px);
        border:1px solid rgba(255,255,255,.08); border-radius:12px;
        padding:8px 10px; color:#e6f7ff; font:600 12px system-ui;
      }
      #sbDiffSel{
        appearance:none; background:#0e2233; color:#e6f7ff; border:1px solid rgba(255,255,255,.14);
        border-radius:10px; padding:6px 28px 6px 10px; font:600 12px system-ui; cursor:pointer;
      }
      .chev{margin-left:-22px; pointer-events:none; user-select:none;}
    `;
    const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);

    const dock = document.createElement('div');
    dock.id = 'sbDiffDock';
    dock.innerHTML = `
      <label for="sbDiffSel" title="เลือกความยาก (Alt+D)">Difficulty</label>
      <select id="sbDiffSel" aria-label="Difficulty">
        <option value="easy">Easy</option>
        <option value="normal">Normal</option>
        <option value="hard">Hard</option>
        <option value="final">Final</option>
      </select>
      <span class="chev">▼</span>`;
    document.body.appendChild(dock);

    const sel = dock.querySelector('#sbDiffSel');
    sel.value = picked;

    sel.addEventListener('change', function(e){
      const v = e.target.value;
      try{ localStorage.setItem('sb_diff', v); }catch(_){}
      try{ if(window.APP){ APP.story = APP.story || {}; APP.story.difficulty = v; } }catch(_){}
      const url = new URL(location.href);
      url.searchParams.set('diff', v);
      location.href = url.pathname + '?' + url.searchParams.toString();
    }, { passive:true });

    document.addEventListener('keydown', (ev)=>{ if ((ev.altKey||ev.metaKey) && (ev.key==='d'||ev.key==='D')) sel.focus(); });
  })();

})();
