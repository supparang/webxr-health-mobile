// === /HeroHealth/modes/plate.safe.js (2025-11-13, 5-Group Plate + Quest + Coach) ===
import { createPlateDeck } from './plate.quest.js';
import { MissionDeck } from '../vr/mission.js';
import { Particles } from '../vr/particles.js';

export const name = 'plate';

/*
  Gameplay concept:
  - อาหาร 5 หมู่ (GOOD) กระจายบนจอ → แตะแล้วเก็บ
  - อาหาร JUNK (เช่น เบคอน, ของทอด, ขนมหวานมัน ๆ) → แตะแล้วนับพลาด
  - ใช้ MissionDeck จาก plate.quest.js:
      * Goal:   จัด "จาน 5 หมู่" ให้ครบ N จาน (ขึ้นอยู่กับ diff)
      * Minis:  คอมโบต่อเนื่อง, พลาดไม่เกิน X ครั้ง, เก็บของดีให้ได้มากกว่า Y ชิ้น
*/

const $  = (s)=>document.querySelector(s);

// --------- Food pools (5 หมู่ + junk) ----------
const GROUPS = [
  { id:'grain',   label:'ข้าว-แป้ง',  emo:['🍚','🍞','🥐','🥨','🥖'] },
  { id:'protein', label:'โปรตีน',     emo:['🍗','🍖','🥚','🥩','🐟'] },
  { id:'veg',     label:'ผัก',        emo:['🥦','🥬','🥕','🍅','🫑'] },
  { id:'fruit',   label:'ผลไม้',      emo:['🍎','🍌','🍇','🍊','🍉'] },
  { id:'milk',    label:'นม-แคลเซียม', emo:['🥛','🧀','🍶','🍨'] }
];

const JUNK = ['🍟','🍔','🌭','🍕','🍩','🧁','🍰','🥤','🧋'];

function rand(arr){ return arr[(Math.random()*arr.length)|0]; }

// difficulty config
const DIFF_CFG = {
  easy:   { baseSpawn: 900,  minSpawn: 700,  maxSpawn: 1300, goodScore: 80,  badScore: -60 },
  normal: { baseSpawn: 750,  minSpawn: 550,  maxSpawn: 1100, goodScore: 90,  badScore: -70 },
  hard:   { baseSpawn: 600,  minSpawn: 450,  maxSpawn: 950,  goodScore: 100, badScore: -80 }
};

function clamp(n,a,b){ return Math.max(a, Math.min(b, n)); }

