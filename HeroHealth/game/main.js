// === /HeroHealth/game/main.js (2025-11-12 LATEST) ===
import { HUD } from '../core/hud.js';
import { ensureFeverBar, setFever, setFeverActive, setShield } from '../vr/ui-fever.js';

let hud = null;
let running = false;

// ------------- helpers -------------
const qs  = (s)=>document.querySelector(s);
const qsa = (s)=>document.querySelectorAll(s);
function on(el, ev, fn, opts){ if(el && el.addEventListener) el.addEventListener(ev, fn, opts||false); }
function fmt(n){ return (Number(n)||0).toLocaleString(); }

function getParams(){
  const p = new URLSearchParams(location.search);
  return {
    MODE  : (p.get('mode')||'goodjunk').toLowerCase(),
    DIFF  : (p.get('diff')||'normal').toLowerCase(),
    DURA  : Math.max(10, Number(p.get('time')||60)|0),
    AUTOSTART: p.get('autostart')==='1'
  };
}

// ------------- HUD + Fever docking -------------
function dockFeverBar(){
  try{
    const dock = qs('#feverBarDock');
    const bar  = document.getElementById('hhaFeverWrap') || document.getElementById('feverWrap') || qs('[data-fever]');
    if (dock && bar && bar.parentElement !== dock){
      dock.innerHTML = '';
      dock.appendChild(bar);
    }
  }catch(_){}
}

function announceHudReady(){
  try{
    window.dispatchEvent(new CustomEvent('hha:hud-ready',{detail:{anchorId:'hudTop',scoreBox:true}}));
  }catch(_){}
}

// ------------- Result Overlay -------------
function paintQuestBadge(el, x, y){
  const r = y ? (x/y) : 0;
  const ok = r >= 1 ? 'ok' : (r >= 0.5 ? 'mid' : 'low');
  const map = {
    ok : {bg:'#16a34a22', b:'#22c55e', fg:'#bbf7d0'},
    mid: {bg:'#f59e0b22', b:'#f59e0b', fg:'#fde68a'},
    low: {bg:'#ef444422', b:'#ef4444', fg:'#fecaca'}
  };
  const t = map[ok];
  el.style.background = t.bg; el.style.borderColor = t.b; el.style.color = t.fg;
}

