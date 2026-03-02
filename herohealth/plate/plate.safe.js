// === /herohealth/plate/plate.safe.js ===
// Plate VR SAFE — PRODUCTION (HUD IDs aligned + MISS fair + Shield/Fever + AI prediction + End summary + cooldown daily-first)
// FULL v20260302-PLATE-SAFE-HUDSAFE-AIWired
'use strict';

export function boot(cfg){
  cfg = cfg || {};
  const WIN = window, DOC = document;

  // ---------- helpers ----------
  const qs = (k, d='')=>{ try{ return (new URL(location.href)).searchParams.get(k) ?? d; }catch(e){ return d; } };
  const clamp=(v,a,b)=>{ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b,v)); };
  const nowMs = ()=> (performance && performance.now) ? performance.now() : Date.now();
  const nowIso = ()=> new Date().toISOString();
  const safeJson = (o)=>{ try{ return JSON.stringify(o,null,2);}catch(e){return '{}';} };

  // ---------- cooldown helpers (per-game daily) ----------
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
      'plannedGame','finalGame','zone','cdnext','grade','mode'
    ].forEach(k=>{
      const v=sp.get(k);
      if(v!=null && v!=='') gate.searchParams.set(k,v);
    });
    return gate.toString();
  }

  // ---------- deterministic RNG ----------
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

  // ---------- cfg ----------
  const view = String(cfg.view || qs('view','mobile')).toLowerCase();
  const runMode = String(cfg.run || qs('run','play')).toLowerCase(); // play/research
  const diff = String(cfg.diff || qs('diff','normal')).toLowerCase();
  const plannedSec = clamp(cfg.time ?? qs('time','90'), 20, 300);
  const mode = String(cfg.mode || qs('mode','classroom')).toLowerCase(); // classroom/research

  const seedStr = String(cfg.seed ?? qs('seed', String(Date.now())));
  const rng = makeRng(seedStr);
  const r01 = ()=> rng();
  const pick = (arr)=> arr[(r01()*arr.length)|0];

  const pid = String(cfg.pid || qs('pid','anon')).trim()||'anon';
  const hubUrl = String(cfg.hub || qs('hub','../hub.html'));

  const HH_CAT='nutrition';
  const HH_GAME='plate';
  const cooldownRequired = !!cfg.cooldown || (qs('cooldown','0')==='1') || (qs('cd','0')==='1');

  // ---------- DOM ----------
  const mount = cfg.mount || DOC.getElementById('plate-layer');
  if(!mount){ console.warn('[Plate] Missing #plate-layer'); return; }

  const ui = {
    score: DOC.getElementById('uiScore'),
    combo: DOC.getElementById('uiCombo'),
    comboMax: DOC.getElementById('uiComboMax'),
    miss: DOC.getElementById('uiMiss'),
    time: DOC.getElementById('uiTime'),

    plateHave: DOC.getElementById('uiPlateHave'),
    acc: DOC.getElementById('uiAcc'),
    grade: DOC.getElementById('uiGrade'),

    goalTitle: DOC.getElementById('uiGoalTitle'),
    goalCount: DOC.getElementById('uiGoalCount'),
    goalFill: DOC.getElementById('uiGoalFill'),

    fever: DOC.getElementById('uiFever'),
    feverFill: DOC.getElementById('uiFeverFill'),
    shield: DOC.getElementById('uiShield'),

    targetText: DOC.getElementById('uiTargetText'),
    coachMsg: DOC.getElementById('coachMsg'),

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

  // ---------- tuning ----------
  const TUNE = (function(){
    let spawnBase=0.78, ttl=2.9, missLimit=14;
    let pWrong=0.28, pShield=0.06, pStar=0.07;
    let goalNeed=3; // ต่อ “หมู่เป้าหมาย”
    if(diff==='easy'){ spawnBase=0.66; ttl=3.2; missLimit=18; pWrong=0.24; pShield=0.08; pStar=0.09; goalNeed=3; }
    if(diff==='hard'){ spawnBase=0.92; ttl=2.35; missLimit=11; pWrong=0.33; pShield=0.05; pStar=0.06; goalNeed=4; }
    if(view==='cvr'||view==='vr') ttl += 0.15;

    // classroom ลดความเครียด: wrong-expire ไม่เป็น miss
    // research จะเข้มขึ้นนิด (ยัง deterministic)
    if(mode==='research'){
      pWrong = Math.min(0.38, pWrong + 0.04);
      missLimit = Math.max(9, missLimit - 1);
    }

    return { spawnBase, ttl, missLimit, pWrong, pShield, pStar, goalNeed };
  })();

  // ---------- Thai 5 food groups mapping (fixed) ----------
  const GROUPS = [
    { id:1, name:'หมู่ 1 โปรตีน', items:['🥚','🐟','🥛','🍗','🥜'] },
    { id:2, name:'หมู่ 2 คาร์โบไฮเดรต', items:['🍚','🍞','🥔','🍜','🥖'] },
    { id:3, name:'หมู่ 3 ผัก', items:['🥦','🥬','🥕','🥒','🌽'] },
    { id:4, name:'หมู่ 4 ผลไม้', items:['🍌','🍎','🍊','🍉','🍇'] },
    { id:5, name:'หมู่ 5 ไขมัน', items:['🥑','🫒','🧈','🥥','🧀'] },
  ];

  // ---------- state ----------
  const startTimeIso = nowIso();
  let playing=true;
  let paused=false;
  let tLeft=plannedSec;
  let lastTick=nowMs();

  WIN.__PLATE_SET_PAUSED__ = (on)=>{ paused=!!on; lastTick=nowMs(); };

  let score=0;
  let ok=0;
  let wrong=0;

  // MISS ทำให้ “ยุติธรรม”: นับเฉพาะ “ของถูกหมู่ที่หมดเวลา” + “ยิงผิด/โดนผิด (ถ้าไม่มีโล่)”
  let miss=0;
  let missCorrectExpired=0;
  let missWrongHit=0;

  let combo=0, bestCombo=0;

  let fever=0;          // 0..100
  let shield=0;         // 0..6

  // plate completion (เก็บครบ 5 หมู่) -> เก็บเป็น bitmask
  let haveMask = 0;     // bit 0..4
  function haveCount(){
    let c=0;
    for(let i=0;i<5;i++) if(haveMask & (1<<i)) c++;
    return c;
  }

  // mission: target group + need count
  let targetGroup = pick(GROUPS);
  let targetNeed = TUNE.goalNeed;
  let targetCur = 0;

  const foods = new Map();
  let idSeq=1;

  // ---------- spawn safe (avoid HUD overlap) ----------
  function mountRect(){ return mount.getBoundingClientRect(); }

  function getSpawnSafeLocal(){
    const r = mountRect();
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

      if((xMax - xMin) >= 140 && (yMax - yMin) >= 180){
        return { xMin, xMax, yMin, yMax, w:r.width, h:r.height };
      }
    }

    // fallback: กัน HUD บน/ล่าง
    const pad = 18;
    const yMin = Math.min(r.height - 180, 190);
    const yMax = Math.max(yMin + 200, r.height - 140);
    return {
      xMin: pad,
      xMax: Math.max(pad + 160, r.width - pad),
      yMin: clamp(yMin, pad, Math.max(pad, r.height - 260)),
      yMax: clamp(yMax, Math.max(pad+200, yMin+200), Math.max(pad+260, r.height - pad)),
      w: r.width, h: r.height
    };
  }

  // ---------- coach ----------
  let coachLatch = 0;
  function sayCoach(msg){
    const t = nowMs();
    if(t - coachLatch < 3200) return;
    coachLatch = t;
    if(ui.coachMsg) ui.coachMsg.textContent = String(msg||'');
    try{
      WIN.dispatchEvent(new CustomEvent('hha:coach', { detail:{ mood:'neutral', msg:String(msg||'') } }));
    }catch(e){}
  }

  // ---------- scoring / meters ----------
  function addFever(v){
    fever = clamp(fever + v, 0, 100);
  }
  function addShield(n=1){
    shield = clamp(shield + (n|0), 0, 6);
    sayCoach('ได้โล่! 🛡️ กันการพลาดได้ 1 ครั้ง');
  }

  function gradeFromScore(s){
    const played = Math.max(1, plannedSec - tLeft);
    const sps = s/played;
    const x = sps*10 - miss*0.7;
    if(x>=70) return 'S';
    if(x>=55) return 'A';
    if(x>=40) return 'B';
    if(x>=28) return 'C';
    return 'D';
  }

  function accPct(){
    const total = Math.max(1, ok + wrong);
    return Math.round((ok/total)*100);
  }

  function setHUD(){
    ui.score && (ui.score.textContent = String(score|0));
    ui.combo && (ui.combo.textContent = String(combo|0));
    ui.comboMax && (ui.comboMax.textContent = String(bestCombo|0));
    ui.miss && (ui.miss.textContent = String(miss|0));
    ui.time && (ui.time.textContent = String(Math.ceil(tLeft)));

    ui.plateHave && (ui.plateHave.textContent = String(haveCount()));
    ui.acc && (ui.acc.textContent = `${accPct()}%`);
    ui.grade && (ui.grade.textContent = gradeFromScore(score));

    ui.goalCount && (ui.goalCount.textContent = `${targetCur}/${targetNeed}`);
    if(ui.goalFill){
      const p = targetNeed>0 ? (targetCur/targetNeed) : 0;
      ui.goalFill.style.width = `${clamp(p*100,0,100)}%`;
    }

    ui.fever && (ui.fever.textContent = `${Math.round(clamp(fever,0,100))}%`);
    ui.feverFill && (ui.feverFill.style.width = `${clamp(fever,0,100)}%`);
    ui.shield && (ui.shield.textContent = String(shield|0));

    ui.targetText && (ui.targetText.textContent = `${targetGroup.name} (เก็บ ${targetNeed} ชิ้น)`);

    // emit score event (for shared UI)
    try{
      WIN.dispatchEvent(new CustomEvent('hha:score', {
        detail:{
          game:'plate',
          score, miss, ok, wrong,
          combo, bestCombo,
          feverPct: Math.round(clamp(fever,0,100)),
          shield: shield|0,
          accPct: accPct()
        }
      }));
    }catch(e){}
  }

  // ---------- AI wiring ----------
  function aiTick(dt){
    try{
      const pred = cfg.ai?.onTick?.(dt, {
        missGoodExpired: missCorrectExpired,
        missJunkHit: missWrongHit,
        shield,
        fever,
        combo
      }) || null;
      // classroom: แสดงเป็นคำใบ้ผ่าน coach เป็นบางครั้ง (ไม่ถี่)
      if(pred && mode!=='research' && pred.hazardRisk >= 0.66 && r01() < 0.18){
        sayCoach(pred.next5?.[0] || 'โฟกัสหมู่เป้าหมายก่อนนะ!');
      }
    }catch(e){}
  }

  // ---------- targets ----------
  function makeTarget(kind, emoji, ttlSec){
    const id = String(idSeq++);
    const el = DOC.createElement('div');
    el.className = 'plateTarget';
    el.textContent = emoji;
    el.dataset.id = id;
    el.dataset.kind = kind;

    const safe = getSpawnSafeLocal();
    const rPad = (view==='mobile') ? 36 : 42;
    const x = (safe.xMin + rPad) + r01()*(Math.max(1, (safe.xMax - rPad) - (safe.xMin + rPad)));
    const y = (safe.yMin + rPad) + r01()*(Math.max(1, (safe.yMax - rPad) - (safe.yMin + rPad)));

    el.style.left = `${x}px`;
    el.style.top  = `${y}px`;

    mount.appendChild(el);

    const born = nowMs();
    const ttl = Math.max(1.0, ttlSec)*1000;
    const obj = { id, el, kind, emoji, born, ttl, promptMs: nowMs() };
    foods.set(id, obj);

    try{ cfg.ai?.onSpawn?.(kind, { id, emoji, ttlSec }); }catch(e){}
    return obj;
  }

  function removeTarget(id, expire=false){
    const f = foods.get(String(id));
    if(!f) return;
    foods.delete(String(id));
    try{
      if(expire) f.el.classList.add('expire');
      setTimeout(()=>{ try{ f.el.remove(); }catch(e){} }, expire?90:0);
      if(!expire) f.el.remove();
    }catch(e){}
  }

  function isCorrectEmoji(emoji){
    return (targetGroup?.items || []).includes(emoji);
  }
  function groupIndexOfEmoji(emoji){
    for(let i=0;i<GROUPS.length;i++){
      if(GROUPS[i].items.includes(emoji)) return i;
    }
    return -1;
  }

  function applyCorrectHit(f){
    ok++;
    combo++;
    bestCombo = Math.max(bestCombo, combo);

    const base = 12;
    const add = base + Math.min(10, combo);
    score += add;

    addFever(7.0);

    // mark plate group collected
    const gi = groupIndexOfEmoji(f.emoji);
    if(gi>=0) haveMask |= (1<<gi);

    targetCur++;
    if(targetCur >= targetNeed){
      // reward + rotate mission
      score += 60;
      addFever(16);
      sayCoach('เยี่ยม! เปลี่ยนภารกิจหมู่ใหม่ 🎉');
      targetGroup = pick(GROUPS);
      targetNeed = TUNE.goalNeed + ((haveCount()>=3)?1:0); // late game tougher a bit
      targetCur = 0;
    }else{
      if(combo===4) sayCoach('คอมโบมาแล้ว! 🔥');
      if(targetCur===1) sayCoach('ดี! เก็บหมู่เป้าหมายต่ออีกนิด');
    }

    try{ cfg.ai?.onHit?.('food_ok', { id:f.id, emoji:f.emoji, combo }); }catch(e){}
  }

  function applyWrongHit(f){
    // shield blocks one wrong hit (เด็ก ป.5 ไม่เสียกำลังใจ)
    if(shield > 0){
      shield--;
      addFever(3);
      sayCoach('บล็อกได้! 🛡️ ลองยิงหมู่เป้าหมายต่อ');
      try{ cfg.ai?.onHit?.('blocked', { id:f.id }); }catch(e){}
      return;
    }

    wrong++;
    miss++;
    missWrongHit++;
    combo=0;
    score = Math.max(0, score - 8);
    addFever(-10);

    if(miss===1) sayCoach('ดู “หมู่เป้าหมาย” ก่อนยิงนะ');
    if(miss===3) sayCoach('ช้าไม่เป็นไร ค่อย ๆ แม่นขึ้นได้');

    try{ cfg.ai?.onHit?.('food_wrong', { id:f.id, emoji:f.emoji }); }catch(e){}
  }

  function applyShieldHit(){
    addShield(1);
    addFever(2.5);
    try{ cfg.ai?.onHit?.('shield', { add:1 }); }catch(e){}
  }

  function applyStarHit(){
    // star = ลด miss 1 (classroom friendly) + fever boost
    if(miss > 0) miss = Math.max(0, miss - 1);
    addFever(12);
    score += 25;
    sayCoach('⭐ ช่วยได้! ลดพลาด + เพิ่มพลัง');
    try{ cfg.ai?.onHit?.('star', { miss }); }catch(e){}
  }

  function onHit(f, x, y){
    f.el.classList.add('hit');

    if(f.kind === 'shield'){
      applyShieldHit();
      removeTarget(f.id);
      return;
    }
    if(f.kind === 'star'){
      applyStarHit();
      removeTarget(f.id);
      return;
    }

    const correct = isCorrectEmoji(f.emoji);
    if(correct) applyCorrectHit(f);
    else applyWrongHit(f);

    removeTarget(f.id);
  }

  // pointer hits (pc/mobile)
  mount.addEventListener('pointerdown', (ev)=>{
    if(!playing || paused) return;
    const el = ev.target?.closest?.('.plateTarget');
    if(!el) return;
    const id = el.dataset.id;
    const f = foods.get(String(id));
    if(f) onHit(f, ev.clientX, ev.clientY);
  }, { passive:true });

  // crosshair shoot (VR/cVR)
  function pickClosestToCenter(lockPx){
    lockPx = clamp(lockPx ?? 56, 16, 160);
    let best=null, bestD=1e9;
    const r = mountRect();
    const cx = r.left + r.width/2;
    const cy = r.top  + r.height/2;
    for(const f of foods.values()){
      const b = f.el.getBoundingClientRect();
      const fx = b.left + b.width/2;
      const fy = b.top  + b.height/2;
      const d = Math.hypot(fx-cx, fy-cy);
      if(d < bestD){ bestD=d; best=f; }
    }
    if(best && bestD <= lockPx) return best;
    return null;
  }

  WIN.addEventListener('hha:shoot', (ev)=>{
    if(!playing || paused) return;
    const lockPx = ev?.detail?.lockPx ?? 56;
    const f = pickClosestToCenter(lockPx);
    if(f){
      const r = mountRect();
      onHit(f, r.left+r.width/2, r.top+r.height/2);
    }
  });

  // ---------- spawning ----------
  function pickWrongEmoji(){
    const others = GROUPS.filter(g=>g.id !== targetGroup.id);
    return pick(pick(others).items);
  }

  let spawnAcc=0;
  function spawnTick(dt){
    const mult = (fever>=100) ? 1.10 : 1.0;
    spawnAcc += TUNE.spawnBase * mult * dt;

    while(spawnAcc >= 1){
      spawnAcc -= 1;

      // Decide type:
      // - Mostly food: correct vs wrong
      // - Sometimes shield/star (rare)
      const p = r01();

      if(p < TUNE.pShield){
        makeTarget('shield', '🛡️', 2.6);
        continue;
      }
      if(p < TUNE.pShield + TUNE.pStar){
        makeTarget('star', '⭐', 2.4);
        continue;
      }

      const isWrong = (r01() < TUNE.pWrong);
      if(isWrong){
        makeTarget('wrong', pickWrongEmoji(), TUNE.ttl);
      }else{
        makeTarget('food', pick(targetGroup.items), TUNE.ttl);
      }
    }
  }

  // ---------- update / expire ----------
  function updateExpire(){
    const t = nowMs();
    for(const f of Array.from(foods.values())){
      const age = t - f.born;
      if(age >= f.ttl){
        // Expire policy (ลด miss ที่ "ไม่ยุติธรรม"):
        // - ถ้าเป็นของถูกหมู่ แล้วหมดเวลา => MISS
        // - ถ้าเป็นของผิดหมู่ แล้วหมดเวลา => ไม่ MISS (classroom) / research อาจนับ wrong แต่ไม่เพิ่ม miss
        if(f.kind === 'food'){
          // correct food only (food kind means intended correct)
          miss++;
          missCorrectExpired++;
          wrong++; // นับว่า "พลาดภารกิจ" (แต่เราลดโทษ)
          combo=0;
          score = Math.max(0, score - 4);
          addFever(-6);

          if(miss===1) sayCoach('ถ้าช้าไป ของถูกหมู่จะหาย (นับพลาด) นะ');
          try{ cfg.ai?.onExpire?.('food', { id:f.id, correct:true }); }catch(e){}
        }else{
          // wrong/shield/star expire: no miss (classroom-friendly)
          try{ cfg.ai?.onExpire?.(f.kind, { id:f.id }); }catch(e){}
        }
        removeTarget(f.id, true);
      }
    }
  }

  // ---------- end summary ----------
  const END_SENT_KEY='__HHA_PLATE_END_SENT__';
  function dispatchEndOnce(summary){
    try{
      if(WIN[END_SENT_KEY]) return;
      WIN[END_SENT_KEY]=1;
      WIN.dispatchEvent(new CustomEvent('hha:game-ended', { detail: summary || null }));
    }catch(e){}
  }

  function buildSummary(reason){
    const summary = {
      projectTag: 'PlateVR',
      gameVersion: 'PlateVR_SAFE_2026-03-02_HUDSAFE_AIWired',
      device: view,
      runMode,
      diff,
      mode,
      seed: seedStr,
      reason: String(reason||''),
      durationPlannedSec: plannedSec,
      durationPlayedSec: Math.round(plannedSec - tLeft),

      scoreFinal: score|0,
      ok: ok|0,
      wrong: wrong|0,
      missTotal: miss|0,
      missCorrectExpired: missCorrectExpired|0,
      missWrongHit: missWrongHit|0,

      comboMax: bestCombo|0,
      accPct: accPct(),
      plateHave: haveCount(),

      targetGroup: targetGroup?.name || '—',
      startTimeIso,
      endTimeIso: nowIso(),
      grade: gradeFromScore(score),

      aiPredictionLast: (function(){ try{ return cfg.ai?.getPrediction?.() || null; }catch(e){ return null; } })()
    };
    return summary;
  }

  function wireEndButtons(summary){
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
        ui.btnNextCooldown.onclick = ()=>{ location.href = url; };
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
        }catch(e){ location.reload(); }
      };
    }

    if(ui.btnCopy){
      ui.btnCopy.onclick = async ()=>{
        try{
          const text = safeJson(summary);
          await navigator.clipboard.writeText(text);
        }catch(e){
          try{ prompt('Copy Summary JSON:', safeJson(summary)); }catch(_){}
        }
      };
    }
  }

  function showEnd(reason){
    playing=false;
    paused=false;

    for(const f of foods.values()){ try{ f.el.remove(); }catch(e){} }
    foods.clear();

    const summary = buildSummary(reason);

    // AI end packet
    try{
      const aiEnd = cfg.ai?.onEnd?.(summary);
      if(aiEnd) summary.aiEnd = aiEnd;
    }catch(e){}

    WIN.__HHA_LAST_SUMMARY = summary;
    dispatchEndOnce(summary);

    if(ui.end){
      ui.end.setAttribute('aria-hidden','false');
      ui.endTitle && (ui.endTitle.textContent = 'จบเกม');
      ui.endSub && (ui.endSub.textContent = `reason=${summary.reason} | mode=${runMode}/${mode} | view=${view} | seed=${seedStr}`);
      ui.endGrade && (ui.endGrade.textContent = summary.grade || '—');
      ui.endScore && (ui.endScore.textContent = String(summary.scoreFinal|0));
      ui.endOk && (ui.endOk.textContent = String(summary.ok|0));
      ui.endWrong && (ui.endWrong.textContent = String(summary.wrong|0));
      wireEndButtons(summary);
    }

    sayCoach(summary.missTotal >= TUNE.missLimit ? 'ค่อย ๆ แม่นขึ้นได้ โฟกัสหมู่เป้าหมายก่อนนะ' : 'เก่งมาก! ไปต่อได้เลย ✨');
    setHUD();
  }

  function checkEnd(){
    if(tLeft<=0){ showEnd('time'); return true; }
    if(miss>=TUNE.missLimit){ showEnd('miss-limit'); return true; }
    // win condition (classroom): เก็บครบ 5 หมู่
    if(mode!=='research' && haveCount()>=5 && tLeft > 2){
      showEnd('plate-complete');
      return true;
    }
    return false;
  }

  // ---------- main loop ----------
  function tick(){
    if(!playing) return;

    if(paused){
      lastTick = nowMs();
      setHUD();
      requestAnimationFrame(tick);
      return;
    }

    const t = nowMs();
    const dt = Math.min(0.05, Math.max(0.001, (t-lastTick)/1000));
    lastTick = t;

    tLeft = Math.max(0, tLeft - dt);

    spawnTick(dt);
    updateExpire();
    aiTick(dt);

    // Fever decay gentle
    fever = clamp(fever - dt*1.2, 0, 100);

    setHUD();

    if(checkEnd()) return;
    requestAnimationFrame(tick);
  }

  DOC.addEventListener('visibilitychange', ()=>{
    if(DOC.hidden && playing){ showEnd('background'); }
  });

  try{ WIN[END_SENT_KEY]=0; }catch(e){}
  sayCoach('ภารกิจ: ยิง “หมู่เป้าหมาย” ให้ครบ แล้วสะสมให้ครบ 5 หมู่!');
  setHUD();
  requestAnimationFrame(tick);
}