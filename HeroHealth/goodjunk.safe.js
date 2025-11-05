// === Good vs Junk — SAFE MODE (Standalone + Module mount(ctx)) ===
// - ไม่มี dependency ภายนอก
// - รองรับ Desktop/Mobile/VR pointer (click/touch)
// - มี pause on blur / resume on focus
// - Dynamic spawn (เร็วขึ้นเรื่อย ๆ), lifetime, combo, สรุปผลชัดเจน

export const name = 'goodjunk';

// ---- Config ----
const GOOD = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛','🍇','🍓','🍊','🍅','🍆','🥬','🥝','🍍','🍐','🍑'];
const JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍫','🍭','🧃','🍨'];
const DURATION = 60;           // seconds
const BASE_SPAWN_MS = 800;     // เริ่มช้า…
const MIN_SPAWN_MS = 350;      // …เร็วสุด
const SPEEDUP_EVERY = 10;      // ทุก ๆ 10 วิ เร่งเกิด
const ITEM_LIFETIME = 1500;    // ms อยู่บนจอนานเท่านี้
const ARENA_PAD = 60;          // ขอบกันชนไม่ให้เกิดติดขอบ

// ---- Utility ----
const $ = (s, r=document)=>r.querySelector(s);
const clamp = (n,a,b)=>Math.max(a, Math.min(b,n));
const rnd = (a,b)=>Math.random()*(b-a)+a;
function pick(arr, last){ let x; do { x = arr[(Math.random()*arr.length)|0]; } while (arr.length>1 && x===last); return x; }

function formatSummary(sc, maxCombo, hits, misses){
  return `สรุปผล: คะแนน ${sc} | คอมโบสูงสุด x${maxCombo} | โดนดี ${hits.good} | โดนขยะ ${hits.junk}`;
}

// ---- Core game (engine-lite) ----
class GoodJunkGame {
  constructor(opts){
    this.host = opts.host;                  // DOM element (arena)
    this.onUpdateHUD = opts.onUpdateHUD||(()=>{});
    this.onEnd = opts.onEnd||(()=>{});
    this.sfx = opts.sfx||{};
    this.timeLeft = DURATION;
    this.score = 0;
    this.combo = 1;
    this.maxCombo = 1;
    this.hits = {good:0, junk:0};
    this._running=false; this._paused=false;
    this._spawnTimer=null; this._tickTimer=null;
    this._lastGood=null; this._lastJunk=null;
    this._boundVisibility = this._handleVisibility.bind(this);
  }

  start(){
    if(this._running) return;
    this._running=true; this._paused=false;
    document.addEventListener('visibilitychange', this._boundVisibility);
    this._updateHUD();
    this._scheduleSpawn();
    this._tickTimer = setInterval(()=>{
      if(this._paused) return;
      this.timeLeft--;
      this._updateHUD();
      if(this.timeLeft%SPEEDUP_EVERY===0){
        // speedup implicit by shorter spawn interval next cycle
      }
      if(this.timeLeft<=0){ this.end(); }
    }, 1000);
  }

  togglePause(){
    if(!this._running) return;
    this._paused = !this._paused;
    this._updateHUD();
  }

  end(){
    if(!this._running) return;
    this._running=false;
    clearInterval(this._tickTimer); this._tickTimer=null;
    clearTimeout(this._spawnTimer); this._spawnTimer=null;
    document.removeEventListener('visibilitychange', this._boundVisibility);
    // cleanup items
    [...this.host.querySelectorAll('.item')].forEach(el=>el.remove());
    const summary = formatSummary(this.score, this.maxCombo, this.hits, 0);
    this.onEnd({score:this.score, maxCombo:this.maxCombo, hits:this.hits, time:DURATION, summary});
  }

  _handleVisibility(){
    if(document.hidden) this._paused=true;
  }

  _spawnOne(){
    if(!this._running || this._paused) return;
    const isGood = Math.random()<0.65;
    const emoji = isGood ? (this._lastGood = pick(GOOD, this._lastGood))
                         : (this._lastJunk = pick(JUNK, this._lastJunk));

    const el = document.createElement('div');
    el.className = `item ${isGood?'good':'junk'}`;
    el.textContent = emoji;

    const w = this.host.clientWidth, h = this.host.clientHeight;
    const x = rnd(ARENA_PAD, Math.max(ARENA_PAD, w-ARENA_PAD-40));
    const y = rnd(ARENA_PAD, Math.max(ARENA_PAD, h-ARENA_PAD-40));
    el.style.left = `${x}px`; el.style.top = `${y}px`;

    let removed=false;
    const die = ()=>{ if(removed) return; removed=true; el.remove(); };
    const life = setTimeout(die, ITEM_LIFETIME);

    const hit = (ev)=>{
      ev.stopPropagation?.();
      if(removed) return;
      clearTimeout(life); removed=true; el.remove();
      if(isGood){
        this.hits.good++;
        this.score += 10*this.combo;
        this.combo = clamp(this.combo+1, 1, 999);
        this.maxCombo = Math.max(this.maxCombo, this.combo);
        this._arenaFlash('good');
        this.sfx.pop?.();
      }else{
        this.hits.junk++;
        this.combo = 1;
        this.score = Math.max(0, this.score-5);
        this._arenaFlash('bad');
        this.sfx.boo?.();
      }
      this._updateHUD();
    };

    el.addEventListener('pointerdown', hit, {passive:true});
    this.host.appendChild(el);
  }

