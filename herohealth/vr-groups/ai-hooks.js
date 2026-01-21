/* === /herohealth/vr-groups/ai-hooks.js ===
AI Hooks (Play-only) — PACK 15 + PACK 6-8 Runtime Predict
✅ Enabled only when ?ai=1 AND run=play
⛔ Forced OFF when run=research or run=practice
✅ Listens: groups:ml_tick (from groups.safe.js)
✅ Maintains rolling 3s window: event counts + tick means
✅ Predict risk_bad_next2s (heuristic fallback OR linear weights)
✅ Fair assist: adjusts engine.aiAssistMul briefly (play only)
✅ Coach tips rate-limited (explainable micro-tips)
*/

(function(root){
  'use strict';
  const DOC = document;
  const NS = root.GroupsVR = root.GroupsVR || {};

  function qs(k, def=null){
    try{ return new URL(location.href).searchParams.get(k) ?? def; }
    catch{ return def; }
  }
  function clamp(v,a,b){ v=Number(v); if(!isFinite(v)) v=a; return v<a?a:(v>b?b:v); }
  function nowMs(){ return (root.performance && performance.now) ? performance.now() : Date.now(); }

  function aiEnabledByParam(runMode){
    if (String(runMode||'').toLowerCase() !== 'play') return false;
    const on = String(qs('ai','0')||'0').toLowerCase();
    return (on==='1' || on==='true' || on==='yes');
  }

  // ---- Runtime model slot (optional weights) ----
  // You can later paste trained weights into localStorage:
  // localStorage.setItem('HHA_GROUPS_AI_WEIGHTS', JSON.stringify({bias:..., w:{col:weight,...}}))
  // And optional metadata:
  // localStorage.setItem('HHA_GROUPS_SEQ_METADATA', JSON.stringify(metadataJson))
  const LS_W = 'HHA_GROUPS_AI_WEIGHTS';
  const LS_M = 'HHA_GROUPS_SEQ_METADATA';

  function loadWeights(){
    try{
      const raw = localStorage.getItem(LS_W);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (!obj || typeof obj !== 'object') return null;
      if (!obj.w || typeof obj.w !== 'object') return null;
      return obj;
    }catch{ return null; }
  }

  function loadMeta(){
    try{
      const raw = localStorage.getItem(LS_M);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (!obj || typeof obj !== 'object') return null;
      if (!obj.stats || typeof obj.stats !== 'object') return null;
      return obj;
    }catch{ return null; }
  }

  function sigmoid(x){
    x = clamp(x, -30, 30);
    return 1 / (1 + Math.exp(-x));
  }

  function zNorm(val, stat){
    if (!stat) return Number(val)||0;
    const mean = Number(stat.mean)||0;
    const std  = Math.max(1e-6, Number(stat.std)||0);
    return (Number(val)||0 - mean) / std;
  }

  // ---- Rolling window buffer (3s) ----
  const WIN_MS = 3000;

  const buf = []; // {t, tick, evBad, evShootMiss, evHitGood, evComboBreak}
  let lastRisk = 0;
  let lastTipAt = 0;
  let assistUntil = 0;

  function pushTick(tk){
    const t = Number(tk.t||0)||0;
    buf.push({ t, tk });

    // trim
    const minT = t - WIN_MS;
    while (buf.length && buf[0].t < minT) buf.shift();
  }

  // ---- counts from window: we derive from tick deltas (cheap & stable)
  // We'll approximate recent "bad" via misses delta + combo reset patterns
  // BUT if your ML logger emits richer events, you can swap later easily.
  let prev = null;

  function deriveWindowFeatures(cur){
    // Window mean from ticks (true mean)
    let n = 0;
    let sumTargets=0, sumPressure=0, sumStorm=0, sumAi=0, sumCombo=0, sumScore=0, sumAcc=0;

    // event-like signals from deltas across window
    let badCount = 0;
    let shootMissCount = 0;
    let hitGoodCount = 0;
    let comboBreaks = 0;

    // walk buffer
    for (let i=0;i<buf.length;i++){
      const tk = buf[i].tk || {};
      n++;
      sumTargets += Number(tk.nTargets||0)||0;
      sumPressure += Number(tk.pressure||0)||0;
      sumStorm += (tk.stormOn?1:0);
      sumAi += (tk.aiAssistOn?1:0);
      sumCombo += Number(tk.combo||0)||0;
      sumScore += Number(tk.score||0)||0;
      sumAcc += Number(tk.acc||0)||0;

      // delta-based event approximations
      const prevTk = (i>0) ? (buf[i-1].tk||{}) : null;
      if (prevTk){
        const dMiss = (Number(tk.misses||0)||0) - (Number(prevTk.misses||0)||0);
        if (dMiss > 0) badCount += dMiss;

        // combo break pattern: combo goes from >0 to 0
        const c0 = Number(prevTk.combo||0)||0;
        const c1 = Number(tk.combo||0)||0;
        if (c0 >= 2 && c1 === 0) comboBreaks += 1;

        // hitGood proxy: score jump + combo inc (rough)
        const ds = (Number(tk.score||0)||0) - (Number(prevTk.score||0)||0);
        if (ds >= 18 && c1 > c0) hitGoodCount += 1;

        // shoot miss: combo reset but no miss increment and no score drop (rough)
        if (c0 >= 1 && c1 === 0 && dMiss === 0 && ds === 0) shootMissCount += 1;
      }
    }

    const denom = Math.max(1,n);
    const w3_targetDensity = Math.round((sumTargets/denom)*1000)/1000;
    const w3_pressureAvg   = Math.round((sumPressure/denom)*1000)/1000;
    const w3_stormFrac     = Math.round((sumStorm/denom)*1000)/1000;
    const w3_aiAssistFrac  = Math.round((sumAi/denom)*1000)/1000;
    const w3_comboAvg      = Math.round((sumCombo/denom)*1000)/1000;
    const w3_scoreMean     = Math.round((sumScore/denom)*1000)/1000;
    const w3_accMean       = Math.round((sumAcc/denom)*1000)/1000;

    const shotsApprox = Math.max(1, hitGoodCount + shootMissCount + badCount);
    const w3_hitRate = Math.round((hitGoodCount/shotsApprox)*1000)/1000;
    const w3_mistakeRate = Math.round((badCount/shotsApprox)*1000)/1000;
    const w3_shootMissRate = Math.round((shootMissCount/shotsApprox)*1000)/1000;

    return {
      // current snapshot essentials
      pressure: Number(cur.pressure||0)||0,
      stormOn: cur.stormOn?1:0,
      combo: Number(cur.combo||0)||0,
      misses: Number(cur.misses||0)||0,
      acc: Number(cur.acc||0)||0,
      nTargets: Number(cur.nTargets||0)||0,

      // window means
      w3_targetDensity,
      w3_pressureAvg,
      w3_stormFrac,
      w3_aiAssistFrac,
      w3_comboAvg,
      w3_scoreMean,
      w3_accMean,

      // window counts/rates (approx)
      w3_hitGood: hitGoodCount,
      w3_hitRate,
      w3_mistakes: badCount,
      w3_mistakeRate,
      w3_shootMiss: shootMissCount,
      w3_shootMissRate,
      w3_comboBreaks: comboBreaks
    };
  }

  function predictRiskBadNext2s(feat){
    // 1) If weights+meta exist -> linear model
    const W = loadWeights();
    const M = loadMeta();

    if (W && W.w){
      const stats = M && M.stats ? M.stats : {};
      let z = Number(W.bias||0)||0;

      // apply weights over provided features (only those in weights)
      for (const k in W.w){
        const w = Number(W.w[k])||0;
        if (!isFinite(w) || w===0) continue;
        const x = zNorm(feat[k], stats ? stats[k] : null);
        z += w * x;
      }
      return sigmoid(z);
    }

    // 2) Fallback heuristic (explainable, stable)
    // risk grows with: pressure/window mistakes/storm/low acc/recent combo breaks
    let r = 0.08;

    r += 0.12 * clamp(feat.w3_pressureAvg/3, 0, 1);
    r += 0.18 * clamp(feat.w3_mistakeRate*2.2, 0, 1);
    r += 0.10 * (feat.w3_stormFrac > 0.25 ? 1 : 0);
    r += 0.10 * (feat.w3_comboBreaks >= 1 ? 1 : 0);

    const accPenalty = clamp((80 - (feat.w3_accMean||0))/50, 0, 1);
    r += 0.14 * accPenalty;

    const targetLoad = clamp((feat.w3_targetDensity||0)/10, 0, 1);
    r += 0.06 * targetLoad;

    // clamp
    return clamp(r, 0, 0.96);
  }

  function rateLimitTip(ms){
    const t = nowMs();
    if (t - lastTipAt < ms) return false;
    lastTipAt = t;
    return true;
  }

  function emitCoach(text, mood){
    try{
      root.dispatchEvent(new CustomEvent('hha:coach', { detail:{ text, mood } }));
    }catch(_){}
  }

  function setAssistMul(mul, holdMs){
    const E = NS && NS.GameEngine;
    if (!E || typeof E !== 'object') return;

    // play-only safety
    try{
      const rm = (E.cfg && E.cfg.runMode) ? String(E.cfg.runMode) : '';
      if (rm !== 'play') return;
    }catch(_){}

    E.aiAssistMul = clamp(mul, 1.0, 1.22);
    assistUntil = nowMs() + clamp(holdMs||900, 250, 2200);
  }

  function maybeReleaseAssist(){
    const t = nowMs();
    if (assistUntil && t >= assistUntil){
      assistUntil = 0;
      const E = NS && NS.GameEngine;
      if (E && E.cfg && E.cfg.runMode==='play') E.aiAssistMul = 1.0;
    }
  }

  function onLiveTick(ev){
    const tk = (ev && ev.detail) ? ev.detail : null;
    if (!tk) return;

    const runMode = String(tk.runMode||'play').toLowerCase();
    if (runMode !== 'play') return; // ⛔ hard off for research/practice

    const enabled = aiEnabledByParam(runMode);
    if (!enabled) return;

    pushTick(tk);
    maybeReleaseAssist();

    const feat = deriveWindowFeatures(tk);
    const risk = predictRiskBadNext2s(feat);
    lastRisk = risk;

    // Broadcast (optional UI/telemetry)
    try{
      root.dispatchEvent(new CustomEvent('groups:ai', {
        detail:{
          risk_bad_next2s: Math.round(risk*1000)/1000,
          w3_pressureAvg: feat.w3_pressureAvg,
          w3_mistakeRate: feat.w3_mistakeRate,
          w3_stormFrac: feat.w3_stormFrac
        }
      }));
    }catch(_){}

    // Policy: micro-tips + light assist when risk high
    if (risk >= 0.72){
      setAssistMul(1.16, 1100); // tiny boost, short time
      if (rateLimitTip(4200)){
        const why = [];
        if (feat.w3_mistakeRate >= 0.35) why.push('ยิงพลาดถี่');
        if (feat.w3_stormFrac >= 0.25) why.push('กำลังพายุ');
        if (feat.w3_pressureAvg >= 2) why.push('ความกดดันสูง');
        if ((feat.w3_accMean||0) < 70) why.push('ความแม่นต่ำ');

        emitCoach(
          `AI เตือน: มีโอกาสพลาดใน 2 วิข้างหน้า 🔮 (${Math.round(risk*100)}%) — ` +
          (why.length ? `สาเหตุ: ${why.join(', ')} • ` : '') +
          `ทริค: หยุด 0.5 วิ เล็ง “ตรงหมู่” แล้วค่อยยิง 🎯`,
          'neutral'
        );
      }
      return;
    }

    if (risk >= 0.58){
      // softer assist + no spam tips
      setAssistMul(1.10, 850);
      if (rateLimitTip(5200) && feat.w3_comboBreaks >= 1){
        emitCoach('AI: คอมโบขาดเมื่อกี้! ช้าลงนิดแล้วเล็งก่อนยิง 🧠', 'neutral');
      }
      return;
    }

    // Low risk -> ensure assist back to normal
    // (release happens via timer; but if very low risk we can shorten)
    if (risk <= 0.25){
      assistUntil = 0;
      const E = NS && NS.GameEngine;
      if (E && E.cfg && E.cfg.runMode==='play') E.aiAssistMul = 1.0;
    }
  }

  // ---- attach API (called from groups-vr.html already) ----
  const API = {
    enabled:false,
    attach(opts){
      try{
        const runMode = String(opts && opts.runMode || 'play').toLowerCase();
        if (runMode !== 'play') { API.enabled=false; return; }
        const ok = !!(opts && opts.enabled);
        API.enabled = ok;
        if (!ok) return;

        // listen live tick
        root.addEventListener('groups:ml_tick', onLiveTick, { passive:true });

        // greet once
        emitCoach('AI Prediction พร้อมแล้ว ✅ (โหมดเล่น) — ถ้าเริ่มพลาด ระบบจะเตือนก่อนพลาด', 'happy');
      }catch(_){}
    },
    getRisk(){ return lastRisk; },
    // helper to store meta/weights quickly
    saveMetadata(metaObj){
      try{ localStorage.setItem(LS_M, JSON.stringify(metaObj)); return true; }catch{ return false; }
    },
    saveWeights(weightsObj){
      try{ localStorage.setItem(LS_W, JSON.stringify(weightsObj)); return true; }catch{ return false; }
    },
    clearModel(){
      try{ localStorage.removeItem(LS_W); localStorage.removeItem(LS_M); }catch(_){}
    }
  };

  NS.AIHooks = API;

})(window);