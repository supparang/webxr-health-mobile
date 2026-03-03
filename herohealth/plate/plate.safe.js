// === /herohealth/plate/plate.safe.js ===
// PlateVR SAFE — PRODUCTION (Classroom + 3-Stage + Practice + FAIR MISS + HUD-safe spawn + AI Coach reason)
// FULL v20260303e-PLATE-CLASSROOM-3STAGE-FAIRMISS-AICOACH
'use strict';

export function boot(cfg){
  cfg = cfg || {};
  const WIN = window, DOC = document;

  // -----------------------------
  // Helpers
  // -----------------------------
  const qs = (k, d='')=>{ try{ return (new URL(location.href)).searchParams.get(k) ?? d; }catch(_){ return d; } };
  const clamp=(v,a,b)=>{ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b,v)); };
  const nowMs = ()=> (performance && performance.now) ? performance.now() : Date.now();
  const nowIso = ()=> new Date().toISOString();
  const safeJson = (o)=>{ try{ return JSON.stringify(o,null,2);}catch(_){ return '{}';} };

  function emit(name, detail){
    try{ WIN.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); }catch(_){}
  }
  function coach(msg, mood='neutral'){
    emit('hha:coach', { msg: String(msg||''), mood: String(mood||'neutral') });
    // รองรับ groups style ด้วย
    emit('hha:coach', { text: String(msg||''), mood: String(mood||'neutral') });
  }

  // -----------------------------
  // Daily cooldown helpers (per-game)
  // -----------------------------
  function hhDayKey(){
    const d=new Date();
    const yyyy=d.getFullYear();
    const mm=String(d.getMonth()+1).padStart(2,'0');
    const dd=String(d.getDate()).padStart(2,'0');
    return `${yyyy}-${mm}-${dd}`;
  }
  function lsGet(k){ try{ return localStorage.getItem(k); }catch(_){ return null; } }
  function cooldownDone(cat, game, pid){
    const day=hhDayKey();
    pid=String(pid||'anon').trim()||'anon';
    cat=String(cat||'nutrition').toLowerCase();
    game=String(game||'plate').toLowerCase();
    const kNew=`HHA_COOLDOWN_DONE:${cat}:${game}:${pid}:${day}`;
    const kOld=`HHA_COOLDOWN_DONE:${cat}:${pid}:${day}`;
    return (lsGet(kNew)==='1') || (lsGet(kOld)==='1');
  }
  function buildCooldownUrl({ hub, nextAfterCooldown, cat, gameKey, pid }){
    const gate = new URL('../warmup-gate.html', location.href);
    gate.searchParams.set('gatePhase','cooldown');
    gate.searchParams.set('cat', String(cat||'nutrition'));
    gate.searchParams.set('theme', String(gameKey||'plate'));
    gate.searchParams.set('pid', String(pid||'anon'));
    if(hub) gate.searchParams.set('hub', String(hub));
    gate.searchParams.set('next', String(nextAfterCooldown || hub || '../hub.html'));

    const sp = new URL(location.href).searchParams;
    [
      'run','diff','time','seed','studyId','phase','conditionGroup','view','log',
      'planSeq','planDay','planSlot','planMode','planSlots','planIndex','autoNext',
      'plannedGame','finalGame','zone','cdnext','grade','mode','practice'
    ].forEach(k=>{
      const v=sp.get(k);
      if(v!=null && v!=='') gate.searchParams.set(k,v);
    });
    return gate.toString();
  }

  // -----------------------------
  // Deterministic RNG
  // -----------------------------
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

  // -----------------------------
  // Read cfg
  // -----------------------------
  const mount = cfg.mount || DOC.getElementById('plate-layer');
  if(!mount){ console.warn('[Plate] Missing mount #plate-layer'); return; }

  const view = String(cfg.view || qs('view','mobile')).toLowerCase();
  const runModeRaw = String(cfg.run || cfg.runMode || qs('run','play')).toLowerCase();
  const runMode = (runModeRaw === 'research' || runModeRaw === 'study') ? 'research' : (runModeRaw === 'practice' ? 'practice' : 'play');
  const diff = String(cfg.diff || qs('diff','normal')).toLowerCase();
  const plannedSec = clamp(cfg.time ?? qs('time','90'), 20, 300);
  const seedStr = String(cfg.seed ?? qs('seed', String(Date.now())));
  const rng = makeRng(seedStr);
  const r01 = ()=> rng();
  const pick = (arr)=> arr[(r01()*arr.length)|0];

  const pid = String(cfg.pid || qs('pid','anon')).trim()||'anon';
  const hubUrl = String(cfg.hub || qs('hub','../hub.html'));
  const HH_CAT='nutrition';
  const HH_GAME='plate';
  const cooldownRequired = !!cfg.cooldown || (qs('cooldown','0')==='1') || (qs('cd','0')==='1');

  // Classroom policy
  const mode = String(cfg.mode || qs('mode','classroom')).toLowerCase(); // classroom|free
  const isClassroom = (mode === 'classroom');
  const practiceOn = (String(cfg.practice ?? qs('practice','1')) !== '0') && (runMode !== 'research');
  const miniBossOn = isClassroom && (String(cfg.miniBoss ?? qs('miniBoss','1')) !== '0') && (runMode !== 'practice');

  // -----------------------------
  // UI (optional: your HTML ids)
  // -----------------------------
  const ui = {
    score: DOC.getElementById('uiScore'),
    combo: DOC.getElementById('uiCombo'),
    comboMax: DOC.getElementById('uiComboMax'),
    miss: DOC.getElementById('uiMiss'),
    plateHave: DOC.getElementById('uiPlateHave'),
    acc: DOC.getElementById('uiAcc'),
    grade: DOC.getElementById('uiGrade'),
    time: DOC.getElementById('uiTime'),
    shield: DOC.getElementById('uiShield'),
    fever: DOC.getElementById('uiFever'),
    feverFill: DOC.getElementById('uiFeverFill'),
    goalTitle: DOC.getElementById('uiGoalTitle'),
    goalCount: DOC.getElementById('uiGoalCount'),
    goalFill: DOC.getElementById('uiGoalFill'),
    targetText: DOC.getElementById('uiTargetText'),

    // per group counters (ถ้ามี)
    g1: DOC.getElementById('uiG1'),
    g2: DOC.getElementById('uiG2'),
    g3: DOC.getElementById('uiG3'),
    g4: DOC.getElementById('uiG4'),
    g5: DOC.getElementById('uiG5'),

    // end overlay
    end: DOC.getElementById('endOverlay'),
    endTitle: DOC.getElementById('endTitle'),
    endSub: DOC.getElementById('endSub'),
    endGrade: DOC.getElementById('endGrade'),
    endScore: DOC.getElementById('endScore'),
    endOk: DOC.getElementById('endOk'),
    endWrong: DOC.getElementById('endWrong'),
    btnCopy: DOC.getElementById('btnCopy'),
    btnReplay: DOC.getElementById('btnReplay'),
    btnNextCooldown: DOC.getElementById('btnNextCooldown'),
    btnBackHub2: DOC.getElementById('btnBackHub2'),
  };

  // -----------------------------
  // Thai 5 food groups (fixed mapping)
  // -----------------------------
  const GROUPS = [
    { id:1, name:'หมู่ 1 โปรตีน', items:['🥚','🐟','🥛','🍗','🥜'], icon:'🐟' },
    { id:2, name:'หมู่ 2 คาร์โบไฮเดรต', items:['🍚','🍞','🥔','🍜','🥖'], icon:'🍚' },
    { id:3, name:'หมู่ 3 ผัก', items:['🥦','🥬','🥕','🥒','🌽'], icon:'🥦' },
    { id:4, name:'หมู่ 4 ผลไม้', items:['🍌','🍎','🍊','🍉','🍇'], icon:'🍎' },
    { id:5, name:'หมู่ 5 ไขมัน', items:['🥑','🫒','🧈','🥥','🧀'], icon:'🥑' },
  ];
  const groupById = (id)=> GROUPS.find(g=>g.id===id) || GROUPS[0];

  // -----------------------------
  // HUD-safe spawn rect
  // -----------------------------
  function safeRect(){
    const r = mount.getBoundingClientRect();
    const PAD = (view==='mobile') ? 14 : 18;
    // กัน HUD บน/ล่าง (Top HUD สูง ~ 180-220, Bottom controls ~ 120)
    const topPad = (view==='mobile') ? 230 : 180;
    const bottomPad = (view==='mobile') ? 170 : 140;

    return {
      xMin: r.left + PAD,
      xMax: r.right - PAD,
      yMin: r.top + topPad,
      yMax: r.bottom - bottomPad
    };
  }

  // -----------------------------
  // Tuning (สนุก+แฟร์ ป.5)
  // -----------------------------
  const TUNE = (function(){
    let spawnPerSec = 1.05;
    let ttl = 3.10;
    let missLimit = 18; // แต่เราใช้ FAIR MISS อยู่แล้ว -> limit สูงนิดเพื่อไม่ท้อ
    let warmSec = 35;
    let trickSec = 35;
    let bossSec = 14;

    if(diff==='easy'){ spawnPerSec=0.95; ttl=3.35; missLimit=22; warmSec=38; trickSec=32; bossSec=12; }
    if(diff==='hard'){ spawnPerSec=1.18; ttl=2.85; missLimit=15; warmSec=30; trickSec=34; bossSec=16; }
    if(view==='cvr'||view==='vr') ttl += 0.18;

    return { spawnPerSec, ttl, missLimit, warmSec, trickSec, bossSec };
  })();

  // -----------------------------
  // Game State
  // -----------------------------
  const startTimeIso = nowIso();

  let playing = true;
  let paused = false;

  let tLeft = plannedSec;
  let lastTick = nowMs();
  let elapsed = 0;

  // metrics
  let score=0;
  let combo=0, comboMax=0;
  let shots=0, hits=0;
  let miss=0;        // FAIR miss
  let ok=0, wrong=0; // click correctness
  let fever=0;       // 0..100
  let shield=0;      // 0..n (ไว้ต่อยอด)

  // plate completion (เก็บครบ 5 หมู่)
  const have = { 1:0,2:0,3:0,4:0,5:0 };
  const plateHaveCount = ()=> [1,2,3,4,5].reduce((a,id)=> a + (have[id]>0?1:0), 0);

  // stage flow
  let stage = 'warm'; // warm | trick | boss
  let stageLeft = plannedSec;
  let bossHits = 0;

  // mission
  let targetGroup = pick(GROUPS); // หมู่ที่ต้องเน้นตอนนี้
  let streakWrong = 0;

  // targets
  const targets = new Map();
  let idSeq=1;

  // pause hook to match your run HTML
  WIN.__PLATE_SET_PAUSED__ = (on)=>{ paused=!!on; lastTick=nowMs(); };

  // -----------------------------
  // Grade / accuracy
  // -----------------------------
  function accPct(){
    return shots>0 ? Math.round((hits/shots)*100) : 0;
  }
  function grade(){
    const a = accPct();
    const x = (a*0.62) + (comboMax*1.1) - (Math.min(20, miss)*0.8) + (plateHaveCount()*4);
    if(x>=92) return 'S';
    if(x>=80) return 'A';
    if(x>=66) return 'B';
    if(x>=50) return 'C';
    return 'D';
  }

  // -----------------------------
  // Coach “มีเหตุผล” (Top 2 factors)
  // -----------------------------
  let lastCoachMs = 0;
  const COACH_GAP_MS = 2200;

  function coachReasoned(tag){
    const t = nowMs();
    if(t - lastCoachMs < COACH_GAP_MS) return;
    lastCoachMs = t;

    const reasons = [];
    const a = accPct();

    // factor 1: miss
    if(miss >= 6) reasons.push({ k:'MISS', v: miss, txt:'ปล่อยของถูกหมู่หลุด' });

    // factor 2: accuracy low
    if(a < 55) reasons.push({ k:'ACC', v:a, txt:'ยิงผิดหมู่บ่อย' });

    // factor 3: streak wrong
    if(streakWrong >= 2) reasons.push({ k:'STREAK', v: streakWrong, txt:'พลาดติดกัน' });

    // factor 4: time late
    if(elapsed > plannedSec*0.55) reasons.push({ k:'LATE', v: Math.round(elapsed), txt:'ช่วงท้ายเริ่มเร็วขึ้น' });

    // include AI hazard if any
    let hazard = null;
    try{
      const pred = cfg.ai?.getPrediction?.() || WIN.HHA_AI?.getPrediction?.() || null;
      if(pred && pred.hazardRisk != null) hazard = Number(pred.hazardRisk);
    }catch(_){}
    if(hazard != null && hazard >= 0.78) reasons.push({ k:'RISK', v: hazard, txt:'ความเสี่ยงพลาดสูง' });

    reasons.sort((a,b)=> (b.v||0)-(a.v||0));
    const top = reasons.slice(0,2);

    if(top.length===0){
      if(tag==='boss') coach(`บอสมา! โฟกัส “${targetGroup.name}” 🎯`, 'fever');
      return;
    }

    const msg = `ทิป: ระวัง ${top.map(x=>x.txt).join(' + ')} → เล็งให้ตรง “${targetGroup.name}”`;
    coach(msg, (tag==='boss') ? 'fever' : (a<55?'sad':'neutral'));
  }

  // -----------------------------
  // HUD update
  // -----------------------------
  function setHUD(){
    ui.score && (ui.score.textContent=String(score|0));
    ui.combo && (ui.combo.textContent=String(combo|0));
    ui.comboMax && (ui.comboMax.textContent=String(comboMax|0));
    ui.miss && (ui.miss.textContent=String(miss|0));
    ui.time && (ui.time.textContent=String(Math.ceil(tLeft)));

    const ph = plateHaveCount();
    ui.plateHave && (ui.plateHave.textContent=String(ph));
    ui.acc && (ui.acc.textContent = `${accPct()}%`);
    ui.grade && (ui.grade.textContent = grade());

    ui.g1 && (ui.g1.textContent = String(have[1]|0));
    ui.g2 && (ui.g2.textContent = String(have[2]|0));
    ui.g3 && (ui.g3.textContent = String(have[3]|0));
    ui.g4 && (ui.g4.textContent = String(have[4]|0));
    ui.g5 && (ui.g5.textContent = String(have[5]|0));

    ui.targetText && (ui.targetText.textContent = `${targetGroup.icon} เป้าหมาย: ${targetGroup.name}`);

    // Fever
    ui.fever && (ui.fever.textContent = `${Math.round(clamp(fever,0,100))}%`);
    ui.feverFill && (ui.feverFill.style.width = `${Math.round(clamp(fever,0,100))}%`);
    ui.shield && (ui.shield.textContent = String(shield|0));

    // Goal: plate completion
    ui.goalTitle && (ui.goalTitle.textContent = 'เติมจานให้ครบ 5 หมู่');
    ui.goalCount && (ui.goalCount.textContent = `${ph}/5`);
    ui.goalFill && (ui.goalFill.style.width = `${Math.round((ph/5)*100)}%`);

    // Standard events for your HUD listeners (Groups-style)
    emit('hha:time', { left: Math.ceil(tLeft) });
    emit('hha:score', {
      score: score|0,
      combo: combo|0,
      misses: miss|0,
      miss: miss|0,
      accPct: accPct(),
      feverPct: Math.round(clamp(fever,0,100)),
      shield: shield|0
    });
    emit('hha:rank', { grade: grade() });

    emit('quest:update', {
      goalTitle: (stage==='boss') ? 'BOSS: เก็บให้ตรงหมู่' : 'ภารกิจ: เติมจาน 5 หมู่',
      goalNow: ph,
      goalTotal: 5,
      groupName: targetGroup.name,
      miniTitle: (stage==='boss') ? 'BOSS' : (stage==='trick' ? 'TRICK' : 'WARM'),
      miniNow: (stage==='boss') ? bossHits : 0,
      miniTotal: (stage==='boss') ? 999 : 0,
      miniTimeLeftSec: Math.ceil(stageLeft)
    });
  }

  // -----------------------------
  // Target spawn
  // -----------------------------
  function makeTarget(kind, emoji, groupId, ttlSec, isMission){
    const id=String(idSeq++);
    const el=DOC.createElement('div');
    el.className='plateTarget';
    el.dataset.id=id;
    el.dataset.kind=kind; // "right" | "wrong" | "bonus"
    el.textContent=emoji;

    // class for wrong (optional CSS)
    if(kind==='wrong') el.dataset.kind = 'wrong';

    // position
    const r = safeRect();
    const x = r.xMin + r01()*(Math.max(1, r.xMax - r.xMin));
    const y = r.yMin + r01()*(Math.max(1, r.yMax - r.yMin));
    el.style.left = `${x}px`;
    el.style.top  = `${y}px`;

    mount.appendChild(el);

    const born=nowMs();
    const ttl=Math.max(1.1, ttlSec)*1000;
    const obj={ id, el, kind, emoji, groupId, born, ttl, isMission:!!isMission };
    targets.set(id,obj);

    try{ cfg.ai?.onSpawn?.(kind, { id, emoji, ttlSec }); }catch(_){}
    return obj;
  }

  function removeTarget(id, cls){
    const t=targets.get(String(id));
    if(!t) return;
    targets.delete(String(id));
    try{
      if(cls) t.el.classList.add(cls);
      setTimeout(()=>{ try{ t.el.remove(); }catch(_){} }, 120);
    }catch(_){}
  }

  function pickOtherGroupId(exceptId){
    const others = GROUPS.filter(g=>g.id!==exceptId);
    return pick(others).id;
  }

  function spawnOne(){
    // stage ramps
    const ramp = (stage==='boss') ? 1.25 : (stage==='trick') ? 1.15 : 1.0;
    const ttlMul = (stage==='boss') ? 0.90 : (stage==='trick') ? 0.94 : 1.0;

    const ttl = TUNE.ttl * ttlMul;

    // boss: correct มากขึ้นให้รู้สึก “เล่นเก่ง”
    const correctP = (stage==='boss') ? 0.82 : (stage==='trick') ? 0.70 : 0.76;

    const isCorrect = (r01() < correctP);

    if(isCorrect){
      const emoji = pick(targetGroup.items);
      makeTarget('right', emoji, targetGroup.id, ttl, true);
    }else{
      const og = groupById(pickOtherGroupId(targetGroup.id));
      const emoji = pick(og.items);
      makeTarget('wrong', emoji, og.id, ttl, false);
    }

    // trick stage: เพิ่ม “หลอกตา” เล็กน้อย (ไม่ทำให้ miss พุ่ง)
    if(stage==='trick' && r01() < 0.18){
      const og2 = groupById(pickOtherGroupId(targetGroup.id));
      const em2 = pick(og2.items);
      makeTarget('wrong', em2, og2.id, ttl*0.9, false);
    }
  }

  // -----------------------------
  // Hit / miss rules (FAIR)
  // -----------------------------
  function onHit(t){
    shots++;

    const correct = (t.groupId === targetGroup.id) && (t.kind==='right');

    if(correct){
      hits++; ok++;
      streakWrong = 0;

      combo++; comboMax=Math.max(comboMax, combo);
      const add = 12 + Math.min(10, combo);
      score += add;

      // fever up
      fever = clamp(fever + 6 + Math.min(6, combo*0.4), 0, 100);

      // count plate group
      have[targetGroup.id] = (have[targetGroup.id]|0) + 1;

      // rotate target group (ให้สนุก ไม่ซ้ำ)
      const ph = plateHaveCount();
      if(stage==='warm' && elapsed > 10 && ph>=2 && (ok % 5 === 0)){
        targetGroup = pick(GROUPS);
        coach(`เปลี่ยนเป้าหมาย → ${targetGroup.name} 🎯`, 'neutral');
      }
      if(stage==='boss'){
        bossHits++;
        if(bossHits===1) coach('BOSS เริ่มแล้ว! รักษาคอมโบ 🔥', 'fever');
      }

      try{ cfg.ai?.onHit?.('plate_ok', { id:t.id, add, combo }); }catch(_){}
      removeTarget(t.id, 'hit');
      return;
    }

    // WRONG hit
    wrong++;
    streakWrong++;
    combo=0;
    score = Math.max(0, score - 6);
    fever = clamp(fever - 10, 0, 100);

    // ✅ FAIR MISS: “ยิงผิด” นับเป็น wrong ไม่ใช่ miss
    // miss จะนับเฉพาะ “ของถูกหมู่” ที่ปล่อยหลุด (expire) เพื่อกัน miss พุ่งมั่ว
    try{ cfg.ai?.onHit?.('plate_wrong', { id:t.id }); }catch(_){}
    removeTarget(t.id, 'hit');

    if(streakWrong>=2) coachReasoned('warn');
  }

  // pointer hits (pc/mobile)
  mount.addEventListener('pointerdown', (ev)=>{
    if(!playing || paused) return;
    const el = ev.target?.closest?.('.plateTarget');
    if(!el) return;
    const t = targets.get(String(el.dataset.id));
    if(t) onHit(t);
  }, { passive:true });

  // crosshair shoot (VR/cVR)
  function pickClosestToCenter(lockPx){
    lockPx = clamp(lockPx ?? 56, 16, 140);
    let best=null, bestD=1e9;
    const r = mount.getBoundingClientRect();
    const cx=r.left + r.width/2;
    const cy=r.top  + r.height/2;
    for(const t of targets.values()){
      const b=t.el.getBoundingClientRect();
      const tx=b.left + b.width/2;
      const ty=b.top  + b.height/2;
      const d=Math.hypot(tx-cx, ty-cy);
      if(d<bestD){ bestD=d; best=t; }
    }
    if(best && bestD<=lockPx) return best;
    return null;
  }
  WIN.addEventListener('hha:shoot', (ev)=>{
    if(!playing || paused) return;
    const lockPx = ev?.detail?.lockPx ?? 56;
    const t = pickClosestToCenter(lockPx);
    if(t) onHit(t);
  });

  // -----------------------------
  // Expire update: FAIR MISS here
  // -----------------------------
  function updateExpires(){
    const t = nowMs();
    for(const obj of Array.from(targets.values())){
      if(t - obj.born >= obj.ttl){
        // ✅ FAIR MISS: นับ miss เฉพาะ “ของถูกหมู่ (mission/right)” ที่ปล่อยหลุด
        if(runMode !== 'practice'){
          if(obj.isMission && obj.kind==='right' && obj.groupId===targetGroup.id){
            miss++;
            combo=0;
            score = Math.max(0, score - 3);
            fever = clamp(fever - 6, 0, 100);
            try{ cfg.ai?.onExpire?.('plate_miss', { id:obj.id }); }catch(_){}
          }else{
            // ของหลอก/ผิด: ไม่ควรลงโทษหนัก
            score = Math.max(0, score - 1);
            try{ cfg.ai?.onExpire?.('plate_expire', { id:obj.id }); }catch(_){}
          }
        }
        removeTarget(obj.id, 'expire');
      }
    }
  }

  // -----------------------------
  // Stage flow
  // -----------------------------
  function setStage(s){
    stage = s;
    if(stage==='warm'){
      stageLeft = Math.min(TUNE.warmSec, tLeft);
      coach('WARM: เติมจานให้ครบ เริ่มง่ายก่อน 💪', 'neutral');
    }else if(stage==='trick'){
      stageLeft = Math.min(TUNE.trickSec, tLeft);
      targetGroup = pick(GROUPS);
      coach(`TRICK: เริ่มมีหลอกนิดหน่อย—โฟกัส ${targetGroup.name} 🎯`, 'neutral');
    }else{
      stageLeft = Math.min(TUNE.bossSec, tLeft);
      targetGroup = pick(GROUPS);
      bossHits = 0;
      coach(`BOSS! ⚡ เก็บให้ตรง ${targetGroup.name} ให้ได้มากสุด!`, 'fever');
      coachReasoned('boss');
    }
  }

  function stageTick(dt){
    stageLeft = Math.max(0, stageLeft - dt);

    if(stageLeft<=0){
      if(runMode==='practice'){
        showEnd('practice-done');
        return;
      }

      if(isClassroom && miniBossOn){
        if(stage==='warm'){ setStage('trick'); return; }
        if(stage==='trick'){ setStage('boss'); return; }
        if(stage==='boss'){ showEnd('boss-done'); return; }
      }else{
        // non-classroom: เล่นยาวถึง time
        // แต่ถ้า stage เกิน ให้สลับหมู่สนุก ๆ
        targetGroup = pick(GROUPS);
        setStage('warm');
        return;
      }
    }
  }

  // -----------------------------
  // Spawn loop
  // -----------------------------
  let spawnAcc=0;
  function spawnTick(dt){
    let sp = TUNE.spawnPerSec;
    if(stage==='trick') sp *= 1.10;
    if(stage==='boss') sp *= 1.22;

    // fever boost (ให้เดือดแต่แฟร์)
    if(fever>=70) sp *= 1.08;

    spawnAcc += sp * dt;
    while(spawnAcc >= 1){
      spawnAcc -= 1;
      spawnOne();
    }
  }

  // -----------------------------
  // End summary (เด็กอ่านง่าย + research json)
  // -----------------------------
  const END_SENT_KEY='__HHA_PLATE_END_SENT__';
  function dispatchEndOnce(summary){
    try{
      if(WIN[END_SENT_KEY]) return;
      WIN[END_SENT_KEY]=1;
      WIN.dispatchEvent(new CustomEvent('hha:game-ended', { detail: summary || null }));
    }catch(_){}
  }

  function buildSummary(reason){
    return {
      projectTag: 'PlateVR',
      gameVersion: 'PlateVR_SAFE_2026-03-03e',
      device: view,
      runMode,
      diff,
      seed: seedStr,
      mode,
      reason: String(reason||''),
      durationPlannedSec: plannedSec,
      durationPlayedSec: Math.round(plannedSec - tLeft),
      scoreFinal: score|0,
      miss: miss|0,
      shots: shots|0,
      hits: hits|0,
      accuracyPct: accPct(),
      comboMax: comboMax|0,
      grade: grade(),
      plateHave: plateHaveCount(),
      perGroup: { g1:have[1]|0,g2:have[2]|0,g3:have[3]|0,g4:have[4]|0,g5:have[5]|0 },
      stageEnded: stage,
      bossHits: bossHits|0,
      targetGroup: targetGroup?.name || '—',
      startTimeIso,
      endTimeIso: nowIso(),
      aiPredictionLast: (function(){ try{ return cfg.ai?.getPrediction?.() || WIN.HHA_AI?.getPrediction?.() || null; }catch(_){ return null; } })()
    };
  }

  function setEndButtons(summary){
    const done = cooldownDone(HH_CAT, HH_GAME, pid);
    const needCooldown = cooldownRequired && !done;

    if(ui.btnNextCooldown){
      ui.btnNextCooldown.classList.toggle('is-hidden', !needCooldown);
      ui.btnNextCooldown.onclick = null;
      if(needCooldown){
        const sp = new URL(location.href).searchParams;
        const cdnext = sp.get('cdnext') || '';
        const nextAfterCooldown = cdnext || hubUrl || '../hub.html';
        const url = buildCooldownUrl({ hub: hubUrl, nextAfterCooldown, cat: HH_CAT, gameKey: HH_GAME, pid });
        ui.btnNextCooldown.onclick = ()=>{ location.href=url; };
      }
    }
    if(ui.btnBackHub2){
      ui.btnBackHub2.textContent = needCooldown ? 'Back HUB (หลัง Cooldown)' : 'Back HUB';
      ui.btnBackHub2.onclick = ()=>{ location.href = hubUrl; };
    }
    if(ui.btnReplay){
      ui.btnReplay.onclick = ()=>{
        try{
          const u = new URL(location.href);
          if(runMode!=='research'){
            u.searchParams.set('seed', String((Date.now() ^ (Math.random()*1e9))|0));
          }
          location.href = u.toString();
        }catch(_){ location.reload(); }
      };
    }
    if(ui.btnCopy){
      ui.btnCopy.onclick = async ()=>{
        try{
          const text = safeJson(summary);
          await navigator.clipboard.writeText(text);
        }catch(_){
          try{ prompt('Copy Summary JSON:', safeJson(summary)); }catch(__){}
        }
      };
    }
  }

  function showEnd(reason){
    playing=false;
    paused=false;

    for(const t of targets.values()){ try{ t.el.remove(); }catch(_){} }
    targets.clear();

    const summary = buildSummary(reason);

    // AI onEnd
    try{
      const aiEnd = cfg.ai?.onEnd?.(summary);
      if(aiEnd) summary.aiEnd = aiEnd;
    }catch(_){}

    WIN.__HHA_LAST_SUMMARY = summary;
    dispatchEndOnce(summary);

    // show overlay (ถ้ามี)
    if(ui.end){
      ui.end.setAttribute('aria-hidden','false');
      ui.endTitle && (ui.endTitle.textContent = 'RESULT');
      ui.endSub && (ui.endSub.textContent = `grade=${summary.grade} · acc=${summary.accuracyPct}% · miss=${summary.miss}`);
      ui.endGrade && (ui.endGrade.textContent = summary.grade);
      ui.endScore && (ui.endScore.textContent = String(summary.scoreFinal|0));
      ui.endOk && (ui.endOk.textContent = String(ok|0));
      ui.endWrong && (ui.endWrong.textContent = String(wrong|0));
      setEndButtons(summary);
    }else{
      // fallback
      coach(`จบเกม! เกรด ${summary.grade} · แม่น ${summary.accuracyPct}% · miss ${summary.miss}`, 'happy');
    }

    emit('hha:end', summary); // ให้ run page ที่ฟัง hha:end ใช้ได้เหมือน Groups
  }

  // -----------------------------
  // Main tick
  // -----------------------------
  function checkEnd(){
    if(tLeft<=0){ showEnd('time'); return true; }
    if(miss>=TUNE.missLimit){ showEnd('miss-limit'); return true; }
    return false;
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

    elapsed += dt;
    tLeft = Math.max(0, tLeft - dt);

    // stage logic
    stageTick(dt);

    // spawn + expire
    spawnTick(dt);
    updateExpires();

    // AI tick + coach reasoned
    try{
      const pred = cfg.ai?.onTick?.(dt, { miss, ok, wrong, combo, acc: accPct(), stage }) || null;
      if(pred && pred.hazardRisk != null && Number(pred.hazardRisk) >= 0.80){
        coachReasoned(stage==='boss'?'boss':'warn');
      }
    }catch(_){}

    setHUD();
    if(checkEnd()) return;

    requestAnimationFrame(tick);
  }

  // -----------------------------
  // Start sequence (Practice 15s → Real)
  // -----------------------------
  function startPractice(){
    stage = 'warm';
    stageLeft = 15;
    coach('PRACTICE 15s — ซ้อมก่อนเข้าเกมจริง 🧪', 'neutral');
  }

  function startReal(){
    // classroom 3-stage
    if(isClassroom && miniBossOn){
      setStage('warm');
    }else{
      setStage('warm');
    }
    coach(`เริ่มแล้ว! เป้าหมาย: ${targetGroup.name} 🎯`, 'neutral');
  }

  // -----------------------------
  // Visibility: end when background (เหมือนเกมอื่น)
  // -----------------------------
  DOC.addEventListener('visibilitychange', ()=>{
    if(DOC.hidden && playing){ showEnd('background'); }
  });

  // -----------------------------
  // Boot
  // -----------------------------
  try{ WIN[END_SENT_KEY]=0; }catch(_){}

  // reset HUD
  setHUD();

  // practice flow: ถ้าเปิด practice ให้เล่น 15s ก่อน แล้วต่อ real อัตโนมัติ
  if(practiceOn){
    startPractice();
    // หลัง 15s tick จะจบ -> practice-done แล้ว showEnd
    // แต่เราต้อง “ต่อ real” แบบ Groups: จบซ้อมแล้วเข้าเกมจริง
    // ดังนั้น: hook hha:end เมื่อ reason=practice-done -> รีสตาร์ท real โดยไม่ออกหน้า
    let practiced = false;
    const onEnd = (ev)=>{
      const s = ev?.detail || {};
      if(practiced) return;
      if(String(s.reason||'') !== 'practice-done') return;
      practiced = true;

      // ปิด overlay ถ้ามี (กันเด้ง)
      if(ui.end){
        ui.end.setAttribute('aria-hidden','true');
      }

      // reset core state สำหรับ real
      playing = true;
      paused = false;

      // clear targets
      for(const tt of targets.values()){ try{ tt.el.remove(); }catch(_){} }
      targets.clear();

      // reset metrics (แต่ถ้าต้องการเก็บซ้อมไว้ใน research ค่อยขยายทีหลัง)
      score=0; combo=0; comboMax=0;
      shots=0; hits=0; miss=0; ok=0; wrong=0;
      fever=0; shield=0;
      streakWrong=0;
      have[1]=have[2]=have[3]=have[4]=have[5]=0;

      // reset timers
      tLeft = plannedSec;
      elapsed = 0;
      lastTick = nowMs();

      // new stage
      startReal();

      // remove listener
      WIN.removeEventListener('hha:end', onEnd);

      requestAnimationFrame(tick);
    };
    WIN.addEventListener('hha:end', onEnd, { passive:true });

    requestAnimationFrame(tick);
    return;
  }

  // normal start
  startReal();
  requestAnimationFrame(tick);
}