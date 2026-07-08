// === /sgnal-hunt/js/uxq-csai2601-item-bank-b1-b4-v1.js ===
// CSAI2601 UX Quest Boss Item Banks: B1-B4, 40 cases per boss gate.
(function () {
  'use strict';
  const VERSION = 'v20260708-b1-b4-160cases';
  const content = window.CSAI2601_UXQ_CANONICAL_CONTENT_V1;
  if (!content || !Array.isArray(content.nodes)) return;

  const configs = {
    B1: {
      contexts:['ระบบบริการนักศึกษา','ระบบขอเอกสารออนไลน์','แอปกิจกรรมมหาวิทยาลัย','ระบบจองคิวห้องพยาบาล','LMS ส่งงาน','เว็บห้องสมุด','ระบบลงทะเบียนเรียน','เว็บทุนการศึกษา','ระบบแจ้งซ่อม','หน้าแรกบริการนักศึกษา'],
      issues:['หาเมนูไม่เจอ + error ไม่ชัด','ข้อมูลมากจนตัดสินใจไม่ได้','ผู้ใช้ไม่รู้ next step หลัง action','ทีมเดา solution ก่อนเข้าใจผู้ใช้'],
      make(ctx, issue, i, j){ return { context:ctx, issue, uiProblem:j===0?'visual hierarchy/menu label ไม่ชัด':'ลำดับข้อมูลและ feedback ไม่ช่วย task', uxProblem:issue, hcdEvidence:j===3?'ต้องเก็บ evidence ก่อน prototype':'ต้องสังเกต task และแยก assumption', psychology:j===1?'cognitive load / decision fatigue':'feedback / mental model / attention', fix:'ปรับลำดับข้อมูล feedback และ task path จากหลักฐานผู้ใช้', proof:'วัด task success เวลา error และความเข้าใจ next step' }; }
    },
    B2: {
      contexts:['ระบบจองบริการมหาวิทยาลัย','ระบบยืมคืนอุปกรณ์','ระบบคำร้องออนไลน์','LMS รายวิชา','เว็บทุนการศึกษา','ระบบเลือกวิชาเสรี','ระบบจองห้องประชุม','เว็บตารางสอบมือถือ','ระบบสมัครกิจกรรม','ระบบจองคิวอาจารย์'],
      issues:['persona ไม่ตรง problem','insight ไม่เชื่อม HMW','IA/flow ทำให้ผู้ใช้หลุด','wireframe ไม่สะท้อน priority/CTA'],
      make(ctx, issue, i, j){ return { context:ctx, issue, persona:'ระบุผู้ใช้หลักและสถานการณ์ใช้งานให้ตรงกับ problem', problem:j===1?'แปลง insight เป็น root cause, problem statement และ HMW':'problem ต้องโยง evidence และ user need', flow:j===2?'จัด sitemap, navigation, happy path และ error path ให้ไม่หลุด':'flow ต้องพาผู้ใช้ทำ task จากเริ่มถึงยืนยันได้', wireframe:j===3?'จัด visual priority, layout, CTA และ mobile ให้ตอบ flow':'wireframe ต้องสะท้อน goal และ evidence', defense:'ป้องกันงานด้วย chain: evidence → problem → flow → wireframe → test idea' }; }
    },
    B3: {
      contexts:['ระบบบริการนักศึกษา multi-page','portal สมัครกิจกรรม','เว็บทุน responsive','LMS mobile','ระบบคำร้องออนไลน์','ห้องสมุด mobile','dashboard คะแนน','ระบบจองห้อง','ระบบแจ้งซ่อม','เว็บตารางสอบ'],
      issues:['component ไม่สม่ำเสมอ','responsive layout พังบนมือถือ','contrast/focus/touch target ต่ำ','visual style ทำให้ status สับสน'],
      make(ctx, issue, i, j){ return { context:ctx, issue, pattern:j===0?'รวม component ซ้ำ กำหนด variant/state/naming ให้ชัด':'ใช้ design system ลดความจำและความสับสน', responsive:j===1?'mobile-first, breakpoint จาก content และ touch target ที่เหมาะ':'layout ต้องใช้ได้หลายขนาดจอ', accessibility:j===2?'ตรวจ contrast, label, keyboard focus และ touch target':'accessibility เป็น usability ของทุกคน', visual:j===3?'กำหนด color token, typography scale และ status meaning':'visual system ต้องสื่อความหมาย ไม่ใช่แค่สวย', defense:'ป้องกัน interface system ด้วย consistency + responsive + accessibility evidence' }; }
    },
    B4: {
      contexts:['Prototype service portal','Student request app','Prototype จองห้อง','Prototype LMS assignment','ระบบสมัครทุน prototype','ระบบห้องสมุด prototype','dashboard คะแนน prototype','ระบบแจ้งซ่อม prototype','portfolio final prototype','prototype สมัครกิจกรรม'],
      issues:['state หลัง action ไม่ชัด','prototype link/error path ขาด','usability finding มี severity หลายระดับ','iteration ไม่เชื่อม evidence'],
      make(ctx, issue, i, j){ return { context:ctx, issue, state:j===0?'กำหนด loading/disabled/error/success/empty state และ microcopy':'component state ต้องทำให้ผู้ใช้มั่นใจหลัง action', prototype:j===1?'main flow, missing link, modal/overlay และ error path ต้องคลิกทดสอบได้':'prototype ต้องทดสอบ task จริง ไม่ใช่ภาพนิ่ง', evaluation:j===2?'อ่าน evidence, classify finding และ rank severity ตาม task impact':'severity มาจากผลต่อ task ไม่ใช่ความรู้สึกทีม', iteration:j===3?'เลือก evidence-based fix แล้ว retest task เดิม':'before/after ต้องพิสูจน์ด้วย success/time/error', defense:'ป้องกัน validation ด้วย state → prototype → evidence → fix → retest' }; }
    }
  };

  function pad(n){ return String(n).padStart(3,'0'); }
  function buildCases(id,cfg){
    const out=[];
    cfg.contexts.forEach((ctx,i)=>cfg.issues.forEach((issue,j)=>{
      const n=(i*cfg.issues.length)+j+1;
      out.push(Object.assign({ id:`${id}-C${pad(n)}`, context:ctx, issue, variant:j+1 }, cfg.make(ctx,issue,i,j)));
    }));
    return out;
  }
  function uniqById(list){ const seen=new Set(); return (list||[]).filter((item)=>{ const id=String(item&&item.id||'').trim(); if(!id||seen.has(id)) return false; seen.add(id); return true; }); }
  const counts={};
  Object.keys(configs).forEach((id)=>{
    const node=content.nodes.find((n)=>String(n.id||'').toUpperCase()===id);
    if(!node) return;
    const cases=buildCases(id,configs[id]);
    node.seedCases=uniqById(cases.concat(Array.isArray(node.seedCases)?node.seedCases:[]));
    node.itemBankVersion=VERSION;
    node.minReplayCases=40;
    node.targetReplayCases=40;
    counts[id]=cases.length;
  });
  window.CSAI2601_UXQ_ITEM_BANK_B1_B4_V1=Object.freeze({ version:VERSION, counts });
})();
