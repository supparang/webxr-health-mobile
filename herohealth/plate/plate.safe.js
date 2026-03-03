// === /herohealth/plate/plate.safe.js ===
// PlateVR SAFE — PRODUCTION
// PATCH v20260303-PLATE-A-IDSYNC-SPAWNSAFE-FAIRMISS-KIDSUMMARY
// ✅ DOM IDs sync with new plate-vr.html
// ✅ Spawn-safe uses window.__HHA_SPAWN_SAFE__ to avoid HUD blocks
// ✅ Fair miss: expire counts as miss ONLY when it was "target-correct" item
// ✅ Kid-friendly scoring + stars summary
'use strict';

export function boot(cfg){
  cfg = cfg || {};
  const WIN = window, DOC = document;

  const clamp=(v,a,b)=>{ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b,v)); };
  const nowMs = ()=> (performance && performance.now) ? performance.now() : Date.now();

  // --- deterministic rng ---
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
  const runMode = String(cfg.run || 'play').toLowerCase();
  const diff = String(cfg.diff || 'normal').toLowerCase();
  const plannedSec = clamp(cfg.time ?? 90, 20, 300);
  const seedStr = String(cfg.seed ?? String(Date.now()));
  const rng = makeRng(seedStr);
  const r01 = ()=> rng();
  const pick = (arr)=> arr[(r01()*arr.length)|0];

  const pid = String(cfg.pid || 'anon').trim() || 'anon';
  const hubUrl = String(cfg.hub || '../hub.html');

  const mount = cfg.mount || DOC.getElementById('plate-layer');
  if(!mount){ console.warn('[Plate] Missing mount'); return; }

  // UI (match plate-vr.html)
  const ui = {
    score: DOC.getElementById('uiScore'),
    combo: DOC.getElementById('uiCombo'),
    comboMax: DOC.getElementById('uiComboMax'),
    miss: DOC.getElementById('uiMiss'),
    time: DOC.getElementById('uiTime'),
    acc: DOC.getElementById('uiAcc'),
    stars: DOC.getElementById('uiStars'),
    plateHave: DOC.getElementById('uiPlateHave'),
    targetText: DOC.getElementById('uiTargetText'),
    goalFill: DOC.getElementById('uiGoalFill'),
    goalCount: DOC.getElementById('uiGoalCount'),
    fever: DOC.getElementById('uiFever'),
    shield: DOC.getElementById('uiShield'),
    coachMsg: DOC.getElementById('coachMsg'),
  };

  // Thai 5 food groups mapping (fixed)
  const GROUPS = [
    { id:1, short:'หมู่ 1', name:'หมู่ 1 โปรตีน', items:['🥚','🐟','🥛','🍗','🥜'] },
    { id:2, short:'หมู่ 2', name:'หมู่ 2 คาร์โบไฮเดรต', items:['🍚','🍞','🥔','🍜','🥖'] },
    { id:3, short:'หมู่ 3', name:'หมู่ 3 ผัก', items:['🥦','🥬','🥕','🥒','🌽'] },
    { id:4, short:'หมู่ 4', name:'หมู่ 4 ผลไม้', items:['🍌','🍎','🍊','🍉','🍇'] },
    { id:5, short:'หมู่ 5', name:'หมู่ 5 ไขมัน', items:['🥑','🫒','🧈','🥥','🧀'] },
  ];

  // Tuning (kid-friendly)
  const TUNE = (function(){
    // spawnPerSec is number of targets per sec
    let spawnPerSec = 1.25, ttl=2.9;
    if(diff==='easy'){ spawnPerSec = 1.05; ttl=3.2; }
    if(diff==='hard'){ spawnPerSec = 1.45; ttl=2.6; }
    if(view==='cvr'||view==='vr') ttl += 0.15;
    return { spawnPerSec, ttl };
  })();

  // state
  let playing=true;
  let paused=false;
  let tLeft=plannedSec;
  let lastTick=nowMs();

  WIN.__PLATE_SET_PAUSED__ = (on)=>{ paused=!!on; lastTick=nowMs(); };

  let score=0;
  let ok=0, wrong=0, miss=0;
  let shots=0, hits=0;
  let combo=0, bestCombo=0;
  let shield=0;
  let feverPct=0;

  // “plate completion” counts (5 groups)
  const have = {1:0,2:0,3:0,4:0,5:0};
  const haveAny = ()=> Object.values(have).filter(v=>v>0).length;

  // mission
  let targetGroup = pick(GROUPS);

  // targets
  const targets = new Map();
  let idSeq=1;

  function safeRect(){
    // expected in viewport coords
    const s = WIN.__HHA_SPAWN_SAFE__;
    if(s && Number.isFinite(s.xMin)) return s;

    // fallback to mount rect with simple pads
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

  function isCorrectEmoji(emoji){
    return (targetGroup?.items || []).includes(emoji);
  }

  function chooseEmoji(){
    // 70% spawn correct-for-current-mission
    const makeCorrect = (r01() < 0.70);
    if(makeCorrect) return { emoji: pick(targetGroup.items), isMission:true };

    // else from other group (still food but not mission)
    const others = GROUPS.filter(g=>g.id!==targetGroup.id);
    const g = pick(others);
    return { emoji: pick(g.items), isMission:false, otherGroupId:g.id };
  }

  function makeTarget(){
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
    const ttlMs = Math.max(1.1, TUNE.ttl) * 1000;

    const obj = { id, el, emoji, isMission, otherGroupId: otherGroupId||0, born, ttlMs };
    targets.set(id, obj);

    try{ cfg.ai?.onSpawn?.(isMission ? 'food_target' : 'food_other', { id, emoji, ttlSec: TUNE.ttl }); }catch(_){}
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

  function setCoach(msg){
    if(ui.coachMsg && msg) ui.coachMsg.textContent = msg;
    try{ WIN.dispatchEvent(new CustomEvent('hha:coach', { detail:{ msg, mood:'neutral' } })); }catch(_){}
  }

  function accPct(){
    const a = shots>0 ? (hits/shots)*100 : 0;
    return Math.round(a);
  }

  function starsFromPerformance(){
    // kid-friendly stars based on accuracy + plate completion - mild miss penalty
    const a = accPct();
    const plate = haveAny(); // 0..5
    const missPenalty = Math.min(20, miss) * 0.6;

    const scoreX = (a * 0.55) + (plate * 12) - missPenalty; // ~0..100
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

    const stars = starsFromPerformance();
    if(ui.stars) ui.stars.textContent = String(stars);

    // goal bar = plate completion
    if(ui.goalCount) ui.goalCount.textContent = `${haveAny()}/5`;
    if(ui.goalFill){
      const pct = Math.round((haveAny()/5)*100);
      ui.goalFill.style.width = `${pct}%`;
    }

    // simple fever/shield display (keep compatible)
    if(ui.shield) ui.shield.textContent = String(shield|0);
    if(ui.fever) ui.fever.textContent = `${Math.round(clamp(feverPct,0,100))}%`;
  }

  // hit handling
  function onHit(t){
    shots++;

    // mission target => OK
    if(t.isMission){
      hits++;
      ok++;
      combo++; bestCombo = Math.max(bestCombo, combo);

      // mild scoring for kids
      const add = 10 + Math.min(10, combo);
      score += add;

      // credit plate group (based on which group contains emoji)
      const g = GROUPS.find(g=>g.items.includes(t.emoji));
      if(g) have[g.id] = Math.max(have[g.id], 1);

      // rotate mission occasionally
      if(ok % 5 === 0){
        targetGroup = pick(GROUPS);
        setCoach(`เปลี่ยนภารกิจ! หา “${targetGroup.short}” 🎯`);
      }else if(combo === 4){
        setCoach('คอมโบมาแล้ว! 🔥 ยิงต่อเนื่อง!');
      }

      try{ cfg.ai?.onHit?.('food_ok', { id:t.id, emoji:t.emoji }); }catch(_){}
      removeTarget(t.id, 'hit');
      return;
    }

    // other (wrong group) => WRONG (but NOT as harsh as miss)
    wrong++;
    combo = 0;

    // small penalty only
    score = Math.max(0, score - 3);

    try{ cfg.ai?.onHit?.('food_wrong', { id:t.id, emoji:t.emoji }); }catch(_){}
    removeTarget(t.id, 'hit');
  }

  // pointer hits
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

  // spawn/update loop
  let spawnAcc=0;
  function spawnTick(dt){
    spawnAcc += TUNE.spawnPerSec * dt;
    while(spawnAcc >= 1){
      spawnAcc -= 1;
      makeTarget();
    }
  }

  function updateTargets(){
    const t = nowMs();
    for(const obj of Array.from(targets.values())){
      const age = t - obj.born;
      if(age >= obj.ttlMs){
        // ✅ FAIR MISS:
        // expire counts as MISS only if it was mission target (player *should* hit)
        // if it was "other" group, count as wrong but not miss (reduces unfair spikes)
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
        removeTarget(obj.id, 'expire');
      }
    }
  }

  function setFeverShield(dt){
    // simple, kid-friendly
    // fever rises with combo, falls slowly
    feverPct = clamp(feverPct + (combo>=3 ? 22*dt : -10*dt), 0, 100);
    if(feverPct >= 100){
      feverPct = 0;
      shield = Math.min(3, shield + 1);
      setCoach('ได้โล่! 🛡️');
    }
  }

  // pause/resume events (standard)
  WIN.addEventListener('hha:pause', ()=>{ paused=true; lastTick=nowMs(); });
  WIN.addEventListener('hha:resume', ()=>{ paused=false; lastTick=nowMs(); });

  // end summary
  const END_SENT_KEY='__HHA_PLATE_END_SENT__';
  function dispatchEndOnce(summary){
    try{
      if(WIN[END_SENT_KEY]) return;
      WIN[END_SENT_KEY]=1;
      WIN.dispatchEvent(new CustomEvent('hha:game-ended', { detail: summary || null }));
    }catch(_){}
  }

  function buildSummary(reason){
    const stars = starsFromPerformance();
    return {
      projectTag: 'PlateVR',
      gameVersion: 'PlateVR_SAFE_2026-03-03_LAYOUT_SPAWNSAFE',
      device: view,
      runMode,
      diff,
      seed: seedStr,
      pid,
      reason: String(reason||''),
      durationPlannedSec: plannedSec,
      durationPlayedSec: Math.round(plannedSec - tLeft),
      scoreFinal: score|0,
      ok: ok|0,
      wrong: wrong|0,
      missTotal: miss|0,
      shots: shots|0,
      hits: hits|0,
      accPct: `${accPct()}%`,
      comboMax: bestCombo|0,
      plateHave: haveAny(),
      stars,
      targetGroupLast: targetGroup?.name || '—',
      aiPredictionLast: (function(){ try{ return cfg.ai?.getPrediction?.() || null; }catch(_){ return null; } })()
    };
  }

  function showEnd(reason){
    playing=false;
    paused=false;

    for(const t of targets.values()){
      try{ t.el.remove(); }catch(_){}
    }
    targets.clear();

    const summary = buildSummary(reason);
    WIN.__HHA_LAST_SUMMARY = summary;

    try{ cfg.ai?.onEnd?.(summary); }catch(_){}
    dispatchEndOnce(summary);
  }

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

    tLeft = Math.max(0, tLeft - dt);

    spawnTick(dt);
    updateTargets();
    setFeverShield(dt);

    // AI tick (prediction only)
    try{ cfg.ai?.onTick?.(dt, { ok, wrong, miss, combo, acc: accPct() }); }catch(_){}

    setHUD();

    if(tLeft<=0){
      showEnd('time');
      return;
    }

    requestAnimationFrame(tick);
  }

  DOC.addEventListener('visibilitychange', ()=>{
    if(DOC.hidden && playing){
      showEnd('background');
    }
  });

  WIN[END_SENT_KEY]=0;
  setCoach(`ภารกิจ: หา “${targetGroup.short}” 🎯`);
  setHUD();
  requestAnimationFrame(tick);
}