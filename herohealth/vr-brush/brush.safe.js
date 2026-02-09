// === /herohealth/vr-brush/brush.safe.js ===
// BrushVR SAFE Engine — DOM90 v0.9 (FULL PATCH: Smart Spawn + Online ML + CSV Export)
// ✅ Ultimate #1 Laser Sweep (Pack1)
// ✅ Ultimate #2 Shockwave Pulse (Pack2)
// ✅ Perfect Gate (Pack1)
// ✅ Boss Personality: ANGER affects patterns/spawn
// ✅ Badges + storage + end overlay
// ✅ NEW (Pack10): Smart Spawn (anti-clump + anti-overlap)
// ✅ NEW (Pack11): AI hooks + Online ML Predictor (play adaptive; research deterministic)
// ✅ NEW (Pack12): Event logging + Export CSV from end screen
// Emits: hha:start, hha:time, hha:judge, brush:coverage, brush:gentle, brush:uv, brush:boss, brush:pickup, brush:bank, brush:badge, hha:end

(function(){
  'use strict';
  const WIN = window, DOC = document;

  // ---------- helpers ----------
  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));
  const nowMs = ()=>performance.now();
  const emitRaw = (n,d)=>{ try{ WIN.dispatchEvent(new CustomEvent(n,{detail:d})); }catch(_){ } };
  const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };

  function makeRNG(seed){
    let x = (Number(seed)||Date.now()) >>> 0;
    return ()=> (x = (1664525*x + 1013904223) >>> 0) / 4294967296;
  }

  // ---------- badges storage ----------
  const LS_BADGES = 'HHA_BADGES_V1';
  function loadBadges(){
    try{ return JSON.parse(localStorage.getItem(LS_BADGES)||'{}') || {}; }catch(_){ return {}; }
  }
  function saveBadges(all){
    try{ localStorage.setItem(LS_BADGES, JSON.stringify(all)); }catch(_){}
  }
  function grantBadge(gameKey, badgeId){
    const all = loadBadges();
    all[gameKey] = all[gameKey] || {};
    if(all[gameKey][badgeId]) return false;
    all[gameKey][badgeId] = { ts: Date.now() };
    saveBadges(all);
    emitRaw('brush:badge', { game: gameKey, badge: badgeId });
    return true;
  }

  // ---------- HUD API ----------
  const HUD = (function(){
    const id = (s)=>DOC.getElementById(s);
    const el = {
      tFill:id('tFill'), tLeft:id('tLeft'), tPhase:id('tPhase'),
      cCombo:id('cCombo'), cMul:id('cMul'),
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

    return { setTimer, setCombo, setCoverage, toast, showUV, setUVEnergy, showBoss, setBoss, el };
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

  // ---------- NEW: Smart Spawn (Pack10) ----------
  // repel from last N spawn positions (avoid clumping), while still respecting no-spawn zones
  function dist2(a,b){ const dx=a.x-b.x, dy=a.y-b.y; return dx*dx+dy*dy; }

  function pickSpawnPointSmart(rng, ns, radius, recentPts, preferCenter=0.15){
    const { safePlay, zones } = ns;
    const tries = 110;
    const w = Math.max(10, safePlay.w - radius*2);
    const h = Math.max(10, safePlay.h - radius*2);

    const center = { x: safePlay.x + safePlay.w*0.5, y: safePlay.y + safePlay.h*0.5 };
    const repelN = Math.min(10, recentPts?.length||0);
    const repelMinR = Math.max(90, radius*3.2);
    const repelMinR2 = repelMinR*repelMinR;

    let best = null, bestScore = -1e18;

    for(let i=0;i<tries;i++){
      const x = safePlay.x + radius + rng() * w;
      const y = safePlay.y + radius + rng() * h;
      const p = {x,y};

      // zone block
      let ok = true;
      for(const z of zones){
        if(pointInRect(p, z)){ ok=false; break; }
      }
      if(!ok) continue;

      // score = repel from recent + small center preference
      let score = 0;

      // repel
      if(repelN>0){
        for(let k=0;k<repelN;k++){
          const rp = recentPts[recentPts.length-1-k];
          if(!rp) continue;
          const d = dist2(p, rp);
          if(d < repelMinR2){ score -= 9000; } // hard penalty if too close
          score += Math.min(1800, d/120); // encourage farther spread
        }
      }

      // tiny center preference for UX (optional)
      if(preferCenter>0){
        const dc = dist2(p, center);
        score += (1.0 - Math.min(1, dc/(Math.max(1, safePlay.w*safePlay.w)))) * (250*preferCenter);
      }

      if(score > bestScore){
        bestScore = score;
        best = p;
      }
    }

    return best || { x: safePlay.x + safePlay.w/2, y: safePlay.y + safePlay.h/2 };
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
    fx.textContent =
      (judge==='perfect') ? 'PERFECT!' :
      (judge==='good' ? 'GOOD' :
      (judge==='PICK' ? 'PICK!' :
      (judge==='WEAK' ? 'WEAK!' :
      (judge==='LASER' ? 'LASER!' :
      (judge==='SHOCK' ? 'SHOCK!' : 'MISS')))));

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

    // base judge windows (will be adapted by OnlineML in play mode)
    judgeMs: { perfect: 120, good: 210 },
    pts: { perfect: 12, good: 7, stealth: 22 },

    noteRadius: 26,
    noteLifeSec: 1.9,
    spawnEverySec: 0.72,

    // SmartSpawn knobs
    smartSpawn: {
      enabled: true,
      keep: 12,
      preferCenter: 0.12
    },

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
        weakPerfect: 14,
        weakGood: 10,
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

      weakChanceP3: 0.34,
      weakChanceP4: 0.42,

      laser: {
        enabled: true,
        minGapSec: 7.5,
        maxGapSec: 12.5,
        durSec: 2.2,
        warnSec: 0.9,
        penaltySec: 3.2,
        comboCut: 0.55
      },

      shock: {
        enabled: true,
        minGapSec: 8.5,
        maxGapSec: 13.0,
        pulses: 3,
        pulseGapSec: 0.55,
        windowSec: 0.18,
        penaltySec: 2.8,
        comboCut: 0.72
      },

      gate: {
        enabled: true,
        phase: 4,
        needPerfectStreak: 4,
        windowSec: 7.0
      },

      mood: {
        enabled: true,
        angerUpMiss: 10,
        angerUpUltimatePunish: 14,
        angerDownPerfect: 2.2,
        angerDownWeak: 3.5,
        angerClamp: 100
      }
    },

    bank: {
      enabled: true,
      costCombo: 8,
      cdSec: 3.5,
      shieldSec: 4.5
    },

    badges: {
      uvHunterStealthHit: 8,
      gentleMaxHeavy: 1,
      calmAvgAngerMax: 45
    }
  };

  function comboMultiplier(combo){
    if(combo>=20) return 1.6;
    if(combo>=10) return 1.4;
    if(combo>=5)  return 1.2;
    return 1.0;
  }

  // ---------- NEW: Online ML Predictor (Pack11) ----------
  // lightweight online learning: track timing error + tap rate, adapt spawn/judge in PLAY only
  function createOnlineML(){
    const M = {
      n:0,
      meanAbsDelta: 140,
      meanTapRate: 4.2,
      meanHeavy: 0,
      // smoothed difficulty scalar 0..1 (higher = harder)
      diff: 0.50
    };
    function ema(prev, x, a){ return prev + a*(x - prev); }

    function updateOnJudge(deltaMs, tapRate, heavyHit){
      // robust clamp
      const d = clamp(Math.abs(deltaMs||0), 0, 480);
      const tr = clamp(tapRate||0, 0, 16);
      const hv = heavyHit ? 1 : 0;

      M.n++;
      const a = 0.06;
      M.meanAbsDelta = ema(M.meanAbsDelta, d, a);
      M.meanTapRate  = ema(M.meanTapRate,  tr, a);
      M.meanHeavy    = ema(M.meanHeavy,    hv, a);

      // build a “skill” score: lower delta + moderate tap rate + low heavy => higher skill
      const sTiming = clamp(1 - (M.meanAbsDelta/260), 0, 1);
      const sRate   = clamp(1 - (Math.abs(M.meanTapRate - 5.0)/6.0), 0, 1);
      const sGentle = clamp(1 - M.meanHeavy, 0, 1);

      const skill = (0.62*sTiming + 0.22*sRate + 0.16*sGentle);
      // diff should be inverse of skill, but not too jumpy
      const targetDiff = clamp(1 - skill, 0.08, 0.95);
      M.diff = ema(M.diff, targetDiff, 0.08);
    }

    function getAdaptiveParams(baseJudgePerfect, baseJudgeGood, baseSpawnEvery){
      // harder => tighter judge & faster spawns; easier => wider & slower
      const d = M.diff; // 0..1
      const judgeScale = clamp(1.18 - 0.36*d, 0.78, 1.22);
      const spawnScale = clamp(1.25 - 0.50*d, 0.78, 1.25);

      const perfect = Math.round(baseJudgePerfect * judgeScale);
      const good    = Math.round(baseJudgeGood    * judgeScale);
      const spawn   = baseSpawnEvery * spawnScale;

      return {
        judgeMs: { perfect: clamp(perfect, 80, 170), good: clamp(good, 150, 290) },
        spawnEverySec: clamp(spawn, 0.52, 0.98),
        diff: d,
        stats: { meanAbsDelta: Math.round(M.meanAbsDelta), meanTapRate: M.meanTapRate.toFixed(1), meanHeavy: M.meanHeavy.toFixed(2) }
      };
    }

    return { updateOnJudge, getAdaptiveParams };
  }

  // ---------- NEW: Event Log + CSV (Pack12) ----------
  function csvEscape(v){
    const s = String(v ?? '');
    if(/[,"\n]/.test(s)) return '"' + s.replace(/"/g,'""') + '"';
    return s;
  }
  function toCSV(rows){
    if(!rows || !rows.length) return 'ts,type,judge\n';
    const keys = Object.keys(rows[0]);
    const head = keys.map(csvEscape).join(',');
    const lines = rows.map(r => keys.map(k => csvEscape(r[k])).join(','));
    return head + '\n' + lines.join('\n') + '\n';
  }
  function downloadText(filename, text){
    try{
      const blob = new Blob([text], {type:'text/csv;charset=utf-8'});
      const url = URL.createObjectURL(blob);
      const a = DOC.createElement('a');
      a.href = url;
      a.download = filename;
      DOC.body.appendChild(a);
      a.click();
      setTimeout(()=>{ try{ a.remove(); URL.revokeObjectURL(url); }catch(_){} }, 250);
    }catch(_){}
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

    // AI hooks (optional)
    const AI = (function(){
      const fallback = { getDifficulty(){return null;}, getTip(){return null;}, onEvent(){} };
      try{
        if(WIN.HHA && typeof WIN.HHA.createAIHooks === 'function'){
          const h = WIN.HHA.createAIHooks(ctx.seed, 'brush');
          return Object.assign({}, fallback, h||{});
        }
      }catch(_){}
      return fallback;
    })();

    // Online ML (play only)
    const isResearch = String(ctx.mode||'').toLowerCase() === 'research';
    const isPlay = !isResearch && String(ctx.mode||'').toLowerCase() !== 'practice';
    const onlineML = createOnlineML();

    // logging enabled? (research should log by default; play logs if ctx.log=="1")
    const logOn = isResearch || String(ctx.log||'') === '1';
    const evlog = [];
    function emit(n, d){
      // push minimal log rows for key events
      if(logOn){
        try{
          evlog.push(Object.assign({
            ts: Date.now(),
            t: Number(S?.t||0).toFixed(3),
            game:'brush',
            mode: String(ctx.mode||''),
            pid: String(ctx.pid||''),
            studyId: String(ctx.studyId||''),
            phase: String(ctx.phase||''),
            conditionGroup: String(ctx.conditionGroup||''),
            view: String(view||''),
            type: n
          }, d||{}));
        }catch(_){}
      }
      emitRaw(n, d);
      try{ AI.onEvent?.(n, d); }catch(_){}
    }

    function ensureOverlay(id, baseBg, title){
      let el = DOC.getElementById(id);
      if(el) return el;
      el = DOC.createElement('div');
      el.id = id;
      el.style.position='fixed';
      el.style.inset='0';
      el.style.zIndex='58';
      el.style.pointerEvents='none';
      el.style.opacity='0';
      el.style.transition='opacity .18s ease';
      el.style.background = baseBg;

      const label = DOC.createElement('div');
      label.textContent = title;
      label.style.position='fixed';
      label.style.left='50%';
      label.style.top='50%';
      label.style.transform='translate(-50%,-50%)';
      label.style.padding='10px 14px';
      label.style.borderRadius='999px';
      label.style.border='1px solid rgba(148,163,184,.22)';
      label.style.background='rgba(2,6,23,.62)';
      label.style.color='rgba(229,231,235,.95)';
      label.style.fontWeight='950';
      label.style.letterSpacing='.6px';
      label.style.boxShadow='0 18px 60px rgba(0,0,0,.45)';
      el.appendChild(label);

      DOC.body.appendChild(el);
      return el;
    }

    const laserOverlay = ensureOverlay(
      'laserOverlay',
      'radial-gradient(900px 420px at 50% 45%, rgba(255,255,255,.10), transparent 60%),linear-gradient(110deg, rgba(239,68,68,.0) 0%, rgba(239,68,68,.18) 35%, rgba(239,68,68,.0) 70%)',
      'LASER SWEEP — ห้ามตี!'
    );

    const shockOverlay = ensureOverlay(
      'shockOverlay',
      'radial-gradient(1000px 600px at 50% 50%, rgba(34,211,238,.12), transparent 60%)',
      'SHOCKWAVE — ตี “ตามจังหวะ”!'
    );

    // shock ring canvas
    function ensureShockRing(){
      let c = DOC.getElementById('shockRing');
      if(c) return c;
      c = DOC.createElement('canvas');
      c.id = 'shockRing';
      c.style.position='fixed';
      c.style.inset='0';
      c.style.zIndex='57';
      c.style.pointerEvents='none';
      c.style.opacity='0';
      c.style.transition='opacity .18s ease';
      DOC.body.appendChild(c);
      return c;
    }
    const shockCanvas = ensureShockRing();
    const shockCtx = shockCanvas.getContext('2d');

    function resizeShockCanvas(){
      const dpr = Math.max(1, WIN.devicePixelRatio||1);
      shockCanvas.width = Math.floor(WIN.innerWidth * dpr);
      shockCanvas.height = Math.floor(WIN.innerHeight * dpr);
      shockCanvas.style.width = WIN.innerWidth + 'px';
      shockCanvas.style.height = WIN.innerHeight + 'px';
      shockCtx.setTransform(dpr,0,0,dpr,0,0);
    }
    resizeShockCanvas();
    WIN.addEventListener('resize', resizeShockCanvas);

    const S = {
      ctx, view, rng,
      phase:'INTRO',
      t:0,
      left: clamp(ctx.time || CFG.timeSec, 30, 180),

      quadIndex:0,
      q:'q1',
      qTime:0,
      qTimes:[0,0,0,0],

      coverage:{ q1:0, q2:0, q3:0, q4:0 },

      score:0,
      perfect:0, good:0, miss:0,
      stealthHit:0, stealthMiss:0,

      combo:0, maxCombo:0,
      perfectStreak:0,

      heavyCount:0,
      penaltyLeft:0,
      hitTimes:[],
      lastHitMs:0,

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

      // Laser
      laserNextAt: 0,
      laserWarnLeft: 0,
      laserLeft: 0,
      laserViolations: 0,

      // Shockwave
      shockNextAt: 0,
      shockOn:false,
      shockPulsesLeft: 0,
      shockPulseTimer: 0,
      shockWindowLeft: 0,
      shockWindowOpen: false,
      shockPunishCount: 0,
      shockPulseIdx: 0,
      shockCenter: {x:0,y:0},
      shockRingR: 0,

      // Gate
      gateOn: false,
      gateNeed: CFG.boss.gate.needPerfectStreak,
      gateLeft: 0,

      // Mood
      anger: 12,
      angerSum: 0,
      angerSamples: 0,

      lastTimeEmit:0,
      lastSpawn:0,

      notes:new Map(),
      noteSeq:0,

      ns:null,

      // NEW: store recent spawn points (SmartSpawn)
      recentPts: []
    };

    emit('hha:start', { game:'brush', ctx });

    function rebuildNoSpawn(){ S.ns = buildNoSpawnZones(S.view); }
    rebuildNoSpawn();
    WIN.addEventListener('resize', rebuildNoSpawn);

    // ---------- BANK button ----------
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

      if(CFG.uv.enabled && S.uvEnergy < CFG.uv.energyMax){
        addUVEnergy(1);
        HUD.toast('BANK: UV +1!', `ใช้คอมโบ ${CFG.bank.costCombo}`, 1200);
      }else{
        S.shieldLeft = Math.max(S.shieldLeft, CFG.bank.shieldSec);
        HUD.toast('BANK: 🛡 Shield!', `ใช้คอมโบ ${CFG.bank.costCombo}`, 1200);
      }
      rebuildNoSpawn();
      emit('brush:bank', { combo:S.combo, bankCd:S.bankCdLeft, uvEnergy:S.uvEnergy, shieldLeft:S.shieldLeft });
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

    // ---------- mood / anger ----------
    function angerUp(n){
      if(!CFG.boss.mood.enabled) return;
      S.anger = clamp(S.anger + n, 0, CFG.boss.mood.angerClamp);
    }
    function angerDown(n){
      if(!CFG.boss.mood.enabled) return;
      S.anger = clamp(S.anger - n, 0, CFG.boss.mood.angerClamp);
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

      return { tapRate, heavy };
    }

    // ---------- notes registry ----------
    function addNote(note){
      S.notes.set(note.id, note);

      // remember recent points for SmartSpawn
      if(CFG.smartSpawn.enabled){
        S.recentPts.push({x:note.x, y:note.y});
        if(S.recentPts.length > CFG.smartSpawn.keep) S.recentPts.shift();
      }

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
    function smartPoint(radius){
      if(!CFG.smartSpawn.enabled){
        // fallback old
        const sp = S.ns;
        const tries = 90;
        const w = Math.max(10, sp.safePlay.w - radius*2);
        const h = Math.max(10, sp.safePlay.h - radius*2);
        for(let i=0;i<tries;i++){
          const x = sp.safePlay.x + radius + S.rng() * w;
          const y = sp.safePlay.y + radius + S.rng() * h;
          const p = {x,y};
          let ok = true;
          for(const z of sp.zones){ if(pointInRect(p, z)){ ok=false; break; } }
          if(ok) return p;
        }
        return { x: sp.safePlay.x + sp.safePlay.w/2, y: sp.safePlay.y + sp.safePlay.h/2 };
      }
      return pickSpawnPointSmart(S.rng, S.ns, radius, S.recentPts, CFG.smartSpawn.preferCenter);
    }

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
      const p = smartPoint(CFG.noteRadius);
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
      const p = smartPoint(CFG.noteRadius);
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

      const note = { id, kind: weak ? 'weak':'boss', weak, bornMs:born, dueMs:due, x:p.x, y:p.y, el, used:false };
      el.addEventListener('click', (ev)=>{ ev.preventDefault(); judgeNote(note, nowMs(), 'tap'); }, {passive:false});
      addNote(note);
    }

    function spawnBossNote(){
      const p = smartPoint(CFG.noteRadius+6);
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
      const p = smartPoint(CFG.noteRadius+6);

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

      angerDown(CFG.boss.mood.angerDownPerfect);

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
      HUD.el.uvBtn.style.pointerEvents = 'auto';
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

      if(ph !== S.bossPhase){
        S.bossPhase = ph;
        HUD.toast('บอสเปลี่ยนเฟส!', `Phase ${ph}/4 • ${ph>=3?'Weak spot ON 🎯':'ตั้งหลักก่อน!'}`, 1200);
        emit('brush:boss', { on:true, hp:S.bossHp, phase:S.bossPhase });
      }

      if(CFG.boss.gate.enabled && S.bossPhase >= CFG.boss.gate.phase && !S.gateOn){
        S.gateOn = true;
        S.gateNeed = CFG.boss.gate.needPerfectStreak;
        S.gateLeft = CFG.boss.gate.windowSec;
        HUD.toast('GATE!', `ทำ PERFECT ติดกัน ${S.gateNeed} ครั้งเพื่อเปิดเกราะ!`, 1600);
      }
    }

    function angerFactor(){ return clamp(S.anger / 100, 0, 1); }

    function bossSpawnInterval(){
      const baseMult = 1.0 - 0.18*(S.bossPhase-1);
      const angry = angerFactor();
      const moodMult = 1.0 - 0.22*angry;
      return clamp(CFG.boss.bossSpawnEverySecBase * baseMult * moodMult, CFG.boss.bossSpawnEverySecMin, 2.0);
    }

    function pickPattern(){
      const r = S.rng();
      const ph = S.bossPhase;
      const angry = angerFactor();

      const wD = clamp((0.62 - 0.10*(ph-1)) + 0.18*angry, 0.25, 0.80);
      const wR = clamp((0.24 + 0.05*(ph-1)) - 0.14*angry, 0.10, 0.45);
      const wS = clamp(1.0 - (wD+wR), 0.12, 0.55);

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
        const extra = Math.round(2 * angerFactor());
        S.patternLeft = 1.5 + S.rng()*0.7;
        S.stormQueue = CFG.boss.stormBurst + (S.bossPhase>=3 ? 2 : 0) + extra;
        S.stormNextAt = S.t;
      }
      emit('brush:boss', { on:true, hp:S.bossHp, phase:S.bossPhase, pattern:S.bossPattern, anger:S.anger });
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
        spawnBossAt(p, (S.bossPhase>=3 && S.rng()<0.28));
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
      emit('brush:pickup', { kind });
    }

    // ---------- Laser Sweep ----------
    function scheduleNextLaser(){
      const g = CFG.boss.laser;
      if(!g.enabled) return;
      const angry = angerFactor();
      const minG = Math.max(4.8, g.minGapSec - 2.0*angry);
      const maxG = Math.max(minG+0.8, g.maxGapSec - 2.8*angry);
      const gap = minG + (S.rng()*(maxG - minG));
      S.laserNextAt = S.t + gap;
    }
    function startLaserWarn(){
      const g = CFG.boss.laser;
      S.laserWarnLeft = g.warnSec;
      laserOverlay.style.opacity = '0.55';
      HUD.toast('⚠️ LASER', 'หยุดตี! รอให้ผ่านไป', 900);
    }
    function startLaser(){
      const g = CFG.boss.laser;
      S.laserWarnLeft = 0;
      S.laserLeft = g.durSec;
      laserOverlay.style.opacity = '1';
      HUD.toast('LASER SWEEP!', 'ห้ามตีช่วงนี้!', 900);
    }
    function stopLaser(){
      S.laserLeft = 0;
      laserOverlay.style.opacity = '0';
      scheduleNextLaser();
    }
    function laserPunish(x,y){
      const g = CFG.boss.laser;
      S.laserViolations++;
      S.penaltyLeft = Math.max(S.penaltyLeft, g.penaltySec);
      S.combo = Math.floor(S.combo * g.comboCut);
      resetPerfectStreak();
      angerUp(CFG.boss.mood.angerUpUltimatePunish);
      popJudgeFx(layer, x, y, 'LASER');
      HUD.toast('โดนเลเซอร์!', 'ช่วงเลเซอร์ต้อง “หยุดตี”', 1200);
    }

    // ---------- Shockwave Pulse ----------
    function scheduleNextShock(){
      const g = CFG.boss.shock;
      if(!g.enabled) return;
      const angry = angerFactor();
      const minG = Math.max(5.2, g.minGapSec - 2.0*angry);
      const maxG = Math.max(minG+0.8, g.maxGapSec - 2.8*angry);
      const gap = minG + (S.rng()*(maxG - minG));
      S.shockNextAt = S.t + gap;
    }

    function openShockWindow(){
      const g = CFG.boss.shock;
      S.shockWindowOpen = true;
      S.shockWindowLeft = g.windowSec;
    }
    function closeShockWindow(){
      S.shockWindowOpen = false;
      S.shockWindowLeft = 0;
    }

    function startShock(){
      const g = CFG.boss.shock;
      S.shockOn = true;
      S.shockPulsesLeft = g.pulses + Math.round(angerFactor()); // 3..4
      S.shockPulseTimer = 0.02;
      S.shockWindowLeft = 0;
      S.shockWindowOpen = false;
      S.shockPulseIdx = 0;

      const c = safeCenter();
      S.shockCenter = { x:c.x, y:c.y };
      S.shockRingR = 0;

      shockOverlay.style.opacity = '1';
      shockCanvas.style.opacity = '1';

      HUD.toast('SHOCKWAVE!', 'ตี “ตามจังหวะ” เท่านั้น!', 1200);
    }
    function stopShock(){
      S.shockOn = false;
      S.shockPulsesLeft = 0;
      S.shockWindowLeft = 0;
      S.shockWindowOpen = false;
      shockOverlay.style.opacity = '0';
      shockCanvas.style.opacity = '0';
      clearShockDraw();
      scheduleNextShock();
    }

    function shockPunish(x,y){
      const g = CFG.boss.shock;
      S.shockPunishCount++;
      S.penaltyLeft = Math.max(S.penaltyLeft, g.penaltySec);
      S.combo = Math.floor(S.combo * g.comboCut);
      resetPerfectStreak();
      angerUp(CFG.boss.mood.angerUpUltimatePunish);
      popJudgeFx(layer, x, y, 'SHOCK');
      HUD.toast('พลาดจังหวะ!', 'Shockwave ต้องตี “ตรงจังหวะ”', 1200);
    }

    function clearShockDraw(){
      try{ shockCtx.clearRect(0,0,WIN.innerWidth, WIN.innerHeight); }catch(_){}
    }
    function drawShockRing(r, alpha){
      clearShockDraw();
      const c = S.shockCenter;
      shockCtx.save();
      shockCtx.globalAlpha = alpha;
      shockCtx.lineWidth = 6;
      shockCtx.beginPath();
      shockCtx.arc(c.x, c.y, r, 0, Math.PI*2);
      shockCtx.strokeStyle = 'rgba(34,211,238,.70)';
      shockCtx.stroke();

      if(S.shockWindowOpen){
        shockCtx.globalAlpha = 0.92;
        shockCtx.lineWidth = 10;
        shockCtx.beginPath();
        shockCtx.arc(c.x, c.y, r, 0, Math.PI*2);
        shockCtx.strokeStyle = 'rgba(34,197,94,.70)';
        shockCtx.stroke();
      }
      shockCtx.restore();
    }

    // ---------- Perfect Gate ----------
    function gateTick(dt){
      if(!S.gateOn) return;
      S.gateLeft = Math.max(0, S.gateLeft - dt);
      if(S.gateLeft <= 0){
        S.gateNeed = CFG.boss.gate.needPerfectStreak;
        S.gateLeft = CFG.boss.gate.windowSec;
        HUD.toast('GATE ต่อ!', `ทำ PERFECT ติดกัน ${S.gateNeed} ครั้ง!`, 1000);
      }
    }
    function gateOnPerfect(){
      if(!S.gateOn) return;
      S.gateNeed = Math.max(0, S.gateNeed - 1);
      if(S.gateNeed <= 0){
        S.gateOn = false;
        HUD.toast('เกราะแตก!', 'ตอนนี้ตีบอสได้เต็มแรง!', 1200);
      }
    }
    function gateOnMiss(){
      if(!S.gateOn) return;
      S.gateNeed = CFG.boss.gate.needPerfectStreak;
      HUD.toast('พลาด!', 'GATE รีเซ็ต—ต้อง Perfect ติดกันใหม่!', 900);
    }

    // ---------- phases ----------
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

        HUD.toast('บอสโผล่!', 'Tartar Titan มาแล้ว—ลุย!', 1200);
        emit('brush:boss', { on:true, hp:S.bossHp, phase:S.bossPhase, pattern:S.bossPattern, anger:S.anger });

        scheduleNextLaser();
        scheduleNextShock();
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
      HUD.toast('ชนะบอส!', 'ฟันสะอาดปิ๊ง ✨', 1400);
      endGame('boss_win');
    }

    // ---------- Pickups apply ----------
    function applyPickup(kind){
      if(kind==='shield'){
        S.shieldLeft = Math.max(S.shieldLeft, CFG.pickups.shieldSec);
        HUD.toast('🛡 Shield!', 'กันพลาด + tug เบาลงชั่วคราว', 1400);
      }else if(kind==='cleanser'){
        for(const q of CFG.quads){
          S.coverage[q] = clamp((S.coverage[q]||0) + CFG.pickups.cleanserBoostAll, 0, 100);
          S.lastTouchedAt[q] = S.t;
        }
        S.reclaimFreezeLeft = Math.max(S.reclaimFreezeLeft, CFG.pickups.cleanserFreezeReclaimSec);
        HUD.toast('💧 Cleanser!', 'ล้างคราบ + หยุดยึดคืนชั่วคราว', 1400);
      }
      rebuildNoSpawn();
    }

    // ---------- judgement ----------
    function judgeNote(note, hitMs, source){
      if(!note || note.used) return;
      note.used = true;

      // Ultimate blocks: Laser and Shock
      if(S.bossOn && (source==='tap' || source==='shoot')){
        if(S.laserLeft > 0){
          laserPunish(note.x, note.y);
          emit('hha:judge', { type:'laser', judge:'violation', boss:true, source });
          try{ note.el.remove(); }catch(_){}
          S.notes.delete(note.id);
          return;
        }

        if(S.shockOn){
          if(!S.shockWindowOpen){
            shockPunish(note.x, note.y);
            emit('hha:judge', { type:'shock', judge:'violation', boss:true, source });
            try{ note.el.remove(); }catch(_){}
            S.notes.delete(note.id);
            return;
          }
          closeShockWindow();
          HUD.toast('จังหวะดี!', 'Shockwave timing สำเร็จ', 900);
          angerDown(4.0);
        }
      }

      let tapMeta = { tapRate:0, heavy:false };
      if(source==='tap' || source==='shoot'){
        tapMeta = recordHitAndDetectHeavy(hitMs);
      }

      const delta = Math.abs(hitMs - note.dueMs);

      // --- OnlineML adaptation (play only) ---
      let judgeCfg = CFG.judgeMs;
      let spawnEvery = CFG.spawnEverySec;
      let mlPack = null;
      if(isPlay){
        onlineML.updateOnJudge(delta, tapMeta.tapRate, tapMeta.heavy);
        mlPack = onlineML.getAdaptiveParams(CFG.judgeMs.perfect, CFG.judgeMs.good, CFG.spawnEverySec);
        judgeCfg = mlPack.judgeMs;
        spawnEvery = mlPack.spawnEverySec;
      }

      let judge = 'miss';
      if(source!=='expire'){
        if(delta <= judgeCfg.perfect) judge = 'perfect';
        else if(delta <= judgeCfg.good) judge = 'good';
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
          S.combo = Math.max(0, Math.floor(S.combo * (S.shieldLeft>0 ? 0.90 : 0.70)));
          resetPerfectStreak();
          angerUp(CFG.boss.mood.angerUpMiss * 0.4);
          if(S.finisherOn) finisherMissReset();
          if(S.gateOn) gateOnMiss();
          popJudgeFx(layer, note.x, note.y, 'miss');
          emit('hha:judge', { type:'stealth', judge:'miss', q:S.q, uvOn:S.uvOn, source:'expire', deltaMs:Math.round(delta), tapRate:tapMeta.tapRate, mlDiff: mlPack?.diff });
          removeNote(); return;
        }else{
          if(S.uvOn){
            S.stealthHit++;
            const base = CFG.pts.stealth;
            const cmul = comboMultiplier(S.combo+1);
            const pmul = (S.penaltyLeft > 0 ? CFG.gentle.penaltyMul : 1.0);
            S.score += Math.round(base * cmul * pmul);

            S.combo++;
            S.maxCombo = Math.max(S.maxCombo, S.combo);

            S.coverage[S.q] = clamp(S.coverage[S.q] + 10.0, 0, 100);
            S.lastTouchedAt[S.q] = S.t;

            if(S.bossOn){
              const gScale = S.gateOn ? 0.35 : 1.0;
              S.bossHp = clamp(S.bossHp - Math.round(CFG.boss.dmg.stealthUV * gScale), 0, CFG.boss.hpMax);
              updateBossPhaseFromHp();
              maybeEnterFinisher();
            }

            onPerfectProgress();
            if(S.gateOn) gateOnPerfect();

            if(S.finisherOn){
              S.finisherNeed = Math.max(0, S.finisherNeed - 1);
              S.finisherBestStreak = Math.max(S.finisherBestStreak, CFG.boss.finisherNeed - S.finisherNeed);
              if(S.finisherNeed <= 0){ removeNote(); return bossWin(); }
            }

            popJudgeFx(layer, note.x, note.y, 'perfect');
            emit('hha:judge', { type:'stealth', judge:'hit', q:S.q, deltaMs:Math.round(delta), combo:S.combo, uvOn:true, source, tapRate:tapMeta.tapRate, mlDiff: mlPack?.diff });
            removeNote(); return;
          }else{
            S.stealthMiss++;
            S.combo = Math.max(0, Math.floor(S.combo * (S.shieldLeft>0 ? 0.92 : 0.80)));
            resetPerfectStreak();
            angerUp(CFG.boss.mood.angerUpMiss * 0.4);
            if(S.finisherOn) finisherMissReset();
            if(S.gateOn) gateOnMiss();
            HUD.toast('ยังไม่เห็นคราบ!', 'กด UV ก่อนถึงจะปราบคราบล่องหนได้', 1400);
            popJudgeFx(layer, note.x, note.y, 'miss');
            emit('hha:judge', { type:'stealth', judge:'blocked', q:S.q, uvOn:false, source, deltaMs:Math.round(delta), tapRate:tapMeta.tapRate, mlDiff: mlPack?.diff });
            removeNote(); return;
          }
        }
      }

      // boss / weak
      if(note.kind==='boss' || note.kind==='weak'){
        const isWeak = (note.kind==='weak' || note.weak);

        if(source==='expire'){
          S.miss++;
          S.combo = Math.max(0, Math.floor(S.combo * (S.shieldLeft>0 ? 0.85 : 0.60)));
          resetPerfectStreak();
          angerUp(CFG.boss.mood.angerUpMiss);
          if(S.finisherOn) finisherMissReset();
          if(S.gateOn) gateOnMiss();
          popJudgeFx(layer, note.x, note.y, 'miss');
          emit('hha:judge', { type:isWeak?'weak':'boss', judge:'miss', q:S.q, source:'expire', deltaMs:Math.round(delta), tapRate:tapMeta.tapRate, mlDiff: mlPack?.diff });
          removeNote(); return;
        }

        if(judge==='miss'){
          S.miss++;
          S.combo = (S.shieldLeft>0) ? Math.max(0, Math.floor(S.combo*0.85)) : 0;
          resetPerfectStreak();
          angerUp(CFG.boss.mood.angerUpMiss);
          if(S.finisherOn) finisherMissReset();
          if(S.gateOn) gateOnMiss();
          popJudgeFx(layer, note.x, note.y, 'miss');
          emit('hha:judge', { type:isWeak?'weak':'boss', judge:'miss', q:S.q, source, deltaMs:Math.round(delta), tapRate:tapMeta.tapRate, mlDiff: mlPack?.diff });
          removeNote(); return;
        }

        if(judge==='perfect'){ S.perfect++; }
        else { S.good++; }

        S.combo++;
        S.maxCombo = Math.max(S.maxCombo, S.combo);

        const base = (judge==='perfect') ? (CFG.pts.perfect+2) : (CFG.pts.good+1);
        const cmul = comboMultiplier(S.combo);
        const pmul = (S.penaltyLeft > 0 ? CFG.gentle.penaltyMul : 1.0);
        S.score += Math.round(base * cmul * pmul);

        let dmg = 0;
        if(isWeak){
          dmg = (judge==='perfect') ? CFG.boss.dmg.weakPerfect : CFG.boss.dmg.weakGood;
        }else{
          const baseD = (judge==='perfect') ? CFG.boss.dmg.bossPerfect : CFG.boss.dmg.bossGood;
          dmg = (S.bossPhase >= 3) ? Math.round(baseD * CFG.boss.dmg.nonWeakScaleLate) : baseD;
        }
        if(S.gateOn) dmg = Math.max(1, Math.round(dmg * 0.28));

        S.bossHp = clamp(S.bossHp - dmg, 0, CFG.boss.hpMax);
        updateBossPhaseFromHp();
        maybeEnterFinisher();

        if(isWeak) angerDown(CFG.boss.mood.angerDownWeak);

        if(judge==='perfect'){
          onPerfectProgress();
          if(S.gateOn) gateOnPerfect();
        }else{
          resetPerfectStreak();
          if(S.gateOn) gateOnMiss();
        }

        if(S.finisherOn && judge==='perfect'){
          S.finisherNeed = Math.max(0, S.finisherNeed - 1);
          S.finisherBestStreak = Math.max(S.finisherBestStreak, CFG.boss.finisherNeed - S.finisherNeed);
          if(S.finisherNeed <= 0){ removeNote(); return bossWin(); }
        }

        if(S.bossHp <= 0){ removeNote(); return bossWin(); }

        popJudgeFx(layer, note.x, note.y, isWeak ? 'WEAK' : judge);
        emit('hha:judge', { type:isWeak?'weak':'boss', judge, q:S.q, deltaMs:Math.round(delta), combo:S.combo, bossHp:S.bossHp, dmg, gateOn:S.gateOn, anger:S.anger, source, tapRate:tapMeta.tapRate, mlDiff: mlPack?.diff });
        removeNote(); return;
      }

      // normal note
      if(source==='expire'){
        S.miss++;
        S.combo = (S.shieldLeft>0) ? Math.max(0, Math.floor(S.combo*0.92)) : 0;
        resetPerfectStreak();
        angerUp(CFG.boss.mood.angerUpMiss * (S.bossOn?0.55:0.25));
        if(S.finisherOn) finisherMissReset();
        if(S.gateOn) gateOnMiss();
        popJudgeFx(layer, note.x, note.y, 'miss');
        emit('hha:judge', { type:'note', judge:'miss', q:S.q, source:'expire', deltaMs:Math.round(delta), tapRate:tapMeta.tapRate, mlDiff: mlPack?.diff });
        removeNote(); return;
      }

      if(judge==='miss'){
        S.miss++;
        S.combo = (S.shieldLeft>0) ? Math.max(0, Math.floor(S.combo*0.85)) : 0;
        resetPerfectStreak();
        angerUp(CFG.boss.mood.angerUpMiss * (S.bossOn?0.55:0.25));
        if(S.finisherOn) finisherMissReset();
        if(S.gateOn) gateOnMiss();
      }else{
        if(judge==='perfect'){ S.perfect++; }
        else { S.good++; }

        S.combo++;
        S.maxCombo = Math.max(S.maxCombo, S.combo);

        const base = (judge==='perfect') ? CFG.pts.perfect : CFG.pts.good;
        const cmul = comboMultiplier(S.combo);
        const pmul = (S.penaltyLeft > 0 ? CFG.gentle.penaltyMul : 1.0);
        S.score += Math.round(base * cmul * pmul);

        const add = (judge==='perfect') ? 6.0 : 3.5;
        S.coverage[S.q] = clamp(S.coverage[S.q] + add, 0, 100);
        S.lastTouchedAt[S.q] = S.t;

        if(judge==='perfect'){
          onPerfectProgress();
          if(S.gateOn) gateOnPerfect();
        }else{
          resetPerfectStreak();
          if(S.gateOn) gateOnMiss();
        }

        if(S.finisherOn && judge==='perfect'){
          S.finisherNeed = Math.max(0, S.finisherNeed - 1);
          S.finisherBestStreak = Math.max(S.finisherBestStreak, CFG.boss.finisherNeed - S.finisherNeed);
          if(S.finisherNeed <= 0){ removeNote(); return bossWin(); }
        }
      }

      popJudgeFx(layer, note.x, note.y, judge);
      emit('hha:judge', { type:'note', judge, q:S.q, deltaMs:Math.round(delta), combo:S.combo, anger:S.anger, source, tapRate:tapMeta.tapRate, mlDiff: mlPack?.diff });
      emit('brush:coverage', { q:S.q, coverage: Object.assign({}, S.coverage) });

      // apply adaptive spawn every (play only)
      if(isPlay){
        // smooth update: only affects RUN_Q section below
        S._spawnEverySec = spawnEvery;
      }

      removeNote();
    }

    // ---------- quadrant / boss start ----------
    function maybeAdvanceQuadrantOrStartBoss(){
      const cov = S.coverage[S.q] || 0;
      const minOk = S.qTime >= CFG.minQuadSec;
      const covOk = cov >= CFG.covPass;
      const passNow = ((minOk && covOk) || S.qTime > (CFG.minQuadSec + 6));
      if(!passNow) return;

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
      if(score >= 1650) return 'S';
      if(score >= 1320) return 'A';
      if(score >= 1050) return 'B';
      if(score >= 820)  return 'C';
      return 'D';
    }

    function endGame(reason){
      if(S.phase==='END') return;
      S.phase='END';

      const covSum = CFG.quads.reduce((s,q)=>s + (S.coverage[q]||0), 0);
      const coverageScore = Math.round(covSum * 2.0);

      const bossBonus = S.bossOn ? Math.round((CFG.boss.hpMax - S.bossHp) * 5) : 0;
      const finBonus = S.finisherOn ? Math.round((CFG.boss.finisherNeed - S.finisherNeed) * 18) : 0;

      const laserPenalty = S.laserViolations * 45;
      const shockPenalty = S.shockPunishCount * 35;

      const total = S.score + coverageScore + (S.stealthHit*25) + bossBonus + finBonus - laserPenalty - shockPenalty;

      // badges evaluation
      const earned = [];
      const gameKey = 'brush';

      if(reason === 'boss_win'){
        if(grantBadge(gameKey, 'TARTAR_SLAYER')) earned.push('TARTAR_SLAYER');

        if(S.shockPunishCount === 0){
          if(grantBadge(gameKey, 'TIMING_MASTER')) earned.push('TIMING_MASTER');
        }

        const avgAnger0 = (S.angerSamples>0) ? (S.angerSum / S.angerSamples) : S.anger;
        if(avgAnger0 <= CFG.badges.calmAvgAngerMax){
          if(grantBadge(gameKey, 'CALM_BREAKER')) earned.push('CALM_BREAKER');
        }
      }

      if(S.stealthHit >= CFG.badges.uvHunterStealthHit){
        if(grantBadge(gameKey, 'UV_HUNTER')) earned.push('UV_HUNTER');
      }
      if(S.heavyCount <= CFG.badges.gentleMaxHeavy && reason !== 'timeout'){
        if(grantBadge(gameKey, 'GENTLE_MASTER')) earned.push('GENTLE_MASTER');
      }

      const avgAnger = (S.angerSamples>0) ? Math.round(S.angerSum / S.angerSamples) : Math.round(S.anger);

      const summary = {
        reason,
        scoreTotal: total,
        rank: calcRank(total),
        coverage: Object.assign({}, S.coverage),
        rhythm: { perfect:S.perfect, good:S.good, miss:S.miss, maxCombo:S.maxCombo },
        stealth: { hit:S.stealthHit, miss:S.stealthMiss },
        gentle: { heavyCount: S.heavyCount },
        uv: { energyLeft: S.uvEnergy },
        boss: {
          on: S.bossOn,
          hpLeft: S.bossHp,
          phase: S.bossPhase,
          gateOn: S.gateOn,
          finisherBestStreak: S.finisherBestStreak,
          pattern: S.bossPattern,
          angerAvg: avgAnger
        },
        laser: { violations: S.laserViolations, penalty: laserPenalty },
        shock: { punish: S.shockPunishCount, penalty: shockPenalty },
        badgesEarned: earned,
        meta: ctx,
        durationSec: (clamp(ctx.time || CFG.timeSec, 30, 180) - S.left)
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
      laserOverlay.style.opacity = '0';
      shockOverlay.style.opacity = '0';
      shockCanvas.style.opacity = '0';
      clearShockDraw();

      // end overlay (with Export CSV)
      const done = DOC.createElement('div');
      done.style.position='fixed';
      done.style.inset='0';
      done.style.display='grid';
      done.style.placeItems='center';
      done.style.zIndex='60';
      done.style.background='rgba(2,6,23,.62)';
      done.style.backdropFilter='blur(10px)';

      const badgeLine = earned.length ? `🎖 Badges: ${earned.join(', ')}` : '🎖 Badges: -';
      const logLine = logOn ? `📄 Log: ON (${evlog.length} rows)` : '📄 Log: OFF';

      done.innerHTML = `
        <div style="width:min(720px,92vw);border:1px solid rgba(148,163,184,.18);border-radius:22px;padding:18px 16px;background:rgba(2,6,23,.78);box-shadow:0 18px 60px rgba(0,0,0,.45);">
          <div style="font-weight:900;font-size:18px;">จบเกมแล้ว • Rank ${summary.rank}</div>
          <div style="margin-top:6px;color:rgba(148,163,184,1);font-size:13px;line-height:1.5;">
            Score ${summary.scoreTotal} • BossHP ${summary.boss.hpLeft} • Avg Anger ${summary.boss.angerAvg}
          </div>
          <div style="margin-top:8px;color:rgba(229,231,235,.85);font-size:13px;line-height:1.5;">
            ${badgeLine}<br>${logLine}
          </div>

          <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap;">
            <button id="btnRestart" style="padding:10px 14px;border-radius:16px;border:1px solid rgba(148,163,184,.22);background:rgba(34,197,94,.22);color:rgba(229,231,235,.95);font-weight:900;cursor:pointer;">Restart</button>
            <button id="btnBack" style="padding:10px 14px;border-radius:16px;border:1px solid rgba(148,163,184,.22);background:rgba(2,6,23,.40);color:rgba(229,231,235,.95);font-weight:900;cursor:pointer;">Back HUB</button>
            <button id="btnExport" style="padding:10px 14px;border-radius:16px;border:1px solid rgba(148,163,184,.22);background:rgba(34,211,238,.18);color:rgba(229,231,235,.95);font-weight:900;cursor:pointer;">Export CSV</button>
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
      done.querySelector('#btnExport')?.addEventListener('click', ()=>{
        const base = (ctx.pid ? `brush_${ctx.pid}` : 'brush');
        const ts = new Date().toISOString().replace(/[:.]/g,'-');
        const filename = `${base}_${ts}.csv`;
        const csv = toCSV(evlog);
        downloadText(filename, csv);
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

      // mood sampling
      if(S.bossOn && CFG.boss.mood.enabled){
        S.angerSum += S.anger;
        S.angerSamples += 1;
      }

      if(S.phase==='INTRO' && S.t >= CFG.introSec){
        S.phase = 'RUN_Q';
        S.quadIndex = 0;
        setPhase('RUN_Q');
      }

      if(S.phase==='RUN_Q'){
        S.qTime += dt;

        // adaptive spawn every (play only)
        const spawnEvery = (isPlay && S._spawnEverySec) ? S._spawnEverySec : CFG.spawnEverySec;

        if(S.t - S.lastSpawn >= spawnEvery){
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
        // Laser timing
        if(CFG.boss.laser.enabled){
          if(S.laserWarnLeft > 0){
            S.laserWarnLeft = Math.max(0, S.laserWarnLeft - dt);
            laserOverlay.style.opacity = String(0.55 + 0.35*Math.sin(S.t*18));
            if(S.laserWarnLeft <= 0) startLaser();
          }else if(S.laserLeft > 0){
            S.laserLeft = Math.max(0, S.laserLeft - dt);
            laserOverlay.style.opacity = String(0.95);
            if(S.laserLeft <= 0) stopLaser();
          }else{
            if(S.t >= S.laserNextAt && S.bossHp > 0){
              startLaserWarn();
            }
          }
        }

        // Shock timing — never overlap with laser
        if(CFG.boss.shock.enabled && S.laserLeft <= 0 && S.laserWarnLeft <= 0){
          if(!S.shockOn){
            if(S.t >= S.shockNextAt && S.bossHp > 0){
              startShock();
            }
          }else{
            const g = CFG.boss.shock;

            if(S.shockWindowLeft > 0){
              S.shockWindowLeft = Math.max(0, S.shockWindowLeft - dt);
              if(S.shockWindowLeft <= 0) closeShockWindow();
            }

            S.shockPulseTimer = Math.max(0, S.shockPulseTimer - dt);
            if(S.shockPulseTimer <= 0 && S.shockPulsesLeft > 0){
              S.shockPulsesLeft--;
              S.shockPulseIdx++;
              openShockWindow();
              S.shockPulseTimer = g.pulseGapSec;

              S.shockRingR = 0;
              HUD.toast('PULSE!', 'ตีในจังหวะสีเขียว', 600);
            }

            const sp = S.ns?.safePlay;
            if(sp){
              const maxR = Math.max(sp.w, sp.h) * 0.62;
              S.shockRingR = clamp(S.shockRingR + dt*maxR*1.8, 0, maxR);
              drawShockRing(S.shockRingR, 0.85);
            }

            if(S.shockPulsesLeft <= 0 && !S.shockWindowOpen){
              stopShock();
            }
          }
        }

        gateTick(dt);

        S.patternLeft -= dt;
        if(S.patternLeft <= 0){
          startPattern(pickPattern());
        }

        const overlayBusy = (S.laserLeft>0 || S.laserWarnLeft>0 || S.shockOn);

        if(S.bossPattern==='DUEL'){
          const interval = bossSpawnInterval() * (overlayBusy ? 1.25 : 1.0);
          if(S.t - S.lastBossSpawn >= interval){
            S.lastBossSpawn = S.t;
            spawnBossNote();
            if(CFG.uv.enabled && S.uvOn && (S.rng() < (0.40 + 0.10*(S.bossPhase-1)))) spawnStealth();
          }
        }else if(S.bossPattern==='RING'){
          if(S.t - S.lastBossSpawn >= (overlayBusy ? 1.15 : 0.95)){
            S.lastBossSpawn = S.t;
            spawnRing();
            startPattern('DUEL');
          }
        }else if(S.bossPattern==='STORM'){
          if(S.stormQueue > 0 && S.t >= S.stormNextAt){
            spawnStormTick();
            S.stormQueue--;
            S.stormNextAt = S.t + CFG.boss.stormGapSec * (overlayBusy ? 1.25 : 1.0);
          }
          if(S.stormQueue <= 0 && S.patternLeft < 0.3){
            startPattern('DUEL');
          }
        }

        maybeSpawnPickups();
        applyReclaim(dt);

        updateBossPhaseFromHp();
        maybeEnterFinisher();

        if(S.bossHp <= 0){
          endGame('boss_win');
          return;
        }
      }

      // HUD update
      const moodTag = S.bossOn ? ` • ANGER ${Math.round(S.anger)}` : '';
      const phaseLabel =
        (S.phase==='INTRO') ? 'INTRO • Ready' :
        (S.phase==='RUN_Q') ? `${S.q.toUpperCase()} • Quadrant Run` :
        (S.phase==='BOSS') ? `BOSS • ${S.bossPattern}${S.gateOn?' • GATE':''}${(S.laserLeft>0||S.laserWarnLeft>0)?' • LASER':''}${S.shockOn?' • SHOCK':''}${moodTag}` :
        'END';

      const cmul = comboMultiplier(S.combo);
      const pmul = (S.penaltyLeft > 0 ? CFG.gentle.penaltyMul : 1.0);

      let extra = '';
      if(S.bankCdLeft > 0) extra += ` • BANK ${S.bankCdLeft.toFixed(0)}s`;
      if(S.shieldLeft > 0) extra += ` • 🛡${S.shieldLeft.toFixed(0)}s`;
      if(S.reclaimFreezeLeft > 0) extra += ` • 💧${S.reclaimFreezeLeft.toFixed(0)}s`;
      if(S.uvOn) extra += ' • UV';
      if(S.finisherOn) extra += ` • FIN ${S.finisherNeed}`;
      if(S.gateOn) extra += ` • GATE ${S.gateNeed}`;
      if(S.laserLeft > 0) extra += ` • LASER ${(S.laserLeft).toFixed(0)}s`;
      if(S.shockOn) extra += ` • SHOCK ${(S.shockPulsesLeft+ (S.shockWindowOpen?1:0))}`;

      HUD.setTimer(S.left, (clamp(ctx.time||CFG.timeSec, 30, 180)), phaseLabel + extra);
      HUD.setCoverage(S.coverage, CFG.covPass, S.reclaiming);
      HUD.setCombo(S.combo, cmul*pmul);

      if(CFG.uv.enabled) HUD.setUVEnergy(S.uvEnergy, CFG.uv.energyMax, S.uvOn, S.uvCdLeft);

      if(S.bossOn){
        HUD.showBoss(true);
        HUD.setBoss(S.bossHp, CFG.boss.hpMax, S.bossPhase, CFG.boss.phaseMax);
      }else{
        HUD.showBoss(false);
      }

      // emit time (and log snapshot occasionally)
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
          gateOn:S.gateOn,
          gateNeed:S.gateNeed,
          laserLeft:S.laserLeft,
          laserWarnLeft:S.laserWarnLeft,
          laserViol:S.laserViolations,
          shockOn:S.shockOn,
          shockPulsesLeft:S.shockPulsesLeft,
          shockWindowOpen:S.shockWindowOpen,
          shockPunish:S.shockPunishCount,
          anger:S.anger
        });
      }

      if(S.left <= 0 && S.phase !== 'END'){
        endGame('timeout');
        return;
      }

      if(S.phase !== 'END') requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);

    // initial schedules
    scheduleNextLaser();
    scheduleNextShock();
  }

  WIN.BrushVR = WIN.BrushVR || {};
  WIN.BrushVR.boot = boot;
})();