// === /HeroHealth/game/main.js (2025-11-12 hub auto-start + start button) ===
import GameHub from '../vr/hub.js';

window.__HHA_BOOT_OK = true;

(function(){
  let hub = null;

  async function initHub(){
    try {
      hub = new GameHub();
      console.log('[HeroHealth] Hub initialized.');
    } catch (e){
      console.error('Failed to init Hub:', e);
      return;
    }

    // ถ้ามีปุ่มเริ่มเกม → bind startGame()
    const btn = document.getElementById('btnStart');
    if (btn) {
      btn.addEventListener('click', function(){
        try { hub.startGame(); } catch(e){ console.error(e); }
      });
    } else {
      // ถ้าไม่มีปุ่ม ให้เริ่มอัตโนมัติหลังโหลด HUD แล้ว
      window.addEventListener('hha:hud-ready', function once(){
        window.removeEventListener('hha:hud-ready', once);
        setTimeout(()=>{
          try { hub.startGame(); } catch(e){ console.error(e); }
        }, 500);
      });
    }
  }

  // เริ่มทำงานเมื่อ DOM โหลดเสร็จ
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', initHub);
  else
    initHub();

  // เพิ่มการ pause/resume ตอนเปลี่ยนแท็บ
  window.addEventListener('blur', ()=>window.dispatchEvent(new Event('hha:pause')));
  window.addEventListener('focus', ()=>window.dispatchEvent(new Event('hha:resume')));
})();
