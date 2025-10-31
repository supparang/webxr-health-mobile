// /webxr-health-mobile/HeroHealth/game/modes/goodjunk.js
// Good vs Junk (DOM spawn) — 2025-10-31
// - ใช้ #spawnHost ใน #gameLayer
// - export API: name, help(lang), start(cfg), pause(), resume(), stop(), update(dt)
// - ไม่พึ่ง optional chaining
// - ทำงานร่วมกับ main.js ได้หลายแบบ:
//   1) ถ้ามี window.__HHA_modeHooks.addScore / badHit → เรียกตรง
//   2) ถ้ามี window.addScore / badHit (global) → เรียกตรง
//   3) ถ้าไม่มี → อัปเดต #score/#combo โดยตรง (self-contained)

export const name = 'goodjunk';

const GOOD = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛','🍇','🍓','🍊','🍅','🍆','🥬','🥝','🍍','🍐','🍑'];
const JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍗','🍖','🍫','🥓','🍿','🧈','🧂'];

let host    = null;
let alive   = false;
let spawnT  = 0;
let rate    = 700;   // ms between spawns
let life    = 1600;  // ms lifetime
let rndBusy = false;

// ---------- Glue: score / bad ----------
function emitScore(delta, perfect){
  try{
    if (window.__HHA_modeHooks && typeof window.__HHA_modeHooks.addScore === 'function'){
      window.__HHA_modeHooks.addScore(delta, !!perfect); return;
    }
    if (typeof window.addScore === 'function'){ window.addScore(delta, !!perfect); return; }
  }catch(_e){}
  // DOM fallback (update #score/#combo โดยตรง)
  try{
    const s = document.getElementById('score');
    const c = document.getElementById('combo');
    if(s){
      const cur = parseInt(s.textContent || '0', 10) || 0;
      s.textContent = String(cur + delta);
    }
    if(c){
      const curc = parseInt(String(c.textContent || 'x0').replace('x',''), 10) || 0;
      c.textContent = 'x' + String(curc + 1);
    }
  }catch(_e2){}
}

function emitBad(){
  try{
    if (window.__HHA_modeHooks && typeof window.__HHA_modeHooks.badHit === 'function'){
      window.__HHA_modeHooks.badHit(); return;
    }
    if (typeof window.badHit === 'function'){ window.badHit(); return; }
  }catch(_e){}
  // DOM fallback
  try{
    const c = document.getElementById('combo');
    if(c) c.textContent = 'x0';
    // flash เล็กน้อย
    const gl = document.getElementById('gameLayer');
    if(gl){
      const old = gl.style.background;
      gl.style.transition='background 120ms ease';
      gl.style.background='radial-gradient(1200px 500px at 50% -40%, #411a26 12%, #2a0c16 55%, #200b16)';
      setTimeout(()=>{ gl.style.background = old; }, 140);
    }
  }catch(_e2){}
}

// ---------- Helpers ----------
function on(el, ev, fn){ if(el) el.addEventListener(ev, fn, false); }
function rng(a,b){ return Math.floor(a + Math.random()*(b-a+1)); }

