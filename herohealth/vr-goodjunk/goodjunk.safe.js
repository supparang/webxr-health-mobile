// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE — PRODUCTION (FX + Coach + mission 3-stage UI + PRO + race wait + battle start sync)
// FULL v20260305-SAFE-FIXSKYSPAWN-FULLGAME
'use strict';

export function boot(cfg){
  cfg = cfg || {};
  const WIN = window, DOC = document;

  // ---------- helpers ----------
  const qs = (k, d='')=>{ try{ return (new URL(location.href)).searchParams.get(k) ?? d; }catch(e){ return d; } };
  const clamp = (v,a,b)=>{ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b, v)); };
  const nowMs = ()=> (performance && performance.now) ? performance.now() : Date.now();
  const nowIso = ()=> new Date().toISOString();
  const pick = (arr, r)=> arr[(r()*arr.length)|0];
  function $(id){ return DOC.getElementById(id); }

  // ---------- MODE ----------
  const mode = String(qs('mode', cfg.mode || 'solo')).toLowerCase();
  const battleOn = (String(qs('battle','0')) === '1') || (mode === 'battle');

  // ---------- BATTLE (optional) ----------
  let battle = null;
  async function initBattleMaybe(pid, gameKey){
    if(!battleOn) return null;
    try{
      const mod = await import('../vr/battle-rtdb.js');
      battle = await mod.initBattle({
        enabled: true,
        room: qs('room', ''),
        pid,
        gameKey,
        autostartMs: Number(qs('autostart','3000'))||3000,
        forfeitMs: Number(qs('forfeit','5000'))||5000
      });
      return battle;
    }catch(e){
      console.warn('[GoodJunk] battle init failed', e);
      return null;
    }
  }

  // ---------- COOL DOWN BUTTON (PER-GAME DAILY) ----------
  function hhDayKey(){
    const d=new Date();
    const yyyy=d.getFullYear();
    const mm=String(d.getMonth()+1).padStart(2,'0');
    const dd=String(d.getDate()).padStart(2,'0');
    return `${yyyy}-${mm}-${dd}`;
  }
  function hhLsGet(k){ try{ return localStorage.getItem(k); }catch(_){ return null; } }
  function hhLsSet(k,v){ try{ localStorage.setItem(k,v); }catch(_){ } }

  function hhCooldownDone(cat, gameKey, pid){
    const day = hhDayKey();
    const p = String(pid||'anon').trim()||'anon';
    const c = String(cat||'nutrition').toLowerCase();
    const g = String(gameKey||'unknown').toLowerCase();
    const kNew = `HHA_COOLDOWN_DONE:${c}:${g}:${p}:${day}`;
    const kOld = `HHA_COOLDOWN_DONE:${c}:${p}:${day}`;
    return (hhLsGet(kNew)==='1') || (hhLsGet(kOld)==='1');
  }

  function hhBuildCooldownUrl({ hub, nextAfterCooldown, cat, gameKey, pid }){
    const gate = new URL('../warmup-gate.html', location.href);
    gate.searchParams.set('gatePhase','cooldown');
    gate.searchParams.set('cat', String(cat||'nutrition'));
    gate.searchParams.set('theme', String(gameKey||'unknown'));
    gate.searchParams.set('pid', String(pid||'anon'));
    if(hub) gate.searchParams.set('hub', String(hub));
    gate.searchParams.set('next', String(nextAfterCooldown || hub || '../hub.html'));

    const sp = new URL(location.href).searchParams;
    [
      'run','diff','time','seed','studyId','phase','conditionGroup','view','log',
      'planSeq','planDay','planSlot','planMode','planSlots','planIndex','autoNext',
      'plannedGame','finalGame','zone','cdnext','grade',
      'battle','room','autostart','forfeit','mode',
      'ai','pro','wait','nick'
    ].forEach(k=>{
      const v = sp.get(k);
      if(v!=null && v!=='') gate.searchParams.set(k, v);
    });

    return gate.toString();
  }

  function hhInjectCooldownButton({ endOverlayEl, hub, cat, gameKey, pid }){
    if(!endOverlayEl) return;
    const cdDone = hhCooldownDone(cat, gameKey, pid);
    if(cdDone) return;

    const sp = new URL(location.href).searchParams;
    const cdnext = sp.get('cdnext') || '';
    const nextAfterCooldown = cdnext || hub || '../hub.html';
    const url = hhBuildCooldownUrl({ hub, nextAfterCooldown, cat, gameKey, pid });

    const panel = endOverlayEl.querySelector('.panel') || endOverlayEl;
    let row = panel.querySelector('.hh-end-actions');
    if(!row){
      row = DOC.createElement('div');
      row.className = 'hh-end-actions';
      row.style.display='flex';
      row.style.gap='10px';
      row.style.flexWrap='wrap';
      row.style.justifyContent='center';
      row.style.marginTop='12px';
      row.style.paddingTop='10px';
      row.style.borderTop='1px solid rgba(148,163,184,.16)';
      panel.appendChild(row);
    }
    if(row.querySelector('[data-hh-cd="1"]')) return;

    const btn = DOC.createElement('button');
    btn.type='button';
    btn.dataset.hhCd = '1';
    btn.textContent='ไป Cooldown (ครั้งแรกของวันนี้)';
    btn.className = 'btn primary';
    btn.style.border='1px solid rgba(34,197,94,.30)';
    btn.style.background='rgba(34,197,94,.14)';
    btn.style.color='rgba(229,231,235,.96)';
    btn.style.borderRadius='14px';
    btn.style.padding='10px 12px';
    btn.style.fontWeight='1000';
    btn.style.cursor='pointer';
    btn.style.minHeight='42px';
    btn.addEventListener('click', ()=> location.href = url);
    row.appendChild(btn);
  }

  // ---------- deterministic RNG ----------
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
  const seedStr = String(cfg.seed || qs('seed', String(Date.now())));
  const rng = makeRng(seedStr);
  const r01 = ()=> rng();

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
    aiRisk: $('aiRisk'),
    aiHint: $('aiHint'),
  };
  const missionTitle = $('missionTitle');
  const missionGoal  = $('missionGoal');
  const missionHint  = $('missionHint');
  const missionFill  = $('missionFill');

  const endOverlay = $('endOverlay');
  const endTitle = $('endTitle');
  const endSub = $('endSub');
  const endGrade = $('endGrade');
  const endScore = $('endScore');
  const endMiss  = $('endMiss');
  const endTime  = $('endTime');
  const endMode  = $('endMode');
  const endDiff  = $('endDiff');

  const uiView = $('uiView');
  const uiRun  = $('uiRun');
  const uiDiff = $('uiDiff');

  if(!layer){
    console.warn('[GoodJunk] Missing #gj-layer');
    return;
  }

  // ---------- view/run/diff/time ----------
  const view = String(cfg.view || qs('view','mobile')).toLowerCase();
  const runMode = String(cfg.run || qs('run','play')).toLowerCase();
  const diff = String(cfg.diff || qs('diff','normal')).toLowerCase();
  const plannedSec = clamp(cfg.time ?? qs('time','80'), 20, 300);

  // hub / pid / cat / gameKey
  const pid = String(cfg.pid || qs('pid','anon')).trim() || 'anon';
  const nick = String(qs('nick', pid)).trim() || pid;
  const hubUrl = String(cfg.hub || qs('hub','../hub.html'));
  const HH_CAT = 'nutrition';
  const HH_GAME = 'goodjunk';

  // ✅ Battle: init + auto-ready
  initBattleMaybe(pid, HH_GAME).then((b)=>{
    battle = b || battle;
    if(battle && battle.enabled){
      try{ battle.setReady?.(true); }catch(e){}
    }
  }).catch(()=>{});

  try{
    if(uiView) uiView.textContent = view;
    if(uiRun)  uiRun.textContent  = runMode;
    if(uiDiff) uiDiff.textContent = diff;
  }catch(e){}

  // ---------- SOLO WIN targets + PRO switch ----------
  let stage = 0; // 0=Warm, 1=Trick, 2=Boss
  const STAGE_NAME = ['WARM', 'TRICK', 'BOSS'];

  const WIN_TARGET = (function(){
    let scoreTarget = 650;
    let goodTarget  = 40;
    if(diff==='easy'){ scoreTarget = 520; goodTarget = 32; }
    else if(diff==='hard'){ scoreTarget = 780; goodTarget = 46; }
    if(view==='cvr' || view==='vr'){ scoreTarget = Math.round(scoreTarget * 0.96); }
    return { scoreTarget, goodTarget };
  })();

  const PRO = (diff==='hard' && String(qs('pro','0'))==='1');

  const TUNE = (function(){
    let spawnBase = 0.78;
    let lifeMissLimit = 10;
    let ttlGood = 2.6;
    let ttlJunk = 2.9;
    let ttlBonus = 2.4;
    let stormMult = 1.0;
    let bossHp = 18;

    if(diff==='easy'){
      spawnBase = 0.68;
      lifeMissLimit = 14;
      ttlGood = 3.0;
      ttlJunk = 3.2;
      stormMult = 0.9;
      bossHp = 16;
    }else if(diff==='hard'){
      spawnBase = 0.95;
      lifeMissLimit = 8;
      ttlGood = 2.2;
      ttlJunk = 2.4;
      stormMult = 1.12;
      bossHp = 22;
    }
    if(view==='cvr' || view==='vr'){
      ttlGood += 0.15;
      ttlJunk += 0.15;
    }
    if(PRO){
      spawnBase *= 1.08;
      ttlGood   -= 0.10;
      ttlJunk   -= 0.08;
      stormMult *= 1.05;
      bossHp    += 3;
      lifeMissLimit = Math.max(6, lifeMissLimit - 1);
    }
    return { spawnBase, lifeMissLimit, ttlGood, ttlJunk, ttlBonus, stormMult, bossHp };
  })();

  const GOOD = ['🍎','🍌','🥦','🥬','🥚','🐟','🥛','🍚','🍞','🥑','🍉','🍊','🥕','🥒'];
  const JUNK = ['🍟','🍔','🍕','🍩','🍬','🧋','🥤','🍭','🍫'];
  const BONUS = ['⭐','💎','⚡'];

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
    fxLayer.appendChild(el);

    const t0 = nowMs();
    const dur = 520;
    const rise = 34 + (r01()*14);
    function tick(){
      const t = nowMs() - t0;
      const p = Math.min(1, t/dur);
      el.style.top = `${y - rise*p}px`;
      el.style.opacity = String(1 - p);
      el.style.transform = `translate(-50%,-50%) scale(${1 + 0.10*Math.sin(p*3.14)})`;
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
        dot.style.left = `${x + vx*p}px`;
        dot.style.top  = `${y + vy*p - 30*p*p}px`;
        dot.style.opacity = String(1 - p);
        dot.style.transform = `translate(-50%,-50%) scale(${1 - 0.4*p})`;
        if(p<1) requestAnimationFrame(tick);
        else dot.remove();
      }
      requestAnimationFrame(tick);
    }
  }

  // ---------- Coach (rate-limited, simple) ----------
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
  function sayCoach(msg){
    const t = nowMs();
    if(t - coachLatchMs < 3200) return;
    coachLatchMs = t;
    if(coachText) coachText.textContent = String(msg||'');
    coach.style.opacity = '1';
    coach.style.transform = 'translateY(0)';
    setTimeout(()=>{
      coach.style.opacity = '0';
      coach.style.transform = 'translateY(6px)';
    }, 1800);
  }

  // ---------- GAME STATE ----------
  const startTimeIso = nowIso();
  let playing = true;
  let paused = false;

  // ✅ wait-start (battle/race)
  const WAIT_START = (String(qs('wait','0')) === '1');
  if(WAIT_START) paused = true;

  WIN.__GJ_SET_PAUSED__ = function(on){
    paused = !!on;
    try{ lastTick = nowMs(); }catch(e){}
  };
  WIN.__GJ_START_NOW__ = function(){
    paused = false;
    lastTick = nowMs();
    sayCoach('GO! 🔥');
  };

  WIN.addEventListener('hha:battle-start', ()=>{ try{ WIN.__GJ_START_NOW__?.(); }catch(e){} });
  WIN.addEventListener('hha:battle-state', (ev)=>{
    try{
      const phase = String(ev?.detail?.phase || '').toLowerCase();
      if(phase === 'running' && paused) WIN.__GJ_START_NOW__?.();
    }catch(e){}
  });

  let tLeft = plannedSec;
  let lastTick = nowMs();

  let score = 0;
  let missTotal = 0;
  let missGoodExpired = 0;
  let missJunkHit = 0;

  let shots = 0;
  let hits  = 0;
  let goodHitCount = 0;

  let combo = 0;
  let bestCombo = 0;

  // stage goals
  let stageGoodNeed = (diff==='easy') ? 10 : (diff==='hard' ? 14 : 12);
  let stageScoreNeed = (diff==='easy') ? 180 : (diff==='hard' ? 260 : 220);

  // boss
  let bossActive = false;
  let bossHpMax = TUNE.bossHp;
  let bossHp = bossHpMax;

  // targets
  const targets = new Map();
  let idSeq = 1;

  // ---------- SAFE RECT (FIX “ขึ้นสวรรค์”) ----------
  function layerRect(){ return layer.getBoundingClientRect(); }
  function getHudSafePad(){
    // กัน HUD top + mission panel + coach bottom
    // ใช้ค่าคงที่ “แฟร์” และพึ่งพา safe-area
    const top = 140 + (parseFloat(getComputedStyle(DOC.documentElement).getPropertyValue('--sat'))||0);
    const bottom = 170 + (parseFloat(getComputedStyle(DOC.documentElement).getPropertyValue('--sab'))||0);
    const side = 16;
    return { top, bottom, left: side, right: side };
  }
  function safeRect(){
    const r = layerRect();
    const pad = getHudSafePad();
    const x0 = r.left + pad.left;
    const y0 = r.top  + pad.top;
    const x1 = r.right - pad.right;
    const y1 = r.bottom - pad.bottom;
    const w = Math.max(120, x1 - x0);
    const h = Math.max(160, y1 - y0);
    return { x0, y0, x1, y1, w, h };
  }
  function safeXY(){
    const s = safeRect();
    return {
      x: s.x0 + r01()*s.w,
      y: s.y0 + r01()*s.h
    };
  }

  // ---------- HUD ----------
  function gradeFrom(){
    // ง่ายๆ: score + miss
    if(score >= WIN_TARGET.scoreTarget && missTotal <= 2) return 'S';
    if(score >= WIN_TARGET.scoreTarget) return 'A';
    if(score >= WIN_TARGET.scoreTarget*0.78) return 'B';
    if(score >= WIN_TARGET.scoreTarget*0.62) return 'C';
    return 'D';
  }
  function setHUD(){
    if(hud.score) hud.score.textContent = String(score|0);
    if(hud.time) hud.time.textContent = String(Math.max(0, Math.ceil(tLeft)));
    if(hud.miss) hud.miss.textContent = String(missTotal|0);
    const g = gradeFrom();
    if(hud.grade) hud.grade.textContent = g;
    if(hud.goal) hud.goal.textContent = `${STAGE_NAME[stage]} • score≥${WIN_TARGET.scoreTarget} & good≥${WIN_TARGET.goodTarget}`;
    if(hud.goalCur) hud.goalCur.textContent = String(score|0);
    if(hud.goalTarget) hud.goalTarget.textContent = String(WIN_TARGET.scoreTarget|0);

    if(missionTitle) missionTitle.textContent = (stage===0?'WARM-UP':stage===1?'TRICK':'BOSS');
    if(missionHint){
      if(stage===0) missionHint.textContent = 'โฟกัสของดี (+) ทำคอมโบ';
      else if(stage===1) missionHint.textContent = 'ของขยะจะถี่ขึ้น! ระวังยิงพลาด';
      else missionHint.textContent = bossActive ? 'ตีบอสให้แตก! (hit = -HP)' : 'บอสมาแล้ว!';
    }
    if(missionGoal){
      if(stage<2) missionGoal.textContent = `ผ่านด่าน: good≥${stageGoodNeed} + score≥${stageScoreNeed}`;
      else missionGoal.textContent = bossActive ? `BOSS HP ${bossHp}/${bossHpMax}` : 'BOSS!';
    }
    if(hud.goalDesc){
      hud.goalDesc.textContent = `เป้าหมาย: score ≥ ${WIN_TARGET.scoreTarget} และ good ≥ ${WIN_TARGET.goodTarget}`;
    }
    if(missionFill){
      let p = 0;
      if(stage===0 || stage===1){
        const pg = Math.min(1, goodHitCount / Math.max(1,stageGoodNeed));
        const ps = Math.min(1, score / Math.max(1,stageScoreNeed));
        p = Math.min(1, (pg*0.55 + ps*0.45));
      }else{
        p = bossActive ? (1 - (bossHp/Math.max(1,bossHpMax))) : 0.15;
      }
      missionFill.style.width = `${Math.max(0,Math.min(1,p))*100}%`;
    }
  }

  // ---------- SPAWN ----------
  function makeTarget(kind){
    const id = String(idSeq++);
    const el = DOC.createElement('div');
    el.className = 'tgt pop';
    const xy = safeXY();

    let emoji = '🍎';
    let ttl = 2600;
    let scoreHit = 20;
    let bad = false;

    if(kind==='good'){
      emoji = pick(GOOD, r01);
      ttl = TUNE.ttlGood*1000;
      scoreHit = 22;
      el.classList.toggle('big', r01()<0.18);
    }else if(kind==='junk'){
      emoji = pick(JUNK, r01);
      ttl = TUNE.ttlJunk*1000;
      scoreHit = -18;
      bad = true;
      el.classList.toggle('small', r01()<0.22);
    }else{
      emoji = pick(BONUS, r01);
      ttl = TUNE.ttlBonus*1000;
      scoreHit = 35;
      el.classList.toggle('big', true);
    }

    el.textContent = emoji;
    el.style.left = `${xy.x}px`;
    el.style.top  = `${xy.y}px`;

    const born = nowMs();
    const item = { id, el, kind, emoji, born, ttl, scoreHit, bad, dead:false };
    targets.set(id, item);

    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      onHit(item, ev.clientX, ev.clientY);
    });

    layer.appendChild(el);
    return item;
  }

  // spawn pacing
  let spawnAcc = 0;
  function spawnPlan(dt){
    // base rate + stage
    let rate = TUNE.spawnBase; // targets/sec
    if(stage===1) rate *= 1.12;
    if(stage===2) rate *= 1.06;
    if(bossActive) rate *= 0.90;

    spawnAcc += dt * rate;
    while(spawnAcc >= 1){
      spawnAcc -= 1;

      // choose kind
      let kind = 'good';
      const r = r01();
      if(stage===0){
        kind = (r < 0.68) ? 'good' : (r < 0.95 ? 'junk' : 'bonus');
      }else if(stage===1){
        kind = (r < 0.58) ? 'good' : (r < 0.96 ? 'junk' : 'bonus');
      }else{
        kind = (r < 0.60) ? 'good' : (r < 0.98 ? 'junk' : 'bonus');
      }

      // boss: inject weak-point sometimes
      if(bossActive && r01()<0.16) kind = 'bonus';

      makeTarget(kind);
    }
  }

  // ---------- HIT / EXPIRE ----------
  function killTarget(it, reason){
    if(!it || it.dead) return;
    it.dead = true;
    try{ it.el.remove(); }catch(e){}
    targets.delete(it.id);

    if(reason==='expired'){
      if(it.kind==='good'){
        missTotal += 1;
        missGoodExpired += 1;
        combo = 0;
      }
    }
  }

  function onHit(it, x, y){
    if(!playing || paused) return;
    if(!it || it.dead) return;

    shots += 1;

    if(it.kind==='junk'){
      // penalty
      missTotal += 1;
      missJunkHit += 1;
      combo = 0;
      score = Math.max(0, score + it.scoreHit);
      fxFloatText(x,y,'-MISS', true);
      fxBurst(x,y);
      killTarget(it, 'hit');
      return;
    }

    // good / bonus
    hits += 1;
    if(it.kind==='good'){
      goodHitCount += 1;
      combo += 1;
      bestCombo = Math.max(bestCombo, combo);
      score += it.scoreHit + Math.min(18, combo);
      fxFloatText(x,y,`+${it.scoreHit + Math.min(18, combo)}`, false);
      fxBurst(x,y);
      if(combo===6) sayCoach('คอมโบมาแล้ว! 🔥');
      if(combo===10) sayCoach('สุดยอด! รักษาคอมโบไว้!');
    }else{
      // bonus
      combo += 2;
      bestCombo = Math.max(bestCombo, combo);
      score += it.scoreHit;
      fxFloatText(x,y,`+${it.scoreHit} BONUS`, false);
      fxBurst(x,y);
      sayCoach('เก็บ BONUS ดีมาก!');
    }

    // boss damage (stage 2)
    if(stage===2){
      if(!bossActive){
        bossActive = true;
        bossHpMax = TUNE.bossHp;
        bossHp = bossHpMax;
        sayCoach('บอสมา! ตีให้แตก! 👊');
      }else{
        bossHp = Math.max(0, bossHp - 1);
        if(bossHp<=0){
          // boss clear -> big reward
          score += 120;
          sayCoach('บอสแตก! +120 🔥');
          bossActive = false; // can reappear lightly
          // end fast if already reach win targets
          if(score >= WIN_TARGET.scoreTarget && goodHitCount >= WIN_TARGET.goodTarget){
            endGame('win');
          }
        }
      }
    }

    killTarget(it, 'hit');
  }

  // cVR shoot support (vr-ui.js emits hha:shoot {x,y} in screen coords)
  WIN.addEventListener('hha:shoot', (ev)=>{
    try{
      const d = ev?.detail || {};
      const x = Number(d.x), y = Number(d.y);
      if(!Number.isFinite(x) || !Number.isFinite(y)) return;
      // find nearest target within radius
      let best=null, bestDist=1e9;
      targets.forEach(it=>{
        if(it.dead) return;
        const r = it.el.getBoundingClientRect();
        const cx = r.left + r.width/2;
        const cy = r.top  + r.height/2;
        const dx = cx-x, dy = cy-y;
        const dist = Math.hypot(dx,dy);
        if(dist < bestDist){
          bestDist = dist; best = it;
        }
      });
      if(best && bestDist < 90) onHit(best, x, y);
      else{
        shots += 1;
        combo = 0;
      }
    }catch(e){}
  });

  // ---------- STAGE PROGRESSION ----------
  function advanceStageIfNeeded(){
    if(stage===0 || stage===1){
      if(goodHitCount >= stageGoodNeed && score >= stageScoreNeed){
        stage += 1;
        combo = 0;
        // tighten goals for next stage
        stageGoodNeed += (stage===1 ? (diff==='hard'?7:6) : 0);
        stageScoreNeed += (stage===1 ? (diff==='hard'?180:150) : 0);
        sayCoach(stage===1 ? 'เข้าสู่ TRICK! ของขยะถี่ขึ้น 😈' : 'เข้าสู่ BOSS! เตรียมตัว! 👹');
      }
    }else{
      if(!bossActive && tLeft < Math.max(12, plannedSec*0.35)){
        bossActive = true;
        bossHpMax = TUNE.bossHp;
        bossHp = bossHpMax;
        sayCoach('FINAL BOSS โผล่! 🔥');
      }
    }
  }

  // ---------- END ----------
  function showEnd(){
    if(!endOverlay) return;
    endOverlay.classList.add('show');

    if(endTitle) endTitle.textContent = 'จบเกม';
    const g = gradeFrom();
    if(endSub) endSub.textContent = `pid=${pid} • ${nick} • reason=${endReason}`;
    if(endGrade) endGrade.textContent = g;
    if(endScore) endScore.textContent = String(score|0);
    if(endMiss)  endMiss.textContent  = String(missTotal|0);
    if(endTime)  endTime.textContent  = String(plannedSec|0);
    if(endMode)  endMode.textContent  = String(mode||'solo');
    if(endDiff)  endDiff.textContent  = String(diff||'normal');

    // inject cooldown button (daily-first per game)
    hhInjectCooldownButton({ endOverlayEl: endOverlay, hub: hubUrl, cat: HH_CAT, gameKey: HH_GAME, pid });

    const btnAgain = DOC.getElementById('btnAgain');
    const btnBackHub = DOC.getElementById('btnBackHub');
    if(btnAgain){
      btnAgain.onclick = ()=>{
        const u = new URL(location.href);
        u.searchParams.set('seed', String(Date.now()));
        location.href = u.toString();
      };
    }
    if(btnBackHub){
      btnBackHub.onclick = ()=> location.href = hubUrl || '../hub.html';
    }
  }

  function saveLastSummary(){
    const accPct = (shots>0) ? Math.round((hits/shots)*100) : 0;
    const sum = {
      ts: Date.now(),
      game: HH_GAME,
      pid,
      nick,
      mode,
      diff,
      run: runMode,
      view,
      seed: seedStr,
      time: plannedSec,
      score, missTotal, missGoodExpired, missJunkHit,
      shots, hits, accPct,
      bestCombo,
      grade: gradeFrom(),
      reason: endReason,
      startTimeIso,
      endTimeIso: nowIso(),
    };
    try{
      hhLsSet(`HHA_LAST_SUMMARY:${HH_GAME}:${pid}`, JSON.stringify(sum));
      hhLsSet('HHA_LAST_SUMMARY', JSON.stringify(sum));
    }catch(e){}
  }

  let endReason = 'time';
  function endGame(reason){
    if(!playing) return;
    playing = false;
    endReason = String(reason||'time');
    // kill all
    targets.forEach(it=>{ try{ it.el.remove(); }catch(e){} });
    targets.clear();

    setHUD();
    saveLastSummary();
    showEnd();
  }

  // ---------- MAIN TICK ----------
  function tick(){
    const t = nowMs();
    let dt = (t - lastTick)/1000;
    if(!Number.isFinite(dt) || dt<0) dt = 0;
    if(dt>0.10) dt = 0.10;
    lastTick = t;

    if(playing){
      if(!paused){
        tLeft -= dt;

        // expire targets
        targets.forEach(it=>{
          if(it.dead) return;
          if((t - it.born) > it.ttl){
            killTarget(it, 'expired');
          }
        });

        spawnPlan(dt);
        advanceStageIfNeeded();

        // lose condition
        if(missTotal >= TUNE.lifeMissLimit){
          endGame('miss-limit');
        }
        // win condition (solo style)
        if(score >= WIN_TARGET.scoreTarget && goodHitCount >= WIN_TARGET.goodTarget && stage>=2){
          endGame('win');
        }
        if(tLeft <= 0){
          endGame('time');
        }
      }
      setHUD();
      requestAnimationFrame(tick);
    }
  }

  // ---------- start ----------
  if(WAIT_START){
    sayCoach('BATTLE/RACE: รอเริ่มพร้อมกัน… ⏳');
  }else{
    sayCoach('เริ่มเลย! โฟกัสของดี! 🥦');
  }

  setHUD();
  requestAnimationFrame(tick);
}