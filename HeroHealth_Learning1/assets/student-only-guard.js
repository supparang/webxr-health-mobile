(()=>{
'use strict';
const KEY='herohealth_learning_platform_rc2';
function forceStudentState(){
  try{
    const s=JSON.parse(localStorage.getItem(KEY)||'{}');
    if(s&&s.view!=='student'){s.view='student';localStorage.setItem(KEY,JSON.stringify(s));}
  }catch(_){}
}
function clean(){
  document.querySelectorAll('.topbar .nav, .hh-live-link').forEach(el=>el.remove());
  document.querySelectorAll('.topbar button').forEach(btn=>{
    const t=(btn.textContent||'').trim().toLowerCase();
    if(t.includes('teacher')||t.includes('ครู')||t.includes('จอห้องเรียน'))btn.remove();
  });
  document.querySelectorAll('a[href*="teacher"],button[onclick*="teacher"],button[onclick*="classroom"]').forEach(el=>el.remove());
}
forceStudentState();
const originalGo=()=>window.HH&&window.HH.go;
addEventListener('DOMContentLoaded',()=>{
  forceStudentState();clean();
  const timer=setInterval(()=>{
    if(window.HH&&typeof window.HH.go==='function'&&!window.HH.__studentOnly){
      const old=window.HH.go.bind(window.HH);
      window.HH.go=v=>old('student');
      window.HH.__studentOnly=true;
    }
    clean();
  },200);
  setTimeout(()=>clearInterval(timer),10000);
  new MutationObserver(clean).observe(document.body,{childList:true,subtree:true});
});
})();
