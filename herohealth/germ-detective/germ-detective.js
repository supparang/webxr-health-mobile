// === /herohealth/germ-detective/germ-detective.js ===
// Germ Detective minimal working scene
// PATCH v20260310-MIN-WORKING-r1
// ✅ visible targets spawn
// ✅ mobile friendly
// ✅ simple score/timer
// ✅ end summary event for cooldown flow

export function mountGame(root, cfg){
  let score = 0;
  let left = Math.max(20, Number(cfg.time) || 80);
  let timer = null;
  let ended = false;
  let spawnTimer = null;

  root.innerHTML = `
    <div id="gdWrap" style="
      position:relative;
      min-height:calc(100vh - 90px);
      overflow:hidden;
      background:
        radial-gradient(700px 340px at 50% 0%, rgba(34,211,238,.10), transparent 60%),
        linear-gradient(180deg, rgba(2,6,23,.0), rgba(2,6,23,.25));
    ">
      <div style="padding:14px 12px;color:#cbd5e1;font-weight:900;">
        แตะจุดเชื้อโรคที่โผล่ขึ้นมาให้ได้มากที่สุด
      </div>

      <div id="gdHud" style="
        position:absolute;left:10px;right:10px;top:10px;z-index:10;
        display:flex;gap:8px;flex-wrap:wrap;
      ">
        <div style="padding:8px 10px;border-radius:999px;border:1px solid rgba(148,163,184,.18);background:rgba(2,6,23,.5);font-weight:1000;">Score <b id="gdScore">0</b></div>
        <div style="padding:8px 10px;border-radius:999px;border:1px solid rgba(148,163,184,.18);background:rgba(2,6,23,.5);font-weight:1000;">Time <b id="gdTime">${left}</b></div>
        <button id="gdEndBtn" type="button" style="padding:8px 12px;border-radius:999px;border:1px solid rgba(59,130,246,.34);background:rgba(59,130,246,.16);color:#fff;font-weight:1000;">จบเกม</button>
      </div>

      <div id="gdField" style="
        position:absolute;inset:0;
      "></div>
    </div>
  `;

  const field = root.querySelector('#gdField');
  const scoreEl = root.querySelector('#gdScore');
  const timeEl = root.querySelector('#gdTime');
  const endBtn = root.querySelector('#gdEndBtn');

  function emitSummary(){
    const summary = {
      game: 'germdetective',
      scoreFinal: score,
      score,
      accuracyPct: 100,
      foundCount: score,
      missCount: 0,
      dangerCount: 0,
      grade: score >= 15 ? 'A' : score >= 8 ? 'B' : 'C',
      summaryText: `พบจุดเสี่ยง ${score} จุด`
    };

    try{
      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary));
    }catch{}

    window.dispatchEvent(new CustomEvent('hha:event', {
      detail: { type: 'summary', summary }
    }));
  }

  function endGame(){
    if(ended) return;
    ended = true;
    clearInterval(timer);
    clearInterval(spawnTimer);
    emitSummary();

    const overlay = document.createElement('div');
    overlay.style.position = 'absolute';
    overlay.style.inset = '0';
    overlay.style.display = 'grid';
    overlay.style.placeItems = 'center';
    overlay.style.background = 'rgba(2,6,23,.72)';
    overlay.innerHTML = `
      <div style="
        width:min(92vw,420px);
        padding:18px;
        border-radius:18px;
        border:1px solid rgba(148,163,184,.18);
        background:rgba(15,23,42,.88);
        color:#fff;
      ">
        <div style="font-size:22px;font-weight:1000;">สรุปผล Germ Detective</div>
        <div style="margin-top:8px;opacity:.9;">คะแนน: <b>${score}</b></div>
        <div style="margin-top:6px;opacity:.9;">พบจุดเสี่ยง: <b>${score}</b> จุด</div>
        <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap;">
          <button id="gdRetryBtn" type="button" style="padding:10px 14px;border-radius:12px;border:1px solid rgba(59,130,246,.34);background:rgba(59,130,246,.16);color:#fff;font-weight:1000;">เล่นอีกครั้ง</button>
          <button id="gdHubBtn" type="button" style="padding:10px 14px;border-radius:12px;border:1px solid rgba(148,163,184,.22);background:rgba(148,163,184,.08);color:#fff;font-weight:1000;">กลับ HUB</button>
        </div>
      </div>
    `;
    root.appendChild(overlay);

    overlay.querySelector('#gdRetryBtn')?.addEventListener('click', ()=> location.reload());
    overlay.querySelector('#gdHubBtn')?.addEventListener('click', ()=> {
      location.href = cfg.hub || '../hub.html';
    });
  }

  function spawnTarget(){
    if(ended) return;

    const t = document.createElement('button');
    t.type = 'button';
    t.textContent = '🦠';
    t.style.position = 'absolute';
    t.style.left = `${8 + Math.random() * 78}%`;
    t.style.top = `${18 + Math.random() * 68}%`;
    t.style.transform = 'translate(-50%,-50%)';
    t.style.width = '64px';
    t.style.height = '64px';
    t.style.borderRadius = '999px';
    t.style.border = '1px solid rgba(34,211,238,.28)';
    t.style.background = 'rgba(34,211,238,.12)';
    t.style.fontSize = '28px';
    t.style.boxShadow = '0 10px 30px rgba(0,0,0,.25)';
    t.style.zIndex = '2';

    let removed = false;
    function removeMe(){
      if(removed) return;
      removed = true;
      t.remove();
    }

    t.addEventListener('click', ()=>{
      if(ended) return;
      score++;
      scoreEl.textContent = String(score);

      const fx = document.createElement('div');
      fx.textContent = '+1';
      fx.style.position = 'absolute';
      fx.style.left = t.style.left;
      fx.style.top = t.style.top;
      fx.style.transform = 'translate(-50%,-50%)';
      fx.style.color = '#86efac';
      fx.style.fontWeight = '1000';
      fx.style.zIndex = '5';
      field.appendChild(fx);
      setTimeout(()=>fx.remove(), 450);

      removeMe();
    });

    field.appendChild(t);
    setTimeout(removeMe, 1400);
  }

  function start(){
    timer = setInterval(()=>{
      if(ended) return;
      left--;
      timeEl.textContent = String(left);
      if(left <= 0) endGame();
    }, 1000);

    spawnTarget();
    spawnTimer = setInterval(spawnTarget, 700);
  }

  endBtn?.addEventListener('click', endGame);

  return {
    start,
    stop(){
      clearInterval(timer);
      clearInterval(spawnTimer);
    }
  };
}

export default mountGame;