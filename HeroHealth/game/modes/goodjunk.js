// === modes/goodjunk.js ===
// DOM-spawn icons, difficulty-based size/speed, fever burst, 3D-like explode on hit

export const name = 'goodjunk';

const GOOD = [
  { ch:'🥦', tag:'veggies' },{ ch:'🥕', tag:'veggies' },{ ch:'🍎', tag:'fruits' },{ ch:'🍓', tag:'fruits' },
  { ch:'🍊', tag:'fruits' },{ ch:'🥗', tag:'veggies' },{ ch:'🍚', tag:'grains' },{ ch:'🥛', tag:'dairy' },
  { ch:'🐟', tag:'protein'},{ ch:'🥜', tag:'protein'}
];
const BAD  = ['🍔','🍟','🌭','🍕','🍩','🍪','🧋','🥤','🍰'];

const DIFF = {
  Easy:   { size:72,  life:1600, rate: 700 },
  Normal: { size:64,  life:1400, rate: 560 },
  Hard:   { size:56,  life:1200, rate: 460 },
};

let host, hud, coach, score, diff, w, h, spawnTO, running=false;

export function create({ hud:hudApi, coach:coachApi }) {
  hud = hudApi; coach = coachApi;
  host = document.getElementById('spawnHost') || document.body;
  const st = {
    start(opts){ start(opts); },
    update(dt, bus){ update(dt, bus); },
    cleanup(){ stop(); }
  };
  return st;
}

function start({ time=45 }={}) {
  running = true;
  const rect = document.body.getBoundingClientRect();
  w = rect.width; h = rect.height;
  diff = document.body.getAttribute('data-diff') || 'Normal';
  schedule();
}

function stop(){
  running = false;
  clearTimeout(spawnTO);
  // remove all items
  document.querySelectorAll('.gj-item').forEach(n=>n.remove());
}

function schedule(){
  if (!running) return;
  const cfg = DIFF[diff] || DIFF.Normal;
  const rate = cfg.rate;
  spawnTO = setTimeout(()=>{ spawnOne(cfg); schedule(); }, jitter(rate, 0.3));
}

function jitter(v, p=0.25){ const d=v*p; return v + (Math.random()*2*d - d); }

function spawnOne(cfg){
  const isGood = Math.random() < 0.65;
  const data = isGood ? GOOD[(Math.random()*GOOD.length)|0] : {ch: BAD[(Math.random()*BAD.length)|0], tag:'junk'};
  const el = document.createElement('div');
  el.className = 'gj-item';
  const sz = cfg.size * (isGood ? 1.05 : 1.0);
  const x = 40 + Math.random()*(w-80);
  const y = 80 + Math.random()*(h-180);
  el.textContent = data.ch;
  el.style.cssText = `
    position:fixed;left:${x}px;top:${y}px;transform:translate(-50%,-50%);font-size:${sz}px;
    text-shadow: 0 12px 24px rgba(0,0,0,.45), 0 2px 0 #0006;
    user-select:none;cursor:pointer;z-index:8;transition:transform .12s ease-out, opacity .2s;
  `;
  el.dataset.tag = data.tag || (isGood?'good':'bad');
  host.appendChild(el);

  const life = jitter(cfg.life, 0.25);
  const tKill = setTimeout(()=> fadeOut(el), life);

  el.addEventListener('pointerdown', (e)=>{
    clearTimeout(tKill);
    onHit(el, isGood, {x:e.clientX, y:e.clientY});
  }, {passive:true});
}

function onHit(el, isGood, ui){
  explode(el); // 3D-like burst
  if (isGood){
    window.__HHA_BUS?.hit?.({ kind:'good', points: 10, ui, meta:{ tag: el.dataset.tag } });
  } else {
    window.__HHA_BUS?.hit?.({ kind:'bad',  points: -5, ui, meta:{ tag:'junk' } });
  }
}

function fadeOut(el){
  el.style.opacity='0';
  el.style.transform += ' scale(.6)';
  setTimeout(()=>el.remove(), 200);
}

function explode(el){
  const rect = el.getBoundingClientRect();
  const x = rect.left + rect.width/2;
  const y = rect.top + rect.height/2;
  el.remove();

  // shards
  for (let i=0;i<10;i++){
    const s = document.createElement('div');
    s.style.cssText = `
      position:fixed;left:${x}px;top:${y}px;width:8px;height:8px;border-radius:3px;
      background:linear-gradient(180deg,#fff,#ccc);box-shadow:0 0 10px #fff8;
      transform:translate(-50%,-50%);z-index:9;pointer-events:none;
    `;
    document.body.appendChild(s);
    const ang = Math.random()*Math.PI*2;
    const spd = 120 + Math.random()*180;
    const dx = Math.cos(ang)*spd, dy = Math.sin(ang)*spd;
    const life = 420 + Math.random()*380;
    const t0 = performance.now();
    (function anim(tPrev){
      const t = performance.now();
      const dt = (t - tPrev)/1000;
      const p = (t - t0)/life;
      s.style.left = (x + dx*dt*60*p) + 'px';
      s.style.top  = (y + dy*dt*60*p) + 'px';
      s.style.opacity = String(1 - p);
      if (p < 1) requestAnimationFrame(()=>anim(t));
      else s.remove();
    })(t0);
  }
}

function update(dt, bus){
  window.__HHA_BUS = bus; // allow onHit to call back

  // fever effects: raise spawn rate & bonus points via bus caller (score handled in core)
  // (spawn cadence already quick; bonus handled when main activates fever)
}
