// === /HeroHealth/hub.js (2025-11-12 STABLE) ===
// - ใช้ได้ทั้งบน hub.html และ index.vr.html (มีปุ่ม #btnStart / #vrStartBtn)
// - เลือกโหมดจากปุ่ม [data-mode] ถ้ามี (เช่นใน hub.html หรือ modeMenu ของ VR)
// - อัปเดตฉลาก troika "เริ่ม: MODE" ถ้ามี #startLbl
// - ส่งต่อไป index.vr.html แบบ URL สัมพัทธ์ พร้อม autostart=1

(function(){
  console.log('[Hub] initializing');

  class GameHub {
    constructor(){
      const qs = new URLSearchParams(location.search);
      this.mode = (qs.get('mode') || 'goodjunk').toLowerCase();
      this.diff = (qs.get('diff') || 'normal').toLowerCase();
      this.time = clampInt(qs.get('time'), 60, 20, 180);

      this.bindUI();
      this.syncStartLabel();

      // default select (ถ้ามีการ์ดโหมดในหน้า)
      try {
        const activeCard =
          document.querySelector(`[data-mode="${this.mode}"]`) ||
          document.querySelector('[data-mode="goodjunk"]');
        activeCard && activeCard.classList.add('active');
      } catch(_) {}

      window.dispatchEvent(new CustomEvent('hha:hub-ready'));
      console.log('[Hub] ready', {mode:this.mode, diff:this.diff, time:this.time});
    }

    bindUI(){
      const modeMenu = $('#modeMenu');             // VR menu (ถ้ามี)
      const vrBtn    = $('#vrStartBtn');           // ปุ่ม plane ใน VR
      const domBtn   = $('#btnStart');             // ปุ่ม DOM (desktop)
      const selDiff  = $('#selDiff');              // ใน hub.html
      const inpTime  = $('#inpTime');              // ใน hub.html

      // --- เลือกโหมดจากการ์ดหรือปุ่มในเมนู ---
      const modeButtons = $all('[data-mode]');
      modeButtons.forEach(el=>{
        el.addEventListener('click', ()=>{
          this.mode = String(el.dataset.mode || 'goodjunk').toLowerCase();
          modeButtons.forEach(x=>x.classList && x.classList.remove('active'));
          el.classList && el.classList.add('active');
          this.syncStartLabel();
          console.log('[Hub] select mode:', this.mode);
        });
      });

      // --- ระดับ/เวลา (ถ้ามีคอนโทรล) ---
      if (selDiff) {
        selDiff.value = this.diff;
        selDiff.addEventListener('change', ()=>{
          this.diff = String(selDiff.value || 'normal').toLowerCase();
          this.syncStartLabel();
        });
      }
      if (inpTime) {
        inpTime.value = String(this.time);
        inpTime.addEventListener('change', ()=>{
          this.time = clampInt(inpTime.value, 60, 20, 180);
        });
      }

      // --- ปุ่มเริ่มเกม (VR + DOM) ---
      const go = (ev)=>{
        try{ ev && ev.preventDefault(); }catch(_){}
        this.startGame();
      };
      vrBtn && vrBtn.addEventListener('click', go, {passive:false});
      domBtn && domBtn.addEventListener('click', go, {passive:false});

      // เผื่อมีปุ่ม toggle เมนูโหมดใน VR
      const openMenu = $('#btnOpenModeMenu');
      if (openMenu && modeMenu) {
        openMenu.addEventListener('click', ()=>{
          const v = modeMenu.getAttribute('visible');
          modeMenu.setAttribute('visible', String(!(v==='true')));
        });
      }
    }

    syncStartLabel(){
      const startLbl = $('#startLbl');
      if (!startLbl) return;
      // troika-text ต้อง set เป็น string attribute
      const txt = `value: เริ่ม: ${this.mode.toUpperCase()}; color:#93C5FD; fontSize:0.18; maxWidth:1.4; anchor:center; baseline:top;`;
      try { startLbl.setAttribute('troika-text', txt); } catch(_) {}
    }

    startGame(){
      // เวลา/ระดับอาจไม่มีคอนโทรล ให้ใช้ค่าปัจจุบัน
      const diff = this.diff || 'normal';
      const time = clampInt(this.time, 60, 20, 180);

      // ใช้ URL สัมพัทธ์เสมอ กัน // และ 404
      const url = new URL('./index.vr.html', location.href);
      url.searchParams.set('mode', this.mode || 'goodjunk');
      url.searchParams.set('diff', diff);
      url.searchParams.set('time', String(time));
      url.searchParams.set('autostart', '1');

      console.log('[Hub] start ->', url.href);
      location.href = url.href;
    }
  }

  // -------- helpers --------
  function $(s){ return document.querySelector(s); }
  function $all(s){ return Array.prototype.slice.call(document.querySelectorAll(s)||[]); }
  function clampInt(val, def, min, max){
    const n = parseInt(val, 10);
    if (Number.isFinite(n)) return Math.max(min, Math.min(max, n));
    return def;
    }

  // export / auto boot
  window.GameHub = GameHub;
  document.readyState !== 'loading'
    ? (window.__hub = new GameHub())
    : document.addEventListener('DOMContentLoaded', ()=> window.__hub = new GameHub());
})();
