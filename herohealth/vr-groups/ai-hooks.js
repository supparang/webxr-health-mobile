// === /herohealth/vr-groups/ai-hooks.js ===
// AI Hooks (GroupsVR) — Prediction + Feature Engineering (v3)
// ✅ Enabled only when caller passes enabled=true (run=play & ai=1)
// ✅ Research/Practice: OFF (caller)
// ✅ Emits: ai:risk, ai:tip
// ✅ Dataset rows include engineered features: EMA + deltas + rolling stats
// ✅ Labels last 3s frames when MISS happens

(function(root){
  'use strict';
  const NS = root.GroupsVR = root.GroupsVR || {};

  const LS_DATA = 'HHA_GROUPS_ML_DATASET';
  const MAX_ROWS = 5000;
  const LABEL_WINDOW_MS = 3000;

  const TIP_COOLDOWN_MS = 4500;
  const TIP_RISK_TH = 70;

  const nowMs = ()=> (root.performance && performance.now) ? performance.now() : Date.now();
  const clamp=(v,a,b)=>{ v=+v||0; return v<a?a:(v>b?b:v); };

  function safeParse(json, def){ try{ return JSON.parse(json); }catch{ return def; } }
  function safeSetLS(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch{} }
  function safeGetLS(k, def){ try{ return safeParse(localStorage.getItem(k)||'', def); }catch{ return def; } }
  function emit(name, detail){ try{ root.dispatchEvent(new CustomEvent(name,{detail})); }catch{} }

  // ---- pending buffer ----
  const buf = [];
  function pushFrame(row){
    buf.push(row);
    const cut = row.tMs - 12000;
    while(buf.length && buf[0].tMs < cut) buf.shift();
  }
  function labelRecentMiss(missKind, tMs){
    const from = tMs - LABEL_WINDOW_MS;
    for(let i=buf.length-1;i>=0;i--){
      const r = buf[i];
      if (r.tMs < from) break;
      r.label = 1;
      r.missKind = missKind;
    }
  }
  function flushToDataset(){
    const dataset = safeGetLS(LS_DATA, []);
    const t = nowMs();
    const finalizeBefore = t - 3500;

    let moved = 0;
    for(let i=0;i<buf.length;){
      const r = buf[i];
      if (r.tMs <= finalizeBefore){
        const out = Object.assign({}, r);
        if (out.label == null) out.label = 0;
        dataset.push(out);
        buf.splice(i,1);
        moved++;
      }else i++;
    }
    if (moved){
      if (dataset.length > MAX_ROWS) dataset.splice(0, dataset.length - MAX_ROWS);
      safeSetLS(LS_DATA, dataset);
    }
  }

  // ---- risk model ----
  function riskFrom(d){
    const acc = clamp((d.accGoodPct||0)/100, 0, 1);
    const pressure = clamp((d.pressure||0)/3, 0, 1);
    const missRate = clamp((d.misses||0)/18, 0, 1);
    const storm = d.stormOn ? 1 : 0;
    const mini = d.miniOn ? 1 : 0;
    const onscreen = clamp((d.targetsOnScreen||0)/12, 0, 1);
    const comboLow = (d.combo||0) <= 1 ? 1 : 0;

    const z =
      (+0.9*(1-acc)) +
      (+1.2*pressure) +
      (+0.9*missRate) +
      (+0.45*storm) +
      (+0.35*mini) +
      (+0.35*onscreen) +
      (+0.25*comboLow);

    const risk = 100 * (1 - Math.exp(-z));
    const reasons = [];
    if (acc < 0.65) reasons.push('ACC ต่ำ');
    if (pressure > 0.34) reasons.push('PRESSURE สูง');
    if (storm) reasons.push('STORM');
    if (mini) reasons.push('MINI');
    if (onscreen > 0.55) reasons.push('เป้าเยอะ');
    if (comboLow) reasons.push('คอมโบหลุด');

    return { riskPct: clamp(risk, 0, 100), reasons };
  }

  // ---- tips ----
  let lastTipAt = 0;
  function maybeTip(riskPct, reasons){
    const t = nowMs();
    if (riskPct < TIP_RISK_TH) return;
    if (t - lastTipAt < TIP_COOLDOWN_MS) return;
    lastTipAt = t;

    const r = (reasons && reasons.length) ? reasons[0] : '';
    let text = 'ตั้งสติ เล็งก่อนยิง 👀';
    let mood = 'neutral';

    if (r === 'ACC ต่ำ'){ text = 'ACC ต่ำ: ช้าลงนิด เล็งให้ตรงหมู่ก่อนค่อยยิง 🎯'; mood='neutral'; }
    else if (r === 'PRESSURE สูง'){ text = 'เริ่มกดดัน: อย่ายิงรัว เล็งทีละเป้า จะรอด 🔥'; mood='fever'; }
    else if (r === 'STORM'){ text = 'ช่วง STORM: โฟกัสเป้าใกล้ crosshair ก่อน ⚡'; mood='fever'; }
    else if (r === 'MINI'){ text = 'MINI อยู่: เลือกยิงเป้าชัวร์ อย่าเสี่ยงโดนขยะ ✅'; mood='neutral'; }
    else if (r === 'เป้าเยอะ'){ text = 'เป้าเยอะ: ยิงเฉพาะ “หมู่ถูก” ที่อยู่กลาง ๆ ก่อน'; mood='neutral'; }
    else if (r === 'คอมโบหลุด'){ text = 'คอมโบหลุด: รีเซ็ตใจ แล้วเริ่มยิงชัวร์ ๆ ใหม่ ✨'; mood='happy'; }

    emit('ai:tip', { text, mood });
  }

  // ---- feature engineering (EMA + deltas + rolling 5s) ----
  const FE = {
    last: null,
    emaAcc: null,
    emaRisk: null,
    emaCombo: null,
    emaMiss: null,
    win: [] // last 5 seconds telemetry frames
  };

  function feUpdate(tMs, d, riskPct){
    const a = d.accGoodPct|0;
    const c = d.combo|0;
    const m = d.misses|0;

    const alpha = 0.28; // EMA smoothing
    const ema = (prev, x)=> (prev==null ? x : (prev*(1-alpha) + x*alpha));

    FE.emaAcc = ema(FE.emaAcc, a);
    FE.emaRisk= ema(FE.emaRisk, riskPct);
    FE.emaCombo=ema(FE.emaCombo, c);
    FE.emaMiss= ema(FE.emaMiss, m);

    // rolling window 5s
    FE.win.push({tMs, a, c, m, risk:riskPct, storm:d.stormOn?1:0, mini:d.miniOn?1:0});
    const cut = tMs - 5000;
    while(FE.win.length && FE.win[0].tMs < cut) FE.win.shift();

    const last = FE.last;
    const dAcc = last ? (a - last.a) : 0;
    const dCombo= last ? (c - last.c) : 0;
    const dMiss = last ? (m - last.m) : 0;

    // rolling aggregates
    let riskMax=0, riskAvg=0, n=FE.win.length;
    let missInc=0, comboDrop=0;
    for(let i=0;i<n;i++){
      riskMax = Math.max(riskMax, FE.win[i].risk);
      riskAvg += FE.win[i].risk;
      if (i>0){
        const dm = FE.win[i].m - FE.win[i-1].m;
        if (dm>0) missInc += dm;
        const dc = FE.win[i].c - FE.win[i-1].c;
        if (dc<0) comboDrop += 1;
      }
    }
    riskAvg = n? (riskAvg/n) : 0;

    FE.last = {tMs, a, c, m};

    return {
      dAcc, dCombo, dMiss,
      emaAcc: Math.round(FE.emaAcc||0),
      emaRisk: Math.round(FE.emaRisk||0),
      emaCombo: Math.round(FE.emaCombo||0),
      emaMiss: Math.round(FE.emaMiss||0),
      roll5sRiskAvg: Math.round(riskAvg),
      roll5sRiskMax: Math.round(riskMax),
      roll5sMissInc: missInc|0,
      roll5sComboDrops: comboDrop|0
    };
  }

  // ---- attach/detach ----
  let attached=false, enabled=false, runMode='play', seed='', sessionId='';
  function makeSessionId(){ return 'GVR-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,7); }

  function onTelemetry(ev){
    if (!enabled) return;
    const d = ev.detail || {};
    const t = nowMs();

    const R = riskFrom(d);
    const riskPct = Math.round(R.riskPct);

    emit('ai:risk', { riskPct, reasons: R.reasons });
    maybeTip(riskPct, R.reasons);

    const fe = feUpdate(Math.round(t), d, riskPct);

    const row = {
      tMs: Math.round(t),
      sessionId,
      seed: String(seed || d.seed || ''),
      runMode: String(runMode || d.runMode || ''),
      diff: String(d.diff||''),

      leftSec: d.leftSec|0,
      score: d.score|0,
      combo: d.combo|0,
      misses: d.misses|0,
      accGoodPct: d.accGoodPct|0,
      pressure: d.pressure|0,
      stormOn: d.stormOn ? 1 : 0,
      miniOn: d.miniOn ? 1 : 0,
      miniForbidJunk: d.miniForbidJunk ? 1 : 0,
      targetsOnScreen: d.targetsOnScreen|0,
      powerCharge: d.powerCharge|0,
      powerThreshold: d.powerThreshold|0,
      goalNow: d.goalNow|0,
      goalNeed: d.goalNeed|0,

      riskPct,
      reason0: (R.reasons && R.reasons[0]) ? R.reasons[0] : '',

      // engineered
      dAcc: fe.dAcc|0,
      dCombo: fe.dCombo|0,
      dMiss: fe.dMiss|0,
      emaAcc: fe.emaAcc|0,
      emaRisk: fe.emaRisk|0,
      emaCombo: fe.emaCombo|0,
      emaMiss: fe.emaMiss|0,
      roll5sRiskAvg: fe.roll5sRiskAvg|0,
      roll5sRiskMax: fe.roll5sRiskMax|0,
      roll5sMissInc: fe.roll5sMissInc|0,
      roll5sComboDrops: fe.roll5sComboDrops|0,

      label: null
    };

    pushFrame(row);
    flushToDataset();
  }

  function onProgress(ev){
    if (!enabled) return;
    const d = ev.detail || {};
    if (d.kind === 'miss') labelRecentMiss(String(d.why||'miss'), nowMs());
  }
  function onJudge(ev){
    if (!enabled) return;
    const d = ev.detail || {};
    const k = String(d.kind||'');
    if (k === 'miss') labelRecentMiss('miss', nowMs());
    if (k === 'bad')  labelRecentMiss('bad',  nowMs());
  }

  function attach(cfg){
    cfg = cfg || {};
    enabled = !!cfg.enabled;
    runMode = String(cfg.runMode||'play');
    seed = String(cfg.seed||'');
    if (!sessionId) sessionId = makeSessionId();

    if (attached) return;
    attached = true;

    // reset FE state each attach (safer per session)
    FE.last=null; FE.emaAcc=null; FE.emaRisk=null; FE.emaCombo=null; FE.emaMiss=null; FE.win.length=0;

    root.addEventListener('groups:telemetry', onTelemetry, {passive:true});
    root.addEventListener('groups:progress',  onProgress,  {passive:true});
    root.addEventListener('hha:judge',        onJudge,     {passive:true});
  }

  function detach(){
    if (!attached) return;
    attached=false; enabled=false;

    root.removeEventListener('groups:telemetry', onTelemetry);
    root.removeEventListener('groups:progress',  onProgress);
    root.removeEventListener('hha:judge',        onJudge);

    const dataset = safeGetLS(LS_DATA, []);
    while(buf.length){
      const r = buf.shift();
      if (r.label == null) r.label = 0;
      dataset.push(r);
    }
    if (dataset.length > MAX_ROWS) dataset.splice(0, dataset.length - MAX_ROWS);
    safeSetLS(LS_DATA, dataset);

    sessionId='';
  }

  function getDataset(){ return safeGetLS(LS_DATA, []); }
  function clearDataset(){ safeSetLS(LS_DATA, []); }
  function getSessionId(){ return sessionId || ''; }

  NS.AIHooks = { attach, detach, getDataset, clearDataset, getSessionId };

})(window);