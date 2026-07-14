/* CSAI2102 AI Quest — Reflection Submit Recovery v7.2.1
   Fixes a stale/empty case-select value that can keep the submit button disabled
   even when a visible Case is selected and all three Reflection responses exist.
   This layer does not bypass the learning gate: pass + selected Case + 3 responses
   are still mandatory, and the next mission remains locked until submission succeeds.
*/
(()=>{'use strict';
if(window.AIQuestReflectionSubmitRecoveryV721)return;
const VERSION='v7.2.1';
const $=id=>document.getElementById(id);
const text=v=>String(v==null?'':v).trim();
const hasAnswer=el=>!!el&&text(el.value).length>=3;
const visible=el=>!!el&&el.getClientRects().length>0&&getComputedStyle(el).display!=='none';
function score(){return Number(text($('score')&&$('score').textContent).replace(/[^0-9.]/g,''))||0}
function reflectionFields(){
 const direct=[$('r1'),$('r2'),$('r3')];
 if(direct.every(Boolean))return direct;
 return [...document.querySelectorAll('.reflectionBlock textarea, #result textarea')].filter(visible).slice(0,3);
}
function responsesDone(){const fields=reflectionFields();return fields.length>=3&&fields.slice(0,3).every(hasAnswer)}
function caseBannerSelected(){
 return [...document.querySelectorAll('#evidence,.promptBox,.notice,.fb')].some(el=>{
  const t=text(el.textContent);
  return /✓\s*เลือกแล้ว|Case\s*ที่เลือก\s*:/i.test(t)&&!/ยังไม่ได้เลือก Case/i.test(t);
 });
}
function normalizeCaseSelect(){
 const selects=[...document.querySelectorAll('#evidence select,.reflectionBlock select,#result select')];
 for(const sel of selects){
  if(sel.selectedIndex<0)continue;
  const opt=sel.options&&sel.options[sel.selectedIndex];
  const placeholder=sel.selectedIndex===0&&/เลือก Case|select case/i.test(text(opt&&opt.textContent));
  if(placeholder)continue;
  if(!text(sel.value)&&opt){
   const stable=text(opt.value)||text(opt.dataset&&opt.dataset.caseId)||text(opt.textContent);
   if(stable){opt.value=stable;sel.value=stable;}
  }
  if(text(sel.value))return true;
 }
 return caseBannerSelected();
}
function sent(){
 const n=text($('saveNote')&&$('saveNote').textContent),b=$('save');
 return /ส่งผลเข้า Google Sheets แล้ว|ส่งผลแล้ว|บันทึก.*แล้ว/i.test(n)||!!(b&&b.disabled&&/ส่งผลแล้ว/i.test(text(b.textContent)));
}
function update(){
 const result=$('result'),save=$('save'),note=$('saveNote');
 if(!result||!save)return;
 if(!(result.classList.contains('on')||getComputedStyle(result).display!=='none'))return;
 const passed=score()>=60,caseOk=normalizeCaseSelect(),answersOk=responsesDone(),alreadySent=sent();
 save.dataset.caseReady=caseOk?'1':'0';
 save.dataset.reflectionReady=answersOk?'1':'0';
 if(!passed||alreadySent)return;
 if(caseOk&&answersOk){
  save.disabled=false;
  save.removeAttribute('aria-disabled');
  save.textContent='ส่ง Reflection และผล';
  if(note&&/ต้องเลือก Case และตอบ Reflection ครบ 3 ช่องก่อนส่ง|เลือก Case และตอบ Reflection ครบ 3 ช่อง/i.test(text(note.textContent))){
   note.className='notice good';
   note.textContent='✓ พร้อมส่ง: เลือก Case และตอบ Reflection ครบ 3 ช่องแล้ว';
  }
 }else{
  save.disabled=true;
  save.setAttribute('aria-disabled','true');
  if(note){
   const missing=[];if(!caseOk)missing.push('เลือก Case');if(!answersOk)missing.push('ตอบ Reflection ครบ 3 ช่อง');
   note.className='notice bad';note.textContent='ยังส่งไม่ได้: ต้อง'+missing.join(' และ');
  }
 }
}
function boot(){
 const result=$('result');if(!result){setTimeout(boot,100);return}
 const refresh=()=>setTimeout(update,0);
 document.addEventListener('input',refresh,true);
 document.addEventListener('change',refresh,true);
 document.addEventListener('keyup',refresh,true);
 document.addEventListener('paste',()=>setTimeout(update,30),true);
 document.addEventListener('pointerdown',e=>{if(e.target&&e.target.closest&&e.target.closest('#save')){normalizeCaseSelect();update()}},true);
 const ob=new MutationObserver(()=>{clearTimeout(ob._t);ob._t=setTimeout(update,40)});
 ob.observe(result,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','style','disabled','value']});
 setInterval(update,220);update();
 console.log('[AIQuest] Reflection submit recovery v721 active');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.AIQuestReflectionSubmitRecoveryV721={version:VERSION,update,normalizeCaseSelect,responsesDone};
})();