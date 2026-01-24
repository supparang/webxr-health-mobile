// === /herohealth/vr-groups/ai-hooks.js ===
// AI Hooks — PACK 8 (Prediction + Coach Tips + Norm + Deterministic Split)
// ✅ Enabled only if enabled=true AND runMode==='play' AND query ?ai=1 already gated in groups-vr.html
// ✅ Emits: ai:pred { risk01, pMissNext5, pScoreDropNext5, topReasons[], features, normMeta, fold }
// ✅ Optional coach micro-tips (rate-limited) via hha:coach (explainable)
// ✅ Stores: HHA_ML_GROUPS_NORM_LAST, HHA_ML_GROUPS_FOLD_LAST
//
// Optional model weights:
// localStorage key: HHA_GROUPS_AI_W
// format: JSON { b: number, w: {featureName:number,...} }
// If present -> logistic(b + sum(w_i * x_i))

(function(root){
  'use strict';

  const DOC = root.document;
  const NS = root.GroupsVR = root.GroupsVR || {};

  const LS_W   = 'HHA_GROUPS_AI_W';
  const LS_NORM= 'HHA_ML_GROUPS_NORM_LAST';
  const LS_FOLD= 'HHA_ML_GROUPS_FOLD_LAST';

  const clamp = (v,a,b)=>{ v=Number(v); if(!isFinite(v)) v=a; return v<a?a:(v>b?b:v); };
  const nowMs = ()=> (root.performance && performance.now) ? performance.now() : Date.now();

  function emit(name, detail){
    try{ root.dispatchEvent(new CustomEvent(name,{detail})); }catch(_){}
  }

  // ---- deterministic hash for fold split ----
  function hash32(str){
    str = String(str ?? '');
    let h = 2166136261 >>> 0;
    for (let i=0;i<str.length;i++){
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h>>>0;
  }

  function sigmoid(z){
    z = clamp(z, -12, 12);
    return 1/(1+Math.exp(-z));
  }

  function safeJsonParse(s, fallback){
    try{ return JSON.parse(s); }catch{ return fallback; }
  }

  // ---- online mean/std (Welford) ----
  function makeNorm(){
    return { n:0, mean:{}, m2:{} };
  }
  function normUpdate(N, vec){
    N.n++;
    for (const k in vec){
      const x = Number(vec[k]);
      if (!isFinite(x)) continue;
      const m = (N.mean[k] ?? 0);
      const d = x - m;
      const mNew = m + d / N.n;
      N.mean[k] = mNew;
      const m2 = (N.m2[k] ?? 0) + d*(x - mNew);
      N.m2[k] = m2;
    }
  }
  function normFinalize(N){
    const out = { n:N.n, mean:{}, std:{} };
    for (const k in N.mean){
      out.mean[k] = Number(N.mean[k] ?? 0);
      const v = (N.n>1) ? (Number(N.m2[k]||0) / (N.n-1)) : 0;
      out.std[k] = Math.max(1e-6, Math.sqrt(Math.max(0, v)));
    }
    return out;
  }
  function zscore(norm, vec){
    const z = {};
    for (const k in vec){
      const x = Number(vec[k]);
      if (!isFinite(x)) continue;
      const mu = Number(norm.mean?.[k] ?? 0);
      const sd = Number(norm.std?.[k] ?? 1);
      z[k] = (x - mu) / (sd || 1);
    }
    return z;
  }

  // ---- feature builder from stream ----
  function makeState(){
    return {
      enabled:false,
      runMode:'play',
      seed:'',
      view:'',
      diff:'',
      startAt: nowMs(),
      lastPredAt: 0,
      lastTipAt: 0,

      // rolling window (last 10s)
      buf: [],
      last: {
        left:0, score:0, combo:0, miss:0,
        acc:0, grade:'C',
        pressure:0,
        miniOn:false, miniLeft:0, miniNeed:0, miniNow:0,
        storm:false,
        groupName:'',
        groupKey:'',
      },

      normW: makeNorm(),
      fold: { k:5, fold:0, split:'train' },
    };
  }

  function pushBuf(S, tSec, snap){
    S.buf.push({ tSec, ...snap });
    // keep last 12 seconds
    const minT = tSec - 12;
    while(S.buf.length && S.buf[0].tSec < minT) S.buf.shift();
  }

  function deltaOver(S, key, sec){
    if (S.buf.length<2) return 0;
    const tNow = S.buf[S.buf.length-1].tSec;
    const tMin = tNow - sec;
    let older = null;
    for (let i=S.buf.length-1;i>=0;i--){
      if (S.buf[i].tSec <= tMin){ older = S.buf[i]; break; }
    }
    if (!older) older = S.buf[0];
    const now = S.buf[S.buf.length-1];
    return Number(now[key]||0) - Number(older[key]||0);
  }

  function slopeCombo(S){
    // combo trend last 5s
    const d = deltaOver(S,'combo',5);
    return clamp(d/5, -4, 4);
  }

  function buildFeatures(S){
    // engineered features (small, stable)
    const miss5  = deltaOver(S,'miss',5);
    const miss10 = deltaOver(S,'miss',10);
    const score5 = deltaOver(S,'score',5);
    const comboSlope = slopeCombo(S);

    const combo = Number(S.last.combo||0);
    const acc   = Number(S.last.acc||0);
    const press = Number(S.last.pressure||0);

    const miniOn = S.last.miniOn ? 1 : 0;
    const miniLeft = Number(S.last.miniLeft||0);
    const storm = S.last.storm ? 1 : 0;

    // normalized-ish primitives (0..1 range)
    const f = {
      miss5: miss5,
      miss10: miss10,
      score5: score5,
      combo: combo,
      acc: acc,
      pressure: press,
      comboSlope: comboSlope,
      miniOn: miniOn,
      miniLeft: miniLeft,
      storm: storm
    };
    return f;
  }

  function explainHeuristic(f){
    const reasons = [];
    if (f.miss5 >= 2) reasons.push(['miss5', 'พลาดช่วง 5 วิล่าสุดสูง']);
    if (f.pressure >= 2) reasons.push(['pressure', 'ระดับกดดันสูง']);
    if (f.acc <= 60) reasons.push(['acc', 'ความแม่นต่ำ']);
    if (f.comboSlope < -0.6) reasons.push(['comboSlope','คอมโบตกต่อเนื่อง']);
    if (f.miniOn && f.miniLeft <= 3) reasons.push(['mini','mini ใกล้หมดเวลา']);
    if (f.storm) reasons.push(['storm','อยู่ในช่วงพายุ']);
    return reasons.slice(0,3);
  }

  function heuristicPredict(f){
    // risk proxy (0..1) explainable
    // tuned for “เกมสนุก+กดดัน” ไม่ใช่โมเดลวิจัย
    let z = 0;
    z += 0.75 * clamp(f.miss5,0,6);
    z += 0.45 * clamp(f.miss10,0,10);
    z += 0.60 * clamp(f.pressure,0,3);
    z += 0.55 * clamp((70 - f.acc)/10, -2, 4);
    z += 0.30 * clamp(-f.comboSlope, 0, 3);
    z += f.storm ? 0.7 : 0;
    z += (f.miniOn && f.miniLeft<=3) ? 0.6 : 0;

    // map to 0..1
    const risk01 = sigmoid((z - 2.2) * 0.85);

    // pMissNext5 roughly tied to risk + recent miss
    const pMissNext5 = clamp(0.20 + 0.70*risk01 + 0.07*clamp(f.miss5,0,5), 0, 1);

    // score drop: when miss rises + wrong/junk likely (proxy via low acc + pressure)
    const pScoreDropNext5 = clamp(0.18 + 0.62*risk01 + 0.10*clamp((65 - f.acc)/10,0,3), 0, 1);

    return { risk01, pMissNext5, pScoreDropNext5, reasons: explainHeuristic(f) };
  }

  function logisticPredict(f, weights){
    // expects standardized features for stability
    const b = Number(weights?.b ?? 0);
    const w = weights?.w || {};
    let z = b;
    for (const k in w){
      z += Number(w[k]||0) * Number(f[k]||0);
    }
    const p = sigmoid(z);
    // map into multiple heads by simple transforms (placeholder)
    return {
      risk01: p,
      pMissNext5: clamp(0.15 + 0.85*p, 0, 1),
      pScoreDropNext5: clamp(0.12 + 0.78*p, 0, 1),
      reasons: [['model','ใช้โมเดล logistic-lite จาก localStorage']]
    };
  }

  function pickTip(pred){
    const r = pred.risk01 || 0;
    if (r >= 0.78) return { mood:'sad',   text:'เสี่ยงพลาดสูง! ช้าลงนิด แล้วเล็งให้ตรงหมู่ก่อนยิง 😤' };
    if (r >= 0.62) return { mood:'fever', text:'เริ่มเสี่ยง! โฟกัสหมู่เป้าหมาย + อย่ายิงมั่ว 🔥' };
    if (r >= 0.45) return { mood:'neutral', text:'คุมจังหวะดีๆ เล็งแล้วค่อยยิง จะคอมโบไหล ✨' };
    return null;
  }

  // ---------------- Public API ----------------
  const AIHooks = NS.AIHooks = NS.AIHooks || {};

  AIHooks.attach = function(cfg){
    const S = AIHooks._state || (AIHooks._state = makeState());

    S.enabled = !!cfg?.enabled;
    S.runMode = String(cfg?.runMode || 'play');
    S.seed    = String(cfg?.seed || '');
    S.view    = String(cfg?.view || '');
    S.diff    = String(cfg?.diff || '');

    // deterministic fold (k-fold)
    const k = 5;
    const h = hash32(`${S.seed}::${S.runMode}::${S.diff}::${S.view}`);
    const fold = (h % k)|0;
    const split = (fold===0) ? 'val' : 'train'; // simple rule (fold0=val)
    S.fold = { k, fold, split };

    try{ localStorage.setItem(LS_FOLD, JSON.stringify(S.fold)); }catch(_){}

    // listeners (idempotent)
    if (!AIHooks._wired){
      AIHooks._wired = true;

      root.addEventListener('hha:time', (ev)=>{
        const d = ev.detail||{};
        S.last.left = Number(d.left||0);
      }, {passive:true});

      root.addEventListener('hha:score', (ev)=>{
        const d = ev.detail||{};
        S.last.score = Number(d.score||0);
        S.last.combo = Number(d.combo||0);
        S.last.miss  = Number(d.misses||0);
      }, {passive:true});

      root.addEventListener('hha:rank', (ev)=>{
        const d = ev.detail||{};
        S.last.acc = Number(d.accuracy||0);
        S.last.grade = String(d.grade||'C');
      }, {passive:true});

      root.addEventListener('quest:update', (ev)=>{
        const d = ev.detail||{};
        S.last.groupName = String(d.groupName||'');
        S.last.groupKey  = String(d.groupKey||'');
        // mini state from quest:update
        S.last.miniOn   = !!(d.miniTimeLeftSec>0);
        S.last.miniLeft = Number(d.miniTimeLeftSec||0);
        S.last.miniNeed = Number(d.miniTotal||0);
        S.last.miniNow  = Number(d.miniNow||0);
      }, {passive:true});

      root.addEventListener('groups:progress', (ev)=>{
        const d = ev.detail||{};
        if (d.kind==='pressure') S.last.pressure = Number(d.level||0);
        if (d.kind==='storm_on') S.last.storm = true;
        if (d.kind==='storm_off') S.last.storm = false;
      }, {passive:true});
    }

    // start prediction loop
    AIHooks._startLoop();
  };

  AIHooks._startLoop = function(){
    const S = AIHooks._state;
    if (!S || !S.enabled) return;
    if (S.runMode !== 'play') return; // ✅ research/practice OFF

    if (AIHooks._loopOn) return;
    AIHooks._loopOn = true;

    const t0 = nowMs();
    const tick = ()=>{
      if (!AIHooks._loopOn) return;

      // stop if disabled mid-run
      if (!S.enabled || S.runMode!=='play'){
        AIHooks._loopOn = false;
        return;
      }

      const t = nowMs();
      const sec = Math.max(0, (t - t0)/1000);

      // snapshot for rolling buffer
      const snap = {
        left: S.last.left|0,
        score: S.last.score|0,
        combo: S.last.combo|0,
        miss: S.last.miss|0,
        acc: S.last.acc|0,
        pressure: S.last.pressure|0,
        miniOn: S.last.miniOn?1:0,
        miniLeft: S.last.miniLeft|0,
        storm: S.last.storm?1:0
      };
      pushBuf(S, sec, snap);

      // every 1s predict
      if (t - S.lastPredAt >= 1000){
        S.lastPredAt = t;

        const f = buildFeatures(S);

        // update norm with raw features (for training meta)
        normUpdate(S.normW, f);
        const normMeta = normFinalize(S.normW);
        try{ localStorage.setItem(LS_NORM, JSON.stringify(normMeta)); }catch(_){}

        // choose model
        const w = safeJsonParse((()=>{ try{return localStorage.getItem(LS_W)||'';}catch{return '';} })(), null);

        let pred;
        if (w && typeof w==='object' && w.w){
          // logistic-lite expects z-scored features
          const z = zscore(normMeta, f);
          pred = logisticPredict(z, w);
          pred.reasons = pred.reasons || [];
        }else{
          pred = heuristicPredict(f);
        }

        // attach fold + features for debugging
        emit('ai:pred', {
          risk01: pred.risk01,
          pMissNext5: pred.pMissNext5,
          pScoreDropNext5: pred.pScoreDropNext5,
          topReasons: (pred.reasons||[]).map(x=>({ key:x[0], why:x[1] })),
          features: f,
          normMeta,
          fold: S.fold,
          groupName: S.last.groupName,
          groupKey: S.last.groupKey
        });

        // micro-tip rate limit (every 6s)
        if (t - S.lastTipAt >= 6000){
          S.lastTipAt = t;
          const tip = pickTip(pred);
          if (tip){
            // explainable: include 1 reason
            const r0 = (pred.reasons && pred.reasons[0]) ? ` (${pred.reasons[0][1]})` : '';
            emit('hha:coach', { mood: tip.mood, text: tip.text + r0 });
          }
        }
      }

      setTimeout(tick, 120);
    };

    tick();
  };

  AIHooks.detach = function(){
    AIHooks._loopOn = false;
    if (AIHooks._state) AIHooks._state.enabled = false;
  };

})(typeof window!=='undefined' ? window : globalThis);