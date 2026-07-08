/* CSAI2601 UX Quest • Adaptive Challenge v1
 * Raises visible challenge pressure when learners answer too quickly or build a streak.
 * It does not change score formulas; it changes prompts, pressure HUD, and helper visibility.
 */
(() => {
  'use strict';
  const $=(s,r=document)=>r.querySelector(s); const $$=(s,r=document)=>Array.from(r.querySelectorAll(s)); const txt=e=>String(e?.textContent||'').trim(); const qp=()=>new URLSearchParams(location.search||''); const node=()=>String(qp().get('node')||qp().get('id')||'W1').toUpperCase();
  const KEY=`uxq.adaptive.${node()}`; let start=Date.now(); let mark='';
  function get(){try{return JSON.parse(sessionStorage.getItem(KEY)||'{}')}catch(e){return{}}}
  function set(o){try{sessionStorage.setItem(KEY,JSON.stringify(o))}catch(e){}}
  function currentMark(){return `${node()}|${txt($('.top .pill'))}|${txt($('.hud .meter b'))}`;}
  function style(){if($('#uxq-adaptive-style'))return; const s=document.createElement('style'); s.id='uxq-adaptive-style'; s.textContent=`.uxqAdaptiveBar{display:grid;gap:7px;border:1px solid rgba(255,95,130,.35);border-radius:16px;background:linear-gradient(135deg,rgba(255,95,130,.12),rgba(255,209,102,.07));padding:10px 12px;margin:10px 0;color:#fff}.uxqAdaptiveBar b{color:#ffd1dc}.uxqAdaptiveBar span{color:#ffe8ad;font-weight:850}.uxqHardMode .student-ready-note{display:none!important}.uxqHardMode .uxqMiniHint,.uxqHardMode .uxqDragHint{border-color:rgba(255,95,130,.45)!important;color:#ffd1dc!important}`; document.head.appendChild(s);}
  function level(st){const streak=Number(st.streak||0), fast=Number(st.fast||0); if(streak>=5||fast>=3)return 3; if(streak>=3||fast>=2)return 2; return 1;}
  function updateRound(){const m=currentMark(); if(m!==mark){mark=m;start=Date.now();}}
  function inject(){style(); updateRound(); const q=$('.question'); if(!q||$('.verify')||$('.feedback'))return; const st=get(); const lv=level(st); document.body.classList.toggle('uxqHardMode',lv>=2); let bar=$('.uxqAdaptiveBar',q); if(!bar){bar=document.createElement('div');bar.className='uxqAdaptiveBar'; q.insertBefore(bar,q.firstChild);} const label=lv===3?'🔥 HARD MODE: ตัวลวงใกล้กันมาก':lv===2?'⚡ CHALLENGE MODE: ต้องอ่าน evidence ก่อน':'🎮 NORMAL MODE: สะสม combo จากการอ่าน case'; bar.innerHTML=`<b>${label}</b><span>Streak ${Number(st.streak||0)} • Fast guess risk ${Number(st.fast||0)}</span>`;}
  function hook(){const q=$('.question'); if(!q||q.dataset.adaptiveHooked==='1')return; q.dataset.adaptiveHooked='1'; q.addEventListener('click',e=>{const btn=e.target.closest('.option[data-choice],.uxqMiniCard,.uxqDragConfirm'); if(!btn||btn.closest('.verify')||btn.closest('.feedback'))return; const st=get(); const elapsed=Date.now()-start; if(elapsed<2300){st.fast=Number(st.fast||0)+1; st.streak=0;} else {st.fast=Math.max(0,Number(st.fast||0)-1); st.streak=Number(st.streak||0)+1;} set(st);},true);}
  let t=0; function apply(){clearTimeout(t); t=setTimeout(()=>{inject();hook();},60);} if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true}); else apply(); new MutationObserver(apply).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
})();
