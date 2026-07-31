(()=>{
'use strict';
const RELEASE='20260731-GAME-SHELL-HANDWASH-SCHEMA-V2-R49';
const QUEUE_KEY='herohealth_backend_queue_v10_full';
const V2='HH-UNIFIED-GAME-ANALYTICS-V2';

if(!/\/HeroHealth_Learning1\/game-shell-authority-r40\.html$/i.test(String(location.pathname||'')))return;
const query=new URLSearchParams(location.search);
if(String(query.get('gameId')||'').trim()!=='handwash')return;

const nativeStringify=JSON.stringify.bind(JSON);
const nativeParse=JSON.parse.bind(JSON);

function normalizePayload(payload){
  if(!payload||typeof payload!=='object')return payload;
  const game=payload.game;
  if(!game||String(game.gameId||game.game_id||'').trim()!=='handwash')return payload;
  const previous=String(game.analyticsSchemaVersion||'').trim();
  game.analyticsSchemaVersion=V2;
  game.schemaCompatibilityRelease=RELEASE;
  if(previous&&previous!==V2)game.transportSchemaVersionOriginal=previous;
  return payload;
}

function normalizeJson(text){
  if(typeof text!=='string'||text.indexOf('handwash')<0)return text;
  try{
    const value=nativeParse(text);
    if(Array.isArray(value)){
      let changed=false;
      value.forEach(row=>{
        const before=row?.game?.analyticsSchemaVersion;
        normalizePayload(row);
        if(before!==row?.game?.analyticsSchemaVersion)changed=true;
      });
      return changed?nativeStringify(value):text;
    }
    const before=value?.game?.analyticsSchemaVersion;
    normalizePayload(value);
    return before!==value?.game?.analyticsSchemaVersion?nativeStringify(value):text;
  }catch(_){return text}
}

const nativeSubmit=HTMLFormElement.prototype.submit;
HTMLFormElement.prototype.submit=function(){
  try{
    const field=this.querySelector('input[name="payload"]');
    if(field)field.value=normalizeJson(field.value);
  }catch(error){console.warn('[Handwash Schema R49 form]',error)}
  return nativeSubmit.call(this);
};

const nativeFetch=window.fetch.bind(window);
window.fetch=function(input,init){
  try{
    if(init&&typeof init.body==='string'){
      init={...init,body:normalizeJson(init.body)};
    }
  }catch(error){console.warn('[Handwash Schema R49 fetch]',error)}
  return nativeFetch(input,init);
};

const nativeSetItem=Storage.prototype.setItem;
Storage.prototype.setItem=function(key,value){
  try{
    if(String(key)===QUEUE_KEY&&typeof value==='string')value=normalizeJson(value);
  }catch(error){console.warn('[Handwash Schema R49 storage]',error)}
  return nativeSetItem.call(this,key,value);
};

function repairQueue(){
  try{
    const raw=localStorage.getItem(QUEUE_KEY);
    if(!raw)return;
    const fixed=normalizeJson(raw);
    if(fixed!==raw)nativeSetItem.call(localStorage,QUEUE_KEY,fixed);
  }catch(error){console.warn('[Handwash Schema R49 queue]',error)}
}

repairQueue();
setInterval(repairQueue,1200);
window.HHHandwashSchemaV2R49={release:RELEASE,normalizePayload,repairQueue};
console.info('[Game Shell Handwash Schema V2 R49] installed',RELEASE);
})();
