// === /herohealth/gate/gate-summary.js ===
// FULL PATCH v20260317-GATE-SUMMARY-TOAST-DEDUPE-HARDENED

export function mountSummaryLayer(root){
  const host = (root && typeof root.appendChild === 'function') ? root : document.body;

  // กันซ้ำ: ถ้ามี overlay เดิมใน host นี้ ให้ลบทิ้งก่อน
  const old = host.querySelector('#gateSummaryOverlay');
  if (old) old.remove();

  const overlay = document.createElement('div');
  overlay.id = 'gateSummaryOverlay';
  overlay.className = 'gate-overlay';
  overlay.innerHTML = `
    <div class="gate-summary" role="dialog" aria-modal="true" aria-labelledby="gateSummaryTitle">
      <h2 id="gateSummaryTitle">สรุปผล</h2>
      <p id="gateSummarySub">พร้อมไปต่อ</p>
      <div class="gate-summary-list" id="gateSummaryList"></div>
      <div class="gate-footer" style="padding:16px 0 0;">
        <button class="btn btn-ghost" id="gateSummaryBackBtn" type="button">กลับ HUB</button>
        <button class="btn btn-primary" id="gateSummaryContinueBtn" type="button">ไปต่อ</button>
      </div>
    </div>
  `;
  host.appendChild(overlay);

  const titleEl = overlay.querySelector('#gateSummaryTitle');
  const subEl   = overlay.querySelector('#gateSummarySub');
  const listEl  = overlay.querySelector('#gateSummaryList');
  const contBtn = overlay.querySelector('#gateSummaryContinueBtn');
  const backBtn = overlay.querySelector('#gateSummaryBackBtn');

  let onContinueRef = null;
  let onBackRef = null;

  function hide(){
    overlay.classList.remove('show');
    onContinueRef = null;
    onBackRef = null;
  }

  // กดพื้นหลังเพื่อปิดได้
  overlay.addEventListener('click', (ev) => {
    if (ev.target === overlay) hide();
  });

  contBtn.onclick = (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    const fn = onContinueRef;
    hide();
    if (typeof fn === 'function') fn();
  };

  backBtn.onclick = (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    const fn = onBackRef;
    hide();
    if (typeof fn === 'function') fn();
  };

  return {
    show({ title='สรุปผล', subtitle='พร้อมไปต่อ', lines=[], onContinue, onBack } = {}){
      overlay.classList.add('show');

      titleEl.textContent = String(title);
      subEl.textContent = String(subtitle);

      listEl.innerHTML = '';

      (Array.isArray(lines) ? lines : []).forEach(line => {
        const item = document.createElement('div');
        item.className = 'gate-summary-line';
        item.textContent = String(line);
        listEl.appendChild(item);
      });

      onContinueRef = onContinue;
      onBackRef = onBack;
    },

    hide,

    destroy(){
      onContinueRef = null;
      onBackRef = null;
      overlay.remove();
    }
  };
}

export function mountToast(root=document.body){
  const host = (root && typeof root.appendChild === 'function') ? root : document.body;

  // กันซ้ำ: ถ้ามี toast เดิมใน host นี้ ให้ลบทิ้งก่อน
  const old = host.querySelector('#gateToast');
  if (old) old.remove();

  const el = document.createElement('div');
  el.id = 'gateToast';
  el.className = 'gate-toast';
  host.appendChild(el);

  let timer = null;

  function hide(){
    clearTimeout(timer);
    el.classList.remove('show');
  }

  return {
    show(msg=''){
      el.textContent = String(msg);
      el.classList.add('show');
      clearTimeout(timer);
      timer = setTimeout(() => {
        el.classList.remove('show');
      }, 1400);
    },

    hide,

    destroy(){
      clearTimeout(timer);
      el.remove();
    }
  };
}