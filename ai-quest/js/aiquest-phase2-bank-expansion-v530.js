/*
  CSAI2102 AI Quest
  v5.3.0 — Phase 2 Replay Bank Expansion
  ----------------------------------------
  Extends the existing v5.2 banks with scenario variants so S8, S9 and B3
  each have 60+ valid items. The original selection/no-repeat engine remains
  responsible for selecting a balanced round from each phase.
*/
(function(){
  'use strict';

  const VERSION='v5.3.0-phase2-replay-bank-expansion';
  const root=window.AIQuestPhase2Banks;
  if(!root||!root.CONFIG){
    console.warn('[AIQuest] Phase 2 bank base not ready for expansion');
    return;
  }
  if(root.__v530Expanded) return;

  const q=(id,phase,family,prompt,answer,distractors,explain,hint)=>({id,phase,family,prompt,answer,distractors,explain,hint});
  const choice=(items,n)=>items[n%items.length];

  const s8=[];
  const bayesCases=[
    ['s8x_bayes_01',12,9,'โรคพบไม่บ่อย','9/18 หรือ 50%'],
    ['s8x_bayes_02',15,5,'การคัดกรองทุน','15/20 หรือ 75%'],
    ['s8x_bayes_03',18,12,'ตรวจความเสี่ยงเหตุฉุกเฉิน','18/30 หรือ 60%'],
    ['s8x_bayes_04',24,6,'ระบบตรวจความผิดปกติ','24/30 หรือ 80%'],
    ['s8x_bayes_05',10,15,'การคัดกรองข้อความอันตราย','10/25 หรือ 40%'],
    ['s8x_bayes_06',21,9,'ระบบเตือนภัยอาคาร','21/30 หรือ 70%'],
    ['s8x_bayes_07',14,7,'ระบบตรวจสิทธิ์พิเศษ','14/21 หรือประมาณ 67%'],
    ['s8x_bayes_08',16,4,'ระบบตรวจปัญหาเครือข่าย','16/20 หรือ 80%'],
    ['s8x_bayes_09',9,6,'ระบบคัดกรองเอกสาร','9/15 หรือ 60%'],
    ['s8x_bayes_10',27,3,'ระบบคัดกรองความเสี่ยงสูง','27/30 หรือ 90%']
  ];
  bayesCases.forEach(([id,tp,fp,context,answer])=>{
    s8.push(q(id,'Bayes Updating','posterior_count',`ใน ${context} มีผลบวกจริง ${tp} ราย และผลบวกผิด ${fp} ราย หากระบบแจ้งผลบวก โอกาสที่เป็นกรณีจริงคือเท่าใด`,answer,[`${tp}/${tp+fp+10}`,`${fp}/${tp+fp}`,`${tp}/${tp+fp+20}`],`ในกลุ่มผลบวกทั้งหมด มี true positive ${tp} และ false positive ${fp}; posterior = ${tp}/(${tp}+${fp})`,`นับเฉพาะคนที่ระบบแจ้งผลบวก แล้วแยก true/false positive`));
  });
  const thresholdContexts=[
    ['ห้องฉุกเฉิน','false negative อาจทำให้พลาดการช่วยเหลือที่จำเป็น'],
    ['ระบบเตือนภัยไฟไหม้','การพลาดเหตุจริงมีต้นทุนสูงมาก'],
    ['ระบบลบอีเมลอัตโนมัติ','false positive อาจลบอีเมลสำคัญ'],
    ['คัดกรองผู้มีสิทธิ์ทุน','คำตัดสินมีผลต่อสิทธิ์ของบุคคล'],
    ['ตรวจจับทุจริตการสอบ','การกล่าวหาผิดสร้างผลกระทบสูง'],
    ['คัดกรองเนื้อหาอันตราย','ต้องสมดุลการป้องกันกับการไม่ปิดกั้นเกินจำเป็น'],
    ['ตรวจความเสี่ยงทางการเงิน','การอนุมัติหรือปฏิเสธผิดมีต้นทุนต่างกัน'],
    ['ระบบคัดกรองผู้สมัครงาน','threshold อาจส่งผลต่อความเป็นธรรมระหว่างกลุ่ม'],
    ['แจ้งเตือนสุขภาพผ่านแอป','ผู้ใช้ไม่ควรตีความ score เป็นการวินิจฉัย'],
    ['ตรวจความผิดปกติของเซิร์ฟเวอร์','alert มากเกินไปอาจทำให้ทีมละเลยสัญญาณสำคัญ']
  ];
  thresholdContexts.forEach(([context,risk],i)=>{
    s8.push(q(`s8x_threshold_${i+1}`,i<5?'Probability Judgment':'Explain Decision','decision_threshold',`สำหรับ${context} เหตุใดจึงไม่ควรเลือก threshold จาก accuracy รวมเพียงอย่างเดียว`, `เพราะต้องพิจารณาต้นทุนของ false positive/false negative และผลกระทบต่อผู้ใช้ (${risk})`,['เพราะ threshold ต้องเป็น 0.5 เสมอ','เพราะ probability ทำให้ไม่ต้องมีมนุษย์','เพราะ model ที่ดีไม่เคยผิด'], 'Threshold คือการตัดสินใจเชิงนโยบาย ไม่ใช่ค่าทางคณิตศาสตร์ลอย ๆ','ถามว่า error แบบใดสร้างผลเสียมากกว่าในบริบทนั้น'));
  });
  const uncertaintyCases=[
    ['ข้อมูลจาก sensor หายบางช่วง','แสดงว่าข้อมูลไม่ครบและขอหลักฐานเพิ่ม'],
    ['โมเดลใช้ข้อมูลฝึกจากคนละพื้นที่','ระบุ data shift และลดความมั่นใจในการใช้ผล'],
    ['ผู้ใช้มีข้อมูลใหม่ที่เชื่อถือได้','รวม evidence ใหม่เพื่ออัปเดต belief'],
    ['confidence สูงแต่ผลจริงไม่สอดคล้อง','ตรวจ calibration ของโมเดล'],
    ['ผลลัพธ์เสี่ยงสูงแต่ evidence ขัดกัน','ส่งต่อ human review ก่อนตัดสินใจ'],
    ['prior ต่ำมากแต่ test ให้ผลบวก','พิจารณา base rate และ false positive ก่อนสรุป'],
    ['แบบจำลองให้ความมั่นใจ 52%','ไม่ควรสื่อสารเป็นคำตอบเด็ดขาด'],
    ['ผู้ใช้ถามว่าทำไมได้ score นี้','อธิบาย feature/evidence และ limitation ที่สำคัญ'],
    ['กลุ่มผู้ใช้ใหม่มีพฤติกรรมต่างจากข้อมูลฝึก','ตรวจ generalization ก่อนใช้ threshold เดิม'],
    ['ข้อผิดพลาดมีผลกระทบต่อสิทธิ์','เพิ่มการตรวจสอบโดยมนุษย์และช่องอุทธรณ์']
  ];
  uncertaintyCases.forEach(([situation,answer],i)=>{
    s8.push(q(`s8x_uncertainty_${i+1}`,i<5?'Uncertainty Concepts':'Explain Decision','uncertainty_governance',`เมื่อ${situation} ระบบ AI ที่รับผิดชอบควรทำอย่างไร`,answer,['ซ่อน uncertainty เพื่อให้ผู้ใช้มั่นใจ','เพิ่ม score เป็น 100%','ยืนยันผลเดิมโดยไม่ดูข้อมูล'], 'การจัดการ uncertainty ต้องเชื่อม data quality, calibration และ human oversight','คำตอบที่ดีต้องมีข้อจำกัดและ next step ที่ตรวจสอบได้'));
  });

  const s9=[];
  const ruleScenarios=[
    ['register','paid_fee(a) AND passed_prereq(a)','can_register(a)','can_register(a)'],
    ['library','has_card(b) AND no_overdue(b)','borrow_book(b)','borrow_book(b)'],
    ['lab','trained(c) AND wears_goggles(c)','enter_lab(c)','enter_lab(c)'],
    ['aid','income_low(d) AND documents_complete(d)','eligible_aid(d)','eligible_aid(d)'],
    ['parking','faculty(e) AND permit_valid(e)','allow_parking(e)','allow_parking(e)'],
    ['intern','credits_complete(f) AND interview_pass(f)','eligible_intern(f)','eligible_intern(f)'],
    ['emergency','high_risk(g) AND crowd(g)','dispatch_team(g)','dispatch_team(g)'],
    ['course','enrolled(h) AND attendance_ok(h)','take_exam(h)','take_exam(h)'],
    ['support','ticket_open(i) AND severity_high(i)','escalate(i)','escalate(i)'],
    ['grant','project_valid(j) AND ethics_ok(j)','approve_grant(j)','approve_grant(j)']
  ];
  ruleScenarios.forEach(([family,antecedent,rule,answer],i)=>{
    const who=String.fromCharCode(97+i);
    s9.push(q(`s9x_forward_${i+1}`,'Rule Reasoning','forward_variant',`ระบบมี facts ที่ทำให้เงื่อนไข ${antecedent} เป็นจริง และมี rule ${antecedent} → ${rule}. Forward chaining ควรสรุปอะไร`,answer,[`not_${answer}`,antecedent,`unknown(${who})`], 'เมื่อ antecedent ครบ ระบบสามารถอนุมาน consequent ตาม rule ได้','อ่าน fact ให้ครบทุกเงื่อนไขของ rule'));
    s9.push(q(`s9x_backward_${i+1}`,'Rule Reasoning','backward_variant',`ต้องการพิสูจน์ ${rule}. ถ้ามี rule ${antecedent} → ${rule} ควรตรวจอะไรเป็นอันดับแรกด้วย backward chaining`,antecedent,['ค่า heuristic','ชื่อ user interface','จำนวน node ใน game tree'], 'Backward chaining เริ่มจาก goal แล้วไล่หา antecedent ของ rule','goal → เงื่อนไขของ rule'));
  });
  const debugCases=[
    ['risk_high(x1)','high_risk(x) → alert(x)','ชื่อ predicate ต่างกัน'],
    ['paidFee(a)','paid_fee(x) → can_register(x)','รูปแบบ predicate ไม่ตรงกัน'],
    ['has_card(b)','has_card(x) AND no_overdue(x) → borrow_book(x)','ขาด fact no_overdue(b)'],
    ['eligible(a)','eligible(x) → approve(x)','ไม่รู้ว่ามี rule/ฐานความรู้ใดสนับสนุน eligible(a)'],
    ['room_open(r1) และ room_closed(r1)','room_open(x) → allow(x)','facts ขัดกัน ต้องใช้ conflict policy'],
    ['score_high(m)','score_high(x) AND verified(x) → award(x)','ขาด evidence verified(m)'],
    ['priorityHigh(n)','priority_high(x) → escalate(x)','การตั้งชื่อไม่สอดคล้องกัน'],
    ['trained(c)','trained(x) AND safety_clear(x) → enter_lab(x)','ขาด fact safety_clear(c)'],
    ['document_complete(d)','documents_complete(x) → eligible(x)','predicate singular/plural ไม่ตรง'],
    ['permit_valid(e)','faculty(e) AND permit_valid(e) → allow_parking(e)','ขาด fact faculty(e)']
  ];
  debugCases.forEach(([fact,rule,answer],i)=>{
    s9.push(q(`s9x_debug_${i+1}`,'Explanation & Debug','rule_debug_variant',`ฐานความรู้มี ${fact}; rule คือ ${rule}. เหตุใดระบบจึงยังสรุปผลที่คาดหวังไม่ได้`,answer,['ต้องใช้ Minimax','ต้องเพิ่ม animation','ต้องลบทุก rule'], 'Debug reasoning ต้องตรวจ predicate, antecedent ที่ขาด และ conflict ก่อน','เทียบ fact กับเงื่อนไขใน rule ทีละตัว'));
  });

  const b3=[];
  const integratedCases=[
    ['ทุนการศึกษา','มีเอกสารครบ แต่ score ความเสี่ยงไม่แน่ใจและมีข้อมูลรายได้ใหม่ที่ยังไม่ตรวจ','ขอ human review พร้อมอัปเดต evidence และแสดง reasoning trace'],
    ['แจ้งเหตุฉุกเฉิน','rule แนะนำ dispatch แต่ sensor บางตัวให้ข้อมูลขัดกัน','ตรวจ conflict แล้วให้เจ้าหน้าที่ทบทวนก่อนสรุป action ที่มีผลสูง'],
    ['คัดกรองสุขภาพ','prior ต่ำ แต่ผลตรวจบวกและ test มี false positive พอสมควร','อธิบาย posterior และแนะนำตรวจยืนยัน แทนการวินิจฉัยเด็ดขาด'],
    ['อนุมัติสินเชื่อ','model score สูงแต่เอกสารสำคัญไม่ครบ','ไม่อนุมัติอัตโนมัติ; ขอ evidence เพิ่มและให้ผู้ดูแลตรวจ'],
    ['คัดกรองเนื้อหา','model flag เนื้อหาเสี่ยง แต่ rule เชิงบริบทไม่ครบ','ส่งเข้าสู่การตรวจทาน ไม่ลบหรือแบนทันที'],
    ['ผู้สมัครงาน','rule คุณสมบัติเก่าขัดกับนโยบายล่าสุด','ใช้ versioned rule ที่ผ่าน review และตรวจผลกระทบ'],
    ['ระบบจราจร','โมเดลคาด congestion สูง แต่ sensor หลักขาดช่วง','สื่อสาร confidence ต่ำและใช้ข้อมูลทางเลือก/มนุษย์ตรวจ'],
    ['สิทธิ์เข้าแลบ','facts บ่งชี้ผ่านอบรมแต่ certificate หมดอายุ','ตรวจ conflict และไม่อนุญาตจนกว่าจะยืนยันกฎ/เอกสาร'],
    ['การแจ้งเตือนภัย','posterior สูงและ rule เงื่อนไขครบ แต่ผลกระทบต่อชุมชนสูง','เริ่ม action ตามแผนพร้อมบันทึกเหตุผลและช่องให้มนุษย์ override'],
    ['แนะนำการเรียน','AI ให้คำแนะนำจากข้อมูลไม่ครบของนักศึกษา','แสดง limitation และให้ผู้เรียน/อาจารย์ทบทวนร่วมกัน']
  ];
  integratedCases.forEach(([context,evidence,answer],i)=>{
    b3.push(q(`b3x_case_${i+1}`,'Integrated Reasoning','integrated_case',`เคส${context}: ${evidence}. แนวทางที่รับผิดชอบที่สุดคืออะไร`,answer,['ยืนยันผลจาก model ทันทีโดยไม่อธิบาย','ใช้ rule เก่าโดยไม่ตรวจ evidence','ปิดความไม่แน่ใจไม่ให้ผู้ใช้เห็น'], 'B3 ต้องบูรณาการ knowledge, uncertainty, explanation และ human oversight','มองหา evidence update + traceability + action ที่เหมาะกับผลกระทบ'));
  });
  const traceCases=[
    ['fact: paid_fee(a), passed_prereq(a); rule: paid_fee(x) AND passed_prereq(x) → eligible(x)','eligible(a)','rule trace ชัดเจน'],
    ['prior ต่ำ, test positive, false positive สูง','posterior ต้องคำนวณจากกลุ่มผลบวกทั้งหมด','base rate สำคัญ'],
    ['model score 0.91 แต่ข้อมูลมาจากกลุ่มใหม่','ต้องตรวจ calibration/generalization ก่อนใช้ผลเด็ดขาด','confidence ไม่เท่ากับ correctness'],
    ['rule ใหม่แทน policy เดิม','ต้องเก็บ versioning และทดสอบผลกระทบ','audit trail'],
    ['facts สองแหล่งขัดกัน','ต้องใช้ conflict resolution ก่อน inference','consistency check'],
    ['ผู้ใช้ขออธิบายคำแนะนำ','ต้องแสดง evidence, rule/model และ limitation','explanation facility'],
    ['high-stakes decision และ confidence ต่ำ','ต้องเพิ่ม human review','human oversight'],
    ['goal ยังพิสูจน์ไม่ได้','ระบุ evidence/rule ที่ขาด ไม่สร้าง conclusion เอง','open-world reasoning'],
    ['ระบบรับ evidence ใหม่','อัปเดต belief/re-evaluate decision','Bayesian update'],
    ['rule ให้ผลสรุปได้แต่มี exception ใหม่','ตรวจ scope และ exception ก่อน action','rule maintenance']
  ];
  traceCases.forEach(([caseText,answer,why],i)=>{
    b3.push(q(`b3x_trace_${i+1}`,'Expert Explanation','reasoning_trace',`ข้อใดเป็น reasoning ที่ถูกต้องสำหรับสถานการณ์: ${caseText}`,answer,['เพราะ AI ฉลาดจึงสรุปได้','ใช้ accuracy รวมอย่างเดียว','ละเว้น evidence ที่ไม่ตรง'], `คำตอบที่ดีต้องมีเหตุผลตรวจสอบได้: ${why}`,'มองหาคำอธิบายที่ระบุ evidence, model/rule และข้อจำกัด'));
  });
  const governance=[
    ['มีการใช้ข้อมูลผู้ใช้ใหม่โดยไม่แจ้งวัตถุประสงค์','ตรวจ consent, data governance และความโปร่งใส'],
    ['ผลกระทบของ false positive ต่างกันมากระหว่างกลุ่ม','วัด error/fairness แยกกลุ่มและทบทวน threshold'],
    ['ผู้ใช้โต้แย้งผลและส่งหลักฐานใหม่','เปิดกระบวนการ appeal และ re-evaluate พร้อม audit log'],
    ['องค์กรเปลี่ยนนโยบายแต่ rule ยังเก่า','review/version rules และทดสอบก่อน deploy'],
    ['โมเดลมั่นใจสูงแต่ไม่มี explanation','เพิ่ม explainability และตรวจ calibration'],
    ['ระบบให้คำแนะนำสุขภาพแบบอัตโนมัติ','สื่อสารว่าไม่ใช่การวินิจฉัยและมี escalation path'],
    ['ฐานความรู้มีความขัดแย้ง','หยุด high-stakes conclusion และส่ง conflict review'],
    ['evidence สำคัญขาดหาย','ขอข้อมูลเพิ่มหรือใช้ cautious action'],
    ['มีการใช้ ML score ร่วมกับ policy rule','แยก prediction กับ decision policy ให้ตรวจสอบได้'],
    ['ต้องตัดสินใจภายในเวลาจำกัด','ใช้ safe fallback และบันทึกเหตุผล/ความไม่แน่นอน']
  ];
  governance.forEach(([situation,answer],i)=>{
    b3.push(q(`b3x_govern_${i+1}`,'Integrated Reasoning','responsible_ai',`เมื่อ${situation} ระบบ Reasoning & Knowledge ที่รับผิดชอบควรทำอะไร`,answer,['ปิดข้อมูลเพื่อให้ใช้งานเร็วขึ้น','ใช้ผลเดิมโดยไม่บันทึก','เพิ่ม confidence เป็น 100%'], 'Responsible AI ต้องรวม governance, fairness, explanation และ oversight','มองหา action ที่รักษาความปลอดภัยและตรวจสอบได้'));
  });

  root.CONFIG.s8.bank.push(...s8);
  root.CONFIG.s9.bank.push(...s9);
  root.CONFIG.b3.bank.push(...b3);
  root.__v530Expanded={s8:s8.length,s9:s9.length,b3:b3.length,version:VERSION};
  console.log('[AIQuest] '+VERSION+' loaded',root.__v530Expanded);
})();