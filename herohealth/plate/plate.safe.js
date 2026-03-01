// === /herohealth/plate/plate.safe.js ===
// Plate VR SAFE — PRODUCTION (ESM)
// ✅ DOM match plate-vr.html (#plate-layer, .plateTarget, ui*)
// ✅ Deterministic RNG + hha:shoot + AI hooks wired
// ✅ Classroom mode: soft-start ลด miss ระเบิดสำหรับ ป.5
// ✅ End summary hardened + cooldown daily-first
'use strict';

export function boot(cfg){
  cfg = cfg || {};
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
      'plannedGame','finalGame','zone','cdnext','grade','mode'
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

  const mount = cfg.mount || DOC.getElementById('plate-layer');
  if(!mount){ console.warn('[Plate] Missing #plate-layer'); return; }

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
  const HH_CAT='nutrition';
  const HH_GAME='plate';
  const cooldownRequired = !!cfg.cooldown || (qs('cooldown','0')==='1') || (qs('cd','0')==='1');

  // classroom / challenge
  const mode = (String(cfg.mode || qs('mode','classroom')).toLowerCase()==='challenge') ? 'challenge' : 'classroom';
  let elapsed = 0;
  const softWindowSec = (mode==='classroom') ? 10 : 0;   // 10 วิแรก ใจดี (expire โทษเบา)

  // DOM ui (ตาม plate-vr.html)
  const ui = {
    score: DOC.getElementById('uiScore'),
    combo: DOC.getElementById('uiCombo'),
    comboMax: DOC.getElementById('uiComboMax'),
    miss: DOC.getElementById('uiMiss'),
    plateHave: DOC.getElementById('uiPlateHave'),
    acc: DOC.getElementById('uiAcc'),
    grade: DOC.getElementById('uiGrade'),
    goalCount: DOC.getElementById('uiGoalCount'),
    goalFill: DOC.getElementById('uiGoalFill'),
    time: DOC.getElementById('uiTime'),
    shield: DOC.getElementById('uiShield'),
    fever: DOC.getElementById('uiFever'),
    feverFill: DOC.getElementById('uiFeverFill'),
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

  // Tuning
  const TUNE = (function(){
    let spawnBase=0.78, ttl=2.8, missLimit=12;
    if(diff==='easy'){ spawnBase=0.66; ttl=3.2; missLimit=16; }
    if(diff==='hard'){ spawnBase=0.94; ttl=2.35; missLimit=9; }
    if(view==='cvr'||view==='vr') ttl += 0.15;

    // classroom kindness
    if(mode==='classroom'){
      spawnBase *= 0.86;
      ttl += 0.35;
      missLimit += 4;
    }
    return { spawnBase, ttl, missLimit };
  })();

  // Thai 5 food groups mapping
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

  WIN.__PLATE_SET_PAUSED__ = (on)=>{ paused=!!on; lastTick=nowMs(); };

  let score=0, miss=0, ok=0, wrong=0;
  let combo=0, bestCombo=0;

  let fever=0;     // 0..100 (simple)
  let shield=0;    // 0..9 (simple)

  // “plate completion” tracking (collect 5 groups)
  const got = new Set(); // groupId collected
  let targetGroup = pick(GROUPS);

  // targets
  const foods = new Map();
  let idSeq=1;

  function layerRect(){ return mount.getBoundingClientRect(); }

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

  function sayCoach(msg){
    if(ui.coachMsg) ui.coachMsg.textContent = String(msg||'');
  }

  function setHUD(){
    ui.score && (ui.score.textContent=String(score|0));
    ui.combo && (ui.combo.textContent=String(combo|0));
    ui.comboMax && (ui.comboMax.textContent=String(bestCombo|0));
    ui.miss && (ui.miss.textContent=String(miss|0));

    const accPct = (ok+wrong)>0 ? Math.round((ok/(ok+wrong))*100) : 0;
    ui.acc && (ui.acc.textContent=`${accPct}%`);
    ui.grade && (ui.grade.textContent=gradeFromScore(score));

    ui.time && (ui.time.textContent=String(Math.ceil(tLeft)));

    ui.fever && (ui.fever.textContent=`${Math.round(clamp(fever,0,100))}%`);
    ui.feverFill && (ui.feverFill.style.width=`${clamp(fever,0,100)}%`);
    ui.shield && (ui.shield.textContent=String(Math.max(0,shield)));

    const have = got.size;
    ui.plateHave && (ui.plateHave.textContent=String(have));
    ui.goalCount && (ui.goalCount.textContent=`${have}/5`);
    ui.goalFill && (ui.goalFill.style.width=`${(have/5)*100}%`);

    ui.targetText && (ui.targetText.textContent = targetGroup?.name || '—');
  }

  function setAIHud(pred){
    // Plate UI นี้ไม่ได้โชว์ risk ตรง ๆ (เอาไว้ค่อยเพิ่ม)
    // แต่ยังเรียก ai.onTick เพื่อเก็บ event stream ได้
  }

  function makeTarget(kind, emoji, ttlSec){
    const id=String(idSeq++);
    const el=DOC.createElement('div');
    el.className='plateTarget';
    el.textContent=emoji;
    el.dataset.id=id;
    el.dataset.kind=kind;

    const r=layerRect();
    const pad = (view==='mobile') ? 22 : 26;

    const x = pad + r01()*(Math.max(1, r.width - pad*2));
    const y = Math.max(pad+90, pad + r01()*(Math.max(1, r.height - pad*2)));

    el.style.left = `${x}px`;
    el.style.top  = `${y}px`;

    mount.appendChild(el);

    const born=nowMs();
    const ttl=Math.max(1.0, ttlSec)*1000;
    const obj={ id, el, kind, emoji, born, ttl, promptMs: nowMs() };
    foods.set(id,obj);

    try{ cfg.ai?.onSpawn?.(kind, { id, emoji, ttlSec }); }catch(e){}
    return obj;
  }

  function removeTarget(id){
    const f=foods.get(String(id));
    if(!f) return;
    foods.delete(String(id));
    try{ f.el.remove(); }catch(e){}
  }

  function groupOfEmoji(emoji){
    for(const g of GROUPS){
      if(g.items.includes(emoji)) return g;
    }
    return null;
  }

  function isCorrect(emoji){
    return (targetGroup?.items || []).includes(emoji);
  }

  function addFever(v){
    fever = clamp(fever + v, 0, 100);
  }
  function addShield(){
    shield = clamp(shield + 1, 0, 9);
  }

  function onHit(f, x, y){
    const correct = (f.kind==='food') && isCorrect(f.emoji);

    if(correct){
      ok++;
      combo++; bestCombo=Math.max(bestCombo, combo);
      const add = 12 + Math.min(10, combo);
      score += add;

      addFever(6);

      // record got group
      const g = groupOfEmoji(f.emoji);
      if(g) got.add(g.id);

      // rotate target sometimes
      if(ok % 6 === 0){
        targetGroup = pick(GROUPS);
        sayCoach('เปลี่ยนหมู่ใหม่! ลุยต่อ 💪');
      }else{
        sayCoach('ดีมาก! เก็บให้ตรงหมู่อีก ✨');
      }

      // reward shield sometimes
      if((ok % 8) === 0) addShield();

      try{ cfg.ai?.onHit?.('food_ok', { id:f.id, emoji:f.emoji }); }catch(e){}
    }else{
      wrong++;
      combo=0;

      // shield can block a “wrong” once
      if(shield>0){
        shield--;
        sayCoach('บล็อกได้! 🛡️ ครั้งนี้ไม่เสียแต้ม');
      }else{
        miss++;
        score = Math.max(0, score - 8);
        sayCoach('อันนี้ไม่ตรงหมู่ เปลี่ยนใหม่ได้นะ 🙂');
      }

      try{ cfg.ai?.onHit?.('food_wrong', { id:f.id, emoji:f.emoji }); }catch(e){}
    }

    removeTarget(f.id);
  }

  // pointer hits
  mount.addEventListener('pointerdown', (ev)=>{
    if(!playing || paused) return;
    // cVR strict: กันการแตะ (ให้ยิง crosshair อย่างเดียว)
    if(view==='cvr' || view==='vr') return;

    const el = ev.target?.closest?.('.plateTarget');
    if(!el) return;
    const id=el.dataset.id;
    const f=foods.get(String(id));
    if(f) onHit(f, ev.clientX, ev.clientY);
  }, { passive:true });

  // crosshair shoot
  function pickClosestToCenter(lockPx){
    lockPx = clamp(lockPx ?? 56, 16, 160);
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
      onHit(f, r.left+r.width/2, r.top+r.height/2);
    }
  });

  // end summary
  const END_SENT_KEY='__HHA_PLATE_END_SENT__';
  function dispatchEndOnce(summary){
    try{
      if(WIN[END_SENT_KEY]) return;
      WIN[END_SENT_KEY]=1;
      WIN.dispatchEvent(new CustomEvent('hha:game-ended', { detail: summary || null }));
    }catch(e){}
  }

  function buildSummary(reason){
    const accPct = (ok+wrong)>0 ? (ok/(ok+wrong))*100 : 0;
    return {
      projectTag: 'PlateVR',
      gameVersion: 'PlateVR_SAFE_DOMMATCH_2026-02-28',
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
      comboMax: bestCombo|0,
      accuracyPct: Math.round(accPct),
      plateHave: got.size,
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
        }catch(e){ location.reload(); }
      };
    }
    if(ui.btnCopy){
      // classroom: ซ่อนปุ่ม copy ได้ ถ้าไม่ debug
      const DEBUG = (qs('debug','0')==='1') || !!cfg.debug;
      ui.btnCopy.style.display = DEBUG ? '' : 'none';
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
      const aiEnd = cfg.ai?.onEnd?.(summary);
      if(aiEnd) summary.aiEnd = aiEnd;
    }catch(e){}

    WIN.__HHA_LAST_SUMMARY = summary;
    dispatchEndOnce(summary);

    if(ui.end){
      ui.end.setAttribute('aria-hidden','false');
      ui.endTitle && (ui.endTitle.textContent='จบเกม');
      ui.endSub && (ui.endSub.textContent=`reason=${summary.reason} | mode=${runMode} | view=${view} | seed=${seedStr}`);
      ui.endGrade && (ui.endGrade.textContent=summary.grade||'—');
      ui.endScore && (ui.endScore.textContent=String(summary.scoreFinal|0));
      ui.endOk && (ui.endOk.textContent=String(summary.ok|0));
      ui.endWrong && (ui.endWrong.textContent=String(summary.wrong|0));
      setEndButtons(summary);
    }
  }

  // spawn loop
  let spawnAcc=0;
  function spawnTick(dt){
    spawnAcc += TUNE.spawnBase * dt;
    while(spawnAcc >= 1){
      spawnAcc -= 1;

      // mostly correct, sometimes distractor
      const correct = (r01() < 0.65);
      let emoji='🍚';
      if(correct){
        emoji = pick(targetGroup.items);
      }else{
        const others = GROUPS.filter(g=>g.id!==targetGroup.id);
        emoji = pick(pick(others).items);
      }
      makeTarget('food', emoji, TUNE.ttl);
    }
  }

  function updateTargets(){
    const t=nowMs();
    for(const f of Array.from(foods.values())){
      const age=t - f.born;
      if(age >= f.ttl){
        try{ cfg.ai?.onExpire?.('food', { id:f.id, emoji:f.emoji }); }catch(e){}

        // classroom soft penalty in first seconds
        if(mode==='classroom' && elapsed < softWindowSec){
          score = Math.max(0, score - 2);
          combo = 0;
          sayCoach('ค่อย ๆ เล็งนะ ยังมีเวลา 😊');
        }else{
          miss++;
          wrong++;
          score = Math.max(0, score - 4);
          combo=0;
        }
        removeTarget(f.id);
      }
    }
  }

  function checkEnd(){
    if(tLeft<=0){ showEnd('time'); return true; }
    if(miss>=TUNE.missLimit){ showEnd('miss-limit'); return true; }
    // finish early if plate complete (optional)
    if(got.size>=5 && mode==='classroom'){
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

    elapsed += dt;
    tLeft=Math.max(0, tLeft - dt);

    spawnTick(dt);
    updateTargets();

    // AI tick (prediction only)
    try{
      const pred = cfg.ai?.onTick?.(dt, { miss, ok, wrong, combo, fever, shield }) || null;
      setAIHud(pred);
    }catch(e){}

    // fever decay a bit
    fever = Math.max(0, fever - dt*2.2);

    setHUD();
    if(checkEnd()) return;
    requestAnimationFrame(tick);
  }

  DOC.addEventListener('visibilitychange', ()=>{
    if(DOC.hidden && playing){ showEnd('background'); }
  });

  try{ WIN[END_SENT_KEY]=0; }catch(e){}
  sayCoach('เลือกอาหารให้ “ตรงหมู่” เพื่อเติมจานให้ครบ 5 หมู่! 🍽️');
  setHUD();
  requestAnimationFrame(tick);
}