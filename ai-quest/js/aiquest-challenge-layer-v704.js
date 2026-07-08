/* CSAI2102 AI Quest — Challenge Replay Layer v7.0.4
   Fixes answer-length bias: correct choices are now concise, comparable in length,
   and explanations live in feedback/principle instead of the choice text.
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
  const optionBank={
    s1:['ขอหลักฐาน data-model-output ก่อน','เชื่อคำว่า AI แล้วอนุมัติทันที','ปัดทิ้งว่าไม่ใช่ AI โดยไม่ตรวจ','ใช้ผลทันทีและไม่เก็บ log'],
    s2:['ตรวจ sensor แล้วตั้ง oversight','ให้ Agent เร็วที่สุดเสมอ','สลับ sensor กับ actuator','ขยาย scope โดยไม่ขออนุมัติ'],
    s3:['นิยาม state-goal-action ก่อน','เลือกทางสั้นสุดเสมอ','ข้าม constraint เพื่อให้จบเร็ว','เปลี่ยน goal ระหว่างทาง'],
    s4:['เลือก search ให้ตรง cost/goal','ใช้ DFS ทุกเคสเพราะเร็ว','ใช้ BFS แม้ cost ไม่เท่ากัน','ไม่ต้องมี visited set'],
    s5:['ตรวจ g+h และ heuristic ก่อน','ใช้ h อย่างเดียวพอ','เลือก Greedy ทุกสถานการณ์','ใช้ heuristic ที่เดาเกินจริง'],
    s6:['คิดตาคู่แข่งด้วย minimax','เลือกแต้มสูงสุดทันที','สลับบท MIN กับ MAX','ไม่ต้องดู terminal utility'],
    s7:['จัด fact-rule-relation ให้ชัด','เขียนทุกอย่างเป็น fact','ใช้ relation กลับทิศก็ได้','เพิ่ม rule โดยไม่ตรวจชนกัน'],
    s8:['ใช้ prior+evidence อย่างระวัง','เชื่อ evidence ล่าสุด 100%','ทิ้ง base rate ทั้งหมด','ซ่อน uncertainty จากผู้ใช้'],
    s9:['แสดง rule trace ก่อนสรุป','ใช้ rule แรกที่เจอเสมอ','ไม่ต้องอธิบายเหตุผล','ข้าม expert review ทุกเคส'],
    s10:['แยก train/valid/test ให้สะอาด','เอา test ไปช่วย train','ใช้ feature จากอนาคต','ดู training accuracy อย่างเดียว'],
    s11:['ดู metric และ FP/FN impact','ใช้ accuracy อย่างเดียว','ปรับ threshold ตามใจ','เลือก recall สูงสุดเสมอ'],
    s12:['ตรวจ cluster กับ bias ก่อน','ตั้งชื่อ cluster เป็นความจริง','ลบ outlier ทั้งหมด','ถือว่า grouping ไม่มี bias'],
    s13:['ดู validation/generalization','เชื่อ train loss ต่ำสุด','เพิ่ม layer แก้ทุกปัญหา','ไม่ต้องมี validation'],
    s14:['ตรวจ retrieval/citation ก่อนตอบ','เชื่อคำตอบที่เรียบเรียงดี','ใช้เอกสารแรกเสมอ','ให้ prompt ผู้ใช้แก้ policy'],
    s15:['deploy พร้อม monitoring/fallback','ปล่อยใช้หลัง demo ผ่าน','ไม่ monitor หลังเปิดใช้','ตัด human fallback ออก'],
    b1:['หยุดกรณีเสี่ยงแล้วตรวจหลักฐาน','เชื่อระบบเพราะชื่อว่า AI','หยุดทุกระบบโดยไม่แยก risk','ตัดสินโดยไม่เก็บเหตุผล'],
    b2:['เปลี่ยน strategy ตาม cost/risk','ใช้วิธีเดิมทุกสถานการณ์','เชื่อ heuristic โดยไม่ตรวจ','มองข้ามคู่แข่ง/ข้อจำกัด'],
    b3:['เทียบ rule กับ evidence trace','ใช้กฎแรกแม้ชนกัน','ซ่อน uncertainty ในผลลัพธ์','ข้ามคำอธิบายให้ผู้ใช้'],
    b4:['hold deploy ถ้า metric/bias เสี่ยง','deploy เพราะค่าเฉลี่ยดี','แก้ threshold โดยไม่ดู impact','ไม่ตรวจ drift หลังใช้งาน'],
    b5:['เสนอ governance+monitoring+appeal','deploy ทันทีเพื่อโชว์ผล','ไม่ต้องมี audit trail','ให้ GenAI ตัดสินแทนทั้งหมด']
  };
  const idOf=x=>String(x||'s1').toLowerCase().replace('m','s').replace('boss','b');
  const read=(k,d)=>{try{const v=JSON.parse(localStorage.getItem(k)||'null');return v==null?d:v}catch(e){return d}};
  const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
  function weakConcepts(id){const data=read('CSAI2102_CHALLENGE_WEAK_V704_'+idOf(id),{miss:{}});return Object.entries(data.miss||{}).sort((a,b)=>b[1]-a[1]).slice(0,3).map(x=>x[0]);}
  function rememberMiss(id,cards){const key='CSAI2102_CHALLENGE_WEAK_V704_'+idOf(id),data=read(key,{miss:{}});(cards||[]).forEach(c=>{data.miss[c.concept]=(data.miss[c.concept]||0)+1});write(key,data);}
  function plannedSlot(i){return [0,2,1,3,1,0,3,2,0,1,3,2,1,3,0][i%15];}
  function risk(i,card){let s=i>=13?3:i>=9?2:i>=5?1:0;const t=(card.prompt+' '+card.policy+' '+card.concept).toLowerCase();if(t.includes('rights')||t.includes('privacy')||t.includes('human')||t.includes('safe'))s++;return riskLevels[Math.max(0,Math.min(3,s))];}
  function balanced(id){return optionBank[idOf(id)]||optionBank.s1;}
  function enhanceCard(id,card,index,total,weak){
    const sid=idOf(id),trap=(traps[sid]||traps.s1)[index%5],riskLevel=risk(index,card),boss=sid[0]==='b',arc=boss?(bossArc[sid]||[])[index<5?0:index<11?1:2]:null,pressure=index>=13?'FINAL TWIST':index>=10?'PRESSURE':index>=5?'ANALYZE':'BUILD',opts=balanced(sid);
    const prefix=boss?'⚔ '+(arc||'Boss Phase')+' • ':'🎮 '+pressure+' • ';
    return {...card,answerSlot:plannedSlot(index),riskLevel,challengeTrap:trap,challengePressure:pressure,comboTitle:comboTitles[Math.min(comboTitles.length-1,Math.floor(index/3))],challengeVersion:'v7.0.4',correct:opts[0],distractors:opts.slice(1),prompt:prefix+'['+riskLevel+' RISK] '+card.prompt+'\nกับดักที่ต้องระวัง: '+trap+(weak.includes(card.concept)?' • Adaptive Weak Skill':''),principle:card.principle+' • หลักตอบจริง: '+card.correct+' • Trap: '+trap+' • Risk: '+riskLevel};
  }
  function enhanceDeck(id,cards){const sid=idOf(id),weak=weakConcepts(sid),deck=(cards||[]).map((c,i)=>enhanceCard(sid,c,i,cards.length,weak));deck.challengeAudit={version:'v7.0.4',optionBiasFix:'correct choice is concise; explanation moved to feedback',sessionId:sid,total:deck.length,slots:[0,1,2,3].map(s=>deck.filter(c=>c.answerSlot===s).length),riskMix:riskLevels.map(r=>deck.filter(c=>c.riskLevel===r).length),weakBoost:weak,traps:deck.map(c=>c.challengeTrap)};return deck;}
  function rank(score){let out=ranks[0][0];ranks.forEach(([name,need])=>{if(Number(score)>=need)out=name});return out;}
  function comboTitle(combo){return comboTitles[Math.min(comboTitles.length-1,Math.floor(Number(combo||0)/3))];}
  function patch(){const C=window.AIQuestAllContentV702;if(!C||C.__challengeV704)return false;const baseDeck=C.__baseDeckV704||C.deck.bind(C);C.__baseDeckV704=baseDeck;C.deck=(id,round)=>enhanceDeck(id,baseDeck(id,round));C.rank=rank;C.comboTitle=comboTitle;C.rememberMiss=rememberMiss;C.challengeLayerVersion='v7.0.4';C.__challengeV704=true;C.version='v7.0.2+challenge704';return true;}
  if(!patch())document.addEventListener('DOMContentLoaded',patch,{once:true});
  window.AIQuestChallengeLayerV704={version:'v7.0.4',enhanceDeck,rank,comboTitle,rememberMiss,optionBank,replayRules:['No longest-correct bias','Concise correct options','Mission-specific traps','Boss arcs','Risk meter','Adaptive weak-skill boost','Balanced slots']};
})();