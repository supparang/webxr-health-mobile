// === /herohealth/plate/plate.safe.js ===
// Plate VR SAFE — PRODUCTION (Practice 15s + Storm + Boss + HUD-safe + MISS fair + Shield/Fever + AI prediction + End summary + cooldown daily-first)
// FULL v20260302-PLATE-SAFE-PRACTICE-STORM-BOSS-AIWired
'use strict';

export function boot(cfg){
  cfg = cfg || {};
  const WIN = window, DOC = document;

  // ---------- helpers ----------
  const qs = (k, d='')=>{ try{ return (new URL(location.href)).searchParams.get(k) ?? d; }catch(e){ return d; } };
  const qbool = (k, d=false)=>{
    const v = String(qs(k, d?'1':'0')).toLowerCase();
    return ['1','true','yes','y','on'].includes(v);
  };
  const clamp=(v,a,b)=>{ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b,v)); };
  const nowMs = ()=> (performance && performance.now) ? performance.now() : Date.now();
  const nowIso = ()=> new Date().toISOString();
  const safeJson = (o)=>{ try{ return JSON.stringify(o,null,2);}catch(e){return '{}';} };

  // ---------- cooldown helpers ----------
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

  // Practice / Storm / Boss toggles
  const PRACTICE_ON = qbool('practice', (mode!=='research' && runMode!=='research')); // default ON for classroom
  const PRACTICE_SEC = clamp(qs('practiceSec', '15'), 8, 30);

  const STORM_ON = qbool('storm', true);
  const STORM_SEC = clamp(qs('stormSec','10'), 6, 18);

  const BOSS_ON  = qbool('boss', true);
  const BOSS_SEC = clamp(qs('bossSec','10'), 6, 20);

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
    let goalNeed=3;

    if(diff==='easy'){ spawnBase=0.66; ttl=3.2; missLimit=18; pWrong=0.24; pShield=0.08; pStar=0.09; goalNeed=3; }
    if(diff==='hard'){ spawnBase=0.92; ttl=2.35; missLimit=11; pWrong=0.33; pShield=0.05; pStar=0.06; goalNeed=4; }
    if(view==='cvr'||view==='vr') ttl += 0.15;

    if(mode==='research'){
      pWrong = Math.min(0.38, pWrong + 0.04);
      missLimit = Math.max(9, missLimit - 1);
    }
    return { spawnBase, ttl, missLimit, pWrong, pShield, pStar, goalNeed };
  })();

  // ---------- Thai 5 food groups mapping ----------
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

  // phases
  // practice -> main -> storm -> main -> boss -> main/end
  let phase = (PRACTICE_ON ? 'practice' : 'main'); // practice/main/storm/boss
  let phaseLeft = (phase==='practice') ? PRACTICE_SEC : 0;

  let playedMainSec = 0;        // counts only when phase in main/storm/boss
  let stormDone = false;
  let bossDone = false;

  WIN.__PLATE_SET_PAUSED__ = (on)=>{ paused=!!on; lastTick=nowMs(); };

  let score=0;
  let ok=0;
  let wrong=0;

  // MISS fairness
  let miss=0;
  let missCorrectExpired=0;
  let missWrongHit=0;

  let combo=0, bestCombo=0;

  let fever=0;          // 0..100
  let shield=0;         // 0..6

  let haveMask = 0;     // bit 0..4
  function haveCount(){
    let c=0; for(let i=0;i<5;i++) if(haveMask & (1<<i)) c++;
    return c;
  }

  let targetGroup = pick(GROUPS);
  let targetNeed = TUNE.goalNeed;
  let targetCur = 0;

  // boss goal (hit correct streak)
  let bossNeed = (diff==='hard') ? 9 : 8;
  let bossStreak = 0;

  const foods = new Map();
  let idSeq=1;

  // ---------- spawn safe ----------
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
      if((xMax-xMin) >= 140 && (yMax-yMin) >= 180) return { xMin,xMax,yMin,yMax,w:r.width,h:r.height };
    }

    const pad = 18;
    const yMin = Math.min(r.height - 180, 190);
    const yMax = Math.max(yMin + 200, r.height - 140);
    return {
      xMin: pad,
      xMax: Math.max(pad + 160, r.width - pad),
      yMin: clamp(yMin, pad, Math.max(pad, r.height - 260)),
      yMax: clamp(yMax, Math.max(pad+200, yMin+200), Math.max(pad+260, r.height - pad)),
      w:r.width, h:r.height
    };
  }

  // ---------- coach ----------
  let coachLatch = 0;
  function sayCoach(msg){
    const t = nowMs();
    if(t - coachLatch < 2800) return;
    coachLatch = t;
    if(ui.coachMsg) ui.coachMsg.textContent = String(msg||'');
    try{
      WIN.dispatchEvent(new CustomEvent('hha:coach', { detail:{ mood:'neutral', msg:String(msg||'') } }));
    }catch(e){}
  }

  // ---------- meters ----------
  function addFever(v){ fever = clamp(fever + v, 0, 100); }
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

  function phaseLabel(){
    if(phase==='practice') return '🧪 ฝึก';
    if(phase==='storm') return `🌪️ STORM ${Math.ceil(phaseLeft)}s`;
    if(phase==='boss')  return `👹 BOSS ${bossStreak}/${bossNeed} (${Math.ceil(phaseLeft)}s)`;
    return '🎯 ภารกิจ';
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

    ui.targetText && (ui.targetText.textContent = `${phaseLabel()} • ${targetGroup.name} (เก็บ ${targetNeed} ชิ้น)`);

    try{
      WIN.dispatchEvent(new CustomEvent('hha:score', {
        detail:{
          game:'plate',
          score, miss, ok, wrong,
          combo, bestCombo,
          feverPct: Math.round(clamp(fever,0,100)),
          shield: shield|0,
          accPct: accPct(),
          phase
        }
      }));
    }catch(e){}
  }

  // ---------- AI ----------
  function aiTick(dt){
    try{
      const pred = cfg.ai?.onTick?.(dt, {
        phase,
        missGoodExpired: missCorrectExpired,
        missJunkHit: missWrongHit,
        shield,
        fever,
        combo,
        bossStreak,
      }) || null;

      // classroom: coach hint เบา ๆ ตอนเสี่ยง
      if(pred && mode!=='research' && phase!=='practice' && pred.hazardRisk >= 0.66 && r01() < 0.14){
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
    const obj = { id, el, kind, emoji, born, ttl };
    foods.set(id, obj);

    try{ cfg.ai?.onSpawn?.(kind, { id, emoji, ttlSec, phase }); }catch(e){}
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

  function pickWrongEmoji(){
    const others = GROUPS.filter(g=>g.id !== targetGroup.id);
    return pick(pick(others).items);
  }

  function applyCorrectHit(f){
    ok++;
    combo++;
    bestCombo = Math.max(bestCombo, combo);

    // score multiplier in storm/boss
    const mult = (phase==='storm') ? 2.0 : (phase==='boss' ? 1.6 : 1.0);

    const base = 12;
    const add = (base + Math.min(10, combo)) * mult;
    score += Math.round(add);

    addFever(7.0);

    const gi = groupIndexOfEmoji(f.emoji);
    if(gi>=0) haveMask |= (1<<gi);

    // boss streak
    if(phase==='boss'){
      bossStreak++;
      if(bossStreak >= bossNeed){
        score += 180;
        addFever(22);
        addShield(1);
        sayCoach('ชนะบอสแล้ว! 👹🎉 เก่งมาก!');
        bossDone = true;
        phase = 'main';
        phaseLeft = 0;
        bossStreak = 0;
      }
    }

    targetCur++;
    if(targetCur >= targetNeed){
      score += (phase==='storm' ? 90 : 60);
      addFever(16);
      sayCoach('เยี่ยม! เปลี่ยนภารกิจหมู่ใหม่ 🎉');
      targetGroup = pick(GROUPS);
      targetNeed = TUNE.goalNeed + ((haveCount()>=3)?1:0);
      targetCur = 0;
    }else{
      if(combo===4) sayCoach('คอมโบมาแล้ว! 🔥');
    }

    try{ cfg.ai?.onHit?.('food_ok', { id:f.id, emoji:f.emoji, combo, phase }); }catch(e){}
  }

  function applyWrongHit(f){
    // practice: ไม่ลงโทษ
    if(phase==='practice'){
      combo=0;
      addFever(2);
      sayCoach('ฝึกอยู่ ยิงให้โดนหมู่เป้าหมาย!');
      try{ cfg.ai?.onHit?.('practice_wrong', { id:f.id, emoji:f.emoji }); }catch(e){}
      return;
    }

    // shield blocks
    if(shield > 0){
      shield--;
      addFever(3);
      sayCoach('บล็อกได้! 🛡️ ลองยิงหมู่เป้าหมายต่อ');
      try{ cfg.ai?.onHit?.('blocked', { id:f.id, phase }); }catch(e){}
      return;
    }

    wrong++;
    miss++;
    missWrongHit++;
    combo=0;
    score = Math.max(0, score - 8);
    addFever(-10);

    // boss streak reset
    if(phase==='boss') bossStreak = 0;

    if(miss===1) sayCoach('ดู “หมู่เป้าหมาย” ก่อนยิงนะ');
    if(miss===3) sayCoach('ช้าไม่เป็นไร ค่อย ๆ แม่นขึ้นได้');

    try{ cfg.ai?.onHit?.('food_wrong', { id:f.id, emoji:f.emoji, phase }); }catch(e){}
  }

  function applyShieldHit(){
    // practice: ให้โล่ได้เพื่อจูงใจ
    addShield(1);
    addFever(2.5);
    try{ cfg.ai?.onHit?.('shield', { add:1, phase }); }catch(e){}
  }

  function applyStarHit(){
    // star = ลด miss 1 + fever boost
    if(phase!=='practice' && miss > 0) miss = Math.max(0, miss - 1);
    addFever(12);
    score += 25;
    sayCoach('⭐ ช่วยได้! ลดพลาด + เพิ่มพลัง');
    try{ cfg.ai?.onHit?.('star', { miss, phase }); }catch(e){}
  }

  function onHit(f, x, y){
    try{ f.el.classList.add('hit'); }catch(e){}

    if(f.kind === 'shield'){ applyShieldHit(); removeTarget(f.id); return; }
    if(f.kind === 'star'){ applyStarHit(); removeTarget(f.id); return; }

    const correct = isCorrectEmoji(f.emoji);
    if(correct) applyCorrectHit(f);
    else applyWrongHit(f);

    removeTarget(f.id);
  }

  // pointer hits
  mount.addEventListener('pointerdown', (ev)=>{
    if(!playing || paused) return;
    const el = ev.target?.closest?.('.plateTarget');
    if(!el) return;
    const id = el.dataset.id;
    const f = foods.get(String(id));
    if(f) onHit(f, ev.clientX, ev.clientY);
  }, { passive:true });

  // crosshair shoot
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

  // ---------- spawn / expire ----------
  let spawnAcc=0;

  function spawnParams(){
    // base
    let spawnBase = TUNE.spawnBase;
    let ttl = TUNE.ttl;
    let pWrong = TUNE.pWrong;
    let pShield = TUNE.pShield;
    let pStar = TUNE.pStar;

    // practice = ช้าลง + wrong น้อย
    if(phase==='practice'){
      spawnBase *= 0.80;
      ttl += 0.35;
      pWrong = Math.max(0.18, pWrong - 0.10);
      pShield = Math.min(0.12, pShield + 0.03);
      pStar = Math.min(0.12, pStar + 0.03);
    }

    // storm = เร็วขึ้น + wrong มากขึ้น + ttl สั้นลง
    if(phase==='storm'){
      spawnBase *= 1.55;
      ttl = Math.max(1.8, ttl - 0.35);
      pWrong = Math.min(0.46, pWrong + 0.10);
      pShield = Math.max(0.04, pShield - 0.01);
      pStar = Math.max(0.04, pStar - 0.01);
    }

    // boss = โผล่เฉพาะของถูก + ttl สั้นลง (ท้าทาย)
    if(phase==='boss'){
      spawnBase *= 1.15;
      ttl = Math.max(1.9, ttl - 0.20);
      pWrong = 0.00;
      pShield = 0.05;
      pStar = 0.05;
    }

    // fever boost: spawn เพิ่มนิด
    if(fever>=100 && phase!=='practice') spawnBase *= 1.08;

    return { spawnBase, ttl, pWrong, pShield, pStar };
  }

  function spawnTick(dt){
    const sp = spawnParams();
    spawnAcc += sp.spawnBase * dt;

    while(spawnAcc >= 1){
      spawnAcc -= 1;

      const p = r01();

      if(p < sp.pShield){ makeTarget('shield', '🛡️', 2.6); continue; }
      if(p < sp.pShield + sp.pStar){ makeTarget('star', '⭐', 2.4); continue; }

      const isWrong = (r01() < sp.pWrong);
      if(isWrong){
        makeTarget('wrong', pickWrongEmoji(), sp.ttl);
      }else{
        // boss/main/storm: ออกของถูกเป็นหลัก
        makeTarget('food', pick(targetGroup.items), sp.ttl);
      }
    }
  }

  function updateExpire(){
    const t = nowMs();
    for(const f of Array.from(foods.values())){
      const age = t - f.born;
      if(age >= f.ttl){
        // Expire fairness:
        // - practice: ไม่คิด miss
        // - food expire => miss (เพราะเป็นของถูกหมู่) ยกเว้น practice
        // - wrong/shield/star expire => ไม่คิด miss
        if(phase !== 'practice' && f.kind === 'food'){
          miss++;
          missCorrectExpired++;
          wrong++;
          combo=0;
          score = Math.max(0, score - 4);
          addFever(-6);

          if(phase==='boss') bossStreak = 0;

          if(miss===1) sayCoach('ถ้าช้าไป ของถูกหมู่จะหาย (นับพลาด) นะ');
          try{ cfg.ai?.onExpire?.('food', { id:f.id, correct:true, phase }); }catch(e){}
        }else{
          try{ cfg.ai?.onExpire?.(f.kind, { id:f.id, phase }); }catch(e){}
        }
        removeTarget(f.id, true);
      }
    }
  }

  // ---------- phase control ----------
  function resetForMainStart(){
    // clear live targets
    for(const f of foods.values()){ try{ f.el.remove(); }catch(e){} }
    foods.clear();

    // reset counters for “เกมจริง”
    score=0; ok=0; wrong=0;
    miss=0; missCorrectExpired=0; missWrongHit=0;
    combo=0; bestCombo=0;
    fever=0; shield=0;
    haveMask=0;

    targetGroup = pick(GROUPS);
    targetNeed = TUNE.goalNeed;
    targetCur = 0;

    bossStreak = 0;

    sayCoach('เริ่มเกมจริง! โฟกัสหมู่เป้าหมาย แล้วเก็บให้ครบ 5 หมู่ ✨');
  }

  function startStorm(){
    phase = 'storm';
    phaseLeft = STORM_SEC;
    sayCoach('🌪️ STORM! แต้มคูณ x2 ระวังของหลอก!');
  }

  function startBoss(){
    phase = 'boss';
    phaseLeft = BOSS_SEC;
    bossStreak = 0;
    sayCoach(`👹 BOSS! ยิงของถูกติดกัน ${bossNeed} ครั้งภายในเวลา!`);
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
    return {
      projectTag: 'PlateVR',
      gameVersion: 'PlateVR_SAFE_2026-03-02_PRACTICE_STORM_BOSS_AIWired',
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

      stormOn: STORM_ON,
      bossOn: BOSS_ON,
      practiceOn: PRACTICE_ON,

      aiPredictionLast: (function(){ try{ return cfg.ai?.getPrediction?.() || null; }catch(e){ return null; } })()
    };
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
    if(miss>=TUNE.missLimit && phase!=='practice'){ showEnd('miss-limit'); return true; }

    // win condition (classroom): ครบ 5 หมู่ (หลังเริ่มเกมจริงเท่านั้น)
    if(mode!=='research' && phase!=='practice' && haveCount()>=5 && tLeft > 2){
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

    // time always runs (เหมือนเกมอื่น)
    tLeft = Math.max(0, tLeft - dt);

    // phase timers
    if(phase==='practice'){
      phaseLeft = Math.max(0, phaseLeft - dt);
      if(phaseLeft<=0){
        // start main for real
        resetForMainStart();
        phase='main';
        phaseLeft=0;
      }
    }else{
      playedMainSec += dt;

      if(phase==='storm' || phase==='boss'){
        phaseLeft = Math.max(0, phaseLeft - dt);
        if(phaseLeft<=0){
          if(phase==='boss'){
            sayCoach('บอสจบเวลา! ได้อีกนิดก็ชนะแล้ว 😅');
          }else{
            sayCoach('STORM จบแล้ว กลับสู่ภารกิจปกติ ✨');
          }
          phase='main';
          phaseLeft=0;
          bossStreak = 0;
        }
      }

      // Trigger storm/boss (time-based, deterministic)
      if(STORM_ON && !stormDone && playedMainSec >= 22){
        stormDone = true;
        startStorm();
      }
      if(BOSS_ON && !bossDone && playedMainSec >= 52){
        bossDone = true;
        startBoss();
      }
    }

    spawnTick(dt);
    updateExpire();
    aiTick(dt);

    // Fever decay (ไม่ decay ระหว่าง practice มาก)
    const decay = (phase==='practice') ? 0.6 : 1.2;
    fever = clamp(fever - dt*decay, 0, 100);

    setHUD();

    if(checkEnd()) return;
    requestAnimationFrame(tick);
  }

  DOC.addEventListener('visibilitychange', ()=>{
    if(DOC.hidden && playing){ showEnd('background'); }
  });

  try{ WIN[END_SENT_KEY]=0; }catch(e){}

  if(phase==='practice'){
    sayCoach(`เริ่ม “ฝึกเล็ง” ${PRACTICE_SEC}s — ยิงให้โดนหมู่เป้าหมาย (ยังไม่คิดพลาด)`);
  }else{
    sayCoach('ภารกิจ: ยิง “หมู่เป้าหมาย” ให้ครบ แล้วสะสมให้ครบ 5 หมู่!');
  }

  setHUD();
  requestAnimationFrame(tick);
}