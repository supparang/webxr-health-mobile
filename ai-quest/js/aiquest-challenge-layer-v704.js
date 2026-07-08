/* CSAI2102 AI Quest — Challenge Replay Layer v7.0.5
   Fixes repeated-correct-answer bias AND answer-length bias:
   each case receives a concept/trap-specific concise correct option,
   comparable-length distractors, balanced slots, risk meter, boss arcs,
   combo/rank titles, and adaptive weak-skill emphasis.
*/
(()=>{'use strict';
  if(window.AIQuestChallengeLayerV704)return;
  const comboTitles=['Insight Spark','Logic Chain','Agent Flow','Reasoning Surge','Boss Break','Perfect Deck'];
  const ranks=[['Rookie Analyst',0],['Junior AI Inspector',60],['Agent Designer',70],['AI Quest Specialist',85],['AI Master',95]];
  const riskLevels=['LOW','MEDIUM','HIGH','CRITICAL'];
  const traps={
    s1:['AI by name only','Automation disguised as AI','Rule-based vs learning','Insufficient evidence','Decision support vs decision maker'],
    s2:['Sensor confidence trap','Actuator/Sensor swap','Speed vs safety','Missing oversight','Scope creep'],
    s3:['Shortest path trap','Goal conflict','Forbidden action','Missing initial state','Cost ignored'],
    s4:['BFS memory blow-up','DFS dead-end','UCS cost trap','Visited-set mistake','Completeness vs speed'],
    s5:['Bad heuristic','Greedy lure','A* f(n) mix-up','Overestimating h(n)','Admissibility trap'],
    s6:['Greedy move trap','Opponent best response','Terminal utility mistake','Min/Max swap','Unsafe win-now move'],
    s7:['Fact vs rule confusion','Relation direction error','Graph inconsistency','Ontology overreach','Missing exception'],
    s8:['Base-rate neglect','Evidence overweight','Prior ignored','Posterior confusion','Uncertainty hidden'],
    s9:['Forward/backward chain swap','Rule conflict','No explanation trace','Expert override missing','Circular rule'],
    s10:['Data leakage','Feature-label mismatch','Bad split','Training-only accuracy','Missing validation'],
    s11:['Accuracy trap','Threshold trap','False positive impact','False negative impact','Precision/recall swap'],
    s12:['Cluster meaning overclaim','Outlier ignored','Similarity misuse','Bias in grouping','No validation'],
    s13:['Overfitting lure','Layer magic myth','Weight interpretation error','Training loss trap','Generalization gap'],
    s14:['Hallucination trap','Citation mismatch','Prompt injection','Retrieval miss','Unverified generated answer'],
    s15:['No monitoring','Drift ignored','Feedback loop risk','Governance missing','Deployment without fallback'],
    b1:['Smart Campus crisis','AI claim audit','Agent failure','Problem constraint conflict','Human review gate'],
    b2:['Route crisis','Heuristic sabotage','Adversarial move','Cost explosion','Search strategy switch'],
    b3:['Evidence conflict','Rule-chain dispute','Bayes uncertainty','Expert explanation audit','Knowledge conflict'],
    b4:['Model launch pressure','Metric disagreement','Bias complaint','Drift warning','Threshold escalation'],
    b5:['Final deployment crisis','GenAI hallucination','Monitoring failure','Ethics appeal','Governance board']
  };
  const bossArc={
    b1:['Phase 1 ตรวจว่าเป็น AI จริงหรือไม่','Phase 2 วาง PEAS และ Agent boundary','Final Twist ข้อมูลขัดกัน ต้องเลือก safe action'],
    b2:['Phase 1 เลือก search strategy','Phase 2 ตรวจ heuristic และ cost','Final Twist คู่แข่ง/ข้อจำกัดเปลี่ยน'],
    b3:['Phase 1 แทนความรู้','Phase 2 สร้าง reasoning trace','Final Twist หลักฐานขัดแย้ง'],
    b4:['Phase 1 ตรวจ pipeline','Phase 2 วิเคราะห์ metric/error/bias','Final Twist deploy หรือ hold'],
    b5:['Phase 1 ออกแบบ AI system','Phase 2 ตรวจ GenAI/RAG/monitoring','Final Twist Governance board ตัดสิน']
  };
  const correctPools={
    s1:['ขอดู data-model-output','แยก rule กับ learning','ตรวจหลักฐานก่อนสรุป','ขอข้อมูลเพิ่มก่อนจัดประเภท','ให้มนุษย์ตัดสินท้าย','ตรวจว่าเป็น decision support','เทียบ automation กับ AI','ดู model ไม่ใช่ชื่อระบบ'],
    s2:['ตรวจ sensor confidence','วาง PEAS ให้ครบ','แยก sensor/actuator','ตั้ง human oversight','จำกัด scope ของ Agent','เก็บ audit trail','เลือก safe fallback','วัด performance ให้ตรง'],
    s3:['นิยาม state ก่อน','กำหนด goal ให้ชัด','เลือก action ที่อนุญาต','ตรวจ constraint ก่อนเดิน','คิด cost ของ path','ระบุ failure state','ไม่เปลี่ยน goal เอง','เลือกทางที่ปลอดภัย'],
    s4:['เลือก BFS เมื่อ cost เท่ากัน','เลือก UCS เมื่อ cost ต่างกัน','ตรวจ frontier ก่อน','เก็บ visited set','เลี่ยง DFS dead-end','เทียบ completeness','เลือกตาม goal และ cost','ประเมิน memory risk'],
    s5:['ใช้ f=g+h','ตรวจ h ไม่เกินจริง','แยก Greedy กับ A*','คิด g ก่อน h','เลือก heuristic ที่อธิบายได้','ตรวจ admissible','เลี่ยง h อย่างเดียว','เทียบ path cost'],
    s6:['คิดตาคู่แข่งก่อน','ใช้ minimax ให้ถูกบท','ดู terminal utility','แยก MIN กับ MAX','เลือก safe move','ลด worst-case loss','ประเมิน opponent response','ไม่เลือกแต้มทันที'],
    s7:['แยก fact-rule-relation','ตรวจ relation direction','ทำ graph ให้ consistent','ใส่ exception ที่จำเป็น','ไม่ overreach ontology','ตรวจ rule conflict','อธิบาย relation','รักษา consistency'],
    s8:['ใช้ prior+evidence','อย่าทิ้ง base rate','สรุปพร้อม uncertainty','คำนวณ posterior','ชั่งน้ำหนัก evidence','ตรวจ likelihood','ไม่เชื่อหลักฐานเดียว','บอกระดับความมั่นใจ'],
    s9:['ทำ rule trace','แยก forward/backward','ตรวจ rule conflict','อธิบายก่อนสรุป','ให้ expert review','หยุด circular rule','ใช้ evidence กับ rule','บันทึก inference path'],
    s10:['แยก train/valid/test','ตัด data leakage','ตรวจ feature-label','ใช้ validation จริง','ไม่ดู train acc อย่างเดียว','กันข้อมูลอนาคต','ตรวจ split ให้สะอาด','บันทึก pipeline'],
    s11:['ดู FP/FN impact','เลือก metric ให้ตรงงาน','ปรับ threshold อย่างมีเหตุผล','ไม่ใช้ accuracy อย่างเดียว','เทียบ precision/recall','ดู class imbalance','อธิบาย error type','เลือก threshold ตาม risk'],
    s12:['ตรวจ similarity ก่อน','อย่าตีความ cluster เกิน','ตรวจ outlier ก่อนลบ','ประเมิน bias ของกลุ่ม','validate cluster','อธิบาย grouping limit','ไม่ตั้งชื่อเป็นความจริง','ตรวจ interpretation risk'],
    s13:['ดู validation loss','ตรวจ overfitting','เทียบ generalization','ไม่เพิ่ม layer เสมอ','อธิบาย weight/layer','ใช้ validation set','ดู gap train-valid','เลือกโมเดลที่ generalize'],
    s14:['ตรวจ retrieval ก่อน','เช็ค citation กับคำตอบ','กัน hallucination','ตรวจ prompt injection','ใช้แหล่งอ้างอิงตรง','อย่าเชื่อคำตอบลื่น','เทียบคำตอบกับ evidence','ระบุเมื่อหลักฐานไม่พอ'],
    s15:['วาง monitoring','มี human fallback','ตรวจ model drift','บันทึก audit trail','ตั้ง governance rule','ประเมิน feedback loop','ไม่ deploy จาก demo อย่างเดียว','เตรียม appeal process'],
    b1:['ตรวจหลักฐานก่อนตัดสิน','วาง PEAS แล้วค่อยแก้','หยุดกรณีเสี่ยงสูง','แยก AI claim ออกจาก automation','ส่ง human review','นิยามปัญหาก่อน action','ใช้ safe fallback','เก็บเหตุผลตรวจสอบ'],
    b2:['เปลี่ยน strategy ตาม cost','ตรวจ heuristic ก่อนใช้','คิดคู่แข่งตอบโต้','เทียบ optimality กับ risk','ใช้ UCS เมื่อ cost ต่าง','ใช้ A* เมื่อ h น่าเชื่อถือ','ตรวจ search failure','อย่าใช้วิธีเดียวทุกเคส'],
    b3:['เทียบ rule กับ evidence','สร้าง reasoning trace','บอก uncertainty','ตรวจ knowledge conflict','ให้ expert review','ไม่ใช้ rule แรกทันที','อธิบายข้อสรุป','แก้ conflict ก่อนสรุป'],
    b4:['hold deploy เมื่อ bias เสี่ยง','ตรวจ metric หลายมุม','ดู threshold impact','ตรวจ drift warning','แยก validation/test','ดู FP/FN ก่อน launch','บันทึก evaluation','ตั้ง monitoring หลังใช้'],
    b5:['ใส่ governance+monitoring','ตรวจ RAG evidence','มี appeal process','ตั้ง human oversight','กัน hallucination','เฝ้า model drift','เก็บ audit trail','ทำ safe deployment']
  };
  const wrongPools={
    s1:['เชื่อคำว่า AI ทันที','ปัดทิ้งโดยไม่ตรวจ','ใช้ผลทันทีไม่เก็บ log','ดูเฉพาะหน้าจอผู้ใช้'],
    s2:['ให้เร็วที่สุดเสมอ','สลับ sensor กับ actuator','ขยาย scope เอง','ตัด human review ออก'],
    s3:['เลือกทางสั้นสุดเสมอ','ข้าม constraint','เปลี่ยน goal ระหว่างทาง','ไม่ระบุ failure state'],
    s4:['ใช้ DFS ทุกเคส','ใช้ BFS ทุกกรณี','ไม่ต้อง visited set','เลือกจากความเร็วอย่างเดียว'],
    s5:['ใช้ h อย่างเดียว','เลือก Greedy เสมอ','ใช้ h ที่เดาเกินจริง','ไม่ดู g cost'],
    s6:['เลือกแต้มสูงสุดทันที','สลับ MIN/MAX','ไม่ดู terminal utility','ไม่คิดตาคู่แข่ง'],
    s7:['เขียนทุกอย่างเป็น fact','relation กลับทิศก็ได้','เพิ่ม rule ไม่ตรวจชนกัน','ไม่ต้องมี exception'],
    s8:['เชื่อ evidence ล่าสุด 100%','ทิ้ง base rate','ซ่อน uncertainty','ใช้ตัวอย่างเดียวสรุป'],
    s9:['ใช้ rule แรกที่เจอ','ไม่ต้องอธิบายเหตุผล','ข้าม expert review','วน rule ซ้ำได้'],
    s10:['เอา test ไป train','ใช้ feature อนาคต','ดู train accuracy อย่างเดียว','ไม่ต้อง validation'],
    s11:['ใช้ accuracy อย่างเดียว','เลือก recall สูงสุดเสมอ','ปรับ threshold ตามใจ','ไม่ดู FP/FN'],
    s12:['ตั้งชื่อ cluster เป็นความจริง','ลบ outlier ทั้งหมด','ถือว่าไม่มี bias','ไม่ต้อง validate'],
    s13:['train loss ต่ำสุดดีที่สุด','เพิ่ม layer แก้ทุกปัญหา','ไม่ต้อง validation','โมเดลลึกย่อมถูกกว่า'],
    s14:['เชื่อคำตอบที่ลื่น','ใช้เอกสารแรกพอ','ให้ prompt แก้ policy','ไม่ต้อง citation'],
    s15:['deploy หลัง demo ผ่าน','ไม่ต้อง monitor','ตัด fallback ออก','ไม่ต้อง audit'],
    b1:['เชื่อชื่อ AI ทันที','หยุดทุกระบบไม่แยก risk','ตัดสินไม่เก็บเหตุผล','ข้าม human review'],
    b2:['ใช้วิธีเดิมทุกเคส','เชื่อ h โดยไม่ตรวจ','มองข้ามคู่แข่ง','ไม่ดู cost'],
    b3:['ใช้กฎแรกเสมอ','ซ่อน uncertainty','ไม่ต้อง trace','ข้ามคำอธิบาย'],
    b4:['deploy เพราะค่าเฉลี่ยดี','ไม่ดู bias','ไม่ monitor drift','ใช้ accuracy เดียว'],
    b5:['deploy ทันที','ให้ GenAI ตัดสินทั้งหมด','ไม่ต้อง appeal','ไม่มี governance']
  };
  const idOf=x=>String(x||'s1').toLowerCase().replace('m','s').replace('boss','b');
  const read=(k,d)=>{try{const v=JSON.parse(localStorage.getItem(k)||'null');return v==null?d:v}catch(e){return d}};
  const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
  function weakConcepts(id){const data=read('CSAI2102_CHALLENGE_WEAK_V705_'+idOf(id),{miss:{}});return Object.entries(data.miss||{}).sort((a,b)=>b[1]-a[1]).slice(0,3).map(x=>x[0]);}
  function rememberMiss(id,cards){const key='CSAI2102_CHALLENGE_WEAK_V705_'+idOf(id),data=read(key,{miss:{}});(cards||[]).forEach(c=>{data.miss[c.concept]=(data.miss[c.concept]||0)+1});write(key,data);}
  function plannedSlot(i){return [0,2,1,3,1,0,3,2,0,1,3,2,1,3,0][i%15];}
  function risk(i,card){let s=i>=13?3:i>=9?2:i>=5?1:0;const t=(card.prompt+' '+card.policy+' '+card.concept).toLowerCase();if(t.includes('rights')||t.includes('privacy')||t.includes('human')||t.includes('safe'))s++;return riskLevels[Math.max(0,Math.min(3,s))];}
  function uniqueDistractors(sid,correct,index){const pool=(wrongPools[sid]||wrongPools.s1).concat(wrongPools.s1);const out=[];for(let k=0;k<pool.length&&out.length<3;k++){const x=pool[(index+k)%pool.length];if(x!==correct&&!out.includes(x))out.push(x);}while(out.length<3)out.push(['ตรวจทีหลัง','เชื่อระบบทันที','ข้ามหลักฐาน'][out.length]);return out;}
  function enhanceCard(id,card,index,total,weak){
    const sid=idOf(id),trap=(traps[sid]||traps.s1)[index%5],riskLevel=risk(index,card),boss=sid[0]==='b',arc=boss?(bossArc[sid]||[])[index<5?0:index<11?1:2]:null,pressure=index>=13?'FINAL TWIST':index>=10?'PRESSURE':index>=5?'ANALYZE':'BUILD';
    const correct=(correctPools[sid]||correctPools.s1)[index%(correctPools[sid]||correctPools.s1).length],distractors=uniqueDistractors(sid,correct,index),prefix=boss?'⚔ '+(arc||'Boss Phase')+' • ':'🎮 '+pressure+' • ';
    return {...card,answerSlot:plannedSlot(index),riskLevel,challengeTrap:trap,challengePressure:pressure,comboTitle:comboTitles[Math.min(comboTitles.length-1,Math.floor(index/3))],challengeVersion:'v7.0.5',correct,distractors,prompt:prefix+'['+riskLevel+' RISK] '+card.prompt+'\nกับดักที่ต้องระวัง: '+trap+(weak.includes(card.concept)?' • Adaptive Weak Skill':''),principle:card.principle+' • หลักตอบจริง: '+card.correct+' • ตัวเลือกถูกถูกย่อให้ไม่เดาจากความยาว • Trap: '+trap+' • Risk: '+riskLevel};
  }
  function enhanceDeck(id,cards){const sid=idOf(id),weak=weakConcepts(sid),deck=(cards||[]).map((c,i)=>enhanceCard(sid,c,i,cards.length,weak));deck.challengeAudit={version:'v7.0.5',optionBiasFix:'correct choice varies per case; explanations moved to feedback',sessionId:sid,total:deck.length,uniqueCorrect:new Set(deck.map(c=>c.correct)).size,slots:[0,1,2,3].map(s=>deck.filter(c=>c.answerSlot===s).length),riskMix:riskLevels.map(r=>deck.filter(c=>c.riskLevel===r).length),weakBoost:weak,traps:deck.map(c=>c.challengeTrap)};return deck;}
  function rank(score){let out=ranks[0][0];ranks.forEach(([name,need])=>{if(Number(score)>=need)out=name});return out;}
  function comboTitle(combo){return comboTitles[Math.min(comboTitles.length-1,Math.floor(Number(combo||0)/3))];}
  function patch(){const C=window.AIQuestAllContentV702;if(!C||C.__challengeV704)return false;const baseDeck=C.__baseDeckV705||C.deck.bind(C);C.__baseDeckV705=baseDeck;C.deck=(id,round)=>enhanceDeck(id,baseDeck(id,round));C.rank=rank;C.comboTitle=comboTitle;C.rememberMiss=rememberMiss;C.challengeLayerVersion='v7.0.5';C.__challengeV704=true;C.version='v7.0.2+challenge705';return true;}
  if(!patch())document.addEventListener('DOMContentLoaded',patch,{once:true});
  window.AIQuestChallengeLayerV704={version:'v7.0.5',enhanceDeck,rank,comboTitle,rememberMiss,correctPools,wrongPools,replayRules:['No repeated correct answer','No longest-correct bias','Concept-specific concise correct options','Mission-specific traps','Boss arcs','Risk meter','Adaptive weak-skill boost','Balanced slots']};
})();