// === /HeroHealth/modes/goodjunk.safe.js ====
// Good vs Junk (DOM version) + Quest Director + Score FX on target

import { createGoodJunkQuest } from './goodjunk.quest.js';

// ---------- Config ----------

const GOOD = ['🍎','🍓','🍇','🥦','🥕','🍅','🥬','🍊','🍌','🫐','🍐','🍍','🍋','🍉','🥝','🍚','🥛','🍞','🐟','🥗'];
const JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🥓','🍫','🌭'];

const DIFF_PRESET = {
  easy:   { spawnInterval: 850, life: 1600, goodScore: 90,  badPenalty: -40 },
  normal: { spawnInterval: 700, life: 1400, goodScore: 100, badPenalty: -50 },
  hard:   { spawnInterval: 560, life: 1250, goodScore: 110, badPenalty: -60 }
};

// ---------- Small helpers ----------

function randItem(arr){
  return arr[(Math.random() * arr.length) | 0];
}

function clamp(n, a, b){
  return Math.max(a, Math.min(b, n));
}

function ensureCSS(){
  const id = 'goodjunk-css';
  if (document.getElementById(id)) return;
  const css = document.createElement('style');
  css.id = id;
  css.textContent = `
    #spawnHost.goodjunk-host{
      position:absolute; inset:0; pointer-events:none;
    }
    .gj-target{
      position:absolute;
      width:96px; height:96px;
      transform:translate(-50%,-50%);
      display:flex; align-items:center; justify-content:center;
      pointer-events:auto;
      cursor:pointer;
      user-select:none; -webkit-user-select:none;
      touch-action:manipulation;
      transition:transform .08s ease, opacity .12s ease;
      will-change:transform, opacity;
      filter:drop-shadow(0 10px 16px rgba(0,0,0,.45));
    }
    .gj-emoji{
      font-size:64px;
      pointer-events:none;
    }
    .gj-good.hit  { transform:translate(-50%,-50%) scale(.75); opacity:.0; }
    .gj-bad.hit   { transform:translate(-50%,-50%) scale(.75); opacity:.0; }
    .gj-fade      { opacity:0; transform:translate(-50%,-50%) scale(.8); }

    /* score pop */
    .gj-score-fx{
      position:fixed;
      transform:translate(-50%,-50%);
      font:900 18px system-ui;
      color:#e5e7eb;
      text-shadow:0 2px 10px rgba(0,0,0,.7);
      pointer-events:none;
      z-index:900;
      opacity:0;
      transition:transform .45s ease, opacity .45s ease;
    }
    .gj-score-fx.good{ color:#bbf7d0; }
    .gj-score-fx.bad { color:#fecaca; }
    .gj-score-fx.show{
      opacity:1;
      transform:translate(-50%,-50%) translateY(-26px);
    }

    .gj-burst-dot{
      position:fixed;
      width:7px; height:7px;
      border-radius:999px;
      background:#22c55e;
      pointer-events:none;
      z-index:880;
      opacity:.98;
      transition:transform .45s ease, opacity .45s ease;
      transform:translate(-50%,-50%);
    }
  `;
  document.head.appendChild(css);
}

function scoreFXAtElement(el, text, isGood){
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  scoreFXAt(x, y, text, isGood);
}

function scoreFXAt(x, y, text, isGood){
  // score label
  const fx = document.createElement('div');
  fx.className = 'gj-score-fx ' + (isGood ? 'good' : 'bad');
  fx.textContent = (text || (isGood ? '+100' : '-50'));
  fx.style.left = x + 'px';
  fx.style.top  = y + 'px';
  document.body.appendChild(fx);
  requestAnimationFrame(() => fx.classList.add('show'));
  setTimeout(() => { try{ fx.remove(); }catch(_){ } }, 500);

  // burst dots
  const dots = 14;
  for (let i=0;i<dots;i++){
    const d = document.createElement('div');
    d.className = 'gj-burst-dot';
    d.style.left = x + 'px';
    d.style.top  = y + 'px';
    if (!isGood) d.style.background = '#ef4444';
    document.body.appendChild(d);
    const ang = Math.random() * Math.PI * 2;
    const r   = 26 + Math.random()*30;
    const tx  = Math.cos(ang)*r;
    const ty  = Math.sin(ang)*r - 4;
    requestAnimationFrame(()=>{
      d.style.transform = `translate(-50%,-50%) translate(${tx}px,${ty}px)`;
      d.style.opacity   = '0';
    });
    setTimeout(()=>{ try{ d.remove(); }catch(_){ } }, 480);
  }
}

// ---------- Main boot ----------

