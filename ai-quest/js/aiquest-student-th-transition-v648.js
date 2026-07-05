(()=>{'use strict';
const $=id=>document.getElementById(id);
let pending=false;
function enableNext(){
  pending=false;
  const next=$('next'),feedback=$('feedback'),arena=$('arena');
  if(!next||!arena)return;
  const hasFeedback=!!(feedback&&feedback.classList.contains('show'));
  const noChoices=[...arena.querySelectorAll('.choice[data-a]')].every(x=>x.disabled);
  if(hasFeedback&&noChoices){
    next.disabled=false;
    next.removeAttribute('disabled');
    next.setAttribute('aria-disabled','false');
    next.style.opacity='1';
    next.style.pointerEvents='auto';
  }
}
function requestEnable(){if(pending)return;pending=true;requestAnimationFrame(enableNext)}
function boot(){
  const arena=$('arena');
  if(!arena)return setTimeout(boot,40);
  const observer=new MutationObserver(requestEnable);
  observer.observe(arena,{childList:true,subtree:true,attributes:true,attributeFilter:['class','disabled']});
  document.addEventListener('click',event=>{
    if(event.target.closest('.choice[data-a]')) setTimeout(requestEnable,0);
  },true);
  requestEnable();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();