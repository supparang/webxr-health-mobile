/* AI Quest v4.1.1 — Search HUD cleanup + phase-aware guidance */
(() => {
  'use strict';
  const VERSION = 'v4.1.1-search-hud-cleanup';
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];

  function phaseGuide(phase, prompt){
    const p = String(phase || '').toLowerCase();
    const q = String(prompt || '').toLowerCase();
    if (p.includes('state')) return 'ระบุ state, initial state, actions และ goal test ให้ตรงบทบาทก่อนเลือกคำตอบ';
    if (p.includes('dfs') || p.includes('bfs')) return 'ดู frontier ให้ชัด: BFS ใช้ queue, DFS ใช้ stack/ลึกก่อน; อย่าสลับกับ final path';
    if (p.includes('maze') || p.includes('path')) return 'แยก “ลำดับที่ค้นพบ/visited” ออกจาก “เส้นทางสุดท้ายไปยัง goal”';
    if (p.includes('frontier') || q.includes('frontier')) return 'ตรวจ node ที่ยังรอขยายและเกณฑ์การเลือก node ถัดไปก่อนล็อกคำตอบ';
    if (p.includes('trace') || q.includes('trace')) return 'ไล่ทีละ step แล้วตรวจว่า queue/stack เปลี่ยนอย่างไร ไม่ข้ามลำดับ';
    if (p.includes('cost') || q.includes('cost') || q.includes('ucs')) return 'รวม cumulative cost ทุกเส้นทางก่อนเลือก UCS; จำนวน edge น้อยกว่าไม่ได้แปลว่าค่าใช้จ่ายต่ำกว่า';
    if (p.includes('heuristic') || q.includes('a*') || q.includes('heuristic')) return 'A* ใช้ f(n)=g(n)+h(n): อย่าเลือกจาก h(n) อย่างเดียวเหมือน Greedy';
    if (p.includes('boss') || p.includes('duel')) return 'Boss ชอบหลอกเรื่อง criterion: ระดับชั้น = BFS, ลึกก่อน = DFS, cost = UCS, g+h = A*';
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

  function tune(area){
    cleanHud(area);
    const phase = $('.phasePill.active', area)?.textContent?.trim() || '';
    const prompt = $('.gamePanel h3', area)?.textContent?.trim() || '';
    const instruction = [...$$('.gamePanel p', area)].find(x => /เลือกคำตอบ|ล็อกคำตอบ|ระวัง|คิด/.test(x.textContent));
    if (instruction) {
      instruction.innerHTML = `<b>Mission Intel:</b> ${phaseGuide(phase, prompt)}`;
      instruction.style.color = '#bae6fd';
    }
  }

  function install(){
    const area = document.getElementById('gameArea');
    if (!area || area.dataset.aq411 === '1') return;
    area.dataset.aq411 = '1';
    const observer = new MutationObserver(() => requestAnimationFrame(() => tune(area)));
    observer.observe(area, {childList:true, subtree:true});
    tune(area);
    console.info('[AIQuest] installed', VERSION);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
