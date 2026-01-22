// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE — FAIR PACK S (v3: LOOSER + ANTI-OVERLAP + DIFF TIMING)
// ✅ Spacious spawn (uses --gj-top-safe / --gj-bottom-safe)
// ✅ MISS = good expired + junk hit (shield blocks junk => NOT MISS)
// ✅ ⭐ Star: reduce miss by 1 (floor 0) + bonus score + reduce fever
// ✅ 🛡 Shield: blocks next junk hit (blocked junk does NOT count as miss)
// ✅ Supports: tap/click OR crosshair shoot via event hha:shoot
// ✅ Anti-overlap + edge padding => more "โล่ง ๆ" + playable for ป.5
// Emits: hha:start, hha:score, hha:time, hha:judge, hha:end

'use strict';

const WIN = window;
const DOC = document;

const clamp = (v,min,max)=>Math.max(min,Math.min(max,v));
const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } };
const emit = (n,d)=>{ try{ WIN.dispatchEvent(new CustomEvent(n,{detail:d})); }catch{} };

function makeRNG(seed){
  let x = (Number(seed)||Date.now()) % 2147483647;
  if (x <= 0) x += 2147483646;
  return ()=> (x = x * 16807 % 2147483647) / 2147483647;
}

function getSafeRect(){
  const r = DOC.documentElement.getBoundingClientRect();
  const top = parseInt(getComputedStyle(DOC.documentElement).getPropertyValue('--gj-top-safe')) || 140;
  const bot = parseInt(getComputedStyle(DOC.documentElement).getPropertyValue('--gj-bottom-safe')) || 130;

  const x = 22;
  const y = Math.max(80, top);
  const w = Math.max(120, r.width - 44);
  const h = Math.max(140, r.height - y - bot);

  return { x,y,w,h };
}

function pickByShoot(lockPx=28){
  // pick .gj-target closest to center within lockPx window
  const r = DOC.documentElement.getBoundingClientRect();
  const cx = r.left + r.width/2;
  const cy = r.top  + r.height/2;

  const els = Array.from(DOC.querySelectorAll('.gj-target'));
  let best = null;

  for(const el of els){
    const b = el.getBoundingClientRect();
    if(!b.width || !b.height) continue;

    const inside =
      (cx >= b.left - lockPx && cx <= b.right + lockPx) &&
      (cy >= b.top  - lockPx && cy <= b.bottom + lockPx);

    if(!inside) continue;

    const ex = (b.left + b.right) / 2;
    const ey = (b.top  + b.bottom) / 2;
    const dx = (ex - cx);
    const dy = (ey - cy);
    const d2 = dx*dx + dy*dy;

    if(!best || d2 < best.d2) best = { el, d2 };
  }

  return best ? best.el : null;
}

