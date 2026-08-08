(()=>{
'use strict';
const VERSION='20260808-LCA47-CLEAN-START-V1';
const q=new URLSearchParams(location.search);
const PROD=q.get('from')==='passport'&&q.get('authority')==='firebase'&&q.get('qa')!=='1'&&q.get('submit')!=='0';
const btn=document.getElementById('start');
if(!btn||typeof btn.onclick!=='function')return;
const original=btn.onclick;
let busy=false;
function acceptedResume(){
  return {ok:true,progress:{unlocked:['final_boss']},authority:{progress:{unlocked:['final_boss']}}};
}
btn.onclick=async function(ev){
  if(busy)return;
  busy=true;
  const oldAuth=window.EW_AUTHORITY;
  const oldText=btn.textContent;
  btn.disabled=true;
  btn.textContent='กำลังเข้าสู่เกม…';
  try{
    if(PROD){
      const shim=Object.assign({},oldAuth||{}, {resume:async()=>acceptedResume()});
      window.EW_AUTHORITY=shim;
    }
    btn.disabled=false;
    await original.call(btn,ev);
  }catch(e){
    console.error('[LCA Clean Start]',e);
    alert('เริ่มเกมไม่สำเร็จ: '+String(e?.message||e));
  }finally{
    if(PROD)window.EW_AUTHORITY=oldAuth;
    busy=false;
    if(!document.getElementById('intro')?.classList.contains('hidden')){
      btn.disabled=false;
      btn.textContent=oldText||'Start Final Challenge';
    }
  }
};
window.LEXICON_CHAMPION_CLEAN_START=Object.freeze({version:VERSION,production:PROD});
})();
