// === /herohealth/gate/games/cleanobjects/cooldown.js ===
// CleanObjects Cooldown — robust export for gate-core

let __styleLoaded = false;

export function loadStyle(){
  if(__styleLoaded) return;
  __styleLoaded = true;

  const id = 'gate-style-cleanobjects';
  if(document.getElementById(id)) return;

  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = new URL('./style.css', import.meta.url).toString();
  document.head.appendChild(link);
}

function boot(root, ctx = {}){
  if(!root) return;

  let relax = 0;
  let done = false;

  root.innerHTML = `
    <div class="co-gate co-cooldown">
      <div class="co-card">
        <div class="co-icon">🌿</div>
        <div class="co-title">คูลดาวน์หลังเล่น</div>
        <div class="co-sub">แตะปุ่มหายใจช้า ๆ ให้ครบ 3 ครั้ง</div>

        <div class="co-status">
          <div class="co-pill">ผ่อนคลาย: <b id="coRelax">0</b> / 3</div>
        </div>

        <div class="co-cool-wrap">
          <button class="co-breath" id="coBreath">หายใจเข้า-ออก</button>
        </div>

        <div class="co-help">เยี่ยมมาก พักสั้น ๆ ก่อนกลับ HUB</div>
      </div>
    </div>
  `;

  const relaxEl = root.querySelector('#coRelax');
  const breathBtn = root.querySelector('#coBreath');

  function finish(){
    if(done) return;
    done = true;

    const result = {
      ok: true,
      score: relax,
      miss: 0,
      accPct: 100,
      progressPct: 100,
      summary: 'คูลดาวน์เสร็จแล้ว'
    };

    if(typeof ctx?.onFinish === 'function'){
      ctx.onFinish(result);
      return;
    }
    if(window?.HeroHealthGate?.finish){
      window.HeroHealthGate.finish(result);
    }
  }

  breathBtn?.addEventListener('click', ()=>{
    if(done) return;

    relax++;
    if(relaxEl) relaxEl.textContent = String(relax);

    breathBtn.classList.add('pulse');
    setTimeout(()=>breathBtn.classList.remove('pulse'), 300);

    if(relax >= 3){
      finish();
    }
  });
}

const game = { loadStyle, boot };
export default game;