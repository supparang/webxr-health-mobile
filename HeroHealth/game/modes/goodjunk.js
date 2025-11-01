// === modes/goodjunk.js — Quest-by-quest + Fever + 3D explode effect ===
export const name = 'goodjunk';

// Pools
const GOOD = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛','🍇','🍓','🍊','🍅','🍆','🥬','🥝','🍍','🍐','🍑'];
const JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍗','🍖','🍫','🥓','🍿','🧈','🧂'];
const POWERS = ['star','shield']; // star = golden (x2 points + fever boost), shield = skip-miss 1 ครั้ง

// Internal state
let host = null, alive = false, diff = 'Normal';
let rate = 0.70, life = 1.6, age = 0;
let fever = 0, feverTime = 0, feverActive = false;
let shield = 0;
let questIdx = 0, quests = [];
let stat = { hits:0, perfect:0, miss:0, feverOpen:0, stars:0, bestStreak:0, streak:0 };

// UI sizes per difficulty
const SIZE_BY_DIFF = { Easy: 56, Normal: 44, Hard: 36 };

export function create({ engine, hud, coach }) {
  return {
    start(opts={}) {
      host = document.getElementById('spawnHost') || ensureHost();
      host.innerHTML = '';
      alive = true;
      diff = String((opts?.difficulty || document.body.getAttribute('data-diff') || 'Normal'));
      ({ rate, life } = tuneByDiff(diff));
      age = 0;
      fever = 0; feverTime = 0; feverActive = false;
      shield = 0;
      stat = { hits:0, perfect:0, miss:0, feverOpen:0, stars:0, bestStreak:0, streak:0 };
      // Build quest list (10 แบบสุ่ม แต่แสดงทีละอัน)
      quests = buildQuestList();
      questIdx = 0;
      notifyQuest(hud, coach);
      hud?.setQuestChips?.([currentQuestChip()]);
    },
    update(dt, bus) {
      if (!alive) return;
      // Fever ticking
      if (feverActive) {
        feverTime -= dt;
        if (feverTime <= 0) {
          feverActive = false;
          fever = Math.min(fever, 90);
          bus?.fever?.({ active:false, value:fever });
        }
      }
      // Spawn by rate (boosted in fever)
      age += dt;
      const spawnRate = rate * (feverActive ? 0.5 : 1); // เร็วขึ้นตอน fever
      if (age >= spawnRate) {
        age -= spawnRate;
        // limit on-screen items
        if (host.childElementCount < 18) {
          const roll = Math.random();
          if (roll < 0.10) spawnPower(bus); else spawnOne(bus);
        }
      }
      // Cleanup stray children (safety)
      if (host.childElementCount > 28) {
        [...host.children].slice(0, host.childElementCount - 20).forEach(n=>n.remove());
      }
    },
    cleanup() {
      alive = false;
      try { host && (host.innerHTML=''); } catch {}
    },
    // Bonus: profile helpers
    pickMeta(){ return { questTotal: quests.length, questDone: questIdx, feverTimes: stat.feverOpen, stars: stat.stars }; }
  };

  // ---- helpers ----
  function ensureHost(){
    const h = document.createElement('div');
    h.id = 'spawnHost';
    h.style.cssText = 'position:fixed;inset:0;pointer-events:auto;z-index:5;';
    document.body.appendChild(h);
    return h;
  }

  function tuneByDiff(d) {
    if (d === 'Easy')   return { rate:0.85, life:1.95 };
    if (d === 'Hard')   return { rate:0.56, life:1.40 };
    return               { rate:0.70, life:1.60 };
  }

  function spawnOne(bus){
    const isGolden = Math.random() < 0.12;
    const isGood   = isGolden || Math.random() < 0.70;
    const glyph    = isGolden ? '🌟' : (isGood ? pick(GOOD) : pick(JUNK));
    const size     = SIZE_BY_DIFF[diff] || 44;

    const d = document.createElement('button');
    d.className = 'spawn-emoji';
    d.type = 'button';
    d.dataset.good = isGood ? '1':'0';
    d.dataset.golden = isGolden ? '1':'0';
    d.textContent = glyph;
    Object.assign(d.style,{
      position:'absolute', border:'0', background:'transparent',
      fontSize:size+'px', transform:'translate(-50%,-50%)',
      filter:'drop-shadow(0 6px 12px rgba(0,0,0,.45))', willChange:'transform, opacity'
    });
    placeRandom(d);

    const ms = Math.floor((life + (isGolden?0.2:0)) * (feverActive?0.8:1) * 1000);
    const to = setTimeout(()=>{ try{d.remove();}catch{} onMiss(bus); }, ms);

    d.addEventListener('click', ev=>{
      clearTimeout(to);
      try{ d.remove(); }catch{}
      hitEffect(ev.clientX, ev.clientY, d.textContent); // 3D explode-ish
      if (isGood){
        stat.hits++; stat.streak++; stat.bestStreak = Math.max(stat.bestStreak, stat.streak);
        const perfect = isGolden || Math.random() < 0.22;
        if (perfect) stat.perfect++;
        const pts = (perfect ? 200 : 100) * (feverActive ? 1.5 : 1);
        if (isGolden) { stat.stars++; fever = Math.min(100, fever + 18); }
        else          { fever = Math.min(100, fever + 6); }
        // open fever?
        if (!feverActive && fever >= 100) {
          feverActive = true; stat.feverOpen++;
          feverTime = 7; // seconds
          fever = 0;
          bus?.fever?.({ active:true, value:100, time:feverTime });
        } else {
          bus?.fever?.({ active:feverActive, value:fever });
        }
        // score + quest progress
        bus?.hit?.({ kind:(perfect?'perfect':'good'), points:Math.round(pts), ui:{ x:ev.clientX, y:ev.clientY } });
        progressQuest({ good:isGood, golden:isGolden }, bus);
      } else {
        onMiss(bus);
      }
    }, { passive:true });

    host.appendChild(d);
  }

  function spawnPower(bus){
    const kind = pick(POWERS);
    const d = document.createElement('button');
    d.className = 'spawn-emoji power';
    d.type = 'button';
    d.textContent = (kind==='star'?'★':'🛡️');
    Object.assign(d.style,{
      position:'absolute', border:'0', background:'transparent', fontSize:'42px',
      transform:'translate(-50%,-50%)', filter:'drop-shadow(0 8px 14px rgba(10,120,160,.6))'
    });
    placeRandom(d);
    const ms = Math.floor((life+0.2)*1000);
    const to = setTimeout(()=>{ try{d.remove();}catch{} }, ms);

    d.addEventListener('click', ev=>{
      clearTimeout(to); try{ d.remove(); }catch{}
      if (kind==='star'){ fever = Math.min(100, fever + 26); stat.stars++; }
      if (kind==='shield'){ shield = Math.min(2, shield + 1); }
      bus?.power?.(kind);
      bus?.hit?.({ kind:'good', points:0, ui:{x:ev.clientX, y:ev.clientY} });
      if (!feverActive && fever >= 100) {
        feverActive = true; stat.feverOpen++; feverTime = 7; fever = 0;
        bus?.fever?.({ active:true, value:100, time:feverTime });
      } else {
        bus?.fever?.({ active:feverActive, value:fever });
      }
    }, { passive:true });

    host.appendChild(d);
  }

  function onMiss(bus){
    if (shield > 0) { shield--; return; }
    stat.streak = 0;
    bus?.miss?.();
  }

  function placeRandom(d){
    const pad=48, W=innerWidth, H=innerHeight;
    const x = Math.floor(pad + Math.random()*(W - pad*2));
    const y = Math.floor(pad + Math.random()*(H - pad*2 - 140));
    d.style.left = x+'px';
    d.style.top  = y+'px';
  }

  function pick(arr){ return arr[(Math.random()*arr.length)|0]; }

  // 3D-ish explode (DOM shards)
  function hitEffect(x,y,ch){
    const n = 10 + ((Math.random()*10)|0);
    for (let i=0;i<n;i++){
      const s = document.createElement('div');
      s.textContent = ch;
      s.style.cssText = `position:fixed;left:${x}px;top:${y}px;transform:translate(-50%,-50%) scale(${0.6+Math.random()*0.6});
        font:900 18px ui-rounded,system-ui;pointer-events:none;opacity:1;z-index:2000;filter:drop-shadow(0 4px 10px rgba(0,0,0,.6))`;
      document.body.appendChild(s);
      const ang = Math.random()*Math.PI*2;
      const dist = 40 + Math.random()*90;
      const tx = x + Math.cos(ang)*dist;
      const ty = y + Math.sin(ang)*dist;
      requestAnimationFrame(()=>{
        s.style.transition = 'transform .7s cubic-bezier(.2,.8,.2,1), opacity .7s';
        s.style.transform  = `translate(${tx-x}px,${ty-y}px) scale(.1) rotate(${(Math.random()*720-360)|0}deg)`;
        s.style.opacity    = '0';
      });
      setTimeout(()=>{ try{s.remove();}catch{} }, 720);
    }
  }

  // ===== Quests: one-by-one (10 random) =====
  function buildQuestList(){
    const bag = [
      { key:'good12',  icon:'🥗', label:'Collect Good x12',     need:12, cond:ev=>ev.good===true },
      { key:'gold3',   icon:'🌟', label:'Hit Golden x3',        need:3,  cond:ev=>ev.golden===true },
      { key:'streak8', icon:'⚡', label:'Get Streak x8',        need:8,  tick:()=>stat.streak>=(this.need||8) },
      { key:'shield1', icon:'🛡️', label:'Grab 1 Shield',       need:1,  power:'shield' },
      { key:'star1',   icon:'★',  label:'Grab 1 Star',         need:1,  power:'star' },
      { key:'good20',  icon:'🥗', label:'Collect Good x20',     need:20, cond:ev=>ev.good===true },
      { key:'streak12',icon:'⚡', label:'Get Streak x12',       need:12, tick:()=>stat.streak>=(this.need||12) },
      { key:'fever1',  icon:'🔥', label:'Trigger FEVER',        need:1,  fever:true },
      { key:'perfect5',icon:'✨', label:'Make PERFECT x5',      need:5,  acc:'perfect' },
      { key:'score1k', icon:'🏆', label:'Reach 1000 pts',       need:1000, score:true }
    ];
    // shuffle and cut 10
    for (let i=bag.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [bag[i],bag[j]]=[bag[j],bag[i]]; }
    return bag.slice(0,10).map(q=>({ ...q, progress:0, done:false }));
  }

  function currentQuest(){ return quests[questIdx] || null; }
  function currentQuestChip(){
    const q = currentQuest(); if (!q) return { icon:'🏁', label:'ALL MISSIONS CLEAR', progress:1, need:1, done:true };
    return { icon:q.icon, label:q.label, progress:q.progress, need:q.need, done:q.done };
  }

  function progressQuest(ev, bus){
    const q = currentQuest(); if (!q) return;
    // count by condition
    if (q.cond && q.cond(ev)) q.progress++;
    if (q.power && (ev.powerKind===q.power)) q.progress++;
    if (q.fever && feverActive) q.progress = Math.max(q.progress, 1);
    if (q.acc==='perfect' && ev.golden) q.progress++; // golden นับ perfect ไปด้วย
    // Streak/Score live-rule
    if (q.tick && q.tick.call(q)) q.progress = q.need;
    if (q.score) q.progress = Math.min(q.need, (window.HHA_SCORE_NOW||0));

    // clamp & check
    q.progress = Math.min(q.progress|0, q.need|0);
    const chip = currentQuestChip();
    bus?.quest?.({ index:questIdx+1, total:quests.length, chip, done:false });

    if (q.progress >= q.need) {
      q.done = true;
      bus?.quest?.({ index:questIdx+1, total:quests.length, chip:{...chip, done:true}, done:true });
      questIdx++;
      if (questIdx >= quests.length) {
        bus?.doneAll?.({ quests, stat });
      } else {
        notifyQuest(null, null, bus); // tell UI next quest
      }
    }
  }

  function notifyQuest(hud, coach, bus){
    const q = currentQuest();
    const msg = q ? (`MISSION: ${q.label}`) : 'ALL MISSIONS CLEAR 🎉';
    coach?.say?.(msg);
    hud?.setQuestChips?.([currentQuestChip()]);
    bus?.quest?.({ index:questIdx+1, total:quests.length, chip:currentQuestChip(), done:false });
  }
}
