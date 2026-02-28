// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR SAFE — PRODUCTION
// ✅ Works with /herohealth/plate/plate-vr.html (ids: plate-layer, uiScore...)
// ✅ ESM + hha:shoot + deterministic + AI hooks wired + end summary hardened + cooldown daily-first
// FULL v20260228-PLATE-SAFE-AIWIRED-PATCH-HTMLMAP
'use strict';

export function boot(arg){
  // รองรับทั้งแบบ boot(cfg) และ boot({mount,cfg,ai})
  let cfg = arg || {};
  let mount = null;
  let ai = null;

  if (cfg && (cfg.mount || cfg.cfg || cfg.ai)){
    mount = cfg.mount || null;
    ai = cfg.ai || (cfg.cfg && cfg.cfg.ai) || null;
    cfg = cfg.cfg || cfg; // flatten
  } else {
    ai = cfg.ai || null;
  }

  const WIN = window, DOC = document;

  const qs = (k, d='')=>{ try{ return (new URL(location.href)).searchParams.get(k) ?? d; }catch(e){ return d; } };
  const clamp=(v,a,b)=>{ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b,v)); };
  const nowMs = ()=> (performance && performance.now) ? performance.now() : Date.now();
  const nowIso = ()=> new Date().toISOString();
  const safeJson = (o)=>{ try{ return JSON.stringify(o,null,2);}catch(e){return '{}';} };

  // --- cooldown helpers (per-game daily) ---
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

  const view = String(cfg.view || qs('view','mobile')).toLowerCase();
  const runMode = String(cfg.runMode || cfg.run || qs('run','play')).toLowerCase();
  const diff = String(cfg.diff || qs('diff','normal')).toLowerCase();
  const plannedSec = clamp(cfg.durationPlannedSec ?? cfg.time ?? qs('time','90'), 20, 300);

  const seedStr = String(cfg.seed ?? qs('seed', String(Date.now())));
  const rng = makeRng(seedStr);
  const r01 = ()=> rng();
  const pick = (arr)=> arr[(r01()*arr.length)|0];

  const pid = String(cfg.pid || qs('pid','anon')).trim()||'anon';
  const hubUrl = String(cfg.hub || qs('hub','../hub.html'));
  const HH_CAT='nutrition';
  const HH_GAME='plate';
  const cooldownRequired = !!cfg.cooldown || (qs('cooldown','0')==='1') || (qs('cd','0')==='1');

  // ✅ Layer (match plate-vr.html)
  const layer = mount || DOC.getElementById('plate-layer') || DOC.getElementById('layer');
  if(!layer){
    console.warn('[Plate] Missing mount (#plate-layer)');
    return;
  }
  // ต้องให้ layer แตะได้
  try{ layer.style.pointerEvents = 'auto'; }catch(e){}
  try{ layer.style.touchAction = 'manipulation'; }catch(e){}

  // ✅ UI mapping (match plate-vr.html)
  const $ = (id)=> DOC.getElementById(id);

  const ui = {
    uiScore: $('uiScore'),
    uiTime: $('uiTime'),
    uiMiss: $('uiMiss'),
    uiGrade: $('uiGrade'),
    uiCombo: $('uiCombo'),
    uiComboMax: $('uiComboMax'),
    uiAcc: $('uiAcc'),

    uiPlateHave: $('uiPlateHave'),

    uiGoalTitle: $('uiGoalTitle'),
    uiGoalCount: $('uiGoalCount'),
    uiGoalFill: $('uiGoalFill'),

    uiFever: $('uiFever'),
    uiFeverFill: $('uiFeverFill'),
    uiShield: $('uiShield'),

    uiG1: $('uiG1'),
    uiG2: $('uiG2'),
    uiG3: $('uiG3'),
    uiG4: $('uiG4'),
    uiG5: $('uiG5'),

    uiMiniTitle: $('uiMiniTitle'),
    uiMiniTime: $('uiMiniTime'),
    uiMiniCount: $('uiMiniCount'),
    uiMiniFill: $('uiMiniFill'),

    stormFx: $('stormFx'),
    bossFx: $('bossFx'),
    stormHud: $('stormHud'),
    bossHud: $('bossHud'),

    // End overlay (ถ้ายังไม่ได้ทำ end UI ใน plate-vr.html ก็ไม่พัง)
    end: $('endOverlay') || $('end'),
    endTitle: $('endTitle'),
    endSub: $('endSub'),
    endGrade: $('endGrade'),
    endScore: $('endScore'),
    endOk: $('endOk'),
    endWrong: $('endWrong'),
    btnCopy: $('btnCopy'),
    btnReplay: $('btnReplay'),
    btnNextCooldown: $('btnNextCooldown'),
    btnBackHub: $('btnBackHub'),
  };

  // Tuning
  const TUNE = (function(){
    let spawnBase=0.80, ttl=2.8, missLimit=12;
    if(diff==='easy'){ spawnBase=0.68; ttl=3.1; missLimit=16; }
    if(diff==='hard'){ spawnBase=0.95; ttl=2.35; missLimit=9; }
    if(view==='cvr'||view==='vr') ttl += 0.15;
    return { spawnBase, ttl, missLimit };
  })();

  // Thai 5 food groups mapping (ตามที่คุณ fix)
  const GROUPS = [
    { id:1, name:'หมู่ 1 โปรตีน', items:['🥚','🐟','🥛','🍗','🥜'] },
    { id:2, name:'หมู่ 2 คาร์โบไฮเดรต', items:['🍚','🍞','🥔','🍜','🥖'] },
    { id:3, name:'หมู่ 3 ผัก', items:['🥦','🥬','🥕','🥒','🌽'] },
    { id:4, name:'หมู่ 4 ผลไม้', items:['🍌','🍎','🍊','🍉','🍇'] },
    { id:5, name:'หมู่ 5 ไขมัน', items:['🥑','🫒','🧈','🥥','🧀'] },
  ];

  // state
  const startTimeIso = nowIso();
  let playing=true;
  let paused=false;
  let tLeft=plannedSec;
  let lastTick=nowMs();

  // pause hook
  WIN.__PLATE_SET_PAUSED__ = (on)=>{ paused=!!on; lastTick=nowMs(); };

  let score=0, miss=0, ok=0, wrong=0;
  let combo=0, bestCombo=0;

  // progress: เก็บครบ 5 หมู่
  const haveGroup = { 1:0, 2:0, 3:0, 4:0, 5:0 };
  let haveCount = 0;

  // mission: เป้าหมายปัจจุบัน (กลุ่มที่ต้องเก็บ)
  let targetGroup = pick(GROUPS);

  // objects
  const foods = new Map();
  let idSeq=1;

  function layerRect(){ return layer.getBoundingClientRect(); }

  function gradeFromScore(s){
    const played = Math.max(1, plannedSec - tLeft);
    const sps = s/played;
    const x = sps*10 - miss*0.5;
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

  function updateHaveUI(){
    ui.uiG1 && (ui.uiG1.textContent = String(haveGroup[1]|0));
    ui.uiG2 && (ui.uiG2.textContent = String(haveGroup[2]|0));
    ui.uiG3 && (ui.uiG3.textContent = String(haveGroup[3]|0));
    ui.uiG4 && (ui.uiG4.textContent = String(haveGroup[4]|0));
    ui.uiG5 && (ui.uiG5.textContent = String(haveGroup[5]|0));
    ui.uiPlateHave && (ui.uiPlateHave.textContent = String(haveCount|0));

    ui.uiGoalTitle && (ui.uiGoalTitle.textContent = 'เติมจานให้ครบ 5 หมู่');
    ui.uiGoalCount && (ui.uiGoalCount.textContent = `${haveCount|0}/5`);
    if(ui.uiGoalFill){
      const pct = clamp((haveCount/5)*100, 0, 100);
      ui.uiGoalFill.style.width = `${pct}%`;
    }
  }

  function setHUD(){
    ui.uiScore && (ui.uiScore.textContent=String(score|0));
    ui.uiTime && (ui.uiTime.textContent=String(Math.ceil(tLeft)));
    ui.uiMiss && (ui.uiMiss.textContent=String(miss|0));
    ui.uiGrade && (ui.uiGrade.textContent=gradeFromScore(score));

    ui.uiCombo && (ui.uiCombo.textContent=String(combo|0));
    ui.uiComboMax && (ui.uiComboMax.textContent=String(bestCombo|0));
    ui.uiAcc && (ui.uiAcc.textContent = `${accPct()}%`);

    // เป้าหมาย: กลุ่มที่ต้องเก็บตอนนี้
    // (คุณอยากแสดงตรงไหนก็ได้ — ตอนนี้เอาไปแสดงใน uiMiniTitle)
    ui.uiMiniTitle && (ui.uiMiniTitle.textContent = `เป้าหมาย: ${targetGroup?.name || '—'}`);

    updateHaveUI();
  }

  // ===== Targets =====
  function makeFood(kind, emoji, ttlSec){
    const id=String(idSeq++);
    const el=DOC.createElement('div');
    el.className='plateTarget';         // ✅ match CSS
    el.textContent=emoji;
    el.dataset.id=id;
    el.dataset.kind=kind;

    const r=layerRect();
    const pad = (view==='mobile') ? 18 : 22;
    const x = pad + r01()*(Math.max(1, r.width - pad*2));
    const y = pad + r01()*(Math.max(1, r.height - pad*2));

    el.style.left = `${x}px`;
    el.style.top  = `${y}px`;

    layer.appendChild(el);

    const born=nowMs();
    const ttl=Math.max(1.0, ttlSec)*1000;
    const obj={ id, el, kind, emoji, born, ttl, promptMs: nowMs() };
    foods.set(id,obj);

    // AI spawn
    try{ ai?.onSpawn?.(kind, { id, emoji, ttlSec }); }catch(e){}
    return obj;
  }

  function removeFood(id){
    const f=foods.get(String(id));
    if(!f) return;
    foods.delete(String(id));
    try{ f.el.remove(); }catch(e){}
  }

  function groupIdFromEmoji(emoji){
    for(const g of GROUPS){
      if(g.items.includes(emoji)) return g.id;
    }
    return 0;
  }

  function isCorrectEmojiForTarget(emoji){
    return (targetGroup?.items || []).includes(emoji);
  }

  function addGroupToPlate(gid){
    if(!gid) return;
    if(haveGroup[gid] > 0) return; // เก็บกลุ่มละ 1 ครั้งเพื่อเติมจาน
    haveGroup[gid] = 1;
    haveCount = Object.values(haveGroup).reduce((a,b)=>a+(b?1:0),0);
  }

  function onHitFood(f, x, y){
    const correct = (f.kind==='food') && isCorrectEmojiForTarget(f.emoji);

    if(correct){
      ok++;
      combo++; bestCombo=Math.max(bestCombo, combo);
      const add = 12 + Math.min(10, combo);
      score += add;

      const gid = groupIdFromEmoji(f.emoji);
      addGroupToPlate(gid);

      // เปลี่ยนเป้าหมายเมื่อเล่นไปเรื่อย ๆ
      if(ok % 6 === 0){
        targetGroup = pick(GROUPS);
      }

      try{ ai?.onHit?.('food_ok', { id:f.id, gid }); }catch(e){}
    }else{
      wrong++;
      miss++;
      combo=0;
      score = Math.max(0, score - 8);
      try{ ai?.onHit?.('food_wrong', { id:f.id }); }catch(e){}
    }

    removeFood(f.id);
  }

  // pointer hits (pc/mobile)
  layer.addEventListener('pointerdown', (ev)=>{
    if(!playing || paused) return;
    const el = ev.target?.closest?.('.plateTarget');
    if(!el) return;
    const id=el.dataset.id;
    const f=foods.get(String(id));
    if(f) onHitFood(f, ev.clientX, ev.clientY);
  }, { passive:true });

  // crosshair shoot (VR/cVR)
  function pickClosestToCenter(lockPx){
    lockPx = clamp(lockPx ?? 56, 16, 140);
    let best=null, bestD=1e9;
    const r=layerRect();
    const cx=r.left + r.width/2;
    const cy=r.top  + r.height/2;
    for(const f of foods.values()){
      const b=f.el.getBoundingClientRect();
      const fx=b.left + b.width/2;
      const fy=b.top  + b.height/2;
      const d=Math.hypot(fx-cx, fy-cy);
      if(d<bestD){ bestD=d; best=f; }
    }
    if(best && bestD<=lockPx) return best;
    return null;
  }

  WIN.addEventListener('hha:shoot', (ev)=>{
    if(!playing || paused) return;
    const lockPx = ev?.detail?.lockPx ?? 56;
    const f = pickClosestToCenter(lockPx);
    if(f){
      const r=layerRect();
      onHitFood(f, r.left+r.width/2, r.top+r.height/2);
    }
  });

  // ===== End summary =====
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
      gameVersion: 'PlateVR_SAFE_2026-02-28_AIWired_PATCH_HTMLMAP',
      device: view,
      runMode,
      diff,
      seed: seedStr,
      reason: String(reason||''),
      durationPlannedSec: plannedSec,
      durationPlayedSec: Math.round(plannedSec - tLeft),
      scoreFinal: score|0,
      ok: ok|0,
      wrong: wrong|0,
      missTotal: miss|0,
      comboMax: bestCombo|0,
      plateHave: haveCount|0,
      haveGroup: { ...haveGroup },
      targetGroup: targetGroup?.name || '—',
      accuracyPct: accPct(),
      startTimeIso,
      endTimeIso: nowIso(),
      grade: gradeFromScore(score),
      aiPredictionLast: (function(){ try{ return ai?.getPrediction?.() || null; }catch(e){ return null; } })()
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
    if(ui.btnBackHub){
      ui.btnBackHub.textContent = needCooldown ? 'Back HUB (หลัง Cooldown)' : 'Back HUB';
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

    // AI onEnd
    try{
      const aiEnd = ai?.onEnd?.(summary);
      if(aiEnd) summary.aiEnd = aiEnd;
    }catch(e){}

    WIN.__HHA_LAST_SUMMARY = summary;
    dispatchEndOnce(summary);

    // ถ้าไม่มี end UI ในหน้า ก็ไม่เป็นไร
    if(ui.end){
      ui.end.setAttribute('aria-hidden','false');
      ui.endTitle && (ui.endTitle.textContent='Game Over');
      ui.endSub && (ui.endSub.textContent=`reason=${summary.reason} | mode=${runMode} | view=${view} | seed=${seedStr}`);
      ui.endGrade && (ui.endGrade.textContent=summary.grade||'—');
      ui.endScore && (ui.endScore.textContent=String(summary.scoreFinal|0));
      ui.endOk && (ui.endOk.textContent=String(summary.ok|0));
      ui.endWrong && (ui.endWrong.textContent=String(summary.wrong|0));
      setEndButtons(summary);
    }
  }

  // ===== Loop =====
  let spawnAcc=0;

  function spawnTick(dt){
    spawnAcc += TUNE.spawnBase * dt;
    while(spawnAcc >= 1){
      spawnAcc -= 1;

      // mostly “food” + sometimes distractor
      const correct = (r01() < 0.65);
      let emoji='🍚';
      if(correct){
        emoji = pick(targetGroup.items);
      }else{
        const others = GROUPS.filter(g=>g.id!==targetGroup.id);
        emoji = pick(pick(others).items);
      }
      makeFood('food', emoji, TUNE.ttl);
    }
  }

  function updateFoods(){
    const t=nowMs();
    for(const f of Array.from(foods.values())){
      const age=t - f.born;
      if(age >= f.ttl){
        try{ ai?.onExpire?.('food', { id:f.id }); }catch(e){}
        miss++;
        wrong++;
        score = Math.max(0, score - 4);
        combo=0;
        removeFood(f.id);
      }
    }
  }

  function checkEnd(){
    if(tLeft<=0){ showEnd('time'); return true; }
    if(miss>=TUNE.missLimit){ showEnd('miss-limit'); return true; }
    // ✅ จบเมื่อ “ครบ 5 หมู่”
    if(haveCount >= 5){ showEnd('plate-complete'); return true; }
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

    // AI tick (prediction only)
    try{
      ai?.onTick?.(dt, { miss, ok, wrong, combo, plateHave: haveCount });
    }catch(e){}

    setHUD();

    if(checkEnd()) return;
    requestAnimationFrame(tick);
  }

  DOC.addEventListener('visibilitychange', ()=>{
    if(DOC.hidden && playing){ showEnd('background'); }
  });

  try{ WIN[END_SENT_KEY]=0; }catch(e){}
  setHUD();
  requestAnimationFrame(tick);
}