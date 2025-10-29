// === Hero Health Academy — game/modes/goodjunk.js (with shatter3D FX) ===
export const name = 'goodjunk';

const GOOD = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛','🍇','🍓','🍊','🍅','🍆','🥬','🥝','🍍','🍐','🍑'];
const JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤'];

export function create({engine, hud, coach}) {
  const host = document.getElementById('spawnHost');
  const state = { active:true, count:0 };

  function spawn() {
    if (!state.active) return;
    const el = document.createElement('div');
    el.className = 'spawn-emoji';
    const isGood = Math.random() > 0.4;
    el.textContent = isGood ? GOOD[Math.floor(Math.random()*GOOD.length)]
                            : JUNK[Math.floor(Math.random()*JUNK.length)];
    const x = Math.random() * host.clientWidth;
    const y = Math.random() * host.clientHeight;
    el.style.left = `${x}px`; el.style.top = `${y}px`;
    host.appendChild(el);

    // click event
    el.addEventListener('click', (e)=>{
      if (!state.active) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width/2, cy = rect.top + rect.height/2;
      el.remove();

      if (isGood) {
        engine?.fx?.shatter3D(cx, cy, {shards:28, sparks:12});
        coach?.onPerfect();
        window.HHA?.sys?.score?.add?.(10);
      } else {
        engine?.fx?.burstEmoji?.(cx, cy, ['💥','💣']);
        coach?.onBad();
      }
    }, {once:true});
  }

  function start() {
    const loop = setInterval(spawn, 900);
    setTimeout(()=>{ clearInterval(loop); state.active = false; }, 45000);
  }

  return { start, update(){} };
}
