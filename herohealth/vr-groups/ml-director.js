// === /herohealth/vr-groups/ml-director.js ===
// ML Difficulty Director + Pattern Generator (2B)
// ✅ Smooth adaptive: spawnMs / wrongRate / junkRate / size / lifeMs
// ✅ Pattern: normal | burst | wave | storm_focus (seeded)
// ✅ Uses DL MLP if available: GroupsVR.DL.predictRisk(f6)
// ✅ Explainable micro-tips (rate-limited)
// ❌ Disabled in research/practice by design

(function(){
  'use strict';
  const WIN = window;
  const NS = (WIN.GroupsVR = WIN.GroupsVR || {});

  function nowMs(){ return (performance && performance.now) ? performance.now() : Date.now(); }
  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
  function lerp(a,b,t){ return a + (b-a)*t; }

  // tiny deterministic rng (LCG)
  function makeRng(seed){
    let s = (seed>>>0)||1;
    return function(){
      s = (Math.imul(1664525, s) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }
  function hashSeed(str){
    str = String(str||'');
    let h = 2166136261>>>0;
    for(let i=0;i<str.length;i++){
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h>>>0;
  }

  const ST = {
    on:false,
    seedU32: 1,
    rng: null,
    lastAt: 0,
    lastTipAt: 0,

    // observed
    acc: 0,
    miss: 0,
    combo: 0,
    left: 0,
    storm: 0,
    miniUrg: 0,

    // difficulty state (0..1)
    d: 0.45,

    // current outputs (smoothed)
    spawnMsMul: 1.0,
    wrongAdd: 0.0,
    junkAdd: 0.0,
    sizeMul: 1.0,
    lifeMul: 1.0,

    // pattern
    pat: 'normal',
    patUntil: 0,
    wavePhase: 0
  };

  function enabledByQuery(){
    try{
      const u = new URL(location.href);
      const ai = String(u.searchParams.get('ai')||'0');
      const run= String(u.searchParams.get('run')||'play').toLowerCase();
      if (run === 'research') return false;
      return (ai==='1' || ai==='true');
    }catch{ return false; }
  }

  function rateTip(ms){
    const t = nowMs();
    if (t - ST.lastTipAt < ms) return false;
    ST.lastTipAt = t;
    return true;
  }

  function coach(text, mood){
    try{
      WIN.dispatchEvent(new CustomEvent('hha:coach', { detail:{ text, mood } }));
    }catch(_){}
  }
  function banner(text, tone='neutral', ms=1100){
    try{
      WIN.dispatchEvent(new CustomEvent('groups:director_banner', { detail:{ text, tone, ms } }));
    }catch(_){}
  }

  // compute risk features
  function calcMissRate10s(hist){
    const t = nowMs();
    const cut = t - 10000;
    const a = hist.filter(x=>x.t>=cut);
    if (a.length < 2) return 0;
    const dm = (a[a.length-1].miss - a[0].miss);
    return Math.max(0, dm) / 10; // per sec
  }

  // Maintain light hist inside director (no heavy)
  const HIST = [];
  const HIST_MAX = 20;
  function pushHist(){
    HIST.push({ t: nowMs(), miss: ST.miss|0 });
    if (HIST.length > HIST_MAX) HIST.shift();
  }

  function dlRisk(){
    const missRate = Math.min(1, calcMissRate10s(HIST) * 2.2);
    const accBad   = Math.min(1, (100 - ST.acc) / 100);
    const comboN   = Math.max(0, Math.min(1, ST.combo / 10));
    const leftLow  = Math.max(0, Math.min(1, (12 - ST.left) / 12));
    const storm    = ST.storm ? 1 : 0;
    const miniU    = ST.miniUrg ? 1 : 0;

    const f6 = [missRate, accBad, comboN, leftLow, storm, miniU];

    const DL = NS.DL && NS.DL.predictRisk ? NS.DL : null;
    const out = DL ? DL.predictRisk(f6) : null;

    const r = out ? out.r : (1/(1+Math.exp(-(-0.55 + 1.35*missRate + 1.10*accBad -0.35*comboN + 0.55*leftLow + 0.65*storm + 0.55*miniU))));
    const explain = out ? out.explain : null;

    return { r, f6, explain, parts:{missRate,accBad,comboN,leftLow,storm,miniU} };
  }

  function choosePattern(r){
    const t = nowMs();
    if (t < ST.patUntil) return;

    // pattern decisions are seeded but influenced by state
    const roll = ST.rng();
    let pat = 'normal';
    let len = 5000 + (ST.rng()*2500|0);

    if (ST.storm){
      pat = 'storm_focus'; len = 5500;
    } else if (r >= 0.78 && roll < 0.65){
      pat = 'burst'; len = 4200;
    } else if (r >= 0.55 && roll < 0.55){
      pat = 'wave'; len = 5200;
    }

    ST.pat = pat;
    ST.patUntil = t + len;

    if (pat === 'burst') banner('⚡ BURST! เป้าจะมาเป็นชุด', 'warn', 1200);
    if (pat === 'wave')  banner('🌊 WAVE! เป้าจะไหลเป็นจังหวะ', 'neutral', 1100);
  }

  function updateDifficulty(r){
    // target d tries to keep r around 0.45-0.65
    // if player too safe -> increase challenge; too risky -> ease a bit
    const target = clamp((r - 0.50), -0.35, 0.35);
    const aim = clamp(0.45 + target, 0.18, 0.86);

    // smooth update
    ST.d = lerp(ST.d, aim, 0.08);

    // map d to outputs (smooth multipliers)
    // higher d => faster spawns, more wrong/junk, smaller targets, shorter life
    ST.spawnMsMul = lerp(1.08, 0.78, ST.d);
    ST.wrongAdd   = lerp(-0.02, 0.10, ST.d);
    ST.junkAdd    = lerp(-0.01, 0.07, ST.d);
    ST.sizeMul    = lerp(1.04, 0.90, ST.d);
    ST.lifeMul    = lerp(1.06, 0.84, ST.d);

    // storm makes it spicier but not unfair
    if (ST.storm){
      ST.spawnMsMul *= 0.90;
      ST.lifeMul    *= 0.92;
    }
    if (ST.miniUrg){
      ST.spawnMsMul *= 0.94; // อย่าโหดเกินตอน mini จะหมด
    }
  }

  function maybeTip(risk){
    const r = risk.r;
    const p = risk.parts;

    if (!rateTip(1700)) return;

    if (r >= 0.78){
      if (p.miniU){ coach('MINI ใกล้หมด! เล็ง “ชัวร์” ก่อนนะ 👀', 'fever'); return; }
      if (p.storm){ coach('พายุอยู่! ช้าลงนิด แล้วเล็งให้ตรงหมู่ก่อนยิง 🔥', 'fever'); return; }
      if (p.missRate > 0.35){ coach('พลาดถี่แล้ว! หยุดยิงมั่ว 1 วิ แล้วค่อยยิงใหม่ 🎯', 'sad'); return; }
      coach('ตั้งสติ! ดูชื่อหมู่ก่อน แล้วค่อยยิง ✅', 'neutral'); return;
    }

    if (r >= 0.55){
      if (p.accBad > 0.35){ coach('ลองช้าลงนิด แต่ยิงให้ถูกหมู่ จะคุ้มกว่า 👍', 'neutral'); return; }
      if (p.leftLow > 0.5){ coach('เวลาใกล้หมด! เลือกยิงเป้าที่ง่ายสุดก่อน ⏳', 'fever'); return; }
    } else {
      if (ST.combo >= 6){ coach('คอมโบสวยมาก! รักษาจังหวะนี้ไว้ 💪', 'happy'); }
    }
  }

  // spawn position generator (pattern)
  function nextPos(view, R){
    // default: random in rect
    const rx = ()=> (ST.rng() * (R.xMax - R.xMin)) + R.xMin;
    const ry = ()=> (ST.rng() * (R.yMax - R.yMin)) + R.yMin;

    const t = nowMs();

    if (ST.pat === 'burst'){
      // cluster around center-ish but not blocking crosshair too much
      const cx = (R.xMin+R.xMax)*0.5;
      const cy = (R.yMin+R.yMax)*0.52;
      const spread = Math.min(170, (R.xMax-R.xMin)*0.22);
      return {
        x: clamp(cx + (ST.rng()*2-1)*spread, R.xMin, R.xMax),
        y: clamp(cy + (ST.rng()*2-1)*spread, R.yMin, R.yMax)
      };
    }

    if (ST.pat === 'wave'){
      // move wave along x with phase
      const w = (R.xMax-R.xMin);
      ST.wavePhase += 0.18 + ST.rng()*0.06;
      const x = R.xMin + ( (Math.sin(ST.wavePhase)*0.5+0.5) * w );
      const y = R.yMin + (ST.rng() * (R.yMax-R.yMin));
      return { x, y };
    }

    if (ST.pat === 'storm_focus'){
      // keep slightly wider spread (more chaotic)
      const x = rx();
      const y = ry();
      return { x, y };
    }

    // normal
    return { x: rx(), y: ry() };
  }

  // ---------- Public API ----------
  NS.MLDirector = NS.MLDirector || {};

  NS.MLDirector.attach = function(cfg){
    cfg = cfg || {};
    const runMode = String(cfg.runMode||'play');
    const enabled = !!cfg.enabled && (runMode === 'play') && enabledByQuery();
    ST.on = enabled;
    ST.seedU32 = hashSeed(String(cfg.seed||Date.now()) + '::mldir');
    ST.rng = makeRng(ST.seedU32);

    ST.lastAt = nowMs();
    ST.lastTipAt = 0;
    ST.pat = 'normal';
    ST.patUntil = 0;
    ST.wavePhase = 0;

    if (ST.on){
      banner('🧠 ML Director ON', 'neutral', 900);
    }
  };

  // called by engine tick (cheap)
  NS.MLDirector.step = function(snapshot){
    if (!ST.on) return { on:false };

    // snapshot expected:
    // {acc, miss, combo, left, storm, miniUrg}
    ST.acc = snapshot.acc|0;
    ST.miss = snapshot.miss|0;
    ST.combo = snapshot.combo|0;
    ST.left = snapshot.left|0;
    ST.storm = snapshot.storm?1:0;
    ST.miniUrg = snapshot.miniUrg?1:0;

    pushHist();

    const risk = dlRisk();
    choosePattern(risk.r);
    updateDifficulty(risk.r);
    maybeTip(risk);

    return {
      on:true,
      risk: Math.round(risk.r*100)/100,
      spawnMsMul: ST.spawnMsMul,
      wrongAdd: ST.wrongAdd,
      junkAdd: ST.junkAdd,
      sizeMul: ST.sizeMul,
      lifeMul: ST.lifeMul,
      pattern: ST.pat
    };
  };

  NS.MLDirector.nextPos = function(view, R){
    if (!ST.on) return null;
    return nextPos(view, R);
  };

})();