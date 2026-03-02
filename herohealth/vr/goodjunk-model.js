// === /webxr-health-mobile/herohealth/vr/goodjunk-model.js ===
// GoodJunk Risk Model — Production (load trained weights json optional)
// v20260302-MODEL-LOADWEIGHTS
'use strict';

const WIN = (typeof window !== 'undefined') ? window : globalThis;

function clamp(v,a,b){ v=Number(v); if(!Number.isFinite(v)) v=0; return v<a?a:(v>b?b:v); }
function sig(x){ return 1/(1+Math.exp(-x)); }

const FALLBACK_W = {
  // baseline fallback
  b: -1.4,
  miss: 0.10,
  hitJunk: 0.18,
  accLow: 0.03,        // (100-acc)
  rt: 0.0012,
  comboNeg: -0.04,
  fever: -0.01,
  timeLow: 0.06,       // 1 if timeLeft < 10
  boss: 0.08
};

let MODEL = {
  mode: 'fallback',
  loadedAt: 0,
  // trained payload shape:
  // { schema, features[], bias, weights[], scaler:{mean[],scale[]} }
  trained: null
};

export async function loadGoodJunkWeights(url='../vr/goodjunk_weights.json'){
  try{
    const u = new URL(url, WIN.location.href).toString();
    const res = await fetch(u, { cache:'no-store' });
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();

    if(!j || !Array.isArray(j.features) || !Array.isArray(j.weights) || !j.scaler){
      throw new Error('bad_weights_format');
    }
    if(j.features.length !== j.weights.length) throw new Error('features_weights_mismatch');

    MODEL = { mode:'trained', loadedAt: Date.now(), trained: j };
    return { ok:true, mode:'trained', meta:{ schema:j.schema||'', auc:j.metrics?.auc } };
  }catch(err){
    // keep fallback
    MODEL = { mode:'fallback', loadedAt: Date.now(), trained: null };
    return { ok:false, mode:'fallback', error: String(err?.message || err) };
  }
}

function buildExplainHint(snap, risk){
  const acc = clamp(snap.accPct, 0, 100);
  const rt  = clamp(snap.medianRtGoodMs, 0, 5000);
  const miss = Number(snap.miss||0);
  const hitJunk = Number(snap.hitJunk||0);
  const timeLeft = clamp(snap.timeLeftSec, 0, 999);

  if(risk >= 0.82){
    if(timeLeft < 10) return 'ท้ายเวลา! เล็ง GOOD เท่านั้น ห้ามยิงรัว';
    if(hitJunk > 0)  return 'หยุดแตะ JUNK — มองสีให้ชัวร์ก่อนยิง';
    if(acc < 70)     return 'ช้าลง 0.2 วิ แล้วค่อยยิง (แม่นสำคัญกว่าเร็ว)';
    if(rt > 950)     return 'เร็วขึ้นอีกนิด แต่ต้องชัวร์';
    if(miss >= 3)    return 'รีเซ็ตจังหวะ: ยิงทีละเป้า';
    return 'โหมดเสี่ยงสูง: คุมจังหวะ + เล็งกลางจอ';
  }
  if(risk >= 0.55){
    if(acc < 80) return 'มองให้ชัวร์ก่อนยิง ลดพลาด';
    if(rt > 900) return 'เร็วขึ้นอีกนิด (แต่ยังต้องแม่น)';
    return 'รักษาคอมโบไว้ ยิงเฉพาะ GOOD';
  }
  return 'ดีมาก! รักษาความแม่น';
}

function predictTrained(snap){
  const t = MODEL.trained;
  const feats = t.features;
  const w = t.weights;
  const b = Number(t.bias || 0);

  // build x vector in same feature order
  const x = feats.map((f)=>{
    switch(f){
      case 'miss': return Number(snap.miss||0);
      case 'hitJunk': return Number(snap.hitJunk||0);
      case 'accPct': return clamp(snap.accPct,0,100);
      case 'medianRtGoodMs': return clamp(snap.medianRtGoodMs,0,5000);
      case 'combo': return clamp(snap.combo,0,999);
      case 'feverPct': return clamp(snap.feverPct,0,100);
      case 'timeLeftSec': return clamp(snap.timeLeftSec,0,999);
      case 'bossOn': return snap.bossOn ? 1 : 0;
      default: return 0;
    }
  });

  // scale
  const mean = t.scaler?.mean || [];
  const scale = t.scaler?.scale || [];
  const xs = x.map((v,i)=>{
    const mu = Number(mean[i] ?? 0);
    const sc = Number(scale[i] ?? 1) || 1;
    return (Number(v)-mu)/sc;
  });

  let z = b;
  for(let i=0;i<xs.length;i++){
    z += xs[i] * Number(w[i]||0);
  }
  const risk = clamp(sig(z), 0, 1);
  return { risk, z };
}

function predictFallback(snap){
  const miss = Number(snap.miss||0);
  const hitJunk = Number(snap.hitJunk||0);
  const acc = clamp(snap.accPct, 0, 100);
  const rt = clamp(snap.medianRtGoodMs, 0, 5000);
  const combo = clamp(snap.combo, 0, 999);
  const fever = clamp(snap.feverPct, 0, 100);
  const timeLeft = clamp(snap.timeLeftSec, 0, 999);
  const bossOn = snap.bossOn ? 1 : 0;

  const z =
    FALLBACK_W.b +
    FALLBACK_W.miss * miss +
    FALLBACK_W.hitJunk * hitJunk +
    FALLBACK_W.accLow * (100 - acc) +
    FALLBACK_W.rt * rt +
    FALLBACK_W.comboNeg * combo +
    FALLBACK_W.fever * fever +
    FALLBACK_W.timeLow * (timeLeft < 10 ? 1 : 0) +
    FALLBACK_W.boss * bossOn;

  const risk = clamp(sig(z), 0, 1);
  return { risk, z };
}

export function predictGoodJunkRisk(snap){
  const out = (MODEL.mode === 'trained' && MODEL.trained)
    ? predictTrained(snap)
    : predictFallback(snap);

  const hint = buildExplainHint(snap, out.risk);

  return {
    mode: MODEL.mode,
    risk: out.risk,
    z: out.z,
    hint
  };
}