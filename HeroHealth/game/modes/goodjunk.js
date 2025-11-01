// === Hero Health Academy — game/modes/goodjunk.js
// DOM-spawn 3D-like items + explode FX + Star/Shield powerups + 10 Mini-Quests
export const name = 'goodjunk';

// -------------------- Pools --------------------
const GOOD = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛','🍇','🍓','🍊','🍅','🍆','🥬','🥝','🍍','🍐','🍑'];
const JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍫','🍭','🍨'];

const STAR   = '⭐';
const SHIELD = '🛡️';

// -------------------- Factory --------------------
export function create({ engine, hud, coach }) {
  const host = ensureHost();
  injectCSS();

  const state = {
    host,
    items: [],
    t: 0,
    spawnAcc: 0,
    spawnEvery: 0.7,    // จะปรับตามระดับความยาก
    fallSpeed: 160,     // px/sec ปรับตามความยาก
    size: 72,           // ไอคอนใหญ่/เล็กตามความยาก
    power: { shield: false, shieldTime: 0, stars: 0 },
    running: false,
    quests: null,
    questList: [],
    questMap: {},
    diff: 'Normal',
    timeLeft: 45,
    scoreRef: null,     // จะรับจาก bus ผ่าน hit/miss (ไม่จำเป็นก็ได้)
  };

  // -------- Difficulty profile --------
  const DIFF = {
    Easy:   { spawn: 0.9,  fall: 130, size: 86,  goodPts: 10, junkPts: -0, starPts: 25 },
    Normal: { spawn: 0.7,  fall: 160, size: 76,  goodPts: 12, junkPts: -0, starPts: 25 },
    Hard:   { spawn: 0.55, fall: 190, size: 68,  goodPts: 14, junkPts: -0, starPts: 30 },
  };

  function applyDiff(d = 'Normal') {
    state.diff = d;
    const cfg = DIFF[d] || DIFF.Normal;
    state.spawnEvery = cfg.spawn;
    state.fallSpeed  = cfg.fall;
    state.size       = cfg.size;
  }

  // -------- Mini Quests (10 types) --------
  // จะสุ่มขึ้นมา 3 เควสต์ทุกเกม และอัปเดต HUD chips เอง
  const QUEST_POOL = [
    { key:'collectGood', icon:'🥗', label:'เก็บอาหารดี', need: 20,           kind:'counter' },
    { key:'avoidJunk',   icon:'🚫', label:'เลี่ยงของไม่ดี', need: 8,         kind:'avoidJunk' },
    { key:'combo10',     icon:'🔥', label:'คอมโบต่อเนื่อง', need: 10,       kind:'maxCombo' },
    { key:'stars',       icon:'⭐', label:'เก็บดาว',        need: 2,         kind:'stars' },
    { key:'shields',     icon:'🛡️', label:'เก็บโล่',       need: 1,         kind:'shields' },
    { key:'perfect5',    icon:'💯', label:'กดเป๊ะ 5 ครั้ง', need: 5,        kind:'perfects' },
    { key:'good40',      icon:'⚡', label:'คะแนนถึง',       need: 40,        kind:'score' },
    { key:'good60',      icon:'⚡', label:'คะแนนถึง',       need: 60,        kind:'score' },
    { key:'good80',      icon:'⚡', label:'คะแนนถึง',       need: 80,        kind:'score' },
    { key:'streakNoBad', icon:'🧠', label:'ไม่พลาด 12 ครั้ง', need: 12,     kind:'noBadStreak' },
  ];

  const questRuntime = {
    collectGood: 0,
    avoidJunk: 0,
    perfects: 0,
    stars: 0,
    shields: 0,
    score: 0,
    maxCombo: 0,
    noBadStreak: 0,
  };

  function pickQuests() {
    // สุ่ม 3 เควสต์ โดยทำให้ "score" ไม่ซ้ำกันหลายอัน (จะเลือกอันความต้องการสูงสุดอันเดียว)
    const pool = QUEST_POOL.slice();
    // ลดโอกาสได้ score หลายตัว
    const scores = pool.filter(q=>q.kind==='score');
    const others = pool.filter(q=>q.kind!=='score');
    const chosen = [];
    shuffle(others);
    chosen.push(...others.slice(0,2));
    // เติมอีก 1 จาก score แบบสุ่ม
    chosen.push(scores[Math.floor(Math.random()*scores.length)]);
    // map และแสดง HUD
    state.questList = chosen.map(q => ({ ...q, progress:0, done:false, fail:false }));
    state.questMap = Object.fromEntries(state.questList.map(q => [q.key, q]));
    refreshQuestChips();
  }

  function refreshQuestChips() {
    hud?.setQuestChips?.(state.questList.map(q => ({
      key: q.key, icon: q.icon, label: q.label, progress: q.progress|0, need: q.need|0, done: !!q.done, fail: !!q.fail
    })));
  }

  function onGoodHit(kind, points, comboNow) {
    questRuntime.collectGood++;
    questRuntime.maxCombo = Math.max(questRuntime.maxCombo|0, comboNow|0);
    addProgress('collectGood', 1);
    addProgressForKind('maxCombo', questRuntime.maxCombo);
    // perfect นับเฉพาะ kind === 'perfect'
    if (kind === 'perfect') { questRuntime.perfects++; addProgress('perfect5', 1); }
  }
  function onBadHit() {
    // นับ avoidJunk (เลี่ยง) ถ้าเราคิดเป็น "สะสมจนกว่าจะพลาด" ก็รีเซ็ตได้
    // ในที่นี้จะให้ "avoidJunk" นับว่าเรา *เก็บของดี* ต่อเนื่องโดยไม่กดของไม่ดี:
    questRuntime.noBadStreak = 0; // สายทางเลือก: พลาด = รีเซ็ต noBadStreak streak
  }
  function onMissJunk() {
    // ไม่โดนปรับอะไร แต่ถ้าจะตีความ avoidJunk เป็น "จำนวนครั้งที่ Junk โผล่มาแล้วไม่กด" ต้องนับที่นี่
  }
  function onGoodStreak() {
    questRuntime.noBadStreak++;
    addProgressForKind('noBadStreak', questRuntime.noBadStreak);
  }
  function onGainStar() {
    questRuntime.stars++;
    addProgress('stars', 1);
  }
  function onGainShield() {
    questRuntime.shields++;
    addProgress('shields', 1);
  }
  function onScoreChanged(score) {
    questRuntime.score = score|0;
    addProgressForKind('score', questRuntime.score);
  }

  function addProgress(key, inc) {
    const q = state.questMap[key]; if (!q) return;
    q.progress = Math.min(q.need, (q.progress|0) + (inc|0));
    q.done = q.progress >= q.need;
    refreshQuestChips();
  }
  function addProgressForKind(kind, value) {
    for (const q of state.questList) {
      if (q.kind === kind) {
        q.progress = Math.min(q.need, value|0);
        q.done = q.progress >= q.need;
      }
    }
    refreshQuestChips();
  }

  // -------- Spawner --------
  function spawnOne() {
    const w = innerWidth, h = innerHeight;
    // 70% good, 20% junk, 7% star, 3% shield (ปรับตามความยาก)
    const r = Math.random();
    let type='good', ch = pick(GOOD);
    if (r > 0.7 && r <= 0.9) { type='junk'; ch=pick(JUNK); }
    else if (r > 0.9 && r <= 0.97) { type='star'; ch=STAR; }
    else if (r > 0.97) { type='shield'; ch=SHIELD; }

    const x = rand(state.size, w - state.size);
    const y = -state.size - 10;

    const el = document.createElement('div');
    el.className = 'gj-item';
    el.textContent = ch;
    el.style.left = (x|0)+'px';
    el.style.top  = (y|0)+'px';
    el.style.fontSize = state.size+'px';
    el.dataset.type = type;

    // 3D-ish tilt
    el.style.setProperty('--rx', (rand(-14, 14))+'deg');
    el.style.setProperty('--ry', (rand(-28, 28))+'deg');
    el.style.setProperty('--rz', (rand(-12, 12))+'deg');

    host.appendChild(el);

    const item = { el, x, y, vy: state.fallSpeed + Math.random()*60, type, life: 6 };
    // bigger "hitbox" = element size
    el.addEventListener('pointerdown', (e)=> handleHit(e, item), { passive:false });
    el.addEventListener('click',      (e)=> handleHit(e, item), { passive:false });

    state.items.push(item);
  }

  function handleHit(e, it) {
    e.preventDefault(); e.stopPropagation();
    if (!state.running) return;
    if (!it || !it.el) return;

    // compute points & result kind
    const cfg = DIFF[state.diff] || DIFF.Normal;
    let points = 0;
    let result = 'good';

    if (it.type === 'good') {
      points = cfg.goodPts;
      // perfect heuristic: click while near top 35% of the screen
      if ((it.y / innerHeight) < 0.35) { result = 'perfect'; points += 6; }
      explode(it, result==='perfect' ? '#9effa1' : '#a0e9ff');
      onGoodStreak();
      coach?.onGood?.();
    }
    else if (it.type === 'junk') {
      if (state.power.shield) {
        // consume shield
        state.power.shield = false;
        state.power.shieldTime = 0;
        // small reward for using shield successfully
        points = 0;
        explode(it, '#ffd166'); // block spark
      } else {
        // penalty: combo reset handled by engine via miss()
        result = 'bad';
        explode(it, '#ff7b7b');
        coach?.onBad?.();
      }
    }
    else if (it.type === 'star') {
      points = cfg.starPts;
      state.power.stars++;
      onGainStar();
      explode(it, '#ffe27a');
      coach?.onPerfect?.();
      result = 'perfect';
    }
    else if (it.type === 'shield') {
      state.power.shield = true;
      state.power.shieldTime = 7.0; // seconds
      onGainShield();
      explode(it, '#7ee8fa');
      points = 0;
      result = 'good';
    }

    // remove item
    kill(it);

    // notify engine score/combo via bus
    const ui = { x: e.clientX || (it.x+state.size/2), y: e.clientY || (it.y+state.size/2) };
    if (typeof window.__gjBus?.hit === 'function') {
      window.__gjBus.hit({ points, kind: result, ui, meta: { type: it.type } });
    } else {
      // fallback: use captured bus from update loop
      _latestBus?.hit?.({ points, kind: result, ui, meta:{ type: it.type } });
    }

    // quest updates
    if (it.type === 'good') onGoodHit(result, points, _latestCombo());
    onScoreChanged(_latestScore());
  }

  function kill(it) {
    if (!it || !it.el) return;
    try { it.el.remove(); } catch {}
    it.dead = true;
  }

  // -------- Update / Loop --------
  let _latestBus = null;
  function update(dt, bus) {
    _latestBus = bus;
    if (!state.running) return;

    state.t += dt;
    state.spawnAcc += dt;

    // power shield countdown
    if (state.power.shield) {
      state.power.shieldTime -= dt;
      if (state.power.shieldTime <= 0) { state.power.shield = false; state.power.shieldTime = 0; }
    }

    // spawn
    if (state.spawnAcc >= state.spawnEvery) {
      state.spawnAcc = 0;
      spawnOne();
    }

    // move
    for (const it of state.items) {
      if (it.dead) continue;
      it.y += it.vy * dt;
      if (it.el) it.el.style.top = (it.y|0)+'px';
      if (it.y > innerHeight + 80) {
        // went off screen: treat as "miss" for good, and "avoid" for junk
        if (it.type === 'good') {
          bus?.miss?.();              // reset combo
          onBadHit();
        } else if (it.type === 'junk') {
          onMissJunk();
          addProgress('avoidJunk', 1);
        }
        kill(it);
      }
    }

    // cleanup array
    if (state.items.length > 120) state.items = state.items.filter(i=>!i.dead);

    // HUD top sync (time handled by main loop), score/combos available via engine
    // quests chips already refreshed when events happen
  }

  function start({ time = 45, diff = 'Normal' } = {}) {
    // set difficulty
    applyDiff(diff);
    state.timeLeft = time|0;
    state.running = true;
    state.items.length = 0;
    state.power = { shield:false, shieldTime:0, stars:0 };

    // pick quests & push to HUD
    pickQuests();

    // small banner
    coach?.onStart?.();
  }

  function cleanup() {
    state.running = false;
    for (const it of state.items) { try{ it.el.remove(); }catch{} }
    state.items.length = 0;
  }

  // expose for engine
  return { update, start, cleanup };
}

