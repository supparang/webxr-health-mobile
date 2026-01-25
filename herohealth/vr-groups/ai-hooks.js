// === /herohealth/vr-groups/ai-hooks.js ===
// GroupsVR — AI Hooks (2A: ML-ready data)
// ✅ Collects shot/spawn/hit telemetry (local)
// ✅ Confusion matrix (activeKey -> targetKey when wrong)
// ✅ Export JSON via window.GroupsVR.AIHooks.export()
// ✅ Gated: enabled AND runMode==='play'
// ❌ No network, no sheet, no research pollution

(function(){
  'use strict';
  const WIN = window;
  const NS = (WIN.GroupsVR = WIN.GroupsVR || {});
  const LS_KEY = 'HHA_GROUPS_AI_DATA_V1';

  function nowMs(){ return (performance && performance.now) ? performance.now() : Date.now(); }
  function safeParse(json, def){ try{ return JSON.parse(json); }catch{ return def; } }

  const ST = {
    on: false,
    runMode: 'play',
    seed: '',
    startedAt: 0,

    // rolling snapshot from HUD events
    score: 0,
    combo: 0,
    miss: 0,
    acc: 0,
    left: 0,
    storm: 0,
    miniUrg: 0,
    groupKey: '',
    groupName: '',

    maxRows: 900,
    rows: [],
    confusion: {}
  };

  function pushRow(row){
    ST.rows.push(row);
    if (ST.rows.length > ST.maxRows) ST.rows.shift();
  }

  function bumpConf(activeKey, targetKey){
    if (!activeKey || !targetKey) return;
    const a = (ST.confusion[activeKey] = ST.confusion[activeKey] || {});
    a[targetKey] = (a[targetKey]||0) + 1;
  }

  function featureVec(){
    return {
      t: Math.round(nowMs()),
      left: ST.left|0,
      acc: ST.acc|0,
      combo: ST.combo|0,
      miss: ST.miss|0,
      storm: ST.storm|0,
      miniUrg: ST.miniUrg|0,
      groupKey: String(ST.groupKey||''),
      score: ST.score|0
    };
  }

  function saveLocal(){
    try{
      const payload = {
        v: 1,
        updatedAt: new Date().toISOString(),
        seed: ST.seed,
        rows: ST.rows.slice(-ST.maxRows),
        confusion: ST.confusion
      };
      localStorage.setItem(LS_KEY, JSON.stringify(payload));
    }catch(_){}
  }

  function loadLocal(){
    try{
      const p = safeParse(localStorage.getItem(LS_KEY)||'null', null);
      if (!p || p.v !== 1) return;
      ST.rows = Array.isArray(p.rows) ? p.rows.slice(-ST.maxRows) : [];
      ST.confusion = p.confusion || {};
    }catch(_){}
  }

  let bound = false;
  function bind(){
    if (bound) return;
    bound = true;

    WIN.addEventListener('hha:score', (ev)=>{
      if (!ST.on) return;
      const d = ev.detail||{};
      ST.score = Number(d.score ?? ST.score) || 0;
      ST.combo = Number(d.combo ?? ST.combo) || 0;
      ST.miss  = Number(d.misses ?? ST.miss) || 0;
    }, {passive:true});

    WIN.addEventListener('hha:time', (ev)=>{
      if (!ST.on) return;
      const d = ev.detail||{};
      ST.left = Math.max(0, Math.round(d.left ?? ST.left));
    }, {passive:true});

    WIN.addEventListener('hha:rank', (ev)=>{
      if (!ST.on) return;
      const d = ev.detail||{};
      ST.acc = Number(d.accuracy ?? ST.acc) || 0;
    }, {passive:true});

    WIN.addEventListener('quest:update', (ev)=>{
      if (!ST.on) return;
      const d = ev.detail||{};
      ST.groupKey  = String(d.groupKey || ST.groupKey || '');
      ST.groupName = String(d.groupName || ST.groupName || '');
      const leftMini = Number(d.miniTimeLeftSec || 0);
      ST.miniUrg = (leftMini>0 && leftMini<=3) ? 1 : 0;
    }, {passive:true});

    WIN.addEventListener('groups:progress', (ev)=>{
      if (!ST.on) return;
      const d = ev.detail||{};
      if (d.kind === 'storm_on') ST.storm = 1;
      if (d.kind === 'storm_off') ST.storm = 0;
      pushRow({ type:'progress', at: Date.now(), seed: ST.seed, runMode: ST.runMode, detail: d, f: featureVec() });
      saveLocal();
    }, {passive:true});

    WIN.addEventListener('groups:spawn', (ev)=>{
      if (!ST.on) return;
      const d = ev.detail||{};
      pushRow({ type:'spawn', at: Date.now(), seed: ST.seed, runMode: ST.runMode, d, f: featureVec() });
      saveLocal();
    }, {passive:true});

    WIN.addEventListener('groups:shot', (ev)=>{
      if (!ST.on) return;
      const d = ev.detail||{};
      pushRow({ type:'shot', at: Date.now(), seed: ST.seed, runMode: ST.runMode, d, f: featureVec() });
      saveLocal();
    }, {passive:true});

    WIN.addEventListener('groups:hit', (ev)=>{
      if (!ST.on) return;
      const d = ev.detail||{};
      if (d.kind === 'wrong' && d.activeKey && d.targetKey) bumpConf(d.activeKey, d.targetKey);
      pushRow({ type:'hit', at: Date.now(), seed: ST.seed, runMode: ST.runMode, d, f: featureVec() });
      saveLocal();
    }, {passive:true});
  }

  NS.AIHooks = NS.AIHooks || {};

  NS.AIHooks.attach = function(cfg){
    cfg = cfg || {};
    ST.runMode = String(cfg.runMode || 'play');
    ST.seed    = String(cfg.seed || '');
    ST.on      = !!cfg.enabled && (ST.runMode === 'play');

    if (ST.on){
      ST.startedAt = nowMs();
      loadLocal();
      bind();
      pushRow({ type:'ai_on', at: Date.now(), seed: ST.seed, runMode: ST.runMode, f: featureVec() });
      saveLocal();
    }
  };

  NS.AIHooks.export = function(){
    return {
      v: 1,
      exportedAtIso: new Date().toISOString(),
      seed: ST.seed,
      runMode: ST.runMode,
      rows: ST.rows.slice(),
      confusion: ST.confusion
    };
  };

  NS.AIHooks.reset = function(){
    ST.rows = [];
    ST.confusion = {};
    try{ localStorage.removeItem(LS_KEY); }catch(_){}
  };

})();