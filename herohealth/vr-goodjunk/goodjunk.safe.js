// === /webxr-health-mobile/herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE — PRODUCTION (deterministic + AI hooks prediction-only + score/end events)
// FULL v20260301-SAFE-AI-PREDICT-LOGGER-EVENTS
'use strict';

function clamp(v,a,b){ v=Number(v); if(!Number.isFinite(v)) v=a; return v<a?a:(v>b?b:v); }
function qs(k, d=''){ try{ return (new URL(location.href)).searchParams.get(k) ?? d; }catch(e){ return d; } }
function nowMs(){ return (performance && performance.now) ? performance.now() : Date.now(); }

function emit(name, detail){
  try{ window.dispatchEvent(new CustomEvent(name, { detail })); }catch(e){}
}

// deterministic RNG (Mulberry32)
function mulberry32(seed){
  let t = seed >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
function seedToInt(s){
  s = String(s||'');
  let h = 2166136261 >>> 0;
  for(let i=0;i<s.length;i++){
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function $(id){ return document.getElementById(id); }
function setText(id, v){ const el=$(id); if(el) el.textContent = String(v); }

function gradeFrom(accPct, miss){
  // simple rubric; you can swap later to your HHA grading
  if(accPct >= 92 && miss <= 2) return 'A';
  if(accPct >= 85 && miss <= 4) return 'B';
  if(accPct >= 70) return 'C';
  return 'D';
}

export function boot(cfg){
  cfg = cfg || {};
  const view = String(cfg.view || qs('view','mobile')).toLowerCase();
  const run  = String(cfg.run  || qs('run','play')).toLowerCase();
  const diff = String(cfg.diff || qs('diff','normal')).toLowerCase();
  const timeLimitSec = clamp(cfg.time ?? Number(qs('time','80'))||80, 20, 300);
  const seedStr = String(cfg.seed || qs('seed', String(Date.now())));
  const pid = String(cfg.pid || qs('pid','anon'));
  const ai = cfg.ai || null;

  // debug pills
  setText('uiView', view);
  setText('uiRun', run);
  setText('uiDiff', diff);

  // elements
  const layer = $('gj-layer');
  const endOverlay = $('endOverlay');
  const lowTimeOverlay = $('lowTimeOverlay');

  // state
  const rng = mulberry32(seedToInt(seedStr));
  const t0 = nowMs();
  let ended = false;

  let score = 0;
  let shots = 0;
  let hits = 0;

  // miss definition (ตามที่คุณกำหนดไว้):
  // miss = good expired + junk hit (ถ้า shield block => ไม่เพิ่ม miss)
  let miss = 0;

  // RT
  const goodRTs = [];
  function median(arr){
    if(!arr.length) return 0;
    const a = arr.slice().sort((x,y)=>x-y);
    const m = (a.length/2)|0;
    return (a.length%2) ? a[m] : Math.round((a[m-1]+a[m])/2);
  }

  // fever/shield placeholders (คุณต่อยอดได้)
  let feverPct = 0;
  let shield = 0;

  // goals (simple daily)
  const goalTarget = 20;
  let goalCur = 0;

  // mini
  let miniName = '—';
  let miniLeft = 0;

  // spawn config
  const SPAWN_MS = diff==='hard' ? 520 : diff==='easy' ? 820 : 680;
  const TTL_MS   = diff==='hard' ? 1200: diff==='easy' ? 1600: 1400;

  // timers
  let tickTimer = 0;
  let spawnTimer = 0;

  // update HUD
  function updateHUD(remainSec){
    const accPct = shots > 0 ? Math.round((hits*100)/shots) : 0;
    setText('hud-score', score);
    setText('hud-miss', miss);
    setText('hud-time', Math.max(0, Math.ceil(remainSec)));
    setText('hud-grade', gradeFrom(accPct, miss));

    setText('hud-goal-cur', goalCur);
    setText('hud-goal-target', goalTarget);
    setText('hud-mini', miniName);
    setText('miniTimer', miniLeft>0 ? `${miniLeft}s` : '—');

    setText('feverText', `${Math.round(feverPct)}%`);
    const feverFill = $('feverFill'); if(feverFill) feverFill.style.width = `${clamp(feverPct,0,100)}%`;
    setText('shieldPills', shield>0 ? '🟣'.repeat(Math.min(5,shield)) : '—');

    const pf = $('gjProgressFill');
    if(pf){
      const pct = clamp(Math.round(goalCur*100/goalTarget), 0, 100);
      pf.style.width = pct + '%';
    }

    // emit score pulse (ให้ logger/AI/battle ใช้)
    const medianRtGoodMs = median(goodRTs);
    emit('hha:score', {
      game: 'goodjunk',
      pid, run, diff, view,
      score, shots, hits,
      miss,
      accPct,
      medianRtGoodMs,
      feverPct,
      shield,
      ts: Date.now()
    });
  }

  // AI HUD (prediction-only)
  function updateAIHUD(){
    if(!ai) return;
    try{
      const pred = ai.predict({
        score, miss, shots, hits,
        accPct: shots>0 ? (hits*100/shots) : 0,
        medianRtGoodMs: median(goodRTs),
        goalCur, goalTarget,
        t: Date.now()
      });
      if(pred){
        if($('aiRisk')) $('aiRisk').textContent = pred.hazardRisk != null ? String(pred.hazardRisk) : '—';
        if($('aiHint')) $('aiHint').textContent = pred.nextWatchout || '—';
      }
    }catch(e){}
  }

  // create target
  function spawnOne(){
    if(!layer || ended) return;

    const w = layer.clientWidth || 360;
    const h = layer.clientHeight || 520;

    const x = clamp(Math.round(rng()*w), 40, w-40);
    const y = clamp(Math.round(rng()*h), 90, h-60);

    // type distribution
    const r = rng();
    let type = 'good';
    let emoji = '🥦';
    if(r < 0.68){ type='good'; emoji='🥦'; }
    else if(r < 0.90){ type='junk'; emoji='🍟'; }
    else if(r < 0.95){ type='star'; emoji='⭐'; }
    else if(r < 0.985){ type='diamond'; emoji='💎'; }
    else { type='shield'; emoji='🛡️'; }

    const el = document.createElement('div');
    el.className = `gj-t ${type}`;
    el.textContent = emoji;
    el.style.left = x + 'px';
    el.style.top  = y + 'px';

    const born = nowMs();
    let killed = false;

    function kill(reason){
      if(killed) return;
      killed = true;
      try{ el.remove(); }catch(e){}
      // if good expired => miss++
      if(reason === 'expire' && type === 'good'){
        miss += 1; // good expired counts as miss
      }
      // AI hook
      if(ai){
        try{ ai.onEvent({ name:'target_end', type, reason, rtMs:'', at:Date.now() }); }catch(e){}
      }
    }

    // click/tap
    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      if(killed || ended) return;

      shots += 1;

      const rt = Math.max(0, Math.round(nowMs() - born));
      if(type === 'good'){
        hits += 1;
        goalCur += 1;
        score += 10;
        goodRTs.push(rt);
      }else if(type === 'junk'){
        // junk hit => miss++, unless shield active blocks (ตามมาตรฐานคุณ)
        if(shield > 0){
          shield -= 1;
          score += 0;
        }else{
          miss += 1;
          score -= 5;
        }
      }else if(type === 'star'){
        score += 20;
      }else if(type === 'diamond'){
        score += 30;
      }else if(type === 'shield'){
        shield = Math.min(5, shield + 1);
        score += 5;
      }

      // AI hook
      if(ai){
        try{ ai.onEvent({ name:'hit', type, rtMs:rt, at:Date.now(), score, miss }); }catch(e){}
      }

      kill('hit');
      updateAIHUD();
    }, { passive:false });

    layer.appendChild(el);

    // expire
    setTimeout(()=>{ if(!killed) kill('expire'); }, TTL_MS);

    // AI hook
    if(ai){
      try{ ai.onEvent({ name:'spawn', type, at:Date.now() }); }catch(e){}
    }
  }

  // main loop
  function tick(){
    if(ended) return;
    const t = nowMs();
    const elapsed = (t - t0)/1000;
    const remain = Math.max(0, timeLimitSec - elapsed);

    // low time overlay
    if(lowTimeOverlay){
      if(remain <= 5 && remain > 0){
        lowTimeOverlay.setAttribute('aria-hidden','false');
        const n = $('gj-lowtime-num'); if(n) n.textContent = String(Math.ceil(remain));
      }else{
        lowTimeOverlay.setAttribute('aria-hidden','true');
      }
    }

    updateHUD(remain);

    // goal complete early? (optional)
    if(goalCur >= goalTarget){
      endGame('goal_clear');
      return;
    }

    if(remain <= 0){
      endGame('timeout');
      return;
    }

    updateAIHUD();
    tickTimer = requestAnimationFrame(tick);
  }

  function endGame(reason){
    if(ended) return;
    ended = true;

    try{ cancelAnimationFrame(tickTimer); }catch(e){}
    try{ clearInterval(spawnTimer); }catch(e){}

    const accPct = shots > 0 ? Math.round((hits*100)/shots) : 0;
    const grade = gradeFrom(accPct, miss);
    const medianRtGoodMs = median(goodRTs);

    // fill end UI
    if(endOverlay){
      endOverlay.setAttribute('aria-hidden','false');
      setText('endTitle', reason==='goal_clear' ? 'Mission Clear!' : 'Game Over');
      setText('endSub', `seed=${seedStr} • pid=${pid}`);
      setText('endGrade', grade);
      setText('endScore', score);
      setText('endMiss', miss);
      setText('endTime', timeLimitSec);
    }

    // emit end summary (ให้ logger จับ)
    emit('hha:game-ended', {
      game: 'goodjunk',
      pid, run, diff, view,
      seed: seedStr,
      reason,
      scoreFinal: score,
      hits,
      shots,
      missTotal: miss,
      accPct,
      comboMax: 0,
      medianRtGoodMs,
      ts: Date.now()
    });

    // AI hook
    if(ai){
      try{ ai.onEvent({ name:'end', reason, scoreFinal:score, miss, accPct, medianRtGoodMs, at:Date.now() }); }catch(e){}
    }
  }

  // start spawn loop
  spawnTimer = setInterval(()=>{ spawnOne(); }, SPAWN_MS);

  // kick off
  tick();
}
