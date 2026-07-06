/* CSAI2102 S2 Agent Builder feedback render fix v6.7.4 */
(()=>{'use strict';
  if(window.__AIQUEST_S2_FEEDBACK_CLEAN_V674__)return;
  window.__AIQUEST_S2_FEEDBACK_CLEAN_V674__=true;

  const repair=()=>{
    const node=document.getElementById('feedback');
    if(!node||!node.classList.contains('show'))return false;
    const raw=String(node.textContent||'');
    const start=raw.indexOf('<ul class="answerList">');
    const end=raw.indexOf('</ul>',start);
    if(start<0||end<0)return false;

    const before=raw.slice(0,start).trim();
    const list=raw.slice(start,end+5);
    const after=raw.slice(end+5).trim();
    const parser=document.createElement('div');
    parser.innerHTML=list;
    const items=[...parser.querySelectorAll('li')].map(item=>item.textContent.trim()).filter(Boolean);
    if(!items.length)return false;

    const title=node.querySelector('b')?.textContent||'✅ Agent Decision ถูกต้อง';
    node.innerHTML='<b>'+title.replace(/[&<>"\']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]))+'</b><br>'+before.replace(title,'').trim().replace(/[&<>"\']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]))+'<ul class="answerList">'+items.map(item=>'<li>'+item.replace(/[&<>"\']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]))+'</li>').join('')+'</ul><div>'+after.replace(/[&<>"\']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]))+'</div>';
    return true;
  };

  const observe=()=>{
    const root=document.body;
    if(!root)return;
    let queued=false;
    const queue=()=>{if(queued)return;queued=true;setTimeout(()=>{queued=false;repair()},0)};
    new MutationObserver(queue).observe(root,{childList:true,subtree:true,characterData:true});
    document.addEventListener('click',event=>{
      if(event.target&&event.target.closest&&event.target.closest('#checkMap'))setTimeout(repair,0);
    },false);
    setInterval(repair,180);
    repair();
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observe,{once:true});else observe();
})();