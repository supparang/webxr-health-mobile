// === /herohealth/vr/coach-bubble.js ===
// โค้ชหยดน้ำ / โค้ชอาหาร นั่งมุมขวาล่าง + bubble ข้อความ
// ฟัง event:  window.dispatchEvent(new CustomEvent('hha:coach',{detail:{text:'...'}}))
// ทุกครั้งที่พูด จะขยับซ้าย-ขวา (wiggle) มีอารมณ์ร่วม

'use strict';

(function (global) {
  const doc = global.document;

  let root = null;
  let avatarEl = null;
  let textEl = null;
  let styleInjected = false;
  let wiggleTimer = null;

  function ensureStyle() {
    if (styleInjected) return;
    styleInjected = true;

    const st = doc.createElement('style');
    st.id = 'hha-coach-style';
    st.textContent = `
      .hha-coach-wrap{
        position:fixed;
        right:12px;
        bottom:86px;
        z-index:650;
        font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI","Thonburi",sans-serif;
        pointer-events:none;
      }
      .hha-coach-inner{
        display:flex;
        align-items:flex-end;
        gap:8px;
        transform-origin:50% 100%;
        transition:transform .25s ease-out;
      }
      .hha-coach-avatar{
        width:42px;
        height:42px;
        border-radius:999px;
        background:radial-gradient(circle at 30% 20%,#e0f2fe,#0ea5e9);
        box-shadow:0 10px 24px rgba(15,23,42,0.7);
        display:flex;
        align-items:center;
        justify-content:center;
        font-size:26px;
      }
      .hha-coach-bubble{
        max-width:220px;
        padding:10px 12px;
        border-radius:26px;
        background:rgba(15,23,42,0.95);
        color:#e5e7eb;
        font-size:13px;
        line-height:1.4;
        box-shadow:0 12px 32px rgba(15,23,42,0.85);
      }
      .hha-coach-bubble::before{
        content:'';
        position:absolute;
        right:54px;
        bottom:26px;
        width:14px;
        height:14px;
        background:rgba(15,23,42,0.95);
        transform:rotate(45deg);
        border-radius:3px;
      }
      .hha-coach-text{
        white-space:pre-line;
      }

      /* wiggle เวลาโค้ชพูด */
      @keyframes hhaCoachWiggle {
        0%   { transform:translateX(0)  rotate(0deg); }
        20%  { transform:translateX(-6px) rotate(-3deg); }
        40%  { transform:translateX(5px) rotate(2deg); }
        60%  { transform:translateX(-4px) rotate(-2deg); }
        80%  { transform:translateX(3px) rotate(1deg); }
        100% { transform:translateX(0)  rotate(0deg); }
      }
      .hha-coach-inner.is-wiggle{
        animation:hhaCoachWiggle .8s ease-out;
      }

      @media (max-width:768px){
        .hha-coach-wrap{
          right:10px;
          bottom:90px;
        }
        .hha-coach-bubble{
          max-width:200px;
          font-size:12px;
        }
      }
    `;
    doc.head.appendChild(st);
  }

  function ensureRoot() {
    if (root && root.isConnected) return root;
    ensureStyle();

    root = doc.createElement('div');
    root.className = 'hha-coach-wrap';
    root.setAttribute('data-hha-ui','');

    root.innerHTML = `
      <div class="hha-coach-inner">
        <div class="hha-coach-avatar">💧</div>
        <div class="hha-coach-bubble">
          <div class="hha-coach-text">พร้อมเล่นยัง? เล็งให้แม่น ๆ นะ 👀</div>
        </div>
      </div>
    `;

    doc.body.appendChild(root);

    const inner = root.querySelector('.hha-coach-inner');
    avatarEl = root.querySelector('.hha-coach-avatar');
    textEl   = root.querySelector('.hha-coach-text');

    // เก็บ inner ไว้ที่ root เพื่อใช้ตอน wiggle
    root._inner = inner;

    return root;
  }

  function setText(msg) {
    ensureRoot();
    if (!textEl) return;
    textEl.textContent = msg || '';
  }

  function setEmojiFromMode(modeKey) {
    ensureRoot();
    if (!avatarEl) return;

    // ปรับ emoji เบา ๆ ตามโหมด
    if (!modeKey) {
      avatarEl.textContent = '💧';
      return;
    }
    const k = String(modeKey).toLowerCase();
    if (k.includes('hydration')) avatarEl.textContent = '💧';
    else if (k.includes('goodjunk') || k.includes('nutrition')) avatarEl.textContent = '🍎';
    else if (k.includes('group')) avatarEl.textContent = '🍱';
    else avatarEl.textContent = '🧑‍🏫';
  }

  function wiggle() {
    ensureRoot();
    const inner = root && root._inner;
    if (!inner) return;

    inner.classList.remove('is-wiggle');
    // รีสตาร์ต animation
    void inner.offsetWidth; // force reflow
    inner.classList.add('is-wiggle');

    if (wiggleTimer) clearTimeout(wiggleTimer);
    wiggleTimer = setTimeout(() => {
      inner.classList.remove('is-wiggle');
    }, 850);
  }

  // ฟัง event hha:coach { text, modeKey }
  function onCoach(ev) {
    const detail = ev.detail || {};
    if (detail.modeKey) setEmojiFromMode(detail.modeKey);
    if (detail.text) setText(detail.text);
    wiggle();
  }

  // กันเรียกซ้ำ
  function init() {
    ensureRoot();
    global.addEventListener('hha:coach', onCoach);
  }

  init();

  // เผื่อโหมดอื่นอยากเรียกตรง ๆ
  global.HHCoach = {
    say(text, modeKey) {
      setEmojiFromMode(modeKey || '');
      setText(text || '');
      wiggle();
    }
  };

})(window);
