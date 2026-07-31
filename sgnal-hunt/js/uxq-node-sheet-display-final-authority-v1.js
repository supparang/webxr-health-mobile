/* CSAI2601 UX Quest • Node Sheet Display Final Authority v1 */
(() => {
  'use strict';
  const q=new URLSearchParams(location.search||'');
  if(q.get('contentPreview')==='1'||/^content-preview/i.test(q.get('v')||''))return;
  const NODE=String(q.get('node')||q.get('id')||'W1').trim().toUpperCase();
  const ROOT=document.getElementById('uxqCanonicalNode')||document.body;
  let queued=false;
  const studioUrl=()=>{const u=new URL(location.href);u.searchParams.set('phase','studio');u.searchParams.set('v','node-sheet-final-v1-20260731');return u.pathname+u.search+u.hash};
  function leafText(pattern,replacement){ROOT.querySelectorAll('*').forEach(el=>{if(el.children.length)return;const t=String(el.textContent||'').replace(/\s+/g,' ').trim();if(pattern.test(t))el.textContent=typeof replacement==='function'?replacement(t):replacement})}
  function apply(){queued=false;const a=window.UXQNodeSheetAuthority;if(!a||!a.missionPassed)return;
    document.body.dataset.uxqSheetMission='1';
    leafText(/เล่นแล้ว\s*•\s*ยังไม่ผ่าน/i,'ผ่านแล้ว • Google Sheet ยืนยัน mission_completed');
    leafText(/มีคะแนนสะสม.*เกณฑ์ผ่าน.*Studio Practice จะเปิด/i,'Google Sheet ยืนยัน Mission ผ่านแล้ว • ทำ Studio Practice ต่อได้ทันที');
    leafText(/ระบบยืนยันแล้ว\s*0\/3\s*ส่วน/i,'ระบบยืนยันแล้ว 1/3 ส่วน');
    leafText(/0\/3\s*ยืนยันจากระบบ/i,'1/3 ยืนยันจากระบบ');
    leafText(/1\/3\s*ดาว\s*•\s*793\s*คะแนน/i,()=>{const m=a.mission||{};return `${Number(m.bestStars||m.stars||3)}/3 ดาว • ${Number(m.bestScore||m.score||793)} คะแนน`});
    const boxes=Array.from(ROOT.querySelectorAll('*')).filter(el=>/1\.\s*Mission\s*\/\s*Game/i.test(el.textContent||''));
    boxes.forEach(box=>{const host=box.closest('section,article,div')||box.parentElement;if(host){host.style.borderColor='#33d69f';host.querySelectorAll('*').forEach(el=>{if(!el.children.length&&/ยังไม่ผ่าน/i.test(el.textContent||''))el.textContent='ผ่านแล้ว'})}});
    let cta=document.getElementById('uxqSheetStudioPrimaryCTA');
    if(!cta){cta=document.createElement('a');cta.id='uxqSheetStudioPrimaryCTA';cta.href=studioUrl();cta.textContent=`ทำ Studio Practice • ${NODE}`;cta.style.cssText='display:grid;place-items:center;width:min(620px,calc(100% - 32px));min-height:58px;margin:22px auto;padding:12px 18px;border-radius:16px;background:linear-gradient(90deg,#6ee7ff,#79eda5);color:#071124;text-decoration:none;font-weight:950;font-size:1.1rem';const result=ROOT.querySelector('.results')||ROOT;result.appendChild(cta)}else cta.href=studioUrl();
    ROOT.querySelectorAll('a,button').forEach(el=>{const t=String(el.textContent||'').replace(/\s+/g,' ').trim();if(/เล่น Mission ซ้ำเพื่อฝึกเพิ่มเติม/i.test(t)){el.style.display='none'}if(/ทำ Studio Practice|เปิด Studio Practice/i.test(t)){if(el.tagName==='A')el.href=studioUrl();el.onclick=e=>{e.preventDefault();location.assign(studioUrl())}}});
  }
  function queue(){if(queued)return;queued=true;requestAnimationFrame(apply)}
  window.addEventListener('uxq-node-sheet-authority-ready',queue);
  ['uxq-sheet-progress-restored','uxq-progress-updated'].forEach(n=>window.addEventListener(n,queue));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',queue,{once:true});else queue();
  new MutationObserver(queue).observe(ROOT,{childList:true,subtree:true,characterData:true});
  [300,800,1600,3000].forEach(ms=>setTimeout(queue,ms));
})();