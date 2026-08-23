/* CSAI2601 UX Quest • Mission Control Navigation Fix v1
 * Owns the student-node Mission Control action.
 * Preserves learner identity/course context in the URL and uses direct same-tab
 * navigation so no async message-channel/extension response can block exit.
 */
(() => {
  'use strict';
  const q = new URLSearchParams(location.search || '');

  function profile(){
    let p={};
    try { p=window.UXQIdentity?.get?.() || {}; } catch(_) {}
    return {
      studentId:String(p.studentId || q.get('studentId') || q.get('sid') || '').trim(),
      studentName:String(p.studentName || q.get('studentName') || q.get('name') || '').trim(),
      section:String(p.section || q.get('section') || '').trim()
    };
  }

  function missionControlUrl(){
    const p=profile();
    const out=new URLSearchParams();
    if(p.studentId) out.set('studentId',p.studentId);
    if(p.studentName) out.set('studentName',p.studentName);
    if(p.section) out.set('section',p.section);
    ['courseId','course','classroom','term'].forEach(k=>{
      const v=q.get(k); if(v) out.set(k,v);
    });
    return './csai2601-mission-control.html' + (out.toString() ? '?' + out.toString() : '');
  }

  function bind(){
    const banner=document.getElementById('uxqStudentRuntimeBanner');
    if(!banner) return;
    const link=Array.from(banner.querySelectorAll('a,button')).find(el=>
      /mission\s*control/i.test(String(el.textContent||'')) || el.dataset.missionControl==='1'
    );
    if(!link) return;
    const href=missionControlUrl();
    if(link.tagName==='A') link.setAttribute('href',href);
    link.dataset.missionControl='1';
    if(link.dataset.navFixBound==='1') return;
    link.dataset.navFixBound='1';
    link.addEventListener('click',event=>{
      event.preventDefault();
      event.stopImmediatePropagation();
      window.location.assign(missionControlUrl());
    },true);
  }

  let timer=0;
  function schedule(){ clearTimeout(timer); timer=setTimeout(bind,20); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',schedule,{once:true}); else schedule();
  new MutationObserver(records=>{
    if(records.some(r=>r.type==='childList' && r.addedNodes.length)) schedule();
  }).observe(document.documentElement,{childList:true,subtree:true});
})();
