/* CSAI2601 UX Quest • Direct Studio Entry v1
 * ?view=studio|reflection hides Mission intro, verifies Sheet, then opens Studio directly.
 */
(() => {
  'use strict';
  const params=new URLSearchParams(location.search||'');
  const view=String(params.get('view')||'').toLowerCase();
  if(!['studio','reflection'].includes(view))return;
  const nodeId=String(params.get('node')||params.get('id')||'W1').toUpperCase();
  const nodeKey=nodeId.toLowerCase();
  const root=document.getElementById('uxqCanonicalNode');
  const cfg=()=>window.UXQ_CLASSROOM_CONFIG||{};
  const clean=(v,m=500)=>String(v==null?'':v).trim().slice(0,m);
  let finished=false;

  document.documentElement.dataset.uxqDirectStudio='loading';
  const style=document.createElement('style');
  style.textContent=`html[data-uxq-direct-studio='loading'] #uxqCanonicalNode{visibility:hidden}.uxq-direct-loading{min-height:100vh;display:grid;place-items:center;background:#071124;color:#eef6ff;font-family:system-ui}.uxq-direct-loading section{max-width:620px;padding:28px;text-align:center}.uxq-direct-loading h1{font-size:clamp(1.6rem,5vw,2.8rem)}.uxq-direct-loading p{color:#b9c9e4;line-height:1.6}`;
  document.head.appendChild(style);
  const loading=document.createElement('div');loading.className='uxq-direct-loading';loading.innerHTML=`<section><p>กำลังตรวจ Google Sheet</p><h1>กำลังเปิด ${view==='reflection'?'Weekly Reflection':'Studio Practice'} • ${nodeId}</h1><p>Mission ผ่านแล้ว นักศึกษาไม่ต้องเล่นซ้ำ</p></section>`;document.body.appendChild(loading);

  function profile(){let p={};try{p=window.UXQIdentity?.get?.()||{}}catch(_){}return{studentId:clean(p.studentId||params.get('studentId')||params.get('sid'),80),section:clean(p.section||params.get('section')||cfg().defaultSection,80)}}
  function rowFrom(data){return data?.missions?.[nodeKey]||data?.missions?.[nodeId]||data?.nodes?.[nodeKey]||data?.nodes?.[nodeId]||data?.items?.find?.(x=>String(x.nodeId||x.missionId||'').toLowerCase()===nodeKey)||{}}
  function confirmed(data){const canonical=data?.diagnostics?.canonicalPassedMissionIds;if(Array.isArray(canonical))return canonical.map(v=>String(v).toLowerCase()).includes(nodeKey);const row=rowFrom(data);return Boolean(row.completed||row.passed||row.missionCompleted||row.eventType==='mission_completed')}
  function reveal(error=''){finished=true;loading.remove();document.documentElement.dataset.uxqDirectStudio=error?'error':'ready';if(root)root.style.visibility='';if(error&&root){root.innerHTML=`<div class="uxq-direct-loading"><section><h1>ยังเปิด Studio ไม่ได้</h1><p>${error}</p><p><a href="./csai2601-mission-control.html" style="color:#6ee7ff">กลับ Mission Control</a></p></section></div>`}}
  function jsonp(url){return new Promise((resolve,reject)=>{const cb=`UXQDirect_${Date.now()}_${Math.random().toString(36).slice(2)}`;const s=document.createElement('script');const t=setTimeout(()=>done(new Error('หมดเวลารอ Google Sheet')),12000);function done(e,d){clearTimeout(t);try{delete window[cb]}catch(_){}s.remove();e?reject(e):resolve(d)}window[cb]=d=>done(null,d);s.onerror=()=>done(new Error('เชื่อม Google Sheet ไม่สำเร็จ'));const p=profile();const q=new URLSearchParams({action:'uxq_student_studio_progress',studentId:p.studentId,section:p.section,courseId:clean(cfg().courseId||'UXQ-ACT1-2026',120),callback:cb,_:Date.now()});s.src=`${url}${url.includes('?')?'&':'?'}${q}`;document.head.appendChild(s)})}
  async function run(){const p=profile(),endpoint=clean(cfg().receiverUrl||cfg().progressUrl||'',800);if(!p.studentId||!p.section)return reveal('ข้อมูลผู้เรียนหรือ Section ไม่ครบ');if(!endpoint)return reveal('ยังไม่ได้ตั้งค่า Receiver');try{const data=await jsonp(endpoint);if(!data?.ok||!confirmed(data))return reveal(`Google Sheet ยังไม่ยืนยัน mission_completed ของ ${nodeId}`);window.UXQDirectStudioConfirmed={nodeId,nodeKey,view,data,confirmed:true};window.dispatchEvent(new CustomEvent('uxq-direct-studio-confirmed',{detail:window.UXQDirectStudioConfirmed}));setTimeout(()=>{if(!finished&&document.documentElement.dataset.uxqDirectStudio==='loading')reveal('โหลด Studio Practice ไม่สำเร็จ กรุณากลับ Mission Control แล้วลองใหม่')},10000)}catch(e){reveal(e.message||String(e))}}
  window.addEventListener('uxq-mission-resume-studio',()=>reveal());
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
  window.UXQDirectStudioEntryV1=Object.freeze({view,nodeId,version:'20260722-DIRECT-STUDIO-ENTRY-V1'});
})();