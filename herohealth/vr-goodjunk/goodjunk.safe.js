// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR Engine — PRODUCTION (targets failsafe + end event dispatch)
// FULL v20260224a-failsafeTargets+endEvent
'use strict';

export function boot(cfg){
  const DOC = document;
  const WIN = window;

  const $ = (sel, root=DOC)=> root.querySelector(sel);

  const qs = (k, def=null)=>{ try { return new URL(location.href).searchParams.get(k) ?? def; } catch { return def; } };
  const clamp = (v,min,max)=>{ v=Number(v); if(!Number.isFinite(v)) v=min; return Math.max(min, Math.min(max,v)); };

  // -------- config --------
  const view = String(cfg?.view ?? qs('view','mobile')).toLowerCase();
  const run  = String(cfg?.run  ?? qs('run','play')).toLowerCase();
  const diff = String(cfg?.diff ?? qs('diff','normal')).toLowerCase();
  const timeLimitSec = clamp(cfg?.time ?? qs('time','80'), 20, 300);

  const pid = String(qs('pid','')||'').trim();
  const seed0 = String(cfg?.seed ?? qs('seed','') ?? '').trim() || String(Date.now());

  // deterministic RNG (mulberry32)
  function xfnv1a(str){
    str = String(str||'');
    let h = 2166136261 >>> 0;
    for(let i=0;i<str.length;i++){
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h>>>0;
  }
  function mulberry32(a){
    return function(){
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rng = mulberry32(xfnv1a(`${seed0}|goodjunk|${run}|${diff}|${pid||'anon'}`));

  // -------- DOM refs --------
  const layer = DOC.getElementById('gj-layer');
  const layerR= DOC.getElementById('gj-layer-r');

  const elScore = DOC.getElementById('hud-score');
  const elTime  = DOC.getElementById('hud-time');
  const elMiss  = DOC.getElementById('hud-miss');
  const elGrade = DOC.getElementById('hud-grade');

  const elGoal      = DOC.getElementById('hud-goal');
  const elGoalCur   = DOC.getElementById('hud-goal-cur');
  const elGoalTgt   = DOC.getElementById('hud-goal-target');
  const elGoalDesc  = DOC.getElementById('goalDesc');

  const elMini      = DOC.getElementById('hud-mini');
  const elMiniTimer = DOC.getElementById('miniTimer');

  const elFeverFill = DOC.getElementById('feverFill');
  const elFeverText = DOC.getElementById('feverText');
  const elShield    = DOC.getElementById('shieldPills');

  const elProgFill  = DOC.getElementById('gjProgressFill');

  const bossBar     = DOC.getElementById('bossBar');
  const bossFill    = DOC.getElementById('bossFill');
  const bossHint    = DOC.getElementById('bossHint');

  const lowTimeOverlay = DOC.getElementById('lowTimeOverlay');
  const lowTimeNum     = DOC.getElementById('gj-lowtime-num');

  const endOverlay = DOC.getElementById('endOverlay');
  const endTitle   = DOC.getElementById('endTitle');
  const endSub     = DOC.getElementById('endSub');
  const endGrade   = DOC.getElementById('endGrade');
  const endScore   = DOC.getElementById('endScore');
  const endMiss    = DOC.getElementById('endMiss');
  const endTime    = DOC.getElementById('endTime');

  // -------- difficulty tuning --------
  const TUNE = {
    easy:   { spawnEvery: 900, ttl: 1600, goodP: 0.75, bossAt: 18, bossHP: 10, shieldMax: 2 },
    normal: { spawnEvery: 760, ttl: 1500, goodP: 0.70, bossAt: 22, bossHP: 12, shieldMax: 2 },
    hard:   { spawnEvery: 640, ttl: 1400, goodP: 0.66, bossAt: 26, bossHP: 14, shieldMax: 1 },
  }[diff] || { spawnEvery: 760, ttl: 1500, goodP: 0.70, bossAt: 22, bossHP: 12, shieldMax: 2 };

  // -------- state --------
  const S = {
    startedAt: performance.now(),
    ended: false,
    score: 0,
    miss: 0,
    hitsGood: 0,
    hitsJunk: 0,
    bossHits: 0,
    fever: 0,        // 0..100
    shield: TUNE.shieldMax,
    bossActive: false,
    bossHP: TUNE.bossHP,
    targets: new Map(), // id -> { el, kind, born, ttl, x, y }
    nextId: 1,
    lastSpawnAt: 0,
    lastTickAt: 0,
    lastLowTimeShown: -1,
  };

  // Expose for debug overlay (you already read window.__GJ_STATE__)
  WIN.__GJ_STATE__ = S;

  // -------- helpers --------
  function now(){ return performance.now(); }
  function setText(el, v){ if(el) el.textContent = String(v); }
  function setAriaHidden(el, hidden){
    if(!el) return;
    el.setAttribute('aria-hidden', hidden ? 'true' : 'false');
  }

  function gradeFrom(score, miss){
    const total = Math.max(1, S.hitsGood + S.hitsJunk + miss);
    const acc = Math.max(0, Math.min(1, S.hitsGood / total));
    if(acc >= 0.88 && score >= 25) return 'S';
    if(acc >= 0.78) return 'A';
    if(acc >= 0.65) return 'B';
    if(acc >= 0.52) return 'C';
    return 'D';
  }

  // FAILSAFE: get layer rect; if 0 size, retry later
  function getLayerRect(){
    const r = layer?.getBoundingClientRect?.();
    const w = r?.width || 0;
    const h = r?.height || 0;
    if(w < 80 || h < 120) return null;
    return r;
  }

  function safeXY(rect){
    // avoid edges + HUD top zone
    const pad = 26;
    const topHud = 140; // safe zone for HUD / boss bar
    const x = rect.left + pad + rng() * Math.max(1, rect.width  - pad*2);
    const y = rect.top  + topHud + rng() * Math.max(1, rect.height - topHud - pad);
    return { x, y };
  }

  function makeTarget(kind, x, y){
    const id = String(S.nextId++);
    const el = DOC.createElement('div');
    el.className = 'gj-target';
    el.setAttribute('data-id', id);
    el.setAttribute('data-kind', kind);

    // simple emoji representation (works even if CSS missing)
    if(kind === 'good') el.textContent = rng() < 0.5 ? '🍎' : '🥦';
    else if(kind === 'junk') el.textContent = rng() < 0.5 ? '🍟' : '🍩';
    else el.textContent = '👹';

    el.style.left = `${x}px`;
    el.style.top  = `${y}px`;
    el.style.opacity = '1';

    // click/touch
    const onHit = (ev)=>{
      ev.preventDefault?.();
      ev.stopPropagation?.();
      if(S.ended) return;
      hitTarget(id);
    };
    el.addEventListener('pointerdown', onHit, { passive:false });

    layer.appendChild(el);

    const ttl = (kind === 'boss') ? 999999 : TUNE.ttl;
    S.targets.set(id, { el, kind, born: now(), ttl, x, y });

    return id;
  }

  function removeTarget(id, reason){
    const t = S.targets.get(id);
    if(!t) return;

    // "miss" only if expired good/boss (junk expiry shouldn't count miss)
    if(reason === 'expire'){
      if(t.kind === 'good' || t.kind === 'boss'){
        // shield blocks miss (per your standard memory: blocked junk shouldn't count miss;
        // for GoodJunk: treat shield as blocking boss/good misses too)
        if(S.shield > 0){
          S.shield--;
        }else{
          S.miss++;
        }
      }
    }

    try{
      t.el.style.opacity = '0';
      t.el.style.transform = 'translate(-50%,-50%) scale(.85)';
      setTimeout(()=>{ try{ t.el.remove(); }catch{} }, 120);
    }catch(e){
      try{ t.el.remove(); }catch{}
    }

    S.targets.delete(id);
  }

  function setBossUI(on){
    if(!bossBar) return;
    setAriaHidden(bossBar, !on);
    if(!on){
      if(bossFill) bossFill.style.width = '0%';
      if(bossHint) bossHint.textContent = '';
      return;
    }
    if(bossHint) bossHint.textContent = 'ตีบอสให้หมด HP!';
  }

  function updateBossUI(){
    if(!S.bossActive) return;
    const pct = Math.max(0, Math.min(1, S.bossHP / TUNE.bossHP));
    if(bossFill) bossFill.style.width = `${Math.round(pct*100)}%`;
  }

  function hitTarget(id){
    const t = S.targets.get(id);
    if(!t) return;

    if(t.kind === 'good'){
      S.score += 2;
      S.hitsGood++;
      S.fever = Math.min(100, S.fever + 6);
    }else if(t.kind === 'junk'){
      // junk hit => miss (unless shield blocks)
      if(S.shield > 0){
        S.shield--;
      }else{
        S.miss++;
      }
      S.hitsJunk++;
      S.fever = Math.max(0, S.fever - 6);
    }else if(t.kind === 'boss'){
      S.score += 3;
      S.bossHits++;
      S.bossHP = Math.max(0, S.bossHP - 1);
      updateBossUI();
      if(S.bossHP <= 0){
        // boss defeated: reward shield + fever
        S.bossActive = false;
        setBossUI(false);
        S.shield = Math.min(TUNE.shieldMax, S.shield + 1);
        S.fever = Math.min(100, S.fever + 18);

        // remove boss target(s)
        removeTarget(id, 'hit');
        // clear any remaining boss targets
        for(const [tid, tt] of S.targets){
          if(tt.kind === 'boss') removeTarget(tid, 'hit');
        }
        return;
      }
    }

    // remove on hit
    removeTarget(id, 'hit');
  }

  function maybeSpawnBoss(){
    if(S.bossActive) return;
    if(S.hitsGood < TUNE.bossAt) return;

    const rect = getLayerRect();
    if(!rect) return;

    S.bossActive = true;
    S.bossHP = TUNE.bossHP;
    setBossUI(true);
    updateBossUI();

    const p = safeXY(rect);
    makeTarget('boss', p.x, p.y);
  }

  function spawnOne(){
    const rect = getLayerRect();
    if(!rect) return false;

    // boss check
    maybeSpawnBoss();

    // spawn good/junk if boss is active too (keeps pressure)
    const kind = (rng() < TUNE.goodP) ? 'good' : 'junk';
    const p = safeXY(rect);
    makeTarget(kind, p.x, p.y);
    return true;
  }

  function updateExpire(ts){
    for(const [id, t] of S.targets){
      if(t.kind === 'boss') continue;
      if(ts - t.born > t.ttl){
        removeTarget(id, 'expire');
      }
    }
  }

  function updateHUD(remSec){
    setText(elScore, S.score);
    setText(elMiss, S.miss);
    setText(elTime, Math.max(0, Math.ceil(remSec)));

    const g = gradeFrom(S.score, S.miss);
    setText(elGrade, g);

    // fever
    if(elFeverFill) elFeverFill.style.width = `${Math.round(S.fever)}%`;
    setText(elFeverText, `${Math.round(S.fever)}%`);

    // shield pills
    setText(elShield, S.shield > 0 ? '🛡️'.repeat(S.shield) : '—');

    // progress
    if(elProgFill){
      const pct = 1 - (remSec / timeLimitSec);
      elProgFill.style.width = `${Math.round(Math.max(0, Math.min(1, pct))*100)}%`;
    }

    // low time overlay (5..1)
    const t = Math.ceil(remSec);
    if(t <= 5 && t >= 1){
      if(S.lastLowTimeShown !== t){
        S.lastLowTimeShown = t;
        setText(lowTimeNum, t);
      }
      setAriaHidden(lowTimeOverlay, false);
    }else{
      setAriaHidden(lowTimeOverlay, true);
    }

    // goal/mini (lightweight placeholders — you can wire to QuestDirector later)
    setText(elGoal, 'HIT GOOD');
    setText(elGoalCur, S.hitsGood);
    setText(elGoalTgt, TUNE.bossAt);
    setText(elGoalDesc, 'ตีของดีให้ถึงเพื่อปลุกบอส');
    setText(elMini, S.bossActive ? 'BOSS!' : '—');
    setText(elMiniTimer, S.bossActive ? `HP ${S.bossHP}/${TUNE.bossHP}` : '—');
  }

  function summaryObject(totalSecPlayed){
    const g = gradeFrom(S.score, S.miss);
    const totalHits = S.hitsGood + S.hitsJunk;
    const acc = (totalHits + S.miss) > 0 ? (S.hitsGood / (totalHits + S.miss)) : 0;

    return {
      game: 'goodjunk',
      seed: seed0,
      run, diff, view,
      pid: pid || null,
      timeLimitSec,
      playedSec: Math.round(totalSecPlayed),
      score: S.score,
      miss: S.miss,
      hitsGood: S.hitsGood,
      hitsJunk: S.hitsJunk,
      bossHits: S.bossHits,
      bossDefeated: !S.bossActive && (S.bossHits > 0) && (S.bossHP <= 0),
      feverEnd: Math.round(S.fever),
      shieldEnd: S.shield,
      grade: g,
      acc: Number(acc.toFixed(3)),
      tsEnd: Date.now()
    };
  }

  function showEnd(summary){
    if(endOverlay){
      setAriaHidden(endOverlay, false);
    }
    setText(endTitle, 'Completed ✅');
    setText(endSub, `seed=${seed0} • diff=${diff} • run=${run} • view=${view}` + (pid?` • pid=${pid}`:''));
    setText(endGrade, summary.grade);
    setText(endScore, summary.score);
    setText(endMiss, summary.miss);
    setText(endTime, summary.playedSec);

    // IMPORTANT: send event so goodjunk-vr.html can cache lastSummary
    try{
      WIN.dispatchEvent(new CustomEvent('hha:game-ended', { detail: summary }));
    }catch(e){}
  }

  function endGame(){
    if(S.ended) return;
    S.ended = true;

    // clear remaining targets
    for(const [id] of S.targets) removeTarget(id, 'end');

    const playedSec = (now() - S.startedAt) / 1000;
    const sum = summaryObject(playedSec);

    showEnd(sum);
  }

  // -------- main loop --------
  function tick(ts){
    if(S.ended) return;

    const elapsed = (ts - S.startedAt) / 1000;
    const rem = Math.max(0, timeLimitSec - elapsed);

    // spawn scheduling (with failsafe: if rect not ready, keep trying)
    if(!S.lastSpawnAt) S.lastSpawnAt = ts;
    if(ts - S.lastSpawnAt >= TUNE.spawnEvery){
      const ok = spawnOne();
      if(ok) S.lastSpawnAt = ts;
      else S.lastSpawnAt = ts - (TUNE.spawnEvery * 0.6); // accelerate retry if layout not ready
    }

    updateExpire(ts);
    updateHUD(rem);

    if(rem <= 0){
      endGame();
      return;
    }

    requestAnimationFrame(tick);
  }

  // -------- init / safety --------
  function ensureLayerReady(maxTry=60){
    let n=0;
    const iv = setInterval(()=>{
      n++;
      const r = getLayerRect();
      if(r){
        clearInterval(iv);
        requestAnimationFrame(tick);
        return;
      }
      if(n >= maxTry){
        // still start; spawner will retry, HUD still runs
        clearInterval(iv);
        requestAnimationFrame(tick);
      }
    }, 60);
  }

  // Allow VR-ui crosshair shoot integration (hha:shoot)
  // If vr-ui.js dispatches "hha:shoot" with {x,y} we can ray-pick nearest target center.
  WIN.addEventListener('hha:shoot', (ev)=>{
    if(S.ended) return;
    const d = ev?.detail || {};
    const x = Number(d.x), y = Number(d.y);
    if(!Number.isFinite(x) || !Number.isFinite(y)) return;

    let bestId = null;
    let bestDist = Infinity;

    for(const [id, t] of S.targets){
      const dx = (t.x - x), dy = (t.y - y);
      const dist = dx*dx + dy*dy;
      if(dist < bestDist){
        bestDist = dist;
        bestId = id;
      }
    }
    // small threshold so it feels fair
    if(bestId && bestDist < (70*70)){
      hitTarget(bestId);
    }
  });

  // If tab hidden, end safely (prevents stuck sessions)
  DOC.addEventListener('visibilitychange', ()=>{
    if(DOC.hidden && !S.ended) endGame();
  });

  // Start
  setAriaHidden(endOverlay, true);
  setAriaHidden(lowTimeOverlay, true);
  setBossUI(false);
  updateHUD(timeLimitSec);

  // If view=cvr, mirror layer right eye if you use it later
  if(view === 'cvr'){
    if(layerR) layerR.style.display = 'block';
  }

  ensureLayerReady();
}