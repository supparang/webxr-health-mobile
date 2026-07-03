/* UX Quest • W2–B2 Result Copy v1
 * Replaces generic readiness language with mission and boss-specific outcomes.
 */
(() => {
  'use strict';
  const path = String(location.pathname || '').toLowerCase();
  const id =
    path.includes('w2-design-thinking-sprint') ? 'w2' :
    path.includes('w3-cognitive-load-escape') ? 'w3' :
    path.includes('b1-cognitive-storm') ? 'b1' :
    path.includes('w4-user-insight-lab') ? 'w4' :
    path.includes('w5-concept-forge') ? 'w5' :
    path.includes('w6-flow-rescue') ? 'w6' :
    path.includes('b2-flow-fortress') ? 'b2' : '';
  if (!id) return;

  const copy = {
    w2:{pass:'ผ่าน Design Thinking Sprint แล้ว!',retry:'คุณเริ่มเห็นกระบวนการแล้ว — ลอง Sprint ใหม่เพื่อเชื่อมผู้ใช้กับการทดสอบให้แน่นขึ้น',badge:'Design Process Navigator',next:'ไปต่อ W3 • Psychology →'},
    w3:{pass:'ปิด Cognitive Load ได้แล้ว!',retry:'คุณเริ่มเห็นภาระความคิดแล้ว — ลองคดีใหม่เพื่อจัด hierarchy ให้ผู้ใช้ไม่ต้องเดา',badge:'Cognitive Load Pathfinder',next:'ท้าทาย B1 →'},
    b1:{pass:'B1 ผ่านแล้ว: พายุความสับสนสงบลง!',retry:'พายุยังมีช่องโหว่ — กลับไปเชื่อม Evidence → Decision → Test ให้แน่นขึ้น',badge:'Cognitive Storm Defender',next:'ปลดล็อก W4 →'},
    w4:{pass:'Insight Map พร้อมแล้ว!',retry:'คุณเริ่มเห็นสัญญาณผู้ใช้แล้ว — ลองคดีใหม่เพื่อแยก Observation กับ Insight ให้คมขึ้น',badge:'Persona Signal Mapper',next:'ไปต่อ W5 • Concept Forge →'},
    w5:{pass:'Concept Forge ผ่านแล้ว!',retry:'แนวคิดเริ่มเป็นรูปแล้ว — ลองคดีใหม่เพื่อเชื่อม Problem → HMW → Storyboard ให้ชัดขึ้น',badge:'Concept Forge Strategist',next:'ไปต่อ W6 • Flow Rescue →'},
    w6:{pass:'Flow Rescue ผ่านแล้ว!',retry:'คุณเริ่มเห็นคอขวดของ flow แล้ว — ลองคดีใหม่เพื่อจัด IA และ next step ให้ผู้ใช้ไปต่อได้จริง',badge:'Flow Rescue Architect',next:'ท้าทาย B2 • Flow Fortress →'},
    b2:{pass:'B2 ผ่านแล้ว: ยึด Flow Fortress คืนสำเร็จ!',retry:'Fortress ยังต้านอยู่ — กลับไปเชื่อม Insight → Concept → IA → Flow → Proof ให้ครบ',badge:'Flow Fortress Commander',next:'กลับ Mission Control →'}
  }[id];

  function addStyle(){
    if (document.getElementById('uxq-w2b2-result-copy-style')) return;
    const style = document.createElement('style');
    style.id = 'uxq-w2b2-result-copy-style';
    style.textContent = '.uxq-results h1{max-width:min(900px,100%);overflow-wrap:anywhere}.uxq-result-mission-note{max-width:760px!important;color:#d9e8ff!important;font-size:1rem!important}.uxq-results .uxq-result-grid span{line-height:1.25}@media(max-width:760px){.uxq-results h1{font-size:clamp(1.55rem,8vw,2.3rem)}.uxq-result-grid div{min-height:76px}}';
    document.head.appendChild(style);
  }
  function replaceLabels(result){
    const labels = {
      score:'คะแนนภารกิจ',
      accuracy:'การตัดสินใจถูก',
      verified:'ตรวจเหตุผล',
      'evidence calls':'การตัดสินใจในคดี',
      'best combo':'Mastery Combo'
    };
    result.querySelectorAll('.uxq-result-grid span').forEach((node) => {
      const key = String(node.textContent || '').trim().toLowerCase();
      if (labels[key]) node.textContent = labels[key];
    });
  }
  function enhance(){
    const result = document.querySelector('.uxq-results');
    if (!result) return;
    addStyle();
    const passed = /MISSION CLEARED/i.test(String(result.querySelector('.uxq-kicker')?.textContent || ''));
    const title = result.querySelector('h1');
    if (title && (/Readiness|คุณเริ่มเห็น pattern/i.test(title.textContent))) title.textContent = passed ? copy.pass : copy.retry;
    const lead = title?.nextElementSibling;
    if (lead?.tagName === 'P') {
      lead.classList.add('uxq-result-mission-note');
      if (passed) lead.textContent = id === 'b1' || id === 'b2'
        ? 'คุณเชื่อมหลักฐาน เหตุผล และการพิสูจน์ผลในด่านบอสได้ครบขึ้นแล้ว'
        : 'นำผลลัพธ์รอบนี้ไปต่อยอดเป็น Studio Artifact เพื่อใช้กับระบบจริงในใบงานประจำสัปดาห์';
    }
    replaceLabels(result);
    const reason = result.querySelector('.uxq-guess-note b');
    if (reason && /Anti-guess/i.test(reason.textContent)) reason.textContent = 'ตรวจเหตุผล:';
    const badge = result.querySelector('.uxq-takeaway b');
    if (badge && (/Evidence Architect|Badge unlocked/i.test(badge.textContent))) badge.textContent = `Badge ที่ได้รับ: ${copy.badge}`;
    const next = [...result.querySelectorAll('a.uxq-btn')].find((item) => /w3-cognitive|b1-cognitive|w4-user|w5-concept|w6-flow|b2-flow|index\.html/i.test(item.getAttribute('href') || ''));
    if (next && !/Mission Control/i.test(next.textContent)) next.textContent = copy.next;
  }
  function boot(){
    enhance();
    new MutationObserver(() => requestAnimationFrame(enhance)).observe(document.documentElement, {childList:true,subtree:true});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();
