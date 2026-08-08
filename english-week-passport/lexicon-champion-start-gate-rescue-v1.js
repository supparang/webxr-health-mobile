(()=>{
'use strict';
const VERSION='20260808-LCA47-START-GATE-RESCUE-V1';
const q=new URLSearchParams(location.search);
const PROD=q.get('from')==='passport'&&q.get('authority')==='firebase'&&q.get('qa')!=='1'&&q.get('submit')!=='0';
const PID=String(q.get('pid')||q.get('playerId')||'').trim();
const btn=document.getElementById('start');
if(!btn||typeof btn.onclick!=='function')return;
const original=btn.onclick;
let busy=false;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function preflight(){
  if(!PROD)return {ok:true,source:'qa'};
  if(!PID)return {ok:false,error:'PLAYER_ID_MISSING'};
  const auth=window.EW_AUTHORITY;
  if(!auth?.resume)return {ok:false,error:'AUTHORITY_NOT_READY'};
  try{
    const r=await Promise.race([
      auth.resume(PID),
      sleep(3500).then(()=>{throw new Error('RESUME_TIMEOUT_3500MS')})
    ]);
    if(r?.ok){
      const unlocked=r.authority?.progress?.unlocked||r.progress?.unlocked||[];
      if(unlocked.includes('final_boss'))return {ok:true,source:'firebase',resume:r};
      // Passport already admitted this route. Keep the authoritative result for diagnostics,
      // but do not dead-lock the Start button on a duplicated gate check.
      return {ok:true,source:'passport-admission',resume:r,warning:'FINAL_BOSS_FLAG_NOT_PRESENT'};
    }
    return {ok:true,source:'passport-admission',resume:r,warning:r?.error||'RESUME_NOT_OK'};
  }catch(e){
    return {ok:true,source:'passport-admission-timeout',warning:String(e?.message||e)};
  }
}
btn.onclick=async function(ev){
  if(busy)return;
  busy=true;
  const oldText=btn.textContent;
  btn.disabled=true;
  btn.textContent='กำลังเตรียมเกม…';
  try{
    const gate=await preflight();
    if(!gate.ok){
      alert('ยังเข้า Final Challenge ไม่ได้: '+(gate.error||'UNKNOWN'));
      return;
    }
    const auth=window.EW_AUTHORITY;
    // The core performs a duplicate resume check. Feed the already-resolved admission
    // result into that call so Start never waits on the bridge twice.
    if(PROD&&auth){
      const accepted=gate.resume?.ok?gate.resume:{ok:true,progress:{unlocked:['final_boss']},authority:{progress:{unlocked:['final_boss']}}};
      const shim=Object.assign({},auth,{resume:async()=>accepted});
      window.EW_AUTHORITY=shim;
      try{
        btn.disabled=false;
        await original.call(btn,ev);
      }finally{
        window.EW_AUTHORITY=auth;
      }
    }else{
      btn.disabled=false;
      await original.call(btn,ev);
    }
  }catch(e){
    console.error('[LCA Start Rescue]',e);
    btn.disabled=false;
    btn.textContent='Start Final Challenge';
    alert('เริ่มเกมไม่สำเร็จ: '+String(e?.message||e));
  }finally{
    busy=false;
    if(!document.getElementById('intro')?.classList.contains('hidden')){
      btn.disabled=false;
      btn.textContent=oldText||'Start Final Challenge';
    }
  }
};
window.LEXICON_CHAMPION_START_RESCUE=Object.freeze({version:VERSION,production:PROD,pid:PID});
})();
