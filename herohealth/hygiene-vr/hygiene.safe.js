// === /herohealth/hygiene-vr/hygiene.safe.js ===
// HygieneVR Engine — PRODUCTION-lite (DOM)
// ✅ Tap / hha:shoot support (crosshair/tap-to-shoot via vr-ui.js)
// ✅ Survival: spawn good 🫧 + bad 🦠
// ✅ Score/Combo/Miss + Goal/Mini basic
// ✅ Challenge HUD real-time updates (miss/combo/goal/mini/grade)
// ✅ HHA events: hha:start / hha:time / hha:score / hha:end
// ✅ Save: HHA_LAST_SUMMARY + push HHA_SUMMARY_HISTORY (top-first)

export function createHygieneGame(opts){
  'use strict';

  const DOC = document;
  const WIN = window;

  const stage = opts.stage;
  const targetsEl = opts.targetsEl;
  const ui = opts.ui || {};
  const P = opts.params || {};

  const GAME_ID = 'hygiene';
  const VERSION = '1.0.0-lite';

  const LS_LAST = 'HHA_LAST_SUMMARY';
  const LS_HIST = 'HHA_SUMMARY_HISTORY';

  const clamp = (v,a,b)=> (v<a?a:(v>b?b:v));
  const nowMs = ()=> performance.now ? performance.now() : Date.now();
  const rnd = (()=> {
    // deterministic-ish if seed provided (simple LCG)
    let s = 0;
    const raw = String(P.seed||'').trim();
    if(raw) {
      let n = 0;
      for(let i=0;i<raw.length;i++) n = (n*131 + raw.charCodeAt(i)) >>> 0;
      s = (n || 123456789) >>> 0;
    } else {
      s = (Date.now() ^ (Math.random()*1e9)) >>> 0;
    }
    return {
      f(){ s = (1664525*s + 1013904223) >>> 0; return (s / 4294967296); },
      i(a,b){ return (a + Math.floor(this.f()*(b-a+1))); }
    };
  })();

  // ---- state ----
  let running = false;
  let tStart = 0;
  let tEndAt = 0;
  let lastTick = 0;

  let score = 0;
  let combo = 0;
  let comboMax = 0;
  let misses = 0;

  let goalsCleared = 0, goalsTotal = 2;
  let miniCleared = 0,  miniTotal  = 2;

  let goodHits = 0;
  let badHits = 0;

  let spawnTimer = 0;

  const spawnRect = { x0: 60, y0: 120, x1: 0, y1: 0 }; // y1 will be set from viewport
  function computeSpawnRect(){
    const w = WIN.innerWidth, h = WIN.innerHeight;
    spawnRect.x0 = 64;
    spawnRect.y0 = 120 + 24; // leave HUD space
    spawnRect.x1 = Math.max(spawnRect.x0+80, w - 64);
    spawnRect.y1 = Math.max(spawnRect.y0+120, h - 140); // leave quest space
  }

  // ---- helpers: UI ----
  function setText(el, s){ if(el) el.textContent = String(s); }
  function fmtTime(sec){
    sec = Math.max(0, Math.floor(sec));
    const m = Math.floor(sec/60);
    const s = sec%60;
    return `${m}:${String(s).padStart(2,'0')}`;
  }

  function updateHUD(){
    const left = Math.max(0, Math.ceil((tEndAt - nowMs())/1000));
    setText(ui.kTime, fmtTime(left));
    setText(ui.kScore, score|0);
    setText(ui.kCombo, combo|0);
    setText(ui.kMiss, misses|0);
    setText(ui.bGoal, `Goal ${goalsCleared}/${goalsTotal}`);
    setText(ui.bMini, `Mini ${miniCleared}/${miniTotal}`);
    setText(ui.bMode, `Survival • ${String(P.diff||'normal')}`);

    // Challenge HUD realtime
    WIN.HHA_CHAL?.onState?.({ misses, comboMax, goalsCleared, miniCleared });
  }

  function setQuest(text, hint=''){
    setText(ui.questText, text);
    setText(ui.questHint, hint);
  }

  // ---- target DOM ----
  let nextId = 1;
  const live = new Map(); // id -> {id, kind, x,y, born, ttlMs, el}

  function makeTarget(kind){
    // kind: 'good' or 'bad'
    const id = nextId++;
    const el = DOC.createElement('div');
    el.className = `t ${kind}`;
    const emoji = kind === 'good' ? '🫧' : '🦠';
    el.innerHTML = `<div class="ring"></div><div class="emoji">${emoji}</div>`;
    el.dataset.id = String(id);
    targetsEl.appendChild(el);

    const x = rnd.i(spawnRect.x0, spawnRect.x1);
    const y = rnd.i(spawnRect.y0, spawnRect.y1);
    const s = kind === 'good' ? (0.95 + rnd.f()*0.35) : (0.95 + rnd.f()*0.40);

    el.style.setProperty('--x', x);
    el.style.setProperty('--y', y);
    el.style.setProperty('--s', s.toFixed(3));

    // TTL: harder => shorter
    const base = (kind === 'good') ? 1400 : 1600;
    const diffMul = (P.diff === 'easy') ? 1.15 : (P.diff === 'hard') ? 0.82 : 1.0;
    const ttlMs = Math.floor(base * diffMul);

    const obj = { id, kind, x, y, born: nowMs(), ttlMs, el };
    live.set(id, obj);

    // tap (pc/mobile)
    el.addEventListener('click', (e)=>{
      e.preventDefault();
      onHit(id, 'tap');
    }, { passive:false });

    return obj;
  }

  function removeTarget(id, reason=''){
    const t = live.get(id);
    if(!t) return;
    live.delete(id);
    try{ t.el.style.opacity = '0'; }catch(_){}
    try{ setTimeout(()=>t.el.remove(), 80); }catch(_){}
    if(reason === 'expire' && t.kind === 'good'){
      // missing a good target counts as miss
      misses++;
      combo = 0;
      WIN.HHA_CHAL?.onState?.({ misses, comboMax });
    }
  }

  // ---- scoring / rules ----
  function onHit(id, source=''){
    const t = live.get(id);
    if(!t || !running) return;

    if(t.kind === 'good'){
      removeTarget(id);
      goodHits++;
      combo++;
      comboMax = Math.max(comboMax, combo);

      // score: base + combo
      const add = 10 + Math.min(15, combo);
      score += add;

      // goal/mini simple logic
      // goal 1: hit 10 goods
      if(goalsCleared === 0 && goodHits >= 10){
        goalsCleared = 1;
        setQuest('🎯 Goal สำเร็จ! ต่อไป: เก็บ 🫧 ให้ครบ 20', 'ระวัง 🦠 โผล่ถี่ขึ้น!');
      }
      if(goalsCleared === 1 && goodHits >= 20){
        goalsCleared = 2;
        setQuest('🏁 Goal ครบแล้ว! ตอนนี้เน้น “อยู่รอด” และทำ Mini ให้ครบ', 'ถ้า Miss เยอะเกินไปจะกดดันมากขึ้น 😈');
      }

      // mini 1: combo 8
      if(miniCleared === 0 && comboMax >= 8){
        miniCleared = 1;
        setQuest('✅ Mini ผ่าน: Combo 8!', 'ต่อไป: หลบ 🦠 ให้ได้ 6 วินาทีติด');
      }
      // mini 2: survive 6s without bad hit (tracked by timer below)
      // (handled in tick via safeStreak)

      // events
      emit('hha:score', { score, combo, comboMax });
      updateHUD();

    }else{
      // bad hit = miss + combo break + penalty
      removeTarget(id);
      badHits++;
      misses++;
      combo = 0;
      score = Math.max(0, score - 8);

      emit('hha:score', { score, combo, comboMax });
      updateHUD();

      // coach hint
      setQuest('โดน 🦠 แล้ว! คอมโบแตก 😵', 'Tip: อย่าจิ้มมั่ว — เล็งที่ 🫧 เท่านั้น');
    }
  }

  // ---- cVR shoot support (from vr-ui.js) ----
  function onShoot(ev){
    if(!running) return;
    const d = (ev && ev.detail) ? ev.detail : {};
    const x = Number(d.x), y = Number(d.y);
    if(!isFinite(x) || !isFinite(y)) return;

    // find nearest target within lockPx
    const lockPx = Math.max(12, Number(d.lockPx||28));
    let best = null, bestDist = 1e9;

    for(const t of live.values()){
      const dx = t.x - x;
      const dy = t.y - y;
      const dist = Math.hypot(dx,dy);
      if(dist < bestDist){
        bestDist = dist;
        best = t;
      }
    }
    if(best && bestDist <= lockPx){
      onHit(best.id, 'shoot');
    }else{
      // miss shot (optional): count as light miss only on hard?
      if(P.diff === 'hard'){
        misses++;
        combo = 0;
        WIN.HHA_CHAL?.onState?.({ misses, comboMax });
        updateHUD();
      }
    }
  }

  // ---- tick loop ----
  let safeStreakMs = 0; // time since last bad hit
  let lastBadAt = 0;

  function tick(){
    if(!running) return;
    const t = nowMs();
    const dt = Math.min(60, Math.max(0, t - lastTick));
    lastTick = t;

    // end condition by time
    if(t >= tEndAt){
      endGame('timeup');
      return;
    }

    // expire targets
    for(const [id, obj] of live){
      if(t - obj.born >= obj.ttlMs){
        removeTarget(id, 'expire');
      }
    }

    // spawn cadence
    spawnTimer -= dt;
    if(spawnTimer <= 0){
      // more intensity near end
      const leftSec = (tEndAt - t)/1000;
      const intensity = leftSec < 15 ? 1.35 : leftSec < 30 ? 1.15 : 1.0;

      // base counts
      const baseGood = (P.diff === 'easy') ? 1 : (P.diff === 'hard') ? 2 : 1;
      const baseBad  = (P.diff === 'easy') ? 1 : (P.diff === 'hard') ? 2 : 1;

      const nGood = clamp(Math.round(baseGood * intensity), 1, 3);
      const nBad  = clamp(Math.round(baseBad  * (intensity*0.9)), 1, 3);

      for(let i=0;i<nGood;i++) makeTarget('good');
      for(let i=0;i<nBad;i++)  makeTarget('bad');

      // next spawn
      const baseGap = (P.diff === 'easy') ? 720 : (P.diff === 'hard') ? 520 : 620;
      spawnTimer = baseGap / intensity;
    }

    // mini 2: survive 6 seconds without bad hit
    if(lastBadAt === 0) lastBadAt = t;
    if(badHits > 0){
      // lastBadAt updated on bad hit in onHit
    }
    safeStreakMs = (badHits === 0) ? (t - tStart) : (t - lastBadAt);

    if(miniCleared < 2 && safeStreakMs >= 6000){
      miniCleared = 2;
      setQuest('✅ Mini ผ่าน: หลบ 🦠 6 วิ!', 'ตอนนี้เน้นทำคะแนน + อยู่รอดให้ครบเวลา');
      updateHUD();
    }

    // emit time (throttle 1s)
    if(t - (tick._lastEmit||0) >= 1000){
      tick._lastEmit = t;
      const left = Math.max(0, Math.ceil((tEndAt - t)/1000));
      emit('hha:time', { leftSec:left });
    }

    updateHUD();
    requestAnimationFrame(tick);
  }

  // ---- events + summary ----
  function emit(type, detail){
    try{
      const ev = new CustomEvent(type, { detail: detail || {} });
      WIN.dispatchEvent(ev);
    }catch(_){}
  }

  function gradeFromScore(){
    // simple grade heuristic
    if(score >= 320) return 'S';
    if(score >= 240) return 'A';
    if(score >= 170) return 'B';
    if(score >= 110) return 'C';
    return 'D';
  }

  function pushHistory(summary){
    try{
      const arr = JSON.parse(localStorage.getItem(LS_HIST) || '[]');
      const list = Array.isArray(arr) ? arr : [];
      list.unshift(summary);
      // keep last 50
      while(list.length > 50) list.pop();
      localStorage.setItem(LS_HIST, JSON.stringify(list));
    }catch(_){}
  }

  function saveLast(summary){
    try{ localStorage.setItem(LS_LAST, JSON.stringify(summary)); }catch(_){}
  }

  function endGame(reason=''){
    if(!running) return;
    running = false;

    // cleanup
    for(const id of Array.from(live.keys())) removeTarget(id, '');
    try{ WIN.removeEventListener('hha:shoot', onShoot); }catch(_){}
    try{ WIN.removeEventListener('pagehide', flush); }catch(_){}
    try{ DOC.removeEventListener('visibilitychange', onVis); }catch(_){}

    const durationPlayedSec = Math.max(0, Math.round((nowMs() - tStart)/1000));
    const grade = gradeFromScore();
    const sessionId = `HYG-${Date.now()}-${Math.floor(Math.random()*1e6)}`;

    const summary = {
      projectTag:'HeroHealth',
      game: GAME_ID,
      gameMode: 'hygiene',
      version: VERSION,

      sessionId,
      timestampIso: new Date().toISOString(),

      runMode: P.run || 'play',
      diff: P.diff || 'normal',
      time: P.time || 70,
      seed: String(P.seed||'') || null,
      chal: String(P.chal||'') || null,

      scoreFinal: score|0,
      comboMax: comboMax|0,
      misses: misses|0,

      goodHits,
      badHits,

      goalsCleared, goalsTotal,
      miniCleared, miniTotal,

      durationPlayedSec,
      endReason: reason || 'ended',

      // research passthrough
      studyId: P.studyId || '',
      phase: P.phase || '',
      conditionGroup: P.conditionGroup || ''
    };

    // save local
    saveLast(summary);
    pushHistory(summary);

    // update challenge HUD with grade (important!)
    WIN.HHA_CHAL?.onState?.({ grade });

    // emit end
    emit('hha:end', summary);
    emit('hha:flush', { reason:'end' });

    // show end overlay
    if(ui.ovEnd) ui.ovEnd.style.display = 'grid';
    setText(ui.endLine, `Score ${summary.scoreFinal} • ComboMax ${summary.comboMax} • Miss ${summary.misses} • Grade ${grade}`);
    if(ui.endJson) ui.endJson.textContent = JSON.stringify(summary, null, 2);

    // also update HUD one last time
    updateHUD();
  }

  function flush(){
    // placeholder: offline-safe local already; later you can send to cloud logger (?log=)
    emit('hha:flush', { reason:'flush' });
  }
  function onVis(){
    if(DOC.visibilityState === 'hidden') flush();
  }

  // hook lastBadAt
  const _onHit = onHit;
  function onHitWrap(id, src){
    const t = live.get(id);
    if(t && t.kind === 'bad'){
      lastBadAt = nowMs();
    }
    _onHit(id, src);
  }
  // swap
  onHit = onHitWrap;

  // ---- public controls ----
  function start(){
    computeSpawnRect();
    WIN.addEventListener('resize', computeSpawnRect);

    // initial quest
    setQuest('เริ่มเลย: เก็บ 🫧 ให้ครบ 10 ครั้ง!', 'Tip: เล็งดี ๆ แล้วค่อยยิง/แตะ');

    score = 0; combo = 0; comboMax = 0; misses = 0;
    goalsCleared = 0; miniCleared = 0;
    goodHits = 0; badHits = 0;
    spawnTimer = 200;

    running = true;
    tStart = nowMs();
    tEndAt = tStart + Math.max(10, Number(P.time||70))*1000;
    lastTick = tStart;
    lastBadAt = tStart;

    // listen shoot
    WIN.addEventListener('hha:shoot', onShoot);

    // flush hardening
    WIN.addEventListener('pagehide', flush);
    DOC.addEventListener('visibilitychange', onVis);

    // emit start
    emit('hha:start', {
      game:GAME_ID,
      diff:P.diff,
      run:P.run,
      time:P.time,
      seed:P.seed || null,
      chal:P.chal || null
    });

    // initial HUD & challenge sync
    updateHUD();

    requestAnimationFrame(tick);
  }

  function stop(reason='stop'){
    endGame(reason);
  }

  return { start, stop };
}