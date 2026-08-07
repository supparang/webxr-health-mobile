(function(){
  'use strict';

  const cfg = window.EW_CONFIG || {};
  const source = window.EW_AUTHORITY || {};
  const VERSION = '2026-08-07-ASSESSMENT-CHECKPOINT-BRIDGE-V1';
  const CACHE_PREFIX = 'ew_assessment_checkpoint_v1::';

  const clean = value => String(value == null ? '' : value).trim();
  const key = (playerId, assessmentType) => `${CACHE_PREFIX}${clean(playerId)}::${clean(assessmentType).toLowerCase()}`;

  function endpoint(){
    const raw = clean(cfg.firebaseAuthorityUrl);
    if(!raw) return '';
    try{
      const url = new URL(raw);
      url.pathname = url.pathname.replace(/\/englishWeekAuthority\/?$/i, '/englishWeekAssessmentCheckpoint');
      url.search = '';
      return url.toString();
    }catch(_){ return ''; }
  }

  function endpointReady(){
    return /^https:\/\/[a-z0-9-]+-[a-z0-9-]+\.cloudfunctions\.net\/englishWeekAssessmentCheckpoint\/?$/i.test(endpoint());
  }

  function saveLocal(checkpoint){
    if(!checkpoint?.playerId || !checkpoint?.assessmentType) return;
    try{ localStorage.setItem(key(checkpoint.playerId, checkpoint.assessmentType), JSON.stringify(checkpoint)); }catch(_){}
  }

  function getLocal(playerId, assessmentType){
    try{ return JSON.parse(localStorage.getItem(key(playerId, assessmentType)) || 'null'); }
    catch(_){ return null; }
  }

  function clearLocal(playerId, assessmentType){
    try{ localStorage.removeItem(key(playerId, assessmentType)); }catch(_){}
  }

  async function remote(action, payload){
    if(!endpointReady()) throw new Error('ASSESSMENT_CHECKPOINT_ENDPOINT_MISSING');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Number(cfg.requestTimeoutMs || 12000));
    try{
      const response = await fetch(endpoint(), {
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          'X-EW-App-Id':String(cfg.appId || 'ENGLISH-WEEK-PASSPORT-2026')
        },
        body:JSON.stringify({
          ...(payload || {}),
          action,
          appId:cfg.appId || 'ENGLISH-WEEK-PASSPORT-2026',
          sourceVersion:String(payload?.sourceVersion || cfg.version || VERSION)
        }),
        signal:controller.signal,
        cache:'no-store',
        keepalive:action === 'save' || action === 'clear'
      });
      const data = await response.json().catch(() => null);
      if(!response.ok || data?.ok === false) throw new Error(data?.error || `CHECKPOINT_HTTP_${response.status}`);
      return data;
    }finally{
      clearTimeout(timer);
    }
  }

  async function saveAssessmentCheckpoint(payload){
    const checkpoint = {
      ...(payload || {}),
      playerId:clean(payload?.playerId),
      assessmentType:clean(payload?.assessmentType).toLowerCase(),
      savedAt:new Date().toISOString(),
      bridgeVersion:VERSION
    };
    saveLocal(checkpoint);
    try{
      const result = await remote('save', checkpoint);
      if(result?.checkpoint) saveLocal(result.checkpoint);
      return result;
    }catch(error){
      console.warn('Assessment checkpoint Firebase save fallback', error);
      return {ok:true, mode:'local-fallback', checkpoint, firebaseError:String(error?.message || error), version:VERSION};
    }
  }

  async function getAssessmentCheckpoint(playerId, assessmentType){
    const id = clean(playerId);
    const type = clean(assessmentType).toLowerCase();
    try{
      const result = await remote('get', {playerId:id, assessmentType:type});
      if(result?.checkpoint) saveLocal(result.checkpoint);
      else clearLocal(id, type);
      return result;
    }catch(error){
      const checkpoint = getLocal(id, type);
      return {ok:true, mode:'local-fallback', checkpoint, firebaseError:String(error?.message || error), version:VERSION};
    }
  }

  async function clearAssessmentCheckpoint(playerId, assessmentType){
    const id = clean(playerId);
    const type = clean(assessmentType).toLowerCase();
    clearLocal(id, type);
    try{ return await remote('clear', {playerId:id, assessmentType:type}); }
    catch(error){ return {ok:true, mode:'local-fallback', cleared:true, firebaseError:String(error?.message || error), version:VERSION}; }
  }

  window.EW_AUTHORITY = Object.freeze({
    ...source,
    saveAssessmentCheckpoint,
    getAssessmentCheckpoint,
    clearAssessmentCheckpoint,
    assessmentCheckpointEndpoint:endpoint,
    assessmentCheckpointEndpointReady:endpointReady,
    assessmentCheckpointVersion:VERSION
  });
}());