export async function boot(opts = {}){
  const difficulty = String(opts.difficulty || 'normal').toLowerCase();
  const D = DIFF_CFG[difficulty] || DIFF_CFG.normal;
  const duration = (opts.duration|0) || 60;

  let host = document.getElementById('spawnHost');
  if (!host){
    host = document.createElement('div');
    host.id = 'spawnHost';
    Object.assign(host.style,{
      position:'fixed', inset:'0', pointerEvents:'none', zIndex:'650'
    });
    document.body.appendChild(host);
  }

  // ---------- Mission Deck ----------
  const deck = createPlateDeck({ difficulty });

  function pushQuestHUD(){
    const goal = deck.getCurrent('goals');
    const mini = deck.getCurrent('mini');
    window.dispatchEvent(new CustomEvent('hha:quest',{
      detail:{ goal, mini }
    }));
  }

  // ---------- State ----------
  let running   = false;
  let score     = 0;
  let combo     = 0;
  let timeLeft  = duration;
  let spawnTimer = null;
  let tickTimer  = null;

  // ---------- Helpers ----------
  function emitScore(delta, isGood, screenPos){
    score = Math.max(0, score + (delta|0));
    combo = isGood ? combo+1 : 0;

    // sync กับ deck
    deck.updateScore(score);
    deck.updateCombo(combo);
    if (isGood) deck.onGood(); else deck.onJunk();

    // HUD score/ combo
    window.dispatchEvent(new CustomEvent('hha:score',{
      detail:{
        delta, good:isGood, total:score,
        combo, comboMax: deck.stats.comboMax|0
      }
    }));

    // FX คะแนน / แตกกระจายตรงเป้า
    if (screenPos){
      const { x, y } = screenPos;
      try{
        Particles.scorePop?.({ screen:{x,y}, value: delta });
      }catch(_){}
      try{
        Particles.burstShards?.(null, { screen:{x,y} , color: isGood?'#22c55e':'#ef4444'});
      }catch(_){}
    }

    pushQuestHUD();
  }

  function emitCoach(text){
    window.dispatchEvent(new CustomEvent('hha:coach',{ detail:{ text } }));
  }

  function emitTime(){
    window.dispatchEvent(new CustomEvent('hha:time',{ detail:{ sec: timeLeft }}));
  }

  function randomSpawnDelay(){
    // ยิ่ง goodCount สูง → spawn ถี่ขึ้น
    const progress = clamp(deck.stats.goodCount / 30, 0, 1); // 0–1
    const base = D.baseSpawn - progress*250;
    const jitter = 200 + Math.random()*200;
    return clamp(base + (Math.random()*2-1)*jitter, D.minSpawn, D.maxSpawn);
  }

  function spawnOne(){
    if (!running) return;

    const isJunk = Math.random() < 0.2; // 20% เป็น junk
    const group  = rand(GROUPS);
    const emo    = isJunk ? rand(JUNK) : rand(group.emo);

    const node = document.createElement('div');
    node.className = 'plate-item';
    node.textContent = emo;
    node.dataset.group = isJunk ? 'junk' : group.id;
    node.dataset.good  = isJunk ? '0' : '1';

    const hostRect = host.getBoundingClientRect();
    const x = hostRect.left + 40 + Math.random()*(hostRect.width-80);
    const y = hostRect.top  + 80 + Math.random()*(hostRect.height-200);

    Object.assign(node.style,{
      position:'absolute',
      left: (x - hostRect.left)+'px',
      top:  (y - hostRect.top)+'px',
      transform:'translate(-50%, -50%) scale(0.9)',
      font:'800 52px system-ui',
      filter:'drop-shadow(0 12px 28px rgba(0,0,0,.55))',
      cursor:'pointer',
      pointerEvents:'auto',
      transition:'transform .15s ease, opacity .15s ease'
    });

    function handleClick(ev){
      if (!running) return;
      ev.preventDefault();
      ev.stopPropagation();

      node.style.pointerEvents='none';

      const rect = node.getBoundingClientRect();
      const sx = rect.left + rect.width/2;
      const sy = rect.top  + rect.height/2;

      const good = node.dataset.good === '1';
      const delta = good ? D.goodScore : D.badScore;

      emitScore(delta, good, {x:sx, y:sy});

      // เล็กน้อย: zoom แล้วจางหาย
      requestAnimationFrame(()=>{
        node.style.transform = 'translate(-50%, -50%) scale(1.15)';
        node.style.opacity   = '0';
      });
      setTimeout(()=>{ try{ node.remove(); }catch(_){ } }, 180);
    }

    node.addEventListener('click', handleClick, {passive:false});
    host.appendChild(node);
  }

  function clearAllItems(){
    host.querySelectorAll('.plate-item').forEach(el=>{
      try{ el.remove(); }catch(_){}
    });
  }

  function scheduleSpawn(){
    if (!running) return;
    const delay = randomSpawnDelay();
    spawnTimer = setTimeout(()=>{
      spawnOne();
      scheduleSpawn();
    }, delay);
  }

  function tick(){
    if (!running) return;
    timeLeft -= 1;
    if (timeLeft < 0) timeLeft = 0;
    deck.second();
    emitTime();
    pushQuestHUD();

    if (timeLeft <= 0){
      endGame();
    }
  }

  function computeQuestSummary(){
    const goalProg = deck.getProgress('goals');
    const miniProg = deck.getProgress('mini');

    const goalCleared = deck.isCleared('goals');
    const questsTotal  = miniProg.length;
    const questsCleared = miniProg.filter(q => q.done).length;

    return { goalCleared, questsCleared, questsTotal };
  }

  function endGame(){
    if (!running) return;
    running = false;

    clearTimeout(spawnTimer);
    clearInterval(tickTimer);
    clearAllItems();

    const qs = computeQuestSummary();

    window.dispatchEvent(new CustomEvent('hha:end',{
      detail:{
        mode:        'plate',
        difficulty:  difficulty,
        score,
        misses:      deck.stats.junkMiss|0,
        comboMax:    deck.stats.comboMax|0,
        duration:    (opts.duration|0) || 60,
        goalCleared: qs.goalCleared,
        questsCleared: qs.questsCleared,
        questsTotal: qs.questsTotal
      }
    }));
  }

  // ---------- Controller ----------
  function start(){
    if (running) return;
    running = true;

    score = 0;
    combo = 0;
    timeLeft = duration;

    deck.stats.score = 0;
    deck.stats.combo = 0;
    deck.stats.comboMax = 0;
    deck.stats.goodCount = 0;
    deck.stats.junkMiss  = 0;
    deck.stats.tick      = 0;

    clearAllItems();
    emitTime();
    pushQuestHUD();

    emitCoach('ลองจัดจานให้ครบ 5 หมู่ให้ได้หลาย ๆ จานนะ!');

    scheduleSpawn();
    tickTimer = setInterval(tick, 1000);
  }

  function stop(){
    endGame();
  }

  return {
    start,
    stop,
    dispose: stop
  };
}
