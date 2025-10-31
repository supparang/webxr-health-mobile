// /webxr-health-mobile/HeroHealth/game/modes/goodjunk.js
// Good vs Junk (DOM spawn) — 2025-10-31 SELF-TICK SAFE
// - ใช้ #spawnHost ใน #gameLayer
// - ถ้า 600ms ไม่ถูกเรียก update() เลย → เปิด internal tick เอง (การันตีมีสปอว์น)
// - ไม่ใช้ optional chaining; ทำงานได้ใน WebView/Chrome เก่า
// - ส่งคะแนนผ่าน window.__HHA_modeHooks.addScore / badHit ถ้ามี

export const name = 'goodjunk';

const GOOD = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛','🍇','🍓','🍊','🍅','🍆','🥬','🥝','🍍','🍐','🍑'];
const JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍗','🍖','🍫','🥓','🍿','🧈','🧂'];

let host = null, alive = false;
let spawnT = 0, rate = 700, life = 1600;

// ---- self tick detection ----
let lastExternalAt = 0;
let internalTimer = null;
let selfBadge = null;

function ensureSelfBadge(){
  if(selfBadge) return;
  selfBadge = document.createElement('div');
  selfBadge.textContent = 'Fallback mode active';
  selfBadge.style.cssText = 'position:fixed;left:12px;bottom:12px;background:#1b5e20;color:#fff;padding:6px 10px;border-radius:999px;font-weight:800;font-size:12px;z-index:2002;opacity:.9;display:none';
  document.body.appendChild(selfBadge);
}

function startInternalTick(){
  if(internalTimer) return;
  ensureSelfBadge();
  selfBadge.style.display = 'inline-block';
  let prev = Date.now();
  internalTimer = setInterval(function(){
    if(!alive) return;
    // ถ้า main เรียก update แล้วภายใน 600ms → ปิด self tick
    if(Date.now() - lastExternalAt < 600){ stopInternalTick(); return; }
    const now = Date.now();
    const dt = now - prev; prev = now;
    doSpawn(dt);
  }, 80); // ประมาณ 12.5 fps ก็พอสำหรับ DOM spawn
}

function stopInternalTick(){
  if(internalTimer){ clearInterval(internalTimer); internalTimer = null; }
  if(selfBadge){ selfBadge.style.display = 'none'; }
}

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
    const gl = document.getElementById('gameLayer');
    if(gl){
      const old = gl.style.background;
      gl.style.transition='background 120ms ease';
      gl.style.background='radial-gradient(1200px 500px at 50% -40%, #411a26 12%, #2a0c16 55%, #200b16)';
      setTimeout(function(){ gl.style.background = old; }, 140);
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
  const killto = setTimeout(function(){ if(!gone) leave(); }, lifeMs);

  function leave(){
    gone = true;
    d.style.transition = 'transform 160ms ease, opacity 160ms ease';
    d.style.transform = 'scale(.6) translateY(10px)';
    d.style.opacity = '0';
    setTimeout(function(){ if(d.parentNode) d.parentNode.removeChild(d); }, 170);
  }

  on(d,'click', function(){
    if(!alive) return;
    clearTimeout(killto);
    d.style.transition = 'transform 120ms ease, opacity 120ms ease';
    d.style.transform  = 'scale(1.25)';
    setTimeout(function(){ d.style.opacity='0'; }, 90);
    setTimeout(function(){ if(d.parentNode) d.parentNode.removeChild(d); }, 130);

    if(d.dataset.good === '1'){
      const perfect = Math.random() < 0.22;
      emitScore(perfect ? 200 : 100, perfect);
      try{
        host.style.transition='transform 80ms ease';
        host.style.transform='scale(1.01)';
        setTimeout(function(){ host.style.transform='scale(1)'; }, 90);
      }catch(_e){}
    }else{
      emitBad();
    }
  });

  host.appendChild(d);
}

function doSpawn(dt){
  if(!alive) return;
  spawnT += dt;
  if(spawnT >= rate){
    spawnT = Math.max(0, spawnT - rate);
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

// ---------- Public API ----------
export function help(lang){
  return (lang === 'en')
    ? 'Tap healthy foods to score. Avoid junk! Bad hits reset combo. Race against the clock!'
    : 'แตะอาหาร “ดีต่อสุขภาพ” เพื่อเก็บคะแนน หลีกเลี่ยงอาหารขยะ โดนขยะคอมโบจะรีเซ็ต ระวังเวลาหมด!';
}

export function start(cfg){
  // host
  host = document.getElementById('spawnHost');
  if(!host){
    const gl = document.getElementById('gameLayer');
    host = document.createElement('div');
    host.id = 'spawnHost';
    host.style.position='absolute';
    host.style.inset='0';
    if(gl) gl.appendChild(host); else document.body.appendChild(host);
  }

  // ensure playfield visible size
  try{
    const gl = document.getElementById('gameLayer');
    if(gl){
      const rect = gl.getBoundingClientRect();
      if((rect.height||0) < 120){ gl.style.minHeight = '360px'; }
    }
  }catch(_e){}

  alive  = true;
  spawnT = 0;

  // difficulty
  const d = cfg && cfg.difficulty ? String(cfg.difficulty) : 'Normal';
  if(d === 'Easy'){ rate = 820; life = 1900; }
  else if(d === 'Hard'){ rate = 560; life = 1400; }
  else { rate = 700; life = 1600; }

  // HUD on
  try{
    const hud = document.getElementById('hudWrap');
    if(hud) hud.style.display = 'block';
  }catch(_e){}

  // coach
  try{
    const coach = document.getElementById('coachText');
    if(coach) coach.textContent = (cfg && cfg.lang === 'en') ? 'Go!' : 'เริ่ม!';
  }catch(_e){}

  // ถ้า main ไม่เรียก update ภายใน 600ms → เปิด self tick
  lastExternalAt = Date.now();
  setTimeout(function(){
    if(!alive) return;
    if(Date.now() - lastExternalAt >= 600){ startInternalTick(); }
  }, 620);
}

export function pause(){ alive = false; }
export function resume(){
  alive = true;
  // ถ้ากลับมาแล้ว main ก็ยังไม่เรียก update → เปิด self tick อีกรอบ
  lastExternalAt = Date.now();
  setTimeout(function(){
    if(!alive) return;
    if(Date.now() - lastExternalAt >= 600){ startInternalTick(); }
  }, 620);
}

export function stop(){
  alive = false;
  stopInternalTick();
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
  lastExternalAt = Date.now(); // แจ้งว่ามี external tick
  doSpawn(dt);
}
