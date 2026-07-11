/* CSAI2102 Teacher Console — Analytics Layout Polish v7.1.1
   - deduplicate Unified Analytics / Learning Analytics badges
   - keep Learning Analytics Suite directly after All Students Detail
   - survives delayed renders and refreshes without touching analytics logic
*/
(()=>{'use strict';
  if(window.__AIQUEST_TEACHER_ANALYTICS_LAYOUT_POLISH_V711__)return;
  window.__AIQUEST_TEACHER_ANALYTICS_LAYOUT_POLISH_V711__=true;
  const VERSION='v7.1.1';

  function dedupeBadges(){
    const row=document.querySelector('.brand .row');
    if(!row)return;
    const specs=[
      {match:/Unified Analytics v699/i,id:'aqUnifiedBadgeV699',label:'✓ Unified Analytics v699'},
      {match:/Learning Analytics v710/i,id:'aq710Badge',label:'✓ Learning Analytics v710'}
    ];
    specs.forEach(spec=>{
      const hits=[...row.querySelectorAll('.pill')].filter(el=>spec.match.test(String(el.textContent||'')));
      if(!hits.length){
        const el=document.createElement('span');el.id=spec.id;el.className='pill good';el.textContent=spec.label;row.appendChild(el);return;
      }
      const keep=hits[0];keep.id=spec.id;keep.textContent=spec.label;
      hits.slice(1).forEach(el=>el.remove());
    });
  }

  function placeSuite(){
    const suite=document.getElementById('aqLearningAnalyticsV710');
    const students=document.getElementById('studentsBox')?.closest('section.card');
    if(!suite||!students||students.nextElementSibling===suite)return;
    students.insertAdjacentElement('afterend',suite);
  }

  function addAnchorHint(){
    const suite=document.getElementById('aqLearningAnalyticsV710');
    if(!suite||document.getElementById('aq711AnalyticsHint'))return;
    const hint=document.createElement('div');
    hint.id='aq711AnalyticsHint';hint.className='pill blue';
    hint.style.marginBottom='10px';
    hint.textContent='Analytics 1–10 • ใช้ cohort เดียวกับตารางด้านบน';
    suite.prepend(hint);
  }

  function apply(){dedupeBadges();placeSuite();addAnchorHint();}
  function boot(){
    apply();
    let runs=0;const timer=setInterval(()=>{apply();if(++runs>40)clearInterval(timer);},300);
    const obs=new MutationObserver(()=>requestAnimationFrame(apply));
    obs.observe(document.body,{childList:true,subtree:true});
    document.getElementById('refreshBtn')?.addEventListener('click',()=>setTimeout(apply,1400));
    window.addEventListener('aiquest:cohort-change',()=>setTimeout(apply,0));
    console.log('[AIQuest] Analytics Layout Polish active',VERSION);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.AIQUEST_TEACHER_ANALYTICS_LAYOUT_POLISH_V711={VERSION,apply};
})();