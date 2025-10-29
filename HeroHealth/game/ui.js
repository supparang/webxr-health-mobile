// === Hero Health Academy — game/ui.js (2025-10-30, safe HUD + help + audio unlock) ===
const $  = (s)=>document.querySelector(s);
const $$ = (s)=>document.querySelectorAll(s);
const on = (el,ev,fn,opt)=> el && el.addEventListener(ev,fn,opt||{});

// ---------------------------------------------------------
// 1) จัดเลเยอร์ให้คลิกอีโมจิได้ (HUD ไม่บังคลิก)
// ---------------------------------------------------------
(function ensureLayers(){
  // แคนวาส/แบ็คกราวด์ (ถ้ามี) ให้ไม่รับคลิก
  const c = document.getElementById('c');
  if (c){ c.style.pointerEvents = 'none'; c.style.zIndex = '1'; }

  // HUD / Coach / Toast / Mission line — ไม่รับคลิก
  ['hudWrap','questBar','questChips','coachHUD','toast','missionLine','targetWrap'].forEach(id=>{
    const el = document.getElementById(id);
    if (el) el.style.pointerEvents = 'none';
  });

  // ป้องกัน overlay อื่น ๆ ที่อาจบัง
  $$('.hud,.coach,.toast,.pill').forEach(el=>{
    el.style.pointerEvents = 'none';
    const z = parseInt(getComputedStyle(el).zIndex||'95',10);
    if (z < 90) el.style.zIndex = '95';
  });

  // ปุ่มในเมนูต้องกดได้
  ['menuBar','btn_start','d_easy','d_normal','d_hard','m_goodjunk','m_groups','m_hydration','m_plate',
   'langToggle','soundToggle','gfxToggle'
  ].forEach(id=>{
    const el = document.getElementById(id);
    if (el){ el.style.pointerEvents = 'auto'; }
  });
})();

// ---------------------------------------------------------
// 2) Help modal (How-to) — เปิดจากปุ่ม ? และปิดด้วย OK
//    * คอนเทนต์จริง ๆ จะมาจาก main.js/hud.js หรือจะเติมที่นี่ก็ได้
// ---------------------------------------------------------
function howto(lang='TH', mode='goodjunk'){
  const T = {
    TH: {
      kb: `คีย์บอร์ด: ↑ กระโดด, ↓ หมอบ, ←/→ แดช\nเมาส์: คลิกซ้าย=กระโดด, คลิกขวา=หมอบ, ล้อ=แดช`,
      goodjunk: `เป้าหมาย: เก็บอาหารดี เลี่ยงขยะ • คอมโบ x4/x8/x12 • มีเควสต์`,
      groups:   `เป้าหมาย: เก็บให้ตรงหมวดบน HUD • ถูก +7, ผิด −2 • เปลี่ยนเป้าเป็นช่วงๆ`,
      hydration:`เป้าหมาย: รักษา 💧 45–65% • N=Normalize • G=Guard 5s`,
      plate:    `เป้าหมาย: เติมจานครบโควตา (ธัญพืช/ผัก/โปรตีน/ผลไม้/นม)`
    },
    EN: {
      kb: `Keyboard: ↑ Jump, ↓ Duck, ←/→ Dash\nMouse: LMB=Jump, RMB=Duck, Wheel=Dash`,
      goodjunk: `Goal: Collect healthy; avoid junk • Combo x4/x8/x12 • Quests active`,
      groups:   `Goal: Match the HUD group • Right +7, Wrong −2 • Target rotates`,
      hydration:`Goal: Keep 💧 45–65% • N=Normalize • G=Guard 5s`,
      plate:    `Goal: Fill plate quotas (Grains/Veg/Protein/Fruit/Dairy)`
    }
  };
  const L = (String(lang).toUpperCase()==='EN') ? T.EN : T.TH;
  const body = (mode==='groups')?L.groups:(mode==='hydration')?L.hydration:(mode==='plate')?L.plate:L.goodjunk;
  return `${body}\n\n${L.kb}`;
}

function showHelp(){
  const help = $('#help'), body = $('#helpBody'), title = $('#h_help');
  if (!help || !body) return;
  const lang = (document.documentElement.getAttribute('data-hha-lang')||'TH').toUpperCase();
  const mode = document.body.getAttribute('data-mode') || 'goodjunk';
  if (title) title.textContent = (lang==='EN' ? 'How to Play' : 'วิธีเล่น');
  body.textContent = howto(lang, mode);
  help.style.display = 'flex';
}
function hideHelp(){ const help=$('#help'); if (help) help.style.display='none'; }

