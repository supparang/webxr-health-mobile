/* === /herohealth/vr-groups/ai-hooks.js ===
GroupsVR AI Hooks — Prediction + Assist Burst (PLAY only)
✅ attach({ runMode, seed, enabled })
✅ enabled by default: OFF (only on with ?ai=1 and runMode=play)
✅ RESEARCH/PRACTICE: forced OFF
✅ Listens: hha:score, hha:rank, hha:time, groups:progress
✅ Outputs:
   - hha:coach micro-tips (rate-limited)
   - groups:progress {kind:'ai_warn', risk, reason}
   - groups:ai {type:'assist', hitMul, lifeMul, spawnMul, durationMs, reason}
*/

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if(!DOC) return;

  const NS = WIN.GroupsVR = WIN.GroupsVR || {};
  if (NS.AIHooks) return; // prevent double load

  function qs(k, def=null){
    try{ return new URL(location.href).searchParams.get(k) ?? def; }catch{ return def; }
  }
  function clamp(v,a,b){ v = Number(v); if(!isFinite(v)) v=a; return v<a?a:(v>b?b:v); }
  function nowMs(){ return (WIN.performance && performance.now) ? performance.now() : Date.now(); }
  function emit(name, detail){ try{ WIN.dispatchEvent(new CustomEvent(name,{detail})); }catch(_){} }

  function sigmoid(x){
    x = clamp(x, -8, 8);
    return 1 / (1 + Math.exp(-x));
  }

  // --- internal state ---
  const S = {
    enabled: false,
    runMode: 'play',
    seed: '',
    stormOn: false,

    // rolling stats
    lastAt: 0,
    lastMiss: 0,
    lastCombo: 0,
    lastAcc: 0,
    lastScore: 0,
    timeLeft: 999,

    // EWMA features (smooth)
    ewMissRate: 0,     // miss delta per sec
    ewComboBreak: 0,   // 0..1
    ewAccDrop: 0,      // 0..1
    ewPressure: 0,     // 0..1
    ewRisk: 0,         // 0..1

    // gating
    lastTipAt: 0,
    lastAssistAt: 0,
    assistOnUntil: 0,
  };

  function forceOff(){
    S.enabled = false;
  }

  function shouldEnableByParam(){
    const on = String(qs('ai','0')||'0').toLowerCase();
    return (on === '1' || on === 'true');
  }

  function tip(text, mood){
    const t = nowMs();
    if (t - S.lastTipAt < 3800) return;
    S.lastTipAt = t;
    emit('hha:coach', { text, mood: mood || 'neutral' });
  }

  function requestAssist(reason){
    const t = nowMs();
    if (t - S.lastAssistAt < 6500) return;           // กันถี่
    if (t < S.assistOnUntil) return;

    S.lastAssistAt = t;
    S.assistOnUntil = t + 2400;

    // assist burst: เล็กน้อยแต่รู้สึกได้
    emit('groups:ai', {
      type:'assist',
      reason: String(reason||'risk'),
      durationMs: 2400,
      hitMul: 1.14,     // hit radius +14%
      lifeMul: 1.12,    // target life +12%
      spawnMul: 1.18    // spawn slower +18% (every * 1.18)
    });
  }

  function computeRisk(){
    // feature normalization
    const missRate = clamp(S.ewMissRate * 1.15, 0, 1);         // 0..1
    const comboBreak = clamp(S.ewComboBreak, 0, 1);            // 0..1
    const accDrop = clamp(S.ewAccDrop, 0, 1);                  // 0..1
    const pressure = clamp(S.ewPressure, 0, 1);                // 0..1
    const storm = S.stormOn ? 1 : 0;
    const clutch = (S.timeLeft <= 8) ? 1 : 0;

    // lightweight “ML-ish” linear model
    // (ตั้งน้ำหนักให้ตอบสนองดีในเกมเด็ก: miss trend + combo break สำคัญสุด)
    const z =
      (-1.35) +
      ( 2.10 * missRate) +
      ( 1.55 * comboBreak) +
      ( 1.10 * accDrop) +
      ( 0.75 * pressure) +
      ( 0.60 * storm) +
      ( 0.45 * clutch);

    const risk = sigmoid(z);
    // smooth risk
    S.ewRisk = (S.ewRisk * 0.70) + (risk * 0.30);
    return S.ewRisk;
  }

  function updatePressureHeuristic(){
    // pressure approx from misses (ยึดแนวเดียวกับ engine)
    const m = S.lastMiss|0;
    let p = 0;
    if (m >= 14) p = 1.0;
    else if (m >= 9) p = 0.72;
    else if (m >= 5) p = 0.45;
    else p = 0.10;
    S.ewPressure = (S.ewPressure*0.78) + (p*0.22);
  }

  function onScore(ev){
    if (!S.enabled) return;
    if (S.runMode !== 'play') return;

    const d = ev.detail || {};
    const t = nowMs();
    const dt = Math.max(0.2, (t - (S.lastAt || t)) / 1000);

    const score = Number(d.score ?? 0);
    const combo = Number(d.combo ?? 0);
    const miss  = Number(d.misses ?? 0);

    const dMiss = Math.max(0, miss - (S.lastMiss||0));
    const missRate = clamp(dMiss / dt, 0, 2.0); // misses per sec (clamp)
    S.ewMissRate = (S.ewMissRate*0.72) + ((missRate/2.0)*0.28); // normalize ~0..1

    // combo break detect (combo goes to 0 from >0)
    const broke = ((S.lastCombo||0) >= 3 && combo === 0) ? 1 : 0;
    S.ewComboBreak = (S.ewComboBreak*0.78) + (broke*0.22);

    S.lastScore = score;
    S.lastCombo = combo;
    S.lastMiss = miss;
    S.lastAt = t;

    updatePressureHeuristic();

    const risk = computeRisk();

    // actions (thresholds)
    if (risk >= 0.78){
      emit('groups:progress', { kind:'ai_warn', risk: Math.round(risk*100), reason:'high_risk' });
      tip('🧠 AI: ช้าลงนิด เล็งให้ชัวร์ก่อนยิงนะ!', 'fever');
      requestAssist('high_risk');
    } else if (risk >= 0.62){
      emit('groups:progress', { kind:'ai_warn', risk: Math.round(risk*100), reason:'mid_risk' });
      tip('🧠 AI: ระวังยิงมั่ว—โฟกัสหมู่ที่ถูก!', 'neutral');
    }
  }

  function onRank(ev){
    if (!S.enabled) return;
    if (S.runMode !== 'play') return;
    const d = ev.detail || {};
    const acc = Number(d.accuracy ?? 0);
    const prev = Number(S.lastAcc ?? acc);

    // accuracy drop feature
    const drop = clamp((prev - acc)/18, 0, 1); // 18% drop -> 1
    S.ewAccDrop = (S.ewAccDrop*0.76) + (drop*0.24);
    S.lastAcc = acc;
  }

  function onTime(ev){
    if (!S.enabled) return;
    const d = ev.detail || {};
    S.timeLeft = Number(d.left ?? 999);
  }

  function onProgress(ev){
    if (!S.enabled) return;
    const d = ev.detail || {};
    const k = String(d.kind||'');
    if (k === 'storm_on') S.stormOn = true;
    if (k === 'storm_off') S.stormOn = false;
  }

  function attach(opts){
    opts = opts || {};
    const rm = String(opts.runMode||'play').toLowerCase();
    S.runMode = (rm === 'research' || rm === 'practice') ? rm : 'play';
    S.seed = String(opts.seed||'');

    // forced off for research/practice
    if (S.runMode !== 'play') {
      forceOff();
      return;
    }

    // must be enabled param + attach enabled
    const en = !!opts.enabled && shouldEnableByParam();
    S.enabled = en;

    // reset small state
    S.stormOn = false;
    S.lastAt = 0;
    S.lastTipAt = 0;
    S.lastAssistAt = 0;
    S.assistOnUntil = 0;

    S.lastMiss = 0;
    S.lastCombo = 0;
    S.lastAcc = 0;
    S.lastScore = 0;
    S.timeLeft = 999;

    S.ewMissRate = 0;
    S.ewComboBreak = 0;
    S.ewAccDrop = 0;
    S.ewPressure = 0;
    S.ewRisk = 0;

    // bind listeners once
    if (!NS.__AIHOOKS_BOUND__){
      NS.__AIHOOKS_BOUND__ = true;
      WIN.addEventListener('hha:score', onScore, {passive:true});
      WIN.addEventListener('hha:rank',  onRank,  {passive:true});
      WIN.addEventListener('hha:time',  onTime,  {passive:true});
      WIN.addEventListener('groups:progress', onProgress, {passive:true});
    }

    if (S.enabled){
      tip('🧠 AI เปิดแล้ว! ถ้าเริ่มพลาด AI จะช่วยเตือน + ช่วยเล็งนิดนึง', 'happy');
    }
  }

  NS.AIHooks = { attach };
})();