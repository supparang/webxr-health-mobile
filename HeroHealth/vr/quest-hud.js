// === /HeroHealth/vr/quest-hud.js (2025-11-12 FOCUS HUD + dual-event) ===
// API:
//   questHUDInit()              → เตรียม DOM + listener
//   questHUDUpdate(deck, hint)  → re-render (ไม่จำเป็นต้องส่ง payload)
//   questHUDDispose()           → ถอด listener/DOM (ตอนจบเกม)

let state = { goal:null, mini:null, hint:'' };
let els = { root:null, goal:null, goalBar:null, goalVal:null, mini:null, miniBar:null, miniVal:null };
let inited = false;

function makePanel(title, id){
  const wrap = document.createElement('div');
  wrap.className = 'quest-panel';
  wrap.id = id;
  wrap.innerHTML = `
    <div class="head"><span class="t">${title}</span><span class="meta" data-meta=""></span></div>
    <div class="label" data-label>—</div>
    <div class="bar"><div class="fill" data-fill style="width:0%"></div></div>
    <div class="val" data-val>0/0</div>`;
  return wrap;
}

function injectCSS(){
  if (document.getElementById('quest-hud-css')) return;
  const css = document.createElement('style'); css.id='quest-hud-css';
  css.textContent = `
  .quest-root{position:fixed; left:16px; top:16px; display:flex; flex-direction:column; gap:12px; z-index:520; pointer-events:none}
  .quest-panel{width:min(520px,46vw); background:#0b1220cc; border:1px solid #334155; border-radius:14px; padding:10px 12px; color:#e2e8f0; backdrop-filter:blur(6px); box-shadow:0 12px 30px rgba(0,0,0,.35)}
  .quest-panel .head{display:flex; justify-content:space-between; font:900 15px system-ui}
  .quest-panel .head .t{color:#cbd5e1}
  .quest-panel .head .meta{font:800 11px system-ui; color:#94a3b8}
  .quest-panel .label{margin:6px 0 8px 0; font:800 14px system-ui; color:#f1f5f9}
  .quest-panel .bar{position:relative; height:8px; background:#1f2937; border-radius:999px; overflow:hidden}
  .quest-panel .bar .fill{position:absolute; inset:0 auto 0 0; width:0%; background:linear-gradient(90deg,#22d3ee,#a78bfa,#fb923c); border-radius:999px}
  .quest-panel .val{margin-top:4px; font:800 12px system-ui; color:#cbd5e1; text-align:right}
  @media (max-width:640px){ .quest-panel{width:88vw} .quest-root{left:8px; top:8px} }
  `;
  document.head.appendChild(css);
}

function ensureDOM(){
  injectCSS();
  if (!els.root){
    els.root = document.createElement('div');
    els.root.className = 'quest-root';
    const g = makePanel('เป้าหมายหลัก','goalPanel');
    const m = makePanel('Mini Quest','miniPanel');
    els.root.appendChild(g); els.root.appendChild(m);
    document.body.appendChild(els.root);

    els.goal    = g.querySelector('[data-label]');
    els.goalBar = g.querySelector('[data-fill]');
    els.goalVal = g.querySelector('[data-val]');
    els.goalMeta= g.querySelector('[data-meta]');

    els.mini    = m.querySelector('[data-label]');
    els.miniBar = m.querySelector('[data-fill]');
    els.miniVal = m.querySelector('[data-val]');
  }
}

function pct(p,t){
  const pp = !t ? 0 : Math.max(0, Math.min(100, (p/t)*100));
  return pp;
}

function render(){
  ensureDOM();

  // Goal
  if (state.goal){
    const { label, prog=0, target=0, meta } = state.goal;
    els.goal.textContent = label || '—';
    els.goalBar.style.width = `${pct(prog, target)}%`;
    els.goalVal.textContent = `${prog|0}/${target|0}`;
    els.goalMeta && (els.goalMeta.textContent = meta && meta.cleared!=null ? `Goal ${meta.cleared}/${meta.total||meta.cleared||0}` : '');
  }else{
    els.goal.textContent = '—';
    els.goalBar.style.width = '0%';
    els.goalVal.textContent = '0/0';
    els.goalMeta && (els.goalMeta.textContent = '');
  }

  // Mini
  if (state.mini){
    const { label, prog=0, target=0 } = state.mini;
    els.mini.textContent = label || '—';
    els.miniBar.style.width = `${pct(prog, target)}%`;
    els.miniVal.textContent = `${prog|0}/${target|0}`;
  }else{
    els.mini.textContent = '—';
    els.miniBar.style.width = '0%';
    els.miniVal.textContent = '0/0';
  }
}

function onQuestEvent(e){
  const d = e?.detail || {};
  // เก็บ “สถานะล่าสุด” ไว้ global เผื่อ init มาทีหลัง
  window.__QUEST_LATEST__ = d;
  state.goal = d.goal || null;
  state.mini = d.mini || null;
  render();
}

export function questHUDInit(){
  if (inited) return;
  inited = true;
  ensureDOM();
  // ดักทั้งสองชื่ออีเวนต์
  window.addEventListener('hha:quest', onQuestEvent);
  window.addEventListener('quest:update', onQuestEvent);
  // ถ้ามีค้างอยู่ ให้เรนเดอร์ทันที
  const last = window.__QUEST_LATEST__;
  if (last) onQuestEvent({ detail: last });
  else render();
}

export function questHUDUpdate(_deck, hint){
  if (hint != null) state.hint = String(hint);
  // ใช้สถานะล่าสุดจาก __QUEST_LATEST__ เสมอ
  const last = window.__QUEST_LATEST__;
  if (last) onQuestEvent({ detail: last });
  else render();
}

export function questHUDDispose(){
  try{
    window.removeEventListener('hha:quest', onQuestEvent);
    window.removeEventListener('quest:update', onQuestEvent);
  }catch{}
  try{
    if (els.root && els.root.parentNode) els.root.parentNode.removeChild(els.root);
  }catch{}
  inited = false; els = { root:null, goal:null, goalBar:null, goalVal:null, mini:null, miniBar:null, miniVal:null };
  state = { goal:null, mini:null, hint:'' };
}

export default { questHUDInit, questHUDUpdate, questHUDDispose };
