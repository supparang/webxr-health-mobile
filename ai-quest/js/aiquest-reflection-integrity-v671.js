/*
 * CSAI2102 AI Quest — Reflection Integrity Gate v6.7.1
 * Blocks copied placeholders, duplicate reflections, and generic text.
 * Student answers must reference the mission they actually played.
 */
(()=>{'use strict';
  const MID=String(new URLSearchParams(location.search).get('mission')||'s1').toLowerCase();
  const TERMS={
    s1:['ai','ปัญญาประดิษฐ์','automation','อัตโนมัติ','agent','ตัวแทน','เซนเซอร์','sensor','กล้อง','คัดแยก','ห้องสมุด','คำแนะนำ','ข้อมูล'],
    s2:['peas','agent','ตัวแทน','sensor','เซนเซอร์','actuator','ตัวกระทำ','environment','สภาพแวดล้อม','performance','เป้าหมาย','หุ่นยนต์'],
    s3:['search','ค้นหา','state','สถานะ','action','การกระทำ','goal','เป้าหมาย','successor','frontier','bfs','dfs','เส้นทาง'],
    s4:['ucs','uniform cost','ต้นทุน','cost','เส้นทาง','กราฟ','สะสม','โหนด'],
    s5:['a*','astar','heuristic','ฮิวริสติก','g(n)','h(n)','เส้นทาง','ต้นทุน','ค้นหา'],
    s6:['minimax','alpha','beta','คู่แข่ง','เกม','pruning','ตัดกิ่ง','กลยุทธ์'],
    s7:['fact','ข้อเท็จจริง','rule','กฎ','inference','อนุมาน','knowledge base','ฐานความรู้','forward chaining'],
    s8:['bayes','prior','posterior','likelihood','ความน่าจะเป็น','base rate','หลักฐาน','ความไม่แน่นอน'],
    s9:['expert system','ระบบผู้เชี่ยวชาญ','rule','กฎ','explanation','คำอธิบาย','inference','อนุมาน','knowledge base'],
    b1:['ai','agent','ตัวแทน','search','ค้นหา','peas','เป้าหมาย','หลักฐาน'],
    b2:['ucs','a*','astar','minimax','alpha','beta','ต้นทุน','ฮิวริสติก','คู่แข่ง','ค้นหา'],
    b3:['bayes','กฎ','rule','inference','อนุมาน','expert system','ระบบผู้เชี่ยวชาญ','ความไม่แน่นอน','คำอธิบาย'],
    s10:['pipeline','data leakage','leakage','train','validation','test','ข้อมูลรั่วไหล','ชุดฝึก','ชุดตรวจสอบ','ชุดทดสอบ','model drift','ข้อมูลหาย'],
    s11:['threshold','เกณฑ์','precision','recall','false positive','false negative','ผลบวกเท็จ','ผลลบเท็จ','confusion matrix'],
    s12:['cluster','clustering','จัดกลุ่ม','k-means','outlier','จุดผิดปกติ','scale','ปรับสเกล','กลุ่มข้อมูล'],
    s13:['neural','โครงข่ายประสาท','overfitting','validation','generalize','generalization','model drift','ข้อมูลฝึก'],
    s14:['reinforcement','reward','รางวัล','reward hacking','safety constraint','ความปลอดภัย','agent','exploration','human override'],
    s15:['rag','retrieve','retrieval','citation','อ้างอิง','hallucination','แหล่งข้อมูล','เอกสาร','คำตอบ','ข้อมูลส่วนบุคคล'],
    b4:['pipeline','leakage','threshold','precision','recall','cluster','deploy','deployment','model drift','ข้อมูลรั่วไหล'],
    b5:['neural','reinforcement','reward','rag','citation','hallucination','trustworthy ai','ความเป็นธรรม','ปลอดภัย','โปร่งใส','ตรวจสอบ']
  };
  const THINK=['หลักฐาน','เหตุผล','ข้อมูล','เงื่อนไข','ผลกระทบ','เปรียบเทียบ','ตัดสินใจ','เลือก','เพราะ','ความเสี่ยง','ข้อจำกัด','กฎ','เป้าหมาย'];
  const RESPONSIBLE=['รับผิดชอบ','ปลอดภัย','ความปลอดภัย','ความเป็นธรรม','โปร่งใส','ตรวจสอบ','ทบทวน','ข้อจำกัด','ผลกระทบ','ข้อมูลส่วนบุคคล','อ้างอิง','ความเสี่ยง'];
  const HUMAN=['มนุษย์','ผู้เชี่ยวชาญ','ครู','อาจารย์','เจ้าหน้าที่','ผู้ตรวจ','บรรณารักษ์','แพทย์','ผู้ใช้'];
  const REVIEW=['ตรวจ','ทบทวน','อุทธรณ์','อนุมัติ','ยืนยัน','รับผิดชอบ','แก้ไข','ตัดสินใจ','หยุด','กำกับ'];
  const PLACEHOLDERS=[
    'เลือก 1 case จากรอบนี้ แล้วอธิบายหลักฐานหรือหลักการที่ใช้ตัดสินใจ',
    'เลือก 1 case แล้วอธิบายหลักฐานหรือหลักการที่ใช้ตัดสินใจ',
    'ยกตัวอย่างการใช้ ai อย่างรับผิดชอบที่เชื่อมโยงกับ case ในรอบนี้',
    'ระบุจุดที่มนุษย์ควรตรวจทาน และเหตุผลว่าทำไมจึงไม่ควรปล่อยให้ ai ตัดสินใจลำพัง',
    'ระบุจุดที่มนุษย์ควรตรวจทาน และเหตุผลว่าทำไม ai ไม่ควรตัดสินใจลำพัง',
    'อย่างน้อย 45 ตัวอักษร อธิบายหลักการที่ใช้ตัดสินใจในหนึ่ง case',
    'อย่างน้อย 45 ตัวอักษร ยกตัวอย่างการใช้ ai อย่างรับผิดชอบ',
    'อย่างน้อย 45 ตัวอักษร อธิบายจุดที่มนุษย์ควรตรวจทาน'
  ];
  const $=id=>document.getElementById(id);
  const normal=value=>String(value||'').toLowerCase().replace(/[\s\n\r\t.,!?…:;()\[\]{}"'`~\-_\/\\|]+/g,'');
  const count=value=>String(value||'').replace(/\s/g,'').length;
  const has=(text,term)=>{
    const raw=String(text||'').toLowerCase();
    const n=normal(text),needle=String(term||'').toLowerCase(),nn=normal(term);
    return raw.indexOf(needle)>=0 || (nn.length>=3 && n.indexOf(nn)>=0);
  };
  const any=(text,terms)=>(terms||[]).some(term=>has(text,term));
  const dice=(left,right)=>{
    const a=normal(left),b=normal(right);
    if(!a||!b)return 0;
    if(a===b)return 1;
    const grams=value=>{const out=[];for(let i=0;i<value.length-1;i++)out.push(value.slice(i,i+2));return out;};
    const ga=grams(a),gb=grams(b),bag={};ga.forEach(x=>bag[x]=(bag[x]||0)+1);let hit=0;gb.forEach(x=>{if(bag[x]){hit++;bag[x]--;}});
    return (2*hit)/Math.max(1,ga.length+gb.length);
  };
  const label=i=>['ข้อ 1','ข้อ 2','ข้อ 3'][i]||'Reflection';
  function copiedPrompt(value){
    const n=normal(value);
    if(!n)return false;
    return PLACEHOLDERS.some(template=>{
      const t=normal(template);
      return n===t || (n.length>=Math.min(30,t.length*.72) && (n.indexOf(t)>=0 || t.indexOf(n)>=0));
    });
  }
  function validate(values){
    const answers=(values||[]).map(value=>String(value||'').trim());
    const terms=TERMS[MID]||TERMS.s1;
    const errors=[];
    answers.forEach((answer,index)=>{
      if(count(answer)<55)errors.push(label(index)+' ต้องมีอย่างน้อย 55 ตัวอักษรที่เป็นคำตอบของตนเอง');
      if(copiedPrompt(answer))errors.push(label(index)+' เป็นข้อความคำสั่ง/placeholder ไม่ใช่คำตอบสะท้อนคิด');
      if(!any(answer,terms))errors.push(label(index)+' ต้องอ้างถึงแนวคิดหรือคำสำคัญของ '+MID.toUpperCase()+' ที่เล่นในรอบนี้');
    });
    if(!any(answers[0],THINK))errors.push('ข้อ 1 ต้องอธิบายหลักฐาน เหตุผล เงื่อนไข หรือผลกระทบที่ใช้ตัดสินใจ');
    if(!any(answers[1],RESPONSIBLE))errors.push('ข้อ 2 ต้องกล่าวถึงความรับผิดชอบ ความปลอดภัย ข้อจำกัด ความเป็นธรรม หรือการตรวจสอบ');
    if(!any(answers[2],HUMAN)||!any(answers[2],REVIEW))errors.push('ข้อ 3 ต้องระบุว่าใครควรตรวจทาน และควรตรวจ/ทบทวนเรื่องใด');
    for(let i=0;i<answers.length;i++)for(let j=i+1;j<answers.length;j++){
      const near=dice(answers[i],answers[j]);
      if(near>=.82)errors.push(label(i)+' และ '+label(j)+' ซ้ำหรือใกล้เคียงกันเกินไป — เขียนคนละประเด็น');
    }
    return {ok:errors.length===0,errors,answers,terms};
  }
  function note(message,kind){
    const el=$('saveNote');if(!el)return;
    el.className='notice '+(kind||'');el.innerHTML=message;
  }
  function coach(){
    const host=$('saveNote');if(!host||$('reflectionIntegrity'))return;
    const box=document.createElement('div');box.id='reflectionIntegrity';box.style.cssText='margin-top:10px;padding:10px 12px;border:1px solid rgba(56,189,248,.34);border-radius:13px;background:rgba(56,189,248,.07);color:#dbeafe;line-height:1.6;font-size:13px';
    host.insertAdjacentElement('afterend',box);
    const update=()=>{
      const values=['r1','r2','r3'].map(id=>$(id)?.value||'');
      const report=validate(values);
      const counts=values.map((v,i)=>'<span style="margin-right:8px">'+label(i)+': '+count(v)+'/55</span>').join('');
      box.innerHTML='<b>Reflection Check</b><br>'+counts+'<br><span style="color:'+(report.ok?'#bbf7d0':'#fde68a')+'">'+(report.ok?'✓ เนื้อหาผ่านเกณฑ์ พร้อมส่งผล':'ต้องเขียนด้วยคำตอบของตนเอง เชื่อมโยงแนวคิดของ '+MID.toUpperCase()+' และห้ามคัดลอกข้อความคำสั่ง')+'</span>';
    };
    ['r1','r2','r3'].forEach(id=>$(id)?.addEventListener('input',update));
    update();
  }
  function blockInvalid(event){
    const target=event.target;
    if(!target||target.id!=='save')return;
    const report=validate(['r1','r2','r3'].map(id=>$(id)?.value||''));
    if(report.ok)return;
    event.preventDefault();event.stopImmediatePropagation();event.stopPropagation();
    const list=report.errors.slice(0,5).map(item=>'<li>'+item+'</li>').join('');
    note('<b>ยังส่งผลไม่ได้</b><br><ul style="margin:7px 0 0;padding-left:20px">'+list+'</ul>','bad');
    const first=['r1','r2','r3'].map(id=>$(id)).find(el=>el&&count(el.value)<55)||$('r1');
    first?.focus();
  }
  function init(){
    coach();
    document.addEventListener('click',blockInvalid,true);
  }
  window.AIQuestReflectionIntegrityV671={validate,missionId:MID,version:'v6.7.1'};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();