/* CSAI2102 AI Quest — Challenge Replay Layer v7.1.2.7
   Student Anti-Guess Polish v712.7
   - keeps v711 flow / reflection / Sheet schema intact
   - preserves S11 hard distractor quality
   - S14 concept-specific RAG/NLP calibration: no generic mismatch or duplicated suffixes
   - blocks accidental whole-row / JSON paste into Reflection
*/
(()=>{'use strict';
  if(window.AIQuestChallengeLayerV7127)return;
  const VERSION='v7.1.2.7';
  const riskLevels=['LOW','MEDIUM','HIGH','CRITICAL'];
  const ranks=[['Rookie Analyst',0],['Junior AI Inspector',60],['Agent Designer',70],['AI Quest Specialist',85],['AI Master',95]];
  const comboTitles=['Insight Spark','Logic Chain','Agent Flow','Reasoning Surge','Boss Break','Perfect Deck'];
  const idOf=x=>String(x||'s1').toLowerCase().replace('mission','s').replace('m','s').replace('boss','b');
  const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
  const hash=s=>{let h=2166136261;String(s).split('').forEach(ch=>{h^=ch.charCodeAt(0);h=Math.imul(h,16777619)});return h>>>0;};
  const read=(k,d)=>{try{const v=JSON.parse(localStorage.getItem(k)||'null');return v==null?d:v}catch(e){return d}};
  const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
  const keyRecent=sid=>'CSAI2102_RECENT_FINGERPRINTS_V7127_'+sid;
  const keyWeak=sid=>'CSAI2102_WEAK_CONCEPTS_V7127_'+sid;
  const recent=sid=>read(keyRecent(sid),[]);
  function rememberDeck(sid,cards){write(keyRecent(sid),recent(sid).concat((cards||[]).map(c=>c.fingerprint||c.id)).slice(-60));}
  function rememberMiss(id,cards){const sid=idOf(id),data=read(keyWeak(sid),{miss:{}});(cards||[]).forEach(c=>{data.miss[c.concept]=(data.miss[c.concept]||0)+1});write(keyWeak(sid),data);}
  function rank(score){let out=ranks[0][0];ranks.forEach(([name,need])=>{if(Number(score)>=need)out=name});return out;}
  function comboTitle(combo){return comboTitles[Math.min(comboTitles.length-1,Math.floor(Number(combo||0)/3))];}
  const slotPattern=[2,0,3,1,0,2,1,3,1,3,0,2,3,1,0];
  const pick=(arr,key)=>arr[Math.abs(hash(key))%arr.length];
  const shortContext=c=>clean(c.context||'ระบบในมหาวิทยาลัย');
  const shortPolicy=c=>clean(c.policy||c.concept||'ตรวจผลลัพธ์');
  const traps={
    s1:['AI by evidence','Automation trap','Rule-vs-learning','Decision support'],s2:['sensor confidence','actuator swap','scope creep','unsafe autonomy'],
    s3:['goal conflict','constraint miss','hidden failure','wrong state'],s4:['frontier order','visited loop','cost trap','memory risk'],
    s5:['greedy lure','bad heuristic','g/h mix-up','overestimate'],s6:['opponent response','MAX/MIN swap','utility sign','depth blind'],
    s7:['relation direction','rule conflict','exception miss','entity mismatch'],s8:['base rate','posterior','uncertainty','likelihood'],
    s9:['trace gap','rule conflict','circular chain','hidden assumption'],s10:['data leakage','bad split','dirty label','sampling bias'],
    s11:['metric mismatch','threshold risk','class imbalance','FP/FN impact'],s12:['overclaim','outlier','distance misuse','minority hidden'],
    s13:['overfit','validation gap','too complex','spurious pattern'],s14:['citation mismatch','retrieval miss','prompt injection','stale source','hallucination','weak grounding'],
    s15:['monitoring gap','drift','fallback missing','owner unclear'],b1:['evidence gap','AI claim','agent boundary','constraint'],b2:['cost trap','heuristic trap','opponent move','frontier loop'],b3:['knowledge conflict','trace gap','missing prior','uncertainty'],b4:['metric bias','drift','threshold','leakage'],b5:['hallucination','governance','monitoring','appeal']
  };
  const genericCorrect={
    s1:['ตัดสินจาก data model output ไม่ใช่ชื่อระบบ','แยก automation ออกจาก AI ด้วยหลักฐาน','ดูว่าระบบเรียนรู้หรือเป็น rule คงที่','ให้มนุษย์ยืนยันก่อนเรียกว่า AI'],
    s2:['วาง PEAS ให้ครบก่อนให้ agent ทำงาน','ตรวจ sensor confidence ก่อน action','จำกัด scope พร้อม safe fallback','เก็บ audit trail ของ agent'],
    s3:['นิยาม state goal action constraint ให้ครบ','เลือก action ที่ไม่ชน constraint','ตรวจ initial state และ failure state','รักษา goal เดิมตลอดการค้นหา'],
    s4:['เลือก search จาก cost goal และ frontier','ใช้ visited set กัน loop','เลือก UCS เมื่อ cost ไม่เท่ากัน','เทียบ optimality กับ memory risk'],
    s5:['ใช้ f(n)=g(n)+h(n) ไม่ดู h อย่างเดียว','ตรวจ admissible heuristic ก่อนใช้ A*','แยก Greedy จาก A* ด้วย g/h','ระวัง heuristic ที่ overestimate'],
    s6:['คิดตาคู่แข่งก่อนเลือก move','แยก MAX/MIN และ utility sign','เลือกทางที่ลด worst case','ตรวจ terminal utility ก่อน prune'],
    s7:['แยก fact rule relation ให้ชัด','ตรวจทิศทาง relation และ entity','จัดการ rule conflict ก่อนสรุป','ใส่ exception เมื่อกฎกว้างเกินไป'],
    s8:['ใช้ prior และ evidence อัปเดต posterior','ดู base rate ก่อนสรุป','สื่อสาร uncertainty พร้อม confidence','ไม่เชื่อ evidence เดียวทันที'],
    s9:['ทำ IF-THEN reasoning trace','แยก forward/backward chain','ตรวจ circular rule ก่อนใช้','ให้ expert review rule trace'],
    s10:['แยก train validation test ให้ถูก','กัน data leakage และ future feature','ตรวจ feature กับ label ก่อน train','ใช้ validation จริงก่อนเลือก model'],
    s12:['ตีความ cluster โดยไม่ overclaim','validate cluster และ distance measure','ตรวจ outlier ก่อนลบ','ระวัง minority group hidden'],
    s13:['ดู validation ไม่ใช่ train loss อย่างเดียว','ตรวจ overfitting/generalization gap','ไม่เพิ่ม layer เป็นคำตอบทุกกรณี','เทียบ complexity กับ risk'],
    s14:['เทียบคำตอบกับ retrieval evidence','เช็ค citation ให้ตรง source','กัน hallucination และ prompt injection','ตรวจ stale document ก่อนตอบ'],
    s15:['วาง monitoring หลัง deploy','มี human fallback และ appeal','เก็บ audit trail ของระบบ','ตั้ง governance owner ชัดเจน'],
    b1:['เชื่อม AI agent problem ด้วย evidence','ตรวจ AI claim และ boundary ก่อนผ่าน','วาง PEAS fallback และ constraint','หยุดเมื่อ risk escalation'],
    b2:['เลือก strategy ตาม cost heuristic opponent','ตรวจ heuristic ก่อนใช้ A*','คิด worst case response','เทียบ optimality กับ risk'],
    b3:['เชื่อม knowledge uncertainty rule trace','แก้ evidence conflict ก่อนสรุป','บอก uncertainty พร้อม explanation','ตรวจ circular inference และ prior'],
    b4:['ประเมิน pipeline metric bias ก่อน deploy','hold เมื่อ FP/FN หรือ drift เสี่ยง','แยก validation กับ test ให้ชัด','ตั้ง monitoring และ review'],
    b5:['ตรวจ RAG evidence และ audit trail','กัน hallucination ก่อน final deploy','มี monitoring human oversight appeal','วาง safe deployment ตาม risk']
  };
  const genericWrong=['เลือกจากคะแนนรวมที่ดูสูงสุด','ใช้ค่า default ต่อไปเพื่อความเสถียร','ให้ระบบทำก่อนแล้วค่อยตรวจทีหลัง','แก้เฉพาะหน้าจอโดยไม่แตะ logic','ดูเฉพาะเคสที่ระบบมั่นใจ','ลดขั้นตอนตรวจเพื่อให้ใช้งานเร็ว','เชื่อ dashboard ถ้าสถานะเป็นสีเขียว','ให้ human review เฉพาะเมื่อมีคนร้องเรียน'];
  const s11Focus=['Confusion matrix','Threshold','Precision','Recall','Class imbalance','F1-score','False positive','False negative'];
  const s11Ask={
    'Confusion matrix':'ต้องการเห็นว่าระบบสลับคลาสใดกับคลาสใด ไม่ใช่ดูคะแนนรวม',
    Threshold:'ต้องเลือกเส้นตัดสินก่อนเปิดใช้ โดยดูผลต่อคนที่ถูกแจ้งผิดและคนที่หลุด',
    Precision:'งานนี้เสียหายหลักเกิดจากการแจ้งว่า “ใช่” ทั้งที่จริงไม่ใช่',
    Recall:'งานนี้เสียหายหลักเกิดจากการปล่อยเคสจริงให้หลุดโดยไม่ถูกตรวจพบ',
    'Class imbalance':'ข้อมูลคลาสปกติมีมากกว่าเคสปัญหา จึงทำให้คะแนนรวมดูดีเกินจริง',
    'F1-score':'ต้องบาลานซ์ความแม่นของการแจ้งกับการไม่พลาดเคสจริงในระดับใกล้กัน',
    'False positive':'ต้องอธิบายผลกระทบเมื่อระบบทำนายว่าเป็นเคสเป้าหมาย แต่จริงไม่ใช่',
    'False negative':'ต้องอธิบายผลกระทบเมื่อระบบทำนายว่าไม่ใช่เคสเป้าหมาย แต่จริงใช่'
  };
  const s11Options={
    'Confusion matrix':{ok:['อ่านตารางสับสนรายคลาส แล้วดูช่องที่สลับกัน','เทียบ TP FP FN TN ก่อนสรุปคุณภาพ','ดู error matrix เพื่อแยกชนิดความผิดพลาด'],bad:['ใช้ F1 ค่าเดียวแทนทุกช่องผิดพลาด','ดู confidence เฉลี่ยแล้วสรุปว่าพอใช้','รายงาน accuracy รวมโดยไม่เปิดดูคลาสย่อย','ตรวจเฉพาะคลาสใหญ่เพราะมีข้อมูลมากกว่า','ปรับ threshold ก่อนรู้ว่า FP/FN อยู่คลาสใด']},
    Threshold:{ok:['ลองหลาย cutoff แล้วเทียบ FP/FN impact','ตั้งเส้นตัดสินจากต้นทุนของ error แต่ละแบบ','ปรับ cutoff พร้อมบันทึกผลต่อผู้ใช้แต่ละกลุ่ม'],bad:['ใช้ค่า default เพราะ library ตั้งมาแล้ว','เลือก cutoff ที่ทำให้ accuracy รวมสูงสุด','ปรับจาก demo รอบเดียวแล้ว deploy','ใช้ cutoff เดียวกับทุกระดับความเสี่ยง','เลื่อน cutoff จนกราฟดูสวยแต่ไม่ดู error cases']},
    Precision:{ok:['วัดสัดส่วนแจ้งถูกในกลุ่มที่ระบบบอกว่าใช่','เน้นลดการแจ้งผิดก่อนปล่อย action','ตรวจ positive prediction ว่าเชื่อถือได้แค่ไหน'],bad:['เพิ่ม recall ให้จับครบแม้แจ้งผิดเพิ่มมาก','ลด cutoff เพื่อกวาดเคสให้ได้มากที่สุด','ดูจำนวนถูกทั้งหมดแทนคุณภาพของการแจ้งบวก','ใช้ F1 ทันทีโดยไม่ถามว่าการแจ้งผิดแพงกว่าไหม','สรุปจาก confusion matrix โดยไม่แยก FP cost']},
    Recall:{ok:['วัดว่าสามารถจับเคสจริงได้ครบเพียงใด','เน้นลดเคสจริงที่หลุดจากการตรวจพบ','ตรวจ actual positive ว่าระบบพลาดไปเท่าไร'],bad:['เพิ่ม precision ให้แม่นขึ้นแม้พลาดเคสจริง','เพิ่ม cutoff จนคำตอบแม่นแต่หลุดเยอะ','ดูเฉพาะ positive prediction ที่ระบบมั่นใจ','ใช้ accuracy รวมแทนการนับเคสจริงที่หลุด','ให้ human review เฉพาะเคสที่ระบบแจ้งแล้ว']},
    'Class imbalance':{ok:['แยกผลตามแต่ละคลาสก่อนเชื่อคะแนนรวม','ดู minority class เพิ่ม ไม่ใช้ accuracy เดียว','ตรวจว่า class หลักกลบ error ของเคสสำคัญหรือไม่'],bad:['ใช้ accuracy เพราะ class หลักทายถูกจำนวนมาก','สุ่มดูตัวอย่างจากคลาสใหญ่เป็นหลัก','รวมทุกกลุ่มเป็นค่าเฉลี่ยเดียวเพื่อลดความซับซ้อน','ตัด minority class ออกเพราะมีข้อมูลน้อย','เพิ่มข้อมูลคลาสใหญ่เพื่อให้คะแนนนิ่งขึ้น']},
    'F1-score':{ok:['ใช้เมื่อ precision และ recall สำคัญใกล้กัน','บาลานซ์การแจ้งถูกกับการไม่พลาดเคสจริง','เทียบ F1 หลังดู FP/FN แล้วว่าหนักพอกัน'],bad:['ใช้ precision อย่างเดียวแม้กลัวเคสหลุด','ใช้ recall อย่างเดียวแม้กลัวแจ้งผิด','เลือก metric ที่สูงสุดบน dashboard','ไม่ดู FP/FN เพราะมี F1 แล้ว','ใช้ accuracy เพราะอธิบายง่ายกว่า']},
    'False positive':{ok:['ระบุว่าใครเสียเวลา/ต้นทุนจากการแจ้งผิด','นับกรณีระบบบอกว่าใช่แต่ความจริงไม่ใช่','ประเมิน action ผิดที่เกิดจาก positive ผิดพลาด'],bad:['อธิบายเป็นเคสจริงที่ระบบไม่เจอ','นับเฉพาะความผิดพลาดที่ผู้ใช้ร้องเรียน','ถือว่า FP เล็กน้อยเสมอเพราะแก้ทีหลังได้','ลด threshold โดยไม่ดูการแจ้งผิดที่เพิ่ม','รายงานว่าผิดกี่ครั้งแต่ไม่บอกผลกระทบ']},
    'False negative':{ok:['ระบุว่าใครหลุดการดูแลเพราะระบบไม่แจ้ง','นับกรณีระบบบอกว่าไม่ใช่แต่ความจริงใช่','ประเมินความเสียหายจากเคสจริงที่ไม่ถูกจับ'],bad:['อธิบายเป็นการแจ้งผิดทั้งที่ไม่มีปัญหา','ดูเฉพาะเคสที่ระบบตรวจพบแล้ว','ถือว่า FN ไม่สำคัญถ้าคะแนนรวมยังสูง','เพิ่ม threshold แล้วไม่ดูเคสหลุด','รายงานว่าผิดกี่ครั้งแต่ไม่บอกใครได้รับผล']}
  };
  const s14Focus=['RAG','Retrieval evidence','Citation','Hallucination','Prompt injection','Stale document','Embedding','Token'];
  const s14Ask={
    RAG:'ต้องตอบโดยอาศัยเอกสารที่ค้นคืนได้จริง ไม่ใช่ความจำของโมเดล',
    'Retrieval evidence':'ต้องตรวจว่า passage ที่ค้นคืนรองรับคำตอบแต่ละ claim หรือไม่',
    Citation:'ต้องพิสูจน์ว่าแหล่งอ้างอิงตรงกับ claim และเป็นเอกสารถูกฉบับ',
    Hallucination:'เมื่อหลักฐานไม่พอ ระบบควรหยุดหรือบอกความไม่แน่ใจ',
    'Prompt injection':'คำสั่งจากผู้ใช้หรือเอกสารต้องไม่ล้ม policy หลักของระบบ',
    'Stale document':'เอกสารอาจหมดอายุหรือเป็นคนละ version กับนโยบายปัจจุบัน',
    Embedding:'คะแนน similarity ช่วยค้นหา แต่ไม่ได้ยืนยันว่าข้อความนั้นจริง',
    Token:'การแบ่ง token เป็นขั้นประมวลผลภาษา ไม่ใช่หลักฐานความถูกต้อง'
  };
  const s14Options={
    RAG:{ok:['ดึง source ที่เกี่ยวข้องแล้วตอบจากหลักฐาน','เทียบคำตอบกับ passage ที่ retrieval ได้จริง','หยุดตอบเมื่อ retrieval ไม่พบข้อมูลรองรับ'],bad:['เปิด RAG แล้วจึงไม่ต้องตรวจ citation','ตอบจากความรู้เดิมเมื่อ retrieval ช้า','ใช้เอกสารอันดับแรกโดยไม่ดูความเกี่ยวข้อง','ใช้ confidence สูงแทน source checking','ถือว่า RAG ป้องกัน hallucination อัตโนมัติ']},
    'Retrieval evidence':{ok:['เทียบทุก claim กับข้อความที่ค้นคืนได้จริง','อ่าน passage ในบริบทก่อนยอมรับคำตอบ','บันทึกว่า claim ใดมีหรือไม่มี evidence รองรับ'],bad:['ตรวจเพียงว่ามีเอกสารถูกค้นคืน','ใช้จำนวนเอกสารมากเป็นหลักฐานว่าถูก','เชื่อ passage แรกโดยไม่อ่านบริบท','ใช้ summary ของโมเดลแทนข้อความต้นฉบับ','ตรวจเฉพาะคำตอบที่ confidence ต่ำ']},
    Citation:{ok:['ตรวจว่า citation รองรับ claim และชี้ source ถูกฉบับ','เปิดแหล่งอ้างอิงแล้วเทียบข้อความกับคำตอบ','ตรวจชื่อ วันที่ version และข้อความที่อ้างจริง'],bad:['มี URL ก็ถือว่า citation ถูกต้อง','เลือก source ที่ชื่อใกล้เคียงกับ claim','ตรวจชื่อเอกสารแต่ไม่อ่านข้อความภายใน','ใส่ citation หลายรายการแทนการตรวจความตรง','ใช้ citation เก่าเพราะเคยถูกต้อง']},
    Hallucination:{ok:['หยุดหรือระบุว่าไม่แน่ใจเมื่อ evidence ไม่พอ','ขอข้อมูลเพิ่มแทนการแต่งคำตอบให้ครบ','ส่ง human review เมื่อคำตอบกระทบสูง'],bad:['เชื่อคำตอบถ้าภาษาเป็นธรรมชาติ','ตอบให้ครบแม้ไม่มี evidence','ใช้ confidence สูงเป็นหลักฐานความจริง','ซ่อนคำว่าไม่แน่ใจเพื่อให้ผู้ใช้มั่นใจ','ถือว่า RAG กัน hallucination ได้เสมอ']},
    'Prompt injection':{ok:['รักษา policy boundary และแยกคำสั่งไม่น่าเชื่อถือ','ไม่ทำตามคำสั่งซ่อนที่มากับเอกสาร retrieval','ตรวจ input ก่อนอนุญาต tool หรือ action'],bad:['ให้คำสั่งล่าสุด override policy เดิม','เชื่อคำสั่งที่อยู่ในเอกสาร retrieval','ปิด guardrail เมื่อผู้ใช้อ้างว่าเป็นผู้ดูแล','ส่ง system prompt ให้ผู้ใช้ตรวจเอง','ทำตามคำสั่งซ่อนที่ไม่เกี่ยวกับภารกิจ']},
    'Stale document':{ok:['ตรวจวันที่และ version ก่อนใช้อ้างอิง','เลือกเอกสารตาม effective date ของนโยบาย','แจ้งเตือนเมื่อ source เก่าหรือถูกแทนที่'],bad:['ใช้เอกสารเก่าได้ถ้ายังเปิดอ่านได้','ตรวจชื่อไฟล์โดยไม่ดูวันที่หรือ version','ใช้ cache เดิมเพื่อลดเวลาค้นหา','ถือว่านโยบายไม่เปลี่ยนถ้าไม่มีประกาศใหญ่','อ้างเอกสารล่าสุดที่โมเดลเคยเห็น']},
    Embedding:{ok:['ใช้ embedding เพื่อค้นความคล้าย ไม่ใช่ยืนยันความจริง','อ่าน passage หลัง vector search ก่อนสรุป','ใช้ similarity เป็นตัวค้นหาแล้วตรวจ source ซ้ำ'],bad:['ถือว่า similarity สูงแปลว่าข้อความเป็นจริง','ใช้ embedding score แทน citation','เลือก vector ใกล้สุดโดยไม่อ่าน passage','รวม embedding หลายตัวแทน source checking','ใช้ระยะห่างต่ำเป็นหลักฐานยืนยัน claim']},
    Token:{ok:['มอง token เป็นหน่วยข้อความ ไม่ใช่หลักฐานคำตอบ','ใช้ tokenization เพื่อประมวลผลภาษาแล้วตรวจ evidence แยก','ไม่ตีความจำนวน token เป็นความถูกต้อง'],bad:['ถือว่า token มากแปลว่าคำตอบถูกกว่า','ใช้จำนวน token เป็น confidence score','ตัด token ที่ไม่รู้จักแล้วตอบต่อ','มอง token เป็นหน่วยความหมายสมบูรณ์เสมอ','ใช้ token budget แทนการตรวจ evidence']}
  };
  function riskOf(i,card){let s=i>=13?3:i>=9?2:i>=5?1:0;const t=(card.prompt+' '+card.policy+' '+card.concept).toLowerCase();if(t.includes('critical')||t.includes('rights')||t.includes('privacy')||t.includes('human')||t.includes('safe'))s++;return riskLevels[Math.max(0,Math.min(3,s))];}
  function padSimilar(options){const lens=options.map(x=>clean(x).length),max=Math.max(...lens);return options.map(o=>{let v=clean(o);if(v.length<max-18)v+=' ในเคสนี้';return v;});}
  function packCard(card,i,round,focus,ask,pack,prefix,versionTag){
    const ok=pick(pack.ok,'ok|'+focus+'|'+shortContext(card)+'|'+i+'|'+round);
    const start=hash('bad|'+focus+'|'+shortPolicy(card)+'|'+i+'|'+round)%pack.bad.length,bad=[];
    for(let k=0;k<pack.bad.length&&bad.length<3;k++){const v=clean(pack.bad[(start+k)%pack.bad.length]);if(v!==ok&&!bad.includes(v))bad.push(v);}
    const all=padSimilar([ok].concat(bad));
    return {...card,concept:focus,correct:all[0],distractors:all.slice(1),prompt:'['+riskOf(i,card)+' RISK] '+shortContext(card)+' • '+ask+'\n'+prefix,principle:versionTag+' • '+focus+' • คำตอบที่ถูกต้องต้องโยง concept → evidence/risk → action ที่เหมาะสม',fingerprint:versionTag+'|'+focus+'|'+shortContext(card)+'|'+shortPolicy(card),challengeTrap:pick(traps[idOf(versionTag)]||traps.s14,'trap|'+versionTag+'|'+focus+'|'+i),challengeVersion:VERSION};
  }
  function makeS11(card,i,round){const focus=s11Focus[(i+(round||0))%s11Focus.length];return packCard(card,i,round,focus,s11Ask[focus],s11Options[focus],'ตัดสินจากผลกระทบของ error ไม่ใช่จากคำที่ดูสวยที่สุด','s11');}
  function makeS14(card,i,round){const focus=s14Focus[(i+(round||0))%s14Focus.length];return packCard(card,i,round,focus,s14Ask[focus],s14Options[focus],'ตรวจ source, claim, citation, policy boundary และความสดของเอกสารก่อนใช้คำตอบ','s14');}
  function makeGeneric(sid,card,i,round){
    const risk=riskOf(i,card),trap=pick(traps[sid]||traps.s1,'trap|'+sid+'|'+i+'|'+round),okPool=genericCorrect[sid]||genericCorrect.s1,ok=pick(okPool,'ok|'+sid+'|'+(card.fingerprint||card.id||i)+'|'+round);
    const badPool=genericWrong.concat(genericWrong).concat(['ใช้ '+clean(card.concept||'ผลลัพธ์')+' ทันทีถ้าคะแนนดี','ตรวจ '+trap+' หลัง deploy','เลือกทางที่เร็วที่สุดก่อน']),start=hash('bad|'+sid+'|'+i+'|'+round)%badPool.length,bad=[];
    for(let k=0;k<badPool.length&&bad.length<3;k++){const v=clean(badPool[(start+k)%badPool.length]);if(v!==ok&&!bad.includes(v))bad.push(v);}
    const all=padSimilar([ok].concat(bad));
    return {...card,correct:all[0],distractors:all.slice(1),riskLevel:risk,challengeTrap:trap,challengeVersion:VERSION,prompt:'['+risk+' RISK] '+clean(card.prompt||card.context||card.concept||'เลือกคำตอบจากหลักฐาน')+'\nตรวจจาก context, evidence และผลกระทบของการตัดสินใจ',principle:clean(card.principle||'')+' • v712.7: balanced choices, no length cue, no-repeat deck • Trap: '+trap+' • Risk: '+risk};
  }
  function enhance(raw,id,round){
    const sid=idOf(id),r=Number(round||1),out=[];
    (raw||[]).slice(0,15).forEach((c,i)=>{let card=sid==='s11'?makeS11({...c},i,r):sid==='s14'?makeS14({...c},i,r):makeGeneric(sid,{...c},i,r);card.answerSlot=slotPattern[(i+r)%slotPattern.length];card.riskLevel=card.riskLevel||riskOf(i,card);card.comboTitle=comboTitles[Math.min(comboTitles.length-1,Math.floor(i/3))];out.push(card);});
    out.challengeAudit={version:VERSION,noRepeatWindow:'last 4 decks / 60 fingerprints',antiGuessPolish:'v712.7 S11 preserved / S14 concept-specific RAG calibration / reflection paste guard / no longest-answer cue',uniqueCorrect:new Set(out.map(c=>c.correct)).size,uniqueDistractors:new Set(out.flatMap(c=>c.distractors)).size,slots:[0,1,2,3].map(s=>out.filter(c=>c.answerSlot===s).length),riskMix:riskLevels.map(r=>out.filter(c=>c.riskLevel===r).length),traps:out.map(c=>c.challengeTrap)};
    return out;
  }
  function patch(){
    const C=window.AIQuestAllContentV702;if(!C||C.__challengeV7127)return false;
    const base=C.deck.bind(C);
    C.deck=function(id,round){const sid=idOf(id),r=Number(round||1),hist=new Set(recent(sid));let raw=[];for(let bump=0;bump<8&&raw.length<15;bump++){(base(sid,r+bump)||[]).forEach(c=>{const fp=c.fingerprint||c.id;if(raw.length<15&&!hist.has(fp)&&!raw.find(x=>(x.fingerprint||x.id)===fp))raw.push(c);});}if(raw.length<15)(base(sid,r+99)||[]).forEach(c=>{if(raw.length<15&&!raw.find(x=>(x.fingerprint||x.id)===(c.fingerprint||c.id)))raw.push(c);});const deck=enhance(raw,sid,r);rememberDeck(sid,deck);return deck;};
    C.rank=rank;C.comboTitle=comboTitle;C.rememberMiss=rememberMiss;C.challengeLayerVersion=VERSION;C.version='v7.0.2+challenge712.7';
    C.__challengeV7127=C.__challengeV7126=C.__challengeV7125=C.__challengeV7124=C.__challengeV7123=C.__challengeV7122=C.__challengeV7121=C.__challengeV712=C.__challengeV706=true;
    return true;
  }
  function suspiciousReflection(text){const t=String(text||'');return t.length>2500||((t.match(/\t/g)||[]).length>=8)||/challenge711_[a-z0-9]+[\s\S]*"schemaVersion"\s*:\s*"challenge-v711"/i.test(t)||/2026-\d\d-\d\dT\d\d:\d\d:\d\d[^\n]*challenge711_/i.test(t);}
  function installReflectionGuard(){const fields=['r1','r2','r3'].map(id=>document.getElementById(id)).filter(Boolean),note=document.getElementById('saveNote'),save=document.getElementById('save');fields.forEach(el=>el.addEventListener('paste',e=>{const text=(e.clipboardData||window.clipboardData)?.getData('text')||'';if(suspiciousReflection(text)){e.preventDefault();if(note){note.className='notice bad';note.textContent='⚠️ ตรวจพบข้อมูลทั้งแถวหรือ JSON log จึงไม่วางลง Reflection กรุณาวางเฉพาะคำตอบของข้อนี้';}el.focus();}}));if(save)save.addEventListener('click',e=>{const bad=fields.find(el=>suspiciousReflection(el.value));if(bad){e.preventDefault();e.stopImmediatePropagation();if(note){note.className='notice bad';note.textContent='⚠️ ยังส่งไม่ได้: Reflection มีข้อมูลทั้งแถว/JSON log กรุณาลบแล้วใส่เฉพาะคำตอบ';}bad.focus();}},true);}
  if(!patch())document.addEventListener('DOMContentLoaded',patch,{once:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installReflectionGuard,{once:true});else installReflectionGuard();
  window.AIQuestChallengeLayerV706={version:VERSION,replayRules:['S11 hard distractor quality','S14 concept-specific RAG distractors','No concept-answer mismatch','No duplicated suffixes','Reflection TSV/JSON paste guard','No longest/shortest answer cue','Balanced answer slots','No-repeat deck'],rank,comboTitle,rememberMiss};
  window.AIQuestChallengeLayerV712=window.AIQuestChallengeLayerV706;window.AIQuestChallengeLayerV7121=window.AIQuestChallengeLayerV706;window.AIQuestChallengeLayerV7122=window.AIQuestChallengeLayerV706;window.AIQuestChallengeLayerV7123=window.AIQuestChallengeLayerV706;window.AIQuestChallengeLayerV7124=window.AIQuestChallengeLayerV706;window.AIQuestChallengeLayerV7125=window.AIQuestChallengeLayerV706;window.AIQuestChallengeLayerV7126=window.AIQuestChallengeLayerV706;window.AIQuestChallengeLayerV7127=window.AIQuestChallengeLayerV706;
})();