export async function boot(opts){
  const diff = (opts?.difficulty || 'normal').toLowerCase();
  const duration = opts?.duration || 60;
  const cfg = DIFF_PRESET[diff] || DIFF_PRESET.normal;

  ensureCSS();

  const host = document.getElementById('spawnHost') || document.body;
  host.classList.add('goodjunk-host');

  // --- Quest director ---
  const quest = createGoodJunkQuest(diff);

  // --- game state ---
  let running  = false;
  let score    = 0;
  let goodHits = 0;
  let miss     = 0;
  let comboNow = 0;
  let comboMax = 0;
  let timeLeft = duration;

  let spawnTimer = null;
  const liveTargets = new Set();

  // ---------- hooks into HUD / quest ----------

  function pushQuestUpdate(){
    quest.update({ score, goodHits, miss, comboMax, timeLeft });
  }

  function emitScore(delta, isGood){
    score = Math.max(0, score + (delta|0));
    if (isGood) goodHits++;
    window.dispatchEvent(new CustomEvent('hha:score',{
      detail:{ delta, total:score, good:isGood }
    }));
    pushQuestUpdate();
  }

  function onMiss(){
    miss++;
    comboNow = 0;
    window.dispatchEvent(new CustomEvent('hha:score',{
      detail:{ delta:0, total:score, good:false }
    }));
    window.dispatchEvent(new CustomEvent('hha:combo',{
      detail:{ combo:comboNow, comboMax }
    }));
    pushQuestUpdate();
  }

  function onComboChange(n){
    comboNow = n|0;
    comboMax = Math.max(comboMax, comboNow);
    window.dispatchEvent(new CustomEvent('hha:combo',{
      detail:{ combo:comboNow, comboMax }
    }));
    pushQuestUpdate();
  }

  // ---------- target spawn & hit logic ----------

  function makeTarget(isGood){
    const el = document.createElement('div');
    el.className = 'gj-target ' + (isGood ? 'gj-good' : 'gj-bad');
    const emoji = document.createElement('div');
    emoji.className = 'gj-emoji';
    emoji.textContent = isGood ? randItem(GOOD) : randItem(JUNK);
    el.appendChild(emoji);

    // random position (กลางจอเป็นหลัก)
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const px = clamp(0.2 + Math.random()*0.6, 0.15, 0.85);  // ไม่ชิดขอบเกินไป
    const py = clamp(0.30 + Math.random()*0.45, 0.25, 0.8);

    el.style.left = (px * vw) + 'px';
    el.style.top  = (py * vh) + 'px';

    const life = cfg.life + (Math.random()*200 - 100);

    let killed = false;
    const clearSelf = (asMiss=false)=>{
      if (killed) return;
      killed = true;
      liveTargets.delete(el);
      if (asMiss) onMiss();
      el.classList.add('gj-fade');
      setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 130);
    };

    const lifeTimer = setTimeout(()=>{
      if (!running){ try{ el.remove(); }catch(_){ } return; }
      // ถือว่า "พลาด" เฉพาะของดีที่ไม่เก็บ
      if (isGood) clearSelf(true);
      else clearSelf(false);
    }, life);

    el.__gj_kill = (asMiss)=>{
      clearTimeout(lifeTimer);
      clearSelf(asMiss);
    };

    el.addEventListener('pointerdown', (ev)=>{
      if (!running) return;
      ev.preventDefault();
      // ถ้ากดเป้าแล้ว
      el.classList.add('hit');
      el.__gj_kill(false);

      const goodHit = isGood === true;
      if (goodHit){
        const base  = cfg.goodScore;
        const bonus = comboNow * 4; // เล็กน้อยตามคอมโบ
        const delta = base + bonus;
        onComboChange(comboNow + 1);
        emitScore(delta, true);
        scoreFXAtElement(el, `+${delta}`, true);
        // coach เล็กน้อย
        if (comboNow === 5 || comboNow === 10){
          window.dispatchEvent(new CustomEvent('hha:coach',{
            detail:{ text:`คอมโบต่อเนื่อง ${comboNow} ครั้ง เยี่ยมมาก!` }
          }));
        }
      }else{
        onMiss();
        const delta = cfg.badPenalty;
        emitScore(delta, false);
        scoreFXAtElement(el, `${delta}`, false);
        window.dispatchEvent(new CustomEvent('hha:coach',{
          detail:{ text:'ระวังของขยะนะ เลือกของดีเท่านั้น!' }
        }));
      }
    });

    host.appendChild(el);
    liveTargets.add(el);
  }

  function spawnLoop(){
    if (!running) return;
    const goodBias = 0.68; // ส่วนใหญ่เป็นของดี
    const isGood = Math.random() < goodBias;
    makeTarget(isGood);
  }

  // ---------- timer / game-end ----------

  let mainTimer = null;

  function startTimers(){
    running = true;

    spawnTimer = setInterval(spawnLoop, cfg.spawnInterval);
    // เริ่ม Quest ชุดแรก
    quest.start({ timeLeft });
    pushQuestUpdate();

    mainTimer = setInterval(()=>{
      if (!running) return;
      timeLeft--;
      if (timeLeft < 0) timeLeft = 0;
      window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:timeLeft}}));
      pushQuestUpdate();

      if (timeLeft <= 0){
        endGame();
      }
    }, 1000);
  }

  function stopTimers(){
    running = false;
    if (spawnTimer){ clearInterval(spawnTimer); spawnTimer = null; }
    if (mainTimer){ clearInterval(mainTimer); mainTimer = null; }
  }

  function endGame(){
    if (!running) return;
    stopTimers();
    // ล้างเป้าที่เหลือ
    liveTargets.forEach(el=>{
      try{ el.remove(); }catch(_){}
    });
    liveTargets.clear();

    const sum = quest.summary();
    window.dispatchEvent(new CustomEvent('hha:end',{
      detail:{
        score,
        misses: miss,
        comboMax,
        goalCleared: (sum.goalsCleared >= sum.goalsTotal),
        questsCleared: sum.miniCleared,
        questsTotal:  sum.miniTotal
      }
    }));
  }

  // ---------- public controller ----------

  return {
    start(){
      // reset ทุกอย่างก่อน
      score    = 0;
      goodHits = 0;
      miss     = 0;
      comboNow = 0;
      comboMax = 0;
      timeLeft = duration;

      window.dispatchEvent(new CustomEvent('hha:score',{
        detail:{ delta:0, total:0, good:true }
      }));
      window.dispatchEvent(new CustomEvent('hha:combo',{
        detail:{ combo:0, comboMax:0 }
      }));
      window.dispatchEvent(new CustomEvent('hha:time',{
        detail:{ sec:timeLeft }
      }));

      startTimers();
      window.dispatchEvent(new CustomEvent('hha:coach',{
        detail:{ text:'เลือกของดี เก็บต่อเนื่องให้คอมโบยาวที่สุด!' }
      }));
    }
  };
}
