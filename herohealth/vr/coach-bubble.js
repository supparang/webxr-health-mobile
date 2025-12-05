// === /herohealth/vr/coach-bubble.js ===
// Bubble โค้ชกลางล่างจอ + auto-move + fade + mission bounce
// ฟัง event จากเกม: quest:update, hha:end, hha:score ฯลฯ

(function (global) {
  'use strict';

  const exports = global.GAME_MODULES = global.GAME_MODULES || {};

  let wrap = null;
  let inner = null;
  let emojiEl = null;
  let textEl  = null;

  let hideTimer = null;

  // สำหรับ animation ขยับซ้าย–ขวา
  let targetX  = 0;   // px จากจอกลาง
  let currentX = 0;

  // สำหรับ fade-in/out เวลาเป้าเข้าใกล้
  let fadeTarget  = 1;
  let fadeCurrent = 1;
  let lastNearTs  = 0;

  function el(tag, cls) {
    const x = document.createElement(tag);
    if (cls) x.className = cls;
    return x;
  }

  function ensureUI() {
    if (wrap) return wrap;

    // ใส่ style (mobile-first)
    let css = document.getElementById('coach-style');
    if (!css) {
      css = el('style');
      css.id = 'coach-style';
      css.textContent = `
        #coachWrap{
          position:fixed;
          left:0;right:0;
          bottom:12px;
          display:flex;
          justify-content:center;
          pointer-events:none;
          z-index:90;
        }
        #coachInner{
          display:flex;
          align-items:center;
          gap:8px;
          padding:6px 14px;
          border-radius:999px;
          background:rgba(15,23,42,.9);
          box-shadow:0 10px 25px rgba(0,0,0,.55);
          color:#e5e7eb;
          font:600 14px/1.5 system-ui,Segoe UI,Inter,Roboto,sans-serif;
          max-width:80vw;
          transform:translateX(0) scale(1);
          transition:transform .25s ease, opacity .25s ease;
          opacity:0.98;
          pointer-events:auto;
        }
        #coachEmoji{
          font-size:32px;
          filter:drop-shadow(0 3px 5px rgba(0,0,0,.45));
        }
        #coachText{
          font-size:13px;
          white-space:nowrap;
          overflow:hidden;
          text-overflow:ellipsis;
        }
        @media (min-width:768px){
          #coachInner{font-size:15px;max-width:60vw;}
          #coachEmoji{font-size:40px;}
          #coachText{font-size:14px;}
        }
      `;
      document.head.appendChild(css);
    }

    wrap = el('div');
    wrap.id = 'coachWrap';

    inner = el('div');
    inner.id = 'coachInner';

    emojiEl = el('div');
    emojiEl.id = 'coachEmoji';
    emojiEl.textContent = '💧';

    textEl = el('div');
    textEl.id = 'coachText';
    textEl.textContent = 'โค้ชน้ำน้อย: พร้อมลุยน้ำดีแล้ว!';

    inner.appendChild(emojiEl);
    inner.appendChild(textEl);
    wrap.appendChild(inner);
    document.body.appendChild(wrap);

    currentX = 0;
    targetX  = 0;

    requestAnimationFrame(loop);

    return wrap;
  }

  // ----- animation loop (move + fade) -----
  function loop() {
    if (!inner) return;

    // move ไปหา targetX
    currentX += (targetX - currentX) * 0.08;
    inner.style.transform =
      `translateX(${currentX}px) scale(1)`;

    // fade current → target
    // ถ้าเลย 0.7s จาก near ล่าสุดค่อยดันกลับ 1
    const now = performance.now();
    if (now - lastNearTs > 700 && fadeTarget < 1) {
      fadeTarget = 1;
    }
    fadeCurrent += (fadeTarget - fadeCurrent) * 0.1;
    inner.style.opacity = String(fadeCurrent.toFixed(2));

    requestAnimationFrame(loop);
  }

  // ----- แสดงข้อความ + ตั้งเวลา fade ออกเบา ๆ -----
  function show(msg, timeoutMs) {
    ensureUI();
    textEl.textContent = msg;

    inner.style.transform =
      `translateX(${currentX}px) scale(1.08)`;
    setTimeout(() => {
      if (!inner) return;
      inner.style.transform =
        `translateX(${currentX}px) scale(1)`;
    }, 200);

    if (hideTimer) clearTimeout(hideTimer);
    if (timeoutMs && timeoutMs > 0) {
      hideTimer = setTimeout(() => {
        if (!inner) return;
        inner.style.opacity = '0';
      }, timeoutMs);
    } else {
      // โชว์ต่อเนื่อง
      if (inner) inner.style.opacity = '1';
    }
  }

  // ----- auto-move / fade จากการแตะหน้าจอ (แทนตำแหน่งเป้า) -----
  function handlePointer(ev) {
    ensureUI();
    const w = window.innerWidth;
    const h = window.innerHeight;
    const cx = w / 2;

    const x = ev.clientX || (ev.touches && ev.touches[0]?.clientX) || cx;
    const y = ev.clientY || (ev.touches && ev.touches[0]?.clientY) || h * 0.5;

    // ถ้าแตะฝั่งขวา → โค้ชหนีไปฝั่งซ้าย และกลับกัน
    if (x > cx) {
      targetX = -90; // หนีไปซ้าย
    } else {
      targetX = 90;  // หนีไปขวา
    }

    // ถ้าแตะใกล้ขอบล่าง (บริเวณโค้ช) → ให้โค้ชจางลง (fade)
    const bottomZone = h * 0.68;
    if (y > bottomZone) {
      fadeTarget = 0.30;
      lastNearTs = performance.now();
    }
  }

  // ----- helper: สรุป progress ของ goal/mini สำหรับโค้ช -----
  function progressLabel(item) {
    if (!item) return '';
    if (item.progressText) return item.progressText;
    if (typeof item.progress === 'number' && item.target) {
      return ` (${item.progress}/${item.target})`;
    }
    return '';
  }

  // ====== Event hooks ======

  // 1) เควสต์อัปเดต (มาจาก hydration.safe.js → quest-hud-vr.js)
  window.addEventListener('quest:update', ev => {
    const d = ev.detail || {};
    const goal = d.goal || null;
    const mini = d.mini || null;

    ensureUI();

    // โหมด Hydration → โค้ชเป็นหยดน้ำเด็ก ป.5
    emojiEl.textContent = '💧';

    let msg = '';
    if (goal) {
      msg += `ภารกิจใหญ่: ${goal.label || ''}${progressLabel(goal)}`;
    }
    if (mini) {
      if (msg) msg += ' | ';
      msg += `ภารกิจย่อย: ${mini.label || ''}${progressLabel(mini)}`;
    }
    if (!msg) msg = d.hint || 'โค้ชน้ำน้อย: เล็งน้ำดีให้ทันนะ!';

    show(msg, 0); // ไม่รีบซ่อน

    // bubble เด้งขึ้น (scale) ตอนภารกิจใหม่
    inner.style.transform = `translateX(${currentX}px) scale(1.12)`;
    setTimeout(() => {
      if (!inner) return;
      inner.style.transform =
        `translateX(${currentX}px) scale(1)`;
    }, 260);
  });

  // 2) จบเกม → โค้ชสรุปแบบง่าย ๆ
  window.addEventListener('hha:end', ev => {
    const d = ev.detail || {};
    ensureUI();

    if (d.mode === 'Hydration') {
      const score = d.score | 0;
      const miss  = d.misses | 0;
      const green = d.greenTick | 0;
      const txt =
        `เยี่ยมเลย! คะแนน ${score} | GREEN ${green}s | พลาด ${miss} ครั้ง`;
      show(txt, 5000);
    }
  });

  // 3) คะแนนอัปเดต (จากโหมดอื่น ๆ ก็ใช้ได้)
  window.addEventListener('hha:score', ev => {
    const d = ev.detail || {};
    if (!d || typeof d.score !== 'number') return;
    ensureUI();
    show(`เยี่ยมมาก! คะแนนตอนนี้ ${d.score} เลย ✨`, 1800);
  });

  // 4) pointer สำหรับ auto-move / fade โค้ช
  window.addEventListener('pointerdown', handlePointer, { passive: true });
  window.addEventListener('touchstart', handlePointer, { passive: true });

  // export เผื่อเกมอื่นเรียกใช้ตรง ๆ
  exports.coachBubble = {
    show
  };

})(window);
