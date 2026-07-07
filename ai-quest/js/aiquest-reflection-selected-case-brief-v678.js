/* CSAI2102 AI Quest — Selected Case Brief v6.7.8
   Once a learner selects a Case, keep its actual prompt visible above the reflection
   fields so they do not have to reopen the list and accidentally write about another case.
*/
(()=>{'use strict';
  if(window.__AIQUEST_REFLECTION_SELECTED_CASE_BRIEF_V678__)return;
  window.__AIQUEST_REFLECTION_SELECTED_CASE_BRIEF_V678__=true;

  const $=id=>document.getElementById(id);
  const MID=String(new URLSearchParams(location.search).get('mission')||'s1').toLowerCase();
  const CORE_ACTIVE='CSAI2102_ACTIVE_REPLAY_V674_'+MID;
  const S2_ACTIVE='CSAI2102_ACTIVE_S2_V674';
  const read=(key,fallback)=>{try{const value=JSON.parse(localStorage.getItem(key)||'null');return value==null?fallback:value}catch(e){return fallback}};
  const clean=value=>String(value==null?'':value).replace(/\s+/g,' ').trim();
  const esc=value=>String(value==null?'':value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
  const shorten=(value,max=250)=>{const text=clean(value);return text.length>max?text.slice(0,max-1)+'…':text};
  const cards=key=>new Map(((read(key,null)?.deck?.cards)||[]).map(card=>[String(card?.id||''),card]));

  function core(){
    const panel=$('coreEvidenceBindingV675'),select=$('coreEvidenceCase');if(!panel||!select)return;
    const card=cards(CORE_ACTIVE).get(String(select.value||''));let box=$('coreSelectedCaseBriefV678');
    if(!card){box?.remove();return;}
    if(!box){box=document.createElement('div');box.id='coreSelectedCaseBriefV678';box.className='aiquest-selected-case-brief-v678';const status=panel.querySelector('.cev-status');status?.parentNode?.insertBefore(box,status);}
    box.innerHTML='<b>📌 โจทย์ Case ที่เลือก</b><br><span>'+esc(shorten(card.prompt||''))+'</span><small>ใช้โจทย์นี้เป็นฐานเดียวกันในการตอบ Reflection ทั้ง 3 ข้อ</small>';
  }
  function s2(){
    const panel=$('s2EvidenceBindingV675'),select=$('s2EvidenceCase');if(!panel||!select)return;
    const card=cards(S2_ACTIVE).get(String(select.value||''));let box=$('s2SelectedCaseBriefV678');
    if(!card){box?.remove();return;}
    if(!box){box=document.createElement('div');box.id='s2SelectedCaseBriefV678';box.className='aiquest-selected-case-brief-v678';const info=panel.querySelector('#s2EvidenceInfoV675');info?.parentNode?.insertBefore(box,info.nextSibling);}
    box.innerHTML='<b>📌 โจทย์ Case ที่เลือก</b><br><span>'+esc(shorten(card.prompt||''))+'</span><small>ใช้ Context, Skill และ Policy ของ Case นี้เป็นฐานเดียวกันในการตอบ Reflection ทั้ง 3 ข้อ</small>';
  }
  function style(){
    if($('aiquestSelectedCaseBriefStyleV678'))return;
    const style=document.createElement('style');style.id='aiquestSelectedCaseBriefStyleV678';style.textContent=`
      .aiquest-selected-case-brief-v678{margin-top:10px;padding:11px 12px;border:1px solid rgba(125,211,252,.48);border-radius:12px;background:rgba(14,116,144,.12);color:#e0f2fe;line-height:1.55}
      .aiquest-selected-case-brief-v678 b{color:#bae6fd}.aiquest-selected-case-brief-v678 small{display:block;margin-top:6px;color:#bfdbfe;font-size:12px}
    `;document.head.appendChild(style);
  }
  function apply(){style();core();s2();}
  document.addEventListener('change',event=>{if(['coreEvidenceCase','s2EvidenceCase'].includes(event.target?.id))setTimeout(apply,0);},true);
  new MutationObserver(()=>setTimeout(apply,0)).observe(document.body,{childList:true,subtree:true});
  setInterval(apply,220);apply();
})();
