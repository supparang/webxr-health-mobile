/* CSAI2102 AI Quest — S1 Semantic Diversity Deck v6.9.0
   A normal S1 replay deck must vary more than its place name.
   This factory produces 15 distinct concept keys, source keys and prompt patterns:
   5 mechanics + 8 knowledge cases + 2 Case Twists.
*/
(()=>{'use strict';
  if(window.__AIQUEST_S1_SEMANTIC_DIVERSITY_V690__)return;
  window.__AIQUEST_S1_SEMANTIC_DIVERSITY_V690__=true;
  const MID=String(new URLSearchParams(location.search).get('mission')||'s1').toLowerCase();
  if(MID!=='s1'&&MID!=='m1')return;
  const HISTORY='CSAI2102_S1_DIVERSITY_DECKS_V690';
  const tidy=value=>String(value==null?'':value).replace(/\s+/g,' ').trim();
  const clone=value=>JSON.parse(JSON.stringify(value));
  const read=(key,fallback)=>{try{const value=JSON.parse(localStorage.getItem(key)||'null');return value==null?fallback:value}catch(e){return fallback}};
  const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value))}catch(e){}};
  const profile=()=>{try{return window.AIQuestStorage?.getProfile?.()||read('CSAI2102_AIQUEST_PROFILE_V421',{})}catch(e){return {}}};
  const user=()=>String(profile().studentId||'guest').replace(/[^a-z0-9_-]/gi,'_');
  const shuffle=list=>{const copy=[...(list||[])];for(let i=copy.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]]}return copy};
  const hash=value=>{let n=0;for(const ch of String(value||''))n=(n*31+ch.charCodeAt(0))>>>0;return n};
  const places=['ศูนย์คัดกรองอีเมลภาควิชา','ห้องสมุดดิจิทัล','ศูนย์บริการชุมชน','คลินิกมหาวิทยาลัย','ร้านค้าปลีกชุมชน','ระบบรถรับส่งมหาวิทยาลัย','ศูนย์แนะแนวอาชีพ','โรงอาหารอัจฉริยะ','ศูนย์กีฬา','ห้องปฏิบัติการวิทยาศาสตร์','ระบบทุนการศึกษา','ศูนย์บริการนักศึกษา','ศูนย์สุขภาพชุมชน','สำนักงานทะเบียน','ศูนย์ข้อมูลเทศบาล','ศูนย์อาสาสมัคร','โรงพยาบาลสัตว์มหาวิทยาลัย','ศูนย์เรียนรู้ผู้สูงอายุ','ศูนย์จัดการพลังงาน','ศูนย์ควบคุมจราจร','ศูนย์รับแจ้งเหตุ','ศูนย์คัดแยกขยะ','ศูนย์บริการผู้พิการ','ตลาดชุมชนดิจิทัล','ศูนย์ตรวจคุณภาพน้ำ','ศูนย์ดูแลอาคารอัจฉริยะ','ศูนย์จัดการห้องเรียน','ศูนย์ติดตามอุปกรณ์','ศูนย์ช่วยเหลือฉุกเฉิน','ศูนย์ประเมินการเข้าถึงบริการ','ศูนย์จัดการพลังงานสะอาด','ศูนย์วิเคราะห์การเดินทาง','ศูนย์บริการเอกสาร','ศูนย์เรียนรู้วิทยาศาสตร์','ศูนย์ประสานงานอาสา','ศูนย์ดูแลผู้สูงอายุ'];
  const tierName={foundation:'Foundation',core:'Core',stretch:'Stretch'};
  /* The ids deliberately map to the 15 distinct fallback labels in the live engine.
     Do not change their suffixes without also changing the visible-label map. */
  const specs=[
    {id:'s1concept_0_49',concept:'input_quality',label:'ตรวจข้อมูลรับเข้า',kind:'m',tier:'foundation',pattern:'quality-check',prompts:['ภาพจากกล้องของ {place} มีส่วนที่มืดและเบลอ ก่อนนำไปใช้สร้างผลลัพธ์ ควรทำสิ่งใดก่อน','{place} ได้ภาพจากหลายแหล่งแต่ความคมชัดต่างกันมาก ขั้นแรกที่เหมาะสมที่สุดคืออะไร'],correct:'ตรวจคุณภาพและความครบถ้วนของภาพ',wrong:['ใช้ภาพทั้งหมดทันที','เพิ่มความเร็วของเครื่อง','เปลี่ยนสีหน้าจอ'],explain:'คุณภาพของข้อมูลต้นทางมีผลโดยตรงต่อความน่าเชื่อถือของผลลัพธ์'},
    {id:'s1concept_1_39',concept:'learning_criterion',label:'ตั้งเกณฑ์การตัดสินใจ',kind:'m',tier:'foundation',pattern:'criterion-compare',prompts:['ทีมงานของ {place} ต้องแยกระบบที่เรียนจากตัวอย่างออกจากระบบที่ทำตามคำสั่งเดิม เกณฑ์ใดช่วยตัดสินได้ดีที่สุด','เมื่อเปรียบเทียบระบบสองแบบใน {place} ควรถามคำถามใดเพื่อดูว่าระบบใดใช้รูปแบบจากตัวอย่าง'],correct:'ดูว่าระบบปรับผลจากรูปแบบข้อมูลหรือไม่',wrong:['ดูว่าสีของหน้าจอสวยหรือไม่','ดูว่ามีปุ่มกดมากกว่าไหม','ดูว่าเริ่มทำงานเวลาใด'],explain:'ระบบที่เรียนจากตัวอย่างจะใช้รูปแบบของข้อมูลเพื่อสร้างผลสำหรับกรณีใหม่'},
    {id:'s1concept_2_9',concept:'limitations_disclosure',label:'สื่อสารข้อจำกัด',kind:'m',tier:'core',pattern:'disclosure-message',prompts:['ก่อนเปิดใช้บริการที่ {place} ข้อความใดควรแจ้งผู้ใช้ให้เข้าใจขอบเขตของผลที่ระบบให้','{place} ต้องการประกาศผลอย่างตรงไปตรงมา ข้อความแบบใดเหมาะสมที่สุด'],correct:'ผลอาจคลาดเคลื่อนเมื่อเจอสถานการณ์ต่างจากตัวอย่างเดิม',wrong:['ผลถูกต้องทุกครั้ง','ผลใช้แทนการพิจารณาได้เสมอ','ผลไม่ต้องอธิบายที่มา'],explain:'การบอกข้อจำกัดช่วยให้ผู้ใช้ตีความผลอย่างเหมาะสมและไม่คาดหวังเกินจริง'},
    {id:'s1concept_3_8',concept:'user_impact_test',label:'ตรวจผลกระทบต่อผู้ใช้',kind:'m',tier:'core',pattern:'impact-test',prompts:['{place} กำลังทดลองระบบที่อาจมีผลต่อผู้ใช้หลายกลุ่ม ทางเลือกใดรอบคอบที่สุดก่อนนำไปใช้จริง','หากผลลัพธ์ของ {place} อาจทำให้ผู้ใช้บางกลุ่มได้รับบริการต่างกัน ควรดำเนินการอย่างไร'],correct:'ทดสอบผลกับผู้ใช้หลายกลุ่มก่อนใช้จริง',wrong:['เปิดใช้ทันทีทุกกลุ่ม','เลือกใช้เฉพาะผลที่เร็ว','ให้ระบบตัดสินเพียงลำพัง'],explain:'การทดสอบกับผู้ใช้หลายกลุ่มช่วยให้เห็นผลกระทบที่อาจซ่อนอยู่'},
    {id:'s1concept_4_7',concept:'decision_evidence',label:'บันทึกหลักฐาน',kind:'m',tier:'stretch',pattern:'evidence-record',prompts:['เมื่อ {place} ใช้ผลจากโมเดลประกอบการดำเนินงาน ผู้รับผิดชอบควรเก็บอะไรไว้เพื่ออธิบายการตัดสินใจภายหลัง','หลักฐานใดควรจัดเก็บเมื่อ {place} ต้องการให้ผู้อื่นติดตามที่มาของผลลัพธ์ได้'],correct:'เก็บข้อมูลที่ใช้ เหตุผลการตัดสินใจ และผู้รับผิดชอบ',wrong:['เก็บเฉพาะคะแนนสุดท้าย','เก็บเฉพาะรูปหน้าจอ','ลบรายละเอียดเมื่อจบงาน'],explain:'การเก็บหลักฐานและเหตุผลทำให้สามารถทบทวนและรับผิดชอบต่อผลลัพธ์ได้'},
    {id:'s1concept_5_6',concept:'staff_escalation',label:'ส่งต่อ human review',kind:'q',tier:'foundation',pattern:'escalation-route',prompts:['{place} พบผลลัพธ์ที่อาจกระทบการได้รับบริการของบุคคล ทางเลือกใดเหมาะสมที่สุด','เมื่อระบบของ {place} ให้ผลที่มีผลต่อการเข้าถึงบริการ ควรส่งเรื่องไปที่ใดก่อนดำเนินการต่อ'],correct:'ส่งให้เจ้าหน้าที่ผู้รับผิดชอบพิจารณาก่อน',wrong:['ใช้ผลนั้นทันที','ซ่อนผลจากผู้ใช้','ลบผลโดยไม่ตรวจ'],explain:'เรื่องที่กระทบผู้ใช้ควรมีผู้รับผิดชอบพิจารณาเพิ่มเติมก่อนตัดสินใจ'},
    {id:'s1concept_6_5',concept:'missing_information',label:'จัดการข้อมูลไม่ครบ',kind:'q',tier:'core',pattern:'information-gap',prompts:['แบบฟอร์มของ {place} มีช่องว่างสำคัญหลายจุด ก่อนนำผลไปใช้ควรทำอย่างไร','หากข้อมูลต้นทางของ {place} ขาดรายละเอียดที่จำเป็น ทางเลือกใดปลอดภัยกว่า'],correct:'ขอข้อมูลเพิ่มเติมหรือส่งต่อให้เจ้าหน้าที่ตรวจสอบ',wrong:['เดาค่าที่หายไปทันที','ใช้ผลเดิมแทนทุกกรณี','ตัดผู้ใช้ออกจากระบบ'],explain:'ข้อมูลที่ขาดส่วนสำคัญอาจทำให้ผลคลาดเคลื่อน จึงควรเติมข้อมูลหรือให้เจ้าหน้าที่ตรวจสอบ'},
    {id:'s1concept_7_4',concept:'user_rights',label:'คุ้มครองสิทธิ์ผู้ใช้',kind:'q',tier:'core',pattern:'rights-and-appeal',prompts:['{place} ใช้ผลจดจำใบหน้าเพื่อควบคุมการเข้าใช้บริการ ข้อใดคุ้มครองผู้ได้รับผลดีที่สุด','เมื่อผู้ใช้ของ {place} ไม่เห็นด้วยกับผลที่ได้รับ ควรมีช่องทางใด'],correct:'ให้ผู้ได้รับผลขอทบทวนและแก้ไขข้อมูลได้',wrong:['ปิดช่องทางสอบถาม','ยืนยันผลเดิมเสมอ','ให้ระบบเก็บข้อมูลเพิ่มโดยไม่แจ้ง'],explain:'ผู้ได้รับผลควรมีช่องทางตรวจสอบและขอแก้ไขเมื่อข้อมูลหรือผลลัพธ์ไม่ถูกต้อง'},
    {id:'s1concept_8_3',concept:'outcome_verification',label:'ตรวจผลก่อนแจ้ง',kind:'q',tier:'core',pattern:'outcome-verification',prompts:['ก่อนแจ้งผลให้ผู้ใช้ของ {place} ขั้นตอนใดช่วยลดความผิดพลาดได้มากที่สุด','{place} ได้ผลลัพธ์ชุดใหม่จากโมเดล ควรทำอะไรกับผลชุดนั้นก่อนสื่อสารต่อ'],correct:'ตรวจความสมเหตุสมผลของผลกับตัวอย่างจริง',wrong:['ส่งผลออกทันที','เลือกผลที่สั้นที่สุด','เปลี่ยนชื่อผลลัพธ์'],explain:'การตรวจผลกับตัวอย่างจริงช่วยจับความผิดปกติก่อนส่งต่อให้ผู้ใช้'},
    {id:'s1concept_9_2',concept:'option_comparison',label:'เปรียบเทียบทางเลือก',kind:'q',tier:'stretch',pattern:'solution-comparison',prompts:['{place} กำลังเลือกระหว่างวิธีตามคำสั่งล่วงหน้ากับวิธีที่ใช้ตัวอย่างเดิม ควรเปรียบเทียบสิ่งใดก่อน','เมื่อ {place} มีแนวทางสองแบบให้เลือก เกณฑ์ใดช่วยเลือกได้มีเหตุผลที่สุด'],correct:'เปรียบเทียบว่าปัญหาต้องการการเรียนรู้จากข้อมูลหรือไม่',wrong:['เลือกวิธีที่ชื่อยาวกว่า','เลือกวิธีที่เปิดก่อน','เลือกวิธีที่มีสีเด่นกว่า'],explain:'การเลือกแนวทางควรสอดคล้องกับลักษณะปัญหา ไม่ใช่ตัดสินจากรูปลักษณ์ของระบบ'},
    {id:'s1concept_10_2',concept:'edge_case_testing',label:'ทดสอบกรณีพิเศษ',kind:'q',tier:'stretch',pattern:'edge-case-test',prompts:['ก่อนใช้ระบบใน {place} ควรเพิ่มชุดทดสอบแบบใดเพื่อดูว่าระบบรับมือสถานการณ์ต่างจากปกติได้หรือไม่','{place} ต้องการตรวจความพร้อมของระบบในวันที่มีแสงน้อย เสียงรบกวน หรือผู้ใช้หนาแน่น ควรทำสิ่งใด'],correct:'ทดสอบด้วยสถานการณ์หลากหลายที่ใกล้เคียงการใช้งานจริง',wrong:['ทดสอบเฉพาะกรณีง่าย','ใช้ผลเดิมทุกครั้ง','ลดจำนวนตัวอย่างเหลือหนึ่ง'],explain:'การทดสอบหลายสถานการณ์ช่วยให้เห็นข้อจำกัดก่อนระบบถูกนำไปใช้จริง'},
    {id:'s1concept_11_1',concept:'post_recommendation_monitoring',label:'ติดตามผลหลังให้คำแนะนำ',kind:'q',tier:'stretch',pattern:'monitoring-loop',prompts:['หลัง {place} เริ่มเสนอหัวข้อให้ผู้ใช้ ระบบควรติดตามข้อมูลใดเพื่อปรับปรุงคุณภาพต่อเนื่อง','เมื่อ {place} ให้ข้อเสนอแก่ผู้ใช้แล้ว ขั้นตอนใดทำให้รู้ว่าข้อเสนอนั้นเหมาะสมหรือไม่'],correct:'ติดตามผลตอบรับและตรวจว่ามีผลเสียต่อผู้ใช้หรือไม่',wrong:['หยุดดูผลหลังเปิดใช้','นับเฉพาะจำนวนคลิก','เปลี่ยนข้อเสนอแบบสุ่ม'],explain:'การติดตามผลตอบรับช่วยให้เห็นทั้งประโยชน์และผลเสียที่เกิดหลังเริ่มใช้งาน'},
    {id:'s1concept_12_0',concept:'automation_boundary',label:'จำกัดขอบเขตการตัดสินใจอัตโนมัติ',kind:'q',tier:'foundation',pattern:'scope-boundary',prompts:['{place} ต้องกำหนดงานใดให้ระบบทำเองได้ และงานใดต้องส่งต่อผู้รับผิดชอบ หลักใดเหมาะสมที่สุด','ก่อนกำหนดขอบเขตของระบบใน {place} ควรพิจารณาอะไรเป็นอันดับแรก'],correct:'ให้ระบบทำเฉพาะงานที่ความเสี่ยงต่ำและกำหนดเงื่อนไขได้ชัดเจน',wrong:['ให้ระบบทำทุกงาน','ให้ระบบตัดสินเรื่องสำคัญทั้งหมด','ให้ระบบทำงานโดยไม่มีข้อจำกัด'],explain:'การกำหนดขอบเขตที่ชัดเจนช่วยป้องกันการใช้ระบบเกินกว่าหน้าที่ที่เหมาะสม'},
    {id:'s1concept_13_17',concept:'safe_fallback',label:'ใช้ทางเลือกปลอดภัยเมื่อไม่แน่ใจ',kind:'twist_safe',tier:'stretch',pattern:'twist-safe-fallback',prompts:['⚡ สถานการณ์พลิก: {place} พบว่ารูปแบบการใช้งานเปลี่ยนจากเดิมมาก ก่อนดำเนินการต่อควรเลือกทางใด','⚡ สถานการณ์พลิก: ข้อมูลชุดใหม่ของ {place} แตกต่างจากสิ่งที่ระบบเคยพบมาก ควรรับมืออย่างไร'],correct:'หยุดใช้ผลกับกรณีนั้นชั่วคราวและส่งให้ผู้รับผิดชอบตรวจ',wrong:['ใช้ผลเดิมต่อทันที','ลบคำเตือนทั้งหมด','ปรับผลแบบสุ่ม'],explain:'เมื่อสถานการณ์เปลี่ยนมากควรใช้ทางเลือกปลอดภัยก่อน แล้วจึงตรวจสอบหรือปรับปรุงระบบ'},
    {id:'s1concept_14_16',concept:'priority_conditions',label:'จัดลำดับผู้ใช้ตามเงื่อนไข',kind:'twist_priority',tier:'stretch',pattern:'twist-priority-rule',prompts:['⚡ สถานการณ์พลิก: {place} มีผู้ใช้จำนวนมากพร้อมกัน เกณฑ์ใดควรใช้จัดลำดับบริการอย่างเป็นธรรม','⚡ สถานการณ์พลิก: ทรัพยากรของ {place} ไม่พอสำหรับทุกคำขอในเวลาเดียวกัน ควรจัดลำดับด้วยหลักใด'],correct:'ใช้เงื่อนไขที่ประกาศชัดเจนและตรวจสอบได้',wrong:['ให้ผู้ดูแลเลือกตามความชอบ','ให้ระบบเลือกตามสีของหน้าจอ','ให้คำขอใหม่แซงทุกครั้ง'],explain:'การจัดลำดับที่ชัดเจนและตรวจสอบได้ช่วยลดความไม่เป็นธรรมและอธิบายเหตุผลได้'}
  ];
  function makeDeck(){
    const key=HISTORY+'_'+user();
    const history=read(key,{rounds:[]});history.rounds=Array.isArray(history.rounds)?history.rounds.slice(-4):[];
    const round=history.rounds.length?Math.max(...history.rounds.map(row=>Number(row.round)||0))+1:1;
    const blocked=new Set(history.rounds.flatMap(row=>Array.isArray(row.contexts)?row.contexts:[]));
    const usedContexts=new Set();
    const cards=specs.map((spec,index)=>{
      const seed=hash(spec.concept+'|'+round+'|'+index);
      let place='';
      for(let offset=0;offset<places.length*2;offset++){
        const candidate=places[(seed+offset*11)%places.length];
        if(!usedContexts.has(candidate)&&!blocked.has(spec.label+' • '+candidate)){place=candidate;break}
      }
      if(!place)place=places[(seed+index)%places.length];
      usedContexts.add(place);
      const prompt=spec.prompts[(round+index)%spec.prompts.length].replaceAll('{place}',place);
      const phase=index<5?'Phase 1':index<13?'Phase 2':'Phase 3';
      const isTwist=index>=13;
      return {id:spec.id,source:'s1:'+spec.concept,conceptKey:spec.concept,promptPattern:spec.pattern,kind:spec.kind,tier:spec.tier,phase:phase+' • '+tierName[spec.tier]+(isTwist?' • Case Twist':''),context:spec.label+' • '+place,contextBase:place,scenarioFocus:spec.label,contextSignature:spec.label+' • '+place,prompt,correct:spec.correct,wrong:shuffle(spec.wrong).slice(0,3),explain:spec.explain};
    });
    const distinct=(field)=>new Set(cards.map(card=>card[field])).size===cards.length;
    if(!distinct('source')||!distinct('conceptKey')||!distinct('promptPattern')||new Set(cards.map(card=>card.context)).size!==cards.length)throw new Error('S1_DIVERSITY_GATE_FAILED');
    const deck={id:'s1div_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8),round,cards,structure:{boss:false,total:15,mechanic:5,knowledge:8,twist:2},usedWindow:4,pool:{mechanic:5,knowledge:8,twist:2},contextAudit:{version:'v6.9.0',unique:true,count:15,semanticUnique:true,sourceUnique:true,promptPatternUnique:true,conceptCount:15,sourceCount:15,promptPatternCount:15}};
    history.rounds.push({round,at:Date.now(),deckId:deck.id,contexts:cards.map(card=>card.context),sources:cards.map(card=>card.source),concepts:cards.map(card=>card.conceptKey),patterns:cards.map(card=>card.promptPattern)});history.rounds=history.rounds.slice(-4);write(key,history);
    return deck;
  }
  function patch(){
    const api=window.AIQuestReplayFactoryV650;
    if(!api||api.__s1SemanticDiversityV690)return;
    api.__s1SemanticDiversityV690=true;
    api.makeDeck=makeDeck;
    api.version='v6.9.0';api.semanticDiversity=true;
  }
  setInterval(patch,80);patch();
})();