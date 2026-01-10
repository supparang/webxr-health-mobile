// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR Engine — PRODUCTION (Boss+++ A+B+V)
// A) Boss HP 10/12/14 (easy/normal/hard)
// B) Phase2 duration 6s (Armor Window + Decoy + Stun)
// V) Visual hooks via hha:boss + hha:judge + particles

'use strict';

// ----------------- helpers -----------------
const WIN = window;
const DOC = document;

function qs(k, def=null){
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}
function clamp(v,min,max){ v=Number(v)||0; return v<min?min:(v>max?max:v); }
function now(){ return performance.now(); }
function rnd01(){ return Math.random(); }
function pick(a){ return a[Math.floor(rnd01()*a.length)] || a[0]; }

function dispatch(name, detail){
  try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
}

function getParticles(){
  return (WIN.GAME_MODULES && WIN.GAME_MODULES.Particles) || WIN.Particles || null;
}

function rectOf(el){
  try{ return el?.getBoundingClientRect?.() || null; }catch{ return null; }
}

function safeArea(){
  const cs = getComputedStyle(DOC.documentElement);
  const sat = parseFloat(cs.getPropertyValue('--sat')) || 0;
  const sab = parseFloat(cs.getPropertyValue('--sab')) || 0;
  const sal = parseFloat(cs.getPropertyValue('--sal')) || 0;
  const sar = parseFloat(cs.getPropertyValue('--sar')) || 0;
  const topSafe = parseFloat(cs.getPropertyValue('--gj-top-safe')) || 140;
  const botSafe = parseFloat(cs.getPropertyValue('--gj-bottom-safe')) || 130;
  return { sat,sab,sal,sar, topSafe, botSafe };
}

function playRect(){
  const W = DOC.documentElement.clientWidth;
  const H = DOC.documentElement.clientHeight;
  const s = safeArea();
  const x0 = 10 + s.sal;
  const x1 = W - (10 + s.sar);
  const y0 = (10 + s.sat) + s.topSafe * 0.85;    // keep headroom
  const y1 = H - ((10 + s.sab) + s.botSafe * 0.90);
  const w = Math.max(240, x1-x0);
  const h = Math.max(260, y1-y0);
  return { x0, y0, x1, y1, w, h, W, H };
}

// ----------------- UI refs -----------------
const UI = {
  score: ()=>DOC.getElementById('hud-score'),
  time:  ()=>DOC.getElementById('hud-time'),
  miss:  ()=>DOC.getElementById('hud-miss'),
  grade: ()=>DOC.getElementById('hud-grade'),
  goal:  ()=>DOC.getElementById('hud-goal'),
  goalCur:()=>DOC.getElementById('hud-goal-cur'),
  goalTar:()=>DOC.getElementById('hud-goal-target'),
  goalDesc:()=>DOC.getElementById('goalDesc'),
  mini:  ()=>DOC.getElementById('hud-mini'),
  miniTimer:()=>DOC.getElementById('miniTimer'),
  feverFill:()=>DOC.getElementById('feverFill'),
  feverText:()=>DOC.getElementById('feverText'),
  shield:()=>DOC.getElementById('shieldPills'),
  lowOverlay:()=>DOC.getElementById('lowTimeOverlay'),
  lowNum:()=>DOC.getElementById('gj-lowtime-num'),
};

// ----------------- core state -----------------
const G = {
  view: 'mobile',
  diff: 'normal',
  runMode: 'play',
  durationPlannedSec: 80,
  tStart: 0,
  tLast: 0,
  playing: false,
  ended: false,

  score: 0,
  miss: 0,
  combo: 0,
  comboMax: 0,

  fever: 0,        // 0..100
  shield: 0,       // integer pills

  // spawn pacing
  spawnEveryMs: 620,
  lastSpawnAt: 0,

  // boss schedule
  bossActive: false,
  bossHp: 0,
  bossHpMax: 0,
  bossPhase: 1,
  bossPhase2Ms: 6000,   // fixed by your requirement
  bossPhase2EndAt: 0,
  bossArmorOpen: false,
  bossDecoyOn: false,
  bossStunUntil: 0,
  bossRage: false,

  // safe mount
  mountL: null,
  mountR: null,
};

