// === /herohealth/vr-groups/ai-hooks.js ===
// AI Hooks (Prediction + Coach micro-tips) — SAFE
// ✅ Enabled only when attach({enabled:true})
// ✅ Research mode: force disabled
// ✅ Uses mlTrace samples to estimate short-horizon miss risk (5s)
// ✅ Emits: hha:coach (rate-limited), groups:ai (debug optional)

(function(){
  'use strict';
  const WIN = window;

  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));
  const emit = (n,d)=>{ try{ WIN.dispatchEvent(new CustomEvent(n,{detail:d})); }catch(_){} };

  // Simple logistic function
  const sigmoid = (x)=> 1 / (1 + Math.exp(-x));

  function makePredictor(){
    // rolling window (last 10 samples)
    const buf = [];
    const MAX = 10;

    // rate-limit coach
    let lastCoachAt = 0;
    let lastRiskBand = -1;

    function push(sample){
      buf.push(sample);
      if (buf.length > MAX) buf.shift();
    }

    function featureVector(){
      if (buf.length < 3) return null;

      const a = buf[buf.length-1];
      const b = buf[Math.max(0, buf.length-3)];
      const c = buf[0];

      // deltas
      const dMiss = (a.misses||0) - (b.misses||0);
      const dHitG = (a.hitsGood||0) - (b.hitsGood||0);

      // recent miss-rate proxy
      const missRate = clamp(dMiss/2, 0, 3);

      // pressure + storm
      const pressure = clamp(a.pressure||0, 0, 3);
      const storm = (a.storm ? 1 : 0);

      // low accuracy = risky
      const acc = clamp(a.accGoodPct||0, 0, 100);
      const accBad = clamp((70 - acc)/70, 0, 1);

      // combo collapse is risky (combo low)
      const combo = clamp(a.combo||0, 0, 30);
      const comboBad = clamp((6 - combo)/6, 0, 1);

      // mini urgent = risky
      const miniOn = (a.miniOn ? 1 : 0);
      const miniNeed = (a.miniNeed||0);
      const miniNow = (a.miniNow||0);
      const miniGap = miniOn ? clamp((miniNeed - miniNow)/Math.max(1,miniNeed), 0, 1) : 0;

      // spawn pace (lower ms = harder)
      const spawnBaseMs = clamp(a.spawnBaseMs||650, 280, 1200);
      const speedHard = clamp((720 - spawnBaseMs)/720, 0, 1);

      // very early ramp: allow a few seconds
      const early = (a.tSec < 6) ? 1 : 0;

      return {
        missRate, pressure, storm,
        accBad, comboBad,
        miniOn, miniGap,
        speedHard,
        early,
        dHitG
      };
    }

    function predictRisk(){
      const f = featureVector();
      if (!f) return { risk:0.15, band:0 };

      // Hand-tuned logistic regression weights (light ML heuristic)
      // risk ~= P(miss in next ~5s)
      let z =
        -1.25
        + 1.10 * f.missRate
        + 0.55 * f.pressure
        + 0.70 * f.storm
        + 1.10 * f.accBad
        + 0.85 * f.comboBad
        + 0.55 * (f.miniOn ? f.miniGap : 0)
        + 0.55 * f.speedHard
        - 0.10 * clamp(f.dHitG,0,6);

      // early stage: damp risk
      if (f.early) z -= 0.55;

      const risk = clamp(sigmoid(z), 0, 1);

      // banding
      const band = (risk >= 0.78) ? 3 : (risk >= 0.58) ? 2 : (risk >= 0.38) ? 1 : 0;
      return { risk, band, f };
    }

    function maybeCoach(sample){
      const t = Date.now();
      const { risk, band, f } = predictRisk();

      emit('groups:ai', { kind:'risk', risk, band, f });

      // only speak when band changes upward or high band persists with cooldown
      const cooldown = (band >= 2) ? 3200 : 5200;
      if (t - lastCoachAt < cooldown) return;

      if (band === 0){
        lastRiskBand = 0;
        return;
      }

      // speak if:
      // - band increased
      // - or band high and last band same but enough time
      if (band > lastRiskBand || band >= 2){
        lastCoachAt = t;
        lastRiskBand = band;

        if (band === 1){
          emit('hha:coach', { text:'เล็งก่อนยิง 1 วิ จะพลาดน้อยลง 👀', mood:'neutral' });
          return;
        }
        if (band === 2){
          const msg = (f?.storm)
            ? 'พายุกำลังมา! ช้าลงนิด เลือกหมู่ให้ชัวร์ 🌪️'
            : 'เริ่มพลาดถี่แล้วนะ! โฟกัส “หมู่ที่ถูก” อย่างเดียว 🎯';
          emit('hha:coach', { text: msg, mood:'fever' });
          return;
        }
        if (band === 3){
          const msg = (f?.miniOn && (f?.miniGap>0.5))
            ? 'MINI ใกล้หลุด! ห้ามยิงมั่ว เลือกหมู่ให้ตรงก่อน 🔥'
            : 'โหมดเสี่ยงสูง! หยุดยิงรัว แล้วค่อยยิงทีละเป้า ✅';
          emit('hha:coach', { text: msg, mood:'sad' });
          return;
        }
      }
    }

    return { push, predictRisk, maybeCoach };
  }

  const API = {
    enabled:false,
    predictor:null,
    attach(cfg){
      cfg = cfg || {};
      const runMode = String(cfg.runMode||'play');
      const enabled = !!cfg.enabled;

      // hard disable
      if (runMode === 'research'){
        API.enabled = false;
        API.predictor = null;
        return;
      }
      API.enabled = enabled;
      API.predictor = enabled ? makePredictor() : null;

      if (enabled){
        emit('hha:coach', { text:'AI Prediction เปิดแล้ว 🤖 (ช่วยเตือนก่อนพลาด)', mood:'neutral' });
      }
    }
  };

  // listen to mltrace samples
  WIN.addEventListener('groups:mltrace', (ev)=>{
    if (!API.enabled || !API.predictor) return;
    const d = ev.detail||{};
    if (d.kind !== 'sample') return;
    const s = d.sample||{};
    API.predictor.push(s);
    API.predictor.maybeCoach(s);
  }, {passive:true});

  WIN.GroupsVR = WIN.GroupsVR || {};
  WIN.GroupsVR.AIHooks = API;
})();