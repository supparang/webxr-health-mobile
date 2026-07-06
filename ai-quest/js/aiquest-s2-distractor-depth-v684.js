/* CSAI2102 S2 Distractor Depth v6.8.4
   Replaces obvious short distractors with realistic near-miss policies.
   The learner must distinguish the missing safeguard, evidence, scope,
   or human-review condition — not simply choose the longest text.
*/
(()=>{'use strict';
  if(window.__AIQUEST_S2_DISTRACTOR_DEPTH_V684__)return;
  const api=window.AIQuestS2AgentDeckV672;
  if(!api||typeof api.buildDeck!=='function')return;

  const clean=v=>String(v==null?'':v).replace(/\s+/g,' ').trim();
  const size=v=>clean(v).replace(/\s/g,'').length;
  const hash=t=>{let h=2166136261;for(const ch of String(t||'')){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0};
  const join=(base,tail)=>clean(base)+(clean(base).endsWith('.')?' ':' — ')+clean(tail);
  const tail=(card,index,round)=>[
    'โดยใช้ข้อมูลจากเหตุการณ์นี้ประกอบการทบทวนในรอบถัดไป',
    'พร้อมสรุปผลให้ทีมติดตามเมื่อจบกระบวนการทำงาน',
    'ภายใต้เงื่อนไขที่ระบบกำลังเผชิญในช่วงเวลานั้น',
    'และติดตามผลกระทบที่เกิดขึ้นกับผู้ใช้หลังการตัดสินใจ'
  ][hash([card.id,index,round].join('|'))%4];

  function misses(card){
    const name=clean(card.context||'ระบบนี้');
    const bank={
      'Performance measure':[
        'วัดจำนวนงานสำเร็จและเวลาตอบสนองเป็นหลัก แล้วตรวจเหตุเสี่ยงเฉพาะเมื่อมีข้อร้องเรียน',
        'ติดตามความแม่นยำโดยรวมของ '+name+' แต่ไม่แยกความผิดพลาดตามระดับผลกระทบต่อผู้ใช้',
        'ใช้ค่า confidence และ throughput เป็นตัวชี้วัดหลัก แล้วให้ทีมแก้กรณีผิดพลาดภายหลัง'
      ],
      'Rational action':[
        'ตรวจข้อมูลจากแหล่งสำรองเพิ่ม แต่คง action เดิมไว้เพื่อไม่ให้กระบวนการหยุดชะงัก',
        'ลดความเร็วของ action ชั่วคราว แล้วรอให้ระบบสรุปผลก่อนจึงปรับ policy',
        'เลือก action ที่ย้อนกลับได้เฉพาะเมื่อต้นทุนต่ำ แต่ยังให้ระบบทำ action เต็มรูปแบบ'
      ],
      'Human oversight':[
        'ตั้ง threshold ให้เจ้าหน้าที่เห็นรายการเสี่ยงหลังจบกะ โดยระบบยังทำ action ต่อระหว่างนั้น',
        'ส่งเคสให้ผู้ตรวจเมื่อโมเดลสองตัวไม่ตรงกัน แต่ไม่จำกัด action ระหว่างรอการตรวจ',
        'ให้ผู้เชี่ยวชาญอนุมัติรายงานเป็นรอบ ๆ แต่ไม่เปิดทางแก้ไขผลกระทบรายกรณี'
      ],
      'Agent concept':[
        'ทำตาม workflow ที่ตั้งเวลาไว้ และปรับรายงานหลังสิ้นวันตามค่าเฉลี่ยของข้อมูล',
        'รับข้อมูลใหม่เพื่อนำไปสรุปสถิติ แต่ยังคง action ตามกฎเดิมโดยไม่ปรับตามบริบท',
        'แจ้งข้อเสนอแนะจากข้อมูลล่าสุด แต่ไม่มี action ที่เปลี่ยนแปลงสภาพแวดล้อมจริง'
      ],
      'Sensor reliability':[
        'เลือกใช้ sensor ที่มี confidence สูงสุดเสมอ แม้ข้อมูลจากแหล่งอื่นจะขัดแย้งกัน',
        'เฉลี่ยค่าจาก sensor ทุกตัวเพื่อลดความผันผวน โดยไม่ตรวจคุณภาพของแต่ละแหล่ง',
        'ทำ action แบบลดความเร็วต่อไป แล้วค่อยตรวจความคลาดเคลื่อนของ sensor หลังจบงาน'
      ],
      'Environment':[
        'กำหนดค่า confidence และ threshold ภายในโมเดลเป็นตัวแทนของโลกภายนอกทั้งหมด',
        'ใช้ประวัติรุ่นโมเดลและพารามิเตอร์การฝึกเป็นบริบทหลักของการตัดสินใจ',
        'อ้างอิง action ที่เคยส่งออกก่อนหน้าแทนผู้ใช้ พื้นที่ และสถานการณ์จริงรอบตัว'
      ],
      'Why PEAS':[
        'เลือก algorithm ที่มีคะแนนสูงสุดก่อน แล้วค่อยนิยามผลกระทบและข้อจำกัดเมื่อใช้งานจริง',
        'เริ่มทำหน้าจอและ flow การใช้งานก่อน แล้วค่อยเลือก sensor เมื่อระบบใกล้เสร็จ',
        'สร้าง prototype จากข้อมูลที่มีอยู่ก่อน แล้วเพิ่มเป้าหมายและ action หลังเกิดปัญหา'
      ],
      'Trade-off':[
        'รวมความเร็ว ความปลอดภัย และความแม่นยำเป็นคะแนนเดียว โดยให้น้ำหนัก throughput สูงสุด',
        'แสดง dashboard ความเสี่ยงแยกต่างหาก แต่ไม่ใช้ข้อมูลนั้นเปลี่ยน action ของระบบ',
        'ใช้ค่าเฉลี่ยรายวันเพื่อลดผลของกรณีผิดพลาดรายบุคคลที่เกิดขึ้นระหว่างการทำงาน'
      ],
      'Rationality':[
        'เลือก label ที่มี probability สูงที่สุดเสมอ แม้ผลของ action ต่อผู้ใช้แตกต่างกันมาก',
        'ใช้ action ที่เคยได้คะแนนดีที่สุดจากข้อมูลเก่า แม้ percept ปัจจุบันเปลี่ยนไปแล้ว',
        'เลือก action ที่ใช้ทรัพยากรน้อยที่สุดก่อน โดยยังไม่ตรวจเป้าหมายและข้อจำกัด'
      ],
      'Audit trail':[
        'นับจำนวน override และเวลาที่เกิดเหตุ แต่ไม่บันทึกเหตุผลของผู้ตรวจหรือผลหลังการแก้ไข',
        'เก็บเฉพาะผลลัพธ์ที่ระบบทำถูก พร้อมสรุปจำนวน override เป็นรายงานประจำวัน',
        'บันทึกเหตุการณ์หลังจบกะ แต่ไม่เชื่อม trigger ผู้ตรวจ และผลของ action เข้าด้วยกัน'
      ],
      'Human override':[
        'เปิด override เมื่อระบบช้ากว่าค่าเฉลี่ย แม้กรณีนั้นมีผลกระทบต่ำต่อผู้ใช้',
        'ให้ override เมื่อคะแนนสะสมผู้ใช้เปลี่ยนไป แม้ยังไม่มีหลักฐานเรื่องความเสี่ยง',
        'ให้โมเดลสำรองยืนยันผลก่อนเสมอ แล้วจำกัดบทบาทมนุษย์ไว้เฉพาะการดูรายงาน'
      ],
      'Scope boundary':[
        'ใช้คำตอบจากเคสที่คล้ายที่สุด แม้เงื่อนไขสำคัญของสถานการณ์ใหม่แตกต่างออกไป',
        'ขยาย action ของระบบเองเพื่อครอบคลุมทุกกรณี แล้วค่อยทดสอบเมื่อเกิดผลกระทบ',
        'ตอบต่อภายในระบบเดิมเพื่อไม่ให้คิวค้าง โดยไม่แจ้งผู้ใช้ว่าเกินขอบเขตที่ออกแบบ'
      ],
      'Agent test':[
        'ทดสอบเฉพาะข้อมูลสะอาดที่โมเดลทำคะแนนสูง แล้วใช้ผลเฉลี่ยสรุปความพร้อมใช้งาน',
        'ทดสอบสถานการณ์ปกติหนึ่งรอบเพื่อลดเวลา แล้วเก็บ edge case ไว้แก้หลังเปิดใช้จริง',
        'เปิดใช้กับผู้ใช้จริงในวงกว้างก่อน แล้วใช้ complaint เป็นข้อมูลหลักของการทดสอบ'
      ],
      'Case Twist: low confidence':[
        'ลดความเร็วของ action แล้วทำงานต่อโดยไม่แจ้งระดับความไม่แน่ใจให้ผู้รับผิดชอบทราบ',
        'ขอข้อมูลเพิ่มหนึ่งครั้งแล้วตัดสินอัตโนมัติตามคะแนนใหม่ แม้ผลกระทบของเคสยังสูง',
        'ปฏิเสธทุกเคสที่ไม่แน่ใจทันที โดยไม่เสนอทางเลือกส่งต่อหรือความช่วยเหลือแก่ผู้ใช้'
      ],
      'Case Twist: user rights':[
        'แสดง confidence score เพียงตัวเดียวเพื่อความโปร่งใส แต่ไม่เปิดทางให้ทบทวนรายกรณี',
        'ให้คำอธิบายทั่วไปเกี่ยวกับโมเดล แล้วคงผลเดิมโดยไม่มีผู้รับผิดชอบตรวจข้อโต้แย้ง',
        'แจ้งว่าจะปรับปรุงระบบในอนาคต แต่ไม่ตรวจข้อมูลและผลกระทบของผู้ใช้ในครั้งนี้'
      ],
      'Case Twist: changed context':[
        'ใช้ threshold เดิมต่อไปเพราะโมเดลเคยผ่านการทดสอบ แม้บริบทของ '+name+' เปลี่ยนไป',
        'เพิ่มข้อมูลใหม่เข้าไปทันทีแล้วให้ระบบเรียนรู้เอง โดยไม่ตรวจ drift หรือ safety policy',
        'ลดการเก็บ log ชั่วคราวเพื่อลดความผันผวนของตัวชี้วัดในช่วงเปลี่ยนบริบท'
      ],
      'Case Twist: conflicting goals':[
        'รวมความเร็วและความปลอดภัยเป็นคะแนนเดียว แล้วเพิ่มน้ำหนักความเร็วในช่วงงานหนาแน่น',
        'สลับให้ความเร็วหรือความปลอดภัยชนะตามช่วงเวลา โดยไม่กำหนด constraint ที่ชัดเจน',
        'ย้ายภาระความเสี่ยงไปให้ผู้ใช้ยืนยันเองทุกครั้งเพื่อรักษา throughput ของระบบ'
      ]
    };
    return bank[card.skill]||[
      'ใช้ค่าเฉลี่ยจากข้อมูลเดิมเป็นหลัก แล้วทบทวนผลกระทบเมื่อจบกระบวนการทำงาน',
      'ปรับ action ให้เร็วขึ้นก่อน แล้วเพิ่มการตรวจสอบเมื่อพบข้อผิดพลาดภายหลัง',
      'ให้ระบบเลือกแนวทางเดิมต่อไป โดยเก็บข้อมูลไว้แก้ไขในรอบการทำงานถัดไป'
    ];
  }

  function balance(card,round){
    if(card.subtype==='map'||!card.correct)return null;
    const wrong=misses(card).map(clean);
    const correct=clean(card.correct);
    const target=Math.max(size(correct)-3,68);
    const longest=hash([card.id,card.skill,round].join('|'))%3;
    const result=wrong.map((text,index)=>{
      let out=text,goal=index===longest?Math.max(size(correct)+8,target+10):target+(hash(card.id+'|'+index)%6);
      let step=0;
      while(size(out)<goal&&step<3){out=join(out,tail(card,index,round+step));step++;}
      return out;
    });
    let maxWrong=Math.max(...result.map(size));
    if(maxWrong<=size(correct)){
      let out=result[longest];let step=0;
      while(size(out)<=size(correct)&&step<3){out=join(out,tail(card,longest,round+7+step));step++;}
      result[longest]=out;maxWrong=size(out);
    }
    card.wrong=result;
    const lengths=[size(correct),...result.map(size)],max=Math.max(...lengths);
    card.choiceParity={version:'v6.8.4',lengths,longestIndex:lengths.indexOf(max),correctIndex:0,decoyLongestIndex:longest+1,nearMiss:true};
    return {id:clean(card.id),skill:clean(card.skill),context:clean(card.context),lengths,longestIndex:lengths.indexOf(max),correctIndex:0,decoyLongestIndex:longest+1,nearMiss:true};
  }

  const original=api.buildDeck.bind(api);
  api.buildDeck=function(){
    const deck=original(),audit=[];
    (deck.cards||[]).forEach(card=>{const item=balance(card,Number(deck.round||0));if(item)audit.push(item)});
    deck.choiceParityAudit={version:'v6.8.4',cards:audit,rule:'near-miss distractors; correct option is never the longest visible option'};
    const replay=window.AIQuestS2ReplayAuditCurrent;
    if(replay&&clean(replay.deckId)===clean(deck.id)){replay.choiceParityAudit=deck.choiceParityAudit;replay.answerLengthBiasGuard='v6.8.4';}
    return deck;
  };
  window.__AIQUEST_S2_DISTRACTOR_DEPTH_V684__=true;
  console.log('[AIQuest] S2 nuanced distractors v6.8.4 ready');
})();