// === /herohealth/vr/hha-cloud-logger.js ===
// HHA Cloud Logger — Universal (beacon-first, keepalive fallback)
// Listens: hha:start, hha:end, hha:log (optional)
// Saves last summary + ships to Google Apps Script endpoint.

(function(ROOT){
  'use strict';
  const DOC = ROOT.document;

  // ✅ put your endpoint here (or pass via ?log=)
  const DEFAULT_ENDPOINT = (function(){
    // You can hardcode your Apps Script URL here if you want:
    // return "https://script.google.com/macros/s/XXXXX/exec";
    return null;
  })();

  function qs(k, def=null){
    try{ return new URL(location.href).searchParams.get(k) ?? def; }
    catch{ return def; }
  }

  function nowIso(){ return new Date().toISOString(); }

  // ---------- transport ----------
  function postJSON(url, obj){
    if(!url) return Promise.resolve({ok:false, skipped:true});
    const body = JSON.stringify(obj);

    // beacon first
    try{
      if(navigator.sendBeacon){
        const blob = new Blob([body], { type:'application/json' });
        const ok = navigator.sendBeacon(url, blob);
        if(ok) return Promise.resolve({ok:true, via:'beacon'});
      }
    }catch(_){}

    // fetch keepalive fallback
    try{
      return fetch(url, {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body,
        keepalive:true,
        mode:'no-cors' // Apps Script often returns CORS issues; no-cors still sends
      }).then(()=>({ok:true, via:'fetch-keepalive'}))
        .catch((e)=>({ok:false, err:String(e)}));
    }catch(e){
      return Promise.resolve({ok:false, err:String(e)});
    }
  }

  // ---------- schema mapping ----------
  // We accept partial summary/meta and map to your sheet columns.
  function toRowPayload(meta, summary){
    const s = summary || {};
    const m = meta || {};
    const url = new URL(location.href);

    // Standard fields (match your sheet header names where possible)
    return {
      timestampIso: nowIso(),
      projectTag: s.projectTag || m.projectTag || '',
      runMode: s.runMode || m.runMode || qs('run','play'),
      studyId: s.studyId || m.studyId || qs('study', qs('studyId','')),
      phase: s.phase || m.phase || qs('phase',''),
      conditionGroup: s.conditionGroup || m.conditionGroup || qs('cond', qs('conditionGroup','')),
      sessionOrder: s.sessionOrder || m.sessionOrder || qs('order',''),
      blockLabel: s.blockLabel || m.blockLabel || qs('block',''),
      siteCode: s.siteCode || m.siteCode || qs('site',''),
      schoolYear: s.schoolYear || m.schoolYear || qs('sy',''),
      semester: s.semester || m.semester || qs('sem',''),
      sessionId: s.sessionId || m.sessionId || qs('sid',''),
      gameMode: s.gameMode || m.gameMode || qs('mode',''),
      diff: s.diff || m.diff || qs('diff','normal'),
      durationPlannedSec: s.durationPlannedSec ?? m.durationPlannedSec ?? Number(qs('time','0')||0),
      durationPlayedSec: s.durationPlayedSec ?? 0,

      scoreFinal: s.scoreFinal ?? 0,
      comboMax: s.comboMax ?? 0,
      misses: s.misses ?? 0,

      goalsCleared: s.goalsCleared ?? 0,
      goalsTotal: s.goalsTotal ?? 0,
      miniCleared: s.miniCleared ?? 0,
      miniTotal: s.miniTotal ?? 0,

      nTargetGoodSpawned: s.nTargetGoodSpawned ?? 0,
      nTargetJunkSpawned: s.nTargetJunkSpawned ?? 0,
      nTargetStarSpawned: s.nTargetStarSpawned ?? 0,
      nTargetDiamondSpawned: s.nTargetDiamondSpawned ?? 0,
      nTargetShieldSpawned: s.nTargetShieldSpawned ?? 0,

      nHitGood: s.nHitGood ?? 0,
      nHitJunk: s.nHitJunk ?? 0,
      nHitJunkGuard: s.nHitJunkGuard ?? 0,
      nExpireGood: s.nExpireGood ?? 0,

      accuracyGoodPct: s.accuracyGoodPct ?? 0,
      junkErrorPct: s.junkErrorPct ?? 0,
      avgRtGoodMs: s.avgRtGoodMs ?? 0,
      medianRtGoodMs: s.medianRtGoodMs ?? 0,
      fastHitRatePct: s.fastHitRatePct ?? 0,

      device: s.device || m.view || qs('view','mobile'),
      gameVersion: s.gameVersion || m.gameVersion || '',
      reason: s.reason || '',

      startTimeIso: s.startTimeIso || m.startTimeIso || '',
      endTimeIso: s.endTimeIso || '',

      // extra debug
      seed: s.seed ?? m.seed ?? qs('seed',''),
      url: url.toString()
    };
  }

  // ---------- state ----------
  let START_META = null;
  let END_SENT = false;
  let ENDPOINT = qs('log', DEFAULT_ENDPOINT);

  // allow setting globally too
  if(!ENDPOINT && ROOT.HHA_LOG_ENDPOINT) ENDPOINT = ROOT.HHA_LOG_ENDPOINT;

  function saveLocal(key, val){
    try{ localStorage.setItem(key, JSON.stringify(val)); }catch(_){}
  }
  function loadLocal(key){
    try{ return JSON.parse(localStorage.getItem(key)||'null'); }catch(_){ return null; }
  }

  async function sendEnd(summary){
    if(END_SENT) return;
    END_SENT = true;

    const row = toRowPayload(START_META, summary);
    saveLocal('HHA_LAST_SENT', row);

    // Wrap payload for Apps Script
    const payload = { kind:'hha_end', row };

    await postJSON(ENDPOINT, payload);
  }

  // expose flush function
  ROOT.HHA_LOGGER = {
    flush: async function(reason='manual'){
      const last = loadLocal('HHA_LAST_SUMMARY');
      if(!last) return {ok:false, skipped:true};
      last.reason = last.reason || reason;
      return sendEnd(last);
    }
  };

  // ---------- listeners ----------
  ROOT.addEventListener('hha:start', (ev)=>{
    START_META = ev?.detail || {};
    END_SENT = false;
    // persist start meta (useful for resume)
    saveLocal('HHA_LAST_START', START_META);
  }, { passive:true });

  ROOT.addEventListener('hha:end', (ev)=>{
    const summary = ev?.detail || {};
    // ensure local summary stored (even if game didn't)
    saveLocal('HHA_LAST_SUMMARY', summary);
    sendEnd(summary);
  }, { passive:true });

  // optional event stream (not needed for sheet row)
  ROOT.addEventListener('hha:log', (ev)=>{
    // you can stream events later if desired
    // const e = ev?.detail || {};
  }, { passive:true });

})(window);