function diffParams(diff){
  const d = (diff||'normal').toLowerCase();
  if(d === 'easy') return { hp:10, spawn:700, bossEvery: 22000, p2:6000 };
  if(d === 'hard') return { hp:14, spawn:540, bossEvery: 17000, p2:6000 };
  return { hp:12, spawn:610, bossEvery: 19000, p2:6000 };
}

// ----------------- targets -----------------
function makeTarget(kind, opts={}){
  const el = DOC.createElement('div');
  el.className = 'gj-target ' + (opts.cls || '');
  el.dataset.kind = kind;

  // emoji / label
  el.textContent = opts.text || (kind==='good' ? '🥦' : '🍟');

  // size
  const base = opts.size || (kind==='boss' ? 92 : 66);
  el.style.fontSize = base + 'px';
  el.style.lineHeight = 1;

  // position
  el.style.left = (opts.x|0) + 'px';
  el.style.top  = (opts.y|0) + 'px';

  // TTL
  const ttl = Number(opts.ttlMs || 1700);
  el.dataset.expireAt = String(now() + ttl);

  // click/tap
  el.addEventListener('pointerdown', (e)=>{
    e.preventDefault();
    e.stopPropagation();
    onHit(el, { source:'tap', x: e.clientX, y: e.clientY });
  }, { passive:false });

  return el;
}

function mountForEye(eye){
  // cVR: left mount for left eye; right mount for right eye
  // non-cVR: always left mount
  if(G.view === 'cvr' && eye === 'r') return G.mountR || G.mountL;
  return G.mountL;
}

function addTarget(el, eye='l'){
  const m = mountForEye(eye);
  if(!m) return;
  m.appendChild(el);
}

function removeTarget(el){
  try{
    el.classList.add('gone');
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 160);
  }catch(_){}
}

// ----------------- scoring / meters -----------------
function addScore(delta){
  G.score = Math.max(0, (G.score + (delta|0))|0);
  UI.score()?.textContent = String(G.score);
}
function addMiss(n=1){
  G.miss = Math.max(0, (G.miss + (n|0))|0);
  UI.miss()?.textContent = String(G.miss);
}
function addCombo(ok){
  if(ok){
    G.combo++;
    if(G.combo > G.comboMax) G.comboMax = G.combo;
  }else{
    G.combo = 0;
  }
}
function setGrade(){
  // simple grade: score - miss penalty
  const s = G.score - G.miss*12;
  let g = 'D';
  if(s >= 420) g='S';
  else if(s >= 320) g='A';
  else if(s >= 240) g='B';
  else if(s >= 160) g='C';
  UI.grade()?.textContent = g;
  return g;
}

function setFever(pct){
  G.fever = clamp(pct,0,100);
  UI.feverFill()?.style && (UI.feverFill().style.width = G.fever.toFixed(0)+'%');
  UI.feverText()?.textContent = G.fever.toFixed(0)+'%';

  // Fever -> auto shield tick at 100 then consume
  if(G.fever >= 100){
    G.fever = 0;
    G.shield = Math.min(3, G.shield + 1);
    updateShieldUi();
    dispatch('hha:judge', { label:'⭐ FEVER! +SHIELD', kind:'fever' });
    getParticles()?.celebrate?.('mini');
  }
}

function updateShieldUi(){
  const s = G.shield;
  const txt = s<=0 ? '—' : ('🛡️'.repeat(s));
  UI.shield()?.textContent = txt;
}

// ----------------- boss system (A+B+V) -----------------
function bossInit(){
  const p = diffParams(G.diff);
  G.bossActive = true;
  G.bossHpMax = p.hp;
  G.bossHp = p.hp;
  G.bossPhase = 1;
  G.bossPhase2Ms = p.p2;
  G.bossPhase2EndAt = 0;
  G.bossArmorOpen = false;
  G.bossDecoyOn = false;
  G.bossStunUntil = 0;
  G.bossRage = false;

  DOC.body.classList.add('gj-boss');
  DOC.body.classList.remove('gj-rage','gj-armor','gj-stun');

  dispatch('hha:judge', { label:'👹 BOSS INCOMING', kind:'boss' });
  getParticles()?.celebrate?.('boss');
  bossEmit();
}

