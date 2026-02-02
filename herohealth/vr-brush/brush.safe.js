// === /herohealth/vr-brush/brush.safe.js ===
// BrushVR SAFE Engine — DOM90 v0.2
// ✅ Adds: Tug-of-war reclaim + Gentle (tap-rate heuristic + penalty + toast)
// Emits: hha:start, hha:time, hha:judge, brush:coverage, brush:gentle, hha:end
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
      toastS: id('toastS')
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
      if(el.toastT) el.toastT.textContent = title || 'เบามือหน่อย!';
      if(el.toastS) el.toastS.textContent = sub || '';
      el.toastWrap.setAttribute('data-on','1');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(()=> el.toastWrap.setAttribute('data-on','0'), ms);
    }

    return { setTimer, setCombo, setFever, setCoverage, toast };
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
  function mkNoteEl(){
    const el = DOC.createElement('button');
    el.className = 'brush-note';
    el.type = 'button';
    el.setAttribute('aria-label','note');

    el.style.position='absolute';
    el.style.width='48px';
    el.style.height='48px';
    el.style.borderRadius='18px';
    el.style.border='1px solid rgba(148,163,184,.25)';
    el.style.background='rgba(34,197,94,.22)';
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
    el.textContent='🦷';
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

  // ---------- config (DOM90 baseline ~ normal) ----------
  const CFG = {
    timeSec: 90,
    introSec: 2.5,
    quads: ['q1','q2','q3','q4'],

    covPass: 80,
    minQuadSec: 12,

    judgeMs: { perfect: 120, good: 210 },
    pts: { perfect: 12, good: 7 },

    feverMax: 20,
    feverOnSec: 6,

    // spawn
    noteRadius: 26,
    noteLifeSec: 1.9,
    spawnEverySec: 0.72,

    // Gentle (tap-rate heuristic)
    gentle: {
      tapRateHeavyPerSec: 7,     // >7 hits/sec in rolling 1s => heavy
      spamIntervalMs: 120,       // hits closer than this => heavy
      heavyLimit: 4,             // allowed heavy count before penalty
      penaltySec: 4.0,           // penalty duration
      penaltyMul: 0.80           // multiplier scale while penalty active
    },

    // Tug-of-war reclaim
    tug: {
      enabled: true,
      reclaimDelaySec: 8.0,
      reclaimRatePerSec: 0.012   // coverage decreases 1.2% per sec (normal)
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

    // state
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

      combo:0, maxCombo:0,

      fever:0,
      feverOn:false,
      feverLeft:0,

      // Gentle
      heavyCount:0,
      penaltyLeft:0,
      hitTimes:[],        // rolling window for tap rate
      lastHitMs:0,

      // Tug-of-war
      lastTouchedAt:{ q1:0, q2:0, q3:0, q4:0 },
      reclaiming:{ q1:0, q2:0, q3:0, q4:0 },

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

    function setPhase(p){
      S.phase = p;
      if(p==='RUN_Q'){
        S.q = CFG.quads[S.quadIndex];
        S.qTime = 0;
      }
    }

    // ---- Tug-of-war reclaim tick ----
    function applyReclaim(dt){
      // reset flags each tick
      S.reclaiming.q1 = S.reclaiming.q2 = S.reclaiming.q3 = S.reclaiming.q4 = 0;
      if(!CFG.tug.enabled) return;

      const now = S.t; // seconds since start
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

    // ---- Gentle heuristic ----
    function recordHitAndDetectHeavy(hitMs){
      // rolling 1s window
      S.hitTimes.push(hitMs);
      while(S.hitTimes.length && (hitMs - S.hitTimes[0]) > 1000) S.hitTimes.shift();

      const tapRate = S.hitTimes.length; // hits in last 1s
      const interval = (S.lastHitMs>0) ? (hitMs - S.lastHitMs) : 9999;
      S.lastHitMs = hitMs;

      let heavy = false;
      if(tapRate > CFG.gentle.tapRateHeavyPerSec) heavy = true;
      if(interval > 0 && interval < CFG.gentle.spamIntervalMs) heavy = true;

      if(heavy){
        S.heavyCount++;
        HUD.toast('เบามือหน่อย!', 'กดถี่/รัวเกินไป ลองช้าลงหน่อย', 1400);

        // trigger penalty if exceed limit
        if(S.heavyCount > CFG.gentle.heavyLimit){
          S.penaltyLeft = Math.max(S.penaltyLeft, CFG.gentle.penaltySec);
          // soften combo (ไม่ให้เด็กท้อ แต่รู้สึกมีผล)
          S.combo = Math.floor(S.combo * 0.85);
        }
        emit('brush:gentle', {
          heavyCount: S.heavyCount,
          penaltyActive: S.penaltyLeft > 0,
          tapRate
        });
      }
    }

    // ---- note spawning ----
    function spawnNote(){
      const id = ++S.noteSeq;
      const p = pickSpawnPoint(S.rng, S.ns, CFG.noteRadius);

      const el = mkNoteEl();
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

      const note = { id, bornMs:born, dueMs:due, x:p.x, y:p.y, el, used:false };
      S.notes.set(id, note);

      el.addEventListener('click', (ev)=>{
        ev.preventDefault();
        judgeNote(note, nowMs(), 'tap');
      }, {passive:false});

      setTimeout(()=>{
        if(!note.used){
          judgeNote(note, nowMs(), 'expire');
        }
      }, Math.round(CFG.noteLifeSec*1000));
    }

    // ---- judging ----
    function judgeNote(note, hitMs, source){
      if(!note || note.used) return;
      note.used = true;

      // gentle detection only for intentional actions (tap/shoot)
      if(source==='tap' || source==='shoot'){
        recordHitAndDetectHeavy(hitMs);
      }

      const delta = Math.abs(hitMs - note.dueMs);
      let judge = 'miss';
      if(source!=='expire'){
        if(delta <= CFG.judgeMs.perfect) judge = 'perfect';
        else if(delta <= CFG.judgeMs.good) judge = 'good';
      }

      // remove note element
      try{ note.el.style.transition = 'transform .18s ease, opacity .18s ease'; }catch(_){}
      try{ note.el.style.opacity='0'; note.el.style.transform='translate(-50%,-50%) scale(0.85)'; }catch(_){}
      setTimeout(()=>{ try{ note.el.remove(); }catch(_){} }, 220);
      S.notes.delete(note.id);

      // apply score + combo + fever
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

        // coverage increments
        const add = (judge==='perfect') ? 6.0 : 3.5;
        S.coverage[S.q] = clamp(S.coverage[S.q] + add, 0, 100);

        // mark touch time for current quadrant (prevents reclaim)
        S.lastTouchedAt[S.q] = S.t;
      }

      // fever trigger
      if(!S.feverOn && S.fever >= CFG.feverMax){
        S.feverOn = true;
        S.feverLeft = CFG.feverOnSec;
        S.fever = 5;
      }

      popJudgeFx(layer, note.x, note.y, judge);

      emit('hha:judge', { type:'note', judge, q:S.q, deltaMs:Math.round(delta), combo:S.combo, fever:S.fever, source });
      emit('brush:coverage', { q:S.q, coverage: Object.assign({}, S.coverage) });
    }

    // ---- quadrant rotation ----
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

    // ---- end game ----
    function calcRank(score){
      if(score >= 1000) return 'S';
      if(score >= 800)  return 'A';
      if(score >= 650)  return 'B';
      if(score >= 520)  return 'C';
      return 'D';
    }

    function endGame(reason){
      if(S.phase==='END') return;
      S.phase='END';

      // total includes coverage sum as bonus (purpose matters)
      const covSum = CFG.quads.reduce((s,q)=>s + (S.coverage[q]||0), 0);
      const coverageScore = Math.round(covSum * 2.0);
      const total = S.score + coverageScore;

      const summary = {
        reason,
        scoreTotal: total,
        rank: calcRank(total),
        coverage: Object.assign({}, S.coverage),
        rhythm: { perfect:S.perfect, good:S.good, miss:S.miss, maxCombo:S.maxCombo },
        gentle: { heavyCount: S.heavyCount },
        meta: ctx,
        durationSec: CFG.timeSec - S.left
      };

      // store last summary
      try{
        localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary));
        const histKey = 'HHA_SUMMARY_HISTORY';
        const hist = JSON.parse(localStorage.getItem(histKey) || '[]');
        hist.unshift(Object.assign({ts:Date.now()}, summary));
        localStorage.setItem(histKey, JSON.stringify(hist.slice(0,40)));
      }catch(_){}

      emit('hha:end', { summary });

      // clear notes
      for(const note of S.notes.values()){
        try{ note.el.remove(); }catch(_){}
      }
      S.notes.clear();

      // overlay
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
            Score ${summary.scoreTotal} • Coverage ${Math.round(covSum)}% • Heavy ${summary.gentle.heavyCount} • ComboMax ${summary.rhythm.maxCombo}
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

    // ---- input bridge: vr-ui tap-to-shoot ----
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

        // spawn notes
        if(S.t - S.lastSpawn >= CFG.spawnEverySec){
          S.lastSpawn = S.t;
          spawnNote();
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
      HUD.setTimer(S.left, CFG.timeSec, phaseLabel);
      HUD.setCoverage(S.coverage, CFG.covPass, S.reclaiming);
      HUD.setCombo(S.combo, cmul*fmul*pmul);
      HUD.setFever(S.fever, CFG.feverMax);

      // time emit
      if((t - S.lastTimeEmit) > 250){
        S.lastTimeEmit = t;
        emit('hha:time', {
          tLeft:S.left,
          score:S.score,
          q:S.q,
          coverage:Object.assign({}, S.coverage),
          heavyCount:S.heavyCount,
          penaltyActive:(S.penaltyLeft>0)
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