/* CSAI2601 UX Quest • Adaptive Challenge v2
 * Visible adaptive pressure. Ignores programmatic option clicks from mini-game boards.
 */
(() => {
  'use strict';
  const $=(s,r=document)=>r.querySelector(s); const txt=e=>String(e?.textContent||'').trim(); const qp=()=>new URLSearchParams(location.search||''); const node=()=>String(qp().get('node')||qp().get('id')||'W1').toUpperCase();
  const KEY=`uxq.adaptive.v2.${node()}`; let start=Date.now(); let current='';
  function get(){try{return JSON.parse(sessionStorage.getItem(KEY)||'{}')}catch(e){return{}}}
  function set(o){try{sessionStorage.setItem(KEY,JSON.stringify(o))}catch(e){}}
  function mark(){return `${node()}|${txt($('.top .pill'))}|${txt($('.hud .meter b'))}`;}
  function reset(){const m=mark(); if(m!==current){current=m; start=Date.now();}}
  function level(st){const streak=Number(st.streak||0), fast=Number(st.fast||0); if(streak>=5||fast>=3)return 3; if(streak>=3||fast>=2)return 2; return 1;}
  function style(){if($('#uxq-adaptive-v2-style'))return; const s=document.createElement('style'); s.id='uxq-adaptive-v2-style'; s.textContent=`.uxqAdaptiveBar{display:grid;gap:7px;border:1px solid rgba(255,95,130,.35);border-radius:16px;background:linear-gradient(135deg,rgba(255,95,130,.12),rgba(255,209,102,.07));padding:10px 12px;margin:10px 0;color:#fff}.uxqAdaptiveBar b{color:#ffd1dc}.uxqAdaptiveBar span{color:#ffe8ad;font-weight:850}.uxqHardMode .student-ready-note{display:none!important}.uxqHardMode .uxqMiniHint,.uxqHardMode .uxqDragHint{border-color:rgba(255,95,130,.45)!important;color:#ffd1dc!important}`; document.head.appendChild(s);}
  function bar(){style(); reset(); const q=$('.question'); if(!q||$('.verify')||$('.feedback'))return; const st=get(); const lv=level(st); document.body.classList.toggle('uxqHardMode',lv>=2); let b=$('.uxqAdaptiveBar',q); if(!b){b=document.createElement('div'); b.className='uxqAdaptiveBar'; q.insertBefore(b,q.firstChild);} const label=lv===3?'🔥 HARD MODE: ตัวลวงใกล้มาก':lv===2?'⚡ CHALLENGE MODE: ต้องอ่าน evidence':'🎮 NORMAL MODE: สะสม combo จากการอ่าน case'; b.innerHTML=`<b>${label}</b><span>Streak ${Number(st.streak||0)} • Fast risk ${Number(st.fast||0)}</span>`;}
  function hook(){const q=$('.question'); if(!q||q.dataset.adaptiveV2Hooked==='1')return; q.dataset.adaptiveV2Hooked='1'; q.addEventListener('click',e=>{if(!e.isTrusted)return; const target=e.target.closest('.uxqMiniCard,.uxqDragConfirm,.option[data-choice]'); if(!target||target.closest('.verify')||target.closest('.feedback'))return; const st=get(); const elapsed=Date.now()-start; if(elapsed<2300){st.fast=Number(st.fast||0)+1; st.streak=0;}else{st.fast=Math.max(0,Number(st.fast||0)-1); st.streak=Number(st.streak||0)+1;} set(st);},true);}
  let t=0; function apply(){clearTimeout(t); t=setTimeout(()=>{bar();hook();},72);} if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true}); else apply(); new MutationObserver(apply).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
})();
