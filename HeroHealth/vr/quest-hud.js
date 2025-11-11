// === vr/quest-hud.js — Shared HUD for Goal + Mini Quests (3 ใบ) ===
// วิธีใช้ (ทุกโหมด):
//   import { questHUDInit, questHUDUpdate, questHUDDispose } from '../vr/quest-hud.js';
//   const deck = new MissionDeck(); deck.draw3();
//   questHUDInit();            // ครั้งแรกของโหมด (หรือไว้ใน index ก็ได้)
//   questHUDUpdate(deck);      // เรียกทุกครั้งที่สถิติเปลี่ยน / ต่อวินาที
//   // ตอนออกจากโหมด (หรือรับสัญญาณจาก index):
//   questHUDDispose();
//
// deck.getProgress() ต้องคืน [{id,label,level,done,prog,target,current}, ...] (รองรับจาก MissionDeck ที่คุณใช้อยู่)

(function(){
  // ล้างของเก่าเมื่อ index ส่งสัญญาณเปลี่ยนโหมด
  window.addEventListener('hha:dispose-ui', () => {
    try { questHUDDispose(); } catch {}
  });
})();

function $(s){ return document.querySelector(s); }
function clamp(n,a,b){ return Math.max(a, Math.min(b, n)); }

export function questHUDInit(){
  if (document.getElementById('questPanel')) return;
  const wrap = document.createElement('div');
  wrap.id = 'questPanel';
  wrap.setAttribute('data-hha-ui','');
  Object.assign(wrap.style, {
    position:'fixed', right:'12px', bottom:'68px', zIndex:'930',
    width:'min(340px, 86vw)', color:'#e8eefc',
    background:'rgba(17,24,39,.72)', border:'1px solid #334155',
    borderRadius:'12px', padding:'10px 12px', backdropFilter:'blur(6px)',
    fontFamily:'system-ui,-apple-system,Segoe UI,Roboto,Thonburi,sans-serif'
  });
  wrap.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px">
      <strong style="font-weight:800">Goal + Mini Quests</strong>
      <span id="questHint" style="opacity:.8;font-weight:700;font-size:12px"></span>
    </div>
    <div id="questList" role="list"></div>
  `;
  document.body.appendChild(wrap);
}

export function questHUDDispose(){
  const el = document.getElementById('questPanel');
  if (el) try { el.remove(); } catch {}
}

function rowHTML(item, idx){
  const done = !!item.done;
  const cur  = !!item.current;
  const prog = Number.isFinite(item.prog) ? item.prog : (done ? (item.target ?? 1) : 0);
  const tgt  = Number.isFinite(item.target) ? item.target : (done ? 1 : (prog||1));
  const pct  = tgt>0 ? Math.round(clamp(prog/tgt,0,1)*100) : (done?100:0);
  const lv   = item.level || '';
  const badge = done ? '✅' : (cur ? '▶️' : '•');

  return `
  <div role="listitem" aria-current="${cur?'true':'false'}"
       style="border:1px solid #334155;border-radius:10px;padding:8px 10px;margin:6px 0;background:${done?'#0b5':'#0b1222'}22">
    <div style="display:flex;justify-content:space-between;gap:8px;align-items:center">
      <div style="font-weight:800">${badge} ${item.label}</div>
      <div style="opacity:.85;font-weight:800;font-size:12px">${lv.toUpperCase()}</div>
    </div>
    <div style="height:10px;border:1px solid #334155;border-radius:999px;overflow:hidden;margin-top:6px;background:#0b1222">
      <div style="height:100%;width:${pct}%;background:${done?'linear-gradient(90deg,#22c55e,#86efac)':'linear-gradient(90deg,#60a5fa,#93c5fd)'}"></div>
    </div>
    <div style="margin-top:4px;font-size:12px;font-weight:800;opacity:.9">${prog}/${tgt}</div>
  </div>`;
}

export function questHUDUpdate(deck, hintText){
  questHUDInit();
  const list = document.getElementById('questList');
  const hint = document.getElementById('questHint');
  if (!list) return;
  try {
    const prog = (typeof deck.getProgress==='function') ? deck.getProgress() : [];
    list.innerHTML = prog.map((it, i)=>rowHTML(it,i)).join('');
    if (hint && typeof hintText==='string') hint.textContent = hintText;
  } catch(e) {
    // กรณี deck ยังไม่พร้อม
    list.innerHTML = `<div style="opacity:.7;font-weight:700">กำลังตั้งค่าเควสต์…</div>`;
  }
}

export default { questHUDInit, questHUDUpdate, questHUDDispose };