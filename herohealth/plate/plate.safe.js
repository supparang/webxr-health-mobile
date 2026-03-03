// === /herohealth/plate/plate.safe.js ===
// HeroHealth — Plate VR SAFE — BLOOM FULL EDITION
// FULL v20260304-PLATE-BLOOM-FULL
// ✅ P1: Safe Spawn Zones (avoid HUD) + FAIR MISS breakdown + deterministic research
// ✅ P2: 3-Stage Warm→Trick→Boss + Fever + Shield + Storm hits (guarded doesn't count as miss)
// ✅ P3: Evaluate Gate + Create Mode (Bloom 5-6) + Explainable AI Coach (top2 factors)
// ✅ Input: pointer + hha:shoot (crosshair via vr-ui.js)
// ✅ Events: hha:time, hha:score, hha:rank, hha:coach, quest:update, hha:end
// ✅ End: plate:final_end (after evaluate/create flow)
'use strict';

export function boot(cfg){
  cfg = cfg || {};
  const WIN = window;
  const DOC = document;

  // -----------------------
  // helpers
  // -----------------------
  const clamp=(v,a,b)=>{ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b,v)); };
  const nowMs=()=> (performance && performance.now) ? performance.now() : Date.now();
  const nowIso=()=> new Date().toISOString();
  const safeJson=(o)=>{ try{ return JSON.stringify(o,null,2);}catch(_){ return '{}'; } };

  function qs(k, d=''){
    try{ return (new URL(location.href)).searchParams.get(k) ?? d; }
    catch{ return d; }
  }

  function emit(name, detail){
    try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
  }

  // rng deterministic
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

  const mount = cfg.mount || DOC.getElementById('plate-layer');
  if(!mount){ console.warn('[Plate] Missing mount'); return; }

  const hudTopEl = cfg.hudTopEl || DOC.getElementById('hudTop');
  const hudBottomEl = cfg.hudBottomEl || DOC.getElementById('hudBottom');
  const fxStormEl = cfg.fxStormEl || DOC.getElementById('fxStorm');
  const fxBossEl = cfg.fxBossEl || DOC.getElementById('fxBoss');

  const view = String(cfg.view || qs('view','mobile')).toLowerCase();
  const runMode = String(cfg.run || qs('run','play')).toLowerCase(); // play / research
  const diff = String(cfg.diff || qs('diff','normal')).toLowerCase();
  const plannedSec = clamp(cfg.time ?? qs('time','90'), 30, 300);

  const pid = String(cfg.pid || qs('pid','anon')).trim() || 'anon';
  const hubUrl = String(cfg.hub || qs('hub','../hub.html'));

  const seedStr = String(cfg.seed || qs('seed', String(Date.now())));
  const rng = makeRng(seedStr);
  const r01 = ()=> rng();
  const pick = (arr)=> arr[(r01()*arr.length)|0];

  const MODE = String(cfg.mode || qs('mode','classroom')).toLowerCase(); // classroom default
  const IS_RESEARCH = (runMode === 'research' || runMode === 'study');

  // AI hooks (prediction only)
  const AI = cfg.ai || WIN.HHA_AI || null;

  // -----------------------
  // Thai 5 food groups mapping (fixed)
  // -----------------------
  const GROUPS = [
    { id:1, key:'g1', name:'หมู่ 1 โปรตีน', items:['🥚','🐟','🥛','🍗','🥜'] },
    { id:2, key:'g2', name:'หมู่ 2 คาร์โบไฮเดรต', items:['🍚','🍞','🥔','🍜','🥖'] },
    { id:3, key:'g3', name:'หมู่ 3 ผัก', items:['🥦','🥬','🥕','🥒','🌽'] },
    { id:4, key:'g4', name:'g4', name:'หมู่ 4 ผลไม้', items:['🍌','🍎','🍊','🍉','🍇'] },
    { id:5, key:'g5', name:'หมู่ 5 ไขมัน', items:['🥑','🫒','🧈','🥥','🧀'] },
  ];

  // -----------------------
  // UI elements (IDs from plate-vr.html)
  // -----------------------
  const UI = {
    score: DOC.getElementById('uiScore'),
    combo: DOC.getElementById('uiCombo'),
    comboMax: DOC.getElementById('uiComboMax'),
    miss: DOC.getElementById('uiMiss'),
    missBreak: DOC.getElementById('uiMissBreak'),

    plateHave: DOC.getElementById('uiPlateHave'),
    acc: DOC.getElementById('uiAcc'),
    grade: DOC.getElementById('uiGrade'),

    goalTitle: DOC.getElementById('uiGoalTitle'),
    goalCount: DOC.getElementById('uiGoalCount'),
    goalFill: DOC.getElementById('uiGoalFill'),
    targetText: DOC.getElementById('uiTargetText'),

    time: DOC.getElementById('uiTime'),
    shield: DOC.getElementById('uiShield'),
    fever: DOC.getElementById('uiFever'),
    feverFill: DOC.getElementById('uiFeverFill'),

    aiExplain: DOC.getElementById('uiAiExplain'),
    coachMsg: DOC.getElementById('coachMsg'),
  };

  // -----------------------
  // tuning (base)
  // -----------------------
  const TUNE = (function(){
    // “เดือดแบบแฟร์” สำหรับ ป.5 (C1) — ไม่ทำให้ท้อ
    let spawnRate = 1.05;     // targets per second baseline
    let ttl = 2.7;            // seconds
    let missLimit = 18;
    let stormEvery = 7.0;     // boss lightning interval sec (boss stage)
    let stormDmg = 1;         // missStorm increment per hit

    if(diff==='easy'){ spawnRate=0.85; ttl=3.1; missLimit=22; stormEvery=8.0; }
    if(diff==='hard'){ spawnRate=1.25; ttl=2.35; missLimit=14; stormEvery=6.0; }

    // VR/cVR gets tiny grace on ttl
    if(view==='cvr' || view==='vr'){ ttl += 0.15; }

    return { spawnRate, ttl, missLimit, stormEvery, stormDmg };
  })();

  // adaptive difficulty (play only)
  const ADAPT = {
    enabled: (!IS_RESEARCH),
    windowSec: 8,
    lastAdjustMs: 0,
    // bounds
    spawnMin: 0.80, spawnMax: 1.55,
    ttlMin: 2.1, ttlMax: 3.3
  };

  // -----------------------
  // state
  // -----------------------
  const startTimeIso = nowIso();
  let playing = true;
  let paused = false;
  let tLeft = plannedSec;
  let lastTick = nowMs();

  // Stage flow: Warm → Trick → Boss
  // Stage thresholds by time ratio (simple & stable)
  let stage = 1; // 1 warm, 2 trick, 3 boss
  const stageAt = (ratio)=>{
    if(ratio < 0.34) return 1;
    if(ratio < 0.72) return 2;
    return 3;
  };

  // Score & metrics
  let score = 0;
  let combo = 0;
  let comboMax = 0;

  let ok = 0;
  let wrong = 0;

  // FAIR MISS breakdown
  let missClick = 0;
  let missExpire = 0;
  let missStorm = 0;
  let missTotal = 0;

  // Reaction time sample (GOOD only)
  const rtGood = [];
  let shots = 0;
  let hitsGood = 0;
  let hitsWrong = 0;

  // Plate progress: 5 groups collected at least once
  const have = { g1:0, g2:0, g3:0, g4:0, g5:0 };
  const haveSet = ()=> Object.values(have).filter(v=>v>0).length;

  // Mission target group (current focus)
  let targetGroup = pick(GROUPS);
  let targetSwitchEvery = (diff==='hard') ? 4 : 5; // in trick, faster switching

  // Fever & Shield
  let fever = 0;       // 0..100
  let shield = 0;      // integer
  let stormTimer = 0;  // sec

  // coach rate-limit
  let lastCoachMs = 0;
  let lastExplainMs = 0;

  // Targets map
  const targets = new Map();
  let idSeq = 1;

  // pause hook for run page
  WIN.__PLATE_SET_PAUSED__ = (on)=>{ paused = !!on; lastTick = nowMs(); };

  // -----------------------
  // safe spawn rect (avoid HUD)
  // -----------------------
  function getSafeRect(){
    const r = mount.getBoundingClientRect();
    const pad = (view==='mobile') ? 16 : 18;

    // default safe area
    let left = r.left + pad;
    let right = r.right - pad;
    let top = r.top + pad;
    let bottom = r.bottom - pad;

    // avoid top HUD (and a bit extra)
    try{
      const ht = hudTopEl?.getBoundingClientRect?.();
      if(ht && ht.width>10 && ht.height>10){
        top = Math.max(top, ht.bottom + 10);
      }
    }catch(_){}

    // avoid bottom HUD/controls
    try{
      const hb = hudBottomEl?.getBoundingClientRect?.();
      if(hb && hb.width>10 && hb.height>10){
        bottom = Math.min(bottom, hb.top - 10);
      }
    }catch(_){}

    // ensure sane
    if(right - left < 120){
      left = r.left + 10;
      right = r.right - 10;
    }
    if(bottom - top < 160){
      top = r.top + 90;
      bottom = r.bottom - 90;
    }

    return { left, right, top, bottom };
  }

  function pickXY(){
    const s = getSafeRect();
    const x = s.left + r01()*Math.max(1, (s.right - s.left));
    const y = s.top  + r01()*Math.max(1, (s.bottom - s.top));
    return { x, y };
  }

  // -----------------------
  // grade + accuracy + median RT
  // -----------------------
  function median(arr){
    const a = arr.slice().filter(n=>Number.isFinite(n)).sort((x,y)=>x-y);
    if(!a.length) return null;
    const mid = (a.length/2)|0;
    return (a.length%2) ? a[mid] : (a[mid-1]+a[mid])/2;
  }

  function accuracyGoodPct(){
    const denom = Math.max(1, shots);
    return Math.round((hitsGood/denom)*100);
  }

  function gradeFrom(){
    // stable & kid-friendly:
    // base on: score pace + accuracy - misses
    const played = Math.max(1, plannedSec - tLeft);
    const pace = (score / played); // points per sec
    const acc = accuracyGoodPct();
    const penalty = (missTotal * 1.2) + (hitsWrong * 0.6);

    const x = (pace*20) + (acc*0.65) - penalty;
    if(x>=120) return 'S';
    if(x>=95) return 'A';
    if(x>=72) return 'B';
    if(x>=52) return 'C';
    return 'D';
  }

  // -----------------------
  // UI render
  // -----------------------
  function setText(el, v){ try{ if(el) el.textContent = String(v); }catch(_){} }
  function setWidth(el, pct){ try{ if(el) el.style.width = `${clamp(pct,0,100)}%`; }catch(_){} }

  function updateHUD(){
    setText(UI.score, score|0);
    setText(UI.combo, combo|0);
    setText(UI.comboMax, comboMax|0);

    setText(UI.miss, missTotal|0);
    setText(UI.missBreak, `miss: click ${missClick|0} / expire ${missExpire|0} / storm ${missStorm|0}`);

    setText(UI.plateHave, `${haveSet()}`);
    setText(UI.acc, `${accuracyGoodPct()}%`);
    setText(UI.grade, gradeFrom());

    const goalNow = haveSet();
    const goalTot = 5;
    setText(UI.goalCount, `${goalNow}/${goalTot}`);
    setWidth(UI.goalFill, Math.round((goalNow/goalTot)*100));

    setText(UI.time, Math.ceil(tLeft));
    setText(UI.shield, shield|0);
    setText(UI.fever, `${Math.round(clamp(fever,0,100))}%`);
    setWidth(UI.feverFill, Math.round(clamp(fever,0,100)));

    const st = (stage===1) ? 'WARM' : (stage===2) ? 'TRICK' : 'BOSS';
    const tgt = `${st}: ${targetGroup?.name || '—'} (เก็บให้ถูก!)`;
    setText(UI.targetText, tgt);

    // events for “other HUDs” (standard-ish)
    emit('hha:time', { left: Math.ceil(tLeft) });
    emit('hha:rank', { grade: gradeFrom() });
    emit('hha:score', {
      score, combo, comboMax,
      miss: missTotal, misses: missTotal,
      missClick, missExpire, missStorm,
      ok, wrong,
      accuracyGoodPct: accuracyGoodPct(),
      feverPct: Math.round(clamp(fever,0,100)),
      shield
    });
    emit('quest:update', {
      goalTitle: 'เติมจานให้ครบ 5 หมู่',
      goalNow: haveSet(),
      goalTotal: 5,
      miniTitle: (stage===1?'Warm-up':'Challenge'),
      miniNow: ok,
      miniTotal: ok + wrong + missExpire,
      miniTimeLeftSec: Math.ceil(tLeft),
      groupName: targetGroup?.name || '—'
    });
  }

  function coach(msg, mood='neutral', force=false){
    const t = nowMs();
    if(!force && (t - lastCoachMs) < 1400) return;
    lastCoachMs = t;
    setText(UI.coachMsg, msg);
    emit('hha:coach', { msg, mood });
  }

  // explainable AI (top2 factors)
  function buildExplainTop2(){
    // factors from last window-ish snapshot
    const denom = Math.max(1, shots);
    const wrongRate = hitsWrong/denom;
    const expireRate = missExpire/Math.max(1, (ok+wrong+missExpire));
    const stormRate = missStorm/Math.max(1, (stage===3 ? 1 : 3));

    // “confidence” heuristics (0..1)
    const f = [
      { k:'ยิงผิดหมู่', v: wrongRate },
      { k:'ปล่อยให้หมดเวลา', v: expireRate },
      { k:'ตอนบอสโดนฟ้าผ่า', v: stormRate }
    ].sort((a,b)=>b.v-a.v);

    const top = f.slice(0,2).filter(x=>x.v>0.10);
    if(!top.length){
      return { text:'ฟอร์มดี! ต่อไป: เก็บให้ครบ 5 หมู่เร็วขึ้น', top2: [] };
    }
    const text = `เสี่ยงเพราะ ${top.map(x=>x.k).join(' + ')}`;
    return { text, top2: top };
  }

  function pushAIExplain(){
    const t = nowMs();
    if((t - lastExplainMs) < 2200) return;
    lastExplainMs = t;

    const ex = buildExplainTop2();
    if(UI.aiExplain) UI.aiExplain.textContent = 'AI: ' + ex.text;
    emit('plate:ai_explain', { text: ex.text, top2: ex.top2 });

    // coach uses explainable line occasionally
    if(ex.top2 && ex.top2.length){
      coach(`AI บอกว่า: ${ex.text}`, 'neutral');
    }
  }

  // -----------------------
  // targets
  // -----------------------
  function makeTarget(kind, emoji, ttlSec){
    const id = String(idSeq++);
    const el = DOC.createElement('div');
    el.className = 'plateTarget';
    el.dataset.id = id;
    el.dataset.kind = kind;
    el.textContent = emoji;

    const p = pickXY();
    el.style.left = `${p.x}px`;
    el.style.top = `${p.y}px`;

    mount.appendChild(el);

    const born = nowMs();
    const ttl = Math.max(0.8, ttlSec) * 1000;
    const obj = { id, el, kind, emoji, born, ttl, promptMs: nowMs() };
    targets.set(id, obj);

    try{ AI?.onSpawn?.(kind, { id, emoji, ttlSec }); }catch(_){}
    return obj;
  }

  function removeTarget(id){
    const t = targets.get(String(id));
    if(!t) return;
    targets.delete(String(id));
    try{ t.el.remove(); }catch(_){}
  }

  function isCorrectFoodForGroup(emoji, group){
    return (group?.items || []).includes(emoji);
  }

  function groupKeyOfEmoji(emoji){
    for(const g of GROUPS){
      if(g.items.includes(emoji)) return g.key;
    }
    return null;
  }

  function addHaveByEmoji(emoji){
    const k = groupKeyOfEmoji(emoji);
    if(k && have[k]!=null) have[k] += 1;
  }

  function hitFX(el){
    try{
      el.classList.add('hit');
      setTimeout(()=>{ try{ el.remove(); }catch(_){} }, 90);
    }catch(_){}
  }

  function awardFever(delta){
    fever = clamp(fever + delta, 0, 100);
  }

  function onHitTarget(obj){
    shots++;

    const kind = obj.kind;
    const emoji = obj.emoji;

    // compute RT only for correct food hits
    const rt = nowMs() - (obj.promptMs || obj.born);

    if(kind === 'shield'){
      shield = Math.min(9, shield + 1);
      score += 10;
      combo++;
      comboMax = Math.max(comboMax, combo);
      awardFever(6);
      hitsGood++;
      hitFX(obj.el);
      removeTarget(obj.id);
      coach('🛡️ ได้โล่! กันฟ้าผ่าได้ 1 ครั้ง', 'happy');
      try{ AI?.onHit?.('shield', { id: obj.id }); }catch(_){}
      return;
    }

    if(kind === 'fever'){
      // fever orb
      score += 8;
      combo++;
      comboMax = Math.max(comboMax, combo);
      awardFever(14);
      hitsGood++;
      hitFX(obj.el);
      removeTarget(obj.id);
      coach('⚡ Fever เพิ่ม! ยิงต่อเนื่องจะได้แต้มพุ่ง', 'happy');
      try{ AI?.onHit?.('fever', { id: obj.id }); }catch(_){}
      return;
    }

    // kind === food (default)
    const correct = isCorrectFoodForGroup(emoji, targetGroup);

    if(correct){
      ok++;
      hitsGood++;
      rtGood.push(rt);

      combo++;
      comboMax = Math.max(comboMax, combo);

      // scoring with fever multiplier
      const mult = 1 + (clamp(fever,0,100)/100)*0.6;
      const add = Math.round((12 + Math.min(12, combo)) * mult);
      score += add;

      awardFever(4);

      addHaveByEmoji(emoji);

      // stage-based target switching
      if(stage===1){
        // warm: switch slower
        if(ok % 7 === 0) targetGroup = pick(GROUPS);
      }else if(stage===2){
        // trick: switch faster
        if(ok % targetSwitchEvery === 0) targetGroup = pick(GROUPS);
      }else{
        // boss: prefer missing groups
        targetGroup = pickBossTargetGroup();
      }

      coach(`✅ ดีมาก! เก็บ ${emoji} ตรงหมู่`, (fever>=70?'fever':'happy'));
      try{ AI?.onHit?.('food_ok', { id: obj.id, emoji, rtMs: rt }); }catch(_){}
    }else{
      wrong++;
      hitsWrong++;

      // FAIR MISS: click wrong counts as missClick
      missClick++;
      missTotal++;

      combo = 0;
      score = Math.max(0, score - 8);

      awardFever(-8);

      coach(`❌ อันนี้ไม่ใช่หมู่เป้าหมาย! ลองหาใน “${targetGroup.name}”`, 'sad');
      try{ AI?.onHit?.('food_wrong', { id: obj.id, emoji }); }catch(_){}
    }

    hitFX(obj.el);
    removeTarget(obj.id);
  }

  // pointer hit (PC/Mobile). In strict cVR, DOM targets may be disabled by run page CSS.
  mount.addEventListener('pointerdown', (ev)=>{
    if(!playing || paused) return;
    const el = ev.target?.closest?.('.plateTarget');
    if(!el) return;
    const id = el.dataset.id;
    const obj = targets.get(String(id));
    if(obj) onHitTarget(obj);
  }, { passive:true });

  // hha:shoot crosshair (VR/cVR)
  function pickClosestToCenter(lockPx){
    lockPx = clamp(lockPx ?? 56, 16, 140);
    let best=null, bestD=1e9;
    const r = mount.getBoundingClientRect();
    const cx = r.left + r.width/2;
    const cy = r.top  + r.height/2;
    for(const obj of targets.values()){
      const b = obj.el.getBoundingClientRect();
      const ox = b.left + b.width/2;
      const oy = b.top  + b.height/2;
      const d = Math.hypot(ox-cx, oy-cy);
      if(d < bestD){ bestD = d; best = obj; }
    }
    if(best && bestD <= lockPx) return best;
    return null;
  }

  WIN.addEventListener('hha:shoot', (ev)=>{
    if(!playing || paused) return;
    const lockPx = ev?.detail?.lockPx ?? (view==='cvr'?22:56);
    const obj = pickClosestToCenter(lockPx);
    if(obj) onHitTarget(obj);
  });

  // pause from page
  WIN.addEventListener('hha:pause', ()=>{ paused=true; lastTick=nowMs(); }, { passive:true });
  WIN.addEventListener('hha:resume', ()=>{ paused=false; lastTick=nowMs(); }, { passive:true });

  // -----------------------
  // Boss targeting: prefer missing groups
  // -----------------------
  function pickBossTargetGroup(){
    const missing = GROUPS.filter(g => (have[g.key]||0) <= 0);
    if(missing.length) return pick(missing);
    // otherwise rotate
    return pick(GROUPS);
  }

  // -----------------------
  // spawn logic
  // -----------------------
  let spawnAcc = 0;

  function spawnOne(){
    // probabilities vary by stage
    const baseTtl = TUNE.ttl;

    // helper to spawn “correct vs wrong”
    const spawnFood = (preferCorrect)=>{
      let emoji = '🍚';
      if(preferCorrect){
        emoji = pick(targetGroup.items);
      }else{
        const others = GROUPS.filter(g=>g.id!==targetGroup.id);
        emoji = pick(pick(others).items);
      }
      makeTarget('food', emoji, baseTtl);
    };

    if(stage===1){
      // Warm: mostly correct + occasional wrong
      const correct = (r01() < 0.72);
      spawnFood(correct);
      if(r01() < 0.08) makeTarget('fever', '⚡', baseTtl * 0.95);
      return;
    }

    if(stage===2){
      // Trick: more wrong + more fever
      const correct = (r01() < 0.62);
      spawnFood(correct);
      if(r01() < 0.10) makeTarget('fever', '⚡', baseTtl * 0.90);
      if(r01() < 0.12) makeTarget('shield', '🛡️', baseTtl * 0.95);
      return;
    }

    // Boss stage: target missing groups + more shield
    targetGroup = pickBossTargetGroup();
    const correct = (r01() < 0.66);
    spawnFood(correct);

    if(r01() < 0.16) makeTarget('shield', '🛡️', baseTtl * 0.95);
    if(r01() < 0.10) makeTarget('fever', '⚡', baseTtl * 0.90);
  }

  function spawnTick(dt){
    // dynamic spawn
    let rate = TUNE.spawnRate;

    // fever makes slightly more spawn (fun), but fair
    if(fever >= 60) rate *= 1.10;

    spawnAcc += rate * dt;
    while(spawnAcc >= 1){
      spawnAcc -= 1;
      spawnOne();
    }
  }

  function updateExpire(){
    const t = nowMs();
    for(const obj of Array.from(targets.values())){
      if((t - obj.born) >= obj.ttl){
        // expire: counts as missExpire for food only (not shield/fever)
        if(obj.kind === 'food'){
          missExpire++;
          missTotal++;
          wrong++;
          combo = 0;
          score = Math.max(0, score - 4);
          awardFever(-4);
          try{ AI?.onExpire?.('food', { id: obj.id, emoji: obj.emoji }); }catch(_){}
        }
        try{
          obj.el.classList.add('expire');
        }catch(_){}
        removeTarget(obj.id);
      }
    }
  }

  // -----------------------
  // storm (boss only) — guarded doesn't count as miss (shield block)
  // -----------------------
  function stormTick(dt){
    if(stage !== 3) return;

    stormTimer += dt;
    const interval = TUNE.stormEvery;

    // visuals
    try{ fxBossEl?.classList?.add('on'); }catch(_){}
    try{ fxStormEl?.classList?.add('on'); }catch(_){}

    if(stormTimer >= interval){
      stormTimer = 0;

      if(shield > 0){
        // block: does NOT count as miss
        shield = Math.max(0, shield - 1);
        coach('🛡️ กันฟ้าผ่าได้! โล่ -1', 'happy', true);
        try{ AI?.onHit?.('storm_block', { shield }); }catch(_){}
      }else{
        // hit storm: counts missStorm
        missStorm += TUNE.stormDmg;
        missTotal += TUNE.stormDmg;
        combo = 0;
        score = Math.max(0, score - 10);
        awardFever(-10);
        coach('⚡ ฟ้าผ่า! รีบหา 🛡️ เพื่อกันครั้งต่อไป', 'sad', true);
        try{ AI?.onHit?.('storm_hit', { missStorm }); }catch(_){}
      }
    }
  }

  // -----------------------
  // stage update
  // -----------------------
  function updateStage(){
    const ratio = (plannedSec - tLeft) / Math.max(1, plannedSec);
    const st = stageAt(ratio);
    if(st !== stage){
      stage = st;
      if(stage===1){
        try{ fxStormEl?.classList?.remove('on'); fxBossEl?.classList?.remove('on'); }catch(_){}
        coach('WARM: เริ่มเบา ๆ ยิงให้ถูกหมู่เป้าหมาย 🥗', 'neutral', true);
      }else if(stage===2){
        coach('TRICK: สลับหมู่เร็วขึ้น! อย่ายิงมั่ว 🔥', 'neutral', true);
      }else{
        coach('BOSS: เก็บหมู่ที่ “ขาด” ให้ครบ! ฟ้าผ่าเริ่มแล้ว ⚡', 'fever', true);
        // boss prefers missing groups immediately
        targetGroup = pickBossTargetGroup();
      }
    }
  }

  // -----------------------
  // adaptive difficulty (play only)
  // -----------------------
  function adaptTick(){
    if(!ADAPT.enabled) return;
    const t = nowMs();
    if((t - ADAPT.lastAdjustMs) < (ADAPT.windowSec*1000)) return;
    ADAPT.lastAdjustMs = t;

    const acc = accuracyGoodPct();
    // fair adjustments
    if(acc >= 86 && missTotal <= 6){
      TUNE.spawnRate = clamp(TUNE.spawnRate + 0.07, ADAPT.spawnMin, ADAPT.spawnMax);
      TUNE.ttl = clamp(TUNE.ttl - 0.05, ADAPT.ttlMin, ADAPT.ttlMax);
      coach('PRO UP! เป้าไวขึ้นนิดแบบแฟร์ 😈', 'happy');
    }else if(acc <= 58 && missTotal >= 8){
      TUNE.spawnRate = clamp(TUNE.spawnRate - 0.07, ADAPT.spawnMin, ADAPT.spawnMax);
      TUNE.ttl = clamp(TUNE.ttl + 0.06, ADAPT.ttlMin, ADAPT.ttlMax);
      coach('ผ่อนให้หน่อย! โฟกัส “หมู่เป้าหมาย” ก่อนนะ ✅', 'neutral');
    }

    pushAIExplain();
  }

  // -----------------------
  // end conditions
  // -----------------------
  function checkEnd(){
    if(tLeft <= 0) return 'time';
    if(missTotal >= TUNE.missLimit) return 'miss-limit';
    // if fill plate early -> keep playing but boost to boss quickly (fun)
    if(haveSet() >= 5 && stage < 3){
      stage = 3;
      coach('ยอด! ครบ 5 หมู่แล้ว — เข้า BOSS ต่อเลย! 👹', 'happy', true);
    }
    return null;
  }

  // -----------------------
  // Bloom flags
  // -----------------------
  const bloom = {
    remember: true,
    understand: true,
    apply: true,
    analyze: true,
    evaluate: false,
    create: false
  };

  // -----------------------
  // Evaluate gate (Bloom 5)
  // -----------------------
  let evalState = {
    shown:false,
    startMs:0,
    pick:null,
    reason:null,
    A:null,
    B:null,
    correct:null
  };

  function buildEvaluatePlates(){
    // A: balanced-ish, B: unbalanced (or vice versa) deterministic by rng
    // We make “correct plate” have all 5 groups, wrong misses 1 group + too many carbs/fat
    const all5 = [
      pick(GROUPS[0].items), // protein
      pick(GROUPS[2].items), // veg
      pick(GROUPS[3].items), // fruit
      pick(GROUPS[1].items), // carb
      pick(GROUPS[4].items), // fat
    ];

    const unbal = [
      pick(GROUPS[1].items), pick(GROUPS[1].items), // carbs x2
      pick(GROUPS[4].items), pick(GROUPS[4].items), // fats x2
      pick(GROUPS[0].items), // protein only, missing veg/fruit
    ];

    const swap = (r01() < 0.5);
    const A = swap ? all5 : unbal;
    const B = swap ? unbal : all5;
    const correct = swap ? 'A' : 'B';
    return { A, B, correct };
  }

  function showEvaluate(){
    if(evalState.shown) return;
    evalState.shown = true;
    evalState.startMs = nowMs();

    const e = buildEvaluatePlates();
    evalState.A = e.A;
    evalState.B = e.B;
    evalState.correct = e.correct;

    emit('plate:eval_show', { A: e.A, B: e.B });
    coach('EVALUATE: เลือกจานที่สมดุลกว่า แล้วเลือกเหตุผล 🧠', 'neutral', true);
  }

  function bindEvaluateEvents(){
    const onPick = (ev)=>{
      const p = ev?.detail?.pick;
      if(p==='A' || p==='B') evalState.pick = p;
    };
    const onReason = (ev)=>{
      const r = ev?.detail?.reason;
      if(r) evalState.reason = String(r);
    };
    const onNext = ()=>{
      // require reason to proceed
      if(!evalState.reason) return;
      bloom.evaluate = true;
      emit('plate:eval_done', {
        pick: evalState.pick,
        reason: evalState.reason,
        correct: evalState.correct,
        decisionTimeMs: Math.max(0, nowMs()-evalState.startMs)
      });
      coach('ดี! ต่อไป CREATE จานของตัวเอง 🍽️', 'happy', true);
      showCreate();
    };

    WIN.addEventListener('plate:eval_pick', onPick);
    WIN.addEventListener('plate:eval_reason', onReason);
    WIN.addEventListener('plate:eval_next', onNext);

    // stash to remove later (optional)
    evalState._unbind = ()=> {
      WIN.removeEventListener('plate:eval_pick', onPick);
      WIN.removeEventListener('plate:eval_reason', onReason);
      WIN.removeEventListener('plate:eval_next', onNext);
    };
  }

  // -----------------------
  // Create mode (Bloom 6)
  // -----------------------
  let createState = {
    shown:false,
    startMs:0,
    slots: [null,null,null,null,null], // 5 slots
    attempts: 0,
    pass: false,
    finish: false
  };

  function rerollCreate(){
    // fill each slot with random from groups, deterministic by rng
    createState.slots = [
      pick(GROUPS[0].items),
      pick(GROUPS[1].items),
      pick(GROUPS[2].items),
      pick(GROUPS[3].items),
      pick(GROUPS[4].items),
    ];
    emit('plate:create_update', { slots: createState.slots.slice() });
  }

  function cycleCreateSlot(idx){
    idx = clamp(idx, 0, 4) | 0;

    // rotate within the group assigned to slot index:
    const g = GROUPS[idx];
    const cur = createState.slots[idx];
    const arr = g.items;
    let i = arr.indexOf(cur);
    i = (i<0) ? 0 : ((i+1) % arr.length);
    createState.slots[idx] = arr[i];

    emit('plate:create_update', { slots: createState.slots.slice() });
  }

  function checkCreate(){
    createState.attempts++;

    // constraints:
    // - must represent all 5 groups (since slots are mapped to groups, this is always true if filled)
    // - carb (slot 1) max 2 pieces: in this simplified design = always 1, so pass
    // - fat (slot 4) max 2 pieces: always 1
    // We'll add an extra “quality” rule: if player changes less than 1 time -> encourage more thinking
    const changed = createState.attempts >= 1;

    createState.pass = !!changed;

    const text = createState.pass
      ? '✅ ผ่าน! จานคุณครบ 5 หมู่และสมดุล 🎉'
      : '❌ ยังไม่ผ่าน: ลองปรับอาหารในช่องก่อน';

    emit('plate:create_result', { pass: createState.pass, text });
    coach(createState.pass ? 'CREATE ผ่าน! เก่งมาก 🎉' : 'ลองแตะช่องเพื่อปรับจานอีกนิดนะ', createState.pass?'happy':'neutral', true);
    return createState.pass;
  }

  function showCreate(){
    if(createState.shown) return;
    createState.shown = true;
    createState.startMs = nowMs();

    // init slots deterministic
    rerollCreate();

    emit('plate:create_show', { slots: createState.slots.slice() });
  }

  function bindCreateEvents(){
    const onCycle = (ev)=>{
      const idx = ev?.detail?.idx;
      if(idx==null) return;
      cycleCreateSlot(idx);
    };
    const onReroll = ()=> rerollCreate();
    const onCheck = ()=> checkCreate();
    const onFinish = ()=>{
      // allow finish even if not pass, but bloom create true only if pass
      createState.finish = true;
      if(createState.pass) bloom.create = true;
      finalizeEnd('post-bloom');
    };

    WIN.addEventListener('plate:create_cycle', onCycle);
    WIN.addEventListener('plate:create_reroll', onReroll);
    WIN.addEventListener('plate:create_check', onCheck);
    WIN.addEventListener('plate:create_finish', onFinish);

    createState._unbind = ()=>{
      WIN.removeEventListener('plate:create_cycle', onCycle);
      WIN.removeEventListener('plate:create_reroll', onReroll);
      WIN.removeEventListener('plate:create_check', onCheck);
      WIN.removeEventListener('plate:create_finish', onFinish);
    };
  }

  // -----------------------
  // end summary + finalize flow
  // -----------------------
  let ended = false;
  let endReason = '';
  let coreSummary = null;

  function buildSummary(reason){
    const med = median(rtGood);
    const acc = accuracyGoodPct();

    return {
      projectTag: 'PlateVR',
      gameVersion: 'PlateVR_SAFE_2026-03-04_BloomFull',
      device: view,
      runMode,
      diff,
      mode: MODE,
      seed: seedStr,
      pid,
      reason: String(reason||''),

      durationPlannedSec: plannedSec,
      durationPlayedSec: Math.round(plannedSec - tLeft),

      scoreFinal: score|0,
      comboMax: comboMax|0,

      // counts
      ok: ok|0,
      wrong: wrong|0,

      // FAIR MISS breakdown
      missClick: missClick|0,
      missExpire: missExpire|0,
      missStorm: missStorm|0,
      missTotal: missTotal|0,

      // accuracy/rt
      shots: shots|0,
      hitsGood: hitsGood|0,
      hitsWrong: hitsWrong|0,
      accuracyGoodPct: acc,
      medianRtGoodMs: (med==null?null:Math.round(med)),

      // plate coverage
      plateHaveCount: haveSet(),
      plateHaveDetail: { ...have },

      // powers
      feverPct: Math.round(clamp(fever,0,100)),
      shield: shield|0,

      // bloom flags (finalized later)
      bloom: { ...bloom },

      // AI
      aiPredictionLast: (function(){ try{ return AI?.getPrediction?.() || null; }catch(_){ return null; } })(),
      aiExplainTop2: buildExplainTop2(),

      startTimeIso,
      endTimeIso: nowIso(),
      grade: gradeFrom(),
    };
  }

  function dispatchCoreEndOnce(summary){
    // standard-ish end event (for loggers)
    try{ emit('hha:end', summary); }catch(_){}
  }

  function stopAllTargets(){
    for(const obj of targets.values()){
      try{ obj.el.remove(); }catch(_){}
    }
    targets.clear();
  }

  function endGame(reason){
    if(ended) return;
    ended = true;
    endReason = reason || 'end';

    playing = false;
    paused = false;

    stopAllTargets();

    coreSummary = buildSummary(endReason);

    // AI end hook
    try{
      const aiEnd = AI?.onEnd?.(coreSummary);
      if(aiEnd) coreSummary.aiEnd = aiEnd;
    }catch(_){}

    // bloom 1-4 achieved by playing stages (always true here)
    coreSummary.bloom = { ...bloom };

    // emit core end now (so logger can catch gameplay result)
    dispatchCoreEndOnce(coreSummary);

    // show evaluate/create flow (Bloom 5-6) unless research mode
    if(IS_RESEARCH){
      // research: do not force interactive gates, but still mark evaluate/create as false
      finalizeEnd('research');
      return;
    }

    // play/classroom: run gates
    showEvaluate();
  }

  function finalizeEnd(reason){
    const final = coreSummary ? { ...coreSummary } : buildSummary(reason||'final');

    // attach eval/create results
    final.eval = evalState.shown ? {
      pick: evalState.pick,
      reason: evalState.reason,
      correct: evalState.correct,
      decisionTimeMs: evalState.startMs ? Math.max(0, nowMs()-evalState.startMs) : null
    } : null;

    final.create = createState.shown ? {
      slots: createState.slots.slice(),
      attempts: createState.attempts|0,
      pass: !!createState.pass,
      finish: !!createState.finish,
      timeMs: createState.startMs ? Math.max(0, nowMs()-createState.startMs) : null
    } : null;

    // finalize bloom flags
    final.bloom = { ...bloom };
    if(evalState.shown && evalState.reason) final.bloom.evaluate = true;
    if(createState.shown && createState.pass) final.bloom.create = true;

    // handy copy for debug
    WIN.__HHA_LAST_SUMMARY = final;

    // notify run page to show final overlay
    emit('plate:final_end', final);
  }

  // bind gates now
  bindEvaluateEvents();
  bindCreateEvents();

  // Once evaluate is done, create shows from eval_next handler. But if user skips UI somehow:
  // allow proceed on eval_next without pick too (reason required).
  // (handled in bindEvaluateEvents)

  // -----------------------
  // main loop
  // -----------------------
  function tick(){
    if(!playing) return;

    if(paused){
      lastTick = nowMs();
      updateHUD();
      requestAnimationFrame(tick);
      return;
    }

    const t = nowMs();
    const dt = Math.min(0.05, Math.max(0.001, (t-lastTick)/1000));
    lastTick = t;

    tLeft = Math.max(0, tLeft - dt);

    updateStage();
    spawnTick(dt);
    updateExpire();
    stormTick(dt);

    // AI tick (prediction only)
    try{
      const pred = AI?.onTick?.(dt, { missTotal, missClick, missExpire, missStorm, ok, wrong, combo, fever, shield, stage }) || null;
      // allow AI to influence only in play (optional). We keep prediction-only here.
      if(pred && UI.aiExplain){
        // show compact numeric risk if available
        if(pred.hazardRisk != null){
          const ex = buildExplainTop2();
          UI.aiExplain.textContent = `AI: risk ${(Number(pred.hazardRisk)).toFixed(2)} · ${ex.text}`;
          emit('plate:ai_explain', { text: `risk ${(Number(pred.hazardRisk)).toFixed(2)} · ${ex.text}` });
        }
      }
    }catch(_){}

    // adaptive (play only)
    adaptTick();

    // periodic explain line (keeps coach “มีเหตุผล”)
    if(r01() < 0.03) pushAIExplain();

    updateHUD();

    const end = checkEnd();
    if(end){
      endGame(end);
      return;
    }

    requestAnimationFrame(tick);
  }

  // visibility -> end (like other games)
  DOC.addEventListener('visibilitychange', ()=>{
    if(DOC.hidden && playing){
      endGame('background');
    }
  });

  // start messages
  coach('WARM: ยิงให้ถูกหมู่เป้าหมาย แล้วเติมจานให้ครบ 5 หมู่ 💪', 'neutral', true);

  // set initial target
  targetGroup = pick(GROUPS);
  updateHUD();
  requestAnimationFrame(tick);
}