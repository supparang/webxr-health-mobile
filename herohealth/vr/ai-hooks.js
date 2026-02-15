// === /herohealth/vr/ai-hooks.js ===
// HHA AI Hooks — Prediction (A) + ML Logging (B) + DL-ready buffers (C)
// Safe: never crashes game. Deterministic friendly when seed provided.

(function(){
  'use strict';
  const WIN = window;

  function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
  function num(v,d=0){ v=Number(v); return Number.isFinite(v)?v:d; }

  // rolling window helper
  function rollPush(arr, item, max){
    arr.push(item);
    if(arr.length>max) arr.splice(0, arr.length-max);
  }

  function createAIHooks(cfg){
    cfg = cfg || {};
    const seed = String(cfg.seed || '');
    const enabled = cfg.enabled !== false;

    // ---- rolling stats ----
    const S = {
      t0: 0,
      lastTipAt: 0,
      lastSlowAt: 0,
      events: [],        // last N events (DL-ready)
      shots: [],         // {t,hit,rt}
      timeouts: [],      // {t}
      whiffs: [],        // {t}
      comboDrops: [],    // {t}
      risk: 0,
      riskSm: 0
    };

    const POLICY = {
      tipMinGapMs: cfg.tipMinGapMs ?? 1400,
      slowMinGapMs: cfg.slowMinGapMs ?? 4200,
      slowDurationMs: cfg.slowDurationMs ?? 450,
      slowFactor: cfg.slowFactor ?? 1.10, // ttl scale up (more time) / spawn interval scale down? เราใช้ ttl scale เท่านั้น
      riskThresholdTip: cfg.riskThresholdTip ?? 0.68,
      riskThresholdSlow: cfg.riskThresholdSlow ?? 0.82,
      windowMs: cfg.windowMs ?? 5000,
      dlWindowN: cfg.dlWindowN ?? 60
    };

    // --- feature extraction ---
    function windowCount(arr, nowMs){
      const w = POLICY.windowMs;
      let c=0;
      for(let i=arr.length-1;i>=0;i--){
        if(nowMs - arr[i].t > w) break;
        c++;
      }
      return c;
    }
    function windowRate(arr, nowMs){
      return windowCount(arr, nowMs) / (POLICY.windowMs/1000);
    }
    function avgRT(nowMs){
      const w=POLICY.windowMs;
      let sum=0, n=0;
      for(let i=S.shots.length-1;i>=0;i--){
        const it=S.shots[i];
        if(nowMs - it.t > w) break;
        if(it.hit && it.rt!=null){
          sum+=it.rt; n++;
        }
      }
      return n? (sum/n) : null;
    }

    // risk score heuristic (upgrade to ML later)
    function computeRisk(nowMs, ctx){
      const whiffR = windowRate(S.whiffs, nowMs);
      const toutR  = windowRate(S.timeouts, nowMs);
      const dropR  = windowRate(S.comboDrops, nowMs);
      const rt = avgRT(nowMs); // ms
      const inten = num(ctx?.intensity, 0);

      // normalize
      const a = clamp(whiffR/3.0, 0, 1);   // 3 whiffs/sec is extreme
      const b = clamp(toutR /2.0, 0, 1);
      const c = clamp(dropR /1.0, 0, 1);
      const d = rt==null ? 0.3 : clamp((rt-320)/520, 0, 1); // slow RT increases risk
      const e = clamp(inten, 0, 1);

      // weighted sum
      const r = 0.26*a + 0.26*b + 0.14*c + 0.18*d + 0.16*e;
      return clamp(r, 0, 1);
    }

    // emit tip to game (brush.boot listens brush:ai)
    function emitTip(detail){
      try{ WIN.dispatchEvent(new CustomEvent('brush:ai', { detail })); }catch(_){}
    }

    // called by game on every event
    function onEvent(ev){
      if(!enabled) return;

      const t = num(ev.t, Date.now());
      if(!S.t0) S.t0 = t;

      // DL-ready buffer (sequence)
      rollPush(S.events, {
        t: t,
        type: String(ev.type||''),
        remainMs: num(ev.remainMs, 0),
        intensity: num(ev.intensity, 0),
        combo: num(ev.combo, 0),
        hit: ev.hit?1:0,
        whiff: ev.whiff?1:0,
        timeout: ev.timeout?1:0,
        boss: ev.boss?1:0,
        phase: num(ev.phase, 0)
      }, POLICY.dlWindowN);

      // update rolling buckets
      if(ev.type==='shot'){
        rollPush(S.shots, { t, hit: !!ev.hit, rt: (ev.rt!=null? num(ev.rt,null):null) }, 200);
        if(ev.whiff) rollPush(S.whiffs, { t }, 200);
      }
      if(ev.type==='timeout') rollPush(S.timeouts, { t }, 200);
      if(ev.type==='combo_drop') rollPush(S.comboDrops, { t }, 200);

      // compute smoothed risk
      const r = computeRisk(t, ev.ctx || {});
      S.risk = r;
      S.riskSm = S.riskSm ? (S.riskSm*0.78 + r*0.22) : r;

      // suggest tip / slow assistance (play mode only ideally)
      const nowMs = Date.now();
      const canTip = (nowMs - S.lastTipAt) > POLICY.tipMinGapMs;
      const canSlow= (nowMs - S.lastSlowAt) > POLICY.slowMinGapMs;

      if(canTip && S.riskSm >= POLICY.riskThresholdTip){
        S.lastTipAt = nowMs;

        // choose tip by dominant issue
        const wh = windowRate(S.whiffs, t);
        const to = windowRate(S.timeouts, t);
        const rt = avgRT(t);

        let tip;
        if(to > wh && to > 0.6){
          tip = { type:'coach', title:'อย่าปล่อยให้หลุด!', sub:'เป้ากำลังหมดเวลา', mini:'เล็งให้แม่นก่อน 1 ทีพอ', tag:'SAVE' };
        }else if(wh > 0.8){
          tip = { type:'coach', title:'เล็งก่อนยิง', sub:'พลาดบ่อยไปนิด', mini:'ช้าแต่ชัวร์ = คอมโบยาว', tag:'AIM' };
        }else if(rt!=null && rt>650){
          tip = { type:'coach', title:'จับจังหวะให้ทัน', sub:'ช้าไปนิด', mini:'เป้าใกล้หมดเวลา = PERFECT', tag:'TIMING' };
        }else{
          tip = { type:'coach', title:'โฟกัสคอมโบ', sub:'กำลังแกว่ง', mini:'ยิงทีละเป้า อย่ารัว', tag:'FOCUS' };
        }

        emitTip({ ...tip, emo:'🧠', shouldBigPop: false });
      }

      // micro-slow suggestion (we do not force change; game can read desired scale)
      if(canSlow && S.riskSm >= POLICY.riskThresholdSlow){
        S.lastSlowAt = nowMs;
        emitTip({ type:'slow', emo:'🧊', title:'FOCUS MODE', sub:'ช้าลงนิดเพื่อไม่พลาด', mini:'อีกแป๊บเดียว!', tag:'SLOW', shouldBigPop:true });
        // expose to game
        S.slowUntil = nowMs + POLICY.slowDurationMs;
      }
    }

    function getAssist(){
      const nowMs = Date.now();
      const slowOn = !!S.slowUntil && nowMs < S.slowUntil;
      return {
        risk: S.riskSm || 0,
        slowOn,
        ttlScale: slowOn ? POLICY.slowFactor : 1
      };
    }

    return { onEvent, getAssist, getState: ()=>S };
  }

  // export
  WIN.HHA = WIN.HHA || {};
  WIN.HHA.createAIHooks = createAIHooks;
})();