// === /herohealth/vr-brush/brush.safe.js ===
// BrushVR SAFE Engine — DOM90 v0.1 (Quadrants + Rhythm + Coverage + Combo/Fever + HUD-safe spawn)
// Emits: hha:start, hha:time, hha:judge, brush:coverage, hha:end
(function(){
  'use strict';
  const WIN = window, DOC = document;

  // ---------- tiny helpers ----------
  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));
  const nowMs = ()=>performance.now();
  const emit = (n,d)=>{ try{ WIN.dispatchEvent(new CustomEvent(n,{detail:d})); }catch(_){ } };
  const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };

  function makeRNG(seed){
    let x = (Number(seed)||Date.now()) >>> 0;
    return ()=> (x = (1664525*x + 1013904223) >>> 0) / 4294967296;
  }

  // ---------- HUD API (full enough for v0.1) ----------
  const HUD = (function(){
    const id = (s)=>DOC.getElementById(s);
    const el = {
      tFill:id('tFill'), tLeft:id('tLeft'), tPhase:id('tPhase'),
      cCombo:id('cCombo'), cMul:id('cMul'),
      fFill:id('fFill'), fN:id('fN'),
      cov: { q1:id('cov-q1'), q2:id('cov-q2'), q3:id('cov-q3'), q4:id('cov-q4') }
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
    function setCoverage(map, pass){
      for(const q of ['q1','q2','q3','q4']){
        const cell = el.cov[q];
        if(!cell) continue;
        const pct = Math.round(map[q]||0);
        const pEl = cell.querySelector('.p');
        if(pEl) pEl.textContent = `${pct}%`;
        cell.setAttribute('data-ok', pct >= pass ? '1':'0');
      }
    }
    return { setTimer, setCombo, setFever, setCoverage };
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
      // only skip truly hidden
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
    // inline styles (so v0.1 runs even without extra css)
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

  // ---------- core config (DOM90) ----------
  const CFG = {
    timeSec: 90,
    introSec: 2.5,
    quads: ['q1','q2','q3','q4'],
    // start with normal (you can tune later)
    covPass: 80,
    minQuadSec: 12,
    // rhythm: timing windows in ms
    judgeMs: { perfect: 120, good: 210 },
    // scoring
    pts: { perfect: 12, good: 7 },
    feverMax: 20,
    feverOnSec: 6,
    // spawn
    noteRadius: 26,
    noteLifeSec: 1.9,
    spawnEverySec: 0.72
  };

  function comboMultiplier(combo){
    if(combo>=20) return 1.6;
    if(combo>=10) return 1.4;
    if(combo>=5) return 1.2;
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
      q: 'q1',
      qTime:0,
      qTimes: [0,0,0,0],
      coverage: { q1:0, q2:0, q3:0, q4:0 },
      score:0,
      perfect:0, good:0, miss:0,
      combo:0, maxCombo:0,
      fever:0,
      feverOn:false,
      feverLeft:0,
      lastTimeEmit:0,
      lastSpawn:0,
      // active notes
      notes: new Map(), // id -> {id, dueMs, bornMs, x,y, el, used}
      noteSeq: 0,
      // no-spawn
      ns: null
    };

    emit('hha:start', { game:'brush', ctx });

    function rebuildNoSpawn(){
      S.ns = buildNoSpawnZones(S.view);
    }
    rebuildNoSpawn();
    WIN.addEventListener('resize', ()=>{ rebuildNoSpawn(); });

    function setPhase(p){
      S.phase = p;
      if(p==='RUN_Q'){
        S.q = CFG.quads[S.quadIndex];
        S.qTime = 0;
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
      const due = born + 520 + (S.rng()*220); // due time window: short delay

      // animate in
      requestAnimationFrame(()=>{
        el.style.transition = 'transform .22s ease, opacity .22s ease';
        el.style.opacity = '1';
        el.style.transform = 'translate(-50%,-50%) scale(1)';
      });

      const note = { id, bornMs: born, dueMs: due, x:p.x, y:p.y, el, used:false };
      S.notes.set(id, note);

      // click/tap hit
      el.addEventListener('click', (ev)=>{
        ev.preventDefault();
        judgeNote(note, nowMs(), 'tap');
      }, {passive:false});

      // auto-expire
      setTimeout(()=>{
        if(!note.used){
          judgeNote(note, nowMs(), 'expire'); // counts as miss
        }
      }, Math.round(CFG.noteLifeSec*1000));
    }

    // ---- judging ----
    function judgeNote(note, hitMs, source){
      if(!note || note.used) return;
      note.used = true;

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

        const mul = comboMultiplier(S.combo) * (S.feverOn ? 1.25 : 1.0);
        const base = (judge==='perfect') ? CFG.pts.perfect : CFG.pts.good;
        S.score += Math.round(base * mul);

        // coverage increments
        const add = (judge==='perfect') ? 6.0 : 3.5;
        S.coverage[S.q] = clamp(S.coverage[S.q] + add, 0, 100);
      }

      // fever trigger
      if(!S.feverOn && S.fever >= CFG.feverMax){
        S.feverOn = true;
        S.feverLeft = CFG.feverOnSec;
        S.fever = 5; // reset to small
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
        // store q time
        S.qTimes[S.quadIndex] = S.qTime;

        if(S.quadIndex < 3){
          S.quadIndex++;
          setPhase('RUN_Q');
        }else{
          // finish v0.1 at end of Q4 (no UV/BOSS yet)
          endGame('quad_done');
        }
      }
    }

    // ---- end game ----
    function calcRank(score){
      if(score >= 1000) return 'S';
      if(score >= 800) return 'A';
      if(score >= 650) return 'B';
      if(score >= 520) return 'C';
      return 'D';
    }

    function endGame(reason){
      if(S.phase==='END') return;
      S.phase='END';

      // basic total score includes coverage sum as bonus (so purpose matters)
      const covSum = CFG.quads.reduce((s,q)=>s + (S.coverage[q]||0), 0);
      const coverageScore = Math.round(covSum * 2.0);
      const total = S.score + coverageScore;

      const summary = {
        reason,
        scoreTotal: total,
        rank: calcRank(total),
        coverage: Object.assign({}, S.coverage),
        rhythm: { perfect:S.perfect, good:S.good, miss:S.miss, maxCombo:S.maxCombo },
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

      // tiny overlay message
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
            Score ${summary.scoreTotal} • Coverage ${Math.round(covSum)}% • ComboMax ${summary.rhythm.maxCombo}
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

    // ---- input bridge: support vr-ui tap-to-shoot (optional) ----
    // If vr-ui emits hha:shoot {x,y,...}, we can "hit test" nearest note.
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
      // lock distance threshold (px^2)
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

        // spawn
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

        maybeAdvanceQuadrant();
      }

      // HUD updates
      const phaseLabel = (S.phase==='INTRO')
        ? 'INTRO • Ready'
        : (S.phase==='RUN_Q')
          ? `${S.q.toUpperCase()} • Quadrant Run`
          : 'END';

      HUD.setTimer(S.left, CFG.timeSec, phaseLabel);
      HUD.setCoverage(S.coverage, CFG.covPass);
      HUD.setCombo(S.combo, comboMultiplier(S.combo) * (S.feverOn?1.25:1.0));
      HUD.setFever(S.fever, CFG.feverMax);

      // emit time
      if((t - S.lastTimeEmit) > 250){
        S.lastTimeEmit = t;
        emit('hha:time', { tLeft:S.left, score:S.score });
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