function bossEnd(reason='bossDown'){
  G.bossActive = false;
  DOC.body.classList.remove('gj-boss','gj-rage','gj-armor','gj-stun');
  dispatch('hha:celebrate', { kind:'boss' });
  dispatch('hha:judge', { label:'✅ BOSS DOWN!', kind:'boss' });
  bossEmit(false, reason);

  // reward
  addScore(120);
  G.shield = Math.min(3, G.shield + 1);
  updateShieldUi();
  setFever(Math.min(99, G.fever + 40));
}

function bossEmit(active=true, reason=null){
  const left = G.bossPhase===2 ? Math.max(0, (G.bossPhase2EndAt - now())/1000) : 0;
  dispatch('hha:boss', {
    active: !!active,
    reason,
    hp: G.bossHp,
    hpMax: G.bossHpMax,
    phase: G.bossPhase,
    phase2Left: left,
    armorOpen: !!G.bossArmorOpen,
    decoyOn: !!G.bossDecoyOn,
    stunT: Math.max(0, (G.bossStunUntil - now())/1000),
    rage: !!G.bossRage
  });
}

function bossTick(){
  if(!G.bossActive) return;

  // Rage when low HP
  if(!G.bossRage && G.bossHp <= Math.ceil(G.bossHpMax*0.35)){
    G.bossRage = true;
    DOC.body.classList.add('gj-rage');
    dispatch('hha:judge', { label:'😈 RAGE!', kind:'rage' });
  }

  // Phase2 entry when half hp or time trigger
  if(G.bossPhase === 1 && G.bossHp <= Math.ceil(G.bossHpMax*0.55)){
    G.bossPhase = 2;
    G.bossPhase2EndAt = now() + G.bossPhase2Ms;
    dispatch('hha:judge', { label:`PHASE 2 (${(G.bossPhase2Ms/1000).toFixed(0)}s)`, kind:'phase' });
  }

  // Phase2 mechanics
  if(G.bossPhase === 2){
    // Armor window toggles: open 0.9s then closed 0.9s (rage -> faster)
    const cyc = G.bossRage ? 1200 : 1800;
    const openWin = G.bossRage ? 520 : 760;
    const t = now();
    const mod = (t % cyc);
    const open = (mod < openWin);
    if(open !== G.bossArmorOpen){
      G.bossArmorOpen = open;
      DOC.body.classList.toggle('gj-armor', open);
      dispatch('hha:judge', { label: open ? 'Armor: OPEN' : 'Armor: CLOSED', kind:'armor' });
    }

    // Decoy toggles: ON near end (pressure)
    const left = G.bossPhase2EndAt - t;
    const wantDecoy = left < (G.bossRage ? 3600 : 3000);
    if(wantDecoy !== G.bossDecoyOn){
      G.bossDecoyOn = wantDecoy;
      dispatch('hha:judge', { label: wantDecoy ? 'Decoy: ON' : 'Decoy: OFF', kind:'decoy' });
    }

    // end phase2 -> reset to phase1 loop (but keep boss active)
    if(t >= G.bossPhase2EndAt){
      G.bossPhase = 1;
      G.bossArmorOpen = false;
      G.bossDecoyOn = false;
      DOC.body.classList.remove('gj-armor');
      dispatch('hha:judge', { label:'PHASE 1', kind:'phase' });
    }
  }

  // stun status
  DOC.body.classList.toggle('gj-stun', now() < G.bossStunUntil);

  bossEmit();
}

