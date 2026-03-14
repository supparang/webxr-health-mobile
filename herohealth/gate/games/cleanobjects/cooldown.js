// === /herohealth/gate/games/cleanobjects/cooldown.js ===
// CleanObjects Cooldown — mount() compatible with gate-core v20260314n

let __styleLoaded = false;

function loadStyle(){
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

export async function mount(root, ctx = {}, api = {}){
  loadStyle();

  if(!root) throw new Error('cleanobjects cooldown root not found');

  let relax = 0;
  let miss = 0;
  let done = false;
  let startedAt = Date.now();
  const target = 3;

  root.innerHTML = `
    <div class="co-gate co-cooldown">
      <div class="co-card">
        <div class="co-icon">🌿</div>
        <div class="co-title">คูลดาวน์หลังเล่น</div>
        <div class="co-sub">แตะปุ่มหายใจช้า ๆ ให้ครบ ${target} ครั้ง</div>

        <div class="co-status">
          <div class="co-pill">ผ่อนคลาย: <b id="coRelax">0</b> / ${target}</div>
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

  function updateStats(){
    const playedSec = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
    const accPct = Math.round((relax / target) * 100);
    if(api?.setStats){
      api.setStats({
        time: playedSec,
        score: relax,
        miss,
        acc: `${accPct}%`
      });
    }
  }

  function finish(){
    if(done) return;
    done = true;

    api?.finish?.({
      ok: true,
      title: 'คูลดาวน์เสร็จแล้ว',
      subtitle: 'พร้อมกลับ HUB',
      lines: [
        `ผ่อนคลายครบ ${relax}/${target} ครั้ง`,
        `ทำได้ดีมาก ✅`
      ],
      buffs: {
        cd: 1,
        cPct: 100
      },
      markDailyDone: true
    });
  }

  breathBtn?.addEventListener('click', ()=>{
    if(done) return;

    relax++;
    if(relaxEl) relaxEl.textContent = String(relax);

    breathBtn.classList.add('pulse');
    setTimeout(()=>breathBtn.classList.remove('pulse'), 300);

    updateStats();

    if(relax >= target){
      finish();
    }
  });

  if(api?.setSub) api.setSub('แตะหายใจเข้า-ออกช้า ๆ ให้ครบ');
  updateStats();

  return {
    start(){},
    destroy(){
      done = true;
    }
  };
}

export default { mount };