// === /herohealth/gate/games/cleanobjects/warmup.js ===
// CleanObjects Warmup — robust export for gate-core

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

  let score = 0;
  let miss = 0;
  let done = false;
  let timer = null;
  const targetScore = 3;

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

  function finish(ok = true){
    if(done) return;
    done = true;
    clearTimeout(timer);

    const result = {
      ok,
      score,
      miss,
      accPct: Math.max(0, Math.round((score / Math.max(1, score + miss)) * 100)),
      progressPct: Math.round((score / targetScore) * 100),
      summary: ok ? 'พร้อมเข้าเล่น Clean Objects แล้ว' : 'ลองวอร์มอัปอีกครั้ง'
    };

    if(typeof ctx?.onFinish === 'function'){
      ctx.onFinish(result);
      return;
    }
    if(window?.HeroHealthGate?.finish){
      window.HeroHealthGate.finish(result);
    }
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

      if(score >= targetScore){
        finish(true);
      }
    }else{
      miss++;
      btn.classList.add('shake');
      setTimeout(()=>btn.classList.remove('shake'), 250);
    }
  });

  timer = setTimeout(()=>{
    finish(score >= targetScore);
  }, 15000);
}

const game = { loadStyle, boot };
export default game;