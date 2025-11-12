// === /HeroHealth/game/main.js (2025-11-12 LATEST: stable start + live HUD + correct result) ===
'use strict';

/* ---------------- Helpers ---------------- */
const $  = (s)=>document.querySelector(s);
const by = (id)=>document.getElementById(id);
const qs = new URLSearchParams(location.search);

function setText(el, v){ if(el) el.textContent = String(v); }

/* ---------------- Config from URL ---------------- */
const MODE = (qs.get('mode')||'goodjunk').toLowerCase();
const DIFF = (qs.get('diff')||'normal').toLowerCase();
const DURATION = Number(qs.get('time')||qs.get('duration')||60) || 60;

/* ---------------- Fever bar docking (DOM HUD) ---------------- */
window.addEventListener('DOMContentLoaded', () => {
  // บอกระบบ UI ว่า HUD พร้อมให้ย้าย fever bar มายึดตรง #feverBarDock
  try { window.dispatchEvent(new CustomEvent('hha:hud-ready', {detail:{
    dock: by('feverBarDock')
  }})); } catch(_){}
});

/* ---------------- Live HUD state (fallback if modeไม่ได้ส่ง hha:stats) ---------------- */
let liveScore = 0;
let liveCombo = 0;
let ended     = false;

function resetHUD(){
  liveScore = 0;
  liveCombo = 0;
  setText(by('hudScore'), 0);
  setText(by('hudCombo'), 0);
}
resetHUD();

/* ถ้าโหมดส่ง hha:stats มาให้ (preferred) ให้ใช้ค่านั้นแทน */
window.addEventListener('hha:stats', (e)=>{
  const d = e.detail||{};
  if (typeof d.score === 'number') { liveScore = d.score; setText(by('hudScore'), liveScore); }
  if (typeof d.combo === 'number') { liveCombo = d.combo; setText(by('hudCombo'), liveCombo); }
});

/* โหมดพื้นฐานจาก mode-factory: อัปเดตคะแนน/คอมโบแบบรวมศูนย์ */
window.addEventListener('hha:score', (e)=>{
  const d = e.detail||{};
  const delta = Number(d.delta||0);
  const good  = !!d.good;

  liveScore = Math.max(0, liveScore + delta);
  if (good) { liveCombo += 1; } else { liveCombo = 0; }

  setText(by('hudScore'), liveScore);
  setText(by('hudCombo'), liveCombo);
});

/* หมดเวลา/วิ่งเวลา */
window.addEventListener('hha:time', (e)=>{
  // ถ้าต้องมีตัวเลขเวลาบน HUD สามารถเพิ่ม element แล้ว setText ตรงนี้ได้
  // setText(by('hudTime'), (e?.detail?.sec ?? 0) + 's');
});

/* เมื่อ good item หมดอายุให้รีเซ็ตคอมโบ (กันคอมโบค้าง) */
window.addEventListener('hha:expired', (e)=>{
  if (e?.detail?.isGood) {
    liveCombo = 0;
    setText(by('hudCombo'), liveCombo);
  }
});

/* ---------------- Result Overlay (ถูกต้องตาม goodjunk.safe.js) ---------------- */
function paintQuestBadge(el, done, total){
  const r = total ? done/total : 0;
  el.style.borderColor = (r>=1)?'#22c55e':(r>=0.5?'#f59e0b':'#ef4444');
  el.style.background  = (r>=1)?'#22c55e22':(r>=0.5?'#f59e0b22':'#ef444422');
  el.style.color       = (r>=1)?'#dcfce7':(r>=0.5?'#fff7ed':'#fee2e2');
  el.textContent = `Mini Quests ${done}/${total}`;
}

