// game/ui.js — Stage 2: How-to-Play per mode + Interactive Tutorial + robust UI bindings

const $  = (s)=>document.querySelector(s);
const $$ = (s)=>document.querySelectorAll(s);

// ===== Ensure UI always clickable (canvas never blocks) =====
(function ensureLayers(){
  const c = $('#c'); if(c){ c.style.pointerEvents='none'; c.style.zIndex='1'; }
  ['hud','menu','modal','coach','item'].forEach(cls=>{
    document.querySelectorAll('.'+cls).forEach(el=>{
      const z = parseInt(getComputedStyle(el).zIndex || '100', 10);
      el.style.pointerEvents='auto';
      if (z < 100) el.style.zIndex = '100';
    });
  });
})();

// ===== Local UI state =====
const UI = {
  modeKey: 'goodjunk',       // track mode from clicks
  diff: 'Normal',
  lang: 'TH',
  seenHelp: JSON.parse(localStorage.getItem('hha_seen_help_per_mode')||'{}'), // {goodjunk:true}
};

// detect language from #langToggle initial text (fallback TH)
(function detectLang(){
  const txt = $('#langToggle')?.textContent || '';
  UI.lang = /TH/.test(txt) ? 'TH' : 'EN'; // crude but works; main.js จะ sync เองเมื่อกดปุ่ม
})();

// ===== Mode selectors tracking =====
function bindModeDiffButtons(){
  // mode
  ['goodjunk','groups','hydration','plate'].forEach(key=>{
    const el = $('#m_'+key);
    el?.addEventListener('click', ()=>{ UI.modeKey = key; refreshModeLabel(); });
  });
  // difficulty
  [['Easy','d_easy'],['Normal','d_normal'],['Hard','d_hard']].forEach(([v, id])=>{
    $('#'+id)?.addEventListener('click', ()=>{ UI.diff=v; refreshModeLabel(); });
  });
}
function refreshModeLabel(){
  // ให้สอดคล้องกับ label ที่หน้า HTML แสดงอยู่
  const mapTH = { goodjunk:'ดี vs ขยะ', groups:'จาน 5 หมู่', hydration:'สมดุลน้ำ', plate:'จัดจานสุขภาพ' };
  const mapEN = { goodjunk:'Good vs Junk', groups:'5 Food Groups', hydration:'Hydration', plate:'Healthy Plate' };
  const L = UI.lang==='TH' ? mapTH : mapEN;
  $('#modeName') && ($('#modeName').textContent = L[UI.modeKey]);
  $('#difficulty') && ($('#difficulty').textContent = UI.diff==='Normal' ? (UI.lang==='TH'?'ปกติ':'Normal') :
                                             UI.diff==='Easy'   ? (UI.lang==='TH'?'ง่าย':'Easy') :
                                                                  (UI.lang==='TH'?'ยาก':'Hard'));
}
bindModeDiffButtons(); refreshModeLabel();

// ===== Audio helpers =====
const play = (sel,opts)=>{ try{ const a=$(sel); if(!a) return; Object.assign(a,opts||{}); a.currentTime=0; a.play(); }catch{} };
const SFX = {
  good: ()=>play('#sfx-good'),
  bad: ()=>play('#sfx-bad'),
  perfect: ()=>play('#sfx-perfect'),
  tick: ()=>play('#sfx-tick'),
  power: ()=>play('#sfx-powerup'),
  bgm: ()=>{ const a=$('#bgm-main'); if(a){ a.volume=0.45; a.play().catch(()=>{}); } },
};
const vibrate = (p)=>{ try{ navigator.vibrate?.(p); }catch{} };

// ===== Key dispatch (mouse mapping stays) =====
function dispatchKey(key){
  const ev = new KeyboardEvent('keydown', {key, bubbles:true});
  window.dispatchEvent(ev);
}
window.addEventListener('mousedown', (e)=>{
  if(e.button===0) { dispatchKey('ArrowUp');   vibrate(12); }
  if(e.button===2) { dispatchKey('ArrowDown'); vibrate(18); }
});
window.addEventListener('wheel', (e)=>{ if(e.deltaY<0) dispatchKey('ArrowLeft'); else dispatchKey('ArrowRight'); });
window.addEventListener('contextmenu', (e)=>{ e.preventDefault(); }, {passive:false});

