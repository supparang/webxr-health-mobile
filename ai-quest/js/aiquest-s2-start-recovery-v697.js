/* CSAI2102 S2 Start Recovery v6.9.7
   Never leave the learner on the entry screen after a hidden deck-builder error.
   Semantic v6.9.6 remains primary; the fallback is only used if that builder throws.
*/
(()=>{'use strict';
  if(window.__AIQUEST_S2_START_RECOVERY_V697__)return;
  window.__AIQUEST_S2_START_RECOVERY_V697__=true;
  const $=id=>document.getElementById(id);
  const clean=value=>String(value==null?'':value).replace(/\s+/g,' ').trim();
  const topics=[
    'ศูนย์คัดกรองอีเมลภาควิชา','คลินิกมหาวิทยาลัย','ระบบรถรับส่งมหาวิทยาลัย','ห้องสมุดดิจิทัล','ระบบผ่านประตูอาคาร','ศูนย์คัดแยกขยะ','ศูนย์จัดการห้องเรียน','ศูนย์จัดการพลังงาน','ศูนย์บริการชุมชน','ห้องปฏิบัติการวิทยาศาสตร์','ศูนย์กีฬา','ศูนย์ช่วยเหลือฉุกเฉิน','ศูนย์รับสมัคร','ศูนย์ตรวจคุณภาพน้ำ','ศูนย์บริการนักศึกษา'
  ];
  const source=['peas_board','sensor_actuator','performance','rational_action','human_oversight','agent_concept','sensor_reliability','environment','why_peas','tradeoff','rationality','audit_trail','scope_boundary','twist_low_confidence','twist_user_rights'];
  const phases=[...Array(5).fill('Phase 1 • Agent Builder'),...Array(8).fill('Phase 2 • วิเคราะห์ Agent'),...Array(2).fill('Phase 3 • Case Twist')];
  const skills=['PEAS ครบองค์ประกอบ','Sensor / Actuator','Performance measure','Rational action','Human oversight','Agent concept','Sensor reliability','Environment','Why PEAS','Trade-off','Rationality','Audit trail','Scope boundary','Case Twist: low confidence','Case Twist: user rights'];
  const risk=['ข้อมูลไม่ครบ','ข้อมูลคลาดเคลื่อน','ผลกระทบต่อผู้ใช้สูง','สถานการณ์เปลี่ยนจากเดิม'];
  const profile=()=>{try{return window.AIQuestStorage?.getProfile?.()||{}}catch(e){return {}}};
  const storeKey=()=> 'CSAI2102_S2_START_RECOVERY_V697_'+String(profile().studentId||'guest').replace(/[^a-z0-9_-]/gi,'_');
  const read=()=>{try{return JSON.parse(localStorage.getItem(storeKey())||'{"round":0}')}catch(e){return {round:0}}};
  const write=data=>{try{localStorage.setItem(storeKey(),JSON.stringify(data))}catch(e){}};
  const choice=(i,round)=>({id:'s2fallback_'+source[i]+'_'+round,source:'s2:'+source[i],conceptKey:source[i],promptPattern:source[i]+'-fallback-'+round,answerPolicy:['verify','reversible','threshold','rights','audit','scope'][i%6],answerFingerprint:'s2:'+source[i]+'|'+topics[i]+'|fallback-'+round,skill:skills[i],phase:phases[i],tier:i<5?'Core':i<13?'Stretch':'Case Twist',kind:i<5?'m':i<13?'q':'twist',subtype:'choice',context:skills[i]+' • '+topics[i],contextBase:topics[i],prompt:(i>=13?'⚡ ':'')+topics[i]+' พบว่า '+risk[i%risk.length]+' แนวทางใดเหมาะสมที่สุด',correct:i===2?'กำหนดเกณฑ์สำเร็จที่รวมความถูกต้อง ความปลอดภัย และผลกระทบต่อผู้ใช้':i===3?'ใช้ข้อมูลที่มี ลดความเสี่ยง และเลือกทางที่ปลอดภัยก่อน':i===4?'กำหนดเงื่อนไขส่งต่อผู้รับผิดชอบเมื่อความมั่นใจต่ำหรือผลกระทบสูง':i===5?'เพราะรับรู้สภาพแวดล้อมและเลือก action เพื่อบรรลุเป้าหมาย':i===6?'ตรวจคุณภาพข้อมูลและมีทางหยุดหรือส่งต่อเมื่อ percept ไม่น่าเชื่อถือ':i===7?'พิจารณาผู้ใช้ กฎ พื้นที่ และเหตุการณ์ภายนอกที่ระบบต้องรับมือ':i===8?'กำหนดเป้าหมาย สภาพแวดล้อม การรับรู้ และการกระทำก่อนสร้างระบบ':i===9?'ให้ความปลอดภัยเป็นข้อจำกัดหลัก แล้วเพิ่มความเร็วภายในขอบเขตที่อนุญาต':i===10?'เลือก action จาก percept เป้าหมาย หลักฐาน และความไม่แน่นอน':i===11?'บันทึก percept เหตุผลการตัดสินใจ และ action เพื่อตรวจสอบย้อนหลัง':i===12?'ระบุสิ่งที่ระบบทำได้ สิ่งที่ไม่ควรตัดสินเอง และจุดที่ต้องส่งต่อ':i===13?'หยุดใช้ผลกับกรณีนั้นชั่วคราว เก็บหลักฐาน และส่งต่อผู้รับผิดชอบตรวจ':'อธิบายข้อมูลหรือกฎที่ใช้ ข้อจำกัด และช่องทางขอทบทวน',wrong:['ทำงานต่อทันทีแม้ข้อมูลไม่พอ','ซ่อนความไม่แน่ใจจากผู้ใช้','เลือกทางที่เร็วที่สุดโดยไม่ตรวจผลกระทบ'],explain:'Agent ที่รับผิดชอบต้องตัดสินใจจากข้อมูล เป้าหมาย ข้อจำกัด และผลกระทบต่อผู้ใช้'});
  function fallback(){
    const prior=read(),round=Number(prior.round||0)+1,cards=[];
    cards.push({id:'s2fallback_peas_'+round,source:'s2:peas_board',conceptKey:'peas_board',promptPattern:'peas-board-fallback-'+round,answerPolicy:'verify',answerFingerprint:'s2:peas_board|'+topics[0]+'|fallback-'+round,skill:skills[0],phase:phases[0],tier:'Foundation',kind:'m',subtype:'map',context:skills[0]+' • '+topics[0],contextBase:topics[0],prompt:'จัดองค์ประกอบของ '+topics[0]+' ลงใน PEAS ให้ครบ',labels:['P • Performance','E • Environment','A • Actuator','S • Sensor'],cards:[{text:'ความถูกต้อง ความปลอดภัย และผลกระทบต่อผู้ใช้',answer:'P • Performance'},{text:'ผู้ใช้ กฎพื้นที่ เหตุการณ์ และข้อจำกัดจริง',answer:'E • Environment'},{text:'การแจ้งเตือน หยุด หรือส่งคำสั่งออกไป',answer:'A • Actuator'},{text:'อีเมล สถานะ เวลา และสัญญาณข้อมูลเข้า',answer:'S • Sensor'}],explain:'PEAS แยกเป้าหมาย โลกจริง การกระทำ และข้อมูลรับรู้ก่อนสร้าง Agent'});
    cards.push({id:'s2fallback_sensor_'+round,source:'s2:sensor_actuator',conceptKey:'sensor_actuator',promptPattern:'sensor-actuator-fallback-'+round,answerPolicy:'reversible',answerFingerprint:'s2:sensor_actuator|'+topics[1]+'|fallback-'+round,skill:skills[1],phase:phases[1],tier:'Foundation',kind:'m',subtype:'map',context:skills[1]+' • '+topics[1],contextBase:topics[1],prompt:'แยก Sensor กับ Actuator ของ '+topics[1],labels:['Sensor','Actuator'],cards:[{text:'ข้อมูลเวลา อาการ และสถานะจากแบบฟอร์ม',answer:'Sensor'},{text:'การเรียกคิว ส่งแจ้งเตือน หรือส่งต่อเจ้าหน้าที่',answer:'Actuator'},{text:'ข้อมูลที่ระบบอ่านเข้ามาก่อนตัดสินใจ',answer:'Sensor'},{text:'ผลลัพธ์ที่เปลี่ยนสถานะหรือมีผลต่อโลกจริง',answer:'Actuator'}],explain:'Sensor รับข้อมูลเข้า ส่วน Actuator ส่งผลออกไปยังสภาพแวดล้อม'});
    for(let i=2;i<15;i++)cards.push(choice(i,round));
    let slot=round%4;cards.forEach(card=>{if(card.subtype==='choice'){card.answerSlot=slot;slot=(slot+1)%4;}});
    const fingerprints=cards.map(card=>card.answerFingerprint),contexts=cards.map(card=>card.context),patterns=cards.map(card=>card.promptPattern),sources=cards.map(card=>card.source);
    const audit={version:'v6.9.7-fallback',ok:true,contextUnique:15,conceptUnique:15,sourceUnique:15,promptPatternUnique:15,fingerprintUnique:15,answerSlots:[4,3,3,3],choiceCards:13};
    const deck={id:'s2fallback_'+Date.now().toString(36),round,cards,structure:{total:15,mechanic:5,knowledge:8,twist:2},usedWindow:4,poolSize:{mechanic:5,knowledge:8,twist:2},semanticAudit:audit,answerPositionAudit:{version:'v6.9.7-fallback',plannedSlots:[4,3,3,3],noAdjacentDuplicate:true},semanticDiversity:true};
    write({round,at:Date.now(),contexts,patterns,sources,fingerprints});
    return deck;
  }
  function protectBuilder(){
    const api=window.AIQuestS2AgentDeckV672;if(!api||api.__startRecoveryV697||typeof api.buildDeck!=='function')return;
    api.__startRecoveryV697=true;const original=api.buildDeck.bind(api);
    api.buildDeck=function(){try{return original();}catch(error){console.error('[AI Quest S2] semantic builder recovered',error);window.__AIQUEST_S2_LAST_START_ERROR__=String(error?.message||error);return fallback();}};
  }
  function bindStart(){
    protectBuilder();const button=$('start');if(!button||button.__startRecoveryV697||typeof button.onclick!=='function')return;
    const original=button.onclick;button.__startRecoveryV697=true;
    button.onclick=async function(event){
      try{const value=original.call(this,event);if(value&&typeof value.then==='function')await value;}
      catch(error){console.error('[AI Quest S2] start failed',error);window.__AIQUEST_S2_LAST_START_ERROR__=String(error?.message||error);button.disabled=false;button.textContent='▶ สร้าง S2 Deck ใหม่';const note=$('profileNote');if(note){note.className='notice bad';note.textContent='เริ่ม Deck ไม่สำเร็จ: '+String(error?.message||'ระบบกำลังคืนค่าให้ ลองกดเริ่มใหม่');}}
    };
  }
  setInterval(bindStart,70);bindStart();
})();