// === /HeroHealth/modes/goodjunk.safe.js (2025-11-13 FX + GOAL/MINI) ===
export const name = 'goodjunk';

const GOOD = ['🍎','🍓','🍇','🥦','🥕','🍅','🥬','🍊','🍌','🫐','🍐','🍍','🍋','🍉','🥝','🍚','🥛','🍞','🐟','🥗'];
const JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🥓','🍫','🌭'];

const DIFF_CFG = {
  easy:   { spawn: 900, life: 1600, goalScore: 800 },
  normal: { spawn: 750, life: 1350, goalScore: 1200 },
  hard:   { spawn: 620, life: 1200, goalScore: 1600 }
};

let ParticlesRef = null;
try {
  import('../vr/particles.js').then(m=>{
    ParticlesRef = m.Particles || m.default || m;
  }).catch(()=>{});
} catch(_){}

// ---------- helpers ----------
function emit(name, detail){
  try { window.dispatchEvent(new CustomEvent(name,{detail})); } catch(_){}
}

function rnd(arr){ return arr[(Math.random()*arr.length)|0]; }

// score effect at element center
function fxScoreAtEl(el, delta, isGood){
  if(!el) return;
  const r = el.getBoundingClientRect();
  const x = r.left + r.width/2;
  const y = r.top  + r.height/2;

  // floating number
  const d = document.createElement('div');
  d.textContent = (delta>0?'+':'') + delta;
  Object.assign(d.style,{
    position:'fixed',
    left: x+'px',
    top:  y+'px',
    transform:'translate(-50%,-50%)',
    font:'900 18px system-ui',
    color: isGood ? '#bbf7d0' : '#fecaca',
    textShadow:'0 2px 10px rgba(0,0,0,.7)',
    zIndex: 1000,
    pointerEvents:'none',
    transition:'all .55s ease',
    opacity:'1'
  });
  document.body.appendChild(d);
  setTimeout(()=>{
    d.style.top = (y-36)+'px';
    d.style.opacity = '0';
  },20);
  setTimeout(()=>{ try{d.remove();}catch(_){}; },600);

  // shards via particles.js (ถ้ามี)
  if(ParticlesRef && typeof ParticlesRef.burstShards === 'function'){
    try{
      ParticlesRef.burstShards(null, {x,y}, {
        screen:{x,y},
        color: isGood?'#22c55e':'#ef4444',
        count: isGood?22:14
      });
      return;
    }catch(_){}
  }

  // fallback shards DOM
  const count = isGood ? 18 : 10;
  const col   = isGood ? '#22c55e' : '#ef4444';
  for(let i=0;i<count;i++){
    const p = document.createElement('div');
    Object.assign(p.style,{
      position:'fixed',
      left:x+'px',
      top:y+'px',
      width:'6px',
      height:'6px',
      borderRadius:'999px',
      background:col,
      opacity:'0.95',
      transform:'translate(-50%,-50%)',
      zIndex:999,
      transition:'all .55s ease',
      pointerEvents:'none'
    });
    document.body.appendChild(p);
    const ang = Math.random()*Math.PI*2;
    const r2  = 20+Math.random()*26;
    const tx  = x + Math.cos(ang)*r2;
    const ty  = y + Math.sin(ang)*r2 - 6;
    setTimeout(()=>{
      p.style.left = tx+'px';
      p.style.top  = ty+'px';
      p.style.opacity = '0';
    },20);
    setTimeout(()=>{ try{p.remove();}catch(_){ } },600);
  }
}

