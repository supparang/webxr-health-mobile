// === /herohealth/vr/quest-hud-vr.js ===
// HUD แสดง Mission / Goal ด้านล่างจอ (รองรับ VR/PC/Mobile)

(function(){
  'use strict';

  let wrap, goalEl, miniEl;

  function ensureHud(){
    if (wrap && document.body.contains(wrap)) return wrap;

    wrap = document.createElement('div');
    wrap.id = 'questHudVR';
    wrap.setAttribute('data-hha-ui','');

    Object.assign(wrap.style, {
      position: 'fixed',
      left: '50%',
      bottom: '10px',
      transform: 'translateX(-50%)',
      maxWidth: '640px',
      width: 'calc(100% - 32px)',
      padding: '8px 12px',
      borderRadius: '999px',
      background: 'rgba(15,23,42,0.9)',
      border: '1px solid rgba(148,163,184,0.9)',
      color: '#e5e7eb',
      font: '600 13px/1.4 system-ui,-apple-system,Segoe UI,Roboto,Thonburi,sans-serif',
      boxShadow: '0 12px 32px rgba(15,23,42,0.9)',
      backdropFilter: 'blur(8px)',
      zIndex: '960',
      display: 'flex',
      flexWrap: 'wrap',
      gap: '6px 12px',
      justifyContent: 'center',
      alignItems: 'center'
    });

    goalEl = document.createElement('span');
    goalEl.id = 'questGoalVR';
    miniEl  = document.createElement('span');
    miniEl.id = 'questMiniVR';

    Object.assign(goalEl.style, {
      padding: '2px 8px',
      borderRadius: '999px',
      background: 'rgba(34,197,94,0.2)',
      whiteSpace: 'nowrap',
      maxWidth: '100%',
      textOverflow: 'ellipsis',
      overflow: 'hidden'
    });
    Object.assign(miniEl.style, {
      padding: '2px 8px',
      borderRadius: '999px',
      background: 'rgba(59,130,246,0.2)',
      whiteSpace: 'nowrap',
      maxWidth: '100%',
      textOverflow: 'ellipsis',
      overflow: 'hidden'
    });

    wrap.appendChild(goalEl);
    wrap.appendChild(miniEl);
    document.body.appendChild(wrap);
    return wrap;
  }

  // โค้ดนี้สมมติว่า Engine ยิง event แบบ quest:update
  // detail: { goal: {label, prog?}, mini: {label?}, hint? }
  window.addEventListener('quest:update', (e)=>{
    ensureHud();
    const d = (e && e.detail) || {};
    const goal = d.goal;
    const mini = d.mini;

    if (goal && goal.label){
      goalEl.textContent = '🎯 ' + goal.label;
      goalEl.style.display = '';
    } else {
      goalEl.style.display = 'none';
    }

    if (mini && mini.label){
      miniEl.textContent = '⭐ ' + mini.label;
      miniEl.style.display = '';
    } else {
      miniEl.style.display = 'none';
    }

    // ถ้ามี hint ก็ flash เล็กน้อย
    if (d.hint){
      wrap.style.boxShadow = '0 0 0 2px rgba(251,191,36,0.6), 0 14px 40px rgba(15,23,42,0.95)';
      setTimeout(()=>{
        if (wrap){
          wrap.style.boxShadow = '0 12px 32px rgba(15,23,42,0.9)';
        }
      }, 300);
    }
  });

  // ถ้าเกมจบ → ซ่อน / สรุปสั้น ๆ
  window.addEventListener('hha:end', ()=>{
    if (!wrap) return;
    goalEl.textContent = 'เกมจบแล้ว — ดูผลรวมด้านบนได้เลย 👀';
    miniEl.style.display = 'none';
  });
})();
