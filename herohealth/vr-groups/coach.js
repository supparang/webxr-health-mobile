/* === /herohealth/vr-groups/coach.js ===
Coach bubble UI for GroupsVR
- listens: hha:coach, hha:judge, hha:adaptive
*/

(function(root){
  'use strict';
  const doc = root.document;
  if (!doc) return;

  const IMG_BASE = '../img/'; // from /herohealth/vr-groups/ -> /herohealth/img/
  const MOOD_IMG = {
    happy: IMG_BASE + 'coach-happy.png',
    neutral: IMG_BASE + 'coach-neutral.png',
    sad: IMG_BASE + 'coach-sad.png',
    fever: IMG_BASE + 'coach-fever.png'
  };

  function ensure(){
    let w = doc.querySelector('.fg-coach');
    if (w) return w;

    w = doc.createElement('div');
    w.className = 'fg-coach';
    w.innerHTML = `
      <div class="fg-coach-card">
        <img class="fg-coach-img" id="fgCoachImg" alt="coach" />
        <div class="fg-coach-text">
          <div class="fg-coach-title">Coach</div>
          <div class="fg-coach-msg" id="fgCoachMsg">พร้อมแล้ว! 🎯</div>
        </div>
      </div>
    `;
    doc.body.appendChild(w);

    const img = doc.getElementById('fgCoachImg');
    img.src = MOOD_IMG.neutral;

    return w;
  }

  let hideT = 0;
  function say(text, mood){
    ensure();
    const msg = doc.getElementById('fgCoachMsg');
    const img = doc.getElementById('fgCoachImg');

    msg.textContent = String(text || '');
    const m = String(mood || 'neutral').toLowerCase();
    img.src = MOOD_IMG[m] || MOOD_IMG.neutral;

    const w = doc.querySelector('.fg-coach');
    w.classList.add('show');

    clearTimeout(hideT);
    hideT = setTimeout(()=> w.classList.remove('show'), 2400);
  }

  root.addEventListener('hha:coach', (e)=>{
    const d = e.detail || {};
    if (!d.text) return;
    say(d.text, d.mood || 'neutral');
  });

  root.addEventListener('hha:judge', (e)=>{
    const d = e.detail || {};
    if (d.kind === 'MISS') say('พลาดแล้ว! ตั้งสติ แล้วลุยใหม่ 💪', 'sad');
  });

  // optional debug
  root.addEventListener('hha:adaptive', (e)=>{
    const d = e.detail || {};
    if (!d.spawnEveryMs) return;
    // ไม่รบกวนผู้เล่นมาก: โชว์เบามากๆ แค่บางครั้ง
    if (Math.random() < 0.12) say(`ปรับความยากอัตโนมัติ… (${d.spawnEveryMs}ms)`, 'neutral');
  });

})(typeof window !== 'undefined' ? window : globalThis);