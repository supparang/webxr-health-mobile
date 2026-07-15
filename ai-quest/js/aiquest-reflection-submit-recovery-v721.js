/* CSAI2102 AI Quest — Reflection Submit Recovery v7.2.3
   Keeps submit state synchronized without observing attributes that this module
   writes itself. This removes the MutationObserver feedback loop that could make
   Chrome report “Page unresponsive” while editing Reflection.
*/
(()=>{'use strict';
if(window.AIQuestReflectionSubmitRecoveryV723)return;
const VERSION='v7.2.3', $=id=>document.getElementById(id), text=v=>String(v==null?'':v).trim();
const hasAnswer=el=>!!el&&text(el.value).length>=3;
const visible=el=>!!el&&el.getClientRects().length>0&&getComputedStyle(el).display!=='none';
function score(){return Number(text($('score')&&$('score').textContent).replace(/[^0-9.]/g,''))||0}
function reflectionFields(){const d=[$('r1'),$('r2'),$('r3')];return d.every(Boolean)?d:[...document.querySelectorAll('.reflectionBlock textarea,#result textarea')].filter(visible).slice(0,3)}
function responsesDone(){const f=reflectionFields();return f.length>=3&&f.slice(0,3).every(hasAnswer)}
function caseBannerSelected(){return [...document.querySelectorAll('#s2EvidenceInfo,#evidence,.promptBox,.notice,.fb')].some(el=>{const t=text(el.textContent);return /✓\s*เลือกแล้ว|Case\s*ที่เลือก\s*:/i.test(t)&&!/ยังไม่ได้เลือก Case/i.test(t)})}
function candidateSelects(){const seen=new Set(),out=[];['s2EvidenceCase','reflectionCase','caseSelect','selectedCase'].forEach(id=>{const el=$(id);if(el&&!seen.has(el)){seen.add(el);out.push(el)}});document.querySelectorAll('#evidence select,.reflectionBlock select,#result select').forEach(el=>{if(!seen.has(el)){seen.add(el);out.push(el)}});return out}
function normalizeCaseSelect(){for(const sel of candidateSelects()){if(sel.selectedIndex<0)continue;const opt=sel.options&&sel.options[sel.selectedIndex],label=text(opt&&opt.textContent);if(sel.selectedIndex===0&&/เลือก Case|select case/i.test(label))continue;if(!text(sel.value)&&opt){const stable=text(opt.dataset&&opt.dataset.caseId)||text(opt.getAttribute&&opt.getAttribute('data-id'))||label;if(stable){opt.value=stable;sel.value=stable}}if(text(sel.value))return true}return caseBannerSelected()}
function s2EvidenceState(){const panel=$('s2EvidenceBindingV681');if(!panel)return{required:false,ok:true,message:''};const current=window.AIQuestS2ReflectionEvidenceCurrent,ok=!!(current&&current.integrity&&current.integrity.ok===true);return{required:true,ok,message:text($('s2EvidenceCheck')&&$('s2EvidenceCheck').textContent)}}
function sent(){const n=text($('saveNote')&&$('saveNote').textContent),b=$('save');return /ส่งผลเข้า Google Sheets แล้ว|ส่งผลแล้ว|บันทึก.*แล้ว/i.test(n)||!!(b&&b.disabled&&/ส่งผลแล้ว/i.test(text(b.textContent)))}
let lastState='',scheduled=false;
function setText(el,value){if(el&&el.textContent!==value)el.textContent=value}
function setClass(el,value){if(el&&el.className!==value)el.className=value}
function setDisabled(el,value){if(el&&el.disabled!==value)el.disabled=value}
function update(){scheduled=false;const result=$('result'),save=$('save'),note=$('saveNote');if(!result||!save)return;if(!(result.classList.contains('on')||getComputedStyle(result).display!=='none'))return;const passed=score()>=60,caseOk=normalizeCaseSelect(),answersOk=responsesDone(),evidence=s2EvidenceState(),ready=caseOk&&answersOk&&evidence.ok,alreadySent=sent(),state=[passed,caseOk,answersOk,evidence.ok,alreadySent].join('|');save.dataset.caseReady=caseOk?'1':'0';save.dataset.reflectionReady=answersOk?'1':'0';save.dataset.evidenceReady=evidence.ok?'1':'0';if(state===lastState)return;lastState=state;if(!passed||alreadySent)return;if(ready){setDisabled(save,false);save.removeAttribute('aria-disabled');setText(save,'ส่ง Reflection และผล');if(note&&/ต้องเลือก Case|ยังส่งไม่ได้|ตอบ Reflection ครบ/i.test(text(note.textContent))){setClass(note,'notice good');setText(note,'✓ พร้อมส่ง: Case และ Reflection ผ่านการตรวจแล้ว')}}else{setDisabled(save,true);save.setAttribute('aria-disabled','true');if(note){setClass(note,'notice bad');if(evidence.required&&!evidence.ok&&evidence.message)setText(note,evidence.message);else{const miss=[];if(!caseOk)miss.push('เลือก Case');if(!answersOk)miss.push('ตอบ Reflection ครบ 3 ช่อง');setText(note,'ยังส่งไม่ได้: ต้อง'+miss.join(' และ'))}}}}
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(update)}
function boot(){const result=$('result');if(!result){setTimeout(boot,120);return}document.addEventListener('input',schedule,true);document.addEventListener('change',schedule,true);document.addEventListener('keyup',schedule,true);document.addEventListener('paste',()=>setTimeout(schedule,40),true);document.addEventListener('pointerdown',e=>{if(e.target&&e.target.closest&&e.target.closest('#save'))schedule()},true);const ob=new MutationObserver(schedule);ob.observe(result,{subtree:true,childList:true,characterData:true});setInterval(schedule,1200);schedule();console.log('[AIQuest] Reflection submit recovery v723 active • loop-safe throttled UI')}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.AIQuestReflectionSubmitRecoveryV721=window.AIQuestReflectionSubmitRecoveryV722=window.AIQuestReflectionSubmitRecoveryV723={version:VERSION,update,schedule,normalizeCaseSelect,responsesDone,s2EvidenceState};
})();