// ===== Boot flag =====
window.__HHA_BOOT_OK = true;

// ===== Tiny self-contained game (no outside deps) =====
const $  = (s)=>document.querySelector(s);
const $$ = (s)=>document.querySelectorAll(s);

// เก็บสถานะโหมด/ความยากไว้ให้ index ใช้ได้
window.__HHA_STATE = { modeKey:'goodjunk', difficulty:'Normal' };

// กัน canvas บังคลิก
const c = document.getElementById('c');
if (c){ c.style.pointerEvents='none'; c.style.zIndex='1'; }

// สถานะเกมย่อย
let running=false, timeLeft=60, score=0, combo=0, bestCombo=0;
let spawnId=0, tickId=0;

// HUD helpers
function setHUD(){
  const sc=$('#score'), cb=$('#combo'), tm=$('#time');
  if(sc) sc.textContent = score|0;
  if(cb) cb.textContent = 'x'+(combo|0);
  if(tm) tm.textContent = timeLeft|0;
}
function setStatus(){
  const map = { goodjunk:'ดี vs ขยะ', groups:'จาน 5 หมู่', hydration:'สมดุลน้ำ', plate:'จัดจานสุขภาพ' };
  const el = $('#statusLine');
  if(el) el.textContent = `โหมด: ${map[window.__HHA_STATE.modeKey] || window.__HHA_STATE.modeKey} • ความยาก: ${window.__HHA_STATE.difficulty}`;
}

// ไอเท็มคลิก (จำลอง)
function place(el){
  el.style.left = (8 + Math.random()*84) + 'vw';
  el.style.top  = (18 + Math.random()*70) + 'vh';
}
function spawn(){
  if(!running) return;
  const b=document.createElement('button');
  b.className='item';
  // 70% ดี / 30% ขยะ
  const isGood = Math.random() < 0.7;
  b.textContent = isGood ? '🥦' : '🍔';
  b.style.position='fixed'; b.style.zIndex='220';
  b.style.minWidth='56px'; b.style.minHeight='56px';
  place(b);
  b.onclick=()=>{
    if(isGood){ score+=5; combo++; } else { score=Math.max(0, score-3); combo=0; }
    bestCombo = Math.max(bestCombo, combo);
    setHUD();
    b.remove();
  };
  document.body.appendChild(b);
  setTimeout(()=>b.remove(), 2600);
  spawnId = setTimeout(spawn, 700);
}

function tick(){
  if(!running) return;
  timeLeft--; setHUD();
  if(timeLeft<=0){ end(); return; }
  tickId = setTimeout(tick, 1000);
}

export function start(){
  end(true);
  running=true; timeLeft=60; score=0; combo=0; bestCombo=0; setHUD(); setStatus();
  // แสดง/ซ่อน HUD เฉพาะโหมดสมดุลน้ำ
  const hw = $('#hydroWrap'); if(hw) hw.style.display = (window.__HHA_STATE.modeKey==='hydration') ? 'block' : 'none';
  spawn(); tick();
}

export function end(silent=false){
  running=false; clearTimeout(spawnId); clearTimeout(tickId);
  $$('.item').forEach(el=>el.remove());
  // ล้าง HUD โหมดเฉพาะ
  const hw = $('#hydroWrap'); if(hw) hw.style.display='none';
  if(!silent){
    const core=$('#resCore');
    if(core) core.innerHTML = `<p>คะแนน: <b>${score}</b></p><p>คอมโบสูงสุด: <b>x${bestCombo}</b></p>`;
    $('#result')?.style && ($('#result').style.display='flex');
  }
}

// ปุ่มเมนู
document.addEventListener('click', (e)=>{
  const btn = e.target.closest('#menuBar button'); if(!btn) return;
  const a=btn.dataset.action, v=btn.dataset.value;
  if(a==='mode'){ window.__HHA_STATE.modeKey = v; setStatus(); }
  if(a==='diff'){ window.__HHA_STATE.difficulty = v; setStatus(); }
  if(a==='start') start();
  if(a==='pause'){ running=!running; if(running){ spawn(); tick(); } }
  if(a==='restart'){ end(true); start(); }
  if(a==='help'){ document.getElementById('help').style.display='flex'; }
});
document.getElementById('btn_ok')?.addEventListener('click', ()=> document.getElementById('help').style.display='none');
document.getElementById('btn_replay')?.addEventListener('click', ()=>{ document.getElementById('result').style.display='none'; start(); });
document.getElementById('btn_home')  ?.addEventListener('click', ()=>{ document.getElementById('result').style.display='none'; });

// ตั้งค่าเริ่มต้น
setHUD(); setStatus();
console.log('[HHA test main.js] loaded & running');
