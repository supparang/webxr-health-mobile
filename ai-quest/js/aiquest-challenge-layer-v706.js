/* CSAI2102 AI Quest — Challenge Replay Layer v7.1.2.2
   Student Anti-Guess Polish v712.2
   - keeps v711 flow / reflection / Sheet schema intact
   - keeps option length balance from v712.1
   - calibrates S11 so metric questions are challenging but not ambiguous
   - S11 focuses on classification metrics: FP/FN, precision, recall, threshold, confusion matrix
*/
(()=>{'use strict';
  if(window.AIQuestChallengeLayerV7122)return;
  const VERSION='v7.1.2.2';
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
    s11:['Metric mismatch','High-risk threshold','Accuracy trap','Threshold trap','False positive impact','False negative impact','Precision/recall swap','Class imbalance'],
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
  const correctBank={
    s1:['แยกจากหลักฐาน data-model-output','ตรวจว่าเป็น rule หรือ learning','ขอ evidence ก่อนเรียกว่า AI','ดูบทบาท decision support','เทียบ automation กับ AI'],
    s2:['วาง PEAS พร้อม sensor/actuator','ตรวจ sensor confidence ก่อน action','จำกัด scope พร้อม oversight','เก็บ audit trail ของ agent','เลือก safe fallback ตาม risk'],
    s3:['นิยาม state-goal-action ให้ครบ','ตรวจ constraint ก่อนเลือก action','คิด path cost พร้อม failure state','คง goal และตรวจ transition','เลือก action ที่อนุญาตเท่านั้น'],
    s4:['เลือก search ตาม cost และ goal','ใช้ visited set กัน state วนซ้ำ','เทียบ optimality กับ memory risk','ตรวจ frontier order ก่อนหยุด','ใช้ UCS เมื่อ path cost ต่าง'],
    s5:['ใช้ f(n)=g(n)+h(n) พร้อมเหตุผล','ตรวจ admissible ก่อนเชื่อ h(n)','แยก Greedy กับ A* จาก g/h','เทียบ path cost กับ heuristic','เลี่ยง h(n) อย่างเดียว'],
    s6:['ใช้ minimax โดยคิดตาคู่แข่ง','แยก MAX/MIN และ utility sign','เลือก safe move ลด worst case','ตรวจ terminal utility ก่อน prune','ไม่เลือกแต้มสูงสุดทันที'],
    s7:['แยก fact-rule-relation ให้ชัด','ตรวจ relation direction และ entity','รักษา consistency ของ graph','ใส่ exception ก่อน reasoning','ตรวจ rule conflict ก่อนสรุป'],
    s8:['ใช้ prior กับ evidence เพื่ออัปเดต','ดู base rate ก่อนสรุป posterior','สื่อสาร uncertainty พร้อม confidence','ตรวจ likelihood กับหลักฐานใหม่','ไม่เชื่อ evidence เดียวทันที'],
    s9:['ทำ IF-THEN reasoning trace','แยก forward/backward chain','ตรวจ rule conflict และ circular rule','ให้ expert review rule trace','อธิบาย assumption ก่อนสรุป'],
    s10:['แยก train-validation-test ให้ถูก','กัน data leakage และ future feature','ตรวจ feature-label ก่อน train','ใช้ validation จริงก่อนเลือก model','บันทึก pipeline version'],
    s11:['เลือก recall เมื่อต้องลด false negative','เลือก precision เมื่อต้องลด false positive','ใช้ confusion matrix เพื่อดู FP/FN แยกกลุ่ม','ปรับ threshold โดยเทียบ impact ของ FP/FN','ไม่ใช้ accuracy เดียวเมื่อ class imbalance','เลือก metric ตาม risk และเป้าหมายของงาน','ตรวจ error cases ก่อน deploy threshold','เทียบ precision-recall ก่อนสรุปผล'],
    s12:['ตีความ cluster โดยไม่ overclaim','validate cluster และ distance measure','ตรวจ outlier ก่อนลบข้อมูล','ระวัง minority group hidden','ตั้งชื่อกลุ่มหลัง human review'],
    s13:['ดู validation loss ไม่ใช่ train loss อย่างเดียว','ตรวจ overfitting/generalization gap','ไม่เพิ่ม layer เป็นคำตอบทุกกรณี','เทียบ model complexity กับ risk','ใช้ validation set ตรวจความพร้อม'],
    s14:['เทียบคำตอบกับ retrieval evidence','เช็ค citation ให้ตรง source','กัน hallucination และ prompt injection','ตรวจ stale document ก่อนตอบ','ระบุเมื่อหลักฐานไม่พอ'],
    s15:['วาง monitoring หลัง deploy','มี human fallback และ appeal','เก็บ audit trail ของระบบ','ตั้ง governance owner ชัดเจน','ตรวจ drift และ feedback loop'],
    b1:['เชื่อม AI-Agent-Problem ด้วย evidence','ตรวจ AI claim ก่อนเปิดใช้','วาง PEAS และ fallback ก่อน action','หยุดกรณี risk escalation','เก็บเหตุผลให้ human review'],
    b2:['เลือก strategy ตาม cost/heuristic/opponent','เปลี่ยน search เมื่อ constraint เปลี่ยน','ตรวจ heuristic ก่อนใช้ A*','คิด worst-case response ของคู่แข่ง','เทียบ optimality กับ risk'],
    b3:['เชื่อม knowledge-uncertainty-rule trace','แก้ evidence conflict ก่อนสรุป','ให้ expert review reasoning trace','บอก uncertainty พร้อม explanation','ตรวจ circular inference และ prior'],
    b4:['ประเมิน pipeline-metric-bias ก่อน deploy','hold เมื่อ FP/FN หรือ drift เสี่ยง','แยก validation-test ให้ชัด','ตั้ง monitoring และ evaluation review','บันทึก error evidence ตามกลุ่มเสี่ยง'],
    b5:['รวม neural-RAG-governance อย่างปลอดภัย','ตรวจ RAG evidence และ audit trail','มี monitoring human oversight appeal','กัน hallucination ก่อน final deploy','วาง safe deployment ตาม risk']
  };
  const decoyBank={
    all:['ให้ระบบทำต่อถ้า confidence สูง','เก็บ evidence เฉพาะเคสที่มีปัญหา','ให้ human review หลังมีผู้ร้องเรียน','เชื่อ dashboard ถ้าแสดงสถานะสีเขียว','ถือว่า demo ผ่านคือพร้อม deploy','แก้เฉพาะ UI โดยไม่แก้ logic','ใช้ค่าเฉลี่ยรวมแทนตรวจกลุ่มเสี่ยง','ลดขั้นตอนตรวจเพื่อให้ตอบเร็ว'],
    s1:['ถือว่าเป็น AI เพราะชื่อระบบดู smart','สรุปว่า learning จากผลลัพธ์เปลี่ยนเอง','เรียก automation ว่า AI decision maker','เชื่อ vendor claim โดยไม่ดู model','ดู input-output แต่ไม่ดูวิธีสร้างคำตอบ','ตัดสินจากชื่อฟีเจอร์แทนหลักฐาน'],
    s2:['วัด performance ด้วยความเร็วอย่างเดียว','ถือว่า camera เป็น actuator หลัก','เพิ่ม autonomy โดยยังไม่มี fallback','ขยาย scope agent เมื่อเจอเคสใหม่','ใช้ sensor confidence เป็นคำตัดสินสุดท้าย','เก็บ log เฉพาะเคสที่ผ่าน'],
    s3:['เลือก action ที่สั้นที่สุดก่อน','เปลี่ยน goal ถ้าเส้นทางเดิม cost สูง','ข้าม initial state เมื่อมี destination','ดู path cost หลังเลือก action แล้ว','ยอมใช้ forbidden action เมื่อ score สูง','ใช้ transition เดียวกับทุก case'],
    s4:['ใช้ BFS ทุกกรณีเพราะอธิบายง่าย','ใช้ DFS เพราะ memory ต่ำโดยไม่ดู dead-end','หยุดเมื่อเจอ goal แรกโดยไม่ดู cost','ตัด visited set เพื่อลดเวลา','เลือก frontier จากชื่อ node ที่ดูใกล้ goal','ใช้ strategy เดิมแม้ cost เปลี่ยน'],
    s5:['ใช้ h(n) อย่างเดียวเพราะเร็วกว่า','เลือก Greedy ถ้า heuristic ดูน่าเชื่อ','ยอมให้ h overestimate เพื่อเร่งค้นหา','ละเลย g(n) เมื่อทางดูสั้น','ถือว่า admissible ถ้า demo ถูก','คำนวณ f(n) จาก h(n) เท่านั้น'],
    s6:['เลือก move ที่ได้คะแนนทันทีสูงสุด','ถือว่าคู่แข่งตอบแบบสุ่มเสมอ','สลับ MAX/MIN ได้ถ้า score รวมสูง','ใช้ terminal utility จากฝ่ายเราเท่านั้น','prune branch ก่อนดู worst case','ใช้ depth ต่ำเพื่อให้ระบบตอบเร็ว'],
    s7:['บันทึกทุกข้อความเป็น fact','ยอมให้ relation กลับทิศถ้า query ยังเจอ','เพิ่ม rule โดยไม่ตรวจชน rule เดิม','ไม่ใส่ exception เพื่อลดความซับซ้อน','ใช้ ontology กว้างครอบคลุมทุกเรื่อง','รวม entity ใกล้เคียงให้ graph สะอาด'],
    s8:['เชื่อ evidence ล่าสุดมากกว่า base rate เสมอ','ลด prior เป็นศูนย์เมื่อมีเอกสารใหม่','แสดง pass/fail โดยซ่อน uncertainty','ใช้เคสเดียวแทน likelihood','คำนวณ posterior โดยไม่บอก confidence','ให้น้ำหนัก evidence ทุกชนิดเท่ากัน'],
    s9:['ใช้ rule แรกที่ match แล้วหยุด chain','ตอบจาก conclusion ที่อยากได้ก่อน','ซ่อน explanation trace เพื่อไม่ให้สับสน','ยอม circular rule ถ้าผลดูถูก','ให้ expert override โดยไม่บันทึกเหตุผล','ตั้ง rule priority จากความถี่'],
    s10:['เอา test data เข้า train เพื่อเพิ่ม accuracy','ใช้ feature ที่รู้หลังเหตุการณ์เกิดแล้ว','ดู training accuracy เป็นหลักฐานเดียว','ข้าม validation ถ้า dataset เล็ก','สุ่ม split แม้ข้อมูลเป็น time-series','ลบ dirty label ที่ดูแปลกทั้งหมด'],
    s11:['ใช้ accuracy เพราะอธิบายง่ายแต่ไม่ดู class imbalance','เพิ่ม recall สูงสุดโดยไม่ดู false positive impact','เพิ่ม precision สูงสุดโดยไม่ดู false negative impact','ตั้ง threshold จาก default library โดยไม่ดู risk','รายงาน metric เดียวแทน confusion matrix','ตรวจ error เฉพาะ class หลัก ไม่ดู minority class','ใช้ F1-score ทุกเคสแม้ impact ของ FP/FN ไม่เท่ากัน','deploy threshold เดิมกับทุกระดับความเสี่ยง'],
    s12:['ตั้งชื่อ cluster เป็นนิสัยของผู้ใช้','ลบ outlier ทั้งหมดให้ข้อมูลสะอาด','ถือว่าไม่มี bias เพราะไม่มี label','ใช้ distance เดียวโดยไม่เทียบทางเลือก','เชื่อ silhouette score โดยไม่ human review','แปลว่า cluster เดียวกันคือเหมือนกันทุกด้าน'],
    s13:['เพิ่ม layer เพราะโมเดลลึกมักแม่นกว่า','เลือก model จาก training loss ต่ำสุด','ไม่ดู validation ถ้า train curve สวย','ตีความ weight เป็นเหตุผลตรงตัว','train นานขึ้นเพื่อแก้ overfitting','ถือว่า neuron มากคือเข้าใจบริบทดีขึ้น'],
    s14:['เชื่อคำตอบ GenAI ที่เขียนมั่นใจ','ใช้ retrieval ลำดับแรกโดยไม่เทียบ citation','ให้ prompt ผู้ใช้ override policy','ไม่แสดง citation ถ้าเป็นความรู้ทั่วไป','ใช้ source เก่าได้ถ้ายังอยู่ในฐานข้อมูล','ถือว่า RAG กัน hallucination อัตโนมัติ'],
    s15:['deploy ถ้า demo ผ่านและผู้ใช้พอใจ','monitor เฉพาะสัปดาห์แรก','ตัด fallback เพื่อลดภาระเจ้าหน้าที่','ไม่มี appeal เพราะผู้ใช้ถามใหม่ได้','ไม่กำหนด owner ถ้า IT ดูแลรวม','เก็บ audit เฉพาะปัญหาร้ายแรง'],
    b1:['เปิดใช้ถ้ามีคำว่า AI ใน requirement','แก้ PEAS หลัง deploy เมื่อพบ error','ยอมรับ risk ถ้ามีมนุษย์ปลายทาง','ใช้ automation แทน AI โดยไม่บอกผู้ใช้','review เฉพาะเคสคะแนนต่ำ','นิยามปัญหาจาก action ที่ระบบเลือกแล้ว'],
    b2:['ใช้ strategy เดิมเพื่อลดความสับสน','เลือก A* ทุกเคสเพราะทันสมัย','ใช้ heuristic แม้ยังไม่ตรวจ admissible','เลือก path ที่เจอ goal ก่อน','ถือว่าคู่แข่งไม่เลือก worst case','ตัด frontier ที่ดูไม่น่าชนะ'],
    b3:['ใช้ rule-chain แรกที่ตอบได้','ใส่ uncertainty ในคำอธิบายแต่ไม่ใช้ตัดสิน','expert review หลังระบบสรุปแล้ว','ยอม knowledge conflict ถ้า confidence สูง','ซ่อน evidence conflict เพื่อไม่ให้สับสน','ใช้ prior เดิมแม้บริบทเปลี่ยน'],
    b4:['launch เพราะ metric เฉลี่ยสูงกว่าเป้า','hold เฉพาะเมื่อ accuracy ต่ำ','ปรับ threshold จาก feedback ที่ดังที่สุด','ไม่ตรวจ drift ถ้า validation ผ่านแล้ว','ใช้ validation เป็น test ซ้ำ','มองข้าม leakage ถ้าผลดีขึ้น'],
    b5:['เปิดใช้ final system ถ้ามี citation ทุกคำตอบ','governance board ตรวจปีละครั้ง','monitor เฉพาะ uptime ไม่ดู hallucination','ใช้ model confidence แทน human oversight','ไม่มี appeal เพราะถามใหม่ได้','fallback ไป GenAI ทั่วไปเมื่อ retrieval ไม่เจอ']
  };
  const suffixes=['พร้อมหลักฐานในเคส','โดยเทียบกับ impact','และบันทึกเหตุผล','ก่อนปล่อย action','ตามระดับ risk','พร้อม human review'];
  const idOf=x=>String(x||'s1').toLowerCase().replace('m','s').replace('boss','b');
  const hash=s=>{let h=2166136261;String(s).split('').forEach(ch=>{h^=ch.charCodeAt(0);h=Math.imul(h,16777619)});return h>>>0;};
  const read=(k,d)=>{try{const v=JSON.parse(localStorage.getItem(k)||'null');return v==null?d:v}catch(e){return d}};
  const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
  const keyRecent=sid=>'CSAI2102_RECENT_FINGERPRINTS_V7122_'+sid;
  const keyWeak=sid=>'CSAI2102_WEAK_CONCEPTS_V7122_'+sid;
  function recent(sid){return read(keyRecent(sid),[]);}
  function rememberDeck(sid,cards){const now=(cards||[]).map(c=>c.fingerprint||c.id),hist=recent(sid).concat(now).slice(-60);write(keyRecent(sid),hist);}
  function weakConcepts(id){const data=read(keyWeak(idOf(id)),{miss:{}});return Object.entries(data.miss||{}).sort((a,b)=>b[1]-a[1]).slice(0,4).map(x=>x[0]);}
  function rememberMiss(id,cards){const sid=idOf(id),data=read(keyWeak(sid),{miss:{}});(cards||[]).forEach(c=>{data.miss[c.concept]=(data.miss[c.concept]||0)+1});write(keyWeak(sid),data);}
  function slot(i,round){const p=[0,2,1,3,1,0,3,2,0,1,3,2,1,3,0];return p[(i+(round||0))%15];}
  function risk(i,card){let s=i>=13?3:i>=9?2:i>=5?1:0;const t=(card.prompt+' '+card.policy+' '+card.concept).toLowerCase();if(t.includes('rights')||t.includes('privacy')||t.includes('human')||t.includes('safe'))s++;return riskLevels[Math.max(0,Math.min(3,s))];}
  const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
  const len=s=>clean(s).length;
  function pick(pool,key,used,avoid){let start=hash(key)%pool.length;for(let k=0;k<pool.length;k++){let v=clean(pool[(start+k)%pool.length]);if(v&&v!==avoid&&!used.has(v)){used.add(v);return v;}}return clean(pool[start]||'ตรวจหลักฐานในเคส');}
  function makeCorrect(sid,card,i,trap,riskLevel,used){const pool=(correctBank[sid]||correctBank.s1).concat(['ตรวจ '+card.concept+' '+suffixes[i%suffixes.length],'ใช้ '+card.concept+' โดยอิง evidence','แยก '+card.concept+' จากกับดัก '+trap,'ประเมิน '+card.concept+' ตาม '+riskLevel+' risk']);let v=pick(pool,sid+'|ok|'+card.fingerprint+'|'+i,used,'');if(len(v)<28)v+=' '+suffixes[(i+2)%suffixes.length];return clean(v);}
  function makeDistractors(sid,card,i,trap,correct,usedWrong){let near=['ใช้ '+card.concept+' ถ้า confidence สูงพอ','เชื่อผล '+card.policy+' ก่อนแล้วค่อย audit','ตรวจ '+trap+' เฉพาะเมื่อมี complaint','ถือว่า demo ผ่านจึงใช้ได้','บันทึกเหตุผลแบบสั้นโดยไม่แสดง evidence','ให้ระบบ action ก่อนแล้วค่อย review'];
    if(sid==='s11') near=['เลือก metric ที่คะแนนรวมสูงสุดใน dashboard','ใช้ threshold เดิมเพราะเคยผ่าน validation','รายงาน accuracy ถ้าผู้บริหารต้องการตัวเลขเดียว','เพิ่ม recall โดยไม่ประเมิน FP ต่อผู้ใช้','เพิ่ม precision โดยไม่ประเมิน FN ต่อผู้ใช้','รวม FP/FN เป็น error เดียวไม่แยก impact'];
    const pool=(decoyBank[sid]||[]).concat(near).concat(decoyBank.all);const out=[];let start=hash('wrong|'+sid+'|'+card.fingerprint+'|'+i)%pool.length;for(let k=0;k<pool.length&&out.length<3;k++){let v=clean(pool[(start+k)%pool.length]);if(v&&v!==correct&&!out.includes(v)&&!usedWrong.has(v)){out.push(v);usedWrong.add(v);}}
    for(let k=0;out.length<3&&k<pool.length;k++){let v=clean(pool[k]);if(v&&v!==correct&&!out.includes(v))out.push(v);}return out.slice(0,3);}
  function balance(correct,distractors,card,i,riskLevel){let c=clean(correct),ds=distractors.map(clean);const dLens=ds.map(len),minD=Math.min.apply(null,dLens),maxD=Math.max.apply(null,dLens);if(len(c)+8<minD)c=clean(c+' '+suffixes[(i+3)%suffixes.length]);if(len(c)+8<minD)c=clean(c+' ในเคสนี้');if(len(c)>maxD+18)c=c.replace(' พร้อมหลักฐานในเคส','').replace(' โดยเทียบกับ impact','');
    ds=ds.map((d,j)=>{if(len(d)>len(c)+28)d=d.replace('โดยไม่แสดง evidence','').replace('ก่อนแล้วค่อย audit','ภายหลัง').replace('เฉพาะเมื่อมี complaint','ภายหลัง');if(len(d)<len(c)-20)d=clean(d+' ตามเงื่อนไขเดิม');return clean(d);});return {correct:c,distractors:ds};}
  function enhance(raw,id,round){const sid=idOf(id),weak=weakConcepts(sid),usedCorrect=new Set(),usedWrong=new Set();const out=raw.map((card,i)=>{const trap=(traps[sid]||traps.s1)[(i+(round||0))%(traps[sid]||traps.s1).length],riskLevel=risk(i,card);let correct=makeCorrect(sid,card,i,trap,riskLevel,usedCorrect),distractors=makeDistractors(sid,card,i,trap,correct,usedWrong);const b=balance(correct,distractors,card,i,riskLevel);correct=b.correct;distractors=b.distractors;const boss=sid[0]==='b',pressure=i>=13?'FINAL TWIST':i>=10?'PRESSURE':i>=5?'ANALYZE':'BUILD',prefix=boss?'⚔ BOSS • ':'🎮 '+pressure+' • ';
      return {...card,answerSlot:slot(i,round),riskLevel,challengeTrap:trap,challengePressure:pressure,comboTitle:comboTitles[Math.min(comboTitles.length-1,Math.floor(i/3))],challengeVersion:VERSION,correct,distractors,prompt:prefix+'['+riskLevel+' RISK] '+card.prompt+'\nกับดักที่ต้องระวัง: '+trap+(weak.includes(card.concept)?' • Adaptive Weak Skill':''),principle:card.principle+' • หลักเต็ม: '+card.correct+' • v712.2: S11 metric calibrated; option length balanced; no shortest/longest answer bias • Trap: '+trap+' • Risk: '+riskLevel};});
    out.challengeAudit={version:VERSION,noRepeatWindow:'last 4 decks / 60 fingerprints',antiGuessPolish:'v712.2 S11 metric calibration / option length balance / plausible distractors / no shortest-or-longest answer bias',uniqueCorrect:new Set(out.map(c=>c.correct)).size,uniqueDistractors:new Set(out.flatMap(c=>c.distractors)).size,slots:[0,1,2,3].map(s=>out.filter(c=>c.answerSlot===s).length),riskMix:riskLevels.map(r=>out.filter(c=>c.riskLevel===r).length),traps:out.map(c=>c.challengeTrap),weakBoost:weak};return out;}
  function rank(score){let out=ranks[0][0];ranks.forEach(([name,need])=>{if(Number(score)>=need)out=name});return out;}
  function comboTitle(combo){return comboTitles[Math.min(comboTitles.length-1,Math.floor(Number(combo||0)/3))];}
  function patch(){const C=window.AIQuestAllContentV702;if(!C||C.__challengeV7122)return false;const base=C.deck.bind(C);C.deck=function(id,round){const sid=idOf(id),r=Number(round||1),hist=new Set(recent(sid));let raw=[];for(let bump=0;bump<8&&raw.length<15;bump++){const cand=base(sid,r+bump)||[];cand.forEach(c=>{const fp=c.fingerprint||c.id;if(raw.length<15&&!hist.has(fp)&&!raw.find(x=>(x.fingerprint||x.id)===fp))raw.push(c);});}if(raw.length<15){const cand=base(sid,r+99)||[];cand.forEach(c=>{if(raw.length<15&&!raw.find(x=>(x.fingerprint||x.id)===(c.fingerprint||c.id)))raw.push(c);});}const deck=enhance(raw.slice(0,15),sid,r);rememberDeck(sid,deck);return deck;};C.rank=rank;C.comboTitle=comboTitle;C.rememberMiss=rememberMiss;C.challengeLayerVersion=VERSION;C.__challengeV7122=true;C.__challengeV7121=true;C.__challengeV712=true;C.__challengeV706=true;C.version='v7.0.2+challenge712.2';return true;}
  if(!patch())document.addEventListener('DOMContentLoaded',patch,{once:true});
  window.AIQuestChallengeLayerV706={version:VERSION,replayRules:['v712.2 S11 metric calibration','Option length balance','No shortest-answer bias','No longest-answer bias','Plausible session-specific distractors','No repeated correct within deck','No repeated distractor set within deck','4-deck fingerprint no-repeat window','Balanced answer slots'],rank,comboTitle,rememberMiss};
  window.AIQuestChallengeLayerV712=window.AIQuestChallengeLayerV706;
  window.AIQuestChallengeLayerV7121=window.AIQuestChallengeLayerV706;
  window.AIQuestChallengeLayerV7122=window.AIQuestChallengeLayerV706;
})();