// spawn boss targets during boss active
function bossSpawn(){
  const r = playRect();
  const P = getParticles();

  // core always
  const x = r.x0 + r.w*0.5;
  const y = r.y0 + r.h*0.40;

  // core hitbox
  const core = makeTarget('boss', { x, y, text: (G.bossRage ? '😈' : '👹'), size: 96, ttlMs: 1400, cls:'boss-core' });
  core.dataset.role = 'core';
  addTarget(core, 'l');
  if(G.view==='cvr') addTarget(core.cloneNode(true), 'r'); // visual twin

  // weakpoint appears only when armor open or in phase1 (fair)
  const weakAllowed = (G.bossPhase === 1) || (G.bossPhase === 2 && G.bossArmorOpen);
  if(weakAllowed){
    const wx = x + (rnd01()*120 - 60);
    const wy = y + 86 + (rnd01()*34 - 17);
    const weak = makeTarget('bossweak', { x: wx, y: wy, text:'💚', size: 62, ttlMs: 950, cls:'boss-weak' });
    weak.dataset.role = 'weak';
    addTarget(weak,'l');
    if(G.view==='cvr'){
      const w2 = weak.cloneNode(true);
      w2.className = weak.className;
      w2.dataset.kind = weak.dataset.kind;
      w2.dataset.role = weak.dataset.role;
      w2.dataset.expireAt = weak.dataset.expireAt;
      w2.addEventListener('pointerdown', (e)=>{
        e.preventDefault(); e.stopPropagation();
        onHit(w2, { source:'tap', x: e.clientX, y: e.clientY });
      }, { passive:false });
      addTarget(w2,'r');
    }
  }

  // decoys in phase2 if enabled
  if(G.bossPhase===2 && G.bossDecoyOn){
    const n = G.bossRage ? 3 : 2;
    for(let i=0;i<n;i++){
      const dx = (i===0? -130 : (i===1? 130 : 0)) + (rnd01()*30-15);
      const dy = 10 + (rnd01()*40-20);
      const dec = makeTarget('bossdecoy', { x: x+dx, y: y+dy, text:'👺', size: 84, ttlMs: 820, cls:'boss-decoy' });
      dec.dataset.role = 'decoy';
      addTarget(dec,'l');
    }
  }

  // small burst for drama
  P?.burstAt?.(x, y, 'bad');
}

// apply damage on boss hit (armor/stun rules)
function bossDamage(amount, hitX, hitY, role){
  // if stunned -> more damage
  const stunned = now() < G.bossStunUntil;
  let dmg = amount;

  // phase2 core hits are armored (no dmg) unless armorOpen or weak hit
  if(G.bossPhase===2 && role==='core' && !G.bossArmorOpen){
    dispatch('hha:judge', { label:'BLOCKED!', kind:'block' });
    getParticles()?.burstAt?.(hitX, hitY, 'block');
    addScore(0);
    addCombo(false);
    return;
  }

  if(role==='weak') dmg = Math.max(dmg, 2);
  if(stunned) dmg = Math.ceil(dmg * 1.6);

  G.bossHp = Math.max(0, G.bossHp - dmg);
  addScore(28 + (role==='weak'?12:0));
  addCombo(true);

  getParticles()?.burstAt?.(hitX, hitY, (role==='weak') ? 'good' : 'bad');
  dispatch('hha:judge', { label:`BOSS -${dmg}`, kind:'boss' });

  if(role==='weak'){
    // weak hit can stun boss briefly (skill reward)
    const stunMs = G.bossRage ? 520 : 780;
    G.bossStunUntil = Math.max(G.bossStunUntil, now() + stunMs);
  }

  if(G.bossHp <= 0){
    bossEnd('bossDown');
  }
}

// ----------------- normal spawns -----------------
function spawnNormal(){
  const r = playRect();
  const p = getParticles();

  const x = r.x0 + rnd01()*r.w;
  const y = r.y0 + rnd01()*r.h;

  const kind = (rnd01() < 0.72) ? 'good' : 'junk';
  const t = makeTarget(kind, {
    x, y,
    text: (kind==='good' ? pick(['🥦','🍎','🥕','🍌']) : pick(['🍟','🥤','🍭','🍔'])),
    size: (kind==='good'? 64 : 66),
    ttlMs: (kind==='good'? 1650 : 1750),
    cls: ''
  });

  addTarget(t, 'l');
  if(G.view==='cvr'){
    const t2 = t.cloneNode(true);
    t2.className = t.className;
    t2.dataset.kind = t.dataset.kind;
    t2.dataset.expireAt = t.dataset.expireAt;
    t2.addEventListener('pointerdown', (e)=>{
      e.preventDefault(); e.stopPropagation();
      onHit(t2, { source:'tap', x: e.clientX, y: e.clientY });
    }, { passive:false });
    addTarget(t2, 'r');
  }

  // small joy
  if(kind==='good' && rnd01() < 0.16) p?.burstAt?.(x,y,'good');
}

