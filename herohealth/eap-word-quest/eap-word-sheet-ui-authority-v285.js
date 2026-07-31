/* =========================================================
   EAP Word Quest • Sheet Single-State UI Authority
   Version: 20260731-EAPWQ-V290-NO-RELOAD-SINGLE-STATE
========================================================= */
(function () {
  'use strict';
  var VERSION='20260731-EAPWQ-V290-NO-RELOAD-SINGLE-STATE';
  var FLOW=['S1','S2','S3','BG1','S4','S5','S6','BG2','S7','S8','S9','BG3','S10','S11','S12','BG4','S13','S14','S15','BG5'];
  var GROUP='122',CORE_PREFIX='EAP_WORD_QUEST_CORE_V196_STATE',latest=null;
  if(window.__EAP_WORD_V290_NO_RELOAD_SINGLE_STATE__)return;
  window.__EAP_WORD_V290_NO_RELOAD_SINGLE_STATE__=true;
  window.__EAP_WORD_V286_SHEET_CORE_AUTHORITY__=true;
  window.__EAP_WORD_V288_SHEET_SINGLE_STATE__=true;
  function text(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
  function num(v){var n=Number(v||0);return Number.isFinite(n)?n:0;}
  function clamp(v,min,max){return Math.max(min,Math.min(max,v));}
  function safeId(v){return text(v||'anon').replace(/[^a-z0-9_-]/gi,'_')||'anon';}
  function coreKey(id){return CORE_PREFIX+'_'+GROUP+'_'+safeId(id);}
  function readJson(k,f){try{var r=localStorage.getItem(k);return r?JSON.parse(r):f;}catch(e){return f;}}
  function writeJson(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true;}catch(e){console.error('[EAP Word Quest] V290 write failed',e);return false;}}
  function row(resume,id){return resume&&resume.sessions&&resume.sessions[id]||{};}
  function passedIds(resume){return Array.isArray(resume.passedSessions)?resume.passedSessions.map(function(id){return text(id).toUpperCase();}).filter(function(id){return FLOW.indexOf(id)>=0;}):FLOW.filter(function(id){return Boolean(row(resume,id).passed);});}
  function compact(r){r=r&&typeof r==='object'?r:{};return{played:Boolean(r.played||num(r.attempts)>0),passed:Boolean(r.passed),accuracy:clamp(Math.round(num(r.latestAccuracy||r.bestAccuracy)),0,100),bestAccuracy:clamp(Math.round(num(r.bestAccuracy||r.latestAccuracy)),0,100),bestScore:Math.max(0,Math.round(num(r.bestScore||r.latestScore))),lastAccuracy:clamp(Math.round(num(r.latestAccuracy||r.bestAccuracy)),0,100),lastScore:Math.max(0,Math.round(num(r.latestScore||r.bestScore))),totalAttempts:Math.max(0,Math.round(num(r.attempts))),lastPlayed:text(r.lastPlayed)};}
  function syncCore(profile,resume){var key=coreKey(profile.studentId),old=readJson(key,{})||{},sessions={};FLOW.forEach(function(id){sessions[id]=compact(row(resume,id));});writeJson(key,{version:'v1.9.6-CORE-COMPACT-PROGRESS-CONTROLLER-122',group:GROUP,coreOnly:true,sessions:sessions,recentItemIds:Array.isArray(old.recentItemIds)?old.recentItemIds.slice(0,36):[],weakTargets:old.weakTargets&&typeof old.weakTargets==='object'?old.weakTargets:{},currentSession:text(resume.currentSession||resume.nextMission||'S1'),sheetAuthority:true,createdAt:old.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()});}
  function avg(resume){var values=FLOW.map(function(id){var r=row(resume,id);return r.played||num(r.attempts)>0?num(r.bestAccuracy||r.latestAccuracy):0;}).filter(function(v){return v>0;});return values.length?Math.round(values.reduce(function(a,b){return a+b;},0)/values.length):0;}
  function weak(resume){var found={};FLOW.forEach(function(id){var r=row(resume,id);(Array.isArray(r.weakWords)?r.weakWords:[]).forEach(function(w){var k=text(typeof w==='string'?w:w&&(w.word||w.term||w.target)).toLowerCase();if(k)found[k]=1;});});return Object.keys(found).length;}
  function attempts(resume){return FLOW.reduce(function(s,id){return s+num(row(resume,id).attempts);},0);}
  function stat(v,l){return '<div class="stat"><b>'+v+'</b><span>'+l+'</span></div>';}
  function renderStats(resume){var host=document.getElementById('homeStats'),button=document.getElementById('quickStartBtn'),passed=passedIds(resume),current=text(resume.currentSession||resume.nextMission||'S1').toUpperCase(),currentRow=row(resume,current);if(host){host.innerHTML=[stat(passed.length+'/'+FLOW.length,'ความก้าวหน้าภารกิจ'),stat(passed.length,'ภารกิจที่ผ่าน'),stat(avg(resume)+'%','คะแนนเฉลี่ย Core'),stat(weak(resume),'คำที่ต้องทบทวน'),stat(attempts(resume),'รอบที่เล่นจาก Core')].join('');host.dataset.sheetAuthority='v290';}if(button){button.textContent=current==='DONE'?'ดูสรุปความก้าวหน้า':((currentRow.played||num(currentRow.attempts)>0)?'ฝึก '+current+' ต่อ':'ไปทำ '+current+' ต่อ');button.dataset.session=current;button.disabled=false;}}
  function arcUnlocked(resume,id){var i=FLOW.indexOf(id);if(i<=3)return true;if(i<=7)return Boolean(row(resume,'BG1').passed);if(i<=11)return Boolean(row(resume,'BG2').passed);if(i<=15)return Boolean(row(resume,'BG3').passed);return Boolean(row(resume,'BG4').passed);}
  function bossUnlocked(resume,id){var g={BG1:['S1','S2','S3'],BG2:['S4','S5','S6'],BG3:['S7','S8','S9'],BG4:['S10','S11','S12'],BG5:['S13','S14','S15']};return !g[id]||g[id].every(function(s){return Boolean(row(resume,s).passed);});}
  function status(tag,raw){if(!tag)return;tag.dataset.eap206Raw=raw;tag.textContent=raw==='Passed'?'ผ่านแล้ว':raw==='Open'?'เปิดเล่นได้':'ยังล็อก';tag.classList.remove('good','ai','warn');tag.classList.add(raw==='Passed'?'good':raw==='Open'?'ai':'warn');}
  function renderArc(resume){document.querySelectorAll('#sessionGrid [data-session-id]').forEach(function(card){var id=text(card.getAttribute('data-session-id')).toUpperCase(),r=row(resume,id),passed=Boolean(r.passed),unlocked=arcUnlocked(resume,id)&&bossUnlocked(resume,id),tag=card.querySelector('.eap192-card-top .eap192-tag'),button=card.querySelector('.eap192-start');card.classList.toggle('passed',passed);card.classList.toggle('locked',!unlocked);status(tag,passed?'Passed':unlocked?'Open':'Locked');if(button){button.disabled=!unlocked;button.textContent=passed?'เล่นซ้ำ':'เริ่มฝึก';}});document.querySelectorAll('#sessionGrid .eap192-arc').forEach(function(arc){var first=arc.querySelector('[data-session-id]'),heading=arc.querySelector(':scope > h3');if(!first||!heading)return;var id=text(first.getAttribute('data-session-id')).toUpperCase(),open=arcUnlocked(resume,id);heading.textContent=heading.textContent.replace(/\s*[🔒🔐]\s*$/,'')+(open?'':' 🔒');});}
  function renderAll(resume){renderStats(resume);renderArc(resume);document.documentElement.dataset.eapSheetUiAuthority='v290';}
  function apply(event){var d=event&&event.detail,p=d&&d.profile,resume=d&&d.resume;if(!p||p.official!==true||!text(p.studentId))return;if(!resume||resume.ok!==true||resume.official!==true||!resume.sessions)return;latest={profile:p,resume:resume};syncCore(p,resume);renderAll(resume);[80,240,700,1600].forEach(function(delay){setTimeout(function(){if(latest)renderAll(latest.resume);},delay);});}
  window.addEventListener('eap-word-authority-ready',apply);
  window.addEventListener('eap-word-sheet-confirmed',function(event){var d=event&&event.detail,p=null;try{if(typeof window.getEapWordOfficialProfileV278==='function')p=window.getEapWordOfficialProfileV278();}catch(e){}if(d&&d.resume)apply({detail:{profile:p,resume:d.resume}});});
  window.addEventListener('pageshow',function(){if(latest)renderAll(latest.resume);});
  document.addEventListener('visibilitychange',function(){if(!document.hidden&&latest)renderAll(latest.resume);});
  window.inspectEapWordSheetUiAuthorityV290=function(){return{version:VERSION,currentSession:latest&&latest.resume&&latest.resume.currentSession,reloads:0};};
  console.info('[EAP Word Quest] V290 no-reload Sheet authority ready',{version:VERSION});
})();
