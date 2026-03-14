// === /herohealth/gate/games/cleanobjects/warmup.js ===
// CleanObjects Gate Warmup
// CHILD-FRIENDLY PATCH

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

export default function createWarmup(){
  function boot(root, ctx = {}){
    if(!root) return;

    let score = 0;
    let done = false;
    let timer = null;
    const targetScore = 3;

    root.innerHTML = `
      <div class="co-gate co-warmup">
        <div class="co-card">
          <div class="co-icon">🧽</div>
          <div class="co-title">วอร์มอัปก่อนเล่น</div>
          <div class="co-sub">แตะ “จุดเสี่ยง” ให้ครบ ${targetScore} จุด</div>

          <div class="co-status">
            <div class="co-pill">ได้แล้ว: <b id="coHit">${score}</b> / ${targetScore}</div>
          </div>

          <div class="co-board" id="coBoard">
            <button class="co-dot hot" data-good="1" style="left:18%;top:28%">🚪</button>
            <button class="co-dot hot" data-good="1" style="left:62%;top:22%">💧</button>
            <button class="co-dot hot" data-good="1" style="left:46%;top:60%">🤝</button>

            <button class="co-dot bad" data-bad="1" style="left:25%;top:70%">🧸</button>
            <button class="co-dot bad" data-bad="1" style="left:74%;top:58%">🌼</button>
          </div>

          <div class="co-help">แตะเฉพาะจุดที่เสี่ยง เช่น ลูกบิด ก๊อกน้ำ ของใช้ร่วม</div>
        </div>
      </div>
    `;

    const hitEl = root.querySelector('#coHit');
    const board = root.querySelector('#coBoard');

    function finish(ok=true){
      if(done) return;
      done = true;
      clearTimeout(timer);

      const result = {
        ok,
        score,
        accPct: Math.round((score / targetScore) * 100),
        miss: 0,
        progressPct: Math.round((score / targetScore) * 100),
        summary: ok ? 'พร้อมเข้าเล่น Clean Objects แล้ว' : 'ลองใหม่อีกครั้ง'
      };

      if(ctx?.onFinish) ctx.onFinish(result);
      else if(window?.HeroHealthGate?.finish) window.HeroHealthGate.finish(result);
    }

    board.addEventListener('click', (e)=>{
      const btn = e.target.closest('.co-dot');
      if(!btn || done) return;

      if(btn.dataset.good === '1'){
        btn.disabled = true;
        btn.classList.add('done');
        score++;
        hitEl.textContent = String(score);

        if(score >= targetScore){
          finish(true);
        }
      }else{
        btn.classList.add('shake');
        setTimeout(()=>btn.classList.remove('shake'), 250);
      }
    });

    timer = setTimeout(()=>finish(score >= targetScore), 15000);
  }

  return { boot };
}