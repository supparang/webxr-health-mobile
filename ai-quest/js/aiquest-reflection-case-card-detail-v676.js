/* CSAI2102 AI Quest — Reflection Case Card Detail v6.7.6
   Makes repeated contexts distinguishable by showing a concise prompt preview on every
   selectable Case card in S1/core and S2 reflection evidence pickers.
*/
(()=>{'use strict';
  if(window.__AIQUEST_REFLECTION_CASE_CARD_DETAIL_V676__)return;
  window.__AIQUEST_REFLECTION_CASE_CARD_DETAIL_V676__=true;

  const $=id=>document.getElementById(id);
  const params=new URLSearchParams(location.search);
  const MID=String(params.get('mission')||'s1').toLowerCase();
  const CORE_ACTIVE='CSAI2102_ACTIVE_REPLAY_V674_'+MID;
  const S2_ACTIVE='CSAI2102_ACTIVE_S2_V674';
  const read=(key,fallback)=>{try{const value=JSON.parse(localStorage.getItem(key)||'null');return value==null?fallback:value}catch(e){return fallback}};
  const clean=value=>String(value==null?'':value).replace(/\s+/g,' ').trim();
  const esc=value=>String(value==null?'':value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
  const shorten=(value,max=118)=>{const text=clean(value).replace(/^⚡\s*/,'');return text.length>max?text.slice(0,max-1)+'…':text};

  function cards(key){
    const snapshot=read(key,null),deck=snapshot?.deck;
    if(!deck||!Array.isArray(deck.cards))return new Map();
    return new Map(deck.cards.map(card=>[String(card?.id||''),card]));
  }
  function appendDetail(button,card,kind){
    if(!button||!card)return;
    const key=String(card.id||'')+'|'+clean(card.prompt);
    let detail=button.querySelector('.aiquest-case-prompt-v676');
    if(detail&&detail.dataset.key===key)return;
    if(!detail){detail=document.createElement('span');detail.className='aiquest-case-prompt-v676';button.appendChild(detail);}
    detail.dataset.key=key;
    detail.innerHTML='<b>โจทย์:</b> '+esc(shorten(card.prompt||'รายละเอียด Case นี้'));
    button.title=clean(card.prompt||'');
    if(kind==='core'){
      const meta=button.querySelector('.cev-cardmeta');
      if(meta&&!meta.dataset.v676){meta.dataset.v676='1';meta.insertAdjacentHTML('beforeend',' <span class="aiquest-case-read-v676">• อ่านโจทย์ย่อก่อนเลือก</span>');}
    }
  }
  function decorateCore(){
    const panel=$('coreEvidenceBindingV675');
    if(!panel)return;
    const byId=cards(CORE_ACTIVE);
    if(!byId.size)return;
    const desc=panel.querySelector('.cev-desc');
    if(desc&&!desc.dataset.v676){desc.dataset.v676='1';desc.textContent='เลือก 1 Case ที่อธิบายได้ดีที่สุดจาก Deck ที่เล่นจริง การเลือกไม่เปลี่ยนคะแนน แต่ใช้เป็นหลักฐานประกอบ Reflection ให้ครูตรวจ';}
    panel.querySelectorAll('.cev-case[data-value]').forEach(button=>appendDetail(button,byId.get(String(button.dataset.value||'')),'core'));
  }
  function decorateS2(){
    const panel=$('s2EvidenceBindingV675');
    if(!panel)return;
    const byId=cards(S2_ACTIVE);
    if(!byId.size)return;
    const desc=panel.querySelector('.s2ev-desc');
    if(desc&&!desc.dataset.v676){desc.dataset.v676='1';desc.textContent='เลือก 1 Case ที่อธิบายได้ดีที่สุดจาก Deck ที่เล่นจริง การเลือกไม่เปลี่ยนคะแนน แต่จะผูก Context, Skill และ Policy ไปกับ Reflection ให้ครูตรวจ';}
    panel.querySelectorAll('.s2ev-case[data-value]').forEach(button=>appendDetail(button,byId.get(String(button.dataset.value||'')),'s2'));
  }
  function style(){
    if($('aiquestReflectionCaseCardDetailStyleV676'))return;
    const node=document.createElement('style');node.id='aiquestReflectionCaseCardDetailStyleV676';node.textContent=`
      #coreEvidenceBindingV675 .aiquest-case-prompt-v676,
      #s2EvidenceBindingV675 .aiquest-case-prompt-v676{display:block;margin-top:6px;color:#dbeafe;font-size:12px;line-height:1.42;font-weight:600}
      #coreEvidenceBindingV675 .aiquest-case-prompt-v676 b,
      #s2EvidenceBindingV675 .aiquest-case-prompt-v676 b{color:#7dd3fc}
      #coreEvidenceBindingV675 .aiquest-case-read-v676{color:#93c5fd;font-weight:650}
      #coreEvidenceBindingV675 .cev-case,#s2EvidenceBindingV675 .s2ev-case{min-height:101px!important}
    `;document.head.appendChild(node);
  }
  function apply(){style();decorateCore();decorateS2();}
  new MutationObserver(()=>setTimeout(apply,0)).observe(document.body,{childList:true,subtree:true});
  setInterval(apply,280);apply();
})();
