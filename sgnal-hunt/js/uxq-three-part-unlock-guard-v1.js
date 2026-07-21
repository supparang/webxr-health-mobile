/* CSAI2601 UX Quest • Three-Part Unlock Guard v1
 * Official unlock contract:
 * previous node mission_completed + studio_submitted + reflection_submitted.
 * Prevents direct URL bypass. Google Sheet remains the source of truth.
 */
(() => {
  'use strict';
  const ORDER=['w1','w2','w3','b1','w4','w5','w6','w7','b2','w8','w9','w10','w11','b3','w12','w13','w14','b4','w15'];
  const params=new URLSearchParams(location.search||'');
  const node=String(params.get('node')||params.get('id')||'w1').trim().toLowerCase();
  const index=ORDER.indexOf(node);
  if(index<0)return;
  const root=document.getElementById('uxqCanonicalNode')||document.body;
  const config=window.UXQ_CLASSROOM_CONFIG||{};
  const clean=(v,m=500)=>String(v==null?'':v).trim().slice(0,m);
  function identity(){let p={};try{p=window.UXQIdentity?.get?.()||{}}catch(_){ }return{studentId:clean(p.studentId||params.get('studentId')||params.get('sid'),80),section:clean(p.section||params.get('section')||config.defaultSection,80)}}
  function missionDone(id){try{const r=window.UXQProgress?.get?.()?.missions?.[id]||{};return Boolean(r.completed||r.passed||Number(r.bestStars||r.stars||0)>=2)}catch(_){return false}}
  function endpoint(){return clean(config.receiverUrl||config.progressUrl||'',800)}
  function jsonp(url){return new Promise((resolve,reject)=>{const cb=`uxqUnlock_${Date.now()}_${Math.random().toString(36).slice(2)}`;const s=document.createElement('script');const t=setTimeout(()=>done(new Error('unlock_timeout')),12000);function done(err,data){clearTimeout(t);try{delete window[cb]}catch(_){window[cb]=undefined}s.remove();err?reject(err):resolve(data)}window[cb]=d=>done(null,d);s.onerror=()=>done(new Error('unlock_network'));const i=identity();const q=new URLSearchParams({action:'uxq_student_studio_progress',studentId:i.studentId,section:i.section,courseId:clean(config.courseId||'UXQ-ACT1-2026',120),callback:cb,_:Date.now()});s.src=`${url}${url.includes('?')?'&':'?'}${q}`;document.head.appendChild(s)})}
  function studioRow(data,id){return data?.nodes?.[id]||data?.nodes?.[id.toUpperCase()]||data?.items?.find?.(x=>String(x.nodeId||x.missionId||'').toLowerCase()===id)||{}}
  function studioDone(row){return Boolean(row.submitted||row.artifactSubmitted||row.studioSubmitted)}
  function reflectionDone(row){return Boolean(row.reflectionSubmitted||row.hasReflection||clean(row.reflection||'').length>0)}
  function showLocked(previous,parts,error){root.innerHTML=`<div style="min-height:100vh;background:#071124;color:#eef6ff;font-family:system-ui;padding:28px"><section style="max-width:820px;margin:40px auto;border:1px solid rgba(255,209,102,.5);border-radius:22px;padding:28px;background:linear-gradient(150deg,#18233f,#09152e)"><p style="color:#ffd166;font-weight:900;letter-spacing:.08em">THREE-PART UNLOCK GUARD</p><h1 style="font-size:clamp(2rem,5vw,3.4rem);margin:.2em 0">${node.toUpperCase()} ยังล็อกอยู่</h1><p style="color:#c7d5ee;line-height:1.7">ต้องทำ ${previous.toUpperCase()} ให้ครบทั้ง 3 ส่วนก่อน จึงจะเปิดด่านนี้ได้</p><div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:20px 0"><div style="padding:14px;border-radius:14px;border:1px solid ${parts.mission?'#4ade80':'#f87171'}">Mission ${parts.mission?'✓':'○'}</div><div style="padding:14px;border-radius:14px;border:1px solid ${parts.studio?'#4ade80':'#f87171'}">Studio ${parts.studio?'✓':'○'}</div><div style="padding:14px;border-radius:14px;border:1px solid ${parts.reflection?'#4ade80':'#f87171'}">Reflection ${parts.reflection?'✓':'○'}</div></div><p style="color:#ffd6a0">${error?`ตรวจสถานะจาก Sheet ไม่สำเร็จ: ${clean(error,180)}`:'ต้องครบ 3/3 เท่านั้น ระบบไม่อนุญาตให้ข้ามด้วย URL ตรง'}</p><a href="./csai2601-canonical-node-clean-v1.html?node=${previous.toUpperCase()}&v=three-part-unlock-v1-20260721" style="display:inline-block;margin-top:12px;padding:12px 16px;border-radius:12px;background:#6ee7ff;color:#071124;text-decoration:none;font-weight:900">กลับไปทำ ${previous.toUpperCase()} ให้ครบ →</a></section></div>`;document.body.dataset.uxqThreePartLocked='1'}
  async function run(){if(index===0){document.body.dataset.uxqThreePartLocked='0';return}const prev=ORDER[index-1];const i=identity();const ep=endpoint();if(!i.studentId||!i.section||!ep){showLocked(prev,{mission:missionDone(prev),studio:false,reflection:false},'ยังไม่มี Identity หรือ Receiver endpoint');return}try{const data=await jsonp(ep);const row=studioRow(data,prev);const parts={mission:missionDone(prev),studio:studioDone(row),reflection:reflectionDone(row)};if(parts.mission&&parts.studio&&parts.reflection){document.body.dataset.uxqThreePartLocked='0';window.dispatchEvent(new CustomEvent('uxq-three-part-unlock-confirmed',{detail:{node,previous:prev,parts}}));return}showLocked(prev,parts,'')}catch(e){showLocked(prev,{mission:missionDone(prev),studio:false,reflection:false},e.message||e)}}
  document.documentElement.style.visibility='hidden';
  const reveal=()=>{document.documentElement.style.visibility='visible'};
  Promise.resolve(run()).finally(reveal);
  setTimeout(reveal,13000);
  window.UXQThreePartUnlockGuard=Object.freeze({version:'20260721-THREE-PART-UNLOCK-GUARD-V1',run});
})();