// -------------------- Helpers --------------------
function ensureHost() {
  return document.getElementById('spawnHost') ||
         document.body.appendChild(Object.assign(document.createElement('div'),{ id:'spawnHost', style:'position:fixed;inset:0;z-index:12;pointer-events:auto' }));
}
function pick(arr){ return arr[(Math.random()*arr.length)|0]; }
function rand(a,b){ if (b==null){ b=a; a=0; } return Math.random()*(b-a)+a; }
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [a[i],a[j]]=[a[j],a[i]]; } return a; }

function injectCSS(){
  if (document.getElementById('gj-style')) return;
  const css = `
  #spawnHost{ perspective: 900px; }
  .gj-item{
    position:fixed; transform-style:preserve-3d;
    filter: drop-shadow(0 6px 10px rgba(0,0,0,.45));
    will-change: transform, top, left, opacity;
    transition: transform .2s ease;
    user-select:none; cursor:pointer;
    --rx: 0deg; --ry: 0deg; --rz: 0deg;
    transform: translateZ(0) rotateX(var(--rx)) rotateY(var(--ry)) rotateZ(var(--rz));
  }
  .gj-item:active{ transform: translateZ(6px) rotateX(var(--rx)) rotateY(var(--ry)) rotateZ(var(--rz)); }
  .gj-piece{
    position:fixed; width:10px; height:10px; border-radius:3px;
    pointer-events:none; opacity:1; will-change: transform, opacity;
  }`;
  const s = document.createElement('style'); s.id='gj-style'; s.textContent = css;
  document.head.appendChild(s);
}

