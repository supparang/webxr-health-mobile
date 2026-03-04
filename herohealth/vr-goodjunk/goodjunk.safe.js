// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE — SOLO PRODUCTION (3-Stage + PRO + AI Explainable + Stage Rewards + Boss Pattern)
// PATCH v20260304-SOLO-PRO-3STAGE-PACK1-2-REWARD-BOSSPATTERN
//
// ✅ diff: easy/normal/hard
// ✅ pro: ?pro=1
// ✅ 3-stage: WARM → TRICK → BOSS
// ✅ PACK 1: TRICK rewards/penalties → affects Boss (bossHP, shieldStart, fever bonus)
// ✅ PACK 2: Boss pattern generator (seeded deterministic): Shield Ring → Weakspot Swap → Burst
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

  // PACK 1: TRICK performance window (for reward/penalty)
  const TRICK_MET = {
    started:false,
    startMiss:0,
    startJunk:0,
    startExp:0,
    startScore:0,
    bestComboInTrick:0,
    goodHitsInTrick:0,
    junkHitsInTrick:0,
    goodExpInTrick:0,
    shieldPickedInTrick:0,
    scoreDelta:0,
    applied:false,
    grade:'MID'
  };

  const targets = new Map();
  let idSeq = 1;

  function layerRect(){ return layer.getBoundingClientRect(); }

  function getSpawnSafeLocal(){
    const r = layerRect();
    let s = null;
    try{ s = WIN.__HHA_SPAWN_SAFE__ || null; }catch(e){ s = null; }

    if(s && Number.isFinite(s.xMin) && Number.isFinite(s.xMax) && Number.isFinite(s.yMin) && Number.isFinite(s.yMax)){
      let xMin = Number(s.xMin) - r.left;
      let xMax = Number(s.xMax) - r.left;
      let yMin = Number(s.yMin) - r.top;
      let yMax = Number(s.yMax) - r.top;

      xMin = clamp(xMin, 0, r.width);
      xMax = clamp(xMax, 0, r.width);
      yMin = clamp(yMin, 0, r.height);
      yMax = clamp(yMax, 0, r.height);

      if((xMax - xMin) >= 160 && (yMax - yMin) >= 180){
        return { xMin, xMax, yMin, yMax, w:r.width, h:r.height };
      }
    }

    // fallback
    const pad = 18;
    const yMin = Math.min(r.height - 180, 190);
    const yMax = Math.max(yMin + 180, r.height - 130);
    return {
      xMin: pad,
      xMax: Math.max(pad + 160, r.width - pad),
      yMin: clamp(yMin, pad, Math.max(pad, r.height - 220)),
      yMax: clamp(yMax, Math.max(pad+180, yMin+180), Math.max(pad+240, r.height - pad)),
      w: r.width,
      h: r.height
    };
  }

  function median(arr){
    if(!arr || !arr.length) return 0;
    const a = arr.slice().sort((x,y)=>x-y);
    const m = (a.length/2)|0;
    return (a.length%2) ? a[m] : (a[m-1]+a[m])/2;
  }
  function accPct(){
    return shots>0 ? Math.round((hits/shots)*1000)/10 : 0;
  }
  function gradeFromScore(s){
    const played = Math.max(1, plannedSec - tLeft);
    const sps = s / played;
    const pen = missTotal * 6;
    const x = sps*10 - pen*0.4;
    if(x >= 70) return 'S';
    if(x >= 55) return 'A';
    if(x >= 40) return 'B';
    if(x >= 28) return 'C';
    return 'D';
  }

  // throttle score event (optional)
  let lastScoreEmitMs = 0;
  function emitScoreEvent(force=false){
    const t = nowMs();
    if(!force && (t - lastScoreEmitMs) < 250) return;
    lastScoreEmitMs = t;
    try{
      const payload = {
        score: score|0,
        miss: missTotal|0,
        accPct: accPct(),
        shots: shots|0,
        hits: hits|0,
        combo: combo|0,
        comboMax: bestCombo|0,
        feverPct: +clamp(fever,0,100),
        shield: shield|0,
        missGoodExpired: missGoodExpired|0,
        missJunkHit: missJunkHit|0,
        medianRtGoodMs: Math.round(median(rtList))|0,
        stage,
        pro: !!pro
      };
      WIN.dispatchEvent(new CustomEvent('hha:score', { detail: payload }));
    }catch(e){}
  }

  function setStageHUD(){
    if(!hud.stage) return;
    hud.stage.textContent = stage;
    if(hud.stageDesc){
      if(stage===STAGE.WARM) hud.stageDesc.textContent = 'เก็บของดีให้ติดคอมโบ';
      else if(stage===STAGE.TRICK) hud.stageDesc.textContent = pro ? 'กับดักมา! เลือกยิงให้ชัวร์' : 'จังหวะหลอก! เลือกยิง';
      else hud.stageDesc.textContent = 'บอสมาแล้ว! แตกโล่แล้วค่อยยิง 🎯';
    }
  }

  function setHUD(){
    if(hud.score) hud.score.textContent = String(score|0);
    if(hud.time) hud.time.textContent = String(Math.ceil(tLeft));
    if(hud.miss) hud.miss.textContent = String(missTotal|0);
    if(hud.grade) hud.grade.textContent = gradeFromScore(score);

    if(hud.goal) hud.goal.textContent = goal.name;
    if(hud.goalCur) hud.goalCur.textContent = String(goal.cur|0);
    if(hud.goalTarget) hud.goalTarget.textContent = String(goal.target|0);
    if(hud.goalDesc) hud.goalDesc.textContent = goal.desc;

    if(hud.mini) hud.mini.textContent = mini.name;
    if(hud.miniTimer) hud.miniTimer.textContent = mini.t>0 ? `${Math.ceil(mini.t)}s` : '—';

    setStageHUD();

    if(feverFill) feverFill.style.width = `${clamp(fever,0,100)}%`;
    if(feverText) feverText.textContent = `${Math.round(clamp(fever,0,100))}%`;

    if(shieldPills){
      if(shield<=0) shieldPills.textContent = '—';
      else shieldPills.textContent = '🛡️'.repeat(Math.min(6, shield));
    }

    if(bossBar){
      if(!bossActive){
        bossBar.setAttribute('aria-hidden','true');
      }else{
        bossBar.setAttribute('aria-hidden','false');
        const hpPct = (bossHpMax>0) ? (bossHp/bossHpMax)*100 : 0;
        if(bossFill) bossFill.style.width = `${clamp(hpPct,0,100)}%`;
        if(bossHint){
          bossHint.textContent =
            bossPhase===0 ? 'Shield up! Break 🛡️ ring' : (bossPhase===1 ? 'Weakspot 🎯 swap!' : 'Burst! pick best 🎯');
        }
      }
    }

    if(progressWrap && progressFill){
      const p = (plannedSec>0) ? (1 - (tLeft/plannedSec)) : 0;
      progressWrap.setAttribute('aria-hidden','false');
      progressFill.style.width = `${clamp(p*100,0,100)}%`;
    }

    if(lowTimeOverlay){
      if(tLeft <= 5 && tLeft > 0){
        lowTimeOverlay.setAttribute('aria-hidden','false');
        if(lowTimeNum) lowTimeNum.textContent = String(Math.ceil(tLeft));
      }else{
        lowTimeOverlay.setAttribute('aria-hidden','true');
      }
    }

    emitScoreEvent(false);
  }

  function buildEndSummary(reason){
    const playedSec = Math.round(plannedSec - tLeft);
    const avgRt = goodHitCount>0 ? Math.round(rtSum/goodHitCount) : 0;
    const medRt = Math.round(median(rtList));
    const acc = accPct();
    return {
      projectTag: 'GoodJunkVR',
      gameKey: HH_GAME,
      pid,
      zone: HH_CAT,
      gameVersion: 'GoodJunkVR_SAFE_2026-03-04_PACK1-2_REWARD_BOSSPATTERN',
      device: view,
      runMode, diff,
      pro: !!pro,
      seed: seedStr,
      reason: String(reason || ''),
      durationPlannedSec: plannedSec,
      durationPlayedSec: playedSec,
      scoreFinal: score|0,
      missTotal: missTotal|0,
      accPct: acc,
      shots: shots|0,
      hits: hits|0,
      comboMax: bestCombo|0,
      missGoodExpired: missGoodExpired|0,
      missJunkHit: missJunkHit|0,
      avgRtGoodMs: avgRt|0,
      medianRtGoodMs: medRt|0,
      bossDefeated: !!(bossActive && bossHp<=0),
      stageEnd: stage,
      shieldEnd: shield|0,
      trickPerf: TRICK_MET,
      startTimeIso,
      endTimeIso: nowIso(),
      grade: gradeFromScore(score),
      aiPredictionLast: (function(){ try{ return AI?.getPrediction?.() || null; }catch(e){ return null; } })(),
      aiEnd: (function(){ try{ return AI?.onEnd?.({}) || null; }catch(e){ return null; } })()
    };
  }

  function showEnd(reason){
    playing = false;
    paused = false;

    for(const t of targets.values()){
      try{ t.el.remove(); }catch(e){}
    }
    targets.clear();

    const summary = buildEndSummary(reason);
    WIN.__HHA_LAST_SUMMARY = summary;

    if(endOverlay){
      endOverlay.setAttribute('aria-hidden','false');
      if(endTitle) endTitle.textContent = 'Game Over';
      if(endSub) endSub.textContent = `reason=${summary.reason} | diff=${diff}${pro?'+PRO':''} | acc=${summary.accPct}% | medRT=${summary.medianRtGoodMs}ms`;
      if(endGrade) endGrade.textContent = summary.grade || '—';
      if(endScore) endScore.textContent = String(summary.scoreFinal|0);
      if(endMiss)  endMiss.textContent  = String(summary.missTotal|0);
      if(endTime)  endTime.textContent  = String(summary.durationPlayedSec|0);
    }

    emitScoreEvent(true);
    sayCoach(summary.missTotal >= TUNE.lifeMissLimit ? 'โฟกัส “ของดี” ก่อนนะ แล้วค่อยเสี่ยง!' : 'ดีมาก! ไปต่อได้เลย ✨', 0);
    setHUD();
  }

  // ---------- gameplay ----------
  function makeTargetAt(kind, emoji, ttlSec, x, y){
    const id = String(idSeq++);
    const el = DOC.createElement('div');
    el.className = 'gj-target';
    el.textContent = emoji;
    el.dataset.id = id;
    el.dataset.kind = kind;

    el.style.left = `${x}px`;
    el.style.top  = `${y}px`;
    el.style.opacity = '1';

    const drift = (r01()*2-1) * (view==='mobile' ? 16 : 22);
    const born = nowMs();
    const ttl = Math.max(0.85, ttlSec) * 1000;

    layer.appendChild(el);

    const tObj = { id, el, kind, born, ttl, x, y, drift, promptMs: nowMs(), bossFlag:false };
    targets.set(id, tObj);

    try{ AI?.onSpawn?.(kind, { id, emoji, ttlSec }); }catch(e){}
    return tObj;
  }

  function makeTarget(kind, emoji, ttlSec){
    const safe = getSpawnSafeLocal();
    const rPad = (view==='mobile') ? 34 : 42;

    const xMin = safe.xMin + rPad;
    const xMax = safe.xMax - rPad;
    const yMin = safe.yMin + rPad;
    const yMax = safe.yMax - rPad;

    const x = xMin + r01()*(Math.max(1, xMax - xMin));
    const y = yMin + r01()*(Math.max(1, yMax - yMin));

    return makeTargetAt(kind, emoji, ttlSec, x, y);
  }

  function removeTarget(id){
    const t = targets.get(String(id));
    if(!t) return;
    targets.delete(String(id));
    try{ t.el.remove(); }catch(e){}
  }

  function addFever(v){
    fever = clamp(fever + v, 0, 100);
    if(fever >= 100 && !rageOn){
      rageOn = true;
      rageLeft = 7.0;
      fever = 100;
      sayCoach('FEVER! คะแนนคูณ 🔥');
    }
  }

  function addShield(){
    shield = clamp(shield + 1, 0, 9);
    if(stage===STAGE.TRICK && TRICK_MET.started) TRICK_MET.shieldPickedInTrick++;
    sayCoach('ได้โล่! 🛡️ กันของเสียได้');
  }

  // ---------- Boss pattern generator (PACK 2) ----------
  const BOSS_PAT = {
    active:false,
    t:0,
    next:0,
    step:0,
    ringIdx:0,
    weakIdx:0,
    burstLeft:0,
    ringPoints:[],
    weakPoints:[],
    patternSeed: 0,
    // derived from trick rewards:
    hpMod:0,
    shieldStart:0,
    feverBonus:0,
    note:''
  };

  function buildBossPoints(){
    const r = layerRect();
    const safe = getSpawnSafeLocal();
    const cx = r.width/2;
    const cy = (safe.yMin + safe.yMax)/2;

    const rad = Math.min(180, Math.max(110, Math.min(r.width, (safe.yMax-safe.yMin)) * 0.28));
    const pts = [];
    const n = 6;
    for(let i=0;i<n;i++){
      const ang = (Math.PI*2) * (i/n);
      const x = cx + Math.cos(ang)*rad;
      const y = cy + Math.sin(ang)*rad*0.78;
      pts.push({ x, y });
    }
    const wpts = [
      { x: cx, y: cy - rad*0.55 },
      { x: cx + rad*0.62, y: cy - rad*0.10 },
      { x: cx + rad*0.35, y: cy + rad*0.55 },
      { x: cx - rad*0.35, y: cy + rad*0.55 },
      { x: cx - rad*0.62, y: cy - rad*0.10 },
    ];

    // clamp into safe rect
    const clampPt = (p)=>{
      const pad = (view==='mobile') ? 44 : 52;
      return {
        x: clamp(p.x, safe.xMin+pad, safe.xMax-pad),
        y: clamp(p.y, safe.yMin+pad, safe.yMax-pad)
      };
    };
    BOSS_PAT.ringPoints = pts.map(clampPt);
    BOSS_PAT.weakPoints = wpts.map(clampPt);
  }

  function bossStartWithMods(){
    // apply trick rewards once, then freeze mods for deterministic boss
    if(!TRICK_MET.applied){
      applyTrickRewardsToBoss();
    }

    bossActive = true;
    bossHpMax = clamp(TUNE.bossHp + BOSS_PAT.hpMod, 10, 60);
    bossHp = bossHpMax;
    bossPhase = 0;

    // shield ring hp = base + (pro?1:0) - reward maybe
    bossShieldHp = clamp((pro ? 6 : 5) + BOSS_PAT.shieldStart, 3, 12);

    addFever(BOSS_PAT.feverBonus);

    BOSS_PAT.active = true;
    BOSS_PAT.t = 0;
    BOSS_PAT.step = 0;
    BOSS_PAT.next = 0.15;
    BOSS_PAT.ringIdx = 0;
    BOSS_PAT.weakIdx = 0;
    BOSS_PAT.burstLeft = 0;

    buildBossPoints();

    sayCoach(`เข้า BOSS! ${BOSS_PAT.note}`.trim(), 0);
  }

  function bossTick(dt){
    if(!BOSS_PAT.active || !bossActive) return;
    BOSS_PAT.t += dt;

    // phase 0: shield ring (spawn 1 ring target every 0.28s until enough hits break shield)
    if(bossPhase===0){
      if(BOSS_PAT.t >= BOSS_PAT.next){
        BOSS_PAT.next = BOSS_PAT.t + (pro ? 0.26 : 0.28);
        const p = BOSS_PAT.ringPoints[BOSS_PAT.ringIdx % BOSS_PAT.ringPoints.length];
        BOSS_PAT.ringIdx++;
        const t = makeTargetAt('boss', BOSS_SHIELD, 1.9, p.x, p.y);
        t.bossFlag = true;
      }
      return;
    }

    // phase 1: weakspot swap (spawn weak every 0.42s + occasional junk burst)
    if(bossPhase===1){
      if(BOSS_PAT.t >= BOSS_PAT.next){
        const base = (diff==='hard') ? 0.40 : 0.44;
        BOSS_PAT.next = BOSS_PAT.t + (pro ? base*0.94 : base);

        const p = BOSS_PAT.weakPoints[BOSS_PAT.weakIdx % BOSS_PAT.weakPoints.length];
        BOSS_PAT.weakIdx++;

        const wt = makeTargetAt('boss', WEAK, 1.55, p.x, p.y);
        wt.bossFlag = true;

        // deterministic mini burst: every 3 swaps spawn 2 junk near corners (pressure but fair)
        if((BOSS_PAT.weakIdx % 3)===0){
          const safe = getSpawnSafeLocal();
          const pads = (view==='mobile') ? 60 : 70;
          const corners = [
            { x: safe.xMin+pads, y: safe.yMin+pads },
            { x: safe.xMax-pads, y: safe.yMin+pads },
            { x: safe.xMax-pads, y: safe.yMax-pads },
            { x: safe.xMin+pads, y: safe.yMax-pads },
          ];
          const c1 = corners[(BOSS_PAT.weakIdx+1) % 4];
          const c2 = corners[(BOSS_PAT.weakIdx+2) % 4];
          makeTargetAt('junk', rPick(JUNK), 1.25, c1.x, c1.y);
          makeTargetAt('junk', rPick(JUNK), 1.25, c2.x, c2.y);
        }

        // trigger burst mode when boss hp low
        if(bossHp <= Math.max(6, Math.round(bossHpMax*0.32))){
          bossPhase = 2;
          BOSS_PAT.burstLeft = pro ? 10 : 8;
          BOSS_PAT.next = BOSS_PAT.t + 0.20;
          sayCoach('BOSS BURST! เลือกยิง 🎯 ที่คุ้มสุด', 0);
        }
      }
      return;
    }

    // phase 2: burst (spawn 2 weakspots quickly, short TTL)
    if(bossPhase===2){
      if(BOSS_PAT.burstLeft<=0){
        bossPhase = 1;
        BOSS_PAT.next = BOSS_PAT.t + 0.30;
        return;
      }
      if(BOSS_PAT.t >= BOSS_PAT.next){
        BOSS_PAT.next = BOSS_PAT.t + (pro ? 0.26 : 0.29);
        BOSS_PAT.burstLeft--;

        const idxA = (BOSS_PAT.weakIdx + 1) % BOSS_PAT.weakPoints.length;
        const idxB = (BOSS_PAT.weakIdx + 3) % BOSS_PAT.weakPoints.length;
        const a = BOSS_PAT.weakPoints[idxA];
        const b = BOSS_PAT.weakPoints[idxB];
        BOSS_PAT.weakIdx += 2;

        const ta = makeTargetAt('boss', WEAK, 1.05, a.x, a.y); ta.bossFlag = true;
        const tb = makeTargetAt('boss', WEAK, 1.05, b.x, b.y); tb.bossFlag = true;

        // fair: sometimes drop a shield pill in burst if player low
        if(shield<=0 && (BOSS_PAT.burstLeft % 3)===0){
          const safe = getSpawnSafeLocal();
          makeTargetAt('shield', '🛡️', 1.10, (safe.xMin+safe.xMax)/2, safe.yMax-64);
        }
      }
    }
  }

  // ---------- Stage reward/penalty (PACK 1) ----------
  function startTrickMetrics(){
    if(TRICK_MET.started) return;
    TRICK_MET.started = true;
    TRICK_MET.startMiss = missTotal;
    TRICK_MET.startJunk = missJunkHit;
    TRICK_MET.startExp  = missGoodExpired;
    TRICK_MET.startScore = score;
    TRICK_MET.bestComboInTrick = 0;
    TRICK_MET.goodHitsInTrick = 0;
    TRICK_MET.junkHitsInTrick = 0;
    TRICK_MET.goodExpInTrick = 0;
    TRICK_MET.shieldPickedInTrick = 0;
    TRICK_MET.scoreDelta = 0;
    TRICK_MET.applied = false;
    TRICK_MET.grade = 'MID';
  }

  function finishTrickMetrics(){
    if(!TRICK_MET.started) return;
    TRICK_MET.scoreDelta = (score - TRICK_MET.startScore) | 0;
    // deltas:
    TRICK_MET.junkHitsInTrick = Math.max(0, missJunkHit - TRICK_MET.startJunk);
    TRICK_MET.goodExpInTrick  = Math.max(0, missGoodExpired - TRICK_MET.startExp);

    // grade heuristic (simple + fair)
    const bad = TRICK_MET.junkHitsInTrick*2 + TRICK_MET.goodExpInTrick;
    const good = TRICK_MET.goodHitsInTrick + Math.floor(TRICK_MET.bestComboInTrick/2) + TRICK_MET.shieldPickedInTrick;
    if(bad<=1 && TRICK_MET.bestComboInTrick>=7 && TRICK_MET.goodHitsInTrick>=10) TRICK_MET.grade='GREAT';
    else if(bad<=2 && TRICK_MET.bestComboInTrick>=5 && TRICK_MET.goodHitsInTrick>=7) TRICK_MET.grade='OK';
    else TRICK_MET.grade='ROUGH';
  }

  function applyTrickRewardsToBoss(){
    finishTrickMetrics();
    TRICK_MET.applied = true;

    // base mods (0)
    BOSS_PAT.hpMod = 0;
    BOSS_PAT.shieldStart = 0;
    BOSS_PAT.feverBonus = 0;
    BOSS_PAT.note = '';

    // Reward/penalty table (แฟร์: รางวัลช่วยนิด โทษลดโอกาสเล็กน้อย ไม่ทำให้แพ้ทันที)
    if(TRICK_MET.grade==='GREAT'){
      BOSS_PAT.hpMod = pro ? -4 : -3;         // boss easier a bit
      BOSS_PAT.shieldStart = pro ? -1 : -1;   // fewer shield hits needed
      BOSS_PAT.feverBonus = 18;
      shield = clamp(shield + 1, 0, 9);
      score += 40;
      BOSS_PAT.note = '✅ TRICK GREAT: บอสอ่อนลง + ได้โบนัส';
      sayCoach('TRICK GREAT! บอสอ่อนลง + ได้โล่/FEVER', 0);
      fxFloatText(layerRect().left+layerRect().width/2, layerRect().top+layerRect().height*0.55, 'TRICK GREAT +40', false);
    }else if(TRICK_MET.grade==='OK'){
      BOSS_PAT.hpMod = pro ? -2 : -1;
      BOSS_PAT.shieldStart = 0;
      BOSS_PAT.feverBonus = 10;
      score += 20;
      BOSS_PAT.note = '🟡 TRICK OK: ได้บัฟเล็กน้อย';
      sayCoach('TRICK OK! ได้บัฟเล็กน้อย ไปบอส!', 0);
      fxFloatText(layerRect().left+layerRect().width/2, layerRect().top+layerRect().height*0.55, 'TRICK OK +20', false);
    }else{
      // ROUGH: boss slightly tougher but give safety shield if too low
      BOSS_PAT.hpMod = pro ? +2 : +1;
      BOSS_PAT.shieldStart = pro ? +1 : +0;
      BOSS_PAT.feverBonus = 0;
      if(shield<=0) shield = 1;
      BOSS_PAT.note = '⚠️ TRICK ROUGH: บอสแข็งขึ้นนิด แต่มีโล่กันพัง';
      sayCoach('TRICK ROUGH… บอสแข็งขึ้นนิด แต่ยังมีโล่ให้แก้มือ', 0);
      fxFloatText(layerRect().left+layerRect().width/2, layerRect().top+layerRect().height*0.55, 'TRICK ROUGH', true);
    }
  }

  // ---------- hit handlers ----------
  function onHitGood(t, clientX, clientY){
    const rt = Math.max(0, Math.round(nowMs() - (t.promptMs||nowMs())));
    goodHitCount++;
    rtSum += rt;
    rtList.push(rt);

    hits++;
    combo++;
    bestCombo = Math.max(bestCombo, combo);

    let add = 10 + Math.min(12, combo);
    if(rageOn) add = Math.round(add * 1.6);

    score += add;
    goal.cur = clamp(goal.cur + 1, 0, 9999);
    addFever(6.5);

    if(stage===STAGE.TRICK && TRICK_MET.started){
      TRICK_MET.goodHitsInTrick++;
      TRICK_MET.bestComboInTrick = Math.max(TRICK_MET.bestComboInTrick, combo);
    }

    fxBurst(clientX, clientY);
    fxFloatText(clientX, clientY-10, `+${add}`, false);

    if(combo===5) sayCoach('คอมโบเริ่มมาแล้ว! 🔥');
    if(rt <= 520 && combo>=3) sayCoach('ดี! รีแอคไวมาก');

    try{ AI?.onHit?.(t.kind, { id:t.id }); }catch(e){}
    removeTarget(t.id);
  }

  function onHitJunk(t, clientX, clientY){
    if(shield > 0){
      shield--;
      hits++;
      fxBurst(clientX, clientY);
      fxFloatText(clientX, clientY-10, 'BLOCK 🛡️', false);
      sayCoach('บล็อกได้! โดนของเสียไม่เป็นไร');
      try{ AI?.onHit?.(t.kind, { id:t.id, blocked:true }); }catch(e){}
      removeTarget(t.id);
      return;
    }

    hits++;
    missTotal++;
    missJunkHit++;
    combo = 0;

    const sub = 8;
    score = Math.max(0, score - sub);

    fxFloatText(clientX, clientY-10, `-${sub}`, true);
    try{ AI?.onHit?.(t.kind, { id:t.id }); }catch(e){}
    removeTarget(t.id);

    if(missTotal===3) sayCoach('ระวังของเสีย! เห็น 🍔🍟 แล้วเลี่ยง');
  }

  function onHitBonus(t, clientX, clientY){
    hits++;
    combo++;
    bestCombo = Math.max(bestCombo, combo);

    let add = rPick([25,30,35]);
    if(rageOn) add = Math.round(add * 1.5);
    score += add;

    fxBurst(clientX, clientY);
    fxFloatText(clientX, clientY-10, `BONUS +${add}`, false);

    try{ AI?.onHit?.(t.kind, { id:t.id }); }catch(e){}
    removeTarget(t.id);
  }

  function onHitShield(t, clientX, clientY){
    hits++;
    addShield();
    fxBurst(clientX, clientY);
    fxFloatText(clientX, clientY-10, '+SHIELD', false);
    try{ AI?.onHit?.(t.kind, { id:t.id }); }catch(e){}
    removeTarget(t.id);
  }

  function onHitBoss(t, clientX, clientY){
    if(!bossActive) return;
    hits++;

    if(bossPhase===0){
      bossShieldHp--;
      fxBurst(clientX, clientY);
      fxFloatText(clientX, clientY-10, 'SHIELD -1', false);
      if(bossShieldHp<=0){
        bossPhase = 1;
        sayCoach('โล่แตก! ยิง 🎯 สลับจุดเร็ว ๆ', 0);
      }
      try{ AI?.onHit?.(t.kind, { id:t.id, phase:bossPhase }); }catch(e){}
      removeTarget(t.id);
      return;
    }

    // weakspot damage
    const dmg = rageOn ? 4 : 3;
    bossHp = Math.max(0, bossHp - dmg);

    let add = 22 + dmg*6;
    if(rageOn) add = Math.round(add * 1.4);
    score += add;
    addFever(9);

    fxBurst(clientX, clientY);
    fxFloatText(clientX, clientY-10, `BOSS +${add}`, false);

    try{ AI?.onHit?.(t.kind, { id:t.id, dmg, phase:bossPhase }); }catch(e){}
    removeTarget(t.id);

    if(bossHp<=0){
      sayCoach('บอสแพ้แล้ว! 🎉', 0);
      bossActive = false;
      BOSS_PAT.active = false;
      score += 120;
      addFever(40);
    }
  }

  function hitTargetById(id, clientX, clientY){
    const t = targets.get(String(id));
    if(!t || !playing) return;

    shots++;
    const kind = t.kind;

    if(kind==='good') onHitGood(t, clientX, clientY);
    else if(kind==='junk') onHitJunk(t, clientX, clientY);
    else if(kind==='bonus') onHitBonus(t, clientX, clientY);
    else if(kind==='shield') onHitShield(t, clientX, clientY);
    else if(kind==='boss') onHitBoss(t, clientX, clientY);
  }

  // pointerdown only non-cvr (cVR strict: shoot from crosshair only)
  function onPointerDown(ev){
    if(!playing || paused) return;
    const el = ev.target && ev.target.closest ? ev.target.closest('.gj-target') : null;
    if(!el) return;
    hitTargetById(el.dataset.id, ev.clientX, ev.clientY);
  }
  if(view !== 'cvr'){
    layer.addEventListener('pointerdown', onPointerDown, { passive:true });
  }

  function pickTargetAt(x,y, lockPx){
    lockPx = clamp(lockPx ?? 46, 16, 140);
    let best = null;
    let bestD = 1e9;
    for(const t of targets.values()){
      const r = t.el.getBoundingClientRect();
      const cx = r.left + r.width/2;
      const cy = r.top + r.height/2;
      const d = Math.hypot(cx-x, cy-y);
      if(d < bestD){
        bestD = d;
        best = t;
      }
    }
    if(best && bestD <= lockPx) return best;
    return null;
  }

  // cVR shoot from crosshair
  WIN.addEventListener('hha:shoot', (ev)=>{
    if(!playing || paused) return;
    try{
      const lockPx = ev?.detail?.lockPx ?? 64;
      const r = layerRect();
      const x = r.left + r.width/2;
      const y = r.top  + r.height/2;
      const t = pickTargetAt(x,y, lockPx);
      if(t) hitTargetById(t.id, x, y);
      else shots++;
    }catch(e){}
  });

  // ---------- Stage logic ----------
  function stageByProgress(){
    const p = plannedSec>0 ? (1 - (tLeft/plannedSec)) : 0;
    if(p >= TUNE.trickR) return STAGE.BOSS;
    if(p >= TUNE.warmR) return STAGE.TRICK;
    return STAGE.WARM;
  }

  function enterStageIfNeeded(){
    const next = stageByProgress();
    if(next === stage) return;

    // leaving trick -> apply rewards before boss
    if(stage===STAGE.TRICK && next===STAGE.BOSS){
      finishTrickMetrics();
      applyTrickRewardsToBoss();
    }

    stage = next;
    setStageHUD();

    if(stage===STAGE.TRICK && !stageAnnounced.trick){
      stageAnnounced.trick = true;
      startTrickMetrics();
      sayCoach(pro ? 'TRICK+PRO! ของดีบางอัน “หลอก” (มี •) เลือกยิงให้ชัวร์' : 'TRICK! ของเสียโผล่มากขึ้น เลือกยิง', 0);
      if(pro && shield<2) shield = 2;
    }

    if(stage===STAGE.BOSS && !stageAnnounced.boss){
      stageAnnounced.boss = true;
      bossStartWithMods();
    }
  }

  // ---------- spawner ----------
  let spawnAcc = 0;

  function spawnProfile(){
    if(stage===STAGE.WARM){
      return { pGood:0.70, pJunk:0.18, pBonus:0.08, pShield:0.04, pBoss:0.00, pDecoy:0.00 };
    }
    if(stage===STAGE.TRICK){
      const jBoost = TUNE.proCfg.trickJunkBoost;
      const sBoost = TUNE.proCfg.trickShieldBoost;
      const decoy = pro ? 0.12 : 0.00;
      return {
        pGood: 0.58 - decoy,
        pJunk: 0.30 + jBoost,
        pBonus:0.06,
        pShield:0.06 + sBoost,
        pBoss: 0.00,
        pDecoy: decoy
      };
    }
    // BOSS stage: normal spawns reduce, boss pattern handles pressure
    return { pGood:0.64, pJunk:0.18, pBonus:0.05, pShield:0.13, pBoss:0.00, pDecoy:0.00 };
  }

  function ttlFor(kind){
    if(stage===STAGE.TRICK && pro){
      const s = TUNE.proCfg.trickTTLScale;
      if(kind==='good') return TUNE.ttlGood * s;
      if(kind==='junk') return TUNE.ttlJunk * s;
      if(kind==='bonus') return TUNE.ttlBonus * s;
      if(kind==='shield') return TUNE.ttlShield * s;
    }
    if(kind==='good') return TUNE.ttlGood;
    if(kind==='junk') return TUNE.ttlJunk;
    if(kind==='bonus') return TUNE.ttlBonus;
    if(kind==='shield') return TUNE.ttlShield;
    return 2.2;
  }

  function chooseKind(){
    const prof = spawnProfile();
    const p = r01();
    let acc = 0;

    acc += prof.pShield; if(p < acc) return 'shield';
    acc += prof.pBonus;  if(p < acc) return 'bonus';
    acc += prof.pDecoy;  if(p < acc) return 'decoy';
    acc += prof.pJunk;   if(p < acc) return 'junk';
    return 'good';
  }

  function spawnTick(dt){
    // stage updates first
    enterStageIfNeeded();

    // boss stage: normal spawn reduced; boss pressure from bossTick()
    const base = TUNE.spawnBase * (stage===STAGE.TRICK ? TUNE.proCfg.trickSpawnBoost : 1.0) * (stage===STAGE.BOSS ? 0.65 : 1.0);
    const rageBoost = rageOn ? 1.18 : 1.0;

    spawnAcc += base * rageBoost * dt;

    while(spawnAcc >= 1){
      spawnAcc -= 1;

      const kind = chooseKind();

      if(kind==='good') makeTarget('good', rPick(GOOD), ttlFor('good'));
      else if(kind==='junk') makeTarget('junk', rPick(JUNK), ttlFor('junk'));
      else if(kind==='bonus') makeTarget('bonus', rPick(BONUS), ttlFor('bonus'));
      else if(kind==='shield') makeTarget('shield', rPick(SHIELDS), ttlFor('shield'));
      else if(kind==='decoy'){
        const e = rPick(DECOY) + '•';
        makeTarget('junk', e, ttlFor('junk'));
      }
    }
  }

  function updateTargets(dt){
    const tNow = nowMs();
    const safe = getSpawnSafeLocal();
    const rPad = (view==='mobile') ? 34 : 42;

    for(const t of Array.from(targets.values())){
      const age = tNow - t.born;
      const p = age / t.ttl;

      // drift
      const dx = t.drift * dt;
      t.x += dx;

      const xMin = safe.xMin + rPad;
      const xMax = safe.xMax - rPad;
      t.x = clamp(t.x, xMin, xMax);
      t.el.style.left = `${t.x}px`;

      // fade out near end
      if(p > 0.75){
        t.el.style.opacity = String(clamp(1 - (p-0.75)/0.25, 0.15, 1));
        t.el.style.transform = `translate(-50%,-50%) scale(${1 - 0.08*(p-0.75)/0.25})`;
      }

      // expire
      if(age >= t.ttl){
        try{ AI?.onExpire?.(t.kind, { id:t.id }); }catch(e){}

        if(t.kind === 'good'){
          missTotal++;
          missGoodExpired++;
          if(stage===STAGE.TRICK && TRICK_MET.started) TRICK_MET.goodExpInTrick++;
          combo = 0;

          score = Math.max(0, score - 4);
          const r = t.el.getBoundingClientRect();
          fxFloatText(r.left+r.width/2, r.top+r.height/2, 'MISS', true);

          if(missTotal===1) sayCoach('ถ้าช้าไป ของดีจะหาย (นับ MISS) นะ');
        }
        removeTarget(t.id);
      }
    }
  }

  function updateRage(dt){
    if(!rageOn) return;
    rageLeft -= dt;
    if(rageLeft <= 0){
      rageOn = false;
      rageLeft = 0;
      fever = clamp(fever - 18, 0, 100);
      sayCoach('FEVER หมดแล้ว แต่ยังไหว!');
    }
  }

  function updateMini(dt){
    if(mini.t > 0){
      mini.t = Math.max(0, mini.t - dt);
      if(mini.t<=0) mini.name = '—';
      return;
    }

    const chance = (stage===STAGE.WARM) ? 0.045 : (stage===STAGE.TRICK ? 0.060 : 0.040);
    if(r01() < dt*chance){
      if(stage===STAGE.WARM){
        const type = rPick(['combo-5','grab-bonus']);
        if(type==='combo-5'){ mini.name='Combo x5'; mini.t=8; sayCoach('ภารกิจ: ทำคอมโบให้ถึง 5!', 0); }
        else { mini.name='Grab ⭐'; mini.t=7; sayCoach('ภารกิจ: เก็บโบนัส!', 0); }
      }else if(stage===STAGE.TRICK){
        const type = rPick(['no-junk','shield-up','combo-7']);
        if(type==='no-junk'){ mini.name='No JUNK 6s'; mini.t=6; sayCoach('TRICK: 6 วิ ห้ามโดนของเสีย!', 0); }
        else if(type==='shield-up'){ mini.name='Find 🛡️'; mini.t=7; sayCoach('TRICK: หาโล่เพิ่มก่อน!', 0); }
        else { mini.name='Combo x7'; mini.t=9; sayCoach('TRICK: ทำคอมโบให้ถึง 7!', 0); }
      }else{
        mini.name='BOSS Push';
        mini.t=7;
        sayCoach('BOSS: แตกโล่ แล้วรีบยิง 🎯', 0);
      }
    }
  }

  function checkEnd(){
    if(tLeft <= 0){ showEnd('time'); return true; }
    if(missTotal >= TUNE.lifeMissLimit){ showEnd('miss-limit'); return true; }

    if(goal.cur >= goal.target && playing){
      goal.target += 10;
      score += 60;
      addFever(18);
      sayCoach('ทำเป้าหมายสำเร็จ! +60 ✨');
      const r = layerRect();
      fxBurst(r.left+r.width/2, r.top+r.height*0.55);
      fxFloatText(r.left+r.width/2, r.top+r.height*0.55, 'GOAL +60', false);
    }
    return false;
  }

  // ---------- AI Coach explainable (Top2 factors) ----------
  let lastExplainMs = 0;
  function maybeExplain(pred){
    if(!pred) return;
    const t = nowMs();
    if(t - lastExplainMs < 5200) return;
    const risk = Number(pred.hazardRisk);
    if(!Number.isFinite(risk)) return;

    if(risk < (stage===STAGE.WARM ? 0.62 : 0.54)) return;

    const top = Array.isArray(pred.topFactors) ? pred.topFactors : [];
    const a = top[0]?.label ? String(top[0].label) : '';
    const b = top[1]?.label ? String(top[1].label) : '';
    if(!a) return;

    lastExplainMs = t;
    if(b) sayCoach(`AI บอกว่าเสี่ยงเพราะ: 1) ${a} 2) ${b}`, 0);
    else  sayCoach(`AI บอกว่าเสี่ยงเพราะ: ${a}`, 0);
  }

  // ---------- tick loop ----------
  function tick(){
    if(!playing) return;

    if(paused){
      try{ lastTick = nowMs(); }catch(e){}
      setHUD();
      requestAnimationFrame(tick);
      return;
    }

    const t = nowMs();
    const dt = Math.min(0.05, Math.max(0.001, (t - lastTick)/1000));
    lastTick = t;

    tLeft = Math.max(0, tLeft - dt);

    spawnTick(dt);
    bossTick(dt);          // PACK 2: boss pattern pressure
    updateTargets(dt);
    updateRage(dt);
    updateMini(dt);

    // AI prediction tick (no adaptive)
    try{
      const pred = AI?.onTick?.(dt, {
        missGoodExpired,
        missJunkHit,
        shield,
        fever,
        combo,
        shots,
        hits
      }) || null;
      setAIHud(pred);
      maybeExplain(pred);
    }catch(e){}

    setHUD();
    if(checkEnd()) return;
    requestAnimationFrame(tick);
  }

  DOC.addEventListener('visibilitychange', ()=>{
    if(DOC.hidden && playing){
      showEnd('background');
    }
  });

  // start
  stage = STAGE.WARM;
  stageAnnounced.warm = true;
  setStageHUD();

  sayCoach(`เริ่ม! แตะ “ของดี” เลี่ยงของเสีย! ${pro ? '🔥 PRO ON' : ''}`, 0);
  setHUD();
  requestAnimationFrame(tick);
}