/*
  CSAI2102 AI Quest
  v5.3.0 — Module 3 Interactive Learning Labs
  ------------------------------------------------
  S8: Bayes Lab (prior / evidence / threshold)
  S9: Rule Builder (facts → rules → inference trace)
  B3: Reasoning Casefile (conflict + evidence + human oversight)
  Labs are formative support. Completion is logged as an event but never
  replaces graded mission score, star, or Boss evidence.
*/
(function(){
  'use strict';

  const VERSION='v5.3.0-phase2-interactive-labs';
  const LAB_KEY='CSAI2102_AIQUEST_PHASE2_LABS_V530';
  const $=(selector,root=document)=>root.querySelector(selector);
  const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
  const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

  function read(){
    try{const x=JSON.parse(localStorage.getItem(LAB_KEY)||'{}');return x&&typeof x==='object'?x:{};}
    catch(error){return {};}
  }
  function write(value){try{localStorage.setItem(LAB_KEY,JSON.stringify(value||{}));return true;}catch(error){return false;}}
  function profile(){
    try{return window.AIQuestStorage?.getProfile?.()||{};}catch(error){return {};}
  }
  function uid(prefix){return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;}
  function emit(missionId,type,data){
    const p=profile();
    const event={
      eventId:uid('evt'),attemptId:`lab_${missionId}_${Date.now().toString(36)}`,
      studentId:p.studentId||'',section:p.section||'101',sessionId:missionId,missionId,
      eventType:type,phase:'interactive_lab',itemId:data?.itemId||'',prompt:data?.prompt||'',
      yourAnswer:data?.yourAnswer||'',correctAnswer:data?.correctAnswer||'',
      isCorrect:data?.isCorrect==null?'':data.isCorrect?1:0,combo:0,helpLeft:'',
      clientTs:new Date().toISOString(),userAgent:navigator.userAgent,pageUrl:location.href,
      schemaVersion:VERSION,extraJson:data?.extraJson||{}
    };
    try{window.AIQuestSync?.submitEvent?.(event).catch(()=>{});}catch(error){}
    return event;
  }
  function markComplete(missionId,details,onComplete){
    const all=read();
    const previous=all[missionId]||{};
    all[missionId]={completed:true,completedAt:previous.completedAt||new Date().toISOString(),lastCompletedAt:new Date().toISOString(),runs:Number(previous.runs||0)+1,details:details||{}};
    write(all);
    emit(missionId,'lab_complete',{itemId:'interactive_lab',prompt:`${missionId} interactive lab completed`,isCorrect:true,extraJson:details||{}});
    if(typeof onComplete==='function')onComplete(all[missionId]);
  }
  function completed(missionId){return !!read()[missionId]?.completed;}
  function injectStyle(){
    if(document.getElementById('aiquestPhase2LabsStyle'))return;
    const style=document.createElement('style');style.id='aiquestPhase2LabsStyle';
    style.textContent=`
      .p2lab{margin-top:14px;padding:15px;border:1px solid rgba(167,139,250,.36);border-radius:18px;background:linear-gradient(135deg,rgba(88,28,135,.18),rgba(14,116,144,.14));color:#edf7ff}
      .p2lab h3{margin:0 0 6px;font-size:19px}.p2lab p{line-height:1.55}.p2labGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin-top:11px}.p2labCard{padding:11px;border:1px solid rgba(255,255,255,.14);border-radius:14px;background:rgba(255,255,255,.045);line-height:1.5}.p2labCard b{display:block;color:#e0f2fe}.p2lab input[type=range]{width:100%;accent-color:#38bdf8}.p2lab button{border:1px solid rgba(148,163,184,.3);border-radius:12px;padding:10px 12px;background:rgba(255,255,255,.08);color:#fff;font:inherit;font-weight:800;cursor:pointer}.p2lab button.primary{border-color:transparent;background:linear-gradient(135deg,#0ea5e9,#8b5cf6)}.p2lab button.good{border-color:transparent;background:linear-gradient(135deg,#059669,#22c55e)}.p2lab button.sel{border-color:rgba(56,189,248,.7);background:rgba(56,189,248,.14)}.p2lab button:disabled{opacity:.48;cursor:not-allowed}.p2labChoices{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.p2labResult{margin-top:11px;padding:11px;border:1px solid rgba(56,189,248,.28);border-radius:14px;background:rgba(56,189,248,.08);line-height:1.6}.p2labResult.good{border-color:rgba(52,211,153,.45);background:rgba(52,211,153,.11)}.p2labResult.bad{border-color:rgba(251,113,133,.42);background:rgba(251,113,133,.1)}.p2labTrace{margin:8px 0 0;padding-left:18px;color:#dbeafe}.p2labStatus{display:inline-flex;margin-top:8px;padding:5px 8px;border:1px solid rgba(52,211,153,.38);border-radius:999px;color:#bbf7d0;background:rgba(52,211,153,.1);font-size:12px;font-weight:800}@media(max-width:720px){.p2labGrid,.p2labChoices{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function bayes(host,opts){
    const onComplete=opts?.onComplete;
    const presets={
      health:{label:'คัดกรองสุขภาพ',prior:8,sens:90,fp:10,threshold:55,description:'โรคพบไม่บ่อย แต่ผลตรวจค่อนข้างไว'},
      scholarship:{label:'คัดกรองทุน',prior:25,sens:84,fp:12,threshold:65,description:'ต้องระวังการปฏิเสธผู้มีสิทธิ์จริง'},
      emergency:{label:'แจ้งเหตุฉุกเฉิน',prior:18,sens:95,fp:18,threshold:45,description:'การพลาดเหตุจริงมีต้นทุนสูง'}
    };
    let current='health',runs=0;
    function calc(){
      const prior=Number($('#bayesPrior',host)?.value||0)/100;
      const sens=Number($('#bayesSens',host)?.value||0)/100;
      const fp=Number($('#bayesFp',host)?.value||0)/100;
      const threshold=Number($('#bayesThreshold',host)?.value||0)/100;
      const denom=sens*prior+fp*(1-prior);
      const posterior=denom?Math.max(0,Math.min(1,(sens*prior)/denom)):0;
      const action=posterior>=threshold?'เข้าสู่ขั้นตรวจสอบ/ดำเนินการตามนโยบาย':'ขอ evidence เพิ่มหรือรอดูข้อมูลก่อน';
      const risk=posterior>=threshold?'ผ่าน threshold ที่ตั้งไว้':'ยังไม่ผ่าน threshold ที่ตั้งไว้';
      const out=$('#bayesResult',host);
      if(out)out.innerHTML=`<b>Posterior = ${(posterior*100).toFixed(1)}%</b><br>Prior ${(prior*100).toFixed(0)}% • Sensitivity ${(sens*100).toFixed(0)}% • False positive ${(fp*100).toFixed(0)}% • Threshold ${(threshold*100).toFixed(0)}%<br><span class="muted">${risk}: ${action}</span>`;
      runs++;
      emit('s8','bayes_lab_run',{itemId:'bayes_calculator',prompt:'Bayes Lab calculation',extraJson:{prior,sensitivity:sens,falsePositive:fp,threshold,posterior,action}});
      if(runs>=2&&!completed('s8')){
        markComplete('s8',{lab:'bayes',runs,posterior:Math.round(posterior*100)},onComplete);
        const status=$('#bayesStatus',host);if(status)status.textContent='✓ Bayes Lab complete — บันทึกเป็นกิจกรรมฝึกฝน';
      }
    }
    function render(){
      const p=presets[current];
      host.innerHTML=`<div class="p2lab"><h3>🔬 Bayes Lab: Prior → Evidence → Posterior</h3><p>ปรับข้อมูล แล้วดูว่าหลักฐานและ base rate ทำให้ posterior เปลี่ยนอย่างไร จากนั้นเปรียบเทียบกับ decision threshold</p><div class="p2labChoices">${Object.entries(presets).map(([key,v])=>`<button class="${key===current?'sel':''}" data-preset="${key}">${esc(v.label)}<br><small>${esc(v.description)}</small></button>`).join('')}</div><div class="p2labGrid"><label class="p2labCard"><b>Prior / Base rate: <span id="priorVal">${p.prior}%</span></b><input id="bayesPrior" type="range" min="1" max="60" value="${p.prior}"><small>โอกาสก่อนเห็นผลใหม่</small></label><label class="p2labCard"><b>Sensitivity: <span id="sensVal">${p.sens}%</span></b><input id="bayesSens" type="range" min="50" max="99" value="${p.sens}"><small>P(positive | true case)</small></label><label class="p2labCard"><b>False positive: <span id="fpVal">${p.fp}%</span></b><input id="bayesFp" type="range" min="1" max="40" value="${p.fp}"><small>P(positive | not case)</small></label></div><div class="p2labGrid"><label class="p2labCard"><b>Decision threshold: <span id="thVal">${p.threshold}%</span></b><input id="bayesThreshold" type="range" min="10" max="95" value="${p.threshold}"><small>ตั้งตามต้นทุนความผิดพลาด</small></label><div class="p2labCard"><b>คำถามชวนคิด</b><small>เมื่อ prior ต่ำมาก แม้ test positive ก็อาจยังไม่ถึง threshold ได้</small></div><div class="p2labCard"><b>เป้าหมาย Lab</b><small>ลองอย่างน้อย 2 แบบ แล้วเปรียบเทียบ posterior กับ threshold</small></div></div><div class="row" style="margin-top:10px"><button id="bayesRun" class="primary">คำนวณ Posterior</button><span id="bayesStatus" class="p2labStatus">${completed('s8')?'✓ Bayes Lab complete':'ฝึกฝน: ยังไม่กระทบคะแนน Mission'}</span></div><div id="bayesResult" class="p2labResult">ปรับค่าแล้วกด “คำนวณ Posterior”</div></div>`;
      $$('[data-preset]',host).forEach(b=>b.onclick=()=>{current=b.dataset.preset;render();});
      [['bayesPrior','priorVal'],['bayesSens','sensVal'],['bayesFp','fpVal'],['bayesThreshold','thVal']].forEach(([id,label])=>{$('#'+id,host).oninput=e=>{$('#'+label,host).textContent=e.target.value+'%';}});
      $('#bayesRun',host).onclick=calc;
    }
    render();
  }

  function ruleBuilder(host,opts){
    const onComplete=opts?.onComplete;
    const scenarios=[
      {id:'register',title:'ลงทะเบียนเรียน',facts:['paid_fee(a)','passed_prereq(a)','documents_complete(a)'],rules:[['paid_fee(x) AND passed_prereq(x)','can_register(x)'],['can_register(x) AND documents_complete(x)','issue_schedule(x)']],need:['paid_fee(a)','passed_prereq(a)','documents_complete(a)'],goal:'issue_schedule(a)'},
      {id:'lab',title:'เข้าใช้ห้องปฏิบัติการ',facts:['trained(b)','wears_goggles(b)','safety_clear(b)'],rules:[['trained(x) AND wears_goggles(x)','eligible_lab(x)'],['eligible_lab(x) AND safety_clear(x)','enter_lab(x)']],need:['trained(b)','wears_goggles(b)','safety_clear(b)'],goal:'enter_lab(b)'},
      {id:'aid',title:'ตรวจสิทธิ์ทุน',facts:['income_low(c)','documents_complete(c)','ethics_ok(c)'],rules:[['income_low(x) AND documents_complete(x)','eligible_aid(x)'],['eligible_aid(x) AND ethics_ok(x)','recommend_aid(x)']],need:['income_low(c)','documents_complete(c)','ethics_ok(c)'],goal:'recommend_aid(c)'}
    ];
    let idx=0,selected=new Set();
    function infer(sc){
      const facts=new Set([...selected]); const trace=[]; let changed=true;
      while(changed){changed=false;sc.rules.forEach(([left,right])=>{const required=left.split(' AND ').map(x=>x.replace('(x)',sc.goal.match(/\((.)\)/)?.[1] ? '('+sc.goal.match(/\((.)\)/)[1]+')' : '(a)'));if(required.every(x=>facts.has(x))&&!facts.has(right.replace('(x)',sc.goal.match(/\((.)\)/)?.[1] ? '('+sc.goal.match(/\((.)\)/)[1]+')' : '(a)'))){const conclusion=right.replace('(x)',sc.goal.match(/\((.)\)/)?.[1] ? '('+sc.goal.match(/\((.)\)/)[1]+')' : '(a)');facts.add(conclusion);trace.push(`${left.replaceAll('(x)','') || left} → ${conclusion}`);changed=true;}});
      return {facts,trace};
    }
    function render(){
      const sc=scenarios[idx];const actor=sc.goal.match(/\((.)\)/)?.[1]||'a';
      host.innerHTML=`<div class="p2lab"><h3>🧩 Rule Builder: Facts → Rules → Inference Trace</h3><p>เลือก facts ที่พร้อมใช้ แล้วให้ inference engine อนุมานตาม rules. เป้าหมายคือ <b>${esc(sc.goal)}</b></p><div class="p2labChoices">${scenarios.map((x,i)=>`<button class="${i===idx?'sel':''}" data-scenario="${i}">${esc(x.title)}</button>`).join('')}</div><div class="p2labGrid"><div class="p2labCard"><b>Facts ที่เลือก</b>${sc.facts.map(f=>`<button class="${selected.has(f)?'sel':''}" data-fact="${esc(f)}" style="display:block;width:100%;margin-top:7px;text-align:left">${selected.has(f)?'✓ ':''}${esc(f)}</button>`).join('')}</div><div class="p2labCard"><b>Rules</b>${sc.rules.map(([l,r])=>`<div style="margin-top:8px">IF ${esc(l)}<br>THEN ${esc(r)}</div>`).join('')}</div><div class="p2labCard"><b>Mission goal</b><div style="font-size:20px;margin-top:10px;color:#e0f2fe">${esc(sc.goal)}</div><small>ใช้ facts ที่จำเป็นให้ครบ แล้วกด Run inference</small></div></div><div class="row" style="margin-top:10px"><button id="ruleRun" class="primary">Run Inference Engine</button><span id="ruleStatus" class="p2labStatus">${completed('s9')?'✓ Rule Builder complete':'ฝึกฝน: ยังไม่กระทบคะแนน Mission'}</span></div><div id="ruleResult" class="p2labResult">เลือก facts แล้วดู reasoning trace</div></div>`;
      $$('[data-scenario]',host).forEach(b=>b.onclick=()=>{idx=Number(b.dataset.scenario);selected=new Set();render();});
      $$('[data-fact]',host).forEach(b=>b.onclick=()=>{const f=b.dataset.fact;selected.has(f)?selected.delete(f):selected.add(f);render();});
      $('#ruleRun',host).onclick=()=>{
        const out=infer(sc);const hit=out.facts.has(sc.goal);const box=$('#ruleResult',host);box.className='p2labResult '+(hit?'good':'bad');box.innerHTML=hit?`<b>Inference สำเร็จ: ${esc(sc.goal)}</b><ul class="p2labTrace">${out.trace.map(t=>`<li>${esc(t)}</li>`).join('')}</ul><span class="muted">Trace นี้อธิบายได้ว่าระบบใช้ facts/rules ใด</span>`:`<b>ยังพิสูจน์ ${esc(sc.goal)} ไม่ได้</b><br>ตรวจว่าคุณเลือก antecedent ของ rules ครบหรือยัง`;
        emit('s9','rule_builder_run',{itemId:sc.id,prompt:'Rule Builder '+sc.title,isCorrect:hit,extraJson:{selected:[...selected],goal:sc.goal,trace:out.trace}});
        if(hit&&!completed('s9')){markComplete('s9',{lab:'rule_builder',scenario:sc.id,goal:sc.goal},onComplete);const st=$('#ruleStatus',host);if(st)st.textContent='✓ Rule Builder complete — บันทึกเป็นกิจกรรมฝึกฝน';}
      };
    }
    render();
  }

  function casefile(host,opts){
    const onComplete=opts?.onComplete;
    const steps=[
      {title:'Step 1 • ตรวจ Knowledge Conflict',prompt:'ฐานความรู้ระบุว่า applicant(a) มีเอกสารครบ แต่ policy rule รุ่นเก่าระบุให้ปฏิเสธ ในขณะที่ policy ใหม่ยังไม่ถูก validate. ควรทำอะไร?',answer:'หยุดการสรุปที่มีผลสูง แล้วตรวจ conflict และ version ของ rule',options:['อนุมัติทันทีเพราะเอกสารครบ','หยุดการสรุปที่มีผลสูง แล้วตรวจ conflict และ version ของ rule','ใช้ rule ที่เขียนยาวกว่า','ลบข้อมูลเอกสาร']},
      {title:'Step 2 • Update with Evidence',prompt:'ข้อมูลเดิมบอกว่าความเสี่ยงต่ำ แต่พบ evidence ใหม่ที่น่าเชื่อถือและเพิ่มความเสี่ยงเป็น 68% โดย threshold สำหรับส่งผู้เชี่ยวชาญคือ 60%. ควรอธิบายอย่างไร?',answer:'อัปเดต posterior จาก evidence ใหม่ และส่งผู้เชี่ยวชาญตรวจตาม threshold',options:['ยึด prior เดิมเสมอ','อัปเดต posterior จาก evidence ใหม่ และส่งผู้เชี่ยวชาญตรวจตาม threshold','เปลี่ยน threshold เป็น 100%','บอกว่าความเสี่ยง 68% คือคำตัดสินสุดท้าย']},
      {title:'Step 3 • Responsible Action',prompt:'คำตัดสินนี้มีผลต่อสิทธิ์ของผู้สมัคร และยังมี uncertainty กับ rule conflict. Action ใดเหมาะสมที่สุด?',answer:'ให้ human review พร้อม reasoning trace, confidence และช่องส่งหลักฐานเพิ่ม',options:['ปฏิเสธอัตโนมัติ','อนุมัติอัตโนมัติ','ให้ human review พร้อม reasoning trace, confidence และช่องส่งหลักฐานเพิ่ม','ซ่อนเหตุผลเพื่อลดข้อโต้แย้ง']}
    ];
    let index=0,correct=0;
    function render(){
      const step=steps[index];
      host.innerHTML=`<div class="p2lab"><h3>🗂️ B3 Reasoning Casefile</h3><p>เคสหลายขั้น: ตรวจ conflict → update ด้วย evidence → เลือก action ที่รับผิดชอบ</p><div class="p2labGrid"><div class="p2labCard"><b>Case context</b><small>ระบบคัดกรองทุนใช้ knowledge rules ร่วมกับ risk model และมี human reviewer</small></div><div class="p2labCard"><b>Progress</b><div style="font-size:22px;margin-top:5px">${index+1}/3</div></div><div class="p2labCard"><b>Goal</b><small>อย่าตัดสินเด็ดขาดเมื่อ evidence ขัดกันหรือผลกระทบสูง</small></div></div><div class="p2labResult"><b>${esc(step.title)}</b><br>${esc(step.prompt)}</div><div class="p2labChoices">${step.options.map((x,i)=>`<button data-case="${i}">${esc(x)}</button>`).join('')}</div><div id="caseFeedback" class="p2labResult">เลือก action ที่มีเหตุผลตรวจสอบได้</div><span id="caseStatus" class="p2labStatus">${completed('b3')?'✓ B3 Casefile complete':'Casefile นี้เป็น briefing ก่อน Boss'}</span></div>`;
      $$('[data-case]',host).forEach(b=>b.onclick=()=>{
        const selected=step.options[Number(b.dataset.case)],ok=selected===step.answer;
        const feedback=$('#caseFeedback',host);feedback.className='p2labResult '+(ok?'good':'bad');feedback.innerHTML=ok?'<b>ถูกต้อง</b><br>คุณเลือก action ที่มี conflict check, evidence update และ human oversight':'<b>ยังไม่เหมาะสม</b><br>ย้อนดูว่า action นี้จัดการ conflict, uncertainty และผลกระทบสูงครบหรือไม่';
        emit('b3','casefile_step',{itemId:'case_step_'+(index+1),prompt:step.prompt,yourAnswer:selected,correctAnswer:step.answer,isCorrect:ok,extraJson:{step:index+1}});
        $$('[data-case]',host).forEach(x=>x.disabled=true);
        if(ok)correct++;
        setTimeout(()=>{index++;if(index<steps.length)render();else finish();},900);
      });
    }
    function finish(){
      const allGood=correct===steps.length;
      host.innerHTML=`<div class="p2lab"><h3>🗂️ B3 Casefile Debrief</h3><div class="p2labResult ${allGood?'good':'bad'}"><b>${allGood?'Casefile cleared':'Casefile review needed'}</b><br>คุณตอบถูก ${correct}/3 ขั้น<br><span class="muted">หลักคิด: ตรวจ conflict → update ด้วย evidence → อธิบาย confidence → human review เมื่อผลกระทบสูง</span></div><div class="row" style="margin-top:10px"><button id="caseAgain" class="primary">ลอง Casefile ใหม่</button><span id="caseStatus" class="p2labStatus">${completed('b3')?'✓ B3 Casefile complete':'กิจกรรมนี้ไม่แทนคะแนน B3 Boss'}</span></div></div>`;
      if(allGood&&!completed('b3')){markComplete('b3',{lab:'casefile',correct},onComplete);const s=$('#caseStatus',host);if(s)s.textContent='✓ B3 Casefile complete — บันทึกเป็นกิจกรรมฝึกฝน';}
      $('#caseAgain',host).onclick=()=>{index=0;correct=0;render();};
    }
    render();
  }

  function render(missionId,host,opts){
    if(!host)return;
    injectStyle();
    if(missionId==='s8')return bayes(host,opts);
    if(missionId==='s9')return ruleBuilder(host,opts);
    if(missionId==='b3')return casefile(host,opts);
    host.innerHTML='<div class="p2lab"><h3>Learning Lab</h3><p>Mission นี้ยังไม่มี Lab เฉพาะ ใช้เกมหลักและ feedback เพื่อทบทวนแนวคิด</p></div>';
  }

  window.AIQuestPhase2Labs={VERSION,render,completed,markComplete};
  console.log('[AIQuest] '+VERSION+' loaded');
})();