/* CSAI2102 S2 Choice Authorship Guard v6.8.5
   Final anti-pattern layer, installed AFTER all deck decorators.
   Uses compact authored answer sets with balanced visible lengths.
   Correct choices are never systematically the longest, shortest, or most detailed.
*/
(()=>{'use strict';
  if(window.__AIQUEST_S2_CHOICE_AUTHORSHIP_V685__)return;

  const clean=v=>String(v==null?'':v).replace(/\s+/g,' ').trim();
  const chars=v=>clean(v).replace(/\s/g,'').length;
  const hash=t=>{let h=2166136261;for(const ch of String(t||'')){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0};
  const core={
    'Performance measure':{
      correct:'วัดผลสำเร็จ ความปลอดภัย และผลกระทบต่อผู้ใช้',
      wrong:['วัดปริมาณงานและเวลาตอบสนอง แล้วตรวจความเสี่ยงภายหลัง','วัดค่า confidence เฉลี่ยโดยไม่ตรวจผลต่อผู้ใช้','วัดคะแนนรวมโดยไม่แยกความผิดพลาดรายกรณี']
    },
    'Rational action':{
      correct:'ตรวจข้อมูลข้ามแหล่ง แล้วจำกัด action ที่เสี่ยง',
      wrong:['ใช้ข้อมูลที่มั่นใจสุด แล้วทำ action ต่อทันที','ลดความเร็วของ action แต่คงนโยบายเดิมไว้','เลือก action ที่รักษา throughput ของรอบนี้']
    },
    'Human oversight':{
      correct:'จำกัด action แล้วส่งเหตุผลให้ผู้ตรวจตัดสิน',
      wrong:['ส่งรายชื่อเคสเสี่ยงให้ดูหลังจบกะการทำงาน','ให้โมเดลสำรองยืนยันผลก่อนค่อยทำ action','ให้ผู้เชี่ยวชาญอนุมัติรายงานเป็นรอบเวลา']
    },
    'Agent concept':{
      correct:'รับ percept แล้วเลือก action ตามเป้าหมายและข้อจำกัด',
      wrong:['ทำตาม workflow ที่ตั้งเวลาไว้โดยไม่ปรับตามบริบท','รับข้อมูลใหม่เพื่อสรุปสถิติ แต่คง action เดิม','แสดงคำแนะนำจากข้อมูลล่าสุดโดยไม่ทำ action']
    },
    'Sensor reliability':{
      correct:'เทียบคุณภาพข้อมูล แล้วใช้ safe fallback เมื่อขัดกัน',
      wrong:['เลือก sensor ที่มี confidence สูงสุดเสมอ','เฉลี่ยค่าจากทุก sensor โดยไม่ดูคุณภาพ','ทำ action ต่อ แล้วตรวจ sensor หลังจบงาน']
    },
    'Environment':{
      correct:'ผู้ใช้ พื้นที่ สิ่งกีดขวาง และกฎจริงรอบระบบ',
      wrong:['ค่า confidence และ threshold ภายในโมเดล','พารามิเตอร์ฝึกและประวัติรุ่นของโมเดล','action ที่ระบบเคยส่งออกในรอบก่อนหน้า']
    },
    'Why PEAS':{
      correct:'กำหนดเป้าหมาย โลก ข้อมูลเข้า และ action ให้ชัด',
      wrong:['เลือก algorithm ที่คะแนนสูงสุดก่อนกำหนดผลกระทบ','ออกแบบหน้าจอก่อน แล้วค่อยกำหนด sensor','สร้าง prototype ก่อน แล้วเพิ่มข้อจำกัดภายหลัง']
    },
    'Trade-off':{
      correct:'ตั้ง safety constraint ก่อน optimize ความเร็ว',
      wrong:['รวมความเร็วและความปลอดภัยเป็นคะแนนเดียว','แสดง dashboard ความเสี่ยงแต่ไม่เปลี่ยน action','ใช้ค่าเฉลี่ยรายวันลดผลของความผิดพลาด']
    },
    'Rationality':{
      correct:'เลือก action ตาม percept เป้าหมาย และความเสี่ยง',
      wrong:['เลือก label ที่ probability สูงสุดเสมอ','ใช้ action ที่เคยได้คะแนนดีจากข้อมูลเก่า','เลือก action ที่ใช้ทรัพยากรน้อยที่สุดก่อน']
    },
    'Audit trail':{
      correct:'บันทึก trigger ผู้ตรวจ เหตุผล และผลหลัง override',
      wrong:['นับ override และเวลาที่ใช้แก้ไขในแต่ละเหตุการณ์','เก็บผลสุดท้ายโดยไม่แยกเหตุผลของ action','สรุปเหตุการณ์รายวันโดยไม่เชื่อมผู้ตรวจ']
    },
    'Human override':{
      correct:'ส่งต่อเมื่อเสี่ยงสูง ข้อมูลไม่แน่ใจ หรือเกิน scope',
      wrong:['เปิด override เมื่อระบบช้ากว่าค่าเฉลี่ย','เปิด override เมื่อคะแนนผู้ใช้เปลี่ยนไป','ให้โมเดลสำรองยืนยันผลแทนมนุษย์']
    },
    'Scope boundary':{
      correct:'จำกัด action และส่งต่อเมื่อเคสเกินขอบเขต',
      wrong:['ใช้คำตอบของเคสคล้ายกันแทนสถานการณ์ใหม่','ขยาย action เองเพื่อครอบคลุมทุกกรณี','ตอบต่อโดยไม่แจ้งว่าเคสเกินขอบเขต']
    },
    'Agent test':{
      correct:'ทดสอบเคสปกติ เคสขัดแย้ง และการ override',
      wrong:['ทดสอบเฉพาะข้อมูลสะอาดที่โมเดลทำได้ดี','ทดสอบสถานการณ์ปกติหนึ่งรอบก่อนใช้งาน','เปิดใช้จริงแล้วเก็บ complaint เป็นชุดทดสอบ']
    },
    'Case Twist: low confidence':{
      correct:'จำกัด action แจ้งความไม่แน่ใจ และส่งต่อเมื่อเสี่ยง',
      wrong:['ลดความเร็วแล้วทำงานต่อโดยไม่แจ้งผู้รับผิดชอบ','ขอข้อมูลเพิ่มครั้งเดียวแล้วตัดสินอัตโนมัติ','ปฏิเสธทุกเคสที่ไม่แน่ใจโดยไม่ส่งต่อ']
    },
    'Case Twist: user rights':{
      correct:'อธิบายข้อจำกัด แล้วเปิดช่องให้ทบทวนรายกรณี',
      wrong:['แสดง confidence score เพียงตัวเดียวให้ผู้ใช้','อธิบายภาพรวมแต่ไม่เปิดทางให้ทบทวน','บอกว่าจะปรับโมเดลในอนาคตโดยไม่ตรวจเคส']
    },
    'Case Twist: changed context':{
      correct:'ตรวจ drift และปรับ safety policy ก่อนขยายการใช้',
      wrong:['ใช้ threshold เดิมเพราะโมเดลเคยผ่านทดสอบ','เพิ่มข้อมูลใหม่แล้วให้ระบบเรียนรู้เองทันที','ลดการเก็บ log เพื่อลดความผันผวนของผล']
    },
    'Case Twist: conflicting goals':{
      correct:'กำหนดความปลอดภัยเป็น constraint ก่อนความเร็ว',
      wrong:['รวมความเร็วและความปลอดภัยเป็นคะแนนเดียว','สลับนโยบายตามช่วงเวลาที่งานหนาแน่น','ให้ผู้ใช้รับความเสี่ยงเพื่อรักษา throughput']
    }
  };
  const generic={
    correct:'ตรวจหลักฐาน ผลกระทบ และข้อจำกัดก่อนเลือก action',
    wrong:['ใช้ผลเฉลี่ยจากข้อมูลเดิมเป็นหลัก','ทำ action ต่อแล้วทบทวนเมื่อจบงาน','เลือกทางที่เร็วที่สุดเพื่อลดเวลารอ']
  };

  function lengthAudit(spec){
    const texts=[spec.correct,...spec.wrong];
    const lengths=texts.map(chars);
    const correctRank=[...lengths].sort((a,b)=>a-b).indexOf(lengths[0])+1;
    return {lengths,correctRank,longestIndex:lengths.indexOf(Math.max(...lengths)),shortestIndex:lengths.indexOf(Math.min(...lengths))};
  }
  function applyCard(card,round){
    if(card.subtype==='map'||!card.correct)return null;
    const source=core[clean(card.skill)]||generic;
    const spec={correct:clean(source.correct),wrong:source.wrong.map(clean)};
    const seed=hash([card.id,card.context,card.skill,round].join('|'));
    /* rotate the three near-miss wordings; card engine independently shuffles all four positions */
    const shift=seed%3;
    spec.wrong=[...spec.wrong.slice(shift),...spec.wrong.slice(0,shift)];
    card.correct=spec.correct;
    card.wrong=spec.wrong;
    card.choiceAuthorship={version:'v6.8.5',balanced:true,...lengthAudit(spec)};
    return {id:clean(card.id),skill:clean(card.skill),context:clean(card.context),...card.choiceAuthorship};
  }
  function install(){
    const api=window.AIQuestS2AgentDeckV672;
    const allReady=window.__AIQUEST_S2_ANSWER_ROTATION_V677__&&window.__AIQUEST_S2_MAP_ORDER_V682__&&window.__AIQUEST_S2_CHOICE_PARITY_V683__&&window.__AIQUEST_S2_DISTRACTOR_DEPTH_V684__;
    if(!api||!allReady||api.__choiceAuthorshipV685||typeof api.buildDeck!=='function')return false;
    api.__choiceAuthorshipV685=true;
    const original=api.buildDeck.bind(api);
    api.buildDeck=function(){
      const deck=original(),audit=[];
      (deck.cards||[]).forEach(card=>{const row=applyCard(card,Number(deck.round||0));if(row)audit.push(row)});
      deck.choiceAuthorshipAudit={version:'v6.8.5',cards:audit,rule:'authored near-miss options; correct is neither systematically longest nor shortest'};
      const replay=window.AIQuestS2ReplayAuditCurrent;
      if(replay&&clean(replay.deckId)===clean(deck.id)){replay.choiceAuthorshipAudit=deck.choiceAuthorshipAudit;replay.answerLengthBiasGuard='v6.8.5';}
      return deck;
    };
    window.__AIQUEST_S2_CHOICE_AUTHORSHIP_V685__=true;
    return true;
  }
  const timer=setInterval(()=>{if(install())clearInterval(timer)},40);
  install();
})();