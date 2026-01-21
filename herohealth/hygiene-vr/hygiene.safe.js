// === /herohealth/hygiene-vr/hygiene.safe.js ===
// HygieneVR Engine — PRODUCTION-lite (DOM) + Boss + Power-ups
// ✅ Tap / hha:shoot support (crosshair/tap-to-shoot via vr-ui.js)
// ✅ Survival: spawn good 🫧 + bad 🦠 + powerups 🛡️🧲⏳
// ✅ Boss last 10s: ☣️ Germ Boss (clean by hitting 🫧 quickly)
// ✅ Score/Combo/Miss + Goal/Mini basic
// ✅ Challenge HUD realtime updates (miss/combo/goal/mini/grade)
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
  const VERSION = '1.1.0-boss-powerups';

  const LS_LAST = 'HHA_LAST_SUMMARY';
  const LS_HIST = 'HHA_SUMMARY_HISTORY';

  const clamp = (v,a,b)=> (v<a?a:(v>b?b:v));
  const nowMs = ()=> performance.now ? performance.now() : Date.now();
  const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; } catch { return d; } };

  // --- RNG deterministic-ish if seed exists ---
  const rnd = (()=> {
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

  // --- Power-ups ---
  let shield = 0;                 // charges
  let magnetUntil = 0;            // ms
  let slowUntil = 0;              // ms
  let slowFactor = 1.0;           // 1.0 normal, <1 slower
  let powerPickups = 0;

  // --- Boss ---
  let bossActive = false;
  let bossClears = 0;
  let bossHp = 0;
  let bossMaxHp = 12;
  let bossId = null;              // live id of boss target
  let bossCleanedByGood = 0;      // progress via good hits in boss phase

  let spawnTimer = 0;

  const spawnRect = { x0: 60, y0: 120, x1: 0, y1: 0 }; // y1 will be set from viewport
  function computeSpawnRect(){
    const w = WIN.innerWidth, h = WIN.innerHeight;
    spawnRect.x0 = 64;
    spawnRect.y0 = 130 + 28; // leave HUD space
    spawnRect.x1 = Math.max(spawnRect.x0+80, w - 64);
    spawnRect.y1 = Math.max(spawnRect.y0+120, h - 150); // leave quest space
  }

  // ---- helpers: UI ----
  function setText(el, s){ if(el) el.textContent = String(s); }
  function fmtTime(sec){
    sec = Math.max(0, Math.floor(sec));
    const m = Math.floor(sec/60);
    const s = sec%60;
    return `${m}:${String(s).padStart(2,'0')}`;
  }

  function powerText(){
    const now = nowMs();
    const mag = Math.max(0, Math.ceil((magnetUntil - now)/1000));
    const slo = Math.max(0, Math.ceil((slowUntil - now)/1000));
    const parts = [];
    if(shield>0) parts.push(`🛡️${shield}`);
    if(mag>0) parts.push(`🧲${mag}s`);
    if(slo>0) parts.push(`⏳${slo}s`);
    return parts.length ? ('Power: ' + parts.join(' • ')) : 'Power: —';
  }

  function updateHUD(){
    const left = Math.max(0, Math.ceil((tEndAt - nowMs())/1000));
    setText(ui.kTime, fmtTime(left));
    setText(ui.kScore, score|0);
    setText(ui.kCombo, combo|0);
    setText(ui.kMiss, misses|0);

    // badges
    const bossLine = bossActive ? ` • BOSS ${bossHp}/${bossMaxHp}` : '';
    setText(ui.bGoal, `Goal ${goalsCleared}/${goalsTotal}${bossLine}`);
    setText(ui.bMini, `Mini ${miniCleared}/${miniTotal}`);
    setText(ui.bMode, `Survival • ${String(P.diff||'normal')}`);

    // quest hint shows power state always (อ่านง่าย)
    if(ui.questHint){
      const base = ui.questHint.dataset.base || ui.questHint.textContent || '';
      ui.questHint.dataset.base = base;
      setText(ui.questHint, `${base} • ${powerText()}`);
    }

    // Challenge HUD realtime
    WIN.HHA_CHAL?.onState?.({ misses, comboMax, goalsCleared, miniCleared });
  }

  function setQuest(text, hint=''){
    setText(ui.questText, text);
    setText(ui.questHint, hint);
    if(ui.questHint) ui.questHint.dataset.base = hint;
  }

  // ---- target DOM ----
  let nextId = 1;

  // kind: 'good'|'bad'|'power'|'boss'
  // subtype for power: 'shield'|'magnet'|'slow'
  const live = new Map(); // id -> {id, kind, subtype, x,y, born, ttlMs, el}

  function makeTarget(kind, subtype=null, fixedXY=null){
    const id = nextId++;
    const el = DOC.createElement('div');

    // CSS classes: re-use good/bad for styling
    let cls = 't';
    if(kind === 'good') cls += ' good';
    else cls += ' bad';

    el.className = cls;

    // emoji by type
    let emoji = '🫧';
    if(kind === 'bad') emoji = '🦠';
    if(kind === 'boss') emoji = '☣️';
    if(kind === 'power'){
      emoji = (subtype === 'shield') ? '🛡️' : (subtype === 'magnet') ? '🧲' : '⏳';
    }

    el.innerHTML = `<div class="ring"></div><div class="emoji">${emoji}</div>`;
    el.dataset.id = String(id);
    targetsEl.appendChild(el);

    let x, y;
    if(fixedXY){
      x = fixedXY.x;
      y = fixedXY.y;
    }else{
      x = rnd.i(spawnRect.x0, spawnRect.x1);
      y = rnd.i(spawnRect.y0, spawnRect.y1);
    }

    // size
    let s = 1.0;
    if(kind === 'good') s = 0.95 + rnd.f()*0.35;
    if(kind === 'bad')  s = 0.95 + rnd.f()*0.40;
    if(kind === 'power') s = 0.92 + rnd.f()*0.25;
    if(kind === 'boss') s = 1.55;

    el.style.setProperty('--x', x);
    el.style.setProperty('--y', y);
    el.style.setProperty('--s', s.toFixed(3));

    // TTL: powerups stay slightly longer; boss stays until phase end
    let ttlMs = 1400;
    if(kind === 'good') ttlMs = 1400;
    if(kind === 'bad') ttlMs  = 1600;
    if(kind === 'power') ttlMs = 2200;
    if(kind === 'boss') ttlMs  = 999999;

    // difficulty & slowmo affects TTL
    const diffMul = (P.diff === 'easy') ? 1.18 : (P.diff === 'hard') ? 0.85 : 1.0;
    ttlMs = Math.floor(ttlMs * diffMul);

    if(nowMs() < slowUntil){
      ttlMs += 450; // slowmo gives more time
    }

    const obj = { id, kind, subtype, x, y, born: nowMs(), ttlMs, el };
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

    // boss removal special
    if(t.kind === 'boss'){
      bossId = null;
    }

    live.delete(id);
    try{ t.el.style.opacity = '0'; }catch(_){}
    try{ setTimeout(()=>t.el.remove(), 80); }catch(_){}

    // expire rules
    if(reason === 'expire'){
      if(t.kind === 'good'){
        if(shield > 0){
          shield--;
          setQuest('🛡️ กันพลาดไว้ให้แล้ว!', 'Shield ลดลง 1');
        }else{
          misses++;
          combo = 0;
        }
        WIN.HHA_CHAL?.onState?.({ misses, comboMax });
      }
      // power/bad expire => no penalty
    }
  }

  // ---- scoring / rules ----
  function applyPower(subtype){
    powerPickups++;
    if(subtype === 'shield'){
      shield = Math.min(3, shield + 1);
      setQuest('🛡️ ได้ Shield!', 'กัน Miss/กันโดน 🦠 ได้ 1 ครั้ง');
    }
    if(subtype === 'magnet'){
      magnetUntil = nowMs() + 9000; // 9s
      setQuest('🧲 Magnet ON!', '🫧 ใกล้กลางจอจะถูกดูดเก็บเอง');
    }
    if(subtype === 'slow'){
      slowUntil = nowMs() + 7000; // 7s
      setQuest('⏳ Slow-mo!', 'เป้าจะอยู่ได้นานขึ้น + spawn ช้าลงชั่วคราว');
    }
    updateHUD();
  }

  function bossStart(){
    if(bossActive) return;
    bossActive = true;
    bossHp = bossMaxHp;
    bossCleanedByGood = 0;

    // spawn boss at center
    const cx = Math.round(WIN.innerWidth/2);
    const cy = Math.round(WIN.innerHeight/2);
    const b = makeTarget('boss', null, {x:cx, y:cy});
    bossId = b.id;

    setQuest('👾 BOSS มาแล้ว! ล้างให้ทัน!', 'ช่วง 10 วิท้าย: เก็บ 🫧 เพื่อ “ล้าง” Boss ให้ HP หมด');
    updateHUD();
  }

  function bossHitProgress(){
    if(!bossActive) return;
    bossHp = Math.max(0, bossHp - 1);
    bossCleanedByGood++;
    if(bossHp <= 0){
      bossClears++;
      score += 180; // big bonus
      combo += 3;   // reward streak
      comboMax = Math.max(comboMax, combo);

      setQuest('🏆 ล้าง Boss สำเร็จ!', 'โบนัส +180! อยู่รอดต่อจนจบเวลา');
      // remove boss target
      if(bossId != null) removeTarget(bossId, '');
      bossActive = false;

      // treat as extra mini success (feel good)
      if(miniCleared < miniTotal){
        miniCleared = Math.min(miniTotal, miniCleared + 1);
      }
      updateHUD();
    }
  }

  function onBadHitPenalty(reason=''){
    // shield can block bad hit penalty
    if(shield > 0){
      shield--;
      setQuest('🛡️ กันโดน 🦠 แล้ว!', `Shield เหลือ ${shield}`);
      updateHUD();
      return true; // blocked
    }
    badHits++;
    misses++;
    combo = 0;
    score = Math.max(0, score - 10);
    setQuest('โดน 🦠 แล้ว! คอมโบแตก 😵', 'Tip: เล็งที่ 🫧 เท่านั้น');
    updateHUD();
    return false;
  }

  function onHit(id, source=''){
    const t = live.get(id);
    if(!t || !running) return;

    // POWERUP
    if(t.kind === 'power'){
      removeTarget(id);
      applyPower(t.subtype);
      emit('hha:score', { score, combo, comboMax });
      return;
    }

    // BOSS (hitting boss directly is bad)
    if(t.kind === 'boss'){
      removeTarget(id); // keep boss removable? -> better: keep it and penalize
      // restore boss (so it stays)
      bossStart();
      onBadHitPenalty('hit-boss');
      emit('hha:score', { score, combo, comboMax });
      return;
    }

    if(t.kind === 'good'){
      removeTarget(id);
      goodHits++;
      combo++;
      comboMax = Math.max(comboMax, combo);

      // score: base + combo
      const add = 10 + Math.min(18, combo);
      score += add;

      // boss progress: clean boss by good hits (makes sense + fun)
      if(bossActive) bossHitProgress();

      // goal/mini simple logic
      if(goalsCleared === 0 && goodHits >= 10){
        goalsCleared = 1;
        setQuest('🎯 Goal สำเร็จ! ต่อไป: เก็บ 🫧 ให้ครบ 20', 'ระวัง 🦠 โผล่ถี่ขึ้น!');
      }
      if(goalsCleared === 1 && goodHits >= 20){
        goalsCleared = 2;
        setQuest('🏁 Goal ครบแล้ว! ตอนนี้เน้น “อยู่รอด” + ทำ Mini', 'ช่วงท้ายจะมี Boss โผล่! เตรียมตัว 😈');
      }

      // mini 1: combo 8
      if(miniCleared === 0 && comboMax >= 8){
        miniCleared = 1;
        setQuest('✅ Mini ผ่าน: Combo 8!', 'ต่อไป: หลบ 🦠 ให้ได้ 6 วินาทีติด');
      }

      emit('hha:score', { score, combo, comboMax });
      updateHUD();
      return;
    }

    // BAD
    if(t.kind === 'bad'){
      removeTarget(id);
      onBadHitPenalty('hit-bad');
      emit('hha:score', { score, combo, comboMax });
      return;
    }
  }

  // ---- cVR shoot support (from vr-ui.js) ----
  // note: for boss/powerups, nearest target selection still works
  function onShoot(ev){
    if(!running) return;
    const d = (ev && ev.detail) ? ev.detail : {};
    const x = Number(d.x), y = Number(d.y);
    if(!isFinite(x) || !isFinite(y)) return;

    // lockPx base; magnet makes it feel easier too
    let lockPx = Math.max(12, Number(d.lockPx||28));
    if(nowMs() < magnetUntil) lockPx += 18;

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
      // optional miss shot penalty only on hard
      if(P.diff === 'hard'){
        if(shield > 0){
          shield--;
          setQuest('🛡️ กันพลาดยิงแล้ว!', `Shield เหลือ ${shield}`);
        }else{
          misses++;
          combo = 0;
        }
        WIN.HHA_CHAL?.onState?.({ misses, comboMax });
        updateHUD();
      }
    }
  }

  // ---- tick loop ----
  let safeStreakMs = 0;
  let lastBadAt = 0;

  function magnetAutoCollect(){
    if(nowMs() >= magnetUntil) return;

    // collect any GOOD target close to center (kid-friendly magic)
    const cx = WIN.innerWidth/2;
    const cy = WIN.innerHeight/2;
    const R = 140; // radius
    for(const t of live.values()){
      if(t.kind !== 'good') continue;
      const dist = Math.hypot(t.x - cx, t.y - cy);
      if(dist <= R){
        onHit(t.id, 'magnet');
        break; // 1 per frame prevents too OP
      }
    }
  }

  function tick(){
    if(!running) return;
    const t = nowMs();

    // slow factor active?
    const slowOn = t < slowUntil;
    slowFactor = slowOn ? 0.62 : 1.0;

    // end condition by time
    if(t >= tEndAt){
      endGame('timeup');
      return;
    }

    // boss trigger (last 10 seconds)
    const leftSec = (tEndAt - t)/1000;
    if(leftSec <= 10 && !bossActive){
      bossStart();
    }

    // dt with slow factor affects spawn cadence only (so it "feels" slow)
    const dtRaw = Math.min(60, Math.max(0, t - lastTick));
    const dt = dtRaw * slowFactor;
    lastTick = t;

    // expire targets
    for(const [id, obj] of live){
      if(obj.kind === 'boss') continue; // boss doesn't expire
      if(t - obj.born >= obj.ttlMs){
        removeTarget(id, 'expire');
      }
    }

    // magnet effect
    magnetAutoCollect();

    // spawn cadence
    spawnTimer -= dt;
    if(spawnTimer <= 0){
      const intensity = leftSec < 15 ? 1.35 : leftSec < 30 ? 1.15 : 1.0;

      const baseGood = (P.diff === 'easy') ? 1 : (P.diff === 'hard') ? 2 : 1;
      const baseBad  = (P.diff === 'easy') ? 1 : (P.diff === 'hard') ? 2 : 1;

      // during boss phase: slightly more 🫧 for cleaning, less 🦠 so it feels fair
      const bossMulGood = bossActive ? 1.25 : 1.0;
      const bossMulBad  = bossActive ? 0.85 : 1.0;

      const nGood = clamp(Math.round(baseGood * intensity * bossMulGood), 1, 3);
      const nBad  = clamp(Math.round(baseBad  * (intensity*0.9) * bossMulBad), 1, 3);

      for(let i=0;i<nGood;i++) makeTarget('good');
      for(let i=0;i<nBad;i++)  makeTarget('bad');

      // powerup chance (kid-friendly but not too frequent)
      const p = rnd.f();
      const powerChance = bossActive ? 0.14 : 0.10; // slightly higher during boss
      if(p < powerChance){
        const pick = rnd.f();
        const subtype =
          (pick < 0.34) ? 'shield' :
          (pick < 0.68) ? 'magnet' : 'slow';
        makeTarget('power', subtype);
      }

      // next spawn gap (slowmo increases gap naturally via dt scaling)
      const baseGap = (P.diff === 'easy') ? 720 : (P.diff === 'hard') ? 520 : 620;
      spawnTimer = (baseGap / intensity);
      if(bossActive) spawnTimer *= 0.92; // boss feels intense
    }

    // mini 2: survive 6 seconds without bad hit
    if(lastBadAt === 0) lastBadAt = t;
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
    // slightly tuned for new bonuses
    if(score >= 420) return 'S';
    if(score >= 300) return 'A';
    if(score >= 210) return 'B';
    if(score >= 140) return 'C';
    return 'D';
  }

  function pushHistory(summary){
    try{
      const arr = JSON.parse(localStorage.getItem(LS_HIST) || '[]');
      const list = Array.isArray(arr) ? arr : [];
      list.unshift(summary);
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

      // boss/powerups
      bossClears,
      bossMaxHp,
      bossCleanedByGood,
      powerPickups,
      shieldLeft: shield,

      durationPlayedSec,
      endReason: reason || 'ended',

      // research passthrough
      studyId: P.studyId || '',
      phase: P.phase || '',
      conditionGroup: P.conditionGroup || ''
    };

    saveLast(summary);
    pushHistory(summary);

    // update challenge HUD with grade
    WIN.HHA_CHAL?.onState?.({ grade });

    emit('hha:end', summary);
    emit('hha:flush', { reason:'end' });

    if(ui.ovEnd) ui.ovEnd.style.display = 'grid';
    setText(ui.endLine, `Score ${summary.scoreFinal} • ComboMax ${summary.comboMax} • Miss ${summary.misses} • BossClear ${bossClears} • Grade ${grade}`);
    if(ui.endJson) ui.endJson.textContent = JSON.stringify(summary, null, 2);

    updateHUD();
  }

  function flush(){
    emit('hha:flush', { reason:'flush' });
  }
  function onVis(){
    if(DOC.visibilityState === 'hidden') flush();
  }

  // hook lastBadAt when bad hit happens (tap/shoot)
  const _onHit = onHit;
  function onHitWrap(id, src){
    const t = live.get(id);
    if(t && (t.kind === 'bad' || t.kind === 'boss')){
      lastBadAt = nowMs();
    }
    _onHit(id, src);
  }
  onHit = onHitWrap;

  // ---- public controls ----
  function start(){
    computeSpawnRect();
    WIN.addEventListener('resize', computeSpawnRect);

    setQuest('เริ่มเลย: เก็บ 🫧 ให้ครบ 10 ครั้ง!', 'Tip: เล็งดี ๆ แล้วค่อยยิง/แตะ');

    score = 0; combo = 0; comboMax = 0; misses = 0;
    goalsCleared = 0; miniCleared = 0;
    goodHits = 0; badHits = 0;

    shield = 0; magnetUntil = 0; slowUntil = 0; powerPickups = 0;

    bossActive = false; bossClears = 0; bossHp = 0; bossId = null; bossCleanedByGood = 0;

    spawnTimer = 200;

    running = true;
    tStart = nowMs();
    tEndAt = tStart + Math.max(10, Number(P.time||70))*1000;
    lastTick = tStart;
    lastBadAt = tStart;

    WIN.addEventListener('hha:shoot', onShoot);
    WIN.addEventListener('pagehide', flush);
    DOC.addEventListener('visibilitychange', onVis);

    emit('hha:start', {
      game:GAME_ID,
      diff:P.diff,
      run:P.run,
      time:P.time,
      seed:P.seed || null,
      chal:P.chal || null
    });

    updateHUD();
    requestAnimationFrame(tick);
  }

  function stop(reason='stop'){
    endGame(reason);
  }

  return { start, stop };
}