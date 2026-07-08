/* CSAI2601 UX Quest • Student Challenge Guard v2
 * Challenge HUD + anti-guess guard. Ignores programmatic option clicks from mini-game boards
 * to avoid double counting.
 */
(() => {
  'use strict';
  const $=(s,r=document)=>r.querySelector(s); const text=e=>String(e?.textContent||'').trim(); const qp=()=>new URLSearchParams(location.search||''); const node=()=>String(qp().get('node')||qp().get('id')||'W1').toUpperCase();
  const KEY=`uxq.challenge.v2.${node()}`; let start=Date.now(); let current='';
  function get(){try{return JSON.parse(sessionStorage.getItem(KEY)||'{}')}catch(e){return{}}}
  function set(o){try{sessionStorage.setItem(KEY,JSON.stringify(o))}catch(e){}}
  function mark(){return `${node()}|${text($('.top .pill'))}|${text($('.hud .meter b'))}`;}
  function style(){if($('#uxq-challenge-v2-style'))return; const s=document.createElement('style'); s.id='uxq-challenge-v2-style'; s.textContent=`.uxqChallengeHud{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:10px 0 12px}.uxqChallengeHud span{border:1px solid rgba(255,209,102,.34);border-radius:999px;padding:6px 9px;background:rgba(255,209,102,.08);color:#ffe8ad;font-weight:900;font-size:.78rem}.uxqChallengeHud .danger{border-color:rgba(255,95,130,.45);color:#ffd1dc;background:rgba(255,95,130,.08)}.uxqGuessToast{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:9999;max-width:min(92vw,560px);border:1px solid rgba(255,209,102,.45);border-radius:16px;background:rgba(8,18,45,.96);box-shadow:0 18px 60px rgba(0,0,0,.35);color:#fff;padding:12px 14px;font-weight:850;line-height:1.45}.uxqGuessToast b{color:#ffe08a}`; document.head.appendChild(s);}
  function toast(msg){const old=$('.uxqGuessToast'); if(old)old.remove(); const d=document.createElement('div'); d.className='uxqGuessToast'; d.innerHTML=msg; document.body.appendChild(d); setTimeout(()=>d.remove(),2300);}
  function resetIfNewRound(){const m=mark(); if(m!==current){current=m; start=Date.now();}}
  function hud(){style(); resetIfNewRound(); const q=$('.question'); if(!q||$('.verify')||$('.feedback'))return; let h=$('.uxqChallengeHud',q); if(!h){h=document.createElement('div'); h.className='uxqChallengeHud'; const note=$('[data-student-ready-note]',q); if(note) note.insertAdjacentElement('afterend',h); else q.insertBefore(h,q.firstChild);} const st=get(); h.innerHTML=`<span>⚡ Combo ${Number(st.streak||0)}</span><span>🎯 Evidence read</span><span class="${st.fastGuess?'danger':''}">🛡 ${st.fastGuess?'อ่าน case ก่อน':'challenge live'}</span>`;}
  function hook(){const q=$('.question'); if(!q||q.dataset.challengeV2Hooked==='1')return; q.dataset.challengeV2Hooked='1'; q.addEventListener('click',e=>{if(!e.isTrusted)return; const target=e.target.closest('.uxqMiniCard,.uxqDragConfirm,.option[data-choice]'); if(!target||target.closest('.verify')||target.closest('.feedback'))return; const elapsed=Date.now()-start; const st=get(); if(elapsed<1800){st.fastGuess=true; st.streak=0; toast('<b>ช้าก่อน!</b> ตัวลวงใกล้กันมาก อ่าน case + tag ก่อน จะเก็บ combo ได้ดีกว่า');}else{st.fastGuess=false; st.streak=Number(st.streak||0)+1;} set(st);},true);}
  let t=0; function apply(){clearTimeout(t); t=setTimeout(()=>{hud();hook();},58);} if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true}); else apply(); new MutationObserver(apply).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
})();
