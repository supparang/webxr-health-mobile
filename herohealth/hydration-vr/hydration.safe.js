// === /herohealth/hydration-vr/hydration.safe.js ===
// Hydration VR SAFE — PRODUCTION
// ✅ HUD-aware spawn (never under HUD)
// ✅ Pause/Resume on background
// ✅ MISS = bad hit only | EXPIRE separate | BLOCK separate
// ✅ Storm Boss: lightning requires shield + correct LEFT/RIGHT zone (B)
// ✅ Zone switches in chunks (S2)
// FULL v20260303d-HYDRATION-SAFE-LRZONE-STORMBOSS
'use strict';

export function boot(cfg){
  cfg = cfg || {};
  const WIN = window, DOC = document;

  const qs = (k, d='')=>{ try{ return (new URL(location.href)).searchParams.get(k) ?? d; }catch(e){ return d; } };
  const clamp=(v,a,b)=>{ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b,v)); };
  const nowMs = ()=> (performance && performance.now) ? performance.now() : Date.now();
  const nowIso = ()=> new Date().toISOString();
  const safeJson = (o)=>{ try{ return JSON.stringify(o,null,2);}catch(e){return '{}';} };

  const view = String(cfg.view || qs('view','mobile')).toLowerCase();
  const runMode = String(cfg.run || qs('run','play')).toLowerCase();
  const diff = String(cfg.diff || qs('diff','normal')).toLowerCase();
  const plannedSec = clamp(cfg.time ?? qs('time','80'), 20, 300);

  // RNG
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

  const seedStr = String(cfg.seed || qs('seed', String(Date.now())));
  const rng = makeRng(seedStr);
  const r01 = ()=> rng();
  const pick = (arr)=> arr[(r01()*arr.length)|0];

  const pid = String(cfg.pid || qs('pid','anon')).trim()||'anon';
  const hubUrl = String(cfg.hub || qs('hub','../hub.html'));

  // zone key
  const HH_CAT='nutrition';
  const HH_GAME='hydration';
  const cooldownRequired = !!cfg.cooldown || (qs('cooldown','0')==='1') || (qs('cd','0')==='1');

  // DOM
  const layer = DOC.getElementById('layer');
  if(!layer){ console.warn('[Hydration] Missing #layer'); return; }

  const stageEl = DOC.getElementById('stage') || layer.parentElement;
  const stormFx = DOC.getElementById('stormFx');
  const hudEl = DOC.querySelector('.hud');
  const zoneSign = DOC.getElementById('zoneSign');

  function setStorm(on){
    try{ stageEl?.classList?.toggle('is-storm', !!on); }catch(e){}
    try{ stageEl?.classList?.toggle('is-boss', false); }catch(e){}
    try{ if(stormFx) stormFx.style.opacity = on ? '1' : '0'; }catch(e){}
  }
  function setBoss(on){
    try{ stageEl?.classList?.toggle('is-boss', !!on); }catch(e){}
    try{ if(stormFx) stormFx.style.opacity = on ? '1' : '0'; }catch(e){}
  }

  const ui = {
    score: DOC.getElementById('uiScore'),
    time: DOC.getElementById('uiTime'),
    miss: DOC.getElementById('uiMiss'),
    expire: DOC.getElementById('uiExpire'),
    block: DOC.getElementById('uiBlock'),
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

  // tuning by diff
  const TUNE = (function(){
    let spawnBase=0.78, ttlGood=2.9, ttlBad=3.0;
    let missLimit=6;
    let waterGain=7.5, waterLoss=6.0;
    let shieldDrop=0.14;

    // storm
    let stormSec=12;
    let stormSpawnMul=1.30;
    let stormBadP=0.45;
    let stormTtlGoodMul=0.95;

    // boss
    let bossNeedHits=18;
    let bossSpawnMul=1.15;
    let bossBadP=0.40;

    // lightning
    let lightningRate=0.9;      // strikes/sec
    let bossLightningRate=1.2;
    let lightningDmgWater=7.0;
    let lightningDmgScore=6;

    // zone switching (S2)
    let zoneChunkSec=3.0;       // switch every 3s

    if(diff==='easy'){
      spawnBase=0.66; ttlGood=3.2; ttlBad=3.2; missLimit=8; waterGain=8.5; waterLoss=5.2; shieldDrop=0.10;
      stormSec=10; stormSpawnMul=1.20; stormBadP=0.38; stormTtlGoodMul=1.00;
      bossNeedHits=14; bossSpawnMul=1.08; bossBadP=0.34;
      lightningRate=0.65; bossLightningRate=0.90;
      lightningDmgWater=5.5; lightningDmgScore=4;
      zoneChunkSec=3.5;
    }
    if(diff==='hard'){
      spawnBase=0.95; ttlGood=2.5; ttlBad=2.6; missLimit=5; waterGain=6.8; waterLoss=7.0; shieldDrop=0.18;
      stormSec=14; stormSpawnMul=1.45; stormBadP=0.55; stormTtlGoodMul=0.92;
      bossNeedHits=22; bossSpawnMul=1.22; bossBadP=0.50;
      lightningRate=1.05; bossLightningRate=1.55;
      lightningDmgWater=8.5; lightningDmgScore=8;
      zoneChunkSec=2.6;
    }

    if(view==='cvr'||view==='vr'){ ttlGood += 0.15; ttlBad += 0.15; }

    return {
      spawnBase, ttlGood, ttlBad, missLimit, waterGain, waterLoss, shieldDrop,
      stormSec, stormSpawnMul, stormBadP, stormTtlGoodMul,
      bossNeedHits, bossSpawnMul, bossBadP,
      lightningRate, bossLightningRate, lightningDmgWater, lightningDmgScore,
      zoneChunkSec
    };
  })();

  // state
  const startTimeIso = nowIso();
  let playing=true;
  let paused=false;
  let tLeft=plannedSec;
  let lastTick=nowMs();

  let score=0;

  // counters
  let missBadHit=0;
  let missGoodExpired=0;
  let blockCount=0;

  let combo=0, bestCombo=0;
  let shield=0;
  let waterPct=30;

  // phases
  let phase='normal'; // normal|storm|boss
  let stormLeft=0;
  let stormDone=false;

  // boss win
  let bossOn=false;
  let bossHits=0;
  let bossGoal=0;

  // lightning zone (B + S2): 'L' or 'R'
  let needZone='L';
  let zoneT=0;

  // input aim (for zone check)
  let aimX01=0.5; // 0..1
  function updateAimFromEvent(ev){
    try{
      const r = layer.getBoundingClientRect();
      const x = clamp((ev.clientX - r.left) / Math.max(1, r.width), 0, 1);
      aimX01 = x;
    }catch(e){}
  }

  // capture aiming on mobile
  layer.addEventListener('pointermove', (ev)=>{ updateAimFromEvent(ev); }, { passive:true });
  layer.addEventListener('pointerdown', (ev)=>{ updateAimFromEvent(ev); }, { passive:true });

  // targets
  const bubbles = new Map();
  let idSeq=1;

  const GOOD = ['💧','💦','🫗'];
  const BAD  = ['🧋','🥤','🍟'];
  const SHLD = ['🛡️'];

  function layerRect(){ return layer.getBoundingClientRect(); }

  function gradeFromScore(s){
    const played = Math.max(1, plannedSec - tLeft);
    const sps = s/played;
    const x = sps*10 - missBadHit*0.55 - missGoodExpired*0.08;
    if(x>=70) return 'S';
    if(x>=55) return 'A';
    if(x>=40) return 'B';
    if(x>=28) return 'C';
    return 'D';
  }

  function setHUD(){
    ui.score && (ui.score.textContent=String(score|0));
    ui.time && (ui.time.textContent=String(Math.ceil(tLeft)));
    ui.miss && (ui.miss.textContent=String(missBadHit|0));
    ui.expire && (ui.expire.textContent=String(missGoodExpired|0));
    ui.block && (ui.block.textContent=String(blockCount|0));
    ui.grade && (ui.grade.textContent=gradeFromScore(score));
    ui.water && (ui.water.textContent=`${Math.round(clamp(waterPct,0,100))}%`);
    ui.combo && (ui.combo.textContent=String(combo|0));
    ui.shield && (ui.shield.textContent=String(shield|0));

    if(ui.phase){
      if(phase==='storm') ui.phase.textContent = `STORM ${needZone==='L'?'LEFT':'RIGHT'}`;
      else if(phase==='boss') ui.phase.textContent = `BOSS ${bossHits}/${bossGoal} ${needZone==='L'?'LEFT':'RIGHT'}`;
      else ui.phase.textContent = 'NORMAL';
    }

    if(zoneSign){
      if(phase==='storm' || phase==='boss'){
        zoneSign.textContent = (needZone==='L')
          ? '⬅️ SAFE ZONE: LEFT (ต้องมีโล่)'
          : '➡️ SAFE ZONE: RIGHT (ต้องมีโล่)';
      }else{
        zoneSign.textContent = '';
      }
    }
  }

  function setAIHud(risk, hint){
    try{
      if(ui.aiRisk) ui.aiRisk.textContent = String((+risk).toFixed(2));
      if(ui.aiHint) ui.aiHint.textContent = String(hint || '—');
    }catch(e){}
  }

  // FX
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

  // HUD-aware spawn (avoid HUD)
  let _hudBottom = 160;
  function measureHudBottom(){
    try{
      if(!hudEl) return;
      const rect = hudEl.getBoundingClientRect();
      if(rect && rect.height > 10) _hudBottom = Math.max(0, rect.bottom);
    }catch(e){}
  }
  measureHudBottom();
  WIN.addEventListener('resize', ()=>setTimeout(measureHudBottom, 120), { passive:true });
  WIN.addEventListener('orientationchange', ()=>setTimeout(measureHudBottom, 180), { passive:true });
  setInterval(measureHudBottom, 600);

  function safeSpawnXY(){
    const r=layerRect();
    const pad = (view==='mobile') ? 18 : 22;
    const gap = (view==='mobile') ? 14 : 12;
    const yMin = clamp((_hudBottom - r.top) + gap, pad + 10, r.height - 60);
    const bottomPad = (view==='mobile') ? 120 : 90;
    const x = pad + r01()*(Math.max(1, r.width - pad*2));
    const yMax = Math.max(yMin + 1, r.height - bottomPad);
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
    const obj={ id, el, kind, emoji, born, ttl };
    bubbles.set(id,obj);
    return obj;
  }

  function removeBubble(id){
    const b=bubbles.get(String(id));
    if(!b) return;
    bubbles.delete(String(id));
    try{ b.el.remove(); }catch(e){}
  }

  function addShield(){ shield = clamp(shield + 1, 0, 9); }

  function hit(b){
    if(!playing || paused) return;

    if(b.kind==='good'){
      combo++; bestCombo=Math.max(bestCombo, combo);
      score += (10 + Math.min(12, combo));
      waterPct = clamp(waterPct + TUNE.waterGain, 0, 100);

      // boss progress
      if(phase==='boss'){
        bossHits++;
        if(bossHits >= bossGoal){
          showEnd('boss-clear');
          return;
        }
      }

      removeBubble(b.id);
      return;
    }

    if(b.kind==='shield'){
      addShield();
      score += 6;
      removeBubble(b.id);
      return;
    }

    // bad
    if(shield > 0){
      shield--;
      blockCount++;
      score += 2;
      removeBubble(b.id);
      return;
    }

    missBadHit++;
    combo=0;
    score = Math.max(0, score - 8);
    waterPct = clamp(waterPct - TUNE.waterLoss, 0, 100);
    removeBubble(b.id);
  }

  layer.addEventListener('pointerdown', (ev)=>{
    if(!playing || paused) return;
    const el = ev.target?.closest?.('.bubble');
    if(!el) return;
    const b=bubbles.get(String(el.dataset.id));
    if(b) hit(b);
  }, { passive:true });

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
    // cVR ยิงกลางจอ = aimX01 ~ 0.5
    aimX01 = 0.5;
    const b = pickClosestToCenter(ev?.detail?.lockPx ?? 56);
    if(b) hit(b);
  });

  // ===== LEFT/RIGHT zone logic (B + S2) =====
  function isInNeededZone(){
    // L: aimX01 < 0.5, R: aimX01 >= 0.5
    return (needZone==='L') ? (aimX01 < 0.5) : (aimX01 >= 0.5);
  }

  function swapZone(){
    needZone = (needZone === 'L') ? 'R' : 'L';
  }

  function applyLightningStrike(source){
    // must have shield + be in correct zone
    const okZone = isInNeededZone();
    if(shield > 0 && okZone){
      shield--;
      blockCount++;
      return;
    }

    // fail: take damage (no MISS)
    combo = 0;
    waterPct = clamp(waterPct - TUNE.lightningDmgWater, 0, 100);
    score = Math.max(0, score - TUNE.lightningDmgScore);
  }

  // ===== Pause overlay =====
  let pauseOverlay=null;
  function showPauseOverlay(){
    if(pauseOverlay) return;
    pauseOverlay = DOC.createElement('div');
    pauseOverlay.style.position='fixed';
    pauseOverlay.style.inset='0';
    pauseOverlay.style.zIndex='95';
    pauseOverlay.style.display='grid';
    pauseOverlay.style.placeItems='center';
    pauseOverlay.style.background='rgba(2,6,23,.72)';
    pauseOverlay.style.backdropFilter='blur(8px)';
    pauseOverlay.innerHTML = `
      <div style="width:min(520px, calc(100vw - 24px));
        border:1px solid rgba(255,255,255,.10);
        border-radius:22px; padding:16px;
        background: rgba(2,6,23,.85);
        box-shadow: 0 18px 40px rgba(0,0,0,.45); text-align:center;">
        <div style="font-weight:1000;font-size:22px;">Paused</div>
        <div style="opacity:.8;margin-top:6px;font-size:12px;">แตะเพื่อเล่นต่อ</div>
        <button id="btnResume" style="margin-top:14px;border:1px solid rgba(255,255,255,.10);
          background: rgba(56,189,248,.18); color:#e5e7eb;border-radius:14px;padding:10px 14px;font-weight:1000;">
          Resume
        </button>
      </div>
    `;
    DOC.body.appendChild(pauseOverlay);
    const resume = ()=>{
      hidePauseOverlay();
      paused=false;
      lastTick=nowMs();
      requestAnimationFrame(loop);
    };
    pauseOverlay.addEventListener('pointerdown', resume, { passive:true });
    const btn = DOC.getElementById('btnResume');
    if(btn) btn.onclick = resume;
  }
  function hidePauseOverlay(){
    if(!pauseOverlay) return;
    pauseOverlay.remove();
    pauseOverlay=null;
  }

  // ===== End summary =====
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
      projectTag:'HydrationVR',
      gameVersion:'HydrationVR_SAFE_2026-03-03d_LRZoneStormBoss',
      device:view, runMode, diff, seed:seedStr,
      reason:String(reason||''),
      durationPlannedSec: plannedSec,
      durationPlayedSec: Math.round(plannedSec - tLeft),
      scoreFinal: score|0,
      missBadHit: missBadHit|0,
      missGoodExpired: missGoodExpired|0,
      blockCount: blockCount|0,
      comboMax: bestCombo|0,
      shield: shield|0,
      waterPct: Math.round(clamp(waterPct,0,100)),
      phaseFinal: phase,
      bossHits: bossHits|0,
      bossGoal: bossGoal|0,
      startTimeIso,
      endTimeIso: nowIso(),
      grade: gradeFromScore(score)
    };
  }

  function setEndButtons(summary){
    if(ui.btnBackHub) ui.btnBackHub.onclick = ()=>{ location.href = hubUrl; };
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
        const txt = safeJson(summary);
        try{ await navigator.clipboard.writeText(txt); }
        catch(e){ try{ prompt('Copy Summary JSON:', txt); }catch(_){ } }
      };
    }
  }

  function showEnd(reason){
    playing=false;
    paused=false;
    hidePauseOverlay();

    setStorm(false);
    setBoss(false);

    for(const b of bubbles.values()){ try{ b.el.remove(); }catch(e){} }
    bubbles.clear();

    const summary = buildSummary(reason);
    dispatchEndOnce(summary);

    if(ui.end){
      ui.end.setAttribute('aria-hidden','false');
      ui.endTitle && (ui.endTitle.textContent = (reason==='boss-clear') ? 'BOSS CLEAR!' : 'Game Over');
      ui.endSub && (ui.endSub.textContent=`reason=${summary.reason} | mode=${runMode} | view=${view} | seed=${seedStr}`);
      ui.endGrade && (ui.endGrade.textContent=summary.grade||'—');
      ui.endScore && (ui.endScore.textContent=String(summary.scoreFinal|0));
      ui.endMiss && (ui.endMiss.textContent=String(summary.missBadHit|0));
      ui.endWater && (ui.endWater.textContent=`${summary.waterPct}%`);
      setEndButtons(summary);
    }
  }

  // ===== spawn & phases =====
  let spawnAcc=0;

  function spawnTick(dt){
    // shield decay
    if(shield>0 && r01() < dt*TUNE.shieldDrop) shield = Math.max(0, shield-1);

    // start storm once mid-game
    if(!stormDone && phase==='normal' && tLeft <= plannedSec*0.62){
      phase='storm';
      stormLeft=TUNE.stormSec;
      stormDone=true;
      zoneT=0;
      needZone = (r01()<0.5) ? 'L' : 'R';
      setStorm(true);
      lightning();
    }

    // storm zone switching (S2)
    if(phase==='storm'){
      stormLeft = Math.max(0, stormLeft - dt);
      zoneT += dt;
      if(zoneT >= TUNE.zoneChunkSec){
        zoneT = 0;
        swapZone();
      }

      // lightning strikes (requires shield+zone)
      if(r01() < dt * TUNE.lightningRate){
        lightning();
        applyLightningStrike('storm');
      }

      if(stormLeft <= 0){
        phase='normal';
        setStorm(false);
      }
    }

    // boss trigger after storm happened
    if(!bossOn && stormDone && phase!=='storm'){
      if(tLeft <= plannedSec*0.38 && waterPct >= 55){
        bossOn=true;
        phase='boss';
        bossHits=0;
        bossGoal=TUNE.bossNeedHits;
        zoneT=0;
        needZone = (r01()<0.5) ? 'L' : 'R';
        setBoss(true);
        lightning();
      }
    }

    // boss zone switching + heavier lightning
    if(phase==='boss'){
      zoneT += dt;
      if(zoneT >= TUNE.zoneChunkSec){
        zoneT = 0;
        swapZone();
      }

      if(r01() < dt * TUNE.bossLightningRate){
        lightning();
        applyLightningStrike('boss');
      }
    }

    const inStorm = (phase==='storm');
    const inBoss  = (phase==='boss');

    const spawnRate = TUNE.spawnBase * (inStorm ? TUNE.stormSpawnMul : inBoss ? TUNE.bossSpawnMul : 1.0);
    const ttlGood = TUNE.ttlGood * (inStorm ? TUNE.stormTtlGoodMul : 1.0);
    const ttlBad  = TUNE.ttlBad  * (inStorm ? 0.95 : 1.0);

    spawnAcc += spawnRate * dt;
    while(spawnAcc >= 1){
      spawnAcc -= 1;

      const p=r01();
      let kind='good';

      if(inStorm){
        if(p < (1.0 - TUNE.stormBadP - 0.07)) kind='good';
        else if(p < (1.0 - 0.07)) kind='bad';
        else kind='shield';
      }else if(inBoss){
        if(p < (1.0 - TUNE.bossBadP - 0.08)) kind='good';
        else if(p < (1.0 - 0.08)) kind='bad';
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
      if(t - b.born >= b.ttl){
        if(b.kind==='good'){
          missGoodExpired++;
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
    if(missBadHit >= TUNE.missLimit){ showEnd('miss-limit'); return true; }
    if(waterPct<=0){ showEnd('dehydrated'); return true; }
    return false;
  }

  function loop(){
    if(!playing) return;

    if(paused){
      lastTick = nowMs();
      setHUD();
      requestAnimationFrame(loop);
      return;
    }

    const t=nowMs();
    const dt=Math.min(0.05, Math.max(0.001, (t-lastTick)/1000));
    lastTick=t;

    tLeft=Math.max(0, tLeft-dt);
    waterPct = clamp(waterPct - dt*(diff==='hard'?1.35: diff==='easy'?0.95:1.15), 0, 100);

    spawnTick(dt);
    updateBubbles();

    // AI HUD
    try{
      const missPressure = (missBadHit/Math.max(1, TUNE.missLimit));
      const expirePressure = clamp(missGoodExpired/25, 0, 1);
      const lowWater = (waterPct<35) ? (35-waterPct)/35 : 0;
      const risk = clamp(missPressure*0.55 + lowWater*0.35 + expirePressure*0.10, 0, 1);

      let hint='เล็ง + เก็บน้ำ 💧';
      if(phase==='storm') hint=`⚡ ฟ้าผ่า! ต้องอยู่ ${needZone==='L'?'ซ้าย':'ขว'} + มีโล่ 🛡️`;
      else if(phase==='boss') hint=`👑 บอส! เก็บน้ำ ${bossHits}/${bossGoal} | อยู่ ${needZone==='L'?'ซ้าย':'ขว'} + โล่`;
      else if(waterPct<35) hint='น้ำต่ำ! รีบเก็บ 💧';
      else if(shield===0) hint='หาโล่ 🛡️ ไว้กันฟ้าผ่า';
      else if(combo>=6) hint='คอมโบมาแล้ว!';

      cfg.ai?.setRisk?.(risk);
      cfg.ai?.setHint?.(hint);
      setAIHud(risk, hint);
    }catch(e){}

    setHUD();
    if(checkEnd()) return;
    requestAnimationFrame(loop);
  }

  // background => pause
  DOC.addEventListener('visibilitychange', ()=>{
    if(!playing) return;
    if(DOC.hidden){
      paused=true;
      showPauseOverlay();
      return;
    }
    if(paused) showPauseOverlay();
  });

  // start
  setHUD();
  requestAnimationFrame(loop);
}