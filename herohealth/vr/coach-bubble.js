// === /herohealth/vr/coach-bubble.js ===
// Coach bubble กลางล่างจอ – ฟัง hha:score / hha:quest / hha:end
// รองรับโหมด Hydration (ใช้ hydration-coach-lines.js ถ้ามี)

'use strict';

import * as HydrationLines from '../hydration-vr/hydration-coach-lines.js';

const CoachBubble = (() => {
  let wrap = null;
  let emojiEl = null;
  let textEl = null;

  let t = 0;
  let baseX = 0.5;   // 0..1
  let amp   = 0.18;  // ระยะส่ายซ้ายขวา
  let fade  = 1;

  let lastMode = '';
  let lastQuest = null;
  let lastScore = 0;

  function ensureDom() {
    if (wrap && emojiEl && textEl) return;

    wrap = document.getElementById('hha-coach-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'hha-coach-wrap';
      wrap.style.position = 'fixed';
      wrap.style.bottom = '10px';
      wrap.style.left = '50%';
      wrap.style.transform = 'translateX(-50%)';
      wrap.style.background = 'rgba(15,23,42,0.82)';
      wrap.style.backdropFilter = 'blur(8px)';
      wrap.style.padding = '8px 16px';
      wrap.style.borderRadius = '999px';
      wrap.style.display = 'flex';
      wrap.style.alignItems = 'center';
      wrap.style.gap = '10px';
      wrap.style.color = '#fff';
      wrap.style.fontFamily = 'system-ui,Segoe UI,Inter,Roboto,sans-serif';
      wrap.style.fontSize = '15px';
      wrap.style.zIndex = '60';
      wrap.style.pointerEvents = 'none';
      wrap.style.opacity = '0';
      document.body.appendChild(wrap);
    }

    emojiEl = document.getElementById('hha-coach-emoji');
    if (!emojiEl) {
      emojiEl = document.createElement('div');
      emojiEl.id = 'hha-coach-emoji';
      emojiEl.textContent = '💧';
      emojiEl.style.fontSize = '24px';
      wrap.appendChild(emojiEl);
    }

    textEl = document.getElementById('hha-coach-text');
    if (!textEl) {
      textEl = document.createElement('div');
      textEl.id = 'hha-coach-text';
      textEl.textContent = 'กำลังเริ่มโหมดน้ำสมดุล…';
      wrap.appendChild(textEl);
    }
  }

  // ----- เลือกประโยคจาก hydration-coach-lines (ถ้ามี) -----
  function pickLine(kind, detail) {
    const mode = (detail && (detail.mode || detail.modeLabel)) || lastMode || '';

    // ถ้ามีฟังก์ชันเฉพาะให้ใช้ก่อน
    if (typeof HydrationLines.pickHydrationLine === 'function') {
      return HydrationLines.pickHydrationLine(kind, detail);
    }
    if (HydrationLines.default && typeof HydrationLines.default === 'function') {
      return HydrationLines.default(kind, detail);
    }

    // fallback ง่าย ๆ แนวเด็ก ป.5
    if (kind === 'start') {
      return 'โค้ชหยดน้ำ: พร้อมยัง? เล็งน้ำดีให้แม่น ๆ นะ 👀';
    }
    if (kind === 'quest' && detail && detail.goal) {
      return `ภารกิจใหญ่: ${detail.goal.label || detail.goal.text || 'ทำคะแนนให้ถึงเป้า!'}`;
    }
    if (kind === 'quest-mini' && detail && detail.mini) {
      return `ภารกิจย่อย: ${detail.mini.label || detail.mini.text || 'เก็บเควสต์เพิ่มอีกหน่อย!'}`;
    }
    if (kind === 'good') {
      return 'เยี่ยมเลย! ดื่มน้ำดีเพิ่มอีกนิด 💧';
    }
    if (kind === 'bad') {
      return 'โอ๊ยย น้ำหวานนั่น! เลี่ยงหน่อยนะ 😝';
    }
    if (kind === 'end') {
      const s = detail?.score ?? 0;
      return `จบเกมแล้ว! คะแนน ${s} แต้ม เก่งมากเลย 🎉`;
    }
    return 'โค้ชหยดน้ำอยู่กับเธอนะ สู้ ๆ 💪';
  }

  function setLine(kind, detail, force = false) {
    ensureDom();
    if (!wrap || !textEl) return;

    const txt = pickLine(kind, detail);
    if (!force && textEl.textContent === txt) return;

    textEl.textContent = txt;
    wrap.style.opacity = '1';
    // bounce เล็กน้อย
    wrap.style.transform = 'translateX(-50%) translateY(0) scale(1.05)';
    setTimeout(() => {
      wrap.style.transform = 'translateX(-50%) translateY(0) scale(1)';
    }, 220);
  }

  // ----- animation ขยับซ้าย–ขวา -----
  function animate() {
    if (!wrap) return;
    t += 0.016;
    const w = window.innerWidth || 800;
    const wave = Math.sin(t * 0.6) * amp; // -amp..amp
    const xRatio = baseX + wave;          // ประมาณ 0.32–0.68
    const x = w * xRatio;

    wrap.style.left = `${x}px`;
    wrap.style.opacity = String(fade);

    requestAnimationFrame(animate);
  }

  // ================= Event handlers =================

  function onQuest(ev) {
    const d = ev.detail || {};
    lastMode = d.mode || lastMode || 'Hydration';
    lastQuest = d;

    setLine('quest', d, true);
  }

  function onScore(ev) {
    const d = ev.detail || {};
    lastMode = d.mode || lastMode || 'Hydration';
    const mode = lastMode.toLowerCase();

    if (mode !== 'hydration') return;

    const s = d.score ?? 0;
    const miss = d.miss ?? d.misses ?? 0;

    // เปลี่ยนข้อความเมื่อคะแนนเพิ่มขึ้นเยอะ ๆ หรือ miss เยอะ
    if (s > lastScore + 200) {
      lastScore = s;
      setLine('good', d);
    } else if (miss > 0 && miss % 3 === 0) {
      setLine('bad', d);
    }
  }

  function onEnd(ev) {
    const d = ev.detail || {};
    if ((d.mode || '').toLowerCase() !== 'hydration') return;
    setLine('end', d, true);
    fade = 1;
  }

  function init() {
    ensureDom();
    if (!wrap) return;

    // เริ่ม animation
    requestAnimationFrame(animate);

    // ตั้งค่าเริ่มต้น
    setLine('start', { mode: 'Hydration' }, true);

    window.addEventListener('hha:quest', onQuest);
    window.addEventListener('hha:score', onScore);
    window.addEventListener('hha:end', onEnd);
  }

  return { init };
})();

// เริ่มเมื่อ DOM พร้อม
window.addEventListener('DOMContentLoaded', () => {
  CoachBubble.init();
});

export default CoachBubble;