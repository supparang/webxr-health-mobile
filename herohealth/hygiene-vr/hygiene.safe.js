// === /herohealth/hygiene-vr/hygiene.safe.js ===
// Handwash SAFE — Boss Germ + Combo + Mini-Quiz + AI hooks + Logging (HHA Standard-ish)
// ✅ Modes: play / research
//   - play: adaptive-ish director (unless ai hooks override)
//   - research: deterministic (seeded) + no adaptive surprises
// ✅ View: pc/mobile/vr/cvr (tap + optional hha:shoot event)
// ✅ Emits: hha:start, hha:time, hha:score, hha:coach, hha:judge, hha:end
// ✅ Stores: HHA_LAST_SUMMARY, HHA_SUMMARY_HISTORY
// ✅ Logging buffer: window.HHA_LOG_BUFFER (and optional POST to ?log= endpoint)
// ✅ AI hooks (optional):
//    - window.HHA.createAIHooks({gameId,pid,seed,run,diff})
//      returns { getDifficulty(), getTip(state), onEvent(ev) }
//    - enabled only when run=play and opts.ai===true
'use strict';

const WIN = window;
const DOC = document;

const LS_LAST = 'HHA_LAST_SUMMARY';
const LS_HIST = 'HHA_SUMMARY_HISTORY';

function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
function now(){ return performance.now(); }

