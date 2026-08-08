(()=>{
'use strict';
const RELEASE='20260808-LENS-PRODUCTION-AUTO-RETURN-V1';
const q=new URLSearchParams(location.search);
const PROD=q.get('from')==='passport'&&q.get('authority')==='firebase'&&q.get('qa')!=='1'&&q.get('smoke')!=='1';
if(!PROD){window.LEXICON_LENS_AUTO_RETURN={release:RELEASE,enabled:false};return;}
let armed=false,timer=0;
function visible(el){return !!el&&!el.classList.contains('hidden')&&getComputedStyle(el).display!=='none';}
function findBackButton(layer){
  if(!layer)return null;
  return [...layer.querySelectorAll('button')].find(b=>/กลับ\s*Passport/i.test((b.textContent||'').trim()))||null;
}
function check(){
  if(armed)return;
  const layer=document.getElementById('summaryLayer');
  if(!visible(layer))return;
  const text=layer.textContent||'';
  const saved=/บันทึก\s*Firebase[^\n]*สำเร็จ/i.test(text)||/Firebase\s*Analytics\s*สำเร็จ/i.test(text)||/event-[A-Za-z0-9_-]+/.test(text);
  if(!saved)return;
  const back=findBackButton(layer);
  if(!back)return;
  armed=true;
  back.dataset.autoReturnArmed='1';
  const status=document.createElement('div');
  status.id='lensAutoReturnStatus';
  status.style.cssText='margin-top:8px;text-align:center;font-size:.78rem;font-weight:800;color:#bfffe4';
  status.textContent='✓ บันทึกสำเร็จ • กำลังกลับ Passport…';
  back.insertAdjacentElement('beforebegin',status);
  timer=setTimeout(()=>{try{back.click()}catch(_){location.replace('./index.html?resume=passport&fromGame=bonus_lens&v=20260808-lens-auto-return1')}},1500);
}
const observer=new MutationObserver(check);
observer.observe(document.getElementById('summaryLayer')||document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class']});
setInterval(check,500);
addEventListener('pagehide',()=>{clearTimeout(timer);observer.disconnect()},{once:true});
check();
window.LEXICON_LENS_AUTO_RETURN={release:RELEASE,enabled:true};
})();
