/* CSAI2102 S2 Choice Parity v6.8.3
   Anti-length-bias layer for every non-map S2 decision card.
   - keeps all four options substantively plausible
   - expands short distractors with policy-relevant consequences
   - ensures a distractor, not the correct option, is the longest visible choice
   - records visible-length audit for the generated deck
*/
(()=>{'use strict';
  if(window.__AIQUEST_S2_CHOICE_PARITY_V683__)return;
  const api=window.AIQuestS2AgentDeckV672;
  if(!api||typeof api.buildDeck!=='function')return;

  const clean=value=>String(value==null?'':value).replace(/\s+/g,' ').trim();
  const visible=value=>clean(value).replace(/\s/g,'').length;
  const hash=text=>{let h=2166136261;for(const ch of String(text||'')){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0};
  const pick=(items,seed)=>items[Math.abs(seed)%items.length];
  const join=(base,tail)=>clean(base)+(clean(base).endsWith('.')?' ':' — ')+clean(tail);

  function contextualTail(card,index,round){
    const seed=hash([card.id,card.context,card.skill,index,round].join('|'));
    const safety=[
      'โดยให้ทีมติดตามผลจากเหตุการณ์นี้ในรอบถัดไป',
      'พร้อมสรุปข้อมูลจากกรณีนี้เพื่อใช้ทบทวนภายหลัง',
      'ภายใต้ข้อจำกัดของบริบทและข้อมูลที่มีในขณะนั้น',
      'แล้วประเมินผลกระทบต่อผู้ใช้หลังการตัดสินใจ',
      'โดยใช้เป็นแนวทางประกอบการทำงานในรอบปัจจุบัน'
    ];
    const audit=[
      'พร้อมเก็บหลักฐานที่จำเป็นไว้ตรวจสอบภายหลัง',
      'และสรุปผลเป็นข้อมูลประกอบการปรับนโยบายครั้งต่อไป',
      'โดยติดตามผลลัพธ์ที่เกิดขึ้นจาก action ในกรณีนี้',
      'แล้วให้ผู้เกี่ยวข้องทบทวนข้อมูลเมื่อสิ้นสุดรอบงาน',
      'เพื่อใช้เปรียบเทียบผลการทำงานกับกรณีอื่นในอนาคต'
    ];
    const rights=[
      'โดยคำนึงถึงผลกระทบที่อาจเกิดขึ้นกับผู้ใช้แต่ละกลุ่ม',
      'พร้อมแจ้งข้อมูลที่จำเป็นแก่ผู้รับผิดชอบในเหตุการณ์นี้',
      'และติดตามว่าการตัดสินใจส่งผลต่อบริการอย่างไร',
      'ภายใต้เงื่อนไขและข้อจำกัดที่ทีมกำหนดไว้ก่อนเริ่มงาน',
      'เพื่อให้มีข้อมูลเพียงพอสำหรับทบทวนในขั้นตอนถัดไป'
    ];
    const skill=String(card.skill||'').toLowerCase();
    const pool=skill.includes('audit')||skill.includes('override')?audit:(skill.includes('right')||skill.includes('oversight')?rights:safety);
    return pick(pool,seed);
  }

  function parity(card,round){
    if(card.subtype==='map'||!card.correct||!Array.isArray(card.wrong)||card.wrong.length<3)return null;
    const raw=[clean(card.correct),...card.wrong.slice(0,3).map(clean)];
    const correctLength=visible(raw[0]);
    const seed=hash([card.id,card.context,card.skill,round].join('|'));
    const decoyLongest=1+(seed%3);
    const targetFloor=Math.max(62,correctLength-4);
    const targetLong=Math.max(correctLength+7,targetFloor+9);

    const expanded=raw.map((text,index)=>{
      if(index===0)return text;
      let out=text;
      const goal=index===decoyLongest?targetLong:targetFloor+(hash(card.id+'|'+index)%5);
      let cycles=0;
      while(visible(out)<goal&&cycles<4){out=join(out,contextualTail(card,index,round+cycles));cycles++;}
      return out;
    });

    /* In the rare case the original correct text remains much longer,
       keep expanding all distractors until at least one is visibly longer. */
    const maxWrong=Math.max(...expanded.slice(1).map(visible));
    if(maxWrong<=visible(expanded[0])){
      let out=expanded[decoyLongest];let cycles=0;
      while(visible(out)<=visible(expanded[0])&&cycles<4){out=join(out,contextualTail(card,decoyLongest,round+5+cycles));cycles++;}
      expanded[decoyLongest]=out;
    }

    card.correct=expanded[0];
    card.wrong=expanded.slice(1);
    const lengths=expanded.map(visible);
    const longest=Math.max(...lengths);
    card.choiceParity={version:'v6.8.3',lengths,longestIndex:lengths.indexOf(longest),correctIndex:0,decoyLongestIndex:decoyLongest};
    return {id:clean(card.id),skill:clean(card.skill),context:clean(card.context),lengths,longestIndex:lengths.indexOf(longest),correctIndex:0,decoyLongestIndex:decoyLongest};
  }

  const original=api.buildDeck.bind(api);
  api.buildDeck=function(){
    const deck=original();
    const audit=[];
    (deck.cards||[]).forEach(card=>{const record=parity(card,Number(deck.round||0));if(record)audit.push(record)});
    deck.choiceParityAudit={version:'v6.8.3',cards:audit,rule:'correct option must not be the longest visible option'};
    const replay=window.AIQuestS2ReplayAuditCurrent;
    if(replay&&clean(replay.deckId)===clean(deck.id)){
      replay.choiceParityAudit=deck.choiceParityAudit;
      replay.answerLengthBiasGuard='v6.8.3';
    }
    return deck;
  };

  window.__AIQUEST_S2_CHOICE_PARITY_V683__=true;
  console.log('[AIQuest] S2 choice parity v6.8.3 ready');
})();