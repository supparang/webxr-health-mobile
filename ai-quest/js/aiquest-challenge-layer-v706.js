/* CSAI2102 AI Quest — Full-course Challenge Layer v7.3.1
 * Active compatibility filename retained as aiquest-challenge-layer-v706.js.
 * - Uses curriculum-specific correct answers from AIQuestAllContentV702
 * - Supplies plausible misconceptions for every S1-S15 and B1-B5
 * - Removes longest-option clues by applying the same evidence tag to all choices
 * - Preserves balanced answer slots, no-repeat replay and Reflection paste guard
 */
(()=>{'use strict';
if(window.AIQuestChallengeLayerV731)return;

const VERSION='v7.3.1-full-course-distractors';
const RISK=['LOW','MEDIUM','HIGH','CRITICAL'];
const slots=[2,0,3,1,0,2,1,3,1,3,0,2,3,1,0];
const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
const hash=s=>{let h=2166136261;for(const ch of String(s)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0};
const idOf=x=>String(x||'s1').toLowerCase().replace(/^mission/,'s').replace(/^m(?=\d)/,'s').replace(/^boss/,'b');
const read=(k,d)=>{try{const v=JSON.parse(localStorage.getItem(k)||'null');return v==null?d:v}catch(e){return d}};
const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
const contextOf=c=>clean(c.context||'บริบทภารกิจ');
const conceptOf=c=>clean(c.concept||'แนวคิดของด่าน');
const riskText=c=>clean(c.risk||((String(c.prompt||'').match(/พบว่า ([^\n]+?)(?:\n|$)/)||[])[1])||'ข้อมูลหรือเงื่อนไขยังไม่แน่นอน');

const MISCONCEPTIONS={
 s1:[
  'จัดว่าเป็น AI เพราะชื่อระบบมีคำว่า smart แม้ไม่พบข้อมูลฝึกหรือโมเดล',
  'ถือว่า if-else ทุกแบบเป็น Machine Learning เพราะระบบตัดสินใจได้เอง',
  'สรุปว่าไม่ใช่ AI เพียงเพราะยังมีมนุษย์กดยืนยันผล',
  'ใช้ความแม่นยำจากการทดลองครั้งเดียวแทนหลักฐาน data-model-output'
 ],
 s2:[
  'นับข้อมูลทุกอย่างในฐานข้อมูลเป็น Sensor แม้ Agent ไม่ได้รับข้อมูลนั้น',
  'เรียกข้อความที่แสดงบนหน้าจอว่า Actuator โดยไม่ดูการกระทำต่อ Environment',
  'ใช้ความเร็วเป็น Performance measure เพียงค่าเดียวแม้เสี่ยงต่อความปลอดภัย',
  'เพิ่ม Autonomy เมื่อ Sensor confidence ต่ำเพื่อให้ Agent ตัดสินใจเร็วขึ้น'
 ],
 s3:[
  'ใช้ DFS แล้วรับประกันเส้นทางจำนวนก้าวสั้นที่สุดในกราฟทุกชนิด',
  'ใช้ BFS โดยไม่ต้องมี visited set แม้กราฟมี cycle',
  'ถือว่า State มีเพียงชื่อสถานที่และไม่ต้องกำหนด Goal หรือ Actions',
  'เลือกวิธีจากจำนวนโหนดที่เห็นในภาพโดยไม่พิจารณา Frontier และ Memory'
 ],
 b1:[
  'เรียกระบบทั้งหมดว่า AI แล้วเริ่มค้นเส้นทางโดยไม่กำหนด PEAS',
  'วางเส้นทางให้ถึง Goal เร็วที่สุดแม้ละเมิด Constraint ของผู้ใช้',
  'เชื่อ Sensor ล่าสุดเพียงค่าเดียวและไม่เก็บ Internal state',
  'ไม่มี Safe fallback เพราะสามารถให้ Agent ลองเส้นทางใหม่ได้เสมอ'
 ],
 s4:[
  'เลือกเส้นทางที่มีจำนวน Edge น้อยที่สุดโดยไม่รวม Step cost',
  'ใช้ FIFO queue แทน Priority queue แม้ต้นทุนแต่ละเส้นไม่เท่ากัน',
  'หยุดทันทีเมื่อสร้าง Goal เข้า Frontier ครั้งแรกก่อนยืนยันว่ามี Cost ต่ำสุด',
  'อ้างว่า UCS Optimal ได้แม้มี Negative step cost โดยไม่เพิ่มเงื่อนไขอื่น'
 ],
 s5:[
  'เลือกโหนดจาก h(n) อย่างเดียวแล้วเรียกว่า A* โดยไม่ใช้ g(n)',
  'ใช้ Heuristic ที่ Overestimate ได้เสมอเพราะช่วยให้ถึง Goal เร็ว',
  'ถือว่า Greedy best-first และ A* ให้คำตอบเหมือนกันทุกกรณี',
  'ตรวจ Consistency เฉพาะที่ Start node โดยไม่ตรวจแต่ละ Edge'
 ],
 s6:[
  'MAX เลือก Leaf ที่สูงที่สุดทันทีโดยไม่พิจารณาการตอบโต้ของ MIN',
  'MIN พยายามเพิ่ม Utility ให้ MAX เพราะทั้งสองฝ่ายใช้คะแนนเดียวกัน',
  'Alpha-beta pruning เปลี่ยนคำตอบ Minimax เพื่อแลกกับความเร็ว',
  'ถือว่า Evaluation function เท่ากับ Terminal utility ที่ถูกต้องแน่นอน'
 ],
 b2:[
  'ใช้ A* กับทุกปัญหาแม้ไม่มี Heuristic ที่มีความหมายหรือมีคู่แข่ง',
  'ใช้ Minimax กับปัญหาเส้นทางที่ไม่มี Opponent เพราะมีหลายทางเลือก',
  'ใช้ BFS บน Weighted graph แล้วรับประกันเส้นทาง Cost ต่ำสุด',
  'เลือก DFS เพราะใช้ Memory น้อยและจึงถือว่า Optimal ด้วย'
 ],
 s7:[
  'ใช้กฎ Bird implies Fly กับทุกกรณีและไม่ต้องจัดการ Exception',
  'ถือว่าทิศทางของ Relation ไม่สำคัญและสลับ Subject/Object ได้',
  'เพิ่ม Fact ที่ขัดแย้งกันแล้วปล่อยให้กฎแรกเป็นคำตอบโดยไม่ตรวจ Consistency',
  'ถือว่า Retrieval จาก Knowledge Base คือ Inference แม้ไม่มี Rule ถูกใช้'
 ],
 s8:[
  'ใช้ Likelihood เป็น Posterior โดยตรงและไม่ต้องคูณ Prior',
  'ละเว้น Base rate เพราะผลตรวจมี Sensitivity สูง',
  'แปลความแม่นยำ 90% ว่าผู้ที่ผลบวกมีโอกาสเป็นโรค 90% เสมอ',
  'สมมติ Conditional independence แม้ตัวแปรมี Dependency ชัดเจน'
 ],
 s9:[
  'ใช้กฎแรกที่ Match เป็นคำตอบสุดท้ายแม้มีกฎอื่นขัดแย้ง',
  'ไม่ต้องคืน Explanation เพราะผู้ใช้เห็น Recommendation แล้ว',
  'ใช้ Confidence สูงแก้ Rule conflict โดยไม่ตรวจ Facts หรือ Priority',
  'ไม่ต้อง Human referral หากระบบยังสามารถสร้างคำแนะนำบางอย่างได้'
 ],
 b3:[
  'เฉลี่ยผลจากกฎกับ Probability แล้วใช้เป็น Decision โดยไม่อธิบายวิธีรวม',
  'ซ่อน Evidence ที่ขัดแย้งเพื่อให้ Confidence ของระบบดูชัดเจน',
  'ถือว่า Confidence สูงเพียงพอโดยไม่ต้องมี Explanation หรือ Expert review',
  'ให้ Rule override Bayesian evidence ทุกกรณีเพราะกฎมาจากผู้เชี่ยวชาญ'
 ],
 s10:[
  'Fit Preprocessing ด้วยข้อมูลรวมก่อน Split เพื่อให้ค่ามีเสถียรภาพ',
  'ใช้ Test set เลือก Hyperparameter หลายรอบแล้วรายงานเป็นผลสุดท้าย',
  'สุ่ม Split ใหม่ทุกครั้งโดยไม่เก็บ Seed หรือ Version เพราะค่าเฉลี่ยใกล้กัน',
  'ใช้ Train accuracy สูงเป็นหลักฐาน Generalization โดยไม่ดู Validation'
 ],
 s11:[
  'ใช้ Accuracy อย่างเดียวกับข้อมูล Class imbalance และไม่ดู Minority recall',
  'ถือว่าการเปลี่ยน Threshold ไม่กระทบ False positive หรือ False negative',
  'ใช้ Precision และ Recall แทนกันได้เพราะวัดความถูกต้องของ Positive เหมือนกัน',
  'จัดปัญหาทำนายค่าต่อเนื่องเป็น Classification เพราะมี Label กำกับ'
 ],
 s12:[
  'ตั้งชื่อ Cluster แล้วถือว่าชื่อนั้นเป็นความจริงของสมาชิกทุกคน',
  'เลือก k จากจำนวนกลุ่มที่อธิบายง่ายโดยไม่ประเมิน Separation หรือ Stability',
  'ละเว้น Outlier เพราะ K-means จะจัดให้อยู่ Cluster ที่ถูกต้องเอง',
  'ถือว่า PCA ลดมิติโดยไม่สูญเสียข้อมูลและ Component ตีความได้ตรงเสมอ'
 ],
 b4:[
  'Deploy เพราะ Train score สูง แม้ Validation ต่ำและยังไม่ตรวจ Leakage',
  'ใช้ Accuracy รวมเป็น Metric เดียวแม้ข้อมูลไม่สมดุลและแต่ละกลุ่มได้รับผลต่างกัน',
  'ยอมรับ Data leakage เพราะช่วยให้ Model เลือก Feature ได้แม่นขึ้น',
  'ไม่ต้อง Monitoring หลัง Deploy หาก Test set ผ่านเกณฑ์แล้ว'
 ],
 s13:[
  'ตัด Activation function ออกได้โดย Network หลาย Layer ยังสร้าง Nonlinearity เอง',
  'Bias ไม่มีผลต่อ Decision boundary เพราะ Weight เป็นตัวกำหนดทั้งหมด',
  'Backpropagation ส่ง Output ย้อนกลับโดยตรงโดยไม่คำนวณ Gradient ของ Loss',
  'เลือก Transformer กับข้อมูลทุกชนิดเพราะเป็น Architecture ใหม่ที่สุด'
 ],
 s14:[
  'เลือก Action ที่ได้ Immediate reward สูงสุดทุกครั้งโดยไม่ดู Future value',
  'Gamma ไม่มีผลต่อพฤติกรรมเพราะ Reward ถูกบวกเข้า Q-value อยู่แล้ว',
  'ตั้ง Epsilon เป็นศูนย์ตั้งแต่เริ่มเพื่อไม่ให้ Agent เสียเวลาสำรวจ',
  'ถือว่า Reward สูงหมายถึงพฤติกรรมตรงเป้าหมายและไม่ต้องตรวจ Reward hacking'
 ],
 s15:[
  'ถือว่ามี Citation แล้วคำตอบ Grounded โดยไม่ตรวจว่า Source สนับสนุนข้อความจริง',
  'อธิบายว่า RAG คือการ Fine-tune LLM ด้วยเอกสารทุกครั้งที่มี Query',
  'ส่งเอกสารที่ Retrieve ได้ทุกชิ้นเข้า Context โดยไม่ Rank หรือประเมิน Relevance',
  'ให้ LLM ตอบต่อเมื่อไม่พบ Evidence เพราะคำตอบที่คล่องช่วยผู้ใช้ได้มากกว่า'
 ],
 b5:[
  'อนุมัติระบบเพราะ Accuracy สูง แม้ยังไม่ตรวจ Fairness Privacy หรือ Safety',
  'ตรวจ Fairness จากค่าเฉลี่ยรวมเพียงค่าเดียวโดยไม่เปรียบเทียบ Subgroups',
  'ถือว่ามี Consent แล้วใช้ข้อมูลส่วนบุคคลได้ทุกวัตถุประสงค์',
  'สร้าง Audit log หลังเกิด Incident และไม่ต้องมี Human override หรือ Appeal'
 ]
};

const genericBad=[
 'เลือกคำตอบที่เร็วที่สุดโดยไม่ตรวจเงื่อนไขและหลักฐานของเคส',
 'ใช้วิธีเดียวกับทุกบริบทแม้ Goal, Cost หรือ Risk แตกต่างกัน',
 'เชื่อ Output ทันทีและไม่บันทึกข้อจำกัดหรือความไม่แน่นอน',
 'ตัด Human review ออกเพื่อให้ระบบทำงานอัตโนมัติเต็มรูปแบบ'
];

function riskOf(i,c){
 let x=i>=13?3:i>=9?2:i>=5?1:0;
 const t=(String(c.prompt||'')+' '+String(c.policy||'')+' '+String(c.concept||'')).toLowerCase();
 if(/rights|privacy|human|safe|critical|fairness/.test(t))x++;
 return RISK[Math.max(0,Math.min(3,x))];
}
function evidenceTag(card,i,sid,round){
 const code=String(hash([sid,round,card.fingerprint||card.id,i].join('|'))%10000).padStart(4,'0');
 return 'หลักฐานเคส '+code+': '+contextOf(card)+' • '+conceptOf(card);
}
function stripGenericSuffix(text){
 return clean(text)
  .replace(/\s*พร้อมบันทึกหลักฐานและใช้\s+[^ ]+\s+เมื่อความเสี่ยงสูง\s*$/i,'')
  .replace(/\s*โดยอิงข้อมูลของเคสนี้\s*$/i,'');
}
function balancedOptions(options,tag){
 const tagged=options.map(x=>stripGenericSuffix(x)+' — '+tag);
 const max=Math.max.apply(null,tagged.map(x=>x.length));
 return tagged.map(x=>x.length<max-28?x+' • ต้องตรวจตามเงื่อนไขที่ระบุในเคส':x);
}
function choicesFor(card,i,sid,round){
 const correct=stripGenericSuffix(card.correct)||'ใช้หลัก '+conceptOf(card)+' ตามข้อมูลและข้อจำกัดของเคส';
 const bank=(MISCONCEPTIONS[sid]||genericBad).slice();
 const start=hash('bad|'+sid+'|'+(card.fingerprint||card.id)+'|'+i+'|'+round)%bank.length;
 const wrong=[];
 for(let k=0;k<bank.length&&wrong.length<3;k++){
   const text=clean(bank[(start+k)%bank.length]);
   if(text!==correct&&!wrong.includes(text))wrong.push(text);
 }
 while(wrong.length<3){
   const text=genericBad[(start+wrong.length)%genericBad.length];
   if(text!==correct&&!wrong.includes(text))wrong.push(text);
 }
 const all=balancedOptions([correct].concat(wrong),evidenceTag(card,i,sid,round));
 return {correct:all[0],distractors:all.slice(1)};
}
function enhance(raw,id,round){
 const sid=idOf(id),out=[];
 (raw||[]).slice(0,15).forEach((card,i)=>{
   const opts=choicesFor(card,i,sid,round),level=riskOf(i,card);
   out.push({...card,
     correct:opts.correct,
     distractors:opts.distractors,
     answerSlot:slots[(i+round)%slots.length],
     riskLevel:level,
     prompt:'['+level+' RISK] '+clean(card.prompt||conceptOf(card))+'\nพิจารณาหลักการเฉพาะด่าน หลักฐาน เงื่อนไข และผลกระทบของเคสนี้',
     principle:(card.title||sid)+' • '+conceptOf(card)+' • คำตอบต้องอธิบายจากหลักการของด่าน ไม่ใช่เลือกจากความยาวของตัวเลือก',
     fingerprint:(card.fingerprint||card.id)+'|full731|'+i+'|'+round,
     challengeTrap:'curriculum-specific misconception',
     challengeVersion:VERSION
   });
 });
 out.challengeAudit={
   version:VERSION,
   noRepeatWindow:'last 4 decks / 60 fingerprints',
   antiGuessPolish:'same evidence tag and balanced length on all four options',
   curriculumCoverage:'S1-S15 + B1-B5',
   uniqueCorrect:new Set(out.map(c=>c.correct)).size,
   uniqueDistractors:new Set(out.flatMap(c=>c.distractors)).size,
   slots:[0,1,2,3].map(s=>out.filter(c=>c.answerSlot===s).length),
   riskMix:RISK.map(x=>out.filter(c=>c.riskLevel===x).length)
 };
 return out;
}
function rank(score){return score>=95?'AI Master':score>=85?'AI Quest Specialist':score>=70?'Agent Designer':score>=60?'Junior AI Inspector':'Rookie Analyst'}
function comboTitle(n){return ['Insight Spark','Logic Chain','Agent Flow','Reasoning Surge','Boss Break','Perfect Deck'][Math.min(5,Math.floor(Number(n||0)/3))]}
function patch(){
 const C=window.AIQuestAllContentV702;
 if(!C||typeof C.deck!=='function'||C.__challengeV731)return false;
 const base=C.deck.bind(C);
 C.deck=(id,r)=>{
   const sid=idOf(id),round=Number(r||1),histKey='CSAI2102_RECENT_FINGERPRINTS_V731_'+sid;
   const hist=new Set(read(histKey,[])),raw=[];
   for(let offset=0;offset<12&&raw.length<15;offset++){
     for(const card of base(sid,round+offset)||[]){
       const fp=card.fingerprint||card.id;
       if(raw.length<15&&!hist.has(fp)&&!raw.some(x=>(x.fingerprint||x.id)===fp))raw.push(card);
     }
   }
   if(raw.length<15){
     for(const card of base(sid,round+101)||[]){
       if(raw.length<15&&!raw.some(x=>(x.fingerprint||x.id)===(card.fingerprint||card.id)))raw.push(card);
     }
   }
   const deck=enhance(raw,sid,round);
   write(histKey,[...hist,...deck.map(c=>c.fingerprint||c.id)].slice(-60));
   return deck;
 };
 C.rank=rank;
 C.comboTitle=comboTitle;
 C.challengeLayerVersion=VERSION;
 C.version='v7.3.1+challenge731';
 C.__challengeV731=C.__challengeV713=C.__challengeV7128=C.__challengeV706=true;
 return true;
}
function suspicious(t){
 t=String(t||'');
 return t.length>2500||(t.match(/\t/g)||[]).length>=8||/challenge\d+_[a-z0-9]+[\s\S]*schemaVersion/i.test(t);
}
function guard(){
 const fields=['r1','r2','r3'].map(id=>document.getElementById(id)).filter(Boolean);
 const note=document.getElementById('saveNote'),save=document.getElementById('save');
 fields.forEach(el=>el.addEventListener('paste',e=>{
   const t=(e.clipboardData||window.clipboardData)?.getData('text')||'';
   if(suspicious(t)){
     e.preventDefault();
     if(note){note.className='notice bad';note.textContent='⚠️ กรุณาวางเฉพาะคำตอบ Reflection ไม่ใช่ข้อมูลทั้งแถวหรือ JSON';}
   }
 }));
 if(save)save.addEventListener('click',e=>{
   const bad=fields.find(x=>suspicious(x.value));
   if(bad){
     e.preventDefault();e.stopImmediatePropagation();
     if(note){note.className='notice bad';note.textContent='⚠️ ยังส่งไม่ได้: Reflection มีข้อมูลทั้งแถวหรือ JSON';}
     bad.focus();
   }
 },true);
}

if(!patch())document.addEventListener('DOMContentLoaded',patch,{once:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',guard,{once:true});else guard();
window.AIQuestChallengeLayerV706={
 version:VERSION,
 replayRules:['Curriculum-specific correct answers','Plausible misconception distractors for all 20 stages','Balanced option lengths','Balanced answer slots','No-repeat window','Reflection paste guard'],
 rank,comboTitle
};
window.AIQuestChallengeLayerV713=window.AIQuestChallengeLayerV706;
window.AIQuestChallengeLayerV731=window.AIQuestChallengeLayerV706;
console.log('[AIQuest] Full-course challenge layer v7.3.1 active');
})();