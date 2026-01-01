/* === /herohealth/vr-groups/practice-ui.js ===
Practice UI (15s) for GroupsVR
✅ overlay + countdown + tips
✅ optional beep via GroupsVR.Audio.tick()
Expose: window.GroupsVR.PracticeUI.{show, hide, setLeft}
*/

(function(root){
  'use strict';
  const NS = (root.GroupsVR = root.GroupsVR || {});
  const DOC = root.document;
  if (!DOC) return;

  const $ = (id)=>DOC.getElementById(id);

  let tmr = 0;
  let left = 0;
  let active = false;

  const TIPS = [
    'มอง “กากบาทกลางจอ” แล้วแตะเพื่อยิง 🎯',
    'พยายามเล็งให้เป้าอยู่กลางจอ แล้วค่อยแตะ ✅',
    'ถ้าภาพเอียง กด RECENTER เพื่อปรับมุม 👌',
    'เริ่มช้า ๆ ก่อน แล้วค่อยเพิ่มความเร็ว 🔥'
  ];

  function setTextSafe(id, text){
    const el = $(id);
    if (el) el.textContent = String(text ?? '');
  }

  function pickTip(){
    const i = Math.floor(Math.random()*TIPS.length);
    return TIPS[i];
  }

  function beepIfUrgent(){
    try{
      const A = NS.Audio;
      if (!A) return;
      if (left <= 3 && left > 0) A.tick();
    }catch(_){}
  }

  function sync(){
    if (!active) return;
    setTextSafe('prLeft', left + 's');
    setTextSafe('prTip', pickTip());
    DOC.body.classList.toggle('mini-urgent', left>0 && left<=3); // reuse pulse style
    beepIfUrgent();
  }

  function loop(){
    clearTimeout(tmr);
    if (!active) return;
    sync();
    tmr = setTimeout(loop, 900);
  }

  function show(sec){
    left = Math.max(1, Number(sec)||15);
    active = true;
    const ov = $('practiceOverlay');
    if (ov) ov.classList.remove('hidden');
    setTextSafe('prTitle', '🧪 PRACTICE');
    setTextSafe('prSub', 'ลองเล็ง + แตะยิงจากกากบาทกลางจอ (ยังไม่เก็บผล)');
    loop();
  }

  function hide(){
    active = false;
    clearTimeout(tmr);
    DOC.body.classList.remove('mini-urgent');
    const ov = $('practiceOverlay');
    if (ov) ov.classList.add('hidden');
  }

  function setLeft(sec){
    left = Math.max(0, Number(sec)||0);
    if (active) setTextSafe('prLeft', left + 's');
  }

  NS.PracticeUI = { show, hide, setLeft };

})(typeof window !== 'undefined' ? window : globalThis);