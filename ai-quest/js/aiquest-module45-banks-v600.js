/*
  CSAI2102 AI Quest
  v6.0.0 — Modules 4–5 Bank Engine
  ----------------------------------
  S10 Machine Learning Foundations
  S11 Supervised Learning Arena
  S12 Unsupervised Discovery Lab
  B4 Machine Learning Boss
  S13 Neural Network Studio
  S14 Reinforcement Learning Arena
  S15 NLP, GenAI & Applied AI Studio
  B5 Final Applied AI Boss

  Every mission produces 60 valid scenario variations, samples a balanced
  round by phase, and applies a mission-local no-repeat window.
*/
(function(){
  'use strict';

  const VERSION='v6.0.0-modules45-replay-banks';
  const WINDOW=10;
  const clone=(x)=>JSON.parse(JSON.stringify(x));
  const shuffle=(items)=>{const out=(items||[]).slice();for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;};
  const q=(id,phase,family,prompt,answer,distractors,explain,hint)=>({id,phase,family,prompt,answer,distractors,explain,hint});
  const pick=(items,index)=>items[index%items.length];

  const contexts=[
    ['ระบบคัดกรองทุนการศึกษา','ผู้สมัคร','การตัดสินใจเรื่องสิทธิ์'],
    ['แอปสุขภาพชุมชน','ผู้ใช้','คำแนะนำความเสี่ยง'],
    ['ระบบตรวจสแปม','อีเมล','การแยกข้อความอันตราย'],
    ['โรงเรียนอัจฉริยะ','นักเรียน','การสนับสนุนการเรียน'],
    ['ศูนย์บริการลูกค้า','คำร้อง','การจัดลำดับความเร่งด่วน'],
    ['ระบบพยากรณ์พลังงาน','วันใช้งาน','การคาดการณ์ปริมาณใช้ไฟ'],
    ['คลังสินค้า','สินค้า','การตรวจความผิดปกติ'],
    ['ระบบจราจร','เส้นทาง','การจัดการความหนาแน่น'],
    ['แพลตฟอร์มเรียนออนไลน์','กิจกรรมผู้เรียน','การแนะนำบทเรียน'],
    ['ระบบแจ้งเหตุฉุกเฉิน','เหตุการณ์','การจัดลำดับตอบสนอง']
  ];
  const label=(c)=>c[0];

  function s10Bank(){
    const out=[];
    for(let i=0;i<15;i++){
      const c=pick(contexts,i),name=label(c);
      out.push(q(`s10_work_${i+1}`,'ML Workflow','workflow',`ทีม ${name} ต้องการให้โมเดลทำนายผลลัพธ์ในอนาคต ขั้นตอนใดควรทำก่อนเริ่มฝึกโมเดล`,`กำหนดเป้าหมาย ตัวแปรเป้าหมาย และเกณฑ์ความสำเร็จให้ชัดเจน`,['เลือกอัลกอริทึมที่ซับซ้อนที่สุดทันที','เก็บทุกข้อมูลโดยไม่ตรวจคุณภาพ','ดูคะแนนทดสอบก่อนสร้างชุดข้อมูล'],'ML ที่ดีเริ่มจาก problem framing และ metric ไม่ใช่เลือกโมเดลก่อน','ถามว่า “จะทำนายอะไร เพื่อช่วยตัดสินใจใด และวัดความสำเร็จอย่างไร”'));
      out.push(q(`s10_feature_${i+1}`,'ML Workflow','feature_target',`ใน ${name} ข้อใดมีบทบาทเป็น feature ที่เหมาะสมกว่าการใช้ผลลัพธ์สุดท้ายเป็น input`,`ข้อมูลที่มีอยู่ก่อนเวลาตัดสินใจและสัมพันธ์กับเป้าหมาย`,['ผลที่เกิดขึ้นหลังระบบตัดสินใจแล้ว','รหัสเฉพาะที่ไม่มีความหมายเชิงพฤติกรรม','คำตอบเฉลยของผู้ตรวจ'],'Feature ต้องพร้อมใช้ ณ เวลาที่โมเดลทำนาย และต้องไม่รั่วข้อมูลจากอนาคต','ตรวจเวลาเกิดข้อมูลว่าอยู่ก่อน prediction point หรือไม่'));
      out.push(q(`s10_split_${i+1}`,'Evaluation & Generalization','train_test_split',`เหตุใด ${name} จึงควรแยก train/validation/test set`,`เพื่อประเมินว่าโมเดล generalize กับข้อมูลที่ไม่เคยเห็นได้หรือไม่`,['เพื่อให้โมเดลจำข้อมูล train ได้เร็วขึ้น','เพื่อเพิ่มจำนวน feature โดยอัตโนมัติ','เพื่อไม่ต้องใช้ metric'],'การวัดกับข้อมูลที่โมเดลไม่เคยเห็นช่วยประเมิน generalization','อย่าใช้ test set เป็นข้อมูลฝึก'));
      out.push(q(`s10_leak_${i+1}`,'Evaluation & Generalization','data_leakage',`ทีม ${name} ใช้ข้อมูลที่บันทึกหลังผลลัพธ์เกิดขึ้นแล้วมาทำนายผลลัพธ์เดิม ปัญหานี้เรียกว่าอะไร`,`Data leakage`,['Overfitting','Clustering','Exploration'],'Leakage ทำให้คะแนนดูดีเกินจริงเพราะโมเดลเห็นอนาคต','ถามว่าข้อมูลนี้ “รู้ได้ก่อนตัดสินใจจริงหรือไม่”'));
      out.push(q(`s10_bias_${i+1}`,'Data & Ethics','dataset_bias',`ชุดข้อมูลของ ${name} ครอบคลุมเฉพาะผู้ใช้กลุ่มเดียวเป็นส่วนใหญ่ ความเสี่ยงสำคัญคืออะไร`,`โมเดลอาจทำงานแย่หรือไม่เป็นธรรมกับกลุ่มที่ข้อมูลไม่ครอบคลุม`,['โมเดลจะไม่มี feature','โมเดลจะกลายเป็น unsupervised เสมอ','โมเดลจะไม่ต้องทดสอบ'],'Representativeness ของข้อมูลส่งผลต่อความเป็นธรรมและความน่าเชื่อถือ','ถามว่าใครหายไปจากข้อมูลฝึก'));
      out.push(q(`s10_deploy_${i+1}`,'Applied ML Design','monitoring',`หลังนำโมเดล ${name} ไปใช้จริง สิ่งใดควรติดตามต่อเนื่อง`,`คุณภาพข้อมูลจริง ผลลัพธ์ ความผิดพลาด และผลกระทบต่อผู้ใช้`,['หยุดตรวจเมื่อ accuracy ครั้งแรกสูง','เปลี่ยน model ทุกวันโดยไม่วัดผล','ลบ feedback ของผู้ใช้'],'Deployment ไม่ใช่จบโครงการ ต้อง monitor drift และผลกระทบ','คิดถึง data drift, performance drift และ feedback loop'));
    }
    return out;
  }

  function s11Bank(){
    const out=[];
    const types=[['classification','จัดกลุ่มคำร้องเป็น “เร่งด่วน/ปกติ”'],['regression','ทำนายปริมาณใช้ไฟวันถัดไป'],['classification','คัดกรองข้อความเป็น spam/not spam'],['regression','ทำนายเวลารอคิวบริการ'],['classification','ประเมินความเสี่ยงเป็น high/low']];
    for(let i=0;i<15;i++){
      const c=pick(contexts,i),t=pick(types,i),name=label(c);
      const isClass=t[0]==='classification';
      out.push(q(`s11_type_${i+1}`,'Problem Type','classification_regression',`${name} ต้องการ ${t[1]}. ปัญหานี้เหมาะกับ supervised learning แบบใด`,isClass?'Classification':'Regression',[isClass?'Regression':'Classification','Clustering','Reinforcement learning'],'Classification ทำนาย label เป็นกลุ่ม ส่วน regression ทำนายค่าต่อเนื่อง','ดูชนิดของ output ที่ต้องการ'));
      out.push(q(`s11_label_${i+1}`,'Problem Type','labels',`เหตุใด supervised learning ของ ${name} จึงต้องมี labeled examples`,`เพื่อให้โมเดลเรียนความสัมพันธ์ระหว่าง input กับ target ที่ทราบคำตอบ`,['เพื่อไม่ต้องมี train set','เพื่อให้โมเดลใช้ reward จาก environment','เพื่อให้ไม่ต้องประเมินผล'],'Supervised learning ใช้คู่ข้อมูล input–target ในการเรียนรู้','ถามว่าโมเดลรู้ “คำตอบที่ถูก” จากไหน'));
      out.push(q(`s11_metric_${i+1}`,'Training & Validation','metric',`หาก ${name} มีกรณี positive ที่พบได้น้อยมาก เหตุใด accuracy อย่างเดียวอาจไม่พอ`,`เพราะโมเดลอาจทาย negative เกือบทั้งหมดแล้วยังได้ accuracy สูง`,['เพราะ accuracy ใช้กับ classification ไม่ได้','เพราะต้องใช้ Minimax','เพราะ label จะหายไป'],'Class imbalance ทำให้ accuracy หลอกตาได้ ต้องดู precision/recall/F1 หรือ PR curve','ลองคิดกรณี positive 1%'));
      out.push(q(`s11_threshold_${i+1}`,'Training & Validation','threshold',`ถ้า ${name} ลด threshold เพื่อจับกรณีเสี่ยงให้มากขึ้น ผลที่คาดได้คืออะไร`,`Recall อาจเพิ่ม แต่ false positive อาจเพิ่มด้วย`,['Precision ต้องเพิ่มเสมอ','ไม่มีผลต่อผลลัพธ์','โมเดลกลายเป็น unsupervised'],'Threshold เป็น trade-off ระหว่างการจับกรณีจริงกับการแจ้งเตือนผิด','จำว่า threshold ต่ำ = แจ้งง่ายขึ้น'));
      out.push(q(`s11_confusion_${i+1}`,'Error Analysis','confusion_matrix',`ใน ${name} โมเดลบอกว่า “เสี่ยง” แต่กรณีจริงไม่เสี่ยง เหตุการณ์นี้คืออะไร`,`False positive`,['True positive','False negative','True negative'],'False positive = ทาย positive แต่ความจริง negative','อ่าน prediction ก่อน แล้วตามด้วยความจริง'));
      out.push(q(`s11_fair_${i+1}`,'Responsible Supervision','fairness',`ก่อนใช้โมเดล ${name} กับผู้ใช้จริง ควรตรวจอะไรเพื่อความเป็นธรรม`,`ตรวจ performance และ error rate แยกกลุ่มที่เกี่ยวข้อง`,['ดูแค่ accuracy รวม','ใช้ feature ทุกอย่างโดยไม่พิจารณา privacy','ซ่อนเกณฑ์การตัดสินใจ'],'คะแนนรวมอาจดีแต่บางกลุ่มได้รับความผิดพลาดมากกว่า','ถามว่า error กระจายเท่ากันหรือไม่'));
    }
    return out;
  }

  function s12Bank(){
    const out=[];
    const goals=['แบ่งกลุ่มพฤติกรรมผู้เรียน','ค้นหารูปแบบการใช้งานบริการ','จัดกลุ่มสินค้าใกล้เคียง','หากลุ่มเหตุการณ์จราจร','มองหากรณีผิดปกติ'];
    for(let i=0;i<15;i++){
      const c=pick(contexts,i),goal=pick(goals,i),name=label(c);
      out.push(q(`s12_goal_${i+1}`,'Unsupervised Concepts','unsupervised_goal',`${name} ต้องการ ${goal} แต่ไม่มี label คำตอบล่วงหน้า แนวทางใดเหมาะที่สุด`,`Unsupervised learning`,['Supervised learning ที่ต้องใช้ label','Reinforcement learning ที่ต้องมี reward','Game tree search'],'Unsupervised learning ค้นหาโครงสร้างจากข้อมูลที่ไม่มี target label','ถามว่าเรามีคำตอบกำกับไว้หรือไม่'));
      out.push(q(`s12_cluster_${i+1}`,'Clustering Mechanics','clustering',`ผลลัพธ์ของ clustering ใน ${name} ควรตีความอย่างไร`,`เป็นกลุ่มที่คล้ายกันตาม feature ที่เลือก ไม่ใช่ “ความจริง” ที่ยืนยันแล้ว`,['เป็น label ถูกต้องแน่นอน','เป็นผลจาก teacher score โดยตรง','เป็นคำอธิบายสาเหตุโดยอัตโนมัติ'],'Cluster เป็นรูปแบบเชิงข้อมูล ต้องตรวจความหมายกับบริบทจริง','การคล้ายกันไม่เท่ากับเหตุและผล'));
      out.push(q(`s12_k_${i+1}`,'Clustering Mechanics','kmeans',`ใน K-means ค่า K หมายถึงอะไร`,`จำนวนกลุ่มที่อัลกอริทึมพยายามแบ่งข้อมูล`,['จำนวน feature','จำนวนรอบ train ที่ถูกต้องเสมอ','ค่า threshold ของ classifier'],'K คือจำนวน clusters ที่กำหนดล่วงหน้า','อย่าสับสน K กับจำนวนข้อมูล'));
      out.push(q(`s12_scale_${i+1}`,'Data Preparation','feature_scaling',`เหตุใดควรพิจารณา scaling feature ก่อน clustering แบบอาศัยระยะทาง`,`feature ที่มีหน่วยใหญ่กว่าอาจครอบงำการคำนวณระยะทาง`,['เพื่อเพิ่ม label','เพื่อทำให้ข้อมูลเป็น supervised','เพื่อกำจัดทุก outlier'],'Distance-based methods ไวต่อ scale ของตัวแปร','เปรียบเทียบคะแนน 0–100 กับรายได้หลักหมื่น'));
      out.push(q(`s12_outlier_${i+1}`,'Data Preparation','outlier',`หาก ${name} พบจุดข้อมูลห่างจากกลุ่มอื่นมาก ควรสรุปอย่างไรอย่างรับผิดชอบ`,`ตรวจคุณภาพข้อมูลและบริบท เพราะอาจเป็น outlier จริงหรือข้อมูลผิดพลาด`,['ลบทิ้งทันทีทุกครั้ง','ประกาศว่าเป็นการทุจริตทันที','นำไปเป็น label ถูกต้อง'],'Outlier ต้องตรวจทั้ง data error และเหตุการณ์สำคัญจริง','อย่าตีความ anomaly เป็นความผิดโดยอัตโนมัติ'));
      out.push(q(`s12_ethics_${i+1}`,'Applied Discovery','cluster_use',`หากใช้ cluster ของ ${name} เพื่อให้บริการต่างกัน ควรระวังอะไร`,`อย่าทำให้กลุ่มเชิงสถิติกลายเป็นการตีตราหรือปฏิบัติไม่เป็นธรรม`,['ใช้ชื่อกลุ่มเป็นคำตัดสินบุคคลทันที','ไม่ต้องอธิบายเกณฑ์','หยุดตรวจผลกระทบ'],'Cluster เป็นเครื่องมือสนับสนุน ไม่ใช่ข้ออ้างในการเลือกปฏิบัติ','ถามว่าการใช้กลุ่มส่งผลต่อสิทธิ์หรือโอกาสใครหรือไม่'));
    }
    return out;
  }

  function b4Bank(){
    const out=[];
    for(let i=0;i<15;i++){
      const c=pick(contexts,i),name=label(c);
      out.push(q(`b4_workflow_${i+1}`,'Problem Framing','ml_case',`${name} ต้องการสร้าง AI ช่วยตัดสินใจ แต่ทีมยังไม่กำหนด target, metric และผู้รับผลกระทบ ขั้นแรกที่ถูกต้องคืออะไร`,`กำหนด problem framing, success metric และขอบเขตการใช้ก่อนเลือกโมเดล`,['เริ่ม train โมเดลที่ซับซ้อนที่สุด','ใช้ข้อมูลทั้งหมดโดยไม่ตรวจ','เปิดใช้กับผู้ใช้จริงทันที'],'Machine learning project เริ่มจากโจทย์และผลกระทบ ไม่ใช่อัลกอริทึม','ตั้งคำถามว่า outcome คืออะไร และความผิดพลาดมีต้นทุนใด'));
      out.push(q(`b4_eval_${i+1}`,'Evaluation Gate','ml_evaluation',`โมเดล ${name} ได้ accuracy 96% แต่ positive class มีเพียง 2% เหตุใดต้องดู metric เพิ่ม`,`เพราะ accuracy อาจสูงแม้โมเดลจับ positive แทบไม่ได้`,['เพราะ accuracy ใช้ไม่ได้กับ ML','เพราะต้องเปลี่ยนเป็น K-means','เพราะ test set ไม่จำเป็น'],'Class imbalance ต้องดู recall/precision/F1 ตามผลกระทบ','คิดถึงโมเดลที่ตอบ negative ทุกครั้ง'));
      out.push(q(`b4_data_${i+1}`,'Data Integrity','ml_leakage_bias',`พบว่า feature ของ ${name} มีข้อมูลที่เกิดหลังเหตุการณ์เป้าหมาย และบางกลุ่มมีข้อมูลน้อยมาก ควรทำอย่างไร`,`ตัด leakage ออก ตรวจ representation และประเมินผลแยกกลุ่ม`,['เก็บไว้เพราะทำให้คะแนนดี','ลบกลุ่มข้อมูลน้อยออกทั้งหมด','ใช้ accuracy รวมอย่างเดียว'],'ต้องแก้ทั้ง temporal leakage และ representation bias','ตรวจ timing และ coverage ของ data'));
      out.push(q(`b4_action_${i+1}`,'Deployment Decision','ml_boss',`ก่อน deploy ${name} ในงานที่กระทบสิทธิ์ผู้ใช้ คำตอบใดเหมาะสมที่สุด`,`ใช้ human review, monitoring, explanation และช่องแก้ไข/อุทธรณ์ร่วมกับโมเดล`,['ให้โมเดลตัดสินโดยไม่อธิบาย','ใช้คะแนนเป็นความจริงแน่นอน','ปิด feedback เพื่อไม่ให้โต้แย้ง'],'B4 ต้องเชื่อม modeling กับ governance และ accountability','มองหา human oversight + monitoring + explanation'));
    }
    return out;
  }

  function s13Bank(){
    const out=[];
    const apps=['จำแนกภาพใบไม้','รู้จำเสียงคำสั่ง','ตรวจภาพเอกสาร','คัดแยกภาพสินค้า','วิเคราะห์ข้อความสั้น'];
    for(let i=0;i<15;i++){
      const app=pick(apps,i);
      out.push(q(`s13_layer_${i+1}`,'Neural Foundations','layers',`ในงาน ${app} เหตุใด neural network จึงมีหลาย layers`,`เพื่อเรียน representation จากลักษณะง่ายไปสู่รูปแบบที่ซับซ้อน`,['เพื่อไม่ต้องใช้ข้อมูล','เพื่อให้ผลถูกเสมอ','เพื่อแทน train/test split'],'Layers ช่วยแปลงข้อมูลเป็น representation หลายระดับ','คิดจาก edge/คำ ไปสู่ pattern/ความหมาย'));
      out.push(q(`s13_activation_${i+1}`,'Neural Foundations','activation',`บทบาทสำคัญของ activation function คืออะไร`,`เพิ่มความไม่เป็นเส้นตรงให้เครือข่ายเรียนความสัมพันธ์ซับซ้อนได้`,['เก็บ label ของข้อมูล','แทน loss function ทั้งหมด','กำหนดจำนวน cluster'],'หากไม่มี non-linearity หลายชั้นอาจยุบเหลือพฤติกรรมเชิงเส้น','ถามว่าอะไรทำให้ network เรียน pattern ซับซ้อนได้'));
      out.push(q(`s13_train_${i+1}`,'Training & Generalization','backprop',`Backpropagation ใช้เพื่ออะไรในการฝึก network`,`คำนวณและส่งสัญญาณความผิดพลาดย้อนกลับเพื่อปรับ weights`,['เลือกจำนวน labels','แบ่งข้อมูลเป็น clusters','กำหนด reward ของ agent'],'Backprop ช่วยใช้ gradient ปรับ parameters ให้ loss ลดลง','loss → gradient → update weights'));
      out.push(q(`s13_overfit_${i+1}`,'Training & Generalization','overfit',`โมเดล ${app} ทำคะแนน train สูงมาก แต่ validation ต่ำลงเรื่อย ๆ ปัญหาน่าจะเป็นอะไร`,`Overfitting`,['Underfitting เสมอ','Data leakage ที่ยืนยันแล้ว','Reinforcement learning'],'Overfit คือจำ train ดีแต่ generalize ไม่ดี','เทียบ train กับ validation performance'));
      out.push(q(`s13_regularize_${i+1}`,'Responsible Deep Learning','regularization',`วิธีใดช่วยลด overfitting ได้เหมาะสม`,`ใช้ regularization, data augmentation, early stopping หรือเพิ่มข้อมูลคุณภาพดี`,['ใช้ test set เป็น train','เพิ่มจำนวน epoch อย่างเดียวเสมอ','ปิด validation'],'ต้องควบคุมความซับซ้อนและตรวจ validation','คิดถึงการหยุดเมื่อ validation ไม่ดีขึ้น'));
      out.push(q(`s13_limit_${i+1}`,'Responsible Deep Learning','deep_limit',`ข้อใดเป็นข้อควรระวังเมื่อนำ deep learning ไปใช้กับ ${app}`,`ต้องตรวจคุณภาพ/ความครอบคลุมของข้อมูล ความอธิบายได้ และผลกระทบจากความผิดพลาด`,['โมเดลลึกไม่ต้องทดสอบ','ความมั่นใจสูงแปลว่าถูกเสมอ','ไม่ต้องมีมนุษย์ทบทวน'],'Deep learning มีพลังแต่ไม่ได้แทน validation และ governance','มอง data, evaluation, explanation, oversight'));
    }
    return out;
  }

  function s14Bank(){
    const out=[];
    const settings=['หุ่นยนต์ส่งของ','ระบบควบคุมสัญญาณไฟ','เกมฝึกตัดสินใจ','ระบบแนะนำเส้นทาง','agent จัดลำดับงาน'];
    for(let i=0;i<15;i++){
      const setting=pick(settings,i);
      out.push(q(`s14_loop_${i+1}`,'RL Foundations','agent_state_action_reward',`ใน ${setting} ข้อใดอธิบาย reinforcement learning ได้ถูกต้อง`,`Agent สังเกต state เลือก action ได้ reward แล้วปรับ policy จากผลลัพธ์สะสม`,['โมเดลเรียนจาก label ที่ถูกต้องทุกข้อ','ระบบแบ่งข้อมูลเป็น clusters โดยไม่มี action','ระบบค้นหา path เดียวแล้วจบ'],'RL เรียนจาก interaction และ reward over time','state → action → reward → next state'));
      out.push(q(`s14_reward_${i+1}`,'RL Foundations','reward_design',`เหตุใดการออกแบบ reward ของ ${setting} จึงสำคัญมาก`,`reward ที่ไม่รอบคอบอาจทำให้ agent หา “ทางลัด” ที่ไม่ตรงเป้าหมายจริง`,['reward ไม่มีผลต่อ policy','reward ต้องเป็น 0 เสมอ','reward แทน safety ได้ทั้งหมด'],'Agent optimize สิ่งที่ให้ reward ไม่ใช่สิ่งที่ผู้ออกแบบ “ตั้งใจในใจ”','ถามว่า agent อาจ exploit reward แบบใด'));
      out.push(q(`s14_explore_${i+1}`,'Policy Learning','exploration',`Exploration ใน RL คืออะไร`,`การลอง action ใหม่เพื่อเรียนรู้ทางเลือกที่อาจดีกว่า`,['การเลือก action เดิมที่ดีที่สุดเสมอ','การลบ reward','การใช้ test label'],'Exploration balance กับ exploitation','ลองสิ่งใหม่ vs ใช้สิ่งที่รู้ว่าดี'));
      out.push(q(`s14_exploit_${i+1}`,'Policy Learning','exploitation',`Exploitation ใน RL คืออะไร`,`การเลือก action ที่ agent เชื่อว่าดีที่สุดจากสิ่งที่เรียนรู้มา`,['การสุ่ม action เพื่อเก็บข้อมูล','การสร้าง label ใหม่','การตรวจ data leakage'],'Exploitation ใช้ความรู้ปัจจุบันเพื่อได้ reward','อย่าสลับกับ exploration'));
      out.push(q(`s14_safe_${i+1}`,'Safe RL','safety',`หาก ${setting} ฝึกในโลกจริงและ action ผิดพลาดอาจอันตราย ควรทำอย่างไร`,`เริ่มจาก simulation/constraints/human oversight และกำหนด safe fallback`,['ปล่อย agent ทดลองทุก action ทันที','ให้ reward สูงกับความเร็วอย่างเดียว','ปิด logging'],'Safe RL ต้องคุมความเสี่ยงระหว่างการเรียนรู้','คิด simulation, constraints และ escalation'));
      out.push(q(`s14_eval_${i+1}`,'Safe RL','evaluation',`ก่อนใช้ policy ของ ${setting} จริง ควรประเมินอะไร`,`ประเมิน reward ระยะยาว ความปลอดภัย ความเสถียร และพฤติกรรมในกรณีขอบ`,['ดูเฉพาะ reward รอบล่าสุด','ดูจำนวน episode อย่างเดียว','ไม่ต้องทดสอบ scenario ใหม่'],'RL evaluation ต้องดู robustness และ unintended behavior','ถามว่า policy ทำงานเมื่อ environment เปลี่ยนหรือไม่'));
    }
    return out;
  }

  function s15Bank(){
    const out=[];
    const tasks=['สรุปเอกสารราชการ','ตอบคำถามจากคู่มือรายวิชา','ช่วยร่างอีเมล','จัดหมวดข้อความร้องเรียน','ช่วยค้นข้อมูลจากคลังเอกสาร'];
    for(let i=0;i<15;i++){
      const task=pick(tasks,i);
      out.push(q(`s15_nlp_${i+1}`,'NLP & LLM Foundations','nlp_task',`งาน “${task}” เกี่ยวข้องกับ NLP/GenAI อย่างไร`,`เป็นงานภาษา จึงต้องประเมินความหมาย บริบท และความถูกต้องของผลที่สร้าง`,['ใช้ภาพอย่างเดียวจึงไม่ต้องประเมินภาษา','เป็น clustering เสมอ','ไม่ต้องมีข้อมูลอ้างอิง'],'NLP เกี่ยวกับการประมวลผลและสร้างภาษามนุษย์','ถามว่า input/output เป็นข้อความหรือความหมายภาษาไหม'));
      out.push(q(`s15_prompt_${i+1}`,'NLP & LLM Foundations','prompting',`Prompt ที่ดีสำหรับ “${task}” ควรมีอะไร`,`บทบาท งาน บริบท ข้อจำกัด รูปแบบผลลัพธ์ และเกณฑ์ตรวจสอบ`,['คำสั่งสั้นมากโดยไม่มีบริบทเสมอ','ข้อมูลลับทั้งหมดของผู้ใช้','คำว่า “ตอบให้ถูก 100%” อย่างเดียว'],'Prompt ชัดช่วยลดความกำกวม แต่ไม่แทนการตรวจผล','กำหนด task, context, constraints, output format'));
      out.push(q(`s15_rag_${i+1}`,'Grounded Generation','rag',`หากต้องการให้ระบบ “${task}” อ้างอิงจากเอกสารองค์กรล่าสุด แนวทางใดเหมาะสม`,`ใช้ retrieval/RAG เพื่อดึงเอกสารที่เกี่ยวข้องมาเป็นบริบทก่อนสร้างคำตอบ`,['ให้โมเดลเดาจากความจำอย่างเดียว','ใส่ข้อมูลทั้งหมดลง prompt ทุกครั้งโดยไม่คัดเลือก','ไม่ต้องระบุแหล่งอ้างอิง'],'RAG ช่วย ground คำตอบกับแหล่งข้อมูลที่ดึงมา','retrieve → provide context → generate → cite/check'));
      out.push(q(`s15_halluc_${i+1}`,'Grounded Generation','hallucination',`เมื่อ GenAI สร้างข้อความที่ฟังดูมั่นใจแต่ไม่มีหลักฐานรองรับ ปัญหานี้เรียกว่าอะไร`,`Hallucination`,['Overfitting เพียงอย่างเดียว','K-means drift','Reward shaping'],'Hallucination คือสร้างข้อมูล/ข้ออ้างที่ไม่ grounded กับหลักฐาน','คำตอบลื่นไหลไม่เท่ากับถูกต้อง'));
      out.push(q(`s15_eval_${i+1}`,'Evaluation & Safety','genai_eval',`ก่อนใช้ระบบ “${task}” กับผู้ใช้จริง ควรประเมินอะไร`,`ความถูกต้อง ความ grounded ความปลอดภัย ความเป็นธรรม และประโยชน์ต่อผู้ใช้`,['ดูแต่ความสวยของข้อความ','ใช้คะแนน benchmark เดียว','ให้ model ประเมินตัวเองอย่างเดียว'],'GenAI evaluation ต้องหลายมิติและมี human review ตามความเสี่ยง','คิด quality + safety + factuality + user impact'));
      out.push(q(`s15_ethics_${i+1}`,'Evaluation & Safety','privacy_copyright',`เมื่อใช้ GenAI กับ “${task}” ข้อใดควรระวังเป็นพิเศษ`,`ข้อมูลส่วนบุคคล ลิขสิทธิ์ แหล่งที่มา และการใช้ผลโดยมนุษย์อย่างรับผิดชอบ`,['โมเดลมีสิทธิ์ใช้ข้อมูลทุกอย่าง','คำตอบที่สร้างไม่มีเจ้าของเสมอ','ไม่ต้องแจ้งข้อจำกัด'],'Applied GenAI ต้องคุม privacy, IP, transparency และ accountability','ถามว่าข้อมูล/ผลลัพธ์นี้กระทบสิทธิ์ใครบ้าง'));
    }
    return out;
  }

  function b5Bank(){
    const out=[];
    for(let i=0;i<15;i++){
      const c=pick(contexts,i),name=label(c);
      out.push(q(`b5_scope_${i+1}`,'Applied AI Strategy','final_scope',`${name} ต้องการใช้ AI หลายแบบร่วมกัน ข้อใดเป็นการเลือกเทคโนโลยีที่รับผิดชอบ`,`เริ่มจากปัญหา ข้อมูล ผลกระทบ และเกณฑ์ประเมิน แล้วเลือก ML/Deep RL/GenAI เท่าที่จำเป็น`,['เลือกเทคโนโลยีใหม่ที่สุดก่อน','ใช้ GenAI กับทุกงานโดยไม่ประเมิน','สร้าง model มากที่สุดเพื่อให้ดูทันสมัย'],'Final Applied AI เริ่มจาก fit-for-purpose และ governance','ถามว่าเทคโนโลยีใดตอบปัญหาได้จริงและเสี่ยงเท่าไร'));
      out.push(q(`b5_data_${i+1}`,'Applied AI Strategy','final_data',`ทีม ${name} พบว่า data มี bias, missing values และข้อมูลส่วนบุคคล ขั้นตอนใดควรทำ`,`ทำ data governance, quality review, privacy safeguards และประเมินผลกระทบแยกกลุ่ม`,['ฝึกโมเดลทันทีเพราะข้อมูลเยอะ','ลบผู้ใช้ที่ข้อมูลไม่ครบทั้งหมด','ซ่อนข้อจำกัดจากผู้ใช้'],'Data quality และ governance เป็นเงื่อนไขก่อน deploy','เชื่อม quality, representation และ privacy'));
      out.push(q(`b5_model_${i+1}`,'Model & Agent Choice','final_model',`งาน ${name} ต้องทำนาย label จากตัวอย่างที่มีคำตอบกำกับ แนวทางหลักเหมาะกับอะไร`,`Supervised learning พร้อม validation และ metric ที่เหมาะกับผลกระทบ`,['K-means อย่างเดียว','Reinforcement learning โดยไม่มี interaction','Game tree search'],'เลือกวิธีตามชนิด problem และ feedback ที่มี','มี labeled target หรือไม่'));
      out.push(q(`b5_genai_${i+1}`,'Model & Agent Choice','final_genai',`หาก ${name} ใช้ GenAI สรุปเอกสารสำคัญ ควรออกแบบอย่างไร`,`ground คำตอบด้วยแหล่งข้อมูล ตรวจ hallucination และให้คนทบทวนเมื่อผลกระทบสูง`,['ให้โมเดลตอบจากความจำอย่างเดียว','ถือว่าข้อความลื่นไหลคือถูก','ปิดแหล่งอ้างอิง'],'Generative output ต้อง grounded และ evaluated','RAG/citation/human review ตาม risk'));
      out.push(q(`b5_govern_${i+1}`,'Trustworthy Deployment','final_governance',`ข้อใดควรอยู่ในแผน deploy AI ของ ${name}`,`monitoring, logging, human override, incident response และช่องรับ feedback/appeal`,['เปิดใช้แล้วไม่ต้องติดตาม','ใช้ model score เป็นคำตัดสินสุดท้าย','ลบ audit log เพื่อประหยัดพื้นที่'],'Trustworthy deployment ต้องติดตามและแก้ไขผลกระทบได้','คิด lifecycle หลัง launch'));
      out.push(q(`b5_boss_${i+1}`,'Trustworthy Deployment','final_boss',`ผู้บริหารถามว่าเหตุใด AI ของ ${name} จึง “น่าเชื่อถือพอ” คำตอบใดดีที่สุด`,`เพราะมีหลักฐานเรื่องข้อมูล การประเมิน ความปลอดภัย ความโปร่งใส และการกำกับดูแลตลอดวงจรชีวิต`,['เพราะใช้ deep learning','เพราะคะแนน accuracy สูงครั้งเดียว','เพราะระบบอัตโนมัติเต็มรูปแบบ'],'ความน่าเชื่อถือไม่ได้มาจาก model ชนิดเดียว แต่จาก evidence และ governance รวมกัน','รวม data + evaluation + explanation + human oversight + monitoring'));
    }
    return out;
  }

  const CONFIG={
    s10:{id:'m10',sessionId:'s10',title:'Machine Learning Foundations',topic:'Problem Framing / Features / Train–Validation–Test / Generalization',requires:['b3'],bank:s10Bank(),phases:['ML Workflow','Evaluation & Generalization','Data & Ethics','Applied ML Design'],picks:3,time:280,passScore:60,historyKey:'CSAI2102_AIQUEST_S10_HISTORY_V600',next:'S11 Supervised Learning Arena'},
    s11:{id:'m11',sessionId:'s11',title:'Supervised Learning Arena',topic:'Classification / Regression / Metrics / Threshold / Fairness',requires:['m10'],bank:s11Bank(),phases:['Problem Type','Training & Validation','Error Analysis','Responsible Supervision'],picks:3,time:280,passScore:60,historyKey:'CSAI2102_AIQUEST_S11_HISTORY_V600',next:'S12 Unsupervised Discovery Lab'},
    s12:{id:'m12',sessionId:'s12',title:'Unsupervised Discovery Lab',topic:'Clustering / K-means / Distance / Outliers / Responsible Use',requires:['m11'],bank:s12Bank(),phases:['Unsupervised Concepts','Clustering Mechanics','Data Preparation','Applied Discovery'],picks:3,time:280,passScore:60,historyKey:'CSAI2102_AIQUEST_S12_HISTORY_V600',next:'B4 Machine Learning Boss'},
    b4:{id:'b4',sessionId:'b4',title:'Machine Learning Boss',topic:'ML Workflow / Evaluation / Data Integrity / Deployment',requires:['m10','m11','m12'],bank:b4Bank(),phases:['Problem Framing','Evaluation Gate','Data Integrity','Deployment Decision'],picks:4,time:320,passScore:70,boss:true,historyKey:'CSAI2102_AIQUEST_B4_HISTORY_V600',next:'S13 Neural Network Studio'},
    s13:{id:'m13',sessionId:'s13',title:'Neural Network Studio',topic:'Layers / Activation / Backpropagation / Generalization',requires:['b4'],bank:s13Bank(),phases:['Neural Foundations','Training & Generalization','Responsible Deep Learning','Applied Deep Learning'],picks:3,time:280,passScore:60,historyKey:'CSAI2102_AIQUEST_S13_HISTORY_V600',next:'S14 Reinforcement Learning Arena'},
    s14:{id:'m14',sessionId:'s14',title:'Reinforcement Learning Arena',topic:'State / Action / Reward / Exploration / Safe Policy',requires:['m13'],bank:s14Bank(),phases:['RL Foundations','Policy Learning','Safe RL','Applied RL'],picks:3,time:280,passScore:60,historyKey:'CSAI2102_AIQUEST_S14_HISTORY_V600',next:'S15 NLP, GenAI & Applied AI'},
    s15:{id:'m15',sessionId:'s15',title:'NLP, GenAI & Applied AI',topic:'Prompting / RAG / Hallucination / Evaluation / Ethics',requires:['m14'],bank:s15Bank(),phases:['NLP & LLM Foundations','Grounded Generation','Evaluation & Safety','Applied GenAI'],picks:3,time:280,passScore:60,historyKey:'CSAI2102_AIQUEST_S15_HISTORY_V600',next:'B5 Final Applied AI Boss'},
    b5:{id:'b5',sessionId:'b5',title:'Final Applied AI Boss',topic:'AI Strategy / Data Governance / Model Choice / Trustworthy Deployment',requires:['b4','m13','m14','m15'],bank:b5Bank(),phases:['Applied AI Strategy','Model & Agent Choice','Trustworthy Deployment','Final Applied AI Boss'],picks:4,time:340,passScore:75,boss:true,historyKey:'CSAI2102_AIQUEST_B5_HISTORY_V600',next:'Final Exam + Applied AI Portfolio'}
  };

  function history(key){try{const value=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(value)?value:[];}catch(error){return [];}}
  function remember(key,ids){try{const old=history(key);old.unshift({ts:new Date().toISOString(),ids});localStorage.setItem(key,JSON.stringify(old.slice(0,WINDOW)));}catch(error){}}
  function build(missionId,difficulty){
    const c=CONFIG[missionId];if(!c)return null;
    const used=new Set();history(c.historyKey).forEach((row)=>arr(row.ids).forEach((id)=>used.add(id)));
    const count=difficulty==='challenge'?Math.min(5,c.picks+1):difficulty==='easy'?Math.max(2,c.picks-1):c.picks;
    const items=[];
    c.phases.forEach((phase)=>{
      const pool=shuffle(c.bank.filter((item)=>item.phase===phase));
      const fresh=pool.filter((item)=>!used.has(item.id));
      const selected=(fresh.length>=count?fresh:pool).slice(0,count);
      items.push(...selected.map(clone));
    });
    const round=shuffle(items);remember(c.historyKey,round.map((item)=>item.id));return round;
  }
  function arr(value){return Array.isArray(value)?value:[];}

  window.AIQuestModule45Banks={VERSION,CONFIG,build};
  console.log('[AIQuest] '+VERSION+' loaded',Object.fromEntries(Object.entries(CONFIG).map(([k,v])=>[k,v.bank.length])));
})();