/* CSAI2102 AI Quest — S2 Semantic Deck Factory v7.0.1
   Synchronous builder: no polling, no observers, no decorators.
   Every deck has 15 distinct contexts/concepts/sources/prompt patterns and
   a balanced 4/3/3/3 answer-slot plan for its 13 choice cards.
*/
(()=>{'use strict';
  if(window.__AIQUEST_S2_SEMANTIC_DECK_V701__)return;
  window.__AIQUEST_S2_SEMANTIC_DECK_V701__=true;
  const api=window.AIQuestS2AgentDeckV672;
  if(!api)return;
  const HISTORY='CSAI2102_S2_SEMANTIC_HISTORY_V701';
  const policies=['verify','reversible','threshold','rights','audit','scope'];
  const contexts=[
    ['mail','ศูนย์คัดกรองอีเมลภาควิชา','อีเมลสำคัญรูปแบบใหม่ถูกจัดเป็นสแปม'],
    ['clinic','คลินิกมหาวิทยาลัย','ข้อมูลอาการเบื้องต้นยังไม่ครบแต่ผู้ใช้ร้องขอคิวด่วน'],
    ['shuttle','ระบบรถรับส่งมหาวิทยาลัย','ฝนตกทำให้ภาพจากกล้องและทางเดินไม่ชัด'],
    ['library','ห้องสมุดดิจิทัล','คำค้นของผู้ใช้หลายกลุ่มต่างจากตัวอย่างเดิมมาก'],
    ['access','ระบบผ่านประตูอาคาร','บัตรหมดอายุแต่มีการแจ้งว่าเป็นกรณีฉุกเฉิน'],
    ['waste','ศูนย์คัดแยกขยะ','วัตถุใหม่มีลักษณะคล้ายหลายประเภทและความมั่นใจต่ำ'],
    ['classroom','ศูนย์จัดการห้องเรียน','ตารางเรียนเปลี่ยนกะทันหันแต่ข้อมูลยังซิงก์ไม่ครบ'],
    ['energy','ศูนย์จัดการพลังงาน','ค่าจากเซนเซอร์บางจุดต่างจากรูปแบบปกติอย่างมาก'],
    ['community','ศูนย์บริการชุมชน','ผู้ใช้บางกลุ่มเข้าถึงบริการด้วยเงื่อนไขต่างกัน'],
    ['lab','ห้องปฏิบัติการวิทยาศาสตร์','อุปกรณ์วัดค่าบางตัวมีสัญญาณรบกวน'],
    ['sports','ศูนย์กีฬา','ผู้ใช้หนาแน่นและมีความเสี่ยงด้านความปลอดภัย'],
    ['aid','ศูนย์ช่วยเหลือฉุกเฉิน','คำขอหลายรายการต้องจัดลำดับภายใต้เวลาจำกัด'],
    ['admission','ศูนย์รับสมัคร','เอกสารบางส่วนอ่านไม่ชัดหรือขาดหน้า'],
    ['water','ศูนย์ตรวจคุณภาพน้ำ','ข้อมูลจากหลายแหล่งให้ผลไม่สอดคล้องกัน'],
    ['elder','ศูนย์เรียนรู้ผู้สูงอายุ','ผู้ใช้ต้องการคำอธิบายที่อ่านง่ายก่อนตัดสินใจ'],
    ['traffic','ศูนย์ควบคุมจราจร','สภาพถนนเปลี่ยนเร็วจากอุบัติเหตุและฝนตก'],
    ['student','ศูนย์บริการนักศึกษา','ผู้ใช้โต้แย้งผลที่มีผลต่อการเข้าถึงบริการ'],
    ['volunteer','ศูนย์ประสานงานอาสา','ข้อมูลผู้รับบริการใหม่ต่างจากตัวอย่างเดิม'],
    ['hospital','โรงพยาบาลสัตว์มหาวิทยาลัย','ผลคัดกรองอาจกระทบการได้รับการรักษา'],
    ['retail','ตลาดชุมชนดิจิทัล','คำสั่งซื้อผิดปกติเพิ่มขึ้นในช่วงเวลาสั้น'],
    ['food','โรงอาหารอัจฉริยะ','จำนวนผู้ใช้ช่วงเร่งด่วนต่างจากข้อมูลคาดการณ์'],
    ['career','ศูนย์แนะแนวอาชีพ','ข้อมูลคุณสมบัติผู้สมัครบางส่วนขาดหาย'],
    ['parking','ศูนย์จัดการที่จอดรถ','กล้องหนึ่งจุดอ่านป้ายทะเบียนคลาดเคลื่อน'],
    ['dorm','ระบบหอพักนักศึกษา','สัญญาณเข้าออกขัดแย้งกับข้อมูลการจอง']
  ].map(([id,title,risk])=>({id,title,risk}));
  const specs=[
    {key:'peas',skill:'PEAS ครบองค์ประกอบ',phase:'Phase 1 • Agent Builder',tier:'Foundation',kind:'m',subtype:'map'},
    {key:'sensorActuator',skill:'Sensor / Actuator',phase:'Phase 1 • Agent Builder',tier:'Foundation',kind:'m',subtype:'map'},
    {key:'performance',skill:'Performance measure',phase:'Phase 1 • Agent Builder',tier:'Core',kind:'m'},
    {key:'rational',skill:'Rational action',phase:'Phase 1 • Agent Builder',tier:'Core',kind:'m'},
    {key:'oversight',skill:'Human oversight',phase:'Phase 1 • Agent Builder',tier:'Stretch',kind:'m'},
    {key:'agent',skill:'Agent concept',phase:'Phase 2 • วิเคราะห์ Agent',tier:'Foundation',kind:'q'},
    {key:'reliability',skill:'Sensor reliability',phase:'Phase 2 • วิเคราะห์ Agent',tier:'Core',kind:'q'},
    {key:'environment',skill:'Environment',phase:'Phase 2 • วิเคราะห์ Agent',tier:'Core',kind:'q'},
    {key:'whyPeas',skill:'Why PEAS',phase:'Phase 2 • วิเคราะห์ Agent',tier:'Foundation',kind:'q'},
    {key:'tradeoff',skill:'Safety Trade-off',phase:'Phase 2 • วิเคราะห์ Agent',tier:'Stretch',kind:'q'},
    {key:'rationality',skill:'Rationality',phase:'Phase 2 • วิเคราะห์ Agent',tier:'Core',kind:'q'},
    {key:'audit',skill:'Audit trail',phase:'Phase 2 • วิเคราะห์ Agent',tier:'Stretch',kind:'q'},
    {key:'scope',skill:'Scope boundary',phase:'Phase 2 • วิเคราะห์ Agent',tier:'Stretch',kind:'q'},
    {key:'fallback',skill:'Case Twist: safe fallback',phase:'Phase 3 • Case Twist',tier:'Stretch',kind:'twist'},
    {key:'rights',skill:'Case Twist: user rights',phase:'Phase 3 • Case Twist',tier:'Stretch',kind:'twist'}
  ];
  const read=(k,d)=>{try{const v=JSON.parse(localStorage.getItem(k)||'null');return v==null?d:v}catch(e){return d}};
  const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
  const profile=()=>{try{return window.AIQuestStorage?.getProfile?.()||read('CSAI2102_AIQUEST_PROFILE_V421',{})}catch(e){return {}}};
  const user=()=>String(profile().studentId||'guest').replace(/[^a-z0-9_-]/gi,'_');
  const hash=value=>{let n=2166136261;for(let i=0;i<String(value).length;i++){n^=String(value).charCodeAt(i);n=Math.imul(n,16777619)}return n>>>0;};
  const unique=a=>new Set(a).size===a.length;
  const choice=(spec,ctx,round,policy)=>{
    const where=ctx.title,risk=ctx.risk;
    const bank={
      performance:{prompt:'Performance measure ของ '+where+' ควรวัดอะไรจึงสะท้อนคุณภาพบริการจริง',correct:'งานสำเร็จถูกต้อง ปลอดภัย และติดตามผลกระทบต่อผู้ใช้ได้',wrong:['วัดเฉพาะจำนวนงานต่อชั่วโมง','วัดแค่คะแนนความมั่นใจเฉลี่ย','วัดสีหรือความสวยของหน้าจอ'],explain:'เกณฑ์วัดผลต้องรวมความถูกต้อง ความปลอดภัย และผลกระทบ ไม่ใช่ความเร็วอย่างเดียว'},
      rational:{prompt:'ระหว่างทำงาน '+where+' พบว่า '+risk+' Agent ที่มีเหตุผลควรทำอะไร',correct:'ชะลอหรือหยุดกรณีเสี่ยง ตรวจข้อมูลที่มี และเลือกทางที่ปลอดภัยที่สุด',wrong:['เร่งทำงานต่อเพื่อให้คิวจบเร็ว','สุ่มเลือก action เพื่อไม่ให้ค้าง','ซ่อนคำเตือนจากผู้ใช้'],explain:'Rational action เลือกจากข้อมูล เป้าหมาย และข้อจำกัดจริง'},
      oversight:{prompt:'กรณีของ '+where+' อาจมีผลต่อความปลอดภัยหรือสิทธิ์ผู้ใช้ การออกแบบใดรับผิดชอบที่สุด',correct:'กำหนดเงื่อนไขส่งต่อผู้รับผิดชอบและหยุดอย่างปลอดภัยเมื่อผลกระทบสูง',wrong:['ให้ระบบตัดสินเองทุกกรณี','ใช้ความเร็วเป็นเกณฑ์เดียว','ลบ log เพื่อลดคำถาม'],explain:'Human oversight กำกับเคสที่ AI ไม่ควรตัดสินใจลำพัง'},
      agent:{prompt:'เมื่อทีมต้องตรวจสอบย้อนหลัง เหตุใด '+where+' จึงนับว่าเป็น intelligent agent ได้',correct:'เพราะรับรู้สภาพแวดล้อมและเลือกการกระทำเพื่อบรรลุเป้าหมาย',wrong:['เพราะเก็บข้อมูลได้มาก','เพราะมีหน้าจออัตโนมัติ','เพราะใช้ไฟฟ้า'],explain:'Agent เชื่อม percept กับ action ภายใต้เป้าหมายและข้อจำกัด'},
      reliability:{prompt:'หาก '+where+' ได้ข้อมูลคลาดเคลื่อน ความเสี่ยงหลักคืออะไร',correct:'อาจเลือก action จาก percept ที่ผิด จึงต้องตรวจคุณภาพข้อมูลและมีทางปลอดภัย',wrong:['ระบบจะแม่นยำขึ้นเสมอ','Actuator จะกลายเป็น Sensor','ไม่เกี่ยวกับการตัดสินใจ'],explain:'คุณภาพของ percept ส่งผลโดยตรงต่อ action ที่ Agent เลือก'},
      environment:{prompt:'ข้อใดอธิบาย Environment ของ '+where+' ได้เหมาะสมที่สุด',correct:'ผู้ใช้ กฎ พื้นที่ และเหตุการณ์ภายนอกที่ Agent ต้องรับรู้และรับมือ',wrong:['เฉพาะคะแนนของโมเดล','เฉพาะชื่อระบบ','เฉพาะปุ่มเริ่มเกม'],explain:'Environment คือบริบทจริงที่มีผลต่อการตัดสินใจ'},
      whyPeas:{prompt:'ก่อนพัฒนา '+where+' เหตุใดต้องกำหนด PEAS ให้ชัดเจน',correct:'เพื่อกำหนดเป้าหมาย สภาพแวดล้อม การรับรู้ และการกระทำก่อนสร้างระบบ',wrong:['เพื่อไม่ต้องทดสอบระบบ','เพื่อเลือกสีของแอป','เพื่อแทนมนุษย์ทุกงาน'],explain:'PEAS ลดความกำกวมและช่วยตรวจความครบถ้วนของการออกแบบ'},
      tradeoff:{prompt:'ถ้า '+where+' เร็วขึ้นแต่เพิ่มความเสี่ยงต่อผู้ใช้ ควรปรับเกณฑ์ตัดสินใจอย่างไร',correct:'กำหนดความปลอดภัยเป็นข้อจำกัดหลัก แล้วเพิ่มความเร็วภายในขอบเขตที่อนุญาต',wrong:['ให้ความเร็วชนะเสมอ','รวมทุกอย่างเป็นคะแนนเดียวโดยไม่แยกความเสี่ยง','ซ่อน trade-off จากผู้ใช้'],explain:'ความปลอดภัยและสิทธิ์ผู้ใช้ไม่ควรถูกลดเหลือเพียงคะแนนรอง'},
      rationality:{prompt:'คำว่า rational agent ในบริบท '+where+' หมายความว่าอะไร',correct:'เลือก action ที่เหมาะสมจาก percept เป้าหมาย หลักฐาน และความไม่แน่นอน',wrong:['ถูกต้องทุกครั้งโดยไม่ต้องตรวจ','ทำงานเร็วที่สุดเสมอ','ไม่ต้องใช้ Sensor'],explain:'Rationality คือคุณภาพของกระบวนการเลือก ไม่ได้แปลว่าไม่เคยผิดพลาด'},
      audit:{prompt:'เหตุใด '+where+' ควรบันทึก percept เหตุผลการตัดสินใจ และ action',correct:'เพื่อให้ตรวจสอบย้อนหลัง แก้ข้อผิดพลาด และรับผิดชอบต่อผลกระทบได้',wrong:['เพื่อเก็บข้อมูลให้มากที่สุด','เพื่อซ่อนเหตุผลจากผู้ใช้','เพื่อไม่ให้มนุษย์เกี่ยวข้อง'],explain:'Audit trail เชื่อมผลลัพธ์เข้ากับหลักฐานและผู้รับผิดชอบ'},
      scope:{prompt:'ข้อใดเป็นการกำหนด Scope boundary ที่ดีของ '+where,correct:'ระบุสิ่งที่ระบบทำได้ สิ่งที่ไม่ควรตัดสินเอง และจุดที่ต้องส่งต่อผู้รับผิดชอบ',wrong:['ให้ระบบตอบทุกเรื่องแม้ไม่มีข้อมูล','ซ่อนข้อจำกัดเพื่อให้ผู้ใช้เชื่อ','ให้ระบบเรียนรู้จากผลโดยไม่ต้องตรวจ'],explain:'ขอบเขตที่ชัดป้องกันการนำระบบไปใช้เกินความสามารถ'},
      fallback:{prompt:'⚡ Case Twist — '+where+' พบข้อมูลใหม่ที่ต่างจากตัวอย่างเดิมมาก: '+risk+' ควรทำอย่างไร',correct:'หยุดใช้ผลกับกรณีนั้นชั่วคราว เก็บหลักฐาน และส่งต่อผู้รับผิดชอบตรวจ',wrong:['ใช้ผลเดิมต่อทันที','ลบคำเตือนทั้งหมด','ปรับผลแบบสุ่ม'],explain:'Safe fallback ลดความเสียหายก่อนทีมจะประเมินใหม่'},
      rights:{prompt:'⚡ Case Twist — ผู้ใช้ได้รับผลกระทบจาก '+where+' และขอทราบเหตุผล ระบบควรตอบอย่างไร',correct:'อธิบายข้อมูลหรือกฎที่ใช้ ข้อจำกัด และช่องทางขอทบทวน',wrong:['ยืนยันผลโดยไม่อธิบาย','บอกว่าเป็นความลับของ AI','ปิดช่องทางติดต่อเพื่อความเร็ว'],explain:'ผลที่กระทบสิทธิ์ผู้ใช้ควรอธิบายได้และมีช่องทางทบทวน'}
    };
    const item=bank[spec.key];
    return {id:'s2_'+spec.key+'_'+ctx.id+'_r'+round,source:'s2:'+spec.key,conceptKey:spec.key,promptPattern:spec.key+'-p'+round,answerPolicy:policy,kind:spec.kind,subtype:'choice',skill:spec.skill,phase:spec.phase,tier:spec.tier,context:spec.skill+' • '+where,contextBase:where,scenarioFocus:spec.skill,contextSignature:spec.skill+' • '+where,prompt:item.prompt,correct:item.correct,wrong:item.wrong,explain:item.explain};
  };
  const map=(spec,ctx,round,policy)=>{
    const where=ctx.title;
    if(spec.key==='peas')return {id:'s2_peas_'+ctx.id+'_r'+round,source:'s2:peas',conceptKey:'peas',promptPattern:'peas-p'+round,answerPolicy:policy,kind:'m',subtype:'map',skill:spec.skill,phase:spec.phase,tier:spec.tier,context:spec.skill+' • '+where,contextBase:where,scenarioFocus:spec.skill,contextSignature:spec.skill+' • '+where,prompt:'จัดองค์ประกอบของ '+where+' ลงใน PEAS ให้ครบและสอดคล้องกับสถานการณ์จริง',labels:['P • Performance','E • Environment','A • Actuator','S • Sensor'],cards:[{text:'ส่งมอบบริการอย่างถูกต้อง ปลอดภัย และตรวจสอบได้',answer:'P • Performance'},{text:'ผู้ใช้ กฎพื้นที่ อุปสรรค และสถานการณ์จริงที่ระบบต้องรับมือ',answer:'E • Environment'},{text:'การเรียกคิว หยุด ปลดล็อก แจ้งเตือน หรือส่งคำสั่งออกไป',answer:'A • Actuator'},{text:'ภาพ เวลา ตำแหน่ง สถานะ แบบฟอร์ม หรือสัญญาณที่ระบบอ่านเข้า',answer:'S • Sensor'}],explain:'PEAS ทำให้ทีมแยกเป้าหมาย สภาพแวดล้อม การรับรู้ และการกระทำออกจากกันก่อนออกแบบ Agent'};
    return {id:'s2_sensor_'+ctx.id+'_r'+round,source:'s2:sensor_actuator',conceptKey:'sensor_actuator',promptPattern:'sensor-actuator-p'+round,answerPolicy:policy,kind:'m',subtype:'map',skill:spec.skill,phase:spec.phase,tier:spec.tier,context:spec.skill+' • '+where,contextBase:where,scenarioFocus:spec.skill,contextSignature:spec.skill+' • '+where,prompt:'แยกสิ่งที่ '+where+' ใช้รับรู้ กับสิ่งที่ใช้กระทำต่อสภาพแวดล้อม',labels:['Sensor','Actuator'],cards:[{text:'ภาพ สถานะตำแหน่ง ระยะห่าง หรือข้อมูลที่ตรวจพบก่อนตัดสินใจ',answer:'Sensor'},{text:'คำสั่งเปิด ปิด หยุด ชะลอ เรียกคิว หรือแจ้งเตือนผู้เกี่ยวข้อง',answer:'Actuator'},{text:'สัญญาณจากผู้ใช้และสภาพแวดล้อมที่ระบบอ่านเข้า',answer:'Sensor'},{text:'ผลลัพธ์ที่เปลี่ยนสถานะหรือส่งผลกลับไปยังโลกจริง',answer:'Actuator'}],explain:'Sensor คือข้อมูลเข้าเพื่อรับรู้ ส่วน Actuator คือการกระทำที่ส่งผลกลับไปยังสภาพแวดล้อม'};
  };
  function buildDeck(){
    const key=HISTORY+'_'+user(),history=read(key,{round:0,decks:[]});
    const round=Number(history.round||0)+1,old=(history.decks||[]).slice(-4),blocked=new Set(old.flatMap(x=>x.fingerprints||[]));
    const used=new Set(),cards=[];
    specs.forEach((spec,index)=>{
      let ctx=null,policy=null;
      for(let tryNo=0;tryNo<contexts.length*policies.length;tryNo++){
        const candidate=contexts[(round*3+index*7+tryNo*5)%contexts.length];
        const candidatePolicy=policies[(round+index+tryNo)%policies.length];
        const fingerprint='s2:'+spec.key+'|'+candidate.id+'|'+candidatePolicy;
        if(!used.has(candidate.id)&&!blocked.has(fingerprint)){ctx=candidate;policy=candidatePolicy;break;}
      }
      if(!ctx){ctx=contexts.find(x=>!used.has(x.id))||contexts[index];policy=policies[(round+index)%policies.length];}
      used.add(ctx.id);
      const card=spec.subtype==='map'?map(spec,ctx,round,policy):choice(spec,ctx,round,policy);
      card.answerFingerprint=card.source+'|'+ctx.id+'|'+policy;
      cards.push(card);
    });
    let choiceNo=0;const start=round%4;
    cards.forEach(card=>{if(card.subtype==='choice'){card.answerSlot=(start+choiceNo)%4;choiceNo++;}});
    const slotCounts=[0,1,2,3].map(n=>cards.filter(card=>card.answerSlot===n).length);
    const audit={version:'v7.0.1',ok:cards.length===15&&unique(cards.map(c=>c.context))&&unique(cards.map(c=>c.source))&&unique(cards.map(c=>c.conceptKey))&&unique(cards.map(c=>c.promptPattern))&&unique(cards.map(c=>c.answerFingerprint)),contextUnique:new Set(cards.map(c=>c.context)).size,conceptUnique:new Set(cards.map(c=>c.conceptKey)).size,sourceUnique:new Set(cards.map(c=>c.source)).size,promptPatternUnique:new Set(cards.map(c=>c.promptPattern)).size,fingerprintUnique:new Set(cards.map(c=>c.answerFingerprint)).size,answerSlots:slotCounts,choiceCards:choiceNo};
    if(!audit.ok)throw new Error('S2_STABLE_DECK_INTEGRITY_FAILED');
    const deck={id:'s2stable_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8),round,cards,structure:{total:15,mechanic:5,knowledge:8,twist:2},usedWindow:4,poolSize:{mechanic:5,knowledge:8,twist:2},semanticAudit:audit,answerPositionAudit:{version:'v7.0.1',plannedSlots:slotCounts,noAdjacentDuplicate:true},semanticDiversity:true};
    history.round=round;history.decks=old.concat([{round,at:Date.now(),fingerprints:cards.map(c=>c.answerFingerprint)}]).slice(-4);write(key,history);
    return deck;
  }
  api.buildDeck=buildDeck;
  api.version='v7.0.1';
  api.semanticDiversity=true;
  api.semanticDeckReady=true;
})();