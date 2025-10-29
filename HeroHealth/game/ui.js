// === Hero Health Academy — game/ui.js (Stage 3.0) ===
const $  = (s)=>document.querySelector(s);
const $$ = (s)=>document.querySelectorAll(s);
const on = (el,ev,fn,opt)=> el && el.addEventListener(ev,fn,opt||{});

/* -----------------------------------------------
 * Layer fixes (keep UI clickable above canvas)
 * ----------------------------------------------- */
(function ensureLayers(){
  const c=$('#c'); if(c){ c.style.pointerEvents='none'; c.style.zIndex='1'; }
  ['hud','menu','modal','coach','item'].forEach(k=>{
    $$('.'+k).forEach(el=>{
      const z=parseInt(getComputedStyle(el).zIndex||'100',10);
      el.style.pointerEvents='auto'; if(z<100) el.style.zIndex='100';
    });
  });
})();

/* -----------------------------------------------
 * Local UI state (+ persistence)
 * ----------------------------------------------- */
const UI = {
  modeKey: 'goodjunk',
  diff: 'Normal',
  lang: 'TH',
  seenHelp: JSON.parse(localStorage.getItem('hha_seen_help_per_mode')||'{}'),
  soundOn: (localStorage.getItem('hha_sound')!=='0')
};

// init language from toggle text or storage
(function initLang(){
  const saved = (localStorage.getItem('hha_lang')||'').toUpperCase();
  if (saved==='TH' || saved==='EN') UI.lang=saved; else {
    const t=($('#langToggle')?.textContent||'').trim();
    UI.lang=/TH\b/i.test(t)?'TH':(/EN\b/i.test(t)?'EN':'TH');
  }
})();

/* -----------------------------------------------
 * Mode & difficulty bindings
 * ----------------------------------------------- */
function bindModeDiffButtons(){
  ['goodjunk','groups','hydration','plate'].forEach(key=>{
    on($('#m_'+key),'click',()=>{
      UI.modeKey=key; refreshModeLabel(); document.body.dataset.mode=key;
      $$('.tile').forEach(t=>t.classList.remove('active')); $('#m_'+key)?.classList.add('active');
      try{ window.onModeSwitch?.(key); }catch{}
    });
  });
  [['Easy','d_easy'],['Normal','d_normal'],['Hard','d_hard']].forEach(([v,id])=>{
    on($('#'+id),'click',()=>{
      UI.diff=v; refreshModeLabel(); document.body.dataset.diff=v;
      ['d_easy','d_normal','d_hard'].forEach(i=>$('#'+i)?.classList.remove('active')); $('#'+id)?.classList.add('active');
      try{ window.onDiffSwitch?.(v); }catch{}
    });
  });
}
function refreshModeLabel(){
  const mapTH={goodjunk:'ดี vs ขยะ',groups:'จาน 5 หมู่',hydration:'สมดุลน้ำ',plate:'จัดจานสุขภาพ'};
  const mapEN={goodjunk:'Good vs Junk',groups:'5 Food Groups',hydration:'Hydration',plate:'Healthy Plate'};
  const L=UI.lang==='TH'?mapTH:mapEN;
  $('#modeName') && ($('#modeName').textContent = L[UI.modeKey]);
  const th={Easy:'ง่าย',Normal:'ปกติ',Hard:'ยาก'};
  $('#difficulty') && ($('#difficulty').textContent = (UI.lang==='TH'?th[UI.diff]:UI.diff));
  // reflect on <html data-lang> for CSS if needed
  try{ document.documentElement.setAttribute('data-lang', UI.lang); }catch{}
}
bindModeDiffButtons(); refreshModeLabel();
document.body.dataset.mode=UI.modeKey; document.body.dataset.diff=UI.diff;

/* -----------------------------------------------
 * SFX helper (backed by SFX singleton if present)
 * ----------------------------------------------- */
const play=(sel,opts)=>{ try{ const a=$(sel); if(!a) return; Object.assign(a,opts||{}); a.currentTime=0; a.play().catch(()=>{});}catch{} };
const SFXH = {
  good:   ()=> (window.SFX?.good?.()    ?? play('#sfx-good')),
  bad:    ()=> (window.SFX?.bad?.()     ?? play('#sfx-bad')),
  perfect:()=> (window.SFX?.perfect?.() ?? play('#sfx-perfect')),
  tick:   ()=> (window.SFX?.tick?.()    ?? play('#sfx-tick')),
  power:  ()=> (window.SFX?.power?.()   ?? play('#sfx-powerup')),
  bgm:    ()=> {
    if (window.SFX?.isEnabled) { /* let SFX manage */ }
    const a=$('#bgm-main'); if(a){ a.volume=0.45; a.play().catch(()=>{}); }
  },
  setEnabled(on){
    try{
      if (window.SFX?.setEnabled) window.SFX.setEnabled(on);
      UI.soundOn = !!on;
      localStorage.setItem('hha_sound', on?'1':'0');
      const btn=$('#soundToggle'); if(btn){ btn.dataset.on = on?'1':'0'; btn.classList.toggle('off', !on); }
      toast(on ? (UI.lang==='TH'?'เสียง: เปิด':'Sound: On') : (UI.lang==='TH'?'เสียง: ปิด':'Sound: Off'));
    }catch{}
  }
};

