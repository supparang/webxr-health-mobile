(()=>{
'use strict';
const VERSION='20260729-BACKEND-SYNC-V9.3-FRESH-AUTHORITY-ONLY';
const REQUIRED_AUTHORITY_VERSION='20260729-MOBILE-AUTHORITY-V7.6-FORCE-REFRESH';
const STATE_KEY='herohealth_learning_platform_rc2';
const QUEUE_KEY='herohealth_backend_queue_v9';
const SENT_KEY='herohealth_backend_sent_v9';
const VERSION_KEY='herohealth_backend_sync_version';
const LEGACY_QUEUE_KEYS=['herohealth_backend_queue_v8','herohealth_backend_queue_v7','herohealth_backend_queue_v4'];
const C=window.HH_CONFIG||{},R=window.HHRotation;
const endpoint=String(C.backend?.webAppUrl||'').trim();
const enabled=Boolean(C.backend?.enabled&&endpoint&&/\/exec(?:$|\?)/.test(endpoint));
if(!R)return;
const read=(k,f)=>{try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(f))}catch(_){return f}};
const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true}catch(_){return false}};
const state=()=>read(STATE_KEY,{});
function hash(v){let h=2166136261>>>0,s=JSON.stringify(v);for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(36)}
function authoritySafe(s){if(!s?.profile?.studentId)return false;if(s.sheetAuthority!==true)return false;if(s.offlineAuthority===true)return false;if(s.mobileAuthorityVersion!==REQUIRED_AUTHORITY_VERSION)return false;if(!s.lastAuthoritySyncAt)return false;const age=Date.now()-Date.parse(s.lastAuthoritySyncAt);return Number.isFinite(age)&&age>=0&&age<5*60*1000}
function envelope(type,suffix,data,stable=true){const s=state(),p=s.profile||{},st=R.status(s),group=R.groupOf(s),rotationZones=R.zonesFor(s),core={eventType:type,studentId:String(p.studentId||data.studentId||''),profile:{fullName:p.fullName||'',section:p.section||'',group},platformVersion:C.platformVersion||'',rotationGroup:group,rotationZones,currentStep:st.nextStep,progressPct:st.progressPct,completedCount:st.completedCount,missionComplete:st.missionComplete,...data};return{...core,eventId:`HH-${type}-${suffix}-${hash(stable?{type,suffix,studentId:core.studentId,data,group}:core)}`,clientTs:new Date().toISOString()}}
function resetStaleQueues(){try{write(QUEUE_KEY,[]);LEGACY_QUEUE_KEYS.forEach(k=>localStorage.removeItem(k));localStorage.setItem(VERSION_KEY,VERSION)}catch(_){}}
function queue(payload){if(!authoritySafe(state()))return false;if(!payload?.studentId)return false;const sent=read(SENT_KEY,[]);if(sent.includes(payload.eventId))return false;const q=read(QUEUE_KEY,[]);if(!q.some(x=>x.eventId===payload.eventId)){q.push(payload);write(QUEUE_KEY,q.slice(-40))}setTimeout(flush,0);return true}
function jsonp(params,timeout=60000){return new Promise((resolve,reject)=>{if(!endpoint)return reject(new Error('backend_not_configured'));const cb='HHACK_'+Date.now()+'_'+Math.random().toString(36).slice(2),s=document.createElement('script');let settled=false;const finish=(e,d)=>{if(settled)return;settled=true;clearTimeout(t);s.onerror=null;window[cb]=()=>{};setTimeout(()=>{try{delete window[cb]}catch(_){}try{s.remove()}catch(_){}},90000);e?reject(e):resolve(d)};const t=setTimeout(()=>finish(new Error('ack_timeout')),timeout);window[cb]=d=>finish(null,d);s.onerror=()=>finish(new Error('ack_failed'));s.async=true;s.src=endpoint+(endpoint.includes('?')?'&':'?')+new URLSearchParams({...params,callback:cb,_:String(Date.now())});document.head.appendChild(s)})}
async function submit(payload){const r=await jsonp({action:'submit',payload:JSON.stringify(payload)},60000);if(!r?.ok||String(r.eventId||'')!==String(payload.eventId||''))throw new Error(r?.error||'submit_ack_mismatch');return r}
function removeQueued(eventId){write(QUEUE_KEY,read(QUEUE_KEY,[]).filter(x=>x.eventId!==eventId))}
async function flush(){if(!enabled||flush.busy||!navigator.onLine)return;if(!authoritySafe(state())){write(QUEUE_KEY,[]);return}flush.busy=true;try{const latest=read(QUEUE_KEY,[]);if(!latest.length)return;const item=latest[0];try{await submit(item);const sent=read(SENT_KEY,[]);if(!sent.includes(item.eventId)){sent.push(item.eventId);write(SENT_KEY,sent.slice(-200))}removeQueued(item.eventId)}catch(e){console.error('[HH JSONP sync]',e);write(QUEUE_KEY,[])}}finally{flush.busy=false}}
function readSession(k){try{return JSON.parse(sessionStorage.getItem(k)||'null')}catch(_){return null}}
function snapshot(){const s=state(),p=s.profile;if(!p||!authoritySafe(s))return;const st=R.status(s),group=R.groupOf(s),rotationZones=R.zonesFor(s),items=[];const pre=readSession('HH_PRETEST_LAST');if(pre?.studentId===String(p.studentId))items.push(envelope('assessment','pretest',{status:'ส่ง Pre-test',assessment:{type:'pretest',form:pre.form||'PRE',score:pre.score,total:pre.total,responses:pre.responses||[],submittedAt:pre.submittedAt||''}}));const post=readSession('HH_POSTTEST_LAST');if(post?.studentId===String(p.studentId))items.push(envelope('assessment','posttest',{status:'ส่ง Post-test',assessment:{type:'posttest',form:post.form||'POST',score:post.score,total:post.total,responses:post.responses||[],submittedAt:post.submittedAt||''}}));Object.entries(s.gameResults||{}).forEach(([key,g])=>{if(!g?.completed)return;const [zone,gameId]=key.split(':');items.push(envelope('game',key,{status:'จบ '+gameId,game:{zone,gameId,score:Number(g.score)||Number(s.gameScores?.[key])||0,accuracy:Number(g.accuracy)||0,passed:g.passed!==false,completed:true,finishedAt:g.finishedAt||new Date().toISOString(),sessionId:g.sessionId||'',startedAt:g.startedAt||'',rotationGroup:group,rotationZones}}))});if(s.reflection?.submittedAt)items.push(envelope('reflection','reflection',{status:'ส่ง Reflection',reflection:s.reflection}));items.push(envelope('profile','profile',{studentId:p.studentId,status:'เข้าสู่ระบบตาม Rotation '+rotationZones.join(' → ')}));items.push(envelope('progress','progress',{status:st.missionComplete?'Mission Complete':'อัปเดตความคืบหน้า',progress:{progressPct:st.progressPct,completedCount:st.completedCount,totalSteps:st.totalSteps,nextStep:st.nextStep,missionComplete:st.missionComplete,rotationGroup:group,rotationZones}}));items.forEach(queue);setTimeout(flush,100)}
function heartbeat(){const s=state();if(!s.profile||!authoritySafe(s))return;queue(envelope('heartbeat',String(Math.floor(Date.now()/60000)),{status:document.hidden?'พักหน้าจอ':'กำลังใช้งาน'},false))}
resetStaleQueues();
addEventListener('online',flush);
addEventListener('storage',e=>{if(e.key===STATE_KEY)setTimeout(snapshot,500)});
addEventListener('visibilitychange',()=>{if(!document.hidden){snapshot();heartbeat()}});
addEventListener('DOMContentLoaded',()=>{resetStaleQueues();setTimeout(()=>{snapshot();heartbeat();flush()},5000);setInterval(()=>{snapshot();flush()},60000);setInterval(heartbeat,120000)});
window.HHBackend={enabled,endpointConfigured:Boolean(endpoint),queue,flush,snapshot,heartbeat,submit,version:VERSION};
})();