// expire targets -> miss only for good targets
function expireSweep(){
  const t = now();
  const all = Array.from(DOC.querySelectorAll('.gj-target'));
  for(const el of all){
    const exp = parseFloat(el.dataset.expireAt || '0') || 0;
    if(exp > 0 && t >= exp){
      const kind = el.dataset.kind || '';
      if(kind === 'good'){
        addMiss(1);
        addCombo(false);
        dispatch('hha:judge', { label:'MISS (timeout)', kind:'miss' });
      }
      removeTarget(el);
    }
  }
}

// ----------------- hit logic -----------------
function onHit(el, ctx){
  if(!G.playing || G.ended) return;
  const kind = el.dataset.kind || '';
  const role = el.dataset.role || 'na';

  const r = rectOf(el);
  const x = (ctx?.x != null) ? ctx.x : (r ? r.left + r.width/2 : DOC.documentElement.clientWidth/2);
  const y = (ctx?.y != null) ? ctx.y : (r ? r.top + r.height/2 : DOC.documentElement.clientHeight/2);

  const P = getParticles();

  if(kind === 'good'){
    removeTarget(el);
    addScore(10 + Math.min(14, G.combo));
    addCombo(true);
    setFever(Math.min(100, G.fever + 16));
    P?.burstAt?.(x,y,'good');
    P?.popText?.(x,y,'+10','');
    dispatch('hha:judge', { label:'GOOD!', kind:'good' });
    return;
  }

  if(kind === 'junk'){
    removeTarget(el);

    // shield blocks junk -> no miss
    if(G.shield > 0){
      G.shield--;
      updateShieldUi();
      addScore(2);
      addCombo(true);
      P?.burstAt?.(x,y,'block');
      dispatch('hha:judge', { label:'🛡️ BLOCK!', kind:'block' });
      return;
    }

    addMiss(1);
    addCombo(false);
    addScore(-8);
    P?.burstAt?.(x,y,'bad');
    dispatch('hha:judge', { label:'OOPS!', kind:'bad' });
    return;
  }

  // boss related
  if(kind === 'boss' || kind === 'bossweak' || kind === 'bossdecoy'){
    removeTarget(el);

    if(!G.bossActive){
      // safety
      dispatch('hha:judge', { label:'(no boss)', kind:'boss' });
      return;
    }

    if(kind === 'bossdecoy' || role === 'decoy'){
      // decoy punish: adds pressure
      addMiss(1);
      addCombo(false);
      addScore(-6);
      P?.burstAt?.(x,y,'bad');
      dispatch('hha:judge', { label:'DECOY!', kind:'decoy' });
      return;
    }

    if(kind === 'bossweak' || role === 'weak'){
      bossDamage(2, x, y, 'weak');
      return;
    }

    bossDamage(1, x, y, 'core');
    return;
  }
}

// VR/cVR shoot: hit nearest target around crosshair (simple lockPx)
function bindShoot(){
  function onShoot(ev){
    if(!G.playing || G.ended) return;
    const d = ev?.detail || {};
    const lockPx = Math.max(18, Number(d.lockPx || 28));
    const cx = DOC.documentElement.clientWidth/2;
    const cy = DOC.documentElement.clientHeight/2;

    let best = null;
    let bestDist = 1e9;

    const els = Array.from(DOC.querySelectorAll('.gj-target'));
    for(const el of els){
      const r = rectOf(el);
      if(!r) continue;
      const x = r.left + r.width/2;
      const y = r.top + r.height/2;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.hypot(dx,dy);
      if(dist < bestDist){
        bestDist = dist;
        best = el;
      }
    }

    if(best && bestDist <= lockPx){
      onHit(best, { source:'shoot', x: cx, y: cy });
    }
  }
  WIN.addEventListener('hha:shoot', onShoot, { passive:true });
}