// mobile unlock once
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

/* -----------------------------------------------
 * Utility: toast via HUD if available
 * ----------------------------------------------- */
function toast(text){
  try{
    // HUD class has toast()
    if (window.HHA?.hud?.toast) { window.HHA.hud.toast(String(text)); return; }
  }catch{}
  // fallback mini toast
  let t = $('#toast'); if(!t){ t=document.createElement('div'); t.id='toast'; t.className='toast'; document.body.appendChild(t); }
  t.textContent=String(text||''); t.style.display='block';
  t.classList.remove('show'); t.offsetHeight; t.classList.add('show');
  clearTimeout(t._t); t._t=setTimeout(()=>{ t.classList.remove('show'); t.style.display='none'; }, 1200);
}

/* -----------------------------------------------
 * Pointer/mouse → keys (kept, with guards)
 * ----------------------------------------------- */
function dispatchKey(key){ const ev=new KeyboardEvent('keydown',{key,bubbles:true}); window.dispatchEvent(ev); }
on(window,'mousedown',(e)=>{ if(e.button===0){dispatchKey('ArrowUp'); navigator.vibrate?.(12);} if(e.button===2){dispatchKey('ArrowDown'); navigator.vibrate?.(18);}},{passive:false});
on(window,'wheel',(e)=>{ if(e.deltaY<0) dispatchKey('ArrowLeft'); else dispatchKey('ArrowRight'); },{passive:true});
on(window,'contextmenu',(e)=>e.preventDefault(),{passive:false});

/* -----------------------------------------------
 * How-to text (updated for shield/slow/fever)
 * ----------------------------------------------- */
function howto(mode,lang){
  const T={TH:{kb:`คีย์บอร์ด: ↑ กระโดด, ↓ หมอบ, ←/→ แดช, Space=กระโดด, Ctrl=หมอบ
เมาส์: คลิกซ้าย=กระโดด, คลิกขวา=หมอบ, ล้อเมาส์=แดช`,
goodjunk:`เป้าหมาย: เก็บอาหารดี 🥦🍎 เลี่ยงขยะ 🍔🍟🥤
คอมโบ: ต่อเนื่องเพิ่มคอมโบ (x4/x8/x12), ดับเบิลไว 600ms ได้โบนัส
พลัง: 🛡 กันพลาด 1 ครั้ง • 🌀 ชะลอเวลา • ✨ เติม Fever • ×2 คะแนน
ภารกิจย่อย: ดูที่ Mission bar`,
groups:`เป้าหมาย: เก็บให้ตรงหมวดบน HUD (ถูก +7 ผิด −2) • เปลี่ยนหมวดเป็นจังหวะ`,
hydration:`เป้าหมาย: รักษา 💧 45–65%
N=Normalize (55%) • G=Guard 5s • หลีกเลี่ยง HIGH`,
plate:`เป้าหมาย: จัดจานครบโควตา (ธัญพืช2 ผัก2 โปรตีน1 ผลไม้1 นม1)`},
EN:{kb:`Keyboard: ↑ Jump, ↓ Duck, ←/→ Dash, Space=Jump, Ctrl=Duck
Mouse: LMB=Jump, RMB=Duck, Wheel=Dash`,
goodjunk:`Goal: Collect healthy foods, avoid junk.
Combos x4/x8/x12; quick double (≤600ms) bonus.
Power-ups: 🛡 Shield (ignore 1 miss) • 🌀 Slow • ✨ Fever heal • ×2 score.
Micro-missions shown on the Mission bar.`,
groups:`Goal: Match the HUD target (Right +7 / Wrong −2) • Target rotates`,
hydration:`Goal: Keep 💧 45–65%.
N=Normalize (55%), G=Guard 5s, avoid HIGH.`,
plate:`Goal: Fill plate quotas (G2 V2 P1 F1 D1).`}};
  const L=(lang==='EN')?T.EN:T.TH;
  if(mode==='goodjunk') return `${L.goodjunk}\n\n${L.kb}`;
  if(mode==='groups')   return `${L.groups}\n\n${L.kb}`;
  if(mode==='hydration')return `${L.hydration}\n\n${L.kb}`;
  if(mode==='plate')    return `${L.plate}\n\n${L.kb}`;
  return `${L.goodjunk}\n\n${L.kb}`;
}

