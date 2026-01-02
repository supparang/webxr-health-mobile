// === /herohealth/vr-groups/ai-hooks.js ===
// PACK 15: AI Hooks — deterministic & disabled by default
// - Does NOT change gameplay by default (safe for research)
// - Collects telemetry and emits: hha:ai (kind, payload)
// - Provides seeded RNG for future Pattern Generator / Director
// Enable only with ?ai=1 in PLAY (run=play). run=research => forced OFF.

(function(){
  'use strict';
  const WIN = window;
  const NS = WIN.GroupsVR = WIN.GroupsVR || {};
  const AI = NS.AIHooks = NS.AIHooks || {};

  function emit(name, detail){
    try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
  }

  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  function hashSeed(str){
    str = String(str ?? '');
    let h = 2166136261 >>> 0;
    for (let i=0;i<str.length;i++){
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function makeRng(seedU32){
    let s = (seedU32>>>0) || 1;
    return function(){
      s = (Math.imul(1664525, s) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  let on = false;
  let runMode = 'play';
  let seed = '';
  let rng = null;

  // telemetry snapshot (lightweight)
  const S = {
    score:0, combo:0, misses:0,
    acc:0, grade:'C',
    storm:false, boss:false,
    goalPct:0, miniPct:0, miniLeft:0
  };

  function post(kind, payload){
    if (!on) return;
    emit('hha:ai', {
      kind,
      ts: Date.now(),
      runMode,
      seed,
      payload: payload || {}
    });
  }

  function detachListeners(){
    if (!AI._bound) return;
    AI._bound = false;

    WIN.removeEventListener('hha:score', AI._onScore);
    WIN.removeEventListener('hha:rank',  AI._onRank);
    WIN.removeEventListener('hha:judge', AI._onJudge);
    WIN.removeEventListener('groups:progress', AI._onProg);
    WIN.removeEventListener('quest:update', AI._onQuest);
  }

  function attachListeners(){
    if (AI._bound) return;
    AI._bound = true;

    AI._onScore = (ev)=>{
      const d = ev.detail||{};
      S.score = Number(d.score||0);
      S.combo = Number(d.combo||0);
      S.misses= Number(d.misses||0);
      post('state_score', { score:S.score, combo:S.combo, misses:S.misses });
    };

    AI._onRank = (ev)=>{
      const d = ev.detail||{};
      S.grade = String(d.grade||S.grade);
      S.acc   = Number(d.accuracy||S.acc);
      post('state_rank', { grade:S.grade, acc:S.acc });
    };

    AI._onJudge = (ev)=>{
      const d = ev.detail||{};
      const k = String(d.kind||'').toLowerCase();
      // minimal event feed for future explainable coach
      post('event_judge', { kind:k, text:String(d.text||'') });
    };

    AI._onProg = (ev)=>{
      const k = String((ev.detail||{}).kind||'').toLowerCase();
      if (k==='storm_on') S.storm = true;
      if (k==='storm_off') S.storm = false;
      if (k==='boss_spawn') S.boss = true;
      if (k==='boss_down')  S.boss = false;
      post('event_progress', { kind:k, storm:S.storm, boss:S.boss });
    };

    AI._onQuest = (ev)=>{
      const d = ev.detail||{};
      const gPct = Number(d.goalPct||0);
      const mPct = Number(d.miniPct||0);
      const mLeft= Number(d.miniTimeLeftSec||0);
      S.goalPct = clamp(gPct,0,100);
      S.miniPct = clamp(mPct,0,100);
      S.miniLeft= Math.max(0,mLeft|0);
      post('state_quest', { goalPct:S.goalPct, miniPct:S.miniPct, miniLeft:S.miniLeft });
    };

    WIN.addEventListener('hha:score', AI._onScore, {passive:true});
    WIN.addEventListener('hha:rank',  AI._onRank,  {passive:true});
    WIN.addEventListener('hha:judge', AI._onJudge, {passive:true});
    WIN.addEventListener('groups:progress', AI._onProg, {passive:true});
    WIN.addEventListener('quest:update', AI._onQuest, {passive:true});
  }

  // public API
  AI.attach = function(cfg){
    cfg = cfg || {};
    runMode = (String(cfg.runMode||'play').toLowerCase()==='research') ? 'research' : 'play';
    seed = String(cfg.seed ?? '');
    const enabled = !!cfg.enabled;

    // force OFF in research
    on = (runMode !== 'research') && enabled;

    rng = makeRng(hashSeed(seed + '::aihooks'));

    // bind/unbind
    detachListeners();
    if (on) attachListeners();

    post('ai_attach', { on, runMode, seed });
    return { on, runMode, seed };
  };

  AI.isOn = function(){ return !!on; };
  AI.rng = function(){ return rng || Math.random; };

})();