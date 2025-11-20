// === /fitness/js/rhythm-boxer.js ===
// single-file rhythm engine + UI (no external engine dependency)

const $  = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

let state = {
  mode: 'Normal',
  diff: 'normal',
  track: 'track1',
  participant: '-',
};

let game = null;

// ---------- TRACK CONFIG (โน้ตต่อเนื่องจนเกือบหมดเพลง) ----------

// helper: สร้าง beat ไล่ตลอดทั้ง duration
function makeTrack(name, durationSec, startSec, intervalSec) {
  const beats = [];
  const end = durationSec - 1.5;      // เผื่อช่วงท้ายเงียบ ๆ นิดนึง
  for (let t = startSec; t <= end; t += intervalSec) {
    beats.push(t);
  }
  return { name, duration: durationSec, beats };
}

const TRACKS = {
  track1: makeTrack(
    'Track 1 — Warm-up Mix',
    40,      // ความยาว 40s
    1.5,     // เริ่มมีโน้ตหลังเริ่มเพลง 1.5s
    0.8      // ระยะห่างระหว่างโน้ต (ช้า ๆ วอร์มอัพ)
  ),
  track2: makeTrack(
    'Track 2 — Dance Combo',
    60,      // ยาวขึ้น
    1.5,
    0.55     // เร็วขึ้น
  ),
  track3: makeTrack(
    'Track 3 — Power Finish',
    75,      // ยาวสุด
    1.5,
    0.45     // เร็วสุด
  )
};

// ---------- GAME LOOP ----------
class RhythmGame {
  constructor(opts){
    this.layer = opts.layer;       // DOM note layer
    this.diff  = opts.diff;
    this.trackKey = opts.trackKey;
    this.track = TRACKS[opts.trackKey];

    this.sfxStart = $('#rb-sfx-start');
    this.sfxHit   = $('#rb-sfx-hit');
    this.sfxMiss  = $('#rb-sfx-miss');

    this.music = {
      track1: $('#rb-music-track1'),
      track2: $('#rb-music-track2'),
      track3: $('#rb-music-track3')
    }[this.trackKey];

    this.timeLimit = this.track.duration;

    // tuning ตามความยาก
    if(this.diff === 'easy'){
      this.hitWindow = 260;      // ms
      this.noteTravel = 1700;    // เวลาโน้ตตกจากบนสุดถึงเส้น
    }else if(this.diff === 'hard'){
      this.hitWindow = 140;
      this.noteTravel = 1200;
    }else{
      this.hitWindow = 200;
      this.noteTravel = 1400;
    }

    this.startTime = 0;
    this.now = 0;
    this.elapsed = 0;
    this.raf = null;

    this.notes = [];   // {time, spawned, el, hit, judged}
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.perfect = 0;
    this.miss = 0;
    this.reactionSamples = [];

    this.onFinish = opts.onFinish || (()=>{});

    this._handleKey = (e)=>{
      if(e.code === 'Space'){
        e.preventDefault();
        this.hit('key');
      }
    };
    this._handleClickLane = (e)=>{
      e.preventDefault();
      this.hit('click');
    };
  }

  init(){
    this.layer.innerHTML = '';
    this.notes = this.track.beats.map(t => ({
      time: t * 1000, // sec → ms
      spawned:false,
      el:null,
      hit:false,
      judged:false
    }));
  }

