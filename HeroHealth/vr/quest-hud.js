// === /HeroHealth/vr/quest-hud.js (2025-11-12 LATEST) ===
// - DOM overlay panel for Goal (5 from 10) + Mini Quest (3 per wave)
// - Renders checklist + progress bars; sits near the score HUD
// - APIs: questHUDInit(), questHUDUpdate(deck, hint), questHUDDispose()

let __hudRoot = null;
let __panel = null;
let __goalList = null;
let __miniWrap = null;
let __hintEl = null;

function injectStyleOnce() {
  if (document.getElementById('hha-quest-style')) return;
  const st = document.createElement('style');
  st.id = 'hha-quest-style';
  st.textContent = `
  .hha-quest-panel{
    position: absolute; left: 16px; top: 14px; z-index: 510; pointer-events: none;
    display: flex; flex-direction: column; gap: 10px;
  }
  .hha-card{
    background:#0b1220cc; color:#e2e8f0; border:1px solid #334155; border-radius:14px;
    box-shadow:0 12px 30px rgba(0,0,0,.35); padding:10px 12px; min-width:240px; pointer-events:auto;
  }
  .hha-head{ font-weight:900; letter-spacing:.2px; margin-bottom:6px; color:#cbd5e1; }
  .hha-hint{ font-size:12px; color:#94a3b8; margin:-2px 0 6px 0; }

  .hha-goal-list{ display:flex; flex-direction:column; gap:6px; }
  .hha-goal-item{ display:grid; grid-template-columns:auto 1fr auto; gap:8px; align-items:center; }
  .hha-goal-flag{ width:18px; text-align:center; font-size:14px; }
  .hha-goal-label{ font-size:13px; color:#e5e7eb; line-height:1.15; }
  .hha-goal-prog{ font-size:12px; color:#93c5fd; }

  .hha-bar{ height:6px; width:100%; border-radius:999px; background:#1f2937; overflow:hidden; }
  .hha-bar>i{ display:block; height:100%; width:0%; background:linear-gradient(90deg,#22c55e,#16a34a); }

  .hha-mini{ display:flex; flex-direction:column; gap:6px; }
  .hha-mini-item{ display:flex; flex-direction:column; gap:4px; padding:6px 0; border-top:1px dashed #243244; }
  .hha-mini-item:first-child{ border-top:0; }
  .hha-mini-title{ font-size:13px; color:#fde68a; font-weight:700; }
  .hha-mini-prog{ display:flex; justify-content:space-between; font-size:12px; color:#94a3b8; }
  `;
  document.head.appendChild(st);
}

export function questHUDInit(){
  injectStyleOnce();

  __hudRoot = document.getElementById('hudRoot') || document.body;
  // ถ้ามีอยู่แล้วให้รีไซเคิล
  __panel = document.getElementById('hhaQuestPanel');
  if (!__panel){
    __panel = document.createElement('div');
    __panel.id = 'hhaQuestPanel';
    __panel.className = 'hha-quest-panel';

    // Card: Goals
    const cardGoals = document.createElement('div');
    cardGoals.className = 'hha-card';
    const h1 = document.createElement('div'); h1.className = 'hha-head'; h1.textContent = 'เป้าหมายหลัก';
    __hintEl = document.createElement('div'); __hintEl.className = 'hha-hint'; __hintEl.textContent = 'Wave 1';
    __goalList = document.createElement('div'); __goalList.className = 'hha-goal-list';

    cardGoals.appendChild(h1);
    cardGoals.appendChild(__hintEl);
    cardGoals.appendChild(__goalList);

    // Card: Mini Quests
    const cardMini = document.createElement('div');
    cardMini.className = 'hha-card';
    const h2 = document.createElement('div'); h2.className = 'hha-head'; h2.textContent = 'Mini Quests';
    __miniWrap = document.createElement('div'); __miniWrap.className = 'hha-mini';

    cardMini.appendChild(h2);
    cardMini.appendChild(__miniWrap);

    __panel.appendChild(cardGoals);
    __panel.appendChild(cardMini);

    __hudRoot.appendChild(__panel);
  }
}

