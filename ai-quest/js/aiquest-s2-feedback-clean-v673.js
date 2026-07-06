/* CSAI2102 S2 Agent Builder feedback render fix v6.7.3 */
(()=>{'use strict';
  if(window.__AIQUEST_S2_FEEDBACK_CLEAN_V673__)return;
  window.__AIQUEST_S2_FEEDBACK_CLEAN_V673__=true;
  const clean=()=>{
    const node=document.getElementById('feedback');
    if(!node||!node.classList.contains('show'))return;
    const raw=String(node.textContent||'');
    if(raw.indexOf('<ul class="answerList">')<0)return;
    node.innerHTML=raw;
  };
  const watch=()=>{
    const arena=document.getElementById('arena');
    if(!arena)return;
    new MutationObserver(clean).observe(arena,{childList:true,subtree:true,characterData:true});
    clean();
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',watch,{once:true});else watch();
})();