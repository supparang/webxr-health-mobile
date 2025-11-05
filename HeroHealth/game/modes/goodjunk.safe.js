// === Good vs Junk — SAFE MODE v2 (Standalone + Module + Event hooks) ===
export const name = 'goodjunk';

// ---- Config ----
const GOOD = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛','🍇','🍓','🍊','🍅','🍆','🥬','🥝','🍍','🍐','🍑'];
const JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍫','🍭','🧃','🍨'];
const DURATION = 60;           // seconds
const BASE_SPAWN_MS = 800;
const MIN_SPAWN_MS = 350;
const SPEEDUP_EVERY = 10;
const ITEM_LIFETIME = 1500;
const ARENA_PAD = 60;

const $ = (s, r=document)=>r.querySelector(s);
const clamp = (n,a,b)=>Math.max(a, Math.min(b,n));
const rnd = (a,b)=>Math.random()*(b-a)+a;
function pick(arr, last){ let x; do { x = arr[(Math.random()*arr.length)|0]; } while (arr.length>1 && x===last); return x; }

class GoodJunkGame {
  constructor(opts){
    this.host = opts.host;
    this.onUpdateHUD = opts.onUpdateHUD||(()=>{});
    this.onEnd = opts.onEnd||(()=>{});
    this.onEvent = opts.onEvent||(()=>{}); // 🔔 NEW: ส่ง event ออก
    this.sfx = opts.sfx||{};
    this.timeLeft = typeof opts.duration==='number'? opts.duration : DURATION;
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
    this.onEvent({type:'start', payload:{time:this.timeLeft}});
    this._scheduleSpawn();
    this._tickTimer = setInterval(()=>{
      if(this._paused) return;
      this.timeLeft--;
      this.onEvent({type:'tick', payload:{time:this.timeLeft}});
      this._updateHUD();
      if(this.timeLeft<=0){ this.end(); }
    }, 1000);
  }

  togglePause(){
    if(!this._running) return;
    this._paused = !this._paused;
    this._updateHUD();
    this.onEvent({type:this._paused?'pause':'resume'});
  }

  end(){
    if(!this._running) return;
    this._running=false;
    clearInterval(this._tickTimer); this._tickTimer=null;
    clearTimeout(this._spawnTimer); this._spawnTimer=null;
    document.removeEventListener('visibilitychange', this._boundVisibility);
    [...this.host.querySelectorAll('.item')].forEach(el=>el.remove());
    const res = {score:this.score, maxCombo:this.maxCombo, hits:this.hits, time: (typeof this.timeTotal==='number'?this.timeTotal:DURATION)||DURATION};
    this.onEvent({type:'end', payload:res});
    this.onEnd(res);
  }

  _handleVisibility(){ if(document.hidden) this._paused=true; }

  _spawnOne(){
    if(!this._running || this._paused) return;
    const isGood = Math.random()<0.65;
    const emoji = isGood ? (this._lastGood = pick(GOOD, this._lastGood))
                         : (this._lastJunk = pick(JUNK, this._lastJunk));

    const el = document.createElement('div');
    el.className = `item ${isGood?'good':'junk'}`;
    el.textContent = emoji;

    const w = this.host.clientWidth||window.innerWidth, h = this.host.clientHeight||window.innerHeight;
    const x = rnd(ARENA_PAD, Math.max(ARENA_PAD, w-ARENA_PAD-40));
    const y = rnd(ARENA_PAD, Math.max(ARENA_PAD, h-ARENA_PAD-40));
    el.style.left = `${x}px`; el.style.top = `${y}px`;
    el.style.position = 'absolute'; el.style.fontSize = '40px'; el.style.userSelect='none'; el.style.cursor='pointer';

    let removed=false;
    const die = ()=>{
      if(removed) return; removed=true; el.remove();
      this.onEvent({type:'despawn', payload:{good:isGood}});
    };
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
        this.sfx.pop?.();
        this.onEvent({type:'hit', payload:{kind:'good', score:this.score, combo:this.combo}});
      }else{
        this.hits.junk++;
        this.combo = 1;
        this.score = Math.max(0, this.score-5);
        this.sfx.boo?.();
        this.onEvent({type:'hit', payload:{kind:'junk', score:this.score, combo:this.combo}});
      }
      this._updateHUD();
    };

    el.addEventListener('pointerdown', hit, {passive:true});
    this.host.appendChild(el);
    this.onEvent({type:'spawn', payload:{good:isGood}});
  }

  _scheduleSpawn(){
    if(!this._running) return;
    const elapsed = (typeof this.timeTotal==='number'?this.timeTotal:DURATION) - this.timeLeft;
    const t = clamp(BASE_SPAWN_MS - elapsed*12, MIN_SPAWN_MS, BASE_SPAWN_MS);
    this._spawnOne();
    this._spawnTimer = setTimeout(()=>this._scheduleSpawn(), t);
  }

  _updateHUD(){
    this.onUpdateHUD({ time:this.timeLeft, score:this.score, combo:this.combo, paused:this._paused });
  }
}

