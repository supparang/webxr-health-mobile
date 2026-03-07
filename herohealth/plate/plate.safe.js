// === /herohealth/plate/plate.safe.js ===
// PlateVR SAFE — Classroom Combat Edition (FX + Mission 3-Stage + PRO + HUD-safe spawn)
// FULL v20260307-PLATE-SOLO-FINAL
'use strict';

export function boot(cfg){
  cfg = cfg || {};
  const WIN = window, DOC = document;

  const clamp=(v,a,b)=>{ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b,v)); };
  const nowMs = ()=> (performance && performance.now) ? performance.now() : Date.now();
  const nowIso = ()=> new Date().toISOString();
  const safeJson = (o)=>{ try{ return JSON.stringify(o,null,2);}catch(_){return '{}';} };
  const qs = (k, d='')=>{ try{ return (new URL(location.href)).searchParams.get(k) ?? d; }catch(_){ return d; } };

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
      'plannedGame','finalGame','zone','cdnext','grade'
    ].forEach(k=>{
      const v=sp.get(k);
      if(v!=null && v!=='') gate.searchParams.set(k,v);
    });
    return gate.toString();
  }

  function savePlateProgress(summary){
    try{
      const pidNow = String(pid || qs('pid','anon')).trim() || 'anon';
      const diffNow = String(diff || qs('diff','normal') || 'normal');
      const day = hhDayKey();

      const payload = {
        game: 'plate',
        pid: pidNow,
        diff: diffNow,
        atISO: new Date().toISOString(),
        summary: summary || null
      };

      localStorage.setItem(`HHA_PLATE_LAST:${pidNow}`, JSON.stringify(payload));

      const bestKey = `HHA_PLATE_BEST:${pidNow}:${diffNow}`;
      const prevBest = JSON.parse(localStorage.getItem(bestKey) || 'null');
      const prevScore = Number(prevBest?.summary?.scoreFinal || 0);
      const nowScore = Number(summary?.scoreFinal || 0);

      if(!prevBest || nowScore >= prevScore){
        localStorage.setItem(bestKey, JSON.stringify(payload));
      }

      localStorage.setItem(`HHA_PLATE_DONE:${pidNow}:${day}`, '1');
      localStorage.setItem(`HHA_ZONE_DONE::nutrition::${day}`, '1');

      return true;
    }catch(_){
      return false;
    }
  }

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

  const HH_CAT='nutrition';
  const HH_GAME='plate';
  const cooldownRequired = !!cfg.cooldown || (qs('cooldown','0')==='1') || (qs('cd','0')==='1');

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

  const GROUPS = [
    { id:1, key:'g1', name:'หมู่ 1 โปรตีน', items:['🥚','🐟','🥛','🍗','🥜'] },
    { id:2, key:'g2', name:'หมู่ 2 คาร์โบไฮเดรต', items:['🍚','🍞','🥔','🍜','🥖'] },
    { id:3, key:'g3', name:'หมู่ 3 ผัก', items:['🥦','🥬','🥕','🥒','🌽'] },
    { id:4, key:'g4', name:'หมู่ 4 ผลไม้', items:['🍌','🍎','🍊','🍉','🍇'] },
    { id:5, key:'g5', name:'หมู่ 5 ไขมัน', items:['🥑','🫒','🧈','🥥','🧀'] },
  ];
  const groupByEmoji = new Map();
  for(const g of GROUPS) for(const e of g.items) groupByEmoji.set(e, g);

  const TUNE = (function(){
    let spawnPerSec = 1.05;
    let ttl = 2.85;
    let wrongRatio = 0.22;
    let shieldRate = 0.035;
    let missLimit = 18;
    if(diff==='easy'){ spawnPerSec=0.95; ttl=3.10; wrongRatio=0.18; shieldRate=0.045; missLimit=22; }
    if(diff==='hard'){ spawnPerSec=1.15; ttl=2.60; wrongRatio=0.26; shieldRate=0.030; missLimit=14; }
    if(view==='cvr'||view==='vr'){ ttl += 0.20; }
    if(view==='mobile'){ ttl += 0.18; missLimit += 2; }

    if(PRO){
      spawnPerSec *= 1.18;
      ttl = Math.max(2.10, ttl - 0.30);
      wrongRatio = Math.min(0.34, wrongRatio + 0.06);
      shieldRate = Math.min(0.055, shieldRate + 0.010);
      missLimit = Math.max(10, missLimit - 3);
    }

    if(runMode==='research'){
      spawnPerSec = Math.min(spawnPerSec, 1.10);
    }

    return { spawnPerSec, ttl, wrongRatio, shieldRate, missLimit };
  })();

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
  let phaseNeed=10;
  let phaseProg=0;
  let targetGroup = pick(GROUPS);

  const ents = new Map();
  let idSeq=1;

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

    const hudTop = DOC.getElementById('hudTop');
    const hudBottom = DOC.getElementById('hudBottom');
    const rt = rectOf(hudTop);
    const rb = rectOf(hudBottom);

    if(rt && intersect(r, rt)){
      top = Math.max(top, rt.bottom + (view === 'mobile' ? 14 : 10));
    }
    if(rb && intersect(r, rb)){
      bottom = Math.min(bottom, rb.top - (view === 'mobile' ? 12 : 10));
    }

    if(bottom - top < 140){
      top = r.top + pad + 70;
      bottom = r.bottom - pad - 40;
    }

    return { left, right, top, bottom, width: Math.max(1, right-left), height: Math.max(1, bottom-top) };
  }

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
    try{
      WIN.dispatchEvent(new CustomEvent('hha:coach', { detail:{ msg, mood } }));
      WIN.dispatchEvent(new CustomEvent('hha:coach', { detail:{ text: msg, mood } }));
    }catch(_){}
  }

  function fxHit(el){
    if(!el) return;
    el.style.transform = 'translate(-50%,-50%) scale(1.12)';
    el.style.boxShadow = '0 0 24px rgba(34,197,94,.75)';
    setTimeout(()=>{ el.style.transform='translate(-50%,-50%)'; el.style.boxShadow=''; }, 120);
  }
  function fxWrong(el){
    if(!el) return;
    el.style.animation = 'shake .25s';
    el.style.borderColor = 'rgba(239,68,68,.8)';
    setTimeout(()=>{ el.style.animation=''; el.style.borderColor=''; }, 250);
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

  function missTotal(){ return (missExpire + missWrong); }

  function accuracyPct(){
    const shots = ok + wrong;
    if(shots <= 0) return 0;
    return Math.round((ok / shots) * 100);
  }

  function gradeFrom(){
    const acc = accuracyPct();
    const m = missTotal();
    const base = score;
    const x = (base * 0.10) + (acc * 0.85) - (m * 1.2);
    if(x >= 92) return 'S';
    if(x >= 78) return 'A';
    if(x >= 62) return 'B';
    if(x >= 45) return 'C';
    return 'D';
  }

  function balancePct(){
    const have = ['g1','g2','g3','g4','g5'].map(k => Number(plateCount[k] || 0));
    const total = have.reduce((a,b)=>a+b,0);
    if(total <= 0) return 0;
    const max = Math.max(...have);
    const min = Math.min(...have);
    const spreadPenalty = max - min;
    const uniq = have.filter(v=>v>0).length;
    const base = Math.round((uniq / 5) * 100);
    return clamp(base - spreadPenalty * 8, 0, 100);
  }

  function totalNeed(){
    const need = PRO ? 3 : 2;
    let x = 0;
    for(const k of ['g1','g2','g3','g4','g5']){
      x += Math.max(0, need - Number(plateCount[k] || 0));
    }
    return x;
  }

  function totalOver(){
    const need = PRO ? 3 : 2;
    let x = 0;
    for(const k of ['g1','g2','g3','g4','g5']){
      x += Math.max(0, Number(plateCount[k] || 0) - need);
    }
    return x;
  }

  function emitQuestState(){
    try{
      WIN.dispatchEvent(new CustomEvent('quest:update', { detail:{
        goalTitle: phase === 'boss' ? 'BOSS: จัดจานให้สมดุล' : `Phase: ${String(phase).toUpperCase()}`,
        goalNow: phaseProg|0,
        goalTotal: phaseNeed|0,
        groupName: targetGroup?.name || '—'
      }}));
    }catch(_){}
  }

  function setHUD(){
    if(ui.score) ui.score.textContent = String(score|0);
    if(ui.combo) ui.combo.textContent = String(combo|0);
    if(ui.comboMax) ui.comboMax.textContent = String(comboMax|0);
    if(ui.miss) ui.miss.textContent = String(missTotal()|0);
    if(ui.time) ui.time.textContent = String(Math.ceil(tLeft));
    if(ui.acc) ui.acc.textContent = `${accuracyPct()}%`;
    if(ui.grade) ui.grade.textContent = gradeFrom();
    if(ui.shield) ui.shield.textContent = String(shield|0);

    let have=0;
    for(const k of ['g1','g2','g3','g4','g5']) if((plateCount[k]||0)>0) have++;
    if(ui.plateHave) ui.plateHave.textContent = String(have);
    if(ui.g1) ui.g1.textContent = String(plateCount.g1|0);
    if(ui.g2) ui.g2.textContent = String(plateCount.g2|0);
    if(ui.g3) ui.g3.textContent = String(plateCount.g3|0);
    if(ui.g4) ui.g4.textContent = String(plateCount.g4|0);
    if(ui.g5) ui.g5.textContent = String(plateCount.g5|0);

    if(ui.phase) ui.phase.textContent = String(phase||'warm').toUpperCase();
    if(ui.phaseProg) ui.phaseProg.textContent = `${phaseProg|0}/${phaseNeed|0}`;

    const pct = Math.round((phaseProg / Math.max(1, phaseNeed)) * 100);
    if(ui.goalFill) ui.goalFill.style.width = `${clamp(pct,0,100)}%`;

    if(ui.targetText){
      if(phase==='boss'){
        ui.targetText.textContent = `BOSS: เติมให้ครบ 5 หมู่ (อย่างน้อย ${PRO ? 3 : 2} ต่อหมู่)`;
      }else{
        ui.targetText.textContent = `ยิง “${targetGroup.name}”`;
      }
    }

    if(ui.fever) ui.fever.textContent = `${Math.round(clamp(fever,0,100))}%`;
    if(ui.feverFill) ui.feverFill.style.width = `${Math.round(clamp(fever,0,100))}%`;

    emitQuestState();

    try{
      WIN.dispatchEvent(new CustomEvent('hha:score', { detail:{
        score, combo, comboMax,
        miss: missTotal(),
        misses: missTotal(),
        accPct: accuracyPct(),
        feverPct: Math.round(clamp(fever,0,100)),
        shield
      }}));
    }catch(_){}
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

  function setPhase(p){
    phase = p;
    phaseProg = 0;

    if(phase==='warm'){
      phaseNeed = PRO ? 12 : 10;
      targetGroup = pick(GROUPS);
      banner('WARM UP 🔥');
      coachSay('WARM: ยิงหมู่เป้าหมายชัด ๆ เก็บคอมโบก่อน', 'happy');
    }
    if(phase==='trick'){
      phaseNeed = PRO ? 18 : 16;
      targetGroup = pick(GROUPS);
      banner('TRICK MODE ⚡');
      coachSay('TRICK: เริ่มมีตัวหลอก สังเกตหมู่ให้ดี', 'neutral');
    }
    if(phase==='boss'){
      phaseNeed = 10;
      banner('BOSS PLATE 👑');
      coachSay('BOSS: เติมจานให้ครบ 5 หมู่แบบสมดุล!', 'fever');
    }

    emitQuestState();
  }

  function bossCleared(){
    const need = PRO ? 3 : 2;
    return ['g1','g2','g3','g4','g5'].every(k => (plateCount[k]||0) >= need);
  }

  function maybeAdvance(){
    if(phase==='warm' && phaseProg >= phaseNeed){
      setPhase('trick');
      return;
    }
    if(phase==='trick' && phaseProg >= phaseNeed){
      setPhase('boss');
      return;
    }
    if(phase==='boss'){
      if(bossCleared()){
        showEnd('boss-clear');
      }
    }
  }

  const stats = {
    wrongHit:0,
    expireGood:0,
    expireShield:0
  };

  function explainTop2(){
    const arr = [
      { k:'เล็งช้า (เป้าหมดเวลา)', v: stats.expireGood },
      { k:'สับสนหมู่ (ยิงผิด)', v: stats.wrongHit },
      { k:'พลาดจังหวะ (คอมโบหลุด)', v: Math.max(0, (comboMax>=6 ? (comboMax - combo) : 0)) }
    ].sort((a,b)=>b.v-a.v);
    return arr.filter(x=>x.v>0).slice(0,2).map(x=>x.k);
  }

  function onCorrectHit(ent, cx, cy){
    ok++;
    combo++;
    comboMax = Math.max(comboMax, combo);

    fever = clamp(fever + (combo>=6 ? 3.2 : 2.0), 0, 100);

    const base = 12;
    const add = base + Math.min(12, combo);
    score += add;

    fxHit(ent.el);
    popText(`+${add}`, cx, cy);

    const g = groupByEmoji.get(ent.emoji);
    if(g) plateCount[g.key] = (plateCount[g.key]||0) + 1;

    if(phase!=='boss'){
      if(groupByEmoji.get(ent.emoji)?.id === targetGroup.id){
        phaseProg++;
        if(phase==='trick' && (phaseProg % 5 === 0)){
          targetGroup = pick(GROUPS.filter(x=>x.id!==targetGroup.id));
          coachSay(`สลับหมู่! ต่อไปยิง “${targetGroup.name}”`, 'neutral');
        }
      }else{
        score = Math.max(0, score - 2);
        coachSay('ถูกอาหาร แต่ “ไม่ใช่หมู่เป้าหมาย” ลองดูภารกิจ 👀', 'neutral');
      }
    }else{
      phaseProg++;
    }

    try{ cfg.ai?.onHit?.('food_ok', { id: ent.id, phase, combo, score }); }catch(_){}
    removeTarget(ent.id);

    maybeAdvance();
  }

  function applyShieldIfAny(){
    if(shield > 0){
      shield--;
      fever = clamp(fever + 8, 0, 100);
      coachSay('🛡️ Shield ช่วยกันพลาด 1 ครั้ง!', 'happy');
      return true;
    }
    return false;
  }

  function onWrongHit(ent, cx, cy){
    wrong++;
    stats.wrongHit++;
    missWrong++;

    if(applyShieldIfAny()){
      fxWrong(ent.el);
      popText('🛡️ BLOCK', cx, cy);
    }else{
      combo = 0;
      fever = clamp(fever - 10, 0, 100);
      score = Math.max(0, score - (PRO ? 10 : 8));
      fxWrong(ent.el);
      popText('−', cx, cy);
    }

    try{ cfg.ai?.onHit?.('food_wrong', { id: ent.id, phase, combo, score }); }catch(_){}
    removeTarget(ent.id);

    if(wrong % 4 === 0){
      const top2 = explainTop2();
      coachSay(`ระวัง! เสี่ยงเพราะ: ${top2.length?top2.join(', '):'ยิงเร็วไป'}`, 'sad');
    }

    maybeAdvance();
  }

  function onShieldHit(ent, cx, cy){
    shield = clamp(shield + 1, 0, 6);
    score += 6;
    fxHit(ent.el);
    popText('+Shield', cx, cy);
    try{ cfg.ai?.onHit?.('shield', { id: ent.id, shield }); }catch(_){}
    removeTarget(ent.id);
  }

  function isCorrectForMission(ent){
    if(ent.kind!=='food') return false;
    const g = groupByEmoji.get(ent.emoji);
    if(!g) return false;
    if(phase==='boss') return true;
    return (g.id === targetGroup.id);
  }

  function onHit(ent, cx, cy){
    if(ent.kind==='shield'){
      onShieldHit(ent, cx, cy);
      return;
    }

    const correct = isCorrectForMission(ent);
    if(correct) onCorrectHit(ent, cx, cy);
    else onWrongHit(ent, cx, cy);
  }

  layer.addEventListener('pointerdown', (ev)=>{
    if(!playing || paused) return;
    const el = ev.target?.closest?.('.plateTarget');
    if(!el) return;
    const id = el.dataset.id;
    const ent = ents.get(String(id));
    if(ent) onHit(ent, ev.clientX, ev.clientY);
  }, { passive:true });

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

  function nextFoodEmoji(isMission){
    if(phase==='boss'){
      const need = PRO ? 3 : 2;
      const lacks = GROUPS.filter(g => (plateCount[g.key]||0) < need);
      const g = (lacks.length>0) ? pick(lacks) : pick(GROUPS);
      return pick(g.items);
    }

    if(isMission){
      return pick(targetGroup.items);
    }

    const others = GROUPS.filter(g=>g.id!==targetGroup.id);
    return pick(pick(others).items);
  }

  function spawnOne(){
    const shieldChance = TUNE.shieldRate + (phase==='boss' ? 0.010 : (phase==='trick' ? 0.006 : 0));
    if(r01() < shieldChance){
      makeTarget('shield', '🛡️', Math.max(1.4, TUNE.ttl - 0.6));
      return;
    }

    const wrongChance = (phase==='warm') ? TUNE.wrongRatio
                      : (phase==='trick') ? Math.min(0.40, TUNE.wrongRatio + 0.08)
                      : Math.min(0.32, TUNE.wrongRatio - 0.02);

    const mission = (r01() >= wrongChance);
    const emoji = nextFoodEmoji(mission);
    makeTarget('food', emoji, TUNE.ttl);
  }

  let spawnAcc = 0;
  function spawnTick(dt){
    const rate = (phase==='boss') ? (TUNE.spawnPerSec * (PRO ? 1.10 : 1.02))
               : (phase==='trick') ? (TUNE.spawnPerSec * (PRO ? 1.06 : 1.00))
               : TUNE.spawnPerSec;

    spawnAcc += rate * dt;
    while(spawnAcc >= 1){
      spawnAcc -= 1;
      spawnOne();
    }
  }

  function updateExpire(){
    const t = nowMs();
    for(const ent of Array.from(ents.values())){
      const age = t - ent.born;
      if(age >= ent.ttl){
        if(ent.kind==='food'){
          stats.expireGood++;
          missExpire++;

          if(applyShieldIfAny()){
          }else{
            combo = 0;
            fever = clamp(fever - 8, 0, 100);
            score = Math.max(0, score - (PRO ? 6 : 4));
          }
        }else{
          stats.expireShield++;
        }

        try{ cfg.ai?.onExpire?.(ent.kind, { id:ent.id, phase }); }catch(_){}
        fxExpire(ent.el);
        removeTarget(ent.id);
      }
    }
  }

  const END_SENT_KEY='__HHA_PLATE_END_SENT__';
  function dispatchEndOnce(summary){
    try{
      if(WIN[END_SENT_KEY]) return;
      WIN[END_SENT_KEY]=1;
      WIN.dispatchEvent(new CustomEvent('hha:game-ended', { detail: summary || null }));
      WIN.dispatchEvent(new CustomEvent('hha:end', { detail: summary || null }));
    }catch(_){}
  }

  function buildSummary(reason){
    const summary = {
      schema: "HHA_SESSION_SUMMARY_V2",
      game: "plate",
      gameVersion: "v20260307-PLATE-SOLO-FINAL",
      sessionId: `plate-${pid}-${seedStr}`,
      pid,
      runMode,
      diff,
      view,
      pro: !!PRO,
      seed: seedStr,

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
      grade: gradeFrom(),

      phaseEnd: phase,
      phaseProg: phaseProg|0,

      shield: shield|0,
      feverPct: Math.round(clamp(fever,0,100)),

      plateCount: { ...plateCount },

      hubUrl: String(hubUrl || qs('hub','../hub.html') || '../hub.html'),
      cooldownRequired: cooldownRequired ? 1 : 0,
      cooldownDoneToday: cooldownDone(HH_CAT, HH_GAME, pid) ? 1 : 0,

      plate_balancePct: balancePct(),
      plate_have: ['g1','g2','g3','g4','g5'].filter(k => (plateCount[k]||0)>0).length,
      plate_overTotal: totalOver(),
      plate_needTotal: totalNeed(),

      bossCleared: reason === 'boss-clear' ? 1 : 0,

      startTimeIso,
      endTimeIso: nowIso(),

      aiPredictionLast: (function(){ try{ return cfg.ai?.getPrediction?.() || null; }catch(_){ return null; } })()
    };

    const top2 = explainTop2();
    summary.aiExplainTop2 = top2;
    return summary;
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
        const url = buildCooldownUrl({
          hub: hubUrl,
          nextAfterCooldown,
          cat: HH_CAT,
          gameKey: HH_GAME,
          pid
        });
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

    for(const ent of ents.values()){ try{ ent.el.remove(); }catch(_){} }
    ents.clear();

    const summary = buildSummary(reason);

    try{
      const aiEnd = cfg.ai?.onEnd?.(summary);
      if(aiEnd) summary.aiEnd = aiEnd;
    }catch(_){}

    try{
      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify({
        game:'plate',
        pid,
        atISO:new Date().toISOString(),
        summary
      }));
      localStorage.setItem(`HHA_LAST_SUMMARY:plate:${pid}`, JSON.stringify({
        game:'plate',
        pid,
        atISO:new Date().toISOString(),
        summary
      }));

      const hist = JSON.parse(localStorage.getItem('HHA_SUMMARY_HISTORY') || '[]');
      hist.unshift({
        game:'plate',
        pid,
        atISO:new Date().toISOString(),
        summary
      });
      localStorage.setItem('HHA_SUMMARY_HISTORY', JSON.stringify(hist.slice(0,40)));
    }catch(_){}

    try{ savePlateProgress(summary); }catch(_){}

    WIN.__HHA_LAST_SUMMARY = summary;
    dispatchEndOnce(summary);

    if(summary.aiExplainTop2 && summary.aiExplainTop2.length){
      coachSay(`สรุป: เสี่ยงเพราะ ${summary.aiExplainTop2.join(', ')}`, 'neutral');
    }else{
      coachSay('สรุป: ดีมาก! ลอง PRO=1 เพิ่มความท้าทาย 🔥', 'happy');
    }

    if(ui.endOverlay){
      ui.endOverlay.setAttribute('aria-hidden','false');
      if(ui.endTitle) ui.endTitle.textContent = 'RESULT';

      const cdText = cooldownRequired
        ? (cooldownDone(HH_CAT, HH_GAME, pid) ? 'cooldown=done' : 'cooldown=needed')
        : 'cooldown=off';

      ui.endSub && (ui.endSub.textContent =
        `score=${summary.scoreFinal} · acc=${summary.accuracyPct}% · boss=${summary.reason === 'boss-clear' ? 'clear' : 'done'} · ${cdText}`);

      if(ui.endGrade) ui.endGrade.textContent = summary.grade || '—';
      if(ui.endScore) ui.endScore.textContent = String(summary.scoreFinal|0);
      if(ui.endOk) ui.endOk.textContent = String(summary.ok|0);
      if(ui.endWrong) ui.endWrong.textContent = String(summary.wrong|0);

      setEndButtons(summary);
    }
  }

  function checkEnd(){
    if(tLeft<=0){ showEnd('time'); return true; }
    if(runMode!=='research' && missTotal() >= TUNE.missLimit){ showEnd('miss-limit'); return true; }
    if(phase==='boss' && bossCleared()){ showEnd('boss-clear'); return true; }
    return false;
  }

  function aiTick(dt){
    try{
      const pred = cfg.ai?.onTick?.(dt, {
        score, ok, wrong, miss: missTotal(), combo, shield, fever, phase
      }) || null;

      if(pred && typeof pred.hazardRisk === 'number'){
        if(pred.hazardRisk >= 0.82 && (missTotal()%3===0)){
          coachSay('AI เตือน: ระวังพลาดติดกัน—หายใจลึก ๆ แล้วเล็งก่อนยิง', 'sad');
        }
      }
    }catch(_){}
  }

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

    fever = clamp(fever - (phase==='boss' ? 0.9 : 0.75) * dt, 0, 100);

    aiTick(dt);

    setHUD();
    if(checkEnd()) return;
    requestAnimationFrame(tick);
  }

  DOC.addEventListener('visibilitychange', ()=>{
    if(DOC.hidden && playing){ showEnd('background'); }
  });

  try{ WIN[END_SENT_KEY]=0; }catch(_){}
  setPhase('warm');
  setHUD();
  requestAnimationFrame(tick);
}