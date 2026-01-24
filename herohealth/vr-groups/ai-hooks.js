// === /herohealth/vr-groups/ai-hooks.js ===
// AI hooks attach point (disabled by default; play only with ?ai=1)
// Collects lightweight telemetry from events for future ML/DL training.
// API:
//   window.GroupsVR.AIHooks.attach({runMode, seed, enabled})
//   window.GroupsVR.AIHooks.exportTelemetry()  -> JSON object
//   window.GroupsVR.AIHooks.clearTelemetry()

(function(){
  'use strict';
  const W = window;
  const D = document;
  const NS = W.GroupsVR = W.GroupsVR || {};
  const AI = NS.AIHooks = NS.AIHooks || {};

  function qs(k, def=null){
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  }
  function nowMs(){ return (performance && performance.now) ? performance.now() : Date.now(); }
  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  const STATE = {
    on:false,
    runMode:'play',
    seed:'',
    startedAt:0,
    buf:[],           // telemetry frames
    max: 600,         // ~ 8 นาที @ 800ms
    last: { score:0, combo:0, miss:0, acc:0, left:0, group:'' }
  };

  function pushFrame(extra){
    if (!STATE.on) return;
    const t = nowMs();
    const f = Object.assign({
      t,
      score: STATE.last.score|0,
      combo: STATE.last.combo|0,
      miss:  STATE.last.miss|0,
      acc:   STATE.last.acc|0,
      left:  STATE.last.left|0,
      group: String(STATE.last.group||'')
    }, extra||{});
    STATE.buf.push(f);
    if (STATE.buf.length > STATE.max) STATE.buf.shift();
  }

  function onScore(ev){
    const d = ev.detail||{};
    STATE.last.score = Number(d.score ?? STATE.last.score) || 0;
    STATE.last.combo = Number(d.combo ?? STATE.last.combo) || 0;
    STATE.last.miss  = Number(d.misses ?? STATE.last.miss) || 0;
  }
  function onRank(ev){
    const d = ev.detail||{};
    STATE.last.acc = Number(d.accuracy ?? STATE.last.acc) || 0;
  }
  function onTime(ev){
    const d = ev.detail||{};
    STATE.last.left = Number(d.left ?? STATE.last.left) || 0;
  }
  function onQuest(ev){
    const d = ev.detail||{};
    STATE.last.group = String(d.groupKey || STATE.last.group || '');
  }

  function onAIPredict(ev){
    // from groups-vr.html predictor: {r, missRate, acc, combo, left, storm, miniU, group}
    const d = ev.detail||{};
    pushFrame({
      type:'ai_predict',
      r: Number(d.r ?? 0),
      missRate: Number(d.missRate ?? 0),
      storm: Number(d.storm ?? 0),
      miniU: Number(d.miniU ?? 0)
    });
  }

  function onProgress(ev){
    const d = ev.detail||{};
    const k = String(d.kind||'');
    pushFrame({ type:'progress', k, level: d.level, why: d.why });
  }

  AI.attach = function({runMode, seed, enabled}){
    runMode = String(runMode||'play').toLowerCase();
    seed = String(seed||'');
    enabled = !!enabled;

    // hard gate: research/practice OFF always
    if (runMode !== 'play') enabled = false;

    // also must pass ?ai=1 (your html already gates predictor, but keep safe)
    const aiParam = String(qs('ai','0')||'0');
    if (!(aiParam==='1' || aiParam==='true')) enabled = false;

    STATE.on = enabled;
    STATE.runMode = runMode;
    STATE.seed = seed;
    STATE.startedAt = nowMs();
    STATE.buf.length = 0;

    if (!STATE.on) return;

    // bind listeners once per attach
    W.addEventListener('hha:score', onScore, {passive:true});
    W.addEventListener('hha:rank',  onRank,  {passive:true});
    W.addEventListener('hha:time',  onTime,  {passive:true});
    W.addEventListener('quest:update', onQuest, {passive:true});
    W.addEventListener('groups:ai_predict', onAIPredict, {passive:true});
    W.addEventListener('groups:progress', onProgress, {passive:true});

    // periodic frame (features for future ML/DL)
    const it = setInterval(()=>{
      if (!STATE.on){ clearInterval(it); return; }
      pushFrame({ type:'tick' });
    }, 800);

    pushFrame({ type:'attach', seed: STATE.seed });
  };

  AI.exportTelemetry = function(){
    return {
      gameTag:'GroupsVR',
      seed: STATE.seed,
      runMode: STATE.runMode,
      startedAtMs: STATE.startedAt,
      frames: STATE.buf.slice(0)
    };
  };

  AI.clearTelemetry = function(){
    STATE.buf.length = 0;
  };

})();