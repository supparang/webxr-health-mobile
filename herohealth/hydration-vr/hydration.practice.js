// === /herohealth/hydration-vr/hydration.practice.js ===
// Practice Mode Controller (15s) for Hydration
// - No real scoring/logging; warmup only
// - Emits: hha:practice_start, hha:practice_tick, hha:practice_end
// - After done: auto start real game by emitting hha:start

'use strict';

export function bootPractice(opts = {}) {
  const DOC = document;
  const ROOT = window;

  const clamp = (v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };
  const emit = (name, detail)=>{ try{ ROOT.dispatchEvent(new CustomEvent(name,{detail})); }catch(_){ } };

  const cfg = {
    seconds: clamp(opts.seconds ?? 15, 5, 60),
    // small “practice tuning”: more good targets, fewer bad
    biasGood: clamp(opts.biasGood ?? 0.12, 0, 0.30),
    lockDuring: !!opts.lockDuring  // if true: freeze HUD clicks except practice buttons
  };

  const elOverlay = DOC.getElementById('practiceOverlay');
  const elLeft = DOC.getElementById('prac-left');
  const elScore = DOC.getElementById('prac-score');
  const elTip = DOC.getElementById('prac-tip');

  const btnStart = DOC.getElementById('btnStartPractice');
  const btnSkip = DOC.getElementById('btnSkipPractice');
  const btnRecenter = DOC.getElementById('btnRecenterPractice');

  const btnFromStart = DOC.getElementById('btnPractice');

  const STATE = {
    active:false,
    done:false,
    tLeft: cfg.seconds,
    warmScore:0,
    raf:0,
    lastAt:0,
    // optional counters
    hit:0,
    miss:0
  };

  function show(on){
    if (!elOverlay) return;
    elOverlay.hidden = !on;
  }

  function setText(el, v){
    if (!el) return;
    el.textContent = String(v);
  }

  function tipPick(){
    const tips = [
      'ยิง 💧 ให้คุม GREEN แล้วลองลากคอมโบ',
      'เก็บ 🛡️ 1–2 อัน แล้วลอง BLOCK ตอนท้ายพายุ (ถ้ามี)',
      'อย่ารัว! เล็งนิ่ง ๆ แล้วค่อยยิง Accuracy จะพุ่ง',
      'cVR: แตะที่ไหนก็ยิง (ยิงกลางจอ) ลองเล็งเป้าให้ตรง crosshair'
    ];
    const i = Math.floor(Math.random()*tips.length);
    return tips[i];
  }

  function start(){
    if (STATE.active || STATE.done) return;
    STATE.active = true;
    STATE.tLeft = cfg.seconds;
    STATE.warmScore = 0;
    STATE.hit = 0;
    STATE.miss = 0;
    STATE.lastAt = performance.now();

    show(true);
    setText(elTip, tipPick());
    setText(elLeft, STATE.tLeft|0);
    setText(elScore, STATE.warmScore|0);

    // tell the game to enter “practice mode”
    emit('hha:practice_start', { seconds: cfg.seconds, biasGood: cfg.biasGood });

    function loop(t){
      if (!STATE.active) return;
      const dt = Math.min(0.05, Math.max(0.001, (t - STATE.lastAt)/1000));
      STATE.lastAt = t;
      STATE.tLeft = Math.max(0, STATE.tLeft - dt);

      setText(elLeft, Math.ceil(STATE.tLeft));

      emit('hha:practice_tick', {
        leftSec: STATE.tLeft,
        warmScore: STATE.warmScore,
        hit: STATE.hit,
        miss: STATE.miss
      });

      if (STATE.tLeft <= 0.0001){
        finish('timeup');
        return;
      }
      STATE.raf = requestAnimationFrame(loop);
    }
    STATE.raf = requestAnimationFrame(loop);
  }

  function finish(reason='done'){
    if (!STATE.active || STATE.done) return;
    STATE.active = false;
    STATE.done = true;
    try{ cancelAnimationFrame(STATE.raf); }catch(_){}

    emit('hha:practice_end', {
      reason,
      warmScore: STATE.warmScore,
      hit: STATE.hit,
      miss: STATE.miss
    });

    // hide practice overlay
    show(false);

    // auto start real game
    emit('hha:start', { from:'practice', reason });
  }

  function skip(){
    if (STATE.active){
      finish('skip');
      return;
    }
    // not active: go straight to game
    show(false);
    emit('hha:start', { from:'practice', reason:'skip' });
  }

  // score events (warm score) — listen from game judge in practice
  ROOT.addEventListener('hha:practice_score', (ev)=>{
    if (!STATE.active) return;
    const d = ev.detail || {};
    const add = Number(d.add||0);
    if (!isFinite(add)) return;
    STATE.warmScore += add;
    setText(elScore, STATE.warmScore|0);
  });

  ROOT.addEventListener('hha:practice_hit', ()=>{
    if (!STATE.active) return;
    STATE.hit++;
  });
  ROOT.addEventListener('hha:practice_miss', ()=>{
    if (!STATE.active) return;
    STATE.miss++;
  });

  // buttons
  btnStart?.addEventListener('click', start);
  btnSkip?.addEventListener('click', skip);
  btnRecenter?.addEventListener('click', ()=>{
    try{ window.HHA_CAL?.recenter('practice'); }catch(_){}
  });

  // entry point button from startOverlay
  btnFromStart?.addEventListener('click', ()=>{
    // open practice overlay (but do NOT start until player clicks Start Practice)
    show(true);
    STATE.done = false; // allow re-run
  });

  // If URL wants practice auto (optional): ?practice=1
  const q = new URLSearchParams(location.search);
  if (String(q.get('practice')||'') === '1'){
    show(true);
  }

  return { start, skip, finish };
}