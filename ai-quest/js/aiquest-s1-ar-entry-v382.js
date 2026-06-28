/* AI Quest S1 AR camera-ready retry + deliberate control tuning v4.0.3 */
(() => {
  'use strict';
  let wasOpen = false;
  let pending = false;

  function panel(){ return document.getElementById('s1ar368'); }
  function video(){ return document.getElementById('s1video368'); }
  function open(){ return Boolean(panel()?.classList.contains('open')); }
  function ready(){
    const node = video();
    return Boolean(node?.srcObject && node.readyState >= 2 && node.videoWidth > 0);
  }

  function tuneHandControl(){
    const config = window.AIQUEST_S1_HAND_HOTFIX?.config;
    if (!config) return;
    config.dwell = Math.max(Number(config.dwell || 0), 1850);
    config.cooldown = Math.max(Number(config.cooldown || 0), 1400);
    config.pinch = Math.min(Number(config.pinch || .12), .075);
    config.pad = Math.min(Number(config.pad || 0), 34);
    config.magnet = Math.min(Number(config.magnet || 0), 92);

    const titleHint = document.querySelector('#s1ar368 .top div div');
    if (titleHint) titleHint.textContent = 'Deliberate Hand Mode • เล็งในปุ่มจริง 1.8 วินาที • pinch ให้ชิดนิ้ว';
    const instruction = document.querySelector('#s1card368 .how');
    if (instruction) instruction.textContent = 'เลือกคำตอบที่เหมาะที่สุด: เล็งปลายนิ้วให้อยู่ “ในปุ่มคำตอบจริง” แล้วค้าง 1.8 วินาที หรือหนีบนิ้วโป้งกับนิ้วชี้ให้ชิดเพื่อเลือก';
  }

  function tick(){
    tuneHandControl();
    const active = open();
    if (active && !wasOpen) pending = true;
    if (!active && wasOpen) pending = false;
    wasOpen = active;

    if (!active || !pending || !ready()) return;
    const hand = window.AIQUEST_S1_HAND_HOTFIX;
    if (!hand?.start) return;
    pending = false;
    hand.start(true);
  }

  window.addEventListener('aiquest:s1-ar-start', () => { pending = true; });
  window.addEventListener('aiquest:ar-stop', () => { pending = false; wasOpen = false; });
  setInterval(tick, 140);
  console.log('[AIQuest] S1 deliberate hand-control tuning loaded');
})();