/* -----------------------------------------------
 * Help modal
 * ----------------------------------------------- */
function showHelp(mode=UI.modeKey){
  const help=$('#help'), body=$('#helpBody'), title=$('#h_help');
  if(!help||!body) return; if(title) title.textContent=(UI.lang==='TH'?'วิธีเล่น':'How to Play');
  body.textContent=howto(mode,UI.lang); help.style.display='flex';
}
function hideHelp(){ const help=$('#help'); if(help) help.style.display='none'; }
on($('#btn_help'),'click',()=>{ SFXH.tick(); showHelp(UI.modeKey); });
on($('#btn_ok'),'click',()=>{ SFXH.tick(); hideHelp(); });
on($('#help'),'click',(e)=>{ if(e.target?.id==='help') hideHelp(); });
on(window,'keydown',(e)=>{ if(e.key==='Escape') hideHelp(); });

/* -----------------------------------------------
 * Result modal actions
 * ----------------------------------------------- */
function resultRoot(){ return $('#result') || $('#resultModal') || null; }
on(resultRoot(),'click',(e)=>{
  const t=e.target; const act=t?.getAttribute?.('data-result')||t?.dataset?.result;
  if(act==='replay'){ resultRoot().style.display='none'; startFlow(); }
  if(act==='home'){   resultRoot().style.display='none'; }
});

/* -----------------------------------------------
 * Interactive demo (first time per mode)
 * ----------------------------------------------- */
async function interactiveTutorial(mode){
  const coach=$('#coachHUD'), text=$('#coachText');
  const say=(t)=>{ if(text) text.textContent=t; if(coach){ coach.classList.add('show'); coach.style.display='flex'; } };
  const hush=()=>{ if(coach){ coach.classList.remove('show'); coach.style.display='none'; } };
  const wait=(ms)=>new Promise(r=>setTimeout(r,ms));
  const waitKey=(keys,ms=6000)=>new Promise(res=>{
    let done=false; const onKey=(e)=>{ if(done) return; if(keys.includes(e.key)){done=true;window.removeEventListener('keydown',onKey);res(true);} };
    window.addEventListener('keydown',onKey); setTimeout(()=>{ if(!done){window.removeEventListener('keydown',onKey);res(false);} },ms);
  });
  say(UI.lang==='TH'?'เดโมเริ่มใน 3…':'Demo starts in 3…'); SFXH.tick(); await wait(700);
  say('2…'); SFXH.tick(); await wait(650);
  say('1…'); SFXH.tick(); await wait(650);
  if(mode==='goodjunk'){ say(UI.lang==='TH'?'เก็บของดี! กด ↑ เพื่อกระโดด':'Collect healthy foods! Press ↑');
    await waitKey(['ArrowUp',' '],5500); say(UI.lang==='TH'?'ลอง ↓ เพื่อหมอบ':'Try ↓ to duck'); await waitKey(['ArrowDown','Control','Ctrl'],5500);
  } else if(mode==='groups'){ say(UI.lang==='TH'?'ดูหมวดบน HUD แล้วเก็บให้ตรง':'Match the HUD target'); await wait(1200);
  } else if(mode==='hydration'){ say(UI.lang==='TH'?'รักษา 💧 45–65%! กด N เพื่อ Normalize':'Keep 💧 45–65%! Press N');
    await waitKey(['n','N'],5500); say(UI.lang==='TH'?'กด G เพื่อ Guard 5 วินาที':'Press G for 5s Guard'); await waitKey(['g','G'],5500);
  } else if(mode==='plate'){ say(UI.lang==='TH'?'จัดให้ครบ 5 หมวด':'Fill all 5 groups'); await wait(1200); }
  say(UI.lang==='TH'?'เยี่ยม! เริ่มเกมจริง!':'Great! Starting!'); await wait(600); hush();
}

/* -----------------------------------------------
 * Start flow
 * ----------------------------------------------- */
async function startFlow(){
  try{ SFXH.bgm(); }catch{}
  const key=UI.modeKey;

  // one-time help per mode
  if(!UI.seenHelp[key]){
    showHelp(key);
    await new Promise(res=>{
      const done=()=>{ $('#help')?.removeEventListener('click',ov); $('#btn_ok')?.removeEventListener('click',ok); res(); };
      const ok =()=>{ hideHelp(); done(); };
      const ov =(e)=>{ if(e.target?.id==='help'){ hideHelp(); done(); } };
      on($('#btn_ok'),'click',ok,{once:true}); on($('#help'),'click',ov);
    });
    UI.seenHelp[key]=true; localStorage.setItem('hha_seen_help_per_mode', JSON.stringify(UI.seenHelp));
  }

  // short tutorial once per mode
  const dk='hha_seen_demo_'+key;
  if(!localStorage.getItem(dk)){ await interactiveTutorial(key); localStorage.setItem(dk,'1'); }

  // preStart hook / main entry
  if(window.preStartFlow){ window.preStartFlow(); }
  else if(window.HHA?.startGame){ window.HHA.startGame({demoPassed:true, mode:key, diff:UI.diff, lang:UI.lang}); }
  else if(window.start){ window.start({demoPassed:true, mode:key, diff:UI.diff, lang:UI.lang}); }
}

