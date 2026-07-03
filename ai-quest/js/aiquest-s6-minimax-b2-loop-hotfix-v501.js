/* CSAI2102 AI Quest — S6/B2 roadmap render guard v5.0.1 */
(function(){
  'use strict';
  const PROGRESS_KEY='CSAI2102_AIQUEST_V16_M1_GOOGLE_SHEETS';
  function signature(){
    try{return localStorage.getItem(PROGRESS_KEY)||'';}catch(error){return String(Date.now());}
  }
  function install(){
    const roadmap=window.AIQuestRoadmap;
    if(!roadmap || typeof roadmap.render!=='function' || roadmap.render.__aiquestV501Guard) return false;
    const original=roadmap.render;
    let last='__not_rendered__';
    const guarded=function(){
      const current=signature();
      if(current===last) return;
      last=current;
      return original.apply(this,arguments);
    };
    guarded.__aiquestV501Guard=true;
    guarded.__legacyRender=original;
    roadmap.render=guarded;
    return true;
  }
  install();
  const retry=setInterval(()=>{ if(install()) clearInterval(retry); },250);
  setTimeout(()=>clearInterval(retry),4000);
  console.log('[AIQuest] S6/B2 render guard v5.0.1 loaded');
})();
