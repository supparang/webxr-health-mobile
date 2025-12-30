/* === /herohealth/vr-groups/groups-ai.js ===
GroupsVR AI Director (PLAY: adaptive ON / RESEARCH: adaptive OFF)
- Tracks: accuracy, misses, combo trend, reaction time EWMA
- Outputs: spawnMs, ttlMs, sizeBase, junkBias, decoyBias, bossEvery, lockPx (aim assist)
- Assist: highlight correct targets when struggling (soft help, fair)
- Emits: hha:adaptive (explainable), hha:coach (tips)
*/
(function(root){
  'use strict';
  const NS = (root.GroupsVR = root.GroupsVR || {});
  const emit = (name, detail)=>{ try{ root.dispatchEvent(new CustomEvent(name,{detail:detail||{}})); }catch{} };

  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
  function lerp(a,b,t){ return a + (b-a)*t; }
  function now(){ return (root.performance && root.performance.now) ? root.performance.now() : Date.now(); }

  function ewma(prev, x, alpha){
    if (!isFinite(prev)) return x;
    return prev + alpha*(x - prev);
  }

  // Difficulty presets (base) by diff (easy/normal/hard) — used in both modes
  const BASE = {
    easy:   { spawnMs:900, ttlMs:1750, size:1.05, junk:0.10, decoy:0.08, bossEvery:22000, lockPx:102 },
    normal: { spawnMs:780, ttlMs:1600, size:1.00, junk:0.12, decoy:0.10, bossEvery:19000, lockPx:96  },
    hard:   { spawnMs:680, ttlMs:1450, size:0.92, junk:0.16, decoy:0.12, bossEvery:16500, lockPx:88  },
  };

  function pickBase(diff){
    diff = String(diff||'normal').toLowerCase();
    return BASE[diff] || BASE.normal;
  }

  // Main AI state
  const AI = {
    reset(opts={}){
      AI.runMode = String(opts.runMode||'play').toLowerCase();
      AI.diff = String(opts.diff||'normal').toLowerCase();

      const b = pickBase(AI.diff);
      AI.out = {
        spawnMs: b.spawnMs, ttlMs: b.ttlMs, size: b.size,
        junk: b.junk, decoy: b.decoy, bossEvery: b.bossEvery,
        lockPx: b.lockPx,
      };

      AI.accE = NaN;         // 0..1
      AI.rtE  = NaN;         // ms
      AI.missE= NaN;         // per second-ish proxy
      AI.comboE=NaN;         // streak trend
      AI.lastCoachAt = 0;
      AI.lastAdaptAt = 0;
      AI.assistLevel = 0;    // 0..1 (highlight strength)
      AI._missCountAtLast = 0;
      AI._timeAtLast = now();
      AI._lastTick = now();
      AI._lastSkill = 0.5;
      AI._stable = 0;
    },

    observeFrame(state){
      // state: {left, hitGood, hitAll, combo, misses, avgRtGoodMs?}
      const t = now();
      const dt = Math.max(0.001, (t - AI._lastTick)/1000);
      AI._lastTick = t;

      const hitAll = Number(state.hitAll||0);
      const hitGood = Number(state.hitGood||0);
      const acc = (hitAll>0) ? (hitGood/hitAll) : 0.0;

      AI.accE = ewma(AI.accE, acc, 0.07);

      // miss-rate proxy from delta misses
      const m = Number(state.misses||0);
      const dm = m - (AI._missCountAtLast||0);
      AI._missCountAtLast = m;
      AI.missE = ewma(AI.missE, clamp(dm/dt, 0, 6), 0.08);

      const c = Number(state.combo||0);
      AI.comboE = ewma(AI.comboE, clamp(c/18, 0, 2), 0.06);

      // RT EWMA: if engine gives it; else keep previous
      const rt = Number(state.avgRtGoodMs||0);
      if (isFinite(rt) && rt>0) AI.rtE = ewma(AI.rtE, rt, 0.06);

      // compute skill score 0..1
      const accS = clamp((AI.accE - 0.55) / 0.40, 0, 1);                 // 0 at 55%, 1 at 95%
      const rtS  = isFinite(AI.rtE) ? clamp((850 - AI.rtE) / 520, 0, 1) : 0.4;  // faster => higher
      const missS= clamp(1 - (AI.missE/2.4), 0, 1);                       // fewer misses => higher
      const comboS = clamp(AI.comboE/0.9, 0, 1);

      // weighted blend
      let skill = 0.42*accS + 0.22*rtS + 0.22*missS + 0.14*comboS;
      // hysteresis smoothing
      skill = lerp(AI._lastSkill, skill, 0.12);
      AI._lastSkill = skill;

      // assist level rises when struggling
      const struggle = clamp((0.62 - (AI.accE||0)) / 0.20, 0, 1);  // acc below 62% -> assist
      const panic    = clamp((AI.missE||0)/1.8, 0, 1);
      AI.assistLevel = lerp(AI.assistLevel, clamp(0.65*struggle + 0.55*panic, 0, 1), 0.10);

      // Only adapt in PLAY mode
      if (AI.runMode === 'research') return;

      // adapt every ~2.2s
      if (t - AI.lastAdaptAt < 2200) return;
      AI.lastAdaptAt = t;

      const b = pickBase(AI.diff);

      // target difficulty factor: 0..1
      const d = skill;

      // harder when skill higher: faster spawn, shorter ttl, smaller size, more junk/decoy, more frequent boss
      const spawnMs = clamp( lerp(b.spawnMs*1.08, b.spawnMs*0.78, d), 420, 980 );
      const ttlMs   = clamp( lerp(b.ttlMs*1.10,  b.ttlMs*0.82,  d), 1100, 1900 );
      const size    = clamp( lerp(b.size*1.06,  b.size*0.92,   d), 0.82, 1.10 );

      // fairness: junk/decoy increases more gently
      const junk    = clamp( lerp(b.junk*0.92,  b.junk*1.20,   d), 0.06, 0.26 );
      const decoy   = clamp( lerp(b.decoy*0.92, b.decoy*1.18,  d), 0.05, 0.22 );

      // boss frequency
      const bossEvery = clamp( lerp(b.bossEvery*1.12, b.bossEvery*0.78, d), 14000, 26000 );

      // aim assist lock: larger when struggling, smaller when strong (more precision required)
      const lockPx = clamp( lerp(b.lockPx*1.10, b.lockPx*0.86, d) + (AI.assistLevel*14), 70, 130 );

      // smooth outputs
      AI.out.spawnMs = Math.round( lerp(AI.out.spawnMs, spawnMs, 0.28) );
      AI.out.ttlMs   = Math.round( lerp(AI.out.ttlMs,   ttlMs,   0.28) );
      AI.out.size    = +lerp(AI.out.size, size, 0.22).toFixed(3);
      AI.out.junk    = +lerp(AI.out.junk, junk, 0.22).toFixed(3);
      AI.out.decoy   = +lerp(AI.out.decoy, decoy, 0.22).toFixed(3);
      AI.out.bossEvery = Math.round( lerp(AI.out.bossEvery, bossEvery, 0.22) );
      AI.out.lockPx  = Math.round( lerp(AI.out.lockPx, lockPx, 0.30) );

      emit('hha:adaptive', {
        skill:+skill.toFixed(3),
        assist:+AI.assistLevel.toFixed(3),
        out:{...AI.out},
        why:{
          acc:+(AI.accE||0).toFixed(3),
          rtE:Math.round(AI.rtE||0),
          missE:+(AI.missE||0).toFixed(3),
          comboE:+(AI.comboE||0).toFixed(3)
        }
      });

      // Coach tips (not spam)
      if (t - AI.lastCoachAt > 6000){
        AI.lastCoachAt = t;
        if (AI.assistLevel > 0.65){
          emit('hha:coach', { mood:'sad', text:'โฟกัส “หมู่ปัจจุบัน” ก่อนนะ 👀 เดี๋ยว AI ช่วยไฮไลต์เป้าที่ถูกให้เบา ๆ' });
        } else if (skill > 0.78){
          emit('hha:coach', { mood:'happy', text:'โหดได้! 🎯 AI เร่งสปีดให้นิดนะ… ระวัง DEC0Y/JUNK!' });
        } else {
          emit('hha:coach', { mood:'neutral', text:'ดีเลย! รักษาคอมโบ แล้วสับหมู่ให้เร็ว ⚡' });
        }
      }
    },

    // expose output
    get(){
      return { ...AI.out, assistLevel: AI.assistLevel||0 };
    }
  };

  NS.AI = AI;

})(typeof window!=='undefined'?window:globalThis);