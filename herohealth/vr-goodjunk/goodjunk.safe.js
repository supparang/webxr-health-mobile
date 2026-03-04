// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE — SOLO PRODUCTION (3-Stage + PRO + AI Explainable + Stage Rewards + Boss Pattern + Telegraph + MiniRewards)
// PATCH v20260304-SOLO-PRO-3STAGE-PACK1-4-TELEGRAPH-MINIREWARD
//
// ✅ diff: easy/normal/hard
// ✅ pro: ?pro=1
// ✅ 3-stage: WARM → TRICK → BOSS
// ✅ PACK 1: TRICK rewards/penalties → affects Boss (bossHP, shieldStart, fever bonus)
// ✅ PACK 2: Boss pattern generator (seeded deterministic): Shield Ring → Weakspot Swap → Burst
// ✅ PACK 3: Boss telegraph: warn circle + phase callouts (readable for Grade 5)
// ✅ PACK 4: TRICK mini-mission rewards that carry into Boss (fair buffs)
// ✅ AI prediction only (NO adaptive) + Coach explainable top2 factors
// ✅ spawn-safe from window.__HHA_SPAWN_SAFE__
// ✅ hha:shoot support for cVR strict
'use strict';

export function boot(cfg){
  cfg = cfg || {};
  const WIN = window, DOC = document;
  const AI  = cfg.ai || null;

  // ---------- helpers ----------
  const qs = (k, d='')=>{ try{ return (new URL(location.href)).searchParams.get(k) ?? d; }catch(e){ return d; } };
  const clamp = (v,a,b)=>{ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b,v)); };
  const nowMs = ()=> (performance && performance.now) ? performance.now() : Date.now();
  const nowIso = ()=> new Date().toISOString();
  const $ = (id)=> DOC.getElementById(id);

  // ---------- deterministic RNG (xmur3 + sfc32) ----------
  function xmur3(str){
    str = String(str||'');
    let h = 1779033703 ^ str.length;
    for(let i=0;i<str.length;i++){
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function(){
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return (h ^= (h >>> 16)) >>> 0;
    };
  }
  function sfc32(a,b,c,d){
    return function(){
      a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
      let t = (a + b) | 0;
      a = b ^ (b >>> 9);
      b = (c + (c << 3)) | 0;
      c = (c << 21) | (c >>> 11);
      d = (d + 1) | 0;
      t = (t + d) | 0;
      c = (c + t) | 0;
      return (t >>> 0) / 4294967296;
    };
  }
  function makeRng(seedStr){
    const seed = xmur3(seedStr);
    return sfc32(seed(), seed(), seed(), seed());
  }

  // ---------- DOM refs ----------
  const layer = $('gj-layer');
  const hud = {
    score: $('hud-score'),
    time: $('hud-time'),
    miss: $('hud-miss'),
    grade: $('hud-grade'),
    goal: $('hud-goal'),
    goalCur: $('hud-goal-cur'),
    goalTarget: $('hud-goal-target'),
    goalDesc: $('goalDesc'),
    mini: $('hud-mini'),
    miniTimer: $('miniTimer'),
    stage: $('hud-stage'),
    stageDesc: $('hud-stage-desc'),
    aiRisk: $('aiRisk'),
    aiHint: $('aiHint'),
  };
  const feverFill = $('feverFill');
  const feverText = $('feverText');
  const shieldPills = $('shieldPills');
  const bossBar = $('bossBar');
  const bossFill = $('bossFill');
  const bossHint = $('bossHint');
  const lowTimeOverlay = $('lowTimeOverlay');
  const lowTimeNum = $('gj-lowtime-num');
  const progressWrap = DOC.querySelector('.gj-progress');
  const progressFill = $('gjProgressFill');

  const endOverlay = $('endOverlay');
  const endTitle = $('endTitle');
  const endSub = $('endSub');
  const endGrade = $('endGrade');
  const endScore = $('endScore');
  const endMiss  = $('endMiss');
  const endTime  = $('endTime');

  if(!layer){
    console.warn('[GoodJunk] Missing #gj-layer');
    return;
  }

  // ---------- view/run/diff/time/pro ----------
  const view = String(cfg.view || qs('view','mobile')).toLowerCase();
  const runMode = String(cfg.run || qs('run','play')).toLowerCase();
  const diff = String(cfg.diff || qs('diff','normal')).toLowerCase();
  const pro = !!(cfg.pro ?? (qs('pro','0')==='1'));
  const plannedSec = clamp(cfg.time ?? qs('time','80'), 20, 300);

  // hub / pid / cat / gameKey
  const pid = String(cfg.pid || qs('pid','anon')).trim() || 'anon';
  const hubUrl = String(cfg.hub || qs('hub','../hub.html'));
  const HH_CAT = 'nutrition';
  const HH_GAME = 'goodjunk';

  // seed
  const seedStr = String(cfg.seed || qs('seed', String(Date.now())));
  const rng = makeRng(seedStr);
  const r01 = ()=> rng();
  const rPick = (arr)=> arr[(r01()*arr.length)|0];

  // ---------- tuning (diff + pro) ----------
  const TUNE = (function(){
    let spawnBase = 0.78;
    let lifeMissLimit = 10;
    let ttlGood = 2.6;
    let ttlJunk = 2.9;
    let ttlBonus = 2.4;
    let ttlShield = 2.6;

    let warmR = 0.45;
    let trickR = 0.75;

    let bossHp = 18;
    let stormMult = 1.0;

    if(diff==='easy'){
      spawnBase = 0.68;
      lifeMissLimit = 14;
      ttlGood = 3.0;
      ttlJunk = 3.2;
      bossHp = 16;
      stormMult = 0.92;
    }else if(diff==='hard'){
      spawnBase = 0.95;
      lifeMissLimit = 8;
      ttlGood = 2.2;
      ttlJunk = 2.4;
      bossHp = 22;
      stormMult = 1.14;
    }

    if(view==='cvr' || view==='vr'){
      ttlGood += 0.15;
      ttlJunk += 0.15;
    }

    const proCfg = {
      on: pro,
      trickJunkBoost: pro ? 0.10 : 0.00,
      trickTTLScale: pro ? 0.90 : 1.00,
      trickSpawnBoost: pro ? 1.08 : 1.00,
      trickShieldBoost: pro ? 0.03 : 0.00,
      bossHpBoost: pro ? 2 : 0,
      telegraphLead: pro ? 0.22 : 0.20
    };

    return {
      spawnBase, lifeMissLimit,
      ttlGood, ttlJunk, ttlBonus, ttlShield,
      warmR, trickR,
      bossHp: bossHp + proCfg.bossHpBoost,
      stormMult,
      proCfg
    };
  })();

  // ---------- assets ----------
  const GOOD = ['🍎','🍌','🥦','🥬','🥚','🐟','🥛','🍚','🍞','🥑','🍉','🍊','🥕','🥒'];
  const JUNK = ['🍟','🍔','🍕','🍩','🍬','🧋','🥤','🍭','🍫'];
  const BONUS = ['⭐','💎','⚡'];
  const SHIELDS = ['🛡️','🛡️','🛡️'];
  const BOSS_SHIELD = '🛡️';
  const WEAK = '🎯';
  const DECOY = ['🥦','🍎','🍌','🥕','🥒']; // trick decoy: looks good but counts as junk (marked with •)

  // ---------- FX layer ----------
  const fxLayer = DOC.createElement('div');
  fxLayer.style.position = 'fixed';
  fxLayer.style.inset = '0';
  fxLayer.style.pointerEvents = 'none';
  fxLayer.style.zIndex = '260';
  DOC.body.appendChild(fxLayer);

  function fxFloatText(x,y,text,isBad){
    const el = DOC.createElement('div');
    el.textContent = text;
    el.style.position = 'absolute';
    el.style.left = `${x}px`;
    el.style.top  = `${y}px`;
    el.style.transform = 'translate(-50%,-50%)';
    el.style.font = '900 18px/1.1 system-ui, -apple-system, Segoe UI, Roboto, Arial';
    el.style.letterSpacing = '.2px';
    el.style.color = isBad ? 'rgba(255,110,110,.96)' : 'rgba(229,231,235,.98)';
    el.style.textShadow = '0 10px 30px rgba(0,0,0,.55)';
    el.style.filter = 'drop-shadow(0 10px 26px rgba(0,0,0,.45))';
    el.style.opacity = '1';
    el.style.willChange = 'transform, opacity';
    fxLayer.appendChild(el);

    const t0 = nowMs();
    const dur = 520;
    const rise = 34 + (r01()*14);
    function tick(){
      const t = nowMs() - t0;
      const p = Math.min(1, t/dur);
      const yy = y - rise * (p);
      const sc = 1 + 0.08*Math.sin(p*3.14);
      el.style.top = `${yy}px`;
      el.style.opacity = String(1 - p);
      el.style.transform = `translate(-50%,-50%) scale(${sc})`;
      if(p<1) requestAnimationFrame(tick);
      else el.remove();
    }
    requestAnimationFrame(tick);
  }

  function fxBurst(x,y){
    const n = 10 + ((r01()*6)|0);
    for(let i=0;i<n;i++){
      const dot = DOC.createElement('div');
      dot.style.position = 'absolute';
      dot.style.left = `${x}px`;
      dot.style.top  = `${y}px`;
      dot.style.width = '6px';
      dot.style.height = '6px';
      dot.style.borderRadius = '999px';
      dot.style.background = 'rgba(229,231,235,.92)';
      dot.style.opacity = '1';
      dot.style.transform = 'translate(-50%,-50%)';
      dot.style.willChange = 'transform, opacity';
      fxLayer.appendChild(dot);

      const ang = r01()*Math.PI*2;
      const sp = 40 + r01()*80;
      const vx = Math.cos(ang)*sp;
      const vy = Math.sin(ang)*sp;
      const t0 = nowMs();
      const dur = 420 + r01()*220;

      function tick(){
        const t = nowMs() - t0;
        const p = Math.min(1, t/dur);
        const xx = x + vx*p;
        const yy = y + vy*p - 30*p*p;
        dot.style.left = `${xx}px`;
        dot.style.top  = `${yy}px`;
        dot.style.opacity = String(1 - p);
        dot.style.transform = `translate(-50%,-50%) scale(${1 - 0.4*p})`;
        if(p<1) requestAnimationFrame(tick);
        else dot.remove();
      }
      requestAnimationFrame(tick);
    }
  }

  // PACK 3: telegraph circle (warn before spawn)
  function fxTelegraph(x,y, label){
    const ring = DOC.createElement('div');
    ring.style.position='absolute';
    ring.style.left = `${x}px`;
    ring.style.top  = `${y}px`;
    ring.style.width='90px';
    ring.style.height='90px';
    ring.style.borderRadius='999px';
    ring.style.transform='translate(-50%,-50%) scale(.75)';
    ring.style.border='3px solid rgba(253,224,71,.65)';
    ring.style.boxShadow='0 0 0 6px rgba(253,224,71,.12), 0 16px 40px rgba(0,0,0,.35)';
    ring.style.opacity='0.0';
    ring.style.willChange='transform,opacity';
    fxLayer.appendChild(ring);

    let tag=null;
    if(label){
      tag = DOC.createElement('div');
      tag.textContent = String(label);
      tag.style.position='absolute';
      tag.style.left = `${x}px`;
      tag.style.top  = `${y-58}px`;
      tag.style.transform='translate(-50%,-50%)';
      tag.style.font='900 14px/1 system-ui, -apple-system, Segoe UI, Roboto, Arial';
      tag.style.color='rgba(254,249,195,.98)';
      tag.style.textShadow='0 10px 30px rgba(0,0,0,.55)';
      tag.style.opacity='0';
      fxLayer.appendChild(tag);
    }

    const t0 = nowMs();
    const dur = 260;
    function tick(){
      const t = nowMs()-t0;
      const p = Math.min(1, t/dur);
      const s = 0.75 + 0.25*p;
      ring.style.opacity = String(0.20 + 0.80*p);
      ring.style.transform = `translate(-50%,-50%) scale(${s})`;
      if(tag){
        tag.style.opacity = String(0.15 + 0.85*p);
      }
      if(p<1) requestAnimationFrame(tick);
      else{
        // fade out quickly
        const t1 = nowMs();
        const dur2 = 260;
        (function fade(){
          const q = Math.min(1, (nowMs()-t1)/dur2);
          ring.style.opacity = String(1 - q);
          ring.style.transform = `translate(-50%,-50%) scale(${1.0 + 0.15*q})`;
          if(tag) tag.style.opacity = String(1 - q);
          if(q<1) requestAnimationFrame(fade);
          else{ ring.remove(); if(tag) tag.remove(); }
        })();
      }
    }
    requestAnimationFrame(tick);
  }

  // PACK 3: big phase callout
  function fxCallout(msg){
    const wrap = DOC.createElement('div');
    wrap.style.position='fixed';
    wrap.style.left='50%';
    wrap.style.top='18%';
    wrap.style.transform='translate(-50%,-50%)';
    wrap.style.zIndex='265';
    wrap.style.pointerEvents='none';
    wrap.style.padding='10px 14px';
    wrap.style.borderRadius='18px';
    wrap.style.border='1px solid rgba(148,163,184,.18)';
    wrap.style.background='rgba(2,6,23,.62)';
    wrap.style.backdropFilter='blur(10px)';
    wrap.style.webkitBackdropFilter='blur(10px)';
    wrap.style.boxShadow='0 18px 55px rgba(0,0,0,.40)';
    wrap.style.color='rgba(229,231,235,.98)';
    wrap.style.font='1000 16px/1.1 system-ui, -apple-system, Segoe UI, Roboto, Arial';
    wrap.textContent = msg;
    DOC.body.appendChild(wrap);

    const t0=nowMs(), dur=900;
    (function tick(){
      const p=Math.min(1,(nowMs()-t0)/dur);
      const y = 18 - 10*p;
      wrap.style.top = `${y}%`;
      wrap.style.opacity = String(1 - Math.max(0, (p-0.65)/0.35));
      wrap.style.transform = `translate(-50%,-50%) scale(${1 + 0.05*Math.sin(p*3.14)})`;
      if(p<1) requestAnimationFrame(tick);
      else wrap.remove();
    })();
  }

  // ---------- Coach (micro tips + explainable) ----------
  const coach = DOC.createElement('div');
  coach.style.position = 'fixed';
  coach.style.left = '10px';
  coach.style.right = '10px';
  coach.style.bottom = `calc(env(safe-area-inset-bottom, 0px) + 10px)`;
  coach.style.zIndex = '210';
  coach.style.pointerEvents = 'none';
  coach.style.display = 'flex';
  coach.style.justifyContent = 'center';
  coach.style.opacity = '0';
  coach.style.transform = 'translateY(6px)';
  coach.style.transition = 'opacity .18s ease, transform .18s ease';
  coach.innerHTML = `
    <div style="
      max-width:760px; width:100%;
      border:1px solid rgba(148,163,184,.16);
      background:rgba(2,6,23,.62);
      color:rgba(229,231,235,.96);
      border-radius:16px;
      padding:10px 12px;
      box-shadow:0 18px 55px rgba(0,0,0,.40);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      font: 900 13px/1.35 system-ui, -apple-system, Segoe UI, Roboto, Arial;">
      <span style="opacity:.9">🧑‍⚕️ Coach:</span> <span id="coachText">—</span>
    </div>`;
  DOC.body.appendChild(coach);

  const coachText = coach.querySelector('#coachText');
  let coachLatchMs = 0;
  function sayCoach(msg, minGapMs=3200){
    const t = nowMs();
    if(t - coachLatchMs < minGapMs) return;
    coachLatchMs = t;
    if(coachText) coachText.textContent = String(msg||'');
    coach.style.opacity = '1';
    coach.style.transform = 'translateY(0)';
    setTimeout(()=>{
      coach.style.opacity = '0';
      coach.style.transform = 'translateY(6px)';
    }, 2200);
  }

  // ---------- AI HUD ----------
  function setAIHud(pred){
    try{
      if(!pred) return;
      if(hud.aiRisk && typeof pred.hazardRisk === 'number') hud.aiRisk.textContent = String((+pred.hazardRisk).toFixed(2));
      if(hud.aiHint) hud.aiHint.textContent = String((pred.next5 && pred.next5[0]) || '—');
    }catch(e){}
  }

  // ---------- game state ----------
  const startTimeIso = nowIso();
  let playing = true;
  let paused = false;
  let tLeft = plannedSec;
  let lastTick = nowMs();

  // pause hook
  WIN.__GJ_SET_PAUSED__ = function(on){
    paused = !!on;
    try{ lastTick = nowMs(); }catch(e){}
  };

  let score = 0;
  let missTotal = 0;
  let missGoodExpired = 0;
  let missJunkHit = 0;

  let combo = 0;
  let bestCombo = 0;

  let fever = 0;
  let rageOn = false;
  let rageLeft = 0;

  let shield = 0;

  // RT (GOOD hit only)
  let goodHitCount = 0;
  let rtSum = 0;
  const rtList = [];

  // ACC
  let shots = 0;
  let hits  = 0;

  const goal = { name:'Daily', desc:'Hit GOOD 20', cur:0, target:20 };
  const mini = { name:'—', t:0 };

  // Boss
  let bossActive = false;
  let bossHpMax = TUNE.bossHp;
  let bossHp = bossHpMax;
  let bossPhase = 0;
  let bossShieldHp = 5;

  // Stage machine
  const STAGE = { WARM:'WARM', TRICK:'TRICK', BOSS:'BOSS' };
  let stage = STAGE.WARM;
  let stageAnnounced = { warm:false, trick:false, boss:false };

  // PACK 4: mini-mission tracker (TRICK only)
  const MINI = {
    active:false,
    type:'',
    t:0,
    tMax:0,
    progress:0,
    goal:0,
    failed:false,
    done:false
  };
  function miniReset(){
    MINI.active=false; MINI.type=''; MINI.t=0; MINI.tMax=0; MINI.progress=0; MINI.goal=0; MINI.failed