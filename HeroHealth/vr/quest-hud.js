// === /HeroHealth/vr/quest-hud.js (2025-11-12 FOCUS-ONE + TIMER) ===
// - แสดง "ทีละ" Goal และ "ทีละ" Mini quest (auto-rotate ทุก 4 วินาที)
// - ปุ่ม ◀ ▶ เลื่อนด้วยตัวเองได้ (คลิกที่การ์ด)
// - API เดิม: questHUDInit(), questHUDUpdate(deck, hint), questHUDDispose()

let __root=null, __panel=null, __hint=null, __goalBox=null, __miniBox=null, __rot=null;
let __state = { goal:null, minis:[], gIdx:0, mIdx:0 };

function cssOnce(){
  if (document.getElementById('hha-quest-style')) return;
  const st=document.createElement('style'); st.id='hha-quest-style';
  st.textContent = `
  .hha-quest { position:absolute; left:16px; top:14px; z-index:510; pointer-events:none;
               display:flex; flex-direction:column; gap:10px; }
  .card { background:#0b1220cc; color:#e2e8f0; border:1px solid #334155; border-radius:14px;
          box-shadow:0 12px 30px rgba(0,0,0,.35); padding:10px 12px; min-width:260px; pointer-events:auto; }
  .head { font-weight:900; color:#cbd5e1; margin-bottom:6px; display:flex; justify-content:space-between; align-items:center; }
  .hint { font-size:12px; color:#94a3b8; margin:-2px 0 6px 0; }
  .nav { display:flex; gap:6px; }
  .nav button { background:#1f2937; color:#e5e7eb; border:1px solid #334155; border-radius:8px; padding:2px 8px; cursor:pointer; }
  .row { display:grid; grid-template-columns:auto 1fr auto; gap:8px; align-items:center; }
  .flag { width:18px; text-align:center; font-size:14px; }
  .label { font-size:13px; color:#e5e7eb; line-height:1.15; }
  .val { font-size:12px; color:#93c5fd; }
  .bar { height:6px; width:100%; border-radius:999px; background:#1f2937; overflow:hidden; margin-top:6px; }
  .bar>i { display:block; height:100%; width:0%; background:linear-gradient(90deg,#22c55e,#16a34a); }
  `;
  document.head.appendChild(st);
}

export function questHUDInit(){
  cssOnce();
  __root = document.getElementById('hudRoot') || document.body;
  __panel = document.getElementById('hhaQuestPanel');
  if (!__panel){
    __panel = document.createElement('div');
    __panel.id='hhaQuestPanel'; __panel.className='hha-quest';
    // Goals
    const cardG = document.createElement('div'); cardG.className='card';
    const headG = document.createElement('div'); headG.className='head';
    const hTitleG = document.createElement('div'); hTitleG.textContent='เป้าหมายหลัก';
    const navG = document.createElement('div'); navG.className='nav';
    const btnPrevG = document.createElement('button'); btnPrevG.textContent='◀';
    const btnNextG = document.createElement('button'); btnNextG.textContent='▶';
    navG.appendChild(btnPrevG); navG.appendChild(btnNextG);
    headG.appendChild(hTitleG); headG.appendChild(navG);
    __hint = document.createElement('div'); __hint.className='hint'; __hint.textContent='Wave 1';
    __goalBox = document.createElement('div');
    cardG.appendChild(headG); cardG.appendChild(__hint); cardG.appendChild(__goalBox);

    // Mini
    const cardM = document.createElement('div'); cardM.className='card';
    const headM = document.createElement('div'); headM.className='head';
    const hTitleM = document.createElement('div'); hTitleM.textContent='Mini Quest';
    const navM = document.createElement('div'); navM.className='nav';
    const btnPrevM = document.createElement('button'); btnPrevM.textContent='◀';
    const btnNextM = document.createElement('button'); btnNextM.textContent='▶';
    navM.appendChild(btnPrevM); navM.appendChild(btnNextM);
    headM.appendChild(hTitleM); headM.appendChild(navM);
    __miniBox = document.createElement('div');
    cardM.appendChild(headM); cardM.appendChild(__miniBox);

    __panel.appendChild(cardG); __panel.appendChild(cardM);
    __root.appendChild(__panel);

    // nav handlers
    btnPrevG.addEventListener('click', ()=>{ stepGoal(-1); });
    btnNextG.addEventListener('click', ()=>{ stepGoal(+1); });
    btnPrevM.addEventListener('click', ()=>{ stepMini(-1); });
    btnNextM.addEventListener('click', ()=>{ stepMini(+1); });
  }
}

function stepGoal(d){
  if (!__state.goal || !Array.isArray(__state.goal.list) || !__state.goal.list.length) return;
  const n = __state.goal.list.length;
  __state.gIdx = ( (__state.gIdx + d) % n + n ) % n;
  renderGoalFocused();
}
function stepMini(d){
  if (!__state.minis.length) return;
  const n = __state.minis.length;
  __state.mIdx = ( (__state.mIdx + d) % n + n ) % n;
  renderMiniFocused();
}

