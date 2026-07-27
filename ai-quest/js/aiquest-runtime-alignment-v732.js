/* CSAI2102 AI Quest — Runtime Curriculum Alignment v7.3.2
 * Mutates the already-loaded content object so old cached query strings cannot
 * restore outdated S3/S4 or S14/S15 mappings. Designed for the v711 wrapper.
 */
(()=>{'use strict';
const C=window.AIQuestAllContentV702;
if(!C||C.__runtimeAligned732)return;

const META={
 s1:{code:'S1',block:'B1',title:'AI Spotter',theme:'AI Foundations / AI vs Automation'},
 s2:{code:'S2',block:'B1',title:'Agent Builder',theme:'Intelligent Agents / PEAS'},
 s3:{code:'S3',block:'B1',title:'Search Maze',theme:'Search Fundamentals / BFS / DFS'},
 b1:{code:'B1',block:'B1',title:'Foundation Boss',theme:'AI + Agent + Search Fundamentals',boss:true},
 s4:{code:'S4',block:'B2',title:'Cost Search',theme:'Uniform Cost Search'},
 s5:{code:'S5',block:'B2',title:'Heuristic Planner',theme:'Greedy / A* / Heuristic'},
 s6:{code:'S6',block:'B2',title:'Game Search',theme:'Minimax / Alpha-Beta'},
 b2:{code:'B2',block:'B2',title:'Search Strategy Boss',theme:'UCS + A* + Minimax',boss:true},
 s7:{code:'S7',block:'B3',title:'Knowledge Representation',theme:'Facts / Rules / Inference'},
 s8:{code:'S8',block:'B3',title:'Bayesian Reasoning',theme:'Probability / Bayes'},
 s9:{code:'S9',block:'B3',title:'Expert System',theme:'Logic / Rule-based Expert System'},
 b3:{code:'B3',block:'B3',title:'Reasoning Boss',theme:'Knowledge + Bayes + Expert System',boss:true},
 s10:{code:'S10',block:'B4',title:'ML Pipeline',theme:'Machine Learning Workflow'},
 s11:{code:'S11',block:'B4',title:'Supervised Learning',theme:'Classification / Regression / Metrics'},
 s12:{code:'S12',block:'B4',title:'Unsupervised Discovery',theme:'Clustering / PCA / Evaluation'},
 b4:{code:'B4',block:'B4',title:'ML Evaluation Boss',theme:'End-to-end Machine Learning',boss:true},
 s13:{code:'S13',block:'B5',title:'Neural Network Studio',theme:'Neural Networks / Deep Learning'},
 s14:{code:'S14',block:'B5',title:'Reward Arena',theme:'Reinforcement Learning / Sequential Decisions'},
 s15:{code:'S15',block:'B5',title:'RAG Fact Check',theme:'Generative AI / LLM / RAG'},
 b5:{code:'B5',block:'B5',title:'Trustworthy AI Boss',theme:'Responsible AI / Governance',boss:true}
};

const QA={
 s1:[
  ['AI vs automation','ระบบทำตาม if-else คงที่โดยไม่เรียนจากข้อมูล ควรจำแนกอย่างไร','เป็น rule-based automation เพราะพฤติกรรมมาจากกฎ ไม่ใช่โมเดลที่เรียนจากข้อมูล'],
  ['AI evidence','ระบบอ้างว่าเป็น AI แต่ไม่มีข้อมูลฝึกหรือโมเดลให้ตรวจ ควรสรุปอย่างไร','ยังสรุปว่าเป็น AI ไม่ได้ ต้องตรวจ data, model และ output ก่อน'],
  ['AI-ML-DL','ระบบใช้ neural network ฝึกจากภาพจำนวนมาก จัดอยู่ในความสัมพันธ์ใด','เป็น Deep Learning ซึ่งเป็นส่วนหนึ่งของ Machine Learning และ AI']
 ],
 s2:[
  ['PEAS','ออกแบบหุ่นยนต์ส่งของ ต้องระบุองค์ประกอบใดให้ครบ','ระบุ Performance, Environment, Actuators และ Sensors ให้สัมพันธ์กับภารกิจ'],
  ['Partial observability','Sensor มองเห็นทางเดินไม่ครบ Agent ควรใช้สถาปัตยกรรมใด','ใช้ model-based agent ที่เก็บ internal state จาก percept history'],
  ['Utility','ต้องเลือกระหว่างเร็ว ปลอดภัย และประหยัดพลังงาน ควรทำอย่างไร','ใช้ utility-based agent เปรียบเทียบค่าประโยชน์ของแต่ละ Action']
 ],
 s3:[
  ['BFS','กราฟไม่มีน้ำหนักและต้องการเส้นทางจำนวนก้าวน้อยที่สุด ควรใช้วิธีใด','ใช้ BFS เพราะขยายตามระดับและ Optimal เมื่อ Step cost เท่ากัน'],
  ['DFS','หน่วยความจำจำกัดและไม่ต้องรับประกันเส้นทางสั้นที่สุด ควรพิจารณาอะไร','DFS ใช้ Memory น้อยกว่า แต่ไม่รับประกัน Optimal และอาจหลงในกิ่งลึก'],
  ['Visited','กราฟมี Cycle แล้วโปรแกรมวนซ้ำ ควรแก้ส่วนใด','ใช้ Visited set หรือ repeated-state checking ก่อนเพิ่ม State เข้า Frontier']
 ],
 b1:[
  ['Integration','Agent พบทางถูกปิด ควรเชื่อมส่วนใด','รับ Percept อัปเดต State ตรวจ Goal แล้วเรียก BFS หรือ DFS ตามเงื่อนไข'],
  ['Safety','Sensor หายระหว่างวางแผน ควรทำอย่างไร','ใช้ Safe fallback ไม่เดาสถานะ และขอ Human review'],
  ['Evidence','ก่อนเรียกระบบว่า AI ต้องตรวจอะไร','ตรวจ Data, Model, Rules, Output และขอบเขต Autonomy']
 ],
 s4:[
  ['UCS','เส้นทางมีค่าผ่านทางต่างกัน ควรเรียง Frontier ด้วยค่าใด','เรียง Priority queue ด้วย cumulative path cost g(n) และขยายต้นทุนต่ำสุดก่อน'],
  ['Best cost','พบ State เดิมด้วยต้นทุนใหม่ที่ต่ำกว่า ควรทำอย่างไร','อัปเดต Best cost และ Parent แล้วใส่รายการต้นทุนต่ำกว่าเข้า Priority queue'],
  ['Optimality','UCS รับประกันเส้นทางต้นทุนต่ำสุดเมื่อใด','เมื่อ Step cost ไม่ติดลบและจัดการ Frontier ตาม cumulative cost ถูกต้อง']
 ],
 s5:[
  ['A*','ต้องใช้ต้นทุนจริงและค่าประมาณพร้อมกัน ควรใช้ค่าใด','ใช้ f(n)=g(n)+h(n) ใน A*'],
  ['Admissible','Heuristic สูงกว่าค่าจริงอาจเกิดผลใด','A* อาจไม่รับประกัน Optimality เพราะ Heuristic ไม่ Admissible'],
  ['Consistency','ต้องตรวจ Heuristic ทุก Edge ด้วยเงื่อนไขใด','ตรวจ h(n) ไม่เกิน Cost ของ Edge บวก h(n ถัดไป)']
 ],
 s6:[
  ['Minimax','คู่แข่งเล่นอย่างเหมาะสม MAX ควรเลือกอย่างไร','เลือก Action ที่ให้ค่าต่ำสุดที่รับประกันได้สูงที่สุดตาม Minimax'],
  ['Alpha-beta','เมื่อ beta ไม่เกิน alpha ควรทำอย่างไร','ตัดกิ่งที่เหลือได้เพราะไม่เปลี่ยนคำตอบ Minimax'],
  ['Evaluation','ค้นไม่ถึง Terminal เพราะ Depth limit ควรใช้อะไร','ใช้ Evaluation function ประเมิน State ที่ Cutoff และระบุข้อจำกัด']
 ],
 b2:[
  ['Strategy','Weighted graph มี Heuristic ที่ Admissible ควรเลือกอะไร','ใช้ A* เพื่อรวม Cost กับ Heuristic และคง Optimality เมื่อเงื่อนไขครบ'],
  ['Opponent','ปัญหามีคู่แข่งตอบโต้ ควรใช้วิธีใด','ใช้ Minimax หรือ Adversarial search ไม่ใช้ Shortest path เพียงอย่างเดียว'],
  ['Trade-off','Memory ต่ำแต่ต้อง Optimal เสมอ ควรทำอย่างไร','อธิบายข้อขัดแย้งและเลือก Algorithm พร้อมข้อจำกัดอย่างโปร่งใส']
 ],
 s7:[
  ['Forward chaining','มี Facts แล้วต้องการอนุมานข้อสรุปทั้งหมด ควรใช้วิธีใด','ใช้ Forward chaining เริ่มจาก Known facts แล้ว Fire rules ที่เงื่อนไขครบ'],
  ['Backward chaining','มี Query เป้าหมายและต้องตรวจว่าพิสูจน์ได้หรือไม่ ควรใช้วิธีใด','ใช้ Backward chaining ย้อนจาก Goal ไปยัง Facts ที่ต้องการ'],
  ['Conflict','กฎ Bird implies Fly ขัดกับ Penguin implies Not fly ควรทำอย่างไร','เพิ่ม Exception หรือ Priority และบันทึก Explanation trace']
 ],
 s8:[
  ['Bayes','ต้องอัปเดตโอกาสหลังพบหลักฐาน ควรคำนวณค่าใด','คำนวณ Posterior จาก Prior, Likelihood และ Evidence ด้วย Bayes theorem'],
  ['Base rate','ผลตรวจแม่นแต่เหตุการณ์พบได้น้อย เหตุใด Positive จึงไม่แน่นอน','ต้องคำนึงถึง Prior หรือ Base rate และ False positive'],
  ['Bayes net','ตัวแปรหลายตัวมี Dependency ควรแทนอย่างไร','ใช้ Bayesian network และ Conditional probability ตามโครงสร้าง Dependency']
 ],
 s9:[
  ['Inference trace','ระบบให้คำแนะนำแต่ไม่บอกเหตุผล ควรเพิ่มอะไร','คืน Matched rule, Facts ที่ทำให้ Rule fire และ Explanation trace'],
  ['Conflict resolution','หลาย Rule ให้คำแนะนำขัดกัน ควรทำอย่างไร','กำหนด Priority, Specificity หรือ Confidence และส่งต่อ Expert เมื่อยังขัดแย้ง'],
  ['Human referral','ข้อมูลไม่ครบหรือความเสี่ยงสูง ควรตอบอย่างไร','งดสรุปเด็ดขาด แสดงข้อจำกัด และส่งต่อผู้เชี่ยวชาญมนุษย์']
 ],
 b3:[
  ['Logic and probability','Rule บอกเสี่ยงแต่ Posterior ต่ำ ควรทำอย่างไร','แยก Rule evidence กับ Probabilistic evidence แสดง Conflict และไม่สรุปเกินหลักฐาน'],
  ['Confidence','Decision object ควรมีอะไร','มี Decision, Confidence, Evidence, Explanation และ Referral เมื่อไม่แน่ใจ'],
  ['Conflict','Facts หรือ Rules ขัดกัน ควรทำอย่างไร','ตรวจ Consistency แสดง Trace และให้ Expert review ก่อนตัดสิน']
 ],
 s10:[
  ['Leakage','ทำ Normalization ด้วยข้อมูลรวมก่อน Split ผิดอย่างไร','เกิด Data leakage เพราะ Test information ไหลเข้า Preprocessing ของ Train'],
  ['Split','Validation และ Test มีหน้าที่ต่างกันอย่างไร','Validation ใช้เลือก Model หรือ Hyperparameter ส่วน Test ใช้ประเมินสุดท้าย'],
  ['Reproducibility','ผลแบ่งข้อมูลเปลี่ยนทุกครั้ง ควรเพิ่มอะไร','กำหนด Random seed และบันทึก Version กับขั้นตอน Pipeline']
 ],
 s11:[
  ['Problem type','ผลลัพธ์เป็นชนิดโรคหรือค่าความดัน ควรจำแนกอย่างไร','ชนิดโรคเป็น Classification ส่วนค่าต่อเนื่องเป็น Regression'],
  ['Recall','งานคัดกรองที่พลาดผู้ป่วยมี Cost สูง ควรเน้น Metric ใด','เน้น Recall และตรวจ False negative แม้อาจยอมรับ False positive เพิ่มขึ้น'],
  ['Threshold','ลด Threshold มักส่งผลอย่างไร','มักเพิ่ม Positive prediction และ Recall แต่ลด Precision หรือเพิ่ม False positive']
 ],
 s12:[
  ['K-means','ขั้นตอนหลักของ K-means คืออะไร','สลับ Assignment ไป Centroid ที่ใกล้ที่สุดและ Update centroid จนคงที่'],
  ['Choose k','จะเลือกจำนวน Cluster อย่างไร','ใช้ Elbow, Silhouette, ความหมายเชิงโดเมน และตรวจ Stability ร่วมกัน'],
  ['PCA','PCA ช่วยอะไรและเสี่ยงอะไร','ช่วยลดมิติและ Visualization แต่ Component อาจตีความยากและสูญเสียข้อมูล']
 ],
 b4:[
  ['Overfitting','Train สูงแต่ Validation ต่ำมากแปลว่าอะไร','มีหลักฐาน Overfitting ต้องทบทวน Complexity, Regularization, Data และ Leakage'],
  ['Imbalance','Accuracy สูงแต่ Minority recall ต่ำ ควรทำอย่างไร','ตรวจ Confusion matrix, Precision, Recall, F1 และ Subgroup performance'],
  ['Deployment','ก่อน Deploy ต้องตรวจอะไร','ตรวจ Data quality, Generalization, Fairness, Limitations, Monitoring และ Rollback']
 ],
 s13:[
  ['Neuron','Neuron คำนวณ Output อย่างไร','คำนวณ Weighted sum บวก Bias แล้วผ่าน Activation function'],
  ['Backprop','Backpropagation ใช้ทำอะไร','คำนวณ Gradient ของ Loss ย้อนผ่าน Network เพื่ออัปเดต Weights'],
  ['Architecture','ภาพ ข้อมูลลำดับ และภาษา ควรพิจารณาอะไร','ภาพมักใช้ CNN ลำดับใช้ RNN และภาษาเชิงบริบทยาวใช้ Transformer']
 ],
 s14:[
  ['MDP','ต้องนิยาม Sequential decision ด้วยอะไร','กำหนด States, Actions, Transitions, Rewards และ Discount factor'],
  ['Q-learning','Q-value update ใช้ข้อมูลใด','ใช้ Reward และ Max Q ของ Next state สร้าง TD target แล้วอัปเดตด้วย Learning rate'],
  ['Exploration','Agent เลือก Action เดิมตลอด ควรแก้อย่างไร','ใช้ Epsilon-greedy เพื่อ Explore บางครั้งและ Exploit ค่าที่เรียนรู้บางครั้ง']
 ],
 s15:[
  ['RAG','ลำดับหลักของ RAG คืออะไร','Retrieve หลักฐาน สร้าง Context, Generate คำตอบ และคืน Citations'],
  ['Hallucination','คำตอบคล่องแต่ไม่มีหลักฐาน ควรทำอย่างไร','ถือว่าไม่ Grounded ต้องตรวจ Source และใช้ Fallback เมื่อหลักฐานไม่พอ'],
  ['Retrieval','ค้นตัวอักษรตรงตัวไม่พบข้อความความหมายใกล้กัน ควรเพิ่มอะไร','ใช้ Embeddings และ Vector search พร้อมประเมิน Retrieval quality']
 ],
 b5:[
  ['Fairness','Accuracy สูงแต่กลุ่มหนึ่งเสียเปรียบมาก ควร Deploy หรือไม่','ยังไม่ควร Deploy ต้องตรวจ Disparity, สาเหตุ, Mitigation และ Human review'],
  ['Privacy','ระบบใช้ข้อมูลส่วนบุคคลเกินจำเป็น ควรทำอย่างไร','ลดข้อมูล จำกัดวัตถุประสงค์ ป้องกันการเปิดเผย และบันทึกการเข้าถึง'],
  ['Accountability','เมื่อ AI ตัดสินผิดต้องมีอะไร','มี Audit log, ผู้รับผิดชอบ, Human override, Monitoring, Incident response และ Appeal']
 ]
};

const contexts=['Smart Campus','คลินิกมหาวิทยาลัย','ระบบรถรับส่ง','ห้องสมุดดิจิทัล','ระบบผ่านประตู','ศูนย์คัดแยกขยะ','ศูนย์จัดการห้องเรียน','ศูนย์พลังงาน','ศูนย์บริการชุมชน','ห้องปฏิบัติการ'];
const risks=['ข้อมูลไม่ครบ','ข้อมูลขัดแย้ง','ความมั่นใจต่ำ','สภาพแวดล้อมเปลี่ยนเร็ว','เซนเซอร์ผิดปกติ','ต้นทุนไม่เท่ากัน','ข้อมูลฝึกไม่สมดุล','โมเดลเริ่ม Drift'];
const policies=['verify','safe-fallback','human-review','audit','privacy','fairness','monitoring','explain'];
const hash=s=>{let h=2166136261;for(const ch of String(s)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0};
const norm=id=>String(id||'s1').toLowerCase().replace(/^mission/,'s').replace(/^m(?=\d)/,'s').replace(/^boss/,'b');
const phaseOf=(i,boss)=>boss?(i<5?'Boss Phase 1':i<11?'Boss Phase 2':'Final Twist'):(i<5?'Core Mechanic':i<13?'Analysis Case':'Case Twist');

Object.keys(META).forEach(id=>{
 const old=(C.sessions&&C.sessions[id])||{};
 C.sessions=C.sessions||{};
 C.sessions[id]={...old,...META[id],concepts:(QA[id]||[]).map(x=>x[0]),mechanic:(QA[id]||[]).map(x=>x[0])};
});
C.blocks=[['b1','AI Foundation',['s1','s2','s3'],'B1 Foundation Boss'],['b2','Search Strategy',['s4','s5','s6'],'B2 Search Boss'],['b3','Knowledge & Reasoning',['s7','s8','s9'],'B3 Reasoning Boss'],['b4','Machine Learning',['s10','s11','s12'],'B4 ML Boss'],['b5','Modern AI & Governance',['s13','s14','s15'],'B5 Final Boss']];

function makeCard(id,i,round){
 id=norm(id);
 const meta=META[id]||META.s1,bank=QA[id]||QA.s1,item=bank[i%bank.length];
 const seed=hash(id+'|'+i+'|'+round),ctx=contexts[(seed+i*3)%contexts.length],risk=risks[(seed+i*5)%risks.length],policy=policies[(seed+i)%policies.length];
 return {
  id:id+'-'+String(i+1).padStart(2,'0')+'-r'+round,
  sessionId:id,code:meta.code,title:meta.title,block:meta.block,
  phase:phaseOf(i,!!meta.boss),context:ctx,risk:risk,concept:item[0],policy:policy,
  answerSlot:i%4,
  prompt:ctx+' พบว่า '+risk+'\n'+item[1],
  correct:item[2],
  distractors:['เลือกวิธีที่เร็วที่สุดโดยไม่ตรวจหลักฐาน','ใช้แนวคิดเดียวกับทุกบริบท','เชื่อผลระบบทันทีโดยไม่ตรวจข้อจำกัด'],
  principle:meta.theme+' • '+item[0],
  fingerprint:id+'|'+item[0]+'|'+ctx+'|'+risk+'|'+round+'|'+i
 };
}
C.generate=function(id,count,round){
 id=norm(id);const meta=META[id]||META.s1,n=Number(count||(meta.boss?30:60)),r=Number(round||1);
 return Array.from({length:n},(_,i)=>makeCard(id,i,r));
};
C.deck=function(id,round){
 id=norm(id);const meta=META[id]||META.s1,r=Number(round||1),pool=C.generate(id,meta.boss?30:60,r),start=(r*7)%pool.length,out=[];
 for(let i=0;out.length<15&&i<pool.length*4;i++){
  const card=pool[(start+i*5)%pool.length];
  if(!out.some(x=>x.fingerprint===card.fingerprint))out.push({...card,deckIndex:out.length+1});
 }
 return out;
};
C.version='v7.3.2-runtime-aligned';
C.__runtimeAligned732=true;
console.log('[AIQuest] Runtime curriculum alignment v7.3.2 active');
})();