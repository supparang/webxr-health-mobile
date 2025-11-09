// ⬆️ ที่หัวไฟล์
import { makeSpawner } from '../vr/spawn-utils.js';
import { burstAt, floatScore } from '../vr/shards.js';
import { emojiImage } from '../vr/emoji-sprite.js';

// …ภายใน boot(cfg)…
const scene = document.querySelector('a-scene');
const host  = cfg.host || document.getElementById('spawnHost');
const diff  = String(cfg.difficulty||'normal');

const tune = {
  easy:   { nextGap:[600, 900], life:[1600,1900], minDist:0.36 },
  normal: { nextGap:[480, 720], life:[1300,1600], minDist:0.32 },
  hard:   { nextGap:[360, 560], life:[1000,1300], minDist:0.30 },
};
const C = tune[diff] || tune.normal;

// สร้าง spawner ให้อยู่ “กลางจอจริงๆ”
const sp = makeSpawner({
  bounds: { x:[-0.75,0.75], y:[-0.05,0.45], z:-1.6 },
  minDist: C.minDist,
  decaySec: 2.2
});

function nextGap(){ const [a,b]=C.nextGap; return a + Math.random()*(b-a); }
function lifeMs(){  const [a,b]=C.life;    return a + Math.random()*(b-a); }

// สุ่มอีโมจิ (GOOD/JUNK)
const GOOD = ['🥦','🥕','🍎','🐟','🥛','🍊','🍌','🍇','🥬','🍚','🥜','🍞','🍓','🍍','🥝','🍐'];
const JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🍫','🌭','🍰','🍬'];

function spawnOne(){
  const isGood = Math.random() > 0.35;
  const ch = isGood ? GOOD[(Math.random()*GOOD.length)|0]
                    : JUNK[(Math.random()*JUNK.length)|0];

  const pos = sp.sample();
  const el  = emojiImage(ch, 0.68, 128);
  el.classList.add('clickable');
  el.setAttribute('position', `${pos.x} ${pos.y} ${pos.z}`);
  host.appendChild(el);

  const rec = sp.markActive({x:pos.x,y:pos.y,z:pos.z});

  const ttl = setTimeout(()=>{
    if(!el.parentNode) return;
    // พลาด (หมดอายุ) → good พลาดมีโทษ, junk ปล่อยผ่านไม่ลบคอมโบ
    if (GOOD.includes(ch)) { combo=0; score=Math.max(0, score-10); window.dispatchEvent(new CustomEvent('hha:miss')); }
    try{ host.removeChild(el);}catch{}
    sp.unmark(rec);
  }, lifeMs());

  el.addEventListener('click', (ev)=>{
    ev.preventDefault();
    clearTimeout(ttl);
    // คะแนน/คอมโบ + shards แตกต่างสีตามประเภท
    const wp = el.object3D.getWorldPosition(new THREE.Vector3());
    const val = isGood ? (20 + combo*2) : -15;
    score = Math.max(0, score + (isGood ? val : -15));
    combo = isGood ? combo+1 : 0;
    burstAt(scene, wp, {
      color: isGood ? '#22c55e' : '#ef4444',
      count: isGood ? 18 : 12,
      speed: isGood ? 1.0 : 0.8
    });
    floatScore(scene, wp, (isGood?'+':'')+val);
    try{ host.removeChild(el);}catch{}
    sp.unmark(rec);
    window.dispatchEvent(new CustomEvent('hha:score',{detail:{score,combo}}));
  }, {passive:false});
}

function loop(){ spawnOne(); setTimeout(loop, nextGap()); }
loop();

// watchdog กันจอว่าง
setInterval(()=>{ if(!host.querySelector('a-image')) spawnOne(); }, 2000);
