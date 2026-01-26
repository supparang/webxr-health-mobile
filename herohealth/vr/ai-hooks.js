// === /herohealth/vr/ai-hooks.js ===
// HHA AI Hooks — Central AI Plug-in Points (OFF by default in research)
// ✅ One module for all games
// ✅ Research/practice: AI OFF (deterministic)
// ✅ Play: AI ON optional (via ?ai=1 or window.HHA_AI=1)
// ✅ Provides:
//    - Difficulty Director hook (optional)
//    - Pattern Generator hook (optional)
//    - AI Coach hook (optional, explainable micro-tips with rate-limit)
// ✅ Emits: hha:ai { on, reason, mode }, hha:coach { msg, tag }, hha:diff (if director emits)

'use strict';

const WIN = window;

const qs = (k, d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };
const toBool = (v)=>{
  const s = String(v ?? '').trim().toLowerCase();
  if(!s) return false;
  return (s === '1' || s === 'true' || s === 'yes' || s === 'on');
};

function emit(name, detail){
  try{ WIN.dispatchEvent(new CustomEvent(name,{detail})); }catch(_){}
}

function modeDefault(){
  const run = String(qs('run','play')).toLowerCase();
  // HHA standard: research + practice must be deterministic => AI off
  if(run === 'research' || run === 'practice') return run;
  return 'play';
}

function aiEnabled({ mode }){
  // 1) hard rules
  if(mode === 'research' || mode === 'practice') return false;

  // 2) explicit enable
  if(toBool(qs('ai', '0'))) return true;
  if(toBool(WIN.HHA_AI)) return true;

  // 3) default: OFF (ปลอดภัย + คุมผล)
  return false;
}

function makeRNG(seed){
  let x = (Number(seed)||Date.now()) % 2147483647;
  if (x <= 0) x += 2147483646;
  return ()=> (x = x * 16807 % 2147483647) / 2147483647;
}

/* ---------------------------------------------------------
 * AI Coach (micro-tips) — explainable + rate-limit
 * --------------------------------------------------------- */
function createCoach({ on=false, cooldownMs=6500 } = {}){
  let lastAt = 0;

  function say(msg, tag='Coach'){
    if(!on) return;
    const now = Date.now();
    if(now - lastAt < cooldownMs) return;
    lastAt = now;
    emit('hha:coach', { msg, tag });
  }

  // simple explainable rules (NO ML yet) — safe baseline
  function observe({ missRate=0, fever=0, combo=0, timeLeft=999 } = {}){
    if(!on) return;

    if(timeLeft <= 7) say('ใกล้หมดเวลา! โฟกัส “ของดี” ก่อนนะ ⏱️');
    if(fever >= 70)   say('FEVER สูง! ชะลอความเสี่ยง เลี่ยงของทอด/หวาน 🔥');
    if(missRate >= 0.9) say('พลาดถี่ไปนิด ลอง “มองกลางจอ” แล้วค่อยยิง 🎯');
    if(combo >= 10)   say('คอมโบสวยมาก! รักษาจังหวะนี้ไว้ 💪');
  }

  return { say, observe };
}

/* ---------------------------------------------------------
 * Pattern Generator — deterministic hook (optional)
 * --------------------------------------------------------- */
function createPatternGen({ on=false, rng=null } = {}){
  const R = (typeof rng === 'function') ? rng : Math.random;

  // returns pattern descriptor you can use if/when you add storm/boss
  function next({ bias=0.5 } = {}){
    if(!on){
      return { kind:'none', speed:1, spread:1 };
    }
    // deterministic when rng is seeded
    const r = R();
    const hard = (r < bias);
    if(hard){
      return { kind:'storm', speed:1.25, spread:1.15 };
    }
    return { kind:'line', speed:1.05, spread:1.0 };
  }

  return { next };
}

/* ---------------------------------------------------------
 * Main factory
 * --------------------------------------------------------- */
export function createAIHooks({
  game='Game',
  mode=modeDefault(),         // play | research | practice
  diff=String(qs('diff','normal')).toLowerCase(),
  seed=String(qs('seed', Date.now())),
  emitAIEvents=true
} = {}){

  const on = aiEnabled({ mode });

  if(emitAIEvents){
    emit('hha:ai', { on, reason: on ? 'enabled' : 'disabled', mode, game, diff, seed });
  }

  // seeded rng for AI when ON (still deterministic per seed)
  const rng = makeRNG(seed + ':ai');

  // Coach: only when AI is ON (play)
  const coach = createCoach({ on });

  // Pattern generator: optional (on when AI on)
  const patterns = createPatternGen({ on, rng });

  // Difficulty Director: you can import createDirector and wire here later,
  // but leaving as "pass-through hook" is fine for now.
  // (We keep a stub so engines can call hooks.director?.tick() safely.)
  const director = null;

  function observeTelemetry(t){
    // unified place to feed coach/patterns in future
    // expected fields: missRate, fever, combo, timeLeft, score, etc.
    coach.observe(t || {});
  }

  return {
    on,
    mode,
    diff,
    seed,
    rng,
    coach,
    patterns,
    director,
    observeTelemetry
  };
}