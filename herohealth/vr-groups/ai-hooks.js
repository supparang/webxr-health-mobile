// === /herohealth/vr-groups/ai-hooks.js ===
// AI Hooks (PRODUCTION-ish, SAFE)
// ✅ play only + gated by ?ai=1
// ✅ research/practice: OFF hard
// ✅ Online-learning Logistic Regression (deterministic, no random)
// ✅ Outputs gentle Difficulty Director adjustments via event: groups:ai_adjust
// ✅ Persists weights to localStorage (play only)

(function(root){
  'use strict';

  const DOC = root.document;
  const NS = root.GroupsVR = root.GroupsVR || {};

  function qs(k, def=null){
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  }

  function nowMs(){ return (root.performance && performance.now) ? performance.now() : Date.now(); }
  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
  function sigmoid(x){ return 1/(1+Math.exp(-x)); }

  const LS_W = 'HHA_GROUPS_AI_W';   // weights store
  const LS_S = 'HHA_GROUPS_AI_S';   // state store (optional)

  // -----------------------
  // Online Logistic Model
  // -----------------------
  const MODEL = {
    w: [ 1.05, 0.95, -0.30, 0.45, 0.55, 0.45, 0.35 ], // sensible defaults
    b: -0.55,
    lr: 0.08,
    l2: 0.0008,
  };

  function loadModel(){
    try{
      const obj = JSON.parse(localStorage.getItem(LS_W)||'null');
      if (obj && Array.isArray(obj.w) && typeof obj.b === 'number'){
        if (obj.w.length === MODEL.w.length){
          MODEL.w = obj.w.map(Number);
          MODEL.b = Number(obj.b);
        }
      }
    }catch(_){}
  }
  function saveModel(){
    try{
      localStorage.setItem(LS_W, JSON.stringify({ w: MODEL.w, b: MODEL.b, t: new Date().toISOString() }));
    }catch(_){}
  }

  function predict(x){
    // x length 7
    let z = MODEL.b;
    for (let i=0;i<MODEL.w.length;i++){
      z += MODEL.w[i] * (Number(x[i])||0);
    }
    return sigmoid(z);
  }

  function trainOne(x, y){
    // y in {0,1}
    const p = predict(x);
    const err = (p - (y?1:0)); // dL/dz for logloss
    // SGD + L2 (deterministic)
    for (let i=0;i<MODEL.w.length;i++){
      const xi = Number(x[i])||0;
      MODEL.w[i] -= MODEL.lr * (err*xi + MODEL.l2*MODEL.w[i]);
    }
    MODEL.b -= MODEL.lr * err;
  }

  // -----------------------
  // Feature extraction buffer
  // -----------------------
  const BUF = {
    on:false,
    runMode:'play',
    enabled:false,
    seed:'',
    lastTick:0,
    lastAdjAt:0,

    // HUD-like signals
    score:0, combo:0, miss:0, acc:0, left:90,
    storm:0, miniUrg:0, pressure:0,

    // history for miss-rate
    hist: [], // {t, miss}
    maxHist: 30,

    // label queue: detect "bad outcome" soon after
    badHits: 0,
    badWindowUntil: 0
  };

  function aiAllowed(cfg){
    const run = String(cfg.runMode||'play').toLowerCase();
    if (run === 'research' || run === 'practice') return false;

    const ai = String(qs('ai','0')||'0').toLowerCase();
    return (ai === '1' || ai === 'true');
  }

  function pushMissHist(){
    const t = nowMs();
    BUF.hist.push({ t, miss: BUF.miss|0 });
    if (BUF.hist.length > BUF.maxHist) BUF.hist.shift();
  }

  function missRate10s(){
    const t = nowMs();
    const cut = t - 10000;
    const a = BUF.hist.filter(x=>x.t>=cut);
    if (a.length < 2) return 0;
    const dm = (a[a.length-1].miss - a[0].miss);
    return Math.max(0, dm) / 10; // miss/sec
  }

  function buildX(){
    const mr = clamp(missRate10s()*2.2, 0, 1);       // missRateNorm
    const ab = clamp((100 - (BUF.acc|0))/100, 0, 1); // accBad
    const cn = clamp((BUF.combo|0)/10, 0, 1);        // comboNorm
    const ll = clamp((12 - (BUF.left|0))/12, 0, 1);  // leftLow
    const st = BUF.storm ? 1 : 0;
    const mu = BUF.miniUrg ? 1 : 0;
    const pr = clamp((BUF.pressure|0)/3, 0, 1);
    return [mr, ab, cn, ll, st, mu, pr];
  }

  // -----------------------
  // Difficulty Director (gentle & smooth)
  // -----------------------
  const DIRECTOR = {
    spawnMul: 1.00,  // >1 = spawn slower, <1 = faster
    sizeMul:  1.00,  // >1 = bigger targets
    lastRisk: 0
  };

  function emitAdjust(reason){
    try{
      root.dispatchEvent(new CustomEvent('groups:ai_adjust', {
        detail:{
          spawnMul: Math.round(DIRECTOR.spawnMul*1000)/1000,
          sizeMul:  Math.round(DIRECTOR.sizeMul*1000)/1000,
          risk: Math.round(DIRECTOR.lastRisk*100)/100,
          reason: String(reason||'')
        }
      }));
    }catch(_){}
  }

  function smoothToward(cur, target, k){
    return cur + (target - cur) * clamp(k, 0.05, 0.6);
  }

  function tick(){
    if (!BUF.on) return;

    pushMissHist();
    const x = buildX();
    const r = predict(x);
    DIRECTOR.lastRisk = r;

    // ---------- label (self-supervised) ----------
    // หากใน 1.6s ถัดไปเกิด bad/miss หลายครั้ง => y=1
    const t = nowMs();
    const y = (t <= BUF.badWindowUntil && BUF.badHits >= 1) ? 1 : 0;

    // train เฉพาะช่วงมี label (ไม่ฝึกมั่ว)
    // ฝึกเมื่อ "หน้าต่าง" ปิด หรือ risk สูงมาก
    if (BUF.badWindowUntil && t > BUF.badWindowUntil){
      // ถ้าช่วงนั้นมี badHits >=1 => y=1 else y=0
      const yy = (BUF.badHits >= 1) ? 1 : 0;
      trainOne(x, yy);
      BUF.badHits = 0;
      BUF.badWindowUntil = 0;
      saveModel();
    }

    // ---------- director targets ----------
    // กติกาแฟร์:
    // - risk สูง: ผ่อนให้เล็กน้อย (spawn ช้าลง + size ใหญ่ขึ้นนิด)
    // - risk ต่ำ + performance ดี: เพิ่มความท้าทายเบา ๆ
    // จำกัดกรอบ:
    // spawnMul: 0.90..1.12 (±12%)
    // sizeMul : 0.96..1.08 (±8%)

    let targetSpawn = 1.00;
    let targetSize  = 1.00;

    const goodPerf = (BUF.acc >= 82 && BUF.combo >= 6 && BUF.pressure <= 1);
    const trouble  = (r >= 0.78) || (BUF.pressure >= 2) || (missRate10s() >= 0.25);

    if (trouble){
      // ช่วยให้ “กลับเข้าฟอร์ม”
      targetSpawn = 1.07 + (r-0.78)*0.10; // up to ~1.10
      targetSize  = 1.04 + (r-0.78)*0.08; // up to ~1.08
    } else if (goodPerf && r <= 0.35){
      // เร้าใจขึ้นเบา ๆ
      targetSpawn = 0.95;
      targetSize  = 0.985;
    } else if (r <= 0.55){
      targetSpawn = 0.99;
      targetSize  = 1.00;
    }

    targetSpawn = clamp(targetSpawn, 0.90, 1.12);
    targetSize  = clamp(targetSize,  0.96, 1.08);

    // smooth
    DIRECTOR.spawnMul = smoothToward(DIRECTOR.spawnMul, targetSpawn, 0.18);
    DIRECTOR.sizeMul  = smoothToward(DIRECTOR.sizeMul,  targetSize,  0.18);

    // rate-limit adjust event
    if (t - BUF.lastAdjAt > 700){
      BUF.lastAdjAt = t;
      emitAdjust(trouble ? 'trouble' : (goodPerf ? 'good' : 'mid'));
    }

    // เริ่มหน้าต่าง label เมื่อ risk สูง
    if (r >= 0.78 && !BUF.badWindowUntil){
      BUF.badWindowUntil = t + 1600;
      BUF.badHits = 0;
    }
  }

  let it = 0;
  function start(){
    clearInterval(it);
    BUF.lastTick = nowMs();
    it = setInterval(tick, 700);
  }
  function stop(){
    clearInterval(it);
    it = 0;
  }

  // -----------------------
  // Event listeners (lightweight)
  // -----------------------
  root.addEventListener('hha:score', (ev)=>{
    const d = ev.detail||{};
    BUF.score = Number(d.score ?? BUF.score) || 0;
    BUF.combo = Number(d.combo ?? BUF.combo) || 0;
    BUF.miss  = Number(d.misses ?? BUF.miss) || 0;
  }, { passive:true });

  root.addEventListener('hha:time', (ev)=>{
    const d = ev.detail||{};
    BUF.left = Math.max(0, Math.round(d.left ?? BUF.left));
  }, { passive:true });

  root.addEventListener('hha:rank', (ev)=>{
    const d = ev.detail||{};
    BUF.acc = Number(d.accuracy ?? BUF.acc) || 0;
  }, { passive:true });

  root.addEventListener('groups:progress', (ev)=>{
    const d = ev.detail||{};
    const k = String(d.kind||'');
    if (k === 'storm_on') BUF.storm = 1;
    if (k === 'storm_off') BUF.storm = 0;
    if (k === 'pressure') BUF.pressure = Number(d.level||0) || 0;
    if (k === 'miss'){
      // bad signal for labeling
      if (BUF.badWindowUntil){
        BUF.badHits++;
      }
    }
  }, { passive:true });

  root.addEventListener('quest:update', (ev)=>{
    const d = ev.detail||{};
    const left = Number(d.miniTimeLeftSec||0);
    BUF.miniUrg = (left > 0 && left <= 3) ? 1 : 0;
  }, { passive:true });

  root.addEventListener('hha:judge', (ev)=>{
    const d = ev.detail||{};
    const k = String(d.kind||'');
    // ถือว่า bad outcome
    if (k === 'bad' || k === 'miss'){
      if (BUF.badWindowUntil){
        BUF.badHits++;
      }
    }
  }, { passive:true });

  // -----------------------
  // Public API
  // -----------------------
  NS.AIHooks = {
    attach(cfg){
      cfg = cfg || {};
      BUF.runMode = String(cfg.runMode||'play').toLowerCase();
      BUF.seed = String(cfg.seed||'');
      BUF.enabled = !!cfg.enabled;

      BUF.on = BUF.enabled && aiAllowed({ runMode: BUF.runMode });
      if (!BUF.on){
        stop();
        return;
      }

      loadModel();
      start();
    },
    getState(){
      return {
        on: BUF.on,
        spawnMul: DIRECTOR.spawnMul,
        sizeMul: DIRECTOR.sizeMul,
        risk: DIRECTOR.lastRisk
      };
    }
  };

})(typeof window !== 'undefined' ? window : globalThis);