/* CSAI2601 UX Quest • Student Challenge Guard v1
 * Adds challenge HUD, streak pressure, and a gentle anti-guess guard.
 * Does not alter correctness or sheet sync; it nudges students to read evidence.
 */
(() => {
  'use strict';
  const $=(s,r=document)=>r.querySelector(s); const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const text=(el)=>String(el?.textContent||'').trim(); const qp=()=>new URLSearchParams(location.search||''); const node=()=>String(qp().get('node')||qp().get('id')||'W1').toUpperCase();
  const KEY=`uxq.challenge.${node()}`; let roundStart=Date.now(); let lastMark='';
  function state(){try{return JSON.parse(sessionStorage.getItem(KEY)||'{}')}catch(e){return{}}}
  function save(s){try{sessionStorage.setItem(KEY,JSON.stringify(s))}catch(e){}}
  function ensureStyle(){if($('#uxq-challenge-style'))return; const s=document.createElement('style'); s.id='uxq-challenge-style'; s.textContent=`
    .uxqChallengeHud{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:10px 0 12px}.uxqChallengeHud span{border:1px solid rgba(255,209,102,.34);border-radius:999px;padding:6px 9px;background:rgba(255,209,102,.08);color:#ffe8ad;font-weight:900;font-size:.78rem}.uxqChallengeHud .danger{border-color:rgba(255,95,130,.45);color:#ffd1dc;background:rgba(255,95,130,.08)}.uxqGuessToast{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:9999;max-width:min(92vw,560px);border:1px solid rgba(255,209,102,.45);border-radius:16px;background:rgba(8,18,45,.96);box-shadow:0 18px 60px rgba(0,0,0,.35);color:#fff;padding:12px 14px;font-weight:850;line-height:1.45}.uxqGuessToast b{color:#ffe08a}`; document.head.appendChild(s);}
  function mark(){return `${node()}|${text($('.top .pill'))}|${text($('.hud .meter b'))}`;}
  function hud(){ensureStyle(); const q=$('.question'); if(!q||$('.verify')||$('.feedback'))return; const m=mark(); if(lastMark!==m){roundStart=Date.now(); lastMark=m;} let h=$('.uxqChallengeHud',q); if(!h){h=document.createElement('div');h.className='uxqChallengeHud'; const note=$('[data-student-ready-note]',q); if(note) note.insertAdjacentElement('afterend',h); else q.insertBefore(h,q.firstChild);} const st=state(); const streak=Number(st.streak||0); const risk=st.fastGuess?'อ่านหลักฐานก่อน':'challenge live'; h.innerHTML=`<span>⚡ Combo ${streak}</span><span>🎯 Evidence read</span><span class="${st.fastGuess?'danger':''}">🛡 ${risk}</span>`; }
  function toast(msg){const old=$('.uxqGuessToast'); if(old)old.remove(); const d=document.createElement('div'); d.className='uxqGuessToast'; d.innerHTML=msg; document.body.appendChild(d); setTimeout(()=>d.remove(),2300);}
  function hook(){const q=$('.question'); if(!q||q.dataset.challengeHooked==='1')return; q.dataset.challengeHooked='1'; q.addEventListener('click',(e)=>{const btn=e.target.closest('.option[data-choice]'); if(!btn||btn.closest('.verify')||btn.closest('.feedback'))return; const elapsed=Date.now()-roundStart; const st=state(); if(elapsed<1800){st.fastGuess=true; st.streak=0; save(st); toast('<b>ช้าก่อน!</b> ข้อนี้ออกแบบให้ตัวลวงใกล้เคียงกันมาก อ่าน case + tag ก่อนเลือก จะเก็บ combo ได้ง่ายกว่า');}else{st.fastGuess=false; st.streak=Number(st.streak||0)+1; save(st);} },true);}
  let t=0; function apply(){clearTimeout(t); t=setTimeout(()=>{hud();hook();},55);} if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply(); new MutationObserver(apply).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
})();