// ----------------- loop / time / end -----------------
function updateTimeUI(remainSec){
  UI.time()?.textContent = String(Math.max(0, Math.ceil(remainSec)));
  // low overlay
  const low = UI.lowOverlay();
  const n = UI.lowNum();
  if(!low) return;
  if(remainSec <= 5 && remainSec > 0){
    low.setAttribute('aria-hidden','false');
    if(n) n.textContent = String(Math.ceil(remainSec));
  }else{
    low.setAttribute('aria-hidden','true');
  }
}

function checkEnd(){
  // miss limit: easy/normal/hard
  const missLimit = (G.diff==='easy') ? 12 : (G.diff==='hard' ? 10 : 11);
  if(G.miss >= missLimit){
    endGame('missLimit');
    return true;
  }
  return false;
}

function endGame(reason){
  if(G.ended) return;
  G.ended = true;
  G.playing = false;

  // cleanup
  DOC.body.classList.remove('gj-boss','gj-rage','gj-armor','gj-stun');

  const grade = setGrade();
  const played = (now() - G.tStart)/1000;

  dispatch('hha:end', {
    reason,
    runMode: G.runMode,
    device: G.view,
    diff: G.diff,
    durationPlannedSec: G.durationPlannedSec,
    durationPlayedSec: played,
    scoreFinal: G.score,
    comboMax: G.comboMax,
    misses: G.miss,
    grade
  });
}

function loop(){
  if(!G.playing || G.ended) return;
  const t = now();
  const dt = t - G.tLast;
  G.tLast = t;

  const elapsed = (t - G.tStart)/1000;
  const remain = Math.max(0, G.durationPlannedSec - elapsed);
  updateTimeUI(remain);

  if(remain <= 0){
    endGame('timeUp');
    return;
  }

  // boss schedule: enter boss when enough time passed since last boss
  // simple: trigger at 20s remaining and then every ~diff param (keeps "เร้าใจ" ช่วงท้าย)
  const p = diffParams(G.diff);
  const timeToBoss = (remain <= 24);
  if(timeToBoss && !G.bossActive){
    bossInit();
  }

  // spawn
  if(t - G.lastSpawnAt >= G.spawnEveryMs){
    G.lastSpawnAt = t;

    if(G.bossActive){
      bossTick();
      bossSpawn();
    }else{
      spawnNormal();
    }
  }

  // expire targets
  if(dt > 0) expireSweep();

  // end by miss
  if(checkEnd()) return;

  requestAnimationFrame(loop);
}

// ----------------- boot -----------------
export function boot(opts={}){
  // mount layers
  G.mountL = DOC.getElementById('gj-layer') || DOC.getElementById('gj-layer');
  G.mountR = DOC.getElementById('gj-layer-r');

  G.view = String(opts.view || 'mobile');
  G.diff = String(opts.diff || qs('diff','normal'));
  G.runMode = String(opts.run || qs('run','play'));
  G.durationPlannedSec = Number(opts.time || qs('time','80')) || 80;

  const p = diffParams(G.diff);
  G.spawnEveryMs = p.spawn;

  // reset UI
  UI.score()?.textContent = '0';
  UI.miss()?.textContent = '0';
  UI.grade()?.textContent = '—';
  updateShieldUi();
  setFever(0);

  // visual baseline
  DOC.body.classList.toggle('view-cvr', G.view==='cvr');
  DOC.body.classList.toggle('view-vr',  G.view==='vr');
  DOC.body.classList.toggle('view-pc',  G.view==='pc');
  DOC.body.classList.toggle('view-mobile', G.view==='mobile');

  bindShoot();

  // start
  G.playing = true;
  G.ended = false;
  G.tStart = now();
  G.tLast = G.tStart;
  G.lastSpawnAt = G.tStart;

  dispatch('hha:judge', { label:'START!', kind:'start' });
  requestAnimationFrame(loop);
}