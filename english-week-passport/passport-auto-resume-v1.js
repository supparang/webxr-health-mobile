(function(){
'use strict';
const VERSION='2026-08-06-PASSPORT-AUTO-RESUME-V1';
const params=new URLSearchParams(location.search);
if(params.get('resume')!=='passport'){window.EW_PASSPORT_AUTO_RESUME={version:VERSION,active:false};return}
let started=false,attempts=0;
function identity(){try{return JSON.parse(localStorage.getItem(window.EW_CONFIG?.cacheKeys?.identity||'ew_passport_identity_v1')||'null')}catch(_){return null}}
function cleanUrl(){params.delete('resume');const query=params.toString();history.replaceState(null,'',location.pathname+(query?'?'+query:''))}
function run(){
  if(started)return;
  if(document.querySelector('.passport-map')){started=true;cleanUrl();return}
  const saved=identity(),form=document.getElementById('loginForm'),input=document.getElementById('playerId');
  if(!saved?.playerId||!form||!input){if(++attempts<180)setTimeout(run,120);return}
  started=true;input.value=saved.playerId;
  const nickname=document.getElementById('nickname');if(nickname)nickname.value=saved.nickname||saved.fullName||'';
  cleanUrl();
  const button=document.getElementById('loginStartBtn')||form.querySelector('button');
  if(button){
    button.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,pointerType:'touch'}));
    button.click();
  }else if(typeof form.requestSubmit==='function')form.requestSubmit();
  else form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
}
new MutationObserver(run).observe(document.getElementById('screen')||document.body,{childList:true,subtree:true});
setTimeout(run,80);
window.EW_PASSPORT_AUTO_RESUME={version:VERSION,active:true};
}());
