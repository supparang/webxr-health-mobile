/* === /herohealth/vr/hha-telemetry.js ===
HHA Universal Telemetry (ML/DL-ready)
✅ One row per second (window features)
✅ Works across games via config + event adapters
✅ Gated: runMode=play AND ?telemetry=1
✅ Research/Practice => force OFF
✅ Expose: window.HHA_TLM.start(cfg), stop(), finalize(), toCSV(), getRows()
✅ Store last dataset to localStorage: HHA_TLM_LAST_<gameTag>
*/

(function(root){
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  function qs(k, def=null){
    try { return new URL(location.href).searchParams.get(k) ?? def; } catch { return def; }
  }
  function nowMs(){ return (root.performance && performance.now) ? performance.now() : Date.now(); }
  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  function getRunMode(){
    const r = String(qs('run','play')||'play').toLowerCase();
    if (r === 'research') return 'research';
    if (r === 'practice') return 'practice';
    return 'play';
  }
  function telemetryEnabled(){
    if (getRunMode() !== 'play') return false;
    const t = String(qs('telemetry','0')||'0');
    return (t === '1' || t === 'true');
  }

  // ---------- Core state (standard) ----------
  const CORE = {
    gameTag:'HHA',
    view:String(qs('view','mobile')||'mobile'),
    diff:String(qs('diff','normal')||'normal'),
    style:String(qs('style','mix')||'mix'),
    seed:String(qs('seed','')||''),
    timePlannedSec:Number(qs('time',90)||90),

    startedAtMs:0,
    score:0, combo:0, miss:0, acc:0, left:0,
    phase:'', boss:0, storm:0, miniUrg:0,
    groupKey:'', groupName:'',
    // 1s counters
    c_shots:0,
    c_hit_good:0,
    c_hit_wrong:0,
    c_hit_junk:0,
    c_miss_evt:0
  };

  const rows = [];
  let it = 0;
  let lastTick = 0;

  // ---------- Helpers ----------
  function snapshot(tMs){
    const tSec = Math.max(0, Math.floor((tMs - CORE.startedAtMs)/1000));

    const accBad  = clamp((100 - CORE.acc)/100, 0, 1);
    const comboN  = clamp(CORE.combo/10, 0, 1);
    const leftLow = clamp((12 - CORE.left)/12, 0, 1);
    const missRate10 = calcMissRate10(tMs);

    const r = {
      tSec,
      iso: new Date().toISOString(),

      // context
      gameTag: CORE.gameTag,
      diff: CORE.diff,
      view: CORE.view,
      style: CORE.style,
      seed: CORE.seed,

      // high-level phase (optional)
      phase: CORE.phase || '',
      boss: CORE.boss|0,
      storm: CORE.storm|0,

      // raw state
      score: CORE.score|0,
      combo: CORE.combo|0,
      miss:  CORE.miss|0,
      acc:   CORE.acc|0,
      left:  CORE.left|0,
      miniUrg: CORE.miniUrg|0,

      groupKey: CORE.groupKey || '',
      groupName: CORE.groupName || '',

      // 1s counters
      shots_1s: CORE.c_shots|0,
      hit_good_1s: CORE.c_hit_good|0,
      hit_wrong_1s: CORE.c_hit_wrong|0,
      hit_junk_1s: CORE.c_hit_junk|0,
      miss_evt_1s: CORE.c_miss_evt|0,

      // features
      missRate10: +missRate10.toFixed(3),
      accBad: +accBad.toFixed(3),
      comboN: +comboN.toFixed(3),
      leftLow:+leftLow.toFixed(3),

      // labels (filled in finalize)
      y_next10_miss: null,
      y_next10_wrong: null,
      y_next10_junk: null
    };

    // reset 1s counters
    CORE.c_shots=0; CORE.c_hit_good=0; CORE.c_hit_wrong=0; CORE.c_hit_junk=0; CORE.c_miss_evt=0;

    rows.push(r);
  }

  function calcMissRate10(tMs){
    if (rows.length < 2) return 0;
    const cut = Math.max(0, tMs - 10000);

    // find earliest row within last ~10s
    let i0 = rows.length-1;
    while (i0>0){
      const prev = rows[i0-1];
      const prevMs = CORE.startedAtMs + (prev.tSec*1000);
      if (prevMs < cut) break;
      i0--;
    }
    const a = rows[i0];
    const b = rows[rows.length-1];
    const dt = Math.max(1, (b.tSec - a.tSec));
    const dm = Math.max(0, (b.miss - a.miss));
    return dm / dt;
  }

  function finalizeLabels(){
    for (let i=0;i<rows.length;i++){
      const baseMiss = rows[i].miss|0;
      let yMiss=0, yWrong=0, yJunk=0;

      for (let j=i+1; j<rows.length && (rows[j].tSec - rows[i].tSec) <= 10; j++){
        if ((rows[j].miss|0) > baseMiss) yMiss = 1;
        if ((rows[j].hit_wrong_1s|0) > 0) yWrong = 1;
        if ((rows[j].hit_junk_1s|0) > 0) yJunk = 1;
      }
      rows[i].y_next10_miss = yMiss;
      rows[i].y_next10_wrong= yWrong;
      rows[i].y_next10_junk = yJunk;
    }
  }

  function toCSV(){
    if (!rows.length) return '';
    const cols = Object.keys(rows[0]);
    const esc = (v)=>{
      const s = (v==null)?'':String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
    };
    const out = [cols.join(',')];
    for (const r of rows) out.push(cols.map(c=>esc(r[c])).join(','));
    return out.join('\n');
  }

  function saveLast(){
    const key = 'HHA_TLM_LAST_' + String(CORE.gameTag||'HHA');
    try{
      localStorage.setItem(key, JSON.stringify({
        meta:{
          createdIso:new Date().toISOString(),
          gameTag:CORE.gameTag, diff:CORE.diff, view:CORE.view, style:CORE.style,
          seed:CORE.seed, timePlannedSec:CORE.timePlannedSec
        },
        rows
      }));
    }catch(_){}
  }

  // ---------- Default adapters (standard events you already emit) ----------
  function bindDefaultEvents(){
    root.addEventListener('hha:score', (ev)=>{
      const d = ev.detail||{};
      CORE.score = Number(d.score ?? CORE.score) || 0;
      CORE.combo = Number(d.combo ?? CORE.combo) || 0;
      CORE.miss  = Number(d.misses ?? CORE.miss) || 0;
    }, {passive:true});

    root.addEventListener('hha:time', (ev)=>{
      const d = ev.detail||{};
      CORE.left = Math.max(0, Math.round(d.left ?? CORE.left));
    }, {passive:true});

    root.addEventListener('hha:rank', (ev)=>{
      const d = ev.detail||{};
      CORE.acc = Number(d.accuracy ?? CORE.acc) || 0;
    }, {passive:true});

    root.addEventListener('hha:shoot', ()=>{
      CORE.c_shots += 1;
    }, {passive:true});

    // judge helps tag good/bad (you already emit in Groups; if other games emit too => auto)
    root.addEventListener('hha:judge', (ev)=>{
      const d = ev.detail||{};
      const kind = String(d.kind||'');
      if (kind === 'good') CORE.c_hit_good += 1;
      if (kind === 'bad')  CORE.c_hit_wrong += 1; // safe default
      if (kind === 'miss') CORE.c_miss_evt += 1;
      if (kind === 'boss') CORE.boss = 1;
    }, {passive:true});
  }

  // Optional: let game tell phase/storm/mini/group via custom events
  function applyGameWiring(cfg){
    cfg = cfg || {};

    // allow custom event names (optional)
    const evProgress = cfg.progressEvent || '';     // e.g. 'groups:progress'
    const evQuest    = cfg.questEvent || 'quest:update';

    if (evQuest){
      root.addEventListener(evQuest, (ev)=>{
        const d = ev.detail||{};
        // mini urgent heuristics (support both styles)
        const mLeft = Number(d.miniTimeLeftSec ?? d.miniLeftSec ?? 0);
        CORE.miniUrg = (mLeft>0 && mLeft<=3) ? 1 : 0;

        CORE.groupKey  = String(d.groupKey||CORE.groupKey||'');
        CORE.groupName = String(d.groupName||CORE.groupName||'');
        CORE.phase     = String(d.phase||CORE.phase||'');
      }, {passive:true});
    }

    if (evProgress){
      root.addEventListener(evProgress, (ev)=>{
        const d = ev.detail||{};
        const k = String(d.kind||'');
        if (k === 'storm_on')  CORE.storm = 1;
        if (k === 'storm_off') CORE.storm = 0;
        if (k === 'boss_spawn') CORE.boss = 1;
        if (k === 'boss_down')  CORE.boss = 0;

        if (k === 'miss') CORE.c_miss_evt += 1;
        if (k === 'phase') CORE.phase = String(d.phase||CORE.phase||'');
      }, {passive:true});
    }

    // allow direct injection hooks (optional)
    if (typeof cfg.customBind === 'function'){
      try{ cfg.customBind(CORE); }catch(_){}
    }
  }

  // ---------- Public API ----------
  const API = {
    enabled: telemetryEnabled,
    start: (cfg)=>{
      if (!telemetryEnabled()) return false;

      cfg = cfg || {};
      CORE.gameTag = String(cfg.gameTag || 'HHA');
      CORE.view = String(cfg.view || CORE.view);
      CORE.diff = String(cfg.diff || CORE.diff);
      CORE.style= String(cfg.style|| CORE.style);
      CORE.seed = String(cfg.seed || CORE.seed);
      CORE.timePlannedSec = Number(cfg.timePlannedSec ?? CORE.timePlannedSec);

      CORE.startedAtMs = nowMs();
      lastTick = nowMs();

      bindDefaultEvents();
      applyGameWiring(cfg);

      clearInterval(it);
      it = setInterval(()=>{
        const t = nowMs();
        if (t - lastTick >= 900){
          lastTick = t;
          snapshot(t);
        }
      }, 250);

      return true;
    },
    stop: ()=>{
      clearInterval(it);
      it = 0;
    },
    getRows: ()=>rows.slice(),
    finalize: ()=>{
      finalizeLabels();
      saveLast();
      return rows.slice();
    },
    toCSV: ()=>toCSV(),
    getLastFromStorage: (gameTag)=>{
      const key = 'HHA_TLM_LAST_' + String(gameTag||'HHA');
      try{ return JSON.parse(localStorage.getItem(key)||'null'); }catch(_){ return null; }
    }
  };

  root.HHA_TLM = API;

})(typeof window!=='undefined' ? window : globalThis);