function makeItem(txt, isGood){
  const d = document.createElement('button');
  d.className = 'spawn-emoji';
  d.setAttribute('aria-label', isGood ? 'good item' : 'junk item');
  d.textContent = txt;
  d.style.position = 'absolute';
  d.style.border = '0';
  d.style.background = 'transparent';
  d.style.fontSize = '38px';
  d.style.filter = 'drop-shadow(0 3px 6px rgba(0,0,0,.45))';
  d.dataset.good = isGood ? '1' : '0';

  const W = host.clientWidth  || 640;
  const H = host.clientHeight || 360;
  const pad = 24;
  const x = rng(pad, Math.max(pad, W - 64));
  const y = rng(pad, Math.max(pad, H - 64));
  d.style.left = x + 'px';
  d.style.top  = y + 'px';

  // lifetime
  const lifeMs = rng(life - 250, life + 250);
  let gone = false;
  const killto = setTimeout(()=>{ if(!gone) leave(); }, lifeMs);

  function leave(){
    gone = true;
    d.style.transition = 'transform 160ms ease, opacity 160ms ease';
    d.style.transform = 'scale(.6) translateY(10px)';
    d.style.opacity = '0';
    setTimeout(()=>{ if(d.parentNode) d.parentNode.removeChild(d); }, 170);
  }

  on(d,'click', function(){
    if(!alive) return;
    clearTimeout(killto);
    d.style.transition = 'transform 120ms ease, opacity 120ms ease';
    d.style.transform  = 'scale(1.25)';
    setTimeout(()=>{ d.style.opacity='0'; }, 90);
    setTimeout(()=>{ if(d.parentNode) d.parentNode.removeChild(d); }, 130);

    if(d.dataset.good === '1'){
      const perfect = Math.random() < 0.22;
      emitScore(perfect ? 200 : 100, perfect);
      // small pop on good
      try{
        host.style.transition='transform 80ms ease';
        host.style.transform='scale(1.01)';
        setTimeout(()=>{ host.style.transform='scale(1)'; }, 90);
      }catch(_e){}
    }else{
      emitBad();
    }
  });

  host.appendChild(d);
}

// ---------- Public API ----------
export function help(lang){
  return (lang === 'en')
    ? 'Tap healthy foods to score. Avoid junk! Bad hits reset combo. Race against the clock!'
    : 'แตะอาหาร “ดีต่อสุขภาพ” เพื่อเก็บคะแนน หลีกเลี่ยงอาหารขยะ โดนขยะคอมโบจะรีเซ็ต ระวังเวลาหมด!';
}

export function start(cfg){
  host = document.getElementById('spawnHost');
  if(!host){
    // สร้าง host ถ้าไม่พบ
    const gl = document.getElementById('gameLayer');
    host = document.createElement('div');
    host.id = 'spawnHost';
    host.style.position='absolute';
    host.style.inset='0';
    if(gl) gl.appendChild(host); else document.body.appendChild(host);
  }

  alive  = true;
  spawnT = 0;

  // difficulty
  const d = cfg && cfg.difficulty ? String(cfg.difficulty) : 'Normal';
  if(d === 'Easy'){ rate = 820; life = 1900; }
  else if(d === 'Hard'){ rate = 560; life = 1400; }
  else { rate = 700; life = 1600; }

  // แสดง HUD ถ้าถูกซ่อนไว้
  try{
    const hud = document.getElementById('hudWrap');
    if(hud) hud.style.display = 'block';
  }catch(_e){}

  // โค้ช: “เริ่ม!”
  try{
    const coach = document.getElementById('coachText');
    if(coach) coach.textContent = (cfg && cfg.lang === 'en') ? 'Go!' : 'เริ่ม!';
  }catch(_e){}
}

export function pause(){ alive = false; }
export function resume(){ alive = true; }

export function stop(){
  alive = false;
  if(host){
    const nodes = host.querySelectorAll('.spawn-emoji');
    for(let i=0;i<nodes.length;i++){
      const n = nodes[i];
      if(n && n.parentNode) n.parentNode.removeChild(n);
    }
  }
}

// dt = milliseconds (จาก main loop)
export function update(dt){
  if(!alive) return;
  spawnT += dt;
  // จำกัดไม่ให้คูณหลายครั้งเมื่อแท็บ lag
  if(spawnT >= rate){
    // อัตราสุ่มเล็กน้อย
    spawnT = Math.max(0, spawnT - rate);
    // burst เล็ก ๆ
    const count = (Math.random() < 0.15) ? 2 : 1;
    for(let i=0;i<count;i++){
      const isGood = Math.random() < 0.7;
      if(Math.random() < 0.12){
        makeItem('🌟', true);
      }else{
        makeItem(isGood ? GOOD[rng(0,GOOD.length-1)] : JUNK[rng(0,JUNK.length-1)], isGood);
      }
    }
  }
}
