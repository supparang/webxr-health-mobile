(() => {
  'use strict';
  const pairs = [
    ['Mission locked','ภารกิจยังล็อกอยู่'],['Mission Control','ศูนย์ภารกิจ'],['Mission progress','ความคืบหน้าภารกิจ'],['decisions','ข้อการตัดสินใจ'],['Score','คะแนน'],['Verified','เหตุผลที่ผ่าน'],['Clock','เวลา'],['Reason Check: ทำไมคำตอบนี้จึงน่าเชื่อ?','ตรวจเหตุผล: ทำไมคำตอบนี้จึงน่าเชื่อถือ?'],['verified mastery','ความเข้าใจที่ผ่านการตรวจเหตุผล'],['2★ Readiness','2★ ระดับความพร้อม'],['3★ ต้องตอบถูกและเลือกเหตุผลสนับสนุนได้ตรงหลักฐาน','3★ ต้องตอบถูกและเลือกเหตุผลที่เชื่อมกับหลักฐาน'],['BOSS SIGNAL','ด่านบอส'],['CASE ','คดีที่ '],['ออก','ออกจากภารกิจ']
  ];
  function apply(){
    const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT);
    const nodes=[]; while(walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node=>{
      const parent=node.parentElement;
      if(!parent || ['SCRIPT','STYLE'].includes(parent.tagName)) return;
      let next=node.nodeValue;
      pairs.forEach(([from,to])=>{ next=next.split(from).join(to); });
      if(next!==node.nodeValue) node.nodeValue=next;
    });
  }
  addEventListener('DOMContentLoaded',()=>{
    apply();
    let pending=false;
    new MutationObserver(()=>{
      if(pending) return;
      pending=true;
      requestAnimationFrame(()=>{pending=false;apply();});
    }).observe(document.documentElement,{childList:true,subtree:true});
  },{once:true});
})();