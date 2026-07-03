/* CSAI2102 AI Quest — S6 Minimax migration, release fixes, and render guard v5.0.3 */
(function(){
  'use strict';
  const PROGRESS_KEY='CSAI2102_AIQUEST_V16_M1_GOOGLE_SHEETS';
  const MIGRATION_KEY='s6MinimaxRealignmentV500';
  const RELOAD_KEY='AIQUEST_S6_MINIMAX_MIGRATION_RELOAD_V500';
  const BAD_BACKUP='เลือก A เพราะ MIN จะส่งค่า 2 ขึ้นมา และ MAX เลือกค่าสูงสุดระหว่าง 2 กับ 5 คือ 5 จาก B';
  const GOOD_BACKUP='เลือก B เพราะ MIN จะส่งค่า 2 ขึ้นมา และ MAX เลือกค่าสูงสุดระหว่าง 2 กับ 5 คือ 5 จาก B';

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
    state[MIGRATION_KEY]={applied:true,version:'v5.0.3',appliedAt:new Date().toISOString(),invalidated,rationale:'S6/B2 evidence was realigned to the approved Minimax curriculum.'};
    write(state);
    if(invalidated.length){try{if(sessionStorage.getItem(RELOAD_KEY)!=='1'){sessionStorage.setItem(RELOAD_KEY,'1');setTimeout(()=>location.reload(),80);}}catch(error){}}
    return invalidated.length>0;
  }

  function repairVisibleMinimaxCopy(){
    const roots=[document.getElementById('gameArea'),document.getElementById('resultScreen')].filter(Boolean);
    roots.forEach(root=>{
      const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),nodes=[];let node;
      while((node=walker.nextNode()))nodes.push(node);
      nodes.forEach(textNode=>{
        if(String(textNode.nodeValue||'').includes(BAD_BACKUP)) textNode.nodeValue=String(textNode.nodeValue).split(BAD_BACKUP).join(GOOD_BACKUP);
      });
    });
  }

  function suppressAutoStart(ms){
    try{sessionStorage.setItem('AIQUEST_SUPPRESS_AUTOSTART_UNTIL',String(Date.now()+(ms||15000)));}catch(error){}
  }
  function isNewB2Context(){
    const heading=String(document.getElementById('gameHeading')?.textContent||'').toLowerCase();
    const body=String(document.body?.innerText||'').toLowerCase();
    return heading.includes('search & game ai boss gate')||body.includes('search & game ai boss gate');
  }
  function returnRoadmap(){
    suppressAutoStart(15000);
    try{if(typeof window.renderRoadmap==='function'){window.renderRoadmap();return true;}}catch(error){}
    try{if(typeof window.showRoadmap==='function'){window.showRoadmap();return true;}}catch(error){}
    try{if(window.AIQuestRoadmap&&typeof window.AIQuestRoadmap.render==='function'){window.AIQuestRoadmap.render();document.getElementById('menuScreen')?.classList.add('active');document.getElementById('gameScreen')?.classList.remove('active');document.getElementById('resultScreen')?.classList.remove('active');return true;}}catch(error){}
    return false;
  }
  function installNewB2Return(){
    if(window.__AIQUEST_B2_V503_RETURN)return;
    window.__AIQUEST_B2_V503_RETURN=true;
    document.addEventListener('click',event=>{
      const button=event.target&&event.target.closest?event.target.closest('#btnSaveResult'):null;
      if(!button||!isNewB2Context())return;
      suppressAutoStart(15000);
      setTimeout(()=>{if(returnRoadmap()&&typeof window.showToast==='function')window.showToast('บันทึก B2 แล้ว กลับหน้ารวมแล้ว');},900);
      setTimeout(returnRoadmap,2200);
    },true);
  }

  function signature(){try{return localStorage.getItem(PROGRESS_KEY)||'';}catch(error){return String(Date.now());}}
  function installRenderGuard(){
    const roadmap=window.AIQuestRoadmap;
    if(!roadmap||typeof roadmap.render!=='function'||roadmap.render.__aiquestV501Guard)return false;
    const original=roadmap.render;let last='__not_rendered__';
    const guarded=function(){const current=signature();if(current===last)return;last=current;return original.apply(this,arguments);};
    guarded.__aiquestV501Guard=true;guarded.__legacyRender=original;roadmap.render=guarded;return true;
  }

  function boot(){
    if(migrate())return;
    installNewB2Return();
    repairVisibleMinimaxCopy();
    const observer=new MutationObserver(repairVisibleMinimaxCopy);
    observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
    installRenderGuard();
    const retry=setInterval(()=>{if(installRenderGuard())clearInterval(retry);},250);
    setTimeout(()=>clearInterval(retry),4000);
    console.log('[AIQuest] S6 Minimax migration/release guard v5.0.3 loaded');
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
