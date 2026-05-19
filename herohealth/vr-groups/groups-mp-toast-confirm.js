// === /herohealth/vr-groups/groups-mp-toast-confirm.js ===
// HeroHealth • Groups Multiplayer Toast Confirm
// PATCH v20260519-GROUPS-MP-TOAST-CONFIRM-V1
// ใช้แทน window.confirm() สำหรับ Race / Duet / Coop / Battle

(function () {
  'use strict';

  const VERSION = 'v20260519-groups-mp-toast-confirm-v1';

  if (window.HHA_GROUPS_MP_CONFIRM?.version === VERSION) return;

  function injectStyle() {
    if (document.getElementById('hha-groups-mp-confirm-style')) return;

    const style = document.createElement('style');
    style.id = 'hha-groups-mp-confirm-style';
    style.textContent = `
      .hha-mp-confirm-backdrop{
        position:fixed;
        inset:0;
        z-index:99999;
        display:grid;
        place-items:center;
        padding:18px;
        background:rgba(1,8,28,.58);
        backdrop-filter:blur(6px);
        animation:hhaConfirmFade .16s ease both;
      }

      .hha-mp-confirm-card{
        width:min(520px,92vw);
        border-radius:28px;
        padding:22px;
        color:#f8fbff;
        text-align:center;
        background:
          radial-gradient(360px 190px at 50% -10%,rgba(118,199,255,.20),transparent 70%),
          linear-gradient(180deg,rgba(14,32,91,.98),rgba(6,16,52,.98));
        border:1px solid rgba(132,168,255,.24);
        box-shadow:0 26px 90px rgba(0,0,0,.42);
        font-family:ui-rounded,"Nunito","Noto Sans Thai",system-ui,sans-serif;
        transform-origin:center;
        animation:hhaConfirmPop .18s ease both;
      }

      .hha-mp-confirm-icon{
        width:76px;
        height:76px;
        margin:0 auto 12px;
        border-radius:24px;
        display:grid;
        place-items:center;
        font-size:40px;
        background:linear-gradient(180deg,#fff2b9,#f4d36d);
        color:#3f2f00;
        box-shadow:0 16px 44px rgba(240,193,109,.22);
      }

      .hha-mp-confirm-title{
        margin:0;
        font-size:clamp(24px,5vw,36px);
        line-height:1.05;
        font-weight:1000;
        letter-spacing:-.03em;
      }

      .hha-mp-confirm-message{
        margin:12px auto 0;
        max-width:440px;
        color:#c8d7ff;
        font-size:15px;
        line-height:1.55;
        font-weight:850;
        white-space:pre-line;
      }

      .hha-mp-confirm-actions{
        margin-top:18px;
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:10px;
      }

      .hha-mp-confirm-btn{
        min-height:50px;
        border:0;
        border-radius:18px;
        padding:0 14px;
        font:inherit;
        font-size:15px;
        font-weight:1000;
        cursor:pointer;
        color:#fff;
        background:linear-gradient(180deg,rgba(255,255,255,.10),rgba(255,255,255,.05));
        box-shadow:0 12px 30px rgba(0,0,0,.24);
      }

      .hha-mp-confirm-btn.ok{
        color:#251600;
        background:linear-gradient(180deg,#ffe39a,#f0b85f);
      }

      .hha-mp-confirm-btn.cancel{
        color:#c8d7ff;
        background:linear-gradient(180deg,rgba(255,255,255,.10),rgba(255,255,255,.04));
        border:1px solid rgba(255,255,255,.10);
      }

      .hha-mp-confirm-hint{
        margin-top:12px;
        display:inline-flex;
        align-items:center;
        min-height:32px;
        border-radius:999px;
        padding:0 12px;
        color:#bfffd8;
        background:rgba(99,217,155,.13);
        border:1px solid rgba(99,217,155,.20);
        font-size:12px;
        font-weight:950;
      }

      @keyframes hhaConfirmFade{
        from{opacity:0}
        to{opacity:1}
      }

      @keyframes hhaConfirmPop{
        from{opacity:0; transform:translateY(14px) scale(.94)}
        to{opacity:1; transform:translateY(0) scale(1)}
      }

      @media (max-width:520px){
        .hha-mp-confirm-card{
          border-radius:24px;
          padding:18px;
        }

        .hha-mp-confirm-icon{
          width:64px;
          height:64px;
          border-radius:20px;
          font-size:34px;
        }

        .hha-mp-confirm-actions{
          grid-template-columns:1fr;
        }

        .hha-mp-confirm-btn{
          min-height:48px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function vibrate(pattern) {
    try {
      if (navigator.vibrate) navigator.vibrate(pattern);
    } catch (_) {}
  }

  function open(options = {}) {
    injectStyle();

    const title = options.title || 'ต้องการเล่นอีกครั้งไหม?';
    const message = options.message || '';
    const okText = options.okText || 'ตกลง';
    const cancelText = options.cancelText || 'ยกเลิก';
    const icon = options.icon || '🏁';
    const hint = options.hint || '';

    return new Promise((resolve) => {
      const old = document.querySelector('.hha-mp-confirm-backdrop');
      if (old) old.remove();

      const wrap = document.createElement('div');
      wrap.className = 'hha-mp-confirm-backdrop';
      wrap.setAttribute('role', 'dialog');
      wrap.setAttribute('aria-modal', 'true');

      wrap.innerHTML = `
        <div class="hha-mp-confirm-card">
          <div class="hha-mp-confirm-icon">${icon}</div>
          <h2 class="hha-mp-confirm-title">${title}</h2>
          <div class="hha-mp-confirm-message">${message}</div>
          ${hint ? `<div class="hha-mp-confirm-hint">${hint}</div>` : ''}
          <div class="hha-mp-confirm-actions">
            <button class="hha-mp-confirm-btn cancel" type="button" data-confirm="0">${cancelText}</button>
            <button class="hha-mp-confirm-btn ok" type="button" data-confirm="1">${okText}</button>
          </div>
        </div>
      `;

      function close(value) {
        vibrate(value ? [20, 10, 20] : 12);
        wrap.remove();
        resolve(Boolean(value));
      }

      wrap.addEventListener('click', (ev) => {
        const btn = ev.target.closest('[data-confirm]');
        if (!btn) return;
        close(btn.dataset.confirm === '1');
      });

      wrap.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape') close(false);
        if (ev.key === 'Enter') close(true);
      });

      document.body.appendChild(wrap);

      const okBtn = wrap.querySelector('.ok');
      if (okBtn) okBtn.focus();

      vibrate(10);
    });
  }

  window.HHA_GROUPS_MP_CONFIRM = {
    version: VERSION,
    open
  };

  console.info('[Groups MP Toast Confirm] installed', VERSION);
})();