// ===== How-to-Play content (per mode, TH/EN) =====
function howto(mode, lang){
  const T = {
    TH:{
      kb:`คีย์บอร์ด: ↑ Jump, ↓ Duck, ←/→ Dash, Space=Jump, Ctrl=Duck
เมาส์: คลิกซ้าย=Jump, คลิกขวา=Duck, เลื่อนล้อ=Dash`,
      goodjunk:`เป้าหมาย: เก็บอาหารที่ดี 🥦🍎 และหลีกเลี่ยงของขยะ 🍔🍟🥤
คอมโบ: เก็บถูกต่อเนื่องจะเพิ่มคอมโบ (x4/x8/x12 มีโบนัสขั้น)
Quick Double: เก็บของดี 2 ชิ้นภายใน 600ms ได้โบนัสเพิ่ม
ภารกิจย่อย: โผล่บนแถบ Mission (เช่น เก็บดี 8 ชิ้นใน 15s)
พาวเวอร์: 🛡️ กันพลาด / 🌀 ชะลอเวลา / ✨ เติม Fever`,
      groups:`เป้าหมาย: เก็บให้ตรง “หมวดที่ HUD ระบุ”
ถูก +7, ผิด -2 • ทุก 3 ครั้งเปลี่ยนหมวด หรือทุก ~10 วิ`,
      hydration:`เป้าหมาย: รักษาสมดุลน้ำ 45–65%
เครื่องดื่ม:
• 💧 น้ำเปล่า/แร่: เพิ่ม% ทันที (บางชนิดมีค่อยๆ เพิ่มต่อเนื่อง)
• 🥤 น้ำหวาน/☕ กาแฟ: ลด%
กติกาพิเศษ: ถ้า % > 65 แล้วดื่ม 🥤 = ได้คะแนน, ถ้า % < 45 ดื่ม 🥤 = หักคะแนน
ปุ่มเสริม: N = Normalize (55%) คูลดาวน์ 25s • G = Guard 5s`,
      plate:`เป้าหมาย: จัดจานให้ครบโควตา (ธัญพืช2 ผัก2 โปรตีน1 ผลไม้1 นม1)
ครบทั้งหมด “Perfect Plate!” ได้โบนัสสูง • เกินโควตาลดเวลา/คะแนนเล็กน้อย`
    },
    EN:{
      kb:`Keyboard: ↑ Jump, ↓ Duck, ←/→ Dash, Space=Jump, Ctrl=Duck
Mouse: LMB=Jump, RMB=Duck, Wheel=Dash`,
      goodjunk:`Goal: Collect healthy foods 🥦🍎, avoid junk 🍔🍟🥤
Combo: Continuous hits raise combo (x4/x8/x12 tier bonuses)
Quick Double: Two healthy hits within 600ms = extra bonus
Micro-missions: appear on Mission bar
Power-ups: 🛡️ Shield / 🌀 Slow-Time / ✨ Heal Fever`,
      groups:`Goal: Match the “target group” shown on HUD
Right +7, Wrong -2 • Target changes every 3 corrects or ~10s`,
      hydration:`Goal: Keep hydration 45–65%
Drinks:
• 💧 Water/Mineral: increases instantly (some add over-time)
• 🥤 Sugary/☕ Coffee: decreases
Special rule: If % > 65 then 🥤 = +score; if % < 45 then 🥤 = -score
Extra: N = Normalize (55%) cd 25s • G = Guard 5s`,
      plate:`Goal: Fill plate quotas (Grain2 Veg2 Protein1 Fruit1 Dairy1)
Complete all for “Perfect Plate!” bonus • Overfill reduces time/score slightly`
    }
  };
  const L = (lang==='EN') ? T.EN : T.TH;
  if (mode==='goodjunk')  return `${L.goodjunk}\n\n${L.kb}`;
  if (mode==='groups')    return `${L.groups}\n\n${L.kb}`;
  if (mode==='hydration') return `${L.hydration}\n\n${L.kb}`;
  if (mode==='plate')     return `${L.plate}\n\n${L.kb}`;
  return `${L.goodjunk}\n\n${L.kb}`;
}

// ===== Help modal handlers =====
function showHelp(mode=UI.modeKey){
  const help = $('#help'); const body = $('#helpBody'); const title = $('#h_help');
  if (help && body){
    if(title) title.textContent = (UI.lang==='TH'?'วิธีเล่น':'How to Play');
    body.textContent = howto(mode, UI.lang);
    help.style.display='flex';
  }
}
function hideHelp(){ const help=$('#help'); if(help) help.style.display='none'; }
$('#btn_help')?.addEventListener('click', ()=> showHelp(UI.modeKey));
$('#btn_ok')?.addEventListener('click', ()=> hideHelp());

// ===== Result modal: replay/home =====
$('#result')?.addEventListener('click', (e)=>{
  const a=e.target.getAttribute('data-result');
  if(a==='replay'){ $('#result').style.display='none'; startFlow(); }
  if(a==='home'){   $('#result').style.display='none'; }
});

