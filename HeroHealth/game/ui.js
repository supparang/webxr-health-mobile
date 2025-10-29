// === Hero Health Academy — game/ui.js (Stage 2.5)
const $  = (s)=>document.querySelector(s);
const $$ = (s)=>document.querySelectorAll(s);
const on = (el,ev,fn,opt)=> el && el.addEventListener(ev,fn,opt||{});

/* Keep UI clickable (canvas below) */
(function ensureLayers(){
  const c = $('#c'); if (c){ c.style.pointerEvents='none'; c.style.zIndex='1'; }
  ['hud','menu','modal','coach','item'].forEach(k=>{
    $$('.'+k).forEach(el=>{
      const z = parseInt(getComputedStyle(el).zIndex || '100', 10);
      el.style.pointerEvents='auto'; if (z<100) el.style.zIndex='100';
    });
  });
})();

/* Local state */
const UI = { modeKey:'goodjunk', diff:'Normal', lang:'TH',
  seenHelp: JSON.parse(localStorage.getItem
