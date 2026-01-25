// === /herohealth/vr-groups/ai-hooks.js ===
// AI Hooks + Telemetry (NO SHEET)
// ✅ attach({runMode, seed, enabled})
// ✅ exportTelemetry() -> { seed, runMode, frames:[...] }
// ✅ setModel(model) / loadModel(url) (optional)
//
// frames: tick/event stream for ML/DL training
// NOTE: By policy: disabled in research; gated by ?ai=1 in play (caller decides)

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;

  WIN.GroupsVR = WIN.GroupsVR || {};

  const clamp = (v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };
  const nowMs = ()=> (performance && performance.now) ? performance.now() : Date.now();

  // -------------------------
  // Telemetry state
  // -------------------------
  const TEL = {
    enabled: false,
    runMode: 'play',
    seed: '',
    startIso: '',
    frames: [],
    maxFrames: 5000,

    // last known game state snapshot
    s: {
      score: 0,
      combo: 0,
      miss: 0,
      acc: 0,
      left: 0,
      storm: 0,
      miniUrg: 0,
      groupKey: '',
      groupName: ''
    }
  };

  function pushFrame(f){
    if (!TEL.enabled) return;
    f.t = Number(f.t ?? nowMs());
    TEL.frames.push(f);
    if (TEL.frames.length > TEL.maxFrames) TEL.frames.shift();
  }

  // -------------------------
  // Listen game events
  // -------------------------
  WIN.addEventListener('hha:score', (ev)=>{
    const d = ev.detail || {};
    TEL.s.score = Number(d.score ?? TEL.s.score) || 0;
    TEL.s.combo = Number(d.combo ?? TEL.s.combo) || 0;
    TEL.s.miss  = Number(d.misses ?? TEL.s.miss) || 0;
    pushFrame({ type:'score', score:TEL.s.score, combo:TEL.s.combo, miss:TEL.s.miss });
  }, {passive:true});

  WIN.addEventListener('hha:time', (ev)=>{
    const d = ev.detail || {};
    TEL.s.left = Math.max(0, Math.round(Number(d.left ?? TEL.s.left) || 0));
    pushFrame({ type:'time', left:TEL.s.left });
  }, {passive:true});

  WIN.addEventListener('hha:rank', (ev)=>{
    const d = ev.detail || {};
    TEL.s.acc = Number(d.accuracy ?? TEL.s.acc) || 0;
    pushFrame({ type:'rank', acc:TEL.s.acc, grade:String(d.grade||'') });
  }, {passive:true});

  WIN.addEventListener('quest:update', (ev)=>{
    const d = ev.detail || {};
    TEL.s.groupKey  = String(d.groupKey || TEL.s.groupKey || '');
    TEL.s.groupName = String(d.groupName|| TEL.s.groupName|| '');
    const mLeft  = Number(d.miniTimeLeftSec||0);
    TEL.s.miniUrg = (mLeft>0 && mLeft<=3) ? 1 : 0;
    pushFrame({ type:'quest', groupKey:TEL.s.groupKey, groupName:TEL.s.groupName, miniUrg:TEL.s.miniUrg, miniLeft:mLeft });
  }, {passive:true});

  WIN.addEventListener('groups:progress', (ev)=>{
    const d = ev.detail || {};
    const k = String(d.kind||'');
    if (k === 'storm_on')  TEL.s.storm = 1;
    if (k === 'storm_off') TEL.s.storm = 0;
    pushFrame({ type:'progress', kind:k, storm:TEL.s.storm });
  }, {passive:true});

  WIN.addEventListener('hha:shoot', (ev)=>{
    const d = ev.detail || {};
    pushFrame({ type:'shoot', x:d.x, y:d.y, source:String(d.source||'') });
  }, {passive:true});

  // This is emitted by your predictor/tips block already (optional)
  WIN.addEventListener('groups:ai_predict', (ev)=>{
    const d = ev.detail || {};
    pushFrame({ type:'ai_predict', r:d.r, missRate:d.missRate, acc:d.acc, combo:d.combo, left:d.left, storm:d.storm, miniU:d.miniU, group:d.group });
  }, {passive:true});

  WIN.addEventListener('hha:end', (ev)=>{
    const d = ev.detail || {};
    pushFrame({ type:'end', reason:String(d.reason||'end') });
  }, {passive:true});

  // -------------------------
  // Tick sampler (important for DL)
  // -------------------------
  let tickIt = 0;
  function startTick(){
    stopTick();
    tickIt = setInterval(()=>{
      if (!TEL.enabled) return;
      pushFrame({
        type:'tick',
        score: TEL.s.score|0,
        combo: TEL.s.combo|0,
        miss:  TEL.s.miss|0,
        acc:   TEL.s.acc|0,
        left:  TEL.s.left|0,
        storm: TEL.s.storm|0,
        miniUrg: TEL.s.miniUrg|0,
        groupKey: TEL.s.groupKey||'',
      });
    }, 250); // 4 Hz พอสำหรับ DL-lite/MLP
  }
  function stopTick(){
    clearInterval(tickIt);
    tickIt = 0;
  }

  // -------------------------
  // Model store (DL weights)
  // -------------------------
  let MODEL = null;

  function setModel(model){
    MODEL = model || null;
  }

  async function loadModel(url){
    const r = await fetch(url, { cache:'no-store' });
    if (!r.ok) throw new Error('loadModel failed: ' + r.status);
    const j = await r.json();
    setModel(j);
    return j;
  }

  function getModel(){
    return MODEL;
  }

  // -------------------------
  // Public API
  // -------------------------
  function attach(opts){
    opts = opts || {};
    TEL.runMode = String(opts.runMode || 'play');
    TEL.seed = String(opts.seed || '');
    TEL.enabled = !!opts.enabled;

    TEL.startIso = new Date().toISOString();
    TEL.frames = [];
    pushFrame({ type:'meta', startIso: TEL.startIso, runMode: TEL.runMode, seed: TEL.seed, ua: navigator.userAgent });

    if (TEL.enabled) startTick();
    else stopTick();
  }

  function exportTelemetry(){
    return {
      exportedAtIso: new Date().toISOString(),
      seed: TEL.seed,
      runMode: TEL.runMode,
      frames: TEL.frames.slice(0)
    };
  }

  WIN.GroupsVR.AIHooks = {
    attach,
    exportTelemetry,
    setModel,
    loadModel,
    getModel
  };

})();