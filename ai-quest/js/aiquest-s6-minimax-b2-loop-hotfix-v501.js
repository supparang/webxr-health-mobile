/* CSAI2102 AI Quest — S6 Minimax migration + roadmap render guard v5.0.2 */
(function(){
  'use strict';
  const PROGRESS_KEY='CSAI2102_AIQUEST_V16_M1_GOOGLE_SHEETS';
  const MIGRATION_KEY='s6MinimaxRealignmentV500';
  const RELOAD_KEY='AIQUEST_S6_MINIMAX_MIGRATION_RELOAD_V500';
  function read(){try{return JSON.parse(localStorage.getItem(PROGRESS_KEY)||'{}')||{};}catch(error){return {};}}
  function write(state){try{localStorage.setItem(PROGRESS_KEY,JSON.stringify(state));return true;}catch(error){return false;}}
  function passed(state,id){return !!((state.completed&&state.completed[id])||(state.stars&&Number(state.stars[id]||0)>0)||(state.mastered&&state.mastered[id])||(state.bestScore&&Number(state.bestScore[id]||0)>=60));}
  function snapshot(state,id){return {completed:!!(state.completed&&state.completed[id]),stars:Number(state.stars&&state.stars[id]||0),mastered:!!(state.mastered&&state.mastered[id]),bestScore:state.bestScore&&state.bestScore[id]!=null?Number(state.bestScore[id]):null};}
  function clear(state,id){['completed','stars','mastered','bestScore','bestTime'].forEach(key=>{if(state[key]&&Object.prototype.hasOwnProperty.call(state[key],id))delete state[key][id];});}
  function migrate(){
    const state=read();
    if(state[MIGRATION_KEY]&&state[MIGRATION_KEY].applied)return false;
    const invalidated=[];
    const archive=state.legacyCurriculumArchive&&typeof state.legacyCurriculumArchive==='object'?state.legacyCurriculumArchive:{};
    if(passed(state,'m6')){archive.s6KnowledgeBeforeMinimax={...snapshot(state,'m6'),archivedAt:new Date().toISOString(),reason:'S6 was realigned from Knowledge Base Forge to Minimax Arena.'};clear(state,'m6');invalidated.push('S6');}
    if(passed(state,'b2')){archive.b2KnowledgeBeforeMinimax={...snapshot(state,'b2'),archivedAt:new Date().toISOString(),reason:'B2 was realigned to assess UCS, A*, and Minimax.'};clear(state,'b2');invalidated.push('B2');}
    state.legacyCurriculumArchive=archive;
    state[MIGRATION_KEY]={applied:true,version:'v5.0.2',appliedAt:new Date().toISOString(),invalidated,rationale:'S6/B2 evidence was realigned to the approved Minimax curriculum.'};
    write(state);
    if(invalidated.length){
      try{if(sessionStorage.getItem(RELOAD_KEY)!=='1'){sessionStorage.setItem(RELOAD_KEY,'1');setTimeout(()=>location.reload(),80);}}catch(error){}
    }
    return invalidated.length>0;
  }
  if(migrate())return;
  function signature(){try{return localStorage.getItem(PROGRESS_KEY)||'';}catch(error){return String(Date.now());}}
  function install(){
    const roadmap=window.AIQuestRoadmap;
    if(!roadmap||typeof roadmap.render!=='function'||roadmap.render.__aiquestV501Guard)return false;
    const original=roadmap.render;let last='__not_rendered__';
    const guarded=function(){const current=signature();if(current===last)return;last=current;return original.apply(this,arguments);};
    guarded.__aiquestV501Guard=true;guarded.__legacyRender=original;roadmap.render=guarded;return true;
  }
  install();
  const retry=setInterval(()=>{if(install())clearInterval(retry);},250);
  setTimeout(()=>clearInterval(retry),4000);
  console.log('[AIQuest] S6 Minimax migration/render guard v5.0.2 loaded');
})();
