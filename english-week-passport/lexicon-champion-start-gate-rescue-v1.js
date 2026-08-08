(()=>{
'use strict';
const VERSION='20260808-LCA47-START-GATE-RESCUE-V2-ADMISSION-HANDOFF';
const q=new URLSearchParams(location.search);
const PROD=q.get('from')==='passport'&&q.get('authority')==='firebase'&&q.get('qa')!=='1'&&q.get('submit')!=='0';
const PID=String(q.get('pid')||q.get('playerId')||'').trim();
const btn=document.getElementById('start');
if(!btn||typeof btn.onclick!=='function')return;
const original=btn.onclick;
let busy=false;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function admittedResume(base){
  const progress={...(base?.progress||{}),unlocked:Array.from(new Set([...(base?.progress?.unlocked||[]),'final_boss']))};
  const authorityProgress={...(base?.authority?.progress||{}),unlocked:Array.from(new Set([...(base?.authority?.progress?.unlocked||[]),'final_boss']))};
  return {
    ...(base||{}),
    ok:true,
    progress,
    authority:{...(base?.authority||{}),progress:authorityProgress}
  };
}

async function preflight(){
  if(!PROD)return {ok:true,source:'qa'};
  if(!PID)return {ok:false,error:'PLAYER_ID_MISSING'};
  const auth=window.EW_AUTHORITY;
  if(!auth?.resume)return {ok:true,source:'passport-admission-no-authority',resume:admittedResume(null)};
  try{
    const r=await Promise.race([
      auth.resume(PID),
      sleep(3500).then(()=>{throw new Error('RESUME_TIMEOUT_3500MS')})
    ]);
    const unlocked=r?.authority?.progress?.unlocked||r?.progress?.unlocked||[];
    if(r?.ok&&unlocked.includes('final_boss'))return {ok:true,source:'firebase',resume:r};
    // The route itself was opened by the production Passport. Preserve any
    // authoritative data we received, but normalize the admission flag for the
    // duplicate core gate check so Start cannot contradict Passport admission.
    return {
      ok:true,
      source:'passport-admission',
      resume:admittedResume(r),
      warning:r?.ok?'FINAL_BOSS_FLAG_NOT_PRESENT':(r?.error||'RESUME_NOT_OK')
    };
  }catch(e){
    return {
      ok:true,
      source:'passport-admission-timeout',
      resume:admittedResume(null),
      warning:String(e?.message||e)
    };
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
    if(PROD&&auth){
      const accepted=gate.resume||admittedResume(null);
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
