/* UX Quest • Mission Control Act I v16 • Classroom profile aware
   Reads storage-safe local/session progress created by uxq-progress-v2.js.
*/
(() => {
  'use strict';

  const ROUTES = {
    w1: './w1-ux-crisis-casefile.html?v=act1-storage-safe1',
    w2: './w2-design-thinking-sprint.html?v=act1-storage-safe1',
    w3: './w3-cognitive-load-escape.html?v=act1-storage-safe1',
    b1: './b1-cognitive-storm.html?v=act1-storage-safe1'
  };
  const META = {
    w1: { id:'w1', label:'W1 • FOUNDATION', title:'UX Detective: Casefile Hunt', icon:'⌕', summary:'ปิดคดี UX จาก Evidence → Hypothesis → Fix → User Test และ Final Boss', reward:'★ 2 Readiness เพื่อปลดล็อก W2', locked:'Available', next:'ผ่าน W1 ที่ 2★ Readiness เพื่อปลดล็อก W2' },
    w2: { id:'w2', label:'W2 • PROCESS', title:'Design Thinking Sprint', icon:'↺', summary:'เปลี่ยน pain point เป็น Empathize → Define → Ideate → Prototype → Test', reward:'★ 2 Readiness เพื่อปลดล็อก W3', locked:'Pass W1 2★ Readiness', next:'ผ่าน W2 ที่ 2★ Readiness เพื่อปลดล็อก W3' },
    w3: { id:'w3', label:'W3 • PSYCHOLOGY', title:'Cognitive Load Escape', icon:'◌', summary:'ลดความรก จัดความสนใจ และทำให้ผู้ใช้คิดน้อยลงโดยไม่ทิ้งข้อมูลสำคัญ', reward:'★ 2 Readiness เพื่อปลดล็อก B1', locked:'Pass W2 2★ Readiness', next:'ผ่าน W3 ที่ 2★ Readiness เพื่อเข้าสู่ Boss Gate' },
    b1: { id:'b1', label:'B1 • BOSS GATE', title:'Cognitive Storm', icon:'⚠', summary:'กู้ระบบที่ผู้ใช้หาเมนูไม่เจอ เข้าใจสถานะผิด และเลิกใช้งานกลางทาง', reward:'เคลียร์ Act I • Understand Humans', locked:'Pass W3 2★ Readiness', next:'เคลียร์ B1 เพื่อจบ Act I' }
  };
  const ORDER = ['w1','w2','w3','b1'];
  const $ = (id) => document.getElementById(id);
  const starsText = (value) => '★'.repeat(Math.max(0, value)) + '☆'.repeat(Math.max(0, 3 - value));
  const n = (value) => Number(value || 0);

  function read(){
    try { return window.UXQProgress?.get?.() || {}; }
    catch (error) { return {}; }
  }
  function mission(progress, id){ return progress.missions?.[id] || {}; }
  function passed(progress, id){ return n(mission(progress,id).bestStars) >= 2; }
  function setText(id, text){ const el = $(id); if (el) el.textContent = text; }
  function setClass(el, classes){ if (!el) return; el.classList.remove('path-step--available','path-step--cleared','path-step--complete','path-step--locked','compact-stage--locked','compact-stage--available','compact-stage--complete','boss-preview--available','boss-preview--complete'); classes.filter(Boolean).forEach(c => el.classList.add(c)); }
  function setLaunch(anchor, available, href, text){
    if (!anchor) return;
    anchor.href = available ? href : '#';
    anchor.textContent = text;
    anchor.classList.toggle('is-disabled', !available);
    anchor.setAttribute('aria-disabled', String(!available));
    anchor.onclick = available ? null : (event) => event.preventDefault();
  }
  function setButton(button, available, href, text){
    if (!button) return;
    button.disabled = !available;
    button.textContent = text;
    button.onclick = available ? () => { location.href = href; } : null;
  }
  function completionLabel(progress, id){
    const item = mission(progress, id);
    return passed(progress,id) ? `Cleared • ${starsText(n(item.bestStars))}` : null;
  }

  function render(){
    const progress = read();
    const p = Object.fromEntries(ORDER.map(id => [id, passed(progress,id)]));
    const items = Object.fromEntries(ORDER.map(id => [id, mission(progress,id)]));
    const completed = ORDER.filter(id => p[id]).length;
    const totalStars = ORDER.reduce((sum,id) => sum + n(items[id].bestStars), 0);
    const mastery = Math.max(0, Math.min(3, Math.round((totalStars / 12) * 3)));
    const bestScore = Math.max(0, ...ORDER.map(id => n(items[id].bestScore)));

    setText('menuProgressText', `${completed}/4 nodes • ${starsText(mastery)}`);
    setText('menuScoreText', `Best score ${bestScore}`);
    setText('actProgressText', `${completed}/4`);
    setText('heroStars', starsText(mastery));
    setText('heroScore', String(bestScore));

    // Path rail
    const w1State = completionLabel(progress,'w1') || 'Available';
    const w2State = completionLabel(progress,'w2') || (p.w1 ? 'Available' : META.w2.locked);
    const w3State = completionLabel(progress,'w3') || (p.w2 ? 'Available' : META.w3.locked);
    const b1State = completionLabel(progress,'b1') || (p.w3 ? 'Available' : 'Boss Gate');
    setText('pathW1State', w1State); setText('pathW2State', w2State); setText('pathW3State', w3State);
    const pathBossState = $('pathB1')?.querySelector('small'); if (pathBossState) pathBossState.textContent = b1State;
    setClass($('pathW1'), ['path-step--cleared'].filter(() => p.w1).concat(!p.w1 ? ['path-step--available'] : []));
    setClass($('pathW2'), p.w2 ? ['path-step--cleared'] : (p.w1 ? ['path-step--available'] : ['path-step--locked']));
    setClass($('pathW3'), p.w3 ? ['path-step--cleared'] : (p.w2 ? ['path-step--available'] : ['path-step--locked']));
    setClass($('pathB1'), p.b1 ? ['path-step--cleared'] : (p.w3 ? ['path-step--available'] : ['path-step--locked']));

    // W2 compact card
    setText('w2State', p.w2 ? 'CLEARED' : (p.w1 ? 'READY' : 'LOCKED'));
    setText('w2Note', p.w2 ? `ผ่านแล้ว ${starsText(n(items.w2.bestStars))}` : (p.w1 ? 'W2 พร้อมเริ่มแล้ว' : 'ผ่าน W1 Casefile ที่ 2★ Readiness'));
    setLaunch($('w2Launch'), p.w1, ROUTES.w2, p.w2 ? 'เล่นซ้ำ' : (p.w1 ? 'เริ่มภารกิจ' : 'ล็อกอยู่'));
    setClass($('nodeW2'), p.w2 ? ['compact-stage--complete'] : (p.w1 ? ['compact-stage--available'] : ['compact-stage--locked']));

    // W3 compact card currently uses a button in the supplied hub markup.
    const nodeW3 = $('nodeW3');
    const w3StateEl = nodeW3?.querySelector('.stage-state');
    const w3NoteEl = nodeW3?.querySelector('.compact-stage__footer span');
    const w3Button = nodeW3?.querySelector('.compact-stage__footer button');
    if (w3StateEl) w3StateEl.textContent = p.w3 ? 'CLEARED' : (p.w2 ? 'READY' : 'LOCKED');
    if (w3NoteEl) w3NoteEl.textContent = p.w3 ? `ผ่านแล้ว ${starsText(n(items.w3.bestStars))}` : (p.w2 ? 'W3 พร้อมเริ่มแล้ว' : 'ผ่าน W2 ก่อน');
    setButton(w3Button, p.w2, ROUTES.w3, p.w3 ? 'เล่นซ้ำ' : (p.w2 ? 'เริ่มภารกิจ' : 'ล็อกอยู่'));
    setClass(nodeW3, p.w3 ? ['compact-stage--complete'] : (p.w2 ? ['compact-stage--available'] : ['compact-stage--locked']));

    // B1 boss card currently uses a button in the supplied hub markup.
    const nodeB1 = $('nodeB1');
    const b1StateEl = nodeB1?.querySelector('.stage-state');
    const b1NoteEl = nodeB1?.querySelector('.boss-preview__footer span');
    const b1Button = nodeB1?.querySelector('.boss-preview__footer button');
    if (b1StateEl) b1StateEl.textContent = p.b1 ? 'CLEARED' : (p.w3 ? 'BOSS READY' : 'BOSS GATE');
    if (b1NoteEl) b1NoteEl.textContent = p.b1 ? `Act I cleared • ${starsText(n(items.b1.bestStars))}` : (p.w3 ? 'พร้อมเข้าสู่ Boss Gate' : 'ต้องผ่าน W1–W3 ก่อนเข้าสู่ Boss');
    setButton(b1Button, p.w3, ROUTES.b1, p.b1 ? 'เล่น Boss อีกครั้ง' : (p.w3 ? 'เข้าสู่ Cognitive Storm' : 'Friction Core Locked'));
    setClass(nodeB1, p.b1 ? ['boss-preview--complete'] : (p.w3 ? ['boss-preview--available'] : []));

    // Hero card always points to the next eligible mission.
    let nextId = 'w1';
    if (p.w1 && !p.w2) nextId = 'w2';
    else if (p.w2 && !p.w3) nextId = 'w3';
    else if (p.w3 && !p.b1) nextId = 'b1';
    else if (p.b1) nextId = 'b1';
    const next = META[nextId];
    setText('nowStatus', p.b1 ? 'ACT I SECURED' : (nextId === 'b1' ? 'BOSS READY' : (items[nextId].bestStars ? 'REPLAY OR ADVANCE' : 'MISSION READY')));
    const dot = $('nowStatusDot'); if (dot) dot.classList.toggle('is-complete', p.b1);
    setText('nowWeek', next.label); setText('nowIcon', next.icon); setText('w1Title', next.title); setText('nowSummary', next.summary); setText('nowReward', next.reward);
    const launch = $('nowLaunch'); if (launch) { launch.href = ROUTES[nextId]; launch.setAttribute('aria-label', `เริ่ม ${next.title}`); }
    setText('nowLaunchText', p.b1 ? 'เล่น Boss ทบทวน' : (items[nextId].bestStars ? 'เล่นอีกครั้ง' : 'เริ่มภารกิจ'));
    setText('pathHint', p.b1 ? 'Act I เคลียร์แล้ว — เล่นซ้ำได้ด้วยคดีสุ่มเพื่อพัฒนาความแม่นยำ' : next.next);

    const reset = $('resetProgressBtn');
    if (reset) reset.onclick = () => {
      const ok = window.confirm('รีเซ็ตความคืบหน้า Act I และคดีล่าสุดทั้งหมดใช่หรือไม่? ผลในเบราว์เซอร์นี้จะถูกลบ');
      if (!ok) return;
      if (window.UXQProgress?.resetAct1) window.UXQProgress.resetAct1();
      else render();
    };
  }

  document.addEventListener('DOMContentLoaded', render);
  window.addEventListener('uxq-progress-updated', render);
})();
