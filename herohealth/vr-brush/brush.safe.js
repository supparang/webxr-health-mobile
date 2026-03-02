// === /herohealth/vr-brush/brush.safe.js ===
// BrushVR SAFE — Plaque Breaker (AB + Analyze + AI prediction hook)
// PATCH v20260302-brush-AB-SAFE
// ✅ A=Scan Sprint (speed) B=Evidence Build (3 types) C=Analyze quiz (Bloom Analyze)
// ✅ Tap/Click + Crosshair Shoot (cVR via vr-ui.js -> hha:shoot)
// ✅ Boss plaque + Weakspot 🎯
// ✅ No auto start, stable menu/end, no double-shot count
// ✅ Emits: hha:start, hha:time, hha:score, hha:judge, hha:end, brush:ai
(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  // ---- helpers ----
  const $ = (s)=>DOC.querySelector(s);
  const clamp=(v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));
  const safeNum=(x,d=0)=>{ const n=Number(x); return Number.isFinite(n)?n:d; };
  const now=()=> (performance && performance.now) ? performance.now() : Date.now();

  function emit(type, detail){
    try{ WIN.dispatchEvent(new CustomEvent(type, { detail })); }catch(_){}
  }

  function fatal(msg){
    const el = $('#fatal');
    if(!el){ alert(msg); return; }
    el.textContent = msg;
    el.classList.remove('br-hidden');
  }
  WIN.addEventListener('error', (e)=>{
    fatal('JS ERROR:\n' + (e?.message||e) + '\n\n' + (e?.filename||'') + ':' + (e?.lineno||'') + ':' + (e?.colno||''));
  });
  WIN.addEventListener('unhandledrejection', (e)=>{
    fatal('PROMISE REJECTION:\n' + (e?.reason?.message || e?.reason || e));
  });

  function toast(msg){
    const el = $('#toast');
    if(!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(()=> el.classList.remove('show'), 1200);
  }

  function getQS(){
    try{ return new URL(location.href).searchParams; }
    catch{ return new URLSearchParams(); }
  }
  function ymdLocal(){
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }
  function seededRng(seed){
    let t = (Number(seed)||Date.now()) >>> 0;
    return function(){
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---- DOM ----
  const wrap = $('#br-wrap');
  const layer = $('#br-layer');
  const menu = $('#br-menu');
  const end  = $('#br-end');

  const btnStart = $('#btnStart');
  const btnRetry = $('#btnRetry');
  const btnPause = $('#btnPause');
  const btnHow   = $('#btnHow');
  const btnRecenter = $('#btnRecenter');

  const btnBack = $('#btnBack');
  const btnBackHub2 = $('#btnBackHub2');

  const tStage = $('#tStage');
  const tScore = $('#tScore');
  const tCombo = $('#tCombo');
  const tMiss  = $('#tMiss');
  const tTime  = $('#tTime');

  const tClean = $('#tClean');
  const bClean = $('#bClean');
  const tFever = $('#tFever');
  const bFever = $('#bFever');

  const tEvi = $('#tEvi');
  const bEvi = $('#bEvi');

  const mDiff = $('#mDiff');
  const mTime = $('#mTime');

  const sScore = $('#sScore');
  const sAcc   = $('#sAcc');
  const sMiss  = $('#sMiss');
  const sCombo = $('#sCombo');
  const sClean = $('#sClean');
  const sTime  = $('#sTime');
  const endGrade = $('#endGrade');
  const endNote  = $('#endNote');

  const quizWrap = $('#br-quiz');
  const quizChoices = $('#quizChoices');
  const btnQuizSubmit = $('#btnQuizSubmit');
  const btnQuizSkip   = $('#btnQuizSkip');

  if(!wrap || !layer) throw new Error('BrushVR DOM missing (#br-wrap/#br-layer)');

  // ---- fun boost (optional, safe if missing) ----
  const qs = getQS();

  // ---- engine ctx ----
  const ctx = {
    hub: String(qs.get('hub') || '../hub.html'),
    run: String(qs.get('run') || 'play'),
    view: String(qs.get('view') || DOC.body.getAttribute('data-view') || 'pc').toLowerCase(),
    diff: String(qs.get('diff') || 'normal').toLowerCase(),
    time: clamp(safeNum(qs.get('time'), 80), 30, 120),
    seed: safeNum(qs.get('seed'), Date.now()),
    pid: String(qs.get('pid') || '').trim(),
    studyId: String(qs.get('studyId') || '').trim(),
    phase: String(qs.get('phase') || '').trim(),
    conditionGroup: String(qs.get('conditionGroup') || '').trim(),
    log: String(qs.get('log') || qs.get('api') || '').trim(),
    ai: String(qs.get('ai') || '0') === '1',
    debug: String(qs.get('debug') || '0') === '1'
  };
  if(!['easy','normal','hard'].includes(ctx.diff)) ctx.diff = 'normal';

  // back links
  function setBackLinks(){
    for(const a of [btnBack, btnBackHub2]){
      if(!a) continue;
      try{
        const u = new URL(ctx.hub, location.href);
        if(ctx.pid) u.searchParams.set('pid', ctx.pid);
        if(ctx.studyId) u.searchParams.set('studyId', ctx.studyId);
        if(ctx.phase) u.searchParams.set('phase', ctx.phase);
        if(ctx.conditionGroup) u.searchParams.set('conditionGroup', ctx.conditionGroup);
        a.href = u.toString();
      }catch(_){
        a.href = ctx.hub;
      }
    }
  }
  setBackLinks();

  // HUD labels
  const rng = seededRng(ctx.seed);

  // ---- gameplay config ----
  const CFG = {
    baseSpawnMs: (ctx.diff==='hard'? 640 : ctx.diff==='easy'? 900 : 760),
    ttlMs:       (ctx.diff==='hard'? 1400: ctx.diff==='easy'? 1900: 1650),
    perfectWindowMs: (ctx.diff==='hard'? 190 : ctx.diff==='easy'? 260 : 220),
    cleanGain:   (ctx.diff==='hard'? 1.05: ctx.diff==='easy'? 1.35 : 1.20),
    cleanLose:   (ctx.diff==='hard'? 0.78: ctx.diff==='easy'? 0.45 : 0.60),

    bossEveryPct: 30,
    bossHp: (ctx.diff==='hard'? 6 : ctx.diff==='easy'? 4 : 5),

    // AB pacing
    A_sec: 18,
    B_sec: 42,
    // C is quiz + sprint finish

    evidenceNeedEach: 1, // collect 1 each => 3 total (sugar/acid/plaque)
  };

  // ---- state ----
  const S = {
    running:false,
    paused:false,
    ended:false,
    t0:0,

    stage:'A', // A/B/C
    score:0,
    combo:0,
    comboMax:0,
    miss:0,
    shots:0,
    hits:0,

    clean:0,

    bossActive:false,
    nextBossAt: CFG.bossEveryPct,

    // evidence
    evi: { sugar:0, acid:0, plaque:0 },
    eviTotal:0,
    quizAnswered:false,
    quizCorrect:false,

    uid:0,
    targets: new Map(), // id -> target

    lastHud:0,

    // ai predictor cache (non-adaptive)
    aiLast:0,
    aiRisk:0
  };

  // ---- AI prediction (simple ML-like heuristic; deterministic, no adaptive difficulty) ----
  function aiPredict(){
    // features
    const acc = (S.shots>0) ? (S.hits/S.shots) : 0;
    const missRate = (S.shots>0) ? (S.miss/S.shots) : 0;
    const combo = S.combo;
    const clean = S.clean/100;
    const evi = S.eviTotal/3;

    // risk 0..1
    let risk = 0.35;
    risk += missRate * 0.55;
    risk += (acc<0.55 ? 0.18 : 0);
    risk += (combo===0 ? 0.08 : -0.06);
    risk += (clean<0.35 ? 0.06 : -0.04);
    risk += (S.stage==='B' && evi<0.67 ? 0.06 : 0);

    risk = clamp(risk, 0, 1);

    // tip
    let tip = 'เล็งให้ชัวร์ก่อนยิง';
    if(S.stage==='A') tip = 'A: กวาดให้ไว แต่รักษาคอมโบ';
    if(S.stage==='B') tip = 'B: เน้นเก็บหลักฐาน 3 แบบ (🍬🧪🦠)';
    if(S.stage==='C') tip = 'C: ตอบคำถาม “วิเคราะห์” ให้ถูก รับโบนัส!';

    if(risk>0.72) tip = 'ช้าลงนิด! ยิงให้โดนก่อนค่อยเร่ง';
    else if(risk<0.35 && combo>=6) tip = 'ดีมาก! รักษาคอมโบแล้วเร่งสปีดได้';

    return { risk, tip };
  }

  function aiPulse(force){
    if(!ctx.ai) return;
    const t = now();
    if(!force && (t - S.aiLast) < 1500) return;
    S.aiLast = t;

    const p = aiPredict();
    S.aiRisk = p.risk;

    const emo = p.risk>0.72 ? '🧯' : (p.risk<0.35 ? '🚀' : '🧠');
    emit('brush:ai', {
      emo,
      title: 'AI Prediction',
      sub: `risk=${(p.risk*100).toFixed(0)}% · stage=${S.stage}`,
      mini: p.tip,
      tag: 'PRED',
      ms: 1600
    });
  }

  // ---- HUD render ----
  function renderHud(force){
    const t = now();
    if(!force && t - S.lastHud < 80) return;
    S.lastHud = t;

    if(tStage) tStage.textContent = S.stage;
    if(tScore) tScore.textContent = String(S.score);
    if(tCombo) tCombo.textContent = String(S.combo);
    if(tMiss)  tMiss.textContent  = String(S.miss);

    const elapsed = S.running ? ((t - S.t0)/1000) : 0;
    const left = S.running ? Math.max(0, ctx.time - elapsed) : ctx.time;
    if(tTime) tTime.textContent = left.toFixed(0);

    const clean = clamp(S.clean,0,100);
    if(tClean) tClean.textContent = `${Math.round(clean)}%`;
    if(bClean) bClean.style.width = `${clean}%`;

    // Fever bar uses fun-boost if present
    const fb = WIN.HHA?.getFunBoostState?.?.() || null; // not required
    // fallback: simple fever = combo>=10
    const feverOn = (S.combo>=10);
    if(tFever) tFever.textContent = feverOn ? 'ON' : 'OFF';
    if(bFever) bFever.style.width = feverOn ? '100%' : `${clamp((S.combo/10)*100,0,100)}%`;

    // Evidence bar
    const total = S.eviTotal;
    if(tEvi) tEvi.textContent = `${total}/3`;
    if(bEvi) bEvi.style.width = `${clamp((total/3)*100,0,100)}%`;
  }

  function gradeFromAcc(acc){
    if(acc >= 92) return 'S';
    if(acc >= 82) return 'A';
    if(acc >= 70) return 'B';
    if(acc >= 55) return 'C';
    return 'D';
  }

  function layerRect(){ return layer.getBoundingClientRect(); }
  function randPos(pad=56){
    const r = layerRect();
    return {
      x: pad + rng()*Math.max(10, r.width - pad*2),
      y: pad + rng()*Math.max(10, r.height - pad*2)
    };
  }

  // ---- targets ----
  function updateHpVis(t){
    if(!t || !t.fillEl) return;
    const pct = clamp((t.hp/t.hpMax)*100, 0, 100);
    t.fillEl.style.width = pct + '%';
  }

  function updateBossWeakspotPos(t){
    if(!t || t.type!=='boss' || !t.wsEl) return;
    const ang = rng()*Math.PI*2;
    const rr = 14 + rng()*12;
    t.weakX = Math.cos(ang)*rr;
    t.weakY = Math.sin(ang)*rr;
    t.weakR = 14;
    t.wsEl.style.left = `calc(50% + ${t.weakX}px)`;
    t.wsEl.style.top  = `calc(50% + ${t.weakY}px)`;
  }

  function mkTarget({x,y,type,hpMax,eviKind}){
    const id = String(++S.uid);
    const el = DOC.createElement('button');
    el.type='button';
    el.className = 'br-t' + (type==='boss' ? ' thick' : '');
    el.dataset.id = id;
    el.dataset.kind = type;
    if(eviKind) el.dataset.evi = eviKind;
    el.style.left = x+'px';
    el.style.top  = y+'px';
    el.setAttribute('aria-label', type);

    const emo = DOC.createElement('div');
    emo.className='emo';

    // icons
    if(type==='boss') emo.textContent='💎';
    else if(eviKind==='sugar') emo.textContent='🍬';
    else if(eviKind==='acid') emo.textContent='🧪';
    else if(eviKind==='plaque') emo.textContent='🦠';
    else emo.textContent='🦠';

    el.appendChild(emo);

    const hp = DOC.createElement('div');
    hp.className='hp';
    const fill = DOC.createElement('i');
    hp.appendChild(fill);
    el.appendChild(hp);

    let wsEl=null;
    if(type==='boss'){
      wsEl = DOC.createElement('div');
      wsEl.className='br-ws';
      el.appendChild(wsEl);
    }

    const born = now();
    const die  = born + CFG.ttlMs;

    const t = { id, el, type, eviKind: eviKind||'', bornMs:born, dieMs:die, hpMax, hp:hpMax, fillEl:fill, wsEl, weakX:0, weakY:0, weakR:14 };
    if(type==='boss') updateBossWeakspotPos(t);

    S.targets.set(id, t);

    el.addEventListener('pointerdown', (ev)=>{
      if(!S.running || S.paused || S.ended) return;
      ev.preventDefault();
      // ✅ count shot here (avoid double)
      S.shots++;
      handleHit(t, ev.clientX, ev.clientY, 'pointer');
    }, {passive:false});

    layer.appendChild(el);
    updateHpVis(t);
    return t;
  }

  function removeTarget(id, popped){
    const t = S.targets.get(id);
    if(!t) return;
    S.targets.delete(id);
    const el = t.el;
    if(!el) return;
    if(popped) el.classList.add('pop');
    el.classList.add('fade');
    setTimeout(()=>{ try{ el.remove(); }catch(_){} }, 220);
  }

  function pointInBossWeakspot(t, x, y){
    if(!t || t.type!=='boss' || !t.el) return false;
    const r = t.el.getBoundingClientRect();
    const cx = r.left + r.width*0.5 + (t.weakX||0);
    const cy = r.top  + r.height*0.5 + (t.weakY||0);
    const rr = Math.max(10, t.weakR||14);
    const dx = x - cx, dy = y - cy;
    return (dx*dx + dy*dy) <= rr*rr;
  }

  // ---- AB stage management ----
  function stageByTime(elapsed){
    if(elapsed < CFG.A_sec) return 'A';
    if(elapsed < CFG.B_sec) return 'B';
    return 'C';
  }

  function evidenceTotal(){
    return (S.evi.sugar>0?1:0) + (S.evi.acid>0?1:0) + (S.evi.plaque>0?1:0);
  }

  function spawnOne(){
    if(!S.running || S.paused || S.ended) return;
    const elapsed = (now() - S.t0)/1000;
    const stg = stageByTime(elapsed);
    if(stg !== S.stage){
      S.stage = stg;
      toast(`เข้าสเตจ ${S.stage}`);
      aiPulse(true);
      if(S.stage==='C'){
        // open quiz once (Analyze)
        openQuizOnce();
      }
    }

    const {x,y} = randPos(56);

    // boss gate by clean progression
    if(!S.bossActive && S.clean >= S.nextBossAt && S.clean < 100){
      S.bossActive = true;
      mkTarget({x,y,type:'boss',hpMax:CFG.bossHp});
      toast('💎 BOSS PLAQUE!');
      emit('brush:ai', { emo:'🦠', title:'BOSS!', sub:'บอสโผล่แล้ว', mini:'ยิงหลายครั้ง + หา Weakspot 🎯', tag:'BOSS', ms:1700 });
      return;
    }

    // stage B has evidence targets (3 types)
    if(S.stage==='B'){
      // choose missing evidence first
      const missing = [];
      if(S.evi.sugar<=0) missing.push('sugar');
      if(S.evi.acid<=0)  missing.push('acid');
      if(S.evi.plaque<=0)missing.push('plaque');

      let kind = '';
      if(missing.length && rng()<0.70){
        kind = missing[Math.floor(rng()*missing.length)];
      }else{
        const pool = ['sugar','acid','plaque'];
        kind = pool[Math.floor(rng()*pool.length)];
      }
      mkTarget({x,y,type:'plaque',hpMax:1,eviKind:kind});
      return;
    }

    // stage A/C default plaque
    mkTarget({x,y,type:'plaque',hpMax:1,eviKind:''});
  }

  // ---- scoring ----
  function onPerfect(){
    S.score += 2;
    toast('✨ Perfect!');
  }

  function applyHitRewards(t, remainMs, weakHit){
    S.hits++;

    if(remainMs <= CFG.perfectWindowMs) onPerfect();
    S.combo++;
    S.comboMax = Math.max(S.comboMax, S.combo);

    const feverOn = (S.combo>=10);
    const comboMul = 1 + Math.min(0.6, S.combo*0.02);
    let base = (t.type==='boss') ? 3 : 1;
    if(t.eviKind) base += 1;      // evidence slightly more valuable
    if(weakHit) base += 2;

    S.score += Math.round(base * comboMul * (feverOn?1.25:1.0));

    let gain = CFG.cleanGain * (t.type==='boss'?1.35:1.0) * (feverOn?1.15:1.0);
    if(t.eviKind) gain *= 1.05;
    if(weakHit) gain *= 1.20;
    S.clean = clamp(S.clean + gain, 0, 100);

    // evidence credit
    if(S.stage==='B' && t.eviKind){
      if(t.eviKind==='sugar') S.evi.sugar = 1;
      if(t.eviKind==='acid')  S.evi.acid  = 1;
      if(t.eviKind==='plaque')S.evi.plaque= 1;
      S.eviTotal = evidenceTotal();
      if(S.eviTotal>=3){
        toast('✅ เก็บหลักฐานครบ! ไปวิเคราะห์ต่อ');
        emit('brush:ai', { emo:'🧠', title:'Evidence Complete', sub:'ครบ 3 แบบแล้ว', mini:'เตรียมตอบคำถามใน C', tag:'B', ms:1600 });
      }
    }
  }

  function onMiss(kind){
    S.miss++;
    S.combo = 0;
    S.score = Math.max(0, S.score - (kind==='boss'? 2 : 1));
    S.clean = clamp(S.clean - CFG.cleanLose, 0, 100);
  }

  // ---- hit handling + aim assist ----
  function getTargetCenter(t){
    if(!t || !t.el) return null;
    const r = t.el.getBoundingClientRect();
    return { x:r.left+r.width/2, y:r.top+r.height/2, w:r.width, h:r.height };
  }
  function getBossWeakspotCenter(t){
    if(!t || t.type!=='boss' || !t.el) return null;
    const r = t.el.getBoundingClientRect();
    return { x:r.left+r.width/2 + (t.weakX||0), y:r.top+r.height/2 + (t.weakY||0), r:Math.max(10,t.weakR||14) };
  }
  function dynLock(baseLock, t, isCVR){
    const c = getTargetCenter(t);
    if(!c) return baseLock;
    const size = Math.max(24, Math.min(c.w, c.h));
    let bonus = size*(isCVR?0.22:0.12);
    if(t.type==='boss') bonus += (isCVR?10:6);
    return clamp(Math.round(baseLock+bonus), baseLock, isCVR?92:72);
  }

  function nearestPick(x,y, baseLock, isCVR){
    let best=null, bestScore=Infinity;
    for(const t of S.targets.values()){
      if(!t || !t.el) continue;

      const lock = dynLock(baseLock, t, isCVR);

      // weakspot priority
      if(t.type==='boss'){
        const ws = getBossWeakspotCenter(t);
        if(ws){
          const dxw=x-ws.x, dyw=y-ws.y, d2w=dxw*dxw+dyw*dyw;
          const wsLock = Math.max(lock, ws.r + (isCVR?22:12));
          if(d2w <= wsLock*wsLock){
            const sc = d2w*0.55;
            if(sc<bestScore){ bestScore=sc; best={t, aimX:ws.x, aimY:ws.y, weak:true}; }
          }
        }
      }

      const c = getTargetCenter(t);
      if(!c) continue;
      const dx=x-c.x, dy=y-c.y, d2=dx*dx+dy*dy;
      if(d2 <= lock*lock){
        let sc = d2;
        if(isCVR && t.type==='boss') sc *= 0.92;
        if(sc<bestScore){ bestScore=sc; best={t, aimX:x, aimY:y, weak:false}; }
      }
    }
    return best;
  }

  function handleHit(t, x, y, source){
    if(!t || !S.targets.has(t.id) || S.ended) return;

    const tm = now();
    const remain = t.dieMs - tm;

    const weakHit = (t.type==='boss') ? pointInBossWeakspot(t, x, y) : false;
    const dmg = (t.type==='boss') ? (weakHit?2:1) : 1;

    t.hp = Math.max(0, t.hp - dmg);
    if(weakHit){
      t.el.classList.add('ws-hit');
      setTimeout(()=>{ try{ t.el.classList.remove('ws-hit'); }catch(_){} }, 180);
      updateBossWeakspotPos(t);
      toast('🎯 Weakspot!');
    }

    updateHpVis(t);
    applyHitRewards(t, remain, weakHit);

    if(t.hp<=0){
      removeTarget(t.id, true);
      if(t.type==='boss'){
        S.bossActive=false;
        S.nextBossAt = Math.min(100, S.nextBossAt + CFG.bossEveryPct);
        toast('💥 Boss แตก!');
      }
    }

    // win
    if(S.clean>=100){
      endGame('clean');
      return;
    }

    renderHud(true);
    aiPulse(false);
    emit('hha:score', { score:S.score, combo:S.combo, miss:S.miss, clean:S.clean, evidence:S.eviTotal, stage:S.stage, ts:Date.now(), source });
  }

  function onShoot(ev){
    if(!S.running || S.paused || S.ended) return;
    const d = ev?.detail || {};
    const x = safeNum(d.x, WIN.innerWidth/2);
    const y = safeNum(d.y, WIN.innerHeight/2);
    const baseLock = clamp(safeNum(d.lockPx, 28), 6, 80);

    const isCVR =
      String(d.view||'').toLowerCase()==='cvr' ||
      String(ctx.view||'').toLowerCase()==='cvr' ||
      String(DOC.documentElement?.dataset?.view||'').toLowerCase()==='cvr';

    S.shots++;

    const pick = nearestPick(x,y, baseLock, isCVR);
    if(pick && pick.t){
      handleHit(pick.t, pick.aimX, pick.aimY, d.source || 'hha:shoot');
    }else{
      // miss shot
      onMiss('plaque');
      toast('พลาด');
      renderHud(true);
      aiPulse(false);
    }
  }
  WIN.addEventListener('hha:shoot', onShoot);

  // layer click fallback (avoid double with .br-t)
  layer.addEventListener('pointerdown', (ev)=>{
    if(ctx.view==='cvr') return;
    if(!S.running || S.paused || S.ended) return;
    if(ev.target && ev.target.closest && ev.target.closest('.br-t')) return;

    S.shots++;
    const pick = nearestPick(ev.clientX, ev.clientY, 20, false);
    if(pick && pick.t) handleHit(pick.t, ev.clientX, ev.clientY, 'layer');
    else { onMiss('plaque'); toast('พลาด'); renderHud(true); }
  }, {passive:true});

  // ---- quiz (Analyze) ----
  const QUIZ = {
    // correct is intentionally “multiple factors” -> analyze
    options: [
      { id:'sugar', text:'กินหวานบ่อย (🍬)', correct:true },
      { id:'acid',  text:'เครื่องดื่มกรด/น้ำอัดลม (🧪)', correct:true },
      { id:'skipbrush', text:'ไม่แปรงหลังอาหาร (🦷)', correct:true },
      { id:'sleep', text:'นอนเร็วขึ้นทุกวัน (😴)', correct:false },
    ]
  };

  function openQuizOnce(){
    if(S.quizAnswered) return;
    if(!quizWrap || !quizChoices) return;

    // show only if evidence done OR stage C reached
    quizChoices.innerHTML = '';
    const name = 'quiz';
    QUIZ.options.forEach((o,i)=>{
      const row = DOC.createElement('label');
      row.className='br-q';
      row.innerHTML = `<input type="checkbox" name="${name}" value="${o.id}"/><div><b>${String.fromCharCode(65+i)}.</b> ${o.text}</div>`;
      quizChoices.appendChild(row);
    });

    quizWrap.hidden = false;
    toast('🧠 ตอบคำถามวิเคราะห์เพื่อรับโบนัส');
    emit('brush:ai', { emo:'🧠', title:'Analyze', sub:'เลือกได้หลายข้อ', mini:'เลือกสิ่งที่ “ทำให้คราบมากขึ้น”', tag:'C', ms:1800 });
  }

  function closeQuiz(){
    if(!quizWrap) return;
    quizWrap.hidden = true;
  }

  function gradeQuiz(selectedIds){
    // correct if selects at least 2 correct and no false
    const map = new Map(QUIZ.options.map(o=>[o.id,o.correct]));
    let correctCount=0, wrong=false;
    selectedIds.forEach(id=>{
      if(map.get(id)) correctCount++;
      else wrong = true;
    });
    const ok = (!wrong && correctCount>=2);
    return ok;
  }

  function submitQuiz(){
    if(S.quizAnswered) return;
    const checks = quizChoices.querySelectorAll('input[type="checkbox"]:checked');
    const ids = Array.from(checks).map(x=>x.value);
    const ok = gradeQuiz(ids);
    S.quizAnswered = true;
    S.quizCorrect = ok;

    if(ok){
      S.score += 35;
      S.clean = clamp(S.clean + 6, 0, 100);
      toast('✅ วิเคราะห์ถูก! +โบนัส');
      emit('brush:ai', { emo:'🏆', title:'Correct!', sub:'ได้โบนัส', mini:'+Score & Clean', tag:'C', ms:1600 });
    }else{
      toast('❌ ลองใหม่รอบหน้าได้');
      emit('brush:ai', { emo:'🧩', title:'Almost', sub:'ยังไม่ตรง', mini:'จำไว้: หวาน/กรด/ไม่แปรง ทำคราบมากขึ้น', tag:'C', ms:1900 });
    }
    closeQuiz();
    renderHud(true);
    if(S.clean>=100) endGame('clean');
  }

  btnQuizSubmit?.addEventListener('click', submitQuiz, {passive:true});
  btnQuizSkip?.addEventListener('click', ()=>{
    if(S.quizAnswered) return;
    S.quizAnswered = true;
    S.quizCorrect = false;
    closeQuiz();
    toast('ข้ามคำถาม');
  }, {passive:true});

  // ---- loop timers ----
  let spawnTimer=null, tickTimer=null;

  function scheduleSpawn(){
    clearTimeout(spawnTimer);
    if(!S.running || S.paused || S.ended) return;

    // spawn slightly faster in A, slower in C
    const elapsed = (now()-S.t0)/1000;
    const stg = stageByTime(elapsed);
    let mul = 1.0;
    if(stg==='A') mul = 0.86;
    if(stg==='B') mul = 1.00;
    if(stg==='C') mul = 0.95;

    const every = Math.max(360, CFG.baseSpawnMs * mul);
    spawnTimer = setTimeout(()=>{ spawnOne(); scheduleSpawn(); }, every);
  }

  function tick(){
    if(!S.running || S.paused || S.ended) return;
    const t = now();

    // timeouts
    for(const [id, tt] of S.targets){
      if(t >= tt.dieMs){
        removeTarget(id, false);
        if(tt.type==='boss') S.bossActive=false;
        onMiss(tt.type);
      }
    }

    const elapsed = (t - S.t0)/1000;
    const left = ctx.time - elapsed;

    // stage update (forces at boundaries)
    const stg = stageByTime(elapsed);
    if(stg !== S.stage){
      S.stage = stg;
      aiPulse(true);
      if(S.stage==='C') openQuizOnce();
    }

    // keep quiz open only if not answered and C
    if(S.stage!=='C' && quizWrap && !quizWrap.hidden) closeQuiz();

    emit('hha:time', { t:Math.max(0,left), elapsed, stage:S.stage, evidence:S.eviTotal, ts:Date.now() });
    renderHud();

    if(left <= 0){
      endGame('time');
    }
  }

  function clearTimers(){
    clearTimeout(spawnTimer);
    clearInterval(tickTimer);
    spawnTimer=null;
    tickTimer=null;
  }

  // ---- start/end ----
  function startGame(){
    S.running=true; S.paused=false; S.ended=false;
    S.t0 = now();

    S.stage='A';
    S.score=0; S.combo=0; S.comboMax=0; S.miss=0; S.shots=0; S.hits=0; S.clean=0;
    S.bossActive=false; S.nextBossAt = CFG.bossEveryPct;

    S.evi = { sugar:0, acid:0, plaque:0 };
    S.eviTotal=0;
    S.quizAnswered=false;
    S.quizCorrect=false;
    closeQuiz();

    // clear targets
    for(const [id] of S.targets) removeTarget(id,false);
    S.targets.clear();

    // UI
    if(menu) menu.style.display='none';
    if(end){ end.hidden=true; end.style.display='none'; }
    wrap.dataset.state='play';
    if(btnPause) btnPause.textContent='Pause';

    toast('เริ่ม! สเตจ A: กวาดคราบเร็ว!');
    renderHud(true);
    aiPulse(true);

    emit('hha:start', {
      game:'brush',
      category:'hygiene',
      pid: ctx.pid,
      studyId: ctx.studyId,
      phase: ctx.phase,
      conditionGroup: ctx.conditionGroup,
      seed: ctx.seed,
      diff: ctx.diff,
      view: ctx.view,
      timePlannedSec: ctx.time,
      ts: Date.now()
    });

    clearTimers();
    scheduleSpawn();
    tickTimer = setInterval(tick, 80);
  }

  function endGame(reason){
    if(S.ended) return;
    S.ended=true; S.running=false;
    clearTimers();

    // clear targets
    for(const [id] of S.targets) removeTarget(id,false);
    S.targets.clear();
    closeQuiz();

    const acc = (S.shots>0) ? (S.hits/S.shots)*100 : 0;
    const grade = gradeFromAcc(acc);
    const played = Math.min(ctx.time, (now()-S.t0)/1000);

    const summary = {
      game:'brush',
      category:'hygiene',
      reason,
      pid: ctx.pid,
      studyId: ctx.studyId,
      phase: ctx.phase,
      conditionGroup: ctx.conditionGroup,
      seed: ctx.seed,
      diff: ctx.diff,
      view: ctx.view,

      score: S.score,
      comboMax: S.comboMax,
      miss: S.miss,
      shots: S.shots,
      hits: S.hits,
      accuracyPct: Math.round(acc*10)/10,
      grade,

      cleanPct: Math.round(clamp(S.clean,0,100)),
      evidence: { ...S.evi },
      quiz: { answered:S.quizAnswered, correct:S.quizCorrect },

      timePlannedSec: ctx.time,
      timePlayedSec: Math.round(played*10)/10,

      date: ymdLocal(),
      ts: Date.now()
    };

    try{
      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary));
      const k='HHA_SUMMARY_HISTORY';
      const arr = JSON.parse(localStorage.getItem(k)||'[]');
      arr.push(summary);
      localStorage.setItem(k, JSON.stringify(arr.slice(-30)));
    }catch(_){}

    try{
      localStorage.setItem(`HHA_ZONE_DONE::hygiene::${ymdLocal()}`, '1');
    }catch(_){}

    emit('hha:judge', { ...summary });
    emit('hha:end', { ...summary });

    if(sScore) sScore.textContent = String(summary.score);
    if(sAcc) sAcc.textContent = `${summary.accuracyPct}%`;
    if(sMiss) sMiss.textContent = String(summary.miss);
    if(sCombo) sCombo.textContent = String(summary.comboMax);
    if(sClean) sClean.textContent = `${summary.cleanPct}%`;
    if(sTime) sTime.textContent = `${summary.timePlayedSec}s`;
    if(endGrade) endGrade.textContent = summary.grade;

    if(endNote){
      endNote.textContent =
        `reason=${reason} | stage=${S.stage} | seed=${summary.seed} | diff=${summary.diff} | view=${summary.view} | pid=${summary.pid||'-'}`;
    }

    if(end){
      end.hidden=false;
      end.style.display='grid';
    }
    if(menu) menu.style.display='none';
    wrap.dataset.state='end';

    toast(reason==='clean' ? '🦷 สะอาดแล้ว! เยี่ยม!' : 'จบเกม!');
  }

  function togglePause(){
    if(!S.running || S.ended) return;
    S.paused = !S.paused;
    if(btnPause) btnPause.textContent = S.paused ? 'Resume' : 'Pause';
    toast(S.paused ? '⏸ Pause' : '▶ Resume');
  }

  // ---- controls ----
  btnStart?.addEventListener('click', startGame, {passive:true});
  btnRetry?.addEventListener('click', startGame, {passive:true});
  btnPause?.addEventListener('click', togglePause, {passive:true});
  btnHow?.addEventListener('click', ()=>{
    toast('A: กวาดเร็ว • B: เก็บ 🍬🧪🦠 • Boss: 💎 หา Weakspot 🎯 • C: ตอบวิเคราะห์รับโบนัส');
  }, {passive:true});
  btnRecenter?.addEventListener('click', ()=>{
    WIN.dispatchEvent(new CustomEvent('hha:recenter', { detail:{ ts:Date.now() } }));
    toast('Recenter');
  }, {passive:true});

  // ---- public API ----
  WIN.HHA_BRUSH = WIN.HHA_BRUSH || {};
  WIN.HHA_BRUSH.boot = function(_ctx){
    // do NOT auto start
    wrap.dataset.view = ctx.view;
    wrap.dataset.state='menu';
    if(menu) menu.style.display='grid';
    if(end){ end.hidden=true; end.style.display='none'; }
    if(mDiff) mDiff.textContent = ctx.diff;
    if(mTime) mTime.textContent = `${ctx.time}s`;
    renderHud(true);
    toast('พร้อมแล้ว! กดเริ่มเกมได้เลย');
  };

  // init now (boot will be called by brush.boot.js)
})();