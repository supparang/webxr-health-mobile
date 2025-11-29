// Bubble โค้ช (ฟัง event hha:score / hha:quest / hha:end)
(function (global) {
  'use strict';
  const exports = global.GAME_MODULES = global.GAME_MODULES || {};

  let bubble = null;
  let hideTimer = null;
  let lastQuestText = '';

  function el(tag, cls) {
    const x = document.createElement(tag);
    if (cls) x.className = cls;
    return x;
  }

  function ensureUI() {
    if (bubble) return bubble;
    let css = document.getElementById('coach-style');
    if (!css) {
      css = el('style');
      css.id = 'coach-style';
      css.textContent =
        '#coachBubble{position:fixed;left:50%;top:80px;transform:translateX(-50%);z-index:950;' +
        'max-width:min(84vw,720px);background:#0b1222cc;border:1px solid #3b4a66;color:#e8eefc;' +
        'padding:10px 14px;border-radius:12px;box-shadow:0 12px 30px #0008;font:700 14px/1.4 system-ui,-apple-system,Segoe UI,Roboto,Thonburi,sans-serif;' +
        'backdrop-filter:blur(6px);opacity:0;pointer-events:none;transition:opacity .18s ease;}';
      document.head.appendChild(css);
    }
    bubble = document.getElementById('coachBubble');
    if (!bubble) {
      bubble = el('div');
      bubble.id = 'coachBubble';
      bubble.setAttribute('data-hha-ui', '');
      document.body.appendChild(bubble);
    }
    return bubble;
  }

  function show(text, ms) {
    const b = ensureUI();
    b.textContent = String(text || '');
    b.style.opacity = '1';
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(() => { if (b) b.style.opacity = '0'; }, Math.max(800, ms || 1500));
  }

  exports.coachSay = function (txt, ms) {
    try { show(txt, ms); } catch (e) { }
  };

  function onScore(e) {
    const d = e && e.detail ? e.detail : {};
    const combo = Number(d.combo || 0);
    if (combo >= 1 && (combo === 5 || combo === 10 || combo === 15)) {
      show('สุดยอด! คอมโบ x' + combo + ' ไปต่อเลย! 🔥', 1600);
    }
    if (combo === 1) show('เปิดคอมโบแล้ว! เก็บต่อเนื่องให้ได้!', 1300);
  }

  function onMiss() {
    show('ไม่เป็นไร! โฟกัสใหม่ อีกครั้ง! 💪', 1200);
  }

  function onFever(e) {
    const st = e && e.detail && e.detail.state ? e.detail.state : 'change';
    if (st === 'start') show('FEVER มาแล้ว! เก็บแต้มคูณให้สุด! ⚡', 1800);
    if (st === 'end') show('เฟสหมดแล้ว — ตั้งคอมโบใหม่ลุยต่อ!', 1400);
  }

  function onQuest(e) {
    const text = e && e.detail && e.detail.text ? e.detail.text : '';
    if (text && text !== lastQuestText) {
      lastQuestText = text;
      show(text, 1800);
    }
  }

  function onEnd(e) {
    const d = e && e.detail ? e.detail : {};
    const score = Number(d.score || 0);
    show('จบเกมแล้ว! คะแนนรวม ' + score, 2000);
    bubble = null;
    lastQuestText = '';
  }

  window.addEventListener('hha:score', onScore);
  window.addEventListener('hha:miss', onMiss);
  window.addEventListener('hha:fever', onFever);
  window.addEventListener('hha:quest', onQuest);
  window.addEventListener('hha:end', onEnd);

  setTimeout(() => {
    show('เตรียมตัว... เล็งเป้าแล้วยิงเลย!', 1800);
  }, 900);

})(window);
