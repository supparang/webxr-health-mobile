/* AI Quest v4.1.4 — Canonical S1–S6 onboarding, HUD, feedback, and B2 hints */
(() => {
  'use strict';

  const VERSION = 'v4.1.4-canonical-onboarding-hints-wording';
  const $ = (selector, root=document) => root.querySelector(selector);
  const $$ = (selector, root=document) => [...root.querySelectorAll(selector)];

  const TEXT_REPAIRS = [
    ['B2 Search Arena', 'B2 Applied AI Gate (S4–S6)'],
    ['B2 Search Arena Score', 'B2 Applied AI Gate Score'],
    ['Search Arena reasoning', 'Applied AI reasoning'],
    ['integrated search', 'การประยุกต์ Search และ Knowledge'],
    ['Weighted graph', 'สถานการณ์'],
    ['ควรทบทวน S3–S5 ก่อนขึ้น S6', 'ควรทบทวน S4–S6 ก่อนทำ B2 ใหม่'],
    ['ผ่าน B2 แล้วจะใช้เป็นฐานสำหรับ S6 Knowledge Base Forge / Logic', 'ผ่าน B2 แล้ว สรุปครบ S4–S6: Cost Search, A* และ Knowledge Representation'],
    ['สรุปผล S3', 'สรุปผล S4'],
    ['S3 รอบนี้ไม่มีข้อผิดพลาดหลัก', 'S4 รอบนี้ไม่มีข้อผิดพลาดหลัก'],
    ['ควร remedial ก่อนขึ้น S4', 'ควรทบทวนก่อนขึ้น S5'],
    ['ถ้า S3 ผ่านแล้ว จะใช้เป็นฐานสำหรับ S5 A* Rescue Mission / Heuristic Search', 'เมื่อ S4 ผ่านแล้ว จะใช้เป็นฐานสำหรับ S5 A* Rescue Mission / Heuristic Search']
  ];

  function phaseGuide(phase, prompt){
    const p = String(phase || '').toLowerCase();
    const q = String(prompt || '').toLowerCase();
    if (p.includes('knowledge') || p.includes('representation') || p.includes('inference') || q.includes('fact') || q.includes('rule')) {
      return 'แยก fact, rule และผล inference ให้ชัด แล้วตรวจว่าฐานความรู้มีความขัดแย้งหรือไม่ก่อนสรุป';
    }
    if (p.includes('applied') || p.includes('final applied')) {
      return 'เชื่อม cumulative cost, f(n)=g(n)+h(n) และกฎ/ข้อจำกัดจากฐานความรู้ให้สอดคล้องก่อนเลือกคำตอบ';
    }
    if (p.includes('state')) return 'ระบุ state, initial state, actions และ goal test ให้ตรงบทบาทก่อนเลือกคำตอบ';
    if (p.includes('dfs') || p.includes('bfs')) return 'ดู frontier ให้ชัด: BFS ใช้ queue, DFS ใช้ stack/ลึกก่อน; อย่าสลับกับ final path';
    if (p.includes('maze') || p.includes('path')) return 'แยก “ลำดับที่ค้นพบ/visited” ออกจาก “เส้นทางสุดท้ายไปยัง goal”';
    if (p.includes('frontier') || q.includes('frontier')) return 'ตรวจ node ที่ยังรอขยายและเกณฑ์การเลือก node ถัดไปก่อนล็อกคำตอบ';
    if (p.includes('trace') || q.includes('trace')) return 'ไล่ทีละ step แล้วตรวจว่า queue/stack เปลี่ยนอย่างไร ไม่ข้ามลำดับ';
    if (p.includes('cost') || q.includes('cost') || q.includes('ucs')) return 'รวม cumulative cost ทุกเส้นทางก่อนเลือก UCS; จำนวน edge น้อยกว่าไม่ได้แปลว่าค่าใช้จ่ายต่ำกว่า';
    if (p.includes('heuristic') || q.includes('a*') || q.includes('heuristic')) return 'A* ใช้ f(n)=g(n)+h(n): อย่าเลือกจาก h(n) อย่างเดียวเหมือน Greedy';
    if (p.includes('boss') || p.includes('duel')) return 'ดู criterion ของโจทย์ให้ครบก่อนสรุป: cost, heuristic และข้อจำกัดจาก knowledge base อาจต้องใช้ร่วมกัน';
    return 'อ่าน criterion ของโจทย์ก่อน แล้วจึงล็อกคำตอบ';
  }

  function cleanHud(area){
    const hud = $('.hud', area);
    if (!hud) return;
    const seen = new Set();
    $$('.hudChip', hud).forEach(chip => {
      const key = chip.textContent.replace(/\s+/g, ' ').trim()
        .replace(/^Combo x\d+$/i, 'combo')
        .replace(/^AI Help \d+\/\d+$/i, 'help');
      if (seen.has(key)) chip.remove();
      else seen.add(key);
    });
  }

  function repairB2Hints(){
    const original = window.buildBoss2Round;
    if(typeof original !== 'function' || original.__aq414HintFix) return;
    const patched = function(difficulty){
      const round = original(difficulty);
      ['state','graph','maze','boss'].forEach(key => {
        (round && Array.isArray(round[key]) ? round[key] : []).forEach(item => {
          const hint = String(item && item.hint || '').trim();
          if(item && /^[a-z][a-z0-9_]{2,}$/i.test(hint) && item.why){
            item.hint = item.why;
          }
        });
      });
      return round;
    };
    patched.__aq414HintFix = true;
    patched.__aq414HintFixOriginal = original;
    window.buildBoss2Round = patched;
  }

  function replaceVisibleText(root){
    if(!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let node;
    while((node = walker.nextNode())) nodes.push(node);
    nodes.forEach(textNode => {
      let value = textNode.nodeValue;
      TEXT_REPAIRS.forEach(([before, after]) => {
        if(value.includes(before)) value = value.split(before).join(after);
      });
      if(value !== textNode.nodeValue) textNode.nodeValue = value;
    });
  }

  function repairStudentOnboarding(){
    const start = document.getElementById('studentStartPanel');
    if(start){
      const lead = start.querySelector('p');
      if(lead) lead.innerHTML = '<b>Session 1–6 + Boss B1/B2</b> เปิดตามลำดับ: S1 → S2 → S3 → B1 → S4 → S5 → S6 → B2';
      const grid = start.querySelector('.studentStepGrid');
      if(grid && grid.dataset.aq414 !== '1'){
        grid.dataset.aq414 = '1';
        grid.innerHTML = `
          <div class="studentStep"><b>S1</b><br>AI / Automation / Sensor / Prediction</div>
          <div class="studentStep"><b>S2–S3</b><br>Agent / PEAS / Environment / Search Foundations</div>
          <div class="studentStep"><b>B1 → S4–S5</b><br>Foundation Gate → Cost Search → A*</div>
          <div class="studentStep"><b>S6 → B2</b><br>Knowledge Representation → Applied AI Gate</div>
        `;
      }
    }

    const statusButton = document.getElementById('studentCheckStatus');
    if(statusButton && !statusButton.__aq414CanonicalStatus){
      statusButton.__aq414CanonicalStatus = true;
      statusButton.onclick = function(){
        if(window.AIQuestRoadmap && typeof window.AIQuestRoadmap.render === 'function'){
          window.AIQuestRoadmap.render();
          if(typeof window.showToast === 'function') window.showToast('อัปเดตสถานะตามเส้นทาง S1 → S2 → S3 → B1 → S4 → S5 → S6 → B2 แล้ว');
        }
      };
    }
  }

  function tune(area){
    cleanHud(area);
    replaceVisibleText(area);
    const phase = $('.phasePill.active', area)?.textContent?.trim() || '';
    const prompt = $('.gamePanel h3', area)?.textContent?.trim() || '';
    const instruction = [...$$('.gamePanel p', area)].find(element => /เลือกคำตอบ|ล็อกคำตอบ|ระวัง|คิด/.test(element.textContent));
    if (instruction) {
      instruction.innerHTML = `<b>Mission Intel:</b> ${phaseGuide(phase, prompt)}`;
      instruction.style.color = '#bae6fd';
    }
  }

  function install(){
    const area = document.getElementById('gameArea');
    if (!area || area.dataset.aq414 === '1') return;
    area.dataset.aq414 = '1';
    repairB2Hints();
    repairStudentOnboarding();

    let scheduled = false;
    const refresh = () => {
      if(scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        repairB2Hints();
        repairStudentOnboarding();
        tune(area);
        replaceVisibleText(document.getElementById('resultScreen'));
      });
    };

    new MutationObserver(refresh).observe(area, {childList:true, subtree:true});
    const result = document.getElementById('resultScreen');
    if(result) new MutationObserver(refresh).observe(result, {childList:true, subtree:true});
    refresh();
    console.info('[AIQuest] installed', VERSION);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
