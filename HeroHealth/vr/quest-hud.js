// === /HeroHealth/vr/quest-hud.js (2025-11-12 STABLE SELF-CONTAINED) ===
/* ใช้ได้กับทุกโหมด: ส่งอีเวนต์
   window.dispatchEvent(new CustomEvent('hha:quest',{detail:{goal, mini, caption}}))
   โดย goal/mini มีโครง {label, prog, target} (เลขจำนวนเต็ม)
*/

let root, goalEls, miniEls;

function h(el, html){ if(el) el.innerHTML = html; }
function t(el, txt){ if(el) el.textContent = (txt==null?'':String(txt)); }
function pct(prog, target){
  const p = !target ? 0 : Math.max(0, Math.min(100, Math.round((prog/target)*100)));
  return p;
}
function fmtProg(prog, target){ return `${prog|0}/${target|0}`; }

function ensureDOM(){
  if (document.getElementById('hha-quest-wrap')) {
    root = document.getElementById('hha-quest-wrap');
  } else {
    const host = document.getElementById('hudRoot') || document.body;
    const wrap = document.createElement('div');
    wrap.id = 'hha-quest-wrap';
    wrap.innerHTML = `
      <style id="hha-quest-style">
        #hha-quest-wrap{position:fixed;left:12px;top:12px;z-index:520;display:flex;flex-direction:column;gap:10px;width:min(420px,46vw)}
        .q-card{background:#0b1220cc;border:1px solid #334155;border-radius:14px;padding:10px 12px;color:#e2e8f0;backdrop-filter:blur(6px);box-shadow:0 12px 30px rgba(0,0,0,.35)}
        .q-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}
        .q-title{font:800 14px/1 system-ui;letter-spacing:.2px}
        .q-sub{opacity:.7;font:600 12px/1 system-ui}
        .q-bar{height:8px;border-radius:999px;background:#1f2937;overflow:hidden}
        .q-bar > i{display:block;height:100%;width:0%;background:linear-gradient(90deg,#22c55e,#a3e635)}
        .q-row{display:flex;align-items:center;justify-content:space-between;margin-top:6px}
        .q-val{font:800 13px/1 system-ui;opacity:.9}
      </style>
      <div class="q-card" id="q-goal">
        <div class="q-head">
          <div class="q-title">เป้าหมายหลัก</div>
          <div class="q-sub" id="qGoalCap">—</div>
        </div>
        <div id="qGoalLabel" class="q-sub" style="margin-bottom:6px">—</div>
        <div class="q-bar"><i id="qGoalBar"></i></div>
        <div class="q-row"><span class="q-sub">progress</span><span id="qGoalVal" class="q-val">0/0</span></div>
      </div>

      <div class="q-card" id="q-mini">
        <div class="q-head">
          <div class="q-title">Mini Quest</div>
          <div class="q-sub" id="qMiniCap">—</div>
        </div>
        <div id="qMiniLabel" class="q-sub" style="margin-bottom:6px">—</div>
        <div class="q-bar"><i id="qMiniBar"></i></div>
        <div class="q-row"><span class="q-sub">progress</span><span id="qMiniVal" class="q-val">0/0</span></div>
      </div>
    `;
    host.appendChild(wrap);
    root = wrap;
  }
  goalEls = {
    cap:   document.getElementById('qGoalCap'),
    label: document.getElementById('qGoalLabel'),
    bar:   document.getElementById('qGoalBar'),
    val:   document.getElementById('qGoalVal'),
  };
  miniEls = {
    cap:   document.getElementById('qMiniCap'),
    label: document.getElementById('qMiniLabel'),
    bar:   document.getElementById('qMiniBar'),
    val:   document.getElementById('qMiniVal'),
  };
}

export function questHUDInit(){
  ensureDOM();
  // ค่าเริ่ม
  t(goalEls.cap,'—');  t(goalEls.label,'—');  goalEls.bar.style.width='0%';  t(goalEls.val,'0/0');
  t(miniEls.cap,'—');  t(miniEls.label,'—');  miniEls.bar.style.width='0%';  t(miniEls.val,'0/0');
}

export function questHUDUpdate(detail={}, caption=''){
  ensureDOM();
  // Goal
  if (detail.goal){
    const g = detail.goal;
    t(goalEls.cap, caption||'');
    t(goalEls.label, g.label ?? '—');
    t(goalEls.val, fmtProg(g.prog|0, g.target|0));
    goalEls.bar.style.width = pct(g.prog|0, g.target|0)+'%';
  }
  // Mini
  if (detail.mini){
    const m = detail.mini;
    t(miniEls.cap, caption||'');
    t(miniEls.label, m.label ?? '—');
    t(miniEls.val, fmtProg(m.prog|0, m.target|0));
    miniEls.bar.style.width = pct(m.prog|0, m.target|0)+'%';
  }
}

export function questHUDDispose(){
  try{
    const el = document.getElementById('hha-quest-wrap');
    if (el) el.remove();
  }catch{}
}

export default { questHUDInit, questHUDUpdate, questHUDDispose };
