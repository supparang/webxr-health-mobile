/* === /herohealth/vr-groups/ai-export.js ===
AI Export (local-first)
✅ Collects: groups:ai_choice, groups:ai_feature, groups:ai_predict, groups:dd_suggest
✅ Stores: HHA_AI_LOG_LAST, HHA_AI_LOG_HISTORY (last 40)
✅ API: GroupsVR.AIExport.start(runId), stop(), get(), copy(), clear()
*/
(function(root){
  'use strict';
  const NS = root.GroupsVR = root.GroupsVR || {};

  const LS_LAST = 'HHA_AI_LOG_LAST';
  const LS_HIST = 'HHA_AI_LOG_HISTORY';

  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));
  const nowIso = ()=>new Date().toISOString();

  function safeJsonParse(s, d){
    try{ return JSON.parse(String(s||'')); }catch{ return d; }
  }

  const LOG = {
    on:false,
    runId:'',
    startedAtIso:'',
    endedAtIso:'',
    meta:{},
    events:[], // {t, name, d}
    maxEvents: 2000
  };

  function pushEvt(name, detail){
    if (!LOG.on) return;
    if (LOG.events.length >= LOG.maxEvents) return;
    LOG.events.push({
      t: Date.now(),
      name: String(name||''),
      d: detail || {}
    });
  }

  function saveLast(){
    try{ localStorage.setItem(LS_LAST, JSON.stringify(LOG)); }catch(_){}
    try{
      const hist = safeJsonParse(localStorage.getItem(LS_HIST), []);
      hist.unshift(LOG);
      localStorage.setItem(LS_HIST, JSON.stringify(hist.slice(0, 40)));
    }catch(_){}
  }

  function getCtxMeta(){
    // best effort: piggyback on summary ctx if present
    let ctx = {};
    try{
      if (NS.getResearchCtx) ctx = NS.getResearchCtx() || {};
    }catch(_){}
    return ctx;
  }

  function start(runId, meta){
    LOG.on = true;
    LOG.runId = String(runId || ('GroupsVR:' + Date.now()));
    LOG.startedAtIso = nowIso();
    LOG.endedAtIso = '';
    LOG.meta = Object.assign({ game:'GroupsVR' }, getCtxMeta(), meta||{});
    LOG.events = [];
    pushEvt('ai:start', { runId: LOG.runId, meta: LOG.meta });
    return LOG.runId;
  }

  function stop(reason){
    if (!LOG.on) return;
    LOG.endedAtIso = nowIso();
    pushEvt('ai:stop', { reason: String(reason||'stop') });
    LOG.on = false;
    saveLast();
  }

  // listeners
  function onChoice(ev){ pushEvt('ai:choice', ev.detail||{}); }
  function onFeature(ev){ pushEvt('ai:feature', ev.detail||{}); }
  function onPredict(ev){ pushEvt('ai:predict', ev.detail||{}); }
  function onDDSuggest(ev){ pushEvt('ai:dd', ev.detail||{}); }
  function onEnd(ev){
    pushEvt('game:end', ev.detail||{});
    // auto-stop at end to freeze log
    stop('game_end');
  }

  root.addEventListener('groups:ai_choice', onChoice, {passive:true});
  root.addEventListener('groups:ai_feature', onFeature, {passive:true});
  root.addEventListener('groups:ai_predict', onPredict, {passive:true});
  root.addEventListener('groups:dd_suggest', onDDSuggest, {passive:true});
  root.addEventListener('hha:end', onEnd, {passive:true});

  async function copyToClipboard(text){
    try{ await navigator.clipboard.writeText(String(text||'')); return true; }
    catch{
      try{
        const ta = document.createElement('textarea');
        ta.value = String(text||'');
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        return true;
      }catch{ return false; }
    }
  }

  NS.AIExport = {
    start,
    stop,
    get: ()=>LOG,
    clear: ()=>{
      try{ localStorage.removeItem(LS_LAST); }catch(_){}
      try{ localStorage.removeItem(LS_HIST); }catch(_){}
    },
    copy: async ()=>{
      const ok = await copyToClipboard(JSON.stringify(LOG, null, 2));
      return ok;
    }
  };
})(typeof window!=='undefined'?window:globalThis);