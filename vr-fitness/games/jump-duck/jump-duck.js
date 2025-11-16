// === Jump Duck — v2.0 (Research-ready) ======================================
// Mechanics:
// - ตัวละครวิ่งอยู่ที่เดิม สิ่งกีดขวางวิ่งเข้ามาจากขวา → ซ้าย
// - obstacle แบบ "low" → ต้อง JUMP, obstacle แบบ "high" → ต้อง DUCK
// - gold obstacle = คะแนนพิเศษ, bomb obstacle = ลงโทษหนัก
// - FEVER mode เมื่อ combo ต่อเนื่องสูง (>= 5)
// - Timed mode: ?mode=timed&time=60&diff=normal
// - สรุปผลแบบ Rhythm Boxer / Shadow Breaker เพื่อใช้ทำวิจัย
// ============================================================================

// ---------------------------------------------------------------------------
// CONFIG ENDPOINT (เติมภายหลัง)
// ---------------------------------------------------------------------------
const FIREBASE_API = ''; // 'https://.../firebase'
const SHEET_API    = ''; // 'https://.../sheet'
const PDF_API      = ''; // 'https://.../pdf'
const LB_API       = ''; // 'https://.../leaderboard'

const LS_PROFILE = 'fitness_profile_v1';
const LS_QUEUE   = 'fitness_offline_queue_v1';

// ---------------------------------------------------------------------------
// STRINGS
// ---------------------------------------------------------------------------
const STR = {
  th: {
    msgReady : 'เตรียมตัว… สิ่งกีดขวางกำลังวิ่งมา! กระโดด/หมอบให้ทันนะ 🏃‍♂️',
    msgGo    : 'GO! แตะด้านบนเพื่อกระโดด ด้านล่างเพื่อหมอบ ✨',
    msgPaused: 'พักขาแป๊บนึง เดี๋ยวค่อยวิ่งต่อ 😄',
    msgResume: 'ลุยต่อ! ระวังทั้งไม้เตี้ยและไม้สูงนะ 🚀',
    msgEnd   : 'หมดเวลาแล้ว มาดูว่าหลบได้กี่อัน ✨'
  }
};

// ---------------------------------------------------------------------------
// PROFILE
// ---------------------------------------------------------------------------
function getProfile(){
  try{
    const raw = localStorage.getItem(LS_PROFILE);
    return raw ? JSON.parse(raw) : null;
  }catch{ return null; }
}
function saveProfile(p){
  try{ localStorage.setItem(LS_PROFILE, JSON.stringify(p)); }catch{}
}
function ensureProfile(){
  let p = getProfile();
  if (p) return p;
  const studentId = prompt('Student ID:');
  const name      = prompt('ชื่อที่ใช้ในเกม:');
  const school    = prompt('โรงเรียน / หน่วยงาน:');
  const klass     = prompt('ห้องเรียน เช่น ป.5/1:');
  p = { studentId, name, school, class: klass, lang:'th' };
  saveProfile(p);
  return p;
}

// ---------------------------------------------------------------------------
// QUEUE + HYBRID SAVE
// ---------------------------------------------------------------------------
function loadQueue(){
  try{
    const raw = localStorage.getItem(LS_QUEUE);
    return raw ? JSON.parse(raw) : [];
  }catch{ return []; }
}
function saveQueue(q){
  try{ localStorage.setItem(LS_QUEUE, JSON.stringify(q)); }catch{}
}
async function flushQueue(){
  const q = loadQueue();
  if (!q.length) return;
  const remain = [];
  for (const item of q){
    try{
      await hybridSaveSession(item,false);
    }catch{
      remain.push(item);
    }
  }
  saveQueue(remain);
}

async function hybridSaveSession(summary, allowQueue = true){
  const body = JSON.stringify(summary);
  const headers = { 'Content-Type':'application/json' };
  let ok = true;
  try{
    const tasks = [];
    if (FIREBASE_API) tasks.push(fetch(FIREBASE_API,{ method:'POST', headers, body }));
    if (SHEET_API)    tasks.push(fetch(SHEET_API   ,{ method:'POST', headers, body }));
    if (tasks.length) await Promise.all(tasks);
  }catch(e){
    console.warn('JumpDuck save fail', e);
    ok = false;
  }
  if (!ok && allowQueue){
    const q = loadQueue();
    q.push(summary);
    saveQueue(q);
  }
}

