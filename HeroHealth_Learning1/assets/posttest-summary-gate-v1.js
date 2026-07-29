(() => {
  'use strict';
  const VERSION='20260729-POSTTEST-SHEET-GATE-V3-PUBLIC-RECEIVER';
  const KEY='herohealth_learning_platform_rc2';
  const ENDPOINT='https://script.google.com/macros/s/AKfycbxU82Rg4KFStuZToOGlyX-rgzVkLpZ7yO1tW-gzui782eR7akes_HNZ5ec2TDUDh8J1/exec';
  const REQUIRED={hygiene:['handwash','toothbrush'],nutrition:['groups','goodjunk'],fitness:['jumpduck','balance-hold']};
  const q=new URLSearchParams(location.search);
  const read=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch(_){return{}}};
  const norm=v=>String(v||'').trim().replace(/\s+/g,'');
  const sid=norm(q.get('studentId')||q.get('sid')||read()?.profile?.studentId);

  function summaryUrl(reason){
    const state=read(),u=new URL('../game-summary.html',location.href);
    ['studentId','fullName','section','group'].forEach(k=>{const v=q.get(k)||state?.profile?.[k]||(k==='group'?state?.group:'');if(v)u.searchParams.set(k,v)});
    u.searchParams.set('return','../index.html');
    if(reason)u.searchParams.set('gateReason',reason);
    return u.href;
  }
  function redirect(reason){location.replace(summaryUrl(reason))}
  function jsonp(params,timeout=30000){
    return new Promise((resolve,reject)=>{
      const cb='HHPOSTGATE'+Date.now()+Math.random().toString(36).slice(2),s=document.createElement('script');let done=false;
      const timer=setTimeout(()=>finish(new Error('sheet_timeout')),timeout);
      function finish(err,data){if(done)return;done=true;clearTimeout(timer);try{s.remove()}catch(_){};try{delete window[cb]}catch(_){};err?reject(err):resolve(data)}
      window[cb]=data=>finish(null,data);s.onerror=()=>finish(new Error('sheet_load_failed'));
      const p=new URLSearchParams({...params,callback:cb,_:String(Date.now()),mobile:'1'});
      s.src=ENDPOINT+'?'+p.toString();s.async=true;s.referrerPolicy='no-referrer';(document.head||document.documentElement).appendChild(s);
    });
  }
  function extract(api){
    const a=api?.authoritativeState||{};
    return {
      completed:{...(api?.completed||{}),...(a.completed||{})},
      gameCompleted:{
        hygiene:{...(api?.gameCompleted?.hygiene||{}),...(a.gameCompleted?.hygiene||{})},
        nutrition:{...(api?.gameCompleted?.nutrition||{}),...(a.gameCompleted?.nutrition||{})},
        fitness:{...(api?.gameCompleted?.fitness||{}),...(a.gameCompleted?.fitness||{})}
      },
      sheetVersion:api?.version||'',
      profile:a.profile||api?.profile||{}
    };
  }
  function complete(s){
    const zones=Object.keys(REQUIRED);
    return zones.every(z=>s.completed?.[z]===true&&REQUIRED[z].every(g=>s.gameCompleted?.[z]?.[g]===true));
  }
  function acknowledged(state){
    const token=state?.gameSummaryAuthority;
    if(state?.completed?.gameSummary!==true||!token)return false;
    if(norm(token.studentId)!==sid)return false;
    const required=Object.values(REQUIRED).flat();
    return required.every(g=>Array.isArray(token.completedGames)&&token.completedGames.includes(g));
  }
  async function verify(){
    if(!sid){redirect('missing_student');return}
    const local=read();
    if(!acknowledged(local)){redirect('summary_not_acknowledged');return}
    try{
      const api=await jsonp({action:'student',studentId:sid});
      if(!api||api.ok!==true){redirect('sheet_invalid');return}
      const official=extract(api);
      if(!complete(official)){redirect('sheet_incomplete');return}
      const merged={...local,profile:{...(local.profile||{}),...(official.profile||{}),studentId:sid},completed:{...(local.completed||{}),...(official.completed||{}),gameSummary:true},gameCompleted:official.gameCompleted,sheetAuthority:true,offlineAuthority:false,sheetVersion:official.sheetVersion,lastPosttestGateCheckAt:new Date().toISOString(),posttestGateVersion:VERSION};
      localStorage.setItem(KEY,JSON.stringify(merged));
      document.documentElement.style.display='';
    }catch(_){redirect('sheet_unreachable')}
  }
  verify();
})();