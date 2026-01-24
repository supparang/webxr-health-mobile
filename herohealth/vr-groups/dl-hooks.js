// === /herohealth/vr-groups/dl-hooks.js ===
// Deep Learning hooks (DL-ready dataset builder) — SAFE
// ✅ Builds supervised labels: miss_next_5s from events timeline
// ✅ Produces fixed-size feature vectors (32 dims) per sample
// ✅ Stores into summary.mlTrace.dl = { horizonSec, rows[], columns[] }
// Enable:
// - research: ON by default
// - play: only when ?dl=1 (recommended for data collection runs)

(function(){
  'use strict';
  const WIN = window;

  const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number(v)||0));
  const emit=(n,d)=>{ try{ WIN.dispatchEvent(new CustomEvent(n,{detail:d})); }catch(_){} };

  // simple z-ish normalization (bounded) to keep features stable
  const nz = (v,scale)=> clamp((Number(v)||0)/scale, -3, 3);

  // 32-dim encoder (handcrafted; stable; deterministic)
  function encode32(s){
    // expects fields from sample:
    // tSec, leftSec, score, combo, misses, accGoodPct, pressure, storm,
    // miniOn, miniNeed, miniNow, miniForbidJunk, miniOk, spawnEveryMs,
    // goodSpawned, wrongSpawned, junkSpawned, bossSpawned,
    // hitGood, hitWrong, hitJunk, expGood, expWrong, expJunk, viewCode
    const t = Number(s.tSec)||0;
    const left = Number(s.leftSec)||0;

    const acc = clamp(s.accGoodPct,0,100);
    const combo = clamp(s.combo,0,40);
    const misses = clamp(s.misses,0,60);
    const pressure = clamp(s.pressure,0,3);
    const storm = s.storm?1:0;

    const miniOn = s.miniOn?1:0;
    const miniNeed = clamp(s.miniNeed||0,0,10);
    const miniNow  = clamp(s.miniNow||0,0,10);
    const miniGap  = miniOn ? clamp((miniNeed-miniNow)/Math.max(1,miniNeed),0,1) : 0;
    const miniOk   = (s.miniOk==null)?1:(s.miniOk?1:0);
    const miniForbid = s.miniForbidJunk?1:0;

    const spawnMs = clamp(s.spawnEveryMs||650, 250, 1200);
    const speedHard = clamp((720 - spawnMs)/720, 0, 1);

    // counts (normalized)
    const hitG = Number(s.hitGood)||0;
    const hitW = Number(s.hitWrong)||0;
    const hitJ = Number(s.hitJunk)||0;

    const expG = Number(s.expGood)||0;
    const expW = Number(s.expWrong)||0;
    const expJ = Number(s.expJunk)||0;

    const gSp = Number(s.goodSpawned)||0;
    const wSp = Number(s.wrongSpawned)||0;
    const jSp = Number(s.junkSpawned)||0;

    // view one-hot: pc/mobile/vr/cvr => viewCode 0..3
    const vc = clamp(s.viewCode||1,0,3)|0;
    const v_pc = (vc===0)?1:0;
    const v_mo = (vc===1)?1:0;
    const v_vr = (vc===2)?1:0;
    const v_cv = (vc===3)?1:0;

    // feature vector (32)
    const f = new Array(32).fill(0);

    // time / progress
    f[0] = nz(t, 30);            // game time
    f[1] = nz(left, 30);         // time left
    f[2] = nz(s.score||0, 400);  // score scaled
    f[3] = nz(combo, 10);
    f[4] = nz(misses, 10);

    // skill / pressure
    f[5] = nz(acc-70, 20);       // centered around 70%
    f[6] = nz(pressure, 1);
    f[7] = storm;

    // mini
    f[8]  = miniOn;
    f[9]  = miniGap;
    f[10] = miniOk;
    f[11] = miniForbid;

    // difficulty proxies
    f[12] = speedHard;
    f[13] = nz(spawnMs-650, 200);

    // hit/expire counters (coarse rates)
    f[14] = nz(hitG, 20);
    f[15] = nz(hitW, 10);
    f[16] = nz(hitJ, 10);
    f[17] = nz(expG, 10);
    f[18] = nz(expW, 10);
    f[19] = nz(expJ, 10);

    // spawn counts
    f[20] = nz(gSp, 25);
    f[21] = nz(wSp, 20);
    f[22] = nz(jSp, 20);

    // ratios (safe)
    const totSpawn = Math.max(1, gSp+wSp+jSp);
    f[23] = clamp(gSp/totSpawn, 0, 1);
    f[24] = clamp(wSp/totSpawn, 0, 1);
    f[25] = clamp(jSp/totSpawn, 0, 1);

    const totHit = Math.max(1, hitG+hitW+hitJ);
    f[26] = clamp(hitG/totHit, 0, 1);
    f[27] = clamp(hitW/totHit, 0, 1);
    f[28] = clamp(hitJ/totHit, 0, 1);

    // view one-hot
    f[29] = v_pc;
    f[30] = v_mo;
    f[31] = v_cv ? 1 : 0; // (keep 32 dims; vr implicit when others 0)

    return f;
  }

  function buildLabels(samples, events, horizonSec){
    // label=1 if miss-like event occurs within (t, t+horizon]
    // miss-like: kind in {miss, bad} with why includes wrong/junk/expire_good/mini_fail, or explicit miss event.
    const horizonMs = (Number(horizonSec)||5) * 1000;

    // normalize event time in ms since start: we expect events to contain tSec or tMs
    const evs = (events||[]).map(e=>{
      const tSec = (e.tSec!=null)?Number(e.tSec):null;
      const tMs  = (e.tMs!=null)?Number(e.tMs): (tSec!=null ? tSec*1000 : null);
      return Object.assign({}, e, { _tMs: tMs });
    }).filter(e=>isFinite(e._tMs)).sort((a,b)=>a._tMs-b._tMs);

    function isMissLike(e){
      const k = String(e.kind||'');
      const why = String(e.why||'');
      if (k==='miss') return true;
      if (k==='bad') return true;
      if (why.includes('wrong') || why.includes('junk') || why.includes('expire_good') || why.includes('mini_fail')) return true;
      return false;
    }

    let j=0;
    const labels = new Array(samples.length).fill(0);

    for (let i=0;i<samples.length;i++){
      const s = samples[i];
      const tMs = (Number(s.tSec)||0)*1000;

      // advance pointer to events after tMs
      while (j<evs.length && evs[j]._tMs <= tMs) j++;

      let k=j;
      const endMs = tMs + horizonMs;
      let hit=0;
      while (k<evs.length && evs[k]._tMs <= endMs){
        if (isMissLike(evs[k])) { hit=1; break; }
        k++;
      }
      labels[i]=hit;
    }
    return labels;
  }

  const DL = {
    enabled:false,
    runMode:'play',
    horizonSec:5,
    setEnabled(on, runMode){
      DL.enabled = !!on;
      DL.runMode = String(runMode||'play');
      if (DL.enabled){
        emit('hha:coach', { text:'DL hooks พร้อมเก็บข้อมูล (สำหรับเทรนโมเดล) 🧠', mood:'neutral' });
      }
    },
    build(summary){
      if (!DL.enabled) return summary;

      const ml = summary?.mlTrace;
      const samples = ml?.samples || [];
      const events  = ml?.events  || [];
      if (!samples.length) return summary;

      const labels = buildLabels(samples, events, DL.horizonSec);

      const columns = ['tSec','label_miss_next_5s'];
      for (let i=0;i<32;i++) columns.push('f'+i);

      const rows = samples.map((s, idx)=>{
        const f = encode32(s);
        const row = { tSec: Number(s.tSec)||0, label_miss_next_5s: labels[idx] };
        for (let i=0;i<32;i++) row['f'+i] = Number(f[i].toFixed(6));
        return row;
      });

      summary.mlTrace = summary.mlTrace || {};
      summary.mlTrace.dl = {
        horizonSec: DL.horizonSec,
        columns,
        rows
      };
      return summary;
    }
  };

  // decide enable:
  function readParam(k, def){
    try{ return new URL(location.href).searchParams.get(k) ?? def; }catch(_){ return def; }
  }
  const dlParam = String(readParam('dl','0')||'0');
  const dlOn = (dlParam==='1' || dlParam==='true');

  // We enable in research always; in play only if ?dl=1
  WIN.addEventListener('hha:start', (ev)=>{
    const d=ev.detail||{};
    const runMode = String(d.runMode||d.mode||'play');
    const on = (runMode==='research') ? true : dlOn;
    DL.setEnabled(on, runMode);
  }, {passive:true});

  // On end: attach dataset into summary before UI stores it
  WIN.addEventListener('hha:end', (ev)=>{
    try{
      const s = ev.detail||{};
      DL.build(s);
    }catch(_){}
  }, {passive:true});

  WIN.GroupsVR = WIN.GroupsVR || {};
  WIN.GroupsVR.DLHooks = DL;
})();