function renderGoalFocused(){
  __goalBox.innerHTML = '';
  const g = __state.goal;
  // หัวสรุปรวม
  const head = document.createElement('div'); head.className='row';
  const flag = document.createElement('div'); flag.className='flag';
  const cleared=(g?.prog|0), total=(g?.target|0);
  flag.textContent = (cleared>=total&&total>0)?'✅':'⬜';
  const lab = document.createElement('div'); lab.className='label'; lab.textContent = g?.label || 'Goals';
  const val = document.createElement('div'); val.className='val'; val.textContent = `${cleared}/${total}`;
  head.appendChild(flag); head.appendChild(lab); head.appendChild(val);
  __goalBox.appendChild(head);
  const bar = document.createElement('div'); bar.className='bar';
  const fill=document.createElement('i'); fill.style.width = total>0? Math.round(cleared*100/total)+'%':'0%';
  bar.appendChild(fill); __goalBox.appendChild(bar);

  // แสดง “หนึ่งข้อ” จาก list
  const list = Array.isArray(g?.list)? g.list : [];
  if (list.length){
    const q = list[__state.gIdx % list.length];
    const row = document.createElement('div'); row.className='row'; row.style.marginTop='8px';
    const f = document.createElement('div'); f.className='flag'; f.textContent = q.done?'✅':'⬜';
    const lbl=document.createElement('div'); lbl.className='label'; lbl.textContent = q.label||'';
    const vv = document.createElement('div'); vv.className='val';
    const p=+q.prog||0, t=+q.target||0; vv.textContent = t>0? `${p}/${t}` : (q.done?'✓':'0');
    row.appendChild(f); row.appendChild(lbl); row.appendChild(vv);
    const b2=document.createElement('div'); b2.className='bar';
    const i2=document.createElement('i'); i2.style.width = t>0? Math.round(Math.min(100, (p/t)*100))+'%' : (q.done?'100%':'0%');
    b2.appendChild(i2);
    __goalBox.appendChild(row); __goalBox.appendChild(b2);
  }
}

function renderMiniFocused(){
  __miniBox.innerHTML = '';
  if (!__state.minis.length){
    const row=document.createElement('div'); row.className='row';
    row.innerHTML = `<div class="flag">⬜</div><div class="label">ยังไม่เริ่ม</div><div class="val">0</div>`;
    __miniBox.appendChild(row);
    const b=document.createElement('div'); b.className='bar'; b.innerHTML='<i style="width:0%"></i>';
    __miniBox.appendChild(b);
    return;
  }
  const q = __state.minis[__state.mIdx % __state.minis.length];
  const row=document.createElement('div'); row.className='row';
  const f=document.createElement('div'); f.className='flag'; f.textContent = q.done?'✅':'⬜';
  const lbl=document.createElement('div'); lbl.className='label'; lbl.textContent = q.label||'Quest';
  const vv=document.createElement('div'); vv.className='val';
  const p=+q.prog||0, t=+q.target||0; vv.textContent = t>0? `${p}/${t}` : (q.done?'✓':'0');
  row.appendChild(f); row.appendChild(lbl); row.appendChild(vv);
  const b=document.createElement('div'); b.className='bar';
  const i=document.createElement('i'); i.style.width = t>0? Math.round(Math.min(100, (p/t)*100))+'%' : (q.done?'100%':'0%');
  b.appendChild(i);
  __miniBox.appendChild(row); __miniBox.appendChild(b);
}

function setDataFrom(detail, deck, hint){
  if (hint && __hint) __hint.textContent = hint;

  // goal (object ที่โหมดส่งมา)
  const g = detail?.goal || null;
  // mini list: ดึงจาก deck.getProgress() (3 รายการ) เพื่อให้เป็นข้อมูลจริงตอนนี้
  let minis = [];
  try{
    const prog = deck?.getProgress ? deck.getProgress() : [];
    minis = prog.filter(Boolean).slice(0,3);
  }catch(_){}

  __state.goal = g ? {
    label: g.label || 'Goals',
    prog: +g.prog||0,
    target: +g.target||0,
    list: Array.isArray(g.list) ? g.list : []    // ถ้าโหมดส่ง list มา จะใช้ list นี้
  } : null;
  __state.minis = minis;

  // ถ้า goal ไม่มี list แต่โหมดอยากโฟกัส “หนึ่งรายการ” อยู่แล้ว ก็ยังแสดงหัวรวม + แถบรวมได้
  renderGoalFocused();
  renderMiniFocused();

  // เริ่มหมุนอัตโนมัติ
  if (__rot) clearInterval(__rot);
  __rot = setInterval(()=>{
    stepGoal(+1);
    stepMini(+1);
  }, 4000);
}

export function questHUDUpdate(deck, hint){
  if (!__panel) questHUDInit();
  // อ่าน snapshot ล่าสุดที่โหมดยิงมา
  let last = window.__HHA_LAST_QUEST || {};
  setDataFrom(last, deck, hint);
}

export function questHUDDispose(){
  try{ if(__rot) clearInterval(__rot); }catch(_){}
  __rot = null;
  try{ if(__panel && __panel.parentNode) __panel.parentNode.removeChild(__panel); }catch(_){}
  __panel=null; __goalBox=null; __miniBox=null; __hint=null; __state={goal:null,minis:[],gIdx:0,mIdx:0};
}

// เก็บ snapshot ทุกครั้งที่โหมดส่ง hha:quest
(function bind(){
  if (window.__HHA_QUEST_TAP_BOUND) return;
  window.__HHA_QUEST_TAP_BOUND = true;
  window.addEventListener('hha:quest', (e)=>{ try{ window.__HHA_LAST_QUEST = e.detail||{}; }catch(_){ } });
})();