/* Strong binding to start */
(function bindStartStrong(){
  const b=$('#btn_start'); if(!b) return;
  const clone=b.cloneNode(true); b.parentNode.replaceChild(clone,b);
  on(clone,'click',(e)=>{ e.preventDefault(); e.stopPropagation(); startFlow(); },{capture:true});
})();
on($('#btn_restart'),'click',()=>{ navigator.vibrate?.(18); try{ window.end?.(true);}catch{} startFlow(); });
on($('#btn_pause'),'click', ()=>{ navigator.vibrate?.(12); try{ window.onPauseIntent?.(); }catch{} });

/* -----------------------------------------------
 * Toggles & XR hook
 * ----------------------------------------------- */
on($('#langToggle'),'click',()=>{
  SFXH.tick();
  UI.lang=(UI.lang==='TH'?'EN':'TH');
  localStorage.setItem('hha_lang', UI.lang);
  refreshModeLabel();
  try{ window.onLangSwitch?.(UI.lang);}catch{}
});

on($('#gfxToggle'),'click',()=>{ SFXH.tick(); try{ window.onGfxToggle?.(); }catch{} });

on($('#soundToggle'),'click',()=>{
  const now = !(UI.soundOn);
  SFXH.setEnabled(now);
  try{ window.onSoundToggle?.(now); }catch{}
});

// XR toggle (optional button with id="btn_vr")
on($('#btn_vr'),'click',async ()=>{
  try{
    SFXH.tick();
    if (window.VRInput?.toggleVR){ await window.VRInput.toggleVR(); }
    toast(window.VRInput?.isXRActive?.() ? (UI.lang==='TH'?'เข้าสู่ VR':'Entered VR') : (UI.lang==='TH'?'ออกจาก VR':'Exited VR'));
  }catch(e){ console.warn('[UI] VR toggle fail', e); toast('VR not available'); }
});

/* -----------------------------------------------
 * Blur/focus → main hooks
 * ----------------------------------------------- */
on(window,'blur', ()=>{ try{ window.onAppBlur?.(); }catch{} });
on(window,'focus',()=>{ try{ window.onAppFocus?.(); }catch{} });

/* -----------------------------------------------
 * Debug overlay probe
 * ----------------------------------------------- */
(function probeOverlay(){
  setTimeout(()=>{
    const b=$('#btn_start'); if(!b) return;
    const r=b.getBoundingClientRect(); const cx=r.left+r.width/2, cy=r.top+r.height/2;
    const stack=document.elementsFromPoint(cx,cy);
    if(stack && stack[0]!==b) console.warn('[Overlay Detected on Start]', stack[0]);
  },600);
})();

/* -----------------------------------------------
 * Optional: quick power-up buttons (for QA/dev)
 * Any element with data-power="x2|freeze|sweep|boost|shield"
 * ----------------------------------------------- */
$$('[data-power]').forEach(el=>{
  on(el,'click',()=>{
    const k=el.dataset.power;
    try{
      if (window.HHA?.power?.applyStack) {
        if (k==='shield') window.HHA.power.applyStack('shield', 1); // one layer
        else window.HHA.power.apply(k);
        SFXH.power();
        toast((UI.lang==='TH'?'พลัง: ':'Power: ')+k);
      } else if (window.HHA?.power?.apply) {
        window.HHA.power.apply(k);
        SFXH.power();
      }
    }catch(e){ console.warn('[UI] power apply fail', e); }
  });
});

/* -----------------------------------------------
 * Public API
 * ----------------------------------------------- */
window.HHA_UI = {
  getMode:()=>UI.modeKey, getDiff:()=>UI.diff, getLang:()=>UI.lang, startFlow,
  setLang(x){ UI.lang=(String(x).toUpperCase()==='EN'?'EN':'TH'); localStorage.setItem('hha_lang',UI.lang); refreshModeLabel(); },
  setMode(k){ if(['goodjunk','groups','hydration','plate'].includes(k)){ UI.modeKey=k; refreshModeLabel(); } },
  setDiff(v){ if(['Easy','Normal','Hard'].includes(v)){ UI.diff=v; refreshModeLabel(); } },
  sound(on){ SFXH.setEnabled(!!on); },
  toast
};
