/* CSAI2601 UX Quest • Boss-Aware Main Choices B1-B4 v1
 * Rewrites visible main question/options for B1-B4 according to selected boss case fields.
 */
(() => {
  'use strict';
  const $ = (s, r=document) => r.querySelector(s);
  const text = (el) => String(el?.textContent || '').trim();
  const qp = () => new URLSearchParams(location.search || '');
  const nodeId = () => String(qp().get('node') || qp().get('id') || 'B1').toUpperCase();
  const content = () => window.CSAI2601_UXQ_CANONICAL_CONTENT_V1;
  function currentCaseId(){ const m=text($('.top .pill')).match(/(B[1-4]-C\d{3})/i); return m?m[1].toUpperCase():''; }
  function currentStageIndex(){ const m=text($('.hud .meter b')).match(/^(\d+)\s*\/\s*\d+/); return m?Math.max(0,Number(m[1])-1):0; }
  function currentCase(){ const id=currentCaseId(); const node=(content()?.nodes||[]).find((n)=>String(n.id||'').toUpperCase()===nodeId()); return (node?.seedCases||[]).find((c)=>String(c.id||'').toUpperCase()===id)||null; }
  function setText(el,value){ if(el&&value) el.textContent=value; }
  function setOption(btn,label,helper){ const b=$('b',btn); const span=$('span',btn); if(b) b.textContent=label; if(span) span.textContent=helper||'คำตอบบอสต้องโยงหลักฐานหลายชั้น'; }
  function option(prefix){ return $(`.options .option[data-choice^="${prefix}"]`); }
  function pack(items){ return items.map((x)=>Array.isArray(x)?x:[x,'กับดัก: ตอบแค่ชั้นเดียว ไม่พอสำหรับบอส']); }

  function taskB1(c,s){ return [
    ['บอส B1: ปัญหานี้ควรวิเคราะห์จากชั้นใดก่อน', `สถานการณ์: ${c.context} • Issue: ${c.issue}`, c.uxProblem || c.issue, pack(['ดูสี/ไอคอนก่อนโดยไม่ดู task','ถามทีมว่าชอบแบบไหน','แก้ตามสิ่งที่ทำเร็วที่สุด'])],
    ['หลักฐาน HCD ใดต้องเก็บก่อนออกแบบ', `สถานการณ์: ${c.context}`, c.hcdEvidence || 'สังเกต task จริงและแยก assumption ก่อน prototype', pack(['เริ่ม prototype ทันที','ฟัง stakeholder เดียว','ดูเว็บคู่แข่งอย่างเดียว'])],
    ['จิตวิทยาผู้ใช้เกี่ยวข้องอย่างไร', `สถานการณ์: ${c.context}`, c.psychology || 'feedback / mental model / cognitive load / attention กระทบการตัดสินใจ', pack(['เป็นแค่ความสวย','เป็นแค่โค้ดช้า','ผู้ใช้ควรอ่านเองทั้งหมด'])],
    ['Fix ใดเชื่อม UI/UX/HCD/Psychology', `สถานการณ์: ${c.context}`, c.fix || 'ปรับลำดับข้อมูล feedback และ task path จากหลักฐาน', pack(['เปลี่ยนสีทั้งหมด','เพิ่ม FAQ ยาว','เพิ่ม animation ให้เด่น'])],
    ['จะพิสูจน์ผลอย่างไร', `สถานการณ์: ${c.context}`, c.proof || 'วัด task success เวลา error และ next step หลังใช้', pack(['ถามว่าชอบภาพไหม','ให้ทีมโหวต','ดูยอดเข้าเว็บอย่างเดียว'])]
  ][s]||null; }
  function taskB2(c,s){ return [
    ['บอส B2: evidence chain ใดต้องถูกก่อน', `สถานการณ์: ${c.context} • Issue: ${c.issue}`, c.persona || 'persona ต้องตรง problem และสถานการณ์ใช้งาน', pack(['เริ่มจาก wireframe สวยก่อน','ข้าม persona เพราะเสียเวลา','ใช้ persona กว้าง ๆ ทุกคน'])],
    ['Problem/HMW ใดเชื่อมกับ insight', `สถานการณ์: ${c.context}`, c.problem || 'แปลง insight เป็น root cause, problem statement และ HMW', pack(['HMW ที่ล็อก solution','problem กว้างว่าใช้งานยาก','เลือกตามฟีเจอร์ที่ทีมอยากทำ'])],
    ['Flow/IA ใดลดการหลุดจากงาน', `สถานการณ์: ${c.context}`, c.flow || 'จัด sitemap, navigation, happy path และ error path ให้พา task สำเร็จ', pack(['เรียงตามหน่วยงาน','รวมทุกเมนูหน้าแรก','ไม่มี error path'])],
    ['Wireframe defense ใดถูกต้อง', `สถานการณ์: ${c.context}`, c.wireframe || 'จัด priority, layout, CTA และ mobile ให้ตอบ flow', pack(['ภาพใหญ่ก่อน action','ทุกอย่างเด่นเท่ากัน','ซ่อน CTA ไว้ท้ายหน้า'])],
    ['บอสควรป้องกันงานด้วย chain ใด', `สถานการณ์: ${c.context}`, c.defense || 'evidence → problem → flow → wireframe → test idea', pack(['wireframe → สี → ความชอบ','ทีมชอบ → ทำตาม → จบ','copy app ดัง → ส่งงาน'])]
  ][s]||null; }
  function taskB3(c,s){ return [
    ['บอส B3: Pattern/System issue ใดต้องแก้', `สถานการณ์: ${c.context} • Issue: ${c.issue}`, c.pattern || 'รวม component ซ้ำ กำหนด variant/state/naming', pack(['เพิ่ม component ใหม่ทุกหน้า','ใช้สีตามความชอบ','ไม่ต้องมี state'])],
    ['Responsive decision ใดจำเป็น', `สถานการณ์: ${c.context}`, c.responsive || 'mobile-first + breakpoint จาก content + touch target เหมาะสม', pack(['ย่อ desktop ทั้งหน้า','ให้ผู้ใช้ซูมเอง','ออกแบบเฉพาะจอใหญ่'])],
    ['Accessibility issue ใดกระทบงานหลัก', `สถานการณ์: ${c.context}`, c.accessibility || 'contrast, label, keyboard focus และ touch target', pack(['a11y ไม่เกี่ยวกับผู้ใช้ทั่วไป','ซ่อน label เพื่อความโล่ง','ใช้สีอย่างเดียวบอกสถานะ'])],
    ['Visual system ใดสื่อความหมาย', `สถานการณ์: ${c.context}`, c.visual || 'color token, typography scale และ status meaning ต้องชัด', pack(['ใช้แดงกับทุกอย่าง','font size เดียวทั้งหน้า','spacing ตามความรู้สึก'])],
    ['B3 defense ควรยืนยันอะไร', `สถานการณ์: ${c.context}`, c.defense || 'consistency + responsive + accessibility evidence', pack(['หน้าเหมือนกันจบ','สวยคือพอ','ทีมใช้ component ได้ก็พอ'])]
  ][s]||null; }
  function taskB4(c,s){ return [
    ['บอส B4: Component state ใดขาด', `สถานการณ์: ${c.context} • Issue: ${c.issue}`, c.state || 'loading/disabled/error/success/empty state + microcopy', pack(['มี default state พอ','ให้ผู้ใช้เดาเอง','popup OK อย่างเดียว'])],
    ['Prototype flow ใดต้องคลิกทดสอบได้', `สถานการณ์: ${c.context}`, c.prototype || 'main flow, missing link, modal/overlay และ error path', pack(['ภาพนิ่งแทน prototype','ให้ผู้ทดสอบจินตนาการ','ไม่มี error path'])],
    ['Severity ควรจัดจากอะไร', `สถานการณ์: ${c.context}`, c.evaluation || 'อ่าน evidence, classify finding และ rank severity ตาม task impact', pack(['ความเห็นทีม','ความสวยของหน้าจอ','สิ่งที่แก้ง่ายสุด'])],
    ['Iteration ใด evidence-based', `สถานการณ์: ${c.context}`, c.iteration || 'เลือก fix จาก evidence แล้ว retest task เดิม', pack(['เปลี่ยน theme','เพิ่มคำอธิบายยาว','แก้ตามความชอบส่วนตัว'])],
    ['B4 defense ใดครบที่สุด', `สถานการณ์: ${c.context}`, c.defense || 'state → prototype → evidence → fix → retest', pack(['prototype สวย → ส่ง','ทีมชอบ → จบ','test ครั้งเดียวไม่ต้อง retest'])]
  ][s]||null; }
  const map={B1:taskB1,B2:taskB2,B3:taskB3,B4:taskB4};
  function rewrite(){ const node=nodeId(); if(!map[node]) return; const question=$('.question'); if(!question||$('.verify')||$('.feedback')) return; const c=currentCase(); if(!c) return; const stage=currentStageIndex(); const task=map[node](c,stage); if(!task) return; const mark=`${node}-${currentCaseId()}-${stage}`; if(question.dataset.bossAwareMain===mark) return; setText($('.prompt',question),task[0]); setText($('.instruction',question),task[1]); setOption(option(`c${stage}`),task[2],'คำตอบนี้เชื่อมหลายชั้นของ Boss Gate'); task[3].forEach((w,i)=>setOption(option(`d${stage}-${i}`),w[0],w[1])); question.dataset.bossAwareMain=mark; }
  let timer=0; function schedule(){ clearTimeout(timer); timer=setTimeout(rewrite,20); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',schedule,{once:true}); else schedule();
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
})();
