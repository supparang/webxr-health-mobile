/* CSAI2102 AI Quest — S1 Context Consistency v6.9.4
   Repairs the final integration point between the semantic deck and the runtime
   context gate. A Case must use the same location in its header, its gameplay
   prompt, and its Reflection evidence card.
*/
(()=>{'use strict';
  if(window.__AIQUEST_S1_CONTEXT_CONSISTENCY_V694__)return;
  window.__AIQUEST_S1_CONTEXT_CONSISTENCY_V694__=true;
  const MID=String(new URLSearchParams(location.search).get('mission')||'s1').toLowerCase();
  if(MID!=='s1'&&MID!=='m1')return;
  const ACTIVE='CSAI2102_ACTIVE_REPLAY_V674_'+MID;
  const places=['ศูนย์คัดกรองอีเมลภาควิชา','ศูนย์ประเมินการเข้าถึงบริการ','ศูนย์ช่วยเหลือฉุกเฉิน','ศูนย์จัดการห้องเรียน','ศูนย์จัดการพลังงานสะอาด','ศูนย์จัดการพลังงาน','ศูนย์จัดการพลังงานสะอาด','ศูนย์จัดการพลังงาน','ศูนย์ติดตามอุปกรณ์','ศูนย์ตรวจคุณภาพน้ำ','ศูนย์บริการนักศึกษา','ศูนย์บริการชุมชน','ศูนย์ประสานงานอาสา','ศูนย์แนะแนวอาชีพ','ศูนย์เรียนรู้ผู้สูงอายุ','ศูนย์เรียนรู้วิทยาศาสตร์','ศูนย์อาสาสมัคร','ศูนย์กีฬา','ศูนย์ข้อมูลเทศบาล','ศูนย์ควบคุมจราจร','สำนักงานทะเบียน','ห้องปฏิบัติการวิทยาศาสตร์','ห้องสมุดดิจิทัล','คลินิกมหาวิทยาลัย','ตลาดชุมชนดิจิทัล','ร้านค้าปลีกชุมชน','ระบบรถรับส่งมหาวิทยาลัย','ระบบทุนการศึกษา','ระบบทุนการศึกษา','โรงพยาบาลสัตว์มหาวิทยาลัย','โรงอาหารอัจฉริยะ','ศูนย์คัดแยกขยะ','ศูนย์บริการผู้พิการ','ศูนย์รับแจ้งเหตุ','ศูนย์ดูแลผู้สูงอายุ','ศูนย์ดูแลอาคารอัจฉริยะ'];
  const known=[...new Set(places)].sort((a,b)=>b.length-a.length);
  const clean=value=>String(value==null?'':value).replace(/\s+/g,' ').trim();
  const read=(key,fallback)=>{try{const value=JSON.parse(localStorage.getItem(key)||'null');return value==null?fallback:value}catch(e){return fallback}};
  const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value))}catch(e){}};
  const semantic=deck=>Array.isArray(deck?.cards)&&deck.cards.length===15&&(deck?.semanticAudit?.ok||deck.cards.every(card=>String(card?.source||'').startsWith('s1:')));
  const currentPlace=card=>clean(card?.contextBase||String(card?.context||'').split('•').slice(-1).join('•')||card?.semanticPlace||'');
  function normaliseCard(card){
    const place=currentPlace(card);if(!place)return false;
    const full=clean(card.context||'');let prompt=String(card.prompt||'');let changed=false;
    if(full&&prompt.includes(full)){prompt=prompt.split(full).join(place);changed=true;}
    for(const candidate of known){
      if(candidate!==place&&prompt.includes(candidate)){prompt=prompt.split(candidate).join(place);changed=true;}
    }
    if(changed)card.prompt=prompt;
    card.semanticPlace=place;
    return changed;
  }
  function repairSnapshot(){
    const snapshot=read(ACTIVE,null);if(!semantic(snapshot?.deck))return;
    let changed=false;snapshot.deck.cards.forEach(card=>{changed=normaliseCard(card)||changed;});
    if(changed)write(ACTIVE,snapshot);
  }
  function patchFactory(){
    const api=window.AIQuestReplayFactoryV650;
    if(!api||api.__contextConsistencyV694||typeof api.makeDeck!=='function')return;
    api.__contextConsistencyV694=true;
    const original=api.makeDeck.bind(api);
    api.makeDeck=function(){
      const deck=original();
      if(!semantic(deck))return deck;
      deck.cards.forEach(card=>{
        const place=currentPlace(card);if(!place)return;
        card.semanticGeneratedContext=clean(card.context||'');
        card.context=place;
        card.contextBase=place;
        card.contextSignature=place;
      });
      deck.contextConsistency={version:'v6.9.4',ready:true};
      return deck;
    };
  }
  function patchVisibleEvidence(){
    const snapshot=read(ACTIVE,null);if(!semantic(snapshot?.deck))return;
    const byId=new Map(snapshot.deck.cards.map(card=>[String(card.id||''),card]));
    document.querySelectorAll('.cevi-card[data-case]').forEach(node=>{
      const card=byId.get(String(node.dataset.case||''));if(!card)return;
      const prompt=node.querySelector('.cevi-prompt');if(prompt){const text='โจทย์: '+String(card.prompt||'');if(prompt.textContent.replace(/\s+/g,' ').trim()!==text.replace(/\s+/g,' ').trim())prompt.textContent=text;}
    });
  }
  function patchVisibleQuestion(){
    const snapshot=read(ACTIVE,null);const index=Number(snapshot?.index||0),card=snapshot?.deck?.cards?.[index];if(!card)return;
    const question=document.querySelector('.question');if(!question)return;
    const current=question.textContent||'';const place=currentPlace(card);if(!place)return;
    let next=current;for(const candidate of known){if(candidate!==place&&next.includes(candidate))next=next.split(candidate).join(place);}if(next!==current)question.textContent=next;
  }
  setInterval(()=>{patchFactory();repairSnapshot();patchVisibleEvidence();patchVisibleQuestion();},90);
  patchFactory();repairSnapshot();patchVisibleEvidence();patchVisibleQuestion();
})();