function showResultOverlay(detail){
  const old = document.getElementById('hhaResultOverlay');
  if (old) old.remove();

  const wrap = document.createElement('div');
  wrap.id = 'hhaResultOverlay';
  wrap.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:center;justify-content:center;';

  const card = document.createElement('div');
  card.style.cssText = 'width:min(840px,92vw);max-height:86vh;overflow:auto;background:#0b1220cc;border:1px solid #334155;border-radius:18px;padding:20px;color:#e2e8f0;font:600 14px system-ui,Segoe UI,Inter,Roboto;box-shadow:0 20px 60px rgba(0,0,0,.45);';

  const head = document.createElement('div');
  head.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:8px;';
  const title = document.createElement('div');
  title.style.cssText = 'font-weight:900;font-size:20px;';
  title.textContent = `สรุปผล: ${detail.mode||'Result'}${detail.difficulty?` (${detail.difficulty})`:''}`;

  const badges = document.createElement('div');
  badges.style.cssText = 'display:flex;gap:8px;align-items:center;';
  const bQuests = document.createElement('div');
  bQuests.textContent = `QUESTS ${fmt(detail.questsCleared||0)}/${fmt(detail.questsTotal||0)}`;
  bQuests.style.cssText = 'padding:4px 8px;border-radius:999px;border:1px solid #475569;background:#1e293b;color:#a5b4fc;font-weight:900;';
  paintQuestBadge(bQuests, Number(detail.questsCleared||0), Number(detail.questsTotal||0));
  const bTime = document.createElement('div');
  bTime.textContent = `TIME ${fmt(detail.duration||0)}s`;
  bTime.style.cssText = 'padding:4px 8px;border-radius:999px;border:1px solid #475569;background:#334155;color:#cbd5e1;font-weight:800;';
  badges.appendChild(bQuests); badges.appendChild(bTime);
  head.appendChild(title); head.appendChild(badges);

  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:8px;';
  function kpi(label, valueHTML){
    const box = document.createElement('div');
    box.style.cssText = 'background:#0f172acc;border:1px solid #334155;border-radius:12px;padding:12px;';
    const b = document.createElement('b'); b.textContent = label; b.style.cssText='display:block;font-size:12px;color:#93c5fd;font-weight:800;margin-bottom:6px;';
    const v = document.createElement('div'); v.innerHTML = valueHTML; v.style.cssText='font-size:22px;font-weight:900;color:#f8fafc;';
    box.appendChild(b); box.appendChild(v); return box;
  }
  const goalHTML = (detail.goalCleared?`<span style="color:#22c55e">ถึงเป้า (${fmt(detail.goalTarget)})</span>`
                                  :`<span style="color:#ef4444">ยังไม่ถึง (${fmt(detail.goalTarget)})</span>`);
  grid.appendChild(kpi('คะแนนรวม', fmt(detail.score||0)));
  grid.appendChild(kpi('คอมโบสูงสุด', fmt(detail.comboMax||0)));
  grid.appendChild(kpi('เป้าหมาย', goalHTML));
  grid.appendChild(kpi('พลาด (miss)', fmt(detail.misses||0)));

  const listWrap = document.createElement('div');
  listWrap.style.cssText = 'margin-top:12px;border-top:1px dashed #334155;padding-top:12px;';
  const h3 = document.createElement('h3'); h3.textContent = 'ภารกิจที่สุ่มให้รอบนี้'; h3.style.cssText='margin:0 0 8px 0;font-weight:900;font-size:16px;color:#93c5fd;';
  const list = document.createElement('div'); list.style.cssText='display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;';
  const arr = (detail.questsSummary && detail.questsSummary.slice) ? detail.questsSummary.slice(0,12) : [];
  if (arr.length){
    for (let i=0;i<arr.length;i++){
      const q = arr[i]||{};
      const row = document.createElement('div');
      row.style.cssText='display:flex;align-items:center;gap:10px;background:#0f172acc;border:1px solid #263244;border-radius:12px;padding:10px;';
      const ck = document.createElement('div');
      ck.textContent = q.done?'✓':'•';
      ck.style.cssText='width:22px;height:22px;display:flex;align-items:center;justify-content:center;border-radius:50%;font-weight:900;'+
                       (q.done?'background:#16a34a;border:1px solid #15803d;color:#fff;':'background:#334155;border:1px solid #475569;color:#94a3b8;');
      const txt = document.createElement('div'); txt.textContent = q.label||''; txt.style.cssText='flex:1 1 auto;';
      const meta = document.createElement('div'); meta.textContent = (q.target>0?`(${fmt(q.prog)||0}/${fmt(q.target)})`:''); meta.style.cssText='color:#94a3b8;font-weight:700;font-size:12px;';
      row.appendChild(ck); row.appendChild(txt); row.appendChild(meta);
      list.appendChild(row);
    }
  }else{
    const empty = document.createElement('div');
    empty.textContent = 'ไม่มีข้อมูลเควสต์จากรอบนี้';
    empty.style.cssText='color:#94a3b8;font-weight:700;';
    list.appendChild(empty);
  }
  listWrap.appendChild(h3); listWrap.appendChild(list);

  const actions = document.createElement('div');
  actions.style.cssText='display:flex;gap:8px;justify-content:flex-end;margin-top:14px;';
  const btnRetry = document.createElement('button');
  btnRetry.textContent = 'เล่นอีกครั้ง';
  btnRetry.className = 'hha-btn';
  btnRetry.style.cssText='appearance:none;border:1px solid #334155;background:#2563eb;color:#fff;border-radius:10px;padding:10px 14px;font-weight:800;cursor:pointer;';
  const btnHub = document.createElement('button');
  btnHub.textContent = 'กลับ Hub';
  btnHub.style.cssText='appearance:none;border:1px solid #334155;background:#0b1220;color:#e2e8f0;border-radius:10px;padding:10px 14px;font-weight:800;cursor:pointer;';
  actions.appendChild(btnHub); actions.appendChild(btnRetry);

  card.appendChild(head);
  card.appendChild(grid);
  card.appendChild(listWrap);
  card.appendChild(actions);
  wrap.appendChild(card);
  (qs('.game-wrap')||document.body).appendChild(wrap);

  btnRetry.onclick = ()=>{ try{ wrap.remove(); }catch(_){ } location.reload(); };

  // กลับ Hub พร้อมโหมด/ระดับเดิม
  btnHub.onclick = ()=>{
    const p = getParams();
    location.href = `./hub.html?mode=${encodeURIComponent((detail.mode || p.MODE || 'goodjunk')).toLowerCase()}&diff=${encodeURIComponent((detail.difficulty || p.DIFF || 'normal')).toLowerCase()}`;
  };

  // ปิดเมื่อคลิกพื้นหลัง
  wrap.addEventListener('click', (e)=>{ if(e.target===wrap){ try{ wrap.remove(); }catch(_){ } }});
}

