/* CSAI2102 AI Quest — Upper Course Quality Layer v7.1.4
   S7-S15 + B3-B5 concept-specific answers and plausible distractors.
*/
(()=>{'use strict';
if(window.AIQuestUpperCourseQualityV714)return;
const VERSION='v7.1.4';
const IDS=['s7','s8','s9','b3','s10','s11','s12','b4','s13','s14','s15','b5'];
const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
const hash=s=>{let h=2166136261;for(const ch of String(s)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0};
const idOf=x=>String(x||'').toLowerCase().replace('mission','s').replace('boss','b').replace(/^m/,'s');
const ctx=c=>clean(c.context||'ระบบในมหาวิทยาลัย');
const risk=c=>clean(c.risk||((c.prompt||'').match(/พบว่า ([^\n]+?) ผู้เรียน/)||[])[1]||'ข้อมูลยังไม่แน่นอน');
const focus=c=>clean(c.concept||'แนวคิดหลัก');
const slots=[2,0,3,1,0,2,1,3,1,3,0,2,3,1,0];
const BANK={
s7:{ok:[
 c=>`แยก fact ที่ตรวจสอบได้ rule ที่ใช้อนุมาน และ relation ของ ${ctx(c)} ก่อนสร้าง knowledge base`,
 c=>`กำหนดทิศทาง relation และชนิดของ entity ให้ชัด เพื่อไม่กลับหัวความหมาย`,
 c=>`ตรวจ consistency เมื่อ ${risk(c)} ทำให้ facts หรือ rules ขัดกัน`,
 c=>`เพิ่ม exception และ provenance ให้แต่ละ fact เพื่อรู้แหล่งที่มาและเงื่อนไขใช้`,
 c=>`ใช้ semantic graph เชื่อม entity-relation-entity แล้วตรวจว่าเส้นทางอนุมานสมเหตุสมผล`,
 c=>`แยก ontology schema ออกจาก instance data เพื่อไม่ปนชนิดกับข้อมูลรายกรณี`,
 c=>`หยุด reasoning เมื่อ relation ที่จำเป็นขาด และส่งให้ผู้เชี่ยวชาญเติมความรู้`,
 c=>`บันทึก version ของ rule และผู้อนุมัติทุกครั้งที่ knowledge base เปลี่ยน`
],bad:[
 c=>`เก็บทุกข้อความเป็น fact โดยไม่ตรวจแหล่งที่มา`,
 c=>`ใช้ relation เดียวเชื่อมทุก entity เพื่อให้กราฟง่าย`,
 c=>`แก้ rule conflict ด้วยการเลือกกฎที่เขียนล่าสุดเสมอ`,
 c=>`ถือว่า ontology ที่มีโหนดมากย่อมถูกต้องกว่า`,
 c=>`อนุมานต่อแม้ fact สำคัญหายไป`,
 c=>`ใช้ชื่อคล้ายกันแทนการกำหนดชนิดและ relation`
]},
s8:{ok:[
 c=>`เริ่มจาก prior ของเหตุการณ์ แล้วอัปเดตด้วย likelihood ของ evidence ใน ${ctx(c)}`,
 c=>`เปรียบเทียบ posterior กับ base rate ไม่ใช้ confidence ของโมเดลแทน probability`,
 c=>`แยก evidence ที่เป็นอิสระออกจาก evidence ซ้ำซ้อนก่อนคูณความน่าจะเป็น`,
 c=>`เมื่อ ${risk(c)} ให้รายงานช่วงความไม่แน่นอนและขอหลักฐานเพิ่มก่อนตัดสิน`,
 c=>`อธิบายว่า evidence ใดเพิ่มหรือลด posterior และมากเพียงใด`,
 c=>`หลีกเลี่ยง base-rate neglect โดยดูความชุกของเหตุการณ์ในประชากรจริง`,
 c=>`ปรับ threshold ตามต้นทุน false positive และ false negative ของผู้ใช้`,
 c=>`ให้มนุษย์ตรวจกรณี posterior ใกล้เส้นตัดสินหรือ evidence ขัดแย้ง`
],bad:[
 c=>`ใช้ค่า confidence เป็น posterior โดยตรง`,
 c=>`ละ prior เพราะ evidence ล่าสุดดูชัด`,
 c=>`นับ evidence ซ้ำหลายครั้งเพื่อเพิ่มความมั่นใจ`,
 c=>`สรุปแน่นอนเมื่อ probability เกิน 50%`,
 c=>`ใช้ base rate ของบริบทอื่นแทนข้อมูลจริง`,
 c=>`ซ่อน uncertainty เพื่อไม่ให้ผู้ใช้สับสน`
]},
s9:{ok:[
 c=>`เขียน IF-THEN trace ทีละกฎจาก facts ของ ${ctx(c)} จนถึงข้อสรุป`,
 c=>`ใช้ forward chaining เมื่อมีข้อมูลเริ่มต้นมากและต้องการดูผลที่ตามมา`,
 c=>`ใช้ backward chaining เมื่อมี hypothesis ชัดและต้องตรวจว่ามีหลักฐานรองรับหรือไม่`,
 c=>`ตรวจ rule conflict และกำหนด priority หรือขอ expert review เมื่อ ${risk(c)}`,
 c=>`ป้องกัน circular rule ด้วย visited-rule set และจุดหยุดการอนุมาน`,
 c=>`แสดงกฎที่ถูกใช้ กฎที่ไม่ใช้ และ fact ที่ยังขาดเพื่ออธิบายผล`,
 c=>`แยก certainty ของ fact ออกจากความถูกต้องของ rule`,
 c=>`บันทึก expert override และเหตุผลเพื่อปรับปรุง knowledge base ภายหลัง`
],bad:[
 c=>`ใช้กฎแรกที่ตรงแล้วหยุดเสมอ`,
 c=>`ซ่อน reasoning trace เพราะผู้ใช้ต้องการเพียงคำตอบ`,
 c=>`ให้กฎทุกข้อมี priority เท่ากันแม้ขัดแย้ง`,
 c=>`อนุมานวนซ้ำจนกว่าจะได้ผลที่ต้องการ`,
 c=>`ใช้ backward chaining โดยไม่กำหนด hypothesis`,
 c=>`ถือว่า fact จากผู้ใช้ถูกต้องเสมอ`
]},
b3:{ok:[
 c=>`รวม facts-relations, prior-evidence-posterior และ IF-THEN trace ของ ${ctx(c)} ก่อนสรุป`,
 c=>`เมื่อ knowledge และ evidence ขัดกัน ให้พักข้อสรุปและส่ง conflict ให้ expert review`,
 c=>`แสดง provenance ของ fact ความไม่แน่นอน และกฎที่ใช้ทุกขั้น`,
 c=>`ใช้ posterior เพื่อจัดลำดับ hypothesis แต่ไม่ข้ามข้อจำกัดของ rule base`,
 c=>`ตรวจ consistency ของ graph และ circular rule ก่อนผ่าน Boss Gate`,
 c=>`กำหนดจุดที่มนุษย์ยืนยัน แก้ fact หรือ override rule พร้อม audit trail`,
 c=>`สื่อสารทั้งข้อสรุป confidence และหลักฐานที่ยังขาดแก่ผู้ใช้`,
 c=>`ปฏิเสธการสรุปเมื่อ ${risk(c)} ทำให้ reasoning trace ไม่สมบูรณ์`
],bad:[
 c=>`เลือกข้อสรุปที่ posterior สูงสุดโดยไม่ดู rule conflict`,
 c=>`ใช้ expert system แทนการตรวจ provenance`,
 c=>`ลบ fact ที่ขัดกับคำตอบส่วนใหญ่`,
 c=>`ถือว่ามี trace แล้วจึงไม่ต้องมี human review`,
 c=>`รวม probability กับ rule priority เป็นคะแนนเดียวโดยไม่อธิบาย`,
 c=>`ผ่าน Boss Gate หากระบบให้คำตอบได้แม้ไม่มีหลักฐานพอ`
]},
s10:{ok:[
 c=>`กำหนดหน่วยข้อมูล feature label และ target ของ ${ctx(c)} ก่อนสร้าง pipeline`,
 c=>`แยก train validation test ตามเวลา หรือ entity เพื่อป้องกัน data leakage`,
 c=>`ตรวจ label quality และ sampling bias เมื่อ ${risk(c)}`,
 c=>`fit preprocessing เฉพาะ train แล้วนำ transformation เดิมไปใช้กับ validation/test`,
 c=>`เก็บ data lineage version และขั้นตอนทำความสะอาดเพื่อทำซ้ำได้`,
 c=>`ตั้ง baseline ก่อนใช้โมเดลซับซ้อนเพื่อวัดว่าการเรียนรู้เพิ่มคุณค่าจริง`,
 c=>`ตรวจ distribution shift ระหว่าง train กับข้อมูลใช้งานจริง`,
 c=>`ให้มนุษย์ review ตัวอย่างผิดปกติและนิยาม label ก่อนเริ่ม training`
],bad:[
 c=>`ใช้ test set ช่วยปรับโมเดลจนคะแนนดีที่สุด`,
 c=>`ทำ normalization จากข้อมูลทั้งหมดก่อน split`,
 c=>`สุ่มแบ่งข้อมูลเสมอแม้เป็น time series`,
 c=>`ลบข้อมูลส่วนน้อยเพื่อให้โมเดลนิ่ง`,
 c=>`ใช้ feature ที่เกิดหลังเหตุการณ์เป้าหมาย`,
 c=>`ถือว่า label จากระบบเดิมเป็น ground truth`
]},
s11:{ok:[
 c=>`เลือก precision เมื่อการแจ้งผิดมีต้นทุนสูง และ recall เมื่อการพลาดเคสจริงอันตรายกว่า`,
 c=>`อ่าน TP FP FN TN แยกก่อนเลือก threshold ของ ${ctx(c)}`,
 c=>`ประเมิน class imbalance ด้วย per-class metrics ไม่เชื่อ accuracy รวม`,
 c=>`ทดลองหลาย threshold แล้วเทียบผลกระทบต่อผู้ใช้แต่ละกลุ่ม`,
 c=>`ใช้ F1 เมื่อ precision และ recall สำคัญใกล้กัน แต่ยังต้องดูชนิด error`,
 c=>`รายงาน calibration เพื่อดูว่า probability ที่โมเดลให้สอดคล้องกับความจริงหรือไม่`,
 c=>`ตรวจ error cases และ subgroup performance เมื่อ ${risk(c)}`,
 c=>`กำหนด human review สำหรับกรณีใกล้ threshold หรือความเสียหายสูง`
],bad:[
 c=>`เลือกโมเดลจาก accuracy สูงสุดเพียงค่าเดียว`,
 c=>`เพิ่ม threshold เสมอเพื่อให้โมเดลแม่นขึ้น`,
 c=>`ใช้ F1 แล้วไม่ต้องดู FP/FN`,
 c=>`รวมทุกกลุ่มเป็นค่าเฉลี่ยเดียว`,
 c=>`ถือว่า confidence สูงแปลว่าคำตอบถูก`,
 c=>`ปรับ threshold จาก demo รอบเดียว`
]},
s12:{ok:[
 c=>`เลือก similarity และ scaling ที่สอดคล้องกับชนิด feature ก่อน clustering ${ctx(c)}`,
 c=>`ประเมินหลายค่า k และใช้ทั้ง metric กับการตีความเชิงโดเมน`,
 c=>`มอง cluster เป็นรูปแบบสำรวจ ไม่ตั้งชื่อเป็นข้อเท็จจริงเกี่ยวกับคน`,
 c=>`ตรวจ outlier แยกจาก noise และไม่ลบทิ้งก่อนหาสาเหตุ`,
 c=>`เปรียบเทียบ stability ของ cluster เมื่อสุ่ม seed หรือเปลี่ยน sample`,
 c=>`ตรวจ minority group ที่อาจถูกกลบเมื่อ ${risk(c)}`,
 c=>`ให้ผู้เชี่ยวชาญตรวจชื่อและความหมายของ cluster ก่อนนำไปตัดสิน`,
 c=>`บันทึกข้อจำกัดว่า clustering ไม่พิสูจน์เหตุและผล`
],bad:[
 c=>`ตั้งชื่อ cluster จากค่าเฉลี่ยเพียง feature เดียว`,
 c=>`เลือก k ที่ทำให้กราฟสวยที่สุด`,
 c=>`ลบ outlier ทั้งหมดเพราะรบกวนกลุ่ม`,
 c=>`ใช้ cluster เป็น label จริงของผู้ใช้`,
 c=>`ถือว่ากลุ่มใหญ่สำคัญกว่ากลุ่มเล็ก`,
 c=>`สรุปเหตุและผลจากการอยู่ cluster เดียวกัน`
]},
b4:{ok:[
 c=>`ตรวจ pipeline leakage metric threshold error และ bias ของ ${ctx(c)} ก่อนอนุมัติ deploy`,
 c=>`กำหนด launch gate จาก validation อิสระและผลกระทบ FP/FN ต่อแต่ละกลุ่ม`,
 c=>`ทดสอบทั้ง supervised error และ unsupervised pattern โดยไม่ overclaim cluster`,
 c=>`เมื่อ ${risk(c)} ให้หยุด deploy และตรวจ label feature หรือ sampling ใหม่`,
 c=>`ใช้ staged rollout พร้อม monitoring baseline และ rollback plan`,
 c=>`ให้ reviewer เห็น data lineage model card subgroup metrics และ known limitations`,
 c=>`ผ่าน Boss Gate เฉพาะเมื่อผล test ไม่ถูกใช้ปรับโมเดลและ bias อยู่ในเกณฑ์`,
 c=>`บันทึก owner threshold version และเหตุผลการอนุมัติทุกครั้ง`
],bad:[
 c=>`deploy เพราะคะแนนเฉลี่ยเกินเกณฑ์`,
 c=>`เลือกโมเดลที่ซับซ้อนที่สุดเพื่อชดเชยข้อมูลไม่ดี`,
 c=>`ใช้ test set ปรับ threshold รอบสุดท้าย`,
 c=>`รวม subgroup เพื่อให้ metric เสถียร`,
 c=>`แก้ bias ด้วย disclaimer`,
 c=>`ตัด fallback เพื่อลดความซับซ้อน`
]},
s13:{ok:[
 c=>`อธิบาย neuron เป็น weighted sum ผ่าน activation และ layer ที่เรียนรู้ representation`,
 c=>`แยก training loss จาก validation performance เพื่อจับ overfitting ใน ${ctx(c)}`,
 c=>`ใช้ regularization early stopping หรือ data augmentationตามสาเหตุของ overfit`,
 c=>`ตรวจ generalization บนข้อมูลต่างช่วงเวลาและกลุ่มผู้ใช้`,
 c=>`ไม่ตีความ weight เดี่ยวเป็นเหตุผลสมบูรณ์ของคำตอบ`,
 c=>`เปรียบเทียบ baseline ก่อนเพิ่ม layer หรือ parameter`,
 c=>`monitor drift หลัง deploy เมื่อ ${risk(c)}`,
 c=>`ใช้ explainability ร่วมกับ error analysis และ human oversight`
],bad:[
 c=>`เพิ่ม layer เสมอเมื่อ validation แย่`,
 c=>`เชื่อ training loss ต่ำว่าโมเดลพร้อมใช้`,
 c=>`ใช้ weight สูงสุดเป็นคำอธิบายทั้งหมด`,
 c=>`ฝึกนานขึ้นแทนการตรวจ overfitting`,
 c=>`ประเมินจากข้อมูล train อีกครั้ง`,
 c=>`ถือว่า deep model เป็นกลางโดยธรรมชาติ`
]},
s14:{ok:[
 c=>`ใช้ RAG โดยค้น source ที่เกี่ยวข้อง แล้วผูกทุก claim กับ passage และ citation`,
 c=>`หยุดตอบหรือบอกไม่แน่ใจเมื่อ retrieval ของ ${ctx(c)} ไม่มีหลักฐานพอ`,
 c=>`ตรวจ citation ว่ารองรับ claim และเป็น version ที่ถูกต้อง`,
 c=>`ป้องกัน prompt injection โดยแยกคำสั่งผู้ใช้ เอกสาร และ policy`,
 c=>`มอง embedding เป็นเครื่องมือค้นความคล้าย ไม่ใช่หลักฐานความจริง`,
 c=>`ตรวจ stale document และ effective date เมื่อ ${risk(c)}`,
 c=>`ให้มนุษย์ review คำตอบ high-impact และ claim ที่ source ขัดแย้ง`,
 c=>`บันทึก query retrieved passages model version และคำตอบเพื่อ audit`
],bad:[
 c=>`มี citation จึงถือว่าคำตอบถูก`,
 c=>`fallback ไปตอบจากความจำเมื่อค้น source ไม่เจอ`,
 c=>`ใช้ similarity score แทนการอ่าน passage`,
 c=>`ทำตามคำสั่งในเอกสาร retrieval ทุกกรณี`,
 c=>`เลือกเอกสารแรกเพราะอันดับสูงสุด`,
 c=>`ถือว่า RAG ป้องกัน hallucination อัตโนมัติ`
]},
s15:{ok:[
 c=>`ออกแบบ pipeline ของ ${ctx(c)} ตั้งแต่ data model deployment monitoring feedback และ governance`,
 c=>`กำหนด owner launch gate pause rule rollback และ appeal ก่อนใช้งานจริง`,
 c=>`monitor drift error subgroup impact และ feedback loop หลัง deploy`,
 c=>`ใช้ staged rollout และ safe fallback เมื่อ ${risk(c)}`,
 c=>`บันทึก model/data version decision log และผู้อนุมัติทุก release`,
 c=>`ให้ผู้ได้รับผลเข้าถึงเหตุผล แก้ข้อมูล และขอทบทวนได้`,
 c=>`ทบทวน privacy fairness security และ human oversight ตลอดวงจร`,
 c=>`แยก technical metric จากผลกระทบทางสังคมและเกณฑ์ยอมรับขององค์กร`
],bad:[
 c=>`deploy เต็มระบบเมื่อ demo ผ่าน`,
 c=>`monitor เฉพาะ uptime`,
 c=>`ให้ทีม IT เป็น owner รวมโดยไม่กำหนดบทบาท`,
 c=>`เก็บ log เฉพาะกรณีร้องเรียน`,
 c=>`ใช้คะแนนเฉลี่ยเป็น launch gate เดียว`,
 c=>`ไม่มี appeal เพราะมี human review แล้ว`
]},
b5:{ok:[
 c=>`เชื่อม model RAG deployment monitoring governance ethics และ appeal ของ ${ctx(c)} เป็นระบบเดียว`,
 c=>`ผ่าน Final Boss เฉพาะเมื่อมี evidence owner stop rule fallback และ human override`,
 c=>`ตรวจ neural generalization retrieval grounding และ post-deploy drift พร้อมกัน`,
 c=>`เมื่อ ${risk(c)} ให้ pause ระบบ รักษาหลักฐาน และส่งให้ผู้รับผิดชอบทบทวน`,
 c=>`กำหนด staged rollout rollback audit trail และช่องอุทธรณ์ก่อน launch`,
 c=>`ประเมิน fairness privacy rights และ harm รายกลุ่ม ไม่ดู metric รวมอย่างเดียว`,
 c=>`ให้ทุก claim และ decision trace กลับไปยัง data source model version และ reviewer`,
 c=>`ปฏิเสธการเปิดใช้หาก source ไม่พอ governance ไม่ชัด หรือผู้ใช้แก้ไขผลไม่ได้`
],bad:[
 c=>`ผ่าน Final Boss เพราะทุกโมดูลมีคะแนนเกิน 60`,
 c=>`มี RAG และ human review จึงไม่ต้องมี monitoring`,
 c=>`ใช้ vendor policy แทน governance ขององค์กร`,
 c=>`เปิดใช้เต็มระบบแล้วค่อยสร้าง appeal`,
 c=>`เชื่อ confidence สูงแทน evidence`,
 c=>`แก้ ethics ด้วยข้อความยินยอมเพียงครั้งเดียว`
]}
};
function balance(opts){const max=Math.max(...opts.map(x=>clean(x).length));return opts.map(x=>{let v=clean(x);if(v.length<max-24)v+=' สำหรับหลักฐานของเคสนี้';return v})}
function build(card,i,r,sid){const p=BANK[sid],key=sid+'|'+(card.fingerprint||card.id)+'|'+i+'|'+r;const correct=clean(p.ok[hash('ok|'+key)%p.ok.length](card));const start=hash('bad|'+key)%p.bad.length,b=[];for(let k=0;k<p.bad.length&&b.length<3;k++){const x=clean(p.bad[(start+k)%p.bad.length](card));if(x!==correct&&!b.includes(x))b.push(x)}const all=balance([correct,...b]);return {...card,correct:all[0],distractors:all.slice(1),answerSlot:slots[(i+r)%slots.length],fingerprint:(card.fingerprint||card.id)+'|upper714|'+i+'|'+r,principle:`${sid.toUpperCase()} case-specific reasoning • ${focus(card)} • evidence → reasoning → accountable action`,challengeVersion:VERSION,challengeTrap:'upper-course concept trap'}}
function patch(){const C=window.AIQuestAllContentV702;if(!C||C.__upper714)return false;const base=C.deck.bind(C);C.deck=(id,r)=>{const sid=idOf(id),round=Number(r||1),deck=base(sid,round)||[];if(!IDS.includes(sid))return deck;const out=deck.slice(0,15).map((c,i)=>build(c,i,round,sid));out.challengeAudit={version:VERSION,uniqueCorrect:new Set(out.map(x=>x.correct)).size,uniqueDistractors:new Set(out.flatMap(x=>x.distractors)).size,slots:[0,1,2,3].map(s=>out.filter(x=>x.answerSlot===s).length),scope:'S7-S15/B3-B5'};return out};C.__upper714=true;C.upperCourseQualityVersion=VERSION;return true}
let tries=0;function boot(){if(patch())return;if(++tries<60)setTimeout(boot,100)}boot();
window.AIQuestUpperCourseQualityV714={version:VERSION,sessions:IDS};
})();