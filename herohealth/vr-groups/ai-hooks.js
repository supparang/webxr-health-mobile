/* === /herohealth/vr-groups/ai-hooks.js ===
AI Hooks + Realtime Predictor Stub — PRODUCTION (deterministic, safe)
✅ attach({runMode, seed, enabled}) called from groups-vr.html
✅ Predictor enabled only when:
   - runMode === 'play'
   - ?predict=1 (or true)
   - NOT in run=research / practice
✅ Emits: hha:predict { risk, willClutch, horizonSec, features, reason }
✅ Can emit micro-tips via hha:coach (rate-limited, explainable)
✅ Deterministic: uses seeded RNG only for tiny tie-break (optional)
*/

(function (root) {
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  const NS = (root.GroupsVR = root.GroupsVR || {});
  const emit = (n, d) => { try { root.dispatchEvent(new CustomEvent(n, { detail: d })); } catch (_) {} };

  function qs(k, def=null){
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  }
  function clamp(v, a, b){ v = Number(v); if (!isFinite(v)) v = a; return v<a?a:(v>b?b:v); }
  function nowMs(){ return (root.performance && performance.now) ? performance.now() : Date.now(); }

  // deterministic seed helpers (matches your style)
  function hashSeed(str) {
    str = String(str ?? '');
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function makeRng(seedU32) {
    let s = (seedU32 >>> 0) || 1;
    return function rand() {
      s = (Math.imul(1664525, s) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }
  function sigmoid(x){
    x = clamp(x, -12, 12);
    return 1 / (1 + Math.exp(-x));
  }

  function isPredictEnabled(runMode, enabledFlag){
    if (!enabledFlag) return false;
    if (String(runMode||'').toLowerCase() !== 'play') return false;

    // hard safety: if URL has run=research -> OFF
    const run = String(qs('run','play')||'play').toLowerCase();
    if (run === 'research') return false;

    const on = String(qs('predict','0')||'0');
    return (on === '1' || on === 'true');
  }

  function getPredictConfig(){
    return {
      horizonSec: clamp(qs('horizon', 10), 5, 30),
      // threshold for "clutch soon"
      thr: clamp(qs('predThr', 0.62), 0.40, 0.90),
      // how often predict runs
      everyMs: clamp(qs('predEvery', 480), 250, 1500),
      // coach tips
      tips: String(qs('predTips','1')||'1') !== '0',
      tipEveryMs: clamp(qs('tipEvery', 2600), 1200, 8000),
      // optional: make predictor a bit “harder/softer”
      bias: clamp(qs('predBias', 0.0), -0.8, 0.8)
    };
  }

  // ------- Predictor core (hand-crafted but ML-like, explainable) -------
  function computeRisk(feat, cfg){
    // features expected in 0..1-ish ranges where possible
    const acc = clamp(feat.acc, 0, 100) / 100;           // 0..1
    const missRate = clamp(feat.missRate, 0, 1);
    const comboN = clamp(feat.combo, 0, 20);
    const pressure = clamp(feat.pressure, 0, 3) / 3;     // 0..1
    const tLeft = clamp(feat.timeLeftSec, 0, 180);
    const nearEnd = clamp(1 - (tLeft / 60), 0, 1);       // 0 early -> 1 late (last 60s)
    const storm = feat.stormOn ? 1 : 0;
    const mini = feat.miniOn ? 1 : 0;

    // “good signs” reduce risk, “bad signs” increase risk
    // (ตีความ: risk = จะพลาด/หลุด clutch ใน horizon ต่อไป)
    const z =
      (+2.40 * missRate) +
      (+1.45 * pressure) +
      (+0.70 * storm) +
      (+0.35 * mini) +
      (+0.85 * nearEnd) +
      (-2.20 * acc) +
      (-0.06 * comboN) +
      (Number(cfg.bias)||0);

    const risk = sigmoid(z);

    // reasons (top drivers)
    const reasons = [];
    if (missRate >= 0.18) reasons.push('missRateสูง');
    if (pressure >= 0.66) reasons.push('pressureสูง');
    if (acc <= 0.72) reasons.push('accuracyต่ำ');
    if (storm) reasons.push('storm');
    if (mini) reasons.push('mini');
    if (nearEnd >= 0.55) reasons.push('ใกล้หมดเวลา');

    return { risk, reasons };
  }

  function pickMicroTip(feat, pred){
    // explainable, short, kid-friendly
    const t = clamp(feat.timeLeftSec, 0, 999);
    const acc = feat.acc|0;
    const missRate = feat.missRate;
    const combo = feat.combo|0;
    const pressure = feat.pressure|0;

    if (pred.risk >= 0.80){
      if (pressure >= 2) return { text:'หยุดยิงมั่ว 1 วิ แล้วเล็งให้ตรงหมู่ก่อนนะ! 🎯', mood:'sad' };
      if (missRate >= 0.22) return { text:'โฟกัส “ถูกหมู่เดียว” ก่อน ค่อยยิงเร็วขึ้นนะ 👀', mood:'fever' };
      return { text:'ช้าลงนิดเดียว แล้วจะกลับมาคอมโบได้! 💪', mood:'neutral' };
    }
    if (pred.risk >= 0.62){
      if (t <= 12) return { text:'ใกล้หมดเวลา! เล็งกลางจอแล้วแตะยิงให้แม่น! 🔥', mood:'fever' };
      if (acc < 75) return { text:'ลองเล็งให้โดน “หมู่ที่ถูก” ก่อนนะ คะแนนจะพุ่ง! ✅', mood:'neutral' };
      return { text:'ดีอยู่! แต่อย่าโดนขยะนะ 🗑️', mood:'neutral' };
    }
    if (pred.risk <= 0.30){
      if (combo >= 8) return { text:'คอมโบสวยมาก! รักษาจังหวะนี้ไว้! ✨', mood:'happy' };
      return { text:'กำลังดี! ยิงต่อได้เลย 😄', mood:'happy' };
    }
    // mid
    return { text:'ตั้งใจเล็งอีกนิด เดี๋ยว rank จะขึ้นเอง! 🏅', mood:'neutral' };
  }

  // ------- AIHooks runtime -------
  const AI = {
    _attached:false,
    _enabled:false,
    _runMode:'play',
    _seed:'0',
    _rng:null,
    _cfg:null,
    _timer:0,
    _lastTipAt:0,
    _state:{
      // live stats from events
      score:0, combo:0, misses:0, acc:0, grade:'C',
      timeLeftSec:90,
      stormOn:false,
      miniOn:false,
      // rolling window
      lastK:[], // recent outcomes: 1=good,0=bad (from judge)
      lastKmax: 18
    },

    attach(opts){
      opts = opts || {};
      const runMode = String(opts.runMode||'play').toLowerCase();
      const seed = String(opts.seed||'0');
      const enabledFlag = !!opts.enabled;

      this._runMode = runMode;
      this._seed = seed;
      this._cfg = getPredictConfig();
      this._rng = makeRng(hashSeed(seed + '::ai-hooks'));

      this._enabled = isPredictEnabled(runMode, enabledFlag);

      if (this._attached) return;
      this._attached = true;

      // listen game signals
      root.addEventListener('hha:score', (ev)=>{
        const d = ev.detail||{};
        this._state.score = Number(d.score??0)|0;
        this._state.combo = Number(d.combo??0)|0;
        this._state.misses= Number(d.misses??0)|0;
      }, {passive:true});

      root.addEventListener('hha:time', (ev)=>{
        const d = ev.detail||{};
        this._state.timeLeftSec = Math.max(0, Number(d.left??0));
      }, {passive:true});

      root.addEventListener('hha:rank', (ev)=>{
        const d = ev.detail||{};
        this._state.grade = String(d.grade ?? 'C');
        this._state.acc = Number(d.accuracy ?? 0);
      }, {passive:true});

      root.addEventListener('groups:progress', (ev)=>{
        const d = ev.detail||{};
        if (d.kind === 'storm_on') this._state.stormOn = true;
        if (d.kind === 'storm_off') this._state.stormOn = false;
      }, {passive:true});

      root.addEventListener('quest:update', (ev)=>{
        const d = ev.detail||{};
        // mini is on when miniTimeLeftSec > 0
        const left = Number(d.miniTimeLeftSec||0);
        this._state.miniOn = (left > 0);
      }, {passive:true});

      root.addEventListener('hha:judge', (ev)=>{
        const d = ev.detail||{};
        const k = String(d.kind||'');
        // judge kinds: good/bad/miss/boss/storm/perfect ...
        let ok = null;
        if (k === 'good' || k === 'perfect' || k === 'boss') ok = 1;
        else if (k === 'bad' || k === 'miss') ok = 0;

        if (ok != null){
          const arr = this._state.lastK;
          arr.push(ok);
          while (arr.length > this._state.lastKmax) arr.shift();
        }
      }, {passive:true});

      root.addEventListener('hha:end', ()=>{
        this._stopLoop();
      }, {passive:true});

      this._startLoop();
    },

    _startLoop(){
      this._stopLoop();
      const loop = ()=>{
        if (!this._enabled) return;
        this._predictTick();
        this._timer = setTimeout(loop, this._cfg.everyMs);
      };
      this._timer = setTimeout(loop, this._cfg.everyMs);
    },

    _stopLoop(){
      if (this._timer){ clearTimeout(this._timer); this._timer = 0; }
    },

    _predictTick(){
      const s = this._state;

      // rolling missRate: from lastK
      let missRate = 0;
      if (s.lastK.length){
        let bad=0;
        for (let i=0;i<s.lastK.length;i++) if (s.lastK[i]===0) bad++;
        missRate = bad / s.lastK.length;
      } else {
        // fallback: misses per 20 score events (rough)
        missRate = clamp((s.misses / 20), 0, 1);
      }

      // pressure proxy (align with engine: 0..3)
      let pressure = 0;
      if (s.misses >= 14) pressure = 3;
      else if (s.misses >= 9) pressure = 2;
      else if (s.misses >= 5) pressure = 1;

      const feat = {
        acc: clamp(s.acc, 0, 100),
        missRate,
        combo: clamp(s.combo, 0, 99),
        pressure,
        timeLeftSec: clamp(s.timeLeftSec, 0, 999),
        stormOn: !!s.stormOn,
        miniOn: !!s.miniOn
      };

      const pred = computeRisk(feat, this._cfg);
      const willClutch = (pred.risk >= this._cfg.thr);

      emit('hha:predict', {
        risk: +pred.risk.toFixed(4),
        willClutch: !!willClutch,
        horizonSec: this._cfg.horizonSec|0,
        features: feat,
        reason: pred.reasons.slice(0, 3)
      });

      // micro tips (optional)
      if (this._cfg.tips){
        const t = nowMs();
        if (t - this._lastTipAt >= this._cfg.tipEveryMs){
          this._lastTipAt = t;

          // reduce spam: only talk when risk is meaningful, OR occasionally when very good
          const talk =
            (pred.risk >= 0.62) ||
            (pred.risk <= 0.28 && (this._rng() < 0.35));

          if (talk){
            const tip = pickMicroTip(feat, { risk: pred.risk, willClutch });
            emit('hha:coach', { text: tip.text, mood: tip.mood });
          }
        }
      }
    }
  };

  NS.AIHooks = AI;

})(typeof window !== 'undefined' ? window : globalThis);