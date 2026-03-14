// === /herohealth/gate/games/cleanobjects/warmup.js ===
// CleanObjects Warmup — mount() compatible with gate-core v20260314n

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

  if(!root) throw new Error('cleanobjects warmup root not found');

  let score = 0;
  let miss = 0;
  let done = false;
  let startedAt = Date.now();
  let timer = null;
  const targetScore = 3;
  const durationSec = 15;

  root.innerHTML = `
    <div class="co-gate co-warmup">
      <div class="co-card">
        <div class="co-icon">🧽</div>
        <div class="co-title">วอร์มอัปก่อนเล่น</div>
        <div class="co-sub">แตะจุดเสี่ยงให้ครบ ${targetScore} จุด</div>

        <div class="co-status">
          <div class="co-pill">ได้แล้ว: <b id="coHit">0</b> / ${targetScore}</div>
        </div>

        <div class="co-board" id="coBoard">
          <button class="co-dot hot" data-good="1" style="left:18%;top:28%">🚪</button>
          <button class="co-dot hot" data-good="1" style="left:62%;top:22%">💧</button>
          <button class="co-dot hot" data-good="1" style="left:46%;top:60%">🤝</button>

          <button class="co-dot bad" data-bad="1" style="left:25%;top:70%">🧸</button>
          <button class="co-dot bad" data-bad="1" style="left:74%;top:58%">🌼</button>
        </div>

        <div class="co-help">แตะเฉพาะจุดเสี่ยง เช่น ลูกบิด ก๊อกน้ำ ของใช้ร่วม</div>
      </div>
    </div>
  `;

  const hitEl = root.querySelector('#coHit');
  const board = root.querySelector('#coBoard');

  function updateStats(){
    const playedSec = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
    const acc = Math.max(0, Math.round((score / Math.max(1, score + miss)) * 100));
    if(api?.setStats){
      api.setStats({
        time: playedSec,
        score,
        miss,
        acc: `${Math.round((score / targetScore) * 100)}%`
      });
    }
  }

  function finish(ok = true){
    if(done) return;
    done = true;
    clearInterval(timer);

    const progressPct = Math.round((score / targetScore) * 100);
    const accPct = Math.max(0, Math.round((score / Math.max(1, score + miss)) * 100));

    api?.finish?.({
      ok,
      title: ok ? 'พร้อมเข้าเล่นแล้ว!' : 'วอร์มอัปยังไม่ครบ',
      subtitle: ok ? 'ไปเกมหลักต่อได้เลย' : 'ลองใหม่อีกรอบก็ได้',
      lines: [
        `แตะจุดเสี่ยงได้ ${score}/${targetScore}`,
        `ความแม่นยำ ${accPct}%`
      ],
      buffs: {
        wType: 'warmup',
        wPct: progressPct,
        wCrit: score >= targetScore ? 1 : 0
      },
      markDailyDone: ok
    });
  }

  board.addEventListener('click', (e)=>{
    const btn = e.target.closest('.co-dot');
    if(!btn || done) return;

    if(btn.dataset.good === '1'){
      if(btn.disabled) return;
      btn.disabled = true;
      btn.classList.add('done');

      score++;
      if(hitEl) hitEl.textContent = String(score);
      updateStats();

      if(score >= targetScore){
        finish(true);
      }
    }else{
      miss++;
      btn.classList.add('shake');
      setTimeout(()=>btn.classList.remove('shake'), 250);
      updateStats();
    }
  });

  if(api?.setSub) api.setSub('แตะจุดเสี่ยงให้ครบก่อนเข้าเกมหลัก');
  updateStats();

  timer = setInterval(()=>{
    updateStats();
    const playedSec = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
    if(playedSec >= durationSec){
      finish(score >= targetScore);
    }
  }, 250);

  return {
    start(){},
    destroy(){
      done = true;
      clearInterval(timer);
    }
  };
}

export default { mount };