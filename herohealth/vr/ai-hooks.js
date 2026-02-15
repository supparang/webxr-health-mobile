// === /herohealth/vr/ai-hooks.js ===
// HHA AI Hooks — SAFE (NO deps) — PRODUCTION v20260215a
// ✅ Exposes: window.HHA.createAIHooks(opts) -> ai
// ✅ Never crashes if game calls AI but this file missing/partial
// ✅ Default: deterministic (study/research) => enabled=false, adaptive off
// ✅ Supports onEvent('features_1s', feat) + onEvent('judge', ev) + generic
// ✅ getTip(feat) returns explainable micro-tip (rate-limited)
// ✅ getPrediction(feat) returns lightweight "risk" estimate (heuristic, ML-ready)
// ✅ getDifficultySignal(feat) returns suggestion only (engine may ignore)
// ✅ reset() clears rolling state
//
// Notes:
// - This is intentionally heuristic (ML-0/ML-1). Collect features_1s + labels to train later.
// - Keep it stable: no DOM reads, no network calls, no storage writes (except optional debug).

'use strict';

(function(){
  const ROOT = window;

  // if already present, do not overwrite (allow custom AI)
  if(ROOT.HHA && typeof ROOT.HHA.createAIHooks === 'function') return;

  const clamp = (v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };
  const now = ()=> (performance && performance.now) ? performance.now() : Date.now();

  function makeLimiter(ms){
    let t=0;
    return function ok(){
      const n=now();
      if(n - t < ms) return false;
      t = n;
      return true;
    };
  }

  function safeObj(x){ return (x && typeof x === 'object') ? x : {}; }

  // Simple rolling window helper
  function Ring(n){
    const a = [];
    return {
      push(v){ a.push(v); while(a.length>n) a.shift(); },
      avg(){
        if(!a.length) return 0;
        let s=0; for(const v of a) s += (Number(v)||0);
        return s / a.length;
      },
      sum(){
        let s=0; for(const v of a) s += (Number(v)||0);
        return s;
      },
      get arr(){ return a.slice(); },
      clear(){ a.length=0; }
    };
  }

  // --- core factory ---
  function createAIHooks(opts){
    opts = safeObj(opts);
    const game = String(opts.game || 'unknown');
    const runMode = String(opts.runMode || 'play').toLowerCase();
    const diff = String(opts.diff || 'normal').toLowerCase();
    const seed = Number(opts.seed || 0) || 0;
    const deterministic = !!opts.deterministic || (runMode === 'study' || runMode === 'research');

    // "enabled" = may give tips/prediction; deterministic still logs but won't adapt.
    const enabled = !deterministic;

    // internal state
    const S = {
      game, runMode, diff, seed, deterministic, enabled,
      lastFeat: null,
      // rolling metrics (3-6s)
      acc: Ring(6),
      missD: Ring(6),
      dens: Ring(6),
      spawn: Ring(6),
      scoreD: Ring(6),
      // judge counts
      jGood: 0, jJunk: 0, jExpire: 0, jShotMiss: 0,
      // tip limiter
      tipOk: makeLimiter(2600),
      // avoid repeating same message too often
      lastTipKey: '',
      repeatBlock: makeLimiter(7000),
      // debug
      debug: false
    };

    function reset(){
      S.lastFeat = null;
      S.acc.clear(); S.missD.clear(); S.dens.clear(); S.spawn.clear(); S.scoreD.clear();
      S.jGood=0; S.jJunk=0; S.jExpire=0; S.jShotMiss=0;
      S.lastTipKey='';
      // keep limiters as-is (fine)
    }

    function onEvent(type, payload){
      type = String(type||'').toLowerCase();
      payload = safeObj(payload);

      if(type === 'features_1s'){
        S.lastFeat = payload;

        // pull common fields if present
        const accNow = Number(payload.accNowPct ?? payload.accNow ?? 0) || 0;
        const missD1 = Number(payload.missDelta1s ?? 0) || 0;
        const dens = Number(payload.targetDensity ?? payload.targetDensity01 ?? 0) || 0;
        const sp = Number(payload.spawnRatePerSec ?? 0) || 0;
        const sd = Number(payload.scoreDelta1s ?? 0) || 0;

        S.acc.push(accNow);
        S.missD.push(missD1);
        S.dens.push(dens);
        S.spawn.push(sp);
        S.scoreD.push(sd);

        return;
      }

      if(type === 'judge'){
        const k = String(payload.kind||'').toLowerCase();
        if(k === 'good') S.jGood++;
        else if(k === 'junk') S.jJunk++;
        else if(k === 'expire_good') S.jExpire++;
        else if(k === 'shot_miss') S.jShotMiss++;
        return;
      }

      // allow games to send custom events safely (no-op default)
    }

    // Heuristic prediction: "risk" 0..1 (higher = player likely to miss soon)
    function getPrediction(feat){
      feat = feat || S.lastFeat;
      feat = safeObj(feat);

      // use rolling windows if available
      const accAvg = clamp(S.acc.avg()/100, 0, 1);
      const missRate = clamp(S.missD.avg()/3, 0, 1);      // ~miss per sec normalized
      const densAvg = clamp(S.dens.avg(), 0, 1);
      const spawnAvg = clamp(S.spawn.avg()/4, 0, 1);      // rough normalize
      const storm = !!feat.stormActive;
      const boss  = !!feat.bossActive;

      // risk model (simple + explainable)
      let risk = 0.10;
      risk += (1 - accAvg) * 0.55;
      risk += missRate * 0.35;
      risk += densAvg * 0.20;
      risk += spawnAvg * 0.10;
      if(storm) risk += 0.10;
      if(boss)  risk += 0.14;

      // clamp
      risk = clamp(risk, 0, 1);

      return {
        model: 'heuristic-v1',
        game,
        tPlayedSec: Number(feat.tPlayedSec||0) || 0,
        risk01: Math.round(risk*1000)/1000,
        // optional: label suggestion
        riskBand: (risk>=0.75?'high':risk>=0.45?'med':'low')
      };
    }

    // Difficulty suggestion only (engine may use or ignore)
    function getDifficultySignal(feat){
      feat = feat || S.lastFeat;
      feat = safeObj(feat);
      const pred = getPrediction(feat);
      const risk = Number(pred.risk01||0) || 0;

      // map to -1..+1
      let signal = 0;
      if(risk < 0.30) signal = +0.35;
      else if(risk > 0.70) signal = -0.45;

      // soften in boss/storm (don't jerk difficulty)
      if(feat.bossActive || feat.stormActive) signal *= 0.6;

      return {
        game,
        type: 'difficulty_signal',
        signal: Math.round(signal*100)/100,
        reason: (signal>0 ? 'player_stable' : signal<0 ? 'player_struggling' : 'neutral')
      };
    }

    // Micro tip generator (rate-limited + avoid repeats)
    function getTip(feat){
      if(!S.enabled) return null;
      if(!S.tipOk()) return null;

      feat = feat || S.lastFeat;
      feat = safeObj(feat);
      if(!feat || !Object.keys(feat).length) return null;

      const pred = getPrediction(feat);
      const risk = Number(pred.risk01||0) || 0;

      const acc = clamp(Number(feat.accNowPct ?? 0) || 0, 0, 100);
      const missD1 = Number(feat.missDelta1s ?? 0) || 0;
      const dens = clamp(Number(feat.targetDensity ?? feat.targetDensity01 ?? 0) || 0, 0, 1);
      const storm = !!feat.stormActive;
      const boss  = !!feat.bossActive;

      // candidate tips (keyed)
      const tips = [];

      if(boss){
        tips.push({
          key:'boss_focus_good',
          msg:'👹 ช่วงบอส: โฟกัส GOOD อย่างเดียว ห้ามโดนขยะ! เล็งทีละเป้าให้ชัวร์',
          mood:'neutral'
        });
      } else if(storm){
        tips.push({
          key:'storm_speed',
          msg:'🌪️ STORM: อย่าลังเล! ไล่เก็บ GOOD ต่อเนื่อง คอมโบช่วยดันคะแนน',
          mood:'fever'
        });
        if(acc >= 82){
          tips.push({
            key:'storm_no_junk',
            msg:'⚠️ ถ้าพายุห้ามโดนขยะ: เลี่ยงเป้าขยะก่อน แล้วค่อยสอย GOOD ใกล้ ๆ',
            mood:'sad'
          });
        }
      }

      if(risk >= 0.72){
        tips.push({
          key:'risk_high_slow',
          msg:'🧠 เริ่มพลาดถี่ขึ้น: ชะลอ 0.2 วิ เล็ง “ใกล้สุด” ก่อน แล้วค่อยยิง/แตะ',
          mood:'neutral'
        });
      } else if(risk <= 0.28){
        tips.push({
          key:'risk_low_push',
          msg:'🔥 ฟอร์มดี! ลองเร่งเก็บเป้าต่อเนื่องให้คอมโบยาวขึ้น',
          mood:'happy'
        });
      }

      if(missD1 >= 2){
        tips.push({
          key:'miss_spike',
          msg:'💥 พลาดรวด: รีเซ็ตจังหวะ—หันไปเก็บ GOOD ที่ “อยู่กลางจอ” ก่อน',
          mood:'sad'
        });
      }

      if(acc < 70 && dens > 0.55){
        tips.push({
          key:'low_acc_density',
          msg:'🎯 เป้าเยอะทำให้พลาด: เลือกยิง/แตะเฉพาะเป้าที่ใกล้ crosshair/นิ้วที่สุด',
          mood:'neutral'
        });
      }

      // final pick: prefer not repeating
      let pick = tips[0] || null;
      for(const t of tips){
        if(t.key !== S.lastTipKey){ pick = t; break; }
      }
      if(!pick) return null;

      // anti-repeat hard block
      if(pick.key === S.lastTipKey && !S.repeatBlock()) return null;
      S.lastTipKey = pick.key;

      return {
        game,
        type:'coach_tip',
        key: pick.key,
        msg: pick.msg,
        mood: pick.mood,
        meta: {
          risk01: Number(getPrediction(feat).risk01||0) || 0,
          accNowPct: acc,
          targetDensity: dens
        }
      };
    }

    return {
      enabled,
      deterministic,
      onEvent,
      getTip,
      getPrediction,
      getDifficultySignal,
      reset
    };
  }

  // attach namespace
  ROOT.HHA = ROOT.HHA || {};
  ROOT.HHA.createAIHooks = createAIHooks;

})();