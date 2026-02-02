// === /herohealth/vr-brush/brush.safe.js ===
// BrushVR SAFE Engine — DOM90 v0.3
// ✅ Adds: UV power (3 charges) + stealth plaque notes (only hittable during UV window)
// Includes: Tug-of-war reclaim + Gentle (penalty) from v0.2
// Emits: hha:start, hha:time, hha:judge, brush:coverage, brush:gentle, brush:uv, hha:end
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
      uvSub: id('uvSub')
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

    return { setTimer, setCombo, setFever, setCoverage, toast, showUV, setUVEnergy, el };
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
      // NOTE: uv/toast might be hidden, but we still keep them as zones ONLY when visible
      if((id==='hud-boss' || id==='hud-uv' || id==='hud-toast') && el.getAttribute('data-on')==='0') continue;
      const rc = rectFromEl(el);
      if(!rc || rc.w<2 || rc.h<2) continue;
      zones.push(padRect(rc, pad));
    }
    return { safePlay, zones };
  }

  function pickSpawnPoint(rng, ns, radius){
    const { safePlay, zones } = ns;
    const tries = 80;
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
    el.setAttribute('aria-label', kind==='stealth' ? 'stealth plaque' : 'note');

    el.style.position='absolute';
    el.style.width='48px';
    el.style.height='48px';
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

    if(kind==='stealth'){
      el.textContent='🟣';
      el.style.background='rgba(168,85,247,.14)';
      el.style.border='1px solid rgba(168,85,247,.30)';
      el.style.opacity='0.10'; // mostly hidden by default
    }else{
      el.textContent='🦷';
      el.style.background='rgba(34,197,94,.22)';
      el.style.opacity='0';
    }
    return el;
  }

  function popJudgeFx(layer, x, y, judge){
    const fx = DOC.createElement('div');
    fx.textContent = (judge==='perfect') ? 'PERFECT!' : (judge==='good' ? 'GOOD' : 'MISS');
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
    pts: { perfect: 12, good: 7, stealth: 22 },

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
      stealthSpawnEverySec: 0.55,  // during UV window
      stealthVisibleOpacity: 0.85, // when UV ON
      stealthHiddenOpacity: 0.10,  // when UV OFF
      stealthHitWhenOffPenalty: true
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

      lastTouchedAt:{ q1:0, q2:0, q3:0, q4:0 },
      reclaiming:{ q1:0, q2:0, q3:0, q4:0 },

      // UV state
      uvEnergy: CFG.uv.energyMax,
      uvOn:false,
      uvLeft:0,
      uvCdLeft:0,
      lastStealthSpawn:0,

      lastTimeEmit:0,
      lastSpawn:0,

      notes:new Map(), // id -> note
      noteSeq:0,

      ns:null
    };

    emit('hha:start', { game:'brush', ctx });

    function rebuildNoSpawn(){ S.ns = buildNoSpawnZones(S.view); }
    rebuildNoSpawn();
    WIN.addEventListener('resize', rebuildNoSpawn);

    function setPhase(p){
      S.phase = p;
      if(p==='RUN_Q'){
        S.q = CFG.quads[S.quadIndex];
        S.qTime = 0;
      }
    }

    // --- Tug-of-war reclaim ---
    function applyReclaim(dt){
      S.reclaiming.q1 = S.reclaiming.q2 = S.reclaiming.q3 = S.reclaiming.q4 = 0;
      if(!CFG.tug.enabled) return;

      const now = S.t;
      for(const q of CFG.quads){
        if(q === S.q) continue;
        const idle = now - (S.lastTouchedAt[q]||0);
        if(idle >= CFG.tug.reclaimDelaySec){
          const dec = (CFG.tug.reclaimRatePerSec * 100) * dt;
          const before = S.coverage[q]||0;
          const after = clamp(before - dec, 0, 100);
          S.coverage[q] = after;
          if(after < before) S.reclaiming[q] = 1;
        }
      }
    }

    // --- Gentle heuristic ---
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
        }
        emit('brush:gentle', { heavyCount:S.heavyCount, penaltyActive:S.penaltyLeft>0, tapRate });
      }
    }

    // --- Note spawn helpers ---
    function addNote(note){
      S.notes.set(note.id, note);
      // expire auto
      const life = (note.kind==='stealth') ? CFG.uv.stealthLifeSec : CFG.noteLifeSec;
      setTimeout(()=>{
        if(!note.used){
          judgeNote(note, nowMs(), 'expire');
        }
      }, Math.round(life*1000));
    }

    function spawnNormal(){
      const id = ++S.noteSeq;
      const p = pickSpawnPoint(S.rng, S.ns, CFG.noteRadius);
      const el = mkNoteEl('normal');

      el.style.left = `${p.x}px`;
      el.style.top  = `${p.y}px`;
      el.style.transform = 'translate(-50%,-50%) scale(0.92)';
      el.style.opacity = '0';
      layer.appendChild(el);

      const born = nowMs();
      const due = born + 520 + (S.rng()*220);

      requestAnimationFrame(()=>{
        el.style.transition = 'transform .22s ease, opacity .22s ease';
        el.style.opacity = '1';
        el.style.transform = 'translate(-50%,-50%) scale(1)';
      });

      const note = { id, kind:'normal', bornMs:born, dueMs:due, x:p.x, y:p.y, el, used:false };
      el.addEventListener('click', (ev)=>{ ev.preventDefault(); judgeNote(note, nowMs(), 'tap'); }, {passive:false});
      addNote(note);
    }

    function spawnStealth(){
      const id = ++S.noteSeq;
      const p = pickSpawnPoint(S.rng, S.ns, CFG.noteRadius);
      const el = mkNoteEl('stealth');

      el.style.left = `${p.x}px`;
      el.style.top  = `${p.y}px`;
      el.style.transform = 'translate(-50%,-50%) scale(0.92)';
      layer.appendChild(el);

      const born = nowMs();
      const due = born + 420 + (S.rng()*240); // slightly earlier beat

      // make visible only when UV is on
      function syncOpacity(){
        el.style.opacity = S.uvOn ? String(CFG.uv.stealthVisibleOpacity) : String(CFG.uv.stealthHiddenOpacity);
      }
      syncOpacity();

      const note = { id, kind:'stealth', bornMs:born, dueMs:due, x:p.x, y:p.y, el, used:false, syncOpacity };
      el.addEventListener('click', (ev)=>{ ev.preventDefault(); judgeNote(note, nowMs(), 'tap'); }, {passive:false});
      addNote(note);
    }

    function syncStealthVisibility(){
      for(const note of S.notes.values()){
        if(note.kind==='stealth' && typeof note.syncOpacity==='function') note.syncOpacity();
      }
    }

    // --- UV control ---
    function tryUseUV(){
      if(!CFG.uv.enabled) return;
      if(S.uvOn) return;
      if(S.uvCdLeft > 0){
        HUD.toast('ยังใช้ UV ไม่ได้', `รอคูลดาวน์อีก ${(S.uvCdLeft).toFixed(1)}s`, 1200);
        return;
      }
      if(S.uvEnergy <= 0){
        HUD.toast('พลังงาน UV หมด', 'เก็บคอมโบ/ทำคะแนนเพื่อเติมในอนาคต (จะใส่ในแพตช์ถัดไป)', 1400);
        return;
      }
      S.uvEnergy -= 1;
      S.uvOn = true;
      S.uvLeft = CFG.uv.windowSec;
      S.uvCdLeft = CFG.uv.cooldownSec;

      HUD.toast('UV ON!', 'ตอนนี้เห็นคราบล่องหนแล้ว!', 1200);
      syncStealthVisibility();

      emit('brush:uv', { on:true, energy:S.uvEnergy });
      // rebuild zones because hud-uv visible affects safe spawn
      rebuildNoSpawn();
    }

    // bind UV button (safe even if absent)
    if(HUD.el.uvBtn){
      HUD.el.uvBtn.addEventListener('click', (ev)=>{ ev.preventDefault(); tryUseUV(); }, {passive:false});
    }

    // --- judgement ---
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

      // stealth: only meaningful when UV on
      if(note.kind==='stealth'){
        if(source==='expire'){
          S.stealthMiss++;
          // soft miss: do not wipe combo entirely
          S.combo = Math.max(0, Math.floor(S.combo * 0.70));
          S.fever = Math.max(0, S.fever - 2);
          judge = 'miss';
        }else{
          if(S.uvOn){
            // good hit
            S.stealthHit++;
            // treat as perfect-ish for scoring
            const base = CFG.pts.stealth;
            const cmul = comboMultiplier(S.combo+1);
            const fmul = (S.feverOn ? 1.25 : 1.0);
            const pmul = (S.penaltyLeft > 0 ? CFG.gentle.penaltyMul : 1.0);
            S.score += Math.round(base * cmul * fmul * pmul);

            S.combo++;
            S.maxCombo = Math.max(S.maxCombo, S.combo);
            S.fever += 3;

            // big coverage burst
            S.coverage[S.q] = clamp(S.coverage[S.q] + 10.0, 0, 100);
            S.lastTouchedAt[S.q] = S.t;

            popJudgeFx(layer, note.x, note.y, 'perfect');
            emit('hha:judge', { type:'stealth', judge:'hit', q:S.q, deltaMs:Math.round(delta), combo:S.combo, uvOn:true, source });
          }else{
            // hit while UV off
            S.stealthMiss++;
            if(CFG.uv.stealthHitWhenOffPenalty){
              S.combo = Math.max(0, Math.floor(S.combo * 0.80));
              S.fever = Math.max(0, S.fever - 1);
              HUD.toast('ยังไม่เห็นคราบ!', 'กด UV ก่อนถึงจะปราบคราบล่องหนได้', 1400);
            }
            popJudgeFx(layer, note.x, note.y, 'miss');
            emit('hha:judge', { type:'stealth', judge:'blocked', q:S.q, uvOn:false, source });
          }
        }
      }else{
        // normal notes
        if(judge==='miss'){
          S.miss++;
          S.combo = 0;
          S.fever = Math.max(0, S.fever - 3);
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
        }
        popJudgeFx(layer, note.x, note.y, judge);
        emit('hha:judge', { type:'note', judge, q:S.q, deltaMs:Math.round(delta), combo:S.combo, fever:S.fever, source });
      }

      // fever trigger
      if(!S.feverOn && S.fever >= CFG.feverMax){
        S.feverOn = true;
        S.feverLeft = CFG.feverOnSec;
        S.fever = 5;
      }

      // remove element
      try{ note.el.style.transition = 'transform .18s ease, opacity .18s ease'; }catch(_){}
      try{
        note.el.style.opacity='0';
        note.el.style.transform='translate(-50%,-50%) scale(0.85)';
      }catch(_){}
      setTimeout(()=>{ try{ note.el.remove(); }catch(_){} }, 220);
      S.notes.delete(note.id);

      emit('brush:coverage', { q:S.q, coverage: Object.assign({}, S.coverage) });
    }

    // --- quadrant rotation ---
    function maybeAdvanceQuadrant(){
      const cov = S.coverage[S.q] || 0;
      const minOk = S.qTime >= CFG.minQuadSec;
      const covOk = cov >= CFG.covPass;
      if((minOk && covOk) || S.qTime > (CFG.minQuadSec + 6)){
        S.qTimes[S.quadIndex] = S.qTime;
        if(S.quadIndex < 3){
          S.quadIndex++;
          setPhase('RUN_Q');
        }else{
          endGame('quad_done');
        }
      }
    }

    // --- end game ---
    function calcRank(score){
      if(score >= 1200) return 'S';
      if(score >= 950)  return 'A';
      if(score >= 760)  return 'B';
      if(score >= 600)  return 'C';
      return 'D';
    }

    function endGame(reason){
      if(S.phase==='END') return;
      S.phase='END';

      const covSum = CFG.quads.reduce((s,q)=>s + (S.coverage[q]||0), 0);
      const coverageScore = Math.round(covSum * 2.0);
      const total = S.score + coverageScore + (S.stealthHit*25);

      const summary = {
        reason,
        scoreTotal: total,
        rank: calcRank(total),
        coverage: Object.assign({}, S.coverage),
        rhythm: { perfect:S.perfect, good:S.good, miss:S.miss, maxCombo:S.maxCombo },
        stealth: { hit:S.stealthHit, miss:S.stealthMiss },
        gentle: { heavyCount: S.heavyCount },
        uv: { energyLeft: S.uvEnergy },
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

      const done = DOC.createElement('div');
      done.style.position='fixed';
      done.style.inset='0';
      done.style.display='grid';
      done.style.placeItems='center';
      done.style.zIndex='60';
      done.style.background='rgba(2,6,23,.62)';
      done.style.backdropFilter='blur(10px)';
      done.innerHTML = `
        <div style="width:min(520px,92vw);border:1px solid rgba(148,163,184,.18);border-radius:22px;padding:18px 16px;background:rgba(2,6,23,.78);box-shadow:0 18px 60px rgba(0,0,0,.45);">
          <div style="font-weight:900;font-size:18px;">จบเกมแล้ว • Rank ${summary.rank}</div>
          <div style="margin-top:6px;color:rgba(148,163,184,1);font-size:13px;line-height:1.5;">
            Score ${summary.scoreTotal} • Coverage ${Math.round(covSum)}% • Stealth ${summary.stealth.hit}/${summary.stealth.miss} • Heavy ${summary.gentle.heavyCount}
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

    // --- input bridge: vr-ui tap-to-shoot ---
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

    // ---- UV HUD init ----
    if(CFG.uv.enabled){
      HUD.showUV(true);
      HUD.setUVEnergy(S.uvEnergy, CFG.uv.energyMax, S.uvOn, S.uvCdLeft);
      rebuildNoSpawn(); // uv panel now visible affects zones
    }else{
      HUD.showUV(false);
    }

    // start
    setPhase('INTRO');

    // main loop
    let last = nowMs();
    function loop(t){
      const dt = Math.min(0.05, (t - last)/1000);
      last = t;

      S.t += dt;
      S.left = Math.max(0, S.left - dt);

      // phase switching
      if(S.phase==='INTRO' && S.t >= CFG.introSec){
        S.phase = 'RUN_Q';
        S.quadIndex = 0;
        setPhase('RUN_Q');
      }

      if(S.phase==='RUN_Q'){
        S.qTime += dt;

        // spawn normal notes
        if(S.t - S.lastSpawn >= CFG.spawnEverySec){
          S.lastSpawn = S.t;
          spawnNormal();
        }

        // fever countdown
        if(S.feverOn){
          S.feverLeft -= dt;
          if(S.feverLeft <= 0){
            S.feverOn = false;
            S.feverLeft = 0;
          }
        }

        // gentle penalty countdown
        if(S.penaltyLeft > 0){
          S.penaltyLeft = Math.max(0, S.penaltyLeft - dt);
        }

        // UV window + stealth spawns
        if(CFG.uv.enabled){
          if(S.uvCdLeft > 0) S.uvCdLeft = Math.max(0, S.uvCdLeft - dt);

          if(S.uvOn){
            S.uvLeft = Math.max(0, S.uvLeft - dt);
            if(S.t - S.lastStealthSpawn >= CFG.uv.stealthSpawnEverySec){
              S.lastStealthSpawn = S.t;
              spawnStealth();
            }
            if(S.uvLeft <= 0){
              S.uvOn = false;
              S.uvLeft = 0;
              syncStealthVisibility();
              HUD.toast('UV OFF', 'จบช่วง UV แล้ว', 900);
              emit('brush:uv', { on:false, energy:S.uvEnergy });
            }
          }
          // keep stealth opacity synced (cheap)
          // syncStealthVisibility(); // optional; we already update on toggle
        }

        // tug-of-war reclaim
        applyReclaim(dt);

        maybeAdvanceQuadrant();
      }

      // HUD updates
      const phaseLabel =
        (S.phase==='INTRO') ? 'INTRO • Ready' :
        (S.phase==='RUN_Q') ? `${S.q.toUpperCase()} • Quadrant Run` :
        'END';

      const cmul = comboMultiplier(S.combo);
      const fmul = (S.feverOn ? 1.25 : 1.0);
      const pmul = (S.penaltyLeft > 0 ? CFG.gentle.penaltyMul : 1.0);

      HUD.setTimer(S.left, CFG.timeSec, phaseLabel + (S.uvOn ? ' • UV' : ''));
      HUD.setCoverage(S.coverage, CFG.covPass, S.reclaiming);
      HUD.setCombo(S.combo, cmul*fmul*pmul);
      HUD.setFever(S.fever, CFG.feverMax);
      if(CFG.uv.enabled) HUD.setUVEnergy(S.uvEnergy, CFG.uv.energyMax, S.uvOn, S.uvCdLeft);

      // time emit
      if((t - S.lastTimeEmit) > 250){
        S.lastTimeEmit = t;
        emit('hha:time', {
          tLeft:S.left,
          score:S.score,
          q:S.q,
          coverage:Object.assign({}, S.coverage),
          heavyCount:S.heavyCount,
          penaltyActive:(S.penaltyLeft>0),
          uvOn:S.uvOn,
          uvEnergy:S.uvEnergy
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