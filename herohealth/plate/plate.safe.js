// === /herohealth/plate/plate.safe.js ===
// PlateVR SAFE — Balanced Plate Combat Edition
// FULL v20260306-PLATE-BALANCE-NOT-GROUPS
// ✅ ต่างจาก Groups ชัดเจน: ไม่ใช่แค่แยกหมู่ แต่ต้อง "จัดจานให้สมดุล"
// ✅ Warm → Trick → Boss
// ✅ Warm: เก็บให้ครบ 5 หมู่ อย่างน้อยหมู่ละ 1
// ✅ Trick: เติมให้สมดุลแบบ "อย่าขาด-อย่าเกิน"
// ✅ Boss: ทำจานตามเป้าหมายสุดท้ายแบบ exact target
// ✅ Miss/score/AI hooks/hha:shoot/end summary/research-safe
'use strict';

export function boot(cfg){
  cfg = cfg || {};
  const WIN = window, DOC = document;

  // ---------------------------
  // helpers
  // ---------------------------
  const clamp=(v,a,b)=>{ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b,v)); };
  const nowMs = ()=> (performance && performance.now) ? performance.now() : Date.now();
  const nowIso = ()=> new Date().toISOString();
  const safeJson = (o)=>{ try{ return JSON.stringify(o,null,2);}catch(_){return '{}';} };
  const qs = (k, d='')=>{ try{ return (new URL(location.href)).searchParams.get(k) ?? d; }catch(_){ return d; } };
  const emit = (name, detail)=>{ try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){ } };

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

  // ---------------------------
  // cfg parse
  // ---------------------------
  const view = String(cfg.view || qs('view','mobile')).toLowerCase();
  const runMode = String(cfg.run || qs('run','play')).toLowerCase();
  const diff = String(cfg.diff || qs('diff','normal')).toLowerCase();
  const plannedSec = clamp(cfg.time ?? qs('time','90'), 20, 300);
  const seedStr = String(cfg.seed || qs('seed', String(Date.now())));
  const rng = makeRng(seedStr);
  const r01 = ()=> rng();
  const pick = (arr)=> arr[(r01()*arr.length)|0];

  const pid = String(cfg.pid || qs('pid','anon')).trim()||'anon';
  const hubUrl = String(cfg.hub || qs('hub','../hub.html'));
  const PRO = !!cfg.pro || (qs('pro','0')==='1');

  // ---------------------------
  // DOM bindings
  // ---------------------------
  const layer = cfg.mount || DOC.getElementById('plate-layer');
  if(!layer){ console.warn('[Plate] Missing mount #plate-layer'); return; }

  const ui = {
    score: DOC.getElementById('uiScore'),
    combo: DOC.getElementById('uiCombo'),
    comboMax: DOC.getElementById('uiComboMax'),
    miss: DOC.getElementById('uiMiss'),
    time: DOC.getElementById('uiTime'),
    acc: DOC.getElementById('uiAcc'),
    grade: DOC.getElementById('uiGrade'),
    fever: DOC.getElementById('uiFever'),
    feverFill: DOC.getElementById('uiFeverFill'),
    shield: DOC.getElementById('uiShield'),
    plateHave: DOC.getElementById('uiPlateHave'),
    targetText: DOC.getElementById('uiTargetText'),
    goalFill: DOC.getElementById('uiGoalFill'),
    phase: DOC.getElementById('uiPhase'),
    phaseProg: DOC.getElementById('uiPhaseProg'),
    proTag: DOC.getElementById('uiProTag'),
    coachMsg: DOC.getElementById('coachMsg'),

    g1: DOC.getElementById('uiG1'),
    g2: DOC.getElementById('uiG2'),
    g3: DOC.getElementById('uiG3'),
    g4: DOC.getElementById('uiG4'),
    g5: DOC.getElementById('uiG5'),

    endOverlay: DOC.getElementById('endOverlay'),
    endTitle: DOC.getElementById('endTitle'),
    endSub: DOC.getElementById('endSub'),
    endGrade: DOC.getElementById('endGrade'),
    endScore: DOC.getElementById('endScore'),
    endOk: DOC.getElementById('endOk'),
    endWrong: DOC.getElementById('endWrong'),
    btnCopy: DOC.getElementById('btnCopy'),
    btnReplay: DOC.getElementById('btnReplay'),
    btnNextCooldown: DOC.getElementById('btnNextCooldown'),
    btnBackHub2: DOC.getElementById('btnBackHub2')
  };

  if(ui.proTag) ui.proTag.textContent = PRO ? 'ON' : 'OFF';

  // ---------------------------
  // Thai 5 food groups (fixed mapping)
  // หมู่ 1 โปรตีน, 2 คาร์โบไฮเดรต, 3 ผัก, 4 ผลไม้, 5 ไขมัน
  // ---------------------------
  const GROUPS = [
    { id:1, key:'g1', name:'หมู่ 1 โปรตีน', short:'โปรตีน', items:['🥚','🐟','🥛','🍗','🥜'] },
    { id:2, key:'g2', name:'หมู่ 2 คาร์โบไฮเดรต', short:'คาร์บ', items:['🍚','🍞','🥔','🍜','🥖'] },
    { id:3, key:'g3', name:'หมู่ 3 ผัก', short:'ผัก', items:['🥦','🥬','🥕','🥒','🌽'] },
    { id:4, key:'g4', name:'หมู่ 4 ผลไม้', short:'ผลไม้', items:['🍌','🍎','🍊','🍉','🍇'] },
    { id:5, key:'g5', name:'หมู่ 5 ไขมัน', short:'ไขมัน', items:['🥑','🫒','🧈','🥥','🧀'] },
  ];
  const groupByEmoji = new Map();
  for(const g of GROUPS) for(const e of g.items) groupByEmoji.set(e, g);

  // ---------------------------
  // targets per phase
  // Warm = ครบหมู่ละ 1
  // Trick = สมดุลเริ่มต้น (2/2/2/2/1)
  // Boss = จานสุดท้าย exact target (PRO ขยับขึ้นเล็กน้อยแต่ยังแฟร์)
  // ---------------------------
  const TARGETS = {
    warm:  { g1:1, g2:1, g3:1, g4:1, g5:1 },
    trick: { g1:2, g2:2, g3:2, g4:2, g5:1 },
    boss:  PRO
      ? { g1:3, g2:3, g3:3, g4:2, g5:1 }
      : { g1:2, g2:2, g3:2, g4:2, g5:1 }
  };

  // ---------------------------
  // tuning
  // ---------------------------
  const TUNE = (function(){
    let spawnPerSec = 1.00;
    let ttl = 2.95;
    let wrongRatio = 0.22;
    let shieldRate = 0.040;
    let missLimit = 18;

    if(diff==='easy'){ spawnPerSec=0.92; ttl=3.20; wrongRatio=0.17; shieldRate=0.050; missLimit=22; }
    if(diff==='hard'){ spawnPerSec=1.12; ttl=2.65; wrongRatio=0.26; shieldRate=0.032; missLimit=14; }
    if(view==='cvr'||view==='vr'){ ttl += 0.20; }

    if(PRO){
      spawnPerSec *= 1.16;
      ttl = Math.max(2.15, ttl - 0.22);
      wrongRatio = Math.min(0.34, wrongRatio + 0.06);
      shieldRate = Math.min(0.055, shieldRate + 0.008);
      missLimit = Math.max(10, missLimit - 3);
    }

    if(runMode==='research'){
      spawnPerSec = Math.min(spawnPerSec, 1.12);
    }

    return { spawnPerSec, ttl, wrongRatio, shieldRate, missLimit };
  })();

  // ---------------------------
  // state
  // ---------------------------
  const startTimeIso = nowIso();

  let playing=true;
  let paused=false;
  let tLeft=plannedSec;
  let lastTick=nowMs();

  WIN.__PLATE_SET_PAUSED__ = (on)=>{ paused=!!on; lastTick=nowMs(); };

  let score=0;
  let combo=0, comboMax=0;
  let ok=0, wrong=0;
  let missExpire=0;
  let missWrong=0;
  let shield=0;
  let fever=0;

  const plateCount = { g1:0,g2:0,g3:0,g4:0,g5:0 };
  let phase='warm';
  let phaseProg=0;
  let phaseNeed=5;

  const ents = new Map();
  let idSeq=1;

  // explainable stats
  const stats = {
    wrongHit:0,
    expireNeeded:0,
    expireAll:0,
    overfillHit:0,
    rescued:0
  };

  // telemetry
  const TEL = {
    tSec: 0,
    tickAcc: 0,
    startIso: startTimeIso,
    sentLabels: false
  };

  // ---------------------------
  // HUD-safe spawn rectangle
  // ---------------------------
  function rectOf(el){
    try{ return el ? el.getBoundingClientRect() : null; }catch(_){ return null; }
  }
  function intersect(a,b){
    if(!a||!b) return false;
    return !(a.right<b.left || a.left>b.right || a.bottom<b.top || a.top>b.bottom);
  }
  function safeSpawnRect(){
    const r = layer.getBoundingClientRect();
    const pad = (view==='mobile') ? 16 : 18;
    let left = r.left + pad;
    let right= r.right - pad;
    let top  = r.top + pad;
    let bottom = r.bottom - pad;

    const rt = rectOf(DOC.getElementById('hudTop'));
    const rb = rectOf(DOC.getElementById('hudBottom'));

    if(rt && intersect(r, rt)) top = Math.max(top, rt.bottom + 10);
    if(rb && intersect(r, rb)) bottom = Math.min(bottom, rb.top - 10);

    if(bottom - top < 150){
      top = r.top + 86;
      bottom = r.bottom - 44;
    }
    return { left, right, top, bottom, width: Math.max(1,right-left), height: Math.max(1,bottom-top) };
  }

  // ---------------------------
  // visual helpers
  // ---------------------------
  function banner(text){
    const el = DOC.createElement('div');
    el.className='phaseBanner';
    el.textContent = text;
    DOC.body.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(_){} }, 1100);
  }
  function popText(text, x, y){
    const el = DOC.createElement('div');
    el.className='popScore';
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top  = `${y}px`;
    DOC.body.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(_){} }, 650);
  }
  function coachSay(msg, mood='neutral'){
    if(ui.coachMsg) ui.coachMsg.textContent = msg;
    emit('hha:coach', { msg, text: msg, mood });
  }
  function fxHit(el){
    if(!el) return;
    el.classList.add('hit');
    el.style.boxShadow = '0 0 24px rgba(34,197,94,.70)';
    setTimeout(()=>{ try{ el.classList.remove('hit'); el.style.boxShadow=''; }catch(_){} }, 120);
  }
  function fxWrong(el){
    if(!el) return;
    el.style.animation = 'shake .25s';
    el.style.borderColor = 'rgba(239,68,68,.8)';
    setTimeout(()=>{ try{ el.style.animation=''; el.style.borderColor=''; }catch(_){} }, 250);
  }
  function fxExpire(el){
    if(!el) return;
    el.classList.add('expire');
  }

  (function ensureShake(){
    if(DOC.getElementById('__plate_shake_css__')) return;
    const s=DOC.createElement('style');
    s.id='__plate_shake_css__';
    s.textContent = `
      @keyframes shake{
        0%{transform:translate(-50%,-50%) translateX(0)}
        25%{transform:translate(-50%,-50%) translateX(-4px)}
        50%{transform:translate(-50%,-50%) translateX(4px)}
        75%{transform:translate(-50%,-50%) translateX(-3px)}
        100%{transform:translate(-50%,-50%) translateX(0)}
      }
    `;
    DOC.head.appendChild(s);
  })();

  // ---------------------------
  // balance logic
  // ---------------------------
  function currentTargetMap(){
    return TARGETS[phase] || TARGETS.warm;
  }
  function groupNeed(key){
    const tgt = currentTargetMap();
    return Math.max(0, (tgt[key]||0) - (plateCount[key]||0));
  }
  function groupOver(key){
    const tgt = currentTargetMap();
    return Math.max(0, (plateCount[key]||0) - (tgt[key]||0));
  }
  function totalNeed(){
    const tgt = currentTargetMap();
    let n=0;
    for(const k of Object.keys(tgt)) n += Math.max(0, (tgt[k]||0) - (plateCount[k]||0));
    return n;
  }
  function totalOver(){
    const tgt = currentTargetMap();
    let n=0;
    for(const k of Object.keys(tgt)) n += Math.max(0, (plateCount[k]||0) - (tgt[k]||0));
    return n;
  }
  function haveUniqueGroups(){
    let n=0;
    for(const k of ['g1','g2','g3','g4','g5']) if((plateCount[k]||0) > 0) n++;
    return n;
  }
  function balancePct(){
    const tgt = currentTargetMap();
    let want=0;
    for(const k of Object.keys(tgt)) want += (tgt[k]||0);
    const need = totalNeed();
    const over = totalOver();
    const good = Math.max(0, want - need - over);
    return Math.round((good / Math.max(1, want)) * 100);
  }
  function missionText(){
    const tgt = currentTargetMap();

    if(phase==='warm'){
      const missing = GROUPS.filter(g => (plateCount[g.key]||0) < 1).map(g=>g.short);
      return missing.length
        ? `เก็บให้ครบ 5 หมู่ • ยังขาด: ${missing.slice(0,3).join(', ')}${missing.length>3?'...':''}`
        : 'ครบ 5 หมู่แล้ว! เตรียมเข้า Trick';
    }

    const lacking = GROUPS.filter(g => groupNeed(g.key) > 0)
      .sort((a,b)=>groupNeed(b.key)-groupNeed(a.key))
      .map(g=>`${g.short} ${plateCount[g.key]||0}/${tgt[g.key]||0}`);

    const overing = GROUPS.filter(g => groupOver(g.key) > 0)
      .sort((a,b)=>groupOver(b.key)-groupOver(a.key))
      .map(g=>`${g.short} ${plateCount[g.key]||0}/${tgt[g.key]||0}`);

    if(phase==='trick'){
      if(overing.length) return `จานเริ่มเกิน: ${overing.slice(0,2).join(' • ')} • แก้สมดุล`;
      return `เติมสมดุล: ${lacking.slice(0,2).join(' • ') || 'ใกล้ครบแล้ว'}`;
    }

    if(phase==='boss'){
      if(overing.length) return `BOSS: เกิน ${overing.slice(0,2).join(' • ')} • อย่าเลือกซ้ำหมู่ที่เกิน`;
      return `BOSS: ขาด ${lacking.slice(0,3).join(' • ') || 'ครบแล้ว ✅'}`;
    }

    return 'จัดจานให้สมดุล';
  }
  function progressForPhase(){
    if(phase==='warm'){
      return { now: haveUniqueGroups(), need: 5 };
    }
    const tgt = currentTargetMap();
    let want=0;
    for(const k of Object.keys(tgt)) want += tgt[k];
    const now = Math.max(0, want - totalNeed() - totalOver());
    return { now, need: want };
  }

  // ---------------------------
  // scoring
  // ---------------------------
  function missTotal(){ return (missExpire + missWrong); }
  function accuracyPct(){
    const shots = ok + wrong;
    return shots > 0 ? Math.round((ok / shots) * 100) : 0;
  }
  function gradeFrom(){
    const acc = accuracyPct();
    const bal = balancePct();
    const m = missTotal();
    const x = (score * 0.08) + (acc * 0.50) + (bal * 0.40) - (m * 1.2);
    if(x >= 92) return 'S';
    if(x >= 78) return 'A';
    if(x >= 62) return 'B';
    if(x >= 45) return 'C';
    return 'D';
  }

  // ---------------------------
  // telemetry
  // ---------------------------
  function buildLabels(){
    return {
      schema: "HHA_LABELS_V1",
      game: "plate",
      runMode, diff, view,
      seed: seedStr,
      pid,
      plannedSec,
      pro: PRO ? 1 : 0,
      startIso: TEL.startIso
    };
  }
  function buildFeatures1s(){
    const aiPred = (function(){ try{ return cfg.ai?.getPrediction?.() || null; }catch(_){ return null; } })();
    const p = progressForPhase();
    return {
      schema: "HHA_FEATURES_1S_V1",
      game: "plate",
      tSec: TEL.tSec|0,
      leftSec: Math.ceil(tLeft),
      score: score|0,
      combo: combo|0,
      miss: missTotal()|0,
      accPct: accuracyPct(),
      balancePct: balancePct(),
      phase,
      phaseProg: p.now|0,
      phaseNeed: p.need|0,
      pro: !!PRO,
      plateHave: haveUniqueGroups()|0,
      shield: shield|0,
      feverPct: Math.round(clamp(fever,0,100)),
      needTotal: totalNeed()|0,
      overTotal: totalOver()|0,
      ai: aiPred ? {
        hazardRisk: +Number(aiPred.hazardRisk||0).toFixed(3),
        watch0: String((aiPred.next5 && aiPred.next5[0]) || '')
      } : null
    };
  }

  // ---------------------------
  // HUD
  // ---------------------------
  function setHUD(){
    if(ui.score) ui.score.textContent = String(score|0);
    if(ui.combo) ui.combo.textContent = String(combo|0);
    if(ui.comboMax) ui.comboMax.textContent = String(comboMax|0);
    if(ui.miss) ui.miss.textContent = String(missTotal()|0);
    if(ui.time) ui.time.textContent = String(Math.ceil(tLeft));
    if(ui.acc) ui.acc.textContent = `${accuracyPct()}%`;
    if(ui.grade) ui.grade.textContent = gradeFrom();
    if(ui.shield) ui.shield.textContent = String(shield|0);
    if(ui.fever) ui.fever.textContent = `${Math.round(clamp(fever,0,100))}%`;
    if(ui.feverFill) ui.feverFill.style.width = `${Math.round(clamp(fever,0,100))}%`;

    if(ui.plateHave) ui.plateHave.textContent = String(haveUniqueGroups());
    if(ui.g1) ui.g1.textContent = String(plateCount.g1|0);
    if(ui.g2) ui.g2.textContent = String(plateCount.g2|0);
    if(ui.g3) ui.g3.textContent = String(plateCount.g3|0);
    if(ui.g4) ui.g4.textContent = String(plateCount.g4|0);
    if(ui.g5) ui.g5.textContent = String(plateCount.g5|0);

    if(ui.phase) ui.phase.textContent = String(phase||'warm').toUpperCase();

    const p = progressForPhase();
    phaseProg = p.now;
    phaseNeed = p.need;
    if(ui.phaseProg) ui.phaseProg.textContent = `${p.now|0}/${p.need|0}`;
    if(ui.goalFill) ui.goalFill.style.width = `${clamp(Math.round((p.now/Math.max(1,p.need))*100),0,100)}%`;

    if(ui.targetText) ui.targetText.textContent = missionText();

    emit('hha:score', {
      score, combo, comboMax,
      miss: missTotal(),
      misses: missTotal(),
      accPct: accuracyPct(),
      feverPct: Math.round(clamp(fever,0,100)),
      shield
    });
    emit('hha:rank', { grade: gradeFrom() });
  }

  // ---------------------------
  // phase
  // ---------------------------
  function setPhase(p){
    phase = p;

    if(phase==='warm'){
      banner('WARM 🔥');
      coachSay('WARM: เก็บให้ครบ 5 หมู่ อย่างน้อยหมู่ละ 1', 'happy');
      emit('hha:event', { type:'phase_change', game:'plate', phase:'warm', atSec:TEL.tSec });
    }
    if(phase==='trick'){
      banner('TRICK ⚡');
      coachSay('TRICK: เติมสิ่งที่ยังขาด อย่าเก็บหมู่ที่เกิน', 'neutral');
      emit('hha:event', { type:'phase_change', game:'plate', phase:'trick', atSec:TEL.tSec });
    }
    if(phase==='boss'){
      banner('BOSS 👑');
      coachSay('BOSS: ทำจานสุดท้ายให้ตรงเป้าหมายแบบพอดี', 'fever');
      emit('hha:event', { type:'phase_change', game:'plate', phase:'boss', atSec:TEL.tSec });
    }

    setHUD();
  }

  function maybeAdvance(){
    if(phase==='warm' && haveUniqueGroups() >= 5){
      setPhase('trick');
      return;
    }
    if(phase==='trick' && totalNeed()===0 && totalOver()===0){
      setPhase('boss');
      return;
    }
    if(phase==='boss' && totalNeed()===0 && totalOver()===0){
      showEnd('boss-clear');
    }
  }

  // ---------------------------
  // spawn
  // ---------------------------
  function spawnChoiceGroups(){
    const needed = GROUPS.filter(g => groupNeed(g.key) > 0);
    const neutral = GROUPS.filter(g => groupNeed(g.key) === 0 && groupOver(g.key) === 0);
    const overed = GROUPS.filter(g => groupOver(g.key) > 0);

    return { needed, neutral, overed };
  }

  function pickFoodForCurrentPhase(isHelpful){
    const { needed, neutral, overed } = spawnChoiceGroups();

    if(isHelpful){
      if(needed.length) return pick(pick(needed).items);
      if(neutral.length) return pick(pick(neutral).items);
      return pick(pick(GROUPS).items);
    }

    // decoy
    const pool = []
      .concat(overed.length ? overed : [])
      .concat(neutral.length ? neutral : [])
      .concat(GROUPS);
    return pick(pick(pool).items);
  }

  function makeTarget(kind, emoji, ttlSec){
    const id = String(idSeq++);
    const el = DOC.createElement('div');
    el.className = 'plateTarget';
    el.dataset.id = id;
    el.dataset.kind = kind;
    el.textContent = emoji;

    const sr = safeSpawnRect();
    const x = sr.left + r01()*sr.width;
    const y = sr.top  + r01()*sr.height;

    el.style.left = `${x}px`;
    el.style.top  = `${y}px`;

    layer.appendChild(el);

    const born = nowMs();
    const ttl = Math.max(1.0, ttlSec) * 1000;
    const obj = { id, el, kind, emoji, born, ttl };
    ents.set(id, obj);

    try{ cfg.ai?.onSpawn?.(kind, { id, emoji, ttlSec, phase, diff, pro: PRO?1:0 }); }catch(_){}
    return obj;
  }

  function removeTarget(id){
    const o = ents.get(String(id));
    if(!o) return;
    ents.delete(String(id));
    try{ o.el.remove(); }catch(_){}
  }

  function spawnOne(){
    const shieldChance =
      TUNE.shieldRate +
      (phase==='boss' ? 0.010 : phase==='trick' ? 0.006 : 0);

    if(r01() < shieldChance){
      makeTarget('shield', '🛡️', Math.max(1.4, TUNE.ttl - 0.7));
      return;
    }

    const helpfulRatio =
      phase==='warm' ? 0.72 :
      phase==='trick' ? 0.64 :
      0.68;

    const helpful = (r01() < helpfulRatio);
    const emoji = pickFoodForCurrentPhase(helpful);

    // tag as wrong visual if decoy-heavy
    if(helpful){
      makeTarget('food', emoji, TUNE.ttl);
    }else{
      makeTarget('wrong', emoji, Math.max(1.1, TUNE.ttl - 0.10));
    }
  }

  let spawnAcc = 0;
  function spawnTick(dt){
    const mult =
      phase==='warm' ? 1.00 :
      phase==='trick' ? 1.08 :
      1.12;
    spawnAcc += TUNE.spawnPerSec * mult * dt;
    while(spawnAcc >= 1){
      spawnAcc -= 1;
      spawnOne();
    }
  }

  // ---------------------------
  // hit logic
  // ---------------------------
  function applyShieldIfAny(){
    if(shield > 0){
      shield--;
      stats.rescued++;
      fever = clamp(fever + 6, 0, 100);
      coachSay('🛡️ Shield ช่วยกันพลาด 1 ครั้ง!', 'happy');
      emit('hha:event', { type:'shield_block', game:'plate', atSec:TEL.tSec, shieldLeft: shield });
      return true;
    }
    return false;
  }

  function isHelpfulEmoji(emoji){
    const g = groupByEmoji.get(emoji);
    if(!g) return false;
    return groupNeed(g.key) > 0;
  }

  function isOverfillEmoji(emoji){
    const g = groupByEmoji.get(emoji);
    if(!g) return false;
    return groupOver(g.key) > 0;
  }

  function addToPlate(emoji){
    const g = groupByEmoji.get(emoji);
    if(g) plateCount[g.key] = (plateCount[g.key]||0) + 1;
    return g;
  }

  function onCorrectHit(ent, cx, cy){
    ok++;
    combo++;
    comboMax = Math.max(comboMax, combo);

    const g = addToPlate(ent.emoji);
    const beforeNeed = totalNeed();
    const beforeOver = totalOver();

    fever = clamp(fever + (combo>=6 ? 3.0 : 2.0), 0, 100);

    let add = 14 + Math.min(12, combo);
    if(phase==='boss') add += 4;
    score += add;

    fxHit(ent.el);
    popText(`+${add}`, cx, cy);

    try{ cfg.ai?.onHit?.('food_ok', { id: ent.id, phase, combo, score, group: g?.key||'' }); }catch(_){}
    removeTarget(ent.id);

    const afterNeed = totalNeed();
    const afterOver = totalOver();

    if(afterNeed < beforeNeed){
      coachSay(`ดี! จานขาดน้อยลง (${g?.short||'อาหาร'})`, 'happy');
    }else if(afterOver > beforeOver){
      coachSay(`ระวัง ${g?.short||'หมู่นี้'} เริ่มเกินแล้ว`, 'neutral');
    }

    maybeAdvance();
  }

  function onWrongHit(ent, cx, cy){
    wrong++;
    missWrong++;
    stats.wrongHit++;

    const overfill = isOverfillEmoji(ent.emoji);
    if(overfill) stats.overfillHit++;

    if(applyShieldIfAny()){
      fxWrong(ent.el);
      popText('🛡️ BLOCK', cx, cy);
    }else{
      combo = 0;
      fever = clamp(fever - 10, 0, 100);
      score = Math.max(0, score - (overfill ? 10 : 8));
      fxWrong(ent.el);
      popText(overfill ? 'เกิน!' : 'ผิด', cx, cy);
    }

    try{ cfg.ai?.onHit?.('food_wrong', {
      id: ent.id, phase, combo, score, overfill: overfill?1:0
    }); }catch(_){}
    removeTarget(ent.id);

    if(overfill){
      coachSay('หมู่นี้เกินแล้ว เลือกหมู่ที่ยังขาดแทน', 'sad');
    }else{
      coachSay('ดูแถบภารกิจ: ตอนนี้จานยัง “ขาดอะไร” อยู่', 'sad');
    }

    maybeAdvance();
  }

  function onShieldHit(ent, cx, cy){
    shield = clamp(shield + 1, 0, 6);
    score += 6;
    fever = clamp(fever + 4, 0, 100);
    fxHit(ent.el);
    popText('+Shield', cx, cy);
    try{ cfg.ai?.onHit?.('shield', { id: ent.id, shield }); }catch(_){}
    removeTarget(ent.id);
  }

  function onHit(ent, cx, cy){
    if(ent.kind==='shield'){
      onShieldHit(ent, cx, cy);
      return;
    }

    const helpful = isHelpfulEmoji(ent.emoji);

    if(helpful) onCorrectHit(ent, cx, cy);
    else onWrongHit(ent, cx, cy);
  }

  // pointer hits
  layer.addEventListener('pointerdown', (ev)=>{
    if(!playing || paused) return;
    const el = ev.target?.closest?.('.plateTarget');
    if(!el) return;
    const id = el.dataset.id;
    const ent = ents.get(String(id));
    if(ent) onHit(ent, ev.clientX, ev.clientY);
  }, { passive:true });

  // crosshair shoot
  function pickClosestToCenter(lockPx){
    lockPx = clamp(lockPx ?? 56, 16, 140);
    let best=null, bestD=1e9;

    const r = layer.getBoundingClientRect();
    const cx = r.left + r.width/2;
    const cy = r.top  + r.height/2;

    for(const ent of ents.values()){
      const b = ent.el.getBoundingClientRect();
      const ex = b.left + b.width/2;
      const ey = b.top  + b.height/2;
      const d = Math.hypot(ex-cx, ey-cy);
      if(d < bestD){ bestD = d; best = ent; }
    }
    if(best && bestD <= lockPx) return best;
    return null;
  }

  WIN.addEventListener('hha:shoot', (ev)=>{
    if(!playing || paused) return;
    const lockPx = ev?.detail?.lockPx ?? 56;
    const ent = pickClosestToCenter(lockPx);
    if(ent){
      const r = layer.getBoundingClientRect();
      onHit(ent, r.left+r.width/2, r.top+r.height/2);
    }
  });

  WIN.addEventListener('hha:pause', ()=>{ paused=true; }, { passive:true });
  WIN.addEventListener('hha:resume', ()=>{ paused=false; lastTick=nowMs(); }, { passive:true });

  // ---------------------------
  // expire
  // ---------------------------
  function updateExpire(){
    const t = nowMs();
    for(const ent of Array.from(ents.values())){
      const age = t - ent.born;
      if(age >= ent.ttl){
        if(ent.kind==='food' || ent.kind==='wrong'){
          stats.expireAll++;
          if(isHelpfulEmoji(ent.emoji)) stats.expireNeeded++;
          missExpire++;

          if(applyShieldIfAny()){
            // blocked
          }else{
            combo = 0;
            fever = clamp(fever - 8, 0, 100);
            score = Math.max(0, score - (isHelpfulEmoji(ent.emoji) ? 6 : 4));
          }
        }

        try{ cfg.ai?.onExpire?.(ent.kind, { id:ent.id, phase }); }catch(_){}
        fxExpire(ent.el);
        removeTarget(ent.id);
      }
    }
  }

  // ---------------------------
  // AI / explainable
  // ---------------------------
  function explainTop2(){
    const arr = [
      { k:'ปล่อยอาหารที่ “ยังขาด” หลุดเวลา', v: stats.expireNeeded },
      { k:'เลือกหมู่ผิด/ไม่จำเป็น', v: stats.wrongHit },
      { k:'เก็บหมู่ที่ “เกิน” แล้ว', v: stats.overfillHit }
    ].sort((a,b)=>b.v-a.v);
    return arr.filter(x=>x.v>0).slice(0,2).map(x=>x.k);
  }

  function aiFixTip(){
    if(stats.expireNeeded >= stats.wrongHit && stats.expireNeeded >= 2){
      return 'โฟกัสหมู่ที่ยังขาดก่อน แล้วค่อยเก็บอย่างอื่น';
    }
    if(stats.overfillHit >= 2){
      return 'ดูข้อความภารกิจ: ถ้าหมู่ไหนเกินแล้ว อย่าเลือกซ้ำ';
    }
    if(stats.wrongHit >= 2){
      return 'ยิงช้าลงนิด แล้วดูว่า “ตอนนี้จานขาดอะไร”';
    }
    return 'รักษาคอมโบและเลือกหมู่ที่ยังขาดต่อไป';
  }

  function aiTick(dt){
    try{
      const pred = cfg.ai?.onTick?.(dt, {
        score, ok, wrong, miss: missTotal(), combo, shield, fever, phase,
        needTotal: totalNeed(), overTotal: totalOver(), balancePct: balancePct()
      }) || null;

      if(pred && typeof pred.hazardRisk === 'number'){
        if(pred.hazardRisk >= 0.82 && (missTotal()%3===0)){
          coachSay('AI เตือน: ตอนนี้เสี่ยงเพราะจานเริ่มหลุดสมดุล', 'sad');
          emit('hha:event', {
            type:'ai_watchout',
            game:'plate',
            atSec:TEL.tSec,
            risk:+Number(pred.hazardRisk||0).toFixed(3),
            watch0:String((pred.next5 && pred.next5[0]) || '')
          });
        }
      }
    }catch(_){}
  }

  // ---------------------------
  // summary / end
  // ---------------------------
  const END_SENT_KEY='__HHA_PLATE_END_SENT__';
  function dispatchEndOnce(summary){
    try{
      if(WIN[END_SENT_KEY]) return;
      WIN[END_SENT_KEY]=1;
      emit('hha:game-ended', summary || null);
      emit('hha:end', summary || null);
    }catch(_){}
  }

  function buildSummary(reason){
    const summary = {
      projectTag: 'PlateVR',
      gameVersion: 'v20260306-PLATE-BALANCE-NOT-GROUPS',
      device: view,
      runMode,
      diff,
      pro: PRO ? 1 : 0,
      seed: seedStr,
      pid,
      reason: String(reason||''),
      durationPlannedSec: plannedSec,
      durationPlayedSec: Math.round(plannedSec - tLeft),

      scoreFinal: score|0,
      comboMax: comboMax|0,

      ok: ok|0,
      wrong: wrong|0,
      miss: missTotal()|0,
      missExpire: missExpire|0,
      missWrong: missWrong|0,

      accuracyPct: accuracyPct(),
      balancePct: balancePct(),
      grade: gradeFrom(),

      phaseEnd: phase,
      phaseProg: phaseProg|0,
      phaseNeed: phaseNeed|0,

      shield: shield|0,
      feverPct: Math.round(clamp(fever,0,100)),

      plateCount: { ...plateCount },
      targets: {
        warm: { ...TARGETS.warm },
        trick:{ ...TARGETS.trick },
        boss: { ...TARGETS.boss }
      },
      needRemaining: totalNeed(),
      overTotal: totalOver(),

      startTimeIso,
      endTimeIso: nowIso(),

      aiPredictionLast: (function(){ try{ return cfg.ai?.getPrediction?.() || null; }catch(_){ return null; } })()
    };

    summary.aiExplainTop2 = explainTop2();
    summary.aiFixTip = aiFixTip();
    return summary;
  }

  function showEnd(reason){
    playing=false;
    paused=false;

    for(const ent of ents.values()){ try{ ent.el.remove(); }catch(_){} }
    ents.clear();

    const summary = buildSummary(reason);

    try{
      const aiEnd = cfg.ai?.onEnd?.(summary);
      if(aiEnd) summary.aiEnd = aiEnd;
    }catch(_){}

    WIN.__HHA_LAST_SUMMARY = summary;
    emit('hha:features_1s', buildFeatures1s());
    emit('hha:labels', { ...buildLabels(), endIso: nowIso(), reason });
    dispatchEndOnce(summary);

    if(summary.aiExplainTop2 && summary.aiExplainTop2.length){
      coachSay(`สรุป: ${summary.aiExplainTop2.join(', ')}`, 'neutral');
    }else{
      coachSay('สรุป: จานสมดุลดีมาก! พร้อมไปต่อ 🔥', 'happy');
    }

    if(ui.endOverlay){
      ui.endOverlay.setAttribute('aria-hidden','false');
      if(ui.endTitle) ui.endTitle.textContent = 'RESULT';
      if(ui.endSub){
        ui.endSub.textContent =
          `grade=${summary.grade} • acc=${summary.accuracyPct}% • balance=${summary.balancePct}% • miss=${summary.miss} • phase=${summary.phaseEnd}`;
      }
      if(ui.endGrade) ui.endGrade.textContent = summary.grade || '—';
      if(ui.endScore) ui.endScore.textContent = String(summary.scoreFinal|0);
      if(ui.endOk) ui.endOk.textContent = String(summary.ok|0);
      if(ui.endWrong) ui.endWrong.textContent = String(summary.wrong|0);

      if(ui.btnBackHub2) ui.btnBackHub2.onclick = ()=>{ location.href = hubUrl; };
      if(ui.btnReplay) ui.btnReplay.onclick = ()=>{
        try{
          const u = new URL(location.href);
          if(runMode!=='research'){
            u.searchParams.set('seed', String((Date.now() ^ (Math.random()*1e9))|0));
          }
          location.href = u.toString();
        }catch(_){ location.reload(); }
      };
      if(ui.btnCopy) ui.btnCopy.onclick = async ()=>{
        try{
          await navigator.clipboard.writeText(safeJson(summary));
        }catch(_){
          try{ prompt('Copy Summary JSON:', safeJson(summary)); }catch(__){}
        }
      };
      if(ui.btnNextCooldown){
        ui.btnNextCooldown.classList.add('is-hidden');
      }
    }
  }

  // ---------------------------
  // end conditions
  // ---------------------------
  function checkEnd(){
    if(tLeft <= 0){ showEnd('time'); return true; }
    if(runMode!=='research' && missTotal() >= TUNE.missLimit){ showEnd('miss-limit'); return true; }
    if(phase==='boss' && totalNeed()===0 && totalOver()===0){ showEnd('boss-clear'); return true; }
    return false;
  }

  // ---------------------------
  // tick
  // ---------------------------
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

    fever = clamp(fever - (phase==='boss' ? 0.95 : 0.75) * dt, 0, 100);

    aiTick(dt);

    TEL.tickAcc += dt;
    TEL.tSec = Math.max(0, Math.round(plannedSec - tLeft));
    if(TEL.tickAcc >= 1){
      TEL.tickAcc -= 1;
      emit('hha:features_1s', buildFeatures1s());
    }

    setHUD();
    maybeAdvance();
    if(checkEnd()) return;
    requestAnimationFrame(tick);
  }

  // ---------------------------
  // background / start
  // ---------------------------
  DOC.addEventListener('visibilitychange', ()=>{
    if(DOC.hidden && playing){ showEnd('background'); }
  });

  try{ WIN[END_SENT_KEY]=0; }catch(_){}
  if(!TEL.sentLabels){
    TEL.sentLabels = true;
    emit('hha:labels', buildLabels());
  }

  setPhase('warm');
  setHUD();
  requestAnimationFrame(tick);
}