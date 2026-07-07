(()=>{'use strict';
if(window.__AQ_S2_VIEW_GUARD_698__)return;window.__AQ_S2_VIEW_GUARD_698__=true;
const $=id=>document.getElementById(id);
function recover(){try{document.documentElement.style.background='#06101f';if(document.body){document.body.style.background='#06101f';document.body.style.color='#e8f1ff';}const entry=$('entry');if(!entry)return;const active=document.querySelector('.screen.on');if(!active){document.querySelectorAll('.screen').forEach(n=>{n.classList.remove('on');n.style.display='none';});entry.classList.add('on');entry.style.display='block';}}catch(e){}}
window.addEventListener('error',()=>setTimeout(recover,0));window.addEventListener('unhandledrejection',()=>setTimeout(recover,0));document.addEventListener('DOMContentLoaded',()=>setTimeout(recover,700));setInterval(recover,1200);recover();
})();