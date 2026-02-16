// === /herohealth/vr-brush/brush.ml.js ===
// ML/DL Dataset Builder v20260216c
(function(){
  'use strict';
  const WIN = window;
  const KEY = 'HHA_ML_DATASET::brush';

  function safeNum(x,d=0){ const n=Number(x); return Number.isFinite(n)?n:d; }

  function load(){ try{ return JSON.parse(localStorage.getItem(KEY)||'[]'); }catch(_){ return []; } }
  function save(arr){ try{ localStorage.setItem(KEY, JSON.stringify(arr.slice(-200))); }catch(_){ } }

  function makeWindow(n=60){
    return {
      n, a: [],
      push(x){ this.a.push(x); if(this.a.length>this.n) this.a.shift(); },
      mean(k){
        if(!this.a.length) return 0;
        let s=0;
        for(const it of this.a) s += safeNum(it[k],0);
        return s/this.a.length;
      },
      last(){ return this.a.length ? this.a[this.a.length-1] : null; }
    };
  }

  const S = {
    runId:null, t0:0,
    wShots: makeWindow(40),
    wHits:  makeWindow(40),
    wMiss:  makeWindow(40),
    wFeat:  makeWindow(60),
    hazardLaser:0, hazardShock:0, whiff:0,
    reset(){
      this.runId=null; this.t0=0;
      this.wShots=makeWindow(40);
      this.wHits=makeWindow(40);
      this.wMiss=makeWindow(40);
      this.wFeat=makeWindow(60);
      this.hazardLaser=0; this.hazardShock=0; this.whiff=0;
    }
  };

  WIN.addEventListener('hha:start', (ev)=>{
    S.reset();
    const d = ev?.detail || {};
    S.t0 = Date.now();
    S.runId = `${d.seed||Date.now()}::${d.pid||'anon'}::${S.t0}`;
  });

  WIN.addEventListener('hha:event', (ev)=>{
    const e = ev?.detail || {};
    const type = String(e.type||'').toLowerCase();
    if(type==='whiff') S.whiff += 1;
    if(type==='boss_nohit_laser') S.hazardLaser += 1;
    if(type==='boss_nohit_shock') S.hazardShock += 1;

    if(type==='feat'){
      const f = e.f || {};
      const t = Date.now();
      const last = S.wFeat.last();
      const dt = last ? Math.max(1, t - last.t) : 999;

      const shots = safeNum(f.shots,0);
      const hits  = safeNum(f.hits,0);
      const miss  = safeNum(f.miss,0);

      const dShots = last ? Math.max(0, shots - last.shots) : 0;
      const dHits  = last ? Math.max(0, hits  - last.hits)  : 0;
      const dMiss  = last ? Math.max(0, miss  - last.miss)  : 0;

      const spm = (dShots * 60000) / dt;
      const hpm = (dHits  * 60000) / dt;
      const mpm = (dMiss  * 60000) / dt;

      S.wShots.push({v:spm});
      S.wHits.push({v:hpm});
      S.wMiss.push({v:mpm});

      S.wFeat.push({ t, dt, shots, hits, miss });
    }
  });

  WIN.addEventListener('hha:end', (ev)=>{
    const sum = ev?.detail || {};
    if(String(sum.game)!=='brush') return;

    const episode = {
      id: S.runId,
      ts: Date.now(),
      ctx: {
        pid: sum.pid||'',
        seed: sum.seed,
        diff: sum.diff,
        view: sum.view,
        timePlannedSec: sum.timePlannedSec
      },
      y: {
        reason: sum.reason,
        grade: sum.grade,
        score: sum.score,
        accuracyPct: sum.accuracyPct,
        cleanPct: sum.cleanPct,
        timePlayedSec: sum.timePlayedSec
      },
      x: {
        shotsPerMin_avg: Math.round(S.wShots.mean('v')*10)/10,
        hitsPerMin_avg:  Math.round(S.wHits.mean('v')*10)/10,
        missPerMin_avg:  Math.round(S.wMiss.mean('v')*10)/10,
        last: sum.ml_lastFeat || {},
        hazardLaser: S.hazardLaser,
        hazardShock: S.hazardShock,
        whiff: S.whiff,
        eventsCount: safeNum(sum.ml_events, 0),
        comboMax: sum.comboMax,
        miss: sum.miss
      }
    };

    const arr = load();
    arr.push(episode);
    save(arr);

    console.log('[BrushML] episode saved:', episode);
    console.log('[BrushML] dataset size:', arr.length);
  });
})();