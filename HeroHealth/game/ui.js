// === Hero Health Academy — game/ui.js (Stage 2.5, SFX singleton) ===
const $  = (s)=>document.querySelector(s);
const $$ = (s)=>document.querySelectorAll(s);
const on = (el,ev,fn,opt)=> el && el.addEventListener(ev,fn,opt||{});

(function ensureLayers(){
  const c=$('#c'); if(c){ c.style.pointerEvents='none'; c.style.zIndex='1'; }
  ['hud','menu','modal','coach','item'].forEach(k=>{
    $$('.'+k).forEach(el=>{
      const z=parseInt(getComputedStyle(el).zIndex||'100',10);
      el.style.pointerEvents='auto'; if(z<100) el.style.zIndex='100';
    });
  });
})();

const UI={ modeKey:'goodjunk', diff:'Normal', lang:'TH',
  seenHelp: JSON.parse(localStorage.getItem('hha_seen_help_per_mode')||'{}') };
(function detectLang(){
  const t=($('#langToggle')?.textContent||'').trim();
  UI.lang=/TH\b/i.test(t)?'TH':(/EN\b/i.test(t)?'EN':'TH');
})();

// ใช้ SFX จาก core/sfx.js
const SFX = window.SFX;

// ปุ่ม/โหมด/ความยาก (ลดซ้ำกับ main — UI แค่แสดงผล)
function bindModeDiffButtons(){
  ['goodjunk','groups','hydration','plate'].forEach(key=>{
    on($('#m_'+key),'click',()=>{ UI.modeKey=key; refreshModeLabel(); document.body.dataset.mode=key; });
  });
  [['Easy','d_easy'],['Normal','d_normal'],['Hard','d_hard']].forEach(([v,id])=>{
    on($('#'+id),'click',()=>{ UI.diff=v; refreshModeLabel(); document.body.dataset.diff=v;
      ['d_easy','d_normal','d_hard'].forEach(i=>$('#'+i)?.classList.remove('active')); $('#'+id)?.classList.add('active');
    });
  });
}
function refreshModeLabel(){
  const mapTH={goodjunk:'ดี vs ขยะ',groups:'จาน 5 หมู่',hydration:'สมดุลน้ำ',plate:'จัดจานสุขภาพ'};
  const mapEN={goodjunk:'Good vs Junk',groups:'5 Food Groups',hydration:'Hydration',plate:'Healthy Plate'};
  const L=UI.lang==='TH'?mapTH:mapEN;
  $('#modeName')&&( $('#modeName').textContent = L[UI.modeKey] );
  const th={Easy:'ง่าย',Normal:'ปกติ',Hard:'ยาก'};
  $('#difficulty')&&( $('#difficulty').textContent = (UI.lang==='TH'?th[UI.diff]:UI.diff) );
}
bindModeDiffButtons(); refreshModeLabel();
document.body.dataset.mode=UI.modeKey; document.body.dataset.diff=UI.diff;

// Unlock เสียงครั้งแรก
(function unlockOnce(){
  let unlocked=false; const kick=()=>{ if(unlocked) return; unlocked=true;
    try{ SFX?.unlock?.(); }catch{}
    ['pointerdown','keydown','touchstart'].forEach(ev=>window.removeEventListener(ev,kick,true));
  };
  ['pointerdown','keydown','touchstart'].forEach(ev=>window.addEventListener(ev,kick,true));
})();

