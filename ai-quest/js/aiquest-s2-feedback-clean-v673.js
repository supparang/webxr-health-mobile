/* CSAI2102 S2 Agent Builder Bootstrap v6.8.6
   Loads all deck decorators in a fixed order so later layers cannot be overwritten.
*/
(()=>{'use strict';
  if(window.__AIQUEST_S2_BOOTSTRAP_V686__)return;
  window.__AIQUEST_S2_BOOTSTRAP_V686__=true;
  const esc=value=>String(value==null?'':value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
  let prepared=false,preparing=null;

  const plan=[
    ['rotation','./js/aiquest-s2-answer-rotation-v677.js?v=20260706-answer677',()=>!!window.__AIQUEST_S2_ANSWER_ROTATION_V677__],
    ['audit','./js/aiquest-s2-replay-audit-direct-v680.js?v=20260706-audit681',()=>!!window.__AIQUEST_S2_REPLAY_AUDIT_DIRECT_V681__],
    ['map-order','./js/aiquest-s2-map-order-v682.js?v=20260706-maporder682',()=>!!window.__AIQUEST_S2_MAP_ORDER_V682__],
    ['parity','./js/aiquest-s2-choice-parity-v683.js?v=20260706-parity683',()=>!!window.__AIQUEST_S2_CHOICE_PARITY_V683__],
    ['near-miss','./js/aiquest-s2-distractor-depth-v684.js?v=20260706-depth684',()=>!!window.__AIQUEST_S2_DISTRACTOR_DEPTH_V684__],
    ['authorship','./js/aiquest-s2-choice-authorship-v685.js?v=20260706-authorship685',()=>!!window.__AIQUEST_S2_CHOICE_AUTHORSHIP_V685__],
    ['reflection-evidence','./js/aiquest-s2-reflection-evidence-v681.js?v=20260706-evidence681',()=>!!window.__AIQUEST_S2_REFLECTION_EVIDENCE_V681__],
    ['evidence-dropdown','./js/aiquest-s2-evidence-dropdown-v686.js?v=20260706-dropdown686',()=>!!window.__AIQUEST_S2_EVIDENCE_DROPDOWN_V686__]
  ];

  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  function profileError(text){const node=document.getElementById('profileNote');if(node){node.className='notice bad';node.textContent=text}}
  async function waitFlag(check,ms=2600){const until=Date.now()+ms;while(Date.now()<until){if(check())return true;await sleep(35)}return check()}
  async function load(name,src,check){
    if(check())return true;
    const id='aiquestS2Bootstrap_'+name.replace(/[^a-z0-9]/gi,'_');
    let script=document.getElementById(id);
    if(!script){
      script=document.createElement('script');script.id=id;script.src=src;script.async=false;
      const loaded=new Promise((resolve,reject)=>{script.onload=resolve;script.onerror=reject});
      document.head.appendChild(script);
      try{await loaded}catch(e){return false}
    }
    return waitFlag(check);
  }
  async function prepare(){
    if(prepared)return true;
    if(preparing)return preparing;
    preparing=(async()=>{
      for(const [name,src,check] of plan){
        const ok=await load(name,src,check);
        if(!ok){profileError('ยังเตรียม S2 '+name+' ไม่สำเร็จ กรุณารีเฟรชหน้าแล้วลองใหม่');return false}
      }
      prepared=true;
      return true;
    })();
    const ok=await preparing;preparing=null;return ok;
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
    prepare();
    document.addEventListener('click',event=>{
      const start=event.target&&event.target.closest?event.target.closest('#start'):null;
      if(start&&!prepared){
        event.preventDefault();event.stopImmediatePropagation();event.stopPropagation();
        prepare().then(ok=>{if(ok)start.click()});
        return;
      }
      if(event.target&&event.target.closest&&event.target.closest('#checkMap'))setTimeout(repair,0);
    },true);
    new MutationObserver(()=>setTimeout(repair,0)).observe(document.body,{childList:true,subtree:true,characterData:true});
    setInterval(repair,260);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();