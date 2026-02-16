// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE — BOSS โหด++ (HP 10/12/14) + PHASE 2–6s + STORM/RAGE/TELEGRAPH
// ✅ Quest bridge: ยิง quest:update เสมอ => ภารกิจขึ้นแน่
// ✅ End overlay: ใช้ aria-hidden เท่านั้น (ไม่ set display ซ้ำ)
// ✅ Low-time overlay: aria-hidden drives visibility
// ✅ Spawn safe-zone: ให้ CSS vars --gj-top-safe/--gj-bottom-safe คุมสนาม
// ✅ VR/cVR shoot: hha:shoot (aim from center; selects nearest target within radius)
'use strict';

function clamp(v, a, b){ v = Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b, v)); }
function now(){ return performance.now(); }
function qs(k, d=null){ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } }

function byId(id){ return document.getElementById(id); }
function setText(id, v){
  const el = byId(id);
  if(el) el.textContent = (v==null ? '—' : String(v));
}
function setAria(el, hidden){
  if(!el) return;
  el.setAttribute('aria-hidden', hidden ? 'true' : 'false');
}
function emit(name, detail){
  try{ window.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
  try{ document.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
}

/* ---------------- Seeded RNG (deterministic) ---------------- */
function xmur3(str){
  let h=1779033703 ^ str.length;
  for(let i=0;i<str.length;i++){
    h=Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h=(h<<13)|(h>>>19);
  }
  return function(){
    h=Math.imul(h ^ (h>>>16), 2246822507);
    h=Math.imul(h ^ (h>>>13), 3266489909);
    return (h ^= (h>>>16))>>>0;
  };
}
function sfc32(a,b,c,d){
  return function(){
    a >>>=0; b >>>=0; c >>>=0; d >>>=0;
    let t=(a+b)|0;
    a=b ^ (b>>>9);
    b=(c + (c<<3))|0;
    c=(c<<21)|(c>>>11);
    d=(d + 1)|0;
    t=(t + d)|0;
    c=(c + t)|0;
    return (t>>>0) / 4294967296;
  };
}
function makeRng(seedStr){
  const seed = String(seedStr ?? Date.now());
  const h = xmur3(seed);
  return sfc32(h(), h(), h(), h());
}

/* ---------------- FX helpers ---------------- */
function fxPop(x,y,text){
  try{ if(window.Particles?.popText) window.Particles.popText(x,y,text); }catch(_){}
  try{ if(window.HHA_FX?.pop) window.HHA_FX.pop(x,y,text); }catch(_){}
}
function telegraph(intensity=1){
  // minimal telegraph: body flash class + optional director hook
  try{
    document.body.classList.add('gj-telegraph');
    setTimeout(()=>document.body.classList.remove('gj-telegraph'), 260);
  }catch(_){}
  try{ if(window.HHA_FX?.telegraph) window.HHA_FX.telegraph(intensity); }catch(_){}
}

/* ============================================================
   BOOT
   ============================================================ */
export function boot(ctx0={}){
  const ctx = {
    view: (ctx0.view ?? qs('view','mobile') ?? 'mobile') + '',
    run:  (ctx0.run  ?? qs('run','play') ?? 'play') + '',
    diff: (ctx0.diff ?? qs('diff','normal') ?? 'normal') + '',
    time: clamp(ctx0.time ?? qs('time','80'), 20, 300),
    seed: String(ctx0.seed ?? qs('seed','') ?? ''),
  };
  ctx.view = ctx.view.toLowerCase();
  ctx.run  = ctx.run.toLowerCase();
  ctx.diff = ctx.diff.toLowerCase();

  const rng = makeRng(ctx.seed || String(Date.now()));
  const isResearch = (ctx.run === 'research' || ctx.run === 'r');

  // layers
  const L = byId('gj-layer');
  const R = byId('gj-layer-r');

  // overlays
  const endOverlay = byId('endOverlay');
  const lowTimeOverlay = byId('lowTimeOverlay');
  const missionsPeek = byId('missionsPeek');

  // HARD reset overlays (กัน Completed ค้างจากรอบก่อน)
  setAria(endOverlay, true); if(endOverlay) endOverlay.removeAttribute('style');
  setAria(lowTimeOverlay, true); if(lowTimeOverlay) lowTimeOverlay.removeAttribute('style');
  setAria(missionsPeek, true);

  // stats
  let tStart = now();
  let tLast  = now();
  let timeLeft = ctx.time;

  let score = 0;
  let misses = 0;
  let combo = 0;
  let comboMax = 0;

  // fever/shield
  let fever = 0;          // 0..100
  let shield = 0;         // 0..3

  // pacing
  let baseSpawnMs = (ctx.diff === 'easy') ? 820 : (ctx.diff === 'hard') ? 560 : 680;
  let baseLifeMs  = (ctx.diff === 'easy') ? 1250 : (ctx.diff === 'hard') ? 860 : 1050;

  // ---------------- A) BOSS spec ----------------
  const bossHP = (ctx.diff === 'easy') ? 10 : (ctx.diff === 'hard') ? 14 : 12; // 10/12/14
  let bossOn = false;
  let bossHpLeft = bossHP;

  let bossPhase = 0;
  let bossPhaseEndsAt = 0;

  let bossRage = 0; // 0..1 ramp by HP

  // ---------------- B) STORM spec ----------------
  let stormOn = false;
  let stormIntensity = 0; // 0..1
  let stormEndsAt = 0;

  // quest model (ปลอดภัย: ให้มีค่า default เสมอ)
  const goal = { title:'Survive', cur:0, target:10 };
  const mini = { title:'BOSS / STORM', type:'boss_storm', cur:0, target:80, thrMs:0 };

  function pushQuest(){
    // HUD text
    setText('hud-goal', goal.title);
    setText('hud-goal-cur', goal.cur);
    setText('hud-goal-target', goal.target);

    setText('goalDesc', bossOn
      ? `BOSS HP ${bossHpLeft}/${bossHP} · Phase ${bossPhase} · Rage ${Math.round(bossRage*100)}%`
      : 'ทำให้ครบเพื่อชนะ'
    );

    setText('hud-mini', mini.title);
    setText('miniTimer', `${mini.cur}/${mini.target}`);

    // event bridge (ทำให้ HTML ที่ฟัง quest:update ขึ้นแน่)
    emit('quest:update', { goal:{...goal}, mini:{...mini} });
  }

  function gradeFrom(){
    // grade แบบ “รู้สึกเกม” (ง่ายพอใช้)
    if(score >= 950 && misses <= 1) return 'S';
    if(score >= 720 && misses <= 2) return 'A';
    if(score >= 520 && misses <= 4) return 'B';
    return 'C';
  }

  function setHUD(){
    setText('hud-score', score);
    setText('hud-miss', misses);
    setText('hud-time', Math.max(0, Math.ceil(timeLeft)));
    setText('hud-grade', gradeFrom());

    const ff = byId('feverFill');
    if(ff) ff.style.width = `${clamp(fever,0,100)}%`;
    setText('feverText', `${Math.round(clamp(fever,0,100))}%`);
    setText('shieldPills', shield>0 ? '🛡️'.repeat(Math.min(3,shield)) : '—');
  }

  function setLowTime(on, n){
    if(!lowTimeOverlay) return;
    setAria(lowTimeOverlay, !on);
    const num = byId('gj-lowtime-num');
    if(num) num.textContent = String(n ?? 5);
  }

  let ended = false;
  function end(reason='timeup'){
    if(ended) return;
    ended = true;

    const playedSec = Math.max(0, Math.round((now()-tStart)/1000));
    const grade = gradeFrom();

    setText('endTitle', reason==='missLimit' ? 'Game Over' : 'Completed');
    setText('endSub', `reason=${reason} | mode=${ctx.run} | view=${ctx.view}`);
    setText('endGrade', grade);
    setText('endScore', score);
    setText('endMiss', misses);
    setText('endTime', playedSec);

    setAria(endOverlay, false);

    emit('hha:end', {
      reason,
      runMode: ctx.run,
      device: ctx.view,
      grade,
      scoreFinal: score,
      misses,
      durationPlayedSec: playedSec,
      comboMax,
      bossHp: bossHpLeft,
      bossMaxHp: bossHP,
      bossPhase,
      stormOn,
      stormIntensity,
    });
  }

  /* ---------------- targets ---------------- */
  function layerRect(side='L'){
    const el = (side==='R') ? R : L;
    if(!el) return null;
    try{ return el.getBoundingClientRect(); }catch{ return null; }
  }
  function pickSide(){
    // cVR: spawn both
    return (document.body.classList.contains('view-cvr') && R) ? 'BOTH' : 'L';
  }
  function safeXY(rect){
    const pad = 22;
    const x = rect.left + pad + rng() * Math.max(1, (rect.width - pad*2));
    const y = rect.top  + pad + rng() * Math.max(1, (rect.height - pad*2));
    return { x, y };
  }

  function spawnOne(side, kind, emoji, ttlMs, sz){
    const rect = layerRect(side);
    if(!rect) return null;

    const {x,y} = safeXY(rect);

    const el = document.createElement('div');
    el.className = `gj-target ${kind} in`;
    el.style.left = `${x}px`;
    el.style.top  = `${y}px`;
    el.style.setProperty('--sz', `${sz}px`);

    const ring = document.createElement('div');
    ring.className = 'gj-ring';

    const em = document.createElement('div');
    em.className = 'gj-emoji';
    em.textContent = emoji;

    el.appendChild(ring);
    el.appendChild(em);

    const mount = (side==='R') ? R : L;
    mount.appendChild(el);

    const born = now();
    const expiresAt = born + ttlMs;

    const obj = { el, side, kind, emoji, born, expiresAt, hit:false };

    function remove(out=true){
      try{
        if(out) el.classList.add('out');
        setTimeout(()=>{ try{ el.remove(); }catch(_){} }, out?180:0);
      }catch(_){}
    }

    function onTap(ev){
      ev?.preventDefault?.();
      if(obj.hit || ended) return;
      obj.hit = true;

      const cx = ev?.clientX ?? x;
      const cy = ev?.clientY ?? y;

      if(kind === 'good'){
        combo++;
        comboMax = Math.max(comboMax, combo);
        score += 20 + Math.min(40, combo*2);
        fever = clamp(fever + 6, 0, 100);

        if(emoji === '⭐' && bossOn){
          // BOSS token hit
          bossHpLeft = Math.max(0, bossHpLeft - 1);
          bossRage = clamp((bossHP - bossHpLeft)/bossHP, 0, 1);
          goal.cur = bossHP - bossHpLeft;
          mini.cur = clamp(mini.cur + 1, 0, mini.target);
          fxPop(cx,cy,`BOSS -1 (${bossHpLeft})`);
          if(bossHpLeft <= 0){
            bossOn = false;
            stormOn = false;
            telegraph(1.3);
            goal.title = 'Survive';
            goal.cur = 0;
            goal.target = 10;
            fxPop(window.innerWidth/2, 180, 'BOSS DOWN!');
          }
        }else{
          fxPop(cx,cy,'+20');
        }

        if(fever >= 100){
          fever = 0;
          shield = clamp(shield + 1, 0, 3);
          fxPop(cx,cy,'+🛡️');
        }
      }else{
        // junk
        if(shield > 0){
          shield--;
          fxPop(cx,cy,'BLOCK');
        }else{
          misses++;
          combo = 0;
          score = Math.max(0, score - 25);
          fxPop(cx,cy,'MISS');
        }
      }

      remove(true);
      setHUD();
      pushQuest();
    }

    el.addEventListener('pointerdown', onTap, { passive:false });

    obj.tick = ()=>{
      if(obj.hit || ended) return false;
      if(now() >= expiresAt){
        // expire: good = miss (missed good), junk = no miss
        if(kind === 'good'){
          misses++;
          combo = 0;
          fxPop(x,y,'MISS');
          setHUD();
        }
        remove(true);
        return false;
      }
      return true;
    };
    obj.remove = remove;
    return obj;
  }

  const live = [];

  /* ---------------- VR/cVR shoot (hha:shoot) ---------------- */
  function onShoot(ev){
    if(ended) return;
    const d = ev?.detail || {};
    const sx = Number(d.x), sy = Number(d.y);
    const hasXY = Number.isFinite(sx) && Number.isFinite(sy);
    const cx = hasXY ? sx : (window.innerWidth/2);
    const cy = hasXY ? sy : (window.innerHeight/2);

    const RADIUS = 78; // โหด++ แต่ยัง “พอแม่น”
    let best=null, bestDist=1e9;

    for(const obj of live){
      if(!obj || obj.hit) continue;
      const r = obj.el?.getBoundingClientRect?.();
      if(!r) continue;
      const tx = r.left + r.width/2;
      const ty = r.top + r.height/2;
      const dist = Math.hypot(tx-cx, ty-cy);
      if(dist < bestDist){ bestDist = dist; best = obj; }
    }

    if(best && bestDist <= RADIUS){
      try{
        best.el.dispatchEvent(new PointerEvent('pointerdown', { clientX: cx, clientY: cy, bubbles:true }));
      }catch(_){}
    }else{
      // ยิงพลาด: ลงโทษเฉพาะช่วง boss/storm เพื่อความ “โหด++”
      if(bossOn || stormOn){
        misses++;
        combo = 0;
        fxPop(cx,cy,'MISS');
        setHUD();
      }
    }
  }
  window.addEventListener('hha:shoot', onShoot, { passive:true });

  /* ---------------- A+B Boss Phase + Storm/Rage ---------------- */
  function scheduleNextPhase(forceTelegraph=false){
    // phase duration 2–6s
    const dur = 2000 + rng()*4000;
    bossPhaseEndsAt = now() + dur;
    if(forceTelegraph) telegraph(1 + bossRage);
  }

  function startBoss(){
    bossOn = true;
    bossHpLeft = bossHP;
    bossPhase = 1;
    bossRage = 0;
    goal.title = 'BOSS';
    goal.cur = 0;
    goal.target = bossHP;
    telegraph(1.2);
    scheduleNextPhase(true);
    pushQuest();
  }

  function maybeStorm(){
    if(stormOn) return;
    // storm frequency scales with rage
    const p = 0.14 + bossRage*0.30;
    if(rng() < p){
      stormOn = true;
      stormIntensity = clamp(0.35 + bossRage*0.65, 0, 1);
      const dur = 1800 + rng()*2400;
      stormEndsAt = now() + dur;
      telegraph(1.35);
      fxPop(window.innerWidth/2, 220, 'STORM!');
    }
  }

  function spawnWave(){
    if(ended) return;

    // phase shift
    if(bossOn && now() >= bossPhaseEndsAt){
      bossPhase++;
      telegraph(1 + bossRage);
      scheduleNextPhase(false);
      maybeStorm();
    }

    // storm decay
    if(stormOn && now() >= stormEndsAt){
      stormOn = false;
      stormIntensity = 0;
    }

    const rageMul  = bossOn ? (1 + bossRage*0.45) : 1;
    const stormMul = stormOn ? (1 + stormIntensity*0.65) : 1;

    const spawnMs = Math.max(240, baseSpawnMs / (rageMul*stormMul));
    const lifeMs  = Math.max(420, baseLifeMs  / (rageMul*stormMul));

    // size shrinks when rage/storm rises (โหด++)
    const szBase = (ctx.view.includes('mobile')) ? 86 : 92;
    const sz = clamp(szBase - bossRage*12 - stormIntensity*10, 62, 96);

    // choose spawn composition
    const inBoss = bossOn;
    const bossTokenBias = inBoss ? (0.22 + bossRage*0.18) : 0; // ⭐ to damage boss
    const junkBias = stormOn ? 0.60 : 0.40;

    function spawnPack(side){
      const r = rng();
      let kind='good', emoji='🥦';

      if(inBoss && r < bossTokenBias){
        kind='good'; emoji='⭐';
      }else if(r < junkBias){
        kind='bad'; emoji = (rng()<.5)?'🍟':'🥤';
      }else{
        kind='good'; emoji = (rng()<.5)?'🍎':'🥦';
      }

      const obj = spawnOne(side, kind, emoji, lifeMs, sz);
      if(obj) live.push(obj);
    }

    const side = pickSide();
    if(side === 'BOTH'){
      spawnPack('L'); spawnPack('R');
      if(stormOn && rng() < 0.55){ spawnPack('L'); spawnPack('R'); } // storm burst
    }else{
      spawnPack('L');
      if(stormOn && rng() < 0.50) spawnPack('L');
    }

    setTimeout(spawnWave, spawnMs);
  }

  /* ---------------- main tick ---------------- */
  const missLimit = (ctx.diff === 'easy') ? 10 : (ctx.diff === 'hard') ? 6 : 8;

  function tick(){
    if(ended) return;

    const t = now();
    const dt = Math.min(0.05, (t - tLast)/1000);
    tLast = t;

    timeLeft -= dt;
    if(timeLeft <= 0){
      timeLeft = 0;
      setHUD();
      setLowTime(false, 0);
      end('timeup');
      return;
    }

    if(timeLeft <= 5) setLowTime(true, Math.ceil(timeLeft));
    else setLowTime(false, 0);

    // expire targets
    for(let i=live.length-1;i>=0;i--){
      const obj = live[i];
      if(!obj){ live.splice(i,1); continue; }
      const alive = obj.tick?.();
      if(!alive) live.splice(i,1);
    }

    // boss trigger (กลางเกม + คะแนนถึง)
    if(!bossOn && timeLeft <= ctx.time*0.65 && score >= 180){
      startBoss();
    }

    // survival progress (ถ้าไม่อยู่ boss)
    if(!bossOn){
      goal.title = 'Survive';
      goal.cur = Math.min(goal.target, Math.floor((ctx.time - timeLeft) / 6));
      goal.target = 10;
    }

    // miss limit
    if(misses >= missLimit){
      end('missLimit');
      return;
    }

    setHUD();
    pushQuest();
    requestAnimationFrame(tick);
  }

  // start
  setHUD();
  pushQuest();
  setTimeout(pushQuest, 0);     // กัน HUD ช้า
  setTimeout(pushQuest, 120);   // กันมือถือ render ช้า
  spawnWave();
  requestAnimationFrame(tick);

  // debug hook
  window.GJ = window.GJ || {};
  window.GJ._state = ()=>({ score, misses, comboMax, bossOn, bossHpLeft, bossHP, bossPhase, bossRage, stormOn, stormIntensity, timeLeft, missLimit, isResearch });
}