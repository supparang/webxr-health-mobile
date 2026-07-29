/* EAP Word Quest • Legacy name fallback loader -> Mobile V283 */
(function(){
  'use strict';
  if(window.__EAP_WORD_NAME_FALLBACK_V276_LOADER__)return;
  window.__EAP_WORD_NAME_FALLBACK_V276_LOADER__=true;
  function load(){
    if(window.__EAP_WORD_NAME_MOBILE_V283__)return;
    if(document.querySelector('script[data-eap-name-v283]'))return;
    var s=document.createElement('script');
    s.src='./eap-word-name-mobile-v283.js?v=20260729-v283-direct-1';
    s.async=false;
    s.setAttribute('data-eap-name-v283','1');
    s.onload=function(){console.info('[EAP Word Quest] Mobile name lookup V283 loaded');};
    s.onerror=function(){console.error('[EAP Word Quest] Mobile name lookup V283 failed to load');};
    document.head.appendChild(s);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load,{once:true});
  else load();
})();