// ---------- main boot ----------
export async function boot(opts={}){
  const diff  = (opts.difficulty||'normal').toLowerCase();
  const cfg   = DIFF_CFG[diff] || DIFF_CFG.normal;
  const dur   = Number(opts.duration||60);

  const host  = document.getElementById('spawnHost') || document.body;
  host.style.pointerEvents = 'auto';
  host.style.touchAction   = 'manipulation';

  let running   = false;
  let timeLeft  = dur;
  let spawnTimer= null;
  let tickTimer = null;

  let score   = 0;
  let combo   = 0;
  let comboMax= 0;
  let misses  = 0;
  let hits    = 0;

  const missLimit = 6;

  const goalsAll = [
    {
      id:'score',
      label:`ทำคะแนนรวม ${cfg.goalScore}+`,
      prog:0,
      target:cfg.goalScore,
      done:false
    }
  ];
  const minisAll = [
    {
      id:'miss',
      label:'พลาดไม่เกิน 6 ครั้ง',
      prog:0,           // จำนวนครั้งที่ "ยังเหลือ" ให้พลาด
      target:missLimit, // ใช้คู่กับ prog เพื่อแสดงเป็น 0–6 บน HUD
      done:true
    }
  ];

  function updateQuests(){
    // goal: ใช้คะแนนจริง
    const g = goalsAll[0];
    g.prog = score;
    g.done = score >= g.target;

    // mini: ถ้าพลาดไม่เกิน missLimit ถือว่าผ่าน
    const m = minisAll[0];
    const remain = Math.max(0, missLimit - misses);
    m.prog = remain;          // เหลือให้พลาด
    m.done = (misses <= missLimit);

    emit('hha:quest', {
      goal:{
        label:g.label,
        prog:g.prog,
        target:g.target
      },
      mini:{
        label:m.label,
        prog:missLimit - remain, // จำนวนที่พลาดไปแล้ว
        target:missLimit
      }
    });
  }

  function applyScore(delta, isGood, el, coachText){
    if(delta){
      score = Math.max(0, score + delta);
    }
    if(isGood){
      hits++;
      combo++;
      if(combo > comboMax) comboMax = combo;
    }else{
      misses++;
      combo = 0;
    }

    emit('hha:score',{
      delta,
      total:score,
      combo,
      comboMax,
      good:isGood
    });

    if(el && delta){
      fxScoreAtEl(el, delta, !!isGood);
    }

    if(coachText){
      emit('hha:coach',{text:coachText});
    }

    updateQuests();
  }

  function spawnOne(){
    if(!running) return;

    const isGood = Math.random() < 0.7; // 70% ดี / 30% ขยะ
    const emo = isGood ? rnd(GOOD) : rnd(JUNK);

    const item = document.createElement('div');
    item.textContent = emo;
    item.dataset.type = isGood ? 'good' : 'junk';

    const size = (diff==='hard'?80:(diff==='easy'?110:96));
    const left = 12 + Math.random()*76;
    const top  = 24 + Math.random()*58;

    Object.assign(item.style,{
      position:'absolute',
      left:left+'vw',
      top: top +'vh',
      transform:'translate(-50%,-50%)',
      font:`${size}px system-ui, "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`,
      cursor:'pointer',
      userSelect:'none',
      WebkitUserSelect:'none',
      textShadow:'0 8px 18px rgba(0,0,0,.6)',
      transition:'transform .12s ease'
    });

    const onHit = (ev)=>{
      if(!running) return;
      ev.preventDefault();
      ev.stopPropagation();

      const t = item.dataset.type;
      item.removeEventListener('pointerdown', onHit);
      try{ host.removeChild(item); }catch(_){}

      if(t === 'good'){
        const base = 50;
        const bonus = Math.min(4, combo) * 5;
        const delta = base + bonus;
        applyScore(delta, true, item, combo>0 ? `สุดยอด! คอมโบ ${combo} ครั้งแล้ว!` : 'เก็บของดีต่อเนื่องเลย!');
      }else{
        applyScore(-40, false, item, 'ระวังของหวาน/มัน เลี่ยงให้ไว!');
      }
    };

    item.addEventListener('pointerdown', onHit);

    host.appendChild(item);

    // auto expire
    const ttl = cfg.life;
    setTimeout(()=>{
      if(!running) return;
      if(!item.isConnected) return;
      try{ host.removeChild(item); }catch(_){}
      // ถ้าหายไปเอง (ของดี) ถือว่าพลาดเล็กน้อย
      if(item.dataset.type === 'good'){
        misses++;
        combo = 0;
        emit('hha:score',{delta:0,total:score,combo,comboMax,good:false});
        updateQuests();
      }
    }, ttl);
  }

  function tick(){
    if(!running) return;
    timeLeft--;
    emit('hha:time',{sec:timeLeft});
    if(timeLeft <= 0){
      endGame();
    }
  }

  function endGame(){
    if(!running) return;
    running = false;
    clearInterval(spawnTimer);
    clearInterval(tickTimer);
    spawnTimer = null;
    tickTimer  = null;

    // เคลียร์ emoji ที่เหลือ
    try{
      [...host.querySelectorAll('.gj-item')].forEach(n=>n.remove());
    }catch(_){}

    // อัปเดตสถานะ quest ครั้งสุดท้าย
    updateQuests();

    const missMini = minisAll[0];

    emit('hha:end',{
      score,
      misses,
      comboMax,
      mode:'goodjunk',
      difficulty:diff,
      duration:dur,
      goalsAll,
      minisAll,
      // สำรองค่า summary ตรง ๆ ให้ main.js ใช้ได้เลยถ้าอยาก
      goalCleared: goalsAll[0].done,
      questsTotal:  1,
      questsCleared: missMini.done ? 1 : 0
    });
  }

  function start(){
    if(running) return;
    running = true;
    timeLeft = dur;
    score = 0; combo = 0; comboMax = 0; misses = 0; hits = 0;

    emit('hha:time',{sec:timeLeft});
    emit('hha:score',{delta:0,total:score,combo,comboMax,good:null});
    updateQuests();

    spawnTimer = setInterval(spawnOne, cfg.spawn);
    tickTimer  = setInterval(tick, 1000);

    // spawn แรกทันที
    spawnOne();
  }

  function stop(){
    endGame();
  }

  return { start, stop };
}
