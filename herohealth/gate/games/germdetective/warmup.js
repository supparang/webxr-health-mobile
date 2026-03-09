// === /herohealth/gate/games/germdetective/warmup.js ===
// Germ Detective Warmup — minimal working patch
// PATCH v20260309a-MIN-WORKING

export async function mount(root, ctx, api){
  let score = 0;
  let left = 5;
  let done = false;

  root.innerHTML = `
    <div style="padding:16px;display:grid;gap:14px;">
      <div>
        <div style="font-weight:1000;font-size:20px;">🦠 Warmup — Germ Detective</div>
        <div style="opacity:.88;margin-top:6px;line-height:1.5;">
          แตะจุดเสี่ยงให้ครบ <b>5 จุด</b> เพื่อเตรียมพร้อมก่อนเข้าเกมจริง
        </div>
      </div>

      <div id="gdWarmGrid" style="
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:10px;
      "></div>

      <div style="opacity:.9;font-size:14px;">
        เก็บแล้ว: <b id="gdWarmScore">0</b> / 5
      </div>
    </div>
  `;

  const grid = root.querySelector('#gdWarmGrid');
  const scoreEl = root.querySelector('#gdWarmScore');

  function updateHUD(){
    api.setStats({
      score,
      miss: 0,
      acc: `${Math.round((score / 5) * 100)}%`
    });
    if(scoreEl) scoreEl.textContent = String(score);
  }

  function finishNow(){
    if(done) return;
    done = true;
    api.finish({
      ok: true,
      title: 'พร้อมแล้ว!',
      subtitle: 'ไปต่อเข้า Germ Detective ได้เลย',
      lines: [
        `แตะจุดเสี่ยงครบ ${score}/5 จุด`,
        'Warmup สำเร็จ'
      ],
      buffs: {
        wPct: 100,
        wSteps: score
      }
    });
  }

  function makeCell(i){
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn';
    btn.style.minHeight = '84px';
    btn.style.fontWeight = '1000';
    btn.style.fontSize = '18px';
    btn.textContent = ['🚪','💡','🚰','📱','🪑','🧴','🖐️','🍽️','🦠'][i % 9];

    let hit = false;
    btn.addEventListener('click', ()=>{
      if(hit || done) return;
      hit = true;
      btn.disabled = true;
      btn.textContent = '✅';
      score++;
      left = Math.max(0, 5 - score);
      updateHUD();
      if(score >= 5){
        setTimeout(finishNow, 250);
      }
    });

    return btn;
  }

  for(let i=0;i<9;i++){
    grid?.appendChild(makeCell(i));
  }

  updateHUD();

  return {
    start(){
      api.setStats({
        time: ctx.time || 20,
        score: 0,
        miss: 0,
        acc: '0%'
      });
    },
    stop(){}
  };
}