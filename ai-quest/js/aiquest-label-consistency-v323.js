
(function(){
  'use strict';

  const VERSION='v3.2.3-teacher-label-consistency';

  function replaceTextNode(node){
    if(!node || node.nodeType !== 3) return;
    const s=node.nodeValue || '';
    // แก้เฉพาะ label ที่มองเห็น ไม่แตะ internal key m1
    const next=s
      .replace(/\bM1\b/g,'S1')
      .replace(/\bM2\b/g,'S2')
      .replace(/\bM3\b/g,'S3')
      .replace(/\bM4\b/g,'S4')
      .replace(/\bM5\b/g,'S5');
    if(next !== s) node.nodeValue=next;
  }

  function walk(root){
    const w=document.createTreeWalker(root || document.body, NodeFilter.SHOW_TEXT);
    let n;
    while((n=w.nextNode())) replaceTextNode(n);
  }

  function refresh(){
    try{ walk(document.body); }catch(e){}
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', refresh);
  else refresh();

  if(!window.__AIQUEST_LABEL_OBSERVER_V323){
    window.__AIQUEST_LABEL_OBSERVER_V323 = new MutationObserver(refresh);
    window.__AIQUEST_LABEL_OBSERVER_V323.observe(document.documentElement, {childList:true, subtree:true, characterData:true});
  }

  window.AIQUEST_LABEL_CONSISTENCY = {version:VERSION, refresh};
  console.log('[AIQuest] '+VERSION+' loaded', window.AIQUEST_LABEL_CONSISTENCY);
})();