function howto(mode,lang){
  const T={TH:{kb:`คีย์บอร์ด: ↑ กระโดด, ↓ หมอบ, ←/→ แดช, Space=กระโดด, Ctrl=หมอบ
เมาส์: คลิกซ้าย=กระโดด, คลิกขวา=หมอบ, ล้อเมาส์=แดช`,
goodjunk:`เป้าหมาย: เก็บอาหารดี เลี่ยงขยะ • คอมโบ x4/x8/x12 • พลัง: 🛡 กันพลาด / 🌀 ชะลอเวลา / ✨ เติม Fever`,
groups:`เก็บให้ตรง “หมวดบน HUD” (ถูก +7, ผิด −2)`,
hydration:`รักษา 💧 45–65% (N=Normalize, G=Guard 5s)`,
plate:`จัดจานครบโควตา (G2 V2 P1 F1 D1)`},
EN:{kb:`Keyboard: ↑ Jump, ↓ Duck, ←/→ Dash, Space=Jump, Ctrl=Duck
Mouse: LMB=Jump, RMB=Duck, Wheel=Dash`,
goodjunk:`Goal: collect healthy foods; avoid junk. Combo x4/x8/x12. Power-ups: Shield/Slow/Fever heal.`,
groups:`Match the target category on HUD (Right +7 / Wrong −2).`,
hydration:`Keep 💧 45–65% (N=Normalize, G=Guard 5s).`,
plate:`Fill plate quotas (G2 V2 P1 F1 D1).`}};
  const L=(lang==='EN')?T.EN:T.TH;
  if(mode==='goodjunk') return `${L.goodjunk}\n\n${L.kb}`;
  if(mode==='groups')   return `${L.groups}\n\n${L.kb}`;
  if(mode==='hydration')return `${L.hydration}\n\n${L.kb}`;
  if(mode==='plate')    return `${L.plate}\n\n${L.kb}`;
  return `${L.goodjunk}\n\n${L.kb}`;
}

function showHelp(mode=UI.modeKey){
  const help=$('#help'), body=$('#helpBody'), title=$('#h_help');
  if(!help||!body) return; if(title) title.textContent=(UI.lang==='TH'?'วิธีเล่น':'How to Play');
  body.textContent=howto(mode,UI.lang); help.style.display='flex';
}
function hideHelp(){ const help=$('#help'); if(help) help.style.display='none'; }
on($('#btn_help'),'click',()=>{ SFX?.tick?.(); showHelp(UI.modeKey); });
on($('#btn_ok'),'click',()=>{ SFX?.tick?.(); hideHelp(); });
on($('#help'),'click',(e)=>{ if(e.target?.id==='help') hideHelp(); });

async function interactiveTutorial(mode){
  const coach=$('#coachHUD'), text=$('#coachText');
  const say=(t)=>{ if(text) text.textContent=t; if(coach){ coach.classList.add('show'); coach.style.display='flex'; } };
  const hush=()=>{ if(coach){ coach.classList.remove('show'); coach.style.display='none'; } };
  const wait=(ms)=>new Promise(r=>setTimeout(r,ms));
  say(UI.lang==='TH'?'เดโมเริ่มใน 3…':'Demo starts in 3…'); SFX?.tick?.(); await wait(700);
  say('2…'); SFX?.tick?.(); await wait(650);
  say('1…'); SFX?.tick?.(); await wait(650);
  say(UI.lang==='TH'?'พร้อม!':'Ready!'); await wait(600); hush();
}

async function startFlow(){
  const key=UI.modeKey;
  if(!UI.seenHelp[key]){
    showHelp(key);
    await new Promise(res=>{
      const done=()=>{ $('#help')?.removeEventListener('click',ov); $('#btn_ok')?.removeEventListener('click',ok); res(); };
      const ok=()=>{ hideHelp(); done(); };
      const ov=(e)=>{ if(e.target?.id==='help'){ hideHelp(); done(); } };
      on($('#btn_ok'), 'click', ok, {once:true}); on($('#help'),'click',ov);
    });
    UI.seenHelp[key]=true; localStorage.setItem('hha_seen_help_per_mode', JSON.stringify(UI.seenHelp));
  }
  const dk='hha_seen_demo_'+key;
  if(!localStorage.getItem(dk)){ await interactiveTutorial(key); localStorage.setItem(dk,'1'); }
  window.HHA?.startGame?.();
}
(function bindStartStrong(){
  const b=$('#btn_start'); if(!b) return;
  const clone=b.cloneNode(true); b.parentNode.replaceChild(clone,b);
  on(clone,'click',(e)=>{ e.preventDefault(); e.stopPropagation(); startFlow(); },{capture:true});
})();
window.HHA_UI = {
  getMode:()=>UI.modeKey, getDiff:()=>UI.diff, getLang:()=>UI.lang, startFlow,
  setLang(x){ UI.lang=(String(x).toUpperCase()==='EN'?'EN':'TH'); refreshModeLabel(); },
  setMode(k){ if(['goodjunk','groups','hydration','plate'].includes(k)){ UI.modeKey=k; refreshModeLabel(); } },
  setDiff(v){ if(['Easy','Normal','Hard'].includes(v)){ UI.diff=v; refreshModeLabel(); } }
};
