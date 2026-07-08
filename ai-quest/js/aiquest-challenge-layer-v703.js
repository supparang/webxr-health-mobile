/* CSAI2102 AI Quest — Challenge Replay Layer v7.0.3
   Makes every S1-S15 and B1-B5 deck more replayable, exciting, and harder to guess:
   mission-specific traps, boss arcs, risk meter, rank names, combo titles,
   adaptive weak-skill emphasis, and balanced answer slots.
*/
(()=>{'use strict';
  if(window.AIQuestChallengeLayerV703)return;
  const comboTitles=['Insight Spark','Logic Chain','Agent Flow','Reasoning Surge','Boss Break','Perfect Deck'];
  const ranks=[['Rookie Analyst',0],['Junior AI Inspector',60],['Agent Designer',70],['AI Quest Specialist',85],['Foundation / AI Master',95]];
  const riskLevels=['LOW','MEDIUM','HIGH','CRITICAL'];
  const sessionTraps={
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
  const misconceptionWrong={
    s1:['สรุปว่าเป็น AI ทันทีเพราะมีคำว่าอัจฉริยะ','ถือว่าไม่ใช่ AI ทันทีโดยไม่ดูข้อมูลและโมเดล','ดูเฉพาะหน้าจอผู้ใช้ ไม่ตรวจ data-model-output'],
    s2:['ให้ Agent ทำงานเร็วที่สุดแม้ sensor confidence ต่ำ','ถือว่า actuator คือข้อมูลนำเข้า และ sensor คือคำสั่งออก','ปล่อยให้ AI ตัดสินใจทุกกรณีเพื่อลดภาระมนุษย์'],
    s3:['เลือก path ที่สั้นที่สุดเสมอแม้ผิด constraint','เปลี่ยน goal ระหว่างทางเพื่อให้คะแนนดีขึ้น','ไม่ต้องระบุ failure state เพราะมี action ให้เลือกแล้ว'],
    s4:['ใช้ DFS ทุกครั้งเพราะใช้หน่วยความจำน้อยกว่า','ใช้ BFS ทุกครั้งแม้ cost แต่ละทางไม่เท่ากัน','ไม่ต้องเก็บ visited set เพราะจะค้นหาได้ครบเอง'],
    s5:['เลือก h(n) ที่ดูใกล้ที่สุดโดยไม่สนว่า overestimate หรือไม่','คิดว่า Greedy กับ A* เหมือนกันทุกกรณี','ใช้ h(n) อย่างเดียวแทน f(n)=g(n)+h(n)'],
    s6:['เลือกแต้มสูงสุดทันทีโดยไม่คิดตาคู่แข่ง','สลับบทบาท MIN/MAX เมื่อฝ่ายตรงข้ามเลือก','ไม่ต้องดู terminal utility เพราะ action แรกดูดี'],
    s7:['เขียนทุกอย่างเป็น fact โดยไม่ต้องมี relation','ใช้ relation ทิศทางผิดแต่ยังสรุปผลเหมือนเดิม','เพิ่ม rule มาก ๆ โดยไม่ตรวจ consistency'],
    s8:['เชื่อ evidence ล่าสุด 100% โดยไม่ดู prior','มองข้าม base rate เพราะตัวอย่างหนึ่งดูชัด','ซ่อน uncertainty เพื่อให้คำตอบดูมั่นใจ'],
    s9:['ใช้ rule ที่เจอก่อนเสมอแม้ conflict','สรุปผลโดยไม่แสดง reasoning trace','ไม่ต้องมี expert review เมื่อ rule กระทบผู้ใช้'],
    s10:['ใช้ข้อมูล test ไปช่วย train เพื่อให้คะแนนดีขึ้น','เลือก feature ที่มีข้อมูลอนาคตแอบรั่ว','วัดผลจาก training accuracy อย่างเดียว'],
    s11:['ใช้ accuracy อย่างเดียวแม้ class imbalance','ปรับ threshold โดยไม่ดู FP/FN impact','เลือก recall สูงสุดเสมอโดยไม่ดูผลกระทบ'],
    s12:['ตั้งชื่อ cluster เป็นความจริงแน่นอนทันที','ลบ outlier ทั้งหมดโดยไม่ตรวจว่าเป็นเหตุการณ์สำคัญหรือไม่','จัดกลุ่มแล้วถือว่าไม่มี bias'],
    s13:['โมเดลที่ train loss ต่ำสุดย่อมดีที่สุด','เพิ่ม layer เสมอเพื่อแก้ทุกปัญหา','ไม่ต้องมี validation เพราะ neural network เรียนรู้เอง'],
    s14:['เชื่อคำตอบที่เรียบเรียงดีแม้ไม่มี citation','ใช้ retrieval ชิ้นแรกเสมอโดยไม่ตรวจแหล่งที่มา','ปล่อย prompt จากผู้ใช้แก้ policy ของระบบ'],
    s15:['deploy ทันทีเมื่อ demo ผ่าน','ไม่ต้อง monitor ถ้า accuracy เปิดตัวสูง','ไม่มี human fallback เพราะจะทำให้ระบบช้าลง']
  };
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const idOf=x=>String(x||'s1').toLowerCase().replace('m','s').replace('boss','b');
  const read=(k,d)=>{try{const v=JSON.parse(localStorage.getItem(k)||'null');return v==null?d:v}catch(e){return d}};
  const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
  function weakConcepts(id){
    const key='CSAI2102_CHALLENGE_WEAK_V703_'+idOf(id);
    const data=read(key,{miss:{}});
    return Object.entries(data.miss||{}).sort((a,b)=>b[1]-a[1]).slice(0,3).map(x=>x[0]);
  }
  function rememberMiss(id,cards){
    const key='CSAI2102_CHALLENGE_WEAK_V703_'+idOf(id),data=read(key,{miss:{}});
    (cards||[]).forEach(card=>{data.miss[card.concept]=(data.miss[card.concept]||0)+1;});
    write(key,data);
  }
  function plannedSlot(i){return [0,2,1,3,1,0,3,2,0,1,3,2,1,3,0][i%15];}
  function risk(i,card){
    const text=(card.prompt+' '+card.policy+' '+card.concept).toLowerCase();
    let score=i>=13?3:i>=9?2:i>=5?1:0;
    if(text.includes('rights')||text.includes('privacy')||text.includes('human')||text.includes('safe'))score++;
    return riskLevels[clamp(score,0,3)];
  }
  function enhanceCard(id,card,index,total,weak){
    const sid=idOf(id),trapList=sessionTraps[sid]||sessionTraps.s1,trap=trapList[index%trapList.length],riskLevel=risk(index,card),boss=!!(sid[0]==='b'),arc=boss?(bossArc[sid]||[])[index<5?0:index<11?1:2]:null;
    const pressure=index>=13?'FINAL TWIST':index>=10?'PRESSURE':index>=5?'ANALYZE':'BUILD';
    const weakTag=weak.includes(card.concept)?' • Adaptive Weak Skill':'',prefix=boss?'⚔ '+(arc||'Boss Phase')+' • ':'🎮 '+pressure+' • ';
    const wrongBase=misconceptionWrong[sid]||[];
    const wrong=[...(wrongBase.slice(index%Math.max(1,wrongBase.length)).concat(wrongBase)).slice(0,3)];
    while(wrong.length<3)wrong.push((card.distractors||[])[wrong.length]||'เลือกโดยไม่ตรวจหลักฐานและความเสี่ยง');
    return {...card,answerSlot:plannedSlot(index),riskLevel,challengeTrap:trap,challengePressure:pressure,comboTitle:comboTitles[Math.min(comboTitles.length-1,Math.floor(index/3))],challengeVersion:'v7.0.3',prompt:prefix+'['+riskLevel+' RISK] '+card.prompt+'\nกับดักที่ต้องระวัง: '+trap+weakTag,correct:card.correct+' | ต้องระบุเหตุผลและหลักฐานก่อน action',distractors:wrong,principle:card.principle+' • Challenge: '+trap+' • Risk: '+riskLevel};
  }
  function enhanceDeck(id,cards){
    const sid=idOf(id),weak=weakConcepts(sid),deck=(cards||[]).map((card,i)=>enhanceCard(sid,card,i,cards.length,weak));
    deck.challengeAudit={version:'v7.0.3',sessionId:sid,total:deck.length,slots:[0,1,2,3].map(s=>deck.filter(c=>c.answerSlot===s).length),riskMix:riskLevels.map(r=>deck.filter(c=>c.riskLevel===r).length),weakBoost:weak,traps:deck.map(c=>c.challengeTrap)};
    return deck;
  }
  function rank(score){let out=ranks[0][0];ranks.forEach(([name,need])=>{if(Number(score)>=need)out=name;});return out;}
  function comboTitle(combo){return comboTitles[Math.min(comboTitles.length-1,Math.floor(Number(combo||0)/3))];}
  function patch(){
    const C=window.AIQuestAllContentV702;
    if(!C||C.__challengeV703)return false;
    const baseDeck=C.deck.bind(C);
    C.deck=function(id,round){return enhanceDeck(id,baseDeck(id,round));};
    C.rank=rank;C.comboTitle=comboTitle;C.rememberMiss=rememberMiss;C.challengeLayerVersion='v7.0.3';C.__challengeV703=true;C.version=(C.version||'v7.0.2')+'+challenge703';
    return true;
  }
  if(!patch())document.addEventListener('DOMContentLoaded',patch,{once:true});
  window.AIQuestChallengeLayerV703={version:'v7.0.3',enhanceDeck,rank,comboTitle,rememberMiss,sessionTraps,bossArc,replayRules:['Mission-specific misconception traps','Boss story arcs','Risk meter per case','Balanced planned slots','Adaptive weak-skill boost','Combo/rank titles','Reflection bound to selected case']};
})();