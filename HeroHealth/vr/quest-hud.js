// === /HeroHealth/vr/quest-hud.js (focused single-card + time pill) ===
let root, goalBox, miniBox, timePill;

/** สร้าง HUD แสดง "เป้าหมายหลัก" และ "Mini Quest" ทีละ 1 รายการแบบโฟกัส */
export function questHUDInit(){
  if (document.getElementById('questHUD')) return;

  root = document.createElement('div');
  root.id = 'questHUD';
  root.innerHTML = `
  <style>
    #questHUD{position:fixed;left:14px;top:14px;z-index:520;color:#e2e8f0;font:600 14px system-ui,Segoe UI,Inter,Roboto,sans-serif}
    #questHUD .card{width:340px;background:#0b1220cc;border:1px solid #334155;border-radius:14px;padding:10px 12px;margin-bottom:10px;backdrop-filter:blur(6px);box-shadow:0 12px 30px rgba(0,0,0,.35)}
    #questHUD .cap{opacity:.75;margin-bottom:6px}
    #questHUD .row{display:flex;justify-content:space-between;align-items:center}
    #questHUD .bar{height:8px;background:#1f2937;border-radius:999px;overflow:hidden;margin-top:6px}
    #questHUD .fill{height:100%;width:0;transition:width .25s ease;background:linear-gradient(90deg,#22c55e,#06b6d4)}
    #questHUD .pill{position:fixed;right:16px;bottom:16px;background:#0b1220cc;border:1px solid #334155;border-radius:999px;padding:6px 10px;backdrop-filter:blur(6px)}
  </style>
  <div class="card" id="goalCard">
    <div class="cap" id="goalCap">เป้าหมายหลัก</div>
    <div class="row"><div id="goalLbl">—</div><div id="goalRt">0/0</div></div>
    <div class="bar"><div class="fill" id="goalFill"></div></div>
  </div>
  <div class="card" id="miniCard">
    <div class="cap" id="miniCap">Mini Quest</div>
    <div class="row"><div id="miniLbl">—</div><div id="miniRt">0/0</div></div>
    <div class="bar"><div class="fill" id="miniFill"></div></div>
  </div>
  <div class="pill" id="timePill">60s</div>`;
  document.body.appendChild(root);

  goalBox = {
    lbl: document.getElementById('goalLbl'),
    rt : document.getElementById('goalRt'),
    cap: document.getElementById('goalCap'),
    fill:document.getElementById('goalFill')
  };
  miniBox = {
    lbl: document.getElementById('miniLbl'),
    rt : document.getElementById('miniRt'),
    cap: document.getElementById('miniCap'),
    fill:document.getElementById('miniFill')
  };
  timePill = document.getElementById('timePill');

  // sync เวลา
  window.addEventListener('hha:time', e=>{
    const s = e?.detail?.sec|0;
    if (timePill) timePill.textContent = `${s}s`;
  }, { passive:true });
}

/** อัปเดตค่าบน HUD (โชว์ทีละ 1 รายการต่อฝั่ง) */
export function questHUDUpdate(payload, caption){
  if (!goalBox || !miniBox) questHUDInit();

  if (payload?.goal){
    const g = payload.goal;
    goalBox.cap.textContent  = `เป้าหมายหลัก — ${g.caption||''}`;
    goalBox.lbl.textContent  = g.label || '—';
    goalBox.rt.textContent   = `${g.prog|0}/${g.target|0}`;
    goalBox.fill.style.width = `${Math.min(100, (g.target? (g.prog||0)/g.target*100 : 0))}%`;
  }
  if (payload?.mini){
    const m = payload.mini;
    miniBox.cap.textContent  = `Mini Quest — ${m.caption||''}`;
    miniBox.lbl.textContent  = m.label || '—';
    miniBox.rt.textContent   = `${m.prog|0}/${m.target|0}`;
    miniBox.fill.style.width = `${Math.min(100, (m.target? (m.prog||0)/m.target*100 : 0))}%`;
  }
}

/** ถอน HUD */
export function questHUDDispose(){
  try{ document.getElementById('questHUD')?.remove(); }catch{}
  root = goalBox = miniBox = timePill = null;
}
