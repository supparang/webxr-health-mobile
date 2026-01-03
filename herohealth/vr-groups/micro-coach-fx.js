/* === /herohealth/vr-groups/micro-coach-fx.js ===
PACK 36: Micro Coach FX near crosshair — PRODUCTION
✅ Shows tiny tooltip near crosshair (best in cVR)
✅ Rate-limited
✅ Triggers on: miss streak, mini urgent, boss spawn, low accuracy
Respects FXPerf (>=2)
*/

(function(root){
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  const NS = root.GroupsVR = root.GroupsVR || {};
  const NOW = ()=> (root.performance && performance.now) ? performance.now() : Date.now();

  function fxLevel(){
    try{
      const L = (NS.FXPerf && NS.FXPerf.getLevel) ? NS.FXPerf.getLevel() : Number(DOC.body.dataset.fxLevel||3);
      return Number(L)||3;
    }catch{ return 3; }
  }
  function allow(min){ return fxLevel() >= (min||1); }

  function isCVR(){ return (DOC.body.className||'').includes('view-cvr'); }

  function ensureTip(){
    let el = DOC.querySelector('.microTip');
    if (el) return el;
    el = DOC.createElement('div');
    el.className = 'microTip';
    el.innerHTML = `<div class="microBubble"><span class="microIcon">🥦</span><span id="microText">—</span></div>`;
    DOC.body.appendChild(el);
    return el;
  }

  function show(text, mood){
    if (!allow(2)) return;
    const el = ensureTip();
    const t = DOC.getElementById('microText');
    if (t) t.textContent = String(text||'');
    DOC.body.dataset.microMood = String(mood||'neutral');
    DOC.body.classList.add('micro-on');
    clearTimeout(show._tmr);
    show._tmr = setTimeout(()=> DOC.body.classList.remove('micro-on'), 860);
  }

  // Rate limit
  let lastAt = 0;
  function can(){
    const t = NOW();
    if (t - lastAt < 1700) return false;
    lastAt = t;
    return true;
  }

  // Track miss streak + accuracy
  let missStreak = 0;
  let lastAcc = 100;

  root.addEventListener('hha:rank', (ev)=>{
    const d = ev.detail||{};
    const acc = Number(d.accuracy||0);
    if (isFinite(acc)) lastAcc = acc;
  }, {passive:true});

  root.addEventListener('hha:judge', (ev)=>{
    const k = String((ev.detail||{}).kind||'').toLowerCase();

    if (k==='miss' || k==='bad'){
      missStreak++;
      if (isCVR() && missStreak>=2 && can()){
        show('เล็งให้หยุดนิ่ง 0.2 วิ แล้วค่อยยิง 🎯', 'neutral');
      } else if (!isCVR() && missStreak>=3 && can()){
        show('ลองกดให้ตรงเป้า แล้วค่อยยิง/แตะ', 'neutral');
      }
      return;
    }

    if (k==='good' || k==='boss' || k==='perfect'){
      missStreak = 0;
      if (k==='perfect' && can()){
        show('PERFECT! จังหวะดีมาก ✨', 'happy');
      }
    }
  }, {passive:true});

  // mini urgent from quest
  root.addEventListener('quest:update', (ev)=>{
    const d = ev.detail||{};
    const left = Number(d.miniTimeLeftSec||0);
    if (left>0 && left<=3 && can()){
      show('MINI ใกล้หมดเวลา! ยิงให้แม่น 🔥', 'fever');
    }
  }, {passive:true});

  // boss spawn
  root.addEventListener('groups:progress', (ev)=>{
    const k = String((ev.detail||{}).kind||'').toLowerCase();
    if (k==='boss_spawn' && can()){
      show('บอสมา! อย่ายิงมั่ว—ยิงเฉพาะหมู่ที่ถูก 👊', 'fever');
    }
  }, {passive:true});

  // low accuracy reminder (soft)
  setInterval(()=>{
    if (!allow(2)) return;
    if (lastAcc <= 55 && can()){
      show('ทริค: มองชื่อหมู่ใน GOAL ก่อนยิง ✅', 'neutral');
    }
  }, 5200);

})(typeof window!=='undefined' ? window : globalThis);