/* CSAI2102 AI Quest — Challenge Replay Layer v7.0.6
   v706 fixes within-round repetition and across-round memorization:
   - correct options are generated per concept/trap/risk, not one repeated answer
   - distractors are expanded and rotated per case, not the same 3-option set
   - 4-deck no-repeat fingerprint window per S/B in localStorage
   - answer slots remain balanced; explanation stays in feedback, not choices
*/
(()=>{'use strict';
  if(window.AIQuestChallengeLayerV706)return;
  const VERSION='v7.0.6';
  const riskLevels=['LOW','MEDIUM','HIGH','CRITICAL'];
  const comboTitles=['Insight Spark','Logic Chain','Agent Flow','Reasoning Surge','Boss Break','Perfect Deck'];
  const ranks=[['Rookie Analyst',0],['Junior AI Inspector',60],['Agent Designer',70],['AI Quest Specialist',85],['AI Master',95]];
  const traps={
    s1:['AI by name only','Automation disguised as AI','Rule-based vs learning','Insufficient evidence','Decision support vs decision maker','Data-model mismatch','Hidden human rule','Overclaiming AI'],
    s2:['Sensor confidence trap','Actuator/Sensor swap','Speed vs safety','Missing oversight','Scope creep','Weak audit trail','Wrong performance target','Unsafe autonomy'],
    s3:['Shortest path trap','Goal conflict','Forbidden action','Missing initial state','Cost ignored','Failure state hidden','Constraint conflict','Action not allowed'],
    s4:['BFS memory blow-up','DFS dead-end','UCS cost trap','Visited-set mistake','Completeness vs speed','Repeated state loop','Wrong frontier order','Cost-blind route'],
    s5:['Bad heuristic','Greedy lure','A* f(n) mix-up','Overestimating h(n)','Admissibility trap','Ignoring g(n)','Heuristic overtrust','Tie-break trap'],
    s6:['Greedy move trap','Opponent best response','Terminal utility mistake','Min/Max swap','Unsafe win-now move','Depth-limit blind spot','Wrong utility sign','Pruning too early'],
    s7:['Fact vs rule confusion','Relation direction error','Graph inconsistency','Ontology overreach','Missing exception','Duplicate fact conflict','Rule too broad','Entity mismatch'],
    s8:['Base-rate neglect','Evidence overweight','Prior ignored','Posterior confusion','Uncertainty hidden','Single case fallacy','Likelihood mismatch','Confidence overclaim'],
    s9:['Forward/backward chain swap','Rule conflict','No explanation trace','Expert override missing','Circular rule','Weak evidence chain','Unstated assumption','Rule priority error'],
    s10:['Data leakage','Feature-label mismatch','Bad split','Training-only accuracy','Missing validation','Future data leak','Sampling bias','Dirty labels'],
    s11:['Accuracy trap','Threshold trap','False positive impact','False negative impact','Precision/recall swap','Class imbalance','Metric mismatch','High-risk threshold'],
    s12:['Cluster meaning overclaim','Outlier ignored','Similarity misuse','Bias in grouping','No validation','Wrong distance measure','Cluster naming trap','Minority group hidden'],
    s13:['Overfitting lure','Layer magic myth','Weight interpretation error','Training loss trap','Generalization gap','Validation ignored','Too-complex model','Spurious pattern'],
    s14:['Hallucination trap','Citation mismatch','Prompt injection','Retrieval miss','Unverified generated answer','Weak source grounding','Stale document','Overconfident answer'],
    s15:['No monitoring','Drift ignored','Feedback loop risk','Governance missing','Deployment without fallback','No appeal path','Audit gap','Owner unclear'],
    b1:['Smart Campus crisis','AI claim audit','Agent failure','Problem constraint conflict','Human review gate','Automation overclaim','Risk escalation','Evidence gap'],
    b2:['Route crisis','Heuristic sabotage','Adversarial move','Cost explosion','Search strategy switch','Looping frontier','Bad utility','Constraint change'],
    b3:['Evidence conflict','Rule-chain dispute','Bayes uncertainty','Expert explanation audit','Knowledge conflict','Circular inference','Missing prior','Trace gap'],
    b4:['Model launch pressure','Metric disagreement','Bias complaint','Drift warning','Threshold escalation','Leakage suspicion','Validation failure','Monitoring alert'],
    b5:['Final deployment crisis','GenAI hallucination','Monitoring failure','Ethics appeal','Governance board','Audit challenge','Human fallback failure','RAG evidence dispute']
  };
  const seedCorrect={
    s1:['ตรวจ data-model-output','แยก rule กับ learning','ขอ evidence เพิ่ม','ตรวจ decision support','เทียบ automation กับ AI','ดู model ไม่ใช่ชื่อ','ตรวจแหล่งข้อมูล','ยืนยัน human role'],
    s2:['ตรวจ sensor confidence','วาง PEAS ให้ครบ','แยก sensor-actuator','ตั้ง human oversight','จำกัด scope agent','เก็บ audit trail','วัด performance ให้ตรง','เลือก safe fallback'],
    s3:['นิยาม state-goal','เลือก action ที่อนุญาต','ตรวจ constraint ก่อน','คิด path cost','ระบุ failure state','คง goal เดิม','เลือกทางปลอดภัย','ตรวจ transition'],
    s4:['เลือกตาม cost/goal','ใช้ BFS เมื่อ cost เท่า','ใช้ UCS เมื่อ cost ต่าง','เก็บ visited set','ตรวจ frontier order','เลี่ยง DFS loop','เทียบ optimality','ประเมิน memory risk'],
    s5:['ใช้ f=g+h','ตรวจ heuristic ก่อน','แยก Greedy กับ A*','ดู g และ h พร้อมกัน','ตรวจ admissible','เลี่ยง h อย่างเดียว','เทียบ path cost','อธิบาย heuristic'],
    s6:['คิดตาคู่แข่ง','ใช้ minimax ถูกบท','ดู terminal utility','แยก MIN/MAX','ลด worst-case loss','เลือก safe move','ตรวจ utility sign','ไม่เลือกแต้มทันที'],
    s7:['แยก fact-rule-relation','ตรวจ relation direction','รักษา consistency','ใส่ exception จำเป็น','ตรวจ rule conflict','อธิบาย graph link','จำกัด ontology','ตรวจ entity mapping'],
    s8:['ใช้ prior+evidence','ดู base rate','สรุปพร้อม uncertainty','คำนวณ posterior','ชั่งน้ำหนัก evidence','ตรวจ likelihood','ไม่เชื่อหลักฐานเดียว','บอก confidence level'],
    s9:['ทำ rule trace','แยก forward/backward','ตรวจ rule conflict','อธิบายก่อนสรุป','ให้ expert review','หยุด circular rule','บันทึก inference path','ตรวจ assumption'],
    s10:['แยก train-valid-test','ตัด data leakage','ตรวจ feature-label','ใช้ validation จริง','กัน future data','ตรวจ sampling bias','ดู dirty labels','บันทึก pipeline'],
    s11:['ดู FP/FN impact','เลือก metric ให้ตรงงาน','ปรับ threshold ด้วยเหตุผล','ไม่ใช้ accuracy เดียว','เทียบ precision-recall','ดู class imbalance','อธิบาย error type','เลือกตาม risk'],
    s12:['ตรวจ similarity','ไม่ overclaim cluster','ตรวจ outlier ก่อนลบ','ประเมิน bias grouping','validate cluster','บอก grouping limit','ตรวจ distance measure','ระวัง minority hidden'],
    s13:['ดู validation loss','ตรวจ overfitting','เทียบ generalization','ไม่เพิ่ม layer เสมอ','อธิบาย layer/weight','ใช้ validation set','ดู train-valid gap','เลือกโมเดล generalize'],
    s14:['ตรวจ retrieval evidence','เช็ค citation','กัน hallucination','กัน prompt injection','ใช้แหล่งอ้างอิงตรง','เทียบคำตอบกับ source','ระบุหลักฐานไม่พอ','ตรวจความสดของเอกสาร'],
    s15:['วาง monitoring','มี human fallback','ตรวจ model drift','เก็บ audit trail','ตั้ง governance rule','ประเมิน feedback loop','ไม่ deploy จาก demo','เตรียม appeal process'],
    b1:['ตรวจหลักฐานก่อน','วาง PEAS ก่อนแก้','หยุดกรณีเสี่ยงสูง','แยก AI จาก automation','ส่ง human review','นิยามปัญหาก่อน action','ใช้ safe fallback','เก็บเหตุผลตรวจสอบ'],
    b2:['เปลี่ยน strategy ตาม cost','ตรวจ heuristic ก่อน','คิดคู่แข่งตอบโต้','เทียบ optimality-risk','ใช้ UCS เมื่อ cost ต่าง','ใช้ A* เมื่อ h น่าเชื่อ','ตรวจ search failure','อย่าใช้วิธีเดียวทุกเคส'],
    b3:['เทียบ rule กับ evidence','สร้าง reasoning trace','บอก uncertainty','ตรวจ knowledge conflict','ให้ expert review','ไม่ใช้ rule แรกทันที','อธิบายข้อสรุป','แก้ conflict ก่อนสรุป'],
    b4:['hold deploy เมื่อ bias เสี่ยง','ตรวจ metric หลายมุม','ดู threshold impact','ตรวจ drift warning','แยก validation-test','ดู FP/FN ก่อน launch','บันทึก evaluation','ตั้ง monitoring หลังใช้'],
    b5:['ใส่ governance-monitoring','ตรวจ RAG evidence','มี appeal process','ตั้ง human oversight','กัน hallucination','เฝ้า model drift','เก็บ audit trail','ทำ safe deployment']
  };
  const decoyBase={
    all:['เชื่อระบบทันที','ใช้ผลโดยไม่เก็บ log','ข้าม human review','ดูแค่หน้าจอผู้ใช้','เลือกคำตอบที่เร็วที่สุด','ไม่ต้องตรวจหลักฐาน','ปล่อยระบบทำเองทั้งหมด','ตัดสินจากชื่อระบบ','ซ่อนความไม่แน่ใจ','ไม่ต้องบอกข้อจำกัด','ใช้ rule เดียวทุกเคส','สรุปจากตัวอย่างเดียว'],
    s1:['เชื่อคำว่า AI ทันที','ปัดทิ้งว่าไม่ใช่ AI','เรียก automation ว่า AI เสมอ','ไม่ดู data-model-output','ไม่แยก rule กับ learning','ใช้ผลทันทีไม่ตรวจ','ดูแค่ชื่อระบบ','ไม่ขอข้อมูลเพิ่ม'],
    s2:['ให้ Agent เร็วที่สุด','สลับ sensor กับ actuator','ไม่ตั้ง oversight','ขยาย scope เอง','ลบ audit trail','วัด performance ผิดเป้า','ให้ AI ตัดสินทุกเคส','ไม่ตรวจ sensor confidence'],
    s3:['เลือกทางสั้นสุดเสมอ','ข้าม constraint','เปลี่ยน goal ระหว่างทาง','ไม่ระบุ initial state','ไม่คิด path cost','ไม่ดู failure state','ใช้ action เดิมทุกปัญหา','ละเลย state transition'],
    s4:['ใช้ DFS ทุกเคส','ใช้ BFS ทุกกรณี','ไม่ต้อง visited set','เลือกจากความเร็วอย่างเดียว','ไม่สน cost','ไม่ดู frontier','วน state ซ้ำได้','ไม่เทียบ optimality'],
    s5:['ใช้ h อย่างเดียว','เลือก Greedy เสมอ','ใช้ h ที่เดาเกินจริง','ไม่ดู g cost','ไม่ตรวจ admissible','คิดว่า A* คือ Greedy','ไม่อธิบาย heuristic','เลือกทางดูใกล้ที่สุด'],
    s6:['เลือกแต้มสูงสุดทันที','ไม่คิดตาคู่แข่ง','สลับ MIN/MAX','ไม่ดู terminal utility','prune ก่อนตรวจเงื่อนไข','ใช้ utility ผิดเครื่องหมาย','ไม่คิด worst case','เลือก move ที่ดูชนะทันที'],
    s7:['เขียนทุกอย่างเป็น fact','relation กลับทิศก็ได้','เพิ่ม rule ไม่ตรวจชนกัน','ไม่มี exception','ไม่ตรวจ consistency','ontology กว้างเกินไป','ไม่ระบุ entity','ข้าม graph relation'],
    s8:['เชื่อ evidence ล่าสุด 100%','ทิ้ง base rate','ซ่อน uncertainty','ใช้ตัวอย่างเดียวสรุป','ไม่ดู prior','สับสน posterior','ไม่บอก confidence','ชั่ง evidence เท่ากันหมด'],
    s9:['ใช้ rule แรกที่เจอ','ไม่ต้องอธิบายเหตุผล','ข้าม expert review','ปล่อย circular rule','ไม่บันทึก trace','สับสน forward/backward','ไม่ตรวจ rule conflict','ละเลย assumption'],
    s10:['เอา test ไป train','ใช้ feature อนาคต','ดู train accuracy อย่างเดียว','ไม่ต้อง validation','split ข้อมูลมั่ว','ไม่ดู leakage','ไม่ตรวจ label quality','ใช้ข้อมูลไม่สมดุลโดยไม่แจ้ง'],
    s11:['ใช้ accuracy อย่างเดียว','เลือก recall สูงสุดเสมอ','ปรับ threshold ตามใจ','ไม่ดู FP/FN','ไม่ดู class imbalance','ใช้ metric ไม่ตรงงาน','ไม่คิด impact','สรุปจากค่าเดียว'],
    s12:['ตั้งชื่อ cluster เป็นความจริง','ลบ outlier ทั้งหมด','ถือว่า grouping ไม่มี bias','ไม่ validate cluster','ใช้ distance ผิด','ไม่ดู minority group','ตีความเกินข้อมูล','ไม่ดู similarity'],
    s13:['train loss ต่ำสุดดีที่สุด','เพิ่ม layer แก้ทุกปัญหา','ไม่ต้อง validation','โมเดลลึกย่อมถูกกว่า','ไม่ดู overfitting','เชื่อ weight ตรงตัว','ไม่ดู generalization','ใช้โมเดลซับซ้อนทันที'],
    s14:['เชื่อคำตอบที่ลื่น','ใช้เอกสารแรกพอ','ให้ prompt แก้ policy','ไม่ต้อง citation','ไม่ตรวจ retrieval','ไม่กัน hallucination','ใช้ source เก่าโดยไม่บอก','ตอบแม้หลักฐานไม่พอ'],
    s15:['deploy หลัง demo ผ่าน','ไม่ต้อง monitor','ตัด fallback ออก','ไม่ต้อง audit','ไม่มี governance','ไม่ดู drift','ไม่มี appeal','ไม่ระบุ owner']
  };
  const idOf=x=>String(x||'s1').toLowerCase().replace('m','s').replace('boss','b');
  const hash=s=>{let h=2166136261;String(s).split('').forEach(ch=>{h^=ch.charCodeAt(0);h=Math.imul(h,16777619)});return h>>>0;};
  const read=(k,d)=>{try{const v=JSON.parse(localStorage.getItem(k)||'null');return v==null?d:v}catch(e){return d}};
  const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
  const keyRecent=sid=>'CSAI2102_RECENT_FINGERPRINTS_V706_'+sid;
  const keyWeak=sid=>'CSAI2102_WEAK_CONCEPTS_V706_'+sid;
  function recent(sid){return read(keyRecent(sid),[]);} 
  function rememberDeck(sid,cards){const now=(cards||[]).map(c=>c.fingerprint||c.id),hist=recent(sid).concat(now).slice(-60);write(keyRecent(sid),hist);} 
  function weakConcepts(id){const data=read(keyWeak(idOf(id)),{miss:{}});return Object.entries(data.miss||{}).sort((a,b)=>b[1]-a[1]).slice(0,4).map(x=>x[0]);}
  function rememberMiss(id,cards){const sid=idOf(id),data=read(keyWeak(sid),{miss:{}});(cards||[]).forEach(c=>{data.miss[c.concept]=(data.miss[c.concept]||0)+1});write(keyWeak(sid),data);} 
  function slot(i,round){const p=[0,2,1,3,1,0,3,2,0,1,3,2,1,3,0];return p[(i+(round||0))%15];}
  function risk(i,card){let s=i>=13?3:i>=9?2:i>=5?1:0;const t=(card.prompt+' '+card.policy+' '+card.concept).toLowerCase();if(t.includes('rights')||t.includes('privacy')||t.includes('human')||t.includes('safe'))s++;return riskLevels[Math.max(0,Math.min(3,s))];}
  function makeCorrect(sid,card,i,trap,riskLevel,used){const seeds=(seedCorrect[sid]||seedCorrect.s1),extras=['ตรวจ '+card.concept,'ใช้หลัก '+card.policy,'เทียบหลักฐานในเคส','ขอข้อมูลเพิ่มเรื่อง '+card.concept,'ตั้ง review ก่อน action','เลือกทางปลอดภัยตาม '+riskLevel,'อธิบายเหตุผลจาก context','บันทึกเหตุผลก่อนส่งต่อ','ตรวจ trap: '+trap,'ประเมินผลกระทบก่อน'];const pool=seeds.concat(extras).map(x=>String(x).replace(/\s+/g,' ').trim()).filter(Boolean);let start=hash(sid+'|'+card.fingerprint+'|'+i)%pool.length;for(let k=0;k<pool.length;k++){const v=pool[(start+k)%pool.length];if(!used.has(v)){used.add(v);return v;}}return pool[start];}
  function makeDistractors(sid,card,i,trap,correct,usedWrong){const pool=(decoyBase[sid]||[]).concat(decoyBase.all).concat(['ใช้ '+card.concept+' โดยไม่ตรวจ','เชื่อ '+card.policy+' ทันที','มองข้าม trap '+trap,'ไม่บันทึกเหตุผล','ส่งต่อโดยไม่ระบุ risk','แก้เฉพาะหน้าจอผู้ใช้','สรุปจาก context เดียว','ไม่เทียบทางเลือก']);const out=[];let start=hash('wrong|'+sid+'|'+card.fingerprint+'|'+i)%pool.length;for(let k=0;k<pool.length&&out.length<3;k++){let v=String(pool[(start+k)%pool.length]).trim();if(v&&v!==correct&&!out.includes(v)&&!usedWrong.has(v)){out.push(v);usedWrong.add(v);}}
    for(let k=0;out.length<3&&k<pool.length;k++){let v=String(pool[(start+k)%pool.length]).trim();if(v&&v!==correct&&!out.includes(v))out.push(v);}return out.slice(0,3);}
  function enhance(raw,id,round){const sid=idOf(id),weak=weakConcepts(sid),usedCorrect=new Set(),usedWrong=new Set();const out=raw.map((card,i)=>{const trap=(traps[sid]||traps.s1)[(i+(round||0))%(traps[sid]||traps.s1).length],riskLevel=risk(i,card),correct=makeCorrect(sid,card,i,trap,riskLevel,usedCorrect),distractors=makeDistractors(sid,card,i,trap,correct,usedWrong),boss=sid[0]==='b',pressure=i>=13?'FINAL TWIST':i>=10?'PRESSURE':i>=5?'ANALYZE':'BUILD',prefix=boss?'⚔ BOSS • ':'🎮 '+pressure+' • ';
      return {...card,answerSlot:slot(i,round),riskLevel,challengeTrap:trap,challengePressure:pressure,comboTitle:comboTitles[Math.min(comboTitles.length-1,Math.floor(i/3))],challengeVersion:VERSION,correct,distractors,prompt:prefix+'['+riskLevel+' RISK] '+card.prompt+'\nกับดักที่ต้องระวัง: '+trap+(weak.includes(card.concept)?' • Adaptive Weak Skill':''),principle:card.principle+' • หลักเต็ม: '+card.correct+' • v706: ตัวเลือกถูก/ลวงถูกสร้างใหม่ตาม concept/trap/risk • Trap: '+trap+' • Risk: '+riskLevel};});
    out.challengeAudit={version:VERSION,noRepeatWindow:'last 4 decks / 60 fingerprints',uniqueCorrect:new Set(out.map(c=>c.correct)).size,uniqueDistractors:new Set(out.flatMap(c=>c.distractors)).size,slots:[0,1,2,3].map(s=>out.filter(c=>c.answerSlot===s).length),riskMix:riskLevels.map(r=>out.filter(c=>c.riskLevel===r).length),traps:out.map(c=>c.challengeTrap),weakBoost:weak};return out;}
  function rank(score){let out=ranks[0][0];ranks.forEach(([name,need])=>{if(Number(score)>=need)out=name});return out;}
  function comboTitle(combo){return comboTitles[Math.min(comboTitles.length-1,Math.floor(Number(combo||0)/3))];}
  function patch(){const C=window.AIQuestAllContentV702;if(!C||C.__challengeV706)return false;const base=C.deck.bind(C);C.deck=function(id,round){const sid=idOf(id),r=Number(round||1),hist=new Set(recent(sid));let raw=[];for(let bump=0;bump<8&&raw.length<15;bump++){const cand=base(sid,r+bump)||[];cand.forEach(c=>{const fp=c.fingerprint||c.id;if(raw.length<15&&!hist.has(fp)&&!raw.find(x=>(x.fingerprint||x.id)===fp))raw.push(c);});}if(raw.length<15){const cand=base(sid,r+99)||[];cand.forEach(c=>{if(raw.length<15&&!raw.find(x=>(x.fingerprint||x.id)===(c.fingerprint||c.id)))raw.push(c);});}const deck=enhance(raw.slice(0,15),sid,r);rememberDeck(sid,deck);return deck;};C.rank=rank;C.comboTitle=comboTitle;C.rememberMiss=rememberMiss;C.challengeLayerVersion=VERSION;C.__challengeV706=true;C.version='v7.0.2+challenge706';return true;}
  if(!patch())document.addEventListener('DOMContentLoaded',patch,{once:true});
  window.AIQuestChallengeLayerV706={version:VERSION,replayRules:['Expanded correct/distractor generation','No repeated correct within deck','No repeated distractor set within deck','4-deck fingerprint no-repeat window','Balanced answer slots','Risk/trap/adaptive still active'],rank,comboTitle,rememberMiss};
})();