on($('#btn_help'), 'click', ()=> showHelp());
on($('#btn_ok'),   'click', ()=> hideHelp());
// ปิดเมื่อคลิกนอกกล่อง
on($('#help'), 'click', (e)=>{ if (e.target?.id==='help') hideHelp(); });
on(window, 'keydown', (e)=>{ if (e.key==='Escape') hideHelp(); });

// ---------------------------------------------------------
// 3) ปลดล็อกเสียง (autoplay guard) + เมาส์ช่วยกดปุ่มลูกศร (ทางเลือก)
// ---------------------------------------------------------
(function unlockAudioOnce(){
  let unlocked=false;
  const kick=()=>{ 
    if (unlocked) return; unlocked=true;
    ['#sfx-good','#sfx-bad','#sfx-perfect','#sfx-tick','#sfx-powerup','#bgm-main'].forEach(sel=>{
      try{
        const a=$(sel); if(!a) return;
        a.muted=false; a.play().then(()=>{a.pause();a.currentTime=0;}).catch(()=>{});
      }catch{}
    });
    window.removeEventListener('pointerdown',kick,true);
    window.removeEventListener('keydown',kick,true);
    window.removeEventListener('touchstart',kick,true);
  };
  window.addEventListener('pointerdown',kick,true);
  window.addEventListener('keydown',kick,true);
  window.addEventListener('touchstart',kick,true);
})();

// ป้องกัน context menu รบกวนคลิกขวา (ถ้าใช้ RMB=duck)
on(window,'contextmenu',(e)=>e.preventDefault(),{passive:false});

// ---------------------------------------------------------
// 4) Start helper — ถ้าปุ่ม START ไม่ติด ให้เรียกผ่าน HHA_UI.startFlow()
//    (main.js ได้ bind click ไว้อยู่แล้ว; ที่นี่เพียงสำรองส่งคลิก)
// ---------------------------------------------------------
function startFlow(){
  const b = $('#btn_start');
  if (b){
    // ใช้คลิกจริงเพื่อให้ main.js listener ทำงานครบ
    b.click();
  } else {
    // สำรอง: ยิงอีเวนต์เอง (กรณีมี custom listener)
    const ev = new Event('click', {bubbles:true});
    document.dispatchEvent(ev);
  }
}
// bind สำรองแบบ “แรง” เฉพาะปุ่มหลัก
(function bindStartStrong(){
  const b = $('#btn_start'); if (!b) return;
  // ไม่แก้ไข listener ของ main.js แค่เสริม fallback
  if (!b.dataset.uiHook){
    b.dataset.uiHook = '1';
    on(b,'keydown',(e)=>{ if(e.key==='Enter'||e.key===' ') { e.preventDefault(); b.click(); }});
  }
})();

// ---------------------------------------------------------
// 5) ภาษาสลับ (ให้แค่ update data-hha-lang; ส่วน main.js จะจัด label/quests เอง)
// ---------------------------------------------------------
on($('#langToggle'),'click',()=>{
  const cur = (document.documentElement.getAttribute('data-hha-lang')||'TH').toUpperCase();
  const nxt = (cur==='TH'?'EN':'TH');
  document.documentElement.setAttribute('data-hha-lang', nxt);
  try{ localStorage.setItem('hha_lang', nxt); }catch{}
});

// ---------------------------------------------------------
// 6) ตรวจ overlay บังปุ่ม START (เตือนใน console เพื่อ debug)
// ---------------------------------------------------------
(function probeOverlay(){
  setTimeout(()=>{
    const b=$('#btn_start'); if(!b) return;
    const r=b.getBoundingClientRect(); const cx=r.left+r.width/2, cy=r.top+r.height/2;
    const stack=document.elementsFromPoint(cx,cy);
    if(stack && stack[0]!==b) console.warn('[Overlay Detected on Start]', stack[0]);
  },700);
})();

// ---------------------------------------------------------
// 7) สาธารณะ: window.HHA_UI
// ---------------------------------------------------------
window.HHA_UI = {
  startFlow,
  showHelp,
  hideHelp
};
