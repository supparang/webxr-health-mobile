// === Hero Health Academy — game/ui.js (Stage 2.5)
const $  = (s)=>document.querySelector(s);
const $$ = (s)=>document.querySelectorAll(s);
const on = (el,ev,fn,opt)=> el && el.addEventListener(ev,fn,opt||{});

/* Keep UI clickable */
(function ensureLayers(){
  const c=$('#c'); if(c){ c.style.pointerEvents='none'; c.style.zIndex='1'; }
  ['hud','menu','modal','coach','item'].forEach(k=>{
    $$('.'+k).forEach(el=>{
      const z=parseInt(getComputedStyle(el).zIndex||'100',10);
      el.style.pointerEvents='auto'; if(z<100) el.style.zIndex='100';
    });
  });
})();

/* Local UI state */
const UI={ modeKey:'goodjunk', diff:'Normal', lang:'TH',
  seenHelp: JSON.parse(localStorage.getItem('hha_seen_help_per_mode')||'{}') };
(function detectLang(){
  const t=($('#langToggle')?.textContent||'').trim();
  UI.lang=/TH\b/i.test(t)?'TH':(/EN\b/i.test(t)?'EN':'TH');
})();

/* Mode/diff bindings */
function bindModeDiffButtons(){
  ['goodjunk','groups','hydration','plate'].forEach(key=>{
    on($('#m_'+key),'click',()=>{
      UI.modeKey=key; refreshModeLabel(); document.body.dataset.mode=key;
      $$('.tile').forEach(t=>t.classList.remove('active')); $('#m_'+key)?.classList.add('active');
    });
  });
  [['Easy','d_easy'],['Normal','d_normal'],['Hard','d_hard']].forEach(([v,id])=>{
    on($('#'+id),'click',()=>{
      UI.diff=v; refreshModeLabel(); document.body.dataset.diff=v;
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

/* Audio */
const play=(sel,opts)=>{ try{ const a=$(sel); if(!a) return; Object.assign(a,opts||{}); a.currentTime=0; a.play().catch(()=>{});}catch{} };
const SFX={ good:()=>play('#sfx-good'), bad:()=>play('#sfx-bad'), perfect:()=>play('#sfx-perfect'),
  tick:()=>play('#sfx-tick'), power:()=>play('#sfx-powerup'),
  bgm:()=>{ const a=$('#bgm-main'); if(a){ a.volume=0.45; a.play().catch(()=>{}); } } };
(function unlockOnce(){
  let unlocked=false; const kick=()=>{ if(unlocked) return; unlocked=true;
    ['#sfx-good','#sfx-bad','#sfx-perfect','#sfx-tick','#sfx-powerup','#bgm-main'].forEach(sel=>{
      try{ const a=$(sel); if(a){ a.muted=false; a.play().then(()=>{a.pause();a.currentTime=0;}).catch(()=>{}); } }catch{}
    });
    window.removeEventListener('pointerdown',kick,true);
    window.removeEventListener('keydown',kick,true);
    window.removeEventListener('touchstart',kick,true);
  };
  window.addEventListener('pointerdown',kick,true);
  window.addEventListener('keydown',kick,true);
  window.addEventListener('touchstart',kick,true);
})();
const vibrate=(p)=>{ try{ navigator.vibrate?.(p);}catch{} };

/* Mouse→keys */
function dispatchKey(key){ const ev=new KeyboardEvent('keydown',{key,bubbles:true}); window.dispatchEvent(ev); }
on(window,'mousedown',(e)=>{ if(e.button===0){dispatchKey('ArrowUp');vibrate(12);} if(e.button===2){dispatchKey('ArrowDown');vibrate(18);}},{passive:false});
on(window,'wheel',(e)=>{ if(e.deltaY<0) dispatchKey('ArrowLeft'); else dispatchKey('ArrowRight'); },{passive:true});
on(window,'contextmenu',(e)=>e.preventDefault(),{passive:false});

/* How-to text */
function howto(mode,lang){
  const T={TH:{kb:`คีย์บอร์ด: ↑ กระโดด, ↓ หมอบ, ←/→ แดช, Space=กระโดด, Ctrl=หมอบ
เมาส์: คลิกซ้าย=กระโดด, คลิกขวา=หมอบ, เลื่อนล้อ=แดช`,
goodjunk:`เป้าหมาย: เก็บอาหารดี 🥦🍎 เลี่ยงขยะ 🍔🍟🥤
คอมโบ: เก็บถูกต่อเนื่องเพิ่มคอมโบ (x4/x8/x12)
ดับเบิลไว: เก็บของดี 2 ชิ้นใน 600ms โบนัสเพิ่ม
ภารกิจย่อย: ดูที่ Mission bar
พาวเวอร์: 🛡️ กันพลาด / 🌀 ชะลอเวลา / ✨ เติม Fever`,
groups:`เป้าหมาย: เก็บให้ตรง “หมวดบน HUD”
ถูก +7, ผิด −2 • เปลี่ยนหมวดทุก 3 ครั้ง หรือ ~10 วิ`,
hydration:`เป้าหมาย: รักษา 💧 45–65%
N=Normalize (55%) • G=Guard 5s`,
plate:`เป้าหมาย: จัดจานครบโควตา (ธัญพืช2 ผัก2 โปรตีน1 ผลไม้1 นม1)`},
EN:{kb:`Keyboard: ↑ Jump, ↓ Duck, ←/→ Dash, Space=Jump, Ctrl=Duck
Mouse: LMB=Jump, RMB=Duck, Wheel=Dash`,
goodjunk:`Goal: Collect healthy foods, avoid junk.
Combo tiers x4/x8/x12. Quick double (600ms) bonus.
Micro-missions on the bar. Power-ups: Shield/Slow/Fever heal.`,
groups:`Goal: Match the target group on HUD (Right +7 / Wrong −2).`,
hydration:`Goal: Keep 💧 45–65% (N=Normalize 55%, G=Guard 5s).`,
plate:`Goal: Fill plate quotas (G2 V2 P1 F1 D1).`}};
  const L=(lang==='EN')?T.EN:T.TH;
  if(mode==='goodjunk') return `${L.goodjunk}\n\n${L.kb}`;
  if(mode==='groups')   return `${L.groups}\n\n${L.kb}`;
  if(mode==='hydration')return `${L.hydration}\n\n${L.kb}`;
  if(mode==='plate')    return `${L.plate}\n\n${L.kb}`;
  return `${L.goodjunk}\n\n${L.kb}`;
}

/* Help modal */
function showHelp(mode=UI.modeKey){
  const help=$('#help'), body=$('#helpBody'), title=$('#h_help');
  if(!help||!body) return; if(title) title.textContent=(UI.lang==='TH'?'วิธีเล่น':'How to Play');
  body.textContent=howto(mode,UI.lang); help.style.display='flex';
}
function hideHelp(){ const help=$('#help'); if(help) help.style.display='none'; }
on($('#btn_help'),'click',()=>{SFX.tick();showHelp(UI.modeKey);});
on($('#btn_ok'),'click',()=>{SFX.tick();hideHelp();});
on($('#help'),'click',(e)=>{ if(e.target?.id==='help') hideHelp(); });
on(window,'keydown',(e)=>{ if(e.key==='Escape') hideHelp(); });

/* Result modal */
function resultRoot(){ return $('#result') || $('#resultModal') || null; }
on(resultRoot(),'click',(e)=>{ const t=e.target; const act=t?.getAttribute?.('data-result')||t?.dataset?.result;
  if(act==='replay'){ resultRoot().style.display='none'; startFlow(); }
  if(act==='home'){   resultRoot().style.display='none'; }});

/* Demo once */
async function interactiveTutorial(mode){
  const coach=$('#coachHUD'), text=$('#coachText');
  const say=(t)=>{ if(text) text.textContent=t; if(coach){ coach.classList.add('show'); coach.style.display='flex'; } };
  const hush=()=>{ if(coach){ coach.classList.remove('show'); coach.style.display='none'; } };
  const wait=(ms)=>new Promise(r=>setTimeout(r,ms));
  const waitKey=(keys,ms=6000)=>new Promise(res=>{
    let done=false; const onKey=(e)=>{ if(done) return; if(keys.includes(e.key)){done=true;window.removeEventListener('keydown',onKey);res(true);} };
    window.addEventListener('keydown',onKey); setTimeout(()=>{ if(!done){window.removeEventListener('keydown',onKey);res(false);} },ms);
  });
  say(UI.lang==='TH'?'เดโมเริ่มใน 3…':'Demo starts in 3…'); SFX.tick(); await wait(700);
  say('2…'); SFX.tick(); await wait(650);
  say('1…'); SFX.tick(); await wait(650);
  if(mode==='goodjunk'){ say(UI.lang==='TH'?'เก็บของดี! กด ↑ เพื่อกระโดด':'Collect healthy foods! Press ↑');
    await waitKey(['ArrowUp',' '],5500); say(UI.lang==='TH'?'ลอง ↓ เพื่อหมอบ':'Try ↓ to duck'); await waitKey(['ArrowDown','Control','Ctrl'],5500);
  } else if(mode==='groups'){ say(UI.lang==='TH'?'ดูหมวดบน HUD แล้วเก็บให้ตรง':'Match the HUD target'); await wait(1200);
  } else if(mode==='hydration'){ say(UI.lang==='TH'?'รักษา 💧 45–65%! กด N เพื่อ Normalize':'Keep 💧 45–65%! Press N');
    await waitKey(['n','N'],5500); say(UI.lang==='TH'?'กด G เพื่อ Guard 5 วินาที':'Press G for 5s Guard'); await waitKey(['g','G'],5500);
  } else if(mode==='plate'){ say(UI.lang==='TH'?'จัดให้ครบ 5 หมู่':'Fill all 5 groups'); await wait(1200); }
  say(UI.lang==='TH'?'เยี่ยม! เริ่มเกมจริง!':'Great! Starting!'); await wait(600); hush();
}

/* Start flow */
async function startFlow(){
  try{ SFX.bgm(); }catch{}
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
  // เรียก main.js
  if(window.preStartFlow){ window.preStartFlow(); }
  else if(window.HHA?.startGame){ window.HHA.startGame({demoPassed:true}); }
  else if(window.start){ window.start({demoPassed:true}); }
}

/* Strong binding */
(function bindStartStrong(){
  const b=$('#btn_start'); if(!b) return;
  const clone=b.cloneNode(true); b.parentNode.replaceChild(clone,b);
  on(clone,'click',(e)=>{ e.preventDefault(); e.stopPropagation(); startFlow(); },{capture:true});
})();
on($('#btn_restart'),'click',()=>{ vibrate(18); try{ window.end?.(true);}catch{} startFlow(); });
on($('#btn_pause'),'click', ()=>{ vibrate(12); try{ window.onPauseIntent?.(); }catch{} });

/* Toggles */
on($('#langToggle'),'click',()=>{ SFX.tick(); UI.lang=(UI.lang==='TH'?'EN':'TH'); refreshModeLabel(); try{ window.onLangSwitch?.(UI.lang);}catch{} });
on($('#gfxToggle'), 'click',()=>{ SFX.tick(); try{ window.onGfxToggle?.(); }catch{} });
on($('#soundToggle'),'click',()=>{ SFX.tick(); try{ window.onSoundToggle?.(); }catch{} });

/* Blur/focus → main */
on(window,'blur', ()=>{ try{ window.onAppBlur?.(); }catch{} });
on(window,'focus',()=>{ try{ window.onAppFocus?.(); }catch{} });

/* Debug overlay probe */
(function probeOverlay(){
  setTimeout(()=>{
    const b=$('#btn_start'); if(!b) return;
    const r=b.getBoundingClientRect(); const cx=r.left+r.width/2, cy=r.top+r.height/2;
    const stack=document.elementsFromPoint(cx,cy);
    if(stack && stack[0]!==b) console.warn('[Overlay Detected on Start]', stack[0]);
  },600);
})();

/* Public API */
window.HHA_UI={
  getMode:()=>UI.modeKey, getDiff:()=>UI.diff, getLang:()=>UI.lang, startFlow,
  setLang(x){ UI.lang=(String(x).toUpperCase()==='EN'?'EN':'TH'); refreshModeLabel(); },
  setMode(k){ if(['goodjunk','groups','hydration','plate'].includes(k)){ UI.modeKey=k; refreshModeLabel(); } },
  setDiff(v){ if(['Easy','Normal','Hard'].includes(v)){ UI.diff=v; refreshModeLabel(); } }
};
