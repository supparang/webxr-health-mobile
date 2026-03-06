// === /herohealth/hydration-vr/hydration.safe.js ===
// Hydration VR SAFE — PRODUCTION
// ✅ FX++ : combo popup, phase banner, better pop feedback
// ✅ All previous systems kept (PauseFix, LR zone B+S2, Storm/Boss/Final, cooldown, cVR pad/tilt)
// FULL v20260305c-HYDRATION-SAFE-FXPLUS
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

  function emojiFor(diffKey, phase){
    diffKey = String(diffKey||'normal').toLowerCase();
    const P = String(phase||'normal').toLowerCase();
    if(diffKey === 'easy'){
      if(P==='storm') return '🌦️⚡';
      if(P==='boss')  return '⛈️⚡';
      if(P==='final') return '🌩️👑⚡';
      return '💧';
    }
    if(diffKey === 'hard'){
      if(P==='storm') return '🌪️⚡⚡⚡';
      if(P==='boss')  return '🌀🌩️⚡⚡⚡';
      if(P==='final') return '🌪️👑⚡⚡⚡🔥';
      return '💧';
    }
    if(P==='storm') return '🌩️⚡⚡';
    if(P==='boss')  return '⛈️🌀⚡';
    if(P==='final') return '🌪️👑⚡⚡';
    return '💧';
  }

  // cooldown
  function hhDayKey(){
    const d=new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
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

  const HH_CAT='nutrition';
  const HH_GAME='hydration';
  const cooldownRequired = !!cfg.cooldown || (qs('cooldown','0')==='1') || (qs('cd','0')==='1');

  // DOM
  const layer = DOC.getElementById('layer');
  if(!layer){ console.warn('[Hydration] Missing #layer'); return; }

  const stageEl = DOC.getElementById('stage') || layer.parentElement;
  const hudEl = DOC.querySelector('.hud');
  const zoneSign = DOC.getElementById('zoneSign');
  const btnZoneL = DOC.getElementById('btnZoneL');
  const btnZoneR = DOC.getElementById('btnZoneR');

  function setStagePhase(p){
    try{
      stageEl?.classList?.toggle('is-storm', p==='storm');
      stageEl?.classList?.toggle('is-boss',  p==='boss');
      stageEl?.classList?.toggle('is-final', p==='final');
    }catch(e){}
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

  // tuning
  const TUNE = (function(){
    let spawnBase=0.78, ttlGood=2.9, ttlBad=3.0;
    let missLimit=6;
    let waterGain=7.5, waterLoss=6.0;
    let shieldDrop=0.14;

    let stormSec=12, stormSpawnMul=1.30, stormBadP=0.45, stormTtlGoodMul=0.95;
    let bossNeedHits=18, bossSpawnMul=1.15, bossBadP=0.40;

    let lightningRate=0.9, bossLightningRate=1.2;
    let lightningDmgWater=7.0, lightningDmgScore=6;

    let finalNeedHits=10, finalSec=10, finalSpawnMul=1.35, finalBadP=0.55, finalLightningRate=1.35;
    let zoneChunkSec=3.0;

    if(diff==='easy'){
      spawnBase=0.66; ttlGood=3.2; ttlBad=3.2; missLimit=8; waterGain=8.5; waterLoss=5.2; shieldDrop=0.10;
      stormSec=10; stormSpawnMul=1.20; stormBadP=0.38; stormTtlGoodMul=1.00;
      bossNeedHits=14; bossSpawnMul=1.08; bossBadP=0.34;
      lightningRate=0.65; bossLightningRate=0.90;
      lightningDmgWater=5.5; lightningDmgScore=4;
      finalNeedHits=7; finalSec=9; finalSpawnMul=1.20; finalBadP=0.45; finalLightningRate=1.05;
      zoneChunkSec=3.5;
    }
    if(diff==='hard'){
      spawnBase=0.95; ttlGood=2.5; ttlBad=2.6; missLimit=5; waterGain=6.8; waterLoss=7.0; shieldDrop=0.18;
      stormSec=14; stormSpawnMul=1.45; stormBadP=0.55; stormTtlGoodMul=0.92;
      bossNeedHits=22; bossSpawnMul=1.22; bossBadP=0.50;
      lightningRate=1.05; bossLightningRate=1.55;
      lightningDmgWater=8.5; lightningDmgScore=8;
      finalNeedHits=12; finalSec=10; finalSpawnMul=1.55; finalBadP=0.62; finalLightningRate=1.75;
      zoneChunkSec=2.6;
    }
    if(view==='cvr'||view==='vr'){ ttlGood += 0.15; ttlBad += 0.15; }
    return {
      spawnBase, ttlGood, ttlBad, missLimit, waterGain, waterLoss, shieldDrop,
      stormSec, stormSpawnMul, stormBadP, stormTtlGoodMul,
      bossNeedHits, bossSpawnMul, bossBadP,
      lightningRate, bossLightningRate, lightningDmgWater, lightningDmgScore,
      finalNeedHits, finalSec, finalSpawnMul, finalBadP, finalLightningRate,
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
  let missBadHit=0;
  let missGoodExpired=0;
  let blockCount=0;

  let combo=0, bestCombo=0;
  let shield=0;
  let waterPct=30;

  let phase='normal';
  let stormLeft=0;
  let stormDone=false;

  let bossHits=0, bossGoal=0;

  let finalHits=0, finalGoal=0;
  let finalLeft=0;

  let needZone='L';
  let zoneT=0;

  // aim
  let aimX01=0.5;
  function isInNeededZone(){ return (needZone==='L') ? (aimX01 < 0.5) : (aimX01 >= 0.5); }
  function swapZone(){ needZone = (needZone === 'L') ? 'R' : 'L'; }
  function updateAimFromEvent(ev){
    try{
      const r = layer.getBoundingClientRect();
      const x = clamp((ev.clientX - r.left) / Math.max(1, r.width), 0, 1);
      aimX01 = x;
    }catch(e){}
  }
  layer.addEventListener('pointermove', (ev)=>{ updateAimFromEvent(ev); }, { passive:true });
  layer.addEventListener('pointerdown', (ev)=>{ updateAimFromEvent(ev); }, { passive:true });
  if(btnZoneL && btnZoneR){
    btnZoneL.onclick = ()=>{ aimX01 = 0.25; };
    btnZoneR.onclick = ()=>{ aimX01 = 0.75; };
  }
  if(view==='cvr' || view==='vr'){
    WIN.addEventListener('deviceorientation', (ev)=>{
      try{
        const g = Number(ev?.gamma);
        if(!Number.isFinite(g)) return;
        const x01 = clamp((g + 30) / 60, 0, 1);
        aimX01 = clamp(aimX01*0.65 + x01*0.35, 0, 1);
      }catch(e){}
    }, { passive:true });
  }

  // Pause overlay
  const HydPause = (() => {
    let overlay = null;
    function show(){
      if(overlay) return;
      overlay = DOC.createElement('div');
      overlay.style.position='fixed';
      overlay.style.inset='0';
      overlay.style.zIndex='95';
      overlay.style.display='grid';
      overlay.style.placeItems='center';
      overlay.style.background='rgba(2,6,23,.72)';
      overlay.style.backdropFilter='blur(8px)';
      overlay.innerHTML = `
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
      DOC.body.appendChild(overlay);

      const resume = ()=>{
        hide();
        paused = false;
        lastTick = nowMs();
        requestAnimationFrame(loop);
      };
      overlay.addEventListener('pointerdown', resume, { passive:true });
      const btn = DOC.getElementById('btnResume');
      if(btn) btn.onclick = resume;
    }
    function hide(){
      if(!overlay) return;
      try{ overlay.remove(); }catch(e){}
      overlay = null;
    }
    return { show, hide };
  })();

  // ===== FX helpers =====
  function fxShake(){
    try{
      if(!stageEl) return;
      stageEl.classList.remove('fx-shake');
      void stageEl.offsetWidth;
      stageEl.classList.add('fx-shake');
      setTimeout(()=>{ try{ stageEl.classList.remove('fx-shake'); }catch(e){} }, 220);
    }catch(e){}
  }
  function fxRing(x, y){
    try{
      const el = DOC.createElement('div');
      el.className = 'fx-ring';
      el.style.left = `${x}px`;
      el.style.top  = `${y}px`;
      layer.appendChild(el);
      setTimeout(()=>{ try{ el.remove(); }catch(e){} }, 520);
    }catch(e){}
  }
  function fxScore(x, y, text){
    try{
      const el = DOC.createElement('div');
      el.className = 'fx-score';
      el.textContent = String(text||'');
      el.style.left = `${x}px`;
      el.style.top  = `${y}px`;
      layer.appendChild(el);
      setTimeout(()=>{ try{ el.remove(); }catch(e){} }, 900);
    }catch(e){}
  }
  function fxBubblePop(bubbleEl, kind){
    try{
      if(!bubbleEl) return;
      bubbleEl.classList.remove('fx-pop','fx-bad');
      void bubbleEl.offsetWidth;
      bubbleEl.classList.add(kind==='bad' ? 'fx-bad' : 'fx-pop');
    }catch(e){}
  }
  function fxPhaseBanner(text){
    // centered banner using fxScore + ring
    try{
      const r = layer.getBoundingClientRect();
      const cx = r.width/2;
      const cy = Math.max(120, Math.min(r.height*0.30, 260));
      fxRing(cx, cy);
      fxScore(cx, cy, text);
      fxShake();
    }catch(e){}
  }

  // lightning visuals
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

  // targets
  const bubbles = new Map();
  let idSeq=1;
  const GOOD = ['💧','💦','🫗'];
  const BAD  = ['🧋','🥤','🍟'];
  const SHLD = ['🛡️'];

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
      const emo = emojiFor(diff, phase);
      if(phase==='storm') ui.phase.textContent = `${emo} STORM ${needZone==='L'?'LEFT':'RIGHT'}`;
      else if(phase==='boss') ui.phase.textContent = `${emo} BOSS ${bossHits}/${bossGoal} ${needZone==='L'?'LEFT':'RIGHT'}`;
      else if(phase==='final') ui.phase.textContent = `${emo} FINAL ${finalHits}/${finalGoal} ${needZone==='L'?'LEFT':'RIGHT'}`;
      else ui.phase.textContent = `💧 NORMAL`;
    }

    if(zoneSign){
      if(phase==='storm' || phase==='boss' || phase==='final'){
        const emo = emojiFor(diff, phase);
        zoneSign.textContent = `${emo} SAFE: ${needZone==='L'?'⬅️LEFT':'➡️RIGHT'} + 🛡️`;
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

  // HUD-aware spawn
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
    const r=layer.getBoundingClientRect();
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

  function applyLightningStrike(rate){
    if(r01() < rate){
      lightning();
      fxShake();
      try{
        const r = layer.getBoundingClientRect();
        fxRing(r.width/2, r.height/2);
        fxScore(r.width/2, r.height/2, '⚡');
      }catch(e){}

      const okZone = isInNeededZone();
      if(shield > 0 && okZone){
        shield--;
        blockCount++;
        fxScore(120, 230, 'BLOCK⚡');
      }else{
        combo = 0;
        waterPct = clamp(waterPct - TUNE.lightningDmgWater, 0, 100);
        score = Math.max(0, score - TUNE.lightningDmgScore);
        fxScore(120, 230, `-${TUNE.lightningDmgScore}⚡`);
      }
    }
  }

  function hit(b){
    if(!playing || paused) return;

    let bx=0, by=0;
    try{
      const bb = b.el.getBoundingClientRect();
      const lr = layer.getBoundingClientRect();
      bx = (bb.left + bb.width/2) - lr.left;
      by = (bb.top + bb.height/2) - lr.top;
    }catch(e){}

    if(b.kind==='good'){
      combo++; bestCombo=Math.max(bestCombo, combo);

      // combo multiplier text (visual only)
      const mult = (combo>=14) ? 3 : (combo>=7) ? 2 : 1;
      const add = Math.round((10 + Math.min(12, combo)) * mult);

      score += add;
      waterPct = clamp(waterPct + TUNE.waterGain, 0, 100);

      fxBubblePop(b.el, 'good');
      fxRing(bx, by);
      fxScore(bx, by, `+${add}${mult>1?` x${mult}`:''}`);

      if(phase==='boss'){
        bossHits++;
        fxScore(bx, by-12, `${bossHits}/${bossGoal}`);
        if(bossHits >= bossGoal){
          phase = 'final';
          setStagePhase('final');
          finalHits = 0;
          finalGoal = TUNE.finalNeedHits;
          finalLeft = TUNE.finalSec;
          zoneT = 0;
          needZone = (r01()<0.5) ? 'L' : 'R';
          fxPhaseBanner(`${emojiFor(diff,'final')} FINAL BOSS`);
        }
      }else if(phase==='final'){
        finalHits++;
        fxScore(bx, by-12, `${finalHits}/${finalGoal}`);
        if(finalHits >= finalGoal){
          showEnd('final-clear');
          return;
        }
      }

      setTimeout(()=>removeBubble(b.id), 50);
      return;
    }

    if(b.kind==='shield'){
      addShield();
      score += 6;

      fxBubblePop(b.el, 'good');
      fxRing(bx, by);
      fxScore(bx, by, '🛡️+1');

      setTimeout(()=>removeBubble(b.id), 50);
      return;
    }

    // bad
    if(shield > 0){
      shield--;
      blockCount++;
      score += 2;

      fxBubblePop(b.el, 'bad');
      fxRing(bx, by);
      fxScore(bx, by, 'BLOCK');

      setTimeout(()=>removeBubble(b.id), 50);
      return;
    }

    missBadHit++;
    combo=0;
    score = Math.max(0, score - 8);
    waterPct = clamp(waterPct - TUNE.waterLoss, 0, 100);

    fxShake();
    fxBubblePop(b.el, 'bad');
    fxRing(bx, by);
    fxScore(bx, by, '-8');

    setTimeout(()=>removeBubble(b.id), 50);
  }

  // click/tap
  layer.addEventListener('pointerdown', (ev)=>{
    if(!playing || paused) return;
    const el = ev.target?.closest?.('.bubble');
    if(!el) return;
    const b=bubbles.get(String(el.dataset.id));
    if(b) hit(b);
  }, { passive:true });

  // cVR shoot
  function pickClosestToCenter(lockPx){
    lockPx = clamp(lockPx ?? 56, 16, 160);
    let best=null, bestD=1e9;
    const r=layer.getBoundingClientRect();
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
    const b = pickClosestToCenter(ev?.detail?.lockPx ?? 56);
    if(b) hit(b);
  });

  // expire
  function updateBubbles(){
    const t=nowMs();
    const lr = layer.getBoundingClientRect();

    for(const b of Array.from(bubbles.values())){
      if(t - b.born >= b.ttl){
        if(b.kind==='good'){
          missGoodExpired++;
          combo=0;
          score = Math.max(0, score - 4);
          waterPct = clamp(waterPct - 4.5, 0, 100);

          try{
            const bb = b.el.getBoundingClientRect();
            const bx = (bb.left + bb.width/2) - lr.left;
            const by = (bb.top + bb.height/2) - lr.top;
            fxBubblePop(b.el, 'bad');
            fxRing(bx, by);
            fxScore(bx, by, 'MISS💧');
          }catch(e){}
        }else{
          try{ fxBubblePop(b.el, 'good'); }catch(e){}
        }
        setTimeout(()=>removeBubble(b.id), 40);
      }
    }
  }

  // end & summary
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
      gameVersion:'HydrationVR_SAFE_2026-03-05c_FXPlus',
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
      bossHits: bossHits|0, bossGoal: bossGoal|0,
      finalHits: finalHits|0, finalGoal: finalGoal|0,
      startTimeIso,
      endTimeIso: nowIso(),
      grade: gradeFromScore(score)
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
    HydPause.hide();
    setStagePhase('normal');

    for(const b of bubbles.values()){ try{ b.el.remove(); }catch(e){} }
    bubbles.clear();

    const summary = buildSummary(reason);
    dispatchEndOnce(summary);

    if(ui.end){
      ui.end.setAttribute('aria-hidden','false');
      const title =
        (reason==='final-clear') ? 'FINAL CLEAR!' :
        (reason==='boss-clear')  ? 'BOSS CLEAR!' :
        'Game Over';
      ui.endTitle && (ui.endTitle.textContent = title);
      ui.endSub && (ui.endSub.textContent=`reason=${summary.reason} | mode=${runMode} | view=${view} | seed=${seedStr}`);
      ui.endGrade && (ui.endGrade.textContent=summary.grade||'—');
      ui.endScore && (ui.endScore.textContent=String(summary.scoreFinal|0));
      ui.endMiss && (ui.endMiss.textContent=String(summary.missBadHit|0));
      ui.endWater && (ui.endWater.textContent=`${summary.waterPct}%`);
      setEndButtons(summary);
    }
  }

  function checkEnd(){
    if(tLeft<=0){ showEnd('time'); return true; }
    if(missBadHit >= TUNE.missLimit){ showEnd('miss-limit'); return true; }
    if(waterPct<=0){ showEnd('dehydrated'); return true; }
    return false;
  }

  // spawn
  let spawnAcc=0;
  function spawnTick(dt){
    if(shield>0 && r01() < dt*TUNE.shieldDrop) shield = Math.max(0, shield-1);

    if(!stormDone && phase==='normal' && tLeft <= plannedSec*0.62){
      phase='storm'; setStagePhase('storm');
      stormLeft=TUNE.stormSec; stormDone=true;
      zoneT=0; needZone = (r01()<0.5) ? 'L' : 'R';
      lightning();
      fxPhaseBanner(`${emojiFor(diff,'storm')} STORM`);
    }

    if(phase==='storm'){
      stormLeft = Math.max(0, stormLeft - dt);
      zoneT += dt;
      if(zoneT >= TUNE.zoneChunkSec){ zoneT = 0; swapZone(); }
      applyLightningStrike(dt * TUNE.lightningRate);
      if(stormLeft <= 0){
        phase='normal'; setStagePhase('normal');
      }
    }

    if(phase==='normal' && stormDone){
      if(tLeft <= plannedSec*0.38 && waterPct >= 55){
        phase='boss'; setStagePhase('boss');
        bossHits=0; bossGoal=TUNE.bossNeedHits;
        zoneT=0; needZone = (r01()<0.5) ? 'L' : 'R';
        lightning();
        fxPhaseBanner(`${emojiFor(diff,'boss')} BOSS`);
      }
    }

    if(phase==='boss'){
      zoneT += dt;
      if(zoneT >= TUNE.zoneChunkSec){ zoneT = 0; swapZone(); }
      applyLightningStrike(dt * TUNE.bossLightningRate);
    }

    if(phase==='final'){
      finalLeft = Math.max(0, finalLeft - dt);
      zoneT += dt;
      if(zoneT >= TUNE.zoneChunkSec){ zoneT = 0; swapZone(); }
      applyLightningStrike(dt * TUNE.finalLightningRate);
      if(finalLeft <= 0){
        showEnd('final-timeout'); return;
      }
    }

    const inStorm = (phase==='storm');
    const inBoss  = (phase==='boss');
    const inFinal = (phase==='final');

    const spawnRate = TUNE.spawnBase * (inStorm ? TUNE.stormSpawnMul : inBoss ? TUNE.bossSpawnMul : inFinal ? TUNE.finalSpawnMul : 1.0);
    const ttlGood = TUNE.ttlGood * (inStorm ? TUNE.stormTtlGoodMul : 1.0);
    const ttlBad  = TUNE.ttlBad;

    spawnAcc += spawnRate * dt;
    while(spawnAcc >= 1){
      spawnAcc -= 1;
      const p=r01();
      let kind='good';

      if(inFinal){
        if(p < (1.0 - TUNE.finalBadP - 0.06)) kind='good';
        else if(p < (1.0 - 0.06)) kind='bad';
        else kind='shield';
      }else if(inStorm){
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

  // loop
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

    try{
      const missPressure = (missBadHit/Math.max(1, TUNE.missLimit));
      const expirePressure = clamp(missGoodExpired/25, 0, 1);
      const lowWater = (waterPct<35) ? (35-waterPct)/35 : 0;
      const risk = clamp(missPressure*0.55 + lowWater*0.35 + expirePressure*0.10, 0, 1);

      let hint='เก็บน้ำ 💧 + หาโล่ 🛡️';
      if(phase==='storm') hint=`${emojiFor(diff,'storm')} ฟ้าผ่า! อยู่ ${needZone==='L'?'ซ้าย':'ขวา'} + มีโล่`;
      else if(phase==='boss') hint=`${emojiFor(diff,'boss')} บอส! ${bossHits}/${bossGoal} | อยู่ ${needZone==='L'?'ซ้าย':'ขวา'} + โล่`;
      else if(phase==='final') hint=`${emojiFor(diff,'final')} FINAL! ${finalHits}/${finalGoal} | อยู่ ${needZone==='L'?'ซ้าย':'ขวา'} + โล่`;
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

  DOC.addEventListener('visibilitychange', ()=>{
    if(!playing) return;
    if(DOC.hidden){
      paused=true;
      HydPause.show();
      return;
    }
    if(paused) HydPause.show();
  });

  setHUD();
  requestAnimationFrame(loop);
}