// simple particle explode
function explode(it, color='#a0e9ff'){
  const host = document.getElementById('spawnHost'); if (!host) return;
  const N = 18;
  for (let i=0;i<N;i++){
    const p = document.createElement('div');
    p.className = 'gj-piece';
    p.style.background = color;
    const x = it.x + 12 + Math.random()*20;
    const y = it.y + 12 + Math.random()*20;
    p.style.left = x+'px';
    p.style.top  = y+'px';
    host.appendChild(p);

    const vx = (Math.random()*2-1) * 220;
    const vy = (Math.random()*-1) * 260 - 20;
    const rot = (Math.random()*720-360);

    const t0 = performance.now();
    (function anim(now){
      const dt = (now - t0)/1000;
      const nx = x + vx*dt;
      const ny = y + vy*dt + 260*dt*dt; // gravity
      const a  = Math.max(0, 1 - dt*1.5);
      p.style.transform = `translate(${nx|0}px, ${ny|0}px) rotate(${rot*dt|0}deg)`;
      p.style.opacity = a.toFixed(2);
      if (dt < 1.0) requestAnimationFrame(anim);
      else try{ p.remove(); }catch{}
    })(t0);
  }
}

// Pull latest score/combo from HUD text (fallback) — ใช้ได้ถ้า engine ไม่ส่งให้
function _latestScore(){
  const el = document.getElementById('hudScore'); return el ? (parseInt(el.textContent||'0',10)||0) : 0;
}
function _latestCombo(){
  const el = document.getElementById('hudCombo'); return el ? (parseInt(el.textContent||'0',10)||0) : 0;
}