// ------------- Game bootstrap -------------
async function loadModeModule(MODE){
  // ลองหลายพาธให้ชัวร์ แต่ให้เน้นพาธโฟลเดอร์เดียวกับ index.vr.html ก่อน
  const cand = [
    new URL(`../modes/${MODE}.safe.js`, import.meta.url),   // when main.js is in /game/ → ../modes/
    new URL(`./modes/${MODE}.safe.js`, location.href),      // fallback
    new URL(`/webxr-health-mobile/HeroHealth/modes/${MODE}.safe.js`, location.origin) // absolute
  ];
  let lastErr;
  for (const u of cand){
    try{
      u.searchParams.set('v', Date.now().toString()); // cache-bust
      console.log('[main] try import', u.href);
      const mod = await import(u.href);
      if (mod && (mod.boot || (mod.default && mod.default.boot))) return mod;
    }catch(e){ console.warn('[main] import failed', u.href, e); lastErr=e; }
  }
  throw lastErr || new Error('Mode module not found');
}

async function startGame(){
  if (running) return;
  running = true;

  // hide start panels / button
  try{ const sp=qs('#startPanel'); if(sp) sp.setAttribute('visible','false'); }catch(_){}
  try{ const btn=qs('#btnStart'); if(btn) btn.style.display='none'; }catch(_){}

  // fever UI
  try{
    ensureFeverBar();
    setFever(0); setFeverActive(false); setShield(0);
    // ให้ layout เสถียรก่อนแล้วค่อยย้าย
    requestAnimationFrame(dockFeverBar);
  }catch(_){}

  const { MODE, DIFF, DURA } = getParams();

  // load mode module
  const mod = await loadModeModule(MODE);
  const boot = (mod.boot || (mod.default && mod.default.boot));
  if (typeof boot !== 'function') throw new Error('mode has no boot()');

  const ctrl = await boot({ difficulty: DIFF, duration: DURA });
  if (ctrl && typeof ctrl.start === 'function') ctrl.start();

  // init HUD values
  hud && hud.setScore(0);
  hud && hud.setCombo(0);
  hud && hud.setTimer(DURA);
}

// ------------- wire events -------------
function wire(){
  // score/ combo calculation (from mode-factory deltas)
  let score = 0, combo = 0;

  on(window, 'hha:time', (e)=>{
    const sec = (e && e.detail && typeof e.detail.sec!=='undefined') ? (e.detail.sec|0) : 0;
    if (hud && hud.setTimer) hud.setTimer(sec);
    // เมื่อหมดเวลา overlay จะถูกเรียกผ่าน hha:end โดยโหมด
  });

  on(window, 'hha:score', (e)=>{
    const d = e && e.detail ? e.detail : {};
    const delta = Number(d.delta||0);
    score = Math.max(0, score + delta);
    combo = d.good ? (combo+1) : 0;
    if (hud){
      if (hud.setScore) hud.setScore(score);
      if (hud.setCombo) hud.setCombo(combo);
    }
  });

  // จบเกม → เปิดสรุป
  on(window, 'hha:end', (e)=>{
    try{
      const p = getParams();
      const detail = Object.assign({mode:p.MODE, difficulty:p.DIFF, duration:p.DURA}, (e && e.detail)||{});
      showResultOverlay(detail);
    }catch(err){ console.warn('result overlay error', err); }
  });

  // เผื่อ lib fever/อื่น ๆ ต้องการ anchor HUD
  announceHudReady();

  // visibility → pause/resume (delegate ให้ mode-factory ด้วย)
  on(document, 'visibilitychange', ()=>{
    // ไม่ต้องทำอะไรเพิ่ม ที่ mode-factory จัดการอยู่แล้ว
  });

  // start buttons
  const domBtn = qs('#btnStart');
  if (domBtn) on(domBtn, 'click', (ev)=>{ try{ev.preventDefault();}catch(_){ } startGame(); });

  // auto start
  const { AUTOSTART } = getParams();
  if (AUTOSTART){
    setTimeout(()=>startGame(), 50);
  }
}

// ------------- boot -------------
function boot(){
  try{
    hud = new HUD();
    const mount = qs('.game-wrap') || document.body;
    hud.mount(mount);
  }catch(e){ console.warn('[main] HUD error', e); }

  wire();
  // เผื่อ fever bar มาไม่ทัน
  setTimeout(dockFeverBar, 120);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

window.__HHA_BOOT_OK = 'game/main.js';