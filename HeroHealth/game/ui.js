// game/ui.js
// Stage 1 UI controller: คลิกเมนู, ฮาปติก, แมปเมาส์→คีย์, ทิวทอเรียลสั้น
const $  = (s)=>document.querySelector(s);
const $$ = (s)=>document.querySelectorAll(s);

// ป้องกัน Canvas บังคลิก
(function ensureLayers(){
  const c = $('#c'); if(c){ c.style.pointerEvents='none'; c.style.zIndex='1'; }
  ['hud','menu','modal','coach','item'].forEach(cls=>{
    document.querySelectorAll('.'+cls).forEach(el=>{
      el.style.pointerEvents='auto'; el.style.zIndex= getComputedStyle(el).zIndex || '100';
    });
  });
})();

const state = { ui:'menu', lang:'TH', sound:true };

// เครื่องมือ
const vibrate = (p)=> { try{ navigator.vibrate?.(p); }catch{} };
const play = (id,opts)=>{ try{ const a=$(id); if(a){ Object.assign(a,opts||{}); a.currentTime=0; a.play(); } }catch{} };
const playSFX = (key)=> {
  if(key==='good')   play('#sfx-good');
  if(key==='bad')    play('#sfx-bad');
  if(key==='perfect')play('#sfx-perfect');
  if(key==='tick')   play('#sfx-tick');
  if(key==='power')  play('#sfx-powerup');
};
const playBGM = ()=>{ const a=$('#bgm-main'); if(!a) return; a.volume=0.45; a.play().catch(()=>{}); };

// เรียกใช้ฟังก์ชันใน main.js ถ้ามี
function callStart(){ if(window.preStartFlow) window.preStartFlow(); else if(window.start) window.start(); }
function callPause(){ if(typeof window.state!=='undefined'){ /* noop */ } }
function callRestart(){ if(window.end){ window.end(true); } if(window.start) window.start(); }

// ปุ่มหลัก
$('#btn_start')?.addEventListener('click', ()=>{ vibrate(15); playBGM(); callStart(); });
$('#btn_pause')?.addEventListener('click', ()=>{ vibrate(15); callPause(); });
$('#btn_restart')?.addEventListener('click', ()=>{ vibrate(20); callRestart(); });
$('#btn_help')?.addEventListener('click', ()=>{
  const help = $('#help'); if(help){ help.style.display='flex'; }
});

// ปุ่มปิด Help / Result
$('#btn_ok')?.addEventListener('click', ()=>{ const help=$('#help'); if(help) help.style.display='none'; });
$('#result')?.addEventListener('click', (e)=>{
  const a=e.target.getAttribute('data-result');
  if(a==='replay'){ $('#result').style.display='none'; callStart(); }
  if(a==='home'){   $('#result').style.display='none'; }
});

// สลับภาษา/กราฟิก/เสียง (ส่งต่อให้ main.js ถ้ามี listener อยู่แล้ว)
$('#langToggle')?.addEventListener('click', ()=>{ playSFX('tick'); });
$('#gfxToggle') ?.addEventListener('click', ()=>{ playSFX('tick'); });
$('#soundToggle')?.addEventListener('click', ()=>{ playSFX('tick'); });

// แมปเมาส์/ล้อ/คลิกขวา → ปุ่มเกม (ยังคงใช้คีย์บอร์ดได้)
window.addEventListener('mousedown', (e)=>{
  // เฉพาะตอนเล่นจริงเท่านั้น (ปล่อยกว้าง: เพื่อความง่าย)
  if(e.button===0){ dispatchKey('ArrowUp');  vibrate(10); }
  if(e.button===2){ dispatchKey('ArrowDown'); vibrate(20); }
});
window.addEventListener('wheel', (e)=>{
  if(e.deltaY<0) dispatchKey('ArrowLeft'); else dispatchKey('ArrowRight');
});
window.addEventListener('contextmenu', (e)=>{ e.preventDefault(); });

function dispatchKey(key){
  const ev = new KeyboardEvent('keydown', {key, bubbles:true});
  window.dispatchEvent(ev);
}

// ทิวทอเรียลสั้น (แสดงครั้งแรก)
(function tutorialOnce(){
  if(localStorage.getItem('hha_stage1_tut')) return;
  const help=$('#help'), body=$('#helpBody');
  if(help && body){
    body.textContent =
`How to Play (Quick)
• Mouse: Left=Jump, Right=Duck, Wheel=Dash
• Keyboard: ↑ Jump, ↓ Duck, ←/→ Dash, Space=Jump, Ctrl=Duck
• Keep combo to boost score. Fever fills at x10 combo.
Tip: Try “Good vs Junk” first, then Hydration.`;
    help.style.display='flex';
    localStorage.setItem('hha_stage1_tut','1');
  }
})();

// กัน overlay บังปุ่ม start (debug ช่วย)
(function probeOverlay(){
  setTimeout(()=>{
    const b = $('#btn_start'); if(!b) return;
    const r = b.getBoundingClientRect(); const cx=r.left+r.width/2, cy=r.top+r.height/2;
    const stack = document.elementsFromPoint(cx,cy);
    if(stack && stack[0] !== b){ console.warn('[Overlay Detected on Start]', stack[0]); }
  }, 600);
})();
