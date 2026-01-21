// === /herohealth/vr/ai-predict.js ===
// HHA AI Predict — LIGHTWEIGHT (kids-friendly)
// ✅ Predict storm pass chance (0..100)
// ✅ Suggest next action text (LOW/HIGH, get shield, block end window)
// ✅ Deterministic in research (uses provided rng)

'use strict';

export function createAIPredict(opts = {}){
  const qs = (k, d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };
  const clamp=(v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };

  const game = String(opts.game || 'game').toLowerCase();
  const emit = typeof opts.emit === 'function'
    ? opts.emit
    : ((name, detail)=>{ try{ window.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){ } });

  const run = String(qs('run', qs('runMode','play')) || 'play').toLowerCase();
  const inResearch = (run === 'research' || run === 'study');

  // optional: disable prediction
  const predQ = String(qs('predict','1')).toLowerCase();
  const enabled = !(predQ==='0' || predQ==='false' || predQ==='off');

  const rng = (typeof opts.rng === 'function') ? opts.rng : Math.random;

  function sigmoid(x){ return 1/(1+Math.exp(-x)); }

  function predictStorm(st){
    // st expected fields:
    // { inStorm, inEndWindow, waterZone, shield, missesRate, pressure, pressureNeed, gotHitByBad, bossActive, bossNeed, bossBlocked }
    if (!enabled) return { enabled:false, chancePct:0, label:'', next:'' };

    const inStorm = !!st.inStorm;
    if (!inStorm) return { enabled:true, chancePct:0, label:'', next:'' };

    const zone = String(st.waterZone||'').toUpperCase();
    const shield = (st.shield|0);
    const inEnd = !!st.inEndWindow;

    const pressure = clamp(st.pressure ?? 0, 0, 2);
    const need = clamp(st.pressureNeed ?? 1, 0.2, 2);
    const pOK = clamp(pressure/Math.max(0.01, need), 0, 1);

    const gotHit = !!st.gotHitByBad;
    const missRate = clamp(st.missesRate ?? 0, 0, 1);

    const zoneOK = (zone !== 'GREEN') ? 1 : 0;
    const endOK  = inEnd ? 1 : 0;
    const blockPotential = (shield > 0) ? 1 : 0;

    // boss bonus complexity
    const bossActive = !!st.bossActive;
    const bossNeed = (st.bossNeed|0) || 2;
    const bossBlocked = (st.bossBlocked|0) || 0;
    const bossProgress = clamp(bossBlocked/Math.max(1,bossNeed), 0, 1);

    // scoring model (simple + explainable)
    // base wants: zoneOK + pressureOK + endWindow + shield
    let x =
      (+1.20*zoneOK) +
      (+1.10*pOK) +
      (+0.85*blockPotential) +
      (+0.55*endOK) +
      (+0.35*bossProgress) +
      (-1.80*(gotHit?1:0)) +
      (-0.90*missRate);

    // research deterministic tiny noise, play allow tiny jitter
    const jitter = inResearch ? ((rng()*0.12)-0.06) : ((Math.random()*0.18)-0.09);
    x += jitter;

    const prob = clamp(sigmoid(x), 0, 1);
    const chancePct = Math.round(prob*100);

    // next action
    let next = '';
    if (gotHit) next = 'โดน BAD แล้ว → รอบนี้ไม่นับ ลองใหม่รอบหน้า';
    else if (!zoneOK) next = 'ทำให้ไม่อยู่ GREEN (LOW/HIGH) ก่อน';
    else if (pOK < 1) next = 'ค้าง LOW/HIGH อีกนิด (เติมแรงกด)';
    else if (!inEnd) next = 'รอท้ายพายุ (End Window) แล้วค่อย BLOCK';
    else if (shield <= 0) next = 'ไม่มีโล่! รีบเก็บ 🛡️ แล้ว BLOCK';
    else next = bossActive ? 'Boss Window! BLOCK 🌩️ ให้ครบ' : 'BLOCK ตอนนี้!';

    const label =
      chancePct >= 80 ? 'ชัวร์มาก' :
      chancePct >= 60 ? 'มีลุ้น' :
      chancePct >= 40 ? 'ต้องตั้งใจ' :
      'ยาก';

    // emit for logging/overlay if desired
    emit('hha:predict', { game, kind:'storm', chancePct, label, next, at: Date.now() });

    return { enabled:true, chancePct, label, next };
  }

  return { enabled, predictStorm };
}