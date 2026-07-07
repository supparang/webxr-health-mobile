/* CSAI2102 AI Quest — Core Context Copy Polish v6.8.3
   The hard context gate makes every Case identity unique. This layer keeps that
   identity out of awkward sentence positions so the learner sees natural Thai.
*/
(()=>{'use strict';
  if(window.__AIQUEST_CORE_CONTEXT_COPY_POLISH_V683__)return;
  window.__AIQUEST_CORE_CONTEXT_COPY_POLISH_V683__=true;

  const MID=String(new URLSearchParams(location.search).get('mission')||'s1').toLowerCase();
  const ACTIVE='CSAI2102_ACTIVE_REPLAY_V674_'+MID;
  const $=selector=>document.querySelector(selector);
  const clean=value=>String(value==null?'':value).replace(/\s+/g,' ').trim();
  const read=()=>{try{return JSON.parse(localStorage.getItem(ACTIVE)||'null')}catch(e){return null}};
  const card=()=>{const snapshot=read();return snapshot?.deck?.cards?.[Number(snapshot?.index||0)]||null;};
  const kindLabel=item=>item?.kind==='m'?'กลไก':item?.kind==='q'?'ความรู้':'⚡ Case Twist';

  function promptFor(item){
    const source=clean(item?.prompt||'');
    const full=clean(item?.context||'');
    const place=clean(item?.contextBase||full.split('•').slice(-1).join('•')||'สถานการณ์นี้');
    const focus=clean(item?.scenarioFocus||full.split('•')[0]||'ภารกิจนี้');
    if(!source)return '';
    if(/^หลังระบบ\s+/.test(source)&&source.includes('สิ่งใดทำให้การตัดสินใจตรวจสอบย้อนหลังได้ดีที่สุด')){
      return 'ที่'+place+' ระบบดำเนินภารกิจ “'+focus+'” แล้ว หากต้องการให้การตัดสินใจตรวจสอบย้อนหลังได้ดีที่สุด ควรทำสิ่งใด';
    }
    if(source.startsWith('สถานการณ์: '+full+' — ')){
      return 'สถานการณ์: '+place+' — ภารกิจ “'+focus+'” '+source.slice(('สถานการณ์: '+full+' — ').length);
    }
    if(source.startsWith('ทีม '+full+' เลือกแนวทาง')){
      return source.replace('ทีม '+full,'ทีมงานที่ '+place);
    }
    if(source.startsWith('ก่อนเปิดใช้ระบบของ '+full)){
      return source.replace('ก่อนเปิดใช้ระบบของ '+full,'ก่อนเปิดใช้ระบบที่ '+place+' สำหรับภารกิจ “'+focus+'”');
    }
    if(source.startsWith('ถ้า '+full+' เลือก')){
      return source.replace('ถ้า '+full+' เลือก','หากระบบที่ '+place+' เลือก');
    }
    if(source.startsWith('⚡ Case Twist — '+full+' พบ')){
      return source.replace('⚡ Case Twist — '+full+' พบ','⚡ Case Twist — ที่ '+place+' ระบบพบ').replace('ก่อนเปิดใช้ระบบ:','ก่อนเปิดใช้ภารกิจ “'+focus+'”:');
    }
    if(source.startsWith('⚡ Case Twist — ผู้ใช้ของ '+full)){
      return source.replace('⚡ Case Twist — ผู้ใช้ของ '+full,'⚡ Case Twist — ผู้ใช้ที่ได้รับผลกระทบจากระบบใน '+place);
    }
    return full&&source.includes(full)?source.split(full).join(place):source;
  }
  function apply(){
    const item=card();if(!item)return;
    const focus=clean(item.scenarioFocus||''),place=clean(item.contextBase||''),sub=$('.arenaHead .muted'),question=$('.question');
    if(sub&&focus&&place)sub.textContent=kindLabel(item)+' • ภารกิจ: '+focus+' • สถานที่: '+place;
    if(question){const next=promptFor(item);if(next&&question.textContent!==next)question.textContent=next;}
  }
  function style(){
    if(document.getElementById('aiquestCoreContextCopyPolishStyleV683'))return;
    const node=document.createElement('style');node.id='aiquestCoreContextCopyPolishStyleV683';node.textContent='.arenaIcon{display:none!important}';document.head.appendChild(node);
  }
  style();
  new MutationObserver(()=>setTimeout(apply,0)).observe(document.body,{childList:true,subtree:true});
  setInterval(apply,140);apply();
})();
