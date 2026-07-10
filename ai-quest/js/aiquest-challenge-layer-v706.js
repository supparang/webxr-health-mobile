/* CSAI2102 AI Quest — Challenge Replay Layer v7.1.2
   Student Anti-Guess Polish v712
   - keeps the proven v711 mission flow and Sheet schema intact
   - improves plausible distractors per S/B so learners cannot guess from generic wrong choices
   - reduces repeated weak phrases such as "ไม่ต้องตรวจหลักฐาน" / "เลือกคำตอบที่เร็วที่สุด"
   - keeps balanced answer slots, no-repeat fingerprint window, risk/trap audit, rank, combo title
*/
(()=>{'use strict';
  if(window.AIQuestChallengeLayerV712)return;
  const VERSION='v7.1.2';
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
    all:[
      'ให้ระบบทำต่อได้ถ้าค่า confidence สูงกว่าเกณฑ์เดิม',
      'เก็บ evidence เฉพาะเคสที่ระบบตอบถูกเท่านั้น',
      'ให้ human review เฉพาะตอนมีผู้ใช้ร้องเรียนภายหลัง',
      'ใช้ผลลัพธ์ทันทีถ้า dashboard แสดงสถานะสีเขียว',
      'สรุปว่า deploy ได้เพราะรอบ demo ไม่มี error',
      'ปรับ policy เฉพาะหน้าจอแสดงผลโดยไม่แก้ logic',
      'ใช้ค่าเฉลี่ยรวมแทนการตรวจกลุ่มเสี่ยงหรือ edge case',
      'ลดขั้นตอนตรวจสอบเพื่อให้ระบบตอบสนองเร็วขึ้น'
    ],
    s1:['ถือว่าเป็น AI เพราะมีคำว่า smart ในชื่อระบบ','จัดเป็น learning system จากผลลัพธ์ที่เปลี่ยนตามเวลาอย่างเดียว','สรุปว่าไม่ใช่ AI เพราะยังมีมนุษย์อนุมัติปลายทาง','นับ dashboard รายงานผลเป็น AI โดยไม่ดู model','ดูเฉพาะ input-output แล้วละเลยวิธีสร้างคำตอบ','เรียก rule-based automation ว่า decision maker','เชื่อ vendor claim โดยไม่ขอ evidence','สรุปจากชื่อฟีเจอร์แทน data-model-output'],
    s2:['กำหนด performance เป็นความเร็วอย่างเดียวแม้เสี่ยงผิดพลาด','ถือว่า camera คือ actuator เพราะทำให้ระบบตอบสนอง','เพิ่ม autonomy โดยไม่กำหนด safe fallback','ให้ agent ขยาย scope เมื่อเจอสถานการณ์ใหม่','ใช้ sensor confidence เป็นผลตัดสินสุดท้าย','เก็บ log เฉพาะเคสที่ผ่าน gate','ปล่อย action อัตโนมัติเมื่อคะแนนเกิน threshold','ใช้ PEAS เดิมกับทุก environment'],
    s3:['เลือก action ที่สั้นที่สุดแม้ชน constraint','เปลี่ยน goal ถ้าเส้นทางเดิม cost สูง','ถือว่า initial state ไม่จำเป็นถ้ามี destination','ใช้ path cost หลังเลือก action แล้วเท่านั้น','ไม่บันทึก failure state เพราะเป็นเคสไม่ผ่าน','อนุญาต forbidden action เมื่อ score สูง','ใช้ transition เดียวกับทุก case','เลือก goal ที่ดูง่ายต่อการคำนวณที่สุด'],
    s4:['ใช้ BFS กับทุกปัญหาเพราะเข้าใจง่ายที่สุด','ใช้ DFS เพราะใช้ memory น้อยโดยไม่ดู dead-end','ใช้ UCS แต่ไม่อัปเดต path cost เมื่อเจอทางใหม่','ตัด visited set เพื่อลดเวลาแม้อาจวนซ้ำ','เลือก frontier ที่ดูใกล้ goal จากชื่อ node','ยอมเสีย optimality เพื่อให้ตอบเร็วขึ้นเสมอ','ใช้ strategy เดิมแม้ cost ไม่เท่ากัน','หยุด search เมื่อเจอ goal แรกโดยไม่ดู cost'],
    s5:['ใช้ h(n) อย่างเดียวเพราะเร็วกว่า f(n)','เลือก Greedy ถ้า heuristic ดูน่าเชื่อ','ยอมให้ h(n) overestimate เพื่อเร่งการค้นหา','ละเลย g(n) เมื่อ path ก่อนหน้าดูสั้น','ถือว่า admissible ถ้าผลรอบ demo ถูก','ใช้ A* แต่คำนวณ f(n) จาก h(n) เท่านั้น','เลือก tie-break จาก node ที่ชื่อเหมือนเป้าหมาย','เพิ่ม heuristic หลายตัวโดยไม่ตรวจ consistency'],
    s6:['เลือก move ที่ได้คะแนนทันทีสูงสุด','ถือว่าคู่แข่งจะตอบแบบสุ่มจึงไม่ต้อง minimax','สลับ MAX/MIN ได้ถ้า utility รวมยังสูง','ใช้ terminal utility ที่ออกแบบจากฝ่ายเราเท่านั้น','prune branch ก่อนประเมิน worst case','ใช้ depth limit ต่ำเพื่อให้ระบบตอบเร็วขึ้น','เลือกทางชนะรอบแรกแม้เสียรอบถัดไป','ไม่ตรวจ utility sign เพราะเห็น score เป็นบวก'],
    s7:['บันทึกทุกข้อความเป็น fact เพื่อลดความซับซ้อน','ยอมให้ relation กลับทิศถ้าผล query ยังเจอข้อมูล','เพิ่ม rule ใหม่โดยไม่ตรวจชนกับ rule เดิม','ไม่ระบุ exception เพราะทำให้ ontology ยาว','ใช้ ontology กว้างมากเพื่อครอบคลุมทุกกรณี','รวม entity ใกล้เคียงกันเพื่อให้ graph สะอาด','ถือว่า consistency ผ่านถ้าไม่มี error บนจอ','ข้าม relation direction เพราะผู้ใช้ไม่เห็น graph'],
    s8:['เชื่อหลักฐานใหม่มากกว่า base rate เสมอ','ลด prior เป็นศูนย์เมื่อมี evidence ล่าสุด','แสดงผลเป็น pass/fail โดยซ่อน uncertainty','ใช้เคสตัวอย่างเดียวแทน likelihood','คำนวณ posterior โดยไม่บอก confidence','ให้ evidence ทุกชนิดมีน้ำหนักเท่ากัน','ถือว่าความน่าจะเป็นสูงคือความจริงแน่นอน','ปรับ posterior ตามความรู้สึกของ reviewer'],
    s9:['ใช้ rule แรกที่ match แล้วหยุด chain','ให้ backward chaining ตอบจาก conclusion ที่อยากได้','ข้าม explanation trace เพราะทำให้ผู้ใช้สับสน','ยอมให้ circular rule ถ้าผลสุดท้ายดูถูก','ให้ expert override โดยไม่ต้องบันทึกเหตุผล','ตั้ง rule priority จากความถี่ ไม่ใช่ risk','ถือว่า assumption เป็นจริงจนกว่าจะมีคนค้าน','ซ่อน conflict เพื่อให้ระบบตอบได้ต่อเนื่อง'],
    s10:['ใช้ข้อมูล test รวมใน training เพื่อเพิ่ม accuracy','ใช้ feature ที่รู้หลังเหตุการณ์เกิดแล้ว','ดู training accuracy เป็นหลักฐานว่า pipeline พร้อม','ข้าม validation ถ้า dataset มีจำนวนน้อย','แบ่ง train/test แบบสุ่มแม้เป็น time-series','แก้ dirty label ด้วยการลบแถวที่แปลกทั้งหมด','ใช้ sample ที่เก็บง่ายแทนประชากรจริง','ไม่เก็บ pipeline version เพราะโมเดลเป็นตัวเดียว'],
    s11:['ใช้ accuracy เพราะอธิบายให้ผู้ใช้เข้าใจง่ายที่สุด','เพิ่ม recall ให้สูงสุดโดยไม่ดู false positive impact','ตั้ง threshold จากค่า default ของ library','รายงาน metric เดียวแทน confusion matrix','มองข้าม class imbalance เพราะจำนวนรวมสูง','เลือก precision/recall จากคะแนนที่สวยที่สุด','ตรวจ error เฉพาะ class หลัก ไม่ดู minority class','deploy threshold เดิมกับทุกระดับความเสี่ยง'],
    s12:['ตั้งชื่อ cluster เป็นนิสัยหรือเจตนาของผู้ใช้','ลบ outlier ทั้งหมดเพื่อให้ cluster ดูสะอาด','ถือว่า grouping ไม่มี bias เพราะไม่มี label','ใช้ distance measure เดียวโดยไม่เทียบทางเลือก','ไม่ validate cluster ถ้า silhouette score ดูดี','แปลว่าอยู่ cluster เดียวกันคือเหมือนกันทุกด้าน','มองข้าม minority group ที่ถูกดันเป็น outlier','ใช้ชื่อกลุ่มจากความเห็นของระบบทันที'],
    s13:['เพิ่ม layer เพราะโมเดลลึกมักแม่นกว่า','เลือกโมเดลจาก training loss ต่ำที่สุด','ไม่ต้องดู validation loss ถ้า train curve สวย','ตีความ weight เป็นเหตุผลตรงตัวของคำตอบ','ใช้โมเดลซับซ้อนขึ้นเมื่อ validation แย่ลง','ถือว่า neuron จำนวนมากแปลว่าเข้าใจบริบทดีขึ้น','มองข้าม generalization gap ถ้า demo ผ่าน','แก้ overfitting ด้วยการ train นานขึ้นเสมอ'],
    s14:['เชื่อคำตอบ GenAI ที่เขียนลื่นและมั่นใจ','ใช้เอกสาร retrieval ลำดับแรกโดยไม่เทียบ citation','ปล่อยให้ prompt ผู้ใช้ override policy ได้เมื่อคำถามสุภาพ','ไม่ต้องแสดง citation ถ้าคำตอบเป็นความรู้ทั่วไป','ใช้ source เก่าได้ถ้ายังอยู่ในฐานข้อมูล','ตรวจเฉพาะ citation ที่ระบบให้ confidence สูง','ถือว่า RAG ป้องกัน hallucination ได้อัตโนมัติ','ตอบต่อแม้ retrieval evidence ไม่พอแต่ผู้ใช้รีบ'],
    s15:['deploy ได้ถ้า demo ผ่านและผู้ใช้กลุ่มแรกพอใจ','monitor เฉพาะสัปดาห์แรกหลังเปิดใช้งาน','ตัด human fallback เพื่อลดภาระเจ้าหน้าที่','ไม่มี appeal process เพราะระบบให้คะแนน confidence แล้ว','ไม่กำหนด owner ถ้าทีม IT ดูแลระบบรวมอยู่แล้ว','เก็บ audit trail เฉพาะเคสที่มีปัญหาร้ายแรง','ปล่อย feedback loop ให้โมเดลเรียนรู้เอง','ถือว่า governance เป็นเอกสาร ไม่เกี่ยวกับ runtime'],
    b1:['เปิดใช้ระบบถ้าคำว่า AI อยู่ใน requirement','แก้ PEAS หลัง deploy เมื่อพบ error จริง','ยอมรับ risk escalation ถ้ามีมนุษย์ปลายทาง','ใช้ automation แทน AI โดยไม่บอกผู้ใช้','ให้ human review เฉพาะเคสคะแนนต่ำ','นิยามปัญหาจาก action ที่ระบบเลือกไปแล้ว','เก็บเหตุผลเฉพาะเมื่อผู้ใช้ร้องเรียน','ใช้ fallback เดิมกับทุกระดับ risk'],
    b2:['ใช้ strategy เดิมเพื่อลดความสับสนของผู้เรียน','เลือก A* ทุกเคสเพราะดูทันสมัยกว่า BFS/UCS','ใช้ heuristic แม้ยังไม่ตรวจ admissible','เลือก path ที่เจอ goal ก่อนโดยไม่เทียบ cost','ถือว่าคู่แข่งจะไม่เลือก worst-case response','ตัด frontier ที่ดูไม่น่าชนะเพื่อประหยัดเวลา','ไม่เปลี่ยน strategy แม้ constraint เปลี่ยน','ใช้ utility จากฝ่ายเราโดยไม่ดู opponent'],
    b3:['ใช้ rule-chain แรกที่สร้างคำตอบได้','รวม uncertainty ไว้ในคำอธิบายแต่ไม่ใช้ตัดสินใจ','ให้ expert review หลังระบบสรุปผลแล้วเท่านั้น','ยอมให้ knowledge conflict ถ้า confidence สูง','ซ่อน evidence conflict เพื่อให้ผู้ใช้ไม่สับสน','ใช้ prior เดิมแม้บริบทเปลี่ยนไปแล้ว','ทำ explanation แบบสั้นโดยไม่แสดง rule trace','แก้ circular inference ด้วยการจำกัดเวลาเท่านั้น'],
    b4:['launch model เพราะ metric เฉลี่ยสูงกว่าเป้า','hold เฉพาะเมื่อ accuracy ต่ำ ไม่ดู bias','ปรับ threshold จาก feedback ผู้ใช้เสียงดังที่สุด','ไม่ตรวจ drift ถ้า validation รอบแรกผ่านแล้ว','ใช้ validation set เป็น test ซ้ำเพื่อเทียบรุ่น','มองข้าม leakage suspicion ถ้าผลลัพธ์ดีขึ้น','บันทึกเฉพาะ error ที่ model confidence ต่ำ','ใช้ clustering label เป็นเหตุผล deploy'],
    b5:['เปิดใช้ final system ถ้า RAG มี citation ทุกคำตอบ','ให้ governance board ตรวจปีละครั้งเท่านั้น','monitor เฉพาะ uptime ไม่ตรวจ hallucination','ใช้ neural model confidence แทน human oversight','ไม่มี appeal เพราะผู้ใช้ถามใหม่ได้เสมอ','เก็บ audit trail เฉพาะคำถามที่ถูก block','ถือว่า RAG evidence dispute เป็นปัญหาเอกสาร ไม่ใช่ระบบ','fallback ไป GenAI ทั่วไปเมื่อ retrieval ไม่เจอ']
  };

  const idOf=x=>String(x||'s1').toLowerCase().replace('m','s').replace('boss','b');
  const hash=s=>{let h=2166136261;String(s).split('').forEach(ch=>{h^=ch.charCodeAt(0);h=Math.imul(h,16777619)});return h>>>0;};
  const read=(k,d)=>{try{const v=JSON.parse(localStorage.getItem(k)||'null');return v==null?d:v}catch(e){return d}};
  const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
  const keyRecent=sid=>'CSAI2102_RECENT_FINGERPRINTS_V712_'+sid;
  const keyWeak=sid=>'CSAI2102_WEAK_CONCEPTS_V712_'+sid;
  function recent(sid){return read(keyRecent(sid),[]);}
  function rememberDeck(sid,cards){const now=(cards||[]).map(c=>c.fingerprint||c.id),hist=recent(sid).concat(now).slice(-60);write(keyRecent(sid),hist);}
  function weakConcepts(id){const data=read(keyWeak(idOf(id)),{miss:{}});return Object.entries(data.miss||{}).sort((a,b)=>b[1]-a[1]).slice(0,4).map(x=>x[0]);}
  function rememberMiss(id,cards){const sid=idOf(id),data=read(keyWeak(sid),{miss:{}});(cards||[]).forEach(c=>{data.miss[c.concept]=(data.miss[c.concept]||0)+1});write(keyWeak(sid),data);}
  function slot(i,round){const p=[0,2,1,3,1,0,3,2,0,1,3,2,1,3,0];return p[(i+(round||0))%15];}
  function risk(i,card){let s=i>=13?3:i>=9?2:i>=5?1:0;const t=(card.prompt+' '+card.policy+' '+card.concept).toLowerCase();if(t.includes('rights')||t.includes('privacy')||t.includes('human')||t.includes('safe'))s++;return riskLevels[Math.max(0,Math.min(3,s))];}
  function uniquePush(arr,v,avoid,used){v=String(v||'').replace(/\s+/g,' ').trim();if(!v||v===avoid||arr.includes(v)||used.has(v))return false;arr.push(v);used.add(v);return true;}
  function makeCorrect(sid,card,i,trap,riskLevel,used){const seeds=(seedCorrect[sid]||seedCorrect.s1),extras=['ตรวจ '+card.concept+' ในบริบทนี้','ใช้หลัก '+card.policy+' พร้อมเหตุผล','เทียบหลักฐานกับความเสี่ยงของเคส','ขอข้อมูลเพิ่มก่อนสรุปเรื่อง '+card.concept,'ตั้ง review ก่อน action ตามระดับ '+riskLevel,'เลือกทางปลอดภัยตาม '+riskLevel,'อธิบายเหตุผลจาก context','บันทึกเหตุผลก่อนส่งต่อ','ตรวจกับดัก '+trap,'ประเมิน impact ก่อนตัดสินใจ'];const pool=seeds.concat(extras).map(x=>String(x).replace(/\s+/g,' ').trim()).filter(Boolean);let start=hash(sid+'|'+card.fingerprint+'|'+i)%pool.length;for(let k=0;k<pool.length;k++){const v=pool[(start+k)%pool.length];if(!used.has(v)){used.add(v);return v;}}return pool[start];}
  function nearMisses(sid,card,trap){return [
    'ใช้ '+card.concept+' ได้ถ้า confidence สูงพอโดยยังไม่ต้องตรวจ '+trap,
    'เชื่อผล '+card.policy+' ก่อน แล้วค่อยเก็บ evidence หลังใช้งาน',
    'ถือว่า '+card.concept+' ถูกต้องถ้ารอบ demo ไม่พบ error',
    'ให้ระบบเลือก action จาก '+card.concept+' โดยยังไม่แยก impact',
    'ตรวจ '+trap+' เฉพาะกรณีที่ผู้ใช้ร้องเรียน',
    'บันทึกเหตุผลแบบสรุปสั้นโดยไม่แสดง evidence chain'
  ];}
  function makeDistractors(sid,card,i,trap,correct,usedWrong){const pool=(decoyBase[sid]||[]).concat(nearMisses(sid,card,trap)).concat(decoyBase.all);const out=[];let start=hash('wrong|'+sid+'|'+card.fingerprint+'|'+i)%pool.length;for(let k=0;k<pool.length&&out.length<3;k++)uniquePush(out,pool[(start+k)%pool.length],correct,usedWrong);for(let k=0;out.length<3&&k<pool.length;k++)uniquePush(out,pool[k],correct,new Set());return out.slice(0,3);}
  function enhance(raw,id,round){const sid=idOf(id),weak=weakConcepts(sid),usedCorrect=new Set(),usedWrong=new Set();const out=raw.map((card,i)=>{const trap=(traps[sid]||traps.s1)[(i+(round||0))%(traps[sid]||traps.s1).length],riskLevel=risk(i,card),correct=makeCorrect(sid,card,i,trap,riskLevel,usedCorrect),distractors=makeDistractors(sid,card,i,trap,correct,usedWrong),boss=sid[0]==='b',pressure=i>=13?'FINAL TWIST':i>=10?'PRESSURE':i>=5?'ANALYZE':'BUILD',prefix=boss?'⚔ BOSS • ':'🎮 '+pressure+' • ';
      return {...card,answerSlot:slot(i,round),riskLevel,challengeTrap:trap,challengePressure:pressure,comboTitle:comboTitles[Math.min(comboTitles.length-1,Math.floor(i/3))],challengeVersion:VERSION,correct,distractors,prompt:prefix+'['+riskLevel+' RISK] '+card.prompt+'\nกับดักที่ต้องระวัง: '+trap+(weak.includes(card.concept)?' • Adaptive Weak Skill':''),principle:card.principle+' • หลักเต็ม: '+card.correct+' • v712: ตัวเลือกถูก/ลวงปรับให้ใกล้เคียงจริง ลดการเดาจากคำลวง generic • Trap: '+trap+' • Risk: '+riskLevel};});
    out.challengeAudit={version:VERSION,noRepeatWindow:'last 4 decks / 60 fingerprints',antiGuessPolish:'v712 plausible distractors / reduced generic wrong choices / session-specific near-miss traps',uniqueCorrect:new Set(out.map(c=>c.correct)).size,uniqueDistractors:new Set(out.flatMap(c=>c.distractors)).size,slots:[0,1,2,3].map(s=>out.filter(c=>c.answerSlot===s).length),riskMix:riskLevels.map(r=>out.filter(c=>c.riskLevel===r).length),traps:out.map(c=>c.challengeTrap),weakBoost:weak};return out;}
  function rank(score){let out=ranks[0][0];ranks.forEach(([name,need])=>{if(Number(score)>=need)out=name});return out;}
  function comboTitle(combo){return comboTitles[Math.min(comboTitles.length-1,Math.floor(Number(combo||0)/3))];}
  function patch(){const C=window.AIQuestAllContentV702;if(!C||C.__challengeV712)return false;const base=C.deck.bind(C);C.deck=function(id,round){const sid=idOf(id),r=Number(round||1),hist=new Set(recent(sid));let raw=[];for(let bump=0;bump<8&&raw.length<15;bump++){const cand=base(sid,r+bump)||[];cand.forEach(c=>{const fp=c.fingerprint||c.id;if(raw.length<15&&!hist.has(fp)&&!raw.find(x=>(x.fingerprint||x.id)===fp))raw.push(c);});}if(raw.length<15){const cand=base(sid,r+99)||[];cand.forEach(c=>{if(raw.length<15&&!raw.find(x=>(x.fingerprint||x.id)===(c.fingerprint||c.id)))raw.push(c);});}const deck=enhance(raw.slice(0,15),sid,r);rememberDeck(sid,deck);return deck;};C.rank=rank;C.comboTitle=comboTitle;C.rememberMiss=rememberMiss;C.challengeLayerVersion=VERSION;C.__challengeV712=true;C.__challengeV706=true;C.version='v7.0.2+challenge712';return true;}
  if(!patch())document.addEventListener('DOMContentLoaded',patch,{once:true});
  window.AIQuestChallengeLayerV706={version:VERSION,replayRules:['v712 plausible distractors','Reduced repeated generic wrong choices','Session-specific near-miss traps','No repeated correct within deck','No repeated distractor set within deck','4-deck fingerprint no-repeat window','Balanced answer slots','Risk/trap/adaptive still active'],rank,comboTitle,rememberMiss};
  window.AIQuestChallengeLayerV712=window.AIQuestChallengeLayerV706;
})();