// ----- Standalone bootstrap (optional) -----
function bootstrapStandalone(){
  const arena = document.getElementById('arena');
  const startBtn = document.getElementById('startBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const timeEl = document.getElementById('time');
  const scoreEl = document.getElementById('score');
  const comboEl = document.getElementById('combo');
  const msgEl = document.getElementById('msg');
  if(!arena||!startBtn||!pauseBtn||!timeEl||!scoreEl||!comboEl) return null;

  const game = new GoodJunkGame({
    host: arena,
    onUpdateHUD: ({time,score,combo,paused})=>{
      timeEl.textContent = time;
      scoreEl.textContent = score;
      comboEl.textContent = 'x'+combo;
      if(msgEl) msgEl.textContent = paused? 'พักเกม' : 'คลิกอาหารดี เลี่ยงขยะ!';
    },
    onEnd: (res)=>{
      startBtn.disabled=false; pauseBtn.disabled=true;
      alert(`สรุปผล: คะแนน ${res.score} | คอมโบสูงสุด x${res.maxCombo} | ดี ${res.hits.good} | ขยะ ${res.hits.junk}`);
    }
  });
  startBtn.addEventListener('click', ()=>{ startBtn.disabled=true; pauseBtn.disabled=false; game.start(); });
  pauseBtn.addEventListener('click', ()=>game.togglePause());
  return game;
}
const _standaloneGame = bootstrapStandalone();

// ----- Module API -----
export function mount(ctxOrHost){
  const host = ctxOrHost?.host || ctxOrHost;
  const hud = ctxOrHost?.hud;
  const sfx = ctxOrHost?.sfx || {};
  const onEvent = ctxOrHost?.onEvent || (()=>{});
  if(!host) throw new Error('[goodjunk] host element required');

  const game = new GoodJunkGame({
    host,
    sfx,
    onUpdateHUD: ({time,score,combo,paused})=>{
      try{
        hud?.setTimer?.(time);
        hud?.setScore?.(score);
        hud?.setCombo?.(combo);
        hud?.setStatus?.(paused?'PAUSED':'PLAY');
      }catch{}
    },
    onEnd: (res)=>{
      try{
        hud?.showResult?.({
          mode:'goodjunk', score:res.score, time:res.time,
          details:{maxCombo:res.maxCombo, good:res.hits.good, junk:res.hits.junk},
          summary:`คะแนน ${res.score} | คอมโบสูงสุด x${res.maxCombo} | ดี ${res.hits.good} | ขยะ ${res.hits.junk}`
        });
      }catch{}
    },
    onEvent
  });

  return {
    start: ()=>game.start(),
    pause: ()=>game.togglePause(),
    resume: ()=>{ if(game._paused) game.togglePause(); },
    stop: ()=>game.end(),
    get state(){ return { time:game.timeLeft, score:game.score, combo:game.combo, running:game._running, paused:game._paused }; }
  };
}
