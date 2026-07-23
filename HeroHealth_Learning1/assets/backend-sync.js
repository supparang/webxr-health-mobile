(()=>{
'use strict';
const STATE_KEY='herohealth_learning_platform_rc2';
const QUEUE_KEY='herohealth_backend_queue_v2';
const SENT_KEY='herohealth_backend_sent_v2';
const C=window.HH_CONFIG||{};
const endpoint=String(C.backend?.webAppUrl||'').trim();
const enabled=Boolean(C.backend?.enabled&&endpoint&&/\/exec(?:$|\?)/.test(endpoint));
const steps=[
 ['pretest','assessment'],['hygiene:handwash','game'],['hygiene:toothbrush','game'],['nutrition:groups','game'],['nutrition:goodjunk','game'],['fitness:jumpduck','game'],['fitness:balance-hold','game'],['posttest','assessment'],['reflection','assessment']
];
function read(k,fallback){try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(fallback))}catch(_){return fallback}}
function write(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(_){}}
function state(){return read(STATE_KEY,{})}
function hash(v){let h=2166136261>>>0;const s=JSON.stringify(v);for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(36)}
function completed(s,id,type){if(type==='game'){const [z,g]=id.split(':');return s.gameCompleted?.[z]?.[g]===true}return s.completed?.[id]===true}
function statusOf(s){const done=steps.filter(([id,t])=>completed(s,id,t)).length;const next=steps.find(([id,t])=>!completed(s,id,t));return{done,next:next?.[0]||'certificate',pct:Math.round(done/steps.length*100),complete:done===steps.length}}
function envelope(type,suffix,data,stable=true){const s=state(),p=s.profile||{},st=statusOf(s);const core={eventType:type,studentId:String(p.studentId||data.studentId||''),profile:{fullName:p.fullName||'',section:p.section||'',group:s.group||p.group||''},platformVersion:C.platformVersion||'',currentStep:st.next,progressPct:st.pct,completedCount:st.done,missionComplete:st.complete,...data};const idSeed=stable?{type,suffix,studentId:core.studentId,data}:core;return{...core,eventId:`HH-${type}-${suffix}-${hash(idSeed)}`,clientTs:new Date().toISOString()}}
function queue(payload){if(!payload.studentId)return;const q=read(QUEUE_KEY,[]),sent=read(SENT_KEY,[]);if(sent.includes(payload.eventId)||q.some(x=>x.eventId===payload.eventId))return;q.push(payload);write(QUEUE_KEY,q.slice(-300));flush()}
async function flush(){if(!enabled||flush.busy||!navigator.onLine)return;flush.busy=true;try{let q=read(QUEUE_KEY,[]),sent=read(SENT_KEY,[]);while(q.length){const item=q[0];try{const form=new URLSearchParams();form.set('payload',JSON.stringify(item));await fetch(endpoint,{method:'POST',mode:'no-cors',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},body:form.toString(),keepalive:true});sent.push(item.eventId);sent=sent.slice(-1000);q.shift();write(SENT_KEY,sent);write(QUEUE_KEY,q)}catch(_){break}}}finally{flush.busy=false}}
function readSession(k){try{return JSON.parse(sessionStorage.getItem(k)||'null')}catch(_){return null}}
function snapshot(){const s=state(),p=s.profile;if(!p)return;
 queue(envelope('profile','profile',{studentId:p.studentId,status:'เข้าสู่ระบบ'}));
 const games=s.gameResults||{};Object.entries(games).forEach(([key,g])=>{if(!g?.completed)return;const [zone,gameId]=key.split(':');queue(envelope('game',key,{status:'จบ '+gameId,game:{zone,gameId,score:Number(g.score)||Number(s.gameScores?.[key])||0,accuracy:Number(g.accuracy)||0,passed:g.passed===true,completed:true,finishedAt:g.finishedAt||''}}))});
 const pre=readSession('HH_PRETEST_LAST');if(pre?.studentId===String(p.studentId))queue(envelope('assessment','pretest',{status:'ส่ง Pre-test',assessment:{type:'pretest',form:'A',score:pre.score,total:pre.total,responses:pre.responses||[],submittedAt:pre.submittedAt||''}}));
 const post=readSession('HH_POSTTEST_LAST');if(post?.studentId===String(p.studentId))queue(envelope('assessment','posttest',{status:'ส่ง Post-test',assessment:{type:'posttest',form:'B',score:post.score,total:post.total,responses:post.responses||[],submittedAt:post.submittedAt||''}}));
 if(s.reflection?.submittedAt)queue(envelope('reflection','reflection',{status:'ส่ง Reflection',reflection:s.reflection}));
 const st=statusOf(s);queue(envelope('progress','progress',{status:st.complete?'Mission Complete':'อัปเดตความคืบหน้า',progress:{progressPct:st.pct,completedCount:st.done,totalSteps:steps.length,nextStep:st.next,missionComplete:st.complete}}));
}
function heartbeat(){const s=state();if(!s.profile)return;const st=statusOf(s),bucket=Math.floor(Date.now()/60000);queue(envelope('heartbeat',String(bucket),{status:document.hidden?'พักหน้าจอ':'กำลังใช้งาน'},false))}
addEventListener('online',flush);
addEventListener('storage',e=>{if(e.key===STATE_KEY)setTimeout(snapshot,50)});
addEventListener('visibilitychange',()=>{if(!document.hidden){snapshot();heartbeat()}});
addEventListener('error',e=>{const s=state();if(!s.profile)return;queue(envelope('error','runtime-'+Date.now(),{message:e.message||'runtime_error',stack:e.error?.stack||'',studentId:s.profile.studentId},false))});
addEventListener('DOMContentLoaded',()=>{snapshot();heartbeat();flush();setInterval(()=>{snapshot();flush()},15000);setInterval(heartbeat,60000)});
window.HHBackend={enabled,endpointConfigured:Boolean(endpoint),queue,flush,snapshot,heartbeat};
})();
