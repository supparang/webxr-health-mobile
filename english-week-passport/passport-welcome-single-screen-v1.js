(function(){
  'use strict';
  const VERSION='2026-08-07-PASSPORT-WELCOME-SINGLE-SCREEN-V1';
  const screen=document.getElementById('screen');
  if(!screen)return;

  function sync(){
    const active=Boolean(screen.querySelector('#startPreBtn'));
    screen.classList.toggle('welcome-mode',active);
    document.body.classList.toggle('ew-welcome-single-screen',active);
  }

  sync();
  new MutationObserver(sync).observe(screen,{childList:true,subtree:true});
  window.EW_WELCOME_SINGLE_SCREEN=Object.freeze({version:VERSION});
}());
