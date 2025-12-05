// === /herohealth/vr/coach-bubble.js ===
// Hero Health Coach — โค้ชหยดน้ำแบบ bubble กลางล่างจอ
// - auto-create DOM (#hha-coach-wrap)
// - auto-move ซ้าย/ขวา
// - fade-in/out เวลาเป้าเข้าใกล้ (ผ่าน event)
// - พูดตาม hydration-coach-lines.js จาก event: quest:update, hha:score, hha:end

'use strict';

// ดึงประโยคโค้ช (คุณสร้างไฟล์นี้ไว้แล้ว)
import { pickCoachLine } from '../hydration-vr/hydration-coach-lines.js';

const Coach = (() => {
  let wrap = null;
  let emojiEl = null;
  let textEl = null;

  let targetX = 0;
  let currentX = 0;
  let fade = 1;

  function ensureDOM() {
    wrap = document.querySelector('#hha-coach-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'hha-coach-wrap';
      wrap.innerHTML = `
        <div id="hha-coach-emoji">💧</div>
        <div id="hha-coach-text">พร้อมลุยน้ำนะ!</div>
      `;
      document.body.appendChild(wrap);
    }

    emojiEl = wrap.querySelector('#hha-coach-emoji');
    textEl  = wrap.querySelector('#hha-coach-text');

    if (!emojiEl) {
      emojiEl = document.createElement('div');
      emojiEl.id = 'hha-coach-emoji';
      emojiEl.textContent = '💧';
      wrap.prepend(emojiEl);
    }
    if (!textEl) {
      textEl = document.createElement('div');
      textEl.id = 'hha-coach-text';
      textEl.textContent = 'พร้อมลุยน้ำนะ!';
      wrap.appendChild(textEl);
    }

    const w = window.innerWidth || 1280;
    currentX = targetX = w / 2;
    wrap.style.position = 'fixed';
    wrap.style.bottom = '10px';
    wrap.style.left = `${currentX - wrap.offsetWidth / 2}px`;
    wrap.style.opacity = '1';
    wrap.style.zIndex = '40';
    wrap.style.pointerEvents = 'none'; // กันไม่ให้บังการยิง
  }

  function animate() {
    if (!wrap) return;

    currentX += (targetX - currentX) * 0.08;
    wrap.style.left = `${currentX - wrap.offsetWidth / 2}px`;
    wrap.style.opacity = String(fade);

    requestAnimationFrame(animate);
  }

  // ขยับหลบเป้าตามตำแหน่ง X ของเป้า
  function avoidTarget(x) {
    const w = window.innerWidth || 1280;
    if (x > w * 0.5) {
      targetX = w * 0.30;
    } else {
      targetX = w * 0.70;
    }
  }

  // เป้าเข้าใกล้ → ทำให้จางลง
  function nearTarget(isNear) {
    fade = isNear ? 0.35 : 1;
  }

  // เด้ง bubble + เปลี่ยนข้อความโค้ช
  function say(kind, payload) {
    if (!textEl || !wrap) return;

    let line = '';
    try {
      // ให้ hydration-coach-lines.js เลือกประโยคตาม kind / payload
      line = pickCoachLine(kind, payload) || '';
    } catch (e) {
      console.warn('[Coach] pickCoachLine error', e);
    }
    if (!line) return;

    textEl.textContent = line;

    // bounce เล็ก ๆ
    wrap.style.transform = 'translateY(0) scale(1.12)';
    setTimeout(() => {
      wrap.style.transform = 'translateY(0) scale(1)';
    }, 260);
  }

  function init() {
    ensureDOM();

    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(animate);
    }

    // --------- ฟัง event จาก engine ---------

    // เควสต์เปลี่ยน / progress เปลี่ยน
    window.addEventListener('quest:update', ev => {
      const d = ev.detail || {};
      say('quest', d);
    });

    // คะแนน/คอมโบอัปเดต (ยิงโดนน้ำดี/น้ำหวาน)
    window.addEventListener('hha:score', ev => {
      const d = ev.detail || {};
      say('score', d);
    });

    // จบเกม
    window.addEventListener('hha:end', ev => {
      const d = ev.detail || {};
      say('end', d);
    });

    // ตำแหน่งเป้า (ถ้า engine ยิง event ตำแหน่งมา)
    window.addEventListener('hha:target-pos', ev => {
      const d = ev.detail || {};
      if (typeof d.x === 'number') {
        avoidTarget(d.x);
      }
      if (typeof d.near === 'boolean') {
        nearTarget(d.near);
      }
    });

    // ทักทายตอนเริ่ม
    say('start', {});
  }

  return { init, say, avoidTarget, nearTarget };
})();

// mobile-first: รันทันทีเมื่อ DOM พร้อม
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => Coach.init());
} else {
  Coach.init();
}

export default Coach;