function hash32(str){
  str = String(str ?? '');
  let h = 2166136261 >>> 0;
  for (let i=0;i<str.length;i++){
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed){
  let a = seed >>> 0;
  return function(){
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pick(rng, arr){ return arr[Math.floor(rng()*arr.length)]; }

function ymdLocal(){
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

function safeJsonParse(s, d=null){ try{ return JSON.parse(s); }catch{ return d; } }
function safeJsonStringify(o){ try{ return JSON.stringify(o); }catch{ return ''; } }

function emit(name, detail){
  try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
}

function getEl(id){ return DOC.getElementById(id); }

function getSafeZonesPx(){
  const root = DOC.documentElement;
  const cs = getComputedStyle(root);
  const top = parseFloat(cs.getPropertyValue('--hw-top-safe')) || 0;
  const bottom = parseFloat(cs.getPropertyValue('--hw-bottom-safe')) || 0;
  return { top, bottom };
}

function mkLogger(opts){
  const buf = (WIN.HHA_LOG_BUFFER ||= []);
  const base = {
    gameId: 'HeroHealth-Handwash',
    pid: opts.pid || '',
    run: opts.run,
    diff: opts.diff,
    seed: String(opts.seed || ''),
    view: opts.view,
    studyId: opts.studyId || '',
    phase: opts.phase || '',
    conditionGroup: opts.conditionGroup || '',
    day: ymdLocal()
  };

  async function flushIfUrl(events){
    if(!opts.log) return;
    try{
      await fetch(opts.log, {
        method:'POST',
        mode:'cors',
        headers:{'content-type':'application/json'},
        body: JSON.stringify({ meta: base, events })
      });
    }catch(_){}
  }

  let flushTimer = 0;
  function log(type, data){
    const ev = { t: Date.now(), type, ...base, data: data || {} };
    buf.push(ev);
    // light flush (best-effort)
    if(opts.log){
      clearTimeout(flushTimer);
      flushTimer = setTimeout(()=>{ flushIfUrl([ev]); }, 250);
    }
  }

  function endFlush(allEvents){
    if(opts.log && allEvents && allEvents.length){
      flushIfUrl(allEvents);
    }
  }

  return { log, endFlush, base, buf };
}

function makeAIHooks(opts){
  // enable only in play and opts.ai
  if(!(opts.ai && opts.run === 'play')) return null;

  try{
    const factory = WIN?.HHA?.createAIHooks;
    if(typeof factory === 'function'){
      const hooks = factory({
        gameId:'HeroHealth-Handwash',
        pid: opts.pid || '',
        seed: String(opts.seed || ''),
        run: opts.run,
        diff: opts.diff
      });
      if(hooks && (typeof hooks.getDifficulty==='function' || typeof hooks.getTip==='function' || typeof hooks.onEvent==='function')){
        return hooks;
      }
    }
  }catch(_){}
  // fallback stub
  return {
    getDifficulty(){ return null; },
    getTip(){ return null; },
    onEvent(){ /*noop*/ }
  };
}

// 7 steps (can tweak emoji later)
const STEPS = [
  { id:'wet',    label:'เปียกมือ',     emoji:'💧' },
  { id:'soap',   label:'ใส่สบู่',       emoji:'🧼' },
  { id:'palm',   label:'ถูฝ่ามือ',      emoji:'🤲' },
  { id:'back',   label:'หลังมือ',       emoji:'🖐️' },
  { id:'fingers',label:'ซอกนิ้ว',       emoji:'🧷' },
  { id:'thumb',  label:'นิ้วโป้ง',      emoji:'👍' },
  { id:'rinse',  label:'ล้างออก',       emoji:'🚿' },
];

// germs / boss
const GERMS = ['🦠','🧫','🦠','🧪'];
const BOSS = { emoji:'👾', hpBase: 8 };

export function boot(opts){
  opts = opts || {};
  const view = String(opts.view || 'mobile').toLowerCase();
  const run  = String(opts.run  || 'play').toLowerCase();
  const diff = String(opts.diff || 'normal').toLowerCase();

  const layer = getEl('layer');
  const menu  = getEl('menu');
  const btnPlay = getEl('btnPlay');
  const btnPractice = getEl('btnPractice');
  const btnBack = getEl('btnBack');

  const tScore = getEl('tScore');
  const tCombo = getEl('tCombo');
  const tStep  = getEl('tStep');
  const tTime  = getEl('tTime');
  const coach  = getEl('coach');
  const bossFill = getEl('bossFill');

  if(!layer || !menu || !btnPlay){
    console.error('Handwash: missing DOM nodes');
    return;
  }

  // hub link
  try{
    if(btnBack && opts.hub) btnBack.href = String(opts.hub);
  }catch(_){}

  const rng = mulberry32(hash32(String(opts.seed || Date.now())));
  const logger = mkLogger({ ...opts, view, run, diff });

  const ai = makeAIHooks({ ...opts, view, run, diff });

  // director params
  const D = {
    // base spawn rates
    germEveryMs: diff==='hard' ? 680 : diff==='easy' ? 920 : 800,
    stepEveryMs: diff==='hard' ? 1200 : diff==='easy' ? 1500 : 1350,
    ttlMs: diff==='hard' ? 1150 : diff==='easy' ? 1650 : 1400,
    bossMeterGain: diff==='hard' ? 10 : diff==='easy' ? 14 : 12, // per hit germ
    bossMeterLeak: 0.012, // per ms
    bossThreshold: 100
  };

  // allow AI override difficulty in play only
  if(ai && run==='play'){
    try{
      const v = ai.getDifficulty?.();
      if(v && typeof v === 'object'){
        if(Number.isFinite(v.germEveryMs)) D.germEveryMs = clamp(v.germEveryMs, 450, 1400);
        if(Number.isFinite(v.stepEveryMs)) D.stepEveryMs = clamp(v.stepEveryMs, 900, 2200);
        if(Number.isFinite(v.ttlMs)) D.ttlMs = clamp(v.ttlMs, 900, 2400);
      }
    }catch(_){}
  }

  // state
  const S = {
    started:false,
    practice:false,
    t0:0,
    elapsed:0,
    timeLeft: Math.max(20, Math.min(300, Number(opts.time)||80)),
    score:0,
    combo:0,
    bestCombo:0,
    stepsDone: new Set(),
    stepIndex:0,
    bossMeter:0,
    bossActive:false,
    bossHp:0,
    hitsGood:0,
    hitsGerm:0,
    misses:0,
    expires:0,
    quizzes:0,
    quizCorrect:0,
    shots:0,
    lastShotAt:0,
  };

  // small anti double-fire
  function canShoot(){
    const t = now();
    if(t - S.lastShotAt < 90) return false;
    S.lastShotAt = t;
    return true;
  }

  function uiCoach(msg){
    if(!coach) return;
    coach.textContent = msg;
    coach.classList.add('show');
    emit('hha:coach', { msg });
    setTimeout(()=> coach.classList.remove('show'), 1200);
  }

  function uiSync(){
    if(tScore) tScore.textContent = String(S.score);
    if(tCombo) tCombo.textContent = String(S.combo);
    if(tStep)  tStep.textContent  = String(S.stepsDone.size);
    if(tTime)  tTime.textContent  = String(Math.max(0, Math.ceil(S.timeLeft)));
    const pct = clamp(S.bossMeter / D.bossThreshold, 0, 1);
    if(bossFill){
      bossFill.style.width = String(Math.round(pct*100)) + '%';
      bossFill.classList.toggle('warn', pct > 0.55 && pct < 0.95);
      bossFill.classList.toggle('good', pct >= 0.95);
    }
  }

  function rectLayer(){
    const r = layer.getBoundingClientRect();
    return { x:r.left, y:r.top, w:r.width, h:r.height };
  }

  function isInHudSafe(y){
    const { top, bottom } = getSafeZonesPx();
    const r = rectLayer();
    return (y < top) || (y > (r.h - bottom));
  }

  function spawnTarget(kind){
    const r = rectLayer();
    const pad = 18;
    const { top, bottom } = getSafeZonesPx();

    // safe vertical range
    const yMin = pad + top;
    const yMax = Math.max(yMin + 10, r.h - (pad + bottom));

    const el = DOC.createElement('div');
    el.className = 'tgt ' + kind;

    // size by kind
    const size = (kind==='boss') ? 92 : 64;

    // pick position (avoid hud safe)
    let x = pad + Math.floor(rng() * Math.max(10, (r.w - pad*2 - size)));
    let y = yMin + Math.floor(rng() * Math.max(10, (yMax - yMin - size)));

    // final guard
    if(isInHudSafe(y)) y = yMin;

    el.style.left = x + 'px';
    el.style.top  = y + 'px';

    const born = now();
    const ttl = (kind==='boss') ? 5200 : D.ttlMs;

    let payload = null;

    if(kind==='germ'){
      payload = { type:'germ', emoji: pick(rng, GERMS), hp:1 };
      el.textContent = payload.emoji;
    }else if(kind==='step'){
      const step = STEPS[S.stepIndex % STEPS.length];
      payload = { type:'step', stepId: step.id, emoji: step.emoji, label: step.label, hp:1 };
      el.textContent = payload.emoji;
    }else if(kind==='boss'){
      payload = { type:'boss', emoji: BOSS.emoji, hp: S.bossHp };
      el.textContent = payload.emoji;
      el.classList.add('boss');
    }

    el.dataset.payload = safeJsonStringify(payload);
    el.dataset.born = String(born);
    el.dataset.ttl = String(ttl);

    // click/tap
    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      onHitTarget(el, { source:'tap' });
    }, { passive:false });

    layer.appendChild(el);

    logger.log('spawn', { kind, x, y, ttl, payload });

    return el;
  }

  function destroy(el){
    try{ el.remove(); }catch(_){}
  }

  function onExpire(el){
    const payload = safeJsonParse(el.dataset.payload, {});
    if(payload?.type === 'germ'){
      S.combo = 0;
      S.expires++;
      S.misses++;
      uiCoach('พลาด! เชื้อหนีไป 😵');
      logger.log('expire', { kind:'germ' });
    }else if(payload?.type === 'step'){
      // step expiring is soft miss (still pushes pressure)
      S.expires++;
      logger.log('expire', { kind:'step', stepId: payload.stepId });
    }
    destroy(el);
    uiSync();
  }

  // Mini-Quiz: quick decision (2 options) shown via coach line
  let quizLock = false;
  function maybeQuiz(){
    if(quizLock) return;
    if(S.practice) return;
    if(S.stepsDone.size < 3) return;
    // ~10% chance after completing a step
    if(rng() > 0.10) return;

    quizLock = true;
    S.quizzes++;

    const q = pick(rng, [
      { q:'ล้างมือควรใช้เวลาประมาณกี่วินาที?', a:'20', b:'5', correct:'20' },
      { q:'ขั้นตอนสำคัญเพื่อจัดการ “ซอกนิ้ว” คือ?', a:'ถูซอกนิ้ว', b:'แค่ล้างน้ำ', correct:'ถูซอกนิ้ว' },
    ]);

    uiCoach(`🧠 Quiz: ${q.q} (แตะเลือกใน 2 วินาที)`);
    // spawn 2 tiny quiz targets as germs (reuse target system)
    const a = spawnTarget('germ');
    const b = spawnTarget('germ');
    a.textContent = '🅰️'; b.textContent = '🅱️';
    a.dataset.payload = safeJsonStringify({ type:'quiz', choice:'A', text:q.a, correct: q.correct });
    b.dataset.payload = safeJsonStringify({ type:'quiz', choice:'B', text:q.b, correct: q.correct });
    a.classList.add('step'); b.classList.add('step');

    const tStart = now();
    const quizTimer = setInterval(()=>{
      if(now() - tStart > 2200){
        clearInterval(quizTimer);
        quizLock = false;
        // clean leftovers if still present
        if(a.isConnected) destroy(a);
        if(b.isConnected) destroy(b);
        uiCoach('หมดเวลา Quiz ⏱️');
      }
    }, 120);

    logger.log('quiz_show', { q: q.q, A:q.a, B:q.b, correct:q.correct });
  }

  function hitFx(kind, x, y){
    // cheap fx: pulse div
    const fx = DOC.createElement('div');
    fx.style.position='absolute';
    fx.style.left = x + 'px';
    fx.style.top  = y + 'px';
    fx.style.width='10px';
    fx.style.height='10px';
    fx.style.borderRadius='999px';
    fx.style.border='1px solid rgba(255,255,255,.25)';
    fx.style.background = (kind==='good') ? 'rgba(34,197,94,.35)'
                   : (kind==='boss') ? 'rgba(255,79,216,.30)'
                   : 'rgba(239,68,68,.30)';
    fx.style.transform='translate(-50%,-50%) scale(1)';
    fx.style.opacity='1';
    fx.style.pointerEvents='none';
    fx.style.transition='transform .22s ease, opacity .22s ease';
    layer.appendChild(fx);
    requestAnimationFrame(()=>{
      fx.style.transform='translate(-50%,-50%) scale(5.6)';
      fx.style.opacity='0';
    });
    setTimeout(()=>{ try{ fx.remove(); }catch(_){ } }, 240);
  }

  function onHitTarget(el, meta){
    if(!S.started) return;
    if(!canShoot()) return;

    const r = rectLayer();
    const cx = parseFloat(el.style.left) + (el.offsetWidth/2);
    const cy = parseFloat(el.style.top)  + (el.offsetHeight/2);

    const payload = safeJsonParse(el.dataset.payload, {});
    S.shots++;

    if(payload?.type === 'germ'){
      S.hitsGerm++;
      S.hitsGood++;
      S.combo++;
      S.bestCombo = Math.max(S.bestCombo, S.combo);
      S.score += 10 + Math.min(20, S.combo); // combo bonus
      S.bossMeter += D.bossMeterGain;

      hitFx('good', cx, cy);
      logger.log('hit_germ', { combo:S.combo, score:S.score, meter:S.bossMeter, src:meta?.source||'' });

      // AI coach micro-tip
      if(ai && run==='play'){
        try{
          ai.onEvent?.({ type:'hit_germ', combo:S.combo, timeLeft:S.timeLeft, stepsDone:S.stepsDone.size });
          const tip = ai.getTip?.({ combo:S.combo, timeLeft:S.timeLeft, stepsDone:S.stepsDone.size });
          if(tip && typeof tip === 'string') uiCoach(tip);
        }catch(_){}
      }

      destroy(el);
      uiSync();

      // trigger boss if meter full
      if(!S.bossActive && S.bossMeter >= D.bossThreshold){
        startBoss();
      }
      return;
    }

    if(payload?.type === 'step'){
      // collect step in order
      if(S.stepsDone.has(payload.stepId)){
        // already done -> small score only
        S.score += 2;
        hitFx('good', cx, cy);
        logger.log('hit_step_repeat', { stepId: payload.stepId });
      }else{
        S.stepsDone.add(payload.stepId);
        S.score += 14;
        S.combo = Math.max(0, S.combo); // keep combo
        hitFx('good', cx, cy);
        logger.log('hit_step', { stepId: payload.stepId, done:S.stepsDone.size });

        uiCoach(`✅ ${payload.label}`);
        S.stepIndex = (S.stepIndex + 1) % STEPS.length;

        maybeQuiz();

        // finish condition: 7 steps done
        if(S.stepsDone.size >= 7 && !S.practice){
          // reward + extend time a bit for hype
          S.score += 40;
          S.timeLeft += 6;
          uiCoach('ครบ 7 ขั้นตอน! +6s 🔥');
          logger.log('steps_complete', { score:S.score });
        }
      }
      destroy(el);
      uiSync();
      return;
    }

    if(payload?.type === 'quiz'){
      const text = payload.text;
      const correct = payload.correct;
      const ok = String(text) === String(correct);
      if(ok){
        S.quizCorrect++;
        S.score += 20;
        uiCoach('ถูกต้อง! +20 ✅');
      }else{
        S.score += 0;
        S.combo = 0;
        uiCoach('ยังไม่ถูก ลองใหม่ 🔁');
      }
      logger.log('quiz_answer', { picked:text, correct, ok });

      // clear any other quiz targets
      layer.querySelectorAll('.tgt').forEach(t=>{
        const p = safeJsonParse(t.dataset.payload, {});
        if(p?.type === 'quiz') destroy(t);
      });
      quizLock = false;
      uiSync();
      return;
    }

    if(payload?.type === 'boss'){
      if(!S.bossActive) return;
      S.score += 8;
      S.combo++;
      S.bossHp--;
      hitFx('boss', cx, cy);
      logger.log('hit_boss', { bossHp:S.bossHp });

      destroy(el);
      uiSync();

      if(S.bossHp <= 0){
        endBoss(true);
      }
      return;
    }

    // unknown -> ignore
    destroy(el);
  }

  function startBoss(){
    S.bossActive = true;
    S.bossMeter = 0;
    S.bossHp = BOSS.hpBase + Math.floor(S.bestCombo/6); // scales with skill
    uiCoach(`👾 BOSS GERMS! (${S.bossHp} hits)`);
    logger.log('boss_start', { hp:S.bossHp, bestCombo:S.bestCombo });

    // spawn boss targets sequentially (each hit spawns next)
    spawnBossTarget();
  }

  function spawnBossTarget(){
    if(!S.bossActive) return;
    // spawn one boss at a time
    const el = spawnTarget('boss');
    el.dataset.payload = safeJsonStringify({ type:'boss', hp:S.bossHp });
    el.dataset.ttl = String(2400);
  }

  function endBoss(win){
    S.bossActive = false;
    // clear any remaining boss targets
    layer.querySelectorAll('.tgt.boss').forEach(destroy);

    if(win){
      S.score += 60;
      uiCoach('บอสพ่าย! +60 🎉');
      logger.log('boss_clear', { score:S.score });
    }else{
      uiCoach('บอสหนีไป… 😤');
      logger.log('boss_fail', {});
    }
    uiSync();
  }

  // shoot support: accept crosshair shots from vr-ui.js
  function bindShootEvent(){
    WIN.addEventListener('hha:shoot', (ev)=>{
      if(!S.started) return;
      if(!canShoot()) return;

      const x = ev?.detail?.x;
      const y = ev?.detail?.y;
      if(!(Number.isFinite(x) && Number.isFinite(y))) return;

      // find topmost target near (x,y)
      const r = rectLayer();
      const px = x - r.x;
      const py = y - r.y;

      let best = null;
      let bestD = 999999;
      layer.querySelectorAll('.tgt').forEach(el=>{
        const ex = parseFloat(el.style.left) + (el.offsetWidth/2);
        const ey = parseFloat(el.style.top)  + (el.offsetHeight/2);
        const dx = ex - px, dy = ey - py;
        const d2 = dx*dx + dy*dy;
        if(d2 < bestD){
          bestD = d2; best = el;
        }
      });

      // lock radius (from vr-ui)
      const lockPx = Number(ev?.detail?.lockPx ?? 64);
      if(best && bestD <= lockPx*lockPx){
        onHitTarget(best, { source:'shoot' });
      }else{
        // miss shot (soft)
        S.combo = 0;
        S.misses++;
        logger.log('shot_miss', { lockPx, bestD });
        uiSync();
      }
    });
  }

  // tick loop
  let rafId = 0;
  let lastTick = 0;
  let lastGerm = 0;
  let lastStep = 0;

  function tick(ts){
    if(!S.started){ rafId = requestAnimationFrame(tick); return; }
    if(!lastTick) lastTick = ts;

    const dt = ts - lastTick;
    lastTick = ts;

    // time
    S.timeLeft -= dt/1000;
    S.elapsed += dt;

    // boss meter leak
    if(!S.bossActive){
      S.bossMeter = Math.max(0, S.bossMeter - (dt * D.bossMeterLeak));
    }

    // spawns (stop spawning in practice? no, practice still spawns but lighter)
    const germInterval = S.practice ? Math.max(900, D.germEveryMs) : D.germEveryMs;
    const stepInterval = S.practice ? Math.max(1700, D.stepEveryMs) : D.stepEveryMs;

    if(ts - lastGerm > germInterval && !S.bossActive){
      lastGerm = ts;
      spawnTarget('germ');
    }
    if(ts - lastStep > stepInterval && !S.bossActive){
      lastStep = ts;
      // only spawn steps until complete (practice: still spawn)
      if(S.practice || S.stepsDone.size < 7) spawnTarget('step');
    }

    // boss behavior: keep pressure by respawning boss if none
    if(S.bossActive){
      const hasBoss = !!layer.querySelector('.tgt.boss');
      if(!hasBoss){
        spawnBossTarget();
      }
    }

    // TTL cleanup
    layer.querySelectorAll('.tgt').forEach(el=>{
      const born = Number(el.dataset.born || 0);
      const ttl  = Number(el.dataset.ttl  || 0);
      if(ttl && (now() - born > ttl)){
        onExpire(el);
        // if boss expired -> fail boss
        const p = safeJsonParse(el.dataset.payload, {});
        if(p?.type === 'boss'){
          endBoss(false);
        }
      }
    });

    // emit time/score occasionally
    if(Math.floor(S.elapsed/500) !== Math.floor((S.elapsed-dt)/500)){
      emit('hha:time', { timeLeft: S.timeLeft });
      emit('hha:score', { score: S.score, combo: S.combo, stepsDone: S.stepsDone.size });
    }

    uiSync();

    // end
    if(!S.practice && S.timeLeft <= 0){
      finish('timeout');
    }
    if(S.practice && S.timeLeft <= 0){
      // end practice returns to menu
      S.started = false;
      menu.style.display = 'grid';
      uiCoach('จบฝึก! พร้อมเล่นจริง 💪');
      logger.log('practice_end', {});
    }

    rafId = requestAnimationFrame(tick);
  }

  function start(practice){
    // reset
    S.started = true;
    S.practice = !!practice;
    S.t0 = now();
    S.elapsed = 0;
    S.timeLeft = practice ? 15 : Math.max(20, Math.min(300, Number(opts.time)||80));
    S.score = 0;
    S.combo = 0;
    S.bestCombo = 0;
    S.stepsDone = new Set();
    S.stepIndex = 0;
    S.bossMeter = 0;
    S.bossActive = false;
    S.bossHp = 0;
    S.hitsGood = 0;
    S.hitsGerm = 0;
    S.misses = 0;
    S.expires = 0;
    S.quizzes = 0;
    S.quizCorrect = 0;
    S.shots = 0;
    S.lastShotAt = 0;

    // clear layer
    layer.innerHTML = '';

    menu.style.display = 'none';
    uiCoach(practice ? 'โหมดฝึก 15 วินาที 🧪' : 'เริ่ม! เก็บขั้นตอน + ยิงเชื้อ 🔥');

    logger.log(practice ? 'practice_start' : 'start', { view, run, diff });
    emit('hha:start', { gameId:'HeroHealth-Handwash', pid: opts.pid||'', run, diff, view, seed: String(opts.seed||'') });

    // ensure tick
    lastTick = 0;
    lastGerm = 0;
    lastStep = 0;
  }

  function finish(reason){
    S.started = false;
    // clear layer
    layer.innerHTML = '';

    const durationSec = Math.max(0, Math.round((S.elapsed/1000)*10)/10);
    const steps = S.stepsDone.size;
    const accuracy = S.shots ? Math.round((S.hitsGood / S.shots)*100) : 0;

    const summary = {
      gameId:'HeroHealth-Handwash',
      pid: opts.pid||'',
      run, diff, view,
      seed: String(opts.seed||''),
      reason,
      durationSec,
      timePlannedSec: Number(opts.time)||80,
      score: S.score,
      comboBest: S.bestCombo,
      stepsDone: steps,
      shots: S.shots,
      hits: S.hitsGood,
      misses: S.misses,
      expires: S.expires,
      accuracyPct: accuracy,
      quizzes: S.quizzes,
      quizCorrect: S.quizCorrect
    };

    // store last + history
    try{
      localStorage.setItem(LS_LAST, safeJsonStringify(summary));
      const hist = safeJsonParse(localStorage.getItem(LS_HIST), []) || [];
      hist.unshift({ t: Date.now(), ...summary });
      localStorage.setItem(LS_HIST, safeJsonStringify(hist.slice(0, 60)));
    }catch(_){}

    logger.log('end', summary);
    emit('hha:end', summary);

    // optional flush
    try{
      logger.endFlush(logger.buf.slice(-60));
    }catch(_){}

    // show menu again
    menu.style.display = 'grid';
    uiCoach(`จบเกม! Score=${S.score} • Steps=${steps}/7 • Acc=${accuracy}%`);
  }

  // menu bindings
  btnPlay.addEventListener('click', ()=> start(false), { passive:true });
  if(btnPractice) btnPractice.addEventListener('click', ()=> start(true), { passive:true });

  // bind shoot
  bindShootEvent();

  // initial UI + loop
  uiSync();
  rafId = requestAnimationFrame(tick);
}