// === game/menu-bind.js (ultra-robust menu bindings) ===
(function(){
  const $  = (s)=>document.querySelector(s);
  const $$ = (s)=>document.querySelectorAll(s);

  // เผื่อ main.js ยังโหลดไม่ทัน ให้เก็บ mode/diff ไว้ชั่วคราว
  window.__HHA_MODE = window.__HHA_MODE || 'goodjunk';
  window.__HHA_DIFF = window.__HHA_DIFF || 'Normal';

  function setActive(listSel, el){
    $$(listSel).forEach(b=>b.classList.remove('active'));
    if (el) el.classList.add('active');
  }

  function bind(){
    const mb = $('#menuBar');
    if (!mb) return;

    function handle(el){
      if (!el) return;
      if (el.hasAttribute('data-mode')) {
        window.__HHA_MODE = el.getAttribute('data-mode') || window.__HHA_MODE;
        setActive('[data-mode]', el);
        const mB = $('#modeBadge'); if (mB) mB.textContent = window.__HHA_MODE;
      } else if (el.hasAttribute('data-diff')) {
        window.__HHA_DIFF = el.getAttribute('data-diff') || window.__HHA_DIFF;
        setActive('[data-diff]', el);
        const dB = $('#diffBadge'); if (dB) dB.textContent = window.__HHA_DIFF;
      } else if (el.dataset.action === 'howto') {
        alert('แตะอาหารดี หลีกเลี่ยงของไม่ดี ภายในเวลาที่กำหนด • เปลี่ยนโหมด/ความยากก่อนเริ่ม');
      } else if (el.dataset.action === 'sound') {
        // toggle เสียงแบบง่าย ถ้า SFX ยังไม่มา
        const nowMuted = !(localStorage.getItem('hha_tmp_sound')!=='0');
        document.querySelectorAll('audio').forEach(a=>{ try{ a.muted = !nowMuted; }catch{} });
        localStorage.setItem('hha_tmp_sound', (!nowMuted)?'0':'1');
        el.textContent = (!nowMuted)?'🔊 Sound':'🔇 Sound';
      } else if (el.dataset.action === 'start') {
        // เรียก main ถ้ามีแล้ว, ถ้ายัง → fallback เรียกภายหลังทันทีที่มี
        if (window.HHA && typeof window.HHA.startGame === 'function') {
          document.body.setAttribute('data-mode', window.__HHA_MODE);
          document.body.setAttribute('data-diff', window.__HHA_DIFF);
          window.HHA.startGame();
        } else {
          // รอ main.js โหลดยืนยัน แล้วกดให้เอง
          let tries = 0;
          const t = setInterval(()=>{
            tries++;
            if (window.HHA && typeof window.HHA.startGame === 'function') {
              clearInterval(t);
              document.body.setAttribute('data-mode', window.__HHA_MODE);
              document.body.setAttribute('data-diff', window.__HHA_DIFF);
              window.HHA.startGame();
            } else if (tries > 60) { // ~6s
              clearInterval(t);
              alert('โหลดสคริปต์หลักช้า ลองรีเฟรชหน้า (Ctrl/Cmd+Shift+R)');
            }
          }, 100);
        }
      }
    }

    // เดลิเกตให้รองรับทุกปุ่ม + มือถือ
    ['click','pointerup','touchend'].forEach(ev=>{
      mb.addEventListener(ev,(e)=>{
        const t = e.target.closest('.btn'); if(!t) return;
        e.preventDefault(); e.stopPropagation();
        handle(t);
      }, {passive:false});
    });

    // ปุ่ม Start สำรอง (กัน theme/script อื่นเขียนทับ)
    const startBtn = $('#btn_start');
    if (startBtn) {
      const clone = startBtn.cloneNode(true);
      startBtn.parentNode.replaceChild(clone, startBtn);
      ['click','pointerup','touchend'].forEach(ev=>{
        clone.addEventListener(ev,(e)=>{
          e.preventDefault(); e.stopPropagation();
          handle(clone);
        }, {passive:false});
      });
    }
  }

  // bind ทันที และซ้ำหลัง DOM พร้อม
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind, {once:true});
  } else {
    bind();
  }
})();