  _arenaFlash(kind){
    const k = kind==='good'?'flash-good':'flash-bad';
    this.host.classList.add(k);
    setTimeout(()=>this.host.classList.remove(k), 180);
  }

  _scheduleSpawn(){
    if(!this._running) return;
    // speed up as time passes
    const elapsed = DURATION - this.timeLeft;
    const t = clamp(BASE_SPAWN_MS - elapsed*12, MIN_SPAWN_MS, BASE_SPAWN_MS);
    this._spawnOne();
    this._spawnTimer = setTimeout(()=>this._scheduleSpawn(), t);
  }

  _updateHUD(){
    this.onUpdateHUD({
      time:this.timeLeft, score:this.score, combo:this.combo, paused:this._paused
    });
  }
}

// ---- Detect environment & bootstrap standalone if present ----
function bootstrapStandalone(){
  const arena = document.getElementById('arena');
  const startBtn = document.getElementById('startBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const timeEl = document.getElementById('time');
  const scoreEl = document.getElementById('score');
  const comboEl = document.getElementById('combo');
  const msgEl = document.getElementById('msg');

  if(!arena || !startBtn || !pauseBtn || !timeEl || !scoreEl || !comboEl) return null;

  const game = new GoodJunkGame({
    host: arena,
    onUpdateHUD: ({time,score,combo,paused})=>{
      timeEl.textContent = time;
      scoreEl.textContent = score;
      comboEl.textContent = 'x'+combo;
      msgEl.textContent = paused? 'พักเกม' : 'คลิกอาหารดี เลี่ยงขยะ!';
    },
    onEnd: (res)=>{
      startBtn.disabled=false; pauseBtn.disabled=true;
      msgEl.textContent = res.summary + ' — กด "เริ่มเกม" เพื่อเล่นอีกครั้ง';
      alert(res.summary);
    },
    sfx: {
      pop: ()=>{/* ไว้เชื่อม AudioContext เดิมได้ */},
      boo: ()=>{}
    }
  });

  startBtn.addEventListener('click', ()=>{
    startBtn.disabled=true;
    pauseBtn.disabled=false;
    game.timeLeft = DURATION;
    game.score=0; game.combo=1; game.maxCombo=1;
    game.start();
  });

  pauseBtn.addEventListener('click', ()=>game.togglePause());

  return game;
}

// ถ้ามี DOM แบบ standalone ให้บูตทันที
const _standaloneGame = bootstrapStandalone();

// ---- Module API สำหรับระบบเดิม (safe mount) ----
// ใช้แบบ:
//   import * as goodjunk from './modes/goodjunk.safe.js';
//   const inst = goodjunk.mount({host, hud, sfx, score});
//   inst.start();
export function mount(ctxOrHost){
  // รองรับทั้ง {host, hud, ...} หรือส่ง host element ตรง ๆ
  const host = ctxOrHost?.host || ctxOrHost;
  const hud = ctxOrHost?.hud;
  const sfx = ctxOrHost?.sfx || {};
  const scoreApi = ctxOrHost?.score;

  if(!host) throw new Error('[goodjunk] host element required');

  const game = new GoodJunkGame({
    host,
    onUpdateHUD: ({time,score,combo,paused})=>{
      // ถ้ามี HUD API เดิมอยู่ ใช้เลย
      try{
        hud?.setTimer?.(time);
        hud?.setScore?.(score);
        hud?.setCombo?.(combo);
        if(hud?.setStatus) hud.setStatus(paused?'PAUSED':'PLAY');
      }catch{}
    },
    onEnd: (res)=>{
      try{
        hud?.showResult?.({
          mode:'goodjunk', score:res.score, time:DURATION,
          details:{maxCombo:res.maxCombo, good:res.hits.good, junk:res.hits.junk},
          summary:res.summary
        });
      }catch{}
    },
    sfx
  });

  // proxy ให้ระบบเดิมเรียกสะดวก
  return {
    start: ()=>game.start(),
    pause: ()=>game.togglePause(),
    resume: ()=>{ if(game._paused) game.togglePause(); },
    stop: ()=>game.end(),
    get state(){ return {
      time:game.timeLeft, score:game.score, combo:game.combo,
      running:game._running, paused:game._paused
    }; }
  };
}
