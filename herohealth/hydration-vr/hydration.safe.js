// === /herohealth/hydration-vr/hydration.safe.js ===
// Hydration VR SAFE — PRODUCTION
// ✅ ESM + hha:shoot + deterministic + AI hooks wired
// ✅ STORM (lightning) -> NORMAL -> BOSS
// ✅ MISS split: missTotal = badHit + goodExpired
// ✅ HUD-safe-ish spawn (keeps targets away from top HUD zone)
// FULL v20260302-HYDRATION-SAFE-STORM-MISS-SPLIT
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
    game=String(game||'hydration').toLowerCase();
    const kNew=`HHA_COOLDOWN_DONE:${cat}:${game}:${pid}:${day}`;
    const kOld=`HHA_COOLDOWN_DONE:${cat}:${pid}:${day}`;
    return (lsGet(kNew)==='1') || (lsGet(kOld)==='1');
  }
  function buildCooldownUrl({ hub, nextAfterCooldown, cat, gameKey, pid }){
    const gate = new URL('../warmup-gate.html', location.href);
    gate.searchParams.set('gatePhase','cooldown');
    gate.searchParams.set('cat', String(cat||'nutrition'));
    gate.searchParams.set('theme', String(gameKey||'hydration'));
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
  const runMode = String(cfg.run || qs('run','play')).toLowerCase();
  const diff = String(cfg.diff || qs('diff','normal')).toLowerCase();
  const plannedSec = clamp(cfg.time ?? qs('time','80'), 20, 300);

  const seedStr = String(cfg.seed || qs('seed', String(Date.now())));
  const rng = makeRng(seedStr);
  const r01 = ()=> rng();
  const pick = (arr)=> arr[(r01()*arr.length)|0];

  const pid = String(cfg.pid || qs('pid','anon')).trim()||'anon';
  const hubUrl = String(cfg.hub || qs('hub','../hub.html'));

  // ✅ Hydration เหมาะกับ Nutrition zone
  const HH_CAT='nutrition';
  const HH_GAME='hydration';
  const cooldownRequired = !!cfg.cooldown || (qs('cooldown','0')==='1') || (qs('cd','0')==='1');

  // DOM
  const layer = DOC.getElementById('layer');
  if(!layer){ console.warn('[Hydration] Missing #layer'); return; }

  const stageEl = DOC.getElementById('stage') || layer.parentElement;
  const stormFx = DOC.getElementById('stormFx');
  function setStorm(on){
    try{ stageEl?.classList?.toggle('is-storm', !!on); }catch(e){}
    try{ if(stormFx) stormFx.style.opacity = on ? '1' : '0'; }catch(e){}
  }

  const ui = {
    score: DOC.getElementById('uiScore'),
    time: DOC.getElementById('uiTime'),
    miss: DOC.getElementById('uiMiss'),
    expire: DOC.getElementById('uiExpire'),
    bad: DOC.getElementById('uiBad'),
    grade: DOC.getElementById('uiGrade'),
    water: DOC.getElementById('uiWater'),
    combo: DOC.getElementById('uiCombo'),
    shield: DOC.getElementById('uiShield'),
    phase: DOC.getElementById('uiPhase'),

    aiRisk: DOC.getElementById('aiRisk'),
    aiHint: DOC.getElementById('aiHint'),

    end: DOC.getElementById('end'),
    endTitle: DOC.getElementById('endTitle'),
    endSub: DOC.getElementById('endSub'),
    endGrade: DOC.getElementById('endGrade'),
    endScore: DOC.getElementById('endScore'),
    endMiss: DOC.getElementById('endMiss'),
    endWater: DOC.getElementById('endWater'),

    btnCopy: DOC.getElementById('btnCopy'),
    btnReplay: DOC.getElementById('btnReplay'),
    btnNextCooldown: DOC.getElementById('btnNextCooldown'),
    btnBackHub: DOC.getElementById('btnBackHub')
  };

  // Tuning
  const TUNE = (function(){
    let spawnBase=0.78, ttlGood=2.8, ttlBad=3.0, missLimit=12;
    let waterGain=7.5, waterLoss=6.0, shieldDrop=0.14;

    if(diff==='easy'){ spawnBase=0.66; ttlGood=3.1; ttlBad=3.2; missLimit=16; waterGain=8.5; waterLoss=5.2; }
    if(diff==='hard'){ spawnBase=0.95; ttlGood=2.35; ttlBad=2.6; missLimit=9;  waterGain=6.8; waterLoss=7.0; }

    if(view==='cvr'||view==='vr'){ ttlGood += 0.15; ttlBad += 0.15; }

    return { spawnBase, ttlGood, ttlBad, missLimit, waterGain, waterLoss, shieldDrop };
  })();

  // Game state
  const startTimeIso = nowIso();
  let playing=true;
  let paused=false;
  let tLeft=plannedSec;
  let lastTick=nowMs();

  WIN.__HYD_SET_PAUSED__ = (on)=>{ paused=!!on; lastTick=nowMs(); };

  let score=0, miss=0;
  let missBadHit = 0;       // ✅ junk hit when no shield
  let missGoodExpired = 0;  // ✅ good expired
  let combo=0, bestCombo=0;
  let shield=0;

  let waterPct=30; // start
  let bossOn=false;
  let bossHpMax=18;
  let bossHp=bossHpMax;

  // === Mission Phases ===
  let phase = 'normal';           // 'normal' | 'storm' | 'boss'
  let stormLeft = 0;
  let stormDone = false;

  // Targets
  const bubbles = new Map();
  let idSeq=1;

  const GOOD = ['💧','💦','🫗'];
  const BAD  = ['🧋','🥤','🍟'];
  const SHLD = ['🛡️'];

  function layerRect(){ return layer.getBoundingClientRect(); }

  function gradeFromScore(s){
    const played = Math.max(1, plannedSec - tLeft);
    const sps = s/played;
    const x = sps*10 - miss*0.45;
    if(x>=70) return 'S';
    if(x>=55) return 'A';
    if(x>=40) return 'B';
    if(x>=28) return 'C';
    return 'D';
  }

  function setHUD(){
    ui.score && (ui.score.textContent=String(score|0));
    ui.time && (ui.time.textContent=String(Math.ceil(tLeft)));
    ui.miss && (ui.miss.textContent=String(miss|0));
    ui.expire && (ui.expire.textContent=String(missGoodExpired|0));
    ui.bad && (ui.bad.textContent=String(missBadHit|0));
    ui.grade && (ui.grade.textContent=gradeFromScore(score));
    ui.water && (ui.water.textContent=`${Math.round(clamp(waterPct,0,100))}%`);
    ui.combo && (ui.combo.textContent=String(combo|0));
    ui.shield && (ui.shield.textContent=String(shield|0));
    ui.phase && (ui.phase.textContent=String(phase||'—'));
  }

  function setAIHud(pred){
    try{
      if(!pred) return;
      if(ui.aiRisk) ui.aiRisk.textContent = String((+pred.hazardRisk).toFixed(2));
      if(ui.aiHint) ui.aiHint.textContent = String((pred.next5 && pred.next5[0]) || '—');
    }catch(e){}
  }

  function lightning(){
    if(!stageEl) return;
    try{
      const f = DOC.createElement('div');
      f.className = 'storm-flash';
      stageEl.appendChild(f);
      setTimeout(()=>{ try{ f.remove(); }catch(e){} }, 220);

      const b = DOC.createElement('div');
      b.className = 'bolt';
      const x = 10 + r01()*80;
      b.style.left = `${x}%`;
      b.style.transform = `translateX(-50%) rotate(${(r01()*18-9).toFixed(1)}deg)`;
      stageEl.appendChild(b);
      setTimeout(()=>{ try{ b.remove(); }catch(e){} }, 260);
    }catch(e){}
  }

  // ✅ HUD-safe-ish spawn: push y away from top HUD area
  function safeSpawnXY(){
    const r=layerRect();
    const pad = (view==='mobile') ? 18 : 22;
    const topBan = (view==='mobile') ? 155 : 120;   // กัน HUD โซนบน
    const botPad = (view==='mobile') ? 22 : 24;

    const x = pad + r01()*(Math.max(1, r.width - pad*2));
    const yMin = pad + topBan;
    const yMax = Math.max(yMin+1, r.height - botPad);

    const y = yMin + r01()*(Math.max(1, yMax - yMin));
    return { x, y };
  }

  function makeBubble(kind, emoji, ttlSec){
    const id=String(idSeq++);
    const el=DOC.createElement('div');
    el.className='bubble';
    el.textContent=emoji;
    el.dataset.id=id;
    el.dataset.kind=kind;

    const p = safeSpawnXY();
    el.style.left = `${p.x}px`;
    el.style.top  = `${p.y}px`;

    layer.appendChild(el);

    const born=nowMs();
    const ttl=Math.max(0.9, ttlSec)*1000;
    const obj={ id, el, kind, emoji, born, ttl, promptMs: nowMs() };
    bubbles.set(id,obj);

    try{ cfg.ai?.onSpawn?.(kind, { id, emoji, ttlSec, phase }); }catch(e){}
    return obj;
  }

  function removeBubble(id){
    const b=bubbles.get(String(id));
    if(!b) return;
    bubbles.delete(String(id));
    try{ b.el.remove(); }catch(e){}
  }

  function addShield(){
    shield = clamp(shield + 1, 0, 9);
  }

  function hit(b){
    if(!playing || paused) return;

    if(b.kind==='good'){
      combo++; bestCombo=Math.max(bestCombo, combo);
      const add = 10 + Math.min(12, combo);
      score += add;
      waterPct = clamp(waterPct + TUNE.waterGain, 0, 100);

      try{ cfg.ai?.onHit?.('good', { id:b.id, phase }); }catch(e){}
      removeBubble(b.id);
      return;
    }

    if(b.kind==='shield'){
      addShield();
      score += 6;
      try{ cfg.ai?.onHit?.('shield', { id:b.id, phase }); }catch(e){}
      removeBubble(b.id);
      return;
    }

    // bad
    if(shield > 0){
      shield--;
      score += 2;
      try{ cfg.ai?.onHit?.('bad_block', { id:b.id, phase }); }catch(e){}
      removeBubble(b.id);
      return;
    }

    miss++;
    missBadHit++;   // ✅ แยกสาเหตุ
    combo=0;
    score = Math.max(0, score - 8);
    waterPct = clamp(waterPct - TUNE.waterLoss, 0, 100);

    try{ cfg.ai?.onHit?.('bad', { id:b.id, phase }); }catch(e){}
    removeBubble(b.id);
  }

  // click/tap (pc/mobile) — cVR strict จะถูก disable ที่ run.html แล้ว
  layer.addEventListener('pointerdown', (ev)=>{
    if(!playing || paused) return;
    const el = ev.target?.closest?.('.bubble');
    if(!el) return;
    const id=el.dataset.id;
    const b=bubbles.get(String(id));
    if(b) hit(b);
  }, { passive:true });

  // crosshair shoot (VR/cVR)
  function pickClosestToCenter(lockPx){
    lockPx = clamp(lockPx ?? 56, 16, 160);
    let best=null, bestD=1e9;
    const r=layerRect();
    const cx=r.left + r.width/2;
    const cy=r.top  + r.height/2;
    for(const b of bubbles.values()){
      const bb=b.el.getBoundingClientRect();
      const bx=bb.left + bb.width/2;
      const by=bb.top  + bb.height/2;
      const d=Math.hypot(bx-cx, by-cy);
      if(d<bestD){ bestD=d; best=b; }
    }
    if(best && bestD<=lockPx) return best;
    return null;
  }

  WIN.addEventListener('hha:shoot', (ev)=>{
    if(!playing || paused) return;
    const lockPx = ev?.detail?.lockPx ?? 56;
    const b = pickClosestToCenter(lockPx);
    if(b) hit(b);
  });

  // End summary
  const END_SENT_KEY='__HHA_HYD_END_SENT__';
  function dispatchEndOnce(summary){
    try{
      if(WIN[END_SENT_KEY]) return;
      WIN[END_SENT_KEY]=1;
      WIN.dispatchEvent(new CustomEvent('hha:game-ended', { detail: summary || null }));
    }catch(e){}
  }

  function buildSummary(reason){
    return {
      projectTag: 'HydrationVR',
      gameVersion: 'HydrationVR_SAFE_2026-03-02_STORM_MISS_SPLIT',
      device: view,
      runMode,
      diff,
      seed: seedStr,
      reason: String(reason||''),
      durationPlannedSec: plannedSec,
      durationPlayedSec: Math.round(plannedSec - tLeft),
      scoreFinal: score|0,

      missTotal: miss|0,
      missBadHit: missBadHit|0,
      missGoodExpired: missGoodExpired|0,

      comboMax: bestCombo|0,
      shield: shield|0,
      waterPct: Math.round(clamp(waterPct,0,100)),
      phaseFinal: phase,
      bossOn: !!bossOn,
      bossHp: bossHp|0,
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

    for(const b of bubbles.values()){ try{ b.el.remove(); }catch(e){} }
    bubbles.clear();

    const summary = buildSummary(reason);

    try{
      const aiEnd = cfg.ai?.onEnd?.(summary);
      if(aiEnd) summary.aiEnd = aiEnd;
    }catch(e){}

    WIN.__HHA_LAST_SUMMARY = summary;
    dispatchEndOnce(summary);

    if(ui.end){
      ui.end.setAttribute('aria-hidden','false');
      ui.endTitle && (ui.endTitle.textContent='Game Over');
      ui.endSub && (ui.endSub.textContent=`reason=${summary.reason} | mode=${runMode} | view=${view} | seed=${seedStr}`);
      ui.endGrade && (ui.endGrade.textContent=summary.grade||'—');
      ui.endScore && (ui.endScore.textContent=String(summary.scoreFinal|0));
      ui.endMiss && (ui.endMiss.textContent=String(summary.missTotal|0));
      ui.endWater && (ui.endWater.textContent=`${summary.waterPct}%`);
      setEndButtons(summary);
    }
  }

  // Spawn & TTL + PHASE
  let spawnAcc=0;

  function spawnTick(dt){
    // shield decay over time (เบา ๆ)
    if(shield>0 && r01() < dt*TUNE.shieldDrop){
      shield = Math.max(0, shield-1);
    }

    // === Trigger STORM once mid-game ===
    if(!stormDone && phase === 'normal'){
      if(tLeft <= plannedSec*0.62){
        phase = 'storm';
        stormLeft = 12;      // storm duration sec
        stormDone = true;
        setStorm(true);
        lightning();
        try{ cfg.ai?.setHint?.('⚡ STORM! หลบ junk แล้วรีบดื่มน้ำ!'); }catch(e){}
      }
    }

    // === Storm countdown + lightning ===
    if(phase === 'storm'){
      stormLeft = Math.max(0, stormLeft - dt);
      if(r01() < dt*1.15) lightning();
      if(stormLeft <= 0){
        phase = 'normal';
        setStorm(false);
        try{ cfg.ai?.setHint?.('พายุซาแล้ว! เก็บน้ำต่อให้ถึงบอส'); }catch(e){}
      }
    }

    // === Boss trigger (after storm has happened) ===
    if(!bossOn && stormDone && phase !== 'storm'){
      if(tLeft <= plannedSec*0.38 && waterPct >= 55){
        bossOn = true;
        phase = 'boss';
        bossHpMax = (diff==='hard') ? 22 : (diff==='easy' ? 16 : 18);
        bossHp = bossHpMax;
        try{ cfg.ai?.setHint?.('👑 BOSS! รักษาน้ำให้เกิน 50%'); }catch(e){}
      }
    }

    // === Spawn tuning per phase ===
    const inStorm = (phase === 'storm');
    const inBoss  = (phase === 'boss');

    const spawnRate = TUNE.spawnBase * (inStorm ? 1.35 : inBoss ? 1.15 : 1.0);
    const ttlGood = TUNE.ttlGood * (inStorm ? 0.90 : 1.0);
    const ttlBad  = TUNE.ttlBad  * (inStorm ? 0.92 : 1.0);

    spawnAcc += spawnRate * dt;
    while(spawnAcc >= 1){
      spawnAcc -= 1;

      const p = r01();
      let kind='good';

      if(inStorm){
        if(p < 0.50) kind='good';
        else if(p < 0.93) kind='bad';
        else kind='shield';
      }else if(inBoss){
        if(p < 0.58) kind='good';
        else if(p < 0.90) kind='bad';
        else kind='shield';
      }else{
        if(p < 0.64) kind='good';
        else if(p < 0.88) kind='bad';
        else kind='shield';
      }

      if(kind==='good') makeBubble('good', pick(GOOD), ttlGood);
      else if(kind==='shield') makeBubble('shield', pick(SHLD), 2.6);
      else makeBubble('bad', pick(BAD), ttlBad);
    }
  }

  function updateBubbles(){
    const t=nowMs();
    for(const b of Array.from(bubbles.values())){
      const age=t - b.born;
      if(age >= b.ttl){
        try{ cfg.ai?.onExpire?.(b.kind, { id:b.id, phase }); }catch(e){}

        if(b.kind==='good'){
          miss++;
          missGoodExpired++;   // ✅ แยกสาเหตุ
          combo=0;
          score = Math.max(0, score - 4);
          waterPct = clamp(waterPct - 4.5, 0, 100);
        }
        removeBubble(b.id);
      }
    }
  }

  function checkEnd(){
    if(tLeft<=0){ showEnd('time'); return true; }
    if(miss>=TUNE.missLimit){ showEnd('miss-limit'); return true; }
    if(waterPct<=0){ showEnd('dehydrated'); return true; }
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

    // passive dehydration drift
    waterPct = clamp(waterPct - dt*(diff==='hard'?1.35: diff==='easy'?0.95:1.15), 0, 100);

    spawnTick(dt);
    updateBubbles();

    // ✅ AI HUD (rule-based, deterministic friendly)
    try{
      const risk =
        clamp(
          (miss/Math.max(1, TUNE.missLimit))*0.55 +
          (waterPct<35 ? (35-waterPct)/35*0.35 : 0) +
          (combo===0 ? 0.10 : 0),
          0, 1
        );

      let hint = 'เล็งกลางจอแล้วกดต่อเนื่อง';
      if(phase==='storm') hint = '⚡ STORM! เลี่ยง junk แล้วเก็บ 💧';
      else if(phase==='boss') hint = '👑 BOSS! รักษาน้ำ > 50%';
      else if(waterPct < 35) hint = 'ดื่มน้ำเป้า 💧 ให้ถี่ขึ้น!';
      else if(missBadHit > (TUNE.missLimit*0.5)) hint = 'ระวังโดน junk 🧋';
      else if(combo >= 6) hint = 'คอมโบมาแล้ว! เก็บต่อเลย 🔥';

      cfg.ai?.setRisk?.(risk);
      cfg.ai?.setHint?.(hint);
      setAIHud({ hazardRisk: risk, next5: [hint] });

      // optional: emit tick for logger/future ML
      cfg.ai?.onTick?.(dt, {
        missGoodExpired,
        missJunkHit: missBadHit,
        shield,
        combo,
        waterPct,
        phase
      });
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