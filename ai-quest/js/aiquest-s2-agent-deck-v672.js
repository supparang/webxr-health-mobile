/* CSAI2102 AI Quest — S2 Agent Builder Replay Deck v6.7.2 */
(()=>{'use strict';
  const MID='s2';
  const KEY='CSAI2102_S2_AGENT_BUILDER_REPLAY_V672';
  const WINDOW=4;
  const contexts=[
    {id:'delivery',title:'หุ่นยนต์ส่งเอกสาร',p:'ส่งเอกสารถูกคน ปลอดภัย และตรงเวลา',e:'ทางเดินอาคาร คนเดิน ประตู และลิฟต์',s:'กล้อง ระยะห่าง และเครื่องอ่านบัตร',a:'เคลื่อนที่ หยุด และแจ้งเตือน',risk:'มีคนตัดหน้ากะทันหัน'},
    {id:'library',title:'รถเข็นหนังสืออัจฉริยะ',p:'ส่งหนังสือถูกชั้นโดยไม่ชนผู้ใช้',e:'ชั้นหนังสือ ทางเดิน ผู้ใช้ และจุดรับคืน',s:'กล้อง แผนที่ และเครื่องอ่าน RFID',a:'ขับ เลี้ยว หยุด และส่งสัญญาณเสียง',risk:'ทางเดินแคบและมีเด็กวิ่งผ่าน'},
    {id:'shuttle',title:'รถรับส่งมหาวิทยาลัย',p:'รับส่งผู้โดยสารอย่างปลอดภัย ตรงเวลา และไม่เกินความจุ',e:'ถนน ป้ายหยุด คนเดิน รถคันอื่น และสภาพอากาศ',s:'กล้อง GPS เรดาร์ และเซนเซอร์ประตู',a:'พวงมาลัย เบรก คันเร่ง และจอแจ้งเตือน',risk:'กล้องมองป้ายหยุดไม่ชัดในฝนตก'},
    {id:'waste',title:'ระบบคัดแยกขยะ',p:'แยกขยะถูกประเภท ลดขยะปน และทำงานปลอดภัย',e:'สายพาน ขวด กระป๋อง เศษอาหาร และคนดูแล',s:'กล้อง น้ำหนัก และเซนเซอร์โลหะ',a:'แขนกล คีมคีบ และสายพาน',risk:'ภาพวัตถุใหม่ไม่ชัดและระบบมั่นใจต่ำ'},
    {id:'clinic',title:'ระบบจัดคิวคลินิก',p:'จัดคิวเป็นธรรม ลดเวลารอ และส่งต่อเคสเร่งด่วนถูกต้อง',e:'ผู้ป่วย เจ้าหน้าที่ ห้องตรวจ และเวลานัด',s:'แบบฟอร์มลงทะเบียน เวลาเข้า และข้อมูลอาการเบื้องต้น',a:'เรียกคิว ส่งแจ้งเตือน และเสนอการส่งต่อเจ้าหน้าที่',risk:'ผู้ป่วยระบุอาการคลุมเครือแต่ต้องการคิวด่วน'},
    {id:'access',title:'ระบบผ่านประตูอาคาร',p:'อนุญาตเฉพาะผู้มีสิทธิ์ โดยไม่กีดกันผู้ใช้ผิดพลาด',e:'ประตู ผู้ใช้ บัตรผ่าน ผู้มาติดต่อ และเจ้าหน้าที่',s:'เครื่องอ่านบัตร กล้อง และเซนเซอร์ประตู',a:'ปลดล็อก ล็อก แจ้งเตือน และเรียกเจ้าหน้าที่',risk:'บัตรหมดอายุแต่ผู้ใช้แจ้งว่าเป็นกรณีฉุกเฉิน'}
  ];
  const shuffle=a=>{const x=[...(a||[])];for(let i=x.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[x[i],x[j]]=[x[j],x[i]]}return x};
  const clone=v=>JSON.parse(JSON.stringify(v));
  const profileId=()=>{try{return String((window.AIQuestStorage?.getProfile?.()||{}).studentId||'guest').replace(/[^a-z0-9_-]/gi,'_')}catch(e){return'guest'}};
  const load=()=>{try{return JSON.parse(localStorage.getItem(KEY+'_'+profileId())||'{}')}catch(e){return{}}};
  const save=data=>{try{localStorage.setItem(KEY+'_'+profileId(),JSON.stringify(data))}catch(e){}};
  const choice=(id,skill,prompt,correct,wrong,explain,ctx,kind='m')=>({id,kind,subtype:'choice',skill,context:ctx.title,prompt,correct,wrong,explain});
  const map=(id,skill,prompt,labels,cards,explain,ctx)=>({id,kind:'m',subtype:'map',skill,context:ctx.title,prompt,labels,cards,explain});

  function mechanics(ctx){
    return [
      map('m_peas_'+ctx.id,'PEAS ครบองค์ประกอบ','จัดวางข้อมูลของ '+ctx.title+' ลงใน PEAS ให้ครบ 4 ส่วน',
        ['P • Performance','E • Environment','A • Actuator','S • Sensor'],[
          {text:ctx.p,answer:'P • Performance'},
          {text:ctx.e,answer:'E • Environment'},
          {text:ctx.a,answer:'A • Actuator'},
          {text:ctx.s,answer:'S • Sensor'}
        ],'PEAS ช่วยกำหนดความสำเร็จ โลกที่ระบบทำงาน สิ่งที่ระบบทำได้ และข้อมูลที่ระบบรับรู้',ctx),
      map('m_sa_'+ctx.id,'Sensor / Actuator','แยกสิ่งที่ '+ctx.title+' ใช้รับรู้ กับสิ่งที่ใช้กระทำต่อโลกจริง',
        ['Sensor','Actuator'],[
          {text:ctx.s.split(' และ ')[0],answer:'Sensor'},
          {text:ctx.a.split(' และ ')[0],answer:'Actuator'},
          {text:'ข้อมูลตำแหน่งหรือภาพจากสภาพแวดล้อม',answer:'Sensor'},
          {text:'คำสั่งที่ทำให้ระบบเคลื่อนที่ หยุด หรือแจ้งเตือน',answer:'Actuator'}
        ],'Sensor รับข้อมูลเข้า ส่วน Actuator ส่งผลออกไปยังสภาพแวดล้อม',ctx),
      choice('m_goal_'+ctx.id,'Performance measure','ข้อใดเป็นเกณฑ์วัดผลที่เหมาะสมที่สุดของ '+ctx.title,ctx.p,['ใช้หน้าจอสีสวยที่สุด','มีจำนวนเซนเซอร์มากที่สุด','เปิดระบบให้นานที่สุด'],'Performance measure ต้องสะท้อนว่าภารกิจสำเร็จอย่างไร รวมทั้งคุณภาพ ความปลอดภัย หรือความเป็นธรรม',ctx),
      choice('m_rational_'+ctx.id,'Rational action','ระหว่างปฏิบัติงาน '+ctx.title+' พบว่า '+ctx.risk+' ตัวแทนที่มีเหตุผลควรทำอะไร','ใช้ข้อมูลที่มี ลดความเสี่ยง และเลือกการกระทำที่ปลอดภัย เช่น ชะลอหรือขอข้อมูลเพิ่ม',['ทำงานต่อด้วยความเร็วเดิมแม้ข้อมูลไม่พอ','สุ่มเลือกการกระทำเพื่อให้จบเร็ว','ซ่อนความไม่แน่ใจจากผู้ใช้'],'ตัวแทนเชิงเหตุผลไม่ใช่ตัวแทนที่ไม่เคยผิด แต่เลือกสิ่งเหมาะสมที่สุดจากข้อมูลและเป้าหมายที่มี',ctx),
      choice('m_oversight_'+ctx.id,'Human oversight','กรณี '+ctx.risk+' การออกแบบใดรับผิดชอบที่สุด','กำหนดเงื่อนไขส่งต่อมนุษย์หรือหยุดอย่างปลอดภัยเมื่อความมั่นใจต่ำหรือผลกระทบสูง',['ให้ระบบตัดสินเองทุกกรณีเพื่อความรวดเร็ว','ลบ log เพื่อไม่ให้ผู้ใช้โต้แย้ง','ใช้คะแนนความมั่นใจแทนการตรวจทานทั้งหมด'],'เมื่อความปลอดภัยหรือสิทธิ์ของผู้ใช้ได้รับผลกระทบ ควรมี human override และ audit trail',ctx)
    ];
  }

  const qTemplates=[
    (ctx)=>choice('q_agent_'+ctx.id,'Agent concept','เหตุใด '+ctx.title+' จึงเรียกว่า intelligent agent ได้','เพราะรับรู้สภาพแวดล้อมและเลือกการกระทำเพื่อบรรลุเป้าหมาย',['เพราะมีหน้าจออัตโนมัติ','เพราะใช้ไฟฟ้า','เพราะมีข้อมูลจำนวนมาก'],'Agent เชื่อมโยง perception กับ action โดยมีเป้าหมายหรือเกณฑ์วัดผล',ctx,'q'),
    (ctx)=>choice('q_sensor_'+ctx.id,'Sensor reliability','ถ้า '+ctx.title+' ได้ข้อมูลจาก '+ctx.s+' ที่คลาดเคลื่อน ความเสี่ยงหลักคืออะไร','ตัวแทนอาจเลือกการกระทำจาก percept ที่ผิด จึงควรตรวจคุณภาพข้อมูลและมีทางปลอดภัย',['ระบบจะแม่นยำขึ้นเสมอ','Actuator จะกลายเป็น sensor','ไม่เกี่ยวกับการตัดสินใจ'],'คุณภาพของ percept มีผลโดยตรงต่อ action ที่เลือก',ctx,'q'),
    (ctx)=>choice('q_env_'+ctx.id,'Environment','ข้อใดอธิบาย Environment ของ '+ctx.title+' ได้ถูกต้องที่สุด',ctx.e,['เฉพาะคะแนนสุดท้าย','เฉพาะชื่อโมเดล','เฉพาะปุ่มเริ่มเกม'],'Environment คือสิ่งภายนอกที่ agent ต้องรับรู้และรับมือ ไม่ใช่คะแนนหรือชื่อระบบ',ctx,'q'),
    (ctx)=>choice('q_peas_'+ctx.id,'Why PEAS','ก่อนพัฒนา '+ctx.title+' เหตุใดต้องเขียน PEAS','เพื่อทำให้เป้าหมาย สภาพแวดล้อม การรับรู้ และการกระทำชัดเจนก่อนสร้างระบบ',['เพื่อไม่ต้องทดลองระบบ','เพื่อเลือกสีของแอป','เพื่อให้ใช้มนุษย์น้อยที่สุด'],'PEAS ลดความกำกวมของความต้องการและช่วยตรวจความครบของการออกแบบ',ctx,'q'),
    (ctx)=>choice('q_tradeoff_'+ctx.id,'Trade-off','ถ้า '+ctx.title+' ทำงานเร็วขึ้นแต่เพิ่มความเสี่ยงต่อผู้ใช้ ควรปรับ Performance measure อย่างไร','เพิ่มเกณฑ์ความปลอดภัยและผลกระทบต่อผู้ใช้ ไม่วัดความเร็วอย่างเดียว',['วัดแค่จำนวนงานต่อชั่วโมง','ตัดความปลอดภัยออกเพื่อให้คะแนนสูง','ใช้สีหน้าจอเป็นเกณฑ์'],'เกณฑ์วัดผลที่แคบอาจผลักระบบไปสู่พฤติกรรมไม่พึงประสงค์',ctx,'q'),
    (ctx)=>choice('q_rational_'+ctx.id,'Rationality','คำว่า rational agent หมายความว่าอะไร','ตัวแทนเลือก action ที่เหมาะสมจาก percept เป้าหมาย และข้อมูลที่มี ไม่ใช่เดาสุ่ม',['ตัวแทนที่ถูกทุกครั้ง','ตัวแทนที่ทำงานเร็วที่สุดเสมอ','ตัวแทนที่ไม่ต้องใช้ sensor'],'ความมีเหตุผลอยู่ที่กระบวนการเลือก action ภายใต้ข้อมูลที่มีและความไม่แน่นอน',ctx,'q'),
    (ctx)=>choice('q_log_'+ctx.id,'Audit trail','เหตุใด '+ctx.title+' ควรบันทึก percept การตัดสินใจ และ action','เพื่อให้ตรวจสอบย้อนหลัง แก้ข้อผิดพลาด และรับผิดชอบต่อผลกระทบได้',['เพื่อทำให้ระบบใช้ข้อมูลมากที่สุด','เพื่อซ่อนเหตุผลจากผู้ใช้','เพื่อไม่ให้มีมนุษย์เกี่ยวข้อง'],'Audit trail สำคัญต่อความปลอดภัย ความโปร่งใส และการพัฒนาระบบ',ctx,'q'),
    (ctx)=>choice('q_override_'+ctx.id,'Human override','เมื่อใดควรให้มนุษย์มีสิทธิ์ override '+ctx.title,'เมื่อสถานการณ์มีความเสี่ยงสูง ข้อมูลไม่แน่ใจ หรือผลลัพธ์กระทบสิทธิ์และความปลอดภัย',['เมื่อระบบทำงานตามปกติทุกครั้ง','เฉพาะตอนคะแนนต่ำ','เมื่อสีหน้าจอเปลี่ยน'],'Human override เป็นการกำกับความเสี่ยง ไม่ใช่การยกเลิกประโยชน์ของ AI',ctx,'q'),
    (ctx)=>choice('q_scope_'+ctx.id,'Scope boundary','ข้อใดเป็นการกำหนดขอบเขตที่ดีของ '+ctx.title,'ระบุสิ่งที่ระบบทำได้ สิ่งที่ไม่ควรตัดสินเอง และจุดที่ต้องส่งต่อผู้รับผิดชอบ',['ให้ระบบตอบทุกเรื่องแม้ไม่มีข้อมูล','ซ่อนข้อจำกัดเพื่อให้ผู้ใช้เชื่อ','ให้ระบบเรียนรู้จากผลลัพธ์โดยไม่ต้องตรวจ'],'ขอบเขตที่ชัดทำให้ผู้ใช้ไม่เข้าใจความสามารถของระบบเกินจริง',ctx,'q'),
    (ctx)=>choice('q_test_'+ctx.id,'Agent test','ก่อนเปิดใช้ '+ctx.title+' กับผู้ใช้จริง ควรทดสอบอะไร','ทดสอบสถานการณ์ปกติ ผิดปกติ ข้อมูลคลาดเคลื่อน และการหยุดอย่างปลอดภัย',['ทดสอบเฉพาะกรณีที่ง่ายที่สุด','ดูคะแนน demo อย่างเดียว','ทดสอบหลังเกิดเหตุจริง'],'การทดสอบต้องครอบคลุม edge cases และความล้มเหลวที่คาดได้',ctx,'q')
  ];

  const twistTemplates=[
    (ctx)=>choice('t_lowconfidence_'+ctx.id,'Case Twist: low confidence','⚡ '+ctx.title+' ให้ผลลัพธ์มั่นใจต่ำในสถานการณ์: '+ctx.risk+' แนวทางใดเหมาะสมที่สุด','แจ้งความไม่แน่ใจ เก็บหลักฐานที่เกี่ยวข้อง และส่งต่อมนุษย์เมื่อผลกระทบสูง',['แสดงผลเดิมแบบมั่นใจ 100%','ลบข้อมูลที่ระบบไม่เข้าใจ','ให้ระบบเลือกแบบสุ่ม'],'การจัดการความไม่แน่ใจอย่างโปร่งใสป้องกันการใช้ AI เกินขอบเขต',ctx,'twist'),
    (ctx)=>choice('t_rights_'+ctx.id,'Case Twist: user rights','⚡ ผู้ใช้ได้รับผลกระทบจากการตัดสินใจของ '+ctx.title+' และขอทราบเหตุผล ระบบควรตอบอย่างไร','อธิบายข้อมูลหรือกฎที่ใช้ ข้อจำกัด และช่องทางขอทบทวน',['บอกว่าเป็นความลับของ AI','ยืนยันผลโดยไม่อธิบาย','ปิดช่องทางติดต่อเพื่อให้เร็วขึ้น'],'ผลกระทบสูงต้องมีคำอธิบายและทางเยียวยาหรืออุทธรณ์',ctx,'twist'),
    (ctx)=>choice('t_drift_'+ctx.id,'Case Twist: changed context','⚡ สภาพแวดล้อมของ '+ctx.title+' เปลี่ยนไปจากตอนออกแบบ เช่น มีผู้ใช้กลุ่มใหม่หรืออุปสรรคใหม่ ควรทำอะไร','ประเมินผลใหม่ ปรับการรับรู้หรือกฎความปลอดภัย และติดตามผลหลังเปลี่ยนแปลง',['ใช้ผลเดิมโดยไม่ตรวจ','ปิด log เพื่อไม่เห็นปัญหา','เพิ่มความเร็วเป็นเกณฑ์เดียว'],'Agent ต้องได้รับการประเมินเมื่อ environment เปลี่ยนไป',ctx,'twist'),
    (ctx)=>choice('t_conflict_'+ctx.id,'Case Twist: conflicting goals','⚡ '+ctx.title+' ต้องเลือกระหว่างความเร็วกับความปลอดภัย ควรออกแบบอย่างไร','กำหนดเกณฑ์ความปลอดภัยเป็นข้อจำกัดหลัก และบันทึก trade-off ให้ตรวจสอบได้',['ให้ความเร็วชนะเสมอ','สุ่มเลือกตามเวลา','ซ่อน trade-off จากผู้ใช้'],'ความปลอดภัยและสิทธิ์ไม่ควรถูกลดเหลือเพียงคะแนนรอง',ctx,'twist')
  ];

  function noRepeatPick(pool,used,count){
    const fresh=shuffle(pool.filter(x=>!used.has(x.id)));
    const fallback=shuffle(pool.filter(x=>!fresh.some(y=>y.id===x.id)));
    return [...fresh,...fallback].slice(0,count);
  }
  function buildDeck(){
    const h=load();h[MID]=h[MID]||{rounds:[]};
    const prior=h[MID].rounds.slice(-WINDOW);
    const used=new Set(prior.flatMap(round=>round.ids||[]));
    const round=(prior.length?Math.max(...prior.map(r=>Number(r.round)||0)):0)+1;
    const mechanicsPool=[];contexts.forEach(ctx=>mechanics(ctx).forEach(task=>mechanicsPool.push(task)));
    const knowledgePool=[];contexts.forEach(ctx=>qTemplates.forEach(make=>knowledgePool.push(make(ctx))));
    const twistPool=[];contexts.forEach(ctx=>twistTemplates.forEach(make=>twistPool.push(make(ctx))));
    const mechanicBySkill=['PEAS ครบองค์ประกอบ','Sensor / Actuator','Performance measure','Rational action','Human oversight'];
    const mechanicCards=mechanicBySkill.map(skill=>{
      const pool=mechanicsPool.filter(card=>card.skill===skill&&!used.has(card.id));
      return shuffle(pool.length?pool:mechanicsPool.filter(card=>card.skill===skill))[0];
    }).filter(Boolean).map(card=>clone(card));
    mechanicCards.forEach(card=>used.add(card.id));
    const knowledgeCards=noRepeatPick(knowledgePool,used,8).map(card=>clone(card));knowledgeCards.forEach(card=>used.add(card.id));
    const twistCards=noRepeatPick(twistPool,used,2).map(card=>clone(card));
    mechanicCards.forEach(card=>{card.phase='Phase 1 • Agent Builder';card.kind='m'});
    knowledgeCards.forEach(card=>{card.phase='Phase 2 • วิเคราะห์ Agent';card.kind='q'});
    twistCards.forEach(card=>{card.phase='Phase 3 • Case Twist';card.kind='twist'});
    const cards=[...shuffle(mechanicCards),...shuffle(knowledgeCards),...shuffle(twistCards)];
    const deck={id:'s2deck_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8),round,cards,structure:{total:15,mechanic:5,knowledge:8,twist:2},usedWindow:WINDOW,poolSize:{mechanic:mechanicsPool.length,knowledge:knowledgePool.length,twist:twistPool.length}};
    h[MID].rounds.push({round,at:Date.now(),deckId:deck.id,ids:cards.map(card=>card.id)});h[MID].rounds=h[MID].rounds.slice(-WINDOW);save(h);
    return deck;
  }
  window.AIQuestS2AgentDeckV672={buildDeck,contexts,window:WINDOW,version:'v6.7.2'};
})();