// === /herohealth/plate/plate.safe.js ===
// PlateVR SAFE — PRODUCTION (CLASSROOM + PRACTICE + MINI BOSS + RAMP + STREAK BONUS + AI WARN)
// FULL v20260303c-CLASSROOM-RAMP-STREAK-AIWARN
'use strict';

export function boot(cfg){
  cfg = cfg || {};
  const WIN = window, DOC = document;

  const clamp=(v,a,b)=>{ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b,v)); };
  const nowMs = ()=> (performance && performance.now) ? performance.now() : Date.now();

  // rng
  function xmur3(str){
    str=String(str||'');
    let h=1779033703^str.length;
    for(let i=0;i<str.length;i++){
      h=Math.imul(h^str.charCodeAt(i),3432918353);
      h=(h<<13)|(h>>>19);
    }
    return function(){
      h=Math.imul(h^(h>>>16),2246822507);
      h=Math.imul(h^(h>>>13),3266489909);
      return (h^=(h>>>16))>>>0;
    };
  }
  function sfc32(a,b,c,d){
    return function(){
      a>>>=0;b>>>=0;c>>>=0;d>>>=0;
      let t=(a+b)|0;
      a=b^(b>>>9);
      b=(c+(c<<3))|0;
      c=(c<<21)|(c>>>11);
      d=(d+1)|0;
      t=(t+d)|0;
      c=(c+t)|0;
      return (t>>>0)/4294967296;
    };
  }
  function makeRng(seedStr){
    const s=xmur3(seedStr);
    return sfc32(s(),s(),s(),s());
  }

  const view = String(cfg.view || 'mobile').toLowerCase();
  const runMode = String(cfg.run || 'play').toLowerCase(); // play | research | practice
  const diff = String(cfg.diff || 'normal').toLowerCase();
  const plannedSec = clamp(cfg.time ?? 90, 20, 300);
  const seedStr = String(cfg.seed ?? String(Date.now()));
  const rng = makeRng(seedStr);
  const r01 = ()=> rng();
  const pick = (arr)=> arr[(r01()*arr.length)|0];

  const pid = String(cfg.pid || 'anon').trim() || 'anon';
  const mode = String(cfg.mode || 'free').toLowerCase(); // free|classroom
  const isClassroom = !!cfg.classroom || (mode === 'classroom');

  const miniBossOn  = !!cfg.miniBoss;
  const miniBossSec = clamp(cfg.miniBossSec ?? 12, 8, 18);

  const mount = cfg.mount || DOC.getElementById('plate-layer');
  if(!mount){ console.warn('[Plate] Missing mount'); return; }

  // UI (รองรับทั้ง layout ใหม่/เก่า — ถ้าไม่มีก็ข้าม)
  const ui = {
    score: DOC.getElementById('uiScore'),
    combo: DOC.getElementById('uiCombo'),
    comboMax: DOC.getElementById('uiComboMax'),
    miss: DOC.getElementById('uiMiss'),
    time: DOC.getElementById('uiTime'),
    acc: DOC.getElementById('uiAcc'),
    grade: DOC.getElementById('uiGrade'),
    stars: DOC.getElementById('uiStars'),
    plateHave: DOC.getElementById('uiPlateHave'),
    targetText: DOC.getElementById('uiTargetText'),
    goalFill: DOC.getElementById('uiGoalFill'),
    goalCount: DOC.getElementById('uiGoalCount'),
    fever: DOC.getElementById('uiFever'),
    shield: DOC.getElementById('uiShield'),
    coachMsg: DOC.getElementById('coachMsg'),
    stage: DOC.getElementById('uiStage'),
  };

  const GROUPS = [
    { id:1, short:'หมู่ 1', name:'หมู่ 1 โปรตีน', items:['🥚','🐟','🥛','🍗','🥜'] },
    { id:2, short:'หมู่ 2', name:'หมู่ 2 คาร์โบไฮเดรต', items:['🍚','🍞','🥔','🍜','🥖'] },
    { id:3, short:'หมู่ 3', name:'หมู่ 3 ผัก', items:['🥦','🥬','🥕','🥒','🌽'] },
    { id:4, short:'หมู่ 4', name:'หมู่ 4 ผลไม้', items:['🍌','🍎','🍊','🍉','🍇'] },
    { id:5, short:'หมู่ 5', name:'หมู่ 5 ไขมัน', items:['🥑','🫒','🧈','🥥','🧀'] },
  ];

  // ---------- tuning ----------
  const BASE = (function(){
    let spawnPerSec = 1.25, ttl=2.9;
    if(diff==='easy'){ spawnPerSec = 1.05; ttl=3.2; }
    if(diff==='hard'){ spawnPerSec = 1.45; ttl=2.6; }
    if(view==='cvr'||view==='vr') ttl += 0.15;

    if(runMode === 'practice'){ spawnPerSec *= 0.92; ttl += 0.25; }
    return { spawnPerSec, ttl };
  })();

  // Time Ramp (ค่อย ๆ เดือดขึ้นตอนท้าย)
  // easy ramp ต่ำ / hard ramp สูง
  const RAMP_MAX = (diff==='easy') ? 0.18 : (diff==='hard') ? 0.32 : 0.24; // +18%..+32%
  const TTL_SHRINK_MAX = (diff==='easy') ? 0.18 : (diff==='hard') ? 0.28 : 0.22; // ลด TTL ตอนท้าย
  function ramp01(elapsed){
    const t = clamp(elapsed / plannedSec, 0, 1);
    // smoothstep
    return t*t*(3-2*t);
  }

  // ---------- state ----------
  let playing=true;
  let paused=false;
  let tLeft=plannedSec;
  let lastTick=nowMs();
  const startMs = nowMs();

  WIN.__PLATE_SET_PAUSED__ = (on)=>{ paused=!!on; lastTick=nowMs(); };

  let score=0;
  let ok=0, wrong=0, miss=0;
  let shots=0, hits=0;
  let combo=0, bestCombo=0;
  let shield=0;
  let feverPct=0;

  const have = {1:0,2:0,3:0,4:0,5:0};
  const haveAny = ()=> Object.values(have).filter(v=>v>0).length;

  let targetGroup = pick(GROUPS);

  // stage machine
  let stage = (runMode === 'practice') ? 'practice' : 'main'; // main | miniboss
  let miniBossLeft = miniBossSec;
  let miniBossTarget = null;
  let miniBossOk = 0;

  // targets
  const targets = new Map();
  let idSeq=1;

  // ---------- helpers ----------
  function safeRect(){
    const s = WIN.__HHA_SPAWN_SAFE__;
    if(s && Number.isFinite(s.xMin)) return s;
    const r = mount.getBoundingClientRect();
    const PAD=14;
    return { xMin:r.left+PAD, xMax:r.right-PAD, yMin:r.top+120, yMax:r.bottom-150 };
  }
  function posInSafe(){
    const s = safeRect();
    const x = s.xMin + r01() * Math.max(1, (s.xMax - s.xMin));
    const y = s.yMin + r01() * Math.max(1, (s.yMax - s.yMin));
    return { x, y };
  }
  function setCoach(msg, mood){
    if(ui.coachMsg && msg) ui.coachMsg.textContent = msg;
    // push event for unified HUDs
    try{ WIN.dispatchEvent(new CustomEvent('hha:coach', { detail:{ text: msg, mood: mood||'neutral' } })); }catch(_){}
  }
  function accPct(){
    const a = shots>0 ? (hits/shots)*100 : 0;
    return Math.round(a);
  }
  function gradeLetter(){
    const a = accPct();
    const p = haveAny();
    const x = (a*0.6) + (p*10) - Math.min(20, miss)*0.8;
    if(x>=92) return 'S';
    if(x>=80) return 'A';
    if(x>=66) return 'B';
    if(x>=50) return 'C';
    return 'D';
  }

  // ⭐ star score (5 ดาว)
  function starsFromPerformance(){
    const a = accPct();
    const plate = haveAny();
    const missPenalty = (runMode==='practice') ? 0 : Math.min(20, miss) * 0.6;
    const scoreX = (a * 0.55) + (plate * 12) - missPenalty;
    if(scoreX >= 88) return 5;
    if(scoreX >= 76) return 4;
    if(scoreX >= 62) return 3;
    if(scoreX >= 48) return 2;
    if(scoreX >= 34) return 1;
    return 0;
  }

  function setHUD(){
    if(ui.score) ui.score.textContent = String(score|0);
    if(ui.combo) ui.combo.textContent = String(combo|0);
    if(ui.comboMax) ui.comboMax.textContent = String(bestCombo|0);
    if(ui.miss) ui.miss.textContent = String(miss|0);
    if(ui.time) ui.time.textContent = String(Math.ceil(tLeft));
    if(ui.acc) ui.acc.textContent = `${accPct()}%`;
    if(ui.plateHave) ui.plateHave.textContent = String(haveAny());
    if(ui.targetText) ui.targetText.textContent = targetGroup?.name || '—';
    if(ui.grade) ui.grade.textContent = gradeLetter();

    const stars = starsFromPerformance();
    if(ui.stars) ui.stars.textContent = String(stars);

    if(ui.goalCount) ui.goalCount.textContent = `${haveAny()}/5`;
    if(ui.goalFill){
      const pct = Math.round((haveAny()/5)*100);
      ui.goalFill.style.width = `${pct}%`;
    }
    if(ui.shield) ui.shield.textContent = String(shield|0);
    if(ui.fever) ui.fever.textContent = `${Math.round(clamp(feverPct,0,100))}%`;

    if(ui.stage){
      ui.stage.textContent =
        stage==='practice' ? 'STAGE: PRACTICE' :
        stage==='miniboss' ? 'STAGE: MINI BOSS' : 'STAGE: MAIN';
    }
  }

  // ----- AI warning (rate-limit) -----
  let lastWarnMs = 0;
  const WARN_GAP_MS = 2200;
  function aiWarnMaybe(elapsedSec){
    const now = nowMs();
    if(now - lastWarnMs < WARN_GAP_MS) return;

    // prediction (if available)
    let hazard = null;
    try{
      const pred = cfg.ai?.getPrediction?.() || null;
      if(pred && pred.hazardRisk != null) hazard = Number(pred.hazardRisk);
    }catch(_){}

    const a = accPct();
    const late = elapsedSec > plannedSec*0.55;

    // rule-based + optional prediction
    let msg = '';
    let mood = 'neutral';
    if(stage==='miniboss'){
      msg = `บอสมา! เน้น “${miniBossTarget?.short||targetGroup.short}” ให้รัวแต่ไม่มั่ว ⚡`;
      mood = 'fever';
    }else if(hazard != null && hazard >= 0.78 && late){
      msg = 'เริ่มพลาดถี่แล้ว—ช้าลงนิด เล็งให้แม่น 🎯';
      mood = 'sad';
    }else if(a < 55 && shots >= 10){
      msg = 'โฟกัสเป้าภารกิจเท่านั้น! อย่ายิงมั่ว 👀';
      mood = 'neutral';
    }else if(combo >= 5){
      msg = 'คอมโบกำลังมา! รักษาจังหวะไว้ 🔥';
      mood = 'happy';
    }else if(late){
      msg = 'ช่วงท้ายเริ่มเดือดขึ้น—ใจเย็น แล้วเล็งกลางจอ 🎯';
      mood = 'neutral';
    }else{
      return;
    }

    lastWarnMs = now;
    setCoach(msg, mood);
  }

  // ----- choosing emojis -----
  function chooseEmoji(){
    const curTarget = (stage==='miniboss' && miniBossTarget) ? miniBossTarget : targetGroup;

    // miniboss ให้ถูกเยอะขึ้นเพื่อ “รู้สึกเก่ง”
    const correctP = (stage==='miniboss') ? 0.82 : 0.72;
    const makeCorrect = (r01() < correctP);

    if(makeCorrect) return { emoji: pick(curTarget.items), isMission:true };

    const others = GROUPS.filter(g=>g.id!==curTarget.id);
    const g = pick(others);
    return { emoji: pick(g.items), isMission:false, otherGroupId:g.id };
  }

  // ----- target create/remove -----
  function makeTarget(ttlSec){
    const id = String(idSeq++);
    const el = DOC.createElement('div');
    el.className = 'plateTarget';

    const { emoji, isMission, otherGroupId } = chooseEmoji();
    el.textContent = emoji;
    el.dataset.id = id;
    el.dataset.kind = isMission ? 'target' : 'wrong';
    if(!isMission) el.setAttribute('data-kind','wrong');

    const p = posInSafe();
    el.style.left = `${p.x}px`;
    el.style.top  = `${p.y}px`;

    mount.appendChild(el);

    const born = nowMs();
    const ttlMs = Math.max(1.05, ttlSec) * 1000;

    const obj = { id, el, emoji, isMission, otherGroupId: otherGroupId||0, born, ttlMs };
    targets.set(id, obj);

    try{ cfg.ai?.onSpawn?.(isMission ? 'food_target' : 'food_other', { id, emoji, ttlSec }); }catch(_){}
    return obj;
  }

  function removeTarget(id, cls){
    const t = targets.get(String(id));
    if(!t) return;
    targets.delete(String(id));
    try{
      if(cls) t.el.classList.add(cls);
      setTimeout(()=>{ try{ t.el.remove(); }catch(_){} }, 120);
    }catch(_){}
  }

  // ----- scoring: STREAK BONUS (เดือดขึ้น!) -----
  function streakBonus(comboNow){
    // ป.5 ต้อง “รู้สึกพุ่ง” แต่ไม่เว่อร์
    if(comboNow >= 10) return 10;
    if(comboNow >= 7)  return 7;
    if(comboNow >= 5)  return 5;
    if(comboNow >= 3)  return 3;
    return 0;
  }

  function onHit(t){
    shots++;

    if(t.isMission){
      hits++;
      ok++;
      combo++; bestCombo = Math.max(bestCombo, combo);

      // base score + streak bonus
      let add = 9 + Math.min(10, combo);
      add += streakBonus(combo);
      score += add;

      const g = GROUPS.find(g=>g.items.includes(t.emoji));
      if(g) have[g.id] = Math.max(have[g.id], 1);

      if(stage === 'miniboss'){
        miniBossOk++;
        if(miniBossOk === 1) setCoach('เริ่มดีมาก! ยิงให้เข้าหมู่เดียวเท่านั้น ⚡', 'fever');
      }else if(ok % 5 === 0){
        targetGroup = pick(GROUPS);
        setCoach(`สลับภารกิจ! หา “${targetGroup.short}” 🎯`, 'neutral');
      }else if(combo === 4){
        setCoach('คอมโบมาแล้ว! รักษาจังหวะ 🔥', 'happy');
      }

      try{ cfg.ai?.onHit?.('food_ok', { id:t.id, emoji:t.emoji, add }); }catch(_){}
      removeTarget(t.id, 'hit');
      return;
    }

    // wrong
    wrong++;
    combo = 0;
    score = Math.max(0, score - 3);

    try{ cfg.ai?.onHit?.('food_wrong', { id:t.id, emoji:t.emoji }); }catch(_){}
    removeTarget(t.id, 'hit');
  }

  // pointer hit
  mount.addEventListener('pointerdown', (ev)=>{
    if(!playing || paused) return;
    const el = ev.target?.closest?.('.plateTarget');
    if(!el) return;
    const t = targets.get(String(el.dataset.id));
    if(t) onHit(t);
  }, { passive:true });

  // crosshair shoot
  function pickClosestToCenter(lockPx){
    lockPx = clamp(lockPx ?? 56, 16, 140);
    let best=null, bestD=1e9;
    const r = mount.getBoundingClientRect();
    const cx = r.left + r.width/2;
    const cy = r.top + r.height/2;

    for(const t of targets.values()){
      const b = t.el.getBoundingClientRect();
      const tx = b.left + b.width/2;
      const ty = b.top + b.height/2;
      const d = Math.hypot(tx-cx, ty-cy);
      if(d < bestD){ bestD=d; best=t; }
    }
    if(best && bestD <= lockPx) return best;
    return null;
  }
  WIN.addEventListener('hha:shoot', (ev)=>{
    if(!playing || paused) return;
    const lockPx = ev?.detail?.lockPx ?? 56;
    const t = pickClosestToCenter(lockPx);
    if(t) onHit(t);
  });

  // fever/shield
  function setFeverShield(dt){
    feverPct = clamp(feverPct + (combo>=3 ? 22*dt : -10*dt), 0, 100);
    if(feverPct >= 100){
      feverPct = 0;
      shield = Math.min(3, shield + 1);
      setCoach('ได้โล่! 🛡️', 'happy');
      try{ WIN.dispatchEvent(new CustomEvent('hha:score', { detail:{ shield, feverPct } })); }catch(_){}
    }
  }

  // RAMP controls
  function rampedSpawnPerSec(elapsed){
    if(runMode==='practice') return BASE.spawnPerSec;
    const r = ramp01(elapsed);
    return BASE.spawnPerSec * (1 + RAMP_MAX * r);
  }
  function rampedTTL(elapsed){
    if(runMode==='practice') return BASE.ttl;
    const r = ramp01(elapsed);
    return Math.max(1.15, BASE.ttl * (1 - TTL_SHRINK_MAX * r));
  }

  // spawn loop
  let spawnAcc=0;
  function spawnTick(dt, elapsed){
    const sp = rampedSpawnPerSec(elapsed);
    const ttl = rampedTTL(elapsed);

    spawnAcc += sp * dt;
    while(spawnAcc >= 1){
      spawnAcc -= 1;
      makeTarget(ttl);
    }
  }

  // expire + FAIR MISS
  function updateTargets(){
    const t = nowMs();
    for(const obj of Array.from(targets.values())){
      const age = t - obj.born;
      if(age >= obj.ttlMs){
        if(runMode !== 'practice'){
          // ✅ miss นับเฉพาะ “ภารกิจ” ที่ปล่อยหลุด
          if(obj.isMission){
            miss++;
            score = Math.max(0, score - 2);
            combo = 0;
            try{ cfg.ai?.onExpire?.('food_target', { id:obj.id, emoji:obj.emoji }); }catch(_){}
          }else{
            wrong++;
            score = Math.max(0, score - 1);
            try{ cfg.ai?.onExpire?.('food_other', { id:obj.id, emoji:obj.emoji }); }catch(_){}
          }
        }
        removeTarget(obj.id, 'expire');
      }
    }
  }

  // classroom mini boss
  function startMiniBoss(){
    stage = 'miniboss';
    miniBossLeft = miniBossSec;
    miniBossOk = 0;
    miniBossTarget = pick(GROUPS);
    targetGroup = miniBossTarget;
    setCoach(`MINI BOSS! ⚡ เน้น “${miniBossTarget.short}” ให้ได้เยอะสุดใน ${miniBossSec}s`, 'fever');
  }

  // end summary
  const END_SENT_KEY='__HHA_PLATE_END_SENT__';
  function dispatchEndOnce(summary){
    try{
      if(WIN[END_SENT_KEY]) return;
      WIN[END_SENT_KEY]=1;
      WIN.dispatchEvent(new CustomEvent('hha:game-ended', { detail: summary || null }));
      WIN.dispatchEvent(new CustomEvent('hha:end', { detail: summary || null })); // สำหรับระบบอื่นที่ฟัง hha:end
    }catch(_){}
  }

  function buildSummary(reason){
    return {
      projectTag: 'PlateVR',
      gameVersion: 'PlateVR_SAFE_2026-03-03c',
      device: view,
      runMode,
      diff,
      seed: seedStr,
      pid,
      mode,
      classroom: isClassroom ? 1 : 0,
      stageEnded: stage,
      miniBoss: (isClassroom && miniBossOn) ? 1 : 0,
      miniBossSec: (isClassroom && miniBossOn) ? miniBossSec : 0,
      miniBossOk: (stage==='miniboss') ? miniBossOk : 0,
      reason: String(reason||''),
      durationPlannedSec: plannedSec,
      durationPlayedSec: Math.round(plannedSec - tLeft),
      scoreFinal: score|0,
      ok: ok|0,
      wrong: wrong|0,
      missTotal: miss|0,
      shots: shots|0,
      hits: hits|0,
      accPct: accPct(),
      comboMax: bestCombo|0,
      plateHave: haveAny(),
      stars: starsFromPerformance(),
      grade: gradeLetter(),
      targetGroupLast: targetGroup?.name || '—',
      aiPredictionLast: (function(){ try{ return cfg.ai?.getPrediction?.() || null; }catch(_){ return null; } })()
    };
  }

  function showEnd(reason){
    playing=false; paused=false;
    for(const t of targets.values()){
      try{ t.el.remove(); }catch(_){}
    }
    targets.clear();

    const summary = buildSummary(reason);
    WIN.__HHA_LAST_SUMMARY = summary;

    try{ cfg.ai?.onEnd?.(summary); }catch(_){}
    dispatchEndOnce(summary);
  }

  // main loop
  function tick(){
    if(!playing) return;

    if(paused){
      lastTick=nowMs();
      setHUD();
      requestAnimationFrame(tick);
      return;
    }

    const t=nowMs();
    const dt=Math.min(0.05, Math.max(0.001, (t-lastTick)/1000));
    lastTick=t;

    const elapsed = (t - startMs) / 1000;

    tLeft = Math.max(0, tLeft - dt);

    // miniboss timer
    if(stage === 'miniboss'){
      miniBossLeft = Math.max(0, miniBossLeft - dt);
      if(miniBossLeft <= 0){
        showEnd('miniboss-done');
        return;
      }
    }

    spawnTick(dt, elapsed);
    updateTargets();
    setFeverShield(dt);

    // AI hooks tick (prediction only)
    try{ cfg.ai?.onTick?.(dt, { ok, wrong, miss, combo, acc: accPct(), stage, elapsed }); }catch(_){}
    aiWarnMaybe(elapsed);

    setHUD();

    // end logic
    if(tLeft<=0){
      if(isClassroom && miniBossOn && stage === 'main' && runMode !== 'practice'){
        startMiniBoss();
        // กันรอยต่อ
        tLeft = 6;
        requestAnimationFrame(tick);
        return;
      }
      showEnd('time');
      return;
    }

    requestAnimationFrame(tick);
  }

  DOC.addEventListener('visibilitychange', ()=>{
    if(DOC.hidden && playing) showEnd('background');
  });

  WIN[END_SENT_KEY]=0;

  // init
  if(runMode === 'practice'){
    setCoach('PRACTICE 15s — ซ้อมก่อน (ไม่คิด miss) 🧪', 'neutral');
  }else{
    setCoach(`ภารกิจ: หา “${targetGroup.short}” 🎯`, 'neutral');
  }

  setHUD();
  requestAnimationFrame(tick);
}