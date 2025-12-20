// === /herohealth/vr-goodjunk/GameEngine.js ===
// GoodJunkVR — Engine (ESM, PRODUCTION CLEAN)
// ✅ exports: start(ctx), GameEngine{start,stop}, default
// ✅ DOM emoji targets on layerEl (#gj-layer)
// ✅ emits: hha:time, hha:score, hha:judge, hha:end
// ✅ emits: quest:miniStart, quest:goodHit, quest:badHit, quest:block, quest:power, quest:bossClear

'use strict';

function clamp(v, min, max){ v = Number(v)||0; return v<min?min:(v>max?max:v); }
function now(){ return performance.now(); }
function pick(arr){ return arr[(Math.random()*arr.length)|0]; }

function dispatch(name, detail){
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

function rectsOverlap(a,b){
  return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
}

// safe zone: avoid HUD + coach + edges
function buildAvoidRects(){
  const rects = [];
  const pad = 10;

  const hudCards = document.querySelectorAll('.hud-card');
  hudCards.forEach(el=>{
    const r = el.getBoundingClientRect();
    rects.push({ left:r.left-pad, top:r.top-pad, right:r.right+pad, bottom:r.bottom+pad });
  });

  const coach = document.querySelector('#coach-bubble');
  if (coach){
    const r = coach.getBoundingClientRect();
    rects.push({ left:r.left-pad, top:r.top-pad, right:r.right+pad, bottom:r.bottom+pad });
  }

  // edges (กันชิดขอบ)
  const w = window.innerWidth;
  const h = window.innerHeight;
  rects.push({ left:-9999, top:-9999, right:12, bottom:h+9999 });      // left strip
  rects.push({ left:w-12, top:-9999, right:w+9999, bottom:h+9999 });   // right strip
  rects.push({ left:-9999, top:-9999, right:w+9999, bottom:12 });      // top strip
  rects.push({ left:-9999, top:h-12, right:w+9999, bottom:h+9999 });   // bottom strip

  return rects;
}

function scoreGrade({ score, misses }){
  const s = Number(score)||0;
  const m = Number(misses)||0;
  if (s >= 220 && m <= 2) return 'SSS';
  if (s >= 170 && m <= 4) return 'SS';
  if (s >= 120 && m <= 6) return 'S';
  if (s >= 80  && m <= 8) return 'A';
  if (s >= 40) return 'B';
  return 'C';
}

export function createEngine(opts = {}) {
  const diff = String(opts.diff||'normal').toLowerCase();
  const run  = String(opts.run||'play').toLowerCase();
  const challenge = String(opts.challenge||'rush').toLowerCase();

  // ✅ รองรับทั้ง time (จาก safe) และ durationSec
  const durationSec = clamp(opts.time ?? opts.durationSec ?? 60, 20, 180);

  const layerEl = opts.layerEl || document.getElementById('gj-layer');

  // FX modules (IIFE): particles.js / ui-fever.js
  const Particles =
    (window.GAME_MODULES && window.GAME_MODULES.Particles) ||
    window.Particles || null;

  const FeverUI =
    (window.GAME_MODULES && window.GAME_MODULES.FeverUI) ||
    window.FeverUI || null;

  const CFG = {
    easy:   { spawnEvery: 900,  maxActive: 4, lifetime: 2300, baseScale: 1.12, junkRatio: 0.18 },
    normal: { spawnEvery: 760,  maxActive: 5, lifetime: 2050, baseScale: 1.00, junkRatio: 0.26 },
    hard:   { spawnEvery: 640,  maxActive: 6, lifetime: 1850, baseScale: 0.92, junkRatio: 0.34 }
  }[diff] || { spawnEvery: 760, maxActive: 5, lifetime: 2050, baseScale: 1.0, junkRatio: 0.26 };

  const EMOJI = {
    good: ['🥦','🥕','🍎','🍌','🍇','🥛','🥜','🐟','🍠','🥬','🍉'],
    junk: ['🍟','🍔','🍕','🍩','🍪','🍫','🥤','🍬'],
    gold: ['⭐','🌟','✨'],
    fake: ['😈','🌀','🧟'],
    power: ['🛡️','🧲','⏱️'],
    boss: ['👹','🧌']
  };

  const CH = {
    rush:     { spawnMul: 0.92, scoreMul: 1.15 },
    boss:     { spawnMul: 1.00, scoreMul: 1.05 },
    survival: { spawnMul: 0.98, scoreMul: 1.00 }
  }[challenge] || { spawnMul: 1.0, scoreMul: 1.0 };

  const S = {
    started:false,
    timeLeft: durationSec,

    score:0,
    goodHits:0,
    perfect:0,
    misses:0,
    combo:0,
    comboMax:0,

    fever: 0,
    feverActive: false,
    feverUntil: 0,
    shield: 0,

    bossSpawned:false,
    bossHP:0
  };

  const active = new Map(); // id -> meta
  let spawnTimer = null;
  let timeTimer  = null;
  let rafId = null;

  function setJudge(text){
    dispatch('hha:judge', { label: text || '' });
  }

  function emitScore(){
    dispatch('hha:score', {
      score: S.score|0,
      goodHits: S.goodHits|0,
      perfect: S.perfect|0,
      misses: S.misses|0,
      comboMax: S.comboMax|0,
      challenge
    });
  }

  function syncFeverUI(){
    if (!FeverUI) return;
    try{
      FeverUI.ensureFeverBar?.();
      FeverUI.setFever?.(S.fever);
      FeverUI.setFeverActive?.(!!S.feverActive);
      FeverUI.setShield?.(S.shield);
    }catch(_){}
  }

  function addFever(delta){
    if (!FeverUI) {
      S.fever = clamp(S.fever + delta, 0, 100);
      return;
    }
    try{
      if (typeof FeverUI.add === 'function') FeverUI.add(delta);
      S.fever = (typeof FeverUI.getValue === 'function') ? (FeverUI.getValue()|0) : clamp(S.fever + delta, 0, 100);
      S.feverActive = (typeof FeverUI.isActive === 'function') ? !!FeverUI.isActive() : S.feverActive;
    }catch(_){
      S.fever = clamp(S.fever + delta, 0, 100);
    }
    syncFeverUI();
  }

  function startFeverWindow(ms=5500){
    S.feverActive = true;
    S.feverUntil = now() + ms;
    Particles?.celebrate?.('fever', { title:'🔥 FEVER!', sub:'คะแนนคูณ! แตะให้ไว!' });
    syncFeverUI();
  }

  function tickFever(){
    if (!S.feverActive) return;
    if (now() >= S.feverUntil){
      S.feverActive = false;
      S.fever = Math.max(0, Math.round(S.fever * 0.45));
      try{
        FeverUI?.setFeverActive?.(false);
        FeverUI?.setFever?.(S.fever);
      }catch(_){}
    }
  }

  function setShield(n){
    S.shield = clamp(n|0, 0, 9);
    FeverUI?.setShield?.(S.shield);
  }
  function incShield(){ setShield(Math.min(9, (S.shield|0) + 1)); }

  function consumeShieldBlock(){
    if (S.shield > 0){
      setShield(S.shield - 1);
      dispatch('quest:block', {});
      const cx = window.innerWidth/2;
      const cy = window.innerHeight*0.28;
      Particles?.burstAt?.(cx, cy, { label:'[BLOCK] BLOCK!', heavy:false, good:true });
      Particles?.scorePop?.(cx, cy, '', '[BLOCK] BLOCK!', { plain:true });
      setJudge('BLOCK!');
      emitScore();
      return true;
    }
    return false;
  }

  function canSpawnMore(){ return active.size < CFG.maxActive; }

  function mkTarget({ emoji, className, scaleMul=1 }){
    const el = document.createElement('div');
    el.className = 'gj-target ' + (className||'');
    el.textContent = emoji;
    el.setAttribute('data-hha-tgt','1');
    el.style.setProperty('--tScale', String(CFG.baseScale * scaleMul));

    const avoid = buildAvoidRects();
    const w = window.innerWidth;
    const h = window.innerHeight;

    const margin = 70;
    let x = w*0.5, y = h*0.55;
    for (let i=0;i<60;i++){
      x = margin + Math.random()*(w - margin*2);
      y = margin + Math.random()*(h - margin*2);

      const rect = { left:x-54, top:y-54, right:x+54, bottom:y+54 };
      let ok = true;
      for (const a of avoid){
        if (rectsOverlap(rect, a)){ ok=false; break; }
      }
      if (ok) break;
    }

    el.style.left = x + 'px';
    el.style.top  = y + 'px';
    return el;
  }

  function addToActive(el, meta){
    const id = 't' + Math.random().toString(16).slice(2);
    const spawnAt = now();
    const expireAt = spawnAt + (meta.lifetime ?? CFG.lifetime);

    active.set(id, { id, el, spawnAt, expireAt, ...meta });
    el.dataset.tid = id;

    layerEl.appendChild(el);
    el.addEventListener('click', onClickTarget, { passive:true });
    el.addEventListener('touchstart', onClickTarget, { passive:true });
    return id;
  }

  function removeTarget(id, reason){
    const t = active.get(id);
    if (!t) return;
    active.delete(id);

    try{
      t.el.classList.add('gone');
      setTimeout(()=>{ try{ t.el.remove(); }catch(_){ } }, 120);
    }catch(_){}

    // ✅ miss rule: goodExpired + junkHit (shield block NOT count)
    if (reason === 'expired' && t.type === 'good'){
      S.misses++;
      S.combo = 0;
      setJudge('MISS');
      dispatch('quest:miss', { kind:'goodExpired' });
      const cx = window.innerWidth/2;
      const cy = window.innerHeight*0.28;
      Particles?.burstAt?.(cx, cy, { label:'[GOOD] MISS', good:false, heavy:false });
      Particles?.scorePop?.(cx, cy, '', '[GOOD] MISS', { plain:true });
      emitScore();
    }
  }

  function spawnGood(){
    const el = mkTarget({ emoji: pick(EMOJI.good), className:'' });
    addToActive(el, { type:'good', lifetime: CFG.lifetime });
  }
  function spawnJunk(){
    const el = mkTarget({ emoji: pick(EMOJI.junk), className:'gj-junk', scaleMul: 1.05 });
    addToActive(el, { type:'junk', lifetime: CFG.lifetime });
  }
  function spawnGold(){
    const el = mkTarget({ emoji: pick(EMOJI.gold), className:'gj-gold', scaleMul: 1.08 });
    addToActive(el, { type:'gold', lifetime: Math.round(CFG.lifetime * 0.95) });
  }
  function spawnFake(){
    const el = mkTarget({ emoji: pick(EMOJI.fake), className:'gj-fake', scaleMul: 1.00 });
    addToActive(el, { type:'fake', lifetime: Math.round(CFG.lifetime * 0.9) });
  }
  function spawnPower(){
    const emoji = pick(EMOJI.power);
    let power = 'shield';
    if (emoji.includes('🧲')) power = 'magnet';
    else if (emoji.includes('⏱️')) power = 'time';

    const el = mkTarget({ emoji, className:'gj-power', scaleMul: 1.00 });
    addToActive(el, { type:'power', power, lifetime: Math.round(CFG.lifetime * 0.9) });
  }
  function spawnBoss(){
    S.bossSpawned = true;
    S.bossHP = 6;
    const el = mkTarget({ emoji: pick(EMOJI.boss), className:'gj-boss', scaleMul: 1.15 });
    addToActive(el, { type:'boss', lifetime: 999999 });
    setJudge('BOSS!');
    Particles?.celebrate?.('goal', { title:'👹 BOSS 등장!', sub:'ตีให้แตก!' });
  }

  function spawnOne(){
    if (!layerEl) return;
    if (!canSpawnMore()) return;

    if (challenge === 'boss' && !S.bossSpawned && S.timeLeft <= 12){
      spawnBoss();
      return;
    }

    const pRoll = Math.random();
    if (pRoll < 0.08){ spawnPower(); return; }
    if (pRoll < 0.12){ spawnFake();  return; }
    if (pRoll < 0.17){ spawnGold();  return; }

    const isJunk = Math.random() < CFG.junkRatio;
    if (isJunk) spawnJunk(); else spawnGood();
  }

  function hitFX(x,y,label,good=true,heavy=false,delta=null){
    Particles?.burstAt?.(x, y, { label, good, heavy });
    if (Particles?.scorePop){
      if (typeof delta === 'number') Particles.scorePop(x, y, delta, label);
      else Particles.scorePop(x, y, '', label, { plain:true });
    }
  }

  function onClickTarget(ev){
    const el = ev.currentTarget;
    const id = el?.dataset?.tid;
    if (!id) return;
    const t = active.get(id);
    if (!t) return;

    active.delete(id);
    try{
      el.classList.add('gone');
      setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 120);
    }catch(_){}

    const r = el.getBoundingClientRect();
    const x = r.left + r.width/2;
    const y = r.top + r.height/2;

    const dt = now() - t.spawnAt;
    const isPerfect = dt <= 520;

    // boss
    if (t.type === 'boss'){
      S.bossHP = Math.max(0, (S.bossHP|0) - 1);
      setJudge('HIT!');
      hitFX(x,y,'[BOSS] HIT!', true, true);

      dispatch('quest:goodHit', { type:'boss', judgment:'HIT' });

      S.score += Math.round(10 * CH.scoreMul * (S.feverActive ? 1.55 : 1.0));
      emitScore();

      if (S.bossHP <= 0){
        setJudge('BOSS CLEAR!');
        dispatch('quest:bossClear', {});
        Particles?.celebrate?.('ultra', { title:'👹 BOSS CLEAR!!', sub:'สุดยอด! โบนัสกระหน่ำ!', ultra:true });
      }
      return;
    }

    // power
    if (t.type === 'power'){
      if (t.power === 'shield'){
        incShield();
        setJudge('SHIELD!');
        hitFX(x,y,'[POWER] SHIELD+', true, true);
        dispatch('quest:power', { power:'shield' });
      } else if (t.power === 'magnet'){
        setJudge('MAGNET!');
        hitFX(x,y,'[POWER] MAGNET!', true, true);
        dispatch('quest:power', { power:'magnet' });
        spawnGood(); spawnGood();
      } else if (t.power === 'time'){
        S.timeLeft += 3;
        setJudge('+TIME!');
        hitFX(x,y,'[POWER] +TIME', true, true);
        dispatch('quest:power', { power:'time' });
      }
      emitScore();
      return;
    }

    // fake acts like junk
    if (t.type === 'fake'){
      if (consumeShieldBlock()){
        hitFX(x,y,'[BLOCK] BLOCK!', true, false);
        return;
      }
      S.misses++;
      S.combo = 0;
      setJudge('OOPS!');
      hitFX(x,y,'[FAKE] OOPS!', false, false);
      dispatch('quest:badHit', { type:'fake' });
      emitScore();
      return;
    }

    // junk
    if (t.type === 'junk'){
      if (consumeShieldBlock()){
        hitFX(x,y,'[BLOCK] BLOCK!', true, false);
        return;
      }
      S.misses++;
      S.combo = 0;
      setJudge('MISS');
      hitFX(x,y,'[JUNK] MISS', false, false);
      dispatch('quest:badHit', { type:'junk' });
      emitScore();
      return;
    }

    // good / gold
    if (t.type === 'good' || t.type === 'gold'){
      S.goodHits++;
      S.combo++;
      S.comboMax = Math.max(S.comboMax, S.combo);

      const feverGain = (t.type === 'gold') ? 14 : (isPerfect ? 10 : 8);
      addFever(feverGain);

      if (!S.feverActive){
        const isActive = FeverUI?.isActive ? !!FeverUI.isActive() : (S.fever >= 100);
        if (isActive) startFeverWindow(5500);
      }

      let add = (t.type === 'gold') ? 12 : 8;
      if (isPerfect){ add += 4; S.perfect++; setJudge('PERFECT!'); }
      else setJudge('GOOD!');

      const feverMul = S.feverActive ? 1.55 : 1.0;
      add = Math.round(add * CH.scoreMul * feverMul);

      S.score += add;

      const label = (t.type === 'gold')
        ? (isPerfect ? '[GOLD] PERFECT!' : '[GOLD] GOLD!')
        : (isPerfect ? '[GOOD] PERFECT!' : '[GOOD] GOOD!');

      hitFX(x,y,label,true, isPerfect || t.type === 'gold', add);
      dispatch('quest:goodHit', { type: t.type, judgment: isPerfect ? 'PERFECT' : 'GOOD' });
      emitScore();
      return;
    }
  }

  function tickExpire(){
    const t = now();
    for (const [id, obj] of active){
      if (obj.expireAt <= t) removeTarget(id, 'expired');
    }
  }

  function startTimers(){
    const spawnEvery = Math.max(280, Math.round(CFG.spawnEvery * CH.spawnMul));
    spawnTimer = setInterval(()=>{
      if (!S.started) return;
      if (!canSpawnMore()) return;
      spawnOne();
    }, spawnEvery);

    dispatch('hha:time', { sec: S.timeLeft|0 });
    timeTimer = setInterval(()=>{
      if (!S.started) return;

      S.timeLeft = Math.max(0, (S.timeLeft|0) - 1);
      dispatch('hha:time', { sec: S.timeLeft|0 });

      if (challenge === 'survival' && S.misses >= 12){
        S.timeLeft = 0;
      }
      if (S.timeLeft <= 0) end();
    }, 1000);

    const loop = ()=>{
      if (!S.started) return;
      tickExpire();
      tickFever();
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
  }

  function stopTimers(){
    if (spawnTimer) { clearInterval(spawnTimer); spawnTimer=null; }
    if (timeTimer)  { clearInterval(timeTimer); timeTimer=null; }
    if (rafId)      { cancelAnimationFrame(rafId); rafId=null; }
  }

  function clearAllTargets(){
    for (const [id] of active){
      removeTarget(id, 'clear');
    }
    active.clear();
  }

  function end(){
    if (!S.started) return;
    S.started = false;
    stopTimers();
    clearAllTargets();

    const grade = scoreGrade({ score:S.score, misses:S.misses });

    Particles?.celebrate?.('end', { title:'🏁 FINISH!', sub:'สรุปผล + รางวัล' });

    dispatch('hha:end', {
      mode: 'GoodJunkVR',
      runMode: run,
      diff,
      challenge,
      durationSec,
      scoreFinal: S.score|0,
      good: S.goodHits|0,
      perfect: S.perfect|0,
      misses: S.misses|0,
      comboMax: S.comboMax|0,
      grade
    });
  }

  function start(){
    if (S.started) return;
    if (!layerEl){
      console.warn('[GoodJunkVR] layerEl missing');
      return;
    }

    S.started = true;

    syncFeverUI();

    dispatch('quest:miniStart', {});
    emitScore();

    // initial spawns
    for (let i=0;i<Math.min(3, CFG.maxActive); i++) spawnOne();

    startTimers();

    // start FX
    const cx = window.innerWidth/2;
    const cy = window.innerHeight*0.30;
    Particles?.burstAt?.(cx, cy, { label:'[GOOD] START!', good:true, heavy:false });
    Particles?.scorePop?.(cx, cy, '', '[GOOD] START!', { plain:true });
  }

  return {
    start,
    end,
    getState(){
      return {
        score:S.score|0,
        goodHits:S.goodHits|0,
        perfect:S.perfect|0,
        misses:S.misses|0,
        comboMax:S.comboMax|0,
        timeLeft:S.timeLeft|0,
        fever:S.fever|0,
        feverActive: !!S.feverActive,
        shield:S.shield|0
      };
    }
  };
}

let __ENGINE__ = null;

export function start(ctx = {}) {
  __ENGINE__ = createEngine(ctx);
  __ENGINE__.start();
  return __ENGINE__;
}

export function stop() {
  try{ __ENGINE__?.end?.(); }catch(_){}
  __ENGINE__ = null;
  return null;
}

export const GameEngine = { start, stop };

export default { start, stop, GameEngine };