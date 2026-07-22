/* CSAI2601 UX Quest • Mission Control Unlock Policy v1
 * Official mission access: W1 is open; every next node opens when the previous mission is Sheet-confirmed.
 * Weekly 3/3 remains the Course Complete metric and next-work recommendation only.
 */
(() => {
  'use strict';
  const VERSION='20260722-MISSION-CONTROL-UNLOCK-POLICY-V1';
  const ORDER=['w1','w2','w3','b1','w4','w5','w6','w7','b2','w8','w9','w10','w11','b3','w12','w13','w14','b4','w15'];
  const params=new URLSearchParams(location.search||'');

  function contextUrl(id){
    const url=new URL('./csai2601-canonical-node-clean-v1.html',location.href);
    url.searchParams.set('node',id.toUpperCase());
    ['device','studentId','studentName','section','sid','name'].forEach(k=>{const v=params.get(k);if(v)url.searchParams.set(k,v)});
    url.searchParams.set('v','mission-control-unlock-policy-v1-20260722');
    return `${url.pathname}${url.search}`;
  }

  function latestStates(){
    const fromCombined=window.UXQCombinedCourseProgress?.states;
    if(Array.isArray(fromCombined)&&fromCombined.length===ORDER.length)return fromCombined;
    return null;
  }

  function apply(){
    const states=latestStates();
    if(!states)return;

    states.forEach((state,index)=>{
      const previous=index>0?states[index-1]:null;
      const missionUnlocked=index===0||Boolean(previous?.mission);
      const element=document.querySelector(`[data-node-id="${state.id}"]`)||document.querySelector(`[data-node="${state.id.toUpperCase()}"]`);
      if(element){
        element.dataset.threePartLocked='0';
        element.dataset.missionLocked=missionUnlocked?'0':'1';
        element.style.opacity=missionUnlocked?'':'0.5';
        element.style.filter=missionUnlocked?'':'saturate(.55)';

        const launch=element.querySelector('.campaign-launch');
        if(launch){
          if(missionUnlocked){
            launch.href=contextUrl(state.id);
            launch.setAttribute('aria-disabled','false');
            launch.onclick=null;
            launch.classList.add('uxq-primary-action');
            if(!state.mission) launch.textContent='เริ่ม Mission';
            else if(!state.studio) launch.textContent='ทำ Studio Practice';
            else if(!state.reflection) launch.textContent='ทำ Weekly Reflection';
            else launch.textContent='ดูผลงาน';
          }else{
            launch.href='#';
            launch.setAttribute('aria-disabled','true');
            launch.textContent=`รอ ${previous.id.toUpperCase()} ผ่าน Mission`;
            launch.onclick=e=>e.preventDefault();
            launch.classList.remove('uxq-primary-action');
          }
        }

        const badge=element.querySelector('.stage-state');
        if(badge){
          if(!missionUnlocked) badge.textContent=`🔒 รอ ${previous.id.toUpperCase()} ผ่าน Mission`;
          else if(state.complete) badge.textContent='✅ Complete 3/3';
          else if(state.mission) badge.textContent=`Mission ผ่านแล้ว • เหลือ ${2-Number(state.studio)-Number(state.reflection)} ส่วน`;
          else badge.textContent='พร้อมเริ่ม Mission';
        }

        let note=element.querySelector('.three-part-lock-note, .node-next-note');
        if(!note){note=document.createElement('div');element.appendChild(note)}
        note.className='node-next-note';
        if(!missionUnlocked) note.textContent=`ต้องให้ Google Sheet ยืนยัน mission_completed ของ ${previous.id.toUpperCase()} ก่อน`;
        else if(state.complete) note.textContent='ครบ 3/3 แล้ว';
        else if(state.mission&&!state.studio) note.textContent='Mission ผ่านแล้ว ทำ Studio Practice และ Reflection ต่อ';
        else if(state.mission&&!state.reflection) note.textContent='เหลือ Weekly Reflection';
        else note.textContent='เริ่ม Mission ของ Node นี้';
      }

      const row=document.querySelectorAll('.timeline-row')[index];
      if(row){
        row.classList.toggle('is-locked',!missionUnlocked);
        const action=row.querySelector('.timeline-row__action');
        if(action){
          action.href=missionUnlocked?contextUrl(state.id):'#';
          action.setAttribute('aria-disabled',missionUnlocked?'false':'true');
          action.textContent=!missionUnlocked?'Locked':!state.mission?'เริ่ม Mission':!state.studio?'ทำ Studio Practice':!state.reflection?'ทำ Weekly Reflection':'ดูผลงาน';
        }
      }
    });

    window.UXQMissionControlUnlockPolicy={version:VERSION,policy:'previous_mission_completed',states};
    document.body.dataset.uxqUnlockPolicy='previous-mission-completed';
  }

  let timer=0;
  function schedule(){clearTimeout(timer);timer=setTimeout(apply,40)}
  window.addEventListener('uxq-three-part-course-progress',schedule);
  window.addEventListener('uxq-mission-control-sheet-snapshot',schedule);
  window.addEventListener('uxq-sheet-progress-restored',schedule);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
})();