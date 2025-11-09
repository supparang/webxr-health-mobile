// Hydration — เกจน้ำ + Adaptive + Coach + Quest
import { makeSpawner } from '../vr/spawn-utils.js';
import { burstAt, floatScore } from '../vr/shards.js';
import { emojiImage } from '../vr/emoji-sprite.js';
import { MissionDeck } from '../vr/mission.js';

export async function boot(cfg = {}) {
  const scene = document.querySelector('a-scene');
  const host  = cfg.host || document.getElementById('spawnHost');
  const diff  = String(cfg.difficulty || 'normal');
  const defaultDur = { easy:90, normal:60, hard:45 }[diff] || 60;
  let left = Number(cfg.duration || defaultDur);

  const tune = {
    easy:   { gap:[520,760], life:[1600,1900], minDist:0.34, maxActiveMin:2, maxActiveMax:4 },
    normal: { gap:[420,640], life:[1300,1600], minDist:0.32, maxActiveMin:2, maxActiveMax:5 },
    hard:   { gap:[360,520], life:[1000,1300], minDist:0.30, maxActiveMin:2, maxActiveMax:6 },
  };
  const T = tune[diff] || tune.normal;

  const sp = makeSpawner({ bounds:{x:[-0.75,0.75], y:[-0.05,0.45], z:-1.6}, minDist:T.minDist, decaySec:2.2 });

  // เครื่องดื่ม
  const OK   = ['💧','🥤','🧊','🥛']; // นับเป็นน้ำได้
  const BAD  = ['🧋','🍹','🍺','☕️']; // ไม่นับเป็นน้ำ
  // ใช้อีโมจิภาพ: map สัญลักษณ์เป็นรูปแก้วสำหรับความสวยงาม
  const TO_EMO = { '💧':'💧','🥤':'🥤','🧊':'🧊','🥛':'🥛','🧋':'🧋','🍹':'🍹','🍺':'🍺','☕️':'☕️' };

  let score=0, combo=0, misses=0, running=true, water=50; // 0..100
  const active=[];
  const deck = new MissionDeck(); deck.draw3(); fireQuest();

  // ส่งเกจน้ำให้หน้าหลัก (คุณมี HUD อยู่แล้ว)
  function emitWater(){ window.dispatchEvent(new CustomEvent('h2o:level',{detail:{pct:water}})); }
  emitWater();

  // Adaptive
  let currentMaxActive=T.maxActiveMin;
  const recent={hits:0,misses:0,lastMissAt:performance.now(),lastAdjustAt:performance.now()};

  const tmr = setInterval(()=>{
    if(!running) return;
    left=Math.max(0,left-1);
    // ค่อย ๆ ระเหยน้ำ
    water=Math.max(0, water - (diff==='hard'?0.7:(diff==='easy'?0.3:0.5)));
    emitWater();
    window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:left}}));
    deck.second();
    if(left<=0) end('timeout');
  },1000);

  function nextGap(){ const [a,b]=T.gap; return a + Math.random()*(b-a); }
  function lifeMs(){  const [a,b]=T.life;return a + Math.random()*(b-a); }

  function spawnOne(){
    if (!running) return;
    if (active.length >= currentMaxActive) return;

    const pool = Math.random() > 0.35 ? OK : BAD;
    const sym  = pool[(Math.random()*pool.length)|0];
    const ch   = TO_EMO[sym] || sym;

    const pos=sp.sample();
    const el=emojiImage(ch, 0.7, 140);
    el.classList.add('clickable');
    el.setAttribute('position', `${pos.x} ${pos.y} ${pos.z}`);
    host.appendChild(el);

    const rec=sp.markActive(pos); active.push(el);

    const ttl=setTimeout(()=>{
      if(!el.parentNode) return;
      // หมดอายุ = พลาด
      combo=0; score=Math.max(0,score-6); misses++; recent.misses++; recent.lastMissAt=performance.now();
      deck.onJunk();
      window.dispatchEvent(new CustomEvent('hha:miss',{detail:{count:misses}}));
      try{ host.removeChild(el);}catch{}; sp.unmark(rec); active.splice(active.indexOf(el),1);
    }, lifeMs());

    el.addEventListener('click',(ev)=>{
      ev.preventDefault(); clearTimeout(ttl);
      const ok = OK.includes(sym);
      const wp = el.object3D.getWorldPosition(new THREE.Vector3());
      let delta = ok ? (18 + combo*2) : -15;

      if (ok){ combo++; recent.hits++; water=Math.min(100, water+6); deck.onGood(); }
      else { combo=0; water=Math.max(0, water-6); deck.onJunk(); recent.misses++; recent.lastMissAt=performance.now(); }
      emitWater();

      score=Math.max(0,score+delta);
      burstAt(scene, wp, { color: ok?'#22c55e':'#ef4444', count: ok?18:12, speed: ok?1.0:0.8 });
      floatScore(scene, wp, (delta>0?'+':'')+delta);
      window.dispatchEvent(new CustomEvent('hha:score',{detail:{score,combo}}));

      try{ host.removeChild(el);}catch{}; sp.unmark(rec); active.splice(active.indexOf(el),1);
    }, {passive:false});
  }

  (function loop(){ if(!running) return; spawnOne(); setTimeout(loop, nextGap()); })();
  const wd=setInterval(()=>{ if(running && active.length===0) spawnOne(); },1800);

  const adapt=setInterval(()=>{
    if(!running) return;
    const now=performance.now(), secMiss=(now-recent.lastMissAt)/1000, secAdj=(now-recent.lastAdjustAt)/1000;
    if(secMiss>=6 && recent.hits>=5 && secAdj>=5){
      const b=currentMaxActive; currentMaxActive=Math.min(T.maxActiveMax,currentMaxActive+1);
      if(currentMaxActive>b){ scaleGapBy(0.9); coach(`ไหลลื่น! เพิ่มเป็น ${currentMaxActive} เป้า 💧`); recent.hits=0; recent.lastAdjustAt=now; }
    }
    if(secMiss<2 && secAdj>=2){
      const b=currentMaxActive; currentMaxActive=Math.max(T.maxActiveMin,currentMaxActive-1);
      if(currentMaxActive<b){ scaleGapBy(1.05); coach(`ชะลอเหลือ ${currentMaxActive} เป้า 😉`); recent.hits=0; recent.lastAdjustAt=now; }
    }
  },1000);

  function scaleGapBy(f){
    const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
    const [ga,gb]=T.gap, na=clamp(Math.round(ga*f),260,1300), nb=clamp(Math.round(gb*f),320,1700);
    T.gap=[Math.min(na,nb), Math.max(na,nb)];
  }
  function coach(text){ window.dispatchEvent(new CustomEvent('hha:coach',{detail:{text}})); }
  function fireQuest(){
    const cur=deck.getCurrent(); const done=deck.getProgress().filter(p=>p.done).length;
    window.dispatchEvent(new CustomEvent('hha:quest',{detail:{text:`Quest ${done+1}/3: ${cur?cur.label:'Mini Quest'}`}}));
  }

  function end(reason='done'){
    if(!running) return; running=false;
    clearInterval(tmr); clearInterval(wd); clearInterval(adapt);
    active.splice(0).forEach(n=>{ try{n.remove();}catch{} });
    window.dispatchEvent(new CustomEvent('hha:end',{
      detail:{
        reason, score, comboMax:combo, misses, duration:defaultDur,
        mode:'Hydration', difficulty:diff,
        questsCleared: deck.getProgress().filter(p=>p.done).length, questsTotal:3
      }
    }));
  }
  return { stop:()=>end('quit'), pause:()=>running=false, resume:()=>{ if(!running){ running=true; } } };
}
export default { boot };