export function boot(opts={}){
  const view = String(opts.view || qs('view','mobile')).toLowerCase();
  const run  = String(opts.run  || qs('run','play')).toLowerCase();
  const diff = String(opts.diff || qs('diff','normal')).toLowerCase();
  const timePlan = clamp(Number(opts.time || qs('time','80'))||80, 20, 300);
  const seed = String(opts.seed || qs('seed', Date.now()));

  const elScore = DOC.getElementById('hud-score');
  const elTime  = DOC.getElementById('hud-time');
  const elMiss  = DOC.getElementById('hud-miss');
  const elGrade = DOC.getElementById('hud-grade');
  const layer   = DOC.getElementById('gj-layer');

  const elFeverFill = DOC.getElementById('feverFill');
  const elFeverText = DOC.getElementById('feverText');
  const elShield    = DOC.getElementById('shieldPills');

  // diff tuning (เด็ก ป.5: easy/normal คือแนะนำ)
  const DIFF = (()=>{
    if(diff==='easy') return {
      spawnEveryMs: 980,
      ttlGoodMs: 1900,
      ttlPowerMs: 2100,
      edgePadPx: 46,
      minSepPx: 92,
      lockPx: 34
    };
    if(diff==='hard') return {
      spawnEveryMs: 780,
      ttlGoodMs: 1350,
      ttlPowerMs: 1500,
      edgePadPx: 40,
      minSepPx: 84,
      lockPx: 26
    };
    // normal
    return {
      spawnEveryMs: 900,
      ttlGoodMs: 1600,
      ttlPowerMs: 1700,
      edgePadPx: 44,
      minSepPx: 88,
      lockPx: 28
    };
  })();

  const S = {
    started:false, ended:false,
    view, run, diff,
    timePlan, timeLeft: timePlan,
    seed, rng: makeRNG(seed),

    score:0,

    // ✅ miss split (ตามที่ตกลงไว้)
    miss:0,
    miss_goodExpired:0,
    miss_junkHit:0,

    hitGood:0,
    hitJunk:0,
    expireGood:0,

    combo:0,
    comboMax:0,

    // powerups
    starHit:0,
    shieldHit:0,
    junkBlocked:0,

    shield:0,
    fever:18,

    lastTick:0,
    lastSpawn:0,
  };

  function setFever(p){
    S.fever = clamp(p,0,100);
    if(elFeverFill) elFeverFill.style.width = `${S.fever}%`;
    if(elFeverText) elFeverText.textContent = `${S.fever}%`;
  }

  function setShieldUI(){
    if(!elShield) return;
    elShield.textContent = (S.shield>0) ? `x${S.shield}` : '—';
  }

  function computeGrade(){
    // เกณฑ์เดิม (แฟร์) + ปรับเล็กน้อยให้สัมพันธ์ miss split
    // (ยัง “ง่ายพอ” สำหรับเด็ก ป.5)
    let g='C';
    if(S.score>=170 && S.miss<=3) g='A';
    else if(S.score>=110 && S.miss<=6) g='B';
    else if(S.score>=65) g='C';
    else g='D';
    return g;
  }

  function setHUD(){
    if(elScore) elScore.textContent = String(S.score);
    if(elTime)  elTime.textContent  = String(Math.ceil(S.timeLeft));
    if(elMiss)  elMiss.textContent  = String(S.miss);
    if(elGrade) elGrade.textContent = computeGrade();

    setShieldUI();
    emit('hha:score',{ score:S.score });
  }

  function addScore(delta){
    S.score += (delta|0);
    if(S.score<0) S.score = 0;
  }

  function addMiss(reason){
    // MISS = good expired + junk hit (shield block ไม่เป็น miss)
    S.miss++;
    if(reason==='goodExpired') S.miss_goodExpired++;
    if(reason==='junkHit') S.miss_junkHit++;
  }

  function onHit(kind){
    if(S.ended) return;

    if(kind==='good'){
      S.hitGood++;
      S.combo++;
      S.comboMax = Math.max(S.comboMax, S.combo);
      addScore(10 + Math.min(10, S.combo));
      setFever(S.fever + 2);
      emit('hha:judge', { type:'good', label:'GOOD' });
    }

    else if(kind==='junk'){
      if(S.shield>0){
        S.shield--;
        S.junkBlocked++;
        setShieldUI();
        emit('hha:judge', { type:'perfect', label:'BLOCK!' });
      }else{
        S.hitJunk++;
        addMiss('junkHit');
        S.combo = 0;
        addScore(-6);
        setFever(S.fever + 6);
        emit('hha:judge', { type:'bad', label:'OOPS' });
      }
    }

    else if(kind==='star'){
      S.starHit++;
      const before = S.miss;
      S.miss = Math.max(0, S.miss - 1);
      // ถ้าลด miss แล้ว: ลด split โดย “คืนให้ฝั่งที่หนักสุดก่อน”
      if(before!==S.miss){
        if(S.miss_junkHit > S.miss_goodExpired && S.miss_junkHit>0) S.miss_junkHit--;
        else if(S.miss_goodExpired>0) S.miss_goodExpired--;
      }
      addScore(18);
      setFever(Math.max(0, S.fever - 8));
      emit('hha:judge', { type:'perfect', label: (before!==S.miss) ? 'MISS -1!' : 'STAR!' });
    }

    else if(kind==='shield'){
      S.shieldHit++;
      S.shield = Math.min(3, S.shield + 1);
      setShieldUI();
      addScore(8);
      emit('hha:judge', { type:'perfect', label:'SHIELD!' });
    }

    setHUD();
  }

  // ---- Anti-overlap spawn helpers ----
  function dist2(ax,ay,bx,by){
    const dx=ax-bx, dy=ay-by;
    return dx*dx + dy*dy;
  }

  function tryPickSpawn(safe, sizePx){
    // keep away from edges + keep separation from existing targets
    const pad = DIFF.edgePadPx;
    const minSep = DIFF.minSepPx;

    const minX = safe.x + pad;
    const maxX = safe.x + safe.w - pad;
    const minY = safe.y + pad;
    const maxY = safe.y + safe.h - pad;

    const els = Array.from(DOC.querySelectorAll('.gj-target'));
    const pts = els.map(el=>{
      const b = el.getBoundingClientRect();
      return { x:(b.left+b.right)/2, y:(b.top+b.bottom)/2 };
    });

    // attempt N times
    const attempts = 18;
    for(let i=0;i<attempts;i++){
      const x = minX + S.rng()*Math.max(1,(maxX-minX));
      const y = minY + S.rng()*Math.max(1,(maxY-minY));

      let ok = true;
      const sep = Math.max(minSep, sizePx*1.25);
      const sep2 = sep*sep;
      for(const p of pts){
        if(dist2(x,y,p.x,p.y) < sep2){ ok=false; break; }
      }
      if(ok) return { x, y };
    }

    // fallback: still return somewhere inside safe (better than nothing)
    return {
      x: safe.x + S.rng()*safe.w,
      y: safe.y + S.rng()*safe.h
    };
  }

  function spawn(kind){
    if(S.ended || !layer) return;

    const safe = getSafeRect();

    const size =
      (kind==='good') ? 56 :
      (kind==='junk') ? 58 :
      52;

    const pos = tryPickSpawn(safe, size);
    const t = DOC.createElement('div');
    t.className = 'gj-target';
    t.dataset.kind = kind;

    t.textContent =
      (kind==='good') ? '🥦' :
      (kind==='junk') ? '🍟' :
      (kind==='star') ? '⭐' : '🛡️';

    t.style.left = pos.x+'px';
    t.style.top  = pos.y+'px';
    t.style.fontSize = size+'px';

    let alive = true;
    const kill = ()=>{
      if(!alive) return;
      alive=false;
      try{ t.remove(); }catch(_){}
    };

    t.addEventListener('pointerdown', ()=>{
      if(!alive || S.ended) return;
      kill();
      onHit(kind);
    });

    layer.appendChild(t);

    const ttl = (kind==='star' || kind==='shield') ? DIFF.ttlPowerMs : DIFF.ttlGoodMs;

    setTimeout(()=>{
      if(!alive || S.ended) return;
      kill();

      if(kind==='good'){
        S.expireGood++;
        addMiss('goodExpired');
        S.combo=0;
        setFever(S.fever + 5);
        emit('hha:judge', { type:'miss', label:'MISS' });
        setHUD();
      }
    }, ttl);
  }

  function onShoot(ev){
    if(S.ended || !S.started) return;

    const lockPx = Number(ev?.detail?.lockPx ?? DIFF.lockPx) || DIFF.lockPx;
    const picked = pickByShoot(lockPx);
    if(!picked) return;

    const kind = picked.dataset.kind || 'good';
    try{ picked.remove(); }catch(_){}
    onHit(kind);
  }

  function endGame(reason='timeup'){
    if(S.ended) return;
    S.ended = true;

    const grade = (elGrade && elGrade.textContent) ? elGrade.textContent : computeGrade();

    const totalGoodSeen = S.hitGood + S.expireGood;
    const accuracy = (totalGoodSeen + S.hitJunk) > 0
      ? (S.hitGood / (S.hitGood + S.hitJunk + S.expireGood))
      : 1;

    const summary = {
      game:'GoodJunkVR',
      pack:'fair-s',
      view:S.view,
      runMode:S.run,
      diff:S.diff,
      seed:S.seed,
      durationPlannedSec:S.timePlan,
      durationPlayedSec: Math.round(S.timePlan - S.timeLeft),

      scoreFinal:S.score,
      grade,

      // miss + split
      miss:S.miss,
      miss_goodExpired:S.miss_goodExpired,
      miss_junkHit:S.miss_junkHit,

      comboMax:S.comboMax,

      hitGood:S.hitGood,
      hitJunk:S.hitJunk,
      expireGood:S.expireGood,

      starHit:S.starHit,
      shieldHit:S.shieldHit,
      junkBlocked:S.junkBlocked,
      shieldRemaining:S.shield,

      feverEnd:S.fever,
      accuracy: Number(accuracy.toFixed(3)),

      reason
    };

    try{ localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary)); }catch(_){}
    try{ WIN.removeEventListener('hha:shoot', onShoot); }catch(_){}
    emit('hha:end', summary);
  }

  function tick(ts){
    if(S.ended) return;
    if(!S.lastTick) S.lastTick = ts;

    const dt = Math.min(0.25, (ts - S.lastTick)/1000);
    S.lastTick = ts;

    S.timeLeft = Math.max(0, S.timeLeft - dt);
    if(elTime) elTime.textContent = String(Math.ceil(S.timeLeft));
    emit('hha:time', { left:S.timeLeft });

    if(ts - S.lastSpawn >= DIFF.spawnEveryMs){
      S.lastSpawn = ts;

      // fair distribution:
      // 70% good, 26% junk, 2% star, 2% shield
      const r = S.rng();
      if(r < 0.70) spawn('good');
      else if(r < 0.96) spawn('junk');
      else if(r < 0.98) spawn('star');
      else spawn('shield');
    }

    if(S.timeLeft<=0){
      endGame('timeup');
      return;
    }
    requestAnimationFrame(tick);
  }

  // start
  S.started = true;
  setFever(S.fever);
  setShieldUI();
  setHUD();

  WIN.addEventListener('hha:shoot', onShoot, { passive:true });

  emit('hha:start', { game:'GoodJunkVR', pack:'fair-s', view, runMode:run, diff, timePlanSec:timePlan, seed });
  requestAnimationFrame(tick);
}