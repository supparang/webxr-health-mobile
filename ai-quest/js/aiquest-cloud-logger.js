(()=>{'use strict';
const U='https://script.google.com/macros/s/AKfycbwXSUHbhVbZtKcjNIDzs4TawAohdeInm1MxLpomVeST2JilOL3L0LWQtT4_Yb7fbJG9/exec';
const post=(kind,payload)=>fetch(U,{method:'POST',mode:'no-cors',cache:'no-store',keepalive:true,headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify({action:'sync_v23',kind,payload:{...payload,section:'101',clientTs:payload?.clientTs||new Date().toISOString(),pageUrl:payload?.pageUrl||location.href}})}).then(()=>({ok:true,queued:true}));

const jsonpOnce=(action,params={},timeoutMs=30000)=>new Promise((resolve,reject)=>{
  const callback='__aiquest_jsonp_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,9);
  const url=new URL(U);
  url.searchParams.set('action',action);
  url.searchParams.set('callback',callback);
  url.searchParams.set('_cb',Date.now().toString());
  Object.keys(params).forEach(k=>url.searchParams.set(k,String(params[k]??'')));

  const script=document.createElement('script');
  let done=false;
  const cleanup=()=>{
    if(done)return;
    done=true;
    clearTimeout(timer);
    try{script.remove()}catch(e){}
    try{delete window[callback]}catch(e){window[callback]=undefined}
  };
  const timer=setTimeout(()=>{
    cleanup();
    reject(new Error(action+' timeout after '+timeoutMs+'ms'));
  },timeoutMs);

  window[callback]=data=>{
    cleanup();
    resolve(data||{});
  };
  script.onerror=()=>{
    cleanup();
    reject(new Error(action+' unavailable'));
  };
  script.async=true;
  script.src=url.toString();
  document.head.appendChild(script);
});

const jsonp=async(action,params={})=>{
  let lastError;
  for(let attempt=1;attempt<=2;attempt++){
    try{
      return await jsonpOnce(action,{...params,_attempt:attempt},attempt===1?30000:45000);
    }catch(err){
      lastError=err;
      if(attempt<2) await new Promise(r=>setTimeout(r,1200));
    }
  }
  throw lastError||new Error(action+' failed');
};

const studentIdOf=p=>String(p?.studentId||'').trim();
const getProfile=async payload=>{
  const studentId=studentIdOf(payload);
  if(!studentId)return{ok:false,found:false,error:'studentId is required'};
  return jsonp('profileLookup',{studentId,section:'101'});
};
const getProgress=async payload=>{
  const studentId=studentIdOf(payload);
  if(!studentId)return{ok:false,found:false,error:'studentId is required'};
  return jsonp('studentProgress',{studentId,section:'101'});
};

window.AIQuestCloudLogger={
  isCloudReady:()=>true,
  healthCheck:async()=>jsonp('health',{}),
  sendProfile:p=>post('profile',p),
  sendAttempt:p=>post('attempt',p),
  sendEvent:p=>post('event',p),
  getProfile,
  getProgress,
  flushPending:async()=>({ok:true,queued:true})
};
console.log('[AIQuest] cloud logger ready • resilient Sheet-only JSONP v2');
})();