function showResult(detail){
  const score       = +detail.score || liveScore || 0;
  const comboMax    = +detail.comboMax || 0;
  const misses      = +detail.misses  || 0;
  const duration    = +detail.duration || DURATION;
  const mode        = String(detail.mode || MODE);
  const difficulty  = String(detail.difficulty || DIFF);

  const questsCleared = Number(detail.questsCleared ?? detail.questsDone ?? 0);
  const questsTotal   = Number(
    detail.questsTotal ?? detail.quests_total ??
    (Array.isArray(detail.miniQuests)? detail.miniQuests.length :
     Array.isArray(detail.quests)?     detail.quests.length : 0)
  );

  const goalTarget  = Number(detail.goalTarget ?? 0);
  const goalCleared = Boolean( detail.goalCleared === true || (goalTarget>0 && score>=goalTarget) );
  const goalText    = goalCleared ? `ถึงเป้า (${goalTarget})` : `ไม่ถึง (${goalTarget>0?goalTarget:'-'})`;

  const old = by('resultOverlay'); if (old) old.remove();
  const wrap = document.createElement('div'); wrap.id = 'resultOverlay';
  wrap.innerHTML = `
    <div class="card">
      <h2>สรุปผล: ${mode} (${difficulty})</h2>
      <div class="grid">
        <div class="pill"><div class="k">คะแนนรวม</div><div class="v">${score.toLocaleString()}</div></div>
        <div class="pill"><div class="k">คอมโบสูงสุด</div><div class="v">${comboMax}</div></div>
        <div class="pill"><div class="k">พลาด</div><div class="v">${misses}</div></div>
        <div class="pill"><div class="k">เป้าหมาย</div><div class="v ${goalCleared?'ok':'ng'}">${goalText}</div></div>
        <div class="pill"><div class="k">เวลา</div><div class="v">${duration}s</div></div>
      </div>
      <div class="questRow"><span id="questBadge" class="questBadge">Mini Quests 0/0</span></div>
      <div class="btns">
        <button id="btnRetry">เล่นอีกครั้ง</button>
        <button id="btnHub">กลับ Hub</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);

  paintQuestBadge(wrap.querySelector('#questBadge'), questsCleared, questsTotal);

  wrap.querySelector('#btnRetry').onclick = ()=> location.reload();
  wrap.querySelector('#btnHub').onclick   = ()=>{
    const u = new URL('../hub.html', location.href);
    u.searchParams.set('mode', mode);
    u.searchParams.set('diff', difficulty);
    location.href = u.href;
  };
}

const resultCSS = document.createElement('style'); resultCSS.textContent = `
#resultOverlay{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(2,6,23,.72);z-index:9999;}
#resultOverlay .card{background:#0b1220;border:1px solid #1f2a44;border-radius:18px;min-width:720px;max-width:960px;padding:20px 22px;color:#e5e7eb;box-shadow:0 20px 60px rgba(0,0,0,.5)}
#resultOverlay h2{margin:0 0 12px 0;color:#f8fafc}
#resultOverlay .grid{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:10px}
#resultOverlay .pill{background:#0f172a;border:1px solid #233250;border-radius:12px;padding:10px 12px}
#resultOverlay .pill .k{font:600 12px/1.2 system-ui;color:#94a3b8}
#resultOverlay .pill .v{font:800 24px/1.1 system-ui;color:#fff;margin-top:4px}
#resultOverlay .pill .v.ok{color:#86efac}
#resultOverlay .pill .v.ng{color:#fca5a5}
#resultOverlay .questRow{margin:8px 2px 0}
#resultOverlay .questBadge{display:inline-block;padding:6px 10px;border:2px solid #334155;border-radius:10px;font-weight:800}
#resultOverlay .btns{margin-top:14px;display:flex;gap:12px;justify-content:flex-end}
#resultOverlay .btns button{padding:10px 14px;border-radius:12px;border:1px solid #243449;cursor:pointer;font-weight:800}
#resultOverlay #btnRetry{background:#16a34a;color:#fff;border-color:#16a34a}
#resultOverlay #btnHub{background:#0ea5e9;color:#fff;border-color:#0ea5e9}
@media (max-width:820px){#resultOverlay .card{min-width:auto;width:92%} #resultOverlay .grid{grid-template-columns:1fr 1fr}}
`; document.head.appendChild(resultCSS);

/* เมื่อ mode-factory จบเกม → เปิดสรุป */
window.addEventListener('hha:end', (e)=>{
  if (ended) return;
  ended = true;
  showResult(e.detail||{ mode: MODE, difficulty: DIFF, duration: DURATION, score: liveScore });
});

/* ---------------- Dynamic mode loader & start ---------------- */
function resolveModePath(mode){
  // โฟลเดอร์ modes อยู่ขนานกับ /game/ → ใช้ "../modes/xxx.safe.js"
  const base = '../modes';
  switch (mode) {
    case 'goodjunk':  return `${base}/goodjunk.safe.js`;
    case 'groups':    return `${base}/groups.safe.js`;
    case 'hydration': return `${base}/hydration.safe.js`;
    case 'plate':     return `${base}/plate.safe.js`;
    default:          return `${base}/goodjunk.safe.js`;
  }
}

async function startGame(){
  resetHUD();
  ended = false;

  const path = resolveModePath(MODE);
  let mod;
  try {
    mod = await import(path /* webpackIgnore: true */);
  } catch (err){
    console.error('[main] Failed to import mode:', path, err);
    alert('โหลดโหมดเกมไม่สำเร็จ: ' + MODE);
    return;
  }

  if (!mod || typeof mod.boot !== 'function'){
    console.error('[main] Mode has no boot():', mod);
    alert('โหมดเกมไม่พร้อมใช้งาน');
    return;
  }

  try {
    const ctrl = await mod.boot({ difficulty: DIFF, duration: DURATION });
    // เริ่มสปิน
    await ctrl.start?.();
  } catch (err){
    console.error('[main] boot/start failed:', err);
  }
}

/* ---------------- Wire Start button ---------------- */
window.addEventListener('DOMContentLoaded', ()=>{
  const btn = by('btnStart');
  if (btn){
    btn.addEventListener('click', (e)=>{ e.preventDefault(); startGame(); });
  }
  // auto-start เมื่อมี mode/diff ใน URL
  if (MODE) {
    // ให้ layout ลงตัวก่อนสั่ง start
    setTimeout(()=>{ startGame(); }, 100);
  }
});
