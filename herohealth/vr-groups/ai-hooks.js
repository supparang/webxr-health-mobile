// === /herohealth/vr-groups/ai-hooks.js ===
// GroupsVR AI Hooks — PRODUCTION (safe by default)
// ✅ attach({runMode, seed, enabled})
// ✅ Collects rolling window stats from events
// ✅ Predicts pMiss10s / pMiniFail (baseline now, ML model later)
// ✅ Emits: groups:ai:pred, hha:coach (rate-limited)
// ❌ Never runs in research/practice (caller must enforce too)

(function(root){
  'use strict';
  const NS = root.GroupsVR = root.GroupsVR || {};

  const clamp=(v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));
  const now=()=> (root.performance && performance.now) ? performance.now() : Date.now();

  function makeRing(n){
    const a=new Array(n); let i=0, len=0;
    return {
      push(x){ a[i]=x; i=(i+1)%n; len=Math.min(n,len+1); },
      toArray(){
        const out=[];
        for(let k=0;k<len;k++){
          const idx=(i-len+k+n)%n;
          out.push(a[idx]);
        }
        return out;
      },
      size(){ return len; }
    };
  }

  function rateLimit(ms){
    let t=0;
    return ()=>{ const x=now(); if(x-t>=ms){ t=x; return true; } return false; };
  }

  // -------- baseline predictor (PACK 20 will refine) --------
  function baselinePredict(f){
    // f: features
    // Simple logistic-ish mapping (0..1)
    const missPressure = (f.pressureLevel||0) * 0.16;
    const lowAcc = clamp((70 - (f.acc||0))/70, 0, 1) * 0.35;
    const missRate = clamp((f.missRate||0)*2.2, 0, 1) * 0.30;
    const storm = f.stormOn ? 0.12 : 0.0;
    const lowCombo = clamp((3 - (f.combo||0))/3, 0, 1) * 0.12;

    const pMiss10s = clamp(0.08 + missPressure + lowAcc + missRate + storm + lowCombo, 0, 0.98);

    let pMiniFail = 0.0;
    if (f.miniOn){
      const need = Math.max(1, f.miniNeed||1);
      const left = Math.max(1, f.miniLeft||1);
      const rate = Math.max(0, f.miniHitRate||0); // hits/sec recent
      const expected = rate * left;
      const gap = clamp((need - expected)/need, 0, 1);
      pMiniFail = clamp(0.10 + gap*0.75 + missRate*0.25, 0, 0.98);
    }
    const skillTrend = clamp((f.hitRate||0) - (f.missRate||0), -1, 1);
    return { pMiss10s, pMiniFail, skillTrend };
  }

  // -------- optional: ML model hook (TFJS) later --------
  async function tryLoadTfjsModel(url){
    // Placeholder: user can add tfjs and loadGraphModel later
    // Return null now to keep zero-dependency.
    return null;
  }

  NS.AIHooks = {
    attach(opts){
      opts = opts || {};
      const enabled = !!opts.enabled;
      const runMode = String(opts.runMode||'play');

      if(!enabled) return;
      if(runMode === 'research' || runMode === 'practice') return;

      const canTip = rateLimit(2200);

      // rolling window: last 30 judgements, last 12 seconds snapshots
      const judgeRing = makeRing(30);
      const snapRing  = makeRing(12);

      let state = {
        acc: 0, combo: 0, misses: 0, pressureLevel: 0,
        stormOn: false, timeLeft: 0,
        miniOn:false, miniNeed:0, miniLeft:0
      };

      // --- listen events from engine / UI ---
      const onScore = (ev)=>{
        const d=ev.detail||{};
        state.combo = Number(d.combo||0);
        state.misses= Number(d.misses||0);
      };
      const onTime = (ev)=>{
        const d=ev.detail||{};
        state.timeLeft = Number(d.left||0);
      };
      const onRank = (ev)=>{
        const d=ev.detail||{};
        state.acc = Number(d.accuracy||0);
      };
      const onProg = (ev)=>{
        const d=ev.detail||{};
        if(d.kind==='storm_on') state.stormOn = true;
        if(d.kind==='storm_off') state.stormOn = false;
        if(d.kind==='pressure') state.pressureLevel = Number(d.level||0);
      };
      const onQuest = (ev)=>{
        const d=ev.detail||{};
        // miniTimeLeftSec present only when mini on
        const on = (Number(d.miniTimeLeftSec||0) > 0) && (Number(d.miniTotal||0) > 1);
        state.miniOn = !!on;
        state.miniNeed = Number(d.miniTotal||0);
        state.miniLeft = Number(d.miniTimeLeftSec||0);
      };
      const onJudge = (ev)=>{
        const d=ev.detail||{};
        const k=String(d.kind||'');
        // interpret:
        // good = hit correct, bad = hit wrong/junk, miss = expire/miss, boss etc.
        judgeRing.push({ t: now(), kind:k });
      };

      root.addEventListener('hha:score', onScore, {passive:true});
      root.addEventListener('hha:time',  onTime,  {passive:true});
      root.addEventListener('hha:rank',  onRank,  {passive:true});
      root.addEventListener('groups:progress', onProg, {passive:true});
      root.addEventListener('quest:update', onQuest, {passive:true});
      root.addEventListener('hha:judge', onJudge, {passive:true});

      // --- compute features every 1s ---
      const tick = ()=>{
        const arr = judgeRing.toArray();
        let good=0,bad=0,miss=0;
        const tNow = now();
        const horizonMs = 9000;
        for(const x of arr){
          if(tNow - x.t > horizonMs) continue;
          if(x.kind==='good' || x.kind==='perfect' || x.kind==='boss') good++;
          else if(x.kind==='bad') bad++;
          else if(x.kind==='miss') miss++;
        }
        const total = Math.max(1, good+bad+miss);
        const hitRate = good / (horizonMs/1000);     // hits/sec approx
        const missRate= miss / (horizonMs/1000);
        const miniHitRate = hitRate;                // reuse

        const f = {
          acc: state.acc,
          combo: state.combo,
          misses: state.misses,
          pressureLevel: state.pressureLevel,
          stormOn: state.stormOn,
          timeLeft: state.timeLeft,
          hitRate, missRate,
          miniOn: state.miniOn,
          miniNeed: state.miniNeed,
          miniLeft: state.miniLeft,
          miniHitRate
        };

        snapRing.push({ t:tNow, f });

        const pred = baselinePredict(f);

        // emit prediction
        try{
          root.dispatchEvent(new CustomEvent('groups:ai:pred', { detail: { ...pred, f } }));
        }catch(_){}

        // micro-tips (rate-limited)
        if(canTip()){
          let tip = '';
          let mood = 'neutral';

          if(state.miniOn && pred.pMiniFail >= 0.65){
            tip = 'MINI เสี่ยงพลาด! ช้าลงนิด เล็งให้ชัวร์ แล้วค่อยยิง 🎯';
            mood = 'fever';
          } else if(pred.pMiss10s >= 0.65){
            tip = 'ระวัง! โอกาสพลาดสูง ล็อกเป้าก่อนยิง (อย่ายิงมั่ว) 👀';
            mood = 'sad';
          } else if(pred.skillTrend > 0.35){
            tip = 'ฟอร์มมาดี! รักษาคอมโบ แล้วเร่งเก็บเป้า 🔥';
            mood = 'happy';
          } else if(state.stormOn){
            tip = 'พายุอยู่! โฟกัสเป้ากลางจอ แล้วค่อยยิง ⚡';
            mood = 'fever';
          }

          if(tip){
            try{
              root.dispatchEvent(new CustomEvent('hha:coach', { detail:{ text: tip, mood } }));
            }catch(_){}
          }
        }

        if(state.timeLeft > 0 && state.timeLeft <= 3){
          // don't spam at clutch time
        }
      };

      const it = setInterval(tick, 1000);

      // clean up when game ends
      const onEnd = ()=>{
        clearInterval(it);
        root.removeEventListener('hha:score', onScore);
        root.removeEventListener('hha:time', onTime);
        root.removeEventListener('hha:rank', onRank);
        root.removeEventListener('groups:progress', onProg);
        root.removeEventListener('quest:update', onQuest);
        root.removeEventListener('hha:judge', onJudge);
        root.removeEventListener('hha:end', onEnd);
      };
      root.addEventListener('hha:end', onEnd, {passive:true});
    }
  };

})(window);