// ---------------------------------------------------------------------------
// PDF + CSV
// ---------------------------------------------------------------------------
async function exportPDF(summary){
  if (!PDF_API){
    alert('ยังไม่ได้ตั้งค่า PDF_API');
    return;
  }
  try{
    const res = await fetch(PDF_API,{
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body:JSON.stringify(summary)
    });
    if (!res.ok) throw new Error('PDF API error');
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `JumpDuck_Report_${summary.profile.studentId || 'user'}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }catch(e){
    console.error(e);
    alert('สร้าง PDF ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
  }
}

function downloadCSVRow(summary){
  const headers = [
    'timestamp','studentId','name','school','class',
    'game','diff','score','hits','miss','accuracy',
    'comboMax','notesPerMin','rank','device'
  ];
  const p = summary.profile || {};
  const row = [
    summary.timestamp,
    p.studentId || '',
    p.name || '',
    p.school || '',
    p.class || '',
    summary.game,
    summary.diff || '',
    summary.score ?? '',
    summary.hits ?? '',
    summary.miss ?? '',
    (summary.accuracy*100).toFixed(1),
    summary.comboMax ?? '',
    summary.notesPerMin != null ? summary.notesPerMin.toFixed(2) : '',
    summary.rank || '',
    summary.device || ''
  ];

  const csv = headers.join(',') + '\n' + row.join(',');
  const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `JumpDuck_${p.studentId||'user'}_${summary.timestamp}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// DEVICE
// ---------------------------------------------------------------------------
function detectDevice(){
  const ua = navigator.userAgent || '';
  if (/Quest|Oculus|Pico|Vive|VR/i.test(ua)) return 'VR';
  if (/Mobile|Android|iPhone/i.test(ua))     return 'Mobile';
  return 'PC';
}

// ============================================================================
// GAME CONFIG
// ============================================================================
const DIFF = {
  easy   : { speed: 260, spawnInterval: 1.4, baseScore: 20 },
  normal : { speed: 320, spawnInterval: 1.0, baseScore: 25 },
  hard   : { speed: 380, spawnInterval: 0.8, baseScore: 30 }
};

const GOLD_CHANCE = 0.10;  // 10% gold obstacle
const BOMB_CHANCE = 0.06;  // 6% bomb obstacle

// player states
const STATE_RUN  = 'run';
const STATE_JUMP = 'jump';
const STATE_DUCK = 'duck';

// jump & duck durations (sec)
const JUMP_TIME = 0.55;
const DUCK_TIME = 0.7;

// ============================================================================
// MAIN CLASS
// ============================================================================
export class JumpDuck {
  constructor(opts){
    this.arena   = opts.arena;
    this.hud     = opts.hud   || {};
    this.msgBox  = opts.msgBox|| null;
    this.result  = opts.result|| {};
    this.csvBtn  = opts.csvBtn|| null;
    this.pdfBtn  = opts.pdfBtn|| null;

    if (!this.arena){
      alert('Jump Duck: ไม่พบ arena container');
      return;
    }

    this.profile = ensureProfile();
    this.str     = STR.th;

    const qs   = new URLSearchParams(location.search);
    const diff = qs.get('diff') || 'normal';
    const mode = qs.get('mode') || 'timed';
    let timeQ  = parseInt(qs.get('time') || '60', 10);
    this.diff  = DIFF[diff] ? diff : 'normal';
    this.mode  = mode;
    this.timeLimit = isNaN(timeQ) ? 60 : timeQ;

    this.cfg = DIFF[this.diff];

    this.state = {
      running:false,
      paused:false,
      elapsed:0,
      lastTs:0,
      timeLeft:this.timeLimit,
      score:0,
      hits:0,
      miss:0,
      combo:0,
      bestCombo:0,
      totalObstacles:0,
      fever:false
    };

    this.player = {
      el:null,
      state:STATE_RUN,
      timer:0
    };

    this.obstacles = new Map();
    this.spawnTimer = null;

    flushQueue();
    this._buildScene();
    this._bindInput();

    this._msg(this.str.msgReady);
    this._hud();
  }

  // -------------------------------------------------------------------------
  // BASIC UI
  // -------------------------------------------------------------------------
  _msg(t){ if (this.msgBox) this.msgBox.textContent = t; }

  _hud(){
    if (this.hud.time)  this.hud.time.textContent  = Math.max(0, Math.ceil(this.state.timeLeft));
    if (this.hud.score) this.hud.score.textContent = this.state.score;
    if (this.hud.hits)  this.hud.hits.textContent  = this.state.hits;
    if (this.hud.miss)  this.hud.miss.textContent  = this.state.miss;
    if (this.hud.combo) this.hud.combo.textContent = 'x' + this.state.combo;
  }

  _buildScene(){
    this.arena.style.position = 'relative';
    this.arena.style.overflow = 'hidden';
    this.arena.style.background =
      'linear-gradient(to top,#020617 0%,#020617 55%,#0b1120 100%)';
    this.arena.style.borderRadius = '16px';

    const ground = document.createElement('div');
    ground.style.position = 'absolute';
    ground.style.left = '0';
    ground.style.right = '0';
    ground.style.bottom = '0';
    ground.style.height = '20%';
    ground.style.background =
      'linear-gradient(to top,rgba(15,23,42,1),rgba(15,23,42,0.4))';
    ground.style.borderTop = '1px solid rgba(148,163,184,0.7)';
    this.arena.appendChild(ground);

    const player = document.createElement('div');
    player.id = 'jdPlayer';
    player.style.position = 'absolute';
    player.style.width = '60px';
    player.style.height = '80px';
    player.style.left = '12%';
    player.style.bottom = '20%';
    player.style.borderRadius = '14px';
    player.style.background =
      'linear-gradient(135deg,#22c55e,#16a34a)';
    player.style.boxShadow = '0 0 18px rgba(34,197,94,0.9)';
    player.style.display = 'flex';
    player.style.alignItems = 'center';
    player.style.justifyContent = 'center';
    player.style.color = '#0f172a';
    player.style.fontSize = '30px';
    player.textContent = '🏃‍♂️';

    this.arena.appendChild(player);
    this.player.el = player;
  }

  _bindInput(){
    this.arena.addEventListener('pointerdown', e=>{
      if (!this.state.running || this.state.paused) return;
      const rect = this.arena.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const isUpper = y < rect.height/2;
      if (isUpper) this._triggerJump();
      else this._triggerDuck();
    });

    window.addEventListener('keydown', e=>{
      if (!this.state.running || this.state.paused) return;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === ' '){
        this._triggerJump();
      }else if (e.key === 'ArrowDown' || e.key === 's'){
        this._triggerDuck();
      }
    });

    document.addEventListener('visibilitychange', ()=>{
      if (document.hidden) this.pause(true);
    });
  }

  // -------------------------------------------------------------------------
  // CONTROL
  // -------------------------------------------------------------------------
  start(){
    if (this.state.running) return;
    this.state.running = true;
    this.state.paused  = false;
    this.state.elapsed = 0;
    this.state.lastTs  = 0;
    this.state.timeLeft= this.timeLimit;
    this.state.score   = 0;
    this.state.hits    = 0;
    this.state.miss    = 0;
    this.state.combo   = 0;
    this.state.bestCombo=0;
    this.state.fever   = false;
    this.player.state  = STATE_RUN;
    this.player.timer  = 0;
    this._clearObstacles();
    this._hud();
    this._msg(this.str.msgGo);

    this._startSpawnLoop();
    this._loop(performance.now());
  }

  pause(v=true){
    if (!this.state.running) return;
    this.state.paused = v;
    if (v){
      if (this.spawnTimer) clearInterval(this.spawnTimer);
      this.spawnTimer = null;
      this._msg(this.str.msgPaused);
    }else{
      this._msg(this.str.msgResume);
      this.state.lastTs = 0;
      this._startSpawnLoop();
      this._loop(performance.now());
    }
  }

  _startSpawnLoop(){
    if (this.spawnTimer) clearInterval(this.spawnTimer);
    const iv = this.cfg.spawnInterval * 1000;
    this.spawnTimer = setInterval(()=>{
      if (!this.state.running || this.state.paused) return;
      this._spawnObstacle();
    }, iv);
  }

  _clearObstacles(){
    this.obstacles.forEach(o=>{
      o.el && o.el.remove && o.el.remove();
    });
    this.obstacles.clear();
  }

  // -------------------------------------------------------------------------
  // PLAYER ACTIONS
  // -------------------------------------------------------------------------
  _setPlayerState(state){
    if (!this.player.el) return;
    this.player.state = state;
    this.player.timer = 0;

    if (state === STATE_RUN){
      this.player.el.style.transform = 'translateY(0) scale(1)';
      this.player.el.style.filter = 'brightness(1)';
      this.player.el.textContent = '🏃‍♂️';
    }else if (state === STATE_JUMP){
      this.player.el.style.transform = 'translateY(40%) scale(1.05)';
      this.player.el.style.filter = 'brightness(1.05)';
      this.player.el.textContent = '🦘';
    }else if (state === STATE_DUCK){
      this.player.el.style.transform = 'translateY(-20%) scale(0.9)';
      this.player.el.style.filter = 'brightness(0.95)';
      this.player.el.textContent = '🛡️';
    }
  }

  _triggerJump(){
    this._setPlayerState(STATE_JUMP);
  }

  _triggerDuck(){
    this._setPlayerState(STATE_DUCK);
  }

  // -------------------------------------------------------------------------
  // OBSTACLES
  // -------------------------------------------------------------------------
  _spawnObstacle(){
    const rect = this.arena.getBoundingClientRect();
    const id   = 'o-' + Date.now() + '-' + Math.random().toString(16).slice(2);

    // type: low (jump), high (duck)
    const type = Math.random() < 0.5 ? 'low' : 'high';

    // special: gold / bomb
    let special = 'normal';
    const r = Math.random();
    if (r < BOMB_CHANCE) special = 'bomb';
    else if (r < BOMB_CHANCE + GOLD_CHANCE) special = 'gold';

    const el = document.createElement('div');
    el.className = 'jd-obstacle';
    el.dataset.id = id;
    el.dataset.type = type;
    el.dataset.special = special;

    const width  = 55;
    const height = type === 'low' ? 45 : 90;

    el.style.position = 'absolute';
    el.style.width  = width + 'px';
    el.style.height = height + 'px';
    el.style.right  = '-70px';
    el.style.bottom = type === 'low' ? '20%' : `20% + ${height}px`;
    el.style.borderRadius = '10px';
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';
    el.style.fontSize = '26px';
    el.style.color    = '#0f172a';
    el.style.boxShadow = '0 0 15px rgba(15,23,42,0.9)';

    if (special === 'gold'){
      el.style.background = 'linear-gradient(135deg,#facc15,#f97316)';
      el.style.boxShadow  = '0 0 18px rgba(250,204,21,0.95)';
      el.textContent      = '★';
    }else if (special === 'bomb'){
      el.style.background = 'linear-gradient(135deg,#f97316,#b91c1c)';
      el.style.boxShadow  = '0 0 18px rgba(248,113,113,0.95)';
      el.textContent      = '💣';
    }else{
      el.style.background = type === 'low'
        ? 'linear-gradient(135deg,#38bdf8,#0ea5e9)'
        : 'linear-gradient(135deg,#6366f1,#4f46e5)';
      el.textContent = type === 'low' ? '▃' : '▇';
    }

    this.arena.appendChild(el);

    const now = performance.now();
    const o = {
      id, el,
      type,
      special,
      x: rect.width + 70,
      y: 0,
      createdAt: now,
      passed: false,
      hit: false
    };
    this.obstacles.set(id, o);
    this.state.totalObstacles++;
  }

  _updateObstacles(dt){
    const rect = this.arena.getBoundingClientRect();
    const playerRect = this.player.el.getBoundingClientRect();

    const toRemove = [];

    this.obstacles.forEach((o, id)=>{
      o.x -= this.cfg.speed * dt;
      if (!o.el) { toRemove.push(id); return; }

      const xPx = o.x;
      o.el.style.right = (rect.width - xPx) + 'px';

      const obsRect = o.el.getBoundingClientRect();

      // collision zone (แนวตั้ง: ส่วนล่างของ arena)
      const colZoneX = playerRect.left + playerRect.width * 0.2;
      const colZoneX2= playerRect.right;

      const overlapX = obsRect.left < colZoneX2 && obsRect.right > colZoneX;
      if (overlapX && !o.hit && !o.passed){
        // check player state vs obstacle type
        const ok =
          (o.type === 'low'  && this.player.state === STATE_JUMP) ||
          (o.type === 'high' && this.player.state === STATE_DUCK);

        if (ok){
          // hit = หลบสำเร็จ
          this._onObstacleCleared(o);
          o.passed = true;
          toRemove.push(id);
        }else{
          // miss (ชน)
          this._onObstacleCollide(o);
          o.hit = true;
          toRemove.push(id);
        }
      }

      // ถ้าเลยซ้ายสุดแล้ว (ยังไม่ชน) ถือว่าหลบสำเร็จด้วย (run under)
      if (!o.hit && !o.passed && obsRect.right < playerRect.left - 10){
        this._onObstacleCleared(o);
        o.passed = true;
        toRemove.push(id);
      }
    });

    toRemove.forEach(id=>{
      const o = this.obstacles.get(id);
      if (o && o.el) o.el.remove();
      this.obstacles.delete(id);
    });
  }

  _onObstacleCleared(o){
    // base score
    let gain = this.cfg.baseScore;
    if (o.special === 'gold') {
      gain = Math.round(gain * 2);
    } else if (o.special === 'bomb') {
      // bomb ที่หลบถูก → โบนัสเพิ่ม
      gain = Math.round(gain * 2.5);
    }

    this.state.hits++;
    this.state.combo++;
    this.state.bestCombo = Math.max(this.state.bestCombo, this.state.combo);

    let inFever = this.state.combo >= 5;
    if (inFever){
      gain = Math.round(gain * 1.4);
      if (!this.state.fever) {
        this.state.fever = true;
        this._showFeverFx();
      }
    }else{
      this.state.fever = false;
    }

    this.state.score += gain;
    this._hud();
    this._screenShake(false);
    this._spawnHitFx(o, '+'+gain, false);
  }

  _onObstacleCollide(o){
    this.state.miss++;
    this.state.combo = 0;
    this.state.fever = false;

    // bomb ลงโทษเพิ่ม
    if (o.special === 'bomb'){
      this.state.score = Math.max(0, this.state.score - 40);
    }else{
      this.state.score = Math.max(0, this.state.score - 10);
    }

    this._hud();
    this._screenShake(true);
    this._spawnHitFx(o, 'MISS', true);

    // flash player
    if (this.player.el){
      this.player.el.style.filter = 'brightness(1.4)';
      this.player.el.style.boxShadow = '0 0 20px rgba(248,113,113,0.9)';
      setTimeout(()=>{
        this.player.el.style.filter = 'brightness(1)';
        this.player.el.style.boxShadow = '0 0 18px rgba(34,197,94,0.9)';
      }, 150);
    }
  }

  // -------------------------------------------------------------------------
  // FX
  // -------------------------------------------------------------------------
  _screenShake(isBad){
    const target = this.arena;
    if (!target) return;
    target.style.transition = 'transform 0.08s';
    const mag = isBad ? 10 : 5;
    target.style.transform = `translate(${(Math.random()-0.5)*mag}px, ${(Math.random()-0.5)*mag}px)`;
    setTimeout(()=>{ target.style.transform = 'translate(0,0)'; }, 90);
  }

  _spawnHitFx(o, text, isBad){
    const rect = o.el.getBoundingClientRect();
    const x = rect.left + rect.width/2;
    const y = rect.top + rect.height*0.1;

    const fx = document.createElement('div');
    fx.textContent = text;
    fx.style.position = 'fixed';
    fx.style.left = x + 'px';
    fx.style.top  = y + 'px';
    fx.style.transform = 'translate(-50%,-50%)';
    fx.style.zIndex = '9999';
    fx.style.fontSize = '20px';
    fx.style.fontWeight = '900';
    fx.style.color = isBad ? '#fb7185' : '#4ade80';
    fx.style.textShadow = '0 0 10px rgba(15,23,42,0.9)';
    fx.style.pointerEvents = 'none';
    fx.style.animation = 'sbHitFloat 0.55s ease-out forwards';
    document.body.appendChild(fx);
    setTimeout(()=>fx.remove(), 600);
  }

  _showFeverFx(){
    const el = document.createElement('div');
    el.textContent = 'FEVER!!';
    el.style.position = 'fixed';
    el.style.left = '50%';
    el.style.top  = '18%';
    el.style.transform = 'translate(-50%,-50%)';
    el.style.zIndex = '9999';
    el.style.fontSize = '32px';
    el.style.fontWeight = '900';
    el.style.letterSpacing = '0.18em';
    el.style.color = '#facc15';
    el.style.textShadow = '0 0 18px rgba(250,204,21,0.95)';
    el.style.animation = 'feverFlash 0.7s ease-out forwards';
    document.body.appendChild(el);
    setTimeout(()=>el.remove(), 700);
  }

  // -------------------------------------------------------------------------
  // LOOP
  // -------------------------------------------------------------------------
  _loop(ts){
    if (!this.state.running || this.state.paused) return;
    if (!this.state.lastTs) this.state.lastTs = ts;
    const dt = (ts - this.state.lastTs)/1000;
    this.state.lastTs = ts;
    this.state.elapsed += dt;
    this.state.timeLeft = Math.max(0, this.timeLimit - this.state.elapsed);

    // update player state timer
    this.player.timer += dt;
    if (this.player.state === STATE_JUMP && this.player.timer >= JUMP_TIME){
      this._setPlayerState(STATE_RUN);
    }else if (this.player.state === STATE_DUCK && this.player.timer >= DUCK_TIME){
      this._setPlayerState(STATE_RUN);
    }

    // update obstacles
    this._updateObstacles(dt);

    this._hud();

    if (this.state.timeLeft <= 0){
      this._finish();
      return;
    }

    requestAnimationFrame(this._loop.bind(this));
  }

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  _buildSummary(){
    const total = this.state.hits + this.state.miss;
    const acc   = total>0 ? this.state.hits/total : 0;

    const duration = this.state.elapsed || this.timeLimit;
    const notesPerSec = duration>0 ? total / duration : 0;
    const notesPerMin = notesPerSec * 60;

    let rank = 'C';
    if(this.state.score>=800 && acc>=0.95) rank='SSS';
    else if(this.state.score>=600 && acc>=0.90) rank='S';
    else if(this.state.score>=420 && acc>=0.80) rank='A';
    else if(this.state.score>=260 && acc>=0.60) rank='B';

    return {
      profile:  this.profile,
      game:     'jump-duck',
      diff:     this.diff,
      duration,
      score:    this.state.score,
      hits:     this.state.hits,
      miss:     this.state.miss,
      comboMax: this.state.bestCombo,
      accuracy: acc,
      notesPerSec,
      notesPerMin,
      rank,
      device:   detectDevice(),
      timestamp:new Date().toISOString()
    };
  }

  // -------------------------------------------------------------------------
  // FINISH + RESULT
  // -------------------------------------------------------------------------
  async _finish(){
    this.state.running = false;
    if (this.spawnTimer) clearInterval(this.spawnTimer);
    this.spawnTimer = null;

    this._clearObstacles();
    this._hud();
    this._msg(this.str.msgEnd);

    const ripple = document.createElement('div');
    ripple.className = 'sb-finish-ripple';
    document.body.appendChild(ripple);
    setTimeout(()=>ripple.remove(), 600);

    const summary = this._buildSummary();
    const ok = this._showResult(summary);
    if (!ok){
      const acc = (summary.accuracy*100).toFixed(1);
      alert(
        `Jump Duck Result\n` +
        `Score: ${summary.score}\n` +
        `Hits: ${summary.hits}\n` +
        `Miss: ${summary.miss}\n` +
        `Accuracy: ${acc}%\n` +
        `Best Combo: x${summary.comboMax}\n` +
        `Rank: ${summary.rank}`
      );
    }

    try{
      await hybridSaveSession(summary, true);
    }catch(e){
      console.warn('jump-duck save error', e);
    }
  }

  _showResult(summary){
    const box   = this.result.box  || document.getElementById('jdResultCard');
    const sc    = this.result.score|| document.getElementById('jdScore');
    const h     = this.result.hits || document.getElementById('jdHits');
    const m     = this.result.miss || document.getElementById('jdMiss');
    const accEl = this.result.acc  || document.getElementById('jdAcc');
    const best  = this.result.best || document.getElementById('jdBest');
    const rank  = this.result.rank || document.getElementById('jdRank');

    if (!box) return false;
    box.style.display = 'flex';

    const acc = Math.round((summary.accuracy||0)*100);

    if (sc)    sc.textContent   = summary.score;
    if (h)     h.textContent    = summary.hits;
    if (m)     m.textContent    = summary.miss;
    if (accEl) accEl.textContent= acc + '%';
    if (best)  best.textContent = 'x' + summary.comboMax;
    if (rank)  rank.textContent = summary.rank;

    const csvBtn = this.csvBtn || document.getElementById('jdCsvBtn');
    const pdfBtn = this.pdfBtn || document.getElementById('jdPdfBtn');
    if (csvBtn) csvBtn.onclick = ()=>downloadCSVRow(summary);
    if (pdfBtn) pdfBtn.onclick = ()=>exportPDF(summary);

    return true;
  }
}