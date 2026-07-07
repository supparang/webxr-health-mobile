/* CSAI2102 AI Quest — Reflection Case Card Detail v6.7.7
   Refines S1/core and S2 reflection case cards:
   - strips repeated context/template wording from the question preview
   - makes the click-to-select action explicit
   - gives a strong selected-state confirmation on the chosen card
*/
(()=>{'use strict';
  if(window.__AIQUEST_REFLECTION_CASE_CARD_DETAIL_V677__)return;
  window.__AIQUEST_REFLECTION_CASE_CARD_DETAIL_V677__=true;

  const $=id=>document.getElementById(id);
  const params=new URLSearchParams(location.search);
  const MID=String(params.get('mission')||'s1').toLowerCase();
  const CORE_ACTIVE='CSAI2102_ACTIVE_REPLAY_V674_'+MID;
  const S2_ACTIVE='CSAI2102_ACTIVE_S2_V674';
  const read=(key,fallback)=>{try{const value=JSON.parse(localStorage.getItem(key)||'null');return value==null?fallback:value}catch(e){return fallback}};
  const clean=value=>String(value==null?'':value).replace(/\s+/g,' ').trim();
  const esc=value=>String(value==null?'':value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
  const shorten=(value,max=132)=>{const text=clean(value);return text.length>max?text.slice(0,max-1)+'…':text};

  function cards(key){
    const snapshot=read(key,null),deck=snapshot?.deck;
    if(!deck||!Array.isArray(deck.cards))return new Map();
    return new Map(deck.cards.map(card=>[String(card?.id||''),card]));
  }
  function cleanPrompt(card){
    const context=clean(card?.context||'');
    let text=clean(card?.prompt||'รายละเอียด Case นี้');
    const prefixes=[
      '⚡ Case Twist — '+context+': ',
      'สถานการณ์: '+context+' — ',
      'คณะทำงานของ '+context+' ต้องตัดสินใจเรื่องนี้: ',
      'ก่อนนำระบบของ '+context+' ไปใช้จริง โปรดพิจารณา: ',
      'จากรายงานของ '+context+' ข้อใดเหมาะสมที่สุด: ',
      'ทีม '+context+' ',
      'ก่อนเปิดใช้ระบบของ '+context+' '
    ];
    prefixes.forEach(prefix=>{if(prefix&&text.startsWith(prefix))text=text.slice(prefix.length).trim();});
    return text||clean(card?.prompt||'รายละเอียด Case นี้');
  }
  function appendDetail(button,card,kind){
    if(!button||!card)return;
    const key=String(card.id||'')+'|'+clean(card.prompt);
    let detail=button.querySelector('.aiquest-case-prompt-v677');
    if(!detail){detail=document.createElement('span');detail.className='aiquest-case-prompt-v677';button.appendChild(detail);}
    if(detail.dataset.key!==key){
      detail.dataset.key=key;
      detail.innerHTML='<b>โจทย์:</b> '+esc(shorten(cleanPrompt(card)));
      button.title=clean(card.prompt||'');
    }
    let action=button.querySelector('.aiquest-case-action-v677');
    if(!action){action=document.createElement('span');action.className='aiquest-case-action-v677';button.appendChild(action);}
    const selected=button.classList.contains('selected');
    action.textContent=selected?'✓ เลือก Case นี้แล้ว':'กดเพื่อเลือก Case นี้';
    action.setAttribute('aria-live','polite');
    if(kind==='core'){
      const meta=button.querySelector('.cev-cardmeta');
      if(meta&&!meta.dataset.v677){meta.dataset.v677='1';meta.insertAdjacentHTML('beforeend',' <span class="aiquest-case-read-v677">• อ่านโจทย์ย่อก่อนเลือก</span>');}
    }
  }
  function decorateCore(){
    const panel=$('coreEvidenceBindingV675');
    if(!panel)return;
    const byId=cards(CORE_ACTIVE);
    if(!byId.size)return;
    const desc=panel.querySelector('.cev-desc');
    if(desc&&!desc.dataset.v677){desc.dataset.v677='1';desc.innerHTML='<b>วิธีเลือก:</b> อ่านโจทย์ย่อ แล้วกดการ์ดเพียง 1 ใบที่อธิบายได้ดีที่สุดจาก Deck ที่เล่นจริง การเลือกไม่เปลี่ยนคะแนน แต่ใช้เป็นหลักฐานประกอบ Reflection ให้ครูตรวจ';}
    panel.querySelectorAll('.cev-case[data-value]').forEach(button=>appendDetail(button,byId.get(String(button.dataset.value||'')),'core'));
  }
  function decorateS2(){
    const panel=$('s2EvidenceBindingV675');
    if(!panel)return;
    const byId=cards(S2_ACTIVE);
    if(!byId.size)return;
    const desc=panel.querySelector('.s2ev-desc');
    if(desc&&!desc.dataset.v677){desc.dataset.v677='1';desc.innerHTML='<b>วิธีเลือก:</b> อ่านโจทย์ย่อ แล้วกดการ์ดเพียง 1 ใบที่อธิบายได้ดีที่สุดจาก Deck ที่เล่นจริง การเลือกไม่เปลี่ยนคะแนน แต่จะผูก Context, Skill และ Policy ไปกับ Reflection ให้ครูตรวจ';}
    panel.querySelectorAll('.s2ev-case[data-value]').forEach(button=>appendDetail(button,byId.get(String(button.dataset.value||'')),'s2'));
  }
  function style(){
    if($('aiquestReflectionCaseCardDetailStyleV677'))return;
    const node=document.createElement('style');node.id='aiquestReflectionCaseCardDetailStyleV677';node.textContent=`
      #coreEvidenceBindingV675 .aiquest-case-prompt-v677,
      #s2EvidenceBindingV675 .aiquest-case-prompt-v677{display:block;margin-top:6px;color:#dbeafe;font-size:12px;line-height:1.42;font-weight:600}
      #coreEvidenceBindingV675 .aiquest-case-prompt-v677 b,
      #s2EvidenceBindingV675 .aiquest-case-prompt-v677 b{color:#7dd3fc}
      #coreEvidenceBindingV675 .aiquest-case-action-v677,
      #s2EvidenceBindingV675 .aiquest-case-action-v677{display:inline-flex;margin-top:8px;padding:3px 7px;border:1px solid rgba(96,165,250,.38);border-radius:999px;color:#bfdbfe;background:rgba(30,64,175,.18);font-size:11px;font-weight:850}
      #coreEvidenceBindingV675 .cev-case.selected .aiquest-case-action-v677,
      #s2EvidenceBindingV675 .s2ev-case.selected .aiquest-case-action-v677{border-color:rgba(52,211,153,.7);color:#bbf7d0;background:rgba(6,78,59,.55)}
      #coreEvidenceBindingV675 .aiquest-case-read-v677{color:#93c5fd;font-weight:650}
      #coreEvidenceBindingV675 .cev-case,#s2EvidenceBindingV675 .s2ev-case{min-height:132px!important}
    `;document.head.appendChild(node);
  }
  function apply(){style();decorateCore();decorateS2();}
  new MutationObserver(()=>setTimeout(apply,0)).observe(document.body,{childList:true,subtree:true});
  setInterval(apply,220);apply();
})();
