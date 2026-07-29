(() => {
  'use strict';
  const KEY='herohealth_learning_platform_rc2';
  let state={};
  try{state=JSON.parse(localStorage.getItem(KEY)||'{}')}catch(_){}
  const allZonesDone=['hygiene','nutrition','fitness'].every(id=>state?.completed?.[id]===true);
  const summaryDone=state?.completed?.gameSummary===true;
  if(!allZonesDone||!summaryDone){
    const q=new URLSearchParams(location.search);
    const u=new URL('../game-summary.html',location.href);
    ['studentId','fullName','section','group'].forEach(k=>{const v=q.get(k)||state?.profile?.[k]||(k==='group'?state?.group:'');if(v)u.searchParams.set(k,v)});
    u.searchParams.set('return','../index.html');
    location.replace(u.href);
    return;
  }
  document.documentElement.style.display='';
})();