  start(){
    this.init();

    const laneRect = this.layer.getBoundingClientRect();
    this.laneHeight = laneRect.height || 260;
    this.hitY = this.laneHeight - 52; // ตำแหน่งเส้น

    this.startTime = performance.now();
    this.music?.pause();
    this.music.currentTime = 0;
    this.music?.play().catch(()=>{});

    this.sfxStart?.play().catch(()=>{});

    window.addEventListener('keydown', this._handleKey);
    this.layer.addEventListener('pointerdown', this._handleClickLane);

    const loop = (ts)=>{
      this.raf = requestAnimationFrame(loop);
      this.update(ts);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(reason='manual'){
    cancelAnimationFrame(this.raf);
    this.raf = null;
    window.removeEventListener('keydown', this._handleKey);
    this.layer.removeEventListener('pointerdown', this._handleClickLane);
    this.music?.pause();

    this.onFinish({
      reason,
      score:this.score,
      maxCombo:this.maxCombo,
      perfect:this.perfect,
      miss:this.miss,
      reactionAvg: this.reactionSamples.length
        ? (this.reactionSamples.reduce((a,b)=>a+Math.abs(b),0)/this.reactionSamples.length)
        : null
    });
  }

  update(ts){
    this.now = ts;
    this.elapsed = this.now - this.startTime;
    const sec = this.elapsed / 1000;

    // update timer UI
    const remain = Math.max(0, this.timeLimit - sec);
    $('#rb-stat-time').textContent = remain.toFixed(1);

    // spawn notes
    for(const n of this.notes){
      if(!n.spawned && this.elapsed >= n.time - this.noteTravel){
        this.spawnNote(n);
      }
    }

    // move + judge miss
    for(const n of this.notes){
      if(!n.spawned || n.judged) continue;
      const tToHit = n.time - this.elapsed;  // ms
      const progress = 1 - (tToHit / this.noteTravel); // 0 → 1 ที่เส้น
      const y = this.hitY * progress;

      if(n.el){
        n.el.style.transform = `translate(-50%, ${Math.max(-30, y)}px)`;
      }

      // เลยหน้าต่าง miss
      if(!n.hit && tToHit < -this.hitWindow){
        this.registerMiss(n);
      }
    }

    if(sec >= this.timeLimit + 1){
      this.stop('timeout');
    }
  }

  spawnNote(n){
    n.spawned = true;
    const el = document.createElement('div');
    el.className = 'rb-note';
    el.textContent = '●';
    el.style.transform = 'translate(-50%, -40px)';
    this.layer.appendChild(el);
    n.el = el;
  }

  hit(source){
    if(!this.notes.length) return;

    const tNow = this.elapsed; // ms

    // หาโน้ตที่ยังไม่ถูกตัดสิน และอยู่ใกล้ hit window ที่สุด
    let best = null;
    let bestDelta = Infinity;
    for(const n of this.notes){
      if(!n.spawned || n.judged) continue;
      const d = (n.time - this.elapsed);
      const ad = Math.abs(d);
      if(ad < bestDelta){
        bestDelta = ad;
        best = n;
      }
    }
    if(!best) return;

    const delta = best.time - this.elapsed; // ms
    const ad = Math.abs(delta);

    if(ad > this.hitWindow){
      // ตีแล้วโดนช่วงว่าง → miss เลย
      this.showPop('MISS', 'miss');
      this.miss++;
      this.combo = 0;
      $('#rb-stat-miss').textContent = this.miss;
      $('#rb-stat-combo').textContent = this.combo;
      this.sfxMiss?.play().catch(()=>{});
      return;
    }

    // grade
    let grade, scoreGain;
    if(ad <= this.hitWindow * 0.35){
      grade = 'PERFECT';
      scoreGain = 300;
      this.perfect++;
      $('#rb-stat-perfect').textContent = this.perfect;
    }else if(ad <= this.hitWindow * 0.8){
      grade = 'GOOD';
      scoreGain = 150;
    }else{
      grade = 'BAD';
      scoreGain = 70;
    }

    best.hit = true;
    best.judged = true;
    if(best.el){
      best.el.remove();
      best.el = null;
    }

    this.reactionSamples.push(delta);
    this.score += scoreGain;
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);

    $('#rb-stat-score').textContent = this.score;
    $('#rb-stat-combo').textContent = this.combo;

    this.showPop(grade, grade.toLowerCase());
    this.sfxHit?.play().catch(()=>{});
  }

  registerMiss(n){
    n.judged = true;
    n.hit = false;
    if(n.el){
      n.el.remove();
      n.el = null;
    }
    this.miss++;
    this.combo = 0;
    $('#rb-stat-miss').textContent = this.miss;
    $('#rb-stat-combo').textContent = this.combo;
    this.showPop('MISS', 'miss');
    this.sfxMiss?.play().catch(()=>{});
  }

  showPop(text, type){
    const pop = document.createElement('div');
    pop.className = 'rb-pop ' + type;
    pop.textContent = text;
    pop.style.bottom = '64px';
    this.layer.appendChild(pop);
    setTimeout(()=> pop.remove(), 500);
  }
}

// ---------- UI WIRING ----------
function switchView(id){
  for(const sec of $$('main > section')){
    sec.classList.add('hidden');
  }
  $(id).classList.remove('hidden');
}

function readMenu(){
  state.diff = $('#rb-diff').value;
  state.track = $('#rb-track').value;
}

// menu buttons
$('#view-menu').addEventListener('click',(ev)=>{
  const btn = ev.target.closest('button[data-action]');
  if(!btn) return;
  const act = btn.dataset.action;

  if(act === 'start-normal'){
    readMenu();
    state.mode = 'Normal';
    state.participant = '-';
    startGame();
  }else if(act === 'start-research'){
    readMenu();
    state.mode = 'Research';
    switchView('#view-research-form');
  }
});

$('#view-research-form').addEventListener('click',(ev)=>{
  const btn = ev.target.closest('button[data-action]');
  if(!btn) return;
  const act = btn.dataset.action;

  if(act === 'back-to-menu'){
    switchView('#view-menu');
  }else if(act === 'research-begin-play'){
    state.participant = $('#rb-research-id').value || '-';
    readMenu();
    startGame();
  }
});

$('#view-play').addEventListener('click',(ev)=>{
  const btn = ev.target.closest('button[data-action]');
  if(!btn) return;
  const act = btn.dataset.action;
  if(act === 'stop-early'){
    game?.stop('stopped');
  }
});

$('#view-result').addEventListener('click',(ev)=>{
  const btn = ev.target.closest('button[data-action]');
  if(!btn) return;
  const act = btn.dataset.action;

  if(act === 'back-to-menu'){
    switchView('#view-menu');
  }else if(act === 'play-again'){
    startGame();
  }
});

// start game helper
function startGame(){
  switchView('#view-play');

  $('#rb-stat-mode').textContent  = state.mode;
  $('#rb-stat-diff').textContent  = state.diff;
  $('#rb-stat-track').textContent = TRACKS[state.track].name;

  $('#rb-stat-score').textContent   = 0;
  $('#rb-stat-combo').textContent   = 0;
  $('#rb-stat-perfect').textContent = 0;
  $('#rb-stat-miss').textContent    = 0;

  $('#rb-coach-text').textContent =
    'ฟังจังหวะ แล้วกด Space / คลิกในกล่อง เมื่อโน้ตมาแตะเส้นไฟให้พอดีนะ 🎶';

  const layer = $('#rb-note-layer');

  if(game){
    game.stop('restart');
  }

  game = new RhythmGame({
    layer,
    diff: state.diff,
    trackKey: state.track,
    onFinish: (res)=>{
      showResult(res);
    }
  });
  game.start();
}

function showResult(res){
  $('#rb-res-mode').textContent   = state.mode;
  $('#rb-res-diff').textContent   = state.diff;
  $('#rb-res-track').textContent  = TRACKS[state.track].name;
  $('#rb-res-score').textContent  = res.score;
  $('#rb-res-maxcombo').textContent = res.maxCombo;
  $('#rb-res-perfect').textContent = res.perfect;
  $('#rb-res-miss').textContent   = res.miss;
  $('#rb-res-participant').textContent = state.participant;

  $('#rb-res-avgwin').textContent =
    res.reactionAvg != null ? (res.reactionAvg.toFixed(0) + ' ms') : '-';

  switchView('#view-result');
}

// default view
switchView('#view-menu');
