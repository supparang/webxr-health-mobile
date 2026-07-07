/* CSAI2102 AI Quest — S2 Semantic Deck Factory v6.9.6
   Guarantees one distinct concept/source/prompt pattern per card in a 15-card S2 Deck.
   Also plans balanced correct-answer slots for the 13 choice cards: 4/3/3/3,
   with no adjacent choice cards using the same slot.
*/
(()=>{'use strict';
  if(window.__AIQUEST_S2_SEMANTIC_DECK_V696__)return;
  window.__AIQUEST_S2_SEMANTIC_DECK_V696__=true;

  const ROOT='CSAI2102_S2_SEMANTIC_DECK_V696',MID='s2',WINDOW=4;
  const tidy=value=>String(value==null?'':value).replace(/\s+/g,' ').trim();
  const clone=value=>JSON.parse(JSON.stringify(value));
  const read=(key,fallback)=>{try{const value=JSON.parse(localStorage.getItem(key)||'null');return value==null?fallback:value}catch(e){return fallback}};
  const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value))}catch(e){}};
  const profile=()=>{try{return window.AIQuestStorage?.getProfile?.()||read('CSAI2102_AIQUEST_PROFILE_V421',{})}catch(e){return {}}};
  const user=()=>String(profile().studentId||'guest').replace(/[^a-z0-9_-]/gi,'_');
  const hash=value=>{let n=2166136261;for(const char of String(value||'')){n^=char.charCodeAt(0);n=Math.imul(n,16777619)}return n>>>0};
  const pick=(list,seed)=>list[Math.abs(seed)%list.length];
  const unique=list=>new Set(list).size===list.length;
  const policyNames=['verify','reversible','threshold','rights','audit','scope'];
  const places=[
    {id:'mail',title:'ศูนย์คัดกรองอีเมลภาควิชา',risk:'อีเมลสำคัญรูปแบบใหม่ถูกจัดเป็นสแปม'},
    {id:'clinic',title:'คลินิกมหาวิทยาลัย',risk:'ข้อมูลอาการเบื้องต้นไม่ครบแต่ผู้ป่วยร้องขอคิวด่วน'},
    {id:'shuttle',title:'ระบบรถรับส่งมหาวิทยาลัย',risk:'ฝนตกทำให้กล้องอ่านป้ายและทางเดินไม่ชัด'},
    {id:'library',title:'ห้องสมุดดิจิทัล',risk:'ผู้ใช้หลายกลุ่มค้นหาข้อมูลด้วยคำที่ต่างกันมาก'},
    {id:'access',title:'ระบบผ่านประตูอาคาร',risk:'บัตรหมดอายุแต่ผู้ใช้แจ้งว่าเป็นกรณีฉุกเฉิน'},
    {id:'waste',title:'ศูนย์คัดแยกขยะ',risk:'วัตถุใหม่มีลักษณะคล้ายหลายประเภทและความมั่นใจต่ำ'},
    {id:'classroom',title:'ศูนย์จัดการห้องเรียน',risk:'ตารางเรียนเปลี่ยนกะทันหันและข้อมูลยังซิงก์ไม่ครบ'},
    {id:'energy',title:'ศูนย์จัดการพลังงาน',risk:'ค่าจากเซนเซอร์บางจุดต่างจากรูปแบบปกติอย่างมาก'},
    {id:'community',title:'ศูนย์บริการชุมชน',risk:'ผู้ใช้บางกลุ่มเข้าถึงบริการด้วยเงื่อนไขต่างกัน'},
    {id:'lab',title:'ห้องปฏิบัติการวิทยาศาสตร์',risk:'อุปกรณ์วัดค่าบางตัวมีสัญญาณรบกวน'},
    {id:'sports',title:'ศูนย์กีฬา',risk:'ผู้ใช้หนาแน่นและมีความเสี่ยงด้านความปลอดภัย'},
    {id:'aid',title:'ศูนย์ช่วยเหลือฉุกเฉิน',risk:'คำขอหลายรายการต้องจัดลำดับภายใต้เวลาจำกัด'},
    {id:'admission',title:'ศูนย์รับสมัคร',risk:'เอกสารผู้สมัครบางส่วนอ่านไม่ชัดหรือขาดหน้า'},
    {id:'water',title:'ศูนย์ตรวจคุณภาพน้ำ',risk:'ข้อมูลจากหลายแหล่งให้ผลไม่สอดคล้องกัน'},
    {id:'elder',title:'ศูนย์เรียนรู้ผู้สูงอายุ',risk:'ผู้ใช้ต้องการคำอธิบายที่อ่านง่ายก่อนตัดสินใจ'},
    {id:'traffic',title:'ศูนย์ควบคุมจราจร',risk:'สภาพถนนเปลี่ยนเร็วจากอุบัติเหตุและฝนตก'},
    {id:'student',title:'ศูนย์บริการนักศึกษา',risk:'ผู้ใช้โต้แย้งผลที่ส่งผลต่อการเข้าถึงบริการ'},
    {id:'volunteer',title:'ศูนย์ประสานงานอาสา',risk:'ข้อมูลผู้รับบริการใหม่ต่างจากตัวอย่างเดิม'},
    {id:'hospital',title:'โรงพยาบาลสัตว์มหาวิทยาลัย',risk:'ผลคัดกรองอาจกระทบการได้รับการรักษา'},
    {id:'retail',title:'ตลาดชุมชนดิจิทัล',risk:'คำสั่งซื้อผิดปกติเพิ่มขึ้นในช่วงเวลาสั้น'}
  ];
  const commonWrong=['ทำงานต่อทันทีแม้ข้อมูลไม่พอ','ซ่อนความไม่แน่ใจจากผู้ใช้','เลือกทางที่เร็วที่สุดโดยไม่ตรวจผลกระทบ'];
  const choice=(id,skill,concept,pattern,phase,tier,ctx,variant,prompt,correct,wrong,explain,kind='q')=>({
    id,source:'s2:'+concept,conceptKey:concept,promptPattern:pattern+'-v'+variant,answerPolicy:policyNames[variant%policyNames.length],kind,subtype:'choice',skill,phase,tier,context:skill+' • '+ctx.title,contextBase:ctx.title,scenarioFocus:skill,contextSignature:skill+' • '+ctx.title,prompt,correct,wrong:[...wrong].filter(Boolean).slice(0,3),explain
  });
  const map=(id,skill,concept,pattern,phase,tier,ctx,variant,labels,cards,explain)=>({
    id,source:'s2:'+concept,conceptKey:concept,promptPattern:pattern+'-v'+variant,answerPolicy:policyNames[variant%policyNames.length],kind:'m',subtype:'map',skill,phase,tier,context:skill+' • '+ctx.title,contextBase:ctx.title,scenarioFocus:skill,contextSignature:skill+' • '+ctx.title,prompt:skill==='PEAS ครบองค์ประกอบ'?'จัดวางองค์ประกอบของ '+ctx.title+' ลงใน PEAS ให้ครบและสอดคล้องกับสถานการณ์จริง':'แยกสิ่งที่ '+ctx.title+' ใช้รับรู้ กับสิ่งที่ใช้กระทำต่อสภาพแวดล้อม',labels,cards,explain
  });
  const v=(round,index,blocked,tag)=>{
    const candidates=[0,1,2,3,4,5].filter(x=>!blocked.has(tag+'|'+x));
    return pick(candidates.length?candidates:[0,1,2,3,4,5],hash(tag+'|'+round+'|'+index));
  };
  function makeSpec(spec,ctx,variant){
    const phase=spec.phase,tier=spec.tier,where=ctx.title,risk=ctx.risk;
    if(spec.key==='peas')return map('s2_peas_'+ctx.id+'_v'+variant,'PEAS ครบองค์ประกอบ','peas_board','peas-board',phase,tier,ctx,variant,['P • Performance','E • Environment','A • Actuator','S • Sensor'],[
      {text:'ส่งมอบบริการของ '+where+' อย่างถูกต้อง ปลอดภัย และตรวจสอบได้',answer:'P • Performance'},
      {text:'ผู้ใช้ กฎพื้นที่ อุปสรรค และสถานการณ์จริงที่ '+where+' ต้องรับมือ',answer:'E • Environment'},
      {text:'การเรียกคิว หยุด ปลดล็อก แจ้งเตือน หรือส่งคำสั่งออกไป',answer:'A • Actuator'},
      {text:'ภาพ เวลา ตำแหน่ง สถานะ แบบฟอร์ม หรือสัญญาณที่ระบบอ่านเข้า',answer:'S • Sensor'}
    ],'PEAS ทำให้ทีมแยกเป้าหมาย สภาพแวดล้อม การรับรู้ และการกระทำออกจากกันก่อนออกแบบ Agent');
    if(spec.key==='sensorActuator')return map('s2_sensor_actuator_'+ctx.id+'_v'+variant,'Sensor / Actuator','sensor_actuator','sensor-actuator',phase,tier,ctx,variant,['Sensor','Actuator'],[
      {text:'ภาพ สถานะตำแหน่ง ระยะห่าง หรือข้อมูลที่ตรวจพบก่อนตัดสินใจ',answer:'Sensor'},
      {text:'คำสั่งเปิด ปิด หยุด ชะลอ เรียกคิว หรือแจ้งเตือนผู้เกี่ยวข้อง',answer:'Actuator'},
      {text:'สัญญาณจากผู้ใช้และสภาพแวดล้อมของ '+where,answer:'Sensor'},
      {text:'ผลลัพธ์ที่เปลี่ยนสถานะหรือส่งผลกลับไปยังโลกจริง',answer:'Actuator'}
    ],'Sensor คือข้อมูลเข้าเพื่อรับรู้ ส่วน Actuator คือการกระทำที่ส่งผลกลับไปยังสภาพแวดล้อม');
    const data={
      performance:[
        'Performance measure ของ '+where+' ควรวัดอะไรจึงสะท้อนคุณภาพบริการจริง',
        'งานสำเร็จถูกต้อง พร้อมติดตามเหตุเสี่ยงและผลกระทบต่อผู้ใช้',
        ['วัดเฉพาะจำนวนงานต่อชั่วโมง','วัดแค่คะแนนความมั่นใจเฉลี่ย','วัดสีหรือความสวยของหน้าจอ'],
        'เกณฑ์วัดผลที่ดีต้องรวมความถูกต้อง ความปลอดภัย และผลกระทบ ไม่ใช่ความเร็วอย่างเดียว'
      ],
      rational:[
        'ระหว่างทำงาน '+where+' พบว่า '+risk+' Agent ที่มีเหตุผลควรทำอะไร',
        'ชะลอหรือหยุดกรณีเสี่ยง ตรวจข้อมูลที่มี และเลือก action ที่ปลอดภัยที่สุด',
        ['เร่งทำงานต่อเพื่อให้คิวจบเร็ว','สุ่มเลือก action เพื่อไม่ให้ค้าง','ซ่อนคำเตือนจากผู้ใช้'],
        'Rational action เลือกจาก percept เป้าหมาย และข้อจำกัดจริง โดยไม่ยอมรับความเสี่ยงที่หลีกเลี่ยงได้'
      ],
      oversight:[
        'กรณีของ '+where+' อาจมีผลต่อความปลอดภัยหรือสิทธิ์ผู้ใช้ การออกแบบใดรับผิดชอบที่สุด',
        'กำหนดเงื่อนไขส่งต่อผู้รับผิดชอบและหยุดอย่างปลอดภัยเมื่อผลกระทบสูง',
        ['ให้ระบบตัดสินเองทุกกรณี','ใช้ความเร็วเป็นเกณฑ์เดียว','ลบ log เพื่อลดคำถาม'],
        'Human oversight ช่วยกำกับเคสที่ AI ไม่ควรตัดสินใจลำพัง'
      ],
      agent:[
        'เหตุใด '+where+' จึงนับว่าเป็น intelligent agent ได้',
        'เพราะรับรู้สภาพแวดล้อมและเลือกการกระทำเพื่อบรรลุเป้าหมาย',
        ['เพราะมีหน้าจออัตโนมัติ','เพราะใช้ไฟฟ้า','เพราะเก็บข้อมูลได้มาก'],
        'Agent เชื่อม percept กับ action ภายใต้เป้าหมายและข้อจำกัด'
      ],
      reliability:[
        'หาก '+where+' ได้ข้อมูลคลาดเคลื่อน ความเสี่ยงหลักคืออะไร',
        'อาจเลือก action จาก percept ที่ผิด จึงต้องตรวจคุณภาพข้อมูลและมีทางปลอดภัย',
        ['ระบบจะแม่นยำขึ้นเสมอ','Actuator จะกลายเป็น Sensor','ไม่เกี่ยวกับการตัดสินใจ'],
        'คุณภาพของ percept ส่งผลโดยตรงต่อ action ที่ Agent เลือก'
      ],
      environment:[
        'ข้อใดอธิบาย Environment ของ '+where+' ได้เหมาะสมที่สุด',
        'ผู้ใช้ ข้อจำกัดพื้นที่ กฎ และเหตุการณ์ภายนอกที่ Agent ต้องรับรู้และรับมือ',
        ['เฉพาะคะแนนของโมเดล','เฉพาะชื่อระบบ','เฉพาะปุ่มเริ่มเกม'],
        'Environment คือโลกจริงที่มีผลต่อการตัดสินใจ ไม่ใช่เพียงส่วนภายในของโปรแกรม'
      ],
      whyPeas:[
        'ก่อนพัฒนา '+where+' เหตุใดต้องกำหนด PEAS ให้ชัดเจน',
        'เพื่อกำหนดเป้าหมาย สภาพแวดล้อม การรับรู้ และการกระทำก่อนสร้างระบบ',
        ['เพื่อไม่ต้องทดสอบระบบ','เพื่อเลือกสีของแอป','เพื่อแทนมนุษย์ทุกงาน'],
        'PEAS ลดความกำกวมและช่วยตรวจความครบถ้วนของการออกแบบ Agent'
      ],
      tradeoff:[
        'ถ้า '+where+' เร็วขึ้นแต่เพิ่มความเสี่ยงต่อผู้ใช้ ควรปรับเกณฑ์ตัดสินใจอย่างไร',
        'กำหนดความปลอดภัยเป็นข้อจำกัดหลัก แล้วเพิ่มความเร็วภายในขอบเขตที่อนุญาต',
        ['ให้ความเร็วชนะเสมอ','รวมทุกอย่างเป็นคะแนนเดียวโดยไม่แยกความเสี่ยง','ซ่อน trade-off จากผู้ใช้'],
        'เมื่อผลกระทบสูง ความปลอดภัยและสิทธิ์ผู้ใช้ไม่ควรถูกลดเหลือเพียงคะแนนรอง'
      ],
      rationality:[
        'คำว่า rational agent ในบริบท '+where+' หมายความว่าอะไร',
        'เลือก action ที่เหมาะสมจาก percept เป้าหมาย ข้อมูลที่มี และความไม่แน่นอน',
        ['ถูกต้องทุกครั้งโดยไม่ต้องตรวจ','ทำงานเร็วที่สุดเสมอ','ไม่ต้องใช้ Sensor'],
        'Rationality เป็นคุณภาพของกระบวนการเลือก ไม่ได้แปลว่าไม่เคยผิดพลาด'
      ],
      audit:[
        'เหตุใด '+where+' ควรบันทึก percept เหตุผลการตัดสินใจ และ action',
        'เพื่อให้ตรวจสอบย้อนหลัง แก้ข้อผิดพลาด และรับผิดชอบต่อผลกระทบได้',
        ['เพื่อเก็บข้อมูลให้มากที่สุด','เพื่อซ่อนเหตุผลจากผู้ใช้','เพื่อไม่ให้มนุษย์เกี่ยวข้อง'],
        'Audit trail เชื่อมผลลัพธ์เข้ากับหลักฐานและผู้รับผิดชอบ'
      ],
      scope:[
        'ข้อใดเป็นการกำหนด Scope boundary ที่ดีของ '+where, 
        'ระบุสิ่งที่ระบบทำได้ สิ่งที่ไม่ควรตัดสินเอง และจุดที่ต้องส่งต่อผู้รับผิดชอบ',
        ['ให้ระบบตอบทุกเรื่องแม้ไม่มีข้อมูล','ซ่อนข้อจำกัดเพื่อให้ผู้ใช้เชื่อ','ให้ระบบเรียนรู้จากผลโดยไม่ต้องตรวจ'],
        'ขอบเขตที่ชัดทำให้ระบบไม่ถูกนำไปใช้เกินความสามารถที่ออกแบบไว้'
      ],
      safeFallback:[
        '⚡ Case Twist — '+where+' พบข้อมูลใหม่ที่ต่างจากตัวอย่างเดิมมาก: '+risk+' ควรทำอย่างไร',
        'หยุดใช้ผลกับกรณีนั้นชั่วคราว เก็บหลักฐาน และส่งต่อผู้รับผิดชอบตรวจ',
        ['ใช้ผลเดิมต่อทันที','ลบคำเตือนทั้งหมด','ปรับผลแบบสุ่ม'],
        'เมื่อ context เปลี่ยนมาก การเลือก safe fallback ช่วยลดความเสียหายก่อนทีมจะประเมินใหม่'
      ],
      userRights:[
        '⚡ Case Twist — ผู้ใช้ได้รับผลกระทบจาก '+where+' และขอทราบเหตุผล ระบบควรตอบอย่างไร',
        'อธิบายข้อมูลหรือกฎที่ใช้ ข้อจำกัด และช่องทางขอทบทวน',
        ['ยืนยันผลโดยไม่อธิบาย','บอกว่าเป็นความลับของ AI','ปิดช่องทางติดต่อเพื่อความเร็ว'],
        'ผลที่กระทบสิทธิ์ผู้ใช้ควรอธิบายได้และมีช่องทางเยียวยาหรือทบทวน'
      ]
    };
    const item=data[spec.key];
    const variantLead=[
      '',
      'ในสถานการณ์ปกติ ',
      'เมื่อทีมต้องตรวจสอบย้อนหลัง ',
      'หากมีข้อมูลบางส่วนไม่สมบูรณ์ ',
      'ก่อนเปิดใช้กับผู้ใช้จริง ',
      'เมื่อผลลัพธ์อาจกระทบผู้ใช้หลายกลุ่ม '
    ][variant%6];
    const prompt=variantLead+item[0];
    return choice('s2_'+spec.key+'_'+ctx.id+'_v'+variant,spec.skill,spec.key,spec.pattern,phase,tier,ctx,variant,prompt,item[1],item[2],item[3],spec.kind);
  }
  const specs=[
    {key:'peas',skill:'PEAS ครบองค์ประกอบ',pattern:'peas-board',phase:'Phase 1 • Agent Builder',tier:'Foundation',kind:'m'},
    {key:'sensorActuator',skill:'Sensor / Actuator',pattern:'sensor-actuator',phase:'Phase 1 • Agent Builder',tier:'Foundation',kind:'m'},
    {key:'performance',skill:'Performance measure',pattern:'performance-measure',phase:'Phase 1 • Agent Builder',tier:'Core',kind:'m'},
    {key:'rational',skill:'Rational action',pattern:'rational-action',phase:'Phase 1 • Agent Builder',tier:'Core',kind:'m'},
    {key:'oversight',skill:'Human oversight',pattern:'human-oversight',phase:'Phase 1 • Agent Builder',tier:'Stretch',kind:'m'},
    {key:'agent',skill:'Agent concept',pattern:'agent-concept',phase:'Phase 2 • วิเคราะห์ Agent',tier:'Foundation',kind:'q'},
    {key:'reliability',skill:'Sensor reliability',pattern:'sensor-reliability',phase:'Phase 2 • วิเคราะห์ Agent',tier:'Core',kind:'q'},
    {key:'environment',skill:'Environment',pattern:'environment-boundary',phase:'Phase 2 • วิเคราะห์ Agent',tier:'Core',kind:'q'},
    {key:'whyPeas',skill:'Why PEAS',pattern:'why-peas',phase:'Phase 2 • วิเคราะห์ Agent',tier:'Foundation',kind:'q'},
    {key:'tradeoff',skill:'Safety Trade-off',pattern:'safety-tradeoff',phase:'Phase 2 • วิเคราะห์ Agent',tier:'Stretch',kind:'q'},
    {key:'rationality',skill:'Rationality',pattern:'rationality',phase:'Phase 2 • วิเคราะห์ Agent',tier:'Core',kind:'q'},
    {key:'audit',skill:'Audit trail',pattern:'audit-trail',phase:'Phase 2 • วิเคราะห์ Agent',tier:'Stretch',kind:'q'},
    {key:'scope',skill:'Scope boundary',pattern:'scope-boundary',phase:'Phase 2 • วิเคราะห์ Agent',tier:'Stretch',kind:'q'},
    {key:'safeFallback',skill:'Case Twist: safe fallback',pattern:'twist-safe-fallback',phase:'Phase 3 • Case Twist',tier:'Stretch',kind:'twist'},
    {key:'userRights',skill:'Case Twist: user rights',pattern:'twist-user-rights',phase:'Phase 3 • Case Twist',tier:'Stretch',kind:'twist'}
  ];
  function buildDeck(){
    const key=ROOT+'_'+user(),history=read(key,{rounds:[]});history.rounds=Array.isArray(history.rounds)?history.rounds.slice(-WINDOW):[];
    const rounds=history.rounds,round=rounds.length?Math.max(...rounds.map(row=>Number(row.round)||0))+1:1;
    const blockedFingerprints=new Set(rounds.flatMap(row=>row.fingerprints||[]));
    const blockedContexts=new Set(rounds.flatMap(row=>row.contexts||[]));
    const usedPlaces=new Set(),cards=[];
    specs.forEach((spec,index)=>{
      const base=hash(spec.key+'|'+round+'|'+index);
      let ctx=null,variant=0;
      for(let attempt=0;attempt<places.length*6;attempt++){
        const candidate=places[(base+attempt*7)%places.length];
        const proposedVariant=(base+attempt)%6;
        const fingerprint='s2:'+spec.key+'|'+candidate.id+'|'+policyNames[proposedVariant];
        const contextSignature=spec.skill+' • '+candidate.title;
        if(!usedPlaces.has(candidate.id)&&!blockedFingerprints.has(fingerprint)&&!blockedContexts.has(contextSignature)){ctx=candidate;variant=proposedVariant;break}
      }
      if(!ctx){
        ctx=places.find(candidate=>!usedPlaces.has(candidate.id))||places[(base+index)%places.length];
        variant=v(round,index,blockedFingerprints,'s2:'+spec.key+'|'+ctx.id);
      }
      usedPlaces.add(ctx.id);
      const card=makeSpec(spec,ctx,variant);
      card.answerFingerprint=card.source+'|'+ctx.id+'|'+card.answerPolicy;
      cards.push(card);
    });
    let choiceIndex=0,startSlot=hash('answer-slot|'+round+'|'+user())%4;
    cards.forEach(card=>{if(card.subtype==='choice'){card.answerSlot=(startSlot+choiceIndex)%4;choiceIndex++;}});
    const slotCounts=[0,1,2,3].map(slot=>cards.filter(card=>card.answerSlot===slot).length);
    const audit={version:'v6.9.6',ok:cards.length===15&&unique(cards.map(card=>card.context))&&unique(cards.map(card=>card.source))&&unique(cards.map(card=>card.conceptKey))&&unique(cards.map(card=>card.promptPattern))&&unique(cards.map(card=>card.answerFingerprint)),contextUnique:new Set(cards.map(card=>card.context)).size,conceptUnique:new Set(cards.map(card=>card.conceptKey)).size,sourceUnique:new Set(cards.map(card=>card.source)).size,promptPatternUnique:new Set(cards.map(card=>card.promptPattern)).size,fingerprintUnique:new Set(cards.map(card=>card.answerFingerprint)).size,answerSlots:slotCounts,choiceCards:choiceIndex};
    if(!audit.ok||slotCounts.sort((a,b)=>a-b).join(',')!=='3,3,3,4')throw new Error('S2_SEMANTIC_DECK_INTEGRITY_FAILED');
    const deck={id:'s2semantic_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8),round,cards,structure:{total:15,mechanic:5,knowledge:8,twist:2},usedWindow:WINDOW,poolSize:{mechanic:5,knowledge:8,twist:2},semanticAudit:audit,answerPositionAudit:{version:'v6.9.6',plannedSlots:slotCounts,noAdjacentDuplicate:true},semanticDiversity:true};
    rounds.push({round,at:Date.now(),deckId:deck.id,contexts:cards.map(card=>card.context),sources:cards.map(card=>card.source),patterns:cards.map(card=>card.promptPattern),fingerprints:cards.map(card=>card.answerFingerprint),slots:cards.filter(card=>card.subtype==='choice').map(card=>card.answerSlot)});history.rounds=rounds.slice(-WINDOW);write(key,history);
    return deck;
  }
  function patch(){
    const api=window.AIQuestS2AgentDeckV672;
    if(!api||api.__semanticDeckV696)return;
    api.__semanticDeckV696=true;api.buildDeck=buildDeck;api.version='v6.9.6';api.semanticDiversity=true;api.semanticDeckReady=true;
  }
  setInterval(patch,60);patch();
})();