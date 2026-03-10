// === /herohealth/gate/games/germdetective/warmup.js ===
// Germ Detective Warmup — clickable full patch
// PATCH v20260309b-GD-WARMUP-CLICKABLE-FULL
// ✅ buttons clickable without external CSS dependency
// ✅ countdown timer
// ✅ clear objective + feedback
// ✅ mobile friendly grid
// ✅ auto finish when scoreครบ
// ✅ safe stop()

export async function mount(root, ctx, api){
  let score = 0;
  let miss = 0;
  let done = false;
  let timeLeft = Math.max(10, Number(ctx?.time || 20));
  let timer = null;

  const ICONS = ['🚪','💡','🚰','📱','🪑','🧴','🖐️','🍽️','🦠'];

  root.innerHTML = `
    <div style="padding:16px;display:grid;gap:14px;">
      <div style="
        border:1px solid rgba(148,163,184,.16);
        border-radius:18px;
        background:rgba(15,23,42,.42);
        padding:14px;
      ">
        <div style="font-weight:1000;font-size:20px;line-height:1.2;">🦠 Warmup — Germ Detective</div>
        <div style="opacity:.92;margin-top:8px;line-height:1.6;font-size:14px;">
          แตะจุดเสี่ยงให้ครบ <b>5 จุด</b> ก่อนหมดเวลา เพื่อเตรียมพร้อมก่อนเข้าเกมจริง
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">
          <span style="
            display:inline-flex;align-items:center;gap:6px;
            padding:7px 10px;border-radius:999px;
            border:1px solid rgba(148,163,184,.16);
            background:rgba(2,6,23,.34);font-size:12px;font-weight:900;
          ">เป้าหมาย <b id="gdWarmTarget">5</b></span>

          <span style="
            display:inline-flex;align-items:center;gap:6px;
            padding:7px 10px;border-radius:999px;
            border:1px solid rgba(148,163,184,.16);
            background:rgba(2,6,23,.34);font-size:12px;font-weight:900;
          ">เก็บแล้ว <b id="gdWarmScore">0</b>/5</span>

          <span style="
            display:inline-flex;align-items:center;gap:6px;
            padding:7px 10px;border-radius:999px;
            border:1px solid rgba(148,163,184,.16);
            background:rgba(2,6,23,.34);font-size:12px;font-weight:900;
          ">เวลา <b id="gdWarmTime">${timeLeft}</b>s</span>
        </div>
      </div>

      <div id="gdWarmToast" style="
        min-height:24px;
        color:#cbd5e1;
        font-size:13px;
        font-weight:900;
      ">แตะไอคอนให้ครบ 5 อัน</div>

      <div id="gdWarmGrid" style="
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:10px;
      "></div>

      <div style="
        display:flex;gap:10px;flex-wrap:wrap;align-items:center;
        border:1px solid rgba(148,163,184,.16);
        border-radius:18px;
        background:rgba(15,23,42,.32);
        padding:12px;
      ">
        <button id="gdWarmFinishBtn" type="button" style="
          appearance:none;border:1px solid rgba(59,130,246,.34);
          background:linear-gradient(135deg, rgba(59,130,246,.24), rgba(34,211,238,.16));
          color:#e5e7eb;border-radius:14px;padding:10px 14px;
          font-weight:1000;cursor:pointer;min-height:44px;
        ">✅ พร้อมแล้ว ไปต่อ</button>

        <button id="gdWarmResetBtn" type="button" style="
          appearance:none;border:1px solid rgba(148,163,184,.20);
          background:rgba(148,163,184,.08);color:#e5e7eb;
          border-radius:14px;padding:10px 14px;font-weight:1000;
          cursor:pointer;min-height:44px;
        ">↻ รีเซ็ต</button>

        <div style="font-size:12px;color:#94a3b8;font-weight:800;">
          ครบ 5 จุดแล้วจะไปต่อได้อัตโนมัติ
        </div>
      </div>
    </div>
  `;

  const grid = root.querySelector('#gdWarmGrid');
  const scoreEl = root.querySelector('#gdWarmScore');
  const timeEl = root.querySelector('#gdWarmTime');
  const toastEl = root.querySelector('#gdWarmToast');
  const finishBtn = root.querySelector('#gdWarmFinishBtn');
  const resetBtn = root.querySelector('#gdWarmResetBtn');

  let cells = [];

  function setToast(msg, good=false){
    if(!toastEl) return;
    toastEl.textContent = msg;
    toastEl.style.color = good ? '#86efac' : '#cbd5e1';
  }

  function updateHUD(){
    api.setStats({
      time: timeLeft,
      score,
      miss,
      acc: `${Math.round((score / 5) * 100)}%`
    });
    if(scoreEl) scoreEl.textContent = String(score);
    if(timeEl) timeEl.textContent = String(timeLeft);
  }

  function finishNow(reason='complete'){
    if(done) return;
    done = true;
    clearInterval(timer);

    api.finish({
      ok: score >= 5,
      title: score >= 5 ? 'พร้อมแล้ว!' : 'จบ warmup',
      subtitle: score >= 5 ? 'ไปต่อเข้า Germ Detective ได้เลย' : 'ยังไปต่อได้',
      lines: [
        `แตะจุดเสี่ยงได้ ${score}/5 จุด`,
        `miss ${miss}`,
        `reason: ${reason}`
      ],
      buffs: {
        wPct: Math.round((score / 5) * 100),
        wSteps: score
      }
    });
  }

  function styleCell(btn, active=true){
    btn.style.appearance = 'none';
    btn.style.border = '1px solid rgba(148,163,184,.18)';
    btn.style.background = active ? 'rgba(15,23,42,.56)' : 'rgba(34,197,94,.18)';
    btn.style.color = '#e5e7eb';
    btn.style.borderRadius = '18px';
    btn.style.minHeight = '92px';
    btn.style.width = '100%';
    btn.style.fontWeight = '1000';
    btn.style.fontSize = '28px';
    btn.style.cursor = active ? 'pointer' : 'default';
    btn.style.boxShadow = '0 10px 24px rgba(0,0,0,.22)';
    btn.style.transition = 'transform .12s ease, background .12s ease, border-color .12s ease';
  }

  function onHit(btn, icon){
    if(done || btn.dataset.hit === '1') return;
    btn.dataset.hit = '1';
    btn.disabled = true;
    btn.textContent = '✅';
    styleCell(btn, false);
    btn.style.borderColor = 'rgba(34,197,94,.30)';
    score++;
    setToast(`พบจุดเสี่ยง: ${icon}  •  เก็บแล้ว ${score}/5`, true);
    updateHUD();

    if(score >= 5){
      setTimeout(()=>finishNow('score-complete'), 260);
    }
  }

  function rebuildGrid(){
    if(!grid) return;
    grid.innerHTML = '';
    cells = [];

    for(let i=0;i<9;i++){
      const icon = ICONS[i % ICONS.length];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = icon;
      btn.dataset.hit = '0';
      styleCell(btn, true);

      btn.addEventListener('mouseenter', ()=>{
        if(done || btn.dataset.hit === '1') return;
        btn.style.transform = 'translateY(-1px)';
        btn.style.borderColor = 'rgba(59,130,246,.28)';
      });

      btn.addEventListener('mouseleave', ()=>{
        btn.style.transform = 'translateY(0)';
        if(btn.dataset.hit !== '1'){
          btn.style.borderColor = 'rgba(148,163,184,.18)';
        }
      });

      btn.addEventListener('click', ()=>{
        onHit(btn, icon);
      });

      grid.appendChild(btn);
      cells.push(btn);
    }
  }

  function resetGame(){
    done = false;
    score = 0;
    miss = 0;
    timeLeft = Math.max(10, Number(ctx?.time || 20));
    rebuildGrid();
    setToast('แตะไอคอนให้ครบ 5 อัน');
    updateHUD();
    clearInterval(timer);
    timer = setInterval(()=>{
      if(done) return;
      timeLeft = Math.max(0, timeLeft - 1);
      updateHUD();

      if(timeLeft <= 0){
        finishNow('timeout');
      }
    }, 1000);
  }

  finishBtn?.addEventListener('click', ()=>{
    finishNow('manual-continue');
  });

  resetBtn?.addEventListener('click', ()=>{
    resetGame();
  });

  resetGame();

  return {
    start(){
      updateHUD();
    },
    stop(){
      clearInterval(timer);
    }
  };
}