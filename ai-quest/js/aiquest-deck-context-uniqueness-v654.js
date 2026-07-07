/* CSAI2102 AI Quest — Deck Context Uniqueness v6.5.4
   A different question is not enough when several cards show the same scene title.
   This layer assigns each card a distinct operational micro-context within a deck,
   preserves its original learning objective, and avoids reusing the same complete
   context signature across the latest four decks for the same learner.
*/
(()=>{'use strict';
  if(window.__AIQUEST_DECK_CONTEXT_UNIQUENESS_V654__)return;
  window.__AIQUEST_DECK_CONTEXT_UNIQUENESS_V654__=true;
  const query=new URLSearchParams(location.search);
  const mid=String(query.get('mission')||'s1').toLowerCase();
  const WINDOW=4;
  const coreActive='CSAI2102_ACTIVE_REPLAY_V674_'+mid;
  const s2Active='CSAI2102_ACTIVE_S2_V674';
  const key='CSAI2102_CONTEXT_SIGNATURES_V654';
  const tidy=value=>String(value==null?'':value).replace(/\s+/g,' ').trim();
  const read=(name,fallback)=>{try{const value=JSON.parse(localStorage.getItem(name)||'null');return value==null?fallback:value}catch(e){return fallback}};
  const write=(name,value)=>{try{localStorage.setItem(name,JSON.stringify(value))}catch(e){}};
  const profile=()=>{try{return window.AIQuestStorage?.getProfile?.()||read('CSAI2102_AIQUEST_PROFILE_V421',{})}catch(e){return {}}};
  const personKey=()=>String(profile().studentId||'guest').replace(/[^a-z0-9_-]/gi,'_');
  const hash=value=>{let h=0;for(const ch of String(value||''))h=(h*31+ch.charCodeAt(0))>>>0;return h;};
  const labels=['คัดกรองข้อมูลก่อนให้บริการ','ตั้งเกณฑ์ความสำเร็จของภารกิจ','ตรวจคุณภาพข้อมูลรับเข้า','จัดลำดับการให้บริการผู้ใช้','สื่อสารข้อจำกัดของระบบ','บันทึกหลักฐานการตัดสินใจ','ทดสอบกรณีข้อมูลผิดปกติ','ส่งต่อกรณีความเสี่ยงสูง','ทบทวนผลกระทบต่อผู้ใช้','ปรับกฎเมื่อบริบทเปลี่ยน','คุ้มครองสิทธิ์และความเป็นธรรม','ตรวจสอบผลลัพธ์ก่อนแจ้งผู้ใช้','กำกับการทำงานโดยผู้รับผิดชอบ','จัดการข้อมูลไม่ครบหรือคลาดเคลื่อน','เปรียบเทียบทางเลือกก่อนดำเนินการ','รับมือข้อร้องเรียนของผู้ใช้','ติดตามผลหลังระบบให้คำแนะนำ','จำกัดขอบเขตการตัดสินใจอัตโนมัติ','กำหนดทางเลือกปลอดภัยเมื่อไม่แน่ใจ','ตรวจย้อนกลับผลลัพธ์สำคัญ','ประเมินผลก่อนนำไปใช้จริง','จัดการเป้าหมายที่อาจขัดกัน','ควบคุมการเปลี่ยนแปลงของข้อมูล','สรุปเหตุผลเพื่อให้ผู้ใช้ตรวจสอบได้'];
  function history(){const all=read(key+'_'+personKey(),{});all[mid]=all[mid]||{rounds:[]};all[mid].rounds=Array.isArray(all[mid].rounds)?all[mid].rounds.slice(-WINDOW):[];return all;}
  function replaceContext(text,from,to){const source=String(text||'');return from&&source.includes(from)?source.split(from).join(to):source;}
  function baseContext(card){return tidy(card?.contextBase||card?.context||'สถานการณ์จำลอง');}
  function chooseLabel(card,index,round,blocked,inside){
    const seed=hash((card?.id||'')+'|'+(card?.kind||'')+'|'+index+'|'+round);
    for(let offset=0;offset<labels.length;offset++){
      const label=labels[(seed+round*7+offset)%labels.length],signature=baseContext(card)+' | '+label;
      if(!blocked.has(signature)&&!inside.has(signature))return {label,signature};
    }
    const label=labels[(seed+index)%labels.length]+' • จุดปฏิบัติการ '+(index+1);return {label,signature:baseContext(card)+' | '+label};
  }
  function normalize(deck,track){
    if(!deck||!Array.isArray(deck.cards)||!deck.cards.length)return deck;
    const h=history(),previous=new Set(h[mid].rounds.flatMap(row=>Array.isArray(row.signatures)?row.signatures:[])),inside=new Set();
    const round=Number(deck.round||0)||1;let changed=false;
    deck.cards.forEach((card,index)=>{
      if(card.__contextUniqueV654){inside.add(String(card.contextSignature||((baseContext(card)+' | ')+String(card.scenarioFocus||''))));return;}
      const old=tidy(card.context||''),base=baseContext(card),picked=chooseLabel(card,index,round,previous,inside),context=base+' — '+picked.label;
      card.contextBase=base;card.scenarioFocus=picked.label;card.contextSignature=picked.signature;card.context=context;card.prompt=replaceContext(card.prompt,old,context);card.__contextUniqueV654=true;inside.add(picked.signature);changed=true;
    });
    deck.contextUniqueness={version:'v6.5.4',uniqueWithinDeck:inside.size===deck.cards.length,window:WINDOW,signatureCount:inside.size};
    if(track&&changed){h[mid].rounds.push({deckId:String(deck.id||''),round,at:Date.now(),signatures:[...inside]});h[mid].rounds=h[mid].rounds.slice(-WINDOW);write(key+'_'+personKey(),h);}
    return deck;
  }
  function normalizeStored(name){const snapshot=read(name,null);if(!snapshot?.deck)return;normalize(snapshot.deck,false);write(name,snapshot);}
  function patchCore(){const api=window.AIQuestReplayFactoryV650;if(!api||api.__contextUniqueV654||typeof api.makeDeck!=='function')return false;api.__contextUniqueV654=true;const original=api.makeDeck.bind(api);api.makeDeck=function(){return normalize(original(),true)};normalizeStored(coreActive);return true;}
  function patchS2(){const api=window.AIQuestS2AgentDeckV672;if(!api||api.__contextUniqueV654||typeof api.buildDeck!=='function')return false;api.__contextUniqueV654=true;const original=api.buildDeck.bind(api);api.buildDeck=function(){return normalize(original(),true)};normalizeStored(s2Active);return true;}
  function apply(){patchCore();patchS2();}
  setInterval(apply,120);apply();
})();
