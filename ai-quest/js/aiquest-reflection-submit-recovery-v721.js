/* CSAI2102 AI Quest — Reflection Submit Recovery v7.2.2
   Keeps submit state synchronized with the visible Case picker and Reflection fields.
   For S2, the existing Evidence Gate remains authoritative; this layer never bypasses it.
*/
(()=>{'use strict';
if(window.AIQuestReflectionSubmitRecoveryV722)return;
const VERSION='v7.2.2';
const $=id=>document.getElementById(id);
const text=v=>String(v==null?'':v).trim();
const hasAnswer=el=>!!el&&text(el.value).length>=3;
const visible=el=>!!el&&el.getClientRects().length>0&&getComputedStyle(el).display!=='none';
function score(){return Number(text($('score')&&$('score').textContent).replace(/[^0-9.]/g,''))||0}
function reflectionFields(){
 const direct=[$('r1'),$('r2'),$('r3')];
 if(direct.every(Boolean))return direct;
 return [...document.querySelectorAll('.reflectionBlock textarea,#result textarea')].filter(visible).slice(0,3);
}
function responsesDone(){const f=reflectionFields();return f.length>=3&&f.slice(0,3).every(hasAnswer)}
function caseBannerSelected(){
 return [...document.querySelectorAll('#s2EvidenceInfo,#evidence,.promptBox,.notice,.fb')].some(el=>{
  const t=text(el.textContent);
  return /✓\s*เลือกแล้ว|Case\s*ที่เลือก\s*:/i.test(t)&&!/ยังไม่ได้เลือก Case/i.test(t);
 });
}
function candidateSelects(){
 const preferred=['s2EvidenceCase','reflectionCase','caseSelect','selectedCase'];
 const seen=new Set(),out=[];
 preferred.forEach(id=>{const el=$(id);if(el&&!seen.has(el)){seen.add(el);out.push(el)}});
 [...document.querySelectorAll('#evidence select,.reflectionBlock select,#result select')].forEach(el=>{if(!seen.has(el)){seen.add(el);out.push(el)}});
 return out;
}
function normalizeCaseSelect(){
 for(const sel of candidateSelects()){
  if(sel.selectedIndex<0)continue;
  const opt=sel.options&&sel.options[sel.selectedIndex];
  const label=text(opt&&opt.textContent);
  const placeholder=sel.selectedIndex===0&&/เลือก Case|select case/i.test(label);
  if(placeholder)continue;
  if(!text(sel.value)&&opt){
   const stable=text(opt.dataset&&opt.dataset.caseId)||text(opt.getAttribute&&opt.getAttribute('data-id'))||label;
   if(stable){
    opt.value=stable;sel.value=stable;
    sel.dispatchEvent(new Event('input',{bubbles:true}));
    sel.dispatchEvent(new Event('change',{bubbles:true}));
   }
  }
  if(text(sel.value))return true;
 }
 return caseBannerSelected();
}
function s2EvidenceState(){
 const panel=$('s2EvidenceBindingV681');
 if(!panel)return {required:false,ok:true,message:''};
 const current=window.AIQuestS2ReflectionEvidenceCurrent;
 const ok=!!(current&&current.integrity&&current.integrity.ok===true);
 const check=text($('s2EvidenceCheck')&&$('s2EvidenceCheck').textContent);
 return {required:true,ok,message:check};
}
function sent(){
 const n=text($('saveNote')&&$('saveNote').textContent),b=$('save');
 return /ส่งผลเข้า Google Sheets แล้ว|ส่งผลแล้ว|บันทึก.*แล้ว/i.test(n)||!!(b&&b.disabled&&/ส่งผลแล้ว/i.test(text(b.textContent)));
}
function update(){
 const result=$('result'),save=$('save'),note=$('saveNote');
 if(!result||!save)return;
 if(!(result.classList.contains('on')||getComputedStyle(result).display!=='none'))return;
 const passed=score()>=60,caseOk=normalizeCaseSelect(),answersOk=responsesDone(),evidence=s2EvidenceState(),ready=caseOk&&answersOk&&evidence.ok,alreadySent=sent();
 save.dataset.caseReady=caseOk?'1':'0';
 save.dataset.reflectionReady=answersOk?'1':'0';
 save.dataset.evidenceReady=evidence.ok?'1':'0';
 if(!passed||alreadySent)return;
 if(ready){
  save.disabled=false;save.removeAttribute('aria-disabled');save.textContent='ส่ง Reflection และผล';
  if(note&&/ต้องเลือก Case|ยังส่งไม่ได้|ตอบ Reflection ครบ/i.test(text(note.textContent))){note.className='notice good';note.textContent='✓ พร้อมส่ง: Case และ Reflection ผ่านการตรวจแล้ว';}
 }else{
  save.disabled=true;save.setAttribute('aria-disabled','true');
  if(note){
   note.className='notice bad';
   if(evidence.required&&!evidence.ok&&evidence.message)note.textContent=evidence.message;
   else{const miss=[];if(!caseOk)miss.push('เลือก Case');if(!answersOk)miss.push('ตอบ Reflection ครบ 3 ช่อง');note.textContent='ยังส่งไม่ได้: ต้อง'+miss.join(' และ');}
  }
 }
}
function boot(){
 const result=$('result');if(!result){setTimeout(boot,100);return}
 const refresh=()=>setTimeout(update,0);
 document.addEventListener('input',refresh,true);document.addEventListener('change',refresh,true);document.addEventListener('keyup',refresh,true);document.addEventListener('paste',()=>setTimeout(update,40),true);
 document.addEventListener('pointerdown',e=>{if(e.target&&e.target.closest&&e.target.closest('#save')){normalizeCaseSelect();update()}},true);
 const ob=new MutationObserver(()=>{clearTimeout(ob._t);ob._t=setTimeout(update,45)});
 ob.observe(result,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','style','disabled','value']});
 setInterval(update,240);update();
 console.log('[AIQuest] Reflection submit recovery v722 active');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.AIQuestReflectionSubmitRecoveryV721=window.AIQuestReflectionSubmitRecoveryV722={version:VERSION,update,normalizeCaseSelect,responsesDone,s2EvidenceState};
})();