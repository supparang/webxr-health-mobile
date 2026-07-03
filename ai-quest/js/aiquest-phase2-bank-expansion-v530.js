/*
  CSAI2102 AI Quest
  v5.3.1 — Phase 2 Replay Bank Expansion
  ----------------------------------------
  Adds 40 scenario variants to each of S8, S9 and B3. Together with
  the 20-item base banks, every mission now has 60 valid items.
*/
(function(){
  'use strict';
  const VERSION='v5.3.1-phase2-replay-bank-60';
  const root=window.AIQuestPhase2Banks;
  if(!root||!root.CONFIG){console.warn('[AIQuest] Phase 2 base banks unavailable');return;}
  if(root.__v531Expanded)return;
  const q=(id,phase,family,prompt,answer,distractors,explain,hint)=>({id,phase,family,prompt,answer,distractors,explain,hint});
  const add=(mission,items)=>{const bank=root.CONFIG[mission].bank;const ids=new Set(bank.map(x=>x.id));items.forEach(item=>{if(!ids.has(item.id)){bank.push(item);ids.add(item.id);}});};

  const s8=[];
  const posteriorCases=[
    [12,9,'ระบบคัดกรองโรคหายาก','12/21 หรือประมาณ 57%'],[15,5,'ระบบคัดกรองทุน','15/20 หรือ 75%'],[18,12,'ระบบแจ้งเหตุฉุกเฉิน','18/30 หรือ 60%'],[24,6,'ระบบตรวจความผิดปกติ','24/30 หรือ 80%'],[10,15,'ระบบคัดกรองข้อความอันตราย','10/25 หรือ 40%'],[21,9,'ระบบเตือนภัยอาคาร','21/30 หรือ 70%'],[14,7,'ระบบตรวจสิทธิ์พิเศษ','14/21 หรือประมาณ 67%'],[16,4,'ระบบตรวจปัญหาเครือข่าย','16/20 หรือ 80%'],[9,6,'ระบบคัดกรองเอกสาร','9/15 หรือ 60%'],[27,3,'ระบบคัดกรองความเสี่ยงสูง','27/30 หรือ 90%']
  ];
  posteriorCases.forEach(([tp,fp,context,answer],i)=>s8.push(q(`s8x_post_${i+1}`,'Bayes Updating','posterior_count',`ใน${context} ระบบให้ผลบวกจริง ${tp} ราย และผลบวกผิด ${fp} ราย หากระบบแจ้งผลบวก โอกาสที่เป็นกรณีจริงคือเท่าใด`,answer,[`${tp}/${tp+fp+10}`,`${fp}/${tp+fp}`,`${tp}/${tp+fp+20}`],`ผลบวกทั้งหมด = true positive ${tp} + false positive ${fp}; posterior = ${tp}/(${tp}+${fp})`,'นับเฉพาะกลุ่มผลบวก แล้วแยก true/false positive')));
  const thresholds=[
    ['ห้องฉุกเฉิน','false negative อาจทำให้พลาดการช่วยเหลือ'],['ระบบเตือนภัยไฟไหม้','การพลาดเหตุจริงมีต้นทุนสูง'],['ระบบลบอีเมล','false positive อาจลบอีเมลสำคัญ'],['คัดกรองทุน','คำตัดสินมีผลต่อสิทธิ์'],['ตรวจจับทุจริต','การกล่าวหาผิดมีผลกระทบสูง'],['คัดกรองเนื้อหา','ต้องสมดุลความปลอดภัยกับการไม่ปิดกั้นเกินจำเป็น'],['ตรวจความเสี่ยงการเงิน','ต้นทุนอนุมัติผิดและปฏิเสธผิดต่างกัน'],['ผู้สมัครงาน','threshold อาจกระทบความเป็นธรรมระหว่างกลุ่ม'],['แจ้งเตือนสุขภาพ','score ไม่ใช่คำวินิจฉัย'],['server monitoring','alert มากเกินทำให้ทีมละเลยสัญญาณจริง']
  ];
  thresholds.forEach(([context,why],i)=>s8.push(q(`s8x_threshold_${i+1}`,i<5?'Probability Judgment':'Explain Decision','decision_threshold',`สำหรับ${context} เหตุใดจึงไม่ควรตั้ง threshold จาก accuracy รวมเพียงอย่างเดียว`,`เพราะต้องพิจารณาต้นทุน false positive/false negative และผลกระทบ (${why})`,['เพราะ threshold ต้องเป็น 0.5 เสมอ','เพราะ probability ไม่ต้องมีมนุษย์','เพราะ model ที่ดีไม่เคยผิด'],'Threshold คือการตัดสินใจเชิงนโยบายภายใต้ต้นทุนของ error','ถามว่า error แบบใดสร้างผลเสียมากกว่า')));
  const uncertainties=[
    ['sensor หายบางช่วง','แสดงว่าข้อมูลไม่ครบและขอหลักฐานเพิ่ม'],['ข้อมูลฝึกมาจากคนละพื้นที่','ระบุ data shift และลดความมั่นใจ'],['ผู้ใช้ส่งหลักฐานใหม่ที่น่าเชื่อถือ','รวม evidence ใหม่เพื่อ update belief'],['confidence สูงแต่ผลจริงไม่สอดคล้อง','ตรวจ calibration'],['ผลเสี่ยงสูงแต่ evidence ขัดกัน','ส่ง human review'],['prior ต่ำมากแต่ test positive','ตรวจ base rate และ false positive'],['confidence เพียง 52%','ไม่สื่อสารเป็นคำตอบเด็ดขาด'],['ผู้ใช้ถามเหตุผลของ score','อธิบาย evidence และ limitation'],['กลุ่มผู้ใช้ใหม่ต่างจากข้อมูลฝึก','ตรวจ generalization ก่อนใช้ threshold เดิม'],['ผลกระทบต่อสิทธิ์บุคคล','เพิ่ม human review และช่องอุทธรณ์']
  ];
  uncertainties.forEach(([situation,answer],i)=>s8.push(q(`s8x_uncertainty_${i+1}`,i<5?'Uncertainty Concepts':'Explain Decision','uncertainty_governance',`เมื่อ${situation} ระบบ AI ที่รับผิดชอบควรทำอย่างไร`,answer,['ซ่อน uncertainty','เพิ่ม confidence เป็น 100%','ยืนยันผลเดิมโดยไม่ดูหลักฐาน'],'ต้องเชื่อม data quality, calibration และ human oversight','คำตอบที่ดีมี limitation และ next step')));
  const probabilityChecks=[
    ['P(A|B)','เป็นความน่าจะเป็นของ A ภายใต้เงื่อนไข B'],['posterior สูงกว่า prior','evidence ใหม่เพิ่มความเชื่อใน hypothesis'],['heuristic ไม่ใช่ probability','heuristic คือค่าประมาณเพื่อการค้นหา ไม่ใช่ความเชื่อแบบ Bayes'],['test sensitivity สูง','หมายถึง test มักบวกเมื่อกรณีจริงเป็นบวก'],['false positive สูง','ผลบวกอาจไม่ได้หมายถึงกรณีจริงเสมอ'],['calibrated 70%','กลุ่มที่ทำนาย 70% ควรเกิดจริงใกล้ 70%'],['threshold ต่ำลง','จะจับกรณีได้มากขึ้นแต่ false positive อาจเพิ่ม'],['evidence ไม่เกี่ยวข้อง','ไม่ควรมีน้ำหนักมากต่อ posterior'],['prior เปลี่ยนตามกลุ่ม','base rate อาจต่างกันตามบริบท'],['uncertainty สูง','ควรสื่อสารข้อจำกัดและแนวทางตรวจเพิ่ม']
  ];
  probabilityChecks.forEach(([term,answer],i)=>s8.push(q(`s8x_prob_${i+1}`,'Probability Judgment','probability_literacy',`ข้อใดอธิบาย “${term}” ได้เหมาะสมที่สุด`,answer,['เป็นคำรับประกันว่าระบบถูกเสมอ','เป็นค่าใช้แทน explanation ทั้งหมด','เป็นเหตุผลให้ละเลยข้อมูลใหม่'],'การตีความ probability ต้องระบุเงื่อนไขและข้อจำกัด','แยก confidence, evidence และ decision ออกจากกัน')));
  add('s8',s8);

  const s9=[];
  const rules=[
    ['paid_fee(a) AND passed_prereq(a)','can_register(a)'],['has_card(b) AND no_overdue(b)','borrow_book(b)'],['trained(c) AND wears_goggles(c)','enter_lab(c)'],['income_low(d) AND documents_complete(d)','eligible_aid(d)'],['faculty(e) AND permit_valid(e)','allow_parking(e)'],['credits_complete(f) AND interview_pass(f)','eligible_intern(f)'],['high_risk(g) AND crowd(g)','dispatch_team(g)'],['enrolled(h) AND attendance_ok(h)','take_exam(h)'],['ticket_open(i) AND severity_high(i)','escalate(i)'],['project_valid(j) AND ethics_ok(j)','approve_grant(j)']
  ];
  rules.forEach(([left,right],i)=>{
    s9.push(q(`s9x_forward_${i+1}`,'Rule Reasoning','forward_variant',`facts ทำให้เงื่อนไข ${left} เป็นจริง และมี rule ${left} → ${right}. Forward chaining ควรสรุปอะไร`,right,[`not_${right}`,left,'unknown'],'Antecedent ครบ จึงอนุมาน consequent ตาม rule ได้','fact → rule → conclusion'));
    s9.push(q(`s9x_backward_${i+1}`,'Rule Reasoning','backward_variant',`ต้องการพิสูจน์ ${right}. หากมี rule ${left} → ${right} Backward chaining ควรตรวจอะไร`,left,['ค่า heuristic','ชื่อ user interface','จำนวน node'],'เริ่มจาก goal แล้วย้อนหา antecedent ของ rule','goal → required facts'));
  });
  const debugging=[
    ['risk_high(x1)','high_risk(x) → alert(x)','ชื่อ predicate ต่างกัน'],['paidFee(a)','paid_fee(x) → can_register(x)','รูปแบบ predicate ไม่ตรงกัน'],['has_card(b)','has_card(x) AND no_overdue(x) → borrow_book(x)','ขาด fact no_overdue(b)'],['eligible(a)','eligible(x) → approve(x)','ไม่รู้ facts/rules ที่สนับสนุน eligible(a)'],['room_open(r1) และ room_closed(r1)','room_open(x) → allow(x)','facts ขัดกัน ต้องใช้ conflict policy'],['score_high(m)','score_high(x) AND verified(x) → award(x)','ขาด evidence verified(m)'],['priorityHigh(n)','priority_high(x) → escalate(x)','การตั้งชื่อไม่สอดคล้องกัน'],['trained(c)','trained(x) AND safety_clear(x) → enter_lab(x)','ขาด fact safety_clear(c)'],['document_complete(d)','documents_complete(x) → eligible(x)','predicate singular/plural ไม่ตรง'],['permit_valid(e)','faculty(e) AND permit_valid(e) → allow_parking(e)','ขาด fact faculty(e)']
  ];
  debugging.forEach(([fact,rule,answer],i)=>s9.push(q(`s9x_debug_${i+1}`,'Explanation & Debug','rule_debug',`ฐานความรู้มี ${fact}; rule คือ ${rule}. เหตุใดระบบยังสรุปผลไม่ได้`,answer,['ต้องใช้ Minimax','ต้องเพิ่ม animation','ต้องลบทุก rule'],'ตรวจ predicate, antecedent ที่ขาด และ conflict ก่อน','เทียบ fact กับเงื่อนไขใน rule ทีละตัว')));
  const maintenance=[
    ['กฎเปลี่ยนตามนโยบายใหม่','review/version rules และทดสอบผลกระทบ'],['ผู้ใช้ถาม why','แสดง facts และ rules ที่นำไปสู่ conclusion'],['ข้อยกเว้นเพิ่มขึ้น','ตรวจ scope และเพิ่ม exception ผ่าน expert review'],['ผู้เชี่ยวชาญไม่เห็นด้วยกับ rule','บันทึกเหตุผลและ validate ก่อน deploy'],['knowledge ใหม่เข้ามา','ทำ knowledge acquisition และตรวจความถูกต้อง'],['กฎจำนวนมากทับกัน','ใช้ conflict resolution และ traceability'],['domain เปลี่ยนเร็ว','กำหนดรอบ maintenance และ owner ของ knowledge base'],['คำอธิบายไม่ตรงกับผล','debug inference trace และ rule version'],['ข้อมูล input หาย','บอก evidence ที่ขาด แทนการแต่ง conclusion'],['ผลมีผลกระทบสูง','เปิด human override และ audit trail']
  ];
  maintenance.forEach(([situation,answer],i)=>s9.push(q(`s9x_maintain_${i+1}`,'Applied Expert System','expert_governance',`เมื่อ${situation} Expert System ที่รับผิดชอบควรทำอะไร`,answer,['ใช้กฎเดิมต่อโดยไม่ตรวจ','ซ่อนเหตุผลจากผู้ใช้','สุ่มเลือก rule'],'Expert system ต้องมี knowledge maintenance, explanation และ oversight','คิดเรื่อง validation, versioning และ accountability')));
  add('s9',s9);

  const b3=[];
  const cases=[
    ['ทุนการศึกษา','เอกสารครบ แต่ score ไม่แน่ใจและมีข้อมูลรายได้ใหม่ที่ยังไม่ตรวจ','ขอ human review พร้อม update evidence และแสดง reasoning trace'],['แจ้งเหตุฉุกเฉิน','rule แนะนำ dispatch แต่ sensor บางตัวขัดกัน','ตรวจ conflict แล้วให้เจ้าหน้าที่ทบทวนก่อน action ผลสูง'],['คัดกรองสุขภาพ','prior ต่ำ แต่ test positive และ false positive สูง','อธิบาย posterior และแนะนำตรวจยืนยัน'],['อนุมัติสินเชื่อ','model score สูงแต่เอกสารสำคัญไม่ครบ','ขอ evidence เพิ่มและให้ผู้ดูแลตรวจ'],['คัดกรองเนื้อหา','model flag เสี่ยงแต่ rule เชิงบริบทไม่ครบ','ส่งตรวจทาน ไม่ลบอัตโนมัติ'],['ผู้สมัครงาน','rule เก่าขัดกับนโยบายล่าสุด','ใช้ versioned rule ผ่าน review และตรวจผลกระทบ'],['ระบบจราจร','prediction สูงแต่ sensor หลักขาดช่วง','สื่อสาร confidence ต่ำและใช้ข้อมูลทางเลือก'],['สิทธิ์เข้าแลบ','ผ่านอบรมแต่ certificate หมดอายุ','ตรวจ conflict และยืนยันเอกสารก่อนอนุญาต'],['แจ้งเตือนภัย','posterior สูงและ rule ครบ แต่กระทบชุมชนสูง','เริ่ม action ตามแผนพร้อม reasoning และ human override'],['แนะนำการเรียน','คำแนะนำมาจากข้อมูลผู้เรียนไม่ครบ','แสดง limitation และให้ผู้เรียน/อาจารย์ทบทวนร่วมกัน']
  ];
  cases.forEach(([context,evidence,answer],i)=>b3.push(q(`b3x_case_${i+1}`,'Integrated Reasoning','integrated_case',`เคส${context}: ${evidence}. แนวทางที่รับผิดชอบที่สุดคืออะไร`,answer,['ยืนยันผลจาก model ทันที','ใช้ rule เก่าโดยไม่ตรวจ evidence','ปิด uncertainty ไม่ให้ผู้ใช้เห็น'],'B3 ต้องรวม knowledge, uncertainty, explanation และ human oversight','มองหา evidence update + traceability + action ที่เหมาะกับผลกระทบ')));
  const traces=[
    ['fact: paid_fee(a), passed_prereq(a); rule: paid_fee(x) AND passed_prereq(x) → eligible(x)','eligible(a)','rule trace ชัดเจน'],['prior ต่ำ, test positive, false positive สูง','posterior ต้องคำนวณจากกลุ่มผลบวกทั้งหมด','base rate สำคัญ'],['model confidence 0.91 แต่กลุ่มผู้ใช้ใหม่','ตรวจ calibration/generalization ก่อนใช้ผลเด็ดขาด','confidence ไม่เท่ากับ correctness'],['rule ใหม่แทน policy เดิม','เก็บ versioning และทดสอบผลกระทบ','audit trail'],['facts สองแหล่งขัดกัน','ใช้ conflict resolution ก่อน inference','consistency check'],['ผู้ใช้ขอเหตุผล','แสดง evidence, rule/model และ limitation','explanation facility'],['high-stakes decision กับ confidence ต่ำ','เพิ่ม human review','human oversight'],['goal ยังพิสูจน์ไม่ได้','ระบุ evidence/rule ที่ขาด','open-world reasoning'],['ได้รับ evidence ใหม่','update belief และ re-evaluate','Bayesian update'],['rule มี exception ใหม่','ตรวจ scope และ exception ก่อน action','rule maintenance']
  ];
  traces.forEach(([caseText,answer,why],i)=>b3.push(q(`b3x_trace_${i+1}`,'Expert Explanation','reasoning_trace',`ข้อใดเป็น reasoning ที่ถูกต้องสำหรับสถานการณ์: ${caseText}`,answer,['เพราะ AI ฉลาดจึงสรุปได้','ใช้ accuracy รวมอย่างเดียว','ละเว้น evidence ที่ไม่ตรง'],`คำตอบที่ดีต้องมีเหตุผลตรวจสอบได้: ${why}`,'มองหาคำอธิบายที่ระบุ evidence, model/rule และ limitation')));
  const governance=[
    ['ใช้ข้อมูลผู้ใช้ใหม่โดยไม่แจ้งวัตถุประสงค์','ตรวจ consent, data governance และความโปร่งใส'],['false positive ต่างกันมากระหว่างกลุ่ม','วัด error/fairness แยกกลุ่มและทบทวน threshold'],['ผู้ใช้โต้แย้งผลและส่ง evidence ใหม่','เปิด appeal และ re-evaluate พร้อม audit log'],['นโยบายเปลี่ยนแต่ rules เก่า','review/version rules และทดสอบก่อน deploy'],['โมเดลมั่นใจสูงแต่ไม่มี explanation','เพิ่ม explainability และตรวจ calibration'],['คำแนะนำสุขภาพอัตโนมัติ','สื่อสารว่าไม่ใช่ diagnosis และมี escalation path'],['ฐานความรู้ขัดกัน','หยุด high-stakes conclusion และส่ง conflict review'],['evidence สำคัญขาดหาย','ขอข้อมูลเพิ่มหรือใช้ cautious action'],['ML score ร่วมกับ policy rule','แยก prediction กับ decision policy ให้ตรวจสอบได้'],['ต้องตัดสินใจเร็ว','ใช้ safe fallback และบันทึกเหตุผล/uncertainty']
  ];
  governance.forEach(([situation,answer],i)=>b3.push(q(`b3x_govern_${i+1}`,'Integrated Reasoning','responsible_ai',`เมื่อ${situation} ระบบ Reasoning & Knowledge ที่รับผิดชอบควรทำอะไร`,answer,['ปิดข้อมูลเพื่อให้เร็วขึ้น','ใช้ผลเดิมโดยไม่บันทึก','เพิ่ม confidence เป็น 100%'],'Responsible AI ต้องรวม governance, fairness, explanation และ oversight','มองหา action ที่รักษาความปลอดภัยและตรวจสอบได้')));
  const synthesis=[
    ['Fact/Rule และ Bayes','ใช้ rules เพื่อ policy/explanation และใช้ probability เพื่อสื่อ uncertainty'],['Posterior และ action','posterior เป็น belief ส่วน action ยังต้องผ่าน threshold/policy'],['Explanation และ fairness','ต้องอธิบายเกณฑ์และตรวจผลกระทบระหว่างกลุ่ม'],['Conflict และ human review','conflict ควร trigger review ก่อน high-stakes action'],['Model score และ evidence','score ไม่แทน evidence ทั้งหมด ต้องดู data quality'],['Versioning และ accountability','ต้องย้อนดูได้ว่า rule/model ใดสร้างผล'],['Open-world และ missing data','ไม่พบ fact ไม่ได้แปลว่า fact เป็น false'],['Calibration และ confidence','confidence มีประโยชน์เมื่อสอดคล้องกับผลจริง'],['Appeal และ evidence ใหม่','ระบบควร re-evaluate และเก็บ trace'],['Hybrid AI','ML prediction กับ rule policy สามารถทำงานร่วมกันอย่างโปร่งใส']
  ];
  synthesis.forEach(([topic,answer],i)=>b3.push(q(`b3x_synth_${i+1}`,'Knowledge & Rule','module_synthesis',`ข้อใดสรุปหลัก “${topic}” ได้เหมาะสมที่สุด`,answer,['ใช้ algorithm เดียวแทนทุกปัญหา','ซ่อน uncertainty เพื่อให้ผู้ใช้เชื่อ','ไม่ต้องให้มนุษย์ตรวจในงานผลกระทบสูง'],'Module 3 เน้น reasoning ที่ตรวจสอบได้และมีความรับผิดชอบ','เชื่อม knowledge, probability, explanation และ oversight')));
  add('b3',b3);

  root.__v531Expanded={version:VERSION,s8:s8.length,s9:s9.length,b3:b3.length,total:{s8:root.CONFIG.s8.bank.length,s9:root.CONFIG.s9.bank.length,b3:root.CONFIG.b3.bank.length}};
  console.log('[AIQuest] '+VERSION+' loaded',root.__v531Expanded);
})();