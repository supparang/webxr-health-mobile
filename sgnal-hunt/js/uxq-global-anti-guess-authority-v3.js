/* CSAI2601 UX Quest • Stable Global Anti-Guess Authority v3
 * W1-W15 + B1-B4, except W7.
 * Writes visible choice text once per rendered stage/reason state.
 * No polling interval and no competing continuous rewrite loop.
 */
(function(){
  'use strict';
  var q=new URLSearchParams(location.search||'');
  var nodeId=String(q.get('node')||q.get('id')||'').toUpperCase();
  if(!nodeId||nodeId==='W7')return;

  var VERSION='global-anti-guess-v3-stable-20260714';
  var lastSignature='';
  var scheduled=0;
  var clean=function(v,n){return String(v==null?'':v).replace(/\s+/g,' ').trim().slice(0,n||800);};
  var buttons=function(g){return g?Array.prototype.slice.call(g.querySelectorAll('button.option')):[];};

  function stageIndex(){
    var t=clean((document.querySelector('.hud .meter b')||document.querySelector('.case h1')||{}).textContent,180);
    var m=t.match(/([1-9])\s*\/\s*([1-9])|(?:ข้อ|รอบภารกิจ|รอบบอส)\s*([1-9])/i);
    return Math.max(0,Number((m&&(m[1]||m[3]))||1)-1);
  }
  function kind(){
    var t=clean([
      (document.querySelector('.case .kicker')||{}).textContent,
      (document.querySelector('.case h1')||{}).textContent,
      (document.querySelector('.case p:last-child')||{}).textContent,
      (document.querySelector('.verify p')||{}).textContent
    ].join(' '),700).toLowerCase();
    if(/friction|จุดติดขัด|pain|issue/.test(t))return 'friction';
    if(/goal|เป้าหมาย|persona|empathy/.test(t))return 'goal';
    if(/impact|cognitive|memory|attention|feedback|information architecture|mental model/.test(t))return 'impact';
    if(/proof|test|validate|ทดสอบ|พิสูจน์|metric/.test(t))return 'proof';
    return 'decision';
  }
  function correctMain(bs){
    return bs.find(function(b){return b.dataset.uxqCorrect==='1'||b.getAttribute('data-correct')==='true';})||
      bs.find(function(b){var s=clean((b.querySelector('span')||{}).textContent,300);return /เชื่อมกับหลักฐานและ artifact|หลักฐานและ artifact/i.test(s)&&!/กับดัก/i.test(s);})||bs[0];
  }
  function correctReason(bs){
    return bs.find(function(b){return b.dataset.uxqCorrect==='1'||b.getAttribute('data-correct')==='true';})||
      bs.find(function(b){return /^ถูก\s*เพราะ|task outcome|user outcome/i.test(clean((b.querySelector('span')||{}).textContent,400));})||bs[0];
  }

  var MAIN={
    friction:[
      'ใช้จุดที่ผู้ใช้หยุดหรือย้อนกลับระหว่างงาน เป็นเกณฑ์เลือกปัญหาหลัก',
      'ใช้ข้อมูลที่ผู้ใช้เปิดดูบ่อย เป็นเกณฑ์เลือกส่วนที่ควรปรับก่อน',
      'ใช้จุดที่ทีมแก้ได้เร็ว เป็นเกณฑ์เริ่มปรับในรอบพัฒนาแรก',
      'ใช้ส่วนที่มองเห็นเด่นที่สุด เป็นเกณฑ์เลือกปัญหาที่ควรแก้ก่อน'
    ],
    goal:[
      'กำหนดผลลัพธ์ของงานที่ผู้ใช้ต้องทำสำเร็จ พร้อมเงื่อนไขว่าจบงานแล้ว',
      'กำหนดความรู้สึกที่ผู้ใช้ควรได้รับ พร้อมองค์ประกอบที่ช่วยสร้างความมั่นใจ',
      'กำหนดข้อมูลที่ควรเห็นครบ พร้อมรายละเอียดที่ช่วยลดคำถามภายหลัง',
      'กำหนดขั้นตอนที่ระบบต้องรองรับ พร้อมข้อจำกัดที่ช่วยให้ส่งมอบได้จริง'
    ],
    impact:[
      'แยกว่าปัญหาอยู่ที่การมองเห็น ลำดับงาน หรือ feedback แล้วแก้ให้ตรงชั้น',
      'รวมปัญหาไว้ในกรอบ UI เพื่อให้ทีมใช้มาตรฐานภาพชุดเดียวกันแก้ได้เร็ว',
      'เริ่มจาก performance เพราะเวลาตอบสนองที่ดีอาจลดความสับสนระหว่างใช้',
      'เริ่มจากความคุ้นเคย เพราะรูปแบบเดิมช่วยลดภาระเรียนรู้ของผู้ใช้เดิม'
    ],
    decision:[
      'วางข้อมูลที่ใช้ตัดสินใจไว้ใกล้ action หลัก และลดการย้อนหาระหว่างงาน',
      'แบ่งข้อมูลเป็นหลายขั้น เพื่อให้แต่ละหน้าสั้นและผู้ใช้โฟกัสทีละส่วน',
      'คงโครงเดิมไว้ แล้วเพิ่มคำอธิบายตรงจุดที่ผู้ใช้มักลังเลหรือหยุด',
      'แสดงภาพรวมก่อน แล้วเปิดรายละเอียดเพิ่มเมื่อผู้ใช้พร้อมตัดสินใจต่อ'
    ],
    proof:[
      'ให้ผู้ใช้ทำงานเดิม แล้วเทียบความสำเร็จ เวลา error และความเข้าใจขั้นต่อไป',
      'ให้ผู้ใช้เลือกแบบที่ชอบ แล้วเทียบคะแนนความพึงพอใจก่อนและหลังปรับ',
      'ให้ทีมตรวจความครบตาม design system แล้วใช้ข้อผิดพลาดเป็นเกณฑ์ผ่าน',
      'เทียบจำนวนเข้าชมและเวลาบนหน้า เพื่อดูความสนใจหลังเปลี่ยนแบบ'
    ]
  };
  var REASON={
    friction:[
      'เกณฑ์นี้อิงพฤติกรรมที่ทำให้งานสะดุด จึงระบุ friction ที่ตรวจซ้ำได้',
      'เกณฑ์นี้อิงความถี่การเปิดดู จึงสะท้อนว่าส่วนนั้นมีความสำคัญต่อผู้ใช้',
      'เกณฑ์นี้อิงความเร็วของทีม จึงช่วยลดความเสี่ยงและส่งมอบได้เร็วขึ้น',
      'เกณฑ์นี้อิงความเด่นทางภาพ จึงช่วยเลือกส่วนที่ผู้ใช้สังเกตเห็นง่าย'
    ],
    goal:[
      'เกณฑ์นี้ผูกกับผลลัพธ์ของ task จึงตรวจได้ว่าผู้ใช้ทำงานสำเร็จหรือไม่',
      'เกณฑ์นี้ผูกกับความรู้สึก จึงตรวจได้ว่าผู้ใช้มั่นใจและพึงพอใจขึ้นหรือไม่',
      'เกณฑ์นี้ผูกกับความครบของข้อมูล จึงตรวจได้ว่าคำถามภายหลังลดลงหรือไม่',
      'เกณฑ์นี้ผูกกับข้อจำกัดส่งมอบ จึงตรวจได้ว่าทีมพัฒนาได้ตามแผนหรือไม่'
    ],
    impact:[
      'เหตุผลนี้แยกชั้นปัญหา จึงลดโอกาสเลือกวิธีแก้ที่ดีแต่ไม่ตรงสาเหตุ',
      'เหตุผลนี้รวมปัญหาไว้ใน UI จึงช่วยให้ใช้ภาษาออกแบบชุดเดียวกันได้ง่าย',
      'เหตุผลนี้ให้ความสำคัญกับความเร็ว จึงช่วยลดเวลารอระหว่างใช้งาน',
      'เหตุผลนี้ให้ความสำคัญกับความคุ้นเคย จึงช่วยผู้ใช้เดิมเรียนรู้น้อยลง'
    ],
    decision:[
      'เหตุผลนี้รักษาลำดับข้อมูลไปสู่ action จึงลดการย้อนหาเงื่อนไข',
      'เหตุผลนี้ลดความหนาแน่นของหน้า จึงช่วยให้ผู้ใช้โฟกัสทีละขั้น',
      'เหตุผลนี้คงโครงเดิมและเพิ่มคำอธิบาย จึงช่วยผู้ใช้เรียนรู้วิธีใช้',
      'เหตุผลนี้เปิดรายละเอียดตามต้องการ จึงช่วยลดสิ่งรบกวนบนหน้าจอ'
    ],
    proof:[
      'เกณฑ์นี้วัด task outcome โดยตรง จึงเทียบผลก่อนและหลังได้ชัดเจน',
      'เกณฑ์นี้วัดความพึงพอใจโดยตรง จึงสะท้อนความรู้สึกต่อแบบใหม่',
      'เกณฑ์นี้วัดความครบตามมาตรฐาน จึงสะท้อนคุณภาพการผลิตของทีม',
      'เกณฑ์นี้วัด engagement จึงสะท้อนความสนใจและเวลาใช้งานของผู้ใช้'
    ]
  };

  function write(button,label,sub){
    if(!button)return;
    var b=button.querySelector('b')||button;
    if(b.textContent!==label)b.textContent=label;
    var s=button.querySelector('span');
    if(s&&s.textContent!==sub)s.textContent=sub;
    button.removeAttribute('title');
    button.style.minHeight='96px';
  }
  function rewrite(group,models,finder,sub){
    var bs=buttons(group); if(bs.length!==4)return;
    var right=finder(bs),wrong=bs.filter(function(b){return b!==right;});
    write(right,models[0],sub);
    wrong.forEach(function(b,i){write(b,models[i+1],sub);});
  }
  function signature(){
    var qbox=document.querySelector('.question');
    if(!qbox)return '';
    return [nodeId,stageIndex(),kind(),!!qbox.querySelector('.verify'),buttons(qbox.querySelectorAll('.options')[0]).length,buttons(qbox.querySelectorAll('.options')[1]).length].join('|');
  }
  function patch(force){
    var qbox=document.querySelector('.question'); if(!qbox)return;
    var sig=signature(); if(!force&&sig===lastSignature)return;
    lastSignature=sig;
    var groups=qbox.querySelectorAll('.options'),k=kind();
    if(groups[0])rewrite(groups[0],MAIN[k]||MAIN.decision,correctMain,'เทียบกับสถานการณ์ งานหลัก และผลที่ตรวจสอบได้');
    if(groups[1])rewrite(groups[1],REASON[k]||REASON.decision,correctReason,'พิจารณาความสัมพันธ์ของหลักฐานและผลลัพธ์');
    var ins=qbox.querySelector('.instruction');
    if(ins)ins.textContent='ทุกตัวเลือกมีข้อดีบางส่วน ให้เลือกข้อที่ตรงกับสถานการณ์มากที่สุด';
    if(!document.querySelector('[data-global-anti-v3]')){
      var badge=document.createElement('div');
      badge.setAttribute('data-global-anti-v3','1');
      badge.style.cssText='position:fixed;left:12px;bottom:12px;z-index:99999;padding:7px 10px;border-radius:999px;background:#102b45;color:#c9f5ff;border:1px solid #5ad7ef;font:700 12px system-ui';
      badge.textContent='Anti-Guess v3 Stable • '+nodeId;
      document.body.appendChild(badge);
    }
  }
  function schedule(){
    clearTimeout(scheduled);
    scheduled=setTimeout(function(){patch(false);},35);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){patch(true);},{once:true});else patch(true);
  var root=document.getElementById('uxqCanonicalNode')||document.body;
  new MutationObserver(schedule).observe(root,{childList:true,subtree:true});
  window.UXQGlobalAntiGuessV3=Object.freeze({version:VERSION,patch:function(){patch(true);}});
})();