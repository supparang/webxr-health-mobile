/* CSAI2102 S2 Agent Builder Bootstrap v6.7.7 */
(()=>{'use strict';
  if(window.__AIQUEST_S2_BOOTSTRAP_V677__)return;
  window.__AIQUEST_S2_BOOTSTRAP_V677__=true;
  const esc=value=>String(value==null?'':value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));

  let rotationReady=!!window.__AIQUEST_S2_ANSWER_ROTATION_V677__;
  function loadRotation(){
    if(rotationReady||document.getElementById('aiquestS2AnswerRotationV677'))return;
    const script=document.createElement('script');
    script.id='aiquestS2AnswerRotationV677';
    script.async=false;
    script.src='./js/aiquest-s2-answer-rotation-v677.js?v=20260706-answer677';
    script.onload=()=>{rotationReady=!!window.__AIQUEST_S2_ANSWER_ROTATION_V677__};
    document.head.appendChild(script);
  }

  function repair(){
    const node=document.getElementById('feedback');
    if(!node||!node.classList.contains('show'))return false;
    const raw=String(node.textContent||'');
    const start=raw.indexOf('<ul class="answerList">');
    const end=raw.indexOf('</ul>',start);
    if(start<0||end<0)return false;
    const originalTitle=String(node.querySelector('b')?.textContent||'✅ Agent Decision ถูกต้อง').trim();
    const before=raw.slice(0,start).trim();
    const intro=before.indexOf(originalTitle)===0?before.slice(originalTitle.length).trim():before;
    const parser=document.createElement('div');parser.innerHTML=raw.slice(start,end+5);
    const items=[...parser.querySelectorAll('li')].map(item=>item.textContent.trim()).filter(Boolean);
    if(!items.length)return false;
    const after=raw.slice(end+5).trim();
    node.innerHTML='<div style="font-weight:900;font-size:17px;margin-bottom:8px">'+esc(originalTitle)+'</div><div style="margin-bottom:8px">'+esc(intro)+'</div><ul class="answerList" style="margin:7px 0 9px;padding-left:21px;display:grid;gap:5px">'+items.map(item=>'<li>'+esc(item)+'</li>').join('')+'</ul><div style="opacity:.96">'+esc(after)+'</div>';
    return true;
  }

  function boot(){
    loadRotation();
    let queued=false;
    const queue=()=>{if(queued)return;queued=true;setTimeout(()=>{queued=false;repair()},0)};
    new MutationObserver(queue).observe(document.body,{childList:true,subtree:true,characterData:true});
    document.addEventListener('click',event=>{
      const start=event.target&&event.target.closest?event.target.closest('#start'):null;
      if(start&&!rotationReady){
        event.preventDefault();event.stopImmediatePropagation();event.stopPropagation();
        loadRotation();setTimeout(()=>{if(window.__AIQUEST_S2_ANSWER_ROTATION_V677__)start.click();},45);
        return;
      }
      if(event.target&&event.target.closest&&event.target.closest('#checkMap'))setTimeout(repair,0);
    },true);
    setInterval(repair,240);repair();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();