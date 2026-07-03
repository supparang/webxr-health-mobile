/* AI Quest v5.0.1 — Canonical S1–S6 onboarding and S6/B2 realignment loader */
(() => {
  'use strict';

  const VERSION = 'v5.0.1-s6-minimax-b2-loader';
  const $ = (selector, root=document) => root.querySelector(selector);
  const $$ = (selector, root=document) => [...root.querySelectorAll(selector)];

  const TEXT_REPAIRS = [
    ['B2 Search Arena Score', 'B2 Search & Game AI Gate Score'],
    ['B2 Search Arena', 'B2 Search & Game AI Boss Gate'],
    ['Applied AI Boss Gate', 'Search & Game AI Boss Gate'],
    ['Search Arena reasoning', 'UCS + A* + Minimax reasoning'],
    ['integrated search', 'การบูรณาการ UCS, A* และ Minimax'],
    ['Weighted graph', 'สถานการณ์'],
    ['Knowledge Base Forge', 'Minimax Arena'],
    ['Knowledge Representation / Facts / Rules / Inference', 'Game Tree / MAX–MIN / Utility / Alpha–Beta Pruning'],
    ['Cost Search / A* / Knowledge Representation', 'UCS / A* / Minimax'],
    ['ควรทบทวน S4–S6 ก่อนทำ B2 ใหม่', 'ควรทบทวน UCS, A* และ Minimax ก่อนทำ B2 ใหม่'],
    ['ผ่าน B2 แล้ว สรุปครบ S4–S6: Cost Search, A* และ Knowledge Representation', 'ผ่าน B2 แล้ว สรุปครบ S4–S6: UCS, A* และ Minimax; จากนั้นไป S7 Knowledge Representation'],
    ['เมื่อ S4 ผ่านแล้ว จะใช้เป็นฐานสำหรับ S5 A* Rescue Mission / Heuristic Search', 'เมื่อ S4 ผ่านแล้ว จะใช้เป็นฐานสำหรับ S5 A* Rescue Mission / Heuristic Search']
  ];

  function phaseGuide(phase, prompt){
    const p = String(phase || '').toLowerCase();
    const q = String(prompt || '').toLowerCase();
    if (p.includes('minimax') || p.includes('alpha') || p.includes('strategy') || q.includes('max') || q.includes('min')) {
      return 'ระบุว่าตาใดเป็น MAX/MIN ก่อน แล้ว backup utility กลับสู่ราก; prune ได้เมื่อ alpha ≥ beta';
    }
    if (p.includes('applied') || p.includes('integrated') || p.includes('boss')) {
      return 'เลือกหลักให้ตรงโจทย์: UCS ดู cumulative cost, A* ดู f(n)=g(n)+h(n), Minimax คาดการตอบโต้ของคู่แข่ง';
    }
    if (p.includes('state')) return 'ระบุ state, initial state, actions และ goal test ให้ตรงบทบาทก่อนเลือกคำตอบ';
    if (p.includes('dfs') || p.includes('bfs')) return 'ดู frontier ให้ชัด: BFS ใช้ queue, DFS ใช้ stack/ลึกก่อน; อย่าสลับกับ final path';
    if (p.includes('maze') || p.includes('path')) return 'แยก “ลำดับที่ค้นพบ/visited” ออกจาก “เส้นทางสุดท้ายไปยัง goal”';
    if (p.includes('frontier') || q.includes('frontier')) return 'ตรวจ node ที่ยังรอขยายและเกณฑ์การเลือก node ถัดไปก่อนล็อกคำตอบ';
    if (p.includes('trace') || q.includes('trace')) return 'ไล่ทีละ step แล้วตรวจว่า queue/stack เปลี่ยนอย่างไร ไม่ข้ามลำดับ';
    if (p.includes('cost') || q.includes('cost') || q.includes('ucs')) return 'รวม cumulative cost ทุกเส้นทางก่อนเลือก UCS; จำนวน edge น้อยกว่าไม่ได้แปลว่าค่าใช้จ่ายต่ำกว่า';
    if (p.includes('heuristic') || q.includes('a*') || q.includes('heuristic')) return 'A* ใช้ f(n)=g(n)+h(n): อย่าเลือกจาก h(n) อย่างเดียวเหมือน Greedy';
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
      if(grid && grid.dataset.aq501 !== '1'){
        grid.dataset.aq501 = '1';
        grid.innerHTML = `
          <div class="studentStep"><b>S1</b><br>AI / Automation / Sensor / Prediction</div>
          <div class="studentStep"><b>S2–S3</b><br>Agent / PEAS / Environment / Search Foundations</div>
          <div class="studentStep"><b>B1 → S4–S5</b><br>Foundation Gate → Uniform Cost Search → A*</div>
          <div class="studentStep"><b>S6 → B2</b><br>Minimax / Alpha–Beta → Search & Game AI Gate</div>
        `;
      }
    }

    const statusButton = document.getElementById('studentCheckStatus');
    if(statusButton && !statusButton.__aq501CanonicalStatus){
      statusButton.__aq501CanonicalStatus = true;
      statusButton.onclick = function(){
        if(window.AIQuestRoadmap && typeof window.AIQuestRoadmap.render === 'function'){
          window.AIQuestRoadmap.render();
          if(typeof window.showToast === 'function') window.showToast('อัปเดตสถานะตามเส้นทาง S1 → S2 → S3 → B1 → S4 → S5 → S6 → B2 แล้ว');
        }
      };
    }
  }

  function loadS6B2Realignment(){
    if(window.AIQuestS6B2Realignment || document.getElementById('aiquestS6B2V500Script')) return;
    const script = document.createElement('script');
    script.id = 'aiquestS6B2V500Script';
    script.src = './js/aiquest-s6-minimax-b2-game-v500.js?v=20260704-s6b2v500';
    script.async = false;
    script.onload = () => console.log('[AIQuest] S6 Minimax / B2 Search & Game runtime loaded');
    script.onerror = () => console.warn('[AIQuest] S6/B2 realignment runtime could not load');
    document.head.appendChild(script);
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
    if (!area || area.dataset.aq501 === '1') return;
    area.dataset.aq501 = '1';
    repairStudentOnboarding();
    loadS6B2Realignment();

    let scheduled = false;
    const refresh = () => {
      if(scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        repairStudentOnboarding();
        loadS6B2Realignment();
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
