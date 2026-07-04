/*
  CSAI2102 AI Quest — Modules 4–5 Interactive Labs v6.0.0
  ----------------------------------------------------------
  Formative labs: saved as events only; they never replace graded mission
  attempts, stars, boss wins, or unlock evidence.
*/
(function(){
  'use strict';
  const VERSION='v6.0.0-modules45-interactive-labs';
  const KEY='CSAI2102_AIQUEST_MODULE45_LABS_V600';
  const $=(s,root=document)=>root.querySelector(s);
  const $$=(s,root=document)=>[...root.querySelectorAll(s)];
  const esc=(v)=>String(v==null?'':v).replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const read=()=>{try{const x=JSON.parse(localStorage.getItem(KEY)||'{}');return x&&typeof x==='object'?x:{}}catch(e){return {};}};
  const write=(x)=>{try{localStorage.setItem(KEY,JSON.stringify(x||{}));}catch(e){}};
  const uid=(p)=>`${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
  function profile(){try{return window.AIQuestStorage?.getProfile?.()||{};}catch(e){return {};}}
  function emit(missionId,type,data){
    const p=profile();
    const event={eventId:uid('evt'),attemptId:`lab_${missionId}_${Date.now().toString(36)}`,studentId:p.studentId||'',section:p.section||'101',sessionId:missionId,missionId,eventType:type,phase:'interactive_lab',itemId:data?.itemId||'',prompt:data?.prompt||'',yourAnswer:data?.yourAnswer||'',correctAnswer:data?.correctAnswer||'',isCorrect:data?.isCorrect==null?'':data.isCorrect?1:0,combo:0,helpLeft:'',clientTs:new Date().toISOString(),userAgent:navigator.userAgent,pageUrl:location.href,schemaVersion:VERSION,extraJson:data?.extraJson||{}};
    try{window.AIQuestSync?.submitEvent?.(event).catch(()=>{});}catch(e){}
  }
  function done(missionId,details,onComplete){
    const all=read(),old=all[missionId]||{};all[missionId]={completed:true,completedAt:old.completedAt||new Date().toISOString(),lastCompletedAt:new Date().toISOString(),runs:Number(old.runs||0)+1,details:details||{}};write(all);emit(missionId,'lab_complete',{itemId:'interactive_lab',prompt:`${missionId} lab completed`,isCorrect:true,extraJson:details||{}});if(typeof onComplete==='function')onComplete(all[missionId]);
  }
  function completed(missionId){return !!read()[missionId]?.completed;}
  function style(){
    if(document.getElementById('aiquestModule45LabStyle'))return;
    const s=document.createElement('style');s.id='aiquestModule45LabStyle';s.textContent=`
      .m45lab{margin-top:4px;padding:16px;border:1px solid rgba(167,139,250,.4);border-radius:18px;background:linear-gradient(135deg,rgba(88,28,135,.2),rgba(14,116,144,.16));color:#edf7ff}.m45lab h3{margin:0 0 7px;font-size:19px}.m45lab p{line-height:1.58}.m45grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin-top:12px}.m45card{padding:11px;border:1px solid rgba(255,255,255,.14);border-radius:14px;background:rgba(255,255,255,.045);line-height:1.5}.m45card b{display:block;color:#e0f2fe}.m45choices{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.m45lab button{border:1px solid rgba(148,163,184,.32);border-radius:12px;padding:10px 12px;background:rgba(255,255,255,.08);color:#fff;font:inherit;font-weight:800;cursor:pointer}.m45lab button.sel{border-color:rgba(56,189,248,.72);background:rgba(56,189,248,.14)}.m45lab button.primary{border-color:transparent;background:linear-gradient(135deg,#0ea5e9,#8b5cf6)}.m45lab button.good{border-color:transparent;background:linear-gradient(135deg,#059669,#22c55e)}.m45lab button:disabled{opacity:.5;cursor:not-allowed}.m45result{margin-top:11px;padding:11px;border:1px solid rgba(56,189,248,.3);border-radius:14px;background:rgba(56,189,248,.08);line-height:1.6}.m45result.good{border-color:rgba(52,211,153,.46);background:rgba(52,211,153,.11)}.m45result.bad{border-color:rgba(251,113,133,.46);background:rgba(251,113,133,.11)}.m45status{display:inline-flex;margin-top:8px;padding:5px 8px;border:1px solid rgba(52,211,153,.38);border-radius:999px;color:#bbf7d0;background:rgba(52,211,153,.1);font-size:12px;font-weight:800}.m45bar{height:10px;border-radius:999px;background:rgba(148,163,184,.18);overflow:hidden;margin-top:6px}.m45bar i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#22d3ee,#8b5cf6)}@media(max-width:720px){.m45grid,.m45choices{grid-template-columns:1fr}}
    `;document.head.appendChild(s);
  }
  function selectLab(host,mission,title,intro,steps,onComplete){
    let index=0,correct=0;
    function render(){
      const step=steps[index];
      host.innerHTML=`<div class="m45lab"><h3>${esc(title)}</h3><p>${esc(intro)}</p><div class="m45grid"><div class="m45card"><b>Progress</b><div style="font-size:22px;margin-top:5px">${index+1}/${steps.length}</div></div><div class="m45card"><b>เป้าหมาย</b><small>${esc(step.goal||'เลือกเหตุผลที่สอดคล้องกับหลักการ AI')}</small></div><div class="m45card"><b>สถานะ Lab</b><small>${completed(mission)?'ทำกิจกรรมแล้ว — เล่นซ้ำเพื่อทบทวนได้':'กิจกรรมฝึกฝน ไม่แทนคะแนน Mission'}</small></div></div><div class="m45result"><b>${esc(step.title)}</b><br>${esc(step.prompt)}</div><div class="m45choices">${step.options.map((x,i)=>`<button data-choice="${i}">${esc(x)}</button>`).join('')}</div><div id="labFeedback" class="m45result">เลือกคำตอบที่อธิบายได้และปลอดภัยต่อผู้ใช้</div><span id="labStatus" class="m45status">${completed(mission)?'✓ Lab complete':'กำลังฝึกฝน'}</span></div>`;
      $$('[data-choice]',host).forEach((b)=>b.onclick=()=>{
        const answer=step.options[Number(b.dataset.choice)],ok=answer===step.answer,feedback=$('#labFeedback',host);
        feedback.className='m45result '+(ok?'good':'bad');feedback.innerHTML=ok?`<b>ถูกต้อง</b><br>${esc(step.explain)}`:`<b>ยังไม่เหมาะสม</b><br>${esc(step.explain)}`;
        $$('[data-choice]',host).forEach((x)=>x.disabled=true);
        emit(mission,'lab_step',{itemId:`${mission}_lab_${index+1}`,prompt:step.prompt,yourAnswer:answer,correctAnswer:step.answer,isCorrect:ok,extraJson:{lab:title,step:index+1}});
        if(ok)correct++;
        setTimeout(()=>{index++;if(index<steps.length)render();else finish();},850);
      });
    }
    function finish(){
      const allGood=correct===steps.length;
      host.innerHTML=`<div class="m45lab"><h3>${esc(title)} — Debrief</h3><div class="m45result ${allGood?'good':'bad'}"><b>${allGood?'Lab cleared':'Lab review'}</b><br>ตอบถูก ${correct}/${steps.length}<br><span class="muted">กิจกรรมนี้เก็บ event การมีส่วนร่วม แต่การผ่านจริงยังต้องทำ Mission แบบ Graded</span></div><button id="labAgain" class="primary" style="margin-top:10px">ลอง Lab ใหม่</button><span id="labStatus" class="m45status">${completed(mission)?'✓ Lab complete':'ยังไม่บันทึกเป็น complete'}</span></div>`;
      if(allGood&&!completed(mission)){done(mission,{lab:title,correct,steps:steps.length},onComplete);$('#labStatus',host).textContent='✓ Lab complete — บันทึกเป็นกิจกรรมฝึกฝน';}
      $('#labAgain',host).onclick=()=>{index=0;correct=0;render();};
    }
    render();
  }
  function dataSplit(host,onComplete){
    const steps=[
      {title:'Step 1 • Prediction point',goal:'ใช้เฉพาะข้อมูลที่รู้ได้ก่อน prediction',prompt:'ระบบคัดกรองทุนจะตัดสินใจวันที่ 1 มิ.ย. ข้อใดเป็น feature ที่ปลอดภัยกว่า',answer:'รายได้ที่ยื่นก่อนวันที่ 1 มิ.ย.',options:['ผลการอนุมัติที่บันทึกวันที่ 5 มิ.ย.','รายได้ที่ยื่นก่อนวันที่ 1 มิ.ย.','คะแนนการอุทธรณ์หลังถูกปฏิเสธ','บันทึกคำตัดสินสุดท้าย'],explain:'Feature ต้องมีอยู่ก่อนเวลาที่ระบบตัดสินใจ เพื่อป้องกัน data leakage.'},
      {title:'Step 2 • Split',goal:'แยกข้อมูลเพื่อวัด generalization',prompt:'เหตุใดต้องเก็บ test set แยกจาก train/validation',answer:'เพื่อประเมินผลกับข้อมูลที่โมเดลไม่เคยใช้ตัดสินใจปรับตัว',options:['เพื่อเพิ่มจำนวน labels','เพื่อประเมินผลกับข้อมูลที่โมเดลไม่เคยใช้ตัดสินใจปรับตัว','เพื่อให้ train score สูงสุด','เพื่อไม่ต้องใช้ metric'],explain:'Test set ควรถูกใช้ตอนท้ายเพื่อประเมิน generalization.'},
      {title:'Step 3 • Monitoring',goal:'deployment ไม่ใช่จุดจบ',prompt:'หลัง deploy โมเดล สิ่งใดควรติดตาม',answer:'คุณภาพข้อมูลจริง ผลลัพธ์ และผลกระทบต่อผู้ใช้',options:['หยุดตรวจทันทีเมื่อครั้งแรกได้คะแนนดี','คุณภาพข้อมูลจริง ผลลัพธ์ และผลกระทบต่อผู้ใช้','ดูจำนวน model parameters อย่างเดียว','ลบ feedback ที่ไม่ตรงกับผล'],explain:'ต้อง monitor data drift, error pattern และ user impact ต่อเนื่อง.'}
    ];selectLab(host,'s10','🔬 S10 Data Split Lab','วาง workflow ให้ข้อมูลไม่รั่วและประเมิน generalization ได้จริง',steps,onComplete);
  }
  function thresholdLab(host,onComplete){
    let threshold=60;const scores=[92,81,68,59,43,31];
    function render(){
      const flagged=scores.filter((x)=>x>=threshold).length;
      host.innerHTML=`<div class="m45lab"><h3>🎯 S11 Threshold Lab</h3><p>ปรับ threshold แล้วดู trade-off ของการแจ้งเตือน ระบบนี้มี score 6 กรณี: ${scores.join(', ')}</p><div class="m45grid"><label class="m45card"><b>Threshold: <span id="thVal">${threshold}</span></b><input id="th" type="range" min="30" max="90" value="${threshold}" style="width:100%"><small>ลด threshold = flag มากขึ้น</small></label><div class="m45card"><b>Flagged cases</b><div style="font-size:25px;margin-top:5px">${flagged}/6</div><small>ต้องตรวจ precision/recall ตามผลกระทบ</small></div><div class="m45card"><b>Challenge</b><small>เลือก threshold ที่เหมาะกับงานฉุกเฉิน ซึ่ง false negative มีต้นทุนสูง</small></div></div><div class="m45choices"><button id="high">งานลบอีเมลสำคัญ</button><button id="low">งานแจ้งเหตุฉุกเฉิน</button></div><div id="thResult" class="m45result">เลือกบริบทเพื่ออธิบาย threshold</div><span id="thStatus" class="m45status">${completed('s11')?'✓ Threshold Lab complete':'กิจกรรมฝึกฝน'}</span></div>`;
      $('#th',host).oninput=(e)=>{threshold=Number(e.target.value);render();};
      $('#high',host).onclick=()=>complete('high');$('#low',host).onclick=()=>complete('low');
    }
    function complete(kind){const correct=kind==='low';const box=$('#thResult',host);box.className='m45result '+(correct?'good':'bad');box.innerHTML=correct?'<b>ถูกต้อง</b><br>งานฉุกเฉินควรยอม flag มากขึ้นเพื่อลด false negative แม้ false positive อาจเพิ่ม':'<b>ทบทวน</b><br>งานลบอีเมลควรใช้ threshold ระวังกว่า เพราะ false positive อาจทำให้ข้อมูลสำคัญหาย';emit('s11','threshold_lab',{itemId:'threshold_context',prompt:'Select threshold context',yourAnswer:kind,correctAnswer:'low',isCorrect:correct,extraJson:{threshold}});if(correct&&!completed('s11')){done('s11',{lab:'threshold',threshold},onComplete);$('#thStatus',host).textContent='✓ Threshold Lab complete';}}
    render();
  }
  function clusterLab(host,onComplete){
    const steps=[
      {title:'Step 1 • Feature Scale',goal:'ป้องกัน distance ถูกครอบงำ',prompt:'ก่อนใช้ K-means กับ “เวลาใช้งาน 0–300 นาที” และ “คะแนน 0–100” ควรทำอะไร',answer:'พิจารณา scaling feature ก่อนคำนวณระยะทาง',options:['พิจารณา scaling feature ก่อนคำนวณระยะทาง','ใช้ label ที่ไม่มีอยู่','เพิ่ม reward ให้ทุก cluster','ใช้ test set เป็น train'],explain:'Distance-based clustering ไวต่อ scale ของตัวแปร.'},
      {title:'Step 2 • Cluster Meaning',goal:'ตีความ cluster ด้วยบริบท',prompt:'Cluster A มีผู้เรียนดูวิดีโอนานแต่ทำ quiz น้อย ควรสรุปอย่างไร',answer:'เป็น pattern ที่ต้องตรวจบริบทและออกแบบการช่วยเหลือ ไม่ใช่ตีตราผู้เรียน',options:['เป็นผู้เรียนไม่ดีแน่นอน','เป็น pattern ที่ต้องตรวจบริบทและออกแบบการช่วยเหลือ ไม่ใช่ตีตราผู้เรียน','เป็น label ถูกต้อง 100%','ลบกลุ่ม A'],explain:'Cluster เป็นโครงสร้างเชิงข้อมูล ไม่ใช่คำตัดสินคุณค่าของบุคคล.'},
      {title:'Step 3 • Outlier',goal:'ตรวจ anomaly อย่างรับผิดชอบ',prompt:'พบจุดข้อมูลห่างจากทุก cluster มาก ควรทำอะไร',answer:'ตรวจ data quality และบริบทก่อนตีความว่าเป็นเหตุการณ์ผิดปกติจริง',options:['กล่าวหาว่าเป็นการทุจริตทันที','ตรวจ data quality และบริบทก่อนตีความว่าเป็นเหตุการณ์ผิดปกติจริง','ลบทิ้งทุกครั้ง','เปลี่ยนเป็น classifier'],explain:'Outlier อาจเป็น error หรือเหตุการณ์สำคัญจริง จึงต้องตรวจสอบ.'}
    ];selectLab(host,'s12','🧭 S12 Cluster Explorer','ทดลองเลือก feature และตีความกลุ่มอย่างไม่ตีตราผู้ใช้',steps,onComplete);
  }
  function b4Lab(host,onComplete){
    const steps=[
      {title:'B4 • Model Launch Case 1',goal:'ใช้ metric ตามผลกระทบ',prompt:'โมเดลคัดกรองโรคร้ายแรง accuracy 98% แต่จับผู้ป่วยจริงได้น้อย ควรดูอะไรเพิ่ม',answer:'Recall และ false negative',options:['จำนวน parameter','Recall และ false negative','สีของ dashboard','จำนวน epochs'],explain:'งานที่พลาดผู้ป่วยจริงมีต้นทุนสูง ต้องดู recall และ false negatives.'},
      {title:'B4 • Model Launch Case 2',goal:'หยุด leakage ก่อน deploy',prompt:'พบ feature ที่บันทึกหลังผลลัพธ์เกิดขึ้นแล้ว ขั้นตอนถูกต้องคืออะไร',answer:'ตัด feature รั่วออกและประเมินใหม่ด้วยข้อมูลที่รู้ได้จริง',options:['เก็บไว้เพราะ score ดี','ตัด feature รั่วออกและประเมินใหม่ด้วยข้อมูลที่รู้ได้จริง','ย้ายไป test set','ซ่อน feature'],explain:'Data leakage ทำให้ผลประเมินไม่สะท้อนโลกจริง.'},
      {title:'B4 • Model Launch Case 3',goal:'deployment แบบ accountable',prompt:'โมเดลมีผลต่อสิทธิ์ผู้ใช้ ควร deploy อย่างไร',answer:'มี human review, monitoring, explanation และช่องอุทธรณ์',options:['อัตโนมัติเต็มรูปแบบโดยไม่อธิบาย','มี human review, monitoring, explanation และช่องอุทธรณ์','ใช้ score เป็นคำสั่งสุดท้าย','ปิด feedback'],explain:'High-stakes ML ต้องมี oversight และกลไกแก้ไข.'}
    ];selectLab(host,'b4','🛡️ B4 ML Launch Casefile','ตัดสินใจว่าโมเดลพร้อมใช้งานจริงหรือยัง',steps,onComplete);
  }
  function neuralLab(host,onComplete){
    const steps=[
      {title:'Step 1 • Representation',goal:'เข้าใจ layers',prompt:'Network หลาย layers ช่วยงานรู้จำภาพได้อย่างไร',answer:'เรียน feature จากง่ายไปซับซ้อน',options:['เก็บ label ให้มากขึ้น','เรียน feature จากง่ายไปซับซ้อน','ไม่ต้องใช้ data','ลดความจำเป็นของ evaluation'],explain:'Layers สร้าง representation หลายระดับ เช่น edge → shape → object.'},
      {title:'Step 2 • Overfit Signal',goal:'อ่าน train/validation curve',prompt:'Train loss ลดต่อเนื่อง แต่ validation loss เพิ่มขึ้น ควรทำอะไร',answer:'ใช้ regularization/early stopping และตรวจข้อมูล',options:['เพิ่ม epoch ไปเรื่อย ๆ','ใช้ regularization/early stopping และตรวจข้อมูล','เอา validation ไป train','เลิกใช้ test set'],explain:'สัญญาณนี้มักบ่ง overfitting.'},
      {title:'Step 3 • Responsible Use',goal:'ไม่เชื่อ score อย่างเดียว',prompt:'โมเดลภาพมั่นใจ 99% กับกลุ่มภาพที่ไม่มีในข้อมูลฝึก ควรทำอย่างไร',answer:'ตรวจ generalization และมี human review ตามความเสี่ยง',options:['เชื่อ 99% ทันที','ตรวจ generalization และมี human review ตามความเสี่ยง','ลบภาพ','เพิ่ม confidence เป็น 100%'],explain:'High confidence ไม่รับประกัน correctness เมื่อเกิด distribution shift.'}
    ];selectLab(host,'s13','🧠 S13 Neural Debug Lab','อ่านสัญญาณ overfit และประเมิน neural model อย่างรับผิดชอบ',steps,onComplete);
  }
  function rewardLab(host,onComplete){
    const steps=[
      {title:'Step 1 • Reward Alignment',goal:'reward ต้องตรงเป้าหมาย',prompt:'หุ่นยนต์ส่งของได้ reward สูงเมื่อ “ถึงเร็ว” แต่ขับเสี่ยง ควรปรับอย่างไร',answer:'เพิ่ม reward/constraint เรื่องความปลอดภัยและการไม่ชน',options:['เพิ่ม reward ความเร็วอย่างเดียว','เพิ่ม reward/constraint เรื่องความปลอดภัยและการไม่ชน','ลบ state','ปิด logging'],explain:'Agent จะ optimize สิ่งที่ reward ให้ จึงต้อง reward alignment.'},
      {title:'Step 2 • Explore Safely',goal:'ลองสิ่งใหม่ภายใต้ข้อจำกัด',prompt:'เหตุใดควรเริ่มฝึก agent ใน simulation',answer:'ลดความเสี่ยงจาก action ทดลองก่อนใช้ในโลกจริง',options:['เพราะ simulation ให้ reward สูงสุดเสมอ','ลดความเสี่ยงจาก action ทดลองก่อนใช้ในโลกจริง','เพื่อไม่ต้องทดสอบจริงเลย','เพื่อไม่ต้องมี constraints'],explain:'Simulation ช่วยให้ exploration ปลอดภัยขึ้น.'},
      {title:'Step 3 • Policy Check',goal:'ประเมินกรณีขอบ',prompt:'ก่อน deploy policy ควรทดสอบอะไร',answer:'ความปลอดภัย ความเสถียร และพฤติกรรมใน edge cases',options:['reward ล่าสุดเท่านั้น','ความปลอดภัย ความเสถียร และพฤติกรรมใน edge cases','จำนวน actions ที่ agent มี','สี UI'],explain:'RL ต้อง evaluate beyond average reward.'}
    ];selectLab(host,'s14','🎮 S14 Reward Arena Lab','ตรวจ reward hacking, exploration และ safe policy',steps,onComplete);
  }
  function genaiLab(host,onComplete){
    const steps=[
      {title:'Step 1 • Grounded Answer',goal:'ใช้แหล่งข้อมูลจริง',prompt:'ระบบตอบคำถามระเบียบมหาวิทยาลัยควรทำอย่างไร',answer:'ดึงเอกสารล่าสุดมาเป็นบริบทและแสดงแหล่งที่มา',options:['เดาจากความจำโมเดล','ดึงเอกสารล่าสุดมาเป็นบริบทและแสดงแหล่งที่มา','สร้างคำตอบให้มั่นใจที่สุด','ไม่ให้ผู้ใช้ตรวจแหล่ง'],explain:'RAG/grounding ช่วยลด hallucination และทำให้ตรวจได้.'},
      {title:'Step 2 • Privacy',goal:'ไม่ส่งข้อมูลเกินจำเป็น',prompt:'ผู้ใช้วางข้อมูลส่วนบุคคลใน prompt ควรออกแบบระบบอย่างไร',answer:'ลด/ปกป้องข้อมูลส่วนบุคคลและแจ้งขอบเขตการใช้ข้อมูล',options:['ส่งทุกข้อมูลไปทุกบริการ','ลด/ปกป้องข้อมูลส่วนบุคคลและแจ้งขอบเขตการใช้ข้อมูล','บันทึก prompt ถาวรโดยไม่แจ้ง','ให้ model ตัดสินสิทธิ์เอง'],explain:'GenAI ต้องเคารพ privacy และ purpose limitation.'},
      {title:'Step 3 • Human Review',goal:'ผลกระทบสูงต้องตรวจ',prompt:'GenAI ร่างคำตอบเรื่องสุขภาพให้ผู้ใช้ ควรมีอะไรเพิ่ม',answer:'คำเตือนข้อจำกัด การตรวจแหล่ง และ escalation/human review',options:['บอกว่าเป็นคำวินิจฉัย','คำเตือนข้อจำกัด การตรวจแหล่ง และ escalation/human review','เพิ่มอุณหภูมิให้สูง','ซ่อน uncertainty'],explain:'High-stakes GenAI ต้องมี safeguards และ human oversight.'}
    ];selectLab(host,'s15','💬 S15 Grounded GenAI Lab','ฝึก RAG, privacy และการใช้ GenAI อย่างรับผิดชอบ',steps,onComplete);
  }
  function b5Lab(host,onComplete){
    const steps=[
      {title:'Final Case 1 • Choose the tool',goal:'เลือกเทคโนโลยีตามปัญหา',prompt:'องค์กรต้องทำนายความเสี่ยงจากข้อมูลมี label แล้วต้องอธิบายเหตุผล ควรเริ่มจากอะไร',answer:'กำหนด metric/impact แล้วใช้ supervised model พร้อม explanation',options:['ใช้ GenAI เสมอ','กำหนด metric/impact แล้วใช้ supervised model พร้อม explanation','ใช้ clustering อย่างเดียว','ใช้ RL โดยไม่มี interaction'],explain:'Fit-for-purpose สำคัญกว่าใช้เทคโนโลยีใหม่ที่สุด.'},
      {title:'Final Case 2 • Evaluate trust',goal:'ดูมากกว่า accuracy',prompt:'โมเดลได้ accuracy สูงแต่กลุ่มหนึ่ง false positive มากกว่ามาก ควรทำอะไร',answer:'วัด error/fairness แยกกลุ่มและทบทวน data/threshold',options:['รายงาน accuracy รวมพอ','วัด error/fairness แยกกลุ่มและทบทวน data/threshold','ลบกลุ่มนั้นจากรายงาน','เพิ่ม confidence'],explain:'Trustworthy AI ต้องตรวจผลกระทบข้ามกลุ่ม.'},
      {title:'Final Case 3 • Deploy safely',goal:'มี lifecycle governance',prompt:'ระบบ AI จะใช้จริงในงานที่กระทบสิทธิ์ผู้ใช้ แผน deploy ที่เหมาะสมคืออะไร',answer:'monitoring, audit log, human override, incident response และ appeal',options:['เปิดใช้ถาวรโดยไม่ติดตาม','monitoring, audit log, human override, incident response และ appeal','ลบ log เพื่อความเร็ว','ใช้ score เป็นคำตัดสินสุดท้าย'],explain:'การกำกับดูแลต้องมีตลอด lifecycle ไม่ใช่แค่ตอน train.'},
      {title:'Final Case 4 • Explain decision',goal:'สร้างความรับผิดชอบ',prompt:'ผู้ใช้ถาม “ทำไมระบบตัดสินเช่นนี้” ควรตอบอย่างไร',answer:'อธิบายข้อมูล/เกณฑ์/ข้อจำกัด และช่องส่งหลักฐานใหม่',options:['บอกว่า AI เลือกเอง','อธิบายข้อมูล/เกณฑ์/ข้อจำกัด และช่องส่งหลักฐานใหม่','ปิดคำถาม','แสดงแต่คะแนน'],explain:'Explanation + appeal ช่วยให้ระบบตรวจสอบและแก้ไขได้.'}
    ];selectLab(host,'b5','🏁 B5 Final Applied AI Casefile','บูรณาการ ML, Deep/RL, GenAI และ Trustworthy AI ก่อน Final Boss',steps,onComplete);
  }
  function render(mission,host,opts){
    if(!host)return;style();const complete=opts?.onComplete;
    if(mission==='s10')return dataSplit(host,complete);
    if(mission==='s11')return thresholdLab(host,complete);
    if(mission==='s12')return clusterLab(host,complete);
    if(mission==='b4')return b4Lab(host,complete);
    if(mission==='s13')return neuralLab(host,complete);
    if(mission==='s14')return rewardLab(host,complete);
    if(mission==='s15')return genaiLab(host,complete);
    if(mission==='b5')return b5Lab(host,complete);
    host.innerHTML='<div class="m45lab"><h3>Learning Lab</h3><p>ยังไม่มี Lab เฉพาะสำหรับ Mission นี้</p></div>';
  }
  window.AIQuestModule45Labs={VERSION,render,completed};
  console.log('[AIQuest] '+VERSION+' loaded');
})();