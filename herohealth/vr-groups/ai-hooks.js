/* === C: /herohealth/vr-groups/ai-hooks.js ===
GroupsVR AI Hooks — PRODUCTION SAFE (OFF by default)
✅ Enabled only when: runMode=play AND enabled=true (from A: aiEnabled via ?ai=1)
✅ Deterministic by seed
✅ Provides: GroupsVR.AIHooks.attach(...)
   - installs GroupsVR.__ai = { enabled, seed, director, pattern, tip }
✅ Director: spawnSpeedMul(acc, combo, missHard)  (fair, explainable-ish)
✅ Pattern: nextPos({R,rng,t,pressure,storm}) -> {x,y} inside playRect
✅ Tip: rate-limited coach micro-tips via hha:coach
*/

(function(root){
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  const NS = root.GroupsVR = root.GroupsVR || {};

  function clamp(v,a,b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }
  function emit(name, detail){
    try{ root.dispatchEvent(new CustomEvent(name, {detail})); }catch(_){}
  }

  // --- deterministic helpers (match style of groups.safe.js) ---
  function hashSeed(str){
    str = String(str ?? '');
    let h = 2166136261 >>> 0;
    for (let i=0;i<str.length;i++){
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function makeRng(seedU32){
    let s = (seedU32>>>0) || 1;
    return function(){
      s = (Math.imul(1664525, s) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  // --- coach tip (rate limit + explainable) ---
  function makeTipper(){
    let lastAt = 0;
    let lastMsg = '';
    return function tip(text, mood){
      const t = (root.performance && performance.now) ? performance.now() : Date.now();
      if (t - lastAt < 2200) return;             // rate limit
      text = String(text||'').trim();
      if (!text) return;
      if (text === lastMsg && (t - lastAt) < 6000) return;
      lastAt = t;
      lastMsg = text;
      emit('hha:coach', { text, mood: String(mood||'neutral') });
    };
  }

  // --- Director (fair) ---
  function makeDirector(seedStr){
    const rng = makeRng(hashSeed(seedStr + '::director'));
    let mood = 0; // 0 neutral, 1 push, -1 ease

    function spawnSpeedMul(accPct, combo, missHard){
      accPct = Number(accPct)||0;
      combo  = Number(combo)||0;
      missHard = Number(missHard)||0;

      // Fairness rules:
      // - ถ้าแม่น+คอมโบสูง → เร่งนิดหน่อย
      // - ถ้าพลาดหนักเยอะ → ผ่อนนิดหน่อย
      // - มี noise เล็กน้อยแบบ deterministic

      let mul = 1.0;

      // performance signals
      if (accPct >= 88) mul *= 0.94;
      else if (accPct >= 80) mul *= 0.97;
      else if (accPct <= 55) mul *= 1.08;

      if (combo >= 10) mul *= 0.92;
      else if (combo >= 6) mul *= 0.96;

      if (missHard >= 10) mul *= 1.10;
      else if (missHard >= 6) mul *= 1.06;

      // slow drift mood (deterministic)
      const n = rng();
      if (n < 0.02) mood = 1;
      else if (n > 0.98) mood = -1;
      if (mood === 1) mul *= 0.985;
      if (mood === -1) mul *= 1.015;

      // clamp
      mul = clamp(mul, 0.78, 1.18);
      return mul;
    }

    return { spawnSpeedMul };
  }

  // --- Pattern generator ---
  function makePattern(seedStr){
    const rng = makeRng(hashSeed(seedStr + '::pattern'));

    // pattern modes: zigzag / circle / corners
    const MODES = ['zigzag','circle','corners'];
    let mode = MODES[(rng()*MODES.length)|0];

    let step = 0;
    let angle = rng()*Math.PI*2;

    // change mode occasionally (deterministic)
    function maybeFlipMode(pressure, storm){
      const flipP = storm ? 0.06 : (pressure>=2 ? 0.045 : 0.025);
      if (rng() < flipP){
        mode = MODES[(rng()*MODES.length)|0];
        step = 0;
        angle = rng()*Math.PI*2;
      }
    }

    function nextPos(ctx){
      const R = ctx && ctx.R;
      if (!R) return null;

      const pressure = clamp(ctx.pressure||0,0,3)|0;
      const storm = !!ctx.storm;

      maybeFlipMode(pressure, storm);

      // padding inside playRect (avoid edges a bit)
      const pad = storm ? 10 : 14;
      const x0 = R.xMin + pad, x1 = R.xMax - pad;
      const y0 = R.yMin + pad, y1 = R.yMax - pad;

      const W = Math.max(40, x1 - x0);
      const H = Math.max(40, y1 - y0);

      let x, y;

      if (mode === 'zigzag'){
        // sweep left<->right, y moves downward then resets
        const cols = (pressure>=2 || storm) ? 4 : 3;
        const rows = (pressure>=2 || storm) ? 4 : 3;

        const c = step % cols;
        const r = ((step / cols)|0) % rows;

        const dir = (r % 2 === 0) ? 1 : -1;
        const cc = (dir === 1) ? c : (cols-1-c);

        x = x0 + (cc + 0.5 + (rng()-0.5)*0.18) * (W/cols);
        y = y0 + (r  + 0.5 + (rng()-0.5)*0.18) * (H/rows);

        step++;
      }
      else if (mode === 'circle'){
        // orbit around center with radius that shrinks a bit on pressure
        const cx = (x0+x1)*0.5;
        const cy = (y0+y1)*0.5;

        const baseR = Math.min(W,H) * (storm ? 0.28 : 0.32);
        const pr = baseR * (pressure===3 ? 0.78 : (pressure===2 ? 0.84 : (pressure===1 ? 0.92 : 1.0)));

        const dA = (storm ? 0.95 : 0.75) + (pressure*0.08);
        angle += dA;

        x = cx + Math.cos(angle) * pr + (rng()-0.5)*10;
        y = cy + Math.sin(angle) * pr + (rng()-0.5)*10;
      }
      else { // corners
        // hit corners/edges in a loop (but still inside safe rect)
        const pts = [
          [x0+W*0.15, y0+H*0.15],
          [x0+W*0.85, y0+H*0.18],
          [x0+W*0.82, y0+H*0.82],
          [x0+W*0.18, y0+H*0.86],
          [x0+W*0.50, y0+H*0.25],
          [x0+W*0.75, y0+H*0.50],
          [x0+W*0.50, y0+H*0.75],
          [x0+W*0.25, y0+H*0.50],
        ];

        const idx = step % (storm ? pts.length : 6);
        x = pts[idx][0] + (rng()-0.5)*12;
        y = pts[idx][1] + (rng()-0.5)*12;
        step++;
      }

      // clamp into playRect
      x = clamp(x, R.xMin, R.xMax);
      y = clamp(y, R.yMin, R.yMax);

      return { x, y, mode };
    }

    // optional bias hook (you already referenced bias() in safe.js; keep stable)
    function bias(){
      // small deterministic oscillation: push wrongRate up a hair when storm/pressure
      const t = rng();
      const b = (t - 0.5) * 0.04; // -0.02..+0.02
      return b;
    }

    return { nextPos, bias };
  }

  // --- public attach ---
  NS.AIHooks = NS.AIHooks || {};
  NS.AIHooks.attach = function attach(opts){
    opts = opts || {};
    const runMode = String(opts.runMode||'play').toLowerCase();
    const enabled = !!opts.enabled;

    // ✅ hard OFF for research/practice
    if (runMode !== 'play' || !enabled){
      // keep a stub so safe.js checks won't crash
      NS.__ai = { enabled:false, seed:String(opts.seed||''), director:null, pattern:null, tip:null };
      return NS.__ai;
    }

    const seedStr = String(opts.seed || Date.now());
    const tip = makeTipper();
    const director = makeDirector(seedStr);
    const pattern = makePattern(seedStr);

    const ai = NS.__ai = { enabled:true, seed:seedStr, director, pattern, tip };

    // announce once
    tip('AI เปิดแล้ว: รูปแบบเป้าจะมีแพตเทิร์น + ปรับความท้าทายแบบยุติธรรม 🤖', 'happy');
    emit('groups:progress', { kind:'ai_on', seed: seedStr });

    return ai;
  };

})(typeof window !== 'undefined' ? window : globalThis);