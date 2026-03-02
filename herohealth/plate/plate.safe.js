// === /herohealth/plate/plate.safe.js ===
// Plate VR SAFE — PRODUCTION (Mobile-first + Classroom-friendly)
// ✅ Works with plate-vr.html (plate-layer + uiScore/uiTime/... + endOverlay)
// ✅ Deterministic RNG + hha:shoot + pause hook + end summary hardened
// ✅ Classroom mode: slower spawn, higher TTL, gentler penalties, fewer misses
// ✅ Plate 5 groups progress (unique groups collected) + accuracy
// ✅ Cooldown daily-first (per-game)
// FULL v20260302-PLATE-SAFE-LAYOUTFIX-CLASSROOM

'use strict';

export function boot(cfg){
  cfg = cfg || {};
  const WIN = window, DOC = document;

  // ---------- helpers ----------
  const qs = (k, d='')=>{ try{ return (new URL(location.href)).searchParams.get(k) ?? d; }catch(e){ return d; } };
  const clamp=(v,a,b)=>{ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b,v)); };
  const nowMs = ()=> (performance && performance.now) ? performance.now() : Date.now();
  const nowIso = ()=> new Date().toISOString();
  const safeJson = (o)=>{ try{ return JSON.stringify(o,null,2);}catch(e){ return '{}';} };
  const num = (v, fb=0)=>{ v=Number(v); return Number.isFinite(v)?v:fb; };

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

  // ---------- deterministic rng (xmur3 + sfc32) ----------
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

  // ---------- cfg / query ----------
  const view = String(cfg.view || qs('view','mobile')).toLowerCase();
  const runMode = String(cfg.run || qs('run','play')).toLowerCase();
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

  const mode = String(cfg.mode || qs('mode','classroom')).toLowerCase(); // classroom | play
  const isClassroom = (mode === 'classroom');

  // ---------- DOM (match plate-vr.html new ids) ----------
  const mount = cfg.mount || DOC.getElementById('plate-layer');
  if(!mount){ console.warn('[Plate] Missing #plate-layer'); return; }

  const ui = {
    score: DOC.getElementById('uiScore'),
    time: DOC.getElementById('uiTime'),
    miss: DOC.getElementById('uiMiss'),
    grade: DOC.getElementById('uiGrade'),
    acc: DOC.getElementById('uiAcc'),

    plateHave: DOC.getElementById('uiPlateHave'),
    goalTitle: DOC.getElementById('uiGoalTitle'),
    goalCount: DOC.getElementById('uiGoalCount'),
    goalFill: DOC.getElementById('uiGoalFill'),

    targetText: DOC.getElementById('uiTargetText'),

    shield: DOC.getElementById('uiShield'),
    fever: DOC.getElementById('uiFever'),
    feverFill: DOC.getElementById('uiFeverFill'),
    combo: DOC.getElementById('uiCombo'),
    comboMax: DOC.getElementById('uiComboMax'),

    coachMsg: DOC.getElementById('coachMsg'),

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
    btnBackHub: DOC.getElementById('btnBackHub2') || DOC.getElementById('btnBackHub'),
  };

  // ---------- Thai 5 food groups mapping (fixed) ----------
  const GROUPS = [
    { id:1, key:'g1', name:'หมู่ 1 โปรตีน', items:['🥚','🐟','🥛','🍗','🥜'] },
    { id:2, key:'g2', name:'หมู่ 2 คาร์โบไฮเดรต', items:['🍚','🍞','🥔','🍜','🥖'] },
    { id:3, key:'g3', name:'หมู่ 3 ผัก', items:['🥦','🥬','🥕','🥒','🌽'] },
    { id:4, key:'g4', name:'หมู่ 4 ผลไม้', items:['🍌','🍎','🍊','🍉','🍇'] },
    { id:5, key:'g5', name:'หมู่ 5 ไขมัน', items:['🥑','🫒','🧈','🥥','🧀'] },
  ];

  function groupForEmoji(emoji){
    for(const g of GROUPS){
      if(g.items.includes(emoji)) return g;
    }
    return null;
  }

  // ---------- Tuning ----------
  const TUNE = (function(){
    // base
    let spawnBase = 0.78;
    let ttl = 2.7;
    let missLimit = 12;

    // classroom gentle
    if(isClassroom){
      spawnBase = 0.52;
      ttl = 3.6;
      missLimit = 18;
    }

    // difficulty
    if(diff==='easy'){
      spawnBase *= 0.90;
      ttl += 0.25;
      missLimit += 3;
    }else if(diff==='hard'){
      spawnBase *= 1.20;
      ttl -= 0.25;
      missLimit -= 3;
    }

    if(view==='cvr'||view==='vr') ttl += 0.15;

    // correctness ratio
    const pCorrect = isClassroom ? 0.80 : 0.68;

    // penalties
    const penWrong = isClassroom ? 4 : 8;
    const penExpire = isClassroom ? 2 : 4;

    return { spawnBase, ttl, missLimit, pCorrect, penWrong, penExpire };
  })();

  // ---------- spawn-safe inside mount padding ----------
  function mountRect(){ return mount.getBoundingClientRect(); }
  function getPadPx(){
    const cs = getComputedStyle(mount);
    const pt = num(parseFloat(cs.paddingTop), 0);
    const pb = num(parseFloat(cs.paddingBottom), 0);
    const pl = num(parseFloat(cs.paddingLeft), 0);
    const pr = num(parseFloat(cs.paddingRight), 0);
    return { pt,pb,pl,pr };
  }
  function spawnPoint(){
    const r = mountRect();
    const pad = getPadPx();
    const edge = (view==='mobile') ? 18 : 22;
    const w = Math.max(1, r.width);
    const h = Math.max(1, r.height);

    const xMin = pad.pl + edge;
    const xMax = w - pad.pr - edge;
    const yMin = pad.pt + edge;
    const yMax = h - pad.pb - edge;

    const x = xMin + r01() * Math.max(1, xMax - xMin);
    const y = yMin + r01() * Math.max(1, yMax - yMin);
    return { x, y };
  }

  // ---------- state ----------
  const startTimeIso = nowIso();
  let playing = true;
  let paused = false;
  let tLeft = plannedSec;
  let lastTick = nowMs();

  WIN.__PLATE_SET_PAUSED__ = (on)=>{ paused=!!on; lastTick=nowMs(); };

  let score = 0;
  let miss = 0;
  let ok = 0;
  let wrong = 0;
  let shots = 0; // (ok+wrong) hits only
  let combo = 0;
  let bestCombo = 0;

  // “plate progress” = unique groups collected correctly
  const plateSet = new Set(); // store group.id
  let targetGroup = pick(GROUPS);

  // fever/shield (simple)
  let fever = 0;      // 0..100
  let shield = 0;     // 0..5

  // targets
  const foods = new Map();
  let idSeq = 1;

  // ---------- ui helpers ----------
  function sayCoach(msg){
    if(ui.coachMsg) ui.coachMsg.textContent = String(msg || '');
    try{
      WIN.dispatchEvent(new CustomEvent('hha:coach', { detail: { mood:'neutral', msg:String(msg||'') } }));
    }catch(e){}
  }

  function gradeFromScore(s){
    const played = Math.max(1, plannedSec - tLeft);
    const sps = s / played;
    const x = sps*10 - miss*(isClassroom ? 0.25 : 0.5);
    if(x>=70) return 'S';
    if(x>=55) return 'A';
    if(x>=40) return 'B';
    if(x>=28) return 'C';
    return 'D';
  }

  function accPct(){
    const denom = Math.max(1, shots);
    return Math.round((ok / denom) * 100);
  }

  function setHUD(){
    if(ui.score) ui.score.textContent = String(score|0);
    if(ui.time) ui.time.textContent = String(Math.ceil(tLeft));
    if(ui.miss) ui.miss.textContent = String(miss|0);
    if(ui.grade) ui.grade.textContent = gradeFromScore(score);
    if(ui.acc) ui.acc.textContent = `${accPct()}%`;

    const have = plateSet.size;
    if(ui.plateHave) ui.plateHave.textContent = String(have);
    if(ui.goalTitle) ui.goalTitle.textContent = 'เติมจาน';
    if(ui.goalCount) ui.goalCount.textContent = `${have}/5`;
    if(ui.goalFill) ui.goalFill.style.width = `${clamp((have/5)*100,0,100)}%`;

    if(ui.targetText) ui.targetText.textContent = targetGroup?.name || '—';

    if(ui.shield) ui.shield.textContent = String(shield|0);
    if(ui.fever) ui.fever.textContent = `${Math.round(clamp(fever,0,100))}%`;
    if(ui.feverFill) ui.feverFill.style.width = `${clamp(fever,0,100)}%`;

    if(ui.combo) ui.combo.textContent = String(combo|0);
    if(ui.comboMax) ui.comboMax.textContent = String(bestCombo|0);
  }

  function addFever(v){
    fever = clamp(fever + v, 0, 100);
  }
  function addShield(){
    shield = clamp(shield + 1, 0, 5);
  }

  // ---------- create/remove targets ----------
  function makeFood(kind, emoji, ttlSec){
    const id = String(idSeq++);
    const el = DOC.createElement('div');
    el.className = 'plateTarget';
    el.textContent = emoji;
    el.dataset.id = id;
    el.dataset.kind = kind; // 'food' | 'wrong'
    const p = spawnPoint();
    el.style.left = `${p.x}px`;
    el.style.top  = `${p.y}px`;
    mount.appendChild(el);

    const born = nowMs();
    const ttl = Math.max(1.0, ttlSec) * 1000;
    const obj = { id, el, kind, emoji, born, ttl, promptMs: nowMs() };
    foods.set(id, obj);

    try{ cfg.ai?.onSpawn?.(kind, { id, emoji, ttlSec }); }catch(e){}
    return obj;
  }

  function removeFood(id){
    const f = foods.get(String(id));
    if(!f) return;
    foods.delete(String(id));
    try{ f.el.remove(); }catch(e){}
  }

  function isCorrect(emoji){
    return (targetGroup?.items || []).includes(emoji);
  }

  function rotateTargetGroup(){
    // classroom: rotate slower (every 2 correct items)
    const need = isClassroom ? 2 : 1;
    if(plateSet.size >= 5) return;
    if((ok % need) === 0){
      // choose next missing group if possible (friendly)
      const missing = GROUPS.filter(g=>!plateSet.has(g.id));
      if(missing.length) targetGroup = pick(missing);
      else targetGroup = pick(GROUPS);
    }
  }

  function onHitFood(f){
    if(!playing || paused) return;

    shots++;

    const correct = (f.kind === 'food') && isCorrect(f.emoji);

    if(correct){
      ok++;
      combo++;
      bestCombo = Math.max(bestCombo, combo);

      // scoring (gentle for classroom)
      let add = (isClassroom ? 10 : 12) + Math.min(10, combo);
      // fever bonus
      if(fever >= 80) add = Math.round(add * 1.25);
      score += add;

      // plate progress
      const g = groupForEmoji(f.emoji);
      if(g) plateSet.add(g.id);

      addFever(isClassroom ? 5.5 : 7.0);

      // tiny reward: sometimes shield
      if(isClassroom && r01() < 0.06) addShield();

      rotateTargetGroup();

      try{ cfg.ai?.onHit?.('food_ok', { id:f.id, emoji:f.emoji }); }catch(e){}
    }else{
      wrong++;
      miss++;
      combo = 0;

      // shield can block 1 wrong hit (classroom-friendly)
      if(isClassroom && shield > 0){
        shield--;
        // do not penalize score/miss extra (already miss counted)
        sayCoach('บล็อกได้! ลองดู “หมู่ที่โจทย์บอก” นะ');
      }else{
        score = Math.max(0, score - TUNE.penWrong);
        addFever(-8);
        sayCoach('อันนี้ยังไม่ตรงหมู่ ลองดูโจทย์ด้านบน 🎯');
      }

      try{ cfg.ai?.onHit?.('food_wrong', { id:f.id, emoji:f.emoji }); }catch(e){}
    }

    removeFood(f.id);
  }

  // pc/mobile pointer hits
  mount.addEventListener('pointerdown', (ev)=>{
    if(!playing || paused) return;
    const el = ev.target?.closest?.('.plateTarget');
    if(!el) return;
    const id = el.dataset.id;
    const f = foods.get(String(id));
    if(f) onHitFood(f);
  }, { passive:true });

  // VR/cVR crosshair shoot
  function pickClosestToCenter(lockPx){
    lockPx = clamp(lockPx ?? 56, 16, 160);
    const r = mountRect();
    const cx = r.left + r.width/2;
    const cy = r.top  + r.height/2;

    let best=null, bestD=1e9;
    for(const f of foods.values()){
      const b = f.el.getBoundingClientRect();
      const fx = b.left + b.width/2;
      const fy = b.top  + b.height/2;
      const d = Math.hypot(fx-cx, fy-cy);
      if(d < bestD){ bestD = d; best = f; }
    }
    if(best && bestD <= lockPx) return best;
    return null;
  }

  WIN.addEventListener('hha:shoot', (ev)=>{
    if(!playing || paused) return;
    const lockPx = ev?.detail?.lockPx ?? 56;
    const f = pickClosestToCenter(lockPx);
    if(f) onHitFood(f);
  });

  // ---------- end summary hardened ----------
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
      gameVersion: 'PlateVR_SAFE_2026-03-02_LAYOUTFIX_CLASSROOM',
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
      accuracyOkPct: accPct(),
      comboMax: bestCombo|0,
      plateHave: plateSet.size,
      plateSet: Array.from(plateSet),
      targetGroup: targetGroup?.name || '—',
      feverPct: Math.round(clamp(fever,0,100)),
      shield: shield|0,
      startTimeIso,
      endTimeIso: nowIso(),
      grade: gradeFromScore(score),
      aiPredictionLast: (function(){ try{ return cfg.ai?.getPrediction?.() || null; }catch(e){ return null; } })()
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
        ui.btnNextCooldown.onclick = ()=>{ location.href = url; };
      }
    }
    if(ui.btnBackHub){
      ui.btnBackHub.onclick = ()=>{ location.href = hubUrl; };
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
          await navigator.clipboard.writeText(safeJson(summary));
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

    // AI onEnd
    try{
      const aiEnd = cfg.ai?.onEnd?.(summary);
      if(aiEnd) summary.aiEnd = aiEnd;
    }catch(e){}

    WIN.__HHA_LAST_SUMMARY = summary;
    dispatchEndOnce(summary);

    if(ui.endOverlay){
      ui.endOverlay.setAttribute('aria-hidden','false');
      ui.endTitle && (ui.endTitle.textContent = 'จบเกม');
      ui.endSub && (ui.endSub.textContent = `reason=${summary.reason} | mode=${runMode}/${mode} | view=${view} | seed=${seedStr}`);
      ui.endGrade && (ui.endGrade.textContent = summary.grade || '—');
      ui.endScore && (ui.endScore.textContent = String(summary.scoreFinal|0));
      ui.endOk && (ui.endOk.textContent = String(summary.ok|0));
      ui.endWrong && (ui.endWrong.textContent = String(summary.wrong|0));
      setEndButtons(summary);
    }
  }

  // ---------- spawn/update loops ----------
  let spawnAcc = 0;

  function spawnTick(dt){
    spawnAcc += TUNE.spawnBase * dt;
    while(spawnAcc >= 1){
      spawnAcc -= 1;

      const wantCorrect = (r01() < TUNE.pCorrect);

      let emoji = '🍚';
      let kind = 'food';

      if(wantCorrect){
        emoji = pick(targetGroup.items);
        kind = 'food';
      }else{
        const others = GROUPS.filter(g=>g.id!==targetGroup.id);
        emoji = pick(pick(others).items);
        kind = 'wrong'; // ✅ style red-ish
      }

      makeFood(kind, emoji, TUNE.ttl);
    }
  }

  function updateFoods(){
    const t=nowMs();
    for(const f of Array.from(foods.values())){
      const age = t - f.born;
      if(age >= f.ttl){
        try{ cfg.ai?.onExpire?.(f.kind, { id:f.id, emoji:f.emoji }); }catch(e){}
        miss++;
        // expire counts as wrong (gentle penalty)
        wrong++;
        combo=0;
        score = Math.max(0, score - TUNE.penExpire);
        addFever(-4);
        removeFood(f.id);

        if(isClassroom && miss===1) sayCoach('ไม่เป็นไร ลองแตะให้ไวขึ้นนิดนึง 😊');
      }
    }
  }

  function checkEnd(){
    if(tLeft<=0){ showEnd('time'); return true; }
    if(miss>=TUNE.missLimit){ showEnd('miss-limit'); return true; }

    // win condition (plate complete)
    if(plateSet.size >= 5){
      // give bonus then end
      score += isClassroom ? 80 : 120;
      addFever(30);
      showEnd('plate-complete');
      return true;
    }
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

    tLeft=Math.max(0, tLeft - dt);

    spawnTick(dt);
    updateFoods();

    // AI tick (optional)
    try{
      cfg.ai?.onTick?.(dt, { miss, ok, wrong, combo, plateHave: plateSet.size });
    }catch(e){}

    setHUD();

    if(checkEnd()) return;
    requestAnimationFrame(tick);
  }

  DOC.addEventListener('visibilitychange', ()=>{
    if(DOC.hidden && playing){ showEnd('background'); }
  });

  // init
  try{ WIN[END_SENT_KEY]=0; }catch(e){}
  sayCoach(isClassroom ? 'โหมดห้องเรียน: ช้าลง เล่นง่ายขึ้น 😊' : 'พร้อมลุย! เติมจานให้ครบ 5 หมู่ 💪');
  setHUD();
  requestAnimationFrame(tick);
}