function renderGoalList(goal){
  if (!__goalList) return;
  __goalList.innerHTML = '';
  if (!goal){
    const empty = document.createElement('div');
    empty.className = 'hha-goal-item';
    empty.innerHTML = `<div class="hha-goal-flag">⬜</div><div class="hha-goal-label">ยังไม่เริ่ม</div><div class="hha-goal-prog">0/0</div>`;
    __goalList.appendChild(empty);
    return;
  }

  // หัวข้อรวม (X/Y)
  const head = document.createElement('div');
  head.className = 'hha-goal-item';
  const flag = document.createElement('div'); flag.className = 'hha-goal-flag';
  const cleared = goal.prog|0, total = goal.target|0;
  flag.textContent = (cleared>=total && total>0) ? '✅' : '⬜';
  const lab = document.createElement('div'); lab.className = 'hha-goal-label';
  lab.textContent = `${goal.label || 'Goals'}`;
  const prg = document.createElement('div'); prg.className = 'hha-goal-prog';
  prg.textContent = `${cleared}/${total}`;
  head.appendChild(flag); head.appendChild(lab); head.appendChild(prg);
  __goalList.appendChild(head);

  // รายการย่อย (list)
  const list = Array.isArray(goal.list) ? goal.list.slice(0,5) : [];
  list.forEach(g => {
    const row = document.createElement('div'); row.className = 'hha-goal-item';
    const f = document.createElement('div'); f.className = 'hha-goal-flag'; f.textContent = g.done ? '✅' : '⬜';
    const lbl = document.createElement('div'); lbl.className = 'hha-goal-label'; lbl.textContent = g.label || '';
    const val = document.createElement('div'); val.className = 'hha-goal-prog';
    const p = +g.prog||0, t = +g.target||0;
    val.textContent = t>0 ? `${p}/${t}` : (g.done? '✓' : '0');
    __goalList.appendChild(row);
    row.appendChild(f); row.appendChild(lbl); row.appendChild(val);

    // progress bar
    const bar = document.createElement('div'); bar.className = 'hha-bar';
    const fill = document.createElement('i');
    const ratio = t>0 ? Math.max(0, Math.min(100, Math.round((p/t)*100))) : (g.done?100:0);
    fill.style.width = ratio + '%';
    bar.appendChild(fill);
    const wrap = document.createElement('div'); wrap.style.gridColumn = '1 / span 3';
    wrap.appendChild(bar);
    __goalList.appendChild(wrap);
  });
}

function renderMini(deck){
  if (!__miniWrap) return;
  __miniWrap.innerHTML = '';

  // อ่านความคืบหน้าปัจจุบันจาก deck.getProgress()
  let items = [];
  try{
    const prog = deck && deck.getProgress ? deck.getProgress() : [];
    items = prog.filter(Boolean).slice(0,3);
  }catch(_){}

  if (!items.length){
    const d = document.createElement('div');
    d.className = 'hha-mini-item';
    d.innerHTML = `<div class="hha-mini-title">ยังไม่เริ่ม</div>
      <div class="hha-bar"><i style="width:0%"></i></div>`;
    __miniWrap.appendChild(d);
    return;
  }

  items.forEach(q=>{
    const p = (+q.prog||0), t = (+q.target||0);
    const ratio = t>0 ? Math.max(0, Math.min(100, Math.round((p/t)*100))) : (q.done?100:0);
    const it = document.createElement('div'); it.className = 'hha-mini-item';
    const title = document.createElement('div'); title.className = 'hha-mini-title'; title.textContent = q.label || 'Quest';
    const meta = document.createElement('div'); meta.className = 'hha-mini-prog';
    meta.textContent = t>0 ? `${p}/${t}` : (q.done?'✓':'0');
    const bar = document.createElement('div'); bar.className = 'hha-bar';
    const fill = document.createElement('i'); fill.style.width = ratio+'%';
    bar.appendChild(fill);
    it.appendChild(title);
    it.appendChild(meta);
    it.appendChild(bar);
    __miniWrap.appendChild(it);
  });
}

export function questHUDUpdate(deck, hint){
  // hint เช่น "Wave 2"
  if (!__panel) questHUDInit();
  if (__hintEl) __hintEl.textContent = hint || '';

  // อ่านข้อมูล goal & mini จากอีเวนต์ล่าสุดของโหมด
  // โหมดจะยิง window.dispatchEvent('hha:quest',{detail:{ goal, mini }})
  // แต่เพื่อให้ questHUDUpdate ถูกเรียกเดี่ยว ๆ ได้ เราให้ผู้เรียกส่ง deck + goal ผ่าน deck._hha_lastQuest ถ้ามี
  let goalObj = null;
  let miniObj = null;

  // หากโหมดเรียกผ่าน dispatch ก่อนหน้า เราจะเก็บ snapshot ไว้ใน window.__HHA_LAST_QUEST
  if (window.__HHA_LAST_QUEST) {
    goalObj = window.__HHA_LAST_QUEST.goal || null;
    miniObj = window.__HHA_LAST_QUEST.mini || null;
  }

  // สำรอง: บางโหมดส่งผ่าน deck
  if ((!goalObj || !miniObj) && deck && deck._hha_lastQuest){
    goalObj = goalObj || deck._hha_lastQuest.goal || null;
    miniObj = miniObj || deck._hha_lastQuest.mini || null;
  }

  renderGoalList(goalObj);
  renderMini(deck);
}

export function questHUDDispose(){
  try{
    if (__panel && __panel.parentNode) __panel.parentNode.removeChild(__panel);
  }catch(_){}
  __panel = null; __goalList = null; __miniWrap = null; __hintEl = null;
}

// ---- Listener: เก็บ snapshot จากโหมดให้ HUD อ่านได้ทุกครั้ง ----
(function bindQuestTap(){
  if (window.__HHA_QUEST_TAP_BOUND) return;
  window.__HHA_QUEST_TAP_BOUND = true;
  window.addEventListener('hha:quest', (e)=>{
    try{
      window.__HHA_LAST_QUEST = e.detail || {};
    }catch(_){}
  });
})();
