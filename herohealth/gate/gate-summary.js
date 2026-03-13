// === /herohealth/gate/gate-summary.js ===
// FULL PATCH v20260313c-GATE-SUMMARY-HIDE-BEFORE-CALLBACK

export function mountSummaryLayer(root){
  const overlay = document.createElement('div');
  overlay.className = 'gate-overlay';
  overlay.innerHTML = `
    <div class="gate-summary" role="dialog" aria-modal="true">
      <h2 id="gateSummaryTitle">สรุปผล</h2>
      <p id="gateSummarySub">พร้อมไปต่อ</p>
      <div class="gate-summary-list" id="gateSummaryList"></div>
      <div class="gate-footer" style="padding:16px 0 0;">
        <button class="btn btn-ghost" id="gateSummaryBackBtn">กลับ HUB</button>
        <button class="btn btn-primary" id="gateSummaryContinueBtn">ไปต่อ</button>
      </div>
    </div>
  `;
  root.appendChild(overlay);

  function hide(){
    overlay.classList.remove('show');
  }

  return {
    show({ title='สรุปผล', subtitle='พร้อมไปต่อ', lines=[], onContinue, onBack } = {}){
      overlay.classList.add('show');

      overlay.querySelector('#gateSummaryTitle').textContent = title;
      overlay.querySelector('#gateSummarySub').textContent = subtitle;

      const list = overlay.querySelector('#gateSummaryList');
      list.innerHTML = '';

      (Array.isArray(lines) ? lines : []).forEach(line => {
        const item = document.createElement('div');
        item.className = 'gate-summary-line';
        item.textContent = String(line);
        list.appendChild(item);
      });

      const cont = overlay.querySelector('#gateSummaryContinueBtn');
      const back = overlay.querySelector('#gateSummaryBackBtn');

      cont.onclick = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        hide();
        if (onContinue) onContinue();
      };

      back.onclick = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        hide();
        if (onBack) onBack();
      };
    },

    hide
  };
}

export function mountToast(root=document.body){
  const el = document.createElement('div');
  el.className = 'gate-toast';
  root.appendChild(el);

  let timer = null;

  return {
    show(msg=''){
      el.textContent = String(msg);
      el.classList.add('show');
      clearTimeout(timer);
      timer = setTimeout(() => el.classList.remove('show'), 1400);
    },
    hide(){
      clearTimeout(timer);
      el.classList.remove('show');
    }
  };
}