// === /herohealth/vr-brush/brush.safe.js ===
// BrushVR SAFE Engine — DOM90 v0.6
// ✅ Boss patterns (RING/STORM)
// ✅ Pickups: Shield/Cleanser
// ✅ UV refill by Perfect streak
// ✅ NEW: Boss Weak Spot (Phase 3-4) + Combo Bank (spend combo -> UV or Shield)
// Emits: hha:start, hha:time, hha:judge, brush:coverage, brush:gentle, brush:uv, brush:boss, brush:pickup, brush:bank, hha:end
(function(){
  'use strict';
  const WIN = window, DOC = document;

  // ---------- helpers ----------
  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));
  const nowMs = ()=>performance.now();
  const emit = (n,d)=>{ try{ WIN.dispatchEvent(new CustomEvent(n,{detail:d})); }catch(_){ } };
  const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };

  function makeRNG(seed){
    let x = (Number(seed)||Date.now()) >>> 0;
    return ()=> (x = (1664525*x + 1013904223) >>> 0) / 4294967296;
  }

  // ---------- HUD API ----------
  const HUD = (function(){
    const id = (s)=>DOC.getElementById(s);
    const el = {
      tFill:id('tFill'), tLeft:id('tLeft'), tPhase:id('tPhase'),
      cCombo:id('cCombo'), cMul:id('cMul'),
      fFill:id('fFill'), fN:id('fN'),
      cov: { q1:id('cov-q1'), q2:id('cov-q2'), q3:id('cov-q3'), q4:id('cov-q4') },

      toastWrap: id('hud-toast'),
      toastT: id('toastT'),
      toastS: id('toastS'),

      uvWrap: id('hud-uv'),
      uvBtn: id('uvBtn'),
      uvEnergy: id('uvEnergy'),
      uvSub: id('uvSub'),

      bossWrap: id('hud-boss'),
      bFill: id('bFill'),
      bPhase: id('bPhase'),

      // OPTIONAL (if you have it)
      bankBtn: id('bankBtn')
    };

    function setTimer(secLeft, secTotal, phaseLabel){
      if(el.tLeft){
        const m = Math.floor(secLeft/60);
        const s = Math.floor(secLeft%60);
        el.tLeft.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
      }
      if(el.tPhase) el.tPhase.textContent = phaseLabel || '';
      if(el.tFill){
        const pct = secTotal>0 ? (secLeft/secTotal)*100 : 0;
        el.tFill.style.width = `${Math.max(0, Math.min(100, pct))}%`;
      }
    }
    function setCombo(combo, mul){
      if(el.cCombo) el.cCombo.textContent = String(combo||0);
      if(el.cMul) el.cMul.textContent = `x${(mul||1).toFixed(1)}`;
    }
    function setFever(v, max){
      if(el.fN) el.fN.textContent = `${Math.max(0,Math.round(v||0))}/${max||20}`;
      if(el.fFill){
        const pct = max>0 ? (v/max)*100 : 0;
        el.fFill.style.width = `${Math.max(0, Math.min(100, pct))}%`;
      }
    }
    function setCoverage(map, pass, reclaimMap){
      for(const q of ['q1','q2','q3','q4']){
        const cell = el.cov[q];
        if(!cell) continue;
        const pct = Math.round(map[q]||0);
        const pEl = cell.querySelector('.p');
        if(pEl) pEl.textContent = `${pct}%`;
        cell.setAttribute('data-ok', pct >= pass ? '1':'0');
        cell.setAttribute('data-reclaim', reclaimMap && reclaimMap[q] ? '1':'0');
      }
    }

    let toastTimer = null;
    function toast(title, sub, ms=1400){
      if(!el.toastWrap) return;
      if(el.toastT) el.toastT.textContent = title || 'แจ้งเตือน';
      if(el.toastS) el.toastS.textContent = sub || '';
      el.toastWrap.setAttribute('data-on','1');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(()=> el.toastWrap.setAttribute('data-on','0'), ms);
    }

    function showUV(on){
      if(!el.uvWrap) return;
      el.uvWrap.setAttribute('data-on', on ? '1':'0');
    }
    function setUVEnergy(energyLeft, energyMax, uvOn, uvCdLeft){
      if(el.uvSub){
        if(uvOn) el.uvSub.textContent = 'UV ON • ปราบคราบล่องหน!';
        else if(uvCdLeft>0) el.uvSub.textContent = `Cooldown ${(uvCdLeft).toFixed(1)}s`;
        else el.uvSub.textContent = 'Reveal stealth plaque';
      }
      if(el.uvEnergy){
        const dots = el.uvEnergy.querySelectorAll('.dot');
        dots.forEach((d,i)=>{
          const off = (energyLeft||0) <= i;
          d.setAttribute('data-off', off ? '1':'0');
        });
      }
    }

    function showBoss(on){
      if(!el.bossWrap) return;
      el.bossWrap.setAttribute('data-on', on ? '1':'0');
    }
    function setBoss(hp, hpMax, phaseIdx, phaseMax){
      if(el.bFill){
        const pct = hpMax>0 ? (hp/hpMax)*100 : 0;
        el.bFill.style.width = `${Math.max(0, Math.min(100, pct))}%`;
      }
      if(el.bPhase){
        el.bPhase.textContent = `Phase ${phaseIdx}/${phaseMax}`;
      }
    }

    return { setTimer, setCombo, setFever, setCoverage, toast, showUV, setUVEnergy, showBoss, setBoss, el };
  })();

  // ---------- no-spawn zones (HUD aware) ----------
  function rectFromEl(el){
    if(!el) return null;
    const r = el.getBoundingClientRect();
    return { x:r.left, y:r.top, w:r.width, h:r.height };
  }
  function padRect(rc, pad){
    return { x: rc.x - pad, y: rc.y - pad, w: rc.w + pad*2, h: rc.h + pad*2 };
  }
  function pointInRect(p, r){
    return p.x >= r.x && p.x <= r.x+r.w && p.y >= r.y && p.y <= r.y+r.h;
  }
  function buildNoSpawnZones(view){
    const vp = { w: WIN.innerWidth, h: WIN.innerHeight };

    let mTop=96, mBot=140, mL=120, mR=120;
    if(view==='mobile'){ mTop+=16; mBot+=20; mL+=12; mR+=12; }
    if(view==='cvr' || view==='vr'){ mTop+=14; mBot+=18; mL+=16; mR+=16; }

    const safePlay = {
      x: mL, y: mTop,
      w: Math.max(0, vp.w - (mL+mR)),
      h: Math.max(0, vp.h - (mTop+mBot))
    };

    const pad = 10;
    const ids = ['hud-timer','hud-coverage','hud-combo','hud-boss','hud-uv','hud-toast'];
    const zones = [];
    for(const id of ids){
      const el = DOC.getElementById(id);
      if(!el) continue;
      if((id==='hud-boss' || id==='hud-uv' || id==='hud-toast') && el.getAttribute('data-on')==='0') continue;
      const rc = rectFromEl(el);
      if(!rc || rc.w<2 || rc.h<2) continue;
      zones.push(padRect(rc, pad));
    }
    return { safePlay, zones };
  }

  function pickSpawnPoint(rng, ns, radius){
    const { safePlay, zones } = ns;
    const tries = 90;
    const w = Math.max(10, safePlay.w - radius*2);
    const h = Math.max(10, safePlay.h - radius*2);
    for(let i=0;i<tries;i++){
      const x = safePlay.x + radius + rng() * w;
      const y = safePlay.y + radius + rng() * h;
      const p = {x,y};
      let ok = true;
      for(const z of zones){
        if(pointInRect(p, z)){ ok=false; break; }
      }
      if(ok) return p;
    }
    return { x: safePlay.x + safePlay.w/2, y: safePlay.y + safePlay.h/2 };
  }

  // ---------- DOM notes ----------
  function mkNoteEl(kind){
    const el = DOC.createElement('button');
    el.className = 'brush-note';
    el.type = 'button';
    el.setAttribute('aria-label', kind);

    el.style.position='absolute';
    el.style.borderRadius='18px';
    el.style.border='1px solid rgba(148,163,184,.25)';
    el.style.boxShadow='0 10px 26px rgba(0,0,0,.25)';
    el.style.backdropFilter='blur(8px)';
    el.style.webkitBackdropFilter='blur(8px)';
    el.style.display='grid';
    el.style.placeItems='center';
    el.style.fontWeight='900';
    el.style.color='rgba(229,231,235,.95)';
    el.style.cursor='pointer';
    el.style.userSelect='none';
    el.style.webkitTapHighlightColor='transparent';

    el.style.width='48px';
    el.style.height='48px';

    if(kind==='stealth'){
      el.textContent='🟣';
      el.style.background='rgba(168,85,247,.14)';
      el.style.border='1px solid rgba(168,85,247,.30)';
      el.style.opacity='0.10';
    }else if(kind==='boss'){
      el.style.width='58px';
      el.style.height='58px';
      el.style.borderRadius='22px';
      el.textContent='🦠';
      el.style.background='rgba(244,63,94,.16)';
      el.style.border='1px solid rgba(244,63,94,.35)';
      el.style.opacity='0';
    }else if(kind==='weak'){
      // NEW: weak spot boss note
      el.style.width='58px';
      el.style.height='58px';
      el.style.borderRadius='22px';
      el.textContent='🎯';
      el.style.background='rgba(251,191,36,.18)';
      el.style.border='1px solid rgba(251,191,36,.45)';
      el.style.opacity='0';
      el.style.boxShadow='0 0 0 2px rgba(251,191,36,.10), 0 18px 34px rgba(0,0,0,.35)';
    }else if(kind==='shield'){
      el.style.width='52px';
      el.style.height='52px';
      el.style.borderRadius='20px';
      el.textContent='🛡️';
      el.style.background='rgba(34,197,94,.10)';
      el.style.border='1px solid rgba(34,197,94,.34)';
      el.style.opacity='0';
    }else if(kind==='cleanser'){
      el.style.width='52px';
      el.style.height='52px';
      el.style.borderRadius='20px';
      el.textContent='💧';
      el.style.background='rgba(34,211,238,.12)';
      el.style.border='1px solid rgba(34,211,238,.38)';
      el.style.opacity='0';
    }else{
      el.textContent='🦷';
      el.style.background='rgba(34,197,94,.22)';
      el.style.opacity='0';
    }
    return el;
  }

  function popJudgeFx(layer, x, y, judge){
    const fx = DOC.createElement('div');
    fx.textContent = (judge==='perfect') ? 'PERFECT!' : (judge==='good' ? 'GOOD' : (judge==='PICK' ? 'PICK!' : (judge==='WEAK' ? 'WEAK!' : 'MISS')));
    fx.style.position='absolute';
    fx.style.left = `${x}px`;
    fx.style.top  = `${y}px`;
    fx.style.transform='translate(-50%,-50%)';
    fx.style.fontWeight='900';
    fx.style.fontSize='14px';
    fx.style.padding='6px 10px';
    fx.style.borderRadius='999px';
    fx.style.border='1px solid rgba(148,163,184,.22)';
    fx.style.background='rgba(2,6,23,.70)';
    fx.style.color='rgba(229,231,235,.95)';
    fx.style.pointerEvents='none';
    fx.style.opacity='0';
    fx.style.transition='transform .35s ease, opacity .35s ease';
    layer.appendChild(fx);
    requestAnimationFrame(()=>{
      fx.style.opacity='1';
      fx.style.transform='translate(-50%,-70%)';
    });
    setTimeout(()=>{
      fx.style.opacity='0';
      fx.style.transform='translate(-50%,-110%)';
      setTimeout(()=>fx.remove(), 350);
    }, 520);
  }

  // ---------- config ----------
  const CFG = {
    timeSec: 90,
    introSec: 2.5,
    quads: ['q1','q2','q3','q4'],

    covPass: 80,
    minQuadSec: 12,

    judgeMs: { perfect: 120, good: 210 },
    pts: { perfect: 12, good: 7, stealth: 22, pickup: 0 },

    feverMax: 20,
    feverOnSec: 6,

    noteRadius: 26,
    noteLifeSec: 1.9,
    spawnEverySec: 0.72,

    gentle: {
      tapRateHeavyPerSec: 7,
      spamIntervalMs: 120,
      heavyLimit: 4,
      penaltySec: 4.0,
      penaltyMul: 0.80
    },

    tug: {
      enabled: true,
      reclaimDelaySec: 8.0,
      reclaimRatePerSec: 0.012
    },

    uv: {
      enabled: true,
      energyMax: 3,
      windowSec: 3.5,
      cooldownSec: 3.0,
      stealthLifeSec: 2.4,
      stealthSpawnEverySec: 0.55,
      stealthVisibleOpacity: 0.85,
      stealthHiddenOpacity: 0.10,
      stealthHitWhenOffPenalty: true,
      refillStreak: 6
    },

    pickups: {
      enabled: true,
      spawnEverySecRun: 10.5,
      spawnEverySecBoss: 7.0,
      lifeSec: 2.8,

      shieldSec: 7.0,
      cleanserFreezeReclaimSec: 5.0,
      cleanserBoostAll: 8.0
    },

    boss: {
      enabled: true,
      hpMax: 100,
      phaseMax: 4,

      dmg: {
        bossPerfect: 9,
        bossGood: 6,
        stealthUV: 12,
        // NEW: weak spot dmg
        weakPerfect: 14,
        weakGood: 10,
        // NEW: non-weak dmg in phase3-4 (tiny)
        nonWeakScaleLate: 0.18
      },

      noteLifeSec: 2.2,

      bossSpawnEverySecBase: 0.90,
      bossSpawnEverySecMin: 0.42,

      finisherHp: 14,
      finisherNeed: 5,
      finisherWindowSec: 6.0,

      ringCountBase: 6,
      ringRadiusFrac: 0.22,
      stormBurst: 6,
      stormGapSec: 0.12,

      // NEW: weak spot chance (phase3-4)
      weakChanceP3: 0.34,
      weakChanceP4: 0.42
    },

    // NEW: Combo Bank
    bank: {
      enabled: true,
      costCombo: 8,
      cdSec: 3.5,
      // If UV not full -> UV +1, else -> Shield
      shieldSec: 4.5
    }
  };

  function comboMultiplier(combo){
    if(combo>=20) return 1.6;
    if(combo>=10) return 1.4;
    if(combo>=5)  return 1.2;
    return 1.0;
  }

  // ---------- engine ----------
  function boot(ctx){
    const view = String(qs('view', DOC.body.getAttribute('data-view')||'pc')||'pc').toLowerCase();
    const rng = makeRNG(ctx.seed);

    const layer = DOC.getElementById('playLayer');
    if(!layer){
      console.warn('[BrushVR] missing #playLayer');
      return;
    }

    const S = {
      ctx, view, rng,
      phase:'INTRO',
      t:0,
      left: CFG.timeSec,

      quadIndex:0,
      q:'q1',
      qTime:0,
      qTimes:[0,0,0,0],

      coverage:{ q1:0, q2:0, q3:0, q4:0 },

      score:0,
      perfect:0, good:0, miss:0,
      stealthHit:0, stealthMiss:0,

      combo:0, maxCombo:0,

      fever:0,
      feverOn:false,
      feverLeft:0,

      heavyCount:0,
      penaltyLeft:0,
      hitTimes:[],
      lastHitMs:0,

      perfectStreak: 0,

      lastTouchedAt:{ q1:0, q2:0, q3:0, q4:0 },
      reclaiming:{ q1:0, q2:0, q3:0, q4:0 },

      reclaimFreezeLeft: 0,

      uvEnergy: CFG.uv.energyMax,
      uvOn:false,
      uvLeft:0,
      uvCdLeft:0,
      lastStealthSpawn:0,

      lastPickupSpawn: 0,
      shieldLeft: 0,

      // NEW: Bank
      bankCdLeft: 0,

      bossOn:false,
      bossHp: CFG.boss.hpMax,
      bossPhase: 1,
      lastBossSpawn: 0,

      bossPattern: 'DUEL',
      patternLeft: 3.2,
      stormQueue: 0,
      stormNextAt: 0,

      finisherOn:false,
      finisherNeed: CFG.boss.finisherNeed,
      finisherLeft: 0,
      finisherBestStreak: 0,

      lastTimeEmit:0,
      lastSpawn:0,

      notes:new Map(),
      noteSeq:0,

      ns:null
    };

    emit('hha:start', { game:'brush', ctx });

    function rebuildNoSpawn(){ S.ns = buildNoSpawnZones(S.view); }
    rebuildNoSpawn();
    WIN.addEventListener('resize', rebuildNoSpawn);

    // ---------- BANK button (auto create if missing) ----------
    function ensureBankBtn(){
      if(!CFG.bank.enabled) return null;
      if(HUD.el.bankBtn) return HUD.el.bankBtn;

      const b = DOC.createElement('button');
      b.id = 'bankBtnAuto';
      b.type = 'button';
      b.textContent = 'BANK';
      b.style.position='fixed';
      b.style.right='12px';
      b.style.bottom='12px';
      b.style.zIndex='59';
      b.style.padding='10px 12px';
      b.style.borderRadius='16px';
      b.style.border='1px solid rgba(148,163,184,.22)';
      b.style.background='rgba(2,6,23,.55)';
      b.style.color='rgba(229,231,235,.95)';
      b.style.fontWeight='900';
      b.style.letterSpacing='.6px';
      b.style.backdropFilter='blur(8px)';
      b.style.webkitBackdropFilter='blur(8px)';
      b.style.boxShadow='0 10px 26px rgba(0,0,0,.25)';
      b.style.cursor='pointer';
      b.style.opacity='0.95';
      b.setAttribute('aria-label','Combo Bank');

      DOC.body.appendChild(b);
      return b;
    }

    const bankBtn = ensureBankBtn();

    function addUVEnergy(n=1){
      const before = S.uvEnergy;
      S.uvEnergy = clamp(S.uvEnergy + n, 0, CFG.uv.energyMax);
      if(S.uvEnergy > before){
        HUD.toast('UV +1!', 'พลัง UV เพิ่มแล้ว', 1000);
        emit('brush:uv', { on:S.uvOn, energy:S.uvEnergy, refill:true });
      }
    }

    function applyBank(){
      if(!CFG.bank.enabled) return;
      if(S.bankCdLeft > 0){
        HUD.toast('BANK รอคูลดาวน์', `อีก ${(S.bankCdLeft).toFixed(1)}s`, 1000);
        return;
      }
      if(S.combo < CFG.bank.costCombo){
        HUD.toast('คอมโบไม่พอ', `ต้องมีคอมโบอย่างน้อย ${CFG.bank.costCombo}`, 1100);
        return;
      }

      S.combo -= CFG.bank.costCombo;
      S.bankCdLeft = CFG.bank.cdSec;

      // auto choose reward
      if(CFG.uv.enabled && S.uvEnergy < CFG.uv.energyMax){
        addUVEnergy(1);
        HUD.toast('BANK: UV +1!', `ใช้คอมโบ ${CFG.bank.costCombo}`, 1200);
        emit('brush:bank', { kind:'uv', cost:CFG.bank.costCombo, uvEnergy:S.uvEnergy });
      }else{
        S.shieldLeft = Math.max(S.shieldLeft, CFG.bank.shieldSec);
        HUD.toast('BANK: 🛡 Shield!', `ใช้คอมโบ ${CFG.bank.costCombo}`, 1200);
        emit('brush:bank', { kind:'shield', cost:CFG.bank.costCombo, shieldLeft:S.shieldLeft });
      }

      rebuildNoSpawn();
    }

    if(bankBtn){
      bankBtn.addEventListener('click', (ev)=>{ ev.preventDefault(); applyBank(); }, {passive:false});
    }

    // ---------- reclaim / shield ----------
    function reclaimRateScale(){
      let s = 1.0;
      if(S.bossOn) s *= (1.35 + 0.15*(S.bossPhase-1));
      if(S.shieldLeft > 0) s *= 0.35;
      if(S.reclaimFreezeLeft > 0) s *= 0.0;
      return s;
    }

    function applyReclaim(dt){
      S.reclaiming.q1 = S.reclaiming.q2 = S.reclaiming.q3 = S.reclaiming.q4 = 0;
      if(!CFG.tug.enabled) return;

      const rateScale = reclaimRateScale();
      if(rateScale <= 0) return;

      const now = S.t;
      for(const q of CFG.quads){
        if(q === S.q) continue;
        const idle = now - (S.lastTouchedAt[q]||0);
        if(idle >= CFG.tug.reclaimDelaySec){
          const dec = (CFG.tug.reclaimRatePerSec * 100) * dt * rateScale;
          const before = S.coverage[q]||0;
          const after = clamp(before - dec, 0, 100);
          S.coverage[q] = after;
          if(after < before) S.reclaiming[q] = 1;
        }
      }
    }

    // ---------- gentle ----------
    function recordHitAndDetectHeavy(hitMs){
      S.hitTimes.push(hitMs);
      while(S.hitTimes.length && (hitMs - S.hitTimes[0]) > 1000) S.hitTimes.shift();

      const tapRate = S.hitTimes.length;
      const interval = (S.lastHitMs>0) ? (hitMs - S.lastHitMs) : 9999;
      S.lastHitMs = hitMs;

      let heavy = false;
      if(tapRate > CFG.gentle.tapRateHeavyPerSec) heavy = true;
      if(interval > 0 && interval < CFG.gentle.spamIntervalMs) heavy = true;

      if(heavy){
        S.heavyCount++;
        HUD.toast('เบามือหน่อย!', 'กดถี่/รัวเกินไป ลองช้าลงหน่อย', 1400);

        if(S.heavyCount > CFG.gentle.heavyLimit){
          S.penaltyLeft = Math.max(S.penaltyLeft, CFG.gentle.penaltySec);
          S.combo = Math.floor(S.combo * 0.85);
          S.perfectStreak = 0;
        }
        emit('brush:gentle', { heavyCount:S.heavyCount, penaltyActive:S.penaltyLeft>0, tapRate });
      }
    }

    // ---------- notes registry ----------
    function addNote(note){
      S.notes.set(note.id, note);
      const life =
        (note.kind==='stealth') ? CFG.uv.stealthLifeSec :
        (note.kind==='boss' || note.kind==='weak') ? CFG.boss.noteLifeSec :
        (note.kind==='shield' || note.kind==='cleanser') ? CFG.pickups.lifeSec :
        CFG.noteLifeSec;

      setTimeout(()=>{
        if(!note.used){
          judgeNote(note, nowMs(), 'expire');
        }
      }, Math.round(life*1000));
    }

    function popIn(el){
      requestAnimationFrame(()=>{
        el.style.transition = 'transform .22s ease, opacity .22s ease';
        el.style.opacity = '1';
        el.style.transform = 'translate(-50%,-50%) scale(1)';
      });
    }

    // ---------- spawners ----------
    function spawnNormalAt(p){
      const id = ++S.noteSeq;
      const el = mkNoteEl('normal');
      el.style.left = `${p.x}px`;
      el.style.top  = `${p.y}px`;
      el.style.transform = 'translate(-50%,-50%) scale(0.92)';
      el.style.opacity='0';
      layer.appendChild(el);

      const born = nowMs();
      const due = born + 520 + (S.rng()*220);

      popIn(el);
      const note = { id, kind:'normal', bornMs:born, dueMs:due, x:p.x, y:p.y, el, used:false };
      el.addEventListener('click', (ev)=>{ ev.preventDefault(); judgeNote(note, nowMs(), 'tap'); }, {passive:false});
      addNote(note);
    }
    function spawnNormal(){
      const p = pickSpawnPoint(S.rng, S.ns, CFG.noteRadius);
      spawnNormalAt(p);
    }

    function spawnStealthAt(p){
      const id = ++S.noteSeq;
      const el = mkNoteEl('stealth');
      el.style.left = `${p.x}px`;
      el.style.top  = `${p.y}px`;
      el.style.transform = 'translate(-50%,-50%) scale(0.92)';
      layer.appendChild(el);

      const born = nowMs();
      const due = born + 420 + (S.rng()*240);

      function syncOpacity(){
        el.style.opacity = S.uvOn ? String(CFG.uv.stealthVisibleOpacity) : String(CFG.uv.stealthHiddenOpacity);
      }
      syncOpacity();

      const note = { id, kind:'stealth', bornMs:born, dueMs:due, x:p.x, y:p.y, el, used:false, syncOpacity };
      el.addEventListener('click', (ev)=>{ ev.preventDefault(); judgeNote(note, nowMs(), 'tap'); }, {passive:false});
      addNote(note);
    }
    function spawnStealth(){
      const p = pickSpawnPoint(S.rng, S.ns, CFG.noteRadius);
      spawnStealthAt(p);
    }

    function spawnBossAt(p, weak=false){
      const id = ++S.noteSeq;
      const el = mkNoteEl(weak ? 'weak' : 'boss');

      el.style.left = `${p.x}px`;
      el.style.top  = `${p.y}px`;
      el.style.transform = 'translate(-50%,-50%) scale(0.90)';
      el.style.opacity='0';
      layer.appendChild(el);

      const born = nowMs();
      const baseDelay = 520 - (S.bossPhase-1)*70;
      const due = born + clamp(baseDelay + (S.rng()*180), 260, 560);

      popIn(el);

      if(weak){
        // tiny pulse
        el.style.transition = 'transform .22s ease, opacity .22s ease';
        el.animate?.(
          [{transform:'translate(-50%,-50%) scale(1)'},{transform:'translate(-50%,-50%) scale(1.06)'},{transform:'translate(-50%,-50%) scale(1)'}],
          {duration:700, iterations:3}
        );
      }

      const note = { id, kind: weak ? 'weak':'boss', weak, bornMs:born, dueMs:due, x:p.x, y:p.y, el, used:false };
      el.addEventListener('click', (ev)=>{ ev.preventDefault(); judgeNote(note, nowMs(), 'tap'); }, {passive:false});
      addNote(note);
    }

    function spawnBossNote(){
      const p = pickSpawnPoint(S.rng, S.ns, CFG.noteRadius+6);

      // NEW: weak spot only in phase 3-4
      let weak = false;
      if(S.bossOn && S.bossPhase >= 3){
        const ch = (S.bossPhase===3) ? CFG.boss.weakChanceP3 : CFG.boss.weakChanceP4;
        weak = (S.rng() < ch);
      }
      spawnBossAt(p, weak);
    }

    function spawnPickup(kind){
      const id = ++S.noteSeq;
      const el = mkNoteEl(kind);
      const p = pickSpawnPoint(S.rng, S.ns, CFG.noteRadius+6);

      el.style.left = `${p.x}px`;
      el.style.top  = `${p.y}px`;
      el.style.transform = 'translate(-50%,-50%) scale(0.90)';
      el.style.opacity='0';
      layer.appendChild(el);

      const born = nowMs();
      const due = born + 480 + (S.rng()*220);

      popIn(el);
      const note = { id, kind, bornMs:born, dueMs:due, x:p.x, y:p.y, el, used:false };
      el.addEventListener('click', (ev)=>{ ev.preventDefault(); judgeNote(note, nowMs(), 'tap'); }, {passive:false});
      addNote(note);
    }

    function syncStealthVisibility(){
      for(const note of S.notes.values()){
        if(note.kind==='stealth' && typeof note.syncOpacity==='function') note.syncOpacity();
      }
    }

    // ---------- UV ----------
    function onPerfectProgress(){
      S.perfectStreak++;
      if(S.perfectStreak > 20) S.perfectStreak = 20;

      if(CFG.uv.enabled && S.perfectStreak >= CFG.uv.refillStreak){
        S.perfectStreak -= CFG.uv.refillStreak;
        addUVEnergy(1);
        HUD.toast('UV +1!', 'Perfect streak เติม UV', 1100);
      }
    }
    function resetPerfectStreak(){ S.perfectStreak = 0; }

    function tryUseUV(){
      if(!CFG.uv.enabled) return;
      if(S.uvOn) return;
      if(S.uvCdLeft > 0){
        HUD.toast('ยังใช้ UV ไม่ได้', `รอคูลดาวน์อีก ${(S.uvCdLeft).toFixed(1)}s`, 1200);
        return;
      }
      if(S.uvEnergy <= 0){
        HUD.toast('พลังงาน UV หมด', `ทำ Perfect streak ${CFG.uv.refillStreak} ครั้งเพื่อเติม UV`, 1500);
        return;
      }
      S.uvEnergy -= 1;
      S.uvOn = true;
      S.uvLeft = CFG.uv.windowSec;
      S.uvCdLeft = CFG.uv.cooldownSec;

      HUD.toast('UV ON!', 'ตอนนี้เห็นคราบล่องหนแล้ว!', 1200);
      syncStealthVisibility();
      emit('brush:uv', { on:true, energy:S.uvEnergy });
      rebuildNoSpawn();
    }
    if(HUD.el.uvBtn){
      HUD.el.uvBtn.addEventListener('click', (ev)=>{ ev.preventDefault(); tryUseUV(); }, {passive:false});
    }

    // ---------- Boss + patterns ----------
    function updateBossPhaseFromHp(){
      if(!S.bossOn) return;
      const hp = S.bossHp;
      let ph = 1;
      if(hp <= 25) ph = 4;
      else if(hp <= 50) ph = 3;
      else if(hp <= 75) ph = 2;
      else ph = 1;
      if(ph !== S.bossPhase){
        S.bossPhase = ph;
        HUD.toast('บอสเปลี่ยนเฟส!', `Phase ${ph}/4 • โหมด weak spot ${ph>=3?'ON':'OFF'}`, 1200);
        emit('brush:boss', { on:true, hp:S.bossHp, phase:S.bossPhase });
      }
    }

    function bossSpawnInterval(){
      const mult = 1.0 - 0.18*(S.bossPhase-1);
      return clamp(CFG.boss.bossSpawnEverySecBase * mult, CFG.boss.bossSpawnEverySecMin, 2.0);
    }

    function pickPattern(){
      const r = S.rng();
      const ph = S.bossPhase;
      const wD = clamp(0.65 - 0.12*(ph-1), 0.25, 0.70);
      const wR = clamp(0.22 + 0.06*(ph-1), 0.20, 0.45);
      const wS = clamp(1.0 - (wD+wR), 0.10, 0.45);
      if(r < wD) return 'DUEL';
      if(r < wD + wR) return 'RING';
      return 'STORM';
    }

    function startPattern(p){
      S.bossPattern = p;
      if(p==='DUEL'){
        S.patternLeft = 2.7 + S.rng()*1.0;
      }else if(p==='RING'){
        S.patternLeft = 1.1 + S.rng()*0.5;
      }else{
        S.patternLeft = 1.5 + S.rng()*0.7;
        S.stormQueue = CFG.boss.stormBurst + (S.bossPhase>=3 ? 2 : 0);
        S.stormNextAt = S.t;
      }
      emit('brush:boss', { on:true, hp:S.bossHp, phase:S.bossPhase, pattern:S.bossPattern });
    }

    function safeCenter(){
      const sp = S.ns?.safePlay;
      if(!sp) return { x: WIN.innerWidth*0.5, y: WIN.innerHeight*0.5 };
      return { x: sp.x + sp.w*0.5, y: sp.y + sp.h*0.5 };
    }

    function spawnRing(){
      const sp = S.ns?.safePlay;
      if(!sp) return;
      const c = safeCenter();
      const minDim = Math.max(120, Math.min(sp.w, sp.h));
      const rad = minDim * CFG.boss.ringRadiusFrac * clamp(0.88 + S.rng()*0.28, 0.70, 1.15);

      const count = CFG.boss.ringCountBase + (S.bossPhase>=3 ? 1 : 0) + (S.bossPhase>=4 ? 1 : 0);
      const a0 = S.rng() * Math.PI * 2;

      for(let i=0;i<count;i++){
        const a = a0 + (i*(Math.PI*2/count));
        const p = { x: c.x + Math.cos(a)*rad, y: c.y + Math.sin(a)*rad };
        p.x = clamp(p.x, sp.x+36, sp.x+sp.w-36);
        p.y = clamp(p.y, sp.y+36, sp.y+sp.h-36);
        spawnBossAt(p, (S.bossPhase>=3 && S.rng()<0.28)); // ring may include weak notes in late phases
      }
      HUD.toast('RING!', 'กวาดวงแหวนให้ไว!', 900);
    }

    function spawnStormTick(){
      spawnBossNote();
      if(CFG.uv.enabled && S.uvOn && (S.rng() < (0.40 + 0.10*(S.bossPhase-1)))){
        spawnStealth();
      }
    }

    function maybeSpawnPickups(){
      if(!CFG.pickups.enabled) return;
      const every = S.bossOn ? CFG.pickups.spawnEverySecBoss : CFG.pickups.spawnEverySecRun;
      if(S.t - S.lastPickupSpawn < every) return;
      S.lastPickupSpawn = S.t;

      const r = S.rng();
      let kind = 'shield';
      if(S.shieldLeft > 0) kind = 'cleanser';
      else kind = (r < 0.55 ? 'shield' : 'cleanser');
      spawnPickup(kind);
    }

    function setPhase(p){
      S.phase = p;
      if(p==='RUN_Q'){
        S.q = CFG.quads[S.quadIndex];
        S.qTime = 0;
      }
      if(p==='BOSS'){
        S.bossOn = true;
        HUD.showBoss(true);
        rebuildNoSpawn();
        startPattern('DUEL');
        HUD.toast('บอสโผล่!', 'Tartar Titan มาแล้ว—ลุยยย!', 1200);
        emit('brush:boss', { on:true, hp:S.bossHp, phase:S.bossPhase, pattern:S.bossPattern });
      }
    }

    // ---------- Finisher ----------
    function maybeEnterFinisher(){
      if(!S.bossOn) return;
      if(S.finisherOn) return;
      if(S.bossHp <= CFG.boss.finisherHp){
        S.finisherOn = true;
        S.finisherNeed = CFG.boss.finisherNeed;
        S.finisherLeft = CFG.boss.finisherWindowSec;
        S.finisherBestStreak = 0;
        HUD.toast('FINISHER!', `ทำ PERFECT ${S.finisherNeed} ครั้งใน ${CFG.boss.finisherWindowSec.toFixed(0)} วิ!`, 1600);
      }
    }

    function bossWin(){
      S.bossHp = 0;
      HUD.toast('ชนะบอส!', 'เก็บฟันสะอาดปิ๊ง ✨', 1400);
      endGame('boss_win');
    }

    // ---------- Pickups apply ----------
    function applyPickup(kind){
      if(kind==='shield'){
        S.shieldLeft = Math.max(S.shieldLeft, CFG.pickups.shieldSec);
        HUD.toast('🛡 Shield!', 'กันพลาด + tug เบาลงชั่วคราว', 1400);
        emit('brush:pickup', { kind:'shield', dur:S.shieldLeft });
      }else if(kind==='cleanser'){
        for(const q of CFG.quads){
          S.coverage[q] = clamp((S.coverage[q]||0) + CFG.pickups.cleanserBoostAll, 0, 100);
          S.lastTouchedAt[q] = S.t;
        }
        S.reclaimFreezeLeft = Math.max(S.reclaimFreezeLeft, CFG.pickups.cleanserFreezeReclaimSec);
        HUD.toast('💧 Cleanser!', 'ล้างคราบ + หยุดยึดคืนชั่วคราว', 1400);
        emit('brush:pickup', { kind:'cleanser', freeze:S.reclaimFreezeLeft, boost:CFG.pickups.cleanserBoostAll });
      }
      rebuildNoSpawn();
    }

    // ---------- judgement ----------
    function judgeNote(note, hitMs, source){
      if(!note || note.used) return;
      note.used = true;

      if(source==='tap' || source==='shoot'){
        recordHitAndDetectHeavy(hitMs);
      }

      const delta = Math.abs(hitMs - note.dueMs);
      let judge = 'miss';
      if(source!=='expire'){
        if(delta <= CFG.judgeMs.perfect) judge = 'perfect';
        else if(delta <= CFG.judgeMs.good) judge = 'good';
      }

      const removeNote = ()=>{
        try{ note.el.style.transition = 'transform .18s ease, opacity .18s ease'; }catch(_){}
        try{
          note.el.style.opacity='0';
          note.el.style.transform='translate(-50%,-50%) scale(0.85)';
        }catch(_){}
        setTimeout(()=>{ try{ note.el.remove(); }catch(_){} }, 220);
        S.notes.delete(note.id);
      };

      const finisherMissReset = ()=>{
        if(S.finisherOn){
          S.finisherNeed = CFG.boss.finisherNeed;
          HUD.toast('พลาด!', 'ต้องเริ่ม Perfect ใหม่!', 900);
        }
      };

      // PICKUPS
      if(note.kind==='shield' || note.kind==='cleanser'){
        if(source==='expire'){ removeNote(); return; }
        applyPickup(note.kind);
        popJudgeFx(layer, note.x, note.y, 'PICK');
        emit('hha:judge', { type:'pickup', kind:note.kind, judge:'pick', q:S.q, source });
        removeNote();
        return;
      }

      // stealth
      if(note.kind==='stealth'){
        if(source==='expire'){
          S.stealthMiss++;
          if(S.shieldLeft > 0) S.combo = Math.max(0, Math.floor(S.combo * 0.90));
          else S.combo = Math.max(0, Math.floor(S.combo * 0.70));
          S.fever = Math.max(0, S.fever - 2);
          resetPerfectStreak();
          if(S.finisherOn) finisherMissReset();
          popJudgeFx(layer, note.x, note.y, 'miss');
          emit('hha:judge', { type:'stealth', judge:'miss', q:S.q, uvOn:S.uvOn, source:'expire' });
          removeNote(); return;
        }else{
          if(S.uvOn){
            S.stealthHit++;
            const base = CFG.pts.stealth;
            const cmul = comboMultiplier(S.combo+1);
            const fmul = (S.feverOn ? 1.25 : 1.0);
            const pmul = (S.penaltyLeft > 0 ? CFG.gentle.penaltyMul : 1.0);
            S.score += Math.round(base * cmul * fmul * pmul);

            S.combo++;
            S.maxCombo = Math.max(S.maxCombo, S.combo);
            S.fever += 3;

            S.coverage[S.q] = clamp(S.coverage[S.q] + 10.0, 0, 100);
            S.lastTouchedAt[S.q] = S.t;

            if(S.bossOn){
              S.bossHp = clamp(S.bossHp - CFG.boss.dmg.stealthUV, 0, CFG.boss.hpMax);
              updateBossPhaseFromHp();
              maybeEnterFinisher();
            }

            onPerfectProgress();

            if(S.finisherOn){
              S.finisherNeed = Math.max(0, S.finisherNeed - 1);
              S.finisherBestStreak = Math.max(S.finisherBestStreak, CFG.boss.finisherNeed - S.finisherNeed);
              if(S.finisherNeed <= 0){ removeNote(); return bossWin(); }
            }

            popJudgeFx(layer, note.x, note.y, 'perfect');
            emit('hha:judge', { type:'stealth', judge:'hit', q:S.q, deltaMs:Math.round(delta), combo:S.combo, uvOn:true, source });
            removeNote(); return;
          }else{
            S.stealthMiss++;
            if(CFG.uv.stealthHitWhenOffPenalty){
              if(S.shieldLeft > 0){
                S.combo = Math.max(0, Math.floor(S.combo * 0.92));
              }else{
                S.combo = Math.max(0, Math.floor(S.combo * 0.80));
                S.fever = Math.max(0, S.fever - 1);
              }
              resetPerfectStreak();
              if(S.finisherOn) finisherMissReset();
              HUD.toast('ยังไม่เห็นคราบ!', 'กด UV ก่อนถึงจะปราบคราบล่องหนได้', 1400);
            }
            popJudgeFx(layer, note.x, note.y, 'miss');
            emit('hha:judge', { type:'stealth', judge:'blocked', q:S.q, uvOn:false, source });
            removeNote(); return;
          }
        }
      }

      // boss / weak note
      if(note.kind==='boss' || note.kind==='weak'){
        const isWeak = (note.kind==='weak' || note.weak);

        if(source==='expire'){
          S.miss++;
          if(S.shieldLeft > 0) S.combo = Math.max(0, Math.floor(S.combo*0.85));
          else S.combo = Math.max(0, Math.floor(S.combo*0.6));
          S.fever = Math.max(0, S.fever - 2);
          resetPerfectStreak();
          if(S.finisherOn) finisherMissReset();
          popJudgeFx(layer, note.x, note.y, 'miss');
          emit('hha:judge', { type:isWeak?'weak':'boss', judge:'miss', q:S.q, source:'expire' });
          removeNote(); return;
        }

        if(judge==='miss'){
          S.miss++;
          if(S.shieldLeft > 0) S.combo = Math.max(0, Math.floor(S.combo*0.85));
          else S.combo = 0;
          S.fever = Math.max(0, S.fever - 3);
          resetPerfectStreak();
          if(S.finisherOn) finisherMissReset();
          popJudgeFx(layer, note.x, note.y, 'miss');
          emit('hha:judge', { type:isWeak?'weak':'boss', judge:'miss', q:S.q, source });
          removeNote(); return;
        }

        // hit
        if(judge==='perfect'){ S.perfect++; S.fever += 2; }
        else { S.good++; S.fever += 1; }

        S.combo++;
        S.maxCombo = Math.max(S.maxCombo, S.combo);

        const base = (judge==='perfect') ? (CFG.pts.perfect+2) : (CFG.pts.good+1);
        const cmul = comboMultiplier(S.combo);
        const fmul = (S.feverOn ? 1.25 : 1.0);
        const pmul = (S.penaltyLeft > 0 ? CFG.gentle.penaltyMul : 1.0);
        S.score += Math.round(base * cmul * fmul * pmul);

        // NEW: weak spot logic in phase 3-4
        let dmg = 0;
        if(isWeak){
          dmg = (judge==='perfect') ? CFG.boss.dmg.weakPerfect : CFG.boss.dmg.weakGood;
        }else{
          const baseD = (judge==='perfect') ? CFG.boss.dmg.bossPerfect : CFG.boss.dmg.bossGood;
          if(S.bossPhase >= 3) dmg = Math.round(baseD * CFG.boss.dmg.nonWeakScaleLate);
          else dmg = baseD;
        }

        S.bossHp = clamp(S.bossHp - dmg, 0, CFG.boss.hpMax);
        updateBossPhaseFromHp();
        maybeEnterFinisher();

        if(judge==='perfect') onPerfectProgress();
        else resetPerfectStreak();

        // FINISHER: only perfect counts
        if(S.finisherOn && judge==='perfect'){
          S.finisherNeed = Math.max(0, S.finisherNeed - 1);
          S.finisherBestStreak = Math.max(S.finisherBestStreak, CFG.boss.finisherNeed - S.finisherNeed);
          if(S.finisherNeed <= 0){ removeNote(); return bossWin(); }
        }

        if(S.bossHp <= 0){ removeNote(); return bossWin(); }

        popJudgeFx(layer, note.x, note.y, isWeak ? 'WEAK' : judge);
        emit('hha:judge', { type:isWeak?'weak':'boss', judge, q:S.q, deltaMs:Math.round(delta), combo:S.combo, bossHp:S.bossHp, dmg, source });
        removeNote(); return;
      }

      // normal note
      if(source==='expire'){
        S.miss++;
        if(S.shieldLeft > 0) S.combo = Math.max(0, Math.floor(S.combo*0.92));
        else S.combo = 0;
        S.fever = Math.max(0, S.fever - 2);
        resetPerfectStreak();
        if(S.finisherOn) finisherMissReset();
        popJudgeFx(layer, note.x, note.y, 'miss');
        emit('hha:judge', { type:'note', judge:'miss', q:S.q, source:'expire' });
        removeNote(); return;
      }

      if(judge==='miss'){
        S.miss++;
        if(S.shieldLeft > 0) S.combo = Math.max(0, Math.floor(S.combo*0.85));
        else S.combo = 0;
        S.fever = Math.max(0, S.fever - 3);
        resetPerfectStreak();
        if(S.finisherOn) finisherMissReset();
      }else{
        if(judge==='perfect'){ S.perfect++; S.fever += 2; }
        else { S.good++; S.fever += 1; }

        S.combo++;
        S.maxCombo = Math.max(S.maxCombo, S.combo);

        const base = (judge==='perfect') ? CFG.pts.perfect : CFG.pts.good;
        const cmul = comboMultiplier(S.combo);
        const fmul = (S.feverOn ? 1.25 : 1.0);
        const pmul = (S.penaltyLeft > 0 ? CFG.gentle.penaltyMul : 1.0);
        S.score += Math.round(base * cmul * fmul * pmul);

        const add = (judge==='perfect') ? 6.0 : 3.5;
        S.coverage[S.q] = clamp(S.coverage[S.q] + add, 0, 100);
        S.lastTouchedAt[S.q] = S.t;

        if(judge==='perfect') onPerfectProgress();
        else resetPerfectStreak();

        if(S.finisherOn && judge==='perfect'){
          S.finisherNeed = Math.max(0, S.finisherNeed - 1);
          S.finisherBestStreak = Math.max(S.finisherBestStreak, CFG.boss.finisherNeed - S.finisherNeed);
          if(S.finisherNeed <= 0){ removeNote(); return bossWin(); }
        }
      }

      if(!S.feverOn && S.fever >= CFG.feverMax){
        S.feverOn = true;
        S.feverLeft = CFG.feverOnSec;
        S.fever = 5;
      }

      popJudgeFx(layer, note.x, note.y, judge);
      emit('hha:judge', { type:'note', judge, q:S.q, deltaMs:Math.round(delta), combo:S.combo, fever:S.fever, source });
      emit('brush:coverage', { q:S.q, coverage: Object.assign({}, S.coverage) });

      removeNote();
    }

    // ---------- quadrant / boss start ----------
    function maybeAdvanceQuadrantOrStartBoss(){
      const cov = S.coverage[S.q] || 0;
      const minOk = S.qTime >= CFG.minQuadSec;
      const covOk = cov >= CFG.covPass;
      const passNow = ((minOk && covOk) || S.qTime > (CFG.minQuadSec + 6));
      if(!passNow) return;

      S.qTimes[S.quadIndex] = S.qTime;

      if(S.quadIndex < 3){
        S.quadIndex++;
        setPhase('RUN_Q');
      }else{
        if(CFG.boss.enabled) setPhase('BOSS');
        else endGame('quad_done');
      }
    }

    // ---------- end game ----------
    function calcRank(score){
      if(score >= 1550) return 'S';
      if(score >= 1250) return 'A';
      if(score >= 1000) return 'B';
      if(score >= 800)  return 'C';
      return 'D';
    }

    function endGame(reason){
      if(S.phase==='END') return;
      S.phase='END';

      const covSum = CFG.quads.reduce((s,q)=>s + (S.coverage[q]||0), 0);
      const coverageScore = Math.round(covSum * 2.0);
      const bossBonus = S.bossOn ? Math.round((CFG.boss.hpMax - S.bossHp) * 5) : 0;
      const finBonus = S.finisherOn ? Math.round((CFG.boss.finisherNeed - S.finisherNeed) * 18) : 0;

      const total = S.score + coverageScore + (S.stealthHit*25) + bossBonus + finBonus;

      const summary = {
        reason,
        scoreTotal: total,
        rank: calcRank(total),
        coverage: Object.assign({}, S.coverage),
        rhythm: { perfect:S.perfect, good:S.good, miss:S.miss, maxCombo:S.maxCombo },
        stealth: { hit:S.stealthHit, miss:S.stealthMiss },
        gentle: { heavyCount: S.heavyCount },
        uv: { energyLeft: S.uvEnergy },
        pickups: { shieldSecLeft: S.shieldLeft, reclaimFreezeLeft: S.reclaimFreezeLeft },
        bank: { bankCdLeft: S.bankCdLeft },
        boss: {
          on: S.bossOn,
          hpLeft: S.bossHp,
          phase: S.bossPhase,
          finisherBestStreak: S.finisherBestStreak,
          pattern: S.bossPattern
        },
        meta: ctx,
        durationSec: CFG.timeSec - S.left
      };

      try{
        localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary));
        const histKey = 'HHA_SUMMARY_HISTORY';
        const hist = JSON.parse(localStorage.getItem(histKey) || '[]');
        hist.unshift(Object.assign({ts:Date.now()}, summary));
        localStorage.setItem(histKey, JSON.stringify(hist.slice(0,40)));
      }catch(_){}

      emit('hha:end', { summary });

      for(const note of S.notes.values()){
        try{ note.el.remove(); }catch(_){}
      }
      S.notes.clear();

      HUD.showBoss(false);

      const done = DOC.createElement('div');
      done.style.position='fixed';
      done.style.inset='0';
      done.style.display='grid';
      done.style.placeItems='center';
      done.style.zIndex='60';
      done.style.background='rgba(2,6,23,.62)';
      done.style.backdropFilter='blur(10px)';
      done.innerHTML = `
        <div style="width:min(560px,92vw);border:1px solid rgba(148,163,184,.18);border-radius:22px;padding:18px 16px;background:rgba(2,6,23,.78);box-shadow:0 18px 60px rgba(0,0,0,.45);">
          <div style="font-weight:900;font-size:18px;">จบเกมแล้ว • Rank ${summary.rank}</div>
          <div style="margin-top:6px;color:rgba(148,163,184,1);font-size:13px;line-height:1.5;">
            Reason ${summary.reason} • Score ${summary.scoreTotal} • Coverage ${Math.round(covSum)}% • BossHP ${summary.boss.hpLeft}
          </div>
          <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap;">
            <button id="btnRestart" style="padding:10px 14px;border-radius:16px;border:1px solid rgba(148,163,184,.22);background:rgba(34,197,94,.22);color:rgba(229,231,235,.95);font-weight:900;cursor:pointer;">Restart</button>
            <button id="btnBack" style="padding:10px 14px;border-radius:16px;border:1px solid rgba(148,163,184,.22);background:rgba(2,6,23,.40);color:rgba(229,231,235,.95);font-weight:900;cursor:pointer;">Back HUB</button>
          </div>
        </div>
      `;
      DOC.body.appendChild(done);
      done.querySelector('#btnRestart')?.addEventListener('click', ()=>location.reload());
      done.querySelector('#btnBack')?.addEventListener('click', ()=>{
        const hub = ctx.hub || '';
        if(hub) location.href = hub;
        else history.back();
      });
    }

    // ---------- input bridge: vr-ui tap-to-shoot ----------
    function hitTestFromShoot(ev){
      const d = ev?.detail || {};
      const x = Number(d.x), y = Number(d.y);
      if(!isFinite(x) || !isFinite(y)) return;

      let best = null, bestDist = 1e9;
      for(const note of S.notes.values()){
        const dx = (note.x - x), dy = (note.y - y);
        const dist = dx*dx + dy*dy;
        if(dist < bestDist){ bestDist = dist; best = note; }
      }
      const lockPx = Number(d.lockPx)||28;
      if(best && bestDist <= lockPx*lockPx){
        judgeNote(best, nowMs(), 'shoot');
      }
    }
    WIN.addEventListener('hha:shoot', hitTestFromShoot);

    // ---------- HUD init ----------
    if(CFG.uv.enabled){
      HUD.showUV(true);
      HUD.setUVEnergy(S.uvEnergy, CFG.uv.energyMax, S.uvOn, S.uvCdLeft);
      rebuildNoSpawn();
    }else{
      HUD.showUV(false);
    }
    HUD.showBoss(false);

    // start
    setPhase('INTRO');

    // ---------- loop ----------
    let last = nowMs();
    function loop(t){
      const dt = Math.min(0.05, (t - last)/1000);
      last = t;

      S.t += dt;
      S.left = Math.max(0, S.left - dt);

      if(S.penaltyLeft > 0) S.penaltyLeft = Math.max(0, S.penaltyLeft - dt);
      if(S.shieldLeft > 0) S.shieldLeft = Math.max(0, S.shieldLeft - dt);
      if(S.reclaimFreezeLeft > 0) S.reclaimFreezeLeft = Math.max(0, S.reclaimFreezeLeft - dt);
      if(S.bankCdLeft > 0) S.bankCdLeft = Math.max(0, S.bankCdLeft - dt);

      if(S.phase==='INTRO' && S.t >= CFG.introSec){
        S.phase = 'RUN_Q';
        S.quadIndex = 0;
        setPhase('RUN_Q');
      }

      if(S.feverOn){
        S.feverLeft -= dt;
        if(S.feverLeft <= 0){
          S.feverOn = false;
          S.feverLeft = 0;
        }
      }

      if(CFG.uv.enabled){
        if(S.uvCdLeft > 0) S.uvCdLeft = Math.max(0, S.uvCdLeft - dt);

        if(S.uvOn){
          S.uvLeft = Math.max(0, S.uvLeft - dt);
          if(S.uvLeft <= 0){
            S.uvOn = false;
            S.uvLeft = 0;
            syncStealthVisibility();
            HUD.toast('UV OFF', 'จบช่วง UV แล้ว', 900);
            emit('brush:uv', { on:false, energy:S.uvEnergy });
          }
        }
      }

      if(S.phase==='RUN_Q'){
        S.qTime += dt;

        if(S.t - S.lastSpawn >= CFG.spawnEverySec){
          S.lastSpawn = S.t;
          spawnNormal();
        }

        if(CFG.uv.enabled && S.uvOn){
          if(S.t - S.lastStealthSpawn >= CFG.uv.stealthSpawnEverySec){
            S.lastStealthSpawn = S.t;
            spawnStealth();
          }
        }

        maybeSpawnPickups();
        applyReclaim(dt);

        maybeAdvanceQuadrantOrStartBoss();
      }

      if(S.phase==='BOSS'){
        S.patternLeft -= dt;
        if(S.patternLeft <= 0){
          startPattern(pickPattern());
        }

        if(S.bossPattern==='DUEL'){
          const interval = bossSpawnInterval();
          if(S.t - S.lastBossSpawn >= interval){
            S.lastBossSpawn = S.t;
            spawnBossNote();
            if(CFG.uv.enabled && S.uvOn && (S.rng() < (0.40 + 0.10*(S.bossPhase-1)))) spawnStealth();
          }
        }else if(S.bossPattern==='RING'){
          if(S.t - S.lastBossSpawn >= 0.95){
            S.lastBossSpawn = S.t;
            spawnRing();
            startPattern('DUEL');
          }
        }else if(S.bossPattern==='STORM'){
          if(S.stormQueue > 0 && S.t >= S.stormNextAt){
            spawnStormTick();
            S.stormQueue--;
            S.stormNextAt = S.t + CFG.boss.stormGapSec;
          }
          if(S.stormQueue <= 0 && S.patternLeft < 0.3){
            startPattern('DUEL');
          }
        }

        maybeSpawnPickups();
        applyReclaim(dt);

        if(S.finisherOn){
          S.finisherLeft = Math.max(0, S.finisherLeft - dt);
          if(S.finisherLeft <= 0){
            S.finisherNeed = CFG.boss.finisherNeed;
            S.finisherLeft = CFG.boss.finisherWindowSec;
            HUD.toast('FINISHER ต่อ!', 'ยังไม่พอ—ลุย Perfect อีก!', 1100);
          }
        }

        updateBossPhaseFromHp();
        maybeEnterFinisher();

        if(S.bossHp <= 0){
          endGame('boss_win');
          return;
        }
      }

      const phaseLabel =
        (S.phase==='INTRO') ? 'INTRO • Ready' :
        (S.phase==='RUN_Q') ? `${S.q.toUpperCase()} • Quadrant Run` :
        (S.phase==='BOSS') ? `BOSS • ${S.bossPattern}` :
        'END';

      const cmul = comboMultiplier(S.combo);
      const fmul = (S.feverOn ? 1.25 : 1.0);
      const pmul = (S.penaltyLeft > 0 ? CFG.gentle.penaltyMul : 1.0);

      let extra = '';
      if(S.bankCdLeft > 0) extra += ` • BANK ${S.bankCdLeft.toFixed(0)}s`;
      if(S.shieldLeft > 0) extra += ` • 🛡${S.shieldLeft.toFixed(0)}s`;
      if(S.reclaimFreezeLeft > 0) extra += ` • 💧${S.reclaimFreezeLeft.toFixed(0)}s`;
      if(S.uvOn) extra += ' • UV';
      if(S.finisherOn) extra += ` • FIN ${S.finisherNeed}`;

      HUD.setTimer(S.left, CFG.timeSec, phaseLabel + extra);
      HUD.setCoverage(S.coverage, CFG.covPass, S.reclaiming);
      HUD.setCombo(S.combo, cmul*fmul*pmul);
      HUD.setFever(S.fever, CFG.feverMax);
      if(CFG.uv.enabled) HUD.setUVEnergy(S.uvEnergy, CFG.uv.energyMax, S.uvOn, S.uvCdLeft);

      if(S.bossOn){
        HUD.showBoss(true);
        HUD.setBoss(S.bossHp, CFG.boss.hpMax, S.bossPhase, CFG.boss.phaseMax);
      }else{
        HUD.showBoss(false);
      }

      if((t - S.lastTimeEmit) > 250){
        S.lastTimeEmit = t;
        emit('hha:time', {
          tLeft:S.left,
          score:S.score,
          phase:S.phase,
          q:S.q,
          coverage:Object.assign({}, S.coverage),
          heavyCount:S.heavyCount,
          penaltyActive:(S.penaltyLeft>0),
          uvOn:S.uvOn,
          uvEnergy:S.uvEnergy,
          perfectStreak:S.perfectStreak,
          shieldLeft:S.shieldLeft,
          reclaimFreezeLeft:S.reclaimFreezeLeft,
          bankCdLeft:S.bankCdLeft,
          bossOn:S.bossOn,
          bossHp:S.bossHp,
          bossPhase:S.bossPhase,
          bossPattern:S.bossPattern,
          finisherOn:S.finisherOn,
          finisherNeed:S.finisherNeed,
          finisherLeft:S.finisherLeft
        });
      }

      if(S.left <= 0 && S.phase !== 'END'){
        endGame('timeout');
        return;
      }

      if(S.phase !== 'END') requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  WIN.BrushVR = WIN.BrushVR || {};
  WIN.BrushVR.boot = boot;
})();