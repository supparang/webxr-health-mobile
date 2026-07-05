/* CSAI2102 Replay Expansion v6.5.1 — real alternate case forms */
(()=>{'use strict';
  const mid=String(new URLSearchParams(location.search).get('mission')||'s1').toLowerCase();
  const bank=mid==='s1'?window.AIQuestS1ThaiV646:(window.AIQuestCoreThaiBanksV646||{})[mid];
  if(!bank||bank.__expandedV651)return;
  bank.__expandedV651=true;
  const clone=row=>[row[0],row[1],Array.isArray(row[2])?row[2].slice():[],row[3]||''];
  function addForms(rows,label){
    const original=(rows||[]).map(clone),out=[];
    original.forEach((row,index)=>{
      const prompt=row[0],correct=row[1],wrong=row[2],explain=row[3];
      out.push(row);
      out.push([
        'Case Explain '+(index+1)+': ทีมต้องอธิบายว่าเหตุใดแนวทาง “'+correct+'” จึงเหมาะสมที่สุดกับสถานการณ์นี้ เหตุผลใดถูกต้อง',
        'เพราะ '+explain,
        ['เพราะไม่จำเป็นต้องใช้หลักฐาน','เพราะไม่ต้องคำนึงถึงผลกระทบ','เพราะระบบอัตโนมัติไม่เคยผิดพลาด'],
        'การอธิบายเหตุผลทำให้ผู้เรียนเชื่อมหลักการกับการตัดสินใจ ไม่ใช่จำคำตอบอย่างเดียว'
      ]);
      out.push([
        'Case Repair '+(index+1)+': ผู้ดูแลกำลังจะเลือก “'+(wrong[0]||'แนวทางที่ไม่เหมาะสม')+'” ในภารกิจ '+label+' ควรแก้เป็นแนวทางใด',
        correct,
        [wrong[0]||'เลือกแบบสุ่ม',wrong[1]||'ไม่ตรวจสอบผล','คงแนวทางเดิมแม้มีความเสี่ยง'],
        explain
      ]);
    });
    return out;
  }
  bank.m=addForms(bank.m,bank.title||mid);
  bank.q=addForms(bank.q,bank.title||mid);
})();