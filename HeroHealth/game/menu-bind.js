// === Hero Health Academy — game/menu-bind.js (start binder: hard-capture + fallbacks)
(function () {
  const $  = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  // --- fallback เดโม (ถ้า main.js ยังไม่พร้อม)
  function startShim() {
    try {
      const menu = $('#menuBar');
      menu && menu.setAttribute('data-hidden', '1');
      document.body.setAttribute('data-playing', '1');

      const host = $('#spawnHost');
      let n = 0;
      const t = setInterval(() => {
        if (n++ > 35) { clearInterval(t); document.body.removeAttribute('data-playing'); menu && menu.removeAttribute('data-hidden'); return; }
        const b = document.createElement('button');
        b.textContent = Math.random() < 0.7 ? '🥦' : '🍔';
        b.style.cssText = 'position:absolute;background:transparent;border:0;font-size:40px;left:'+(40+Math.random()*(innerWidth-80))+'px;top:'+(80+Math.random()*(innerHeight-200))+'px;filter:drop-shadow(0 3px 6px rgba(0,0,0,.45))';
        host.appendChild(b);
        setTimeout(() => b.remove(), 900);
      }, 350);
    } catch (e) {
      alert('Start fallback error: ' + (e.message || e));
    }
  }

  // --- เรียก start ของจริง ถ้า HHA พร้อม (รอสูงสุด ~3 วินาที แล้วค่อย fallback)
  function startSafe() {
    let tries = 0;
    const iv = setInterval(() => {
      tries++;
      if (window.HHA && typeof window.HHA.startGame === 'function') {
        clearInterval(iv);
        window.HHA.startGame();
      } else if (tries > 30) { // ~3s
        clearInterval(iv);
        startShim();
      }
    }, 100);
  }

  // --- sync ค่าที่เลือกจากปุ่ม mode/diff ก่อนกด Start
  function syncSelections() {
    const actM = $('.btn[data-mode].active');
    const actD = $('.btn[data-diff].active');
    const mode = actM ? actM.getAttribute('data-mode') : (document.body.getAttribute('data-mode') || 'goodjunk');
    const diff = actD ? actD.getAttribute('data-diff') : (document.body.getAttribute('data-diff') || 'Normal');
    window.__HHA_MODE = mode; window.__HHA_DIFF = diff;
    document.body.setAttribute('data-mode', mode);
    document.body.setAttribute('data-diff', diff);
  }

  // --- ป้องกันตัวอื่น intercept: จับใน capture phase ระดับ window
  function handleMaybeStart(e) {
    const tgt = e.target && (e.target.closest('#btn_start') || e.target.closest('[data-action="start"]'));
    if (!tgt) return;
    e.preventDefault(); e.stopImmediatePropagation();
    syncSelections();
    startSafe();
  }

  ['click','pointerup','touchend'].forEach(ev => {
    window.addEventListener(ev, handleMaybeStart, true); // capture = true
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { handleMaybeStart(e); }
  }, true);

  // --- ตั้ง active เมื่อเลือก mode/diff
  const mb = $('#menuBar');
  if (mb) {
    mb.addEventListener('click', (ev) => {
      const t = ev.target.closest('.btn');
      if (!t) return;
      if (t.matches('[data-mode]')) {
        $$('.btn[data-mode]').forEach(x => x.classList.remove('active'));
        t.classList.add('active');
      }
      if (t.matches('[data-diff]')) {
        $$('.btn[data-diff]').forEach(x => x.classList.remove('active'));
        t.classList.add('active');
      }
    });
  }

  // --- กัน overlay ใด ๆ มาปิดเมนู
  const menu = $('#menuBar');
  if (menu) {
    menu.style.zIndex = '2147483647';
  }
  const c = document.getElementById('c');
  if (c) {
    c.style.pointerEvents = 'none';
    c.style.zIndex = '1';
    c.style.position = 'fixed';
  }
})();