// ===== Pre-start interactive tutorial (per mode, once) =====
async function interactiveTutorial(mode){
  // coach bubble (re-use coachHUD)
  const coach = $('#coachHUD'); const text = $('#coachText');
  const say = (t)=>{ if(text) text.textContent=t; if(coach) coach.classList.add('show'); };
  const hush= ()=>{ if(coach) coach.classList.remove('show'); };

  const wait = (ms)=>new Promise(r=>setTimeout(r,ms));
  const waitForKey=(keys,ms=6000)=> new Promise(res=>{
    let done=false; function onKey(e){ if(done) return; if(keys.includes(e.key)){ done=true; window.removeEventListener('keydown',onKey); res(true);} }
    window.addEventListener('keydown',onKey); setTimeout(()=>{ if(!done){ window.removeEventListener('keydown',onKey); res(false); } }, ms);
  });

  // sequence
  say(UI.lang==='TH'?'เดโมเริ่มใน 3…':'Demo starts in 3…'); SFX.tick(); await wait(700);
  say('2…'); SFX.tick(); await wait(650);
  say('1…'); SFX.tick(); await wait(650);

  // minimal tutorial per mode
  if (mode==='goodjunk'){
    say(UI.lang==='TH'?'เก็บของดี (ไอคอนผัก/ผลไม้)! กด ↑ เพื่อ Jump':'Collect healthy foods! Press ↑ to Jump');
    await waitForKey(['ArrowUp',' '], 5500);
    say(UI.lang==='TH'?'ลอง ↓ เพื่อ Duck':'Try ↓ to Duck'); await waitForKey(['ArrowDown','Control','Ctrl'], 5500);
  } else if (mode==='groups'){
    say(UI.lang==='TH'?'ดูเป้าหมายหมวดบน HUD แล้วเก็บให้ตรง':'Match target group shown on HUD');
    await wait(1200);
  } else if (mode==='hydration'){
    say(UI.lang==='TH'?'รักษาค่า 💧 45–65%! กด N เพื่อ Normalize':'Keep 💧 45–65%! Press N to Normalize');
    await waitForKey(['n','N'], 5500);
    say(UI.lang==='TH'?'กด G เพื่อ Guard 5 วินาที':'Press G for 5s Guard'); await waitForKey(['g','G'], 5500);
  } else if (mode==='plate'){
    say(UI.lang==='TH'?'จัดให้ครบโควตาอาหาร 5 หมู่':'Fill all 5 food quotas'); await wait(1200);
  }

  say(UI.lang==='TH'?'เยี่ยม! เริ่มเกมจริง!':'Great! Starting the game!');
  await wait(600);
  hush();
}

// ===== Start flow: show help (once/mode) -> tutorial (once/mode) -> start =====
async function startFlow(){
  SFX.bgm();
  const key = UI.modeKey;
  // Show help once per mode
  if (!UI.seenHelp[key]){
    showHelp(key);
    // wait until user closes help
    await new Promise(res=>{
      const fn=()=>{ $('#help')?.removeEventListener('click',onOverlay); $('#btn_ok')?.removeEventListener('click',onOk); res(); };
      const onOk = ()=>{ hideHelp(); fn(); };
      const onOverlay=(e)=>{ if(e.target.id==='help') { hideHelp(); fn(); } };
      $('#btn_ok')?.addEventListener('click', onOk, {once:true});
      $('#help')?.addEventListener('click', onOverlay);
    });
    UI.seenHelp[key]=true;
    localStorage.setItem('hha_seen_help_per_mode', JSON.stringify(UI.seenHelp));
  }
  // Tutorial once per mode
  if (!localStorage.getItem('hha_seen_demo_'+key)){
    await interactiveTutorial(key);
    localStorage.setItem('hha_seen_demo_'+key, '1');
  }
  // Call game start in main.js
  if (window.preStartFlow) { window.preStartFlow(); } // ถ้าคุณคงไว้
  else if (window.start)   { window.start(); }
}

// ===== Buttons =====
(function bindStartStrong(){
  const b = document.getElementById('btn_start');
  if (!b) return;
  // ล้างแล้ว bind ใหม่
  const clone = b.cloneNode(true);
  b.parentNode.replaceChild(clone, b);
  clone.addEventListener('click', (e)=>{
    e.preventDefault(); e.stopPropagation();
    // ใช้ startFlow ของ ui.js ถ้ามี
    if (typeof startFlow === 'function') startFlow();
    else if (window.preStartFlow) window.preStartFlow();
    else if (window.HHA?.startGame) window.HHA.startGame({demoPassed:true});
    else if (window.start) window.start({demoPassed:true});
  }, {capture:true});
})();
$('#btn_restart')?.addEventListener('click', ()=>{ vibrate(18); if(window.end) window.end(true); startFlow(); });
$('#btn_pause')?.addEventListener('click', ()=>{ vibrate(12); /* main.js รับไปจัดการต่อ */ });

// ===== Language/GFX/Sound toggles — ping sfx =====
$('#langToggle')?.addEventListener('click', ()=>{ SFX.tick(); UI.lang = (UI.lang==='TH'?'EN':'TH'); refreshModeLabel(); });
$('#gfxToggle') ?.addEventListener('click', ()=> SFX.tick());
$('#soundToggle')?.addEventListener('click', ()=> SFX.tick());

// ===== Debug overlay guard: log if something sits on top of Start =====
(function probeOverlay(){
  setTimeout(()=>{
    const b = $('#btn_start'); if(!b) return;
    const r = b.getBoundingClientRect(); const cx=r.left+r.width/2, cy=r.top+r.height/2;
    const stack = document.elementsFromPoint(cx, cy);
    if(stack && stack[0] !== b){ console.warn('[Overlay Detected on Start]', stack[0]); }
  }, 600);
})();
