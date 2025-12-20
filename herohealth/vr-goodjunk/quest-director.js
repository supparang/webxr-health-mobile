'use strict';

function clamp(v,min,max){ v=Number(v)||0; if(v<min) return min; if(v>max) return max; return v; }
function now(){ return performance.now(); }

function dispatch(name, detail){
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

function pick(arr){
  return arr[(Math.random()*arr.length)|0];
}

function rectsOverlap(a,b){
  return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
}

// safe zone: กันทับ HUD + ขอบ
function buildAvoidRects(){
  const rects = [];
  const pad = 10;

  const hudCards = document.querySelectorAll('.hud-card');
  hudCards.forEach(el=>{
    const r = el.getBoundingClientRect();
    rects.push({
      left: r.left - pad, top: r.top - pad,
      right: r.right + pad, bottom: r.bottom + pad
    });
  });

  // bottom coach area
  const coach = document.querySelector('#coach-bubble');
  if (coach){
    const r = coach.getBoundingClientRect();
    rects.push({ left:r.left-pad, top:r.top-pad, right:r.right+pad, bottom:r.bottom+pad });
  }

  return rects;
}

function scoreGrade({ score, misses }){
  // โทนง่าย ๆ แต่ใช้งานจริง: โดน miss เยอะจะตกเกรด
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
  const durationSec = clamp(opts.durationSec ?? 60, 20, 180);
  const layerEl = opts.layerEl || document.getElementById('gj-layer');

  const CFG = {
    easy:   { spawnEvery: 900,  maxActive: 4, lifetime: 2200, baseScale: 1.12, junkRatio: 0.18 },
    normal: { spawnEvery: 760,  maxActive: 5, lifetime: 2000, baseScale: 1.00, junkRatio: 0.26 },
    hard:   { spawnEvery: 640,  maxActive: 6, lifetime: 1800, baseScale: 0.92, junkRatio: 0.34 }
  }[diff] || { spawnEvery: 760, maxActive: 5, lifetime: 2000, baseScale: 1.0, junkRatio: 0.26 };

  const EMOJI = {
    good: ['🥦','🥕','🍎','🍌','🍇','🥛','🥜','🐟','🍠','🥬','🍉'],
    junk: ['🍟','🍔','🍕','🍩','🍪','🍫','🥤','🍬'],
    gold: ['⭐','🌟','✨'],
    fake: ['😈','🌀','🧟'],
    power: ['🛡️','🧲','⏱️'],
    boss: ['👹','🧌']
  };

  // challenge modifiers
  const CH = {
    rush:     { spawnMul: 0.92, scoreMul: 1.15 },
    boss:     { spawnMul: 1.00, scoreMul: 1.05 },
    survival: { spawnMul: 0.98, scoreMul: 1.00 }
  }[challenge] || { spawnMul: 1.0, scoreMul: 1.0 };

  const S = {
    started:false,
    t0:0,
    timeLeft: durationSec,

    score:0,
    goodHits:0,
    perfect:0,
    misses:0,
    combo:0,
    comboMax:0,

    // shield
    shieldUntil: 0,

    // boss
    bossSpawned:false,
    bossHP:0
  };

  const active = new Map(); // id -> {el,type,spawnAt,expireAt,kind,...}
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

  function canSpawnMore(){
    return active.size < CFG.maxActive;
  }

  function mkTarget({ type, emoji, className, scaleMul=1, lifetime=CFG.lifetime }){
    const el = document.createElement('div');
    el.className = 'gj-target ' + (className||'');
    el.textContent = emoji;
    el.setAttribute('data-hha-tgt','1');
    el.style.setProperty('--tScale', String(CFG.baseScale * scaleMul));

    // position: random but avoid HUD
    const avoid = buildAvoidRects();
    const w = window.innerWidth;
    const h = window.innerHeight;

    const tries = 60;
    let x= w*0.5, y = h*0.55;
    const margin = 70; // keep from edges
    for (let i=0;i<tries;i++){
      x = margin + Math.random()*(w - margin*2);
      y = margin + Math.random()*(h - margin*2);

      const rect = { left:x-50, top:y-50, right:x+50, bottom:y+50 };
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

  function spawnOne(){
    if (!layerEl) return;
    if (!canSpawnMore()) return;

    // boss in "boss" challenge at last 12s
    if (challenge === 'boss' && !S.bossSpawned && S.timeLeft <= 12){
      spawnBoss();
      return;
    }

    // power chance (low)
    const pRoll = Math.random();
    if (pRoll < 0.08){
      spawnPower();
      return;
    }

    // fake chance
    if (pRoll >= 0.08 && pRoll < 0.12){
      spawnFake();
      return;
    }

    // gold chance
    if (pRoll >= 0.12 && pRoll < 0.17){
      spawnGold();
      return;
    }

    const isJunk = Math.random() < CFG.junkRatio;
    if (isJunk) spawnJunk();
    else spawnGood();
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

    // expire miss: only for GOOD targets
    if (reason === 'expired' && t.type === 'good'){
      S.misses++;
      S.combo = 0;
      setJudge('MISS');
      dispatch('quest:miss', { kind:'goodExpired' });
      emitScore();
    }
  }

  function spawnGood(){
    const el = mkTarget({ type:'good', emoji: pick(EMOJI.good), className:'' });
    addToActive(el, { type:'good', lifetime: CFG.lifetime });
  }

  function spawnJunk(){
    const el = mkTarget({ type:'junk', emoji: pick(EMOJI.junk), className:'gj-junk', scaleMul: 1.05, lifetime: CFG.lifetime });
    addToActive(el, { type:'junk', lifetime: CFG.lifetime });
  }

  function spawnGold(){
    const el = mkTarget({ type:'gold', emoji: pick(EMOJI.gold), className:'gj-gold', scaleMul: 1.08, lifetime: CFG.lifetime * 0.95 });
    addToActive(el, { type:'gold', lifetime: CFG.lifetime * 0.95 });
  }

  function spawnFake(){
    const el = mkTarget({ type:'fake', emoji: pick(EMOJI.fake), className:'gj-fake', scaleMul: 1.00, lifetime: CFG.lifetime * 0.9 });
    addToActive(el, { type:'fake', lifetime: CFG.lifetime * 0.9 });
  }

  function spawnPower(){
    const emoji = pick(EMOJI.power);
    let power = 'shield';
    if (emoji.includes('🧲')) power = 'magnet';
    else if (emoji.includes('⏱️')) power = 'time';

    const el = mkTarget({ type:'power', emoji, className:'gj-power', scaleMul: 1.00, lifetime: CFG.lifetime * 0.9 });
    addToActive(el, { type:'power', power, lifetime: CFG.lifetime * 0.9 });
  }

  function spawnBoss(){
    S.bossSpawned = true;
    S.bossHP = 6; // click good hits to reduce? (simple: click boss)
    const el = mkTarget({ type:'boss', emoji: pick(EMOJI.boss), className:'gj-boss', scaleMul: 1.15, lifetime: 999999 });
    addToActive(el, { type:'boss', lifetime: 999999 });
    setJudge('BOSS!');
  }

  function onClickTarget(ev){
    const el = ev.currentTarget;
    const id = el && el.dataset ? el.dataset.tid : null;
    if (!id) return;
    const t = active.get(id);
    if (!t) return;

    // remove immediately
    active.delete(id);
    try{
      el.classList.add('gone');
      setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 120);
    }catch(_){}

    const dt = now() - t.spawnAt;
    const isPerfect = dt <= 520; // fast click = perfect

    // boss
    if (t.type === 'boss'){
      S.bossHP = Math.max(0, (S.bossHP|0) - 1);
      setJudge('HIT!');
      dispatch('quest:goodHit', { type:'boss', judgment:'HIT' });
      if (S.bossHP <= 0){
        setJudge('BOSS CLEAR!');
        dispatch('quest:bossClear', {});
      }
      // score a bit
      S.score += Math.round(8 * CH.scoreMul);
      emitScore();
      return;
    }

    // power
    if (t.type === 'power'){
      if (t.power === 'shield'){
        S.shieldUntil = now() + 5200;
        setJudge('SHIELD!');
        dispatch('quest:power', { power:'shield' });
      } else if (t.power === 'magnet'){
        // simple: spawn 2 extra goods instantly
        setJudge('MAGNET!');
        dispatch('quest:power', { power:'magnet' });
        spawnGood(); spawnGood();
      } else if (t.power === 'time'){
        // plus time: add 3 sec
        S.timeLeft += 3;
        setJudge('+TIME!');
        dispatch('quest:power', { power:'time' });
      }
      emitScore();
      return;
    }

    // fake behaves like junk
    if (t.type === 'fake'){
      // shield block?
      if (now() < S.shieldUntil){
        setJudge('BLOCK!');
        dispatch('quest:block', {});
        emitScore();
        return;
      }
      S.misses++;
      S.combo = 0;
      setJudge('OOPS!');
      dispatch('quest:badHit', { type:'fake' });
      emitScore();
      return;
    }

    // junk
    if (t.type === 'junk'){
      if (now() < S.shieldUntil){
        setJudge('BLOCK!');
        dispatch('quest:block', {});
        emitScore();
        return;
      }
      S.misses++;
      S.combo = 0;
      setJudge('MISS');
      dispatch('quest:badHit', { type:'junk' });
      emitScore();
      return;
    }

    // good/gold
    if (t.type === 'good' || t.type === 'gold'){
      S.goodHits++;
      S.combo++;
      S.comboMax = Math.max(S.comboMax, S.combo);

      let add = (t.type === 'gold') ? 12 : 8;
      if (isPerfect){ add += 4; S.perfect++; setJudge('PERFECT!'); }
      else setJudge('GOOD!');

      add = Math.round(add * CH.scoreMul);
      S.score += add;

      dispatch('quest:goodHit', { type: t.type, judgment: isPerfect ? 'PERFECT' : 'GOOD' });
      emitScore();
      return;
    }
  }

  function tickExpire(){
    const t = now();
    for (const [id, obj] of active){
      if (obj.expireAt <= t){
        removeTarget(id, 'expired');
      }
    }
  }

  function startTimers(){
    // spawn loop
    const spawnEvery = Math.max(280, Math.round(CFG.spawnEvery * CH.spawnMul));
    spawnTimer = setInterval(()=>{
      if (!S.started) return;
      if (!canSpawnMore()) return;
      spawnOne();
    }, spawnEvery);

    // time loop
    dispatch('hha:time', { sec: S.timeLeft|0 });
    timeTimer = setInterval(()=>{
      if (!S.started) return;
      S.timeLeft = Math.max(0, (S.timeLeft|0) - 1);
      dispatch('hha:time', { sec: S.timeLeft|0 });

      // survival (extra punishment: if miss too high end early)
      if (challenge === 'survival' && S.misses >= 12){
        S.timeLeft = 0;
      }

      if (S.timeLeft <= 0){
        end();
      }
    }, 1000);

    // expire + smooth
    const loop = ()=>{
      if (!S.started) return;
      tickExpire();
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

    // end event -> boot.js จะจับแล้ว show summary
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
    S.t0 = now();

    // start mini chain signal
    dispatch('quest:miniStart', {});

    // initial score event
    emitScore();

    // spawn a few immediately
    for (let i=0;i<Math.min(3, CFG.maxActive); i++) spawnOne();

    startTimers();
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
        timeLeft:S.timeLeft|0
      };
    }
  };
}
